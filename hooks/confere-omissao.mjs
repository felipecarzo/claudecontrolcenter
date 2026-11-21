#!/usr/bin/env node
/**
 * CC-1070, peças 1 e 2: o registro do turno e a cobrança de omissão.
 *
 * Stop, rodado pelo `parada.mjs`. A cada fim de resposta grava o que o turno fez
 * de verdade (`src/registroTurno.mjs`, em ~/.local/share/agent-cockpit/registro).
 * Depois compara o registro com o texto final: erro de comando, teste falho,
 * coisa derrubada e coisa ligada precisam aparecer na resposta. Faltou algum:
 * devolve UMA vez listando os itens. `stop_hook_active` passa. Turno sem nada
 * disso não dispara. Não vale no `claude -p`. Falha aberta.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

if (process.env.CC_CONFERENTE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-cli') sair()

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('confere-omissao', undefined, dados?.cwd || process.cwd())) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let itens = []
try {
  const R = await import(urlDeModulo(AQUI, '../src/registroTurno.mjs'))
  const reg = R.registroDoTurno(arquivo)
  R.gravarTurno(reg, { sessao: dados?.session_id, cwd: dados?.cwd })
  if (!dados?.stop_hook_active) {
    const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs'))
    const texto = E.ultimaResposta(arquivo)
    if (texto) itens = R.naoCitados(reg, texto)
    /* CC-1094: o "turno" vai do último texto DELE, então numa sessão movida por mensagem de outra sessão o mesmo erro
       antigo era cobrado a cada resposta (medido: 4 vezes seguidas o mesmo item). Cobrado uma vez, não volta. */
    if (itens.length && dados?.session_id) {
      const arq = join(R.dirRegistro(), `${String(dados.session_id).replace(/[^\w-]/g, '_')}.cobrados.json`)
      let ja = []
      try { ja = JSON.parse(readFileSync(arq, 'utf8')) } catch { /* nada cobrado ainda */ }
      itens = itens.filter((x) => !ja.includes(x))
      if (itens.length) { mkdirSync(dirname(arq), { recursive: true }); writeFileSync(arq, JSON.stringify([...ja, ...itens].slice(-200))) }
    }
  }
} catch { itens = [] /* falha aberta */ }

if (!itens.length) sair()
console.error(
  `[confere-omissao] O turno teve ${itens.length} ocorrência(s) que a resposta não cita.\n`
  + `${itens.slice(0, 5).map((x, i) => `${i + 1}) ${x}`).join('\n')}\n`
  + 'Reenvie a resposta incluindo cada uma: o que aconteceu e o que ficou assim.\n'
  + 'A próxima volta passa.',
)
process.exit(2)
