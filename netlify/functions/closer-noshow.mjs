/**
 * Sweep agendado: dispara um webhook para cada lead da TRILHA CLOSER (premium =
 * médico 10k+ ou qualquer 50k+) que COMPLETOU o quiz mas NÃO agendou reunião.
 *
 * Por que cron e não tempo real: "não agendou" é um evento negativo (a ausência
 * de uma ação) — o lead pode fechar a aba; não dá pra detectar no cliente de forma
 * confiável. Então varremos o Supabase periodicamente:
 *   premium + status=completo + agendado=false + esfriou (carência) + ainda não enviado.
 *
 * Idempotência: grava closer_webhook_sent_at ao confirmar o 2xx do webhook; quem
 * falhar fica pendente e é re-tentado no próximo sweep. Se o lead agendar depois,
 * o filtro agendado=false já o exclui.
 *
 * Schedule: a cada 15 min. Carência padrão: 30 min após a última atividade do lead
 * (dá tempo de ele marcar antes de virar "no-show"). Ambos configuráveis por env.
 */
const SUPABASE_URL = (process.env.SUPABASE_DIAG_URL || 'https://aktktxizmpwckvxbdjzf.supabase.co').replace(/\/+$/, '');
const WEBHOOK_URL = process.env.CLOSER_WEBHOOK_URL || 'https://core-ascensao.vercel.app/api/webhook/chatquiz';
const GRACE_MIN = Number(process.env.CLOSER_WEBHOOK_GRACE_MIN) || 30;
const BATCH = 100;

export default async (req) => {
  const KEY = process.env.SUPABASE_DIAG_SERVICE;
  if (!KEY) { console.error('closer-noshow: SUPABASE_DIAG_SERVICE ausente'); return resp({ ok: false, error: 'no_service_key' }, 500); }
  const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  // gate: o endpoint tem URL pública (/.netlify/functions/closer-noshow). Só pode rodar
  // (a) o agendador do Netlify — que invoca via POST com o corpo {next_run}; ou
  // (b) um trigger manual com ?t=<DASHBOARD_TOKEN>. Qualquer outra chamada → 403.
  let body = {};
  try { body = await req.json(); } catch { /* GET / sem corpo */ }
  const isScheduled = !!(body && body.next_run);
  let token = '';
  try { token = new URL(req.url).searchParams.get('t') || (body && body.token) || ''; } catch { token = (body && body.token) || ''; }
  const okManual = process.env.DASHBOARD_TOKEN && token === process.env.DASHBOARD_TOKEN;
  if (!isScheduled && !okManual) return resp({ ok: false, error: 'forbidden' }, 403);

  const cutoff = new Date(Date.now() - GRACE_MIN * 60000).toISOString();
  const q = `${SUPABASE_URL}/rest/v1/diag_instagram_leads`
    + `?call_track=eq.premium&status=eq.completo&agendado=eq.false`
    + `&closer_webhook_sent_at=is.null&updated_at=lt.${encodeURIComponent(cutoff)}`
    + `&order=updated_at.asc&limit=${BATCH}&select=*`;

  let leads;
  try {
    const r = await fetch(q, { headers: auth });
    if (!r.ok) { console.error('closer-noshow query:', r.status, await r.text().catch(() => '')); return resp({ ok: false, error: 'query_failed' }, 502); }
    leads = await r.json();
  } catch (e) { console.error('closer-noshow query err:', e?.message || e); return resp({ ok: false, error: 'query_err' }, 500); }

  let enviados = 0, falhas = 0, pulados = 0;
  for (const lead of leads) {
    // o endpoint exige name + email (strings). Sem eles, não dá pra enviar.
    if (!lead.email || !lead.nome) { pulados++; console.warn('closer-noshow: lead sem nome/email, pulando', lead.lead_ref); continue; }
    try {
      const w = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CLOSER_WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.CLOSER_WEBHOOK_SECRET } : {}),
        },
        // payload FLAT: todas as colunas do lead + os campos que o endpoint exige/entende.
        // O receptor (funnel CHATQUIZ) já marca stage=PREENCHEU_NAO_AGENDOU.
        body: JSON.stringify({
          ...lead,
          name: lead.nome || '',
          email: lead.email || '',
          phone: lead.whatsapp || '',
          whatsapp: lead.whatsapp || '',
          instagram: lead.instagram || '',
          evento: 'closer_completou_sem_agendar',
          enviado_em: new Date().toISOString(),
        }),
      });
      if (!w.ok) { falhas++; console.error('closer-noshow webhook:', lead.lead_ref, w.status, await w.text().catch(() => '')); continue; }

      // marca como enviado (idempotência) — só após o 2xx do webhook
      const p = await fetch(`${SUPABASE_URL}/rest/v1/diag_instagram_leads?lead_ref=eq.${encodeURIComponent(lead.lead_ref)}`, {
        method: 'PATCH',
        headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ closer_webhook_sent_at: new Date().toISOString() }),
      });
      if (!p.ok) console.error('closer-noshow mark:', lead.lead_ref, p.status, await p.text().catch(() => ''));
      enviados++;
    } catch (e) { falhas++; console.error('closer-noshow send err:', lead.lead_ref, e?.message || e); }
  }

  // heartbeat: registra a última varredura em funnel_config (observabilidade do cron)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/funnel_config?on_conflict=key`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'closer_noshow_last_run', value: `${new Date().toISOString()} · ${leads.length} cand / ${enviados} env`, updated_at: new Date().toISOString() }),
    });
  } catch { /* heartbeat é best-effort */ }

  console.log(`closer-noshow: ${leads.length} candidato(s), ${enviados} enviado(s), ${falhas} falha(s), ${pulados} pulado(s) · carência ${GRACE_MIN}min`);
  return resp({ ok: true, candidatos: leads.length, enviados, falhas, pulados });
};

function resp(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// roda a cada 15 minutos (cron). Sem path HTTP — é invocada pelo agendador do Netlify.
export const config = { schedule: '*/15 * * * *' };
