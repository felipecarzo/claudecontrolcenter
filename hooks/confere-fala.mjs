#!/usr/bin/env node
/**
 * CC-1069, itens 4 e 6: só se diz que fez, se fez mesmo.
 *
 * Stop, rodado pelo `parada.mjs`. Resposta final com afirmação de feito ou de
 * estado (fiz, pronto, está ligado, N commits, voltou, encerrei, conferi, e
 * "todas/tudo" perto de modelo ou estado) volta UMA vez, pedindo a conferência
 * de cada afirmação contra a saída de ferramenta do turno. Sem afirmação, não
 * dispara. `stop_hook_active` passa. "não conferi" na resposta passa.
 * Absorve o `afirmacao-guard` do item 4. Falha aberta.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('confere-fala', undefined, dados?.cwd || process.cwd())) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

const texto = E.ultimaResposta(arquivo)
if (!texto) sair()
const { afirma, limpar } = await import(urlDeModulo(AQUI, '../src/conferente.mjs')) // CC-1070: o detector é um só
const sem = limpar(texto)
if (/nao conferi/.test(sem)) sair()
if (!afirma(sem)) sair()

console.error(
  '[confere-fala] A resposta afirma que algo foi feito ou está em certo estado.\n'
  + 'Para cada afirmação, aponte a saída de ferramenta DESTE turno que a prova. Sem prova, troque por "não conferi" ou tire.\n'
  + 'Se a saída mostra outra coisa, corrija. Reenvie a resposta.\n'
  + 'A próxima volta passa.',
)
process.exit(2)
