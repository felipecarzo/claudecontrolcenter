/**
 * CC-297 — o log das travas, e o botão que produz o número que faltava.
 *
 * ## Por que este teste existe
 *
 * O botão de marcar "ajudou" é a única fonte do dado de BENEFÍCIO das travas.
 * A análise de 22/08 mostrou que dá para medir o custo delas (uma resposta em
 * cada quatro, alguns minutos a mais) e que não existe nada medindo se elas
 * melhoraram o resultado, porque erro evitado não deixa rastro.
 *
 * Se esse botão quebrar em silêncio, o número nunca nasce e ninguém percebe: a
 * tela continua bonita, o log continua rolando, e o placar fica em zero para
 * sempre parecendo que ele só não marcou ainda.
 *
 * ## Por que fora do `npm test`
 *
 * Precisa de Chrome e de um painel no ar. Roda com `npm run test:travas`.
 *
 * ## Por que NÃO usa `?static=1`
 *
 * A armadilha registrada: com o fluxo ao vivo desligado, teste de interação
 * passa sempre e não prova nada. O defeito clássico deste painel é o redesenho
 * de 2 em 2 segundos atropelando o estado da tela, e é justamente isso que o
 * item aberto e a marca precisam sobreviver.
 */
import { spawn } from 'node:child_process'
import { chromePath } from './src/platform.mjs'

const CHROME = chromePath()
const URL_BASE = process.argv[2] || 'http://127.0.0.1:5180/'
const PORTA = 9900 + (process.pid % 90)
const PERFIL = `${process.env.TMPDIR || '/tmp'}/cc-travas-${process.pid}`

if (!CHROME) {
  console.error('sem Chrome nesta máquina. Aponte um com CC_CHROME=<caminho>')
  process.exit(1)
}

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--force-device-scale-factor=1', `--remote-debugging-port=${PORTA}`,
  '--user-data-dir=' + PERFIL, 'about:blank',
], { stdio: 'ignore' })

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let ws = null
let falhas = 0
const conta = (nome, ok, detalhe = '') => {
  console.log(`  ${ok ? 'ok    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

try {
  let pronto = false
  for (let i = 0; i < 40 && !pronto; i++) {
    await esperar(250)
    try { await (await fetch(`http://127.0.0.1:${PORTA}/json/version`)).json(); pronto = true } catch { /* subindo */ }
  }
  if (!pronto) throw new Error('o Chrome não abriu a porta de depuração')

  /* Aba nova, e conectar nela pelo id: `lista[0]` pega qualquer aba que já
     estivesse no perfil, e foi assim que uma medição de 390 aconteceu numa
     janela de 1280 de outra execução. */
  const nova = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(nova.webSocketDebuggerUrl)
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x })
  let id = 0
  const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const cmd = (metodo, params = {}) => new Promise((r) => { const meu = ++id; pend.set(meu, r); ws.send(JSON.stringify({ id: meu, method: metodo, params })) })
  const js = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

  await cmd('Page.enable')
  await cmd('Runtime.enable')
  const erros = []
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.exceptionThrown') {
      erros.push(String(m.params?.exceptionDetails?.exception?.description || 'erro').split('\n')[0])
    }
  })

  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
  await cmd('Page.navigate', { url: URL_BASE + '#travas' })
  await esperar(6000)

  const est = () => js(`(() => ({
    tela: document.querySelector('.view-section.active')?.id,
    itens: document.querySelectorAll('.trv-item').length,
    cartoes: document.querySelectorAll('.trv-card').length,
    ajudou: document.querySelectorAll('.trv-item.j-ajudou').length,
    atrapalhou: document.querySelectorAll('.trv-item.j-atrapalhou').length,
    resumo: document.getElementById('trv-quando')?.innerText || '',
  }))()`)

  let e = await est()
  conta('a tela abre pelo endereço e traz o log', e.tela === 'view-travas' && e.itens > 0, JSON.stringify(e))
  conta('o placar por regra aparece', e.cartoes > 0, `${e.cartoes} regra(s)`)

  /* O estado limpo é o ponto de partida: se a marca já existir de uma execução
     anterior, o teste de "marcar" mediria o desmarcar. */
  const alvo = await js(`(() => { const l = document.querySelector('.trv-linha'); if (!l) return null; return l.dataset.trvAbrir })()`)
  conta('cada linha do log carrega o seu identificador', Boolean(alvo), String(alvo).slice(0, 60))

  await js(`(() => { document.querySelector('[data-trv-abrir]').click() })()`); await esperar(1200)
  const aberto = await js(`(() => { const a = document.querySelector('.trv-item.aberto'); return a ? { temTexto: (a.querySelector('pre')?.innerText || '').length, botoes: a.querySelectorAll('.trv-julgar .btn').length } : null })()`)
  conta('tocar numa linha abre o recado inteiro', Boolean(aberto) && aberto.botoes === 2, JSON.stringify(aberto))

  /* Zera antes de medir, pela rota, para o teste não depender do que ficou de
     outra vez. */
  await js(`(async () => { await fetch('/api/travas', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id: ${JSON.stringify(alvo)}, valor: null }) }); await carregarTravas() })()`)
  await esperar(2000)
  await js(`(() => { if (!document.querySelector('.trv-item.aberto')) document.querySelector('[data-trv-abrir]').click() })()`); await esperar(1000)

  await js(`(() => { document.querySelector('[data-trv-ajudou]').click() })()`); await esperar(2500)
  e = await est()
  conta('marcar "ajudou" pinta a linha e conta no resumo', e.ajudou === 1 && /1 já marcada/.test(e.resumo), JSON.stringify(e))

  await js(`(() => { if (!document.querySelector('.trv-item.aberto')) document.querySelector('[data-trv-abrir]').click() })()`); await esperar(900)
  await js(`(() => { document.querySelector('[data-trv-atrapalhou]').click() })()`); await esperar(2500)
  e = await est()
  conta('trocar para "atrapalhou" substitui, não soma', e.ajudou === 0 && e.atrapalhou === 1, JSON.stringify(e))

  await js(`(() => { if (!document.querySelector('.trv-item.aberto')) document.querySelector('[data-trv-abrir]').click() })()`); await esperar(900)
  await js(`(() => { document.querySelector('[data-trv-atrapalhou]').click() })()`); await esperar(2500)
  e = await est()
  conta('tocar de novo desmarca, porque erro de clique tem volta', e.ajudou === 0 && e.atrapalhou === 0, JSON.stringify(e))

  /* A marca precisa sobreviver ao fluxo ao vivo: o painel se redesenha de 2 em
     2 segundos, e é aí que o estado da tela costuma morrer neste projeto. */
  await js(`(() => { if (!document.querySelector('.trv-item.aberto')) document.querySelector('[data-trv-abrir]').click() })()`); await esperar(900)
  await js(`(() => { document.querySelector('[data-trv-ajudou]').click() })()`); await esperar(2500)
  await esperar(5000)
  e = await est()
  conta('a marca sobrevive a 5s de fluxo ao vivo', e.ajudou === 1, JSON.stringify(e))

  await js(`(async () => { await fetch('/api/travas', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ id: ${JSON.stringify(alvo)}, valor: null }) }) })()`)

  /* CC-300: o "?" de cada regra. Ele pediu as quatro partes por escrito, então
     o teste confere as quatro: se uma sumir do quadro, some em silêncio. */
  const temBotao = await js(`document.querySelectorAll('[data-trv-explica]').length`)
  conta('toda regra tem o seu "?"', temBotao > 0, `${temBotao} botão(ões)`)

  await js(`(() => { document.querySelector('[data-trv-explica]').click() })()`); await esperar(1200)
  const quadro = await js(`(() => {
    const c = document.getElementById('trv-explica')
    if (!c) return null
    const titulos = [...c.querySelectorAll('.ex-bloco h3')].map((h) => h.innerText.toLowerCase())
    return {
      paiEhBody: c.parentElement === document.body,
      blocos: titulos,
      temRecado: (c.querySelector('.ex-bloco pre')?.innerText || '').length,
      titulo: c.querySelector('h2')?.innerText || '',
    }
  })()`)
  conta('o quadro abre fora do painel, para o redesenho não levá-lo', Boolean(quadro?.paiEhBody), JSON.stringify(quadro?.titulo))
  const querParte = (p) => Boolean(quadro?.blocos?.some((t) => t.includes(p)))
  conta('diz o que a regra cobra', querParte('cobra'), (quadro?.blocos || []).join(' / '))
  conta('diz quando ela dispara', querParte('dispara'))
  conta('diz o que ela faz ao disparar', querParte('faz'))
  conta('mostra o texto que ela devolve', querParte('devolve') && quadro.temRecado > 50, `${quadro?.temRecado} caracteres`)

  /* A regra que nunca disparou é o caso que ele tem menos chance de entender
     sozinho, e o que mais some se ninguém olhar: não há recado dela em canto
     nenhum. */
  await js(`(() => { document.querySelector('[data-trv-fechar-explica]').click() })()`); await esperar(800)
  const muda = await js(`(() => { const b = document.querySelector('.trv-chip'); if (!b) return null; b.click(); return true })()`)
  await esperar(1200)
  const quadroMudo = await js(`(() => {
    const c = document.getElementById('trv-explica')
    return c ? { texto: c.innerText.toLowerCase().includes('nunca disparou'), blocos: c.querySelectorAll('.ex-bloco').length } : null
  })()`)
  conta('a regra que nunca disparou explica que está ligada mesmo assim', Boolean(muda) && Boolean(quadroMudo?.texto), JSON.stringify(quadroMudo))

  await js(`(() => { document.querySelector('[data-trv-fechar-explica]')?.click() })()`); await esperar(600)
  const fechou = await js(`!document.getElementById('trv-explica')`)
  conta('fechar tira o quadro da tela', fechou === true)

  conta('nenhum erro de execução na tela', erros.length === 0, erros.slice(0, 3).join(' | '))
} catch (e) {
  console.error('erro:', e.message)
  falhas++
} finally {
  try { ws?.close() } catch { /* já fechou */ }
  chrome.kill()
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
process.exit(falhas ? 1 : 0)
