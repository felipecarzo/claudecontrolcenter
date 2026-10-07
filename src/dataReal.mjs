// CC-937: a data real de fechamento dos itens que a migração fechou em lote.
// Nada aqui grava: o backlog continua com a data gravada, e a leitura reinterpreta.
//
// A regra, em ordem: fora do dia do lote vale a data gravada. No dia do lote vale a
// data mais recente ANTES dele, entre a escrita no texto do item, a citação do id no
// diário e nos commits. Sem isso, a criação. Sem isso, o item fica "sem data".

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ISO = /^\d{4}-\d\d-\d\d/
const dia10 = (s) => (ISO.test(String(s || '')) ? String(s).slice(0, 10) : null)

/** 'CC-042' vira 'CC-42', para casar com o "CC-42" dos commits. */
export const idNormal = (id) => String(id).replace(/^([A-Za-z]+)-0*(\d+)$/, (_, p, n) => p.toUpperCase() + '-' + n)

/** O dia do lote: a data de `fechado` mais comum entre os OK migrados, quando são 10 ou mais; senão null. */
export function diaDoLote(itens) {
  const cont = new Map()
  for (const i of itens) {
    const d = dia10(i.fechado)
    if (i.estado === 'OK' && /^migrado/.test(i.origem || '') && d) cont.set(d, (cont.get(d) || 0) + 1)
  }
  let melhor = null
  for (const [d, n] of cont) if (melhor === null || n > cont.get(melhor)) melhor = d
  return melhor && cont.get(melhor) >= 10 ? melhor : null
}

const pad = (n) => String(n).padStart(2, '0')

/** Cada DD/MM, DD/MM/AA ou DD/MM/AAAA do texto, como AAAA-MM-DD. Sem ano: o do lote, recuando um se cair depois dele. */
// ponytail: fração do tipo "1/9" pode passar por data; o piso, o criado e o "antes do lote" cortam quase todas
export function datasNoTexto(texto, lote) {
  const out = []
  const re = /\b([0-3]?\d)\/([01]?\d)(?:\/((?:20)?\d\d))?\b/g
  let m
  while ((m = re.exec(String(texto || '')))) {
    const d = +m[1]; const mes = +m[2]
    let a = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : +String(lote).slice(0, 4)
    const f = (ano) => `${ano}-${pad(mes)}-${pad(d)}`
    if (!m[3] && f(a) > lote) a -= 1
    const t = new Date(a, mes - 1, d)
    if (t.getDate() === d && t.getMonth() === mes - 1) out.push(f(a))
  }
  return out
}

/** Onde cada id foi citado antes do lote: `mapa` (idNormal -> dias) e `piso` (a data mais antiga que o projeto registra). */
export function citacoes(raiz, lote) {
  const mapa = new Map(); let piso = null
  const nota = (d) => { if (!piso || d < piso) piso = d }
  const ler = (dia, texto) => {
    nota(dia)
    if (dia >= lote) return
    for (const m of String(texto).matchAll(/\b([A-Z]{2,4})-0*(\d{1,5})\b/g)) {
      const k = m[1] + '-' + m[2]
      const l = mapa.get(k) || []
      if (!l.includes(dia)) l.push(dia)
      mapa.set(k, l)
    }
  }
  const pasta = path.join(raiz, 'docs', 'diario')
  let nomes = []; try { nomes = fs.readdirSync(pasta) } catch { /* sem diário */ }
  for (const n of nomes.filter((x) => /^\d{4}-\d\d-\d\d\.md$/.test(x))) {
    try { ler(n.slice(0, 10), fs.readFileSync(path.join(pasta, n), 'utf8')) } catch { /* arquivo ilegível */ }
  }
  if (fs.existsSync(path.join(raiz, '.git'))) {
    let log = ''
    try { log = execFileSync('git', ['-C', raiz, 'log', '--format=%x1e%ad%x1f%B', '--date=short'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { /* sem git */ }
    for (const bloco of log.split('\x1e')) {
      const [d, corpo = ''] = bloco.split('\x1f')
      if (ISO.test(d)) ler(d.slice(0, 10), corpo)
    }
  }
  return { mapa, piso }
}

/** `{ dia, fonte }` de um item; `fonte` é 'gravada', 'texto', 'registro', 'criado' ou null (sem data). */
export function dataReal(item, { lote, mapa = new Map(), piso = null }) {
  const gravado = dia10(item.fechado)
  if (!lote || item.estado !== 'OK' || gravado !== lote) return { dia: item.fechado, fonte: 'gravada' }
  const criado = dia10(item.criado)
  const minimo = [piso, criado && criado < lote ? criado : null].filter(Boolean).sort().at(-1) || ''
  const vale = (d) => d < lote && d >= minimo
  // o texto foi escrito por gente antes da migração: "provado em 11/09" no próprio dia do lote é data real.
  // Diário e commit do dia do lote não valem, porque a migração cita todos os itens.
  const texto = datasNoTexto([item.prova, item.intencao, item.titulo, item.porque].filter(Boolean).join('\n'), lote).filter((d) => d <= lote && d >= minimo).sort().at(-1)
  const registro = (mapa.get(idNormal(item.id)) || []).filter(vale).sort().at(-1)
  if (texto && (!registro || texto >= registro)) return { dia: texto, fonte: 'texto' }
  if (registro) return { dia: registro, fonte: 'registro' }
  if (criado && criado < lote) return { dia: criado, fonte: 'criado' }
  return { dia: null, fonte: null }
}

const guardadas = new Map()

/** Os itens com a data real no lugar de `fechado`. Sem lote, devolve `itens` como está. Nunca grava. */
export function comDataReal(raiz, itens) {
  const lote = diaDoLote(itens)
  if (!lote) return itens
  const chave = raiz + '|' + lote
  // ponytail: prova anterior ao lote não muda; um diário escrito com data antiga só entra ao reiniciar o painel
  if (!guardadas.has(chave)) guardadas.set(chave, citacoes(raiz, lote))
  const { mapa, piso: pisoRegistro } = guardadas.get(chave)
  const criados = itens.map((i) => dia10(i.criado)).filter(Boolean)
  const piso = [pisoRegistro, ...criados].filter(Boolean).sort()[0] || null
  return itens.map((i) => {
    const { dia, fonte } = dataReal(i, { lote, mapa, piso })
    if (fonte === 'gravada') return i
    if (fonte === null) return { ...i, semData: true, fonteData: null }
    return { ...i, fechado: dia, fonteData: fonte }
  })
}
