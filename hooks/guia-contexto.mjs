#!/usr/bin/env node
/**
 * CC-1071, peça 2: o guia é escrito antes de o contexto acabar.
 *
 * Stop, rodado pelo `parada.mjs`. Sem chamar modelo. Soma os tokens de entrada da última resposta do transcrito
 * e, passado o limite (~/.config/agent-cockpit/guias.json, padrão 75% de 200000; 1000000 se o modelo termina em
 * [1m]) com item andando no backlog, devolve UMA vez por faixa de 10% pedindo o guia da função em andamento.
 * A faixa avisada fica em ~/.local/share/agent-cockpit/guias/<sessao>.json. O evento "vai limpar" não é registrável
 * (o arquivo de ganchos é somente leitura para a sessão), então o aviso vem antes, não no instante da limpeza.
 * `stop_hook_active` passa. Não vale no `claude -p`. Falha aberta.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('guia-contexto', undefined, dados?.cwd || process.cwd())) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let aviso = null
try {
  const G = await import(urlDeModulo(AQUI, '../src/guias.mjs'))
  const raiz = G.acharRaiz(dados?.cwd)
  const andando = raiz ? G.andandoRecentes(raiz) : []
  // sem item andando a faixa nem é gasta: o aviso fica para quando houver
  if (andando.length) {
    const cheio = G.contextoCheio(arquivo, dados?.session_id)
    if (cheio) aviso = { ...cheio, ids: andando.map((i) => i.id) }
  }
} catch (e) {
  try {
    const log = join(homedir(), 'logs', 'guia-contexto.log')
    mkdirSync(dirname(log), { recursive: true })
    appendFileSync(log, `${JSON.stringify({ em: new Date().toISOString(), erro: String(e?.stack || e).slice(0, 600) })}\n`)
  } catch { /* sem onde gravar */ }
  aviso = null
}

if (!aviso) sair()
console.error(
  `[guia-contexto] Contexto em ${aviso.pct}% da janela, com item andando: ${aviso.ids.slice(0, 5).join(', ')}.\n`
  + 'Escreva ou atualize AGORA o guia da função em andamento (modelo da skill guia-de-capacidades) e a linha no INDICE (docs/guias/capacidades/INDICE.md), antes de seguir.\n'
  + 'A próxima volta passa.',
)
process.exit(2)
