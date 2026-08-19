#!/usr/bin/env node
/**
 * CC-161 — o commit que precisa existir antes de trocar de máquina.
 *
 * Regra dele, dita ao desenhar a federação em 18/08: *"sempre usando o git
 * como segurança, e sempre mantendo o commit antes de migrar de
 * dispositivos"*. O git é o transporte do backlog e dos documentos entre o PC
 * e a VPS, então trabalho não commitado numa máquina é trabalho que a outra
 * **não vê**, e nada na tela denuncia isso: o painel federado mostra os
 * agentes, nunca a árvore suja.
 *
 * Dois sinais, e os dois são silenciosos sem este aviso:
 *
 * 1. **árvore suja** — o que está aqui não chega lá;
 * 2. **HEAD atrás do remoto** — o que está lá não chegou aqui, e continuar
 *    editando por cima disso é como se produz conflito.
 *
 * `Stop`, e AVISA sem travar, pelo mesmo motivo do `diario-guard`: commitar é
 * coisa do fim do turno, e travar aqui criaria laço. Some-se a regra dele que
 * vence qualquer automação: *"nunca commitar sem que eu peça explicitamente"*.
 * Este hook nunca commita nada, e nunca manda commitar — ele conta o que a
 * outra máquina não vai enxergar, e quem decide é ele.
 *
 * Nada de rede: `git status` e a contagem contra o remoto saem do que o `git
 * fetch` anterior já deixou em disco. Hook que fala com a internet no fim de
 * todo turno é hook que trava a sessão quando a rede cai.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
/* `pathToFileURL` e não o caminho cru: no Windows, `import('D:\\...')` morre
   com ERR_UNSUPPORTED_ESM_URL_SCHEME, porque o `D:` é lido como esquema de
   URL. O `config.mjs` abaixo escapa disso por estar dentro de um `catch`, e
   por isso o furo passou despercebido até aqui. */
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança ERR_UNSUPPORTED_ESM_URL_SCHEME, e como quase toda chamada aqui
   está dentro de um `.catch`, o módulo some sem erro visível: foi assim que
   o interruptor de módulos deixou de valer em 31 hooks, sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const liberar = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { liberar() }
if (dados?.stop_hook_active) liberar()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('sincronia-guard')) liberar()

/** Sobe a árvore procurando `.git`. Fora de repositório não há o que sincronizar. */
function acharRepo(dir) {
  let atual = resolve(dir || process.cwd())
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(atual, '.git'))) return atual
    const pai = dirname(atual)
    if (pai === atual) return null
    atual = pai
  }
  return null
}

const raiz = acharRepo(dados?.cwd)
if (!raiz) liberar()

/* O mesmo módulo que a tela usa, e não uma cópia da lógica aqui: hook e painel
   discordando sobre o estado do MESMO repositório seria pior que não ter nem
   um nem outro. Mesma razão pela qual a frase do framework mora no motor. */
const { estadoGit } = await import(pathToFileURL(resolve(AQUI, '../src/git.mjs')).href)
const e = estadoGit(raiz)
if (!e || e.emDia) liberar()

const { sujo, atras, naoEmpurrados } = e

/* A lista de arquivos continua saindo daqui: a tela mostra uma frase curta,
   mas quem está terminando o turno precisa ver O QUE ficou de fora. */
const pendentes = (() => {
  try {
    return execFileSync('git', ['-C', raiz, 'status', '--porcelain'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split(/\r?\n/).filter(Boolean)
  } catch {
    return []
  }
})()

const linhas = []
if (sujo) {
  linhas.push(`  · ${sujo} arquivo(s) sem commit nesta máquina`)
  linhas.push(...pendentes.slice(0, 5).map((l) => `      ${l.trim()}`))
  if (pendentes.length > 5) linhas.push(`      … e mais ${pendentes.length - 5}`)
}
if (naoEmpurrados) linhas.push(`  · ${naoEmpurrados} commit(s) feitos aqui e ainda não empurrados`)
if (atras) linhas.push(`  · ${atras} commit(s) no remoto que esta máquina ainda não puxou`)

process.stderr.write(
  `O QUE ESTÁ AQUI A OUTRA MÁQUINA NÃO VÊ — ${dirname(raiz) ? raiz.split(/[\\/]/).pop() : raiz}\n\n`
  + `${linhas.join('\n')}\n\n`
  + 'O git é o transporte entre o PC e a VPS: o painel federado mostra os '
  + 'agentes, nunca a árvore suja. Sem commit, trabalho feito aqui some da '
  + 'vista de lá, e quem abrir o projeto na outra máquina começa do estado '
  + 'velho.\n\n'
  + 'Não trava, e não pede commit: a regra dele é que ninguém commita sem ele '
  + 'pedir. É só o aviso de que existe diferença entre as máquinas agora.\n',
)
process.exit(0)
