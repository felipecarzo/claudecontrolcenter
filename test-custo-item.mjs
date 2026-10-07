// CC-900: o custo do item sai das marcas do diário, só com par completo da mesma sessão
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { custos, marcar, transcritoDe, contadorDe } from './src/custoItem.mjs'
import * as B from './src/backlog.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const m = (id, estado, sessao, tokens) => ({ tipo: 'medida', id, estado, sessao, tokens })

t('entrada e saída da mesma sessão dão o custo; vários ciclos somam', () => {
  const c = custos([m('A', 'EM', 's1', 100), m('A', 'PR', 's1', 400), m('A', 'EM', 's1', 500), m('A', 'OK', 's1', 650)])
  assert.equal(c.get('A'), 450)
})
t('sem par completo, ou saída de outra sessão, não inventa custo', () => {
  const c = custos([m('B', 'EM', 's1', 100), m('B', 'OK', 's2', 900), m('C', 'OK', 's1', 300), m('D', 'EM', 's3', 10)])
  assert.equal(c.has('B'), false); assert.equal(c.has('C'), false); assert.equal(c.has('D'), false)
})
t('contador recomeçado (diferença negativa) é descartado', () => {
  assert.equal(custos([m('E', 'EM', 's1', 900), m('E', 'OK', 's1', 100)]).has('E'), false)
})
t('marcar lê o transcrito da sessão e grava a medida no diário do projeto', () => {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'custo-'))
  const sessao = '11111111-2222-3333-4444-555555555555'
  const pasta = path.join(casa, 'projects', '-x'); fs.mkdirSync(pasta, { recursive: true })
  const linha = (o) => JSON.stringify({ type: 'assistant', timestamp: '2026-10-04T10:00:00Z', message: { model: 'claude-opus-5', usage: { input_tokens: 5, output_tokens: o, cache_creation_input_tokens: 10, cache_read_input_tokens: 99999 } } })
  fs.writeFileSync(path.join(pasta, sessao + '.jsonl'), linha(100) + '\n' + linha(50) + '\n')
  const antes = process.env.CC_HOME; process.env.CC_HOME = casa
  try {
    const arq = transcritoDe(sessao, casa); assert.ok(arq)
    assert.equal(contadorDe(arq), 170, 'saída mais escrita, sem a releitura')
    const proj = path.join(casa, 'proj', 'docs'); fs.mkdirSync(proj, { recursive: true })
    const back = path.join(proj, 'backlog.jsonl'); fs.writeFileSync(back, '')
    assert.equal(marcar('X-1', 'EM', { arquivo: back, sessao }), 170)
    const evs = fs.readFileSync(B.caminhoEventos(back), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    assert.ok(evs.every((e) => e.tipo === 'medida' && e.tokens === 170))
    assert.equal(marcar('X-1', 'B1', { arquivo: back, sessao }), null, 'só entrada e saída de andamento são medidas')
    assert.equal(marcar('X-1', 'EM', { arquivo: back, sessao: 'nao-e-sessao' }), null, 'fora de uma sessão do Claude Code não grava nada')
  } finally { if (antes === undefined) delete process.env.CC_HOME; else process.env.CC_HOME = antes; fs.rmSync(casa, { recursive: true, force: true }) }
})
