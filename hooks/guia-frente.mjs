#!/usr/bin/env node
/**
 * CC-1076: quando uma frente fecha, o código pede o guia dela ao Haiku.
 *
 * Stop, rodado pelo `parada.mjs`, no lugar do `guia-fim` e do `guia-contexto` (aposentados). NÃO chama modelo: pergunta a
 * `src/frenteConcluida.mjs` se alguma frente do projeto acabou de ficar pronta (todos os itens em prova ou fechados, e
 * um acabou de mudar) e, para cada uma, dispara SOLTO `node src/guiaHaiku.mjs`, que faz UMA chamada e termina sozinho.
 * Devolve UMA linha ao modelo (`stop_hook_active` passa) dizendo que o guia foi pedido e onde vai aparecer.
 * Não vale no `claude -p` nem dentro do próprio guiaHaiku (CC_GUIA_HAIKU). Falha aberta: erro vai para ~/logs/guia-frente.log.
 */
import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

if (process.env.CC_CONFERENTE === '1' || process.env.CC_GUIA_HAIKU === '1' || process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-cli') sair()

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('guia-frente', undefined, dados?.cwd || process.cwd())) sair()

const log = (linha) => {
  try {
    const f = join(homedir(), 'logs', 'guia-frente.log')
    mkdirSync(dirname(f), { recursive: true })
    appendFileSync(f, `${JSON.stringify({ em: new Date().toISOString(), ...linha })}\n`)
  } catch { /* sem onde gravar */ }
}

let pedidas = []
try {
  const G = await import(urlDeModulo(AQUI, '../src/guias.mjs'))
  const raiz = G.acharRaiz(dados?.cwd)
  if (raiz) {
    const F = await import(urlDeModulo(AQUI, '../src/frenteConcluida.mjs'))
    for (const f of F.frentesConcluidas(raiz)) {
      const args = [resolve(AQUI, '../src/guiaHaiku.mjs'), '--raiz', raiz, '--frente', f.frente]
      const t = dados?.transcript_path || dados?.transcriptPath
      if (t) args.push('--transcrito', t)
      if (dados?.session_id) args.push('--sessao', String(dados.session_id))
      // solto: sobrevive ao gancho e termina sozinho (uma chamada, sem laço)
      const filho = spawn(process.execPath, args, { cwd: raiz, detached: true, stdio: 'ignore', env: process.env })
      filho.on('error', (e) => log({ frente: f.frente, erro: String(e?.message || e) }))
      filho.unref()
      pedidas.push(f.frente)
      log({ frente: f.frente, disparou: true, novos: f.novos.length, sessao: dados?.session_id || null })
    }
  }
} catch (e) {
  log({ erro: String(e?.stack || e).slice(0, 600) })
  pedidas = []
}

if (!pedidas.length) sair()
console.error(
  `[guia-frente] Frente pronta: ${pedidas.slice(0, 5).join(', ')}. O guia foi pedido ao Haiku e aparece em docs/guias/capacidades/INDICE.md (log: ~/logs/guia-haiku.log).\n`
  + 'Nada a escrever agora. A próxima volta passa.',
)
process.exit(2)
