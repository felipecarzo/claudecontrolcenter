/**
 * Testes do motor do framework. Rodam em qualquer máquina: não leem disco do
 * projeto, não precisam de job, não precisam de Chrome. É de propósito, e é o
 * contraste com o `npm test`, que hoje falha na VPS por exigir job real com
 * transcript (CC-53).
 *
 *   node test-framework.mjs
 */
import assert from 'node:assert'
import {
  METODOS, PREDICADOS, SEMPRE_LIVRE, avaliar, avancar, casa,
  estadoInicial, mudarEscopo, podeEditar, resumo,
} from './src/framework.mjs'

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

// ---------------------------------------------------------------- casamento
assert.equal(casa('src/**', 'src/jobs.mjs'), true)
assert.equal(casa('src/**', 'src/a/b/c.mjs'), true)
assert.equal(casa('src/**', 'src'), true)
assert.equal(casa('src/**', 'srcx/jobs.mjs'), false, 'prefixo solto não pode casar')
assert.equal(casa('*', 'package.json'), true)
assert.equal(casa('*', 'src/jobs.mjs'), false, '* não desce pasta')
assert.equal(casa('src/**', ''), false)
assert.equal(casa('src/**', 'src\\jobs.mjs'), true, 'caminho do Windows')
ok('casamento de caminho, inclusive barra invertida')

// ------------------------------------------------------------------ estado
const vazio = estadoInicial()
assert.equal(vazio.fase, 'definicao')
assert.equal(vazio.mvp.criterios.length, 0)
ok('estado inicial começa na definição, sem MVP')

// --------------------------------------------------------------- predicados
assert.ok(PREDICADOS['mvp-definido'](vazio), 'sem critério tem que acusar')
assert.equal(PREDICADOS['mvp-definido']({ mvp: { criterios: [{ texto: 'x' }] } }), null)
assert.ok(PREDICADOS['mvp-tem-nome'](vazio))
assert.equal(PREDICADOS['mvp-tem-nome']({ mvp: { nome: 'painel' } }), null)
// a frase do que falta é parte do contrato, não enfeite
assert.match(PREDICADOS['mvp-definido'](vazio), /critério/)
ok('predicados devolvem a frase do que falta, nunca booleano nu')

// ------------------------------------------------------------------ o gate
const g1 = podeEditar('mvp-basico', vazio, 'src/jobs.mjs')
assert.equal(g1.ok, false, 'código sem MVP tem que travar')
assert.equal(g1.pendencias.length, 2)
ok('sem MVP, código é travado, com as duas pendências nomeadas')

for (const livre of ['docs/HANDOFF.md', 'assets/img/a.png', '.framework/estado.json', 'package.json']) {
  assert.equal(podeEditar('mvp-basico', vazio, livre).ok, true, `${livre} tinha que passar`)
}
ok('docs, assets, o próprio estado e a raiz nunca travam')

// método desconhecido e estado corrompido LIBERAM: framework que trava por bug
// próprio é desligado no mesmo dia
assert.equal(podeEditar('nao-existe', vazio, 'src/a.mjs').ok, true)
assert.equal(podeEditar('mvp-basico', {}, 'src/a.mjs').ok, false) // sem fase cai na primeira
assert.equal(podeEditar('mvp-basico', null, 'docs/a.md').ok, true)
ok('dúvida libera: método desconhecido não pode travar ninguém')

// ------------------------------------------------------- definiu, liberou
const definido = { ...vazio, mvp: { nome: 'painel dos agentes', criterios: [{ texto: 'uma linha por agente', feito: false }] } }
const a1 = avaliar('mvp-basico', definido)
assert.equal(a1.portaoAberto, true)
assert.equal(a1.proxima, 'execucao')
assert.equal(podeEditar('mvp-basico', definido, 'src/jobs.mjs').ok, true)
ok('com MVP definido o portão abre e o código libera')

const av = avancar('mvp-basico', definido)
assert.equal(av.ok, true)
assert.equal(av.estado.fase, 'execucao')
assert.equal(avancar('mvp-basico', vazio).ok, false, 'não avança com pendência')
assert.deepEqual(avancar('mvp-basico', av.estado).pendencias, [
  'faltam 1 de 1 critérios do MVP: uma linha por agente',
])
ok('avançar recusa com o que falta, em vez de avançar calado')

// -------------------------------------------------------- definição de pronto
const emExecucao = av.estado
assert.equal(avaliar('mvp-basico', emExecucao).portaoAberto, false)
const pronto = { ...emExecucao, mvp: { ...emExecucao.mvp, criterios: [{ texto: 'uma linha por agente', feito: true }] } }
const a2 = avaliar('mvp-basico', pronto)
assert.equal(a2.portaoAberto, true)
assert.equal(a2.ultima, true)
ok('pronto é critério marcado, não opinião')

// ------------------------------------------------- ligado contra desligado
const desligado = { ...vazio, ligado: false }
assert.equal(avaliar('mvp-basico', desligado).ligado, false)
assert.equal(podeEditar('mvp-basico', desligado, 'src/a.mjs').ok, true, 'desligado não trava nada')
assert.match(resumo('mvp-basico', desligado), /desligado/i)
// desligar preserva o dado: é a diferença entre desligar e apagar a pasta
const comMvpDesligado = { ...definido, ligado: false }
assert.equal(comMvpDesligado.mvp.criterios.length, 1)
assert.equal(podeEditar('mvp-basico', comMvpDesligado, 'src/a.mjs').ok, true)
assert.equal(avaliar('mvp-basico', { ...comMvpDesligado, ligado: true }).portaoAberto, true, 'religar devolve o estado de antes')
// estado gravado antes deste campo existir conta como LIGADO: projeto antigo
// não pode destravar sozinho numa atualização
assert.equal(avaliar('mvp-basico', vazio).ligado, true)
assert.equal(podeEditar('mvp-basico', vazio, 'src/a.mjs').ok, false)
ok('desligado libera tudo e preserva o MVP; ausência do campo conta como ligado')

// ------------------------------------------------------------ mudar escopo
const semMotivo = mudarEscopo(pronto, { mvp: { nome: 'outro', criterios: [] } })
assert.equal(semMotivo.ok, false, 'mudança de escopo sem motivo tem que recusar')

const mud = mudarEscopo(pronto, {
  mvp: { nome: 'outro produto', criterios: [{ texto: 'novo', feito: false }] },
  motivo: 'o Felipe reposicionou o produto',
})
assert.equal(mud.ok, true)
assert.equal(mud.estado.historico.length, 1)
assert.equal(mud.estado.historico[0].motivo, 'o Felipe reposicionou o produto')
assert.equal(mud.estado.historico[0].de.nome, 'painel dos agentes')
assert.equal(mud.estado.mvp.nome, 'outro produto')
// e o histórico não some na mudança seguinte
const mud2 = mudarEscopo(mud.estado, { mvp: { nome: 'terceiro', criterios: [] }, motivo: 'de novo' })
assert.equal(mud2.estado.historico.length, 2)
ok('escopo muda com motivo registrado, e o histórico acumula')

// ------------------------------------------------------------------- resumo
assert.match(resumo('mvp-basico', vazio), /Falta:/)
assert.match(resumo('mvp-basico', definido), /Portão aberto/)
assert.match(resumo('mvp-basico', pronto), /critérios do MVP estão marcados/)
// sem número solto na frase do usuário: "fase 1 de 2" é posição, não nota
assert.ok(!/\b\d{2,}\b/.test(resumo('mvp-basico', vazio)), 'nada de pontuação numérica')
ok('resumo é frase, com o que falta escrito')

// ------------------------------------------------------------- pureza
const antes = JSON.stringify(definido)
avaliar('mvp-basico', definido); podeEditar('mvp-basico', definido, 'src/a.mjs')
avancar('mvp-basico', definido); mudarEscopo(definido, { mvp: {}, motivo: 'x' })
assert.equal(JSON.stringify(definido), antes, 'nenhuma função pode mutar o estado recebido')
ok('motor é puro: nada muta o estado que recebeu')

// --------------------------------------------------------------- integridade
assert.ok(SEMPRE_LIVRE.includes('docs/**'), 'travar docs quebraria o /end-session')
for (const m of Object.values(METODOS)) {
  assert.ok(m.fases.length > 0)
  for (const f of m.fases) {
    assert.ok(f.explica, `fase ${f.id} sem explicação: gate mudo se desliga na terceira semana`)
    for (const p of f.exige || []) {
      assert.ok(PREDICADOS[p], `fase ${f.id} exige predicado inexistente: ${p}`)
    }
  }
}
ok('todo método declarado usa predicado que existe, e toda fase explica')

console.log(`\n${n} grupos de asserção passaram`)
