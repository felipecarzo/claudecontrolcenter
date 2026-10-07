#!/usr/bin/env node
/**
 * O agente "API" do Coderoom: fala direto com o provedor de IA (pedido de 01/10).
 *
 * O Coderoom dispara cada agente como programa e lê a saída de um arquivo.
 * Este escreve no formato que a leitura do turno (`lerTurno`) já entende:
 *   - pedaços de texto como os do agy (`step_update.text_delta`), que se somam;
 *   - o fim como o do Claude (`type: result`), com a sessão, o tempo e o uso.
 * Assim o Coderoom lê este agente sem saber que ele é diferente.
 *
 *   node src/iaDireta.mjs --modelo groq/llama-3.3-70b-versatile [--sessao id] < pedido
 *
 * Memória: a conversa fica em <casa>/conversas-api/<sessao>.json e volta no
 * turno seguinte, como o "retomar" dos outros agentes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import * as IA from './provedoresIA.mjs'

/* Só roda chamado como programa. O teste do painel carrega todo módulo de src/
   para conferir que abre, e carregar isto lia a entrada e marcava erro (medido). */
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await principal()

async function principal() {
const arg =(n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null }
const modelo = arg('--modelo')
const sessao = (arg('--sessao') || randomUUID()).replace(/[^\w-]/g, '').slice(0, 60)
const escrever = (o) => process.stdout.write(JSON.stringify(o) + '\n')

const pastaConversas = path.join(path.dirname(IA.ARQUIVO()), 'conversas-api')
const arqConversa = path.join(pastaConversas, sessao + '.json')
const MAX_MENSAGENS = 40 // ponytail: corta o histórico pelas últimas 40; resumir quando a conversa longa pesar

let pedido = ''
for await (const p of process.stdin) pedido += p
const t0 = Date.now()
escrever({ type: 'system', subtype: 'init', session_id: sessao, model: modelo })

let historico = []
try { historico = JSON.parse(fs.readFileSync(arqConversa, 'utf8')) } catch { /* conversa nova */ }
const mensagens = [...historico, { role: 'user', content: pedido.trim() }].slice(-MAX_MENSAGENS)

try {
  const { texto, uso } = await IA.conversar({ modelo, mensagens, aoPedaco: (t) => escrever({ step_update: { step_type: 'agent_response', text_delta: t } }) })
  fs.mkdirSync(pastaConversas, { recursive: true })
  fs.writeFileSync(arqConversa, JSON.stringify([...mensagens, { role: 'assistant', content: texto }]), { mode: 0o600 })
  escrever({ type: 'result', subtype: texto ? 'success' : 'error', session_id: sessao, duration_ms: Date.now() - t0, total_cost_usd: null,
    usage: { input_tokens: uso?.prompt_tokens || 0, output_tokens: uso?.completion_tokens || 0 }, ...(texto ? {} : { result: 'o provedor respondeu sem texto' }) })
} catch (e) {
  escrever({ type: 'result', subtype: 'error', session_id: sessao, duration_ms: Date.now() - t0, result: String(e.message || e) })
  process.exitCode = 1
}
}
