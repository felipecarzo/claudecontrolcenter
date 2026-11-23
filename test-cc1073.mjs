#!/usr/bin/env node
/**
 * CC-1073: o conferente também roda quando o REGISTRO do turno tem ação de risco.
 *
 * Mesma montagem do test-cc1070.mjs: cada gancho roda como processo, com JSON no stdin,
 * numa casa temporária (HOME e CC_HOME falsos), e o `claude` é um falso no PATH que devolve
 * JSON fixo. Nenhum modelo é chamado.
 *
 * Casos do plano: a (tmux kill-session não pedido, resposta sem afirmar nada: roda e barra),
 * b (rm pedido e citado: roda e passa), c (só leitura e conversa: não roda), d (SendUserFile
 * não pedido: roda), e (stop_hook_active: passa), f (acima do teto por hora: passa e loga).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathComFalso, soComFalso, WIN } from './test/windows.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const HOOKS = path.join(RAIZ, 'hooks')
const CASA = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1073-'))
const CC_HOME = path.join(CASA, '.claude')
const TRABALHO = path.join(CASA, 'trabalho')
const BIN = path.join(CASA, 'bin')
for (const d of [CC_HOME, TRABALHO, BIN]) fs.mkdirSync(d, { recursive: true })
const IDS = ['confere-fala', 'confere-omissao', 'conferente']
const ligar = (extra = {}) => fs.writeFileSync(path.join(CC_HOME, 'control-center.json'), JSON.stringify({ hooks: { ...Object.fromEntries(IDS.map((i) => [i, true])), ...extra } }))
ligar()

const FALSO = path.join(BIN, 'claude')
fs.writeFileSync(FALSO, [
  '#!/bin/bash',
  'cat > "$FAKE_ENTRADA"',
  'echo x >> "$FAKE_ENTRADA.n"',
  'cat "$FAKE_SAIDA"',
].join('\n'))
fs.chmodSync(FALSO, 0o755)
const FAKE_ENTRADA = path.join(CASA, 'fake-entrada.txt')
const FAKE_SAIDA = path.join(CASA, 'fake-saida.json')
const chamadas = () => { try { return fs.readFileSync(`${FAKE_ENTRADA}.n`, 'utf8').split('\n').filter(Boolean).length } catch { return 0 } }
const veredito = (v) => fs.writeFileSync(FAKE_SAIDA, JSON.stringify({ result: JSON.stringify(v), modelUsage: { 'claude-falso-1': { inputTokens: 1 } } }))
const VAZIO = { fala_x_feito: { desmentidas: [], sem_prova: [], feito_nao_contado: [] }, feito_x_pedido: { pedido_nao_feito: [], feito_nao_pedido: [] } }
const logConf = () => { try { return fs.readFileSync(path.join(CASA, 'logs', 'conferente.log'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }

let falhas = 0
let ok = (cond, msg) => { if (!cond) { falhas++; console.error(`FALHOU: ${msg}`) } else console.log(`ok ${msg}`) }

function rodar(script, entrada, env = {}) {
  const e = { ...process.env, HOME: CASA, USERPROFILE: CASA, CC_HOME, PATH: pathComFalso(BIN, 'claude'), FAKE_ENTRADA, FAKE_SAIDA, ...env } // CC-1118: homedir e PATH do Windows, nunca o claude real
  for (const k of ['CLAUDE_CODE_ENTRYPOINT', 'CC_CONFERENTE']) if (env[k] === undefined) delete e[k]
  // CC-1118: no Windows `timeout` é outro programa (o TIMEOUT.EXE do sistema); lá o teto fica só no spawnSync
  const [cmd, args] = WIN ? [process.execPath, [path.join(HOOKS, script)]] : ['timeout', ['60', 'node', path.join(HOOKS, script)]]
  const r = spawnSync(cmd, args, { input: JSON.stringify(entrada), env: e, encoding: 'utf8', cwd: TRABALHO, timeout: 70000 })
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
const resposta = (texto) => ({ type: 'assistant', message: { role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: texto }] } })
function ferramenta(nome, entrada, saida = '') {
  const id = `tu${idUso++}`
  return [
    { type: 'assistant', message: { role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'tool_use', id, name: nome, input: entrada }] } },
    { type: 'user', toolUseResult: { ok: 1 }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: saida, is_error: false }] } },
  ]
}
const bash = (comando, saida = '') => ferramenta('Bash', { command: comando }, saida)
const barrou = (x) => x.codigo === 2 && x.err.startsWith('[conferente]')
const passou = (x) => x.codigo === 0 && !x.err && !x.out
let sess = 0
const stop = (script, linhas, extra = {}) => rodar(script, { hook_event_name: 'Stop', cwd: TRABALHO, session_id: `r${sess++}`, transcript_path: transcrito(linhas), ...extra })

/* ---------- os detectores, sobre o registro ---------- */
const R = await import(pathToFileURL(path.join(RAIZ, 'src', 'registroTurno.mjs')).href)
const registroDe = (...itens) => R.registroDoTurno(transcrito([fala('x'), ...itens.flat(), resposta('ok')]))
const rotulos = (reg, campo) => (reg[campo] || []).map((x) => x.rotulo)
let reg = registroDe(bash('rm -rf /tmp/a'), bash('rmdir x'), bash('git reset --hard HEAD~1'), bash('git branch -D velho'), bash('git push --force origin x'), bash('git push -f'), bash('psql -c "DROP TABLE t"'))
ok(rotulos(reg, 'apagou').length === 7, `apagou: rm, rmdir, reset --hard, branch -D, push --force, push -f e DROP TABLE (7), veio ${rotulos(reg, 'apagou').length}`)
reg = registroDe(bash('git commit -m "x"'), bash('git push origin x'), bash('git -C /a commit -m y'), bash('node tools/deploy-seguro/executar.mjs'), bash('npm run deploy'), bash('timeout 60 git push'))
ok(rotulos(reg, 'commitou').length === 6, `commitou: git commit, git push, git -C commit, deploy por node, npm run deploy, timeout git push (6), veio ${rotulos(reg, 'commitou').length}`)
reg = registroDe(bash('git commit -m "apaga rm -rf e DROP TABLE do deploy"'), bash('git status'), bash('git log --oneline -3'), bash('git diff'), bash('git push --dry-run'),
  bash('node test-deploy.mjs'), bash('node --check tools/deploy-seguro/x.mjs'), bash('grep -n deploy docs/x.md'), bash('ls tools/deploy-seguro'), bash('echo "rm -rf x"'), bash('git branch -d velho'), bash('git reset --soft HEAD~1'))
ok(!rotulos(reg, 'apagou').length, `apagou: texto dentro de aspas, git status/log/diff, branch -d e reset --soft não contam, veio ${JSON.stringify(rotulos(reg, 'apagou'))}`)
ok(rotulos(reg, 'commitou').length === 1 && rotulos(reg, 'commitou')[0] === 'git commit', `commitou: só o git commit real; push --dry-run, test-deploy, --check e grep não contam, veio ${JSON.stringify(rotulos(reg, 'commitou'))}`)
reg = registroDe(ferramenta('SendUserFile', { files: ['/tmp/a/print.png', '/tmp/b.png'], caption: 'x' }))
ok(rotulos(reg, 'enviou').length === 1 && rotulos(reg, 'enviou')[0].includes('print.png') && rotulos(reg, 'enviou')[0].includes('b.png'), 'enviou: SendUserFile com o nome dos arquivos')
reg = registroDe(bash('tmux kill-session -t cc-remote-x'), bash('systemctl --user start p.timer'), ferramenta('Agent', { description: 'rever' }), bash('rm /tmp/z'))
ok(R.riscoDoRegistro(reg).length === 3 && R.riscoDoRegistro(reg)[0].startsWith('derrubou: '), 'riscoDoRegistro junta derrubou, ligou (o timer, sem o Agent) e apagou, na ordem')
ok(rotulos(reg, 'ligou').length === 2, 'o Agent continua no registro (ligou), para a cobrança de omissão')
reg = registroDe(ferramenta('Agent', { description: 'rever' }), ferramenta('ScheduleWakeup', { delaySeconds: 600 }), ferramenta('CronCreate', { cron: '*/5 * * * *' }))
ok(rotulos(reg, 'ligou').length === 3 && R.riscoDoRegistro(reg).length === 0, 'Agent, ScheduleWakeup e CronCreate sozinhos ficam no registro mas não contam como risco (decisão dele, 28/10)')
reg = registroDe(bash('ls -la'), bash('cat docs/x.md'), bash('grep -rn x src'), ferramenta('Edit', { file_path: '/x/a.mjs' }), bash('node test-a.mjs', 'tudo ok'))
ok(R.riscoDoRegistro(reg).length === 0, 'riscoDoRegistro: leitura, Edit comum e teste não são risco')

/* ---------- a: kill-session não pedido, resposta sem afirmar nada ---------- */
const okDeVerdade = ok
ok = soComFalso(ok, 'claude') // CC-1118: daqui em diante as checagens dependem do claude falso
veredito({ ...VAZIO, feito_x_pedido: { pedido_nao_feito: [], feito_nao_pedido: ['derrubou a sessão cc-remote-elite'] } })
const KILL = [fala('mostra o estado das sessões'), ...bash('tmux kill-session -t cc-remote-elite'), resposta('Aqui está o estado: três sessões abertas.')]
let antes = chamadas()
let x = stop('conferente.mjs', KILL)
ok(barrou(x) && x.err.includes('Feito e não pedido') && x.err.includes('cc-remote-elite'), 'a: kill-session não pedido, resposta sem afirmar nada: o conferente roda e barra')
ok(chamadas() === antes + 1, 'a: uma chamada ao modelo')
ok(logConf().some((l) => l.status === 'barrou' && l.gatilho === 'risco' && l.risco?.[0]?.startsWith('derrubou')), 'a: o log diz que o gatilho foi o risco e qual')
ok(!x.err.includes('\u2014') && !x.err.includes('\u2013') && !/racioc|pensament/i.test(x.err), 'a: a mensagem sem travessão e sem narração')
console.log(`--- saída de (a), código ${x.codigo}:\n${x.err}---`)

/* ---------- b: rm pedido e citado ---------- */
veredito(VAZIO)
const RM = [fala('apaga o arquivo velho.txt'), ...bash('rm /tmp/velho.txt'), resposta('Apaguei o velho.txt.')]
antes = chamadas()
x = stop('conferente.mjs', RM)
ok(passou(x) && chamadas() === antes + 1, 'b: rm pedido e citado: o conferente roda e passa')
ok(logConf().some((l) => l.status === 'passou' && l.gatilho === 'risco'), 'b: e o log registra que passou, por risco')

/* ---------- só risco: sem_prova não conta ---------- */
veredito({ ...VAZIO, fala_x_feito: { desmentidas: [], sem_prova: ['algo sem prova'], feito_nao_contado: [] } })
x = stop('conferente.mjs', RM)
ok(passou(x), 'só risco: sem_prova sozinho não barra (não há afirmação para provar)')
veredito({ ...VAZIO, fala_x_feito: { desmentidas: [], sem_prova: [], feito_nao_contado: ['apagou também outra pasta'] } })
x = stop('conferente.mjs', RM)
ok(barrou(x) && x.err.includes('Feito e não contado'), 'só risco: feito_nao_contado barra')
veredito({ ...VAZIO, fala_x_feito: { desmentidas: [{ frase: 'apaguei', prova: 'a saída mostra erro' }], sem_prova: [], feito_nao_contado: [] } })
x = stop('conferente.mjs', RM)
ok(barrou(x) && x.err.includes('contradiz'), 'só risco: desmentida barra')
veredito({ ...VAZIO, feito_x_pedido: { pedido_nao_feito: ['apagar o outro'], feito_nao_pedido: [] } })
x = stop('conferente.mjs', RM)
ok(barrou(x) && x.err.includes('Pedido e não feito'), 'só risco: pedido_nao_feito barra')

/* ---------- c: leitura, conversa e edição comum não chamam o modelo ---------- */
veredito({ ...VAZIO, feito_x_pedido: { pedido_nao_feito: [], feito_nao_pedido: ['qualquer coisa'] } })
antes = chamadas()
const LEITURA = [fala('o que tem nessa pasta?'), ...bash('ls -la'), ...bash('cat docs/x.md', 'texto'), ...bash('grep -rn x src', 'Exit code 1'), resposta('Tem três arquivos.')]
x = stop('conferente.mjs', LEITURA)
ok(passou(x) && chamadas() === antes, 'c: turno só de leitura não roda e não gasta chamada')
x = stop('conferente.mjs', [fala('e aí, tudo bem?'), resposta('Tudo certo por aqui.')])
ok(passou(x) && chamadas() === antes, 'c: turno de conversa não roda e não gasta chamada')
x = stop('conferente.mjs', [fala('muda o x'), ...ferramenta('Edit', { file_path: '/x/a.mjs' }), ...bash('node test-a.mjs', 'ok'), resposta('A mudança está no arquivo a.mjs.')])
ok(passou(x) && chamadas() === antes, 'c: edição comum e teste, sem afirmação, não rodam')
console.log('--- saída de (c): código 0, sem texto, 0 chamadas ao modelo ---')

/* ---------- d: SendUserFile não pedido ---------- */
veredito({ ...VAZIO, feito_x_pedido: { pedido_nao_feito: [], feito_nao_pedido: ['enviou print.png a ele'] } })
const ENVIA = [fala('o que você achou do layout?'), ...ferramenta('SendUserFile', { files: ['/tmp/print.png'], status: 'proactive' }), resposta('Achei o layout limpo.')]
antes = chamadas()
x = stop('conferente.mjs', ENVIA)
ok(barrou(x) && x.err.includes('print.png') && chamadas() === antes + 1, 'd: SendUserFile sem o arquivo ter sido pedido: roda e barra')

/* ---------- commit e deploy chegam ao conferente ---------- */
for (const [nome, cmd] of [['git commit', 'git commit -m "x"'], ['git push', 'git push origin x'], ['deploy', 'node tools/deploy-seguro/executar.mjs']]) {
  antes = chamadas()
  x = stop('conferente.mjs', [fala('vê como está o projeto'), ...bash(cmd), resposta('O projeto está na branch x.')])
  ok(barrou(x) && chamadas() === antes + 1, `${nome} sem pedido: roda e barra`)
}

/* ---------- e: stop_hook_active passa ---------- */
antes = chamadas()
x = stop('conferente.mjs', KILL, { stop_hook_active: true })
ok(passou(x) && chamadas() === antes, 'e: stop_hook_active: o gatilho de risco passa sem chamar o modelo')
const arqUma = transcrito(KILL)
const uma = (extra = {}) => rodar('conferente.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'uma-vez', transcript_path: arqUma, ...extra })
antes = chamadas()
ok(barrou(uma()) && passou(uma({ stop_hook_active: true })) && passou(uma()) && chamadas() === antes + 1, 'e: uma vez por turno (a volta seguinte e a repetição passam sem nova chamada)')
x = rodar('conferente.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'robo', transcript_path: transcrito(KILL) }, { CC_CONFERENTE: '1' })
ok(passou(x), 'e: CC_CONFERENTE=1 (dentro do conferente) sai sem rodar')
x = rodar('conferente.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'robo2', transcript_path: transcrito(KILL) }, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' })
ok(passou(x), 'e: claude -p (sdk-cli) não é conferido')

/* ---------- risco e afirmação no mesmo turno: uma chamada só ---------- */
veredito({ ...VAZIO, feito_x_pedido: { pedido_nao_feito: [], feito_nao_pedido: ['derrubou a sessão'] } })
const AMBOS = [fala('mostra as sessões'), ...bash('tmux kill-session -t cc-remote-y'), resposta('Pronto, mostrei as sessões.')]
const sAmbos = 'ambos'
const arqAmbos = transcrito(AMBOS)
const volta = (extra = {}) => rodar('conferente.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: sAmbos, transcript_path: arqAmbos, ...extra })
antes = chamadas()
ok(barrou(volta()) && passou(volta({ stop_hook_active: true })) && chamadas() === antes + 1, 'risco com afirmação: roda na primeira passada e a segunda não gasta outra chamada')

/* ---------- o parada.mjs despacha ---------- */
veredito({ ...VAZIO, feito_x_pedido: { pedido_nao_feito: [], feito_nao_pedido: ['derrubou a sessão cc-remote-z'] } })
x = rodar('parada.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'via-parada', transcript_path: transcrito([fala('mostra'), ...bash('tmux kill-session -t cc-remote-z'), resposta('Veja o estado acima.')]) })
ok(x.err.includes('[conferente]') && x.err.includes('Feito e não pedido'), 'o parada.mjs despacha o conferente também pelo gatilho de risco')

/* ---------- falha do modelo passa e grava ---------- */
const FALHA = rodar('conferente.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, session_id: 'falha', transcript_path: transcrito(KILL) }, { PATH: WIN ? [path.join(CASA, 'vazio'), path.dirname(process.execPath)].join(path.delimiter) : `${path.join(CASA, 'vazio')}:/usr/bin:/bin` }) // CC-1118: no Windows, só o Node, sem claude
ok = okDeVerdade // sem o claude no PATH é justamente o caso: vale também no Windows
ok(passou(FALHA) && logConf().some((l) => l.status === 'erro' && l.gatilho === 'risco'), 'falha aberta: sem o claude no PATH passa e grava o erro no log')
ok = soComFalso(okDeVerdade, 'claude')

/* ---------- f: teto por hora ---------- */
fs.mkdirSync(path.join(CASA, 'logs'), { recursive: true })
fs.appendFileSync(path.join(CASA, 'logs', 'conferente.log'), Array.from({ length: 30 }, () => JSON.stringify({ em: new Date().toISOString(), chamada: true, status: 'passou' })).join('\n') + '\n')
antes = chamadas()
x = stop('conferente.mjs', KILL)
ok(passou(x) && chamadas() === antes && logConf().some((l) => l.status === 'teto' && l.gatilho === 'risco'), 'f: acima de 30 por hora: passa sem chamar o modelo e grava "teto" no log')

/* ---------- interruptor ---------- */
fs.rmSync(path.join(CASA, 'logs'), { recursive: true, force: true })
ligar({ conferente: false })
antes = chamadas()
ok(passou(stop('conferente.mjs', KILL)) && chamadas() === antes, 'interruptor do conferente desligado cala o gatilho de risco')

fs.rmSync(CASA, { recursive: true, force: true })
if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nCC-1073: conferência por ação de risco conferida')
