// Método Routia — instalar o quadro (`docs/ROTAS-ATIVAS.md`) num projeto.
//
// O hook que de fato bloqueia edição (`~/.claude/hooks/rota-guard.mjs`) já
// roda globalmente pra máquina inteira — não precisa de nada daqui pra
// existir. Este módulo só cuida da parte por projeto: criar o quadro, com o
// escopo de pasta certo pra estrutura de cada um, sem sobrescrever um que já
// existe (pode ter dado de sessão real dentro).
//
// Rollout é manual, projeto a projeto, de propósito (decisão do Felipe,
// 12/08): cada estrutura passa pelos olhos dele antes do arquivo entrar no
// repositório — inclusive porque alguns são de cliente.

import fs from 'node:fs'
import path from 'node:path'

const IGNORAR = new Set(['docs', 'assets', '.git', '.claude', '.github', 'node_modules', 'dist', 'build', '.next', '.vercel', '.vscode'])

/**
 * Chuta um escopo de pasta razoável pra estrutura real do projeto: `apps`/
 * `tools` se existirem (convenção do Felipe pra projeto com apps separadas),
 * senão `src` (projeto de app único, como este aqui), senão o hardcode
 * antigo do guard — que age só nesses dois nomes, então em pasta diferente
 * simplesmente não bloqueia nada até alguém editar `pastas-controladas` à
 * mão. Nunca lança: chute errado não impede criar o quadro, só fica editável.
 */
export function detectarPastas(root) {
  let nomes = []
  try {
    nomes = fs.readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !IGNORAR.has(e.name) && !e.name.startsWith('.'))
      .map((e) => e.name)
  } catch { /* projeto ainda sem pasta lida, fica no fallback */ }

  const appsTools = nomes.filter((n) => n === 'apps' || n === 'tools')
  if (appsTools.length) return appsTools
  if (nomes.includes('src')) return ['src']
  return ['apps', 'tools']
}

const template = (pastas, hoje) => `---
tags: [processo, multi-agente]
tipo: quadro
atualizado: ${hoje}
pastas-controladas: [${pastas.join(', ')}]
---

# Rotas ativas — quadro vivo do Método Routia

Protocolo completo: \`docs/guias/metodo-routia.md\` deste projeto se existir,
senão o modelo em \`- projeto_template/docs/guias/metodo-routia.md\`. Este
arquivo muda toda hora — é o estado agora, não histórico. Sessão nova o lê no
Passo 0, antes de tocar em qualquer arquivo.

**🟢 livre · 🔴 ocupada · 🎫 ticket pendente**

> Este arquivo só existe em projetos com mais de uma sessão trabalhando em
> paralelo. Se este é um projeto de sessão única, apague este arquivo — ele
> fica "ocupado" esquecido e confunde mais do que ajuda.

## Sprint atual

<!-- Preencha as rotas de acordo com a estrutura real do projeto. Exemplo: -->

| Rota | Status | Quem / o quê | Desde |
|---|---|---|---|
| \`[exemplo] feature/checkout\` | 🟢 livre | — | — |

## Tickets pendentes

*(nenhum agora)*

<!--
Como preencher uma linha ocupada:
| \`feature/checkout\` | 🔴 ocupada | id da sessão — "ajustando validação de cupom" | ${hoje} |

Como abrir um ticket:
### 🎫 [rota] — [quem abriu]
Preciso mexer em \`arquivo.ts\` porque [motivo]. Aguardando o dono da rota.
-->
`

/**
 * Cria `docs/ROTAS-ATIVAS.md`. Nunca sobrescreve: um quadro existente pode
 * ter rota real marcada, e apagar isso por engano é pior que não automatizar
 * nada. `pastas` explícito vence o chute de `detectarPastas`.
 */
export function instalarRotas(root, { pastas } = {}) {
  const arquivo = path.join(root, 'docs', 'ROTAS-ATIVAS.md')
  if (fs.existsSync(arquivo)) return { arquivo, acao: 'ja-existe' }

  const usarPastas = pastas?.length ? pastas : detectarPastas(root)
  const hoje = new Date().toISOString().slice(0, 10)
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(arquivo, template(usarPastas, hoje))
  return { arquivo, acao: 'criado', pastas: usarPastas }
}
