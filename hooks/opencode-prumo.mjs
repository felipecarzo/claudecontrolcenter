/**
 * CC-803: plugin do opencode que segura o modelo no projeto.
 *
 * O painel liga este arquivo pela configuração de cada resposta (`plugin`). Toda
 * a decisão está em `src/gatePrumo.mjs`; aqui só entra o gancho do opencode,
 * `tool.execute.before`, que roda ANTES de cada ferramenta. Lançar um erro ali
 * barra a ferramenta e o texto do erro chega ao modelo.
 *
 * ⚠️ Este arquivo só pode exportar o plugin. O opencode chama TODA função
 * exportada como se fosse um plugin; por isso a lógica mora em outro arquivo.
 *
 * Variáveis que o painel passa:
 *   CC_PRUMO_ARQ        onde anotar cada barrada (uma linha JSON), que o painel
 *                       lê no fim da resposta e conta na conversa
 *   CC_PRUMO_LIBERADAS  pastas que ele liberou nesta conversa, separadas por vírgula
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { novoEstado, avaliar } from '../src/gatePrumo.mjs'
import { mensagemDeTrava, travaDe } from '../src/travaArquivo.mjs'

const sessoes = new Map()

export const Prumo = async (ctx) => ({
  'tool.execute.before': async (input, output) => {
    let r = { bloquear: false }
    try {
      const sid = input?.sessionID || 'sem-sessao'
      if (!sessoes.has(sid)) sessoes.set(sid, novoEstado())
      const liberadas = String(process.env.CC_PRUMO_LIBERADAS || '').split(',').map((s) => s.trim().replace(/\/?\*+$/, '')).filter(Boolean)
      r = avaliar(sessoes.get(sid), input?.tool, output?.args || {}, { cwd: ctx?.directory || ctx?.worktree || process.cwd(), home: os.homedir(), liberadas })
      // CC-847 (Nisaba): arquivo travado por micro tarefa de OUTRA conversa não se edita
      const alvo = output?.args?.filePath || output?.args?.file_path || output?.args?.path
      if (!r.bloquear && alvo && /^(write|edit|patch|multiedit)$/i.test(input?.tool || '')) {
        const t = travaDe(path.resolve(ctx?.directory || ctx?.worktree || process.cwd(), alvo), { quem: process.env.CC_TRAVA_DONO || null })
        if (t) r = { bloquear: true, regra: 'trava', motivo: mensagemDeTrava(t) }
      }
      if (r.bloquear && process.env.CC_PRUMO_ARQ) {
        try { fs.appendFileSync(process.env.CC_PRUMO_ARQ, JSON.stringify({ em: Date.now(), regra: r.regra, tool: input?.tool, motivo: r.motivo }) + '\n') } catch { /* anotar é conforto */ }
      }
    } catch { /* falha aberta: bug do gancho nunca derruba o agente */ }
    if (r.bloquear) throw new Error(r.motivo)
  },
})
