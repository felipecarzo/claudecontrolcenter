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
 * Quem é o DONO de uma linha do quadro: o id de 8 caracteres logo depois de
 * `🔴 ocupada |`, em minúsculas, ou `null` se a linha não tiver dono.
 *
 * ## Por que isto existe, medido em 27/08 (CC-362)
 *
 * Três módulos perguntavam "esta linha é minha?" com `linha.includes(marca)`,
 * e a resposta estava errada pelo mesmo motivo nos três: **a linha cita o
 * histórico dela inteiro**. A linha da rota de tela conta que foi tomada de
 * uma sessão e antes de outra, então os ids dessas duas estão escritos ali.
 * Qualquer sessão CITADA passava a ser tratada como dona.
 *
 * O estrago medido nos dois lugares, e são de tamanhos diferentes:
 *
 * - no framework, a sessão `721fa1f4` herdou o modo da rota de tela sem nunca
 *   ter tido essa rota. Foi o que fez a trava usar um modo que a tela não
 *   mostrava, que é o CC-362;
 * - na caixa de ponto do git, a sessão passaria a commitar os ARQUIVOS
 *   declarados por uma rota alheia. É exatamente o acidente que o Método
 *   Routia existe para impedir, e não aconteceu por sorte.
 *
 * A regra do dono é posicional, não textual: o primeiro id depois do marcador
 * é quem segura a linha, e é assim que o quadro é escrito desde que existe.
 * Menção posterior é história, e história não dá posse.
 */
export function donoDaLinha(linha) {
  const texto = String(linha || '')
  const marcador = texto.indexOf('🔴')
  if (marcador < 0) return null
  /* A partir do marcador, senão um id dentro do NOME da rota
     (`| \`corrige-a1b2c3d4\` | 🔴 …`) passaria na frente do dono de verdade. */
  return texto.slice(marcador).match(/\b([0-9a-f]{8})\b/i)?.[1]?.toLowerCase() ?? null
}

/** Esta linha 🔴 pertence a esta sessão? A pergunta que os três módulos faziam
 *  com `includes`, agora com a regra do dono. */
export function linhaEhDaSessao(linha, sessionId) {
  const marca = String(sessionId || '').slice(0, 8).replace(/[^0-9a-f]/gi, '').toLowerCase()
  if (marca.length !== 8) return false
  return donoDaLinha(linha) === marca
}

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
  const numero = Number(cod.slice(3))
  for (const linha of quadro.split(/\r?\n/)) {
    if (!linha.includes('🔴')) continue
    /* `\b` no fim para `CC-15` não casar dentro de `CC-156`: o quadro cita
       faixas e códigos vizinhos o tempo todo. */
    let meu = new RegExp(`${cod}\\b`, 'i').test(linha)

    /* CC-301: a FAIXA também vale, e sem isto o filtro erra em silêncio no caso
       mais comum de todos.
       Medido em 22/08: a rota do gate citava nove números, e os itens CC-277 a
       CC-280 nasceram DEPOIS de ela ser escrita. O filtro não achou dono, tratou
       tudo como trabalho meu, e a trava de fluxo me mandou executar item de
       outra sessão. O quadro já escreve faixas ("CC-218 a CC-231"), e quem
       reserva um bloco de trabalho reserva o que vier dentro dele. */
    if (!meu) {
      for (const f of linha.matchAll(/CC-(\d+)\s+a\s+(?:CC-)?(\d+)/gi)) {
        const de = Number(f[1])
        const ate = Number(f[2])
        if (numero >= Math.min(de, ate) && numero <= Math.max(de, ate)) { meu = true; break }
      }
    }
    if (!meu) continue
    const dono = donoDaLinha(linha)
    if (dono) return dono
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
  //
  // ⚠️ CC-376, 27/08: as linhas dentro de `<!-- -->` ficam de fora, e isto é a
  // terceira aparição do mesmo defeito. O quadro guarda EXEMPLOS de como
  // preencher uma linha ocupada, e eles são linhas de tabela de verdade: a
  // `feature/checkout`, que nunca existiu, era contada aqui como rota ocupada,
  // e em 22/08 um exemplo solto chegou a travar `src/ui.html` para valer. A
  // conta tem que ser por ESTADO, de cima para baixo, porque o comentário abre
  // numa linha e fecha noutra: nenhuma regex numa linha isolada sabe se ela
  // está dentro dele. `foraDeComentario` mora em `rotas.mjs`, que é quem lê o
  // quadro inteiro; aqui a mesma varredura é feita em linha, para este módulo
  // não passar a depender daquele.
  let emComentario = false
  for (const linha of texto.split(/\r?\n/)) {
    const abre = linha.lastIndexOf('<!--')
    const fecha = linha.lastIndexOf('-->')
    const jaEstava = emComentario
    if (abre > fecha) emComentario = true
    else if (fecha > abre) emComentario = false
    if (jaEstava && emComentario) continue
    if (!jaEstava && emComentario) continue
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
