/**
 * CC-666, o Armário. Pedido dele em 28/09: "notas numa gaveta, gavetas que
 * eu crio, documentação dos projetos, arquivos (PDF, imagem), coisas
 * importantes como imagens ou áudios também, mas eu quero uma zona de
 * anotações minhas que sejam bem parecidas com o Notes da Apple".
 *
 * Onde mora cada coisa:
 *  - as NOTAS continuam no arquivo de sempre (notes.mjs), que tem cópia de
 *    segurança desde o apagamento de 09/08; a gaveta é um campo da nota;
 *  - as gavetas que ele cria e os ARQUIVOS moram aqui, no abrigo do painel
 *    (~/.local/share/agent-cockpit/armario), que o serviço e a área isolada
 *    conseguem escrever;
 *  - a DOCUMENTAÇÃO de cada projeto é lida da pasta docs dele, só leitura.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { findProjects } from './install.mjs'
import { nomeCanonico } from './nomeProjeto.mjs'
import { readNotes } from './notes.mjs'

const DIR = () => path.join(os.homedir(), '.local', 'share', 'agent-cockpit', 'armario')
const ARQ_GAVETAS = () => path.join(DIR(), 'gavetas.json')
const ARQ_ARQUIVOS = () => path.join(DIR(), 'arquivos.json')
const DIR_BLOBS = () => path.join(DIR(), 'arquivos')
export const LIMITE_ARQUIVO = 15 * 1024 * 1024
const TIPOS = /^(image\/(png|jpe?g|webp|gif|svg\+xml)|audio\/(mpeg|mp4|ogg|webm|wav|x-m4a|aac)|application\/pdf|text\/plain)$/

const lerJson = (f, padrao) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return padrao } }
function gravarJson(f, dado) {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(`${f}.tmp`, JSON.stringify(dado, null, 1))
  fs.renameSync(`${f}.tmp`, f)
}
const novoId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const gavetas = () => lerJson(ARQ_GAVETAS(), [])
export const arquivos = () => lerJson(ARQ_ARQUIVOS(), [])

/** O retrato do armário: gavetas com contagem, e os projetos com documentação. */
export function listar() {
  const notas = readNotes(); const arqs = arquivos()
  const conta = (g) => notas.filter((n) => (n.gaveta || 'notas') === g).length + arqs.filter((a) => a.gaveta === g).length
  const projetos = findProjects().map((raiz) => ({ raiz, nome: nomeCanonico(path.basename(raiz)), docs: docsDe(raiz).length })).filter((p) => p.docs)
    .sort((a, b) => a.nome.localeCompare(b.nome))
  return {
    gavetas: [{ id: 'notas', nome: 'Notas', fixa: true, conta: conta('notas') }, ...gavetas().map((g) => ({ ...g, conta: conta(g.id) }))],
    arquivos: arqs,
    projetos,
  }
}

export function criarGaveta(nome) {
  const n = String(nome || '').trim().slice(0, 60)
  if (!n) return { ok: false, erro: 'a gaveta precisa de um nome' }
  const lista = gavetas()
  if (lista.some((g) => g.nome.toLowerCase() === n.toLowerCase()) || n.toLowerCase() === 'notas') return { ok: false, erro: 'já existe uma gaveta com esse nome' }
  const g = { id: novoId('g'), nome: n, em: Date.now() }
  gravarJson(ARQ_GAVETAS(), [...lista, g])
  return { ok: true, gaveta: g }
}
export function renomearGaveta(id, nome) {
  const n = String(nome || '').trim().slice(0, 60)
  const lista = gavetas(); const g = lista.find((x) => x.id === id)
  if (!g || !n) return { ok: false, erro: 'gaveta ou nome inválido' }
  g.nome = n; gravarJson(ARQ_GAVETAS(), lista)
  return { ok: true, gaveta: g }
}
/** Só gaveta vazia sai: apagar não leva nada junto, sem aviso. */
export function apagarGaveta(id) {
  const vazia = !readNotes().some((n) => n.gaveta === id) && !arquivos().some((a) => a.gaveta === id)
  if (!vazia) return { ok: false, erro: 'esvazie a gaveta antes de apagar' }
  gravarJson(ARQ_GAVETAS(), gavetas().filter((g) => g.id !== id))
  return { ok: true }
}

const gavetaExiste = (g) => g === 'notas' || gavetas().some((x) => x.id === g)

/* CC-709: arquivo pode pertencer a um projeto (a raiz dele), como a nota. Só
   projeto que esta máquina conhece; vazio tira do projeto. */
const projetoValido = (p) => !p || findProjects().includes(p)
export function projetoDoArquivo(id, projeto) {
  if (!projetoValido(projeto)) return { ok: false, erro: 'projeto desconhecido' }
  const lista = arquivos(); const a = lista.find((x) => x.id === id)
  if (!a) return { ok: false, erro: 'arquivo não existe' }
  a.projeto = projeto || null; gravarJson(ARQ_ARQUIVOS(), lista)
  return { ok: true }
}

export function subirArquivo({ gaveta, nome, mime, dados, projeto }) {
  if (!gavetaExiste(gaveta)) return { ok: false, erro: 'gaveta não existe' }
  if (!projetoValido(projeto)) return { ok: false, erro: 'projeto desconhecido' }
  if (!TIPOS.test(String(mime || ''))) return { ok: false, erro: 'tipo de arquivo não aceito (imagem, áudio, PDF ou texto)' }
  const buf = Buffer.from(String(dados || '').replace(/^data:[^,]*,/, ''), 'base64')
  if (!buf.length) return { ok: false, erro: 'arquivo vazio' }
  if (buf.length > LIMITE_ARQUIVO) return { ok: false, erro: 'arquivo maior que 15 MB' }
  const a = { id: novoId('a'), gaveta, projeto: projeto || null, nome: path.basename(String(nome || 'arquivo')).slice(0, 120), mime, bytes: buf.length, em: Date.now() }
  fs.mkdirSync(DIR_BLOBS(), { recursive: true })
  fs.writeFileSync(path.join(DIR_BLOBS(), a.id), buf)
  gravarJson(ARQ_ARQUIVOS(), [a, ...arquivos()])
  return { ok: true, arquivo: a }
}
export function apagarArquivo(id) {
  const lista = arquivos(); if (!lista.some((a) => a.id === id)) return { ok: false, erro: 'arquivo não existe' }
  gravarJson(ARQ_ARQUIVOS(), lista.filter((a) => a.id !== id))
  try { fs.unlinkSync(path.join(DIR_BLOBS(), path.basename(id))) } catch { /* já não estava */ }
  return { ok: true }
}
export function moverArquivo(id, gaveta) {
  if (!gavetaExiste(gaveta)) return { ok: false, erro: 'gaveta não existe' }
  const lista = arquivos(); const a = lista.find((x) => x.id === id)
  if (!a) return { ok: false, erro: 'arquivo não existe' }
  a.gaveta = gaveta; gravarJson(ARQ_ARQUIVOS(), lista)
  return { ok: true }
}
/** O arquivo guardado, para servir: só id conhecido, só dentro da pasta. */
export function arquivoParaServir(id) {
  const a = arquivos().find((x) => x.id === id)
  if (!a) return null
  const f = path.join(DIR_BLOBS(), path.basename(a.id))
  return fs.existsSync(f) ? { ...a, caminho: f } : null
}

/* A documentação de um projeto: os .md da pasta docs (até dois níveis) e o
   README da raiz. CC-709, decisão dele em 29/09: as abas do Armário são as
   pastas do padrão, e diário e legado são duas delas; antes ficavam de fora
   por volume. O teto era 80 e cortava calado (o cockpit tinha 80 exatos). */
export const TETO_DOCS = 600
export function docsDe(raiz) {
  const achados = []
  const dirDocs = path.join(raiz, 'docs')
  const varrer = (dir, nivel) => {
    let nomes = []
    try { nomes = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const d of nomes) {
      if (d.name.startsWith('.')) continue
      const f = path.join(dir, d.name)
      if (d.isDirectory()) { if (nivel < 2) varrer(f, nivel + 1) }
      else if (/\.md$/i.test(d.name)) achados.push(path.relative(raiz, f))
    }
  }
  if (fs.existsSync(path.join(raiz, 'README.md'))) achados.push('README.md')
  varrer(dirDocs, 1)
  return achados.slice(0, TETO_DOCS)
}
/** Um documento de projeto: só projeto conhecido, só .md, só dentro dele. */
export function lerDoc(raiz, rel) {
  if (!findProjects().includes(raiz)) return null
  if (!docsDe(raiz).includes(rel)) return null
  try { return fs.readFileSync(path.join(raiz, rel), 'utf8').slice(0, 200000) } catch { return null }
}
