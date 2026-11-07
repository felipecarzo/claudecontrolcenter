/* CC-1066: o print de cada carta de texto de um baralho do "Decidir um por um".
   Abre a página da carta (campo `link`), acha o bloco que mostra o texto, marca com contorno rosa e fotografa
   o celular (390 px). A carta ganha `img`; se não deu, ganha `sem_print` com o motivo.
   As funções puras (sem navegador) são testadas no gate; `imprimir` precisa do Chrome e roda fora do sandbox. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { validarDeck } from './cartas.mjs'

/** minúsculo, sem acento, espaços colapsados: a página pode mostrar o texto em CAIXA ALTA por CSS */
export function normalizar(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** O texto que a carta mostra: `editar`, senão o texto entre aspas da primeira linha de `olhe`, senão o que vem em "Como aparece". */
export function textoDaCarta(c) {
  if (typeof c.editar === 'string' && c.editar.trim()) return c.editar.trim()
  const olhe = String(c.olhe || '')
  const aspas = olhe.split('\n')[0].match(/"(.+)"/)
  if (aspas && aspas[1].trim()) return aspas[1].trim()
  const como = olhe.match(/Como aparece[^:\n]*:[ \t]*\n?([^\n]+)/)
  return como ? como[1].trim() : ''
}

const ehHttp = (l) => /^https?:\/\//i.test(String(l || ''))

/** As cartas que PODEM ter print: têm link http(s) e um texto. As que já têm `img` ficam de fora, a menos que `refazer`. */
export function cartasParaPrint(baralho, { refazer = false } = {}) {
  return ((baralho && baralho.cartas) || []).filter((c) => c && ehHttp(c.link) && textoDaCarta(c) && (refazer || !c.img))
}

/** Nome de arquivo seguro (só a-z, 0-9 e hífen, até 60) a partir do id. */
export function nomeDoPrint(carta) {
  const n = String(carta.id || 'carta').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
  return n || 'carta'
}

/** Roda NO navegador (page.evaluate). Acha o menor elemento visível cujo texto é igual ao da carta; senão o menor que o contém.
    Marca com data-print-alvo e devolve o modo ('igual' | 'contem') ou null. Precisa ser autocontida: é serializada. */
export function scriptDeBusca(alvo) {
  const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  // texto com várias linhas: procura pelo primeiro pedaço
  const parte = norm(String(alvo).split('\n').map((s) => s.trim()).filter(Boolean)[0] || '')
  document.querySelectorAll('[data-print-alvo]').forEach((e) => e.removeAttribute('data-print-alvo'))
  if (!parte) return null
  let igual = null; let contem = null
  for (const e of document.body.querySelectorAll('*')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|HEAD|META|LINK)$/.test(e.tagName)) continue
    const r = e.getBoundingClientRect()
    if (!(r.width > 0 && r.height > 0)) continue
    const cs = getComputedStyle(e)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const t = norm(e.innerText)
    if (!t || !t.includes(parte)) continue
    const area = r.width * r.height
    if (t === parte) { if (!igual || area < igual.area) igual = { e, area } } else if (!contem || t.length < contem.len) contem = { e, len: t.length }
  }
  const achado = igual ? igual.e : contem ? contem.e : null
  if (!achado) return null
  achado.setAttribute('data-print-alvo', '1')
  return igual ? 'igual' : 'contem'
}

/** CC-1067: confere o `estados.json` (`{ "<id da carta>": { passos: [...] } }`). Devolve a lista de erros, vazia se está certo. */
export function validarEstados(obj) {
  const e = []; const txt = (v) => typeof v === 'string' && v.trim() !== ''
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['o estados.json precisa ser um objeto { "<id da carta>": { "passos": [...] } }']
  for (const [id, est] of Object.entries(obj)) {
    const n = `${id}: `
    if (!est || typeof est !== 'object' || !Array.isArray(est.passos) || !est.passos.length) { e.push(n + 'precisa de "passos" (lista com ao menos um)'); continue }
    est.passos.forEach((ps, i) => {
      const m = `${n}passo ${i + 1} `
      const ks = ps && typeof ps === 'object' && !Array.isArray(ps) ? Object.keys(ps) : []
      if (ks.length !== 1) return e.push(m + 'precisa ter exatamente uma ação')
      const k = ks[0]; const v = ps[k]
      if (k === 'preencher') {
        const campos = v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v) : []
        if (!campos.length) e.push(m + 'preencher: precisa de { "<seletor>": "<valor>" }')
        for (const [sel, val] of campos) { if (!txt(sel)) e.push(m + 'preencher: seletor vazio'); if (typeof val !== 'string') e.push(m + 'preencher: valor precisa ser texto') }
      } else if (k === 'clicar') { if (!txt(v)) e.push(m + 'clicar: seletor vazio') }
      else if (k === 'esperar') { if (!(Number.isFinite(v) && v >= 0 && v <= 30000)) e.push(m + 'esperar: milissegundos de 0 a 30000') }
      else if (k === 'offline') { if (typeof v !== 'boolean') e.push(m + 'offline: true ou false') }
      else if (k === 'interceptar') {
        const regras = v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v) : []
        if (!regras.length) e.push(m + 'interceptar: precisa de { "<padrão de url>": { "status": 500 } }')
        for (const [pad, r] of regras) {
          if (!txt(pad)) e.push(m + 'interceptar: padrão de url vazio')
          if (!r || !Number.isInteger(r.status) || r.status < 100 || r.status > 599) e.push(m + 'interceptar: status de 100 a 599')
          else if (r.atraso !== undefined && !(Number.isFinite(r.atraso) && r.atraso >= 0 && r.atraso <= 30000)) e.push(m + 'interceptar: atraso de 0 a 30000 ms')
          else if (r.corpo !== undefined && typeof r.corpo !== 'string' && (typeof r.corpo !== 'object' || r.corpo === null)) e.push(m + 'interceptar: corpo é texto ou objeto')
        }
      } else e.push(m + `ação desconhecida "${k}" (use preencher, clicar, esperar, offline ou interceptar)`)
    })
  }
  return e
}

/** Lê o estados.json: `arquivo` pedido (precisa existir) ou `<pasta>/docs/cartas/estados.json` (opcional). Inválido: lança. */
export function lerEstados(pasta, arquivo = null) {
  const f = arquivo ? path.resolve(arquivo) : path.join(pasta, 'docs', 'cartas', 'estados.json')
  if (!fs.existsSync(f)) { if (arquivo) throw new Error('estados não encontrado: ' + f); return {} }
  let o; try { o = JSON.parse(fs.readFileSync(f, 'utf8')) } catch (er) { throw new Error('estados.json ilegível: ' + er.message) }
  const erros = validarEstados(o)
  if (erros.length) throw new Error('estados.json inválido: ' + erros[0])
  return o
}

/** Roda os passos NA página, em ordem. Devolve null se deu certo, ou "passo do estado falhou: <qual>". */
export async function rodarPassos(page, context, passos) {
  for (const ps of passos) {
    const [k, v] = Object.entries(ps)[0]
    const qual = k === 'preencher' ? 'preencher ' + Object.keys(v).join(', ') : k === 'clicar' ? 'clicar ' + v : k === 'interceptar' ? 'interceptar ' + Object.keys(v).join(', ') : k
    try {
      if (k === 'preencher') for (const [sel, val] of Object.entries(v)) await page.fill(sel, val, { timeout: 5000 })
      else if (k === 'clicar') await page.click(v, { timeout: 5000 })
      else if (k === 'esperar') await page.waitForTimeout(v)
      else if (k === 'offline') await context.setOffline(v)
      else if (k === 'interceptar') for (const [pad, r] of Object.entries(v)) {
        const corpo = r.corpo === undefined ? '{}' : typeof r.corpo === 'string' ? r.corpo : JSON.stringify(r.corpo)
        await page.route(pad, async (rota) => { if (r.atraso) await new Promise((ok) => setTimeout(ok, r.atraso)); await rota.fulfill({ status: r.status, contentType: typeof r.corpo === 'string' ? 'text/plain' : 'application/json', body: corpo }) })
      }
    } catch { return ('passo do estado falhou: ' + qual).slice(0, 110) }
  }
  return null
}

/** Texto final em português. `resultados`: [{ id, ok, motivo }]. */
export function relatorio(resultados) {
  const sem = resultados.filter((r) => !r.ok)
  const motivos = {}
  for (const r of sem) motivos[r.motivo] = (motivos[r.motivo] || 0) + 1
  const lista = Object.entries(motivos).map(([m, n]) => `${m}: ${n}`).join('; ')
  let t = `${resultados.length} cartas, ${resultados.length - sem.length} com print, ${sem.length} sem` + (sem.length ? ` (motivos: ${lista})` : '')
  if (sem.length) t += '\n' + sem.map((r) => `  ${r.id}: ${r.motivo}`).join('\n')
  return t
}

function achar(env, dir, sub) {
  if (process.env[env]) return process.env[env]
  const base = path.join(os.homedir(), '.cache', 'ms-playwright')
  const d = fs.existsSync(base) ? fs.readdirSync(base).filter((f) => f.startsWith(dir)).sort().pop() : null
  return d ? path.join(base, d, sub) : null
}

/** troca a base do link pela `url` (a parte do caminho que a url já tem não repete) */
export function trocarBase(link, url) {
  if (!url) return link
  const l = new URL(link); const b = new URL(url)
  const pre = b.pathname.replace(/\/+$/, '')
  const cam = pre && (l.pathname === pre || l.pathname.startsWith(pre + '/')) ? l.pathname : pre + l.pathname
  return b.origin + cam + l.search + l.hash
}

function gravarAtomico(arq, obj) {
  const tmp = arq + '.tmp-' + process.pid
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n')
  fs.renameSync(tmp, arq)
}

/** Fotografa as cartas do baralho e grava o baralho de volta. Devolve [{ id, ok, motivo }]. */
export async function imprimir({ baralhoArquivo, pasta, largura = 390, refazer = false, url = null, estados = null }) {
  const estadosDe = lerEstados(pasta, estados) // CC-1067: sem o arquivo, vazio e nada muda
  const pw = process.env.CC_PLAYWRIGHT || '/opt/hermes-work/ahtleta/node_modules/playwright-core'
  const { chromium } = createRequire(import.meta.url)(pw)
  const exe = achar('CC_CHROME', 'chromium_headless_shell-', path.join('chrome-headless-shell-linux64', 'chrome-headless-shell'))
  const baralho = JSON.parse(fs.readFileSync(baralhoArquivo, 'utf8'))
  const nomeBaralho = path.basename(baralhoArquivo, '.json')
  const dirImg = path.join(pasta, 'docs', 'cartas', 'img', nomeBaralho)
  const resultados = []
  const feitas = new Set(cartasParaPrint(baralho, { refazer }).map((c) => c.id))

  // carta de texto sem endereço: diz o motivo, não fica muda
  for (const c of baralho.cartas) {
    if (!feitas.has(c.id) && !c.img && !c.sem_print && textoDaCarta(c) && !ehHttp(c.link)) { c.sem_print = 'sem endereço'; resultados.push({ id: c.id, ok: false, motivo: 'sem endereço' }) }
  }
  const lista = baralho.cartas.filter((c) => feitas.has(c.id))
  if (lista.length) {
    fs.mkdirSync(dirImg, { recursive: true })
    const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
    try {
      const optCel = { viewport: { width: largura, height: 844 }, deviceScaleFactor: 2 }; const optPc = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
      const ctxCel = await b.newContext(optCel)
      const ctxPc = await b.newContext(optPc)
      const paginas = new Map() // endereço sem #  ->  { cel, pc, erro }
      const abrir = async (ctx, ender) => {
        const p = await ctx.newPage()
        try {
          const r = await p.goto(ender, { waitUntil: 'load', timeout: 30000 })
          if (r && r.status() >= 400) return { erro: `página não abriu (${r.status()})` }
          await p.waitForTimeout(1500)
          return { p }
        } catch (e) { return { erro: `página não abriu (${String(e.message).split('\n')[0].replace(/^page\.goto: /, '').slice(0, 50)})` } }
      }
      for (const c of lista) {
        try {
          const ender = trocarBase(c.link, url).replace(/#.*$/, '')
          const texto = textoDaCarta(c)
          let p; let largo = false; let modo = null; const ctxsEstado = []
          const est = estadosDe[c.id]
          if (est) { // CC-1067: página nova e contexto novo para cada carta com estado; os passos rodam antes de procurar o texto
            let falha = null
            try {
              for (const cel of [true, false]) {
                const ctx = await b.newContext(cel ? optCel : optPc); ctxsEstado.push(ctx)
                const a = await abrir(ctx, ender)
                if (a.erro) { falha = a.erro; break }
                falha = await rodarPassos(a.p, ctx, est.passos); if (falha) break
                modo = await a.p.evaluate(scriptDeBusca, texto)
                if (modo) { p = a.p; largo = !cel; break }
              }
            } catch { falha = 'erro ao fotografar' }
            if (!modo) { const m = falha || 'texto não achado na página'; c.sem_print = m; resultados.push({ id: c.id, ok: false, motivo: m }); for (const x of ctxsEstado) await x.close().catch(() => {}); continue }
          } else {
            let pg = paginas.get(ender)
            if (!pg) { pg = { cel: await abrir(ctxCel, ender) }; paginas.set(ender, pg) }
            if (pg.cel.erro) { c.sem_print = pg.cel.erro; resultados.push({ id: c.id, ok: false, motivo: pg.cel.erro }); continue }
            p = pg.cel.p
            modo = await p.evaluate(scriptDeBusca, texto)
            if (!modo) { // menu do topo e rodapé só existem no computador
              pg.pc ||= await abrir(ctxPc, ender)
              if (pg.pc.p) { p = pg.pc.p; largo = true; modo = await p.evaluate(scriptDeBusca, texto) }
            }
            if (!modo) { c.sem_print = 'texto não achado na página'; resultados.push({ id: c.id, ok: false, motivo: 'texto não achado na página' }); continue }
          }
          const alvo = p.locator('[data-print-alvo]').first()
          // moldura sobreposta, não `outline`: elemento com clip-path (botão de canto cortado) esconderia o contorno
          await alvo.evaluate((e) => {
            e.scrollIntoView({ block: 'center' }); const k = e.getBoundingClientRect(); const m = document.createElement('div'); m.setAttribute('data-print-marca', '1')
            m.style.cssText = `position:absolute;pointer-events:none;z-index:2147483647;box-sizing:border-box;border:3px solid #ff3ec9;left:${k.left + scrollX - 4}px;top:${k.top + scrollY - 4}px;width:${k.width + 8}px;height:${k.height + 8}px`
            document.body.appendChild(m)
          })
          await p.waitForTimeout(250)
          const r = await alvo.evaluate((e) => { const k = e.getBoundingClientRect(); return { x: k.x + scrollX, y: k.y + scrollY, w: k.width, h: k.height, H: document.documentElement.scrollHeight } })
          const L = largo ? Math.min(1440, Math.max(r.w + 240, 760)) : largura
          const x = largo ? Math.max(0, Math.min(r.x - (L - r.w) / 2, 1440 - L)) : 0
          const altura = Math.max(r.h + 140, 260); const y = Math.max(0, Math.min(r.y - 70, r.H - altura))
          const arq = nomeDoPrint(c) + '.jpg'
          await p.screenshot({ path: path.join(dirImg, arq), type: 'jpeg', quality: 72, fullPage: true, clip: { x, y, width: L, height: Math.min(altura, r.H - y) } })
          await alvo.evaluate((e) => { document.querySelectorAll('[data-print-marca]').forEach((m) => m.remove()); e.removeAttribute('data-print-alvo') })
          c.img = `docs/cartas/img/${nomeBaralho}/${arq}`; delete c.sem_print
          resultados.push({ id: c.id, ok: true })
          for (const x of ctxsEstado) await x.close().catch(() => {})
        } catch (e) {
          const m = 'erro ao fotografar'; c.sem_print = m; resultados.push({ id: c.id, ok: false, motivo: m })
        }
      }
    } finally { await b.close() }
  }
  const erros = validarDeck(baralho)
  if (erros.length) throw new Error('baralho ficaria inválido, nada gravado: ' + erros[0])
  gravarAtomico(baralhoArquivo, baralho)
  return resultados
}
