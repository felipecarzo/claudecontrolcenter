/**
 * CC-56: onde uma sessão INTERATIVA guarda o estado que ela reporta.
 *
 * ## O problema, medido
 *
 * `cc set` exigia `CLAUDE_JOB_DIR`, que só existe em job de background. Quem
 * trabalha pelo celular, via Remote Control, não tem job — então da VPS não
 * dava para reportar to-do, frente nem bloqueio, justamente no modo de uso que
 * mais cresceu. O CC-51 resolveu metade (o painel passou a **enxergar** a
 * sessão, lendo o transcrito); faltava o caminho de volta.
 *
 * ## Por que um arquivo novo, e não `jobs/`
 *
 * A regra de ouro do projeto: `~/.claude/jobs/` é do CLI, e a única escrita
 * permitida lá é o `meta.json` de um job que o CLI criou. Sessão interativa não
 * tem pasta lá, e **inventar uma seria escrever dentro da casa do Claude Code**
 * — exatamente o que a regra proíbe. Por isso o estado mora em
 * `<casa>/control-center-sessoes/<sessionId>.json`, do lado de fora.
 *
 * ## A identidade vem do ambiente, não de adivinhação
 *
 * `CLAUDE_CODE_SESSION_ID` existe em sessão interativa e **é o nome do arquivo
 * de transcrito** (conferido nesta VPS: `ff0d68b2-…` na variável, mesmo id no
 * `.jsonl`). A alternativa seria deduzir pelo transcrito mais recente do
 * projeto, que erra sempre que duas sessões trabalham juntas — que é o caso
 * comum aqui.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

export const PROJETOS_DIR = () => path.join(casaClaude(), 'projects')
export const DIR_SESSOES = () => path.join(casaClaude(), 'control-center-sessoes')

/** O id desta sessão, quando ela é interativa. `null` em job de background. */
export const sessaoAtual = () => process.env.CLAUDE_CODE_SESSION_ID || null

export const arquivoMetaDe = (sessionId) => path.join(DIR_SESSOES(), `${sessionId}.json`)

/**
 * O transcrito daquela sessão, se existir.
 *
 * Serve como prova de que o id é real antes de gravar: sem isso, um `--job`
 * digitado errado criaria um arquivo de estado para uma sessão que nunca
 * existiu, e ele ficaria lá para sempre sem nada para casar.
 */
export function transcritoDe(sessionId) {
  if (!sessionId) return null
  let pastas = []
  try {
    pastas = fs.readdirSync(PROJETOS_DIR(), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(PROJETOS_DIR(), d.name))
  } catch { return null }

  for (const pasta of pastas) {
    const alvo = path.join(pasta, `${sessionId}.jsonl`)
    if (fs.existsSync(alvo)) return alvo
  }
  return null
}

export function lerMetaSessao(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(arquivoMetaDe(sessionId), 'utf8'))
  } catch { return {} }
}

/** Escrita atômica, o mesmo padrão do `meta.json` de job: tmp mais rename, para
 *  nunca deixar o arquivo pela metade se o processo morrer no meio. */
export function gravarMetaSessao(sessionId, meta) {
  fs.mkdirSync(DIR_SESSOES(), { recursive: true })
  const arquivo = arquivoMetaDe(sessionId)
  const tmp = `${arquivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2))
  fs.renameSync(tmp, arquivo)
  return meta
}

/**
 * Limpa estado de sessão que não tem mais transcrito.
 *
 * O CLI apaga transcrito velho, e sem isto a pasta viraria depósito. Roda na
 * varredura, nunca em timer: é leitura de disco, e o painel já varre.
 */
export function limparOrfaos() {
  let arquivos = []
  try {
    arquivos = fs.readdirSync(DIR_SESSOES()).filter((f) => f.endsWith('.json'))
  } catch { return 0 }

  let apagados = 0
  for (const f of arquivos) {
    const id = f.replace(/\.json$/, '')
    if (transcritoDe(id)) continue
    try { fs.unlinkSync(path.join(DIR_SESSOES(), f)); apagados++ } catch { /* segue */ }
  }
  return apagados
}
