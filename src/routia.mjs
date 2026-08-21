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
 * Qual sessão segura o item de backlog `CC-nnn`, segundo o quadro de rotas.
 *
 * Devolve o id de 8 caracteres da sessão dona, ou `null` quando ninguém o
 * reivindicou. Só olha rota 🔴 ocupada: linha livre é histórico, e casar com
 * ela faria um item entregue semanas atrás parecer que tem dono.
 *
 * ## Por que isto existe, achado em 21/08
 *
 * Ele abriu uma segunda sessão só para tela, e a rota `front` passou para ela
 * com o CC-156 e o CC-235 dentro. Do lado de cá, a trava de execução contínua
 * seguiu cobrando os dois a cada parada: os únicos itens abertos do backlog
 * eram justamente os que eu não posso tocar sem pisar no dono da rota.
 *
 * **Guarda que cobra o impossível ensina a ser ignorado**, e aí ele não segura
 * mais o caso real. O mesmo motivo que fez o `⏸` nascer no `fluxo-guard`.
 *
 * ## Por que o quadro, e não uma marca no título do item
 *
 * Marcar posse no `ROADMAP.md` seria uma segunda verdade sobre quem segura o
 * quê, e ela envelhece sozinha: a rota muda de dono e o título fica mentindo.
 * O quadro já é a fonte, e é lido no começo de toda sessão.
 */
export function donoDoItem(codigo, raizProjeto) {
  const cod = String(codigo || '').match(/CC-\d+/i)?.[0]
  if (!cod) return null
  let quadro = ''
  try {
    quadro = fs.readFileSync(path.join(raizProjeto, 'docs', 'ROTAS-ATIVAS.md'), 'utf8')
  } catch { return null }
  for (const linha of quadro.split(/\r?\n/)) {
    if (!linha.includes('🔴')) continue
    /* `\b` no fim para `CC-15` não casar dentro de `CC-156`: o quadro cita
       faixas e códigos vizinhos o tempo todo. */
    if (!new RegExp(`${cod}\\b`, 'i').test(linha)) continue
    const dono = linha.match(/\b([0-9a-f]{8})\b/i)?.[1]
    if (dono) return dono.toLowerCase()
  }
  return null
}

/**
 * O item é de OUTRA sessão? Só então ele não é trabalho meu.
 *
 * Sem saber quem eu sou, devolve `false` de propósito: um guarda que emudece
 * por falta de dado vira um guarda que não existe. E rota MINHA continua
 * contando, senão o que eu mesmo reservei deixaria de ser cobrado.
 */
export function deOutraSessao(codigo, raizProjeto, minhaSessao) {
  const meu = String(minhaSessao || '').slice(0, 8).toLowerCase()
  if (!meu) return false
  const dono = donoDoItem(codigo, raizProjeto)
  return Boolean(dono && dono !== meu)
}

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
/**
 * CC-115 — o retrato das rotas de um projeto, para a tela de módulos.
 * Ligado = o arquivo existe. Não há "desligar" por clique de propósito:
 * desligar seria apagar `docs/ROTAS-ATIVAS.md`, que carrega o histórico de
 * quem fechou o quê — destruir dado do projeto não pode ser um clique.
 */
export function situacaoRotas(root) {
  const arquivo = path.join(root, 'docs', 'ROTAS-ATIVAS.md')
  let texto = null
  try { texto = fs.readFileSync(arquivo, 'utf8') } catch { return { ligado: false } }
  let total = 0
  let ocupadas = 0
  // uma linha de tabela por rota; 🔴 é ocupada, 🟢 é livre — o mesmo par que
  // o protocolo manda usar, e o split tolera CRLF (armadilha já paga)
  for (const linha of texto.split(/\r?\n/)) {
    if (!/^\|\s*[^|]*`[^`]+`/.test(linha)) continue
    total++
    if (linha.includes('🔴')) ocupadas++
  }
  return { ligado: true, total, ocupadas }
}

export function instalarRotas(root, { pastas } = {}) {
  const arquivo = path.join(root, 'docs', 'ROTAS-ATIVAS.md')
  if (fs.existsSync(arquivo)) return { arquivo, acao: 'ja-existe' }

  const usarPastas = pastas?.length ? pastas : detectarPastas(root)
  const hoje = new Date().toISOString().slice(0, 10)
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(arquivo, template(usarPastas, hoje))
  return { arquivo, acao: 'criado', pastas: usarPastas }
}
