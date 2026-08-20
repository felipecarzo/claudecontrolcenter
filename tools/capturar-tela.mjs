/**
 * Captura que se recusa a mentir sobre a própria largura.
 *
 * A rodada anterior entregou dois arquivos de 390x844 que eram, medidos pela
 * geometria dos botões da barra de baixo, um recorte de um layout de ~500px.
 * O revisor pegou; eu não. `--window-size` do Chrome headless define o tamanho
 * da JANELA, não o viewport de layout, e a diferença passa despercebida porque
 * 500px ainda cai dentro do ramo estreito do CSS e parece um celular.
 *
 * Então este script valida ANTES de salvar, e falha alto quando a medida não
 * bate. Duas provas independentes, porque uma sozinha já enganou:
 *
 *  1. `clientWidth` do documento tem que ser exatamente a largura pedida;
 *  2. a régua que o revisor deu: os QUATRO botões da barra de baixo têm que
 *     estar inteiros dentro do quadro. Se o quarto sai, a captura é mais larga
 *     do que afirma.
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
/* Porta e perfil próprios por execução. Rodando três capturas em sequência com
   a mesma porta, um Chrome que demorou a morrer segurava a anterior, a nova
   instância falhava calada, e o CDP conectava no alvo VELHO: as capturas de
   390 voltaram a medir 980 por isso, não por causa do CSS. */
const PORTA = 9300 + (process.pid % 400)
const PERFIL = `${process.env.TEMP}/cc-cap-${process.pid}`

const alvos = [
  { arquivo: process.argv[2], url: process.argv[3], largura: Number(process.argv[4]), altura: Number(process.argv[5]) },
]
if (!alvos[0].arquivo || !alvos[0].url || !alvos[0].largura) {
  console.error('uso: node capturar.mjs <saida.png> <url> <largura> <altura>')
  process.exit(1)
}

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  /* O Windows do Felipe roda com escala de tela acima de 100%, e o Chrome
     herda isso: uma janela pedida em 390 vira ~500 CSS px, que é justamente a
     largura fantasma que a rodada anterior capturou sem notar. Fixar em 1
     tira o sistema operacional da conta. */
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${PORTA}`,
  '--user-data-dir=' + PERFIL, 'about:blank',
], { stdio: 'ignore' })

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let ws = null
let falhou = false

try {
  let pronto = false
  for (let i = 0; i < 40 && !pronto; i++) {
    await esperar(250)
    try { await (await fetch(`http://127.0.0.1:${PORTA}/json/version`)).json(); pronto = true } catch { /* subindo */ }
  }
  if (!pronto) throw new Error('o Chrome não abriu a porta de depuração')

  /* Aba NOVA, e conectar nela pelo id devolvido. `lista[0]` pega qualquer aba
     que já estivesse aberta no perfil, e foi assim que uma captura pedida em
     390 acabou medindo a janela de 1280 de uma execução anterior. */
  const nova = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?about:blank`, { method: 'PUT' })).json()
  if (!nova?.webSocketDebuggerUrl) throw new Error('não consegui abrir uma aba nova')
  console.log(`  alvo: ${nova.id}`)

  ws = new WebSocket(nova.webSocketDebuggerUrl)
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x })
  let id = 0
  const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const cmd = (metodo, params = {}) => new Promise((r) => { const meu = ++id; pend.set(meu, r); ws.send(JSON.stringify({ id: meu, method: metodo, params })) })
  const js = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

  await cmd('Page.enable')
  await cmd('Runtime.enable')

  for (const a of alvos) {
    /* Override ANTES de navegar: a meta viewport é lida no carregamento, e
       aplicar depois deixa a página medindo a largura de fallback. */
    await cmd('Emulation.setDeviceMetricsOverride', {
      width: a.largura, height: a.altura, deviceScaleFactor: 1,
      mobile: a.largura <= 500, screenWidth: a.largura, screenHeight: a.altura,
    })
    await cmd('Page.navigate', { url: a.url })
    await esperar(6000)

    const medida = await js(`(() => {
      /* Só os que estão de fato na tela. No monitor a barra de baixo está
         escondida e devolve retângulos zerados, o que fazia a régua do
         espalhamento acusar "amontoado" numa tela perfeita. */
      const bts = [...document.querySelectorAll('#app-bar button')].map((b) => {
        const r = b.getBoundingClientRect()
        return { centro: Math.round(r.left + r.width / 2), direita: Math.round(r.right), largura: Math.round(r.width) }
      }).filter((b) => b.largura > 0)
      return {
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        botoes: bts,
      }
    })()`)

    console.log(`\n${a.arquivo}`)
    console.log(`  pedido ${a.largura}  ·  clientWidth ${medida.clientWidth}  ·  innerWidth ${medida.innerWidth}`)
    console.log(`  botões da barra: ${medida.botoes.length} · centros ${medida.botoes.map((b) => b.centro).join(', ')}`)

    const larguraOk = medida.clientWidth === a.largura
    /* A régua do revisor: com o layout na largura certa, todo botão da barra
       cabe. Um botão passando da borda denuncia captura mais larga do que
       afirma, que foi exatamente o defeito da rodada anterior. */
    const forade = medida.botoes.filter((b) => b.direita > a.largura + 1)
    const botoesOk = medida.botoes.length === 0 || forade.length === 0

    if (!larguraOk) {
      console.error(`  INVÁLIDA: layout mede ${medida.clientWidth}, não ${a.largura}`)
      falhou = true
      continue
    }
    if (!botoesOk) {
      console.error(`  INVÁLIDA: ${forade.length} botão(ões) da barra passam da borda`)
      falhou = true
      continue
    }
    /* A mesma régua pelo outro lado, aprendida em 19/08. Ao criar a barra
       lateral, a coluna do conteúdo colapsou para zero no estreito e a tela
       ficou PRETA. A captura passou: a página media 390, e nenhum botão saía
       pela direita, porque todos tinham desabado para a esquerda, com centros
       em 24, 25, 34, 26, 17. O sinal estava impresso na tela e a validação
       não sabia lê-lo.
       Com a barra saudável, os alvos se espalham pela largura: do primeiro ao
       último centro há mais da metade da tela. Amontoado reprova. */
    const centros = medida.botoes.map((b) => b.centro)
    const espalho = centros.length > 1 ? Math.max(...centros) - Math.min(...centros) : a.largura
    const espalhoOk = centros.length < 2 || espalho > a.largura * 0.5
    if (!espalhoOk) {
      console.error(`  INVÁLIDA: a barra ocupa ${espalho}px de ${a.largura}. Os alvos estão amontoados, e isso costuma ser layout quebrado`)
      falhou = true
      continue
    }
    console.log('  válida: largura confere, e a barra cabe e se espalha')

    const shot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    if (!shot.result?.data) { console.error('  INVÁLIDA: captura vazia'); falhou = true; continue }
    mkdirSync(dirname(a.arquivo), { recursive: true })
    writeFileSync(a.arquivo, Buffer.from(shot.result.data, 'base64'))
    console.log(`  salva`)
  }
} catch (e) {
  console.error('ERRO:', e?.message || e)
  falhou = true
} finally {
  try { ws?.close() } catch { /* já fechado */ }
  chrome.kill()
  process.exit(falhou ? 1 : 0)
}
