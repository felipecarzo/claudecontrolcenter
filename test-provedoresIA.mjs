// APIs de IA no Coderoom (pedido de 01/10): guarda da chave, teste, conversa em pedaços e o agente API ponta a ponta,
// contra um provedor de mentira nesta máquina (nenhuma chave de verdade sai daqui).
import assert from 'node:assert/strict'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'
import { spawn } from 'node:child_process'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'ia-'))
process.env.CC_HOME = casa
const CHAVE = 'gsk_teste_1234567890abcd'
let ultimoPedido = null
const srv = http.createServer((q, s) => {
  if (q.headers.authorization !== `Bearer ${CHAVE}`) { s.statusCode = 401; return s.end('{"error":{"message":"invalid key"}}') }
  if (q.url === '/models') return s.end(JSON.stringify({ data: [{ id: 'm1' }, { id: 'm2:free' }] }))
  let b = ''; q.on('data', (d) => { b += d }); q.on('end', () => {
    ultimoPedido = JSON.parse(b)
    s.setHeader('content-type', 'text/event-stream')
    const n = ultimoPedido.messages.length
    for (const t of ['Olá', ' mundo', ` (${n} mensagens)`]) s.write(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`)
    s.end('data: [DONE]\n\n')
  })
}).listen(0, '127.0.0.1')
await new Promise((r) => srv.once('listening', r))
process.env.CC_IA_BASE_GROQ = `http://127.0.0.1:${srv.address().port}`
const IA = await import('./src/provedoresIA.mjs')
const { lerTurno } = await import('./src/gateAgentes.mjs')
let n = 0; const ok = (m) => { n += 1; console.log('  ok  ' + m) }
try {
  assert.throws(() => IA.salvarChave('groq', 'curta'), /não parece uma chave/); ok('texto que não é chave é recusado')
  assert.throws(() => IA.salvarChave('inventado', CHAVE), /desconhecido/); ok('provedor fora do catálogo é recusado')
  IA.salvarChave('groq', CHAVE)
  assert.equal(fs.statSync(IA.ARQUIVO()).mode & 0o777, 0o600); ok('o arquivo das chaves só o dono lê (600)')
  const g = IA.listar().find((p) => p.id === 'groq')
  assert.equal(g.temChave, true); assert.equal(g.chaveFim, '…abcd')
  assert.ok(!JSON.stringify(IA.listar()).includes(CHAVE)); ok('a lista para a tela nunca leva a chave, só os 4 últimos caracteres')
  assert.deepEqual(IA.envParaOpencode(), { GROQ_API_KEY: CHAVE }); ok('a chave chega ao opencode na variável dele')
  const t = await IA.testar('groq'); assert.equal(t.ok, true); assert.equal(t.modelos, 2); ok('testar lista os modelos do provedor')
  const r = await IA.conversar({ modelo: 'groq/m1', mensagens: [{ role: 'user', content: 'oi' }] })
  assert.equal(r.texto, 'Olá mundo (1 mensagens)'); assert.equal(ultimoPedido.model, 'm1'); ok('conversa em pedaços junta a resposta e manda o modelo sem o provedor')
  IA.salvarChave('groq', 'gsk_errada_000000000000')
  assert.equal((await IA.testar('groq')).erro, 'a chave foi recusada pelo provedor'); ok('chave recusada diz isso, em português')
  IA.salvarChave('groq', CHAVE)

  // o agente API ponta a ponta: o que o Coderoom dispara, e a leitura que ele faz
  const turno = async (sessao) => {
    const log = path.join(casa, `t${Date.now()}.jsonl`); const fd = fs.openSync(log, 'a')
    const p = spawn(process.execPath, ['src/iaDireta.mjs', '--modelo', 'groq/m1', ...(sessao ? ['--sessao', sessao] : [])], { stdio: ['pipe', fd, 'ignore'], env: process.env })
    p.stdin.end('qual o seu nome?'); await new Promise((ok2) => p.on('close', ok2)); fs.closeSync(fd)
    return lerTurno(log, 'api')
  }
  const t1 = await turno(null)
  assert.equal(t1.texto, 'Olá mundo (1 mensagens)'); assert.equal(t1.terminou, true); assert.equal(t1.estado, 'pronto'); assert.ok(t1.sessao)
  ok('o Coderoom lê a resposta do agente API: texto inteiro, terminou, com sessão')
  const t2 = await turno(t1.sessao)
  assert.equal(t2.texto, 'Olá mundo (3 mensagens)'); ok('o segundo turno lembra a conversa (manda as mensagens anteriores)')
  IA.removerChave('groq')
  const t3 = await turno(null)
  assert.equal(t3.estado, 'falhou'); assert.match(t3.erro, /sem chave cadastrada/); ok('sem chave, o turno falha dizendo o motivo')
  console.log(`\n${n} verificações das APIs de IA, todas passaram`)
} finally { srv.close(); fs.rmSync(casa, { recursive: true, force: true }) }
