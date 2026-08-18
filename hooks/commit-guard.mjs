#!/usr/bin/env node
/**
 * "Nunca commitar sem que eu peca explicitamente."
 *
 * ## A medicao, em 16/08
 *
 * Regra do arquivo de instrucoes globais dele, escrita ha meses. Neste unico
 * dia eu fiz mais de quinze commits, e ele pediu **uma vez** ("comit").
 *
 * Como a maioria dos commits era de trabalho que ele tinha mandado fazer, o
 * estrago nao apareceu. Mas a regra existe por um motivo que independe disso:
 * commit e a fronteira entre rascunho e historia do projeto, e quem decide
 * atravessar e ele.
 *
 * ## Como o hook sabe se ele autorizou
 *
 * Le a ULTIMA mensagem que ele escreveu e procura o pedido. Nada de registro
 * novo nem de flag: a autorizacao ja existe, esta na conversa, e derivar dela e
 * mais honesto que inventar um segundo lugar para dizer sim.
 *
 * Vale so para a mensagem mais recente, de proposito. Um "commit" de meia hora
 * atras nao autoriza o commit de agora, que e sobre outro assunto.
 *
 * ## O que passa sem autorizacao
 *
 * `git add`, `git status`, `git diff`, `git log`. Preparar nao e atravessar.
 *
 * Falha ABERTA, e nunca barra `--amend` de mensagem: consertar o texto de um
 * commit que ele ja autorizou nao e um commit novo.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.tool_name !== 'Bash') sair()

const cfg = await import(resolve(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('commit-guard')) sair()

const cmd = String(dados?.tool_input?.command || '')
if (!/\bgit\s+commit\b/.test(cmd)) sair()
// consertar a mensagem de um commit ja autorizado nao e commit novo
if (/--amend/.test(cmd)) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

/** A ultima coisa que uma PESSOA escreveu. Injecao de skill e saida de tool nao contam. */
function ultimoPedido(texto) {
  const linhas = texto.split('\n')
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    let l = null
    try { l = JSON.parse(linhas[i]) } catch { continue }
    if (l?.type !== 'user' || l?.isMeta || l?.toolUseResult) continue
    const c = l?.message?.content
    const t = typeof c === 'string'
      ? c
      : Array.isArray(c) ? c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n') : ''
    if (t && !t.startsWith('<')) return t
  }
  return null
}

let pedido = null
try { pedido = ultimoPedido(readFileSync(arquivo, 'utf8').slice(-120_000)) } catch { sair() }
if (!pedido) sair()

/**
 * O jeito dele de mandar commitar.
 *
 * Curto e escrito com pressa, quase sempre no celular: "comit", "commita",
 * "sobe isso", "salva". A lista aceita erro de digitacao de proposito, porque
 * exigir a palavra certa faria o hook barrar um sim que ele deu.
 */
const AUTORIZOU = [
  /\bcom+it+[aeu]?r?\b/i,          // commit, comit, commita, comitar
  /\bcomm?ita\b/i,
  /\bsobe (isso|ai|tudo|pro git)\b/i,
  /\bsalva (isso|tudo|no git)\b/i,
  /\bpode (commitar|comitar|subir|salvar)\b/i,
  /\bfa[çc]a? o commit\b/i,
  /\bpush\b/i,                      // pedir push implica commitar o que falta
  /\bend-?session\b/i,              // a rotina de encerramento commita por desenho
]

if (AUTORIZOU.some((re) => re.test(pedido))) sair()

/**
 * O "sim" que responde a uma pergunta minha, achado em 19/08.
 *
 * A trava barrou um commit que ele tinha autorizado com todas as letras: eu
 * terminei a resposta perguntando *"posso commitar e enviar?"* e ele
 * respondeu **"sim"**. A lista acima exige a palavra `commit` na mensagem
 * DELE, e ninguem repete a pergunta inteira para dizer sim.
 *
 * Isso e pior que barrar por engano: a propria trava manda, na mensagem de
 * recusa, *"pergunte se pode commitar"* — e depois nao aceitava a resposta.
 * O caminho que ela ensina terminava num beco.
 *
 * O buraco fica fechado porque o sim curto so vale se **eu perguntei sobre
 * commit na resposta anterior**. Sem a pergunta, "sim" continua sem
 * autorizar nada, que e o caso que a trava existe para pegar (ele dizendo sim
 * a outra coisa qualquer enquanto eu commito por conta propria).
 */
const SIM_CURTO = /^\s*(sim|isso|pode|manda|ok|blz|beleza|claro|vai|bora|aham|uhum|s)\b[\s.!]*$/i

if (SIM_CURTO.test(pedido) && pergunteiSobreCommit(arquivo)) sair()

/**
 * A resposta que eu dei ANTES do sim dele, e nao a minha fala mais recente.
 *
 * A primeira versao usava `ultimaResposta()`, e falhou na primeira tentativa
 * real: quando o commit e barrado, eu escrevo alguma coisa ("agora o commit
 * que voce autorizou"), e essa fala passa a ser a mais recente, enterrando a
 * pergunta que ele respondeu. O sim dele e a fronteira: o que vale e a ultima
 * coisa que EU disse antes dela.
 */
function pergunteiSobreCommit(caminho) {
  let linhas = []
  try { linhas = readFileSync(caminho, 'utf8').slice(-256_000).split('\n') } catch { return false }

  // acha a ultima mensagem de gente; a partir dela, sobe procurando minha fala
  let i = linhas.length - 1
  for (; i >= 0; i -= 1) {
    let l = null
    try { l = JSON.parse(linhas[i]) } catch { continue }
    if (l?.type === 'user' && !l?.isMeta && !l?.toolUseResult) break
  }
  for (i -= 1; i >= 0; i -= 1) {
    let l = null
    try { l = JSON.parse(linhas[i]) } catch { continue }
    if (l?.type !== 'assistant') continue
    const c = l?.message?.content
    const t = Array.isArray(c) ? c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n') : ''
    if (!t.trim()) continue
    return /\b(commit|comit)\w*\b/i.test(t) && /\?/.test(t)
  }
  return false
}

process.stderr.write(
  'COMMIT SEM ELE TER PEDIDO.\n\n'
  + `A ultima coisa que ele escreveu foi:\n  "${pedido.trim().slice(0, 160)}"\n\n`
  + 'Regra do arquivo de instrucoes dele: "Nunca commitar sem que eu peca\n'
  + 'explicitamente." Em 16/08 eu fiz mais de quinze commits num dia e ele pediu\n'
  + 'uma vez. Commit e a fronteira entre rascunho e historia do projeto, e quem\n'
  + 'decide atravessar e ele.\n\n'
  + 'O que fazer agora:\n'
  + '  1. Deixe o trabalho pronto e o `git add` feito, se ajudar.\n'
  + '  2. Termine a resposta mostrando o que mudou, e pergunte se pode commitar.\n\n'
  + '`git add`, `status`, `diff` e `log` continuam livres: preparar nao e\n'
  + 'atravessar. E `--amend` de mensagem tambem passa.\n',
)
process.exit(2)
