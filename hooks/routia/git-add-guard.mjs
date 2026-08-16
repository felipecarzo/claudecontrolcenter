// git-add-guard — recusa `git add` que varre tudo, em projeto com sessões paralelas.
//
// Por que existe: em 2026-08-06, TRÊS vezes seguidas, uma sessão commitou o
// código que outra sessão tinha acabado de escrever. Nada se perdeu, mas a
// história do repositório passou a mentir — o zoom de dois dedos foi parar
// dentro de um commit chamado "fix(editor): espaço digitado virava &nbsp;".
//
// O rota-guard (irmão deste) cobra a rota na ENTRADA, antes de escrever. Não
// resolve isto: `git add .` acontece depois, e varre o trabalho alheio junto.
//
// Bloqueia: git add . / -A / --all / -u / :/ , e git commit -a (que é o mesmo
// estrago com outro nome).
// Permite: git add com caminhos explícitos, que é o conserto.
//
// Princípios, iguais aos do rota-guard:
//   - FALHA ABERTA. Erro do hook libera o comando.
//   - Só age em projeto que tem docs/ROTAS-ATIVAS.md — ou seja, onde o Felipe
//     roda sessões em paralelo. Projeto solo não é incomodado.
//   - Ignora o conteúdo de aspas e heredocs antes de procurar. Sem isso, uma
//     mensagem de commit que MENCIONE "git add ." bloquearia o próprio commit.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function liberar() { process.exit(0) }
function bloquear(msg) { process.stderr.write(msg); process.exit(2) }

function lerEntrada() {
  try { return JSON.parse(readFileSync(0, 'utf8')) } catch { return null }
}

function temQuadro(partida) {
  let dir = partida
  for (let i = 0; i < 30; i++) {
    try { readFileSync(join(dir, 'docs', 'ROTAS-ATIVAS.md'), 'utf8'); return true } catch { /* sobe */ }
    const pai = dirname(dir)
    if (pai === dir) return false
    dir = pai
  }
  return false
}

/** Tira heredoc e strings: só sobra o comando de verdade. Uma mensagem de
 *  commit que cite "git add ." não pode bloquear o commit que a carrega. */
function semTextoLivre(cmd) {
  return cmd
    .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?^\s*\1\s*$/gm, ' ')
    .replace(/'[^']*'/g, ' ')
    .replace(/"[^"]*"/g, ' ')
}

const entrada = lerEntrada()
if (!entrada) liberar()

const comando = entrada.tool_input?.command
if (!comando || typeof comando !== 'string') liberar()
if (!/\bgit\s+(add|commit)\b/.test(comando)) liberar()   // atalho barato

const cwd = entrada.cwd || process.cwd()
if (!temQuadro(cwd)) liberar()      // projeto sem Routia: não é da minha conta

const limpo = semTextoLivre(comando)
const motivos = []

// `git add` até o próximo separador de comando.
for (const m of limpo.matchAll(/\bgit\s+add\b([^&|;\n]*)/g)) {
  const args = m[1].trim()
  const tokens = args.split(/\s+/).filter(Boolean)
  const varredura = tokens.filter(t => t === '.' || t === '-A' || t === '--all' || t === '-u' || t === ':/' || t === '*')
  if (varredura.length) motivos.push(`\`git add ${varredura.join(' ')}\` varre tudo que está modificado`)
}

// `git commit -a` faz o mesmo por outro caminho.
for (const m of limpo.matchAll(/\bgit\s+commit\b([^&|;\n]*)/g)) {
  const tokens = m[1].trim().split(/\s+/).filter(Boolean)
  const temA = tokens.some(t => t === '--all' || (/^-[a-z]+$/i.test(t) && t.includes('a')))
  if (temA) motivos.push('`git commit -a` adiciona todo arquivo modificado, inclusive o de outra sessão')
}

if (!motivos.length) liberar()

bloquear(
`GIT ADD AMPLO — bloqueado neste projeto

${motivos.map(m => '  - ' + m).join('\n')}

Este repositório roda sessões em paralelo (tem docs/ROTAS-ATIVAS.md). Em
2026-08-06 isso aconteceu três vezes: uma sessão commitou o código que a outra
tinha acabado de escrever. Nada se perdeu, mas a história do repositório passou
a mentir — dá pra procurar uma mudança e achá-la dentro de um commit sobre
outro assunto.

O que fazer: liste os caminhos que ESTA sessão tocou.

    git add caminho/do/arquivo.ts outro/arquivo.md

Para ver o que está pendente (e reparar no que não é seu):

    git status --short

Se algum arquivo modificado não for seu, deixe fora do commit — ele é de quem
está com a rota.
`)
