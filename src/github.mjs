/**
 * O repositório GitHub de um projeto declarado (CC-541, Fase 2 do CC-539).
 *
 * Decisão dele em 11/09: declarar projeto no registro central já cria o
 * repositório na hora, via `gh` (GitHub CLI) — PC e VPS passam a CLONAR
 * esse repositório em vez de cada um fazer `git init` por si, o que resolve
 * de vez "duas pastas serem o mesmo projeto por acidente de nome" (hoje elas
 * são o mesmo só porque o `path.basename` bate, achado ao investigar o
 * CC-539).
 *
 * **Nunca falha silencioso, e nunca trava o registro por causa disto.** Sem
 * `gh` instalado ou sem sessão autenticada, quem chama (a rota em `web.mjs`)
 * grava o projeto no registro mesmo assim, com `github: null` e um aviso
 * explicando por quê — a mesma regra de `quietAsync` em `platform.mjs`, que
 * nunca lança, só diz `ok: false` com o motivo.
 */

import { quietAsync } from './platform.mjs'

/** A conta logada no `gh`, ou o motivo de não haver uma. Não lança. */
export async function ghDisponivel() {
  const r = await quietAsync('gh', ['auth', 'status'], 10_000)
  if (!r.ok) return { ok: false, motivo: r.out.includes('not found') || /ENOENT/i.test(r.out)
    ? 'gh (GitHub CLI) não está instalado nesta máquina'
    : `gh não está autenticado: ${r.out.split('\n')[0]}` }
  return { ok: true, motivo: null }
}

/** Tira `owner/repo` da URL que o `gh repo create` imprime na saída. */
export function repoDeUrl(saida) {
  const url = (String(saida || '').match(/https:\/\/github\.com\/\S+/) || [])[0] || ''
  const repo = url.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '')
  return repo || null
}

/**
 * Cria o repositório vazio, sem clonar nada aqui — quem clona é
 * `novoProjeto.mjs` na Fase 3, em qual máquina o Felipe clicar "criar aqui".
 */
export async function criarRepo(nome, { privado = true } = {}) {
  const limpo = String(nome || '').trim()
  if (!limpo) return { ok: false, erro: 'sem nome' }
  const r = await quietAsync('gh', ['repo', 'create', limpo, privado ? '--private' : '--public'], 20_000)
  if (!r.ok) return { ok: false, erro: r.out.split('\n')[0] || 'gh recusou, sem detalhe' }
  const repo = repoDeUrl(r.out)
  if (!repo) return { ok: false, erro: `repositório criado mas não achei o nome na saída do gh: ${r.out.slice(0, 200)}` }
  return { ok: true, repo, url: `https://github.com/${repo}` }
}
