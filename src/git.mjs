/**
 * CC-161 — o quanto esta máquina difere do que está no remoto.
 *
 * O git é o transporte do backlog e dos documentos entre o PC e a VPS, então
 * "o meu backlog está atualizado?" é, na prática, uma pergunta sobre git. O
 * painel federado nunca respondeu isso: ele mostra agentes, uso e horas, e a
 * árvore de arquivos fica invisível.
 *
 * ## Três estados, e cada um significa uma coisa diferente
 *
 * - **sujo**: existe trabalho aqui que a outra máquina não vai ver de jeito
 *   nenhum, nem depois de um push, porque nem commitado está;
 * - **não empurrado**: commitado aqui, invisível lá até o push;
 * - **atrás**: existe coisa lá que aqui não chegou, e editar por cima disso é
 *   como se produz conflito.
 *
 * ## Nunca puxa, nunca commita
 *
 * Decisão registrada quando o CC-161 nasceu, e ela vem da regra dele: *"nunca
 * commitar sem que eu peça explicitamente"*. `git pull` automático por cima de
 * mudança não commitada é exatamente o tipo de ação irreversível que este
 * projeto já aprendeu a não fazer sozinho.
 *
 * ## Zero rede
 *
 * Tudo sai do que o último `fetch` deixou em disco. Uma função que fala com a
 * internet a cada leitura de tela trava a tela quando a rede cai, e a promessa
 * central deste painel é funcionar offline.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** Medido em 19/08 neste PC: 83ms por projeto, 1905ms para 23. É por isso que
 *  quem chama precisa escolher para quais projetos pergunta, em vez de varrer
 *  tudo — e por isso isto nunca pode entrar no tique de 2 segundos. */
export const CUSTO_APROXIMADO_MS = 85

const git = (raiz, ...args) => {
  try {
    return execFileSync('git', ['-C', raiz, ...args], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/* `git()` devolve `null` quando o comando falha, e `Number(null)` é ZERO, não
   `NaN`. Sem esta distinção, "não existe upstream" viraria "zero commits de
   diferença", que é uma afirmação bem mais forte do que o que se sabe. */
const contar = (raiz, intervalo) => {
  const saida = git(raiz, 'rev-list', '--count', intervalo)
  if (saida === null) return null
  const n = Number(saida)
  return Number.isFinite(n) ? n : null
}

/**
 * Sobe a árvore até achar o `.git`.
 *
 * A pasta que chega aqui costuma ser onde o AGENTE roda, não a raiz do
 * repositório: nos monorepos dele o trabalho acontece em `apps/web_ibrics` e
 * o `.git` fica três níveis acima. Sem subir, o painel dizia "sem git" para
 * projeto versionado, que é pior que não dizer nada — some o aviso justamente
 * onde havia o que avisar.
 *
 * `.git` pode ser ARQUIVO e não pasta: é o formato de worktree, e este
 * repositório usa worktree de verdade (o `--front`). Por isso `existsSync` e
 * não uma checagem de diretório.
 */
function acharRaizGit(dir) {
  let atual = path.resolve(dir)
  for (let i = 0; i < 40; i++) {
    if (fs.existsSync(path.join(atual, '.git'))) return atual
    const pai = path.dirname(atual)
    if (pai === atual) return null
    atual = pai
  }
  return null
}

/**
 * O retrato de um repositório, ou `null` para pasta que não é repositório.
 *
 * `null` e "tudo em ordem" são coisas diferentes de propósito: projeto sem git
 * não tem como estar desatualizado, e mostrá-lo como "em dia" seria inventar
 * uma garantia que ninguém deu.
 */
export function estadoGit(dir) {
  const raiz = dir ? acharRaizGit(dir) : null
  if (!raiz) return null

  const sujo = (git(raiz, 'status', '--porcelain') || '')
    .split(/\r?\n/).filter(Boolean).length
  const atras = contar(raiz, 'HEAD..@{upstream}')
  const naoEmpurrados = contar(raiz, '@{upstream}..HEAD')
  const ramo = git(raiz, 'rev-parse', '--abbrev-ref', 'HEAD')

  return {
    ramo: ramo || null,
    sujo,
    atras,
    naoEmpurrados,
    /* `semUpstream` merece campo próprio: é o caso da branch nova que nunca
       foi empurrada, e ela não está "em dia" nem "divergente" — ninguém do
       outro lado sequer sabe que ela existe. */
    semUpstream: atras === null && naoEmpurrados === null,
    emDia: sujo === 0 && !atras && !naoEmpurrados,
  }
}

/** Uma frase curta para a tela, ou `''` quando não há nada a dizer. Fica aqui
 *  e não no HTML para o painel e o hook nunca discordarem sobre o mesmo
 *  repositório, mesma razão pela qual a frase do framework mora no motor. */
export function fraseGit(e) {
  if (!e) return ''
  if (e.semUpstream) return `${e.ramo || 'esta branch'} nunca foi empurrada`
  if (e.emDia) return ''
  const partes = []
  if (e.sujo) partes.push(`${e.sujo} sem commit`)
  if (e.naoEmpurrados) partes.push(`${e.naoEmpurrados} sem push`)
  if (e.atras) partes.push(`${e.atras} pra puxar`)
  return partes.join(', ')
}
