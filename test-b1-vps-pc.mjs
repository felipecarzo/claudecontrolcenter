// CC-1114 (caminho B1): texto digitado no cockpit da VPS chega à sessão do PC aberta num terminal do painel,
// e a conversa que volta no pacote mostra a mensagem. As duas pontas no mesmo processo, terminal falso.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-b1-'))
process.env.CC_HOME = casa
const F = await import('./src/federacao.mjs')
const D = await import('./src/decisao.mjs')
const C2 = await import('./src/cockpit2.mjs')

let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok  ${nome}`) }
const PC = 'PC-TESTE'
const CONV = 'b1b1b1b1-1111-2222-3333-444455556666'
const dir = path.join(casa, 'projects', 'D--teste'); fs.mkdirSync(dir, { recursive: true })
const arq = path.join(dir, CONV + '.jsonl')
fs.writeFileSync(arq, JSON.stringify({ type: 'assistant', timestamp: '2026-11-22T10:00:00Z', message: { model: 'opus', content: [{ type: 'text', text: 'pronto, quer que eu siga?' }] } }) + '\n')

// O terminal falso do PC: digitar guarda, Enter grava a fala no transcrito como o Claude Code faria.
const digitado = []
let campo = ''
const deps = {
  sessoes: async () => ({ teste: { sessao: 'wez:4', conversa: CONV } }),
  lerTranscrito: () => fs.readFileSync(arq, 'utf8'),
  capturar: async () => '❯ ',
  escrever: async (_s, texto) => { digitado.push(texto); campo = texto; return { ok: true } },
  apertar: async (_s, tecla) => {
    if (tecla === 'Enter' && campo) { fs.appendFileSync(arq, JSON.stringify({ type: 'user', timestamp: '2026-11-22T10:01:00Z', message: { content: campo } }) + '\n'); campo = '' }
    return { ok: true }
  },
  esperar: async () => {},
  aberta: () => true,
}
const doPC = { sessoes: deps.sessoes, enviar: (a) => D.enviarMensagem(a, deps), apertarTecla: async () => ({ ok: true }) }
const pacoteDoPC = () => F.validarPacote(JSON.parse(JSON.stringify(F.montarPacote({
  maquina: { id: 'pcteste-b1', nome: PC },
  jobs: [{ id: CONV.slice(0, 8), sessionId: CONV, terminal: true, conversaApp: C2.conversaParaPacote(CONV) }],
})))).pacote

try {
  await t('a VPS recebe o pacote do PC e sabe que a conversa é dele', () => {
    F.gravarPacote(pacoteDoPC())
    assert.equal(F.maquinaDaConversa(CONV), PC)
  })
  await t('VPS enfileira, PC busca e entrega no terminal do painel; o texto chega sem caractere de controle', async () => {
    const r = F.pedirMensagem({ paraMaquina: F.maquinaDaConversa(CONV), conversa: CONV, texto: 'segue\x1b[2J com\x03 o "plano"\nagora\x07', de: 'VPS' })
    assert.equal(r.ok, true)
    const pedidos = F.pegarPedidos(PC).filter((p) => p.acao === 'mensagem')
    assert.equal(pedidos.length, 1)
    const e = await F.entregarMensagemRemota(pedidos[0], doPC)
    assert.equal(e.ok, true, e.erro)
    assert.deepEqual(digitado, ['segue com o "plano" agora'])
  })
  await t('a conversa que volta no pacote seguinte mostra a mensagem na VPS', () => {
    F.gravarPacote(pacoteDoPC())
    const c = F.conversaDeOutraMaquina(CONV)
    assert.equal(c.maquina, PC)
    assert.match(c.itens[c.itens.length - 1].texto, /segue com o "plano" agora/)
  })
  await t('sessão que não mora no terminal do painel (a do aplicativo) é recusada sem digitar nada', async () => {
    const antes = digitado.length
    const outra = 'cccccccc-1111-2222-3333-444455556666'
    const r = await F.entregarMensagemRemota({ acao: 'mensagem', conversa: outra, texto: 'oi' }, doPC)
    assert.equal(r.ok, false)
    assert.equal(digitado.length, antes)
  })
  await t('VPS de versão velha mandando texto cru: o PC limpa de novo antes de digitar', async () => {
    const r = await F.entregarMensagemRemota({ acao: 'mensagem', conversa: CONV.slice(0, 8), texto: '\x1b[31mvermelho\x1b[0m\x03' }, doPC)
    assert.equal(r.ok, true, r.erro)
    assert.equal(digitado[digitado.length - 1], 'vermelho')
  })
  await t('tecla fora da lista, conversa inválida e texto só de controle são recusados', async () => {
    assert.equal((await F.entregarMensagemRemota({ conversa: CONV, tecla: 'Enter' }, doPC)).ok, false)
    assert.equal((await F.entregarMensagemRemota({ conversa: '../x', texto: 'oi' }, doPC)).ok, false)
    assert.equal((await F.entregarMensagemRemota({ conversa: CONV, texto: '\x03\x1b[2J' }, doPC)).ok, false)
    assert.equal(F.pedirMensagem({ paraMaquina: PC, conversa: CONV, texto: '\x03\x07' }).ok, false)
  })
  await t('pacote velho, sem o campo terminal, continua aceito e a sessão fica só leitura', () => {
    const v = F.validarPacote(JSON.parse(JSON.stringify({ ...F.montarPacote({ maquina: { id: 'pcvelho-b1', nome: 'PCV' }, jobs: [{ id: 'dddddddd' }] }) })))
    assert.equal(v.ok !== false, true)
    assert.equal(Boolean(v.pacote.jobs[0].terminal), false)
  })
  await t('o web.mjs do PC entrega pela mesma função que o teste cobre', () => {
    const web = fs.readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
    assert.match(web, /entregarMensagemRemota\(p, \{ sessoes: estadoRemoto, enviar: mensagemDecisao, apertarTecla: teclaSessao \}\)/)
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`test-b1-vps-pc: ${ok} verificações, 0 falhas`)
