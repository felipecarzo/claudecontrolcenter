#!/usr/bin/env node
/**
 * CC-975: a chamada de ajudante sai no modelo que a tarefa andando pede.
 *
 * Decisão dele em 07/10, com a correção que define o papel desta trava: o
 * modelo é decidido ANTES, na tarefa (src/modelo.mjs), e a sessão abre sabendo
 * (framework-inicio). Aqui só se confere a chamada, antes de ela rodar: a
 * recusa custa a chamada, nunca refaz trabalho.
 *
 * A tarefa é a que ESTA sessão pôs em "andando", achada pelas marcas de medida
 * do diário. Sem tarefa da sessão, sem indicação ou sem saber o modelo: passa.
 *
 * O instalador registra sem filtro de ferramenta, então roda em toda chamada:
 * a primeira coisa é sair se não for ajudante.
 *
 * TRAVA de ferramenta (exit 2 em PreToolUse).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.tool_name !== 'Agent' && dados?.tool_name !== 'Task') sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('modelo-guard')) sair()

let raiz = resolve(dados.cwd || process.cwd())
for (let i = 0; i < 40 && !existsSync(resolve(raiz, 'docs', 'backlog.jsonl')); i++) { const pai = dirname(raiz); if (pai === raiz) sair(); raiz = pai }
if (!existsSync(resolve(raiz, 'docs', 'backlog.jsonl'))) sair()

try {
  const B = await import(urlDeModulo(AQUI, '../src/backlog.mjs'))
  const MO = await import(urlDeModulo(AQUI, '../src/modelo.mjs'))
  const arq = resolve(raiz, 'docs', 'backlog.jsonl')
  let eventos = []
  try { eventos = readFileSync(B.caminhoEventos(arq), 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } }) } catch { sair() }
  const id = MO.andandoDaSessao(eventos, dados.session_id || process.env.CLAUDE_CODE_SESSION_ID)
  const item = id && B.ler(arq).itens.find((x) => x.id === id)
  const motivo = item && MO.conferirAjudante(item, dados.tool_input || {}, MO.modeloDaSessao(dados, raiz))
  if (!motivo) sair()
  process.stderr.write(`Ajudante no modelo errado para a tarefa andando (decisão dele em 07/10: modelo decidido antes, sem retrabalho).\n${motivo}\n`)
  process.exit(2)
} catch { sair() } // falha de leitura nunca trava a sessão
