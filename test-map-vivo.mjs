/**
 * CC-238, a camada VIVA do test-map: o que só o DOM sabe.
 *
 * ## Por que ela existe
 *
 * **73 das 79 ações do painel nascem dentro de template literal**, em execução,
 * dependendo de dado. A varredura de texto (`src/testmap.mjs`) conhece o
 * vocabulário completo, e não sabe o que aparece em qual tela nem se aparece.
 *
 * Sem esta camada o mapa prometeria o que não mede, que é exatamente o defeito
 * que ele existe para atacar.
 *
 * ## O que ela mede, por tela
 *
 * - quais ações estão presentes de verdade, e quantos botões dá para tocar
 * - erro de EXECUÇÃO, que não é erro de sintaxe e o `npm test` não vê (CC-231)
 * - se a tela cabe em 390px sem corte nem rolagem lateral
 * - se a tela abriu praticamente vazia, que é o sintoma mais caro deste painel
 *
 * ## Fora do `npm test`, de propósito
 *
 * Precisa de Chrome e do painel no ar. Roda com `npm run test:map`.
 *
 * ## Duas armadilhas que já custaram uma rodada inteira, e estão resolvidas aqui
 *
 * 1. **`--window-size` não define o viewport de layout.** Pedir 390 devolve
 *    ~500 CSS px, e 500 ainda cai no ramo estreito do CSS, então a medição
 *    PARECE um celular e não mede nada sobre 390. Resolvido com
 *    `--force-device-scale-factor=1` mais `Emulation.setDeviceMetricsOverride`.
 * 2. **Conectar em `lista[0]` do CDP pega qualquer aba** que já estivesse no
 *    perfil, e uma medição de 390 acabou acontecendo na janela de 1280 da
 *    execução anterior. Aqui a aba é criada por `/json/new` e conectada por id.
 *
 * A régua barata de largura é a barra de baixo, e o seletor certo é
 * `.barra-baixo .bb-item`: com 390 de verdade os cinco botões cabem inteiros,
 * com centros em 39/117/195/273/351. Se algum sai do quadro, a medida mente.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { chromePath } from './src/platform.mjs'
import { montarMapa } from './src/testmap.mjs'

const CHROME = chromePath()
const URL_BASE = process.argv[2] || 'http://127.0.0.1:5180/'
const LARGURA = Number(process.env.CC_LARGURA || 390)
const PORTA = 9500 + (process.pid % 200)
const PERFIL = `${process.env.TMPDIR || process.env.TEMP || '/tmp'}/cc-map-${process.pid}`

if (!CHROME) {
  console.error('sem Chrome nesta máquina. Aponte um com CC_CHROME=<caminho>')
  process.exit(1)
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-sandbox',
  '--force-device-scale-factor=1', `--remote-debugging-port=${PORTA}`,
  `--user-data-dir=${PERFIL}`, 'about:blank',
], { stdio: 'ignore' })

let falhas = 0
let ws = null

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
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const cmd = (metodo, params = {}) => new Promise((r) => { const meu = ++id; pend.set(meu, r); ws.send(JSON.stringify({ id: meu, method: metodo, params })) })
  const js = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

  await cmd('Page.enable')
  await cmd('Runtime.enable')

  let erros = []
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

  await cmd('Emulation.setDeviceMetricsOverride', {
    width: LARGURA, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: LARGURA, screenHeight: 844,
  })
  await cmd('Page.navigate', { url: URL_BASE })
  await esperar(3500)

  /* A largura é validada ANTES de qualquer medida valer. Captura estreita já
     mentiu por 28% neste projeto, e uma medição que mente é pior que nenhuma. */
  const regua = await js(`(() => {
    const b = [...document.querySelectorAll('.barra-baixo .bb-item')];
    const fora = b.filter((e) => { const r = e.getBoundingClientRect();
      return r.right > document.documentElement.clientWidth + 0.5 || r.left < -0.5; }).length;
    return JSON.stringify({ largura: document.documentElement.clientWidth, botoes: b.length, fora,
      centros: b.map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.left + r.width / 2) }) });
  })()`)
  const r = JSON.parse(regua || '{}')
  if (r.largura !== LARGURA) {
    throw new Error(`a medição ia mentir: pedi ${LARGURA}px e a página mede ${r.largura}px`)
  }
  if (r.botoes && r.fora > 0) {
    throw new Error(`${r.fora} botão(ões) da barra de baixo fora do quadro: a janela é mais larga do que afirma`)
  }
  console.log(`\nlargura conferida: ${r.largura}px, ${r.botoes} botões da barra, centros em ${(r.centros || []).join('/')}\n`)

  const telas = await js(`JSON.stringify([...new Set([...document.querySelectorAll('[data-target^="view-"]')].map((e) => e.dataset.target))])`)
  const lista = JSON.parse(telas || '[]')
  const vivo = {}

  for (const tela of lista) {
    erros = []
    await js(`showPage(${JSON.stringify(tela)})`)
    await esperar(900)
    const bruto = await js(`(() => {
      const el = document.getElementById(${JSON.stringify(tela)});
      if (!el) return JSON.stringify({ ausente: true });
      const vis = (n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 };
      const dentro = [...el.querySelectorAll('*')];
      const acoes = new Set();
      for (const n of dentro) for (const k of Object.keys(n.dataset || {})) acoes.add(k);
      const larg = document.documentElement.clientWidth;
      /* Passar da borda SÓ é defeito quando nenhum ancestral rola de lado.
         O funil da tela Trabalho tem colunas dentro de um container com
         rolagem horizontal própria, de propósito: contar aquilo como vazamento
         daria 115 falsos positivos numa tela só, e a armadilha registrada no
         projeto é exatamente esta — quase se consertou um defeito que não
         existia porque a medida olhava o lugar errado. */
      const emAreaRolavel = (n) => {
        for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
        }
        return false;
      };
      const fugitivos = dentro.filter((n) => vis(n)
        && n.getBoundingClientRect().right > larg + 1
        && !emAreaRolavel(n));
      const vazando = fugitivos.length;
      const exemploVazando = fugitivos.slice(0, 3).map((n) => {
        const t = (n.tagName || '').toLowerCase();
        const c = (n.className && typeof n.className === 'string') ? '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
        return t + c + ' (' + Math.round(n.getBoundingClientRect().right - larg) + 'px além)';
      });
      return JSON.stringify({
        elementos: dentro.length,
        botoes: dentro.filter((n) => n.tagName === 'BUTTON' && vis(n)).length,
        acoes: [...acoes].sort(),
        altura: Math.round(el.getBoundingClientRect().height),
        vazando,
        exemploVazando,
        rolagemLateral: document.documentElement.scrollWidth > larg,
      });
    })()`)
    const m = JSON.parse(bruto || '{}')
    m.erros = [...new Set(erros)]
    vivo[tela] = m

    /* "Praticamente vazia" é o sintoma mais caro deste painel: a tela Agora
       ficou com um bloco de 12 pixels embaixo de um cabeçalho prometendo
       conteúdo, e ninguém viu por horas.
       **Mas tela baixa com botão dentro não é vazia, é sob clique**: a do
       Digest é um botão só, de propósito, e o conteúdo nasce quando ele toca.
       Cobrar isso seria a cobrança falsa que ensina a ignorar a medida, que é
       a lição que este projeto já pagou mais de uma vez. */
    const vazia = (m.altura || 0) < 80 && !(m.botoes > 0)
    const problemas = [
      m.ausente ? 'a tela não existe no DOM' : null,
      vazia ? `abriu praticamente vazia (${m.altura}px de altura)` : null,
      m.erros.length ? `${m.erros.length} erro(s) de execução: ${m.erros[0]}` : null,
      m.vazando ? `${m.vazando} elemento(s) passando da borda em ${LARGURA}px, fora de área rolável: ${(m.exemploVazando || []).join(', ')}` : null,
      m.rolagemLateral ? 'a página inteira rola de lado' : null,
    ].filter(Boolean)

    if (problemas.length) falhas++
    console.log(`  ${problemas.length ? 'FALHOU' : 'ok    '} ${tela.padEnd(20)} `
      + `${String(m.botoes ?? 0).padStart(3)} botões, ${String((m.acoes || []).length).padStart(2)} ações`
      + (problemas.length ? `\n           ${problemas.join('\n           ')}` : ''))
  }

  /* A camada viva volta para DENTRO do mesmo mapa: duas fontes separadas para a
     mesma pergunta seria a segunda verdade que este projeto evita em todo lugar. */
  const mapa = montarMapa(process.cwd())
  mapa.vivo = { em: Date.now(), largura: LARGURA, telas: vivo }
  for (const it of mapa.itens) {
    if (it.tipo !== 'tela') continue
    const m = vivo[`view-${it.rotulo}`]
    if (!m) continue
    it.dimensoes.estreito = {
      coberto: m.vazando || m.rolagemLateral ? null : 'test-map-vivo.mjs',
      como: m.vazando || m.rolagemLateral ? null : `medida em ${LARGURA}px, nada passando da borda`,
      ...(m.vazando || m.rolagemLateral ? { nota: `${m.vazando} elemento(s) passam da borda em ${LARGURA}px` } : {}),
    }
  }
  fs.writeFileSync('docs/TEST-MAP.json', `${JSON.stringify(mapa, null, 1)}\n`)

  const comAcoes = Object.values(vivo).reduce((n, m) => n + (m.acoes || []).length, 0)
  console.log(`\n${lista.length} telas medidas, ${comAcoes} presenças de ação registradas.`)
  console.log(`docs/TEST-MAP.json atualizado com a camada viva.\n`)
} catch (e) {
  console.error(`\nERRO: ${e.message}\n`)
  falhas++
} finally {
  try { ws?.close() } catch { /* já foi */ }
  try { chrome.kill() } catch { /* já foi */ }
  try { fs.rmSync(PERFIL, { recursive: true, force: true }) } catch { /* segue */ }
}

process.exit(falhas ? 1 : 0)
