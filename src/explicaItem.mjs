/**
 * CC-936: cada item do backlog ganha "o que é" e "o que muda para você",
 * escritos pelo agy UMA vez, em lotes de até 30, e guardados no abrigo.
 *
 * Mesmo padrão do `resumoAgy.mjs`: um lote por vez, em segundo plano, falha
 * espera 30 minutos para não queimar a cota, e nenhum temporizador. O gatilho é
 * sempre a tela chamando `explicacoes()`: sem ela, nada roda.
 *
 * Linha medida em 06/10: `gemini-3.8-flash-low` com `stream-json` devolve o texto
 * inteiro e o gasto no último evento (`result`). 30 itens levaram ~11 s e ~18,5 mil
 * tokens.
 *
 * Dado: `explicacoes.jsonl` no abrigo, só por acréscimo, duas linhas possíveis:
 * `explicacao` (uma por item) e `chamada` (uma por lote, com o gasto).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'
import { limparSegredos } from './segredo.mjs'
import * as B from './backlog.mjs'
import { nomeDe } from './caminho.mjs'
import { comDataReal } from './dataReal.mjs'

const LOTE = 30
const ESPERA_FALHA_MS = 30 * 60 * 1000
const RECENTE_DIAS = 14
const MAX_FILA = 4
const ARQ = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'explicacoes.jsonl')
const CAIXA = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'agy-caixa')
const AGY = () => process.env.CC_AGY_BIN || path.join(os.homedir(), '.local', 'bin', 'agy')
const MODELO = () => process.env.CC_AGY_MODELO || 'gemini-3.8-flash-low'

// ponytail: o arquivo só cresce, sem compactar (~1,6 MB para 4 mil itens); compactar quando passar disso
// ponytail: as tentativas vivem só na memória; reiniciar o painel dá mais duas chances a quem foi recusado
let carregado = false
const memoria = new Map() // k -> { id, oque, muda, em }
const chamadas = []
const tentativas = new Map() // k -> recusas
const fila = [] // { raiz, ids: Set }
let rodando = null // { raiz, lote: Set de ids }
let pausaAte = 0

const pad = (n) => String(n).padStart(2, '0')
const iso = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const sha1 = (s) => createHash('sha1').update(s).digest('hex')

export const textoDoItem = (i) => String(i.intencao || i.titulo || '')

/** A chave da explicação. A prova fica de fora: fechar o item não pede texto novo. */
export const chave = (projeto, i) => `${projeto}::${i.id}::${sha1(textoDoItem(i) + '\n' + (i.pronto || '')).slice(0, 12)}`

/** null: não se explica (cancelado, micro tarefa). 0 aberto, 1 fechado há pouco, 2 o resto. */
export function prioridade(i, hojeIso) {
  if (i.estado === 'KO' || i.pai) return null
  if (i.estado !== 'OK') return 0
  const f = String(i.fechado || '').slice(0, 10)
  if (!i.semData && /^\d{4}-\d\d-\d\d$/.test(f) && (Date.parse(hojeIso) - Date.parse(f)) / 864e5 <= RECENTE_DIAS) return 1
  return 2
}

const maisRecente = (a, b) => String(b.fechado || b.mexido || '').localeCompare(String(a.fechado || a.mexido || ''))

/**
 * Quem entra no lote. Primeiro os pedidos (o que está na tela), depois o recheio:
 * abertos e fechados há pouco. O resto (prioridade 2) só entra quando é pedido.
 */
export function montarLote(itens, { projeto, pedidos = [], hoje, ja = () => false, max = LOTE }) {
  const cand = itens.map((i) => ({ i, p: prioridade(i, hoje) })).filter((c) => c.p !== null && !ja(chave(projeto, c.i)))
  const pede = new Set(pedidos)
  const pedidos2 = cand.filter((c) => pede.has(c.i.id)).sort((a, b) => a.p - b.p || maisRecente(a.i, b.i))
  const recheio = [0, 1].flatMap((p) => cand.filter((c) => !pede.has(c.i.id) && c.p === p).sort((a, b) => maisRecente(a.i, b.i)))
  return [...pedidos2, ...recheio].slice(0, max).map((c) => c.i)
}

// travessão e meia-risca viram vírgula; escritos por código para o arquivo não carregar nenhum
const SEM_TRACO = new RegExp('\\s*[' + String.fromCharCode(0x2014, 0x2013) + ']\\s*', 'g')
const corta = (s, n) => limparSegredos(s).replace(SEM_TRACO, ', ').replace(/\s+/g, ' ').trim().slice(0, n)

const PEDIDO = `Explique cada item abaixo para o dono do produto, que decide mas não programa. Para cada um, duas frases curtas em português do Brasil: 'oque' (o que este item faz ou fez, em palavras comuns) e 'muda' (o que muda para ele no dia a dia). Proibido: nome de arquivo, nome de função, número de item, termo técnico sem explicação, travessão. Não use ferramentas. Responda SÓ um JSON: [{"id":"...","oque":"...","muda":"..."}].`

export function promptDoLote(itens, nome) {
  const linhas = itens.map((i) => JSON.stringify({
    id: i.id,
    intencao: corta(textoDoItem(i), 200),
    pronto: corta(i.pronto, 300),
    ...(i.estado === 'OK' ? { prova: corta(i.prova, 200) } : {}),
  }))
  return `${PEDIDO}\n\nPROJETO: ${nome}\n${linhas.join('\n')}`
}

/** O texto da resposta e o gasto, do stream do agy. `uso` é null quando o `result` não veio. */
export function lerStream(saida) {
  let resposta = ''; let uso = null; let pedacos = ''
  for (const l of String(saida || '').split('\n')) {
    let o; try { o = JSON.parse(l) } catch { continue }
    if (o?.event === 'result') {
      resposta = String(o.result?.response || '')
      const u = o.result?.usage
      if (u) uso = { entrada: u.input_tokens || 0, saida: u.output_tokens || 0, pensamento: u.thinking_tokens || 0, total: u.total_tokens || 0 }
    } else if (o?.step_update?.step_type === 'agent_response' && o.step_update.text_delta) {
      pedacos += o.step_update.text_delta
    }
  }
  return { texto: resposta || pedacos, uso }
}

const PROIBIDO = /\b[A-Z]{2,4}-\d{1,5}\b|\.(?:m?js|ts|html|css|jsonl?|md|py|sh)\b|\w\(\)/
const frase = (s) => {
  const t = String(s || '').replace(SEM_TRACO, ', ').replace(/\s+/g, ' ').trim()
  return t.length >= 8 && t.length <= 300 && !PROIBIDO.test(t) ? t : null
}

/** O JSON da resposta, item a item. `recusadas` são os pedidos que não ficaram bons. */
export function lerResposta(texto, ids) {
  const pedidos = [...ids]
  const a = String(texto || '').indexOf('['); const b = String(texto || '').lastIndexOf(']')
  let lista = []
  try { lista = JSON.parse(String(texto).slice(a, b + 1)) } catch { /* resposta fora do formato: nada serve */ }
  const boas = []
  for (const o of Array.isArray(lista) ? lista : []) {
    const oque = frase(o?.oque); const muda = frase(o?.muda)
    if (oque && muda && pedidos.includes(o.id) && !boas.some((x) => x.id === o.id)) boas.push({ id: o.id, oque, muda })
  }
  return { boas, recusadas: pedidos.filter((id) => !boas.some((x) => x.id === id)) }
}

function carregar() {
  if (carregado) return
  carregado = true
  let cru = ''
  try { cru = fs.readFileSync(ARQ(), 'utf8') } catch { return }
  for (const l of cru.split('\n')) {
    let o; try { o = JSON.parse(l) } catch { continue }
    if (o.tipo === 'explicacao') memoria.set(o.k, o)
    else if (o.tipo === 'chamada') chamadas.push(o)
  }
}

function acrescentar(linhas) {
  try {
    fs.mkdirSync(path.dirname(ARQ()), { recursive: true })
    fs.appendFileSync(ARQ(), linhas.map((l) => JSON.stringify(l)).join('\n') + '\n')
  } catch { /* a explicação continua na memória; só não sobrevive ao reinício */ }
}

/** A soma de todas as chamadas feitas. */
export function gasto() {
  carregar()
  const g = { chamadas: 0, itens: 0, entrada: 0, saida: 0, pensamento: 0, tokens: 0 }
  for (const c of chamadas) {
    g.chamadas += 1; g.itens += c.boas || 0; g.entrada += c.entrada || 0
    g.saida += c.saida || 0; g.pensamento += c.pensamento || 0; g.tokens += c.total || 0
  }
  return g
}

const desistida = (k) => (tentativas.get(k) || 0) >= 2

function proximo(agora = Date.now()) {
  if (rodando || !fila.length || agora < pausaAte) return
  const job = fila.shift()
  const projeto = nomeDe(job.raiz)
  const lido = B.ler(B.caminhoPadrao(job.raiz))
  const itens = lido.existe ? comDataReal(job.raiz, lido.itens) : []
  const lote = montarLote(itens, { projeto, pedidos: [...job.ids], hoje: iso(Date.now()), ja: (k) => memoria.has(k) || desistida(k) })
  if (!lote.length) { proximo(); return }
  const ks = new Map(lote.map((i) => [i.id, chave(projeto, i)]))
  rodando = { raiz: job.raiz, lote: new Set(ks.keys()) }
  try { fs.mkdirSync(CAIXA(), { recursive: true }) } catch { /* segue */ }
  const ini = Date.now()
  execFile(AGY(), ['--sandbox', '--model', MODELO(), '--output-format', 'stream-json', '--print-timeout', '150s', '-p', promptDoLote(lote, projeto)],
    { cwd: CAIXA(), timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
    (err, stdout) => {
      carregar()
      const { texto, uso } = lerStream(stdout)
      const { boas, recusadas } = err ? { boas: [], recusadas: [] } : lerResposta(texto, ks.keys())
      const em = Date.now()
      const linhas = boas.map((b) => ({ tipo: 'explicacao', k: ks.get(b.id), projeto, id: b.id, oque: b.oque, muda: b.muda, em }))
      const chamada = {
        tipo: 'chamada', em, projeto, itens: lote.length, boas: boas.length, ok: !err && boas.length > 0,
        segundos: Math.round((em - ini) / 100) / 10, entrada: uso?.entrada || 0, saida: uso?.saida || 0,
        pensamento: uso?.pensamento || 0, total: uso?.total || 0,
        ...(err ? { erro: String(err.message || err).slice(0, 200) } : {}),
      }
      for (const l of linhas) memoria.set(l.k, l)
      chamadas.push(chamada)
      acrescentar([...linhas, chamada])
      // falha ou nada aproveitável: a culpa não é do item, espera e não conta recusa
      if (!chamada.ok) pausaAte = em + ESPERA_FALHA_MS
      else for (const id of recusadas) tentativas.set(ks.get(id), (tentativas.get(ks.get(id)) || 0) + 1)
      rodando = null
      proximo()
    })
}

/**
 * O que já está escrito para estes ids, e o que falta vai para a fila.
 * Quem chama é a tela: é o único gatilho, e ele também religa a fila depois de uma pausa.
 */
export function explicacoes(raiz, ids, { agora = Date.now() } = {}) {
  carregar()
  const projeto = nomeDe(raiz)
  const pedidos = new Set(ids)
  const lido = B.ler(B.caminhoPadrao(raiz))
  const itens = (lido.existe ? comDataReal(raiz, lido.itens) : []).filter((i) => pedidos.has(i.id))
  const out = {}; const desistiu = []; const faltam = []
  for (const i of itens) {
    const k = chave(projeto, i); const e = memoria.get(k)
    if (e) out[i.id] = { oque: e.oque, muda: e.muda }
    else if (desistida(k)) desistiu.push(i.id)
    else faltam.push(i.id)
  }
  const semAgy = !fs.existsSync(AGY())
  const novos = faltam.filter((id) => !(rodando?.raiz === raiz && rodando.lote.has(id)))
  if (!semAgy && novos.length) {
    const job = fila.find((f) => f.raiz === raiz)
    if (job) novos.forEach((id) => job.ids.add(id))
    else if (fila.length < MAX_FILA) fila.push({ raiz, ids: new Set(novos) })
    proximo(agora)
  }
  let estado = null
  if (faltam.length) estado = semAgy ? 'sem agy' : (agora < pausaAte ? 'pausa' : (rodando ? 'escrevendo' : (fila.length ? 'na fila' : null)))
  return { itens: out, desistiu, estado, gasto: gasto() }
}

export const _ocupado = () => Boolean(rodando || fila.length)
export function _zerar() {
  carregado = false; memoria.clear(); chamadas.length = 0; tentativas.clear(); fila.length = 0; rodando = null; pausaAte = 0
}
