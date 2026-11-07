/* CC-1066: partes puras do print das cartas de texto. Não abre navegador (o gate roda no sandbox). */
import assert from 'node:assert/strict'
import { normalizar, nomeDoPrint, cartasParaPrint, textoDaCarta, relatorio, trocarBase } from './src/printTextos.mjs'
import { validarEstados } from './src/printTextos.mjs'
import { rotaDeArquivo, linkDaCarta, enderecoDeDevSh, montarBaralhos } from './src/textosApp.mjs'
import { semPrint, validarDeck } from './src/cartas.mjs'

assert.equal(normalizar('  FICHA   TÉCNICA \n'), 'ficha tecnica')
assert.equal(normalizar('Ação'), 'acao')

assert.equal(nomeDoPrint({ id: 'T-ficha_rotulo' }), 't-ficha-rotulo')
assert.equal(nomeDoPrint({ id: 'Ação/../x' }), 'acao-x')
assert.ok(nomeDoPrint({ id: 'a'.repeat(100) }).length <= 60)
assert.match(nomeDoPrint({ id: '!!!' }), /^[a-z0-9-]+$/)

const L = 'https://x.test/p/'
const d = { cartas: [
  { id: 'a', link: L, editar: 'Olá' },
  { id: 'b', link: L, editar: 'Já tem', img: 'docs/cartas/img/x/b.jpg' },
  { id: 'c', editar: 'Sem link' },
  { id: 'd', link: L, olhe: '"Entre aspas"\n\nOnde: aqui' },
  { id: 'e', link: L, olhe: 'Como aparece: Texto cru' },
] }
assert.deepEqual(cartasParaPrint(d).map((c) => c.id), ['a', 'd', 'e'])
assert.deepEqual(cartasParaPrint(d, { refazer: true }).map((c) => c.id), ['a', 'b', 'd', 'e'])
assert.equal(textoDaCarta(d.cartas[3]), 'Entre aspas')
assert.equal(textoDaCarta(d.cartas[4]), 'Texto cru')

assert.deepEqual(semPrint({ cartas: [...d.cartas, { id: 'f', link: L, editar: 'x', sem_print: 'texto não achado na página' }] }).map((c) => c.id), ['a'])

const r = relatorio([{ id: 'a', ok: true }, { id: 'b', ok: false, motivo: 'sem endereço' }, { id: 'c', ok: false, motivo: 'sem endereço' }])
assert.match(r, /3 cartas, 1 com print, 2 sem \(motivos: sem endereço: 2\)/)
assert.match(r, /\n  b: sem endereço/)
assert.equal(trocarBase('https://a.b/site/pt/#f', 'http://127.0.0.1:5175/site'), 'http://127.0.0.1:5175/site/pt/#f')
assert.equal(trocarBase('https://a.b/pt/', 'http://h:1/site'), 'http://h:1/site/pt/')

const base = { titulo: 't', cartas: [{ id: 'a', titulo: 'x', sem_print: 'texto não achado na página' }] }
assert.deepEqual(validarDeck(base), [])
base.cartas[0].sem_print = 'a'.repeat(121)
assert.ok(validarDeck(base).length)
base.cartas[0] = { id: 'a', titulo: 'x', img: 'fora/x.jpg' }
assert.ok(validarDeck(base).some((e) => /docs\/cartas/.test(e)))
base.cartas[0] = { id: 'a', titulo: 'x', img: 'docs/cartas/img/x/a.jpg' }
assert.deepEqual(validarDeck(base), [])

// CC-1067: estados.json
const passoOk = { passos: [{ preencher: { '#e': 'x' } }, { clicar: 'button' }, { esperar: 300 }, { offline: true }, { interceptar: { '**/api/*': { status: 500 } } }] }
assert.deepEqual(validarEstados({ a: passoOk }), [])
assert.deepEqual(validarEstados({}), [])
assert.ok(validarEstados([]).length && validarEstados(null).length)
assert.match(validarEstados({ a: { passos: [{ voar: 1 }] } })[0], /ação desconhecida "voar"/)
assert.match(validarEstados({ a: { passos: [{ clicar: ' ' }] } })[0], /seletor vazio/)
assert.match(validarEstados({ a: { passos: [{ preencher: { '': 'x' } }] } })[0], /seletor vazio/)
assert.ok(validarEstados({ a: { passos: [{ interceptar: { '**': { status: 99 } } }] } }).length)
assert.ok(validarEstados({ a: { passos: [{ esperar: -1 }] } }).length)
assert.deepEqual(validarEstados({ a: { passos: [{ interceptar: { '**': { status: 200, atraso: 500, corpo: 'x' } } }] } }), [])
assert.ok(validarEstados({ a: { passos: [{ interceptar: { '**': { status: 200, atraso: -5 } } }] } }).length)
assert.ok(validarEstados({ a: { passos: [{ clicar: 'a', offline: true }] } }).length)
assert.ok(validarEstados({ a: { passos: [] } }).length)

// CC-1067: link da carta
assert.equal(rotaDeArquivo('src/app/entrar.tsx'), '/entrar')
assert.equal(rotaDeArquivo('src/app/index.tsx'), '/')
assert.equal(rotaDeArquivo('src/app/(tabs)/perfil/index.tsx'), '/perfil')
assert.equal(rotaDeArquivo('app/ajuda/page.tsx'), '/ajuda')
assert.equal(rotaDeArquivo('src/app/_layout.tsx'), null)
assert.equal(rotaDeArquivo('src/app/corrida/[id].tsx'), null)
assert.equal(rotaDeArquivo('src/componentes/Botao.tsx'), null)
assert.equal(linkDaCarta('https://v.test/app/', 'src/app/entrar.tsx'), 'https://v.test/app/entrar')
assert.equal(linkDaCarta('https://v.test/app', 'src/app/index.tsx'), 'https://v.test/app/')
assert.equal(linkDaCarta('https://v.test/app', 'src/componentes/Botao.tsx'), 'https://v.test/app')
assert.equal(linkDaCarta(null, 'src/app/entrar.tsx'), null)
const dev = '    jogo)  echo "$HOME/projetos/VPS_x/apps/game:vite:5191" ;;\n    corrida) echo "$HOME/projetos/VPS_ahtleta-corrida:expo:5197" ;;'
assert.equal(enderecoDeDevSh('/h/projetos/VPS_ahtleta-corrida', '/h', [dev, '']), 'https://testedevoo.carzo.com.br/corrida')
assert.equal(enderecoDeDevSh('/h/projetos/VPS_x', '/h', [dev, '']), 'https://testedevoo.carzo.com.br/jogo')
assert.equal(enderecoDeDevSh('/h/projetos/VPS_y', '/h', [dev, 'novo:projetos/VPS_y:next:5260']), 'https://testedevoo.carzo.com.br/novo')
assert.equal(enderecoDeDevSh('/h/projetos/outro', '/h', [dev, '']), null)
const it = { id: 'T1', tipo: 'jsx', texto: 'Entrar', arquivo: 'src/app/entrar.tsx', linha: 3, ini: 1, fim: 2, quote: '', direto: false, original: 'Entrar' }
const com = montarBaralhos([it], { base: 'https://v.test/app' }).baralhos['textos-app'].cartas[0]
assert.equal(com.link, 'https://v.test/app/entrar'); assert.equal(com.editar, 'Entrar')
assert.equal(montarBaralhos([it]).baralhos['textos-app'].cartas[0].link, undefined)
assert.equal(semPrint({ cartas: [com] }).length, 1)
console.log('test-print-textos: ok')
