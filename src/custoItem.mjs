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

/** Anota no diário o contador da sessão que moveu o item. Silencioso fora de uma sessão do Claude Code. */
export function marcar(id, estado, { arquivo = B.caminhoPadrao(), sessao = process.env.CLAUDE_CODE_SESSION_ID } = {}) {
  if (estado !== 'EM' && !SAIDAS.has(estado)) return null
  const t = transcritoDe(sessao); if (!t) return null
  let tokens
  try { tokens = contadorDe(t) } catch { return null }
  B.registrar([{ tipo: 'medida', id, estado, sessao, tokens }], arquivo)
  return tokens
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

/** Lê o diário do projeto e devolve o custo por item. */
export function custosDoProjeto(arquivo = B.caminhoPadrao()) {
  let linhas = []
  try { linhas = fs.readFileSync(B.caminhoEventos(arquivo), 'utf8').split('\n') } catch { return new Map() }
  return custos(linhas.filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean))
}
