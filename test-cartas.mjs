// CC-909 (D2): explicação longa do AGY. Nunca chama o AGY de verdade.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cartas-'))
process.env.CC_HOME = casa
const { chaveDaExplicacao, promptDaExplicacao, ehCurta, explicar } = await import('./src/cartas.mjs')
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }

try {
  t('a chave é estável e muda com a opção', () => {
    const a = chaveDaExplicacao({ pergunta: 'P', opcao: 'A' })
    assert.equal(a, chaveDaExplicacao({ pergunta: 'P', opcao: 'A' }))
    assert.notEqual(a, chaveDaExplicacao({ pergunta: 'P', opcao: 'B' }))
    assert.notEqual(a, chaveDaExplicacao({ pergunta: 'Q', opcao: 'A' }))
    assert.match(a, /^explica::[0-9a-f]{16}$/)
  })

  t('o prompt: sem travessão, com "Não use ferramentas", tamanhos cortados', () => {
    const p = promptDaExplicacao({ pergunta: 'x — y – z '.repeat(200), opcao: 'o'.repeat(500), contexto: 'c'.repeat(5000), projeto: 'proj' })
    assert.ok(!/[—–]/.test(p), 'travessão no prompt')
    assert.ok(p.includes('Não use ferramentas.'))
    assert.ok(p.includes('para quem DECIDE'))
    assert.ok(p.includes('6 frases'))
    assert.equal((p.match(/o{201}/g) || []).length, 0, 'opção passou de 200')
    assert.equal((p.match(/c{1501}/g) || []).length, 0, 'contexto passou de 1500')
    assert.ok(p.includes('c'.repeat(1500)))
    const pergunta = p.split('\n').find((l) => l.startsWith('PERGUNTA: ')).slice(10)
    assert.equal(pergunta.length, 600)
  })

  t('o prompt nunca leva segredo nem conteúdo de .env', () => {
    const p = promptDaExplicacao({ pergunta: 'q', opcao: 'o', contexto: 'DATABASE_PASSWORD=supersecreto123\nSUPABASE_SERVICE_KEY="abcdefghij12345"\nAKIAABCDEFGHIJKLMNOP' })
    assert.ok(!p.includes('supersecreto123') && !p.includes('abcdefghij12345') && !p.includes('AKIAABCDEFGHIJKLMNOP'))
    assert.ok(p.includes('SEGREDO REMOVIDO'))
  })

  t('ehCurta: sem descrição, ou até 3 palavras', () => {
    assert.equal(ehCurta({ rotulo: 'uma opção bem comprida de rótulo', descricao: 'd' }), false)
    assert.equal(ehCurta({ rotulo: 'uma opção bem comprida de rótulo' }), true)
    assert.equal(ehCurta({ rotulo: 'Sim agora mesmo', descricao: 'd' }), true)
    assert.equal(ehCurta({ rotulo: 'Sim agora mesmo ok', descricao: 'd' }), false)
  })

  t('explicar: texto do cache, estado depois de pedir, erro de corpo inválido', () => {
    const pedidos = []
    const cache = {}
    const agy = {
      obterTexto: (k) => (cache[k] ? { texto: cache[k] } : null),
      pedirTexto: (o) => pedidos.push(o),
    }
    const c = { pergunta: 'Qual?', opcao: 'A', contexto: 'ctx', projeto: 'p' }
    assert.deepEqual(explicar(c, agy), { estado: 'resumindo' })
    assert.equal(pedidos.length, 1)
    assert.equal(pedidos[0].k, chaveDaExplicacao(c))
    assert.ok(pedidos[0].prompt.includes('Não use ferramentas.'))
    cache[chaveDaExplicacao(c)] = 'Explicação pronta.'
    assert.deepEqual(explicar(c, agy), { texto: 'Explicação pronta.' })
    assert.equal(pedidos.length, 1, 'com cache não pede de novo')
    assert.ok(explicar({ pergunta: 'só' }, agy).erro)
    assert.ok(explicar(undefined, agy).erro)
    assert.equal(pedidos.length, 1)
  })
  /* CC-911 (D3a): baralhos por projeto, tudo em pasta temporária */
  const C = await import('./src/cartas.mjs')
  const { execFileSync, spawnSync } = await import('node:child_process')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cartas-proj-'))
  fs.mkdirSync(path.join(raiz, 'docs', 'cartas', 'img'), { recursive: true })
  const bom = { titulo: 'Telas', criado: '2026-10-04T10:00:00Z', cartas: [
    { id: 'a', titulo: 'Home', pergunta: 'Está bonita?', img: 'docs/cartas/img/a.jpg', link: 'https://x.com/a', passos: ['abra'], opcoes: ['Aprovo', 'Não aprovo'] },
    { id: 'b', titulo: 'Menu', opcoes: ['X', 'Y', 'Z'], multipla: true },
  ] }
  const deckPath = (n) => path.join(raiz, 'docs', 'cartas', n + '.json')
  fs.writeFileSync(deckPath('telas'), JSON.stringify(bom))
  const clone = (f) => { const o = structuredClone(bom); f(o); return C.validarDeck(o) }

  t('validarDeck: deck bom passa, ruins são recusados com a lista de erros', () => {
    assert.deepEqual(C.validarDeck(bom), [])
    assert.ok(clone((o) => { o.cartas[0].img = '../../.ssh/id_rsa' }).some((x) => x.includes('img')))
    assert.ok(clone((o) => { o.cartas[0].img = 'docs/cartas/../../x.png' }).some((x) => x.includes('img')))
    assert.ok(clone((o) => { o.cartas[0].img = 'docs/cartas/a.svg' }).some((x) => x.includes('img')))
    assert.ok(clone((o) => { o.cartas[0].link = 'javascript:alert(1)' }).some((x) => x.includes('link')))
    assert.ok(clone((o) => { o.cartas[1].id = 'a' }).some((x) => x.includes('repetido')))
    assert.ok(clone((o) => { o.cartas[0].opcoes = ['1', '2', '3', '4', '5'] }).some((x) => x.includes('opcoes')))
    assert.ok(clone((o) => { o.cartas[0].titulo = 'a ' + String.fromCharCode(0x2014) + ' b' }).some((x) => x.includes('travessão')))
    assert.ok(clone((o) => { o.cartas[0].extra = 1 }).some((x) => x.includes('campo a mais')))
    assert.ok(clone((o) => { o.cartas = Array.from({ length: 201 }, (_, i) => ({ id: 'c' + i, titulo: 't' })) }).some((x) => x.includes('200')))
  })

  t('nome de deck: só [a-z0-9-], sem barra', () => {
    for (const n of ['../x', 'a/b', 'A', '', 'a'.repeat(41)]) assert.ok(C.lerDeck(raiz, n).erros, n)
    assert.equal(C.votar(raiz, '../telas', 'a', { escolhas: ['Aprovo'] }).erro, 'deck inválido')
  })

  t('pendentes, votar só acrescenta e recusa repetição, carta e opção inexistentes', () => {
    assert.deepEqual(C.listarDecks(raiz), ['telas'])
    assert.deepEqual(C.pendentes(raiz)[0].pendentes.map((c) => c.id), ['a', 'b'])
    assert.ok(C.votar(raiz, 'telas', 'zz', { escolhas: ['Aprovo'] }).erro)
    assert.ok(C.votar(raiz, 'telas', 'a', { escolhas: ['Talvez'] }).erro)
    assert.ok(C.votar(raiz, 'telas', 'a', { escolhas: ['Aprovo', 'Não aprovo'] }).erro, 'carta simples aceita uma só')
    assert.ok(C.votar(raiz, 'telas', 'a', { escolhas: ['Aprovo'], nota: 'ótima' }).ok)
    const arq = path.join(raiz, 'docs', 'cartas', 'telas.votos.jsonl')
    const antes = fs.readFileSync(arq, 'utf8')
    assert.ok(C.votar(raiz, 'telas', 'a', { escolhas: ['Aprovo'] }).erro, 'repetido')
    assert.equal(fs.readFileSync(arq, 'utf8'), antes)
    assert.ok(C.votar(raiz, 'telas', 'b', { escolhas: ['X', 'Z'] }).ok, 'múltipla')
    assert.ok(fs.readFileSync(arq, 'utf8').startsWith(antes), 'só acrescentou')
    const v = C.votos(raiz, 'telas')
    assert.deepEqual(v.map((x) => x.carta), ['a', 'b'])
    assert.equal(v[0].de, 'felipe'); assert.equal(v[0].nota, 'ótima')
    assert.deepEqual(C.pendentes(raiz)[0].pendentes, [])
    assert.equal(C.pendentes(raiz)[0].total, 2)
  })

  t('deck inválido some de pendentes', () => {
    fs.writeFileSync(deckPath('ruim'), JSON.stringify({ titulo: 't', cartas: [{ id: 'a', titulo: 't', img: '../../x.png' }] }))
    assert.deepEqual(C.pendentes(raiz).map((d) => d.deck), ['telas'])
    assert.ok(C.lerDeck(raiz, 'ruim').erros.length)
  })

  t('caminhoDaImagem: serve a imagem, recusa .., absoluto e atalho para fora (CC-722)', () => {
    fs.writeFileSync(path.join(raiz, 'docs', 'cartas', 'img', 'a.jpg'), 'x')
    assert.ok(C.caminhoDaImagem(raiz, 'docs/cartas/img/a.jpg'))
    assert.equal(C.caminhoDaImagem(raiz, 'docs/cartas/../../etc/passwd.png'), null)
    assert.equal(C.caminhoDaImagem(raiz, path.join(raiz, 'docs/cartas/img/a.jpg')), null)
    assert.equal(C.caminhoDaImagem(raiz, 'docs/cartas/img/nao-existe.jpg'), null)
    const fora = fs.mkdtempSync(path.join(os.tmpdir(), 'cartas-fora-'))
    fs.writeFileSync(path.join(fora, 'segredo.png'), 'segredo')
    fs.symlinkSync(path.join(fora, 'segredo.png'), path.join(raiz, 'docs', 'cartas', 'img', 'atalho.png'))
    fs.symlinkSync(fora, path.join(raiz, 'docs', 'cartas', 'pasta-fora'))
    assert.equal(C.caminhoDaImagem(raiz, 'docs/cartas/img/atalho.png'), null, 'arquivo atalho')
    assert.equal(C.caminhoDaImagem(raiz, 'docs/cartas/pasta-fora/segredo.png'), null, 'pasta atalho')
    fs.rmSync(fora, { recursive: true, force: true })
  })

  t('cc.mjs cartas validar: deck bom, deck ruim e votos', () => {
    const cc = path.join(process.cwd(), 'cc.mjs')
    const env = { ...process.env, CC_HOME: casa, CC_SEM_NAVEGADOR: '1' }
    const ok = execFileSync('node', [cc, 'cartas', 'validar', deckPath('telas')], { env, encoding: 'utf8' })
    assert.ok(ok.includes('deck válido: 2 cartas'))
    const r = spawnSync('node', [cc, 'cartas', 'validar', deckPath('ruim')], { env, encoding: 'utf8' })
    assert.notEqual(r.status, 0)
    assert.ok(r.stdout.includes('img'))
    const vt = execFileSync('node', [cc, 'cartas', 'votos', 'telas'], { env, encoding: 'utf8', cwd: raiz })
    assert.ok(vt.includes('ótima') && vt.includes('X + Z'))
  })
  fs.rmSync(raiz, { recursive: true, force: true })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log('test-cartas ok')
