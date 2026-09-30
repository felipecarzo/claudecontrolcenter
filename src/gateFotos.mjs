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

/**
 * Build, e fotos de celular (390) e computador (1440), só o que cabe na tela.
 * Devolve `{ ok, fotos: [caminho...], erro }`. Nunca lança: foto é conferência,
 * e a falha dela vira frase na conversa, não resposta quebrada.
 */
export async function fotografar({ cwd, saida }) {
  let pkg = null
  try { pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) } catch { return { ok: false, erro: 'o projeto não tem package.json, então não há site para fotografar' } }
  if (!pkg?.scripts?.build) return { ok: false, erro: 'o projeto não tem comando de build' }
  if (!fs.existsSync(path.join(cwd, 'node_modules'))) return { ok: false, erro: 'as dependências não estão instaladas' }
  const b = await rodar('npm', ['run', 'build'], { cwd, timeout: 180000 })
  if (!b.ok) return { ok: false, erro: 'o build falhou: ' + (b.out + b.err).split('\n').filter((l) => /error/i.test(l)).slice(0, 2).join(' | ').slice(0, 300) }
  const dist = ['dist', 'build', 'out'].map((d) => path.join(cwd, d)).find((d) => fs.existsSync(path.join(d, 'index.html')))
  if (!dist) return { ok: false, erro: 'o build passou, mas não achei a página pronta (dist, build ou out)' }
  fs.mkdirSync(saida, { recursive: true })
  const c = await rodar(process.execPath, ['--experimental-websocket', ESTE, '--captura', dist, saida], { timeout: 90000 })
  const fotos = ['celular', 'computador'].map((n) => path.join(saida, n + '.jpg')).filter((f) => fs.existsSync(f))
  if (!fotos.length) return { ok: false, erro: 'o build passou, mas a foto falhou: ' + c.err.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 200) }
  return { ok: true, fotos }
}

/* ============================ o processo filho ============================ */

async function capturar(dist, saida) {
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4' }
  const srv = http.createServer((req, res) => {
    let f = path.join(dist, decodeURIComponent(req.url.split('?')[0]))
    if (!f.startsWith(dist)) { res.writeHead(403); return res.end() }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html')
    res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' })
    fs.createReadStream(f).pipe(res)
  })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${srv.address().port}/`
  const tab = await (await fetch(CDP + '/json/new?about:blank', { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((r, x) => { ws.addEventListener('open', r); ws.addEventListener('error', x) })
  let n = 0; const esp = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (esp.has(m.id)) { esp.get(m.id)(m.result); esp.delete(m.id) } })
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++n; esp.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  try {
    for (const [larg, alt, nome] of [[390, 844, 'celular'], [1440, 900, 'computador']]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width: larg, height: alt, deviceScaleFactor: 1, mobile: larg < 700 })
      await cdp('Page.navigate', { url })
      await new Promise((r) => setTimeout(r, 3500))
      /* Mais que a primeira tela: medido em 30/09, a foto do computador parava
         antes do player, e o revisor não conseguiu confirmar o conserto. Teto
         de altura para a foto continuar leve no telefone dele. */
      const alto = (await cdp('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true }))?.result?.value || alt
      await cdp('Emulation.setDeviceMetricsOverride', { width: larg, height: Math.min(Math.max(alto, alt), ALTURA_MAX), deviceScaleFactor: 1, mobile: larg < 700 })
      await new Promise((r) => setTimeout(r, 900))
      const s = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 72 })
      fs.writeFileSync(path.join(saida, nome + '.jpg'), Buffer.from(s.data, 'base64'))
    }
  } finally {
    await fetch(`${CDP}/json/close/${tab.id}`).catch(() => {})
    ws.close(); srv.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === '--captura') {
  capturar(process.argv[3], process.argv[4]).then(() => process.exit(0)).catch((e) => { console.error(String(e?.message || e)); process.exit(1) })
}
