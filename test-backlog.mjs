/**
 * O backlog em dado: as travas que ele existe para ter.
 *
 * Roda numa pasta temporária, nunca no backlog de verdade. A lição já foi paga
 * neste projeto: o gate escrevia nas notas reais do Felipe e é candidato à
 * causa do apagamento de 2026-08-09.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { acrescentar, comoMarkdown, ESTADOS, fechadosNosCommits, gravar, ler, mover, problemas, proximoId, retrato, sincronizarComCommits } from './src/backlog.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok++; console.log('  ok  ', nome) }
const recusa = (nome, fn, trecho) => {
  let erro = null
  try { fn() } catch (e) { erro = e }
  assert.ok(erro, `${nome}: devia ter recusado e não recusou`)
  if (trecho) assert.ok(String(erro.message).includes(trecho), `${nome}: recusou por outro motivo: ${erro.message}`)
  ok++
  console.log('  ok  ', nome)
}

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-backlog-'))
const arq = path.join(casa, 'docs', 'backlog.jsonl')

console.log('\nbacklog em dado\n')

t('arquivo que não existe devolve vazio, sem explodir', () => {
  const r = ler(path.join(casa, 'nao-existe.jsonl'))
  assert.deepEqual(r.itens, [])
  assert.equal(r.existe, false)
})

t('acrescentar grava e devolve o item', () => {
  const i = acrescentar({ titulo: 'a fundação', frente: 'fundacao', estado: 'B1', peso: 3 }, arq)
  assert.equal(i.id, 'CC-1')
  assert.equal(i.estado, 'B1')
  assert.equal(ler(arq).itens.length, 1)
})

t('o id anda sozinho e nunca reusa número', () => {
  acrescentar({ titulo: 'segundo', frente: 'fundacao' }, arq)
  const { itens } = ler(arq)
  assert.equal(itens[1].id, 'CC-2')
  assert.equal(proximoId(itens), 'CC-3')
})

recusa('fechar sem prova é recusado', () => mover('CC-1', 'OK', {}, arq), 'sem prova')

t('fechar COM prova passa, e carimba a data', () => {
  const i = mover('CC-1', 'OK', { prova: 'gate verde e captura em 390px' }, arq)
  assert.equal(i.estado, 'OK')
  assert.ok(i.fechado, 'devia ter carimbado a data de fechamento')
})

recusa('cancelar sem motivo é recusado', () => mover('CC-2', 'KO', {}, arq), 'sem motivo')
recusa('travar sem a causa é recusado', () => mover('CC-2', 'TR', {}, arq), 'sem a causa')
recusa('esperar decisão dele sem dizer qual é recusado', () => mover('CC-2', 'DE', {}, arq), 'sem dizer qual')
recusa('estado inventado é recusado', () => mover('CC-2', 'ZZ', {}, arq), 'estado desconhecido')
recusa('id repetido é recusado', () => acrescentar({ id: 'CC-1', titulo: 'clone', frente: 'x' }, arq), 'id repetido')
recusa('peso fora da escala é recusado', () => acrescentar({ titulo: 'x', frente: 'y', peso: 4 }, arq), 'peso fora da escala')

t('item sem campo obrigatório é apontado, não engolido', () => {
  const p = problemas({ id: 'CC-9' })
  assert.ok(p.some((x) => x.includes('titulo')), 'devia cobrar o titulo')
  assert.ok(p.some((x) => x.includes('frente')), 'devia cobrar a frente')
})

t('id fora do formato é apontado', () => {
  assert.ok(problemas({ id: 'banana', titulo: 't', estado: 'B0', frente: 'f' }).some((x) => x.includes('formato')))
})

t('linha quebrada não derruba a leitura, e aparece na lista de ruins', () => {
  const sujo = path.join(casa, 'sujo.jsonl')
  fs.writeFileSync(sujo, '{"id":"CC-1","titulo":"bom","estado":"B0","frente":"f"}\n{quebrado\n', 'utf8')
  const r = ler(sujo)
  assert.equal(r.itens.length, 1, 'o item bom tem que sobreviver')
  assert.equal(r.ruins.length, 1, 'o ruim tem que ser contado')
})

t('CRLF é lido igual, porque os arquivos daqui são CRLF', () => {
  const crlf = path.join(casa, 'crlf.jsonl')
  fs.writeFileSync(crlf, '{"id":"CC-1","titulo":"um","estado":"B0","frente":"f"}\r\n{"id":"CC-2","titulo":"dois","estado":"B0","frente":"f"}\r\n', 'utf8')
  assert.equal(ler(crlf).itens.length, 2)
})

t('o retrato separa aberto de fechado e agrupa por frente', () => {
  const r = retrato(arq)
  assert.equal(r.total, 2)
  assert.equal(r.fechados, 1)
  assert.equal(r.abertos, 1)
  assert.equal(r.frentes.length, 1)
})

t('o markdown gerado avisa que é saída, não fonte', () => {
  const md = comoMarkdown(arq)
  assert.ok(md.includes('NÃO EDITE'), 'sem o aviso, alguém edita o markdown e nasce a segunda verdade')
  assert.ok(md.includes('CC-2'), 'o item aberto tem que aparecer')
})

t('todo estado tem código, rótulo e lugar na esteira', () => {
  for (const e of ESTADOS) {
    assert.ok(e.codigo && e.rotulo && e.desc, `estado incompleto: ${JSON.stringify(e)}`)
    assert.equal(typeof e.esteira, 'number')
  }
  assert.equal(new Set(ESTADOS.map((e) => e.codigo)).size, ESTADOS.length, 'código repetido')
})

t('o commit que diz "fecha CC-x" fecha, e a mensagem vira a prova', () => {
  const arq2 = path.join(casa, 'sync.jsonl')
  gravar([
    { id: 'CC-1', titulo: 'um', estado: 'B1', frente: 'f' },
    { id: 'CC-2', titulo: 'dois', estado: 'B1', frente: 'f' },
  ], arq2)
  const r = sincronizarComCommits(['feat(x): a coisa nova, fecha CC-1'], { arquivo: arq2 })
  assert.equal(r.feitos.length, 1)
  const i = ler(arq2).itens.find((x) => x.id === 'CC-1')
  assert.equal(i.estado, 'OK')
  assert.ok(i.prova.includes('commit:'), 'a mensagem do commit tinha que virar a prova')
  assert.equal(ler(arq2).itens.find((x) => x.id === 'CC-2').estado, 'B1', 'fechou item que ninguém citou')
})

t('⚠️ CITAR o id no commit NÃO fecha: só a forma explícita conta', () => {
  const arq3 = path.join(casa, 'sync2.jsonl')
  gravar([{ id: 'CC-1', titulo: 'um', estado: 'B1', frente: 'f' }], arq3)
  const r = sincronizarComCommits(['fix: mesmo defeito do CC-1, mas em outro lugar'], { arquivo: arq3 })
  assert.deepEqual(r.feitos, [], 'citação virou fechamento, e o quadro encheria de trabalho falso')
  assert.equal(ler(arq3).itens[0].estado, 'B1')
})

t('as formas de fechar que o commit aceita', () => {
  for (const frase of ['fecha CC-9', 'fechou CC-9', 'closes CC-9', 'resolve CC-9', 'Fecha CC-9']) {
    assert.ok(fechadosNosCommits([frase]).has('CC-9'), `não reconheceu: ${frase}`)
  }
})

t('sincronizar em ensaio não grava', () => {
  const arq4 = path.join(casa, 'sync3.jsonl')
  gravar([{ id: 'CC-1', titulo: 'um', estado: 'B1', frente: 'f' }], arq4)
  const r = sincronizarComCommits(['fecha CC-1'], { arquivo: arq4, ensaio: true })
  assert.equal(r.feitos[0].acao, 'fecharia', 'ensaio dizendo que fez faz ele não rodar de verdade')
  assert.equal(ler(arq4).itens[0].estado, 'B1', 'ensaio gravou')
})

t('a gravação ordena por número, não por ordem de chegada', () => {
  const fora = path.join(casa, 'ordem.jsonl')
  gravar([{ id: 'CC-10', titulo: 'a', estado: 'B0', frente: 'f' }, { id: 'CC-2', titulo: 'b', estado: 'B0', frente: 'f' }], fora)
  assert.deepEqual(ler(fora).itens.map((i) => i.id), ['CC-2', 'CC-10'])
})

fs.rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas\n`)
