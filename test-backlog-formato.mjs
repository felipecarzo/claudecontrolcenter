// O formato novo do item, decidido por ele em 11/09: natureza, área, tamanho,
// intenção, pronto e conferir obrigatórios; trava e risco quando o caso aparece.
//
// O que este arquivo protege, e é o que mais importa: os 543 itens que já
// existem continuam válidos. A cobrança vale na CRIAÇÃO e para item que já
// está no formato, nunca para o fechado antes da virada.
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  NATUREZAS, AREAS, TAMANHOS, MODOS_DE_CONFERIR, MODOS_DE_TRAVA, RISCOS,
  problemas, problemasDoFormato, noFormatoNovo, comoSeLe, acrescentar, ler,
} from './src/backlog.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok += 1; console.log(`  ok  ${nome}`) }
const casa = mkdtempSync(path.join(tmpdir(), 'backlog-formato-'))
const arq = path.join(casa, 'backlog.jsonl')

const bom = {
  natureza: 'PED', area: 'tela', tamanho: 'M',
  intencao: 'a tela do leitor diario, com o que fechou sozinho',
  pronto: 'abrir a tela e ver as tres listas com dado de hoje',
  conferir: 'olho:as tres listas preenchidas',
  frente: 'framework',
}

t('o vocabulário é fechado e tem os códigos que ele escolheu', () => {
  assert.deepEqual(NATUREZAS.map((n) => n.codigo), ['DEF', 'PED', 'DEC', 'MED', 'DOC'])
  assert.deepEqual(AREAS.map((a) => a.codigo), ['dado', 'tela', 'agente', 'maquinas', 'trava', 'texto'])
  assert.deepEqual(TAMANHOS.map((x) => x.codigo), ['P', 'M', 'G'])
  assert.deepEqual(MODOS_DE_CONFERIR, ['auto', 'olho', 'dele'])
  assert.deepEqual(MODOS_DE_TRAVA, ['dele', 'item', 'mundo'])
  assert.deepEqual(RISCOS.map((r) => r.codigo), ['local', 'compartilhado', 'cliente'])
})

t('item completo passa', () => {
  assert.deepEqual(problemasDoFormato(bom), [])
  assert.equal(noFormatoNovo(bom), true)
})

t('falta cada campo obrigatório, e a recusa diz qual', () => {
  for (const campo of ['natureza', 'area', 'tamanho', 'intencao', 'pronto', 'conferir']) {
    const p = problemasDoFormato({ ...bom, [campo]: null })
    assert.ok(p.some((x) => x.includes(campo)), `${campo}: a recusa não nomeia o campo (${p.join('; ')})`)
  }
})

t('código fora do vocabulário é recusado, não aceito calado', () => {
  assert.ok(problemasDoFormato({ ...bom, natureza: 'XYZ' })[0].includes('natureza desconhecida'))
  assert.ok(problemasDoFormato({ ...bom, area: 'backend' })[0].includes('area desconhecida'))
  assert.ok(problemasDoFormato({ ...bom, tamanho: 'XG' })[0].includes('tamanho fora da escala'))
  assert.ok(problemasDoFormato({ ...bom, risco: 'medio' })[0].includes('risco desconhecido'))
})

t('a intenção tem teto de 140, que é o que separa código de prosa', () => {
  const p = problemasDoFormato({ ...bom, intencao: 'x'.repeat(141) })
  assert.ok(p[0].includes('141'), p.join('; '))
  assert.deepEqual(problemasDoFormato({ ...bom, intencao: 'x'.repeat(140) }), [])
})

t('conferir diz o modo E o quê', () => {
  assert.deepEqual(problemasDoFormato({ ...bom, conferir: 'auto:npm test' }), [])
  assert.deepEqual(problemasDoFormato({ ...bom, conferir: 'dele:confirmar no telefone' }), [])
  assert.ok(problemasDoFormato({ ...bom, conferir: 'talvez:sei la' })[0].includes('conferir começa por'))
  assert.ok(problemasDoFormato({ ...bom, conferir: 'olho:' })[0].includes('sem dizer o quê'))
})

t('trava aceita os três modos, e cobra o quê quando não é dele', () => {
  assert.deepEqual(problemasDoFormato({ ...bom, trava: 'dele' }), [])
  assert.deepEqual(problemasDoFormato({ ...bom, trava: 'item:CC-340' }), [])
  assert.deepEqual(problemasDoFormato({ ...bom, trava: 'mundo:o cliente nao respondeu' }), [])
  assert.ok(problemasDoFormato({ ...bom, trava: 'chefe:ele' })[0].includes('trava começa por'))
  assert.ok(problemasDoFormato({ ...bom, trava: 'mundo:' })[0].includes('sem dizer o quê'))
})

t('item ANTIGO continua válido: a virada não transforma história em erro', () => {
  const antigo = { id: 'CC-1', titulo: 'o que era escrito em prosa', estado: 'OK', frente: 'fundacao', prova: 'testei' }
  assert.deepEqual(problemas(antigo), [], 'item de antes não pode virar erro')
  assert.equal(noFormatoNovo(antigo), false)
  assert.equal(comoSeLe(antigo), 'o que era escrito em prosa')
})

t('item MEIO no formato é cobrado, porque prometeu e não cumpriu', () => {
  const meio = { id: 'CC-2', titulo: 'x', estado: 'B1', frente: 'f', natureza: 'PED', area: 'tela', conferir: 'olho:x' }
  const p = problemas(meio)
  assert.ok(p.some((x) => x.includes('tamanho')), p.join('; '))
  assert.ok(p.some((x) => x.includes('pronto')), p.join('; '))
})

t('o que a tela lê é natureza, área e intenção, sem título livre', () => {
  assert.equal(comoSeLe({ ...bom, id: 'CC-9' }), 'PED tela: a tela do leitor diario, com o que fechou sozinho')
})

t('item novo não nasce fora do formato', () => {
  writeFileSync(arq, '')
  assert.throws(() => acrescentar({ titulo: 'so prosa', frente: 'f' }, arq), /falta natureza/)
  const i = acrescentar({ ...bom }, arq)
  assert.equal(i.natureza, 'PED')
  assert.equal(i.titulo, bom.intencao, 'sem título, ele nasce da intenção')
  assert.equal(ler(arq).ruins.length, 0)
})

t('a recusa não repete a mesma queixa duas vezes', () => {
  writeFileSync(arq, '')
  try {
    acrescentar({ ...bom, intencao: 'x'.repeat(200) }, arq)
    assert.fail('devia recusar')
  } catch (e) {
    const vezes = (e.message.match(/o teto é 140/g) || []).length
    assert.equal(vezes, 1, `a queixa saiu ${vezes} vezes: ${e.message}`)
  }
})

t('a porta da migração existe e é declarada', () => {
  writeFileSync(arq, '')
  const i = acrescentar({ titulo: 'veio da prosa', frente: 'f', permitirAntigo: true }, arq)
  assert.equal(i.titulo, 'veio da prosa')
  assert.equal(noFormatoNovo(i), false)
})

rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} ok, 0 falhas (backlog formato)`)
