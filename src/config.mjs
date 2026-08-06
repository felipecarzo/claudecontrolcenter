// Liga/desliga o reporte. Fica fora do repo, em ~/.claude, porque vale pra
// todos os projetos da máquina.
//
// A checagem mora aqui e não no agente de propósito: quando está desligado,
// `cc.mjs set` vira no-op silencioso. Assim um projeto com a instrução antiga
// no CLAUDE.md não quebra nem escreve sem querer.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { projectOf } from './jobs.mjs'

export const CONFIG_FILE = path.join(os.homedir(), '.claude', 'control-center.json')

const DEFAULTS = { enabled: true, disabledProjects: [] }

export function readConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeConfig(cfg) {
  const next = { ...DEFAULTS, ...cfg }
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = `${CONFIG_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2))
  fs.renameSync(tmp, CONFIG_FILE)
  return next
}

/** Sem projeto informado, responde só pelo interruptor global. */
export function isEnabled(cwd = process.cwd(), cfg = readConfig()) {
  if (!cfg.enabled) return false
  const { project } = projectOf(cwd)
  return !cfg.disabledProjects.includes(project)
}

export function setEnabled(on, { project = null } = {}) {
  const cfg = readConfig()
  if (!project) return writeConfig({ ...cfg, enabled: !!on })
  const set = new Set(cfg.disabledProjects)
  on ? set.delete(project) : set.add(project)
  return writeConfig({ ...cfg, disabledProjects: [...set].sort() })
}

export function describe(cwd = process.cwd()) {
  const cfg = readConfig()
  const { project } = projectOf(cwd)
  return {
    global: cfg.enabled,
    project,
    projectEnabled: isEnabled(cwd, cfg),
    disabledProjects: cfg.disabledProjects,
    file: CONFIG_FILE,
  }
}
