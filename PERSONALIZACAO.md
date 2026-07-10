# Raio-X de Personalização — ChatQuiz Audience

> ⚠️ **NOTA (2026-07-10)**: a adaptação SUAVIS foi aplicada — o funil agora é o
> Teste de Prontidão Emocional (verde #50b143, 8 perguntas do quiz SUAVIS,
> diagnóstico emocional por IA, final com agendamento). Este documento descreve
> a estrutura ORIGINAL (Instagram/Core Audience) e serve como mapa de onde cada
> tipo de copy vive no código. A extração do quiz SUAVIS está em
> `referencia/SUAVIS-QUIZ.md` (fora do git).

Tudo que é personalizável no funil, com localização exata (arquivo:linha).
Edite este arquivo com a sua versão de cada copy e me peça para aplicar.

---

## 1. Identidade visual

| Item | Onde | O que fazer |
|---|---|---|
| **Logo** | `logo.png` (raiz) | Substituir o arquivo. Usado no favicon, badge do header (fundo escuro `#0d0a1a`), fallback do avatar. Aparece em index, call e dashboard |
| **Avatar do chat** | `fabio.jpg` + `CONFIG.AVATAR_URL` (index.html:581) | Trocar pela SUA foto (recorte quadrado). O README reforça: foto humana converte mais que logo. Também hardcoded em call.html:110 |
| **Imagem do produto/presente** | `CONFIG.PRODUTO_IMG` (index.html:583) | Opcional: imagem real do seu presente. Vazio = mockup nativo (seção 6.3) |
| **Cores do tema** | index.html:30-55, call.html:14-22, dashboard.html | Acento roxo `#a155f2` (accent/bright/dark/soft/glow + gradientes). Header escuro `#0d0a1a`. Dourado do presente `#f5a623` |
| **Fonte** | Google Fonts `Inter` (index.html:28) | Trocar se quiser outra identidade tipográfica |

## 2. Config técnica e regras de negócio

| Item | Onde | Valor atual |
|---|---|---|
| WhatsApp | `CONFIG.WHATSAPP_NUMERO` (index.html:580) | `5511999999999` (placeholder!) — usado no CTA fallback do WhatsApp |
| Agenda local | `CONFIG.AGENDA` (index.html:593-598) | Seg-sex, 09-17h, 14 dias, 3h de antecedência |
| Meta Pixel | index.html:20 e 24 | `943872144205445` (do autor original — trocar ou remover!) |
| Scoring | `PONTOS_SEGUIDORES` / `PONTOS_FATURAMENTO` (index.html:604-611) | Pontos por faixa; qualificado ≥ 6 (`QUALIFICADO_MIN`, linha 619) |
| Título/SEO | index.html:7-8 | "Diagnóstico de Crescimento Orgânico \| Core Audience" + meta description |
| Storage key | `SKEY` (index.html:780) | `core_diag_ig_v2` — trocar se quiser zerar sessões de teste |

---

## 3. COPY DO FUNIL — etapa por etapa

> Formato: **[etapa]** → copy atual. `<b>` = negrito no chat. Variáveis: {primeiro}, {nicho}, etc.

### 3.0 Header e LGPD

- **Badge do header** (index.html:532): `Diagnóstico de Crescimento Orgânico`
- **Pill de progresso** (index.html:534, 909): `{n} de 8`
- **LGPD** (index.html:562): `Ao continuar, você concorda que seus dados sejam usados para entrarmos em contato sobre o seu diagnóstico. Seus dados estão protegidos (LGPD).`

### 3.1 Abertura + Nome (etapa 0) — index.html:1277-1288

- **Hook de abertura**: `Perfis que aplicam o conteúdo certo estão multiplicando o alcance em até <b>10x</b> e transformando seguidores em <b>vendas</b> — sem investir 1 real em anúncio. Quer descobrir o que está travando o crescimento do seu perfil?`
- **Pergunta**: `Bora começar: qual seu nome?`
- Label: `Nome completo` · Placeholder: `Digite seu nome e sobrenome...`
- Erro validação: `Digite nome e sobrenome 🙂`

### 3.2 WhatsApp (etapa 1) — index.html:1291-1310

- **Pergunta**: `Prazer, <b>{primeiro}</b>! 👊 Pra eu te enviar o resultado completo do diagnóstico, qual seu WhatsApp?`
- Label: `WhatsApp` · Placeholder: `(11) 99999-9999`
- Erros: `Esse DDD não existe no Brasil 🤔` · `Celular começa com 9 depois do DDD` · `Número parece incompleto 🤔`
- **Mensagens regionais por estado** (`MSG_UF`, index.html:645-673): 27 mensagens, uma por UF. Ex. SP: `São Paulo — o mercado mais disputado de atenção do Brasil. Quem aparece com estratégia aqui fecha cliente toda semana.`
- Fallback (index.html:674): `Show! Crescimento orgânico não tem fronteira — o método é o mesmo em qualquer canto.`
- Internacional: `Show, recebido! 🌎`

### 3.3 E-mail (etapa 2) — index.html:1312-1336

- **Pergunta**: `E qual seu melhor e-mail?`
- Correção de typo: `Hmm, esse e-mail parece ter um errinho de digitação. Você quis dizer <b>{sugestao}</b>?`
- Chips: `Sim, usar o corrigido` / `Não, manter como digitei`

### 3.4 @ do Instagram (etapa 3) — index.html:1338-1391

- **Pergunta**: `Agora a parte boa: qual o <b>@</b> do seu perfil no Instagram? Vou dar uma olhada nele em tempo real 👀`
- Label: `Seu @ do Instagram` · Erro: `Só letras, números, ponto e underline`
- **Loader ao vivo** (título): `🔎 Analisando o <b>@{handle}</b> ao vivo`
  - Passos: `Abrindo o perfil no Instagram` → `Lendo bio, seguidores e números` → `Carregando seus últimos reels` → `Organizando tudo pra você`
- **Confirmação do card**: `Achei! Esse é você?` · Chips: `Sou eu ✅` / `Não é esse perfil`
- Perfil errado: `Sem problema! Me passa o @ certinho então:`
- Não encontrado: `Não consegui abrir o <b>@{handle}</b> agora (pode ser privado ou novo) — sem problema, seguimos com o diagnóstico! 💪`

### 3.5 Escolha do reel (etapa 4, fluxo Apify) — index.html:1393-1413

- **Pergunta**: `E olha o que eu separei: seus últimos reels. <b>Escolhe UM</b> pra eu analisar a fundo no seu diagnóstico 👇`
- Chip de pular: `Prefiro pular a análise de reel`
- Sem reels: `Não achei reels públicos recentes no perfil — sem problema, seguimos!`

### 3.5b Seguidores (etapa 4, fluxo manual) — index.html:1415-1423

- **Pergunta**: `Quantos seguidores o perfil tem hoje?`
- Opções (index.html:604): `Menos de 1 mil` / `1 a 5 mil` / `5 a 20 mil` / `20 a 50 mil` / `50 a 100 mil` / `Mais de 100 mil`

### 3.6 Nicho (etapa 5) — index.html:1425-1456

- Nicho detectado: `Pela bio do <b>@{instagram}</b>, deu pra ver: seu nicho é <b>{nicho}</b>. Confere?` · Chips: `Confere ✅` / `É outro nicho`
- Correção: `Sem problema — seleciona o nicho certo aqui:`
- Sem detecção: `Antes de eu rodar a análise: em qual nicho o <b>@{instagram}</b> atua?`
- **Opções de nicho** (`NICHOS`, index.html:696): `Saúde & Bem-estar · Estética & Beleza · Fitness · Direito · Finanças & Investimentos · Educação & Concursos · Moda · Gastronomia & Food · Imobiliário · Marketing & Negócios · Serviços locais · Outro`

### 3.7 PRÉ-DIAGNÓSTICO (entre nicho e desafio) — index.html:1474-1504

- **Loader**: `🧠 Rodando o <b>Método CORE</b> no seu conteúdo`
  - Com reel: `Transcrevendo o áudio do seu reel` → `Analisando o roteiro com os 7 Gatilhos` → `Medindo o Conteúdo Notável e o CTA` → `Calculando seu Score CORE`
  - Sem reel: `Analisando os números do perfil` → (mesmos 3 finais)
- **Intro do método** (index.html:1235-1244): `Antes do resultado, deixa eu te situar: o <b>Método CORE</b> mede 3 pilares — é o que separa um reel que viraliza de um que o algoritmo ignora.`
  - 🎯 `Gatilho da Atenção` — *fazer a pessoa parar pra te assistir*
  - 🔥 `Conteúdo Notável` — *fazer ela assistir e engajar até o final*
  - 🎬 `CTA & Conversão` — *fazer ela agir e virar cliente do seu produto/serviço*
  - Rodapé: `Vou analisar o <b>Gatilho da Atenção</b> agora 👇 A análise completa dos 3 — com as correções — eu abro na sua <b>Sessão Estratégica</b>.`
- **Gate** (chip único): `Entendi, quero ver o resultado 👀`
- **Gatilho ausente** (index.html:1246-1254): `O gatilho que mais faltou no seu gancho: <b>Gatilho da {nome}</b>`
  - Gatilhos válidos (index.html:1232): `Atenção Imediata · Recompensa · Reconhecimento · Crença · Popularidade/Autoridade · Mistério · Disrupção`
- **Pilares trancados** (index.html:1256-1268): blur fake `A análise completa deste pilar fica disponível na sua sessão com o time — incluindo os ajustes recomendados pro seu perfil e os exemplos aplicados ao seu nicho.` + CTA `🔒 As análises completas desses 2 pilares — e as correções — eu abro na sua <b>Sessão Estratégica</b>`
- **Seeds do fallback local** (`SEEDS_METODO`, index.html:729-733):
  - 1: `Existem <b>7 Gatilhos da Atenção</b> que todo gancho precisa ativar — e na Sessão Estratégica eu te mostro os melhores pro seu caso.`
  - 2: `Conteúdos que viralizam seguem <b>4 princípios obrigatórios e 7 elementos estratégicos</b> — e sabemos exatamente quais estão faltando no seu.`
  - 3: `Existem <b>3 tipos de CTA estratégico</b> que transformam atenção em resultado real — e sabemos qual funciona melhor pro seu nicho.`
- **Prompt da IA**: netlify/_private.mjs (`CORE_METHOD_CONTEXT` + `buildDiagnosisPrompt`) — persona, tom e framework de análise 100% editáveis

### 3.8 Maior desafio (etapa 6) — index.html:1506-1514

- **Pergunta**: `Me confirma uma coisa: qual é o <b>maior desafio</b> do seu perfil hoje?`
- **Opções** (`DESAFIOS`, index.html:698): `Alcance baixo (views travadas) · Falta de constância · Não sei o que postar · Seguidores não engajam · Não converto em vendas · Estou começando do zero`

### 3.9 Renda (etapa 7) — index.html:1516-1527

- **Pergunta**: `Última pergunta: qual a sua <b>renda mensal</b> atualmente?`
- **Opções** (`FATURAMENTOS`, index.html:608): `Até R$5 mil/mês · R$5 a 10 mil/mês · R$10 a 20 mil/mês · R$20 a 50 mil/mês · Acima de R$50 mil/mês`

### 3.10 Fechamento + diagnósticos template (etapa 8) — index.html:1560-1594

- **Com pré-diagnóstico**: `Fechamos, <b>{primeiro}</b>. Seu maior gargalo — <b>{desafio}</b> — bate exatamente com o que vi no <b>@{instagram}</b>. E a boa notícia: é o tipo de coisa que se destrava rápido com o método certo.`
- **Sem pré-diagnóstico**: `Fechou, <b>{primeiro}</b>! Cruzando suas respostas com os padrões que a gente mapeou em centenas de perfis... 🔍` + template do desafio
- **6 templates de diagnóstico** (`DIAGNOSTICOS`, index.html:703-716) — um por desafio, todos com estrutura: problema real → reframe → caminho (sem entregar a solução). *Textos completos no index; adaptar linguagem à sua marca.*

### 3.11 Presente + convite pra agendar — index.html:1574-1594

- Transição: `E o diagnóstico desbloqueou uma coisa pra você... 👀`
- **Anúncio do presente**: `🎁 <b>PARABÉNS, {primeiro}!</b> Você acaba de ganhar o <b>TEMPLATE DOS 30 REELS VIRAIS</b> os roteiros que usamos pra estourar perfis no seu nicho.`
- **Card do produto (mockup nativo)** (index.html:1539-1555): badge `🎁 PRESENTE DESBLOQUEADO` · kicker `TEMPLATE CORE` · título `30 REELS VIRAIS` · sub `Roteiros prontos — gancho, estrutura e CTA — validados em perfis de <b>{nicho}</b>.` · itens `#01 Gancho da Crença — "Tudo que te ensinaram sobre…"` / `#02 História de Transformação em 3 atos` / `#03 Plot Twist + CTA de salvamento` (blur) · `🔒 +27 roteiros liberados na sessão` · preço `R$197 → GRÁTIS na Sessão Estratégica`
- Qualificado: `⚡ Pelo seu estágio, seu perfil entrou como <b>alto potencial</b> — aproveita a vaga.`
- **Convite de agendamento** (⚠️ PROVAS SOCIAIS DO AUTOR — trocar!): `Pra resgatar, agenda uma <b>reunião gratuita</b> pra conhecer o método de crescimento no Instagram que já gerou <b>+50 milhões de seguidores</b>, <b>3 bilhões de visualizações</b> e <b>100 mil clientes</b> — você sai com o template na mão. Toca no melhor horário 👇`

### 3.12 Agenda + confirmação — index.html:1787-1951

- Card agenda: `Agenda hoje` / `Para sua reunião gratuita` · `📍 Hoje é {dia}, {hora}` · `Horários para {data}` · `Toque em um horário para agendar`
- Card embed: `Escolhe o melhor horário` / `Sessão de diagnóstico gratuita · online`
- Slot ocupado: `Eita — esse horário acabou de ser preenchido por outra pessoa 😅 Escolhe outro aqui:`
- Falha: `Ops, não consegui confirmar esse horário agora 😅 Pode escolher de novo aqui? Aí eu já registro certinho:`
- Confirmado (card): `Sessão agendada` / `Te esperamos lá!` / `Confirmação chega no seu WhatsApp e e-mail.` / `📄 Minha página da reunião`
- Confirmado (chat): `✅ <b>Agendado, {primeiro}!</b> {dia} às <b>{hora}</b>. Salvei sua página da reunião — lá tem o contador e o botão de entrar. Seu <b>Template dos 30 Reels Virais</b> está garantido. Até lá! 🚀`
- **Mensagem do WhatsApp fallback** (`waLink`, index.html:1690-1699): `Olá! Acabei de fazer o Diagnóstico de Crescimento Orgânico. Nome... Quero agendar minha Sessão Estratégica e resgatar o TEMPLATE DOS 30 REELS VIRAIS! 🎁`
- Replay (refresh): `Continuando de onde você parou 😉`

---

## 4. call.html — página da reunião

- Título aba: `Sua Sessão Estratégica | Core Audience` (linha 7)
- Header: badge logo + `Sessão Estratégica` (linha 103)
- Card: `Sua reunião está confirmada 🎉` / `Sessão Estratégica de Crescimento Orgânico · 30 min · online` (linhas 112-113)
- Título dinâmico: `{primeiro}, te espero na sessão!` / countdown `faltam pra sua sessão começar` / `🔴 Sua sessão está acontecendo agora — entra!`
- Botões: `🎥 Entrar na reunião` (libera 15 min antes) / `📅 Adicionar ao Google Agenda`
- Lembrete do presente: `🎁 Não esquece: seu Template dos 30 Reels Virais é entregue nessa sessão — junto com o plano de crescimento do seu perfil.`
- Evento Google Agenda: `Sessão Estratégica — Core Audience` (linha 198)
- Rodapé: `Core Audience · chegue 2 minutinhos antes 😉`
- Pós-sessão: `Essa sessão já aconteceu.` / `Qualquer coisa, chama a gente no WhatsApp.`

## 5. dashboard.html e 404.html

- Dashboard: `Painel · Diagnóstico Instagram — Core Audience` (título) / `Painel do Funil` (h1)
- 404: `Página não encontrada`

---

## 6. Conceitos de marca a decidir ANTES de reescrever a copy

Estes nomes aparecem em DEZENAS de lugares — defina os seus equivalentes primeiro:

1. **"Método CORE"** — o método proprietário (3 pilares: Gatilho da Atenção, Conteúdo Notável, CTA & Conversão). Aparece no chat, loaders, prompt da IA, score
2. **"Sessão Estratégica"** — o nome da call de vendas
3. **"Template dos 30 Reels Virais"** (R$197 → grátis) — o presente/isca de resgate
4. **"7 Gatilhos da Atenção"** — os nomes dos gatilhos (Atenção Imediata, Recompensa, Reconhecimento, Crença, Popularidade/Autoridade, Mistério, Disrupção)
5. **Provas sociais**: `+50 milhões de seguidores · 3 bilhões de visualizações · 100 mil clientes` — números do autor original, PRECISAM ser os seus
6. **"Core Audience"** — nome da marca (títulos, headers, rodapés, Google Agenda)
