/**
 * Perfil + reels via Apify em modo ASSÍNCRONO (start + poll).
 * O run-sync estourava o teto de tempo da função Netlify em perfis fora de
 * cache → o front caía no fluxo manual. Agora:
 *   POST {action:'start', username}            → {status:'started', runId, datasetId}
 *   POST {action:'poll', runId, datasetId}     → {status:'running'} | {status:'ok', profile, reels, niche} | erro
 * Cada chamada dura <2s; quem espera o Apify é o navegador, pollando.
 */
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors() });
  if (req.method !== 'POST') return json({ status: 'error', message: 'Method not allowed' }, 405);

  const apifyToken = process.env.APIFY_API_KEY;
  const actorId = process.env.APIFY_ACTOR || 'apify~instagram-profile-scraper';
  if (!apifyToken) return json({ status: 'no_key', message: 'Apify nao configurado' });

  try {
    const body = await req.json();

    /* ---------- START: dispara o run e volta na hora ---------- */
    if (body.action === 'start' || (!body.action && body.username)) {
      const cleanUsername = String(body.username || '').replace(/^@/, '').trim().toLowerCase();
      if (!/^[\w.]{1,30}$/.test(cleanUsername)) {
        return json({ status: 'invalid', message: 'Invalid username' }, 400);
      }

      const startRes = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}&timeout=90`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: [cleanUsername] }),
        }
      );

      if (!startRes.ok) {
        const errText = await startRes.text();
        console.error('Apify start error:', startRes.status, errText);
        return json({ status: 'apify_error', message: `Apify ${startRes.status}` });
      }

      const run = (await startRes.json()).data;
      return json({ status: 'started', runId: run.id, datasetId: run.defaultDatasetId });
    }

    /* ---------- POLL: checa o run; se terminou, entrega o resultado ---------- */
    if (body.action === 'poll') {
      const { runId, datasetId } = body;
      if (!runId || !datasetId) return json({ status: 'invalid', message: 'Missing runId/datasetId' }, 400);

      const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${apifyToken}`);
      if (!runRes.ok) return json({ status: 'apify_error', message: `Apify run ${runRes.status}` });
      const runStatus = (await runRes.json()).data?.status;

      if (runStatus === 'READY' || runStatus === 'RUNNING') return json({ status: 'running' });
      if (runStatus !== 'SUCCEEDED') {
        console.error('Apify run terminou com status:', runStatus);
        return json({ status: 'apify_error', message: `Run ${runStatus}` });
      }

      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${apifyToken}&clean=true&limit=2`
      );
      if (!itemsRes.ok) return json({ status: 'apify_error', message: `Dataset ${itemsRes.status}` });
      const items = await itemsRes.json();

      if (!Array.isArray(items) || items.length === 0) {
        return json({ status: 'not_found', message: 'Perfil nao encontrado' });
      }
      const p = items[0];
      if (p.error || p.errorDescription) {
        return json({ status: 'not_found', message: 'Perfil nao encontrado' });
      }

      return json(montarResposta(p));
    }

    return json({ status: 'invalid', message: 'Unknown action' }, 400);
  } catch (err) {
    console.error('instagram-profile error:', err);
    return json({ status: 'error', message: err.message });
  }
};

function montarResposta(p) {
  // o IG às vezes devolve a string literal "None" como categoria
  const rawCat = p.businessCategoryName && p.businessCategoryName !== 'None' ? p.businessCategoryName : '';

  const profile = {
    username: p.username || '',
    fullName: p.fullName || '',
    biography: p.biography || '',
    profilePicUrl: p.profilePicUrlHD || p.profilePicUrl || p.profile_pic_url || '',
    followersCount: p.followersCount ?? p.edge_followed_by?.count ?? 0,
    followsCount: p.followsCount ?? p.edge_follow?.count ?? 0,
    postsCount: p.postsCount ?? p.edge_owner_to_timeline_media?.count ?? 0,
    isBusinessAccount: !!p.isBusinessAccount,
    businessCategoryName: rawCat,
    externalUrl: p.externalUrl || p.external_url || '',
    verified: !!p.verified,
    private: !!p.private,
  };

  const posts = Array.isArray(p.latestPosts) ? p.latestPosts : [];
  const reels = posts
    .filter((x) => x && (x.type === 'Video' || x.productType === 'clips' || x.videoViewCount != null || x.videoPlayCount != null))
    .slice(0, 8)
    .map((x) => ({
      url: x.url || (x.shortCode ? `https://www.instagram.com/reel/${x.shortCode}/` : ''),
      caption: String(x.caption || '').slice(0, 800), // legenda completa = matéria-prima do roteiro
      thumb: x.displayUrl || (Array.isArray(x.images) ? x.images[0] : '') || '',
      videoUrl: x.videoUrl || '', // p/ futura transcrição do áudio
      views: x.videoViewCount ?? x.videoPlayCount ?? null,
      likes: x.likesCount ?? null,
      comments: x.commentsCount ?? null,
      timestamp: x.timestamp || '',
    }));

  return { status: 'ok', profile, reels, niche: detectNiche(profile) };
}

const NICHE_KEYWORDS = {
  'Saúde & Bem-estar': ['nutricion', 'nutri ', 'saude', 'bem-estar', 'wellness', 'medic', 'enferm', 'fisio', 'psicolog', 'terapeut', 'longevidade'],
  'Fitness': ['personal', ' fit ', 'fitness', 'academia', 'treino', 'crossfit', 'pilates', 'yoga', 'musculacao', 'emagrec'],
  'Estética & Beleza': ['beleza', 'maquiagem', 'cabelo', 'estetic', 'cosmetic', 'salao', 'unhas', 'sobrancelha', 'lash', 'micropigmenta'],
  'Marketing & Negócios': ['empresar', 'empreend', 'business', 'ceo ', 'consultor', 'gestao', 'founder', 'marketing', 'social media', 'trafego', 'copywriter', 'growth', 'mentor', 'coach'],
  'Educação & Concursos': ['professor', 'educac', 'ensino', 'escola', 'curso', 'aulas', 'pedagog', 'concurso', 'idiomas'],
  'Finanças & Investimentos': ['financ', 'investimento', 'bolsa', 'cripto', 'economia', 'planejad', 'contab'],
  'Direito': ['advogad', 'direito', 'juridic', 'oab '],
  'Moda': ['moda', 'fashion', 'estilo', 'estilist', 'roupa'],
  'Gastronomia & Food': ['chef', 'gastronomia', 'culinaria', 'receita', 'cozinha', 'confeit', 'restaurante'],
  'Imobiliário': ['imovel', 'imobiliar', 'corretor', 'real estate'],
};

/* categorias oficiais do IG → nossos nichos (cobre quando a bio não tem keyword) */
const CATEGORY_MAP = {
  'marketing agency': 'Marketing & Negócios', 'advertising agency': 'Marketing & Negócios',
  'entrepreneur': 'Marketing & Negócios', 'business': 'Marketing & Negócios',
  'consulting agency': 'Marketing & Negócios', 'coach': 'Marketing & Negócios',
  'health/beauty': 'Estética & Beleza', 'beauty salon': 'Estética & Beleza',
  'beauty, cosmetic & personal care': 'Estética & Beleza', 'barber shop': 'Estética & Beleza',
  'gym/physical fitness center': 'Fitness', 'personal trainer': 'Fitness', 'sports & fitness': 'Fitness',
  'doctor': 'Saúde & Bem-estar', 'medical & health': 'Saúde & Bem-estar', 'dentist': 'Saúde & Bem-estar',
  'nutritionist': 'Saúde & Bem-estar', 'psychologist': 'Saúde & Bem-estar',
  'lawyer & law firm': 'Direito', 'legal': 'Direito',
  'financial service': 'Finanças & Investimentos', 'investing service': 'Finanças & Investimentos',
  'education': 'Educação & Concursos', 'school': 'Educação & Concursos', 'tutor/teacher': 'Educação & Concursos',
  'clothing (brand)': 'Moda', 'clothing store': 'Moda',
  'restaurant': 'Gastronomia & Food', 'food & beverage': 'Gastronomia & Food', 'chef': 'Gastronomia & Food',
  'real estate agent': 'Imobiliário', 'real estate': 'Imobiliário',
};

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function detectNiche(profile) {
  const text = normalize((profile.biography || '') + ' ' + (profile.businessCategoryName || ''));
  let best = '';
  let bestScore = 0;
  for (const niche in NICHE_KEYWORDS) {
    let s = 0;
    for (const kw of NICHE_KEYWORDS[niche]) {
      if (text.includes(normalize(kw))) s += 1;
    }
    if (s > bestScore) { bestScore = s; best = niche; }
  }
  if (best) return best;

  const cat = normalize(profile.businessCategoryName || '');
  for (const key in CATEGORY_MAP) {
    if (cat && (cat === key || cat.includes(key))) return CATEGORY_MAP[key];
  }
  return profile.businessCategoryName || '';
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

export const config = { path: '/api/instagram-profile' };
