/**
 * O resumo de um projeto para a tela Projetos (26/09, decisões dele a partir
 * da imagem de referência):
 *
 * - **descrição**: "do CLAUDE.md do projeto". A primeira frase da seção
 *   "## Projeto" do CLAUDE.md; sem ela, a primeira frase do
 *   docs/produto/VISAO.md. Sem nenhum dos dois, fica null (a tela não inventa).
 * - **roadmap**: itens feitos sobre o total do docs/ROADMAP.md, lido pelo
 *   mesmo leitor do mapa (`lerRoadmap`). A outra barra, a do MVP, a tela já
 *   tem pelo framework.
 *
 * Só lê pasta DESTA máquina. Cache por data de modificação dos arquivos: a
 * tela pede de minuto em minuto e o arquivo quase nunca muda.
 */
import fs from 'node:fs'
import path from 'node:path'
import { lerRoadmap, acharRoadmap } from './roadmap.mjs'

const cache = new Map() // raiz -> { chave, valor }

const mtime = (f) => { try { return fs.statSync(f).mtimeMs } catch { return 0 } }

/** Primeira frase de um parágrafo em markdown, sem marcação, até 160 letras. */
export function primeiraFrase(texto) {
  const limpo = String(texto || '')
    .replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\*([^*]*)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()
  if (!limpo) return null
  const m = limpo.match(/^(.+?[.!?])(\s|$)/)
  const frase = (m ? m[1] : limpo).trim()
  return frase.length > 160 ? frase.slice(0, 157).trimEnd() + '…' : frase
}

/** O primeiro parágrafo de texto corrido depois de um título, pulando
 *  citação, lista, tabela, código e comentário. */
export function paragrafoDepois(md, titulo) {
  const linhas = String(md || '').split(/\r?\n/)
  let i = titulo ? linhas.findIndex((l) => titulo.test(l)) : 0
  if (i < 0) return null
  if (titulo) i += 1
  const par = []
  for (; i < linhas.length; i++) {
    const l = linhas[i]
    if (/^#{1,6}\s/.test(l)) { if (par.length) break; if (titulo) break; continue }
    if (!l.trim()) { if (par.length) break; continue }
    if (/^\s*(>|[-*+]\s|\d+\.\s|\||```|<!--)/.test(l)) { if (par.length) break; continue }
    par.push(l.trim())
  }
  return par.length ? par.join(' ') : null
}

export function resumoDoProjeto(raiz) {
  if (!raiz) return null
  const claude = path.join(raiz, 'CLAUDE.md')
  const visao = path.join(raiz, 'docs', 'produto', 'VISAO.md')
  const roadmap = acharRoadmap(raiz)
  const chave = [mtime(claude), mtime(visao), roadmap ? mtime(roadmap) : 0].join(':')
  const c = cache.get(raiz)
  if (c && c.chave === chave) return c.valor

  let descricao = null
  try { descricao = primeiraFrase(paragrafoDepois(fs.readFileSync(claude, 'utf8'), /^##\s+Projeto\b/i)) } catch { /* sem CLAUDE.md */ }
  if (!descricao) {
    try { descricao = primeiraFrase(paragrafoDepois(fs.readFileSync(visao, 'utf8'), /^#\s/)) } catch { /* sem VISAO.md */ }
  }

  let rm = null
  try {
    const mapa = lerRoadmap(raiz)
    if (mapa) {
      let feitos = 0; let total = 0
      for (const g of mapa.grupos || []) for (const f of g.frentes || []) { total += 1; if (f.estado === 'feito') feitos += 1 }
      if (total) rm = { feitos, total }
    }
  } catch { /* roadmap ilegível: sem barra, não barra zerada */ }

  const valor = { descricao, roadmap: rm }
  cache.set(raiz, { chave, valor })
  return valor
}
