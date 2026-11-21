/**
 * CC-1103: o tipo de cada caixa do ROADMAP (Decidir, Executar ou Conferir), que escolhe modelo, esforço e ajudante.
 *
 * Pedido dele, da sessão do Capitão das Veredas, para gastar menos token: o raciocínio caro (decidir) fica no modelo
 * forte, e o que já está claro (rodar, medir, contar) vai para um modelo mais barato. O catálogo mora num arquivo só,
 * `dados/tipos-de-tarefa.json`. O tipo vem, nesta ordem: do que está ESCRITO na caixa (`[Executar]` ou `tipo: Conferir`),
 * do verbo com que ela começa, e, sem nenhum dos dois, do tipo padrão (Decidir): na dúvida não se economiza, porque foi no
 * Decidir que o esforço alto se pagou.
 *
 * Nada aqui troca o modelo da sessão dele: só diz qual é o indicado (a troca aparece no painel, regra dele).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CATALOGO = fileURLToPath(new URL('../dados/tipos-de-tarefa.json', import.meta.url))

const limpo = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function catalogo(arquivo = CATALOGO) {
  return JSON.parse(readFileSync(arquivo, 'utf8'))
}

/** Tira o que vem antes do verbo: negrito, número de item (`CV-05.2`, `3.`) e dois pontos. */
const semPrefixo = (t) => String(t || '').replace(/[*_`]/g, '').replace(/^\s*(?:[A-Z]{1,4}-\d+(?:\.\d+)*|\d+(?:\.\d+)*[.)]?)\s*[:.\-)]?\s*/, '').trim()

/**
 * O tipo de um texto de tarefa: { tipo, por, verbo }. `por`: 'escrito' (a caixa diz), 'verbo' (o começo dela) ou
 * 'padrão' (verbo desconhecido).
 */
export function tipoDe(texto, cat = catalogo()) {
  const nomes = Object.keys(cat.tipos)
  const dito = new RegExp(`(?:\\[|tipo:\\s*)(${nomes.join('|')})\\]?`, 'i').exec(String(texto || ''))
  if (dito) return { tipo: nomes.find((n) => n.toLowerCase() === dito[1].toLowerCase()), por: 'escrito', verbo: null }
  const verbo = limpo(semPrefixo(String(texto || '').replace(/^\s*(?:\[[ xX]\]\s*)/, ''))).split(/[^a-z]+/).find(Boolean) || ''
  for (const [nome, t] of Object.entries(cat.tipos)) if (t.verbos.some((v) => limpo(v) === verbo)) return { tipo: nome, por: 'verbo', verbo }
  return { tipo: cat.padrao, por: 'padrão', verbo: verbo || null }
}

/** O que o tipo manda fazer: modelo, esforço, onde roda e ajudante. */
export const indicadoDoTipo = (tipo, cat = catalogo()) => {
  const { modelo, esforco, onde, ajudante } = cat.tipos[tipo]
  return { modelo, esforco, onde, ajudante }
}

/** As caixas (`- [ ] texto`, `- [x] texto`) de um ROADMAP, cada uma com o tipo e o que ele manda. */
export function lerCaixas(markdown, cat = catalogo()) {
  const caixas = []
  for (const linha of String(markdown || '').split(/\r?\n/)) {
    const m = /^\s*[-*]\s*\[([ xX])\]\s*(.+?)\s*$/.exec(linha)
    if (!m) continue
    const t = tipoDe(m[2], cat)
    caixas.push({ texto: m[2], feita: m[1] !== ' ', ...t, ...indicadoDoTipo(t.tipo, cat) })
  }
  return caixas
}

/** A contagem por tipo, para ver de relance quanto do ROADMAP pode ir para o modelo barato. */
export const contar = (caixas) => caixas.reduce((c, x) => ({ ...c, [x.tipo]: (c[x.tipo] || 0) + 1 }), {})
