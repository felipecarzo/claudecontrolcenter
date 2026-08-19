#!/usr/bin/env node
/**
 * Mensagem dele que sumiu da fila: eu tenho que citar antes de encerrar.
 *
 * ## O problema (CC-118, queixa de 17/08)
 *
 * > "as vezes eu digito aqui e o texto fica em itálico. daí ao sair da janela e
 * > voltar, o texto simplesmente some"
 *
 * O texto não se perde de verdade: fica no registro da sessão como uma operação
 * de fila com `remove` e sem `dequeue`. Medido nesta sessão: **34 mensagens
 * dele nesse estado**, incluindo pedidos longos ditados por voz na rua.
 *
 * ## Por que a trava é "citar", e não "avisar"
 *
 * O que sobrevive de um turno é o que virou mensagem. A minha resposta É uma
 * mensagem: se eu escrevo o texto dele na resposta, o pedido entra no histórico
 * pela minha boca e nunca mais se perde, mesmo que a fila o descarte de novo.
 *
 * Então a trava exige que a resposta CITE um trecho reconhecível do que ele
 * escreveu. Não basta dizer "chegou uma mensagem sua": isso é aviso, e aviso não
 * guarda nada.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('enfileirada-guard')) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const F = await import(urlDeModulo(AQUI, '../src/fila.mjs')).catch(() => null)
const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!F || !E) sair()

/* Só as DESTE turno: mensagem perdida ontem já não tem o que fazer, e cobrar
   histórico antigo a cada resposta seria ruído para sempre. A janela é generosa
   (2 horas) porque turno meu com backlog aberto passa fácil de uma hora. */
const desde = Date.now() - 2 * 60 * 60 * 1000
let perdidas = []
try { perdidas = F.perdidasDesde(arquivo, desde) } catch { sair() }
if (!perdidas.length) sair()

/* Todas as minhas respostas DESDE a mensagem perdida, não só a do turno atual.
   Falso positivo medido em 17/08: a trava cobrou citar uma mensagem que eu já
   tinha citado e atendido dois turnos antes. Cobrar o que já foi feito é o
   caminho mais curto para trava desligada. */
const maisAntiga = perdidas.reduce(
  (min, p) => Math.min(min, Date.parse(p.quando || '') || Infinity), Infinity)
const resposta = (F.respostasDesde(arquivo, Number.isFinite(maisAntiga) ? maisAntiga : desde)
  || E.respostaDoTurno(arquivo) || E.ultimaResposta(arquivo) || '').toLowerCase()
if (!resposta.trim()) sair()

/* Citada = um pedaço reconhecível do texto dele aparece na minha resposta. O
   pedaço é de 5 palavras seguidas, o que evita casar por acidente numa palavra
   comum e ainda tolera eu reformular o resto da frase. */
const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
/* Palavras curtas caem dos DOIS lados, e isso não é detalhe: na primeira versão
   eu tirava "um", "de", "e" só do texto dele, então citar "podemos criar um Hook
   pra modo" não casava com a janela "podemos criar hook pra modo". O caso passou
   a falhar no próprio teste, o que é o comportamento certo dele. */
const palavrasDe = (s) => normal(s).split(/[^a-z0-9]+/).filter((p) => p.length > 2)
const respostaCrua = palavrasDe(resposta).join(' ')

const citada = (texto) => {
  const palavras = palavrasDe(texto)
  if (!palavras.length) return true
  if (palavras.length < 5) return respostaCrua.includes(palavras.join(' '))
  for (let i = 0; i + 5 <= palavras.length; i += 1) {
    if (respostaCrua.includes(palavras.slice(i, i + 5).join(' '))) return true
  }
  return false
}

const naoCitadas = perdidas.filter((p) => !citada(p.texto))
if (!naoCitadas.length) sair()

const p = naoCitadas[0]
console.error(
  `${naoCitadas.length} MENSAGEM(NS) DELE SUMIU(RAM) DA FILA E VOCÊ NÃO CITOU.\n\n`
  + 'Ele digitou isto enquanto você trabalhava, e a fila descartou antes de virar\n'
  + `mensagem. O texto está guardado no registro (${p.palavras} palavras`
  + `${p.quando ? `, ${String(p.quando).slice(11, 16)}` : ''}):\n\n`
  + p.texto.split('\n').map((l) => `    ${l}`).join('\n').slice(0, 1200)
  + (naoCitadas.length > 1 ? `\n\n  … e mais ${naoCitadas.length - 1}. Todas em: cc fila\n` : '\n')
  + '\nO que fazer: responda o pedido, e CITE o texto dele na sua resposta. O que\n'
  + 'sobrevive de um turno é o que virou mensagem, e a sua resposta é uma. Citando,\n'
  + 'o pedido dele fica no histórico pela sua boca, mesmo que a fila descarte de novo.\n\n'
  + 'Ele disse: "as vezes eu digito aqui e o texto fica em itálico. daí ao sair da\n'
  + 'janela e voltar, o texto simplesmente some". Boa parte é ditada por voz, na rua.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
