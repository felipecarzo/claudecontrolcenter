// CC-1060, M4: mensagem digitada no Cockpit de uma máquina para uma sessão da outra.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-msg-'))
process.env.CC_HOME = casa
const F = await import('./src/federacao.mjs')

let ok = 0
const t = (nome, fn) => { fn(); ok += 1; console.log(`  ok  ${nome}`) }
const CONV = '94abc8ea-1111-2222-3333-444455556666'

try {
  t('mensagem válida entra na fila, para a máquina certa, sem projeto nem caminho', () => {
    const r = F.pedirMensagem({ paraMaquina: 'ALIENWARE-LIPE', conversa: CONV, texto: '  segue com o plano  ', de: 'VPS' })
    assert.equal(r.ok, true)
    const p = F.pedidosPendentes().find((x) => x.acao === 'mensagem')
    assert.equal(p.paraMaquina, 'ALIENWARE-LIPE')
    assert.equal(p.texto, 'segue com o plano')
    assert.equal(p.projeto, undefined)
  })
  t('tecla só da lista fechada', () => {
    assert.equal(F.pedirMensagem({ paraMaquina: 'PC', conversa: CONV, tecla: 'parar' }).ok, true)
    assert.equal(F.pedirMensagem({ paraMaquina: 'PC', conversa: CONV, tecla: 'Enter' }).ok, false)
  })
  t('recusa conversa inválida, texto vazio e máquina vazia', () => {
    assert.equal(F.pedirMensagem({ paraMaquina: 'PC', conversa: '../x', texto: 'oi' }).ok, false)
    assert.equal(F.pedirMensagem({ paraMaquina: 'PC', conversa: CONV, texto: '   ' }).ok, false)
    assert.equal(F.pedirMensagem({ paraMaquina: '', conversa: CONV, texto: 'oi' }).ok, false)
  })
  t('texto longo é cortado no teto', () => {
    F.pedirMensagem({ paraMaquina: 'PC2', conversa: CONV, texto: 'a'.repeat(F.TETO_MENSAGEM + 50) })
    assert.equal(F.pedidosPendentes().find((x) => x.paraMaquina === 'PC2').texto.length, F.TETO_MENSAGEM)
  })
  t('a fila só entrega à máquina de destino, e consome', () => {
    assert.equal(F.pegarPedidos('VPS').filter((x) => x.acao === 'mensagem').length, 0)
    assert.ok(F.pegarPedidos('ALIENWARE-LIPE').some((x) => x.acao === 'mensagem'))
    assert.equal(F.pegarPedidos('ALIENWARE-LIPE').filter((x) => x.acao === 'mensagem').length, 0)
  })
  t('acha a máquina da conversa pelo id curto do pacote, e nada com id curto demais', () => {
    const pacotes = [{ maquina: { nome: 'ALIENWARE-LIPE' }, jobs: [{ id: '94abc8ea' }] }, { maquina: { nome: 'VPS' }, jobs: [{ id: '1269cc08', sessionId: '1269cc08-aaaa' }] }]
    assert.equal(F.maquinaDaConversa(CONV, pacotes), 'ALIENWARE-LIPE')
    assert.equal(F.maquinaDaConversa('1269cc08-aaaa', pacotes), 'VPS')
    assert.equal(F.maquinaDaConversa('94ab', pacotes), null)
    assert.equal(F.maquinaDaConversa('ffffffff-0000', pacotes), null)
  })
  t('pacote leve troca só sessões e permissões, e o resto fica o do último completo', () => {
    const cheio = F.validarPacote(F.montarPacote({
      maquina: { id: 'pcteste1', nome: 'PC' }, jobs: [{ id: 'velho001' }],
      servidores: [{ pid: 1, name: 'dev', ports: [3000] }], travas: { a: 1 }, framework: [{ projeto: 'x' }],
      uso: { cinco: 10 },
    })).pacote
    F.gravarPacote(cheio)
    const antes = JSON.parse(fs.readFileSync(path.join(F.dirFederacao(), 'pcteste1.json'), 'utf8'))
    const leve = F.validarPacote({ ...F.montarPacote({ maquina: { id: 'pcteste1', nome: 'PC' }, jobs: [{ id: 'novo0001', status: 'working' }], servidores: null }), leve: true }).pacote
    assert.equal(leve.leve, true)
    F.gravarPacote(leve)
    const depois = JSON.parse(fs.readFileSync(path.join(F.dirFederacao(), 'pcteste1.json'), 'utf8'))
    assert.deepEqual(depois.jobs.map((j) => j.id), ['novo0001'])
    assert.deepEqual(depois.servidores, antes.servidores)
    assert.deepEqual(depois.travas, antes.travas)
    assert.deepEqual(depois.framework, antes.framework)
    assert.deepEqual(depois.uso, antes.uso)
    assert.deepEqual(depois.idades, antes.idades)
  })
  t('pacote leve sem completo antes não inventa nada', () => {
    const leve = F.validarPacote({ ...F.montarPacote({ maquina: { id: 'pcteste2', nome: 'PC2' }, jobs: [{ id: 'so000001' }] }), leve: true }).pacote
    F.gravarPacote(leve)
    const g = JSON.parse(fs.readFileSync(path.join(F.dirFederacao(), 'pcteste2.json'), 'utf8'))
    assert.deepEqual(g.jobs.map((j) => j.id), ['so000001'])
  })
  t('o pacote leva a marca de sessão que aceita texto', () => {
    const p = F.montarPacote({ maquina: { id: 'pc', nome: 'PC' }, jobs: [{ id: 'a', terminal: true }, { id: 'b' }] })
    assert.equal(p.jobs[0].terminal, true)
    assert.equal(p.jobs[1].terminal, false)
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`test-mensagem-remota: ${ok} verificações, 0 falhas`)
