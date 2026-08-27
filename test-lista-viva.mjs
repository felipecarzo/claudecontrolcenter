/**
 * CC-364 — a lista de projetos entra sozinha, sem recarregar a página.
 *
 * ## Por que este teste existe
 *
 * Foi a primeira coisa que ele descreveu em 27/08, com o caso concreto:
 *
 * > *"não está atualizando automático por exemplo, eu criei um projeto ontem,
 * > no desktop, dei VPS sync (…) esse projeto não apareceu automaticamente,
 * > sendo que deveria"*
 *
 * Medido antes de consertar: o servidor devolvia o projeto novo. Quem não relia
 * era a tela, que só carregava a lista ao ENTRAR nela. Com a página aberta no
 * telefone, como ele deixa, o projeto nunca aparecia.
 *
 * ## O que ele prova, e por que precisa de navegador
 *
 * Que a pasta criada DEPOIS de a tela estar aberta entra sozinha. Isso não dá
 * para testar sem navegador: o defeito era um `setInterval` que não existia, e
 * nenhum teste de módulo veria a falta dele.
 *
 * **Sem `?static=1`**, pela armadilha já registrada: com o fluxo desligado todo
 * teste de tela passa e não prova nada.
 *
 * ## A prova negativa
 *
 * Ele também confere o contrário, e essa metade é a que dá valor à primeira:
 * com o relógio desligado (`window.SEM_TIQUE`), o projeto novo NÃO entra. Sem
 * isso o teste só saberia dizer "hoje passa", e não que pegaria a regressão.
 *
 * ## Isolamento
 *
 * Roda com `CC_PROJECTS_BASE` e `CC_HOME` apontando para pasta temporária. Duas
 * armadilhas da casa juntas: teste que escreve no dado real dele é defeito, e
 * `CONFIG_FILE` não se separa por porta.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromePath } from './src/platform.mjs'

const CHROME = process.env.CC_CHROME || chromePath()
if (!CHROME) {
  console.error('sem Chrome nesta máquina. Aponte um com CC_CHROME=<caminho>')
  process.exit(1)
}

const CASA = mkdtempSync(join(tmpdir(), 'cc-lista-viva-'))
const BASE = join(CASA, 'projetos')
const PORTA_WEB = 8300 + (process.pid % 90)
const PORTA_CDP = 9500 + (process.pid % 90)
mkdirSync(BASE, { recursive: true })

/** Uma pasta só vira projeto com `.git` ou `CLAUDE.md`, que é a régua de
 *  `isProject`. Sem isso ela seria pasta de passagem, e o teste passaria
 *  medindo a coisa errada. */
function criarProjeto(nome) {
  const dir = join(BASE, nome)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'CLAUDE.md'), `# ${nome}\n`)
  return dir
}

criarProjeto('VPS_antesDaTela')

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let falhas = 0
const conta = (nome, ok, detalhe = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FALHA'}   ${nome}${detalhe ? ' — ' + detalhe : ''}`)
  if (!ok) falhas++
}

const servidor = spawn(process.execPath, ['cc.mjs', '--web-only', '--port', String(PORTA_WEB)], {
  env: { ...process.env, CC_HOME: CASA, CC_PROJECTS_BASE: BASE },
  stdio: 'ignore',
})

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-sandbox',
  '--force-device-scale-factor=1', `--remote-debugging-port=${PORTA_CDP}`,
  '--user-data-dir=' + join(CASA, 'perfil'), 'about:blank',
], { stdio: 'ignore' })

function encerrar(codigo) {
  try { chrome.kill() } catch { /* já morreu */ }
  try { servidor.kill() } catch { /* já morreu */ }
  try { rmSync(CASA, { recursive: true, force: true }) } catch { /* deixa para o sistema */ }
  process.exit(codigo)
}

let ws = null
let seq = 0
const pendentes = new Map()

function chamar(metodo, params = {}) {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: metodo, params }))
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject })
    setTimeout(() => { if (pendentes.delete(id)) reject(new Error('sem resposta: ' + metodo)) }, 20000)
  })
}

async function avaliar(expressao) {
  const r = await chamar('Runtime.evaluate', {
    expression: expressao, returnByValue: true, awaitPromise: true,
  })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'exceção na página')
  return r.result?.value
}

async function principal() {
  await esperar(6000)

  const versao = await fetch(`http://127.0.0.1:${PORTA_CDP}/json/version`).then((r) => r.json())
  /* Aba PRÓPRIA, pelo id, e nunca `lista[0]`: a armadilha registrada é que
     pegar a primeira aba conecta na janela de outra execução, com outra
     largura, e a medida sai errada sem ninguém ver. */
  const aba = await fetch(`http://127.0.0.1:${PORTA_CDP}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  void versao

  ws = new WebSocket(aba.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (!m.id) return
    const p = pendentes.get(m.id)
    if (!p) return
    pendentes.delete(m.id)
    if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result)
  }

  await chamar('Page.enable')
  await chamar('Runtime.enable')
  await chamar('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  })

  await chamar('Page.navigate', { url: `http://127.0.0.1:${PORTA_WEB}/#projetos` })
  await esperar(9000)

  const naTela = () => avaliar(`(() => {
    const g = document.getElementById('pj-grade');
    return [...g.querySelectorAll('.pj-nome')].map((h) => h.textContent.trim().split(/\\s+/)[0]);
  })()`)

  const antes = await naTela()
  conta('a tela abre com o projeto que já existia', antes.some((n) => n.includes('VPS_antesDaTela')),
    antes.length + ' na tela')

  /* O coração do teste: a pasta nasce DEPOIS de a tela estar aberta, e
     ninguém toca em nada daqui até o fim. */
  criarProjeto('VPS_nasceuComATelaAberta')
  conta('a pasta nova foi criada com a tela já aberta', true, 'nenhum clique, nenhum recarregar')

  /* O tique é de 20s e o cache do servidor é de 15s. 30s cobre uma volta
     inteira com folga; menos que isso mediria a sorte do instante. */
  await esperar(30000)

  const depois = await naTela()
  const entrou = depois.some((n) => n.includes('VPS_nasceuComATelaAberta'))
  conta('o projeto novo entrou sozinho', entrou,
    entrou ? 'sem recarregar a página' : 'ainda são ' + depois.length + ': ' + depois.join(', '))

  /* ===== A prova negativa =====
     Desliga o relógio e cria outra pasta. Se ela entrar assim mesmo, o teste
     acima estava passando por outro caminho e não prova o que diz. */
  await avaliar('window.SEM_TIQUE = true; true')
  criarProjeto('VPS_comORelogioDesligado')
  await esperar(30000)
  const final = await naTela()
  const naoEntrou = !final.some((n) => n.includes('VPS_comORelogioDesligado'))
  conta('com o relógio desligado, NÃO entra (prova negativa)', naoEntrou,
    naoEntrou ? 'o relógio é mesmo quem traz' : 'entrou sem o relógio: o teste acima não prova nada')

  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
  encerrar(falhas ? 1 : 0)
}

principal().catch((e) => {
  console.error('ERRO:', e.message)
  encerrar(1)
})
