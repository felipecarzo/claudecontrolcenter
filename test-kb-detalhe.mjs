/**
 * CC-235: o detalhe do cartão do quadro tem profundidade por TIPO.
 *
 * O headless não sustenta o quadro (mesmo motivo da Central), então a prova
 * visual é do Felipe. Este teste extrai `kbDetalhe` do `ui_v2.html`, roda com
 * stubs, e confere que cada fonte (pendência dele, tarefa de agente, frente do
 * backlog) gera a moldura própria, e que bloco vazio diz por quê.
 */
import assert from 'node:assert'
import fs from 'node:fs'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

const html = fs.readFileSync(new URL('./src/ui_v2.html', import.meta.url), 'utf8')
// pega o corpo da função kbDetalhe
const ini = html.indexOf('function kbDetalhe(c) {')
assert.ok(ini > 0, 'kbDetalhe precisa existir')
// acha o fecho da função pelo balanço de chaves
let i = html.indexOf('{', ini), nivel = 0, fim = -1
for (; i < html.length; i++) {
  if (html[i] === '{') nivel++
  else if (html[i] === '}') { nivel--; if (nivel === 0) { fim = i + 1; break } }
}
const fonte = html.slice(ini, fim)
// stubs das dependências
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const seloDoProjeto = () => ''
const kbIdade = () => 'há 1d'
// eslint-disable-next-line no-new-func
const kbDetalhe = new Function('esc', 'seloDoProjeto', 'kbIdade', fonte + '; return kbDetalhe;')(esc, seloDoProjeto, kbIdade)

// 1. pendência dele: mostra "Por que depende de você"
try {
  const h = kbDetalhe({ fonte: 'meu', projeto: 'X', nome: 'testar login', descricao: 'só você tem a senha', estado: { palavra: 'VOCÊ DECIDE', porque: 'entrega' } })
  assert.match(h, /Por que depende de você/)
  assert.match(h, /só você tem a senha/)
  assert.match(h, /Frente:/)
  ok('pendência dele mostra por que depende de você e a frente')
} catch (e) { erro('detalhe da pendência', e) }

// 2. pendência SEM porque: diz que ninguém escreveu
try {
  const h = kbDetalhe({ fonte: 'meu', projeto: 'X', nome: 'algo', descricao: '', estado: {} })
  assert.match(h, /não escreveu por que/)
  ok('pendência sem motivo diz que ninguém escreveu (bloco vazio explica)')
} catch (e) { erro('pendência vazia', e) }

// 3. tarefa de agente: diz quem está nisto
try {
  const h = kbDetalhe({ fonte: 'todo', projeto: 'X', nome: 'mexer no parser', descricao: 'redesenho da tela', estado: { palavra: 'ANDANDO' } })
  assert.match(h, /Quem está nisto/)
  assert.match(h, /um agente/)
  assert.match(h, /redesenho da tela/)
  ok('tarefa de agente mostra que um agente está nela, com o assunto')
} catch (e) { erro('detalhe da tarefa de agente', e) }

// 4. frente do backlog: descrição, o que destrava e por que parou
try {
  const h = kbDetalhe({ fonte: 'frente', projeto: 'X', nome: 'a caixa de ponto', descricao: 'salvar ao sair', desbloqueia: [1, 2, 3], estado: { palavra: 'TRAVADA', cor: 'failed', porque: 'falta o dono da pasta' } })
  assert.match(h, /salvar ao sair/)
  assert.match(h, /Destrava:.*3 outra/)
  assert.match(h, /Parou porque:.*falta o dono/)
  ok('frente do backlog mostra descrição, o que destrava e por que parou')
} catch (e) { erro('detalhe da frente', e) }

if (falhou) process.exit(1)
console.log('test-kb-detalhe: ok')
