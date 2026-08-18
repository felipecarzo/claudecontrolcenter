/**
 * F15 do framework — achado sobre OUTRO projeto vira ticket NELE, no git dele.
 *
 * Regra do Felipe em 15/08, olhando o caso acontecer: *"isso é uma regra pro
 * framework, o registro em outros projetos, ficaria no git? assim eles se
 * comunicam"*. O caso real: trabalhando no cockpit, portei o `anonimizar.ts`
 * do Pierre e descobri um defeito NO Pierre. Registrar só aqui seria enterrar
 * o achado no repositório errado — quem abrir o Pierre amanhã não veria nada.
 *
 * Três limites, e vieram do caso real (docs/planos/FRAMEWORK-V1.md, F15):
 *
 * 1. Só `docs/`, nunca código — este módulo não tem capacidade de tocar em
 *    outra pasta, por desenho, não por checagem.
 * 2. Commit próprio, com a origem escrita: quem achou, de onde, por quê.
 * 3. A árvore de lá tem que estar limpa — misturar com trabalho não
 *    commitado de outra sessão é o problema que o git-add-guard existe para
 *    evitar, e aqui vale igual.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { findProjects } from './install.mjs'

const CABECALHO = `# Tickets externos

Achados sobre este projeto, registrados por outra sessão a partir de outro
repositório. Formato do protocolo \`cc framework ticket\` (F15 do
proj_controlcenter). Só chega aqui o que é fato observado — nada aqui foi
corrigido a partir de fora: quem lê decide o que fazer.
`

/** O projeto pelo nome da pasta, entre os que este cockpit já conhece. */
export function acharProjeto(nome, base) {
  if (!nome) return null
  return findProjects(base).find((dir) => path.basename(dir) === nome) || null
}

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
}

/** Árvore suja bloqueia: ticket não pode se misturar com trabalho alheio não
 *  commitado. `null` (sem `.git`, ou `git` falhou) conta como suja — falha
 *  fechada aqui, ao contrário da maioria dos hooks deste projeto, porque o
 *  efeito é escrever em disco alheio e commitar. */
export function arvoreLimpa(dir) {
  try {
    return git(dir, ['status', '--porcelain']).trim() === ''
  } catch {
    return false
  }
}

function formatarEntrada(texto, { origem, data }) {
  return `\n---\n\n## ${data} — de \`${origem}\`\n\n${texto.trim()}\n`
}

/**
 * Escreve o ticket em `docs/TICKETS-EXTERNOS.md` do projeto alvo. Não commita
 * — quem chama decide, com `commitar()` logo abaixo, para o teste poder
 * provar a escrita sem precisar de um repositório git de verdade toda vez.
 */
export function escreverTicket(nomeProjeto, texto, { base, origem = 'proj_controlcenter', data, quando } = {}) {
  if (!texto || !texto.trim()) return { ok: false, erro: 'ticket sem texto' }
  const dir = acharProjeto(nomeProjeto, base)
  if (!dir) return { ok: false, erro: `projeto "${nomeProjeto}" não encontrado entre os conhecidos` }
  if (!arvoreLimpa(dir)) {
    return { ok: false, erro: `árvore de ${nomeProjeto} não está limpa: o ticket espera até ela ficar` }
  }

  const arquivo = path.join(dir, 'docs', 'TICKETS-EXTERNOS.md')
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  const existente = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : CABECALHO
  const carimbo = quando || data || new Date().toISOString().slice(0, 10)
  fs.writeFileSync(arquivo, existente + formatarEntrada(texto, { origem, data: carimbo }))

  return { ok: true, dir, arquivo, relativo: path.relative(dir, arquivo) }
}

/** Commit isolado, só do arquivo de ticket — nunca `git add -A` num
 *  repositório que não é o nosso. */
export function commitarTicket(dir, relativo, { origem = 'proj_controlcenter', texto } = {}) {
  git(dir, ['add', relativo])
  const resumo = texto.trim().split('\n')[0].slice(0, 72)
  git(dir, ['commit', '-m', `docs(ticket): achado de ${origem} — ${resumo}`])
  return { ok: true }
}

/** A operação inteira: escreve e commita, ou para no primeiro limite que
 *  não fecha. Ponto de entrada do `cc framework ticket`. */
export function registrarTicket(nomeProjeto, texto, opts = {}) {
  const r = escreverTicket(nomeProjeto, texto, opts)
  if (!r.ok) return r
  try {
    commitarTicket(r.dir, r.relativo, { origem: opts.origem, texto })
  } catch (e) {
    return { ok: false, erro: `escrito, mas o commit falhou: ${e.message}`, ...r }
  }
  return { ...r, commitado: true }
}
