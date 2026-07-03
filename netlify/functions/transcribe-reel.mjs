/**
 * TRANSCRIÇÃO DO REEL — actor Apify "Instagram AI Transcript Extractor"
 * (sian.agency, ~US$0,009/reel). Padrão assíncrono start+poll, igual ao
 * instagram-profile: cada chamada dura <2s; o navegador polla.
 *
 *   { action:'start', reelUrl }            → { ok:true, runId, datasetId }
 *   { action:'poll', runId, datasetId }    → { ok:true, status:'running' } |
 *                                            { ok:true, status:'done', transcript } |
 *                                            { ok:false, reason }
 * Sem APIFY_API_KEY → { ok:false, reason:'no_key' } (front segue sem roteiro).
 */
const ACTOR = process.env.APIFY_TRANSCRIPT_ACTOR || 'sian.agency~instagram-ai-transcript-extractor';

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors() });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const apifyToken = process.env.APIFY_API_KEY;
  if (!apifyToken) return json({ ok: false, reason: 'no_key' });

  try {
    const body = await req.json();

    if (body.action === 'start') {
      const url = String(body.reelUrl || '');
      if (!/^https:\/\/(www\.)?instagram\.com\//i.test(url)) {
        return json({ ok: false, reason: 'invalid_url' }, 400);
      }
      const r = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${apifyToken}&timeout=120`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instagramUrl: url, fastProcessing: true }),
        }
      );
      if (!r.ok) {
        console.error('transcribe start error:', r.status, await r.text().catch(() => ''));
        return json({ ok: false, reason: 'apify_error' });
      }
      const run = (await r.json()).data;
      return json({ ok: true, runId: run.id, datasetId: run.defaultDatasetId });
    }

    if (body.action === 'poll') {
      const { runId, datasetId } = body;
      if (!runId || !datasetId) return json({ ok: false, reason: 'missing_ids' }, 400);

      const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${apifyToken}`);
      if (!runRes.ok) return json({ ok: false, reason: 'apify_error' });
      const st = (await runRes.json()).data?.status;
      if (st === 'READY' || st === 'RUNNING') return json({ ok: true, status: 'running' });
      if (st !== 'SUCCEEDED') {
        console.error('transcribe run status:', st);
        return json({ ok: false, reason: `run_${st}` });
      }

      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${apifyToken}&clean=true&limit=3`
      );
      if (!itemsRes.ok) return json({ ok: false, reason: 'dataset_error' });
      const items = await itemsRes.json();
      const transcript = extrairTexto(items);
      if (!transcript) {
        console.error('transcribe: sem texto. chaves do item:', items?.[0] ? Object.keys(items[0]).join(',') : 'vazio');
        return json({ ok: false, reason: 'empty' });
      }
      return json({ ok: true, status: 'done', transcript: transcript.slice(0, 4000) });
    }

    return json({ ok: false, reason: 'unknown_action' }, 400);
  } catch (err) {
    console.error('transcribe error:', err?.message || err);
    return json({ ok: false, reason: 'error' });
  }
};

/* extração tolerante: o formato do item varia entre versões do actor */
function extrairTexto(items) {
  if (!Array.isArray(items)) return '';
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    for (const key of ['transcript', 'transcription', 'text', 'fullTranscript', 'transcriptText', 'caption_text']) {
      const v = item[key];
      if (typeof v === 'string' && v.trim().length > 10) return v.trim();
      if (Array.isArray(v)) {
        const joined = v.map((s) => (typeof s === 'string' ? s : s?.text || '')).join(' ').trim();
        if (joined.length > 10) return joined;
      }
    }
    if (Array.isArray(item.segments)) {
      const joined = item.segments.map((s) => s?.text || '').join(' ').trim();
      if (joined.length > 10) return joined;
    }
  }
  return '';
}

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

export const config = { path: '/api/transcribe-reel' };
