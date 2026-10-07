// CC-526: projeto ativo parado há mais de 7 dias aparece no leitor do dia; os outros não
import assert from 'node:assert/strict'
import { projetosParados, ultimoMovimentoDe } from './src/parados.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const agora = Date.parse('2026-10-02T12:00:00Z')
const diasAtras = (n) => agora - n * 86400e3

t('CC-526: parado há 8 dias aparece com o número de dias; parado há 6 não', () => {
  const r = projetosParados([
    { id: 'a', nome: 'a', ativo: true, ultimoMovimento: diasAtras(8) },
    { id: 'b', nome: 'b', ativo: true, ultimoMovimento: diasAtras(6) },
  ], { agora })
  assert.deepEqual(r, [{ id: 'a', nome: 'a', dias: 8 }])
})
t('CC-526: inativo já marcado por ele não volta a perguntar, e sem sinal de movimento não se inventa o número', () => {
  const r = projetosParados([
    { id: 'c', nome: 'c', ativo: false, ultimoMovimento: diasAtras(30) },
    { id: 'd', nome: 'd', ativo: true, ultimoMovimento: null },
  ], { agora })
  assert.deepEqual(r, [])
})
t('CC-526: do mais parado para o menos', () => {
  const r = projetosParados([
    { id: 'x', nome: 'x', ativo: true, ultimoMovimento: diasAtras(9) },
    { id: 'y', nome: 'y', ativo: true, ultimoMovimento: diasAtras(40) },
  ], { agora })
  assert.deepEqual(r.map((p) => p.id), ['y', 'x'])
})
t('CC-526: o movimento vem do backlog quando não há git (projeto que só trabalha em item)', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-parados-'))
  fs.mkdirSync(path.join(pasta, 'docs'))
  fs.writeFileSync(path.join(pasta, 'docs', 'backlog.jsonl'), '{"id":"CC-1","mexido":"2026-09-20"}\n{"id":"CC-2","mexido":"2026-09-25"}\n')
  assert.equal(ultimoMovimentoDe(pasta), Date.parse('2026-09-25T12:00:00Z'))
  fs.rmSync(pasta, { recursive: true, force: true })
})
