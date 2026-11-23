/** CC-1075: cc sessao encerrar. Casa falsa (HOME e CC_HOME temporários) e tmux falso injetado: nada real é tocado. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1075-'))
const casa = path.join(tmp, '.claude')
fs.mkdirSync(path.join(casa, 'sessions'), { recursive: true })
process.env.HOME = tmp
process.env.USERPROFILE = tmp // CC-1118: no Windows os.homedir() lê USERPROFILE, não HOME
process.env.CC_HOME = casa
delete process.env.XDG_DATA_HOME
const reg = (arq, pid, id, extra = {}) => fs.writeFileSync(path.join(casa, 'sessions', `${arq}.json`),
  JSON.stringify({ pid, sessionId: id, cwd: tmp, startedAt: 1000, ...extra }))
let n = 0
const ok = async (nome, fn) => { await fn(); n++; console.log('ok', nome) }

try {
  const { encerrar, lerEncerradas, arquivoEncerradas } = await import('./src/encerrarSessao.mjs')
  const { sessoesAbertas } = await import('./src/sessoes.mjs')
  const chamadas = []
  const falso = (nome) => chamadas.push(nome)

  await ok('(b) sem registro: erro claro e nada gravado', async () => {
    const r = await encerrar({ sessionId: 'nao-existe', fechar: falso })
    assert.equal(r.ok, false)
    assert.match(r.erro, /registro/)
    assert.ok(!fs.existsSync(arquivoEncerradas()))
    assert.equal(chamadas.length, 0)
  })
  await ok('(b2) sem CLAUDE_CODE_SESSION_ID: erro claro', async () => {
    const r = await encerrar({ sessionId: '', fechar: falso })
    assert.equal(r.ok, false)
    assert.match(r.erro, /CLAUDE_CODE_SESSION_ID/)
  })

  reg('a', process.pid, 'sess-A', { tmux: 'cc-remote-projA:@1.%1' })
  reg('b', process.pid, 'sess-B', { tmux: 'cc-remote-projB:@2.%2' })
  await ok('(a)(c) acha a própria sessão, grava o carimbo e agenda só o tmux dela', async () => {
    const r = await encerrar({ sessionId: 'sess-A', fechar: falso, agora: 5000 })
    assert.equal(r.ok, true)
    assert.deepEqual(lerEncerradas(), { 'sess-A': 5000 })
    assert.deepEqual(chamadas, ['%1'], 'fecha só o PAINEL da própria sessão, nunca a sessão tmux inteira nem a de outra')
    assert.match(r.texto, /fecha em 6 segundos/)
  })
  await ok('(h) CC-1123: tmux que não se alcança (caixa de proteção) falha em voz alta e não marca', async () => {
    reg('h', process.pid, 'sess-H', { tmux: 'cc-remote-projH:@8.%8' })
    const r = await encerrar({ sessionId: 'sess-H', fechar: () => false, agora: 5000 })
    assert.equal(r.ok, false)
    assert.match(r.erro, /fora da caixa de proteção/)
    assert.equal(lerEncerradas()['sess-H'], undefined)
  })
  await ok('(g) registro de tmux sem id de painel: só marca, não fecha nada', async () => {
    chamadas.length = 0
    reg('d', process.pid, 'sess-D', { tmux: 'cc-remote-projD' })
    const r = await encerrar({ sessionId: 'sess-D', fechar: falso, agora: 5000 })
    assert.equal(r.ok, true)
    assert.equal(chamadas.length, 0)
    assert.equal(r.fecha, false)
  })
  await ok('(d) --so-marcar não agenda', async () => {
    chamadas.length = 0
    const r = await encerrar({ sessionId: 'sess-B', soMarcar: true, fechar: falso, agora: 5000 })
    assert.equal(r.ok, true)
    assert.equal(chamadas.length, 0)
    assert.equal(r.fecha, false)
    assert.equal(lerEncerradas()['sess-B'], 5000)
  })
  await ok('(e) sem tmux: só marca', async () => {
    chamadas.length = 0
    reg('c', process.pid, 'sess-C')
    const r = await encerrar({ sessionId: 'sess-C', fechar: falso, agora: 5000 })
    assert.equal(r.ok, true)
    assert.equal(chamadas.length, 0)
    assert.match(r.texto, /não está num tmux/)
  })
  await ok('(f) sessoesAbertas descarta a carimbada e aceita a retomada depois do carimbo', async () => {
    fs.rmSync(path.join(casa, 'sessions'), { recursive: true })
    fs.mkdirSync(path.join(casa, 'sessions'))
    reg('a', process.pid, 'sess-A', { startedAt: 1000 }) // iniciada antes do carimbo (5000): descartada
    reg('r', process.pid, 'sess-R', { startedAt: 9000 }) // retomada depois do carimbo: vale
    fs.writeFileSync(arquivoEncerradas(), JSON.stringify({ 'sess-A': 5000, 'sess-R': 5000 }))
    const a = sessoesAbertas()
    assert.ok(!a.has('sess-A'))
    assert.ok(a.has('sess-R'))
  })
  await ok('CLI: sem sessão dá erro e código diferente de 0', () => {
    const r = spawnSync(process.execPath, [path.join(aqui, 'cc.mjs'), 'sessao', 'encerrar'], {
      input: '\n', encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: '', CC_SEM_NAVEGADOR: '1' },
    })
    assert.notEqual(r.status, 0)
    assert.match(r.stderr + r.stdout, /CLAUDE_CODE_SESSION_ID/)
  })
  console.log(`${n} ok`)
} finally { fs.rmSync(tmp, { recursive: true, force: true }) }
