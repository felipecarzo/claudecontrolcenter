/**
 * CC-896: o caminho do projeto. O backlog vira uma estrada: cada FRENTE é um
 * trecho, e frente sem item aberto é um marco alcançado. Decisão dele: nada de
 * dado novo para declarar, o caminho sai sozinho do backlog que já existe.
 *
 * Cancelado (KO) não conta como andado nem como faltando: some da conta, para
 * a porcentagem dizer só "do que ainda vale, quanto já foi".
 */
import path from 'node:path'
import * as B from './backlog.mjs'
import { catalogoDe } from './frentes.mjs'
import { nomeCanonico } from './nomeProjeto.mjs'

const MAX_TRECHOS = 10
export const nomeDe = (raiz) => nomeCanonico(path.basename(raiz).replace(/^(VPS|PC)_/i, ''))
const aberto = (i) => i.estado !== 'OK' && i.estado !== 'KO'
export const texto = (i) => String(i.intencao || i.titulo || '').slice(0, 140)
/** Um item como a tela do Caminho mostra. CC-958: aberto e com lugar leva o lugar e o rótulo. */
export const itemDoCaminho = (i) => ({ id: i.id, texto: texto(i), estado: i.estado, mexido: i.mexido || null, ...(i.origem === 'emenda' ? { emenda: true } : {}), ...(aberto(i) && B.lugarDe(i) ? { lugar: B.lugarDe(i), lugarRot: B.rotuloDoLugar(i) } : {}) })
/** CC-958: seção guardada fora da estrada (fora do MVP, ideias esperando lugar). Null quando vazia. */
export const secaoGuardada = (chave, frente, descricao, lista) => lista.length ? { chave, frente, descricao, total: lista.length, feitos: 0, cancelados: 0, andando: 0, fila: 0, parado: 0, emendas: lista.filter((i) => i.origem === 'emenda').length, completo: false, itens: lista.slice(0, 14).map(itemDoCaminho) } : null

/** Os projetos que têm backlog, com o placar de cada um. */
export function projetosComCaminho(projetos) {
  const out = []
  for (const p of projetos) {
    let itens
    try { const r = B.ler(B.caminhoPadrao(p.raiz)); if (!r.existe) continue; itens = r.itens } catch { continue }
    const feitos = itens.filter((i) => i.estado === 'OK').length
    const abertos = itens.filter(aberto).length
    if (feitos + abertos === 0) continue
    out.push({ raiz: p.raiz, nome: nomeDe(p.raiz), feitos, abertos })
  }
  return out.sort((a, b) => b.abertos - a.abertos || a.nome.localeCompare(b.nome))
}

/** Em qual trecho a frente do item cai. Com catálogo, o que não está nele vira um trecho de "antes". */
function trechoDe(item, catalogo) {
  const f = String(item.frente || '').trim()
  if (!f || f === 'sem frente') return catalogo ? '_antes' : '_sem'
  if (catalogo) return Object.hasOwn(catalogo, f) ? f : '_antes'
  return f.length > 48 ? f.slice(0, 47) + '…' : f
}

export function caminhoDe(raiz, agora = Date.now()) {
  const arquivo = B.caminhoPadrao(raiz)
  const { itens: todos, existe } = B.ler(arquivo)
  if (!existe) return { ok: false, erro: 'este projeto ainda não tem backlog' }
  // CC-958: fora do MVP sai da estrada (não conta no andado nem nos marcos) e vira uma seção guardada
  const fora = todos.filter((i) => aberto(i) && !i.pai && B.lugarDe(i) === 'fora')
  const itens = todos.filter((i) => !fora.includes(i))
  const catalogo = catalogoDe(arquivo)
  const grupos = new Map()
  for (const i of itens) {
    const k = trechoDe(i, catalogo)
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(i)
  }
  const rotulo = (k) => k === '_antes' ? 'Antes do catálogo de frentes' : k === '_sem' ? 'Sem frente' : k
  let trechos = [...grupos].map(([k, lista]) => {
    const abertos = lista.filter(aberto); const feitos = lista.filter((i) => i.estado === 'OK')
    const andando = abertos.filter((i) => i.estado === 'EM' || i.estado === 'PR')
    const recentes = (l) => [...l].sort((a, b) => String(b.mexido || '').localeCompare(String(a.mexido || '')))
    return {
      chave: k, frente: rotulo(k), descricao: (catalogo && catalogo[k]) || null,
      total: feitos.length + abertos.length, feitos: feitos.length, cancelados: lista.length - feitos.length - abertos.length,
      andando: andando.length, fila: abertos.filter((i) => i.estado === 'B0' || i.estado === 'B1').length,
      parado: abertos.filter((i) => i.estado === 'DE' || i.estado === 'TR').length,
      completo: abertos.length === 0 && feitos.length > 0,
      comeco: lista.map((i) => i.criado || '').filter(Boolean).sort()[0] || '',
      mexido: lista.map((i) => i.mexido || '').sort().at(-1) || '',
      emendas: lista.filter((i) => i.origem === 'emenda' && i.estado !== 'KO').length, // CC-916: ideia nova no meio do projeto
      // emenda ainda não avaliada (B0) sobe junto do que anda: é a novidade que ele precisa ver
      itens: [...recentes(andando), ...recentes(abertos.filter((i) => i.origem === 'emenda' && !andando.includes(i))).slice(0, 4), ...recentes(abertos.filter((i) => i.origem !== 'emenda' && !andando.includes(i))).slice(0, 6), ...recentes(feitos).slice(0, 5)]
        .map(itemDoCaminho),
    }
  }).filter((t) => t.total > 0)
  /* Sem catálogo as frentes podem ser dezenas: ficam as maiores e o resto vira "Outras". */
  if (trechos.length > MAX_TRECHOS) {
    const ord = [...trechos].sort((a, b) => b.total - a.total)
    const fica = new Set(ord.slice(0, MAX_TRECHOS - 1).map((t) => t.chave))
    const resto = trechos.filter((t) => !fica.has(t.chave))
    const soma = (k) => resto.reduce((s, t) => s + t[k], 0)
    trechos = [...trechos.filter((t) => fica.has(t.chave)), {
      chave: '_outras', frente: 'Outras frentes', descricao: `${resto.length} frentes menores`, total: soma('total'), feitos: soma('feitos'), cancelados: soma('cancelados'),
      andando: soma('andando'), fila: soma('fila'), parado: soma('parado'), emendas: soma('emendas'), completo: resto.every((t) => t.completo),
      comeco: resto.map((t) => t.comeco).filter(Boolean).sort()[0] || '', mexido: resto.map((t) => t.mexido).sort().at(-1) || '',
      itens: resto.flatMap((t) => t.itens).slice(0, 10),
    }]
  }
  // a estrada é cronológica: o trecho que nasceu primeiro vem primeiro
  trechos.sort((a, b) => (a.comeco || '9').localeCompare(b.comeco || '9') || a.frente.localeCompare(b.frente))
  const feitos = trechos.reduce((s, t) => s + t.feitos, 0); const total = trechos.reduce((s, t) => s + t.total, 0)
  /* Onde estamos: o trecho com trabalho andando mais recente; senão o primeiro com algo aberto; senão a chegada. */
  const andando = trechos.map((t, i) => ({ t, i })).filter((x) => x.t.andando).sort((a, b) => b.t.mexido.localeCompare(a.t.mexido))[0]
  const atual = andando ? andando.i : Math.max(0, trechos.findIndex((t) => !t.completo) === -1 ? trechos.length - 1 : trechos.findIndex((t) => !t.completo))
  const emendas = trechos.reduce((s, t) => s + t.emendas, 0)
  return { ok: true, raiz, nome: nomeDe(raiz), feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0, marcos: trechos.filter((t) => t.completo).length, emendas, crescimento: total - emendas ? Math.round((emendas / (total - emendas)) * 100) : 0, trechos, atual, at: agora, foraDoMvp: secaoGuardada('fora', 'Fora do MVP', 'guardado: não entra na fila até você promover', fora), lugares: B.LUGARES }
}
