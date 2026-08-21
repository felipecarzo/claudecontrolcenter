/**
 * O gate: a conversa dele mora AQUI, não dentro do agente.
 *
 * ## O que é, no pedido dele
 *
 * > "eu queria criar um gate, um terminal que salva o harness nosso independente
 * > do que a gente tá falando com o agente, assim poderíamos trocar um agente
 * > dentro da mesma conversa."
 *
 * Hoje cada um dos três guarda a própria conversa: o Claude Code num transcrito
 * que o painel só lê, o opencode dentro dele mesmo, o agy no rolo de um terminal
 * que morre com a aba. Trocar de agente significa recomeçar.
 *
 * Aqui a conversa é do painel. Os agentes viram intercambiáveis por baixo.
 *
 * ## O princípio que decide os empates deste arquivo
 *
 * **A conversa mora no disco. O agente é um processo que atende um turno e
 * morre.** Não é gosto de arquitetura, é consequência de duas coisas medidas
 * neste projeto: o painel reinicia por `POST /api/shutdown` várias vezes por
 * dia, porque é assim que se publica mudança nesta VPS; e processo filho morre
 * junto, porque `detached` não sai do cgroup do systemd e o conserto exige root.
 *
 * Um desenho em que a conversa É um processo vivo vira amnésia a cada
 * publicação, sem conserto possível. E um harness que evapora não salva nada,
 * que é justamente o que ele pediu que fosse salvo.
 *
 * ## Por que DOIS arquivos por conversa
 *
 * - `<id>.json` é o cabeçalho: pequeno, reescrito por tmp+rename.
 * - `<id>.jsonl` são os eventos: só acrescenta, nunca reescrito.
 *
 * Resposta de agente leva minutos e chega em pedaços. Reescrever um JSON
 * inteiro a cada pedaço é caro e perde tudo num travamento no meio. Só
 * acrescentando, o que chegou está no disco. É a lição do apagamento das notas
 * de 2026-08-09 aplicada antes de doer, e o motivo de o único arquivo reescrito
 * ser o pequeno.
 *
 * ## `seq` só existe no que um agente precisa LER
 *
 * `dele`, `turno` e `sistema` carregam número de sequência. `pedaco`,
 * `ferramenta` e `fim` não carregam. Pedaço de texto é material de tela: se
 * fosse numerado, o marcador de leitura andaria a cada palavra e o delta viraria
 * lixo.
 *
 * ## Contrato de segurança
 *
 * Este módulo NÃO dispara processo nenhum. Ele guarda, dobra e calcula delta.
 * Quem chama agente é `gateAgentes.mjs`. A separação existe para o teste poder
 * exercitar a conversa inteira sem gastar token.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

/* A casa e o abrigo, na ordem em que valem.
 *
 * `~/.claude` está montada SOMENTE LEITURA dentro do sandbox do Claude Code, e
 * isso já mordeu duas vezes neste projeto (CC-157 e CC-232). Um agente rodando
 * dentro do sandbox que quisesse gravar aqui levaria `EROFS` na cara.
 *
 * O abrigo sai de `DIR_SESSOES_ABRIGO()` subindo um nível de propósito, para
 * existir UMA conta de abrigo no projeto inteiro. Ela já respeita `CC_HOME`, que
 * é o que mantém o teste longe do dado real dele. */
export const DIR_CASA = () => path.join(casaClaude(), 'control-center-gate')
export const DIR_ABRIGO = () => path.join(path.dirname(DIR_SESSOES_ABRIGO()), 'gate')
const DIRS = () => [DIR_CASA(), DIR_ABRIGO()]

/** Tetos. Ficam aqui, e não em `config.mjs`, porque são invariantes do formato:
 *  mudar qualquer um deles muda o que já está gravado em disco. */
export const GATE_MAX_DELTA = 40000
export const GATE_MAX_CAUDA = 262144

const agora = () => Date.now()
const novoId = () => Math.random().toString(36).slice(2, 8) + '-' + Math.random().toString(36).slice(2, 6)

/** Os tipos que um agente precisa ler, e que por isso ganham `seq`. */
const NUMERADOS = new Set(['dele', 'turno', 'sistema'])

const arquivosDe = (dir, id) => ({ cab: path.join(dir, `${id}.json`), log: path.join(dir, `${id}.jsonl`) })

/* ============================ cabeçalho ============================ */

function lerCabecalhoDe(dir, id) {
  try {
    const d = JSON.parse(fs.readFileSync(arquivosDe(dir, id).cab, 'utf8'))
    return d && typeof d === 'object' ? d : null
  } catch {
    return null
  }
}

/** Em qual dos dois lugares esta conversa mora. `null` quando não existe. */
function ondeMora(id) {
  for (const dir of DIRS()) if (lerCabecalhoDe(dir, id)) return dir
  return null
}

export function lerCabecalho(id) {
  const dir = ondeMora(id)
  return dir ? { ...lerCabecalhoDe(dir, id), _onde: dir, _abrigo: dir !== DIR_CASA() } : null
}

/* Escrita atômica, o padrão do `meta.json`: escreve num temporário e renomeia.
   Rename é operação única no sistema de arquivos, então não existe instante em
   que o cabeçalho esteja pela metade. */
function gravarCabecalhoEm(dir, id, dados) {
  fs.mkdirSync(dir, { recursive: true })
  const { cab } = arquivosDe(dir, id)
  const tmp = `${cab}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 1))
  fs.renameSync(tmp, cab)
  return dados
}

/**
 * Grava o cabeçalho onde a conversa já mora; conversa nova tenta a casa e cai no
 * abrigo.
 *
 * Devolve `_abrigo` para quem chama poder dizer isso em voz alta. Cair no abrigo
 * em SILÊNCIO é como o dado parece sumir, que é a lição do CC-157.
 */
export function gravarCabecalho(id, patch) {
  const dir = ondeMora(id)
  const base = dir ? lerCabecalhoDe(dir, id) : null
  const dados = { ...(base || {}), ...patch, id, mexidaEm: agora() }

  const tentar = dir ? [dir] : DIRS()
  let ultimoErro = null
  for (const d of tentar) {
    try {
      gravarCabecalhoEm(d, id, dados)
      return { ...dados, _onde: d, _abrigo: d !== DIR_CASA() }
    } catch (e) { ultimoErro = e }
  }
  throw ultimoErro || new Error(`não consegui gravar a conversa ${id} em lugar nenhum`)
}

/**
 * Abre uma conversa. Uma por projeto, que é como ele pediu, e é o mesmo recorte
 * da rota do Método Routia: *"eu gosto da ideia de agentes pq beneficia o método
 * routia"*.
 *
 * `cwd` é obrigatório e é onde o agente vai agir. Quem chama precisa ter
 * validado que ele está dentro da base de projetos: uma conversa apontada para
 * o lugar errado é comando arbitrário na pasta errada.
 */
export function criar({ titulo, projeto, cwd, agentePadrao = 'claude', permissao = 'acceptEdits' }) {
  if (!cwd) throw new Error('conversa sem pasta: o agente não teria onde agir')
  const id = novoId()
  return gravarCabecalho(id, {
    titulo: titulo || projeto || 'conversa',
    projeto: projeto || null,
    cwd,
    agentePadrao,
    permissao,
    criadaEm: agora(),
    sessoes: {},     // o id de sessão nativo de cada agente que já respondeu
    marcadores: {},  // até que `seq` cada agente já leu
    estado: null,    // { turnoId, agente, desde } enquanto um turno está em voo
    rascunho: '',
    arquivada: false,
  })
}

/* ============================ eventos ============================ */

/**
 * Acrescenta um evento ao log da conversa.
 *
 * O `seq` é carimbado aqui, e sai do cabeçalho: guardá-lo no cabeçalho evita
 * reler o log inteiro só para saber o próximo número. Tipos não numerados
 * passam direto, sem tocar no cabeçalho.
 */
export function acrescentar(id, evento) {
  const cab = lerCabecalho(id)
  if (!cab) throw new Error(`conversa ${id} não existe`)
  const dir = cab._onde

  const cheio = { ...evento, em: evento.em || agora() }
  if (NUMERADOS.has(evento.tipo)) {
    cheio.seq = (cab.ultimoSeq || 0) + 1
    gravarCabecalho(id, { ultimoSeq: cheio.seq })
  }

  fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(arquivosDe(dir, id).log, JSON.stringify(cheio) + '\n')
  return cheio
}

/* Lê a CAUDA do log, nunca o arquivo inteiro.
 *
 * É a mesma disciplina de `transcript.mjs`, e pelo mesmo motivo: conversa longa
 * cresce sem teto, e ler tudo a cada tique de 2 segundos travaria o painel. */
function lerLinhas(dir, id, bytes) {
  const { log } = arquivosDe(dir, id)
  let cru = ''
  try {
    const tam = fs.statSync(log).size
    const de = Math.max(0, tam - bytes)
    const fd = fs.openSync(log, 'r')
    try {
      const buf = Buffer.alloc(tam - de)
      fs.readSync(fd, buf, 0, buf.length, de)
      cru = buf.toString('utf8')
    } finally { fs.closeSync(fd) }
    /* Cortando no meio de uma linha, a primeira fica quebrada. Descartar é
       certo: ela é o começo de um evento cujo fim já passou do teto. */
    if (de > 0) cru = cru.slice(cru.indexOf('\n') + 1)
  } catch {
    return []
  }
  const linhas = []
  for (const l of cru.split('\n')) {
    if (!l.trim()) continue
    try { linhas.push(JSON.parse(l)) } catch { /* linha pela metade de uma escrita em voo */ }
  }
  return linhas
}

/**
 * A conversa dobrada em mensagens, pronta para a tela.
 *
 * Os `pedaco` de um mesmo turno são concatenados na mensagem daquele turno, do
 * mesmo jeito que `lerResposta()` já faz com as duas gramáticas do opencode e do
 * agy. A tela nunca vê pedaço solto.
 */
export function lerConversa(id, { bytes = GATE_MAX_CAUDA } = {}) {
  const cab = lerCabecalho(id)
  if (!cab) return null
  const eventos = lerLinhas(cab._onde, id, bytes)

  const mensagens = []
  const porTurno = new Map()

  for (const e of eventos) {
    if (e.tipo === 'dele') {
      mensagens.push({ de: 'felipe', texto: e.texto, em: e.em, seq: e.seq })
    } else if (e.tipo === 'sistema') {
      mensagens.push({ de: 'sistema', texto: e.texto, em: e.em, seq: e.seq })
    } else if (e.tipo === 'turno') {
      const m = {
        de: e.agente, turnoId: e.turnoId, em: e.em, seq: e.seq,
        modelo: e.modelo || null, permissao: e.permissao || null,
        texto: '', ferramentas: [], estado: 'rodando', custo: null, segundos: null, erro: null,
      }
      porTurno.set(e.turnoId, m)
      mensagens.push(m)
    } else if (e.tipo === 'pedaco') {
      const m = porTurno.get(e.turnoId)
      /* `substitui` existe porque as três gramáticas entregam a resposta de
         jeitos diferentes: uma delas fecha com o texto INTEIRO num evento só,
         e concatenar ali duplicaria a resposta na tela. Quem acompanha grava o
         texto completo a cada olhada e marca `substitui`; quem grava pedaço de
         verdade não marca, e aí concatena. */
      if (m) m.texto = e.substitui ? e.texto : m.texto + e.texto
    } else if (e.tipo === 'ferramenta') {
      const m = porTurno.get(e.turnoId)
      if (m) m.ferramentas.push({ nome: e.nome, alvo: e.alvo || null, em: e.em })
    } else if (e.tipo === 'fim') {
      const m = porTurno.get(e.turnoId)
      if (m) {
        m.estado = e.estado || 'pronto'
        m.custo = e.custo ?? null
        m.segundos = e.segundos ?? null
        m.erro = e.erro || null
      }
    }
  }

  /* CC-252b: o gasto da conversa inteira, somado das respostas.
   *
   * Ele pediu por escrito, fora das opções que eu tinha dado: *"uma noção de
   * quantos tokens gastamos no geral e em cada resposta"*. Cada resposta já
   * carrega o seu; aqui sai o total.
   *
   * O dólar é referência de comparação, nunca fatura: ele paga assinatura, e a
   * primeira versão de uma conta parecida neste projeto chegou a mostrar
   * "sobra de menos R$ 19.504" num projeto lucrativo. */
  const gasto = mensagens.reduce((a, m) => {
    if (!m.custo) return a
    return {
      dolar: a.dolar + (m.custo.dolar || 0),
      entrada: a.entrada + (m.custo.entrada || 0),
      saida: a.saida + (m.custo.saida || 0),
      cacheLido: a.cacheLido + (m.custo.cacheLido || 0),
      cacheCriado: a.cacheCriado + (m.custo.cacheCriado || 0),
      respostas: a.respostas + 1,
    }
  }, { dolar: 0, entrada: 0, saida: 0, cacheLido: 0, cacheCriado: 0, respostas: 0 })

  return {
    cabecalho: cab,
    mensagens,
    gasto,
    ultimoSeq: cab.ultimoSeq || 0,
    /* O turno aberto sai do CABEÇALHO, não do log: no reinício do painel o log
       pode ter um `turno` sem `fim` para sempre, e é o cabeçalho que diz se
       alguém ainda está esperando por ele. */
    turnoAberto: cab.estado?.turnoId || null,
    truncada: eventos.length > 0 && mensagens[0]?.seq > 1,
  }
}

/* ============================ o delta ============================ */

/**
 * O que este agente ainda não viu, formatado como TRANSCRIÇÃO.
 *
 * ## Por que só o Claude tem marcador
 *
 * O marcador só se paga para quem tem memória endereçável. O Claude tem
 * `--resume`, e a sessão dele já contém tudo o que ele mesmo respondeu. O agy é
 * um tiro só, sem memória nenhuma. O opencode tem sessão por pasta, mas ela não
 * é endereçável nem consultável: não dá para perguntar o que ela já contém.
 *
 * Manter três marcadores quando só um serve seria arquitetura fingindo. Para os
 * outros dois o delta é a conversa inteira, sempre, com teto.
 *
 * ## Por que o delta do Claude não inclui os turnos dele
 *
 * Eles já estão na sessão retomada. Incluí-los faria ele reler o que já sabe, e
 * pagar por isso duas vezes.
 *
 * ## Por que a transcrição diz quem falou
 *
 * Colado como texto corrido, o outro agente lê a resposta do Claude como se
 * fosse ordem do Felipe. A última linha existe pelo mesmo motivo: em
 * `promptEnriquecimento` já se mediu o modelo tratar o prefixo como turno de
 * conversa em vez de instrução.
 */
export function deltaPara(id, agente) {
  const c = lerConversa(id)
  if (!c) return null

  const temSessao = Boolean(c.cabecalho.sessoes?.[agente])
  const marcador = agente === 'claude' && temSessao ? (c.cabecalho.marcadores?.claude || 0) : 0

  let usadas = c.mensagens.filter((m) => (m.seq || 0) > marcador)
  if (agente === 'claude' && temSessao) usadas = usadas.filter((m) => m.de !== 'claude')
  /* Turno que não terminou não entra: meia resposta como contexto é pior que
     nenhuma, porque o agente seguinte a trata como conclusão. */
  usadas = usadas.filter((m) => m.de === 'felipe' || m.de === 'sistema' || m.estado === 'pronto')

  const linhaDe = (m) => {
    if (m.de === 'felipe') return `[Felipe] ${m.texto}`
    if (m.de === 'sistema') return `[o painel] ${m.texto}`
    return `[${m.de} respondeu] ${m.texto}`
  }

  let corpo = usadas.map(linhaDe).join('\n\n')
  let cortadas = 0
  /* Corta os mais VELHOS, nunca os recentes: o que ele acabou de dizer é o que
     mais importa. E o corte se declara, sempre. Truncar calado é a família de
     defeito que este projeto mais paga. */
  while (corpo.length > GATE_MAX_DELTA && usadas.length > 1) {
    usadas = usadas.slice(1)
    cortadas++
    corpo = usadas.map(linhaDe).join('\n\n')
  }

  const aviso = cortadas ? `[${cortadas} mensagem(ns) anterior(es) omitida(s) por tamanho]\n\n` : ''
  const rodape = '\n\n--- Responda a ÚLTIMA mensagem do Felipe. O que está acima é o histórico. ---'

  return {
    texto: aviso + corpo + rodape,
    ate: c.ultimoSeq,
    mensagens: usadas.length,
    cortadas,
    primeiraVez: !temSessao,
  }
}

/**
 * Guarda a última cota conhecida do plano, colhida da resposta do Claude.
 *
 * Fica no cabeçalho da conversa, e não num arquivo global, por um motivo
 * medido: a leitura global do painel grava numa pasta que o sandbox tranca e
 * falha calada, e foi por isso que a barra de uso nunca teve dado nesta VPS.
 * Aqui o dado chega junto da resposta e é gravado no mesmo lugar que ela.
 *
 * Guarda `em` junto: cota é o estado de um instante, e sem a idade dela um
 * número velho posa de atual. O painel inteiro já pagou por esse erro.
 */
export function guardarCota(id, cota) {
  if (!cota || !cota.estado) return null
  return gravarCabecalho(id, { cota: { ...cota, em: agora() } })
}

/**
 * Marca até onde este agente leu. Só roda quando o turno fecha em `pronto`:
 * turno que falhou não leu nada, e marcar ali faria o agente perder para sempre
 * o que ele nunca chegou a ver.
 */
export function marcarLido(id, agente, seq) {
  const cab = lerCabecalho(id)
  if (!cab) return null
  return gravarCabecalho(id, { marcadores: { ...(cab.marcadores || {}), [agente]: seq } })
}

/**
 * A sessão nativa do agente sumiu, e o marcador passou a mentir.
 *
 * O CLI poda sessão velha, e a pasta é efêmera. Com o marcador em 40 e a sessão
 * perdida, o agente receberia um delta minúsculo achando que já sabe as 40
 * anteriores. Zerar aqui faz o próximo delta ser a conversa inteira.
 *
 * Escreve um evento visível de propósito: reinício calado é como o dado parece
 * sumir.
 */
export function esquecerSessao(id, agente, motivo = 'a sessão anterior não existe mais') {
  const cab = lerCabecalho(id)
  if (!cab) return null
  const sessoes = { ...(cab.sessoes || {}) }; delete sessoes[agente]
  const marcadores = { ...(cab.marcadores || {}) }; delete marcadores[agente]
  gravarCabecalho(id, { sessoes, marcadores })
  acrescentar(id, { tipo: 'sistema', texto: `Comecei uma conversa nova com o ${agente}: ${motivo}. Mandei o histórico inteiro de novo.` })
  return lerCabecalho(id)
}

/* ============================ a lista ============================ */

/** As conversas dos dois lugares, sem duplicar, mais recente primeiro. */
export function listar({ arquivadas = false } = {}) {
  const vistos = new Set()
  const fora = []
  for (const dir of DIRS()) {
    let nomes = []
    try { nomes = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && !n.endsWith('.tmp.json')) } catch { continue }
    for (const n of nomes) {
      const id = n.slice(0, -5)
      if (vistos.has(id)) continue
      const cab = lerCabecalhoDe(dir, id)
      if (!cab) continue
      vistos.add(id)
      if (cab.arquivada && !arquivadas) continue
      fora.push({ ...cab, id, _onde: dir, _abrigo: dir !== DIR_CASA() })
    }
  }
  return fora.sort((a, b) => (b.mexidaEm || 0) - (a.mexidaEm || 0))
}

/**
 * Apaga uma conversa dos dois lugares onde ela pode estar.
 *
 * Devolve o que apagou, e devolve vazio quando não achou nada: "apaguei" sem
 * ter apagado é a mentira mais fácil de contar aqui, porque some justamente o
 * que se usaria para conferir.
 */
export function remover(id) {
  const foi = []
  for (const dir of DIRS()) {
    const { cab, log } = arquivosDe(dir, id)
    for (const arq of [cab, log, `${cab}.tmp`]) {
      try {
        if (fs.existsSync(arq)) { fs.rmSync(arq); foi.push(arq) }
      } catch { /* segue: o outro lugar ainda pode ter */ }
    }
  }
  return { removidos: foi, achou: foi.length > 0 }
}

/** A conversa daquele projeto, se já existir. Uma por projeto, como ele pediu. */
export function doProjeto(projeto) {
  return listar().find((c) => c.projeto === projeto) || null
}

/* ============================ o conserto na subida ============================ */

/**
 * Fecha os turnos que ficaram órfãos quando o painel reiniciou.
 *
 * O filho morre junto com o painel por causa do cgroup do systemd, e isso não
 * tem conserto sem root. Então NÃO prometemos que a resposta continua chegando.
 * O que se promete, e é verdade, é que o que chegou está salvo e que a tela vai
 * dizer até onde foi.
 *
 * Sem isto, o cabeçalho ficaria com `estado.turnoId` para sempre, a fila
 * pareceria ocupada, e ele nunca mais conseguiria mandar mensagem naquela
 * conversa.
 */
export function reconciliar({ vivo = () => false } = {}) {
  const consertadas = []
  for (const cab of listar({ arquivadas: true })) {
    const t = cab.estado?.turnoId
    if (!t) continue
    if (cab.estado?.pid && vivo(cab.estado.pid)) continue
    acrescentar(cab.id, {
      tipo: 'fim', turnoId: t, estado: 'interrompido',
      erro: 'o painel reiniciou antes de esta resposta terminar',
    })
    acrescentar(cab.id, {
      tipo: 'sistema',
      texto: 'O painel reiniciou e esta resposta parou no meio. O que chegou está salvo. Pedir de novo é barato, porque a conversa é retomada.',
    })
    gravarCabecalho(cab.id, { estado: null })
    consertadas.push(cab.id)
  }
  return consertadas
}
