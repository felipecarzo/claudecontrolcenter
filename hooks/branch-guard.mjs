#!/usr/bin/env node
/**
 * O guarda das oficinas: impede o comando git que apaga trabalho de outro agente.
 *
 * ## De onde veio, em 16/08
 *
 * Ao decidir que cada agente teria worktree própria, o Felipe perguntou:
 *
 * > "e se o novo agente abrisse uma branch e depois desse merge, não seria mais
 * > seguro? teria como automatizar isso com hooks?"
 *
 * Mais seguro sim, **desde que cada um tenha pasta própria**. Branch sozinha é
 * pior que nada: o git guarda uma cópia dos arquivos por pasta, então
 * `git checkout` na pasta compartilhada troca os arquivos debaixo do outro
 * agente no meio de uma edição.
 *
 * É essa a família de comandos que este hook barra — os que **destroem estado**
 * de quem não está olhando:
 *
 * | comando | o que ele apaga |
 * |---|---|
 * | `git checkout <branch>` / `switch` | o trabalho não commitado da pasta |
 * | `git worktree remove` | a pasta inteira de outro agente |
 * | `git branch -D` | a branch onde alguém está trabalhando |
 * | `git reset --hard` / `clean -fd` | tudo que não foi commitado |
 *
 * ## O que ele NÃO faz, e é deliberado
 *
 * Não impede conflito de merge. Isso é semântico: dois agentes editando o mesmo
 * arquivo em pastas separadas é legítimo, e só o `rota-guard` com 📁 evita.
 * Worktree resolve "não quebrar agora"; rota resolve "não conflitar depois".
 *
 * Não barra `checkout` de ARQUIVO (`git checkout -- x.js`), que é desfazer local
 * e não mexe em ninguém.
 *
 * Falha ABERTA: erro aqui não pode travar o git.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança ERR_UNSUPPORTED_ESM_URL_SCHEME, e como quase toda chamada aqui
   está dentro de um `.catch`, o módulo some sem erro visível: foi assim que
   o interruptor de módulos deixou de valer em 31 hooks, sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.tool_name !== 'Bash') sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('branch-guard')) sair()

const cmd = String(dados?.tool_input?.command || '')
if (!/\bgit\b/.test(cmd)) sair()

const cwd = dados?.cwd || process.cwd()
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return null }
}

/** Arquivos mexidos e ainda não commitados nesta pasta. */
function pendencias() {
  const s = git(['status', '--porcelain'])
  if (s === null) return null
  const linhas = s.split(/\r?\n/).filter(Boolean)
  return {
    sujos: linhas.filter((l) => !l.startsWith('??')).length,
    novos: linhas.filter((l) => l.startsWith('??')).length,
  }
}

const barrar = (titulo, corpo) => {
  process.stderr.write(`${titulo}\n\n${corpo}\n`)
  process.exit(2)
}

/* ---- trocar de branch com trabalho pendente ---- */
const troca = /\bgit\s+(?:checkout|switch)\s+(?!-{1,2}\s|--\s)(?:-b\s+|-B\s+|-c\s+)?([^\s;&|]+)/.exec(cmd)
if (troca && !/\bcheckout\s+.*--\s/.test(cmd)) {
  const p = pendencias()
  if (p && (p.sujos || p.novos)) {
    const atual = (git(['branch', '--show-current']) || '').trim() || 'HEAD solta'
    barrar(
      `TROCAR DE BRANCH COM ${p.sujos + p.novos} ARQUIVO(S) SEM COMMIT — bloqueado.`,
      `Pasta:  ${cwd}\nAgora:  ${atual}\nDestino: ${troca[1]}\n`
      + `Pendente: ${p.sujos} modificado(s), ${p.novos} novo(s)\n\n`
      + 'O git guarda UMA cópia dos arquivos por pasta. Trocar de branch aqui\n'
      + 'reescreve o que está no disco — e se outro agente estiver editando esta\n'
      + 'mesma pasta, o arquivo dele muda no meio da frase.\n\n'
      + 'O caminho certo é uma pasta por agente:\n\n'
      + '    node cc.mjs oficina criar <nome>\n\n'
      + '  · `oficina criar` = cria uma pasta irmã com branch própria (git worktree)\n'
      + '  · o node_modules vira atalho para o da pasta principal, sem baixar de novo\n\n'
      + 'Se a troca é mesmo o que você quer: commite antes, ou `git stash`.',
    )
  }
}

/* ---- remover a oficina de alguém ---- */
const remove = /\bgit\s+worktree\s+remove\s+([^\s;&|]+)/.exec(cmd)
if (remove) {
  const alvo = remove[1]
  const sujo = (() => {
    try {
      const s = execFileSync('git', ['status', '--porcelain'], { cwd: alvo, encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] })
      return s.split(/\r?\n/).filter(Boolean).length
    } catch { return 0 }
  })()
  if (sujo && !/--force|-f\b/.test(cmd)) {
    barrar(
      `A OFICINA TEM ${sujo} ARQUIVO(S) SEM COMMIT — remoção bloqueada.`,
      `Pasta: ${alvo}\n\n`
      + 'Remover a worktree apaga a pasta. O que não foi commitado não está em\n'
      + 'lugar nenhum depois disso, e pode ser trabalho de outro agente que ainda\n'
      + 'está aberto.\n\n'
      + 'Commite lá dentro primeiro. Se for mesmo para jogar fora, use\n'
      + '`node cc.mjs oficina fechar <nome> --forcar`, que mostra o número antes.',
    )
  }
}

/* ---- apagar a branch onde alguém está ---- */
const apaga = /\bgit\s+branch\s+(?:-D|-d\s+--force|--delete\s+--force)\s+([^\s;&|]+)/.exec(cmd)
if (apaga) {
  const alvo = apaga[1]
  const lista = git(['worktree', 'list', '--porcelain']) || ''
  if (lista.includes(`refs/heads/${alvo}`)) {
    const pasta = (lista.split(/\r?\n/).reduce((achou, l, i, todas) => {
      if (l === `branch refs/heads/${alvo}`) {
        for (let k = i; k >= 0; k -= 1) if (todas[k].startsWith('worktree ')) return todas[k].slice(9)
      }
      return achou
    }, null))
    barrar(
      `A BRANCH "${alvo}" ESTÁ EM USO POR UMA OFICINA — não dá para apagar.`,
      `Oficina: ${pasta}\n\n`
      + 'Alguém pode estar trabalhando nela agora. Feche a oficina primeiro:\n\n'
      + `    node cc.mjs oficina fechar ${alvo}\n\n`
      + 'O comando recusa se houver trabalho não commitado lá dentro, que é\n'
      + 'exatamente a conferência que falta no `git branch -D`.',
    )
  }
}

/* ---- jogar fora o que não foi commitado ---- */
if (/\bgit\s+reset\s+--hard\b/.test(cmd) || /\bgit\s+clean\s+-[a-z]*f/.test(cmd)) {
  const p = pendencias()
  if (p && (p.sujos || p.novos)) {
    barrar(
      `APAGAR ${p.sujos + p.novos} ARQUIVO(S) SEM COMMIT — bloqueado.`,
      `Pasta: ${cwd}\nPendente: ${p.sujos} modificado(s), ${p.novos} novo(s)\n\n`
      + 'Este comando joga fora trabalho que não está em lugar nenhum, e a pasta\n'
      + 'pode ser de outro agente. A regra do Felipe é confirmar ação destrutiva\n'
      + 'antes, e este hook é essa confirmação.\n\n'
      + 'Se for mesmo o que você quer, peça a ele. Se quer só guardar de lado:\n'
      + '`git stash`, que dá para desfazer.',
    )
  }
}

sair()
