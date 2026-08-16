#!/usr/bin/env node
/**
 * CC-95 — o agente reporta no painel, e é cobrado por isso.
 *
 * ## O buraco, medido em 16/08
 *
 * Depois de um dia fechando dez itens do ROADMAP, o `meta.json` desta sessão
 * tinha `subject` vazio, `frente` vazia e **zero to-dos**. O painel mostrou
 * nada, e o Felipe nomeou a consequência:
 *
 * > "é tanta informação sem registro e sem um backlog de facil acompanhamento
 * > que sinceramente eu acabo sendo empurrado pro vibecoding pq a minha cabeça
 * > nao consegue processar"
 *
 * ## Por que o `cc-check` não pegou
 *
 * Ele existe desde 08/08 e cobra to-do **aberto** na entrega. Só que ele só
 * dispara **quando existem to-dos**: uma lista vazia passa como se fosse
 * entrega limpa. **Ausência de registro e trabalho terminado tinham a mesma
 * cara**, e é a mesma família de defeito que apareceu três vezes hoje — a
 * ferramenta afirmando mais do que sabe.
 *
 * Este hook cobre o outro lado: não "você deixou to-do aberto?", e sim "você
 * chegou a dizer no que estava trabalhando?".
 *
 * ## Quando ele cobra, e por que só aí
 *
 * Só quando o turno **mexeu em código ou fechou item do ROADMAP**. Conversa,
 * pergunta e leitura não geram trabalho para o painel mostrar — cobrar ali
 * transformaria o hook em ruído, e hook chato vira hook desligado.
 *
 * Falha ABERTA, uma volta só.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(resolve(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('reporte-guard')) sair()
// o interruptor geral do reporte manda: desligado, não se cobra o que não se usa
if (cfg?.isEnabled && !cfg.isEnabled()) sair()

const J = await import(resolve(AQUI, '../src/jobs.mjs')).catch(() => null)
if (!J) sair()

const id = process.env.CLAUDE_CODE_SESSION_ID || dados?.session_id || J.currentJobId?.()
if (!id) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let cauda = ''
try { cauda = readFileSync(arquivo, 'utf8').slice(-300_000) } catch { sair() }
const corte = cauda.lastIndexOf('"type":"user"')
const turno = corte >= 0 ? cauda.slice(corte) : cauda

/* Este turno produziu trabalho que o painel deveria estar mostrando? */
const CODIGO = /\.(mjs|js|cjs|ts|tsx|jsx|html|css|ps1|sh|py)$/i
let trabalhou = false
for (const linha of turno.split('\n')) {
  if (!linha.includes('"tool_use"')) continue
  let ev = null
  try { ev = JSON.parse(linha) } catch { continue }
  for (const b of ev?.message?.content || []) {
    if (b?.type !== 'tool_use') continue
    const alvo = String(b.input?.file_path || '')
    if (['Edit', 'Write', 'NotebookEdit'].includes(b.name) && CODIGO.test(alvo)) trabalhou = true
    // fechar item do ROADMAP conta como trabalho, mesmo sendo edição de texto
    if (['Edit', 'Write'].includes(b.name) && /ROADMAP\.md$/i.test(alvo)) trabalhou = true
  }
}
if (!trabalhou) sair()

let meta = {}
try { meta = J.readMeta ? J.readMeta(id) : {} } catch { /* segue com vazio */ }
// leitura direta, para o hook não depender de uma função que pode não existir
if (!meta || !Object.keys(meta).length) {
  try {
    const M = await import(resolve(AQUI, '../src/metaSessao.mjs'))
    meta = M.lerMetaSessao(id) || {}
  } catch { /* fica vazio, e aí o hook cobra — que é o certo */ }
}

const faltam = []
if (!String(meta.subject || '').trim()) faltam.push('`subject` — o problema em 3 a 6 palavras, não o comando')
if (!String(meta.frente || '').trim()) faltam.push('`frente` — a seção do docs/ROADMAP.md onde este trabalho entra')
if (!(meta.todos || []).length) faltam.push('`todos` — a lista do que esta tarefa tem que fechar')

if (!faltam.length) sair()

console.error(
  'TRABALHO SEM REGISTRO NO PAINEL — o painel está mostrando vazio.\n\n'
  + 'Este turno mexeu em código ou no ROADMAP, e falta:\n\n'
  + faltam.map((f) => `  · ${f}`).join('\n')
  + '\n\n    node cc.mjs set \'{"subject":"...","frente":"...","todos":[{"text":"...","done":false}]}\'\n\n'
  + '  · `set` = grava o estado desta sessão no painel, sem apagar o que já está lá\n'
  + '  · fechar um item depois: `node cc.mjs done "texto da tarefa"`\n\n'
  + 'Por que isto é cobrado: em 16/08 um dia inteiro fechou dez itens do ROADMAP\n'
  + 'com ZERO to-dos no painel. O `cc-check` não pegou porque ele cobra to-do\n'
  + 'ABERTO, e lista vazia passava como entrega limpa — ausência de registro e\n'
  + 'trabalho terminado tinham a mesma cara.\n\n'
  + 'A consequência, nas palavras dele: "eu acabo sendo empurrado pro vibecoding\n'
  + 'pq a minha cabeça nao consegue processar". O painel existe para ele não\n'
  + 'precisar perguntar o que já foi feito.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
