#!/usr/bin/env node
/**
 * CC-232, metade de cima: ao abrir sessão, o que depende DELE entra na mesa.
 *
 * ## O que motivou
 *
 * Medido em 21/08, a pedido dele: as quatro pendências humanas do encerramento
 * anterior **não estavam na lista dele**. Ficaram gravadas como bloqueios da
 * sessão que as criou, e a lista de tarefas mostrava outras quatro, de uma
 * semana antes. Ele perguntou se estavam no painel "pq deveriam estar, né?".
 *
 * O defeito não era a tela: era não haver protocolo. O encerramento escrevia o
 * que depende dele num arquivo de texto, e ninguém garantia que aquilo virava
 * tarefa. O início lia o mesmo texto e também não garantia.
 *
 * ## Por que injetar, e não bloquear
 *
 * `SessionStart` não tem como recusar nada, e aqui isso é suficiente: quem
 * cobra é a outra metade (`tarefas-fim.mjs`), no fim da sessão. Um mostra, o
 * outro segura, o mesmo par de `framework-inicio` e `framework-guard`.
 *
 * ## O que ele NÃO faz, de propósito
 *
 * Não marca nada como feito e não remove nada. Tarefa dele só sai da lista por
 * ordem dele: um hook decidindo sozinho que algo foi resolvido é exatamente o
 * jeito de a lista passar a mentir, que é o defeito que este item conserta.
 */
import { readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança e, como a chamada está num `.catch`, o módulo sumiria sem erro
   visível, foi assim que 31 hooks ficaram calados sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let entrada = ''
try { entrada = readFileSync(0, 'utf8') } catch { sair() }
let dados = null
try { dados = JSON.parse(entrada) } catch { sair() }

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
/* Armadilha do projeto: hook fora do `hooksCatalogo.mjs` recebe `false` aqui e
   sai calado achando que está desligado. Este está registrado como
   `tarefas-inicio`. */
if (cfg?.hookEnabled && !cfg.hookEnabled('tarefas-inicio')) sair()

const M = await import(urlDeModulo(AQUI, '../src/meu.mjs')).catch(sair)
const S = await import(urlDeModulo(AQUI, '../src/sessoes.mjs')).catch(() => null)

let tarefas = []
let jobs = []
try {
  /* A lista completa junta o arquivo dele, o que os agentes pediram e o backlog
     parado esperando decisão dele. Sem os jobs ela ainda funciona, só mais
     pobre, e uma leitura de jobs que falha não pode calar a lista inteira.
     `todosOsJobs()` e não `readJobs()`: ver CC-124 no `sessoes.mjs`. */
  try { jobs = S?.todosOsJobs ? S.todosOsJobs() : [] } catch { jobs = [] }
  tarefas = M.tudo(jobs).filter((t) => !t.feito)
} catch {
  try { tarefas = M.ler().tarefas.filter((t) => !t.feito) } catch { sair() }
}

if (!tarefas.length) sair() // nada esperando por ele: silêncio, não "tudo limpo"

/**
 * CC-262: a revisão automática, pedida por ele em 21/08.
 *
 * *"a gente consegue colocar 1 hook pra garantir que essas tarefas que só eu
 * resolvo sejam revisadas no início de toda a sessão pra ver se elas já foram
 * resolvidas?"*.
 *
 * O que motivou: numa revisão à mão, **duas das oito estavam feitas havia dias**
 * e ninguém sabia. Lista que não se revisa apodrece, e lista podre ensina a ser
 * ignorada.
 *
 * Só levanta a mão. Fechar continua sendo dele, e por dois motivos: a prova
 * pode estar certa sobre o mundo e errada sobre a intenção, e tarefa dele que
 * se fecha sozinha é o começo de uma lista que mente.
 */
let resolvidas = []
try {
  const P = await import(urlDeModulo(AQUI, '../src/tarefasProva.mjs'))
  resolvidas = P.revisar(tarefas, { raiz: dados?.cwd || process.cwd() })
    .filter((t) => t.resolvida === true)
} catch { /* sem o módulo, a lista continua aparecendo inteira */ }

const idade = (ms) => {
  if (!ms) return ''
  const d = Math.floor((Date.now() - ms) / 86400000)
  if (d >= 7) return ` (parada há ${d} dias)`
  if (d >= 1) return ` (mudou há ${d} dia${d > 1 ? 's' : ''})`
  const h = Math.floor((Date.now() - ms) / 3600000)
  return h >= 1 ? ` (mudou há ${h} h)` : ' (mudou agora há pouco)'
}

const linhas = []

/* CC-262: o que a prova diz que já acabou vem PRIMEIRO, com o comando de
   fechar pronto. É o achado da sessão, e enterrar no fim da lista seria o
   mesmo que não revisar. */
if (resolvidas.length) {
  linhas.push(`${resolvidas.length} tarefa(s) DELE parecem já resolvidas. MOSTRE ISTO a ele no começo:`)
  for (const t of resolvidas) {
    linhas.push(`  - ${t.texto}`)
    linhas.push(`    a prova diz: ${t.comoSoube}`)
    linhas.push(`    se ele confirmar:  cc meu feito ${t.id}`)
  }
  linhas.push('  NÃO feche nenhuma por conta própria: a prova pode estar certa sobre o')
  linhas.push('  mundo e errada sobre a intenção dele. Pergunte e espere a resposta.')
  linhas.push('')
}

/* CC-1124, passo 5: no máximo 4 linhas, só o que mudou na semana ou é da
   frente desta sessão; o resto vira uma frase. A lista de 8 mais velhas, mais
   "e mais 240", em toda sessão, era ruído que ele não respondia. A frente vem
   do cartão desta sessão, que só existe ao retomar; sessão nova não tem. */
const minha = jobs.find((j) => dados?.session_id && (j.sessionId === dados.session_id || j.id === String(dados.session_id).slice(0, 8)))
const sel = M.paraAbertura(tarefas, { projeto: dados?.cwd ? basename(dados.cwd) : null, frente: minha?.frente || null })

if (sel.mostrar.length) {
  linhas.push(`Tarefas do Felipe que mudaram nos últimos 7 dias${sel.entram > sel.mostrar.length ? ` (${sel.mostrar.length} de ${sel.entram})` : ''}:`)
  for (const t of sel.mostrar) {
    const onde = [t.projeto, t.frente].filter(Boolean).join(' › ')
    linhas.push(`  - ${t.texto}${onde ? `  [${onde}]` : ''}${idade(t.em)}`)
  }
}
if (sel.paradas) {
  const um = sel.paradas === 1
  const quantas = sel.paradas === sel.total
    ? (um ? 'A única tarefa do Felipe' : `As ${sel.total} tarefas do Felipe`)
    : `${sel.paradas} de ${sel.total} tarefas do Felipe`
  // ponytail: frase fixa; quando o cartão semanal do Decidir um por um existir, trocar o fim por "esperam no cartão semanal do Decidir um por um"
  linhas.push(`${quantas} ${um ? 'está parada' : 'estão paradas'} há mais de 7 dias; ${um ? 'está' : 'estão'} no Caminho e no Decidir um por um.`)
}
linhas.push('Mencione só se tocar o trabalho de hoje; não execute nem feche por ele.')

process.stdout.write(`${linhas.join('\n')}\n`)
process.exit(0)
