/**
 * CC-710: o que cada modelo faz melhor, para o "i" ao lado do seletor de modelo.
 *
 * Pedido dele em 30/09: "um \"i\" nos modelos explicando o que cada modelo de
 * cada IA é melhor, porque o opencode tem um monte e a gente só usa o
 * big-pickle padrão". Pesquisado em 30/09 (benchmarks e preço públicos, com a
 * fonte de cada um). `confianca` diz o quanto dá para confiar: "baixa" é
 * modelo sem benchmark público. Preço e benchmark envelhecem: confira a data
 * antes de decidir por um número daqui.
 *
 * Medido NESTA máquina (vale mais que a pesquisa): big-pickle não enxerga
 * imagem e o agy enxerga; o opencode não gasta a janela do Claude.
 */
export const INFO_MODELOS_DATA = '2026-09-30'
export const INFO_MODELOS = {
  "opencode/big-pickle": {
    "nome": "Big Pickle",
    "resumo": "Modelo misterioso e gratuito do opencode, o padrão do app, focado em programar.",
    "bom": [
      "Tarefas de código do dia a dia",
      "Textos e edições sem imagem",
      "Trabalho sem se preocupar com custo"
    ],
    "evitar": [
      "Qualquer tarefa com imagem ou print",
      "Dados sigilosos, pois a fase gratuita coleta feedback"
    ],
    "custo": "gratis",
    "velocidade": "medio",
    "imagem": false,
    "confianca": "baixa",
    "numeros": "sem dado confiável. A documentação do opencode diz só que é um modelo 'stealth' gratuito por tempo limitado, em que a equipe coleta feedback. Fontes de terceiros dizem que seria o GLM-4.6 da Zhipu, com 200 mil de contexto, mas o…",
    "fonte": "https://opencode.ai/docs/zen/"
  },
  "opencode/ling-3.0-flash-fin-free": {
    "nome": "Ling 3.0 Flash Fin",
    "resumo": "Modelo gratuito da Ant Group, afinado para finanças e planilhas. Fraco em tarefas de agente.",
    "bom": [
      "Análise financeira e contábil",
      "Planilhas e textos de negócio",
      "Perguntas rápidas de custo zero"
    ],
    "evitar": [
      "Programar de forma autônoma, pois foi mal em testes de terminal",
      "Dados sigilosos: na fase gratuita os dados podem treinar o modelo"
    ],
    "custo": "gratis",
    "velocidade": "rapido",
    "imagem": null,
    "confianca": "media",
    "numeros": "Índice de inteligência 23 e índice de Finanças e Contabilidade 24 no Artificial Analysis. Em tarefas de agente foi fraco: 7% no AutomationBench e 0% no Terminal-Bench v4.0. Tem 124 bilhões de parâmetros, só 5,1 bilhões ativos por…",
    "fonte": "https://opencode.ai/docs/zen/"
  },
  "opencode/longcat-2.5-preview-free": {
    "nome": "LongCat 2.5 Preview",
    "resumo": "Modelo gigante da Meituan em pré-lançamento, gratuito, com contexto de 1 milhão de tokens.",
    "bom": [
      "Ler projetos ou documentos muito longos",
      "Tarefas longas de agente",
      "Experimentar sem gastar"
    ],
    "evitar": [
      "Trabalho que exige resultado comprovado, pois não há benchmark oficial",
      "Dados sigilosos, é versão de teste"
    ],
    "custo": "gratis",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "baixa",
    "numeros": "sem dado confiável. A Meituan não publicou nenhum benchmark. Relatos de imprensa falam em 1,6 trilhão de parâmetros (cerca de 48 bilhões ativos), 1 milhão de contexto e entendimento de imagem. Um número de 88,6% no SWE-bench Lite…",
    "fonte": "https://opencode.ai/docs/zen/"
  },
  "opencode/mimo-v2.6-flash-free": {
    "nome": "MiMo V2.6 Flash",
    "resumo": "Modelo aberto da Xiaomi, rápido e forte em programação, gratuito por tempo limitado.",
    "bom": [
      "Programação do dia a dia",
      "Tarefas rápidas e baratas",
      "Contexto muito longo"
    ],
    "evitar": [
      "Dados sigilosos: na fase gratuita os dados podem treinar o modelo",
      "Problemas muito difíceis, onde modelos pagos vão melhor"
    ],
    "custo": "gratis",
    "velocidade": "rapido",
    "imagem": null,
    "confianca": "media",
    "numeros": "309 bilhões de parâmetros (15 bilhões ativos) e 1,05 milhão de contexto. Fora do opencode custa US$ 0,07 por milhão de tokens de entrada e US$ 0,28 de saída. No DeepSWE v1.1 faz 67,9, contra 74,0 do Claude Opus 5. Fontes dizem…",
    "fonte": "https://opencode.ai/docs/zen/"
  },
  "opencode/muse-spark-1.3-contributor-free": {
    "nome": "Muse Spark 1.3 (Meta)",
    "resumo": "Modelo da Meta, bom em código e imagem. Grátis em troca de seus prompts treinarem a Meta.",
    "bom": [
      "Código e tarefas de agente",
      "Ler imagens, PDFs e vídeo",
      "Contexto longo, até 1 milhão de tokens"
    ],
    "evitar": [
      "Qualquer coisa confidencial: seus prompts treinam modelos futuros da Meta",
      "Tarefas em que privacidade importa"
    ],
    "custo": "gratis",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "media",
    "numeros": "Índice de inteligência 61 e 182 tokens por segundo (versão xhigh) no Artificial Analysis. 1.048.576 de contexto. Preço público: US$ 1,25 de entrada e US$ 4,25 de saída por milhão de tokens. A versão 'contributor' do opencode é…",
    "fonte": "https://opencode.ai/docs/zen/"
  },
  "opencode/nemotron-3-ultra-free": {
    "nome": "Nemotron 3 Ultra",
    "resumo": "Modelo aberto grande da NVIDIA, bom em raciocínio e código. Gratuito, só para testes.",
    "bom": [
      "Raciocínio e código",
      "Tarefas longas com muito texto",
      "Orquestrar outros agentes"
    ],
    "evitar": [
      "Dados pessoais ou confidenciais: o opencode avisa que é uso de teste",
      "Imagens, sem dado confiável"
    ],
    "custo": "gratis",
    "velocidade": "medio",
    "imagem": null,
    "confianca": "media",
    "numeros": "550 bilhões de parâmetros (55 bilhões ativos). SWE-bench Verified 71,9%, GPQA Diamond 86,1%, índice de código 49,3 no Artificial Analysis, contexto de 262 mil tokens. Imagem: sem dado confiável.",
    "fonte": "https://opencode.ai/docs/zen/"
  },
  "opencode/nemotron-3.5-lightning-free": {
    "nome": "Nemotron 3.5 Lightning",
    "resumo": "Modelo pequeno da NVIDIA, feito para ser muito rápido. Gratuito, só para testes.",
    "bom": [
      "Tarefas simples e repetitivas",
      "Respostas rápidas",
      "Subtarefas de agentes"
    ],
    "evitar": [
      "Problemas difíceis, pois prioriza velocidade",
      "Dados pessoais ou confidenciais"
    ],
    "custo": "gratis",
    "velocidade": "rapido",
    "imagem": null,
    "confianca": "media",
    "numeros": "30 bilhões de parâmetros (3 bilhões ativos). SWE-bench Verified 51,56, GPQA Diamond 75,44. Cerca de 670 tokens por segundo em comparação do Artificial Analysis. Imagem: sem dado confiável.",
    "fonte": "https://opencode.ai/docs/zen/"
  },
  "opencode/space-bunny-free": {
    "nome": "Space Bunny",
    "resumo": "Modelo anônimo (stealth) com 1 milhão de contexto e imagem, grátis por pouco tempo.",
    "bom": [
      "Ler imagens e vídeo",
      "Contexto muito longo",
      "Provar sem gastar"
    ],
    "evitar": [
      "Contar com ele a longo prazo: a promoção gratuita pode ter acabado em 30/09/2026",
      "Qualquer tarefa que exija resultado comprovado"
    ],
    "custo": "gratis",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "baixa",
    "numeros": "sem dado confiável. O opencode diz que tem 1M de contexto, é multimodal e tem retenção zero de dados. Quem o criou não foi informado. A promoção gratuita tinha prazo até 2026-09-30, conforme fonte de terceiros: confira se ainda…",
    "fonte": "https://opencode.ai/docs/zen/"
  },
  "gemini-3.8-flash-high": {
    "nome": "Gemini 3.8 Flash (alto)",
    "resumo": "O Flash mais inteligente do Google, feito para programar e agir sozinho. Aqui com raciocínio alto.",
    "bom": [
      "Programação longa e autônoma",
      "Tarefas difíceis com raciocínio extra",
      "Ler imagens, PDF e áudio"
    ],
    "evitar": [
      "Perguntas simples, onde o nível baixo basta e gasta menos",
      "Casos em que o Pro vai melhor"
    ],
    "custo": "medio",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "media",
    "numeros": "DeepSWE v1.1 73,7%, Terminal-Bench 2.1 89,4%, HLE-Verified 54,9%. Preço US$ 0,75 por milhão de tokens de entrada e US$ 3,75 de saída, contexto de 1M, aceita texto, imagem, vídeo, áudio e PDF. Os preços sobem para US$ 1,50 e US$…",
    "fonte": "https://openrouter.ai/google/gemini-3.8-flash"
  },
  "gemini-3.8-flash-medium": {
    "nome": "Gemini 3.8 Flash (médio)",
    "resumo": "O Flash mais inteligente do Google, feito para programar e agir sozinho. Raciocínio médio, o padrão.",
    "bom": [
      "Uso geral e programação",
      "Bom equilíbrio entre rapidez e qualidade",
      "Ler imagens, PDF e áudio"
    ],
    "evitar": [
      "Problemas muito difíceis: suba para o alto",
      "Casos em que o Pro vai melhor"
    ],
    "custo": "barato",
    "velocidade": "rapido",
    "imagem": true,
    "confianca": "media",
    "numeros": "DeepSWE v1.1 73,7%, Terminal-Bench 2.1 89,4%, HLE-Verified 54,9%. Preço US$ 0,75 por milhão de tokens de entrada e US$ 3,75 de saída, contexto de 1M. Médio é o nível padrão do modelo.",
    "fonte": "https://openrouter.ai/google/gemini-3.8-flash"
  },
  "gemini-3.8-flash-low": {
    "nome": "Gemini 3.8 Flash (baixo)",
    "resumo": "O Flash mais inteligente do Google, feito para programar e agir sozinho. Raciocínio baixo, o mais econômico.",
    "bom": [
      "Tarefas simples e rápidas",
      "Muitas chamadas pequenas",
      "Economizar cota"
    ],
    "evitar": [
      "Problemas que exigem raciocínio profundo",
      "Mudanças grandes em vários arquivos"
    ],
    "custo": "barato",
    "velocidade": "rapido",
    "imagem": true,
    "confianca": "media",
    "numeros": "Os números publicados (DeepSWE v1.1 73,7%, Terminal-Bench 2.1 89,4%) não dizem em qual nível foram medidos: sem dado confiável por nível. Preço US$ 0,75 por milhão de entrada e US$ 3,75 de saída. Nível baixo pensa menos: mais…",
    "fonte": "https://openrouter.ai/google/gemini-3.8-flash"
  },
  "gemini-3.7-flash-high": {
    "nome": "Gemini 3.7 Flash (alto)",
    "resumo": "Flash da geração anterior, bom em código e agentes. Aqui com raciocínio alto.",
    "bom": [
      "Programação com várias etapas",
      "Tarefas difíceis com raciocínio extra",
      "Ler imagens"
    ],
    "evitar": [
      "Perguntas simples, onde o nível baixo basta",
      "Quando o 3.8 está disponível, que é mais novo"
    ],
    "custo": "medio",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "media",
    "numeros": "SWE-bench (Vals) 80,8%, Terminal-Bench 2.1 85,8%, LiveCodeBench (Vals) 88,7%, HLE-Verified 53,6%. Preço US$ 0,75 por milhão de entrada e US$ 3,75 de saída, contexto de 1M. Nível alto pensa mais: demora mais e custa mais.",
    "fonte": "https://benchlm.ai/models/gemini-3-7-flash"
  },
  "gemini-3.7-flash-medium": {
    "nome": "Gemini 3.7 Flash (médio)",
    "resumo": "Flash da geração anterior, bom em código e agentes. Raciocínio médio, o padrão.",
    "bom": [
      "Uso geral e programação",
      "Equilíbrio entre rapidez e qualidade",
      "Ler imagens"
    ],
    "evitar": [
      "Problemas muito difíceis: suba para o alto",
      "Quando o 3.8 está disponível, que é mais novo"
    ],
    "custo": "barato",
    "velocidade": "rapido",
    "imagem": true,
    "confianca": "media",
    "numeros": "SWE-bench (Vals) 80,8%, Terminal-Bench 2.1 85,8%, LiveCodeBench (Vals) 88,7%, HLE-Verified 53,6%. Preço US$ 0,75 por milhão de entrada e US$ 3,75 de saída.",
    "fonte": "https://benchlm.ai/models/gemini-3-7-flash"
  },
  "gemini-3.7-flash-low": {
    "nome": "Gemini 3.7 Flash (baixo)",
    "resumo": "Flash da geração anterior, bom em código e agentes. Raciocínio baixo, o mais econômico.",
    "bom": [
      "Tarefas simples e rápidas",
      "Muitas chamadas pequenas",
      "Economizar cota"
    ],
    "evitar": [
      "Problemas que exigem raciocínio profundo",
      "Mudanças grandes em vários arquivos"
    ],
    "custo": "barato",
    "velocidade": "rapido",
    "imagem": true,
    "confianca": "media",
    "numeros": "Os números publicados não dizem em qual nível foram medidos: sem dado confiável por nível. Para o modelo em geral: SWE-bench (Vals) 80,8%, Terminal-Bench 2.1 85,8%. Preço US$ 0,75 por milhão de entrada e US$ 3,75 de saída.",
    "fonte": "https://benchlm.ai/models/gemini-3-7-flash"
  },
  "gemini-3.6-flash-high": {
    "nome": "Gemini 3.6 Flash (alto)",
    "resumo": "Flash de duas gerações atrás, bom para tarefas gerais e multimodais. Raciocínio alto.",
    "bom": [
      "Tarefas gerais do dia a dia",
      "Imagens e conteúdo misto",
      "Quando o 3.8 não estiver disponível"
    ],
    "evitar": [
      "Programação difícil, onde o 3.8 e o 3.7 vão melhor",
      "Perguntas simples, onde o nível baixo basta"
    ],
    "custo": "medio",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "media",
    "numeros": "SWE-Bench Pro 58,7%, DeepSWE v1.1 49%, OSWorld-Verified 83,0%. Preço US$ 0,75 por milhão de entrada e US$ 3,75 de saída; fontes antigas citam US$ 1,50 e US$ 7,50, então confira. O Google o descreve como equilibrando velocidade e…",
    "fonte": "https://venturebeat.com/technology/googles-gemini-3-6-flash-model-cuts-ai-agent-token-costs-by-up-to-65-on-long-horizon-engineering-tasks-and-3-5-pro-is-on-the-way"
  },
  "gemini-3.6-flash-medium": {
    "nome": "Gemini 3.6 Flash (médio)",
    "resumo": "Flash de duas gerações atrás, bom para tarefas gerais e multimodais. Raciocínio médio.",
    "bom": [
      "Tarefas gerais do dia a dia",
      "Imagens e conteúdo misto",
      "Equilíbrio entre rapidez e custo"
    ],
    "evitar": [
      "Programação difícil, onde o 3.8 e o 3.7 vão melhor",
      "Problemas muito difíceis: suba para o alto"
    ],
    "custo": "barato",
    "velocidade": "rapido",
    "imagem": true,
    "confianca": "media",
    "numeros": "SWE-Bench Pro 58,7%, DeepSWE v1.1 49%, OSWorld-Verified 83,0%. Preço US$ 0,75 por milhão de entrada e US$ 3,75 de saída.",
    "fonte": "https://venturebeat.com/technology/googles-gemini-3-6-flash-model-cuts-ai-agent-token-costs-by-up-to-65-on-long-horizon-engineering-tasks-and-3-5-pro-is-on-the-way"
  },
  "gemini-3.6-flash-low": {
    "nome": "Gemini 3.6 Flash (baixo)",
    "resumo": "Flash de duas gerações atrás, bom para tarefas gerais e multimodais. Raciocínio baixo, o mais econômico.",
    "bom": [
      "Tarefas simples e rápidas",
      "Muitas chamadas pequenas",
      "Economizar cota"
    ],
    "evitar": [
      "Programação difícil",
      "Problemas que exigem raciocínio profundo"
    ],
    "custo": "barato",
    "velocidade": "rapido",
    "imagem": true,
    "confianca": "media",
    "numeros": "Os números publicados não dizem em qual nível foram medidos: sem dado confiável por nível. Para o modelo em geral: SWE-Bench Pro 58,7%. Preço US$ 0,75 por milhão de entrada e US$ 3,75 de saída.",
    "fonte": "https://venturebeat.com/technology/googles-gemini-3-6-flash-model-cuts-ai-agent-token-costs-by-up-to-65-on-long-horizon-engineering-tasks-and-3-5-pro-is-on-the-way"
  },
  "gemini-3.1-pro-high": {
    "nome": "Gemini 3.1 Pro (alto)",
    "resumo": "O Gemini mais forte para problemas complexos e bases de código grandes. Raciocínio alto.",
    "bom": [
      "Problemas complexos e bases de código grandes",
      "Raciocínio difícil",
      "Contexto de 1 milhão de tokens"
    ],
    "evitar": [
      "Tarefas simples: um Flash faz mais barato",
      "Quando velocidade importa mais que profundidade"
    ],
    "custo": "medio",
    "velocidade": "lento",
    "imagem": true,
    "confianca": "media",
    "numeros": "SWE-bench Verified 80,6%, Terminal-Bench 2.0 68,5%, GPQA Diamond 94,3%. Preço US$ 2 por milhão de entrada e US$ 12 de saída, cerca de 3 vezes o de um Flash. Contexto de 1.048.576 tokens. Está em fase de prévia (preview) no Google.",
    "fonte": "https://www.nxcode.io/resources/news/gemini-3-1-pro-complete-guide-benchmarks-pricing-api-2026"
  },
  "gemini-3.1-pro-low": {
    "nome": "Gemini 3.1 Pro (baixo)",
    "resumo": "O Gemini mais forte para problemas complexos, com raciocínio baixo: mais leve e rápido que o alto.",
    "bom": [
      "Tarefas médias que pedem o Pro",
      "Bases de código grandes sem raciocínio extra",
      "Mais rapidez que o alto"
    ],
    "evitar": [
      "Tarefas simples: um Flash faz mais barato",
      "Problemas muito difíceis: suba para o alto"
    ],
    "custo": "medio",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "media",
    "numeros": "Os números publicados (SWE-bench Verified 80,6%, Terminal-Bench 2.0 68,5%) não dizem em qual nível foram medidos: sem dado confiável por nível. Preço US$ 2 por milhão de entrada e US$ 12 de saída.",
    "fonte": "https://www.nxcode.io/resources/news/gemini-3-1-pro-complete-guide-benchmarks-pricing-api-2026"
  },
  "claude-sonnet-4-6": {
    "nome": "Claude Sonnet 4.6 (raciocínio)",
    "resumo": "Claude equilibrado da Anthropic, versão anterior, com raciocínio ligado, dentro do Antigravity.",
    "bom": [
      "Código e raciocínio equilibrados",
      "Tarefas com várias etapas",
      "Ler imagens"
    ],
    "evitar": [
      "Tarefas simples, onde um Flash é mais barato",
      "Quando o Sonnet 5.5 estiver disponível, que é mais novo"
    ],
    "custo": "medio",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "alta",
    "numeros": "Sem número de benchmark oficial nesta pesquisa: sem dado confiável. Dados oficiais: US$ 3 por milhão de entrada e US$ 15 de saída, contexto de 1M, aceita texto e imagem, lançado em 17/02/2026 e hoje classificado como legado. O…",
    "fonte": "https://platform.claude.com/docs/en/models/sonnet-4-6/overview"
  },
  "claude-opus-4-6-thinking": {
    "nome": "Claude Opus 4.6 (raciocínio)",
    "resumo": "Claude mais forte da geração 4.6, para problemas difíceis, com raciocínio ligado, no Antigravity.",
    "bom": [
      "Os problemas mais difíceis",
      "Código complexo e arquitetura",
      "Ler imagens"
    ],
    "evitar": [
      "Tarefas simples: gasta muito à toa",
      "Quando o Opus 5.5 estiver disponível, que é mais novo e mais barato"
    ],
    "custo": "caro",
    "velocidade": "lento",
    "imagem": true,
    "confianca": "alta",
    "numeros": "Sem número de benchmark oficial nesta pesquisa: sem dado confiável. Dados oficiais: US$ 5 por milhão de entrada e US$ 25 de saída, contexto de 1M, texto e imagem, lançado em 05/02/2026, hoje legado. O Opus 5.5 atual custa menos,…",
    "fonte": "https://platform.claude.com/docs/en/models/opus-4-6/overview"
  },
  "gpt-oss-120b-medium": {
    "nome": "GPT-OSS 120B (médio)",
    "resumo": "Modelo aberto da OpenAI, barato, só texto. Bom como segunda opinião. Raciocínio médio.",
    "bom": [
      "Segunda opinião em código",
      "Tarefas de texto baratas",
      "Quando outros modelos errarem"
    ],
    "evitar": [
      "Qualquer tarefa com imagem, pois é só texto",
      "Problemas muito difíceis, onde modelos de ponta vão melhor"
    ],
    "custo": "barato",
    "velocidade": "rapido",
    "imagem": false,
    "confianca": "media",
    "numeros": "SWE-bench Verified 62,4% e contexto de 131 mil tokens. Preço varia por provedor, de cerca de US$ 0,03 a US$ 0,15 por milhão de entrada e de US$ 0,14 a US$ 0,75 de saída. O modelo é de texto: confirmado em fontes de terceiros, não…",
    "fonte": "https://llm-stats.com/models/gpt-oss-120b"
  },
  "opus": {
    "nome": "Claude Opus 5.5",
    "resumo": "O Claude recomendado pela Anthropic para a maioria das tarefas longas de código e conhecimento.",
    "bom": [
      "Programação longa e autônoma",
      "Trabalho de conhecimento complexo",
      "Uso geral recomendado"
    ],
    "evitar": [
      "Perguntas simples, onde Sonnet ou Haiku bastam",
      "Gastar a janela semanal à toa"
    ],
    "custo": "caro",
    "velocidade": "medio",
    "imagem": true,
    "confianca": "alta",
    "numeros": "Sem número de benchmark oficial nesta pesquisa: sem dado confiável. Dados oficiais: US$ 4 por milhão de entrada e US$ 20 de saída, contexto de 1M, latência 'moderada', esforço padrão medium, aceita texto e imagem. A Anthropic…",
    "fonte": "https://platform.claude.com/docs/en/models/overview"
  },
  "sonnet": {
    "nome": "Claude Sonnet 5.5",
    "resumo": "O melhor equilíbrio entre rapidez e inteligência da Anthropic. Metade do preço do Opus.",
    "bom": [
      "Código do dia a dia",
      "Tarefas rápidas com boa qualidade",
      "Economizar a janela de uso"
    ],
    "evitar": [
      "Problemas muito difíceis e longos, onde o Opus ou o Fable vão melhor",
      "Nada em especial para uso geral"
    ],
    "custo": "medio",
    "velocidade": "rapido",
    "imagem": true,
    "confianca": "alta",
    "numeros": "Sem número de benchmark oficial nesta pesquisa: sem dado confiável. Dados oficiais: US$ 2 por milhão de entrada e US$ 10 de saída, contexto de 1M, latência 'rápida', esforço padrão high, aceita texto e imagem. A Anthropic o…",
    "fonte": "https://platform.claude.com/docs/en/models/overview"
  },
  "haiku": {
    "nome": "Claude Haiku 4.5",
    "resumo": "O Claude mais rápido e barato, com inteligência quase de ponta. Contexto menor, de 200 mil.",
    "bom": [
      "Tarefas simples e rápidas",
      "Muitas chamadas pequenas",
      "Economizar a janela de uso"
    ],
    "evitar": [
      "Projetos grandes: contexto de só 200 mil tokens",
      "Problemas difíceis de raciocínio"
    ],
    "custo": "barato",
    "velocidade": "rapido",
    "imagem": true,
    "confianca": "alta",
    "numeros": "Sem número de benchmark oficial nesta pesquisa: sem dado confiável. Dados oficiais: US$ 1 por milhão de entrada e US$ 5 de saída, contexto de 200 mil tokens, latência 'a mais rápida', aceita texto e imagem. Não aceita o ajuste de…",
    "fonte": "https://platform.claude.com/docs/en/models/overview"
  },
  "fable": {
    "nome": "Claude Fable 5.1",
    "resumo": "O Claude mais forte, para raciocínio difícil e trabalho longo de agente. Mais lento e caro.",
    "bom": [
      "Raciocínio muito exigente",
      "Trabalho longo de agente",
      "Quando o Opus em esforço alto não resolveu"
    ],
    "evitar": [
      "Tarefas simples: gasta a janela semanal rápido",
      "Uso geral do dia a dia"
    ],
    "custo": "caro",
    "velocidade": "lento",
    "imagem": true,
    "confianca": "alta",
    "numeros": "Sem número de benchmark oficial nesta pesquisa: sem dado confiável. Dados oficiais: US$ 10 por milhão de entrada e US$ 50 de saída, contexto de 1M, latência 'mais lenta', esforço padrão high, aceita texto e imagem. A Anthropic…",
    "fonte": "https://platform.claude.com/docs/en/models/overview"
  }
}
export const INFO_ESFORCO = {
  "claude": "O esforço (low, medium, high, xhigh, max) controla quanto o Claude pensa e escreve antes de responder: níveis baixos são mais rápidos e gastam menos da sua janela de uso, níveis altos raciocinam mais, demoram mais e custam mais.",
  "agy": "O nível (low, medium, high) é o quanto o Gemini raciocina antes de responder: low é mais rápido e barato, high pensa mais, demora mais e gasta mais, e medium é o padrão.",
  "opencode": "Os modelos do opencode não têm botão de esforço: cada um já vem com o raciocínio dele."
}
