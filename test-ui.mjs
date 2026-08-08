// Teste de ponta a ponta da aba de to-dos: dirige o Chrome por CDP e confere
// que criar, editar, marcar e apagar pela página chegam no meta.json em disco.
//
// Fica fora do `npm test` de propósito — precisa de Chrome instalado, e o
// gate de qualidade não pode depender disso. Rode quando mexer na aba:
//
//     node test-ui.mjs <id-do-job>            (o id é o nome da pasta em ~/.claude/jobs)
//
// ATENÇÃO: escreve no meta.json do job informado e no arquivo de notas da
// máquina, e restaura os dois no fim — o estado que devolve é o do começo da
// rodada, então não fique editando o painel enquanto o teste corre.
// Use um job seu, não o de um agente trabalhando.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { startWeb } from './src/web.mjs'
import { chromePath } from './src/platform.mjs'
import { NOTES_FILE } from './src/notes.mjs'

const JOB = process.argv[2]
if (!JOB) {
  console.error('uso: node test-ui.mjs <id-do-job>\n  o id é o nome da pasta em ~/.claude/jobs')
  process.exit(2)
}

const CDP = 9333
const META = path.join(os.homedir(), '.claude', 'jobs', JOB, 'meta.json')
if (!fs.existsSync(META)) {
  console.error(`job sem meta.json: ${META}\n  rode "cc set" nele antes, ou escolha outro job`)
  process.exit(2)
}

const chrome = chromePath()
if (!chrome) {
  console.error('Chrome não encontrado — este teste depende dele')
  process.exit(2)
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const lerMeta = () => JSON.parse(fs.readFileSync(META, 'utf8'))
const textos = () => lerMeta().todos.map((t) => t.text)
const original = fs.readFileSync(META, 'utf8')
// as notas da máquina são do usuário: guarda e devolve no fim
const notasOriginais = fs.existsSync(NOTES_FILE) ? fs.readFileSync(NOTES_FILE, 'utf8') : null

const { server, url } = await startWeb({ port: 8199 })
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-e2e-'))
const navegador = spawn(chrome, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${CDP}`,
  `--user-data-dir=${perfil}`, '--no-first-run',
  `${url}/?tab=todos&expand=1&notes=1&open=${JOB}`,
], { stdio: 'ignore' })

let ws
let id = 0
const chamar = (method, params) =>
  new Promise((resolve, reject) => {
    const meu = ++id
    const ouvir = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== meu) return
      ws.removeEventListener('message', ouvir)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
    ws.addEventListener('message', ouvir)
    ws.send(JSON.stringify({ id: meu, method, params }))
  })

const rodar = async (expressao) => {
  const r = await chamar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'erro na página')
  return r.result.value
}

const ok = (msg) => console.log(`  ok  ${msg}`)

/**
 * A página grava com atraso (e às vezes duas gravações se atropelam), então
 * esperar um tempo fixo transforma lentidão em falha falsa. Espera-se a
 * condição, com teto.
 */
async function ate(descricao, condicao, ms = 4000) {
  const limite = Date.now() + ms
  let ultimo
  while (Date.now() < limite) {
    ultimo = condicao()
    if (ultimo) return
    await espera(100)
  }
  throw new Error(descricao)
}

try {
  let alvo
  for (let i = 0; i < 40 && !alvo; i++) {
    await espera(250)
    try {
      const lista = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()
      alvo = lista.find((t) => t.type === 'page' && t.url.includes('tab=todos'))
    } catch {}
  }
  if (!alvo) throw new Error('o Chrome não abriu a página de depuração')

  ws = new WebSocket(alvo.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  // erro dentro de um handler da página não aparece em lugar nenhum daqui:
  // sem isso, o sintoma é "não gravou" e a causa fica escondida
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      console.error(`  !!  erro na página: ${d.exception?.description || d.text}`)
    }
  })
  await chamar('Runtime.enable')
  // sem isso o navegador bloqueia a área de transferência e o teste de copiar
  // falharia por permissão, não por defeito
  await chamar('Browser.grantPermissions', {
    origin: url,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  })
  await espera(2500) // a primeira leitura varre os transcripts

  const antes = textos()

  // criar
  await rodar(`document.querySelector('button[data-add="${JOB}"]').click(), 1`)
  await espera(200)
  // o foco tem que ir pra posição nova, não pro último campo da tela: com as
  // concluídas à mostra, "o último" é uma tarefa que já existe
  const focado = await rodar('document.activeElement.dataset.i')
  if (Number(focado) !== antes.length) throw new Error(`+ focou a linha errada (data-i=${focado})`)

  await rodar(`(() => {
    const novo = document.querySelector('.txt[data-edit="${JOB}"][data-i="${antes.length}"]')
    novo.value = 'tarefa criada pelo teste'
    novo.dispatchEvent(new Event('change', { bubbles: true }))
    return 1
  })()`)
  await ate('criar não gravou no meta.json', () => textos().includes('tarefa criada pelo teste'))
  const comNova = textos()
  if (comNova.length !== antes.length + 1) throw new Error(`criar sobrescreveu tarefa: ${JSON.stringify(comNova)}`)
  ok(`criar — ${antes.length} → ${comNova.length}`)

  const i = comNova.indexOf('tarefa criada pelo teste')

  // editar
  await rodar(`(() => {
    const campo = document.querySelector('.txt[data-edit="${JOB}"][data-i="${i}"]')
    campo.value = 'texto corrigido pelo teste'
    campo.dispatchEvent(new Event('change', { bubbles: true }))
    return 1
  })()`)
  await ate('editar não chegou no meta.json', () => textos().includes('texto corrigido pelo teste'))
  ok('editar o texto')

  // marcar feito
  await rodar(`(() => {
    const cb = document.querySelector('input[data-todo="${JOB}"][data-i="${i}"]')
    cb.checked = true
    cb.dispatchEvent(new Event('change', { bubbles: true }))
    return 1
  })()`)
  await ate('o checkbox não marcou feito', () => lerMeta().todos[i]?.done)
  ok('marcar feito')

  // texto em branco apaga
  await rodar(`(() => {
    const campo = document.querySelector('.txt[data-edit="${JOB}"][data-i="${i}"]')
    campo.value = '   '
    campo.dispatchEvent(new Event('change', { bubbles: true }))
    return 1
  })()`)
  await ate('texto em branco não apagou a tarefa',
    () => JSON.stringify(textos()) === JSON.stringify(antes))
  ok('texto em branco apaga')

  // o redesenho do stream não pode roubar o cursor
  await rodar(`(document.querySelector('.txt[data-edit="${JOB}"]').focus(), 1)`)
  const focoAntes = await rodar('document.activeElement.className')
  await rodar('(render(), 1)')
  const focoDepois = await rodar('document.activeElement.className')
  if (focoAntes !== focoDepois || !focoDepois.includes('txt')) {
    throw new Error(`o redesenho roubou o foco: ${focoAntes} → ${focoDepois}`)
  }
  ok('foco preservado no redesenho')

  // --- painel lateral: a nota do agente é editável ---
  await rodar(`(() => {
    const campo = document.querySelector('.d-nota[data-nota-job="${JOB}"]')
    if (!campo) throw new Error('o painel lateral não tem campo de nota')
    campo.value = 'nota escrita pelo teste'
    campo.dispatchEvent(new Event('change', { bubbles: true }))
    return 1
  })()`)
  await ate('a nota do agente não gravou', () => lerMeta().notes === 'nota escrita pelo teste')
  ok('nota do agente pelo painel lateral')

  // --- bloco de notas: virar lista, criar item, marcar ---
  const notas = () => JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8')).notes

  // O id vem da memória da página, não de "o primeiro do arquivo": a gravação
  // é assíncrona, e ler o disco cedo demais devolvia um bloco QUE JÁ EXISTIA —
  // o teste passava a escrever por cima das notas de verdade do usuário.
  const idsAntes = new Set(notas().map((n) => n.id))
  await rodar('(document.querySelector("#n-add").click(), 1)')
  const bloco = { id: await rodar('NOTES[0] && NOTES[0].id') }
  if (!bloco.id || idsAntes.has(bloco.id)) throw new Error('+ bloco não criou nota nova')

  const meuBloco = () => notas().find((n) => n.id === bloco.id)
  await ate('+ bloco não chegou no arquivo', meuBloco)

  await rodar(`(document.querySelector('[data-modo="${bloco.id}"]').click(), 1)`)
  await ate('não virou lista', () => meuBloco()?.kind === 'check')
  ok('bloco vira lista')

  await rodar(`(document.querySelector('[data-nota-add="${bloco.id}"]').click(), 1)`)
  await espera(200)
  await rodar(`(() => {
    const campo = document.querySelector('[data-nota-item="${bloco.id}"][data-i="0"]')
    campo.value = 'item do teste'
    campo.dispatchEvent(new Event('input', { bubbles: true }))
    return 1
  })()`)
  await ate('item novo não gravou', () => meuBloco()?.text === '[ ] item do teste')
  ok('item novo na lista')

  await rodar(`(document.querySelector('[data-nota-check="${bloco.id}"][data-i="0"]').click(), 1)`)
  await ate('marcar não gravou', () => meuBloco()?.text === '[x] item do teste')
  ok('marcar item da lista')

  // voltar pra texto tem que preservar o que estava marcado
  await rodar(`(document.querySelector('[data-modo="${bloco.id}"]').click(), 1)`)
  await ate('voltar pra texto perdeu conteúdo',
    () => meuBloco()?.kind === 'text' && meuBloco()?.text === '[x] item do teste')
  ok('voltar pra texto preserva as marcas')

  // --- aba de agentes: ordenar, fixar, copiar ---
  await rodar('(tab = "agentes", render(), 1)')
  await espera(200)

  await rodar('(document.querySelector(\'[data-sort="tokens"]\').click(), 1)')
  await espera(200)
  const linhas = await rodar(`
    [...document.querySelectorAll('tr.row')].map((tr) => {
      const j = DATA.jobs.find((x) => x.id === tr.dataset.job)
      return { tokens: j.tokens, pinned: !!j.pinned }
    })`)
  // fixado vem antes de tudo; dentro de cada grupo, do maior gasto pro menor
  const grupos = [linhas.filter((l) => l.pinned), linhas.filter((l) => !l.pinned)]
  if (linhas.findIndex((l) => !l.pinned) !== -1 && linhas.slice(linhas.findIndex((l) => !l.pinned)).some((l) => l.pinned)) {
    throw new Error(`fixado apareceu depois de não fixado: ${JSON.stringify(linhas)}`)
  }
  for (const g of grupos) {
    if (!g.every((l, i) => i === 0 || g[i - 1].tokens >= l.tokens)) {
      throw new Error(`não ordenou por tokens: ${JSON.stringify(g)}`)
    }
  }
  if (await rodar('document.querySelectorAll("tr.zone").length')) {
    throw new Error('ordenou mas manteve as zonas')
  }
  ok('ordenar por tokens desliga as zonas')

  await rodar('(document.querySelector(\'[data-sort=""]\').click(), 1)')
  await espera(200)
  if (!(await rodar('document.querySelectorAll("tr.zone").length'))) {
    throw new Error('não voltou a agrupar por urgência')
  }
  ok('voltar a agrupar')

  // fixar grava no meta.json, sem tocar no pins.json do Claude Code
  await rodar(`(document.querySelector('button[data-act="pin"][data-id="${JOB}"]').click(), 1)`)
  await ate('fixar não gravou meta.pin', () => lerMeta().pin === true)
  await rodar(`(document.querySelector('button[data-act="pin"][data-id="${JOB}"]').click(), 1)`)
  await ate('desafixar não removeu meta.pin', () => !('pin' in lerMeta()))
  ok('fixar e desafixar pelo meta.json')

  const caminho = await rodar(`(async () => {
    document.querySelector('button[data-act="path"][data-id="${JOB}"]').click()
    await new Promise((r) => setTimeout(r, 200))
    return navigator.clipboard.readText()
  })()`)
  if (!caminho || !caminho.includes('proj_controlcenter')) {
    throw new Error(`copiar caminho falhou: ${JSON.stringify(caminho)}`)
  }
  ok('copiar o caminho da pasta')

  console.log('\nok — a aba escreve no meta.json e não perde o cursor')
} finally {
  ws?.close()
  navegador.kill()
  server.close()
  await espera(400)
  // job e notas voltam ao que eram, mesmo se o teste falhou no meio
  if (fs.readFileSync(META, 'utf8') !== original) fs.writeFileSync(META, original)
  if (notasOriginais !== null) fs.writeFileSync(NOTES_FILE, notasOriginais)
  else if (fs.existsSync(NOTES_FILE)) fs.rmSync(NOTES_FILE)
  try { fs.rmSync(perfil, { recursive: true, force: true }) } catch {}
}
