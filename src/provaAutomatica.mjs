/**
 * CC-1095: o print que o robô tira de uma tela do painel para o Felipe avaliar sem sair do cockpit.
 *
 * Mesmo caminho do test-estreito-v2.mjs: a página sai do disco (src/ui_cockpit2.html), o dado real vem do painel
 * (GET em 127.0.0.1:5180) e todo POST responde {"ok":true}, então a coleta NUNCA grava em dado nenhum.
 * O navegador é o Chrome sem tela da VPS, por CDP (a chave é lida do abrigo e nunca impressa).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const PAGINA = 'https://cockpit.carzo.com.br/cockpit2'
const require = createRequire(import.meta.url)

/**
 * Abre `tela` (ex.: 'view-decisoes') na largura pedida e grava o print em `arquivo`. Devolve { largura, ms }.
 * `variantes`: [{ rotulo, antes: ['js', ...] }], uma foto por variante (o js roda na página antes dela), juntas lado a lado
 * com a legenda numa imagem só. Sem variantes, uma foto.
 */
export async function tirarPrint({ tela, largura = 390, altura = 844, seletor = null, variantes = null, origem = 'http://127.0.0.1:5180' }, arquivo) {
  const { chromium } = require('/usr/local/lib/hermes-agent/node_modules/playwright-core')
  const chave = fs.readFileSync(path.join(os.homedir(), '.local/share/browser-tools/chave'), 'utf8').trim()
  const html = fs.readFileSync(path.join(AQUI, 'ui_cockpit2.html'))
  const nav = await chromium.connectOverCDP('ws://127.0.0.1:9222?token=' + chave)
  const t0 = Date.now()
  try {
    const mobile = largura < 600
    const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile })
    const p = await ctx.newPage()
    const cdp = await ctx.newCDPSession(p)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile })
    await ctx.route('https://cockpit.carzo.com.br/**', async (rt) => {
      const u = new URL(rt.request().url())
      if (rt.request().method() !== 'GET') return rt.fulfill({ status: 200, body: '{"ok":true}', headers: { 'content-type': 'application/json' } })
      if (u.pathname === '/cockpit2') return rt.fulfill({ status: 200, body: html, headers: { 'content-type': 'text/html' } })
      try {
        const x = await fetch(origem + u.pathname + u.search)
        return rt.fulfill({ status: x.status, body: Buffer.from(await x.arrayBuffer()), headers: { 'content-type': x.headers.get('content-type') || 'text/plain' } })
      } catch { return rt.fulfill({ status: 502, body: '{}' }) }
    })
    await p.goto(PAGINA, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await p.waitForFunction(() => document.querySelector('.sidebar .nav-item'), null, { timeout: 60000 })
    await p.screenshot({ path: path.join(os.tmpdir(), 'prova-aquece.png') }) // o Chrome remoto só aplica a janela depois do primeiro print
    await p.evaluate((id) => document.querySelector('.sidebar .nav-item[data-target="' + id + '"]')?.click(), tela)
    // conteúdo estável: mesma contagem de elementos em 3 leituras seguidas, depois de 3,5 s (o dado chega por fetch)
    const raiz = '#' + tela
    const t1 = Date.now(); let ant = -1; let iguais = 0
    let cheia = false
    while (Date.now() - t1 < 90000) {
      // "lendo...", "carregando...": a tela ainda espera o dado (a VPS carregada leva dezenas de segundos)
      const n = await p.evaluate((s) => { const e = document.querySelector(s); const t = e ? e.innerText : ''; return e ? [t.length, e.querySelectorAll('*').length, /\.\.\.|…/.test(t) && t.trim().length < 200] : [0, 0, true] }, raiz)
      cheia = !n[2]
      iguais = cheia && n[0] > 20 && n[1] === ant && Date.now() - t1 > 3500 ? iguais + 1 : 0
      ant = n[1]
      if (iguais >= 3) break
      await p.waitForTimeout(600)
    }
    if (!cheia) throw new Error('a tela continuou em "lendo..." depois de 90 s; sem print, para não mostrar tela vazia')
    const iw = await p.evaluate(() => innerWidth)
    if (iw !== largura) throw new Error(`janela errada: largura ${iw}, pedida ${largura}; o print não vale`)
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    const foto = async () => {
      if (!seletor) return p.screenshot()
      const el = await p.$(seletor)
      if (!el) throw new Error(`não achei ${seletor} na tela agora (o dado de hoje pode não ter esse caso)`)
      await el.scrollIntoViewIfNeeded()
      await p.waitForTimeout(400)
      return el.screenshot()
    }
    if (!variantes) fs.writeFileSync(arquivo, await foto())
    else {
      const fotos = []
      for (const v of variantes) {
        for (const js of v.antes || []) await p.evaluate(js)
        await p.waitForTimeout(900)
        const medido = v.medir ? ` (medido: ${String(await p.evaluate(v.medir)).replace(/[<>&]/g, '')})` : ''
        fotos.push({ rotulo: v.rotulo + medido, b64: (await foto()).toString('base64') })
      }
      // lado a lado numa página em branco do mesmo navegador: sem biblioteca de imagem
      const junta = await ctx.newPage()
      await junta.setContent(`<body style="margin:0;padding:16px;display:flex;gap:16px;align-items:flex-start;background:#fff;font:600 22px sans-serif;width:max-content">${fotos.map((f) => `<figure style="margin:0"><figcaption style="margin-bottom:8px">${f.rotulo}</figcaption><img src="data:image/png;base64,${f.b64}" style="display:block;max-width:900px;border:1px solid #ccc"></figure>`).join('')}</body>`)
      await junta.screenshot({ path: arquivo, fullPage: true })
    }
    await ctx.close()
    return { largura: iw, ms: Date.now() - t0 }
  } finally { await nav.close().catch(() => {}) }
}

/* ---------- o baralho das provas e o voto que muda o estado ---------- */

export const DECK = 'provas-do-backlog'
const RECEITAS = path.join(AQUI, '..', 'dados', 'provas-receitas.json')
const semTraco = (s) => String(s || '').replace(/[—–]/g, ',')

/** Até 10 linhas não vazias de `arquivo` (~ = casa), a partir da primeira que casa com `de`. */
export function trecho({ arquivo, de, linhas = 8 }) {
  const t = fs.readFileSync(arquivo.replace(/^~/, os.homedir()), 'utf8').split(/\r?\n/)
  const i = t.findIndex((l) => new RegExp(de, 'i').test(l))
  if (i < 0) throw new Error(`não achei "${de}" em ${arquivo}`)
  return t.slice(i).filter((l) => l.trim()).slice(0, Math.min(linhas, 10)).map((l) => semTraco(l).trim().slice(0, 400))
}

export const receitas = () => { try { return JSON.parse(fs.readFileSync(RECEITAS, 'utf8')) } catch { return {} } }

/** Os itens em prova cuja conferência é olhar uma tela (`olho:`), o escopo que ele escolheu em 18/11. */
export async function itensDeOlho(raiz) {
  const B = await import('./backlog.mjs')
  return B.ler(B.caminhoPadrao(raiz)).itens.filter((x) => x.estado === 'PR' && /^olho:/.test(x.conferir || ''))
}

/**
 * Fotografa cada item que tem receita e grava a carta dele em docs/cartas/provas-do-backlog.json.
 * Um item por vez (a VPS vive carregada). Devolve { feitas, semReceita, falhas }.
 */
export async function montarDeck(raiz, { item = null, ensaio = false, aoLinha = () => {} } = {}) {
  const C = await import('./cartas.mjs')
  const rec = receitas()
  const alvo = (await itensDeOlho(raiz)).filter((x) => !item || x.id === item)
  const arq = path.join(raiz, 'docs', 'cartas', DECK + '.json')
  let deck = { titulo: 'Provas do backlog: o robô fotografou, você aprova', criado: new Date().toISOString(), cartas: [] }
  try { deck = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { /* primeira vez */ }
  const r = { feitas: [], semReceita: [], falhas: [] }
  for (const x of alvo) {
    const re = rec[x.id]
    if (!re) { r.semReceita.push(x.id); aoLinha(`${x.id}: sem receita`); continue }
    if (ensaio) { aoLinha(`${x.id}: ${re.texto ? 'leria' : 'fotografaria'} ${re.o_que}`); continue }
    const base = { id: x.id, titulo: semTraco(x.titulo).slice(0, 200), olhe: semTraco(x.conferir.replace(/^olho:/, '')).trim(), opcoes: ['Aprovo', 'Não aprovo'] }
    try {
      let carta; let ms = 0
      if (re.texto) {
        // item de "ler a regra": a carta traz o trecho, lido do arquivo agora, no lugar do print
        const linhas = trecho(re.texto)
        carta = { ...base, pergunta: `O trecho abaixo, de ${semTraco(re.o_que)}, diz o que você pediu?`, passos: linhas }
      } else {
        const img = `docs/cartas/provas/${x.id}.png`
        const f = await tirarPrint({ tela: re.tela, seletor: re.seletor, variantes: re.variantes, largura: re.largura || 390, altura: re.altura || 844 }, path.join(raiz, img))
        ms = f.ms
        carta = { ...base, pergunta: 'O que aparece no print é o que você pediu?', img,
          passos: [`o robô abriu a tela no painel em ${f.largura} px, com os dados de agora`, `esperou o dado chegar e fotografou ${semTraco(re.o_que)}`, `foto de ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`] }
      }
      deck.cartas = [...deck.cartas.filter((c) => c.id !== x.id), carta]
      r.feitas.push(x.id); aoLinha(`${x.id}: carta pronta${ms ? ` (${Math.round(ms / 1000)} s)` : ''}`)
    } catch (e) { r.falhas.push({ id: x.id, erro: e.message }); aoLinha(`${x.id}: falhou, ${e.message}`) }
  }
  if (r.feitas.length) {
    const erros = C.validarDeck(deck)
    if (erros.length) throw new Error('baralho inválido: ' + erros.join('; '))
    fs.writeFileSync(arq, JSON.stringify(deck, null, 2) + '\n')
  }
  return r
}

/** O voto dele vira estado: Aprovo fecha o item, Não aprovo volta para andando com a nota. O robô nunca vota. */
export async function aplicarVoto(raiz, carta, escolhas, nota = '') {
  const B = await import('./backlog.mjs')
  const arq = B.caminhoPadrao(raiz)
  const it = B.ler(arq).itens.find((x) => x.id === carta)
  if (!it || it.estado !== 'PR') return { ok: false, erro: `${carta} não está em prova` }
  const quando = new Date().toISOString().slice(0, 10)
  if (escolhas.includes('Aprovo')) B.mover(carta, 'OK', { prova: `aprovado por ele no Revisar um por um em ${quando}, olhando o print do robô${nota ? `: ${nota}` : ''}` }, arq)
  else B.mover(carta, 'EM', { porque: `não aprovado por ele no Revisar um por um em ${quando}${nota ? `: ${nota}` : ''}` }, arq)
  return { ok: true }
}

/** Os votos já gravados no baralho cujo item ainda está em prova (o painel antigo grava o voto sem mudar o estado). */
export async function aplicarVotosPendentes(raiz) {
  const C = await import('./cartas.mjs')
  const B = await import('./backlog.mjs')
  const emProva = new Set(B.ler(B.caminhoPadrao(raiz)).itens.filter((x) => x.estado === 'PR').map((x) => x.id))
  const feitos = []
  for (const v of C.votos(raiz, DECK)) if (emProva.has(v.carta)) { await aplicarVoto(raiz, v.carta, v.escolhas, v.nota); feitos.push(`${v.carta}: ${v.escolhas.join(', ')}`) }
  return feitos
}
