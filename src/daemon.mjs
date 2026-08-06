// Faz o painel rodar sozinho e abrir por atalho. O "como" de cada sistema
// mora em platform.mjs; aqui fica só a lógica que vale em todos.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as so from './platform.mjs'

export const DEFAULT_PORT = 8099
const OPENER_NAME = 'abrir-control-center.vbs' // só o Windows precisa de intermediário

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CC = path.join(ROOT, 'cc.mjs')
const NODE = process.execPath

export const vbsPath = so.caminhoAutostart
export const desktopDir = so.pastaDesktop

/** O painel já está no ar nessa porta? Serve pra não subir duplicado. */
export async function isUp(port = DEFAULT_PORT) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/jobs`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

export const writeVbs = (porta = DEFAULT_PORT) =>
  so.instalarAutostart({ node: NODE, script: CC, porta })

/**
 * No Windows o .lnk aponta pra um .vbs porque `wscript` é o que roda sem
 * piscar janela preta. Nos outros sistemas o atalho já chama `cc open` direto.
 */
function escreverAbridor(porta) {
  if (!so.ehWindows) return null
  const arquivo = path.join(ROOT, OPENER_NAME)
  const q = (s) => `""${s}""`
  fs.writeFileSync(
    arquivo,
    [
      "' Control Center — gerado por `cc daemon install`, não editar à mão",
      "' garante o painel no ar e abre no navegador",
      'Set sh = CreateObject("WScript.Shell")',
      `sh.Run "${q(NODE)} ${q(CC)} open --port ${porta}", 0, True`,
      '',
    ].join('\r\n'),
    'latin1',
  )
  return arquivo
}

export function install({ port = DEFAULT_PORT } = {}) {
  const vbs = so.instalarAutostart({ node: NODE, script: CC, porta: port })
  const abridor = escreverAbridor(port)
  const shortcut = so.criarAtalho({ node: NODE, script: CC, porta: port, abridor })
  // não deixar atalho de versão anterior sobrando no Desktop
  for (const f of so.atalhosPossiveis()) {
    if (f !== shortcut && fs.existsSync(f)) fs.rmSync(f)
  }
  return { vbs, shortcut, port }
}

export function uninstall() {
  const removed = []
  const auto = so.desinstalarAutostart()
  if (auto) removed.push(auto)
  for (const f of [path.join(ROOT, OPENER_NAME), ...so.atalhosPossiveis()]) {
    if (fs.existsSync(f)) {
      fs.rmSync(f)
      removed.push(f)
    }
  }
  return { removed }
}

export const spawnDetached = (porta = DEFAULT_PORT) =>
  so.subirDestacado({ node: NODE, script: CC, porta })

export async function status(port = DEFAULT_PORT) {
  const auto = so.caminhoAutostart()
  const atalho = so.atalhosPossiveis().find((f) => fs.existsSync(f))
  return {
    so: so.SO,
    installed: fs.existsSync(auto),
    autostart: fs.existsSync(auto) ? auto : null,
    running: await isUp(port),
    port,
    shortcut: atalho || null,
  }
}

/** Garante o painel no ar e devolve a URL — usado pelo comando `open`. */
export async function ensureUp(port = DEFAULT_PORT, { waitMs = 8000 } = {}) {
  if (await isUp(port)) return { url: `http://localhost:${port}`, started: false }
  spawnDetached(port)
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300))
    if (await isUp(port)) return { url: `http://localhost:${port}`, started: true }
  }
  throw new Error(`o painel não subiu na porta ${port} — rode "cc --web-only" pra ver o erro`)
}

export const openBrowser = so.abrirNavegador

/** Pede pro processo no ar encerrar. Usado por `daemon restart`. */
export async function shutdown(port = DEFAULT_PORT) {
  try {
    await fetch(`http://127.0.0.1:${port}/api/shutdown`, { method: 'POST', signal: AbortSignal.timeout(1500) })
  } catch {
    // servidor caindo derruba a conexão antes de responder — esperado
  }
  const deadline = Date.now() + 4000
  while (Date.now() < deadline) {
    if (!(await isUp(port))) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}
