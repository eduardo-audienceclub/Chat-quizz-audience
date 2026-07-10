import Anthropic from '@anthropic-ai/sdk';
import { buildDiagnosisPrompt } from '../_private.mjs';

/**
 * PRÉ-DIAGNÓSTICO EMOCIONAL SUAVIS (quiz da filha cuidadora).
 * Recebe as 8 respostas do quiz + o desfecho calculado no front
 * (low/mid/high) e devolve uma análise personalizada em formato chat:
 * pilar Consciência aberto + notas dos 2 pilares trancados + a trava
 * principal. Estratégia: profundidade SEM revelar o plano (seed →
 * Sessão SUAVIS).
 * Sem ANTHROPIC_API_KEY (ou erro/timeout) → ok:false e o front usa o
 * template local. Modelo via env DIAGNOSIS_MODEL — padrão claude-haiku-4-5
 * (a janela da função Netlify é ~10s; modelos maiores estouram).
 */

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors() });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ ok: false, reason: 'no_key' });

  try {
    const { nome, uf, respostas, consciencia, score } = await req.json();
    if (!nome || !respostas || typeof respostas !== 'object') return json({ ok: false, reason: 'missing_fields' });

    const client = new Anthropic({
      apiKey,
      timeout: 9000,   // Netlify sync functions têm janela curta; o front tem fallback
      maxRetries: 0,
    });

    // fatos pré-formatados (o modelo não precisa interpretar estrutura)
    const r = respostas;
    const linha = (rotulo, v) => v ? `- ${rotulo}: ${String(v).slice(0, 120)}\n` : '';
    const fatos =
      `\n## RESPOSTAS REAIS DO TESTE (dadas agora)\n` +
      linha('Idade', r.idade) +
      linha('Como se sente cuidando dos pais', r.sentimento) +
      linha('Área da vida mais afetada', r.area) +
      linha('Culpa por não dar conta de tudo (1-5)', r.culpa) +
      linha('Já buscou ajuda profissional', r.ajuda) +
      linha('Disposição para investir em si', r.disposicao) +
      linha('Prazo desejado para melhora', r.urgencia) +
      linha('Orçamento disponível', r.orcamento) +
      `- Desfecho calculado: ${consciencia || '?'} (score ${score ?? '?'} /100)\n`;

    const { system, userMsg } = buildDiagnosisPrompt({ nome, uf, fatos });

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

    // extrai e remove as linhas técnicas (notas dos pilares trancados + trava principal)
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
