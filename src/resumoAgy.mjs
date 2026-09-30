/**
 * Resumo das sessões paradas feito pelo agy (CC-599, 27/09). Pedido dele:
 * *"tem casos como esse que não dá pra entender o contexto (…) usando comandos
 * pro agy pra ele criar resumos de repente? o que for mais rápido e prático"*.
 * Decisão dele: automático, um resumo por parada.
 *
 * Medido antes de construir: o agy resumiu uma conversa de 8,5 mil letras em
 * 6,8 s, no ponto ("parou analisando as capturas da tela de prévia (…) não
 * precisa de nenhuma ação sua no momento").
 *
 * Como funciona:
 *  - a chave é conversa + marca da última fala: parada nova, resumo novo;
 *  - fila de um por vez, em segundo plano (processo separado, não trava o
 *    painel); a tela mostra o que já está pronto;
 *  - falha fica anotada e só tenta de novo depois de 30 minutos, para não
 *    queimar a cota do plano Google dele repetindo o mesmo erro;
 *  - guarda no abrigo, os 300 mais recentes.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

const ARQ = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'resumos-agy.json')
const CAIXA = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'agy-caixa')
const AGY = path.join(os.homedir(), '.local', 'bin', 'agy')
const ESPERA_FALHA_MS = 30 * 60 * 1000
const MAX_FILA = 20

let cache = null
const fila = []
let rodando = null

function ler() {
  if (cache) return cache
  try { cache = JSON.parse(fs.readFileSync(ARQ(), 'utf8')) } catch { cache = {} }
  return cache
}
function gravar() {
  const c = ler()
  const chaves = Object.keys(c).sort((a, b) => (c[b].em || 0) - (c[a].em || 0)).slice(0, 300)
  const enxuto = Object.fromEntries(chaves.map((k) => [k, c[k]]))
  cache = enxuto
  try {
    fs.mkdirSync(path.dirname(ARQ()), { recursive: true })
    fs.writeFileSync(`${ARQ()}.tmp`, JSON.stringify(enxuto))
    fs.renameSync(`${ARQ()}.tmp`, ARQ())
  } catch { /* resumo é conveniência */ }
}

const chave = (conversa, marca) => `${conversa}::${marca || ''}`

/**
 * O que mandar ao agy: o último pedido dele e, desde então, as falas do
 * agente e as ações em uma linha cada. Os últimos 10 mil caracteres.
 */
export function contextoDaConversa(texto) {
  const linhas = String(texto || '').split('\n')
  let inicio = -1; let pedido = null
  for (let j = linhas.length - 1; j >= 0; j -= 1) {
    let o = null
    try { o = JSON.parse(linhas[j]) } catch { continue }
    if (o?.type !== 'user' || o.isMeta) continue
    const c = o.message?.content
    const t = typeof c === 'string' ? c : (Array.isArray(c) ? (c.find((x) => x?.type === 'text') || {}).text : null)
    if (t && !/^<(command|system|local-command)/.test(t.trim())) { inicio = j; pedido = t; break }
  }
  const out = [pedido ? 'PEDIDO DO DONO: ' + pedido.slice(0, 1500) : 'PEDIDO DO DONO: (não achado)']
  for (let j = inicio + 1; j < linhas.length; j += 1) {
    let o = null
    try { o = JSON.parse(linhas[j]) } catch { continue }
    if (o?.type !== 'assistant' || o.isSidechain) continue
    for (const x of o.message?.content || []) {
      if (x?.type === 'text' && x.text?.trim()) out.push('AGENTE: ' + x.text.trim())
      if (x?.type === 'tool_use') out.push('AÇÃO ' + x.name + ': ' + JSON.stringify(x.input || {}).slice(0, 140))
    }
  }
  return out.join('\n').slice(-10000)
}

/* CC-737, pedido dele em 30/09: separar a sessão que espera RESPOSTA dele da
   que espera um TESTE dele ("pronto para QA"), para testar todas de uma vez.
   A etiqueta vem do mesmo resumo, na primeira linha: nenhuma chamada nova. */
export const INSTRUCAO_ETIQUETA = `A PRIMEIRA linha da sua resposta é só uma destas três etiquetas, sozinha:
ETIQUETA: RESPONDER  (o agente espera uma resposta, decisão, senha ou ordem do dono)
ETIQUETA: TESTAR  (o agente entregou algo e espera o dono abrir, testar ou conferir)
ETIQUETA: NADA  (não espera nada do dono: seguiu sozinho, ou só informou)
Depois, o texto pedido.

`
const PEDIDO = `Resuma em português do Brasil, em no máximo 4 linhas curtas, para o dono do projeto que lê no celular: o que o agente fez desde o pedido, em que ponto parou, e se espera alguma coisa do dono. Sem jargão técnico, sem travessão. Não use ferramentas, só leia o texto abaixo.

${INSTRUCAO_ETIQUETA}`

const ETIQUETAS = { RESPONDER: 'responder', TESTAR: 'testar', NADA: 'nada' }
/** Separa a etiqueta da primeira linha do resto do texto. Sem etiqueta, null. */
export function lerEtiqueta(saida) {
  const m = /^\s*\**\s*ETIQUETA\s*:\s*\**\s*(RESPONDER|TESTAR|NADA)\b[^\n]*\n?/i.exec(String(saida || ''))
  if (!m) return { etiqueta: null, texto: String(saida || '').trim() }
  return { etiqueta: ETIQUETAS[m[1].toUpperCase()], texto: String(saida).slice(m[0].length).trim() }
}

/* A correção dele, com um toque no cartão, vence o agy e fica guardada por parada. */
export function corrigirEtiqueta(k, etiqueta) {
  if (!k || !['responder', 'testar', 'nada'].includes(etiqueta)) return false
  const c = ler()
  if (!c[k]?.texto) return false // só corrige resumo que existe: a chave vem da tela
  c['eti::' + k] = { etiqueta, em: Date.now() }
  gravar()
  return true
}
const etiquetaDe = (k, r) => ler()['eti::' + k]?.etiqueta || r?.etiqueta || null

function proximo() {
  if (rodando || !fila.length) return
  const job = fila.shift()
  rodando = job
  try { fs.mkdirSync(CAIXA(), { recursive: true }) } catch { /* segue */ }
  let texto = ''
  if (!job.prompt) { try { texto = fs.readFileSync(job.arquivo, 'utf8') } catch { /* sem arquivo */ } }
  const prompt = job.prompt || PEDIDO + contextoDaConversa(texto.slice(-4 * 1024 * 1024))
  execFile(AGY, ['--sandbox', '--effort', 'low', '--print-timeout', '90s', '-p', prompt],
    { cwd: CAIXA(), timeout: 120000, maxBuffer: 1024 * 1024 },
    (err, stdout) => {
      const saida = String(stdout || '').trim()
      const c = ler()
      c[job.k] = err || !saida
        ? { erro: String(err?.message || 'resposta vazia').slice(0, 200), em: Date.now() }
        : (() => { const { etiqueta, texto } = lerEtiqueta(saida); return { texto: texto.replace(/[—–]/g, ',').slice(0, 1200), etiqueta, em: Date.now() } })()
      gravar()
      rodando = null
      proximo()
    })
}

/** Pede o resumo desta parada, se ainda não tem nem está na fila. */
export function pedir({ conversa, marca, arquivo }) {
  if (!conversa || !arquivo || !fs.existsSync(AGY)) return
  const k = chave(conversa, marca)
  const r = ler()[k]
  // CC-737: resumo antigo, de antes da etiqueta, é pedido de novo uma vez
  if (r && ((r.texto && 'etiqueta' in r) || (!r.texto && Date.now() - r.em < ESPERA_FALHA_MS))) return
  if ((rodando && rodando.k === k) || fila.some((f) => f.k === k) || fila.length >= MAX_FILA) return
  fila.push({ k, conversa, marca, arquivo })
  proximo()
}

/** O resumo pronto, ou o estado ("na fila", "resumindo"), ou null. */
export function obter(conversa, marca) {
  const k = chave(conversa, marca)
  const r = ler()[k]
  if (r?.texto) return { texto: r.texto, etiqueta: etiquetaDe(k, r), k }
  if (rodando?.k === k) return { estado: 'resumindo' }
  if (fila.some((f) => f.k === k)) return { estado: 'na fila' }
  return null
}

/* CC-671: o mesmo agy, a mesma fila e o mesmo arquivo, para texto pronto (a
   tela Ideias pede título e resumo de cada ideia). A chave vem de quem pede. */
export function pedirTexto({ k, prompt, comEtiqueta = false }) {
  if (!k || !prompt || !fs.existsSync(AGY)) return
  const r = ler()[k]
  if (r && ((r.texto && (!comEtiqueta || 'etiqueta' in r)) || (!r.texto && Date.now() - r.em < ESPERA_FALHA_MS))) return
  if ((rodando && rodando.k === k) || fila.some((f) => f.k === k) || fila.length >= MAX_FILA) return
  fila.push({ k, prompt })
  proximo()
}
export function obterTexto(k) {
  const r = ler()[k]
  if (r?.texto) return { texto: r.texto, etiqueta: etiquetaDe(k, r), k }
  if (rodando?.k === k || fila.some((f) => f.k === k)) return { estado: 'resumindo' }
  return null
}
