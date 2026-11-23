#!/usr/bin/env node
/**
 * CC-1078: servidor de tradução do app Tradutor (tools/tradutor/tradutor.py).
 *
 * Casa falsa: HOME temporário, porta livre aleatória, token em arquivo temporário e um `claude`
 * FALSO no PATH (lê uma linha JSON por pedido e devolve uma linha de resultado). Nenhum modelo é chamado.
 * Casos: a 401/saúde, b traduzir, c idioma local, d recebida em pt, e audio 501, f teto,
 * g interruptor, h prefixo, i privacidade, j token 600, k argumentos e CC_*, l byte não ASCII, m uso.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WIN } from './test/windows.mjs'

// CC-1118: o servidor sobe com `timeout` e `python3` do Linux, e o claude falso é script de bash; no Windows nada disso
// existe, e o python poderia achar o claude.exe REAL no PATH. Roda na VPS, onde o tradutor vive.
if (WIN) { console.log('test-tradutor: PULADO no Windows (precisa de timeout, python3 e bash do Linux)'); process.exit(0) }

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const SERVIDOR = path.join(RAIZ, 'tools', 'tradutor', 'tradutor.py')
const CASA = fs.mkdtempSync(path.join(os.tmpdir(), 'tradutor-'))
const HOME = path.join(CASA, 'home')
const BIN = path.join(CASA, 'bin')
const REG = path.join(CASA, 'registro') // fora do HOME: o que o falso anota não conta como "gravado pelo servidor"
for (const d of [HOME, BIN, REG]) fs.mkdirSync(d, { recursive: true })
fs.mkdirSync(path.join(HOME, '.config', 'agent-cockpit'), { recursive: true })

const FALSO = path.join(BIN, 'claude')
fs.writeFileSync(FALSO, [
  '#!/bin/bash',
  'echo "$@" >> "$FAKE_DIR/args"',
  'env | grep "^CC_" >> "$FAKE_DIR/env"',
  'while IFS= read -r l; do',
  '  echo x >> "$FAKE_DIR/n"',
  '  if [[ "$l" == *detect* ]]; then echo \'{"type":"result","result":"{\\"lang\\":\\"fr\\",\\"pt\\":\\"ola\\"}"}\'',
  '  else echo \'{"type":"result","result":"traduzido-falso"}\'; fi',
  'done',
].join('\n'))
fs.chmodSync(FALSO, 0o755)
const chamadas = () => { try { return fs.readFileSync(path.join(REG, 'n'), 'utf8').split('\n').filter(Boolean).length } catch { return 0 } }
const ler = (f) => { try { return fs.readFileSync(path.join(REG, f), 'utf8') } catch { return '' } }

let falhas = 0
const ok = (cond, msg) => { if (!cond) { falhas++; console.error(`FALHOU: ${msg}`) } else console.log(`ok ${msg}`) }

const portaLivre = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)) }) })
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const servidores = []

async function subir(teto) {
  const porta = await portaLivre()
  const tokenArq = path.join(CASA, `token-${porta}`)
  const env = { ...process.env, HOME, USERPROFILE: HOME, PATH: `${BIN}${path.delimiter}${process.env.PATH}`, FAKE_DIR: REG, CC_SEM_NAVEGADOR: '1',
    TRADUTOR_PORTA: String(porta), TRADUTOR_TOKEN_ARQ: tokenArq, TRADUTOR_TETO_HORA: String(teto) }
  const p = spawn('timeout', ['120', 'python3', '-u', SERVIDOR], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const s = { p, porta, tokenArq, saida: '', base: `http://127.0.0.1:${porta}` }
  p.stdout.on('data', (d) => { s.saida += d })
  p.stderr.on('data', (d) => { s.saida += d })
  servidores.push(s)
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${s.base}/saude`)).ok) break } catch { /* ainda subindo */ }
    await dorme(100)
  }
  s.token = fs.existsSync(tokenArq) ? fs.readFileSync(tokenArq, 'utf8').trim() : ''
  return s
}
function matarTudo() {
  for (const s of servidores) { try { process.kill(-s.p.pid, 'SIGKILL') } catch { /* já morreu */ } }
}
process.on('exit', matarTudo)

const req = async (s, metodo, rota, corpo, token = s.token) => {
  const r = await fetch(s.base + rota, { method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: metodo === 'POST' ? JSON.stringify(corpo ?? {}) : undefined })
  let j = null
  try { j = await r.json() } catch { /* sem corpo */ }
  return { status: r.status, j }
}

const MARCA = 'zzcobaia123'
try {
  const A = await subir(100)
  ok(A.token.length > 10, 'servidor subiu e criou o token')

  // a
  ok((await req(A, 'POST', '/traduzir', { texto: 'oi', para: 'en' }, '')).status === 401, 'a: sem token, 401')
  ok((await req(A, 'POST', '/traduzir', { texto: 'oi', para: 'en' }, 'errado')).status === 401, 'a: token errado, 401')
  ok((await req(A, 'GET', '/saude', null, '')).status === 200, 'a: /saude sem token, 200')

  // b
  const n0 = chamadas()
  const b = await req(A, 'POST', '/traduzir', { texto: `hello ${MARCA}`, para: 'es' })
  ok(b.status === 200 && b.j?.traducao === 'traduzido-falso', 'b: /traduzir devolve a tradução do falso')
  ok(chamadas() === n0 + 1, 'b: uma chamada ao falso')

  // c
  const n1 = chamadas()
  const casos = [['pt', `não sei o que você quer agora ${MARCA}`], ['en', 'hello how are you doing today'],
    ['es', 'hola gracias por todo, mañana hablamos'], ['zh', '你好，今天怎么样']]
  for (const [lang, texto] of casos) {
    const r = await req(A, 'POST', '/idioma', { texto })
    ok(r.status === 200 && r.j?.lang === lang, `c: /idioma ${lang} responde ${r.j?.lang}`)
  }
  ok(chamadas() === n1, 'c: /idioma de texto claro não chamou o falso')

  // d
  const d = await req(A, 'POST', '/recebida', { texto: `não sei, você vai hoje? ${MARCA}` })
  ok(d.status === 200 && d.j?.lang === 'pt' && d.j.traducao === undefined, 'd: /recebida em português devolve {"lang":"pt"}')
  ok(chamadas() === n1, 'd: /recebida em português não chamou o falso')

  // CC-1078 deteccao: portugues com estrangeiro continua portugues
  const nD = chamadas()
  const idi = async (texto) => (await req(A, 'POST', '/idioma', { texto })).j?.lang
  ok(await idi('tá bom, tá tudo ok') === 'pt', 'det a: "tá bom, tá tudo ok" é pt')
  ok(await idi('Love you, boa noite') === 'pt', 'det b: "Love you, boa noite" é pt')
  ok(await idi('ok') === 'xx', 'det c: "ok" é xx')
  ok(await idi('Nos vemos mañana en la oficina') === 'es', 'det d: es')
  ok(await idi('Estoy en casa') === 'es', 'det e: "Estoy en casa" é es')
  ok(await idi('I love you amor') === 'en', 'det f: "I love you amor" é en')
  ok(chamadas() === nD, 'det a-f: nenhuma chamou o falso')
  for (const x of ['tá tudo ok', 'Love you, boa noite']) {
    const r = await req(A, 'POST', '/recebida', { texto: x })
    ok(r.j?.lang === 'pt' && r.j.traducao === undefined, `det g: /recebida "${x}" devolve {"lang":"pt"}`)
  }
  const rx = await req(A, 'POST', '/recebida', { texto: 'ok' })
  ok(rx.j?.lang === 'xx' && rx.j.traducao === undefined, 'det i: /recebida "ok" devolve xx')
  ok(chamadas() === nD, 'det g,i: nenhuma chamou o falso')
  const rh = await req(A, 'POST', '/recebida', { texto: 'Nos vemos mañana en la oficina' })
  ok(rh.j?.lang === 'es' && rh.j.traducao === 'traduzido-falso' && chamadas() === nD + 1, 'det h: /recebida em es traduz com uma chamada')
  ok(fs.readFileSync(SERVIDOR, 'utf8').includes('If T is mostly Portuguese (even with some English/Spanish words, slang, typos or abbreviations), lang is "pt" and "pt":""'), 'det j: SISTEMA tem a frase nova')
  ok(!/PT_FORTES|def parece_pt/.test(fs.readFileSync(SERVIDOR, 'utf8')), 'det: PT_FORTES e parece_pt removidos')

  // e
  const e = await req(A, 'POST', '/audio', {})
  ok(e.status === 501 && e.j?.erro === 'sem audio', 'e: /audio, 501 sem audio')

  // g
  const desl = path.join(HOME, '.config', 'agent-cockpit', 'tradutor-desligado')
  fs.writeFileSync(desl, '')
  const g = await req(A, 'POST', '/traduzir', { texto: 'oi', para: 'en' })
  ok(g.status === 503, 'g: interruptor ligado, 503')
  fs.unlinkSync(desl)
  ok((await req(A, 'POST', '/traduzir', { texto: 'oi', para: 'en' })).status === 200, 'g: religado, 200')

  // h
  const h = await req(A, 'POST', '/tradutor/traduzir', { texto: 'oi', para: 'en' })
  ok(h.status === 200 && h.j?.traducao === 'traduzido-falso', 'h: prefixo /tradutor/traduzir funciona')
  ok((await req(A, 'GET', '/tradutor/saude', null, '')).status === 200, 'h: /tradutor/saude, 200')

  // i: todas as rotas com a palavra única
  await req(A, 'POST', '/log', { texto: `log ${MARCA} ${MARCA}` })
  await req(A, 'POST', '/recebida', { texto: `this is a message with ${MARCA} inside` })
  await req(A, 'POST', '/recebida', { texto: `qwxz ${MARCA} blorp` })
  await req(A, 'POST', '/idioma', { texto: `qwxz ${MARCA} blorp` })
  await req(A, 'POST', '/traduzir', { texto: `${MARCA} de novo`, para: 'zh' })
  await req(A, 'POST', '/audio', { texto: MARCA })
  await dorme(300)
  const achados = []
  const varrer = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const c = path.join(dir, f.name)
    if (f.isDirectory()) varrer(c)
    else if (fs.readFileSync(c).includes(MARCA)) achados.push(c) } }
  varrer(HOME)
  ok(!A.saida.includes(MARCA), 'i: a palavra única não aparece no stdout/stderr do servidor')
  ok(achados.length === 0, `i: a palavra única não está em nenhum arquivo do HOME falso ${achados.join(',')}`)
  ok(/app log, 2\d caracteres|app log, \d+ caracteres/.test(A.saida), 'i: /log guardou só o tamanho')

  // j
  ok((fs.statSync(A.tokenArq).mode & 0o777) === 0o600, 'j: arquivo do token com modo 600')

  // k
  const args = ler('args'), env = ler('env')
  for (const a of ['--no-session-persistence', '--setting-sources local', '--tools']) ok(args.includes(a), `k: o falso recebeu ${a}`)
  ok(/CC_CONFERENTE=1/.test(env) && /CC_TRADUTOR=1/.test(env), 'k: o falso recebeu CC_CONFERENTE=1 e CC_TRADUTOR=1')

  // l: byte não ASCII no cabeçalho, por socket cru
  const l = await new Promise((res) => {
    const c = net.connect(A.porta, '127.0.0.1')
    let buf = ''
    c.on('data', (d) => { buf += d.toString('latin1') })
    c.on('close', () => res(buf)); c.on('error', () => res(buf))
    c.write(Buffer.concat([Buffer.from('GET /uso HTTP/1.0\r\nAuthorization: Bearer caf'), Buffer.from([0xc3, 0xa9, 0xff]), Buffer.from('\r\n\r\n')]))
  })
  ok(/^HTTP\/1\.\d 401/.test(l), `l: byte não ASCII no token, 401 (${l.slice(0, 20).replace(/\r?\n/g, ' ')})`)
  ok((await req(A, 'GET', '/saude', null, '')).status === 200, 'l: servidor continua de pé')

  // m
  ok((await req(A, 'GET', '/uso', null, '')).status === 401, 'm: /uso sem token, 401')
  const m = await req(A, 'GET', '/uso')
  ok(m.status === 200 && Number.isInteger(m.j?.ultima_hora) && m.j?.teto === 100, 'm: /uso devolve ultima_hora e teto')

  // f: teto 3
  const B = await subir(3)
  const nB = chamadas()
  const st = []
  for (let i = 0; i < 4; i++) st.push((await req(B, 'POST', '/traduzir', { texto: `x${i}`, para: 'en' })).status)
  ok(st.slice(0, 3).every((s) => s === 200), `f: três primeiras passam (${st})`)
  const quarta = await req(B, 'POST', '/traduzir', { texto: 'x4', para: 'en' })
  ok(quarta.status === 429 && quarta.j?.erro === 'limite', `f: quarta ao modelo, 429 limite (${st[3]},${quarta.status})`)
  ok(chamadas() === nB + 3, `f: o falso foi chamado 3 vezes, não 4 (${chamadas() - nB})`)
} finally {
  matarTudo()
}
await dorme(300)
console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos os casos passaram')
process.exit(falhas ? 1 : 0)
