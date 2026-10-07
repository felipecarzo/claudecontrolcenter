// O catálogo de frentes (CC-521, decisão dele em 11/09): a frente é UMA palavra,
// com a descrição escrita ao lado, e todo item aberto do backlog carrega só o código.
//
// Antes cada item levava um texto livre, e a mesma frente aparecia de quatro jeitos
// ("cockpit 2", "cockpit2", "cockpit novo", "painel simples"). Frente escrita à mão
// divide a mesma coisa em várias colunas e some do mapa sem dar erro nenhum.
//
// **O catálogo mora no PROJETO, em `docs/frentes.json`, ao lado do `backlog.jsonl`.**
// Cada projeto da VPS tem as suas frentes; um catálogo global recusaria os itens de
// todos os outros. Sem o arquivo, não há cobrança: o projeto ainda não adotou.
// Código novo entra no JSON, com a descrição, e só então pode ser usado num item.
import fs from 'node:fs'
import path from 'node:path'

const cache = new Map() // caminho -> { mtime, catalogo }

/** O catálogo de frentes do projeto dono deste backlog, ou null se ele não tem. */
export function catalogoDe(arquivoBacklog) {
  const f = path.join(path.dirname(arquivoBacklog), 'frentes.json')
  let mtime
  try { mtime = fs.statSync(f).mtimeMs } catch { return null }
  const c = cache.get(f)
  if (c && c.mtime === mtime) return c.catalogo
  let catalogo = null
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'))
    if (j && typeof j === 'object' && !Array.isArray(j)) catalogo = j
  } catch { /* JSON quebrado: sem catálogo é melhor que recusar tudo */ }
  cache.set(f, { mtime, catalogo })
  return catalogo
}

/** Sem catálogo, qualquer frente vale. Com ele, só código de uma palavra que esteja nele. */
export const ehFrente = (c, catalogo) => !catalogo
  || (typeof c === 'string' && /^[a-z0-9]+$/.test(c) && Object.hasOwn(catalogo, c))

export const listaDeFrentes = (catalogo) => Object.entries(catalogo || {}).map(([c, d]) => `${c} (${d})`).join('; ')
