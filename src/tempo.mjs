// Quanto tempo cada projeto custou, lido dos transcripts do Claude Code.
//
// O dado bruto é a marca de tempo de cada mensagem em ~/.claude/projects. A
// janela do início ao fim não serve pra nada — inclui noite e fim de semana.
// O que vale é o tempo ATIVO: a soma dos intervalos, jogando fora as paradas
// maiores que um corte.
//
// O corte muda o número (5min e 15min separam horas de diferença num projeto
// grande), então ele é escolha de quem olha, não constante daqui. Por isso o
// cache guarda BLOCOS contíguos de 2 minutos, e não um total somado: dá pra
// recalcular qualquer corte >= 2min juntando blocos vizinhos, sem reler 800MB.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { projectOf } from './jobs.mjs'
import { readConfig, taxaDe } from './config.mjs'

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')
export const CACHE_FILE = path.join(os.homedir(), '.claude', 'control-center-tempo.json')

/** Menor parada que já corta um bloco. Define o corte mínimo consultável. */
export const GRAO_MS = 2 * 60_000
export const CORTE_PADRAO_MIN = 15

// USD por milhão de tokens. Cache de escrita custa 1,25x (5min) e 2x (1h) o
// input; leitura custa 0,1x. Modelo desconhecido não é chutado — fica de fora
// da conta e aparece na lista de ignorados.
export const PRECOS = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10, nota: 'promocional até 2026-08-31; depois 3/15' },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-fable-5': { input: 10, output: 50 },
}

/**
 * O transcript ora traz o alias ("claude-haiku-4-5"), ora o id com data
 * ("claude-haiku-4-5-20251001"). São o mesmo preço — sem tirar o sufixo, o
 * modelo cai na lista de ignorados e o custo do projeto sai menor do que é.
 */
export const precoDe = (modelo) => PRECOS[modelo] || PRECOS[String(modelo).replace(/-\d{8}$/, '')] || null

const MULT = { escrita5m: 1.25, escrita1h: 2, leitura: 0.1 }

export function custoDe(modelo, uso) {
  const p = precoDe(modelo)
  if (!p) return null
  const M = 1e6
  return (
    (uso.input * p.input +
      uso.output * p.output +
      uso.escrita5m * p.input * MULT.escrita5m +
      uso.escrita1h * p.input * MULT.escrita1h +
      uso.leitura * p.input * MULT.leitura) / M
  )
}

const usoZero = () => ({ input: 0, output: 0, escrita5m: 0, escrita1h: 0, leitura: 0 })
const soma = (a, b) => {
  for (const k of Object.keys(a)) a[k] += b[k] || 0
  return a
}

/* ----------------------------- leitura ----------------------------- */

const RE_TS = /"timestamp":"([^"]+)"/
const RE_CWD = /"cwd":"((?:[^"\\]|\\.)*)"/

/**
 * Uma passada por arquivo. `JSON.parse` só nas linhas que têm uso de token —
 * são ~18% do total, e parsear tudo dobraria o tempo da varredura à toa.
 */
function lerArquivo(arquivo) {
  const texto = fs.readFileSync(arquivo, 'utf8')
  const marcas = []
  const porDia = {}
  let cwd = null

  for (const linha of texto.split('\n')) {
    if (!linha) continue
    if (!cwd) {
      const m = RE_CWD.exec(linha)
      if (m) { try { cwd = JSON.parse(`"${m[1]}"`) } catch { cwd = m[1] } }
    }
    const mt = RE_TS.exec(linha)
    const t = mt ? Date.parse(mt[1]) : NaN
    if (Number.isFinite(t)) marcas.push(t)

    if (!linha.includes('"usage"')) continue
    let obj
    try { obj = JSON.parse(linha) } catch { continue }
    const u = obj.message?.usage
    const modelo = obj.message?.model
    if (!u || !modelo || modelo === '<synthetic>') continue
    const dia = new Date(Number.isFinite(t) ? t : Date.now()).toISOString().slice(0, 10)
    const alvo = ((porDia[dia] ||= {})[modelo] ||= usoZero())
    alvo.input += u.input_tokens || 0
    alvo.output += u.output_tokens || 0
    alvo.leitura += u.cache_read_input_tokens || 0
    // o split 5m/1h só existe em `cache_creation`; sem ele, o total vai como 5m
    const c = u.cache_creation
    if (c) {
      alvo.escrita5m += c.ephemeral_5m_input_tokens || 0
      alvo.escrita1h += c.ephemeral_1h_input_tokens || 0
    } else {
      alvo.escrita5m += u.cache_creation_input_tokens || 0
    }
  }

  marcas.sort((a, b) => a - b)
  const blocos = []
  for (const t of marcas) {
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && t - ultimo[1] <= GRAO_MS) ultimo[1] = t
    else blocos.push([t, t])
  }
  return { cwd, blocos, porDia }
}

const lerCache = () => {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) } catch { return { arquivos: {} } }
}

const gravarCache = (cache) => {
  const tmp = `${CACHE_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cache))
  fs.renameSync(tmp, CACHE_FILE)
}

/** Varre os transcripts, relendo só o que mudou de tamanho ou data. */
export function varrer({ force = false } = {}) {
  const cache = force ? { arquivos: {} } : lerCache()
  const vistos = new Set()
  let lidos = 0
  let bytesLidos = 0

  let pastas = []
  try {
    pastas = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
  } catch {
    return { arquivos: {}, lidos: 0, bytesLidos: 0 }
  }

  for (const pasta of pastas) {
    const dir = path.join(PROJECTS_DIR, pasta.name)
    let nomes = []
    try { nomes = fs.readdirSync(dir) } catch { continue }
    for (const nome of nomes) {
      if (!nome.endsWith('.jsonl')) continue
      const arquivo = path.join(dir, nome)
      const chave = `${pasta.name}/${nome}`
      vistos.add(chave)
      let st
      try { st = fs.statSync(arquivo) } catch { continue }
      const antigo = cache.arquivos[chave]
      if (antigo && antigo.size === st.size && antigo.mtime === st.mtimeMs) continue
      try {
        const dados = lerArquivo(arquivo)
        cache.arquivos[chave] = { size: st.size, mtime: st.mtimeMs, sessao: nome.slice(0, -6), ...dados }
        lidos++
        bytesLidos += st.size
      } catch {
        // arquivo sendo escrito agora, ou ilegível: fica pra próxima varredura
      }
    }
  }

  for (const chave of Object.keys(cache.arquivos)) {
    if (!vistos.has(chave)) delete cache.arquivos[chave] // sessão apagada
  }
  if (lidos) gravarCache(cache)
  return { arquivos: cache.arquivos, lidos, bytesLidos }
}

/* ---------------------------- agregação ---------------------------- */

/** Junta blocos vizinhos cujo intervalo cabe no corte e devolve o total. */
export function ativoMs(blocos, corteMs) {
  let total = 0
  let atual = null
  for (const [i, f] of blocos) {
    if (atual && i - atual[1] <= corteMs) atual[1] = f
    else { if (atual) total += atual[1] - atual[0]; atual = [i, f] }
  }
  if (atual) total += atual[1] - atual[0]
  return total
}

const diaDe = (ms) => new Date(ms).toISOString().slice(0, 10)

/** Corta os blocos na virada do dia, pra hora cair no dia certo. */
function blocosPorDia(blocos) {
  const mapa = {}
  for (const [i, f] of blocos) {
    let ini = i
    while (ini <= f) {
      const dia = diaDe(ini)
      const fimDoDia = Date.parse(`${dia}T23:59:59.999Z`)
      const fim = Math.min(f, fimDoDia)
      ;(mapa[dia] ||= []).push([ini, fim])
      ini = fim + 1
    }
  }
  return mapa
}

/**
 * @param {number} corteMin  parada, em minutos, que encerra um período de trabalho
 * @param {string} de,ate    recorte YYYY-MM-DD, inclusivo nas duas pontas
 */
export function resumo({ corteMin = CORTE_PADRAO_MIN, de = null, ate = null, force = false } = {}) {
  const corteMs = Math.max(corteMin, GRAO_MS / 60_000) * 60_000
  const { arquivos, lidos, bytesLidos } = varrer({ force })

  const projetos = new Map()
  const modelosSemPreco = new Set()
  const noRecorte = (dia) => (!de || dia >= de) && (!ate || dia <= ate)

  for (const [chave, dados] of Object.entries(arquivos)) {
    const { project } = projectOf(dados.cwd || '')
    if (!projetos.has(project)) {
      projetos.set(project, {
        projeto: project, dias: {}, sessoes: [], uso: {}, blocos: [],
      })
    }
    const p = projetos.get(project)

    const porDia = blocosPorDia(dados.blocos || [])
    const blocosNoRecorte = []
    for (const [dia, blocos] of Object.entries(porDia)) {
      if (!noRecorte(dia)) continue
      blocosNoRecorte.push(...blocos)
      const d = (p.dias[dia] ||= { blocos: [] })
      d.blocos.push(...blocos)
    }
    p.blocos.push(...blocosNoRecorte)

    for (const [dia, porModelo] of Object.entries(dados.porDia || {})) {
      if (!noRecorte(dia)) continue
      for (const [modelo, uso] of Object.entries(porModelo)) {
        soma((p.uso[modelo] ||= usoZero()), uso)
        if (!precoDe(modelo)) modelosSemPreco.add(modelo)
      }
    }

    if (blocosNoRecorte.length) {
      blocosNoRecorte.sort((a, b) => a[0] - b[0])
      p.sessoes.push({
        id: dados.sessao || chave,
        inicio: blocosNoRecorte[0][0],
        fim: blocosNoRecorte[blocosNoRecorte.length - 1][1],
        ativoMs: ativoMs(blocosNoRecorte, corteMs),
      })
    }
  }

  const cfg = readConfig()
  const brlPorUsd = Number(cfg.cambio?.brlPorUsd) || 0
  const lista = [...projetos.values()].map((p) => {
    const ordenar = (bs) => bs.sort((a, b) => a[0] - b[0])
    const horas = ativoMs(ordenar(p.blocos), corteMs)
    const taxaHora = taxaDe(p.projeto, cfg)
    const dias = Object.entries(p.dias)
      .map(([dia, d]) => ({ dia, ativoMs: ativoMs(ordenar(d.blocos), corteMs) }))
      .filter((d) => d.ativoMs > 0)
      .sort((a, b) => a.dia.localeCompare(b.dia))
    const uso = Object.entries(p.uso).map(([modelo, u]) => ({
      modelo, ...u, custo: custoDe(modelo, u), tokens: u.input + u.output + u.escrita5m + u.escrita1h + u.leitura,
    }))
    const custo = uso.reduce((a, u) => a + (u.custo || 0), 0)
    return {
      projeto: p.projeto,
      ativoMs: horas,
      dias,
      diasTrabalhados: dias.length,
      sessoes: p.sessoes.filter((s) => s.ativoMs > 0).sort((a, b) => b.inicio - a.inicio),
      uso,
      custo,
      custoBrl: brlPorUsd ? custo * brlPorUsd : null,
      tokens: uso.reduce((a, u) => a + u.tokens, 0),
      taxaHora,
      taxaPropria: Number(cfg.taxaPorProjeto?.[p.projeto]) > 0,
      valor: taxaHora * (horas / 36e5),
    }
  }).filter((p) => p.ativoMs > 0 || p.tokens > 0)

  lista.sort((a, b) => b.ativoMs - a.ativoMs)
  return {
    corteMin, de, ate, projetos: lista,
    taxaGlobal: Number(cfg.taxaHora) || 0,
    cambio: cfg.cambio || {},
    varredura: { arquivos: Object.keys(arquivos).length, lidos, bytesLidos },
    modelosSemPreco: [...modelosSemPreco],
    precos: PRECOS,
  }
}

export const _internals = { lerArquivo, blocosPorDia }
