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
  assinaturaMes: 0, graficos: null, mercado: {}, sessoes: {},
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

/**
 * Os gráficos que o Felipe montou. `null` significa "nunca mexeu", e a tela
 * mostra os prontos — diferente de `[]`, que é "apaguei todos" e deve
 * continuar vazio. Sem essa distinção, apagar o último traria todos de volta.
 */
export function setGraficos(lista) {
  const cfg = readConfig()
  const limpa = Array.isArray(lista)
    ? lista.slice(0, 40).map((g) => ({
      id: String(g.id || '').slice(0, 40),
      nome: String(g.nome || '').slice(0, 80),
      forma: String(g.forma || '').slice(0, 20),
      dimensao: String(g.dimensao || '').slice(0, 20),
      serie: String(g.serie || 'nenhuma').slice(0, 20),
      medida: String(g.medida || '').slice(0, 20),
    }))
    : null
  writeConfig({ ...cfg, graficos: limpa })
  return limpa
}

/**
 * Faixas de mercado por senioridade. `manual: true` congela o que o Felipe
 * digitou — busca na web não sobrescreve escolha de quem vai cobrar.
 */
export function setMercado(m) {
  const cfg = readConfig()
  const faixa = (f) => ({ min: Math.max(0, Number(f?.min) || 0), max: Math.max(0, Number(f?.max) || 0) })
  const mercado = {
    junior: faixa(m.junior),
    pleno: faixa(m.pleno),
    senior: faixa(m.senior),
    fonte: String(m.fonte || '').slice(0, 60),
    em: Number(m.em) || Date.now(),
    manual: !!m.manual,
  }
  writeConfig({ ...cfg, mercado })
  return mercado
}

/**
 * Correção de nível e tempo digitado, por sessão. Fica aqui e não no meta.json
 * porque sessão não pertence a job nenhum — e o job some antes do transcript.
 * Ajuste vazio some do mapa, para o arquivo não crescer com lixo.
 */
export function setSessao(sessao, { nivel, horas }) {
  const cfg = readConfig()
  const sessoes = { ...cfg.sessoes }
  const id = String(sessao || '').slice(0, 64)
  if (!id) throw new Error('sessão obrigatória')
  const ajuste = {}
  if (['junior', 'pleno', 'senior'].includes(nivel)) ajuste.nivel = nivel
  if (Number(horas) > 0) ajuste.horas = Math.min(Number(horas), 1000)
  if (Object.keys(ajuste).length) sessoes[id] = ajuste
  else delete sessoes[id]
  writeConfig({ ...cfg, sessoes })
  return sessoes[id] || null
}

/** Quanto a assinatura custa por mês. Zero desliga o custo real na tela. */
export function setAssinatura(valor) {
  const cfg = readConfig()
  return writeConfig({ ...cfg, assinaturaMes: Math.max(0, Number(valor) || 0) })
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
