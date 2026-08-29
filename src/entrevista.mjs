/**
 * CC-133: a entrevista que CONDUZ a definição de um projeto novo.
 *
 * Pedido dele em 14/08:
 *
 * > *"ele me demandaria tarefas estruturais de um sistema, pra gente definir o
 * > que a gente vai fazer. Por exemplo, ele me perguntaria sobre o que é o
 * > projeto, é como se começasse uma sequência de desenvolvimento (…) que
 * > começa a me fazer perguntas, caminhando na direção do desenvolvimento do
 * > projeto de acordo com as respostas."*
 *
 * O framework já tinha a fase de Definição e já sabia COBRAR o que falta
 * (`PREDICADOS` + `PERGUNTAS` em `framework.mjs`). O que não existia é o
 * "caminhando de acordo com as respostas": as quatro perguntas de lá são
 * independentes entre si, e uma nunca decide se a outra faz sentido. Isso é
 * formulário, e formulário é o que ele não lê.
 *
 * A diferença desta camada, em uma linha: **a resposta anterior decide qual é
 * a próxima pergunta, e reescreve o texto dela**.
 *
 * Duas regras que vêm do que já custou tempo neste projeto:
 *
 * 1. **Uma pergunta por vez.** Já está escrito no `proximaPergunta()` do
 *    framework e vale o dobro aqui, porque o roteiro é maior: disparar quatro
 *    juntas transformaria a conversa de volta em formulário.
 * 2. **A entrevista não guarda uma segunda verdade.** Cada pergunta que produz
 *    algo que o framework já conhece (nome do MVP, critério de pronto,
 *    ferramentas de verificação) grava no campo de sempre, via `aplicar`. As
 *    respostas ficam registradas para o encadeamento e para a leitura humana,
 *    nunca como origem paralela do "pronto".
 *
 * Primeira fatia, e é de propósito: roteiro escrito à mão, na ordem que o
 * método já define. O horizonte que ele mesmo apontou (*"a gente pode pensar
 * num dia no futuro de fazer sem IA também"*, cobrindo UML e MER) não precisa
 * disso resolvido para valer hoje.
 */

/** Texto de uma resposta, seja ela opção escolhida ou frase digitada. */
const txt = (r) => String(r?.texto ?? r?.valor ?? '').trim()

/** O valor comparável de uma resposta: a opção, quando houve. */
const val = (r) => String(r?.valor ?? '').trim()

/**
 * O roteiro. Cada pergunta:
 *
 * - `id`       chave estável, é o que vai para o disco
 * - `pergunta` texto, ou função das respostas anteriores (é o encadeamento)
 * - `header`   rótulo curto, para caber no chip do `AskUserQuestion`
 * - `ajuda`    por que esta pergunta existe, na língua dele
 * - `opcoes`   caminhos prontos; texto livre continua valendo sempre
 * - `quando`   condição sobre as respostas anteriores: `false` pula a pergunta
 * - `aplica`   como a resposta entra no estado do framework (opcional)
 *
 * A ordem importa e não é alfabética: vai do que o projeto É para o que ele
 * PRECISA ter, terminando no que define "pronto". Perguntar o critério de
 * pronto antes de saber o que é o projeto foi o que fez a versão anterior
 * soar burocrática.
 */
export const ROTEIRO = [
  {
    id: 'natureza',
    pergunta: 'O que é este projeto?',
    header: 'Natureza',
    ajuda: 'A resposta muda todas as perguntas seguintes: projeto de cliente pergunta sobre acesso e tela, biblioteca não.',
    opcoes: [
      { valor: 'cliente', label: 'Site ou app para cliente', descricao: 'Alguém de fora vai usar, e vai para o ar.' },
      { valor: 'interna', label: 'Ferramenta interna', descricao: 'Só você usa, ou a sua equipe. Não vai para o ar como produto.' },
      { valor: 'biblioteca', label: 'Biblioteca ou pacote', descricao: 'Outro código consome isso, não uma pessoa.' },
      { valor: 'estudo', label: 'Estudo ou experimento', descricao: 'A entrega é a resposta a uma pergunta, não um programa.' },
    ],
  },
  {
    id: 'entrega',
    pergunta: (r) => (val(r.natureza) === 'estudo'
      ? 'Que pergunta este estudo responde?'
      : 'O que ele entrega, numa frase?'),
    header: 'A entrega',
    ajuda: 'É o nome do MVP. Sem isso o framework não sabe quando dizer que acabou.',
    /* Grava nos DOIS lugares quando é estudo, e não é redundância: o método
       `estudo` cobra `estudo.pergunta`, o `mvp-basico` cobra `mvp.nome`, e a
       entrevista não sabe (nem deve escolher) o método do projeto. Gravar só
       um dos dois deixava o portão da Definição fechado para sempre em quem
       respondeu "estudo" com o método padrão ligado. */
    aplica: (estado, resposta, r) => {
      const texto = txt(resposta)
      const comNome = { ...estado, mvp: { ...(estado.mvp || {}), nome: texto } }
      return val(r.natureza) === 'estudo'
        ? { ...comNome, estudo: { ...(estado.estudo || {}), pergunta: texto } }
        : comNome
    },
  },
  {
    id: 'quem',
    quando: (r) => val(r.natureza) !== 'estudo',
    pergunta: (r) => (val(r.natureza) === 'biblioteca'
      ? 'Que código vai consumir isso?'
      : 'Quem usa isso, e em que situação?'),
    header: 'Quem usa',
    ajuda: 'A regra dele: checar contra a realidade de campo antes de propor. "Impossível eu fotografar 40-50 fotos de um cliente" veio de pular esta pergunta.',
  },
  {
    id: 'hoje',
    quando: (r) => val(r.natureza) !== 'estudo',
    pergunta: (r) => {
      const quem = txt(r.quem)
      return quem
        ? `O que ${quem.length > 40 ? 'essa pessoa' : quem} faz hoje, sem isso?`
        : 'O que a pessoa faz hoje, sem isso?'
    },
    header: 'Hoje',
    ajuda: 'Se a resposta for "nada, não existe problema", o projeto não tem por que existir. É a pergunta mais barata de fazer e a mais cara de pular.',
  },
  {
    id: 'dado',
    quando: (r) => ['cliente', 'interna'].includes(val(r.natureza)),
    pergunta: 'Onde o dado mora?',
    header: 'O dado',
    ajuda: 'Decide metade da arquitetura, e decide sozinha se a próxima pergunta sobre acesso faz sentido.',
    opcoes: [
      { valor: 'banco', label: 'Banco de dados', descricao: 'Postgres, Supabase, SQLite. Tem esquema e migração.' },
      { valor: 'arquivo', label: 'Arquivo no próprio projeto', descricao: 'JSON, Markdown, CSV versionados junto do código.' },
      { valor: 'terceiro', label: 'API de terceiro', descricao: 'O dado é de outro serviço, este projeto só lê e mostra.' },
      { valor: 'nenhum', label: 'Não guarda dado', descricao: 'Tudo vive enquanto a página está aberta.' },
    ],
  },
  {
    id: 'acesso',
    quando: (r) => ['cliente', 'interna'].includes(val(r.natureza)) && val(r.dado) !== 'nenhum',
    pergunta: (r) => (val(r.dado) === 'banco'
      ? 'Esse banco tem parte que nem todo mundo pode ver?'
      : 'Tem parte restrita, que só quem entrou pode acessar?'),
    header: 'Acesso',
    ajuda: 'Regra dele, sem exceção: protótipo simula o ambiente real. Zona restrita aberta por padrão não passa, mesmo em mock.',
    opcoes: [
      { valor: 'sim', label: 'Sim, tem área restrita', descricao: 'Precisa de login, mesmo que provisório.' },
      { valor: 'nao', label: 'Não, é tudo público', descricao: 'Qualquer um que abre o endereço vê tudo.' },
    ],
  },
  {
    id: 'login',
    quando: (r) => val(r.acesso) === 'sim',
    pergunta: 'Como a pessoa entra?',
    header: 'Entrada',
    ajuda: 'Segunda camada da pergunta anterior: só existe porque você disse que tem área restrita.',
    opcoes: [
      { valor: 'senha', label: 'Usuário e senha', descricao: 'O projeto guarda a credencial, com hash.' },
      { valor: 'provedor', label: 'Conta de outro serviço', descricao: 'Google, GitHub, o provedor cuida da senha.' },
      { valor: 'link', label: 'Link ou código de uma vez', descricao: 'Sem cadastro. Serve para entrega a cliente.' },
      { valor: 'depois', label: 'Ainda não sei', descricao: 'Fica registrado como decisão em aberto, e o framework cobra depois.' },
    ],
  },
  {
    id: 'forma',
    quando: (r) => val(r.natureza) === 'cliente',
    pergunta: 'Que forma isso tem na tela?',
    header: 'Forma',
    ajuda: 'A forma que você nomear é a especificação, não uma sugestão. Se eu achar que outra fica melhor, eu pergunto antes de trocar.',
    opcoes: [
      { valor: 'pagina', label: 'Uma página que se lê', descricao: 'Institucional, portfólio, apresentação.' },
      { valor: 'painel', label: 'Painel com dado', descricao: 'Tabelas, gráficos, filtros.' },
      { valor: 'fluxo', label: 'Um fluxo com passos', descricao: 'Formulário, cadastro, compra: começo, meio e fim.' },
      { valor: 'app', label: 'Aplicativo de uso contínuo', descricao: 'A pessoa volta todo dia e o estado dela persiste.' },
    ],
  },
  {
    id: 'primeiro',
    pergunta: (r) => {
      const nome = txt(r.entrega)
      return nome
        ? `Dentro de "${nome}", qual é a primeira coisa que precisa funcionar?`
        : 'Qual é a primeira coisa que precisa funcionar?'
    },
    header: 'Primeiro',
    ajuda: 'Vira o primeiro critério de pronto. Escopo cresce declarando, nunca por acúmulo silencioso.',
    aplica: (estado, resposta) => {
      const texto = txt(resposta)
      if (!texto) return estado
      const cs = estado.mvp?.criterios || []
      if (cs.some((c) => c.texto === texto)) return estado
      return { ...estado, mvp: { ...(estado.mvp || {}), criterios: [...cs, { texto, feito: false }] } }
    },
  },
  {
    id: 'pronto',
    pergunta: 'O que mais precisa estar funcionando para você chamar de pronto?',
    header: 'Pronto é',
    ajuda: 'Um a três critérios verificáveis, um por linha. É o que o framework confere na hora de fechar.',
    aplica: (estado, resposta) => {
      const linhas = txt(resposta).split(/\r?\n/).map((l) => l.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean)
      if (!linhas.length) return estado
      const cs = estado.mvp?.criterios || []
      const novos = linhas.filter((t) => !cs.some((c) => c.texto === t)).map((texto) => ({ texto, feito: false }))
      return { ...estado, mvp: { ...(estado.mvp || {}), criterios: [...cs, ...novos] } }
    },
  },
  {
    id: 'risco',
    pergunta: (r) => (val(r.acesso) === 'sim'
      ? 'O que pode dar errado aqui e você só descobriria tarde? (dado exposto conta)'
      : 'O que pode dar errado e você só descobriria tarde?'),
    header: 'Risco',
    ajuda: 'Não é pessimismo: o que sai daqui costuma virar a escolha de verificação da pergunta seguinte.',
  },
  {
    id: 'verificacao',
    pergunta: (r) => (val(r.acesso) === 'sim'
      ? 'Este projeto tem login, então: que verificações antes de entregar?'
      : 'Que verificações este projeto precisa antes de entregar?'),
    header: 'Verificação',
    ajuda: 'Decidido aqui, na Definição, para não virar escolha solta no meio da execução.',
    opcoes: [
      { valor: 'basico', label: 'Segredo e dependência', descricao: 'Nada de chave vazada, nenhuma dependência com falha conhecida. Serve para qualquer projeto.' },
      { valor: 'cliente', label: 'Tudo que se aplica a site de cliente', descricao: 'O básico, mais as sondas de dado: banco aberto, chave de admin no pacote, rota restrita sem login.' },
      { valor: 'nenhuma', label: 'Nenhuma por enquanto', descricao: 'Projeto interno ou experimento. Pode acrescentar depois, mas o framework para de cobrar.' },
    ],
    aplica: (estado, resposta) => {
      const escolha = val(resposta)
      if (escolha === 'nenhuma') return { ...estado, ferramentas: [] }
      const basico = ['segredos', 'dependencias']
      const daCliente = [...basico, 'rls', 'chaves-no-bundle', 'rota-restrita']
      if (escolha === 'basico') return { ...estado, ferramentas: basico }
      if (escolha === 'cliente') return { ...estado, ferramentas: daCliente }
      return estado
    },
  },
]

const POR_ID = Object.fromEntries(ROTEIRO.map((p) => [p.id, p]))

/** As respostas guardadas, num objeto simples de id para resposta. */
export const respostasDe = (estado) => estado?.entrevista?.respostas || {}

/** Uma pergunta cabe no roteiro atual? Sem `quando`, sempre cabe. */
const cabe = (p, respostas) => (typeof p.quando === 'function' ? Boolean(p.quando(respostas)) : true)

/** Só as perguntas que a conversa até aqui tornou aplicáveis. A lista ENCOLHE
 *  e CRESCE conforme ele responde: é isso que separa entrevista de formulário,
 *  e é por isso que o progresso não pode ser contado sobre o roteiro inteiro. */
export function aplicaveis(respostas = {}) {
  return ROTEIRO.filter((p) => cabe(p, respostas))
}

/** O texto final da pergunta, já com a resposta anterior dentro. */
export function textoDaPergunta(p, respostas = {}) {
  return typeof p.pergunta === 'function' ? p.pergunta(respostas) : p.pergunta
}

/**
 * A próxima pergunta, ou `null` quando a entrevista acabou.
 *
 * Uma por vez, sempre. E o cálculo é refeito a cada chamada de propósito: uma
 * resposta pode tornar aplicável uma pergunta que estava fora do roteiro dois
 * minutos atrás, e congelar a lista no início perderia justamente isso.
 */
export function proxima(estado) {
  const respostas = respostasDe(estado)
  for (const p of ROTEIRO) {
    if (!cabe(p, respostas)) continue
    if (respostas[p.id] !== undefined) continue
    return {
      id: p.id,
      pergunta: textoDaPergunta(p, respostas),
      header: p.header,
      ajuda: p.ajuda,
      opcoes: p.opcoes || null,
      ...progresso(estado),
    }
  }
  return null
}

/** Quantas já foram, quantas o roteiro atual ainda tem. */
export function progresso(estado) {
  const respostas = respostasDe(estado)
  const lista = aplicaveis(respostas)
  const feitas = lista.filter((p) => respostas[p.id] !== undefined).length
  return { feitas, total: lista.length }
}

/**
 * Grava uma resposta e devolve o estado novo.
 *
 * Puro de propósito: quem chama decide gravar em disco. É a mesma separação
 * entre `framework.mjs` (motor testável) e `frameworkDisco.mjs` (quem sabe
 * onde as coisas moram), e é o que deixa o roteiro inteiro ser testado sem
 * tocar em arquivo nenhum.
 */
export function responder(estado, id, entrada, { quando = null, de = 'ele' } = {}) {
  const p = POR_ID[id]
  if (!p) return { ok: false, erro: `pergunta desconhecida: ${id}` }

  const respostas = respostasDe(estado)
  if (!cabe(p, respostas)) {
    return { ok: false, erro: `a pergunta "${id}" não se aplica a este projeto pelo que você já respondeu` }
  }

  /* Entrada pode ser o rótulo da opção, o valor dela, ou texto livre. Aceitar
     as três formas é a mesma regra do `normalizeTodo`: agente e pessoa escrevem
     diferente, e recusar variação sai mais caro que absorver. */
  const cru = typeof entrada === 'string' ? entrada.trim() : txt(entrada)
  if (!cru) return { ok: false, erro: 'resposta vazia' }

  const casa = (p.opcoes || []).find((o) => {
    const alvo = cru.toLowerCase()
    return o.valor.toLowerCase() === alvo || o.label.toLowerCase() === alvo
  })

  const resposta = {
    valor: casa ? casa.valor : null,
    texto: casa ? casa.label : cru,
    quando: quando || new Date().toISOString(),
    /* CC-390, 29/08: de ONDE veio esta resposta.
     *
     * `ele` é o que ele digitou. `prosa` é o que EU deduzi lendo a descrição
     * que ele escreveu, e é palpite meu até ele confirmar.
     *
     * ⚠️ Tratar as duas igual é o erro mais caro que este painel comete: o
     * resumo do projeto passaria a citar como fala dele uma frase que ele nunca
     * escreveu. Ele já pegou isso uma vez, em 17/08, quando um cartão mostrou
     * uma fala dele sobre outro assunto e ele concluiu que eu não tinha
     * entendido o pedido. */
    de,
  }

  let novo = {
    ...estado,
    entrevista: {
      ...(estado?.entrevista || {}),
      respostas: { ...respostas, [id]: resposta },
    },
  }

  /* ===== CC-392, 29/08: quando o `aplica` da pergunta PODE escrever no MVP =====
   *
   * Cada pergunta pode ter um `aplica` que grava direto no estado: "a entrega"
   * escreve `mvp.nome`, "pronto é" e "primeiro" acrescentam critérios. Isso
   * existe desde o começo e é bom, mas escrevia em três situações em que não
   * devia, e as três foram medidas em 29/08:
   *
   * 1. **Projeto que já existe.** `mvp.nome` era sobrescrito sem aviso. O carzo
   *    tem "A v2 do carzo.com.br no ar" escrito à mão, e uma entrevista nova
   *    trocaria isso pela primeira frase que ele digitasse. Dez projetos têm MVP
   *    escrito à mão.
   * 2. **Entrevista de FRENTE.** Uma frente nova não redefine o que o projeto
   *    inteiro entrega. O que sai dela é backlog.
   * 3. **Palpite meu.** Resposta deduzida da prosa não é fala dele, e não pode
   *    virar critério de pronto antes de ele confirmar.
   *
   * O `aplica` continua valendo no caso para o qual nasceu: projeto novo, sem
   * MVP, com ele respondendo. */
  const ehDeFrente = Boolean(frenteDa(novo))
  const ehPalpite = de === 'prosa'
  if (typeof p.aplica === 'function' && !ehDeFrente && !ehPalpite) {
    const antes = novo.mvp || {}
    const depois = p.aplica(novo, resposta, respostasDe(novo))
    const nomeAntes = String(antes.nome || '').trim()
    const nomeDepois = String(depois?.mvp?.nome || '').trim()
    /* Nome que JÁ existia não é trocado: acrescentar critério é somar, trocar o
       nome é apagar. As duas coisas vinham do mesmo gancho, e só uma delas
       destrói. */
    novo = (nomeAntes && nomeDepois !== nomeAntes)
      ? { ...depois, mvp: { ...depois.mvp, nome: nomeAntes } }
      : depois
  }

  /* `terminou` é derivado, nunca digitado: o roteiro pode crescer depois desta
     resposta, e um sinalizador gravado à mão diria "acabou" com pergunta nova
     em aberto. */
  const restante = proxima(novo)
  novo.entrevista.terminou = restante ? null : (quando || new Date().toISOString())

  /* CC-382: ao FECHAR a entrevista, ela grava o que apurou.
   *
   * Aqui, e não numa chamada separada que alguém precisaria lembrar de fazer:
   * peça que depende de alguém lembrar é peça que fica de fora, e é exatamente
   * por isso que a entrevista tinha zero uso em 11 projetos.
   *
   * `aplicar` já recusa escrever por cima de MVP feito à mão, então chamar
   * sempre é seguro. O que colidir volta em `sugestoes`, para a tela mostrar as
   * duas versões em vez de escolher sozinha. */
  if (!restante) {
    const r = aplicar(novo)
    return { ok: true, estado: r.estado, resposta, proxima: null, sugestoes: r.sugestoes, colhido: r.colhido }
  }

  return { ok: true, estado: novo, resposta, proxima: restante }
}

/** Apaga uma resposta, e com ela tudo que só existia por causa dela.
 *
 *  Voltar atrás numa entrevista encadeada não é apagar uma linha: responder
 *  "não tem área restrita" depois de ter dito como a pessoa entra deixaria a
 *  resposta de login órfã no arquivo, e ela reapareceria no resumo do projeto
 *  como se tivesse sido decidida. */
export function desfazer(estado, id) {
  const respostas = { ...respostasDe(estado) }
  if (respostas[id] === undefined) return { ok: false, erro: `"${id}" não foi respondida` }
  delete respostas[id]

  const orfas = []
  for (const p of ROTEIRO) {
    if (respostas[p.id] === undefined) continue
    if (cabe(p, respostas)) continue
    delete respostas[p.id]
    orfas.push(p.id)
  }

  const novo = { ...estado, entrevista: { ...(estado?.entrevista || {}), respostas, terminou: null } }
  return { ok: true, estado: novo, orfas }
}

/** A entrevista em texto, para o resumo do projeto e para o diário. */
/**
 * CC-382, 28/08: a entrevista passa a ESCREVER o que apurou.
 *
 * ## Por que isto faltava, e o número que prova
 *
 * Até aqui a entrevista terminava e devolvia um parágrafo. As respostas ficavam
 * guardadas em `estado.entrevista.respostas` e não viravam nada: nem MVP, nem
 * critério de pronto, nem item de backlog.
 *
 * Medido em 28/08, nos 11 projetos com framework desta máquina: **zero
 * responderam a entrevista**. Dez têm MVP nomeado, e nenhum veio dela. Uma peça
 * que funciona, não produz resultado e por isso ninguém usa.
 *
 * Pedido dele: *"eu chego com um projeto em linguagem natural, e o framework
 * vai primeiro criar uma definição de pronto"*. Isto é a definição de pronto
 * saindo da conversa em vez de ser digitada de novo.
 *
 * ## O que vira o quê
 *
 * - **o nome do MVP** sai de "a entrega", que é a pergunta que pede o que o
 *   projeto entrega quando estiver pronto;
 * - **os critérios** saem de "pronto é" e de "primeiro", uma linha cada. As
 *   duas descrevem o que precisa funcionar, e ele costuma responder em lista.
 *
 * Função PURA: não toca em disco, não decide se grava. Quem grava é quem sabe o
 * que já existe lá, e essa separação é o que impede a entrevista de apagar MVP
 * escrito à mão.
 */
export function colher(estado, { incluirPalpite = false } = {}) {
  const respostas = respostasDe(estado)
  /* ⚠️ CC-390, 29/08: **palpite meu não define o pronto.**
     Resposta com `de: 'prosa'` é o que EU deduzi lendo a descrição dele, e não
     o que ele disse. Deixá-la virar critério de MVP faria o projeto inteiro ser
     planejado em cima de uma frase que ele nunca escreveu, e ele descobriria
     tarde, quando o backlog já estivesse montado.
     Ele confirma no modo Sugestivo, que é o que pediu: cada passo passa por
     ele. Confirmar troca a origem para `ele`, e aí o critério entra. */
  const vale = (id) => {
    const r = respostas[id]
    if (!r) return false
    return incluirPalpite || r.de !== 'prosa'
  }
  const texto = (id) => (vale(id) ? String(respostas[id]?.texto || '').trim() : '')

  /* Uma linha por critério, e linhas vazias fora. Ele responde em lista quando
     a pergunta pede lista, e um critério de três linhas na tela vira uma frase
     ilegível dentro do cartão. */
  const linhas = (id) => texto(id).split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)

  const criterios = [...new Set([...linhas('pronto'), ...linhas('primeiro')])]

  return {
    /* O nome cabe numa linha: é rótulo, não descrição. O resto do que ele
       escreveu continua inteiro nas respostas, e vai para o backlog. */
    nome: texto('entrega').split(/\r?\n/)[0].trim().slice(0, 120),
    criterios: criterios.map((texto) => ({ texto, feito: false })),
  }
}

/**
 * O que a entrevista GRAVARIA, e o que ela recusa gravar por cima.
 *
 * ⚠️ **MVP escrito à mão vence a entrevista, sempre.** Dez dos onze projetos
 * têm MVP nomeado por ele, e sobrescrever apagaria esse trabalho sem aviso
 * nenhum. O que colide sai como SUGESTÃO, para a tela poder mostrar as duas
 * versões e ele escolher; o que está vazio é preenchido direto, porque ali não
 * há nada a perder.
 */
export function aplicar(estado) {
  /* CC-391: entrevista DE FRENTE não mexe no MVP do projeto. O pronto do
     projeto inteiro é outra coisa, escrita à mão em dez deles, e uma frente
     nova não tem o direito de redefini-lo. O que sai da frente é backlog. */
  if (frenteDa(estado)) {
    return { estado, mudou: false, sugestoes: {}, colhido: colher(estado), plano: estado?.plano || {}, deFrente: true }
  }
  const colhido = colher(estado)
  const mvpAtual = estado?.mvp || {}
  const temNome = Boolean(String(mvpAtual.nome || '').trim())
  const temCriterios = Array.isArray(mvpAtual.criterios) && mvpAtual.criterios.length

  const sugestoes = {}
  const mvp = { ...mvpAtual }

  if (colhido.nome) {
    if (temNome && mvpAtual.nome.trim() !== colhido.nome) sugestoes.nome = colhido.nome
    else if (!temNome) mvp.nome = colhido.nome
  }

  if (colhido.criterios.length) {
    if (temCriterios) {
      /* Critério que já existe não entra de novo, e a comparação é pelo texto
         sem caixa nem espaço sobrando: ele escreve a mesma coisa de dois jeitos
         em dias diferentes, e o cartão com o item duplicado é o que aparece. */
      const chave = (c) => String(c?.texto || c || '').trim().toLowerCase()
      const jaTem = new Set((mvpAtual.criterios || []).map(chave))
      const novos = colhido.criterios.filter((c) => !jaTem.has(chave(c)))
      if (novos.length) sugestoes.criterios = novos
    } else {
      mvp.criterios = colhido.criterios
    }
  }

  const mudou = mvp.nome !== mvpAtual.nome
    || (mvp.criterios || []).length !== (mvpAtual.criterios || []).length

  /* O plano entra junto: é o que a fase de planejamento cobra, e ele sai das
     mesmas respostas. ⚠️ `itens` só conta o que foi ESCRITO no roadmap, e quem
     escreve é `gravarBacklog`; aqui fica o que a entrevista APURA, e o número
     de itens é confirmado por quem gravou. Contar aqui como se já estivesse no
     arquivo abriria o portão sobre um roadmap vazio. */
  const plano = { ...(estado?.plano || {}), primeira: planoDe(estado).primeira }

  return {
    estado: (mudou || plano.primeira !== estado?.plano?.primeira)
      ? { ...estado, mvp, plano }
      : estado,
    mudou,
    sugestoes,
    colhido,
    plano,
  }
}

/**
 * CC-383, 28/08: as respostas viram itens abertos de backlog.
 *
 * Pedido dele: *"depois a criação de um plano, backlog, sprints"*. O roadmap de
 * projeto novo nasce vazio, e ficava vazio: a conversa que descreve o trabalho
 * inteiro morria dentro do estado do framework.
 *
 * **Cada critério de pronto vira um item**, e não uma linha de checklist. O
 * critério é literalmente a resposta de "o que precisa estar funcionando", que
 * é a mesma pergunta que o backlog responde.
 *
 * **A citação é dele, e é o que faz o item ser reconhecível depois.** Palavras
 * dele em 27/08, sobre os itens que registrei com a fala original dentro:
 * *"isso é muito bom porque eu consigo identificar pelo que eu falei"*. Um item
 * de backlog escrito com as minhas palavras é um item que ele lê e não
 * reconhece.
 *
 * Função PURA: devolve o texto em markdown e não decide onde ele vai.
 */
export function paraBacklog(estado, { quando = null } = {}) {
  const colhido = colher(estado)
  if (!colhido.criterios.length) return null

  const respostas = respostasDe(estado)
  const dia = String(quando || new Date().toISOString()).slice(0, 10)
  const [ano, mes, d] = dia.split('-')
  const curto = `${d}/${mes}`

  /* O contexto que vale a pena carregar para dentro do item: o que o projeto
     entrega, para quem, e como é hoje. São as três respostas que explicam o
     porquê, e sem elas o item vira uma linha de tarefa sem causa. */
  const contexto = ['entrega', 'quem', 'hoje']
    .map((id) => [id, String(respostas[id]?.texto || '').trim()])
    .filter(([, t]) => t)

  const linhas = []
  const frente = frenteDa(estado)
  linhas.push(frente
    ? `## ▶ ${frente} (da entrevista de ${curto})`
    : `## ▶ Da entrevista de ${curto}: ${colhido.nome || 'o que foi combinado'}`)
  linhas.push('')
  linhas.push('Itens tirados da entrevista do framework, com as palavras dele.')
  linhas.push('Cada um é um critério de pronto que ele mesmo respondeu.')
  linhas.push('')

  if (contexto.length) {
    linhas.push('**O que foi dito na entrevista:**')
    linhas.push('')
    for (const [id, texto] of contexto) {
      const pergunta = ROTEIRO.find((x) => x.id === id)
      linhas.push(`- **${pergunta?.header || id}:** ${texto.split(/\r?\n/).join(' ')}`)
    }
    linhas.push('')
  }

  /* A primeira fatia sai marcada, e não é enfeite: ele respondeu qual é, e um
     backlog sem ordem devolve a ele a mesma pergunta que a entrevista já fez. */
  const primeiro = String(respostas.primeiro?.texto || '').trim().toLowerCase()

  for (const c of colhido.criterios) {
    const ehPrimeiro = primeiro && c.texto.toLowerCase() === primeiro
    linhas.push(`### ${c.texto}${ehPrimeiro ? ' 🟢' : ''}`)
    linhas.push('')
    if (ehPrimeiro) {
      linhas.push('Ele respondeu que esta é a primeira fatia, na pergunta sobre por')
      linhas.push('onde começar.')
      linhas.push('')
    }
    linhas.push('')
  }

  return linhas.join('\n')
}

/**
 * CC-384, 28/08: o que a fase de planejamento cobra, tirado da entrevista.
 *
 * Os dois portões da fase nova perguntam "o backlog está escrito?" e "qual é a
 * primeira fatia?". As duas respostas já existem na conversa: os critérios são
 * os itens, e a pergunta "primeiro" é literalmente por onde começar.
 *
 * Isto fecha o circuito: a entrevista responde, o backlog é escrito, e o portão
 * abre sozinho. Sem esta função ele ficaria pedindo, para sempre, uma coisa que
 * o projeto já tinha.
 */
export function planoDe(estado) {
  const colhido = colher(estado)
  const respostas = respostasDe(estado)
  const primeira = String(respostas.primeiro?.texto || '').split(/\r?\n/)[0].trim()
  return {
    itens: colhido.criterios.length,
    /* A primeira fatia é a resposta dele quando ela existe; sem ela, o primeiro
       critério, que é a ordem em que ele mesmo escreveu. Deixar vazio faria o
       portão cobrar uma escolha que a entrevista já pediu. */
    primeira: primeira || colhido.criterios[0]?.texto || '',
    em: estado?.entrevista?.terminou || null,
  }
}

/**
 * CC-389, 29/08: a prosa vira ponto de partida da entrevista.
 *
 * Pedido dele, e ele me corrigiu para chegar aqui:
 *
 * > *"a gente define primeiro um projeto em forma de proza e a partir disso nos
 * > projetamos a entrevista, ex: eu descrevo o projeto e em paralelo o framework
 * > vai tá configurado nesse modo"*
 *
 * O roteiro de 15 perguntas é fixo, e para o caso dele isso está errado: ele
 * escreve a descrição inteira e depois o framework pergunta de novo o que a
 * prosa já respondeu. Responder quinze perguntas depois de descrever tudo é
 * burocracia, e é o atrito que faz uma peça ser abandonada. A entrevista tinha
 * ZERO uso em 11 projetos.
 *
 * ## Quem lê a prosa NÃO é este código
 *
 * É o agente. Esta função só recebe o que foi lido e grava, marcando a origem.
 *
 * Fazer aqui uma heurística de palavra-chave seria pior que não fazer nada:
 * ela erraria, e erraria calada. Resposta pré-preenchida errada é pior que
 * pergunta nenhuma, porque ele confirma sem reler, e a partir daí o projeto
 * inteiro é planejado em cima de uma frase que ele nunca disse.
 *
 * O que fica registrado é que aquilo veio da prosa: a tela mostra como palpite,
 * ele confirma ou corrige, e só então vira fala dele.
 */
export function preencherDaProsa(estado, deduzidas = {}, { quando = null } = {}) {
  let novo = { ...estado, entrevista: { ...(estado?.entrevista || {}) } }
  const aceitas = []
  const recusadas = []

  for (const [id, texto] of Object.entries(deduzidas)) {
    if (!POR_ID[id]) { recusadas.push({ id, porque: 'pergunta desconhecida' }); continue }
    /* Já respondido POR ELE nunca é sobrescrito por palpite meu. O contrário
       vale: palpite pode ser corrigido pelo palpite seguinte, porque nenhum dos
       dois é dele. */
    const atual = respostasDe(novo)[id]
    if (atual && atual.de !== 'prosa') { recusadas.push({ id, porque: 'ele já respondeu isto' }); continue }
    const r = responder(novo, id, texto, { quando, de: 'prosa' })
    if (!r.ok) { recusadas.push({ id, porque: r.erro }); continue }
    novo = r.estado
    aceitas.push(id)
  }

  /* A prosa fica guardada inteira, e não só o que eu tirei dela. É a fonte: se
     amanhã eu ler melhor, ou se ele quiser conferir o que eu deduzi contra o
     que escreveu, o texto original precisa estar ali. */
  return { estado: novo, aceitas, recusadas }
}

/**
 * Guarda a descrição em prosa, que é por onde tudo começa.
 *
 * ## CC-391, 29/08: a entrevista pode ser de uma FRENTE, e não do projeto
 *
 * Ele me corrigiu quando tratei isto como caso do carzo: *"não é sobre isso, é
 * sobre qualquer projeto"*. O fluxo inteiro só nascia com o projeto, e projeto
 * que já existe não tinha porta nenhuma. Medido no carzo: em `execucao`, MVP
 * definido, e a única coisa oferecida era a lista dos oito critérios que faltam.
 *
 * **A mudança de conceito:** o fluxo deixa de ser DO PROJETO e passa a ser DE
 * UMA FRENTE. Um projeto tem várias, nascidas em momentos diferentes. O carzo
 * tem a v1 no ar e a v2 em construção; este painel tem dezenas.
 *
 * ⚠️ **Com `frente`, o MVP do projeto não é tocado.** Ele foi escrito à mão em
 * dez projetos, e a frente nova não tem o direito de redefinir o que o projeto
 * inteiro entrega. O que sai dela é backlog, e só.
 */
export function guardarProsa(estado, texto, { quando = null, frente = null } = {}) {
  const limpo = String(texto || '').trim()
  if (!limpo) return { ok: false, erro: 'prosa vazia' }
  const nome = String(frente || '').trim()
  return {
    ok: true,
    estado: {
      ...estado,
      entrevista: {
        ...(estado?.entrevista || {}),
        /* Frente nova zera as respostas: são de OUTRA conversa. Herdar as
           respostas da frente anterior faria o backlog novo nascer descrevendo
           o trabalho velho, com as palavras de outro dia. */
        ...(nome && nome !== estado?.entrevista?.frente
          ? { frente: nome, respostas: {}, terminou: null }
          : {}),
        prosa: { texto: limpo, em: quando || new Date().toISOString() },
      },
    },
  }
}

/** Esta entrevista é de uma frente, ou é a do projeto inteiro? */
export const frenteDa = (estado) => String(estado?.entrevista?.frente || '').trim() || null

/** O que ainda é palpite meu, esperando ele confirmar. */
export const palpites = (estado) => Object.entries(respostasDe(estado))
  .filter(([, r]) => r?.de === 'prosa')
  .map(([id, r]) => ({ id, header: POR_ID[id]?.header || id, texto: r.texto }))

export function resumo(estado) {
  const respostas = respostasDe(estado)
  const lista = aplicaveis(respostas).filter((p) => respostas[p.id] !== undefined)
  if (!lista.length) return 'entrevista não começou'
  const { feitas, total } = progresso(estado)
  /* Resposta de várias linhas (o critério de pronto costuma ser uma lista)
     quebrava a coluna do resumo: a segunda linha saía colada na margem, sem
     rótulo, parecendo item de outra pergunta. Vira uma linha só. */
  const linhas = lista.map((p) => {
    const texto = respostas[p.id].texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' · ')
    /* O palpite sai marcado, sempre. Sem a marca, o resumo apresenta como fala
       dele uma frase que eu deduzi, e ele lê as próprias palavras no lugar
       errado: o erro que ele nomeou em 17/08 e que custa a confiança na tela
       inteira. */
    const marca = respostas[p.id].de === 'prosa' ? ' (deduzido da sua descrição, confirme)' : ''
    return `  ${p.header.padEnd(12)} ${texto}${marca}`
  })
  const fim = estado?.entrevista?.terminou ? 'completa' : `${feitas} de ${total}`
  return [`Entrevista (${fim}):`, ...linhas].join('\n')
}
