// Botão "ligar projetos": dispara `claude --remote-control` num projeto, pra
// acessar do celular via claude.ai/code, sem precisar abrir terminal na mão.
//
// Achado pesquisando a doc oficial em 13/08: Remote Control não liga
// sozinho, precisa do comando explícito, e o processo precisa continuar VIVO
// depois de disparado (fechar o processo derruba a sessão). No Windows isso
// é seguro do mesmo jeito que o disparo do opencode (CC-29): quem chama é o
// painel (`cc.mjs --web-only`), que já não sai sozinho durante uso normal,
// então nem `detached` nem `unref` são necessários pra sobreviver.
//
// Diferente do opencode: aqui o processo é feito pra ficar rodando
// indefinidamente (é sessão interativa esperando conexão remota), não um
// comando que termina: por isso não tem poll de conclusão, só disparo.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ehWindows } from './platform.mjs'

const PASTA_LOG = path.join(os.tmpdir(), 'cc-remote-control')

/** Um processo vivo por projeto, pra clicar duas vezes não abrir sessão duplicada. */
const ativos = new Map() // projeto -> { pid, desde }

const vivo = (pid) => {
  try {
    process.kill(pid, 0) // sinal 0: só testa se existe, não mata
    return true
  } catch {
    return false
  }
}

/** O que está ligado agora, filtrando processo que já morreu sozinho. */
export function estado() {
  const out = {}
  for (const [projeto, info] of ativos) {
    if (vivo(info.pid)) out[projeto] = info
    else ativos.delete(projeto)
  }
  return out
}

/**
 * Dispara `claude --remote-control "<nome>"` na pasta do projeto. Nunca
 * espera terminar: é sessão que fica viva até o Felipe fechar pelo celular
 * ou o painel reiniciar.
 */
export function ligar(projeto, cwd, { binario = 'claude' } = {}) {
  if (!cwd || !fs.existsSync(cwd)) return { ok: false, erro: `pasta não existe: ${cwd}` }

  const existente = estado()[projeto]
  if (existente) return { ok: true, ja: true, ...existente }

  fs.mkdirSync(PASTA_LOG, { recursive: true })
  const logFile = path.join(PASTA_LOG, `${projeto}.log`)
  const args = ['--remote-control', projeto]
  // Mesmo padrão do opencode: no Windows o binário global do npm é `.cmd`,
  // `spawn()` direto não sobe. `cmd /c` como executável, nunca `shell: true`.
  const [cmd, cmdArgs] = ehWindows ? ['cmd', ['/c', binario, ...args]] : [binario, args]

  try {
    const saida = fs.openSync(logFile, 'a')
    const filho = spawn(cmd, cmdArgs, { cwd, stdio: ['ignore', saida, saida], windowsHide: true })
    filho.on('error', () => { /* falha aberta: binário ausente não derruba quem chamou */ })
    fs.closeSync(saida)
    const info = { pid: filho.pid, desde: Date.now(), logFile, cwd }
    ativos.set(projeto, info)
    return { ok: true, ja: false, ...info }
  } catch (e) {
    return { ok: false, erro: String(e.message || e) }
  }
}

/** Mata a sessão. A conexão remota cai junto: é o processo local que sustenta ela. */
export function desligar(projeto) {
  const info = ativos.get(projeto)
  if (!info) return { ok: true, ja: false }
  try {
    process.kill(info.pid)
  } catch { /* já tinha morrido sozinho */ }
  ativos.delete(projeto)
  return { ok: true, ja: true }
}

export const _internals = { vivo, ativos }
