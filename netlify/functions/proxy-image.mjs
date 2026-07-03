// Server-side image proxy. Used to bypass Instagram CDN's hotlink blocking:
// the browser hits /api/proxy-image?url=<encoded instagram url>, this function
// fetches the asset without a problematic Referer header and re-serves the bytes.

const ALLOWED_HOSTS = [
  'cdninstagram.com',
  'fbcdn.net',
  'instagram.com',
];

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors() });
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors() });

  const url = new URL(req.url);
  const target = url.searchParams.get('url');
  if (!target) return new Response('Missing url', { status: 400, headers: cors() });

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('Invalid url', { status: 400, headers: cors() });
  }

  // Allowlist by host suffix to avoid SSRF
  const host = parsed.hostname;
  const allowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  if (!allowed) return new Response('Host not allowed', { status: 400, headers: cors() });

  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CoreEducacao/1.0)',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      return new Response('Upstream ' + res.status, { status: 502, headers: cors() });
    }

    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        ...cors(),
      },
    });
  } catch (err) {
    console.error('proxy-image error:', err);
    return new Response('Error: ' + err.message, { status: 500, headers: cors() });
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

export const config = { path: '/api/proxy-image' };
