/**
 * CC-1064: rascunhos. Casa temporária (CC_HOME e CC_RASCUNHOS), com ligar,
 * desligar e criarProjeto falsos: nada abre tmux nem cria projeto de verdade.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rascunhos-'))
process.env.CC_HOME = path.join(tmp, 'claude')
process.env.CC_RASCUNHOS = path.join(tmp, 'projetos', '_rascunhos')
const BASE = path.join(tmp, 'projetos')
const R = await import('./src/rascunhos.mjs')
const { pastaTranscritos } = await import('./src/remotecontrol.mjs')

let falhou = false
let n = 0
const ok = (m) => { n++; console.log(`  ok   ${m}`) }
const teste = async (m, fn) => { try { await fn(); ok(m) } catch (e) { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) } }

const chamadas = []
const ligar = async (rotulo, cwd, op) => { chamadas.push({ rotulo, cwd, op }); return { ok: true } }
const desligados = []
const desligar = async (rotulo) => { desligados.push(rotulo); return { ok: true } }
const criarProjetoFake = (base, { nome, descricao }) => {
  const raiz = path.join(base, nome)
  fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  return { ok: true, raiz, projeto: nome, descricao }
}

await teste('slugDe tira acento, pontuação e limita o tamanho', () => {
  assert.equal(R.slugDe('Café com IA: app de receitas!'), 'cafe-com-ia-app-de-receitas')
  assert.ok(R.slugDe('x'.repeat(100)).length <= 40)
  assert.match(R.slugDe(''), /^rascunho-\d{8}-\d{4}$/)
  assert.match(R.slugDe('!!!'), /^rascunho-\d{8}-\d{4}$/)
})

await teste('ehRascunho: dentro da base sim, irmão com o mesmo prefixo não', () => {
  const b = R.baseRascunhos()
  assert.equal(R.ehRascunho(path.join(b, 'ideia')), true)
  assert.equal(R.ehRascunho(path.join(b, 'ideia', 'sub')), true)
  assert.equal(R.ehRascunho(`${b}-irmao`), false)
  assert.equal(R.ehRascunho(path.join(`${b}-irmao`, 'ideia')), false)
  assert.equal(R.ehRascunho(b), false)
  assert.equal(R.ehRascunho(''), false)
})

let slug1
await teste('criar monta a pasta, sem CLAUDE.md nem .git na raiz, e liga a sessão remota', async () => {
  const r = await R.criar({ titulo: 'Café com IA: app de receitas!' }, { ligar })
  assert.equal(r.ok, true)
  slug1 = r.slug
  assert.equal(slug1, 'cafe-com-ia-app-de-receitas')
  const pasta = path.join(R.baseRascunhos(), slug1)
  assert.match(fs.readFileSync(path.join(pasta, 'IDEIA.md'), 'utf8'), /^# Café com IA: app de receitas!\n/)
  assert.match(fs.readFileSync(path.join(pasta, '.claude', 'CLAUDE.md'), 'utf8'), /Rascunho, não projeto/)
  assert.equal(fs.existsSync(path.join(pasta, 'CLAUDE.md')), false)
  assert.equal(fs.existsSync(path.join(pasta, '.git')), false)
  const c = chamadas.at(-1)
  assert.equal(c.rotulo, `rascunho-${slug1}`)
  assert.equal(c.cwd, pasta)
  assert.equal(c.op.remoto, true)
})

await teste('título repetido vira -2', async () => {
  const r = await R.criar({ titulo: 'Café com IA: app de receitas!' }, { ligar })
  assert.equal(r.slug, 'cafe-com-ia-app-de-receitas-2')
})

await teste('ligar que falha deixa a pasta e diz o erro', async () => {
  const r = await R.criar({ titulo: 'Sessão que cai' }, { ligar: async () => ({ ok: false, erro: 'tmux sumiu' }) })
  assert.equal(r.ok, false)
  assert.equal(r.erro, 'tmux sumiu')
  assert.equal(r.slug, 'sessao-que-cai')
  assert.ok(fs.existsSync(path.join(R.baseRascunhos(), 'sessao-que-cai', 'IDEIA.md')))
})

await teste('listar lê título e resumo do IDEIA.md e marca viva pelo mapa', () => {
  const pasta = path.join(R.baseRascunhos(), slug1)
  fs.writeFileSync(path.join(pasta, 'IDEIA.md'), '# Receitas com IA\n\nUm app que sugere receitas\ncom o que tem na geladeira.\n\n## O que foi decidido\n- nada\n')
  const lista = R.listar({ vivos: { [`rascunho-${slug1}`]: { cwd: pasta } } })
  const a = lista.find((x) => x.slug === slug1)
  assert.equal(a.titulo, 'Receitas com IA')
  assert.equal(a.resumo, 'Um app que sugere receitas com o que tem na geladeira.')
  assert.equal(a.viva, true)
  assert.equal(a.rotulo, `rascunho-${slug1}`)
  assert.equal(lista.find((x) => x.slug === 'cafe-com-ia-app-de-receitas-2').viva, false)
  assert.equal(lista[0].slug, slug1, 'o mais mexido vem primeiro')
  assert.ok(lista.every((x) => !x.slug.startsWith('.')))
})

await teste('descartar move para a lixeira, some da lista e recusa slug perigoso', async () => {
  const r = await R.descartar('cafe-com-ia-app-de-receitas-2', { desligar })
  assert.equal(r.ok, true)
  assert.ok(desligados.includes('rascunho-cafe-com-ia-app-de-receitas-2'))
  assert.equal(fs.existsSync(path.join(R.baseRascunhos(), 'cafe-com-ia-app-de-receitas-2')), false)
  const lixo = fs.readdirSync(path.join(R.baseRascunhos(), '.lixeira'))
  assert.ok(lixo.some((x) => /^cafe-com-ia-app-de-receitas-2-\d{8}-\d{4}$/.test(x)))
  assert.ok(!R.listar().some((x) => x.slug === 'cafe-com-ia-app-de-receitas-2'))
  for (const ruim of ['../x', '..', 'a/b', '.lixeira', '', 'A', null]) {
    assert.equal((await R.descartar(ruim, { desligar })).ok, false, `recusa ${ruim}`)
    assert.equal((await R.promover(ruim, { nome: 'VPS_x' }, { ligar, desligar, criarProjeto: criarProjetoFake, base: BASE })).ok, false)
  }
  assert.match((await R.descartar('nao-existe', { desligar })).erro, /não achei o rascunho nao-existe/)
  assert.ok(fs.existsSync(path.join(R.baseRascunhos(), slug1)), 'o outro rascunho segue de pé')
})

await teste('promover: cria o projeto, leva a ideia e a conversa, reabre e manda o rascunho à lixeira', async () => {
  const pasta = path.join(R.baseRascunhos(), slug1)
  fs.writeFileSync(path.join(pasta, 'esboco.txt'), 'apoio')
  const dirTrans = pastaTranscritos(pasta)
  fs.mkdirSync(dirTrans, { recursive: true })
  fs.writeFileSync(path.join(dirTrans, 'conv-123.jsonl'), '{"a":1}\n')
  chamadas.length = 0
  const r = await R.promover(slug1, { nome: 'VPS_receitas' }, { ligar, desligar, criarProjeto: criarProjetoFake, base: BASE })
  assert.equal(r.ok, true, JSON.stringify(r))
  const raiz = path.join(BASE, 'VPS_receitas')
  assert.equal(r.raiz, raiz)
  assert.match(fs.readFileSync(path.join(raiz, 'docs', 'produto', 'IDEIA.md'), 'utf8'), /^# Receitas com IA/)
  assert.equal(fs.readFileSync(path.join(raiz, 'docs', 'produto', 'rascunho', 'esboco.txt'), 'utf8'), 'apoio')
  assert.equal(fs.existsSync(path.join(raiz, 'docs', 'produto', 'rascunho', '.claude')), false)
  assert.equal(fs.readFileSync(path.join(pastaTranscritos(raiz), 'conv-123.jsonl'), 'utf8'), '{"a":1}\n')
  assert.ok(fs.existsSync(path.join(dirTrans, 'conv-123.jsonl')), 'a conversa foi copiada, não movida')
  const c = chamadas.at(-1)
  assert.equal(c.rotulo, 'VPS_receitas')
  assert.equal(c.cwd, raiz)
  assert.equal(c.op.retomar, 'conv-123')
  assert.equal(c.op.remoto, true)
  assert.equal(fs.existsSync(pasta), false)
  assert.ok(fs.readdirSync(path.join(R.baseRascunhos(), '.lixeira')).some((x) => x.startsWith(`${slug1}-`)))
  assert.ok(desligados.includes(`rascunho-${slug1}`))
  assert.ok(r.passos.every((p) => p.ok), JSON.stringify(r.passos))
})

await teste('promover sem conversa abre a sessão com o pedido de ler o IDEIA.md', async () => {
  const s = (await R.criar({ titulo: 'Sem histórico' }, { ligar })).slug
  chamadas.length = 0
  const r = await R.promover(s, { nome: 'VPS_sem_historico' }, { ligar, desligar, criarProjeto: criarProjetoFake, base: BASE })
  assert.equal(r.ok, true)
  const c = chamadas.at(-1)
  assert.equal(c.op.retomar, undefined)
  assert.match(c.op.pedido, /docs\/produto\/IDEIA\.md/)
})

await teste('promover com criarProjeto que falha: o rascunho continua intacto', async () => {
  const s = (await R.criar({ titulo: 'Vai falhar' }, { ligar })).slug
  const r = await R.promover(s, { nome: 'VPS_falha' }, { ligar, desligar, base: BASE, criarProjeto: () => ({ ok: false, erro: 'já existe uma pasta chamada VPS_falha aí' }) })
  assert.equal(r.ok, false)
  assert.match(r.erro, /já existe/)
  assert.ok(fs.existsSync(path.join(R.baseRascunhos(), s, 'IDEIA.md')))
  const jogou = await R.promover(s, { nome: 'VPS_falha' }, { ligar, desligar, base: BASE, criarProjeto: () => { throw new Error('quebrou') } })
  assert.equal(jogou.ok, false)
  assert.ok(fs.existsSync(path.join(R.baseRascunhos(), s)))
})

await teste('promover recusa nome de projeto inválido sem tocar em nada', async () => {
  const s = (await R.criar({ titulo: 'Nome ruim' }, { ligar })).slug
  const antes = desligados.length
  const r = await R.promover(s, { nome: 'com espaço' }, { ligar, desligar, criarProjeto: criarProjetoFake, base: BASE })
  assert.equal(r.ok, false)
  assert.equal(desligados.length, antes)
  assert.ok(fs.existsSync(path.join(R.baseRascunhos(), s)))
})

await teste('prefixo é PC_ ou VPS_', () => assert.match(R.prefixo(), /^(PC_|VPS_)$/))

fs.rmSync(tmp, { recursive: true, force: true })
if (falhou) process.exit(1)
console.log(`\n${n} verificações de rascunhos passaram`)
