/**
 * CC-834: a tarefa como máquina de estados (src/tarefa.mjs). Função pura, sem disco.
 */
import assert from 'node:assert'
import { TRANSICOES, caminhoSeguro, podeIr, transicionar, validarPlano } from './src/tarefa.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok++; console.log('  ok   ' + nome) }
const recusa = (nome, fn, trecho) => t(nome, () => assert.throws(fn, (e) => e.message.includes(trecho)))
const hoje = '2026-10-01'
const base = () => [
  { id: 'X-1', estado: 'B1', pronto: 'tudo junto' },
  { id: 'X-2', estado: 'B1', pai: 'X-1', pronto: 'parte a' },
  { id: 'X-3', estado: 'B1', pai: 'X-1', pronto: 'parte b' },
  { id: 'X-4', estado: 'B0' },
]
const mover = (itens, id, para, extras) => transicionar(itens, id, para, extras, { hoje })

/* CC-835: a tabela */
t('todo estado da tabela leva só a estados que existem', () => {
  for (const [de, paras] of Object.entries(TRANSICOES)) for (const p of paras) assert.ok(TRANSICOES[p], `${de} -> ${p}`)
})
t('fechar e cancelar valem de qualquer estado aberto', () => {
  for (const de of ['B0', 'B1', 'EM', 'PR', 'DE', 'TR']) assert.ok(podeIr(de, 'OK') && podeIr(de, 'KO'), de)
})
recusa('ideia não anda sem passar pela especificação', () => mover(base(), 'X-4', 'EM'), 'não pode ir de B0 para EM')
recusa('"falta prova" só depois de andar', () => mover(base(), 'X-2', 'PR'), 'não pode ir de B1 para PR')
recusa('guarda: não anda sem critério de pronto', () => mover([{ id: 'X-9', estado: 'DE', decisao: 'x' }], 'X-9', 'EM'), 'sem critério de pronto')
recusa('guarda: o pai não fecha com micro tarefa aberta', () => mover(base(), 'X-1', 'OK', { prova: 'p' }), 'micro tarefa(s) aberta(s)')
recusa('a validação de fora vale (fechar sem prova)', () => transicionar(base(), 'X-2', 'OK', {}, { hoje, validar: (i) => (i.estado === 'OK' && !i.prova ? ['fechado sem prova'] : []) }), 'fechado sem prova')
t('ficar no mesmo estado só acrescenta campo, sem evento de estado', () => {
  const r = mover(base(), 'X-2', 'B1', { conversa: 'c1' })
  assert.equal(r.item.conversa, 'c1'); assert.deepEqual(r.eventos, [])
})

/* CC-835: os efeitos */
t('efeito: a primeira micro tarefa andando põe o pai andando, e os dois viram evento', () => {
  const r = mover(base(), 'X-2', 'EM')
  assert.equal(r.itens.find((x) => x.id === 'X-1').estado, 'EM')
  assert.deepEqual(r.eventos.map((e) => `${e.id}:${e.de}>${e.para}`), ['X-2:B1>EM', 'X-1:B1>EM'])
})
t('efeito: a última micro tarefa fechando põe o pai em "falta prova", e não fechado', () => {
  let it = mover(base(), 'X-2', 'EM').itens
  it = mover(it, 'X-2', 'OK', { prova: 'a' }).itens
  assert.equal(it.find((x) => x.id === 'X-1').estado, 'EM', 'ainda falta a X-3')
  const r = mover(it, 'X-3', 'OK', { prova: 'b' })
  assert.equal(r.itens.find((x) => x.id === 'X-1').estado, 'PR')
  assert.equal(mover(r.itens, 'X-1', 'OK', { prova: 'conferido' }).item.estado, 'OK', 'e a conferência do pai fecha')
})
t('a prova ao contrário: todas canceladas não põem o pai em "falta prova"', () => {
  let it = base()
  it = mover(it, 'X-2', 'KO', { porque: 'x' }).itens
  it = mover(it, 'X-3', 'KO', { porque: 'x' }).itens
  assert.equal(it.find((x) => x.id === 'X-1').estado, 'B1')
})
t('função pura: a lista de entrada não muda', () => {
  const it = base(); const copia = JSON.stringify(it)
  mover(it, 'X-2', 'EM'); assert.equal(JSON.stringify(it), copia)
})

/* CC-837: o contrato do plano */
const plano = (tarefas, extra = {}) => JSON.stringify({ escopo: 'jogo em src/main.js', tarefas, ...extra })
const boa = { titulo: 'contar monstros', pedido: 'somar um ao matar monstro', arquivos: ['src/main.js'] }
t('plano no formato passa, puro ou dentro de um bloco de código', () => {
  assert.equal(validarPlano(plano([boa])).ok, true)
  const v = validarPlano('```json\n' + plano([boa]) + '\n```')
  assert.equal(v.ok, true); assert.deepEqual(v.plano.tarefas, [boa]); assert.equal(v.plano.escopo, 'jogo em src/main.js')
})
const recusaPlano = (nome, texto, trecho) => t(nome, () => {
  const v = validarPlano(texto)
  assert.equal(v.ok, false); assert.ok(v.erros.some((e) => e.includes(trecho)), v.erros.join(' | '))
})
recusaPlano('texto em volta do JSON é recusado, não garimpado', 'Claro! Aqui está:\n' + plano([boa]), 'não é um JSON só')
recusaPlano('mais de 8 tarefas é recusado, não cortado', plano(Array(9).fill(boa)), 'de 1 a 8')
recusaPlano('lista vazia é recusada', plano([]), 'de 1 a 8')
recusaPlano('campo desconhecido é recusado', plano([{ ...boa, comando: 'rm -rf /' }]), 'campo desconhecido comando')
recusaPlano('pedido curto demais é recusado', plano([{ ...boa, pedido: 'faz' }]), 'pedido tem de ter')
recusaPlano('caminho para fora do projeto é recusado', plano([{ ...boa, arquivos: ['../../etc/passwd'] }]), 'sai do projeto')
recusaPlano('caminho absoluto é recusado', plano([{ ...boa, arquivos: ['/etc/passwd'] }]), 'absoluto')
recusaPlano('arquivo de segredo é recusado', plano([{ ...boa, arquivos: ['.env.local'] }]), 'segredo')
recusaPlano('o .git é recusado', plano([{ ...boa, arquivos: ['.git/config'] }]), '.git')
t('o modelo de .env (.env.example) é permitido', () => assert.equal(caminhoSeguro('.env.example'), null))
/* CC-846: o que uma tarefa deixa para a outra */
recusaPlano('tarefa que não é a última sem "deixa" é recusada', plano([boa, boa]), 'falta "deixa"')
t('com "deixa" na primeira, o plano de duas passa, e a última não precisa', () => {
  const v = validarPlano(plano([{ ...boa, deixa: 'o quadro #death-record no index.html' }, boa]))
  assert.equal(v.ok, true, v.erros.join(' | ')); assert.equal(v.plano.tarefas[0].deixa, 'o quadro #death-record no index.html')
})
{
  const { textoDaTarefa } = await import('./src/maestro.mjs')
  const feita = { id: 'SM-12', intencao: 'criar o quadro do recorde', pronto: 'quadro no fim de jogo\nDeixa para as próximas: o quadro #death-record no index.html', prova: 'robô: alterou index.html; build passou' }
  const msg = textoDaTarefa({ id: 'SM-13', intencao: 'salvar o recorde', pronto: 'salva e mostra', arquivos: ['src/main.js'] }, null, [feita])
  t('a micro tarefa seguinte recebe o que a anterior deixou, antes do pedido dela', () => {
    assert.match(msg, /^JÁ FEITO NESTE PEDIDO[\s\S]*SM-12 criar o quadro do recorde[\s\S]*#death-record[\s\S]*---\nMicro tarefa SM-13/)
  })
}

/* CC-838: conferências de lista fechada */
const { lerConferencia, rodarConferencia } = await import('./src/conferencia.mjs')
t('os tipos da lista são reconhecidos', () => {
  assert.equal(lerConferencia('auto:build').tipo, 'build')
  assert.equal(lerConferencia('auto:npm test').tipo, 'teste')
  assert.deepEqual(lerConferencia('auto:node test-tarefa.mjs').args, ['test-tarefa.mjs'])
  assert.equal(lerConferencia('auto:contem src/a.js placar').texto, 'placar')
  assert.equal(lerConferencia('auto:responde https://testedevoo.carzo.com.br/aventura/').tipo, 'responde')
})
for (const [nome, c] of [
  ['comando solto não roda', 'auto:rm -rf ~'],
  ['comando colado em teste não roda', 'auto:npm test; rm -rf ~'],
  ['node com arquivo que não é teste não roda', 'auto:node src/web.mjs'],
  ['contem fora do projeto não roda', 'auto:contem ../../etc/passwd root'],
  ['responde para endereço de fora não roda', 'auto:responde https://exemplo.com/'],
  ['conferência de olho não roda', 'olho:abrir o jogo'],
]) t(`lista fechada: ${nome}`, () => assert.equal(lerConferencia(c).conhecido, false))
/* CC-872: teste em Python entra na lista fechada, sempre como `python -m pytest -q` */
t('CC-872: pytest é reconhecido, com ou sem alvo, e nunca vira comando livre', () => {
  const sem = lerConferencia('auto:pytest'); const com = lerConferencia('auto:pytest tests/test_x.py')
  assert.equal(sem.conhecido, true); assert.deepEqual(sem.args, ['-m', 'pytest', '-q']); assert.equal(sem.cmd, 'python3')
  assert.deepEqual(com.args, ['-m', 'pytest', '-q', 'tests/test_x.py'])
  for (const ruim of ['auto:pytest; rm -rf ~', 'auto:pytest ../fora', 'auto:pytest tests/a.py --co', 'auto:pytest /etc/passwd']) assert.equal(lerConferencia(ruim).conhecido, false, ruim)
})
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-py-'))
  fs.mkdirSync(path.join(proj, '.venv', 'bin'), { recursive: true })
  const py = path.join(proj, '.venv', 'bin', 'python')
  // um python de mentira: o do .venv do projeto vence o do sistema (que aqui nem tem pytest)
  fs.writeFileSync(py, '#!/bin/sh\necho "3 passed"\nexit 0\n'); fs.chmodSync(py, 0o755)
  const passou = await rodarConferencia(proj, lerConferencia('auto:pytest'))
  fs.mkdirSync(path.join(proj, 'tests')); fs.writeFileSync(path.join(proj, 'tests', 'test_x.py'), 'def test_x(): assert 1 == 2\n')
  fs.writeFileSync(py, '#!/bin/sh\necho "AssertionError: 1 != 2"\nexit 1\n')
  const falhou = await rodarConferencia(proj, lerConferencia('auto:pytest tests/test_x.py'))
  fs.rmSync(proj, { recursive: true, force: true })
  t('CC-872: pytest que passa fecha com a prova escrita; o que falha mostra a asserção', () => {
    assert.equal(passou.ok, true); assert.match(passou.prova, /robô: pytest passou/)
    assert.equal(falhou.ok, false); assert.match(falhou.erro, /AssertionError: 1 != 2/)
  })
}
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-'))
  fs.writeFileSync(path.join(d, 'a.js'), 'const placar = 0')
  const sim = await rodarConferencia(d, lerConferencia('auto:contem a.js placar'))
  const nao = await rodarConferencia(d, lerConferencia('auto:contem a.js vida'))
  const semTeste = await rodarConferencia(d, lerConferencia('auto:node test-nao-existe.mjs'))
  const solto = await rodarConferencia(d, lerConferencia('auto:rm -rf ~'))
  fs.rmSync(d, { recursive: true, force: true })
  t('contem: passa com o texto e reprova sem, com a prova escrita', () => {
    assert.equal(sim.ok, true); assert.match(sim.prova, /contém "placar"/)
    assert.equal(nao.ok, false); assert.match(nao.erro, /não contém "vida"/)
  })
  t('teste que não existe e comando solto nem chegam a rodar', () => {
    assert.equal(semTeste.rodou, false); assert.equal(solto.rodou, false); assert.equal(solto.ok, false)
  })
}

/* CC-841: segredo nunca entra no pedido */
const { acharSegredos, limparSegredos } = await import('./src/segredo.mjs')
const falsa = (pre, n) => pre + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6'.slice(0, n)
for (const [tipo, valor] of [
  ['chave da Anthropic', falsa('sk-ant-api03-', 40)],
  ['token do GitHub', falsa('ghp_', 36)],
  ['chave da AWS', 'AKIA' + 'ABCDEFGHIJKLMNOP'],
  ['chave do Google', falsa('AIza', 35)],
  ['chave privada', '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----'],
]) t(`segredo: ${tipo} sai do texto e o resto fica`, () => {
  const txt = `antes ${valor} depois`
  assert.equal(acharSegredos(txt)[tipo], 1)
  const limpo = limparSegredos(txt)
  assert.ok(!limpo.includes(valor)); assert.match(limpo, new RegExp(`^antes \\[SEGREDO REMOVIDO: ${tipo}\\] depois$`))
})
t('segredo: linha de .env com nome de segredo perde o valor, e a de configuração comum fica', () => {
  const env = 'PORT=5173\nOPENAI_API_KEY="abcdef123456"\nexport DB_PASSWORD=hunter2hunter\nNODE_ENV=production'
  const l = limparSegredos(env)
  assert.match(l, /PORT=5173/); assert.match(l, /NODE_ENV=production/)
  assert.ok(!l.includes('abcdef123456') && !l.includes('hunter2hunter'))
})
t('segredo: senha dentro de endereço sai, usuário e host ficam', () => {
  assert.equal(limparSegredos('postgres://app:s3nhaForte@db:5432/x'), 'postgres://app:[SEGREDO REMOVIDO: senha em endereço]@db:5432/x')
})
t('segredo: a prova ao contrário, hash de commit e id de tarefa não são mutilados', () => {
  const txt = 'commit ef2698f4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6 fecha CC-834 e SM-12'
  assert.deepEqual(acharSegredos(txt), {}); assert.equal(limparSegredos(txt), txt)
})

/* CC-845: conferência de comportamento entra na lista fechada, só para endereço permitido */
t('abre e anda são reconhecidos para o testedevoo e o endereço local', () => {
  assert.equal(lerConferencia('auto:anda https://testedevoo.carzo.com.br/aventura/').tipo, 'anda')
  assert.equal(lerConferencia('auto:abre http://127.0.0.1:5295/').tipo, 'abre')
  assert.equal(lerConferencia('auto:anda https://exemplo.com/').conhecido, false)
})
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const { conferenciaDoProjeto } = await import('./src/maestro.mjs')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'))
  fs.writeFileSync(path.join(d, 'AGENTS.md'), '# jogo\n\nConferência padrão: auto:anda https://testedevoo.carzo.com.br/x/\n')
  const lida = conferenciaDoProjeto(d)
  fs.rmSync(d, { recursive: true, force: true })
  t('o projeto declara a conferência padrão uma vez no AGENTS.md', () => assert.equal(lida, 'auto:anda https://testedevoo.carzo.com.br/x/'))
}

/* CC-847: trava de arquivo durante a micro tarefa, mordendo de verdade */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trava-'))
  process.env.CC_TRAVAS_ARQ = path.join(d, 'travas.json')
  fs.writeFileSync(path.join(d, 'main.js'), 'x'); fs.writeFileSync(path.join(d, 'outro.js'), 'y')
  const Tv = await import('./src/travaArquivo.mjs')
  const gancho = (arquivo, dono) => spawnSync(process.execPath, ['hooks/edicao-guard.mjs'], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: arquivo }, cwd: d }),
    env: { ...process.env, CC_TRAVA_DONO: dono || '' }, encoding: 'utf8',
  })
  Tv.travar(d, ['main.js'], { dono: 'gate:c1', ate: Date.now() + 60000, motivo: 'SM-13 salvar recorde' })
  const outraSessao = gancho('main.js', null); const dona = gancho('main.js', 'gate:c1'); const resto = gancho('outro.js', null)
  const { Prumo } = await import('./hooks/opencode-prumo.mjs')
  const plugin = await Prumo({ directory: d })
  const editarComo = async (dono) => { process.env.CC_TRAVA_DONO = dono; try { await plugin['tool.execute.before']({ tool: 'edit', sessionID: dono }, { args: { filePath: path.join(d, 'main.js') } }); return 'passou' } catch (e) { return e.message } finally { delete process.env.CC_TRAVA_DONO } }
  const ocOutro = await editarComo('gate:c2'); const ocDono = await editarComo('gate:c1')
  Tv.destravar('gate:c1'); const depois = gancho('main.js', null)
  Tv.travar(d, ['main.js'], { dono: 'gate:morto', ate: Date.now() - 1 }); const vencida = gancho('main.js', null)
  fs.rmSync(d, { recursive: true, force: true }); delete process.env.CC_TRAVAS_ARQ
  t('trava: outra sessão do Claude é RECUSADA no arquivo travado, com o motivo', () => {
    assert.equal(outraSessao.status, 2); assert.match(outraSessao.stderr, /TRAVADO pelo maestro \(SM-13 salvar recorde\)/)
  })
  t('trava: o agente da conversa dona passa, e o resto do projeto fica livre', () => { assert.equal(dona.status, 0); assert.equal(resto.status, 0) })
  t('trava: o opencode de outra conversa é recusado pelo Prumo, e o da dona passa', () => { assert.match(ocOutro, /TRAVADO/); assert.equal(ocDono, 'passou') })
  t('trava: some ao destravar, e prazo vencido não prende ninguém', () => { assert.equal(depois.status, 0); assert.equal(vencida.status, 0) })
}

/* CC-852: build por pasta (monorepo) e a declaração da conferência no AGENTS.md */
t('build por pasta: aceita pastas do projeto e recusa caminho para fora', () => {
  assert.deepEqual(lerConferencia('auto:build apps/a apps/b').pastas, ['apps/a', 'apps/b'])
  assert.equal(lerConferencia('auto:build ../x').conhecido, false)
})
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const { declararConferencia, conferenciaDoProjeto } = await import('./src/maestro.mjs')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'decl-'))
  fs.writeFileSync(path.join(d, 'AGENTS.md'), '# meu projeto\n\nTexto que ele escreveu.\n')
  const ok1 = await declararConferencia(d, 'auto:build apps/web', 'validada em 02/10')
  const ok2 = await declararConferencia(d, 'auto:npm test')
  const final = fs.readFileSync(path.join(d, 'AGENTS.md'), 'utf8')
  const vazio = fs.mkdtempSync(path.join(os.tmpdir(), 'decl2-')); const ok3 = await declararConferencia(vazio, 'auto:build')
  fs.rmSync(d, { recursive: true, force: true })
  t('declarar conferência: entra abaixo do título, troca a anterior sem duplicar, e o texto dele fica', () => {
    assert.ok(ok1 && ok2 && ok3)
    assert.equal((final.match(/Conferência padrão/g) || []).length, 1)
    assert.match(final, /^# meu projeto\n\nConferência padrão: auto:npm test\n[\s\S]*Texto que ele escreveu\./)
    assert.equal(conferenciaDoProjeto(vazio), 'auto:build')
  })
  fs.rmSync(vazio, { recursive: true, force: true })
}

/* 02/10: a skill do Nisaba sai do repositório para os três agentes (numa casa temporária) */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'casa-'))
  const rodar = () => JSON.parse(spawnSync(process.execPath, ['-e', "import('./src/skills.mjs').then(S=>console.log(JSON.stringify(S.instalarDoRepositorio().feitos)))"], { env: { ...process.env, HOME: d, CC_HOME: path.join(d, '.claude') }, encoding: 'utf8' }).stdout)
  const um = rodar(); const dois = rodar()
  const naCasa = fs.existsSync(path.join(d, '.claude', 'skills', 'nisaba', 'SKILL.md'))
  fs.rmSync(d, { recursive: true, force: true })
  t('a skill do Nisaba é instalada nos três agentes, e reinstalar sem mudança não regrava', () => {
    assert.deepEqual(um.filter((f) => f.skill === 'nisaba').map((f) => `${f.agente}:${f.acao}`), ['claude:criada', 'opencode:criada', 'agy:criada'])
    assert.equal(dois.length, 0); assert.ok(naCasa)
  })
}

/* CC-851: o gancho do Nisaba, rodando de verdade como uma sessão do Claude rodaria */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const casaN = fs.mkdtempSync(path.join(os.tmpdir(), 'nis-casa-'))
  const proj = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nis-')), 'VPS_teste_nisaba')
  fs.mkdirSync(path.join(proj, 'docs'), { recursive: true }); fs.mkdirSync(path.join(proj, 'src'))
  const hoje = new Date().toISOString().slice(0, 10)
  const backlog = (itens) => fs.writeFileSync(path.join(proj, 'docs', 'backlog.jsonl'), itens.map((x) => JSON.stringify(x)).join('\n') + '\n')
  const gancho = (arquivo, cfg = {}) => {
    fs.mkdirSync(path.join(casaN, '.claude'), { recursive: true })
    fs.writeFileSync(path.join(casaN, '.claude', 'control-center.json'), JSON.stringify(cfg))
    return spawnSync(process.execPath, ['hooks/edicao-guard.mjs'], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(proj, arquivo) }, cwd: proj }),
      env: { ...process.env, CC_HOME: path.join(casaN, '.claude'), CC_TRAVAS_ARQ: path.join(casaN, 'travas.json'), CC_TRAVA_DONO: '' }, encoding: 'utf8',
    })
  }
  backlog([{ id: 'TN-1', titulo: 'velho', estado: 'EM', frente: 'x', mexido: '2026-01-01' }])
  const semTarefa = gancho('src/a.js'); const doc = gancho('docs/notas.md'); const agents = gancho('AGENTS.md'); const mao = gancho('docs/backlog.jsonl')
  const desligado = gancho('src/a.js', { modulosProjeto: { VPS_teste_nisaba: { nisaba: false } } })
  backlog([{ id: 'TN-1', titulo: 'agora', estado: 'EM', frente: 'x', mexido: hoje }])
  const comTarefa = gancho('src/a.js')
  fs.rmSync(casaN, { recursive: true, force: true }); fs.rmSync(path.dirname(proj), { recursive: true, force: true })
  t('gancho: código sem tarefa andando hoje é recusado, com o comando de registrar (tarefa velha não vale)', () => {
    assert.equal(semTarefa.status, 2); assert.match(semTarefa.stderr, /NISABA: nenhuma tarefa ANDANDO hoje[\s\S]*backlog novo/)
  })
  t('gancho: documentação e AGENTS.md ficam livres', () => { assert.equal(doc.status, 0); assert.equal(agents.status, 0) })
  t('gancho: o backlog não se edita à mão', () => { assert.equal(mao.status, 2); assert.match(mao.stderr, /não se edita à mão/) })
  t('gancho: com tarefa andando hoje, passa', () => assert.equal(comTarefa.status, 0))
  t('gancho: o Nisaba desligado no projeto (tela Projetos) cala o gancho ali', () => assert.equal(desligado.status, 0))
}

/* CC-867: o cérebro do arquiteto (estado, contrato da proposta, Haiku de mentira) */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs')
  const boa = { tipo: 'pedido', titulo: 'Gráfico de mercado por mês', porque: 'a primeira fatia já fechou e esta é a próxima da fila', pergunta: 'Faço o gráfico de gastos de mercado por mês agora?', opcoes: ['Sim, faz agora', 'Não, primeiro as contas fixas'], pedido: 'criar na tela Gastos um gráfico com o total de mercado de cada mês', executa: 'Sim, faz agora' }
  const recusaP = (nome, obj, trecho) => t(`arquiteto, contrato: ${nome}`, () => {
    const v = Ar.validarProposta(typeof obj === 'string' ? obj : JSON.stringify(obj)); assert.equal(v.ok, false); assert.ok(v.erros.some((e) => e.includes(trecho)), v.erros.join(' | '))
  })
  t('arquiteto, contrato: proposta no formato passa, pura ou em bloco de código', () => {
    assert.equal(Ar.validarProposta(JSON.stringify(boa)).ok, true)
    assert.equal(Ar.validarProposta('```json\n' + JSON.stringify(boa) + '\n```').proposta.opcoes.length, 2)
  })
  recusaP('texto em volta é recusado', 'Claro! ' + JSON.stringify(boa), 'JSON só')
  recusaP('tipo desconhecido', { ...boa, tipo: 'executar' }, 'tipo tem de ser')
  recusaP('uma opção só', { ...boa, opcoes: ['Sim'] }, 'opcoes')
  recusaP('opção vaga', { ...boa, opcoes: ['Sim', 'Talvez depois'] }, 'opção vaga')
  recusaP('pedido sem o pedido técnico', { ...boa, pedido: undefined }, 'pedido técnico')
  recusaP('travessão', { ...boa, porque: 'a fila andou — e esta é a próxima' }, 'travessão')
  recusaP('campo a mais', { ...boa, executar: true }, 'campo desconhecido')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'arq-'))
  fs.mkdirSync(path.join(d, 'docs'))
  fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), JSON.stringify({ id: 'CDC-1', titulo: 'anotar gasto', intencao: 'anotar um gasto em 3 toques', estado: 'B1', frente: 'x', pronto: 'lança um gasto em 3 toques', conferir: 'olho:abrir', natureza: 'PED', area: 'tela', tamanho: 'M' }) + '\n')
  fs.writeFileSync(path.join(d, 'AGENTS.md'), '# conta\n\n## Escopo do projeto\n\nApp de finanças pessoais.\n')
  // CC-941: pedido só passa se for de um item do backlog dele; o gráfico de mercado está lá
  fs.appendFileSync(path.join(d, 'docs', 'backlog.jsonl'), JSON.stringify({ id: 'CDC-2', titulo: 'grafico', intencao: 'Gráfico de gastos de mercado por mês', estado: 'B1', origem: 'felipe', frente: 'x', pronto: 'o gráfico mostra o mercado de cada mês', conferir: 'olho:ver o gráfico' }) + '\n')
  const est = Ar.lerEstado(d)
  // o Haiku de mentira: na 1a vez responde fora do formato, na 2a responde certo (prova a volta do erro)
  const falso = path.join(d, 'haiku-falso.mjs'); const marca = path.join(d, 'chamadas')
  fs.writeFileSync(falso, `#!/usr/bin/env node\nimport fs from 'node:fs'\nlet e='';process.stdin.on('data',x=>e+=x).on('end',()=>{const n=(fs.existsSync('${marca}')?Number(fs.readFileSync('${marca}','utf8')):0)+1;fs.writeFileSync('${marca}',String(n));fs.appendFileSync('${marca}.entrada',e+'\\n=====\\n');console.log(n===1?'Claro, segue: nada':${JSON.stringify(JSON.stringify(boa))})})`)
  fs.chmodSync(falso, 0o755)
  const r = await Ar.propor(d, { binario: falso })
  const entradas = fs.readFileSync(marca + '.entrada', 'utf8')
  fs.rmSync(d, { recursive: true, force: true })
  t('arquiteto: o estado junta fila, escopo e o que espera por ele', () => {
    assert.equal(est.escopo, 'App de finanças pessoais.'); assert.deepEqual(est.fila.map((x) => x.id), ['CDC-1', 'CDC-2']); assert.equal(est.abertos, 2)
  })
  t('arquiteto: a proposta recusada volta ao Haiku com o motivo, e a segunda passa', () => {
    assert.equal(r.proposta.titulo, 'Gráfico de mercado por mês')
    assert.match(entradas, /RECUSADA PELO CONTRATO[\s\S]*JSON só/)
    assert.match(entradas, /CDC-1/, 'o Haiku recebe o estado do projeto')
  })
}

/* CC-910: aprovar em lote. `responder` com ARRAY de rótulos fecha a ficha e grava a decisão com as duas escolhas */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs'); const Bk = await import('./src/backlog.mjs')
  const d = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arq910-')), 'VPS_lote-teste')
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  const prop = { tipo: 'ideia', titulo: 'Partes do app', porque: 'o produto tem varias partes', pergunta: 'Quais partes o app tem?', opcoes: ['Entrar', 'Planilha, semanal', 'Perfil'] }
  const falso = path.join(path.dirname(d), 'haiku.mjs')
  fs.writeFileSync(falso, `#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>console.log(${JSON.stringify(JSON.stringify(prop))}))`); fs.chmodSync(falso, 0o755)
  const p1 = await Ar.passo(d, { binario: falso })
  const fechada = Ar.responder(d, p1.pergunta.id, ['Entrar', 'Planilha, semanal'])
  const hist = Bk.historia(p1.pergunta.id, Bk.caminhoPadrao(d))
  fs.rmSync(path.dirname(d), { recursive: true, force: true })
  t('CC-910: responder com array de rótulos fecha a ficha e grava a decisão com as duas escolhas', () => {
    assert.equal(fechada.estado, 'OK')
    assert.ok(hist.some((e) => e.tipo === 'decisao' && /> Entrar, Planilha, semanal$/.test(e.texto || '')), JSON.stringify(hist))
  })
}

/* CC-867, etapa 2: a pergunta que espera sem prender processo */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs'); const Bk = await import('./src/backlog.mjs')
  const d = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arq2-')), 'VPS_conta-teste')
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  const prop = { tipo: 'ideia', titulo: 'Separar contas fixas', porque: 'a entrevista disse que contas fixas importam', pergunta: 'Separo as contas fixas numa tela própria?', opcoes: ['Sim, tela própria', 'Não, junto dos gastos'] }
  const falso = path.join(path.dirname(d), 'haiku.mjs')
  fs.writeFileSync(falso, `#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>console.log(${JSON.stringify(JSON.stringify(prop))}))`); fs.chmodSync(falso, 0o755)
  const p1 = await Ar.passo(d, { binario: falso })
  const p2 = await Ar.passo(d, { binario: falso })
  const msg = Ar.mensagemDaPergunta(p1.pergunta)
  const fechada = Ar.responder(d, p1.pergunta.id, 'Sim, tela própria')
  const hist = Bk.historia(p1.pergunta.id, Bk.caminhoPadrao(d)).map((e) => e.tipo)
  let duas = null; try { Ar.responder(d, p1.pergunta.id, 'de novo') } catch (e) { duas = e.message }
  const est = Ar.lerEstado(d)
  fs.rmSync(path.dirname(d), { recursive: true, force: true })
  t('arquiteto: a pergunta vira ficha "decisão dele" com as opções, e com ela aberta o passo não propõe outra', () => {
    assert.equal(p1.pergunta.estado, 'DE'); assert.deepEqual(p1.pergunta.opcoes, prop.opcoes)
    assert.equal(p2.esperando?.id, p1.pergunta.id, 'uma pergunta aberta por projeto')
  })
  t('arquiteto: a mensagem leva uma opção por botão, todas apontando para a ficha', () => {
    assert.match(msg.texto, /Ideia \(CN-1\): Separar contas fixas/)
    assert.deepEqual(msg.acoes, [{ rotulo: 'Sim, tela própria', arquiteto: 'CN-1' }, { rotulo: 'Não, junto dos gastos', arquiteto: 'CN-1' }])
  })
  t('arquiteto: a resposta vai para o diário como decisão, fecha a pergunta, e não aceita responder duas vezes', () => {
    assert.equal(fechada.estado, 'OK'); assert.ok(hist.includes('decisao')); assert.match(duas, /não é uma pergunta do arquiteto esperando/)
    assert.match(est.decisoes.at(-1).texto, /Separo as contas fixas[\s\S]*> Sim, tela própria/, 'a próxima proposta lê a decisão dele')
  })
}

/* CC-867: com o projeto em Definição, a pergunta sai do roteiro da entrevista, sem IA */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs'); const D = await import('./src/frameworkDisco.mjs'); const E = await import('./src/entrevista.mjs')
  const d = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arq3-')), 'VPS_conta-teste')
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  fs.mkdirSync(path.join(d, D.PASTA)); fs.writeFileSync(path.join(d, D.PASTA, D.ARQUIVO), JSON.stringify({ metodo: 'mvp-basico', modo: 'sugestivo', fase: 'definicao' }))
  const primeira = E.proxima({})
  const p1 = await Ar.passo(d, { binario: '/bin/false' })  // Haiku que sempre falha: se fosse chamado, o passo quebraria

  const semOp = fs.mkdtempSync(path.join(os.tmpdir(), 'arq4-'))
  const sug = path.join(semOp, 'haiku.mjs')
  fs.writeFileSync(sug, `#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({multipla:true,opcoes:[{rotulo:'Controlar gastos',descricao:'ver para onde vai o dinheiro'},{rotulo:'Planejar o mes'},{rotulo:'Juntar comprovantes'}]})))`); fs.chmodSync(sug, 0o755)
  const sugestao = await Ar.sugerirOpcoes(d, { pergunta: 'O que ele entrega?', porque: 'x', _respostas: ['natureza: Ferramenta interna'] }, { binario: sug })
  const falha = await Ar.sugerirOpcoes(d, { pergunta: 'x', porque: 'x' }, { binario: '/bin/false' })
  const msgSug = Ar.mensagemDaPergunta({ id: 'CN-9', decisao: 'q?', opcoes: sugestao.opcoes, proposta: { tipo: 'entrevista', titulo: 't', porque: 'p', ...sugestao } })
  const msgSem = Ar.mensagemDaPergunta({ id: 'CN-9', decisao: 'q?', opcoes: [], proposta: { tipo: 'entrevista', titulo: 't', porque: 'p' } })
  fs.rmSync(semOp, { recursive: true, force: true })
  t('arquiteto: pergunta sem opção ganha sugestões do Haiku, com descrição e marca de múltipla', () => {
    assert.deepEqual(sugestao.opcoes, ['Controlar gastos', 'Planejar o mes', 'Juntar comprovantes']); assert.equal(sugestao.multipla, true)
    assert.equal(msgSug.acoes[0].descricao, 'ver para onde vai o dinheiro'); assert.equal(msgSug.acoes[0].multipla, true)
  })
  t('arquiteto: Haiku que falha não derruba a pergunta: sem sugestão, só o campo de texto', () => {
    assert.equal(falha, null); assert.deepEqual(msgSem.acoes, [{ rotulo: 'Outra resposta', arquiteto: 'CN-9', soTexto: true }]); assert.doesNotMatch(msgSem.texto, /Responda escrevendo/)
  })
  const msg = Ar.mensagemDaPergunta(p1.pergunta)
  const escolha = primeira.opcoes?.[0]?.label || 'um app de contas da casa'
  Ar.responder(d, p1.pergunta.id, escolha)
  const respostas = E.respostasDe(D.ler(d, { sessao: null }))
  fs.writeFileSync(path.join(d, D.PASTA, D.ARQUIVO), JSON.stringify({ metodo: 'mvp-basico', fase: 'execucao' }))
  const fora = Ar.perguntaDaEntrevista(d)
  fs.rmSync(path.dirname(d), { recursive: true, force: true })
  t('arquiteto: na Definição pergunta o roteiro da entrevista, sem chamar o Haiku', () => {
    assert.equal(p1.proposta.tipo, 'entrevista'); assert.equal(p1.pergunta.decisao, primeira.pergunta)
    assert.equal(msg.acoes.length, (primeira.opcoes || []).length)
  })
  t('arquiteto: a resposta dele entra na entrevista de verdade', () => assert.ok(respostas[primeira.id], JSON.stringify(respostas)))
  t('arquiteto: fora da Definição não entrevista de novo', () => assert.equal(fora, null))
}

/* CC-879: conversa que o maestro cria não aparece como "esperando você" */
{
  const { conversaDoMaestro } = await import('./src/cockpit2.mjs')
  t('Sessões: conversa de micro tarefa e do maestro não esperam por ele; as dele e a do arquiteto sim', () => {
    for (const x of ['SIM-39: Ajustar balanco dos bracos', 'CC-818: Criar a função', 'Maestro: coloque um contador', 'Conserto do jogo pelo maestro']) assert.equal(conversaDoMaestro({ titulo: x }), true, x)
    for (const x of ['Arquiteto · conta-de-casa', 'Simulação 5: jogo 3D de aventura', 'ajustar o menu']) assert.equal(conversaDoMaestro({ titulo: x }), false, x)
    assert.equal(conversaDoMaestro(null), false)
  })
}

/* CC-885: o "sim" constrói, e a pergunta repetida é recusada pelo programa */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path'); const { execFileSync } = await import('node:child_process')
  const Ar = await import('./src/arquiteto.mjs'); const Bk = await import('./src/backlog.mjs')
  const base = { tipo: 'pedido', titulo: 'Tela de gasto', porque: 'é o que falta para o MVP andar', pergunta: 'Constrói a tela de lançar gasto agora?', opcoes: ['Sim, constrói', 'Não, outro dia'], pedido: 'Criar a tela de lançar gasto com valor e categoria' }
  const comExec = { ...base, executa: 'Sim, constrói' }
  t('arquiteto, contrato: pedido sem "executa" ou com "executa" fora das opções é recusado', () => {
    assert.ok(Ar.validarProposta(JSON.stringify(base)).erros.some((e) => e.includes('executa')))
    assert.ok(Ar.validarProposta(JSON.stringify({ ...base, executa: 'Talvez' })).erros.some((e) => e.includes('executa')))
    assert.ok(Ar.validarProposta(JSON.stringify({ ...base, executa: 'Não, outro dia' })).erros.some((e) => e.includes('PRIMEIRA')), 'o sim tem de ser a primeira opção')
    const tecnica = Ar.validarProposta(JSON.stringify({ ...comExec, pergunta: 'Qual stack usar para construir?', opcoes: ['Next.js com SQLite', 'Next.js com Postgres'], executa: 'Next.js com SQLite' }))
    assert.ok(tecnica.erros.some((e) => e.includes('detalhe técnico')), 'stack é do arquiteto, não dele')
    assert.equal(Ar.validarProposta(JSON.stringify(comExec)).ok, true)
    assert.equal(Ar.validarProposta(JSON.stringify({ ...base, tipo: 'ideia', pedido: undefined })).ok, true, 'ideia não precisa de executa')
  })
  t('arquiteto: só pedido que manda construir de novo o que já foi construído é recusado; mesmo molde de frase com coisa diferente passa', () => {
    const ant = [{ id: 'CN-56', pergunta: 'Constrói a tela de login agora?', pedido: 'No server.js, criar duas páginas: login com usuário e senha fixos em variável de ambiente, e a tela de lançar gasto atrás do login, com cookie de sessão' }]
    assert.equal(Ar.perguntaRepetida({ pedido: 'No server.js criar duas páginas: login com usuário e senha fixos em variável de ambiente e a tela de lançar gasto atrás do login com cookie de sessão' }, ant)?.id, 'CN-56')
    assert.equal(Ar.perguntaRepetida({ pergunta: 'Constrói a tela de contas fixas agora?', pedido: 'Criar a tela de contas fixas com luz, água e aluguel, valor mensal e dia de vencimento, guardando no banco SQLite' }, ant), null, 'mesmo molde, coisa diferente')
    assert.equal(Ar.perguntaRepetida({ pergunta: 'O que o robô entregou está bom?' }, ant), null, 'sem pedido, a revisão se repete à vontade')
    assert.equal(Ar.perguntaRepetida({ pedido: 'qualquer coisa nova aqui' }, [{ id: 'A', pedido: null }]), null)
  })
  t('arquiteto: aprovouExecutar só vale para pedido com a opção do "sim", e leva o que ele escreveu a mais', () => {
    assert.equal(Ar.aprovouExecutar(comExec, 'Sim, constrói'), base.pedido)
    assert.match(Ar.aprovouExecutar(comExec, 'Sim, constrói. Mas sem categoria por enquanto'), /Observação dele: Mas sem categoria por enquanto/)
    assert.equal(Ar.aprovouExecutar(comExec, 'Não, outro dia'), null)
    assert.equal(Ar.aprovouExecutar({ ...comExec, tipo: 'ideia' }, 'Sim, constrói'), null)
    assert.equal(Ar.aprovouExecutar({ ...base }, 'Sim, constrói'), null, 'sem executa nada dispara')
  })
  t('arquiteto: "No ar" lido do AGENTS.md; sem a linha vale sim (na dúvida, cópia)', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'noar-'))
    assert.equal(Ar.noAr(d), true, 'sem AGENTS.md')
    fs.writeFileSync(path.join(d, 'AGENTS.md'), '# x\n\nEscopo.\n\nNo ar: não\n'); assert.equal(Ar.noAr(d), false)
    fs.writeFileSync(path.join(d, 'AGENTS.md'), '- No ar: sim\n'); assert.equal(Ar.noAr(d), true)
    fs.writeFileSync(path.join(d, 'AGENTS.md'), '# x\nsem a linha\n'); assert.equal(Ar.noAr(d), true)
    fs.rmSync(d, { recursive: true, force: true })
  })
  // o fluxo todo, com um maestro de mentira: responder -> executar -> pergunta de revisão
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'arq5-')); const d = path.join(raiz, 'VPS_exec-teste')
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  const git = (...a) => execFileSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: 'pipe' })
  fs.writeFileSync(path.join(d, 'AGENTS.md'), '# t\n\nNo ar: sim\n'); git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'base')
  const fake = path.join(raiz, 'maestro-fake.mjs')
  fs.writeFileSync(fake, `console.log('plano: 2 micro tarefas');console.log('Build final: passou. Comportamento: passou.')`)
  process.env.CC_ARQUITETO_MAESTRO = fake; process.env.CC_ARQUITETO_COPIAS = path.join(raiz, 'copias')
  const q = Ar.registrarPergunta(d, comExec)
  const fechada = Ar.responder(d, q.id, 'Sim, constrói')
  const it = Bk.ler(Bk.caminhoPadrao(d)).itens.find((x) => x.id === q.id)
  const r = await Ar.executarPedido(d, q.id, fechada.executar)
  const rev = Ar.perguntaDeRevisao(it, r)
  const noProjeto = Ar.perguntaDeRevisao(it, { ...r, copia: false, dir: d })
  const falhou = Ar.perguntaDeRevisao(it, { ...r, ok: false, erro: 'o build quebrou' })
  const semCommit = path.join(raiz, 'VPS_sem-commit'); fs.mkdirSync(semCommit); execFileSync('git', ['-C', semCommit, 'init', '-q'])
  let erroCopia = ''; try { Ar.copiaIsolada(semCommit, 'CN-1') } catch (e) { erroCopia = e.message }
  const ramo = git('branch', '--list', 'arquiteto/*').toString()
  delete process.env.CC_ARQUITETO_MAESTRO; delete process.env.CC_ARQUITETO_COPIAS
  const dirCopia = r.dir
  const copiaExiste = fs.existsSync(path.join(dirCopia, 'AGENTS.md'))
  fs.rmSync(raiz, { recursive: true, force: true })
  t('arquiteto: o sim a um pedido devolve o pedido para executar, e o robô roda numa cópia quando o projeto está no ar', () => {
    assert.equal(fechada.estado, 'OK'); assert.equal(fechada.executar, base.pedido)
    assert.equal(r.ok, true); assert.equal(r.copia, true); assert.notEqual(r.dir, d); assert.ok(copiaExiste, 'a cópia tem os arquivos do projeto'); assert.match(ramo, /arquiteto\/[a-z]+-\d+/)
    assert.match(r.saida, /Build final: passou/)
  })
  t('arquiteto: a revisão é montada pelo programa, diz onde foi feito, e passa pelo contrato', () => {
    const { juntar, encerra, ...paraOContrato } = rev // `juntar` e `encerra` são internos do programa, o contrato do Haiku não os conhece
    assert.equal(Ar.validarProposta(JSON.stringify(paraOContrato)).ok, true, JSON.stringify(Ar.validarProposta(JSON.stringify(paraOContrato)).erros))
    assert.match(rev.porque, /cópia separada/); assert.match(noProjeto.porque, /direto na pasta/)
    assert.equal(falhou.pergunta, 'O robô não terminou. Como seguimos?'); assert.match(falhou.porque, /o build quebrou/)
    assert.equal(Ar.validarProposta(JSON.stringify(falhou)).ok, true)
  })
  t('arquiteto: projeto sem commit não ganha cópia, e o erro diz o motivo', () => assert.match(erroCopia, /pelo menos um commit/))
}

/* CC-889 e CC-890: efeito normal não reprova, e a revisão diz primeiro o que faltou */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs'); const Bk = await import('./src/backlog.mjs'); const { foraDoDeclarado } = await import('./src/maestro.mjs')
  t('maestro: package.json, lock, banco, uploads e .gitignore não contam como fora do declarado; código alheio continua contando', () => {
    // os arquivos que reprovaram 4 de 6 micro tarefas do Conta de Casa
    assert.deepEqual(foraDoDeclarado(['database.js', 'package-lock.json', 'package.json'], ['database.js']), [])
    assert.deepEqual(foraDoDeclarado(['server.js', 'dados/contas.db', 'dados/contas.db-shm', 'dados/contas.db-wal', 'uploads/a.png', '.gitignore'], ['server.js']), [])
    assert.deepEqual(foraDoDeclarado(['server.js', 'src/outra-coisa.js', 'package.json'], ['server.js']), ['src/outra-coisa.js'])
    assert.deepEqual(foraDoDeclarado(['qualquer.js'], []), [], 'sem declaração, nada a conferir')
    assert.deepEqual(foraDoDeclarado(['database.js', 'docs/sprints.jsonl', 'docs/backlog.jsonl', 'docs/ROADMAP.md', '.framework/estado.json'], ['database.js']), [], 'estado do projeto escrito pelo painel (07/10)')
    assert.deepEqual(foraDoDeclarado(['database.js', 'docs/guia.md'], ['database.js']), ['docs/guia.md'], 'documento escrito pelo agente continua contando')
  })
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rev-')); fs.mkdirSync(path.join(d, 'docs')); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  const arq = Bk.caminhoPadrao(d)
  const pai = Bk.acrescentar({ prefixo: 'TT', natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe', intencao: 'Pedido grande', pronto: 'x', conferir: 'auto:build' }, arq)
  const ok1 = Bk.acrescentar({ pai: pai.id, prefixo: 'TT', estado: 'B1', origem: 'maestro', intencao: 'Rota de login', pronto: 'rota responde', arquivos: [], conferir: 'auto:build' }, arq); Bk.mover(ok1.id, 'OK', { prova: 'ok' }, arq)
  const travada = Bk.acrescentar({ pai: pai.id, prefixo: 'TT', estado: 'B1', origem: 'maestro', intencao: 'conserto de TT-3: conserto de TT-2: Tela HTML de login', pronto: 'a tela de login existe e pede a senha', arquivos: [], conferir: 'auto:build' }, arq); Bk.mover(travada.id, 'TR', { porque: 'reprovada 3 vezes' }, arq)
  const saida = `plano em 35 s, 2 micro tarefas no pedido ${pai.id}:\nArquivos alterados: server.js, public/app.html.\nSem build no projeto.`
  const res = Ar.resultadoDoPai(d, saida)
  const incompleta = Ar.perguntaDeRevisao({ titulo: 'Login e tela' }, { ok: true, copia: false, dir: d, saida, resultado: res })
  const completa = Ar.perguntaDeRevisao({ titulo: 'Login e tela' }, { ok: true, copia: false, dir: d, saida, resultado: { ...res, pendentes: [] } })
  fs.rmSync(d, { recursive: true, force: true })
  t('arquiteto: o que sobrou aberto do pedido sai do backlog, sem o "conserto de" repetido', () => {
    assert.equal(res.pai, pai.id); assert.equal(res.pendentes.length, 1); assert.equal(res.semBuild, true); assert.match(res.arquivos, /server\.js/)
    assert.equal(res.pendentes[0].id, travada.id)
  })
  t('arquiteto: revisão com pendência diz o que faltou, avisa que não há prova, e a primeira opção refaz só o que faltou', () => {
    assert.equal(incompleta.tipo, 'pedido'); assert.match(incompleta.porque, /NÃO terminou tudo\. Faltou: Tela HTML de login\./); assert.match(incompleta.porque, /nenhum teste rodou neste pedido/)
    assert.doesNotMatch(incompleta.porque, /conserto de/); assert.equal(incompleta.executa, incompleta.opcoes[0]); assert.match(incompleta.pedido, /a tela de login existe e pede a senha/)
    const { encerra: _e, aceita: _a, ...paraContrato } = incompleta // campos internos do programa, o contrato do Haiku não os conhece
    assert.equal(Ar.validarProposta(JSON.stringify(paraContrato)).ok, true, JSON.stringify(Ar.validarProposta(JSON.stringify(paraContrato)).erros))
    assert.match(Ar.aprovouExecutar(incompleta, incompleta.opcoes[0]), /Tela HTML de login/, 'o sim dispara o robô de novo')
  })
  t('arquiteto: revisão sem pendência diz o veredito e os arquivos, e avisa quando não há teste nem build', () => {
    assert.equal(completa.tipo, 'revisao'); assert.match(completa.porque, /terminou todas as micro tarefas/); assert.match(completa.porque, /Arquivos alterados: server\.js/); assert.match(completa.porque, /não provou que funciona/)
  })
}

/* CC-894: a revisão leva fotos do app rodando, e o app sobe numa porta de teste (nunca a 3000) */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path'); const net = await import('node:net')
  const Ar = await import('./src/arquiteto.mjs')
  const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), n))
  const dServ = tmp('ver-serv-'); fs.writeFileSync(path.join(dServ, 'server.js'), "require('http').createServer((q,r)=>r.end('ola')).listen(Number(process.env.PORT)||3000,'127.0.0.1')")
  const dVite = tmp('ver-vite-'); fs.writeFileSync(path.join(dVite, 'package.json'), JSON.stringify({ scripts: { start: 'vite --host' } }))
  const dNpm = tmp('ver-npm-'); fs.writeFileSync(path.join(dNpm, 'package.json'), JSON.stringify({ scripts: { start: 'node app.js' } }))
  const dNada = tmp('ver-nada-')
  const dMudo = tmp('ver-mudo-'); fs.writeFileSync(path.join(dMudo, 'server.js'), 'setTimeout(()=>{},30000)') // nunca escuta
  // porta ocupada: tem que pular para a seguinte, e nunca devolver 3000
  const ocupa = net.createServer(); await new Promise((ok) => ocupa.listen(5270, '127.0.0.1', ok))
  const porta = await Ar.portaLivre(); await new Promise((ok) => ocupa.close(ok))
  let recebida = null
  const feliz = await Ar.verOApp(dServ, { saida: path.join(dServ, 'fotos'), foto: async ({ url }) => { recebida = url; return { ok: true, fotos: ['/x/01.jpg'], problemas: [] } } })
  const portaDoApp = Number(new URL(recebida).port)
  const aindaNoAr = await Ar.aguardarNoAr(portaDoApp, 800) // depois de fotografar, o app tem que ter sido derrubado
  const mudo = await Ar.verOApp(dMudo, { saida: path.join(dMudo, 'fotos'), espera: 1500, foto: async () => ({ ok: true, fotos: ['/x'] }) })
  const semNada = await Ar.verOApp(dNada, { saida: path.join(dNada, 'fotos') })
  const cmdServ = Ar.comandoParaVer(dServ), cmdNpm = Ar.comandoParaVer(dNpm), cmdVite = Ar.comandoParaVer(dVite), cmdNada = Ar.comandoParaVer(dNada)
  for (const d of [dServ, dVite, dNpm, dNada, dMudo]) fs.rmSync(d, { recursive: true, force: true })
  t('arquiteto: como subir o app: servidor na raiz ou npm start; vite e next ficam com o ~/dev.sh; sem nada, null', () => {
    assert.deepEqual(cmdServ, { cmd: process.execPath, args: ['server.js'] }); assert.deepEqual(cmdNpm, { cmd: 'npm', args: ['run', 'start'] })
    assert.equal(cmdVite, null, 'vite não sobe por aqui'); assert.equal(cmdNada, null)
  })
  t('arquiteto: a porta de teste pula a ocupada e nunca é a 3000 (3000 a 3021 são sites de cliente)', () => {
    assert.equal(porta, 5271); assert.ok(portaDoApp >= 5270 && portaDoApp <= 5279 && portaDoApp !== 3000)
  })
  t('arquiteto: o app sobe com PORT, é fotografado pelo endereço local, e é derrubado depois', () => {
    assert.equal(feliz.ok, true); assert.deepEqual(feliz.fotos, ['/x/01.jpg']); assert.equal(feliz.link, null); assert.match(recebida, /^http:\/\/127\.0\.0\.1:527\d\/$/); assert.equal(aindaNoAr, false)
  })
  t('arquiteto: app que não escuta ou projeto sem servidor dizem o motivo em vez de fotografar o nada', () => {
    assert.equal(mudo.ok, false); assert.match(mudo.erro, /não respondeu em 2 s/); assert.equal(semNada.ok, false); assert.match(semNada.erro, /não achei como subir/)
  })
  const it0 = { titulo: 'Tela' }
  const base = { ok: true, copia: false, dir: '/x', saida: 'ok', resultado: { pai: 'A-1', pendentes: [], semBuild: false, arquivos: 'a.js' } }
  const comFoto = Ar.perguntaDeRevisao(it0, { ...base, ver: { ok: true, fotos: ['/x/1.jpg'], link: null } })
  const comLink = Ar.perguntaDeRevisao(it0, { ...base, ver: { ok: true, fotos: ['/x/1.jpg'], link: 'https://testedevoo.carzo.com.br/x/' } })
  const semFoto = Ar.perguntaDeRevisao(it0, { ...base, ver: { ok: false, erro: 'o app não respondeu' } })
  const incompleta = Ar.perguntaDeRevisao(it0, { ...base, resultado: { ...base.resultado, pendentes: [{ id: 'A-2', intencao: 'Tela de login', pronto: 'existe' }] }, ver: { ok: true, fotos: ['/x/1.jpg'], link: null } })
  t('arquiteto: a revisão diz que fotografou, dá o link quando existe e avisa quando não há, e diz o motivo se não fotografou', () => {
    assert.match(comFoto.porque, /Fotografei o app rodando/); assert.match(comFoto.porque, /Ainda não há endereço de teste/)
    assert.match(comLink.porque, /Endereço de teste: https:\/\/testedevoo\.carzo\.com\.br\/x\//)
    assert.match(semFoto.porque, /Não consegui fotografar o app: o app não respondeu/); assert.match(incompleta.porque, /NÃO terminou tudo[\s\S]*Fotografei o app rodando/)
    for (const q of [comFoto, comLink, semFoto]) assert.ok(q.porque.length <= 500)
  })
}

/* CC-904: aprovar a obra fecha o pedido e o que ficou obsoleto, e o arquiteto sabe o que já foi construído */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs'); const Bk = await import('./src/backlog.mjs')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'obsoleto-')); fs.mkdirSync(path.join(d, 'docs')); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  const arq = Bk.caminhoPadrao(d)
  const novo = (extra) => Bk.acrescentar({ prefixo: 'OB', natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe', intencao: 'x', pronto: 'pronto quando existe', conferir: 'auto:build', ...extra }, arq)
  // o caso real: pedido do login ficou EM, com tarefa travada; depois a tela foi refeita em outro pedido
  const paiVelho = novo({ intencao: 'Pedido do login' }); Bk.mover(paiVelho.id, 'EM', {}, arq)
  const travada = novo({ pai: paiVelho.id, origem: 'maestro', intencao: 'Tela de login' }); Bk.mover(travada.id, 'TR', { porque: 'reprovada 3 vezes' }, arq)
  const feita = novo({ pai: paiVelho.id, origem: 'maestro', intencao: 'Rota de login' }); Bk.mover(feita.id, 'OK', { prova: 'ok' }, arq)
  const paiNovo = novo({ intencao: 'Refazer a tela de login' }); Bk.mover(paiNovo.id, 'EM', {}, arq)
  const res = { pai: paiNovo.id, pendentes: [], semBuild: true, arquivos: 'login.html' }
  const redo = Ar.perguntaDeRevisao({ titulo: 'Login', proposta: { encerra: [paiVelho.id] } }, { ok: true, copia: false, dir: d, saida: 'x', resultado: res })
  const q = Ar.registrarPergunta(d, redo)
  const fechada = Ar.responder(d, q.id, redo.opcoes[0])
  const itens = Bk.ler(arq).itens, est = (id) => itens.find((x) => x.id === id)?.estado
  const estado = Ar.lerEstado(d)
  fs.rmSync(d, { recursive: true, force: true })
  t('arquiteto: aprovar a revisão fecha o pedido novo, o pedido velho que ela refez e a tarefa que travou (a que passou continua)', () => {
    assert.deepEqual(redo.encerra, [paiNovo.id, paiVelho.id]); assert.equal(fechada.encerrou.length, 3)
    assert.equal(est(paiVelho.id), 'OK'); assert.equal(est(paiNovo.id), 'OK'); assert.equal(est(travada.id), 'KO'); assert.equal(est(feita.id), 'OK')
  })
  t('arquiteto: o estado diz o que ele já aprovou, para nunca propor construir de novo', () => {
    assert.equal(estado.jaConstruidoEAprovado.length, 1); assert.equal(estado.jaConstruidoEAprovado[0].o_que, 'Login')
  })
  t('arquiteto: obra de item dele leva as palavras dele e a ordem de provar em teste (a sobra que voltou, 07/10)', () => {
    const txt = Ar.pedidoComARegraDele('Corrigir a sobra', { origem: 'felipe', citacao: 'a sobra tem que ser o que entrou no mês menos tudo que eu gastei' })
    assert.match(txt, /REGRA DELE.*o que entrou no mês menos tudo que eu gastei/); assert.match(txt, /corrija o TESTE, nunca volte o código/)
    assert.equal(Ar.pedidoComARegraDele('x', { origem: 'maestro', citacao: 'y' }), 'x'); assert.equal(Ar.pedidoComARegraDele('x', null), 'x')
    const comGeral = Ar.pedidoComARegraDele('Criar o backup', null, [{ texto: '"Por onde começa?" > Os dois juntos: nada aparece sem login funcionando' }])
    assert.match(comGeral, /VALEM PARA O PROJETO INTEIRO[\s\S]*nada aparece sem login funcionando/, 'a decisão geral vai junto mesmo sem item dele (backup aberto sem login, 07/10)')
  })
  t('arquiteto: aprovar fecha o item da fila dele que a obra executou, se for de uma função só (CC-943)', () => {
    assert.deepEqual(Ar.itemDaFilaFechavel({ proposta: { daFila: 'CN-113', daFilaTexto: 'Sim, somar os compromissos recorrentes na conta da sobra do mês' } }), ['CN-113'])
    assert.deepEqual(Ar.itemDaFilaFechavel({ proposta: { daFila: 'CN-16', daFilaTexto: 'Lançar gasto rápido com print ou foto, Contas fixas separadas do resto, Ver quanto sobra no mês' } }), [], 'várias funções: fica aberto')
    assert.deepEqual(Ar.itemDaFilaFechavel({ proposta: { daFila: 'CN-1' } }), [], 'sem o texto, não fecha')
    assert.deepEqual(Ar.itemDaFilaFechavel({ proposta: {} }), [])
  })
  t('arquiteto: recusar a revisão não fecha nada', () => {
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'obsoleto2-')); fs.mkdirSync(path.join(d2, 'docs')); fs.writeFileSync(path.join(d2, 'docs', 'backlog.jsonl'), '')
    const a2 = Bk.caminhoPadrao(d2); const p2 = Bk.acrescentar({ prefixo: 'OC', natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe', intencao: 'x', pronto: 'pronto quando existe', conferir: 'auto:build' }, a2); Bk.mover(p2.id, 'EM', {}, a2)
    const rev = Ar.perguntaDeRevisao({ titulo: 'T' }, { ok: true, copia: false, dir: d2, saida: 'x', resultado: { pai: p2.id, pendentes: [], semBuild: false, arquivos: '' } })
    const f = Ar.responder(d2, Ar.registrarPergunta(d2, rev).id, 'Quase: quero ajustar (escreva abaixo o quê)')
    const ainda = Bk.ler(a2).itens.find((x) => x.id === p2.id).estado; fs.rmSync(d2, { recursive: true, force: true })
    assert.equal(f.encerrou, undefined); assert.equal(ainda, 'EM')
  })
}

/* CC-919: projeto sem prova ganha, no fim do plano, a tarefa de escrever o teste do pedido, e teste de fachada não vale */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const M = await import('./src/maestro.mjs'); const Bk = await import('./src/backlog.mjs')
  const proj = (n, extra = {}) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), n)); fs.mkdirSync(path.join(d, 'docs')); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), ''); for (const [f, c] of Object.entries(extra)) fs.writeFileSync(path.join(d, f), c); return d }
  const comBuild = proj('prova-b-', { 'package.json': JSON.stringify({ scripts: { build: 'x' } }) })
  const comTeste = proj('prova-t-', { 'package.json': JSON.stringify({ scripts: { test: 'x' } }) })
  const declarada = proj('prova-d-', { 'AGENTS.md': '# x\n\nConferência padrão: auto:npm test\n' })
  const soBuildDeclarado = proj('prova-sb-', { 'AGENTS.md': '# x\n\nConferência padrão: auto:build\n' })
  const vazio = proj('prova-v-')
  const tarefas = [{ titulo: 'Rota de gastos', pedido: 'Criar a rota', arquivos: ['server.js'], deixa: '' }, { titulo: 'Tela de gastos', pedido: 'Criar a tela', arquivos: ['public/app.html'], deixa: '' }]
  const g = M.gravarPlano(vazio, 'Separar contas fixas do resto dos gastos', tarefas)
  const itens = Bk.ler(Bk.caminhoPadrao(vazio)).itens
  const pai = itens.find((x) => x.id === g.pai), filhas = itens.filter((x) => x.pai === g.pai)
  const g3 = M.gravarPlano(comTeste, 'Algo', tarefas); const conf3 = Bk.ler(Bk.caminhoPadrao(comTeste)).itens.find((x) => x.id === g3.pai).conferir
  const g2 = M.gravarPlano(comBuild, 'Algo', tarefas); const itens2 = Bk.ler(Bk.caminhoPadrao(comBuild)).itens
  const filhas2 = itens2.filter((x) => x.pai === g2.pai), pai2 = itens2.find((x) => x.id === g2.pai)
  const arqT = M.nomeDoTeste(g.pai)
  fs.writeFileSync(path.join(vazio, 'fraco.mjs'), "import assert from 'node:assert'\nassert.ok(true)\n")
  fs.writeFileSync(path.join(vazio, 'semrede.mjs'), "import assert from 'node:assert'\nassert.ok(1)\nassert.ok(2)\nassert.ok(3)\n")
  fs.writeFileSync(path.join(vazio, 'bom.mjs'), "import assert from 'node:assert'\nconst r = await fetch('http://127.0.0.1:'+process.env.PORT+'/')\nassert.equal(r.status, 200)\nassert.ok((await r.text()).includes('Entrar'))\nassert.notEqual(r.status, 500)\n")
  const q = { falta: M.testeEhReal(vazio, 'nao-existe.mjs'), fraco: M.testeEhReal(vazio, 'fraco.mjs'), semrede: M.testeEhReal(vazio, 'semrede.mjs'), bom: M.testeEhReal(vazio, 'bom.mjs') }
  const resp = [M.projetoSemProva(comBuild), M.projetoSemProva(comTeste), M.projetoSemProva(declarada), M.projetoSemProva(soBuildDeclarado), M.projetoSemProva(vazio)]
  for (const d of [comBuild, comTeste, declarada, soBuildDeclarado, vazio]) fs.rmSync(d, { recursive: true, force: true })
  t('maestro: o conserto do pedido leva as decisões dele e a ordem de corrigir o teste, não o código (Conta de Casa, 07/10)', () => {
    const txt = M.decisoesDele([{ id: 'CN-94', origem: 'felipe', natureza: 'DEF', citacao: 'a sobra tem que ser o que entrou no mês menos tudo que eu gastei' }, { id: 'CN-37', origem: 'maestro', natureza: 'DEF', citacao: 'x' }])
    assert.match(txt, /CN-94: a sobra tem que ser o que entrou/); assert.match(txt, /corrija o TESTE, nunca o código/); assert.doesNotMatch(txt, /CN-37/)
    assert.equal(M.decisoesDele([]), '')
  })
  t('maestro: projeto sem build, sem teste e sem conferência real é "sem prova"; os outros não', () => {
    assert.deepEqual(resp, [false, false, false, true, true])
  })
  t('maestro: em projeto sem prova o plano ganha a tarefa de escrever o teste, e o teste vira a conferência do pedido', () => {
    assert.equal(pai.conferir, `auto:node ${arqT}`); assert.equal(filhas.length, 3); const ult = filhas.at(-1)
    assert.equal(ult.intencao, 'Escrever o teste do pedido'); assert.equal(ult.conferir, `auto:node ${arqT}`)
    assert.deepEqual(ult.arquivos, [arqT, 'server.js', 'public/app.html'], 'pode consertar o que as outras tarefas tocaram, se o teste achar defeito real')
    assert.match(ult.pronto, /node:assert/); assert.match(ult.pronto, /fetch/)
  })
  t('maestro: projeto com npm test confere o pedido pelo teste, não por um build que não existe (Conta de Casa, 07/10)', () => assert.equal(conf3, 'auto:npm test'))
  {
    const dT = fs.mkdtempSync(path.join(os.tmpdir(), 'todos-'))
    fs.writeFileSync(path.join(dT, 'package.json'), JSON.stringify({ scripts: { test: 'node test-antigo.mjs' } }))
    fs.writeFileSync(path.join(dT, 'test-antigo.mjs'), 'process.exit(0)'); fs.writeFileSync(path.join(dT, 'test-regra-dele.mjs'), "console.error('a sobra deve ser -1300');process.exit(1)")
    const falhou = await M.todosOsTestes(dT, { ok: true, prova: 'npm test passou' })
    fs.writeFileSync(path.join(dT, 'test-regra-dele.mjs'), 'process.exit(0)')
    const passou = await M.todosOsTestes(dT, { ok: true, prova: 'npm test passou' })
    fs.rmSync(dT, { recursive: true, force: true })
    t('maestro: no fim da obra roda todo teste da raiz, não só o do npm test; o teste da regra dele que falha reprova (07/10)', () => {
      assert.equal(falhou.ok, false); assert.match(falhou.erro, /test-regra-dele\.mjs falhou/)
      assert.equal(passou.ok, true); assert.match(passou.prova, /mais 1 teste\(s\) do projeto: test-regra-dele\.mjs/); assert.doesNotMatch(passou.prova, /test-antigo/, 'o do npm test não roda duas vezes')
    })
  }
  t('maestro: projeto que já tem build segue sem a tarefa de teste', () => {
    assert.equal(filhas2.length, 2); assert.notEqual(pai2.conferir, `auto:node ${M.nomeDoTeste(g2.pai)}`)
  })
  t('maestro: teste de fachada é recusado (inexistente, fraco, sem falar com o servidor); o de verdade passa', () => {
    assert.match(q.falta.erro, /não existe/); assert.match(q.fraco.erro, /fraco: tem 1/); assert.match(q.semrede.erro, /não fala com o servidor/); assert.equal(q.bom.ok, true)
  })
}

/* CC-918 e CC-919: o que ele já escolheu não pergunta, e o que o robô provou sozinho não pede aprovação */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs'); const Bk = await import('./src/backlog.mjs')
  const base = { tipo: 'pedido', titulo: 'Contas fixas', porque: 'item da fila que ele escolheu e ainda falta', pergunta: 'Constrói agora as contas fixas?', opcoes: ['Sim, constrói agora', 'Não, depois'], pedido: 'Separar contas fixas do resto dos gastos na tela principal', executa: 'Sim, constrói agora' }
  t('arquiteto, contrato: daFila é um id de item; formato errado é recusado; só vale em pedido', () => {
    assert.equal(Ar.validarProposta(JSON.stringify({ ...base, daFila: 'CN-16' })).proposta.daFila, 'CN-16')
    assert.ok(Ar.validarProposta(JSON.stringify({ ...base, daFila: 'a fila' })).erros.some((e) => e.includes('daFila')))
    assert.equal(Ar.validarProposta(JSON.stringify({ ...base, tipo: 'ideia', pedido: undefined, executa: undefined, daFila: 'CN-16' })).proposta.daFila, undefined, 'em ideia é ignorado')
  })
  const estado = { fila: [{ id: 'CN-16', origem: 'felipe', intencao: 'Contas fixas separadas' }, { id: 'CN-37', origem: 'maestro', intencao: 'Criar banco' }, { id: 'CN-70', origem: 'arquiteto', intencao: 'x' }] }
  t('arquiteto: só constrói sem perguntar item da fila que ELE criou (o modelo aponta, o programa confere)', () => {
    assert.equal(Ar.deveRodarSozinho({ ...base, daFila: 'CN-16' }, estado)?.id, 'CN-16')
    assert.equal(Ar.deveRodarSozinho({ ...base, daFila: 'CN-37' }, estado), null, 'tarefa do robô não conta')
    assert.equal(Ar.deveRodarSozinho({ ...base, daFila: 'CN-70' }, estado), null, 'pergunta do arquiteto não conta')
    assert.equal(Ar.deveRodarSozinho({ ...base, daFila: 'CN-99' }, estado), null, 'id que não existe')
    assert.equal(Ar.deveRodarSozinho(base, estado), null, 'sem daFila pergunta')
    assert.equal(Ar.deveRodarSozinho({ ...base, tipo: 'ideia', daFila: 'CN-16' }, estado), null)
    assert.equal(Ar.deveRodarSozinho({ ...base, daFila: 'CN-94' }, { fila: [], esperandoDele: [{ id: 'CN-94', origem: 'felipe' }] })?.id, 'CN-94', 'defeito que ele apontou: mora na fila dele (CN-95, 07/10)')
  })
  const rOk = { ok: true, copia: false, saida: 'Comportamento: passou (node test-x.mjs)', resultado: { pai: 'X-1', pendentes: [] } }
  const verOk = { ok: true, fotos: ['/x/1.jpg'], problemas: [] }
  t('arquiteto: o robô só aprova sozinho com teste do pedido passando, app abrindo limpo, sem pendência e fora de cópia', () => {
    assert.equal(Ar.provaAutomatica(rOk, verOk).ok, true)
    assert.equal(Ar.provaAutomatica({ ...rOk, copia: true }, verOk).ok, false, 'cópia é projeto no ar: quem aprova é ele')
    assert.equal(Ar.provaAutomatica({ ...rOk, saida: 'Sem build no projeto.' }, verOk).ok, false, 'sem teste não há prova')
    assert.equal(Ar.provaAutomatica({ ...rOk, resultado: { pai: 'X-1', pendentes: [{ id: 'X-2' }] } }, verOk).ok, false)
    assert.equal(Ar.provaAutomatica(rOk, { ok: false, erro: 'x' }).ok, false, 'app que não abre')
    assert.equal(Ar.provaAutomatica(rOk, { ...verOk, problemas: ['erro no console'] }).ok, false, 'problema anotado nas fotos')
    assert.equal(Ar.provaAutomatica({ ...rOk, ok: false }, verOk).ok, false)
  })
  // o passo inteiro, com um Claude de mentira: item da fila dele constrói sem perguntar; sem daFila pergunta; teto segura
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-')); const d = path.join(raiz, 'VPS_auto-teste')
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  const arq = Bk.caminhoPadrao(d)
  const dele = Bk.acrescentar({ prefixo: 'AT', natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe', intencao: 'Contas fixas separadas do resto', pronto: 'a tela separa fixas e variaveis', conferir: 'auto:build' }, arq)
  const claude = (obj) => { const f = path.join(raiz, `claude-${Math.random().toString(36).slice(2)}.mjs`); fs.writeFileSync(f, `#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>console.log(${JSON.stringify(JSON.stringify(obj))}))`); fs.chmodSync(f, 0o755); return f }
  const auto = await Ar.passo(d, { binario: claude({ ...base, daFila: dele.id }) })
  const fichaAuto = Bk.ler(arq).itens.find((x) => x.id === auto.pergunta.id)
  const hist = Bk.historia(fichaAuto.id, arq).map((e) => `${e.tipo}:${e.texto || ''}`).join(' | ')
  // CC-941: id errado, mas o pedido é do item dele: o programa acha pelo conteúdo e roda sozinho (aqui segurado pelo teto)
  const antes = Ar.podeAutomatico(d, 1)
  // pedido fora do backlog não vira pergunta nenhuma: a trava recusa e o arquiteto pede direção
  const fora = await Ar.passoOuSocorro(d, { binario: claude({ ...base, titulo: 'Outra coisa', pergunta: 'Monto o gráfico do mês?', pedido: 'Mostrar o grafico de gastos do mes em barras por categoria', daFila: 'AT-99' }) })
  const fichaFora = Bk.ler(arq).itens.find((x) => x.id === fora.pergunta.id)
  fs.rmSync(raiz, { recursive: true, force: true })
  t('arquiteto: pedido de item da fila dele é aprovado pelo programa, fica gravado como automático e devolve o pedido para executar', () => {
    assert.equal(auto.automatico, true); assert.equal(auto.daFila.id, dele.id); assert.equal(auto.pergunta.executar, base.pedido)
    assert.equal(fichaAuto.estado, 'OK'); assert.match(fichaAuto.automatico, /item da fila que ele já escolheu \(AT-1/); assert.match(fichaAuto.prova, /^automático:/)
    assert.match(hist, /decidido pelo programa, não por ele/)
  })
  t('arquiteto: pedido fora do backlog dele não chega como pedido (a trava recusa); e o teto por dia segura a decisão automática', () => {
    assert.equal(fora.socorro, true); assert.equal(fichaFora.proposta.tipo, 'ideia'); assert.equal(fichaFora.estado, 'DE')
    assert.equal(antes, false, 'com teto 1 e uma automática hoje, não cabe outra')
  })
}

/* CC-929 e CC-930: o vigia acusa a resposta de fachada, e a falha do modelo sobe a escada */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const V = await import('./src/vigia.mjs')
  const real = 'Criei o endpoint GET /saldo em server.js, usando Date nativo para calcular os limites do mês corrente' // CN-80, 05/10
  t('vigia: "criei" sem nenhuma ferramenta é resposta de fachada (o caso real da CN-80)', () => {
    assert.equal(V.diagnosticoDoTurno({ agente: 'opencode', estado: 'pronto', texto: real, ferramentas: [] })?.tipo, 'disse-sem-fazer')
    assert.equal(V.diagnosticoDoTurno({ agente: 'agy', estado: 'pronto', texto: 'Added the route to server.js', ferramentas: [] })?.tipo, 'disse-sem-fazer')
    assert.equal(V.diagnosticoDoTurno({ agente: 'opencode', estado: 'pronto', texto: 'Não escrevi nada ainda: só li os arquivos do servidor', ferramentas: [] })?.tipo, 'nao-fez', 'o caso honesto, medido em 06/10')
  })
  t('vigia: com ferramenta, ou resposta que não afirma ter mexido, ou o Claude, ou modo só leitura: nada a acusar', () => {
    assert.equal(V.diagnosticoDoTurno({ agente: 'opencode', estado: 'pronto', texto: real, ferramentas: [{ nome: 'edit' }] }), null)
    assert.equal(V.diagnosticoDoTurno({ agente: 'opencode', estado: 'pronto', texto: 'O arquivo server.js tem 300 linhas.', ferramentas: [] }), null)
    assert.equal(V.diagnosticoDoTurno({ agente: 'claude', estado: 'pronto', texto: real, ferramentas: [] }), null)
    assert.equal(V.diagnosticoDoTurno({ agente: 'opencode', estado: 'pronto', texto: real, ferramentas: [], somenteLer: true }), null)
  })
  t('vigia: vazio, erro e interrompido são acusados', () => {
    assert.equal(V.diagnosticoDoTurno({ agente: 'opencode', estado: 'pronto', texto: '', ferramentas: [] }).tipo, 'vazio')
    assert.equal(V.diagnosticoDoTurno({ agente: 'opencode', estado: 'pronto', texto: 'x', erro: 'o modelo gratuito está com limite de uso (rate limit)' }).tipo, 'erro')
    assert.equal(V.diagnosticoDoTurno({ agente: 'agy', estado: 'interrompido', texto: 'x', ferramentas: [{}] }).tipo, 'interrompido')
    assert.match(V.notaDoVigia({ frase: 'o agente terminou sem responder nada' }, 'opencode/big-pickle'), /^Vigia: .*\(modelo opencode\/big-pickle\)\.$/)
  })
  t('vigia: falha do modelo sobe a escada; falha do código não', () => {
    for (const e of ['nenhum arquivo do projeto foi alterado nesta tarefa', 'o agente não terminou no prazo', 'o modelo gratuito está com limite de uso (rate limit)']) assert.equal(V.falhaDoModelo(e), true, e)
    for (const e of ['o build falhou: SyntaxError', 'mexeu fora dos arquivos declarados (server.js): x.js', 'o teste test-cn-1.mjs falhou']) assert.equal(V.falhaDoModelo(e), false, e)
    assert.deepEqual(V.ESCADA.map((d) => d.agente), ['opencode', 'opencode', 'agy'])
    assert.equal(V.degrauDe(0).modelo, 'opencode/big-pickle'); assert.equal(V.degrauDe(9).agente, 'agy', 'acima do topo, fica no último'); assert.equal(V.degrauDe(undefined).modelo, 'opencode/big-pickle')
  })
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vigia-')), 'vigia.jsonl')
  V.registrar({ tipo: 'vazio', modelo: 'm' }, { arquivo: arq }); V.registrar({ tipo: 'erro' }, { arquivo: arq })
  const linhas = fs.readFileSync(arq, 'utf8').trim().split('\n').map((l) => JSON.parse(l)); fs.rmSync(path.dirname(arq), { recursive: true, force: true })
  t('vigia: cada achado vira uma linha no registro, com a hora', () => { assert.equal(linhas.length, 2); assert.equal(linhas[0].tipo, 'vazio'); assert.ok(linhas[0].em > 0) })
}

/* CC-941: o auditor das perguntas, e a trava que ele vira */
{
  const A = await import('./src/auditoria.mjs')
  // o backlog real do Conta de Casa: a entrevista gravou quatro funções num item só (CN-16)
  const itens = [
    { id: 'CN-15', origem: 'felipe', estado: 'B1', intencao: 'Lançar gasto rápido' },
    { id: 'CN-16', origem: 'felipe', estado: 'B1', intencao: 'Lançar gasto rápido com print ou foto, Contas fixas separadas do resto, Ver quanto sobra no mês, Login funcionando com usuário e senha' },
    { id: 'CN-99', origem: 'maestro', estado: 'B1', pai: 'CN-16', intencao: 'Tela de contas fixas' },
  ]
  const ped = (titulo, pedido, pergunta = 'Constrói agora?') => ({ tipo: 'pedido', titulo, pedido, pergunta, opcoes: ['Sim, constrói agora', 'Não'] })
  t('auditor: pedido que executa uma parte de um item do backlog dele é "redundante" (devia rodar sozinho)', () => {
    assert.equal(A.itemDoBacklog(ped('Separar contas fixas', 'Separar as contas fixas do resto dos gastos na tela'), itens)?.id, 'CN-16')
    assert.equal(A.itemDoBacklog(ped('Saldo do mês', 'Mostrar quanto sobra no mês depois das contas'), itens)?.id, 'CN-16')
    assert.equal(A.violacoes(ped('Separar contas fixas', 'Separar as contas fixas do resto dos gastos'), { itens })[0].regra, 'redundante')
  })
  t('auditor: o caso real de 07/10: "área de compromissos" NÃO é o item "Lançar gasto rápido", mesmo dividindo palavras', () => {
    assert.equal(A.itemDoBacklog(ped('Criar área de compromissos e vencimentos recorrentes', 'Criar uma área para compromissos e vencimentos recorrentes, separada do lançamento de gasto do dia a dia, rápido de consultar'), itens.filter((x) => x.id === 'CN-15')), null)
    assert.equal(A.itemDoBacklog(ped('Lançar gasto rápido', 'Tela para lançar gasto rápido pelo celular'), itens)?.id, 'CN-15', 'o item inteiro casa')
  })
  t('auditor: o item que a IA aponta vale com conferência solta (CN-95 corrigia o CN-94, de texto longo); apontado errado não', () => {
    const def = { id: 'CN-94', origem: 'felipe', estado: 'B1', intencao: 'A lista de gastos lançados não carrega (aparece Não foi possível ler a lista agora), o saldo aparece para quem não entrou com login, e a sob' }
    const p95 = { ...ped('Corrigir lista de gastos, saldo exposto sem login e cálculo da sobra', 'Revisar o trecho que devolve a lista de gastos lançados e colocar o saldo atrás do login', 'Corrige os três problemas agora?'), daFila: 'CN-94' }
    assert.equal(A.itemDoBacklog(p95, [...itens, def])?.id, 'CN-94')
    assert.equal(A.itemDoBacklog({ ...ped('Criar área de compromissos', 'Criar uma área de compromissos e vencimentos recorrentes'), daFila: 'CN-15' }, itens), null, 'a confusão de 07/10 continua barrada')
  })
  t('auditor: pedido que não é de item nenhum é "fora"; micro tarefa do robô não conta como item dele', () => {
    assert.equal(A.itemDoBacklog(ped('Gráfico anual', 'Gráfico de barras com os gastos do ano inteiro'), itens), null)
    assert.equal(A.violacoes(ped('Gráfico anual', 'Gráfico de barras com os gastos do ano inteiro'), { itens })[0].regra, 'fora')
    assert.equal(A.violacoes({ ...ped('Faltou parte: Tela de login', 'Refazer a tela de login'), titulo: 'Faltou parte: Tela de login' }, { itens }).length, 0, 'refazer o que faltou é continuação')
  })
  t('auditor: repetida (igual à anterior), técnica, e revisão com foto só da entrada', () => {
    const ant = [{ id: 'CN-29', tipo: 'pedido', pergunta: 'Começa a construção agora?' }]
    assert.ok(A.violacoes(ped('x', 'y', 'Começa a construção agora?'), { itens, anteriores: ant }).some((v) => v.regra === 'repetida'))
    assert.ok(A.violacoes({ tipo: 'ideia', pergunta: 'Qual stack usar para construir?', opcoes: ['Next.js', 'Node puro'] }, {}).some((v) => v.regra === 'tecnica'))
    assert.ok(A.violacoes({ tipo: 'revisao', pergunta: 'Está bom?' }, { fotos: ['/x/01-login-celular.jpg', '/x/01-login-computador.jpg'] }).some((v) => v.regra === 'print'))
    assert.equal(A.violacoes({ tipo: 'revisao', pergunta: 'Está bom?' }, { fotos: ['/x/01-login-celular.jpg', '/x/02-inicio-celular.jpg'] }).length, 0)
    assert.equal(A.violacoes({ tipo: 'ideia', pergunta: 'Quer um gráfico do gasto do mês?', opcoes: ['Sim', 'Não'] }, {}).length, 0, 'pergunta de produto passa')
  })
}

/* CC-941: reprovar a entrega escrevendo o defeito cria o item no backlog; revisão inventada pela IA é barrada */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs'); const Bk = await import('./src/backlog.mjs')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-')); fs.mkdirSync(path.join(d, 'docs')); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  const rev = (t) => Ar.registrarPergunta(d, { tipo: 'revisao', titulo: 'Revisar: ' + t, porque: 'o robô terminou a obra', pergunta: 'Está bom?', opcoes: ['Está bom, segue', 'Tem algo errado, vou apontar o que'] })
  const f1 = Ar.responder(d, rev('a').id, 'Tem algo errado, vou apontar o que. A lista de gastos não carrega e o saldo abre sem login')
  const f2 = Ar.responder(d, rev('b').id, 'Está bom, segue')
  const f3 = Ar.responder(d, rev('c').id, 'Tem algo errado, vou apontar o que')
  const item = Bk.ler(Bk.caminhoPadrao(d)).itens.find((x) => x.id === f1.virouItem)
  const falso = path.join(d, 'c.mjs'); fs.writeFileSync(falso, `#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({tipo:'revisao',titulo:'Revisar o saldo',porque:'li o código e parece pronto',pergunta:'O que foi feito está bom?',opcoes:['Está bom','Não está']})))`); fs.chmodSync(falso, 0o755)
  let erro = ''; try { await Ar.propor(d, { binario: falso }) } catch (e) { erro = e.message }
  fs.rmSync(d, { recursive: true, force: true })
  t('arquiteto: reprovar a entrega escrevendo o que está errado cria item do backlog dele, com as palavras dele', () => {
    assert.equal(item.origem, 'felipe'); assert.equal(item.natureza, 'DEF'); assert.equal(item.intencao, 'A lista de gastos não carrega e o saldo abre sem login'); assert.match(item.citacao, /saldo abre sem login/)
    assert.equal(f2.virouItem, undefined, 'aprovar não cria item'); assert.equal(f3.virouItem, undefined, 'sem texto não cria item')
  })
  t('arquiteto: a IA não inventa revisão de código que ela leu (só o programa, depois de uma obra)', () => assert.match(erro, /"revisao" é só do programa/))
  {
    // nome fixo: a sigla sai do nome da pasta, e um nome aleatório às vezes dava sigla com número ("D3-1", recusada)
    const d2 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'id-')), 'VPS_ideia-teste'); fs.mkdirSync(path.join(d2, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d2, 'docs', 'backlog.jsonl'), '')
    const ideia = () => Ar.registrarPergunta(d2, { tipo: 'ideia', titulo: 'Compromissos', porque: 'o MVP está pronto e falta isto', pergunta: 'Cria a área de compromissos?', opcoes: ['Sim, criar área de compromissos', 'Não, outra prioridade'] })
    const sim = Ar.responder(d2, ideia().id, 'Sim, criar área de compromissos')
    const nao = Ar.responder(d2, ideia().id, 'Não, outra prioridade')
    const comItem = Ar.registrarPergunta(d2, Ar.perguntaDeSocorro('x', { esperandoDele: [{ id: 'II-9', origem: 'felipe', intencao: 'Corrigir a sobra' }] }))
    const fz = Ar.responder(d2, comItem.id, 'Fazer: Corrigir a sobra')
    const socorro = Ar.registrarPergunta(d2, Ar.perguntaDeSocorro('x'))
    const outra = Ar.responder(d2, socorro.id, 'Outra direção (escreva abaixo). Quero um resumo do mês por categoria')
    const itOutra = Bk.ler(Bk.caminhoPadrao(d2)).itens.find((x) => x.id === outra.virouItem)
    const it = Bk.ler(Bk.caminhoPadrao(d2)).itens.find((x) => x.id === sim.virouItem); fs.rmSync(path.dirname(d2), { recursive: true, force: true })
    t('arquiteto: ideia aceita vira item do backlog dele (o pedido seguinte roda sozinho); recusada não', () => {
      assert.equal(itOutra?.intencao, 'Quero um resumo do mês por categoria', '"outra direção" com texto vira item')
      assert.equal(sim.fazer, sim.virouItem, 'ideia aceita é construída direto (07/10: a IA escolheu outro item e reconstruiu o MVP)'); assert.equal(outra.fazer, outra.virouItem)
      assert.equal(fz.fazer, 'II-9', '"Fazer: X" no socorro manda construir o item X'); assert.equal(fz.virouItem, undefined)
      assert.equal(it.origem, 'felipe'); assert.equal(it.intencao, 'Sim, criar área de compromissos'); assert.match(it.citacao, /Cria a área de compromissos\? > Sim/); assert.equal(nao.virouItem, undefined)
    })
  }
}

/* CC-890: sem proposta, o arquiteto pede direção em vez de morrer calado */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const Ar = await import('./src/arquiteto.mjs'); const Bk = await import('./src/backlog.mjs')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'socorro-')); fs.mkdirSync(path.join(d, 'docs')); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  const r = await Ar.passoOuSocorro(d, { binario: '/bin/false' })
  const ficha = Bk.ler(Bk.caminhoPadrao(d)).itens.find((x) => x.id === r.pergunta?.id)
  const msg = Ar.mensagemDaPergunta(r.pergunta)
  const sq = Ar.perguntaDeSocorro('x'.repeat(900))
  fs.rmSync(d, { recursive: true, force: true })
  t('arquiteto: sem proposta (Claude falhou), a pergunta de socorro vira ficha e mostra opções, em vez de calar', () => {
    assert.equal(r.socorro, true); assert.equal(ficha.estado, 'DE'); assert.deepEqual(ficha.opcoes, ['Parar por enquanto', 'Outra direção (escreva abaixo)'], 'sem fila: parar ou outra direção, nunca "tente de novo"')
    assert.match(msg.texto, /Preciso da sua direção/); assert.equal(msg.acoes.length, 2)
  })
  t('arquiteto: o motivo do socorro vai cortado, e a pergunta passa pelo contrato', () => {
    assert.ok(sq.porque.length <= 500); const { fazer: _f_sq, ...sqC } = sq; assert.equal(Ar.validarProposta(JSON.stringify(sqC)).ok, true, JSON.stringify(Ar.validarProposta(JSON.stringify(sqC)).erros))
  })
  const sf = Ar.perguntaDeSocorro('a pergunta é quase igual a CN-56', { fila: [{ intencao: 'Lançar gasto rápido' }, { intencao: 'Contas fixas separadas' }, { intencao: 'terceira' }] })
  t('arquiteto: o socorro põe primeiro o item que ELE criou (CN-121) e "Fazer: X" constrói o item direto', () => {
    const sq2 = Ar.perguntaDeSocorro('recusada', { esperandoDele: [{ id: 'CN-121', origem: 'felipe', intencao: 'A sobra voltou a mostrar a conta errada' }], fila: [{ id: 'CN-16', origem: 'felipe', intencao: 'Lançar gasto' }] })
    assert.deepEqual(sq2.opcoes, ['Fazer: A sobra voltou a mostrar a conta errada', 'Fazer: Lançar gasto', 'Outra direção (escreva abaixo)'])
    assert.equal(sq2.fazer['Fazer: A sobra voltou a mostrar a conta errada'], 'CN-121')
  })
  t('arquiteto: o socorro oferece o que está na fila (no máximo 2) e explica sem jargão quando era repetição', () => {
    assert.deepEqual(sf.opcoes, ['Fazer: Lançar gasto rápido', 'Fazer: Contas fixas separadas', 'Outra direção (escreva abaixo)'])
    assert.match(sf.porque, /repetiam algo que você já decidiu/); assert.doesNotMatch(sf.porque, /contrato|CN-56/)
    const { fazer: _f_sf, ...sfC } = sf; assert.equal(Ar.validarProposta(JSON.stringify(sfC)).ok, true, JSON.stringify(Ar.validarProposta(JSON.stringify(sfC)).erros))
  })
}

/* CC-886: juntar a cópia ao projeto de verdade */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path'); const { execFileSync } = await import('node:child_process')
  const Ar = await import('./src/arquiteto.mjs')
  const montar = () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'junta-')); const d = path.join(raiz, 'VPS_junta-teste')
    fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.mkdirSync(path.join(d, 'src'))
    for (const [f, c] of [['src/a.txt', 'a original\n'], ['src/b.txt', 'b original\n'], ['src/c.txt', 'c original\n'], ['docs/backlog.jsonl', '{"id":"X-1"}\n']]) fs.writeFileSync(path.join(d, f), c)
    const git = (...a) => execFileSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: 'pipe' }).toString()
    git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'base')
    process.env.CC_ARQUITETO_COPIAS = path.join(raiz, 'copias')
    const copia = Ar.copiaIsolada(d, 'XJ-1')
    fs.writeFileSync(path.join(copia, 'src/a.txt'), 'a mexido na copia\n'); fs.mkdirSync(path.join(copia, 'novo')); fs.writeFileSync(path.join(copia, 'novo/x.txt'), 'x novo\n')
    fs.rmSync(path.join(copia, 'src/b.txt')); fs.writeFileSync(path.join(copia, 'docs/backlog.jsonl'), '{"id":"X-1"}\n{"id":"X-2 so na copia"}\n')
    fs.writeFileSync(path.join(copia, 'src/c.txt'), 'c mexido na copia\n')
    return { raiz, d, copia, git }
  }
  const lim = (m) => { fs.rmSync(m.raiz, { recursive: true, force: true }); delete process.env.CC_ARQUITETO_COPIAS }
  // 1) caminho feliz
  const m1 = montar(); const r1 = Ar.juntarCopia(m1.d, m1.copia)
  const lido = (m, f) => fs.existsSync(path.join(m.d, f)) ? fs.readFileSync(path.join(m.d, f), 'utf8') : null
  const preparados = m1.git('diff', '--cached', '--name-only').split('\n').filter(Boolean).sort()
  const commits1 = m1.git('rev-list', '--count', 'HEAD').trim()
  const feliz = { r: r1, a: lido(m1, 'src/a.txt'), x: lido(m1, 'novo/x.txt'), b: lido(m1, 'src/b.txt'), bk: lido(m1, 'docs/backlog.jsonl'), preparados, commits1 }
  lim(m1)
  // 2) ele deixou o mesmo arquivo sujo no projeto
  const m2 = montar(); fs.writeFileSync(path.join(m2.d, 'src/a.txt'), 'a mexido por ele, sem commit\n')
  const r2 = Ar.juntarCopia(m2.d, m2.copia); const a2 = lido(m2, 'src/a.txt'); const x2 = lido(m2, 'novo/x.txt'); lim(m2)
  // 3) o projeto já tinha mudado o arquivo num commit depois que a cópia nasceu
  const m3 = montar(); fs.writeFileSync(path.join(m3.d, 'src/c.txt'), 'c mexido no projeto\n'); m3.git('commit', '-qam', 'ele mexeu no c')
  const r3 = Ar.juntarCopia(m3.d, m3.copia); const x3 = lido(m3, 'novo/x.txt'); lim(m3)
  t('arquiteto: a junção leva alterados, novos e apagados ao projeto, preparados e SEM commit, e o backlog fica de fora', () => {
    assert.equal(feliz.r.ok, true); assert.equal(feliz.a, 'a mexido na copia\n'); assert.equal(feliz.x, 'x novo\n'); assert.equal(feliz.b, null)
    assert.equal(feliz.bk, '{"id":"X-1"}\n', 'o backlog do projeto não é sobrescrito pelo da cópia')
    assert.deepEqual(feliz.preparados, ['novo/x.txt', 'src/a.txt', 'src/b.txt', 'src/c.txt']); assert.equal(feliz.commits1, '1', 'nenhum commit novo')
  })
  t('arquiteto: arquivo que ele deixou sujo no projeto, ou que mudou dos dois lados, recusa a junção inteira e não toca em nada', () => {
    assert.equal(r2.ok, false); assert.deepEqual(r2.conflitos, ['src/a.txt']); assert.equal(a2, 'a mexido por ele, sem commit\n'); assert.equal(x2, null, 'nem o arquivo novo entrou')
    assert.equal(r3.ok, false); assert.deepEqual(r3.conflitos, ['src/c.txt']); assert.equal(x3, null)
  })
  // a caixa de ponto commita tudo que estiver sujo ao fim de uma sessão do Claude; o arquiteto só lê e a dispensa por sinal
  const { spawnSync } = await import('node:child_process'); const gancho = new URL('./hooks/caixa-sair.mjs', import.meta.url).pathname
  const ponto = (sinal) => {
    const m = montar(); fs.writeFileSync(path.join(m.d, 'src/sujo.txt'), 'x\\n'); m.git('add', '-A')
    spawnSync(process.execPath, [gancho], { input: JSON.stringify({ session_id: 'teste-ponto-0001', cwd: m.d }), env: { ...process.env, CC_SEM_PONTO: sinal }, encoding: 'utf8', timeout: 60000 })
    const n = m.git('rev-list', '--count', 'HEAD').trim(); lim(m); return n
  }
  const comSinal = ponto('1'), semSinal = ponto('')
  t('arquiteto: a caixa de ponto não commita por causa do arquiteto (com o sinal 1 commit, sem o sinal 2: o teste distingue)', () => {
    assert.equal(comSinal, '1'); assert.equal(semSinal, '2')
  })
  t('arquiteto: aprovar a revisão de obra feita na cópia pede a junção; recusar ou projeto direto não', () => {
    const rev = Ar.perguntaDeRevisao({ titulo: 'Tela' }, { ok: true, copia: true, dir: '/x/copia', saida: 'ok' })
    assert.equal(rev.opcoes[0], 'Está bom, junte ao projeto de verdade'); assert.equal(rev.juntar, '/x/copia')
    const direto = Ar.perguntaDeRevisao({ titulo: 'Tela' }, { ok: true, copia: false, dir: '/x', saida: 'ok' })
    assert.equal(direto.juntar, undefined); assert.equal(direto.opcoes[0], 'Está bom, segue para o próximo passo')
  })
}

/* CC-967: item que já teve obra aprovada nunca é construído sozinho de novo */
{
  const Ar = await import('./src/arquiteto.mjs')
  const it = (id, extra) => ({ id, origem: 'arquiteto', estado: 'OK', ...extra })
  const hist = [
    { id: 'CN-142', origem: 'felipe', estado: 'B1', intencao: 'backup diário' },
    it('CN-149', { proposta: { tipo: 'pedido', daFila: 'CN-142' } }),
    it('CN-150', { proposta: { tipo: 'revisao' }, escolha: 'Quase: quero ajustar' }),
    it('CN-161', { proposta: { tipo: 'revisao' }, escolha: 'Está bom, segue para o próximo passo' }),
  ]
  t('trava: item com obra já aprovada não é reconstruído sozinho (o backup construído duas vezes, 07/10)', () => {
    assert.deepEqual(Ar.jaTeveObraAprovada('CN-142', hist), { pedido: 'CN-149', revisao: 'CN-161' })
    assert.equal(Ar.jaTeveObraAprovada('CN-142', hist.slice(0, 3)), null, 'revisão reprovada não conta como feito')
    assert.equal(Ar.jaTeveObraAprovada('CN-142', hist.slice(0, 1)), null, 'sem obra nenhuma, constrói')
    assert.equal(Ar.jaTeveObraAprovada('CN-999', hist), null)
  })
}

/* CC-957: sessão sem atividade há 3 dias ou mais é Esquecida (decisão dele em 07/10) */
{
  const { marcarEsquecidas } = await import('./src/cockpit2.mjs')
  const H = 3600e3
  const d = { conectadas: [{ id: 'a', estado: 'espera você', desdeMs: 142 * H }, { id: 'b', estado: 'ociosa', desdeMs: 71 * H }, { id: 'c', estado: 'trabalhando', desdeMs: 200 * H }, { id: 'd', estado: 'ociosa', desdeMs: 72 * H }],
    espera: [{ tipo: 'agente', id: 'e', rotulo: 'parou', desdeMs: 80 * H }, { tipo: 'agente', id: 'f', rotulo: 'pergunta', desdeMs: 2 * H }, { tipo: 'pendencia', id: 'g', desdeMs: 900 * H }] }
  const lim = marcarEsquecidas(d)
  t('Sessões: parada há 3 dias ou mais vira Esquecida; trabalhando e tarefa dele nunca; menos de 3 dias não', () => {
    assert.equal(lim, 3 * 864e5)
    assert.deepEqual(d.conectadas.filter((x) => x.esquecida).map((x) => x.id), ['a', 'd'])
    assert.deepEqual(d.espera.filter((x) => x.esquecida).map((x) => x.id), ['e'])
  })
}

/* CC-840: a fila de modelos */
const { FILA_DE_MODELOS, RESERVA_OPENCODE, chaveDe, proximoDegrau } = await import('./src/filaModelos.mjs')
t('fila: começa pelo primeiro grátis', () => assert.equal(chaveDe(proximoDegrau()), RESERVA_OPENCODE[0]))
t('fila: esgotados os grátis sobe para o Antigravity, e só depois o Haiku', () => {
  const p1 = proximoDegrau({ tentados: [...RESERVA_OPENCODE] })
  assert.equal(p1.agente, 'agy')
  const p2 = proximoDegrau({ tentados: [...RESERVA_OPENCODE, chaveDe(p1)] })
  assert.deepEqual([p2.agente, p2.modelo], ['claude', 'haiku'])
  assert.equal(FILA_DE_MODELOS.at(-1).modelo, 'haiku', 'o Haiku é o último degrau')
  assert.equal(proximoDegrau({ tentados: FILA_DE_MODELOS.map(chaveDe) }), null, 'fila inteira tentada: acabou')
})
t('fila: o disjuntor pula o modelo com limite lembrado, e ele volta quando o prazo vence', () => {
  const agora = 1000
  const limitados = new Map([[RESERVA_OPENCODE[0], 2000]])
  assert.equal(chaveDe(proximoDegrau({ limitados, agora })), RESERVA_OPENCODE[1])
  assert.equal(chaveDe(proximoDegrau({ limitados, agora: 3000 })), RESERVA_OPENCODE[0])
})
t('fila: o teto é o orçamento, e a fila não passa dele', () => {
  assert.equal(proximoDegrau({ tentados: [...RESERVA_OPENCODE], teto: 'opencode' }), null)
  assert.equal(proximoDegrau({ tentados: [...RESERVA_OPENCODE], teto: 'agy' }).agente, 'agy')
  assert.equal(proximoDegrau({ tentados: [...RESERVA_OPENCODE, 'agy:padrão'], teto: 'agy' }), null, 'o Haiku fica de fora')
})

console.log(`\n${ok} verificações, 0 falhas (tarefa)\n`)
