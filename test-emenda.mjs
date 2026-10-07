// CC-916: ideia nova no meio do projeto entra como emenda no trecho onde o projeto está, e o Caminho mostra
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import * as B from './src/backlog.mjs'
import { caminhoDe } from './src/caminho.mjs'
import { emendar, frenteAtual, crescimento, sugerirLugar, opcoesDaPergunta } from './src/emenda.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'emenda-'))
const raiz = path.join(base, 'VPS_demo'); fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
const arq = path.join(raiz, 'docs', 'backlog.jsonl')
const it = (id, estado, frente, criado, extra = {}) => ({ id, titulo: `item ${id}`, intencao: `item ${id}`, estado, frente, criado, mexido: criado, depende: [], origem: 'agente', ...extra })
B.gravar([it('DM-001', 'OK', 'site', '2026-09-01'), it('DM-002', 'OK', 'site', '2026-09-02'), it('DM-003', 'EM', 'loja', '2026-09-10'), it('DM-004', 'B1', 'pagamento', '2026-09-20')], arq)
const campos = (extra = {}) => ({ intencao: 'aceitar pix', natureza: 'PED', area: 'dado', tamanho: 'M', pronto: 'pix aparece no pagamento', conferir: 'dele: pagar com pix', citacao: 'e se aceitasse pix', ...extra })

t('sem frente dada, a emenda cai no trecho onde o projeto está (o que anda agora)', () => {
  assert.equal(frenteAtual(raiz), 'loja')
  const i = emendar(raiz, campos())
  assert.equal(i.frente, 'loja'); assert.equal(i.origem, 'emenda'); assert.equal(i.estado, 'B0'); assert.equal(i.citacao, 'e se aceitasse pix'); assert.match(i.id, /^DM-\d+$/)
})
t('com --frente, a emenda vai para a frente dada', () => {
  assert.equal(emendar(raiz, campos({ intencao: 'cupom de desconto', frente: 'pagamento' })).frente, 'pagamento')
})
t('o Caminho conta as emendas por trecho e no total, e marca o item', () => {
  const c = caminhoDe(raiz); const loja = c.trechos.find((x) => x.chave === 'loja')
  assert.equal(loja.emendas, 1); assert.equal(c.emendas, 2); assert.ok(loja.itens.some((x) => x.emenda === true))
  assert.equal(c.crescimento, 50, '2 emendas contra 4 itens que já existiam')
})
t('emenda cancelada não conta no crescimento', () => {
  const itens = B.ler(arq).itens; itens.find((x) => x.origem === 'emenda').estado = 'KO'; itens.find((x) => x.estado === 'KO').porque = 'não vale'
  assert.equal(crescimento(itens).emendas, 1)
})
t('o comando backlog emenda grava na pasta do projeto, e recusa sem pronto', () => {
  const cc = (...a) => execFileSync('node', [path.resolve('cc.mjs'), 'backlog', 'emenda', ...a], { cwd: raiz, encoding: 'utf8', env: { ...process.env, CC_HOME: base } })
  const ok = cc('mapa do site', '--citacao', 'quero um mapa', '--area', 'tela', '--pronto', 'mapa abre', '--conferir', 'dele: abrir o mapa')
  assert.match(ok, /emenda no trecho "loja"/)
  assert.match(cc('sem pronto', '--area', 'tela', '--conferir', 'dele: x'), /recusado: .*pronto/)
})
t('CC-958: sem lugar a emenda fica fora da fila; com lugar dia nasce definida, com a data, e entra na fila', () => {
  const fila = () => B.filaDoAgente(B.ler(arq).itens)
  const ids = (f) => [...f.sozinho, ...f.semEspec, ...f.dele].map((x) => x.id)
  const sem = emendar(raiz, campos({ intencao: 'boleto' }))
  assert.equal(sem.estado, 'B0'); assert.equal(sem.lugar, undefined); assert.ok(!ids(fila()).includes(sem.id))
  const dia = emendar(raiz, campos({ intencao: 'boleto parcelado', lugar: 'dia' }))
  assert.equal(dia.estado, 'B1'); assert.equal(dia.lugar.onde, 'dia'); assert.ok(!Number.isNaN(Date.parse(dia.lugar.em)))
  assert.ok(fila().dele.some((x) => x.id === dia.id), 'conferir dele: cai em dele')
  assert.equal(emendar(raiz, campos({ intencao: 'boleto depois', lugar: 'fora' })).estado, 'B0')
  assert.throws(() => emendar(raiz, campos({ intencao: 'boleto x', lugar: 'amanha' })), /lugar desconhecido/)
})
t('CC-958: --melhora põe a ideia na frente da função que ela melhora', () => {
  assert.equal(emendar(raiz, campos({ intencao: 'pix com qr', melhora: 'DM-004' })).frente, 'pagamento')
  assert.throws(() => emendar(raiz, campos({ intencao: 'pix com qr 2', melhora: 'DM-999' })), /não achei DM-999/)
})
t('CC-958: a sugestão segue regras fixas e a pergunta tem quatro opções com a sugestão primeiro', () => {
  const ctx = { itens: B.ler(arq).itens, sprint: new Set(['DM-004']) }
  const s = (c) => sugerirLugar(c, ctx).onde
  assert.equal(s({ natureza: 'DEF', frente: 'site' }), 'dia')
  assert.equal(s({ natureza: 'DEF', risco: 'cliente', frente: 'site' }), 'agora')
  assert.equal(s({ natureza: 'PED', tamanho: 'G', frente: 'pagamento' }), 'backlog')
  assert.equal(s({ natureza: 'PED', tamanho: 'M', frente: 'pagamento' }), 'sprint')
  assert.equal(s({ natureza: 'PED', tamanho: 'M', frente: 'site' }), 'backlog')
  assert.equal(s({ intencao: 'integrar com Garmin depois do MVP', frente: 'pagamento' }), 'fora')
  assert.deepEqual(opcoesDaPergunta('sprint'), { opcoes: ['sprint', 'agora', 'dia', 'backlog'], noTexto: 'fora' })
  assert.deepEqual(opcoesDaPergunta('fora'), { opcoes: ['fora', 'dia', 'sprint', 'backlog'], noTexto: 'agora' })
})
t('CC-958: os comandos emenda, lugar e fila falam do lugar', () => {
  const run = (...a) => execFileSync('node', [path.resolve('cc.mjs'), 'backlog', ...a], { cwd: raiz, encoding: 'utf8', env: { ...process.env, CC_HOME: base } })
  const cmd = run
  const falha = (...a) => { try { run(...a) } catch (e) { return String(e.stdout) } throw new Error('devia ter falhado') }
  const out = cmd('emenda', 'exportar csv', '--citacao', 'quero csv', '--area', 'dado', '--pronto', 'csv baixa', '--conferir', 'dele: abrir o csv')
  const id = out.match(/([A-Z]+-\d+)\s+emenda/)[1]
  assert.match(out, /sugestão: /); assert.match(out, /\(Recomendado\)/); assert.match(out, new RegExp(`backlog lugar ${id}`))
  assert.match(cmd('lugar', id), /sem lugar[\s\S]*sugestão/)
  assert.match(cmd('lugar', id, 'agora'), /agora/)
  assert.equal(B.ler(arq).itens.find((x) => x.id === id).estado, 'B1')
  assert.match(cmd('fila'), new RegExp(`${id}.*\\[agora\\]`))
  assert.match(falha('lugar', id, 'amanha'), /recusado: lugar desconhecido/)
})
fs.rmSync(base, { recursive: true, force: true })
