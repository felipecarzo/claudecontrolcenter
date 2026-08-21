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
  // Sinais de esforço, colhidos no mesmo parse que já roda: as linhas com uso
  // de token são justamente as respostas do assistente, e é nelas que vêm as
  // chamadas de ferramenta. Coletar isto não custa uma passada a mais.
  const tools = {}
  const edicoes = new Map()
  let turnos = 0
  // Primeiro pedido de verdade da sessão, para dar nome a ela na tela.
  // `promptSource` é o que separa pessoa de injeção de skill e saída de tool —
  // filtro barato o bastante para rodar em linha crua antes do parse.
  let titulo = null

  for (const linha of texto.split('\n')) {
    if (!linha) continue
    if (!cwd) {
      const m = RE_CWD.exec(linha)
      if (m) { try { cwd = JSON.parse(`"${m[1]}"`) } catch { cwd = m[1] } }
    }
    const mt = RE_TS.exec(linha)
    const t = mt ? Date.parse(mt[1]) : NaN
    if (Number.isFinite(t)) marcas.push(t)

    if (titulo === null && linha.includes('"promptSource"') && !linha.includes('"isMeta":true')) {
      try {
        const j = JSON.parse(linha)
        const c = j.message?.content
        const texto = typeof c === 'string' ? c : Array.isArray(c) ? c.find((b) => b?.type === 'text')?.text : null
        if (texto && !j.toolUseResult) titulo = texto.trim().slice(0, 120)
      } catch { /* linha truncada: a próxima serve */ }
    }

    if (!linha.includes('"usage"')) continue
    let obj
    try { obj = JSON.parse(linha) } catch { continue }
    const u = obj.message?.usage
    const modelo = obj.message?.model
    if (!u || !modelo || modelo === '<synthetic>') continue
    turnos++
    for (const bloco of obj.message?.content || []) {
      if (bloco?.type !== 'tool_use') continue
      tools[bloco.name] = (tools[bloco.name] || 0) + 1
      // Só Edit e Write mudam código. Read encosta no arquivo e não é esforço
      // de mesma natureza; contá-lo inflaria toda tarefa de investigação.
      const alvo = bloco.name === 'Edit' || bloco.name === 'Write' ? bloco.input?.file_path : null
      if (alvo) edicoes.set(alvo, (edicoes.get(alvo) || 0) + 1)
    }
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
  // Guarda o agregado, não a lista de caminhos: a lista cresceria o cache sem
  // responder nada além do que estes três números já respondem.
  return {
    cwd,
    blocos,
    porDia,
    titulo,
    sinais: {
      turnos,
      tools,
      arquivos: edicoes.size,
      reeditados: [...edicoes.values()].filter((n) => n > 1).length,
    },
  }
}

// Sobe quando o formato do que se guarda por arquivo muda. Sem isto, um campo
// novo nasceria vazio para sempre nas sessões já cacheadas — e sessão antiga é
// justamente a que não vai ser reescrita para forçar releitura.
const VERSAO_CACHE = 3

const lerCache = () => {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    return c.versao === VERSAO_CACHE ? c : { versao: VERSAO_CACHE, arquivos: {} }
  } catch {
    return { versao: VERSAO_CACHE, arquivos: {} }
  }
}

const gravarCache = (cache) => {
  const tmp = `${CACHE_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cache))
  fs.renameSync(tmp, CACHE_FILE)
}

/** Varre os transcripts, relendo só o que mudou de tamanho ou data. */
export function varrer({ force = false } = {}) {
  const cache = force ? { versao: VERSAO_CACHE, arquivos: {} } : lerCache()
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
        projeto: project, dias: {}, sessoes: [], uso: {}, blocos: [], usoDia: {},
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
        // Mesma soma quebrada por dia: é o que permite cruzar modelo com data
        // nos gráficos. O total por modelo acima continua valendo sozinho.
        soma(((p.usoDia[dia] ||= {})[modelo] ||= usoZero()), uso)
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
    // Uso quebrado por dia E modelo: é o que deixa cruzar as duas dimensões
    // nos gráficos. Sem isso só dá pra ver modelo no total ou dia no total.
    const usoDias = []
    for (const [dia, porModelo] of Object.entries(p.usoDia)) {
      if (!noRecorte(dia)) continue
      for (const [modelo, u] of Object.entries(porModelo)) {
        usoDias.push({
          dia, modelo, ...u, custo: custoDe(modelo, u),
          tokens: u.input + u.output + u.escrita5m + u.escrita1h + u.leitura,
        })
      }
    }
    return {
      projeto: p.projeto,
      ativoMs: horas,
      dias,
      diasTrabalhados: dias.length,
      sessoes: p.sessoes.filter((s) => s.ativoMs > 0).sort((a, b) => b.inicio - a.inicio),
      uso,
      usoDias,
      custo,
      custoBrl: brlPorUsd ? custo * brlPorUsd : null,
      tokens: uso.reduce((a, u) => a + u.tokens, 0),
      taxaHora,
      taxaPropria: Number(cfg.taxaPorProjeto?.[p.projeto]) > 0,
      valor: taxaHora * (horas / 36e5),
    }
  }).filter((p) => p.ativoMs > 0 || p.tokens > 0)

  // A assinatura é um custo fixo do mês, então a hora vale o que sobra dela
  // dividido pelo que se trabalhou naquele mês: mês parado deixa a hora cara,
  // e isso é a verdade, não um defeito da conta. Rateio por mês e não pelo
  // período inteiro justamente para não diluir isso.
  const assinaturaMes = Number(cfg.assinaturaMes) || 0
  const msPorMes = {}
  for (const p of lista) {
    for (const d of p.dias) msPorMes[d.dia.slice(0, 7)] = (msPorMes[d.dia.slice(0, 7)] || 0) + d.ativoMs
  }
  const meses = Object.entries(msPorMes).sort().map(([mes, ms]) => ({
    mes, ms, custoHora: assinaturaMes && ms ? assinaturaMes / (ms / 36e5) : 0,
  }))
  for (const p of lista) {
    p.custoReal = assinaturaMes
      ? p.dias.reduce((a, d) => {
        const total = msPorMes[d.dia.slice(0, 7)]
        return a + (total ? assinaturaMes * (d.ativoMs / total) : 0)
      }, 0)
      : null
    p.sobra = p.custoReal != null && p.taxaHora ? p.valor - p.custoReal : null
  }

  lista.sort((a, b) => b.ativoMs - a.ativoMs)
  return {
    corteMin, de, ate, projetos: lista,
    taxaGlobal: Number(cfg.taxaHora) || 0,
    cambio: cfg.cambio || {},
    assinaturaMes, meses,
    varredura: { arquivos: Object.keys(arquivos).length, lidos, bytesLidos },
    modelosSemPreco: [...modelosSemPreco],
    precos: PRECOS,
  }
}

/**
 * CC-260: quanto cada sessão já consumiu, para o cartão do agente.
 *
 * Pedido dele em 21/08, depois de ver `?` no cartão: *"segue"*, sobre trazer o
 * gasto de cada sessão. O número sempre existiu aqui: a varredura já guarda
 * `porDia` por sessão, com input, output, escrita e leitura de cache.
 *
 * ## Por que o cartão dizia `?`
 *
 * `sessoes.mjs` devolve `tokens: null` para sessão interativa, e o comentário
 * de lá explica: contar exigiria ler o transcrito inteiro, que é caro demais
 * para o tique de 2 segundos do painel. **A conta certa não é ler na hora, é ler
 * noutro ritmo e guardar.**
 *
 * ## O custo, medido
 *
 * `varrer()` com cache quente leva **305ms** na primeira chamada do processo e
 * **1ms** nas seguintes, porque o cache fica em memória. Rodando a cada 30
 * segundos, o painel de 2 em 2 segundos nunca paga nada.
 *
 * ## O que entra na soma
 *
 * Tudo o que a sessão consumiu, todos os dias e todos os modelos: entrada,
 * saída, escrita de cache e leitura de cache. **A leitura de cache é a maior
 * parte de longe**, e é por isso que o número parece grande: ela custa 10% da
 * entrada, e a aba de custo quebra isso por tipo. Aqui é volume, não fatura.
 */
export function tokensPorSessao({ force = false } = {}) {
  const v = varrer({ force })
  const mapa = {}
  for (const arq of Object.values(v.arquivos || {})) {
    if (!arq?.sessao) continue
    let total = 0
    for (const dia of Object.values(arq.porDia || {})) {
      for (const u of Object.values(dia || {})) {
        total += (u.input || 0) + (u.output || 0) + (u.escrita5m || 0) + (u.escrita1h || 0) + (u.leitura || 0)
      }
    }
    /* A chave é o id INTEIRO da sessão e os 8 primeiros: o painel usa o curto
       nos cartões e o longo no reporte, e procurar pelos dois evita um `join`
       que falha calado quando o formato muda. */
    if (total > 0) {
      mapa[arq.sessao] = total
      mapa[String(arq.sessao).slice(0, 8)] = total
    }
  }
  return mapa
}

export const _internals = { lerArquivo, blocosPorDia }
