// CC-915: o que os backlogs dos projetos esperam DELE entra na fila de tarefas dele
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as B from './src/backlog.mjs'
import { motivoDeEspera, pendencias, resolver, _limpar } from './src/esperaDele.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'espera-'))
const raiz = path.join(base, 'VPS_demo'); fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
const arq = path.join(raiz, 'docs', 'backlog.jsonl')
const it = (id, estado, extra = {}) => ({ id, titulo: `item ${id}`, intencao: `item ${id}`, estado, frente: 'site', criado: '2026-10-01', mexido: '2026-10-03', depende: [], origem: 'agente', ...extra })
B.gravar([
  it('DM-001', 'DE', { decisao: 'qual banco usar?' }), it('DM-002', 'B1', { trava: 'dele' }), it('DM-003', 'B1', { trava: 'item:DM-009' }),
  it('DM-004', 'PR', { conferir: 'dele: abrir no celular', prova: 'robô passou; falta ele' }), it('DM-005', 'PR', { conferir: 'auto:npm test' }),
  it('DM-006', 'OK', { conferir: 'dele: x', prova: 'x' }), it('DM-007', 'EM'),
], arq)

t('só o que espera por ele conta: decisão, trava dele e prova a conferir por ele', () => {
  const m = (id) => motivoDeEspera(B.ler(arq).itens.find((i) => i.id === id))
  assert.equal(m('DM-001'), 'decidir'); assert.equal(m('DM-002'), 'destravar'); assert.equal(m('DM-004'), 'conferir')
  for (const id of ['DM-003', 'DM-005', 'DM-006', 'DM-007']) assert.equal(m(id), null, id + ' não espera por ele')
})
t('a pendência diz o que ele faz, com o projeto e o item', () => {
  _limpar(); const l = pendencias({ raizes: [raiz] })
  assert.deepEqual(l.map((x) => x.item).sort(), ['DM-001', 'DM-002', 'DM-004'])
  const d = l.find((x) => x.item === 'DM-001'); assert.match(d.texto, /^Decidir: qual banco usar/); assert.equal(d.projeto, 'VPS_demo'); assert.equal(d.id, 'backlog:VPS_demo:DM-001')
  assert.match(l.find((x) => x.item === 'DM-004').texto, /^Conferir: /); assert.match(l.find((x) => x.item === 'DM-002').texto, /^Destravar: /)
})
t('conferir fecha o item com a prova dele; decisão e trava recusam o visto', () => {
  assert.equal(resolver('backlog:VPS_demo:DM-001', { raizes: [raiz] }).ok, false)
  assert.match(resolver('backlog:VPS_demo:DM-002', { raizes: [raiz] }).erro, /trava/)
  assert.equal(resolver('backlog:VPS_demo:DM-004', { raizes: [raiz] }).ok, true)
  const i = B.ler(arq).itens.find((x) => x.id === 'DM-004'); assert.equal(i.estado, 'OK'); assert.match(i.prova, /^dele: conferiu pelo painel/)
  _limpar(); assert.equal(pendencias({ raizes: [raiz] }).some((x) => x.item === 'DM-004'), false, 'sai da fila depois de conferido')
})
t('id que não é do backlog ou projeto desconhecido não faz nada', () => {
  assert.equal(resolver('abc123', { raizes: [raiz] }).ok, false); assert.equal(resolver('backlog:outro:DM-001', { raizes: [raiz] }).ok, false)
})
fs.rmSync(base, { recursive: true, force: true })
