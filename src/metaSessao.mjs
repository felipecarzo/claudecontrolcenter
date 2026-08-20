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

/**
 * CC-157, 19/08: o abrigo, para quando a casa está trancada.
 *
 * Achado medindo a queixa dele de que uma sessão trabalhando na
 * `fibraessencia` não aparecia no painel, *"como se ela tivesse funcionando
 * por fora do cockpit"*: dentro do sandbox do Claude Code, `~/.claude` está
 * montada somente para leitura. `EROFS` na cara, com a pasta gravável no
 * disco e o mesmo `touch` funcionando fora do sandbox.
 *
 * O estrago é o pior tipo: **silencioso e ao contrário**. A sessão continua
 * trabalhando, os hooks continuam disparando (contadas 24 travas diferentes
 * no transcrito real dela), e o que se perde é só ela APARECER na tela. Quem
 * olha o painel vazio conclui que nada está rodando.
 *
 * Ele perguntou o que garante que não aconteça de novo, e avisar não garante:
 * aviso depende de alguém ler. O que garante é ter para onde ir. Medido o que
 * o sandbox permite escrever, `~/.local/share` passa, então o reporte cai
 * para lá quando a casa recusa, e a LEITURA olha os dois lugares.
 *
 * Por que `~/.local/share` e não `/tmp` nem a pasta do projeto: `/tmp` some no
 * reboot, e escrever dentro do repositório sujaria projeto de cliente com
 * estado de ferramenta. É o lugar padrão de dado de aplicativo no Linux, e
 * sobrevive.
 */
export const DIR_SESSOES_ABRIGO = () => path.join(
  /* `CC_HOME` vence `XDG_DATA_HOME`, e isto é isolamento de teste, não estilo.
     Quem define `CC_HOME` está pedindo uma casa inteira separada; deixando o
     abrigo escapar por `XDG_DATA_HOME`, um teste com casa temporária escreveria
     no reporte DE VERDADE dele. É a mesma família do apagamento das notas em
     2026-08-09, e o `CC_HOME` nasceu justamente para fechá-la. */
  (!process.env.CC_HOME && process.env.XDG_DATA_HOME)
    || path.join(casaClaude(), '..', '.local', 'share'),
  'agent-cockpit', 'sessoes',
)

/** Os dois lugares onde um reporte de sessão pode estar, na ordem em que
 *  valem: a casa primeiro, o abrigo depois. */
export const DIRS_SESSOES = () => [DIR_SESSOES(), DIR_SESSOES_ABRIGO()]

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

/** Onde o reporte desta sessão está DE FATO. Procura na casa e no abrigo, e
 *  devolve o mais recente quando os dois existem: a sessão pode ter começado
 *  com a casa aberta e continuado depois que ela trancou. */
export function arquivoExistenteDe(sessionId) {
  const achados = DIRS_SESSOES()
    .map((dir) => path.join(dir, `${sessionId}.json`))
    .map((f) => { try { return { f, em: fs.statSync(f).mtimeMs } } catch { return null } })
    .filter(Boolean)
    .sort((a, b) => b.em - a.em)
  return achados[0]?.f || null
}

export function lerMetaSessao(sessionId) {
  const arquivo = arquivoExistenteDe(sessionId)
  if (!arquivo) return {}
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch { return {} }
}

/**
 * Escrita atômica, o mesmo padrão do `meta.json` de job: tmp mais rename, para
 * nunca deixar o arquivo pela metade se o processo morrer no meio.
 *
 * CC-157: tenta a casa; se ela estiver somente leitura (o sandbox), cai no
 * abrigo em vez de estourar. Devolve por onde saiu, para quem chama poder
 * dizer isso em voz alta uma vez, em vez de sumir calado do painel.
 */
export function gravarMetaSessao(sessionId, meta) {
  let ultimoErro = null
  for (const dir of DIRS_SESSOES()) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      const arquivo = path.join(dir, `${sessionId}.json`)
      const tmp = `${arquivo}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(meta, null, 2))
      fs.renameSync(tmp, arquivo)
      return { ...meta, _onde: dir, _abrigo: dir !== DIR_SESSOES() }
    } catch (e) {
      ultimoErro = e
      // só vale tentar o próximo quando o problema é PERMISSÃO. Disco cheio ou
      // JSON impossível de serializar falhariam igual nos dois, e insistir só
      // esconderia a causa real atrás de uma segunda mensagem igual.
      if (!['EROFS', 'EACCES', 'EPERM'].includes(e?.code)) throw e
    }
  }
  throw ultimoErro
}

/**
 * Limpa estado de sessão que não tem mais transcrito.
 *
 * O CLI apaga transcrito velho, e sem isto a pasta viraria depósito. Roda na
 * varredura, nunca em timer: é leitura de disco, e o painel já varre.
 */
export function limparOrfaos() {
  let apagados = 0
  // CC-157: varre a casa E o abrigo. Limpar só um deixaria lixo eterno no
  // outro, e o abrigo é justamente onde a sessão escreve quando algo está
  // errado, ou seja, o lugar com mais chance de acumular.
  for (const dir of DIRS_SESSOES()) {
    let arquivos = []
    try {
      arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    } catch { continue }

    for (const f of arquivos) {
      const id = f.replace(/\.json$/, '')
      if (transcritoDe(id)) continue
      try { fs.unlinkSync(path.join(dir, f)); apagados++ } catch { /* segue */ }
    }
  }
  return apagados
}
