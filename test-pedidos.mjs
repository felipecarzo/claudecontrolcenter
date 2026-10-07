// CC-858: o pedido dele vira item do projeto certo, aparece na lista com o estado, e a limpeza só pega o que é dele e velho
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { adivinhar, criar, listar, ORIGEM } from './src/pedidos.mjs'
import * as B from './src/backlog.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pedidos-'))
const mk = (n) => { const r = path.join(base, n); fs.mkdirSync(r, { recursive: true }); return { raiz: r } }
const projetos = [mk('VPS_ahtleta'), mk('VPS_inovallbond'), mk('VPS_fibraessencia')]

t('o nome do projeto no texto decide o palpite; sem nome nenhum não se inventa', () => {
  assert.equal(adivinhar('arruma o botao do inovallbond no celular', projetos).palpite.nome, 'inovallbond')
  assert.equal(adivinhar('faz uma coisa qualquer', projetos).palpite, null)
  assert.equal(adivinhar('faz uma coisa qualquer', projetos).alternativas.length, 3)
})
t('o pedido vira item PED no backlog do projeto escolhido, com as palavras dele na citação', () => {
  const i = criar({ texto: 'quero um botao de sair no ahtleta', raiz: projetos[0].raiz }, projetos)
  const { itens } = B.ler(B.caminhoPadrao(projetos[0].raiz))
  assert.equal(itens.length, 1)
  assert.equal(itens[0].id, i.id)
  assert.equal(itens[0].natureza, 'PED')
  assert.equal(itens[0].origem, ORIGEM)
  assert.equal(itens[0].citacao, 'quero um botao de sair no ahtleta')
  assert.equal(B.ler(B.caminhoPadrao(projetos[1].raiz)).itens.length, 0)
})
t('texto curto demais e projeto desconhecido são recusados com o motivo', () => {
  assert.throws(() => criar({ texto: 'oi', raiz: projetos[0].raiz }, projetos), /pelo menos uma frase/)
  assert.throws(() => criar({ texto: 'um pedido de verdade', raiz: '/etc' }, projetos), /não é conhecido/)
})
t('texto com mais de 140 caracteres cabe: a intenção encurta e a citação guarda tudo', () => {
  const longo = 'quero ' + 'muita coisa '.repeat(30)
  const i = criar({ texto: longo, raiz: projetos[1].raiz }, projetos)
  assert.ok(i.intencao.length <= 140)
  assert.equal(i.citacao, longo.replace(/\s+/g, ' ').trim())
})
t('a lista mostra o estado do jeito dele e não lista item que ele não pediu', () => {
  const arq = B.caminhoPadrao(projetos[2].raiz); fs.mkdirSync(path.dirname(arq), { recursive: true })
  B.acrescentar({ intencao: 'coisa do agente', frente: 'x', estado: 'B1', origem: 'agente', natureza: 'DEF', area: 'tela', tamanho: 'P', pronto: 'p', conferir: 'olho:x' }, arq)
  const id = listar(projetos).find((p) => p.projeto === 'ahtleta').id
  const a0 = B.caminhoPadrao(projetos[0].raiz); const { itens } = B.ler(a0)
  itens.find((x) => x.id === id).estado = 'EM'; B.gravar(itens, a0)
  const l = listar(projetos)
  assert.equal(l.length, 2)
  assert.equal(l.find((p) => p.id === id).rotulo, 'em andamento')
})
fs.rmSync(base, { recursive: true, force: true })
