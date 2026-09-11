/**
 * Corte 3 do MVP da v2: o painel não mente nunca.
 *
 * Aqui: erro de SISTEMA não pode se misturar com regra que barrou, no mesmo
 * número. Medido em 11/09 no placar real deste PC: "sem nome" era o primeiro
 * lugar com 334 ocorrências, e 333 delas eram um único hook quebrado
 * (`routia-fim` importando um arquivo que nunca foi instalado).
 *
 * Roda só sobre texto, sem tocar em disco nem no histórico dele.
 */
import assert from 'node:assert'
import { classificarRecado, placar, quebras } from './src/travas.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok++; console.log('  ok  ', nome) }

console.log('\ntravas: regra que barrou contra hook que quebrou\n')

const QUEBRADO = `[node C:/Users/x/.claude/hooks/routia-fim.mjs]: node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
    ^
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\\Users\\x\\.claude\\hooks\\acharCC.mjs'`

const BARROU = `[node C:/Users/x/.claude/hooks/travessao-guard.mjs]: 7 TRAVESSAO(OES) NA RESPOSTA.

E a regra numero 1 do arquivo de instrucoes dele.`

t('hook que quebrou é reconhecido como quebra', () => {
  assert.equal(classificarRecado(QUEBRADO).quebra, true)
})

t('regra que barrou NÃO é quebra', () => {
  const r = classificarRecado(BARROU)
  assert.equal(r.quebra, false, 'classificar trava como quebra a esconde do placar, que é onde ele decide o que desligar')
  assert.equal(r.trava, 'travessao-guard')
})

t('os dois trazem nome de hook, e mesmo assim se separam', () => {
  assert.equal(classificarRecado(QUEBRADO).trava, 'routia-fim', 'o nome do hook continua sendo lido')
  assert.notEqual(classificarRecado(QUEBRADO).quebra, classificarRecado(BARROU).quebra)
})

t('as assinaturas de quebra que valem', () => {
  for (const texto of [
    'Cannot find module "x"',
    'Error [ERR_MODULE_NOT_FOUND]',
    'bash: script.sh: No such file or directory',
    'SyntaxError: Unexpected token',
    "'node' is not recognized as an internal or external command",
    'node:internal/modules/esm/resolve:275',
  ]) assert.equal(classificarRecado(texto).quebra, true, `não reconheceu: ${texto}`)
})

t('⚠️ texto comum de trava NUNCA vira quebra', () => {
  for (const texto of [
    'PAROU COM 2 ITENS ABERTOS, no modo Continuativo.',
    '3 PALAVRAS DA CASA SEM EXPLICACAO',
    'COMMIT SEM ELE TER PEDIDO.',
    'ARQUIVO DE OUTRA ROTA',
    'PERGUNTA DECISIVA EM PROSA, refaca no AskUserQuestion.',
  ]) assert.equal(classificarRecado(texto).quebra, false, `classificou trava como quebra: ${texto}`)
})

t('o placar aceita lista pronta e exclui as quebras', () => {
  const lista = [
    { id: 'a', trava: 'travessao-guard', quebra: false, quando: '2026-09-11T00:00:00Z' },
    { id: 'b', trava: 'routia-fim', quebra: true, quando: '2026-09-11T00:00:00Z' },
    { id: 'c', trava: null, quebra: true, quando: '2026-09-11T00:00:00Z', titulo: 'Cannot find module', detalhe: '' },
  ]
  const p = placar(lista)
  assert.equal(p.length, 1, `o placar devia ter só a trava de verdade, veio ${p.map((x) => x.trava).join(',')}`)
  assert.equal(p[0].trava, 'travessao-guard')
})

t('as quebras aparecem agrupadas por causa, com a contagem', () => {
  const mesma = { quebra: true, quando: '2026-09-11T00:00:00Z', titulo: 'x', detalhe: "Error: Cannot find module 'acharCC.mjs'", trava: 'routia-fim', projeto: 'cockpit' }
  const q = quebras([{ ...mesma, id: '1' }, { ...mesma, id: '2' }, { ...mesma, id: '3' }])
  assert.equal(q.length, 1, 'três vezes o mesmo erro é UM problema, não três linhas')
  assert.equal(q[0].vezes, 3)
  assert.deepEqual(q[0].projetos, ['cockpit'])
})

t('quebra não some da vista: some do PLACAR, e aparece em quebras()', () => {
  const lista = [{ id: 'a', trava: null, quebra: true, quando: '2026-09-11T00:00:00Z', titulo: 'Cannot find module x', detalhe: '' }]
  assert.equal(placar(lista).length, 0, 'não pode contar como trava')
  assert.equal(quebras(lista).length, 1, 'e não pode sumir: foi a visibilidade dela que levou ao conserto de 11/09')
})

console.log(`\n${ok} verificações, 0 falhas\n`)
