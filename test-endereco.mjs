/**
 * CC-223 — cada tela tem endereço, voltar volta, recarregar mantém.
 *
 * ## Por que este teste existe fora do gate
 *
 * Ele precisa de um Chrome e de um painel no ar, então não entra no `npm test`,
 * que roda em segundos e sem rede. Roda com `npm run test:endereco`.
 *
 * ## Por que ele NÃO usa `?static=1`
 *
 * A armadilha já registrada: com o fluxo ao vivo desligado, todo teste de
 * interação passa e não prova nada, porque o defeito clássico deste painel é o
 * redesenho de 2 em 2 segundos atropelando o estado da tela. Aqui isso importa
 * em dobro: se um tique do fluxo reescrevesse a lista de agentes, o agente
 * aberto se fecharia sozinho e o endereço apontaria para o vazio.
 *
 * ## O que ele guarda
 *
 * Os dois sintomas que ele descreveu, nas palavras dele: *"clico em um outro
 * painel e decido clicar em voltar ele não volta pra anterior"*, e *"se eu
 * atualizar a página ele volta pra aba inicial"*.
 */
import { spawn } from 'node:child_process'
import { chromePath } from './src/platform.mjs'

const CHROME = chromePath()
const URL_BASE = process.argv[2] || 'http://127.0.0.1:5180/'
const PORTA = 9700 + (process.pid % 200)
const PERFIL = `${process.env.TMPDIR || process.env.TEMP || '/tmp'}/cc-endereco-${process.pid}`

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

  /* Aba NOVA, e conectar nela pelo id: `lista[0]` pega qualquer aba que já
     estivesse no perfil, armadilha que já fez uma medição de 390 acontecer
     numa janela de 1280 de outra execução. */
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

  /* CC-231: erro em tempo de execução não é erro de sintaxe, e o gate só sabe
     ver o segundo. Uma variável que deixou de existir fez `renderViewAgora`
     lançar no meio: a tela Agora ficou com o bloco central vazio, prometendo
     pendências no cabeçalho e mostrando nada. Ninguém viu por horas, porque a
     página carrega, navega e não mostra erro em lugar algum.
     Daqui em diante o Chrome conta o que aconteceu. */
  const erros = []
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params?.exceptionDetails
      erros.push(`${d?.exception?.description || d?.text || 'erro'}`.split('\n')[0])
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      erros.push(`console.error: ${(m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 160))
    }
  })
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
  await cmd('Page.navigate', { url: URL_BASE })
  await esperar(5000)

  const estado = () => js('({ hash: location.hash, tela: document.querySelector(\'.view-section.active\')?.id, ag: (typeof agSelecionado !== \'undefined\' ? agSelecionado : null) })')

  let e = await estado()
  conta('abre no Cockpit, sem endereço na barra', e.tela === 'view-cockpit' && !e.hash, JSON.stringify(e))

  await js("showPage('view-trabalho')"); await esperar(1200)
  e = await estado()
  conta('ir para Trabalho grava #trabalho', e.hash === '#trabalho' && e.tela === 'view-trabalho', JSON.stringify(e))

  await js("showPage('view-agentes')"); await esperar(1500)
  e = await estado()
  conta('ir para Agentes grava #agentes', e.hash === '#agentes' && e.tela === 'view-agentes', JSON.stringify(e))

  const abriu = await js("(() => { const el = document.querySelector('[data-ag]'); if (!el) return null; el.click(); return el.dataset.ag })()")
  await esperar(1200)
  e = await estado()
  conta('abrir um agente grava #agentes/<id>', Boolean(abriu) && e.hash === '#agentes/' + abriu && e.ag === abriu, JSON.stringify(e))

  await js('history.back()'); await esperar(1200)
  e = await estado()
  conta('voltar fecha o agente e fica em Agentes', e.hash === '#agentes' && e.tela === 'view-agentes' && !e.ag, JSON.stringify(e))

  await js('history.back()'); await esperar(1200)
  e = await estado()
  conta('voltar de novo devolve a tela Trabalho', e.hash === '#trabalho' && e.tela === 'view-trabalho', JSON.stringify(e))

  /* O botão de voltar DA TELA e o do aparelho precisam concordar. Fechando o
     agente na mão, o toque em voltar do telefone traria ele de volta, e os dois
     botões diriam coisas diferentes sobre onde ele está. */
  await js("showPage('view-agentes')"); await esperar(1200)
  await js("document.querySelector('[data-ag]')?.click()"); await esperar(1200)
  await js("document.querySelector('[data-ag-voltar]')?.click()"); await esperar(1200)
  e = await estado()
  conta('o voltar da tela concorda com o do navegador', e.hash === '#agentes' && !e.ag, JSON.stringify(e))

  await cmd('Page.navigate', { url: URL_BASE + '#trabalho' })
  await esperar(5000)
  e = await estado()
  conta('recarregar em #trabalho abre em Trabalho', e.tela === 'view-trabalho', JSON.stringify(e))

  /* Endereço que não existe não pode deixar a tela em branco: link velho,
     erro de digitação e favorito de uma tela que mudou de nome caem aqui. */
  await cmd('Page.navigate', { url: URL_BASE + '#nao-existe' })
  await esperar(5000)
  e = await estado()
  conta('endereço desconhecido cai no Cockpit', e.tela === 'view-cockpit', JSON.stringify(e))

  /* CC-231: abre TODAS as telas do menu, uma a uma, e cobra duas coisas:
     que nada exploda, e que a tela não fique muda. Bloco central vazio com o
     cabeçalho prometendo conteúdo foi o defeito que passou despercebido. */
  const telas = await js("[...new Set([...document.querySelectorAll('.nav-item[data-target]')].map((a) => a.dataset.target))]")
  for (const tela of telas || []) {
    await js(`showPage('${tela}')`)
    await esperar(900)
    const vazio = await js(`(() => {
      const v = document.getElementById('${tela}');
      if (!v) return 'a tela não existe no DOM';
      const t = (v.innerText || '').trim();
      return t.length < 12 ? 'a tela abriu praticamente vazia' : '';
    })()`)
    conta(`${tela} abre com conteúdo`, !vazio, vazio || '')
  }
  conta(`nenhum erro de execução nas ${(telas || []).length} telas`, erros.length === 0, erros.slice(0, 4).join(' | '))
} catch (err) {
  console.error('ERRO:', err?.message || err)
  falhas++
} finally {
  try { ws?.close() } catch { /* já fechado */ }
  chrome.kill()
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
  process.exit(falhas ? 1 : 0)
}
