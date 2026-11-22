// segredo-guard — impede que arquivo de credencial seja lido pra dentro do contexto.
//
// Por que existe: o transcript de cada sessão fica em texto puro em
// ~/.claude/projects/<slug>/<session-id>.jsonl, sem criptografia e sem expiração.
// Na prática o vazamento não vem do Felipe digitar senha — vem do agente dar
// `cat .env` e despejar o arquivo inteiro no log, que depois é relido em cada
// --resume. Bloquear a leitura na origem custa quase nada e corta o vetor comum.
//
// O que ele NÃO faz: não desfaz envio. Uma vez que o texto entrou no prompt, já
// foi pra API. Este hook é prevenção, não conserto — segredo já exposto se
// resolve rotacionando.
//
// Princípios:
//   - FALHA ABERTA. Bug do hook libera a ação. Guard que trava trabalho por
//     defeito próprio é pior que o problema (mesma regra do rota-guard).
//   - .env.example e afins passam direto: são a forma certa de ver quais chaves
//     existem sem ver os valores.
//   - Escape: SEGREDO_GUARD=off no ambiente desliga tudo.

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

function liberar() { process.exit(0) }

/** Bloqueia: exit 2 devolve o stderr pro modelo como recusa da ferramenta. */
function bloquear(mensagem) {
  process.stderr.write(mensagem)
  process.exit(2)
}

function lerEntrada() {
  try { return JSON.parse(readFileSync(0, 'utf8')) } catch { return null }
}

// Ver as CHAVES é legítimo e frequente; ver os VALORES é o que vaza.
const MODELOS_SEGUROS = /^\.env\.(example|sample|template|defaults|schema|dist)$/i

/** Nome do arquivo -> rótulo do tipo de segredo, ou null se não for segredo. */
function tipoDeSegredo(bruto) {
  const limpo = String(bruto).replace(/^['"]+|['"]+$/g, '').replace(/\\/g, '/')
  let nome = limpo.split('/').pop() || ''
  // `git show HEAD:.env` passa o caminho depois de dois-pontos. Sem isto o nome
  // vira "HEAD:.env" e não casa regra nenhuma. O teste ignora "C:" do Windows,
  // que tem exatamente uma letra antes do dois-pontos.
  if (nome.includes(':')) {
    const depois = nome.slice(nome.lastIndexOf(':') + 1)
    if (depois && nome.lastIndexOf(':') > 1) nome = depois
  }
  if (!nome || MODELOS_SEGUROS.test(nome)) return null
  if (/^\.env$/i.test(nome) || /^\.env\./i.test(nome)) return 'arquivo .env'
  if (/^id_(rsa|dsa|ecdsa|ed25519)$/i.test(nome)) return 'chave SSH privada'
  if (/\.(pem|key|pfx|p12|jks|keystore|ppk)$/i.test(nome)) return 'chave ou certificado privado'
  if (/^(\.netrc|_netrc|\.npmrc|\.pypirc|\.git-credentials)$/i.test(nome)) return 'credencial de ferramenta'
  // O ponto inicial é obrigatório aqui: ~/.claude/.credentials.json guarda o
  // token de autenticação do próprio Claude Code, e a primeira versão desta
  // regra exigia o nome sem ponto — deixava justo esse arquivo passar.
  if (/^\.?credentials(\.json)?$/i.test(nome)) return 'arquivo de credenciais'
  if (/^secrets?\.(json|ya?ml|toml|env)$/i.test(nome)) return 'arquivo de segredos'
  if (/service[-_]?account.*\.json$/i.test(nome)) return 'service account do Google'
  if (/\.(kdbx|asc|gpg)$/i.test(nome)) return 'cofre ou chave criptografada'
  return null
}

// Só verbos que jogam conteúdo no stdout — é isso que cai no transcript.
// Escrever, copiar ou apagar um .env não vaza nada e continua liberado.
// ponytail: lista de verbos, não parser de shell. `node -e readFileSync('.env')`
// escapa. Sobe pra parser só se isso acontecer de verdade.
const VERBOS_DE_LEITURA = /(^|[\s;|&(`])(cat|bat|head|tail|less|more|nl|strings|xxd|od|type|gc|Get-Content|grep|rg|ag|ack|sed|awk|jq|yq|base64|source|python3?|node|ruby|perl|php)([\s(]|$)/i

// `git show HEAD:.env` e `git cat-file -p <blob>` imprimem o conteúdo versionado
// — mesmo vazamento que `cat`, por outra porta. Fica separado dos demais verbos
// porque `git` sozinho é inofensivo: só o subcomando que despeja conteúdo conta.
const GIT_QUE_LE = /\bgit\b[^|;&]*\b(show|cat-file|diff)\b/i

// Comandos que levam arquivo pro índice do git. Duas formas: caminho explícito
// (`git add .env`) e varredura (`git add .`, `-A`, `git commit -a`). A segunda é
// como o arquivo realmente entra — ninguém digita o nome do .env de propósito.
const GIT_INDEXA = /\bgit\s+(add|stage)\b/i
const GIT_COMMIT_TUDO = /\bgit\s+commit\b[^|;&\n]*(?:\s--all\b|\s-[a-z]*a[a-z]*(\s|$))/i
const GIT_VARRE = /\bgit\s+(add|stage)\b[^|;&\n]*(\s\.(\s|$)|\s-A\b|\s--all\b|\s-u\b|\s:\/)/i

/** Tira o que é TEXTO, não comando: heredoc e mensagem de commit. Sem isto, um
 *  commit que explique "não use `git show HEAD:.env`" bloqueia a si mesmo — foi
 *  exatamente o que aconteceu ao commitar este guard.
 *
 *  De propósito NÃO remove toda string entre aspas, como faz o git-add-guard:
 *  ali o alvo é a mensagem, aqui um caminho legítimo pode vir citado
 *  (`git add "config .env"`) e apagá-lo abriria um furo. */
function semTextoLivre(cmd) {
  return cmd
    .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?^\s*\1\s*$/gm, ' ')
    .replace(/(-m|--message)(\s+|=)'[^']*'/g, ' $1 msg ')
    .replace(/(-m|--message)(\s+|=)"[^"]*"/g, ' $1 msg ')
}

/** Pergunta ao git o que está pendente. O porcelain já respeita o .gitignore,
 *  então arquivo devidamente ignorado nunca chega aqui — e o alerta só aparece
 *  quando há algo pra alertar. */
function credenciaisPendentes(cwd) {
  if (!cwd) return []
  let saida
  try {
    saida = execFileSync('git', ['-C', cwd, 'status', '--porcelain'], { encoding: 'utf8', timeout: 5000 })
  } catch { return [] }   // sem git, sem repo, sem opinião

  const achados = []
  for (const linha of saida.split('\n')) {
    let caminho = linha.slice(3).trim()
    if (caminho.includes(' -> ')) caminho = caminho.split(' -> ').pop()   // rename
    caminho = caminho.replace(/^"|"$/g, '')
    if (!caminho) continue
    const tipo = tipoDeSegredo(caminho)
    if (tipo) achados.push(`${caminho}  [${tipo}]`)
  }
  return achados
}

const entrada = lerEntrada()
if (!entrada) liberar()
if (process.env.SEGREDO_GUARD === 'off') liberar()

const ferramenta = entrada.tool_name || ''
const args = entrada.tool_input || {}

let alvo = null
let tipo = null

if (ferramenta === 'Read' || ferramenta === 'Grep') {
  alvo = args.file_path || args.path || ''
  tipo = alvo ? tipoDeSegredo(alvo) : null
} else if (ferramenta === 'Bash') {
  const comando = semTextoLivre(String(args.command || ''))

  // `env` e `printenv` sozinhos despejam todas as variáveis do ambiente.
  if (/^\s*(env|printenv)\s*$/i.test(comando) || /Get-ChildItem\s+Env:\s*$/i.test(comando)) {
    bloquear(
`SEGREDO BLOQUEADO — despejo de variáveis de ambiente

\`${comando.trim()}\` imprime TODAS as variáveis, inclusive tokens, e o resultado
fica gravado em texto puro no transcript desta sessão.

Peça a variável específica: \`printenv NOME_DA_VAR\` (e mesmo assim, só se o
valor não for segredo).
`)
  }

  // Commitar credencial é pior que lê-la: o transcript é local e some com o
  // scrub, o commit vai pro remoto e fica no histórico pra sempre.
  if (GIT_INDEXA.test(comando) || GIT_COMMIT_TUDO.test(comando)) {
    const explicitos = []
    for (const pedaco of comando.split(/[\s;|&<>()`'"]+/)) {
      const achado = pedaco ? tipoDeSegredo(pedaco) : null
      if (achado) explicitos.push(`${pedaco}  [${achado}]`)
    }
    const pendentes = (GIT_VARRE.test(comando) || GIT_COMMIT_TUDO.test(comando))
      ? credenciaisPendentes(entrada.cwd)
      : []

    const lista = [...new Set([...explicitos, ...pendentes])]
    if (lista.length) {
      bloquear(
`CREDENCIAL PRESTES A ENTRAR NO GIT — bloqueado

${lista.map(l => '  ' + l).join('\n')}

Commit é pior que leitura: o transcript é local e o scrub limpa; o commit vai
pro remoto e fica no histórico pra sempre. Tirar depois exige reescrever a
história do repositório — ou rotacionar a credencial.

O que fazer:

    echo ".env" >> .gitignore        # o nome do arquivo que apareceu acima
    git add caminho/explicito.ts     # em vez de "git add ."

Se o arquivo JÁ estava rastreado, o .gitignore sozinho não basta:

    git rm --cached caminho/do/arquivo    # tira do índice, mantém no disco

Se este arquivo é template sem valor real, renomeie pra .env.example — o guard
libera esse nome de propósito.

Consciente e necessário? SEGREDO_GUARD=off no ambiente.
`)
    }
  }

  // Avalia POR SEGMENTO, não o comando inteiro. Em
  // `git check-ignore .credentials.json | head -2` o `head` lê a saída do git,
  // não o arquivo — juntar os dois num bloco só bloqueava comando inocente, e
  // falso positivo diário é como um guard acaba desligado.
  // ponytail: separa por pipe e encadeamento, não é parser de shell. Nome de
  // arquivo contendo `;` escaparia; se isso virar real, aí sim vale um parser.
  for (const segmento of comando.split(/\|\||&&|[|;\n]/)) {
    if (!VERBOS_DE_LEITURA.test(segmento) && !GIT_QUE_LE.test(segmento)) continue
    for (const pedaco of segmento.split(/[\s<>()`'"]+/)) {
      const achado = pedaco ? tipoDeSegredo(pedaco) : null
      if (achado) { alvo = pedaco; tipo = achado; break }
    }
    if (tipo) break
  }
}

if (!tipo) liberar()

bloquear(
`SEGREDO BLOQUEADO — leitura de ${tipo}

Alvo: ${alvo}

O conteúdo desse arquivo iria parar em texto puro no transcript
(~/.claude/projects/<projeto>/<session-id>.jsonl), que é relido inteiro a cada
--resume. Uma vez lá, o segredo só sai rotacionando a credencial.

Caminhos que continuam abertos:
  - Ler o .env.example do projeto pra saber QUAIS chaves existem.
  - Referenciar a variável pelo nome (process.env.X) sem nunca ler o valor.
  - Precisa do valor real? Ele fica no servidor, não aqui — use a skill /vps.

Se esta leitura for mesmo necessária e consciente, o Felipe libera rodando o
Claude Code com SEGREDO_GUARD=off no ambiente.
`)
