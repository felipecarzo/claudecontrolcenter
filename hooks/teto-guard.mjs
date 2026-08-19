#!/usr/bin/env node
/**
 * O teto: no máximo duas entregas antes de parar e mostrar.
 *
 * ## Por que existe
 *
 * Em 16/08 eu fechei nove tarefas em algumas horas, sem parar. Ele:
 *
 * > "a gente está mexendo em muita coisa que eu normalmente demoraria meses pra
 * > fazer, a gente está mexendo em horas, então o meu cérebro não consegue
 * > absorver tudo o que você queria"
 *
 * > "eu acabo virando uma pessoa dependente (…) quando dá um problema eu nem
 * > sei qual o problema que está dando"
 *
 * **Velocidade sem conferência não é produtividade, é dívida.** Cada entrega que
 * ele não acompanhou é uma coisa que ele vai descobrir quando quebrar.
 *
 * ## Como conta
 *
 * Tarefas fechadas desde a última vez que ELE escreveu. Passando de duas, o
 * turno não encerra: é hora de mostrar e deixar ele responder.
 *
 * ## A tensão com o modo de execução contínua, e como ela se resolve
 *
 * O outro guarda deste projeto empurra para não parar com trabalho aberto; este
 * empurra para parar. **Não se contradizem porque medem coisas diferentes:** um
 * olha o backlog (não abandone no meio), o outro olha ELE (não o afogue). Duas
 * entregas é o ponto onde o segundo ganha.
 *
 * Falha ABERTA, uma volta só.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança ERR_UNSUPPORTED_ESM_URL_SCHEME, e como quase toda chamada aqui
   está dentro de um `.catch`, o módulo some sem erro visível: foi assim que
   o interruptor de módulos deixou de valer em 31 hooks, sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('teto-guard')) sair()

const J = await import(urlDeModulo(AQUI, '../src/jobs.mjs')).catch(() => null)
if (!J) sair()

/* O modo decide se o teto vale. Decisão dele em 17/08: o teto é o "modo
   revisão" (restritivo e os outros), e o modo CONTÍNUO vai até o fim do
   backlog sem parar para mostrar. As duas regras eram dele e brigavam; a
   saída dele foi virarem modos. */
const D = await import(urlDeModulo(AQUI, '../src/frameworkDisco.mjs')).catch(() => null)
const F = await import(urlDeModulo(AQUI, '../src/framework.mjs')).catch(() => null)
if (D && F) {
  const raiz = D.acharRaiz(dados?.cwd || process.cwd())
  const estado = raiz ? D.ler(raiz) : null
  if (estado && estado.ligado !== false && F.modoDe(estado)?.fluxo?.semTeto) sair()
}

const id = process.env.CLAUDE_CODE_SESSION_ID || dados?.session_id || J.currentJobId?.()
if (!id) sair()

let meta = {}
try {
  const M = await import(urlDeModulo(AQUI, '../src/metaSessao.mjs'))
  meta = M.lerMetaSessao(id) || {}
} catch { sair() }

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

/* Quando ele falou pela última vez. Tudo fechado depois disso conta. */
let desde = 0
try {
  const cauda = readFileSync(arquivo, 'utf8').slice(-300_000)
  const linhas = cauda.split('\n')
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    let l = null
    try { l = JSON.parse(linhas[i]) } catch { continue }
    if (l?.type !== 'user' || l?.isMeta || l?.toolUseResult) continue
    const t = Date.parse(l.timestamp || '')
    if (Number.isFinite(t)) { desde = t; break }
  }
} catch { sair() }
if (!desde) sair()

const TETO = 2
const fechadas = Object.entries(meta.feitoEm || {})
  .filter(([, quando]) => Date.parse(quando) > desde)
  .map(([texto]) => texto)

if (fechadas.length <= TETO) sair()

console.error(
  `${fechadas.length} ENTREGAS SEM ELE VER — pare e mostre.\n\n`
  + fechadas.slice(0, 8).map((t) => `  ✓ ${t}`).join('\n')
  + `\n\nO teto é ${TETO} por vez. Em 16/08 fechei nove tarefas de uma vez e ele disse:\n`
  + '"o meu cérebro não consegue absorver tudo (…) eu acabo virando uma pessoa\n'
  + 'dependente, quando dá um problema eu nem sei qual o problema que está dando".\n\n'
  + 'Velocidade sem conferência não é produtividade, é dívida: cada entrega que\n'
  + 'ele não acompanhou vira uma surpresa quando quebrar.\n\n'
  + 'Encerre AGORA mostrando o que essas entregas mudam para ele, em cinco linhas.\n'
  + 'O que sobrou continua no backlog e não se perde — ele retoma quando responder.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
