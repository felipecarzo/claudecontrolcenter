// CC-526 (decisão dele em 11/09): projeto ATIVO que passa de 7 dias sem movimento
// aparece no leitor do dia, com o número de dias, para ELE decidir se marca inativo.
// O painel nunca marca sozinho: marcar inativo some o projeto das contas dele.
//
// "Movimento" é o mais recente entre o último commit do git e a última vez que um
// item do backlog foi mexido. Só um deles enganaria: projeto que só trabalha em
// backlog parece parado no git, e projeto sem backlog parece parado no backlog.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const LIMITE_DIAS = 7
const DIA = 86400e3

/**
 * `lista`: [{ id, nome, ativo, ultimoMovimento (ms) | null }]. Devolve os ativos parados há
 * mais que o limite, do mais parado para o menos. Sem nenhum sinal de movimento (null) o
 * projeto NÃO entra: dizer "parado há N dias" sem saber desde quando seria inventar o N.
 */
export function projetosParados(lista, { agora = Date.now(), limite = LIMITE_DIAS } = {}) {
  return lista
    .filter((p) => p.ativo !== false && p.ultimoMovimento)
    .map((p) => ({ id: p.id, nome: p.nome, dias: Math.floor((agora - p.ultimoMovimento) / DIA) }))
    .filter((p) => p.dias > limite)
    .sort((a, b) => b.dias - a.dias)
}

/** O movimento mais recente de uma pasta de projeto, em ms, ou null se não achou sinal. */
export function ultimoMovimentoDe(raiz) {
  let melhor = 0
  try {
    const s = execFileSync('git', ['-C', raiz, 'log', '-1', '--format=%ct'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (s) melhor = Math.max(melhor, Number(s) * 1000)
  } catch { /* sem git ou sem commit */ }
  try {
    const cru = fs.readFileSync(path.join(raiz, 'docs', 'backlog.jsonl'), 'utf8')
    for (const l of cru.split(/\r?\n/)) {
      const m = l.match(/"mexido":"(\d{4}-\d{2}-\d{2})"/)
      if (m) melhor = Math.max(melhor, Date.parse(m[1] + 'T12:00:00Z'))
    }
  } catch { /* sem backlog */ }
  return melhor || null
}
