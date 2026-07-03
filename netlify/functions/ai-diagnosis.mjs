import Anthropic from '@anthropic-ai/sdk';
import { buildDiagnosisPrompt } from '../_private.mjs';

/**
 * PRÉ-DIAGNÓSTICO pelo MÉTODO CORE (prompt oficial do Fabio, adaptado
 * do app corereels para saída em formato de chat).
 * 3 pilares: Gatilho da Atenção · Conteúdo Notável · CTA & Conversão.
 * Estratégia: notas + veredito citando trechos reais, SEM revelar a
 * correção (seed → Sessão Estratégica).
 * Sem ANTHROPIC_API_KEY (ou erro/timeout) → ok:false e o front usa o
 * template local. Modelo via env DIAGNOSIS_MODEL — padrão claude-haiku-4-5
 * (mesmo modelo do app corereels original do Fabio: o prompt do método é
 * grande e a janela da função Netlify é ~10s; modelos maiores estouram).
 */

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors() });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ ok: false, reason: 'no_key' });

  try {
    const { nome, instagram, nicho, desafio, faturamento, uf, profile, reel, transcript } = await req.json();
    if (!nome || !instagram) return json({ ok: false, reason: 'missing_fields' });
    const temRoteiro = typeof transcript === 'string' && transcript.trim().length > 20;

    const client = new Anthropic({
      apiKey,
      timeout: 9000,   // Netlify sync functions têm janela curta; o front tem fallback
      maxRetries: 0,
    });

    // Métricas pré-calculadas (não deixar o modelo fazer aritmética)
    let fatos = '';
    if (profile && profile.followersCount) {
      const f = profile.followersCount;
      fatos += `\n## DADOS REAIS DO PERFIL (coletados agora)\n` +
        `- Seguidores: ${f.toLocaleString('pt-BR')}\n` +
        `- Publicações: ${(profile.postsCount || 0).toLocaleString('pt-BR')}\n` +
        (profile.fullName ? `- Nome no perfil: ${profile.fullName}\n` : '') +
        (profile.biography ? `- Bio: "${String(profile.biography).slice(0, 300)}"\n` : '- Bio: vazia\n') +
        (profile.businessCategoryName ? `- Categoria: ${profile.businessCategoryName}\n` : '') +
        (profile.externalUrl ? `- Tem link na bio\n` : `- SEM link na bio (atenção: atenção gerada sem destino)\n`);
      if (reel && reel.views != null) {
        const ratio = f > 0 ? (reel.views / f) : 0;
        const interacoes = (reel.likes || 0) + (reel.comments || 0);
        fatos += `\n## REEL ESCOLHIDO PELO LEAD PARA ANÁLISE\n` +
          `- Views: ${Number(reel.views).toLocaleString('pt-BR')} (${ratio >= 1 ? 'ACIMA' : 'abaixo'} da base — razão ${ratio.toFixed(2).replace('.', ',')}x)\n` +
          (reel.likes != null ? `- Likes: ${Number(reel.likes).toLocaleString('pt-BR')}\n` : '') +
          (reel.comments != null ? `- Comentários: ${Number(reel.comments).toLocaleString('pt-BR')}\n` : '') +
          `- Interações totais: ${interacoes.toLocaleString('pt-BR')} (${f > 0 ? ((interacoes / f) * 100).toFixed(2).replace('.', ',') : '?'}% da base)\n` +
          (temRoteiro
            ? `- ROTEIRO DO VÍDEO (transcrição do áudio — esta é a matéria-prima principal da análise; NÃO mencione "legenda"):\n"${String(transcript).slice(0, 1400)}"\n`
            : (reel.caption
              ? `- TEXTO PUBLICADO DO REEL (legenda — única matéria-prima textual disponível):\n"${String(reel.caption).slice(0, 700)}"\n`
              : '- Sem legenda (nenhum texto publicado para analisar)\n'));
      }
    }

    const { system, userMsg } = buildDiagnosisPrompt({ nome, instagram, nicho, desafio, faturamento, uf, fatos, temRoteiro });

    const response = await client.messages.create({
      model: process.env.DIAGNOSIS_MODEL || 'claude-haiku-4-5',
      max_tokens: 1400,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });

    let text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!text) return json({ ok: false, reason: 'empty' });

    // extrai e remove as linhas técnicas (notas dos pilares trancados + gatilho ausente)
    let notas = null, gatilho = '';
    const m = text.match(/\|\|NOTAS\|notavel=(\d{1,2})\|cta=(\d{1,2})\|\|/i);
    if (m) {
      notas = { notavel: Math.min(10, +m[1]), cta: Math.min(10, +m[2]) };
      text = text.replace(m[0], '').trim();
    }
    const g = text.match(/\|\|GATILHO\|([^|]{3,60})\|\|/i);
    if (g) {
      gatilho = g[1].trim();
      text = text.replace(g[0], '').trim();
    }

    // trava dura de tamanho: corta em fim de frase, nunca no meio
    const LIMITE = 750;
    if (text.length > LIMITE) {
      const corte = text.slice(0, LIMITE);
      const ultimoPonto = Math.max(corte.lastIndexOf('.'), corte.lastIndexOf('!'), corte.lastIndexOf('?'));
      if (ultimoPonto > 300) text = corte.slice(0, ultimoPonto + 1);
      else text = corte;
    }

    return json({ ok: true, text, notas, gatilho });
  } catch (err) {
    console.error('ai-diagnosis error:', err?.message || err);
    return json({ ok: false, reason: 'api_error' });
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

export const config = { path: '/api/ai-diagnosis' };
