// routia-inicio — mostra o quadro do Método Routia ao abrir sessão.
//
// Por que existe: o Passo 0 do protocolo pede pra sessão nova ler
// docs/ROTAS-ATIVAS.md antes de tocar em qualquer arquivo, mas isso é
// convenção em texto — nada força. Esse hook fecha o gap técnico: injeta o
// resumo do quadro direto no contexto, sem depender do agente lembrar.
//
// Princípios (os mesmos do rota-guard):
//   - FALHA ABERTA e silenciosa. Sem quadro, sem erro — nunca atrapalha.
//   - Não bloqueia nada: SessionStart não bloqueia mesmo, só injeta contexto
//     via hookSpecificOutput.additionalContext.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function sair() { process.exit(0) }

function lerEntrada() {
  try { return JSON.parse(readFileSync(0, 'utf8')) } catch { return null }
}

/** Sobe a árvore procurando o quadro, a partir do cwd da sessão. */
function acharQuadro(partida) {
  let dir = partida
  for (let i = 0; i < 30; i++) {
    const alvo = join(dir, 'docs', 'ROTAS-ATIVAS.md')
    try { readFileSync(alvo, 'utf8'); return alvo } catch { /* sobe */ }
    const pai = dirname(dir)
    if (pai === dir) break
    dir = pai
  }
  return null
}

function linhasDeRota(texto) {
  return texto
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.includes('`'))
}

const entrada = lerEntrada()
if (!entrada) sair()

const cwd = entrada.cwd || process.cwd()
const quadro = acharQuadro(cwd)
if (!quadro) sair()

let texto
try { texto = readFileSync(quadro, 'utf8') } catch { sair() }

const linhas = linhasDeRota(texto)
const ocupadas = linhas.filter((l) => l.includes('🔴'))
const livres = linhas.filter((l) => l.includes('🟢'))

if (!linhas.length) sair() // quadro existe mas ainda sem rota nenhuma cadastrada

const resumo = [
  `Método Routia ativo neste projeto (${quadro}). Antes de editar código,`,
  `confira se sua rota está marcada — Passo 0.`,
  '',
  ocupadas.length ? `Ocupadas agora:\n${ocupadas.join('\n')}` : 'Nenhuma rota ocupada no momento.',
  livres.length ? `\nLivres:\n${livres.join('\n')}` : '',
].filter(Boolean).join('\n')

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: resumo },
}))
process.exit(0)
