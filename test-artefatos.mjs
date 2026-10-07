// CC-927: o sprint lista os artefatos de engenharia (MER e afins) com a importância de cada um
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { artefatosDoSprint, CATALOGO } from './src/artefatos.mjs'

const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-artefatos-'))
const it = (id, extra) => ({ id, estado: 'B1', natureza: 'PED', area: 'agente', titulo: 'x', intencao: 'x', pronto: 'x', ...extra })
const banco = it('T-1', { intencao: 'guardar o cadastro de clientes no banco' })
const tela = it('T-2', { area: 'tela', intencao: 'tela de pedidos' })
const login = it('T-3', { intencao: 'login com senha para o painel' })
const nada = it('T-4', { intencao: 'ajustar a cor do botão' })
const por = (l) => Object.fromEntries(l.map((a) => [a.id, a]))

try {
  t('cada artefato do catálogo tem nome, importância e caminho em docs/engenharia', () => {
    assert.ok(CATALOGO.length >= 6)
    for (const a of CATALOGO) assert.ok(a.id && a.nome && a.porque && /^docs\/engenharia\/.+\.md$/.test(a.arquivo), a.id)
  })
  t('banco, tela e login pedem MER, mapa de telas e modelo de ameaças, com os ids de quem pediu', () => {
    const r = por(artefatosDoSprint([banco, tela, login, nada], casa))
    assert.deepEqual(r['mer'].itens, ['T-1'])
    assert.deepEqual(r['mapa-de-telas'].itens, ['T-2'])
    assert.deepEqual(r['modelo-de-ameacas'].itens, ['T-3'])
    assert.ok(r['mer'].porque.length > 20 && r['mer'].arquivo === 'docs/engenharia/MER.md')
    assert.equal(r['contrato-das-rotas'], undefined)
    assert.equal(r['casos-de-uso'], undefined)
  })
  t('item sem gatilho não pede nada, e item fechado ou cancelado também não', () => {
    assert.deepEqual(artefatosDoSprint([nada], casa), [])
    assert.deepEqual(artefatosDoSprint([{ ...banco, estado: 'OK' }, { ...login, estado: 'KO' }], casa), [])
    assert.deepEqual(artefatosDoSprint([], casa), [])
  })
  t('API pede contrato das rotas, integração pede diagrama de sequência', () => {
    const r = por(artefatosDoSprint([it('T-5', { intencao: 'criar a API de pedidos' }), it('T-6', { intencao: 'integração com o webhook do banco parceiro' })], casa))
    assert.deepEqual(r['contrato-das-rotas'].itens, ['T-5'])
    assert.deepEqual(r['diagrama-de-sequencia'].itens, ['T-6'])
  })
  t('sprint com muitos pedidos novos pede casos de uso', () => {
    const muitos = Array.from({ length: 5 }, (_, k) => it('N-' + k))
    assert.equal(por(artefatosDoSprint(muitos, casa))['casos-de-uso'].itens.length, 5)
    assert.equal(por(artefatosDoSprint(muitos.slice(0, 4), casa))['casos-de-uso'], undefined)
  })
  t('existe muda quando o arquivo é criado no projeto', () => {
    assert.equal(por(artefatosDoSprint([banco], casa))['mer'].existe, false)
    fs.mkdirSync(path.join(casa, 'docs', 'engenharia'), { recursive: true })
    fs.writeFileSync(path.join(casa, 'docs', 'engenharia', 'MER.md'), '# MER\n')
    assert.equal(por(artefatosDoSprint([banco], casa))['mer'].existe, true)
  })
} finally { fs.rmSync(casa, { recursive: true, force: true }) }
console.log('artefatos ok')
