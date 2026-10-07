// CC-942: onde começa o turno que as travas de fim de resposta medem.
// O recado de um executor chega com isMeta, mas abre turno (turnOrigin 'peer').
// Sem isso, as travas mediam tudo desde a última fala dele e acusavam nomes de
// uma resposta já corrigida. Injeção de skill (isMeta sem turnOrigin) não abre turno.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { respostaDoTurno } from './src/estilo.mjs'

const tr = path.join(os.tmpdir(), `cc942-${process.pid}.jsonl`)
const escrever = (linhas) => fs.writeFileSync(tr, linhas.map((x) => JSON.stringify(x)).join('\n'))
const fala = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
try {
  escrever([
    { type: 'user', message: { content: 'seguir' }, turnOrigin: 'human' },
    fala('VELHO reporte-guard'),
    { type: 'user', isMeta: true, turnOrigin: 'peer', message: { content: 'recado' } },
    { type: 'user', isMeta: true, message: { content: 'skill injetada' } },
    fala('NOVO limpo'),
  ])
  assert.equal(respostaDoTurno(tr), 'NOVO limpo', 'recado de executor abre turno; a resposta antiga não entra')
  console.log('  ok   recado de executor abre turno novo')

  escrever([
    { type: 'user', message: { content: 'seguir' }, turnOrigin: 'human' },
    fala('antes da skill'),
    { type: 'user', isMeta: true, message: { content: 'skill injetada' } },
    fala('depois da skill'),
  ])
  assert.equal(respostaDoTurno(tr), 'antes da skill\n\ndepois da skill', 'injeção de skill continua no mesmo turno')
  console.log('  ok   injeção de skill não abre turno')
} finally { fs.rmSync(tr, { force: true }) }
console.log('2 verificações do turno, 0 falhas')
