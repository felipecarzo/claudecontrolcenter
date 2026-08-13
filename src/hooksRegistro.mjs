// Só leitura: confere se um hook do catálogo está de fato registrado no
// settings.json do Claude Code. Existe pra o toggle do painel nunca mentir —
// ligar um hook que não está registrado em lugar nenhum não faz nada, e sem
// isso ninguém saberia por quê.
//
// Parser tolerante, mesmo espírito de `roadmap.mjs`: documento vivo, o
// settings.json do Felipe já tem ~200 linhas e cresce com outros sistemas
// dele (pixel-agents) — um campo a mais não pode quebrar a leitura.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json')

export function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
  } catch {
    return null // arquivo ausente ou JSON quebrado: nenhum hook está registrado, do ponto de vista de quem lê
  }
}

/**
 * `registradoVia` existe pra hook que não tem script próprio no settings.json
 * — `cc-check` vive dentro de `cc.mjs` e quem está lá é `todo-guard.mjs`, que
 * o chama por dentro. Procurar "cc.mjs" no settings.json nunca acharia nada.
 */
export function registrado(hook, settings = readSettings()) {
  const alvo = hook.registradoVia || hook.script
  const grupos = settings?.hooks?.[hook.evento]
  if (!alvo || !Array.isArray(grupos)) return false
  return grupos.some((grupo) =>
    (grupo.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes(alvo)))
}

export function registradoTodos(hooks, settings = readSettings()) {
  return Object.fromEntries(hooks.map((h) => [h.id, registrado(h, settings)]))
}
