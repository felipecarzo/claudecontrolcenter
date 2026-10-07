/**
 * CC-845 (Nisaba): a conferência de comportamento. Abre o projeto num Chrome
 * sem tela (o de fotos, porta 9333) e responde se ele FUNCIONA, não só se
 * compila. Medido em 01/10: o jogo passou no build e no robô travado no
 * início, sem nenhum erro de código na página.
 *
 *   node --experimental-websocket src/abrir.mjs <url> abre   página abre sem erro de código
 *   node --experimental-websocket src/abrir.mjs <url> anda   apertar W mexe a cena mais que o parado
 *
 * Imprime UMA linha de JSON: { ok, erros, parado, andando, motivo }.
 * Roda em processo filho porque o WebSocket do Node 20 pede a flag.
 *
 * ⚠️ Só roda quando chamado direto. Importado (o gate importa todo `src/`),
 * não faz nada: a 1ª versão rodava ao ser importada e chamava process.exit(0)
 * no meio do `npm test`, que podia sair "passou" sem ter rodado o resto.
 */
import { pathToFileURL } from 'node:url'

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))

export async function conferirNoNavegador(url, modo = 'abre', { cdp = process.env.CC_CDP || 'http://127.0.0.1:9333', fotos = process.env.CC_ABRIR_FOTOS || null } = {}) {
  let aba
  const novaAba = async () => (await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' })).json()
  try { aba = await novaAba() } catch {
    /* 01/10: a conferência do fim do pedido não rodou porque o navegador tinha
       caído, e ninguém o religa sozinho. Sobe pelo mesmo script de sempre. */
    const { spawnSync } = await import('node:child_process')
    const os = await import('node:os')
    spawnSync('bash', [`${os.homedir()}/bh-chrome.sh`, 'start'], { timeout: 30000, stdio: 'ignore' })
    for (let i = 0; i < 10 && !aba; i++) { await dorme(1000); try { aba = await novaAba() } catch { /* subindo */ } }
    if (!aba) return { ok: false, motivo: `navegador sem tela fora do ar (${cdp}), e ~/bh-chrome.sh não o subiu` }
  }
  const ws = new WebSocket(aba.webSocketDebuggerUrl)
  let n = 0
  const pendentes = new Map()
  const erros = []
  const cmd = (method, params = {}) => new Promise((ok) => { const id = ++n; pendentes.set(id, ok); ws.send(JSON.stringify({ id, method, params })) })
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d.result || { erro: d.error }); pendentes.delete(d.id) }
    if (d.method === 'Runtime.exceptionThrown') erros.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').split('\n')[0].slice(0, 200))
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') erros.push(d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200))
  }
  await new Promise((ok) => { ws.onopen = ok })
  const fechar = async () => { try { ws.close() } catch { /* já fechado */ } try { await fetch(`${cdp}/json/close/${aba.id}`) } catch { /* já fechada */ } }
  try {
    await cmd('Runtime.enable')
    await cmd('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false })
    await cmd('Page.navigate', { url })
    await dorme(7000)
    /* 02/10: com o servidor de teste fora do ar, a página é o aviso do roteador
       ("não esta no ar"), nada se mexe e a conferência dizia "W não mexeu a
       cena", culpando o agente. O diagnóstico certo vem antes. */
    const fora = await cmd('Runtime.evaluate', { returnByValue: true, expression: `/n[aã]o est[aá] no ar|502 Bad Gateway|404 Not Found/i.test(document.body?.innerText || '')` })
    if (fora.result?.value) return { ok: false, erros, motivo: `o endereço ${url} não está no ar (o servidor de teste do projeto caiu): não é defeito do código` }
    if (modo === 'abre') return { ok: !erros.length, erros, motivo: erros.length ? `${erros.length} erro(s) de código na página: ${erros[0]}` : null }

    /* modo anda: foco no jogo, três fotos (parado, parado, andando) e a diferença
       média de cor entre elas, medida DENTRO da página. Andar tem de mexer a cena
       bem mais do que a água e os bichos mexem sozinhos.
       Medido em 01/10: o jogo abre num MENU, e o clique no meio da tela caía no vão
       entre "Jogar Agora" e "Como Jogar"; a 1ª versão apertou W em cima do menu.
       Agora clica no botão de começar, se houver, e só depois no centro. */
    const comecou = await cmd('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const b = [...document.querySelectorAll('button, a, [role=button]')].find((e) => e.offsetParent && /\\b(jogar|play|start|iniciar|come[cç]ar)\\b/i.test(e.textContent) && !/como jogar|how to/i.test(e.textContent))
      if (b) b.click(); return b ? b.textContent.trim().slice(0, 40) : null })()` })
    await dorme(comecou.result?.value ? 2500 : 0)
    const mouse = (type) => cmd('Input.dispatchMouseEvent', { type, x: 480, y: 300, button: 'left', clickCount: 1 })
    await mouse('mousePressed'); await mouse('mouseReleased'); await dorme(800)
    const foto = async () => (await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 60 })).data
    const a = await foto(); await dorme(1200); const b = await foto()
    const tecla = (type, extra = {}) => cmd('Input.dispatchKeyEvent', { type, key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87, ...extra })
    await tecla('keyDown')
    for (let i = 0; i < 6; i++) { await dorme(200); await tecla('keyDown', { autoRepeat: true }) }
    const c = await foto()
    await tecla('keyUp')
    if (fotos) { // para conferir a própria conferência: guarda as três fotos
      const fs = await import('node:fs')
      ;[['1-parado', a], ['2-parado', b], ['3-andando', c]].forEach(([nome, d]) => fs.writeFileSync(`${fotos}/${nome}.jpg`, Buffer.from(d, 'base64')))
    }
    const medir = await cmd('Runtime.evaluate', {
      awaitPromise: true, returnByValue: true,
      expression: `(async () => {
        const px = async (b64) => { const im = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob()); const cv = new OffscreenCanvas(160, 90); const g = cv.getContext('2d'); g.drawImage(im, 0, 0, 160, 90); return g.getImageData(0, 0, 160, 90).data }
        const [A, B, C] = await Promise.all([${JSON.stringify(a)}, ${JSON.stringify(b)}, ${JSON.stringify(c)}].map(px))
        const dif = (x, y) => { let s = 0; for (let i = 0; i < x.length; i += 4) s += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); return s / (x.length / 4) / 3 }
        return { parado: dif(A, B), andando: dif(B, C) }
      })()`,
    })
    const v = medir.result?.value
    if (!v) return { ok: false, erros, motivo: 'não consegui medir a imagem' }
    // ponytail: limiar fixo (2x o parado e pelo menos 1,5 de 255); calibrar se um jogo legítimo reprovar
    const anda = v.andando > Math.max(2 * v.parado, 1.5)
    return {
      ok: anda && !erros.length, erros, parado: +v.parado.toFixed(2), andando: +v.andando.toFixed(2),
      motivo: erros.length ? `erro de código na página: ${erros[0]}` : anda ? null : `apertar W não mexeu a cena: variação andando ${v.andando.toFixed(2)} contra ${v.parado.toFixed(2)} parado (de 0 a 255)`,
    }
  } finally { await fechar() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [url, modo = 'abre'] = process.argv.slice(2)
  setTimeout(() => { console.log(JSON.stringify({ ok: false, motivo: 'a conferência passou de 60 s' })); process.exit(0) }, 60000).unref()
  const r = await conferirNoNavegador(url, modo)
  console.log(JSON.stringify(r)); process.exit(0)
}
