#!/usr/bin/env node
/**
 * CC-1070: o gancho contra mentira e omissão.
 *
 * Peça 0 (conferência em todo pedido de ação), peça 1 (registro do turno), peça 2
 * (cobrança de omissão) e peça 3 (conferente). Cada gancho roda como processo, com
 * JSON no stdin, numa casa temporária (HOME e CC_HOME falsos). O `claude` do
 * conferente é um falso no PATH, que devolve JSON fixo: nenhum modelo é chamado.
 *
 * Casos do plano: a (erro de teste não citado barra), b (citado passa), c (kill-session
 * não citado barra), d (todas em Sonnet com saída Opus: conferente barra), e (conferente
 * com erro passa e loga), f (pedido "desliga o robô" + kill-session: feito_nao_pedido
 * barra), g (pedido de duas partes, uma feita, "feito": pedido_nao_feito barra).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const HOOKS = path.join(RAIZ, 'hooks')
const CASA = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1070-'))
const CC_HOME = path.join(CASA, '.claude')
const TRABALHO = path.join(CASA, 'trabalho')
const BIN = path.join(CASA, 'bin')
fs.mkdirSync(CC_HOME, { recursive: true })
fs.mkdirSync(TRABALHO, { recursive: true })
fs.mkdirSync(BIN, { recursive: true })
const IDS = ['teto-robo', 'confere-pedido', 'confere-fala', 'confere-omissao', 'conferente']
fs.writeFileSync(path.join(CC_HOME, 'control-center.json'), JSON.stringify({ hooks: Object.fromEntries(IDS.map((i) => [i, true])) }))

/* o claude falso: grava o que recebeu, conta a chamada, e devolve o JSON de FAKE_SAIDA (ou falha, conforme FAKE_MODO) */
const FALSO = path.join(BIN, 'claude')
fs.writeFileSync(FALSO, [
  '#!/bin/bash',
  'cat > "$FAKE_ENTRADA"',
  'echo x >> "$FAKE_ENTRADA.n"',
  'echo "$@" > "$FAKE_ENTRADA.args"',
  'case "$FAKE_MODO" in',
  '  erro) echo "boom" >&2; exit 1;;',
  '  lixo) echo \'{"result":"isto não é json"}\'; exit 0;;',
  'esac',
  'cat "$FAKE_SAIDA"',
].join('\n'))
fs.chmodSync(FALSO, 0o755)
const FAKE_ENTRADA = path.join(CASA, 'fake-entrada.txt')
const FAKE_SAIDA = path.join(CASA, 'fake-saida.json')
const chamadas = () => { try { return fs.readFileSync(`${FAKE_ENTRADA}.n`, 'utf8').split('\n').filter(Boolean).length } catch { return 0 } }
const veredito = (v) => fs.writeFileSync(FAKE_SAIDA, JSON.stringify({ result: JSON.stringify(v), modelUsage: { 'claude-falso-1': { inputTokens: 1 } } }))
const VAZIO = { fala_x_feito: { desmentidas: [], sem_prova: [], feito_nao_contado: [] }, feito_x_pedido: { pedido_nao_feito: [], feito_nao_pedido: [] } }

let falhas = 0
const ok = (cond, msg) => { if (!cond) { falhas++; console.error(`FALHOU: ${msg}`) } else console.log(`ok ${msg}`) }

function rodar(script, entrada, env = {}) {
  const e = { ...process.env, HOME: CASA, CC_HOME, PATH: `${BIN}:${process.env.PATH}`, FAKE_ENTRADA, FAKE_SAIDA, ...env }
  for (const k of ['CLAUDE_CODE_ENTRYPOINT', 'CC_CONFERENTE']) if (env[k] === undefined) delete e[k]
  const r = spawnSync('node', [path.join(HOOKS, script)], { input: JSON.stringify(entrada), env: e, encoding: 'utf8', cwd: TRABALHO, timeout: 30000 })
  return { codigo: r.status, out: r.stdout || '', err: r.stderr || '' }
}

let n = 0
function transcrito(linhas) {
  const f = path.join(CASA, `t${n++}.jsonl`)
  fs.writeFileSync(f, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n')
  return f
}
let idUso = 0
const fala = (texto) => ({ type: 'user', timestamp: new Date(Date.now() + n).toISOString(), message: { role: 'user', content: texto } })
const resposta = (texto, model = 'claude-opus-5-5') => ({ type: 'assistant', message: { role: 'assistant', model, content: [{ type: 'text', text: texto }] } })
/** Uma ferramenta e o resultado dela, as duas linhas. */
function bash(comando, saida, { erro = false } = {}) {
  const id = `tu${idUso++}`
  return [
    { type: 'assistant', message: { role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'tool_use', id, name: 'Bash', input: { command: comando } }] } },
    { type: 'user', toolUseResult: { ok: 1 }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: saida, is_error: erro }] } },
  ]
}
const barrou = (x, guarda) => x.codigo === 2 && x.err.startsWith(`[${guarda}]`)
const passou = (x) => x.codigo === 0 && !x.err && !x.out
let sess = 0
const stop = (script, linhas, extra = {}) => rodar(script, { hook_event_name: 'Stop', cwd: TRABALHO, session_id: `s${sess++}`, transcript_path: transcrito(linhas), ...extra })

/* ---------- peça 0: conferência em todo pedido de ação ---------- */
const pend = (id) => path.join(CASA, '.local', 'share', 'agent-cockpit', 'confere', `${id}.json`)
const pedido = (prompt, id) => rodar('anonimo-prompt.mjs', { hook_event_name: 'UserPromptSubmit', prompt, cwd: TRABALHO, session_id: id })
let r = pedido('commit', 'p0a')
ok(r.out.includes('AskUserQuestion') && fs.existsSync(pend('p0a')), 'peça 0: "commit" sozinho abre a conferência')
r = pedido('manda ver', 'p0b')
ok(r.out.includes('AskUserQuestion') && fs.existsSync(pend('p0b')), 'peça 0: "manda ver" abre a conferência')
r = pedido('sobe dev server', 'p0c')
ok(r.out.includes('AskUserQuestion') && fs.existsSync(pend('p0c')), 'peça 0: "sobe dev server" abre a conferência')
r = pedido('qual o comando que você usa?', 'p0d')
ok(!r.out && !fs.existsSync(pend('p0d')), 'peça 0: pergunta pura passa')
r = pedido('/commit', 'p0e')
ok(!r.out && !fs.existsSync(pend('p0e')), 'peça 0: comando de barra passa')
r = pedido('valeu', 'p0f')
ok(!r.out && !fs.existsSync(pend('p0f')), 'peça 0: agradecimento passa')

/* ---------- peça 1: o registro do turno ---------- */
const R = await import(pathToFileURL(path.join(RAIZ, 'src', 'registroTurno.mjs')).href)
const mundo = [fala('roda os testes e liga o plantão'), ...bash('node test-xyz.mjs', 'Exit code 1\nFALHOU: caso b quebrou', { erro: true }),
  ...bash('tmux kill-session -t cc-remote-elite', ''), ...bash('systemctl --user start plantao.timer', ''),
  { type: 'assistant', message: { role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'tool_use', id: 'ed', name: 'Edit', input: { file_path: '/x/a.mjs' } }] } },
  ...bash('ls -la', 'a b c'), resposta('feito')]
const reg = R.registroDoTurno(transcrito(mundo))
ok(reg.pedido === 'roda os testes e liga o plantão', 'registro: o pedido é a última mensagem real dele')
ok(reg.mudou.some((m) => m.tipo === 'Edit' && m.alvo === '/x/a.mjs') && reg.mudou.some((m) => m.tipo === 'Bash' && m.alvo.includes('kill-session')) && !reg.mudou.some((m) => m.alvo === 'ls -la'), 'registro: mudou traz Edit e Bash que muda, sem o ls')
ok(reg.erros.length === 1 && reg.erros[0].alvo === 'node test-xyz.mjs' && reg.erros[0].linha.includes('FALHOU'), 'registro: erro com o comando e a primeira linha útil')
ok(reg.testesFalhos.length === 1 && reg.testesFalhos[0].linha.includes('FALHOU'), 'registro: teste falho')
ok(reg.derrubou.length === 1 && reg.derrubou[0].rotulo.includes('kill-session') && reg.derrubou[0].alvos.includes('elite'), 'registro: derrubou (tmux kill-session, alvo sem prefixo)')
ok(reg.ligou.some((l) => l.rotulo.includes('systemctl start') && l.alvos.includes('plantao')), 'registro: ligou (systemctl start)')
ok(reg.modelos.length === 1 && reg.modelos[0] === 'claude-opus-5-5', 'registro: modelos do turno')
ok(reg.saidas.includes('$ node test-xyz.mjs') && reg.saidas.length <= 12000, 'registro: resumo das saídas até 12 KB')
const outro = R.registroDoTurno(transcrito([fala('primeiro'), ...bash('npm test', 'Exit code 1', { erro: true }), resposta('x'), fala('segundo'), ...bash('ls', 'a'), resposta('y')]))
ok(outro.pedido === 'segundo' && !outro.erros.length, 'registro: só o ÚLTIMO pedido conta, o turno anterior fica fora')
const reexec = R.registroDoTurno(transcrito([fala('x'), ...bash('node test-a.mjs', 'Exit code 1', { erro: true }), ...bash('node test-a.mjs', 'tudo ok'), resposta('z')]))
ok(!reexec.erros.length, 'registro: comando que depois rodou limpo deixa de ser erro')
ok(R.registroDoTurno('/nao/existe.jsonl').erros.length === 0, 'registro: arquivo ilegível devolve registro vazio')

// robôs da pasta: conversas claude -p nascidas nas últimas 24 h
const pastaRobo = path.join(CC_HOME, 'projects', String(TRABALHO).replace(/[^A-Za-z0-9]/g, '-'))
fs.mkdirSync(pastaRobo, { recursive: true })
const agora = Date.now()
const robo = (nome, quando, entry = 'sdk-cli') => fs.writeFileSync(path.join(pastaRobo, `${nome}.jsonl`), JSON.stringify({ type: 'user', entrypoint: entry, timestamp: new Date(quando).toISOString() }) + '\n')
robo('a', agora - 3 * 3600e3); robo('b', agora - 1 * 3600e3); robo('velho', agora - 30 * 3600e3); robo('humano', agora, 'cli')
const rb = R.robosDaPasta(TRABALHO, { casa: CC_HOME, agora })
ok(rb.n === 2 && Date.parse(rb.primeira) < Date.parse(rb.ultima), 'robôs da pasta: 2 nas últimas 24 h, com hora da primeira e da última (velho e humano fora)')

/* ---------- peça 2: cobrança de omissão ---------- */
const TESTE = (resp) => [fala('roda o teste'), ...bash('node test-xyz.mjs', 'Exit code 1\nFALHOU: caso b quebrou', { erro: true }), resposta(resp)]
ok(barrou(stop('confere-omissao.mjs', TESTE('Rodei tudo, parece bom.')), 'confere-omissao'), 'a: erro de teste não citado na resposta barra')
const a2 = stop('confere-omissao.mjs', TESTE('Rodei tudo, parece bom.'))
ok(a2.err.includes('test-xyz.mjs') && !/racioc|pensament/i.test(a2.err), 'a: a mensagem lista o item e fala de formato')
ok(passou(stop('confere-omissao.mjs', TESTE('O test-xyz.mjs falhou no caso b; vou corrigir.'))), 'b: o mesmo erro citado passa')
ok(passou(stop('confere-omissao.mjs', TESTE('Rodei tudo, parece bom.'), { stop_hook_active: true })), 'a: stop_hook_active passa (uma volta só)')
const KILL = (resp) => [fala('organiza as sessões'), ...bash('tmux kill-session -t cc-remote-elite', ''), resposta(resp)]
ok(barrou(stop('confere-omissao.mjs', KILL('Organizei as sessões.')), 'confere-omissao'), 'c: tmux kill-session não citado barra')
ok(passou(stop('confere-omissao.mjs', KILL('Encerrei a sessão Elite, que estava parada.'))), 'c: o alvo citado (sem acento, sem caixa) passa')
ok(barrou(stop('confere-omissao.mjs', [fala('liga'), ...bash('systemctl --user start plantao.timer', ''), resposta('Está tudo certo.')]), 'confere-omissao'), 'ligar um timer não citado barra')
ok(passou(stop('confere-omissao.mjs', [fala('lista'), ...bash('ls -la', 'a b'), ...bash('grep x y', 'Exit code 1', { erro: true }), resposta('Nada de novo.')])), 'turno só de leitura (grep sem achado) não dispara')
ok(passou(rodar('confere-omissao.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'robo', transcript_path: transcrito(TESTE('Rodei tudo, parece bom.')) }, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' })), 'claude -p não é cobrado')
const sessaoG = 'grava-1'
const gravar = () => rodar('confere-omissao.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: sessaoG, transcript_path: arqG })
const arqG = transcrito(TESTE('O test-xyz.mjs falhou.'))
gravar(); gravar()
const gravados = R.lerTurnos(sessaoG, 8, { home: CASA })
ok(gravados.length === 1 && gravados[0].erros.length === 1 && gravados[0].cwd === TRABALHO, 'registro gravado: uma linha por turno, a repetição do mesmo turno substitui')
ok(fs.existsSync(path.join(CASA, '.local', 'share', 'agent-cockpit', 'registro', `${sessaoG}.jsonl`)), 'registro gravado: em ~/.local/share/agent-cockpit/registro')
fs.writeFileSync(path.join(CC_HOME, 'control-center.json'), JSON.stringify({ hooks: { ...Object.fromEntries(IDS.map((i) => [i, true])), 'confere-omissao': false } }))
ok(passou(stop('confere-omissao.mjs', TESTE('Rodei tudo, parece bom.'))), 'omissão: interruptor desligado cala')
fs.writeFileSync(path.join(CC_HOME, 'control-center.json'), JSON.stringify({ hooks: Object.fromEntries(IDS.map((i) => [i, true])) }))

/* ---------- peça 3: o conferente ---------- */
const AFIRMA = 'Pronto, todas as sessões estão em Sonnet.'
const SONNET = [fala('muda todas as sessões para Sonnet'), ...bash('cc sessoes modelos', 'sessao A: sonnet\nsessao Elite: opus'), resposta(AFIRMA)]
veredito({ ...VAZIO, fala_x_feito: { desmentidas: [{ frase: 'todas as sessões estão em Sonnet', prova: 'sessao Elite: opus' }], sem_prova: [], feito_nao_contado: [] } })
let antes = chamadas()
let c = stop('conferente.mjs', SONNET, { stop_hook_active: true })
ok(barrou(c, 'conferente') && c.err.includes('Afirmações que a saída contradiz') && c.err.includes('sessao Elite: opus'), 'd: "todas em Sonnet" com saída mostrando Opus: o conferente barra, com a prova')
ok(chamadas() === antes + 1, 'd: uma chamada ao modelo')
const entrada = fs.readFileSync(FAKE_ENTRADA, 'utf8')
ok(entrada.includes('muda todas as sessões para Sonnet') && entrada.includes('sessao Elite: opus') && entrada.includes(AFIRMA), 'montador: o texto mandado traz as três entradas (pedido, feito, fala)')
ok(/--model haiku/.test(fs.readFileSync(`${FAKE_ENTRADA}.args`, 'utf8')), 'd: chama claude -p com --model haiku')
const logConf = () => { try { return fs.readFileSync(path.join(CASA, 'logs', 'conferente.log'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }
ok(logConf().some((l) => l.status === 'barrou' && l.modelo === 'claude-falso-1' && l.chamada), 'd: o log registra o modelo que respondeu')
ok(!/racioc|pensament|voc[êe] (disse|escreveu)/i.test(c.err), 'd: a mensagem fala de formato, sem narração')
ok(!c.err.includes('\u2014') && !c.err.includes('\u2013'), 'd: sem travessão')

antes = chamadas()
ok(passou(stop('conferente.mjs', SONNET)), 'd: na primeira passada (confere-fala ligado) não roda')
ok(chamadas() === antes, 'd: e não gasta chamada')
ok(passou(stop('conferente.mjs', [fala('x'), resposta('Não achei o arquivo.')], { stop_hook_active: true })), 'd: resposta sem afirmação não roda o conferente')
ok(passou(stop('conferente.mjs', [fala('x'), resposta('Todas em Sonnet, mas não conferi.')], { stop_hook_active: true })), 'd: "não conferi" passa')
// uma vez por turno
const arqUma = transcrito(SONNET)
const uma = () => rodar('conferente.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'uma-vez', stop_hook_active: true, transcript_path: arqUma })
antes = chamadas()
ok(barrou(uma(), 'conferente') && passou(uma()) && chamadas() === antes + 1, 'd: roda uma vez por turno (a terceira volta passa sem nova chamada)')
// sem achado
veredito(VAZIO)
ok(passou(stop('conferente.mjs', SONNET, { stop_hook_active: true })) && logConf().some((l) => l.status === 'passou'), 'conferente sem achado: passa e loga')
// o parada.mjs despacha o conferente e o confere-omissao
veredito({ ...VAZIO, fala_x_feito: { desmentidas: [], sem_prova: ['todas as sessões estão em Sonnet'], feito_nao_contado: [] } })
const viaParada = rodar('parada.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'via-parada', stop_hook_active: true, transcript_path: transcrito(SONNET) })
ok(viaParada.err.includes('[conferente]') && viaParada.err.includes('Afirmações sem saída'), 'o parada.mjs despacha o conferente')

// e: falha do conferente passa e grava
for (const modo of ['erro', 'lixo']) {
  const nLog = logConf().length
  const x = rodar('conferente.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: `falha-${modo}`, stop_hook_active: true, transcript_path: transcrito(SONNET) }, { FAKE_MODO: modo })
  ok(passou(x), `e: conferente com ${modo === 'erro' ? 'erro (claude saiu com 1)' : 'JSON ruim'} passa`)
  ok(logConf().slice(nLog).some((l) => l.status === 'erro' && l.erro), `e: e grava o erro no log (${modo})`)
}

// f: pedido "desliga o robô" e registro com kill-session: feito_nao_pedido
veredito({ ...VAZIO, feito_x_pedido: { pedido_nao_feito: [], feito_nao_pedido: ['derrubou a sessão cc-remote-elite'] } })
const DESLIGA = [fala('desliga o robô'), ...bash('tmux kill-session -t cc-remote-elite', ''), resposta('Pronto, desliguei o robô.')]
c = stop('conferente.mjs', DESLIGA, { stop_hook_active: true })
ok(barrou(c, 'conferente') && c.err.includes('Feito e não pedido') && c.err.includes('cc-remote-elite'), 'f: "desliga o robô" com kill-session: feito_nao_pedido barra')
ok(fs.readFileSync(FAKE_ENTRADA, 'utf8').includes('kill-session'), 'f: o conferente recebeu o registro com o kill-session')

// g: pedido de duas partes, só uma feita, resposta diz "feito"
veredito({ ...VAZIO, feito_x_pedido: { pedido_nao_feito: ['rodar os testes'], feito_nao_pedido: [] } })
const DUAS = [fala('corrige o bug e roda os testes'), ...bash('git diff', 'a'), resposta('Feito, corrigi o bug.')]
c = stop('conferente.mjs', DUAS, { stop_hook_active: true })
ok(barrou(c, 'conferente') && c.err.includes('Pedido e não feito') && c.err.includes('rodar os testes'), 'g: pedido de duas partes, uma feita, "feito": pedido_nao_feito barra')

// teto próprio de 30 por hora, no mesmo log
fs.mkdirSync(path.join(CASA, 'logs'), { recursive: true })
const horaAgora = new Date().toISOString()
fs.appendFileSync(path.join(CASA, 'logs', 'conferente.log'), Array.from({ length: 30 }, () => JSON.stringify({ em: horaAgora, chamada: true, status: 'passou' })).join('\n') + '\n')
antes = chamadas()
ok(passou(stop('conferente.mjs', SONNET, { stop_hook_active: true })) && chamadas() === antes && logConf().some((l) => l.status === 'teto'), 'teto: 30 chamadas na hora passa sem chamar o modelo e loga')

// o conferente não conta no teto-robo, e dentro dele os ganchos de fim não rodam
const pastaTeto = path.join(CC_HOME, 'projects', '-x')
fs.mkdirSync(pastaTeto, { recursive: true })
for (let i = 0; i < 4; i++) fs.writeFileSync(path.join(pastaTeto, `r${i}.jsonl`), JSON.stringify({ type: 'user', entrypoint: 'sdk-cli', timestamp: new Date().toISOString() }) + '\n')
fs.mkdirSync(path.join(CASA, '.config', 'agent-cockpit'), { recursive: true })
fs.writeFileSync(path.join(CASA, '.config', 'agent-cockpit', 'teto-robo.json'), '{"porHora":2}')
const prompt = { hook_event_name: 'UserPromptSubmit', prompt: 'oi', cwd: TRABALHO }
ok(rodar('anonimo-prompt.mjs', prompt, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' }).out.includes('[teto-robo]'), 'teto-robo: robô comum acima do teto continua barrado')
ok(passou(rodar('anonimo-prompt.mjs', prompt, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli', CC_CONFERENTE: '1' })), 'teto-robo: o conferente (CC_CONFERENTE=1) é ignorado')
const dentro = rodar('conferente.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'dentro', stop_hook_active: true, transcript_path: transcrito(SONNET) }, { CC_CONFERENTE: '1' })
ok(passou(dentro), 'conferente: com CC_CONFERENTE=1 sai sem rodar (sem laço)')

// interruptor
fs.writeFileSync(path.join(CC_HOME, 'control-center.json'), JSON.stringify({ hooks: { ...Object.fromEntries(IDS.map((i) => [i, true])), conferente: false } }))
ok(passou(stop('conferente.mjs', SONNET, { stop_hook_active: true })), 'conferente: interruptor desligado cala')

fs.rmSync(CASA, { recursive: true, force: true })
if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nCC-1070: todas as peças conferidas')
