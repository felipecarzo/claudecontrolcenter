/**
 * CC-1075: `cc sessao encerrar`. Roda DENTRO da sessão que ele encerra e só age nela.
 * Grava o carimbo "encerrada" no abrigo (nunca em ~/.claude, que é somente leitura no sandbox), anota o vínculo do
 * projeto e, se a sessão está num tmux, agenda o fechamento do tmux DELA (nome vindo do registro dela) para dali a 6 s.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'
import { casaClaude } from './platform.mjs'

export const ATRASO_S = 6
export const arquivoEncerradas = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'encerradas.json')

/** { sessionId: ms }. Vazio se não existe ou está ilegível. */
export function lerEncerradas() {
  try { return JSON.parse(fs.readFileSync(arquivoEncerradas(), 'utf8')) || {} } catch { return {} }
}

function gravarCarimbo(id, agora) {
  const arq = arquivoEncerradas()
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  const tmp = `${arq}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ ...lerEncerradas(), [id]: agora }, null, 2))
  fs.renameSync(tmp, arq)
}

/** O registro da sessão pelo sessionId, lendo só os campos necessários (nunca os `.key`). */
export function registroDa(sessionId, dir = path.join(casaClaude(), 'sessions')) {
  let nomes = []
  try { nomes = fs.readdirSync(dir).filter((f) => f.endsWith('.json')) } catch { return null }
  for (const f of nomes) {
    try {
      const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      if (o.sessionId === sessionId) return o
    } catch { /* registro ilegível */ }
  }
  return null
}

/** Padrão do fechamento: processo solto, só do PAINEL (`%N`) recebido, depois de ATRASO_S segundos.
 *  Painel e não sessão: `kill-session` fecharia todas as janelas do tmux, inclusive de outra conversa que
 *  dividisse a sessão. O id de painel é único na máquina e sai do registro da própria sessão.
 *  CC-1123: confere ANTES que alcança o painel. Dentro da caixa de proteção o tmux dá "Operation not permitted" e o
 *  processo solto morre junto com o comando; sem esta conferência a sessão era marcada e ficava viva (geolev4, 22/11). */
function fecharTmux(painel) {
  if (spawnSync('tmux', ['display-message', '-p', '-t', painel, '#{pane_id}'], { encoding: 'utf8' }).stdout?.trim() !== painel) return false
  spawn('sh', ['-c', 'sleep "$1" && tmux kill-pane -t "$2"', 'x', String(ATRASO_S), painel], { detached: true, stdio: 'ignore' }).unref()
  return true
}

export async function encerrar({ sessionId = process.env.CLAUDE_CODE_SESSION_ID, soMarcar = false, fechar = fecharTmux, agora = Date.now(), dir } = {}) {
  if (!sessionId) return { ok: false, erro: 'sem CLAUDE_CODE_SESSION_ID: este comando só roda dentro de uma sessão do Claude Code' }
  const reg = registroDa(sessionId, dir)
  if (!reg) return { ok: false, erro: `não achei o registro da sessão ${String(sessionId).slice(0, 8)} em ~/.claude/sessions` }
  const nomeTmux = reg.tmux ? String(reg.tmux).split(':')[0] : null
  const painel = reg.tmux ? (String(reg.tmux).match(/%\d+$/) || [])[0] || null : null
  const fecha = Boolean(painel) && !soMarcar
  if (fecha && !fechar(painel)) return { ok: false, erro: `não alcancei o painel ${painel} do tmux ${nomeTmux}, então nada foi marcado nem fechado. Rode o comando fora da caixa de proteção (dangerouslyDisableSandbox).` }
  gravarCarimbo(sessionId, agora)
  let vinculo = null
  if (nomeTmux?.startsWith('cc-remote-')) {
    const R = await import('./remotecontrol.mjs')
    vinculo = Object.keys(R.lerVinculos()).find((p) => R._internals.slug(p) === nomeTmux) || null
    if (vinculo) R.anotarVinculo(vinculo, { encerradaEm: agora })
  }
  const texto = !nomeTmux ? 'Marquei a sessão como encerrada no painel. Ela não está num tmux, então o processo continua vivo: feche o terminal.'
    : soMarcar ? 'Marquei a sessão como encerrada no painel e não fechei o tmux (--so-marcar).'
      : `Marquei a sessão como encerrada no painel. O tmux ${nomeTmux} fecha em ${ATRASO_S} segundos.`
  return { ok: true, sessionId, tmux: nomeTmux, vinculo, marcada: true, fecha, texto }
}
