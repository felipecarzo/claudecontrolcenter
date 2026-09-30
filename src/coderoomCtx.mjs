/**
 * CC-712, o contexto do Coderoom (decisões dele em 29/09): os arquivos do
 * projeto (os principais para a coluna da direita, todos para o "@ arquivo"
 * da caixa de escrita) e os comandos e skills para o "/ comando".
 *
 * Só leitura. Os arquivos saem do `git ls-files`, que já ignora o que o
 * projeto não guarda (node_modules, build); sem git, lista o topo da pasta.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { casaClaude } from './platform.mjs'

const TETO_ARQUIVOS = 4000

function git(raiz, args) {
  return new Promise((ok) => execFile('git', ['-C', raiz, ...args], { encoding: 'utf8', timeout: 5000, maxBuffer: 16 * 1024 * 1024 }, (err, out) => ok(err ? null : out)))
}

/** Os arquivos do projeto: todos (até o teto) e o topo agrupado, com contagem. */
export async function arquivosDe(raiz) {
  const saida = await git(raiz, ['ls-files'])
  let todos
  if (saida != null) todos = saida.split('\n').filter(Boolean)
  else {
    // sem git: só o que está no topo da pasta
    try { todos = fs.readdirSync(raiz, { withFileTypes: true }).filter((d) => !d.name.startsWith('.') && d.isFile()).map((d) => d.name) } catch { todos = [] }
  }
  const topo = new Map()
  for (const f of todos) {
    const [primeiro, ...resto] = f.split('/')
    const k = resto.length ? primeiro + '/' : primeiro
    topo.set(k, (topo.get(k) || 0) + 1)
  }
  // pastas primeiro (as maiores antes), depois os arquivos soltos do topo
  const principais = [...topo.entries()]
    .map(([nome, n]) => ({ nome, pasta: nome.endsWith('/'), n }))
    .sort((a, b) => (b.pasta - a.pasta) || (b.n - a.n) || a.nome.localeCompare(b.nome))
  return { git: saida != null, total: todos.length, principais, todos: todos.slice(0, TETO_ARQUIVOS), cortado: todos.length > TETO_ARQUIVOS }
}

/* A primeira linha de `description:` do cabeçalho de um .md, ou a primeira
   linha de texto. Serve para a lista do "/" dizer o que cada comando faz. */
function descricaoDe(arquivo) {
  let t = ''
  try { t = fs.readFileSync(arquivo, 'utf8').slice(0, 4000) } catch { return '' }
  const m = /^---[\s\S]*?\ndescription:\s*(.+)/m.exec(t)
  if (m) return m[1].replace(/^["']|["']$/g, '').trim().slice(0, 160)
  const linha = t.replace(/^---[\s\S]*?---/, '').split('\n').find((l) => l.trim() && !l.startsWith('#'))
  return (linha || '').trim().slice(0, 160)
}

/** Comandos (`/nome`) do projeto e globais, e as skills. O do projeto vence o global de mesmo nome, como no Claude Code. */
export function comandosDe(raiz) {
  const casa = casaClaude()
  const vistos = new Map()
  const juntar = (dir, origem) => {
    let nomes = []
    try { nomes = fs.readdirSync(dir) } catch { return }
    for (const n of nomes) {
      if (!n.endsWith('.md')) continue
      const nome = n.replace(/\.md$/, '')
      if (!vistos.has(nome)) vistos.set(nome, { nome, origem, tipo: 'comando', descricao: descricaoDe(path.join(dir, n)) })
    }
  }
  if (raiz) juntar(path.join(raiz, '.claude', 'commands'), 'projeto')
  juntar(path.join(casa, 'commands'), 'global')
  let skills = []
  try { skills = fs.readdirSync(path.join(casa, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory() || d.isSymbolicLink()) } catch { /* sem skills */ }
  for (const d of skills) {
    const arq = path.join(casa, 'skills', d.name, 'SKILL.md')
    if (!vistos.has(d.name) && fs.existsSync(arq)) vistos.set(d.name, { nome: d.name, origem: 'skill', tipo: 'skill', descricao: descricaoDe(arq) })
  }
  return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}
