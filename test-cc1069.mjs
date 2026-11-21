#!/usr/bin/env node
/**
 * CC-1069: as quatro travas contra gasto e ação que ele não pediu.
 *
 * Cada gancho roda como processo, com JSON no stdin, numa casa temporária
 * (HOME e CC_HOME falsos): nenhum dado real é tocado. Os interruptores das
 * travas são ligados no config da casa falsa, então o teste vale com ou sem a
 * entrada correspondente no catálogo.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const HOOKS = path.join(RAIZ, 'hooks')
const CASA = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1069-'))
const CC_HOME = path.join(CASA, '.claude')
const TRABALHO = path.join(CASA, 'trabalho')
fs.mkdirSync(CC_HOME, { recursive: true })
fs.mkdirSync(TRABALHO, { recursive: true })
const IDS = ['teto-robo', 'autonomo-guard', 'escopo-guard', 'confere-fala', 'confere-pedido']
const escreverConfig = (hooks) => fs.writeFileSync(path.join(CC_HOME, 'control-center.json'), JSON.stringify({ hooks }))
escreverConfig(Object.fromEntries(IDS.map((i) => [i, true])))

let falhas = 0
const ok = (cond, msg) => { if (!cond) { falhas++; console.error(`FALHOU: ${msg}`) } else console.log(`ok ${msg}`) }

function rodar(script, entrada, env = {}) {
  const e = { ...process.env, HOME: CASA, CC_HOME, ...env }
  if (env.CLAUDE_CODE_ENTRYPOINT === undefined) delete e.CLAUDE_CODE_ENTRYPOINT
  const r = spawnSync('node', [path.join(HOOKS, script)], { input: JSON.stringify(entrada), env: e, encoding: 'utf8', cwd: TRABALHO, timeout: 20000 })
  return { codigo: r.status, out: r.stdout || '', err: r.stderr || '' }
}

let n = 0
function transcrito(linhas) {
  const f = path.join(CASA, `t${n++}.jsonl`)
  fs.writeFileSync(f, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n')
  return f
}
const fala = (texto) => ({ type: 'user', timestamp: new Date().toISOString(), message: { role: 'user', content: texto } })
const resposta = (texto) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: texto }] } })
const usa = (name) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name, input: {} }] } })
const resultado = { type: 'user', toolUseResult: { ok: 1 }, message: { role: 'user', content: [{ type: 'tool_result', content: 'x' }] } }

/* ---------- 1. teto-robo (anonimo-prompt, UserPromptSubmit) ---------- */
const pasta = path.join(CC_HOME, 'projects', '-x')
fs.mkdirSync(pasta, { recursive: true })
const robo = (nome, quando = Date.now(), entry = 'sdk-cli') => {
  const f = path.join(pasta, `${nome}.jsonl`)
  fs.writeFileSync(f, JSON.stringify({ type: 'user', entrypoint: entry, timestamp: new Date(quando).toISOString() }) + '\n')
}
for (const i of [1, 2, 3]) robo(`r${i}`)
robo('velho', Date.now() - 2 * 3600e3)   // mtime novo, mas nasceu há 2h: não conta
robo('humano', Date.now(), 'cli')        // sessão dele: não conta
const cfgDir = path.join(CASA, '.config', 'agent-cockpit')
fs.mkdirSync(cfgDir, { recursive: true })
const prompt = { hook_event_name: 'UserPromptSubmit', prompt: 'oi', cwd: TRABALHO }
const SDK = { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' }

fs.writeFileSync(path.join(cfgDir, 'teto-robo.json'), '{"porHora":2}')
let r = rodar('anonimo-prompt.mjs', prompt, SDK)
ok(r.codigo === 0 && JSON.parse(r.out || '{}').decision === 'block' && r.out.includes('[teto-robo]') && r.out.includes('3 conversas'), 'teto: 3 robôs contra teto 2 bloqueia (velho e humano fora da conta)')
ok(fs.existsSync(path.join(CASA, 'logs', 'teto-robo.log')) && /bloqueado 3\/2/.test(fs.readFileSync(path.join(CASA, 'logs', 'teto-robo.log'), 'utf8')), 'teto: grava a linha no log')
r = rodar('anonimo-prompt.mjs', prompt, { CLAUDE_CODE_ENTRYPOINT: 'cli' })
ok(r.codigo === 0 && !r.out, 'teto: sessão interativa (cli) nunca é barrada')
r = rodar('anonimo-prompt.mjs', prompt)
ok(r.codigo === 0 && !r.out, 'teto: sem ENTRYPOINT nunca é barrada')
fs.writeFileSync(path.join(cfgDir, 'teto-robo.json'), '{"porHora":3}')
r = rodar('anonimo-prompt.mjs', prompt, SDK)
ok(r.codigo === 0 && !r.out, 'teto: 3 robôs com teto 3 passa')
fs.rmSync(path.join(cfgDir, 'teto-robo.json'))
r = rodar('anonimo-prompt.mjs', prompt, SDK)
ok(r.codigo === 0 && !r.out, 'teto: sem arquivo vale o padrão 20')
fs.writeFileSync(path.join(cfgDir, 'robo-desligado'), '')
r = rodar('anonimo-prompt.mjs', prompt, SDK)
ok(JSON.parse(r.out || '{}').decision === 'block' && r.out.includes('robo-desligado'), 'teto: robo-desligado barra todo claude -p')
r = rodar('anonimo-prompt.mjs', prompt, { CLAUDE_CODE_ENTRYPOINT: 'cli' })
ok(r.codigo === 0 && !r.out, 'teto: robo-desligado não toca a sessão dele')
fs.rmSync(path.join(cfgDir, 'robo-desligado'))
fs.writeFileSync(path.join(cfgDir, 'teto-robo.json'), '{"porHora":2}')
escreverConfig({ ...Object.fromEntries(IDS.map((i) => [i, true])), 'teto-robo': false })
r = rodar('anonimo-prompt.mjs', prompt, SDK)
ok(r.codigo === 0 && !r.out, 'teto: interruptor desligado no config cala')
escreverConfig(Object.fromEntries(IDS.map((i) => [i, true])))

/* ---------- 2. autonomo-guard (quebra-guard Bash, modelo-guard Cron/Wakeup) ---------- */
const bash = (comando, ele) => rodar('quebra-guard.mjs', { tool_name: 'Bash', tool_input: { command: comando }, cwd: TRABALHO, transcript_path: ele === undefined ? undefined : transcrito([fala(ele), usa('Bash'), resultado]) })
const barrou = (x, guarda) => x.codigo === 2 && x.err.startsWith(`[${guarda}]`)
const passou = (x) => x.codigo === 0 && !x.err && !x.out

ok(barrou(bash('node cc.mjs regente ligar', 'faz o commit'), 'autonomo-guard'), 'autonomo: regente ligar sem pedido barra')
ok(passou(bash('node cc.mjs regente ligar', 'liga o regente aí')), 'autonomo: "liga o regente" autoriza')
ok(passou(bash('cc regente ligar', 'Ativa o robô, por favor')), 'autonomo: "ativa o robô" autoriza')
ok(barrou(bash('systemctl --user enable --now plantao.timer', 'desliga o robô'), 'autonomo-guard'), 'autonomo: "desliga o robô" NÃO autoriza ligar timer')
ok(passou(bash('systemctl --user enable plantao.timer', 'agenda o plantão para as 3h')), 'autonomo: "agenda o plantão" autoriza timer')
ok(barrou(bash('systemctl --user restart x.timer', 'olha o log'), 'autonomo-guard'), 'autonomo: restart de timer sem pedido barra')
ok(barrou(bash('curl -s -X POST localhost:5180/api/regente -d x', 'e agora?'), 'autonomo-guard'), 'autonomo: POST em /api/regente barra')
ok(barrou(bash('cat > ~/.config/systemd/user/a.timer <<EOF\n[Timer]\nEOF', 'ok'), 'autonomo-guard'), 'autonomo: escrever .timer em systemd/user barra')
ok(barrou(bash('crontab -e', 'ok'), 'autonomo-guard'), 'autonomo: editar crontab barra')
ok(barrou(bash('touch ~/dados/plantao-ativo', 'ok'), 'autonomo-guard'), 'autonomo: criar plantao-ativo barra')
ok(barrou(bash('crontab -e'), 'autonomo-guard'), 'autonomo: sem transcrito não há pedido, barra')
ok(barrou(bash('ls && systemctl --user start y.timer', 'ok'), 'autonomo-guard'), 'autonomo: comando encadeado é visto por segmento')
for (const c of ['ls -la', 'git status', 'crontab -l', 'systemctl --user status x.timer', 'systemctl --user restart foo.service',
  'node cc.mjs regente status', 'git commit -m "systemctl --user start x.timer; cc regente ligar"', 'curl -s localhost:5180/api/regente']) {
  ok(passou(bash(c, 'ok')), `autonomo/escopo: sessão comum passa: ${c.split('\n')[0]}`)
}
const ferr = (tool_name, ele) => rodar('modelo-guard.mjs', { tool_name, tool_input: {}, cwd: TRABALHO, transcript_path: transcrito([fala(ele)]) })
ok(barrou(ferr('CronCreate', 'continua'), 'autonomo-guard'), 'autonomo: CronCreate sem pedido barra')
ok(barrou(ferr('ScheduleWakeup', 'continua'), 'autonomo-guard'), 'autonomo: ScheduleWakeup sem pedido barra')
ok(passou(ferr('CronCreate', 'agenda um lembrete automático')), 'autonomo: CronCreate com pedido passa')
ok(passou(ferr('Read', 'continua')) && passou(ferr('Agent', 'continua')), 'autonomo: outras ferramentas passam pelo modelo-guard')
ok(passou(rodar('modelo-guard.mjs', { tool_name: 'Bash', tool_input: { command: 'cc regente ligar' }, cwd: TRABALHO })), 'autonomo: Bash não é do modelo-guard')

/* ---------- 3. escopo-guard ---------- */
ok(barrou(bash('tmux kill-session -t cc-remote-elite', 'desliga o robô'), 'escopo-guard'), 'escopo: "desliga o robô" não autoriza derrubar sessão')
ok(passou(bash('tmux kill-session -t cc-remote-elite', 'mata a sessão elite')), 'escopo: "sessão" autoriza tmux')
ok(passou(bash('tmux kill-session -t cc-remote-elite', 'derruba o Elite')), 'escopo: nome do alvo (sem prefixo, sem caixa) autoriza')
ok(barrou(bash('tmux kill-session -t cc-remote-elite', 'derruba o eliteza'), 'escopo-guard'), 'escopo: nome só como pedaço de palavra não autoriza')
ok(barrou(bash('systemctl --user stop agent-cockpit', 'desliga tudo'), 'escopo-guard'), 'escopo: "desliga tudo" não autoriza systemctl stop')
ok(barrou(bash('systemctl --user disable cockpit-auth', 'desliga tudo'), 'escopo-guard'), 'escopo: disable sem nome barra')
ok(barrou(bash('systemctl --user mask x.service', 'desliga tudo'), 'escopo-guard'), 'escopo: mask sem nome barra')
ok(passou(bash('systemctl --user stop agent-cockpit', 'para o serviço')), 'escopo: "serviço" autoriza systemctl')
ok(passou(bash('systemctl --user stop agent-cockpit.service', 'para o agent-cockpit')), 'escopo: nome da unidade autoriza')
ok(barrou(bash('systemctl --user stop a b', 'para o a'), 'escopo-guard'), 'escopo: todas as unidades precisam estar nomeadas')
ok(barrou(bash('pkill -f claude', 'desliga tudo'), 'escopo-guard'), 'escopo: pkill claude sem pedido barra')
ok(passou(bash('pkill -f claude', 'encerra as sessões do claude')), 'escopo: pkill claude com "sessões" passa')
ok(barrou(bash('kill $(pgrep -f claude)', 'ok'), 'escopo-guard'), 'escopo: kill de pgrep claude barra')
ok(passou(bash('tmux ls', 'ok')) && passou(bash('systemctl --user list-units', 'ok')) && passou(bash('kill 1234', 'ok')), 'escopo: tmux ls, list-units e kill de pid comum passam')

// interruptor por trava
escreverConfig({ ...Object.fromEntries(IDS.map((i) => [i, true])), 'escopo-guard': false, 'autonomo-guard': false })
ok(passou(bash('tmux kill-session -t cc-remote-elite', 'desliga o robô')) && passou(bash('cc regente ligar', 'oi')), 'autonomo/escopo: interruptores desligados calam')
escreverConfig(Object.fromEntries(IDS.map((i) => [i, true])))

/* ---------- 4 e 6. confere-fala (Stop; absorve o afirmacao-guard) ---------- */
const stop = (linhas, extra = {}) => rodar('confere-fala.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, transcript_path: transcrito(linhas), ...extra })
const AFIRMA = 'Pronto, todas as sessões estão em Sonnet.'
let s = stop([fala('muda o modelo'), resposta(AFIRMA)])
ok(barrou(s, 'confere-fala'), 'fala: "todas ... Sonnet" barra')
ok(!/racioc|pensament|voc[êe] (disse|escreveu)/i.test(s.err), 'fala: a mensagem fala de formato, sem citar nem pedir narração')
ok(barrou(stop([fala('x'), usa('Bash'), resultado, resposta(AFIRMA)]), 'confere-fala'), 'fala: mesmo com Bash no turno pede a conferência, uma vez')
ok(barrou(stop([fala('x'), resposta('Fiz a mudança e subi 3 commits.')]), 'confere-fala'), 'fala: "fiz" e "3 commits" barram')
ok(barrou(stop([fala('x'), resposta('O serviço está no ar.')]), 'confere-fala'), 'fala: "está no ar" barra')
ok(barrou(stop([fala('x'), resposta('Tudo está rodando normalmente.')]), 'confere-fala'), 'fala: "tudo ... rodando" barra')
ok(passou(stop([fala('x'), resposta('Todas as sessões estão em Sonnet, mas não conferi.')])), 'fala: "não conferi" passa')
ok(passou(stop([fala('x'), resposta(AFIRMA)], { stop_hook_active: true })), 'fala: stop_hook_active passa (uma volta só)')
ok(passou(stop([fala('x'), resposta('Não achei o arquivo. Qual dos dois você quer usar?')])), 'fala: resposta sem afirmação não dispara')
ok(passou(stop([fala('x'), resposta('Veja o exemplo:\n```\ntodas ligadas, fiz\n```\nNada mais.')])), 'fala: bloco de código não conta')
escreverConfig({ ...Object.fromEntries(IDS.map((i) => [i, true])), 'confere-fala': false })
ok(passou(stop([fala('x'), resposta(AFIRMA)])), 'fala: interruptor desligado cala')
escreverConfig(Object.fromEntries(IDS.map((i) => [i, true])))
s = rodar('parada.mjs', { hook_event_name: 'Stop', cwd: TRABALHO, transcript_path: transcrito([fala('x'), resposta(AFIRMA)]) })
ok(passou(s) && !s.err.includes('[confere-fala]'), 'fala: o parada.mjs despacha o guarda, mas não barra (CC-1099: vira cobrança na próxima resposta)')

/* ---------- 5. confere-pedido (UserPromptSubmit + PreToolUse) ---------- */
const SESSAO = 'sessao-teste-1'
const pend = path.join(CASA, '.local', 'share', 'agent-cockpit', 'confere', `${SESSAO}.json`)
const pedido = (prompt, env = {}, id = SESSAO) => rodar('anonimo-prompt.mjs', { hook_event_name: 'UserPromptSubmit', prompt, cwd: TRABALHO, session_id: id }, env)
const ferram = (tool_name, tool_input, linhas) => rodar('modelo-guard.mjs', { tool_name, tool_input, cwd: TRABALHO, session_id: SESSAO, transcript_path: transcrito(linhas || [fala('x')]) })
const LONGO = 'Quero que você vigie as sessões abertas a cada dez minutos até o backlog acabar, depois peça a revisão e, acabada a revisão, encerre tudo.'

r = pedido(LONGO)
ok(r.codigo === 0 && r.out.includes('additionalContext') && r.out.includes('AskUserQuestion') && fs.existsSync(pend), 'pedido: mensagem grande abre pendência e injeta a caixa')
ok(barrou(ferram('Edit', { file_path: 'a' }), 'confere-pedido') && barrou(ferram('Write', {}), 'confere-pedido') && barrou(ferram('Agent', {}), 'confere-pedido') && barrou(ferram('CronCreate', {}), 'confere-pedido'), 'pedido: Edit, Write, Agent e CronCreate barram com pendência')
ok(barrou(ferram('Bash', { command: 'git ' + 'commit -am x' }), 'confere-pedido') && barrou(ferram('Bash', { command: 'npm test' }), 'confere-pedido') && barrou(ferram('Bash', { command: 'echo oi > a.txt' }), 'confere-pedido'), 'pedido: Bash que muda coisa barra')
for (const c of ['ls -la', 'cat a | grep b', 'git status', 'git log --oneline -3', 'git diff', 'find . -name x', 'head -5 a', 'tail a', 'wc -l a', 'node --check a.mjs', 'node cc.mjs backlog json', 'cc backlog list', 'grep -r x . 2>/dev/null']) {
  ok(passou(ferram('Bash', { command: c })), `pedido: leitura passa com pendência: ${c}`)
}
ok(barrou(ferram('Bash', { command: 'find . -delete' }), 'confere-pedido'), 'pedido: find -delete barra')
ok(passou(ferram('Read', {})) && passou(ferram('Grep', {})) && passou(ferram('Glob', {})) && passou(ferram('AskUserQuestion', {})), 'pedido: Read, Grep, Glob e AskUserQuestion passam')
const caixa = (resp) => [fala(LONGO), { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu1', name: 'AskUserQuestion', input: {} }] } },
  { type: 'user', toolUseResult: { answers: { 'Confere?': resp } }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: `The user answered: "Confere?"="${resp}".` }] } }]
ok(barrou(ferram('Edit', {}, caixa('Não é isso')), 'confere-pedido'), 'pedido: "Não é isso" mantém a pendência')
ok(passou(ferram('Edit', {}, caixa('É isso'))) && !fs.existsSync(pend), 'pedido: "É isso" destrava e limpa a pendência')
ok(passou(ferram('Edit', {})), 'pedido: depois de destravar, segue livre')
r = pedido(LONGO)
ok(fs.existsSync(pend), 'pedido: nova mensagem grande reabre')
r = pedido('commit')
ok(r.out.includes('AskUserQuestion') && fs.existsSync(pend), 'pedido: ordem curta também dispara (CC-1070, peça 0)')
r = pedido('valeu')
ok(r.codigo === 0 && !r.out && !fs.existsSync(pend), 'pedido: agradecimento limpa a pendência e não dispara')
r = pedido('Qual é o estado do robô de plantão agora, e o que ele fez hoje?')
ok(!r.out && !fs.existsSync(pend), 'pedido: pergunta não dispara')
r = pedido('liga o robô de plantão para rodar toda noite')
ok(r.out.includes('AskUserQuestion') && fs.existsSync(pend), 'pedido: fala de robô e ligar dispara mesmo curta')
fs.rmSync(path.join(cfgDir, 'teto-robo.json'))
r = pedido(LONGO, SDK, 'robo-1')
ok(!r.out.includes('additionalContext') && !fs.existsSync(pend.replace(SESSAO, 'robo-1')),'pedido: claude -p (sdk-cli) nunca dispara')
r = pedido(LONGO)
ok(passou(rodar('modelo-guard.mjs', { tool_name: 'Edit', tool_input: {}, cwd: TRABALHO, session_id: 'outra', transcript_path: transcrito([fala('x')]) })), 'pedido: pendência é por sessão')
escreverConfig({ ...Object.fromEntries(IDS.map((i) => [i, true])), 'confere-pedido': false })
ok(passou(ferram('Edit', {})), 'pedido: interruptor desligado cala')
escreverConfig(Object.fromEntries(IDS.map((i) => [i, true])))

fs.rmSync(CASA, { recursive: true, force: true })
if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nCC-1069: todas as travas conferidas')
