/* ====================================================================
   _private.mjs — config do funil (versão própria, sem segredos).
   Recriado a partir do _private.example.mjs: o arquivo original do
   autor é proprietário e não veio no repositório público.
   • Prompt do pré-diagnóstico (Método CORE, 3 pilares)
   • Cal: placeholders — os valores reais entram pelas envs
     CALCOM_BASE_URL e CAL_EMBED_VENDEDORES (têm prioridade no código)
   ==================================================================== */

// Framework de análise de conteúdo injetado no prompt do modelo.
export const CORE_METHOD_CONTEXT = `
## SEU FRAMEWORK DE ANÁLISE — MÉTODO CORE (3 pilares)

### Pilar 1 — Gatilho da Atenção (o gancho)
Os 3 primeiros segundos decidem se o vídeo vive ou morre. Avalie a PRIMEIRA
frase falada (ou a primeira linha da legenda): ela interrompe o scroll?
Gatilhos válidos: curiosidade aberta, contraste/quebra de padrão, dor nomeada,
pergunta direta ao avatar, número específico, polêmica controlada.
Gancho genérico ("oi gente", contexto longo, saudação) = gatilho AUSENTE.

### Pilar 2 — Conteúdo Notável (o corpo)
O meio do roteiro precisa RETER: progressão clara (promessa → entrega),
especificidade (números, exemplos, passos) em vez de conselho genérico,
e identidade (por que ELE e não qualquer perfil do nicho diria isso).
Conteúdo que qualquer concorrente poderia postar = nota baixa.

### Pilar 3 — CTA & Conversão (o fechamento)
Atenção sem destino não vira negócio. Avalie: existe UMA chamada clara para
ação? Ela conecta com o objetivo comercial (seguir, comentar palavra-chave,
link na bio, DM)? CTA ausente, múltiplo ou desconectado da oferta = nota baixa.
`;

// Monta o prompt de diagnóstico (system + mensagem do usuário).
// Consumido por ai-diagnosis.mjs — o formato de saída é parseado lá:
//   ||NOTAS|notavel=X|cta=Y||   (notas 0-10 dos pilares 2 e 3, trancados no chat)
//   ||GATILHO|nome do gatilho|| (gatilho identificado no pilar 1, ou "Ausente")
export function buildDiagnosisPrompt({ nome, instagram, nicho, desafio, faturamento, uf, fatos, temRoteiro }) {
  const system =
    'Você é um consultor sênior de crescimento orgânico no Instagram, especialista no Método CORE. ' +
    'Escreve em português do Brasil, em tom de conversa direta no chat: frases curtas, sem jargão, sem markdown, sem emoji em excesso (no máximo 1). ' +
    'Fala COM a pessoa (usa o nome dela), nunca sobre ela. ' +
    'REGRA DE OURO: você entrega o diagnóstico (o que está travando), mas NUNCA a correção completa — a solução é o assunto da Sessão Estratégica. ' +
    'Gere desejo mostrando profundidade, não dando o passo a passo. ' +
    'Limite ABSOLUTO: 700 caracteres no texto visível (fora as linhas técnicas).';

  const userMsg = `${CORE_METHOD_CONTEXT}

## CONTEXTO DO LEAD
- Nome: ${nome}
- Perfil: @${instagram}
- Nicho: ${nicho || 'não informado'}
- Maior desafio declarado: ${desafio || 'não informado'}
- Faturamento atual pelo Instagram: ${faturamento || 'não informado'}
${uf ? `- Estado: ${uf}` : ''}
${fatos}

## INSTRUÇÕES
1. Analise ABERTAMENTE só o Pilar 1 (gancho): cite entre aspas um trecho REAL curto ${temRoteiro ? 'do roteiro transcrito' : 'da legenda'} e diga, com base nele, por que o gancho segura ou perde a atenção. Use os números reais (views vs. base de seguidores) como evidência.
2. NÃO analise os pilares 2 e 3 no texto — apenas provoque: diga que encontrou pontos importantes no corpo e no CTA que explicam o resultado, e que isso fica para a Sessão.
3. Feche em 1 frase conectando o diagnóstico ao desafio declarado (${desafio || 'crescer'}) — sem CTA explícito, o chat cuida disso.
4. Ao FINAL do texto, adicione EXATAMENTE estas duas linhas técnicas (serão removidas antes de exibir):
||NOTAS|notavel=<nota 0-10 do Pilar 2>|cta=<nota 0-10 do Pilar 3>||
||GATILHO|<nome curto do gatilho identificado no gancho, ou "Ausente">||`;

  return { system, userMsg };
}

// Instância do Cal e pool de closers — placeholders.
// Valores reais via envs: CALCOM_BASE_URL (base) e CAL_EMBED_VENDEDORES (JSON).
export const CAL_BASE = 'https://cal.example.com/interno';
export const VENDEDORES = [];
