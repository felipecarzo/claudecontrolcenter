#!/usr/bin/env node
/**
 * Gancho de FIM DE SESSÃO: a caixa de ponto do git.
 *
 * Roda no evento `SessionEnd` do Claude Code. Recebe no stdin o JSON do evento
 * (`session_id`, `cwd`), e:
 *
 * 1. Commita o próprio ponto AGORA, local e sem push. É rápido (<1s) e cabe no
 *    tempo curto que o fim de sessão dá.
 * 2. Se sou a última a sair E o projeto tem teste, dispara o push em processo
 *    SEPARADO (`--empurrar`), que sobrevive ao fim da sessão. Rodar teste e push
 *    aqui dentro seria morto pelo tempo do gancho.
 *
 * Guarda-costas dele: **sem teste, não empurra sozinho.** Repositório sem
 * `npm test` (a maioria dos sites de cliente) ganha o commit local seguro, mas o
 * push fica para a mão dele. Só sobe sozinho o que consegue se provar.
 *
 * Nunca derruba o fim da sessão: qualquer erro vira aviso no stderr e `exit 0`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { commitAoSair, souUltimo, apagarLuz, raizGit } from '../src/caixaGit.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const LOG = path.join(os.homedir(), 'logs', 'caixa-git.log')
function anota(linha) {
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true })
    fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${linha}\n`)
  } catch { /* log é conforto, não pode derrubar o gancho */ }
}

const temTeste = (raiz) => {
  try { return Boolean(JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'))?.scripts?.test) }
  catch { return false }
}

/* MODO 2: o push da última, em processo próprio. Chamado por `--empurrar <raiz>`,
   longe do tempo curto do gancho. */
if (process.argv[2] === '--empurrar') {
  const raiz = process.argv[3]
  try {
    const r = apagarLuz(raiz, { rodarTeste: true })
    anota(`empurrar ${raiz}: ${r.empurrou ? `OK, ${r.commits} commit(s)` : `segurado (${r.motivo})`}`)
  } catch (e) { anota(`empurrar ${raiz}: erro ${e?.message || e}`) }
  process.exit(0)
}

/* MODO 1: o gancho de verdade. Lê o evento do stdin. */
let entrada = ''
try { entrada = fs.readFileSync(0, 'utf8') } catch { /* sem stdin: segue com vazio */ }
let evento = {}
try { evento = JSON.parse(entrada || '{}') } catch { evento = {} }

const cwd = evento.cwd || process.cwd()
const sessionId = evento.session_id || evento.sessionId || null

try {
  const raiz = raizGit(cwd)
  if (!raiz) process.exit(0) // pasta sem git: nada a fazer

  const c = commitAoSair(raiz, { sessionId, quando: Date.now() })
  anota(`sair ${raiz} (${String(sessionId).slice(0, 8)}): ${c.commitou ? `ponto salvo ${c.hash} (${c.arquivos} arq.)` : c.motivo}`)

  if (souUltimo(raiz, sessionId)) {
    if (temTeste(raiz)) {
      // dispara o push em processo destacado, que sobrevive ao fim da sessão
      const filho = spawn('node', [path.join(AQUI, 'caixa-sair.mjs'), '--empurrar', raiz], {
        detached: true, stdio: 'ignore',
      })
      filho.unref()
      anota(`sou a última em ${raiz}: push disparado em segundo plano`)
    } else {
      anota(`sou a última em ${raiz}, mas sem teste: push segurado para a mão dele`)
    }
  }
} catch (e) {
  anota(`erro no gancho: ${e?.message || e}`)
}
process.exit(0)
