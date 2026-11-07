/**
 * CC-1069, item 5: revisar o pedido COM ELE antes de agir.
 *
 * Módulo sem efeito ao ser importado. Duas metades:
 *  - `abrir` (UserPromptSubmit, chamada de dentro do `anonimo-prompt.mjs`): se a
 *    mensagem dele pede ação e é grande, fala de robô/ligar/apagar ou traz vários
 *    pedidos, grava uma pendência por sessão e injeta a instrução de abrir com a
 *    caixa de escolha.
 *  - `barrar` (PreToolUse, chamada de dentro do `modelo-guard.mjs`): com pendência
 *    aberta, recusa ferramenta que muda coisa. Destrava quando o transcrito tem um
 *    AskUserQuestion respondido com "É isso" depois da mensagem dele.
 *
 * Não vale no `claude -p` (sdk-cli): robô não tem quem responda a caixa.
 * CC-1070: ordem curta ("commit") também dispara. Pergunta pura, comando de barra
 * e "ok"/"valeu" não.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { norm, segmentos } from './autonomia.mjs'

const pendencia = (home, sessao) => path.join(home, '.local', 'share', 'agent-cockpit', 'confere', `${String(sessao).replace(/[^\w-]/g, '_')}.json`)

// CC-1070, peça 0: todo pedido de ação abre a conferência, inclusive ordem curta ("commit", "manda ver").
// Ficam de fora: pergunta pura, comando de barra e resposta/agradecimento sem pedido.
const SEM_PEDIDO = /^(ok|okay|sim|nao|n|s|valeu|obrigad[oa]|isso|isso mesmo|certo|beleza|blz|show|perfeito|entendi|legal|boa|top|opa|oi|ola|bom dia|boa tarde|boa noite)[.! ]*$/

export function deveConferir(prompt) {
  const t = String(prompt || '').trim()
  if (t.length < 2 || t.startsWith('/') || t.startsWith('<')) return false
  if (t.endsWith('?')) return false // pergunta não é ação
  return !SEM_PEDIDO.test(norm(t))
}

export const CONTEXTO = '[confere-pedido] Antes de qualquer ação, a PRIMEIRA ferramenta é a caixa de escolha (AskUserQuestion) com: '
  + 'o pedido dele em uma frase com as palavras dele; o que VAI ser feito; o que NÃO vai ser feito; quando para. '
  + 'Opções: "É isso" e "Não é isso". Edição, escrita, ajudante, agendamento e comando que muda coisa ficam recusados até ele responder "É isso".'

/** Abre (ou limpa) a pendência. Devolve o texto a injetar, ou null. */
export function abrir(dados, { home = os.homedir(), env = process.env } = {}) {
  const sessao = dados?.session_id
  if (!sessao) return null
  const f = pendencia(home, sessao)
  try { fs.rmSync(f, { force: true }) } catch { /* nada a limpar */ }
  if (env.CLAUDE_CODE_ENTRYPOINT === 'sdk-cli' || !deveConferir(dados?.prompt)) return null
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, JSON.stringify({ pendente: true, desde: new Date().toISOString() }))
  } catch { return null }
  return CONTEXTO
}

const LEITURA = new Set(['ls', 'cat', 'grep', 'rg', 'head', 'tail', 'wc', 'pwd', 'echo', 'date', 'stat', 'file', 'which', 'jq',
  'sort', 'uniq', 'cut', 'tr', 'diff', 'du', 'df', 'ps', 'sleep', 'true', 'printenv', 'basename', 'dirname', 'readlink',
  'realpath', 'tree', 'journalctl', 'pgrep', 'id', 'whoami', 'test', '[', 'cd'])
const GIT_LEITURA = /^git\s+(?:-C\s+\S+\s+)?(status|log|diff|show|branch|rev-parse|remote|ls-files|blame|describe|config\s+--get)\b/
const CC_LEITURA = /\b(json|estado|fila|list|status|presenca|cobertura)\s*$/

function segmentoMuda(seg) {
  const semRedir = seg.replace(/\d*>\s*&\d+/g, '').replace(/\d*>>?\s*\/dev\/null/g, '')
  if (/>/.test(semRedir)) return true
  const w = seg.split(/\s+/)[0]
  if (w === 'find') return /\s-(delete|exec|execdir|ok)\b/.test(seg)
  if (w === 'git') return !GIT_LEITURA.test(seg)
  if (w === 'node') return !(/^node\s+--check\b/.test(seg) || (/\bcc\.mjs\b/.test(seg) && CC_LEITURA.test(seg)))
  if (w === 'cc' || w === 'cockpit') return !CC_LEITURA.test(seg)
  if (w === 'systemctl') return !/\b(status|list-\w+|is-active|is-enabled|show|cat)\b/.test(seg)
  if (w === 'tmux') return !/^tmux\s+(ls|list-\w+|capture-pane|display-message|has-session)\b/.test(seg)
  if (w === 'curl') return /\s(-X\s*\w+|-d|--data\S*|-F|-T|--upload-file)\b/.test(seg) && !/-X\s*GET\b/.test(seg)
  return !LEITURA.has(w)
}

export const muda = (comando) => segmentos(comando).some(segmentoMuda)

const BARRADAS = new Set(['Edit', 'Write', 'NotebookEdit', 'Agent', 'Task', 'CronCreate', 'ScheduleWakeup'])

function aprovado(arquivo) {
  let linhas
  try { linhas = fs.readFileSync(arquivo, 'utf8').slice(-600_000).split('\n') } catch { return false }
  const objs = linhas.map((l) => { try { return JSON.parse(l) } catch { return null } })
  // o turno dele: tudo depois da última fala real (texto, sem resultado de ferramenta nem injeção)
  let inicio = 0
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i]
    if (o?.type !== 'user' || o.toolUseResult || o.isMeta) continue
    const c = o.message?.content
    const texto = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p?.type === 'text').map((p) => p.text).join(' ') : ''
    if (texto.trim() && !texto.trim().startsWith('<')) { inicio = i; break }
  }
  const ids = new Set()
  for (const o of objs.slice(inicio)) {
    const c = o?.message?.content
    if (!Array.isArray(c)) continue
    for (const p of c) {
      if (p?.type === 'tool_use' && p.name === 'AskUserQuestion') ids.add(p.id)
      if (p?.type === 'tool_result' && ids.has(p.tool_use_id)) {
        const respostas = o.toolUseResult?.answers
          ? Object.values(o.toolUseResult.answers).map(String)
          : [...String(typeof p.content === 'string' ? p.content : JSON.stringify(p.content)).matchAll(/"([^"]*)"="([^"]*)"/g)].map((m) => m[2])
        if (respostas.some((r) => /^e isso\b/.test(norm(r).trim()))) return true
      }
    }
  }
  return false
}

/** Motivo do bloqueio, ou null. */
export function barrar(dados, { home = os.homedir() } = {}) {
  const sessao = dados?.session_id
  const nome = dados?.tool_name
  if (!sessao) return null
  const comando = nome === 'Bash' ? String(dados?.tool_input?.command || '') : ''
  if (!(BARRADAS.has(nome) || (nome === 'Bash' && comando && muda(comando)))) return null
  const f = pendencia(home, sessao)
  if (!fs.existsSync(f)) return null
  if (aprovado(dados?.transcript_path || dados?.transcriptPath)) { try { fs.rmSync(f, { force: true }) } catch { /* já saiu */ } return null }
  return '[confere-pedido] Pedido dele ainda sem conferência. Abra a caixa de escolha (AskUserQuestion) com: o pedido em uma frase, '
    + 'o que vai ser feito, o que não vai, quando para; opções "É isso" e "Não é isso". Depois do "É isso" esta ferramenta libera.'
}
