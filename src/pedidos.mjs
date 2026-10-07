/**
 * CC-858: o pedido que ele digita (ou dita) para os agentes.
 *
 * O texto solto vira item do backlog do projeto certo, com as palavras dele na
 * citação. O projeto é adivinhado pelo texto e fica trocável na tela: palpite
 * errado não pode virar item no lugar errado sem ele ver. Pedido nasce com
 * origem `pedido-dele`, que é como a lista de pedidos o reconhece depois.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as B from './backlog.mjs'
import { catalogoDe } from './frentes.mjs'
import { nomeCanonico } from './nomeProjeto.mjs'

export const ORIGEM = 'pedido-dele'
const TETO = 140

const limpo = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const palavras = (s) => limpo(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2)
const curto = (n) => nomeCanonico(String(n).replace(/^(VPS|PC)_/i, ''))

/** Quanto o texto fala deste projeto: nome inteiro vale mais que pedaço dele. */
function pontos(texto, nome) {
  const t = limpo(texto)
  const n = limpo(curto(nome)).replace(/[^a-z0-9]/g, '')
  if (!n) return 0
  if (t.replace(/[^a-z0-9]/g, '').includes(n)) return 10
  return palavras(nome.replace(/^(VPS|PC)_/i, '').replace(/([a-z])([A-Z])/g, '$1 $2')).filter((w) => palavras(texto).includes(w)).length * 3
}

/** projetos: [{ raiz }]. Devolve o melhor palpite e as alternativas, do mais ao menos provável. */
export function adivinhar(texto, projetos) {
  const lista = projetos.map((p) => ({ raiz: p.raiz, nome: curto(path.basename(p.raiz)), pontos: pontos(texto, path.basename(p.raiz)) }))
    .sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome))
  return { palpite: lista[0]?.pontos > 0 ? lista[0] : null, alternativas: lista }
}

/** Sem catálogo qualquer frente vale; com ele, a que mais casa com o texto, senão a primeira. */
function frenteDe(texto, arquivo) {
  const cat = catalogoDe(arquivo)
  if (!cat) return 'sem frente'
  const w = new Set(palavras(texto))
  const melhor = Object.entries(cat).map(([c, d]) => [c, palavras(`${c} ${d}`).filter((x) => w.has(x)).length]).sort((a, b) => b[1] - a[1])[0]
  return melhor?.[0] || Object.keys(cat)[0]
}

/** Cria o item. Lança erro com o motivo quando o texto ou o projeto não servem. */
export function criar({ texto, raiz }, projetos) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim()
  if (t.length < 5) throw new Error('escreva o pedido com pelo menos uma frase')
  if (!projetos.some((p) => p.raiz === raiz)) throw new Error('esse projeto não é conhecido')
  const arquivo = B.caminhoPadrao(raiz)
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  const { itens } = B.ler(arquivo)
  return B.acrescentar({
    prefixo: B.prefixoDoProjeto(itens, raiz),
    intencao: t.length > TETO ? `${t.slice(0, TETO - 1)}…` : t,
    frente: frenteDe(t, arquivo),
    estado: 'B0',
    origem: ORIGEM,
    natureza: 'PED',
    area: 'agente',
    tamanho: 'M',
    pronto: 'o agente entrega e ele vê o resultado funcionando',
    conferir: 'dele: ele olha e diz se era isso',
    citacao: t,
  }, arquivo)
}

/** O estado do item dito do jeito dele, não do jeito do backlog. */
export const ROTULO = { B0: 'na fila', B1: 'na fila', EM: 'em andamento', PR: 'em prova', DE: 'esperando você', TR: 'travada', OK: 'feita', KO: 'cancelada' }

export function listar(projetos) {
  const out = []
  for (const p of projetos) {
    let itens = []
    try { itens = B.ler(B.caminhoPadrao(p.raiz)).itens } catch { continue }
    for (const i of itens) {
      if (i.origem !== ORIGEM) continue
      out.push({ id: i.id, projeto: curto(path.basename(p.raiz)), raiz: p.raiz, texto: i.citacao || i.intencao, estado: i.estado, rotulo: ROTULO[i.estado] || i.estado, criado: i.criado, mexido: i.mexido })
    }
  }
  return out.sort((a, b) => String(b.criado).localeCompare(String(a.criado)) || b.id.localeCompare(a.id))
}
