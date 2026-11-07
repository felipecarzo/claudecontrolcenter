/**
 * CC-1069, trava 1: teto de conversas `claude -p` por hora.
 *
 * Módulo sem efeito ao ser importado; quem chama é o `anonimo-prompt.mjs`
 * (UserPromptSubmit, já registrado). Vale só no `claude -p`
 * (CLAUDE_CODE_ENTRYPOINT=sdk-cli). A sessão interativa dele nunca passa por aqui.
 *
 * Conta os transcritos de robô nascidos na última hora em ~/.claude/projects.
 * Configuração em ~/.config/agent-cockpit/teto-robo.json ({ "porHora": 20 });
 * o arquivo robo-desligado na mesma pasta barra todo `claude -p`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HORA = 60 * 60 * 1000
const PADRAO = 20

/** Quando o transcrito nasceu: primeiro timestamp da cabeça, ou o birthtime. */
export function nascimento(arq, st) {
  try {
    const fd = fs.openSync(arq, 'r')
    try {
      const buf = Buffer.alloc(4096)
      const n = fs.readSync(fd, buf, 0, 4096, 0)
      const cab = buf.toString('utf8', 0, n)
      if (!cab.includes('"entrypoint":"sdk-cli"')) return null
      const m = cab.match(/"timestamp":"([^"]+)"/)
      const t = m ? Date.parse(m[1]) : NaN
      return Number.isFinite(t) ? t : (st.birthtimeMs || st.mtimeMs)
    } finally { fs.closeSync(fd) }
  } catch { return null }
}

export function contarRobos({ casa, agora = Date.now() }) {
  let n = 0
  const raiz = path.join(casa, 'projects')
  let pastas = []
  try { pastas = fs.readdirSync(raiz) } catch { return 0 }
  for (const p of pastas) {
    if (p.endsWith('agent-cockpit-conferente') || p.endsWith('agent-cockpit-guia-haiku')) continue // CC-1070 e CC-1076: pastas de trabalho do conferente e do guia
    let arqs = []
    try { arqs = fs.readdirSync(path.join(raiz, p)).filter((f) => f.endsWith('.jsonl')) } catch { continue }
    for (const f of arqs) {
      const arq = path.join(raiz, p, f)
      let st
      try { st = fs.statSync(arq) } catch { continue }
      if (agora - st.mtimeMs > HORA) continue // sem escrita na última hora, não nasceu nela
      const t = nascimento(arq, st)
      if (t !== null && agora - t <= HORA) n++
    }
  }
  return n
}

/** Devolve o motivo do bloqueio, ou null se pode seguir. */
export function conferirTeto({ cwd, env = process.env, home = os.homedir(), agora = Date.now() } = {}) {
  if (env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-cli') return null
  // CC-1070: o conferente tem teto próprio (30/h, no log dele) e não conta aqui
  if (env.CC_CONFERENTE === '1') return null
  // CC-1076: o guia por frente (guiaHaiku.mjs) tem teto próprio, 6 por hora, no log dele
  if (env.CC_GUIA_HAIKU === '1') return null
  const cfgDir = path.join(home, '.config', 'agent-cockpit')
  const log = (texto) => {
    try {
      fs.mkdirSync(path.join(home, 'logs'), { recursive: true })
      fs.appendFileSync(path.join(home, 'logs', 'teto-robo.log'), `${new Date(agora).toISOString()} ${cwd || '-'} ${texto}\n`)
    } catch { /* o log é extra: sem ele a trava vale igual */ }
  }
  if (fs.existsSync(path.join(cfgDir, 'robo-desligado'))) {
    log('robo-desligado')
    return '[teto-robo] O interruptor geral dos robôs está desligado (arquivo robo-desligado). Nenhuma conversa `claude -p` roda até ele ser removido.'
  }
  let porHora = PADRAO
  try {
    const v = Number(JSON.parse(fs.readFileSync(path.join(cfgDir, 'teto-robo.json'), 'utf8')).porHora)
    if (Number.isFinite(v) && v > 0) porHora = v
  } catch { /* sem arquivo: teto padrão */ }
  const casa = env.CC_HOME || path.join(home, '.claude')
  const n = contarRobos({ casa, agora })
  if (n <= porHora) return null
  log(`bloqueado ${n}/${porHora}`)
  return `[teto-robo] ${n} conversas de robô (claude -p) na última hora; o teto é ${porHora}. Pare de abrir conversas automáticas e avise o Felipe. `
    + 'Para mudar o teto: ~/.config/agent-cockpit/teto-robo.json, campo porHora.'
}
