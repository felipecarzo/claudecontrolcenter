// CC-1107: o guarda de Stop que roda por dentro do parada.mjs conta como registrado (a VPS só tem o programa único)
import assert from 'node:assert/strict'
import { HOOKS } from './src/hooksCatalogo.mjs'
import { registrado } from './src/hooksRegistro.mjs'

const stopNoParada = HOOKS.find((h) => h.evento === 'Stop' && h.script === 'jargao-guard.mjs')
const preTool = HOOKS.find((h) => h.evento === 'PreToolUse' && h.implementado)
assert.ok(stopNoParada && preTool, 'catálogo sem os hooks de exemplo')

const so = (evento, command) => ({ hooks: { [evento]: [{ hooks: [{ type: 'command', command }] }] } })
const comoNaVps = so('Stop', 'node /home/claudedev/projetos/VPS_cockpit/hooks/parada.mjs')
const comoNoPc = so('Stop', 'node D:/Documentos/projetos/cockpit/hooks/jargao-guard.mjs')

assert.equal(registrado(stopNoParada, comoNaVps), true, 'VPS: o guarda roda por dentro do parada.mjs')
assert.equal(registrado(stopNoParada, comoNoPc), true, 'PC: registrado pelo nome, como sempre')
assert.equal(registrado(stopNoParada, so('Stop', 'node /x/pixel-agents.js')), false, 'sem parada.mjs nem o nome, não está')
assert.equal(registrado(stopNoParada, { hooks: {} }), false, 'configuração vazia')
assert.equal(registrado(stopNoParada, null), false, 'configuração ilegível não inventa registro')
assert.equal(registrado(preTool, so('PreToolUse', 'node /x/hooks/parada.mjs')), false, 'parada.mjs só vale para hook de Stop')
// a forma REAL do settings do PC em 22/11: o caminho mora em `args`, e `command` é só "node"
const comArgs = (...args) => ({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node', args, timeout: 60 }] }] } })
assert.equal(registrado(stopNoParada, comArgs('D:/Documentos/projetos/cockpit/hooks/parada.mjs')), true, 'PC: parada.mjs em args')
assert.equal(registrado(stopNoParada, comArgs('D:\\Documentos\\projetos\\cockpit\\hooks\\parada.mjs')), true, 'PC: barra invertida')
assert.equal(registrado(stopNoParada, comArgs('C:/Users/x/.pixel-agents/hooks/claude-hook.js')), false, 'args de outro programa não conta')
console.log('test-registro-parada: 9 verificações, 0 falhas')
