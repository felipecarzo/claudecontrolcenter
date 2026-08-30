// CC-24: "o que eu produzi esta semana", cruzando os projetos.
//
// Não escreve nada em lugar nenhum: nem arquivo novo, nem vault. Só lê o que
// já existe (histórico de jobs, git, diário, roadmap) e devolve texto pronto.
// Sob demanda (botão), nunca em timer: varrer ~20 projetos com spawn de git é
// caro, mesma decisão de processos.mjs e vps.mjs.

import fs from 'node:fs'
import path from 'node:path'
import { findProjects } from './install.mjs'
import { marcosDe } from './historico.mjs'
import { commitsDesde } from './gitlog.mjs'
import { nomeCanonico } from './nomeProjeto.mjs'

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
    // sem nenhuma das três fontes, o projeto não teve semana: não é erro
    silencio: !marcos.length && !(git.ok && git.commits.length) && !diario.length,
  }
}

/**
 * Todos os projetos com `CLAUDE.md`: mesma lista que o `sync` do CC-06 já
 * varre. `desde` default: 7 dias, porque é "digest SEMANAL".
 */
/**
 * Cache curto do digest, para a tela poder carregar sozinha ao abrir.
 *
 * ## Por que ele nasceu, medido em 29/08
 *
 * A tela do Digest era um botão e mais nada: 16 caracteres na tela, contra
 * 300 KB de dado pronto do outro lado da rota. Ela prometia "o que mudou em
 * cada projeto nos últimos 7 dias" e mostrava um botão cinza, então ninguém
 * clicava e o recurso inteiro ficava desligado sem nunca dar erro. É a peça
 * construída e inalcançável de novo, no formato mais discreto: alcançável por
 * um clique que ninguém tem motivo para dar.
 *
 * O botão existia por um motivo real, e ele continua de pé: **a varredura leva
 * ~2 segundos** (medida três vezes: 2,28s, 1,95s, 2,07s), porque cruza git,
 * histórico e diário de 20 projetos. Isso nunca pode entrar no tique de 2 em 2
 * segundos, que é a armadilha já registrada da varredura de portas.
 *
 * O cache é o que concilia os dois: a tela pede ao abrir, paga os 2s na
 * primeira vez do período, e reabrir sai de graça. Quem quer o número fresco
 * pede `force`.
 *
 * ⚠️ **Cinco minutos, e não mais.** O digest é o que mudou HOJE: um cache longo
 * mostraria trabalho de horas atrás como se fosse agora, e ele confere isso no
 * telefone justamente quando acabou de mexer em alguma coisa.
 */
const CACHE_MS = 5 * 60 * 1000
let cache = null

/**
 * O começo da janela padrão, arredondado para a hora cheia.
 *
 * ⚠️ **`Date.now()` cru como valor padrão desliga qualquer cache**, e sem
 * barulho nenhum: a chave muda a cada milissegundo, então toda chamada erra o
 * cache e paga os 2s de novo. Foi o que aconteceu na primeira versão disto, e
 * o sintoma era o cache "funcionando" e nunca acertando.
 *
 * Arredondar para a hora não muda nada para ele — commit de sete dias atrás não
 * troca de lado por causa de minutos — e é o que torna a janela uma pergunta
 * repetível.
 */
const janelaPadrao = () => {
  const hora = 3600 * 1000
  return Math.floor((Date.now() - 7 * 24 * hora) / hora) * hora
}

export async function digestTodos({ desde = janelaPadrao(), jobs = [], base, force = false } = {}) {
  /* A chave leva `desde` e a base: pedir outra janela é outra pergunta, e
     devolver o cache da janela anterior mentiria sem errar. */
  const chave = `${desde}|${base || ''}`
  if (!force && cache && cache.chave === chave && Date.now() - cache.em < CACHE_MS) {
    return { ...cache.valor, doCache: true, colhidoEm: cache.em }
  }
  const valor = await colher({ desde, jobs, base })
  cache = { chave, em: Date.now(), valor }
  return { ...valor, doCache: false, colhidoEm: cache.em }
}

/** Esquece o cache. Existe para o teste não depender de esperar cinco minutos. */
export function esquecerCacheDigest() { cache = null }

async function colher({ desde, jobs, base }) {
  const dirs = findProjects(base).filter((d) => fs.existsSync(path.join(d, 'CLAUDE.md')))
  const resultados = []
  for (const dir of dirs) {
    const projeto = path.basename(dir)
    /* `projeto` continua sendo o nome da PASTA, porque é ele que liga o cartão
       ao disco. `nome` é o que vai para a tela, sem o prefixo de máquina: o
       cartão já traz o selo dizendo VPS ou PC, então "VPS_carzo VPS" escrevia a
       mesma informação duas vezes na mesma linha. */
    const r = await digestDe(dir, projeto, { desde, jobs })
    resultados.push({ ...r, nome: nomeCanonico(projeto) })
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
