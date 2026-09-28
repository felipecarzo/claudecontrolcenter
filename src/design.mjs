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
    texto: texto ? texto.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').slice(0, 60000) : '',
  }
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
