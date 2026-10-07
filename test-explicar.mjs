// CC-936: o módulo das explicações. Nunca chama o agy de verdade (só o falso, por CC_AGY_BIN)
// e nunca toca o abrigo real: CC_HOME aponta para uma casa temporária ANTES de qualquer import do projeto.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'explicar-'))
process.env.CC_HOME = path.join(casa, '.claude')
const X = await import('./src/explicaItem.mjs')
const { DIR_SESSOES_ABRIGO } = await import('./src/metaSessao.mjs')

const t = async (nome, fn) => { await fn(); console.log('  ok   ' + nome) }
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const esperaLivre = async () => { for (let n = 0; n < 100 && X._ocupado(); n += 1) await espera(50); assert.equal(X._ocupado(), false, 'o agy falso não terminou') }
const LONGO = String.fromCharCode(0x2014)
const TRACO = new RegExp('[' + LONGO + String.fromCharCode(0x2013) + ']')

const falso = path.join(casa, 'agy-falso.mjs')
fs.writeFileSync(falso, `#!${process.execPath}
import fs from 'node:fs'
const a = process.argv.slice(2)
const prompt = a[a.indexOf('-p') + 1] || ''
const ids = [...prompt.matchAll(/"id":"([A-Z]{2,4}-\\d+)"/g)].map((m) => m[1])
await new Promise((r) => setTimeout(r, +(process.env.AGY_FALSO_MS || 0)))
fs.appendFileSync(process.env.AGY_FALSO_CONTA, a.join(' ').slice(0, 80) + '\\n')
if (process.env.AGY_FALSO_FALHA) process.exit(1)
const lista = ids.map((id) => ({ id, oque: id === process.env.AGY_FALSO_RUIM ? 'Mexe no web.mjs da tela' : 'Faz a tela ficar mais clara para você.', muda: 'Você enxerga melhor no celular.' }))
console.log(JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: '[' } }))
console.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: JSON.stringify(lista), usage: { input_tokens: 18000, output_tokens: 900, thinking_tokens: 0, total_tokens: 18900 } } }))
`)
fs.chmodSync(falso, 0o755)
process.env.CC_AGY_BIN = falso
process.env.AGY_FALSO_MS = '100'

const dia = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const projeto = (nome, itens) => {
  const raiz = path.join(casa, nome)
  fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'docs', 'backlog.jsonl'), itens.map((i) => JSON.stringify(i)).join('\n') + '\n')
  return raiz
}
const hoje = dia(Date.now())
const faz2 = dia(Date.now() - 2 * 864e5)

try {
  await t('o abrigo respeita CC_HOME', () => {
    assert.ok(DIR_SESSOES_ABRIGO().startsWith(casa), DIR_SESSOES_ABRIGO())
  })

  await t('a chave é estável, muda com a intencao e não muda com a prova', () => {
    const i = { id: 'CC-1', intencao: 'um', pronto: 'dois', prova: 'x' }
    assert.equal(X.chave('p', i), X.chave('p', { ...i }))
    assert.notEqual(X.chave('p', i), X.chave('p', { ...i, intencao: 'outro' }))
    assert.equal(X.chave('p', i), X.chave('p', { ...i, prova: 'y' }))
    assert.match(X.chave('p', i), /^p::CC-1::[0-9a-f]{12}$/)
  })

  await t('o prompt proíbe ferramentas, sem travessão, e remove segredo', () => {
    const p = X.promptDoLote([{ id: 'CC-1', estado: 'OK', intencao: 'faz isto ' + LONGO + ' e aquilo sk-ant-' + 'a'.repeat(30), pronto: 'p', prova: 'v' }], 'meu')
    assert.ok(p.includes('Não use ferramentas'))
    assert.ok(!TRACO.test(p.replace(/travessão/g, '')), 'travessão no prompt')
    assert.ok(p.includes('[SEGREDO REMOVIDO'))
    assert.ok(!p.includes('sk-ant-aaa'))
    assert.ok(p.includes('PROJETO: meu') && p.includes('"id":"CC-1"'))
  })

  await t('lerStream lê o result e, sem ele, junta os pedaços', () => {
    const delta = (s) => JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: s } })
    const r = JSON.stringify({ event: 'result', result: { response: '[ok]', usage: { input_tokens: 5, output_tokens: 6, thinking_tokens: 7, total_tokens: 18 } } })
    assert.deepEqual(X.lerStream([delta('x'), r].join('\n')), { texto: '[ok]', uso: { entrada: 5, saida: 6, pensamento: 7, total: 18 } })
    assert.deepEqual(X.lerStream([delta('[a'), delta('b]'), 'lixo'].join('\n')), { texto: '[ab]', uso: null })
  })

  await t('lerResposta aceita cerca de código e recusa número de item, arquivo e id não pedido', () => {
    const bom = (id, oque = 'Faz a tela ficar mais clara.') => ({ id, oque, muda: 'Você enxerga melhor no celular.' })
    const txt = '```json\n' + JSON.stringify([bom('CC-1'), bom('CC-2', 'Corrige o CC-12 da tela inicial'), bom('CC-3', 'Mexe no web.mjs da tela'), bom('CC-9'), bom('CC-4', 'Chama a função abrir() na tela'), bom('CC-1')]) + '\n```'
    const r = X.lerResposta(txt, ['CC-1', 'CC-2', 'CC-3', 'CC-4'])
    assert.deepEqual(r.boas.map((b) => b.id), ['CC-1'])
    assert.deepEqual(r.recusadas, ['CC-2', 'CC-3', 'CC-4'])
    assert.deepEqual(X.lerResposta('sem json', ['CC-1']), { boas: [], recusadas: ['CC-1'] })
    const traco = X.lerResposta(JSON.stringify([bom('CC-1', 'Faz isto ' + LONGO + ' e fica melhor')]), ['CC-1'])
    assert.ok(!TRACO.test(traco.boas[0].oque))
  })

  await t('montarLote: pedido primeiro, recheio aberto e recente, nunca KO nem micro tarefa', () => {
    const itens = [
      { id: 'CC-1', estado: 'B1', intencao: 'a', mexido: '2026-10-01' },
      { id: 'CC-2', estado: 'PR', intencao: 'b', mexido: '2026-10-02' },
      { id: 'CC-3', estado: 'OK', intencao: 'c', fechado: faz2 },
      { id: 'CC-4', estado: 'OK', intencao: 'd', fechado: '2026-08-01' },
      { id: 'CC-5', estado: 'KO', intencao: 'e' },
      { id: 'CC-6', estado: 'B1', intencao: 'f', pai: 'CC-1' },
    ]
    const ids = (o) => X.montarLote(itens, { projeto: 'p', hoje, ...o }).map((i) => i.id)
    const l = ids({ pedidos: ['CC-4'] })
    assert.equal(l[0], 'CC-4'); assert.equal(l.at(-1), 'CC-3'); assert.deepEqual(l.slice(1, 3).sort(), ['CC-1', 'CC-2'])
    assert.ok(!l.includes('CC-5') && !l.includes('CC-6'))
    assert.ok(!ids({}).includes('CC-4'))
    assert.deepEqual(ids({ pedidos: ['CC-5', 'CC-6'] }).sort(), ['CC-1', 'CC-2', 'CC-3'])
    assert.equal(ids({ max: 2 }).length, 2)
    assert.ok(!ids({ ja: (k) => k.includes('::CC-1::') }).includes('CC-1'))
  })

  await t('ponta a ponta: escreve uma vez, guarda o gasto e não chama de novo', async () => {
    const conta = path.join(casa, 'conta1'); fs.writeFileSync(conta, '')
    process.env.AGY_FALSO_CONTA = conta
    const raiz = projeto('VPS_um', [
      { id: 'CC-1', estado: 'B1', intencao: 'um', pronto: 'p1', mexido: '2026-10-01' },
      { id: 'CC-2', estado: 'PR', intencao: 'dois', pronto: 'p2', mexido: '2026-10-02' },
      { id: 'CC-3', estado: 'OK', intencao: 'tres', pronto: 'p3', fechado: faz2 },
      { id: 'CC-4', estado: 'OK', intencao: 'quatro', pronto: 'p4', fechado: '2026-08-01' },
    ])
    const ids = ['CC-1', 'CC-2', 'CC-3', 'CC-4']
    const a = X.explicacoes(raiz, ids)
    assert.equal(a.estado, 'escrevendo'); assert.deepEqual(a.itens, {})
    await esperaLivre()
    const b = X.explicacoes(raiz, ids)
    assert.deepEqual(Object.keys(b.itens).sort(), ids)
    assert.equal(b.estado, null); assert.deepEqual(b.desistiu, [])
    assert.equal(b.gasto.entrada, 18000); assert.equal(b.gasto.chamadas, 1); assert.equal(b.gasto.itens, 4); assert.equal(b.gasto.tokens, 18900)
    X.explicacoes(raiz, ids); await esperaLivre()
    assert.equal(fs.readFileSync(conta, 'utf8').trim().split('\n').length, 1)
    // sobrevive ao reinício: a memória volta do arquivo
    X._zerar()
    assert.deepEqual(Object.keys(X.explicacoes(raiz, ids).itens).sort(), ids)
    assert.equal(fs.readFileSync(conta, 'utf8').trim().split('\n').length, 1)
    const arq = path.join(DIR_SESSOES_ABRIGO(), '..', 'explicacoes.jsonl')
    const linhas = fs.readFileSync(arq, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    assert.equal(linhas.filter((l) => l.tipo === 'explicacao').length, 4)
    assert.equal(linhas.filter((l) => l.tipo === 'chamada').length, 1)
  })

  await t('recusado duas vezes vira desistiu, sem pausa', async () => {
    X._zerar()
    const conta = path.join(casa, 'conta2'); fs.writeFileSync(conta, '')
    process.env.AGY_FALSO_CONTA = conta; process.env.AGY_FALSO_RUIM = 'CC-1'
    const raiz = projeto('VPS_ruim', [
      { id: 'CC-1', estado: 'B1', intencao: 'um', mexido: '2026-10-01' },
      { id: 'CC-2', estado: 'B1', intencao: 'dois', mexido: '2026-10-02' },
    ])
    X.explicacoes(raiz, ['CC-1', 'CC-2']); await esperaLivre()
    // só um lote INTEIRO ruim vira pausa; com um item bom junto, a recusa conta. Por isso entra o CC-3.
    projeto('VPS_ruim', [['CC-1', 'um'], ['CC-2', 'dois'], ['CC-3', 'tres']].map(([id, intencao]) => ({ id, estado: 'B1', intencao, mexido: '2026-10-01' })))
    const ids = ['CC-1', 'CC-2', 'CC-3']
    X.explicacoes(raiz, ids); await esperaLivre()
    const r = X.explicacoes(raiz, ids)
    assert.deepEqual(Object.keys(r.itens).sort(), ['CC-2', 'CC-3']); assert.deepEqual(r.desistiu, ['CC-1']); assert.equal(r.estado, null)
    assert.equal(fs.readFileSync(conta, 'utf8').trim().split('\n').length, 2)
    delete process.env.AGY_FALSO_RUIM
  })

  await t('falha: pausa de 30 minutos e nenhuma chamada nova', async () => {
    X._zerar()
    const conta = path.join(casa, 'conta3'); fs.writeFileSync(conta, '')
    process.env.AGY_FALSO_CONTA = conta; process.env.AGY_FALSO_FALHA = '1'
    const raiz = projeto('VPS_falha', [{ id: 'CC-1', estado: 'B1', intencao: 'um', mexido: '2026-10-01' }])
    assert.equal(X.explicacoes(raiz, ['CC-1']).estado, 'escrevendo')
    await esperaLivre()
    const p = X.explicacoes(raiz, ['CC-1'])
    assert.equal(p.estado, 'pausa'); assert.equal(p.gasto.chamadas >= 1, true)
    const antes = fs.readFileSync(conta, 'utf8').trim().split('\n').length
    X.explicacoes(raiz, ['CC-1']); await espera(300)
    assert.equal(fs.readFileSync(conta, 'utf8').trim().split('\n').length, antes)
    assert.equal(antes, 1)
    // passada a pausa, a tela religa a fila
    delete process.env.AGY_FALSO_FALHA
    assert.equal(X.explicacoes(raiz, ['CC-1'], { agora: Date.now() + 31 * 60 * 1000 }).estado, 'escrevendo')
    await esperaLivre()
    assert.equal(fs.readFileSync(conta, 'utf8').trim().split('\n').length, 2)
  })

  await t('sem agy: avisa e não cria nada', () => {
    X._zerar()
    const antes = process.env.CC_AGY_BIN
    process.env.CC_AGY_BIN = path.join(casa, 'nao-existe')
    const raiz = projeto('VPS_sem', [{ id: 'CC-1', estado: 'B1', intencao: 'um', mexido: '2026-10-01' }])
    assert.equal(X.explicacoes(raiz, ['CC-1']).estado, 'sem agy')
    assert.equal(X._ocupado(), false)
    process.env.CC_AGY_BIN = antes
  })

  await t('nunca há temporizador no módulo', () => {
    assert.ok(!/setInterval|setTimeout/.test(fs.readFileSync(new URL('./src/explicaItem.mjs', import.meta.url), 'utf8')))
  })

  await t('o módulo não tem travessão no código', () => {
    assert.ok(!TRACO.test(fs.readFileSync(new URL('./src/explicaItem.mjs', import.meta.url), 'utf8')))
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
