// Instala o protocolo do painel no CLAUDE.md de um projeto — ou de todos.
//
// A edição é determinística e idempotente: o bloco vive entre marcadores e é
// substituído inteiro a cada sync. Nada fora dos marcadores é tocado.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJobs, PROJECT_DIRS } from './jobs.mjs'
import { readConfig, setPastasDeProjeto } from './config.mjs'
import { ehWindows } from './platform.mjs'

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
/**
 * CC-352: TODAS as pastas onde ele guarda projeto, não só uma. Ele pediu poder
 * apontar mais de uma ("projetos de música, de TI, de outras coisas"). Em ordem
 * de fonte, e unidas: a variável de ambiente (aceita várias separadas por `:`
 * ou `;`), a lista `projectsBases` do config, o campo único `projectsBase`
 * (legado), e — só se nada foi configurado — a descoberta pelos jobs.
 *
 * O instalador é quem PREENCHE essa lista na máquina dele (parte do PC); aqui é
 * a leitura, que faz o painel varrer todas as pastas escolhidas.
 */
export function projectsBases() {
  const out = []
  /* Achado em 26/08: `:` também é a letra de unidade do Windows (`D:\...`), e
     dividir por `[:;]` ali quebrava QUALQUER caminho no meio, base única
     incluída. `;` já é o separador nativo do Windows (é o mesmo do PATH),
     então no Windows ele é o único usado; `:` continua valendo fora daqui. */
  const separador = ehWindows ? /;/ : /[:;]/
  if (process.env.CC_PROJECTS_BASE) out.push(...process.env.CC_PROJECTS_BASE.split(separador))
  const cfg = readConfig()
  if (Array.isArray(cfg.projectsBases)) out.push(...cfg.projectsBases)
  if (cfg.projectsBase) out.push(cfg.projectsBase)
  const limpo = [...new Set(out.map((p) => String(p || '').trim()).filter(Boolean))]
  if (limpo.length) return limpo
  const detectado = detectarBase()
  return detectado ? [detectado] : []
}

/** A primeira das pastas, para quem só sabe lidar com uma. */
export function projectsBase() {
  return projectsBases()[0] || null
}

/** Só as que foram ESCOLHIDAS, sem a descoberta automática nem a variável de
 *  ambiente. É o que a bandeja e o instalador mostram como "as suas pastas":
 *  misturar a adivinhada com a escolhida faria ele apagar uma linha e ela
 *  voltar sozinha na leitura seguinte. */
export function basesEscolhidas(cfg = readConfig()) {
  if (Array.isArray(cfg.projectsBases)) return cfg.projectsBases
  return cfg.projectsBase ? [cfg.projectsBase] : []
}

/**
 * CC-352, a parte do PC: acrescenta uma pasta à lista.
 *
 * A gravação é `setPastasDeProjeto`, de `config.mjs`, a MESMA que a tela usa
 * desde 27/08. Duas funções escrevendo o mesmo campo seriam duas verdades sobre
 * onde os projetos moram, que é o defeito que este painel já pagou várias
 * vezes. O que existe aqui é o acrescentar e o tirar, que a tela não precisa
 * (ela manda a lista inteira de uma vez) e que o terminal, a bandeja e o
 * instalador precisam.
 *
 * ⚠️ **A semeadura não é detalhe.** Enquanto nada foi escolhido, a leitura cai
 * na descoberta pelos jobs. Se a primeira pasta acrescentada virasse a lista
 * inteira, escolher "projetos de música" APAGARIA a pasta de trabalho que
 * funcionava, e o sintoma seria o painel esvaziando sem erro nenhum. Por isso a
 * primeira escolha começa com o que já estava valendo.
 */
export function adicionarBase(caminho) {
  const bruto = String(caminho || '').trim()
  if (!bruto) return { ok: false, erro: 'sem caminho' }
  const p = path.resolve(bruto)
  if (!fs.existsSync(p)) return { ok: false, erro: `essa pasta não existe: ${p}` }
  try {
    if (!fs.statSync(p).isDirectory()) return { ok: false, erro: `isso não é uma pasta: ${p}` }
  } catch { return { ok: false, erro: `não consegui ler: ${p}` } }

  const escolhidas = basesEscolhidas()
  const partida = escolhidas.length ? escolhidas : projectsBases()
  if (partida.some((x) => path.resolve(x) === p)) {
    return { ok: true, jaTinha: true, bases: setPastasDeProjeto(partida) }
  }
  return { ok: true, jaTinha: false, bases: setPastasDeProjeto([...partida, p]) }
}

/** Tira uma pasta da lista. Lista vazia volta para a descoberta automática, e
 *  quem chama precisa dizer isso: sumir sem aviso pareceria dado perdido. */
export function removerBase(caminho) {
  const p = path.resolve(String(caminho || '').trim())
  const escolhidas = basesEscolhidas()
  const partida = escolhidas.length ? escolhidas : projectsBases()
  const ficam = partida.filter((x) => path.resolve(x) !== p)
  if (ficam.length === partida.length) return { ok: false, erro: `essa pasta não estava na lista: ${p}` }
  return { ok: true, bases: setPastasDeProjeto(ficam), voltouPraAutomatico: ficam.length === 0 }
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
  if (melhor) return melhor[0]

  /* Sem job nenhum não há voto — era o caso da VPS, onde só existe sessão
     interativa, e a lista de projetos vinha vazia (defeito anotado em 16/08).
     Segundo caminho: as mesmas pastas convencionais de PROJECT_DIRS, direto
     na home. Não é caminho fixo de máquina: é convenção, e `CC_PROJECTS_BASE`
     continua vencendo tudo. */
  for (const nome of PROJECT_DIRS) {
    const dir = path.join(os.homedir(), nome)
    try { if (fs.statSync(dir).isDirectory()) return dir } catch { /* próxima */ }
  }
  return null
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

**Entregar sem \`frente\` também é erro**, se o projeto tem \`docs/ROADMAP.md\`
com seções \`###\`. Sem ela o mapa lateral não sabe onde encaixar o trabalho —
o mesmo problema que os \`todos\` tiveram antes de virar checklist de entrega.

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
export function findProjects(base) {
  /* Três casos, e a diferença entre "sem argumento" e "nulo" importa:
     - chamada SEM argumento → varre TODAS as pastas configuradas (CC-352);
     - `base` explícito (uma pasta) → varre só ela, como antes;
     - `base` nulo de propósito → não varre nada (é o "não sei a base" do CC-53). */
  const bases = base === undefined ? projectsBases() : (base ? [base] : [])
  if (!bases.length) return [] // sem base conhecida não há o que varrer
  const found = new Set()
  for (const b of bases) {
    for (const dir of dirsIn(b)) {
      if (isProject(dir)) found.add(dir)
      else for (const sub of dirsIn(dir)) if (isProject(sub)) found.add(sub)
    }
  }
  return semRepetir([...found]).sort()
}

/**
 * Dois nomes para a MESMA pasta contam uma vez só.
 *
 * ## O defeito, medido em 29/08 no quadro dele
 *
 * O quadro listava `proj_controlcenter` com 8 tarefas e `VPS_cockpit` com 42,
 * como se fossem dois projetos. **São a mesma pasta**: o primeiro é um atalho
 * para o segundo, criado quando o projeto foi renomeado, e mantido porque o
 * serviço do painel guarda o caminho antigo. Todo número saía dobrado, e
 * qualquer conta por projeto ficava errada sem nada acusar.
 *
 * ⚠️ **A conta é pelo caminho REAL, e isso não é detalhe.** Comparar nomes
 * "parecidos" juntaria `fibraessencia` com `VPS_fibraessencia`, que nesta
 * mesma máquina são **duas pastas de verdade**, com dois roadmaps e dois
 * estados de git. Medido antes de escolher a regra: um par é atalho, o outro
 * não, e só o disco sabe a diferença.
 *
 * Quem fica é a pasta de verdade, nunca o atalho: é o nome que existe no git,
 * no roadmap e no que ele lê.
 */
/**
 * Os apelidos de pasta desta máquina: nome do atalho, nome de verdade.
 *
 * `semRepetir` tira o atalho da LISTA de projetos, e isso conserta tudo que é
 * derivado do disco. Só que existe dado GRAVADO com o nome velho: as pendências
 * dele, por exemplo, guardam o nome do projeto de quando foram escritas, e nada
 * mais. Doze delas ainda dizem `proj_controlcenter`.
 *
 * Dado gravado não se conserta, se interpreta. Este mapa é o dicionário da
 * interpretação, e ele sai do DISCO, não de uma lista escrita à mão que
 * envelhece na primeira renomeação.
 */
export function apelidosDePasta(base) {
  const bases = base === undefined ? projectsBases() : (base ? [base] : [])
  const apelidos = new Map()
  for (const b of bases) {
    let nomes = []
    try { nomes = fs.readdirSync(b) } catch { continue }
    for (const nome of nomes) {
      const dir = path.join(b, nome)
      try {
        if (!fs.lstatSync(dir).isSymbolicLink()) continue
        const real = fs.realpathSync(dir)
        const nomeReal = path.basename(real)
        if (nomeReal && nomeReal !== nome) apelidos.set(nome, nomeReal)
      } catch { /* atalho quebrado não vira apelido */ }
    }
  }
  return apelidos
}

export function semRepetir(dirs = []) {
  const porReal = new Map()
  for (const dir of dirs) {
    let real = dir
    try { real = fs.realpathSync(dir) } catch { /* some no meio do caminho: fica o que veio */ }
    const atual = porReal.get(real)
    if (!atual) { porReal.set(real, dir); continue }
    /* Empate desfeito pelo disco: quem for o caminho real vence o atalho. */
    if (dir === real) porReal.set(real, dir)
  }
  return [...porReal.values()]
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
