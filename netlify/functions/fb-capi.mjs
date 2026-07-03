/**
 * Meta Conversions API (CAPI) — evento de conversão do lado servidor.
 * Espelha o evento que o Pixel dispara no navegador, com o MESMO event_id,
 * pra o Meta deduplicar (não conta 2x). Mais confiável que só o Pixel
 * (bloqueadores/iOS não derrubam o servidor) e melhora a atribuição.
 *
 * Dispara pros leads 10k+ (trilha premium=médico e audience=10k+ não-médico)
 * — o front filtra e aqui há trava defensiva. Dados (e-mail, telefone, nome) HASHEADOS
 * com SHA-256 antes de sair daqui (exigência do Meta). O token NUNCA vai
 * pro front — fica só na env FB_CAPI_TOKEN.
 *
 * Body: { event_name, event_id, track, email, phone, nome, fbp, fbc,
 *         event_source_url, value, currency, test_event_code? }
 * Env:  FB_CAPI_TOKEN (obrigatória), FB_PIXEL_ID (default no código),
 *       FB_TEST_EVENT_CODE (opcional — manda eventos pro Test Events).
 */
import { createHash } from 'node:crypto';

const PIXEL_ID = process.env.FB_PIXEL_ID || '943872144205445';
const GRAPH = 'https://graph.facebook.com/v21.0';

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors() });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const TOKEN = process.env.FB_CAPI_TOKEN;
  if (!TOKEN) return json({ ok: false, reason: 'no_token' });

  try {
    const b = await req.json();
    // trava defensiva: EXIGE track válido (premium=médico ou audience=10k+ não-médico).
    // Rejeita também quando track vem ausente/vazio — senão um request forjado sem
    // track furava o gate e injetava eventos no pixel.
    const ALVO = ['premium', 'audience'];
    if (!ALVO.includes(b.track)) return json({ ok: false, skipped: 'not_target' });

    const sha = (v) => createHash('sha256').update(String(v)).digest('hex');

    const email = String(b.email || '').trim().toLowerCase();
    // já vem em E.164 sem '+' (ddi + número) do front — não forçar 55 (quebraria estrangeiro)
    const phone = String(b.phone || '').replace(/\D/g, '');
    const nome = String(b.nome || '').trim().toLowerCase();
    const partes = nome.split(/\s+/).filter(Boolean);
    const fn = partes[0] || '';
    const ln = partes.length > 1 ? partes[partes.length - 1] : '';

    const ip = req.headers.get('x-nf-client-connection-ip')
      || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '';
    const ua = req.headers.get('user-agent') || '';

    const user_data = {};
    if (email) user_data.em = [sha(email)];
    if (phone) user_data.ph = [sha(phone)];
    if (fn) user_data.fn = [sha(fn)];
    if (ln) user_data.ln = [sha(ln)];
    if (b.fbp) user_data.fbp = b.fbp;            // cookies do Pixel (NÃO hashear)
    if (b.fbc) user_data.fbc = b.fbc;
    if (ip) user_data.client_ip_address = ip;
    if (ua) user_data.client_user_agent = ua;

    const custom_data = { currency: b.currency || 'BRL', content_name: b.content_name || 'Sessão Estratégica' };
    if (Number(b.value) > 0) custom_data.value = Number(b.value);

    const event = {
      event_name: b.event_name || 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data,
      custom_data,
    };
    if (b.event_id) event.event_id = b.event_id;                 // dedup com o Pixel
    if (b.event_source_url) event.event_source_url = b.event_source_url;

    const payload = { data: [event] };
    const testCode = b.test_event_code || process.env.FB_TEST_EVENT_CODE;
    if (testCode) payload.test_event_code = testCode;

    const res = await fetch(`${GRAPH}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('fb capi error:', res.status, JSON.stringify(data).slice(0, 300));
      return json({ ok: false, reason: 'fb_error', detail: data?.error?.message || '' });
    }
    return json({ ok: true, received: data.events_received ?? null, fbtrace_id: data.fbtrace_id || '' });
  } catch (err) {
    console.error('fb-capi error:', err?.message || err);
    return json({ ok: false, reason: 'error' });
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}

export const config = { path: '/api/fb-event' };
