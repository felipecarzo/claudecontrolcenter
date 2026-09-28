#!/usr/bin/env node
/**
 * CC-651: o gancho de permissão do cockpit.
 *
 * Pedido dele, depois de semanas de "não atualiza": *"eu não aguento mais não
 * atualizar os pedidos"*. Medido em 27/09: quando quem pede permissão é um
 * AJUDANTE em segundo plano, o pedido não aparece na tela principal do
 * terminal (só "Waiting for 1 background agent"), e o registro marca a sessão
 * como ocupada. O painel lia exatamente essas duas coisas, e não via nada.
 *
 * Este gancho (evento `PermissionRequest`) dispara em TODO pedido, da conversa
 * principal ou de ajudante. Decisão dele: "avisar e responder, 30 s".
 *
 *  1. grava o pedido numa pasta do painel;
 *  2. espera a resposta dada no painel por até 30 s;
 *  3. com resposta, devolve a decisão ao Claude Code (sem apertar tecla);
 *  4. sem resposta, sai calado, e o pedido segue para o terminal e o app
 *     exatamente como hoje.
 *
 * Só espera se alguém está com o painel aberto (o painel marca a hora a cada
 * leitura). Sem painel aberto nos últimos 20 s, sai na hora: ninguém fica 30 s
 * esperando um pedido que não tem quem veja.
 *
 * Qualquer erro aqui sai calado (código 0, sem saída): o gancho nunca pode
 * travar nem decidir sozinho. O formato da decisão foi lido do próprio Claude
 * Code instalado (2.1.283): `{ behavior: "allow" }` ou `{ behavior: "deny" }`.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'

const ESPERA_MS = 30000
const PAINEL_VIVO_MS = 20000

const pasta = () => path.join(
  (!process.env.CC_HOME && process.env.XDG_DATA_HOME) || path.join(process.env.CC_HOME || os.homedir(), '.local', 'share'),
  'agent-cockpit', 'permissoes',
)

function lerEntrada() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')) } catch { return null }
}

/** O que mostrar no cartão: a descrição que o agente escreveu e o comando. */
export function resumoDaEntrada(ferramenta, entrada) {
  const e = entrada || {}
  const descricao = String(e.description || e.prompt || '').slice(0, 300)
  const comando = String(e.command || e.file_path || e.url || e.pattern || e.query || JSON.stringify(e)).slice(0, 1500)
  return { descricao, comando }
}

export async function principal({ entrada, dir = pasta(), agora = Date.now, esperar = (ms) => new Promise((r) => setTimeout(r, ms)), espera = ESPERA_MS } = {}) {
  const j = entrada
  if (!j || j.hook_event_name !== 'PermissionRequest') return null
  let vivo = 0
  try { vivo = fs.statSync(path.join(dir, '.painel-aberto')).mtimeMs } catch { return null }
  if (agora() - vivo > PAINEL_VIVO_MS) return null
  const id = crypto.randomUUID().slice(0, 13)
  const arq = path.join(dir, id + '.json')
  const resp = path.join(dir, id + '.resposta.json')
  const { descricao, comando } = resumoDaEntrada(j.tool_name, j.tool_input)
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(arq + '.tmp', JSON.stringify({
      id, sessao: j.session_id || null, cwd: j.cwd || null, ajudante: j.agent_id || null, tipoAjudante: j.agent_type || null,
      ferramenta: j.tool_name || null, descricao, comando, em: agora(), ate: agora() + espera,
    }))
    fs.renameSync(arq + '.tmp', arq)
  } catch { return null }
  try {
    for (let t = 0; t < espera; t += 300) {
      let r = null
      try { r = JSON.parse(fs.readFileSync(resp, 'utf8')) } catch { /* ainda não */ }
      if (r && (r.decisao === 'sim' || r.decisao === 'nao')) {
        return r.decisao === 'sim'
          ? { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }
          : { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: 'negado pelo painel' } } }
      }
      await esperar(300)
    }
    return null
  } finally {
    try { fs.unlinkSync(arq) } catch { /* já saiu */ }
    try { fs.unlinkSync(resp) } catch { /* não houve */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal({ entrada: lerEntrada() })
    .then((saida) => { if (saida) process.stdout.write(JSON.stringify(saida)) })
    .catch(() => { /* nunca travar o Claude Code */ })
    .finally(() => process.exit(0))
}
