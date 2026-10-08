/**
 * CC-900: quanto custa um item, em tokens, medido na própria sessão.
 *
 * A regressão por dia não serviu (medido em 04/10: um item M saía mais barato
 * que um P, porque fechamento em lote e modelo barato misturam tudo). Aqui a
 * medida é direta: quando a sessão move um item, o diário ganha o contador de
 * tokens dela naquele instante. Custo do item = contador ao sair de "andando"
 * menos contador ao entrar.
 *
 * Conta só saída e escrita de cache: a releitura de cache é quase todo o volume
 * e não diz nada sobre o esforço (ver docs/produto/NISABA-METODO.md, seção 3).
 *
 * ponytail: se a mesma sessão anda com dois itens ao mesmo tempo, os dois
 * levam o gasto inteiro do intervalo. Ratear por item exigiria saber em qual
 * item cada resposta trabalhou; vale fazer quando houver amostra que mostre o
 * exagero.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'
import { _internals as T } from './tempo.mjs'
import * as B from './backlog.mjs'

const SAIDAS = new Set(['PR', 'OK'])

/** O transcrito da sessão: `<casa>/projects/<pasta>/<sessao>.jsonl`. */
export function transcritoDe(sessao, casa = casaClaude()) {
  if (!/^[0-9a-f-]{36}$/.test(String(sessao || ''))) return null
  const raiz = path.join(casa, 'projects')
  let pastas = []
  try { pastas = fs.readdirSync(raiz) } catch { return null }
  for (const p of pastas) { const f = path.join(raiz, p, `${sessao}.jsonl`); if (fs.existsSync(f)) return f }
  return null
}

/** Saída mais escrita de cache, somadas em todos os dias e modelos da sessão. */
export function contadorDe(arquivo) {
  let t = 0
  for (const mods of Object.values(T.lerArquivo(arquivo).porDia || {})) {
    for (const u of Object.values(mods)) t += (u.output || 0) + (u.escrita1h || 0) + (u.escrita5m || 0)
  }
  return t
}

/**
 * CC-977: o mesmo contador, separado por modelo e somando os ajudantes da
 * sessão. Cada ajudante tem conversa própria em `<sessao>/subagents/`, e sem
 * ela delegar ao Sonnet faria o gasto sumir da tarefa (medido em 07/10: 98
 * ajudantes numa sessão, nenhum contado). Fica em campo separado de `tokens`
 * para não inflar o item que entrou em "andando" antes desta conta existir.
 */
export function contadorPorModelo(arquivo) {
  const pasta = path.join(arquivo.replace(/\.jsonl$/, ''), 'subagents')
  let ajudantes = []
  try { ajudantes = fs.readdirSync(pasta).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(pasta, f)) } catch { /* sessão sem ajudante */ }
  const m = {}
  for (const f of [arquivo, ...ajudantes]) {
    for (const mods of Object.values(T.lerArquivo(f).porDia || {})) {
      for (const [mod, u] of Object.entries(mods)) m[mod] = (m[mod] || 0) + (u.output || 0) + (u.escrita1h || 0) + (u.escrita5m || 0)
    }
  }
  return m
}

/** Anota no diário o contador da sessão que moveu o item. Silencioso fora de uma sessão do Claude Code. */
export function marcar(id, estado, { arquivo = B.caminhoPadrao(), sessao = process.env.CLAUDE_CODE_SESSION_ID } = {}) {
  if (estado !== 'EM' && !SAIDAS.has(estado)) return null
  const t = transcritoDe(sessao); if (!t) return null
  let tokens, porModelo
  try { tokens = contadorDe(t) } catch { return null }
  try { porModelo = contadorPorModelo(t) } catch { /* sem a separação, o total continua */ }
  B.registrar([{ tipo: 'medida', id, estado, sessao, tokens, ...(porModelo ? { porModelo } : {}) }], arquivo)
  return tokens
}

/** CC-977: o custo de cada item por modelo, com ajudantes. Só ciclos com as duas pontas medidas por modelo. */
export function custosPorModelo(eventos) {
  const aberto = new Map(); const total = new Map()
  for (const e of eventos) {
    if (e.tipo !== 'medida' || !e.porModelo) continue
    const k = `${e.id}|${e.sessao}`
    if (e.estado === 'EM') { aberto.set(k, e.porModelo); continue }
    if (!SAIDAS.has(e.estado) || !aberto.has(k)) continue
    const ini = aberto.get(k); aberto.delete(k)
    const acc = total.get(e.id) || {}
    for (const [mod, n] of Object.entries(e.porModelo)) { const d = n - (ini[mod] || 0); if (d > 0) acc[mod] = (acc[mod] || 0) + d }
    total.set(e.id, acc)
  }
  return total
}

/**
 * O custo de cada item, a partir das marcas do diário. Cada entrada em "andando"
 * casa com a primeira saída (prova ou feito) seguinte da MESMA sessão; vários
 * ciclos se somam. Item sem par completo não aparece: custo inventado é pior que
 * custo faltando.
 */
export function custos(eventos) {
  const aberto = new Map(); const total = new Map()
  for (const e of eventos) {
    if (e.tipo !== 'medida' || typeof e.tokens !== 'number') continue
    const k = `${e.id}|${e.sessao}`
    if (e.estado === 'EM') { aberto.set(k, e.tokens); continue }
    if (SAIDAS.has(e.estado) && aberto.has(k)) {
      const d = e.tokens - aberto.get(k); aberto.delete(k)
      if (d >= 0) total.set(e.id, (total.get(e.id) || 0) + d)
    }
  }
  return total
}

const eventosDe = (arquivo) => {
  let linhas = []
  try { linhas = fs.readFileSync(B.caminhoEventos(arquivo), 'utf8').split('\n') } catch { return [] }
  return linhas.filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}

/** Lê o diário do projeto e devolve o custo por item. */
export const custosDoProjeto = (arquivo = B.caminhoPadrao()) => custos(eventosDe(arquivo))

/** CC-977: o mesmo, por modelo. */
export const custosPorModeloDoProjeto = (arquivo = B.caminhoPadrao()) => custosPorModelo(eventosDe(arquivo))
