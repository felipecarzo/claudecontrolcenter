// CC-292: a taxa de cada trava por 100 respostas
import assert from 'node:assert/strict'
import { coletarTravas } from './src/coletores.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }

const registros = [
  { dia: '2026-10-01', projeto: 'a', medida: 'respostas', valor: 30 },
  { dia: '2026-10-01', projeto: 'b', medida: 'respostas', valor: 70 },
]
const ev = (trava, dia, extra = {}) => ({ trava, quando: dia + 'T10:00:00Z', ...extra })

t('CC-292: 5 devoluções em 100 respostas (somando projetos) dão 5 por 100, uma linha por trava', () => {
  const eventos = [...Array(5).fill(0).map(() => ev('fluxo-guard', '2026-10-01')), ev('forma-guard', '2026-10-01')]
  const { registros: r } = coletarTravas({ eventos, registros })
  assert.deepEqual(r.map((x) => [x.projeto, x.valor, x.medida]).sort(), [['fluxo-guard', 5, 'travas.por100'], ['forma-guard', 1, 'travas.por100']])
})
t('CC-292: hook quebrado não é trava barrando e fica fora', () => {
  const { registros: r } = coletarTravas({ eventos: [ev('routia-fim', '2026-10-01', { quebra: true })], registros })
  assert.equal(r.length, 0)
})
t('CC-292: dia sem resposta medida não gera ponto (não divide por zero)', () => {
  const { registros: r } = coletarTravas({ eventos: [ev('fluxo-guard', '2026-09-20')], registros })
  assert.equal(r.length, 0)
})

// CC-293: forma ou julgamento, em toda trava do catálogo
import { HOOKS } from './src/hooksCatalogo.mjs'
import { placarPorFamilia } from './src/travas.mjs'
t('CC-293: toda trava do catálogo declara família forma ou julgamento', () => {
  const sem = HOOKS.filter((h) => !['forma', 'julgamento'].includes(h.familia)).map((h) => h.id)
  assert.deepEqual(sem, [], 'trava sem família escondida do placar: ' + sem.join(', '))
})
t('CC-293: as duas somas fecham com o placar e trava desconhecida não some', () => {
  const linhas = [
    { trava: 'travessao-guard', vezes: 4, ajudou: 1, atrapalhou: 1, semMarca: 2 },
    { trava: 'fluxo-guard', vezes: 6, ajudou: 0, atrapalhou: 2, semMarca: 4 },
    { trava: 'inventada-guard', vezes: 1, ajudou: 0, atrapalhou: 0, semMarca: 1 },
  ]
  const f = placarPorFamilia(linhas)
  assert.equal(f.forma.vezes, 4); assert.equal(f.julgamento.vezes, 6); assert.equal(f['sem família'].vezes, 1)
  assert.equal(f.forma.vezes + f.julgamento.vezes + f['sem família'].vezes, 11)
})
