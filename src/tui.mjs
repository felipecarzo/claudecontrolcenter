// Tabela ao vivo no terminal. Polling simples: fs.watch em N pastas dá mais
// dor de cabeça (evento duplicado, rename, Windows) do que reler 8 arquivos.

import { readJobs, summarize, fmtAge, fmtTokens } from './jobs.mjs'

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

const DOT = {
  working: [C.cyan, '●'],
  waiting: [C.yellow, '◆'],
  failed: [C.red, '✖'],
  done: [C.green, '✔'],
  idle: [C.gray, '○'],
}

// Mesma ordem de urgência da web (CC-05): quem precisa de você primeiro, quem
// já terminou por último. Projeto deixa de ser cabeçalho de seção e vira
// coluna — o terminal é consulta de relance, então zona responde "o que olho
// primeiro" e a coluna responde "de qual projeto é" sem precisar procurar.
const ZONES = [
  { key: 'waiting', title: 'precisa de você' },
  { key: 'failed', title: 'falhou' },
  { key: 'working', title: 'trabalhando' },
  { key: 'idle', title: 'parados' },
  { key: 'done', title: 'prontos' },
]

/**
 * Célula de largura fixa. Recebe texto PURO — a cor entra depois, senão a
 * truncagem corta o código de escape no meio e vaza `[0m` na tela.
 * A última coluna da largura é sempre o espaço que separa da próxima.
 */
function cell(text, width, color = '') {
  let t = String(text ?? '')
  if (t.length > width - 1) t = t.slice(0, width - 2) + '…'
  const padding = ' '.repeat(Math.max(0, width - t.length))
  return (color ? color + t + C.reset : t) + padding
}

const clip = (text, width) => {
  const t = String(text ?? '').replace(/\s+/g, ' ')
  return t.length > width ? t.slice(0, width - 1) + '…' : t
}

function render(jobs, { link } = {}) {
  const s = summarize(jobs)
  const width = Math.max(80, process.stdout.columns || 120)
  const out = []
  const chip = (k, n, label) => `${DOT[k][0]}${DOT[k][1]}${C.reset} ${n} ${C.dim}${label}${C.reset}`

  out.push(
    `${C.bold}AGENT COCKPIT${C.reset}   ` +
      [chip('working', s.working, 'ativos'), chip('waiting', s.waiting, 'esperando'),
       chip('failed', s.failed, 'falhos'), chip('done', s.done, 'prontos')].join('   ') +
      `   ${C.dim}${fmtTokens(s.tokens)} tokens${C.reset}` +
      (s.stale ? `   ${C.yellow}${s.stale} sem sinal${C.reset}` : ''),
  )
  if (link) out.push(`${C.dim}web:${C.reset} ${C.blue}${link}${C.reset}`)
  out.push('')

  const W = { dot: 3, project: 16, route: 18, model: 10, tok: 8, age: 8, todo: 7 }
  const fixed = W.dot + W.project + W.route + W.model + W.tok + W.age + W.todo
  const subjW = Math.max(24, width - fixed - 4)

  const porZona = new Map(ZONES.map((z) => [z.key, []]))
  for (const j of jobs) {
    if (!porZona.has(j.status)) porZona.set(j.status, []) // status desconhecido não some, ganha zona própria
    porZona.get(j.status).push(j)
  }
  const zonas = [...ZONES, ...[...porZona.keys()].filter((k) => !ZONES.some((z) => z.key === k))
    .map((key) => ({ key, title: key }))]

  for (const { key, title } of zonas) {
    const list = porZona.get(key) || []
    if (!list.length) continue
    const [zoneColor] = DOT[key] ?? [C.gray]
    out.push(`${zoneColor}${C.bold}▸ ${title}${C.reset} ${C.dim}(${list.length})${C.reset}`)
    out.push(
      '  ' + C.dim +
        cell('', W.dot) + cell('ASSUNTO', subjW) + cell('PROJETO', W.project) + cell('ROTA', W.route) +
        cell('MODELO', W.model) + cell('TOKENS', W.tok) + cell('IDADE', W.age) + cell('TODO', W.todo) +
        C.reset,
    )

    for (const j of list) {
      const [dotColor, dotChar] = DOT[j.status] ?? [C.gray, '·']
      const prefix = (j.pinned ? '* ' : '') + (j.category ? `[${j.category}] ` : '')
      const todo = j.todos.length ? `${j.todosDone}/${j.todos.length}` : '—'

      out.push(
        '  ' +
          cell(dotChar, W.dot, dotColor) +
          cell(prefix + j.subject, subjW) +
          cell(j.project, W.project, C.magenta) +
          cell(j.route, W.route, C.gray) +
          cell(j.model, W.model, C.dim) +
          cell(fmtTokens(j.tokens), W.tok, C.dim) +
          cell(fmtAge(j.ageMs), W.age, C.dim) +
          cell(todo, W.todo, j.todos.length ? '' : C.dim),
      )

      // segunda linha: o que importa saber sem abrir o job
      const [noteColor, noteText] = j.stale
        ? [C.yellow, `sem sinal há ${fmtAge(j.idleMs)}`]
        : j.blockers.length
          ? [C.red, `bloqueio: ${j.blockers[0]}`]
          : j.inFlight.length
            ? [C.dim, `${j.inFlight[0].kind}: ${j.inFlight[0].label}`]
            : [C.dim, j.detail || '']
      if (noteText) out.push('     ' + noteColor + clip(noteText, width - 7) + C.reset)
    }
    out.push('')
  }

  if (!jobs.length) out.push(`  ${C.dim}nenhum job encontrado em ~/.claude/jobs${C.reset}`)
  out.push(`${C.dim}ctrl+c para sair · atualiza a cada 2s${C.reset}`)
  return out.join('\n')
}

export function startTui({ intervalMs = 2000, link = null } = {}) {
  let last = ''
  const tick = () => {
    const frame = render(readJobs(), { link })
    if (frame === last) return // não repinta à toa: evita piscar
    last = frame
    process.stdout.write('\x1b[2J\x1b[H' + frame + '\n')
  }
  tick()
  const timer = setInterval(tick, intervalMs)
  return () => clearInterval(timer)
}

export { render, cell }
