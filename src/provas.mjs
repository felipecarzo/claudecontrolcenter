/**
 * CC-920 (F1): as provas que esperam o olho dele viram cartas do Tinder, e ele as
 * aprova por cartão ou "todas as que vi". Só servidor: a tela entra na F2.
 *
 * A lógica mora aqui (e não dentro da rota) para testar em pasta temporária, com
 * `raizes` injetável. Pergunta de AGENTE não passa por aqui: continua uma a uma.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as B from './backlog.mjs'
import { _limpar as limparEspera } from './esperaDele.mjs'

export const MAX_IDS = 50
const TTL = 60_000
let cache = null // { em, chave, cartas }

/** As cartas das provas de uma lista de projetos. Guardadas por 60 s; invalidadas se um backlog mudou. */
export function cartasDeProvas({ raizes, agora = Date.now() }) {
  const chave = raizes.map((r) => { try { return r + ':' + fs.statSync(B.caminhoPadrao(r)).mtimeMs } catch { return null } }).filter(Boolean).join('|')
  if (cache && cache.chave === chave && agora - cache.em < TTL) return cache.cartas
  const cartas = []
  for (const raiz of raizes) {
    let itens = []
    try { itens = B.ler(B.caminhoPadrao(raiz)).itens } catch { continue }
    for (const i of itens) {
      if (!B.podeAprovarPorOlho(i)) continue
      cartas.push({ id: i.id, raiz, projeto: path.basename(raiz), titulo: i.intencao || i.titulo, porque: i.prova || i.pronto || '', opcoes: ['Aprovo', 'Não aprovo'], origem: 'prova' })
    }
  }
  cache = { em: agora, chave, cartas }
  return cartas
}

/**
 * Aprova ou devolve uma lista de provas. Resposta parcial honesta: um id inválido
 * não derruba os outros. `raizes` é a lista de projetos que o painel conhece.
 */
export function aprovar({ raiz, ids, escolha, nota }, { raizes, agora = new Date() }) {
  if (!raizes.includes(raiz)) throw new Error('projeto desconhecido')
  if (!Array.isArray(ids) || !ids.length) throw new Error('ids vazio')
  if (ids.length > MAX_IDS) throw new Error(`no máximo ${MAX_IDS} provas por vez`)
  if (escolha !== 'Aprovo' && escolha !== 'Não aprovo') throw new Error('escolha tem de ser "Aprovo" ou "Não aprovo"')
  const motivo = String(nota || '').trim().slice(0, 500)
  const arq = B.caminhoPadrao(raiz)
  const dia = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}`
  const resultados = {}
  for (const id of [...new Set(ids.map(String))]) { // id repetido conta uma vez só
    try {
      const item = B.ler(arq).itens.find((x) => x.id === id)
      if (!item) throw new Error('não achei o item')
      if (!B.podeAprovarPorOlho(item)) throw new Error('não é uma prova para o olho dele (estado ou conferir não permitem)')
      if (escolha === 'Aprovo') B.mover(id, 'OK', { prova: `${item.prova || ''}; dele: aprovado no Tinder em ${dia}`.replace(/^; /, '') }, arq)
      else {
        // D16: volta para andando, com o motivo dele. Move primeiro: se a tabela recusar, não sobra fala solta no diário.
        B.mover(id, 'EM', { porque: motivo || 'não aprovado no Tinder' }, arq)
        B.debater(id, motivo || 'não aprovado no Tinder', { tipo: 'decisao', de: 'felipe' }, arq)
      }
      resultados[id] = { ok: true }
    } catch (e) { resultados[id] = { erro: String(e.message || e) } }
  }
  cache = null; limparEspera()
  return { resultados }
}

export const _limpar = () => { cache = null }
