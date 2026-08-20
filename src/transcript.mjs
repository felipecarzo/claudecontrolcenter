// Último pedido de verdade, lido do transcript da sessão.
//
// Por que não usar `state.intent`: ele guarda o PRIMEIRO prompt e nunca é
// atualizado — sessão longa que mudou de assunto mostra pedido velho. Pior, em
// job respawnado o campo já apareceu com prompt de outra conversa
// (492627c0: intent "pq nao ta trocando o modelo?" numa sessão de auditoria de
// rotas). O transcript é nomeado pelo sessionId, então não tem como misturar.
//
// Transcript passa de 25 MB. Lê-se só a cauda, e só quando o arquivo cresce.

import fs from 'node:fs'

const TAILS = [256 * 1024, 2 * 1024 * 1024] // tenta pequeno; só cresce se não achar
const cache = new Map() // path -> { size, mtimeMs, prompt }

function readTail(file, bytes) {
  const fd = fs.openSync(file, 'r')
  try {
    const { size } = fs.fstatSync(fd)
    const len = Math.min(bytes, size)
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, size - len)
    return { text: buf.toString('utf8'), partial: len < size }
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * Mensagem digitada por uma pessoa.
 *
 * O transcript grava como `user` muita coisa que o usuário não escreveu. Os
 * marcadores do CLI separam sem heurística:
 *   - `toolUseResult`        saída de ferramenta
 *   - `isMeta`               injeção de skill/comando (traz o SKILL.md inteiro)
 *   - `interruptedMessageId` o aviso de "Request interrupted by user"
 *   - `isCompactSummary`     o resumo que o CLI injeta quando o contexto estoura
 *   - `isSidechain`          conversa de sub-agente, não do usuário
 * Prompt de verdade carrega `promptSource`/`origin`.
 *
 * O `isCompactSummary` entrou em 20/08, achado por ele: *"me explique essa
 * zona de ultimos pedidos (…) e estao em ingles, porque?"*. Não era idioma, e
 * a pergunta certa era outra: o painel mostrava como pedido dele o texto que
 * o CLI injeta ao resumir a conversa, que começa com "This session is being
 * continued from a previous conversation that ran out of context". Sessão
 * longa é justamente a que mais aparece no painel, então o cartão mais
 * importante era o que mais mentia.
 */
function humanText(entry) {
  if (entry?.type !== 'user') return null
  if (entry.toolUseResult || entry.isMeta || entry.interruptedMessageId) return null
  if (entry.isCompactSummary || entry.isSidechain) return null
  const c = entry.message?.content
  const text = typeof c === 'string'
    ? c
    : Array.isArray(c)
      ? c.filter((p) => p?.type === 'text').map((p) => p.text).join(' ')
      : ''
  const trimmed = String(text || '').trim()
  // `<system-reminder>`, `<command-name>` e afins não são pedido do usuário
  if (!trimmed || trimmed.startsWith('<')) return null
  /* Comando de barra SOZINHO é operação da ferramenta, não instrução de
     trabalho: `/compact` no cartão não diz o que o agente está fazendo, e
     empurra para fora o pedido de verdade que veio antes dele. Com texto
     junto (`/fecha e sobe pra VPS`) continua valendo, porque aí ele mandou
     alguma coisa. */
  if (/^\/[a-z][\w-]*$/i.test(trimmed)) return null
  /* O aviso de interrupção às vezes vem SEM `interruptedMessageId`, e aí
     escapava do marcador. Achado em 20/08 varrendo os 266 transcritos da
     máquina: 37 mensagens passavam sem marca de humano, e estas estavam
     entre elas. */
  if (/^\[Request interrupted by user/i.test(trimmed)) return null
  return trimmed
}

/**
 * A entrada prova que veio de uma pessoa?
 *
 * `promptSource`/`origin` são os campos que o CLI põe no que o usuário digita.
 * Medido nos 266 transcritos da máquina em 20/08: de 2253 mensagens que o
 * filtro aceita, 2216 trazem a marca e 37 não.
 *
 * Serve para a tela poder dizer quando não tem certeza da origem do texto.
 */
export function veioDePessoa(entry) {
  return Boolean(entry?.promptSource || entry?.origin)
}

function scanLines(text, { dropFirst = false, dropLast = false, fromEnd = true } = {}) {
  const lines = text.split('\n')
  if (dropFirst) lines.shift() // cauda: a primeira linha vem cortada ao meio
  if (dropLast) lines.pop() // cabeça: a última linha vem cortada ao meio
  const order = fromEnd ? [...lines.keys()].reverse() : [...lines.keys()]
  for (const i of order) {
    const line = lines[i].trim()
    if (!line || !line.includes('"user"')) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    const t = humanText(entry)
    /* Junto com o texto vai se ele PROVA ter vindo de uma pessoa. Quem chama
       decide o que fazer com a dúvida; aqui só se registra o que o arquivo
       diz. */
    if (t) { ultimaOrigemConfirmada = veioDePessoa(entry); return t }
  }
  return null
}

/* Origem da última linha que `scanLines` aceitou. Fica fora do retorno para
   não mudar a assinatura, que é usada em quatro lugares. */
let ultimaOrigemConfirmada = false

const scanTail = (text, dropFirst) => scanLines(text, { dropFirst, fromEnd: true })

/** Último prompt humano da sessão, ou null se o transcript não estiver acessível. */
export function lastPrompt(file) {
  if (!file) return null
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    return null
  }
  const hit = cache.get(file)
  if (hit && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) {
    origemOk.set(file, hit.origemConfirmada)
    return hit.prompt
  }

  let prompt = null
  let leuTudo = false
  ultimaOrigemConfirmada = false
  for (const bytes of TAILS) {
    let tail
    try {
      tail = readTail(file, bytes)
    } catch {
      break
    }
    prompt = scanTail(tail.text, tail.partial)
    leuTudo = !tail.partial
    if (prompt || leuTudo) break // achou, ou já leu o arquivo inteiro
  }

  /* "Não consegui ler" e "li tudo e não há pedido de pessoa nenhuma" viravam
     o mesmo `null`, e a tela dizia a mesma coisa para os dois. São estados
     diferentes: o primeiro é falha, o segundo é fato. Sessão retomada
     automaticamente ("Continue from where you left off") é o caso real que
     mostrou isso: 2216 linhas no arquivo e nenhuma escrita por ele. */
  motivo.set(file, prompt ? null : (leuTudo ? 'ninguem-escreveu' : 'nao-consegui-ler'))
  origemOk.set(file, ultimaOrigemConfirmada)
  cache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, prompt, origemConfirmada: ultimaOrigemConfirmada })
  return prompt
}

const motivo = new Map()
const origemOk = new Map()

/**
 * O último pedido lido prova ter sido digitado por uma pessoa?
 *
 * `false` não quer dizer que é falso: quer dizer que o arquivo não traz a
 * marca, e a tela precisa poder mostrar essa diferença. É o que responde a
 * pergunta dele de 20/08, *"como garantimos que isso nao vai acontecer
 * mais?"*, para o marcador que ainda não existe.
 */
export const origemConfirmada = (file) => Boolean(origemOk.get(file))

/**
 * Por que não há último pedido, quando não há.
 *   `ninguem-escreveu`  a sessão existe e ninguém digitou nada nela
 *   `nao-consegui-ler`  o arquivo não abriu, ou o pedido está além do que foi lido
 * Só vale depois de `lastPrompt(file)` no mesmo arquivo.
 */
export const porQueSemPrompt = (file) => motivo.get(file) || null

const firstCache = new Map() // o começo do arquivo nunca muda: cache eterno

/**
 * Primeiro prompt humano da sessão. Serve pra saber se `state.intent` é
 * confiável — quando não bate, o campo veio de outra conversa.
 */
export function firstPrompt(file) {
  if (!file) return null
  if (firstCache.has(file)) return firstCache.get(file)
  let prompt = null
  try {
    const fd = fs.openSync(file, 'r')
    try {
      const { size } = fs.fstatSync(fd)
      const len = Math.min(TAILS[0], size)
      const buf = Buffer.alloc(len)
      fs.readSync(fd, buf, 0, len, 0)
      prompt = scanLines(buf.toString('utf8'), { dropLast: len < size, fromEnd: false })
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    prompt = null
  }
  firstCache.set(file, prompt)
  return prompt
}

/** O `intent` do state.json corresponde ao começo desta sessão? */
export function intentMatchesTranscript(intent, file) {
  const first = firstPrompt(file)
  if (!intent || !first) return null // sem como julgar
  const norm = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 60)
  return norm(intent) === norm(first)
}

const tailCache = new Map() // path -> { size, mtimeMs, mensagens }

/**
 * CC-41: as últimas mensagens humanas com timestamp, pra detectar rajada e
 * repetição — `lastPrompt` só devolve uma, sem hora. Só a cauda (janela curta
 * é o que importa aqui), ordenado do mais antigo pro mais novo.
 *
 * Cache por tamanho+mtime, mesmo padrão de `lastPrompt`: isto é chamado a
 * cada job em cada tique de 2s, e sem cache reeleria o arquivo toda vez
 * mesmo sem nada de novo escrito.
 */
export function humanMessagesTail(file, { bytes = TAILS[0] } = {}) {
  if (!file) return []
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    return []
  }
  const hit = tailCache.get(file)
  if (hit && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) return hit.mensagens

  let tail
  try {
    tail = readTail(file, bytes)
  } catch {
    return []
  }
  const lines = tail.text.split('\n')
  if (tail.partial) lines.shift() // primeira linha da cauda vem cortada ao meio
  const out = []
  for (const line of lines) {
    const l = line.trim()
    if (!l || !l.includes('"user"')) continue
    let entry
    try {
      entry = JSON.parse(l)
    } catch {
      continue
    }
    const t = humanText(entry)
    const em = entry.timestamp ? Date.parse(entry.timestamp) : NaN
    if (t && Number.isFinite(em)) out.push({ texto: t, em })
  }
  tailCache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, mensagens: out })
  return out
}

export const _internals = { humanText, scanTail, scanLines }
