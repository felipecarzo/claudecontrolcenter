// Bloco de notas do painel. Fica em ~/.claude, ao lado do interruptor, porque
// a anotação é da máquina e não de um projeto — a mesma nota vale olhando
// qualquer agente.
//
// Arquivo separado do control-center.json de propósito: nota muda a cada
// pausa de digitação, configuração quase nunca. Juntar faria reescrever a
// configuração o tempo todo por causa de uma tecla.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const NOTES_FILE = path.join(os.homedir(), '.claude', 'control-center-notes.json')

const LIMITS = { blocos: 200, titulo: 120, texto: 20000, altura: [40, 2000] }

let seq = 0
const novoId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`

const corta = (v, n) => String(v ?? '').slice(0, n)

/**
 * Aceita variação de formato pelo mesmo motivo de `normalizeTodo`: o arquivo é
 * editável à mão e string solta é o palpite mais provável de quem abrir.
 */
function normalizeNote(n) {
  if (typeof n === 'string') n = { text: n }
  if (!n || typeof n !== 'object') return null
  const h = Number(n.h ?? n.height)
  const [min, max] = LIMITS.altura
  return {
    id: corta(n.id || novoId(), 40),
    title: corta(n.title ?? n.t ?? n.titulo ?? '', LIMITS.titulo),
    text: corta(n.text ?? n.body ?? n.content ?? n.texto ?? '', LIMITS.texto),
    h: Number.isFinite(h) ? Math.min(Math.max(Math.round(h), min), max) : 120,
    // 'check' exibe uma linha por item marcável; o texto continua sendo a
    // única fonte — item feito é a linha prefixada com "[x] ". Sem lista
    // paralela, alternar o modo não migra nada e o arquivo segue legível.
    kind: n.kind === 'check' ? 'check' : 'text',
  }
}

export const _internals = { normalizeNote }

export function readNotes() {
  try {
    const data = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'))
    const lista = Array.isArray(data) ? data : data?.notes
    return (Array.isArray(lista) ? lista : []).map(normalizeNote).filter(Boolean)
  } catch {
    return []
  }
}

export function writeNotes(notes) {
  const limpo = (Array.isArray(notes) ? notes : [])
    .map(normalizeNote)
    .filter(Boolean)
    .slice(0, LIMITS.blocos)
  fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true })
  const tmp = `${NOTES_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ notes: limpo }, null, 2))
  fs.renameSync(tmp, NOTES_FILE)
  return limpo
}
