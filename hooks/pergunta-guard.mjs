#!/usr/bin/env node
/**
 * O gate que faltava: pergunta decisiva não pode sair em prosa.
 *
 * ## Como ele nasceu, e por que o remédio anterior era errado
 *
 * Em 15/08 o Felipe me pegou duas vezes fazendo pergunta decisiva no meio de
 * uma resposta longa, em vez de usar o `AskUserQuestion`:
 *
 * > "por que você me fez essa pergunta no chat, em vez daquele formato de
 * > perguntinha na tela? Aquilo é a regra, o framework tem que usar aquilo."
 *
 * Na primeira vez eu consertei com uma **instrução** no injetor do
 * `SessionStart`, e caí de novo vinte mensagens depois. O erro do conserto é o
 * que eu mesmo tinha escrito na análise horas antes: instrução escrita não me
 * segura, e o que é dito no começo da sessão compete com tudo que vem depois.
 *
 * ## O que eu tinha declarado impossível, e não é
 *
 * Escrevi que "hook não consegue barrar prosa". Está errado. **O `Stop` recebe o
 * turno inteiro e pode me mandar de volta.** O que estava registrado é que exit
 * 2 no `Stop` cria laço, verdade num gate de documentação, onde não há o que
 * fazer diferente na segunda passada. Aqui há: refazer a pergunta na ferramenta.
 *
 * ## O que ele NÃO faz, e é a dúvida que o Felipe levantou
 *
 * Não obriga a perguntar. Ele não olha se existe pergunta, olha se a pergunta
 * **saiu em prosa**. Executar e reportar não dispara nada.
 *
 * ## As três travas contra virar hook chato
 *
 * 1. `stop_hook_active`: uma volta e só uma, senão eu reescreveria para sempre.
 * 2. Só os dois últimos parágrafos: é onde mora o "e agora?". Pergunta no meio
 *    de uma explicação é retórica, e barrar isso tornaria o hook insuportável.
 * 3. Se o `AskUserQuestion` já foi usado no turno, cala a boca: a frase em prosa
 *    é só o resumo da caixa.
 *
 * Falha ABERTA em tudo: erro aqui nunca pode travar o fim do turno.
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

// já estamos numa volta deste hook: deixa passar, senão vira laço
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('pergunta-guard')) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const texto = E.ultimaResposta(arquivo)
if (!texto) sair()

/* Bloco de código sai antes: `?` dentro de código não é pergunta a ninguém. */
const semCodigo = texto.replace(/```[\s\S]*?```/g, '')
const fim = semCodigo.trim().split(/\n\s*\n/).slice(-2).join('\n')

/**
 * Perguntas que pedem decisão dele.
 *
 * A lista é curta e específica de propósito: cada padrão a mais é uma chance de
 * barrar pergunta retórica, e **hook chato vira hook desligado**, que é pior
 * que não ter hook.
 */
const DECISIVAS = [
  /\b(sigo|continuo|prossigo|come[çc]o|fa[çc]o)\b[^?]{0,60}\?/i,
  /\b(quer|prefere|deseja)\s+que\s+eu\b[^?]{0,80}\?/i,
  /\b(qual|quais)\b[^?]{0,80}\b(voc[êe]|prefere|quer)\b[^?]{0,40}\?/i,
  /\bposso\b[^?]{0,60}\?/i,
  /\b(ou|ent[ãa]o)\s+(prefere|deixo|paro)\b[^?]{0,60}\?/i,
  /\bo que (voc[êe] )?(acha|prefere|decide)\b[^?]{0,40}\?/i,
  /\b(registro|fa[çc]o|implemento|seguimos)\s+assim\b[^?]{0,30}\?/i,
]

if (!DECISIVAS.some((re) => re.test(fim))) sair()

/* Se a caixa foi usada neste turno, a frase em prosa é só o resumo dela. Procuro
   a chamada depois da última mensagem do usuário, que delimita o turno. */
try {
  const cauda = readFileSync(arquivo, 'utf8').slice(-120_000)
  const ultimoTurno = cauda.lastIndexOf('"type":"user"')
  if (ultimoTurno >= 0 && cauda.slice(ultimoTurno).includes('AskUserQuestion')) sair()
} catch { /* sem conseguir ler, segue e avisa */ }

const ultimaLinha = fim.split('\n').filter(Boolean).pop() || ''

console.error(
  'PERGUNTA DECISIVA EM PROSA, refaça no AskUserQuestion.\n\n'
  + 'A resposta termina perguntando algo que muda o que será feito:\n'
  + `  "${ultimaLinha.slice(0, 140)}"\n\n`
  + 'Regra dele, em 15/08: "se é pergunta, vira caixa de pergunta". O motivo não\n'
  + 'é estético, em prosa a pergunta fica no fim de um texto que ele pode não\n'
  + 'terminar de ler, e a resposta vira mais prosa. Na ferramenta é uma tela, com\n'
  + 'as opções e o tradeoff visíveis, resolvida no toque.\n\n'
  + 'Chame o AskUserQuestion com as opções que você já tem na cabeça, incluindo a\n'
  + 'que você recomenda. Esta é a única volta: a próxima passa.',
)
process.exit(2)
