// CC-1033: o gerador de baralho (endereço do app -> cartas de telas e de textos), com navegador de mentira.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { slugDe, rotasDosLinks, limparTexto, montarBaralhos, gerar, loginDe } from './src/baralho.mjs'
import { validarDeck, listarDecks, pendentes } from './src/cartas.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }

// CC-1039: o login vem do ambiente, nunca da linha de comando
const env = { SENHA_X: 'segredo123', COOKIE_X: 'sessao=abc123; tema=escuro', VAZIA: '' }
ok(loginDe({}) === null && loginDe({ entrar: null, cookieEnv: null }) === null, 'sem opção de login, nada de login')
const l1 = loginDe({ entrar: 'https://app.com/entrar', usuario: 'ana@x.com', senhaEnv: 'SENHA_X' }, env)
ok(l1.senha === 'segredo123' && l1.usuario === 'ana@x.com' && l1.cookies.length === 0, 'a senha vem da variável de ambiente que a linha nomeia')
const l2 = loginDe({ cookieEnv: 'COOKIE_X' }, env)
ok(l2.cookies.length === 2 && l2.cookies[0].name === 'sessao' && l2.cookies[0].value === 'abc123' && l2.cookies[1].name === 'tema', 'cookie nome=valor; nome2=valor2 vira lista')
const erro = (o) => { try { loginDe(o, env); return null } catch (e) { return e.message } }
ok(/precisa ser o endereço http/.test(erro({ entrar: 'ftp://x', usuario: 'a', senhaEnv: 'SENHA_X' })) && /diga o --usuario/.test(erro({ entrar: 'https://a.com/e', senhaEnv: 'SENHA_X' })), 'endereço ruim e usuário faltando dão erro claro')
ok(/nunca vai na linha/.test(erro({ entrar: 'https://a.com/e', usuario: 'a' })) && /VAZIA está vazia/.test(erro({ entrar: 'https://a.com/e', usuario: 'a', senhaEnv: 'VAZIA' })) && /NAO_EXISTE/.test(erro({ cookieEnv: 'NAO_EXISTE' })), 'sem nome de variável, variável vazia ou inexistente: erro claro, sem chutar')
ok(/formato nome=valor/.test(erro({ cookieEnv: 'SENHA_X' })), 'cookie fora do formato nome=valor é recusado')

// o nome da rota
ok(slugDe('/') === 'inicio' && slugDe('') === 'inicio', 'a raiz vira "inicio"')
ok(slugDe('/Planos/Mensal?x=1#topo') === 'planos-mensal', 'rota com maiúscula, consulta e âncora')
ok(slugDe('https://x.com/a/b/') === 'a-b' && slugDe('/Ação') === 'acao', 'barra no fim, endereço inteiro e acento')

// quais telas valem uma carta
const links = [
  { href: '/planos', texto: 'Planos' }, { href: '/contato#form', texto: 'Contato' }, { href: '/planos?x=2', texto: 'Planos de novo' },
  { href: 'https://outro.com/x', texto: 'Parceiro' }, { href: '/manual.pdf', texto: 'Manual' }, { href: '/sair', texto: 'Sair' },
  { href: '/conta', texto: 'Excluir minha conta' }, { href: '#', texto: 'topo' }, { href: '/', texto: 'Início' }, { href: '/sobre/', texto: 'Sobre' },
]
const r = rotasDosLinks('https://app.exemplo.com/', links)
ok(JSON.stringify(r) === JSON.stringify(['/planos', '/contato', '/sobre/']), 'só rotas do mesmo site, sem repetida, arquivo, saída nem exclusão: ' + r.join(' '))
ok(rotasDosLinks('https://a.com/', Array.from({ length: 80 }, (_, i) => ({ href: '/p' + i, texto: 'P' + i })), { max: 12 }).length === 11, 'o limite de telas conta a inicial junto')

// o texto: sem travessão (regra dele) e com aviso
const t = limparTexto('Aqui — o preço\n\n  vale   R$ 10 – por mês ')
ok(t.texto === 'Aqui - o preço\nvale R$ 10 - por mês' && t.travessao === true, 'travessão vira hífen, espaços e linhas vazias somem')
const longo = limparTexto('palavra '.repeat(400), 100)
ok(longo.cortou && longo.texto.length <= 103 && longo.texto.endsWith('...'), 'texto longo é cortado e avisa')

// um site falso de 3 telas: a segunda tem erro de console, a terceira não abre, a primeira tem travessão
const site = {
  'https://app.exemplo.com/': { titulo: 'Início', texto: 'Bem-vindo — o melhor app', links: [{ href: '/planos', texto: 'Planos' }, { href: '/quebrada', texto: 'Quebrada' }, { href: '/sair', texto: 'Sair' }], erros: [], jpeg: Buffer.from('foto1') },
  'https://app.exemplo.com/planos': { titulo: 'Planos', texto: 'R$ 10 por mês', links: [], erros: ['TypeError: x is not a function'], jpeg: Buffer.from('foto2') },
}
const navegador = { ler: async (url) => { if (!site[url]) throw new Error('timeout de 30 s'); return site[url] }, fechar: async () => {} }
const proj = mkdtempSync(join(tmpdir(), 'baralho-'))
try {
  mkdirSync(join(proj, 'docs'), { recursive: true })
  const res = await gerar({ url: 'https://app.exemplo.com/', projeto: proj, rotas: ['/planos', '/quebrada'], navegador, agora: new Date('2026-10-09T12:00:00Z') })
  ok(res.paginas === 3 && res.fotos === 2 && res.comErroDeConsole === 2, `três telas lidas, duas fotos, duas com erro (${JSON.stringify(res)})`)
  const telas = JSON.parse(readFileSync(join(proj, 'docs', 'cartas', 'telas.json'), 'utf8'))
  const textos = JSON.parse(readFileSync(join(proj, 'docs', 'cartas', 'textos.json'), 'utf8'))
  ok(validarDeck(telas).length === 0 && validarDeck(textos).length === 0, 'os dois baralhos passam na validação do painel')
  ok(telas.cartas.length === 3 && textos.cartas.length === 2, 'telas: 3 cartas; textos: só as telas que têm texto (2)')
  const cp = telas.cartas.find((c) => c.id === 'planos')
  ok(/TypeError: x is not a function/.test(cp.olhe) && cp.img === 'docs/cartas/img/baralho/planos.jpg' && cp.link === 'https://app.exemplo.com/planos', 'a carta mostra o erro de console, a foto e o link')
  ok(existsSync(join(proj, 'docs/cartas/img/baralho/planos.jpg')) && readFileSync(join(proj, 'docs/cartas/img/baralho/inicio.jpg'), 'utf8') === 'foto1', 'a foto de cada tela foi gravada')
  ok(!telas.cartas.find((c) => c.id === 'quebrada').img && /não abriu/.test(telas.cartas.find((c) => c.id === 'quebrada').olhe), 'tela que não abriu vira carta sem foto, dizendo por quê')
  ok(/hífen/.test(textos.cartas[0].olhe) && !/[—–]/.test(JSON.stringify(textos)), 'o travessão do site sai do texto e a carta avisa')
  // o painel enxerga: os decks da pasta e as cartas pendentes
  ok(listarDecks(proj).sort().join() === 'telas,textos', 'o painel lista os dois baralhos')
  const pend = pendentes(proj); ok(pend.length === 2 && pend.every((d) => d.pendentes.length > 0), 'e as cartas aparecem como pendentes de voto')
  // rodar de novo no mesmo projeto reescreve o mesmo baralho, sem duplicar
  await gerar({ url: 'https://app.exemplo.com/', projeto: proj, rotas: ['/planos', '/planos/', '/quebrada'], navegador })
  ok(JSON.parse(readFileSync(join(proj, 'docs', 'cartas', 'telas.json'), 'utf8')).cartas.length === 3, 'rota repetida não vira carta repetida')
  await assert.rejects(() => gerar({ url: 'ftp://x/', projeto: proj, navegador }), /http/); n++; console.log('  ok  endereço que não é http é recusado')
} finally { rmSync(proj, { recursive: true, force: true }) }
console.log(`test-baralho: ${n} verificações, 0 falhas`)
