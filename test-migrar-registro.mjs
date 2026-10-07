// CC-544: as pastas que já existem viram entradas do registro, sem duplicata e sem sumiço
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrar } from './src/migrarRegistro.mjs'
import * as R from './src/projetoRegistro.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-migrar-reg-'))
const arquivo = path.join(casa, 'registro.json')
const pastas = ['/p/VPS_alfa', '/p/PC_alfa', '/p/VPS_beta', '/p/proj_gama', '/p/VPS_cockpit--front', '/p/VPS_cockpit']
const ativoDe = (raiz) => raiz.endsWith('VPS_beta')

t('CC-544: ensaio não grava nada e conta o que faria', () => {
  const r = migrar({ pastas, maquina: 'VPS', arquivo, ensaio: true, ativoDe })
  assert.equal(r.ok, true); assert.equal(R.listar({ arquivo }).length, 0)
  assert.equal(r.plano.novos.length, 5, 'alfa (VPS_ e PC_ são o mesmo), beta, gama, cockpit e cockpit--front')
})
t('CC-544: grava uma entrada por projeto, casando o prefixo de máquina, com ativo pela regra de commits', () => {
  const r = migrar({ pastas, maquina: 'VPS', arquivo, ativoDe })
  assert.equal(r.ok, true); assert.equal(r.antes, 0); assert.equal(r.depois, 5); assert.equal(r.ids, 5, 'nenhum id repetido')
  const lista = R.listar({ arquivo })
  assert.equal(lista.filter((p) => p.id === 'alfa').length, 1)
  assert.equal(R.achar('beta', { arquivo }).ativo, true); assert.equal(R.achar('gama', { arquivo }).ativo, false)
  assert.equal(R.achar('alfa', { arquivo }).maquinas.VPS.provisionado, true)
  assert.ok(R.achar('cockpit-front', { arquivo }), 'o sufixo não é rótulo: outra pasta, outro projeto')
})
t('CC-544: rodar de novo não duplica nem apaga o que ele já mexeu', () => {
  R.atualizarDados('gama', { cliente: 'Zé', ativo: true }, { arquivo })
  const r = migrar({ pastas, maquina: 'VPS', arquivo, ativoDe })
  assert.equal(r.plano.novos.length, 0); assert.equal(r.depois, 5)
  const g = R.achar('gama', { arquivo }); assert.equal(g.cliente, 'Zé'); assert.equal(g.ativo, true)
})
t('CC-544: o PC completa a entrada que a VPS já criou, sem criar outra', () => {
  const r = migrar({ pastas: ['/c/PC_alfa'], maquina: 'PC', arquivo, ativoDe })
  assert.equal(r.plano.novos.length, 0); assert.equal(r.plano.completar.length, 1); assert.equal(r.depois, 5)
  assert.deepEqual(Object.keys(R.achar('alfa', { arquivo }).maquinas).sort(), ['PC', 'VPS'])
})
fs.rmSync(casa, { recursive: true, force: true })
