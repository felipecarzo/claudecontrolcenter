#!/usr/bin/env node
/**
 * Bloco de código para COPIAR não leva explicação dentro.
 *
 * ## O que ele disse, em 02/10
 *
 * Eu mandei três comandos para ele colar no terminal da VPS, e dentro de cada bloco
 * pus a explicação desenhada com `│` e `└─` (a regra de explicar comando "parte por
 * parte", do arquivo global dele, pedia o desenho colado ao comando). Palavras dele:
 *
 * > "se é para eu copiar fácil, eu copio o bloco. Com a explicação embaixo, eu vou
 * > colar a explicação também, e pode quebrar o código."
 *
 * A regra de explicar continua: cada parte do comando explicada. O que muda é ONDE:
 * o comando vai SOZINHO no bloco, e a explicação vem fora dele, embaixo, em texto.
 *
 * ## Como detecta, e o que fica de fora
 *
 * Um bloco de código (``` ... ```) que tem uma linha de COMANDO (começa por um programa
 * conhecido, ou por `$ `) e, junto, linhas de explicação desenhada (começam por `│`, `└`,
 * `├` ou `┌`). Só isso: comentário de shell (`# ...`) cola sem quebrar nada e passa, e
 * árvore de pastas (bloco com `├──` e nenhum comando) é saída, não comando, e passa.
 *
 * Falha ABERTA, uma volta só (stop_hook_active).
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('copiar-guard')) sair()

/* A resposta final vem no próprio pedido do gancho (sem a corrida com o disco que já
   deu falso positivo no separador); o transcrito é o plano B. */
const final = dados?.last_assistant_message
let texto = typeof final === 'string' ? final
  : Array.isArray(final?.content) ? final.content.map((b) => b?.text || '').join('\n') : ''
if (!texto) {
  const arquivo = dados?.transcript_path || dados?.transcriptPath
  const E = arquivo ? await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null) : null
  try { texto = (E && E.ultimaResposta(arquivo)) || '' } catch { texto = '' }
}
if (!texto) sair()

const PROGRAMAS = /^(\$\s+)?(sudo|cp|mv|rm|ls|cd|cat|sed|awk|grep|find|node|npm|npx|pnpm|git|curl|wget|ssh|scp|rsync|bash|sh|python3?|pip3?|systemctl|journalctl|docker|tmux|echo|export|source|chmod|chown|mkdir|touch|tail|head|kill|pkill|ps|top|df|du|free|uptime|crontab|tar|unzip|ln|tee|diff)\b/
const DESENHO = /^\s*[│└├┌]/

/** Os blocos de código da resposta que misturam comando e explicação desenhada. */
export function blocosMisturados(resposta) {
  const ruins = []
  for (const m of String(resposta).matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
    const linhas = m[1].split('\n')
    const desenho = linhas.filter((l) => DESENHO.test(l))
    const comandos = linhas.filter((l) => l.trim() && !DESENHO.test(l) && !/^\s*#/.test(l))
    if (desenho.length && comandos.some((l) => PROGRAMAS.test(l.trim()))) {
      ruins.push(comandos.find((l) => PROGRAMAS.test(l.trim())).trim().slice(0, 80))
    }
  }
  return ruins
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const ruins = blocosMisturados(texto)
  if (!ruins.length) sair()
  console.error(
    'BLOCO PARA COPIAR COM A EXPLICAÇÃO DENTRO.\n\n'
    + ruins.map((c) => `  · o bloco de "${c}" tem linhas de explicação (│ └─) junto do comando`).join('\n')
    + '\n\nEle copia o bloco inteiro e cola no terminal: a explicação vai junto e QUEBRA o comando.\n'
    + 'Palavras dele, em 02/10: "se é para eu copiar fácil, eu copio o bloco; com a explicação\n'
    + 'embaixo, eu vou colar a explicação também, e pode quebrar o código".\n\n'
    + 'Refaça assim:\n'
    + '  · o bloco de código leva SÓ o comando, nada mais, para copiar de uma vez;\n'
    + '  · a explicação parte por parte (programa, cada flag, cada caminho) continua obrigatória,\n'
    + '    mas FORA do bloco, logo abaixo, em texto comum ou lista;\n'
    + '  · "Deu certo se: ..." também fora do bloco.\n\n'
    + 'Esta é a única volta: a próxima passa.',
  )
  process.exit(2)
}
