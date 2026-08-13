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
 * Prompt de verdade carrega `promptSource`/`origin`.
 */
function humanText(entry) {
  if (entry?.type !== 'user') return null
  if (entry.toolUseResult || entry.isMeta || entry.interruptedMessageId) return null
  const c = entry.message?.content
  const text = typeof c === 'string'
    ? c
    : Array.isArray(c)
      ? c.filter((p) => p?.type === 'text').map((p) => p.text).join(' ')
      : ''
  const trimmed = String(text || '').trim()
  // `<system-reminder>`, `<command-name>` e afins não são pedido do usuário
  if (!trimmed || trimmed.startsWith('<')) return null
  return trimmed
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
    if (t) return t
  }
  return null
}

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
  if (hit && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) return hit.prompt

  let prompt = null
  for (const bytes of TAILS) {
    let tail
    try {
      tail = readTail(file, bytes)
    } catch {
      break
    }
    prompt = scanTail(tail.text, tail.partial)
    if (prompt || !tail.partial) break // achou, ou já leu o arquivo inteiro
  }

  cache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, prompt })
  return prompt
}

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
