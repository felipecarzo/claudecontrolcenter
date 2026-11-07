#!/usr/bin/env node
/**
 * Ele pediu uma FORMA. A entrega tem que falar dela, ou não é a entrega dele.
 *
 * ## A terceira trava que ele escolheu em 17/08
 *
 * O pedido dele era "tabela". Minha entrega falava em planilha empilhada e
 * mandava print de blocos. A palavra que ele usou não aparecia em lugar nenhum
 * da conferência, e nenhuma trava notou.
 *
 * ## Não depende de eu listar nada, e é por isso que funciona
 *
 * A ideia original era eu registrar as palavras do pedido antes de implementar.
 * Isso depende da minha honestidade no momento exato em que estou errando, que é
 * o que já falhou. Aqui a extração é automática: existe um vocabulário fechado de
 * palavras de FORMA (tabela, coluna, card, lista, gráfico, botão), o hook vê
 * quais delas ELE usou, e confere se a entrega fala das mesmas.
 *
 * Dois casos barram:
 *
 * 1. Ele pediu uma forma e a entrega não menciona nenhuma delas. Entrega muda
 *    sobre a palavra dele.
 * 2. Ele pediu uma forma, a entrega não fala dela, e fala de OUTRA forma que ele
 *    não pediu. É a substituição, com nome e sobrenome.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('forma-guard')) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const P = await import(urlDeModulo(AQUI, '../src/pedido.mjs')).catch(() => null)
const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!P || !E) sair()

const pedido = P.ultimoPedido(arquivo)
if (!pedido) sair()

/* Vocabulário de FORMA: as palavras com que ele especifica o formato de uma
   coisa. Fechado de propósito, e cada grupo é uma forma só (a primeira palavra
   é o nome que aparece na mensagem de erro). */
const FORMAS = [
  ['tabela', 'tabelas', 'planilha', 'planilhas'],
  ['card', 'cards', 'cartao', 'cartoes', 'quadradinho', 'quadradinhos'],
  ['lista', 'listas'],
  ['grafico', 'graficos'],
  ['kanban', 'quadro'],
  ['botao', 'botoes'],
  ['coluna', 'colunas'],
  ['linha', 'linhas'],
  ['aba', 'abas'],
  ['bloco', 'blocos'],
  ['arvore', 'organograma'],
  ['timeline', 'linha do tempo'],
]

const semAcento = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const usa = (texto, grupo) => {
  const t = semAcento(texto)
  return grupo.some((p) => new RegExp(`\\b${p}\\b`).test(t))
}

const pedidas = FORMAS.filter((g) => usa(pedido, g))
if (!pedidas.length) sair()

/* Só cobra quando houve TRABALHO: conversa sobre formato não precisa de
   conferência. */
const usos = P.ferramentasDoTurno(arquivo)
if (!usos.some((u) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(u.nome))) sair()

const resposta = E.respostaDoTurno(arquivo) || E.ultimaResposta(arquivo) || ''
if (!resposta.trim()) sair()

const faladas = FORMAS.filter((g) => usa(resposta, g))
const nome = (g) => g[0]

// caso 1: a entrega não fala da forma que ele pediu
const naoFalou = pedidas.filter((g) => !faladas.includes(g))
if (!naoFalou.length) sair()

// caso 2: e fala de outra, que ele não pediu
const outras = faladas.filter((g) => !pedidas.includes(g))

console.error(
  `[forma-guard] O pedido nomeia a forma "${naoFalou.map(nome).join('", "')}" e a entrega não a menciona.\n`
  + (outras.length ? `A entrega cita outra forma: ${outras.map(nome).join(', ')}. A forma nomeada no pedido é a especificação.\n` : '')
  + 'Se a entrega usa a forma pedida, reenvie a conferência com essa palavra, dizendo onde está e em que largura foi vista.\n'
  + 'Se usa outra forma, refaça na pedida; havendo motivo real, pergunte antes na caixa de escolha (AskUserQuestion).\n'
  + 'A próxima volta passa.',
)
process.exit(2)
