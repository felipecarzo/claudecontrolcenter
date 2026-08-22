/**
 * CC-314 — o menu do telefone cabe numa tela, e os grupos colapsam de verdade.
 *
 * ## Por que este teste existe
 *
 * Queixa dele em 22/08: *"no telefone o menu de mais ta muito ruim, basicamente
 * ele fica só num pedaço da tela e isso é inútil, fora que o colapsar não
 * funciona nos itens"*. Medido: 1439px de conteúdo numa gaveta de 658px.
 *
 * ## A armadilha que este teste evita, e que quase deu falso negativo
 *
 * **Contar `.nav-item` no DOM não prova nada aqui.** Colapsar esconde por CSS,
 * e o nó continua na página: a contagem dá 28 com o menu fechado e 28 com ele
 * aberto. A sessão do Coderoom bateu nisso conferindo o meu conserto, e o teste
 * dela disse "NÃO COLAPSA" com a correção já no ar.
 *
 * Aqui se mede **altura renderizada**, que é o que ele vê. É a terceira forma
 * do mesmo erro num dia só: os pixels de um ícone, o clique sintético num
 * punho, e a contagem no DOM. Nas três, a prova media outra coisa.
 *
 * ## Por que fora do `npm test`
 *
 * Precisa de Chrome e de um painel no ar. Roda com `npm run test:gaveta`.
 */
import { spawn } from 'node:child_process'
import { chromePath } from './src/platform.mjs'

const CHROME = chromePath()
const URL_BASE = process.argv[2] || 'http://127.0.0.1:5180/'
const PORTA = 9950 + (process.pid % 40)
const PERFIL = `${process.env.TMPDIR || '/tmp'}/cc-gaveta-${process.pid}`

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

  const nova = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(nova.webSocketDebuggerUrl)
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x })
  let id = 0
  const pend = new Map()
  const erros = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.method === 'Runtime.exceptionThrown') {
      erros.push(String(m.params?.exceptionDetails?.exception?.description || 'erro').split('\n')[0])
    }
    if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  }
  const cmd = (metodo, params = {}) => new Promise((r) => { const meu = ++id; pend.set(meu, r); ws.send(JSON.stringify({ id: meu, method: metodo, params })) })
  const js = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

  await cmd('Page.enable')
  await cmd('Runtime.enable')
  /* 390px de verdade, e a régua confere: os cinco botões de baixo com centros
     em 39/117/195/273/351. Captura mais larga do que afirma já mentiu por 28%
     neste projeto. */
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
  await cmd('Page.navigate', { url: URL_BASE })
  await esperar(7000)

  const regua = await js(`JSON.stringify([...document.querySelectorAll('.barra-baixo .bb-item')]
    .map((b) => Math.round(b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2)))`)
  conta('a medida é de 390px de verdade', regua === '[39,117,195,273,351]', regua)

  await js(`(() => { document.querySelector('[data-gaveta-abrir]').click() })()`)
  await esperar(1500)

  /* `height > 0` e não `querySelectorAll().length`: colapsar esconde por CSS e
     o nó fica na página. Contar no DOM dá o mesmo número aberto e fechado. */
  const visiveis = `[...document.querySelectorAll('.gaveta .nav-item')].filter((a) => a.getBoundingClientRect().height > 0).length`
  const medir = async () => JSON.parse(await js(`JSON.stringify({
    visiveis: ${visiveis},
    noDom: document.querySelectorAll('.gaveta .nav-item').length,
    conteudo: document.querySelector('.gaveta').scrollHeight,
    altura: Math.round(document.querySelector('.gaveta').getBoundingClientRect().height),
  })`))

  const inicio = await medir()
  conta('a gaveta abre com os grupos fechados', inicio.visiveis <= 10, `${inicio.visiveis} telas à vista de ${inicio.noDom} no total`)
  conta('o conteúdo cabe perto da altura da gaveta', inicio.conteudo < inicio.altura * 1.6,
    `${inicio.conteudo}px de conteúdo em ${inicio.altura}px de gaveta`)
  conta('os nós continuam no DOM, então contar lá não provaria nada', inicio.noDom > inicio.visiveis,
    `${inicio.noDom} no DOM contra ${inicio.visiveis} visíveis`)

  await js(`(() => { document.querySelector('.gaveta [data-nav-grupo]').click() })()`)
  await esperar(700)
  const aberto = await medir()
  conta('tocar num grupo mostra os itens dele', aberto.visiveis > inicio.visiveis,
    `${inicio.visiveis} → ${aberto.visiveis}`)

  await js(`(() => { document.querySelector('.gaveta [data-nav-grupo]').click() })()`)
  await esperar(700)
  const fechado = await medir()
  conta('tocar de novo fecha', fechado.visiveis === inicio.visiveis, `${aberto.visiveis} → ${fechado.visiveis}`)

  /* O grupo da gaveta NÃO pode mexer no da barra: são duas cópias com o mesmo
     nome, e resolver pelo nome devolvia sempre a da barra. Era esse o defeito. */
  const naBarra = await js(`document.querySelector('.sidebar .nav-section[data-grupo="AGENTES"]')?.classList.contains('fechado')`)
  await js(`(() => { const b = [...document.querySelectorAll('.gaveta [data-nav-grupo]')].find((x) => x.dataset.navGrupo === 'AGENTES'); b?.click() })()`)
  await esperar(700)
  const naBarraDepois = await js(`document.querySelector('.sidebar .nav-section[data-grupo="AGENTES"]')?.classList.contains('fechado')`)
  conta('mexer na gaveta não mexe no menu do computador', naBarra === naBarraDepois, `${naBarra} → ${naBarraDepois}`)

  /* A prova NEGATIVA, e ela é a que dá valor ao resto.
     Desligando a regra que esconde, os 28 têm que voltar a aparecer. Se não
     voltarem, este teste está medindo outra coisa e passaria igual com o
     colapso quebrado. É o mesmo cuidado que o teste de largura já guarda. */
  await js(`(() => {
    const e = document.createElement('style');
    e.id = 'sem-guarda';
    e.textContent = '.gaveta .nav-section.fechado .nav-itens{display:block !important}';
    document.head.appendChild(e);
  })()`)
  await esperar(600)
  const semGuarda = await medir()
  conta('sem a regra que esconde, os 28 voltam: o teste mede o que promete',
    semGuarda.visiveis === semGuarda.noDom, `${semGuarda.visiveis} de ${semGuarda.noDom}`)
  await js(`(() => { document.getElementById('sem-guarda')?.remove() })()`)

  conta('nenhum erro de execução', erros.length === 0, erros.slice(0, 2).join(' | '))
} catch (e) {
  console.error('erro:', e.message)
  falhas++
} finally {
  try { ws?.close() } catch { /* já fechou */ }
  chrome.kill()
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
process.exit(falhas ? 1 : 0)
