#!/usr/bin/env node
/**
 * Pausa que esconde a fila não sai.
 *
 * ## Por que este hook existe (CC-117, 17/08)
 *
 * Palavras dele, urgentes:
 *
 * > "qdo eu te peço mil coisas e voce pausa no meio eu não sei quanto você
 * > implementou e eu perco as ideias, precisamos que essas coisas fiquem mais
 * > bem escritas e definidas num lugar de fácil acesso urgente"
 *
 * A regra escrita entrou no padrão de resposta no mesmo dia. Mas regra escrita
 * não me segura (medido três vezes neste projeto), então esta é a trava.
 *
 * ## O que ele confere, e só isso
 *
 * Quando a resposta é uma PAUSA (tem o separador de resumo) e o cartão desta
 * sessão tem tarefa aberta, a parte de baixo do separador precisa dizer o que
 * ficou: alguma das palavras "na fila", "em curso", "fica para", "pendente",
 * "aguardando" ou "esperando". Não confere item a item de propósito: casar
 * texto livre com texto livre foi o que gerou três falsos positivos no guarda
 * do separador, e falso positivo é o caminho mais curto para hook desligado.
 *
 * Resposta sem separador não é pausa de entrega e passa. Cartão sem tarefa
 * aberta passa. Falha ABERTA, uma volta só.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('fila-guard')) sair()

// o cartão da sessão: sem identidade ou sem cartão, não há o que cobrar
const id = process.env.CLAUDE_CODE_SESSION_ID || dados?.session_id
if (!id) sair()
const M = await import(urlDeModulo(AQUI, '../src/metaSessao.mjs')).catch(() => null)
const J = await import(urlDeModulo(AQUI, '../src/jobs.mjs')).catch(() => null)
if (!M || !J) sair()
let meta = null
/* CC-225: o reporte mora em dois lugares (casa e abrigo, desde o CC-157), e
   `lerMetaSessao` devolve o mais novo entre eles. Montando o caminho na mão,
   este aviso lia a casa congelada e cobrava tarefa fechada horas antes. */
meta = M.lerMetaSessao(id) || {}
if (!Object.keys(meta).length) sair()
const abertas = (meta?.todos || []).map((t) => J.normalizeTodo(t)).filter((t) => t && !t.done)
if (!abertas.length) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()
const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let texto = E.respostaDoTurno(arquivo) || E.ultimaResposta(arquivo)
if (!texto) sair()

// só pausa de entrega: sem separador este guarda não opina (o tamanho é
// assunto do guarda do separador, não deste)
const SEPARADOR = /\/\/\s*resumo\s*\/\//i
if (!SEPARADOR.test(texto)) sair()

const FILA = /\bna fila\b|\bem curso\b|\bfica(?:m|ram)? para\b|\bpendente/i
const AVISO = /aguardando|esperando (?:voc|sua|aprova)/i
const depois = texto.split(SEPARADOR).pop() || ''
if (FILA.test(depois) || AVISO.test(depois)) sair()

/* ⚠️ Relê antes de barrar: o transcrito ainda está sendo gravado quando o hook
   roda, e o guarda do separador pagou três falsos positivos por isso. */
const ate = Date.now() + 400
while (Date.now() < ate) { /* espera curta, sem timer assíncrono */ }
texto = E.respostaDoTurno(arquivo) || E.ultimaResposta(arquivo) || texto
const dnv = texto.split(SEPARADOR).pop() || ''
if (FILA.test(dnv) || AVISO.test(dnv)) sair()

console.error(
  `PAUSA COM ${abertas.length} TAREFA(S) ABERTA(S) E O RESUMO NÃO DIZ O QUE FICOU.\n\n`
  + 'Abaixo do separador, enumere os pedidos da conversa, um por linha, cada um\n'
  + 'com o estado: feito (com prova), em curso, ou na fila. O que está aberto\n'
  + 'no cartão agora:\n\n'
  + abertas.map((t) => `    · ${t.text}`).join('\n')
  + '\n\nPalavras dele (17/08): "qdo eu te peço mil coisas e voce pausa no meio\n'
  + 'eu não sei quanto você implementou e eu perco as ideias".\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
