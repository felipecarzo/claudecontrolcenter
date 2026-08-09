// O que sobra depois que o Claude Code limpa `~/.claude/jobs`.
//
// Motivo: em 2026-08-08 restavam 9 jobs de semanas de trabalho. Tudo o que a
// aba de preço mede por tarefa — quantas fecharam, quando, quanto levaram —
// evaporava junto. Métrica que só enxerga a última semana não fecha preço.
//
// O painel já relê os jobs a cada 2s; aqui só se copia o que ele leu para um
// arquivo próprio, fora de `jobs/`. Continua valendo a regra de ouro: nada é
// escrito dentro de `~/.claude/jobs` além do `meta.json`.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const HISTORICO_FILE = path.join(os.homedir(), '.claude', 'control-center-historico.json')

/** Só o que serve para medir depois. O resto é estado de tela, e morre bem. */
const guardavel = (j) => ({
  id: j.id,
  subject: j.subject,
  project: j.project,
  sub: j.sub || null,
  route: j.route || null,
  category: j.category || null,
  status: j.status,
  todos: j.todos || [],
  feitoEm: j.feitoEm || {},
  niveis: j.niveis || {},
  estimativas: j.estimativas || {},
  sessionId: j.sessionId || null,
  model: j.model || null,
  tokens: j.tokens || 0,
  createdAt: j.createdAt,
  updatedAt: j.updatedAt,
})

/** Muda quando algo que interessa mudou — evita reescrever o arquivo a cada 2s. */
const marca = (g) => JSON.stringify([g.status, g.subject, g.todos, g.tokens, g.updatedAt])

let ultimaMarca = new Map()

export function readHistorico() {
  try {
    const h = JSON.parse(fs.readFileSync(HISTORICO_FILE, 'utf8'))
    return h && typeof h.jobs === 'object' ? h : { jobs: {} }
  } catch {
    return { jobs: {} }
  }
}

function gravar(h) {
  const tmp = `${HISTORICO_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(h))
  fs.renameSync(tmp, HISTORICO_FILE)
}

/**
 * Copia os jobs vistos agora para o histórico. Nunca lança: falhar ao
 * arquivar não pode derrubar o painel, que é a função principal.
 *
 * O job que sumiu do disco continua no arquivo — é justamente o que se quer
 * guardar. `visto` diz quando foi a última vez que ele existia de verdade.
 */
export function arquivar(jobs, agora = Date.now()) {
  try {
    const novos = jobs.map(guardavel).filter((g) => {
      const m = marca(g)
      if (ultimaMarca.get(g.id) === m) return false
      ultimaMarca.set(g.id, m)
      return true
    })
    if (!novos.length) return 0

    const h = readHistorico()
    for (const g of novos) {
      const antes = h.jobs[g.id]
      h.jobs[g.id] = {
        ...g,
        // O primeiro registro é o mais próximo do início real que se consegue:
        // job criado antes do painel existir nunca teve um "visto" anterior.
        desde: antes?.desde || g.createdAt || agora,
        visto: agora,
      }
    }
    gravar(h)
    return novos.length
  } catch {
    return 0
  }
}

/** Os jobs de sempre: os que ainda existem, mais os que o CLI já apagou. */
export function jobsHistoricos(vivos = []) {
  const h = readHistorico()
  const idsVivos = new Set(vivos.map((j) => j.id))
  const mortos = Object.values(h.jobs).filter((j) => !idsVivos.has(j.id))
  return { vivos, mortos, total: vivos.length + mortos.length }
}

export const _internals = { guardavel, marca, resetar: () => { ultimaMarca = new Map() } }
