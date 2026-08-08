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

const DEFAULTS = {
  enabled: true, disabledProjects: [], taxaHora: 0, taxaPorProjeto: {}, cambio: {},
}

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

/**
 * Taxa em R$/hora usada para dar preço ao tempo ativo: a do projeto quando
 * existe, senão a global. Zero é "não configurada" — a tela esconde a coluna
 * em vez de mostrar R$ 0,00, que pareceria trabalho de graça.
 */
export function taxaDe(projeto, cfg = readConfig()) {
  const doProjeto = Number(cfg.taxaPorProjeto?.[projeto])
  if (Number.isFinite(doProjeto) && doProjeto > 0) return doProjeto
  const global = Number(cfg.taxaHora)
  return Number.isFinite(global) && global > 0 ? global : 0
}

/** Zerar a taxa de um projeto o devolve para a global, em vez de gravar zero. */
export function setTaxa(valor, { projeto = null } = {}) {
  const cfg = readConfig()
  const v = Math.max(0, Number(valor) || 0)
  if (!projeto) return writeConfig({ ...cfg, taxaHora: v })
  const mapa = { ...cfg.taxaPorProjeto }
  if (v > 0) mapa[projeto] = v
  else delete mapa[projeto]
  return writeConfig({ ...cfg, taxaPorProjeto: mapa })
}

/**
 * Cotação do dólar. `manual: true` congela o valor digitado — cotação buscada
 * nunca sobrescreve escolha de quem está fechando preço. Valor zero destrava
 * a busca automática de novo.
 */
export function setCambio({ brlPorUsd, em, manual }) {
  const cfg = readConfig()
  const v = Math.max(0, Number(brlPorUsd) || 0)
  const cambio = v > 0
    ? { brlPorUsd: v, em: em || Date.now(), manual: !!manual }
    : {}
  writeConfig({ ...cfg, cambio })
  return cambio
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
