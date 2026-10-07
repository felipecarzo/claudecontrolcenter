#!/usr/bin/env node
/**
 * Ideia longa dele que só vira texto na conversa, sem item no backlog, volta uma vez.
 *
 * ## Por que existe (CC-917, 04/10)
 *
 * Palavras dele: *"às vezes eu falo com um agente, ele só coloca lá no texto, eu não
 * sei se quando ele coloca no texto ele está colocando já no roadmap, eu acredito que
 * não"*. Ele está certo: o Caminho só lê `docs/backlog.jsonl`, e a ideia que fica só
 * na resposta nunca chega lá. A regra escrita ("visão se registra, não se implementa")
 * já existe no arquivo de instruções global e não me segura; esta é a trava.
 *
 * ## O que ele confere, e só isso
 *
 * A última mensagem de uma PESSOA tem mais de 400 caracteres E abre com um dos marcadores
 * objetivos da regra 4 ("e se", "tive uma ideia", "me deu uma ideia", "proponho",
 * "poderíamos"). Se, no turno, nenhuma ferramenta registrou algo (`backlog emenda`,
 * `backlog novo`, `meu add` ou a skill `ideias`), devolve uma vez.
 *
 * Mensagem que não abre com marcador passa. Falha ABERTA em tudo, uma volta só.
 */
import { readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

export const MARCADORES = /^(?:(?:camarada|felipe|olha|ent[aã]o|bom|ah)[\s,.:;!-]*)*(e se|tive uma ideia|me deu uma ideia|proponho|poder[ií]amos)\b/i
export const MINIMO = 400
export const REGISTROS = /backlog\s+(emenda|novo|abrir)\b|\bmeu\s+(add|nova)\b|"skill"\s*:\s*"ideias"/

/** Texto de uma mensagem de pessoa, sem as injeções do sistema. */
function textoDe(entrada) {
  const c = entrada?.message?.content
  const partes = typeof c === 'string' ? [c] : Array.isArray(c) ? c.filter((p) => p?.type === 'text').map((p) => p.text) : []
  return partes.filter((t) => !/^\s*</.test(t)).join('\n').trim()
}

/** { pedido, registrou }: a última fala de pessoa e se algo foi registrado depois dela. */
export function lerTurno(linhas) {
  let ini = -1; let pedido = ''
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    let j = null
    try { j = JSON.parse(linhas[i]) } catch { continue }
    if (j?.type !== 'user' || j.isMeta || j.toolUseResult) continue
    const t = textoDe(j)
    if (!t) continue
    ini = i; pedido = t; break
  }
  if (ini < 0) return { pedido: '', registrou: false }
  const depois = linhas.slice(ini + 1).join('\n')
  // CC-958: só o que foi CHAMADO conta; texto de skill ou de resposta que cita o comando não grava nada
  const usos = []
  for (const l of linhas.slice(ini + 1)) {
    let j = null; try { j = JSON.parse(l) } catch { continue }
    const c = j?.message?.content
    if (j?.type === 'assistant' && Array.isArray(c)) for (const p of c) if (p?.type === 'tool_use') usos.push({ nome: p.name, cmd: String(p.input?.command || '') })
  }
  return { pedido, registrou: REGISTROS.test(depois), usos }
}

/** O guarda em si, sem I/O: devolve a mensagem de recusa ou null. */
export function decidir(pedido, registrou) {
  if (registrou) return null
  const p = String(pedido || '').trim()
  if (p.length <= MINIMO || !MARCADORES.test(p)) return null
  return 'IDEIA LONGA SÓ NO TEXTO, registre no backlog.\n\n'
    + `A mensagem dele tem ${p.length} caracteres e abre como visão ("${p.slice(0, 60).replace(/\n/g, ' ')}…").\n`
    + 'Nesta resposta nada foi registrado no backlog, e o Caminho só lê o backlog: a ideia\n'
    + 'que fica só na conversa não chega lá. Palavras dele, em 04/10: "às vezes eu falo com um\n'
    + 'agente, ele só coloca lá no texto".\n\n'
    + 'Use a skill `ideias` (ou `cc backlog emenda "..." --citacao "..."`, uma por ideia): ela\n'
    + 'registra com as palavras dele, no trecho do Caminho onde o projeto está. Registrar não é\n'
    + 'implementar: depois de registrar, pare e diga onde cada ideia ficou.\n'
    + 'Esta é a única volta: a próxima passa.'
}

/** CC-958: ideia registrada sem lugar, ou com lugar gravado sem perguntar, volta uma vez. */
export const LUGAR_NA_FALA = /\b(pra agora|para agora|urgente|fim do dia|fim do sprint|fim do backlog|fora do mvp|depois do mvp)\b/i
const ONDE = '(agora|dia|sprint|backlog|fora)\\b'
export function decidirLugar(pedido, usos = []) {
  const cmds = usos.filter((u) => u.nome === 'Bash').map((u) => u.cmd).join('\n')
  if (!/backlog\s+emenda\b/.test(cmds)) return null
  const gravou = new RegExp(`--lugar[\\s=]+["']?${ONDE}`).test(cmds) || new RegExp(`backlog\\s+lugar\\s+[A-Z]{2,4}-\\d+\\s+["']?${ONDE}`).test(cmds)
  if (!gravou) return 'IDEIA REGISTRADA SEM LUGAR NA FILA.\n\n'
    + 'A emenda nasceu como ideia, fora da fila, e nada entra na fila sem o toque dele (decisão dele em 07/10).\n'
    + 'Pergunte o lugar no AskUserQuestion com as opções que o comando imprimiu, a sugestão primeiro, e grave com\n'
    + 'node cc.mjs backlog lugar <ID> <agora|dia|sprint|backlog|fora>.\nEsta é a única volta: a próxima passa.'
  if (!usos.some((u) => u.nome === 'AskUserQuestion') && !LUGAR_NA_FALA.test(String(pedido || ''))) return 'LUGAR GRAVADO SEM PERGUNTAR A ELE.\n\n'
    + 'O lugar na fila é escolha dele. Confirme no AskUserQuestion, com a sugestão primeiro, e se ele escolher outro grave com\n'
    + 'node cc.mjs backlog lugar <ID> <lugar>.\nEsta é a única volta: a próxima passa.'
  return null
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let dados = null
  try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
  if (dados?.stop_hook_active) sair()
  const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
  if (cfg?.hookEnabled && !cfg.hookEnabled('ideia-guard')) sair()
  const arquivo = dados?.transcript_path || dados?.transcriptPath
  if (!arquivo) sair()
  let linhas = []
  try {
    const { size } = statSync(arquivo); const n = Math.min(size, 400 * 1024)
    const fd = openSync(arquivo, 'r'); const buf = Buffer.alloc(n); readSync(fd, buf, 0, n, size - n); closeSync(fd)
    linhas = buf.toString('utf8').split('\n'); if (size > n) linhas.shift()
  } catch { sair() }
  const { pedido, registrou, usos } = lerTurno(linhas)
  const msg = decidir(pedido, registrou) || decidirLugar(pedido, usos)
  if (!msg) sair()
  console.error(msg)
  process.exit(2)
}
