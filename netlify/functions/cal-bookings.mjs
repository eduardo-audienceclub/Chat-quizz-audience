/**
 * Espelho dos agendamentos do Cal (aba "Agendamentos" do painel).
 * Puxa da API pública v2 do Cal.com (GET /v2/bookings) — fonte da verdade,
 * inclui bookings feitos fora do funil e o status real.
 * Protegido pelo DASHBOARD_TOKEN (mesmo do /api/metrics).
 *
 *   GET /api/cal-bookings → { ok, count, bookings:[{uid,eventTypeId,evento,start,end,status,attendee,attendeesCount}] }
 */
import { CAL_BASE as PRIV_CAL_BASE } from '../_private.mjs';
const CAL_BASE = (process.env.CALCOM_BASE_URL || PRIV_CAL_BASE).replace(/\/+$/, '');
const V_BOOKINGS = '2024-08-13';

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors() });

  const EXPECTED = process.env.DASHBOARD_TOKEN;
  if (!EXPECTED) return json({ error: 'DASHBOARD_TOKEN not configured' }, 503);
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) return json({ error: 'CALCOM_API_KEY not configured' }, 500);

  let body = {};
  try { if (req.method === 'POST') body = await req.json(); } catch { /* sem body */ }
  const token = req.headers.get('x-dash-token') || body.token || '';
  if (!safeEqual(String(token), String(EXPECTED))) return json({ error: 'unauthorized' }, 401);

  try {
    const r = await fetch(`${CAL_BASE}/bookings?take=100&sortStart=desc`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'cal-api-version': V_BOOKINGS },
    });
    if (!r.ok) { console.error('cal-bookings:', r.status, await r.text().catch(() => '')); return json({ ok: false, reason: 'cal_error' }, 502); }
    const data = await r.json();
    const arr = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    const bookings = arr.map((b) => {
      const at = Array.isArray(b.attendees) ? b.attendees : [];
      // título vem "Nome do evento entre X e Y" (ou "between X and Y") — fica só o nome do evento
      const evento = String(b.title || '').split(/\s+(?:entre|between)\s+/i)[0].trim() || ('Evento #' + (b.eventTypeId ?? '?'));
      return {
        uid: b.uid || '',
        eventTypeId: b.eventTypeId ?? null,
        evento,
        start: b.startTime || b.start || '',
        end: b.endTime || b.end || '',
        created: b.createdAt || b.created || '',
        status: b.status || '',
        attendee: (at[0] && at[0].name) || '',
        attendeesCount: at.length,
      };
    });
    return json({ ok: true, count: bookings.length, bookings });
  } catch (err) {
    console.error('cal-bookings error:', err?.message || err);
    return json({ ok: false, reason: 'error' }, 500);
  }
};

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-dash-token',
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors() } });
}

export const config = { path: '/api/cal-bookings' };
