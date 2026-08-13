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
  // CC-23: sem isso não dá pra cruzar o job com o git log nem com o ROADMAP
  // do projeto. `project` é só o nome; isto é o caminho de verdade.
  cwd: j.cwd || null,
})

/** Muda quando algo que interessa mudou — evita reescrever o arquivo a cada 2s. */
const marca = (g) => JSON.stringify([g.status, g.subject, g.todos, g.tokens, g.updatedAt])

let ultimaMarca = new Map()

// `file` é injetável só para o teste isolar do arquivo real da máquina —
// o painel de verdade nunca passa esse argumento, e usa o default sempre.
export function readHistorico(file = HISTORICO_FILE) {
  try {
    const h = JSON.parse(fs.readFileSync(file, 'utf8'))
    return h && typeof h.jobs === 'object' ? h : { jobs: {} }
  } catch {
    return { jobs: {} }
  }
}

function gravar(h, file = HISTORICO_FILE) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(h))
  fs.renameSync(tmp, file)
}

/**
 * Copia os jobs vistos agora para o histórico. Nunca lança: falhar ao
 * arquivar não pode derrubar o painel, que é a função principal.
 *
 * O job que sumiu do disco continua no arquivo — é justamente o que se quer
 * guardar. `visto` diz quando foi a última vez que ele existia de verdade.
 */
export function arquivar(jobs, agora = Date.now(), file = HISTORICO_FILE) {
  try {
    const novos = jobs.map(guardavel).filter((g) => {
      const m = marca(g)
      if (ultimaMarca.get(g.id) === m) return false
      ultimaMarca.set(g.id, m)
      return true
    })
    if (!novos.length) return 0

    const h = readHistorico(file)
    for (const g of novos) {
      const antes = h.jobs[g.id]
      h.jobs[g.id] = {
        ...g,
        // `marcarConclusoes()` poda feitoEm/niveis/estimativas quando o agente
        // reescreve os to-dos. Sobrescrever aqui propagaria a poda pro
        // histórico e apagaria o carimbo — que é a única prova de quando a
        // tarefa fechou. Por isso merge, nunca substituição.
        feitoEm: { ...(antes?.feitoEm || {}), ...g.feitoEm },
        niveis: { ...(antes?.niveis || {}), ...g.niveis },
        estimativas: { ...(antes?.estimativas || {}), ...g.estimativas },
        // O primeiro registro é o mais próximo do início real que se consegue:
        // job criado antes do painel existir nunca teve um "visto" anterior.
        desde: antes?.desde || g.createdAt || agora,
        visto: agora,
      }
    }
    gravar(h, file)
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

/**
 * O que aconteceu neste projeto, em ordem. Deriva do histórico que já existe:
 * não escreve nada, não faz spawn, não lê disco além do JSON já cacheado em
 * memória pelo caller — tem que ser tão barata quanto porProjeto(), porque é
 * chamada no mesmo caminho de 2s.
 *
 * Só três tipos de marco. Commit e mudança de roadmap entram por outro módulo
 * (CC-24/CC-35, que leem do disco do projeto) — aqui é só o que o histórico
 * de jobs já sabe.
 */
export function marcosDe(projeto, { desde = 0, jobs = null, file = HISTORICO_FILE } = {}) {
  const h = readHistorico(file)
  const vivos = jobs || []
  const porId = new Map(vivos.map((j) => [j.id, j]))
  for (const [id, j] of Object.entries(h.jobs)) if (!porId.has(id)) porId.set(id, j)

  const marcos = []
  for (const j of porId.values()) {
    if (j.project !== projeto) continue
    for (const [texto, em] of Object.entries(j.feitoEm || {})) {
      if (em > desde) marcos.push({ em, tipo: 'todo', texto, jobId: j.id })
    }
    const inicio = j.desde || j.createdAt
    if (inicio > desde) marcos.push({ em: inicio, tipo: 'agente', texto: j.subject || '(sem assunto)', jobId: j.id })
    if (j.status === 'done' && (j.updatedAt || 0) > desde) {
      marcos.push({ em: j.updatedAt, tipo: 'entrega', texto: j.subject || '(sem assunto)', jobId: j.id })
    }
  }
  return marcos.sort((a, b) => a.em - b.em)
}

export const _internals = { guardavel, marca, resetar: () => { ultimaMarca = new Map() } }
