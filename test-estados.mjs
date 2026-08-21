#!/usr/bin/env node
/**
 * A mesma tela em VÁRIOS ESTADOS, não em um só.
 *
 * ## O erro que criou este arquivo, em 21/08
 *
 * Entreguei a lista de projetos na barra lateral do Coderoom, e ela nascia
 * aberta com todos os projetos e todas as conversas à mostra. Ele abriu no
 * computador:
 *
 * > "aumentou significativamente o tamanho da barra lateral. Porque está
 * > expondo todos os projetos e todos os chats, né? (…) Não faz muito sentido
 * > ela ocupar tanto espaço."
 *
 * E fez a pergunta que importa mais que o defeito:
 *
 * > "como que essas coisas óbvias não passam na sua linha de produção? Você
 * > revisa o app usando algum navegador, alguma coisa ou você simplesmente nem
 * > vê esses problemas?"
 *
 * ## A resposta, e por que o gate que já existe não pegou
 *
 * Eu revisei com navegador. Olhei o estado errado: as capturas saíram com a
 * barra lateral ENCOLHIDA, e nesse estado o submenu nem aparece. Olhei a
 * imagem, o submenu não estava nela, e não percebi que não estava.
 *
 * O `visual-guard` rodou e passou, corretamente pela regra dele: ele cobra que
 * o turno tenha aberto PELO MENOS UMA imagem, e eu abri várias. O comentário no
 * próprio hook explica a escolha: *"exigir duas larguras seria mais correto e
 * viraria hook chato"*. **Uma imagem prova que houve olhar, não que se olhou o
 * estado certo.** Este arquivo cobre a diferença.
 *
 * ## O que ele mede
 *
 * Abre a tela, força cada estado de propósito, e reprova quando:
 *
 * - algo vaza para fora da largura sem estar dentro de caixa que rola;
 * - sobra texto espremido em caixa de menos de 90px;
 * - o campo de escrever sai da tela ou fica menor que 100px;
 * - a página inteira ganha rolagem lateral.
 *
 * Estado é combinação, não largura: barra lateral aberta e fechada, submenu
 * aberto e fechado, telefone, monitor e a faixa estreita entre os dois.
 *
 * ## Fora do `npm test`, e por quê
 *
 * Precisa de navegador, e o gate de todo dia roda sem nenhum. Mesma decisão do
 * `test-endereco.mjs` e do `test-estreito.mjs`.
 *
 *     node test-estados.mjs [url] [pasta-das-imagens]
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'

const URL_PAINEL = process.argv[2] || 'http://127.0.0.1:5180/'
const PASTA = process.argv[3] || join(tmpdir(), 'cc-estados')

/* O mesmo achador do `capturar-tela`: caminho fixo de Chrome não existe nas
   duas máquinas, e na VPS o único navegador é o do Playwright. */
function acharChrome() {
  if (process.env.CC_CHROME) return process.env.CC_CHROME
  for (const c of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ]) if (existsSync(c)) return c
  const base = join(homedir(), '.cache', 'ms-playwright')
  if (!existsSync(base)) return null
  for (const pasta of readdirSync(base).filter((n) => n.startsWith('chromium'))) {
    for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const c = join(base, pasta, rel)
      if (existsSync(c)) return c
    }
  }
  return null
}

/* Cada estado é uma COMBINAÇÃO, e é isso que o resto das réguas não cobre.
   `prep` roda dentro da página para forçar o estado; sem forçar, a varredura
   mede sempre o mesmo e volta verde sem ter olhado nada. */
const ESTADOS = [
  { nome: 'monitor, lateral aberta, submenu fechado', w: 1280, h: 900,
    prep: `document.querySelector('.sidebar')?.classList.remove('encolhida'); if (typeof GATE !== 'undefined') GATE.submenuAberto = false;` },
  { nome: 'monitor, lateral aberta, submenu aberto', w: 1280, h: 900,
    prep: `document.querySelector('.sidebar')?.classList.remove('encolhida'); if (typeof GATE !== 'undefined') { GATE.submenuAberto = true; GATE.projetoAberto = null; }` },
  { nome: 'monitor, lateral encolhida', w: 1280, h: 900,
    prep: `document.querySelector('.sidebar')?.classList.add('encolhida'); if (typeof GATE !== 'undefined') GATE.submenuAberto = true;` },
  { nome: 'telefone 390', w: 390, h: 844,
    prep: `if (typeof GATE !== 'undefined') GATE.submenuAberto = true;` },
  { nome: 'janela estreita 720', w: 720, h: 900,
    prep: `if (typeof GATE !== 'undefined') GATE.submenuAberto = true;` },
]

/* A medida roda DENTRO da página. Cada uma existe por um defeito que já
   aconteceu aqui, e nenhuma é enfeite. */
const MEDIDA = (tela) => `(() => {
  const v = document.getElementById('view-${tela}') || document.body;
  const dentro = [...v.querySelectorAll('*')];
  const vaza = dentro.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= window.innerWidth + 1) return false;
    /* Dentro de caixa que rola de propósito não é vazamento: o funil da tela
       Trabalho desliza de lado por escolha, e contar aquilo como defeito
       produzia dezenas de falsos positivos. */
    let p = el.parentElement;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') return false;
      p = p.parentElement;
    }
    return true;
  }).length;
  const espremido = dentro.filter((el) => {
    if (el.children.length) return false;
    if ((el.innerText || '').trim().length < 12) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.width < 90;
  }).length;
  const sb = document.querySelector('.sidebar');
  const campo = document.querySelector('#gate-txt, textarea');
  const rc = campo ? campo.getBoundingClientRect() : null;
  /* Quanto um bloco que ABRE come da tela.
   *
   * Esta é a medida que faltava, e é a que teria pego o defeito que ele
   * apontou: a lista de projetos nascia aberta e somava 414px a um menu que já
   * não cabia. Não meço a altura do menu inteiro de propósito: ele já era maior
   * que a tela antes, e reprovar por isso acusaria o painel inteiro em vez do
   * que acabou de ser acrescentado. */
  const abriveis = [...document.querySelectorAll('.gate-submenu, .sidebar [data-abre]')]
    .filter((el) => el.offsetParent !== null);
  const comeDaTela = abriveis.reduce((a, el) => a + el.getBoundingClientRect().height, 0);
  return {
    ehOPainel: Boolean(document.querySelector('.view-section')),
    vaza, espremido,
    alturaMenu: sb && getComputedStyle(sb).display !== 'none' ? Math.round(sb.scrollHeight) : 0,
    fatiaDaTela: Math.round(100 * comeDaTela / window.innerHeight),
    campoNaTela: rc ? (rc.bottom <= window.innerHeight + 1 && rc.width > 100) : null,
    rolagemLateral: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
})()`

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

const CHROME = acharChrome()
if (!CHROME) {
  console.error('não achei Chrome nem Chromium. Aponte um com CC_CHROME=/caminho.')
  process.exit(1)
}

const tela = process.env.CC_TELA || 'gate'
const PORTA = 9200 + (process.pid % 300)
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--no-first-run',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${PORTA}`,
  '--user-data-dir=' + join(tmpdir(), `cc-est-${process.pid}`), 'about:blank',
], { stdio: 'ignore' })

let ruins = 0
let ws = null
try {
  mkdirSync(PASTA, { recursive: true })
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
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const cmd = (metodo, params = {}) => new Promise((r) => { const meu = ++id; pend.set(meu, r); ws.send(JSON.stringify({ id: meu, method: metodo, params })) })
  const js = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

  await cmd('Page.enable')
  await cmd('Runtime.enable')
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 900 })
  /* SEM `?static=1`: a classe de defeito mais cara deste painel só existe com o
     redesenho de 2 em 2 segundos rodando, e com ele desligado o teste passa
     sempre sem provar nada. */
  await cmd('Page.navigate', { url: `${URL_PAINEL}#${tela}` })
  await esperar(8000)

  console.log(`tela: ${tela}  ·  ${URL_PAINEL}\n`)
  for (const e of ESTADOS) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: e.w, height: e.h, deviceScaleFactor: 1, mobile: e.w <= 500, screenWidth: e.w, screenHeight: e.h })
    await js(`${e.prep} if (typeof renderGate === 'function') renderGate();`)
    await esperar(900)
    const m = await js(MEDIDA(tela))

    /* O estado foi MESMO forçado?
     *
     * Sem esta pergunta, um preparo que não faz nada devolve verde em todos os
     * estados, e o gate vira carimbo. Aconteceu na primeira execução deste
     * arquivo: o preparo dizia `window.GATE`, e `const GATE` dentro do script
     * da página nunca vira propriedade de `window`. Os cinco estados mediram o
     * mesmo, e o relatório disse "5 de 5 limpos" sem ter olhado nenhum.
     *
     * A régua que não sabe dizer se olhou é exatamente o defeito que este
     * arquivo existe para evitar. */
    const forcou = await js(`(() => {
      const sb = document.querySelector('.sidebar');
      return {
        encolhida: Boolean(sb?.classList.contains('encolhida')),
        submenu: typeof GATE !== 'undefined' ? Boolean(GATE.submenuAberto) : null,
      };
    })()`)
    const querSubmenu = /submenu aberto|encolhida|telefone|estreita/.test(e.nome)
    if (forcou?.submenu === null && e.prep.includes('GATE')) {
      console.log(`  ⚠ o preparo deste estado não pegou: a tela não expõe o estado que ele tenta forçar`)
      ruins++
    } else if (querSubmenu && forcou?.submenu === false) {
      console.log(`  ⚠ pedi o submenu aberto e ele continua fechado`)
      ruins++
    }

    /* Página que não é o painel reprova, nunca passa calada. Foi assim que uma
       tela de erro do navegador virou captura "válida" em 21/08. */
    /* Metade da tela é o teto de um bloco que abre dentro do menu. Acima disso
       ele empurra os outros destinos para fora, que é a queixa dele por
       escrito: *"não faz muito sentido ela ocupar tanto espaço"*. */
    const inchou = (m?.fatiaDaTela || 0) > 50
    const mal = !m || !m.ehOPainel || m.vaza > 0 || m.espremido > 0 || m.campoNaTela === false || m.rolagemLateral || inchou
    if (mal) ruins++
    console.log(`${mal ? 'RUIM ' : ' ok  '} ${e.nome.padEnd(42)} ${JSON.stringify(m)}`)

    const shot = await cmd('Page.captureScreenshot', { format: 'png' })
    if (shot.result?.data) {
      writeFileSync(join(PASTA, `${tela}-${e.w}-${e.nome.replace(/[^a-z0-9]+/gi, '-')}.png`), Buffer.from(shot.result.data, 'base64'))
    }
  }
  console.log(`\n${ESTADOS.length - ruins} de ${ESTADOS.length} estados limpos`)
  console.log(`imagens em ${PASTA}`)
} catch (e) {
  console.error('ERRO:', e?.message || e)
  ruins++
} finally {
  try { ws?.close() } catch { /* já fechado */ }
  chrome.kill()
  process.exit(ruins ? 1 : 0)
}
