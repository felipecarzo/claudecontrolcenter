#!/usr/bin/env node
/**
 * CC-1071, peça 1: toda função pronta deixa um guia de capacidades.
 *
 * Stop, rodado pelo `parada.mjs`. Sem chamar modelo. Dispara quando, neste turno, um item do backlog foi
 * para prova (PR) ou fechado (OK) e nenhum guia de `docs/guias/capacidades/` cita o id no cabeçalho `itens:`,
 * ou quando um arquivo de código editado no turno consta em `codigo:` de um guia mais velho que ele.
 * Conserto, registro, medição e decisão não pedem guia novo. Devolve UMA vez (`stop_hook_active` passa).
 * Não vale no `claude -p`. Falha aberta: o erro passa calado e vai para ~/logs/guia-fim.log.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

if (process.env.CC_CONFERENTE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-cli') sair()

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('guia-fim', undefined, dados?.cwd || process.cwd())) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let falta = null
let raiz = null
try {
  const G = await import(urlDeModulo(AQUI, '../src/guias.mjs'))
  raiz = G.acharRaiz(dados?.cwd)
  if (raiz) {
    const R = await import(urlDeModulo(AQUI, '../src/registroTurno.mjs'))
    falta = G.faltaDoGuia(raiz, () => R.registroDoTurno(arquivo))
  }
} catch (e) {
  try {
    const log = join(homedir(), 'logs', 'guia-fim.log')
    mkdirSync(dirname(log), { recursive: true })
    appendFileSync(log, `${JSON.stringify({ em: new Date().toISOString(), erro: String(e?.stack || e).slice(0, 600) })}\n`)
  } catch { /* sem onde gravar */ }
  falta = null
}

if (!falta || (!falta.semGuia.length && !falta.velhos.length)) sair()
const linhas = []
if (falta.semGuia.length) linhas.push(`Item sem guia: ${falta.semGuia.slice(0, 5).join(', ')}.`)
for (const v of falta.velhos.slice(0, 3)) linhas.push(`Guia velho: ${v.guia} (código mais novo: ${v.arquivos.slice(0, 3).join(', ')}).`)
console.error(
  `[guia-fim] Falta guia de capacidades.\n${linhas.join('\n')}\n`
  + 'Escreva ou atualize o guia pelo modelo da skill guia-de-capacidades e a linha no INDICE (docs/guias/capacidades/INDICE.md).\n'
  + 'A próxima volta passa.',
)
process.exit(2)
