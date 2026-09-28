// CC-547: o `cc status` não pode afirmar "fora do ar" quando não enxerga.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const casa = mkdtempSync(join(tmpdir(), 'status-'))
const rodar = (env) => spawnSync(process.execPath, ['cc.mjs', 'status', '--port', '59999'], {
  encoding: 'utf8', env: { ...process.env, HOME: casa, CC_HOME: join(casa, '.claude'), ...env },
}).stdout

assert.match(rodar({ SANDBOX_RUNTIME: '1' }), /área isolada/, 'dentro da área isolada, diz que não enxerga')
assert.match(rodar({ SANDBOX_RUNTIME: '' }), /painel: fora do ar/, 'fora dela, porta sem ninguém é fora do ar')

const porta = (env) => spawnSync(process.execPath, ['-e', 'import("./src/daemon.mjs").then((d) => console.log(d.portaDoPainel()))'], {
  encoding: 'utf8', env: { ...process.env, HOME: casa, ...env },
}).stdout.trim()
assert.equal(porta(), '8099', 'sem anotação, a porta padrão')
mkdirSync(join(casa, '.local', 'share', 'agent-cockpit'), { recursive: true })
writeFileSync(join(casa, '.local', 'share', 'agent-cockpit', 'porta'), '5180')
assert.equal(porta(), '5180', 'com a anotação do serviço, a porta dele')

console.log('4 ok, 0 falhas (status do painel)')
