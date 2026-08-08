// Núcleo: lê o estado dos jobs do Claude Code e devolve um modelo normalizado.
//
// CONTRATO DE SEGURANÇA: este módulo só LÊ state.json e pins.json (arquivos do
// Claude Code). A única escrita é em meta.json, arquivo novo que o Claude Code
// não conhece nem lê. Nada aqui pode quebrar o CLI.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lastPrompt, intentMatchesTranscript } from './transcript.mjs'

export const JOBS_DIR = path.join(os.homedir(), '.claude', 'jobs')

const lista = (env, padrao) =>
  String(process.env[env] || padrao).split(',').map((s) => s.trim()).filter(Boolean)

/**
 * Pastas que contêm projetos: `.../projetos/<PROJETO>/...`.
 * Ajustável por `CC_PROJECT_DIRS` — em outra máquina a pasta pode ter
 * outro nome.
 */
export const PROJECT_DIRS = lista('CC_PROJECT_DIRS', 'projetos,projects,repos,dev,code,workspace,src')

/**
 * Camada opcional de agrupamento entre a pasta de projetos e o projeto:
 * `.../projetos/<GRUPO>/<PROJETO>/...`. Quem não usa grupos não precisa
 * disso — a busca por `PROJECT_DIRS` cobre o caso comum.
 */
export const PROJECT_GROUPS = new Set(lista('CC_PROJECT_GROUPS', 'CLIENTS,PESSOAL,ESTUDO,intersec'))

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/**
 * O `meta.json` é escrito por agentes, que erram o nome do campo. Um agente
 * gravou `{t: "..."}` em vez de `{text: "..."}` e o painel exibiu "undefined"
 * com a tarefa inteira ali do lado. Aceitar as variações é mais barato que
 * esperar que todo agente acerte.
 */
export function normalizeTodo(raw) {
  if (typeof raw === 'string') return { text: raw, done: false }
  if (!raw || typeof raw !== 'object') return null
  const text = raw.text ?? raw.t ?? raw.title ?? raw.task ?? raw.label ?? raw.name ?? raw.desc
  if (text == null || String(text).trim() === '') return null
  return { text: String(text), done: Boolean(raw.done ?? raw.completed ?? raw.checked ?? raw.finished) }
}

export function normalizeLink(raw) {
  if (typeof raw === 'string') {
    const url = raw.trim()
    if (!url) return null
    // sem rótulo, o host já diz mais que a URL inteira
    let label = url
    try {
      label = new URL(url).host || url
    } catch {}
    return { label, url }
  }
  if (!raw || typeof raw !== 'object') return null
  const url = raw.url ?? raw.href ?? raw.link
  if (!url) return null
  return { label: String(raw.label ?? raw.name ?? raw.title ?? url), url: String(url) }
}

const normalizeList = (v, fn) => (Array.isArray(v) ? v.map(fn).filter(Boolean) : [])

/**
 * Deriva projeto + subprojeto a partir do caminho de trabalho.
 *
 * Três tentativas, da mais específica pra mais genérica:
 *   1. grupo conhecido    → `.../CLIENTS/<projeto>/<sub>`
 *   2. pasta de projetos  → `.../projetos/<projeto>/<sub>` (vale em qualquer máquina)
 *   3. último segmento    → `~/dev/meuapp` vira "meuapp"
 */
export function projectOf(dir) {
  if (!dir) return { project: '—', sub: null }
  const parts = dir.split(/[\\/]/).filter(Boolean)

  const g = parts.findIndex((p) => PROJECT_GROUPS.has(p))
  if (g >= 0 && parts[g + 1]) return { project: parts[g + 1], sub: parts[g + 2] ?? null }

  const d = parts.findIndex((p) => PROJECT_DIRS.includes(p.toLowerCase()))
  if (d >= 0 && parts[d + 1]) return { project: parts[d + 1], sub: parts[d + 2] ?? null }

  return { project: parts[parts.length - 1] ?? '—', sub: null }
}

/** Modelo vem dos respawnFlags (`--model opus[1m]`), não de campo próprio. */
export function modelOf(flags = []) {
  const i = flags.indexOf('--model')
  return i >= 0 && flags[i + 1] ? flags[i + 1] : 'default'
}

export function agentOf(state) {
  const flags = state.respawnFlags ?? []
  const i = flags.indexOf('--agent')
  return (i >= 0 && flags[i + 1]) || state.template || 'claude'
}

/** Rota = branch da worktree, sem o prefixo que o Claude Code adiciona. */
export function routeOf(state) {
  if (state.worktreeBranch) return state.worktreeBranch.replace(/^worktree-/, '')
  if (state.worktreePath) return path.basename(state.worktreePath)
  return 'main'
}

/** Normaliza os muitos rótulos possíveis de `state` em 5 buckets estáveis. */
export function statusOf(raw = '') {
  const s = String(raw).toLowerCase()
  if (s.includes('input') || s.includes('wait') || s.includes('block') || s.includes('ask')) return 'waiting'
  if (s.includes('fail') || s.includes('error')) return 'failed'
  if (s.includes('done') || s.includes('complete') || s.includes('finish')) return 'done'
  if (s.includes('work') || s.includes('run') || s.includes('active')) return 'working'
  if (s.includes('idle')) return 'idle'
  return raw ? String(raw) : 'unknown'
}

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s || '')

/**
 * Assunto legível, na ordem: o que o agente escreveu > nome que o Felipe deu >
 * nome automático > primeiras palavras do último pedido.
 *
 * O fallback usa o ÚLTIMO pedido, não `intent` — ver src/transcript.mjs.
 */
export function subjectOf(state, meta, last = null) {
  if (meta.subject) return meta.subject
  if (state.name && state.nameSource === 'user') return state.name
  if (state.name) return state.name
  return truncate((last || state.displayIntent || state.intent || '').replace(/\s+/g, ' '), 60)
}

export function fmtAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h${String(m % 60).padStart(2, '0')}`
  return `${Math.floor(h / 24)}d${h % 24}h`
}

export function fmtTokens(n) {
  if (!n) return '—'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

/** Um job "working" sem sinal há muito tempo provavelmente travou. */
const STALE_MS = 10 * 60 * 1000

export function buildJob(id, state, meta, pins, now) {
  const cwd = state.originCwd || state.cwd || ''
  const { project, sub } = projectOf(cwd)
  const todos = normalizeList(meta.todos, normalizeTodo)
  const created = Date.parse(state.createdAt) || now
  const updated = Date.parse(state.updatedAt) || created
  const status = statusOf(state.state)
  const pinIndex = pins.indexOf(id)

  const last = lastPrompt(state.linkScanPath)

  return {
    id,
    status,
    rawState: state.state ?? null,
    subject: subjectOf(state, meta, last),
    category: meta.category || null,
    project: meta.project || project,
    sub,
    route: meta.route || routeOf(state),
    model: modelOf(state.respawnFlags),
    agent: agentOf(state),
    tokens: state.tokens ?? 0,
    detail: meta.status || state.detail || '',
    result: state.output?.result || null,
    // `lastPrompt` é o que o usuário pediu por último, lido do transcript.
    // `intent` é o primeiro prompt e pode estar desatualizado ou até ser de
    // outra conversa — por isso só aparece quando difere, rotulado como inicial.
    lastPrompt: last,
    intent: state.displayIntent || state.intent || '',
    // false = o intent é de outra conversa; null = sem transcript pra comparar
    intentTrustworthy: intentMatchesTranscript(state.intent, state.linkScanPath),
    cwd,
    worktreePath: state.worktreePath || null,
    // `fan` guarda resíduo da última tool mesmo depois do job terminar;
    // só faz sentido mostrar enquanto ele está de fato rodando
    inFlight: status === 'working' ? (state.fan ?? []).map((f) => ({ kind: f.kind, label: f.label })) : [],
    todos,
    todosDone: todos.filter((t) => t.done).length,
    blockers: normalizeList(meta.blockers, (b) => (typeof b === 'string' ? b : b?.text ?? b?.reason ?? null)),
    links: normalizeList(meta.links, normalizeLink),
    notes: meta.notes || '',
    // Dois pins convivem: o do CLI vem de pins.json (só leitura) e o do painel
    // fica no meta.json. Fixar aqui não pode escrever no arquivo do Claude Code.
    pinned: pinIndex >= 0 || meta.pin === true,
    pinnedAqui: meta.pin === true,
    pinIndex: pinIndex >= 0 ? pinIndex : meta.pin === true ? 500 : 999,
    createdAt: created,
    updatedAt: updated,
    ageMs: now - created,
    idleMs: now - updated,
    stale: status === 'working' && now - updated > STALE_MS,
    metaUpdatedAt: Date.parse(meta.updatedAt) || null,
    sessionId: state.sessionId || null,
  }
}

const ORDER = { waiting: 0, failed: 1, working: 2, idle: 3, done: 4 }

export function readJobs(now = Date.now()) {
  let ids = []
  try {
    ids = fs.readdirSync(JOBS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  } catch {
    return []
  }
  const pins = readJson(path.join(JOBS_DIR, 'pins.json'), []) || []
  const jobs = []
  for (const id of ids) {
    const state = readJson(path.join(JOBS_DIR, id, 'state.json'), null)
    if (!state) continue // pasta sem estado ainda, ou JSON sendo escrito agora
    const meta = readJson(path.join(JOBS_DIR, id, 'meta.json'), {}) || {}
    jobs.push(buildJob(id, state, meta, Array.isArray(pins) ? pins : [], now))
  }
  jobs.sort(
    (a, b) =>
      (ORDER[a.status] ?? 5) - (ORDER[b.status] ?? 5) ||
      a.pinIndex - b.pinIndex ||
      b.updatedAt - a.updatedAt,
  )
  return jobs
}

/** Descobre o job atual pelo ambiente ($CLAUDE_JOB_DIR aponta pro subdir tmp). */
export function currentJobId() {
  const dir = process.env.CLAUDE_JOB_DIR
  if (!dir) return null
  const base = path.basename(dir)
  return base === 'tmp' ? path.basename(path.dirname(dir)) : base
}

/** Merge raso do que o agente mandou por cima do meta.json existente. */
export function mergeMeta(current, patch) {
  const next = { ...current, ...patch }
  for (const k of Object.keys(next)) if (next[k] === null) delete next[k]
  return next
}

export function writeMeta(id, patch) {
  const dir = path.join(JOBS_DIR, id)
  if (!fs.existsSync(dir)) throw new Error(`job ${id} não existe em ${JOBS_DIR}`)
  const file = path.join(dir, 'meta.json')
  const next = mergeMeta(readJson(file, {}) || {}, patch)
  next.updatedAt = new Date().toISOString()
  // escrita atômica: nunca deixa meta.json pela metade se o processo morrer
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2))
  fs.renameSync(tmp, file)
  return next
}

export function summarize(jobs) {
  const by = (s) => jobs.filter((j) => j.status === s).length
  return {
    total: jobs.length,
    working: by('working'),
    waiting: by('waiting'),
    failed: by('failed'),
    done: by('done'),
    idle: by('idle'),
    stale: jobs.filter((j) => j.stale).length,
    tokens: jobs.reduce((a, j) => a + (j.tokens || 0), 0),
    projects: [...new Set(jobs.map((j) => j.project))].sort(),
  }
}
