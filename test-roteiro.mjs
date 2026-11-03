// CC-1081: o roteiro de uso (núcleo puro + linha de comando contra uma pasta temporária).
// Sem navegador e sem rede: o mapa e o agente ao vivo ficam em test-roteiro-vivo.mjs.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import * as R from './src/roteiro.mjs'
import { main, relatorioHtml, analisar, opcoesDoNavegador } from './src/roteiroCli.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
let n = 0
let falhas = 0
async function caso(nome, fn) {
  try { await fn(); n++; console.log(`ok ${nome}`) } catch (e) { falhas++; console.log(`FALHOU ${nome}\n   ${e.stack || e}`) }
}

/* ---------- ajudantes ---------- */

/** Respostas que passam no `pronto`, por pergunta (o resto recebe um texto qualquer). */
const RESP = {
  'f0-base': 'dado',
  'f0-frase': 'quando chego em casa, quero pagar a fatura, para fechar o mês',
  'f0-metrica': '8 de 10 pessoas concluem',
  'f2-conferir': 'sim',
  'f3-treetest': 'gente',
  'f3-acerto': 'T1 85%, T2 90%',
  'f4-sinaliza': 'sim',
  'f5-tentar': 'sim', 'f5-notar': 'sim', 'f5-ligar': 'sim', 'f5-progresso': 'sim',
  'f6-firstclick': 'acima', 'f6-heuristicas': 'sim', 'f6-trunk': 'sim',
  'f7-pessoas': '5 pessoas', 'f7-sucesso': '85 e 90', 'f7-sus': '72', 'f7-backlog': 'sim',
  'f8-proxima': '2099-01-01',
}

/** Responde sempre a `proxima` até acabar ou chegar na fase `ate` (exclusive). */
function preencher(estado, { ate = 9, de = 'ele', sobre = {} } = {}) {
  let e = estado
  for (let i = 0; i < 300; i++) {
    const p = R.proxima(e)
    if (!p || p.fase >= ate) return e
    const base = p.id.split('@')[0]
    const r = R.responder(e, p.id, sobre[base] ?? RESP[base] ?? `resposta de ${base}`, { de })
    assert.ok(r.ok, `${p.id}: ${r.erro}`)
    e = r.estado
  }
  throw new Error('laço sem fim')
}

const comTarefas = () => {
  let e = R.vazio()
  e = R.novaTarefa(e, { objetivo: 'pagar a fatura e ver o comprovante', sucesso: { texto: 'Comprovante' } }).estado
  e = R.novaTarefa(e, { objetivo: 'trocar a senha de acesso', sucesso: { texto: 'Senha alterada' } }).estado
  return e
}

/** Roda o CLI no mesmo processo e devolve o que ele escreveu. `injetados` troca os módulos do navegador. */
/* Por padrão simula terminal de verdade (tty). Os casos de autoria passam `tty: () => false` para simular uma IA rodando o comando. */
const cli = (...args) => cliCom({ tty: () => true }, ...args)
async function cliCom(injetados, ...args) {
  const linhas = []
  const log = console.log
  const err = console.error
  console.log = (...a) => linhas.push(a.join(' '))
  console.error = (...a) => linhas.push(a.join(' '))
  process.exitCode = 0
  try {
    const code = await main(args, injetados)
    return { code, saida: linhas.join('\n') }
  } finally {
    console.log = log
    console.error = err
    process.exitCode = 0
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'roteiro-'))
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }))
const pasta = (nome) => { const d = join(tmp, nome); mkdirSync(d, { recursive: true }); return d }

/* ================== 1. fases e proxima ================== */

await caso('são 9 fases, de 0 a 8, cada uma com título e pronto()', () => {
  assert.equal(R.FASES.length, 9)
  assert.deepEqual(R.FASES.map((f) => f.id), [0, 1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(R.FASES.map((f) => f.titulo), ['Enquadrar', 'Tarefas principais', 'Modelo conceitual', 'Arquitetura da informação', 'Roteiro de uso', 'Percurso cognitivo', 'Tela', 'Validar com gente', 'Acompanhar'])
  for (const f of R.FASES) {
    assert.ok(f.perguntas.length >= 3, `fase ${f.id} tem perguntas`)
    const p = f.pronto(R.vazio())
    assert.equal(p.ok, false)
    assert.ok(Array.isArray(p.falta) && p.falta.length > 0)
  }
})

await caso('proxima: uma pergunta só, a primeira da fase 0, com a contagem', () => {
  const p = R.proxima(R.vazio())
  assert.equal(p.id, 'f0-quem')
  assert.equal(p.fase, 0)
  assert.equal(p.feitas, 0)
  assert.ok(p.total >= 6)
  assert.ok(p.header && p.pergunta && p.ajuda)
})

await caso('encadeamento: a resposta anterior pula e reescreve a próxima', () => {
  let e = R.responder(R.vazio(), 'f0-quem', 'Mãe de aluno', {}).estado
  // sem a base: a próxima é a base
  assert.equal(R.proxima(e).id, 'f0-base')
  // "suposição" abre a pergunta de quem confirma
  const sup = R.responder(e, 'f0-base', 'É suposição', {}).estado
  assert.equal(R.proxima(sup).id, 'f0-confirmar')
  // "dado" pula essa pergunta, e o texto da seguinte cita a resposta curta
  const dado = R.responder(e, 'f0-base', 'dado', {}).estado
  const p = R.proxima(dado)
  assert.equal(p.id, 'f0-progresso')
  assert.ok(p.pergunta.includes('Mãe de aluno'))
  // resposta longa não vira citação
  const longo = R.responder(R.responder(R.vazio(), 'f0-quem', 'Mãe de aluno, no celular, na fila da escola, com pressa.', {}).estado, 'f0-base', 'dado', {}).estado
  assert.ok(R.proxima(longo).pergunta.includes('essa pessoa'))
  // pergunta que não se aplica é recusada
  assert.equal(R.responder(dado, 'f0-confirmar', 'fulano', {}).ok, false)
})

await caso('pergunta fechada só aceita opção (sem acento e sem caixa); aberta aceita texto', () => {
  const e = R.vazio()
  assert.equal(R.responder(e, 'f0-base', 'talvez', {}).ok, false)
  const r = R.responder(e, 'f0-base', 'É SUPOSIÇÃO', {})
  assert.equal(r.ok, true)
  assert.equal(r.resposta.valor, 'suposicao')
  assert.equal(R.responder(e, 'f2-conferir', 'não', {}).resposta.valor, 'nao')
  assert.equal(R.responder(e, 'f0-quem', '   ', {}).ok, false)
  assert.equal(R.responder(e, 'nao-existe', 'x', {}).ok, false)
})

/* ================== 2. autor e palpite ================== */

await caso('autor: grava de/quando; autor inválido é recusado', () => {
  const ele = R.responder(R.vazio(), 'f0-quem', 'gente', {})
  assert.equal(ele.resposta.de, 'ele')
  assert.ok(ele.resposta.quando)
  assert.equal(R.responder(R.vazio(), 'f0-quem', 'gente', { de: 'programa' }).resposta.de, 'programa')
  assert.equal(R.responder(R.vazio(), 'f0-quem', 'gente', { de: 'robo' }).ok, false)
  assert.equal(R.responder(R.vazio(), 'f0-quem', 'gente', { de: 'ia:' }).ok, false)
})

await caso('resposta de IA é palpite até confirmar, e o autor continua sendo a IA', () => {
  const r = R.responder(R.vazio(), 'f0-quem', 'gente de rua', { de: 'ia:haiku' })
  assert.equal(R.ehPalpite(r.resposta), true)
  assert.deepEqual(R.palpites(r.estado).map((p) => [p.id, p.tipo, p.de]), [['f0-quem', 'resposta', 'ia:haiku']])
  assert.match(R.resumo(r.estado), /palpite de ia:haiku, confirme/)
  const c = R.confirmar(r.estado, 'f0-quem')
  assert.equal(c.ok, true)
  assert.equal(c.estado.respostas['f0-quem'].de, 'ia:haiku')
  assert.ok(c.estado.respostas['f0-quem'].confirmadoEm)
  assert.equal(R.palpites(c.estado).length, 0)
  // confirmar o que não é palpite, ou não existe, é erro
  assert.equal(R.confirmar(c.estado, 'f0-quem').ok, false)
  assert.equal(R.confirmar(c.estado, 'f9-nada').ok, false)
  // o estado de entrada não foi alterado
  assert.equal(R.ehPalpite(r.estado.respostas['f0-quem']), true)
})

await caso('tarefa de IA é palpite: não gera pergunta até confirmar', () => {
  const a = R.novaTarefa(R.vazio(), { objetivo: 'pagar a fatura e ver o comprovante', sucesso: { texto: 'Comprovante' }, de: 'ia:haiku' })
  assert.equal(a.tarefa.id, 'T1')
  assert.equal(R.todas(a.estado).some((p) => p.id.includes('@')), false)
  assert.deepEqual(R.palpites(a.estado).map((p) => [p.id, p.tipo]), [['T1', 'tarefa']])
  const b = R.novaTarefa(a.estado, { objetivo: 'trocar a senha de acesso' })
  assert.equal(b.tarefa.id, 'T2')
  const c = R.confirmar(b.estado, 'T1')
  assert.equal(c.alvo, 'tarefa')
  assert.ok(R.todas(c.estado).some((p) => p.id === 'f4-entrada@T1'))
  assert.equal(R.todas(c.estado).some((p) => p.id.endsWith('@T2')), true)  // T2 é dele, vale
  assert.equal(R.novaTarefa(R.vazio(), { objetivo: '' }).ok, false)
})

await caso('regra da estética: IA que fala de cor antes da fase 6 é descartada; a pessoa e a fase 6 não', () => {
  const e = R.vazio()
  const ia = R.responder(e, 'f2-objetos', 'fatura, com a cor azul no botão', { de: 'ia:haiku' })
  assert.equal(ia.ok, false)
  assert.match(ia.erro, /descartada/)
  assert.equal(R.responder(e, 'f2-objetos', 'fatura e pedido', { de: 'ia:haiku' }).ok, true)
  assert.equal(R.responder(e, 'f2-objetos', 'cor é um objeto da loja de tintas', { de: 'ele' }).ok, true)
  assert.equal(R.responder(e, 'f6-peso', 'a cor do botão principal pesa mais', { de: 'ia:haiku' }).ok, true)
  // as palavras do visual no plural e acentuadas também caem; palavra que só começa igual não cai
  for (const t of ['as cores do menu', 'a fonte é pequena', 'o espaçamento entre botões', 'uma questão estética']) {
    assert.equal(R.responder(e, 'f2-objetos', t, { de: 'ia:x' }).ok, false, t)
  }
  assert.equal(R.responder(e, 'f2-objetos', 'a corrida de táxi e o coração do pedido', { de: 'ia:x' }).ok, true)
})

/* ================== 3. pronto não aceita palpite ================== */

await caso('pronto: a fase 0 toda em palpite não fecha, e a fase 1 não abre sobre palpite', () => {
  const e = preencher(R.vazio(), { ate: 1, de: 'ia:haiku' })
  const s = R.situacao(e)
  assert.equal(s.fases[0].ok, false)
  assert.equal(s.fase, 0)
  assert.ok(s.fases[0].falta.some((f) => /palpite de ia:haiku/.test(f)))
  assert.equal(R.proxima(e), null, 'sem pergunta da fase 1 enquanto a 0 tem palpite')
  assert.equal(s.palpites.length, 6)
  // confirmar tudo fecha a fase e abre a próxima
  let c = e
  for (const p of s.palpites) c = R.confirmar(c, p.id).estado
  const depois = R.situacao(c)
  assert.equal(depois.fases[0].ok, true)
  assert.equal(depois.fase, 1)
  assert.equal(R.proxima(c).id, 'f1-lista')
})

await caso('pronto da fase 0 confere o que o código sabe medir: a frase e o número da métrica', () => {
  const ruim = preencher(R.vazio(), { ate: 1, sobre: { 'f0-frase': 'o usuário quer pagar', 'f0-metrica': 'ficar bom' } })
  const f = R.situacao(ruim).fases[0]
  assert.equal(f.ok, false)
  assert.ok(f.falta.some((x) => /quando.*quero.*para/.test(x)))
  assert.ok(f.falta.some((x) => /sem número/.test(x)))
  const bom = preencher(R.vazio(), { ate: 1 })
  assert.equal(R.situacao(bom).fases[0].ok, true)
})

await caso('fase 1: exige tarefa com resultado observável, e conta o limite de 9', () => {
  const sem = preencher(R.vazio(), { ate: 2 })
  assert.ok(R.situacao(sem).fases[1].falta.some((f) => /nenhuma tarefa cadastrada/.test(f)))
  let e = R.novaTarefa(sem, { objetivo: 'pagar a fatura e ver o comprovante' }).estado
  assert.ok(R.situacao(e).fases[1].falta.some((f) => /T1 sem resultado observável/.test(f)))
  const ia = R.novaTarefa(R.vazio(), { objetivo: 'pagar a fatura e ver o comprovante', sucesso: { texto: 'ok' }, de: 'ia:haiku' }).estado
  assert.ok(R.situacao(ia).fases[1].falta.some((f) => /palpite de ia:haiku/.test(f)))
  let muitas = R.vazio()
  for (let i = 0; i < 10; i++) muitas = R.novaTarefa(muitas, { objetivo: `fazer a coisa ${i} e ver o fim`, sucesso: { texto: 'fim' } }).estado
  assert.ok(R.situacao(muitas).fases[1].falta.some((f) => /10 tarefas/.test(f)))
})

await caso('fases por tarefa: uma pergunta por tarefa, T1 inteira antes de T2; sem tarefa confirmada, fase aberta', () => {
  const e = preencher(comTarefas(), { ate: 4 })
  assert.equal(R.situacao(e).fase, 4)
  const ordem = []
  let c = e
  for (let i = 0; i < 12; i++) {
    const p = R.proxima(c)
    if (!p || p.fase !== 4) break
    ordem.push(p.id)
    c = R.responder(c, p.id, RESP[p.id.split('@')[0]] ?? 'x').estado
  }
  assert.deepEqual(ordem.slice(0, 6), ['f4-entrada@T1', 'f4-sequencia@T1', 'f4-primeiro@T1', 'f4-desvios@T1', 'f4-sinaliza@T1', 'f4-entrada@T2'])
  assert.match(R.proxima(e).pergunta, /pagar a fatura/)
  // a sequência cita a entrada da própria tarefa
  const c1 = R.responder(e, 'f4-entrada@T1', 'página inicial').estado
  assert.match(R.proxima(c1).pergunta, /página inicial/)
  // sem tarefa nenhuma, a fase 4 não tem como fechar
  assert.ok(R.FASES[4].pronto(R.vazio()).falta.some((f) => /nenhuma tarefa confirmada/.test(f)))
})

await caso('fase 5: o "não" de uma das quatro perguntas abre a pergunta de correção', () => {
  const antes = preencher(comTarefas(), { ate: 5 })
  // tudo "sim": a pergunta de correção nem aparece, e a fase fecha
  const sim = preencher(antes, { ate: 6 })
  assert.equal(R.aplicaveis(sim).some((p) => p.base === 'f5-correcao'), false)
  assert.equal(R.situacao(sim).fases[5].ok, true)
  // T1 responde "não" em "nota a ação": a correção aparece e a fase só fecha com ela
  let e = antes
  for (const [b, v] of [['f5-tentar', 'sim'], ['f5-notar', 'não'], ['f5-ligar', 'sim'], ['f5-progresso', 'sim'], ['f5-falha', 'a pessoa nova não vê o botão']]) {
    e = R.responder(e, `${b}@T1`, v).estado
  }
  assert.equal(R.proxima(e).id, 'f5-correcao@T1')
  assert.equal(R.situacao(e).fases[5].ok, false)
  const fim = R.responder(e, 'f5-correcao@T1', 'trocar o rótulo "Enviar" por "Pagar agora", quem decide é o Felipe').estado
  assert.equal(R.proxima(fim).id, 'f5-tentar@T2')
  assert.equal(R.situacao(preencher(fim, { ate: 6 })).fases[5].ok, true)
})

await caso('percurso completo: as 9 fases fecham e a conta de perguntas bate (58 de 58)', () => {
  const e = preencher(comTarefas())
  const s = R.situacao(e)
  assert.equal(s.prontas, 9)
  assert.equal(s.emDia, true)
  assert.equal(R.proxima(e), null)
  assert.deepEqual(R.progresso(e), { feitas: 58, total: 58 })
  assert.equal(R.palpites(e).length, 0)
})

await caso('fase 8 não termina: data que passou reabre', () => {
  const e = preencher(comTarefas(), { sobre: { 'f8-proxima': '2020-01-01' } })
  const s = R.situacao(e)
  assert.equal(s.fases[8].ok, false)
  assert.match(s.fases[8].falta[0], /já passou/)
  assert.equal(s.fase, 8)
  assert.equal(R.situacao(e, { agora: new Date('2019-01-01') }).fases[8].ok, true)
  assert.equal(R.situacao(preencher(comTarefas(), { sobre: { 'f8-proxima': 'um dia' } })).fases[8].ok, false)
  assert.equal(R.situacao(preencher(comTarefas(), { sobre: { 'f8-proxima': '15/03/2099' } })).fases[8].ok, true)
})

await caso('metas: acerto abaixo de 80, SUS abaixo de 68 e teste do tronco reprovado seguram a fase', () => {
  // tudo fechado, e depois três respostas trocadas (responder aceita qualquer pergunta que se aplica)
  let baixo = preencher(comTarefas())
  for (const [id, v] of [['f3-acerto', 'T1 62%, T2 90%'], ['f7-sus', '61'], ['f6-trunk', 'não']]) baixo = R.responder(baixo, id, v).estado
  const s = R.situacao(baixo)
  assert.ok(s.fases[3].falta.some((f) => /pior taxa está em 62.*meta é 80/.test(f)))
  assert.ok(s.fases[7].falta.some((f) => /SUS: está em 61.*piso é 68/.test(f)))
  assert.ok(s.fases[6].falta.some((f) => /tronco/.test(f)))
  const ia = preencher(comTarefas(), { sobre: { 'f3-treetest': 'só pela IA' } })
  assert.equal(R.situacao(ia).fases[3].ok, true)
  assert.ok(R.situacao(ia).fases[3].avisos.some((a) => /hipótese/.test(a)))
})

await caso('desfazer: apaga a resposta e leva junto as que só existiam por causa dela', () => {
  let e = R.responder(R.vazio(), 'f0-base', 'suposição').estado
  e = R.responder(e, 'f0-confirmar', 'o dono da escola').estado
  const r = R.desfazer(e, 'f0-base')
  assert.equal(r.ok, true)
  assert.deepEqual(r.orfas, ['f0-confirmar'])
  assert.equal(R.proxima(r.estado).id, 'f0-quem')
  assert.equal(R.desfazer(e, 'f0-negocio').ok, false)
})

/* ================== 4. análise do mapa ================== */

const MAPA = {
  telas: [{ id: 'raiz', titulo: 'Início' }, { id: 'a', titulo: 'Painel' }, { id: 'b', titulo: 'Ajuda' }, { id: 'c', titulo: 'Naves' }, { id: 'd', titulo: 'Sobre' }],
  arestas: [
    { de: 'raiz', para: 'a', rotulo: 'Painel' },
    { de: 'raiz', para: 'b', rotulo: 'Ajuda' },
    { de: 'a', para: 'c', rotulo: 'Detalhes' },
    { de: 'b', para: 'd', rotulo: 'Detalhes' },
    { de: 'a', para: 'raiz', rotulo: 'Início' },
    { de: 'b', para: 'raiz', rotulo: 'Home' },
    { de: 'a', para: 'a', rotulo: 'Painel' },
  ],
}

await caso('menorCaminho: lista de arestas, [] na mesma tela, null sem caminho', () => {
  assert.deepEqual(R.menorCaminho(MAPA, 'raiz', 'd').map((a) => a.rotulo), ['Ajuda', 'Detalhes'])
  assert.equal(R.menorCaminho(MAPA, 'raiz', 'c').length, 2)
  assert.deepEqual(R.menorCaminho(MAPA, 'raiz', 'raiz'), [])
  assert.equal(R.menorCaminho(MAPA, 'd', 'raiz'), null)
  assert.equal(R.menorCaminho(MAPA, 'raiz', 'nao-existe'), null)
})

await caso('profundidades: cliques mínimos da raiz até cada tela', () => {
  assert.deepEqual(R.profundidades(MAPA), { raiz: 0, a: 1, b: 1, c: 2, d: 2 })
})

await caso('semVolta: telas de onde não se volta à raiz', () => {
  assert.deepEqual(R.semVolta(MAPA).sort(), ['c', 'd'])
  assert.deepEqual(R.semVolta({ telas: [], arestas: [{ de: 'raiz', para: 'a', rotulo: 'x' }, { de: 'a', para: 'raiz', rotulo: 'y' }] }), [])
})

await caso('rotulosInconsistentes: mesmo destino com rótulos diferentes, e mesmo rótulo com destinos diferentes', () => {
  const r = R.rotulosInconsistentes(MAPA)
  assert.deepEqual(r.mesmoDestino, [{ para: 'raiz', rotulos: ['Início', 'Home'] }])
  assert.deepEqual(r.mesmoRotulo, [{ rotulo: 'Detalhes', destinos: ['c', 'd'] }])
  // acento e caixa não criam inconsistência, e laço na própria tela é ignorado
  const igual = R.rotulosInconsistentes({ arestas: [{ de: 'a', para: 'raiz', rotulo: 'Início' }, { de: 'b', para: 'raiz', rotulo: 'INICIO ' }] })
  assert.deepEqual(igual, { mesmoDestino: [], mesmoRotulo: [] })
})

/* ================== 5. métricas e voto ================== */

const visitas = (...ts) => ts.map((tela) => ({ tela, escolha: 1, rotulo: 'x', pensamento: '', tempo: 100 }))

await caso('desorientação de Smith: N=6, R=3, S=8 dá 0,56', () => {
  const m = R.metricas(visitas('a', 'b', 'c', 'd', 'e', 'f', 'a', 'b'), 3)
  assert.equal(m.desorientacao, 0.56)
  assert.equal(m.passos, 8)
  assert.equal(m.revisitas, 2)
  assert.equal(m.otimo, 3)
})

await caso('métricas: caminho perfeito dá 0, voltas contam, sem mapa a desorientação é null', () => {
  assert.equal(R.metricas(visitas('a', 'b', 'c'), 3).desorientacao, 0)
  const ps = [...visitas('a', 'b'), { tela: 'b', escolha: 'voltar', rotulo: null, pensamento: '', tempo: 50 }, ...visitas('a')]
  const m = R.metricas(ps, 2, { sucesso: true })
  assert.equal(m.voltas, 1)
  assert.equal(m.revisitas, 2)
  assert.equal(m.sucesso, true)
  assert.equal(R.metricas(ps, null).desorientacao, null)
  assert.equal(R.metricas([], 3).desorientacao, null)
})

const sessao = (id, cerebro, extra = {}) => ({ id, tarefa: 'T1', cerebro, persona: 'novato', passos: visitas('raiz', 'a'), sucesso: false, desistiu: true, ...extra })

await caso('voto: 1 sessão não confirma', () => {
  const r = R.achados([sessao('s1', 'ia:haiku')])
  assert.equal(r.confirmados.length, 0)
  assert.equal(r.naoConfirmados.length, 1)
  assert.equal(r.naoConfirmados[0].tipo, 'desistiu')
  assert.equal(r.naoConfirmados[0].tela, 'a')
})

await caso('voto: 2 sessões do mesmo cérebro (e mesma persona) não confirmam', () => {
  const r = R.achados([sessao('s1', 'ia:haiku'), sessao('s2', 'ia:haiku')])
  assert.equal(r.confirmados.length, 0)
  assert.equal(r.naoConfirmados[0].sessoes.length, 2)
  assert.equal(r.naoConfirmados[0].autores.length, 1)
})

await caso('voto: 2 sessões de cérebros diferentes confirmam (e mesma persona com cérebro diferente também)', () => {
  const r = R.achados([sessao('s1', 'ia:haiku'), sessao('s2', 'humano')])
  assert.equal(r.confirmados.length, 1)
  assert.equal(r.confirmados[0].confirmado, true)
  assert.deepEqual(r.confirmados[0].sessoes, ['s1', 's2'])
  assert.equal(r.naoConfirmados.length, 0)
  // mesmo cérebro com persona diferente: autor diferente, confirma
  assert.equal(R.achados([sessao('s1', 'ia:haiku'), sessao('s2', 'ia:haiku', { persona: 'apressado' })]).confirmados.length, 1)
})

await caso('voto: "voltou" e "lento" entram, e a sessão conta uma vez por achado', () => {
  const voltou = (id, c) => ({ id, tarefa: 'T1', cerebro: c, persona: 'p', sucesso: true, desistiu: false, otimo: 1, passos: [{ tela: 'x', escolha: 'voltar' }, { tela: 'x', escolha: 'voltar' }, { tela: 'y', escolha: 3 }] })
  const r = R.achados([voltou('s1', 'A'), voltou('s2', 'B')])
  const tipos = r.confirmados.map((a) => a.tipo).sort()
  assert.deepEqual(tipos, ['lento', 'voltou'])
  assert.equal(r.confirmados.find((a) => a.tipo === 'voltou').sessoes.length, 2)
  // sem `otimo` não há como medir "lento"
  assert.equal(R.achados([{ ...voltou('s3', 'A'), otimo: undefined }]).naoConfirmados.some((a) => a.tipo === 'lento'), false)
})

await caso('voto: "não concluiu" e "clique sem efeito" (do piloto no Nexus), com o nome da tela vindo do mapa', () => {
  // dois cérebros gastam o orçamento sem chegar; os dois clicam no mesmo botão que não muda a tela
  const sessao = (id, c) => ({ id, tarefa: 'T1', cerebro: c, persona: 'novato', sucesso: false, desistiu: false,
    passos: [{ tela: 't9', para: 't9', escolha: 7, rotulo: 'Ler o quadro' }, { tela: 't9', para: 't2', escolha: 2, rotulo: 'Missões' }] })
  const mapa = { telas: [{ id: 't9', nome: 'QUADRO' }, { id: 't2', nome: 'MISSÕES' }] }
  const r = R.achados([sessao('s1', 'haiku'), sessao('s2', 'sonnet')], { mapa })
  assert.deepEqual(r.confirmados.map((a) => a.tipo).sort(), ['nao-concluiu', 'sem-efeito'])
  assert.match(r.confirmados.find((a) => a.tipo === 'sem-efeito').texto, /"Ler o quadro" na tela QUADRO e nada mudou/)
  // o clique que mudou de tela não é achado; quem chegou ao fim ou desistiu não "deixou de concluir"
  assert.equal(r.confirmados.some((a) => /Missões/.test(a.texto)), false)
  assert.equal(R.achados([{ ...sessao('s3', 'haiku'), sucesso: true }]).naoConfirmados.some((a) => a.tipo === 'nao-concluiu'), false)
  assert.equal(R.achados([{ ...sessao('s4', 'haiku'), desistiu: true }]).naoConfirmados.some((a) => a.tipo === 'nao-concluiu'), false)
  // sem mapa, o texto cai no id
  assert.match(R.achados([sessao('s5', 'haiku')]).naoConfirmados.find((a) => a.tipo === 'sem-efeito').texto, /na tela t9/)
})

/* ================== 6. a resposta do cérebro ================== */

await caso('analisarResposta: JSON certo, em cerca de código, com texto antes, e o último objeto vence', () => {
  assert.deepEqual(R.analisarResposta('{"escolha": 3, "pensamento": "parece o botão"}', [1, 3, 5]), { ok: true, escolha: 3, pensamento: 'parece o botão' })
  assert.equal(R.analisarResposta('Vou clicar.\n```json\n{"escolha": 2, "pensamento": "ok"}\n```').escolha, 2)
  assert.equal(R.analisarResposta('{"escolha": 9} e depois mudei: {"escolha": 4, "pensamento": "melhor"}').escolha, 4)
  assert.equal(R.analisarResposta('{"escolha": "7"}').escolha, 7)
  assert.equal(R.analisarResposta('{"escolha": "Voltar"}').escolha, 'voltar')
  assert.equal(R.analisarResposta('{"escolha": "desistir", "pensamento": "não achei"}').escolha, 'desistir')
  assert.equal(R.analisarResposta('{"escolha": 0}').escolha, 0)
})

await caso('analisarResposta: fora do formato é recusada com motivo', () => {
  for (const ruim of ['clique no 3', '', '{"escolha": }', '{"pensamento": "sem escolha"}', '{"escolha": -1}', '{"escolha": 2.5}', '{"escolha": "talvez"}', '{"escolha": null}']) {
    const r = R.analisarResposta(ruim)
    assert.equal(r.ok, false, `deveria recusar: ${ruim}`)
    assert.ok(r.erro)
  }
  const fora = R.analisarResposta('{"escolha": 8}', [1, 2, 3])
  assert.equal(fora.ok, false)
  assert.match(fora.erro, /não está na tela/)
  assert.equal(R.analisarResposta('{"escolha": "voltar"}', [1]).ok, true)
})

/* ================== 7. disco ================== */

await caso('ler/gravar: vazio sem arquivo, ida e volta, sem sobra de .tmp', () => {
  const d = pasta('disco')
  assert.deepEqual(R.ler(d), R.vazio())
  const e = R.responder(R.vazio(), 'f0-quem', 'gente', { de: 'ia:haiku' }).estado
  R.gravar(d, e)
  assert.deepEqual(R.ler(d), { ...R.vazio(), ...e })
  R.gravar(d, R.confirmar(e, 'f0-quem').estado)
  assert.ok(R.ler(d).respostas['f0-quem'].confirmadoEm)
  assert.deepEqual(readdirSync(join(d, 'docs', 'roteiro')), ['estado.json'])
})

await caso('ler: arquivo ilegível ERRA em vez de voltar vazio (gravar por cima apagaria tudo)', () => {
  const d = pasta('corrompido')
  mkdirSync(join(d, 'docs', 'roteiro'), { recursive: true })
  writeFileSync(join(d, 'docs', 'roteiro', 'estado.json'), '{ quebrado')
  assert.throws(() => R.ler(d), /ilegível/)
})

await caso('sessões: gravar e ler de volta, e leitura tolerante de linhas sem tipo', () => {
  const d = pasta('sessoes')
  const id = R.gravarSessao(d, { id: 'S1', tarefa: 'T1', cerebro: 'humano', persona: 'novato', otimo: 2, passos: visitas('raiz', 'a'), sucesso: true })
  assert.equal(id, 'S1')
  // formato solto: cabeçalho, passos e fecho sem "tipo"
  const solto = [
    { tarefa: 'T2', cerebro: 'ia:haiku', persona: 'apressado' },
    { tela: 'raiz', escolha: 1, rotulo: 'Painel' },
    { tela: 'a', escolha: 'desistir' },
    { sucesso: false, desistiu: true },
  ].map((l) => JSON.stringify(l)).join('\n')
  writeFileSync(join(d, 'docs', 'roteiro', 'sessoes', 'S2.jsonl'), solto)
  // formato de uma linha só, com a lista de passos
  writeFileSync(join(d, 'docs', 'roteiro', 'sessoes', 'S3.jsonl'), JSON.stringify({ tarefa: 'T1', cerebro: 'x', persona: 'p', passos: visitas('raiz'), sucesso: true }))
  const ss = R.lerSessoes(d)
  assert.deepEqual(ss.map((s) => s.id), ['S1', 'S2', 'S3'])
  assert.deepEqual([ss[0].tarefa, ss[0].cerebro, ss[0].passos.length, ss[0].sucesso, ss[0].otimo], ['T1', 'humano', 2, true, 2])
  assert.deepEqual([ss[1].tarefa, ss[1].persona, ss[1].passos.length, ss[1].desistiu], ['T2', 'apressado', 2, true])
  assert.deepEqual([ss[2].tarefa, ss[2].passos.length, ss[2].sucesso], ['T1', 1, true])
  assert.deepEqual(R.lerSessoes(pasta('sem-sessoes')), [])
})

/* ================== 8. o CLI, numa pasta temporária ================== */

await caso('cli: status mostra a fase atual e a próxima pergunta, sem escrever nada', async () => {
  const d = pasta('cli1')
  const r = await cli('status', '--projeto', d)
  assert.equal(r.code, 0)
  assert.match(r.saida, /0 de 9 fases prontas/)
  assert.match(r.saida, /Agora: fase 0, Enquadrar/)
  assert.match(r.saida, /\[1 de \d+\] Quem usa/)
  assert.match(r.saida, /faltam 6 perguntas desta fase/)
  assert.doesNotMatch(r.saida, /sem resposta/)
  assert.equal(existsSync(join(d, 'docs', 'roteiro', 'estado.json')), false)
  // sem subcomando é o mesmo que status; "roteiro" na frente também é aceito
  assert.equal((await cli('--projeto', d)).saida, r.saida)
  assert.equal((await cli('roteiro', 'status', '--projeto', d)).saida, r.saida)
})

await caso('cli: responder grava, mostra a próxima e marca palpite de IA', async () => {
  const d = pasta('cli2')
  const a = await cli('responder', 'Mãe', 'de', 'aluno,', 'no', 'celular', '--projeto', d)
  assert.equal(a.code, 0)
  assert.match(a.saida, /Quem usa: Mãe de aluno, no celular/)
  assert.match(a.saida, /Base/)
  assert.equal(R.ler(d).respostas['f0-quem'].de, 'ele')
  const b = await cli('responder', 'suposição', '--de', 'ia:haiku', '--projeto', d)
  assert.equal(b.code, 0)
  assert.match(b.saida, /palpite de ia:haiku/)
  assert.match(b.saida, /1 palpite\(s\) de IA esperando/)
  assert.equal(R.ler(d).respostas['f0-base'].de, 'ia:haiku')
  assert.match(b.saida, /Quem confirma/)
  // forma com igual
  const c = await cli('responder', 'o dono da escola', '--de=ia:haiku', '--projeto', d)
  assert.equal(c.code, 0)
  assert.equal(R.ler(d).respostas['f0-confirmar'].de, 'ia:haiku')
})

await caso('cli: responder recusa autor inválido e resposta fora das opções (código 1)', async () => {
  const d = pasta('cli3')
  await cli('responder', 'gente', '--projeto', d)
  const r = await cli('responder', 'talvez', '--projeto', d)
  assert.equal(r.code, 1)
  assert.match(r.saida, /responda com uma destas opções: dado, suposicao/)
  const s = await cli('responder', 'dado', '--de', 'robo', '--projeto', d)
  assert.equal(s.code, 1)
  assert.match(s.saida, /autor inválido/)
  assert.equal((await cli('responder', '--projeto', d)).code, 1)
})

await caso('cli: confirmar vira palpite em resposta de ele; desfazer apaga', async () => {
  const d = pasta('cli4')
  await cli('responder', 'gente', '--de', 'ia:haiku', '--projeto', d)
  const c = await cli('confirmar', 'f0-quem', '--projeto', d)
  assert.equal(c.code, 0)
  assert.match(c.saida, /confirmado: f0-quem \(resposta\)/)
  assert.doesNotMatch(c.saida, /palpite\(s\) de IA esperando/)
  assert.equal((await cli('confirmar', 'f0-quem', '--projeto', d)).code, 1)
  assert.equal((await cli('confirmar', '--projeto', d)).code, 1)
  const x = await cli('desfazer', 'f0-quem', '--projeto', d)
  assert.equal(x.code, 0)
  assert.deepEqual(R.ler(d).respostas, {})
})

await caso('cli: tarefa cria T1, T2; de IA é palpite; sem --sucesso avisa; agente recusa palpite', async () => {
  const d = pasta('cli5')
  const a = await cli('tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--papel', 'cliente', '--projeto', d)
  assert.equal(a.code, 0)
  assert.match(a.saida, /T1: pagar a fatura e ver o comprovante/)
  assert.equal(R.ler(d).tarefas[0].sucesso.texto, 'Comprovante')
  assert.equal(R.ler(d).tarefas[0].papel, 'cliente')
  const b = await cli('tarefa', 'trocar a senha', '--de', 'ia:haiku', '--projeto', d)
  assert.match(b.saida, /T2: trocar a senha/)
  assert.match(b.saida, /palpite de ia:haiku/)
  assert.match(b.saida, /sem --sucesso/)
  assert.equal((await cli('tarefa', '--projeto', d)).code, 1)
  const g = await cli('agente', 'T2', '--cerebro', 'humano', '--projeto', d)
  assert.equal(g.code, 1)
  assert.match(g.saida, /T2 é palpite de ia:haiku: confirme antes/)
  assert.equal((await cli('agente', 'T9', '--cerebro', 'humano', '--projeto', d)).code, 1)
  assert.match((await cli('agente', 'T1', '--projeto', d)).saida, /--cerebro/)
  await cli('confirmar', 'T2', '--projeto', d)
  assert.equal(R.ehPalpite(R.ler(d).tarefas[1]), false)
})

await caso('cli: mapa e agente sem os módulos do navegador dizem isso em português, sem quebrar', async () => {
  const d = pasta('cli6')
  await cli('tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--projeto', d)
  const sumiu = async () => { throw new Error('sumiu') }
  const m = await cliCom({ mapa: sumiu }, 'mapa', 'http://localhost:1', '--projeto', d)
  assert.equal(m.code, 1)
  assert.match(m.saida, /o mapa automático não está disponível/)
  assert.match(m.saida, /O resto do roteiro continua funcionando/)
  const g = await cliCom({ agente: sumiu }, 'agente', 'T1', '--cerebro', 'humano', '--quem', 'Ana', '--projeto', d)
  assert.equal(g.code, 1)
  assert.match(g.saida, /o agente não está disponível/)
  assert.equal((await cli('mapa', '--projeto', d)).code, 1)  // sem url
  assert.equal((await cli('status', '--projeto', d)).code, 0)  // o resto segue de pé
})

await caso('cli: achados e relatorio usam o que está em disco', async () => {
  const d = pasta('cli7')
  assert.match((await cli('achados', '--projeto', d)).saida, /nenhuma sessão ainda/)
  await cli('tarefa', 'abrir <b>menu</b> do app e ver a lista', '--sucesso', 'Lista de naves', '--projeto', d)
  R.gravarSessao(d, { id: 'S1', tarefa: 'T1', cerebro: 'ia:haiku', persona: 'novato', passos: visitas('raiz', 'a'), desistiu: true })
  R.gravarSessao(d, { id: 'S2', tarefa: 'T1', cerebro: 'humano', persona: 'Ana', passos: visitas('raiz', 'a'), desistiu: true })
  R.gravarSessao(d, { id: 'S3', tarefa: 'T1', cerebro: 'ia:haiku', persona: 'novato', passos: [{ tela: 'raiz', escolha: 'voltar' }, { tela: 'raiz', escolha: 1 }], sucesso: true })
  R.gravarMapa(d, MAPA)
  const a = await cli('achados', '--projeto', d)
  assert.match(a.saida, /Achados de 3 sessões/)
  assert.match(a.saida, /Confirmados \(2 ou mais autores diferentes\): 1/)
  assert.match(a.saida, /Não confirmados \(1 autor só\): 1/)
  // com o mapa em disco, o achado diz o nome da tela (a tela "a" se chama Painel), não o id
  assert.match(a.saida, /desistiu na tela Painel \(T1\): 2 sessões, 2 autores/)

  const r = await cli('relatorio', '--projeto', d)
  assert.equal(r.code, 0)
  const arq = join(d, 'docs', 'roteiro', 'relatorio.html')
  assert.ok(existsSync(arq))
  const html = readFileSync(arq, 'utf8')
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/)
  assert.match(html, /font:19px/)
  assert.match(html, /h1\{font-size:26px/)
  assert.match(html, /font-size:16px/)
  for (const t of ['Fase atual', 'Tarefas (1)', 'Análise do mapa', 'Cliques até cada tela', 'Telas sem volta (2 de 5)', 'Rótulos inconsistentes', 'Sessões (3)', 'Achados confirmados (1)', 'Achados não confirmados (1)']) {
    assert.ok(html.includes(t), `o relatório tem "${t}"`)
  }
  assert.ok(html.includes('&lt;b&gt;menu&lt;/b&gt;'), 'o texto da tarefa sai escapado')
  assert.ok(!html.includes('<b>menu</b>'))
  // confirmados e não confirmados separados: o confirmado não aparece na seção de não confirmados
  const [, depoisDosConfirmados] = html.split('Achados confirmados (1)')
  const [secaoConfirmados, secaoNao] = depoisDosConfirmados.split('Achados não confirmados (1)')
  assert.ok(secaoConfirmados.includes('desistiu na tela Painel'))
  assert.ok(secaoNao.includes('voltou na tela Início'))
  assert.ok(!secaoNao.includes('desistiu na tela Painel'))
})

await caso('cli: relatório com o projeto vazio também sai, sem mapa e sem sessões', () => {
  const html = relatorioHtml({ estado: R.vazio(), mapa: null, sessoes: [] })
  assert.match(html, /0 de 9 fases prontas/)
  assert.match(html, /o mapa ainda não foi feito/)
  assert.match(html, /nenhuma sessão ainda/)
  assert.match(html, /nenhum ainda/)
})

await caso('cli: comando desconhecido e pasta que não existe saem com código 1', async () => {
  assert.equal((await cli('dancar', '--projeto', pasta('cli8'))).code, 1)
  const r = await cli('status', '--projeto', join(tmp, 'nao-existe'))
  assert.equal(r.code, 1)
  assert.match(r.saida, /a pasta do projeto não existe/)
  const ruim = pasta('cli9')
  mkdirSync(join(ruim, 'docs', 'roteiro'), { recursive: true })
  writeFileSync(join(ruim, 'docs', 'roteiro', 'estado.json'), 'nao e json')
  const q = await cli('status', '--projeto', ruim)
  assert.equal(q.code, 1)
  assert.match(q.saida, /ilegível/)
})

await caso('cli: como processo de verdade, o código de saída chega ao shell', () => {
  const d = pasta('proc')
  const roda = (...args) => spawnSync(process.execPath, ['--input-type=module', '-e', `import(${JSON.stringify(join(AQUI, 'src', 'roteiroCli.mjs'))}).then((m) => m.main(process.argv.slice(1)))`, ...args], { encoding: 'utf8' })
  const ok = roda('status', '--projeto', d)
  assert.equal(ok.status, 0)
  assert.match(ok.stdout, /0 de 9 fases prontas/)
  const ruim = roda('dancar', '--projeto', d)
  assert.equal(ruim.status, 1)
  assert.match(ruim.stderr, /comando desconhecido: dancar/)
})

await caso('analisar: flags com valor não viram posicionais', () => {
  const a = analisar(['agente', 'T1', '--cerebro', 'humano', '--cerebro', 'comando:opencode run', '--vezes', '2', '--persona=novato'])
  assert.deepEqual(a.pos, ['agente', 'T1'])
  assert.deepEqual(a.todos('--cerebro'), ['humano', 'comando:opencode run'])
  assert.equal(a.flag('--vezes'), '2')
  assert.equal(a.flag('--persona'), 'novato')
})

/* ================== 8b. pedidos do piloto no Nexus ================== */

const MAPA_PARCIAL = {
  telas: [
    { id: 'raiz', explorada: true }, { id: 'a', explorada: true }, { id: 'b', explorada: false },
    { id: 'c', explorada: true }, { id: 'x', explorada: true }, { id: 'y', explorada: false },
  ],
  arestas: [
    { de: 'raiz', para: 'a', rotulo: 'A' }, { de: 'a', para: 'b', rotulo: 'B' }, { de: 'a', para: 'c', rotulo: 'C' },
    { de: 'a', para: 'raiz', rotulo: 'Início' }, { de: 'raiz', para: 'x', rotulo: 'X' }, { de: 'x', para: 'y', rotulo: 'Y' },
  ],
}

await caso('semVolta: tela não explorada até o fim nunca é acusada, nem sustenta acusação a quem passa por ela', () => {
  assert.deepEqual(R.naoExploradas(MAPA_PARCIAL), ['b', 'y'])
  // c foi explorada e não tem saída: é a única acusada. b e y estão cortadas pelo prazo, e x só chega à raiz por y.
  assert.deepEqual(R.semVolta(MAPA_PARCIAL), ['c'])
  // sem a marca `explorada` (mapa antigo), o resultado é o de antes: tudo que não volta é acusado
  const antigo = { telas: MAPA_PARCIAL.telas.map((t) => ({ id: t.id })), arestas: MAPA_PARCIAL.arestas }
  assert.deepEqual(R.semVolta(antigo).sort(), ['b', 'c', 'x', 'y'])
  assert.deepEqual(R.naoExploradas(antigo), [])
  // o caso do Nexus: 1 tela explorada que volta, o resto cortado pelo prazo
  const nexus = {
    telas: [{ id: 'raiz', explorada: true }, ...['t1', 't2', 't3'].map((id) => ({ id, explorada: false }))],
    arestas: ['t1', 't2', 't3'].map((para) => ({ de: 'raiz', para, rotulo: para })),
  }
  assert.deepEqual(R.semVolta(nexus), [])
  assert.equal(R.naoExploradas(nexus).length, 3)
})

await caso('analisarResposta: "rolar" e "rolar acima" valem, sem número e sem depender da lista da tela', () => {
  assert.deepEqual(R.analisarResposta('{"escolha": "rolar", "pensamento": "o botão deve estar mais embaixo"}', [1, 2]), { ok: true, escolha: 'rolar', pensamento: 'o botão deve estar mais embaixo' })
  assert.equal(R.analisarResposta('{"escolha": "Rolar acima"}').escolha, 'rolar acima')
  assert.equal(R.analisarResposta('Vou descer.\n{"escolha": "rolar"}').escolha, 'rolar')
  assert.equal(R.analisarResposta('{"escolha": "rolar para o lado"}').ok, false)
  assert.equal(R.analisarResposta('{"escolha": 3}', [3]).escolha, 3)
})

await caso('métricas: passo de rolar não é visita (não pesa na desorientação) e aparece em rolagens', () => {
  const rola = (tela, escolha = 'rolar') => ({ tela, escolha, rotulo: null, pensamento: '', tempo: 10 })
  const m = R.metricas([...visitas('a', 'b'), rola('b'), rola('b', 'rolar acima'), ...visitas('c')], 3)
  assert.equal(m.passos, 5)
  assert.equal(m.rolagens, 2)
  assert.equal(m.revisitas, 0)
  assert.equal(m.desorientacao, 0)
})

await caso('opcoesDoNavegador: --prazo em minutos vira prazoMs, --nao-tocar e --idioma passam, erro é dito antes', () => {
  const ler = (...args) => opcoesDoNavegador(analisar(args), { prazo: true })
  assert.deepEqual(ler('mapa', 'http://x', '--prazo', '10', '--nao-tocar', 'sair|apagar', '--idioma', 'pt-BR'), { opcoes: { prazoMs: 600000, naoTocar: 'sair|apagar', idioma: 'pt-BR' } })
  assert.deepEqual(ler('mapa', 'http://x', '--prazo', '0,5'), { opcoes: { prazoMs: 30000 } })
  assert.deepEqual(ler('mapa', 'http://x'), { opcoes: {} })
  assert.match(ler('mapa', 'x', '--prazo', '0').erro, /--prazo é em minutos/)
  assert.match(ler('mapa', 'x', '--prazo', 'logo').erro, /--prazo é em minutos/)
  assert.match(ler('mapa', 'x', '--nao-tocar', '(').erro, /expressão regular válida/)
  // o agente não tem prazo: a flag é ignorada lá
  assert.deepEqual(opcoesDoNavegador(analisar(['agente', 'T1', '--prazo', '10', '--idioma', 'pt-BR'])), { opcoes: { idioma: 'pt-BR' } })
})

// um mapa que imita o Nexus: todo título "APPS", quase tudo cortado pelo prazo, e rótulos duplicados de sobra
const MAPA_NEXUS = (() => {
  const telas = [{ id: 'raiz', nome: 'Início', titulo: 'APPS', explorada: true }, { id: 't1', nome: 'Naves', titulo: 'APPS', explorada: true }]
  const arestas = [{ de: 'raiz', para: 't1', rotulo: 'Naves' }, { de: 't1', para: 'raiz', rotulo: 'Voltar' }]
  for (let i = 2; i <= 7; i++) {
    telas.push(i === 7 ? { id: 't7', titulo: 'Sobre', explorada: false } : { id: `t${i}`, nome: `Detalhe ${i}`, titulo: 'APPS', explorada: false })
    arestas.push({ de: 'raiz', para: `t${i}`, rotulo: `Atalho ${i}` }, { de: 't1', para: `t${i}`, rotulo: `Aba ${i}` })
  }
  arestas.push({ de: 'raiz', para: 't2', rotulo: 'Painel dois' }) // t2 tem 3 rótulos: o mais forte
  return { url: 'http://x', telas, arestas }
})()

await caso('cli: mapa repassa --prazo, --nao-tocar e --idioma ao plano, e a saída usa nome, avisa o que o prazo cortou e limita os rótulos', async () => {
  const d = pasta('cli-nexus')
  let plano = null
  const mapa = async () => ({
    executarMapa: async (p) => {
      plano = p
      R.gravarMapa(p.raiz, MAPA_NEXUS)
      return join(p.saida, 'mapa.json')
    },
  })
  const r = await cliCom({ mapa }, 'mapa', 'http://x', '--max', '9', '--prazo', '10', '--nao-tocar', 'sair|apagar', '--idioma', 'pt-BR', '--projeto', d)
  assert.equal(r.code, 0, r.saida)
  assert.equal(plano.url, 'http://x')
  assert.equal(plano.maxTelas, 9)
  assert.equal(plano.prazoMs, 600000)
  assert.equal(plano.naoTocar, 'sair|apagar')
  assert.equal(plano.idioma, 'pt-BR')
  assert.ok(plano.saida.endsWith(join('docs', 'roteiro')))
  // nome no lugar de título, com título como reserva (t7 não tem nome)
  assert.match(r.saida, /0 cliques \(1 tela\): Início/)
  assert.match(r.saida, /Naves, Detalhe 2/)
  assert.match(r.saida, /Sobre/)
  assert.doesNotMatch(r.saida, /APPS/)
  // semVolta só acusa tela explorada: aqui nenhuma, e o que o prazo cortou vira uma linha
  assert.match(r.saida, /Sem volta à raiz: nenhuma \(0 de 8 telas\)/)
  assert.match(r.saida, /6 de 8 telas não foram exploradas até o fim \(o tempo acabou\): rode de novo com --prazo maior/)
  // 6 lugares com rótulos diferentes: os 5 mais fortes e "e mais 1", o de 3 rótulos primeiro
  const linhas = r.saida.split('\n').filter((l) => l.startsWith('Rótulos diferentes para o mesmo lugar'))
  assert.equal(linhas.length, 5)
  assert.match(linhas[0], /Detalhe 2.*"Atalho 2" e "Aba 2" e "Painel dois"/)
  assert.match(r.saida, /e mais 1 lugar com rótulos diferentes/)

  // o relatório diz a mesma coisa
  await cli('relatorio', '--projeto', d)
  const html = readFileSync(join(d, 'docs', 'roteiro', 'relatorio.html'), 'utf8')
  assert.ok(html.includes('6 de 8 telas não foram exploradas até o fim'))
  assert.ok(html.includes('e mais 1 lugar com rótulos diferentes'))
  assert.ok(html.includes('Detalhe 2') && html.includes('Início') && !html.includes('APPS'))
  assert.ok(html.includes('Telas sem volta (0 de 8)'))
})

await caso('cli: flags inválidas do mapa e do agente param antes de abrir o navegador', async () => {
  const d = pasta('cli-flags')
  await cli('tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--projeto', d)
  let chamou = 0
  const mapa = async () => { chamou++; return { executarMapa: async () => '' } }
  const agente = async () => { chamou++; return { rodadas: async () => {} } }
  const a = await cliCom({ mapa }, 'mapa', 'http://x', '--prazo', '0', '--projeto', d)
  assert.equal(a.code, 1)
  assert.match(a.saida, /--prazo é em minutos/)
  const b = await cliCom({ mapa }, 'mapa', 'http://x', '--nao-tocar', '(', '--projeto', d)
  assert.equal(b.code, 1)
  assert.match(b.saida, /expressão regular válida/)
  const c = await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'humano', '--nao-tocar', '[', '--projeto', d)
  assert.equal(c.code, 1)
  assert.match(c.saida, /expressão regular válida/)
  assert.equal(chamou, 0, 'nenhum módulo do navegador foi carregado')
})

await caso('cli: agente repassa --nao-tocar e --idioma (e não o prazo) às rodadas', async () => {
  const d = pasta('cli-agente')
  await cli('tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--projeto', d)
  let recebido = null
  const agente = async () => ({ rodadas: async (tarefa, opcoes) => { recebido = { tarefa, opcoes } } })
  const r = await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'roteiro:x.json', '--persona', 'Ana', '--vezes', '2', '--nao-tocar', 'sair', '--idioma', 'pt-BR', '--prazo', '5', '--projeto', d)
  assert.equal(r.code, 0, r.saida)
  assert.equal(recebido.tarefa.id, 'T1')
  assert.deepEqual(recebido.opcoes.cerebros, ['roteiro:x.json'])
  assert.deepEqual(recebido.opcoes.personas, [{ nome: 'Ana' }])
  assert.equal(recebido.opcoes.vezes, 2)
  assert.equal(recebido.opcoes.naoTocar, 'sair')
  assert.equal(recebido.opcoes.idioma, 'pt-BR')
  assert.equal('prazoMs' in recebido.opcoes, false)
  // sem as flags, as chaves nem existem (o agente usa o padrão dele)
  await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'humano', '--quem', 'Ana', '--projeto', d)
  assert.equal('naoTocar' in recebido.opcoes || 'idioma' in recebido.opcoes, false)
})


/* ================== 8c. revisão de código: autoria, voto, não clicou, flags ================== */

const SEM_TTY = (extra = {}) => ({ tty: () => false, ...extra })

await caso('autoria: sem terminal de verdade, responder exige --de, e --de ele exige --citacao', async () => {
  const d = pasta('autoria1')
  const sem = await cliCom(SEM_TTY(), 'responder', 'Mãe de aluno', '--projeto', d)
  assert.equal(sem.code, 1)
  assert.match(sem.saida, /sem terminal de verdade, diga quem está escrevendo/)
  assert.match(sem.saida, /--de ia:<modelo>/)
  assert.equal(existsSync(join(d, 'docs', 'roteiro', 'estado.json')), false, 'nada foi gravado')
  const ele = await cliCom(SEM_TTY(), 'responder', 'Mãe de aluno', '--de', 'ele', '--projeto', d)
  assert.equal(ele.code, 1)
  assert.match(ele.saida, /--de ele sem terminal de verdade exige --citacao/)
  const vazia = await cliCom(SEM_TTY(), 'responder', 'Mãe de aluno', '--de', 'ele', '--citacao', '   ', '--projeto', d)
  assert.equal(vazia.code, 1)
  assert.equal(existsSync(join(d, 'docs', 'roteiro', 'estado.json')), false)

  const ok = await cliCom(SEM_TTY(), 'responder', 'Mãe de aluno', '--de', 'ele', '--citacao', 'é a mãe de aluno mesmo, na fila da escola', '--projeto', d)
  assert.equal(ok.code, 0, ok.saida)
  assert.match(ok.saida, /registrado como dele, com a citação/)
  const r = R.ler(d).respostas['f0-quem']
  assert.equal(r.de, 'ele')
  assert.deepEqual(r.por, { de: 'ele', via: 'ia', citacao: 'é a mãe de aluno mesmo, na fila da escola' })
  assert.equal(R.ehPalpite(r), false)

  const ia = await cliCom(SEM_TTY(), 'responder', 'dado', '--de', 'ia:haiku', '--projeto', d)
  assert.equal(ia.code, 0, ia.saida)
  assert.equal(R.ler(d).respostas['f0-base'].de, 'ia:haiku')
  assert.equal('por' in R.ler(d).respostas['f0-base'], false)
})

await caso('autoria: --de programa é recusado na linha de comando, com ou sem terminal', async () => {
  const d = pasta('autoria2')
  for (const injetados of [SEM_TTY(), { tty: () => true }]) {
    const r = await cliCom(injetados, 'responder', 'x', '--de', 'programa', '--citacao', 'qualquer', '--projeto', d)
    assert.equal(r.code, 1)
    assert.match(r.saida, /--de programa é recusado na linha de comando/)
    const t = await cliCom(injetados, 'tarefa', 'pagar a fatura e ver o comprovante', '--de', 'programa', '--projeto', d)
    assert.equal(t.code, 1)
    assert.match(t.saida, /só o código grava 'programa'/)
  }
  assert.equal(existsSync(join(d, 'docs', 'roteiro', 'estado.json')), false)
  // o código continua podendo gravar 'programa'
  assert.equal(R.responder(R.vazio(), 'f0-quem', 'medido', { de: 'programa' }).resposta.de, 'programa')
})

await caso('autoria: em terminal de verdade, sem --de vale como ele (via terminal), em responder e em tarefa', async () => {
  const d = pasta('autoria3')
  const r = await cliCom({ tty: () => true }, 'responder', 'Mãe de aluno', '--projeto', d)
  assert.equal(r.code, 0, r.saida)
  assert.deepEqual(R.ler(d).respostas['f0-quem'].por, { de: 'ele', via: 'terminal' })
  const t = await cliCom({ tty: () => true }, 'tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--projeto', d)
  assert.equal(t.code, 0, t.saida)
  assert.equal(R.ler(d).tarefas[0].de, 'ele')
  assert.deepEqual(R.ler(d).tarefas[0].por, { de: 'ele', via: 'terminal' })
})

await caso('autoria: tarefa sem terminal segue a mesma regra, e a citação fica gravada', async () => {
  const d = pasta('autoria4')
  const sem = await cliCom(SEM_TTY(), 'tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--projeto', d)
  assert.equal(sem.code, 1)
  assert.match(sem.saida, /sem terminal de verdade/)
  const ele = await cliCom(SEM_TTY(), 'tarefa', 'pagar a fatura e ver o comprovante', '--de', 'ele', '--projeto', d)
  assert.equal(ele.code, 1)
  assert.match(ele.saida, /exige --citacao/)
  const ok = await cliCom(SEM_TTY(), 'tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--de', 'ele', '--citacao', 'a tarefa principal é pagar a fatura', '--projeto', d)
  assert.equal(ok.code, 0, ok.saida)
  assert.deepEqual(R.ler(d).tarefas[0].por, { de: 'ele', via: 'ia', citacao: 'a tarefa principal é pagar a fatura' })
  const ia = await cliCom(SEM_TTY(), 'tarefa', 'trocar a senha de acesso', '--de', 'ia:haiku', '--projeto', d)
  assert.equal(ia.code, 0, ia.saida)
  assert.equal(R.ehPalpite(R.ler(d).tarefas[1]), true)
})

await caso('autoria: confirmar sem terminal exige --citacao e grava confirmadoPor; no terminal vale como ele', async () => {
  const d = pasta('autoria5')
  await cliCom(SEM_TTY(), 'responder', 'gente de rua', '--de', 'ia:haiku', '--projeto', d)
  await cliCom(SEM_TTY(), 'tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--de', 'ia:haiku', '--projeto', d)
  const sem = await cliCom(SEM_TTY(), 'confirmar', 'f0-quem', '--projeto', d)
  assert.equal(sem.code, 1)
  assert.match(sem.saida, /sem terminal de verdade, confirmar exige --citacao/)
  assert.equal(R.ehPalpite(R.ler(d).respostas['f0-quem']), true, 'continua palpite')
  assert.equal((await cliCom(SEM_TTY(), 'confirmar', 'f0-quem', '--citacao', ' ', '--projeto', d)).code, 1)

  const ok = await cliCom(SEM_TTY(), 'confirmar', 'f0-quem', '--citacao', 'isso, é isso mesmo', '--projeto', d)
  assert.equal(ok.code, 0, ok.saida)
  const r = R.ler(d).respostas['f0-quem']
  assert.equal(R.ehPalpite(r), false)
  assert.equal(r.de, 'ia:haiku', 'o autor continua sendo a IA')
  assert.deepEqual(r.confirmadoPor, { de: 'ele', via: 'ia', citacao: 'isso, é isso mesmo' })

  const t = await cli('confirmar', 'T1', '--projeto', d) // terminal de verdade
  assert.equal(t.code, 0, t.saida)
  assert.deepEqual(R.ler(d).tarefas[0].confirmadoPor, { de: 'ele', via: 'terminal' })
  assert.equal(R.ehPalpite(R.ler(d).tarefas[0]), false)
})

await caso('autoria: o núcleo guarda por e confirmadoPor sem exigir nada (quem confere é a linha de comando)', () => {
  const por = { de: 'ele', via: 'ia', citacao: 'sim' }
  const r = R.responder(R.vazio(), 'f0-quem', 'gente', { de: 'ia:x' })
  assert.equal('por' in r.resposta, false)
  assert.deepEqual(R.responder(R.vazio(), 'f0-quem', 'gente', { por }).resposta.por, por)
  assert.deepEqual(R.confirmar(r.estado, 'f0-quem', { por }).estado.respostas['f0-quem'].confirmadoPor, por)
  assert.equal('confirmadoPor' in R.confirmar(r.estado, 'f0-quem').estado.respostas['f0-quem'], false)
  assert.deepEqual(R.novaTarefa(R.vazio(), { objetivo: 'pagar a fatura', por }).tarefa.por, por)
})

await caso('voto: a chave é a assinatura da tela (e a tela só na falta dela); o texto leva o nome do mapa', () => {
  const mapa = { telas: [{ id: 't1', assinatura: 'sigA', nome: 'Quadro de missões' }] }
  const s = (id, cerebro, tela) => ({ id, tarefa: 'T1', cerebro, persona: 'p', sucesso: false, desistiu: true, passos: [{ tela, assinatura: 'sigA', escolha: 1 }] })
  // ids de tela diferentes (o mesmo conteúdo) caem no mesmo achado e confirmam
  const r = R.achados([s('s1', 'A', 't9'), s('s2', 'B', 'outro')], { mapa })
  assert.equal(r.confirmados.length, 1)
  assert.equal(r.confirmados[0].tela, 'sigA')
  assert.equal(r.confirmados[0].texto, 'desistiu na tela Quadro de missões')
  // sem assinatura, vale a tela: ids diferentes são achados diferentes e não confirmam
  const sem = (id, cerebro, tela) => ({ id, tarefa: 'T1', cerebro, persona: 'p', desistiu: true, passos: [{ tela, escolha: 1 }] })
  const q = R.achados([sem('s1', 'A', 't9'), sem('s2', 'B', 'outro')])
  assert.equal(q.confirmados.length, 0)
  assert.equal(q.naoConfirmados.length, 2)
  // o nome também sai quando o mapa só conhece a tela pelo id
  assert.match(R.achados([sem('s3', 'A', 't1')], { mapa }).naoConfirmados[0].texto, /Quadro de missões/)
})

await caso('voto: "sem efeito" compara assinatura com paraAssinatura quando existem, senão tela com para', () => {
  const passo = (extra) => ({ id: 's1', tarefa: 'T1', cerebro: 'A', persona: 'p', sucesso: true, passos: [{ escolha: 3, rotulo: 'Abrir', ...extra }] })
  const tipos = (s) => R.achados([s]).naoConfirmados.map((a) => a.tipo)
  assert.deepEqual(tipos(passo({ tela: 'x', para: 'y', assinatura: 'sigA', paraAssinatura: 'sigA' })), ['sem-efeito'])
  assert.deepEqual(tipos(passo({ tela: 'x', para: 'x', assinatura: 'sigA', paraAssinatura: 'sigB' })), [])
  assert.deepEqual(tipos(passo({ tela: 'x', para: 'x' })), ['sem-efeito'])
  assert.deepEqual(tipos(passo({ tela: 'x', para: 'y' })), [])
})

await caso('voto: cérebro humano precisa de nome, e a mesma pessoa com duas personas não se confirma sozinha', () => {
  const h = (id, quem, persona, extra = {}) => ({ id, tarefa: 'T1', cerebro: 'humano', quem, persona, desistiu: true, passos: [{ tela: 'a', escolha: 1 }], ...extra })
  assert.equal(R.autorDaSessao(h('s1', 'Ana', 'novato')), 'humano:ana')
  assert.equal(R.autorDaSessao({ cerebro: 'humano:Bia Lima', persona: 'x' }), 'humano:bia lima')
  assert.equal(R.autorDaSessao({ cerebro: 'ia:haiku', persona: 'novato' }), 'ia:haiku|novato')
  // Ana em duas personas: um autor só
  const a = R.achados([h('s1', 'Ana', 'novato'), h('s2', 'Ana', 'apressado'), h('s3', 'ana ', 'cansado')])
  assert.equal(a.confirmados.length, 0)
  assert.equal(a.naoConfirmados[0].autores.length, 1)
  assert.equal(a.naoConfirmados[0].sessoes.length, 3)
  // Ana e Bia: duas pessoas, confirma
  assert.equal(R.achados([h('s1', 'Ana', 'novato'), h('s2', 'Bia', 'novato')]).confirmados.length, 1)
  // humano sem nome: todos juntos, nunca confirma sozinho
  assert.equal(R.achados([h('s1', undefined, 'novato'), h('s2', '', 'apressado')]).confirmados.length, 0)
  // humano e IA são autores diferentes
  assert.equal(R.achados([h('s1', 'Ana', 'novato'), sessao('s2', 'ia:haiku')]).confirmados.length, 1)
})

await caso('cli: agente com cérebro humano exige --quem e repassa o nome', async () => {
  const d = pasta('quem')
  await cli('tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--projeto', d)
  let chamou = 0
  let opcoes = null
  const agente = async () => { chamou++; return { rodadas: async (t, o) => { opcoes = o } } }
  const sem = await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'humano', '--projeto', d)
  assert.equal(sem.code, 1)
  assert.match(sem.saida, /--cerebro humano exige --quem "<nome da pessoa>"/)
  assert.equal((await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'humano', '--quem', '  ', '--projeto', d)).code, 1)
  assert.equal(chamou, 0, 'o agente nem foi carregado')
  const ok = await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'humano', '--quem', 'Ana Souza', '--projeto', d)
  assert.equal(ok.code, 0, ok.saida)
  assert.equal(opcoes.quem, 'Ana Souza')
  // cérebro de IA não precisa de nome
  const ia = await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'roteiro:x.json', '--projeto', d)
  assert.equal(ia.code, 0, ia.saida)
  assert.equal('quem' in opcoes, false)
})

await caso('voto: passo com falha ou perdido é "não clicou": nunca sem-efeito, nunca achado confirmado, só listado à parte', () => {
  const s = (id, cerebro) => ({
    id, tarefa: 'T1', cerebro, persona: 'p', sucesso: true,
    passos: [
      { tela: 'a', para: 'a', escolha: 4, rotulo: 'Sair', falha: 'protegido' }, // teria cara de "sem efeito", mas o programa nem clicou
      { tela: 'a', escolha: 5, rotulo: 'Abrir', falha: 'tapado por outro elemento' },
      { tela: 'a', escolha: null, perdido: true },
    ],
  })
  const r = R.achados([s('s1', 'A'), s('s2', 'B')])
  assert.equal(r.confirmados.length, 0)
  assert.equal(r.naoConfirmados.some((a) => a.tipo === 'sem-efeito'), false)
  assert.deepEqual(r.naoClicou.map((a) => a.tipo), ['nao-clicou', 'nao-clicou', 'nao-clicou'])
  assert.ok(r.naoClicou.every((a) => a.confirmado === false), 'dois autores não confirmam este tipo')
  assert.ok(r.naoClicou.some((a) => /o programa não clicou em "Sair" na tela a: protegido/.test(a.texto)))
  assert.ok(r.naoClicou.some((a) => /passo perdido na tela a/.test(a.texto)))
  assert.equal(r.naoClicou.find((a) => /Sair/.test(a.texto)).sessoes.length, 2)
  // clique que o programa fez e não mudou nada continua sendo sem-efeito
  const real = R.achados([{ id: 's3', tarefa: 'T1', cerebro: 'A', persona: 'p', sucesso: true, passos: [{ tela: 'a', para: 'a', escolha: 4, rotulo: 'Sair' }] }])
  assert.equal(real.naoConfirmados.some((a) => a.tipo === 'sem-efeito'), true)
  assert.deepEqual(real.naoClicou, [])
})

await caso('cli: achados e relatório listam "cliques que o programa não fez" à parte', async () => {
  const d = pasta('nao-clicou')
  await cli('tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--projeto', d)
  R.gravarSessao(d, { id: 'S1', tarefa: 'T1', cerebro: 'humano', quem: 'Ana', persona: 'novato', sucesso: true, passos: [{ tela: 'a', escolha: 2, rotulo: 'Sair', falha: 'protegido' }, { tela: 'a', escolha: 3, rotulo: 'Ok' }] })
  const a = await cli('achados', '--projeto', d)
  assert.match(a.saida, /Cliques que o programa não fez \(não contam como achado da interface\): 1/)
  assert.match(a.saida, /o programa não clicou em "Sair" na tela a: protegido/)
  assert.match(a.saida, /Confirmados \(2 ou mais autores diferentes\): 0/)
  await cli('relatorio', '--projeto', d)
  const html = readFileSync(join(d, 'docs', 'roteiro', 'relatorio.html'), 'utf8')
  assert.ok(html.includes('Cliques que o programa não fez (1)'))
  assert.ok(html.includes('humano:ana'), 'o autor humano aparece com o nome')
})

await caso('opcoesDoNavegador: --qualquer-url, --nao-tocar soma e --nao-tocar-so troca (e os dois juntos é erro)', () => {
  const ler = (...args) => opcoesDoNavegador(analisar(args), { prazo: true })
  assert.deepEqual(ler('mapa', 'http://x'), { opcoes: {} })
  assert.deepEqual(ler('mapa', 'http://x', '--qualquer-url'), { opcoes: { qualquerUrl: true } })
  assert.deepEqual(ler('mapa', 'http://x', '--nao-tocar', 'pagar'), { opcoes: { naoTocar: 'pagar' } })
  assert.deepEqual(ler('mapa', 'http://x', '--nao-tocar-so', 'sair'), { opcoes: { naoTocarSo: 'sair' } })
  assert.deepEqual(ler('mapa', 'http://x', '--nao-tocar-so=sair|apagar', '--qualquer-url'), { opcoes: { naoTocarSo: 'sair|apagar', qualquerUrl: true } })
  assert.match(ler('mapa', 'x', '--nao-tocar', 'a', '--nao-tocar-so', 'b').erro, /use --nao-tocar .* ou --nao-tocar-so/)
  assert.match(ler('mapa', 'x', '--nao-tocar-so', '(').erro, /--nao-tocar-so não é uma expressão regular válida/)
  assert.deepEqual(opcoesDoNavegador(analisar(['agente', 'T1', '--qualquer-url', '--nao-tocar-so', 'x'])), { opcoes: { qualquerUrl: true, naoTocarSo: 'x' } })
})

await caso('cli: mapa e agente repassam qualquerUrl, naoTocar e naoTocarSo; sem as flags as chaves nem existem', async () => {
  const d = pasta('url')
  await cli('tarefa', 'pagar a fatura e ver o comprovante', '--sucesso', 'Comprovante', '--projeto', d)
  let plano = null
  let opcoes = null
  const mapa = async () => ({ executarMapa: async (p) => { plano = p; R.gravarMapa(p.raiz, MAPA); return join(p.saida, 'mapa.json') } })
  const agente = async () => ({ rodadas: async (t, o) => { opcoes = o } })
  await cliCom({ mapa }, 'mapa', 'http://x', '--qualquer-url', '--nao-tocar', 'pagar', '--projeto', d)
  assert.equal(plano.qualquerUrl, true)
  assert.equal(plano.naoTocar, 'pagar')
  assert.equal('naoTocarSo' in plano, false)
  await cliCom({ mapa }, 'mapa', 'http://x', '--nao-tocar-so', 'sair', '--projeto', d)
  assert.equal(plano.naoTocarSo, 'sair')
  assert.equal('naoTocar' in plano || 'qualquerUrl' in plano, false)
  await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'roteiro:x.json', '--qualquer-url', '--nao-tocar-so', 'sair', '--projeto', d)
  assert.equal(opcoes.qualquerUrl, true)
  assert.equal(opcoes.naoTocarSo, 'sair')
  await cliCom({ agente }, 'agente', 'T1', '--cerebro', 'roteiro:x.json', '--projeto', d)
  assert.equal('qualquerUrl' in opcoes || 'naoTocarSo' in opcoes || 'naoTocar' in opcoes, false)
  const dois = await cliCom({ mapa }, 'mapa', 'http://x', '--nao-tocar', 'a', '--nao-tocar-so', 'b', '--projeto', d)
  assert.equal(dois.code, 1)
})

/* ================== 9. a regra de escrita ================== */

await caso('nenhum travessão nos textos do programa, nem na saída do status', async () => {
  const TRACO = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`)
  for (const arq of ['src/roteiro.mjs', 'src/roteiroCli.mjs', 'test-roteiro.mjs']) {
    assert.ok(!TRACO.test(readFileSync(join(AQUI, arq), 'utf8')), `${arq} sem travessão`)
  }
  const e = preencher(comTarefas())
  assert.ok(!TRACO.test(R.resumo(e)))
  assert.ok(!TRACO.test(relatorioHtml({ estado: e, mapa: MAPA, sessoes: [] })))
  const d = pasta('escrita')
  assert.ok(!TRACO.test((await cli('status', '--projeto', d)).saida))
  for (const p of R.todas(comTarefas())) {
    const t = R.textoDaPergunta(p, comTarefas())
    assert.ok(!TRACO.test(t + (p.ajuda || '')), `pergunta ${p.id} sem travessão`)
  }
})

console.log(`\ntest-roteiro: ${n} casos ok, ${falhas} falhas`)
process.exit(falhas ? 1 : 0)
