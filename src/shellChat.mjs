// CC-1061: terminal da VPS em forma de chat. Uma sessao tmux viva ('cc-shell'), um comando por vez.
// O comando vai por `send-keys -l` (literal), nunca por shell montado no Node. Ver docs/CC-1061.md.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const exec = promisify(execFile)
const TETO = 64 * 1024
const TECLAS = { 'ctrl-c': 'C-c', tab: 'Tab', cima: 'Up', baixo: 'Down', esc: 'Escape', enter: 'Enter' }
const nome = () => process.env.CC_SHELL_SESSAO || 'cc-shell'
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

// tmux sem shell; TMUX removido para funcionar mesmo se o painel nasceu dentro de outro tmux
async function tmux(...args) {
  const env = { ...process.env }
  delete env.TMUX
  const { stdout } = await exec('tmux', args, { env, timeout: 10000, maxBuffer: 16 * 1024 * 1024 })
  return stdout
}

async function vivo() {
  try { await tmux('has-session', '-t', '=' + nome()); return true } catch { return false }
}

async function garantir() {
  if (await vivo()) return
  await tmux('new-session', '-d', '-s', nome(), '-c', join(homedir(), 'projetos'), '-x', '200', '-y', '50', 'bash', '-l')
  await dormir(400)
}

const alvo = () => '=' + nome() + ':'

async function pasta() {
  try { return (await tmux('display', '-p', '-t', alvo(), '#{pane_current_path}')).trim() } catch { return null }
}

// ---- tela cheia ----
const TELA_CHEIA = new Set(['vim', 'vi', 'nvim', 'nano', 'emacs', 'top', 'htop', 'btop', 'man', 'watch'])
export function ehTelaCheia(comando) {
  for (const seg of String(comando).split(/[|;&]+/)) {
    let p = seg.trim().split(/\s+/).filter(Boolean)
    while (p[0] === 'sudo' || p[0] === 'env') p.shift()
    const [c, ...resto] = p
    if (!c) continue
    const base = c.split('/').pop()
    if (TELA_CHEIA.has(base)) return true
    if (base === 'less' && !resto.some((a) => /^-[a-zA-Z]*F/.test(a))) return true
    if (base === 'tmux' && /^(attach|a|at|attach-session)$/.test(resto[0] || '')) return true
    if (base === 'ssh' && resto.filter((a) => !a.startsWith('-')).length === 1) return true
  }
  return false
}

// ---- prompt ----
const SENHA = /(\[sudo\] )?(password|senha|passphrase)[^\n]*:\s*$/i
const RESPOSTA = /\[[yYsSnN]\/[yYsSnN]\]|\([yYsSnN]\/[yYsSnN]\)|continu\w*\s*\?\s*$|\bproceed\s*\?\s*$/
export function detectarPrompt(saida) {
  const ult = String(saida).split('\n').map((l) => l.trimEnd()).filter(Boolean).pop() || ''
  if (SENHA.test(ult)) return 'senha'
  if (RESPOSTA.test(ult)) return 'resposta'
  return null
}

// ---- recentes ----
function arquivoRecentes() {
  return process.env.CC_HOME
    ? join(process.env.CC_HOME, 'abrigo', 'shell-recentes.json')
    : join(process.env.HOME || homedir(), '.local', 'share', 'agent-cockpit', 'shell-recentes.json')
}
export function recentes() {
  try { const l = JSON.parse(readFileSync(arquivoRecentes(), 'utf8')); return Array.isArray(l) ? l : [] } catch { return [] }
}
function guardarRecente(cmd) {
  const l = recentes()
  if (l[0] === cmd) return
  const novo = [cmd, ...l].slice(0, 20)
  try { mkdirSync(dirname(arquivoRecentes()), { recursive: true }); writeFileSync(arquivoRecentes(), JSON.stringify(novo)) } catch { /* sem recentes nao e erro */ }
}

// ---- comando atual ----
let atual = null // { id, comando, terminou, codigo, saida, cortada, interrompido, inicio }

const semAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)|\x1b[()][A-Z0-9]|\r/g, '')

async function atualizar() {
  if (!atual || atual.terminou) return
  const tela = semAnsi(await tmux('capture-pane', '-p', '-J', '-t', alvo(), '-S', '-5000'))
  const linhas = tela.split('\n')
  const ini = linhas.lastIndexOf(`__CC_INI_${atual.id}__`)
  const re = new RegExp(`^__CC_FIM_${atual.id}_(\\d+)__$`)
  let fim = -1, codigo = null
  for (let i = linhas.length - 1; i > ini && i >= 0; i--) { const m = re.exec(linhas[i]); if (m) { fim = i; codigo = Number(m[1]); break } }
  const corpo = linhas.slice(ini + 1, fim >= 0 ? fim : undefined)
  let saida = corpo.join('\n').replace(/^\n+/, '').replace(/\s+$/, '')
  let cortada = false
  if (saida.length > TETO) { saida = saida.slice(-TETO); cortada = true }
  atual.saida = saida
  atual.cortada = cortada
  if (fim >= 0) { atual.terminou = true; atual.codigo = codigo; return }
  // ctrl-c aborta a lista inteira do bash: sem marca de fim, mas o shell voltou ao primeiro plano
  if (atual.interrompido && Date.now() - atual.interrompido > 300) {
    const fg = (await tmux('display', '-p', '-t', alvo(), '#{pane_current_command}')).trim()
    if (fg === 'bash') { atual.terminou = true; atual.codigo = 130 }
  }
}

export async function rodar(comando) {
  comando = String(comando ?? '').trim()
  if (!comando) return { ok: false, erro: 'comando vazio' }
  if (/[\r\n]/.test(comando)) return { ok: false, erro: 'uma linha por vez' }
  if (ehTelaCheia(comando)) return { ok: false, cheioDeTela: true }
  await garantir()
  await atualizar()
  if (atual && !atual.terminou) return { ok: false, erro: 'ainda rodando: ' + atual.comando }
  const id = randomBytes(4).toString('hex')
  atual = { id, comando, terminou: false, codigo: null, saida: '', cortada: false, interrompido: 0, inicio: Date.now() }
  guardarRecente(comando)
  const linha = `printf '\\n__CC_INI_${id}__\\n'; ${comando}; printf '\\n__CC_FIM_${id}_%s__\\n' "$?"`
  await tmux('send-keys', '-t', alvo(), '-l', '--', linha)
  await tmux('send-keys', '-t', alvo(), 'Enter')
  return { ok: true, id }
}

export async function andamento(id) {
  if (!atual || atual.id !== id) return { ok: false, erro: 'id desconhecido' }
  await atualizar()
  const p = atual.terminou ? null : detectarPrompt(atual.saida)
  return { ok: true, id, comando: atual.comando, saida: atual.saida, cortada: atual.cortada, terminou: atual.terminou, codigo: atual.codigo, pede: p, pasta: await pasta() }
}

// a senha so passa por aqui e pelo tmux: nao entra em log, arquivo nem recentes
export async function responder(texto, senha) {
  if (!(await vivo())) return { ok: false, erro: 'sem sessao' }
  await tmux('send-keys', '-t', alvo(), '-l', '--', String(texto ?? ''))
  await tmux('send-keys', '-t', alvo(), 'Enter')
  return { ok: true }
}

export async function tecla(t) {
  const k = TECLAS[t]
  if (!k) return { ok: false, erro: 'tecla desconhecida' }
  if (!(await vivo())) return { ok: false, erro: 'sem sessao' }
  if (t === 'ctrl-c' && atual && !atual.terminou) atual.interrompido = Date.now()
  await tmux('send-keys', '-t', alvo(), k)
  return { ok: true }
}

export async function estado() {
  const v = await vivo()
  if (v) await atualizar().catch(() => {})
  return { ok: true, vivo: v, pasta: v ? await pasta() : null, ocupado: !!(atual && !atual.terminou) }
}

export async function matar() { try { await tmux('kill-session', '-t', alvo().slice(0, -1)) } catch { /* ja morta */ } atual = null }
