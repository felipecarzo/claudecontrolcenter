/**
 * Varredura de impacto de mover/renomear pasta de projeto.
 *
 * Nasceu de um erro real, 23/08: renomear as pastas de `~/projetos` para o
 * prefixo `VPS_` foi dito como "não quebra nada" e quebrou o venv de dois
 * projetos, uma dependência editável cruzada e quatro conversas do painel. O
 * ponto cego era sempre o mesmo: coisas que guardam CAMINHO ABSOLUTO por dentro
 * e não seguem a pasta quando ela muda de nome.
 *
 * Esta ferramenta procura o sintoma direto: **caminho absoluto para dentro de
 * `~/projetos/<algo>` onde `<algo>` não existe mais como pasta.** Assim não
 * depende de saber o nome velho: qualquer mudança que deixe um ponteiro morto
 * aparece aqui.
 *
 * Só LÊ. Não conserta nada. A saída é a lista do que aponta para o vazio, por
 * classe. Zero achados = a renomeação não deixou ponteiro morto conhecido.
 *
 * Uso:
 *   node tools/varredura-impacto.mjs            # imprime o relatório
 *   node tools/varredura-impacto.mjs --marca    # imprime E grava o carimbo que
 *                                               # a trava de ação exige
 *
 * O carimbo (`--marca`) fica em `~/.local/share/agent-cockpit/impacto-ok.json`
 * com a hora. A trava contra renomear/apagar em massa recusa a ação quando esse
 * carimbo não existe ou está velho: varrer antes de mexer deixa de ser hábito
 * que se esquece e vira porta que se atravessa.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const HOME = os.homedir()
const BASE = process.env.CC_PROJECTS_BASE || path.join(HOME, 'projetos')

// Um caminho absoluto para BASE/<nome>/... onde <nome> não é pasta viva.
const cacheVivo = new Map()
function pastaViva(nome) {
  if (cacheVivo.has(nome)) return cacheVivo.get(nome)
  let viva = false
  try { viva = fs.statSync(path.join(BASE, nome)).isDirectory() } catch { viva = false }
  cacheVivo.set(nome, viva)
  return viva
}

function escapar(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
const RE = new RegExp(escapar(BASE) + '/([A-Za-z0-9._-]+)', 'g')
// Devolve o primeiro projeto morto citado num texto, ou null.
function projetoMortoEm(texto) {
  const vistos = new Set()
  let m
  RE.lastIndex = 0
  while ((m = RE.exec(texto)) !== null) {
    const nome = m[1]
    if (vistos.has(nome)) continue
    vistos.add(nome)
    if (!pastaViva(nome)) return nome
  }
  return null
}

function listarArquivosTexto(dir) {
  const out = []
  const anda = (d, prof) => {
    if (prof > 8) return
    let ents = []
    try { ents = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isSymbolicLink()) continue
      if (e.isDirectory()) anda(p, prof + 1)
      else if (e.isFile()) out.push(p)
    }
  }
  anda(dir, 0)
  return out
}

function grepMorto(arquivos) {
  const achados = []
  for (const f of arquivos) {
    let txt = ''
    try {
      const buf = fs.readFileSync(f)
      if (buf.includes(0)) continue // pula binário
      txt = buf.toString('utf8')
    } catch { continue }
    if (!txt.includes(BASE)) continue
    const morto = projetoMortoEm(txt)
    if (morto) achados.push({ arquivo: f, morto })
  }
  return achados
}

function existe(p) { try { fs.accessSync(p); return true } catch { return false } }
function safeReaddir(d) { try { return fs.readdirSync(d) } catch { return [] } }

const classes = []

// 1. Venvs de Python: shebang, activate, .pth de instalação editável.
{
  const achados = []
  for (const nome of safeReaddir(BASE)) {
    for (const venv of [path.join(BASE, nome, 'venv'), path.join(BASE, nome, '.venv')]) {
      if (!existe(venv)) continue
      achados.push(...grepMorto(listarArquivosTexto(venv)))
    }
  }
  classes.push({ nome: 'venv de Python (caminho cravado no shebang/activate/.pth)', achados })
}

// 2. Serviços systemd do usuário.
{
  const dir = path.join(HOME, '.config/systemd/user')
  const achados = existe(dir) ? grepMorto(listarArquivosTexto(dir)) : []
  classes.push({ nome: 'serviço systemd do usuário', achados })
}

// 3. Links globais do npm apontando para pasta morta.
{
  const achados = []
  let groot = ''
  try { groot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim() } catch { groot = '' }
  if (groot && existe(groot)) {
    for (const nome of safeReaddir(groot)) {
      const l = path.join(groot, nome)
      let alvo = ''
      try { if (!fs.lstatSync(l).isSymbolicLink()) continue; alvo = fs.realpathSync(l) } catch { alvo = '' }
      if (alvo && alvo.startsWith(BASE + path.sep) && projetoMortoEm(alvo)) {
        achados.push({ arquivo: `${nome} -> ${alvo}`, morto: projetoMortoEm(alvo) })
      }
    }
  }
  classes.push({ nome: 'comando global do npm (npm i -g <pasta>)', achados })
}

// 4. Arquivos de inicialização do shell.
{
  const rc = ['.bashrc', '.bash_aliases', '.profile', '.bash_profile', '.zshrc']
    .map((n) => path.join(HOME, n)).filter(existe)
  classes.push({ nome: 'atalho no shell (alias/variável)', achados: grepMorto(rc) })
}

// 5. Cópias de trabalho do git com gitdir apontando para o lugar errado.
{
  const achados = []
  for (const nome of safeReaddir(BASE)) {
    const d = path.join(BASE, nome)
    if (!existe(path.join(d, '.git'))) continue
    try {
      const saida = execFileSync('git', ['-C', d, 'worktree', 'list'], { encoding: 'utf8' })
      if (/\bprunable\b/.test(saida) || projetoMortoEm(saida)) {
        achados.push({ arquivo: `${nome} (git worktree)`, morto: projetoMortoEm(saida) || 'prunable' })
      }
    } catch { /* projeto sem worktree extra */ }
  }
  classes.push({ nome: 'cópia de trabalho do git (worktree)', achados })
}

// 6. Estado do painel: conversa com cwd para pasta morta.
{
  const dirs = [
    path.join(HOME, '.claude/control-center-gate'),
    path.join(HOME, '.local/share/agent-cockpit/gate'),
  ].filter(existe)
  const achados = []
  for (const dir of dirs) {
    for (const f of safeReaddir(dir)) {
      if (!f.endsWith('.json')) continue
      const p = path.join(dir, f)
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'))
        if (j && typeof j.cwd === 'string' && j.cwd.startsWith(BASE + path.sep) && projetoMortoEm(j.cwd)) {
          achados.push({ arquivo: `${f} (cwd: ${j.cwd})`, morto: projetoMortoEm(j.cwd) })
        }
      } catch { /* arquivo pela metade, ignora */ }
    }
  }
  classes.push({ nome: 'conversa do painel apontando para pasta morta', achados })
}

// 7. Scripts soltos na home e nos diretórios de binário do usuário.
{
  const dirs = [path.join(HOME, '.local/bin'), path.join(HOME, 'bin')].filter(existe)
  const arquivos = [
    ...safeReaddir(HOME).filter((n) => n.endsWith('.sh')).map((n) => path.join(HOME, n)),
    ...dirs.flatMap((d) => listarArquivosTexto(d)),
  ].filter(existe)
  classes.push({ nome: 'script solto na home / .local/bin', achados: grepMorto(arquivos) })
}

// ---- relatório ----
let total = 0
const linhas = []
for (const c of classes) {
  total += c.achados.length
  linhas.push(`\n== ${c.nome} ==`)
  if (!c.achados.length) { linhas.push('   ok, nenhum ponteiro morto'); continue }
  for (const a of c.achados) linhas.push(`   QUEBRADO  ${a.arquivo}   (projeto sumido: ${a.morto})`)
}

console.log('VARREDURA DE IMPACTO — base:', BASE)
console.log(linhas.join('\n'))
console.log(`\nTotal de ponteiros mortos: ${total}`)
if (total > 0) console.log('Conserte ou confirme cada um ANTES de dizer que a mudança não quebra nada.')

if (process.argv.includes('--marca')) {
  const dir = path.join(HOME, '.local/share/agent-cockpit')
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'impacto-ok.json'),
      JSON.stringify({ em: Date.now(), base: BASE, mortos: total }, null, 1))
    console.log('\nCarimbo gravado. A trava de ação em massa agora libera por um tempo.')
  } catch (e) {
    console.log('\nNÃO consegui gravar o carimbo:', e.message)
    process.exitCode = 1
  }
}
