// CC-960: modelo e esforço decididos antes, por critério (CC-973), e a sessão abre sabendo (CC-974).
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import * as MO from './src/modelo.mjs'
import * as B from './src/backlog.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++ }
const ind = (i) => MO.indicado({ id: 'X-1', ...i })

// as regras, na ordem
ok(ind({ natureza: 'DEC', tamanho: 'G' }).modelo === null, 'decisão dele não pede modelo, nem grande')
ok(ind({ natureza: 'PED', tamanho: 'G', area: 'tela' }).modelo === 'opusplan', 'grande: Opus planeja, Sonnet executa')
ok(ind({ natureza: 'DEF', tamanho: 'P', area: 'tela' }).esforco === 'medium', 'defeito pequeno: esforço médio')
ok(ind({ natureza: 'DEF', tamanho: 'M', area: 'tela' }).modelo === 'opus' && ind({ natureza: 'DEF', tamanho: 'M' }).esforco === 'high', 'defeito médio: Opus, alto')
ok(ind({ natureza: 'PED', tamanho: 'P', area: 'tela', risco: 'cliente' }).modelo === 'opus', 'chega no cliente: Opus')
ok(ind({ natureza: 'PED', tamanho: 'P', area: 'trava' }).modelo === 'opus', 'trava: alcance largo, Opus')
ok(ind({ natureza: 'MED', tamanho: 'M', area: 'dado' }).modelo === 'sonnet', 'medição: Sonnet')
ok(ind({ natureza: 'DOC', tamanho: 'M', area: 'texto' }).esforco === 'low', 'registro: esforço baixo')
ok(ind({ natureza: 'PED', tamanho: 'M', area: 'tela' }).esforco === 'high', 'pedido médio de tela: Sonnet alto')
ok(ind({ natureza: 'PED', tamanho: 'P', area: 'tela' }).modelo === 'sonnet', 'pedido pequeno: Sonnet')
ok(ind({}).modelo === 'sonnet', 'item antigo sem campo nenhum não quebra')
ok(MO.indicado(null) === null, 'sem item, sem indicação')

// o ajuste dele vence o critério, campo por campo
const aj = ind({ natureza: 'PED', tamanho: 'P', area: 'tela', modelo: 'opus' })
ok(aj.modelo === 'opus' && aj.esforco === 'medium' && aj.ajustado, 'ajuste só do modelo mantém o esforço do critério')
ok(ind({ natureza: 'PED', tamanho: 'P', modelo: 'gpt' }).modelo === 'sonnet', 'ajuste fora da lista é ignorado')

// família do nome do modelo, nos jeitos que ele aparece
ok(MO.familia('opus[1m]') === 'opus' && MO.familia('claude-opus-5-5') === 'opus', 'opus')
ok(MO.familia('claude-sonnet-5-5') === 'sonnet' && MO.familia('opusplan') === 'opusplan' && MO.familia('') === null, 'sonnet, opusplan, vazio')

// a orientação da sessão que abre
const P = { id: 'X-2', natureza: 'PED', tamanho: 'P', area: 'tela' }
const M = { id: 'X-3', natureza: 'PED', tamanho: 'M', area: 'tela' }
const G = { id: 'X-4', natureza: 'PED', tamanho: 'G', area: 'tela' }
const DEF = { id: 'X-5', natureza: 'DEF', tamanho: 'M', area: 'tela' }
ok(MO.orientar(P, 'opus[1m]').acao === 'direto', 'pequena numa sessão Opus: faz direto, delegar custa releitura')
ok(MO.orientar(M, 'opus[1m]').acao === 'delegar' && /model: "sonnet"/.test(MO.orientar(M, 'opus').texto), 'média numa sessão Opus: ajudante Sonnet, tarefa inteira')
ok(MO.orientar(G, 'opus').acao === 'planejar', 'grande numa sessão Opus: planeja e manda as peças')
ok(MO.orientar(DEF, 'claude-sonnet-5-5').acao === 'avisar' && /\/model opus/.test(MO.orientar(DEF, 'sonnet').texto), 'defeito numa sessão Sonnet: avisa ele para abrir em Opus')
ok(MO.orientar(G, 'sonnet').acao === 'avisar' && /\/model opusplan/.test(MO.orientar(G, 'sonnet').texto), 'grande numa sessão Sonnet: avisa para abrir em opusplan')
ok(MO.orientar(P, 'sonnet').acao === 'seguir', 'mesmo modelo: segue')
ok(MO.orientar(P, null).acao === undefined && MO.orientar(P, null).texto.includes('X-2'), 'sem saber a sessão, só diz o que a tarefa pede')
ok(MO.orientar({ id: 'X-6', natureza: 'DEC' }, 'opus') === null, 'decisão dele: nada a orientar')
// 07/10: os projetos abrem em opusplan; a sessão já executa em Sonnet e planeja em Opus
ok(MO.orientar(M, 'opusplan').acao === 'seguir', 'opusplan com tarefa Sonnet: segue direto, sem delegar')
ok(MO.orientar(DEF, 'opusplan').acao === 'planejar' && /causa/.test(MO.orientar(DEF, 'opusplan').texto), 'opusplan com defeito: planejamento (Opus) para a causa')
ok(MO.conferirAjudante(M, { subagent_type: 'general-purpose' }, 'opusplan') === null, 'ajudante herdando opusplan executa em Sonnet: passa')

// CC-975: qual tarefa é desta sessão, pelas marcas do diário
const md = (id, estado, sessao) => ({ tipo: 'medida', id, estado, sessao, tokens: 1 })
ok(MO.andandoDaSessao([md('A', 'EM', 's1'), md('B', 'EM', 's2')], 's1') === 'A', 'a tarefa de outra sessão não conta')
ok(MO.andandoDaSessao([md('A', 'EM', 's1'), md('A', 'OK', 's1')], 's1') === null, 'tarefa que saiu de andando não conta')
ok(MO.andandoDaSessao([md('A', 'EM', 's1'), md('A', 'PR', 's1'), md('C', 'EM', 's1')], 's1') === 'C', 'a última que entrou')
ok(MO.andandoDaSessao([md('A', 'EM', 's1')], undefined) === null, 'sem sessão, nada')

// CC-975: a chamada de ajudante contra o modelo da tarefa
const cfa = MO.conferirAjudante
ok(cfa(M, { subagent_type: 'general-purpose', model: 'sonnet' }, 'opus') === null, 'tarefa Sonnet, ajudante Sonnet: passa')
ok(/model: "sonnet"/.test(cfa(M, { subagent_type: 'general-purpose' }, 'opus[1m]')), 'tarefa Sonnet, ajudante sem modelo herda Opus: recusa')
ok(/fork herda/.test(cfa(M, { subagent_type: 'fork', model: 'sonnet' }, 'opus')), 'fork ignora o model e herda Opus: recusa')
ok(cfa(M, { subagent_type: 'Explore' }, 'opus') === null, 'ajudante só de leitura passa sempre')
ok(cfa(DEF, { subagent_type: 'general-purpose', model: 'sonnet' }, 'opus') !== null, 'tarefa Opus, ajudante Sonnet: recusa')
ok(cfa(DEF, { subagent_type: 'general-purpose' }, 'opus') === null, 'tarefa Opus, ajudante herdando Opus: passa')
ok(cfa(G, { subagent_type: 'Plan', model: 'opus' }, 'opus') === null && cfa(G, { subagent_type: 'general-purpose', model: 'sonnet' }, 'opus') === null, 'grande: Plan em Opus e peça em Sonnet passam')
ok(cfa(G, { subagent_type: 'general-purpose', model: 'opus' }, 'opus') !== null, 'grande: peça em Opus é recusada')
ok(cfa(M, { subagent_type: 'general-purpose' }, null) === null, 'sem saber o modelo, não barra')
ok(cfa({ ...M, modelo: 'opus' }, { subagent_type: 'general-purpose' }, 'opus') === null, 'ajuste dele na tarefa vale para a trava')

// o modelo da sessão: entrada do gancho, depois projeto local, projeto, global
const casa = mkdtempSync(join(tmpdir(), 'modelo-casa-'))
const proj = mkdtempSync(join(tmpdir(), 'modelo-proj-'))
try {
  ok(MO.modeloDaSessao({ model: 'claude-sonnet-5-5' }, proj, casa) === 'claude-sonnet-5-5', 'entrada do gancho em texto')
  ok(MO.modeloDaSessao({ model: { id: 'claude-opus-5-5' } }, proj, casa) === 'claude-opus-5-5', 'entrada do gancho em objeto')
  ok(MO.modeloDaSessao({}, proj, casa) === null, 'sem nada: nulo')
  writeFileSync(join(casa, 'settings.json'), '{"model":"opus[1m]"}')
  ok(MO.modeloDaSessao({}, proj, casa) === 'opus[1m]', 'global')
  mkdirSync(join(proj, '.claude'))
  writeFileSync(join(proj, '.claude', 'settings.json'), '{"model":"sonnet"}')
  ok(MO.modeloDaSessao({}, proj, casa) === 'sonnet', 'o do projeto vence o global')
  writeFileSync(join(proj, '.claude', 'settings.local.json'), '{"model":"opusplan"}')
  ok(MO.modeloDaSessao({}, proj, casa) === 'opusplan', 'o local vence o do projeto')

  // o ajuste gravado no backlog, em pasta temporária
  const arq = join(proj, 'docs', 'backlog.jsonl')
  mkdirSync(join(proj, 'docs'))
  writeFileSync(arq, JSON.stringify({ id: 'T-1', titulo: 'x', estado: 'B1', frente: 'f', natureza: 'PED', area: 'tela', tamanho: 'P', criado: '2026-10-07', pronto: 'algo que se ve pronto', conferir: 'auto:true' }) + '\n')
  B.ajustarModelo('T-1', { modelo: 'opus', esforco: 'high' }, arq)
  let i = B.ler(arq).itens[0]
  ok(i.modelo === 'opus' && i.esforco === 'high', 'ajuste gravado')
  ok(readFileSync(join(proj, 'docs', 'eventos.jsonl'), 'utf8').includes('modelo opus'), 'ajuste vai para a história da tarefa')
  B.ajustarModelo('T-1', { modelo: 'criterio' }, arq)
  i = B.ler(arq).itens[0]
  ok(!('modelo' in i) && i.esforco === 'high', '"criterio" apaga só o campo pedido')
  assert.throws(() => B.ajustarModelo('T-1', { modelo: 'gpt' }, arq), /fora da lista/); n++

  // de ponta a ponta: o gancho de início diz o modelo da próxima tarefa
  const r = spawnSync(process.execPath, ['hooks/framework-inicio.mjs'], { input: JSON.stringify({ cwd: proj, model: 'claude-sonnet-5-5' }), encoding: 'utf8', env: { ...process.env, CC_HOME: casa } })
  ok(/MODELO DA PRÓXIMA TAREFA/.test(r.stdout) && /T-1 pede Sonnet/.test(r.stdout) && /mesmo|modelo certo/.test(r.stdout), `o início da sessão orienta: ${r.stdout.slice(-300)} ${r.stderr.slice(0, 300)}`)

  // de ponta a ponta: a trava dos ajudantes, com a tarefa andando desta sessão
  const sess = '31111111-2222-3333-4444-555555555555'
  writeFileSync(join(proj, 'docs', 'eventos.jsonl'), JSON.stringify({ tipo: 'medida', id: 'T-1', estado: 'EM', sessao: sess, tokens: 1 }) + '\n')
  const guarda = (input) => spawnSync(process.execPath, ['hooks/modelo-guard.mjs'], { input: JSON.stringify({ cwd: proj, session_id: sess, ...input }), encoding: 'utf8', env: { ...process.env, CC_HOME: casa } })
  let g = guarda({ tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', model: 'opus' } })
  ok(g.status === 2 && /T-1 pede Sonnet/.test(g.stderr), `ajudante Opus para tarefa Sonnet: recusado (${g.status} ${g.stderr.slice(0, 200)})`)
  g = guarda({ tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', model: 'sonnet' } })
  ok(g.status === 0, 'ajudante Sonnet: passa')
  g = guarda({ tool_name: 'Bash', tool_input: { command: 'ls' } })
  ok(g.status === 0, 'outra ferramenta: passa')
  g = guarda({ tool_name: 'Agent', session_id: 'outra', tool_input: { subagent_type: 'general-purpose', model: 'opus' } })
  ok(g.status === 0, 'sessão sem tarefa andando: passa')
} finally {
  rmSync(casa, { recursive: true, force: true }); rmSync(proj, { recursive: true, force: true })
}

console.log(`test-modelo: ${n} verificações, 0 falhas`)
