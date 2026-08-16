#!/usr/bin/env node
/**
 * Mede a resposta que acabou de sair, contra o padrão do Felipe.
 *
 * ## Mede, nunca bloqueia, e nunca reclama na tela
 *
 * Três decisões, cada uma com motivo próprio:
 *
 * - **Não bloqueia**, porque `Stop` com exit 2 devolve o texto pro modelo e o
 *   manda continuar. Aqui isso seria absurdo: eu reescreveria a resposta em
 *   laço, discutindo estilo com um hook.
 * - **Não fala na tela.** O ponto do padrão é ele ler menos, e um aviso a cada
 *   resposta seria exatamente a linha a mais que estamos tentando cortar.
 * - **O número é tendência, não nota.** Falso positivo é certo: "vale lembrar"
 *   às vezes é a frase certa. O que importa é a comparação com o passado, que é
 *   o que `retrato()` faz.
 *
 * Falha em silêncio em tudo. Hook de medição que quebra o fim do turno custa
 * mais do que a medição vale.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair() // já estamos dentro de um Stop: não medir de novo

const cfg = await import(resolve(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('estilo-fim')) sair()

const E = await import(resolve(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

/* O caminho do transcrito vem no payload do hook. Sem ele não há o que medir —
   tentar adivinhar pelo transcrito mais recente do projeto erraria justamente
   quando duas sessões trabalham juntas, que é quando medir importa. */
const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const texto = E.ultimaResposta(arquivo)
if (!texto) sair()

try { E.registrar(E.medir(texto)) } catch { /* segue */ }
sair()
