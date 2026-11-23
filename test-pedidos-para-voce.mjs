// CC-1120: mensagem digitada no cockpit do PC para uma sessão da VPS. A VPS não alcança o PC, então o pedido viaja no
// corpo do envio do PC e sai da fila só com o recibo. As duas pontas no mesmo processo; a rede é um fetch falso que
// faz o que a rota /api/federacao da VPS faz. A sessão da VPS tem ouvido vivo (marcador com o pid deste processo).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-pvoce-'))
const casa = path.join(base, '.claude'); fs.mkdirSync(casa, { recursive: true })
process.env.CC_HOME = casa
const F = await import('./src/federacao.mjs')
const O = await import('./src/ouvido.mjs')
assert.ok(O.dirCaixas().startsWith(base), 'caixa fora da casa de teste')

let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok  ${nome}`) }
const PC = 'PC-TESTE'
const VPS = 'VPS-TESTE'
const CONV = 'c8470472-aaaa-bbbb-cccc-ddddeeeeffff'
const dir = O.dirCaixas(); fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, `${CONV}.vivo`), JSON.stringify({ pid: process.pid, sessao: CONV, hora: Date.now() }))
const caixa = () => { try { return fs.readFileSync(path.join(dir, `${CONV}.txt`), 'utf8') } catch { return '' } }
const naFila = () => F.pedidosParaLevar(PC)

// A VPS de mentira: mesma sequência da rota (validar, receber, entregar, recibo). `rede` escolhe o que dá errado.
let rede = 'ok'
let corpos = []
const daVPS = { sessoes: async () => ({}), enviar: async () => ({ ok: false, erro: 'sem terminal' }), apertarTecla: async () => ({ ok: false }) }
globalThis.fetch = async (_url, op) => {
  if (rede === 'caiu') throw new Error('fetch failed')
  const bruto = JSON.parse(op.body); corpos.push(bruto)
  if (rede === 'velha') return { ok: true, status: 200, json: async () => ({ pedidos: [] }) }
  const v = F.validarPacote(bruto)
  assert.equal(v.pacote.pedidosParaVoce, undefined, 'o pedido não pode entrar no retrato gravado')
  const c = F.receberPedidosParaVoce(v.pedidosParaVoce, VPS)
  for (const p of c.novos) await F.entregarMensagemRemota(p, daVPS)
  if (rede === 'recibo-perdido') throw new Error('socket hang up')
  return { ok: true, status: 200, json: async () => ({ pedidos: [], ...(c.ids.length ? { pedidosRecebidos: c.ids } : {}) }) }
}
const empurrar = () => F.enviar({ enviarPara: 'http://vps.teste', token: 't', pacote: F.montarPacote({ maquina: { id: 'pc-teste', nome: PC }, jobs: [] }) })

try {
  await t('rede caída: o envio falha e o pedido continua na fila do PC', async () => {
    assert.equal(F.pedirMensagem({ paraMaquina: VPS, conversa: CONV, texto: 'oi\x1b[2J vps\x03', de: PC }).ok, true)
    rede = 'caiu'
    assert.equal((await empurrar()).ok, false)
    assert.equal(naFila().length, 1)
    assert.equal(caixa(), '')
  })
  await t('rede de volta: chega à caixa do ouvido da sessão da VPS, limpo, e sai da fila', async () => {
    rede = 'ok'
    const r = await empurrar()
    assert.equal(r.ok, true)
    assert.equal(caixa(), 'oi vps')
    assert.equal(naFila().length, 0)
  })
  await t('recibo perdido: o PC manda de novo e a VPS não entrega duas vezes', async () => {
    fs.rmSync(path.join(dir, `${CONV}.txt`), { force: true })
    F.pedirMensagem({ paraMaquina: VPS, conversa: CONV, texto: 'segunda', de: PC })
    rede = 'recibo-perdido'
    assert.equal((await empurrar()).ok, false)
    assert.equal(caixa(), 'segunda')
    assert.equal(naFila().length, 1, 'sem recibo o pedido fica')
    rede = 'ok'
    assert.equal((await empurrar()).ok, true)
    assert.equal(caixa(), 'segunda', 'o mesmo id não entra na caixa de novo')
    assert.equal(naFila().length, 0, 'o recibo do repetido tira da fila')
  })
  await t('VPS de versão velha não devolve recibo: o pedido fica e vence sozinho', async () => {
    F.pedirMensagem({ paraMaquina: VPS, conversa: CONV, texto: 'terceira', de: PC })
    rede = 'velha'
    assert.equal((await empurrar()).ok, true)
    assert.equal(naFila().length, 1)
    assert.equal(F.pedidosParaLevar(PC, Date.now() + F.VALIDADE_PEDIDO_MS + 1).length, 0)
  })
  await t('pedido para outra máquina viaja mas não é entregue nem confirmado por esta', async () => {
    rede = 'ok'
    corpos = []
    fs.rmSync(path.join(dir, `${CONV}.txt`), { force: true })
    F.pedirMensagem({ paraMaquina: 'OUTRA', conversa: CONV, texto: 'nao e pra vps', de: PC })
    await empurrar()
    assert.equal(caixa(), 'terceira', 'só a da VPS entrou')
    assert.deepEqual(naFila().map((p) => p.paraMaquina), ['OUTRA'])
  })
  await t('pacote sem o campo continua aceito; campo sujo é recortado', () => {
    assert.deepEqual(F.validarPacote({ maquina: { id: 'pcv' } }).pedidosParaVoce, [])
    const sujo = F.validarPacote({ maquina: { id: 'pcv' }, pedidosParaVoce: [
      { id: '../x', acao: 'mensagem', paraMaquina: VPS, conversa: CONV, texto: 'a' },
      { id: 'abc123-x', acao: 'sessao', paraMaquina: VPS, projeto: 'p' },
      { id: 'abc123-y', acao: 'mensagem', paraMaquina: VPS, conversa: '../etc', texto: 'a' },
      { id: 'abc123-z', acao: 'mensagem', paraMaquina: VPS, conversa: CONV, tecla: 'Enter' },
      { id: 'abc123-w', acao: 'mensagem', paraMaquina: VPS, conversa: CONV, tecla: 'parar' },
    ] }).pedidosParaVoce
    assert.deepEqual(sujo.map((p) => p.id), ['abc123-w'])
  })
  await t('o web.mjs da VPS recebe e responde pela mesma conta que o teste cobre', () => {
    const web = fs.readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
    assert.match(web, /receberPedidosParaVoce\(pedidosParaVoce, origemLocal\(readConfig\(\)\)\?\.nome\)/)
    assert.match(web, /atenderPedidos\(chegados\.novos\)/)
    assert.match(web, /pedidosRecebidos: chegados\.ids/)
  })
} finally {
  fs.rmSync(base, { recursive: true, force: true })
}
console.log(`test-pedidos-para-voce: ${ok} verificações, 0 falhas`)
