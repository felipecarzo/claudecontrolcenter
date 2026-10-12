#!/usr/bin/env node
/**
 * CC-991: lembrete de trocar o modelo, a cada pedido dele.
 *
 * Decisão dele em 08/10: o opusplan troca sozinho na mesma janela, então o
 * lembrete só vale quando a sessão NÃO está em opusplan e o modelo que
 * respondeu por último não bate com o da tarefa andando. Avisa uma vez por
 * tarefa e modelo (marca em tmpdir), nunca trava: só põe contexto.
 *
 * AVISO (UserPromptSubmit, exit 0 sempre).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
const sessao = dados?.session_id || process.env.CLAUDE_CODE_SESSION_ID
if (!sessao) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('modelo-lembrete')) sair()

let raiz = resolve(dados.cwd || process.cwd())
for (let i = 0; i < 40 && !existsSync(resolve(raiz, 'docs', 'backlog.jsonl')); i++) { const pai = dirname(raiz); if (pai === raiz) sair(); raiz = pai }
if (!existsSync(resolve(raiz, 'docs', 'backlog.jsonl'))) sair()

/* O modelo que respondeu por último: a cauda do transcrito (ponytail: 64 KB, sobra para uma resposta). */
function modeloReal(caminho) {
  try {
    const t = readFileSync(caminho, 'utf8').slice(-65536).split('\n')
    for (let i = t.length - 1; i >= 0; i--) {
      const m = /"model":"([^"]+)"/.exec(t[i])
      if (m && !m[1].startsWith('<')) return m[1]
    }
  } catch { /* sem transcrito, vale o configurado */ }
  return null
}

try {
  const B = await import(urlDeModulo(AQUI, '../src/backlog.mjs'))
  const MO = await import(urlDeModulo(AQUI, '../src/modelo.mjs'))
  const arq = resolve(raiz, 'docs', 'backlog.jsonl')
  const eventos = readFileSync(B.caminhoEventos(arq), 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
  const id = MO.andandoDaSessao(eventos, sessao)
  const item = id && B.ler(arq).itens.find((x) => x.id === id)
  const texto = item && MO.lembreteDeModelo(item, MO.modeloDaSessao(dados, raiz), modeloReal(dados.transcript_path))
  if (!texto) sair()
  const marca = resolve(tmpdir(), `cc-modelo-lembrete-${sessao}`)
  const chave = `${id}:${texto}`
  if (existsSync(marca) && readFileSync(marca, 'utf8') === chave) sair()
  writeFileSync(marca, chave)
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `MODELO: ${texto}` } }))
} catch { sair() } // falha de leitura nunca atrapalha o pedido dele
