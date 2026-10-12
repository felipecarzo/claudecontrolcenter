/**
 * CC-1038: a aba Revisões do painel. Uma "revisão" é um conjunto de baralhos de um projeto que ele revisa no Tinder:
 * os textos do app (`textos-*`, gerados por `cc textos levantar`), as telas desenhadas (`design`), as fotos e o resto.
 * Aqui só mora a conta: quantas cartas, quantas aprovadas, editadas, recusadas e pendentes, e se há edição para aplicar.
 */
import path from 'node:path'
import fs from 'node:fs'
import { listarDecks, lerDeck, votos } from './cartas.mjs'

const NOMES = { textos: 'Textos do app', design: 'Telas desenhadas', telas: 'Telas do site', 'textos-site': 'Textos do site' }
const familia = (deck) => (/^textos-/.test(deck) && !/^textos-site/.test(deck) ? 'textos' : deck)
const tipoDoVoto = (v) => {
  const e = (v.escolhas || [])[0] || ''
  if (/^Aprovo/i.test(e)) return 'aprovados'
  if (/^Editar/i.test(e)) return 'editados'
  if (/^(Recuso|Não aprovo|Pedir ajuste)/i.test(e)) return 'recusados'
  return 'outros'
}

/** As revisões de um projeto, ou lista vazia. Nunca lança. */
export function revisoesDe(raiz) {
  const grupos = new Map()
  for (const deck of listarDecks(raiz)) {
    const d = lerDeck(raiz, deck)?.deck; if (!d) continue
    const chave = familia(deck)
    const g = grupos.get(chave) || { chave, titulo: NOMES[chave] || d.titulo, decks: [], total: 0, aprovados: 0, editados: 0, recusados: 0, outros: 0 }
    const ids = new Set(d.cartas.map((c) => c.id)); const ultimo = new Map()
    for (const v of votos(raiz, deck)) if (ids.has(v.carta)) ultimo.set(v.carta, v) // um voto por carta (o painel recusa o segundo)
    g.decks.push(deck); g.total += d.cartas.length
    for (const v of ultimo.values()) g[tipoDoVoto(v)] += 1
    grupos.set(chave, g)
  }
  const temFontes = fs.existsSync(path.join(raiz, 'docs', 'cartas', 'textos.fontes.json'))
  return [...grupos.values()].map((g) => ({ ...g, pendentes: g.total - g.aprovados - g.editados - g.recusados - g.outros, podeAplicar: g.chave === 'textos' && temFontes && g.editados > 0 })).sort((a, b) => b.pendentes - a.pendentes)
}

/** As revisões de todos os projetos que têm alguma. */
export function listar(raizes) {
  const r = []
  for (const raiz of raizes) {
    const revisoes = revisoesDe(raiz); if (!revisoes.length) continue
    r.push({ raiz, projeto: path.basename(raiz).replace(/^(VPS|PC)_/, ''), revisoes })
  }
  return r.sort((a, b) => b.revisoes.reduce((s, x) => s + x.pendentes, 0) - a.revisoes.reduce((s, x) => s + x.pendentes, 0))
}
