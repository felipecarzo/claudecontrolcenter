/**
 * O framework de engenharia de software: o motor.
 *
 * Visão em `docs/produto/FRAMEWORK.md`. Primeira fatia: o gate de MVP.
 *
 * A ideia central, e o motivo deste arquivo existir separado do hook: o método
 * é DADO, não código. Este módulo é o motor que lê método mais estado e diz o
 * que pode. Quem aplica é outra camada (o hook), quem mostra é outra (o painel).
 * É a forma do ESLint: um motor, regras como dado, vários pontos de aplicação.
 *
 * Duas consequências que não podem ser perdidas numa refatoração:
 *
 *   - Nada aqui toca disco, rede ou IA. Recebe objeto, devolve objeto. É o que
 *     permite testar de verdade e é o que cumpre o "sem IA futuramente" da
 *     visão: quem lê o método é código comum.
 *   - Portão é MECÂNICO, nunca julgamento. Pergunta "existe critério de MVP
 *     registrado?", que é verificável, e nunca "o MVP está bom?". Julgamento de
 *     IA pode virar conselho na tela, jamais trava. O projeto já tem a evidência
 *     de por quê: 545 testes verdes com a tela quebrada no navegador.
 */

/** Nunca travadas, em método nenhum. Trava em doc quebra o `/end-session`,
 *  lição que o `rota-guard` já aprendeu, e travar o próprio estado tornaria
 *  impossível sair da fase. */
export const SEMPRE_LIVRE = ['docs/**', 'assets/**', '.framework/**', '*']

/**
 * O que conta como código para os MODOS.
 *
 * Separado do `trava` da fase de propósito, e o teste pegou o motivo: na fase
 * de Execução o `trava` é vazio (a fase não bloqueia nada), então o modo nunca
 * enxergaria arquivo nenhum como código e o sugestivo não travaria. São duas
 * perguntas diferentes: a FASE pergunta "esta etapa bloqueia este caminho?", o
 * MODO pergunta "isto é código?".
 */
export const CODIGO = ['src/**', 'apps/**', 'tools/**', 'lib/**', 'app/**', 'hooks/**']

/**
 * Predicados: o vocabulário que uma fase usa em `exige`. Cada um devolve `null`
 * quando está satisfeito, ou a frase do que falta.
 *
 * A frase importa tanto quanto a regra: gate que trava sem dizer por que é a
 * burocracia que se desliga na terceira semana (achado do CC-32). Por isso
 * nenhum predicado devolve booleano nu.
 */
export const PREDICADOS = {
  'mvp-definido': (e) => {
    const n = e?.mvp?.criterios?.length || 0
    return n > 0 ? null : 'o MVP não tem nenhum critério de pronto registrado'
  },
  'mvp-tem-nome': (e) => (e?.mvp?.nome || '').trim()
    ? null
    : 'o MVP não tem nome: em uma frase, o que este projeto entrega',
  'criterios-todos-marcados': (e) => {
    const cs = e?.mvp?.criterios || []
    if (!cs.length) return 'não há critério de pronto para conferir'
    const abertos = cs.filter((c) => !c.feito)
    return abertos.length
      ? `faltam ${abertos.length} de ${cs.length} critérios do MVP: ${abertos.map((c) => c.texto).join('; ')}`
      : null
  },
  /* CC-68, método `conserto`. Os dois campos abaixo são o que separa conserto
     de "mexi até parar de dar erro":

     `reproducao` é escrita ANTES, e trava o código de propósito. Foi o vício
     mais caro de hoje: escrevi que o extrator de PDF seria ruim sem tentar, e
     exagerei a gravidade do defeito do endereço sem medir. Nos dois casos eu
     tinha pulado a reprodução.

     `prova` é escrita DEPOIS, e é a regra 1 do ciclo dele virando trava: teste
     verde não é prova — já houve 545 testes passando com a tela quebrada. */
  'defeito-reproduzido': (e) => {
    const r = e?.reproducao || {}
    if (!(r.como || '').trim()) return 'falta dizer COMO o defeito aparece: o passo que o faz acontecer'
    if (!(r.esperado || '').trim()) return 'falta dizer o que você esperava ver no lugar'
    return null
  },
  'conserto-provado': (e) => {
    const p = e?.prova || {}
    if (!(p.como || '').trim()) return 'falta a prova de que o defeito sumiu: o que foi rodado, e o que apareceu'
    if (!p.guardado) return 'falta o teste que guarda o conserto — sem ele o defeito volta e ninguém vê'
    return null
  },

  /* CC-68, método `estudo`. A entrega é a DECISÃO, e por isso as duas fases
     travam código do começo ao fim. É o F1 no nível do projeto inteiro: ele
     pediu três itens "para estudar" e o risco é sempre o mesmo — eu começo a
     construir enquanto ele ainda está pensando. */
  'pergunta-declarada': (e) => ((e?.estudo?.pergunta || '').trim()
    ? null
    : 'falta a pergunta que este estudo responde, em uma frase'),
  'opcoes-medidas': (e) => {
    const o = e?.estudo?.opcoes || []
    if (o.length < 2) return 'um estudo com menos de duas opções não é estudo: é uma escolha já feita'
    const semMedida = o.filter((x) => !(x.medida || '').trim())
    return semMedida.length
      ? `${semMedida.length} opção(ões) sem medida: ${semMedida.map((x) => x.nome).join(', ')}`
      : null
  },
  'decisao-registrada': (e) => ((e?.estudo?.decisao || '').trim()
    ? null
    : 'falta a decisão e o porquê dela — sem isso o estudo não vira nada'),

  // F4: quais ferramentas de verificação este projeto usa. Decisão do Felipe em
  // 14/08: isso se escolhe na DEFINIÇÃO, junto do MVP, não solta no meio da
  // execução. "o framework JÁ teria isso definido desde o início do projeto na
  // definição de pronto."
  'ferramentas-escolhidas': (e) => ((e?.ferramentas || []).length
    ? null
    : 'nenhuma ferramenta de verificação escolhida: decida na Definição o que este projeto usa'),
  'verificacao-rodada': (e) => {
    const esperadas = e?.ferramentas || []
    if (!esperadas.length) return 'nenhuma ferramenta escolhida para rodar'
    const rodadas = Object.keys(e?.verificacao || {})
    const faltam = esperadas.filter((f) => !rodadas.includes(f))
    return faltam.length ? `falta rodar: ${faltam.join(', ')}` : null
  },
  'verificacao-limpa': (e) => {
    const sujas = Object.entries(e?.verificacao || {})
      .filter(([, r]) => r && r.ok === false)
      .map(([f]) => f)
    return sujas.length ? `verificação acusou problema em: ${sujas.join(', ')}` : null
  },
}

/** Métodos prontos. Trocar de método é trocar de dado, nunca de código. */
export const METODOS = {
  'mvp-basico': {
    id: 'mvp-basico',
    titulo: 'MVP básico: definir antes de construir',
    fases: [
      {
        id: 'definicao',
        titulo: 'Definição',
        explica: 'Antes de escrever código, o projeto precisa dizer o que entrega e como se sabe que ficou pronto.',
        exige: ['mvp-tem-nome', 'mvp-definido'],
        trava: ['src/**', 'apps/**', 'tools/**', 'lib/**', 'app/**'],
      },
      {
        id: 'execucao',
        titulo: 'Execução',
        explica: 'Código liberado. O projeto só é dado como pronto quando todos os critérios do MVP estiverem marcados.',
        exige: ['criterios-todos-marcados'],
        trava: [],
      },
    ],
  },

  /**
   * CC-68, e ele nasceu de uma observação sobre o dia 15/08 inteiro: os dois
   * métodos acima supõem que existe algo NOVO para entregar, e o trabalho de
   * verdade daquele dia foi outro — regex quebrado, hash velho, layout
   * vazando, gate morto. Nenhum tinha MVP a definir.
   *
   * A ordem das fases é o remédio: **reproduzir antes de consertar** é o que
   * impede o conserto de virar tentativa, e **provar depois** é a regra 1 do
   * ciclo dele ("prova visual antes de dizer feito").
   */
  conserto: {
    id: 'conserto',
    titulo: 'Conserto: reproduzir antes, provar depois',
    fases: [
      {
        id: 'reproducao',
        titulo: 'Reprodução',
        explica: 'Antes de mexer no código: como o defeito aparece, e o que deveria aparecer no lugar. Sem isso, consertar vira tentativa.',
        exige: ['defeito-reproduzido'],
        trava: ['src/**', 'apps/**', 'tools/**', 'lib/**', 'app/**'],
      },
      {
        id: 'execucao',
        titulo: 'Conserto',
        explica: 'Código liberado. Vale mexer só no que a reprodução apontou — escopo maior que isso é outro trabalho.',
        exige: [],
        trava: [],
      },
      {
        id: 'prova',
        titulo: 'Prova',
        explica: 'O que foi rodado, o que apareceu, e o teste que guarda. Teste verde não é prova: já houve 545 passando com a tela quebrada.',
        exige: ['conserto-provado'],
        trava: [],
      },
    ],
  },

  /**
   * CC-68. A entrega é a DECISÃO, não o programa — por isso as duas fases
   * travam código do começo ao fim.
   *
   * Nasceu de um padrão dele: em 15/08 pediu três itens "para estudar", e o
   * risco é sempre o mesmo — eu começo a construir enquanto ele ainda está
   * pensando. Foi exatamente o erro do glossário, que originou o F1. Aqui isso
   * vira fase, não instrução.
   *
   * Se o estudo virar código, o projeto **troca de método**. Isso é sinal de
   * que a decisão foi tomada, e é o momento certo de registrar qual foi.
   */
  estudo: {
    id: 'estudo',
    titulo: 'Estudo: a entrega é a decisão',
    fases: [
      {
        id: 'pergunta',
        titulo: 'Pergunta',
        explica: 'Que pergunta este estudo responde? Sem ela, estudo vira leitura sem fim.',
        exige: ['pergunta-declarada'],
        trava: ['src/**', 'apps/**', 'tools/**', 'lib/**', 'app/**'],
      },
      {
        id: 'decisao',
        titulo: 'Decisão',
        explica: 'Duas opções ou mais, cada uma com o que foi medido, e a escolha com o porquê. Código continua travado: se virou código, virou outro método.',
        exige: ['opcoes-medidas', 'decisao-registrada'],
        trava: ['src/**', 'apps/**', 'tools/**', 'lib/**', 'app/**'],
      },
    ],
  },

  /**
   * F6: o segundo método, e ele existe para provar uma afirmação que até agora
   * era só promessa — **método é dado, não código**. Se acrescentar um método
   * exigisse mexer no motor, o framework seria agnóstico só no papel.
   *
   * É também o mais próximo do trabalho real do Felipe: site de cliente que
   * sobe para a VPS. Por isso tem uma fase que o `mvp-basico` não tem, a de
   * Verificação, onde a [[BANCADA]] entra como gate (F5).
   */
  'entrega-cliente': {
    id: 'entrega-cliente',
    titulo: 'Entrega para cliente: nada sobe sem verificação',
    fases: [
      {
        id: 'definicao',
        titulo: 'Definição',
        explica: 'O que o cliente recebe, como se sabe que está pronto, e quais verificações este projeto usa.',
        exige: ['mvp-tem-nome', 'mvp-definido', 'ferramentas-escolhidas'],
        trava: ['src/**', 'apps/**', 'tools/**', 'lib/**', 'app/**'],
      },
      {
        id: 'execucao',
        titulo: 'Execução',
        explica: 'Código liberado. Sai desta fase quando todos os critérios combinados estiverem marcados.',
        exige: ['criterios-todos-marcados'],
        trava: [],
      },
      {
        id: 'verificacao',
        titulo: 'Verificação',
        explica: 'As ferramentas escolhidas na Definição precisam ter rodado, e sem acusar problema.',
        exige: ['verificacao-rodada', 'verificacao-limpa'],
        trava: [],
      },
      {
        id: 'entregue',
        titulo: 'Entregue',
        explica: 'Verificado e no ar. Mudança daqui em diante é escopo novo, e escopo novo se declara.',
        exige: [],
        trava: [],
      },
    ],
  },
}

/**
 * F8: as perguntas da entrevista, e elas são DADO.
 *
 * A inversão da visão: ligado, o framework demanda ao Felipe em vez de esperar.
 * Hoje o gate só recusa ("falta o MVP"); a entrevista é o que faz ele conduzir.
 *
 * **Por que catálogo e não a IA inventando a pergunta na hora:** decisão dele em
 * 14/08, e o motivo é o risco que ele mesmo apontou como "segredo master" —
 * quem escreve as opções molda a decisão. Se eu formulo a pergunta E as
 * alternativas, eu filtrei o mundo antes de ele escolher. Catálogo tira essa
 * alavanca da minha mão. A resposta livre (o "Other" do `AskUserQuestion`, que
 * é automático) é a válvula contra a moldura que sobrar.
 *
 * Cada pergunta é amarrada ao PREDICADO que ela resolve: se o predicado está
 * satisfeito, a pergunta não aparece. Assim a entrevista termina sozinha, em
 * vez de virar questionário fixo.
 */
export const PERGUNTAS = {
  'mvp-tem-nome': {
    pergunta: 'O que este projeto entrega, numa frase?',
    header: 'O projeto',
    ajuda: 'Sem isso o framework não sabe quando dizer que acabou.',
    opcoes: [
      { label: 'Descrever agora', descricao: 'Escrevo a frase e ela vira o nome do MVP.' },
      { label: 'É continuação de algo', descricao: 'O projeto já existe e estou retomando: uso o que já está escrito no ROADMAP ou no README como ponto de partida.' },
    ],
  },
  'mvp-definido': {
    pergunta: 'Como a gente sabe que está pronto?',
    header: 'Pronto é',
    ajuda: 'Um a três critérios verificáveis. É o que o framework confere depois.',
    opcoes: [
      { label: 'Listar os critérios agora', descricao: 'Digo em voz alta o que precisa funcionar, e viram a lista.' },
      { label: 'Derivar do que já existe', descricao: 'Puxar do ROADMAP ou dos testes que já estão no projeto, e eu confirmo.' },
      { label: 'Só um critério, o essencial', descricao: 'Definir o mínimo agora e acrescentar depois. Escopo cresce declarando.' },
    ],
  },
  'ferramentas-escolhidas': {
    pergunta: 'Que verificações este projeto precisa antes de entregar?',
    header: 'Verificação',
    ajuda: 'Decidido aqui, na Definição, para não virar escolha solta no meio da execução.',
    opcoes: [
      { label: 'Segredo e dependência', descricao: 'O básico: nada de chave vazada no histórico, nenhuma dependência com falha conhecida. Serve para qualquer projeto.' },
      { label: 'Tudo que se aplica a site de cliente', descricao: 'Segredo, dependência, e as sondas de dado (RLS aberto, chave de admin no bundle, rota restrita sem login).' },
      { label: 'Nenhuma por enquanto', descricao: 'Projeto interno ou experimento. Pode acrescentar depois, mas o framework vai parar de cobrar.' },
    ],
  },
  'criterios-todos-marcados': {
    pergunta: 'Os critérios que faltam ainda valem?',
    header: 'Critérios',
    ajuda: 'Aparece quando o trabalho parece pronto mas a lista discorda.',
    opcoes: [
      { label: 'Sim, ainda falta fazer', descricao: 'O trabalho continua. Nada muda.' },
      { label: 'Cortar do escopo', descricao: 'Não vale mais a pena. Fica registrado com motivo, e o projeto pode fechar sem eles.' },
    ],
  },
}

/** A próxima coisa a perguntar, ou `null` quando não há pendência. Uma por vez:
 *  entrevista que dispara quatro perguntas juntas vira formulário, e formulário
 *  é o que ele não lê. */
export function proximaPergunta(metodo, estado) {
  const M = metodoDe(metodo)
  if (!M || estado?.ligado === false) return null
  const idx = Math.max(0, M.fases.findIndex((f) => f.id === estado?.fase))
  const fase = M.fases[idx]
  for (const p of fase?.exige || []) {
    const falta = PREDICADOS[p] ? PREDICADOS[p](estado) : null
    if (falta && PERGUNTAS[p]) return { predicado: p, falta, fase: fase.id, ...PERGUNTAS[p] }
  }
  return null
}

/**
 * F13: o tom recomendado de cada modo.
 *
 * Tom e modo são eixos SEPARADOS, correção dele ao meu desenho: "eles podem
 * ficar separados [...] eu posso mudar o tom de qualquer um também". O modo diz
 * o que trava; o tom diz como eu falo. O recomendado existe só para a escolha
 * rápida ser um clique.
 */
export const TONS = {
  direto: 'Frases curtas, sem explicação. Executa e reporta o resultado.',
  explicativo: 'Diz o porquê de cada escolha e o que foi descartado no caminho.',
}
export const TOM_RECOMENDADO = {
  desligado: 'explicativo',
  dialogo: 'explicativo',
  sugestivo: 'direto',
  restritivo: 'direto',
  // contínuo herda o tom do restritivo: é o mesmo fluxo, executando mais longe
  continuo: 'direto',
  /* Os seis de 17/08. O tom sai do que o modo PRODUZ: estudo e revisão entregam
     texto para ele ler, então explicam; os de execução reportam e calam. */
  estudo: 'explicativo',
  revisao: 'explicativo',
  depuracao: 'explicativo', // a causa medida é o produto, e ela precisa do porquê
  desenho: 'direto',
  pareado: 'direto',
  entrega: 'direto',
}
export const tomDe = (estado) => (TONS[estado?.tom] ? estado.tom : TOM_RECOMENDADO[modoDe(estado).id] || 'explicativo')

/** Casamento de caminho simples: `src/**` pega tudo sob `src/`, `*` pega o que
 *  está na raiz, nome exato pega ele mesmo. Sem dependência, de propósito. */
export function casa(padrao, rel) {
  const alvo = String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '')
  if (!alvo) return false
  if (padrao === '**') return true
  if (padrao === '*') return !alvo.includes('/')
  if (padrao.endsWith('/**')) {
    const base = padrao.slice(0, -3)
    return alvo === base || alvo.startsWith(base + '/')
  }
  return alvo === padrao
}

/**
 * Os modos de ativação, desenhados pelo Felipe em 14/08.
 *
 * Escala de rigor crescente, e o nome diz COMO a decisão é tomada: conversando,
 * pelo backlog, pelo escopo travado. Ver `docs/planos/FRAMEWORK-V1.md`.
 *
 * `diálogo` nasceu de um erro real e barato: no meio de uma conversa que ele
 * abriu com "vamos discutir isso ainda antes de implementar", eu implementei
 * duas abas inteiras. Tratei resposta de design como ordem de execução. A
 * instrução existia, era recente, era explícita, e não segurou nada — que é a
 * tese inteira deste framework, provada contra mim.
 *
 * Por isso `pergunta`: no diálogo, sem gatilho claro para construir, a IA
 * PERGUNTA em vez de decidir. Decisão dele: "o gatilho explícito meu resolve,
 * mas se eu não deixar explícito você manda um gate de pergunta que nem esse".
 */
export const MODOS = {
  desligado: {
    id: 'desligado',
    titulo: 'Desligado',
    explica: 'A IA é a de sempre. Nada é travado.',
    trava: false,
    pergunta: false,
  },
  dialogo: {
    id: 'dialogo',
    titulo: 'Diálogo',
    explica: 'Decidimos em prosa. Sem um gatilho claro seu, eu pergunto antes de escrever código.',
    trava: false,
    pergunta: true,
  },
  /* Chamava-se `imperativo` até 15/08. O Felipe trocou, e a razão é de ponto de
     vista: do lado do agente o modo é imperativo mesmo (recusa a ferramenta),
     mas do lado DELE ele sugere — recebe propostas e clica. Palavras dele:
     *"ele não é tão imperativo assim, ele sugere só"*.

     O nome descreve o que ele vive, porque é ele quem escolhe o modo.

     CC-135, 16/08: **ele corrigiu o mecanismo, não só o nome.** *"o modo
     sugestivo é exatamente o oposto do que eu falei. Porque ao invés de você
     fazer uma abstração pra dentro, o modo sugestivo faz uma abstração pra
     fora, ele busca características acima. Ele vai sugerir coisas que possam
     ser feitas no projeto, e sempre manter a opção de eu poder escrever,
     porque dessas coisas que eu leio surgem novas ideias."*

     "Abstração pra dentro" era o que existia até aqui: uma proposta pequena,
     de clicar sim ou não. "Pra fora" é subir um nível e olhar as FRENTES do
     projeto inteiro, não a próxima tarefa. Ele mesmo diz o motivo: *"é meio
     que um mecanismo de automatização do meu pensamento humano"* — ler as
     opções é o que lembra ele do que queria, e por isso a escrita livre nunca
     pode ficar trancada atrás de uma proposta.

     `trava`/`exigeAutorizacao` continuam: nenhuma das duas frases dele fala em
     parar de proteger o código, só em como as sugestões chegam até ele. Quem
     monta as sugestões é `framework-inicio.mjs`, lendo o roadmap do projeto —
     não este arquivo, que não sabe nada sobre o dia a dia de um projeto
     específico. */
  sugestivo: {
    id: 'sugestivo',
    titulo: 'Sugestivo',
    explica: 'Ele te mostra frentes do projeto pra escolher, e cada passo precisa da sua autorização.',
    trava: true,
    pergunta: true,
    exigeAutorizacao: true,
    sugereFrentes: true,
  },
  /* `trava: false` desde 15/08, e a correção é conceitual.
   *
   * O desenho original dele nunca falou em travar: "para agente com rota
   * limitada no Routia — sem prosa: pergunta o objetivo, define backlog,
   * executa até o fim, só revisões". **O escopo do restritivo é a ROTA**, e
   * quem trava rota é o `rota-guard`, que já existe e é externo ao framework.
   *
   * Eu tinha copiado o `trava: true` do sugestivo, e o resultado foi um modo
   * que travava igual e ainda pedia autorização, sem dar nada em troca — ele
   * teve que desligar o framework três vezes numa tarde para eu conseguir
   * trabalhar. Palavras dele: "a ideia é que o restritivo só crie esse modo de
   * desenvolvimento com perguntas, mas não necessariamente travar tudo e eu
   * ter que ficar desligando ele toda hora".
   *
   * Um agente que "executa até o fim" não pode parar a cada arquivo. Quem trava
   * por clique é o `sugestivo`, onde a trava É o ponto.
   *
   * O que o restritivo faz, então: muda o TOM (direto, sem prosa) e o
   * comportamento (pergunta o objetivo uma vez, monta o backlog, executa). A
   * contenção vem do Routia, de fora. */
  restritivo: {
    id: 'restritivo',
    titulo: 'Restritivo',
    explica: 'Não sai do fluxo: pedido novo vira item do backlog e a execução continua. Só para no que só ele decide.',
    /* Definição dele em 16/08, e é a que dá mecanismo ao modo:
     *
     *   "o modo restritivo deveria ser um modo que não te permite sair do
     *   fluxo. Se eu pedir pra adicionar alguma coisa, deveria salvar isso,
     *   adicionar a tarefa ao backlog, e continuar. Você vai fazendo o
     *   backlog — tem dez tarefas, vai fazer as dez. Só para quando for uma
     *   decisão única, tipo no design ter que definir a fonte: aí você
     *   pergunta."
     *
     * Três regras, e a primeira é a que eu mais quebro: **pedido no meio vira
     * item, não interrupção**. Hoje eu paro, faço o que ele pediu, e perco a
     * sequência — e ele fica sem saber onde o backlog parou.
     *
     * A terceira é o critério de parada, e ele é estreito de propósito: só
     * decisão que **só ele** pode tomar. "Qual fonte?" para; "faço agora ou
     * depois?" não para, porque a ordem já está no backlog. */
    fluxo: {
      pedidoNovo: 'registra no backlog e continua — não interrompe a sequência',
      paradaLegitima: 'só o que exige decisão dele: gosto, prioridade entre frentes, risco que ele assume',
      naoPara: 'confirmação de próximo passo, escolha técnica, ordem já definida no backlog',
      // A trava do `fluxo-guard`: com backlog aberto, PARAR é que precisa ser
      // declarado. A primeira versão pegava só promessa quebrada ("sigo" e não
      // seguir), e ele viu o furo na hora: parar calado passava, que é o
      // comportamento exato da queixa. Continuar deixou de ser o padrão
      // implícito para virar a regra, com quatro saídas nomeadas.
      pararExigeDeclaracao: true,
    },
    trava: false,
    pergunta: false,
    exigeAutorizacao: false,
  },

  /**
   * Contínuo: o restritivo sem o teto de entregas.
   *
   * Nomeado por ele em 17/08, resolvendo uma briga entre duas ordens dele:
   *
   * > "podemos criar um Hook pra modo continuo. assim o Hook que você criou
   * > fica útil pra um 'modo revisão' e cria um Hook pra fazer o agente ir
   * > ateh o fim do backlog e chamamos de modo continuo no framework"
   *
   * O teto de duas entregas nasceu de um pedido dele (16/08, contra o
   * afogamento) e a execução até zerar também (16/08, contra a pausa
   * indevida). As duas regras são boas e brigam. A saída dele: viram MODOS.
   *
   * - restritivo = modo revisão: executa em fila, mas para a cada duas
   *   entregas para ele conferir. É o de acompanhar de perto.
   * - contínuo = vai até o fim do backlog, e só para no que só ele decide.
   *   É o de "toca o barco que eu olho depois".
   */
  continuo: {
    id: 'continuo',
    titulo: 'Contínuo',
    explica: 'Vai até o fim do backlog sem parar para mostrar. Só interrompe no que só ele decide.',
    fluxo: {
      pedidoNovo: 'registra no backlog e continua — não interrompe a sequência',
      paradaLegitima: 'só o que exige decisão dele: gosto, prioridade entre frentes, risco que ele assume',
      naoPara: 'confirmação de próximo passo, escolha técnica, ordem já definida no backlog, e o teto de entregas',
      pararExigeDeclaracao: true,
      // é isto que o teto-guard lê para se desligar neste modo
      semTeto: true,
    },
    trava: false,
    pergunta: false,
    exigeAutorizacao: false,
  },
}

/* ============================ os modos novos ============================
   Renomeação e ampliação pedidas por ele em 17/08:

   > "vamos criar novos modo e renomear os existentes do framework. o restritivo
   > tá mais pra continuativo, o diálogo seria mais um 'modo livre' (…) ficou
   > faltando o modo estudo que você ia implementar, o modo debug, e tem mais
   > coisas que podemos criar com os hooks certos combinados ou desativados
   > propositalmente"

   E a regra que dá mecanismo a tudo, dita por ele na mesma tarde: **se tem
   função bloqueando, entra como framework**. Até aqui as 32 travas viviam soltas,
   ligadas por padrão e indiferentes ao modo. Agora cada modo declara o que exige
   e o que desliga de propósito, em `hooks`.

   Os apelidos antigos (`dialogo`, `restritivo`, `continuo`) continuam válidos:
   há estado gravado em disco com eles, e renomear não pode mudar o
   comportamento de um projeto pelas costas. */
Object.assign(MODOS, {
  estudo: {
    id: 'estudo',
    titulo: 'Estudo',
    explica: 'Entender sem mexer. Escrita em código recusada; a saída é o que você lê.',
    trava: true,
    pergunta: false,
    /* `alvoLivre` é o que este modo tem de próprio: ele NÃO trava documentação
       nem backlog, porque é justamente ali que a saída dele mora. */
    soEscreve: ['docs/**', '*.md'],
    hooks: {
      exige: ['medir-guard', 'reporte-guard'],
      desliga: ['teto-guard'],
    },
  },
  depuracao: {
    id: 'depuracao',
    titulo: 'Depuração',
    explica: 'Algo quebrou. Medir antes de mexer, e mexer só onde está o defeito.',
    trava: false,
    pergunta: false,
    fluxo: {
      pedidoNovo: 'registra no backlog e continua, o defeito em curso vem primeiro',
      paradaLegitima: 'quando a causa medida contraria o que ele descreveu, e a decisão de rumo é dele',
      naoPara: 'confirmação de próximo passo, e o teto de entregas',
      pararExigeDeclaracao: true,
      semTeto: true,
    },
    hooks: {
      // medir antes de agir é a regra 7 dele, e aqui ela é obrigatória
      exige: ['medir-guard', 'visual-guard'],
      // conserto é iteração curta: o teto picaria o trabalho no meio
      desliga: ['teto-guard'],
    },
  },
  desenho: {
    id: 'desenho',
    titulo: 'Desenho',
    explica: 'Mexer em tela. Print nas duas larguras, e a forma que você nomeou é obrigatória.',
    trava: false,
    pergunta: false,
    hooks: {
      exige: ['visual-guard', 'forma-guard', 'referencia-guard', 'desvio-guard'],
      desliga: [],
    },
    // teto de UMA entrega: ele olha cada mudança visual antes da seguinte
    teto: 1,
  },
  revisao: {
    id: 'revisao',
    titulo: 'Revisão',
    explica: 'Apontar sem consertar. Cada achado vira linha no backlog, com onde está.',
    trava: true,
    pergunta: false,
    soEscreve: ['docs/**', '*.md'],
    hooks: {
      exige: ['roadmap-guard', 'reporte-guard'],
      desliga: [],
    },
  },
  pareado: {
    id: 'pareado',
    titulo: 'Pareado',
    explica: 'Eu mostro cada passo e espero você antes do próximo.',
    trava: true,
    pergunta: true,
    exigeAutorizacao: true,
    hooks: {
      exige: ['visual-guard', 'pergunta-guard'],
      desliga: [],
    },
    teto: 1,
  },
  entrega: {
    id: 'entrega',
    titulo: 'Entrega',
    explica: 'Fechar o que está aberto: prova em cada item, backlog em dia, commit preparado.',
    trava: false,
    pergunta: false,
    hooks: {
      exige: ['pronto-guard', 'fila-guard', 'roadmap-guard', 'cc-check'],
      desliga: [],
    },
  },
})

/* Os nomes que ele escolheu, e os antigos que continuam valendo. O `titulo` é o
   que aparece na tela; o `id` continua o mesmo em disco, porque trocar id
   invalidaria o estado gravado de cada projeto. */
MODOS.dialogo.titulo = 'Livre'
MODOS.dialogo.explica = 'Conversa solta. Sem um gatilho claro seu, eu pergunto antes de escrever código.'
MODOS.restritivo.titulo = 'Continuativo'
MODOS.continuo.titulo = 'Autônomo'
MODOS.continuo.explica = 'Vai até o fim do backlog sem parar para mostrar. É o modo de quando você não está olhando.'

/** Apelido para nome novo, aceito na linha de comando e na tela. */
export const APELIDOS = {
  livre: 'dialogo',
  continuativo: 'restritivo',
  autonomo: 'continuo',
  debug: 'depuracao',
  design: 'desenho',
}

/** Resolve o que foi digitado: nome novo, apelido antigo, ou nada. */
export const acharModo = (nome) => MODOS[nome] || MODOS[APELIDOS[String(nome || '').toLowerCase()]] || null

/* ============================== os perfis ==============================
   Pedido dele, na mesma conversa, e a razão é de leitura:

   > "gostei de todos, mas poderiam ser sub-modos (…) podemos fazer alguns
   > juntos, como por exemplo o modo sugestivo e o desenho juntos pra transformar
   > a ferramenta em um designer (…) seria o profissional que eu contrataria
   > praquela tarefa, a ideia eh facilitar o meu reconhecimento rápido"

   Então o perfil não é um modo novo: é a COMBINAÇÃO de modos, com um nome de
   profissão. Ele escolhe "Designer" e não precisa lembrar que aquilo é desenho
   mais sugestivo. Os modos continuam existindo para quem quer montar à mão. */
export const PERFIS = {
  designer: {
    id: 'designer',
    titulo: 'Designer',
    contrataria: 'mexer em tela, com você olhando cada passo',
    modos: ['desenho', 'sugestivo'],
  },
  /* Modelagem: desenhar o sistema INTEIRO antes de programar. Pedido dele em
     17/08, e ele deu o mecanismo junto: "hooks que travem os prompts em
     desenhar o sistema todo antes de programar". A trava é a fase de Definição
     do próprio framework, mais o modo estudo, que recusa escrita em código: a
     saída obrigatória é o documento de desenho, não commit. */
  modelagem: {
    id: 'modelagem',
    titulo: 'Modelagem de sistema',
    contrataria: 'desenhar o sistema todo antes de escrever a primeira linha',
    modos: ['estudo'],
    exigeFase: 'definicao',
    entrega: 'o desenho escrito: peças, o que cada uma faz, e por onde os dados passam',
  },
  /* Scrum Master, também dele: "hooks que travem o sistema até definir todo o
     produto e projeto e depois confirmar que tá de uma forma ideal baseado em um
     padrão que agente definir". Duas travas, e nesta ordem: nada de código
     enquanto o MVP não tiver nome e critérios; e o que fecha só fecha com prova
     contra os critérios escritos. */
  scrum: {
    id: 'scrum',
    titulo: 'Scrum Master',
    contrataria: 'definir produto e projeto, e só liberar quando bate com o padrão',
    modos: ['revisao'],
    exigePredicados: ['mvp-tem-nome', 'mvp-definido'],
    entrega: 'produto e projeto definidos, com critério de pronto por item',
  },
  /* Os três que ele aprovou, e a correção dele: "é algo mais dentro de um debug,
     pode ser sub-categoria do depurador". Então eles têm `pai: depurador` e
     aparecem agrupados na tela, em vez de soltos ao lado de Designer. */
  depurador: {
    id: 'depurador',
    titulo: 'Depurador',
    contrataria: 'achar e consertar o que está quebrado',
    modos: ['depuracao'],
  },
  perito: {
    id: 'perito',
    titulo: 'Perito',
    pai: 'depurador',
    contrataria: 'achar a causa medindo, antes de qualquer conserto',
    modos: ['depuracao', 'estudo'],
  },
  pesquisador: {
    id: 'pesquisador',
    titulo: 'Pesquisador',
    pai: 'depurador',
    contrataria: 'entender e escrever o que descobriu, sem tocar no código',
    modos: ['estudo'],
  },
  revisor: {
    id: 'revisor',
    titulo: 'Revisor',
    pai: 'depurador',
    contrataria: 'olhar o que existe e apontar, sem consertar',
    modos: ['revisao'],
  },
}

/**
 * O que um perfil exige e desliga, somando os modos dele.
 *
 * Soma com uma regra clara: **exigência vence desligamento**. Se um modo pede
 * uma trava e o outro a desliga, ela fica ligada. Na dúvida entre proteger e
 * soltar, protege, e é o mesmo critério do Routia com rota ocupada em duas
 * máquinas.
 */
export function perfilResolvido(id) {
  const p = PERFIS[id]
  if (!p) return null
  const exige = new Set()
  const desliga = new Set()
  let teto = null
  for (const nome of p.modos) {
    const m = MODOS[nome]
    if (!m) continue
    for (const h of m.hooks?.exige || []) exige.add(h)
    for (const h of m.hooks?.desliga || []) desliga.add(h)
    if (m.teto != null) teto = teto == null ? m.teto : Math.min(teto, m.teto)
  }
  for (const h of exige) desliga.delete(h)
  return {
    ...p,
    // o modo BASE é o primeiro: é ele quem define trava, pergunta e fluxo
    base: MODOS[p.modos[0]] || null,
    exige: [...exige],
    desliga: [...desliga],
    teto,
    /* A trava de ETAPA, que é o que ele pediu de verdade para Modelagem e Scrum
       Master: não é só um nome bonito, é "não passa daqui antes de X". Sai do
       vocabulário que o framework já tinha (fases e predicados), então nada é
       inventado só para o perfil existir. */
    pendencias: [],
  }
}

/**
 * O que falta para este perfil liberar o trabalho.
 *
 * Modelagem exige estar na fase de Definição, com o desenho escrito. Scrum
 * Master exige o MVP com nome e critérios. Os dois vêm dos pedidos dele em
 * 17/08, com o mecanismo que ele mesmo descreveu: *"hooks que travem os prompts
 * em desenhar o sistema todo antes de programar"* e *"hooks que travem o sistema
 * até definir todo o produto e projeto"*.
 */
export function faltaNoPerfil(estado) {
  const p = estado?.perfil ? PERFIS[estado.perfil] : null
  if (!p) return []
  const falta = []
  if (p.exigeFase && estado?.fase !== p.exigeFase) {
    const fase = METODOS[estado?.metodo]?.fases?.find((f) => f.id === p.exigeFase)
    falta.push(`${p.titulo} trabalha na fase ${fase?.titulo || p.exigeFase}, e o projeto está em ${estado?.fase || 'nenhuma'}`)
  }
  for (const nome of p.exigePredicados || []) {
    const r = PREDICADOS[nome] ? PREDICADOS[nome](estado) : null
    if (r) falta.push(r)
  }
  return falta
}

/** Os perfis principais, com os sub abaixo de cada um. É o agrupamento que a
 *  tela usa: ele corrigiu que Perito, Pesquisador e Revisor são variações do
 *  Depurador, não papéis soltos ao lado de Designer. */
export function perfisEmArvore() {
  const raizes = Object.values(PERFIS).filter((p) => !p.pai)
  return raizes.map((p) => ({
    ...p,
    subs: Object.values(PERFIS).filter((x) => x.pai === p.id),
  }))
}

/** `dialogo` é o padrão: é o fluxo que já existia antes de os modos nascerem, e
 *  estado antigo (sem o campo) não pode mudar de comportamento sozinho. */
export const modoDe = (estado) => MODOS[estado?.modo] || MODOS.dialogo

/**
 * O que vale AGORA neste projeto: o perfil, se houver, senão o modo.
 *
 * Uma conta só, e é de propósito: com duas (uma para o perfil, outra para o
 * modo) a tela e a trava discordariam sobre o mesmo projeto, que é o defeito
 * que o painel já pagou duas vezes.
 */
export function vigente(estado) {
  const perfil = estado?.perfil ? perfilResolvido(estado.perfil) : null
  const modo = perfil?.base || modoDe(estado)
  return {
    perfil,
    modo,
    titulo: perfil ? perfil.titulo : modo.titulo,
    explica: perfil ? perfil.contrataria : modo.explica,
    exige: perfil ? perfil.exige : (modo.hooks?.exige || []),
    desliga: perfil ? perfil.desliga : (modo.hooks?.desliga || []),
    teto: perfil ? perfil.teto : (modo.teto ?? null),
    semTeto: Boolean(modo.fluxo?.semTeto),
  }
}

export const estadoInicial = (metodo = 'mvp-basico') => ({
  metodo,
  modo: 'dialogo',
  fase: METODOS[metodo]?.fases[0]?.id || null,
  mvp: { nome: '', criterios: [] },
  // F4: as ferramentas de verificação deste projeto, escolhidas na Definição.
  // `verificacao` guarda o resultado de cada uma: `{ gitleaks: { ok, em } }`.
  ferramentas: [],
  verificacao: {},
  // O que a IA já pode construir sem perguntar de novo. Vazio significa
  // "conversamos, mas você ainda não mandou fazer" — o estado exato em que eu
  // estava quando construí o glossário sem pedido.
  autorizado: [],
  historico: [],
})

const metodoDe = (m) => (typeof m === 'string' ? METODOS[m] : m) || null

/**
 * O coração. Devolve a fase atual, o que falta para sair dela e o que ela trava.
 * `pendencias` vazio significa que o portão está aberto para a próxima fase.
 */
export function avaliar(metodo, estado) {
  const M = metodoDe(metodo)
  if (!M) return { erro: 'método desconhecido', fase: null, pendencias: [], trava: [] }
  // Desligado é diferente de inexistente, e a diferença é o dado: desligar
  // preserva o MVP e o histórico de escopo, apagar a pasta joga fora. O botão
  // do painel desliga; quem quiser sumir com tudo apaga `.framework` à mão.
  if (estado?.ligado === false) {
    return {
      metodo: M.id, ligado: false, fase: estado?.fase || null, pendencias: [],
      portaoAberto: true, trava: [], proxima: null, tituloFase: 'Desligado',
      explica: 'O framework está desligado neste projeto. Nada é travado.',
      indice: 0, ultima: false,
    }
  }

  const idx = Math.max(0, M.fases.findIndex((f) => f.id === estado?.fase))
  const fase = M.fases[idx]
  const pendencias = (fase.exige || [])
    .map((p) => (PREDICADOS[p] ? PREDICADOS[p](estado) : `predicado desconhecido: ${p}`))
    .filter(Boolean)

  return {
    metodo: M.id,
    ligado: true,
    fase: fase.id,
    tituloFase: fase.titulo,
    explica: fase.explica,
    indice: idx,
    ultima: idx === M.fases.length - 1,
    pendencias,
    portaoAberto: pendencias.length === 0,
    trava: fase.trava || [],
    proxima: M.fases[idx + 1]?.id || null,
  }
}

/**
 * O que o hook pergunta. `rel` é o caminho relativo à raiz do projeto.
 * Liberar é o padrão: qualquer dúvida (método ausente, estado corrompido)
 * libera, porque um framework que trava por bug próprio é desligado no mesmo dia.
 */
export function podeEditar(metodo, estado, rel) {
  const a = avaliar(metodo, estado)
  if (a.erro) return { ok: true, motivo: 'método desconhecido, liberando' }
  if (a.ligado === false) return { ok: true, motivo: 'framework desligado neste projeto' }
  if (SEMPRE_LIVRE.some((p) => casa(p, rel))) return { ok: true, motivo: 'caminho sempre livre' }

  // O MODO decide antes da fase: nos modos que travam, nem MVP definido libera
  // código sem autorização explícita. É o conserto do erro de 14/08 — o projeto
  // estava em Execução com o portão aberto, e por isso nada me impediu.
  const modo = modoDe(estado)
  const eCodigo = CODIGO.some((p) => casa(p, rel))

  /* O PERFIL decide antes de tudo, e é o que ele pediu em 17/08: Modelagem não
     deixa programar antes do sistema estar desenhado, Scrum Master não deixa
     antes do produto estar definido. Vale só para código: documentação e
     backlog são justamente a saída desses dois papéis. */
  if (eCodigo) {
    const faltaPerfil = faltaNoPerfil(estado)
    if (faltaPerfil.length) {
      const p = PERFIS[estado.perfil]
      return {
        ok: false,
        perfil: p.id,
        modo: modo.id,
        motivoModo: p.contrataria,
        pendencias: faltaPerfil,
        explica: `${p.titulo}: ${p.contrataria}.`
          + (p.entrega ? ` A entrega deste papel é ${p.entrega}.` : ''),
      }
    }
  }

  if (modo.trava && eCodigo) {
    const permitido = (estado?.autorizado || []).some((alvo) => casa(alvo, rel) || alvo === '**')
    if (!permitido) {
      return {
        ok: false,
        modo: modo.id,
        motivoModo: modo.explica,
        pendencias: [`o modo ${modo.titulo} exige autorização explícita para escrever em ${rel}`],
        explica: modo.explica,
      }
    }
  }

  if (!a.trava.some((p) => casa(p, rel))) return { ok: true, motivo: 'fase não trava este caminho' }
  if (a.portaoAberto) return { ok: true, motivo: 'portão aberto, falta só avançar de fase' }
  return { ok: false, fase: a.fase, pendencias: a.pendencias, explica: a.explica }
}

/**
 * Autoriza a IA a escrever num caminho, dentro dos modos que travam.
 *
 * `'**'` autoriza tudo até o modo mudar, e existe para a ordem "pode
 * implementar" não virar uma lista de caminhos digitada à mão. A autorização é
 * um evento com hora e motivo: é o rastro que o cockpit traduz, e o que faltava
 * quando eu decidi sozinho que era hora de construir.
 */
/**
 * CC-91 parte 3: o agente PEDE antes de escrever, em vez de tentar e ser barrado.
 *
 * Inverte o fluxo, e a inversão é o pedido dele: hoje eu tento, bato no gate, e
 * ele autoriza tudo de uma vez com `**` — que é o atalho que esvazia o modo. Com
 * pedido, ele libera **o arquivo que eu pedi**, sabendo por quê.
 *
 * O mecanismo é o mesmo do `rota-pedidos.mjs` (13/08), que faz isto para rotas:
 * o bloqueio vira pedido registrado, e o dono libera por comando ou clique.
 *
 * Guarda no máximo 20: pedido velho que ninguém respondeu é ruído, e a lista
 * cheia esconde justamente o que acabou de chegar.
 */
export function pedir(estado, { alvo, motivo = null, quando = null }) {
  if (!alvo) return { ok: false, erro: 'pedido sem alvo' }
  const pedidos = estado?.pedidos || []
  // mesmo arquivo pedido de novo não vira segunda linha: atualiza o motivo
  const outros = pedidos.filter((p) => p.alvo !== alvo)
  return {
    ok: true,
    estado: {
      ...estado,
      pedidos: [...outros, { alvo, motivo, quando: quando || null }].slice(-20),
    },
  }
}

/** Tira o pedido da fila. Chamado ao autorizar ou ao recusar. */
export function resolverPedido(estado, alvo) {
  return { ...estado, pedidos: (estado?.pedidos || []).filter((p) => p.alvo !== alvo) }
}

export function autorizar(estado, { alvo = '**', motivo = null, quando = null }) {
  const atual = estado?.autorizado || []
  if (atual.includes(alvo)) return { ok: true, estado }
  return {
    ok: true,
    estado: {
      ...resolverPedido(estado, alvo),
      autorizado: [...atual, alvo],
      historico: [
        ...(estado?.historico || []),
        { tipo: 'autorizacao', alvo, motivo, modo: modoDe(estado).id, quando: quando || null },
      ],
    },
  }
}

/**
 * Troca o modo. Zera as autorizações de propósito: autorização dada no diálogo
 * não pode sobreviver à entrada no sugestivo, senão trocar de modo não muda
 * nada e o rigor vira decoração.
 */
export function trocarModo(estado, modo, { quando = null } = {}) {
  if (!MODOS[modo]) return { ok: false, erro: `modo desconhecido: ${modo}` }
  return {
    ok: true,
    estado: {
      ...estado,
      modo,
      autorizado: [],
      historico: [
        ...(estado?.historico || []),
        { tipo: 'modo', de: modoDe(estado).id, para: modo, quando: quando || null },
      ],
    },
  }
}

/** Avança de fase. Recusa com o que falta, em vez de avançar calado. */
export function avancar(metodo, estado) {
  const a = avaliar(metodo, estado)
  if (!a.portaoAberto) return { ok: false, pendencias: a.pendencias }
  if (a.ultima) return { ok: false, pendencias: ['já está na última fase'] }
  return { ok: true, estado: { ...estado, fase: a.proxima } }
}

/**
 * Mudança de escopo DECLARÁVEL, e é de propósito que ela não seja proibida.
 * Travar mudança de escopo tem dois desfechos previsíveis: o Felipe desliga o
 * framework, ou burla. Mudar de ideia no meio é comportamento real e legítimo
 * dele (o reposicionamento de 13/08 mudou o backlog inteiro num dia). O valor
 * está em a mudança ficar REGISTRADA, não em impedir.
 */
export function mudarEscopo(estado, { mvp, motivo, quando }) {
  if (!motivo || !String(motivo).trim()) {
    return { ok: false, erro: 'mudança de escopo exige motivo' }
  }
  return {
    ok: true,
    estado: {
      ...estado,
      mvp: mvp || estado.mvp,
      historico: [
        ...(estado.historico || []),
        { tipo: 'escopo', de: estado.mvp, para: mvp, motivo, quando: quando || null },
      ],
    },
  }
}

/**
 * F4: escolhe as ferramentas de verificação do projeto.
 *
 * Substitui a lista inteira em vez de acrescentar, de propósito: é uma decisão
 * tomada de uma vez na Definição, não um acúmulo. Tirar uma ferramenta da lista
 * precisa ser tão fácil quanto pôr.
 */
export function escolherFerramentas(estado, lista, { quando = null } = {}) {
  const limpa = [...new Set((Array.isArray(lista) ? lista : []).map((f) => String(f).trim()).filter(Boolean))]
  return {
    ok: true,
    estado: {
      ...estado,
      ferramentas: limpa,
      historico: [
        ...(estado?.historico || []),
        { tipo: 'ferramentas', de: estado?.ferramentas || [], para: limpa, quando },
      ],
    },
  }
}

/**
 * Registra o resultado de uma verificação.
 *
 * `ok: false` é o que segura a fase de Verificação no `entrega-cliente`. O
 * resultado é DADO, não julgamento: quem roda a ferramenta diz se passou, o
 * framework só confere se rodou e se passou.
 */
export function registrarVerificacao(estado, ferramenta, {
  ok, detalhe = null, quando = null, achados = null, verificou = true, escopo = 'tudo',
}) {
  const nome = String(ferramenta || '').trim()
  if (!nome) return { ok: false, erro: 'verificação sem nome de ferramenta' }
  return {
    ok: true,
    estado: {
      ...estado,
      verificacao: {
        ...(estado?.verificacao || {}),
        /* `ok` e `achados` são coisas diferentes, e guardar só o primeiro fez a
           tela mentir: a camada `service-role` aparecia com o selo "limpo" e o
           texto "5 achado(s)" logo abaixo, porque achado de gravidade baixa não
           reprova. `verificou` separa o terceiro caso, "não consegui olhar". */
        [nome]: { ok: Boolean(ok), achados, verificou: verificou !== false, escopo, detalhe, em: quando },
      },
    },
  }
}

/** Frase única para o `SessionStart` e para o painel. Sem número solto: o
 *  Felipe não teria como discordar de um "87", mas discorda de uma frase. */
export function resumo(metodo, estado) {
  const a = avaliar(metodo, estado)
  if (a.erro) return a.erro
  if (a.ligado === false) return 'Framework desligado neste projeto. O MVP registrado continua guardado.'
  const modo = modoDe(estado)
  if (modo.trava) {
    const n = (estado?.autorizado || []).length
    return `Modo ${modo.titulo}. ${modo.explica}${n ? ` ${n} autorização(ões) em vigor.` : ''}`
  }
  const onde = `fase ${a.indice + 1} de ${METODOS[a.metodo]?.fases.length}: ${a.tituloFase}`
  if (a.portaoAberto) {
    return a.ultima
      ? `${onde}. Todos os critérios do MVP estão marcados.`
      : `${onde}. Portão aberto, dá para avançar para "${a.proxima}".`
  }
  return `${onde}. Falta: ${a.pendencias.join('; ')}.`
}
