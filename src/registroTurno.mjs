/**
 * CC-1070, peça 1: o registro independente do turno.
 *
 * Lê o transcrito da sessão (só a cauda) e devolve o que o turno FEZ de verdade,
 * do último pedido real dele até agora, sem depender do que a resposta diz.
 * Quem usa: `hooks/confere-omissao.mjs` (cobra o que ficou de fora do texto),
 * `src/conferente.mjs` (entrega o feito ao conferente) e a rota `/api/registro`
 * (o bloco "O que a sessão fez de verdade" na conversa).
 *
 * Reusa, sem copiar: o filtro de mensagem humana de `transcript.mjs`, o
 * classificador de Bash que muda coisa de `confere-pedido.mjs` e os detectores de
 * derrubar/ligar de `autonomia.mjs`.
 *
 * O registro gravado vive em ~/.local/share/agent-cockpit/registro/ (nunca em
 * ~/.claude, que é somente leitura no sandbox).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readTail, _internals } from './transcript.mjs'
import { muda } from '../hooks/confere-pedido.mjs'
import { segmentos, norm, derruba, ligaAutomatico } from '../hooks/autonomia.mjs'
import { nascimento } from '../hooks/teto-robo.mjs'

const trunc = (s, n) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t }
const ESCRITA = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const RUIDO_EXIT1 = new Set(['grep', 'rg', 'diff', 'test', '[', 'pgrep', 'cmp', 'find'])
const TESTE_CMD = /^(?:node|npm|pnpm|npx|bash|sh)\b.*\btest/i
const FALHA_TESTE = /✗|\bFAIL\b|falhou|não passou|nao passou|AssertionError/i
const COMUM = new Set(['node', 'npm', 'pnpm', 'npx', 'git', 'bash', 'sh', 'cat', 'ls', 'grep', 'rg', 'curl', 'echo', 'cd', 'sleep',
  'python', 'python3', 'claude', 'timeout', 'env', 'head', 'tail', 'sed', 'awk', 'find', 'test', 'systemctl', 'tmux'])

const textoDe = (c) => (typeof c === 'string' ? c
  : Array.isArray(c) ? c.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('\n') : '')

/** Nomes que identificam um comando no texto: arquivos citados, ou o programa se não for um dos comuns. */
export function termosDe(comando) {
  const palavras = String(comando || '').trim().split(/\s+/)
  const nomes = []
  for (const w of palavras) {
    const x = w.replace(/^['"]|['"]$/g, '')
    if (/\.(mjs|js|ts|sh|json|md|html|py)$/.test(x)) nomes.push(path.basename(x))
  }
  const primeiro = palavras[0] || ''
  if (!nomes.length && primeiro.length >= 3 && !COMUM.has(primeiro)) nomes.push(primeiro)
  return [...new Set(nomes)]
}

function ligaSystemctl(seg) {
  const m = seg.match(/^systemctl\b.*?\b(start|enable|restart|reenable)\b(.*)$/)
  if (!m) return null
  const unidades = m[2].split(/\s+/).filter((a) => a && !a.startsWith('-'))
  return { rotulo: `systemctl ${m[1]} ${unidades.join(' ')}`.trim(), alvos: unidades.map((u) => u.replace(/\.(service|timer|socket)$/, '')) }
}

/* CC-1073: o que faltava para a conferência por ação de risco (derrubar e ligar já vêm de autonomia.mjs). */
const GIT = '^git(?:\\s+-[Cc]\\s+\\S+|\\s+--[\\w-]+(?:=\\S+)?)*\\s+'
const gitSub = (seg, sub) => new RegExp(`${GIT}${sub}\\b`).test(seg)
const EXECUTA = /^(?:(?:node|bash|sh|npm|pnpm|npx|vercel|cc|cockpit)\b|\.{0,2}\/\S+)/
const BANCO = /^(?:psql|mysql|mariadb|sqlite3?|sqlcmd|supabase|docker|ssh)\b/
/** Tira o que embrulha o comando de verdade (timeout 60, nohup, do/then de laço). */
const desembrulha = (seg) => seg.replace(/^(?:(?:do|then|else)\s+|timeout\s+\S+\s+|nohup\s+|time\s+)+/, '')

/** O que, neste segmento, apaga. Devolve o rótulo ou null. */
export function apaga(seg) {
  const s = desembrulha(seg)
  if (/^(?:rm|rmdir|unlink)\b/.test(s)) return trunc(s, 80)
  if (gitSub(s, 'reset') && /\s--hard\b/.test(s)) return trunc(s, 80)
  if (gitSub(s, 'branch') && /\s-D\b/.test(s)) return trunc(s, 80)
  if (gitSub(s, 'push') && /\s(?:--force(?:-with-lease)?(?:=\S*)?|-f)(?:\s|$)/.test(s)) return `push forçado: ${trunc(s, 70)}`
  if (BANCO.test(s) && /\bdrop\s+(?:table|database|schema|index|view|column)\b/i.test(s)) return trunc(s, 80)
  return null
}

/** O que, neste segmento, commita ou publica. Devolve o rótulo ou null. */
export function publica(seg) {
  const s = desembrulha(seg)
  if (gitSub(s, 'commit')) return 'git commit'
  if (gitSub(s, 'push') && !/\s(?:--dry-run|-n)(?:\s|$)/.test(s)) return trunc(s, 80)
  if (EXECUTA.test(s) && !/\s--check\b/.test(s) && /(?:^|[\s/])deploy(?:[\s.-]|$)/.test(s)) return `deploy: ${trunc(s, 70)}`
  return null
}

/** Ação de risco do turno, lida do registro (nunca da fala): lista de rótulos, vazia se não houve. */
export function riscoDoRegistro(reg) {
  const grupos = [['derrubou', 'derrubou'], ['ligou', 'ligou'], ['apagou', 'apagou'], ['enviou', 'enviou arquivo'], ['commitou', 'commitou ou publicou']]
  /* Ajudante (Agent) e agendamento (CronCreate, ScheduleWakeup) sozinhos NÃO contam: já passam por travas que barram
     antes de rodar, e chamar o modelo neles repete o trabalho e gasta crédito (decisão dele em 28/10: 18 turnos de 111
     em vez de 29). Ficam no registro, para a cobrança de omissão. */
  const PROPRIO = /^(?:Agent\b|CronCreate$|ScheduleWakeup$)/
  return grupos.flatMap(([campo, verbo]) => (reg?.[campo] || [])
    .filter((x) => !(campo === 'ligou' && PROPRIO.test(String(x.rotulo || ''))))
    .map((x) => `${verbo}: ${x.rotulo}`))
}

/* CC-1071: o `parada.mjs` roda vários ganchos no mesmo processo, e cada um pedia o registro (lê e interpreta até
   768 KB de transcrito). Uma memória de uma entrada, pela chave arquivo+tamanho+mtime, faz a segunda leitura custar zero. */
let memoria = null
/** O que o turno fez, lido do transcrito. Nunca lança: arquivo ilegível devolve registro vazio. */
export function registroDoTurno(arquivo) {
  let chave = null
  try { const st = fs.statSync(arquivo); chave = `${arquivo}|${st.size}|${st.mtimeMs}` } catch { /* sem arquivo: calcula e devolve vazio */ }
  if (chave && memoria?.chave === chave) return memoria.reg
  const reg = calcularRegistro(arquivo)
  if (chave) memoria = { chave, reg }
  return reg
}

function calcularRegistro(arquivo) {
  const vazio = { pedido: null, pedidoEm: null, caixas: [], mudou: [], erros: [], testesFalhos: [], derrubou: [], ligou: [], apagou: [], enviou: [], commitou: [], modelos: [], saidas: '' }
  /* Cauda pequena primeiro; só cresce se o pedido dele não estiver nela (turno longo). */
  let entradas = []
  let ini = -1
  for (const bytes of [768 * 1024, 4 * 1024 * 1024, 16 * 1024 * 1024]) {
    let leitura
    try { leitura = readTail(arquivo, bytes) } catch { return vazio }
    const linhas = leitura.text.split('\n')
    if (leitura.partial) linhas.shift() // a primeira linha da cauda vem cortada ao meio
    entradas = []
    for (const l of linhas) { if (!l.trim()) continue; try { entradas.push(JSON.parse(l)) } catch { /* linha ruim */ } }
    ini = -1
    for (let i = entradas.length - 1; i >= 0; i--) if (_internals.humanText(entradas[i])) { ini = i; break }
    if (ini >= 0 || !leitura.partial) break
  }
  const turno = entradas.slice(ini + 1)
  const reg = { ...vazio, pedido: ini >= 0 ? _internals.humanText(entradas[ini]) : null, pedidoEm: ini >= 0 ? entradas[ini].timestamp || null : null }

  const usos = new Map()
  const modelos = new Set()
  const saidas = []
  for (const e of turno) {
    if (e?.isSidechain) continue
    const c = e?.message?.content
    if (e.type === 'assistant') {
      const m = e.message?.model
      if (m && !String(m).startsWith('<')) modelos.add(m)
      if (!Array.isArray(c)) continue
      for (const p of c) {
        if (p?.type !== 'tool_use') continue
        const nome = p.name
        const entrada = p.input || {}
        const comando = nome === 'Bash' ? String(entrada.command || '') : ''
        usos.set(p.id, { nome, comando, alvo: comando || entrada.file_path || entrada.notebook_path || entrada.description || '' })
        if (ESCRITA.has(nome)) reg.mudou.push({ tipo: nome, alvo: String(entrada.file_path || entrada.notebook_path || '') })
        else if (nome === 'Agent' || nome === 'Task') reg.ligou.push({ rotulo: `Agent ${trunc(entrada.description || '', 60)}`.trim(), alvos: ['agente', 'ajudante', 'subagente', 'agent'] })
        else if (nome === 'SendUserFile') reg.enviou.push({ rotulo: `SendUserFile ${trunc([].concat(entrada.files || entrada.file_path || []).map((f) => path.basename(String(f))).join(', '), 60)}`.trim() })
        else if (nome === 'CronCreate' || nome === 'ScheduleWakeup') reg.ligou.push({ rotulo: nome, alvos: ['cron', 'agend', 'lembrete', 'despertador', 'wakeup'] })
        else if (nome === 'Bash' && comando) {
          if (muda(comando)) reg.mudou.push({ tipo: 'Bash', alvo: trunc(comando, 200) })
          for (const seg of segmentos(comando)) {
            const ds = derruba(seg)
            for (const d of ds) reg.derrubou.push({ rotulo: d.rotulo, alvos: d.alvos.filter(Boolean) })
            if (!ds.length && /^(?:kill|pkill|killall)\b/.test(seg)) reg.derrubou.push({ rotulo: trunc(seg, 80), alvos: seg.split(/\s+/).slice(1).filter((a) => !a.startsWith('-') && !/^\$?\(/.test(a)) })
            const ap = apaga(seg)
            if (ap) reg.apagou.push({ rotulo: ap })
            const pu = publica(seg)
            if (pu) reg.commitou.push({ rotulo: pu })
            const auto = ligaAutomatico(seg)
            const sc = ligaSystemctl(seg)
            if (sc) reg.ligou.push(sc)
            else if (auto) reg.ligou.push({ rotulo: auto, alvos: [] })
          }
        }
      }
    } else if (e.type === 'user' && Array.isArray(c)) {
      for (const p of c) {
        if (p?.type !== 'tool_result') continue
        const uso = usos.get(p.tool_use_id)
        const texto = textoDe(p.content)
        if (uso?.nome === 'AskUserQuestion') {
          const respostas = e.toolUseResult?.answers
          if (respostas) for (const [q, a] of Object.entries(respostas)) reg.caixas.push({ pergunta: String(q), resposta: String(a) })
          else for (const m of texto.matchAll(/"([^"]*)"="([^"]*)"/g)) reg.caixas.push({ pergunta: m[1], resposta: m[2] })
        }
        if (!uso) continue
        saidas.push({ cab: uso.nome === 'Bash' ? `$ ${uso.comando}` : `${uso.nome} ${uso.alvo}`, saida: texto })
        const m = texto.match(/^Exit code (\d+)/)
        const codigo = m ? Number(m[1]) : null
        const falhou = p.is_error === true || (codigo !== null && codigo !== 0)
        if (uso.nome === 'Bash') {
          // um comando que depois rodou limpo deixa de ser erro do turno
          if (!falhou) reg.erros = reg.erros.filter((x) => x.alvo !== trunc(uso.comando, 200))
          const primeiro = uso.comando.trim().split(/\s+/)[0]
          const ruido = codigo === 1 && RUIDO_EXIT1.has(primeiro)
          if (falhou && !ruido) {
            const util = texto.split('\n').map((s) => s.trim()).filter((s) => s && !/^Exit code \d+$/.test(s))[0] || (m ? m[0] : 'erro')
            reg.erros.push({ ferramenta: 'Bash', alvo: trunc(uso.comando, 200), linha: trunc(util, 160), termos: termosDe(uso.comando) })
          }
          if (TESTE_CMD.test(uso.comando.trim()) && FALHA_TESTE.test(texto)) {
            const linha = texto.split('\n').find((s) => FALHA_TESTE.test(s)) || ''
            reg.testesFalhos.push({ alvo: trunc(uso.comando, 200), linha: trunc(linha.trim(), 160), termos: termosDe(uso.comando) })
          }
        } else if (falhou) {
          reg.erros.push({ ferramenta: uso.nome, alvo: trunc(uso.alvo, 200), linha: trunc(texto.split('\n')[0], 160), termos: [] })
        }
      }
    }
  }
  reg.modelos = [...modelos]
  // resumo das saídas, até 12 KB no total: cada uma recebe a mesma fatia
  const fatia = Math.max(200, Math.floor(12000 / Math.max(1, saidas.length)))
  let resumo = ''
  for (const s of saidas) resumo += `${trunc(s.cab, 200)}\n${trunc(s.saida.trim(), fatia)}\n---\n`
  reg.saidas = resumo.slice(0, 12000)
  return reg
}

/* ---------- cobrança de omissão (peça 2) ---------- */

const PALAVRA_FALHA = /\b(erro|erros|falh\w*|nao passou|quebr\w*|deu errado|exit)\b/
const PALAVRA_DERRUBOU = /\b(mat(ei|ou|ado)|derrub\w+|encerr\w+|par(ei|ou|ado)|deslig\w+|kill\w*|fech\w+)\b/
const PALAVRA_LIGOU = /\b(lig(uei|ado|ou)|inici\w+|agend\w+|cri(ei|ado)|start\w*|habilit\w+|dispar\w+|abri)\b/

/** Itens do registro que o texto final não menciona. Casamento sem acento e sem caixa. */
export function naoCitados(reg, texto) {
  const sem = norm(texto)
  const cita = (alvos, palavra) => {
    const bons = alvos.map(norm).filter((a) => a.length >= 3)
    return bons.length ? bons.some((a) => sem.includes(a)) : palavra.test(sem)
  }
  const itens = []
  const vistos = new Set()
  const junta = (rotulo) => { if (!vistos.has(rotulo)) { vistos.add(rotulo); itens.push(rotulo) } }
  for (const e of reg.erros || []) if (e.ferramenta === 'Bash' && !cita(e.termos || [], PALAVRA_FALHA)) junta(`erro em ${trunc(e.alvo, 70)}`)
  for (const t of reg.testesFalhos || []) if (!cita(t.termos || [], PALAVRA_FALHA)) junta(`teste que falhou: ${trunc(t.alvo, 70)}`)
  for (const d of reg.derrubou || []) if (!cita(d.alvos || [], PALAVRA_DERRUBOU)) junta(`derrubou: ${trunc(d.rotulo, 70)}`)
  for (const l of reg.ligou || []) if (!cita(l.alvos || [], PALAVRA_LIGOU)) junta(`ligou: ${trunc(l.rotulo, 70)}`)
  return itens
}

/* ---------- registro gravado ---------- */

const nomeSeguro = (s) => String(s).replace(/[^\w-]/g, '_')
export const dirRegistro = (home = os.homedir()) => path.join(home, '.local', 'share', 'agent-cockpit', 'registro')
const arquivoDe = (sessao, home) => path.join(dirRegistro(home), `${nomeSeguro(sessao)}.jsonl`)

/** Uma linha por turno. O mesmo turno (mesmo pedidoEm) é substituído, não duplicado. */
export function gravarTurno(reg, { sessao, cwd, home = os.homedir(), agora = new Date() } = {}) {
  if (!sessao) return false
  const cap = (a, n) => (a || []).slice(0, n)
  const linha = {
    em: agora.toISOString(), sessao, cwd: cwd || null, pedidoEm: reg.pedidoEm, pedido: trunc(reg.pedido || '', 300),
    mudou: cap(reg.mudou, 40), erros: cap(reg.erros, 20).map(({ termos, ...r }) => r), testesFalhos: cap(reg.testesFalhos, 20).map(({ termos, ...r }) => r),
    derrubou: cap(reg.derrubou, 20), ligou: cap(reg.ligou, 20), modelos: reg.modelos || [],
  }
  try {
    const f = arquivoDe(sessao, home)
    fs.mkdirSync(path.dirname(f), { recursive: true })
    let linhas = []
    try { linhas = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) } catch { /* primeiro turno */ }
    const ultima = linhas.length ? (() => { try { return JSON.parse(linhas[linhas.length - 1]) } catch { return null } })() : null
    if (ultima && linha.pedidoEm && ultima.pedidoEm === linha.pedidoEm) linhas.pop()
    linhas.push(JSON.stringify(linha))
    fs.writeFileSync(f, `${linhas.slice(-200).join('\n')}\n`)
    return true
  } catch { return false }
}

/** Os últimos `n` turnos gravados da sessão, do mais novo para o mais antigo. */
export function lerTurnos(sessao, n = 8, { home = os.homedir() } = {}) {
  if (!sessao) return []
  try {
    return fs.readFileSync(arquivoDe(sessao, home), 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean).slice(-n).reverse()
  } catch { return [] }
}

/** Conversas `claude -p` (sdk-cli) nascidas nas últimas 24 h numa pasta de projeto: era o que o painel escondia. */
export function robosDaPasta(cwd, { casa = process.env.CC_HOME || path.join(os.homedir(), '.claude'), agora = Date.now() } = {}) {
  const vazio = { n: 0, primeira: null, ultima: null }
  if (!cwd) return vazio
  const pasta = path.join(casa, 'projects', String(cwd).replace(/[^A-Za-z0-9]/g, '-'))
  let arqs = []
  try { arqs = fs.readdirSync(pasta).filter((f) => f.endsWith('.jsonl')) } catch { return vazio }
  const DIA = 24 * 3600e3
  const nascidas = []
  for (const f of arqs) {
    const arq = path.join(pasta, f)
    let st
    try { st = fs.statSync(arq) } catch { continue }
    if (agora - st.mtimeMs > DIA) continue
    const t = nascimento(arq, st)
    if (t !== null && agora - t <= DIA) nascidas.push(t)
  }
  if (!nascidas.length) return vazio
  nascidas.sort((a, b) => a - b)
  return { n: nascidas.length, primeira: new Date(nascidas[0]).toISOString(), ultima: new Date(nascidas[nascidas.length - 1]).toISOString() }
}
