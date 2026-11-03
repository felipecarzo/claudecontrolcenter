/**
 * CC-1081: o navegador do "roteiro de uso", falado por CDP (o protocolo do Chrome).
 *
 * Roda no PROCESSO FILHO, com `node --experimental-websocket`: o Node 20 do painel
 * não tem `WebSocket`, e o protocolo do Chrome pede. Mesmo caminho do `gateFotos.mjs`.
 *
 * O navegador é só os olhos e as mãos. Quem decide o que clicar é o mapa (sem IA)
 * ou o agente (com um cérebro trocável). Aqui não há método, só quatro verbos:
 * ir, observar, clicar, voltar (e rolar e tirar foto).
 *
 * Por que a `assinatura` é pelo CONTEÚDO e não pelo endereço: o Nexus (o painel do
 * mod do Elite) troca de tela sem mudar o endereço. Endereço igual não quer dizer
 * tela igual. A assinatura é o hash dos cabeçalhos e dos papéis e rótulos dos
 * elementos, sem dígitos (hora e contador mudam sozinhos e não são outra tela).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { chromePath, matarProcesso } from './platform.mjs'

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * O que o roteiro NUNCA clica: ação destrutiva ou irreversível, nas formas em que aparece num rótulo (sair, apagar,
 * zerar, pagar, comprar, cancelar, encerrar, reiniciar, finalizar compra...). Cada palavra começa em fronteira
 * de palavra, para "fazer" não bater em "zer" nem "Histórico de compras" em "comprar".
 *
 * Não é o `NAO_TOCAR` do `gateFotos.mjs`: aquele também barra "menu", "fechar", "recolher", "tema" e "idioma",
 * que para a foto são perigo e para o roteiro são NAVEGAÇÃO (medido no Nexus, onde o botão "Abrir o menu" ficava
 * de fora do mapa). `plano.naoTocar` SOMA outras palavras a esta lista; `plano.naoTocarSo` a troca de verdade.
 * Vale para o texto do botão, a descrição, o aria-label e o title: cada um sozinho.
 */
export const PROTEGIDOS = new RegExp([
  'pag(ar|amento|ue)', 'compr(ar|a)\\b', 'cancel', 'encerr', 'desativ', 'reinici', 'exclu(ir|[ií]|são|sao)', 'apag', 'delet', 'remo(v|ção|cao)',
  'limp(ar|e|eza|ad)', 'reset', 'zer(ar|ad|e)', 'sair\\b', 'log ?out', 'sign ?out', 'desconect', 'backup', 'finaliz(ar)? +compra',
  'enviar +pedido', 'confirmar +pedido', 'assinar +plano', 'buy\\b', 'pay\\b', 'checkout', 'purchase',
].map((p) => '\\b' + p).join('|'), 'i')

/** A lista que vale: a padrão, mais `naoTocar` (RegExp ou texto de regex); ou só `naoTocarSo`, que troca a padrão. */
export function listaProtegida({ naoTocar = null, naoTocarSo = null } = {}) {
  const texto = (x) => (x instanceof RegExp ? x.source : String(x))
  if (naoTocarSo) return new RegExp(texto(naoTocarSo), 'i')
  return naoTocar ? new RegExp(`(?:${PROTEGIDOS.source})|(?:${texto(naoTocar)})`, 'i') : PROTEGIDOS
}

/**
 * Por padrão o navegador só abre file://, localhost, 127.0.0.1 e https://testedevoo.carzo.com.br. O Chrome roda
 * com `--no-sandbox` (a sandbox dele não sobe nesta VPS), então uma página hostil não pode ser aberta à toa.
 * Outro endereço exige `qualquerUrl: true` (no comando, `--qualquer-url`).
 */
export function enderecoPermitido(url, permitir = []) {
  let u
  try { u = new URL(url) } catch { return false }
  if (u.protocol === 'about:' || u.protocol === 'file:') return true
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  if (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return true
  if (permitir.some((h) => String(h).toLowerCase() === u.hostname)) return true // `plano.permitir`: mais seguro que `qualquerUrl`
  return u.protocol === 'https:' && u.hostname === 'testedevoo.carzo.com.br'
}

/**
 * O login de teste: um arquivo JSON `{ "usuario": "...", "senha": "..." }` (o caminho vem em `plano.acesso`) ou as
 * variáveis ROTEIRO_USUARIO e ROTEIRO_SENHA. Devolve `{ usuario, senha }` ou null. O VALOR nunca sai daqui: nenhuma
 * mensagem de erro traz o conteúdo do arquivo (a do `JSON.parse` traria um pedaço dele, por isso é trocada).
 */
export function lerAcesso(caminho = null) {
  if (caminho) {
    let j
    try { j = JSON.parse(fs.readFileSync(caminho, 'utf8')) } catch (e) { throw new Error(`não consegui ler o arquivo de acesso ${caminho} (${e?.code || 'não é um JSON válido'})`) }
    if (!j || typeof j.usuario !== 'string' || typeof j.senha !== 'string' || !j.usuario || !j.senha) throw new Error(`o arquivo de acesso ${caminho} precisa ter "usuario" e "senha" (texto)`)
    return { usuario: j.usuario, senha: j.senha }
  }
  const { ROTEIRO_USUARIO: usuario, ROTEIRO_SENHA: senha } = process.env
  return usuario && senha ? { usuario, senha } : null
}

/** Texto de comparação: minúsculo, sem dígitos (horas e contadores), espaço único. */
export const normalizar = (s) => String(s ?? '').toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim()

/** Hash estável da tela pelo conteúdo, nunca pela URL. Uma só conta, para mapa e agente casarem. */
export function assinar(cabecalhos, elementos) {
  const cab = [...new Set(cabecalhos.map((h) => 'h:' + normalizar(h)))].sort()
  const els = [...new Set(elementos.map((e) => e.papel + ':' + normalizar(e.rotulo)))].sort()
  return crypto.createHash('sha1').update([...cab, ...els].join('\n')).digest('hex').slice(0, 12)
}

/**
 * Qual Chrome sobe. `CC_CHROME` (do `chromePath()`) manda. Sem ele, o "headless shell" do Playwright quando
 * existe: é o Chrome só sem tela, não cria o socket de perfil que o Chrome inteiro cria, e medido nesta VPS
 * ele abre até dentro da sandbox do agente, onde o Chrome inteiro morre com "Operation not permitted".
 * Sem nenhum dos dois, o `chromePath()` de sempre.
 */
export function chromeSemTela() {
  if (process.env.CC_CHROME) return chromePath()
  const raiz = path.join(os.homedir(), '.cache', 'ms-playwright')
  try {
    for (const d of fs.readdirSync(raiz).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      for (const sub of fs.readdirSync(path.join(raiz, d)).filter((x) => x.startsWith('chrome-headless-shell'))) {
        for (const exe of ['chrome-headless-shell', 'chrome-headless-shell.exe']) {
          const alvo = path.join(raiz, d, sub, exe)
          if (fs.existsSync(alvo)) return alvo
        }
      }
    }
  } catch { /* sem Playwright nesta máquina */ }
  return chromePath()
}

/* ============ o que roda DENTRO da página (função de verdade, vira texto na hora) ============ */

/** Lista tudo que dá para clicar e os cabeçalhos. Guarda os elementos em window.__roteiroEls. */
function naPaginaObservar() {
  const limpa = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
  const visivel = (e) => {
    if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
    const r = e.getBoundingClientRect()
    return r.width > 4 && r.height > 4
  }
  const papelDe = (e) => {
    const role = e.getAttribute('role')
    if (role) return role
    const t = e.tagName
    if (t === 'A') return 'link'
    if (t === 'BUTTON') return 'button'
    if (t === 'SELECT') return 'select'
    if (t === 'SUMMARY') return 'summary'
    if (t === 'INPUT') return 'input:' + (e.type || 'text')
    return 'clicavel'
  }
  // o texto de um cartão vem em linhas ("Route" / "Plan the route..."): o rótulo é a primeira, o resto é descrição
  const rotuloDe = (e) => {
    let primeira = ''
    let resto = ''
    if (e.tagName === 'INPUT') primeira = ['button', 'submit', 'reset'].includes(e.type) ? limpa(e.value) : ''
    else if (e.tagName !== 'SELECT') {
      const linhas = String(e.innerText || e.textContent || '').split('\n').map(limpa).filter(Boolean)
      primeira = linhas[0] || ''
      resto = linhas.slice(1).join(' ')
    }
    if (!primeira) primeira = limpa(e.getAttribute('aria-label'))
    if (!primeira) primeira = limpa(e.getAttribute('title'))
    if (!primeira && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName)) primeira = limpa(e.labels?.[0]?.innerText) || limpa(e.getAttribute('placeholder')) || limpa(e.getAttribute('name'))
    return { rotulo: primeira.slice(0, 40), descricao: limpa(primeira.slice(40) + ' ' + resto).slice(0, 120) }
  }
  const janela = { w: window.innerWidth, h: window.innerHeight }
  const todos = []
  let anterior = ''
  const alvos = 'a, button, [role=button], [role=tab], [role=link], [role=menuitem], input:not([type=hidden]), select, summary, [onclick]'
  for (const e of document.querySelectorAll(alvos)) {
    if (e.disabled || e.getAttribute('aria-disabled') === 'true' || !visivel(e)) continue
    const { rotulo, descricao } = rotuloDe(e)
    if (!rotulo) continue
    const r = e.getBoundingClientRect()
    const papel = papelDe(e)
    const marca = [papel, rotulo, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join('|')
    if (marca === anterior) continue // o mesmo botão duas vezes (um clicável dentro do outro)
    anterior = marca
    const naJanela = r.bottom > 0 && r.top < janela.h && r.right > 0 && r.left < janela.w
    let tapado = false
    if (naJanela) {
      // o centro do pedaço visível: se outra coisa está por cima (menu aberto, janela), a pessoa não clica nele
      const x = (Math.max(r.left, 0) + Math.min(r.right, janela.w)) / 2
      const y = (Math.max(r.top, 0) + Math.min(r.bottom, janela.h)) / 2
      const topo = document.elementFromPoint(x, y)
      tapado = !(topo && e.contains(topo))
    }
    todos.push({ el: e, rotulo, descricao, etiqueta: limpa(e.getAttribute('aria-label')), dica: limpa(e.getAttribute('title')), papel, naJanela, tapado,
      caixa: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } })
  }
  window.__roteiroEls = todos.map((t) => t.el)
  const cabecalhos = []
  for (const h of document.querySelectorAll('h1, h2, h3, [role=heading]')) {
    if (!visivel(h)) continue
    const t = limpa(h.innerText || h.textContent).slice(0, 80)
    const r = h.getBoundingClientRect()
    if (t) cabecalhos.push({ t, naJanela: r.bottom > 0 && r.top < janela.h })
  }
  return {
    titulo: document.title, url: location.href, janela,
    texto: String(document.body?.innerText || '').slice(0, 30000),
    cabecalhos,
    elementos: todos.map((t, i) => ({ i, rotulo: t.rotulo, descricao: t.descricao, etiqueta: t.etiqueta, dica: t.dica, papel: t.papel, naJanela: t.naJanela, tapado: t.tapado, caixa: t.caixa })),
  }
}

/** Prepara o clique no elemento i: traz para a janela e devolve o centro e se há algo por cima. */
function naPaginaAlvo(i) {
  const e = i < 0 ? window.__roteiroAlvo : window.__roteiroEls?.[i] // i < 0: o elemento que uma sonda marcou
  if (!e || !e.isConnected) return { solto: true }
  e.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const r = e.getBoundingClientRect()
  const x1 = Math.max(r.left, 0), x2 = Math.min(r.right, window.innerWidth)
  const y1 = Math.max(r.top, 0), y2 = Math.min(r.bottom, window.innerHeight)
  if (x2 - x1 < 2 || y2 - y1 < 2) return { fora: true }
  const x = (x1 + x2) / 2, y = (y1 + y2) / 2
  const topo = document.elementFromPoint(x, y)
  return { x, y, tapado: !(topo && e.contains(topo)) }
}

/** O que muda quando a página mexe sozinha: nós e texto sem dígitos (o relógio não conta). */
function naPaginaEstado() {
  const b = document.body
  return b ? b.getElementsByTagName('*').length + ':' + b.innerText.replace(/\d+/g, '').length : ''
}

/** Há campo de senha visível? */
function naPaginaTemSenha() {
  return [...document.querySelectorAll('input[type=password]')].some((e) => (!e.checkVisibility || e.checkVisibility()) && e.getBoundingClientRect().width > 4)
}

/** Preenche usuário e senha (pelo setter nativo e com `input`, para React não achar o campo vazio) e envia o formulário. */
function naPaginaEntrar(a) {
  const vis = (e) => (!e.checkVisibility || e.checkVisibility()) && e.getBoundingClientRect().width > 4
  const pw = [...document.querySelectorAll('input[type=password]')].find(vis)
  if (!pw) return false
  const u = [...document.querySelectorAll('input:not([type=password]):not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])')].find(vis)
  const por = (e, v) => {
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value')?.set
    set ? set.call(e, v) : (e.value = v)
    e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (u) por(u, a.usuario)
  por(pw, a.senha)
  const b = pw.form && pw.form.querySelector('button[type=submit], input[type=submit], button:not([type=button])')
  if (b) b.click(); else if (pw.form) pw.form.requestSubmit()
  return true
}

/** Apaga o que a página guardou (localStorage, sessionStorage, IndexedDB): o que ela lê ao carregar. */
function naPaginaEsquecer() {
  try { localStorage.clear() } catch { /* origem sem armazenamento */ }
  try { sessionStorage.clear() } catch { /* idem */ }
  return Promise.race([
    (indexedDB.databases ? indexedDB.databases() : Promise.resolve([])).then((dbs) => dbs.forEach((d) => indexedDB.deleteDatabase(d.name))).catch(() => {}),
    new Promise((r) => setTimeout(r, 500)),
  ]).then(() => true)
}

/** Rola meia janela (`sentido` 1 desce, -1 sobe). Se a janela não anda, rola a maior área com barra de rolagem própria. */
function naPaginaRolar(sentido) {
  const passo = sentido * Math.round(window.innerHeight / 2)
  const antes = window.scrollY
  window.scrollBy(0, passo)
  if (window.scrollY !== antes) return true
  const area = [...document.querySelectorAll('*')]
    .filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 100)
    .sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0]
  if (!area) return false
  const topo = area.scrollTop
  area.scrollBy(0, passo)
  return area.scrollTop !== topo
}

const expr = (fn, ...args) => `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`

/* ============================= o processo filho ============================= */

/**
 * Roda `node --experimental-websocket <script> --plano <json>` e espera. É o que o mapa e o agente fazem no
 * lado do pai (o Node 20 não tem WebSocket, então o trabalho com o Chrome vai num filho).
 *
 * - `prazoMs` (0 = sem prazo): passou, manda SIGTERM (o filho fecha o Chrome) e, só 15 s depois, SIGKILL.
 * - Se o PAI morrer (`exit`) ou receber SIGINT ou SIGTERM, manda SIGTERM ao filho: sem isso o filho e o Chrome dele
 *   ficariam rodando sozinhos.
 * - `aoLinha(linha)`: cada linha da saída padrão. `stdio` troca os canais (o `humano` herda o terminal).
 * Devolve `{ codigo, passou, erro }`; quem chama decide o que fazer com isso.
 */
export function rodarFilho({ script, plano, prazoMs = 0, stdio = ['ignore', 'pipe', 'pipe'], aoLinha = null }) {
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, ['--experimental-websocket', script, '--plano', JSON.stringify(plano)], { stdio })
    let erro = ''
    let resto = ''
    let passou = false
    let forca = null
    const parar = () => {
      try { matarProcesso(filho.pid) } catch { /* já saiu */ }
      if (!forca) forca = setTimeout(() => { try { filho.kill('SIGKILL') } catch { /* já saiu */ } }, 15000)
    }
    const aoSairPai = () => { try { filho.kill('SIGTERM') } catch { /* já saiu */ } } // síncrono: é o que dá para fazer no `exit`
    const aoSinalPai = () => { parar(); process.exit(130) }
    process.on('exit', aoSairPai); process.on('SIGINT', aoSinalPai); process.on('SIGTERM', aoSinalPai)
    const soltar = () => { clearTimeout(prazo); clearTimeout(forca); process.off('exit', aoSairPai); process.off('SIGINT', aoSinalPai); process.off('SIGTERM', aoSinalPai) }
    const prazo = prazoMs > 0 ? setTimeout(() => { passou = true; parar() }, prazoMs) : null
    filho.stdout?.on('data', (d) => {
      resto += d
      let i
      while ((i = resto.indexOf('\n')) >= 0) { const l = resto.slice(0, i); resto = resto.slice(i + 1); aoLinha?.(l) }
    })
    filho.stderr?.on('data', (d) => { erro = (erro + d).slice(-800) })
    filho.on('error', (e) => { soltar(); reject(e) })
    filho.on('close', (codigo) => { soltar(); resolve({ codigo, passou, erro: erro.trim().split('\n').pop() || '' }) })
  })
}

/* ================================ o navegador ================================ */

/**
 * Sobe o Chrome sem tela (ou usa o de `CC_CDP`) e devolve as mãos e os olhos:
 * `ir(url, { limpo = true })`, `observar({ soVisivel })`, `clicar(n)`, `voltar()`, `rolar()`, `foto(arquivo)`, `fechar()`.
 * `naoTocar` (RegExp ou texto de regex) SOMA palavras à lista de proteção `PROTEGIDOS`; `naoTocarSo` a troca.
 * `idioma` (padrão pt-BR) vale para o Chrome inteiro: navigator.language, Accept-Language e a formatação.
 * O Chrome sem tela sobe em en-US, e o Nexus abriu em inglês por causa disso.
 * `qualquerUrl` (padrão falso): só abre `enderecoPermitido()`; outro endereço, e qualquer navegação para fora
 * (clique, redirecionamento, iframe), é recusado. O Chrome roda sem sandbox.
 * `rolar({ acima })` rola meia janela, para quem só enxerga a janela alcançar o que está abaixo da dobra.
 * `permitir`: hosts a MAIS que podem abrir (ex. ["testzone.vendeufy.com.br"]); mais seguro que `qualquerUrl`.
 * `acesso`: caminho do JSON `{ usuario, senha }` (ou ROTEIRO_USUARIO e ROTEIRO_SENHA): quando aparece campo de senha, `ir`
 * entra sozinho (e entra de novo a cada recarga). O valor nunca é impresso. Login que não entra faz `ir` falhar com aviso claro.
 * `avaliar(fn, ...args)`, `tecla(nome)` e `clicarAlvo(fn, ...args)` são para as sondas (`roteiroSondas.mjs`).
 */
export async function abrirNavegador({ largura = 390, altura = 844, naoTocar = null, naoTocarSo = null, idioma = 'pt-BR', qualquerUrl = false, permitir = [], acesso = null } = {}) {
  const bloqueia = listaProtegida({ naoTocar, naoTocarSo })
  const credencial = acesso && typeof acesso === 'object' ? acesso : lerAcesso(acesso) // caminho do arquivo, ou as variáveis ROTEIRO_*
  let loginFalhou = false
  if (typeof WebSocket === 'undefined') throw new Error('este Node não tem WebSocket: rode com `node --experimental-websocket`')
  let proc = null
  let perfil = null
  let base
  let nav = null
  let ws = null
  let cdp = null
  let cdpNav = null
  let browserContextId = null
  let targetId = null
  let fechado = false
  const limparPerfil = () => { if (perfil) { try { fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) } catch { /* sobra de /tmp, o sistema limpa */ } } }

  const matarChrome = async () => {
    if (!proc || proc.exitCode !== null) return
    try { matarProcesso(proc.pid) } catch { /* já saiu */ }
    for (let i = 0; i < 30 && proc.exitCode === null; i++) await dorme(100)
    if (proc.exitCode === null) { try { proc.kill('SIGKILL') } catch { /* já saiu */ } }
  }
  const abortarSincrono = () => { try { proc?.kill('SIGKILL') } catch { /* já saiu */ } }
  const aoSinal = () => { fechar().finally(() => process.exit(1)) }
  // a única saída: fecha o que já abriu, em qualquer ponto (também no meio da subida), e é segura de chamar de novo
  async function fechar() {
    if (fechado) return
    fechado = true
    process.off('SIGTERM', aoSinal); process.off('SIGINT', aoSinal); process.off('exit', abortarSincrono)
    if (cdpNav && targetId) await cdpNav('Target.closeTarget', { targetId }, 3000).catch(() => {})
    if (cdpNav && browserContextId) await cdpNav('Target.disposeBrowserContext', { browserContextId }, 3000).catch(() => {})
    try { ws?.close(); nav?.close() } catch { /* já caiu */ }
    await matarChrome()
    limparPerfil()
  }

  /** Uma conexão CDP: manda comando, espera a resposta, devolve eventos para quem escuta. */
  const conectar = async (url, aoEvento) => {
    const s = new WebSocket(url)
    await new Promise((ok, x) => {
      const t = setTimeout(() => { try { s.close() } catch { /* já caiu */ } x(new Error('o Chrome não aceitou a conexão em 10 s: ' + url)) }, 10000)
      s.addEventListener('open', () => { clearTimeout(t); ok() }, { once: true })
      s.addEventListener('error', () => { clearTimeout(t); x(new Error('sem conexão com o Chrome em ' + url)) }, { once: true })
    })
    let n = 0
    const esp = new Map()
    s.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && esp.has(m.id)) { const { ok, x } = esp.get(m.id); esp.delete(m.id); m.error ? x(new Error(m.error.message)) : ok(m.result) } else if (m.method) aoEvento?.(m)
    })
    s.addEventListener('close', () => { for (const { x } of esp.values()) x(new Error('o Chrome fechou a conexão')); esp.clear() })
    const cdp = (method, params = {}, ms = 30000) => new Promise((ok, x) => {
      const i = ++n
      const t = setTimeout(() => { esp.delete(i); x(new Error(`${method} não respondeu em ${ms / 1000} s`)) }, ms)
      esp.set(i, { ok: (r) => { clearTimeout(t); ok(r) }, x: (e) => { clearTimeout(t); x(e) } })
      s.send(JSON.stringify({ id: i, method, params }))
    })
    return { s, cdp }
  }

  let ocupado = false
  const ouvintes = new Set()
  const aoEvento = (m) => {
    if (m.method === 'Page.frameStartedLoading') ocupado = true
    else if (m.method === 'Page.frameStoppedLoading') ocupado = false
    else if (m.method === 'Fetch.requestPaused') {
      // navegação (aba, iframe, redirecionamento) para fora do permitido: recusada antes de sair do Chrome
      const { requestId, request } = m.params
      const livre = enderecoPermitido(request.url, permitir)
      cdp(livre ? 'Fetch.continueRequest' : 'Fetch.failRequest', livre ? { requestId } : { requestId, errorReason: 'BlockedByClient' }).catch(() => {})
    }
    for (const f of ouvintes) f(m)
  }

  try {
    if (process.env.CC_CDP) {
      base = /^\d+$/.test(process.env.CC_CDP) ? `http://127.0.0.1:${process.env.CC_CDP}` : process.env.CC_CDP.replace(/\/$/, '')
      // sem Chrome próprio, mas com o que fechar (a aba e o contexto): os sinais valem desde já
      process.on('SIGTERM', aoSinal); process.on('SIGINT', aoSinal)
    } else {
      const chrome = chromeSemTela()
      if (!chrome) throw new Error('Chrome não encontrado nesta máquina (defina CC_CHROME ou CC_CDP)')
      perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-roteiro-'))
      /* `--no-sandbox` sempre: medido nesta VPS, o Chrome morre com "No usable sandbox" (Ubuntu 24.04 desliga o
         namespace de usuário, e como root ou em contêiner é igual). O navegador é descartável, com perfil
         temporário, e por isso só abre os endereços de `enderecoPermitido()` (a menos que `qualquerUrl`). */
      const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
        '--remote-debugging-port=0', `--user-data-dir=${perfil}`, `--lang=${idioma}`, 'about:blank']
      proc = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      // o pai mata o filho no prazo e pode morrer: a limpeza é registrada JÁ, antes de esperar o Chrome subir
      process.on('SIGTERM', aoSinal); process.on('SIGINT', aoSinal); process.on('exit', abortarSincrono)
      let saiu = null
      let cauda = '' // o fim do que o Chrome reclamou: é a causa quando ele não abre
      proc.stderr.on('data', (d) => { cauda = (cauda + d).slice(-1500) })
      proc.on('exit', (c) => { saiu = c })
      const motivo = () => (cauda.split('\n').filter((l) => /FATAL|Check failed|No usable/.test(l)).pop() || cauda.trim().split('\n').pop() || '').slice(0, 220)
      // a porta 0 deixa o Chrome escolher uma livre e ele conta qual foi neste arquivo
      const arq = path.join(perfil, 'DevToolsActivePort')
      for (let i = 0; i < 100 && !base; i++) {
        if (saiu !== null) throw new Error('o Chrome fechou logo ao abrir (código ' + saiu + '): ' + motivo())
        try { base = 'http://127.0.0.1:' + fs.readFileSync(arq, 'utf8').split('\n')[0].trim() } catch { await dorme(150) }
      }
      if (!base) throw new Error('o Chrome não abriu a porta de depuração em 15 s: ' + motivo())
    }

    const versao = await fetch(base + '/json/version', { signal: AbortSignal.timeout(10000) }).then((r) => r.json()).catch((e) => { throw new Error('o Chrome não respondeu em ' + base + ' em 10 s (' + (e?.name || e) + ')') })
    const n = await conectar(versao.webSocketDebuggerUrl)
    nav = n.s; cdpNav = n.cdp
    // contexto anônimo próprio: abas de outra execução (ou do Chrome compartilhado) não se misturam com esta
    browserContextId = (await cdpNav('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId
    targetId = (await cdpNav('Target.createTarget', { url: 'about:blank', browserContextId })).targetId
    const alvo = new URL(versao.webSocketDebuggerUrl)
    const p = await conectar(`ws://${alvo.host}/devtools/page/${targetId}`, aoEvento)
    ws = p.s; cdp = p.cdp
    await cdp('Page.enable')
    await cdp('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: largura < 700 })
    if (idioma) {
      const ua = String((await cdpNav('Browser.getVersion')).userAgent || '').replace('HeadlessChrome', 'Chrome')
      await cdp('Emulation.setUserAgentOverride', { userAgent: ua, acceptLanguage: idioma }) // navigator.language e o cabeçalho
      await cdp('Emulation.setLocaleOverride', { locale: idioma }).catch(() => {}) // Intl; recusa se já houver outro
    }
    if (!qualquerUrl) await cdp('Fetch.enable', { patterns: [{ resourceType: 'Document' }] }) // só as navegações; imagem e fonte passam
  } catch (e) {
    await fechar()
    throw e
  }

  const ev = async (expressao) => {
    const r = await cdp('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true }).catch(() => null)
    return r?.exceptionDetails ? undefined : r?.result?.value
  }

  /** Espera a página parar de mudar: 250 ms parada e sem carregar, até `maxMs`. */
  const esperarQuieto = async (maxMs = 1500) => {
    const inicio = Date.now()
    let ultimo = null
    let desde = Date.now()
    while (Date.now() - inicio < maxMs) {
      await dorme(50)
      const s = await ev(expr(naPaginaEstado))
      if (s === undefined || ocupado || s !== ultimo) { ultimo = s; desde = Date.now() } else if (Date.now() - desde >= 250) return
    }
  }

  const esperarEvento = (metodo, ms) => new Promise((ok) => {
    const t = setTimeout(() => { ouvintes.delete(f); ok(false) }, ms)
    const f = (m) => { if (m.method === metodo) { clearTimeout(t); ouvintes.delete(f); ok(true) } }
    ouvintes.add(f)
  })

  let ultima = null // a última observação: o número `n` do clique vale para ela

  async function observar({ soVisivel = true } = {}) {
    const r = await ev(expr(naPaginaObservar))
    if (!r) throw new Error('não consegui ler a página')
    const todos = r.elementos
    const lista = soVisivel ? todos.filter((e) => e.naJanela && !e.tapado) : todos
    const porN = new Map()
    const elementos = lista.map((e, k) => {
      const chave = e.papel + '|' + normalizar(e.rotulo)
      // cada texto sozinho (o botão, a descrição, o aria-label, o title): a âncora (^ e $) vale e um não esconde o outro
      const bloqueado = [e.rotulo, e.descricao, e.etiqueta, e.dica].some((t) => t && bloqueia.test(t))
      // `oc`: qual dos botões de mesmo nome e papel é este (o mapa refaz o clique por nome, depois de recarregar)
      porN.set(k + 1, { i: e.i, chave, bloqueado, rotulo: e.rotulo, oc: todos.filter((o) => o.papel + '|' + normalizar(o.rotulo) === chave).indexOf(e) })
      return { n: k + 1, rotulo: e.rotulo, ...(e.descricao && { descricao: e.descricao }), papel: e.papel, caixa: e.caixa, bloqueado }
    })
    const cabecalhos = r.cabecalhos.filter((h) => !soVisivel || h.naJanela).map((h) => h.t)
    ultima = { porN, soVisivel }
    // a assinatura olha a página inteira nos dois modos: o mapa e o agente têm de chegar ao mesmo hash
    return { titulo: r.titulo, url: r.url, cabecalhos, elementos, texto: r.texto, assinatura: assinar(r.cabecalhos.map((h) => h.t), todos) }
  }

  /** Clique de mouse de verdade no centro. Devolve `{ ok, motivo }`; nunca toca no que apaga, sai ou zera. */
  async function clicar(n) {
    const alvo = ultima?.porN.get(n)
    if (!alvo) return { ok: false, motivo: 'não há elemento ' + n + ' na última observação' }
    if (alvo.bloqueado) return { ok: false, motivo: 'nao-tocar', rotulo: alvo.rotulo }
    let pos = await ev(expr(naPaginaAlvo, alvo.i))
    if (pos?.solto) {
      // a página se redesenhou entre olhar e clicar: acha o mesmo botão de novo pelo nome
      const modo = ultima.soVisivel
      await observar({ soVisivel: modo })
      const novo = [...ultima.porN.values()].find((v) => v.chave === alvo.chave && v.oc === alvo.oc)
      if (!novo) return { ok: false, motivo: 'o elemento saiu da página' }
      if (novo.bloqueado) return { ok: false, motivo: 'nao-tocar', rotulo: novo.rotulo }
      pos = await ev(expr(naPaginaAlvo, novo.i))
    }
    return cliqueEm(pos)
  }

  /** O clique de mouse no centro `pos` (de `naPaginaAlvo`): recusa o que está fora, tapado ou solto. */
  async function cliqueEm(pos) {
    if (!pos || pos.solto) return { ok: false, motivo: 'o elemento saiu da página' }
    if (pos.fora) return { ok: false, motivo: 'o elemento está fora da janela' }
    if (pos.tapado) return { ok: false, motivo: 'tem outra coisa por cima do elemento' }
    const m = { x: pos.x, y: pos.y, button: 'left', clickCount: 1 }
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: m.x, y: m.y })
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...m })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...m })
    await esperarQuieto(1500)
    return { ok: true }
  }

  /**
   * Clica num elemento que a SONDA achou: `fn` roda na página, guarda o elemento em `window.__roteiroAlvo` e devolve
   * `{ rotulo, descricao }` (ou null se não achou). Mesma lista de proteção do `clicar`: nunca toca no que apaga, sai ou paga.
   */
  async function clicarAlvo(fn, ...args) {
    const r = await ev(expr(fn, ...args))
    if (!r) return { ok: false, motivo: 'não achei o elemento' }
    if ([r.rotulo, r.descricao].some((t) => t && bloqueia.test(t))) return { ok: false, motivo: 'nao-tocar', rotulo: r.rotulo }
    return cliqueEm(await ev(expr(naPaginaAlvo, -1)))
  }

  /** Roda uma função NA página e devolve o valor (JSON) dela, ou `undefined` se deu erro. */
  const avaliar = (fn, ...args) => ev(expr(fn, ...args))

  /** Aperta uma tecla (Escape, Enter...): o teclado de verdade, não um evento inventado. */
  async function tecla(nome) {
    const codigos = { Escape: 27, Enter: 13, Tab: 9 }
    const k = { key: nome, code: nome, windowsVirtualKeyCode: codigos[nome] || 0 }
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...k })
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...k })
    await esperarQuieto(800)
  }

  /**
   * Abre `url` do zero. Antes, esquece o que a página guardou (localStorage, sessionStorage, IndexedDB e cookies),
   * porque o app lembra a última tela entre recargas. Medido no Nexus: depois de clicar num atalho de nave a raiz
   * recarregada já não era a mesma, e o mapa, que refaz o caminho desde a raiz, perdia o rumo em todas as telas.
   * `{ limpo: false }` mantém a memória da página.
   */
  async function ir(url, { limpo = true } = {}) {
    if (!qualquerUrl && !enderecoPermitido(url, permitir)) {
      throw new Error(`endereço recusado: ${url}\n  Por padrão o roteiro só abre file://, localhost, 127.0.0.1 e https://testedevoo.carzo.com.br, porque o Chrome roda sem sandbox. Para abrir outro host, use permitir (lista de hosts) ou, para qualquer um, qualquerUrl (no comando, --qualquer-url).`)
    }
    if (limpo) {
      await ev(expr(naPaginaEsquecer))
      await cdp('Network.clearBrowserCookies').catch(() => {})
    }
    /* Mesmo documento (o endereço igual, ou diferente só no `#fragmento`): navegar para ele seria uma troca de
       fragmento, sem recarregar, e a tela anterior (e as opções lidas do `#`) ficariam lá. Passa por about:blank. */
    const atual = (await ev('location.href')) || ''
    if (atual.split('#')[0] === url.split('#')[0]) {
      const branco = esperarEvento('Page.loadEventFired', 5000)
      await cdp('Page.navigate', { url: 'about:blank' })
      await branco
    }
    const carregou = esperarEvento('Page.loadEventFired', 12000)
    const r = await cdp('Page.navigate', { url })
    if (r.errorText) throw new Error(`não abriu ${url}: ${r.errorText}`)
    await carregou
    await esperarQuieto(1500)
    if (credencial) await entrarSeFor()
  }

  /* Campo de senha na tela: preenche e envia, UMA vez por abertura. Se a senha não entrar, para: tentar de novo a cada
     recarga do mapa travaria a conta de teste. Nenhum texto daqui carrega o usuário nem a senha. */
  async function entrarSeFor() {
    if (!(await ev(expr(naPaginaTemSenha)))) return
    if (loginFalhou) throw new Error('o login já falhou nesta execução e não foi tentado de novo (para não travar a conta de teste)')
    await ev(expr(naPaginaEntrar, credencial))
    await esperarQuieto(2500)
    for (let i = 0; i < 6 && (await ev(expr(naPaginaTemSenha))); i++) await dorme(500)
    if (await ev(expr(naPaginaTemSenha))) {
      loginFalhou = true
      throw new Error('o login falhou: a tela de senha continuou na tela depois de enviar o usuário e a senha do arquivo de acesso. Confira usuário e senha (os valores não são mostrados).')
    }
  }

  async function voltar() {
    const h = await cdp('Page.getNavigationHistory')
    const antes = h.entries[h.currentIndex - 1]
    if (!antes || antes.url === 'about:blank') return false
    await cdp('Page.navigateToHistoryEntry', { entryId: antes.id })
    await esperarQuieto(1500)
    return true
  }

  /** Rola meia janela (para baixo; `{ acima: true }` para cima). Devolve se a tela andou. */
  async function rolar({ acima = false } = {}) {
    const moveu = await ev(expr(naPaginaRolar, acima ? -1 : 1))
    await esperarQuieto(600)
    return !!moveu
  }

  async function foto(arquivo) {
    const s = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 72 })
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    fs.writeFileSync(arquivo, Buffer.from(s.data, 'base64'))
    return arquivo
  }

  return { ir, observar, clicar, voltar, rolar, foto, fechar, avaliar, tecla, clicarAlvo }
}
