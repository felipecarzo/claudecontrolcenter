/**
 * CC-915: o que o backlog dos projetos espera DELE.
 *
 * A fila de tarefas dele (meu.mjs) só lia três fontes: a lista escrita à mão, os
 * to-dos de agente com dono "felipe" e as marcas do ROADMAP antigo. Medido em
 * 04/10: cerca de 40 itens dos backlogs em dado esperavam por ele (decisões,
 * travas, provas para conferir) e nenhum aparecia na fila nem no aviso de abrir
 * sessão. Era a peça construída e inalcançável: o dado existia, ninguém chegava.
 *
 * Três motivos de espera, todos lidos do próprio item, sem campo novo:
 *  · decidir:   estado DE (decisão dele);
 *  · destravar: `trava` começando por "dele";
 *  · conferir:  estado PR com `conferir` começando por "dele:".
 */
import fs from 'node:fs'
import path from 'node:path'
import * as B from './backlog.mjs'
import { findProjects } from './install.mjs'

const TTL = 60_000
let cache = null // { em, chave, lista }

/** Por que este item espera por ele, ou null. */
export function motivoDeEspera(item) {
  if (!item || item.estado === 'OK' || item.estado === 'KO') return null
  if (item.estado === 'DE') return 'decidir'
  if (String(item.trava || '').startsWith('dele')) return 'destravar'
  if (item.estado === 'PR' && String(item.conferir || '').startsWith('dele:')) return 'conferir'
  return null
}

const curto = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }

/** A pendência, no formato que a fila dele já entende. */
export function comoPendencia(item, projeto) {
  const motivo = motivoDeEspera(item)
  const o = curto(item.intencao || item.titulo, 140)
  const texto = motivo === 'decidir' ? `Decidir: ${curto(item.decisao || o, 160)}`
    : motivo === 'destravar' ? `Destravar: ${o}`
    : `Conferir: ${o}`
  return {
    id: `backlog:${projeto}:${item.id}`, texto, projeto, frente: item.frente && item.frente !== 'sem frente' ? item.frente : null,
    porque: motivo === 'conferir' ? (item.prova ? curto(item.prova, 300) : item.pronto) : motivo === 'destravar' ? `trava: ${item.trava}` : (item.porque || item.pronto || null),
    feito: false, em: Date.parse(item.mexido || item.criado || '') || null, fonte: 'backlog', motivo, item: item.id,
  }
}

/** Tudo que os backlogs dos projetos esperam dele. Guardado por 60 s e invalidado se um arquivo mudou. */
export function pendencias({ raizes = process.env.CC_HOME ? [] : findProjects(), agora = Date.now() } = {}) { // casa isolada (CC_HOME) não lê os projetos reais
  const arquivos = raizes.map((r) => B.caminhoPadrao(r))
  const chave = arquivos.map((f) => { try { return f + ':' + fs.statSync(f).mtimeMs } catch { return null } }).filter(Boolean).join('|')
  if (cache && cache.chave === chave && agora - cache.em < TTL) return cache.lista
  const lista = []
  for (const raiz of raizes) {
    let itens = []
    try { itens = B.ler(B.caminhoPadrao(raiz)).itens } catch { continue }
    const projeto = path.basename(raiz)
    for (const i of itens) if (motivoDeEspera(i)) lista.push(comoPendencia(i, projeto))
  }
  cache = { em: agora, chave, lista }
  return lista
}

/**
 * Marcar como feita uma pendência que veio do backlog. Só "conferir" fecha por aqui
 * (ele conferiu, o item vai a feito com a prova dele); decisão e trava se resolvem
 * onde nasceram, porque fechar sem a resposta esconderia o problema.
 */
export function resolver(id, { raizes = findProjects(), agora = new Date() } = {}) {
  const m = /^backlog:([^:]+):(.+)$/.exec(String(id || ''))
  if (!m) return { ok: false, erro: 'não é uma pendência do backlog' }
  const raiz = raizes.find((r) => path.basename(r) === m[1])
  if (!raiz) return { ok: false, erro: 'projeto não encontrado' }
  const arq = B.caminhoPadrao(raiz)
  const item = B.ler(arq).itens.find((i) => i.id === m[2])
  if (!item) return { ok: false, erro: 'item não encontrado' }
  const motivo = motivoDeEspera(item)
  if (motivo !== 'conferir') return { ok: false, erro: motivo === 'decidir' ? 'é uma decisão: responda pela pergunta do item, não pelo visto' : motivo === 'destravar' ? 'é uma trava sua: faça o que ela pede e o item destrava' : 'este item já não espera por você' }
  try { B.mover(item.id, 'OK', { prova: `dele: conferiu pelo painel em ${agora.toISOString().slice(0, 10)}` }, arq) } catch (e) { return { ok: false, erro: String(e.message || e) } }
  cache = null
  return { ok: true }
}

export const _limpar = () => { cache = null }
