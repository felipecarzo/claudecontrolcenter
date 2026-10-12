// routia-inicio: mostra o quadro do Método Routia ao abrir sessão.
//
// Por que existe: o Passo 0 do protocolo pede pra sessão nova ler
// docs/ROTAS-ATIVAS.md antes de tocar em qualquer arquivo, mas isso é
// convenção em texto, e nada força. Esse hook fecha o gap técnico: injeta o
// resumo do quadro direto no contexto, sem depender do agente lembrar.
//
// Princípios (os mesmos do rota-guard):
//   - FALHA ABERTA e silenciosa. Sem quadro, sem erro, nunca atrapalha.
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

/* CC-1050, medido em 12/10 pela aba Hooks: este aviso punha ~15 mil tokens em CADA conversa (956 mil em 60 dias, o
   maior gasto entre os hooks). A linha de uma rota carrega o histórico inteiro dela (uma só tinha 12.900 caracteres, o
   quadro 101 mil), e a saída batia no teto de 65.536. Agora cada rota ocupada vira uma linha curta: nome, quem segura,
   a primeira frase do que faz e os arquivos (📁). O histórico continua no quadro, para quem precisar abrir. */
const CORTE = 160
function rotaCurta(l) {
  const cel = l.split('|').map((c) => c.trim()).filter(Boolean)
  const nome = (cel[0] || '').replace(/`/g, '')
  const desc = cel.slice(2, -1).join(' | ') || cel[2] || ''
  const dono = (desc.match(/^\s*([0-9a-f]{8})\b/) || [])[1] || ''
  const semDono = desc.replace(/^\s*[0-9a-f]{8}\s*[^\w\s]?\s*/u, '') // o separador depois do id (traço, dois pontos)
  const frase = semDono.replace(/\*\*/g, '').split(/(?<=[.!?])\s|📁/)[0].trim()
  // só o arquivo: sem o "#seção" e sem o ponto final grudado; "📁 abaixo" e afins não são caminho
  const arqs = [...new Set((desc.match(/📁\s*[^\s📁]+/g) || []).map((a) => a.replace(/📁\s*/, '').replace(/#.*$/, '').replace(/[.,;:)]+$/, '')).filter((a) => /[./]/.test(a)))]
  return `- \`${nome}\`${dono ? ` (sessão ${dono})` : ''}: ${frase.length > CORTE ? frase.slice(0, CORTE - 1) + '…' : frase}`
    + (arqs.length ? `\n  arquivos: ${arqs.slice(0, 8).join(', ')}${arqs.length > 8 ? ` e mais ${arqs.length - 8}` : ''}` : '')
}
// livres: só o nome, uma vez cada; riscadas (~~) e as marcadas "(histórico)", "(antes…)" são passado e ficam no quadro
const nomeDe = (l) => ((l.split('|').map((c) => c.trim()).filter(Boolean)[0]) || '').replace(/`/g, '')
const livresNomes = [...new Set(livres.map(nomeDe).filter((n) => n && !n.includes('~~')).map((n) => n.replace(/\s*\(.*\)\s*$/, '')))]

const resumo = [
  `Método Routia ativo neste projeto (${quadro}). Antes de editar código,`,
  'confira se sua rota está marcada (Passo 0). O histórico de cada rota está no quadro.',
  '',
  ocupadas.length ? `Ocupadas agora:\n${ocupadas.map(rotaCurta).join('\n')}` : 'Nenhuma rota ocupada no momento.',
  livresNomes.length ? `\nLivres: ${livresNomes.join(', ')}` : '',
].filter(Boolean).join('\n')

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: resumo },
}))
process.exit(0)
