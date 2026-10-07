/**
 * CC-902: o modo "Criação de produto". O dado e as regras puras (sem IA).
 *
 * O mapa do produto (Jeff Patton, docs/produto/NISABA-METODO.md seção 2.3) mora em
 * `docs/produto.json`, ao lado do backlog. O `.framework/estado.json` guarda só as
 * DATAS (`produto: { definicao, mapa }`) para os portões do método: o conteúdo vive
 * aqui, uma verdade só. Quem faz as perguntas é o arquiteto (src/arquiteto.mjs);
 * este módulo não chama modelo nenhum, para não criar import circular com ele.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as B from './backlog.mjs'
import { lerConferencia } from './conferencia.mjs'
import { comSeguranca } from './catalogoSeguranca.mjs'

export const ARQUIVO = path.join('docs', 'produto.json')
export const TIPOS_DE_PARTE = ['tela', 'fluxo', 'comando', 'pergunta']
export const PASSOS = ['sucesso', 'definicao', 'partes', 'faltou', 'caracteristicas', 'mapa']

const agora = () => new Date().toISOString()

export const produtoVazio = () => ({
  versao: 1,
  definicao: { oque: '', paraQuem: '', problema: '', sucesso: '', natureza: '', confirmada: null },
  sugeridas: [], partes: [], recusadas: [],
  faltouPerguntado: false, mapaAprovado: null, atualizado: '',
})

export function ler(raiz) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(raiz, ARQUIVO), 'utf8'))
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null
    const v = produtoVazio()
    return { ...v, ...j, definicao: { ...v.definicao, ...(j.definicao || {}) } }
  } catch { return null }
}

export function gravar(raiz, produto) {
  const alvo = path.join(raiz, ARQUIVO)
  fs.mkdirSync(path.dirname(alvo), { recursive: true })
  const tmp = `${alvo}.tmp`
  // CC-922: toda gravação do mapa põe em cada parte os requisitos de segurança do tipo dela
  fs.writeFileSync(tmp, JSON.stringify({ ...comSeguranca(produto), atualizado: agora() }, null, 1) + '\n', 'utf8')
  fs.renameSync(tmp, alvo)
  return alvo
}

/** A definição que a entrevista já apurou. Resposta com `de: 'prosa'` é palpite e não entra. */
export function definicaoDaEntrevista(estadoFw) {
  const r = estadoFw?.entrevista?.respostas || {}
  const fala = (id) => (r[id] && r[id].de !== 'prosa' ? String(r[id].texto || '').trim() : '')
  return {
    oque: fala('entrega'), paraQuem: fala('quem'), problema: fala('hoje'),
    natureza: r.natureza && r.natureza.de !== 'prosa' ? String(r.natureza.valor || '') : '',
  }
}

/** O próximo passo da conversa, ou null quando o mapa já foi aprovado. */
export function proximoPasso(produto) {
  const p = produto || produtoVazio()
  if (!String(p.definicao?.sucesso || '').trim()) return { passo: 'sucesso' }
  if (!p.definicao?.confirmada) return { passo: 'definicao' }
  // sem nenhuma parte aceita, pergunta de novo: mapa vazio não pode ser aprovado
  if ((p.sugeridas || []).length || !(p.partes || []).length) return { passo: 'partes' }
  if (!p.faltouPerguntado) return { passo: 'faltou' }
  const parte = p.partes.find((x) => !x.caracteristicasFeitas)
  if (parte) return { passo: 'caracteristicas', parte: parte.codigo }
  if (!p.mapaAprovado) return { passo: 'mapa' }
  return null
}

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '')
const slug = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
const mesma = (a, b) => semAcento(a).trim().toLowerCase() === semAcento(b).trim().toLowerCase()
const tipoPadrao = (natureza) => ({ biblioteca: 'comando', estudo: 'pergunta' }[natureza] || 'tela')

/**
 * Aplica a resposta dele a um passo e devolve o produto novo (puro).
 * `escolhas` são os rótulos marcados, `extra` o que ele escreveu, `opcoes` os rótulos que o cartão
 * ofereceu (no passo partes: quais sugeridas estavam na tela), `parte` o código no passo caracteristicas.
 */
/** O deslizar para a esquerda numa carta de lote manda este texto como `extra`: é "nenhuma das opções", não uma parte nova. */
export const ehNenhuma = (t) => /^nenhuma destas\.?$/i.test(String(t || '').trim())

export function aplicarResposta(produto, passo, { escolhas = [], extra = '', opcoes = [], parte = null, quando = agora() } = {}) {
  const p = JSON.parse(JSON.stringify(produto || produtoVazio()))
  const txt = ehNenhuma(extra) ? '' : String(extra || '').trim()
  const marcou = (rotulo) => escolhas.some((e) => mesma(e, rotulo))
  const novaParte = () => {
    let cod = slug(txt) || 'parte'
    const usados = new Set([...p.partes, ...p.sugeridas].map((x) => x.codigo))
    for (let i = 2; usados.has(cod); i++) cod = `${cod.slice(0, 17)}${i}`
    p.partes.push({ codigo: cod, nome: txt.slice(0, 40), tipo: tipoPadrao(p.definicao.natureza), atividade: txt.slice(0, 140), ordem: p.partes.length + 1, caracteristicas: [], caracteristicasFeitas: false, rota: null })
  }
  if (passo === 'sucesso') {
    p.definicao.sucesso = [...escolhas, ...(txt ? [txt] : [])].join('; ')
  } else if (passo === 'definicao') {
    if (escolhas.some((e) => /^est[aá] certa/i.test(e))) p.definicao.confirmada = quando
  } else if (passo === 'partes') {
    const oferecidas = opcoes.length ? p.sugeridas.filter((s) => opcoes.some((o) => mesma(o, s.nome))) : p.sugeridas.slice(0, 4)
    for (const s of oferecidas) {
      p.sugeridas = p.sugeridas.filter((x) => x.codigo !== s.codigo)
      if (marcou(s.nome)) p.partes.push({ ...s, ordem: p.partes.length + 1, caracteristicas: [], caracteristicasFeitas: false, rota: null })
      else p.recusadas.push(s)
    }
    if (txt) novaParte()
  } else if (passo === 'faltou') {
    if (txt) novaParte() // a pergunta sai de novo: ele diz "não, está completo" quando acabar
    else if (escolhas.some((e) => /^n[aã]o/i.test(e))) p.faltouPerguntado = true
  } else if (passo === 'caracteristicas') {
    const alvo = p.partes.find((x) => x.codigo === parte)
    if (alvo) {
      alvo.caracteristicas = [...alvo.caracteristicas, ...escolhas, ...(txt ? [txt.slice(0, 80)] : [])]
      alvo.caracteristicasFeitas = true
    }
  } else if (passo === 'mapa') {
    if (escolhas.some((e) => /^aprovo/i.test(e))) p.mapaAprovado = quando
    else p.faltouPerguntado = false // quer mudar uma parte: volta a perguntar se falta alguma
  }
  return p
}

/**
 * A resposta chega do painel como UMA string (`marcadas.join(', ') + '. ' + extra`, em src/web.mjs).
 * Separa pelos rótulos que o cartão ofereceu. Limite: rótulo oferecido digitado no campo extra conta como marcado.
 */
export function separarEscolha(texto, opcoes = []) {
  let resto = String(texto || '').trim()
  const achadas = []
  for (const o of [...opcoes].sort((a, b) => b.length - a.length)) {
    const i = resto.indexOf(o)
    if (i >= 0) { achadas.push(o); resto = resto.slice(0, i) + '\u0000' + resto.slice(i + o.length) }
  }
  const extra = resto.replace(/\u0000/g, '').replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
  return { escolhas: opcoes.filter((o) => achadas.includes(o)), extra }
}

const crua = (texto) => String(texto || '').trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1').trim()
const parse = (texto) => { try { const v = JSON.parse(crua(texto)); return v && typeof v === 'object' && !Array.isArray(v) ? v : null } catch { return null } }
const TRAVESSAO = /[—–]/

/** O contrato das partes que o Haiku sugere. Devolve `{ ok, partes, erros }`. */
export function validarPartes(texto) {
  const v = parse(texto)
  if (!v) return { ok: false, partes: [], erros: ['a resposta não é um JSON só: responda apenas o objeto {"partes":[...]}'] }
  const erros = []
  for (const k of Object.keys(v)) if (k !== 'partes') erros.push(`campo desconhecido: ${k}`)
  const lista = Array.isArray(v.partes) ? v.partes : []
  if (lista.length < 3 || lista.length > 8) erros.push('partes: de 3 a 8')
  const vistos = new Set()
  lista.forEach((x, i) => {
    const n = `partes[${i}]`
    if (!x || typeof x !== 'object') return erros.push(`${n}: esperava um objeto`)
    for (const k of Object.keys(x)) if (!['codigo', 'nome', 'tipo', 'atividade'].includes(k)) erros.push(`${n}: campo desconhecido ${k}`)
    if (!/^[a-z0-9]{2,20}$/.test(String(x.codigo))) erros.push(`${n}.codigo: de 2 a 20 letras minúsculas ou números, sem acento, espaço ou hífen`)
    else if (vistos.has(x.codigo)) erros.push(`${n}.codigo repetido: ${x.codigo}`)
    else vistos.add(x.codigo)
    if (typeof x.nome !== 'string' || x.nome.trim().length < 2 || x.nome.length > 40) erros.push(`${n}.nome: de 2 a 40 letras`)
    if (!TIPOS_DE_PARTE.includes(x.tipo)) erros.push(`${n}.tipo: ${TIPOS_DE_PARTE.join(', ')}`)
    if (typeof x.atividade !== 'string' || x.atividade.trim().length < 5 || x.atividade.length > 140) erros.push(`${n}.atividade: de 5 a 140 letras`)
  })
  if (TRAVESSAO.test(JSON.stringify(v))) erros.push('sem travessão')
  if (erros.length) return { ok: false, partes: [], erros }
  return { ok: true, partes: lista.map((x) => ({ codigo: x.codigo, nome: x.nome.trim(), tipo: x.tipo, atividade: x.atividade.trim() })), erros: [] }
}

/** O contrato das características de uma parte. Devolve `{ ok, caracteristicas, erros }`. */
export function validarCaracteristicas(texto) {
  const v = parse(texto)
  if (!v) return { ok: false, caracteristicas: [], erros: ['a resposta não é um JSON só: responda apenas o objeto {"caracteristicas":[...]}'] }
  const erros = []
  for (const k of Object.keys(v)) if (k !== 'caracteristicas') erros.push(`campo desconhecido: ${k}`)
  const lista = Array.isArray(v.caracteristicas) ? v.caracteristicas.map((c) => String(c).trim()) : []
  if (lista.length < 3 || lista.length > 4) erros.push('caracteristicas: de 3 a 4')
  if (lista.some((c) => c.length < 5 || c.length > 80)) erros.push('cada característica de 5 a 80 letras')
  if (new Set(lista.map((c) => c.toLowerCase())).size !== lista.length) erros.push('características repetidas')
  if (TRAVESSAO.test(JSON.stringify(v))) erros.push('sem travessão')
  return erros.length ? { ok: false, caracteristicas: [], erros } : { ok: true, caracteristicas: lista, erros: [] }
}

/**
 * CC-913: o contrato da rota de UMA parte (2 a 4 itens do backlog). Devolve `{ ok, itens, erros }`.
 * `auto:` só fica quando é conferência da lista fechada; qualquer outra vira `olho:` com o texto do pronto,
 * porque o que o Haiku escreve nunca pode virar comando.
 */
export function validarRota(texto) {
  const v = parse(texto)
  if (!v) return { ok: false, itens: [], erros: ['a resposta não é um JSON só: responda apenas o objeto {"itens":[...]}'] }
  const erros = []
  for (const k of Object.keys(v)) if (k !== 'itens') erros.push(`campo desconhecido: ${k}`)
  const lista = Array.isArray(v.itens) ? v.itens : []
  if (lista.length < 2 || lista.length > 4) erros.push('itens: de 2 a 4')
  const feitos = []
  lista.forEach((x, i) => {
    const n = `itens[${i}]`
    if (!x || typeof x !== 'object') return erros.push(`${n}: esperava um objeto`)
    for (const k of Object.keys(x)) if (!['intencao', 'pronto', 'tamanho', 'natureza', 'area', 'conferir'].includes(k)) erros.push(`${n}: campo desconhecido ${k}`)
    const intencao = String(x.intencao || '').trim(), pronto = String(x.pronto || '').trim()
    if (intencao.length < 10 || intencao.length > 140) erros.push(`${n}.intencao: de 10 a 140 letras`)
    if (pronto.length < 10 || pronto.length > 300) erros.push(`${n}.pronto: de 10 a 300 letras`)
    if (!['P', 'M', 'G'].includes(x.tamanho)) erros.push(`${n}.tamanho: P, M ou G`)
    if (!['PED', 'MED', 'DOC'].includes(x.natureza)) erros.push(`${n}.natureza: PED, MED ou DOC`)
    if (!B.AREAS.some((a) => a.codigo === x.area)) erros.push(`${n}.area: ${B.AREAS.map((a) => a.codigo).join(', ')}`)
    let conferir = String(x.conferir || '').trim()
    if (!/^(olho|dele|auto):\S/.test(conferir)) erros.push(`${n}.conferir: começa por olho:, dele: ou auto:`)
    else if (/^auto:/.test(conferir) && !lerConferencia(conferir).conhecido) conferir = `olho:${pronto}`
    feitos.push({ intencao, pronto, tamanho: x.tamanho, natureza: x.natureza, area: x.area, conferir })
  })
  if (TRAVESSAO.test(JSON.stringify(v))) erros.push('sem travessão')
  return erros.length ? { ok: false, itens: [], erros } : { ok: true, itens: feitos, erros: [] }
}

/** A primeira parte do mapa, pela ordem, que ainda não teve a rota proposta. */
export const proximaParteSemRota = (produto) =>
  [...(produto?.partes || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).find((x) => !x.rota) || null

/** As frentes novas que o mapa traz: só os códigos que o catálogo ainda não tem. Sem catálogo, nada (ele não é criado). */
export function frentesDoMapa(produto, catalogo) {
  if (!catalogo) return {}
  const novas = {}
  for (const x of produto?.partes || []) if (!(x.codigo in catalogo)) novas[x.codigo] = `${x.nome}: ${x.atividade}`.slice(0, 140)
  return novas
}

/** A definição em quatro linhas, para o `porque` do cartão. */
export const textoDaDefinicao = (d) => [
  `O que é: ${d?.oque || '(sem resposta)'}`, `Para quem: ${d?.paraQuem || '(sem resposta)'}`,
  `Problema: ${d?.problema || '(sem resposta)'}`, `Deu certo quando: ${d?.sucesso || '(sem resposta)'}`,
].join('\n')
