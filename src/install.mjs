// Instala o protocolo do painel no CLAUDE.md de um projeto — ou de todos.
//
// A edição é determinística e idempotente: o bloco vive entre marcadores e é
// substituído inteiro a cada sync. Nada fora dos marcadores é tocado.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJobs, PROJECT_DIRS } from './jobs.mjs'
import { readConfig } from './config.mjs'

const START = '<!-- control-center:start -->'
const END = '<!-- control-center:end -->'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CC = path.join(ROOT, 'cc.mjs').replace(/\\/g, '/')

/** Pastas que não são projeto: template, arquivo morto, ocultas. */
const SKIP = /^([._-]|archived$|node_modules$)/i

/**
 * Onde ficam os projetos nesta máquina. Em ordem: variável de ambiente,
 * config, ou descoberto pelos diretórios dos jobs que o Claude Code já rodou —
 * quem usa o painel necessariamente já rodou agente dentro dos projetos.
 */
export function projectsBase() {
  if (process.env.CC_PROJECTS_BASE) return process.env.CC_PROJECTS_BASE
  const cfg = readConfig().projectsBase
  if (cfg) return cfg
  return detectarBase()
}

export function detectarBase(jobs = readJobs()) {
  const votos = new Map()
  for (const j of jobs) {
    const dir = j.cwd || ''
    const parts = dir.split(/[\\/]/)
    const i = parts.findIndex((p) => PROJECT_DIRS.includes(p.toLowerCase()))
    if (i < 0) continue
    const base = parts.slice(0, i + 1).join(path.sep)
    votos.set(base, (votos.get(base) || 0) + 1)
  }
  const melhor = [...votos].sort((a, b) => b[1] - a[1])[0]
  return melhor ? melhor[0] : null
}

export function blockText() {
  return `${START}
## Control Center — reportar estado

Rodando como job de background, mantenha o painel atualizado. Merge parcial, o
job é descoberto pelo ambiente:

\`\`\`bash
cc set '<json parcial>'
\`\`\`

- **Ao entender a tarefa:** \`subject\` (3-6 palavras, o problema — não o comando),
  \`category\`, \`todos\` e **\`frente\`**
- **\`frente\` é o título da seção do \`docs/ROADMAP.md\` onde este trabalho
  entra** — \`"Pierre"\`, \`"Jogo do evento"\`. É o que liga o agente ao mapa do
  projeto: sem isso o cartão vira texto solto para quem não tem o contexto na
  cabeça. Projeto sem roadmap: escreva a frente assim mesmo, em 1-3 palavras
- **Assim que cada to-do fecha:** \`cc done "texto da tarefa"\` — casa sem acento
  e sem caixa, e não exige reenviar a lista. Travou? \`blockers\`
- **Ao entregar:** \`status\`, \`links\`, \`blockers: null\` — e **a lista fechada**

**Entregar deixando to-do aberto é erro:** ou fecha o que terminou, ou explica
em \`blockers\` o que ficou. O tempo por tarefa sai daí; lista em aberto num
agente entregue é métrica perdida, e o painel denuncia.

Desligado (\`cc off\`), o comando vira no-op silencioso — pode chamar sempre.
Se \`cc\` não estiver no PATH, use \`node ${CC} set …\`.

Protocolo completo: https://github.com/felipecarzo/claudecontrolcenter/blob/master/AGENTS.md
${END}`
}

/**
 * Cria ou atualiza o bloco no CLAUDE.md do projeto.
 * Sem CLAUDE.md, não inventa arquivo: um CLAUDE.md só com esse bloco confundiria
 * mais do que ajudaria. Devolve 'missing' pra quem quiser tratar.
 */
export function installInto(projectRoot, { create = false } = {}) {
  const file = path.join(projectRoot, 'CLAUDE.md')
  const block = blockText()

  if (!fs.existsSync(file)) {
    if (!create) return { file, action: 'missing' }
    fs.writeFileSync(file, `# ${path.basename(projectRoot)}\n\n${block}\n`)
    return { file, action: 'created' }
  }

  const current = fs.readFileSync(file, 'utf8')
  const from = current.indexOf(START)
  const to = current.indexOf(END)

  if (from >= 0 && to > from) {
    const next = current.slice(0, from) + block + current.slice(to + END.length)
    if (next === current) return { file, action: 'unchanged' }
    fs.writeFileSync(file, next)
    return { file, action: 'updated' }
  }

  fs.writeFileSync(file, current.replace(/\s*$/, '\n\n') + block + '\n')
  return { file, action: 'added' }
}

export function removeFrom(projectRoot) {
  const file = path.join(projectRoot, 'CLAUDE.md')
  if (!fs.existsSync(file)) return { file, action: 'missing' }
  const current = fs.readFileSync(file, 'utf8')
  const from = current.indexOf(START)
  const to = current.indexOf(END)
  if (from < 0 || to < from) return { file, action: 'unchanged' }
  const next = (current.slice(0, from) + current.slice(to + END.length)).replace(/\n{3,}/g, '\n\n')
  fs.writeFileSync(file, next)
  return { file, action: 'removed' }
}

const isProject = (dir) =>
  fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'CLAUDE.md'))

const dirsIn = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !SKIP.test(d.name))
      .map((d) => path.join(dir, d.name))
  } catch {
    return []
  }
}

/**
 * Projetos ficam em `projetos/<projeto>` ou `projetos/<GRUPO>/<projeto>`.
 * Só desce no grupo quando o nível de cima não é projeto por si — assim um
 * monorepo com subpastas não vira N projetos.
 */
export function findProjects(base = projectsBase()) {
  if (!base) return [] // sem base conhecida não há o que varrer
  const found = []
  for (const dir of dirsIn(base)) {
    if (isProject(dir)) found.push(dir)
    else for (const sub of dirsIn(dir)) if (isProject(sub)) found.push(sub)
  }
  return found.sort()
}

export function syncAll({ base = projectsBase(), dryRun = false, remove = false } = {}) {
  return findProjects(base).map((dir) => {
    if (dryRun) {
      const file = path.join(dir, 'CLAUDE.md')
      const has = fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(START)
      return { project: path.basename(dir), dir, action: has ? 'já tem' : fs.existsSync(file) ? 'seria adicionado' : 'sem CLAUDE.md' }
    }
    const r = remove ? removeFrom(dir) : installInto(dir)
    return { project: path.basename(dir), dir, ...r }
  })
}
