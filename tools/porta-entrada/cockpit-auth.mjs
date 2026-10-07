// Porta de entrada autenticada do Agent Cockpit.
//
// Fica na frente do painel (5180) e só deixa passar quem tem sessão válida.
// Escrito como camada separada de proposito: nao toca em uma linha do codigo
// do Cockpit, entao nao conflita com quem estiver mexendo no repo, e sai do
// caminho apagando um arquivo se der errado.
//
// Decisoes:
// - Senha guardada como hash scrypt com sal. O arquivo nunca guarda a senha.
// - Sessao e um token de 32 bytes em cookie HttpOnly + Secure + SameSite=Lax,
//   com validade de 90 dias sem uso, renovada a cada acesso (CC-924): e o que faz o celular "ficar logado".
// - Revogacao e server-side: apagar a sessao do arquivo derruba o dispositivo
//   no ato, mesmo com o cookie ainda no aparelho. Cookie assinado sozinho nao
//   permitiria isso, e o pedido era justamente poder deslogar remotamente.
// - Atraso progressivo por IP depois de 3 erros, pra que a senha nao possa ser
//   descoberta por tentativa e erro.

import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
// CC-869: o segundo fator (código do autenticador do Deploy seguro), opcional e conferido por ele
import { lerFlag, verificarNoServico, textoDoMotivo } from './segundo-fator.mjs'
// CC-933: instalado, o registro de auditoria fica ao lado (./auditoria.mjs, copiado pelo instalar.sh); no repositório mora em ../auditoria/
const { registrar } = await import(new URL(fs.existsSync(new URL('./auditoria.mjs', import.meta.url)) ? './auditoria.mjs' : '../auditoria/auditoria.mjs', import.meta.url).href)
// CC-859: manifesto, ícone e service worker para instalar a página de religar como app (mesmo esquema: ao lado, ou em ../app-seguranca/)
const APP = await import(new URL(fs.existsSync(new URL('./app-seguranca.mjs', import.meta.url)) ? './app-seguranca.mjs' : '../app-seguranca/app-seguranca.mjs', import.meta.url).href)
const PECAS_RELIGAR = APP.pecas('religar')
// CC-932: avisos de queda no celular (Web Push) e o vigia que os dispara; irmãos deste arquivo, no repositório e instalados
import * as PUSH from './push.mjs'
import { criarVigia, lerSites } from './vigia.mjs'

const PORTA = Number(process.env.COCKPIT_AUTH_PORT || 5181)
const ALVO = Number(process.env.COCKPIT_ALVO_PORT || 5180)
// Segundo destino: o escritorio (fork do Pixel Agents) em /escritorio/, atras da
// mesma senha. Fica aqui e nao no nginx porque o nginx exige root, e este
// arquivo nao — trocar de porta e reiniciar o servico resolve.
const ESCRITORIO = Number(process.env.COCKPIT_ESCRITORIO_PORT || 3101)
// A forma canonica e sem acento; as outras duas existem porque digitar
// "escritório" no celular e o reflexo natural, e o navegador manda ora o
// caractere cru, ora percent-encoded.
const PREFIXO_ESCRITORIO = '/escritorio'
const PREFIXOS_ESCRITORIO = ['/escritorio', '/escritório', '/escrit%C3%B3rio']
// Terceiro destino: a conversa do opencode (`opencode serve`) em /opencode/,
// atras da mesma senha, pelo mesmo motivo do escritorio: o nginx exige root.
const OPENCODE = Number(process.env.COCKPIT_OPENCODE_PORT || 5182)
const PREFIXO_OPENCODE = '/opencode'
// Diferenca em relacao ao escritorio: o front do opencode resolve tudo em
// caminho ABSOLUTO (`/assets/...`, `/api/session`), entao tirar o prefixo nao
// basta — o navegador pediria /assets ao painel. Duas redes pegam isso:
//
// 1. Referer: todo pedido disparado de dentro da pagina /opencode/ carrega
//    Referer com esse caminho. Cobre asset, fetch e SSE sem depender de lista.
// 2. Lista de rotas: rede de seguranca para pedido sem Referer. So e segura
//    porque as rotas dos dois nao colidem em NENHUM nome — conferido em
//    17/08 comparando o /doc do opencode com as 65 rotas do painel: as 16
//    sub-rotas de /api do opencode (session, agent, event…) nao existem no
//    painel, e as 47 do painel (cockpit, roadmap, jobs…) nao existem no
//    opencode. Se um dia colidirem, o Referer ainda decide certo, e o
//    prejuizo fica numa rota nova do painel indo parar no lugar errado.
// Quarto destino: o agy (Antigravity), que so tem linha de comando. O `ttyd`
// transforma o comando numa pagina, e a pagina fica em /agy/.
//
// Ele NAO precisa de nada do que o opencode precisou acima: o `ttyd` sobe com
// `--base-path /agy` e ja monta todo endereco, inclusive o WebSocket, com o
// prefixo dentro. Por isso o caminho vai intacto para ele, sem tirar prefixo.
//
// Motivo de existir separado, achado testando com o Felipe em 18/08: o terminal
// do opencode e um painel escondido DENTRO da tela dele, sem endereco proprio.
// O botao criava o terminal do agy certinho (tres deles, rodando), mas largava
// o Felipe na conversa do opencode, e ele nunca via o agy. Palavras dele:
// "quando eu clico no AGY, ele vai pra uma janela de terminal e abre o OPENCODE
// na verdade, ele nao abre o agy". Tela separada resolve a causa, e de quebra a
// segunda queixa: para de misturar os dois no mesmo lugar.
const AGY = Number(process.env.COCKPIT_AGY_PORT || 5183)
const PREFIXO_AGY = '/agy'

// Quinto destino: o terminal da propria VPS, em /terminal/. Mesmo `ttyd` do
// agy, mesma regra de caminho intacto, so que o comando e o shell dele.
//
// Por que existe, 24/08: ele ficou travado no telefone sem conseguir rodar um
// comando com senha de administrador. Ele PODE virar administrador nesta
// maquina; faltava o lugar de digitar. Sem isto, toda pendencia que precisa de
// `sudo` espera ele chegar num computador, e foi assim que quatro delas
// ficaram paradas nove dias.
//
// A escolha dele foi o terminal COMPLETO, com `sudo` continuando a pedir senha:
// assim a senha do painel nao e a unica coisa entre alguem e o controle desta
// VPS, que hospeda cinco sites de cliente no ar. Nao troque por `NOPASSWD`.
const TERMINAL = Number(process.env.COCKPIT_TERMINAL_PORT || 5184)
const PREFIXO_TERMINAL = '/terminal'
const ROTAS_OPENCODE = [
  '/assets', '/doc', '/auth', '/agent', '/command', '/config', '/event',
  '/experimental', '/file', '/find', '/formatter', '/global', '/instance',
  '/log', '/lsp', '/mcp', '/path', '/permission', '/project', '/provider',
  '/pty', '/question', '/session', '/skill', '/sync', '/tui', '/vcs', '/model',
]
const SUBROTAS_API_OPENCODE = [
  'agent', 'command', 'credential', 'event', 'fs', 'health', 'integration',
  'location', 'model', 'permission', 'provider', 'pty', 'question',
  'reference', 'session', 'skill',
]
const CASA = os.homedir()
const ARQ_SENHA = path.join(CASA, '.cockpit-auth.json')
const ARQ_SESSOES = path.join(CASA, '.cockpit-sessions.json')
const ANO_MS = 365 * 24 * 60 * 60 * 1000
/* CC-924, decisão dele em 06/10: a sessão vale 90 dias SEM USO e cada acesso empurra a
   validade de novo. Quem decide é o servidor; o cookie no navegador continua com 1 ano
   só para não sumir antes da conta do servidor. Celular perdido para de valer em até 90 dias. */
const VALIDADE_MS = 90 * 24 * 60 * 60 * 1000

// ---------- senha ----------

function hashear(senha, sal) {
  return crypto.scryptSync(senha, sal, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
}

function lerSenha() {
  try {
    return JSON.parse(fs.readFileSync(ARQ_SENHA, 'utf8'))
  } catch {
    return null
  }
}

export function definirSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex')
  const dados = { sal, hash: hashear(senha, sal), em: Date.now() }
  fs.writeFileSync(ARQ_SENHA, JSON.stringify(dados), { mode: 0o600 })
  return dados
}

function senhaConfere(senha) {
  const d = lerSenha()
  if (!d) return false
  const tentativa = Buffer.from(hashear(senha, d.sal), 'hex')
  const guardado = Buffer.from(d.hash, 'hex')
  // timingSafeEqual exige mesmo tamanho; hash tem tamanho fixo, mas o guard
  // evita excecao se o arquivo for editado na mao.
  if (tentativa.length !== guardado.length) return false
  return crypto.timingSafeEqual(tentativa, guardado)
}

// Marca "trocar na proxima entrada", ligada por `cockpit-auth provisoria` ou
// `cockpit-auth trocar`. Enquanto ela estiver de pe, quem entra so alcanca a
// tela de definir senha nova: o painel inteiro fica atras dela.
//
// Existe porque a troca precisava acontecer NO SITE, e nao no terminal: assim a
// senha definitiva e digitada por ele no telefone e nunca passa por chat, por
// historico de shell nem por linha de comando nenhuma. `definirSenha` grava o
// objeto do zero, sem este campo, entao a marca morre sozinha na troca — nao
// existe um segundo lugar que precise lembrar de apaga-la.
function precisaTrocar() {
  const d = lerSenha()
  return !!(d && d.trocar)
}

// ---------- sessoes ----------

function lerSessoes() {
  try {
    const d = JSON.parse(fs.readFileSync(ARQ_SESSOES, 'utf8'))
    return d && typeof d === 'object' ? d : {}
  } catch {
    return {}
  }
}

function gravarSessoes(s) {
  fs.writeFileSync(ARQ_SESSOES, JSON.stringify(s, null, 1), { mode: 0o600 })
}

function criarSessao(req) {
  const token = crypto.randomBytes(32).toString('hex')
  const s = lerSessoes()
  s[token] = {
    criadaEm: Date.now(),
    expiraEm: Date.now() + VALIDADE_MS,
    ua: String(req.headers['user-agent'] || '').slice(0, 120),
    ip: ipDe(req),
    ultimoUso: Date.now(),
  }
  gravarSessoes(s)
  return token
}

function sessaoValida(token) {
  if (!token) return false
  const s = lerSessoes()
  const d = s[token]
  if (!d) return false
  if (d.expiraEm && d.expiraEm < Date.now()) {
    delete s[token]
    gravarSessoes(s)
    return false
  }
  // marca uso no maximo uma vez por hora, pra nao escrever em disco a cada request
  if (Date.now() - (d.ultimoUso || 0) > 3600e3) {
    d.ultimoUso = Date.now()
    d.expiraEm = Date.now() + VALIDADE_MS // usar renova: só expira quem fica 90 dias sem entrar
    gravarSessoes(s)
  }
  return true
}

// Trocar a senha derruba os outros aparelhos e mantem o de quem trocou: senao
// a troca feita no telefone deslogaria o proprio telefone no instante seguinte,
// e ele cairia numa tela de login pedindo uma senha que acabou de nascer.
function revogarOutras(token) {
  const s = lerSessoes()
  let n = 0
  for (const t of Object.keys(s)) {
    if (t !== token) {
      delete s[t]
      n++
    }
  }
  gravarSessoes(s)
  return n
}

export function revogarTudo() {
  const n = Object.keys(lerSessoes()).length
  gravarSessoes({})
  return n
}

export function revogarUma(token) {
  const s = lerSessoes()
  if (!s[token]) return false
  delete s[token]
  gravarSessoes(s)
  return true
}

export function listarSessoes() {
  const s = lerSessoes()
  return Object.entries(s).map(([token, d]) => ({
    id: token.slice(0, 12),
    criadaEm: d.criadaEm,
    expiraEm: d.expiraEm,
    ultimoUso: d.ultimoUso,
    ua: d.ua,
    ip: d.ip,
  }))
}

// ---------- religar a VPS por fora (Contabo) ----------
//
// Pedido dele em 02/09, depois da queda: alem de proteger a memoria (ja feito
// em prioridade-oom.sh), ele quer um jeito de religar a VPS mesmo que ela
// esteja tao travada que nada DENTRO dela responda. A unica forma real de
// fazer isso e nao depender da VPS: usar a API da propria Contabo (quem aluga
// a maquina), que reinicia por fora, como se apertasse o botao fisico.
//
// Duas travas, pedidas por ele, nenhuma opcional:
// - senha do painel de novo, mesmo com sessao valida: nao basta o celular
//   estar logado, tem que digitar a senha NA HORA de religar;
// - so age se houver sinal real de problema (memoria/swap no limite, ou o
//   painel principal nao respondendo) — sem isso, devolve o motivo e nao
//   chama a Contabo. Cooldown de 24h por cima, pra nenhum erro de clique (ou
//   de heuristica) religar a maquina em loop.
//
// So chama a ACAO DE RESTART da Contabo, nunca reinstalacao/reset — sao
// endpoints diferentes na API delas. Nao adicione outra acao aqui sem
// conferir a documentacao: um nome errado pode reinstalar a maquina do zero,
// apagando os sites de cliente que rodam nela.
const ARQ_CONTABO = path.join(CASA, '.contabo-api.json')
const ARQ_RELIGAR = path.join(CASA, '.cockpit-religar.json')
const LOG_RELIGAR = path.join(CASA, 'logs', 'religar-vps.log')
const COOLDOWN_RELIGAR_MS = 24 * 60 * 60 * 1000
// as duas são sobrescritas só nos testes, que apontam para um Contabo de mentira
const CONTABO_AUTH_URL = process.env.COCKPIT_CONTABO_AUTH_URL || 'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token'
const CONTABO_API_URL = process.env.COCKPIT_CONTABO_API_URL || 'https://api.contabo.com/v1'

function lerContabo() {
  try {
    const d = JSON.parse(fs.readFileSync(ARQ_CONTABO, 'utf8'))
    if (!d.clientId || !d.clientSecret || !d.apiUser || !d.apiPassword || !d.instanceId) return null
    return d
  } catch {
    return null
  }
}

function lerEstadoReligar() {
  try {
    return JSON.parse(fs.readFileSync(ARQ_RELIGAR, 'utf8'))
  } catch {
    return { ultimoDisparoEm: 0 }
  }
}

function gravarEstadoReligar(d) {
  fs.writeFileSync(ARQ_RELIGAR, JSON.stringify(d), { mode: 0o600 })
}

function logReligar(linha) {
  // CC-933: o mesmo fato vai para o registro central ("EXECUTADO ip=1.2.3.4 motivo=..." vira ok, de e detalhe)
  const m = /^(\w+) ip=(\S*)\s*(.*)$/.exec(linha)
  if (m) registrar({ acao: 'religar-vps', quem: 'dono', de: m[2], alvo: 'vps', ok: m[1] === 'EXECUTADO', detalhe: (m[1] === 'EXECUTADO' ? '' : m[1].toLowerCase() + ' ') + m[3] })
  try {
    fs.mkdirSync(path.dirname(LOG_RELIGAR), { recursive: true })
    fs.appendFileSync(LOG_RELIGAR, `${new Date().toISOString()} ${linha}\n`)
  } catch {
    // log e so auditoria; falha nele nunca pode travar a acao de verdade
  }
}

// Le memoria e swap direto do kernel — sem depender de nenhum processo
// externo, pra continuar respondendo mesmo com a maquina pesada.
function saudeMemoria() {
  const texto = fs.readFileSync('/proc/meminfo', 'utf8')
  const valor = (chave) => {
    const m = texto.match(new RegExp(`^${chave}:\\s+(\\d+)`, 'm'))
    return m ? Number(m[1]) : null
  }
  const total = valor('MemTotal')
  const disponivel = valor('MemAvailable')
  const swapTotal = valor('SwapTotal')
  const swapLivre = valor('SwapFree')
  return {
    memDisponivelPct: total ? Math.round((disponivel / total) * 1000) / 10 : null,
    swapUsadoPct: swapTotal ? Math.round(((swapTotal - swapLivre) / swapTotal) * 1000) / 10 : 0,
  }
}

// O sinal mais direto de problema, e o mesmo que aconteceu em 02/09: a porta
// de entrada (esta aqui) responde, mas o painel principal atras dela nao.
async function painelResponde() {
  try {
    const r = await fetch(`http://127.0.0.1:${ALVO}/`, { signal: AbortSignal.timeout(3000) })
    return r.status < 500
  } catch {
    return false
  }
}

/**
 * Decide se o botao pode agir agora. Duas travas independentes: cooldown de
 * 24h (sempre, mesmo com problema real) e sinal de problema (sempre, mesmo
 * fora do cooldown). As duas precisam estar do lado favoravel. Sem bypass:
 * se nao ha sinal de problema, o botao fica bloqueado, ponto.
 */
async function podeReligar() {
  const memoria = saudeMemoria()
  const painelOk = await painelResponde()
  const problema =
    (memoria.memDisponivelPct !== null && memoria.memDisponivelPct < 10) ||
    memoria.swapUsadoPct > 70 ||
    !painelOk
  const estado = lerEstadoReligar()
  const desdeUltimo = Date.now() - (estado.ultimoDisparoEm || 0)
  const emCooldown = desdeUltimo < COOLDOWN_RELIGAR_MS
  return {
    memoria, painelOk, problema, emCooldown,
    cooldownRestanteMs: emCooldown ? COOLDOWN_RELIGAR_MS - desdeUltimo : 0,
    pode: problema && !emCooldown,
  }
}

async function tokenContabo(cfg) {
  const corpo = new URLSearchParams({
    client_id: cfg.clientId, client_secret: cfg.clientSecret,
    username: cfg.apiUser, password: cfg.apiPassword, grant_type: 'password',
  })
  const r = await fetch(CONTABO_AUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: corpo, signal: AbortSignal.timeout(10000),
  })
  const dados = await r.json().catch(() => ({}))
  if (!r.ok || !dados.access_token) {
    throw new Error(`login na Contabo falhou (${r.status}): ${dados.error_description || dados.error || 'sem detalhe'}`)
  }
  return dados.access_token
}

// So leitura: confirma credencial e instanceId sem tocar no estado da maquina.
async function instanciaContabo(cfg, token) {
  const r = await fetch(`${CONTABO_API_URL}/compute/instances/${cfg.instanceId}`, {
    headers: { authorization: `Bearer ${token}`, 'x-request-id': crypto.randomUUID() },
    signal: AbortSignal.timeout(10000),
  })
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Contabo devolveu ${r.status}: ${JSON.stringify(dados).slice(0, 300)}`)
  return dados?.data?.[0] || dados
}

// UNICA acao destrutiva daqui: reiniciar. Nunca troque por reset/reinstall.
async function restartContabo(cfg, token) {
  const r = await fetch(`${CONTABO_API_URL}/compute/instances/${cfg.instanceId}/actions/restart`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'x-request-id': crypto.randomUUID() },
    signal: AbortSignal.timeout(10000),
  })
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Contabo recusou o restart (${r.status}): ${JSON.stringify(dados).slice(0, 300)}`)
  return dados
}

const PAGINA_RELIGAR = (estado, msg, configurado) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Religar a VPS — Ogumia</title>${APP.cabecaApp('religar')}
<style>${ESTILO}
  .caixa { width:min(92vw,420px); display:grid; gap:14px }
  .linha { display:flex; justify-content:space-between; font-size:13px; color:#c9d1d9 }
  .ok { color:#3fb950 } .mau { color:#ff7b72 }
  .msg { padding:10px 12px; border-radius:8px; font-size:13px; background:#14171c; border:1px solid #2a2f38 }
  .chk { display:flex; gap:8px; align-items:center; font-size:13px; color:#c9d1d9 }
  .chk input { width:auto }
  /* Botao desligado tem que PARECER desligado. Sem isto ele sai igualzinho ao
     que funciona (mesmo azul, mesmo tamanho), e a tela promete uma acao que
     nao vai acontecer. Ele viu isso no primeiro print: perguntou "o que eu
     faco?" olhando um botao vivo que estava morto. */
  button:disabled { background:#21262d; color:#6e7681; cursor:not-allowed;
                    border:1px solid #2a2f38 }
</style></head>
<body><div class="caixa">
  <h1>${MARCA('mReligar')}Religar a VPS</h1>
  <p class="nota">Isto chama a Contabo por fora da maquina. So funciona se
  houver sinal real de problema, e no maximo uma vez por 24h.</p>
  ${msg ? `<p class="msg">${msg}</p>` : ''}
  ${!configurado ? `<p class="msg">Ainda sem a credencial da Contabo. Os quatro
    primeiros campos estao todos numa tela so:
    <a href="https://my.contabo.com/api/details" target="_blank"
       rel="noopener">my.contabo.com/api/details</a>.</p>
  <p class="msg">⚠️ A <b>senha da API</b> NAO e a senha com que voce entra na
    Contabo: e uma senha propria, que voce cria naquela mesma tela clicando em
    <b>Send Link</b> — eles mandam um email com o link para definir. Isso e bom:
    a sua senha principal nao fica guardada aqui.</p>
  <form method="POST" action="/__religar/credencial">
    <label for="cid">Client Id</label>
    <input id="cid" type="text" name="clientId" autocomplete="off" required>
    <label for="csec">Client Secret</label>
    <input id="csec" type="password" name="clientSecret" autocomplete="off" required>
    <label for="cuser">API User (o email da sua conta Contabo)</label>
    <input id="cuser" type="email" name="apiUser" autocomplete="off" required>
    <label for="cpass">API Password (a que voce criou pelo Send Link)</label>
    <input id="cpass" type="password" name="apiPassword" autocomplete="off" required>
    <label for="cinst">numero da VPS (ja preenchido)</label>
    <input id="cinst" type="text" name="instanceId" value="203388091" required>
    <button type="submit">salvar e testar</button>
    <p class="nota">Fica gravado so nesta maquina, em arquivo que so voce le, e
    nunca aparece de volta nesta tela.</p>
  </form>` : `
  <div class="linha"><span>memoria disponivel</span>
    <span class="${estado.memoria.memDisponivelPct < 10 ? 'mau' : 'ok'}">${estado.memoria.memDisponivelPct}%</span></div>
  <div class="linha"><span>swap em uso</span>
    <span class="${estado.memoria.swapUsadoPct > 70 ? 'mau' : 'ok'}">${estado.memoria.swapUsadoPct}%</span></div>
  <div class="linha"><span>painel principal responde</span>
    <span class="${estado.painelOk ? 'ok' : 'mau'}">${estado.painelOk ? 'sim' : 'nao'}</span></div>
  <div class="linha"><span>sinal de problema agora</span>
    <span class="${estado.problema ? 'mau' : 'ok'}">${estado.problema ? 'sim' : 'nao — botao fica bloqueado'}</span></div>
  ${estado.emCooldown ? `<div class="linha"><span>cooldown</span>
    <span class="mau">espera mais ${Math.ceil(estado.cooldownRestanteMs / 3600e3)}h</span></div>` : ''}
  <form method="POST" action="/__religar/testar">
    <button type="submit">testar credenciais (seguro, nao reinicia nada)</button>
  </form>
  <form method="POST" action="/__religar/executar" autocomplete="off">
    ${estado.pode
      ? '<p class="nota">A VPS esta com problema agora. Digite a senha e marque a caixa para religar.</p>'
      : `<p class="nota">O botao abaixo esta DESLIGADO, e nada aqui reinicia nada.
         ${estado.emCooldown
           ? 'Motivo: ja houve um religamento nas ultimas 24h.'
           : 'Motivo: a VPS esta saudavel agora. Ele liga sozinho quando houver problema de verdade.'}
         Pode fechar a pagina a vontade.</p>`}
    <input type="password" name="senha" placeholder="senha do painel, digitada agora"
           autocomplete="new-password" autocorrect="off" autocapitalize="off"
           spellcheck="false" required${estado.pode ? '' : ' disabled'}>
    ${lerFlag().ativo ? `<input type="text" name="codigo" placeholder="código do autenticador" inputmode="numeric"
           pattern="[0-9 ]{6,7}" maxlength="7" autocomplete="one-time-code" autocorrect="off"
           spellcheck="false" required${estado.pode ? '' : ' disabled'}>` : ''}
    <label class="chk"><input type="checkbox" name="confirmo" required
      ${estado.pode ? '' : 'disabled'}>
      confirmo que quero religar a VPS agora</label>
    <button type="submit"${estado.pode ? '' : ' disabled'}>religar a VPS agora</button>
  </form>`}
</div></body></html>`

// ---------- utilitarios ----------

const ipDe = (req) =>
  String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0]
    .trim()

function cookieDe(req, nome) {
  const cru = req.headers.cookie || ''
  for (const p of cru.split(';')) {
    const [k, ...v] = p.trim().split('=')
    if (k === nome) return decodeURIComponent(v.join('='))
  }
  return null
}

// atraso progressivo por IP: 3 erros liberados, depois 2s, 4s, 8s... ate 30s
const erros = new Map()
function penalidadeMs(ip) {
  const n = erros.get(ip) || 0
  if (n < 3) return 0
  return Math.min(30000, 2000 * 2 ** (n - 3))
}

// Um estilo so para as duas telas: a de entrar e a de trocar. Separado porque
// duplicar CSS aqui ja significaria as duas telas divergirem no telefone dele
// sem ninguem perceber.
const ESTILO = `
  :root { color-scheme: dark light }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
         background:#0d0f12; color:#e6e6e6 }
  form { width:min(92vw,360px); display:grid; gap:14px }
  h1 { font-size:15px; letter-spacing:.22em; text-transform:uppercase;
       font-weight:600; margin:0 0 4px; color:#8ab4f8 }
  input { padding:13px 14px; font:inherit; border-radius:9px;
          border:1px solid #2a2f38; background:#14171c; color:inherit }
  input:focus { outline:2px solid #8ab4f8; outline-offset:1px; border-color:transparent }
  button { padding:13px; font:inherit; font-weight:600; border:0; border-radius:9px;
           background:#8ab4f8; color:#0d0f12; cursor:pointer }
  .erro { color:#ff7b72; font-size:13px; margin:0 }
  .nota { color:#7d8590; font-size:12px; margin:0 }
  label { color:#7d8590; font-size:12px; margin:0 0 -8px }
`

// A marca (o capacete do ícone do app, que ele gosta) para as telas desta porta. Viseira vazada
// por máscara, sem quadrado; o id da máscara é único por página para não colidir.
const MARCA = (id) => `<svg viewBox="84 68 344 304" width="30" height="27" aria-hidden="true" style="vertical-align:middle;margin-right:10px"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/><rect x="118" y="176" width="276" height="150" rx="62" fill="#000"/><path d="M156 300L232 196H266L190 300Z" fill="#fff"/><path d="M204 300L280 196H300L224 300Z" fill="#fff"/></mask></defs><path mask="url(#${id})" fill="#3B82F6" d="M256 74a166 166 0 0 1 166 166v92a34 34 0 0 1-34 34H124a34 34 0 0 1-34-34v-92A166 166 0 0 1 256 74z"/></svg>`

// o campo do código do autenticador: só aparece quando o segundo fator está ligado
const CAMPO_CODIGO = `<input type="text" name="codigo" placeholder="código do autenticador" inputmode="numeric"
         pattern="[0-9 ]{6,7}" maxlength="7" autocomplete="one-time-code" autocorrect="off" spellcheck="false" required>`

/* CC-952: para onde voltar depois do login. Só caminho deste site, começando por uma barra
   e nunca por duas (//outro.site seria um desvio para fora), sem as rotas da própria porta. */
const voltaSegura = (v) => (typeof v === 'string' && /^\/(?![\/\\])[\w\-./%?=&]*$/.test(v) && v.length < 300 && !v.startsWith('/__login') && !v.startsWith('/__logout') ? v : '/')

const PAGINA_LOGIN = (erro, comCodigo = false, volta = '/') => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ogumia</title>
<style>${ESTILO}</style></head>
<body><form method="POST" action="/__login">
  <h1>${MARCA('mLogin')}Ogumia</h1>
  ${erro ? `<p class="erro">${erro}</p>` : ''}
  <input type="password" name="senha" placeholder="senha" autofocus
         autocomplete="current-password" required>
  ${comCodigo ? CAMPO_CODIGO : ''}
  <input type="hidden" name="volta" value="${voltaSegura(volta).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">
  <button type="submit">entrar</button>
  <p class="nota">Este dispositivo fica lembrado enquanto você usar; 90 dias sem entrar, ele pede a senha de novo. Dá pra deslogar
  remotamente a qualquer momento.</p>
</form></body></html>`

// A tela que aparece no lugar do painel enquanto a marca de troca estiver de
// pe. O campo escondido com `autocomplete="username"` existe para o gerenciador
// de senhas do celular entender que os dois campos abaixo sao a senha NOVA, e
// oferecer guardar — sem ele o Chrome do Android trata como login e sugere a
// senha velha, que e justamente a que esta sendo aposentada.
const PAGINA_TROCA = (erro) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nova senha — Ogumia</title>
<style>${ESTILO}</style></head>
<body><form method="POST" action="/__senha">
  <h1>${MARCA('mTroca')}Nova senha</h1>
  <p class="nota">A senha com que você entrou era provisória. Escolha a
  definitiva agora: o painel só abre depois disso.</p>
  ${erro ? `<p class="erro">${erro}</p>` : ''}
  <input type="text" name="usuario" value="cockpit" autocomplete="username"
         hidden readonly>
  <label for="nova">nova senha, no mínimo 10 caracteres</label>
  <input id="nova" type="password" name="nova" placeholder="nova senha" autofocus
         autocomplete="new-password" minlength="10" required>
  <label for="confirma">repita para conferir</label>
  <input id="confirma" type="password" name="confirma" placeholder="repita a senha"
         autocomplete="new-password" minlength="10" required>
  <button type="submit">salvar e abrir o painel</button>
  <p class="nota">Salvar desloga os outros aparelhos e mantém este.</p>
</form></body></html>`

// ---------- proxy ----------

// Decide destino e caminho de um pedido. O escritorio e servido sob /escritorio/
// e recebe o caminho JA sem o prefixo: ele nao sabe que mora num subcaminho, e
// nao precisa saber. O front dele resolve os assets em caminho relativo
// (`base: './'` no Vite) e o WebSocket a partir do diretorio da propria pagina.
function prefixoEscritorioDe(url) {
  return PREFIXOS_ESCRITORIO.find((p) => url === p || url.startsWith(p + '/')) || null
}

function casaPrefixo(url, p) {
  return url === p || url.startsWith(p + '/') || url.startsWith(p + '?')
}

// Pedido nasceu de dentro da pagina do opencode? Vale para asset, fetch e SSE.
function veioDoOpencode(req) {
  const ref = req?.headers?.referer || ''
  if (!ref) return false
  try {
    return casaPrefixo(new URL(ref).pathname, PREFIXO_OPENCODE)
  } catch {
    return false
  }
}

function rotaDoOpencode(url) {
  const caminho = url.split('?')[0]
  if (ROTAS_OPENCODE.some((p) => casaPrefixo(caminho, p))) return true
  const parte = caminho.split('/')
  return parte[1] === 'api' && SUBROTAS_API_OPENCODE.includes(parte[2])
}

function destinoDe(url, req) {
  const prefixo = prefixoEscritorioDe(url)
  if (prefixo) {
    return { porta: ESCRITORIO, path: url.slice(prefixo.length) || '/', servico: 'agent-escritorio' }
  }
  if (casaPrefixo(url, PREFIXO_AGY)) {
    return { porta: AGY, path: url, servico: 'agy' }
  }
  if (casaPrefixo(url, PREFIXO_TERMINAL)) {
    return { porta: TERMINAL, path: url, servico: 'terminal' }
  }
  if (casaPrefixo(url, PREFIXO_OPENCODE)) {
    return { porta: OPENCODE, path: url.slice(PREFIXO_OPENCODE.length) || '/', servico: 'opencode' }
  }
  if (veioDoOpencode(req) || rotaDoOpencode(url)) {
    return { porta: OPENCODE, path: url, servico: 'opencode' }
  }
  return { porta: ALVO, path: url, servico: 'agent-cockpit' }
}

function repassar(req, res, token) {
  const alvo = destinoDe(req.url, req)
  const opcoes = {
    hostname: '127.0.0.1',
    port: alvo.porta,
    path: alvo.path,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${alvo.porta}` },
  }
  const up = http.request(opcoes, (r) => {
    // Carimbo de quem atendeu. Com tres destinos atras da mesma porta, sem
    // isto so da pra descobrir o destino adivinhando pelo conteudo — e o
    // painel fala de opencode, entao adivinhar erra.
    res.writeHead(r.statusCode || 502, { ...r.headers, 'x-cockpit-destino': alvo.servico })
    r.pipe(res)
  })
  up.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('painel fora do ar (porta ' + alvo.porta + '). veja: journalctl -u ' + alvo.servico)
  })
  req.pipe(up)
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const token = cookieDe(req, 'cockpit_sess')

  if (url.pathname === '/__login' && req.method === 'POST') {
    const ip = ipDe(req)
    let corpo = ''
    req.on('data', (c) => {
      corpo += c
      if (corpo.length > 4096) req.destroy()
    })
    req.on('end', () => {
      const form = new URLSearchParams(corpo)
      const senha = form.get('senha') || ''
      const codigo = form.get('codigo') || ''
      const volta = voltaSegura(form.get('volta'))
      const espera = penalidadeMs(ip)
      setTimeout(async () => {
        if (senhaConfere(senha)) {
          /* CC-869: com o segundo fator ligado, a SENHA vem primeiro (quem não a sabe não gasta
             tentativa do código) e só então o código, perguntado ao serviço do administrador.
             Sem sessão criada enquanto o código não passar. */
          const f = lerFlag()
          if (f.ativo) {
            const v = await verificarNoServico({ finalidade: 'login', codigo, porta: f.porta })
            if (!v.ok) {
              registrar({ acao: 'login', quem: 'dono', de: ip, aparelho: req.headers['user-agent'], ok: false, detalhe: 'senha certa, código recusado: ' + (v.motivo || 'recusado') })
              res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' })
              return res.end(PAGINA_LOGIN(textoDoMotivo(v), true, volta))
            }
          }
          erros.delete(ip)
          const t = criarSessao(req)
          registrar({ acao: 'login', quem: 'dono', de: ip, aparelho: req.headers['user-agent'], ok: true, alvo: 'sessão ' + t.slice(0, 12), detalhe: f.ativo ? 'com código do autenticador' : 'só senha' })
          res.writeHead(302, {
            location: precisaTrocar() ? '/__senha' : volta,
            'set-cookie': `cockpit_sess=${t}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ANO_MS / 1000}`,
          })
          return res.end()
        }
        erros.set(ip, (erros.get(ip) || 0) + 1)
        registrar({ acao: 'login', quem: 'desconhecido', de: ip, aparelho: req.headers['user-agent'], ok: false, detalhe: `senha incorreta (${erros.get(ip)} seguidas deste endereço)` })
        res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' })
        res.end(PAGINA_LOGIN('senha incorreta', lerFlag().ativo, volta))
      }, espera)
    })
    return
  }

  if (url.pathname === '/__logout') {
    if (token && revogarUma(token)) registrar({ acao: 'logout', quem: 'dono', de: ipDe(req), aparelho: req.headers['user-agent'], ok: true, alvo: 'sessão ' + token.slice(0, 12) })
    res.writeHead(302, {
      location: '/',
      'set-cookie': 'cockpit_sess=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    })
    return res.end()
  }

  // Federacao: maquina falando com maquina, com o token proprio dela no
  // cabecalho x-cc-token — nunca vai ter o cookie de sessao de navegador. O
  // painel de verdade (porta 5180) ja confere esse token sozinho antes de
  // aceitar o pacote (403 sem federacao ligada, 401 com token errado), e e
  // exatamente por isso que so este caminho, so POST, passa direto sem pedir
  // sessao aqui. Achado em 18/08 (PC): o proprio painel ja documentava essa
  // intencao no comentario da rota, e esta porta nunca tinha sido ajustada
  // pra cumprir — federacao de maquina nunca funcionou por causa disso.
  if (url.pathname === '/api/federacao' && req.method === 'POST') {
    return repassar(req, res, token)
  }

  // As pecas que o telefone precisa buscar SEM estar logado.
  //
  // Medido em 22/08, depois de ele instalar no Chrome do Android e receber um
  // atalho de site em vez de um app. Localmente o painel passa em tudo: o
  // Chrome devolve zero erro de manifesto e zero erro de instalacao
  // (Page.getAppManifest e Page.getInstallabilityErrors, os dois vazios). Pelo
  // dominio de verdade, com a senha na frente, o mundo recebe 401 e HTML em
  // TODAS as pecas, inclusive nos icones.
  //
  // Isso quebra a instalacao porque quem monta o aplicativo do Android nao e o
  // telefone dele: o Chrome manda o manifesto para um servidor da Google, e
  // esse servidor baixa os icones da internet publica, sem o cookie dele. Sem
  // icone, a montagem falha, e o Chrome cai para o atalho, que abre no
  // navegador com barra de endereco. E exatamente o sintoma que ele descreveu.
  //
  // So entram aqui coisas sem nenhum dado: tres desenhos e o manifesto, que
  // carrega o nome do app e o nome de duas telas. Autorizado por ele em 22/08,
  // com essa exposicao dita antes. A pagina, as rotas e todo o dado continuam
  // exigindo a senha, e o app instalado abre pedindo login.
  //
  // Lista exata, nunca prefixo: '/icone' como prefixo abriria qualquer coisa
  // que comecasse assim, hoje ou depois.
  const PECAS_DO_APP = ['/app.webmanifest', '/icone.svg', '/icone-192.png', '/icone-512.png']
  if (PECAS_DO_APP.includes(url.pathname) && (req.method === 'GET' || req.method === 'HEAD')) {
    return repassar(req, res, token)
  }

  // CC-859: as peças do app "Religar VPS" (manifesto, ícones, service worker), pelo mesmo
  // motivo das de cima: o Chrome busca sem o cookie. Lista exata, sem dado nenhum; a
  // página /__religar e todas as rotas dela continuam exigindo sessão.
  if (APP.servirPeca('religar', PECAS_RELIGAR, req, res, url.pathname)) return

  if (!sessaoValida(token)) {
    // pedido de API sem sessao devolve 401 seco, nao a pagina de login:
    // senao o fetch do painel tentaria interpretar HTML como JSON.
    if (url.pathname.startsWith('/api/') || url.pathname === '/events') {
      res.writeHead(401, { 'content-type': 'application/json' })
      return res.end('{"error":"nao autenticado"}')
    }
    res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(PAGINA_LOGIN(null, lerFlag().ativo, url.pathname + url.search))
  }

  // Senha marcada para troca: daqui em diante, com sessao valida, o unico lugar
  // que responde e a tela de definir a nova. Vem DEPOIS da checagem de sessao de
  // proposito — quem ainda nao entrou tem que ver o login, nunca a troca, senao
  // qualquer um na internet trocaria a senha do painel.
  //
  // A saida continua liberada: ficar preso numa tela sem porta de saida e o
  // formato de defeito que este projeto mais repete.
  if (precisaTrocar() && url.pathname !== '/__senha' && url.pathname !== '/__logout') {
    if (url.pathname.startsWith('/api/') || url.pathname === '/events') {
      res.writeHead(403, { 'content-type': 'application/json' })
      return res.end('{"error":"senha provisoria: defina a definitiva em /__senha"}')
    }
    res.writeHead(302, { location: '/__senha' })
    return res.end()
  }

  if (url.pathname === '/__senha') {
    // Sem marca de troca a tela nao existe: ela e o remedio de uma situacao
    // especifica, e deixa-la de pe o tempo todo seria uma segunda porta para a
    // senha, sem pedir a senha atual.
    if (!precisaTrocar()) {
      res.writeHead(302, { location: '/' })
      return res.end()
    }
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(PAGINA_TROCA(null))
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
      return res.end('metodo nao aceito')
    }
    let corpo = ''
    req.on('data', (c) => {
      corpo += c
      if (corpo.length > 4096) req.destroy()
    })
    req.on('end', () => {
      const p = new URLSearchParams(corpo)
      const nova = p.get('nova') || ''
      const confirma = p.get('confirma') || ''
      // A terceira recusa e a que importa: sem ela daria para "trocar" repetindo
      // a provisoria, a marca cairia, e a senha fraca ficaria valendo para
      // sempre parecendo que a troca aconteceu.
      const erro =
        nova.length < 10 ? 'a senha nova precisa de pelo menos 10 caracteres'
        : nova !== confirma ? 'as duas nao são iguais'
        : senhaConfere(nova) ? 'essa é a provisória, escolha uma diferente'
        : null
      if (erro) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
        return res.end(PAGINA_TROCA(erro))
      }
      definirSenha(nova)
      const outras = revogarOutras(token)
      registrar({ acao: 'senha-trocada', quem: 'dono', de: ipDe(req), aparelho: req.headers['user-agent'], ok: true, detalhe: `${outras} outro(s) aparelho(s) deslogado(s)` })
      res.writeHead(302, { location: '/' })
      res.end()
    })
    return
  }

  /* CC-932: os avisos no celular. Rotas DA PORTA, nao do painel: nunca chegam ao proxy, e ja
   * estao atras da sessao (o bloco de cima). Quem inscreve e o aparelho logado; a chave publica
   * VAPID e o que o navegador pede para criar a inscricao. POST so com JSON: um formulario de
   * outro site nao consegue montar esse pedido. */
  if (url.pathname.startsWith('/__push/')) {
    const json = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)) }
    const rota = url.pathname.slice('/__push/'.length)
    if (rota === 'chave' && req.method === 'GET') return json(200, { chave: PUSH.chavePublica() })
    if ((rota === 'inscrever' || rota === 'teste') && req.method === 'POST') {
      if (!/^application\/json/i.test(req.headers['content-type'] || '')) return json(415, { erro: 'envie JSON' })
      let corpo = ''
      req.on('data', (c) => { corpo += c; if (corpo.length > 8192) req.destroy() })
      req.on('end', async () => {
        if (rota === 'teste') {
          const r = await PUSH.enviar('teste: os avisos chegam aqui', 'toque para abrir o painel')
          registrar({ acao: 'push-teste', quem: 'dono', de: ipDe(req), ok: r.enviados > 0, detalhe: `${r.enviados} enviado(s), ${r.removidos} removido(s), ${r.falhas} falha(s)` })
          return json(200, { ...r, inscritos: PUSH.inscricoes().length })
        }
        try {
          const n = PUSH.inscrever(JSON.parse(corpo))
          registrar({ acao: 'push-inscricao', quem: 'dono', de: ipDe(req), aparelho: req.headers['user-agent'], ok: true, detalhe: `${n} aparelho(s) inscrito(s)` })
          json(200, { ok: true, inscritos: n })
        } catch (e) { json(400, { erro: e.message }) }
      })
      return
    }
    return json(rota === 'chave' || rota === 'inscrever' || rota === 'teste' ? 405 : 404, { erro: 'rota de avisos desconhecida' })
  }

  /* Com barra no fim TAMBEM vale, e nao e capricho: o navegador do celular
   * acrescenta essa barra sozinho (por historico, por autocompletar, por
   * atalho salvo na tela inicial). Sem isto o pedido escorrega para o painel
   * principal, que nao conhece este endereco, e ele recebe um
   * `{"error":"not found"}` cru na cara — sem pista nenhuma de que a diferenca
   * era um caractere. Aconteceu com ele em 10/09, minutos depois de a tela
   * comecar a funcionar. */
  if ((url.pathname === '/__religar' || url.pathname === '/__religar/') && req.method === 'GET') {
    const cfg = lerContabo()
    if (!cfg) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(PAGINA_RELIGAR(null, null, false))
    }
    podeReligar().then((estado) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(PAGINA_RELIGAR(estado, null, true))
    })
    return
  }

  /* Grava a credencial da Contabo pela TELA, e nao pelo terminal.
   *
   * Motivo, dito por ele em 10/09: o caminho anterior era abrir o terminal do
   * cockpit no celular, digitar um JSON de cinco campos no `nano` e acertar
   * chave, virgula e aspas com o teclado do telefone. Ele le e opera isto no
   * celular, quase sempre na rua.
   *
   * A credencial NUNCA volta para a tela: o formulario so aparece enquanto o
   * arquivo nao existe, e o que ja foi gravado nao e relido para preencher
   * campo nenhum. Trocar exige apagar o arquivo, de proposito — senha de conta
   * que a propria pagina sabe repetir e senha que vaza no primeiro print. */
  if (url.pathname === '/__religar/credencial' && req.method === 'POST') {
    let corpo = ''
    req.on('data', (c) => { corpo += c; if (corpo.length > 8192) req.destroy() })
    req.on('end', async () => {
      const p = new URLSearchParams(corpo)
      const cfg = {
        clientId: (p.get('clientId') || '').trim(),
        clientSecret: (p.get('clientSecret') || '').trim(),
        apiUser: (p.get('apiUser') || '').trim(),
        apiPassword: p.get('apiPassword') || '',
        instanceId: (p.get('instanceId') || '').trim(),
      }
      const faltando = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k)
      if (faltando.length) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
        return res.end(PAGINA_RELIGAR(null, `faltou preencher: ${faltando.join(', ')}`, false))
      }
      /* Testa ANTES de gravar: credencial errada gravada em silencio viraria um
       * botao que so falha na hora em que ele precisa dele, que e o pior
       * momento possivel para descobrir. */
      try {
        const tok = await tokenContabo(cfg)
        const inst = await instanciaContabo(cfg, tok)
        fs.writeFileSync(ARQ_CONTABO, JSON.stringify(cfg, null, 1), { mode: 0o600 })
        logReligar(`CREDENCIAL GRAVADA ip=${ipDe(req)} instancia=${cfg.instanceId}`)
        const estado = await podeReligar()
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(PAGINA_RELIGAR(estado,
          `credencial conferida e gravada. a Contabo ve a maquina como "${inst.status || inst.displayName || 'sem status'}".`, true))
      } catch (e) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(PAGINA_RELIGAR(null, `nao gravei, porque a Contabo recusou: ${e.message}`, false))
      }
    })
    return
  }

  if (url.pathname === '/__religar/testar' && req.method === 'POST') {
    const cfg = lerContabo()
    if (!cfg) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(PAGINA_RELIGAR(null, 'ainda sem credencial configurada', false))
    }
    tokenContabo(cfg).then((tok) => instanciaContabo(cfg, tok)).then(async (inst) => {
      const estado = await podeReligar()
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(PAGINA_RELIGAR(estado, `credencial ok. a Contabo ve a maquina como "${inst.status || inst.displayName || 'sem status'}".`, true))
    }).catch(async (e) => {
      const estado = await podeReligar()
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(PAGINA_RELIGAR(estado, `teste falhou: ${e.message}`, true))
    })
    return
  }

  if (url.pathname === '/__religar/executar' && req.method === 'POST') {
    let corpo = ''
    req.on('data', (c) => { corpo += c; if (corpo.length > 4096) req.destroy() })
    req.on('end', async () => {
      const p = new URLSearchParams(corpo)
      const senha = p.get('senha') || ''
      const ip = ipDe(req)
      const cfg = lerContabo()
      if (!cfg) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        return res.end(PAGINA_RELIGAR(null, 'ainda sem credencial configurada', false))
      }
      const estado = await podeReligar()
      if (!senhaConfere(senha)) {
        logReligar(`RECUSADO ip=${ip} motivo=senha-errada`)
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        return res.end(PAGINA_RELIGAR(estado, 'senha incorreta', true))
      }
      /* CC-869: o código do autenticador, depois da senha e ANTES de qualquer outra coisa que
         gaste o cooldown ou chame a Contabo. Recusa por falha do serviço também (falha fechada). */
      const f2 = lerFlag()
      if (f2.ativo) {
        const v = await verificarNoServico({ finalidade: 'religar', codigo: p.get('codigo') || '', porta: f2.porta })
        if (!v.ok) {
          logReligar(`RECUSADO ip=${ip} motivo=codigo-${v.motivo || 'recusado'}`)
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
          return res.end(PAGINA_RELIGAR(estado, textoDoMotivo(v), true))
        }
      }
      if (!estado.pode) {
        const motivo = estado.emCooldown ? 'cooldown de 24h ainda ativo' : 'nenhum sinal de problema agora'
        logReligar(`RECUSADO ip=${ip} motivo=${motivo}`)
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        return res.end(PAGINA_RELIGAR(estado, `nao religado: ${motivo}`, true))
      }
      try {
        const tok = await tokenContabo(cfg)
        await restartContabo(cfg, tok)
        gravarEstadoReligar({ ultimoDisparoEm: Date.now() })
        logReligar(`EXECUTADO ip=${ip} memDisponivel=${estado.memoria.memDisponivelPct}% swap=${estado.memoria.swapUsadoPct}% painelOk=${estado.painelOk}`)
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(PAGINA_RELIGAR(estado, 'reinicio disparado pela Contabo. a VPS deve voltar em poucos minutos.', true))
      } catch (e) {
        logReligar(`FALHOU ip=${ip} erro=${e.message}`)
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(PAGINA_RELIGAR(estado, `falha ao religar: ${e.message}`, true))
      }
    })
    return
  }

  // Sem a barra final o navegador resolveria os assets relativos contra a raiz
  // (/assets/... em vez de /escritorio/assets/...) e a pagina viria em branco.
  // Manda tambem as grafias com acento pra forma canonica, pra que o endereco
  // que fica no historico do navegador seja sempre o mesmo.
  if (PREFIXOS_ESCRITORIO.includes(req.url)) {
    res.writeHead(302, { location: PREFIXO_ESCRITORIO + '/' })
    return res.end()
  }

  // Mesmo motivo do escritorio: sem a barra final o Referer da pagina fica em
  // /opencode (sem barra) e continua batendo, mas o endereco no historico
  // varia. Uma forma so.
  if (req.url === PREFIXO_OPENCODE) {
    res.writeHead(302, { location: PREFIXO_OPENCODE + '/' })
    return res.end()
  }

  if (req.url === PREFIXO_AGY) {
    res.writeHead(302, { location: PREFIXO_AGY + '/' })
    return res.end()
  }

  if (req.url === PREFIXO_TERMINAL) {
    res.writeHead(302, { location: PREFIXO_TERMINAL + '/' })
    return res.end()
  }

  repassar(req, res, token)
})

// ---------- WebSocket ----------
//
// Sem isto o escritorio (Pixel Agents) fica com a tela branca: a pagina carrega
// por HTTP normal, mas o socket que traz os bonecos morre aqui na porta de
// entrada. Achado em 14/08 — o nginx repassa Upgrade certo, o painel na 5180
// tambem, e faltava so este pedaco no meio.
//
// A sessao e exigida igual ao HTTP: WebSocket que nao pede senha seria um
// buraco do tamanho do painel inteiro, com a porta 5180 escutando so em
// 127.0.0.1 justamente para isso nao existir.
servidor.on('upgrade', (req, socket, head) => {
  // Com troca pendente o socket cai junto com o resto: deixar so ele passar
  // manteria os bonecos do escritorio andando por tras de uma tela que diz que
  // o painel esta fechado.
  if (!sessaoValida(cookieDe(req, 'cockpit_sess')) || precisaTrocar()) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    return socket.destroy()
  }

  const alvo = destinoDe(req.url, req)
  const up = http.request({
    hostname: '127.0.0.1',
    port: alvo.porta,
    path: alvo.path,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${alvo.porta}` },
  })
  up.end()

  up.on('upgrade', (r, socket2, head2) => {
    socket.write(`HTTP/1.1 101 ${r.statusMessage || 'Switching Protocols'}\r\n`
      + Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')
      + '\r\n\r\n')
    if (head2?.length) socket.write(head2)
    socket2.pipe(socket)
    socket.pipe(socket2)
    const fim = () => { socket.destroy(); socket2.destroy() }
    socket.on('error', fim); socket2.on('error', fim)
    socket.on('close', fim); socket2.on('close', fim)
  })
  up.on('error', () => socket.destroy())
})

// mantem conexoes SSE (/events) vivas: sem isso o Node derruba em 2 minutos
servidor.timeout = 0
servidor.keepAliveTimeout = 0
servidor.headersTimeout = 0

if (!lerSenha()) {
  console.error('SEM SENHA DEFINIDA. Rode: cockpit-auth senha "<sua senha>"')
  process.exit(1)
}

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`porta de entrada do cockpit em 127.0.0.1:${PORTA} -> ${ALVO}`)
  if (precisaTrocar()) {
    console.log('TROCA DE SENHA PENDENTE: o painel so abre depois de definir a definitiva na tela.')
  }
  // CC-932: o vigia de quedas, o unico temporizador do projeto. COCKPIT_VIGIA=off desliga.
  if (process.env.COCKPIT_VIGIA !== 'off') {
    criarVigia({
      alvos: () => [{ nome: 'painel', url: `http://127.0.0.1:${ALVO}/` }, ...lerSites()],
      avisar: PUSH.enviar, registrar,
    }).iniciar()
    console.log('vigia de quedas ligado (a cada 60 s)')
  }
})
