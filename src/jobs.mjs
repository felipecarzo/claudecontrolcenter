// Núcleo: lê o estado dos jobs do Claude Code e devolve um modelo normalizado.
//
// CONTRATO DE SEGURANÇA: este módulo só LÊ state.json e pins.json (arquivos do
// Claude Code). A única escrita é em meta.json, arquivo novo que o Claude Code
// não conhece nem lê. Nada aqui pode quebrar o CLI.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lastPrompt, porQueSemPrompt, origemConfirmada, intentMatchesTranscript, humanMessagesTail } from './transcript.mjs'
import { sinaisDe } from './sinais.mjs'
import { arquivoExistenteDe, arquivoMetaDe, gravarMetaSessao, PROJETOS_DIR, sessaoAtual, transcritoDe } from './metaSessao.mjs'
import { casaClaude } from './platform.mjs'

/* `casaClaude()` e não `os.homedir()`, desde 18/08. Sem isso não havia como
   testar nada que dependa de job: montar um job de mentira exigiria escrever
   dentro do `~/.claude/jobs` de verdade, que é a pasta do Claude Code e a única
   que este projeto promete nunca sujar. A trava "to-do aberto trava a entrega"
   ficou sem teste por causa disso, e era justamente uma que estava quebrada.
   Sem `CC_HOME` o caminho é exatamente o mesmo de antes. */
export const JOBS_DIR = path.join(casaClaude(), 'jobs')

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
/**
 * `dono` responde "quem faz isso": o agente ou o Felipe.
 *
 * Pedido dele em 14/08: "onde ficam as minhas tarefas? a gente tem que criar
 * uma forma de eu identificar o que são as tarefas em andamento por IA e as
 * tarefas em andamento minhas". São coisas que a IA não pode fazer sozinha —
 * cortar um asset, logar uma conta, autorizar sudo, decidir entre dois
 * caminhos.
 *
 * O padrão é `ia`, e é de propósito: todo `meta.json` que já existe foi escrito
 * por agente descrevendo o próprio trabalho. Mudar o padrão reclassificaria o
 * histórico inteiro de uma vez.
 */
export const DONOS = ['ia', 'felipe']
export const donoDe = (raw) => {
  const bruto = String(raw?.dono ?? raw?.owner ?? raw?.quem ?? '').trim().toLowerCase()
  if (bruto === 'felipe' || bruto === 'humano' || bruto === 'user' || bruto === 'voce') return 'felipe'
  return 'ia'
}

export function normalizeTodo(raw) {
  // string solta cai no caminho normal, senão ela sai sem os campos que o
  // objeto ganha — foi assim que o `dono` nasceu inconsistente em 14/08
  if (typeof raw === 'string') raw = { text: raw }
  if (!raw || typeof raw !== 'object') return null
  const text = raw.text ?? raw.t ?? raw.title ?? raw.task ?? raw.label ?? raw.name ?? raw.desc
  if (text == null || String(text).trim() === '') return null
  return {
    text: String(text),
    done: Boolean(raw.done ?? raw.completed ?? raw.checked ?? raw.finished),
    dono: donoDe(raw),
    /* CC-97, a definição de pronto por tarefa.
       `pronto` é escrito ANTES ("como se sabe que acabou") e `prova` DEPOIS
       ("o que rodou, e o que apareceu"). Os dois são opcionais para não quebrar
       o meta.json de quem já reporta — o `pronto-guard` é que cobra.

       São campos separados de propósito: juntar num só faria a promessa e o
       resultado terem a mesma cara, e é justamente a diferença entre eles que o
       Felipe não consegue auditar hoje. */
    pronto: raw.pronto ? String(raw.pronto).slice(0, 400) : null,
    prova: raw.prova ? String(raw.prova).slice(0, 600) : null,
    // o código estável da tarefa, atribuído na mesclagem e nunca reciclado
    codigo: raw.codigo ? String(raw.codigo).slice(0, 12) : null,
    /* Precisa do olho DELE, ou é técnica?
       Decisão dele em 17/08, ao escolher o que revisar: "só o que eu vejo e
       uso, porém é bom eu ter acesso à revisão se precisar". O agente declara
       ao reportar: `olho: true` para o que muda tela, texto ou comportamento
       que ele usa; ausente ou false é técnica, que ele alcança quando quiser
       mas não é cobrado a olhar. */
    olho: raw.olho === true,
    /* CC-114: dependência POR TAREFA, escrita no próprio texto, do jeito que
       ele já escreve no backlog: "depende da s03", "depende do CC-112_s02".
       Campo derivado, nunca digitado: reescrever a lista não o perde porque
       ele nasce do texto de novo a cada leitura. */
    dependeDe: (String(text).match(/depende\s+d[aeo]s?\s+`?(s\d+|[A-Z]{2,4}-\d+(?:_s\d+)?)`?/i) || [])[1] || null,
    /* CC-99: a revisão mora aqui, não no chat.
       Pedido dele em 16/08: "a revisao seja anotada, apontada e revisada nesse
       local, que seria o backlog". Hoje eu aponto um defeito na conversa e ele
       some na fita — quem chega depois não sabe o que já foi olhado.

       Uma lista, não um campo: uma tarefa pode ser revisada mais de uma vez, e
       sobrescrever apagaria a primeira rodada. Cada entrada tem quem apontou, o
       que apontou e o que foi respondido. */
    revisoes: Array.isArray(raw.revisoes)
      ? raw.revisoes.slice(-10).map(normalizeRevisao).filter(Boolean)
      : [],
  }
}

/** Uma rodada de revisão. `respondeu` fica nulo até alguém responder. */
function normalizeRevisao(r) {
  if (typeof r === 'string') r = { apontou: r }
  if (!r || typeof r !== 'object') return null
  const apontou = String(r.apontou ?? r.texto ?? r.nota ?? '').trim()
  if (!apontou) return null
  return {
    quem: String(r.quem || 'felipe').slice(0, 40),
    apontou: apontou.slice(0, 600),
    respondeu: r.respondeu ? String(r.respondeu).slice(0, 600) : null,
    em: r.em || null,
  }
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

/** Sinal mais novo que isto significa que o agente está VIVO, não terminado. */
export const VIVO_MS = 2 * 60 * 1000

/**
 * O status que o painel mostra, que não é o `state` cru do Claude Code.
 *
 * Motivo: o CLI marca `done` ao fim de CADA turno, não ao fim da tarefa. Um
 * agente que acabou de responder e está esperando o Felipe aparecia como
 * "pronto" — e ele relatou justamente isso: "estava com todos os agentes
 * trabalhando e aqui dizia que estava tudo pronto".
 *
 * O que separa terminado de vivo é o SINAL: job encerrado para de atualizar o
 * `updatedAt`. Vivo com ferramenta rodando está trabalhando; vivo sem
 * ferramenta acabou de responder e a bola está com o Felipe.
 */
export function statusReal(state, idadeMs, emFerramenta) {
  const bruto = statusOf(state.state)
  if (bruto !== 'done' || idadeMs >= VIVO_MS) return bruto
  return emFerramenta ? 'working' : 'waiting'
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
  const emFerramenta = (state.fan ?? []).length > 0
  const status = statusReal(state, now - updated, emFerramenta)
  const pinIndex = pins.indexOf(id)

  const last = lastPrompt(state.linkScanPath)
  // CC-41: rajada/repetição, dos padrões medidos no ciclo Felipe -> IA -> Felipe.
  const sinais = sinaisDe(humanMessagesTail(state.linkScanPath), { agora: now })

  return {
    id,
    status,
    rawState: state.state ?? null,
    subject: subjectOf(state, meta, last),
    /* CC-221: quem escreveu esse assunto. Sem isto, o texto que o painel
       preenche sozinho com o último pedido dele fica IDÊNTICO na tela a um
       resumo que o agente escreveu, e não havia como saber que catorze dos
       dezesseis agentes não tinham anotado nada. */
    subjectDoAgente: Boolean(String(meta.subject || '').trim()),
    subjectEm: meta.subjectEm || null,
    category: meta.category || null,
    project: meta.project || project,
    sub,
    route: meta.route || routeOf(state),
    // Frente do ROADMAP.md do projeto, declarada pelo agente. É o que liga o
    // cartão ao mapa e faz o assunto parar de ser texto solto.
    frente: meta.frente || meta.front || null,
    model: modelOf(state.respawnFlags),
    agent: agentOf(state),
    tokens: state.tokens ?? 0,
    detail: meta.status || state.detail || '',
    result: state.output?.result || null,
    // `lastPrompt` é o que o usuário pediu por último, lido do transcript.
    // `intent` é o primeiro prompt e pode estar desatualizado ou até ser de
    // outra conversa — por isso só aparece quando difere, rotulado como inicial.
    lastPrompt: last,
    /* Por que não há pedido, quando não há: `ninguem-escreveu` (a sessão foi
       retomada sozinha e ele não digitou nada) ou `nao-consegui-ler`. Sem
       isto a tela dizia a mesma frase para os dois, e um deles é falha. */
    semPromptPorque: last ? null : porQueSemPrompt(state.linkScanPath),
    /* O texto prova ter sido digitado por uma pessoa? `false` não acusa
       falsidade: diz que o arquivo não trouxe a marca, e a tela mostra essa
       dúvida em vez de afirmar que foi ele quem escreveu. É a rede para o
       marcador de sistema que ainda não existe. */
    promptConfirmado: last ? origemConfirmada(state.linkScanPath) : null,
    intent: state.displayIntent || state.intent || '',
    // false = o intent é de outra conversa; null = sem transcript pra comparar
    intentTrustworthy: intentMatchesTranscript(state.intent, state.linkScanPath),
    sinais,
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
    // Precificação: nível corrigido à mão e tempo estimado pelo Felipe, ambos
    // por texto da tarefa. Chave é o texto e não o índice porque a lista é
    // reescrita inteira pelo agente, e o índice de hoje é outra tarefa amanhã.
    niveis: meta.niveis && typeof meta.niveis === 'object' ? meta.niveis : {},
    estimativas: meta.estimativas && typeof meta.estimativas === 'object' ? meta.estimativas : {},
    feitoEm: meta.feitoEm && typeof meta.feitoEm === 'object' ? meta.feitoEm : {},
    // CC-36: {titulo, resumo, arquivo} por texto de to-do, escrito pelo opencode
    explicacoes: meta.explicacoes && typeof meta.explicacoes === 'object' ? meta.explicacoes : {},
    // Entregou dizendo pronto e deixou tarefa aberta: ou esqueceu de marcar, ou
    // a lista está errada. Nos dois casos a métrica sai suja, e é isso que a
    // tela precisa mostrar em vez de somar como se estivesse tudo certo.
    entregueEmAberto: status === 'done' && todos.length > 0 && todos.every((t) => !t.done),
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
/**
 * Quem sou eu, para reportar estado.
 *
 * Job de background traz `CLAUDE_JOB_DIR`. Sessão interativa (Remote Control,
 * terminal) não tem job nenhum, e traz `CLAUDE_CODE_SESSION_ID` — que é o nome
 * do arquivo de transcrito, conferido nesta VPS. Antes só o primeiro contava, e
 * era por isso que `cc set` recusava com "sem job" em tudo que não fosse
 * background (CC-56).
 */
export function currentJobId() {
  const dir = process.env.CLAUDE_JOB_DIR
  if (dir) {
    const base = path.basename(dir)
    return base === 'tmp' ? path.basename(path.dirname(dir)) : base
  }
  return sessaoAtual()
}

/** Merge raso do que o agente mandou por cima do meta.json existente. */
/**
 * Registra a hora em que cada tarefa virou concluída, num mapa por texto.
 *
 * Fora da lista de to-dos de propósito: o agente reescreve `todos` inteiro a
 * cada `cc set`, então um campo dentro do item seria apagado na chamada
 * seguinte. Com isto, a precificação deixa de ratear o tempo por igual — mas
 * só para o que for concluído daqui em diante; o passado não tem essa marca.
 */
export function marcarConclusoes(current, patch, agora = new Date().toISOString()) {
  if (!Array.isArray(patch.todos)) return current.feitoEm || null
  const antes = new Map()
  for (const t of current.todos || []) {
    if (t && typeof t === 'object' && t.text) antes.set(t.text, !!t.done)
  }
  const feitoEm = { ...(current.feitoEm || {}) }
  for (const t of patch.todos) {
    const texto = t && typeof t === 'object' ? t.text : t
    if (!texto || !(t && typeof t === 'object' && t.done)) continue
    if (antes.get(texto) === true) continue // já estava feita: mantém o carimbo
    feitoEm[texto] = agora
  }
  // Tarefa que sumiu da lista leva o carimbo junto, senão o mapa cresce sem fim
  const vivos = new Set(patch.todos.map((t) => (t && typeof t === 'object' ? t.text : t)))
  for (const k of Object.keys(feitoEm)) if (!vivos.has(k)) delete feitoEm[k]
  return Object.keys(feitoEm).length ? feitoEm : null
}

/**
 * Cada tarefa nasce com um código próprio, e ele nunca muda.
 *
 * ## O defeito que isto fecha, achado por ele em 17/08
 *
 * A tela numerava as tarefas na hora de desenhar: `S1` era só "a primeira da
 * lista". Fechava uma, todas as outras mudavam de número. *"o que são essas
 * tarefas S? elas não dizem nada c nada"*.
 *
 * ## Como o código sobrevive
 *
 * O agente reescreve `todos` inteiro a cada reporte, então o código não pode
 * viver só no item — viveria uma escrita. A cada mesclagem, a tarefa NOVA
 * ganha o próximo número do contador do job (`seqTarefa`, que só cresce), e a
 * tarefa que já existia recupera o seu pelo texto, igual ao carimbo de
 * conclusão faz. Número nunca é reaproveitado: reciclar faria uma conversa
 * antiga apontar para a coisa errada.
 *
 * O formato de exibição é dele: `produto10_sprint01`. Aqui, `s01`, `s02`, e a
 * tela junta com o código do item de backlog quando a frente casa
 * (`CC-104_s01`) ou com a sigla do projeto quando não casa.
 */
function numerarTarefas(current, patch) {
  if (!Array.isArray(patch.todos)) return null
  const antigos = new Map()
  for (const t of current.todos || []) {
    if (t && typeof t === 'object' && t.text && t.codigo) antigos.set(t.text, t.codigo)
  }
  let seq = Number(current.seqTarefa) || antigos.size
  const todos = patch.todos.map((t) => {
    const obj = typeof t === 'string' ? { text: t } : { ...t }
    if (!obj.text) return t
    obj.codigo = antigos.get(obj.text) || `s${String((seq += 1)).padStart(2, '0')}`
    return obj
  })
  return { todos, seqTarefa: seq }
}

export function mergeMeta(current, patch) {
  const feitoEm = marcarConclusoes(current, patch)
  const numerado = numerarTarefas(current, patch)
  const next = { ...current, ...patch, ...(numerado || {}) }
  if (feitoEm) next.feitoEm = feitoEm
  for (const k of Object.keys(next)) if (next[k] === null) delete next[k]
  return next
}

/** O `status` que o agente escreveu — não o `state` do CLI, que é outra coisa. */
export function metaStatus(id) {
  return (readJson(path.join(JOBS_DIR, id, 'meta.json'), {}) || {}).status || null
}

/**
 * Fecha um to-do sem reenviar a lista inteira.
 *
 * Existe porque `todos` substitui, e reenviar tudo a cada item fechado é o
 * atrito que fazia o agente adiar — e adiar virou nunca: em 2026-08-08, cinco
 * jobs entregues tinham 0 de 34 tarefas marcadas.
 *
 * Casa por texto, sem exigir igualdade exata: o agente costuma abreviar ou
 * corrigir acento na hora de fechar. Ambiguidade não é resolvida no chute —
 * dois candidatos devolvem erro pedindo mais texto.
 */
export function marcarTodo(id, texto, done = true, { prova = null } = {}) {
  const alvo = String(texto || '').trim().toLowerCase()
  if (!alvo) throw new Error('diga qual tarefa fechar')
  // mesmo caminho do writeMeta: job de background ou sessão interativa
  const onde = caminhoDoEstado(id)
  const meta = onde ? (readJson(onde.file, {}) || {}) : {}
  const lista = Array.isArray(meta.todos) ? meta.todos.map(normalizeTodo).filter(Boolean) : []
  if (!lista.length) throw new Error('este agente não tem to-dos no meta.json')

  // Sem acento e sem caixa: "icone proprio" tem que casar com "ícone próprio"
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const a = norm(alvo)
  const exatos = lista.filter((t) => norm(t.text) === a)
  const parciais = exatos.length ? exatos : lista.filter((t) => norm(t.text).includes(a) || a.includes(norm(t.text)))
  if (!parciais.length) {
    throw new Error(`nenhum to-do parecido com "${texto}". Abertos: ${
      lista.filter((t) => !t.done).map((t) => `"${t.text}"`).join(', ') || 'nenhum'}`)
  }
  if (parciais.length > 1) {
    throw new Error(`"${texto}" casa com ${parciais.length}: ${parciais.map((t) => `"${t.text}"`).join(', ')}`)
  }

  const escolhido = parciais[0]
  /* CC-97: a prova entra ao FECHAR, que é quando ela existe. Reabrir uma tarefa
     apaga a prova junto — ela era de um fecho que deixou de valer, e manter
     seria dizer que algo foi verificado quando não foi. */
  const todos = lista.map((t) => (t.text === escolhido.text
    ? { ...t, done, prova: done ? (prova || t.prova) : null }
    : t))
  return { meta: writeMeta(id, { todos }), tarefa: escolhido.text, done, prova: prova || null }
}

/**
 * CC-99 — registra uma revisão numa tarefa, ou responde a última em aberto.
 *
 * Pedido dele em 16/08: *"a revisao seja anotada, apontada e revisada nesse
 * local, que seria o backlog"*. Hoje eu aponto um defeito no chat e ele some na
 * fita: quem chega depois não sabe o que já foi olhado nem o que ficou de pé.
 *
 * `--apontou` abre uma rodada. `--respondeu` fecha a última aberta, em vez de
 * criar outra — responder criando entrada nova deixaria a pergunta órfã e a
 * resposta sem contexto, que é exatamente o problema do chat.
 */
export function revisarTodo(id, texto, { apontou = null, respondeu = null, quem = 'felipe', quando = null } = {}) {
  if (!apontou && !respondeu) throw new Error('diga o que foi apontado (--apontou) ou respondido (--respondeu)')
  const onde = caminhoDoEstado(id)
  const meta = onde ? (readJson(onde.file, {}) || {}) : {}
  const lista = Array.isArray(meta.todos) ? meta.todos.map(normalizeTodo).filter(Boolean) : []
  if (!lista.length) throw new Error('este agente não tem to-dos no meta.json')

  const norm = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const a = norm(String(texto || '').trim())
  if (!a) throw new Error('diga qual tarefa revisar')
  const achados = lista.filter((t) => norm(t.text).includes(a) || a.includes(norm(t.text)))
  if (!achados.length) throw new Error(`nenhum to-do parecido com "${texto}"`)
  if (achados.length > 1) throw new Error(`"${texto}" casa com ${achados.length}: ${achados.map((t) => `"${t.text}"`).join(', ')}`)

  const alvo = achados[0]
  const em = quando || new Date().toISOString()
  let revisoes = [...(alvo.revisoes || [])]

  if (apontou) {
    revisoes.push({ quem, apontou, respondeu: null, em })
  } else {
    // responde a ÚLTIMA em aberto; sem nenhuma, a resposta não tem a que se ligar
    const i = revisoes.map((r) => !r.respondeu).lastIndexOf(true)
    if (i < 0) throw new Error('não há revisão em aberto nesta tarefa para responder')
    revisoes[i] = { ...revisoes[i], respondeu, respondidoEm: em }
  }

  const todos = lista.map((t) => (t.text === alvo.text ? { ...t, revisoes } : t))
  return { meta: writeMeta(id, { todos }), tarefa: alvo.text, revisoes }
}

/**
 * Onde o estado daquele id mora. Duas casas, e a escolha não é preferência:
 *
 * - **job de background**: `~/.claude/jobs/<id>/meta.json`, arquivo que o CLI
 *   não conhece, dentro de uma pasta que ele criou;
 * - **sessão interativa** (CC-56): `<casa>/control-center-sessoes/<id>.json`,
 *   do lado de fora. Sessão interativa não tem pasta em `jobs/`, e criar uma
 *   seria escrever dentro da casa do Claude Code — o que a regra de ouro deste
 *   projeto proíbe.
 *
 * Exigir que o alvo exista (pasta do job, ou transcrito da sessão) é o que
 * impede um `--job` digitado errado de criar estado órfão para sempre.
 */
export function caminhoDoEstado(id) {
  const dir = path.join(JOBS_DIR, id)
  if (fs.existsSync(dir)) return { tipo: 'job', file: path.join(dir, 'meta.json') }

  // O painel mostra a sessão pelos 8 primeiros caracteres; quem chama de fora
  // pode passar o curto, então aceita os dois.
  /* CC-157: o `file` de leitura é onde o reporte ESTÁ (casa ou abrigo), não
     onde ele idealmente moraria. Sem isso, uma sessão que caiu no abrigo
     leria `{}` da casa e cada `cc set` apagaria o que o anterior gravou. */
  const completo = transcritoDe(id) ? id : acharSessaoPorPrefixo(id)
  if (completo) {
    return { tipo: 'sessao', id: completo, file: arquivoExistenteDe(completo) || arquivoMetaDe(completo) }
  }

  return null
}

function acharSessaoPorPrefixo(curto) {
  if (!curto || curto.length < 6) return null
  try {
    for (const d of fs.readdirSync(PROJETOS_DIR(), { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const pasta = path.join(PROJETOS_DIR(), d.name)
      const achado = fs.readdirSync(pasta)
        .find((f) => f.endsWith('.jsonl') && f.startsWith(curto))
      if (achado) return path.basename(achado, '.jsonl')
    }
  } catch { /* sem pasta de transcritos: não é sessão */ }
  return null
}

export function writeMeta(id, patch) {
  const alvo = caminhoDoEstado(id)
  if (!alvo) {
    throw new Error(
      `não achei ${id}: não é job em ${JOBS_DIR} nem sessão com transcrito`,
    )
  }
  const anterior = readJson(alvo.file, {}) || {}
  const next = mergeMeta(anterior, patch)
  next.updatedAt = new Date().toISOString()

  /* CC-221: quando este assunto foi escrito.
   *
   * Ele perguntou o que GARANTE que o agente sempre anote, e a resposta medida
   * é: nada garante enquanto ninguém consegue ver que não anotou. Em 20/08,
   * dos 16 agentes no painel, DOIS tinham assunto escrito pelo agente. Os
   * outros catorze caíam no texto cru que ele digitou, e na tela isso é
   * indistinguível de um assunto de verdade.
   *
   * Só a existência do campo não basta: escrito uma vez às 9h, ele descreve às
   * 22h um trabalho que acabou de manhã. Com a hora carimbada dá para comparar
   * com o último pedido dele e cobrar o que está velho, em vez de cobrar o que
   * está vazio. É a diferença entre "você anotou?" e "isso ainda é verdade?".
   *
   * Fica FORA do que o agente manda, de propósito. Ele reescreve o `meta`
   * inteiro a cada chamada, e carimbo dentro do texto seria apagado na
   * seguinte, do mesmo jeito que já acontecia com o `feitoEm` das tarefas. */
  const assuntoNovo = String(patch?.subject || '').trim()
  if (assuntoNovo && assuntoNovo !== String(anterior.subject || '').trim()) {
    next.subjectEm = next.updatedAt
  }

  /* CC-157, achado em 19/08: dentro do sandbox do Claude Code a pasta
     `~/.claude` fica somente leitura, e TODA sessão perdia a capacidade de
     reportar. O sintoma era o pior possível, porque não parecia erro: o
     painel simplesmente não mostrava a sessão, e quem olhava concluía que o
     agente estava trabalhando por fora do sistema inteiro.

     Ele perguntou o que GARANTE que não aconteça de novo, e avisar não
     garante, porque aviso depende de alguém ler. O que garante é ter para
     onde ir: sessão cai no abrigo (`gravarMetaSessao` tenta os dois lugares,
     e a leitura olha os dois). Job de background continua com um caminho só,
     porque a pasta dele é do CLI e inventar um segundo lugar para ela
     quebraria a regra de ouro do projeto. */
  if (alvo.tipo === 'sessao') return gravarMetaSessao(alvo.id, next)

  // escrita atômica: nunca deixa o arquivo pela metade se o processo morrer
  const tmp = `${alvo.file}.tmp`
  fs.mkdirSync(path.dirname(alvo.file), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2))
  fs.renameSync(tmp, alvo.file)
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
