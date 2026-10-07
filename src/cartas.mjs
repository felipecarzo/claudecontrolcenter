/**
 * Cartões do Tinder (CC-909, peça D2): a explicação longa de uma opção curta,
 * escrita pelo AGY. Usa a mesma fila de um por vez do resumoAgy (cache, espera
 * depois de falha, travessão trocado por vírgula).
 */
import crypto from 'node:crypto'
import { limparSegredos } from './segredo.mjs'

/** Chave estável: a mesma pergunta com a mesma opção cai na mesma explicação. */
export function chaveDaExplicacao({ pergunta, opcao }) {
  return 'explica::' + crypto.createHash('sha1').update(String(pergunta ?? '') + '\n' + String(opcao ?? '')).digest('hex').slice(0, 16)
}

/** O texto sai da máquina para o Google: tudo passa por `limparSegredos` e é cortado. */
const corta = (v, n) => limparSegredos(String(v ?? '')).replace(/[—–]/g, ',').slice(0, n)

export function promptDaExplicacao({ pergunta, opcao, contexto, projeto }) {
  return [
    'Explique em português do Brasil, em no máximo 6 frases curtas, para quem DECIDE e não programa: o que acontece se escolher esta opção, o que muda para quem usa, o custo e o risco. Sem jargão técnico, sem travessão. Não use ferramentas.',
    '',
    projeto ? 'PROJETO: ' + corta(projeto, 80) : '',
    'PERGUNTA: ' + corta(pergunta, 600),
    'OPÇÃO: ' + corta(opcao, 200),
    contexto ? 'CONTEXTO: ' + corta(contexto, 1500) : '',
  ].filter((l, i) => l !== '' || i === 1).join('\n')
}

/** Opção curta ganha o "?": sem descrição, ou rótulo de até 3 palavras. */
export const ehCurta = (o) => !o.descricao || String(o.rotulo).split(/\s+/).length <= 3

/**
 * A lógica da rota POST /api/cartas/explicar. `agy` entra por parâmetro para o
 * teste nunca chamar o AGY de verdade: `{ pedirTexto, obterTexto }`.
 */
export function explicar({ pergunta, opcao, contexto, projeto } = {}, agy) {
  if (!String(pergunta || '').trim() || !String(opcao || '').trim()) return { erro: 'pergunta e opcao são obrigatórias' }
  const k = chaveDaExplicacao({ pergunta, opcao })
  const pronto = agy.obterTexto(k)
  if (pronto) return pronto.texto ? { texto: pronto.texto } : { estado: 'resumindo' }
  agy.pedirTexto({ k, prompt: promptDaExplicacao({ pergunta, opcao, contexto, projeto }) })
  return { estado: 'resumindo' }
}

/* CC-911 (D3a): baralhos de cartas por projeto. `docs/cartas/<deck>.json` é escrito
   pelo agente do projeto; `docs/cartas/<deck>.votos.jsonl` só cresce, por acréscimo. */
import fs from 'node:fs'
import path from 'node:path'

const DECK = /^[a-z0-9-]{1,40}$/
const IMG = /\.(jpg|png|webp)$/i
export const OPCOES_PADRAO = ['Aprovo', 'Não aprovo']
const CAMPOS_DECK = ['titulo', 'criado', 'cartas']
const CAMPOS_CARTA = ['id', 'titulo', 'pergunta', 'olhe', 'passos', 'img', 'link', 'opcoes', 'multipla']
const TRAVESSAO = /[—–]/
const pasta = (raiz) => path.join(raiz, 'docs', 'cartas')
const opcoesDe = (c) => (Array.isArray(c.opcoes) && c.opcoes.length ? c.opcoes : OPCOES_PADRAO)

/** Devolve a lista de erros (vazia = deck bom). Nada do que o agente escreve é confiado. */
export function validarDeck(j) {
  const e = []
  const txt = (v, onde) => { if (typeof v !== 'string') e.push(onde + ': precisa ser texto'); else if (TRAVESSAO.test(v)) e.push(onde + ': tem travessão') }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return ['o deck precisa ser um objeto']
  for (const k of Object.keys(j)) if (!CAMPOS_DECK.includes(k)) e.push('campo a mais no deck: ' + k)
  txt(j.titulo, 'titulo do deck')
  if (j.criado !== undefined && (typeof j.criado !== 'string' || Number.isNaN(Date.parse(j.criado)))) e.push('criado: data inválida')
  if (!Array.isArray(j.cartas) || !j.cartas.length) return [...e, 'cartas: lista vazia ou ausente']
  if (j.cartas.length > 200) e.push('cartas: no máximo 200 (tem ' + j.cartas.length + ')')
  const ids = new Set()
  j.cartas.slice(0, 200).forEach((c, i) => {
    const n = 'carta ' + (i + 1) + ': '
    if (!c || typeof c !== 'object' || Array.isArray(c)) return e.push(n + 'precisa ser um objeto')
    for (const k of Object.keys(c)) if (!CAMPOS_CARTA.includes(k)) e.push(n + 'campo a mais: ' + k)
    if (typeof c.id !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(c.id)) e.push(n + 'id inválido (letras, números, _ e -, até 60)')
    else if (ids.has(c.id)) e.push(n + 'id repetido: ' + c.id)
    else ids.add(c.id)
    txt(c.titulo, n + 'titulo')
    for (const k of ['pergunta', 'olhe']) if (c[k] !== undefined) txt(c[k], n + k)
    if (c.passos !== undefined) {
      if (!Array.isArray(c.passos) || c.passos.length > 10) e.push(n + 'passos: lista de até 10 textos')
      else c.passos.forEach((p, k) => txt(p, n + 'passos[' + k + ']'))
    }
    if (c.img !== undefined) {
      const ok = typeof c.img === 'string' && c.img.startsWith('docs/cartas/') && IMG.test(c.img) && !c.img.split('/').includes('..') && !c.img.includes('\\') && !c.img.includes('\0')
      if (!ok) e.push(n + 'img precisa ficar em docs/cartas/ e ser jpg, png ou webp')
    }
    if (c.link !== undefined) {
      let u = null
      try { u = new URL(c.link) } catch { /* inválido */ }
      if (!u || !/^https?:$/.test(u.protocol)) e.push(n + 'link precisa ser http ou https')
    }
    if (c.opcoes !== undefined) {
      if (!Array.isArray(c.opcoes) || c.opcoes.length < 1 || c.opcoes.length > 4) e.push(n + 'opcoes: de 1 a 4 textos')
      else {
        c.opcoes.forEach((o, k) => txt(o, n + 'opcoes[' + k + ']'))
        if (new Set(c.opcoes).size !== c.opcoes.length) e.push(n + 'opcoes repetidas')
      }
    }
    if (c.multipla !== undefined && typeof c.multipla !== 'boolean') e.push(n + 'multipla: verdadeiro ou falso')
  })
  return e
}

const deckOk = (d) => typeof d === 'string' && DECK.test(d)

/** Os nomes dos decks da pasta (só o nome, sem a extensão). */
export function listarDecks(raiz) {
  try {
    return fs.readdirSync(pasta(raiz)).filter((f) => f.endsWith('.json') && !f.endsWith('.votos.jsonl')).map((f) => f.slice(0, -5)).filter(deckOk).sort()
  } catch { return [] }
}

/** `{ deck }` válido, ou `{ erros }`, ou null se não existe. */
export function lerDeck(raiz, deck) {
  if (!deckOk(deck)) return { erros: ['nome de deck inválido'] }
  let j
  try { j = JSON.parse(fs.readFileSync(path.join(pasta(raiz), deck + '.json'), 'utf8')) } catch (x) { return x.code === 'ENOENT' ? null : { erros: ['JSON ilegível'] } }
  const erros = validarDeck(j)
  return erros.length ? { erros } : { deck: j }
}

/** Todos os votos do deck, na ordem. Linha ruim é ignorada. */
export function votos(raiz, deck) {
  if (!deckOk(deck)) return []
  let t = ''
  try { t = fs.readFileSync(path.join(pasta(raiz), deck + '.votos.jsonl'), 'utf8') } catch { return [] }
  return t.split('\n').flatMap((l) => { try { return l.trim() ? [JSON.parse(l)] : [] } catch { return [] } })
}

/** Decks válidos com o total e as cartas ainda sem voto. */
export function pendentes(raiz) {
  const r = []
  for (const nome of listarDecks(raiz)) {
    const d = lerDeck(raiz, nome)?.deck
    if (!d) continue
    const votadas = new Set(votos(raiz, nome).map((v) => v.carta))
    r.push({ deck: nome, titulo: d.titulo, total: d.cartas.length, pendentes: d.cartas.filter((c) => !votadas.has(c.id)).map((c) => ({ ...c, opcoes: opcoesDe(c) })) })
  }
  return r
}

/** Só acrescenta uma linha. `{ ok }` ou `{ erro }`. */
export function votar(raiz, deck, carta, { escolhas, nota } = {}) {
  const lido = lerDeck(raiz, deck)
  if (!lido?.deck) return { erro: lido ? 'deck inválido' : 'deck não existe' }
  const c = lido.deck.cartas.find((x) => x.id === carta)
  if (!c) return { erro: 'carta não existe' }
  const op = opcoesDe(c)
  if (!Array.isArray(escolhas) || !escolhas.length || escolhas.some((x) => !op.includes(x)) || new Set(escolhas).size !== escolhas.length) return { erro: 'opção que a carta não oferece' }
  if (!c.multipla && escolhas.length !== 1) return { erro: 'esta carta aceita uma opção só' }
  if (nota !== undefined && typeof nota !== 'string') return { erro: 'nota precisa ser texto' }
  if (votos(raiz, deck).some((v) => v.carta === carta)) return { erro: 'carta já votada' }
  const linha = { em: new Date().toISOString(), carta, escolhas, nota: String(nota || '').slice(0, 1000), de: 'felipe' }
  fs.appendFileSync(path.join(pasta(raiz), deck + '.votos.jsonl'), JSON.stringify(linha) + '\n')
  return { ok: true, voto: linha }
}

/** Caminho real da imagem, ou null. Atalho para fora de `docs/cartas`, `..` e caminho absoluto não passam. */
export function caminhoDaImagem(raiz, rel) {
  if (typeof rel !== 'string' || !rel.startsWith('docs/cartas/') || !IMG.test(rel) || rel.split('/').includes('..') || rel.includes('\\') || rel.includes('\0')) return null
  try {
    const base = fs.realpathSync(pasta(raiz))
    const alvo = fs.realpathSync(path.join(raiz, rel))
    return alvo.startsWith(base + path.sep) && fs.statSync(alvo).isFile() ? alvo : null
  } catch { return null }
}
