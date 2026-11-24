/**
 * CC-1131: sessões do Codex no cockpit (ver e responder). Sem rede, sem o Codex de verdade, sem a casa real:
 * sessões falsas numa pasta temporária (CC_CODEX_HOME) e um `codex` de mentira (CC_CODEX_BIN).
 *
 *   node test-codex.mjs
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-codex-'))
const casaCodex = path.join(raiz, '.codex')
process.env.CC_HOME = path.join(raiz, '.claude')
process.env.CC_CODEX_HOME = casaCodex
const SAIDA = path.join(raiz, 'recebido.json')
const FALSO = path.join(raiz, 'codex-falso.mjs')
fs.writeFileSync(FALSO, `import fs from 'node:fs'
const args = process.argv.slice(2)
if (args.some((a) => a.includes('DEMORA'))) await new Promise((r) => setTimeout(r, 3000))
if (args.some((a) => a.includes('RECUSA'))) { console.error('Error: thread not found'); process.exit(1) }
fs.writeFileSync(${JSON.stringify(SAIDA)}, JSON.stringify(args))
console.log('Queued message for thread')
`)
process.env.CC_CODEX_BIN = FALSO

const C = await import('./src/codex.mjs')
const { entregarMensagemRemota, montarPacote } = await import('./src/federacao.mjs')
const { montar } = await import('./src/cockpit2.mjs')

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

const AGORA = Date.now()
const hoje = new Date(AGORA)
const dia = path.join(casaCodex, 'sessions', String(hoje.getUTCFullYear()), String(hoje.getUTCMonth() + 1).padStart(2, '0'), String(hoje.getUTCDate()).padStart(2, '0'))
fs.mkdirSync(dia, { recursive: true })
fs.mkdirSync(path.join(casaCodex, 'thread-writer-locks'), { recursive: true })
fs.writeFileSync(path.join(casaCodex, 'auth.json'), '{}') // de mentira: só a existência conta

const ts = (ms) => new Date(ms).toISOString()
const linha = (type, payload, ms = AGORA - 5000) => JSON.stringify({ timestamp: ts(ms), type, payload })
const msg = (role, texto, ms) => linha('response_item', { type: 'message', role, content: [{ type: role === 'assistant' ? 'output_text' : 'input_text', text: texto }] }, ms)
const ev = (type, extra = {}, ms) => linha('event_msg', { type, ...extra }, ms)

function sessao(id, { cwd = path.join(raiz, 'projetoteste'), source = 'vscode', linhas = [], idadeMs = 5000 } = {}) {
  const f = path.join(dia, `rollout-2026-11-23T17-43-56-${id}.jsonl`)
  const meta = linha('session_meta', { id, cwd, originator: 'codex-tui', source, timestamp: ts(AGORA - 60_000), base_instructions: { text: 'x'.repeat(40_000) } }, AGORA - 60_000)
  fs.writeFileSync(f, [meta, ...linhas].join('\n') + '\n')
  const t = (AGORA - idadeMs) / 1000
  fs.utimesSync(f, t, t)
  return f
}

const A = '01a20a26-ad86-7b11-8f12-85418bece25a'
const B = '01a20a26-0000-7000-8000-000000000002' // mesmos 8 primeiros caracteres de A
sessao(A, {
  linhas: [
    ev('task_started', {}, AGORA - 9000),
    msg('developer', 'You are Codex, instrução do sistema que nunca é fala dele', AGORA - 8900),
    msg('user', '<environment_context><cwd>x</cwd></environment_context>', AGORA - 8800),
    msg('user', 'arruma o botão de salvar', AGORA - 8700),
    msg('assistant', 'Pronto, o botão salva agora. Conferi no navegador.', AGORA - 7000),
    linha('turn_context', { model: 'gpt-6.2-sol' }, AGORA - 6900),
    ev('token_count', { info: { total_token_usage: { total_tokens: 4321 } }, rate_limits: { primary: { used_percent: 12 }, secondary: { used_percent: 3 }, plan_type: 'plus' } }, AGORA - 6800),
    ev('task_complete', { last_agent_message: 'Pronto, o botão salva agora. Conferi no navegador.' }, AGORA - 6700),
    msg('developer', 'This is an incremental tools update, também do sistema', AGORA - 6600),
  ],
})
sessao(B, { source: 'exec', linhas: [ev('task_started', {}, AGORA - 3000), msg('user', 'segunda sessão no mesmo minuto', AGORA - 2900)], idadeMs: 2000 })
fs.writeFileSync(path.join(casaCodex, 'session_index.jsonl'), JSON.stringify({ id: A, thread_name: 'Botão de salvar', updated_at: ts(AGORA) }) + '\n')
fs.writeFileSync(path.join(casaCodex, 'thread-writer-locks', `${A}.lock`), '')

// ------------------------------------------------------------- leitura
const lidas = C.readCodex(AGORA)
const a = lidas.find((j) => j.id === A)
const b = lidas.find((j) => j.id === B)
assert.ok(a && b, 'as duas sessões aparecem')
assert.equal(a.ferramenta, 'codex'); assert.equal(a.tipo, 'codex')
assert.equal(a.project, 'projetoteste')
assert.equal(a.origemCodex, 'vscode'); assert.equal(b.origemCodex, 'exec')
assert.equal(a.subject, 'Botão de salvar', 'o nome vem do session_index')
assert.equal(a.lastPrompt, 'arruma o botão de salvar')
assert.equal(a.ultima.texto, 'Pronto, o botão salva agora. Conferi no navegador.')
assert.deepEqual(a.usoCodex, { cincoHoras: 12, semana: 3, plano: 'plus' })
assert.equal(a.model, 'gpt-6.2-sol'); assert.equal(a.tokens, 4321)
assert.equal(a.aberta, true, 'a trava de escrita marca aberta')
assert.equal(b.aberta, undefined, 'sem trava não se sabe: nunca "fechada"')
assert.equal(a.codexResponde, true)
assert.equal(b.subject, 'segunda sessão no mesmo minuto', 'sem nome, o assunto é o último pedido')
ok('lê pasta, projeto, origem, nome, último pedido, última resposta, uso do plano e modelo')

// ------------------------------------------------------------- filtro do papel developer
assert.ok(!JSON.stringify(a).includes('instrução do sistema'), 'fala developer não entra em lugar nenhum')
assert.ok(!JSON.stringify(a).includes('incremental tools'), 'nem a developer que vem depois da resposta')
assert.ok(!String(a.lastPrompt).startsWith('<'), '<environment_context> é do programa, não dele')
const soDev = C.lerLinhasCodex([msg('user', 'pedido de verdade'), msg('developer', 'regras do sistema')])
assert.equal(soDev.pedido, 'pedido de verdade')
ok('fala com papel developer fica de fora do resumo')

// ------------------------------------------------------------- chave pelo id inteiro
assert.notEqual(a.id, b.id); assert.equal(a.id.slice(0, 8), b.id.slice(0, 8))
assert.equal(C.arquivoCodex(A.slice(0, 8)), null, 'prefixo de 8 letras não acha sessão do Codex')
assert.ok(C.arquivoCodex(A).endsWith(`${A}.jsonl`)); assert.ok(C.arquivoCodex(B).endsWith(`${B}.jsonl`))
assert.equal(C.arquivoCodex('../../etc/passwd'), null)
ok('duas sessões no mesmo minuto continuam duas, e só o id inteiro acha a sessão')

// ------------------------------------------------------------- estado pela idade e pela vez
assert.equal(C.estadoCodex({ inicioVez: 2, fimVez: 1 }, 30_000), 'working', 'vez aberta recente trabalha')
assert.equal(C.estadoCodex({ inicioVez: 2, fimVez: 1 }, 11 * 60_000), 'idle', 'vez aberta e parada há 11 min caiu')
assert.equal(C.estadoCodex({ inicioVez: 1, fimVez: 2 }, 5_000), 'waiting', 'vez fechada há pouco espera ele')
assert.equal(C.estadoCodex({ inicioVez: 1, fimVez: 2 }, 31 * 60_000), 'idle', 'vez fechada há meia hora está ociosa')
assert.equal(a.status, 'waiting'); assert.equal(b.status, 'working')
ok('estado sai da vez (task_started/task_complete) e da idade do arquivo')

// ------------------------------------------------------------- responder
const r1 = await C.responderCodex(A, 'responda "x" & calc %PATH%\nfim')
assert.equal(r1.ok, true, JSON.stringify(r1)); assert.equal(r1.entregue, 'codex')
assert.deepEqual(JSON.parse(fs.readFileSync(SAIDA, 'utf8')), ['queue', `--thread=${A}`, '--message=responda "x" & calc %PATH% fim', '--resume'],
  'texto chega inteiro como UM argumento, sem shell no meio')
ok('mensagem entregue pelo codex queue --resume, texto limpo e sem shell')

const r2 = await C.responderCodex(A, 'oi', { bin: null })
assert.equal(r2.ok, false); assert.match(r2.erro, /não está instalado/); assert.match(r2.erro, /guardado/)
const pend = path.join(raiz, '.local', 'share', 'agent-cockpit', 'codex-pendentes.jsonl')
assert.ok(fs.readFileSync(pend, 'utf8').includes('"texto":"oi"'), 'o pedido fica guardado')
const r3 = await C.responderCodex(A, 'DEMORA', { timeoutMs: 400 })
assert.equal(r3.ok, false); assert.match(r3.erro, /não respondeu em/)
const r4 = await C.responderCodex(A, 'RECUSA')
assert.equal(r4.ok, false); assert.match(r4.erro, /thread not found/)
assert.equal((await C.responderCodex('01a20a26', 'oi')).ok, false, 'id curto é recusado')
ok('sem codex, sem resposta a tempo ou recusado: erro em palavras comuns e pedido guardado')

// ------------------------------------------------------------- pela federação (o PC recebendo da VPS)
fs.rmSync(SAIDA, { force: true })
const semTerminal = () => ({})
const r5 = await entregarMensagemRemota({ conversa: A, texto: 'veio da VPS' }, { sessoes: semTerminal, enviar: () => assert.fail('não digita em terminal'), apertarTecla: () => assert.fail(), ouvido: { ouvidoVivo: () => null } })
assert.equal(r5.ok, true, JSON.stringify(r5)); assert.ok(JSON.parse(fs.readFileSync(SAIDA, 'utf8')).includes('--message=veio da VPS'))
const r6 = await entregarMensagemRemota({ conversa: '11111111-2222-3333-4444-555555555555', texto: 'x' }, { sessoes: semTerminal, enviar: () => assert.fail(), apertarTecla: () => assert.fail(), ouvido: { ouvidoVivo: () => null } })
assert.equal(r6.ok, false, 'conversa que não é do Codex daqui segue recusada como antes')
const r7 = await entregarMensagemRemota({ conversa: A, tecla: 'parar' }, { sessoes: semTerminal, enviar: () => assert.fail(), apertarTecla: () => assert.fail(), ouvido: { ouvidoVivo: () => null } })
assert.equal(r7.ok, false, 'tecla não vai para o Codex')
ok('mensagem vinda da outra máquina entra no Codex pelo mesmo caminho')

// ------------------------------------------------------------- pacote e tela
const pac = montarPacote({ maquina: { id: 'pc', nome: 'PC' }, jobs: [{ ...a, ultimaFala: { tipo: 'fala', texto: 'Pronto', conversa: A } }, { id: 'claude01', status: 'waiting', project: 'x' }] })
assert.equal(pac.jobs[0].ferramenta, 'codex'); assert.equal(pac.jobs[0].codexResponde, true); assert.equal(pac.jobs[0].id, A)
assert.ok(!('ferramenta' in pac.jobs[1]), 'sessão do Claude não ganha o campo')
ok('o pacote leva ferramenta e codexResponde só na sessão do Codex')

const local = montar({ jobs: [a], local: { id: 'pc', nome: 'PC' }, agora: AGORA })
const sa = local.conectadas.find((s) => s.id === A)
assert.ok(sa, 'a sessão do Codex entra nas sessões')
assert.equal(sa.tipo, 'codex'); assert.equal(sa.codex, true); assert.equal(sa.conversa, A); assert.equal(sa.escreve, true)
assert.match(sa.fala, /Pronto, o botão salva agora/)
const ea = local.espera.find((e) => e.id === A)
assert.ok(ea && ea.codex === true && ea.sessao === 'codex' && ea.conversa === A && ea.escreve === true, 'o cartão de decisão também diz Codex e aceita texto')
const semCred = montar({ jobs: [{ ...a, codexResponde: false }], local: { id: 'pc', nome: 'PC' }, agora: AGORA }).conectadas.find((s) => s.id === A)
assert.equal(semCred.escreve, false, 'sem programa ou credencial, sem campo de mensagem')

const daVps = (j) => ({ ...j, origem: { id: 'pc', nome: 'PC' } })
const fora = montar({ jobs: [daVps(pac.jobs[0])], local: { id: 'vps', nome: 'VPS' }, agora: AGORA, falaDe: (j) => j.ultimaFala || null }).conectadas.find((s) => s.id === A)
assert.equal(fora.tipo, 'codex'); assert.equal(fora.escreve, true); assert.equal(fora.conversa, A); assert.equal(fora.dispositivo, 'PC')
const velho = { ...pac.jobs[0] }; delete velho.ferramenta; delete velho.codexResponde
const doVelho = montar({ jobs: [daVps({ ...velho, ultimaFala: null })], local: { id: 'vps', nome: 'VPS' }, agora: AGORA }).conectadas.find((s) => s.id === A)
assert.notEqual(doVelho.tipo, 'codex'); assert.equal(doVelho.escreve, false, 'pacote velho sem o campo: cadeado, como antes')
ok('a tela marca Codex, mostra a fala, e só oferece escrever onde o Codex responde (PC e VPS)')

/* CC-1131, achado em 23/11 nos dois painéis reais: o que uma máquina manda à outra sai do `snapshot` de src/web.mjs, e
   ele não juntava o Codex (só a tela juntava). Resultado: o PC e a VPS nunca viam o Codex um do outro, e este teste
   passava porque olha o pacote já montado. Guarda a fonte: se o snapshot largar o Codex, o teste recusa. */
const fonteWeb = fs.readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
assert.match(fonteWeb, /import \{ readCodex as readCodexDaqui \} from '\.\/codex\.mjs'/, 'web.mjs importa o leitor do Codex')
assert.match(fonteWeb, /const jobs = \[\.\.\.doBackground, \.\.\.interativas, \.\.\.doCodex\]/, 'o snapshot (o que a máquina manda à outra) leva o Codex')
ok('o que a máquina manda à outra leva as sessões do Codex (fonte guardada)')

fs.rmSync(raiz, { recursive: true, force: true })
console.log(`\n${n} blocos ok`)
