// CC-1052: a conversa em forma de app. Puro: nada vai para sessão de terminal real.
import assert from 'node:assert/strict'
import { itensDaConversa } from './src/cockpit2.mjs'
import { lerRodape, teclaDoApp, tecla, enviarMensagem } from './src/decisao.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }
const ts = '2026-10-11T10:00:00.000Z'; const cwd = '/home/u/p'
const uso = (name, input) => ({ type: 'tool_use', name, input })
const L = (o) => JSON.stringify({ timestamp: ts, cwd, ...o })

const texto = [
  L({ type: 'user', message: { content: 'rode os testes' } }),
  L({ type: 'assistant', message: { model: 'claude-opus-5-5', content: [{ type: 'text', text: 'vou rodar' }, uso('Bash', { command: 'npm test' })] } }),
  L({ type: 'user', message: { content: [{ type: 'tool_result', content: 'passou' }] } }),
  L({ type: 'assistant', message: { model: 'claude-opus-5-5', content: [uso('Read', { file_path: cwd + '/src/x.mjs' }), uso('Grep', { pattern: 'x'.repeat(300) })] } }),
  L({ type: 'assistant', isSidechain: true, message: { model: 'outro', content: [{ type: 'text', text: 'sub-agente' }, uso('Bash', { command: 'zzz' })] } }),
  L({ type: 'user', isMeta: true, message: { content: 'texto de skill' } }),
  L({ type: 'user', message: { content: '<command-name>/clear</command-name>' } }),
  L({ type: 'assistant', message: { model: 'claude-sonnet-5-5', content: [{ type: 'text', text: 'pronto' }] } }),
  '{quebrada',
].join('\n')
const r = itensDaConversa(texto)
ok(r.itens.map((i) => i.tipo).join() === 'voce,agente,ferramentas,agente', 'ordem: fala dele, agente, UM bloco de ferramentas, agente')
const bloco = r.itens[2]
ok(bloco.lista.length === 3 && bloco.lista[0].nome === 'Bash' && bloco.lista[0].alvo === 'npm test', 'ferramentas seguidas de linhas diferentes se juntam no mesmo bloco')
ok(bloco.lista[1].alvo === 'src/x.mjs', 'file_path sai relativo ao cwd')
ok(bloco.lista[2].alvo.length === 120, 'alvo cortado em 120')
ok(!JSON.stringify(r.itens).match(/sub-agente|zzz|skill|command-name|passou/), 'ignora sidechain, isMeta, <command> e tool_result')
ok(r.modelo === 'claude-sonnet-5-5', 'modelo da última fala do assistente (a sidechain não conta)')
ok(itensDaConversa(texto, { limite: 2 }).itens.length === 2, 'respeita o limite')
ok(itensDaConversa('').modelo === null, 'vazio devolve modelo nulo')

const auto = '❯ pode apagar a cópia de medição\n────────────────────────\n  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agents\n'
const manual = '❯ \n────────────────────────\n  ⏸ manual mode on · ⧉ 3 · ← for agents\n   ◖ medium · /effort\n'
let a = lerRodape(auto), m = lerRodape(manual)
ok(a.modo === 'auto' && a.rascunho === 'pode apagar a cópia de medição' && !a.trabalhando, 'rodapé auto com rascunho')
ok(m.modo === 'manual' && m.rascunho === null && m.esforco === 'medium', 'rodapé manual, rascunho vazio, esforço medium')
ok(lerRodape('❯\n  ⏵⏵ accept edits on (shift+tab)').modo === 'aceitar', 'accept edits => aceitar')
// amostras reais de 11/10: a versão nova não diz "esc to interrupt", mostra a linha do giro
const girando = lerRodape('* Jitterbugging… (34s · ↓ 1.2k tokens · thinking with high effort)\n  ⎿  Tip: Use /btw\n────\n❯ \n────\n  ⏸ manual mode on · ⧉ 3 · ← for agents')
ok(girando.trabalhando === true && girando.esforco === 'high' && girando.modo === 'manual' && girando.rascunho === null, 'linha do giro => trabalhando, com o esforço dela')
ok(lerRodape('✻ Sautéed for 27s · done 7:43 PM\n────\n❯ publiquei\n────\n  ⏵⏵ auto mode on').trabalhando === false, 'linha de acabado não conta como trabalhando')
ok(lerRodape('❯\n  ⏸ plan mode on (shift+tab)').modo === 'plano', 'plan mode => plano')
ok(lerRodape('❯\n  bypass permissions on').modo === 'auto', 'bypass => auto')
ok(lerRodape('✻ Pensando… (12s · esc to interrupt)\n❯ \n  ⏸ manual mode on').trabalhando === true, 'esc to interrupt => trabalhando')
ok(lerRodape('Pergunta?\n❯ 1. Sim\n  2. Não\nEnter to select').rascunho === null, 'menu não vira rascunho')
ok(lerRodape('').modo === null && lerRodape(null).trabalhando === false, 'tela vazia não quebra')

ok(teclaDoApp('parar') === 'Escape' && teclaDoApp('modo') === 'BTab', 'lista de teclas: parar e modo')
ok(['Enter', 'Escape', 'enter', 'ctrl-c', '', null, undefined, 'toString', '__proto__'].every((k) => teclaDoApp(k) === null), 'qualquer outra tecla é recusada')

const enviadas = []
const deps = { sessoes: async () => ({ x: { conversa: 'c1', sessao: 'S' } }), apertar: async (s, k) => { enviadas.push(k); return { ok: true } },
  capturar: async () => '❯ \n  ⏸ manual mode on', esperar: async () => {} }
ok((await tecla({ conversa: 'c1', tecla: 'Enter' }, deps)).ok === false && enviadas.length === 0, 'tecla fora da lista não chega no terminal')
const t = await tecla({ conversa: 'c1', tecla: 'modo' }, deps)
ok(t.ok && enviadas.join() === 'BTab' && t.tela.modo === 'manual', 'tecla modo manda BTab e devolve o rodapé')
// modo escolhido no menu: aperta Shift+Tab até o rodapé mostrar o destino (ciclo simulado manual > aceitar > plano)
const ciclo = ['⏸ manual mode on', '⏵⏵ accept edits on', '⏸ plan mode on']; let pos = 0; const env2 = []
const dCiclo = { sessoes: deps.sessoes, esperar: async () => {}, apertar: async (s, k) => { env2.push(k); pos = (pos + 1) % ciclo.length; return { ok: true } }, capturar: async () => '❯ \n  ' + ciclo[pos] }
const tp = await tecla({ conversa: 'c1', tecla: 'modo', alvo: 'plano' }, dCiclo)
ok(tp.ok && tp.voltas === 2 && env2.length === 2, 'modo com destino aperta só até chegar (2 voltas de manual a plano)')
pos = 0; env2.length = 0
const tn = await tecla({ conversa: 'c1', tecla: 'modo', alvo: 'auto' }, dCiclo)
ok(!tn.ok && /não aparece no ciclo/.test(tn.erro) && env2.length === 6, 'modo que não existe no ciclo para em 6 voltas e diz por quê')
ok((await tecla({ conversa: 'c1', tecla: 'modo', alvo: 'qualquer' }, dCiclo)).ok === false, 'destino fora da lista é recusado')

// comando de barra: confirma pelo <command-name> no histórico
const base = '{"x":1}\n'
let lido = base
const dc = { sessoes: deps.sessoes, lerTranscrito: () => lido, capturar: async () => '❯ \n', escrever: async () => ({ ok: true }),
  apertar: async () => { lido = base + '{"message":{"content":"<command-message>start-session</command-message>\\n<command-name>/start-session</command-name>"}}\n'; return { ok: true } },
  esperar: async () => {} }
ok((await enviarMensagem({ conversa: 'c1', texto: '/start-session' }, dc)).ok === true, 'comando de barra é confirmado pelo <command-name>')
const dc2 = { ...dc, apertar: async () => ({ ok: true }) } // comando do próprio programa: sem rastro, campo vazio
ok((await enviarMensagem({ conversa: 'c1', texto: '/model opus' }, dc2)).ok === true, 'comando sem rastro no histórico é confirmado pelo campo vazio')

console.log(`\n${n} verificações ok`)
