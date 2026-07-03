/**
 * Sweep agendado: dispara um webhook para cada lead da trilha AUDIENCE (Raio X)
 * que AGENDOU a call (booking confirmado), incluindo a DATA da call.
 *
 * Positivo (ação concluída), então sem carência — assim que o booking existe no
 * Supabase (agendado + booking_uid), o próximo ciclo dispara. Idempotência pela
 * coluna raiox_webhook_sent_at (gravada só após 2xx). Lead que cancelar/rebooking
 * não é desfeito aqui (fora de escopo).
 *
 * Endpoint marca stage=RAIO_X_AGENDADO via ?stage=raio_x. Schedule: a cada 15 min.
 */
const SUPABASE_URL = (process.env.SUPABASE_DIAG_URL || 'https://aktktxizmpwckvxbdjzf.supabase.co').replace(/\/+$/, '');
const WEBHOOK_URL = process.env.RAIOX_WEBHOOK_URL || 'https://core-ascensao.vercel.app/api/webhook/chatquiz?stage=raio_x';
const BATCH = 100;

export default async (req) => {
  const KEY = process.env.SUPABASE_DIAG_SERVICE;
  if (!KEY) { console.error('raiox-agendou: SUPABASE_DIAG_SERVICE ausente'); return resp({ ok: false, error: 'no_service_key' }, 500); }
  const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  // gate: URL pública (/.netlify/functions/raiox-agendou). Só roda o agendador do
  // Netlify (POST com corpo {next_run}) ou um trigger manual com ?t=<DASHBOARD_TOKEN>.
  let body = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const isScheduled = !!(body && body.next_run);
  let token = '';
  try { token = new URL(req.url).searchParams.get('t') || (body && body.token) || ''; } catch { token = (body && body.token) || ''; }
  const okManual = process.env.DASHBOARD_TOKEN && token === process.env.DASHBOARD_TOKEN;
  if (!isScheduled && !okManual) return resp({ ok: false, error: 'forbidden' }, 403);

  const q = `${SUPABASE_URL}/rest/v1/diag_instagram_leads`
    + `?call_track=eq.audience&agendado=eq.true&booking_uid=not.is.null`
    + `&raiox_webhook_sent_at=is.null&order=agendamento_em.asc&limit=${BATCH}&select=*`;

  let leads;
  try {
    const r = await fetch(q, { headers: auth });
    if (!r.ok) { console.error('raiox-agendou query:', r.status, await r.text().catch(() => '')); return resp({ ok: false, error: 'query_failed' }, 502); }
    leads = await r.json();
  } catch (e) { console.error('raiox-agendou query err:', e?.message || e); return resp({ ok: false, error: 'query_err' }, 500); }

  let enviados = 0, falhas = 0, pulados = 0;
  for (const lead of leads) {
    if (!lead.email || !lead.nome) { pulados++; console.warn('raiox-agendou: lead sem nome/email, pulando', lead.lead_ref); continue; }
    try {
      // data da call num único campo data_call_br, já em horário de Brasília (DD/MM/AAAA HH:mm)
      const dc = lead.agendamento_em || '';
      const data_call_br = dc
        ? new Date(dc).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')
        : '';
      const w = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.RAIOX_WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.RAIOX_WEBHOOK_SECRET } : {}),
        },
        // payload FLAT: campos exigidos + a DATA da call em data_call_br (Brasília).
        // (o spread ...lead ainda traz agendamento_em cru/UTC como dado bruto do lead)
        body: JSON.stringify({
          ...lead,
          name: lead.nome || '',
          email: lead.email || '',
          phone: lead.whatsapp || '',
          whatsapp: lead.whatsapp || '',
          instagram: lead.instagram || '',
          data_call_br,
          evento: 'raio_x_agendado',
          enviado_em: new Date().toISOString(),
        }),
      });
      if (!w.ok) { falhas++; console.error('raiox-agendou webhook:', lead.lead_ref, w.status, await w.text().catch(() => '')); continue; }

      const p = await fetch(`${SUPABASE_URL}/rest/v1/diag_instagram_leads?lead_ref=eq.${encodeURIComponent(lead.lead_ref)}`, {
        method: 'PATCH',
        headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ raiox_webhook_sent_at: new Date().toISOString() }),
      });
      if (!p.ok) console.error('raiox-agendou mark:', lead.lead_ref, p.status, await p.text().catch(() => ''));
      enviados++;
    } catch (e) { falhas++; console.error('raiox-agendou send err:', lead.lead_ref, e?.message || e); }
  }

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/funnel_config?on_conflict=key`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'raiox_agendou_last_run', value: `${new Date().toISOString()} · ${leads.length} cand / ${enviados} env`, updated_at: new Date().toISOString() }),
    });
  } catch { /* heartbeat best-effort */ }

  console.log(`raiox-agendou: ${leads.length} candidato(s), ${enviados} enviado(s), ${falhas} falha(s), ${pulados} pulado(s)`);
  return resp({ ok: true, candidatos: leads.length, enviados, falhas, pulados });
};

function resp(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const config = { schedule: '*/15 * * * *' };
