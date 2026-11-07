/**
 * CC-1069, travas 2 e 3: a palavra da IA nunca é a última que vale.
 *
 * Módulo sem efeito ao ser importado. Quem chama: `quebra-guard.mjs` (PreToolUse
 * Bash) e `modelo-guard.mjs` (PreToolUse sem filtro, para CronCreate e
 * ScheduleWakeup), ambos já registrados no settings.
 *
 *  - autonomo-guard: barra o que LIGA trabalho automático, salvo se a última
 *    mensagem dele pede isso (verbo de ligar + objeto de robô).
 *  - escopo-guard: barra o que DERRUBA sessão, serviço ou processo, salvo se a
 *    última mensagem dele nomeia o alvo. "desliga tudo" sozinho não autoriza.
 *
 * Só olha o COMEÇO de cada segmento do comando (separado por ; && || | e
 * quebra de linha, sem corpo de heredoc): `git commit -m "systemctl ..."`
 * nunca dispara. Ceiling conhecido: `bash -c "..."` não é aberto.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Última mensagem REAL dele (filtro de src/transcript.mjs), normalizada. */
export async function ultimaMensagem(arquivo) {
  if (!arquivo) return ''
  try {
    const T = await import(pathToFileURL(resolve(AQUI, '../src/transcript.mjs')).href)
    const todas = T.humanMessagesTail(arquivo, { bytes: 512 * 1024 })
    return norm(todas.length ? todas[todas.length - 1].texto : '')
  } catch { return '' }
}

export function segmentos(cmd) {
  const semHeredoc = String(cmd).split(/<<-?\s*['"]?[A-Za-z_]\w*/)[0]
  // separa em ; && || | e quebra de linha, mas só fora de aspas
  const partes = []
  let atual = ''
  let aspa = ''
  for (let i = 0; i < semHeredoc.length; i++) {
    const c = semHeredoc[i]
    if (aspa) { if (c === aspa) aspa = ''; atual += c; continue }
    if (c === '"' || c === "'") { aspa = c; atual += c; continue }
    if (c === '\n' || c === ';' || c === '|' || (c === '&' && semHeredoc[i + 1] === '&')) {
      if (c === '&' || (c === '|' && semHeredoc[i + 1] === '|')) i++
      partes.push(atual); atual = ''
    } else atual += c
  }
  partes.push(atual)
  return partes
    .map((s) => s.trim().replace(/^(?:[A-Za-z_]\w*=\S+\s+)+/, '').replace(/^sudo\s+/, ''))
    .filter(Boolean)
}

const VERBO = /\b(lig(a|ar|ue|ando)|ativ(a|ar|e)|relig(a|ar|ue)|reativ(a|ar|e)|agend(a|ar|e)|bot(a|ar|e) pra rodar)\b/
const OBJETO = /(robo|regente|plantao|automatic|agendad|timer|sozinh)/

export const pediuLigar = (msg) => VERBO.test(msg) && OBJETO.test(msg)

/** O que, neste segmento, liga trabalho automático. Devolve a descrição ou null. */
export function ligaAutomatico(seg) {
  if (/^systemctl\b/.test(seg) && /\b(enable|start|restart|reenable)\b/.test(seg) && /\.timer\b/.test(seg)) return 'ligar um timer do systemd'
  if (/^(?:node|cc|cockpit)\b/.test(seg) && /\bregente(?:\.mjs)?\s+ligar\b/.test(seg)) return 'ligar o regente'
  if (/^curl\b/.test(seg) && /\/api\/regente/.test(seg) && /(-X\s*POST|\s-d\b|--data)/.test(seg)) return 'ligar o regente pela API'
  if (/systemd\/user\/[^\s'"]*\.timer/.test(seg) && /^(?:touch|tee|cp|mv|ln|install)\b|>/.test(seg)) return 'criar um timer em ~/.config/systemd/user'
  if (/^crontab\b/.test(seg) && !/\s-l\b/.test(seg)) return 'editar o crontab'
  if (/plantao-ativo/.test(seg) && /^(?:touch|tee|cp|mv|ln|install)\b|>/.test(seg)) return 'ligar o plantão (plantao-ativo)'
  return null
}

/** Devolve o motivo do bloqueio, ou null. `ferramenta` só para CronCreate/ScheduleWakeup. */
export function conferirAutonomo({ ferramenta, comando, msg }) {
  const alvos = []
  if (ferramenta === 'CronCreate' || ferramenta === 'ScheduleWakeup') alvos.push(`a ferramenta ${ferramenta}`)
  else for (const s of segmentos(comando)) { const a = ligaAutomatico(s); if (a) alvos.push(a) }
  if (!alvos.length || pediuLigar(msg)) return null
  return `[autonomo-guard] Isto liga trabalho automático sem pedido dele: ${[...new Set(alvos)].join('; ')}.\n`
    + 'A última mensagem dele não pede para ligar nada automático.\n'
    + 'Pergunte na caixa de escolha (AskUserQuestion) antes de ligar. Depois que ele responder, repita o comando.'
}

const GENERICO_SESSAO = /\bsess(ao|oes)\b/
const GENERICO_SERVICO = /\bservicos?\b/

/** Quais derrubadas o segmento faz: [{ rotulo, alvos: [..], generico: RegExp }]. */
export function derruba(seg) {
  const saida = []
  const args = seg.split(/\s+/)
  if (/^tmux\b/.test(seg) && /\bkill-session\b/.test(seg)) {
    const i = args.indexOf('-t')
    const alvo = i >= 0 ? String(args[i + 1] || '').replace(/^['"]|['"]$/g, '') : ''
    saida.push({ rotulo: `tmux kill-session ${alvo}`.trim(), alvos: [alvo.replace(/^cc-remote-/, '')], generico: GENERICO_SESSAO })
  }
  if (/^(?:pkill|killall)\b/.test(seg) && /\bclaude\b/.test(seg)) saida.push({ rotulo: 'encerrar processos claude', alvos: ['claude'], generico: GENERICO_SESSAO })
  else if (/^kill\b/.test(seg) && /\bclaude\b/.test(seg)) saida.push({ rotulo: 'kill em processo claude', alvos: ['claude'], generico: GENERICO_SESSAO })
  const m = seg.match(/^systemctl\b.*?\b(stop|disable|mask)\b(.*)$/)
  if (m) {
    const unidades = m[2].split(/\s+/).filter((a) => a && !a.startsWith('-'))
    saida.push({
      rotulo: `systemctl ${m[1]} ${unidades.join(' ')}`.trim(),
      alvos: unidades.map((u) => u.replace(/\.(service|timer|socket)$/, '')),
      generico: GENERICO_SERVICO,
    })
  }
  return saida
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nomeado = (msg, alvo) => {
  const n = norm(alvo)
  return n.length > 0 && new RegExp(`(^|[^a-z0-9])${escapar(n)}($|[^a-z0-9])`).test(msg)
}

/** Devolve o motivo do bloqueio, ou null. */
export function conferirEscopo({ comando, msg }) {
  const sem = []
  for (const s of segmentos(comando)) {
    for (const d of derruba(s)) {
      if (d.generico.test(msg)) continue
      if (d.alvos.length && d.alvos.every((a) => nomeado(msg, a))) continue
      sem.push(d.rotulo)
    }
  }
  if (!sem.length) return null
  return `[escopo-guard] Derrubar o que ele não nomeou: ${sem.slice(0, 5).join('; ')}.\n`
    + 'A última mensagem dele não cita esse alvo. "desliga tudo" sozinho não autoriza.\n'
    + 'Liste os alvos e confirme na caixa de escolha (AskUserQuestion) antes de rodar.'
}

/** Ponto único para os dois ganchos: o motivo, ou null. */
export async function conferirAcao(dados) {
  const ferramenta = dados?.tool_name
  const comando = ferramenta === 'Bash' ? String(dados?.tool_input?.command || '') : ''
  const ehCron = ferramenta === 'CronCreate' || ferramenta === 'ScheduleWakeup'
  if (!ehCron && !comando) return null
  const cfg = await import(pathToFileURL(resolve(AQUI, '../src/config.mjs')).href).catch(() => null)
  const ligado = (id) => !cfg?.hookEnabled || cfg.hookEnabled(id, undefined, dados?.cwd || process.cwd())
  const querAuto = ligado('autonomo-guard')
  const querEscopo = !ehCron && ligado('escopo-guard')
  if (!querAuto && !querEscopo) return null
  // só lê o transcrito se algum dos dois tiver o que cobrar
  const pre = (querAuto && conferirAutonomo({ ferramenta, comando, msg: '' })) || (querEscopo && conferirEscopo({ comando, msg: '' }))
  if (!pre) return null
  const msg = await ultimaMensagem(dados?.transcript_path || dados?.transcriptPath)
  return (querAuto && conferirAutonomo({ ferramenta, comando, msg })) || (querEscopo && conferirEscopo({ comando, msg })) || null
}
