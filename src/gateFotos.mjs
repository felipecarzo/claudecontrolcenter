/**
 * CC-743: as fotos automáticas do Coderoom, depois de resposta que mexe em tela.
 *
 * Pedido dele em 30/09, depois da simulação do clone do MNZS: o harness de
 * design. Achado da simulação: no último pedido o opencode escreveu
 * "reconfiro no navegador" e rodou só o build. A prova visual não pode depender
 * de o agente lembrar; quem tira a foto é o painel.
 *
 * ## Como, e por que assim (medido em 30/09)
 *
 * - `chrome --screenshot` direto TRAVA nesta página (partícula em animação
 *   contínua): 60 s e nenhuma foto, com e sem tempo virtual.
 * - O Node do painel (v20) não tem `WebSocket`, que o protocolo do Chrome pede.
 *   Então a captura roda num processo FILHO com `--experimental-websocket`,
 *   usando o Chrome que já fica de pé na porta 9333. É o mesmo caminho das
 *   provas de hoje, que funcionou todas as vezes.
 *
 * Este arquivo tem as duas pontas: `fotografar()` para o painel, e o modo
 * `--captura` para o filho.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { execFile } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { acessoTesteDe } from './config.mjs'

export const CDP = process.env.CC_CDP || 'http://127.0.0.1:9333'
const ESTE = fileURLToPath(import.meta.url)
export const ALTURA_MAX = 2400
export const EXT_TELA =/\.(jsx?|tsx?|css|scss|html|vue|svelte|astro)$/i

/** A resposta mexeu em tela? Pelos caminhos das ferramentas de edição. */
export function mexeuEmTela(ferramentas) {
  return (ferramentas || []).some((f) => EXT_TELA.test(String(f.caminho || f.alvo || '')))
}

const rodar = (cmd, args, opts) => new Promise((ok) => {
  execFile(cmd, args, { maxBuffer: 8 * 1024 * 1024, ...opts }, (e, out, err) => ok({ ok: !e, out: String(out || ''), err: String(err || e?.message || '') }))
})

/* CC-780 tentou uma lista de telas escrita pelo agente (.coderoom/telas.json).
   Medido em 30/09: o opencode pulou, e depois escreveu seletores que nem são
   CSS válido, e a conversa encheu de erro. Saiu: o painel explora sozinho (CC-797). */

/**
 * CC-807, "ele não fez testedevoo, não fez nada, como eu testo?": o endereço de
 * teste do projeto (https://testedevoo.carzo.com.br/<nome>/), se ele estiver
 * subido. Quem sabe é o mapa do `~/dev.sh`, que só guarda o que está no ar.
 */
export const ENDERECO_BASE = 'https://testedevoo.carzo.com.br'
export function enderecoDe(cwd) {
  try {
    const mapa = JSON.parse(fs.readFileSync(process.env.CC_DEV_MAPA || path.join(os.homedir(), '.dev-projetos.json'), 'utf8'))
    const pasta = path.resolve(cwd || '')
    const casa = (d) => { const p = path.resolve(d || ''); return p === pasta || p.startsWith(pasta + path.sep) || pasta.startsWith(p + path.sep) }
    const nome = Object.keys(mapa).find((k) => path.resolve(mapa[k].dir || '') === pasta) || Object.keys(mapa).find((k) => casa(mapa[k].dir))
    if (nome) return { nome, url: `${ENDERECO_BASE}/${nome}/` }
  } catch { /* sem mapa: ainda vale a lista de endereços registrados, logo abaixo */ }
  return enderecoRegistrado(cwd)
}

/**
 * CC-819, medido em 01/10: outra sessão zerou o mapa do roteador e o jogo, com o
 * servidor vivo, passou a dar 404 no endereço. O que sobrevive a isso é a lista
 * de projetos registrados (`~/.config/testedevoo/projetos.txt`, uma linha
 * `nome:pasta-a-partir-da-casa:tipo:porta`). Achado por ela, o endereço volta
 * marcado `foraDoMapa`, e quem confere reergue o projeto com `~/dev.sh <nome>`.
 */
function enderecoRegistrado(cwd) {
  try {
    const lista = fs.readFileSync(process.env.CC_DEV_LISTA || path.join(os.homedir(), '.config', 'testedevoo', 'projetos.txt'), 'utf8')
    const pasta = path.resolve(cwd || '')
    for (const linha of lista.split('\n')) {
      const [nome, dir] = linha.trim().split(':')
      if (!nome || !dir) continue
      const d = path.resolve(os.homedir(), dir)
      if (d === pasta || d.startsWith(pasta + path.sep) || pasta.startsWith(d + path.sep)) return { nome, url: `${ENDERECO_BASE}/${nome}/`, foraDoMapa: true }
    }
  } catch { /* sem lista, sem endereço */ }
  return null
}

/**
 * Fotos de celular (390) e computador (1440) do que o painel acha andando pelo
 * site. Com endereço de teste no ar, fotografa o ENDEREÇO (é o que ele abre) e
 * devolve também o que está errado nele; sem endereço, faz o build e fotografa
 * o resultado. Devolve `{ ok, fotos, falhas, problemas, endereco, erro }`. Nunca
 * lança: foto é conferência, e a falha dela vira frase na conversa.
 */
export async function fotografar({ cwd, saida }) {
  const endereco = enderecoDe(cwd)
  if (endereco) {
    fs.mkdirSync(saida, { recursive: true })
    // CC-819: registrado mas fora do mapa do roteador = endereço 404 com o servidor possivelmente vivo
    if (endereco.foraDoMapa && fs.existsSync(path.join(cwd, 'package.json'))) {
      await rodar(process.env.CC_DEV_SH || path.join(os.homedir(), 'dev.sh'), [endereco.nome], { timeout: 90000 })
      await new Promise((r) => setTimeout(r, 6000))
    }
    const plano = { explorar: true, acesso: acessoTesteDe(cwd), entrar: [], telas: [], url: endereco.url }
    const c = await rodar(process.execPath, ['--experimental-websocket', ESTE, '--captura', '-', saida, JSON.stringify(plano)], { timeout: 240000 })
    const fotos = fs.readdirSync(saida).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(saida, f))
    let problemas = []; try { problemas = JSON.parse(fs.readFileSync(path.join(saida, '_problemas.json'), 'utf8')) } catch { /* sem anotação */ }
    if (!fotos.length) return { ok: false, endereco, problemas, erro: `não consegui abrir ${endereco.url}: ` + (c.err.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 160) || 'sem resposta') }
    return { ok: true, fotos, endereco, problemas, falhas: c.err.split('\n').filter((l) => l.startsWith('tela:')).map((l) => l.slice(5).trim()) }
  }
  let pkg = null
  try { pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) } catch { return { ok: false, erro: 'o projeto não tem package.json, então não há site para fotografar' } }
  if (!pkg?.scripts?.build) return { ok: false, erro: 'o projeto não tem comando de build' }
  if (!fs.existsSync(path.join(cwd, 'node_modules'))) return { ok: false, erro: 'as dependências não estão instaladas' }
  const b = await rodar('npm', ['run', 'build'], { cwd, timeout: 180000 })
  if (!b.ok) return { ok: false, erro: 'o build falhou: ' + (b.out + b.err).split('\n').filter((l) => /error/i.test(l)).slice(0, 2).join(' | ').slice(0, 300) }
  const dist = ['dist', 'build', 'out'].map((d) => path.join(cwd, d)).find((d) => fs.existsSync(path.join(d, 'index.html')))
  if (!dist) return { ok: false, erro: 'o build passou, mas não achei a página pronta (dist, build ou out)' }
  fs.mkdirSync(saida, { recursive: true })
  // CC-797: o painel explora sozinho, sem lista do agente
  const plano = { explorar: true, acesso: acessoTesteDe(cwd), entrar: [], telas: [] }
  const c = await rodar(process.execPath, ['--experimental-websocket', ESTE, '--captura', dist, saida, JSON.stringify(plano)], { timeout: 240000 })
  const fotos = fs.readdirSync(saida).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(saida, f))
  if (!fotos.length) return { ok: false, erro: 'o build passou, mas a foto falhou: ' + c.err.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 200) }
  return { ok: true, fotos, falhas: c.err.split('\n').filter((l) => l.startsWith('tela:')).map((l) => l.slice(5).trim()) }
}

/**
 * CC-894: fotografa um ENDEREÇO qualquer (o app que o arquiteto subiu numa porta de teste), com o mesmo
 * explorador do painel. Devolve `{ ok, fotos, problemas, falhas, erro }`, e nunca lança.
 */
export async function fotografarUrl({ cwd, url, saida, acesso = null }) {
  fs.mkdirSync(saida, { recursive: true })
  const plano = { explorar: true, acesso: acesso || acessoTesteDe(cwd), entrar: [], telas: [], url }
  const c = await rodar(process.execPath, ['--experimental-websocket', ESTE, '--captura', '-', saida, JSON.stringify(plano)], { timeout: 240000 })
  const fotos = fs.readdirSync(saida).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(saida, f))
  let problemas = []; try { problemas = JSON.parse(fs.readFileSync(path.join(saida, '_problemas.json'), 'utf8')) } catch { /* sem anotação */ }
  if (!fotos.length) return { ok: false, problemas, erro: `não consegui fotografar ${url}: ` + (c.err.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 160) || 'sem resposta') }
  return { ok: true, fotos, problemas, falhas: c.err.split('\n').filter((l) => l.startsWith('tela:')).map((l) => l.slice(5).trim()) }
}

/* Os passos rodam DENTRO da página. `preencher` usa o setter nativo e dispara
   `input`: com React, trocar `value` direto não avisa o componente e o login
   recusa o campo "vazio". */
const JS_PASSO = `(p) => new Promise((ok, x) => {
  const porTexto = (t) => [...document.querySelectorAll('button, a, [role=button], [onclick], li, label, article, [class*=cursor-pointer]')].filter((e) => e.offsetParent && e.innerText.toLowerCase().includes(t.toLowerCase())).sort((a, b) => a.innerText.length - b.innerText.length)[0];
  const el = (s) => { const e = s.startsWith('texto:') ? porTexto(s.slice(6)) : document.querySelector(s); if (!e) throw new Error('não achei ' + s); return e };
  try {
    if (p.preencher) {
      const e = el(p.preencher[0]);
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value')?.set;
      set ? set.call(e, String(p.preencher[1])) : (e.value = String(p.preencher[1]));
      e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (p.clicar) el(p.clicar).click();
    setTimeout(ok, p.esperar || 600);
  } catch (e) { x(e) }
})`

/* CC-797, escolha dele: "o painel explora sozinho". Medido em 30/09: o
   opencode pulou a lista de telas uma vez, e na outra declarou caminhos que não
   abriam o menu do celular. O painel acha sozinho o que tocar: itens de menu
   (abrindo o menu escondido do celular) e os primeiros cartões da tela inicial.
   Nunca toca no que sai, apaga ou zera. */
export const NAO_TOCAR = /sair|logout|log out|excluir|apagar|delet|remov|limpar|resetar|zerar|desconectar|menu|recolher|fechar|tema|idioma/i
export const ALVOS_MAX = 6
const JS_VIS = `const vis = (e) => { const r = e.getBoundingClientRect(); return !!e.offsetParent && r.width > 4 && r.height > 4 };`
const JS_ALVOS = `(() => { ${JS_VIS}
  const rot = (e) => (e.innerText.trim() || e.getAttribute('aria-label') || e.getAttribute('title') || '').trim().split('\\n')[0].trim().slice(0, 40);
  const grupos = [['menu', 'nav a, nav button, aside a, aside button, header a, header button, [role=navigation] a, [role=navigation] button'],
    ['cartao', 'main a, main button, main [role=button], main article, main [class*=cursor-pointer]']];
  const out = []; const visto = new Set(); let cartoes = 0;
  for (const [tipo, sel] of grupos) for (const e of document.querySelectorAll(sel)) {
    if (!vis(e)) continue; const t = rot(e);
    if (t.length < 2 || visto.has(t) || new RegExp(${JSON.stringify(NAO_TOCAR.source)}, 'i').test(t + ' ' + (e.getAttribute('aria-label') || ''))) continue;
    if (tipo === 'cartao' && ++cartoes > 2) continue;
    visto.add(t); out.push({ texto: t, tipo });
  }
  return out; })()`
const JS_ABRIR_MENU = `(() => { ${JS_VIS} const b = [...document.querySelectorAll('[aria-label*="menu" i], [title*="menu" i]')].find((e) => vis(e) && e.getAttribute('aria-expanded') !== 'true' && !/recolher|fechar/i.test(e.getAttribute('aria-label') || '')); if (b) b.click(); return !!b })()`
const JS_LOGIN = `((a) => { ${JS_VIS}
  const pw = [...document.querySelectorAll('input[type=password]')].find(vis); if (!pw) return false;
  const u = [...document.querySelectorAll('input:not([type=password]):not([type=hidden]):not([type=checkbox]):not([type=radio])')].find(vis);
  const por = (e, v) => { const s = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value')?.set; s ? s.call(e, v) : (e.value = v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) };
  if (u) por(u, a.usuario); por(pw, a.senha);
  const b = pw.form && pw.form.querySelector('button[type=submit], button:not([type=button])');
  if (b) b.click(); else if (pw.form) pw.form.requestSubmit(); return true })`
const JS_TEM_SENHA = `(() => { ${JS_VIS} return [...document.querySelectorAll('input[type=password]')].some(vis) })()`

/* ============================ o processo filho ============================ */

async function capturar(dist, saida, plano) {
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4' }
  /* CC-807: com `plano.url` (o endereço de teste do projeto) não há build nem
     servidor local: fotografa-se o que ele abriria de verdade. */
  const srv = plano.url ? null : http.createServer((req, res) => {
    let f = path.join(dist, decodeURIComponent(req.url.split('?')[0]))
    if (!f.startsWith(dist)) { res.writeHead(403); return res.end() }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html')
    res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' })
    fs.createReadStream(f).pipe(res)
  })
  if (srv) await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const url = plano.url || `http://127.0.0.1:${srv.address().port}/`
  /* CC-780: janela anônima própria, apagada no fim. Medido em 30/09: na aba
     comum o site abria LOGADO, com a sessão de uma captura anterior, e a foto
     nunca mostraria se o login barra quem não entrou. */
  const nav = new WebSocket((await (await fetch(CDP + '/json/version')).json()).webSocketDebuggerUrl)
  await new Promise((r, x) => { nav.addEventListener('open', r); nav.addEventListener('error', x) })
  let nn = 0; const espNav = new Map()
  nav.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (espNav.has(m.id)) { espNav.get(m.id)(m.result); espNav.delete(m.id) } })
  const cdpNav = (method, params = {}) => new Promise((r) => { const i = ++nn; espNav.set(i, r); nav.send(JSON.stringify({ id: i, method, params })) })
  const { browserContextId } = await cdpNav('Target.createBrowserContext', { disposeOnDetach: true })
  const { targetId } = await cdpNav('Target.createTarget', { url: 'about:blank', browserContextId })
  const tab = { id: targetId, webSocketDebuggerUrl: `${CDP.replace(/^http/, 'ws')}/devtools/page/${targetId}` }
  /* CC-822, medido em 01/10: o pai mata este processo no limite de tempo, e num
     jogo 3D renderizado por software a conferência passava dele. Morto sem
     passar pelo `finally`, deixava a aba aberta, e 12 abas do jogo em loop
     mantiveram a VPS inteira a 20 de carga. Duas defesas: um PRAZO PRÓPRIO,
     menor que o do pai, que encerra a exploração com o que já tem; e a limpeza
     também no SIGTERM. */
  const limite = Date.now() + (plano.prazoMs || 190000)
  const semTempo = () => Date.now() > limite
  let limpou = false
  const limpar = async () => {
    if (limpou) return; limpou = true
    await cdpNav('Target.closeTarget', { targetId }).catch(() => {})
    await cdpNav('Target.disposeBrowserContext', { browserContextId }).catch(() => {})
  }
  process.on('SIGTERM', () => { limpar().finally(() => process.exit(1)) })
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((r, x) => { ws.addEventListener('open', r); ws.addEventListener('error', x) })
  let n = 0; const esp = new Map()
  /* CC-807: o que está errado na página (resposta 4xx/5xx, erro de script, erro
     de console), anotado enquanto ela carrega. Quem ouve é o painel, que devolve
     ao agente. O favicon fica de fora: todo servidor de teste devolve 404 nele. */
  const problemas = new Set()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (esp.has(m.id)) { esp.get(m.id)(m.result); esp.delete(m.id); return }
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !/favicon\.ico/.test(m.params.response.url)) problemas.add(`resposta ${m.params.response.status} em ${m.params.response.url.replace(/^https?:\/\/[^/]+/, '')}`)
    else if (m.method === 'Runtime.exceptionThrown') problemas.add('erro no script: ' + String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0].slice(0, 160))
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problemas.add('erro no console: ' + String(m.params.args?.[0]?.value || m.params.args?.[0]?.description || '').slice(0, 160))
  })
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++n; esp.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
  await cdp('Network.enable'); await cdp('Runtime.enable')
  const passos = async (lista) => {
    for (const p of lista) {
      const r = await cdp('Runtime.evaluate', { expression: `(${JS_PASSO})(${JSON.stringify(p)})`, awaitPromise: true })
      if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || 'passo falhou')
    }
  }
  const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value
  // o mesmo destino tem o mesmo número no celular e no computador
  const ordem = new Map(); const numero = (nome) => { if (!ordem.has(nome)) ordem.set(nome, ordem.size + 1); return String(ordem.get(nome)).padStart(2, '0') }
  const limpo = (t) => String(t).replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'tela'
  try {
    for (const [larg, alt, tam] of [[390, 844, 'celular'], [1440, 900, 'computador']]) {
      if (semTempo()) { console.error(`tela: ${tam}: o tempo da conferência acabou antes deste tamanho`); break }
      const tela = (h) => cdp('Emulation.setDeviceMetricsOverride', { width: larg, height: h, deviceScaleFactor: 1, mobile: larg < 700 })
      /* Mais que a primeira tela: medido em 30/09, a foto do computador parava
         antes do player, e o revisor não conseguiu confirmar o conserto. Teto
         de altura para a foto continuar leve no telefone dele. */
      const foto = async (nome) => {
        const alto = (await ev('document.documentElement.scrollHeight')) || alt
        await tela(Math.min(Math.max(alto, alt), ALTURA_MAX)); await dorme(900)
        const s = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 72 })
        fs.writeFileSync(path.join(saida, `${numero(nome)}-${nome}-${tam}.jpg`), Buffer.from(s.data, 'base64'))
        await tela(alt)
      }
      const entrar = async () => { await ev(`(${JS_LOGIN})(${JSON.stringify(plano.acesso)})`); await dorme(1800) }
      await tela(alt)
      if (plano.explorar) {
        await cdp('Page.navigate', { url }); await dorme(plano.url ? 4500 : 2500)
        /* A tela de erro do Vite e a página em branco não dão 404 nem exceção:
           são exatamente o "abriu mas não é nada" que ninguém vê por código. */
        const erroVite = await ev(`(() => { const o = document.querySelector('vite-error-overlay'); return o ? (o.shadowRoot?.textContent || 'tela de erro do Vite').replace(/\\s+/g, ' ').slice(0, 160) : '' })()`)
        if (erroVite) problemas.add('o Vite mostra uma tela de erro: ' + erroVite)
        if (!(await ev(`document.body.innerText.trim().length > 3 || !!document.querySelector('canvas, img, svg')`))) problemas.add('a página abriu em branco')
        const temSenha = await ev(JS_TEM_SENHA)
        await foto(temSenha ? 'login' : 'inicio')
        let dentro = !temSenha
        if (temSenha && !plano.acesso) console.error(`tela: login (${tam}): sem login de teste cadastrado para este projeto, só a tela de login saiu`)
        if (temSenha && plano.acesso) {
          await entrar(); dentro = !(await ev(JS_TEM_SENHA))
          if (dentro) await foto('inicio'); else console.error(`tela: login (${tam}): o login de teste não entrou`)
        }
        if (dentro) {
          let alvos = (await ev(JS_ALVOS)) || []
          // menu atrás de botão (celular) ou recolhido em ícones sem nome (computador): abre e junta o que aparecer
          if (await ev(JS_ABRIR_MENU)) {
            await dorme(600)
            const doMenu = ((await ev(JS_ALVOS)) || []).filter((a) => !alvos.some((b) => b.texto === a.texto)).map((a) => ({ ...a, abrirMenu: true }))
            alvos = [...doMenu, ...alvos]
          }
          const vistos = new Set([await ev('document.body.innerText')])
          for (const a of alvos.slice(0, ALVOS_MAX)) {
            if (semTempo()) { console.error(`tela: ${a.texto} (${tam}): o tempo da conferência acabou antes de chegar aqui`); continue }
            try {
              await cdp('Page.navigate', { url }); await dorme(2200)
              if (plano.acesso && await ev(JS_TEM_SENHA)) await entrar() // login que não sobrevive à recarga
              if (a.abrirMenu) { await ev(JS_ABRIR_MENU); await dorme(600) }
              const r = await cdp('Runtime.evaluate', { expression: `(${JS_PASSO})(${JSON.stringify({ clicar: 'texto:' + a.texto, esperar: 1200 })})`, awaitPromise: true })
              if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || 'não abriu')
              const txt = await ev('document.body.innerText')
              if (vistos.has(txt)) continue // tocar não mudou nada, ou é tela já fotografada
              vistos.add(txt); await foto(limpo(a.texto))
            } catch (e) { console.error(`tela: ${a.texto} (${tam}): ${e.message}`) }
          }
        }
      }
      if (plano.entrar.length) {
        await cdp('Page.navigate', { url }); await dorme(2500)
        try { await passos(plano.entrar) } catch (e) { console.error(`tela: entrar (${tam}): ${e.message}`) }
      }
      for (const [i, t] of plano.telas.entries()) {
        try {
          await tela(alt)
          await cdp('Page.navigate', { url: url + t.caminho.slice(1) }); await dorme(2500)
          await passos(t.passos)
          if (plano.legado) {
            const s = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 72 })
            fs.writeFileSync(path.join(saida, `${tam}.jpg`), Buffer.from(s.data, 'base64'))
          } else await foto(t.nome)
        } catch (e) { console.error(`tela: ${t.nome} (${tam}): ${e.message}`) }
      }
    }
  } finally {
    try { fs.writeFileSync(path.join(saida, '_problemas.json'), JSON.stringify([...problemas].slice(0, 8))) } catch { /* sem anotação, o painel segue sem problemas */ }
    ws.close()
    await limpar()
    nav.close(); srv?.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === '--captura') {
  /* Sem plano, a página inicial: o painel em memória pode ser mais velho que
     este arquivo (o filho é lido do disco a cada foto), e em 30/09 isso quebrou
     a foto do Pierre com o painel antigo chamando o filho novo. */
  const plano = process.argv[5] ? JSON.parse(process.argv[5]) : { legado: true, entrar: [], telas: [{ nome: 'inicio', caminho: '/', passos: [] }] }
  capturar(process.argv[3], process.argv[4], plano).then(() => process.exit(0)).catch((e) => { console.error(String(e?.message || e)); process.exit(1) })
}
