// CC-1096: o achado de navegador sem tela esquecido, num /proc de mentira montado numa pasta temporária.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { navegadoresSemTela } from './src/navegadores.mjs'

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-'))
const BTIME = 1_700_000_000
const agora = (BTIME + 10 * 86400) * 1000 // dez dias depois do boot
// pid, pai, uid, início em segundos depois do boot, RSS em KB, argumentos
const proc = (pid, pai, uid, inicioS, rss, args) => {
  const d = path.join(raiz, String(pid)); fs.mkdirSync(d)
  const f = Array(50).fill('0'); f[1] = String(pai); f[19] = String(inicioS * 100)
  fs.writeFileSync(path.join(d, 'stat'), `${pid} (nome com espaço) S ${f.slice(1).join(' ')}`) // como no /proc: o estado é o campo 0 depois do nome
  fs.writeFileSync(path.join(d, 'cmdline'), args.join('\0') + '\0')
  fs.writeFileSync(path.join(d, 'status'), `Name:\tx\nUid:\t${uid}\t${uid}\nVmRSS:\t${rss} kB\n`)
}
try {
  fs.writeFileSync(path.join(raiz, 'stat'), `cpu 0\nbtime ${BTIME}\n`)
  // o esquecido: 9 dias, duas abas e uma extensão
  proc(100, 1, 1001, 86400, 200 * 1024, ['/opt/chrome-headless-shell', '--headless', '--remote-debugging-port=9333', '--user-data-dir=/tmp/p9333'])
  proc(101, 100, 1001, 86400, 100 * 1024, ['/opt/chrome-headless-shell', '--type=renderer'])
  proc(102, 100, 1001, 86400, 100 * 1024, ['/opt/chrome-headless-shell', '--type=renderer'])
  proc(103, 100, 1001, 86400, 50 * 1024, ['/opt/chrome-headless-shell', '--type=renderer', '--extension-process'])
  proc(104, 101, 1001, 86400, 24 * 1024, ['/opt/chrome-headless-shell', '--type=utility'])
  // recém-aberto, outro usuário (o do Docker), e um Chrome com tela
  proc(200, 1, 1001, 10 * 86400 - 600, 300 * 1024, ['/usr/bin/chromium', '--headless=new'])
  proc(300, 1, 999, 86400, 900 * 1024, ['/usr/bin/chromium', '--headless'])
  proc(400, 1, 1001, 86400, 900 * 1024, ['/usr/bin/google-chrome'])

  const r = navegadoresSemTela({ raiz, uid: 1001, agora })
  assert.equal(r.length, 1, 'só o esquecido passa de um dia')
  const n = r[0]
  assert.equal(n.pid, 100)
  assert.equal(n.horas, 216, '9 dias')
  assert.equal(n.abas, null, 'aba não sai da linha de comando (o fork do zygote mente); vem da porta, em comAbas')
  assert.equal(n.processos, 5, 'a árvore inteira, neto incluído')
  assert.equal(n.memoriaMB, 474, 'memória da árvore inteira')
  assert.equal(n.porta, '9333'); assert.equal(n.perfil, '/tmp/p9333')
  assert.deepEqual(navegadoresSemTela({ raiz, uid: 1001, agora, horas: 0 }).map((x) => x.pid).sort(), [100, 200], 'sem idade mínima entra o recente; outro usuário e Chrome com tela nunca')
  assert.equal(navegadoresSemTela({ raiz: path.join(raiz, 'nada') }), null, 'sem /proc devolve null, não lista vazia')
  console.log('test-navegadores: 9 verificações, 0 falhas')
} finally { fs.rmSync(raiz, { recursive: true, force: true }) }
