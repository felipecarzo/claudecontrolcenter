/**
 * Testes da federação. Rodam em qualquer máquina, sem rede e sem job real.
 *
 *   node test-federacao.mjs
 */
import assert from 'node:assert'
import {
  LIMITE_PACOTE, SEM_CONTATO_MS, carimbar, maquinasConhecidas, mesclar,
  mesclarTempo, montarPacote, validarPacote,
} from './src/federacao.mjs'

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

const LOCAL = { id: 'aaa11111', nome: 'VPS' }
const PC = { id: 'bbb22222', nome: 'ALIENWARE-LIPE' }

// ------------------------------------------------------------- validação
assert.equal(validarPacote(null).ok, false)
assert.equal(validarPacote({}).ok, false, 'pacote sem máquina tem que ser recusado')
assert.equal(validarPacote({ maquina: { id: '' } }).ok, false)
ok('pacote sem identidade é recusado')

// id vira nome de arquivo: travessia de caminho não pode passar
const sujo = validarPacote({ maquina: { id: '../../etc/passwd', nome: 'x' } })
assert.equal(sujo.ok, true)
assert.equal(sujo.pacote.maquina.id, 'etcpasswd', 'id tem que ser higienizado')
assert.ok(!sujo.pacote.maquina.id.includes('/'))
assert.ok(!sujo.pacote.maquina.id.includes('.'))
ok('id malicioso é higienizado antes de virar caminho')

const gigante = validarPacote({ maquina: { id: 'x' }, jobs: new Array(5000).fill({ id: 'j' }) })
assert.equal(gigante.pacote.jobs.length, 500, 'lista gigante tem que ser cortada')
assert.deepEqual(validarPacote({ maquina: { id: 'x' }, jobs: 'nao é lista' }).pacote.jobs, [])
ok('lista absurda é cortada e tipo errado vira lista vazia')

const nomeLongo = validarPacote({ maquina: { id: 'x', nome: 'n'.repeat(500) } })
assert.equal(nomeLongo.pacote.maquina.nome.length, 60)
ok('nome longo é truncado')

// ---------------------------------------------------------------- carimbo
const carimbado = carimbar([{ id: 'j1' }, { id: 'j2' }], LOCAL)
assert.equal(carimbado.length, 2)
assert.deepEqual(carimbado[0].origem, LOCAL)
assert.deepEqual(carimbar(null, LOCAL), [], 'nada não pode explodir')
ok('carimbo de origem em lista, inclusive vazia')

// ----------------------------------------------------------------- mescla
const pacoteDoPc = {
  maquina: PC,
  jobs: [{ id: 'j1', subject: 'do PC' }, { id: 'x9', subject: 'outro do PC' }],
  idadeMs: 1000, semContato: false,
}
const juntos = mesclar([{ id: 'j1', subject: 'da VPS' }], [pacoteDoPc], LOCAL)
assert.equal(juntos.length, 3, 'mesmo id em máquinas diferentes são agentes diferentes')
assert.equal(juntos.filter((j) => j.id === 'j1').length, 2)
assert.deepEqual(juntos[0].origem.nome, 'VPS')
assert.equal(juntos.find((j) => j.subject === 'do PC').origem.nome, 'ALIENWARE-LIPE')
ok('mescla não deixa uma máquina sobrescrever job de outra com id igual')

// o mesmo pacote duas vezes não duplica
const duplicado = mesclar([], [pacoteDoPc, pacoteDoPc], LOCAL)
assert.equal(duplicado.length, 2)
ok('pacote repetido não duplica linha')

// campo diferente de jobs
const comServidores = mesclar([{ pid: 1 }], [{ maquina: PC, servidores: [{ pid: 2 }] }], LOCAL, 'servidores')
assert.equal(comServidores.length, 2)
assert.equal(comServidores[1].origem.nome, 'ALIENWARE-LIPE')
ok('mescla serve para servidores, não só para agentes')

// ------------------------------------------------------------- as máquinas
const ms = maquinasConhecidas([{ maquina: PC, idadeMs: SEM_CONTATO_MS + 1, semContato: true }], LOCAL)
assert.equal(ms.length, 2)
assert.equal(ms[0].local, true, 'a máquina local vem primeiro')
assert.equal(ms[0].nome, 'VPS')
assert.equal(ms[1].semContato, true, 'máquina velha continua na lista, marcada')
ok('lista de máquinas para o filtro, com quem está sem contato marcado')

// ------------------------------------------------------------- montar
const pacote = montarPacote({
  maquina: LOCAL,
  jobs: [{
    id: 'j1', subject: 'ok', status: 'working', tokens: 10,
    // campos pesados que NÃO podem ir na rede
    rawState: { enorme: 'x'.repeat(1000) }, intent: 'y'.repeat(1000), explicacoes: { a: 1 },
  }],
})
assert.equal(pacote.jobs.length, 1)
assert.equal(pacote.jobs[0].subject, 'ok')
assert.equal(pacote.jobs[0].rawState, undefined, 'estado cru não vai na rede')
assert.equal(pacote.jobs[0].intent, undefined)
assert.ok(pacote.em > 0)
assert.ok(JSON.stringify(pacote).length < LIMITE_PACOTE)
ok('pacote leva só o que a tela precisa, sem o estado cru')

// --------------------------------------------------------- tempo somado
const tempoVps = { projetos: [
  { projeto: 'inovallbond', ativoMs: 3_600_000, tokens: 100, valor: 500, custoReal: 40, sobra: 460 },
  { projeto: 'proj_carzo', ativoMs: 1_800_000, tokens: 50, valor: 0, custoReal: null, sobra: null },
] }
const tempoPc = { projetos: [
  { projeto: 'inovallbond', ativoMs: 7_200_000, tokens: 900, valor: 9999, custoReal: 111, sobra: 1 },
] }
const somado = mesclarTempo(tempoVps, [{ maquina: PC, tempo: tempoPc, idadeMs: 5 }], LOCAL)

const inovall = somado.projetos.find((p) => p.projeto === 'inovallbond')
assert.equal(inovall.ativoMs, 10_800_000, '1h da VPS + 2h do PC = 3h')
assert.equal(inovall.tokens, 1000)
assert.equal(inovall.porMaquina.length, 2, 'a quebra por máquina é o que o filtro usa')
assert.equal(inovall.porMaquina[0].maquina.nome, 'VPS')
assert.equal(inovall.porMaquina[1].ativoMs, 7_200_000)
ok('horas e tokens somam entre as máquinas, com a quebra por origem')

// dinheiro NÃO soma: taxa e assinatura são de cada config
assert.equal(inovall.valor, 0, 'valor tem que ser recalculado por quem exibe')
assert.equal(inovall.custoReal, null)
assert.equal(inovall.sobra, null)
ok('dinheiro não é somado entre máquinas com tabelas diferentes')

// projeto que só existe numa das máquinas continua inteiro
const carzo = somado.projetos.find((p) => p.projeto === 'proj_carzo')
assert.equal(carzo.ativoMs, 1_800_000)
assert.equal(carzo.porMaquina.length, 1)
// e a ordem é por tempo, o maior primeiro
assert.equal(somado.projetos[0].projeto, 'inovallbond')
assert.equal(somado.federado, true)
ok('projeto de uma máquina só sobrevive, e a ordem é por tempo')

// sem pacote nenhum, o resultado é o local intacto
const sozinho = mesclarTempo(tempoVps, [], LOCAL)
assert.equal(sozinho.projetos.length, 2)
assert.equal(sozinho.federado, false)
assert.equal(mesclarTempo(null, [], LOCAL).projetos.length, 0, 'sem dado nenhum não pode explodir')
ok('sem outra máquina, a aba tempo continua como sempre foi')

// ------------------------------------------------------- ida e volta
const ida = montarPacote({ maquina: PC, jobs: [{ id: 'j9', subject: 'viajou' }] })
const volta = validarPacote(JSON.parse(JSON.stringify(ida)))
assert.equal(volta.ok, true)
assert.equal(volta.pacote.jobs[0].subject, 'viajou')
assert.equal(volta.pacote.maquina.nome, 'ALIENWARE-LIPE')
assert.ok(volta.pacote.recebidoEm > 0)
ok('pacote sobrevive ao ida e volta por JSON')

console.log(`\n${n} grupos de asserção passaram`)
