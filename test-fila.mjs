// A trava de mensagem que sumiu da fila (CC-776): os dois falsos positivos medidos em 01/10.
import assert from 'node:assert/strict'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
import { perdidas, citou } from './src/fila.mjs'

const palavras = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((p) => p.length > 2)

// 1. mensagem entregue no meio do turno (anexo queued_command) não é perdida
const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'fila-'))
const arq = path.join(casa, 's.jsonl')
const op = (operation, content, t) => JSON.stringify({ type: 'queue-operation', operation, content, timestamp: t })
fs.writeFileSync(arq, [
  op('enqueue', 'lembra que eu falo dos avisos', '2026-10-01T02:54:56Z'),
  op('remove', 'lembra que eu falo dos avisos', '2026-10-01T02:55:03Z'),
  JSON.stringify({ type: 'attachment', attachment: { type: 'queued_command', prompt: 'lembra que eu falo dos avisos' }, timestamp: '2026-10-01T02:55:03Z' }),
  op('enqueue', 'esta sumiu de verdade', '2026-10-01T03:00:00Z'),
  op('remove', 'esta sumiu de verdade', '2026-10-01T03:00:05Z'),
].join('\n'))
assert.deepEqual(perdidas(arq).map((p) => p.texto), ['esta sumiu de verdade'], 'a entregue no meio do turno não conta como perdida')
fs.rmSync(casa, { recursive: true, force: true })

// 2. citação com o erro de digitação corrigido conta como citada
assert.ok(citou(palavras('m,as coloca no acklog e segue'), palavras('Você pediu: "mas coloca no backlog e segue".')), 'acklog casa com backlog')
assert.ok(citou(palavras('lembra que eu falo que esses avisos deveriam ficar carregando no fim da lista'), palavras('você escreveu: lembra que eu falo que esses avisos deveriam')))
assert.ok(!citou(palavras('coloca no acklog e segue'), palavras('segui com o próximo item da fila')), 'resposta que não cita continua cobrada')
assert.ok(!citou(palavras('troca a cor do botao'), palavras('troca a cor do fundo')), 'palavras curtas diferentes não casam por acidente')

console.log('trava de mensagem da fila: 6 verificações, todas passaram')
