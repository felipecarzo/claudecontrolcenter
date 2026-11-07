#!/usr/bin/env node
/**
 * CC-1071: o guia de capacidades de toda função pronta.
 *
 * Os dois ganchos (`guia-fim`, `guia-contexto`) rodam como processo, com JSON no stdin, numa casa temporária
 * (HOME e CC_HOME falsos) com um projeto de mentira (docs/backlog.jsonl, docs/eventos.jsonl, docs/guias/capacidades).
 * Nenhum modelo é chamado. Casos do plano: a (item fechado no turno sem guia: barra), b (guia citando o item: passa),
 * c (arquivo editado mais novo que o guia: barra), d (guia mais novo: passa), e (contexto a 80% com item andando: barra
 * uma vez, de novo na faixa seguinte, abaixo de 75% não), f (stop_hook_active passa), g (turno sem nada: não dispara).
 *
 * CC-1076 (30/10): os dois ganchos foram APOSENTADOS (o Haiku escreve o guia por código). Os casos que esperavam o aviso
 * viraram casos que provam que eles NÃO estão mais na lista do parada.mjs nem no catálogo. O código de `src/guias.mjs`
 * (leitura do backlog e dos eventos, cabeçalho dos guias) continua em uso e é conferido pelos casos que sobram.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const HOOKS = path.join(RAIZ, 'hooks')
const CASA = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1071-'))
const CC_HOME = path.join(CASA, '.claude')
const PROJ = path.join(CASA, 'projeto')
const GUIAS = path.join(PROJ, 'docs', 'guias', 'capacidades')
fs.mkdirSync(CC_HOME, { recursive: true })
fs.mkdirSync(GUIAS, { recursive: true })
fs.mkdirSync(path.join(PROJ, 'src'), { recursive: true })
const IDS = ['guia-fim', 'guia-contexto']
const ligar = (extra = {}) => fs.writeFileSync(path.join(CC_HOME, 'control-center.json'), JSON.stringify({ hooks: { ...Object.fromEntries(IDS.map((i) => [i, true])), ...extra } }))
ligar()

let falhas = 0
const ok = (cond, msg) => { if (!cond) { falhas++; console.error(`FALHOU: ${msg}`) } else console.log(`ok ${msg}`) }

function rodar(script, entrada, env = {}) {
  const e = { ...process.env, HOME: CASA, CC_HOME, ...env }
  for (const k of ['CLAUDE_CODE_ENTRYPOINT', 'CC_CONFERENTE']) if (env[k] === undefined) delete e[k]
  const r = spawnSync('node', [path.join(HOOKS, script)], { input: JSON.stringify(entrada), env: e, encoding: 'utf8', cwd: PROJ, timeout: 30000 })
  return { codigo: r.status, out: r.stdout || '', err: r.stderr || '' }
}
let n = 0
function transcrito(linhas) {
  const f = path.join(CASA, `t${n++}.jsonl`)
  fs.writeFileSync(f, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n')
  return f
}
const fala = (texto) => ({ type: 'user', timestamp: new Date(Date.now() + n).toISOString(), message: { role: 'user', content: texto } })
const resposta = (texto, uso, model = 'claude-opus-5-5') => ({ type: 'assistant', message: { role: 'assistant', model, ...(uso ? { usage: { input_tokens: 3, cache_read_input_tokens: uso - 5, cache_creation_input_tokens: 2, output_tokens: 9 } } : {}), content: [{ type: 'text', text: texto }] } })
const edita = (arq) => ({ type: 'assistant', message: { role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'tool_use', id: `e${n}`, name: 'Edit', input: { file_path: arq } }] } })
const barrou = (x, g) => x.codigo === 2 && x.err.startsWith(`[${g}]`)
const passou = (x) => x.codigo === 0 && !x.err && !x.out
let sess = 0
const stop = (script, linhas, extra = {}) => rodar(script, { hook_event_name: 'Stop', cwd: PROJ, session_id: `s${sess++}`, transcript_path: transcrito(linhas), ...extra })

/* o projeto de mentira */
const item = (id, extra = {}) => JSON.stringify({ id, titulo: `Função ${id}`, estado: 'OK', natureza: 'PED', intencao: `Criar a função ${id}`, ...extra })
const mundo = (itens, eventos = []) => {
  fs.writeFileSync(path.join(PROJ, 'docs', 'backlog.jsonl'), itens.join('\n') + '\n')
  fs.writeFileSync(path.join(PROJ, 'docs', 'eventos.jsonl'), eventos.map((e) => JSON.stringify(e)).join('\n') + (eventos.length ? '\n' : ''))
  for (const f of fs.readdirSync(GUIAS)) fs.rmSync(path.join(GUIAS, f))
}
const evento = (id, para = 'OK', msDepois = 60000) => ({ em: new Date(Date.now() + msDepois).toISOString(), tipo: 'estado', id, de: 'EM', para })
const guia = (nome, { itens = '', codigo = '', idade = 0 } = {}) => {
  const f = path.join(GUIAS, nome)
  fs.writeFileSync(f, `# Guia ${nome}\n\nitens: ${itens}\ncodigo: ${codigo}\natualizado: 2026-10-22\n\ncorpo\n`)
  const t = new Date(Date.now() - idade)
  fs.utimesSync(f, t, t)
}
const PEDIDO = [fala('termina a função'), resposta('Pronto, a função está fechada.')]

/* a, b: item fechado no turno */
mundo([item('CC-9001')], [evento('CC-9001')])
let x = stop('guia-fim.mjs', PEDIDO)
ok(barrou(x, 'guia-fim') && x.err.includes('CC-9001') && x.err.includes('INDICE'), 'a: item fechado no turno sem guia barra, e a mensagem diz o item e o INDICE')
ok(!/racioc|pensament|voc[êe] (disse|escreveu)/i.test(x.err) && !x.err.includes('\u2014') && !x.err.includes('\u2013'), 'a: a mensagem fala de formato e ação, sem travessão')
guia('funcao.md', { itens: 'CC-9001' })
ok(passou(stop('guia-fim.mjs', PEDIDO)), 'b: com um guia citando o item passa')
mundo([item('CC-9002')], [evento('CC-9002', 'PR')])
ok(barrou(stop('guia-fim.mjs', PEDIDO), 'guia-fim'), 'a: item que foi para prova (PR) também pede guia')
mundo([item('CC-9003', { titulo: 'Conserto do botão' })], [evento('CC-9003')])
ok(passou(stop('guia-fim.mjs', PEDIDO)), 'isenção: item de conserto não pede guia novo')
mundo([item('CC-9004', { natureza: 'DOC' })], [evento('CC-9004')])
ok(passou(stop('guia-fim.mjs', PEDIDO)), 'isenção: item de natureza registro não pede guia novo')
mundo([item('CC-9005')], [evento('CC-9005', 'OK', -10 * 60e3)])
ok(passou(stop('guia-fim.mjs', PEDIDO)), 'o item fechado ANTES do pedido deste turno não conta (já foi cobrado no turno dele)')

/* c, d: arquivo editado e guia */
mundo([item('CC-9006')], [])
fs.writeFileSync(path.join(PROJ, 'src', 'a.mjs'), 'export const a = 1\n')
const EDITA = [fala('muda o a'), edita(path.join(PROJ, 'src', 'a.mjs')), resposta('Mudei.')]
guia('a.md', { itens: 'CC-9006', codigo: 'src/a.mjs', idade: 3600e3 })
x = stop('guia-fim.mjs', EDITA)
ok(barrou(x, 'guia-fim') && x.err.includes('a.md') && x.err.includes('src/a.mjs'), 'c: arquivo editado mais novo que o guia barra, com o guia e o arquivo')
guia('a.md', { itens: 'CC-9006', codigo: 'src/a.mjs', idade: 0 })
const novo = new Date(Date.now() + 5000); fs.utimesSync(path.join(GUIAS, 'a.md'), novo, novo)
ok(passou(stop('guia-fim.mjs', EDITA)), 'd: guia mais novo que o código passa')
guia('a.md', { itens: 'CC-9006', codigo: 'src/b.mjs', idade: 3600e3 })
ok(passou(stop('guia-fim.mjs', EDITA)), 'c: arquivo editado que nenhum guia lista não dispara')
guia('a.md', { itens: 'CC-9006', codigo: 'src/a.mjs', idade: 3600e3 })
ok(passou(stop('guia-fim.mjs', [fala('lê o a'), resposta('Li.')])), 'g: guia velho, mas o turno não editou o código: não dispara')

/* f: stop_hook_active */
mundo([item('CC-9001')], [evento('CC-9001')])
ok(passou(stop('guia-fim.mjs', PEDIDO, { stop_hook_active: true })), 'f: guia-fim com stop_hook_active passa')

/* g: turno sem nada */
mundo([item('CC-9001')], [])
ok(passou(stop('guia-fim.mjs', [fala('qual a hora?'), resposta('Não sei.')])), 'g: turno sem nada não dispara o guia-fim')
ok(passou(stop('guia-contexto.mjs', [fala('oi'), resposta('olá', 1000)])), 'g: turno sem nada não dispara o guia-contexto')

/* claude -p e interruptor */
mundo([item('CC-9001')], [evento('CC-9001')])
ok(passou(rodar('guia-fim.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: 'r', transcript_path: transcrito(PEDIDO) }, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' })), 'claude -p não é cobrado')
ligar({ 'guia-fim': false })
ok(passou(stop('guia-fim.mjs', PEDIDO)), 'interruptor desligado cala o guia-fim')
ligar()

/* e: contexto cheio */
mundo([item('CC-9007', { estado: 'EM' })], [evento('CC-9007', 'EM', 0)])
const CTX = (uso, modelo) => [fala('segue'), resposta('ok', uso, modelo)]
const SESSAO = 'ctx-1'
const ctx = (uso, extra = {}, modelo) => rodar('guia-contexto.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: SESSAO, transcript_path: transcrito(CTX(uso, modelo)), ...extra })
x = ctx(160000)
ok(barrou(x, 'guia-contexto') && x.err.includes('80%') && x.err.includes('CC-9007') && x.err.includes('INDICE'), 'e: contexto a 80% com item andando barra, com a porcentagem e o item')
ok(passou(ctx(162000)), 'e: na mesma faixa não barra de novo')
ok(passou(ctx(170000, { stop_hook_active: true })), 'f: guia-contexto com stop_hook_active passa')
ok(barrou(ctx(185000), 'guia-contexto'), 'e: na faixa seguinte (92%) barra de novo')
ok(passou(ctx(100000)), 'e: abaixo de 75% não barra')
ok(barrou(ctx(160000), 'guia-contexto'), 'e: depois de cair abaixo do limite (limpou), a faixa zera e o aviso volta')
ok(passou(ctx(160000, { session_id: 'um-m' }, 'claude-opus-5-5[1m]')), 'e: modelo [1m] tem janela de 1 milhão (16% não barra)')
ok(fs.existsSync(path.join(CASA, '.local', 'share', 'agent-cockpit', 'guias', `${SESSAO}.json`)), 'e: a faixa avisada fica em ~/.local/share/agent-cockpit/guias/<sessao>.json')
fs.mkdirSync(path.join(CASA, '.config', 'agent-cockpit'), { recursive: true })
fs.writeFileSync(path.join(CASA, '.config', 'agent-cockpit', 'guias.json'), '{"janela":100000,"limite":0.5}')
ok(barrou(rodar('guia-contexto.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: 'cfg', transcript_path: transcrito(CTX(60000)) }), 'guia-contexto'), 'e: janela e limite vêm de ~/.config/agent-cockpit/guias.json')
fs.rmSync(path.join(CASA, '.config', 'agent-cockpit', 'guias.json'))
mundo([item('CC-9008')], [])
ok(passou(ctx(190000)), 'e: sem item andando não avisa (e não gasta a faixa)')
mundo([item('CC-9007', { estado: 'EM' })], [evento('CC-9007', 'EM', 0)])
ok(barrou(ctx(190000, {}), 'guia-contexto'), 'e: com item andando o aviso que ficou guardado vem')

/* h: só conta o item que foi para "andando" nas últimas 24 horas (os eventos não dizem a sessão) */
mundo([item('CC-558', { estado: 'EM' })], [evento('CC-558', 'EM', -3 * 24 * 3600e3)])
ok(passou(rodar('guia-contexto.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: 'velho-1', transcript_path: transcrito(CTX(160000)) })), 'h: item andando parado há 3 dias não conta, e não avisa')
mundo([item('CC-558', { estado: 'EM' }), item('CC-9007', { estado: 'EM' })], [evento('CC-558', 'EM', -3 * 24 * 3600e3), evento('CC-9007', 'EM', 0)])
const so = rodar('guia-contexto.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: 'velho-2', transcript_path: transcrito(CTX(160000)) })
ok(barrou(so, 'guia-contexto') && so.err.includes('CC-9007') && !so.err.includes('CC-558'), 'h: com um item recente e um parado, o aviso cita só o recente')

/* i: a janela real. Passou de 200 mil, é a de 1M, e isso fica lembrado depois de compactar */
const grande = (uso) => rodar('guia-contexto.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: 'grande-1', transcript_path: transcrito(CTX(uso)) })
ok(passou(grande(344000)), 'i: contexto de 344 mil não barra (a janela dessa sessão é a de 1M, não 172% de 200 mil)')
ok(JSON.parse(fs.readFileSync(path.join(CASA, '.local', 'share', 'agent-cockpit', 'guias', 'grande-1.json'), 'utf8')).grande === true, 'i: a sessão fica marcada como de janela grande')
ok(passou(grande(160000)), 'i: depois de compactar (160 mil) continua sem barrar, a janela lembrada é a de 1M')
ok(barrou(grande(800000), 'guia-contexto'), 'i: perto do fim da janela de 1M (80%) barra')
ligar({ 'guia-contexto': false })
ok(passou(rodar('guia-contexto.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: 'off', transcript_path: transcrito(CTX(190000)) })), 'interruptor desligado cala o guia-contexto')
ligar()

/* o parada.mjs NÃO despacha mais os dois (CC-1076) */
mundo([item('CC-9001')], [evento('CC-9001')])
const viaParada = rodar('parada.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: 'via-parada', transcript_path: transcrito(PEDIDO) })
ok(!viaParada.err.includes('[guia-fim]'), 'o parada.mjs não despacha mais o guia-fim')
mundo([item('CC-9007', { estado: 'EM' })], [evento('CC-9007', 'EM', 0)])
const viaParada2 = rodar('parada.mjs', { hook_event_name: 'Stop', cwd: PROJ, session_id: 'via-parada2', transcript_path: transcrito(CTX(160000)) })
ok(!viaParada2.err.includes('[guia-contexto]'), 'o parada.mjs não despacha mais o guia-contexto')
const { GUARDAS } = await import('./hooks/parada.mjs?cc1071')
ok(!GUARDAS.includes('guia-fim') && !GUARDAS.includes('guia-contexto'), 'a lista do parada.mjs não tem guia-fim nem guia-contexto')

/* o catálogo: aposentados */
const { hookDe } = await import('./src/hooksCatalogo.mjs')
for (const id of IDS) {
  const h = hookDe(id)
  ok(h && h.padrao === false && h.implementado === false && h.evento === 'Stop', `catálogo: ${id} está aposentado (padrao e implementado falsos)`)
}

fs.rmSync(CASA, { recursive: true, force: true })
if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nCC-1071: todas as peças conferidas')
