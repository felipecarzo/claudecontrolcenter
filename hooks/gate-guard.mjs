#!/usr/bin/env node
/**
 * O gate que garante que o gate rodou.
 *
 * ## A pergunta dele, em 16/08
 *
 * > "'conferir o resultado, não o assert' — qual hook nos está garantindo a
 * > revisão e teste?"
 *
 * A resposta honesta era **nenhum**. Havia onze hooks, e nenhum verificava se o
 * `npm test` tinha rodado depois de mexer no código. O gate existia, mas quem
 * decidia rodá-lo era eu, no mesmo turno em que escrevia o código — que é
 * exatamente o arranjo que o framework inteiro existe para não ter.
 *
 * ## O que ele faz
 *
 * No `Stop`: se o turno **editou código** e o gate **não rodou depois da última
 * edição**, devolve uma vez. Não é sobre o teste passar (isso o próprio comando
 * já diz), é sobre ele ter sido executado.
 *
 * ## Por que "depois da última edição", e não "em algum momento"
 *
 * Rodar o teste e depois mexer no código dá verde de um estado que não existe
 * mais. Aconteceu neste repositório: uma regressão introduzida em `4f78264`
 * ficou escondida atrás de um gate que ninguém rodou de novo. A ordem é o
 * conteúdo da regra.
 *
 * ## O que NÃO conta como editar código
 *
 * `docs/**`, `.md` e o próprio ROADMAP. Escrever documentação não pode obrigar a
 * rodar suíte — hook chato vira hook desligado, que é pior que não ter hook.
 *
 * Falha ABERTA, uma volta só.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(resolve(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('gate-guard')) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let cauda = ''
try { cauda = readFileSync(arquivo, 'utf8').slice(-400_000) } catch { sair() }

/* Só este turno: tudo depois da última mensagem de gente. */
const corte = cauda.lastIndexOf('"type":"user"')
const linhas = (corte >= 0 ? cauda.slice(corte) : cauda).split('\n')

/** Extensões em que uma mudança pode quebrar o comportamento. */
const CODIGO = /\.(mjs|js|cjs|ts|tsx|jsx|html|css|json|ps1|sh)$/i
/** Onde documentação mora: mexer aqui não obriga a rodar suíte. */
const SO_TEXTO = /(^|\/)(docs|assets)\//i
/* Rascunho fora do projeto não é código do projeto, e cobrar o gate por ele é
   falso positivo puro. Achado em 18/08 ao escrever o primeiro teste desta
   trava: um `.mjs` no scratchpad da sessão (que fica em /tmp) disparava a
   cobrança, e eu escrevo vários por sessão, todo dia. O caminho do Bash já
   isentava /tmp desde o começo; o Edit e o Write não, e a assimetria não tinha
   razão nenhuma. Falso positivo é o caminho mais curto para trava desligada. */
const FORA_DO_PROJETO = /^(\/tmp\/|\/private\/tmp\/|\/var\/folders\/|[A-Za-z]:[\\/](Users[\\/][^\\/]+[\\/])?(AppData[\\/]Local[\\/])?Temp[\\/])/i

let ultimaEdicao = -1
let ultimoGate = -1
let ondeEditou = null

linhas.forEach((linha, i) => {
  if (!linha.includes('"tool_use"')) return
  let ev = null
  try { ev = JSON.parse(linha) } catch { return }
  const conteudo = ev?.message?.content
  if (!Array.isArray(conteudo)) return

  for (const bloco of conteudo) {
    if (bloco?.type !== 'tool_use') continue

    if (bloco.name === 'Edit' || bloco.name === 'Write' || bloco.name === 'NotebookEdit') {
      const alvo = String(bloco.input?.file_path || '')
      if (CODIGO.test(alvo) && !SO_TEXTO.test(alvo) && !FORA_DO_PROJETO.test(alvo)) {
        ultimaEdicao = i
        ondeEditou = alvo
      }
    }

    if (bloco.name === 'Bash') {
      const cmd = String(bloco.input?.command || '')
      // o gate deste projeto é `npm test`, e só ele; `node test-X.mjs` avulso
      // não substitui, porque a suíte é que conhece a lista inteira
      if (/\bnpm\s+(run\s+)?test\b|\bnode\s+test\.mjs\b/.test(cmd)) ultimoGate = i
      // script que escreve em arquivo de código também é edição
      if (/(^|[^\w])(sed\s+-i|perl\s+-i|tee\s)|open\([^)]*,\s*['"]w/.test(cmd)) {
        if (!/\/tmp\//.test(cmd)) { ultimaEdicao = i; ondeEditou = ondeEditou || 'por script no Bash' }
      }
    }
  }
})

if (ultimaEdicao < 0) sair()          // não mexeu em código
if (ultimoGate > ultimaEdicao) sair() // rodou o gate depois da última mudança

const nunca = ultimoGate < 0

console.error(
  `${nunca ? 'CÓDIGO EDITADO E O GATE NÃO RODOU' : 'O GATE RODOU ANTES DA ÚLTIMA EDIÇÃO'} — rode antes de encerrar.\n\n`
  + `Última mudança de código neste turno: ${ondeEditou}\n`
  + (nunca ? '' : 'O `npm test` passou, e DEPOIS o código mudou. Verde de um estado que\n'
    + 'não existe mais: foi assim que a regressão do `4f78264` ficou escondida.\n')
  + '\n    npm test\n\n'
  + '  · `npm` = o gerenciador de pacotes do Node, que roda os scripts do projeto\n'
  + '  · `test` = o script declarado no package.json; aqui ele executa o test.mjs,\n'
  + '    que é o gate inteiro deste repositório\n\n'
  + 'Se o gate não se aplica ao que você mexeu, diga isso na resposta em vez de\n'
  + 'encerrar calado. Esta é a única volta: a próxima passa.',
)
process.exit(2)
