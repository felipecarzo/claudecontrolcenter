// CC-35: "o que mudou desde que eu saí", com resposta rica de verdade: a
// lista de ARQUIVOS, não a contagem que `sinais.arquivos` do tempo.mjs dá
// (`edicoes.size`, um número sem nome nenhum atrás).
//
// Sob clique, nunca em timer: é spawn de `git`, e o tique de 2s dos agentes
// não pode esperar por isso: mesma decisão de processos.mjs e vps.mjs.

import { quietAsync } from './platform.mjs'

const SEP = '\x1f' // separador que não aparece em mensagem de commit normal

/**
 * Commits de um projeto desde uma data, com os arquivos tocados em cada um.
 * `execFile` sem shell: cada argumento é elemento do array, nunca string
 * montada: não há injeção possível mesmo vindo de input externo.
 */
export async function commitsDesde(cwd, desde) {
  if (!cwd) return { ok: false, motivo: 'sem caminho do projeto' }
  const iso = new Date(desde || 0).toISOString()
  // `-C <cwd>` diz ao PRÓPRIO git onde operar: `execFile` não muda o
  // diretório do processo filho sozinho, e sem isso o comando rodaria sempre
  // na pasta onde o servidor do painel foi iniciado, não na do projeto pedido.
  // (achado testando ao vivo: as duas chamadas devolveram o log deste
  // repositório, mesmo pedindo outro projeto)
  const r = await quietAsync(
    'git',
    ['-C', cwd, 'log', `--since=${iso}`, `--pretty=format:%H${SEP}%at${SEP}%s`, '--numstat'],
    20000,
  )
  // `ok:false` cobre tanto "não é repo git" quanto timeout: quietAsync não
  // distingue, e não tem por que: a tela mostra "sem histórico" nos dois casos.
  if (!r.ok) return { ok: false, motivo: 'sem histórico git (pasta sem git, ou tempo esgotado)' }
  if (!r.out.trim()) return { ok: true, commits: [] }

  const commits = []
  let atual = null
  for (const linha of r.out.split(/\r?\n/)) {
    if (linha.includes(SEP)) {
      if (atual) commits.push(atual)
      const [hash, at, assunto] = linha.split(SEP)
      atual = { hash, em: Number(at) * 1000, assunto, arquivos: [] }
      continue
    }
    const numstat = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(linha)
    if (numstat && atual) atual.arquivos.push(numstat[3])
  }
  if (atual) commits.push(atual)

  return { ok: true, commits }
}
