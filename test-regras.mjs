/**
 * As regras que a VPS declara e o PC obedece: as travas.
 *
 * Plano de Unificação, aprovado por ele em 11/09 na forma completa. O que este
 * arquivo guarda são as quatro travas que impedem a declaração remota de virar
 * estrago, e cada uma delas veio de um erro já pago neste projeto.
 *
 * Roda em casa temporária (`CC_HOME`), nunca no config de verdade.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-regras-'))
process.env.CC_HOME = casa

const { CAMPOS, aplicadas, declarar, declaracoesPara, diferencas, esquecer, registrar } = await import('./src/regras.mjs')

let ok = 0
const t = (nome, fn) => { fn(); ok++; console.log('  ok  ', nome) }

const arq = path.join(casa, 'regras.json')
const diario = path.join(casa, 'aplicadas.jsonl')

console.log('\nas regras que a VPS declara e o PC obedece\n')

t('declarar grava, e o outro lado lê o que foi declarado', () => {
  const r = declarar({ maquina: 'PC', projeto: 'cockpit', regras: { modo: 'continuativo', ligado: true } }, { arquivo: arq })
  assert.equal(r.ok, true, r.erro)
  const d = declaracoesPara('PC', { arquivo: arq })
  assert.equal(d.cockpit.regras.modo, 'continuativo')
  assert.ok(d.cockpit.em, 'sem a hora, a trava da escolha local não tem como funcionar')
})

t('⚠️ TRAVA 1: campo ausente não muda nada, e não é "desligue"', () => {
  const decl = { cockpit: { regras: { modo: 'sugestivo' }, em: '2026-09-11T10:00:00.000Z' } }
  const local = { cockpit: { modo: 'sugestivo', ligado: true, mexidoEm: '2026-09-11T09:00:00.000Z' } }
  const d = diferencas(decl, local)
  assert.deepEqual(d, [], 'a declaração não falou de `ligado`, então `ligado` não pode mudar')
})

t('campo declarado E diferente vira uma mudança', () => {
  const decl = { cockpit: { regras: { modo: 'restritivo' }, em: '2026-09-11T10:00:00.000Z' } }
  const local = { cockpit: { modo: 'sugestivo', mexidoEm: '2026-09-11T09:00:00.000Z' } }
  const d = diferencas(decl, local)
  assert.equal(d.length, 1)
  assert.equal(d[0].campo, 'modo')
  assert.equal(d[0].de, 'sugestivo')
  assert.equal(d[0].para, 'restritivo')
})

t('⚠️ TRAVA 2: escolha local feita DEPOIS vence, até a próxima declaração', () => {
  const decl = { cockpit: { regras: { modo: 'restritivo' }, em: '2026-09-11T10:00:00.000Z' } }
  const local = { cockpit: { modo: 'sugestivo', mexidoEm: '2026-09-11T11:00:00.000Z' } }
  const d = diferencas(decl, local)
  assert.equal(d.length, 1)
  assert.ok(d[0].pulou.includes('escolha local'), `devia ter pulado: ${JSON.stringify(d[0])}`)
  assert.equal(d[0].para, undefined, 'não pode propor mudança quando a escolha local é mais nova')
})

t('declaração mais nova que a escolha local volta a valer', () => {
  const decl = { cockpit: { regras: { modo: 'restritivo' }, em: '2026-09-11T12:00:00.000Z' } }
  const local = { cockpit: { modo: 'sugestivo', mexidoEm: '2026-09-11T11:00:00.000Z' } }
  assert.equal(diferencas(decl, local)[0].para, 'restritivo')
})

t('⚠️ TRAVA 4: modo que não existe é recusado na hora de declarar', () => {
  const r = declarar({ maquina: 'PC', projeto: 'x', regras: { modo: 'inventado' } }, { arquivo: arq, modos: ['sugestivo', 'restritivo'] })
  assert.equal(r.ok, false)
  assert.ok(r.erro.includes('modo desconhecido'), `recusou por outro motivo: ${r.erro}`)
})

t('campo que não existe é recusado, com a lista do que vale', () => {
  const r = declarar({ maquina: 'PC', projeto: 'x', regras: { banana: 1 } }, { arquivo: arq })
  assert.equal(r.ok, false)
  assert.ok(r.erro.includes('campo desconhecido'))
  assert.ok(CAMPOS.every((c) => r.erro.includes(c)), 'a recusa tem que dizer o que vale')
})

t('módulo que não existe é recusado', () => {
  const r = declarar({ maquina: 'PC', projeto: 'x', regras: { modulos: { inventado: true } } }, { arquivo: arq, modulos: ['codigo', 'entrega'] })
  assert.equal(r.ok, false)
  assert.ok(r.erro.includes('módulo desconhecido'))
})

t('módulo ligado ou desligado vira mudança, um por um', () => {
  const decl = { cockpit: { regras: { modulos: { codigo: false, entrega: true } }, em: '2026-09-11T10:00:00.000Z' } }
  const local = { cockpit: { modulos: { codigo: true, entrega: true }, mexidoEm: '2026-09-11T09:00:00.000Z' } }
  const d = diferencas(decl, local)
  assert.equal(d.length, 1, 'só o que difere vira mudança')
  assert.equal(d[0].modulo, 'codigo')
  assert.equal(d[0].para, false)
})

t('projeto que não existe nesta máquina é reportado, não ignorado', () => {
  const decl = { fantasma: { regras: { modo: 'restritivo' }, em: '2026-09-11T10:00:00.000Z' } }
  const d = diferencas(decl, { cockpit: { modo: 'sugestivo' } })
  assert.equal(d.length, 1)
  assert.ok(d[0].pulou.includes('não existe'), 'declaração para projeto inexistente tem que aparecer, senão some calada')
})

t('⚠️ TRAVA 3: o que foi aplicado fica registrado, com a máquina de origem', () => {
  registrar([{ projeto: 'cockpit', campo: 'modo', de: 'sugestivo', para: 'restritivo' }], { de: 'VPS', arquivo: diario })
  const linhas = aplicadas({ arquivo: diario })
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].de_maquina, 'VPS', 'sem a origem, ele não tem como saber por que mudou')
  assert.ok(linhas[0].em, 'sem a hora, o registro não serve para investigar')
})

t('o registro tem teto e não cresce para sempre', () => {
  const d2 = path.join(casa, 'teto.jsonl')
  for (let i = 0; i < 12; i++) registrar([{ projeto: 'p', campo: 'modo', para: String(i) }], { arquivo: d2, teto: 5 })
  const linhas = fs.readFileSync(d2, 'utf8').split(/\r?\n/).filter(Boolean)
  assert.ok(linhas.length <= 5, `passou do teto: ${linhas.length}`)
})

t('esquecer tira a declaração, e declarar não é caminho sem volta', () => {
  declarar({ maquina: 'PC2', projeto: 'y', regras: { ligado: true } }, { arquivo: arq })
  assert.ok(declaracoesPara('PC2', { arquivo: arq }).y)
  esquecer({ maquina: 'PC2', projeto: 'y' }, { arquivo: arq })
  assert.deepEqual(declaracoesPara('PC2', { arquivo: arq }), {})
})

t('arquivo corrompido não derruba: devolve vazio', () => {
  const ruim = path.join(casa, 'ruim.json')
  fs.writeFileSync(ruim, '{quebrado', 'utf8')
  assert.deepEqual(declaracoesPara('PC', { arquivo: ruim }), {})
})

t('sem declaração nenhuma, nada muda', () => {
  assert.deepEqual(diferencas({}, { cockpit: { modo: 'sugestivo' } }), [])
})

fs.rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas\n`)
