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
export function responder(estado, id, entrada, { quando = null } = {}) {
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
  }

  let novo = {
    ...estado,
    entrevista: {
      ...(estado?.entrevista || {}),
      respostas: { ...respostas, [id]: resposta },
    },
  }

  if (typeof p.aplica === 'function') {
    novo = p.aplica(novo, resposta, respostasDe(novo))
  }

  /* `terminou` é derivado, nunca digitado: o roteiro pode crescer depois desta
     resposta, e um sinalizador gravado à mão diria "acabou" com pergunta nova
     em aberto. */
  const restante = proxima(novo)
  novo.entrevista.terminou = restante ? null : (quando || new Date().toISOString())

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
    return `  ${p.header.padEnd(12)} ${texto}`
  })
  const fim = estado?.entrevista?.terminou ? 'completa' : `${feitas} de ${total}`
  return [`Entrevista (${fim}):`, ...linhas].join('\n')
}
