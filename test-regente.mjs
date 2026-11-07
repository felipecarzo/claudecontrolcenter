/**
 * CC-1068, peça M1: o Regente puro. Casa temporária (CC_HOME) e pasta temporária, nunca um projeto real.
 * O modelo é sempre um `chamar` falso: nada abre o claude.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'regente-'))
process.env.CC_HOME = path.join(tmp, 'claude')
const cwd = path.join(tmp, 'projeto')
fs.mkdirSync(cwd, { recursive: true })
const R = await import('./src/regente.mjs')

let falhou = false
let n = 0
const teste = async (m, fn) => { try { await fn(); n++; console.log(`  ok   ${m}`) } catch (e) { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) } }

const pedido = { tipo: 'pedido', titulo: 'Tela de gasto', opcoes: ['Construir agora', 'Depois'], executa: 'Construir agora' }
const json = (o) => JSON.stringify(o)

await teste('ler sem arquivo devolve o padrão', () => {
  assert.deepStrictEqual(R.ler(cwd), { ligado: false, desde: null, teto: 0, risco: false, travas: [] })
})
await teste('ligar e desligar gravam e leem', () => {
  const e = R.ligar(cwd, { risco: true })
  assert.ok(e.ligado && e.desde && e.risco)
  assert.strictEqual(R.ler(cwd).ligado, true)
  assert.ok(fs.existsSync(path.join(cwd, '.framework', 'regente.json')))
  R.desligar(cwd)
  assert.strictEqual(R.ler(cwd).ligado, false)
  assert.strictEqual(R.ler(cwd).teto, 0)
})
await teste('aprender grava com data, cria cabeçalho e recusa curto', () => {
  const r = R.aprender(cwd, 'Login só depois de guardar dado de alguém', { quando: new Date(2026, 9, 5) })
  assert.ok(r.ok && r.linha === '- 05/10: Login só depois de guardar dado de alguém')
  assert.ok(fs.readFileSync(r.arquivo, 'utf8').startsWith('# Regras do Regente'))
  const g = R.aprender(cwd, 'Nunca mexer em produção sem ele', { geral: true, quando: new Date(2026, 9, 6) })
  assert.ok(g.ok && g.arquivo === R.arquivoRegrasGeral())
  assert.strictEqual(R.aprender(cwd, '').ok, false)
  assert.strictEqual(R.aprender(cwd, 'sim ok').ok, false)
  assert.ok(R.aprender(cwd, 'curto').erro)
})
await teste('regrasDe junta geral e projeto, só linhas com "- "', () => {
  const t = R.regrasDe(cwd)
  assert.ok(t.indexOf('## Regras gerais') < t.indexOf('Nunca mexer em produção'))
  assert.ok(t.indexOf('Nunca mexer em produção') < t.indexOf('## Regras deste projeto'))
  assert.ok(t.indexOf('## Regras deste projeto') < t.indexOf('Login só depois'))
  assert.ok(!t.includes('Cada linha é uma correção'))
})
await teste('ehRegra reconhece Regra:, geral:, GERAL: e ignora texto comum', () => {
  assert.deepStrictEqual(R.ehRegra('Regra: sempre foto'), { geral: false, texto: 'sempre foto' })
  assert.deepStrictEqual(R.ehRegra('geral: sem senha em texto'), { geral: true, texto: 'sem senha em texto' })
  assert.deepStrictEqual(R.ehRegra('GERAL: x y z'), { geral: true, texto: 'x y z' })
  assert.strictEqual(R.ehRegra('a regra: é boa'), null)
  assert.strictEqual(R.ehRegra('faz a tela'), null)
})
await teste('exigeDele: 3 sim, 3 não', () => {
  assert.ok(R.exigeDele({ intencao: 'Cadastrar a conta de e-mail' }))
  assert.ok(R.exigeDele({ pronto: 'testar no iPhone dele' }))
  assert.ok(R.exigeDele({ conferir: 'dele:abrir', natureza: 'DEC' }))
  assert.ok(!R.exigeDele({ intencao: 'Tela de lançar gasto' }))
  assert.ok(!R.exigeDele({ conferir: 'dele:abrir', natureza: 'DEF' }))
  assert.ok(!R.exigeDele({ intencao: 'Contagem de itens', pronto: 'lista mostra o total' }))
})
await teste('pedidoDeDecisao traz regras, critérios e a proposta', () => {
  const t = R.pedidoDeDecisao(pedido, { a: 1 }, '- regra boa')
  for (const s of ['- regra boa', 'segurança antes de prazo', 'reversível', 'Tela de gasto', '"escolha"']) assert.ok(t.includes(s), s)
})
await teste('validarDecisao aceita JSON e bloco, recusa escolha fora das opções', () => {
  const ok = R.validarDecisao(json({ escolha: ' Depois ', porque: 'ainda não há dado a proteger' }), pedido)
  assert.ok(ok.ok && ok.decisao.escolha === 'Depois')
  assert.ok(R.validarDecisao('```json\n' + json({ escolha: 'Construir agora', porque: 'o MVP pede esta tela' }) + '\n```', pedido).ok)
  assert.ok(!R.validarDecisao(json({ escolha: 'Talvez', porque: 'uma razão qualquer longa' }), pedido).ok)
  assert.ok(!R.validarDecisao(json({ escolha: 'Depois', porque: 'curto' }), pedido).ok)
  assert.ok(!R.validarDecisao('texto solto', pedido).ok)
  assert.ok(!R.validarDecisao(json({ escolha: 'Depois', porque: 'razão com — travessão aqui' }), pedido).ok)
})
await teste('decisaoPadrao nos 5 tipos', () => {
  assert.strictEqual(R.decisaoPadrao(pedido), 'Construir agora')
  const rev = { tipo: 'revisao', opcoes: ['Está bom', 'Tenta de novo'] }
  assert.strictEqual(R.decisaoPadrao(rev, { provado: true }), 'Está bom')
  assert.strictEqual(R.decisaoPadrao(rev), 'Tenta de novo')
  assert.strictEqual(R.decisaoPadrao({ tipo: 'ideia', titulo: 'Idea', opcoes: ['Entra', 'Fora'] }), 'Entra')
  const socorro = { tipo: 'ideia', titulo: 'Preciso da sua direção', opcoes: ['Outra coisa', 'Fazer: CN-1'] }
  assert.strictEqual(R.decisaoPadrao(socorro), 'Fazer: CN-1')
  assert.strictEqual(R.decisaoPadrao({ ...socorro, opcoes: ['Outra coisa'] }), null)
  assert.strictEqual(R.decisaoPadrao({ tipo: 'melhoria', opcoes: ['Mudar a regra do login', 'Manter como está'] }), 'Manter como está')
  assert.strictEqual(R.decisaoPadrao({ tipo: 'melhoria', opcoes: ['Mudar a regra'] }), null)
})
await teste('decidir: modelo válido', async () => {
  const d = await R.decidir(cwd, pedido, {}, { chamar: async () => json({ escolha: 'Depois', porque: 'sem dado a proteger ainda' }) })
  assert.deepStrictEqual(d, { escolha: 'Depois', porque: 'sem dado a proteger ainda', origem: 'modelo' })
})
await teste('decidir: inválido duas vezes cai no padrão, e a segunda leva o erro', async () => {
  const vistos = []
  const d = await R.decidir(cwd, pedido, {}, { chamar: async (t) => { vistos.push(t); return 'não sei' } })
  assert.strictEqual(d.origem, 'padrao')
  assert.strictEqual(d.escolha, 'Construir agora')
  assert.strictEqual(vistos.length, 2)
  assert.ok(vistos[1].includes('RECUSADA'))
})
await teste('decidir: inválido uma vez e depois válido', async () => {
  let i = 0
  const d = await R.decidir(cwd, pedido, {}, { chamar: async () => (i++ ? json({ escolha: 'Depois', porque: 'na segunda deu certo' }) : 'lixo') })
  assert.strictEqual(d.origem, 'modelo')
})
await teste('decidir: chamar que lança é INDISPONÍVEL (não cai no padrão); sem opções devolve null', async () => {
  await assert.rejects(R.decidir(cwd, pedido, {}, { chamar: async () => { throw new Error('caiu') } }), (e) => e.indisponivel === true && /^regente: modelo indisponível: /.test(e.message))
  assert.strictEqual(await R.decidir(cwd, { tipo: 'ideia', opcoes: [] }, {}, { chamar: async () => '' }), null)
  assert.strictEqual(await R.decidir(cwd, null, {}, {}), null)
})
await teste('decidir: saída de limite sem JSON, e saída vazia, são indisponível', async () => {
  for (const txt of ['Claude AI usage limit reached. Your limit resets at 11:40.', "You're out of credits, try again later", '   ']) {
    await assert.rejects(R.decidir(cwd, pedido, {}, { chamar: async () => txt }), (e) => e.indisponivel === true, txt)
  }
})
await teste('decidir: resposta inválida duas vezes (mas resposta) segue para o padrão', async () => {
  const d = await R.decidir(cwd, pedido, {}, { chamar: async () => 'talvez' })
  assert.strictEqual(d.origem, 'padrao')
})
await teste('opção que pede texto ("escreva abaixo") nunca é decisão válida, nem padrão', () => {
  const rev = { tipo: 'revisao', titulo: 'Revisar: x', opcoes: ['Está bom, segue', 'Quero ajustar o pedido (escreva abaixo)'] }
  assert.strictEqual(R.validarDecisao(json({ escolha: 'Quero ajustar o pedido (escreva abaixo)', porque: 'quero ajustar isso' }), rev).ok, false)
  assert.strictEqual(R.decisaoPadrao(rev, { provado: false }), null)
  assert.strictEqual(R.decisaoPadrao(rev, { provado: true }), 'Está bom, segue')
  const falha = { tipo: 'revisao', titulo: 'Revisar: y', opcoes: ['Tenta de novo do jeito que estava', 'Quero ajustar o pedido (escreva abaixo)', 'Para por aqui'] }
  assert.strictEqual(R.decisaoPadrao(falha, {}), 'Tenta de novo do jeito que estava')
  assert.strictEqual(R.decisaoPadrao(falha, { jaTentou: true }), null)
})
await teste('trava de laço: ehLaco só com 2 iguais seguidas; ultimas guarda 6', () => {
  const d = (f, e) => ({ ficha: f, escolha: e })
  assert.strictEqual(R.ehLaco([d('A', 'x'), d('A', 'x')], 'A', 'x'), true)
  assert.strictEqual(R.ehLaco([d('A', 'y'), d('A', 'x')], 'A', 'x'), false)
  assert.strictEqual(R.ehLaco([d('A', 'x')], 'A', 'x'), false)
  for (let i = 0; i < 9; i++) R.anotarDecisao(cwd, 'T' + i, 'e')
  assert.strictEqual(R.ler(cwd).ultimas.length, 6)
  assert.strictEqual(R.jaTentou([d('A', 'Tenta de novo')], 'A'), true)
  R.ligar(cwd); assert.deepStrictEqual(R.ler(cwd).ultimas, []); R.desligar(cwd, 'laço: A x repetida'); assert.strictEqual(R.ler(cwd).motivo, 'laço: A x repetida')
})
await teste('mensagem de commit: feat(ID): título, sem Co-Authored-By, sem travessão, uma linha', () => {
  const m = R.mensagemDeCommit('CM-7', 'Criar a tela — com\nCo-Authored-By: Claude <x@y> e muito mais texto para passar do limite de tamanho')
  assert.ok(m.startsWith('feat(CM-7): ') && !/co-authored/i.test(m) && !/[—–\n]/.test(m) && m.length <= 80, m)
})
await teste('arquivosParaCommit tira segredo, .env, node_modules e arquivos de controle do painel', () => {
  const r = R.arquivosParaCommit(['ola.txt', '.env', 'apps/x/.env.local', 'node_modules/a/b.js', 'chave.pem', 'src/secrets.json', '.framework/regente.json', 'docs/backlog.jsonl', '../fora.txt', 'src/app.js', 'ola.txt'])
  assert.deepStrictEqual(r, ['ola.txt', 'src/app.js'])
})
await teste('git de verdade em pasta temporária: commita só a lista, sem segredo e sem Co-Authored-By; item com commit fecha', async () => {
  const { execFileSync } = await import('node:child_process')
  const g = path.join(tmp, 'repo'); fs.mkdirSync(g)
  const sh = (...a) => execFileSync('git', ['-C', g, ...a], { encoding: 'utf8' })
  sh('init', '-q'); sh('config', 'user.email', 't@t'); sh('config', 'user.name', 't')
  fs.writeFileSync(path.join(g, 'ola.txt'), 'oi\n'); fs.writeFileSync(path.join(g, '.env'), 'X=1\n'); fs.writeFileSync(path.join(g, 'outro.txt'), 'de outra sessão\n')
  fs.writeFileSync(path.join(g, 'tem-chave.txt'), 'k=sk-ant-' + 'a'.repeat(30) + '\n')
  const c = await R.commitarArquivos(g, 'CM-1', 'Criar ola.txt', ['ola.txt', '.env', 'tem-chave.txt'])
  assert.ok(c.ok && c.hash, JSON.stringify(c))
  assert.deepStrictEqual(c.arquivos, ['ola.txt'])
  assert.deepStrictEqual(sh('show', '--name-only', '--format=%s%n%b', 'HEAD').trim().split('\n').filter(Boolean), ['feat(CM-1): Criar ola.txt', 'ola.txt'])
  assert.ok(!/co-authored/i.test(sh('log', '-1', '--format=%B')))
  assert.ok(sh('status', '--short').includes('outro.txt'), 'o que a micro tarefa não declarou continua fora do commit')
  const feito = await R.commitDoItem(g, { id: 'CM-1', intencao: 'qualquer coisa' })
  assert.ok(feito && feito.por === 'id' && feito.assunto.includes('CM-1'))
  assert.strictEqual(await R.commitDoItem(g, { id: 'CM-10', intencao: 'nada a ver aqui' }), null, 'CM-10 não casa com CM-1')
  fs.writeFileSync(path.join(g, 'tela.txt'), 't\n'); sh('add', 'tela.txt'); sh('commit', '-q', '-m', 'tela inicial pronta com listagem')
  assert.ok((await R.commitDoItem(g, { id: 'ZZ-9', intencao: 'Tela inicial com listagem' }))?.por === 'título')
  assert.strictEqual(await R.commitDoItem(g, { id: 'ZZ-8', intencao: 'Relatório mensal de gastos' }), null)
  assert.strictEqual((await R.empurrar(g)).pulado, true, 'sem origin não empurra, e não trava')
})
await teste('maestro: aviso de limite e painel fora do ar são ADIAR, não reprovar', async () => {
  const M = await import('./src/maestro.mjs')
  assert.ok(M.limiteNaConversa({ novas: [{ de: 'felipe', texto: 'faz' }, { de: 'claude', texto: 'Claude usage limit reached. Resets at 11:40.' }] }))
  assert.strictEqual(M.limiteNaConversa({ novas: [{ de: 'claude', texto: 'Criei o arquivo ola.txt com a frase.' }] }), null)
  assert.ok(M.falhaDePainel(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })))
  assert.ok(!M.falhaDePainel(new Error('o build falhou')))
})

// CC-1068 M3: escada do maestro e permissão bypass
const V = await import('./src/vigia.mjs')
const GA = await import('./src/gateAgentes.mjs')
const M = await import('./src/maestro.mjs')

await teste('degrauDe com a escada padrão segue com 3 degraus na mesma ordem', () => {
  assert.strictEqual(V.ESCADA.length, 3)
  assert.deepStrictEqual([0, 1, 2, 9].map((i) => V.degrauDe(i).agente), ['opencode', 'opencode', 'agy', 'agy'])
})
await teste('ESCADA_REGENTE: claude sonnet, depois claude opus', () => {
  assert.deepStrictEqual(V.ESCADA_REGENTE, [{ agente: 'claude', modelo: 'sonnet' }, { agente: 'claude', modelo: 'opus' }])
  assert.strictEqual(V.degrauDe(5, V.ESCADA_REGENTE).modelo, 'opus')
})
await teste('o maestro escolhe a escada pelo estado do Regente', () => {
  assert.strictEqual(M.escadaDe(cwd), V.ESCADA)
  R.ligar(cwd)
  assert.strictEqual(M.escadaDe(cwd), V.ESCADA_REGENTE)
  assert.strictEqual(M.degrauInicial(cwd), 0)
  R.desligar(cwd)
})
await teste('args do claude: bypass inclui --dangerously-skip-permissions, sem bypass não', () => {
  const base = { cwd, novaSessao: 'x', modelo: 'sonnet', conversa: null }
  const com = GA.AGENTES_GATE.claude.args({ ...base, permissao: 'bypass' })
  const sem = GA.AGENTES_GATE.claude.args({ ...base, permissao: 'acceptEdits' })
  assert.ok(com.includes('--dangerously-skip-permissions'))
  assert.ok(!sem.includes('--dangerously-skip-permissions'))
  assert.strictEqual(sem[sem.indexOf('--permission-mode') + 1], 'acceptEdits')
})

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${n} verificações${falhou ? ', COM FALHA' : ''}`)
process.exit(falhou ? 1 : 0)
