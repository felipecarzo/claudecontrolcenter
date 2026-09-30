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

/* CC-699: o modo "pergunte antes" do Coderoom, que roda no PreToolUse. */
const antes = { ...pedido, hook_event_name: 'PreToolUse' }

await t('Coderoom: pede mesmo sem painel aberto, e o "sim" vira allow do PreToolUse', async () => {
  const dir = casa()
  const hook = principal({ entrada: antes, dir, esperar: rapido, espera: 5000, coderoom: 'conv1' })
  await new Promise((r) => setTimeout(r, 30))
  const [p] = lerPedidosDoGancho(dir)
  assert.equal(p.coderoom, 'conv1')
  await responderGancho(p.id, 'sim', { dir, esperar: rapido })
  const s = (await hook).hookSpecificOutput
  assert.equal(s.hookEventName, 'PreToolUse'); assert.equal(s.permissionDecision, 'allow')
})

await t('Coderoom: sem resposta no prazo, BARRA dizendo por quê (sair calado liberaria)', async () => {
  const dir = casa()
  const s = (await principal({ entrada: antes, dir, esperar: rapido, espera: 60, coderoom: 'conv1' })).hookSpecificOutput
  assert.equal(s.permissionDecision, 'deny'); assert.match(s.permissionDecisionReason, /ninguém respondeu/)
})

await t('fora do Coderoom, o PreToolUse é ignorado (o gancho normal só atende PermissionRequest)', async () => {
  const dir = casa(); writeFileSync(join(dir, '.painel-aberto'), '')
  assert.equal(await principal({ entrada: antes, dir, esperar: rapido, espera: 60 }), null)
})

/* CC-723: a ferramenta "perguntar" do Coderoom. */
const M = await import('./src/mcpPainel.mjs')

await t('perguntar: grava a pergunta com as opcoes e devolve a escolha feita no painel', async () => {
  const dir = casa()
  const r = M.perguntar({ pergunta: 'azul ou verde?', opcoes: ['azul', 'verde'] }, { dir, esperar: rapido, espera: 5000, coderoom: 'c9' })
  await new Promise((x) => setTimeout(x, 30))
  const [p] = lerPedidosDoGancho(dir)
  assert.equal(p.tipo, 'pergunta'); assert.deepEqual(p.opcoes, ['azul', 'verde']); assert.equal(p.coderoom, 'c9')
  const rp = await permitir({ conversa: 'gate:c9', id: 'gancho:' + p.id, decisao: 'escolha:verde' }, { gancho: { dir, esperar: rapido } })
  assert.equal(rp.ok, true)
  assert.equal(await r, 'O Felipe respondeu: verde')
})

await t('perguntar: sem resposta no prazo, manda o agente parar sem decidir', async () => {
  const s = await M.perguntar({ pergunta: 'x?', opcoes: ['a', 'b'] }, { dir: casa(), esperar: rapido, espera: 60 })
  assert.match(s, /Não decida por ele/)
})

await t('perguntar: agente encerrado tira a pergunta da tela na hora', async () => {
  const dir = casa(); let morto = false
  const r = M.perguntar({ pergunta: 'x?', opcoes: ['a', 'b'] }, { dir, esperar: rapido, espera: 5000, cancelado: () => morto })
  await new Promise((x) => setTimeout(x, 30))
  assert.equal(lerPedidosDoGancho(dir).length, 1)
  morto = true
  assert.match(await r, /Cancelado/)
  assert.equal(lerPedidosDoGancho(dir).length, 0)
})

await t('escolha so vale para pedido do gancho; pergunta de terminal continua sim/nao', async () => {
  const r = await permitir({ conversa: 'c1', id: 'tela:x', decisao: 'escolha:verde' }, { sessoes: async () => ({}) })
  assert.equal(r.ok, false)
})

await t('o servidor MCP lista a ferramenta e recusa nome desconhecido', async () => {
  const l = await M.atender({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  assert.equal(l.result.tools[0].name, 'perguntar')
  const e = await M.atender({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'outra' } })
  assert.ok(e.error)
  assert.equal(await M.atender({ jsonrpc: '2.0', method: 'notifications/initialized' }), null)
})

await t('CC-726: "sempre permitir" pelo painel devolve as regras que o Claude Code sugeriu', async () => {
  const dir = casa(); writeFileSync(join(dir, '.painel-aberto'), '')
  const sug = [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'bash aud/run.sh:*' }], behavior: 'allow', destination: 'localSettings' }]
  const hook = principal({ entrada: { ...pedido, permission_suggestions: sug }, dir, esperar: rapido, espera: 5000 })
  await new Promise((r) => setTimeout(r, 30))
  const [p] = lerPedidosDoGancho(dir)
  assert.deepEqual(p.sugestoes, sug, 'o pedido guarda as sugestões, e o cartão oferece o botão')
  const r = await permitir({ conversa: 'c1', id: 'gancho:' + p.id, decisao: 'sempre' }, { gancho: { dir, esperar: rapido } })
  assert.equal(r.ok, true)
  assert.deepEqual((await hook).hookSpecificOutput.decision, { behavior: 'allow', updatedPermissions: sug })
})

/* CC-735: ele olhando o painel da outra máquina, o gancho espera 75 s, não 30. */
await t('olhando de outra máquina, o gancho espera mais e a resposta de lá vira allow', async () => {
  const { ESPERA_REMOTO_MS } = await import('./hooks/permissao-painel.mjs')
  const { marcarPainelAberto, painelAbertoAgora } = await import('./src/decisao.mjs')
  const dir = casa(); marcarPainelAberto(dir, { remoto: true })
  assert.equal(painelAbertoAgora(dir), false, 'a marca remota não conta como alguém olhando ESTE painel')
  const hook = principal({ entrada: pedido, dir, esperar: rapido })
  await new Promise((r) => setTimeout(r, 30))
  const [p] = lerPedidosDoGancho(dir)
  assert.equal(p.ate - p.em, ESPERA_REMOTO_MS)
  await responderGancho(p.id, 'sim', { dir, esperar: rapido })
  assert.deepEqual((await hook).hookSpecificOutput.decision, { behavior: 'allow' })
  marcarPainelAberto(dir)
  await new Promise((r) => setTimeout(r, 600))
  marcarPainelAberto(dir)
  assert.equal(painelAbertoAgora(dir), true, 'leitura local depois da remota conta')
})

console.log(`\n${ok} verificações do gancho de permissão, todas passaram`)
