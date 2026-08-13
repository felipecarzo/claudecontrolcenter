// CC-24: "o que eu produzi esta semana", cruzando os projetos.
//
// Não escreve nada em lugar nenhum — nem arquivo novo, nem vault. Só lê o que
// já existe (histórico de jobs, git, diário, roadmap) e devolve texto pronto.
// Sob demanda (botão), nunca em timer: varrer ~20 projetos com spawn de git é
// caro, mesma decisão de processos.mjs e vps.mjs.

import fs from 'node:fs'
import path from 'node:path'
import { findProjects } from './install.mjs'
import { marcosDe } from './historico.mjs'
import { commitsDesde } from './gitlog.mjs'

const DIRS_DIARIO = ['diario', 'daily']

/** Entradas de diário desde uma data. CRLF é a regra, não a exceção aqui. */
function diarioDesde(dir, desde) {
  const entradas = []
  for (const nome of DIRS_DIARIO) {
    const pasta = path.join(dir, 'docs', nome)
    let arquivos
    try { arquivos = fs.readdirSync(pasta) } catch { continue }
    for (const arq of arquivos) {
      const data = /^(\d{4}-\d{2}-\d{2})/.exec(arq)?.[1]
      if (!data || new Date(data).getTime() < new Date(desde).setHours(0, 0, 0, 0)) continue
      try {
        const texto = fs.readFileSync(path.join(pasta, arq), 'utf8')
        entradas.push({ data, arquivo: arq, texto: texto.split(/\r?\n/).join('\n').trim() })
      } catch { /* arquivo ilegível não derruba o digest */ }
    }
    if (entradas.length) break // achou uma convenção, não mistura com a outra
  }
  return entradas.sort((a, b) => a.data.localeCompare(b.data))
}

/**
 * Um projeto, cruzando as quatro fontes. `jobs` é injetado (não lido aqui)
 * pelo mesmo motivo de `cockpit.mjs`: manter o módulo testável sem tocar disco
 * de `~/.claude/jobs`.
 */
export async function digestDe(dir, projeto, { desde = 0, jobs = [] } = {}) {
  const marcos = marcosDe(projeto, { desde, jobs })
  const git = await commitsDesde(dir, desde)
  const diario = diarioDesde(dir, desde)
  return {
    projeto,
    marcos,
    commits: git.ok ? git.commits : [],
    gitOk: git.ok,
    diario,
    // sem nenhuma das três fontes, o projeto não teve semana — não é erro
    silencio: !marcos.length && !(git.ok && git.commits.length) && !diario.length,
  }
}

/**
 * Todos os projetos com `CLAUDE.md` — mesma lista que o `sync` do CC-06 já
 * varre. `desde` default: 7 dias, porque é "digest SEMANAL".
 */
export async function digestTodos({ desde = Date.now() - 7 * 24 * 3600 * 1000, jobs = [], base } = {}) {
  const dirs = findProjects(base).filter((d) => fs.existsSync(path.join(d, 'CLAUDE.md')))
  const resultados = []
  for (const dir of dirs) {
    const projeto = path.basename(dir)
    resultados.push(await digestDe(dir, projeto, { desde, jobs }))
  }
  const semanaSilenciosa = resultados.filter((r) => r.silencio).length
  return {
    desde,
    projetos: resultados.filter((r) => !r.silencio),
    // não é silêncio truncado: é contagem explícita do que ficou de fora
    silenciosos: semanaSilenciosa,
    totalVarrido: dirs.length,
  }
}
