// Checagem mínima da lógica de derivação. `node test.mjs`
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { projectOf, modelOf, routeOf, statusOf, subjectOf, buildJob, mergeMeta, fmtAge, fmtTokens, readJobs } from './src/jobs.mjs'

// projeto/subprojeto saem do padrão de pastas do Felipe
assert.deepEqual(projectOf('D:\\Documentos\\Ti\\projetos\\CLIENTS\\inovallbond\\minigame-evento-v2'), {
  project: 'inovallbond', sub: 'minigame-evento-v2',
})
assert.deepEqual(projectOf('C:\\Users\\lfeli'), { project: 'lfeli', sub: null })
assert.deepEqual(projectOf(''), { project: '—', sub: null })
// sem grupo, a pasta de projetos resolve — é o caso de outra máquina
assert.deepEqual(projectOf('/home/ana/projects/meuapp/api'), { project: 'meuapp', sub: 'api' })
assert.deepEqual(projectOf('/Users/ana/dev/site'), { project: 'site', sub: null })
// sem nada reconhecível, o último segmento serve
assert.deepEqual(projectOf('/opt/coisa'), { project: 'coisa', sub: null })

// modelo só existe dentro de respawnFlags
assert.equal(modelOf(['--agent', 'claude', '--model', 'opus[1m]']), 'opus[1m]')
assert.equal(modelOf(['--agent', 'claude']), 'default')
assert.equal(modelOf(undefined), 'default')

// rota: branch da worktree sem o prefixo, senão main
assert.equal(routeOf({ worktreeBranch: 'worktree-painel-int' }), 'painel-int')
assert.equal(routeOf({}), 'main')

assert.equal(statusOf('working'), 'working')
assert.equal(statusOf('done'), 'done')
assert.equal(statusOf('needs_input'), 'waiting')
assert.equal(statusOf('error'), 'failed')
assert.equal(statusOf('coisa-nova'), 'coisa-nova') // rótulo desconhecido passa direto, não vira 'unknown'

// precedência do assunto: meta > nome do usuário > nome automático > prompt
assert.equal(subjectOf({ name: 'auto', nameSource: 'auto' }, { subject: 'meu' }), 'meu')
assert.equal(subjectOf({ name: 'nuvem', nameSource: 'user' }, {}), 'nuvem')
assert.equal(subjectOf({ intent: 'faz deploy na vps por favor' }, {}), 'faz deploy na vps por favor')

// job "working" sem sinal há 20min conta como parado
const now = 1_000_000_000
const job = buildJob(
  'abc',
  {
    state: 'working',
    createdAt: new Date(now - 3600e3).toISOString(),
    updatedAt: new Date(now - 20 * 60e3).toISOString(),
    respawnFlags: ['--model', 'sonnet'],
    originCwd: 'D:\\Documentos\\Ti\\projetos\\CLIENTS\\inovallbond\\minigame-evento-v2',
    tokens: 12345,
  },
  { todos: [{ text: 'a', done: true }, { text: 'b', done: false }] },
  ['abc'],
  now,
)
assert.equal(job.stale, true)
assert.equal(job.pinned, true)
assert.equal(job.project, 'inovallbond')
assert.equal(job.todosDone, 1)
assert.equal(job.model, 'sonnet')

// pin do painel (meta.pin) e pin do CLI (pins.json) convivem
const semPin = { state: 'done', respawnFlags: [], originCwd: '/x/y', createdAt: new Date(now).toISOString() }
assert.equal(buildJob('a', semPin, {}, [], now).pinned, false)
assert.equal(buildJob('a', semPin, { pin: true }, [], now).pinned, true)
assert.equal(buildJob('a', semPin, { pin: true }, [], now).pinnedAqui, true)
// fixado pelo CLI aparece fixado, mas não como pin do painel — o painel não
// pode oferecer desafixar o que ele não escreveu
assert.equal(buildJob('a', semPin, {}, ['a'], now).pinned, true)
assert.equal(buildJob('a', semPin, {}, ['a'], now).pinnedAqui, false)
// o do CLI continua vindo antes na ordenação
assert.ok(buildJob('a', semPin, {}, ['a'], now).pinIndex < buildJob('a', semPin, { pin: true }, [], now).pinIndex)

// merge preserva o que o patch não mencionou, e null apaga campo
assert.deepEqual(mergeMeta({ subject: 'x', category: 'bug' }, { category: 'feature' }), {
  subject: 'x', category: 'feature',
})
assert.deepEqual(mergeMeta({ subject: 'x', notes: 'y' }, { notes: null }), { subject: 'x' })

// célula sempre ocupa a largura pedida, com ou sem cor, truncando ou não
const { cell } = await import('./src/tui.mjs')
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')
assert.equal(strip(cell('abc', 10)).length, 10)
assert.equal(strip(cell('abc', 10, '\x1b[2m')).length, 10)
assert.equal(strip(cell('painel-int-editores-longo', 20)), 'painel-int-editore… ') // 19 + espaço
assert.equal(strip(cell('painel-int-editores-longo', 20)).length, 20)
assert.ok(cell('x', 5, '\x1b[2m').endsWith('    ')) // reset vem antes do padding

assert.equal(fmtAge(90 * 60e3), '1h30')
assert.equal(fmtTokens(114533), '115k')
assert.equal(fmtTokens(0), '—')

// o script da página não roda em Node, mas erro de sintaxe dá pra pegar aqui
const html = fs.readFileSync(new URL('./src/ui.html', import.meta.url), 'utf8')
// São dois blocos: o do tema, no head, e o da página, no fim do body. Pegar só
// o primeiro faria este teste validar 15 linhas e dar a página inteira por boa.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
assert.equal(scripts.length, 2, 'ui.html deixou de ter os dois blocos de script esperados')
for (const s of scripts) {
  assert.doesNotThrow(() => new Function(s), 'ui.html tem erro de sintaxe no JS')
}
const script = scripts.join('\n')
for (const rota of ['/api/jobs', '/api/meta', '/api/notes', '/events']) {
  assert.ok(script.includes(rota), `ui.html não usa ${rota}`)
}
// Cor inválida em variável CSS é ignorada em silêncio pelo navegador: o tema
// carrega, só que aquele tom cai no valor herdado. Já aconteceu duas vezes na
// mesma edição (`#8manual` e um dígito devanagari no meio do hex).
for (const [, nome, valor] of html.matchAll(/(--[a-z0-9-]+):\s*(#[^;]+);/gi)) {
  assert.match(valor.trim(), /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
    `cor inválida em ${nome}: "${valor.trim()}"`)
}
// cada tema declarado no CSS precisa aparecer na lista que a tela oferece,
// senão vira paleta que ninguém consegue escolher
for (const [, id] of html.matchAll(/:root\[data-tema="([a-z]+)"\]/g)) {
  assert.ok(script.includes(`'${id}'`), `tema "${id}" existe no CSS e não está na lista do seletor`)
}

// o painel tem que reagir ao próprio espaço: com as notas abertas a janela
// segue larga, então media query não serve de breakpoint
assert.ok(html.includes('container-type: inline-size'), 'painel não é contêiner de consulta')
assert.ok(!/@media[^{]*max-width[^{]*\{[^}]*hide-sm/.test(html), 'hide-sm voltou a depender da janela')

// contra os jobs reais da máquina: não pode explodir nem inventar campo
const real = readJobs()
for (const j of real) {
  assert.ok(typeof j.id === 'string' && j.id)
  assert.ok(typeof j.subject === 'string')
  assert.ok(Array.isArray(j.todos))
}

// --- transcript: o último pedido vem do arquivo da sessão, não do intent ---
const { lastPrompt, _internals } = await import('./src/transcript.mjs')
const { humanText, scanTail } = _internals

assert.equal(humanText({ type: 'user', message: { content: 'oi' } }), 'oi')
assert.equal(humanText({ type: 'user', message: { content: [{ type: 'text', text: 'oi' }] } }), 'oi')
assert.equal(humanText({ type: 'assistant', message: { content: 'oi' } }), null)
assert.equal(humanText({ type: 'user', toolUseResult: {}, message: { content: 'saida' } }), null)
assert.equal(humanText({ type: 'user', message: { content: '<system-reminder>x</system-reminder>' } }), null)
assert.equal(humanText({ type: 'user', message: { content: '   ' } }), null)
// injeção de skill vem como user e traz o SKILL.md inteiro — não é pedido
assert.equal(humanText({ type: 'user', isMeta: true, message: { content: 'Base directory for this skill: ...' } }), null)
assert.equal(humanText({ type: 'user', interruptedMessageId: 'x', message: { content: '[Request interrupted by user]' } }), null)
assert.equal(humanText({ type: 'user', promptSource: 'user', message: { content: 'pedido real' } }), 'pedido real')

const linhas = [
  '{"type":"user","message":{"content":"primeiro pedido"}}',
  '{"type":"assistant","message":{"content":"resposta"}}',
  '{"type":"user","toolUseResult":{},"message":{"content":"saida de tool"}}',
  '{"type":"user","message":{"content":"<system-reminder>ignora</system-reminder>"}}',
  '{"type":"user","message":{"content":"ultimo pedido"}}',
]
assert.equal(scanTail(linhas.join('\n'), false), 'ultimo pedido')
assert.equal(scanTail(['{"type":"user","message":{"conte', ...linhas].join('\n'), true), 'ultimo pedido')
assert.equal(scanTail('{lixo nao json}\n', false), null)
assert.equal(scanTail(linhas.join('\n'), false), 'ultimo pedido')
assert.equal(_internals.scanLines(linhas.join('\n'), { fromEnd: false }), 'primeiro pedido')
assert.equal(lastPrompt(null), null)
assert.equal(lastPrompt('C:/caminho/que/nao/existe.jsonl'), null)

// a flag de confiança só pode acusar quando há transcript pra comparar
const { intentMatchesTranscript } = await import('./src/transcript.mjs')
assert.equal(intentMatchesTranscript('qualquer coisa', null), null)
assert.equal(intentMatchesTranscript(null, 'x.jsonl'), null)

// nos jobs reais com transcript, tem que sair pedido de verdade
const comTranscript = readJobs().filter((j) => j.lastPrompt)
assert.ok(comTranscript.length > 0, 'nenhum job leu o transcript')
for (const j of comTranscript) {
  assert.ok(typeof j.lastPrompt === 'string' && j.lastPrompt.length > 0)
  assert.ok(!j.lastPrompt.startsWith('<'), 'pegou system-reminder como pedido')
}

// --- meta.json vem de agente: formato varia, não pode virar "undefined" ---
const { normalizeTodo, normalizeLink } = await import('./src/jobs.mjs')
assert.deepEqual(normalizeTodo({ text: 'a', done: true }), { text: 'a', done: true })
assert.deepEqual(normalizeTodo({ t: 'a', done: true }), { text: 'a', done: true }) // o caso real
assert.deepEqual(normalizeTodo({ title: 'a' }), { text: 'a', done: false })
assert.deepEqual(normalizeTodo({ task: 'a', completed: true }), { text: 'a', done: true })
assert.deepEqual(normalizeTodo('só texto'), { text: 'só texto', done: false })
assert.equal(normalizeTodo({ done: true }), null) // sem texto não vira cartão vazio
assert.equal(normalizeTodo(null), null)

assert.deepEqual(normalizeLink('https://lev4.carzo.com.br'), { label: 'lev4.carzo.com.br', url: 'https://lev4.carzo.com.br' })
assert.deepEqual(normalizeLink({ label: 'painel', url: 'http://x' }), { label: 'painel', url: 'http://x' })
assert.deepEqual(normalizeLink({ href: 'http://x' }), { label: 'http://x', url: 'http://x' })
assert.equal(normalizeLink({ label: 'sem url' }), null)

// --- servidores: classificação e caminho ---
const srv = await import('./src/servers.mjs')
const { kindOf, projectFromCmd } = srv._internals
assert.equal(kindOf('node.exe', 'node .../vite/bin/vite.js'), 'vite')
assert.equal(kindOf('python.exe', 'uvicorn app:main'), 'python')
assert.equal(kindOf('lsass.exe', ''), 'lsass')
// o caminho tem que parar antes de node_modules, senão não diz qual app é
assert.deepEqual(
  projectFromCmd('"node" "D:\\Documentos\\Ti\\projetos\\CLIENTS\\inovallbond\\apps\\game_startingup\\node_modules\\.bin\\..\\vite\\bin\\vite.js"'),
  { project: 'inovallbond', path: 'D:\\Documentos\\Ti\\projetos\\CLIENTS\\inovallbond\\apps\\game_startingup' },
)
assert.deepEqual(projectFromCmd('C:\\Windows\\system32\\svchost.exe -k netsvcs'), { project: null, path: null })
// caminho de Unix também tem que ser reconhecido
assert.deepEqual(projectFromCmd('node /home/ana/projects/meuapp/node_modules/.bin/vite'), {
  project: 'meuapp', path: '/home/ana/projects/meuapp',
})

// --- portabilidade: nada pode depender do HD de uma máquina ---
const plat = await import('./src/platform.mjs')
assert.ok(['win32', 'darwin', 'linux'].includes(plat.SO) || plat.SO)
assert.ok(plat.caminhoAutostart().length > 0)
assert.ok(plat.atalhosPossiveis().every((p) => typeof p === 'string'))
const inst = await import('./src/install.mjs')
assert.equal(typeof inst.projectsBase(), 'string') // detectada, não fixa no código
assert.equal(inst.detectarBase([{ cwd: '/home/ana/projects/x' }, { cwd: '/home/ana/projects/y' }]),
  ['', 'home', 'ana', 'projects'].join(path.sep))
assert.equal(inst.detectarBase([{ cwd: '/opt/nada' }]), null)
assert.deepEqual(inst.findProjects(null), []) // sem base, não varre nada
// matar processo fora da lista tem que ser recusado
assert.throws(() => srv.killServer(4), /inválido/)
assert.throws(() => srv.killServer('abc'), /inválido/)

// --- config: liga/desliga sem tocar no arquivo real ---
const { isEnabled, taxaDe } = await import('./src/config.mjs')
const cwdIno = 'D:\\Documentos\\Ti\\projetos\\CLIENTS\\inovallbond\\minigame-evento-v2'
assert.equal(isEnabled(cwdIno, { enabled: true, disabledProjects: [] }), true)
assert.equal(isEnabled(cwdIno, { enabled: false, disabledProjects: [] }), false)
assert.equal(isEnabled(cwdIno, { enabled: true, disabledProjects: ['inovallbond'] }), false)
assert.equal(isEnabled(cwdIno, { enabled: true, disabledProjects: ['outro'] }), true)

// --- taxa horária: projeto vence global, zero volta pra global ---
const cfgTaxa = { taxaHora: 120, taxaPorProjeto: { inovallbond: 200, gratis: 0 } }
assert.equal(taxaDe('inovallbond', cfgTaxa), 200)
assert.equal(taxaDe('outro', cfgTaxa), 120)
assert.equal(taxaDe('gratis', cfgTaxa), 120) // zero gravado não vira "de graça"
assert.equal(taxaDe('qualquer', {}), 0) // sem taxa nenhuma, a coluna some da tela
assert.equal(taxaDe('qualquer', { taxaHora: 'abc' }), 0)

// --- câmbio: só aceita cotação em faixa de dólar-real ---
const { cotacaoPlausivel } = await import('./src/cambio.mjs')
assert.equal(cotacaoPlausivel(5.43), true)
assert.equal(cotacaoPlausivel(0.18), false) // par invertido pela API
assert.equal(cotacaoPlausivel(0), false)
assert.equal(cotacaoPlausivel(NaN), false)
assert.equal(cotacaoPlausivel(543), false) // centavos vindo como inteiro

// --- mercado: recusa faixa que passa no regex mas não faz sentido ---
const { faixasPlausiveis, extrair, _internals: mi } = await import('./src/mercado.mjs')
assert.equal(faixasPlausiveis([60, 90, 100, 180, 200, 400]), true)
assert.equal(faixasPlausiveis([200, 400, 100, 180, 60, 90]), false) // colunas invertidas
assert.equal(faixasPlausiveis([60, 40, 100, 180, 200, 400]), false) // mínimo acima do máximo
assert.equal(faixasPlausiveis([1, 2, 3, 4, 5, 6]), false) // valores fora de faixa de hora
// o padrão tem que casar com o texto real da página, sem as tags
assert.ok(extrair('Desenvolvedor web/app R$ 60–90/h R$ 100–180/h R$ 200–400/h', mi.FONTES[0]))
assert.ok(extrair('Desenvolvedor Full Stack: R$ 70-120 / R$ 120-200 / R$ 200-400', mi.FONTES[1]))
assert.equal(extrair('nada a ver', mi.FONTES[0]), null)

// --- complexidade: ordena do trivial ao difícil, e o difícil não é só longo ---
const { classificar } = await import('./src/tarefas.mjs')
const trivial = { ms: 5 * 60e3, tokens: 20e3, arquivos: 0, turnos: 3, reeditados: 0, familia: 'haiku' }
const medio = { ms: 3 * 36e5, tokens: 900e3, arquivos: 9, turnos: 80, reeditados: 6, familia: 'opus' }
const extremo = { ms: 9 * 36e5, tokens: 4e6, arquivos: 20, turnos: 300, reeditados: 12, familia: 'opus' }
// mesma duração do médio, mas resolvido de primeira, num arquivo só
const longoESimples = { ms: 3 * 36e5, tokens: 200e3, arquivos: 1, turnos: 12, reeditados: 0, familia: 'sonnet' }
assert.equal(classificar(trivial).nivel, 'junior')
assert.equal(classificar(medio).nivel, 'pleno')
assert.equal(classificar(extremo).nivel, 'senior')
assert.ok(classificar(longoESimples).fracao < classificar(medio).fracao,
  'duração sozinha não pode valer o mesmo que retrabalho — senão arrastar tarefa viraria aumento')
assert.ok(classificar(trivial).fracao < classificar(longoESimples).fracao)

// --- conclusão de to-do: carimba na virada, e só na virada ---
const { marcarConclusoes } = await import('./src/jobs.mjs')
const antes = { todos: [{ text: 'a', done: true }, { text: 'b', done: false }], feitoEm: { a: 'ontem' } }
const depois = marcarConclusoes(antes, { todos: [{ text: 'a', done: true }, { text: 'b', done: true }] }, 'hoje')
assert.equal(depois.a, 'ontem', 'tarefa já concluída não pode ganhar carimbo novo')
assert.equal(depois.b, 'hoje')
// tarefa que saiu da lista leva o carimbo junto, senão o mapa cresce pra sempre
assert.equal(marcarConclusoes(antes, { todos: [{ text: 'b', done: true }] }, 'hoje').a, undefined)
assert.equal(marcarConclusoes(antes, { status: 'x' }), antes.feitoEm, 'patch sem todos não mexe nos carimbos')

// --- roadmap: CRLF não pode zerar o parser ---
{
  const rm = await import('./src/roadmap.mjs')
  // CRLF de propósito: é o formato de metade dos roadmaps, e o que fazia
  // `(.+)$` falhar em todo cabeçalho — o parser saía vazio, sem erro nenhum.
  const comCRLF = [
    '# Projeto',
    '## 🟢 Aberto — depende de mim',
    '### Pierre — anonimização',
    '- fazer isso',
    '- [x] feito isso',
  ].join('\r\n')
  const tmp = path.join(os.tmpdir(), `cc-rm-${Date.now()}`)
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(tmp, 'docs', 'ROADMAP.md'), comCRLF)
  try {
    const m = rm.lerRoadmap(tmp)
    assert.ok(m, 'não achou o roadmap')
    assert.equal(m.grupos.length, 1, 'CRLF zerou os grupos: o ponto do regex nao casa retorno de carro')
    assert.equal(m.grupos[0].estado, 'aberto')
    assert.equal(m.grupos[0].frentes.length, 1)
    assert.equal(m.grupos[0].frentes[0].itens, 2)
    assert.equal(m.grupos[0].frentes[0].feitos, 1)
    // o agente escreve "Pierre"; o roadmap diz "Pierre — anonimização"
    assert.ok(rm.acharFrente(m, 'Pierre'), 'não casou a frente declarada')
    assert.equal(rm.acharFrente(m, 'nada a ver'), null)
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}

// --- status: "done" do CLI não quer dizer tarefa terminada ---
{
  const { statusReal, VIVO_MS } = await import('./src/jobs.mjs')
  const novo = 5_000
  const velho = VIVO_MS + 1
  // o caso que o Felipe relatou: agente trabalhando aparecia como pronto
  assert.equal(statusReal({ state: 'done' }, novo, true), 'working')
  // acabou de responder e a bola está com ele
  assert.equal(statusReal({ state: 'done' }, novo, false), 'waiting')
  // sinal parou: terminou de verdade
  assert.equal(statusReal({ state: 'done' }, velho, false), 'done')
  assert.equal(statusReal({ state: 'done' }, velho, true), 'done')
  // estado explícito do CLI manda, sempre
  assert.equal(statusReal({ state: 'blocked' }, novo, false), 'waiting')
  assert.equal(statusReal({ state: 'failed' }, novo, true), 'failed')
  assert.equal(statusReal({ state: 'running' }, velho, false), 'working')
}

// --- máquina: uso de CPU é diferença entre amostras, não leitura ---
{
  const maq = await import('./src/maquina.mjs')
  maq._internals.resetar()
  // sem amostra anterior não há uso: null, nunca 0 — zero diria "parada"
  assert.equal(maq._internals.usoCpu(), null)
  const segundo = maq._internals.usoCpu()
  assert.ok(segundo === null || (segundo >= 0 && segundo <= 100), `uso fora de faixa: ${segundo}`)
  const r = maq._internals.ram()
  assert.ok(r.totalGB > 0 && r.usadaGB > 0 && r.usadaGB <= r.totalGB)
  assert.ok(r.uso >= 0 && r.uso <= 100)
  maq._internals.resetar()
}

// --- notas: apagar tudo tem que deixar rastro recuperável ---
{
  const notas = await import('./src/notes.mjs')
  const real = fs.existsSync(notas.NOTES_FILE) ? fs.readFileSync(notas.NOTES_FILE, 'utf8') : null
  const bakReal = fs.existsSync(notas.BACKUP_FILE) ? fs.readFileSync(notas.BACKUP_FILE, 'utf8') : null
  const sujeira = []
  try {
    notas.writeNotes([{ title: 'teste', text: 'a' }])
    notas.writeNotes([]) // o caso que apagou as notas de verdade
    assert.equal(notas.readNotes().length, 0)
    const bak = JSON.parse(fs.readFileSync(notas.BACKUP_FILE, 'utf8'))
    assert.equal(bak.notes[0].title, 'teste', 'o .bak precisa ter a versão de antes do apagamento')
    const pasta = path.dirname(notas.NOTES_FILE)
    const copias = fs.readdirSync(pasta).filter((f) => f.startsWith(path.basename(notas.NOTES_FILE)) && f.endsWith('.apagado'))
    assert.ok(copias.length > 0, 'apagar tudo tem que gerar cópia com data')
    sujeira.push(...copias.map((f) => path.join(pasta, f)))
  } finally {
    // devolve o arquivo do Felipe exatamente como estava
    for (const f of sujeira) { try { fs.unlinkSync(f) } catch {} }
    if (real != null) fs.writeFileSync(notas.NOTES_FILE, real)
    if (bakReal != null) fs.writeFileSync(notas.BACKUP_FILE, bakReal)
    else try { fs.unlinkSync(notas.BACKUP_FILE) } catch {}
  }
}

// --- mídia: nome de app legível e escolha da sessão certa ---
const midia = await import('./src/midia.mjs')
const { nomeBonito, normalizar } = midia._internals
assert.equal(nomeBonito('5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App'), 'WhatsAppDesktop')
assert.equal(nomeBonito('Spotify.exe'), 'Spotify')
assert.equal(nomeBonito('Chrome'), 'Chrome')
assert.equal(nomeBonito(''), 'mídia')
// o WhatsApp registra sessão de mídia e não pode passar na frente do que toca
const escolha = normalizar(JSON.stringify({
  sessoes: [
    { indice: 0, app: 'WhatsApp', estado: 'Paused', pid: null },
    { indice: 1, app: 'Chrome', estado: 'Playing', pid: 123, volume: 80, podeProximo: true },
  ],
}))
assert.equal(escolha.sessoes[0].app, 'Chrome', 'quem está tocando tem que vir primeiro')
assert.equal(escolha.sessoes[0].volume, 80)
// PowerShell serializa objeto único fora de array quando só há um
assert.equal(normalizar(JSON.stringify({ sessoes: { indice: 0, app: 'Spotify.exe' } })).sessoes.length, 1)
assert.ok(normalizar('não é json').erro)
assert.equal(normalizar(JSON.stringify({ erro: 'x' })).erro, 'x')

// --- histórico: só grava o que mudou, e não perde job que o CLI apagou ---
const hist = await import('./src/historico.mjs')
hist._internals.resetar()
const fakeJob = {
  id: 'j1', subject: 's', project: 'p', status: 'done', todos: [{ text: 'a', done: true }],
  tokens: 10, createdAt: 1, updatedAt: 2,
}
assert.equal(hist._internals.marca(hist._internals.guardavel(fakeJob)),
  hist._internals.marca(hist._internals.guardavel({ ...fakeJob, model: 'outro' })),
  'trocar campo que não interessa não pode disparar gravação')
assert.notEqual(hist._internals.marca(hist._internals.guardavel(fakeJob)),
  hist._internals.marca(hist._internals.guardavel({ ...fakeJob, todos: [{ text: 'a', done: false }] })),
  'desmarcar tarefa tem que disparar gravação')
// o job apagado pelo CLI continua contando: é o motivo do arquivo existir
const so2 = hist.jobsHistoricos([{ id: 'nao-existe-no-historico' }])
assert.equal(so2.total, so2.vivos.length + so2.mortos.length)
assert.ok(!so2.mortos.some((j) => j.id === 'nao-existe-no-historico'))

// --- install: edição idempotente, em pasta descartável ---
const { installInto, removeFrom, findProjects, blockText } = await import('./src/install.mjs')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-test-'))
try {
  assert.equal(installInto(tmp).action, 'missing') // sem CLAUDE.md não inventa arquivo
  assert.equal(installInto(tmp, { create: true }).action, 'created')

  const md = path.join(tmp, 'CLAUDE.md')
  fs.writeFileSync(md, '# Projeto\n\nTexto do usuário.\n')
  assert.equal(installInto(tmp).action, 'added')
  assert.equal(installInto(tmp).action, 'unchanged') // rodar de novo não duplica

  const depois = fs.readFileSync(md, 'utf8')
  assert.ok(depois.includes('Texto do usuário.'), 'apagou conteúdo do usuário')
  assert.equal(depois.split('control-center:start').length - 1, 1, 'duplicou o bloco')

  // conteúdo fora dos marcadores sobrevive ao update
  fs.writeFileSync(md, depois + '\n## Minha seção\nnão pode sumir\n')
  fs.writeFileSync(md, fs.readFileSync(md, 'utf8').replace(blockText(), '<!-- control-center:start -->\nvelho\n<!-- control-center:end -->'))
  assert.equal(installInto(tmp).action, 'updated')
  const final = fs.readFileSync(md, 'utf8')
  assert.ok(final.includes('Minha seção') && final.includes('Texto do usuário.'))
  assert.ok(!final.includes('\nvelho\n'), 'bloco velho não foi substituído')

  assert.equal(removeFrom(tmp).action, 'removed')
  assert.ok(!fs.readFileSync(md, 'utf8').includes('control-center:start'))
  assert.equal(removeFrom(tmp).action, 'unchanged')
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

// varredura acha projetos reais e não devolve lixo
const projetos = findProjects()
assert.ok(projetos.length > 5, 'varredura achou pouca coisa')
assert.ok(projetos.every((p) => fs.existsSync(p)))
assert.ok(!projetos.some((p) => /node_modules|[\\/]_/.test(p)), 'varredura pegou pasta que devia pular')

// --- notas: arquivo editável à mão, formato tem que aguentar variação ---
const notas = await import('./src/notes.mjs')
const { normalizeNote } = notas._internals
assert.equal(normalizeNote('só texto').text, 'só texto')
assert.equal(normalizeNote({ t: 'titulo curto' }).title, 'titulo curto')
assert.equal(normalizeNote({ texto: 'x', titulo: 'y' }).title, 'y')
assert.equal(normalizeNote(null), null)
assert.equal(normalizeNote({}).h, 120) // sem altura, padrão
assert.equal(normalizeNote({ h: 9999 }).h, 2000) // altura absurda não passa
assert.equal(normalizeNote({ h: 1 }).h, 40)
assert.equal(normalizeNote({ h: 'abc' }).h, 120)
assert.ok(normalizeNote({}).id.length > 1) // bloco sem id ganha um, senão o clique não acha
assert.notEqual(normalizeNote({}).id, normalizeNote({}).id)
assert.equal(normalizeNote({ text: 'x'.repeat(50000) }).text.length, 20000)
assert.ok(Array.isArray(notas.readNotes())) // arquivo pode nem existir
assert.ok(notas.NOTES_FILE.endsWith('control-center-notes.json'))
assert.ok(!notas.NOTES_FILE.includes(`${path.sep}jobs${path.sep}`), 'notas não podem morar em ~/.claude/jobs')

// --- tempo: o corte muda o número, então tem que ser recalculável ---
const tempo = await import('./src/tempo.mjs')
const min = (n) => n * 60_000
// blocos vizinhos só se juntam quando a parada cabe no corte
const blocos = [[0, min(10)], [min(20), min(30)], [min(60), min(70)]]
assert.equal(tempo.ativoMs(blocos, min(2)) / 60_000, 30) // nada junta: 10+10+10
assert.equal(tempo.ativoMs(blocos, min(15)) / 60_000, 40) // junta os dois primeiros: 30+10
assert.equal(tempo.ativoMs(blocos, min(45)) / 60_000, 70) // junta tudo
assert.equal(tempo.ativoMs([], min(15)), 0)
assert.equal(tempo.ativoMs([[0, min(5)]], min(15)) / 60_000, 5)
// corte maior nunca pode dar menos tempo que corte menor
for (const c of [2, 5, 10, 15, 30, 60]) {
  assert.ok(tempo.ativoMs(blocos, min(c)) >= tempo.ativoMs(blocos, min(2)))
}

// bloco que cruza a meia-noite entra nos dois dias, não some nem duplica
const { blocosPorDia } = tempo._internals
const virada = blocosPorDia([[Date.parse('2026-08-01T23:30:00Z'), Date.parse('2026-08-02T00:30:00Z')]])
assert.deepEqual(Object.keys(virada).sort(), ['2026-08-01', '2026-08-02'])
const somaDias = Object.values(virada).flat().reduce((a, [i, f]) => a + (f - i), 0)
assert.ok(Math.abs(somaDias - 60 * 60_000) < 1000, 'a virada do dia perdeu ou inventou tempo')

// custo: cache de escrita custa mais que input, leitura custa muito menos
const so = (campo, n) => ({ input: 0, output: 0, escrita5m: 0, escrita1h: 0, leitura: 0, [campo]: n })
assert.equal(tempo.custoDe('claude-opus-5', so('input', 1e6)), 5)
assert.equal(tempo.custoDe('claude-opus-5', so('output', 1e6)), 25)
assert.equal(tempo.custoDe('claude-opus-5', so('escrita5m', 1e6)), 6.25)
assert.equal(tempo.custoDe('claude-opus-5', so('escrita1h', 1e6)), 10)
assert.equal(tempo.custoDe('claude-opus-5', so('leitura', 1e6)), 0.5)
assert.equal(tempo.custoDe('claude-haiku-4-5', so('input', 1e6)), 1)
// id com data é o mesmo preço do alias — senão o modelo sai da conta calado
assert.equal(tempo.custoDe('claude-haiku-4-5-20251001', so('input', 1e6)), 1)
assert.equal(tempo.custoDe('modelo-que-nao-existe', so('input', 1e6)), null)

// --- daemon: caminhos, sem escrever nada ---
const dm = await import('./src/daemon.mjs')
assert.ok(dm.vbsPath().includes('Startup'), 'autostart não aponta pra pasta Startup')
assert.equal(path.basename(dm.vbsPath()), 'control-center.vbs')

console.log(`ok — ${real.length} jobs reais, ${projetos.length} projetos varridos`)
