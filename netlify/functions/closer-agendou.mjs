/**
 * Sweep agendado: dispara um webhook para cada lead da trilha PREMIUM (Closer:
 * médico 10k+ ou 50k+) que AGENDOU o call dos closers, incluindo a DATA da call.
 *
 * Espelho do raiox-agendou, mas pra trilha premium. Idempotência pela coluna
 * closer_agendou_sent_at (≠ closer_webhook_sent_at, que é do NO-SHOW). Sem carência.
 *
 * IMPORTANTE: o stage vai na URL via ?stage=... — o endpoint core-ascensao precisa
 * RECONHECER esse stage (hoje só conhece raio_x; o resto cai em PREENCHEU_NAO_AGENDOU).
 * Só ativar (netlify.toml + deploy) depois que o stage do closer existir lá.
 *
 * Schedule: a cada 15 min (declarar em netlify.toml ao ativar).
 */
const SUPABASE_URL = (process.env.SUPABASE_DIAG_URL || 'https://aktktxizmpwckvxbdjzf.supabase.co').replace(/\/+$/, '');
const WEBHOOK_URL = process.env.CLOSER_AGENDOU_WEBHOOK_URL || 'https://core-ascensao.vercel.app/api/webhook/chatquiz?stage=call_agendada';
const BATCH = 100;

export default async (req) => {
  const KEY = process.env.SUPABASE_DIAG_SERVICE;
  if (!KEY) { console.error('closer-agendou: SUPABASE_DIAG_SERVICE ausente'); return resp({ ok: false, error: 'no_service_key' }, 500); }
  const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  // gate: URL pública. Só o agendador do Netlify (POST {next_run}) ou ?t=<DASHBOARD_TOKEN>.
  let body = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const isScheduled = !!(body && body.next_run);
  let token = '';
  try { token = new URL(req.url).searchParams.get('t') || (body && body.token) || ''; } catch { token = (body && body.token) || ''; }
  const okManual = process.env.DASHBOARD_TOKEN && token === process.env.DASHBOARD_TOKEN;
  if (!isScheduled && !okManual) return resp({ ok: false, error: 'forbidden' }, 403);

  const q = `${SUPABASE_URL}/rest/v1/diag_instagram_leads`
    + `?call_track=eq.premium&agendado=eq.true&booking_uid=not.is.null`
    + `&closer_agendou_sent_at=is.null&order=agendamento_em.asc&limit=${BATCH}&select=*`;

  let leads;
  try {
    const r = await fetch(q, { headers: auth });
    if (!r.ok) { console.error('closer-agendou query:', r.status, await r.text().catch(() => '')); return resp({ ok: false, error: 'query_failed' }, 502); }
    leads = await r.json();
  } catch (e) { console.error('closer-agendou query err:', e?.message || e); return resp({ ok: false, error: 'query_err' }, 500); }

  let enviados = 0, falhas = 0, pulados = 0;
  for (const lead of leads) {
    if (!lead.email || !lead.nome) { pulados++; console.warn('closer-agendou: lead sem nome/email, pulando', lead.lead_ref); continue; }
    try {
      const dc = lead.agendamento_em || '';
      const data_call_br = dc
        ? new Date(dc).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')
        : '';
      const w = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CLOSER_AGENDOU_WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.CLOSER_AGENDOU_WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify({
          ...lead,
          name: lead.nome || '',
          email: lead.email || '',
          phone: lead.whatsapp || '',
          whatsapp: lead.whatsapp || '',
          instagram: lead.instagram || '',
          vendedor: lead.vendedor || '',
          meet_link: lead.video_url || '',   // link do Google Meet da call (vazio se não capturado no booking)
          data_call_br,
          evento: 'closer_agendado',
          enviado_em: new Date().toISOString(),
        }),
      });
      if (!w.ok) { falhas++; console.error('closer-agendou webhook:', lead.lead_ref, w.status, await w.text().catch(() => '')); continue; }

      const p = await fetch(`${SUPABASE_URL}/rest/v1/diag_instagram_leads?lead_ref=eq.${encodeURIComponent(lead.lead_ref)}`, {
        method: 'PATCH',
        headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ closer_agendou_sent_at: new Date().toISOString() }),
      });
      if (!p.ok) console.error('closer-agendou mark:', lead.lead_ref, p.status, await p.text().catch(() => ''));
      enviados++;
    } catch (e) { falhas++; console.error('closer-agendou send err:', lead.lead_ref, e?.message || e); }
  }

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/funnel_config?on_conflict=key`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'closer_agendou_last_run', value: `${new Date().toISOString()} · ${leads.length} cand / ${enviados} env`, updated_at: new Date().toISOString() }),
    });
  } catch { /* heartbeat best-effort */ }

  console.log(`closer-agendou: ${leads.length} candidato(s), ${enviados} enviado(s), ${falhas} falha(s), ${pulados} pulado(s)`);
  return resp({ ok: true, candidatos: leads.length, enviados, falhas, pulados });
};

function resp(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// schedule declarado em netlify.toml ao ATIVAR (depois que o stage existir no core-ascensao).
export const config = { schedule: '*/15 * * * *' };
