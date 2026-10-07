// CC-917: ideia longa dele só no texto volta uma vez; registrada, curta ou sem marcador passa
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { decidir, decidirLugar } from './ideia-guard.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const H = path.join(AQUI, 'ideia-guard.mjs')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ideia-'))
const longa = (abre) => `${abre} a gente tivesse um jeito de juntar várias ideias soltas e transformar em itens do projeto, de modo que `
  + 'cada uma tivesse as palavras dele guardadas, entrasse no trecho onde o projeto está agora e o escopo crescesse de forma visível no Caminho. '.repeat(3)
let ok = 0
const t = (nome, fn) => { fn(); ok += 1; console.log('  ok   ' + nome) }

function roda(pedido, depois = [], extra = {}) {
  const f = path.join(tmp, `t${ok}.jsonl`)
  const linhas = [
    JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: pedido }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Entendi.' }, ...depois] } }),
  ]
  fs.writeFileSync(f, linhas.join('\n'))
  const r = spawnSync('node', [H], { input: JSON.stringify({ transcript_path: f, ...extra }), encoding: 'utf8', env: { ...process.env, CC_HOME: tmp } })
  return { codigo: r.status, erro: r.stderr }
}
const bash = (cmd) => ({ type: 'tool_use', name: 'Bash', input: { command: cmd } })
const ask = { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } }

t('ideia longa que abre com "e se" e não foi registrada volta uma vez', () => {
  const r = roda(longa('E se')); assert.equal(r.codigo, 2); assert.match(r.erro, /registre no backlog/)
})
t('os outros marcadores e o vocativo antes também contam', () => {
  for (const a of ['Tive uma ideia:', 'Camarada, me deu uma ideia,', 'Proponho que', 'Poderíamos fazer']) assert.equal(roda(longa(a)).codigo, 2, a)
})
t('com backlog emenda, backlog novo, meu add ou a skill ideias no turno, passa', () => {
  // CC-958: a emenda agora também precisa do lugar perguntado e gravado, senão a outra trava (decidirLugar) devolve
  for (const d of [[bash('node cc.mjs backlog emenda "x"'), ask, bash('node cc.mjs backlog lugar AC-12 dia')], [bash('cc backlog novo "y"')], [bash('cc meu add "z"')], [{ type: 'tool_use', name: 'Skill', input: { skill: 'ideias' } }]]) assert.equal(roda(longa('E se'), d).codigo, 0)
})
t('mensagem longa SEM marcador (conversa comum, pergunta, pedido) passa', () => {
  assert.equal(roda(longa('Ali seguir o backlog também, e')).codigo, 0)
})
t('"e se" curto passa: é pergunta, não visão', () => assert.equal(roda('E se fosse azul?').codigo, 0))
t('uma volta só: com stop_hook_active passa', () => assert.equal(roda(longa('E se'), [], { stop_hook_active: true }).codigo, 0))
t('a decisão pura devolve texto só quando deve', () => {
  assert.equal(decidir(longa('E se'), true), null); assert.equal(decidir('', false), null); assert.match(decidir(longa('E se'), false), /Esta é a única volta/)
})
const EMENDA = 'node cc.mjs backlog emenda "cupom"'
t('CC-958: emenda sem lugar volta uma vez pedindo a pergunta do lugar', () => {
  const r = roda('anota isso: cupom de desconto', [bash(EMENDA)]); assert.equal(r.codigo, 2); assert.match(r.erro, /AskUserQuestion/)
})
t('CC-958: emenda, pergunta e backlog lugar no turno passa', () => {
  assert.equal(roda('anota isso: cupom de desconto', [bash(EMENDA), ask, bash('node cc.mjs backlog lugar AC-12 dia')]).codigo, 0)
})
t('CC-958: --lugar sem perguntar volta, a não ser que ele tenha dito o lugar na fala', () => {
  const com = [bash(`${EMENDA} --lugar dia`)]
  assert.equal(roda('anota isso: cupom', com).codigo, 2)
  assert.equal(roda('anota pro fim do dia: cupom', com).codigo, 0)
})
t('CC-958: texto que só cita o comando não conta como lugar gravado', () => {
  assert.equal(roda('anota isso: cupom', [bash(EMENDA), { type: 'text', text: 'depois rode backlog lugar AC-12 dia' }]).codigo, 2)
})
t('CC-958: uma volta só e sem emenda no turno passa', () => {
  assert.equal(roda('anota isso: cupom', [bash(EMENDA)], { stop_hook_active: true }).codigo, 0)
  assert.equal(roda('anota isso: cupom', [bash('ls')]).codigo, 0)
})
t('CC-958: a decisão pura do lugar', () => {
  assert.equal(decidirLugar('x', []), null)
  assert.match(decidirLugar('x', [{ nome: 'Bash', cmd: 'cc backlog emenda "y"' }]), /única volta/)
})
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`${ok} verificações, todas passaram`)
