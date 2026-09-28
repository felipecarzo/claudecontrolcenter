// CC-651: o gancho de permissão do cockpit e a resposta dada pelo painel.
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { principal } from './hooks/permissao-painel.mjs'
import { lerPedidosDoGancho, responderGancho, permitir } from './src/decisao.mjs'

let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok  ${nome}`) }
const pedido = { hook_event_name: 'PermissionRequest', session_id: 'c1', cwd: '/p/VPS_x', agent_id: 'a9', tool_name: 'Bash', tool_input: { command: 'bash aud/run.sh a', description: 'Roda a auditoria' } }
const casa = () => mkdtempSync(join(tmpdir(), 'perm-'))
const rapido = () => new Promise((r) => setTimeout(r, 5))

await t('sem painel aberto, o gancho sai na hora e o pedido vai ao terminal', async () => {
  const dir = casa()
  assert.equal(await principal({ entrada: pedido, dir, esperar: rapido, espera: 600 }), null)
  assert.equal(readdirSync(dir).length, 0)
})

await t('com o painel aberto, o pedido aparece e o "sim" do painel vira allow', async () => {
  const dir = casa(); writeFileSync(join(dir, '.painel-aberto'), '')
  const hook = principal({ entrada: pedido, dir, esperar: rapido, espera: 5000 })
  await new Promise((r) => setTimeout(r, 30))
  const [p] = lerPedidosDoGancho(dir)
  assert.equal(p.sessao, 'c1'); assert.equal(p.ajudante, 'a9'); assert.equal(p.descricao, 'Roda a auditoria')
  const r = await permitir({ conversa: 'c1', id: 'gancho:' + p.id, decisao: 'sim' }, { gancho: { dir, esperar: rapido } })
  const saida = await hook
  assert.equal(r.ok, true)
  assert.deepEqual(saida.hookSpecificOutput.decision, { behavior: 'allow' })
  assert.deepEqual(readdirSync(dir).filter((n) => !n.startsWith('.')), [], 'o gancho limpa o que gravou')
})

await t('o "não" do painel vira deny', async () => {
  const dir = casa(); writeFileSync(join(dir, '.painel-aberto'), '')
  const hook = principal({ entrada: pedido, dir, esperar: rapido, espera: 5000 })
  await new Promise((r) => setTimeout(r, 30))
  const [p] = lerPedidosDoGancho(dir)
  await responderGancho(p.id, 'nao', { dir, esperar: rapido })
  assert.equal((await hook).hookSpecificOutput.decision.behavior, 'deny')
})

await t('sem resposta no prazo, o gancho sai calado e o painel avisa que passou', async () => {
  const dir = casa(); writeFileSync(join(dir, '.painel-aberto'), '')
  const hook = principal({ entrada: pedido, dir, esperar: () => new Promise((r) => setTimeout(r, 40)), espera: 1000 })
  await new Promise((r) => setTimeout(r, 15))
  const [p] = lerPedidosDoGancho(dir)
  assert.equal(await hook, null)
  const r = await responderGancho(p.id, 'sim', { dir, esperar: rapido })
  assert.equal(r.ok, false)
  assert.match(r.erro, /terminal/)
})

console.log(`\n${ok} verificações do gancho de permissão, todas passaram`)
