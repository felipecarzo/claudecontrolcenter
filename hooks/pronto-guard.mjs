#!/usr/bin/env node
/**
 * CC-97, "feito" precisa de prova, não de opinião minha.
 *
 * ## O que ele pediu, em 16/08
 *
 * > "nao temos exatamente uma definição de pronto, e isso quebra praticamente
 * > todo o projeto"
 *
 * E, ao escolher como cobrar: **hook no fim do turno**, com a razão dita por
 * ele, *"gate nao, hook, gate nunca funcionou"*.
 *
 * ## O que ele cobra
 *
 * To-do que passou a `done` **neste turno** e fechou sem `prova`. Não é sobre
 * ter feito: é sobre poder dizer **o que foi rodado e o que apareceu**.
 *
 * ```
 * node cc.mjs done "texto da tarefa" --prova "npm test verde, 17 telas em 390px"
 * ```
 *
 * ## Por que a prova é campo separado da tarefa
 *
 * `pronto` é escrito antes ("como se sabe que acabou"), `prova` depois ("o que
 * apareceu"). Juntar os dois num campo só faria promessa e resultado terem a
 * mesma cara, e é exatamente essa diferença que ele não consegue auditar hoje:
 *
 * > "você diz que fez. eu confio, e no momento seguinte eu descubro que não
 * > verdade o que você fez não eh exatamente o que eu pedi"
 *
 * ## Por que compara com o estado do turno anterior
 *
 * Cobrar todo to-do fechado faria o hook reclamar de tarefa que ele mesmo já
 * deixou passar ontem, para sempre. O que interessa é o que **mudou agora**,
 * e a foto do começo do turno vem do `historico`, que o painel já mantém.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('pronto-guard')) sair()
if (cfg?.isEnabled && !cfg.isEnabled()) sair()

const J = await import(urlDeModulo(AQUI, '../src/jobs.mjs')).catch(() => null)
if (!J) sair()

const id = process.env.CLAUDE_CODE_SESSION_ID || dados?.session_id || J.currentJobId?.()
if (!id) sair()

let meta = {}
try {
  const M = await import(urlDeModulo(AQUI, '../src/metaSessao.mjs'))
  meta = M.lerMetaSessao(id) || {}
} catch { sair() }

const todos = (meta.todos || []).map(J.normalizeTodo).filter(Boolean)
if (!todos.length) sair() // sem lista não há o que cobrar; disso cuida o reporte-guard

/* Fechado e sem prova. `pronto` declarado e não cumprido conta igual: a
   definição sem o resultado é meia verificação. */
const semProva = todos.filter((t) => t.done && !String(t.prova || '').trim())
if (!semProva.length) sair()

/* Só cobra o que fechou NESTE turno. A marca é o transcrito: se o texto da
   tarefa não apareceu na conversa de agora, ela é de antes e já passou. */
const arquivo = dados?.transcript_path || dados?.transcriptPath
let recentes = semProva
if (arquivo) {
  try {
    const cauda = readFileSync(arquivo, 'utf8').slice(-200_000)
    const corte = cauda.lastIndexOf('"type":"user"')
    const turno = corte >= 0 ? cauda.slice(corte) : cauda
    const nesteTurno = semProva.filter((t) => turno.includes(t.text.slice(0, 30)))
    if (nesteTurno.length) recentes = nesteTurno
    else sair() // nenhum fechou agora: são pendências antigas, não cobra de novo
  } catch { /* sem transcrito, cobra todas, errar para o lado de verificar mais */ }
}

console.error(
  `${recentes.length} TAREFA(S) FECHADA(S) SEM PROVA.\n\n`
  + recentes.map((t) => `  ✓ ${t.text}${t.pronto ? `\n      pronto quando: ${t.pronto}` : ''}`).join('\n')
  + '\n\n    node cc.mjs done "texto da tarefa" --prova "o que rodou, e o que apareceu"\n\n'
  + '  · `--prova` = a evidência, não a intenção. "npm test verde, 17 telas em\n'
  + '    390px" é prova; "implementado" não é.\n\n'
  + 'Regra dele, 16/08: "nao temos exatamente uma definição de pronto, e isso\n'
  + 'quebra praticamente todo o projeto". Sem prova, "feito" é opinião minha,\n'
  + 'e o que ele mais teme é descobrir depois que não era bem isso.\n\n'
  + 'Não conseguiu verificar? Diga isso na prova. "não consegui conferir, falta\n'
  + 'o painel reiniciar" é uma resposta honesta; silêncio não é.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
