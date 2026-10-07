/**
 * CC-654, área de design 1/4: a identidade visual de cada projeto.
 *
 * Pedido dele em 28/09 ("área de construção de design", as quatro partes).
 * Esta primeira volta só LÊ: o arquivo de design que o projeto já tem, as
 * cores e fontes declaradas nele, e os arquivos de marca. Ajustar pelo painel
 * grava dentro do projeto, e fica para depois de ele ver a tela.
 *
 * Os formatos variam, medido nos projetos desta VPS: o do cockpit traz cores e
 * fontes num cabeçalho YAML (padrão DESIGN.md); o do inovallbond é texto
 * corrido. Cabeçalho vale mais; sem ele, as cores saem dos hex citados no
 * texto, com a linha onde aparecem, para ele saber de onde veio cada uma.
 */
import fs from 'node:fs'
import path from 'node:path'
import { findProjects } from './install.mjs'
import { nomeCanonico } from './nomeProjeto.mjs'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

const ARQUIVOS = ['DESIGN.md', 'docs/guias/DESIGN.md', 'docs/guias/design-referencia.md', 'docs/DESIGN.md']
const PASTAS_MARCA = ['assets/brand', 'icons/brand', 'assets/logo', 'public/brand', 'public/logo', 'assets/img/logo']
const IMAGEM = /\.(svg|png|webp|jpe?g)$/i
const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi

const ler = (f) => { try { return fs.readFileSync(f, 'utf8') } catch { return null } }

/** Cabeçalho YAML simples: só `colors:` e `typography:`, que é o que se mostra. */
export function lerCabecalho(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto || '')
  if (!m) return null
  const cores = []; const fontes = []
  let bloco = null; let item = null
  for (const linha of m[1].split(/\r?\n/)) {
    const topo = /^(\w[\w-]*):\s*(.*)$/.exec(linha)
    if (topo) { bloco = topo[1]; item = null; continue }
    const k = /^ {2}([\w-]+):\s*"?([^"]*)"?\s*$/.exec(linha)
    if (k && bloco === 'colors' && /^#[0-9a-f]{3,8}$/i.test(k[2])) cores.push({ nome: k[1], hex: k[2] })
    else if (k && bloco === 'typography') item = k[1]
    const f = /^ {4}fontFamily:\s*"?([^"]*)"?\s*$/.exec(linha)
    if (f && bloco === 'typography') fontes.push({ nome: item, familia: f[1].split(',')[0].trim() })
  }
  return { cores, fontes }
}

/** Sem cabeçalho: os hex citados no texto, cada um com a linha de onde saiu. */
export function coresDoTexto(texto, max = 24) {
  const vistos = new Map()
  for (const linha of String(texto || '').split(/\r?\n/)) {
    for (const hex of linha.match(HEX) || []) {
      const k = hex.toLowerCase()
      if (!vistos.has(k)) vistos.set(k, { nome: null, hex: k, onde: linha.replace(/[|`*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) })
    }
    if (vistos.size >= max) break
  }
  return [...vistos.values()]
}

function marcas(raiz) {
  const achados = []
  for (const p of PASTAS_MARCA) {
    let nomes = []
    try { nomes = fs.readdirSync(path.join(raiz, p)) } catch { continue }
    for (const n of nomes) if (IMAGEM.test(n)) achados.push(p + '/' + n)
  }
  return achados.slice(0, 12)
}

export function identidade(raiz) {
  const arquivos = ARQUIVOS.filter((a) => ler(path.join(raiz, a)) !== null)
  const principal = arquivos[0] || null
  const texto = principal ? ler(path.join(raiz, principal)) : ''
  const cab = lerCabecalho(texto)
  const cores = cab?.cores?.length ? cab.cores : coresDoTexto(texto)
  return {
    raiz,
    projeto: nomeCanonico(path.basename(raiz)),
    arquivos,
    principal,
    cores,
    coresDe: cab?.cores?.length ? 'cabecalho' : (cores.length ? 'texto' : null),
    fontes: cab?.fontes || [],
    marcas: marcas(raiz),
    regras: regrasDoPainel(texto), // CC-658
    texto: texto ? texto.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').slice(0, 60000) : '',
  }
}

/* CC-658, design 1b: ajustar a identidade pelo painel. Toda gravação dentro do projeto passa por
   gravarNoProjeto, que antes guarda a versão anterior no abrigo do painel, com data e FORA do projeto
   (.bak ao lado sujaria o git dos outros projetos e guardaria só a última). Sem cópia, não grava. */
export const DIR_COPIAS = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'design-copias')
export const SECAO_REGRAS = '## Regras do painel'
let seqCopia = 0

/** Grava texto ou Buffer em raiz/rel, guardando antes a versão anterior. Devolve { arquivo, copia }. */
export function gravarNoProjeto(raiz, rel, conteudo) {
  const base = path.resolve(raiz)
  const alvo = path.resolve(base, String(rel || ''))
  if (!rel || path.isAbsolute(rel) || !alvo.startsWith(base + path.sep)) throw new Error('caminho fora do projeto: ' + rel)
  let copia = null
  if (fs.existsSync(alvo)) {
    // ponytail: as cópias só crescem; apagar as velhas quando a pasta pesar
    const dir = path.join(DIR_COPIAS(), nomeCanonico(path.basename(base)))
    fs.mkdirSync(dir, { recursive: true })
    copia = path.join(dir, new Date().toISOString().replace(/[:.]/g, '-') + '-' + (seqCopia++) + '__' + String(rel).split(/[\\/]/).join('__'))
    fs.copyFileSync(alvo, copia) // falhou a cópia, lança: não grava
  }
  fs.mkdirSync(path.dirname(alvo), { recursive: true })
  const tmp = alvo + '.tmp-' + process.pid
  fs.writeFileSync(tmp, conteudo)
  fs.renameSync(tmp, alvo)
  return { arquivo: rel, copia }
}

const faixaDoCabecalho = (ls) => { if (ls[0] !== '---') return null; const fim = ls.indexOf('---', 1); return fim > 0 ? [1, fim] : null }
const partes = (texto) => ({ eol: texto.includes('\r\n') ? '\r\n' : '\n', ls: texto.split(/\r?\n/) })

/** As linhas "- " da seção "## Regras do painel", até o próximo título de nível 1 ou 2. */
export function regrasDoPainel(texto) {
  const ls = String(texto || '').split(/\r?\n/)
  const i = ls.findIndex((l) => l.trim() === SECAO_REGRAS)
  if (i < 0) return []
  const out = []
  for (const l of ls.slice(i + 1)) { if (/^#{1,2} /.test(l)) break; if (/^- /.test(l)) out.push(l.slice(2).trim()) }
  return out
}

export function editarCor(raiz, { nome = null, de = null, para } = {}) {
  const rel = identidade(raiz).principal
  if (!rel) return { ok: false, erro: 'este projeto não tem arquivo de design' }
  if (!/^#[0-9a-f]{6}$/i.test(String(para || ''))) return { ok: false, erro: 'cor inválida: use #rrggbb' }
  const novo = String(para).toLowerCase()
  const { eol, ls } = partes(ler(path.join(raiz, rel)) || '')
  const faixa = faixaDoCabecalho(ls)
  let trocas = 0
  if (nome && faixa) {
    let bloco = null
    for (let i = faixa[0]; i < faixa[1]; i++) {
      const topo = /^(\w[\w-]*):/.exec(ls[i]); if (topo) { bloco = topo[1]; continue }
      const k = /^ {2}([\w-]+):\s*"?(#[0-9a-fA-F]{3,8})"?\s*$/.exec(ls[i])
      if (bloco === 'colors' && k && k[1] === nome) { ls[i] = ls[i].replace(k[2], novo); trocas++ }
    }
  } else if (!nome && /^#[0-9a-f]{3,8}$/i.test(String(de || ''))) {
    const re = new RegExp(String(de) + '(?![0-9a-f])', 'gi') // de é só # e hexadecimal: seguro dentro de RegExp
    for (let i = 0; i < ls.length; i++) ls[i] = ls[i].replace(re, () => { trocas++; return novo })
  }
  if (!trocas) return { ok: false, erro: 'não achei essa cor no arquivo' }
  const g = gravarNoProjeto(raiz, rel, ls.join(eol))
  return { ok: true, arquivo: rel, trocas, copia: g.copia, identidade: identidade(raiz) }
}

export function editarFonte(raiz, { de, para } = {}) {
  const rel = identidade(raiz).principal
  if (!rel) return { ok: false, erro: 'este projeto não tem arquivo de design' }
  const nova = String(para || '').replace(/\s+/g, ' ').trim()
  if (!/^[\p{L}\p{N} ._-]{2,60}$/u.test(nova)) return { ok: false, erro: 'nome de fonte inválido' }
  const { eol, ls } = partes(ler(path.join(raiz, rel)) || '')
  const faixa = faixaDoCabecalho(ls)
  if (!faixa) return { ok: false, erro: 'só dá para trocar fonte de arquivo com cabeçalho' }
  let bloco = null; let trocas = 0
  for (let i = faixa[0]; i < faixa[1]; i++) {
    const topo = /^(\w[\w-]*):/.exec(ls[i]); if (topo) { bloco = topo[1]; continue }
    const f = /^( {4}fontFamily:\s*"?)([^",]+)/.exec(ls[i])
    if (bloco === 'typography' && f && f[2].trim() === String(de || '').trim()) { ls[i] = f[1] + nova + ls[i].slice(f[0].length); trocas++ }
  }
  if (!trocas) return { ok: false, erro: 'não achei essa fonte no cabeçalho' }
  const g = gravarNoProjeto(raiz, rel, ls.join(eol))
  return { ok: true, arquivo: rel, trocas, copia: g.copia, identidade: identidade(raiz) }
}

/** Uma linha nova na seção de regras. Sem seção, ela nasce no fim; sem arquivo, nasce DESIGN.md. */
export function acrescentarRegra(raiz, texto) {
  // só travessão e meia-risca viram vírgula; o hífen comum fica (mini-jogo continua mini-jogo)
  const t = String(texto || '').replace(new RegExp('\\s*[' + String.fromCharCode(0x2014, 0x2013) + ']\\s*', 'g'), ', ').replace(/\s+/g, ' ').trim()
  if (t.length < 4 || t.length > 300) return { ok: false, erro: 'a regra precisa ter de 4 a 300 letras' }
  const rel = identidade(raiz).principal || 'DESIGN.md'
  const atual = ler(path.join(raiz, rel)) ?? ''
  const { eol, ls } = atual ? partes(atual) : { eol: '\n', ls: [] }
  const linha = '- ' + t + ' (pelo painel, ' + new Date().toLocaleDateString('pt-BR') + ')'
  const i = ls.findIndex((l) => l.trim() === SECAO_REGRAS)
  if (i < 0) {
    while (ls.length && !ls[ls.length - 1].trim()) ls.pop()
    ls.push(...(ls.length ? [''] : []), SECAO_REGRAS, '', 'Regras que ele acrescentou pelo cockpit. Valem para toda tela deste projeto.', '', linha, '')
  } else {
    let j = i + 1; while (j < ls.length && !/^#{1,2} /.test(ls[j])) j++
    let k = j; while (k > i + 1 && !ls[k - 1].trim()) k--
    ls.splice(k, 0, linha)
  }
  const g = gravarNoProjeto(raiz, rel, ls.join(eol))
  return { ok: true, arquivo: rel, copia: g.copia, identidade: identidade(raiz) }
}

/** A lista, leve: sem o texto, que só vai quando ele abre um projeto. */
export function listar() {
  return findProjects().map((raiz) => {
    const { texto, ...resto } = identidade(raiz)
    return resto
  }).sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0) || a.projeto.localeCompare(b.projeto))
}

/** Só projeto conhecido, só dentro dele, só imagem: é o que a rota de arquivo serve. */
export function caminhoDeMarca(raiz, rel) {
  if (!findProjects().includes(raiz) || !IMAGEM.test(rel || '')) return null
  const alvo = path.resolve(raiz, rel)
  return alvo.startsWith(path.resolve(raiz) + path.sep) && marcas(raiz).includes(rel) ? alvo : null
}
