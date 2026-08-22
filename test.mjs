// Checagem mínima da lógica de derivação. `node test.mjs`
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
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

/* Todo módulo de `src/` tem que pelo menos CARREGAR.
 *
 * Em 16/08 um `await import` dentro de uma função que não era `async` derrubou
 * o `web.mjs` inteiro — o painel entrou em laço de reinício no systemd e o
 * `npm test` passou verde, porque o gate nunca carregava esse arquivo. Gate que
 * aprova com o servidor morto é pior que gate nenhum: ele dá a confiança sem a
 * cobertura.
 *
 * `import()` e não `new Function()`: erro de sintaxe em módulo ES só aparece no
 * carregamento de verdade, e é justamente essa classe de erro que passou.
 */
{
  const pastaSrc = new URL('./src/', import.meta.url)
  const modulos = fs.readdirSync(pastaSrc).filter((f) => f.endsWith('.mjs'))
  assert.ok(modulos.length > 15, 'a varredura de src/ não achou os módulos')
  for (const m of modulos) {
    await assert.doesNotReject(
      () => import(new URL(m, pastaSrc)),
      `src/${m} não carrega — erro de sintaxe ou import quebrado`,
    )
  }
}

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

// F11: toda aba precisa morar em algum grupo, e nenhum grupo pode apontar pra
// aba que não existe. Sem isto, acrescentar aba nova a deixa invisível na tela
// (ela existe em TABS, mas nenhuma das quatro portas a mostra) — e o defeito
// não aparece em nenhum outro teste, porque o JS continua válido.
{
  const trecho = (nome) => script.match(new RegExp(`const ${nome} = \\[[\\s\\S]*?\\n\\]`))?.[0]
  const fonte = `${trecho('TABS')}\n${trecho('GRUPOS')}\nreturn { TABS, GRUPOS }`
  const { TABS, GRUPOS } = new Function(fonte)()
  const cobertas = new Set(GRUPOS.flatMap((g) => g.abas))
  const orfas = TABS.filter((t) => !cobertas.has(t.id)).map((t) => t.id)
  const fantasmas = [...cobertas].filter((id) => !TABS.some((t) => t.id === id))
  assert.deepEqual(orfas, [], `aba sem grupo (invisível na tela): ${orfas.join(', ')}`)
  assert.deepEqual(fantasmas, [], `grupo aponta pra aba inexistente: ${fantasmas.join(', ')}`)
  assert.ok(GRUPOS.every((g) => g.abas.length), 'grupo vazio não pode existir')
}

/* `?tema=` existe só para print de tela: headless não tem preferência de
   sistema nem localStorage. Achado numa auditoria de design em 18/08: o valor
   da URL era comparado só contra o `id` interno (noite/papel), nunca contra o
   `nome` mostrado no seletor (escuro/claro) — que é a forma que a própria
   documentação deste projeto ensinava a usar. `?tema=escuro` e `?tema=claro`
   caíam sempre no mesmo fallback, e dois prints "nos dois temas" saíam byte a
   byte idênticos sem erro nenhum. */
{
  const trechoTemas = script.match(/var TEMAS = \[[\s\S]*?\n {2}\]/)?.[0]
  assert.ok(trechoTemas, 'ui.html perdeu a lista de TEMAS')
  const fonte = `${trechoTemas}
    function casar(alvo) {
      var t = TEMAS.find(function (x) { return x.id === alvo || x.nome === alvo })
      return t ? t.id : 'noite'
    }
    return casar`
  const casar = new Function(fonte)()
  assert.equal(casar('noite'), 'noite', 'o id continua funcionando')
  assert.equal(casar('papel'), 'papel')
  assert.equal(casar('escuro'), 'noite', 'o nome exibido tem que resolver pro id certo')
  assert.equal(casar('claro'), 'papel', 'o nome exibido tem que resolver pro id certo')
  assert.equal(casar('cor-que-nao-existe'), 'noite', 'valor desconhecido cai no escuro, nunca quebra')
}

for (const rota of ['/api/jobs', '/api/meta', '/api/notes', '/events']) {
  assert.ok(script.includes(rota), `ui.html não usa ${rota}`)
}

/* --- CC-149: a codificação que abre o opencode já na pasta certa ---

   `?directory=` na URL NÃO faz nada na página web do opencode: esse parâmetro
   só existe no esquema de link do app de DESKTOP, lido de uma string, nunca
   da barra de endereço do navegador — testado direto contra o servidor real
   em 18/08, o corpo `{"directory":...}` foi ignorado.

   O caminho de verdade é a pasta na PRÓPRIA url, como segmento, em
   base64url. Achado lendo o bundle JS da SPA do opencode (funções `ln()` e
   `_ne()` daquele código, não deste projeto). O valor abaixo foi conferido
   contra o servidor de produção rodando de verdade: pedir essa URL abriu a
   pasta certa, sem cair no erro que o próprio app declara para pasta
   desconhecida. Guardar aqui é o que impede alguém trocar a fórmula sem
   perceber que ela para de bater com o que o opencode espera. */
{
  const fonte = script.match(/const base64url = \([\s\S]*?\n/)?.[0]
  assert.ok(fonte, 'ui.html perdeu a função base64url do CC-149')
  const base64url = new Function(`${fonte}\nreturn base64url`)()

  assert.equal(
    base64url('/home/claudedev/projetos/proj_controlcenter'),
    'L2hvbWUvY2xhdWRlZGV2L3Byb2pldG9zL3Byb2pfY29udHJvbGNlbnRlcg',
    'a codificação da pasta mudou — é a mesma que o servidor de produção confirmou abrir de verdade',
  )
  // nunca pode sobrar +, / ou = : são os caracteres que tornam um valor
  // inseguro dentro de segmento de URL, e é isso que "url" no nome promete
  for (const pasta of ['/home/x', '/home/x/y-z_w.a', '/tmp/pasta com espaço']) {
    assert.doesNotMatch(base64url(pasta), /[+/=]/, `sobrou caractere inseguro para "${pasta}"`)
  }
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

/* CC-53: o transcript é testado contra um arquivo SINTÉTICO, e por quê.
   Antes isto dependia de `readJobs()` achar um job real com transcript, e numa
   máquina sem job de background o gate inteiro morria aqui — foi o que deixou
   quem trabalha pela VPS sem gate nenhum. Pior: o comportamento que mais
   importa (separar pedido de verdade de injeção de skill) só era exercitado por
   acaso, dependendo do que houvesse na máquina de quem rodou.

   Cada linha abaixo é uma armadilha que já enganou o painel de verdade. */
{
  const linhas = [
    { type: 'user', message: { content: 'primeiro pedido de todos' }, promptSource: 'user' },
    // saída de ferramenta: veio como `user` e não foi ninguém que escreveu
    { type: 'user', toolUseResult: { ok: true }, message: { content: 'saida de tool' } },
    // injeção de skill: traz o SKILL.md inteiro no corpo, e já apareceu na tela
    // como se fosse o pedido dele
    { type: 'user', isMeta: true, message: { content: 'conteudo inteiro de um SKILL.md' } },
    { type: 'assistant', message: { content: 'resposta' } },
    // interrupção: o CLI grava "Request interrupted by user" como mensagem
    { type: 'user', interruptedMessageId: 'x', message: { content: 'Request interrupted' } },
    { type: 'user', message: { content: '<system-reminder>contexto injetado</system-reminder>' } },
    /* O resumo que o CLI injeta quando o contexto estoura. Achado por ELE em
       20/08, olhando o painel: *"me explique essa zona de ultimos pedidos (…)
       e estao em ingles, porque?"*. Não era idioma. Sessão longa é justamente
       a que mais aparece no painel, então o cartão mais importante era o que
       mais mentia sobre o que ele tinha pedido. */
    { type: 'user', isCompactSummary: true, message: { content: 'This session is being continued from a previous conversation that ran out of context.' } },
    // conversa de sub-agente: é `user` no arquivo e não foi ele que escreveu
    { type: 'user', isSidechain: true, message: { content: 'pedido interno de um sub-agente' } },
    { type: 'user', message: { content: [{ type: 'text', text: 'o pedido de verdade, o ultimo' }] } },
  ].map((o) => JSON.stringify(o)).join('\n')

  const arq = path.join(os.tmpdir(), `cc-tr-${Date.now()}.jsonl`)
  fs.writeFileSync(arq, linhas)
  try {
    assert.equal(lastPrompt(arq), 'o pedido de verdade, o ultimo')
    assert.equal(
      _internals.scanLines(linhas, { fromEnd: false }),
      'primeiro pedido de todos',
      'a varredura de cima pegou algo que não foi pessoa que escreveu',
    )
  } finally { fs.rmSync(arq, { force: true }) }
}

/* E quando a máquina TEM job real, ele também é conferido: o sintético prova a
   regra, o real prova que a leitura de disco continua funcionando. Sem job,
   pula dizendo que pulou — silêncio aqui viraria "passou" sem ter testado. */
{
  const comTranscript = readJobs().filter((j) => j.lastPrompt)
  if (!comTranscript.length) {
    console.log('  (pulado: esta máquina não tem job de background com transcript)')
  }
  for (const j of comTranscript) {
    assert.ok(typeof j.lastPrompt === 'string' && j.lastPrompt.length > 0)
    assert.ok(!j.lastPrompt.startsWith('<'), 'pegou system-reminder como pedido')
    assert.ok(
      !j.lastPrompt.startsWith('This session is being continued'),
      `o painel está mostrando o resumo de contexto do CLI como pedido dele, em ${j.project}`,
    )
  }
}

// --- meta.json vem de agente: formato varia, não pode virar "undefined" ---
const { normalizeTodo, normalizeLink } = await import('./src/jobs.mjs')
/* `dono` entrou em 14/08 (commit `4f78264`, a aba de tarefas dele) e estas
   linhas não foram atualizadas junto. Ninguém viu porque o gate morria antes,
   no bloco do transcript — é o custo escondido do CC-53: teste que não roda
   não é teste que passa, é teste que some. */
/* `pronto` e `prova` entraram em 16/08 (CC-97). Comparar o objeto inteiro é
   proposital, apesar de quebrar a cada campo novo: foi assim que o `dono`
   apareceu como regressão escondida, e é barato de atualizar. */
const TODO = (extra) => ({ dono: 'ia', pronto: null, prova: null, codigo: null, olho: false, dependeDe: null, revisoes: [], ...extra })
assert.deepEqual(normalizeTodo({ text: 'a', done: true }), TODO({ text: 'a', done: true }))
assert.deepEqual(normalizeTodo({ t: 'a', done: true }), TODO({ text: 'a', done: true })) // o caso real
assert.deepEqual(normalizeTodo({ title: 'a' }), TODO({ text: 'a', done: false }))
assert.deepEqual(normalizeTodo({ task: 'a', completed: true }), TODO({ text: 'a', done: true }))
assert.deepEqual(normalizeTodo('só texto'), TODO({ text: 'só texto', done: false }))
// CC-114: a dependência sai do texto, do jeito que ele escreve
assert.equal(normalizeTodo('liga o mapa, depende da s03').dependeDe, 's03')
assert.equal(normalizeTodo('depende do CC-112_s02: acabar o painel').dependeDe, 'CC-112_s02')
assert.equal(normalizeTodo('independente de tudo').dependeDe, null, 'palavra parecida não pode casar')

// a definição de pronto e a prova sobrevivem à normalização, e são cortadas
assert.equal(normalizeTodo({ text: 'a', pronto: 'a tela abre' }).pronto, 'a tela abre')
assert.equal(normalizeTodo({ text: 'a', prova: 'npm test verde' }).prova, 'npm test verde')
assert.equal(normalizeTodo({ text: 'a', prova: 'x'.repeat(900) }).prova.length, 600)

/* CC-99: a revisão é LISTA, não campo. Uma tarefa pode ser revisada mais de uma
   vez, e sobrescrever apagaria a rodada anterior — que é justamente o histórico
   que ele pediu para não morrer no chat. */
{
  const comRev = normalizeTodo({
    text: 'a',
    revisoes: [
      'o menu fecha sozinho',
      { quem: 'felipe', apontou: 'e no telefone piora', respondeu: 'guarda no renderTabs' },
      { apontou: '   ' },        // vazio não vira entrada
    ],
  })
  assert.equal(comRev.revisoes.length, 2, 'revisão sem texto não pode virar linha vazia')
  assert.equal(comRev.revisoes[0].quem, 'felipe', 'sem quem declarado, a revisão é dele')
  assert.equal(comRev.revisoes[0].respondeu, null, 'apontado e ainda não respondido')
  assert.equal(comRev.revisoes[1].respondeu, 'guarda no renderTabs')
  /* A dependência sai do texto que já se escreve ("depende do CC-60"), e o
     desbloqueio é o inverso calculado. Da planilha dele (17/08): a linha da
     tarefa dizia de quem ela depende e quem ela destrava. */
  {
    const os2 = await import('node:os')
    const casa = fs.mkdtempSync(path.join(os2.tmpdir(), 'cc-dep-'))
    fs.mkdirSync(path.join(casa, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(casa, 'docs', 'ROADMAP.md'), [
      '# mapa', '',
      '### XX-01 a fundacao', 'texto solto', '',
      '### XX-02 a parede', 'esta depende do XX-01 para existir', '',
    ].join('\n'))
    const { lerRoadmap } = await import('./src/roadmap.mjs')
    const fs2 = lerRoadmap(casa).grupos.flatMap((g) => g.frentes)
    assert.deepEqual(fs2.find((f) => /XX-02/.test(f.titulo)).dependeDe, ['XX-01'])
    assert.deepEqual(fs2.find((f) => /XX-01/.test(f.titulo)).dependeDe, [])
    fs.rmSync(casa, { recursive: true, force: true })
  }

  // teto: um to-do não pode virar log infinito dentro do meta.json
  /* O código da tarefa é estável POR CONSTRUÇÃO, e este teste é a prova que o
     defeito do S1 pedia: fechar ou remover uma tarefa não renumera as outras,
     e número removido nunca volta. */
  {
    const { mergeMeta } = await import('./src/jobs.mjs')
    const v1 = mergeMeta({}, { todos: [{ text: 'a' }, { text: 'b' }] })
    assert.equal(v1.todos[0].codigo, 's01')
    assert.equal(v1.todos[1].codigo, 's02')
    // 'a' fecha e some da lista; 'c' entra. 'b' NÃO pode virar s01
    const v2x = mergeMeta(v1, { todos: [{ text: 'b' }, { text: 'c' }] })
    assert.equal(v2x.todos[0].codigo, 's02', 'tarefa existente mantém o código')
    assert.equal(v2x.todos[1].codigo, 's03', 'número removido não é reciclado')
    // reenvio idêntico não gasta número
    const v3 = mergeMeta(v2x, { todos: [{ text: 'b' }, { text: 'c' }] })
    assert.equal(v3.seqTarefa, v2x.seqTarefa, 'reenviar a lista não anda o contador')
  }

  assert.equal(normalizeTodo({ text: 'a', revisoes: Array(30).fill('x') }).revisoes.length, 10)
}
// quem faz a tarefa: o agente por padrão, o Felipe quando o meta.json diz
assert.equal(normalizeTodo({ text: 'a', dono: 'felipe' }).dono, 'felipe')
assert.equal(normalizeTodo({ done: true }), null) // sem texto não vira cartão vazio
assert.equal(normalizeTodo(null), null)

assert.deepEqual(normalizeLink('https://lev4.carzo.com.br'), { label: 'lev4.carzo.com.br', url: 'https://lev4.carzo.com.br' })
assert.deepEqual(normalizeLink({ label: 'painel', url: 'http://x' }), { label: 'painel', url: 'http://x' })
assert.deepEqual(normalizeLink({ href: 'http://x' }), { label: 'http://x', url: 'http://x' })
assert.equal(normalizeLink({ label: 'sem url' }), null)

// --- servidores: classificação e caminho ---
const srv = await import('./src/servers.mjs')
const { kindOf, projectFromCmd, alvoDoCmd, pastaValida } = srv._internals
assert.equal(kindOf('node.exe', 'node .../vite/bin/vite.js'), 'vite')
assert.equal(kindOf('python.exe', 'uvicorn app:main'), 'python')
assert.equal(kindOf('lsass.exe', ''), 'lsass')
// o caminho tem que parar antes de node_modules, senão não diz qual app é
assert.deepEqual(
  projectFromCmd('"node" "D:\\Documentos\\Ti\\projetos\\CLIENTS\\inovallbond\\apps\\game_startingup\\node_modules\\.bin\\..\\vite\\bin\\vite.js"'),
  { project: 'inovallbond', sub: 'apps', path: 'D:\\Documentos\\Ti\\projetos\\CLIENTS\\inovallbond\\apps\\game_startingup' },
)
assert.deepEqual(projectFromCmd('C:\\Windows\\system32\\svchost.exe -k netsvcs'), { project: null, sub: null, path: null })
// caminho de Unix também tem que ser reconhecido
assert.deepEqual(projectFromCmd('node /home/ana/projects/meuapp/node_modules/.bin/vite'), {
  project: 'meuapp', sub: null, path: '/home/ana/projects/meuapp',
})
// caminho do Windows com barra normal não pode perder a letra do drive
assert.deepEqual(projectFromCmd('node D:/Documentos/Ti/projetos/PESSOAL/app_x/app/dist/cli.js --port 3102'), {
  project: 'app_x', sub: 'app', path: 'D:/Documentos/Ti/projetos/PESSOAL/app_x/app',
})
// o alvo é a pasta que roda, não o arquivo nem o dist
assert.equal(projectFromCmd('node /home/ana/projects/x/build/server.js').path, '/home/ana/projects/x')

// --- servidores: dizer o que o processo é, e não só "node" ---
assert.equal(alvoDoCmd('"node.exe" "D:\\p\\projetos\\x\\node_modules\\.bin\\vite"'), 'vite')
assert.equal(alvoDoCmd('node /home/ana/projects/x/node_modules/next/dist/bin/next'), 'next')
// barra dobrada depois do .bin: era o que fazia o painel anunciar um ".bin"
assert.equal(alvoDoCmd('"node" "D:\\p\\projetos\\x\\node_modules\\.bin\\\\..\\next\\dist\\bin\\next" start -p 3131'), 'next')
assert.equal(alvoDoCmd('node /p/projetos/x/node_modules/@nrwl/cli/bin/nx'), '@nrwl/cli')
assert.equal(alvoDoCmd('"C:\\node.exe" "D:\\Documentos\\Ti\\projetos\\PESSOAL\\proj_controlcenter\\cc.mjs"'), 'cc.mjs')
assert.equal(alvoDoCmd('C:\\Windows\\system32\\svchost.exe -k netsvcs'), null)
assert.equal(srv.descrever({ kind: 'vite', project: 'x', sub: 'apps', cmd: 'node /a/projetos/x/node_modules/.bin/vite' }),
  'vite rodando em x/apps')
assert.equal(srv.descrever({ kind: 'node', project: null, cmd: 'svchost.exe' }), '') // sem nada honesto a dizer

// chave estável entre reinícios: PID muda, apelido não pode sumir com ele
assert.equal(srv.chaveServidor({ path: 'D:\\Proj\\X\\', ports: [5173, 5174] }), 'd:\\proj\\x#5173')
assert.equal(srv.chaveServidor({ name: 'node.exe', ports: [] }), 'node.exe#0')

// repetido é mesmo tipo no mesmo projeto; next + vite lado a lado não é duplicata
const doProjeto = (pid, kind, porta, started) =>
  ({ pid, kind, project: 'x', dev: true, protegido: false, ports: [porta], startedAt: started })
const dups = srv.duplicados([doProjeto(1, 'vite', 5173, 100), doProjeto(2, 'vite', 5174, 200), doProjeto(3, 'next', 3000, 100)])
assert.equal(dups.length, 1)
assert.equal(dups[0].manter.pid, 2)       // fica o mais recente
assert.deepEqual(dups[0].matar.map((s) => s.pid), [1])

// subir e abrir só valem dentro de pasta de projeto
assert.throws(() => pastaValida('C:\\Windows\\System32'), /pasta de projetos|não existe/)
assert.throws(() => pastaValida(''), /não existe/)
assert.throws(() => srv.subirServidor({ cwd: process.cwd(), comando: '' }), /obrigatório/)

// --- VPS: parser da saída do SSH ---
const vps = await import('./src/vps.mjs')
const { secoes, parseNginx, parsePm2, parseDocker, porta } = vps._internals

const bruto = [
  '===HOST===', 'vmi3388091', '16:50:18 up 19 days', '===RAM===', '11000 5600',
  '===DOCKER===', 'meu-app\tnode:20\tUp 2 days\t127.0.0.1:3003->3000/tcp',
].join('\n')
const partes = secoes(bruto)
assert.equal(partes.host, 'vmi3388091\n16:50:18 up 19 days')
assert.equal(partes.ram, '11000 5600')
assert.equal(partes.docker, 'meu-app\tnode:20\tUp 2 days\t127.0.0.1:3003->3000/tcp')
assert.equal(partes.nginx, undefined) // seção que não veio na saída simplesmente não existe

assert.equal(porta('127.0.0.1:3003->3000/tcp'), 3003) // porta de FORA, não a do container
assert.equal(porta('proxy_pass http://127.0.0.1:3002'), 3002)
assert.equal(porta(''), null)

const nginxBruto = [
  '>>inovallbond', 'server_name inovallbond.carzo.com.br', 'proxy_pass http://127.0.0.1:3002',
  '>>mnzs', 'server_name mnzs.carzo.com.br', 'root /var/www/mnzs',
].join('\n')
const sites = parseNginx(nginxBruto)
assert.equal(sites.length, 2)
assert.deepEqual(sites[0], { arquivo: 'inovallbond', serverName: 'inovallbond.carzo.com.br', tipo: 'proxy', alvo: 'http://127.0.0.1:3002', porta: 3002 })
assert.equal(sites[1].tipo, 'estatico')
assert.equal(sites[1].alvo, '/var/www/mnzs')
assert.deepEqual(parseNginx(''), [])

const pm2Bruto = JSON.stringify([{ name: 'ahtleta', pm2_env: { status: 'online', restart_time: 4, pm_uptime: Date.now() - 60000 }, monit: { memory: 84 * 1024 * 1024 } }])
const pm2 = parsePm2(pm2Bruto)
assert.equal(pm2.length, 1)
assert.equal(pm2[0].nome, 'ahtleta')
assert.equal(pm2[0].status, 'online')
assert.equal(pm2[0].memMB, 84)
assert.deepEqual(parsePm2('não é json'), []) // saída quebrada não pode derrubar a aba

const docker = parseDocker('web_ibrics-app-1\tnode:20\tUp 4 days\t127.0.0.1:3003->3000/tcp')
assert.equal(docker.length, 1)
assert.equal(docker[0].nome, 'web_ibrics-app-1')
assert.equal(docker[0].porta, 3003)
assert.deepEqual(parseDocker(''), [])

// --- processos: %CPU vem de duas amostras, RAM/VRAM não precisam disso ---
const proc = await import('./src/processos.mjs')
const { montarDados } = proc._internals

// primeira leitura (sem `antes`): CPU sempre null, mas RAM já aparece
const bruto1 = [{ Id: 1, ProcessName: 'chrome', Cpu: 10, Mem: 500 * 2 ** 20 }]
const r1 = montarDados(bruto1, new Map(), null, 1000, { totalRamBytes: 16e9, nucleos: 4 })
assert.equal(r1.dados.temAmostraCpu, false)
assert.deepEqual(r1.dados.porCpu, []) // sem antes, não tem %, e por isso não entra na lista
assert.equal(r1.dados.porRam[0].ramMB, 500)
assert.equal(r1.proximo.get(1).cpuSeg, 10)

// segunda leitura, 2s depois, gastou 1s de CPU num núcleo — em 4 núcleos, 1/(2*4) = 12,5%
const r2 = montarDados(
  [{ Id: 1, ProcessName: 'chrome', Cpu: 11, Mem: 500 * 2 ** 20 }],
  new Map(), r1.proximo, 3000, { totalRamBytes: 16e9, nucleos: 4 },
)
assert.equal(r2.dados.temAmostraCpu, true)
assert.equal(r2.dados.porCpu[0].cpuPct, 12.5)

// processo com 0% não entra no "top CPU" — lista existiria cheia de lixo sem isto
const r3 = montarDados(
  [{ Id: 1, ProcessName: 'parado', Cpu: 10, Mem: 1 }],
  new Map(), new Map([[1, { cpuSeg: 10, em: 0 }]]), 2000, { totalRamBytes: 16e9, nucleos: 4 },
)
assert.deepEqual(r3.dados.porCpu, [])

// VRAM: só quem está na lista do nvidia-smi aparece
const r4 = montarDados(
  [{ Id: 1, ProcessName: 'jogo', Cpu: 0, Mem: 1 }, { Id: 2, ProcessName: 'outro', Cpu: 0, Mem: 1 }],
  new Map([[1, 2048]]), null, 1000, { totalRamBytes: 16e9, nucleos: 4 },
)
assert.equal(r4.dados.porVram.length, 1)
assert.equal(r4.dados.porVram[0].vramMB, 2048)

// --- portabilidade: nada pode depender do HD de uma máquina ---
const plat = await import('./src/platform.mjs')
assert.ok(['win32', 'darwin', 'linux'].includes(plat.SO) || plat.SO)
assert.ok(plat.caminhoAutostart().length > 0)
assert.ok(plat.atalhosPossiveis().every((p) => typeof p === 'string'))
const inst = await import('./src/install.mjs')
/* Detectada, nunca fixa no código. `null` é resposta legítima: máquina sem job
   e sem config não tem como adivinhar a pasta, e inventar um caminho seria pior
   que admitir. Antes isto exigia string e falhava em qualquer máquina sem job
   de background — mesma dependência de ambiente do CC-53. */
const base = inst.projectsBase()
assert.ok(base === null || (typeof base === 'string' && base.length > 0))
{
  // o que É determinístico: a variável de ambiente manda, em qualquer máquina
  const antes = process.env.CC_PROJECTS_BASE
  process.env.CC_PROJECTS_BASE = path.join(path.sep, 'tmp', 'base-de-teste')
  try {
    assert.equal(inst.projectsBase(), path.join(path.sep, 'tmp', 'base-de-teste'))
  } finally {
    if (antes === undefined) delete process.env.CC_PROJECTS_BASE
    else process.env.CC_PROJECTS_BASE = antes
  }
}
assert.equal(inst.detectarBase([{ cwd: '/home/ana/projects/x' }, { cwd: '/home/ana/projects/y' }]),
  ['', 'home', 'ana', 'projects'].join(path.sep))
/* CC-115: grupos de proteção ligáveis por projeto. O contrato que não pode
   quebrar: desligar um grupo cala os hooks dele NAQUELE projeto e só nele; o
   global (dir nulo) nunca é colorido por projeto; religar deixa o arquivo
   enxuto. Casa isolada via CC_HOME + `?casa=`, o mesmo padrão das notas. */
{
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-mod-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  try {
    const c = await import(`./src/config.mjs?casa=${encodeURIComponent(casa)}`)
    assert.ok(c.CONFIG_FILE.startsWith(casa), 'o teste ia escrever no config de verdade')
    const P = path.join(os.homedir(), 'projetos', 'x-inova', 'apps', 'game')
    c.setModuloProjeto('x-inova', 'codigo', false)
    assert.equal(c.hookEnabled('travessao-guard', undefined, P), false, 'grupo desligado tem que calar no projeto')
    assert.equal(c.hookEnabled('resumo-guard', undefined, P), true, 'outro grupo continua vivo')
    assert.equal(c.hookEnabled('travessao-guard', undefined, path.join(os.homedir(), 'projetos', 'outro')), true)
    assert.equal(c.hookEnabled('travessao-guard', undefined, null), true, 'o global não é colorido por projeto')
    c.setModuloProjeto('x-inova', 'codigo', true)
    assert.equal(c.readConfig().modulosProjeto, undefined, 'religar apaga a entrada')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
  }
}

/* Número de item repetido no ROADMAP (17/08). Aconteceu duas vezes na mesma
   tarde: escrevi CC-118 e CC-119 em cima de itens que já existiam mais abaixo
   no arquivo, e o número deixou de identificar coisa nenhuma. É o oposto do que
   o sistema de código estável existe para fazer, e conferir a olho não escala
   num arquivo de 500 linhas. */
{
  const roadmap = fs.readFileSync(path.join(process.cwd(), 'docs', 'ROADMAP.md'), 'utf8')
  const vistos = new Map()
  const repetidos = []
  for (const linha of roadmap.split(/\r?\n/)) {
    const m = linha.match(/^###\s+((?:CC|NV|FB|VP)-\d+)\b/)
    if (!m) continue
    if (vistos.has(m[1])) repetidos.push(`${m[1]} (também em "${vistos.get(m[1]).slice(0, 40)}")`)
    else vistos.set(m[1], linha.replace(/^###\s*/, ''))
  }
  /* A mensagem diz o arquivo E o próximo número livre. Sugestão de outra sessão
     em 17/08, depois de esbarrar nisto: "se ele apontar o arquivo e o número
     vizinho livre na própria mensagem de erro, quem esbarrar resolve sem ter que
     ler o roadmap inteiro". Vale para toda mensagem de gate: acusar sem dar a
     saída é a burocracia que se desliga na terceira semana. */
  const maior = Math.max(0, ...[...vistos.keys()]
    .filter((k) => k.startsWith('CC-')).map((k) => Number(k.slice(3)) || 0))
  assert.deepEqual(repetidos, [],
    `número de item repetido em docs/ROADMAP.md: ${repetidos.join('; ')}.`
    + ` O próximo livre é CC-${maior + 1}.`)
  /* O piso existe para o teste não passar por não achar nada. 20 é folgado
     contra os 34 itens de hoje; escrevi 50 de cabeça na primeira versão e o
     próprio gate me corrigiu, que é o comportamento certo dele. */
  assert.ok(vistos.size >= 20, `o leitor de itens do roadmap achou só ${vistos.size} seções`)
}

/* CC-128: a regra dele, "se tem função bloqueando, entra como framework".
   O modo do projeto manda no interruptor, e é isso que faz um perfil ser um
   perfil: escolher Designer liga o print obrigatório sem caçar interruptor.
   Casa isolada E projeto de laboratório, porque a resposta depende dos dois. */
{
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-perfil-'))
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-perfil-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  const grava = (estado) => {
    fs.mkdirSync(path.join(proj, '.framework'), { recursive: true })
    fs.writeFileSync(path.join(proj, '.framework', 'estado.json'), JSON.stringify(estado))
  }
  try {
    fs.mkdirSync(path.join(proj, '.git'), { recursive: true })
    const c = await import(`./src/config.mjs?perfil=${encodeURIComponent(casa)}`)
    assert.equal(c.hookEnabled('visual-guard', undefined, proj), true, 'sem framework, vale o padrão')

    // ele desliga no interruptor GLOBAL
    c.setHookEnabled('visual-guard', false)
    assert.equal(c.hookEnabled('visual-guard', undefined, proj), false)

    // o perfil Designer EXIGE: a exigência do modo vence o global
    grava({ metodo: 'mvp-basico', fase: 'execucao', ligado: true, perfil: 'designer' })
    const c2 = await import(`./src/config.mjs?perfil2=${encodeURIComponent(casa)}`)
    assert.equal(c2.hookEnabled('visual-guard', undefined, proj), true,
      'perfil que exige a trava tem que ligar mesmo com o global desligado')

    // e o que o modo DESLIGA cala, que é escolha declarada
    grava({ metodo: 'mvp-basico', fase: 'execucao', ligado: true, modo: 'depuracao' })
    const c3 = await import(`./src/config.mjs?perfil3=${encodeURIComponent(casa)}`)
    assert.equal(c3.hookEnabled('teto-guard', undefined, proj), false, 'depuração desliga o teto')
    assert.equal(c3.hookEnabled('medir-guard', undefined, proj), true, 'e exige medir antes')

    // framework desligado não manda em nada: falha aberta, regra antiga
    grava({ metodo: 'mvp-basico', fase: 'execucao', ligado: false, perfil: 'designer' })
    const c4 = await import(`./src/config.mjs?perfil4=${encodeURIComponent(casa)}`)
    assert.equal(c4.hookEnabled('teto-guard', undefined, proj), true, 'framework desligado volta ao padrão')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
    fs.rmSync(proj, { recursive: true, force: true })
  }
}

/* CC-102: a federação tem que respeitar a casa isolada. Achado em 17/08, ao
   tentar provar a tela de rotas de outra máquina: o módulo resolvia a pasta com
   `os.homedir()` direto, então a instância de teste lia a pasta REAL e um
   pacote de laboratório teria acabado no painel dele. */
{
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fed-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  try {
    const F = await import(`./src/federacao.mjs?casa=${encodeURIComponent(casa)}`)
    assert.ok(F.dirFederacao().startsWith(casa), 'o teste ia escrever na federação de verdade')
    F.gravarPacote({ maquina: { id: 'lab', nome: 'LAB' }, rotas: [], recebidoEm: Date.now() })
    const lidos = F.lerPacotes()
    assert.equal(lidos.length, 1)
    assert.equal(lidos[0].maquina.nome, 'LAB')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
  }
}

// CC-115: o retrato das rotas que a tela de módulos mostra. Este repositório
// carrega o próprio arquivo de rotas, então ele serve de amostra real; um
// diretório sem o arquivo tem que responder desligado, nunca lançar.
{
  const { situacaoRotas } = await import('./src/routia.mjs')
  const aqui = situacaoRotas(process.cwd())
  assert.equal(aqui.ligado, true)
  assert.ok(aqui.total > 0, 'as rotas deste repo têm que ser contadas')
  assert.ok(aqui.ocupadas <= aqui.total)
  assert.deepEqual(situacaoRotas('/tmp'), { ligado: false })
}

// Sem voto de job a resposta mudou (17/08): cai nas pastas convencionais da
// home, que é o que faz a VPS (só sessão interativa, zero jobs) achar os
// projetos. O que continua garantido: o cwd fora do padrão nunca vira base.
{
  const semVoto = inst.detectarBase([{ cwd: '/opt/nada' }])
  assert.ok(semVoto === null || semVoto.startsWith(os.homedir()),
    'sem voto: ou null, ou pasta convencional da home')
  assert.notEqual(semVoto, '/opt/nada')
}
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

// --- roadmap CC-46: estado é a etiqueta do título, não o assunto dele ---
{
  const rm = await import('./src/roadmap.mjs')
  /* Os dois primeiros são os casos reais que motivaram o CC-46: a palavra
     descrevia O QUE a tarefa é, e o painel lia como em que pé ela está.
     Os outros guardam o que NÃO pode ter quebrado no conserto. */
  const casos = [
    ['CC-23 — Historico rico, o que sobra quando o CLI apaga o job', 'aberto'],
    ['CC-04 — o painel mostra agente travado como se estivesse vivo', 'aberto'],
    ['Concluido em 14/08', 'feito'],
    ['🔴 Bloqueado — so o Felipe destrava', 'bloqueado'],
    // emoji vence a palavra quando os dois se contradizem: quem escolheu 🟡 e
    // não 🔴 quis dizer amarelo, e "depende de alguém" é esperar
    ['🟡 Bloqueado — depende da Carol', 'esperando'],
    ['F16. PDF ✅ 15/08 — extrator proprio', 'feito'],
    ['Frente: Bancada — auditoria e teste agnostico', 'aberto'],
  ]
  const tmp = path.join(os.tmpdir(), `cc-rm46-${Date.now()}`)
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true })
  fs.writeFileSync(
    path.join(tmp, 'docs', 'ROADMAP.md'),
    ['# P', '## Sprint', ...casos.map(([t]) => `### ${t}`)].join('\n'),
  )
  try {
    const frentes = rm.lerRoadmap(tmp).grupos[0].frentes
    casos.forEach(([titulo, esperado], i) => {
      assert.equal(frentes[i].estado, esperado, `"${titulo}" saiu como ${frentes[i].estado}`)
    })
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}

/* --- dois itens pausados não podem virar o mesmo cartão ---

   Achado por ELE em 19/08, perguntando se CC-80 e CC-155 eram o mesmo item:
   no mapa do roadmap os dois apareciam ligados e com a mesma descrição.

   A causa eram duas funções discordando sobre o mesmo texto. `limpar()`, no
   `roadmap.mjs`, apaga `⏸` junto com os outros marcadores, o que está certo
   para o texto que vai à tela. Mas `partirTitulo()` usa esse marcador como
   âncora para saber onde o MOTIVO da pausa acaba e o nome começa. Sem ele,
   todo item que começa com "⏸ você decide — …" vira nome "você decide", e a
   chave do cartão (`projeto:nome`) funde os dois.

   O teste guarda as duas pontas: o título cru chega inteiro, e o nome sai
   diferente para itens diferentes. */
{
  const rm2 = await import('./src/roadmap.mjs')
  const { partirTitulo } = await import('./src/trabalho.mjs')

  const tmp = path.join(os.tmpdir(), `cc-pausa-${Date.now()}`)
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(tmp, 'docs', 'ROADMAP.md'), [
    '# P', '## Aberto',
    '### CC-80 ⏸ você decide — o estudo está pronto, falta escolher a forma',
    '### CC-155 ⏸ você decide — as avenidas em mapa visual, ideia dele em 18/08',
  ].join('\n'))
  try {
    const fs3 = rm2.lerRoadmap(tmp).grupos[0].frentes
    assert.ok(fs3[0].tituloCru.includes('⏸'), 'o título cru precisa manter o marcador')
    assert.ok(!fs3[0].titulo.includes('⏸'), 'o título exibido continua sem marcador')

    const a = partirTitulo(fs3[0].tituloCru)
    const b = partirTitulo(fs3[1].tituloCru)
    assert.notEqual(a.nome, b.nome, 'dois itens pausados sairiam com o mesmo nome, e viram um cartão só')
    assert.ok(/estudo/.test(a.nome), `o nome do CC-80 devia falar do estudo, veio "${a.nome}"`)
    assert.ok(/avenidas/.test(b.nome), `o nome do CC-155 devia falar das avenidas, veio "${b.nome}"`)
    assert.ok(!/você decide/i.test(a.nome), 'o motivo da pausa não é o nome do item')

    // e sem o marcador o comportamento não pode explodir: título já limpo
    // continua produzindo algum nome, mesmo que seja o motivo
    assert.ok(partirTitulo(fs3[0].titulo).nome.length > 0)
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

/* --- notas: apagar tudo tem que deixar rastro recuperável ---

   ⚠️ Este bloco roda numa casa `.claude` TEMPORÁRIA, e isso não é detalhe.
   Antes ele escrevia no `control-center-notes.json` de verdade: gravava,
   apagava tudo para conferir a cópia de segurança, e restaurava no `finally`.
   Termina bem quando termina — e `npm test` interrompido no meio (Ctrl+C,
   crash) deixava as notas do Felipe vazias. É o sintoma exato do incidente de
   2026-08-09, cuja causa nunca foi provada.

   Como `casaClaude()` é lido a cada chamada, a variável precisa estar no lugar
   ANTES do import do módulo. */
{
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-casa-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  try {
    // `?casa=` força um módulo novo: import é cacheado, e sem isso o NOTES_FILE
    // resolvido num teste anterior continuaria valendo
    const notas = await import(`./src/notes.mjs?casa=${encodeURIComponent(casa)}`)
    assert.ok(notas.NOTES_FILE.startsWith(casa), 'o teste ia escrever nas notas de verdade')

    notas.writeNotes([{ title: 'teste', text: 'a' }])
    notas.writeNotes([]) // o caso que apagou as notas de verdade
    assert.equal(notas.readNotes().length, 0)

    const bak = JSON.parse(fs.readFileSync(notas.BACKUP_FILE, 'utf8'))
    assert.equal(bak.notes[0].title, 'teste', 'o .bak precisa ter a versão de antes do apagamento')

    const copias = fs.readdirSync(casa)
      .filter((f) => f.startsWith(path.basename(notas.NOTES_FILE)) && f.endsWith('.apagado'))
    assert.ok(copias.length > 0, 'apagar tudo tem que gerar cópia com data')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
  }
}

/* --- CC-82, documentos: o que não pode se perder ---

   Mesma casa temporária das notas, pela mesma razão: aqui se apaga documento
   para conferir o rastro, e documento é fonte primária dele — texto ditado que
   não tem outra cópia. Teste que escreve no dado real é defeito, mesmo com
   restauração no `finally`. */
{
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-docs-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  try {
    const doc = await import(`./src/documentos.mjs?casa=${encodeURIComponent(casa)}`)
    assert.ok(doc.PASTA().startsWith(casa), 'o teste ia escrever na estante de verdade')

    const a = doc.gravar({ titulo: 'Contrato da Carol', texto: '# Contrato\n\ncorpo', fonte: 'chat' })
    assert.equal(a.id, 'contrato-da-carol', 'o id sai do título, legível fora do painel')

    // título repetido não pode sobrescrever silenciosamente o documento anterior
    const b = doc.gravar({ titulo: 'Contrato da Carol', texto: 'outro' })
    assert.equal(b.id, 'contrato-da-carol-2')
    assert.equal(doc.ler('contrato-da-carol').texto.trim(), '# Contrato\n\ncorpo')

    // acrescentar é o caso do celular: soma ao fim, nunca troca o documento
    doc.acrescentar('contrato-da-carol', 'linha ditada')
    const depois = doc.ler('contrato-da-carol')
    assert.ok(depois.texto.includes('corpo') && depois.texto.includes('linha ditada'))
    assert.ok(depois.criadoEm, 'a data de criação sobrevive à reescrita')
    assert.equal(depois.fonte, 'chat', 'a origem sobrevive à reescrita')

    // gravar por cima deixa .bak, como as notas — o cuidado que veio do 09/08
    assert.ok(fs.existsSync(path.join(doc.PASTA(), 'contrato-da-carol.md.bak')))

    // apagar deixa rastro recuperável, nunca some de vez
    doc.apagar('contrato-da-carol-2')
    assert.equal(doc.listar().length, 1)
    assert.ok(fs.readdirSync(doc.PASTA()).some((f) => f.includes('.apagado')),
      'apagar documento tem que deixar cópia — é fonte primária, não tem de onde regenerar')

    // frontmatter é escrito à mão; o parser precisa aguentar a volta
    const { meta, texto } = doc._internals.separar(doc._internals.juntar({ titulo: 'x: y' }, 'corpo'))
    assert.equal(meta.titulo, 'x: y')
    assert.equal(texto, 'corpo')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
  }
}

/* --- Bancada, sonda de RLS: contra um Supabase de mentira ---

   A camada mais valiosa do catálogo é também a única que não dá para provar
   olhando: ela depende de um servidor respondendo. Nenhum projeto desta VPS tem
   Supabase no `.env`, e apontar para um projeto real do Felipe seria varrer o
   banco de um cliente para testar código.

   Então o teste sobe um PostgREST FALSO: publica o esquema como o de verdade
   publica, devolve linha em duas tabelas e vazio numa terceira. É o suficiente
   para provar as três decisões que importam — descobrir tabela pelo OpenAPI,
   separar "devolveu linha" de "RLS filtrou tudo", e classificar como ALTA a
   tabela cujo nome sugere dado de pessoa. */
{
  const http = await import('node:http')
  const { CAMADAS } = await import('./src/bancadaCatalogo.mjs')

  const ESQUEMA = { paths: { '/': {}, '/users': {}, '/produtos': {}, '/segredos': {}, '/rpc/x': {} } }
  const servidor = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    const rota = req.url.split('?')[0]
    if (rota === '/rest/v1/') return res.end(JSON.stringify(ESQUEMA))
    // `users` e `produtos` devolvem linha (sem RLS); `segredos` devolve vazio,
    // que é como uma tabela COM política se comporta para um estranho
    if (rota === '/rest/v1/users') return res.end('[{"id":1}]')
    if (rota === '/rest/v1/produtos') return res.end('[{"id":9}]')
    if (rota === '/rest/v1/segredos') return res.end('[]')
    res.statusCode = 404
    res.end('{}')
  })
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok))
  const porta = servidor.address().port

  const projeto = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rls-'))
  fs.writeFileSync(path.join(projeto, '.env'),
    `SUPABASE_URL=http://127.0.0.1:${porta}\nSUPABASE_ANON_KEY=chave-de-mentira\n`)

  try {
    const rls = CAMADAS.find((c) => c.id === 'rls-supabase')
    assert.ok(rls.aplicaA(projeto), 'com URL e chave no .env a camada tem que se aplicar')

    const r = await rls.rodar(projeto)
    assert.equal(r.verificou, true, 'falou com o servidor, então verificou')

    const nomes = r.achados.map((a) => a.titulo)
    assert.ok(nomes.some((t) => t.includes('"users"')), 'tabela sem RLS tem que aparecer')
    assert.ok(nomes.some((t) => t.includes('"produtos"')), 'idem para produtos')
    assert.ok(!nomes.some((t) => t.includes('"segredos"')),
      'tabela que devolve vazio está PROTEGIDA — acusá-la seria alarme falso')
    assert.ok(!nomes.some((t) => t.includes('rpc')), 'rpc não é tabela')

    const users = r.achados.find((a) => a.titulo.includes('"users"'))
    const produtos = r.achados.find((a) => a.titulo.includes('"produtos"'))
    assert.equal(users.gravidade, 'alta', 'nome que sugere dado de pessoa é grave')
    assert.equal(produtos.gravidade, 'média', 'catálogo pode ser público de propósito')
    assert.equal(r.ok, false, 'achado grave reprova a camada')

    // a chave nunca pode vazar para o resultado, que é lido e guardado no estado
    assert.ok(!JSON.stringify(r).includes('chave-de-mentira'),
      'a chave do .env não pode aparecer no resultado da camada')

    // servidor fora do ar: "não deu para verificar", nunca "está limpo"
    await new Promise((ok) => servidor.close(ok))
    const caiu = await rls.rodar(projeto)
    assert.equal(caiu.verificou, false, 'sem servidor não dá para afirmar nada')
    assert.equal(caiu.achados.length, 0)
  } finally {
    servidor.close()
    fs.rmSync(projeto, { recursive: true, force: true })
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

// CC-23: arquivar duas vezes não pode apagar o carimbo de conclusão da
// primeira vez, mesmo que a segunda venha com feitoEm podado (o cenário real:
// marcarConclusoes() remove do mapa o texto que saiu da lista de to-dos)
{
  const arqTeste = path.join(os.tmpdir(), `cc-test-historico-${Date.now()}.json`)
  hist._internals.resetar()
  try {
    hist.arquivar(
      [{ id: 'j2', subject: 'primeira', project: 'proj-teste-cc23', status: 'working',
         todos: [{ text: 'a', done: true }], feitoEm: { a: 100 }, createdAt: 50, updatedAt: 100 }],
      100, arqTeste,
    )
    hist._internals.resetar() // senão a marca igual faria a segunda gravação ser pulada
    hist.arquivar(
      [{ id: 'j2', subject: 'primeira', project: 'proj-teste-cc23', status: 'done',
         todos: [], feitoEm: {}, createdAt: 50, updatedAt: 200 }],
      200, arqTeste,
    )
    const h = hist.readHistorico(arqTeste)
    assert.deepEqual(h.jobs.j2.feitoEm, { a: 100 }, 'o carimbo da primeira gravação sobreviveu à poda da segunda')

    const marcos = hist.marcosDe('proj-teste-cc23', { file: arqTeste })
    assert.equal(marcos.filter((m) => m.tipo === 'todo').length, 1)
    assert.equal(marcos.filter((m) => m.tipo === 'entrega').length, 1, 'job status done vira marco de entrega')
    assert.ok(marcos.every((m) => m.em <= m.em), 'sanidade: cada marco tem timestamp')
    assert.deepEqual([...marcos].sort((a, b) => a.em - b.em).map((m) => m.em), marcos.map((m) => m.em), 'marcosDe devolve em ordem')

    assert.equal(hist.marcosDe('projeto-que-nao-existe', { file: arqTeste }).length, 0)
    assert.equal(hist.marcosDe('proj-teste-cc23', { desde: 999999, file: arqTeste }).length, 0,
      'desde no futuro não traz marco nenhum')
  } finally {
    fs.rmSync(arqTeste, { force: true })
    fs.rmSync(`${arqTeste}.tmp`, { force: true })
    hist._internals.resetar()
  }
}

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

/* Varredura: base sintética primeiro, porque é a única que roda em qualquer
   máquina. `findProjects()` sem argumento depende de `projectsBase()`, que
   depende dos jobs — numa máquina sem job de background devolvia vazio e o
   gate morria aqui (CC-53 de novo, terceira vez no mesmo arquivo). */
{
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-proj-'))
  try {
    // projeto é pasta com `.git` ou `CLAUDE.md`; as duas últimas têm que ser puladas
    for (const p of ['alfa', 'beta', 'grupo/gama', '_rascunho', 'node_modules/pacote']) {
      fs.mkdirSync(path.join(raiz, p), { recursive: true })
      fs.writeFileSync(path.join(raiz, p, 'CLAUDE.md'), '# projeto de teste')
    }

    const achados = findProjects(raiz)
    assert.ok(achados.length >= 3, `varredura achou pouca coisa: ${achados.length}`)
    assert.ok(achados.every((p) => fs.existsSync(p)))
    assert.ok(
      !achados.some((p) => /node_modules|[\\/]_/.test(p)),
      'varredura pegou pasta que devia pular',
    )
  } finally { fs.rmSync(raiz, { recursive: true, force: true }) }
}

// e contra a máquina de verdade, quando ela tiver base: prova que a detecção
// e a leitura de disco continuam de pé, sem exigir que exista
{
  const reais = findProjects()
  if (!reais.length) console.log('  (pulado: esta máquina não tem base de projetos detectada)')
  assert.ok(reais.every((p) => fs.existsSync(p)))
  assert.ok(!reais.some((p) => /node_modules|[\\/]_/.test(p)))
}

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

// --- calendário: parser de ICS, sem tocar na rede nem no config ---
const cal = await import('./src/calendario.mjs')

// linha longa continua na seguinte começando com espaço; sem desdobrar, o
// título vira dois campos e o segundo não casa com nada
assert.deepEqual(cal.desdobrar('SUMMARY:reunião com\r\n  a Carol\r\nEND'), ['SUMMARY:reunião com a Carol', 'END'])

// três formatos de data, e só o com Z é UTC
assert.equal(cal.paraData('20260812T140000Z').data.toISOString(), '2026-08-12T14:00:00.000Z')
assert.equal(cal.paraData('20260812').diaInteiro, true)
assert.equal(cal.paraData('20260812T140000').data.getHours(), 14) // sem Z: hora local
assert.equal(cal.paraData('nada'), null)

const ics = (corpo) => `BEGIN:VCALENDAR\r\n${corpo}\r\nEND:VCALENDAR`
const janela = { de: new Date(2026, 7, 10), ate: new Date(2026, 7, 20) }

const simples = cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:1', 'SUMMARY:call com a Carol\\, quinta', 'LOCATION:Meet',
  'DTSTART:20260813T140000', 'DTEND:20260813T150000', 'END:VEVENT',
].join('\r\n')), janela)
assert.equal(simples.length, 1)
assert.equal(simples[0].titulo, 'call com a Carol, quinta') // vírgula escapada volta ao normal
assert.equal(simples[0].fim - simples[0].inicio, 60 * 60_000)

// evento excluído continua no arquivo do Google; não pode aparecer na agenda
assert.equal(cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:2', 'SUMMARY:cancelado', 'STATUS:CANCELLED',
  'DTSTART:20260813T140000', 'END:VEVENT',
].join('\r\n')), janela).length, 0)

// fora da janela não entra
assert.equal(cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:3', 'SUMMARY:mês que vem', 'DTSTART:20260913T140000', 'END:VEVENT',
].join('\r\n')), janela).length, 0)

// semanal às segundas e quartas, com uma data excluída no meio
const repetido = cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:4', 'SUMMARY:daily', 'DTSTART:20260810T090000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE', 'EXDATE:20260812T090000', 'END:VEVENT',
].join('\r\n')), janela)
// 10, 12, 17 e 19 de agosto são seg/qua na janela — o dia 12 está excluído
assert.deepEqual(repetido.map((e) => new Date(e.inicio).getDate()), [10, 17, 19])
assert.ok(repetido.every((e) => e.repete))

// A última semana da janela não pode sumir. Achado rodando de verdade: com a
// janela terminando numa quarta, os dias dessa semana parcial nunca eram
// gerados, porque o cursor da semana já nascia depois do limite.
const parcial = cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:41', 'SUMMARY:daily', 'DTSTART:20260812T093000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'END:VEVENT',
].join('\r\n')), { de: new Date(2026, 7, 12), ate: new Date(2026, 7, 19) })
// 12, 13 e 14 (qua a sex) mais 17 e 18 (seg e ter da semana seguinte) — a
// ocorrência do dia 19 às 9h30 fica de fora porque a janela fecha à meia-noite
assert.deepEqual(parcial.map((e) => new Date(e.inicio).getDate()), [12, 13, 14, 17, 18])

// UNTIL corta a série antes do fim da janela
assert.equal(cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:5', 'SUMMARY:acaba', 'DTSTART:20260810T090000',
  'RRULE:FREQ=DAILY;UNTIL=20260812T090000', 'END:VEVENT',
].join('\r\n')), janela).length, 3)

// COUNT idem
assert.equal(cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:6', 'SUMMARY:duas vezes', 'DTSTART:20260810T090000',
  'RRULE:FREQ=DAILY;COUNT=2', 'END:VEVENT',
].join('\r\n')), janela).length, 2)

// COUNT conta ocorrência, não semana: 3 com BYDAY=MO,WE são seg, qua e a
// segunda seguinte — não três semanas inteiras
assert.deepEqual(cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:61', 'SUMMARY:tres vezes', 'DTSTART:20260810T090000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=3', 'END:VEVENT',
].join('\r\n')), janela).map((e) => new Date(e.inicio).getDate()), [10, 12, 17])

// regra sem fim não pode virar loop: a janela é o teto, não o arquivo
const anos = cal.lerIcs(ics([
  'BEGIN:VEVENT', 'UID:7', 'SUMMARY:pra sempre', 'DTSTART:20200101T090000',
  'RRULE:FREQ=DAILY', 'END:VEVENT',
].join('\r\n')), janela)
assert.ok(anos.length <= cal._internals.MAX_OCORRENCIAS, 'RRULE infinito passou do teto')

// a URL do calendário é credencial: caminho de arquivo local não pode virar fonte
const { setCalendario, setVisita } = await import('./src/config.mjs')
assert.throws(() => setCalendario({ nome: 'x', url: 'file:///C:/Windows/win.ini' }), /http/)
assert.throws(() => setCalendario({ nome: 'x', url: '' }), /obrigat/)

// CC-33: só a validação — nunca chamar setVisita de verdade aqui, escreveria
// no control-center.json real desta máquina a cada `npm test`
assert.throws(() => setVisita(''), /projeto/)
assert.throws(() => setVisita(null), /projeto/)

// --- catálogo de hooks: todo id único, todo evento reconhecido ---
const { HOOKS, EVENTOS } = await import('./src/hooksCatalogo.mjs')
const ids = HOOKS.map((h) => h.id)
assert.equal(new Set(ids).size, ids.length, 'hook com id duplicado no catálogo')
for (const h of HOOKS) assert.ok(EVENTOS.includes(h.evento), `evento desconhecido em ${h.id}: ${h.evento}`)

/* Hook que existe no disco mas não no catálogo RODA CALADO, e isso me pegou
   três vezes em dois dias: `hookEnabled('id-desconhecido')` devolve false, então
   o hook sai na primeira linha achando que está desligado. O `roadmap-guard`
   ficou assim desde que nasceu — estava no settings.json, nunca falou, e havia
   33 itens concluídos entulhando o ROADMAP que ele teria acusado.

   O erro é invisível justamente porque o hook não reclama de nada, inclusive de
   si mesmo. Por isso a conferência é aqui e não numa instrução. */
{
  const pastaHooks = path.join(import.meta.dirname, 'hooks')
  const noDisco = fs.readdirSync(pastaHooks).filter((f) => f.endsWith('.mjs'))
  const noCatalogo = new Set(HOOKS.map((h) => h.script))

  /* A acusação precisa ser exata: só quem CONSULTA o catálogo fica mudo fora
     dele. `framework-guard` e `anonimo-guard` não chamam `hookEnabled`, então
     funcionam registrados ou não — a primeira versão deste teste os acusava de
     estar calados, o que era falso. Verificar antes de acusar vale para o teste
     também. */
  const mudos = noDisco.filter((f) => {
    if (noCatalogo.has(f)) return false
    let fonte = ''
    try { fonte = fs.readFileSync(path.join(pastaHooks, f), 'utf8') } catch { return false }
    return fonte.includes('hookEnabled')
  })
  assert.deepEqual(mudos, [],
    `hook consulta o catálogo, não está nele, e por isso roda calado: ${mudos.join(', ')}`)

  /* E o contrário: catálogo apontando para script que não existe.
     Os do Routia moram em `hooks/routia/`, e o `cc-check` não é arquivo — é
     subcomando do próprio `cc`, e por isso tem `script: null`. Procurar nas duas
     pastas em vez de exigir tudo na raiz: a organização por família é boa, e o
     teste é que tem que conhecê-la. */
  const emRoutia = fs.existsSync(path.join(pastaHooks, 'routia'))
    ? fs.readdirSync(path.join(pastaHooks, 'routia'))
    : []
  const semArquivo = HOOKS.filter((h) => h.implementado && h.script
    && !noDisco.includes(h.script) && !emRoutia.includes(h.script))
  assert.deepEqual(semArquivo.map((h) => h.id), [],
    'catálogo diz implementado, mas o arquivo não está em hooks/ nem em hooks/routia/')
}

// --- toggle de hook: sem entrada no config usa o padrão do catálogo ---
const { hookEnabled } = await import('./src/config.mjs')
// cc-check tem padrao:true — cfg sem a chave usa o padrão, não false
assert.equal(hookEnabled('cc-check', { hooks: {} }), true)
// override explícito vence o padrão, nos dois sentidos
assert.equal(hookEnabled('cc-check', { hooks: { 'cc-check': false } }), false)
assert.equal(hookEnabled('routia-inicio', { hooks: { 'routia-inicio': true } }), true)
// hook fora do catálogo: presume desligado, nunca liga sozinho por engano
assert.equal(hookEnabled('nao-existe', { hooks: {} }), false)

// --- registro no settings.json: leitura tolerante, sem tocar disco ---
const { registrado } = await import('./src/hooksRegistro.mjs')
const settingsFake = {
  hooks: {
    PreToolUse: [
      { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node ~/.claude/hooks/rota-guard.mjs' }] },
    ],
    Stop: [
      { hooks: [{ type: 'command', command: 'node ~/.claude/hooks/todo-guard.mjs', timeout: 10 }] },
    ],
  },
}
assert.equal(registrado(HOOKS.find((h) => h.id === 'rota-guard'), settingsFake), true)
// cc-check não tem script próprio no settings.json — só é achado via registradoVia (todo-guard.mjs)
assert.equal(registrado(HOOKS.find((h) => h.id === 'cc-check'), settingsFake), true)
// git-add-guard não está no fixture: tem que dar false, não lançar
assert.equal(registrado(HOOKS.find((h) => h.id === 'git-add-guard'), settingsFake), false)
// settings.json ausente/quebrado: nenhum hook aparece registrado, sem lançar
assert.equal(registrado(HOOKS.find((h) => h.id === 'rota-guard'), null), false)

// --- Método Routia: instalar o quadro, tudo dentro de uma pasta temporária ---
const { detectarPastas, instalarRotas } = await import('./src/routia.mjs')
const tmpRotia = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-routia-'))

// apps/tools vence quando existem, mesmo com src do lado
fs.mkdirSync(path.join(tmpRotia, 'apps'))
fs.mkdirSync(path.join(tmpRotia, 'src'))
assert.deepEqual(detectarPastas(tmpRotia), ['apps'])

// só src: projeto de app único, como este aqui
const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-routia-'))
fs.mkdirSync(path.join(tmpSrc, 'src'))
assert.deepEqual(detectarPastas(tmpSrc), ['src'])

// nem apps/tools nem src: cai no hardcode antigo, sem lançar
const tmpVazio = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-routia-'))
assert.deepEqual(detectarPastas(tmpVazio), ['apps', 'tools'])

// instala de verdade, com o front-matter certo
const rotiaR1 = instalarRotas(tmpSrc)
assert.equal(rotiaR1.acao, 'criado')
assert.deepEqual(rotiaR1.pastas, ['src'])
const conteudo = fs.readFileSync(rotiaR1.arquivo, 'utf8')
assert.match(conteudo, /pastas-controladas: \[src\]/)

// nunca sobrescreve um quadro que já existe
fs.writeFileSync(rotiaR1.arquivo, conteudo.replace('🟢 livre', '🔴 ocupada — NÃO PODE SUMIR'))
const rotiaR2 = instalarRotas(tmpSrc)
assert.equal(rotiaR2.acao, 'ja-existe')
assert.match(fs.readFileSync(rotiaR1.arquivo, 'utf8'), /NÃO PODE SUMIR/, 'instalarRotas sobrescreveu quadro com dado real')

for (const d of [tmpRotia, tmpSrc, tmpVazio]) fs.rmSync(d, { recursive: true, force: true })

// --- opencode: disparo, heurística, verificação — sem chamar o opencode de verdade ---
/* --- CC-134: o motor de recados, e a razão dele estar em src/, não em hooks/ ---

   `hooks/routia/recados.mjs` tem código de topo que chama `process.exit()`
   sem condição: importar aquele arquivo do painel derrubava (ou travava,
   esperando stdin) qualquer comando do `cc.mjs`. `src/recados.mjs` existe para
   que o painel tenha o que importar sem esse risco — e este bloco é a prova de
   que o motor puro continua funcionando depois da separação. */
{
  const R = await import('./src/recados.mjs')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-recados-'))
  try {
    assert.deepEqual(R.ler(raiz).recados, [], 'projeto sem arquivo ainda: lista vazia, nunca erro')
    assert.deepEqual(R.log(raiz), [])
    assert.deepEqual(R.pendentes(raiz, 'sessao-a'), [])

    const r1 = R.enviar(raiz, { de: 'sessaoaaaa', para: 'sessaobbbb', tipo: 'vou_mexer', texto: 'vou mexer no ui.html', arquivo: 'src/ui.html' })
    assert.equal(r1.de, 'sessaoaa') // curto: 8 caracteres, sempre
    assert.equal(r1.para, 'sessaobb')
    assert.throws(() => R.enviar(raiz, { de: 'a', para: 'b', tipo: 'tipo-que-nao-existe', texto: 'x' }),
      /tipo desconhecido/, 'tipo inválido não pode virar recado gravado')

    const r2 = R.enviar(raiz, { de: 'sessaoaaaa', para: 'todos', tipo: 'aviso', texto: 'oi geral' })

    assert.deepEqual(R.pendentes(raiz, 'sessaoaaaa'), [], 'quem mandou não recebe o próprio recado')
    const paraB = R.pendentes(raiz, 'sessaobbbb')
    assert.equal(paraB.length, 2, 'o direto e o de todos, os dois chegam')

    R.marcarEntregue(raiz, 'sessaobbbb', [r1.id])
    const depois = R.pendentes(raiz, 'sessaobbbb')
    assert.deepEqual(depois.map((x) => x.id), [r2.id], 'só o já entregue some da caixa, o resto continua')

    const l = R.log(raiz, 10)
    assert.equal(l.length, 2)
    assert.equal(l[0].id, r2.id, 'o log vem do mais recente para o mais antigo')

    assert.match(R.textoDoRecado(r1), /vou mexer num arquivo seu/, 'o rótulo do tipo entra na renderização')
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

/* --- CC-134: a agregação que o painel faz em /api/recados ---

   A rota junta o log de vários projetos e adiciona o campo `projeto` a cada
   linha, ordenado do mais recente para o mais antigo. É lógica pequena o
   bastante para não merecer função própria em `web.mjs` — mas pequena não é
   sinônimo de óbvia: reproduzida aqui, contra dois projetos de mentira, para
   garantir que a ordenação e o campo `projeto` não se percam numa próxima
   edição daquele arquivo. */
{
  const R = await import('./src/recados.mjs')
  const p1 = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-recados-p1-'))
  const p2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-recados-p2-'))
  try {
    R.enviar(p1, { de: 'a', para: 'todos', tipo: 'aviso', texto: 'do projeto um' })
    await new Promise((r) => { setTimeout(r, 5) })
    R.enviar(p2, { de: 'b', para: 'todos', tipo: 'aviso', texto: 'do projeto dois' })

    const agregado = [
      ...R.log(p1, 300).map((r) => ({ ...r, projeto: 'p1' })),
      ...R.log(p2, 300).map((r) => ({ ...r, projeto: 'p2' })),
    ].sort((a, b) => b.em - a.em)

    assert.equal(agregado.length, 2)
    assert.equal(agregado[0].projeto, 'p2', 'o mais recente vem primeiro, entre projetos diferentes')
    assert.equal(agregado[1].projeto, 'p1')
  } finally {
    fs.rmSync(p1, { recursive: true, force: true })
    fs.rmSync(p2, { recursive: true, force: true })
  }
}

const oc = await import('./src/opencode.mjs')

// heurística de viabilidade (réplica simplificada da tabela da skill)
assert.equal(oc.viavel('cria um componente boilerplate simples', { linhasEsperadas: 10 }), 'ALTA')
assert.equal(oc.viavel('ajusta validação', { linhasEsperadas: 35 }), 'MEDIA')
assert.equal(oc.viavel('reescreve o módulo inteiro', { linhasEsperadas: 5 }), 'BAIXA') // palavra-chave vence linha curta
assert.equal(oc.viavel('nova função', { linhasEsperadas: 80 }), 'BAIXA')

const tmpOc = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-opencode-teste-'))

// verificação pós-hoc: arquivo válido, quebrado, ausente, extensão sem verificador
const arquivoValido = path.join(tmpOc, 'ok.mjs')
fs.writeFileSync(arquivoValido, 'export const x = 1\n')
assert.equal(oc.verificar(arquivoValido).ok, true)

const arquivoQuebrado = path.join(tmpOc, 'quebrado.mjs')
fs.writeFileSync(arquivoQuebrado, 'export const x = (\n') // sintaxe inválida de propósito
assert.equal(oc.verificar(arquivoQuebrado).ok, false)

assert.equal(oc.verificar(path.join(tmpOc, 'nao-existe.mjs')).ok, false)

const arquivoCss = path.join(tmpOc, 'estilo.css')
fs.writeFileSync(arquivoCss, 'body { color: red; }\n')
assert.equal(oc.verificar(arquivoCss).ok, true) // sem verificador pra CSS: passa sem fingir que checou

// leitura de eventos: filtra tool_use sem jq, ignora linha quebrada/irrelevante
const logFake = path.join(tmpOc, 'fake.jsonl')
fs.writeFileSync(logFake, [
  JSON.stringify({ type: 'tool_use', part: { tool: 'write', state: { input: { filePath: 'a.mjs' } } } }),
  'linha que não é json',
  JSON.stringify({ type: 'outro_evento' }),
  JSON.stringify({ type: 'tool_use', part: { tool: 'edit', state: { input: { filePath: 'b.mjs' } } } }),
].join('\n'))
const eventosOc = oc.lerEventos(logFake)
assert.equal(eventosOc.length, 2)
assert.deepEqual(eventosOc.map((e) => e.arquivo), ['a.mjs', 'b.mjs'])

/* --- CC-147: o agy entra pelo mesmo cano do opencode ---

   O que muda de um agente para o outro é o binário, os argumentos e o formato
   da saída. O formato abaixo foi COPIADO de uma execução real do agy em 18/08,
   não inventado: inventar o formato provaria só que eu sei ler o que eu mesmo
   escrevi. */
{
  assert.deepEqual(Object.keys(oc.AGENTES), ['opencode', 'agy'])
  assert.equal(oc.AGENTES.agy.aceitaModelo, false,
    'o agy escolhe o modelo pela conta logada; passar --model com nome que ele não conhece derruba a chamada')
  assert.ok(oc.AGENTES.agy.args('diga oi').includes('stream-json'),
    'é o formato em fluxo que deixa acompanhar a tarefa enquanto ela roda')

  const logAgy = path.join(tmpOc, 'agy.jsonl')
  fs.writeFileSync(logAgy, [
    JSON.stringify({ event: 'init', conversation_id: 'x', init: { cwd: '/p' } }),
    JSON.stringify({ event: 'step_update', step_update: { step_type: 'tool_use', tool_name: 'view_file' } }),
    JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'dele' } }),
    JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'gado' } }),
    JSON.stringify({
      event: 'result',
      result: {
        status: 'SUCCESS',
        response: 'delegado\n',
        duration_seconds: 2.5,
        usage: { input_tokens: 14712, output_tokens: 51, total_tokens: 14763 },
      },
    }),
  ].join('\n'))

  assert.equal(oc.lerResposta(logAgy), 'delegado\n',
    'o evento final traz a resposta inteira, e ele vence os pedaços: somar os dois duplicaria o texto')
  assert.deepEqual(oc.lerEventos(logAgy).map((e) => e.tool), ['view_file'],
    'o passo de ferramenta do agy vira o mesmo evento que o do opencode')

  const custo = oc.lerCusto(logAgy)
  assert.equal(custo.total, 14763)
  assert.equal(custo.segundos, 2.5)
  assert.equal(oc.lerCusto(logFake), null,
    'o opencode não informa gasto, e null é a resposta honesta: zero diria que foi de graça')

  /* Resposta ainda no meio: sem o evento final, os pedaços são o que existe. É
     assim que a tela mostra a resposta crescendo enquanto a tarefa roda. */
  const meio = path.join(tmpOc, 'agy-meio.jsonl')
  fs.writeFileSync(meio, [
    JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'meta' } }),
    JSON.stringify({ event: 'step_update', step_update: { step_type: 'agent_response', text_delta: 'de' } }),
  ].join('\n'))
  assert.equal(oc.lerResposta(meio), 'metade')

  // nome de agente desconhecido cai no padrão, nunca vira comando
  assert.doesNotThrow(() => oc.dispararTarefa('x', { agente: 'rm -rf /', binario: process.execPath }))
}

// disparo nunca lança, mesmo com binário inexistente — falha aberta (o erro
// real sai async no evento 'error', não trava nem derruba quem chamou)
assert.doesNotThrow(() => oc.dispararTarefa('tarefa qualquer', { binario: 'este-binario-nao-existe-de-jeito-nenhum' }))

// disparo não pode bloquear esperando o processo terminar
const antesDisparo = Date.now()
const rDisparo = oc.dispararTarefa('prompt de teste', { binario: process.execPath })
assert.ok(Date.now() - antesDisparo < 1000, 'dispararTarefa não pode bloquear esperando o processo terminar')
assert.equal(rDisparo.ok, true)
assert.ok(fs.existsSync(rDisparo.logFile), 'log do disparo não foi criado')

fs.rmSync(tmpOc, { recursive: true, force: true })

// --- CC-36: lerResposta, promptEnriquecimento, enriquecerTodos ---
{
  const tmpOc2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-opencode-cc36-'))

  // lerResposta: schema real confirmado com chamada de verdade em 13/08
  // ({"type":"text","part":{"type":"text","text":"..."}}), concatena chunks,
  // ignora tudo o mais (tool_use, step_start, linha quebrada)
  const logResposta = path.join(tmpOc2, 'resposta.jsonl')
  fs.writeFileSync(logResposta, [
    JSON.stringify({ type: 'step_start', part: { type: 'step-start' } }),
    JSON.stringify({ type: 'text', part: { type: 'text', text: 'ola ' } }),
    'linha quebrada, nao e json',
    JSON.stringify({ type: 'tool_use', part: { tool: 'read' } }),
    JSON.stringify({ type: 'text', part: { type: 'text', text: 'mundo' } }),
  ].join('\n'))
  assert.equal(oc.lerResposta(logResposta), 'ola mundo')
  assert.equal(oc.lerResposta(path.join(tmpOc2, 'nao-existe.jsonl')), '')

  // promptEnriquecimento: numera as tarefas, pede JSON, avisa da falta de acesso a arquivo
  const prompt = oc.promptEnriquecimento(['fazer a coisa', 'fazer outra coisa'])
  assert.ok(prompt.includes('1. fazer a coisa') && prompt.includes('2. fazer outra coisa'))
  assert.ok(/n[ãa]o tem acesso/i.test(prompt), 'tem que avisar que roda em pasta neutra, sem acesso real')

  // enriquecerTodos, ponta a ponta: binario falso (.cmd) que devolve o schema
  // real fixado acima, sem chamar o opencode de verdade
  const fixture = path.join(tmpOc2, 'fixture.jsonl')
  fs.writeFileSync(fixture, [
    JSON.stringify({ type: 'text', part: { type: 'text', text: '{"1": {"titulo": "Corrigir X", "resumo": "resumo aqui", "arquivo": "src/x.mjs"}}' } }),
  ].join('\n'))
  /* O binário falso precisa existir nos dois mundos: em Windows o disparo passa
     por `cmd /c` e o alvo tem que ser `.cmd`; em Linux e macOS é executado
     direto, então é script com shebang e bit de execução. Antes só havia a
     versão `.cmd`, e este bloco simplesmente não rodava fora do Windows. */
  const fakeBin = path.join(tmpOc2, plat.ehWindows ? 'fake-opencode.cmd' : 'fake-opencode.sh')
  if (plat.ehWindows) {
    fs.writeFileSync(fakeBin, `@echo off\r\ntype "${fixture}"\r\n`)
  } else {
    fs.writeFileSync(fakeBin, `#!/bin/sh\ncat "${fixture}"\n`)
    fs.chmodSync(fakeBin, 0o755)
  }

  const explicacoes = await oc.enriquecerTodos(['corrigir o bug X'], {
    binario: fakeBin, esperarMs: 5000, intervaloMs: 100,
  })
  assert.deepEqual(explicacoes, {
    'corrigir o bug X': { titulo: 'Corrigir X', resumo: 'resumo aqui', arquivo: 'src/x.mjs' },
  })

  // lista vazia não dispara nada
  assert.deepEqual(await oc.enriquecerTodos([]), {})

  // resposta ilegível (json quebrado) não é gravada — melhor sem que com erro
  const fixtureRuim = path.join(tmpOc2, 'fixture-ruim.jsonl')
  fs.writeFileSync(fixtureRuim, JSON.stringify({ type: 'text', part: { type: 'text', text: 'isto não é json' } }))
  const fakeBinRuim = path.join(tmpOc2, 'fake-ruim.cmd')
  fs.writeFileSync(fakeBinRuim, `@echo off\r\ntype "${fixtureRuim}"\r\n`)
  assert.deepEqual(await oc.enriquecerTodos(['tarefa'], { binario: fakeBinRuim, esperarMs: 5000, intervaloMs: 100 }), {})

  fs.rmSync(tmpOc2, { recursive: true, force: true })
}

// --- cockpit: "onde eu mexo agora" ---
const ck = await import('./src/cockpit.mjs')

// a ordem das razões É a regra de negócio: blocker (escrito pelo agente) ganha de tudo
const jobCom = (extra) => ({ project: 'p', id: 'x', subject: 's', todos: [], idleMs: 1000, ...extra })
assert.equal(ck.motivoDe(jobCom({ blockers: ['sem credencial'], status: 'failed' })).peso, 5)
assert.match(ck.motivoDe(jobCom({ blockers: ['sem credencial'] })).frase, /sem credencial/)
assert.equal(ck.motivoDe(jobCom({ status: 'failed' })).peso, 4)
assert.equal(ck.motivoDe(jobCom({ status: 'working', stale: true })).peso, 4)
assert.equal(ck.motivoDe(jobCom({ status: 'waiting' })).peso, 3)
assert.equal(ck.motivoDe(jobCom({ status: 'done', entregueEmAberto: true })).peso, 2)
assert.equal(ck.motivoDe(jobCom({ status: 'working' })).peso, 1)
assert.equal(ck.motivoDe(jobCom({ status: 'done' })).peso, 0)

// projeto com blocker vem antes de projeto com falha; tudo pronto fica por último
const ordenado = ck.porProjeto([
  jobCom({ project: 'tranquilo', status: 'done' }),
  jobCom({ project: 'falhou', status: 'failed' }),
  jobCom({ project: 'travado', blockers: ['banco fora do ar'] }),
  jobCom({ project: 'rodando', status: 'working' }),
])
assert.deepEqual(ordenado.map((p) => p.projeto), ['travado', 'falhou', 'rodando', 'tranquilo'])
assert.equal(ordenado[ordenado.length - 1].projeto, 'tranquilo', 'projeto sem urgência tem que ficar por último')

// empate no peso desempata pelo que está assim há mais tempo — o que apodrece primeiro sobe
const empate = ck.porProjeto([
  jobCom({ project: 'recente', status: 'waiting', idleMs: 60_000 }),
  jobCom({ project: 'esquecido', status: 'waiting', idleMs: 4 * 3600_000 }),
])
assert.deepEqual(empate.map((p) => p.projeto), ['esquecido', 'recente'])

// o peso do projeto é o do agente MAIS urgente, não a média nem o primeiro da lista
const misto = ck.porProjeto([
  jobCom({ project: 'p', id: 'a', status: 'done' }),
  jobCom({ project: 'p', id: 'b', blockers: ['travou aqui'] }),
])
assert.equal(misto[0].peso, 5)
assert.equal(misto[0].esperando.length, 1, 'só o agente que precisa de atenção entra em "esperando"')
assert.equal(misto[0].esperando[0].id, 'b')
assert.equal(misto[0].agentes, 2)

// última atividade sai de updatedAt (de graça) — nunca do tempo.mjs, que é caro
assert.equal(ck.porProjeto([
  jobCom({ project: 'p', updatedAt: 100 }),
  jobCom({ project: 'p', updatedAt: 900 }),
])[0].ultimaAtividade, 900)

// CC-33: sem visita registrada, nunca inventar data — em é null e sem resumo
assert.deepEqual(ck.porProjeto([jobCom({ project: 'p' })])[0].desdeVisita, { em: null, resumo: null })
// com visita, o resumo sai do marcosDe injetado — nunca importado direto,
// pra este módulo continuar testável sem tocar disco
const comVisita = ck.porProjeto([jobCom({ project: 'p' })], {
  visitas: { p: 500 },
  marcosDe: (projeto, { desde }) => (projeto === 'p' && desde === 500
    ? [{ em: 600, tipo: 'todo' }, { em: 700, tipo: 'todo' }, { em: 800, tipo: 'agente' }]
    : []),
})[0].desdeVisita
assert.equal(comVisita.em, 500)
assert.equal(comVisita.resumo, '2 tarefa(s) fechada(s) · 1 agente(s) novo(s)')
// visita sem marco novo desde então: em existe, resumo não
assert.deepEqual(
  ck.porProjeto([jobCom({ project: 'q' })], { visitas: { q: 999 }, marcosDe: () => [] })[0].desdeVisita,
  { em: 999, resumo: null },
)

// a nota segue a precedência do CC-17: o status do agente vence o pedido do Felipe
assert.equal(ck.notaDe({ detail: 'rodando testes', lastPrompt: 'conserta isso' }).tipo, 'status')
assert.equal(ck.notaDe({ lastPrompt: 'conserta isso' }).tipo, 'pedido')
assert.equal(ck.notaDe({ blockers: ['x'], detail: 'y' }).tipo, 'bloqueio')
assert.equal(ck.notaDe({ stale: true, blockers: ['x'] }).tipo, 'stale')
assert.equal(ck.notaDe({}), null)

// --- rotinas: comparação e travas, sem escrever nada ---
const rt = await import('./src/rotinas.mjs')
const estRotinas = rt.estado()
assert.ok(Array.isArray(estRotinas.globais), 'estado() devolve a lista de rotinas globais')
for (const p of estRotinas.projetos) {
  for (const r of p.rotinas) {
    assert.ok(['igual', 'divergente', 'propria'].includes(r.situacao), `situação inesperada: ${r.situacao}`)
    // divergente sem contagem seria o pior dos mundos: acusa o problema e não
    // diz o tamanho dele, então o Felipe não sabe se vale abrir
    if (r.situacao === 'divergente') assert.ok(r.diferencas > 0, `${p.projeto}/${r.nome}: divergente com 0 diferenças`)
    if (r.situacao === 'igual') assert.equal(r.diferencas, 0)
  }
}

// As duas escritas só aceitam .md simples dentro de projeto conhecido. Sem
// isso, um nome vindo do navegador escreveria em qualquer lugar do disco.
const projetoReal = estRotinas.projetos[0]?.dir || process.cwd()
assert.throws(() => rt.sincronizar(projetoReal, '../../evil.md'), /inválido/, 'aceitou subir de pasta no nome')
assert.throws(() => rt.sincronizar(projetoReal, 'x.txt'), /inválido/, 'aceitou arquivo que não é .md')
assert.throws(() => rt.remover('C:\\Windows', 'commit-now.md'), /fora da base/, 'aceitou pasta fora da base')
// caminho legítimo com barra normal (é como o navegador manda) não pode ser
// recusado: comparar como texto cru rejeitava, `path.resolve` conserta
if (estRotinas.projetos.length) {
  assert.throws(
    () => rt.sincronizar(projetoReal.replace(/\\/g, '/'), 'nao-existe-na-global.md'),
    /não existe rotina global/,
    'projeto legítimo com barra normal foi recusado como se fosse de fora',
  )
}

// --- sinais (CC-41): pura lógica, mensagens sintéticas, sem tocar disco ---
{
  const { sinaisDe, _internals: si } = await import('./src/sinais.mjs')
  const M = 60_000
  const msg = (texto, em) => ({ texto, em })

  // 3 em 6min dispara; 3 em 20min não
  assert.equal(sinaisDe([msg('a', 0), msg('b', 2 * M), msg('c', 5 * M)], { agora: 5 * M }).rajada, true)
  assert.equal(sinaisDe([msg('a', 0), msg('b', 10 * M), msg('c', 20 * M)], { agora: 20 * M }).rajada, false)

  // reenvio em <5min substitui, não soma — 2 mensagens "rápidas" que na
  // verdade são a mesma intenção reescrita não podem contar como rajada
  assert.equal(
    sinaisDe([msg('sobe o servidor', 0), msg('sobe o dev server por favor', 2 * M)], { agora: 2 * M }).rajada,
    false, 'duas mensagens em <5min contam como uma só (substituição)',
  )

  // repetição: sobreposição alta de palavras de 4+ letras dispara
  assert.equal(
    sinaisDe([
      msg('conserta o bug do login que trava no mobile', 0),
      msg('trabalha em outra coisa agora', 30 * M),
      msg('o bug do login ainda trava no mobile, não conseguiu resolver ainda?', 60 * M),
    ], { agora: 60 * M }).repeticao,
    true,
  )
  // mensagens sem nada em comum não disparam falso positivo
  assert.equal(
    sinaisDe([msg('sobe o servidor', 0), msg('qual o preço do dólar hoje', 60 * M)], { agora: 60 * M }).repeticao,
    false,
  )

  // silêncio: só depois da janela de 10min sem mensagem
  assert.equal(sinaisDe([msg('a', 0)], { agora: 5 * M }).silencio, false)
  assert.equal(sinaisDe([msg('a', 0)], { agora: 15 * M }).silencio, true)

  // sem mensagem nenhuma: nada dispara, sem lançar
  assert.deepEqual(sinaisDe([], { agora: Date.now() }), { rajada: false, repeticao: false, silencio: false })

  // isMeta e afins nunca chegam aqui — filtro é em transcript.mjs (humanText),
  // sinais.mjs só confia no que recebeu
  assert.equal(si.sobreposicao(new Set(), new Set(['x'])), 0)
}

// --- remote control: dispara claude --remote-control, sem chamar o binario real.
// Só cobre o caminho Windows de verdade (é a única máquina verificada); o
// caminho tmux (Linux/VPS) exige tmux instalado, então só roda quando existe.
{
  const rc = await import('./src/remotecontrol.mjs')
  const { ehWindows } = await import('./src/platform.mjs')
  const tmpRc = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-remote-teste-'))

  // pasta que nao existe: falha aberta, sem lancar
  const semPasta = await rc.ligar('projeto-x', path.join(tmpRc, 'nao-existe'))
  assert.equal(semPasta.ok, false)

  if (ehWindows) {
    // binario fake que fica vivo por alguns segundos: um binario que sai na
    // hora (node com flag desconhecida, por exemplo) deixaria o teste instavel
    // -- o processo podia morrer antes da checagem de "ja ligado" rodar
    const fakeBin = path.join(tmpRc, 'fake-claude.cmd')
    fs.writeFileSync(fakeBin, '@echo off\r\ntimeout /t 5 /nobreak >nul\r\n')

    // disparo nao pode bloquear, mesmo com binario que fica vivo por segundos
    const antes = Date.now()
    const r1 = await rc.ligar('projeto-teste', tmpRc, { binario: fakeBin })
    assert.ok(Date.now() - antes < 1000, 'ligar nao pode bloquear esperando o processo terminar')
    assert.equal(r1.ok, true)
    assert.equal(r1.ja, false)

    // clicar duas vezes no mesmo projeto nao abre sessao duplicada
    const r2 = await rc.ligar('projeto-teste', tmpRc, { binario: fakeBin })
    assert.equal(r2.ja, true, 'segunda chamada no mesmo projeto tem que reconhecer a sessao ja ligada')
    assert.equal(r2.pid, r1.pid)

    // aparece no estado()
    assert.ok('projeto-teste' in await rc.estado())

    // desligar mata a arvore de processos e some do estado
    const d = await rc.desligar('projeto-teste')
    assert.equal(d.ok, true)
    assert.equal(d.ja, true)
    assert.ok(!('projeto-teste' in await rc.estado()))

    // desligar de novo (ja desligado) nao lanca, so reporta
    assert.deepEqual(await rc.desligar('projeto-teste'), { ok: true, ja: false })

    // sem sessao: link nao lanca, so reporta erro
    const semLink = await rc.link('projeto-teste')
    assert.equal(semLink.ok, false)
  }

  fs.rmSync(tmpRc, { recursive: true, force: true })
}

// --- gitlog (CC-35): usa este próprio repositório como fixture — leitura
// pura, sem risco. O achado real ao testar ao vivo: sem `-C <cwd>`, o `git
// log` roda sempre na pasta onde o SERVIDOR foi iniciado, não na do projeto
// pedido — as duas primeiras provas devolveram o histórico deste repo mesmo
// pedindo outro. Este teste não pega isso sozinho (roda daqui mesmo por
// acaso), mas trava qualquer regressão na forma do retorno.
{
  const { commitsDesde } = await import('./src/gitlog.mjs')
  const aqui = await commitsDesde(process.cwd(), 0)
  assert.equal(aqui.ok, true)
  assert.ok(aqui.commits.length > 0, 'este repositório tem commit — se vier vazio, o parser quebrou')
  const c0 = aqui.commits[0]
  assert.ok(c0.hash && c0.em > 0 && c0.assunto && Array.isArray(c0.arquivos))
  assert.ok(c0.arquivos.length > 0, 'commit real sempre toca arquivo — numstat não foi parseado')

  const semGit = await commitsDesde(os.tmpdir(), 0)
  assert.equal(semGit.ok, false, 'pasta fora de qualquer repo git tem que reportar falha, não lista vazia')

  assert.deepEqual(await commitsDesde('', 0), { ok: false, motivo: 'sem caminho do projeto' })
}

// --- digest (CC-24): este próprio projeto, que tem diário, git e histórico reais ---
{
  const { digestDe, digestTodos } = await import('./src/digest.mjs')
  const aqui = await digestDe(process.cwd(), 'proj_controlcenter', { desde: 0 })
  assert.equal(aqui.projeto, 'proj_controlcenter')
  assert.equal(aqui.gitOk, true)
  assert.ok(aqui.commits.length > 0)
  assert.ok(aqui.diario.length > 0, 'este projeto tem docs/diario — silêncio aqui indica que o leitor quebrou')
  assert.equal(aqui.silencio, false)

  // desde no futuro: nada de novo em lugar nenhum, e silencio tem que dizer isso
  const vazio = await digestDe(process.cwd(), 'proj_controlcenter', { desde: Date.now() + 1e9 })
  assert.equal(vazio.silencio, true)
  assert.equal(vazio.commits.length, 0)
  assert.equal(vazio.diario.length, 0)

  // digestTodos varre e SEPARA silenciosos, nunca trunca sem dizer o tamanho
  const todos = await digestTodos({ desde: Date.now() + 1e9, base: path.dirname(process.cwd()) })
  assert.ok(todos.silenciosos >= 0 && todos.projetos.length === 0,
    'janela no futuro: todo mundo silencioso, projetos filtrado vazio')
  assert.equal(todos.silenciosos + todos.projetos.length <= todos.totalVarrido, true)
}

/* --- padrão de resposta: medir o vício que ele apontou em 15/08 --- */
{
  const E = await import('./src/estilo.mjs')

  // o texto real que ele criticou, com os dois parágrafos de autodefesa
  const ruim = [
    'As rotas viajam agora.',
    'Não inventei canal novo, aproveitei o que já existia.',
    'Vale lembrar que o quadro do inovallbond passa de 60 KB.',
    'Falta ligar isso no guarda.',
  ].join('\n\n')
  assert.equal(E.medir(ruim).autodefesa, 2)
  assert.equal(E.medir(ruim).paragrafos, 4)

  // e o mesmo conteúdo no padrão: nada a acusar
  assert.equal(E.medir('As rotas que você marca no PC aparecem para mim sem commit.\n\nFalta ligar no guarda. Preciso de um número seu.').autodefesa, 0)

  /* Bloco de código é trabalho, não prosa: contá-lo inflaria toda resposta que
     mexeu em arquivo, e o número viraria ruído. */
  const comCodigo = 'Pronto.\n\n```js\nnão inventei nada\nvale lembrar disso\n```\n'
  assert.equal(E.medir(comCodigo).autodefesa, 0, 'contou código como prosa')

  // "não é" e "não foi" ficam de fora da lista: são comuns em frase legítima
  assert.equal(E.medir('Não é possível medir isso daqui.').autodefesa, 0)
  assert.equal(E.medir('').autodefesa, 0)

  // a última resposta sai do transcrito, e tool_use não é prosa
  {
    const arq = path.join(os.tmpdir(), `cc-est-${Date.now()}.jsonl`)
    fs.writeFileSync(arq, [
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'resposta antiga' }] } }),
      JSON.stringify({ type: 'user', message: { content: 'e agora?' } }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }, { type: 'text', text: 'a última' }] } }),
    ].join('\n'))
    try {
      assert.equal(E.ultimaResposta(arq), 'a última')
    } finally { fs.rmSync(arq, { force: true }) }
  }

  // sem passado para comparar, a tendência é null: 0% de melhora seria invenção
  {
    const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-est-'))
    const antes = process.env.CC_HOME
    process.env.CC_HOME = casa
    try {
      const Ei = await import(`./src/estilo.mjs?casa=${encodeURIComponent(casa)}`)
      Ei.registrar(Ei.medir('uma resposta curta'))
      assert.equal(Ei.retrato().tendenciaPalavras, null)
      assert.ok(Ei.ARQUIVO_MEDIDAS().startsWith(casa), 'ia medir na casa de verdade')
    } finally {
      if (antes === undefined) delete process.env.CC_HOME
      else process.env.CC_HOME = antes
      fs.rmSync(casa, { recursive: true, force: true })
    }
  }
}

/* --- CC-67: `cc hooks install` — o gancho nasce com o projeto ---
   Roda em casa temporária: escrever no settings.json de verdade num teste seria
   repetir o erro das notas, que o CC-53 acabou de fechar. */
{
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-hk-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  try {
    /* Um settings.json com hook DE TERCEIRO no mesmo evento. É o caso real: o
       do Felipe tem ~200 linhas e o pixel-agents registra em 11 eventos.
       Apagar isso sem avisar é o pior que este comando poderia fazer. */
    fs.writeFileSync(path.join(casa, 'settings.json'), JSON.stringify({
      model: 'opus',
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'node /outro/sistema/hook.js' }] }],
      },
    }, null, 2))

    const q = `?casa=${encodeURIComponent(casa)}`
    const R = await import(`./src/hooksRegistro.mjs${q}`)
    const { HOOKS } = await import(`./src/hooksCatalogo.mjs${q}`)
    assert.ok(R.SETTINGS_FILE.startsWith(casa), 'ia escrever no settings de verdade')

    // simulação não pode tocar no arquivo
    const antesDoTexto = fs.readFileSync(R.SETTINGS_FILE, 'utf8')
    R.instalar(HOOKS.filter((h) => h.implementado), { dryRun: true })
    assert.equal(fs.readFileSync(R.SETTINGS_FILE, 'utf8'), antesDoTexto, '--dry-run gravou')

    const r = R.instalar(HOOKS.filter((h) => h.implementado))
    assert.ok(r.ok && r.gravou)

    const depois = JSON.parse(fs.readFileSync(R.SETTINGS_FILE, 'utf8'))
    const todos = Object.values(depois.hooks).flat().flatMap((g) => g.hooks).map((h) => h.command)

    assert.ok(todos.some((c) => c.includes('/outro/sistema/hook.js')), 'APAGOU hook de terceiro')
    assert.equal(depois.model, 'opus', 'perdeu configuração que não era hook')
    assert.ok(todos.some((c) => c.includes('recados.mjs')), 'não registrou o hook de recados')
    // barra normal mesmo no Windows: barra invertida em JSON exige escape duplo,
    // e isso já quebrou o atalho do Desktop em silêncio
    assert.ok(!todos.some((c) => c.includes('\\')), 'usou barra invertida no caminho')

    // rodar de novo não duplica
    const r2 = R.instalar(HOOKS.filter((h) => h.implementado))
    assert.equal(r2.feitos.filter((f) => f.acao === 'registrado').length, 0, 'duplicou na segunda vez')

    assert.ok(fs.existsSync(`${R.SETTINGS_FILE}.bak`), 'não deixou cópia do anterior')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
  }
}

/* --- CC-69 e CC-72: o que cada hook faz, e o que roda contra o que é versionado --- */
{
  const { HOOKS, NIVEIS } = await import('./src/hooksCatalogo.mjs')

  // CC-69: o nível estava espalhado pelo código de cada hook; agora é declarado
  for (const h of HOOKS.filter((x) => x.implementado)) {
    assert.ok(NIVEIS[h.nivel], `${h.id} sem nível declarado`)
  }

  /* CC-232: o GRUPO também precisa existir, e o gate não olhava para isso.
     A tela de projetos percorre as chaves de `MODULOS`, e a rota de gravação
     recusa o que não está lá: um hook num grupo não declarado continua
     funcionando, mas fica fora do alcance dele para ligar ou desligar por
     projeto. Silencioso dos dois lados — nenhum erro, nenhuma linha na tela.
     Aconteceu com `reporte`, e só apareceu porque fui conferir na mão. */
  const { MODULOS: GRUPOS } = await import('./src/hooksCatalogo.mjs')
  const semGrupo = HOOKS.filter((h) => h.implementado && !GRUPOS[h.modulo])
  assert.deepEqual(
    semGrupo.map((h) => `${h.id} (grupo "${h.modulo}")`), [],
    'hook num grupo que não existe em MODULOS. Ele funciona, mas não aparece '
    + 'na tela de projetos e não pode ser desligado por projeto.',
  )
  /* Hook de `Stop` que devolve precisa da guarda de UMA volta.
     A regra antiga era "Stop nunca pode travar", e ela protegia do laço: exit 2
     ali devolve o texto ao modelo e o manda continuar. Mas o que evita o laço é
     `stop_hook_active`, não a etiqueta do nível — o `pergunta-guard` provou isso
     em 15/08, devolvendo uma vez e passando na volta seguinte.

     Então o gate passou a conferir o CÓDIGO em vez do rótulo. Hook de Stop que
     sai com exit 2 sem essa guarda é laço garantido, e isso continua barrado. */
  for (const h of HOOKS.filter((x) => x.evento === 'Stop' && x.implementado && x.script)) {
    let fonte = ''
    try { fonte = fs.readFileSync(path.join(import.meta.dirname, 'hooks', h.script), 'utf8') } catch {
      try { fonte = fs.readFileSync(path.join(import.meta.dirname, 'hooks', 'routia', h.script), 'utf8') } catch { continue }
    }
    if (!/process\.exit\(2\)/.test(fonte)) continue
    assert.match(fonte, /stop_hook_active/,
      `${h.id} devolve no Stop sem checar stop_hook_active: vira laço`)
  }

  // CC-72: cópia divergente é invisível, e é o formato das 22 rotinas velhas
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sync-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  try {
    const R = await import(`./src/hooksRegistro.mjs?casa=${encodeURIComponent(casa)}`)
    fs.mkdirSync(R.pastaInstalada(), { recursive: true })
    fs.writeFileSync(path.join(casa, 'settings.json'), '{}')

    const doRepo = path.join(R.pastaHooks(), 'routia', 'rota-guard.mjs')
    const instalado = path.join(R.pastaInstalada(), 'rota-guard.mjs')

    // igual, mas com CRLF: fim de linha não é diferença de conteúdo, e foi o
    // que enganou a comparação de rotinas no CC-42
    fs.writeFileSync(instalado, fs.readFileSync(doRepo, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'))
    const soRota = HOOKS.filter((h) => h.id === 'rota-guard')
    assert.equal(R.comparar(soRota)[0].estado, 'igual', 'CRLF virou divergência')

    fs.writeFileSync(instalado, '// versão velha, diferente\n')
    assert.equal(R.comparar(soRota)[0].estado, 'divergente')

    assert.equal(R.sincronizar(soRota, { dryRun: true })[0].acao, 'copiaria')
    assert.equal(fs.readFileSync(instalado, 'utf8'), '// versão velha, diferente\n', '--dry-run copiou')

    assert.equal(R.sincronizar(soRota)[0].acao, 'copiado')
    assert.equal(R.comparar(soRota)[0].estado, 'igual')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
  }
}

/* --- CC-86: o mapa de dependência sai do código, e nunca envelhece --- */
{
  const D = await import('./src/dependencias.mjs')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-dep-'))
  try {
    fs.mkdirSync(path.join(raiz, 'src'), { recursive: true })
    fs.mkdirSync(path.join(raiz, 'node_modules', 'pacote'), { recursive: true })
    const w = (p, c) => fs.writeFileSync(path.join(raiz, p), c)

    w('src/base.mjs', 'export const x = 1\n')
    w('src/meio.mjs', "import { x } from './base.mjs'\nexport const y = x\n")
    w('src/topo.mjs', "import { y } from './meio.mjs'\nimport fs from 'node:fs'\nexport default y\n")
    w('src/solto.mjs', 'export const nada = 0\n')
    // segundo dependente da base, para `maisUsados` não empatar com o ciclo:
    // com empate o desempate é a ordem do Map, e o teste viraria loteria
    w('src/outro.mjs', "import { x } from './base.mjs'\nexport const z = x\n")
    // pacote instalado não é problema nosso: ninguém "mexe" no react sem querer
    w('node_modules/pacote/index.js', "import './outro.js'\n")
    // ciclo de import EXISTE, e sem visitados a busca em largura não termina
    w('src/ciclo-a.mjs', "import './ciclo-b.mjs'\n")
    w('src/ciclo-b.mjs', "import './ciclo-a.mjs'\n")

    const g = D.mapear(raiz)
    assert.equal(g.arquivos, 7, 'varreu node_modules ou perdeu arquivo')

    // a pergunta direta
    assert.deepEqual(D.impactoDe(g, 'src/meio.mjs').diretos, ['src/topo.mjs'])

    /* A pergunta que importa é a transitiva: base é usada por meio, e meio por
       topo. Olhando um nível só, mexer em base pareceria seguro para topo. */
    const base = D.impactoDe(g, 'src/base.mjs')
    assert.deepEqual(base.diretos, ['src/meio.mjs', 'src/outro.mjs'])
    assert.deepEqual(base.todos, ['src/meio.mjs', 'src/outro.mjs', 'src/topo.mjs'], 'perdeu o impacto indireto')

    assert.deepEqual(D.impactoDe(g, 'src/solto.mjs').diretos, [], 'inventou dependente')
    assert.equal(D.impactoDe(g, 'src/nao-existe.mjs').existe, false)

    // ciclo não pode travar
    assert.deepEqual(D.impactoDe(g, 'src/ciclo-a.mjs').todos, ['src/ciclo-b.mjs'])

    assert.equal(D.maisUsados(g, 1)[0].arquivo, 'src/base.mjs')
    assert.match(D.aviso(g, 'src/solto.mjs'), /ninguém mais usa/)
    assert.match(D.aviso(g, 'src/base.mjs'), /3 contando os indiretos/)
  } finally { fs.rmSync(raiz, { recursive: true, force: true }) }

  /* Contra o projeto de verdade: o custo é o argumento inteiro de derivar em vez
     de manter à mão, então ele fica guardado. */
  const real = D.mapear(process.cwd())
  assert.ok(real.arquivos > 40 && real.ligacoes > 50)
  assert.ok(real.ms < 2000, `varredura lenta demais: ${real.ms}ms`)
}

/* --- CC-91: o cartão do framework confirma o que GRAVOU ---
   Ele trocou o modo duas vezes em 15/08, a tela confirmou, e o arquivo
   continuava o mesmo. O gate guarda as três peças do conserto. */
{
  const html = fs.readFileSync(path.join(process.cwd(), 'src', 'ui.html'), 'utf8')

  // 1. a confirmação relê do servidor em vez de repetir o que foi clicado
  assert.match(html, /CONFIRMA_FW/, 'sumiu a confirmação da troca de modo')
  /* A comparação virou `gravado === pedido` em 17/08, quando o mesmo seletor
     passou a escolher também PERFIL: comparar sempre com `conferido.modo` daria
     "erro" ao escolher uma profissão, porque o modo gravado é o base dela. O que
     o gate guarda é a regra, não a linha: relê do arquivo e compara com o que
     foi pedido. */
  assert.match(html, /gravado === pedido/, 'a confirmação parou de comparar pedido com arquivo')
  assert.match(html, /ehPerfil \? conferido\.perfil : conferido\.modo/,
    'a confirmação tem que olhar o campo certo: perfil quando foi perfil')
  assert.match(html, /fw-salvo ruim/, 'sumiu o aviso de gravação que falhou')

  /* 2. o autorizar NÃO pode voltar para perto do seletor: ele apertou por
     engano justamente por isso. O seletor fica no `seloFramework`, e o botão
     tem que estar dentro de `.fw-aut`, que é bloco próprio. */
  const i = html.indexOf('function seloFramework(')
  const corpo = html.slice(i, html.indexOf('\nfunction ', i + 10))
  assert.ok(corpo.includes('fw-aut'), 'o autorizar saiu do bloco próprio')
  const posSeletor = corpo.indexOf('class="fw-modo"')
  const posAut = corpo.indexOf('data-fw="autorizar"')
  assert.ok(posAut < posSeletor || corpo.slice(posSeletor, posAut).includes('fw-aut'),
    'o botão de autorizar voltou a ficar colado no seletor de modo')

  // 3. a confirmação do clique diz o que vai acontecer, não só "tem certeza?"
  assert.match(html, /vale at[ée] voc[êe] trocar de modo/, 'a confirmação parou de dizer o prazo')
  assert.match(html, /data-ajuda="Liberar escrita/, 'sumiu a explicação do "?" do autorizar')
}

/* --- Bancada: catálogo inteiro, cada camada rodando sozinha ---
   Decisão dele em 15/08. O risco de declarar sem implementar é a tela oferecer
   um botão que não faz nada — o gate guarda essa distinção. */
{
  const C = await import('./src/bancadaCatalogo.mjs')

  assert.ok(C.CAMADAS.length >= 17, `o catálogo encolheu: ${C.CAMADAS.length}`)

  const ids = C.CAMADAS.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length, 'id de camada repetido')

  for (const c of C.CAMADAS) {
    assert.ok(c.nome && c.explica && c.grupo, `camada incompleta: ${c.id}`)
    // a explicação é o que ele lê para decidir se liga: nome de ferramenta não basta
    assert.ok(c.explica.length > 40, `explicação curta demais em ${c.id}`)
    assert.equal(typeof c.aplicaA, 'function', `${c.id} sem aplicaA`)
    /* `implementada` tem que bater com a realidade: prometer execução que não
       existe é o pior defeito possível numa ferramenta de verificação. */
    assert.equal(c.implementada, typeof c.rodar === 'function', `${c.id} mente sobre estar implementada`)
  }

  const rodam = C.CAMADAS.filter((c) => c.implementada)
  assert.ok(rodam.length >= 4, 'as camadas que rodavam pararam de rodar')

  // grupos: `dado` e `dados` conviveram por engano, e a tela mostraria dois
  const grupos = [...new Set(C.CAMADAS.map((c) => c.grupo))]
  assert.ok(!(grupos.includes('dado') && grupos.includes('dados')), 'grupo duplicado no singular e no plural')

  // rodar uma declarada não pode fingir que rodou
  const B = await import('./src/bancada.mjs')
  const declarada = C.CAMADAS.find((c) => !c.implementada)
  const r = await B.rodar(process.cwd(), declarada.id)
  assert.ok(r.erro || r.naoImplementada, `${declarada.id} fingiu que rodou`)
}

/* --- CC-94: a prévia é para o telefone dele ---
   Sete prévias em dois dias saíram com fonte de tela larga, e ele teve que dar
   zoom em todas. O gate guarda o tamanho, que é a coisa fácil de perder. */
{
  const P = await import('./src/previa.mjs')

  const html = P.pagina({ titulo: 'teste', subtitulo: 'sub', corpo: '<p>oi</p>' })
  assert.match(html, /font:19px/, 'a prévia de leitura encolheu: ele lê no telefone, andando')
  assert.match(html, /width=device-width/, 'sem viewport, o telefone renderiza como desktop')
  assert.match(html, /text-size-adjust:100%/, 'sem isso o iOS remexe no tamanho ao girar a tela')
  assert.ok(html.includes('<h1>teste</h1>'), 'o título sumiu')

  /* O modo `layout` usa o CSS REAL: aqui fonte grande seria mentira, porque o
     que se quer provar é justamente como a tela fica. */
  const lay = P.pagina({ titulo: 't', corpo: '<p>x</p>', modo: 'layout' })
  assert.ok(!lay.includes('font:19px'), 'o modo layout aumentou a fonte e passou a mentir')
  assert.match(lay, /container-name:\s*painel/, 'o modo layout perdeu o container do painel')
  assert.match(lay, /--bg/, 'o modo layout não carregou o CSS do painel')

  // markdown reduzido: só o que ele escreve
  const md = P.deMarkdown('# T\n\n- um\n- dois\n\n> citado\n\n`code` e **forte**')
  assert.match(md, /<h1>T<\/h1>/)
  assert.match(md, /<li>um<\/li>/)
  assert.match(md, /<blockquote>citado<\/blockquote>/)
  assert.match(md, /<code>code<\/code>/)
  assert.match(md, /<b>forte<\/b>/)
  // e escapa o que não é markdown, senão um `<script>` num doc viraria script
  assert.match(P.deMarkdown('<script>x</script>'), /&lt;script&gt;/)
}

/* --- CC-87: toda tela responde uma pergunta, escrita no topo ---
   Regra 1 da frente. O gate guarda a REGRA, não o texto: se alguém acrescentar
   uma tela sem pergunta, ninguém notaria — foi assim que 11 das 15 ficaram
   mudas até 15/08. */
{
  const html = fs.readFileSync(path.join(process.cwd(), 'src', 'ui.html'), 'utf8')

  assert.match(html, /function cabecaDaTela\(/, 'sumiu o componente do topo de tela')

  // as telas já convertidas têm que continuar chamando
  // viewCockpit saiu da lista em 17/08: a vista morreu órfã no redesenho dos
  // cards e foi removida; quem responde pela aba é a viewTrabalho.
  for (const [fn, pergunta] of [
    ['viewMeu', 'O que depende de mim?'],
    ['viewGlossario', 'O que é isso mesmo?'],
    ['viewTrabalho', 'Em que pé está o trabalho?'],
  ]) {
    const i = html.indexOf(`function ${fn}(`)
    assert.ok(i > 0, `${fn} sumiu`)
    const corpo = html.slice(i, html.indexOf('\nfunction ', i + 10))
    assert.ok(corpo.includes('cabecaDaTela('), `${fn} não usa o topo padrão`)
    assert.ok(corpo.includes(pergunta), `${fn} perdeu a pergunta "${pergunta}"`)
  }

  /* Vista definida e nunca chamada é a classe de erro que deixou os controles
     do framework dois dias inalcançáveis no celular (17/08): o redesenho trocou
     a vista da aba e ninguém notou que a antiga, com o seletor de modo dentro,
     ficou sem porta. Contagem textual: a definição conta 1; qualquer chamada
     soma. */
  {
    const defs = [...html.matchAll(/function (view[A-Z]\w*)\(/g)].map((m) => m[1])
    const orfas = defs.filter((v) => html.split(`${v}(`).length - 1 <= 1)
    assert.deepEqual(orfas, [], `vista(s) sem porta de entrada: ${orfas.join(', ')}`)
  }

  /* A VPS é a que inaugurou o padrão, com nome próprio (`vps-veredito`) porque
     veio antes. Se ela deixar de ter veredito, a regra morreu na origem. */
  assert.match(html, /vps-veredito/, 'a aba VPS perdeu o veredito')

  // as cores do veredito são as mesmas dos estados, não inventadas
  for (const c of ['v-bom', 'v-atencao', 'v-ruim']) {
    assert.ok(html.includes(`.tela-cabeca.${c}`), `falta a cor ${c}`)
  }
}

/* --- CC-73: o painel não pode rolar de lado ---
   Não dá para medir layout sem navegador, e o Chrome desta VPS exige um token
   que o hook de segredo (com razão) não deixa ler. Então o que este teste
   guarda é a REGRA, não o pixel: as três peças que impedem o vazamento têm que
   continuar no arquivo. Se alguém remover uma, a barra horizontal volta e só
   apareceria num print meses depois — foi assim que ela viveu até 15/08. */
{
  const html = fs.readFileSync(path.join(process.cwd(), 'src', 'ui.html'), 'utf8')
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))

  assert.match(css, /#painel\s*{[^}]*overflow-x:\s*hidden/s, 'o #painel voltou a poder rolar de lado')
  assert.match(css, /\.rolagem\s*{[^}]*overflow-x:\s*auto/s, 'sumiu a caixa que segura conteúdo largo')
  assert.match(css, /@container[^{]*\(max-width:\s*640px\)/, 'sumiu o ajuste de tela estreita da faixa de módulos')

  // a tabela de tempo é o conteúdo largo conhecido, e tem que estar embrulhada
  const tabela = html.indexOf('t-linha t-head')
  assert.ok(tabela > 0)
  assert.ok(
    html.lastIndexOf('class="rolagem"', tabela) > tabela - 200,
    'a tabela de tempo saiu de dentro da .rolagem',
  )

  /* Breakpoint é `@container`, nunca `@media`: com a coluna de notas aberta a
     janela continua larga enquanto o painel encolhe, então media query não
     dispararia. Armadilha já registrada no CLAUDE.md. */
  // comentário é onde a regra está EXPLICADA, então sai antes da contagem
  const semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.equal(
    (semComentario.match(/@media[^{]*max-width/g) || []).length, 0,
    'entrou uma media query de largura: neste painel o breakpoint é @container',
  )
}

/* --- VPS: veredito, não valor ---
   A tela mostrava o que a máquina TEM e ele tinha que traduzir sozinho. Os
   limiares são regra de negócio e ficam provados aqui, não na página. */
{
  const V = await import('./src/vpsSaude.mjs')
  const agora = Date.parse('2026-08-15T12:00:00Z')
  const saudavel = {
    em: agora - 60e3,
    nginx: [{ serverName: 'site.com', tipo: 'proxy' }],
    docker: [{ nome: 'db', status: 'Up 3 days', portas: [] }],
    pm2: [{ nome: 'api', status: 'online', restarts: 0 }],
    ram: { usadoMB: 2000, totalMB: 8000 },
    disco: { usadoGB: 20, totalGB: 100 },
  }

  assert.equal(V.veredito(saudavel, agora).cor, 'bom')
  assert.equal(V.alertas(saudavel, agora).length, 0)
  // a frase responde a pergunta do topo, com números, sem jargão
  assert.match(V.veredito(saudavel, agora).frase, /Tudo no ar/)

  // container parado é grave: se servia um site, o site caiu
  const comParado = { ...saudavel, docker: [{ nome: 'db', status: 'Exited (1)' }] }
  assert.equal(V.veredito(comParado, agora).cor, 'ruim')

  /* Reiniciando sozinho é o aviso mais valioso desta tela: o programa aparece
     como "no ar" enquanto morre e volta em laço. */
  const emLaco = { ...saudavel, pm2: [{ nome: 'api', status: 'online', restarts: 12 }] }
  const vLaco = V.veredito(emLaco, agora)
  assert.equal(vLaco.cor, 'atencao')
  assert.match(vLaco.alertas[0].texto, /reiniciando sozinho/)

  // disco avisa antes da memória, e o motivo está no módulo
  assert.equal(V.veredito({ ...saudavel, disco: { usadoGB: 88, totalGB: 100 } }, agora).cor, 'atencao')
  assert.equal(V.veredito({ ...saudavel, ram: { usadoMB: 7100, totalMB: 8000 } }, agora).cor, 'bom')

  // leitura velha vira aviso: o que está na tela pode não valer mais
  assert.match(V.alertas({ ...saudavel, em: agora - 3 * 3600e3 }, agora)[0].texto, /antiga/)

  // grave sempre antes de aviso, senão o que importa fica embaixo
  const misto = { ...saudavel, docker: [{ nome: 'x', status: 'Exited' }], disco: { usadoGB: 90, totalGB: 100 } }
  assert.equal(V.alertas(misto, agora)[0].nivel, 'grave')

  // todo alerta diz o que fazer: alerta sem saída é o ruído que originou isto
  for (const a of V.alertas(misto, agora)) assert.ok(a.oQueFazer?.length > 10)

  // sem retrato nenhum não se inventa veredito
  assert.equal(V.veredito(null, agora).cor, 'neutro')

  // as três seções têm título em português e o nome técnico à parte
  for (const [, d] of Object.entries(V.SECOES)) {
    assert.ok(d.titulo && d.tecnico && d.ajuda && d.vazio)
    assert.ok(!/nginx|docker|pm2/i.test(d.titulo), `título ainda é nome de ferramenta: ${d.titulo}`)
  }
}

/* --- CC-48: as rotas viajam no pacote, e param de esperar commit --- */
{
  const F = await import('./src/federacao.mjs')
  const quadroDoPc = [{
    projeto: 'proj_controlcenter',
    ocupadas: [{ rota: 'backlog', id: '5805d6bb', ultimoSinal: 100, veredito: 'ativa', ruido: 'não pode viajar' }],
  }]

  const pacote = F.montarPacote({ maquina: { id: 'pc', nome: 'ALIENWARE-LIPE' }, rotas: quadroDoPc })
  assert.deepEqual(Object.keys(pacote.rotas[0].ocupadas[0]).sort(), ['id', 'rota', 'ultimoSinal', 'veredito'],
    'o pacote leva campo que não devia: o quadro do inovallbond passa de 60 KB')

  // ida e volta por JSON, como acontece de verdade na rede
  const v = F.validarPacote(JSON.parse(JSON.stringify(pacote)))
  assert.ok(v.ok)

  const daqui = [{ projeto: 'proj_controlcenter', ocupadas: [{ rota: 'sincronia', id: 'ff0d68b2', ultimoSinal: 900, veredito: 'ativa' }] }]
  const juntas = F.rotasDeTodos(daqui, [{ ...v.pacote, idade: 1200 }], 'VPS')
  assert.equal(juntas.proj_controlcenter.length, 2, 'a rota do outro lado sumiu')
  assert.deepEqual(juntas.proj_controlcenter.map((r) => r.origem), ['VPS', 'ALIENWARE-LIPE'])

  // mesma rota reportada dos dois lados fica uma só, com o sinal mais novo
  const repetida = F.rotasDeTodos(
    [{ projeto: 'p', ocupadas: [{ rota: 'x', id: 'aaaaaaaa', ultimoSinal: 10, veredito: 'orfa' }] }],
    [{ maquina: { nome: 'PC' }, rotas: [{ projeto: 'p', ocupadas: [{ rota: 'x', id: 'aaaaaaaa', ultimoSinal: 999, veredito: 'ativa' }] }] }],
    'VPS',
  )
  assert.equal(repetida.p.length, 1)
  assert.equal(repetida.p[0].veredito, 'ativa', 'o sinal mais novo tem que vencer')

  // sem federação, nada muda para quem trabalha sozinho
  assert.deepEqual(F.rotasDeTodos([], [], 'VPS'), {})
}

/* --- CC-49: rota ocupada por quem sumiu ---
   O caso de verdade: em 14/08 a rota `backlog` estava ocupada por uma sessão
   que tinha encerrado o dia mais de uma hora antes. O quadro mentia e o próximo
   agente respeitava a mentira. */
{
  const { rotasOcupadas, humanizar, SILENCIO_MS } = await import('./src/presenca.mjs')
  const agora = Date.parse('2026-08-15T12:00:00Z')
  const quadro = [
    '| `backlog` | 🔴 ocupada | 5805d6bb — CC-23 a CC-41 | 2026-08-13 |',
    '| `viva` | 🔴 ocupada | ff0d68b2 — trabalhando agora | 2026-08-15 |',
    '| `livre` | 🟢 livre | — | — |',
    // o quadro traz um exemplo de linha ocupada dentro de comentário HTML, e
    // ele casava todos os critérios: o painel acusava rota que nunca existiu
    '<!-- | `so-exemplo` | 🔴 ocupada | id da sessão | hoje | -->',
    '| `[exemplo] feature/checkout` | 🔴 ocupada | id da sessão | hoje |',
  ].join('\n')

  const sinais = new Map([
    ['5805d6bb', agora - 5 * 3600e3], // sumiu faz cinco horas
    ['ff0d68b2', agora - 60e3], // escreveu agora há pouco
  ])
  const r = rotasOcupadas(quadro, sinais, agora)

  assert.deepEqual(r.map((x) => x.rota), ['backlog', 'viva'], 'exemplo do quadro entrou como rota real')
  assert.equal(r[0].veredito, 'orfa')
  assert.equal(r[1].veredito, 'ativa')
  assert.equal(humanizar(r[0].silencioMs), '5h 0min')

  // sessão que esta máquina não conhece NÃO é órfã: quase sempre é da outra
  // máquina, e afirmar que sumiu seria inventar
  const semSinal = rotasOcupadas('| `x` | 🔴 ocupada | abcdef12 — outra máquina | hoje |', new Map(), agora)
  assert.equal(semSinal[0].veredito, 'desconhecida')

  // no limite exato ainda é ativa: o corte é folgado de propósito, porque
  // sessão longa passa dezenas de minutos numa tarefa só
  const noLimite = rotasOcupadas(quadro, new Map([['5805d6bb', agora - SILENCIO_MS]]), agora)
  assert.equal(noLimite[0].veredito, 'ativa')
}

/* --- CC-78: trocar o estado de uma rota pela tela ---
   O medo aqui é claro: o painel escreve num arquivo que agentes editam ao mesmo
   tempo. Por isso a edição é cirúrgica, e o teste prova que só a linha alvo
   muda. */
{
  const { alternarRota, corDaRota } = await import('./src/presenca.mjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rt-'))
  try {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true })
    const original = [
      '# Rotas',
      '',
      '| Rota | Status | Quem / o quê | Desde |',
      '|---|---|---|---|',
      '| `alfa` | 🟢 livre | — (fechou o CC-1 ontem) | — |',
      '| `beta` | 🔴 ocupada | 5805d6bb — trabalhando nisso | 2026-08-13 |',
      '',
      '## Tickets pendentes',
      'texto que não pode ser tocado',
      '',
    ].join('\n')
    fs.writeFileSync(path.join(dir, 'docs', 'ROTAS-ATIVAS.md'), original)

    const r = alternarRota(dir, 'alfa', { paraOcupada: true, marca: 'ff0d68b2', agora: new Date('2026-08-15') })
    assert.ok(r.ok)
    const depois = fs.readFileSync(path.join(dir, 'docs', 'ROTAS-ATIVAS.md'), 'utf8').split('\n')

    assert.ok(depois[4].includes('🔴 ocupada') && depois[4].includes('ff0d68b2'))
    // a OUTRA linha e o resto do arquivo não podem ter mudado: é o quadro que
    // outra sessão pode estar editando no mesmo segundo
    assert.equal(depois[5], '| `beta` | 🔴 ocupada | 5805d6bb — trabalhando nisso | 2026-08-13 |')
    assert.equal(depois[8], 'texto que não pode ser tocado')

    assert.ok(alternarRota(dir, 'beta', { paraOcupada: false }).ok)
    assert.match(fs.readFileSync(path.join(dir, 'docs', 'ROTAS-ATIVAS.md'), 'utf8'), /`beta` \| 🟢 livre/)

    assert.equal(alternarRota(dir, 'nao-existe', { paraOcupada: true }).ok, false)

    /* As três cores. O azul é derivado, nunca escrito: é o veredito do CC-49,
       ocupada por quem sumiu. Por isso ele não entra no ciclo do clique. */
    assert.equal(corDaRota('| `x` | 🟢 livre | — | — |'), 'livre')
    assert.equal(corDaRota('| `x` | 🔴 ocupada | a | b |', 'ativa'), 'ocupada')
    assert.equal(corDaRota('| `x` | 🔴 ocupada | a | b |', 'orfa'), 'orfa')
    assert.equal(corDaRota('| `x` | 🔴 ocupada | a | b |', 'desconhecida'), 'ocupada')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

/* --- CC-52: o buraco do Routia é sobreposição, não ausência de quadro --- */
{
  const { sobreposicoes } = await import('./src/routiaCobertura.mjs')
  const j = (ini, fim) => ({ inicio: ini, fim })
  // uma depois da outra: sessão única por vez, quadro não faria falta
  assert.equal(sobreposicoes([j(0, 10), j(20, 30), j(40, 50)]), 0)
  // a segunda começa antes de a primeira acabar: é aqui que duas sessões se pisam
  assert.equal(sobreposicoes([j(0, 100), j(50, 150)]), 1)
  // fora de ordem na entrada não pode mudar a conta
  assert.equal(sobreposicoes([j(50, 150), j(0, 100)]), 1)
  // três ao mesmo tempo contam duas sobreposições, não três
  assert.equal(sobreposicoes([j(0, 100), j(10, 90), j(20, 80)]), 2)
  assert.equal(sobreposicoes([]), 0)
  assert.equal(sobreposicoes([j(0, 10)]), 0)
}

/* --- CC-56: sessão interativa reporta o próprio estado ---
   O modo de uso que mais cresceu (celular, Remote Control) não cria job de
   background, e por isso `cc set` recusava com "sem job". Roda em casa
   temporária: o alvo aqui é ESCRITA de estado, e escrever no `.claude` real
   seria repetir o erro das notas. */
{
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-s56-'))
  const antesCasa = process.env.CC_HOME
  const antesId = process.env.CLAUDE_CODE_SESSION_ID
  const antesJob = process.env.CLAUDE_JOB_DIR
  const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  process.env.CC_HOME = casa
  process.env.CLAUDE_CODE_SESSION_ID = sessionId
  delete process.env.CLAUDE_JOB_DIR // é o que define "interativa"
  try {
    // um transcrito é a prova de que a sessão existe; sem ele, gravar é recusado
    const pastaProj = path.join(casa, 'projects', '-um-projeto')
    fs.mkdirSync(pastaProj, { recursive: true })
    fs.writeFileSync(
      path.join(pastaProj, `${sessionId}.jsonl`),
      `${JSON.stringify({ type: 'user', cwd: path.join(path.sep, 'x', 'proj'), message: { content: 'o pedido' } })}\n`,
    )

    const q = `?casa=${encodeURIComponent(casa)}`
    const jb = await import(`./src/jobs.mjs${q}`)
    const ss = await import(`./src/sessoes.mjs${q}`)

    assert.equal(jb.currentJobId(), sessionId, 'sem job, a identidade é a sessão')

    jb.writeMeta(sessionId, { subject: 'reportando do celular', todos: [{ text: 'fechar isto', done: false }] })

    // a regra de ouro: nada pode ter sido criado dentro de jobs/
    assert.ok(!fs.existsSync(path.join(casa, 'jobs')), 'escreveu dentro da casa do Claude Code')
    assert.ok(fs.existsSync(path.join(casa, 'control-center-sessoes', `${sessionId}.json`)))

    const vista = ss.readSessoes(Date.now()).find((s) => s.id === sessionId.slice(0, 8))
    assert.ok(vista, 'o painel não enxergou a sessão')
    assert.equal(vista.subject, 'reportando do celular', 'o painel não leu o estado reportado')

    // fechar to-do sem reenviar a lista funciona igual ao job de background
    assert.equal(jb.marcarTodo(sessionId, 'fechar isto', true).done, true)
    assert.equal(jb.marcarTodo(sessionId.slice(0, 8), 'fechar isto', false).done, false) // pelo id curto

    // id que não é job nem sessão é recusado, senão vira arquivo órfão pra sempre
    assert.throws(() => jb.writeMeta('nao-existe-mesmo', { subject: 'x' }), /não achei/)
  } finally {
    for (const [k, v] of [['CC_HOME', antesCasa], ['CLAUDE_CODE_SESSION_ID', antesId], ['CLAUDE_JOB_DIR', antesJob]]) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    fs.rmSync(casa, { recursive: true, force: true })
  }
}

/* --- daemon: caminhos, sem escrever nada ---
   Cada sistema sobe no login do seu jeito, e o teste tem que perguntar isso ao
   sistema em que está rodando. Antes exigia a pasta `Startup` sempre, o que só
   existe no Windows — mais um bloco que só rodava numa máquina. */
const dm = await import('./src/daemon.mjs')
const ESPERADO = {
  win32: { onde: /Startup/i, arquivo: 'control-center.vbs' },
  darwin: { onde: /LaunchAgents/i, arquivo: 'control-center.plist' },
  linux: { onde: /systemd[\\/]user/i, arquivo: 'control-center.service' },
}[plat.SO]
if (!ESPERADO) {
  console.log(`  (pulado: sistema ${plat.SO} não tem caminho de autostart previsto)`)
} else {
  assert.match(dm.vbsPath(), ESPERADO.onde, `autostart fora do lugar em ${plat.SO}`)
  assert.equal(path.basename(dm.vbsPath()), ESPERADO.arquivo)
}

/* --- CC-133: a entrevista CONDUZ, e é o encadeamento que prova isso ---

   O que estes asserts guardam não é "as perguntas existem": é que a resposta
   anterior muda o roteiro. Um teste que só contasse perguntas passaria com o
   formulário de antes, que é justamente o que ele não quis. */
{
  const E = await import('./src/entrevista.mjs')
  const responder = (estado, id, texto) => {
    const r = E.responder(estado, id, texto, { quando: '2026-08-17T00:00:00.000Z' })
    assert.ok(r.ok, `resposta recusada em "${id}": ${r.erro}`)
    return r.estado
  }

  // uma pergunta por vez, e a primeira é o que o projeto É
  const zero = {}
  assert.equal(E.proxima(zero).id, 'natureza')
  assert.equal(E.progresso(zero).feitas, 0)

  // o roteiro CRESCE: dizer "cliente" traz tela e acesso, que "biblioteca" não tem
  const cliente = responder(zero, 'natureza', 'cliente')
  const biblioteca = responder(zero, 'natureza', 'biblioteca')
  assert.ok(
    E.progresso(cliente).total > E.progresso(biblioteca).total,
    'projeto de cliente tem que perguntar mais que biblioteca — sem isso não é entrevista, é formulário',
  )
  assert.ok(E.aplicaveis(E.respostasDe(cliente)).some((p) => p.id === 'forma'))
  assert.ok(!E.aplicaveis(E.respostasDe(biblioteca)).some((p) => p.id === 'forma'))

  // o TEXTO da pergunta usa a resposta anterior
  const estudo = responder(zero, 'natureza', 'estudo')
  assert.match(E.proxima(estudo).pergunta, /pergunta este estudo responde/i)
  assert.match(E.proxima(cliente).pergunta, /entrega/i)

  // segunda camada: "login" só nasce depois de "acesso: sim", e nunca antes
  let e = responder(cliente, 'entrega', 'catálogo de imóveis')
  e = responder(e, 'quem', 'corretor na rua')
  e = responder(e, 'hoje', 'manda foto por whatsapp')
  const semBanco = responder(e, 'dado', 'nenhum')
  assert.ok(!E.aplicaveis(E.respostasDe(semBanco)).some((p) => p.id === 'acesso'),
    'sem dado guardado, perguntar sobre área restrita é ruído')
  e = responder(e, 'dado', 'banco')
  assert.ok(!E.aplicaveis(E.respostasDe(e)).some((p) => p.id === 'login'), 'login não pode existir antes de acesso')
  e = responder(e, 'acesso', 'sim')
  assert.ok(E.aplicaveis(E.respostasDe(e)).some((p) => p.id === 'login'), 'acesso "sim" tem que abrir a pergunta de login')

  // pergunta fora do roteiro é recusada, não gravada em silêncio
  assert.equal(E.responder(biblioteca, 'login', 'senha').ok, false)

  // desfazer leva junto o que só existia por causa da resposta apagada
  const comLogin = responder(e, 'login', 'provedor')
  const desfeito = E.desfazer(comLogin, 'acesso')
  assert.ok(desfeito.ok)
  assert.deepEqual(desfeito.orfas, ['login'], 'apagar "acesso" tem que levar "login" junto, senão ele fica órfão no resumo')
  assert.equal(E.respostasDe(desfeito.estado).login, undefined)

  // a entrevista alimenta o MVP de verdade: uma verdade só, não uma segunda
  let f = responder(comLogin, 'forma', 'painel')
  f = responder(f, 'primeiro', 'o corretor vê a lista dele')
  f = responder(f, 'pronto', '- corretor edita o imóvel\n- gerente vê tudo')
  assert.equal(f.mvp.nome, 'catálogo de imóveis')
  assert.deepEqual(f.mvp.criterios.map((c) => c.texto),
    ['o corretor vê a lista dele', 'corretor edita o imóvel', 'gerente vê tudo'],
    'lista em várias linhas vira vários critérios, e o marcador de lista sai fora')

  // e a fase de Definição abre no fim, que é o ponto de tudo isso
  f = responder(f, 'risco', 'imobiliária ver imóvel de outra')
  f = responder(f, 'verificacao', 'cliente')
  assert.equal(E.proxima(f), null, 'respondido tudo, não pode sobrar pergunta')
  assert.ok(f.entrevista.terminou, 'o fim é derivado da última resposta, não digitado')
  assert.ok(f.ferramentas.includes('rls'), 'site de cliente com login escolhe as sondas de dado')
  const fw = await import('./src/framework.mjs')
  assert.deepEqual(fw.avaliar('mvp-basico', { ...f, metodo: 'mvp-basico', fase: 'definicao' }).pendencias, [],
    'entrevista completa tem que abrir o portão da Definição — se não abre, ela não conduziu a lugar nenhum')

  // caminho "estudo" com o método padrão: grava nos dois lugares, senão trava
  const est = responder(estudo, 'entrega', 'vale a pena trocar o parser?')
  assert.equal(est.estudo.pergunta, 'vale a pena trocar o parser?')
  assert.equal(est.mvp.nome, 'vale a pena trocar o parser?')

  // resposta de várias linhas não pode quebrar a coluna do resumo
  for (const linha of E.resumo(f).split('\n').slice(1)) {
    assert.match(linha, /^ {2}\S/, `linha do resumo sem rótulo: ${JSON.stringify(linha)}`)
  }
}

/* --- CC-133, segunda fatia: o que a TELA recebe ---

   A fatia anterior provou o motor. Isto prova a camada que a página consome, e
   ela tem uma responsabilidade a mais: entregar a conversa JÁ DITA, que no
   terminal ficava na rolagem e na tela precisa ser dado.

   Importar `src/web.mjs` aqui vale por si: até hoje o gate nunca carregava esse
   arquivo, e um `await` no lugar errado dentro dele já derrubou o servidor
   inteiro com o `npm test` passando. */
{
  const W = await import('./src/web.mjs')
  const D = await import('./src/frameworkDisco.mjs')
  const E = await import('./src/entrevista.mjs')

  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-entrevista-'))
  try {
    assert.equal(W.retratoEntrevista(raiz).existe, false,
      'projeto sem framework não pode parecer entrevista vazia: é ausência, não zero')

    D.ligar(raiz)
    const zerado = W.retratoEntrevista(raiz)
    assert.equal(zerado.feitas, 0)
    assert.equal(zerado.proxima.id, 'natureza')
    assert.deepEqual(zerado.respondidas, [])
    assert.equal(zerado.roteiro, E.ROTEIRO.length,
      'o total do roteiro vai junto para a tela poder dizer que este projeto usa só parte dele')

    // duas respostas, uma por opção e uma por texto livre
    let e = E.responder(D.ler(raiz), 'natureza', 'cliente').estado
    e = E.responder(e, 'entrega', 'agenda da clínica').estado
    D.gravar(raiz, e)

    const r = W.retratoEntrevista(raiz)
    assert.equal(r.feitas, 2)
    assert.ok(r.total > r.feitas)
    assert.equal(r.respondidas.length, 2)
    assert.deepEqual(r.respondidas.map((x) => x.id), ['natureza', 'entrega'],
      'a ordem é a do roteiro, não a de gravação: é assim que ele relê a conversa')
    assert.equal(r.respondidas[0].texto, 'Site ou app para cliente',
      'opção escolhida chega na tela pelo RÓTULO, não pelo valor interno')
    assert.equal(r.respondidas[0].valor, 'cliente')
    assert.equal(r.respondidas[1].texto, 'agenda da clínica')

    assert.match(r.proxima.pergunta, /Quem usa isso/)
    assert.match(r.respondidas[1].pergunta, /O que ele entrega/,
      'a pergunta guardada na lista é a que foi de fato feita, com a natureza já respondida')

    /* Voltar atrás e trocar o ramo. A entrega SOBREVIVE (ela cabe em qualquer
       projeto), e é justamente por isso que este é o caso que importa: o texto
       da pergunta dela muda, e a lista precisa recalcular. Guardar a frase
       congelada faria a tela contar uma conversa que não aconteceu. */
    D.gravar(raiz, E.desfazer(D.ler(raiz), 'natureza').estado)
    const semNatureza = W.retratoEntrevista(raiz)
    assert.equal(semNatureza.proxima.id, 'natureza', 'a pergunta apagada volta a ser feita')
    assert.deepEqual(semNatureza.respondidas.map((x) => x.id), ['entrega'])

    D.gravar(raiz, E.responder(D.ler(raiz), 'natureza', 'estudo').estado)
    const curto = W.retratoEntrevista(raiz)
    assert.match(curto.respondidas[1].pergunta, /pergunta este estudo responde/i,
      'trocado o ramo, a pergunta já respondida é reescrita: é a prova de que o texto não fica congelado')
    assert.equal(curto.respondidas[1].texto, 'agenda da clínica', 'a resposta dele continua intacta')

    // o total encolhe com o ramo, e é por isso que a barra da tela nunca pode
    // ser contada sobre as 12 perguntas do arquivo
    assert.ok(curto.total < curto.roteiro,
      'projeto de estudo usa menos perguntas, e a tela precisa saber disso para não mostrar barra que anda para trás')
    assert.ok(curto.total < r.total, 'trocar de cliente para estudo tem que ENCOLHER o roteiro')
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

/* --- CC-143: o projeto nasce no padrão, e o padrão é o DELE ---

   O que estes asserts guardam é a diferença entre o botão e um `mkdir`: o
   repositório na raiz (a regra número 1 dele, que já custou 34 mil arquivos
   engolidos por um repositório de cima) e a regra que a limita, "não criar
   pasta vazia por simetria". */
{
  const N = await import('./src/novoProjeto.mjs')
  const D = await import('./src/frameworkDisco.mjs')
  const E = await import('./src/entrevista.mjs')

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-novoproj-'))
  try {
    // nome vira caminho de disco: recusar é mais barato que consertar depois
    assert.ok(N.validarNome('app agenda'), 'espaço no nome tem que ser recusado')
    assert.ok(N.validarNome('projeto/../fuga'), 'barra e subida de pasta têm que ser recusadas')
    assert.ok(N.validarNome('-oculto'), 'nome que começa com hífen some das varreduras')
    assert.equal(N.validarNome('app_agenda'), null)
    assert.equal(N.criar(base, { nome: 'nome com espaço' }).ok, false)
    assert.equal(N.criar('', { nome: 'app_x' }).ok, false, 'sem base conhecida não se cria nada')

    const r = N.criar(base, { nome: 'app_agenda', descricao: 'agenda da clínica' })
    assert.ok(r.ok, r.erro)
    const raiz = r.raiz

    // o esqueleto de documentação, que todo projeto tem desde o primeiro minuto
    for (const p of ['docs/produto', 'docs/guias', 'docs/diario', 'docs/ROADMAP.md',
      'docs/HANDOFF.md', 'docs/README.md', 'CLAUDE.md', '.gitignore']) {
      assert.ok(fs.existsSync(path.join(raiz, p)), `faltou ${p}`)
    }

    // e as pastas de código NÃO nascem: pasta vazia por simetria esconde quais
    // estão em uso, que é a regra dele limitando a hierarquia dele mesmo
    for (const p of ['apps', 'tools', 'assets']) {
      assert.ok(!fs.existsSync(path.join(raiz, p)), `${p} não pode nascer vazia`)
    }
    assert.deepEqual(N.PASTAS_ADIADAS.map((x) => x.nome), ['apps/', 'tools/', 'assets/'],
      'a tela explica o que não nasceu, e a explicação sai daqui')

    // o repositório na raiz, que é a razão de o botão existir
    assert.ok(fs.existsSync(path.join(raiz, '.git')), 'projeto sem repositório próprio cai no de cima')

    // o CLAUDE.md leva o protocolo do painel: projeto novo que não reporta é
    // agente trabalhando invisível, e o furo só aparece dias depois
    assert.match(fs.readFileSync(path.join(raiz, 'CLAUDE.md'), 'utf8'), /Control Center/i)

    // o modo automático que ele pediu, em 18/08
    const fw = D.ler(raiz)
    assert.ok(fw && fw.ligado !== false, 'o projeto tem que nascer com o framework ligado')
    assert.equal(fw.fase, 'definicao')
    assert.equal(E.proxima(fw).id, 'natureza', 'e com a entrevista esperando na primeira pergunta')

    // criar duas vezes no mesmo nome não pode passar por cima do que existe
    const denovo = N.criar(base, { nome: 'app_agenda' })
    assert.equal(denovo.ok, false)
    assert.match(denovo.erro, /já existe/)

    /* Grupo é DESCOBERTO, nunca fixado: no PC dele os projetos moram dentro de
       CLIENTS e PESSOAL, na VPS moram direto na base. Lista fixa acertaria uma
       máquina e inventaria pasta na outra. */
    assert.deepEqual(N.gruposDe(base), [], 'projeto solto na base não é grupo')
    const comGrupo = N.criar(base, { nome: 'site_x', grupo: 'CLIENTS' })
    assert.ok(comGrupo.ok, comGrupo.erro)
    assert.equal(path.basename(path.dirname(comGrupo.raiz)), 'CLIENTS')
    assert.deepEqual(N.gruposDe(base), [{ nome: 'CLIENTS', projetos: 1 }])
  } finally {
    fs.rmSync(base, { recursive: true, force: true })
  }
}

/* --- CC-123: `modoDaRota` resolve APELIDO, e o que não resolve devolve null ---

   Achado em 18/08: o que se escreve na rota é o nome de tela ("continuativo",
   "autônomo"), não o identificador interno do motor. Ler o texto cru sem
   passar por `acharModo` fazia o modo cair no padrão (o mais permissivo, o
   `dialogo`) enquanto o quadro continuava anunciando o modo como se ele
   estivesse valendo — trava desligada em silêncio e ao contrário. */
{
  const D = await import('./src/frameworkDisco.mjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-modo-rota-'))
  try {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true })
    const sessao = 'abc12345'
    fs.writeFileSync(
      path.join(dir, 'docs', 'ROTAS-ATIVAS.md'),
      `| \`backlog\` | 🔴 ocupada | ${sessao} — trabalho 🎚 continuativo 📁 x.mjs | hoje |\n`
      + `| \`front\` | 🔴 ocupada | ${sessao} — trabalho 🎚 modo-que-nao-existe 📁 y.mjs | hoje |\n`,
    )

    // "continuativo" é apelido de "restritivo": tem que devolver o ID, não o texto da tela
    const r = D.modoDaRota(dir, sessao)
    assert.equal(r.modo, 'restritivo', 'apelido de tela tem que resolver para o identificador do motor')
    assert.equal(r.rota, 'backlog', 'o nome da rota é o primeiro trecho entre crases da linha')

    // nome que não resolve não pode virar modo nenhum: null deixa valer o do projeto,
    // que é a escolha segura — devolver o texto cru era trocar a trava por nenhuma
    fs.writeFileSync(
      path.join(dir, 'docs', 'ROTAS-ATIVAS.md'),
      `| \`front\` | 🔴 ocupada | ${sessao} — trabalho 🎚 modo-que-nao-existe 📁 y.mjs | hoje |\n`,
    )
    assert.equal(D.modoDaRota(dir, sessao), null, 'modo desconhecido não pode devolver texto cru')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/* --- F15 do framework: achado sobre OUTRO projeto vira ticket NELE, no git dele ---

   Regra do Felipe em 15/08: "isso é uma regra pro framework, o registro em
   outros projetos, ficaria no git? assim eles se comunicam". Repositório git
   DE VERDADE aqui, de propósito — o limite que mais importa (árvore suja
   trava o ticket) só existe se o `git status` for real, não simulado. */
{
  const { execFileSync } = await import('node:child_process')
  const T = await import('./src/ticket.mjs')

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ticket-'))
  const alvo = path.join(base, 'app_pierre')
  try {
    fs.mkdirSync(alvo, { recursive: true })
    const git = (args) => execFileSync('git', args, { cwd: alvo, encoding: 'utf8' })
    git(['init', '-q'])
    git(['config', 'user.email', 'teste@local'])
    git(['config', 'user.name', 'Teste'])
    fs.writeFileSync(path.join(alvo, 'README.md'), '# app_pierre\n')
    git(['add', 'README.md'])
    git(['commit', '-q', '-m', 'inicial'])

    assert.equal(T.acharProjeto('nao-existe', base), null)
    assert.equal(T.acharProjeto('app_pierre', base), alvo)
    assert.equal(T.arvoreLimpa(alvo), true, 'repositório recém commitado está limpo')

    const r = T.registrarTicket('app_pierre', 'anonimizar.ts trunca nome com acento nos primeiros 3 caracteres', {
      base, origem: 'proj_controlcenter', quando: '2026-08-18',
    })
    assert.ok(r.ok, r.erro)
    assert.equal(r.relativo, path.join('docs', 'TICKETS-EXTERNOS.md'))

    const conteudo = fs.readFileSync(r.arquivo, 'utf8')
    assert.match(conteudo, /Tickets externos/, 'cabeçalho nasce sozinho na primeira vez')
    assert.match(conteudo, /2026-08-18 — de `proj_controlcenter`/)
    assert.match(conteudo, /trunca nome com acento/)

    // limite 2: commit PRÓPRIO, com a origem escrita — não fica pendurado
    assert.equal(T.arvoreLimpa(alvo), true, 'o próprio ticket foi commitado, não ficou solto na árvore')
    const log = git(['log', '-1', '--format=%s'])
    assert.match(log, /docs\(ticket\): achado de proj_controlcenter/)

    // limite 3: árvore suja BLOQUEIA, e não mistura ticket com trabalho alheio
    fs.writeFileSync(path.join(alvo, 'em-andamento.txt'), 'rascunho de outra sessão')
    const bloqueado = T.registrarTicket('app_pierre', 'outro achado', { base, quando: '2026-08-18' })
    assert.equal(bloqueado.ok, false)
    assert.match(bloqueado.erro, /não está limpa/)
    assert.equal(T.arvoreLimpa(alvo), false, 'o arquivo solto continua sujando a árvore: o ticket não tocou em nada')

    // ticket sem texto não vira arquivo vazio: recusa é mais barato que apagar depois
    fs.rmSync(path.join(alvo, 'em-andamento.txt'))
    assert.equal(T.registrarTicket('app_pierre', '   ', { base }).ok, false)
  } finally {
    fs.rmSync(base, { recursive: true, force: true })
  }
}

/* --- CC-157: o reporte da sessão sobrevive à casa trancada ---

   Achado em 19/08 medindo a queixa dele de que uma sessão não aparecia no
   painel: dentro do sandbox, `~/.claude` fica somente leitura, e a sessão
   sumia da tela sem nenhum erro visível para quem olhava.

   O que estes asserts guardam é a GARANTIA que ele pediu, não o aviso: com a
   casa trancada, o reporte cai no abrigo e a leitura continua achando. Um
   teste que só provasse a mensagem de erro provaria o diagnóstico, não o
   conserto. */
{
  const M = await import('./src/metaSessao.mjs')

  const casa = M.DIR_SESSOES()
  const abrigo = M.DIR_SESSOES_ABRIGO()
  assert.notEqual(casa, abrigo, 'casa e abrigo têm que ser lugares diferentes')
  assert.deepEqual(M.DIRS_SESSOES(), [casa, abrigo], 'a casa vale primeiro, o abrigo é a queda')

  /* Trancar a casa de verdade não dá para simular sem root, então o que se
     prova aqui é a outra ponta, que é a que quebrava calada: com o arquivo
     SÓ no abrigo, a leitura tem que achar. Era isso que fazia a sessão sumir
     da tela mesmo depois de gravar. */
  const id = 'ff000000-0000-4000-8000-00000000abcd'
  const noAbrigo = path.join(abrigo, `${id}.json`)
  const jaExistia = fs.existsSync(noAbrigo)
  if (!jaExistia) {
    fs.mkdirSync(abrigo, { recursive: true })
    fs.writeFileSync(noAbrigo, JSON.stringify({ subject: 'só no abrigo' }))
  }
  try {
    assert.equal(M.arquivoExistenteDe(id), noAbrigo,
      'reporte que só existe no abrigo tem que ser achado, senão a sessão some da tela')
    assert.equal(M.lerMetaSessao(id).subject, 'só no abrigo')

    // e o que não existe em lugar nenhum continua não existindo, sem inventar
    assert.equal(M.arquivoExistenteDe('nao-existe-em-lugar-nenhum'), null)
    assert.deepEqual(M.lerMetaSessao('nao-existe-em-lugar-nenhum'), {})
  } finally {
    if (!jaExistia) fs.rmSync(noAbrigo, { force: true })
  }
}

/* --- CC-80: a visão estrutural, derivada do git, nunca escrita à mão ---

   O estudo (docs/produto/ESTUDO-VISAO-ESTRUTURAL.md) recomendou a opção B:
   as frentes do roadmap como território, com quais arquivos cada uma toca —
   derivado dos commits, porque mapa escrito à mão diverge do código em dias.

   `mapear()` é puro: recebe grupos e um histórico já lido, nunca chama git.
   O que se testa aqui é a REGRA de atribuição, não a leitura do disco. */
{
  const est = await import('./src/estrutura.mjs')

  const grupos = [
    {
      titulo: 'Frente: Pierre',
      frentes: [
        { titulo: 'CC-10 fazer a coisa', estado: 'aberto' },
        { titulo: 'CC-11 já fechado', estado: 'feito' },
      ],
    },
    {
      titulo: 'Frente: Bancada',
      frentes: [{ titulo: 'CC-20 outra coisa', estado: 'aberto' }],
    },
  ]

  const commits = [
    { hash: 'a', codigos: ['CC-10'], arquivos: ['src/pierre.mjs', 'docs/ROADMAP.md'] },
    { hash: 'b', codigos: ['CC-10'], arquivos: ['src/pierre.mjs'] },
    { hash: 'c', codigos: ['CC-20'], arquivos: ['src/bancada.mjs'] },
    { hash: 'd', codigos: ['CC-99'], arquivos: ['src/nada-a-ver.mjs'] }, // código de nenhuma frente
  ]

  const r = est.mapear({ grupos, commits, jobs: [] })

  const pierre = r.find((g) => g.titulo === 'Frente: Pierre')
  assert.equal(pierre.total, 2)
  assert.equal(pierre.abertos, 1, 'item feito não conta como aberto')
  assert.equal(pierre.arquivos[0].arquivo, 'src/pierre.mjs', 'o mais tocado vem primeiro')
  assert.equal(pierre.arquivos[0].toques, 2)
  assert.ok(!pierre.arquivos.some((a) => a.arquivo === 'src/nada-a-ver.mjs'),
    'commit de outro código não pode contaminar esta frente')

  const bancada = r.find((g) => g.titulo === 'Frente: Bancada')
  assert.equal(bancada.arquivos.length, 1)
  assert.equal(bancada.arquivos[0].arquivo, 'src/bancada.mjs')

  // grupo sem nenhum commit correspondente não quebra, só fica sem arquivo
  const vazio = est.mapear({
    grupos: [{ titulo: 'Frente: Nada', frentes: [{ titulo: 'CC-77 solo', estado: 'aberto' }] }],
    commits, jobs: [],
  })
  assert.equal(vazio[0].arquivos.length, 0)

  // agente com sessão aberta na frente aparece, e o nome dele casa por
  // aproximação, do mesmo jeito que o resto da tela já faz
  const comAgente = est.mapear({
    grupos, commits,
    jobs: [{ id: 'j1', status: 'working', frente: 'Bancada' }, { id: 'j2', status: 'done', frente: 'outra coisa' }],
  })
  const bancadaComAgente = comAgente.find((g) => g.titulo === 'Frente: Bancada')
  assert.equal(bancadaComAgente.agentes.length, 1)
  assert.equal(bancadaComAgente.agentes[0].id, 'j1')

  // teto de 5 arquivos: um sexto commit não pode fazer a lista crescer
  const muitos = est.mapear({
    grupos: [{ titulo: 'Frente: Pierre', frentes: [{ titulo: 'CC-10 x', estado: 'aberto' }] }],
    commits: Array.from({ length: 8 }, (_, i) => ({ hash: `h${i}`, codigos: ['CC-10'], arquivos: [`src/f${i}.mjs`] })),
    jobs: [],
  })
  assert.equal(muitos[0].arquivos.length, 5, 'a lista de arquivos quentes tem teto')
}

/* O resumo diz o que a MÁQUINA tinha para oferecer, e por isso os dois números
   podem ser zero sem que nada esteja errado: numa VPS sem job de background o
   gate agora roda inteiro contra dados sintéticos. Zero aqui é informação, não
   falha — antes era o gate morrendo. */
console.log(`ok — ${real.length} jobs reais, ${findProjects().length} projetos varridos nesta máquina`)

/* --- CC-155: as avenidas, e onde duas rotas se esbarram ---

   Ideia dele em 18/08: um mapa de linhas onde dá para ver quem está onde e
   onde dois agentes vão colidir. O motor decide o que é cruzamento; a tela só
   desenha o que ele disser.

   Os dois tipos de cruzamento são diferentes de propósito: colisão é o mesmo
   arquivo em duas rotas (conflito certo), vizinhança é arquivo diferente com
   import entre eles (ninguém avisa, e quebra mesmo assim). */
{
  const av = await import('./src/avenidas.mjs')

  const grafo = {
    usa: new Map([
      ['src/a.mjs', new Set(['src/b.mjs'])],
      ['src/b.mjs', new Set()],
      ['src/z.mjs', new Set()],
    ]),
  }

  // rota sem dono, ou sem arquivo, não é avenida
  const semNada = av.mapear([
    { rota: 'livre', quem: null, arquivos: [] },
    { rota: 'sem-arquivo', quem: 'aaa', arquivos: [] },
  ], grafo)
  assert.equal(semNada.avenidas.length, 0, 'rota sem dono ou sem arquivo não é avenida')
  assert.match(av.resumo(semNada).frase, /Nenhuma rota/)

  // duas rotas com arquivos que não se falam: nenhum cruzamento
  const longe = av.mapear([
    { rota: 'r1', quem: 'aaa', veredito: 'ativa', arquivos: ['src/a.mjs'] },
    { rota: 'r2', quem: 'bbb', veredito: 'ativa', arquivos: ['src/z.mjs'] },
  ], grafo)
  assert.equal(longe.avenidas.length, 2)
  assert.equal(longe.cruzamentos.length, 0, 'arquivos sem import entre si não se cruzam')
  assert.equal(av.resumo(longe).cor, 'bom')

  // vizinhança: arquivos diferentes, mas um importa o outro
  const vizinhas = av.mapear([
    { rota: 'r1', quem: 'aaa', veredito: 'ativa', arquivos: ['src/a.mjs'] },
    { rota: 'r2', quem: 'bbb', veredito: 'ativa', arquivos: ['src/b.mjs'] },
  ], grafo)
  assert.equal(vizinhas.cruzamentos.length, 1)
  assert.equal(vizinhas.cruzamentos[0].tipo, 'vizinhanca')
  assert.equal(av.resumo(vizinhas).cor, 'atencao')

  // colisão vence vizinhança: o mesmo arquivo em duas rotas é o pior caso
  const colidindo = av.mapear([
    { rota: 'r1', quem: 'aaa', veredito: 'ativa', arquivos: ['src/a.mjs', 'src/b.mjs'] },
    { rota: 'r2', quem: 'bbb', veredito: 'ativa', arquivos: ['src/b.mjs'] },
  ], grafo)
  assert.equal(colidindo.cruzamentos.length, 1, 'colisão não pode ser contada duas vezes')
  assert.equal(colidindo.cruzamentos[0].tipo, 'colisao')
  assert.deepEqual(colidindo.cruzamentos[0].arquivos, ['src/b.mjs'])
  assert.equal(av.resumo(colidindo).cor, 'ruim')

  // sem grafo, a colisão continua e a vizinhança some: melhor um mapa a menos
  // que uma tela que não abre porque a varredura falhou
  const semGrafo = av.mapear([
    { rota: 'r1', quem: 'aaa', arquivos: ['src/a.mjs'] },
    { rota: 'r2', quem: 'bbb', arquivos: ['src/b.mjs'] },
  ], null)
  assert.equal(semGrafo.avenidas.length, 2)
  assert.equal(semGrafo.cruzamentos.length, 0)

  // a mesma rota repetida no quadro (o arquivo é histórico) vira UMA avenida,
  // e fica a linha que declara arquivos
  const repetida = av.mapear([
    { rota: 'r1', quem: 'aaa', arquivos: [] },
    { rota: 'r1', quem: 'aaa', arquivos: ['src/a.mjs', 'src/b.mjs'] },
  ], grafo)
  assert.equal(repetida.avenidas.length, 1, 'rota repetida no quadro não vira duas avenidas')
  assert.equal(repetida.avenidas[0].arquivos.length, 2)

  // barra invertida do Windows não pode esconder um cruzamento
  const barras = av.mapear([
    { rota: 'r1', quem: 'aaa', arquivos: [String.raw`src\a.mjs`] },
    { rota: 'r2', quem: 'bbb', arquivos: ['src/b.mjs'] },
  ], grafo)
  assert.equal(barras.cruzamentos.length, 1, 'caminho com barra invertida tem que casar com o do grafo')

  // viva é diferente de ocupada: o quadro pode anunciar dono de sessão morta
  const morta = av.mapear([
    { rota: 'r1', quem: 'aaa', veredito: 'orfa', arquivos: ['src/a.mjs'] },
  ], grafo)
  assert.equal(morta.avenidas[0].viva, false, 'rota órfã não pode contar como trânsito')
}

/* ============ CC-191: como o painel do escritório é CHAMADO ============

   O botão "ligar" respondia `spawn EFTYPE` no Windows e nada subia. A causa é
   do sistema operacional: o fork do escritório é um `cli.js`, e no Windows um
   `.js` não é executável. A saída antiga era `shell: true`, que além de não
   resolver de forma confiável, concatena argumentos na linha de comando do
   shell sem escapar — injeção real, já registrada no CLAUDE.md deste projeto.

   O que este teste guarda é a decisão: cada tipo de alvo tem um jeito de ser
   chamado, e nenhum deles usa shell. */
{
  const p = await import('./src/paineis.mjs')
  const ehWin = process.platform === 'win32'

  // o caso que estava quebrado: um .js roda pelo Node que já está aqui
  const js = p.montarComando('/qualquer/lugar/cli.js', ['--port', '3101'])
  assert.equal(js.cmd, process.execPath, 'um .js tem que ser chamado pelo Node, nunca direto')
  assert.deepEqual(js.args, ['/qualquer/lugar/cli.js', '--port', '3101'])
  assert.equal(js.shell, false, 'shell: true é injeção de comando quando o argumento é dinâmico')

  // binário de npm no Windows é um .cmd, e quem sabe resolver isso é o cmd.exe
  const cmdWin = p.montarComando('C:/npm/pixel-agents.cmd', ['--host', '127.0.0.1'])
  if (ehWin) {
    assert.match(cmdWin.cmd, /cmd\.exe$/i, 'um .cmd precisa do interpretador de comandos')
    assert.equal(cmdWin.args[0], '/c')
    assert.equal(cmdWin.args[1], 'C:/npm/pixel-agents.cmd')
    assert.equal(cmdWin.args[2], '--host', 'cada argumento entra separado, para o Node escapar cada um')
  }
  // nome cru sem extensão: no Windows quem acha o .cmd é o cmd.exe; no Linux é executável
  const cru = p.montarComando('pixel-agents', ['--port', '3101'])
  assert.equal(cru.shell, false)
  if (ehWin) assert.match(cru.cmd, /cmd\.exe$/i)
  else assert.equal(cru.cmd, 'pixel-agents', 'no Linux o binário é chamado direto')

  // nenhum caminho pode devolver shell ligado: é a regra que o defeito ensinou
  for (const alvo of ['/usr/bin/coisa', 'C:/x/y.cmd', '/a/b.js', 'nome-cru', '/opt/app.mjs']) {
    assert.equal(p.montarComando(alvo, ['a b', '$(rm -rf /)']).shell, false,
      `montarComando(${alvo}) não pode pedir shell`)
  }

  // alvo vazio não pode virar spawn de undefined
  assert.equal(p.montarComando(null), null)
  assert.equal(p.montarComando(''), null)
  console.log('  ok   CC-191: o painel do escritório é chamado pelo interpretador certo, e nunca por shell')
}

/* ====== A rede contra o marcador que ainda não existe ======

   Pergunta dele em 20/08, e é a certa: *"tudo bem que era mentira, mas como
   garantimos que isso nao vai acontecer mais?"*

   O filtro do `transcript.mjs` é uma lista do que se conhece, e o CLI ganha
   campo novo a cada versão: `isCompactSummary` existia e ninguém sabia até ele
   ver o painel. Lista de exclusão não garante nada sozinha.

   Inverter para lista de inclusão foi MEDIDO e também não serve: nos 266
   transcritos desta máquina, 37 das 2253 mensagens aceitas não trazem
   `promptSource`, e algumas são dele ("mate o node orfao somente").

   Então a garantia é esta varredura. Ela lê os transcritos REAIS da máquina e
   falha quando o último pedido tem cheiro de recado de máquina. Marcador novo
   que apareça amanhã cai aqui, com o nome do arquivo, antes de virar tela. */
{
  const { lastPrompt: ultimo } = await import('./src/transcript.mjs')
  const base = path.join(os.homedir(), '.claude', 'projects')

  /* Cada padrão é uma frase que o PROGRAMA escreve, nunca uma pessoa. Não é
     detecção de idioma: é detecção de recado de máquina. */
  const CHEIRO_DE_MAQUINA = [
    /^This session is being continued/i,
    /^Caveat: The messages below were generated/i,
    /^\[Request interrupted/i,
    /^Continue from where you left off/i,
    /^<[a-z-]+>/i,
    /^Your task is to create a detailed summary/i,
    /^Analyze the conversation/i,
  ]

  let arquivos = []
  try {
    for (const dir of fs.readdirSync(base)) {
      const p = path.join(base, dir)
      try {
        for (const f of fs.readdirSync(p)) if (f.endsWith('.jsonl')) arquivos.push(path.join(p, f))
      } catch { /* pasta sem permissão: segue */ }
    }
  } catch { /* máquina sem transcritos */ }

  if (!arquivos.length) {
    console.log('  (pulado: esta máquina não tem transcrito para varrer)')
  } else {
    /* Os 60 mais recentes: a varredura inteira leva minutos em 266 arquivos, e
       o que interessa é o que aparece no painel hoje. */
    const recentes = arquivos
      .map((f) => { try { return { f, m: fs.statSync(f).mtimeMs } } catch { return null } })
      .filter(Boolean).sort((a, b) => b.m - a.m).slice(0, 60).map((x) => x.f)

    const suspeitos = []
    for (const f of recentes) {
      const p = ultimo(f)
      if (!p) continue
      const cheiro = CHEIRO_DE_MAQUINA.find((re) => re.test(p.trim()))
      if (cheiro) suspeitos.push(`${path.basename(f)}: ${p.trim().slice(0, 70)}`)
    }
    assert.deepEqual(
      suspeitos, [],
      `o painel mostraria recado do programa como pedido dele em:\n    ${suspeitos.join('\n    ')}`,
    )
    console.log(`  ok   nenhum dos ${recentes.length} transcritos recentes mostra recado de máquina como pedido dele`)
  }
}

/* --- CC-222: layout de grade não pode nascer em `style=` ---
 *
 * Ele mandou o print do telefone: a tela Trabalho com três colunas espremidas
 * em 390px, cada palavra numa linha, texto cortado pela metade. A causa era
 * `style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))"`
 * escrito direto na marcação, onde nenhuma regra de tela estreita alcança.
 *
 * O CLAUDE.md já registra essa armadilha desde 16/08, quando ela apagou uma
 * tela inteira, e mesmo assim ela voltou num bloco novo. Regra escrita não
 * segura; por isso ela vira teste.
 *
 * Por que aqui e não numa captura: isto é uma regra de TEXTO, custa
 * milissegundos e roda sem navegador. O teste visual do estreito
 * (`test-estreito.mjs`) existe, mas mede o painel ANTIGO — foi exatamente por
 * isso que este defeito passou pelo gate inteiro sem um aviso.
 */
{
  const html = fs.readFileSync(path.join(process.cwd(), 'src', 'ui_v2.html'), 'utf8')

  /* O que passa e o que não passa, decidido olhando os 21 casos reais do
     arquivo em 20/08, um a um:
     · `repeat(auto-fill|auto-fit, minmax(220px, 1fr))` PASSA. Ela se ajusta
       por construção: em 390px o navegador põe uma coluna só, sem precisar de
       regra nenhuma. São 15 dos 21, e proibir seria ruído sem defeito.
     · `auto 1fr` PASSA. É o par rótulo e valor, e `auto` não reserva largura.
     · Trilha com tamanho declarado (`1.2fr 0.8fr 1fr`, `repeat(3, ...)`,
       `1fr 1fr`) NÃO passa: ela reserva a largura mesmo quando não cabe, e é
       exatamente esse o defeito do print dele. */
  const semComentarios = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const inlineGrade = []
  for (const m of semComentarios.matchAll(/style="([^"]*grid-template-columns[^"]*)"/g)) {
    const colunas = m[1].match(/grid-template-columns:\s*([^;"]+)/)?.[1]?.trim() || ''
    if (/repeat\(\s*auto-(fill|fit)/.test(colunas)) continue
    const trilhas = colunas.split(/\s+(?![^(]*\))/).filter(Boolean)
    const reserva = /repeat\(\s*[2-9]/.test(colunas)
      || trilhas.filter((t) => /\d/.test(t)).length > 1
    if (reserva) inlineGrade.push(colunas.slice(0, 60))
  }
  assert.deepEqual(
    inlineGrade, [],
    'grade de várias colunas escrita em style= no ui_v2.html. Estilo inline vence\n'
    + '    media query e container query, então a tela NUNCA colapsa no telefone.\n'
    + '    Vire classe, com a regra do estreito junto. Encontrado em:\n      '
    + inlineGrade.join('\n      '),
  )
  console.log('  ok   CC-222: nenhuma grade de colunas presa em style= no painel novo')

  /* A regra do estreito tem que existir de verdade para as grades conhecidas.
     Sem isto, alguém cria a classe, esquece o colapso, e o teste acima passa
     com a tela igualmente quebrada. */
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
  /* O bloco do estreito é achado pelo padrão, não pelo número: mudar 700 para
     720 não pode fazer esta verificação passar a examinar o arquivo inteiro e
     aprovar tudo calada. */
  const abre = css.search(/@media\s*\(max-width:/)
  assert.ok(abre > 0, 'o painel novo perdeu o bloco de tela estreita')
  const estreito = css.slice(abre)
  for (const classe of ['funil-colunas', 'fw-colunas', 'idx-colunas', 'agora-grid', 'projetos-grid', 'bottom-grid']) {
    assert.ok(
      new RegExp(`\\.${classe}\\b`).test(estreito),
      `.${classe} não tem regra de tela estreita: em 390px ela mantém as colunas largas`,
    )
  }
  console.log('  ok   CC-222: as seis grades do painel novo colapsam no telefone')

  /* --- CC-224: o motor de gráficos desenha em HTML, e o estilo mora aqui ---
   *
   * Print dele, do telefone: a tela Gráficos mostrava só rótulos empilhados,
   * `claude-opus-5 / claude-fable-5 / 0 $2.7k`, sem desenho nenhum. O motor
   * estava certo o tempo todo. `src/graficos.js` monta as barras em HTML puro
   * e a ALTURA delas mora no CSS da página; o bloco existe no painel antigo
   * desde sempre e nunca foi copiado para o novo, então `.g-barras` nascia com
   * altura zero. A rosca aparecia porque é a única forma que carrega o próprio
   * tamanho dentro do SVG, e foi isso que fez o defeito parecer coisa de
   * telefone quando era de todas as telas.
   *
   * A rede olha a família inteira: toda classe que o motor escreve tem que ter
   * estilo. É o que pega a próxima forma nova que nascer sem desenho.
   */
  const motor = fs.readFileSync(path.join(process.cwd(), 'src', 'graficos.js'), 'utf8')
  const usadas = new Set()
  for (const m of motor.matchAll(/class=["']([^"'$]*)/g)) {
    m[1].split(/\s+/).filter(Boolean).forEach((c) => usadas.add(c))
  }
  assert.ok(usadas.size > 10, 'não achei as classes do motor de gráficos: o padrão de busca envelheceu')
  const semEstilo = [...usadas].filter((c) => !new RegExp(`\\.${c}\\b`).test(html))
  assert.deepEqual(
    semEstilo, [],
    'o motor de gráficos escreve classes que o painel novo não estiliza, e no navegador\n'
    + '    isso vira texto solto sem desenho:\n      ' + semEstilo.join('\n      '),
  )
  console.log(`  ok   CC-224: as ${usadas.size} classes do motor de gráficos têm estilo no painel novo`)
}

/* --- CC-225: quem lê reporte de sessão tem que olhar os DOIS lugares ---
 *
 * Desde o CC-157 o reporte de uma sessão interativa mora na casa (`~/.claude`)
 * ou no abrigo, para onde ele cai quando o sandbox tranca a casa. `gravar` já
 * sabe disso; `lerMetaSessao` também, e devolve o arquivo mais novo entre os
 * dois. Dois hooks montavam o caminho da CASA na mão.
 *
 * O estrago era silencioso e durou uma tarde: o painel mostrava a lista de
 * tarefas atual, e os avisos cobravam uma lista congelada horas antes, do
 * arquivo que ninguém escrevia mais. Cobrança sobre trabalho já entregue é a
 * forma mais rápida de um aviso virar barulho ignorado.
 */
{
  const suspeitos = []
  for (const f of fs.readdirSync(path.join(process.cwd(), 'hooks')).filter((n) => n.endsWith('.mjs'))) {
    const src = fs.readFileSync(path.join(process.cwd(), 'hooks', f), 'utf8')
    /* O que se procura é o caminho montado à mão, não a menção ao módulo. */
    if (/DIR_SESSOES\(\)\s*,\s*`?\$?\{?\w*id/.test(src) || /join\(\s*M?\.?DIR_SESSOES\(\)/.test(src)) {
      suspeitos.push(f)
    }
  }
  assert.deepEqual(
    suspeitos, [],
    'hook montando o caminho do reporte na mão. Use `lerMetaSessao(id)`, que olha a\n'
    + '    casa E o abrigo e devolve o mais novo. Lendo só a casa, o aviso cobra uma\n'
    + '    lista congelada enquanto o painel mostra a atual:\n      ' + suspeitos.join('\n      '),
  )
  console.log('  ok   CC-225: nenhum hook lê o reporte de sessão por um lugar só')

  /* O isolamento do abrigo: com `CC_HOME`, nada pode escapar por
     `XDG_DATA_HOME` para o reporte de verdade dele. */
  const meta = fs.readFileSync(path.join(process.cwd(), 'src', 'metaSessao.mjs'), 'utf8')
  assert.match(
    meta, /!process\.env\.CC_HOME\s*&&\s*process\.env\.XDG_DATA_HOME/,
    'o abrigo voltou a escapar por XDG_DATA_HOME: teste com casa isolada escreveria no reporte real',
  )
  console.log('  ok   CC-225: casa isolada leva o abrigo junto')
}

/* --- CC-227: quadro que mostra projeto tem que dizer em qual máquina ele está ---
 *
 * Regra pedida por ele duas vezes. Na primeira (CC-219) eu implementei com duas
 * economias que inventei sozinho: a etiqueta sumia quando o cockpit conhecia uma
 * máquina só, e nos cartões de projeto ela só aparecia quando o projeto estava
 * em mais de uma. Ele abriu o painel e cobrou de novo:
 *
 *   "está falando um projeto de control center, não está falando que está na
 *    VPS, não está falando que está no desktop, não está falando nada. Sendo
 *    que eu tinha pedido pra ser uma regra de todos os quadros."
 *
 * E pediu a trava junto: *"cria uma regra também pra certificar de que esse
 * campo vai estar sempre incluso dentro desses quadrados"*. É este bloco.
 *
 * Como se mede sem navegador: todo trecho que imprime o nome do projeto tem que
 * ter uma etiqueta de máquina na mesma expressão. O alcance é a expressão de
 * template inteira, porque o selo às vezes vem antes do projeto e às vezes
 * depois, e as duas ordens são legítimas.
 */
{
  const html = fs.readFileSync(path.join(process.cwd(), 'src', 'ui_v2.html'), 'utf8')
  const linhas = html.split(/\r?\n/)
  /* Os nomes pelos quais o projeto aparece na tela, nas três formas de dado
     que chegam: agente (`project`), pendência (`projeto`) e grupo (`nome`). */
  /* O `>` antes da expressão é o que separa TEXTO NA TELA de valor de atributo.
     Sem ele a regra acusava `data-ent-abrir="${esc(p.projeto)}"`, que é o nome
     do projeto indo para um botão e não para os olhos dele. */
  /* Duas escritas, e a segunda entrou em 22/08 porque a rede não pegou a tela
     Projetos: ele abriu, viu 23 cartões sem etiqueta nenhuma e perguntou
     *"onde tá dizendo que cada projeto está na vps, desktop etc? Achei que
     tínhamos definido isso"*.
     A rede só conhecia a forma `>${esc(p.projeto)}` dentro de template. O
     código novo monta o mesmo HTML por concatenação, `'>' + esc(p.projeto)`,
     e passava limpo. Uma regra que só cobre um jeito de escrever não é regra,
     é coincidência. */
  const MOSTRA_PROJETO = new RegExp(
    '>\\s*\\$\\{esc\\((?:[a-z]\\.project\\b|[a-z]\\.projeto\\b|nome\\.toUpperCase\\(\\))'
    + "|>'\\s*\\+\\s*esc\\((?:[a-z]\\.project\\b|[a-z]\\.projeto\\b)",
  )
  const TEM_SELO = /selo\w*\(|maquinas|pj-onde/

  const nus = []
  linhas.forEach((linha, i) => {
    if (!MOSTRA_PROJETO.test(linha)) return
    /* A etiqueta pode estar na linha seguinte quando a expressão quebra. */
    const vizinhanca = [linha, linhas[i + 1] || '', linhas[i - 1] || ''].join(' ')
    if (!TEM_SELO.test(vizinhanca)) nus.push(`linha ${i + 1}: ${linha.trim().slice(0, 90)}`)
  })
  assert.deepEqual(
    nus, [],
    'quadro mostrando projeto sem dizer em qual máquina ele está. Ele pediu isso como\n'
    + '    regra de TODOS os quadros, duas vezes. Use `selo(job)` ou `seloDe(nome)`:\n      '
    + nus.join('\n      '),
  )
  console.log('  ok   CC-227: todo quadro que mostra projeto diz em qual máquina ele está')

  /* A etiqueta não pode voltar a ter exceção escondida. As duas que existiam
     (`sempre`, e o `misturado ? selo : ''`) foram removidas por causa disso. */
  const selo = html.slice(html.indexOf('function seloDe'), html.indexOf('function fraseDoAgente'))
  assert.ok(
    !/CONHECIDAS\.size\s*<\s*2/.test(selo),
    'a etiqueta de máquina voltou a sumir quando só existe uma: ele recusou essa economia',
  )
  console.log('  ok   CC-227: a etiqueta de máquina não tem exceção')

  /* --- A verificação que faltava, e que teria pego o estrago em 2 segundos ---
   *
   * Ao escrever a regra acima eu quebrei a página INTEIRA: um comentário HTML
   * dentro de um template do JavaScript trazia uma crase, que fecha a string.
   * A tela ficou em "Carregando estado do cockpit..." para sempre, com ZERO
   * agentes, e nenhum erro visível: um erro de sintaxe acontece antes de
   * qualquer código rodar, então nem o capturador de erro da página funciona.
   *
   * O gate já fazia isto para `ui.html` desde sempre. Para o painel novo, que
   * é o que ele usa desde 20/08, não fazia. Este é o terceiro buraco do mesmo
   * tipo achado hoje (largura de tela, estilo dos gráficos, sintaxe), e todos
   * têm a mesma raiz: o painel novo herdou o código e não herdou as redes.
   */
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  assert.ok(scripts.length >= 2, 'ui_v2.html deixou de ter os blocos de script esperados')
  scripts.forEach((s, i) => {
    assert.doesNotThrow(() => new Function(s), `ui_v2.html tem erro de sintaxe no bloco de script ${i}`)
  })
  console.log(`  ok   CC-227: os ${scripts.length} blocos de script do painel novo compilam`)
}

/* --- CC-228: o "?" que promete explicação tem que ter explicação ---
 *
 * Pedido dele: *"eu queria que todas as funções e termos técnicos tivessem '?',
 * e quando clicasse tivesse uma explicação bem detalhada"*.
 *
 * A explicação sai do glossário, que lê os termos do cabeçalho dos documentos
 * em `docs/`. Duas coisas podem falhar em silêncio, e as duas já falharam hoje:
 *
 *  1. `ajuda('termo')` citando palavra que ninguém escreveu: o "?" não nasce, a
 *     tela fica igualzinha, e ninguém descobre que a explicação sumiu.
 *  2. O cabeçalho escrito com hífen (`termo - texto`) em vez de dois pontos: o
 *     leitor devolve ZERO termos e o documento inteiro fica mudo. Foi o que
 *     aconteceu com `PC-E-VPS.md`, que passou dias sem entregar os três termos
 *     dele sem ninguém notar.
 */
{
  const { lerGlossario, lerPalavrasDaTela, termosDe } = await import('./src/glossario.mjs')
  const verbetes = lerGlossario(process.cwd())
  /* CC-229: duas fontes, e a ordem importa na tela. As explicações LONGAS
     (uma seção `##` por palavra) valem para o que aparece na tela dele; os
     `termos:` de uma linha continuam servindo ao vocabulário de dentro. */
  const longas = lerPalavrasDaTela(process.cwd())
  assert.ok(longas.length > 15, `só ${longas.length} explicações longas: o leitor das seções parou de achar`)
  const termos = new Set([
    ...termosDe(verbetes).map((t) => t.termo.toLowerCase()),
    ...longas.map((p) => p.termo.toLowerCase()),
  ])
  assert.ok(termos.size > 20, `o glossário devolveu só ${termos.size} termos: alguma coisa parou de ler`)

  /* Explicação longa que ficou curta demais não cumpre o pedido dele. O piso é
     baixo de propósito: ele mede o descuido, não o estilo. */
  const rasas = longas.filter((p) => p.texto.length < 200).map((p) => `${p.termo} (${p.texto.length} letras)`)
  assert.deepEqual(
    rasas, [],
    'explicação curta demais. Ele reprovou a versão de uma linha: "voce falou como se\n'
    + '    eu fosse um imbecil (…) quero explicacoes mais tecnicas":\n      ' + rasas.join('\n      '),
  )
  console.log(`  ok   CC-229: as ${longas.length} explicações longas têm corpo de verdade`)

  const html = fs.readFileSync(path.join(process.cwd(), 'src', 'ui_v2.html'), 'utf8')
  /* As duas formas de pedir explicação: `ajuda('termo')` dentro do código que
     desenha, e `data-explica="termo"` num rótulo que já está no HTML. As duas
     somem em silêncio quando o termo não existe, então as duas são medidas. */
  /* Sem os comentários: o texto que EXPLICA o mecanismo cita `data-explica="termo"`
     como exemplo, e sem isso a regra acusaria a própria documentação. */
  const vivo = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const pedidos = [
    ...[...vivo.matchAll(/ajuda\('([^']+)'\)/g)].map((m) => m[1]),
    ...[...vivo.matchAll(/data-explica="([^"]+)"/g)].map((m) => m[1]),
  ]
  assert.ok(pedidos.length > 0, 'o painel deixou de pedir explicação para qualquer termo')
  const semTexto = [...new Set(pedidos)].filter((t) => !termos.has(t.toLowerCase()))
  assert.deepEqual(
    semTexto, [],
    'a tela pede o "?" de termos que ninguém explicou. O botão não aparece e o buraco\n'
    + '    fica invisível. Escreva em docs/produto/PALAVRAS-DA-TELA.md:\n      '
    + semTexto.join('\n      '),
  )
  console.log(`  ok   CC-228: os ${new Set(pedidos).size} termos com "?" na tela têm explicação escrita`)

  /* Documento que declara `termos:` e entrega zero está com o cabeçalho quebrado. */
  const mudos = []
  for (const dir of ['docs', 'docs/produto', 'docs/guias', 'docs/planos']) {
    let arquivos = []
    try { arquivos = fs.readdirSync(path.join(process.cwd(), dir)).filter((f) => f.endsWith('.md')) } catch { continue }
    for (const f of arquivos) {
      const alvo = path.join(dir, f)
      const texto = fs.readFileSync(path.join(process.cwd(), alvo), 'utf8')
      if (!/^termos:/m.test(texto)) continue
      const v = verbetes.find((x) => x.id === alvo.replace(/^docs[/\\]/, '').replace(/\.md$/, '')
        || String(x.id).endsWith(f.replace(/\.md$/, '')))
      if (v && !Object.keys(v.termos || {}).length) mudos.push(alvo)
    }
  }
  assert.deepEqual(
    mudos, [],
    'documento declara `termos:` e entrega zero. O separador é DOIS PONTOS, não hífen:\n      '
    + mudos.join('\n      '),
  )
  console.log('  ok   CC-228: nenhum documento declara termos e entrega vazio')

  /* --- CC-230: TODA tela do menu explica a si mesma ---
   *
   * Pedido dele depois de aprovar a primeira leva: *"precisamos aplicar isso a
   * todas as paginas e todos os modulos e tudo que poder inserir no cockpit"*.
   *
   * A ligação é por derivação, não por lista: `view-agentes` procura a
   * explicação `tela: agentes`. Isso significa que **tela nova nasce sem "?" e
   * ninguém percebe**, porque o botão simplesmente não aparece. É esta
   * verificação que transforma o silêncio em falha.
   */
  const telas = [...new Set([...html.matchAll(/data-target="(view-[a-z]+)"/g)].map((m) => m[1]))]
  assert.ok(telas.length > 15, `só ${telas.length} telas achadas no menu: o padrão de busca envelheceu`)
  const semExplicacao = telas
    .map((t) => `tela: ${t.replace(/^view-/, '')}`)
    .filter((termo) => !longas.some((p) => p.termo.toLowerCase() === termo))
  assert.deepEqual(
    semExplicacao, [],
    'tela no menu sem explicação escrita. O "?" dela não aparece, e o buraco é invisível.\n'
    + '    Escreva a seção em docs/produto/PALAVRAS-DA-TELA.md:\n      ' + semExplicacao.join('\n      '),
  )
  console.log(`  ok   CC-230: as ${telas.length} telas do menu têm explicação própria`)
}

/* --- CC-263: o pacote da federação leva TUDO que a máquina sabe ---
 *
 * Escolha dele em 21/08, ao pedir o serviço do Windows: *"quero tudo, os limites
 * do agy e do opencode se possível, e o que mais os agentes puderem compartilhar
 * de dados pra deixar o cockpit bem completo"*.
 *
 * A validação existe porque **um pacote é rede entrando em disco**: nada aqui
 * confia no remetente.
 */
{
  const F = await import('./src/federacao.mjs')

  const base = { maquina: { id: 'aaaa1111', nome: 'PC-TESTE' } }
  const val = (extra) => F.validarPacote({ ...base, ...extra }).pacote

  /* `undefined` precisa virar `null`, e não sumir: some no `JSON.stringify`, e
     aí "não sei dizer" vira "o campo nem existe". Foi o que aconteceu na
     primeira rodada, e levou uma investigação inteira. */
  const vazio = val({})
  assert.equal(vazio.meu, null, 'campo ausente vira null, nunca undefined')
  assert.equal(vazio.agentes, null)
  assert.equal(vazio.limites, null)
  assert.ok('meu' in vazio && 'agentes' in vazio && 'limites' in vazio,
    'os campos precisam EXISTIR no pacote gravado, senão somem do JSON')

  const cheio = val({
    meu: [{ id: 'x', texto: 'uma tarefa dele', projeto: 'p', em: 1 }, { texto: '' }],
    agentes: [{ id: 'claude', rotulo: 'Claude Code', instalado: true }, { rotulo: 'sem id' }],
    limites: { agy: { restam: 3 } },
  })
  assert.equal(cheio.meu.length, 1, 'tarefa sem texto é descartada')
  assert.equal(cheio.agentes.length, 1, 'agente sem id é descartado')
  assert.equal(cheio.agentes[0].instalado, true)
  assert.deepEqual(cheio.limites, { agy: { restam: 3 } })

  /* Lista vazia é DIFERENTE de não saber, e a tela precisa dos dois. */
  assert.deepEqual(val({ meu: [] }).meu, [], '[] quer dizer "sabe, e não tem nenhum"')
  assert.equal(val({ meu: 'texto' }).meu, null, 'tipo errado vira não sei, nunca estoura')
  assert.equal(val({ limites: [1, 2] }).limites, null, 'array não é mapa de limites')

  /* Teto por lista: o remetente não decide quanto ocupa na memória de quem
     recebe. É a mesma regra das rotas e dos backlogs. */
  const muitos = val({ meu: Array.from({ length: 400 }, (_, i) => ({ id: `t${i}`, texto: `tarefa ${i}` })) })
  assert.ok(muitos.meu.length <= 200, `sem teto, um pacote pode encher a memória: veio ${muitos.meu.length}`)

  console.log('  ok   CC-263: o pacote leva tarefas, agentes e limites, com teto e sem confiar no remetente')
}

/* --- CC-262: a revisão das tarefas dele, e o falso positivo que ela quase teve ---
 *
 * Pedido dele: *"na aba de trabalho, em o que só você resolve, você poderia
 * checar o que não precisa mais ser resolvido? (…) revisadas no início de toda
 * a sessão"*. Motivo: **duas das oito estavam feitas havia dias** e ninguém
 * sabia.
 *
 * O defeito que estas verificações guardam é o pior possível numa lista feita
 * para ele confiar: **dizer que algo acabou quando não acabou.** Aconteceu na
 * primeira rodada, com `semarquivo:src/ui.html` respondendo "sumiu" com o
 * arquivo lá, de 491 KB, porque o painel roda como serviço noutra pasta.
 */
{
  const P = await import('./src/tarefasProva.mjs')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc262-'))
  fs.mkdirSync(path.join(raiz, 'src'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'src', 'existe.html'), 'oi')

  const uma = (prova, extra = {}) => P.revisar([{ id: 'x', texto: 't', prova, ...extra }], { raiz })[0]

  assert.equal(uma('arquivo:src/existe.html').resolvida, true)
  assert.equal(uma('semarquivo:src/existe.html').resolvida, false)
  assert.equal(uma('semarquivo:src/sumiu.html').resolvida, true, 'arquivo ausente na pasta CERTA é "sumiu"')

  /* A trava principal: pasta inexistente é NÃO SEI, nunca "sumiu". Sem ela,
     todo caminho olhado no lugar errado vira tarefa resolvida. */
  assert.equal(uma('semarquivo:pasta/que/nao/existe/x.html').resolvida, null,
    'sem a pasta pai, a resposta precisa ser "não consegui checar", e não "sumiu". '
    + 'É o falso positivo que mandaria ele fechar tarefa que não está feita.')
  assert.match(uma('semarquivo:pasta/que/nao/existe/x.html').comoSoube, /não consegui checar/)

  /* Caminho absoluto não depende de raiz nenhuma. */
  assert.equal(uma(`arquivo:${path.join(raiz, 'src', 'existe.html')}`).resolvida, true)

  /* Prova desconhecida ou ausente não vira `false`: viraria "ainda pendente"
     com ar de conferido, e ninguém saberia que ninguém olhou. */
  assert.equal(uma('bananinha:1').resolvida, null)
  assert.match(uma('bananinha:1').comoSoube, /não conheço/)
  assert.equal(uma(null).resolvida, null)
  assert.equal(uma(null).comoSoube, null)

  /* Tarefa já feita sai da revisão: revisar o que ele fechou é ruído. */
  assert.equal(P.revisar([{ id: 'y', prova: 'arquivo:src/existe.html', feito: true }], { raiz }).length, 0)

  /* A raiz do PROJETO vence a do processo, que é o conserto do falso positivo:
     o painel roda numa pasta que não é projeto nenhum. */
  const comProjeto = P.revisar(
    [{ id: 'z', texto: 't', projeto: 'algum', prova: 'arquivo:src/existe.html' }],
    { raiz: os.tmpdir(), raizDe: () => raiz },
  )[0]
  assert.equal(comProjeto.resolvida, true, 'a raiz do projeto da tarefa precisa ser usada antes da do processo')

  fs.rmSync(raiz, { recursive: true, force: true })
  console.log('  ok   CC-262: a revisão acha o que acabou, e nunca inventa que acabou')
}

/* --- CC-261: buscar o gasto do plano direto, quando a barra não roda ---
 *
 * Medido em 21/08: nesta VPS a barra de status **nunca é chamada**, porque as
 * sessões vêm por Remote Control e não há terminal para desenhá-la. O painel
 * exibia o número do PC dele, parado havia 21 horas, como se fosse daqui.
 *
 * Ler credencial era evitado de propósito neste projeto. A troca foi decisão
 * dele: *"precisamos resolver isso urgente, pq me ajuda bastante"*.
 *
 * O teste usa um `fetch` de mentira: nada de rede e nada de credencial real.
 */
{
  const U = await import('./src/uso.mjs')

  const respostaOk = {
    five_hour: { utilization: 5, resets_at: '2026-08-21T21:00:00.000Z' },
    seven_day: { utilization: 34, resets_at: '2026-08-26T00:00:00.000Z' },
  }
  const fetchFalso = (corpo, ok = true, status = 200) => async () => ({
    ok, status, json: async () => corpo,
  })

  /* O formato da conta é DIFERENTE do que a barra manda: `utilization` contra
     `used_percentage`, e data em texto ISO contra segundos. Normalizar é o que
     impede duas verdades sobre a mesma barra. */
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc261-'))
  const credFalsa = path.join(casa, '.credentials.json')
  fs.writeFileSync(credFalsa, JSON.stringify({
    claudeAiOauth: { accessToken: 'token-de-mentira', expiresAt: Date.now() + 3600000 },
  }))

  /* `CREDENCIAL` é resolvido na importação, então o caminho é forçado por
     `CC_HOME` num subprocesso, e não aqui. O que dá para medir direto é a
     normalização e os ramos de erro, que é onde os defeitos moram. */
  const { execFileSync } = await import('node:child_process')
  const codigo = `
    const U = await import('${pathToFileURL(path.resolve('src/uso.mjs')).href}')
    const resposta = ${JSON.stringify(respostaOk)}
    const ok = await U.buscarUsoDaConta({ fetchFn: async () => ({ ok: true, status: 200, json: async () => resposta }) })
    const venceu = await U.buscarUsoDaConta({ agora: Date.now() + 999999999, fetchFn: async () => ({ ok: true, json: async () => resposta }) })
    const recusa = await U.buscarUsoDaConta({ fetchFn: async () => ({ ok: false, status: 401 }) })
    const vazia = await U.buscarUsoDaConta({ fetchFn: async () => ({ ok: true, status: 200, json: async () => ({}) }) })
    const caiu = await U.buscarUsoDaConta({ fetchFn: async () => { throw new Error('rede fora') } })
    console.log(JSON.stringify({ ok, venceu, recusa, vazia, caiu }))
  `
  const r = JSON.parse(execFileSync('node', ['--input-type=module', '-e', codigo], {
    env: { ...process.env, CC_HOME: casa }, encoding: 'utf8',
  }))

  assert.equal(r.ok.dados.cincoHoras.pct, 5, '`utilization` precisa virar `pct`')
  assert.equal(r.ok.dados.semana.pct, 34)
  assert.equal(r.ok.dados.cincoHoras.resetaEm, Date.parse('2026-08-21T21:00:00.000Z'),
    'a data vem em texto ISO e precisa virar milissegundos, como o resto do painel usa')
  assert.ok(r.ok.dados.buscado, 'o dado buscado precisa se identificar como tal')

  /* Cada falha diz o QUE aconteceu. Um `null` mudo faria a barra sumir sem
     ninguém saber se foi token, rede ou conta. */
  assert.match(r.venceu.erro, /venceu/, 'token vencido precisa dizer isso')
  assert.match(r.recusa.erro, /401/, 'recusa da conta precisa trazer o código')
  assert.match(r.vazia.erro, /sem as janelas/, 'resposta sem as janelas não pode virar zero')
  assert.match(r.caiu.erro, /não consegui perguntar/, 'falha de rede precisa degradar com motivo')
  for (const k of ['ok', 'venceu', 'recusa', 'vazia', 'caiu']) {
    assert.ok(!JSON.stringify(r[k]).includes('token-de-mentira'),
      `o token vazou na saída de ${k}: nada aqui pode devolver credencial`)
  }
  fs.rmSync(casa, { recursive: true, force: true })
  console.log('  ok   CC-261: o gasto do plano é buscado, normalizado, e cada falha diz o motivo')
}

/* --- CC-257: a barra de uso do plano nunca teve dado nesta VPS ---
 *
 * Apontado em 21/08 pela sessão do gate, e conferido: o arquivo não existia
 * aqui. `~/.claude` é somente leitura dentro do sandbox, a gravação falhava, o
 * `catch` engolia, e a tela mostrava barra vazia como se o plano estivesse sem
 * uso. Barra vazia não distingue "não usei" de "não consegui ler", que é o
 * defeito mais caro deste painel.
 */
if (process.platform !== 'win32') {
  const { execFileSync } = await import('node:child_process')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc251-'))
  const casa = path.join(raiz, 'casa')
  fs.mkdirSync(casa, { recursive: true })
  fs.chmodSync(casa, 0o500) // casa trancada, como o sandbox tranca

  const codigo = `
    const u = await import('${pathToFileURL(path.resolve('src/uso.mjs')).href}')
    const r = u.gravarUso({ rate_limits: { five_hour: { used_percentage: 12 }, seven_day: { used_percentage: 26 } } })
    const lido = u.readUso()
    console.log(JSON.stringify({ gravou: Boolean(r), releu: lido?.cincoHoras?.pct ?? null }))
  `
  try {
    const saida = JSON.parse(execFileSync('node', ['--input-type=module', '-e', codigo], {
      env: { ...process.env, CC_HOME: casa }, encoding: 'utf8',
    }))
    assert.ok(saida.gravou, 'gravarUso devolveu vazio com a casa trancada')
    assert.equal(saida.releu, 12,
      'com a casa somente leitura, o uso precisa cair no abrigo e ser LIDO de volta. '
      + 'Sem isso a barra do painel fica vazia como se o plano estivesse sem uso.')
    console.log('  ok   CC-257: o uso do plano grava e relê mesmo com a casa somente leitura')
  } finally {
    fs.chmodSync(casa, 0o700)
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

/* --- CC-242: pedido de autorização também expira, e não só a autorização ---
 *
 * Ele mandou o fim de uma resposta com 16 LINHAS de aviso e perguntou se aquilo
 * estava certo. Não estava: eram 7 pedidos de 90 a 158 horas atrás (4 a 6 dias),
 * de sessões que já tinham fechado, repetidos no fim de TODA resposta.
 *
 * `VALIDADE_MS` existia, mas só nascia no ramo `autorizado`: o pedido sem
 * resposta ficava pendurado sem prazo nenhum, para sempre.
 *
 * Expirar não perde nada, e é o ponto: o `rota-guard` REGISTRA o pedido de novo
 * na próxima tentativa de edição. Quem ainda precisa, pede outra vez com data
 * de hoje; quem morreu, cala.
 */
{
  const R = await import('./hooks/routia/rota-pedidos.mjs')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc242-'))
  fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'docs', 'ROTAS-ATIVAS.md'), '| x | 🔴 ocupada | outro | hoje |\n')

  const HORA = 3600000
  const agora = Date.now()
  R.registrar(raiz, { marca: 'aaaa1111', relativo: 'src/novo.mjs', agora })
  R.registrar(raiz, { marca: 'bbbb2222', relativo: 'src/velho.mjs', agora: agora - 7 * HORA })
  R.registrar(raiz, { marca: 'cccc3333', relativo: 'src/limite.mjs', agora: agora - 5 * HORA })

  const vistos = R.pendentes(raiz, { agora }).map((p) => p.arquivo).sort()
  assert.ok(vistos.includes('src/novo.mjs'), 'pedido de agora precisa aparecer, senão ninguém é avisado')
  assert.ok(vistos.includes('src/limite.mjs'), 'pedido de 5h ainda está dentro do prazo de 6h')
  assert.ok(!vistos.includes('src/velho.mjs'), 'pedido de 7h precisa expirar: a sessão que pediu já morreu')

  /* A prova negativa: sem o prazo, o velho voltaria. Sem ela o teste só sabe
     dizer "hoje passa", e não que pegaria a regressão. */
  const semPrazo = R.ler(raiz).pedidos.filter((p) => p.status === 'pendente')
  assert.equal(semPrazo.length, 3, 'os três continuam no arquivo: o que muda é o que se MOSTRA')
  assert.equal(vistos.length, 2)

  /* Pedido sem data conta como vivo: formato antigo não pode sumir calado, que
     seria trocar um defeito por outro pior. */
  const d = R.ler(raiz)
  delete d.pedidos[1].em
  R.gravar(raiz, d)
  assert.ok(R.pendentes(raiz, { agora }).some((p) => p.arquivo === 'src/velho.mjs'),
    'pedido sem data precisa continuar aparecendo, em vez de sumir por falta de campo')

  fs.rmSync(raiz, { recursive: true, force: true })
  console.log('  ok   CC-242: pedido de autorização expira em 6h, e o sem data continua visível')
}

/* --- CC-238: o test-map, o mapa do que é testável e verificável ---
 *
 * Pedido dele em 21/08: *"criar um test-map, de tudo que tem que ser testavel e
 * verificavel no site. botões, textos, descrições, etc."*, para *"usar como
 * teste em diversas ferramentas"*.
 *
 * O mapa existe contra o padrão de defeito deste painel: a tela afirmando com
 * confiança algo que não sabe. Então ele mesmo não pode virar um relatório
 * bonito, e é isso que estas verificações guardam.
 */
{
  const T = await import('./src/testmap.mjs')
  const mapa = T.montarMapa(process.cwd())

  /* 1. O mapa não pode ENCOLHER em silêncio. Tela ou endereço novo entra como
        não coberto; nunca some. É a lição do `hooksCatalogo`, onde peça fora do
        catálogo saía calada achando que estava desligada. */
  const html = fs.readFileSync('src/ui_v2.html', 'utf8')
  const web = fs.readFileSync('src/web.mjs', 'utf8')
  const telasNoFonte = new Set([...html.matchAll(/data-target="(view-[a-z-]+)"/g)].map((m) => m[1]))
  const rotasNoFonte = new Set([...web.matchAll(/url\.pathname === '(\/api\/[a-z/-]+)'/g)].map((m) => m[1]))
  const noMapa = (tipo) => mapa.itens.filter((i) => i.tipo === tipo).length

  assert.equal(noMapa('tela'), telasNoFonte.size,
    `o mapa tem ${noMapa('tela')} telas e o painel tem ${telasNoFonte.size}: a varredura envelheceu`)
  assert.equal(noMapa('endereco'), rotasNoFonte.size,
    `o mapa tem ${noMapa('endereco')} endereços e o servidor tem ${rotasNoFonte.size}`)
  assert.ok(noMapa('acao') > 50, `só ${noMapa('acao')} ações no mapa: o padrão de busca quebrou`)
  assert.ok(noMapa('palavra') > 40, `só ${noMapa('palavra')} palavras no mapa`)

  /* 2. Dimensão AUSENTE é diferente de dimensão vazia. A primeira é defeito de
        leitura, a segunda é trabalho a fazer, e confundir as duas é a família
        de erro mais cara deste painel. */
  for (const it of mapa.itens) {
    for (const dim of Object.keys(T.DIMENSOES)) {
      assert.ok(it.dimensoes[dim], `${it.id} não declara a dimensão "${dim}"`)
      assert.ok('coberto' in it.dimensoes[dim], `${it.id}.${dim} sem o campo coberto`)
    }
  }

  /* 3. Coberto tem que vir com o COMO. Marcar coberto sem dizer o que foi
        verificado é o relatório bonito que o mapa existe para evitar. */
  const semComo = mapa.itens.flatMap((it) => Object.entries(it.dimensoes)
    .filter(([, v]) => v.coberto && !v.como)
    .map(([d]) => `${it.id}.${d}`))
  assert.deepEqual(semComo, [], 'dimensão marcada como coberta sem dizer COMO foi verificada')

  /* 4. A leitura das explicações precisa funcionar de verdade. A primeira
        versão leu o campo errado (`corpo` em vez de `texto`) e o mapa afirmou
        que NENHUMA das 50 explicações ensina, o que é falso. Zero aqui é quase
        sempre bug de leitura, não retrato do projeto. */
  const palavras = mapa.itens.filter((i) => i.tipo === 'palavra')
  const profundas = palavras.filter((p) => p.dimensoes.profundo.coberto).length
  assert.ok(profundas > palavras.length / 2,
    `só ${profundas} de ${palavras.length} explicações passam em "profundo". `
    + 'Antes de aceitar isso como verdade, confira se o campo lido existe.')

  /* 5. O markdown é DERIVADO. Regenerar não pode dar diferença: se der, alguém
        escreveu no arquivo gerado em vez de na fonte. */
  const mdEsperado = T.paraMarkdown(mapa)
  if (fs.existsSync('docs/TEST-MAP.md')) {
    /* No Windows o git converte LF em CRLF ao gravar no disco (`core.autocrlf`),
       então comparar bruto acusa diferença que não existe no conteúdo — mesma
       armadilha do parser de roadmap. Normaliza os dois lados antes. */
    const semCRLF = (s) => s.replace(/\r\n/g, '\n')
    const mdEmDisco = fs.readFileSync('docs/TEST-MAP.md', 'utf8')
    assert.equal(semCRLF(mdEmDisco), semCRLF(mdEsperado),
      'docs/TEST-MAP.md não bate com a varredura. Ele é gerado por `cc testmap`, '
      + 'nunca editado à mão: rode o comando de novo.')
  }
  console.log(`  ok   CC-238: o test-map cobre ${mapa.itens.length} itens, e nenhum sem as 5 dimensões`)
}

/* --- CC-237: a trava de execução contínua parou de cobrar o que é de outra sessão ---
 *
 * Em 21/08 ele abriu uma segunda sessão só para tela, e a rota `front` passou
 * para ela com o CC-156 e o CC-235 dentro. Deste lado a trava seguiu cobrando
 * os dois a cada parada: os únicos itens abertos do backlog eram justamente os
 * que eu não posso tocar sem pisar no dono da rota.
 *
 * É o mesmo defeito que fez o `⏸` nascer, por outro caminho. **Guarda que cobra
 * o impossível ensina a ser ignorado**, e aí ele não segura mais o caso real.
 */
{
  const RT = await import('./src/routia.mjs')
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc237-'))
  fs.mkdirSync(path.join(casa, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(casa, 'docs', 'ROTAS-ATIVAS.md'), [
    '| Rota | Status | Quem / o quê | Desde |',
    '|---|---|---|---|',
    '| `front` | 🔴 ocupada | c213b663 — **CC-156**, o redesenho, e o **CC-235** | hoje |',
    '| `sistemas` | 🔴 ocupada | 9bad715c — CC-232 fechado, seguindo | hoje |',
    '| `antiga` | 🟢 livre | — (fechou o CC-999 semana passada) | — |',
  ].join('\n'))

  const meu = '9bad715c-1111-2222'
  assert.equal(RT.donoDoItem('CC-156', casa), 'c213b663')
  assert.equal(RT.donoDoItem('CC-235', casa), 'c213b663', 'segundo código citado na mesma linha também conta')
  assert.equal(RT.donoDoItem('CC-232', casa), '9bad715c')

  /* Rota LIVRE é histórico: casar com ela faria item entregue semanas atrás
     parecer que ainda tem dono, e ninguém mais o pegaria. */
  assert.equal(RT.donoDoItem('CC-999', casa), null, 'rota livre não pode reivindicar item')

  /* `CC-15` não pode casar dentro de `CC-156`: o quadro cita códigos vizinhos
     o tempo todo. */
  assert.equal(RT.donoDoItem('CC-15', casa), null, 'prefixo não pode casar com código maior')

  assert.equal(RT.deOutraSessao('CC-156 o redesenho', casa, meu), true, 'item da rota do outro: não cobrar')
  assert.equal(RT.deOutraSessao('CC-232 protocolo', casa, meu), false, 'o que EU reservei continua sendo cobrado')
  assert.equal(RT.deOutraSessao('CC-156 o redesenho', casa, 'c213b663-x'), false, 'o dono continua sendo cobrado pelo próprio item')
  assert.equal(RT.deOutraSessao('item sem código', casa, meu), false)
  /* Sem saber quem eu sou, NÃO calar: guarda que emudece por falta de dado
     vira guarda que não existe. */
  assert.equal(RT.deOutraSessao('CC-156', casa, null), false, 'sem id de sessão o guarda continua falando')

  /* E o hook precisa mesmo estar usando isso, senão a regra fica órfã. */
  const hook = fs.readFileSync('hooks/fluxo-guard.mjs', 'utf8')
  assert.ok(/deOutraSessao/.test(hook), 'o fluxo-guard parou de consultar o quadro de rotas')
  fs.rmSync(casa, { recursive: true, force: true })
  console.log('  ok   CC-237: a trava de fluxo não cobra item que está com outra sessão, e continua cobrando o meu')
}

/* --- CC-236: o que está no cartão do backlog é TELA, e a regra dele vale lá ---
 *
 * Ele mandou três prints do telefone em 21/08 comparando as colunas, e dois
 * defeitos estavam nos cartões do Product Backlog, os dois escritos por mim
 * horas antes:
 *
 *  1. **travessão**, que é a regra número 1 do arquivo de instruções dele;
 *  2. **`▶` vazando** para dentro do cartão ("▶ LIBERADO para construir em
 *     21/08"), porque a limpeza de marcadores era uma lista fechada e o
 *     marcador novo não estava nela.
 *
 * O ROADMAP.md parece documentação, mas o título do item É TEXTO DE INTERFACE:
 * ele aparece no cartão do celular dele. Por isso a regra é medida aqui, e só
 * nos itens ABERTOS, que são os que chegam na tela. Os fechados ficam como
 * estão: são histórico, e reescrever 88 títulos antigos mexeria em registro por
 * um ganho que ninguém vê.
 */
{
  const R = await import('./src/roadmap.mjs')
  const mapa = R.lerRoadmap('docs/ROADMAP.md')
  const abertos = []
  for (const g of mapa.grupos || []) {
    for (const f of g.frentes || []) if (f.estado !== 'feito') abertos.push(f)
  }
  assert.ok(abertos.length, 'nenhum item aberto encontrado: o leitor do roadmap envelheceu')

  const comTravessao = abertos.filter((f) => /[—–]/.test(f.titulo))
  assert.deepEqual(
    comTravessao.map((f) => f.titulo), [],
    'título de item ABERTO com travessão. Isso vira cartão na tela do telefone dele, '
    + 'e travessão é a regra número 1 do arquivo de instruções. Use dois pontos.',
  )

  /* O marcador tem que sair na limpeza, senão vira ruído dentro do cartão. */
  const comMarcador = abertos.filter((f) => /[🔴🟡🟢🔵⚪⚫🔥✅✔☑⛔⏳📌⏸▶►▸➤⏭🚧🆕⭐]/u.test(f.titulo))
  assert.deepEqual(
    comMarcador.map((f) => f.titulo), [],
    'marcador sobrando no título depois da limpeza: ele aparece cru no cartão. '
    + 'Acrescente o símbolo à lista de `limpar()` em src/roadmap.mjs.',
  )
  console.log(`  ok   CC-236: os ${abertos.length} itens abertos viram cartão sem travessão e sem marcador solto`)
}

/* --- CC-156: o que está aberto na tela mora no SERVIDOR ---
 *
 * Pedido dele com todas as letras, e é metade do valor do painel federado:
 * abrir uma seção no celular e encontrar aberta no PC. Hoje isso vivia no
 * navegador de cada aparelho.
 *
 * Roda em subprocesso com `CC_HOME` próprio porque `CONFIG_FILE` é resolvido
 * na importação do módulo: mudar a variável depois não isolaria nada, e o
 * config real dele guarda coisa sem outra fonte (taxa, câmbio digitado,
 * calendários). É a armadilha do `CONFIG_FILE` não isolado, que já gravou um
 * calendário de teste no arquivo de verdade.
 */
{
  const { execFileSync } = await import('node:child_process')
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc156-tela-'))
  const rodar = (codigo) => JSON.parse(execFileSync('node', ['--input-type=module', '-e', codigo], {
    env: { ...process.env, CC_HOME: casa }, encoding: 'utf8',
  }))

  const r = rodar(`
    const C = await import('${pathToFileURL(path.resolve('src/config.mjs')).href}')
    const saida = {}
    saida.vazioNoComeco = C.lerTelaAberto()
    saida.abriu = C.setTelaAberto('proj:inovallbond', true).aberto
    saida.abriuOutra = C.setTelaAberto('sprint:x', true).aberto
    // fechar APAGA a chave: guardar os dois lados faria o arquivo crescer para
    // sempre com o que já é o padrão
    saida.fechou = C.setTelaAberto('proj:inovallbond', false).aberto
    saida.chaveVazia = C.setTelaAberto('   ', true).erro || null
    saida.chaveLonga = C.setTelaAberto('x'.repeat(C.TELA_MAX_TAMANHO_CHAVE + 1), true).erro || null
    // teto: só barra chave NOVA, reabrir o que já está no mapa continua valendo
    for (let i = 0; i < C.TELA_MAX_CHAVES; i++) C.setTelaAberto('k' + i, true)
    saida.cheio = C.setTelaAberto('mais-uma', true).erro || null
    saida.reabrirNoLimite = C.setTelaAberto('k0', true).erro || 'passou'
    console.log(JSON.stringify(saida))
  `)

  assert.deepEqual(r.vazioNoComeco, {}, 'config novo tem que começar sem seção nenhuma aberta')
  assert.deepEqual(r.abriu, { 'proj:inovallbond': true })
  assert.deepEqual(r.abriuOutra, { 'proj:inovallbond': true, 'sprint:x': true })
  assert.deepEqual(r.fechou, { 'sprint:x': true }, 'fechar precisa APAGAR a chave, não gravar false')
  assert.ok(r.chaveVazia, 'chave vazia precisa ser recusada')
  assert.match(r.chaveLonga || '', /longa demais/, 'chave gigante precisa ser recusada com o tamanho')
  assert.match(r.cheio || '', /cheio/, 'sem teto, um laço na tela enche o config até ele ficar impraticável')
  assert.equal(r.reabrirNoLimite, 'passou', 'no limite, reabrir seção que já está no mapa não pode travar')
  fs.rmSync(casa, { recursive: true, force: true })
  console.log('  ok   CC-156: o aberto/fechado da tela grava no servidor, com teto e recusa em voz alta')

  /* A recusa não pode sair como sucesso: `comCorpo` carimba `ok: true` em tudo
     que a função devolve, então a rota precisa LANÇAR para virar 400. */
  const rota = fs.readFileSync('src/web.mjs', 'utf8')
  const trecho = rota.slice(rota.indexOf("url.pathname === '/api/tela'"), rota.indexOf("url.pathname === '/api/pip'"))
  assert.ok(
    /throw new Error\(r\.erro\)/.test(trecho),
    'a rota /api/tela precisa LANÇAR quando recusa: devolvendo `{erro}` ela sai com ok:true e status 200, '
    + 'e quem chama acha que gravou.',
  )
  console.log('  ok   CC-156: a rota recusa com status 400, e não com ok:true e um erro pendurado')
}

/* ==========================================================================
 * CC-232 — o protocolo de tarefas dele, e por que cada verificação existe
 *
 * Medido em 21/08: as quatro pendências humanas do encerramento anterior não
 * estavam na lista dele. Ficaram gravadas como bloqueios da sessão que as
 * criou, e a lista mostrava outras quatro, de uma semana antes. Ele abriu o
 * painel e perguntou se estavam lá, "pq deveriam estar, né?".
 *
 * O primeiro rascunho do hook que conserta isso **passou calado no caso real**,
 * porque chamava `readJobs()` sozinho e a pasta de agentes de background está
 * vazia nesta VPS. Só o teste manual pegou. É por isso que a conta foi extraída
 * para `src/tarefasProtocolo.mjs` e é medida aqui.
 * ========================================================================== */
{
  const P = await import('./src/tarefasProtocolo.mjs')

  // a chave de comparação: ditado por voz, com acento e caixa variando
  assert.equal(P.chaveDe('Conferir os APONTAMENTOS'), P.chaveDe('conferir os apontamentos'))
  assert.equal(P.chaveDe('a sessão   de ontem'), P.chaveDe('A SESSAO de ontem'))
  assert.equal(P.chaveDe('  espaço  nas pontas '), 'espaco nas pontas')
  assert.notEqual(P.chaveDe('conferir o print'), P.chaveDe('conferir o painel'))

  const jobs = [
    {
      id: 'aaaa1111',
      blockers: ['Decidir se apaga a tela antiga', { text: 'Consertar o dono da pasta' }, '', null],
      todos: [
        { text: 'Autorizar o sudo', dono: 'felipe', done: false },
        { text: 'Isso ele já fez', dono: 'felipe', done: true },
        { text: 'Trabalho meu', dono: 'ia', done: false },
      ],
    },
    { id: 'bbbb2222', blockers: ['Bloqueio de OUTRA sessão'], todos: [] },
  ]

  const p = P.pendenciasDe(jobs, 'aaaa1111-0000-0000')
  assert.deepEqual(p, ['Decidir se apaga a tela antiga', 'Consertar o dono da pasta', 'Autorizar o sudo'])
  console.log('  ok   CC-232: bloqueio e to-do de dono felipe contam; feito, de outro dono e vazio não')

  /* O id da sessão é obrigatório, e isto não é detalhe: sem ele o hook cobraria
     o bloqueio de OUTRO agente, mandando alguém registrar o que não é seu. */
  assert.deepEqual(P.pendenciasDe(jobs, null), [])
  assert.deepEqual(P.pendenciasDe(jobs, 'zzzz9999'), [])
  assert.ok(!P.pendenciasDe(jobs, 'aaaa1111').includes('Bloqueio de OUTRA sessão'))
  console.log('  ok   CC-232: sem saber de quem é a sessão, não cobra nada de ninguém')

  // o que já está na lista dele some da cobrança, mesmo escrito diferente
  const lista = [
    { texto: 'DECIDIR SE APAGA A TELA ANTIGA', feito: false, fonte: 'lista' },
    { texto: 'Autorizar o sudo', feito: true, fonte: 'lista' }, // já fechada: volta a contar
  ]
  assert.deepEqual(P.faltandoNaLista(p, lista), ['Consertar o dono da pasta', 'Autorizar o sudo'])
  console.log('  ok   CC-232: tarefa já registrada não vira cobrança, com acento e caixa diferentes')

  /* A verificação que guarda o defeito de 20/08 inteiro: casar com a fonte
     `agente` faria o hook olhar para o próprio reflexo — o bloqueio confirmando
     a si mesmo — e a pendência morreria junto com o job, sem nunca chegar na
     lista dela. */
  const reflexo = [{ texto: 'Consertar o dono da pasta', feito: false, fonte: 'agente' }]
  assert.deepEqual(
    P.faltandoNaLista(['Consertar o dono da pasta'], reflexo),
    ['Consertar o dono da pasta'],
    'o bloqueio do próprio cartão não pode contar como "já está na lista dele": '
    + 'é o defeito de 20/08, em que quatro pendências sumiram com o job',
  )
  console.log('  ok   CC-232: bloqueio do próprio cartão não conta como tarefa registrada')

  // os dois hooks precisam estar no catálogo, senão saem calados achando que
  // estão desligados — armadilha que já custou uma rodada inteira em 15/08
  const { HOOKS: CAT } = await import('./src/hooksCatalogo.mjs')
  for (const id of ['tarefas-inicio', 'tarefas-fim']) {
    const h = CAT.find((x) => x.id === id)
    assert.ok(h, `${id} fora do hooksCatalogo.mjs: hookEnabled devolve false e o hook sai calado`)
    assert.ok(fs.existsSync(path.join('hooks', h.script)), `${id}: ${h.script} não existe`)
  }
  console.log('  ok   CC-232: os dois hooks estão no catálogo e os arquivos existem')

  /* CC-124 de novo, e é a razão do primeiro rascunho ter falhado: quem lê só
     `readJobs()` enxerga ZERO agente nesta VPS, onde tudo é sessão interativa. */
  const S = await import('./src/sessoes.mjs')
  assert.equal(typeof S.todosOsJobs, 'function', 'todosOsJobs sumiu: os hooks de tarefa dependem dele')
  /* Só o CÓDIGO conta: os dois arquivos citam `readJobs()` no comentário, para
     explicar por que não o usam. Medir o texto cru acusaria justamente a
     explicação do conserto como se fosse o defeito. */
  const semComentario = (txt) => txt
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const nome of ['tarefas-inicio', 'tarefas-fim']) {
    const codigo = semComentario(fs.readFileSync(`hooks/${nome}.mjs`, 'utf8'))
    assert.ok(
      !/\breadJobs\s*\(/.test(codigo),
      `${nome} voltou a chamar readJobs() direto. `
      + 'Nesta VPS a pasta de background está vazia e o hook passa calado: use todosOsJobs().',
    )
    assert.ok(
      /todosOsJobs\s*\(/.test(codigo),
      `${nome} não chama todosOsJobs(): sem isso ele não enxerga sessão interativa.`,
    )
  }
  console.log('  ok   CC-232: os hooks somam sessão interativa, não só agente de background')

  /* O encaixe do opencode ACRESCENTA ao prompt de sistema. Substituir apagaria
     a instrução da própria ferramenta, e o agente perderia o que sabe fazer. */
  const plugin = fs.readFileSync('hooks/opencode/tarefas.js', 'utf8')
  assert.ok(/output\.system\.push\(/.test(plugin), 'o encaixe do opencode precisa ACRESCENTAR ao sistema')
  assert.ok(!/output\.system\s*=/.test(plugin), 'o encaixe do opencode não pode SUBSTITUIR o prompt de sistema')
  /* Em Linux `cc` é o compilador C. Perguntar a lista de tarefas a ele devolve
     erro, o `catch` engole, e a lista fica vazia sem sinal nenhum. */
  assert.ok(
    /platform\(\)\s*===\s*'linux'\s*\?\s*\['cockpit'\]/.test(plugin),
    'em Linux o encaixe do opencode não pode tentar `cc`: é o compilador C do sistema',
  )
  console.log('  ok   CC-232: o encaixe do opencode acrescenta ao sistema e não chama o compilador C')

  /* A lista dele é texto digitado à mão e não tem outra fonte. Este bloco roda
     numa casa temporária via `CC_HOME` — a mesma correção que tirou o gate de
     cima das notas de verdade, candidata à causa do apagamento de 2026-08-09. */
  {
    const { execFileSync } = await import('node:child_process')
    const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc232-'))
    const env = { ...process.env, CC_HOME: casa }
    const cc = (...args) => execFileSync('node', ['cc.mjs', 'meu', ...args], { env, encoding: 'utf8' })

    assert.match(cc('list'), /nada esperando por ele/)
    cc('add', 'uma coisa que depende dele', '--porque', 'teste do gate')
    /* Duplicata não entra: o encerramento roda mais de uma vez, e a mesma
       pendência repetida é como uma lista deixa de ser lida. */
    cc('add', 'uma coisa que depende dele')
    const aberto = JSON.parse(cc('list', '--json'))
    assert.equal(aberto.length, 1, 'a mesma tarefa entrou duas vezes na lista dele')
    assert.equal(aberto[0].porque, 'teste do gate')

    cc('feito', aberto[0].id)
    assert.match(cc('list'), /nada esperando por ele/)
    cc('reabrir', aberto[0].id)
    assert.equal(JSON.parse(cc('list', '--json')).length, 1, 'reabrir não trouxe a tarefa de volta')
    cc('remover', aberto[0].id)
    assert.match(cc('list'), /nada esperando por ele/)

    const real = path.join(os.homedir(), '.claude', 'control-center-meu.json')
    if (fs.existsSync(real)) {
      const bruto = fs.readFileSync(real, 'utf8')
      assert.ok(
        !bruto.includes('uma coisa que depende dele'),
        'o gate escreveu na lista DE VERDADE dele. CC_HOME não está isolando.',
      )
    }
    fs.rmSync(casa, { recursive: true, force: true })
    console.log('  ok   CC-232: `cc meu` cria, recusa duplicata, fecha, reabre e remove — em casa isolada')
  }

  /* --- O abrigo: `~/.claude` é SOMENTE LEITURA dentro do sandbox ---
   *
   * Descoberto em 21/08 tentando registrar as quatro pendências de 20/08 pelo
   * comando novo: `EROFS`, quatro vezes seguidas. Sem o abrigo, o protocolo
   * inteiro seria decorativo justamente onde ele trabalha — o hook do fim de
   * sessão mandaria registrar, e o comando não conseguiria.
   *
   * É a mesma armadilha do CC-157, que fez uma sessão sumir do painel e ele
   * dizer que ela parecia "funcionando por fora do cockpit".
   */
  if (process.platform !== 'win32') {
    const { execFileSync } = await import('node:child_process')
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc232-abrigo-'))
    const casa = path.join(raiz, 'casa')
    fs.mkdirSync(casa, { recursive: true })
    const env = { ...process.env, CC_HOME: casa }
    const cc = (...args) => execFileSync('node', ['cc.mjs', 'meu', ...args], { env, encoding: 'utf8' })

    fs.writeFileSync(
      path.join(casa, 'control-center-meu.json'),
      JSON.stringify({ tarefas: [{ id: 'nacasa1', texto: 'mora na casa', feito: false, em: 1 }] }),
    )
    fs.chmodSync(casa, 0o500) // trancada, como o sandbox tranca
    try {
      cc('add', 'registrada com a casa trancada')
      const abertas = JSON.parse(cc('list', '--json')).map((t) => t.texto)
      assert.ok(
        abertas.includes('mora na casa') && abertas.includes('registrada com a casa trancada'),
        'com a casa trancada, a lista precisa juntar casa e abrigo. '
        + `Veio: ${JSON.stringify(abertas)}`,
      )
      console.log('  ok   CC-232: casa somente leitura não impede registrar, e a lista junta as duas')

      /* Falhar em VOZ ALTA é metade do conserto: dizer "ok" sem gravar é o
         defeito que este projeto persegue desde o botão que respondia ok com o
         processo morto atrás. */
      let recusou = false
      try { cc('feito', 'nacasa1') } catch (e) {
        recusou = true
        assert.match(
          String(e.stderr || e.stdout || ''),
          /não aceitou escrita/,
          'ao não conseguir gravar, o comando precisa dizer onde a tarefa está e por que falhou',
        )
      }
      assert.ok(recusou, 'fechar tarefa presa na casa trancada respondeu sucesso sem gravar nada')
      console.log('  ok   CC-232: o que não dá para gravar falha em voz alta, em vez de mentir')
    } finally {
      fs.chmodSync(casa, 0o700)
      fs.rmSync(raiz, { recursive: true, force: true })
    }
  }
}

/* ── CC-280/281/282: a zona inteligente ──────────────────────────────────────
   Roda inteiro em casa temporária. Teste que escreve em dado real dele é
   defeito, mesmo com restauração no `finally`: `npm test` interrompido no meio
   deixa o arquivo pela metade, e foi assim que as notas amanheceram vazias em
   09/08. */
{
  const os = await import('node:os')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-armazem-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = path.join(raiz, '.claude')
  fs.mkdirSync(process.env.CC_HOME, { recursive: true })

  try {
    const A = await import(`./src/armazem.mjs?t=${Date.now()}`)
    const C = await import(`./src/coletores.mjs?t=${Date.now()}`)

    /* 1. Append-only: regravar o mesmo dia acrescenta linha, e a leitura fica
       com a última. É a propriedade que torna o arquivo seguro contra queda no
       meio da escrita, e sem teste ela some no primeiro "otimizei para
       reescrever". */
    A.gravar([{ dia: '2026-08-01', projeto: 'p', medida: 'm', valor: 1 }])
    A.gravar([{ dia: '2026-08-01', projeto: 'p', medida: 'm', valor: 9 }])
    const lido = A.ler({ medida: 'm' })
    assert.equal(lido.length, 1, 'mesma chave gravada duas vezes tem que virar um registro só na leitura')
    assert.equal(lido[0].valor, 9, 'a leitura tem que ficar com o valor mais novo')
    const linhas = fs.readFileSync(A.ARQUIVO(), 'utf8').split('\n').filter(Boolean)
    assert.equal(linhas.length, 2, 'o arquivo tem que CONSERVAR as duas linhas: quem reescreve pode perder')
    console.log('  ok   CC-280: append-only, e a leitura fica com o último')

    /* 2. Linha corrompida é o caso NORMAL num arquivo que só cresce, porque um
       processo morto no meio da escrita corta a última. Ela não pode derrubar
       a leitura inteira. */
    fs.appendFileSync(A.ARQUIVO(), '{"dia":"2026-08-02","medi\n', 'utf8')
    assert.equal(A.ler({ medida: 'm' }).length, 1, 'linha truncada tem que ser pulada, não derrubar a leitura')
    console.log('  ok   CC-280: linha cortada pela metade não derruba a leitura')

    /* 3. Sem lugar gravável, responde que não gravou em vez de lançar. Armazém
       que derruba o painel por não conseguir escrever seria pior que armazém
       vazio, e o retorno é o que permite quem chamou saber. */
    const guardado = process.env.CC_HOME
    /* Uma pasta somente leitura, com a casa E o abrigo dentro dela. Apontar
       para um caminho inexistente NÃO serve: `path.join` normaliza o caminho
       do abrigo para um lugar válido, e a gravação passa. Foi o que aconteceu
       ao escrever este teste. */
    const trancada = path.join(raiz, 'trancada')
    fs.mkdirSync(trancada, { recursive: true })
    fs.chmodSync(trancada, 0o500)
    try {
      process.env.CC_HOME = path.join(trancada, '.claude')
      const B = await import(`./src/armazem.mjs?t=${Date.now()}-b`)
      const r = B.gravar([{ dia: '2026-08-03', medida: 'x', valor: 1 }])
      assert.equal(r.ok, false, 'sem lugar gravável, `gravar` tem que devolver ok:false')
      assert.equal(r.onde, null, 'sem gravar, `onde` tem que ser nulo, nunca um caminho que não recebeu nada')
    } finally {
      fs.chmodSync(trancada, 0o700)
      process.env.CC_HOME = guardado
    }
    console.log('  ok   CC-280: sem lugar gravável, avisa em vez de derrubar')

    /* 4. A regressão que mais dói: o cruzamento comparando janelas diferentes.
       Na primeira versão, o git via 28 dias e o transcrito via 9, e o resultado
       era "51 commits com zero ferramentas" sem nada acusar. */
    A.gravar([
      { dia: '2026-08-10', projeto: 'z', medida: 'esforco', valor: 100 },
      { dia: '2026-08-10', projeto: 'z', medida: 'saida', valor: 10 },
      { dia: '2026-08-11', projeto: 'z', medida: 'saida', valor: 90 },
    ])
    const c = A.cruzar('esforco', 'saida')
    assert.equal(c.linhas.length, 1, 'o cruzamento tem que render uma linha para o projeto z')
    assert.equal(
      c.linhas[0].razao, 10,
      'o dia 11, que só tem um dos lados, não pode entrar na conta: 100/10 = 10, nunca 100/100 = 1',
    )
    assert.ok(c.sozinhos > 0, '`sozinhos` tem que contar o que ficou de fora, senão a tela parece vazia sem dizer por quê')
    console.log('  ok   CC-282: o cruzamento só usa dias que os dois lados enxergam')

    /* 5. Faixa sem base não pode disparar alarme. Alarme que sempre toca é
       alarme que se aprende a ignorar, a mesma lição da guarda que cobrava o
       impossível. */
    const f = A.faixa('esforco', { projeto: 'z', dia: '2026-08-10' })
    assert.equal(f.fora, false, 'com um punhado de dias de história, nada pode ser declarado fora da faixa')
    assert.equal(f.suficiente, false, '`suficiente` tem que dizer que a base é curta')
    console.log('  ok   CC-284: sem base, o alarme fica calado em vez de gritar')

    /* 6. Toda medida do catálogo precisa de rótulo em português e de ajuda.
       Medida cujo nome só existe no código chega na tela como sigla, e sigla é
       exatamente o que ele não tem por que decorar. */
    for (const [id, def] of Object.entries(C.CATALOGO)) {
      assert.ok(def.rotulo && def.rotulo !== id, `a medida "${id}" precisa de um rótulo legível, não do próprio id`)
      assert.ok(def.ajuda && def.ajuda.length > 15, `a medida "${id}" precisa de uma explicação que ensine, não de uma definição circular`)
    }
    console.log(`  ok   CC-281: as ${Object.keys(C.CATALOGO).length} medidas têm nome e explicação em português`)

    /* 7. Toda flag com valor tem que estar registrada no cc.mjs. Sem isso,
         `--dia 2026-08-21` faz a data virar o nome da medida, e o comando
         responde sobre uma medida inexistente sem acusar nada. Aconteceu ao
         escrever este próprio comando. */
    const fonteCc = fs.readFileSync('cc.mjs', 'utf8')
    const blocoArmazem = fonteCc.slice(fonteCc.indexOf("case 'armazem'"), fonteCc.indexOf("case 'sinc'"))
    const listaFlags = fonteCc.slice(fonteCc.indexOf('const FLAGS_WITH_VALUE'), fonteCc.indexOf('const positional'))
    for (const m of blocoArmazem.matchAll(/val\('(--[a-z-]+)'/g)) {
      assert.ok(listaFlags.includes(`'${m[1]}'`), `a flag ${m[1]} lê valor mas não está em FLAGS_WITH_VALUE: o valor dela vira posicional`)
    }
    console.log('  ok   CC-280: as flags com valor estão registradas, e não viram posicional')

    /* 8. O CSV escapa vírgula e aspas. Um projeto com vírgula no nome
       quebraria a coluna, e planilha aberta torta não avisa: só mostra dado no
       lugar errado. */
    A.gravar([{ dia: '2026-08-12', projeto: 'a,b"c', medida: 'm', valor: 3 }])
    const linhaCsv = A.paraCSV(A.ler({ desde: '2026-08-12', ate: '2026-08-12' })).split('\n')[1]
    assert.match(linhaCsv, /"a,b""c"/, 'nome com vírgula e aspas tem que sair escapado no CSV')
    assert.equal(linhaCsv.split(',').length > 5, true, 'o campo escapado continua sendo um campo só para quem lê CSV de verdade')
    console.log('  ok   CC-286: o CSV escapa vírgula e aspas no nome do projeto')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

/* ── CC-298: o recado da trava não pode ter travessão ────────────────────────
   Achado em 22/08, olhando o log novo de travas no telefone dele: o texto que
   aparece é "PAROU COM 9 ITENS ABERTOS — modo Continuativo". A regra número um
   dele proíbe travessão em texto NENHUM, e o sistema que cobra as regras dele
   estava violando a primeira delas dentro do próprio recado.

   Passou despercebido porque o gate confere travessão no que EU escrevo, nunca
   no que as travas escrevem. E agora esse texto tem tela própria: ele lê.

   Só o texto de SAÍDA entra aqui. Comentário de código também está na regra,
   mas é outro item: misturar os dois faria a rede acusar 130 pontos de uma vez
   e ninguém consertaria nenhum. */
{
  const dir = 'hooks'
  const ofensas = []
  const soComentario = (l) => /^\s*(\*|\/\/|\/\*)/.test(l)
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
    const linhas = fs.readFileSync(path.join(dir, f), 'utf8').split('\n')
    linhas.forEach((l, i) => {
      if (!/[—–]/.test(l) || soComentario(l)) return
      /* Quem PROCURA o caractere precisa escrevê-lo. São duas as isenções, e
         as duas são por definição: a trava que caça travessão, e o leitor de
         roadmap, que limpa o traço dos títulos escritos à mão. Ambas dentro de
         um padrão de busca, nunca em texto que alguém lê. */
      if (/\.replace\(|\.match\(|\.test\(|RegExp|TRACO/.test(l)) return
      ofensas.push(`${f}:${i + 1}  ${l.trim().slice(0, 70)}`)
    })
  }
  assert.equal(
    ofensas.length, 0,
    `travessão no recado de trava, e é o texto que ele lê na tela:\n    ${ofensas.slice(0, 12).join('\n    ')}`,
  )
  console.log('  ok   CC-298: nenhum recado de trava usa travessão')
}

/* ── CC-301: o dono de um item também sai da FAIXA ───────────────────────────
   Medido em 22/08: a rota do gate citava nove números, e os itens CC-277 a
   CC-280 nasceram depois de ela ser escrita. Sem entender faixa, o filtro não
   achou dono, tratou tudo como trabalho meu, e a trava de fluxo mandou executar
   item de outra sessão.

   Quem reserva um bloco de trabalho reserva o que nasce dentro dele. */
{
  const os = await import('node:os')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-routia-'))
  fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'docs', 'ROTAS-ATIVAS.md'), [
    '| `gate` | 🔴 ocupada | c213b663 — fazendo CC-275 a CC-280, a tela de conversa | hoje |',
    '| `sistemas` | 🔴 ocupada | 9bad715c — CC-297 e CC-300 | hoje |',
    '| `velha` | 🟢 livre | — (fechou CC-100 a CC-120) | — |',
  ].join('\n'), 'utf8')

  const R = await import(`./src/routia.mjs?t=${Date.now()}`)
  assert.equal(R.donoDoItem('CC-277', raiz), 'c213b663', 'item DENTRO da faixa tem que achar o dono')
  assert.equal(R.donoDoItem('CC-280', raiz), 'c213b663', 'o fim da faixa entra nela')
  assert.equal(R.donoDoItem('CC-275', raiz), 'c213b663', 'o começo da faixa entra nela')
  assert.equal(R.donoDoItem('CC-281', raiz), null, 'logo depois do fim já não é da faixa')
  assert.equal(R.donoDoItem('CC-297', raiz), '9bad715c', 'o número citado direto continua funcionando')
  /* Rota LIVRE não dá dono: quem soltou a rota não segura mais nada dentro
     dela, e tratar como dono devolveria "não é seu" para sempre. */
  assert.equal(R.donoDoItem('CC-110', raiz), null, 'faixa em rota livre não reserva nada')

  assert.equal(R.deOutraSessao('CC-277', raiz, '9bad715c'), true, 'CC-277 é da outra sessão')
  assert.equal(R.deOutraSessao('CC-297', raiz, '9bad715c'), false, 'o meu próprio item continua sendo meu')
  fs.rmSync(raiz, { recursive: true, force: true })
  console.log('  ok   CC-301: a faixa no quadro de rotas também diz de quem é o item')
}

/* ── CC-305: caminho de outra máquina não pode virar caminho relativo ─────────
   Medido em 22/08, e o defeito estava no ar: a federação traz o `cwd` dos
   agentes do PC dele no formato do Windows (`D:\…\renanMarchon`). No Linux isso
   não é caminho absoluto, é um nome de pasta com barras invertidas, e
   `path.dirname` sobe direto para `.` na primeira volta.

   Resultado: a busca achava `docs/ROADMAP.md` do PRÓPRIO PAINEL, e cinco
   projetos do PC apareciam na tela Trabalho com os mesmos 6 cartões e as mesmas
   145 fechadas, que eram do proj_controlcenter. Backlog inteiro atribuído a
   quem não é dono, sem erro nenhum. */
{
  const R = await import(`./src/roadmap.mjs?t=${Date.now()}`)

  assert.equal(R.deOutraPlataforma('D:\\Documentos\\Ti\\projetos\\CLIENTS\\renanMarchon'), true,
    'caminho do Windows com barra invertida é de outra máquina')
  assert.equal(R.deOutraPlataforma('C:/Users/lfeli/projetos/x'), true,
    'letra de drive conta mesmo com barra normal, que é como o Node às vezes normaliza')
  assert.equal(R.deOutraPlataforma('/home/claudedev/projetos/x'), false,
    'caminho desta máquina não pode ser recusado')
  assert.equal(R.deOutraPlataforma('docs'), false,
    'caminho relativo legítimo continua valendo: a recusa é só para marca de outro sistema')

  assert.equal(R.acharRoadmap('D:\\Documentos\\Ti\\projetos\\CLIENTS\\renanMarchon'), null,
    'pasta do PC dele não pode achar roadmap NENHUM aqui, muito menos o do próprio painel')

  /* O caso MISTO, achado pela sessão do Coderoom depois do primeiro conserto:
     um `path.resolve` cola o caminho do Windows depois de uma pasta daqui, e o
     resultado É absoluto, então passava pela primeira versão da guarda. A busca
     subia um nível e entregava o roadmap DO PAINEL. Na tela isso vira 145
     tarefas alheias; dentro do pacote de contexto de um agente, o mesmo
     vazamento fica invisível. */
  const misto = '/home/claudedev/projetos/proj_controlcenter/D:\\Documentos\\Ti\\x'
  assert.equal(R.deOutraPlataforma(misto), true, 'a marca do Windows conta em qualquer posição, não só no começo')
  assert.equal(R.acharRoadmap(misto), null, 'caminho misto não pode achar o roadmap do painel')
  assert.equal(R.deOutraPlataforma('/tmp/x/C:/Users/y'), true, 'letra de drive no meio também é de outra máquina')

  /* A prova negativa, que é a que importa: sem a guarda, o caminho do Windows
     encontra o roadmap do painel. Se alguém remover a recusa, este assert cai. */
  const achado = R.acharRoadmap('/home/claudedev/projetos/proj_controlcenter')
  assert.ok(!achado || path.isAbsolute(achado),
    'o que a busca devolve tem que ser caminho absoluto, senão foi resolvido contra a pasta do painel')
  console.log('  ok   CC-305: pasta de outra máquina não herda o roadmap do painel')
}

/* ── CC-305, a mesma família no outro lado ───────────────────────────────────
   A sessão do Coderoom consertou o próprio caminho depois do aviso, e pediu que
   a prova entrasse aqui: até agora ela vivia num arquivo avulso, fora do gate.
   Peça guardada só por arquivo que ninguém roda volta a quebrar, e este projeto
   já tem o caso registrado (o catálogo de hooks).

   O que ela mediu, e vale registrar porque muda a conclusão: a rota dela já
   recusava caminho do Windows, mas **por acaso**. O `path.resolve` colava
   `D:\…` na pasta de quem roda, e o que segurava era a checagem de base logo
   depois. Sorte não é desenho: uma mudança futura que subisse diretórios
   reabriria o buraco calada, que é exatamente o que aconteceu do meu lado. */
{
  const G = await import(`./src/gate.mjs?t=${Date.now()}`)
  assert.equal(typeof G.deOutraMaquina, 'function', 'o gate precisa expor a recusa, senão ninguém pode conferi-la')

  for (const caminho of [
    'D:\\Documentos\\Ti\\projetos\\CLIENTS\\renanMarchon',
    'D:/Documentos/Ti/projetos',
    'c:/users/lfeli/projetos/x',
    '\\\\servidor\\pasta',
  ]) {
    assert.equal(G.deOutraMaquina(caminho), true, `caminho de outra máquina tem que ser recusado: ${caminho}`)
  }
  for (const caminho of ['/home/claudedev/projetos/x', 'docs', './src']) {
    assert.equal(G.deOutraMaquina(caminho), false, `caminho daqui não pode ser recusado: ${caminho}`)
  }
  console.log('  ok   CC-305: o gate também recusa pasta que não é desta máquina')
}
