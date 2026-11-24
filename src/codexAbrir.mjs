/**
 * CC-1131, entrega 4 do plano docs/CC-codex.md: abrir uma sessão do Codex em projeto, pelo cockpit.
 *
 * Mesmo desenho do Claude (src/remotecontrol.mjs, que esta peça não toca): o botão abre o `codex` de terminal num
 * tmux `cc-codex-<projeto>` na VPS e num terminal do WezTerm no PC, dentro da pasta do projeto, e o texto da resposta
 * é digitado nesse mesmo terminal. O Codex grava a sessão na pasta de sempre (`~/.codex/sessions`), e `src/codex.mjs`
 * já a enxerga.
 *
 * Medido em 23/11/2026 na VPS (codex-cli 0.171.0, pasta de teste, nenhum projeto real):
 * - `-s read-only` e `-s workspace-write` funcionam dentro da caixa da VPS (o `codex sandbox` provou: lê tudo, grava só
 *   na pasta do projeto e recusa gravar fora dela). `danger-full-access` não foi preciso e esta peça não o usa.
 * - Pasta nova: o Codex abre a tela "Folder access" (Trust and continue). A chave com ponto
 *   (`-c projects."<pasta>".trust_level=...`) deixa a pergunta aparecer; a tabela inteira
 *   `-c 'projects={"<pasta>"={trust_level="trusted"}}'` a pula e não escreve no `config.toml`. Se a pergunta aparecer
 *   mesmo assim, a opção é escolhida pelo texto da tela, com o cursor conferido antes do Enter.
 * - Versão nova disponível abre uma tela onde o Enter padrão roda `npm install -g`: `check_for_update_on_startup=false`
 *   evita, e se ela aparecer a sessão é fechada com o motivo.
 * - O Codex cria `~/.codex/thread-writer-locks/<id>.lock` na hora em que abre, antes de qualquer mensagem. A trava que
 *   nasce depois do tmux é o id da sessão, e é por ele que a resposta acha o terminal.
 *
 * Resposta que cai numa tela de pergunta (aprovação) fica sem digitar: o Enter ali aprova coisa. Sai a recusa em
 * palavras comuns. Aprovar pelo cockpit é a entrega 3 do plano e ainda não existe.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import {
  ehWindows, abrirTerminalPainel, listarTerminais, lerTerminal, escreverTerminal, apertarTerminal, fecharTerminal,
} from './platform.mjs'
import { binarioCodex, casaCodex, ID_CODEX } from './codex.mjs'
import { dirCaixas } from './ouvido.mjs'

export const PREFIXO_CODEX = 'cc-codex-'
/** A proteção da sessão: escreve só na pasta do projeto. Medido que funciona na VPS. CC_CODEX_SANDBOX troca por read-only. */
export const SANDBOX_CODEX = 'workspace-write'
const SANDBOXES = ['read-only', 'workspace-write']

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const tmuxReal = (args, ms = 8000) => new Promise((resolve) => {
  execFile('tmux', args, { encoding: 'utf8', timeout: ms, maxBuffer: 4 * 1024 * 1024 },
    (erro, saida, err) => resolve(erro ? { ok: false, out: String(saida || err || erro.message || '').trim() } : { ok: true, out: saida }))
})
const padrao = () => ({
  tmux: tmuxReal, espera, windows: ehWindows,
  wez: { abrir: abrirTerminalPainel, listar: listarTerminais, ler: lerTerminal, escrever: escreverTerminal, apertar: apertarTerminal, fechar: fecharTerminal },
})

export const nomeCodex = (projeto, n = 1) => PREFIXO_CODEX + String(projeto).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50) + (n > 1 ? `-${n}` : '')

/** O sandbox em uso: só os dois medidos; qualquer outro valor cai no padrão. */
export const sandboxCodex = () => (SANDBOXES.includes(process.env.CC_CODEX_SANDBOX) ? process.env.CC_CODEX_SANDBOX : SANDBOX_CODEX)

/**
 * Os argumentos do `codex` para uma sessão do cockpit. A pasta entra como texto literal do TOML (aspas simples), então
 * a barra invertida do Windows dispensa escape; aspas simples e quebra de linha na pasta são recusadas.
 */
export function argsCodex(cwd, { sandbox = sandboxCodex() } = {}) {
  if (!cwd || /['\r\n\0]/.test(cwd)) throw new Error('pasta com aspas simples ou quebra de linha não serve para abrir o Codex')
  return [
    '-c', 'check_for_update_on_startup=false',
    '-c', `projects={'${cwd}'={trust_level="trusted"}}`,
    '-s', sandbox,
    '-a', 'on-request',
  ]
}

/** O programa mais os argumentos, sem shell. O `.js` do npm roda pelo Node do próprio painel (ver binarioCodex). */
export function comandoCodex(bin, cwd, opcoes) {
  const resto = argsCodex(cwd, opcoes)
  return /\.(c|m)?js$/i.test(bin) ? [process.execPath, bin, ...resto] : [bin, ...resto]
}

/* ───────────────────────────── a tela do Codex ───────────────────────────── */

const linhasDe = (tela) => String(tela || '').split('\n')
const OPCAO_COM_CURSOR = /^\s*[›>]\s*\d+\./

/** Que pergunta do programa está na tela? `null` quando é a tela normal. Pura, para o teste cobrir sem terminal. */
export function perguntaDaTela(tela) {
  const t = String(tela || '')
  if (/Trust and continue/i.test(t)) return 'confianca'
  if (/Update now/i.test(t) && /Skip/i.test(t)) return 'atualizacao'
  return null
}

/** Na pergunta de confiança: 'confirmar' (cursor no "Trust and continue"), 'descer' (está na tela, cursor noutra) ou 'sem-opcao'. */
export function passoDaConfiancaCodex(tela) {
  const ls = linhasDe(tela)
  const cursor = ls.find((l) => OPCAO_COM_CURSOR.test(l)) || ''
  if (/Trust and continue/i.test(cursor)) return 'confirmar'
  if (ls.some((l) => /Trust and continue/i.test(l))) return 'descer'
  return 'sem-opcao'
}

/** A tela está no campo normal de escrever, sem pergunta aberta? Só então o texto pode ser digitado. */
export function prontaParaTexto(tela) {
  const t = String(tela || '')
  const campo = linhasDe(t).some((l) => /^\s*[›>]\s/.test(l) && !OPCAO_COM_CURSOR.test(l))
  const pergunta = perguntaDaTela(t) || /enter (to )?(continue|confirm|select)|press enter|esc to (cancel|go back)|Yes, proceed|Allow (once|always)|\(y\/n\)/i.test(t)
  return campo && !pergunta
}

const ultimasLinhas = (tela, n = 6) => linhasDe(tela).map((l) => l.trim()).filter(Boolean).slice(-n).join(' / ') || '(vazia)'

/* ───────────────────────────── o registro de quem mora onde ───────────────────────────── */

const arquivoTerminais = () => path.join(path.dirname(dirCaixas()), 'codex-terminais.json')

export function lerTerminaisCodex() {
  try { const o = JSON.parse(fs.readFileSync(arquivoTerminais(), 'utf8')); return o && typeof o === 'object' ? o : {} } catch { return {} }
}
function gravarTerminaisCodex(o) {
  try {
    const arq = arquivoTerminais()
    fs.mkdirSync(path.dirname(arq), { recursive: true })
    const tmp = `${arq}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(o, null, 1))
    fs.renameSync(tmp, arq)
    return true
  } catch { return false } // sem o registro, a resposta cai no palpite por pasta e depois na fila: o pedido não se perde
}

const pastaTravas = () => path.join(casaCodex(), 'thread-writer-locks')
const travasAgora = () => {
  try {
    return new Map(fs.readdirSync(pastaTravas()).filter((f) => /\.lock$/.test(f) && ID_CODEX.test(f.slice(0, -5)))
      .map((f) => [f.slice(0, -5), fs.statSync(path.join(pastaTravas(), f)).mtimeMs]))
  } catch { return new Map() }
}

/** Os terminais do Codex que estão vivos agora, pelo registro: nome -> { nome, id, cwd, desde, painel }. */
export async function terminaisVivosCodex(deps = {}) {
  const D = { ...padrao(), ...deps }
  const reg = lerTerminaisCodex()
  const out = {}
  if (D.windows) {
    if (!Object.keys(reg).length) return out // nenhum aberto por aqui: nem pergunta ao WezTerm
    const lista = await D.wez.listar({ falhaNula: true })
    if (lista === null) return out // não consegui perguntar ao WezTerm: não afirmo que morreu
    const abertos = new Set(lista.map((t) => String(t.painel)))
    for (const [nome, r] of Object.entries(reg)) if (r.painel && abertos.has(String(r.painel))) out[nome] = { nome, ...r }
    return out
  }
  const r = await D.tmux(['list-sessions', '-F', '#{session_name}'])
  if (!r.ok) return out
  const vivos = new Set(r.out.split('\n').map((l) => l.trim()).filter(Boolean))
  for (const [nome, v] of Object.entries(reg)) if (vivos.has(nome)) out[nome] = { nome, ...v }
  // sessão `cc-codex-` viva sem registro (registro perdido): entra sem id e sem pasta
  for (const nome of vivos) if (nome.startsWith(PREFIXO_CODEX) && !out[nome]) out[nome] = { nome, id: null, cwd: null }
  return out
}

/* ───────────────────────────── abrir ───────────────────────────── */

const SEM_PROGRAMA = 'o Codex não está instalado nesta máquina: instale com "npm install -g @openai/codex", entre com a conta (codex login) e abra a sessão de novo'
const SEM_LOGIN = 'o Codex desta máquina não está logado: rode "codex login" nela e abra a sessão de novo'

/**
 * Abre o Codex na pasta do projeto. Devolve `{ ok, ja, sessao, rotulo, cwd, ferramenta: 'codex', sandbox, conversa, tela }`
 * ou `{ ok: false, erro }` em palavras comuns. Não espera a sessão terminar.
 */
export async function abrirCodex(projeto, cwd, { mais = false, esperarMs = 5000, bin = binarioCodex(), deps = {} } = {}) {
  const D = { ...padrao(), ...deps }
  if (!cwd || !fs.existsSync(cwd)) return { ok: false, erro: `pasta não existe: ${cwd}` }
  if (!bin) return { ok: false, erro: SEM_PROGRAMA }
  if (!fs.existsSync(path.join(casaCodex(), 'auth.json'))) return { ok: false, erro: SEM_LOGIN }
  let comando
  try { comando = comandoCodex(bin, cwd) } catch (e) { return { ok: false, erro: e.message } }

  const ativos = await terminaisVivosCodex(deps)
  const existente = ativos[nomeCodex(projeto)]
  if (existente && !mais) return { ok: true, ja: true, ferramenta: 'codex', sessao: existente.nome, rotulo: existente.nome, cwd: existente.cwd || cwd, conversa: existente.id || null }
  let rotulo = null
  for (let n = 1; n <= 20 && !rotulo; n++) if (!ativos[nomeCodex(projeto, n)]) rotulo = nomeCodex(projeto, n)
  if (!rotulo) return { ok: false, erro: `já há 20 sessões do Codex abertas em ${projeto}` }

  const nascimento = Date.now()
  const antes = travasAgora()
  let painel = null
  let ler
  let apertar
  let fechar
  let vivo
  if (D.windows) {
    const a = await D.wez.abrir({ cwd, comando })
    if (!a.ok) return { ok: false, erro: a.erro || 'o WezTerm não abriu o terminal' }
    painel = a.painel
    ler = async () => (await D.wez.ler(painel)) || ''
    apertar = (tecla) => D.wez.apertar(painel, tecla)
    fechar = () => D.wez.fechar(painel)
    vivo = async () => (await D.wez.listar()).some((t) => String(t.painel) === String(painel))
  } else {
    // Argumentos em lista: nada passa por shell, então nome de projeto com aspas não vira comando.
    const r = await D.tmux(['new-session', '-d', '-s', rotulo, '-c', cwd, '-x', '160', '-y', '45', ...comando])
    if (!r.ok) return { ok: false, erro: `o tmux não abriu a sessão: ${r.out || 'ele está instalado?'}` }
    ler = async () => (await D.tmux(['capture-pane', '-t', rotulo, '-p', '-S', '-200'])).out || ''
    apertar = (tecla) => D.tmux(['send-keys', '-t', rotulo, tecla])
    fechar = () => D.tmux(['kill-session', '-t', rotulo])
    vivo = async () => (await D.tmux(['has-session', '-t', rotulo])).ok
  }

  await D.espera(esperarMs)
  let tela = await ler()
  const pergunta = perguntaDaTela(tela)
  if (pergunta === 'confianca') {
    for (let i = 0; i < 4 && passoDaConfiancaCodex(tela) === 'descer'; i += 1) {
      await apertar('Down')
      await D.espera(400)
      tela = await ler()
    }
    if (passoDaConfiancaCodex(tela) !== 'confirmar') {
      await fechar()
      return { ok: false, erro: 'o Codex parou na pergunta de confiança da pasta e não achei a opção "Trust and continue" na tela; nada foi confirmado. Última tela: ' + ultimasLinhas(tela) }
    }
    await apertar('Enter')
    await D.espera(2500)
    tela = await ler()
  } else if (pergunta === 'atualizacao') {
    await fechar() // nesta tela o Enter padrão roda `npm install -g`, então a sessão fecha sem apertar nada
    return { ok: false, erro: 'o Codex parou numa tela de atualização e não abri a sessão. Atualize o Codex nesta máquina ou escolha "Skip" nele e abra de novo. Última tela: ' + ultimasLinhas(tela) }
  }
  if (!(await vivo())) return { ok: false, erro: 'o Codex fechou logo ao abrir. Última tela: ' + ultimasLinhas(tela) }

  // O id da sessão é a trava nova que o Codex criou ao abrir. Com mais de uma, vale a mais próxima do nascimento.
  const novas = [...travasAgora()].filter(([id]) => !antes.has(id)).sort((a, b) => Math.abs(a[1] - nascimento) - Math.abs(b[1] - nascimento))
  const id = novas[0]?.[0] || null
  const reg = lerTerminaisCodex()
  reg[rotulo] = { id, cwd, desde: nascimento, ...(painel ? { painel } : {}) }
  gravarTerminaisCodex(reg)
  /* Medido no PC em 23/11: o Codex abre uma tela própria ("Hooks need review", confiar nos ganchos do usuário) que o
     painel não conhece. Decidir isso é dele, então a sessão fica aberta, nada é apertado, e o aviso diz onde responder. */
  const aviso = prontaParaTexto(tela) ? null : 'o Codex abriu, mas está esperando uma resposta no terminal dele antes de aceitar texto: ' + ultimasLinhas(tela, 4)
  return { ok: true, ja: false, ferramenta: 'codex', sessao: rotulo, rotulo, cwd, sandbox: sandboxCodex(), desde: nascimento, conversa: id, aviso, tela: linhasDe(tela).filter((l) => l.trim()).slice(-12).join('\n') }
}

/** Fecha a sessão do Codex deste nome (o botão encerrar) e tira do registro. */
export async function fecharCodex(nome, { deps = {} } = {}) {
  const D = { ...padrao(), ...deps }
  if (!String(nome).startsWith(PREFIXO_CODEX)) return { ok: false, erro: 'esse nome não é de uma sessão do Codex' }
  const reg = lerTerminaisCodex()
  const r = reg[nome]
  if (D.windows) { if (r?.painel) await D.wez.fechar(r.painel) } else await D.tmux(['kill-session', '-t', nome])
  if (r) { delete reg[nome]; gravarTerminaisCodex(reg) }
  return { ok: true }
}

/* ───────────────────────────── responder ───────────────────────────── */

const mesmaPasta = (a, b) => String(a || '').replace(/[\\/]+$/, '').toLowerCase() === String(b || '').replace(/[\\/]+$/, '').toLowerCase()

/**
 * Digita a resposta no terminal onde a sessão do Codex mora. Devolve `null` quando a sessão não mora num terminal
 * aberto pelo painel (quem chama cai no `codex queue`), `{ ok: true, entregue: 'terminal' }` quando digitou, ou
 * `{ ok: false, erro }` quando mora, mas a tela está numa pergunta e digitar ali seria aprovar sem querer.
 * `cwd` é a pasta da sessão, para achar o terminal quando o registro não guardou o id.
 */
export async function responderNoTerminal(id, texto, { cwd = null, deps = {} } = {}) {
  const D = { ...padrao(), ...deps }
  const alvoId = String(id || '').toLowerCase()
  const vivos = Object.values(await terminaisVivosCodex(deps))
  let alvo = vivos.find((v) => v.id && String(v.id).toLowerCase() === alvoId)
  if (!alvo && cwd) {
    const palpites = vivos.filter((v) => !v.id && (!v.cwd || mesmaPasta(v.cwd, cwd)))
    if (palpites.length === 1) alvo = palpites[0] // só quando é uma: com duas na mesma pasta a resposta podia ir para a errada
  }
  if (!alvo) return null

  const ler = D.windows ? async () => (await D.wez.ler(alvo.painel)) || '' : async () => (await D.tmux(['capture-pane', '-t', alvo.nome, '-p'])).out || ''
  const tela = await ler()
  if (!prontaParaTexto(tela)) {
    return { ok: false, terminal: alvo.nome, erro: 'a sessão do Codex está numa pergunta no terminal dela (aprovação ou confirmação), então não digitei nada. Responda lá primeiro. Tela: ' + ultimasLinhas(tela, 4) }
  }
  if (D.windows) {
    await D.wez.escrever(alvo.painel, texto)
    await D.espera(300)
    await D.wez.apertar(alvo.painel, 'Enter')
  } else {
    // -l manda o texto literal, sem o tmux interpretar nome de tecla. O Enter vai depois de uma pausa: texto e Enter
    // colados parecem um "colar" para o Codex, que então trata o Enter como quebra de linha e não envia.
    await D.tmux(['send-keys', '-t', alvo.nome, '-l', texto])
    await D.espera(300)
    await D.tmux(['send-keys', '-t', alvo.nome, 'Enter'])
  }
  return { ok: true, entregue: 'terminal', terminal: alvo.nome }
}
