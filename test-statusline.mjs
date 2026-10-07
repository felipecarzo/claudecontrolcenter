// A barra de status leve (src/statusline.mjs): embrulha a original, cai na linha mínima, e é rápida
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sl-'))
const entrada = JSON.stringify({ model: { display_name: 'ModeloX' }, workspace: { current_dir: '/tmp/projetoY' } })
const rodar = (args) => spawnSync('node', ['src/statusline.mjs', ...args], { input: entrada, encoding: 'utf8', env: { ...process.env, CC_HOME: casa } })

t('statusline: repassa a saída da barra original embrulhada', () => {
  const r = rodar(['--wrap', 'echo barra-original'])
  assert.equal(r.status, 0); assert.match(r.stdout, /barra-original/)
})
t('statusline: se a original não imprime nada, sai a linha mínima (nunca barra vazia)', () => {
  const r = rodar(['--wrap', 'true'])
  assert.match(r.stdout, /projetoY/); assert.match(r.stdout, /ModeloX/)
})
t('statusline: sem --wrap não imprime nada e não quebra com JSON ruim', () => {
  assert.equal(rodar([]).stdout, '')
  const ruim = spawnSync('node', ['src/statusline.mjs'], { input: 'isto não é json', encoding: 'utf8', env: { ...process.env, CC_HOME: casa } })
  assert.equal(ruim.status, 0)
})
t('statusline: o caminho direto não carrega o cc.mjs inteiro (o motivo de existir)', () => {
  const ini = Date.now(); rodar([]); const direto = Date.now() - ini
  const ini2 = Date.now(); spawnSync('node', ['cc.mjs', 'statusline'], { input: entrada, encoding: 'utf8', env: { ...process.env, CC_HOME: casa } }); const viaCc = Date.now() - ini2
  assert.ok(direto < viaCc, `direto ${direto}ms deveria ser mais rápido que via cc.mjs ${viaCc}ms`)
})
fs.rmSync(casa, { recursive: true, force: true })
