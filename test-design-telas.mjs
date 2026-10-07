// CC-655 e CC-657 (S3): as telas desenhadas, o baralho "design" e o antes e depois. Casa e projeto em mkdtemp,
// foto e gate falsos injetados: nunca o Chrome real, nunca dado real.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'design-telas-'))
process.env.CC_HOME = path.join(casa, '.claude')
const T = await import('./src/designTelas.mjs')
const C = await import('./src/cartas.mjs')
const { DIR_COPIAS } = await import('./src/design.mjs')
const t = async (nome, fn) => { await fn(); console.log('  ok   ' + nome) }

const raiz = path.join(casa, 'projetos', 'VPS_t')
const poe = (rel, txt) => { const f = path.join(raiz, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt) }
const lerDeck = () => C.lerDeck(raiz, 'design')?.deck
const ids = () => (lerDeck()?.cartas || []).map((c) => c.id)

try {
  poe('CLAUDE.md', '# t\n')
  poe('docs/design/telas/login/v1.html', '<p>um</p>')
  poe('docs/design/telas/login/v2.html', '<p>dois</p>')
  poe('docs/design/telas/home/v1.png', 'bytes-quaisquer')
  poe('docs/design/telas/Login/v1.html', 'maiuscula nao vale')
  poe('docs/design/telas/x y/v1.html', 'espaco nao vale')

  await t('leitura: só as telas válidas, versões em ordem, fotos nulas no html', () => {
    const l = T.telas(raiz)
    assert.deepEqual(l.map((x) => x.tela), ['home', 'login'])
    const login = l.find((x) => x.tela === 'login')
    assert.deepEqual(login.versoes.map((v) => v.n), [1, 2])
    assert.ok(login.versoes.every((v) => v.tipo === 'html' && v.fotos.celular === null && v.fotos.computador === null))
    assert.equal(login.aprovada, null)
  })

  await t('baralho: copia a imagem e grava só a carta que já tem foto, sem regravar à toa', () => {
    const r = T.sincronizar(raiz)
    assert.equal(r.gravou, true)
    assert.ok(fs.existsSync(path.join(raiz, 'docs/cartas/img/design/home-v1.png')))
    assert.deepEqual(ids(), ['tela-home-v1'])
    assert.equal(T.sincronizar(raiz).gravou, false)
  })

  const foto = async ({ saida }) => {
    const a = path.join(saida, '01-tela-celular.jpg'); const b = path.join(saida, '01-tela-computador.jpg')
    fs.writeFileSync(a, 'c'); fs.writeFileSync(b, 'k')
    return { ok: true, fotos: [a, b] }
  }

  await t('foto: grava as duas, e o baralho passa a ter a v2 e não a v1', async () => {
    const r = await T.fotografarVersao(raiz, 'login', 2, { foto })
    assert.equal(r.ok, true)
    assert.ok(fs.existsSync(path.join(raiz, 'docs/cartas/img/design/login-v2-celular.jpg')))
    assert.ok(fs.existsSync(path.join(raiz, 'docs/cartas/img/design/login-v2-computador.jpg')))
    assert.ok(ids().includes('tela-login-v2') && !ids().includes('tela-login-v1'))
    assert.ok(T.telas(raiz).find((x) => x.tela === 'login').versoes[1].fotos.celular)
  })

  await t('cópia: refotografar deixa a foto velha no abrigo, dentro da casa', async () => {
    await T.fotografarVersao(raiz, 'login', 2, { foto })
    const dir = DIR_COPIAS()
    assert.ok(dir.startsWith(casa))
    const achados = fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).includes('login-v2-celular'))
    assert.ok(achados.length >= 1, 'sem cópia da foto velha')
  })

  await t('recusas: versão que não existe e nome de tela fora do padrão', async () => {
    assert.equal((await T.fotografarVersao(raiz, 'login', 9, { foto })).ok, false)
    assert.equal((await T.fotografarVersao(raiz, '../x', 1, { foto })).ok, false)
    assert.equal((await T.fotografarVersao(raiz, 'home', 1, { foto })).ok, false, 'png não é página')
  })

  await t('voto: aprovar e pedir ajuste chegam ao agente', () => {
    assert.ok(C.votar(raiz, 'design', 'tela-login-v2', { escolhas: ['Aprovo'] }).ok)
    assert.equal(T.telas(raiz).find((x) => x.tela === 'login').aprovada, 2)
    assert.ok(T.paraOAgente(raiz).some((l) => l.includes('versão aprovada é a 2')))
    assert.ok(C.votar(raiz, 'design', 'tela-home-v1', { escolhas: ['Pedir ajuste'], nota: 'mais contraste' }).ok)
    assert.ok(T.paraOAgente(raiz).some((l) => l.includes('pediu ajuste: mais contraste')))
  })

  await t('antes e depois: três pares, o que só existe depois fica com antes nulo', async () => {
    const dir = path.join(casa, 'fotos'); fs.mkdirSync(dir, { recursive: true })
    const f = (n) => { const p = path.join(dir, n); fs.writeFileSync(p, 'j'); return p }
    const a = [f('01-inicio-celular.jpg'), f('01-inicio-computador.jpg')]
    const d = [f('01-inicio-celular.jpg'), f('02-menu-celular.jpg')]
    const gate = {
      listar: () => [{ id: 'abc12345-x', cwd: raiz, agentePadrao: 'claude' }],
      lerConversa: () => ({ mensagens: [{ seq: 4, fotos: a }, { seq: 9, fotos: d }, { seq: 10 }] }),
    }
    const c = await T.comparacao(raiz, { gate })
    assert.equal(c.pares.length, 3)
    assert.equal(c.pares.find((p) => p.tela === 'menu').antes, null)
    assert.equal(c.carta, 'antes-depois-abc12345-9')
    assert.equal(c.conversa, 'abc12345-x')
    assert.equal(await T.comparacao(raiz, { gate: { listar: () => [], lerConversa: () => null } }), null)

    T.comparacaoNoDeck(raiz, c)
    assert.ok(ids().includes('antes-depois-abc12345-9'))
    assert.ok(ids().includes('tela-login-v2'))
    T.sincronizar(raiz)
    assert.ok(ids().includes('antes-depois-abc12345-9'), 'sincronizar sem argumento mantém a carta')
  })

  await t('guardas: nada por temporizador, e o filho de foto existe', async () => {
    assert.ok(!/setInterval|setTimeout/.test(fs.readFileSync('src/designTelas.mjs', 'utf8')))
    assert.equal(typeof T.fotografarArquivo, 'function')
  })
  // 07/10: o capturador abre a página inicial da pasta primeiro; sem index.html o servidor dele quebrava e nenhuma foto saía
  const fonte = fs.readFileSync(new URL('./src/designTelas.mjs', import.meta.url), 'utf8')
  assert.ok(fonte.includes("fs.copyFileSync(path.join(pasta, arquivo), path.join(palco, 'index.html'))"), 'a versão vira a página inicial de uma pasta temporária')
  console.log('design-telas ok')
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
