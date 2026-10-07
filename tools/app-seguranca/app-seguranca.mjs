// CC-859: as peças para instalar no celular a página do Deploy seguro e a do reinício
// emergencial da VPS, como dois apps separados. Um arquivo só para os dois serviços, que são
// instalados em lugares diferentes: o instalar.sh de cada um copia este ao lado (mesmo
// esquema do auditoria.mjs).
//
// Sem dependência: o PNG é montado aqui, com o zlib que já vem no Node.
//
// O service worker NÃO guarda nada. Estas páginas mostram pedido de deploy e estado da
// máquina: uma cópia velha na tela seria afirmar o passado como se fosse agora. Ele só
// existe para o Chrome oferecer "Instalar app" em vez de salvar um atalho.
import crypto from 'node:crypto'
import zlib from 'node:zlib'

const FUNDO = [0x2b, 0x2f, 0x36] // grafite, o mesmo tema escuro dos dois apps

export const APPS = {
  deploy: {
    nome: 'Deploy seguro', base: '/deploy-seguro/', cor: '#3B82F6', glifo: 'seta',
    descricao: 'Confirmar com o código do autenticador o que vai para o ar.',
  },
  religar: {
    nome: 'Religar VPS', base: '/__religar/', cor: '#F97316', glifo: 'energia',
    descricao: 'Reinício de emergência da VPS, com senha e código.',
  },
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))

// ── o desenho: o mesmo contorno vira SVG e PNG, em um quadro de 512 ──
const SVG_GLIFO = {
  seta: (cor) => `<path d="M256 120L344 236H282V372H230V236H168Z" fill="${cor}"/><rect x="168" y="398" width="176" height="26" fill="${cor}"/>`,
  energia: (cor) => `<path d="M327.4 176.6A116 116 0 1 1 184.6 176.6" fill="none" stroke="${cor}" stroke-width="28"/><rect x="242" y="130" width="28" height="132" fill="${cor}"/>`,
}
const dentroTriangulo = (x, y, [ax, ay], [bx, by], [cx, cy]) => {
  const s = (px, py, qx, qy) => (x - qx) * (py - qy) - (px - qx) * (y - qy)
  const d1 = s(ax, ay, bx, by); const d2 = s(bx, by, cx, cy); const d3 = s(cx, cy, ax, ay)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}
const DENTRO = {
  seta: (x, y) => dentroTriangulo(x, y, [256, 120], [344, 236], [168, 236])
    || (x >= 230 && x <= 282 && y >= 236 && y <= 372) || (x >= 168 && x <= 344 && y >= 398 && y <= 424),
  energia: (x, y) => {
    const dx = x - 256; const dy = y - 268; const d = Math.hypot(dx, dy)
    if (d >= 102 && d <= 130 && Math.abs(Math.atan2(dx, -dy)) >= (38 * Math.PI) / 180) return true
    return x >= 242 && x <= 270 && y >= 130 && y <= 262
  },
}

export function iconeSvg(app) {
  const a = APPS[app]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="#2B2F36"/>${SVG_GLIFO[a.glifo](a.cor)}</svg>`
}

// ── PNG sem biblioteca: assinatura, IHDR, IDAT (zlib), IEND ──
const TAB = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = TAB[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (tipo, dados) => {
  const t = Buffer.from(tipo); const len = Buffer.alloc(4); len.writeUInt32BE(dados.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])))
  return Buffer.concat([len, t, dados, crc])
}

export function iconePng(app, tam) {
  const a = APPS[app]; const dentro = DENTRO[a.glifo]; const cor = hex(a.cor)
  const linhas = Buffer.alloc(tam * (tam * 3 + 1))
  const escala = 512 / tam
  for (let y = 0; y < tam; y++) {
    const o = y * (tam * 3 + 1) // o primeiro byte da linha é o filtro (0 = nenhum)
    for (let x = 0; x < tam; x++) {
      let cob = 0 // 3x3 amostras por pixel, para a borda não ficar serrilhada
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (dentro((x + (i + 0.5) / 3) * escala, (y + (j + 0.5) / 3) * escala)) cob++
      for (let k = 0; k < 3; k++) linhas[o + 1 + x * 3 + k] = Math.round(FUNDO[k] + ((cor[k] - FUNDO[k]) * cob) / 9)
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(linhas)), chunk('IEND', Buffer.alloc(0))])
}

export function manifesto(app) {
  const a = APPS[app]
  const png = (t, purpose) => ({ src: `${a.base}icone-${t}.png`, sizes: `${t}x${t}`, type: 'image/png', purpose })
  return JSON.stringify({
    id: a.base, name: a.nome, short_name: a.nome, description: a.descricao,
    start_url: a.base, scope: a.base, display: 'standalone', orientation: 'portrait-primary',
    background_color: '#2B2F36', theme_color: '#2B2F36', lang: 'pt-BR', dir: 'ltr',
    icons: [
      { src: `${a.base}icone.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      png(192, 'any'), png(512, 'any'), png(512, 'maskable'),
    ],
  }, null, 2)
}

// O fetch vazio deixa tudo ir para a rede. Nada de armazenar resposta aqui, nunca.
export const SW = `self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()) })
self.addEventListener('fetch', () => {})
`

// ── o que cada serviço entrega, sem sessão: lista exata, nunca prefixo ──
const FIXO = 'public, max-age=86400'
export function pecas(app) {
  return {
    'app.webmanifest': { tipo: 'application/manifest+json; charset=utf-8', corpo: manifesto(app), cache: 'no-cache' },
    'sw.js': { tipo: 'text/javascript; charset=utf-8', corpo: SW, cache: 'no-cache' },
    'icone.svg': { tipo: 'image/svg+xml; charset=utf-8', corpo: iconeSvg(app), cache: FIXO },
    'icone-192.png': { tipo: 'image/png', corpo: iconePng(app, 192), cache: FIXO },
    'icone-512.png': { tipo: 'image/png', corpo: iconePng(app, 512), cache: FIXO },
  }
}

// Atende GET/HEAD de uma peça do app. Devolve true se respondeu.
export function servirPeca(app, pecasDoApp, req, res, pathname) {
  const base = APPS[app].base
  if (!pathname.startsWith(base) || (req.method !== 'GET' && req.method !== 'HEAD')) return false
  const nome = pathname.slice(base.length)
  if (!Object.hasOwn(pecasDoApp, nome)) return false
  const p = pecasDoApp[nome]
  res.writeHead(200, { 'content-type': p.tipo, 'cache-control': p.cache, 'content-length': Buffer.byteLength(p.corpo), 'x-content-type-options': 'nosniff' })
  res.end(req.method === 'HEAD' ? undefined : p.corpo)
  return true
}

// ── o que a página do app precisa no <head> ──
export const scriptRegistro = (app) => { const b = APPS[app].base; return `if('serviceWorker' in navigator)navigator.serviceWorker.register('${b}sw.js',{scope:'${b}'}).catch(function(){})` }
// para a CSP da página do deploy, que não aceita script inline sem este carimbo
export const hashRegistro = (app) => "'sha256-" + crypto.createHash('sha256').update(scriptRegistro(app)).digest('base64') + "'"
export const cabecaApp = (app) => {
  const b = APPS[app].base
  return `<meta name="theme-color" content="#2B2F36"><link rel="manifest" href="${b}app.webmanifest"><link rel="icon" href="${b}icone.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="${b}icone-192.png"><script>${scriptRegistro(app)}</script>`
}
