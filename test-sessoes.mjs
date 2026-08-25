/**
 * Regressão: sessão de Remote Control sumia da Central.
 *
 * `cabecaDe` lia só os primeiros 16 KB do transcrito atrás do `cwd`. Numa
 * sessão pilotada pelo celular o preâmbulo é grande e o primeiro `cwd` aparece
 * depois disso (no caso real, byte ~20 KB), então a sessão era descartada
 * inteira e o cartão do projeto contava a menos. Este teste guarda o conserto:
 * o `cwd` além de 16 KB tem que ser achado.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cabecaDe } from './src/sessoes.mjs'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-sessoes-'))
try {
  // Um transcrito onde o `cwd` só aparece depois de 16 KB de preâmbulo, como
  // numa sessão de Remote Control de verdade.
  const arquivo = path.join(casa, 'sessao.jsonl')
  const preambulo = []
  preambulo.push(JSON.stringify({ type: 'last-prompt', text: 'oi' }))
  preambulo.push(JSON.stringify({ type: 'mode', model: 'opus' }))
  preambulo.push(JSON.stringify({ type: 'bridge-session', id: 'abc' }))
  // enche além de 16 KB sem nenhum cwd
  let bytes = preambulo.join('\n').length
  while (bytes < 20 * 1024) {
    const linha = JSON.stringify({ type: 'system', texto: 'x'.repeat(400) })
    preambulo.push(linha)
    bytes += linha.length + 1
  }
  // só AGORA entra a linha com o cwd e o timestamp
  preambulo.push(JSON.stringify({ type: 'user', cwd: '/home/claudedev/projetos/VPS_cockpit', timestamp: '2026-08-25T20:00:00.000Z' }))
  fs.writeFileSync(arquivo, preambulo.join('\n') + '\n')

  try {
    const c = cabecaDe(arquivo)
    assert.ok(c, 'a cabeça não pode voltar nula com cwd presente além de 16 KB')
    assert.equal(c.cwd, '/home/claudedev/projetos/VPS_cockpit', 'o cwd tem que ser achado depois dos 16 KB')
    assert.equal(c.remoto, true, 'a marca de Remote Control tem que sobreviver à leitura em blocos')
    ok('cabecaDe acha o cwd que aparece depois de 16 KB (sessão de Remote Control não some da Central)')
  } catch (e) { erro('cwd além de 16 KB', e) }

  // prova negativa: transcrito sem cwd nenhum continua devolvendo null
  try {
    const semCwd = path.join(casa, 'sem-cwd.jsonl')
    fs.writeFileSync(semCwd, JSON.stringify({ type: 'system', texto: 'sem cwd aqui' }) + '\n')
    assert.equal(cabecaDe(semCwd), null, 'transcrito sem cwd tem que continuar sendo descartado')
    ok('transcrito sem cwd continua descartado (não inventa projeto)')
  } catch (e) { erro('prova negativa', e) }
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}

if (falhou) process.exit(1)
console.log('test-sessoes: ok')
