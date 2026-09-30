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

/* CC-727: o `idle` do registro do Claude Code vira "parou" na hora; o `busy`
   não manda; sem registro, vale a idade do arquivo como antes. */
try {
  const { estadoDaSessao } = await import('./src/sessoes.mjs')
  assert.strictEqual(estadoDaSessao('idle', 5000), 'waiting', 'acabou de responder: parou na hora, sem esperar o minuto')
  assert.strictEqual(estadoDaSessao('busy', 5000), 'working')
  assert.strictEqual(estadoDaSessao('busy', 40 * 60 * 1000), 'idle', 'busy não mantém trabalhando quem está calado há 40 min')
  assert.strictEqual(estadoDaSessao(undefined, 5000), 'working', 'sem registro, a regra da idade de antes')
  assert.strictEqual(estadoDaSessao('waiting', 5000), 'waiting')
  assert.strictEqual(estadoDaSessao('idle', 40 * 60 * 1000), 'idle')
  console.log('  ok   CC-727: registro idle vira parou na hora')
} catch (e) { erro('CC-727: estado pelo registro', e) }

/* CC-740: sessão de Remote Control ganha o endereço dela no app. */
try {
  const casa2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-app-'))
  const a = path.join(casa2, 'rc.jsonl')
  fs.writeFileSync(a, [
    JSON.stringify({ type: 'bridge-session', bridgeSessionId: 'cse_015QLnZAg2mNXWAj7gfZcPiZ' }),
    JSON.stringify({ type: 'user', cwd: '/p/x', timestamp: '2026-09-30T10:00:00Z' }),
  ].join('\n') + '\n')
  const b = path.join(casa2, 'ruim.jsonl')
  fs.writeFileSync(b, [
    JSON.stringify({ type: 'bridge-session', bridgeSessionId: 'cse_x"><script>' }),
    JSON.stringify({ type: 'user', cwd: '/p/x', timestamp: '2026-09-30T10:00:00Z' }),
  ].join('\n') + '\n')
  assert.strictEqual(cabecaDe(a).appUrl, 'https://claude.ai/code/session_015QLnZAg2mNXWAj7gfZcPiZ')
  assert.strictEqual(cabecaDe(b).appUrl, null, 'id fora do formato não vira link')
  fs.rmSync(casa2, { recursive: true, force: true })
  console.log('  ok   CC-740: sessão de Remote Control tem o link do app')
} catch (e) { erro('CC-740: link do app', e) }

/* CC-737: a etiqueta do agy sai da primeira linha e não entra no texto. */
try {
  const { lerEtiqueta } = await import('./src/resumoAgy.mjs')
  assert.deepStrictEqual(lerEtiqueta('ETIQUETA: TESTAR\nO agente subiu a tela nova.'), { etiqueta: 'testar', texto: 'O agente subiu a tela nova.' })
  assert.strictEqual(lerEtiqueta('**ETIQUETA:** responder  (decisão)\nx').etiqueta, 'responder', 'aguenta negrito e comentário')
  assert.deepStrictEqual(lerEtiqueta('Resumo sem etiqueta.'), { etiqueta: null, texto: 'Resumo sem etiqueta.' })
  assert.strictEqual(lerEtiqueta('O texto fala de ETIQUETA: NADA no meio').etiqueta, null, 'só vale na primeira linha')
  console.log('  ok   CC-737: etiqueta responder/testar/nada lida do resumo')
} catch (e) { erro('CC-737: etiqueta', e) }

if (falhou) process.exit(1)
console.log('test-sessoes: ok')
