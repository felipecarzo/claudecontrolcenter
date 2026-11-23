/**
 * CC-1122: PC e VPS não escolhem o mesmo número de item.
 * As duas pontas no mesmo processo, cada uma com a sua casa (`CC_HOME`) e o seu backlog.
 *
 *   node test-backlog-numero.mjs
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { acrescentar, maioresDoArquivo, renumerar, idsRepetidos, ler, gravar, caminhoEventos } from './src/backlog.mjs'
import { montarPacote, validarPacote, gravarPacote, maiorIdConhecido, recortarMaioresIds } from './src/federacao.mjs'

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1122-'))
const casaVps = path.join(raiz, 'casa-vps')
const casaPc = path.join(raiz, 'casa-pc')
const arqVps = path.join(raiz, 'vps', 'cockpit', 'docs', 'backlog.jsonl')
// pasta com prefixo de tipo no PC: o nome canônico tem de casar com o `cockpit` da VPS
const arqPc = path.join(raiz, 'pc', 'proj_cockpit', 'docs', 'backlog.jsonl')
const VPS = { id: 'vps11111', nome: 'VPS' }
const PC = { id: 'pc222222', nome: 'PC' }
const item = (t, extra = {}) => ({ intencao: t, frente: 'sincronia', natureza: 'DEF', area: 'dado', tamanho: 'P', pronto: 'o numero nao repete', conferir: 'auto:teste', ...extra })
const em = (casa) => { process.env.CC_HOME = casa }
// o que sai de uma ponta e chega na outra: montado, serializado, validado e gravado como na rede
const viajar = (de, arq, para) => {
  const pac = montarPacote({ maquina: de, maioresIds: [{ projeto: path.basename(path.dirname(path.dirname(arq))), maiorId: maioresDoArquivo(arq) }] })
  em(para)
  const v = validarPacote(JSON.parse(JSON.stringify(pac)))
  assert.equal(v.ok, true)
  gravarPacote(v.pacote)
}

try {
  // as duas começam iguais, no CC-1120
  em(casaVps); acrescentar(item('base', { id: 'CC-1120' }), arqVps)
  em(casaPc); acrescentar(item('base', { id: 'CC-1120' }), arqPc)

  // sem dado da outra máquina, continua como antes: maior local + 1
  em(casaVps)
  assert.equal(acrescentar(item('na vps'), arqVps).id, 'CC-1121')
  ok('sem dado da outra máquina, o número é o maior local mais 1')

  // a VPS manda o retrato, o PC cria o próximo e ganha 1122 (antes do conserto, 1121 repetido)
  viajar(VPS, arqVps, casaPc)
  assert.equal(maiorIdConhecido('proj_cockpit', 'CC'), 1121)
  assert.equal(acrescentar(item('no pc'), arqPc).id, 'CC-1122')
  ok('VPS cria 1121, o resumo chega ao PC, o PC cria 1122')

  // e o caminho contrário: o PC empurra, a VPS cria 1123
  viajar(PC, arqPc, casaVps)
  assert.equal(acrescentar(item('na vps de novo'), arqVps).id, 'CC-1123')
  ok('PC cria 1122, o pacote chega à VPS, a VPS cria 1123')

  // outro prefixo e outro projeto não contam
  em(casaPc)
  assert.equal(maiorIdConhecido('cockpit', 'XY'), 0)
  assert.equal(maiorIdConhecido('outro', 'CC'), 0)
  ok('outro prefixo ou outro projeto não empurram o número')

  // versão velha, sem o campo: aceita, e herda o que já tinha chegado
  em(casaPc)
  const velho = validarPacote({ maquina: VPS, jobs: [] })
  assert.equal(velho.ok, true)
  assert.equal(velho.pacote.maioresIds, null)
  gravarPacote(velho.pacote)
  assert.equal(maiorIdConhecido('cockpit', 'CC'), 1121, 'pacote sem o campo não apaga o número que já chegou')
  em(path.join(raiz, 'casa-vazia'))
  gravarPacote(validarPacote({ maquina: VPS }).pacote)
  assert.equal(maiorIdConhecido('cockpit', 'CC'), 0)
  ok('pacote de versão velha, sem o campo, continua aceito e não zera o que já se sabia')

  // rede entrando em disco: o lixo é recortado
  const sujo = recortarMaioresIds([{ projeto: 'cockpit', maiorId: { CC: 5, cc: 9, XYZWQ: 3, DN: -1, AB: 1.5, EF: '7', GH: 2 } }, { projeto: '', maiorId: { CC: 1 } }, 'lixo'])
  assert.deepEqual(sujo, [{ projeto: 'cockpit', maiorId: { CC: 5, GH: 2 } }])
  assert.equal(recortarMaioresIds('não é lista'), null)
  ok('o campo é recortado como rede: prefixo e número válidos, o resto cai')

  // renumerar troca o item, os eventos e as referências; recusa destino ocupado
  em(casaPc)
  acrescentar(item('filha', { pai: 'CC-1122' }), arqPc)
  const r = renumerar('CC-1122', 'CC-1130', arqPc)
  assert.deepEqual(r, { id: 'CC-1130', antes: 'CC-1122', repetido: false })
  const depois = ler(arqPc).itens
  assert.ok(depois.some((i) => i.id === 'CC-1130') && !depois.some((i) => i.id === 'CC-1122'))
  assert.equal(depois.find((i) => i.intencao === 'filha').pai, 'CC-1130')
  const eventos = fs.readFileSync(caminhoEventos(arqPc), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  assert.ok(!eventos.some((e) => e.id === 'CC-1122'), 'nenhum evento fica no id velho')
  assert.ok(eventos.some((e) => e.id === 'CC-1130' && e.tipo === 'criada'))
  assert.ok(eventos.some((e) => e.id === 'CC-1130' && e.tipo === 'renumerada' && e.antes === 'CC-1122'))
  assert.throws(() => renumerar('CC-1130', 'CC-1120', arqPc), /já existe/)
  assert.throws(() => renumerar('CC-9999', 'CC-9998', arqPc), /não achei/)
  assert.throws(() => renumerar('CC-1130', 'lixo', arqPc), /fora do formato/)
  ok('renumerar troca item, eventos e pai, e recusa destino ocupado')

  // a colisão que escapou (depois de um pull) aparece, e renumerar troca a última ocorrência
  const arqDup = path.join(raiz, 'dup', 'docs', 'backlog.jsonl')
  const base = ler(arqPc).itens[0]
  gravar([{ ...base, id: 'CC-7', intencao: 'do pc' }, { ...base, id: 'CC-7', intencao: 'da vps' }], arqDup)
  assert.deepEqual(idsRepetidos(ler(arqDup).itens), ['CC-7'])
  assert.equal(renumerar('CC-7', 'CC-8', arqDup).repetido, true)
  assert.deepEqual(ler(arqDup).itens.map((i) => [i.id, i.intencao]), [['CC-7', 'do pc'], ['CC-8', 'da vps']])
  assert.deepEqual(idsRepetidos(ler(arqDup).itens), [])
  ok('id repetido no arquivo é achado, e renumerar desfaz a colisão')
} finally {
  fs.rmSync(raiz, { recursive: true, force: true })
}

console.log(`\n${n} verificações, 0 falhas`)
