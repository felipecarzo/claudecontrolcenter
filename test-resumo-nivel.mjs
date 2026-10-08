// CC-983: resumo da sessão por nível; mensagens dele seguidas e próximas contam como um pedido só
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contextoDaConversa, pedirNivel, arquivoDaConversa, JUNTAR_MS } from './src/resumoAgy.mjs'

let n = 0
const t = (nome, fn) => { fn(); n++; console.log('  ok   ' + nome) }
const L = (o) => JSON.stringify(o)
const h = (min) => new Date(Date.parse('2026-10-07T10:00:00Z') + min * 60000).toISOString()
const eu = (txt, min) => L({ type: 'user', timestamp: h(min), message: { content: txt } })
const ag = (txt, min) => L({ type: 'assistant', timestamp: h(min), message: { content: [{ type: 'text', text: txt }] } })

const conversa = [
  eu('primeiro pedido', 0), ag('fiz o primeiro', 5),
  eu('segundo pedido', 30), ag('fiz o segundo', 35),
  // três correções seguidas, em 4 minutos: contam como um pedido só
  eu('terceiro: arruma a cor', 60), eu('não, a cor do botão', 62), eu('a do botão de baixo', 64), ag('arrumei o botão de baixo', 70),
].join('\n')

t('nível 1 vai até o último pedido, e as correções seguidas entram juntas', () => {
  const c = contextoDaConversa(conversa, { nivel: 1 })
  assert.ok(c.startsWith('PEDIDO DO DONO: terceiro: arruma a cor'), c.slice(0, 80))
  assert.ok(c.includes('a do botão de baixo') && c.includes('AGENTE: arrumei'))
  assert.ok(!c.includes('segundo'))
})
t('nível 2 sobe um pedido, pulando o grupo de correções como um só', () => {
  const c = contextoDaConversa(conversa, { nivel: 2 })
  assert.ok(c.startsWith('PEDIDO DO DONO: segundo pedido') && !c.includes('primeiro'))
})
t('nível 3 chega ao primeiro; nível acima do que existe devolve a conversa toda', () => {
  assert.ok(contextoDaConversa(conversa, { nivel: 3 }).startsWith('PEDIDO DO DONO: primeiro pedido'))
  assert.ok(contextoDaConversa(conversa, { nivel: 5 }).startsWith('PEDIDO DO DONO: primeiro pedido'))
})
t('mensagens a mais de 5 minutos uma da outra são pedidos diferentes', () => {
  const longe = [eu('a', 0), eu('b', 0 + JUNTAR_MS / 60000 + 1), ag('ok', 20)].join('\n')
  assert.ok(contextoDaConversa(longe, { nivel: 1 }).startsWith('PEDIDO DO DONO: b'))
  assert.ok(contextoDaConversa(longe, { nivel: 2 }).startsWith('PEDIDO DO DONO: a'))
})
t('sem horário, nada junta (o formato antigo continua igual)', () => {
  const sem = [L({ type: 'user', message: { content: 'x' } }), L({ type: 'user', message: { content: 'y' } })].join('\n')
  assert.ok(contextoDaConversa(sem).startsWith('PEDIDO DO DONO: y'))
})
t('o teto de texto cresce com o nível', () => {
  const grande = [eu('p1', 0), ag('x'.repeat(30000), 1), eu('p2', 60), ag('y'.repeat(30000), 61)].join('\n')
  assert.ok(contextoDaConversa(grande, { nivel: 1 }).length <= 10000)
  assert.ok(contextoDaConversa(grande, { nivel: 3 }).length > 10000)
})
t('conversa inexistente ou id fora do formato: erro, sem chamar o agy', () => {
  assert.equal(arquivoDaConversa('../../etc/passwd'), null)
  assert.match(pedirNivel({ conversa: '00000000-0000-0000-0000-000000000000' }).erro, /não encontrada/)
})
// 07/10: a função nova do resumo nasceu com o nome de outra (c2Nivel, o cadeado) e apagou todos os avisos da tela
// Sessões, sem erro de sintaxe nenhum. Duas funções com o mesmo nome no arquivo da tela: a segunda vence calada.
t('o arquivo da tela não tem duas funções com o mesmo nome', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const nomes = [...ui.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map((m) => m[1])
  const rep = nomes.filter((x, i) => nomes.indexOf(x) !== i)
  assert.deepEqual([...new Set(rep)], [], 'repetidas: ' + rep.join(', '))
})
console.log(`test-resumo-nivel: ${n} verificações, 0 falhas`)
