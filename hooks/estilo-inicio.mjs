#!/usr/bin/env node
/**
 * Injeta o padrão de resposta do Felipe no começo de toda sessão.
 *
 * ## Independente do framework, de propósito
 *
 * O `framework-inicio.mjs` só fala quando o projeto tem `.framework/estado.json`
 * e está ligado. Este aqui vale sempre, em qualquer projeto, com o framework
 * ligado ou desligado — pedido dele, com a razão certa: o jeito de conversar não
 * é regra de engenharia de um projeto, é como a gente trabalha em tudo.
 *
 * ## Isto NÃO é um gate, e a diferença importa
 *
 * O `framework-guard` recusa a ferramenta com exit 2. Aqui não há o que recusar:
 * hook bloqueia ferramenta, e texto sai do modelo direto para a tela. Então isto
 * é a instrução mais forte disponível — sempre no contexto, sem depender de
 * alguém ter lido um CLAUDE.md — e ainda assim uma instrução.
 *
 * Foi por isso que ele pediu a medição junto (`estilo-fim.mjs`): se não dá para
 * impedir, que ao menos apareça quando eu voltar ao vício.
 *
 * Falha em silêncio em tudo. Hook de estilo que quebra a abertura da sessão é
 * pior do que estilo ruim.
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

let entrada = ''
try { entrada = readFileSync(0, 'utf8') } catch { sair() }
try { JSON.parse(entrada) } catch { sair() }

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('estilo-inicio')) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

let texto = ''
try { texto = E.lerPadrao() } catch { sair() }
if (!texto.trim()) sair()

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: texto,
  },
}))
