#!/usr/bin/env node
/**
 * CC-723: a ferramenta "perguntar" do Coderoom, servida no padrão MCP.
 *
 * Pedido dele em 30/09: *"um sistema pro coderoom fazer perguntas, pedir
 * autorização e me permitir mexer nas sessões feitas por ele direto pelo
 * sessões também, igual é pelo claude code"*. Escolha dele entre dois
 * caminhos: a ferramenta que PAUSA, como no Claude Code.
 *
 * Medido antes: sem terminal (`claude -p`) a ferramenta de pergunta do Claude
 * Code não existe ("No matching deferred tools found"). Esta ferramenta ocupa
 * esse lugar: o agente chama, a pergunta é gravada na MESMA pasta dos pedidos
 * de permissão (é assim que ela aparece em Sessões sem rota nova), e a chamada
 * fica esperando a resposta dada no painel, até 10 minutos.
 *
 * Sem dependência: o MCP por stdio é JSON-RPC, uma mensagem por linha.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { pasta } from '../hooks/permissao-painel.mjs'

export const ESPERA_PERGUNTA_MS = 10 * 60 * 1000

export const FERRAMENTA = {
  name: 'perguntar',
  description: 'Faz uma pergunta ao Felipe com opções clicáveis no painel e ESPERA a resposta dele (até 10 min). '
    + 'Use sempre que precisar de uma decisão dele antes de seguir. '
    + 'A resposta volta como texto: a opção que ele tocou.',
  inputSchema: {
    type: 'object',
    properties: {
      pergunta: { type: 'string', description: 'A pergunta, completa e curta, em português.' },
      opcoes: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6, description: 'De 2 a 6 opções curtas.' },
    },
    required: ['pergunta', 'opcoes'],
  },
}

/** Grava a pergunta e espera a resposta. Devolve o texto que volta ao agente. */
export async function perguntar({ pergunta, opcoes }, { dir = pasta(), coderoom = null, cwd = process.cwd(), espera = ESPERA_PERGUNTA_MS, esperar = (ms) => new Promise((r) => setTimeout(r, ms)), agora = Date.now, cancelado = () => false } = {}) {
  const ops = (Array.isArray(opcoes) ? opcoes : []).map((o) => String(o).slice(0, 200)).filter(Boolean).slice(0, 6)
  if (!pergunta || ops.length < 2) return 'Pergunta inválida: preciso da pergunta e de pelo menos 2 opções.'
  const id = crypto.randomUUID().slice(0, 13)
  const arq = path.join(dir, id + '.json')
  const resp = path.join(dir, id + '.resposta.json')
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(arq + '.tmp', JSON.stringify({
      id, tipo: 'pergunta', pergunta: String(pergunta).slice(0, 1000), opcoes: ops,
      coderoom, sessao: coderoom ? 'gate:' + coderoom : null, cwd, ferramenta: 'pergunta',
      em: agora(), ate: agora() + espera,
    }))
    fs.renameSync(arq + '.tmp', arq)
  } catch (e) {
    return `Não consegui mostrar a pergunta no painel (${e.message}). Faça a pergunta no texto da resposta.`
  }
  try {
    for (let t = 0; t < espera; t += 300) {
      /* O agente morreu (parado no painel, conversa apagada): a pergunta sai
         da tela na hora. Medido em 30/09: sem isto ela ficava 10 min
         pendurada numa conversa que nem existia mais. */
      if (cancelado()) return 'Cancelado: o agente foi encerrado.'
      let r = null
      try { r = JSON.parse(fs.readFileSync(resp, 'utf8')) } catch { /* ainda não */ }
      const d = String(r?.decisao || '')
      if (d.startsWith('escolha:')) return `O Felipe respondeu: ${d.slice(8)}`
      await esperar(300)
    }
    return `Ninguém respondeu no painel em ${Math.round(espera / 60000)} min. Não decida por ele: pare e deixe a pergunta escrita na resposta.`
  } finally {
    try { fs.unlinkSync(arq) } catch { /* já saiu */ }
    try { fs.unlinkSync(resp) } catch { /* não houve */ }
  }
}

/** Uma mensagem JSON-RPC, devolve a resposta (ou null para notificação). */
export async function atender(msg, opts) {
  const { id, method, params } = msg || {}
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  if (method === 'initialize') {
    return ok({ protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'painel', version: '1' } })
  }
  if (id === undefined || id === null) return null // notificação: não se responde
  if (method === 'ping') return ok({})
  if (method === 'tools/list') return ok({ tools: [FERRAMENTA] })
  if (method === 'tools/call') {
    if (params?.name !== 'perguntar') return { jsonrpc: '2.0', id, error: { code: -32602, message: 'ferramenta desconhecida' } }
    const texto = await perguntar(params.arguments || {}, opts)
    return ok({ content: [{ type: 'text', text: texto }] })
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'método desconhecido' } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--coderoom')
  // stdin fechado = o Claude que nos chamou morreu
  let fechou = false
  const opts = { coderoom: i > 0 ? process.argv[i + 1] || null : null, cancelado: () => fechou }
  let buf = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('end', () => { fechou = true })
  process.stdin.on('data', (d) => {
    buf += d
    let n
    while ((n = buf.indexOf('\n')) >= 0) {
      const linha = buf.slice(0, n).trim(); buf = buf.slice(n + 1)
      if (!linha) continue
      let msg; try { msg = JSON.parse(linha) } catch { continue }
      atender(msg, opts).then((r) => { if (r) process.stdout.write(JSON.stringify(r) + '\n') }).catch(() => {})
    }
  })
}
