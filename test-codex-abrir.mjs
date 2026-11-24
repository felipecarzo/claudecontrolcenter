/**
 * CC-1131, entrega 4: abrir sessão do Codex em projeto (VPS e PC) e responder nela. Sem rede, sem o Codex de verdade,
 * sem tmux de verdade e sem a casa real: um `tmux` e um WezTerm de mentira entram por parâmetro, e as telas do Codex
 * são as que foram lidas de verdade na VPS em 23/11/2026 (codex-cli 0.171.0).
 *
 *   node test-codex-abrir.mjs
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-codex-abrir-'))
process.env.CC_HOME = path.join(raiz, '.claude')
const casaCodex = path.join(raiz, '.codex')
process.env.CC_CODEX_HOME = casaCodex
const SAIDA = path.join(raiz, 'recebido.json')
const FALSO = path.join(raiz, 'codex-falso.mjs') // o `codex queue` de mentira: grava os argumentos que recebeu
fs.writeFileSync(FALSO, `import fs from 'node:fs'\nfs.writeFileSync(${JSON.stringify(SAIDA)}, JSON.stringify(process.argv.slice(2)))\nconsole.log('Queued message for thread')\n`)
process.env.CC_CODEX_BIN = FALSO
const { dirCaixas } = await import('./src/ouvido.mjs')
const apagarRegistro = () => fs.rmSync(path.join(path.dirname(dirCaixas()), 'codex-terminais.json'), { force: true })
fs.mkdirSync(path.join(casaCodex, 'thread-writer-locks'), { recursive: true })
fs.writeFileSync(path.join(casaCodex, 'auth.json'), '{}') // de mentira: só a existência conta
const projeto = path.join(raiz, 'projetos', 'meu-site')
fs.mkdirSync(projeto, { recursive: true })

const K = await import('./src/codexAbrir.mjs')
const C = await import('./src/codex.mjs')
const { montarPacote, validarPacote, mesclar } = await import('./src/federacao.mjs')
const { montar } = await import('./src/cockpit2.mjs')

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

/* As telas reais do Codex 0.171.0, lidas na VPS em 23/11. */
const NORMAL = '  >_ OpenAI Codex (v0.171.0)\n     ~/projetos/meu-site\n\n  To get started, describe a task or try one of these commands:\n\n› Ask Codex to do anything\n\n  GPT-6.2-Sol default · ~/projetos/meu-site\n  ← for agents · ? for shortcuts\n'
const CONFIANCA = '  Folder access\n  /home/claudedev/projetos/meu-site\n  model request. Continue only if you trust these files. Your trust decision will be saved.\n› 1. Trust and continue\n  2. Back to Agent Command Center\n  enter continue · esc back\n'
const CONFIANCA_NA_2 = CONFIANCA.replace('› 1.', '  1.').replace('  2. Back', '› 2. Back')
const ATUALIZACAO = '  Update available · 0.171.0 → 0.172.0\n  Release notes: https://github.com/openai/codex/releases/latest\n› 1. Update now (runs `npm install -g @openai/codex`)\n  2. Skip\n  3. Skip until next version\n  enter continue · esc skip\n'
const APROVACAO = '  Would you like to run the following command?\n  $ rm -rf build\n› 1. Yes, proceed (y)\n  2. No, and tell Codex what to do differently (esc)\n  Press enter to confirm or esc to cancel\n'

// ------------------------------------------------------------- o comando
const args = K.argsCodex(projeto)
assert.deepEqual(args.slice(0, 2), ['-c', 'check_for_update_on_startup=false'])
assert.equal(args[3], `projects={'${projeto}'={trust_level="trusted"}}`, 'a pasta entra como tabela inteira, que é a forma que pula a pergunta')
assert.deepEqual(args.slice(4), ['-s', 'workspace-write', '-a', 'on-request'])
assert.ok(!args.join(' ').includes('danger') && !args.join(' ').includes('bypass'), 'nunca o modo sem proteção')
assert.deepEqual(K.argsCodex(projeto, { sandbox: 'read-only' }).slice(4), ['-s', 'read-only', '-a', 'on-request'])
process.env.CC_CODEX_SANDBOX = 'danger-full-access'
assert.equal(K.sandboxCodex(), 'workspace-write', 'sandbox desconhecido cai no padrão')
delete process.env.CC_CODEX_SANDBOX
assert.throws(() => K.argsCodex("/home/x/it's"), /aspas simples/)
assert.equal(K.argsCodex('D:\\Documentos\\projetos\\meu-site')[3], "projects={'D:\\Documentos\\projetos\\meu-site'={trust_level=\"trusted\"}}", 'barra do Windows entra literal')
assert.deepEqual(K.comandoCodex('/usr/bin/codex', projeto).slice(0, 1), ['/usr/bin/codex'])
assert.equal(K.comandoCodex('/x/codex.js', projeto)[0], process.execPath, 'o .js do npm roda pelo Node do painel')
assert.equal(K.nomeCodex('meu site'), 'cc-codex-meu-site'); assert.equal(K.nomeCodex('meu-site', 2), 'cc-codex-meu-site-2')
ok('comando montado: pasta confiável, sandbox só na pasta do projeto, aprovação sob pedido, nome do tmux cc-codex-')

// ------------------------------------------------------------- as telas
assert.equal(K.perguntaDaTela(CONFIANCA), 'confianca'); assert.equal(K.perguntaDaTela(ATUALIZACAO), 'atualizacao'); assert.equal(K.perguntaDaTela(NORMAL), null)
assert.equal(K.passoDaConfiancaCodex(CONFIANCA), 'confirmar'); assert.equal(K.passoDaConfiancaCodex(CONFIANCA_NA_2), 'descer')
assert.equal(K.passoDaConfiancaCodex('Folder access\n› 1. Outra coisa'), 'sem-opcao')
assert.equal(K.prontaParaTexto(NORMAL), true)
for (const t of [CONFIANCA, ATUALIZACAO, APROVACAO, '']) assert.equal(K.prontaParaTexto(t), false, 'tela de pergunta não recebe texto')
ok('as telas reais do Codex: confiança, atualização e aprovação são perguntas; o campo normal recebe texto')

// ------------------------------------------------------------- o tmux de mentira
let seqId = 1 // cada sessão nova do Codex de mentira ganha um id novo, e a trava dele fica no disco
function criarTmux({ telaInicial = NORMAL } = {}) {
  const T = { sessoes: new Map(), chamadas: [], digitado: [], teclas: [] }
  const idNovo = () => `01a20b${String(seqId++).padStart(2, '0')}-0000-7000-8000-00000000000a`
  T.tmux = async (a) => {
    T.chamadas.push(a)
    const nome = a.includes('-t') ? a[a.indexOf('-t') + 1] : a.includes('-s') ? a[a.indexOf('-s') + 1] : null
    const s = T.sessoes.get(nome)
    switch (a[0]) {
      case 'list-sessions': return { ok: true, out: [...T.sessoes.keys()].join('\n') }
      case 'new-session': {
        const novo = { cwd: a[a.indexOf('-c') + 1], tela: telaInicial, comando: a.slice(a.indexOf('-y') + 2) }
        T.sessoes.set(nome, novo)
        if (!T.semTrava) { const id = idNovo(); novo.id = id; fs.writeFileSync(path.join(casaCodex, 'thread-writer-locks', `${id}.lock`), '') }
        return { ok: true, out: '' }
      }
      case 'has-session': return { ok: Boolean(s), out: '' }
      case 'kill-session': T.sessoes.delete(nome); return { ok: true, out: '' }
      case 'capture-pane': return s ? { ok: true, out: s.tela } : { ok: false, out: "can't find session" }
      case 'send-keys': {
        if (!s) return { ok: false, out: "can't find session" }
        if (a.includes('-l')) { T.digitado.push([nome, a[a.length - 1]]); return { ok: true, out: '' } }
        const tecla = a[a.length - 1]
        T.teclas.push([nome, tecla])
        if (tecla === 'Down' && s.tela === CONFIANCA_NA_2) s.tela = CONFIANCA
        else if (tecla === 'Enter' && s.tela === CONFIANCA) s.tela = NORMAL
        return { ok: true, out: '' }
      }
      default: return { ok: false, out: 'comando desconhecido' }
    }
  }
  return T
}
const sem = async () => {}

// ------------------------------------------------------------- abrir
let T = criarTmux()
const r1 = await K.abrirCodex('meu-site', projeto, { esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(r1.ok, true, JSON.stringify(r1)); assert.equal(r1.ja, false); assert.equal(r1.sessao, 'cc-codex-meu-site'); assert.equal(r1.ferramenta, 'codex')
const nova = T.chamadas.find((c) => c[0] === 'new-session')
assert.equal(nova[nova.indexOf('-s') + 1], 'cc-codex-meu-site'); assert.equal(nova[nova.indexOf('-c') + 1], projeto)
assert.deepEqual(nova.slice(nova.indexOf('-y') + 2), [process.execPath, FALSO, ...K.argsCodex(projeto)], 'o comando vai em lista, sem shell')
assert.equal(r1.conversa, T.sessoes.get('cc-codex-meu-site').id, 'o id da sessão é a trava nova que o Codex criou')
assert.ok(K.lerTerminaisCodex()['cc-codex-meu-site'].id, 'o terminal fica registrado com o id')
assert.equal(T.teclas.length, 0, 'tela normal: nenhuma tecla apertada')
ok('abrir: tmux cc-codex-<projeto> na pasta, comando em lista, id da sessão achado pela trava, nenhuma tecla às cegas')

const r2 = await K.abrirCodex('meu-site', projeto, { esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(r2.ok, true); assert.equal(r2.ja, true); assert.equal(T.chamadas.filter((c) => c[0] === 'new-session').length, 1, 'segundo clique não abre outra')
const r3 = await K.abrirCodex('meu-site', projeto, { mais: true, esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(r3.sessao, 'cc-codex-meu-site-2'); assert.notEqual(r3.conversa, r1.conversa)
ok('"mais uma" abre cc-codex-<projeto>-2 com outro id; sem ele, o segundo clique devolve a que já existe')

// confiança: cursor já no Yes, e cursor noutra opção
T = criarTmux({ telaInicial: CONFIANCA })
let r = await K.abrirCodex('a', projeto, { esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(T.teclas.map((t) => t[1]), ['Enter'])
T = criarTmux({ telaInicial: CONFIANCA_NA_2 })
r = await K.abrirCodex('a', projeto, { esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(T.teclas.map((t) => t[1]), ['Down', 'Enter'], 'desce até a opção certa antes de confirmar')
ok('pergunta de confiança: escolhe "Trust and continue" pelo texto, com o cursor conferido')

// atualização: nunca Enter, sessão fechada, motivo dito
T = criarTmux({ telaInicial: ATUALIZACAO })
r = await K.abrirCodex('b', projeto, { esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(r.ok, false); assert.match(r.erro, /atualização/); assert.equal(T.teclas.length, 0, 'nenhuma tecla na tela que roda npm install'); assert.equal(T.sessoes.size, 0, 'a sessão foi fechada')
// confiança sem a opção na tela
const CURSOR_PRESO = 'Folder access\n  Trust and continue\n  Back to Agent Command Center' // o cursor nunca chega no "Trust and continue"
T = criarTmux({ telaInicial: CURSOR_PRESO })
r = await K.abrirCodex('b', projeto, { esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(r.ok, false); assert.match(r.erro, /confiança/); assert.ok(T.teclas.every((t) => t[1] === 'Down'), 'só desce, nunca confirma')
ok('tela que o painel não sabe responder fecha a sessão, aperta nada e diz o motivo')

// a tela de revisão de ganchos, lida no PC dele (a decisão de confiar nos ganchos é dele, não do painel)
const GANCHOS = "  Hooks need review\n  2 hooks are new or changed.\n  Hooks can run outside the sandbox after you trust them.\n› 1. Review hooks\n  2. Trust all and continue\n  3. Continue without trusting (hooks won't run)\n  enter confirm · esc skip\n"
assert.equal(K.perguntaDaTela(GANCHOS), null, '"Trust all and continue" não é a pergunta da pasta')
assert.equal(K.prontaParaTexto(GANCHOS), false)
T = criarTmux({ telaInicial: GANCHOS })
r = await K.abrirCodex('g', projeto, { esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(r.ok, true); assert.match(r.aviso, /esperando uma resposta no terminal dele/); assert.equal(T.teclas.length, 0, 'nenhuma tecla'); assert.equal(T.sessoes.size, 1, 'a sessão fica aberta')
ok('pergunta própria do Codex que o painel não conhece: sessão aberta, nenhuma tecla, aviso dizendo onde responder')

// recusas em palavras comuns
const sempre = { esperarMs: 0, deps: { tmux: criarTmux().tmux, espera: sem, windows: false } }
r = await K.abrirCodex('c', projeto, { ...sempre, bin: null })
assert.equal(r.ok, false); assert.match(r.erro, /não está instalado nesta máquina/); assert.match(r.erro, /npm install -g @openai\/codex/)
fs.renameSync(path.join(casaCodex, 'auth.json'), path.join(casaCodex, 'auth.guardado'))
r = await K.abrirCodex('c', projeto, sempre)
assert.equal(r.ok, false); assert.match(r.erro, /não está logado/); assert.match(r.erro, /codex login/)
fs.renameSync(path.join(casaCodex, 'auth.guardado'), path.join(casaCodex, 'auth.json'))
r = await K.abrirCodex('c', path.join(raiz, 'nao-existe'), sempre)
assert.equal(r.ok, false); assert.match(r.erro, /pasta não existe/)
const fechou = criarTmux(); const tmuxMorre = async (a) => (a[0] === 'has-session' ? { ok: false, out: '' } : fechou.tmux(a))
r = await K.abrirCodex('d', projeto, { esperarMs: 0, deps: { tmux: tmuxMorre, espera: sem, windows: false } })
assert.equal(r.ok, false); assert.match(r.erro, /fechou logo ao abrir/)
ok('sem Codex instalado, sem login, pasta que não existe e sessão que morre na abertura: erro em palavras comuns')

// ------------------------------------------------------------- responder
T = criarTmux()
const ab = await K.abrirCodex('resp', projeto, { esperarMs: 0, deps: { tmux: T.tmux, espera: sem, windows: false } })
const ID = ab.conversa
const sessaoDoCodex = (id, cwd, casa = casaCodex) => {
  const dia = path.join(casa, 'sessions', '2026', '11', '23'); fs.mkdirSync(dia, { recursive: true })
  const agora = Date.now(); const ts = (ms) => new Date(ms).toISOString()
  const meta = JSON.stringify({ timestamp: ts(agora - 60_000), type: 'session_meta', payload: { id, cwd, originator: 'codex-tui', source: 'cli', timestamp: ts(agora - 60_000) } })
  const f = path.join(dia, `rollout-2026-11-23T21-15-48-${id}.jsonl`)
  fs.writeFileSync(f, meta + '\n' + JSON.stringify({ timestamp: ts(agora - 2000), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Posso seguir?' }] } }) + '\n')
  return f
}
sessaoDoCodex(ID, projeto)
let resp = await C.responderCodex(ID, 'responda apenas VPS-OK', { depsTerminal: { tmux: T.tmux, espera: sem, windows: false }, bin: null })
assert.equal(resp.ok, true, JSON.stringify(resp)); assert.equal(resp.entregue, 'terminal')
assert.deepEqual(T.digitado, [['cc-codex-resp', 'responda apenas VPS-OK']], 'o texto chega literal, na sessão certa')
assert.deepEqual(T.teclas.slice(-1), [['cc-codex-resp', 'Enter']], 'e o Enter vai separado, depois')
ok('resposta entregue: texto literal digitado no tmux da sessão, Enter depois, sem precisar do programa nem do `codex queue`')

// texto com cara de comando ou de tecla não vira nem uma nem outra
T.digitado.length = 0
resp = await C.responderCodex(ID, 'Enter; rm -rf $HOME `x` "y"', { depsTerminal: { tmux: T.tmux, espera: sem, windows: false }, bin: null })
assert.equal(resp.ok, true); assert.deepEqual(T.digitado[0][1], 'Enter; rm -rf $HOME `x` "y"')
ok('texto livre vai como texto, sem interpretar nome de tecla nem passar por shell')

// pergunta de aprovação aberta: nada digitado
T.digitado.length = 0; const antes = T.teclas.length
T.sessoes.get('cc-codex-resp').tela = APROVACAO
resp = await C.responderCodex(ID, 'sim', { depsTerminal: { tmux: T.tmux, espera: sem, windows: false }, bin: null })
assert.equal(resp.ok, false); assert.match(resp.erro, /numa pergunta no terminal dela/); assert.equal(T.digitado.length, 0); assert.equal(T.teclas.length, antes, 'nem Enter')
ok('com a aprovação aberta no terminal, o painel não digita nada (o Enter ali aprovaria) e diz onde responder')

// sessão que não mora em terminal do painel: cai no codex queue (o `codex` de mentira grava os argumentos)
const OUTRO = '01a20c99-0000-7000-8000-0000000000ff'
sessaoDoCodex(OUTRO, path.join(raiz, 'outra-pasta'))
resp = await C.responderCodex(OUTRO, 'pela fila', { depsTerminal: { tmux: T.tmux, espera: sem, windows: false } })
assert.equal(resp.ok, true, JSON.stringify(resp)); assert.equal(resp.entregue, 'codex'); assert.ok(JSON.parse(fs.readFileSync(SAIDA, 'utf8')).includes('--message=pela fila'))
ok('sessão que não mora em terminal do painel segue pelo `codex queue --resume`, como antes')

// registro perdido: uma única sessão cc-codex na pasta, sem id, ainda recebe; duas, não adivinha
apagarRegistro()
const T2 = criarTmux(); T2.sessoes.set('cc-codex-resp', { cwd: projeto, tela: NORMAL })
const dep2 = { tmux: T2.tmux, espera: sem, windows: false }
assert.equal((await K.responderNoTerminal(ID, 'x', { cwd: projeto, deps: dep2 }))?.ok, true, 'uma só na pasta: entrega')
T2.sessoes.set('cc-codex-resp-2', { cwd: projeto, tela: NORMAL })
assert.equal(await K.responderNoTerminal(ID, 'x', { cwd: projeto, deps: dep2 }), null, 'duas na mesma pasta e sem id: não adivinha, cai na fila')
ok('registro perdido: com uma sessão na pasta ainda responde; com duas, não adivinha qual')

// ------------------------------------------------------------- o PC (WezTerm de mentira)
const W = { painel: '7', escrito: [], teclas: [], aberto: null, fechado: null, tela: NORMAL }
const wez = {
  abrir: async (o) => { W.aberto = o; return { ok: true, painel: W.painel } },
  listar: async () => [{ painel: W.painel, titulo: '', cwd: '' }],
  ler: async () => W.tela, escrever: async (p, t) => { W.escrito.push([p, t]) }, apertar: async (p, t) => { W.teclas.push([p, t]) }, fechar: async (p) => { W.fechado = p },
}
apagarRegistro()
const depW = { wez, espera: sem, windows: true }
assert.deepEqual(await K.terminaisVivosCodex(depW), {}, 'sem nada aberto por aqui, nem pergunta ao WezTerm')
const rw = await K.abrirCodex('pc-proj', projeto, { esperarMs: 0, deps: depW })
assert.equal(rw.ok, true, JSON.stringify(rw)); assert.equal(W.aberto.cwd, projeto); assert.deepEqual(W.aberto.comando, [process.execPath, FALSO, ...K.argsCodex(projeto)])
assert.equal(K.lerTerminaisCodex()['cc-codex-pc-proj'].painel, '7')
const rr = await K.responderNoTerminal(rw.conversa || 'x', 'oi pelo PC', { cwd: projeto, deps: depW })
assert.equal(rr?.ok, true, JSON.stringify(rr)); assert.deepEqual(W.escrito, [['7', 'oi pelo PC']]); assert.deepEqual(W.teclas, [['7', 'Enter']])
const fc = await K.fecharCodex('cc-codex-pc-proj', { deps: depW })
assert.equal(fc.ok, true); assert.equal(W.fechado, '7'); assert.deepEqual(K.lerTerminaisCodex(), {})
assert.equal((await K.fecharCodex('cc-remote-meu-projeto', { deps: depW })).ok, false, 'só fecha o que é do Codex')
ok('no PC: abre no WezTerm na pasta, digita na tela certa, fecha e tira do registro')

// ------------------------------------------------------------- achar o programa na VPS
const casaVps = path.join(raiz, 'vps-home')
const bins = path.join(casaVps, '.npm-global', 'bin'); fs.mkdirSync(bins, { recursive: true })
const js = path.join(casaVps, '.npm-global', 'lib', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'); fs.mkdirSync(path.dirname(js), { recursive: true }); fs.writeFileSync(js, '')
let atalho = path.join(bins, 'codex')
try { fs.symlinkSync(path.relative(bins, js), atalho) } catch { fs.writeFileSync(atalho, ''); atalho = null }
const velhoBin = process.env.CC_CODEX_BIN; delete process.env.CC_CODEX_BIN
const velhoPath = process.env.PATH; const velhaCasa = process.env.HOME; const velhaCasaW = process.env.USERPROFILE
process.env.PATH = '/usr/sbin:/usr/bin'; process.env.HOME = casaVps; process.env.USERPROFILE = casaVps
const achado = C.binarioCodex(Date.now() + 10 * 60_000, 'linux')
assert.ok(achado, 'o PATH de serviço não tem ~/.npm-global/bin e mesmo assim o programa é achado')
if (atalho) assert.equal(fs.realpathSync(achado), fs.realpathSync(js), 'o atalho do npm vira o codex.js, que roda pelo Node do painel')
process.env.PATH = velhoPath; process.env.HOME = velhaCasa; process.env.USERPROFILE = velhaCasaW; process.env.CC_CODEX_BIN = velhoBin
ok('VPS: o `codex` instalado em ~/.npm-global/bin é achado mesmo com o PATH de serviço, e o atalho vira o codex.js')

// ------------------------------------------------------------- as duas máquinas se veem, nos dois sentidos
const AGORA = Date.now()
const homeDe = (nome) => { const h = path.join(raiz, nome); fs.mkdirSync(path.join(h, 'thread-writer-locks'), { recursive: true }); fs.writeFileSync(path.join(h, 'auth.json'), '{}'); return h }
const lerComo = (home, id, cwd) => { process.env.CC_CODEX_HOME = home; sessaoDoCodex(id, cwd, home); return { jobs: C.readCodex(AGORA) } }
const homeVps = homeDe('home-vps'); const homePc = homeDe('home-pc')
const ID_VPS = '01a20d11-aaaa-7000-8000-00000000000b'; const ID_PC = '01a20d22-bbbb-7000-8000-00000000000c'
const daVps = lerComo(homeVps, ID_VPS, '/home/claudedev/projetos/meu-site').jobs
const doPc = lerComo(homePc, ID_PC, 'D:\\projetos\\meu-site').jobs
const atravessa = (maquina, jobs) => validarPacote(JSON.parse(JSON.stringify(montarPacote({ maquina, jobs })))).pacote
const VPS = { id: 'vps', nome: 'VPS' }; const PC = { id: 'pc', nome: 'PC' }
// VPS -> PC
let mesc = mesclar([], [{ ...atravessa(VPS, daVps), idadeMs: 1000, semContato: false }], PC)
let tela = montar({ jobs: mesc, local: PC, agora: AGORA, falaDe: (j) => j.ultimaFala || null }).conectadas.find((s) => s.id === ID_VPS)
assert.ok(tela, 'a sessão do Codex da VPS aparece no cockpit do PC'); assert.equal(tela.dispositivo, 'VPS'); assert.equal(tela.codex, true); assert.equal(tela.escreve, true); assert.equal(tela.conversa, ID_VPS)
// PC -> VPS
mesc = mesclar([], [{ ...atravessa(PC, doPc), idadeMs: 1000, semContato: false }], VPS)
tela = montar({ jobs: mesc, local: VPS, agora: AGORA, falaDe: (j) => j.ultimaFala || null }).conectadas.find((s) => s.id === ID_PC)
assert.ok(tela, 'a sessão do Codex do PC aparece no cockpit da VPS'); assert.equal(tela.dispositivo, 'PC'); assert.equal(tela.codex, true); assert.equal(tela.escreve, true)
// VPS sem o programa achado: aparece, sem campo de resposta
const semBin = daVps.map((j) => ({ ...j, codexResponde: false }))
mesc = mesclar([], [{ ...atravessa(VPS, semBin), idadeMs: 1000, semContato: false }], PC)
tela = montar({ jobs: mesc, local: PC, agora: AGORA, falaDe: (j) => j.ultimaFala || null }).conectadas.find((s) => s.id === ID_VPS)
assert.ok(tela); assert.equal(tela.escreve, false)
ok('as sessões do Codex atravessam o pacote nos dois sentidos (JSON, validação, junção) e escrevem onde a máquina de origem responde')

fs.rmSync(raiz, { recursive: true, force: true })
console.log(`\n${n} blocos ok`)
