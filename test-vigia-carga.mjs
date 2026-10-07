// CC-857: o vigia de carga entra, baixa a prioridade, segura e solta, com histerese
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-vigia-'))
process.env.CC_HOME = casa
const V = await import('./src/vigiaCarga.mjs')
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const ta = async (nome, fn) => { await fn(); console.log('  ok   ' + nome) }

const N = 6 // núcleos: entra acima de 12, sai abaixo de 9
const PS = '  101  0 chrome-headless\n  102  0 opencode\n  103 10 opencode\n  104  0 node\n  105  0 chrome\n'

t('CC-857: seis leituras acima de 2x entram; cinco não (o limite é de um minuto, não de um pico)', () => {
  let e = V.estadoInicial(); let m
  for (let i = 0; i < 5; i++) ({ estado: e, mudou: m } = V.proximoEstado(e, 13, N)); assert.equal(m, null); assert.equal(e.segurando, false)
  ;({ estado: e, mudou: m } = V.proximoEstado(e, 13, N)); assert.equal(m, 'entrou'); assert.equal(e.segurando, true)
})
t('CC-857: um pico solto no meio zera a contagem', () => {
  let e = V.estadoInicial()
  for (const c of [13, 13, 13, 13, 5, 13, 13]) ({ estado: e } = V.proximoEstado(e, c, N))
  assert.equal(e.segurando, false)
})
t('CC-857: histerese: entre 1,5x e 2x não solta nem prende; só abaixo de 1,5x por um minuto solta', () => {
  let e = { ...V.estadoInicial(), segurando: true, desde: 1 }; let m
  for (let i = 0; i < 12; i++) ({ estado: e, mudou: m } = V.proximoEstado(e, 10, N)) // 10 está entre 9 e 12
  assert.equal(e.segurando, true); assert.equal(m, null)
  for (let i = 0; i < 6; i++) ({ estado: e, mudou: m } = V.proximoEstado(e, 4, N))
  assert.equal(m, 'saiu'); assert.equal(e.segurando, false)
})
t('CC-857: só Chrome e opencode ainda na prioridade normal são alvo (node, e quem já cedeu, ficam)', () => {
  assert.deepEqual(V.alvosDePrioridade(PS).map((a) => a.pid), [101, 102, 105])
})
await ta('CC-857: ao entrar baixa a prioridade dos alvos, passa a segurar e registra a carga que causou', async () => {
  V._reiniciar(); const baixados = []
  let r
  for (let i = 0; i < 6; i++) r = await V.tick({ carga: 14.2, nucleos: N, agora: 1_000 + i, ps: async () => PS, baixar: (pid, p) => baixados.push([pid, p]) })
  assert.equal(r.mudou, 'entrou'); assert.equal(V.estaSegurando(), true)
  assert.deepEqual(baixados, [[101, 10], [102, 10], [105, 10]])
  assert.match(V.motivoDeSegurar(), /sobrecarregada.*carga 14\.2 em 6 núcleos/)
  const log = fs.readFileSync(V.ARQUIVO_LOG(), 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(log.at(-1).evento, 'entrou'); assert.equal(log.at(-1).carga, 14.2); assert.equal(log.at(-1).baixouPrioridade, 3)
})
await ta('CC-857: abaixo do limite por um minuto solta o disparo e registra', async () => {
  let r
  for (let i = 0; i < 6; i++) r = await V.tick({ carga: 3, nucleos: N, agora: 9_000 + i, ps: async () => '', baixar: () => {} })
  assert.equal(r.mudou, 'saiu'); assert.equal(V.estaSegurando(), false)
  assert.equal(JSON.parse(fs.readFileSync(V.ARQUIVO_LOG(), 'utf8').trim().split('\n').at(-1)).evento, 'saiu')
})
await ta('CC-857: processo que morreu entre o ps e o renice não derruba o vigia', async () => {
  V._reiniciar()
  for (let i = 0; i < 6; i++) await V.tick({ carga: 20, nucleos: N, ps: async () => PS, baixar: () => { throw new Error('ESRCH') } })
  assert.equal(V.estaSegurando(), true)
})
await ta('CC-857: segurando, o disparo de agente novo é recusado com a causa; solto, a recusa some', async () => {
  V._reiniciar()
  for (let i = 0; i < 6; i++) await V.tick({ carga: 20, nucleos: N, ps: async () => '', baixar: () => {} })
  const O = await import('./src/opencode.mjs')
  const r = O.dispararTarefa('qualquer coisa', { cwd: casa })
  assert.equal(r.ok, false); assert.equal(r.segurado, true); assert.match(r.erro, /sobrecarregada.*Tente de novo/)
  const G = await import('./src/gateAgentes.mjs')
  assert.throws(() => G.enviar({ agente: 'opencode', texto: 'oi', cwd: casa }), (e) => e.segurado === true && /sobrecarregada/.test(e.message))
  for (let i = 0; i < 6; i++) await V.tick({ carga: 1, nucleos: N, ps: async () => '', baixar: () => {} })
  assert.equal(V.estaSegurando(), false)
})
t('CC-857: a tela tem o aviso, lendo /api/carga, com palavra e ícone', () => {
  const ui = fs.readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes("fetch('/api/carga')") && ui.includes('VPS sobrecarregada') && ui.includes('#c2-carga'))
  const web = fs.readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(web.includes("'/api/carga'") && web.includes('V.iniciar()'), 'o servidor expõe a carga e liga o vigia')
})
fs.rmSync(casa, { recursive: true, force: true })
