// CC-1044: o monitor de hooks lê as conversas gravadas e não conta em dobro os hooks de parada.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nomeDoHook, eventosDoTexto, juntar, paradas, relatorio } from './src/hooksMonitor.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }
const ts = '2026-10-11T10:00:00.000Z'; const cwd = '/home/u/projetos/VPS_app'

ok(nomeDoHook('node /x/hooks/edicao-guard.mjs') === 'edicao-guard' && nomeDoHook('node ~/.claude/hooks/todo-guard.mjs') === 'todo-guard' && nomeDoHook('bash /a/b.sh x') === 'b', 'nome curto do hook a partir do comando')

const linhas = [
  // parada: dois hooks juntos, um devolveu a resposta
  { type: 'system', subtype: 'stop_hook_summary', timestamp: ts, cwd, hookInfos: [{ command: 'node /h/lento-guard.mjs', durationMs: 9000 }, { command: 'node /h/rapido-guard.mjs', durationMs: 200 }], hookErrors: ['[node /h/rapido-guard.mjs]: PERGUNTA EM PROSA, refaça.'] },
  // o mesmo hook de parada aparece avulso quando tem saída: NÃO pode contar de novo
  { type: 'attachment', timestamp: ts, cwd, attachment: { type: 'hook_success', hookEvent: 'Stop', command: 'node /h/rapido-guard.mjs', durationMs: 200, exitCode: 2 } },
  { type: 'attachment', timestamp: ts, cwd, attachment: { type: 'hook_success', hookEvent: 'SessionStart', command: 'node /h/inicio.mjs', durationMs: 300, exitCode: 0 } },
  { type: 'attachment', timestamp: ts, cwd, attachment: { type: 'hook_cancelled', hookEvent: 'Stop', command: 'node /h/lento-guard.mjs', durationMs: 10050, timedOut: true } },
  // uma ferramenta barrada
  { type: 'user', timestamp: ts, cwd, message: { content: [{ type: 'tool_result', content: 'PreToolUse:Edit hook error: [node /h/edicao-guard.mjs]: NISABA: nenhuma tarefa andando.' }] } },
  { type: 'assistant', timestamp: ts, cwd, message: { content: [{ type: 'text', text: 'resposta comum, sem hook' }] } },
]
const texto = linhas.map((l) => JSON.stringify(l)).join('\n') + '\n{quebrada\n'
const ev = eventosDoTexto(texto)
const hooks = juntar(ev); const por = Object.fromEntries(hooks.map((h) => [h.hook, h]))
ok(por['rapido-guard'].disparos === 1 && por['rapido-guard'].barrou === 1, 'hook de parada conta UMA vez (o registro avulso não dobra) e a devolução conta como barrada')
ok(por['lento-guard'].disparos === 2 && por['lento-guard'].cancelados === 1 && por['lento-guard'].maxMs === 10050, 'o corte por tempo entra como disparo cortado, com o tempo')
ok(por['inicio'].disparos === 1 && por['inicio'].eventos.join() === 'SessionStart', 'hook de outro evento entra pelo registro avulso')
ok(por['edicao-guard'].barrou === 1 && por['edicao-guard'].ultimas[0].ferramenta === 'Edit' && /NISABA/.test(por['edicao-guard'].ultimas[0].texto), 'ferramenta barrada: qual ferramenta e o texto da barrada')
ok(!hooks.some((h) => h.hook === '(parada inteira)'), 'a parada inteira não aparece como hook na lista')
const P = paradas(ev)
ok(P.total === 1 && P.medianaMs === 9000 && P.hooksPorParada === 2 && P.acima10s === 0, 'a espera da parada é a do hook mais lento (os de parada rodam juntos)')
ok(hooks[0].hook === 'lento-guard', 'a lista vem do que mais pesa (vezes x tempo) para o que menos pesa')

// CC-1046: em português claro. O título vem do catálogo, a frase do que faz vem do tipo, e a barrada vira frase inteira sem gritar
const { frasePrincipal, explicar } = await import('./src/hooksMonitor.mjs')
ok(frasePrincipal('EDIÇÃO DE ARQUIVO POR SCRIPT, use o Edit, que falha em voz alta. Resto que não entra') === 'Edição de arquivo por script, use o Edit, que falha em voz alta.', 'frase inteira até o ponto, e o trecho em maiúscula vira frase normal')
ok(frasePrincipal('ELE PEDIU "aba" E A ENTREGA NÃO FALA DISSO.') === 'Ele pediu "aba" e a entrega não fala disso.', 'o que está entre aspas fica como veio')
ok(frasePrincipal('Ele pediu igual a algo que já existe, e a entrega não mostra o par.') === 'Ele pediu igual a algo que já existe, e a entrega não mostra o par.', 'frase normal fica igual')
const cat = new Map([['rapido-guard', { label: 'Pergunta em prosa', nivel: 'avisa' }], ['edicao-guard', { label: 'Edição por script', nivel: 'trava' }]])
const ex = Object.fromEntries(explicar(hooks, cat).map((h) => [h.hook, h]))
ok(ex['rapido-guard'].titulo === 'Pergunta em prosa' && /devolve com um aviso/.test(ex['rapido-guard'].oQueFaz), 'hook sem explicação própria cai na frase do tipo (o catálogo diz o título)')
ok(ex['edicao-guard'].titulo === 'Edição por script' && /recusa se não houver tarefa/.test(ex['edicao-guard'].oQueFaz) && /NISABA: nenhuma tarefa andando\./.test(ex['edicao-guard'].ultimas[0].frase), 'trava: diz que pode impedir, e a barrada vem em frase')
ok(ex['inicio'].titulo === 'inicio' && /sem descrição/.test(ex['inicio'].oQueFaz), 'hook fora do catálogo diz que não tem descrição, em vez de inventar')

// CC-1047: cada hook tem a explicação PRÓPRIA (o que ele confere), não a frase do tipo, igual para todos
const { EXPLICA } = await import('./src/hooksExplica.mjs')
const { HOOKS } = await import('./src/hooksCatalogo.mjs')
const semExplicacao = HOOKS.filter((h) => h.implementado && h.script).map((h) => String(h.script).replace(/\.m?js$/, '')).filter((k) => !EXPLICA[k])
ok(semExplicacao.length === 0, 'todo hook implementado do catálogo tem explicação própria em português (faltam: ' + semExplicacao.join(', ') + ')')
ok(!Object.values(EXPLICA).some((t) => /[—–]/.test(t)) && Object.values(EXPLICA).every((t) => t.length > 30 && t.length < 260), 'as explicações não têm travessão e cabem numa linha ou duas')
const exQ = explicar([{ hook: 'quadro-guard', ultimas: [] }], new Map([['quadro-guard', { label: 'Projeto que sumiu do quadro', nivel: 'avisa' }]]))[0]
ok(/TODO projeto do disco/.test(exQ.oQueFaz) && !/^Confere a resposta no fim/.test(exQ.oQueFaz), 'a explicação própria vence a frase genérica do tipo')

// CC-1049: tokens estimados pelo texto que o hook pôs na conversa
const { charsDoSucesso, tokensDe } = await import('./src/hooksMonitor.mjs')
ok(charsDoSucesso({ hookEvent: 'SessionStart', stdout: 'x'.repeat(360) }) === 360 && charsDoSucesso({ hookEvent: 'PostToolUse', stdout: 'log solto' }) === 0, 'abertura em texto puro conta a saída; saída solta de outro evento não entra na conversa')
ok(charsDoSucesso({ hookEvent: 'UserPromptSubmit', stdout: JSON.stringify({ hookSpecificOutput: { additionalContext: 'abc' } }) }) === 3, 'saída em JSON conta só o contexto devolvido')
ok(tokensDe(36) === 10 && por['rapido-guard'].tokens === tokensDe('PERGUNTA EM PROSA, refaça.'.length) && por['edicao-guard'].tokens > 0, 'a devolução e a barrada contam o texto inteiro em tokens')

// de ponta a ponta, numa pasta de conversas temporária: período e memória por arquivo
const base = mkdtempSync(join(tmpdir(), 'hooks-monitor-'))
try {
  mkdirSync(join(base, '-proj'), { recursive: true }); writeFileSync(join(base, '-proj', 'a.jsonl'), texto)
  const medidas = join(base, 'parada-medidas.jsonl')
  const r = relatorio({ dias: 7, agora: Date.now(), base, medidas })
  ok(r.conversas === 1 && r.hooks.length === 4 && r.paradas.total === 1, 'o relatório lê a pasta de conversas')
  ok(r.tokens === r.hooks.reduce((s, h) => s + h.tokens, 0), 'o total do topo é a soma dos hooks')
  ok(relatorio({ dias: 7, agora: Date.now() + 30 * 86400000, base, medidas }).conversas === 0, 'conversa mais velha que o período fica de fora')

  // CC-1045: os guardas de parada num programa só. O tempo de cada um vem das medidas; a barrada, do texto juntado com `[nome]`
  const agoraIso = new Date().toISOString()
  writeFileSync(join(base, '-proj', 'b.jsonl'), JSON.stringify({ type: 'system', subtype: 'stop_hook_summary', timestamp: agoraIso, cwd, hookInfos: [{ command: 'node /h/parada.mjs', durationMs: 900 }], hookErrors: ['[node /h/parada.mjs]: [guia-guard]\nGUIA DE 3 PASSOS.\n\n[routia/todo-guard]\nTAREFA ABERTA.'] }) + '\n')
  writeFileSync(medidas, JSON.stringify({ em: agoraIso, cwd, ms: 900, guardas: [{ nome: 'guia-guard', ms: 8, codigo: 2, barrou: true }, { nome: 'routia/todo-guard', ms: 12, codigo: 2, barrou: true }, { nome: 'fila-guard', ms: 40, codigo: 0, barrou: false }] }) + '\n')
  const rp = Object.fromEntries(relatorio({ dias: 7, agora: Date.now(), base, medidas }).hooks.map((h) => [h.hook, h]))
  ok(rp['guia-guard']?.disparos === 1 && rp['guia-guard'].barrou === 1 && /GUIA DE 3/.test(rp['guia-guard'].ultimas[0].texto) && rp['todo-guard']?.barrou === 1 && rp['fila-guard']?.mediaMs === 40, 'parada num programa só: cada guarda com o próprio tempo e a própria barrada')
} finally { rmSync(base, { recursive: true, force: true }) }

const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8'); const web = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
ok(ui.includes('data-target="view-hooks"') && ui.includes('id="view-hooks"') && ui.includes("fetch('/api/hooks/monitor?dias='") && ui.includes('[1, 7, 15, 30, 60]') && web.includes('Math.min(60,') && web.includes("url.pathname === '/api/hooks/monitor'"), 'a aba está no menu, chama a rota, e a rota existe')
console.log(`test-hooks-monitor: ${n} verificações, 0 falhas`)
