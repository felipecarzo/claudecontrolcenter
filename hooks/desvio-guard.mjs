#!/usr/bin/env node
/**
 * Justificar dentro do código uma escolha contra o que ele pediu: recusado.
 *
 * ## O erro que criou esta trava (17/08)
 *
 * Ele pediu a visão de tarefas em TABELA. Eu fiz tabela no monitor e, no
 * telefone, converti cada linha em bloco empilhado, e escrevi o motivo num
 * comentário de CSS:
 *
 *     "Rolar sete colunas de lado num aparelho de 390px seria pior que não
 *      ter tabela."
 *
 * Ele usa o telefone. Então eu entreguei zero tabela e mandei o print dos
 * blocos chamando de planilha. Palavras dele:
 *
 * > "EU PEDI EM TABELA VOCE INVENTOU OUTRA COISA QUE NÃO É TABELA (…) NEM EU
 * > FALANDO EXPLICITAMENTE PRA FAZER IDENTICO AO QUE JA TEMOS VOCE VAI LA E
 * > MUDA!!! POR QUEEEEEEEE??????"
 *
 * O comentário era a confissão do desvio, e o lugar onde ele nunca ia ler.
 *
 * ## Por que o discriminador é um CRUZAMENTO, e não uma lista de frases
 *
 * Medido no repositório antes de escrever: "em vez de" aparece 92 vezes e "de
 * propósito" 72, quase sempre em comentário legítimo que registra uma decisão
 * medida. Barrar a frase sozinha inviabilizaria a documentação inteira.
 *
 * O que barra é a frase de desvio **na mesma sentença que um termo do pedido
 * dele**. "seria pior que não ter tabela" cita `tabela`, que é palavra do
 * pedido: aí a decisão é dele, não minha, e tem que virar pergunta.
 *
 * Um comentário sobre algo que ele não pediu continua livre.
 *
 * TRAVA de ferramenta (exit 2 em PreToolUse), não aviso.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }

const ferramenta = dados?.tool_name
if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(ferramenta)) sair()

const cfg = await import(resolve(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('desvio-guard')) sair()

const entrada = dados.tool_input || {}

/* O teste de um guarda GUARDA as frases que ele precisa barrar: são amostras,
   não decisões. Sem esta exceção não daria para escrever o teste desta própria
   trava, que foi o que aconteceu na primeira tentativa. A exceção é estreita de
   propósito: só arquivo de teste, nunca uma pasta inteira. */
const alvo = String(entrada.file_path || '')
if (/(^|[\\/])(testar-[\w-]+\.sh|test[\w-]*\.mjs)$/.test(alvo)) sair()

const texto = [entrada.new_string, entrada.content, entrada.new_source]
  .filter((x) => typeof x === 'string').join('\n')
if (!texto.trim()) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const P = await import(resolve(AQUI, '../src/pedido.mjs')).catch(() => null)
if (!P) sair()
const pedido = P.ultimoPedido(arquivo)
if (!pedido) sair()

/* Só o que ELE escreveu conta como pedido, e mensagem curta não serve: "ok",
   "pode seguir" e "commit" não trazem termo nenhum, e cruzar contra elas daria
   trava aleatória. */
const termos = P.termosDoPedido(pedido)
if (termos.length < 3) sair()

/* As formas de justificar um desvio, na minha escrita real. Comparativo,
   descarte e a promessa de que a alternativa é ruim. `de propósito` NÃO está
   aqui: ele marca decisão registrada, e é o vocabulário que documenta este
   projeto inteiro. */
const DESVIO = /\b(seria pior|é pior|e pior|pior que|melhor que|melhor assim|não vale a pena|nao vale a pena|em vez de|no lugar de|preferi|optei por|não faz sentido|nao faz sentido|não faria sentido|nao faria sentido|inviável|inviavel|não compensa|nao compensa)\b/i

/* Sentença, não linha: a justificativa e o termo do pedido moram na mesma
   frase, e quebrar por linha perderia comentário de bloco quebrado em duas. */
const sentencas = texto.split(/(?<=[.;!?])\s+|\n{2,}/)

const achados = []
for (const s of sentencas) {
  if (!DESVIO.test(s)) continue
  const citados = termos.filter((t) => P.mencionado(t, s))
  if (!citados.length) continue
  achados.push({ frase: s.trim().replace(/\s+/g, ' ').slice(0, 200), citados })
}
if (!achados.length) sair()

const a = achados[0]
console.error(
  'DECISÃO CONTRA O PEDIDO DELE, ESCRITA DENTRO DO ARQUIVO.\n\n'
  + `    "${a.frase}"\n\n`
  + `Isto justifica trocar o que ele pediu (${a.citados.join(', ')}) por outra\n`
  + 'coisa, e escreve o motivo onde ele nunca vai ler.\n\n'
  + 'Em 17/08 foi assim que a tabela que ele pediu virou blocos empilhados no\n'
  + 'telefone, com o motivo num comentário de CSS. Ele abriu o painel e disse:\n'
  + '"EU PEDI EM TABELA VOCE INVENTOU OUTRA COISA QUE NÃO É TABELA".\n\n'
  + 'O que fazer, nesta ordem:\n'
  + '  1. Faça o que ele pediu, do jeito que ele pediu.\n'
  + '  2. Se você acha que há um problema, PERGUNTE antes, no AskUserQuestion,\n'
  + '     com o custo de cada caminho. A escolha é dele.\n'
  + '  3. Comentário sobre coisa que ele não pediu continua livre.\n',
)
process.exit(2)
