/* CC-912: a régua de toque e de letra do painel novo (cockpit2), em 390 px.
 *
 * Fora do `npm test` porque pede um Chrome e o painel no ar. Roda com:
 *   npm run test:toque                 mede e FALHA se sobrar alvo pequeno
 *   node --experimental-websocket test-estreito-v2.mjs --relatorio   só imprime
 *   node ... test-estreito-v2.mjs http://127.0.0.1:5180               origem dos dados
 *
 * Como conecta: no Chrome sem tela da VPS, por CDP, com o Playwright do hermes-agent.
 * A página é servida do disco (src/ui_cockpit2.html) por interceptação de
 * https://cockpit.carzo.com.br/** ; GET de dados vai para o painel (padrão 5180),
 * POST responde {"ok":true} e nunca grava nada.
 *
 * A tela muda a cada 2 s e abre dados reais: a medição conta o que o DOM tem
 * naquele instante. Por isso espera o CONTEÚDO estabilizar, não um tempo cego.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const HTML = path.join(AQUI, 'src', 'ui_cockpit2.html')
const RELATORIO = process.argv.includes('--relatorio')
const ORIGEM = process.argv.slice(2).find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:5180'
const PAGINA = 'https://cockpit.carzo.com.br/cockpit2'

const ALVO = 44 // altura mínima de toque (D9) nas telas que existem
const LETRA = 12 // letra mínima (D10); o Tinder novo já nasce com 14
// CC-966: a régua da largura é a faixa do topo. Em 390 px de verdade o menu tem centro em 30 (8 de recuo + 22)
// e o último botão da direita em 360 (390 - 30); em 500 px ele sairia em 470.
// CC-970: à direita ficam lupa, sino e o painel de responder; o último é o painel, e o sino fica em 316.
const TOPO = { menu: 30, sino: 316, lado: 360, alt: 52 }

const TELAS = ['view-inicio', 'view-projetos2', 'view-decisoes', 'view-armario', 'view-ideias', 'view-design',
  'view-servidores2', 'view-gate', 'view-trabalho', 'view-analise', 'view-escritorio', 'view-tempo', 'view-agenda',
  'view-conhecimento', 'view-infra', 'view-infra:vps', 'view-remoto', 'view-caminho', 'view-tarefas']

/* Cada exceção traz o seletor e o MOTIVO. Sem motivo escrito, não entra. */
const EXCECOES = [
  { alvo: 'button.ajuda', motivo: 'bolinha "?" de 15px colada na palavra que explica; um círculo de 44px no meio do texto quebraria a linha. A área de toque é de uns 45x45 por ::after (inset: -16px), conferida em seguida pelo tamanho do ::after.' },
]
const EXCECOES_LETRA = []

const ESPERA = { 'view-projetos2': '.pj-barra', 'view-caminho': '.cam-no' }

const SELETOR ='button, [role=tab], [role=button], select, input:not([type=hidden]), summary, label:has(input), a.btn'

let falhas = 0
const dizer = (s) => console.log(s)

/* ---------- medição dentro da página ---------- */
function medirNaPagina({ raizSel, ALVO, LETRA, SELETOR, exc, excLetra }) {
  const raiz = document.querySelector(raizSel)
  if (!raiz) return null
  const visivel = (e) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' && !e.closest('[hidden]')
  }
  // [style] = tamanho de letra escrito em style="" no HTML (só uma regra com !important alcança)
  // sem classe própria, mostra a do pai ("span<button.ini-card"), para achar a regra certa
  const chave = (e) => {
    const c = (e.classList && e.classList[0]) || ''; const pai = e.parentElement
    const dono = !c && pai ? '<' + pai.tagName.toLowerCase() + (pai.classList[0] ? '.' + pai.classList[0] : '') : ''
    return e.tagName.toLowerCase() + (c ? '.' + c : '') + dono + (e.style && e.style.fontSize ? '[style]' : '')
  }
  const rotulo = (e) => (e.getAttribute('aria-label') || e.innerText || e.title || e.value || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 24)
  const nota = (mapa, e, extra) => { const k = chave(e); const m = mapa[k] || (mapa[k] = { n: 0, min: 9999, ex: rotulo(e) }); m.n++; m.min = Math.min(m.min, extra); }
  const pequenos = {}; const aceitos = {}; const miudas = {}; const miudasAceitas = {}
  let total = 0
  for (const e of raiz.querySelectorAll(SELETOR)) {
    if (e.disabled || !visivel(e)) continue
    // checkbox e radio soltos dentro de label: quem recebe o toque é o label, que também é medido
    if (e.matches('input[type=checkbox],input[type=radio]') && e.closest('label')) continue
    total++
    const h = e.getBoundingClientRect().height
    if (h < ALVO - 0.5) {
      const ex = exc.find((x) => e.matches(x.alvo))
      nota(ex ? aceitos : pequenos, e, Math.round(h))
    }
  }
  let textos = 0
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  while (w.nextNode()) {
    const n = w.currentNode; if (!n.nodeValue.trim()) continue
    const e = n.parentElement
    if (!e || e.closest('svg,script,style,option,noscript') || !visivel(e)) continue
    textos++
    const f = parseFloat(getComputedStyle(e).fontSize)
    if (f < LETRA - 0.01) {
      const ex = excLetra.find((x) => e.matches(x.alvo))
      nota(ex ? miudasAceitas : miudas, e, f)
    }
  }
  const r = document.querySelector('.main-content')
  return { total, textos, pequenos, aceitos, miudas, miudasAceitas, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, conteudoW: r ? r.scrollWidth : 0, conteudoC: r ? r.clientWidth : 0 }
}

const soma = (m) => Object.values(m).reduce((a, x) => a + x.n, 0)
const topo = (m, k = 6) => Object.entries(m).sort((a, b) => b[1].n - a[1].n).slice(0, k).map(([c, x]) => `${c} x${x.n} (min ${x.min}, "${x.ex}")`).join('; ')

/* espera o conteúdo da tela parar de mudar de tamanho (duas leituras iguais), com teto */
async function esperarConteudo(p, raizSel) {
  // estável = a mesma contagem de elementos em 3 leituras seguidas (o texto muda sozinho: relógios e "há 1h")
  const t0 = Date.now(); let ant = -1; let iguais = 0
  while (Date.now() - t0 < 20000) {
    const r = await p.evaluate((s) => { const e = document.querySelector(s); return e ? [e.innerText.length, e.querySelectorAll('*').length] : [0, 0] }, raizSel)
    // a tela só vale depois de 3,5 s da abertura: o dado chega por fetch e o DOM muda de tamanho de uma vez
    iguais = r[0] > 20 && r[1] === ant && Date.now() - t0 > 3500 ? iguais + 1 : 0
    ant = r[1]
    // tela com menos de 25 elementos ainda pode estar esperando o dado (Ideias abriu com 1 botão): dá mais tempo
    if (iguais >= 3 && (r[1] >= 25 || Date.now() - t0 > 10000)) return Date.now() - t0
    await p.waitForTimeout(600)
  }
  return -1
}

async function novoContexto(nav, L, H, mobile, html) {
  const ctx = await nav.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: L, height: H, deviceScaleFactor: 1, mobile })
  await ctx.route('https://cockpit.carzo.com.br/**', async (rt) => {
    const u = new URL(rt.request().url())
    if (rt.request().method() !== 'GET') return rt.fulfill({ status: 200, body: '{"ok":true}', headers: { 'content-type': 'application/json' } })
    if (u.pathname === '/cockpit2') return rt.fulfill({ status: 200, body: html(), headers: { 'content-type': 'text/html' } })
    try { const x = await fetch(ORIGEM + u.pathname + u.search); return rt.fulfill({ status: x.status, body: Buffer.from(await x.arrayBuffer()), headers: { 'content-type': x.headers.get('content-type') || 'text/plain' } }) } catch { await rt.abort() }
  })
  p.on('pageerror', (e) => { if (!/ResizeObserver/.test(e.message)) dizer('  erro na página: ' + e.message.slice(0, 120)) })
  await p.goto(PAGINA, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await p.waitForFunction(() => document.querySelector('.sidebar .nav-item'), null, { timeout: 60000 })
  // o Chrome remoto só aplica a janela depois do primeiro screenshot
  await p.screenshot({ path: path.join(os.tmpdir(), 'toque-aquece.png') })
  await p.waitForTimeout(1500)
  return { ctx, p }
}

/* ---------- principal ---------- */
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('/usr/local/lib/hermes-agent/node_modules/playwright-core')) } catch { dizer('Playwright do hermes-agent não encontrado: este teste só roda na VPS.'); process.exit(2) }
const chave = fs.readFileSync(path.join(os.homedir(), '.local/share/browser-tools/chave'), 'utf8').trim()
const nav = await chromium.connectOverCDP('ws://127.0.0.1:9222?token=' + chave)
let saida = 0
try {
  const html = () => fs.readFileSync(HTML)
  const { ctx, p } = await novoContexto(nav, 390, 844, true, html)
  const iw = await p.evaluate(() => innerWidth)
  if (iw !== 390) { dizer(`janela errada: innerWidth ${iw}, esperado 390. Medida não vale.`); process.exit(2) }

  const linhas = []
  const grandeTotal = { pequenos: {}, miudas: {} }
  for (const alvo of TELAS) {
    const [id, aba] = alvo.split(':')
    await p.evaluate(({ id, aba }) => {
      const a = document.querySelector('.sidebar .nav-item[data-target="' + id + '"]'); if (a) a.click()
      if (aba) document.querySelector('[data-infra="' + aba + '"]')?.click()
    }, { id, aba })
    const raizSel = '#' + id
    // telas cujo dado vem por varredura lenta: espera o item que prova que a lista chegou
    if (ESPERA[id]) await p.waitForSelector(raizSel + ' ' + ESPERA[id], { timeout: 30000 }).catch(() => dizer('  aviso: ' + id + ' não mostrou ' + ESPERA[id] + ' em 30 s'))
    const ms = await esperarConteudo(p, raizSel)
    const m = await p.evaluate(medirNaPagina, { raizSel, ALVO, LETRA, SELETOR, exc: EXCECOES, excLetra: EXCECOES_LETRA })
    if (!m) { linhas.push({ alvo, erro: 'tela não existe' }); continue }
    linhas.push({ alvo, ms, ...m })
    for (const [k, x] of Object.entries(m.pequenos)) { const g = grandeTotal.pequenos[k] || (grandeTotal.pequenos[k] = { n: 0, min: 9999, ex: x.ex }); g.n += x.n; g.min = Math.min(g.min, x.min) }
    for (const [k, x] of Object.entries(m.miudas)) { const g = grandeTotal.miudas[k] || (grandeTotal.miudas[k] = { n: 0, min: 9999, ex: x.ex }); g.n += x.n; g.min = Math.min(g.min, x.min) }
  }

  /* as duas exceções de desenho prometem área de toque por ::after: confere o tamanho dela */
  await p.evaluate(() => document.querySelector('.sidebar .nav-item[data-target="view-tempo"]').click())
  await p.waitForSelector('#view-tempo .ajuda', { timeout: 15000 }).catch(() => {})
  const pseudo = await p.evaluate(() => {
    const f = (sel) => { const e = document.querySelector(sel); if (!e || !e.getBoundingClientRect().width) return null; const c = getComputedStyle(e, '::after'); return [Math.round(parseFloat(c.width)), Math.round(parseFloat(c.height))] }
    return { ajuda: f('#view-tempo .ajuda') }
  })
  /* o Tinder (peça 1): abre uma pergunta pendente, se houver */
  await p.evaluate(() => document.querySelector('.sidebar .nav-item[data-target="view-inicio"]').click())
  await p.waitForTimeout(1500)
  const abriu = await p.evaluate(() => { const b = document.querySelector('[data-tdr-abrir]'); if (!b) return false; b.click(); return true })
  if (abriu) {
    await p.waitForFunction(() => document.body.classList.contains('tdr-on') && document.querySelector('#tdr-portal .tdr-carta'), null, { timeout: 10000 }).catch(() => {})
    await p.waitForTimeout(900)
    const m = await p.evaluate(medirNaPagina, { raizSel: '#tdr-portal', ALVO, LETRA, SELETOR, exc: EXCECOES, excLetra: EXCECOES_LETRA })
    if (m) linhas.push({ alvo: 'tinder (44 e 12)', ms: 0, ...m })
    await p.evaluate(() => document.querySelector('[data-tdr-fechar]')?.click())
  } else linhas.push({ alvo: 'tinder', erro: 'sem pergunta pendente agora: NAO medido' })

  /* CC-920 (F2), o teste do polegar: no Tinder, em 390x844, com cartas de PROVA injetadas, todo botão de
     resposta fica na metade de baixo (rect.top >= 0.45 * innerHeight). A rota de provas é simulada com
     3 cartas de fixture; o POST já responde {ok:true} e nada grava. Mede a carta, depois com "Aprovar
     todas as que vi" na tela, depois com a confirmação aberta. */
  const provasFix = [1, 2, 3].map((n) => ({ id: 'FX-' + n, raiz: '/fixture/projeto', projeto: 'projeto-fixture', titulo: 'Prova de fixture ' + n + ': conferir a tela no telefone', porque: 'o que foi provado na fixture ' + n, opcoes: ['Aprovo', 'Não aprovo'], origem: 'prova' }))
  await ctx.route(/\/api\/backlog\/provas/, (rt) => rt.fulfill({ status: 200, body: JSON.stringify({ ok: true, cartas: provasFix }), headers: { 'content-type': 'application/json' } }))
  const polegar = []
  const medirPolegar = (rotulo) => p.evaluate((r) => {
    const H = innerHeight, lim = 0.45 * H
    const bs = [...document.querySelectorAll('.tdr-op, .tdr-fim button, [data-tdr-pronto], [data-tdr-aprovar-todas]')].filter((e) => e.getBoundingClientRect().height > 0)
    return { rotulo: r, n: bs.length, altura: H, limite: Math.round(lim), acima: bs.filter((e) => e.getBoundingClientRect().top < lim).map((e) => (e.innerText || '').trim().slice(0, 30)) }
  }, rotulo)
  await p.evaluate(() => document.querySelector('.sidebar .nav-item[data-target="view-decisoes"]').click())
  await p.waitForTimeout(1500)
  if (await p.evaluate(() => { const b = document.querySelector('.tdr-entrar'); if (!b) return false; b.click(); return true })) {
    await p.waitForTimeout(1500)
    await p.evaluate(() => document.querySelector('[data-tdr-orig="provas"]')?.click()); await p.waitForTimeout(600)
    if (await p.evaluate(() => Boolean(document.querySelector('.tdr-carta[data-tdr-carta^="prova:"]')))) {
      polegar.push(await medirPolegar('carta de prova'))
      await p.evaluate(() => document.querySelector('[data-tdr-pular]')?.click()); await p.waitForTimeout(900)
      polegar.push(await medirPolegar('com "Aprovar todas as que vi"'))
      await p.evaluate(() => document.querySelector('[data-tdr-aprovar-todas]')?.click()); await p.waitForTimeout(600)
      polegar.push(await medirPolegar('confirmação'))
    } else polegar.push({ erro: 'a carta de prova injetada não apareceu: NAO medido' })
    await p.evaluate(() => document.querySelector('[data-tdr-fechar]')?.click())
  } else polegar.push({ erro: 'botão "Decidir um por um" não apareceu: NAO medido' })

  /* CC-966 (peça 1): a gaveta lateral. Abre pelo botão de menu da faixa do topo (.topo-menu),
     deslizando da esquerda, e fecha nos cinco jeitos. */
  const gav = {}
  await p.evaluate(() => document.querySelector('.sidebar .nav-item[data-target="view-inicio"]').click())
  await p.waitForTimeout(600)
  const abrirMenu = async () => { await p.evaluate(() => document.querySelector('.topo-menu').click()); await p.waitForTimeout(450) }
  const lerGaveta = () => p.evaluate(() => {
    const g = document.querySelector('#gaveta .gaveta'); const r = g.getBoundingClientRect(); const b = document.querySelector('.topo-menu')
    return { esq: Math.round(r.left), dir: Math.round(r.right), oculta: document.getElementById('gaveta').hidden, foco: document.activeElement?.className || '', focoNoBotao: document.activeElement === b, inert: document.querySelector('.main-content').inert, exp: b.getAttribute('aria-expanded'), ativa: document.querySelector('#gaveta .nav-item.active')?.dataset.target || '', atual: document.querySelector('.view-section.active')?.id || '' }
  })
  await abrirMenu()
  gav.aberta = await lerGaveta()
  // abre todos os grupos para medir todos os itens, e devolve o estado depois
  const eram = await p.evaluate(() => [...document.querySelectorAll('#gaveta .nav-section')].map((s) => s.classList.contains('fechado')))
  await p.evaluate(() => document.querySelectorAll('#gaveta .nav-section').forEach((s) => s.classList.remove('fechado')))
  gav.medida = await p.evaluate(medirNaPagina, { raizSel: '#gaveta', ALVO, LETRA, SELETOR: SELETOR + ', a.nav-item', exc: EXCECOES, excLetra: EXCECOES_LETRA })
  await p.evaluate((e) => document.querySelectorAll('#gaveta .nav-section').forEach((s, i) => s.classList.toggle('fechado', e[i])), eram)
  await p.keyboard.press('Escape'); await p.waitForTimeout(450)
  gav.esc = await lerGaveta()
  await abrirMenu()
  await p.evaluate(() => document.getElementById('gaveta').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await p.waitForTimeout(450)
  gav.fundo = await lerGaveta()
  await abrirMenu()
  await p.evaluate(() => {
    const g = document.querySelector('#gaveta .gaveta')
    const toque = (tipo, x) => g.dispatchEvent(new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: tipo === 'touchend' ? [] : [new Touch({ identifier: 1, target: g, clientX: x, clientY: 300 })] }))
    toque('touchstart', 260); for (const x of [245, 200, 150, 120]) toque('touchmove', x); toque('touchend', 120)
  }); await p.waitForTimeout(450)
  gav.arrastar = await lerGaveta()
  await abrirMenu()
  await p.evaluate(() => document.querySelector('#gaveta .nav-item[data-target="view-projetos2"]').click()); await p.waitForTimeout(450)
  gav.tela = await lerGaveta()
  await abrirMenu()
  await p.evaluate(() => document.querySelector('#gaveta [data-sb-grade]').click()); await p.waitForTimeout(500)
  gav.apps = await lerGaveta()
  gav.grade = await p.evaluate(medirNaPagina, { raizSel: '#tela-grade', ALVO, LETRA, SELETOR: SELETOR + ', a.tg-item', exc: EXCECOES, excLetra: EXCECOES_LETRA })
  gav.mortos = await p.evaluate(() => document.querySelectorAll('#tela-grade [data-tg-ir=""]').length)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)

  /* CC-966 (peça 2): a régua nova, a faixa do topo. Na Início, no alto e rolado 600 px. */
  await p.evaluate(() => document.querySelector('.sidebar .nav-item[data-target="view-inicio"]').click())
  await p.waitForTimeout(1200)
  const medirTopo = () => p.evaluate(() => {
    const mc = document.querySelector('.main-content'); const h = mc.querySelector(':scope > header.header')
    const c = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.left + r.width / 2) }
    const hr = h.getBoundingClientRect()
    return { rolou: mc.scrollTop, topo: Math.round(hr.top), alt: Math.round(hr.height), menu: c('.topo-menu'), sino: c('#sino'), lado: c('.topo-lado'), titulo: c('#header-title'), texto: document.getElementById('header-title').textContent.trim(),
      // o título cabe entre o menu e a lupa, sem encostar em nenhum dos dois
      tituloCabe: (() => { const t = document.getElementById('header-title').getBoundingClientRect(), m = document.querySelector('.topo-menu').getBoundingClientRect(), b = document.querySelector('.topo-buscar').getBoundingClientRect(); return t.left >= m.right && t.right <= b.left })() }
  })
  const topoAlto = await medirTopo()
  await p.evaluate(() => { document.querySelector('.main-content').scrollTop = 600 }); await p.waitForTimeout(400)
  const topoRolado = await medirTopo()
  await p.evaluate(() => { document.querySelector('.main-content').scrollTop = 0 })
  const some = await p.evaluate(() => ['.topo-busca', '#bt-modos', '.main-content > header.header .fonte-ctl', '.sidebar', '.ini-hero-txt'].filter((s) => { const e = document.querySelector(s); return e && e.getBoundingClientRect().width > 0 }))
  const faixa = await p.evaluate(medirNaPagina, { raizSel: '.main-content > header.header', ALVO, LETRA, SELETOR, exc: EXCECOES, excLetra: EXCECOES_LETRA })

  // CC-966 (peça 3): no celular não há barra de baixo
  const semBarra = await p.evaluate(() => !document.querySelector('.barra-baixo, .bb-item'))

  await ctx.close()

  /* PC: a régua não pode ter pegado. Compara a MESMA tela com e sem o bloco CC-912. */
  const sem = () => Buffer.from(String(fs.readFileSync(HTML)).replace(/\/\* CC-912: régua de toque[\s\S]*?\/\* fim CC-912 \*\//, ''))
  const medidaPc = async (fn) => {
    const { ctx: c2, p: p2 } = await novoContexto(nav, 1280, 900, false, fn)
    const iw2 = await p2.evaluate(() => innerWidth)
    await esperarConteudo(p2, '#view-inicio')
    const r = await p2.evaluate(() => {
      const out = {}
      for (const e of document.querySelectorAll('#view-inicio button, #view-inicio select, #view-inicio input:not([type=hidden]), .sidebar a.nav-item')) {
        const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue
        const k = e.tagName.toLowerCase() + '.' + ((e.classList && e.classList[0]) || '')
        out[k] = Math.min(out[k] || 9999, Math.round(b.height))
      }
      // CC-966: o cabeçalho, a barra lateral e o botão de menu (que no computador não pode aparecer)
      const hd = document.querySelector('.main-content > header.header'); out.cabecalho = hd ? Math.round(hd.getBoundingClientRect().height) : 0
      const sb = document.querySelector('.sidebar'); out['barra-lateral'] = sb ? Math.round(sb.getBoundingClientRect().width) : 0
      const tm = document.querySelector('.topo-menu'); out['botao-menu'] = tm ? Math.round(tm.getBoundingClientRect().width) : 0
      return out
    })
    await c2.close(); return { iw: iw2, r }
  }
  const com = await medidaPc(html); const so = await medidaPc(sem)
  const difs = Object.keys(com.r).filter((k) => k in so.r && com.r[k] !== so.r[k]).map((k) => `${k}: ${so.r[k]} -> ${com.r[k]}`)
  const pcAmostra = Object.keys(com.r).filter((k) => k in so.r).length
  // CC-966: o mesmo PC com e sem o bloco novo; nada pode mudar
  const sem966 = () => Buffer.from(String(fs.readFileSync(HTML)).replace(/\/\* CC-966: celular sem barra de baixo \*\/[\s\S]*?\/\* fim CC-966 \*\//, ''))
  const so966 = await medidaPc(sem966)
  const difs966 = Object.keys(com.r).filter((k) => k in so966.r && com.r[k] !== so966.r[k]).map((k) => `${k}: ${so966.r[k]} -> ${com.r[k]}`)

  /* ---------- relatório ---------- */
  dizer('\nRÉGUA DE TOQUE E LETRA, 390 px (alvo ' + ALVO + ' px, letra ' + LETRA + ' px). Contagem do DOM no instante da medida.\n')
  dizer('tela'.padEnd(20) + 'alvos'.padStart(6) + 'peq.'.padStart(6) + 'aceit.'.padStart(7) + 'texto'.padStart(7) + 'miúda'.padStart(7) + '  scrollW')
  for (const l of linhas) {
    if (l.erro) { dizer(l.alvo.padEnd(20) + '  ' + l.erro); continue }
    dizer(l.alvo.padEnd(20) + String(l.total).padStart(6) + String(soma(l.pequenos)).padStart(6) + String(soma(l.aceitos)).padStart(7) + String(l.textos).padStart(7) + String(soma(l.miudas)).padStart(7) + '  ' + l.scrollW + '/' + l.innerW)
    if (RELATORIO || soma(l.pequenos) || soma(l.miudas)) {
      if (soma(l.pequenos)) dizer('    alvos pequenos: ' + topo(l.pequenos))
      if (soma(l.miudas)) dizer('    letra miúda:    ' + topo(l.miudas))
    }
  }
  if (RELATORIO) {
    dizer('\nGRUPOS mais frequentes (todas as telas)')
    dizer('  alvos pequenos: ' + topo(grandeTotal.pequenos, 25))
    dizer('  letra miúda:    ' + topo(grandeTotal.miudas, 25))
  }
  for (const m of polegar) dizer(m.erro ? `polegar: ${m.erro}` : `polegar (${m.rotulo}): ${m.n} botões, todos abaixo de ${m.limite}px de ${m.altura}: ${m.acima.length === 0}`)
  dizer(`\ngaveta (CC-966): aberta de ${gav.aberta.esq} a ${gav.aberta.dir}, foco em "${gav.aberta.foco}", inert ${gav.aberta.inert}; alvos pequenos ${gav.medida ? soma(gav.medida.pequenos) : '?'}, letra miúda ${gav.medida ? soma(gav.medida.miudas) : '?'}; galeria: pequenos ${gav.grade ? soma(gav.grade.pequenos) : '?'}, miúda ${gav.grade ? soma(gav.grade.miudas) : '?'}, ícones mortos ${gav.mortos}`)
  if (gav.medida && soma(gav.medida.miudas)) dizer('    gaveta, letra miúda: ' + topo(gav.medida.miudas))
  if (gav.medida && soma(gav.medida.pequenos)) dizer('    gaveta, alvos pequenos: ' + topo(gav.medida.pequenos))
  dizer(`\nfaixa do topo (CC-966): menu ${topoAlto.menu}, título ${topoAlto.titulo} ("${topoAlto.texto}"), sino ${topoAlto.sino}, painel ${topoAlto.lado} (esperado ${TOPO.menu}/${TOPO.sino}/${TOPO.lado}); altura ${topoAlto.alt}; top ${topoAlto.topo} no alto e ${topoRolado.topo} rolado ${topoRolado.rolou} px; ainda com largura: ${some.join(', ') || 'nada'}; alvos pequenos ${faixa ? soma(faixa.pequenos) : '?'}, letra miúda ${faixa ? soma(faixa.miudas) : '?'}`)
  dizer(`\nbarra de baixo: ${semBarra ? 'não existe mais (CC-966)' : 'AINDA EXISTE'}`)
  dizer(`área de toque por ::after: "?" de ajuda ${pseudo.ajuda ? pseudo.ajuda.join('x') : 'nao apareceu'}`)
  dizer(`PC 1280 px: janela ${com.iw}/${so.iw}; ${pcAmostra} grupos comparados com e sem o bloco CC-912; diferenças: ${difs.length ? difs.join('; ') : 'nenhuma'}`)
  dizer(`PC 1280 px, CC-966: ${Object.keys(com.r).filter((k) => k in so966.r).length} grupos comparados com e sem o bloco CC-966; cabeçalho ${com.r.cabecalho}, barra lateral ${com.r['barra-lateral']}, botão de menu ${com.r['botao-menu']}; diferenças: ${difs966.length ? difs966.join('; ') : 'nenhuma'}`)
  if (EXCECOES.length || EXCECOES_LETRA.length) {
    dizer('\nEXCEÇÕES declaradas')
    for (const x of [...EXCECOES, ...EXCECOES_LETRA]) dizer('  ' + x.alvo + ' : ' + x.motivo)
  }

  /* ---------- veredito ---------- */
  const t = (nome, cond) => { if (!cond) { falhas++; dizer('  FALHA: ' + nome) } }
  if (!RELATORIO) {
    for (const l of linhas) {
      if (l.erro) { if (!/sem pergunta/.test(l.erro)) t(l.alvo + ': ' + l.erro, false); continue }
      t(`${l.alvo}: ${soma(l.pequenos)} alvo(s) abaixo da régua`, soma(l.pequenos) === 0)
      t(`${l.alvo}: ${soma(l.miudas)} texto(s) com letra miúda`, soma(l.miudas) === 0)
      t(`${l.alvo}: rola de lado (${l.scrollW} > ${l.innerW})`, l.scrollW <= l.innerW)
    }
    for (const m of polegar) {
      if (m.erro) { t('polegar: ' + m.erro, false); continue }
      t(`polegar (${m.rotulo}): ${m.n} botão(ões), acima de ${m.limite}px: ${m.acima.join(', ') || 'nenhum'}`, m.n > 0 && m.acima.length === 0)
    }
    // CC-966 peça 1: a gaveta
    t('gaveta: não ocupa de 0 a 320 px', Math.abs(gav.aberta.esq) <= 2 && Math.abs(gav.aberta.dir - 320) <= 2)
    t('gaveta: o foco não foi para o X', /gaveta-x/.test(gav.aberta.foco))
    t('gaveta: o resto da página não ficou inerte', gav.aberta.inert === true)
    t('gaveta: aria-expanded não é "true" aberta', gav.aberta.exp === 'true')
    t('gaveta: o item aceso não é a tela aberta (' + gav.aberta.ativa + ' contra ' + gav.aberta.atual + ')', gav.aberta.ativa === gav.aberta.atual)
    t('gaveta: ' + (gav.medida ? soma(gav.medida.pequenos) : '?') + ' alvo(s) abaixo de ' + ALVO, !!gav.medida && soma(gav.medida.pequenos) === 0)
    t('gaveta: ' + (gav.medida ? soma(gav.medida.miudas) : '?') + ' texto(s) com letra miúda', !!gav.medida && soma(gav.medida.miudas) === 0)
    for (const [jeito, e] of [['Esc', gav.esc], ['o fundo', gav.fundo], ['arrastar', gav.arrastar]]) {
      t('gaveta: ' + jeito + ' não fechou', e.oculta === true)
      t('gaveta: ' + jeito + ' deixou a página inerte ou o menu "aberto"', e.inert === false && e.exp === 'false')
    }
    t('gaveta: Esc não devolveu o foco ao botão de menu', gav.esc.focoNoBotao === true)
    t('gaveta: escolher tela não fechou a gaveta ou não abriu Projetos', gav.tela.oculta === true && gav.tela.atual === 'view-projetos2')
    t('gaveta: Ver aplicativos não fechou a gaveta ou não abriu a galeria', gav.apps.oculta === true && !!gav.grade)
    t('galeria: ' + (gav.grade ? soma(gav.grade.pequenos) : '?') + ' alvo(s) pequeno(s) e ' + (gav.grade ? soma(gav.grade.miudas) : '?') + ' letra(s) miúda(s)', !!gav.grade && soma(gav.grade.pequenos) === 0 && soma(gav.grade.miudas) === 0)
    t('galeria: ' + gav.mortos + ' ícone(s) morto(s) sem tela', gav.mortos === 0)
    // CC-966 peça 2: a faixa do topo
    t('faixa do topo: menu, sino ou painel fora do esperado (' + topoAlto.menu + '/' + topoAlto.sino + '/' + topoAlto.lado + '), a medida de 390 px não vale', Math.abs(topoAlto.menu - TOPO.menu) <= 4 && Math.abs(topoAlto.sino - TOPO.sino) <= 4 && Math.abs(topoAlto.lado - TOPO.lado) <= 4)
    t('faixa do topo: o nome da tela encosta no menu ou na lupa, ou não é "Início" (' + topoAlto.titulo + ', "' + topoAlto.texto + '")', topoAlto.tituloCabe && topoAlto.texto === 'Início')
    t('faixa do topo: altura ' + topoAlto.alt + ' em vez de ' + TOPO.alt, topoAlto.alt === TOPO.alt)
    t('faixa do topo: não ficou presa (top ' + topoAlto.topo + ' no alto, ' + topoRolado.topo + ' rolado)', topoRolado.rolou > 0 && topoAlto.topo === 0 && topoRolado.topo === 0)
    t('faixa do topo: ainda aparece com largura: ' + some.join(', '), some.length === 0)
    t('faixa do topo: alvo pequeno ou letra miúda', !!faixa && soma(faixa.pequenos) === 0 && soma(faixa.miudas) === 0)
    t('"?" de ajuda sem área de toque de 44px por ::after', !!pseudo.ajuda && pseudo.ajuda[0] >= 44 && pseudo.ajuda[1] >= 44)
    t('a barra de baixo ainda existe no celular', semBarra)
    t('PC: a régua mudou altura de ' + difs.join('; '), difs.length === 0 && com.iw === 1280 && so.iw === 1280 && pcAmostra > 5)
    t('PC: o bloco CC-966 mudou ' + difs966.join('; ') + ' ou o botão de menu apareceu', difs966.length === 0 && com.r['botao-menu'] === 0 && so966.iw === 1280)
    dizer(falhas ? `\n${falhas} falha(s)` : '\nzero alvos pequenos fora das exceções, zero letra miúda, PC intacto')
    saida = falhas ? 1 : 0
  }
} catch (e) {
  dizer('FALHOU: ' + (e && e.message ? e.message.slice(0, 400) : e)); saida = 2
}
process.exit(saida)
