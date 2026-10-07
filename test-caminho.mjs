// CC-896: o caminho do projeto sai do backlog: frente é trecho, frente sem item aberto é marco
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as B from './src/backlog.mjs'
import { caminhoDe, projetosComCaminho } from './src/caminho.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'caminho-'))
const raiz = path.join(base, 'VPS_demo'); fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
const item = (id, frente, estado, criado, extra = {}) => ({ id, titulo: `item ${id}`, intencao: `item ${id}`, estado, frente, criado, mexido: criado, depende: [], origem: 'agente', ...(estado === 'KO' ? { porque: 'x' } : {}), ...extra })
B.gravar([
  item('DM-1', 'site', 'OK', '2026-09-01'), item('DM-2', 'site', 'OK', '2026-09-02'), item('DM-3', 'site', 'KO', '2026-09-02'),
  item('DM-4', 'loja', 'OK', '2026-09-10'), item('DM-5', 'loja', 'EM', '2026-09-11'), item('DM-6', 'loja', 'B1', '2026-09-12'),
  item('DM-7', 'pagamento', 'B0', '2026-09-20'),
], path.join(raiz, 'docs', 'backlog.jsonl'))

t('frente sem item aberto é marco; cancelado sai da conta; a estrada é cronológica', () => {
  const c = caminhoDe(raiz)
  assert.deepEqual(c.trechos.map((x) => x.frente), ['site', 'loja', 'pagamento'])
  assert.equal(c.trechos[0].completo, true); assert.equal(c.trechos[0].total, 2); assert.equal(c.trechos[0].cancelados, 1)
  assert.equal(c.marcos, 1); assert.equal(c.feitos, 3); assert.equal(c.total, 6); assert.equal(c.pct, 50)
})
t('onde estamos: o trecho com trabalho andando; sem nenhum, o primeiro com algo aberto', () => {
  assert.equal(caminhoDe(raiz).atual, 1)
  const itens = B.ler(path.join(raiz, 'docs', 'backlog.jsonl')).itens; itens.find((i) => i.id === 'DM-5').estado = 'B1'
  B.gravar(itens, path.join(raiz, 'docs', 'backlog.jsonl')); assert.equal(caminhoDe(raiz).atual, 1)
})
t('os itens do trecho vêm com o que anda primeiro', () => {
  const l = caminhoDe(raiz).trechos[1]
  assert.equal(l.itens[0].estado === 'EM' || l.itens[0].estado === 'B1', true); assert.ok(l.itens.some((i) => i.estado === 'OK'))
})
t('projeto sem backlog é dito, e a lista só traz quem tem o que mostrar', () => {
  assert.equal(caminhoDe(base).ok, false)
  const l = projetosComCaminho([{ raiz }, { raiz: base }]); assert.equal(l.length, 1); assert.equal(l[0].nome, 'demo')
})
t('muitas frentes sem catálogo: ficam as maiores e o resto vira "Outras frentes"', () => {
  const r2 = path.join(base, 'VPS_muitas'); fs.mkdirSync(path.join(r2, 'docs'), { recursive: true })
  B.gravar(Array.from({ length: 14 }, (_, n) => item(`MU-${n + 1}`, `f${n}`, n % 2 ? 'OK' : 'B1', `2026-09-${String(n + 1).padStart(2, '0')}`)), path.join(r2, 'docs', 'backlog.jsonl'))
  const c = caminhoDe(r2); assert.equal(c.trechos.length, 10); assert.equal(c.trechos.at(-1).frente, 'Outras frentes'); assert.equal(c.total, 14)
})
t('CC-958: fora do MVP sai da estrada e vira seção guardada; o item com lugar leva o rótulo', () => {
  const r3 = path.join(base, 'VPS_lugar'); fs.mkdirSync(path.join(r3, 'docs'), { recursive: true })
  B.gravar([
    item('LG-1', 'site', 'B1', '2026-09-01', { lugar: { onde: 'dia', em: new Date().toISOString() } }),
    item('LG-2', 'site', 'B1', '2026-09-02', { titulo: '(depois do MVP) importar do Garmin', intencao: undefined }),
    item('LG-3', 'site', 'OK', '2026-09-03', { prova: 'ok' }),
  ], path.join(r3, 'docs', 'backlog.jsonl'))
  const c = caminhoDe(r3)
  assert.equal(c.total, 2)
  assert.deepEqual(c.foraDoMvp.itens.map((i) => i.id), ['LG-2']); assert.equal(c.foraDoMvp.itens[0].lugar, 'fora')
  assert.equal(c.trechos[0].itens.find((i) => i.id === 'LG-1').lugarRot, 'fim do dia')
  assert.equal(c.lugares.length, 5)
})
fs.rmSync(base, { recursive: true, force: true })
