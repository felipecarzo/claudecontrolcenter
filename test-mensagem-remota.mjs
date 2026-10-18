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
  t('18/10: painel antigo (contrato 0) não consome a mensagem; ela fica para o painel novo', () => {
    F.pedirMensagem({ paraMaquina: 'PCVELHO', conversa: CONV, texto: 'para o novo' })
    assert.equal(F.pegarPedidos('PCVELHO', Date.now(), { contrato: 0 }).filter((x) => x.acao === 'mensagem').length, 0, 'o velho não leva')
    assert.equal(F.pegarPedidos('PCVELHO', Date.now(), { contrato: 1 }).filter((x) => x.acao === 'mensagem').length, 1, 'o novo leva')
  })
  t('18/10: pacote de contrato menor não apaga o de contrato maior guardado agora há pouco', () => {
    const novo = F.validarPacote({ ...F.montarPacote({ maquina: { id: 'pcdois', nome: 'PCD' }, jobs: [{ id: 'sess0001', terminal: true }] }) }).pacote
    F.gravarPacote(novo)
    const velho = F.validarPacote({ ...F.montarPacote({ maquina: { id: 'pcdois', nome: 'PCD' }, jobs: [{ id: 'sess0001' }] }), contrato: 0 }).pacote
    assert.equal(velho.contrato, 0)
    F.gravarPacote(velho)
    const g = JSON.parse(fs.readFileSync(path.join(F.dirFederacao(), 'pcdois.json'), 'utf8'))
    assert.equal(g.jobs[0].terminal, true, 'a marca do novo continua')
  })
  t('pacote leve sem completo antes não inventa nada', () => {
    const leve = F.validarPacote({ ...F.montarPacote({ maquina: { id: 'pcteste2', nome: 'PC2' }, jobs: [{ id: 'so000001' }] }), leve: true }).pacote
    F.gravarPacote(leve)
    const g = JSON.parse(fs.readFileSync(path.join(F.dirFederacao(), 'pcteste2.json'), 'utf8'))
    assert.deepEqual(g.jobs.map((j) => j.id), ['so000001'])
  })
  t('ciclo curto: acelera com permissão aberta, com ele olhando a outra máquina ou com sessão no terminal do painel', () => {
    const agora = 1_000_000
    const base = { agora, ultimoEnvioEm: agora - 2500 }
    assert.equal(F.cicloCurto({ ...base }), false, 'parado: só o ciclo normal')
    assert.equal(F.cicloCurto({ ...base, abertos: 1 }), true)
    assert.equal(F.cicloCurto({ ...base, vendoAte: agora + 5000 }), true)
    assert.equal(F.cicloCurto({ ...base, temTerminal: true }), false, 'sessão no terminal só acelera com 3 s de folga')
    assert.equal(F.cicloCurto({ agora, ultimoEnvioEm: agora - 3000, temTerminal: true }), true)
    assert.equal(F.cicloCurto({ agora, ultimoEnvioEm: agora - 1500, abertos: 1 }), false, 'nunca mais de um a cada 2 s')
  })
  t('a conversa da sessão no terminal viaja no pacote, só dela, e a outra máquina a acha pelo id curto', () => {
    const itens = [{ tipo: 'voce', texto: 'oi', em: 'a' }, { tipo: 'agente', texto: 'pronto', em: 'b' }]
    const p = F.montarPacote({ maquina: { id: 'pcteste3', nome: 'PC3' }, jobs: [
      { id: '94abc8ea', sessionId: CONV, terminal: true, conversaApp: { itens, modelo: 'opus' } },
      { id: 'semterm1', terminal: false, conversaApp: { itens, modelo: 'x' } },
    ] })
    assert.deepEqual(p.jobs[0].conversaApp.itens, itens)
    assert.equal(p.jobs[1].conversaApp, null, 'quem não mora no terminal do painel não leva a conversa')
    const via = F.validarPacote(JSON.parse(JSON.stringify(p))).pacote
    const o = F.conversaDeOutraMaquina(CONV, [via])
    assert.equal(o.maquina, 'PC3'); assert.deepEqual(o.itens, itens); assert.equal(o.modelo, 'opus')
    assert.equal(F.conversaDeOutraMaquina('94abc8ea', [via]).maquina, 'PC3')
    assert.equal(F.conversaDeOutraMaquina('ffffffff-0000', [via]), null)
    assert.equal(F.conversaDeOutraMaquina('8ebb', [via]), null)
  })
  t('o pacote leva a marca de sessão que aceita texto', () => {
    const p = F.montarPacote({ maquina: { id: 'pc', nome: 'PC' }, jobs: [{ id: 'a', terminal: true }, { id: 'b' }] })
    assert.equal(p.jobs[0].terminal, true)
    assert.equal(p.jobs[1].terminal, false)
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
// CC-1060 M6: a tela usa a marca do servidor, e o parar do cartão também vai para a fila da outra máquina
{
  const ui = fs.readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const web = fs.readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes('(daqui || e.escreve)') && ui.includes('((daqui || s.escreve) && s.conversa ? c2MsgForm') && ui.includes("(s.estado === 'trabalhando' && (daqui || s.escreve) && s.conversa"), 'M6: campo e parar aparecem para a sessão do PC que aceita texto')
  ok++; console.log('  ok  M6: campo de mensagem e parar no cartão da sessão do PC')
  const parar = web.slice(web.indexOf("'/api/decisao/parar'"), web.indexOf("'/api/decisao/parar'") + 900)
  assert.ok(/maquinaDaConversa\(conversa\)[\s\S]*pedirMensagem\(\{ paraMaquina: longe, conversa, tecla: 'parar'/.test(parar), 'M6: o parar do cartão encaminha para a fila da outra máquina')
  ok++; console.log('  ok  M6: parar do cartão vai na fila da outra máquina')
  // 18/10: o retrato não marcava, e o último pacote a chegar apagava a marca. Toda montagem tem de marcar.
  const montagens = web.split('montarPacote({').slice(1).map((t) => t.slice(0, t.indexOf('})')))
  assert.ok(montagens.length >= 3 && montagens.every((t) => t.includes('marcarNoTerminal(')), 'todo pacote (leve, completo e retrato) marca quem mora num terminal do painel')
  ok++; console.log('  ok  os ' + montagens.length + ' pacotes marcam quem mora num terminal do painel')
}
console.log(`test-mensagem-remota: ${ok} verificações, 0 falhas`)

/* CC-1060: o recorte da conversa que vai no pacote (assíncrono, fora do bloco acima). */
{
  const C = await import('./src/cockpit2.mjs')
  const casa2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-conv-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa2
  try {
    const id = 'aaaaaaaa-1111-2222-3333-444444444444'
    const dir = path.join(casa2, 'projects', 'D--teste'); fs.mkdirSync(dir, { recursive: true })
    const linhas = []
    for (let i = 0; i < 80; i += 1) {
      linhas.push(JSON.stringify({ type: 'user', timestamp: `2026-10-18T10:${String(i % 60).padStart(2, '0')}:00Z`, message: { content: `pergunta ${i} ` + 'x'.repeat(4000) } }))
      linhas.push(JSON.stringify({ type: 'assistant', timestamp: `2026-10-18T10:${String(i % 60).padStart(2, '0')}:30Z`, message: { model: 'opus', content: [{ type: 'text', text: `resposta ${i}` }] } }))
    }
    fs.writeFileSync(path.join(dir, id + '.jsonl'), linhas.join('\n') + '\n')
    const r = C.conversaParaPacote(id)
    assert.ok(r && r.itens.length <= 30, 'no máximo 30 mensagens')
    assert.ok(r.itens.every((i) => i.texto.length <= 1500), 'cada mensagem cortada em 1500')
    assert.ok(JSON.stringify(r.itens).length <= C.TETO_CONVERSA_PACOTE, 'respeita o teto do pacote')
    assert.match(r.itens[r.itens.length - 1].texto, /resposta 79/, 'o que fica é o fim da conversa')
    assert.equal(C.conversaParaPacote('bbbbbbbb-0000-0000-0000-000000000000'), null)
    console.log('  ok  o recorte da conversa tem no máximo 30 mensagens, cortadas, dentro do teto, e guarda o fim')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME; else process.env.CC_HOME = antes
    fs.rmSync(casa2, { recursive: true, force: true })
  }
}
