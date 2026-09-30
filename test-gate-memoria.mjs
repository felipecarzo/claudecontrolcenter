/* CC-698 e CC-697: memória do opencode no Coderoom e o sinal do turno aberto.
 *
 * Roda numa casa temporária (CC_HOME): teste que escreve em dado real dele é
 * defeito, mesmo com restauração no fim. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-gate-mem-'))
process.env.CC_HOME = casa
// CC-731: turno de mentira que termina "pronto" não pode pedir nome ao agy de verdade
process.env.CC_SEM_AGY = '1'
const G = await import('./src/gate.mjs')
const A = await import('./src/gateAgentes.mjs')

let ok = 0
const passa = (nome, fn) => { fn(); ok++; console.log('  ok', nome) }

try {
  const { id } = G.criar({ titulo: 't', projeto: 'p', cwd: casa })
  G.acrescentar(id, { tipo: 'dele', texto: 'primeira' })
  G.acrescentar(id, { tipo: 'turno', turnoId: 'a', agente: 'opencode' })
  G.acrescentar(id, { tipo: 'pedaco', turnoId: 'a', texto: 'resposta do opencode' })
  G.acrescentar(id, { tipo: 'fim', turnoId: 'a', estado: 'pronto' })
  const ate = G.lerConversa(id).ultimoSeq
  G.gravarCabecalho(id, { sessoes: { opencode: 'ses_x', agy: 'conv_y' } })
  G.marcarLido(id, 'opencode', ate)
  G.marcarLido(id, 'agy', ate)
  G.acrescentar(id, { tipo: 'dele', texto: 'segunda' })

  passa('opencode com sessao recebe so o que falta', () => {
    const d = G.deltaPara(id, 'opencode')
    assert.ok(d.texto.includes('segunda'))
    assert.ok(!d.texto.includes('primeira'))
    assert.ok(!d.texto.includes('resposta do opencode'))
  })
  passa('CC-716: opencode em flash recebe a conversa inteira e vai pelo servidor, sem sessao', () => {
    const d = G.deltaPara(id, 'opencode', { semMemoria: true })
    assert.ok(d.texto.includes('primeira') && d.texto.includes('segunda'))
    const a = A.AGENTES_GATE.opencode.args({ flash: true, sessao: 'ses_x', cwd: '/p/proj' })
    assert.deepEqual(a.slice(a.indexOf('--attach'), a.indexOf('--attach') + 4), ['--attach', A.OC_URL, '--dir', '/p/proj'])
    assert.ok(!a.includes('--session'))
  })
  passa('CC-718: modo avulso recebe so a ultima mensagem dele', () => {
    const d = G.deltaPara(id, 'opencode', { semMemoria: true, soUltima: true })
    assert.ok(d.texto.includes('segunda'))
    assert.ok(!d.texto.includes('primeira') && !d.texto.includes('resposta do opencode'))
  })
  passa('agy, mesmo com id guardado, recebe a conversa inteira', () => {
    const d = G.deltaPara(id, 'agy')
    assert.ok(d.texto.includes('primeira') && d.texto.includes('segunda'))
  })

  passa('o id da sessao do opencode sai da resposta e vai no --session', () => {
    const log = path.join(casa, 'oc.jsonl')
    fs.writeFileSync(log, JSON.stringify({ type: 'text', sessionID: 'ses_abc', part: { text: 'OK' } }) + '\n')
    assert.equal(A.lerTurno(log, 'opencode').sessao, 'ses_abc')
    const args = A.AGENTES_GATE.opencode.args({ sessao: 'ses_abc' })
    assert.deepEqual(args.slice(args.indexOf('--session'), args.indexOf('--session') + 2), ['--session', 'ses_abc'])
  })
  passa('turno do opencode fecha pronto no step_finish com reason stop, somando o gasto', () => {
    const log = path.join(casa, 'oc-fim.jsonl')
    const fim = (reason, input) => JSON.stringify({ type: 'step_finish', sessionID: 's', part: { reason, cost: 0, tokens: { input, output: 2, cache: { read: 10, write: 0 } } } })
    fs.writeFileSync(log, fim('tool-calls', 100) + '\n')
    assert.equal(A.lerTurno(log, 'opencode').terminou, false)
    fs.appendFileSync(log, fim('stop', 50) + '\n')
    const r = A.lerTurno(log, 'opencode')
    assert.equal(r.estado, 'pronto')
    assert.equal(r.custo.entrada, 150)
  })
  passa('sessao perdida do opencode e detectada', () => {
    const log = path.join(casa, 'oc2.jsonl'); const err = path.join(casa, 'oc2.err')
    fs.writeFileSync(log, ''); fs.writeFileSync(err, 'Error: Session not found\n')
    assert.equal(A.lerTurno(log, 'opencode', err).sessaoPerdida, true)
  })

  passa('turno aberto informa a hora do ultimo sinal', () => {
    const log = path.join(casa, 'vivo.jsonl'); fs.writeFileSync(log, '{}\n')
    G.gravarCabecalho(id, { estado: { turnoId: 'b', logFile: log } })
    const s = G.lerConversa(id).sinalEm
    assert.ok(Number.isFinite(s) && Math.abs(Date.now() - s) < 60000)
    G.gravarCabecalho(id, { estado: null })
    assert.equal(G.lerConversa(id).sinalEm, null)
  })
  /* CC-700: agente que sobreviveu ao reinício volta a ser acompanhado. */
  const T = await import('./src/gateTurno.mjs')
  const { id: id2 } = G.criar({ titulo: 't2', projeto: 'p', cwd: casa })
  G.acrescentar(id2, { tipo: 'dele', texto: 'oi' })
  G.acrescentar(id2, { tipo: 'turno', turnoId: 'r1', agente: 'claude' })
  const logR = path.join(casa, 'sobrevivente.jsonl')
  fs.writeFileSync(logR, [
    { type: 'assistant', message: { content: [{ type: 'text', text: 'terminei depois do reinicio' }] } },
    { type: 'result', subtype: 'success', session_id: 'sess-r', duration_ms: 1000, usage: {} },
  ].map((o) => JSON.stringify(o)).join('\n') + '\n')
  G.gravarCabecalho(id2, { estado: { turnoId: 'r1', agente: 'claude', pid: process.pid, desde: Date.now(), logFile: logR, ate: 1 } })
  assert.equal(T.retomar(id2), true)
  await new Promise((r) => setTimeout(r, 900))
  passa('turno retomado depois do reinicio fecha pronto, com o texto e a sessao', () => {
    const c = G.lerConversa(id2)
    const m = c.mensagens.find((x) => x.turnoId === 'r1')
    assert.equal(m.estado, 'pronto'); assert.equal(m.texto, 'terminei depois do reinicio')
    assert.equal(c.turnoAberto, null); assert.equal(c.cabecalho.sessoes.claude, 'sess-r')
  })
  /* CC-701: revisão em dupla, com um agente de mentira que responde pelo texto. */
  const falso = path.join(casa, 'agente-falso.mjs')
  fs.writeFileSync(falso, `#!/usr/bin/env node
let e = ''; process.stdin.on('data', (d) => (e += d)).on('end', () => {
  const t = /pediu REVISÃO/.test(e) ? (/\\[ok\\]/.test(e) ? 'REVISÃO OK, atende.' : 'REVISÃO: PROBLEMAS\\n- faltou o teste')
    : /revisou sua última resposta/.test(e) ? 'corrigido' : 'feito ' + (e.match(/\\[ok\\]/) ? '[ok]' : '')
  console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: t }] } }))
  console.log(JSON.stringify({ type: 'result', subtype: 'success', duration_ms: 1, usage: {} }))
})`)
  fs.chmodSync(falso, 0o755)
  const rodar = async (texto) => {
    const { id: cid } = G.criar({ titulo: 'rev', projeto: 'p', cwd: casa })
    T.responder(cid, { texto, agente: 'claude', binario: falso, revisar: true })
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 200))
      const c = G.lerConversa(cid)
      if (!c.turnoAberto && c.mensagens.length >= 4 && i > 10) return c.mensagens
    }
    return G.lerConversa(cid).mensagens
  }
  const comProblema = await rodar('faça a coisa')
  passa('revisao que aponta problema volta UMA vez ao autor, e ele corrige', () => {
    const agentes = comProblema.filter((m) => m.de !== 'felipe' && m.de !== 'sistema').map((m) => `${m.de}:${m.texto.split('\n')[0]}`)
    assert.deepEqual(agentes, ['claude:feito ', 'agy:REVISÃO: PROBLEMAS', 'claude:corrigido'])
  })
  const aprovada = await rodar('faça a coisa [ok]')
  passa('revisao OK encerra ali, sem volta ao autor', () => {
    const agentes = aprovada.filter((m) => m.de !== 'felipe' && m.de !== 'sistema').map((m) => m.de)
    assert.deepEqual(agentes, ['claude', 'agy'])
  })
  passa('CC-714: projeto em Planejamento sobe os tres agentes no modo de plano', () => {
    const proj = path.join(casa, 'proj-plano'); fs.mkdirSync(path.join(proj, '.framework'), { recursive: true })
    fs.writeFileSync(path.join(proj, '.framework', 'estado.json'), JSON.stringify({ ligado: true, modo: 'planejamento' }))
    assert.equal(T.modoDoProjeto(proj), 'planejamento')
    const cl = A.AGENTES_GATE.claude.args({ somenteLer: true, permissao: 'pergunteAntes', cwd: proj, novaSessao: 'x' })
    assert.equal(cl[cl.indexOf('--permission-mode') + 1], 'plan')
    assert.ok(!cl.includes('--settings'), 'plano vence o pergunte antes')
  })
  passa('o revisor vai em modo de leitura nos dois agentes', () => {
    assert.ok(A.AGENTES_GATE.agy.args({ somenteLer: true }).join(' ').includes('--mode plan'))
    assert.ok(A.AGENTES_GATE.opencode.args({ somenteLer: true }).join(' ').includes('--agent plan'))
    assert.equal(T.revisorPara('agy'), 'opencode'); assert.equal(T.revisorPara('claude'), 'agy')
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`test-gate-memoria: ${ok} verificações, 0 falhas`)
