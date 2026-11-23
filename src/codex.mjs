/**
 * CC-1131, entregas 1 e 2 do plano docs/CC-codex.md: as sessões do Codex dentro do cockpit, para ver e responder.
 *
 * Ver: lê `~/.codex/sessions/AAAA/MM/DD/rollout-<hora>-<id>.jsonl` e `~/.codex/session_index.jsonl`, só leitura.
 * A credencial (`auth.json`) nunca é aberta: só se pergunta se o arquivo existe, para saber se esta máquina consegue
 * responder. A sessão sai no formato de `buildJob`, como as do Claude, com `tipo: 'codex'` e `ferramenta: 'codex'`.
 *
 * Chave pelo id INTEIRO. O id do Codex começa pela hora: os 8 primeiros caracteres só mudam a cada 65 s (medido em
 * 23/11), então o apelido de 8 letras que o resto do painel usa juntaria duas sessões abertas no mesmo minuto.
 *
 * Responder: `codex queue --thread <id> --message <texto> --resume`, medido em 23/11 (chega e responde em ~3 s).
 * Roda `node codex.js` direto, sem shell nenhum: o `codex.cmd` do npm repassa `%*` pelo cmd, e texto livre com aspas
 * dentro viraria comando. Pedido que falha fica guardado em `codex-pendentes.jsonl`, no abrigo.
 *
 * `CC_CODEX_HOME` aponta a casa do Codex para uma pasta de teste; sem ela, é a `.codex` ao lado da casa do Claude
 * (que já respeita `CC_HOME`). `CC_CODEX_BIN` troca o programa (o teste usa um `codex` de mentira).
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { casaClaude } from './platform.mjs'
import { buildJob } from './jobs.mjs'
import { readTail } from './transcript.mjs'
import { limparTextoRemoto, ID_CONVERSA } from './federacao.mjs'
import { dirCaixas } from './ouvido.mjs'

export const casaCodex = () => process.env.CC_CODEX_HOME || path.join(path.dirname(casaClaude()), '.codex')
const pastaSessoes = () => path.join(casaCodex(), 'sessions')

export const ID_CODEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const JANELA_MS = 24 * 60 * 60 * 1000
const CABECA_MAX = 1024 * 1024 // a primeira linha leva as instruções do sistema: ~29 KB medidos
const TAILS = [256 * 1024, 2 * 1024 * 1024]
export const TETO_RESPOSTA_MS = 20_000

const ler = (f) => { try { return JSON.parse(f) } catch { return null } }
const textoDe = (content, tipo) => (Array.isArray(content) ? content : [])
  .filter((c) => c?.type === tipo && typeof c.text === 'string').map((c) => c.text).join(' ').trim()

/* ───────────────────────────── a ficha (primeira linha) ───────────────────────────── */

const cacheCabeca = new Map() // a primeira linha nunca muda: cache eterno
export function cabecaCodex(arquivo) {
  if (cacheCabeca.has(arquivo)) return cacheCabeca.get(arquivo)
  let achado = null
  let fd = null
  try {
    fd = fs.openSync(arquivo, 'r')
    let texto = ''
    for (let pos = 0; pos < CABECA_MAX;) {
      const buf = Buffer.alloc(64 * 1024)
      const n = fs.readSync(fd, buf, 0, buf.length, pos)
      if (n <= 0) break
      pos += n
      texto += buf.subarray(0, n).toString('utf8')
      if (texto.includes('\n')) break
    }
    const o = ler(texto.split('\n')[0])
    const p = o?.type === 'session_meta' ? o.payload || {} : null
    if (p && ID_CODEX.test(String(p.id || '')) && p.cwd) {
      achado = {
        id: String(p.id), cwd: String(p.cwd), source: p.source || null, originator: p.originator || null,
        criadoEm: Date.parse(p.timestamp || o.timestamp) || null,
      }
    }
  } catch { achado = null } finally {
    if (fd !== null) { try { fs.closeSync(fd) } catch { /* já fechado */ } }
  }
  if (achado) cacheCabeca.set(arquivo, achado) // arquivo ainda sem a ficha inteira tenta de novo no próximo tique
  return achado
}

/* ───────────────────────────── o rabo (última fala, vez, uso) ───────────────────────────── */

/** Lê as linhas do fim para o começo. Falas `developer` são instrução do sistema e nunca entram. */
export function lerLinhasCodex(linhas) {
  const v = { pedido: null, pedidoEm: null, resposta: null, respostaEm: null, inicioVez: null, fimVez: null, fimTexto: null, uso: null, tokens: null, modelo: null }
  for (let i = linhas.length - 1; i >= 0; i--) {
    const o = ler(linhas[i])
    if (!o) continue
    const p = o.payload || {}
    const em = Date.parse(o.timestamp) || null
    if (o.type === 'response_item' && p.type === 'message') {
      if (p.role === 'user' && v.pedido == null) {
        const t = textoDe(p.content, 'input_text')
        if (t && !t.startsWith('<')) { v.pedido = t; v.pedidoEm = em } // `<environment_context>` é do programa, não dele
      } else if (p.role === 'assistant' && v.resposta == null) {
        const t = textoDe(p.content, 'output_text')
        if (t) { v.resposta = t; v.respostaEm = em }
      }
    } else if (o.type === 'event_msg') {
      if (p.type === 'task_started' && v.inicioVez == null) v.inicioVez = em
      else if (p.type === 'task_complete' && v.fimVez == null) { v.fimVez = em; v.fimTexto = p.last_agent_message || null }
      else if (p.type === 'token_count' && v.uso == null) {
        const r = p.rate_limits
        if (r) v.uso = { cincoHoras: r.primary?.used_percent ?? null, semana: r.secondary?.used_percent ?? null, plano: r.plan_type || null }
        if (v.tokens == null) v.tokens = p.info?.total_token_usage?.total_tokens ?? null
      }
    } else if (o.type === 'turn_context' && v.modelo == null && p.model) v.modelo = String(p.model)
  }
  if (!v.resposta && v.fimTexto) { v.resposta = v.fimTexto; v.respostaEm = v.fimVez }
  return v
}

const cacheCauda = new Map() // arquivo -> { size, mtimeMs, v }
export function caudaCodex(arquivo, st = fs.statSync(arquivo)) {
  const hit = cacheCauda.get(arquivo)
  if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return hit.v
  let v = null
  for (const bytes of TAILS) {
    let t
    try { t = readTail(arquivo, bytes) } catch { break }
    const linhas = t.text.split('\n')
    if (t.partial) linhas.shift() // a primeira linha da cauda vem cortada ao meio
    v = lerLinhasCodex(linhas)
    if ((v.pedido && v.resposta) || !t.partial) break
  }
  v = v || lerLinhasCodex([])
  cacheCauda.set(arquivo, { size: st.size, mtimeMs: st.mtimeMs, v })
  return v
}

/* ───────────────────────────── nome, estado, onde mora ───────────────────────────── */

let cacheNomes = { chave: null, mapa: new Map() }
/** `session_index.jsonl`: o nome que ele (ou o Codex) deu à sessão. Sessão de `exec` não entra nele. */
export function nomesCodex() {
  const arq = path.join(casaCodex(), 'session_index.jsonl')
  let st
  try { st = fs.statSync(arq) } catch { return new Map() }
  const chave = `${arq}:${st.size}:${st.mtimeMs}`
  if (cacheNomes.chave === chave) return cacheNomes.mapa
  const mapa = new Map()
  try {
    for (const l of fs.readFileSync(arq, 'utf8').split('\n')) {
      const o = ler(l)
      if (o?.id && o.thread_name) mapa.set(String(o.id), String(o.thread_name).slice(0, 120))
    }
  } catch { /* sem nome: o assunto cai no último pedido */ }
  cacheNomes = { chave, mapa }
  return mapa
}

/**
 * Estado da sessão, no vocabulário dos jobs. Vez aberta (`task_started` depois do último `task_complete`) com o
 * arquivo mexido há menos de 10 min está trabalhando; mais que isso, o programa caiu no meio e ela está parada.
 * Vez fechada há menos de 30 min espera ele; depois disso, ociosa.
 */
export function estadoCodex(v, idadeMs) {
  const emVez = v?.inicioVez && (!v.fimVez || v.inicioVez > v.fimVez)
  if (emVez) return idadeMs < 10 * 60_000 ? 'working' : 'idle'
  if (idadeMs < 60_000 && !v?.fimVez) return 'working'
  return idadeMs < 30 * 60_000 ? 'waiting' : 'idle'
}

const filhos = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] } }

/** As pastas de dia (AAAA/MM/DD) a partir de `desde`, mais novas primeiro. Sem `desde`, todas. */
function pastasDeDia(desde = 0) {
  const limite = desde ? new Date(desde - 864e5).toISOString().slice(0, 10) : '' // um dia de folga para o fuso
  const out = []
  for (const a of filhos(pastaSessoes()).filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))) {
    for (const m of filhos(path.join(pastaSessoes(), a.name)).filter((d) => d.isDirectory() && /^\d{2}$/.test(d.name))) {
      for (const d of filhos(path.join(pastaSessoes(), a.name, m.name)).filter((x) => x.isDirectory() && /^\d{2}$/.test(x.name))) {
        const dia = `${a.name}-${m.name}-${d.name}`
        if (dia >= limite) out.push({ dia, dir: path.join(pastaSessoes(), a.name, m.name, d.name) })
      }
    }
  }
  return out.sort((x, y) => (x.dia < y.dia ? 1 : -1))
}

const idDoArquivo = (nome) => /^rollout-.+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(nome)?.[1] || null

/** O arquivo da sessão do Codex com este id INTEIRO, nesta máquina. Prefixo não vale (ver o topo). */
export function arquivoCodex(id) {
  const alvo = String(id || '').toLowerCase()
  if (!ID_CODEX.test(alvo)) return null
  for (const { dir } of pastasDeDia()) {
    const f = filhos(dir).find((d) => d.isFile() && idDoArquivo(d.name)?.toLowerCase() === alvo)
    if (f) return path.join(dir, f.name)
  }
  return null
}

/* ───────────────────────────── o programa ───────────────────────────── */

let cacheBin = { em: 0, bin: null }
/**
 * O programa que responde. No Windows, o `codex.js` do pacote npm, rodado pelo Node (ver o topo). Fora dele, o
 * `codex` do PATH, chamado direto, também sem shell. `null` quando não há.
 */
export function binarioCodex(agora = Date.now()) {
  if (process.env.CC_CODEX_BIN) return fs.existsSync(process.env.CC_CODEX_BIN) ? process.env.CC_CODEX_BIN : null
  if (agora - cacheBin.em < 60_000) return cacheBin.bin
  let bin = null
  for (const dir of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const js = path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
    if (fs.existsSync(js)) { bin = js; break }
    if (process.platform !== 'win32' && fs.existsSync(path.join(dir, 'codex'))) { bin = path.join(dir, 'codex'); break }
  }
  cacheBin = { em: agora, bin }
  return bin
}

/** Esta máquina consegue responder ao Codex? O programa existe e a credencial também (só se pergunta se o arquivo existe). */
export const codexResponde = () => Boolean(binarioCodex()) && fs.existsSync(path.join(casaCodex(), 'auth.json'))

/* ───────────────────────────── as sessões ───────────────────────────── */

export function readCodex(now = Date.now(), { janelaMs = JANELA_MS } = {}) {
  const nomes = nomesCodex()
  const responde = codexResponde()
  const travas = path.join(casaCodex(), 'thread-writer-locks')
  const out = []
  for (const { dir } of pastasDeDia(now - janelaMs)) {
    for (const d of filhos(dir)) {
      if (!d.isFile() || !idDoArquivo(d.name)) continue
      const arquivo = path.join(dir, d.name)
      let st
      try { st = fs.statSync(arquivo) } catch { continue }
      if (now - st.mtimeMs > janelaMs) continue
      const cab = cabecaCodex(arquivo)
      if (!cab) continue
      const v = caudaCodex(arquivo, st)
      const idade = now - st.mtimeMs
      const state = {
        sessionId: cab.id, cwd: cab.cwd, template: 'codex',
        createdAt: new Date(cab.criadoEm || st.mtimeMs).toISOString(),
        updatedAt: new Date(st.mtimeMs).toISOString(),
        state: estadoCodex(v, idade), fan: [], tokens: v.tokens ?? 0,
        name: nomes.get(cab.id) || null, displayIntent: v.pedido || '',
        respawnFlags: v.modelo ? ['--model', v.modelo] : [],
      }
      const job = buildJob(cab.id, state, {}, [], now)
      out.push({
        ...job,
        tipo: 'codex', ferramenta: 'codex', origemCodex: cab.source || cab.originator || null,
        lastPrompt: v.pedido, semPromptPorque: v.pedido ? null : 'ninguem-escreveu', promptConfirmado: Boolean(v.pedido),
        ultima: v.resposta ? { de: 'codex', texto: v.resposta, em: v.respostaEm ? new Date(v.respostaEm).toISOString() : null } : null,
        usoCodex: v.uso,
        // A trava existe enquanto alguém escreve na sessão. Sem ela não se sabe: `undefined`, nunca "fechada".
        aberta: fs.existsSync(path.join(travas, `${cab.id}.lock`)) ? true : undefined,
        permissao: false, porPrograma: false, remoto: false, appUrl: null,
        codexResponde: responde, transcript: null, arquivoCodex: arquivo,
      })
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

/* ───────────────────────────── responder ───────────────────────────── */

const arquivoPendentes = () => path.join(path.dirname(dirCaixas()), 'codex-pendentes.jsonl')

/** Pedido que não chegou fica guardado, com o motivo. Nunca lança: guardar é a rede, não o pedido. */
function guardarPendente(conversa, texto, erro) {
  try {
    const arq = arquivoPendentes()
    fs.mkdirSync(path.dirname(arq), { recursive: true })
    let antes = []
    try { antes = fs.readFileSync(arq, 'utf8').split('\n').filter(Boolean) } catch { /* primeira vez */ }
    antes.push(JSON.stringify({ em: new Date().toISOString(), conversa, texto, erro }))
    fs.writeFileSync(arq, antes.slice(-50).join('\n') + '\n')
    return true
  } catch { return false }
}

/**
 * Manda o texto para a sessão do Codex, pelo `codex queue --resume`. Devolve `{ ok, entregue: 'codex' }` ou
 * `{ ok: false, erro }` em palavras comuns, com o pedido guardado.
 */
export function responderCodex(conversa, texto, { timeoutMs = TETO_RESPOSTA_MS, bin = binarioCodex() } = {}) {
  const id = String(conversa || '')
  const limpo = limparTextoRemoto(texto)
  if (!ID_CODEX.test(id) || !ID_CONVERSA.test(id)) return Promise.resolve({ ok: false, erro: 'conversa do Codex inválida' })
  if (!limpo) return Promise.resolve({ ok: false, erro: 'mensagem sem texto' })
  const falhou = (motivo) => {
    const guardado = guardarPendente(id, limpo, motivo)
    return { ok: false, erro: motivo + (guardado ? '; o pedido ficou guardado' : ''), pendente: guardado }
  }
  if (!bin) return Promise.resolve(falhou('o programa do Codex não está instalado nesta máquina'))
  // `=` junto do valor: texto que comece com "-" não vira opção do Codex
  const args = ['queue', `--thread=${id}`, `--message=${limpo}`, '--resume']
  const [cmd, todos] = /\.(c|m)?js$/i.test(bin) ? [process.execPath, [bin, ...args]] : [bin, args]
  return new Promise((resolve) => {
    execFile(cmd, todos, { timeout: timeoutMs, windowsHide: true, maxBuffer: 256 * 1024 }, (err, stdout, stderr) => {
      if (!err) return resolve({ ok: true, entregue: 'codex', aviso: String(stdout || '').trim().split('\n')[0].slice(0, 200) || null })
      if (err.killed || err.signal === 'SIGTERM') return resolve(falhou(`o Codex não respondeu em ${Math.round(timeoutMs / 1000)} s`))
      if (err.code === 'ENOENT') return resolve(falhou('o programa do Codex não está instalado nesta máquina'))
      const linha = String(stderr || stdout || err.message || '').trim().split('\n').filter(Boolean).pop() || 'sem motivo dito'
      return resolve(falhou('o Codex recusou a mensagem: ' + linha.slice(0, 200)))
    })
  })
}
