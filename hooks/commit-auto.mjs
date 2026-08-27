#!/usr/bin/env node
/**
 * Liga ou desliga a autorização CONTÍNUA de commit, por sessão.
 *
 * Nasceu de um atrito medido em 26/08: ele disse "salva cada item ao fechar"
 * (pela caixa de pergunta), mas o `commit-guard` só lê mensagem DIGITADA e não
 * enxerga o botão, então cobrava a autorização de novo a cada commit. Isto dá um
 * "sim" que dura a sessão inteira, em vez de um por commit.
 *
 * Por SESSÃO de propósito: a autorização vale para a conversa em que ele a deu,
 * e uma sessão nova nasce com a trava ativa de novo. Assim um "pode" de hoje não
 * autoriza o commit de amanhã, que é a razão de a trava existir.
 *
 * Uso:
 *   node hooks/commit-auto.mjs on      liga para ESTA sessão (CLAUDE_CODE_SESSION_ID)
 *   node hooks/commit-auto.mjs off     desliga
 *   node hooks/commit-auto.mjs status  diz o estado
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const MARCADOR = path.join(os.homedir(), '.cache', 'agent-cockpit', 'commit-liberado.json')

export function lerLiberado() {
  try { return JSON.parse(fs.readFileSync(MARCADOR, 'utf8')) } catch { return null }
}

/** A sessão do marcador libera esta chamada? Compara o id da sessão. */
export function liberadoPara(sessao) {
  const s = String(sessao || '').slice(0, 8)
  if (!s) return false
  const m = lerLiberado()
  return Boolean(m?.ligado && String(m.sessao || '').slice(0, 8) === s)
}

function ligar(sessao) {
  fs.mkdirSync(path.dirname(MARCADOR), { recursive: true })
  const tmp = MARCADOR + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify({ ligado: true, sessao, desde: Date.now() }, null, 2))
  fs.renameSync(tmp, MARCADOR)
}

function desligar() {
  try { fs.rmSync(MARCADOR, { force: true }) } catch { /* já não existe */ }
}

// só roda como CLI quando chamado direto, não quando importado pelo teste/guarda
// `pathToFileURL` e não `file://${...}`: no Windows o caminho é `D:\...`, e a
// concatenação crua nunca casa com `import.meta.url` (`file:///D:/...`). O
// bloco inteiro ficava morto lá, calado e com código de saída 0.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const acao = process.argv[2]
  const sessao = process.env.CLAUDE_CODE_SESSION_ID || process.argv[3] || ''
  if (acao === 'on') {
    if (!sessao) { console.error('sem CLAUDE_CODE_SESSION_ID: passe o id como 3o argumento'); process.exit(1) }
    ligar(sessao)
    console.log(`commit contínuo LIGADO para a sessão ${sessao.slice(0, 8)}. Some ao desligar ou ao trocar de sessão.`)
  } else if (acao === 'off') {
    desligar()
    console.log('commit contínuo DESLIGADO. O guarda volta a pedir autorização.')
  } else {
    const m = lerLiberado()
    console.log(m?.ligado ? `ligado para a sessão ${String(m.sessao).slice(0, 8)}` : 'desligado')
  }
}
