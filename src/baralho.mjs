/**
 * CC-1033, pedido dele em 09/10: "aprovar todas as telas do site, todos os textos do site" com o Tinder, e "algo que eu
 * possa implementar em outros aplicativos". O gerador: recebe o ENDEREÇO de um app, anda pelas telas, fotografa cada uma
 * e tira o texto e os erros de console, e escreve o baralho (docs/cartas/<deck>.json) no formato que o Tinder do painel
 * já lê e que a skill `tinderlike` publica. Funciona em qualquer app com endereço: não pede nada do app.
 *
 * A lógica (quais telas, que texto, que carta) é pura e testável sem navegador. O navegador de verdade entra por
 * `navegador`, que o teste troca por um de mentira (`navegadorPlaywright` é o real).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { validarDeck } from './cartas.mjs'
import { NAO_TOCAR } from './gateFotos.mjs'

export const MAX_TELAS = 30
export const TEXTO_MAX = 1400
const ARQUIVO = /\.(pdf|zip|png|jpe?g|gif|webp|svg|ico|mp4|mp3|css|js|json|xml|txt)$/i

/** Um nome de arquivo seguro para a rota: `/planos/mensal` vira `planos-mensal`, a raiz vira `inicio`. */
export const slugDe = (rota) => {
  const s = String(rota || '/').replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return (s || 'inicio').slice(0, 50)
}

/**
 * Do conjunto de links de uma página, as rotas do MESMO site que valem uma carta. Tira o que sai do site, arquivo para
 * baixar, âncora da própria página, e o que o texto do link diz que destrói ou sai (sair, excluir, apagar, resetar...).
 */
export function rotasDosLinks(base, links, { max = MAX_TELAS } = {}) {
  let origem; try { origem = new URL(base) } catch { return [] }
  const vistas = new Set([slugDe(origem.pathname)]); const rotas = []
  for (const l of links || []) {
    let u; try { u = new URL(l.href, origem) } catch { continue }
    if (u.origin !== origem.origin || ARQUIVO.test(u.pathname) || NAO_TOCAR.test(String(l.texto || '')) || NAO_TOCAR.test(u.pathname)) continue
    const s = slugDe(u.pathname); if (vistas.has(s)) continue
    vistas.add(s); rotas.push(u.pathname)
    if (rotas.length >= max - 1) break
  }
  return rotas
}

/**
 * O texto de uma tela, para o olho aprovar. O baralho recusa travessão (regra dele), e site de cliente tem; vira
 * " - " e a carta avisa, para ele saber que o texto da carta não é letra por letra.
 */
export function limparTexto(t, max = TEXTO_MAX) {
  const cru = String(t || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
  const mudou = /[—–]/.test(cru)
  const sem = cru.replace(/\s*[—–]\s*/g, ' - ')
  return { texto: sem.length > max ? sem.slice(0, max).trimEnd() + '...' : sem, cortou: sem.length > max, travessao: mudou }
}

/** As cartas das duas famílias de aprovação, de uma lista de páginas já lidas. */
export function montarBaralhos({ base, paginas, agora = new Date(), imgDe }) {
  const criado = agora.toISOString()
  const telas = []; const textos = []
  for (const p of paginas) {
    const id = p.slug; const t = limparTexto(p.texto); const erros = (p.erros || []).slice(0, 3).map((e) => limparTexto(e, 160).texto)
    const titulo = limparTexto(p.titulo || p.rota, 80).texto.replace(/\n/g, ' ')
    const aviso = erros.length ? ` Erros no console do navegador: ${erros.join(' / ')}.` : ' Console do navegador sem erros.'
    telas.push({
      id, titulo: `Tela: ${titulo}`.slice(0, 120), pergunta: 'Esta tela está aprovada, no visual e no que ela mostra?',
      olhe: `A tela de ${p.rota} no celular (390 px).${aviso}`,
      passos: [`Abra ${p.url}`, 'Confira se nada está cortado, coberto ou ilegível', 'Toque no print para ver em tamanho grande'],
      img: imgDe(p), link: p.url,
    })
    if (t.texto) textos.push({
      id, titulo: `Texto: ${titulo}`.slice(0, 120), pergunta: 'O texto desta tela está aprovado?',
      olhe: `${t.texto}${t.cortou ? '\n(texto cortado: a tela tem mais)' : ''}${t.travessao ? '\n(travessões do original aparecem como hífen aqui)' : ''}`,
      passos: [`Abra ${p.url} se quiser ver o texto no lugar`], link: p.url,
    })
  }
  const deck = (titulo, cartas) => ({ titulo, criado, cartas })
  return { telas: telas.length ? deck(`Telas de ${new URL(base).host}`, telas) : null, textos: textos.length ? deck(`Textos de ${new URL(base).host}`, textos) : null }
}

/**
 * O gerador inteiro. `navegador.ler(url, { largura, altura })` devolve `{ titulo, texto, links, erros, jpeg }`.
 * Escreve em `<projeto>/docs/cartas/`. Nunca apaga nada além do que ele mesmo gerou antes (mesmo nome de baralho).
 */
export async function gerar({ url, projeto, rotas = null, max = MAX_TELAS, navegador, agora = new Date() }) {
  const base = new URL(url); if (!/^https?:$/.test(base.protocol)) throw new Error('o endereço precisa ser http ou https')
  const pasta = path.join(projeto, 'docs', 'cartas'); const imgRel = (s) => `docs/cartas/img/baralho/${s}.jpg`
  const lista = [{ rota: base.pathname || '/', url: base.href }]
  const primeira = await navegador.ler(base.href, { largura: 390, altura: 844 })
  const paginas = []
  const guardar = (rota, url2, lido) => paginas.push({ rota, url: url2, slug: slugDe(rota), titulo: lido.titulo, texto: lido.texto, erros: lido.erros || [], jpeg: lido.jpeg })
  guardar(lista[0].rota, base.href, primeira)
  const alvo = rotas && rotas.length ? rotas : rotasDosLinks(base.href, primeira.links, { max })
  const feitas = new Set([paginas[0].slug])
  for (const r of alvo) {
    if (paginas.length >= max) break
    const u = new URL(r, base.origin); if (feitas.has(slugDe(u.pathname))) continue; feitas.add(slugDe(u.pathname)); let lido
    try { lido = await navegador.ler(u.href, { largura: 390, altura: 844 }) } catch (e) { lido = { titulo: r, texto: '', erros: ['não abriu: ' + String(e.message || e).slice(0, 100)], jpeg: null } }
    guardar(u.pathname, u.href, lido)
  }
  const comFoto = paginas.filter((p) => p.jpeg && p.jpeg.length)
  const baralhos = montarBaralhos({ base: base.href, paginas, agora, imgDe: (p) => (p.jpeg && p.jpeg.length ? imgRel(p.slug) : undefined) })
  for (const [nome, deck] of Object.entries(baralhos)) if (deck) { const e = validarDeck(deck); if (e.length) throw new Error(`baralho ${nome} recusado: ${e[0]}`) }
  fs.mkdirSync(path.join(pasta, 'img', 'baralho'), { recursive: true })
  for (const p of comFoto) fs.writeFileSync(path.join(projeto, imgRel(p.slug)), p.jpeg)
  const escritos = []
  for (const [nome, deck] of Object.entries(baralhos)) if (deck) { fs.writeFileSync(path.join(pasta, `${nome}.json`), JSON.stringify(deck, null, 2) + '\n'); escritos.push({ nome, cartas: deck.cartas.length }) }
  return { paginas: paginas.length, fotos: comFoto.length, comErroDeConsole: paginas.filter((p) => p.erros.length).length, escritos }
}

/* ===== o navegador de verdade =====
   Playwright do Hermes + o Chrome sem tela que já existem nesta VPS (o mesmo caminho da skill tinderlike e do print-logado).
   Precisa rodar FORA da caixa de proteção: abre rede e processo próprios. */
const PLAYWRIGHTS = [process.env.CC_PLAYWRIGHT, '/opt/hermes-work/ahtleta/node_modules/playwright-core', '/usr/local/lib/hermes-agent/node_modules/playwright-core'].filter(Boolean)
const CHROME = () => { const d = path.join(process.env.HOME || '', '.cache', 'ms-playwright'); try { const v = fs.readdirSync(d).filter((x) => x.startsWith('chromium_headless_shell')).sort().at(-1); return v ? path.join(d, v, 'chrome-headless-shell-linux64', 'chrome-headless-shell') : null } catch { return null } }

/**
 * CC-1039: o login do app, vindo da linha de comando e do AMBIENTE. A senha e o cookie nunca vão na linha de comando
 * (ela aparece na lista de processos): ficam em variáveis de ambiente, e a linha só diz o NOME da variável.
 */
export function loginDe({ entrar = null, usuario = null, senhaEnv = null, cookieEnv = null, seletorUsuario = null, seletorSenha = null, seletorEnviar = null } = {}, env = process.env) {
  if (!entrar && !cookieEnv) return null
  const login = { entrar, usuario, seletorUsuario, seletorSenha, seletorEnviar, cookies: [] }
  if (entrar) {
    try { const u = new URL(entrar); if (!/^https?:$/.test(u.protocol)) throw new Error() } catch { throw new Error('--entrar precisa ser o endereço http ou https da tela de entrar') }
    if (!usuario) throw new Error('com --entrar, diga o --usuario (o e-mail ou o nome de quem entra)')
    if (!senhaEnv) throw new Error('com --entrar, diga --senha-env NOME (o NOME da variável de ambiente que guarda a senha; a senha nunca vai na linha de comando)')
    if (!env[senhaEnv]) throw new Error('a variável de ambiente ' + senhaEnv + ' está vazia ou não existe')
    login.senha = env[senhaEnv]
  }
  if (cookieEnv) {
    if (!env[cookieEnv]) throw new Error('a variável de ambiente ' + cookieEnv + ' está vazia ou não existe')
    login.cookies = String(env[cookieEnv]).split(';').map((p) => p.trim()).filter(Boolean).map((p) => { const i = p.indexOf('='); return i > 0 ? { name: p.slice(0, i).trim(), value: p.slice(i + 1).trim() } : null }).filter(Boolean)
    if (!login.cookies.length) throw new Error('o cookie em ' + cookieEnv + ' precisa estar no formato nome=valor (vários separados por ;)')
  }
  return login
}

export async function navegadorPlaywright({ login = null, origem = null } = {}) {
  const req = createRequire(import.meta.url); let pw = null
  for (const c of PLAYWRIGHTS) { try { pw = req(c); break } catch { /* próximo */ } }
  if (!pw) throw new Error('não achei o Playwright (defina CC_PLAYWRIGHT com a pasta do playwright-core)')
  const exe = CHROME(); if (!exe || !fs.existsSync(exe)) throw new Error('não achei o Chrome sem tela em ~/.cache/ms-playwright')
  const nav = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
  let estado = null // a sessão logada, só em memória: nada disto vai para o disco
  if (login) {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    try {
      if (login.cookies.length) await ctx.addCookies(login.cookies.map((c) => ({ ...c, url: origem })))
      if (login.entrar) {
        const page = await ctx.newPage()
        await page.goto(login.entrar, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(login.entrar, { waitUntil: 'load', timeout: 30000 }))
        const campo = (sel, padrao) => page.locator(sel || padrao).first()
        if (!(await campo(login.seletorSenha, 'input[type=password]').count())) throw new Error('não achei o campo de senha em ' + login.entrar + ' (use --seletor-senha)')
        await campo(login.seletorUsuario, 'input[type=email], input[autocomplete=username], input[name*=mail i], input[name*=user i], input[name*=login i], input[type=text]').fill(login.usuario)
        await campo(login.seletorSenha, 'input[type=password]').fill(login.senha)
        await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), campo(login.seletorEnviar, 'button[type=submit], input[type=submit], form button').click()])
        await page.waitForTimeout(1000)
        if (await page.locator('input[type=password]').count()) throw new Error('o login não entrou: a tela ainda pede senha (confira usuário e senha, ou use --seletor-enviar)')
      }
      estado = await ctx.storageState()
    } finally { await ctx.close() }
  }
  return {
    async ler(url, { largura, altura }) {
      const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...(estado ? { storageState: estado } : {}) })
      const page = await ctx.newPage(); const erros = []
      page.on('pageerror', (e) => erros.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(url, { waitUntil: 'load', timeout: 30000 }))
        await page.waitForTimeout(600)
        const lido = await page.evaluate(() => ({
          titulo: document.querySelector('h1')?.innerText?.trim() || document.title || '',
          texto: (document.querySelector('main') || document.body).innerText || '',
          links: [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), texto: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 60) })),
        }))
        // página comprida não vira imagem gigante: a carta mostra os primeiros 3600 px (o resto o link abre)
        const alturaTotal = await page.evaluate(() => document.documentElement.scrollHeight)
        const jpeg = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: true, ...(alturaTotal > 3600 ? { clip: { x: 0, y: 0, width: largura, height: 3600 } } : {}) })
        return { ...lido, erros, jpeg }
      } finally { await ctx.close() }
    },
    fechar: () => nav.close(),
  }
}
