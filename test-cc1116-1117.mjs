// CC-1116: troca de PID ao religar o painel não é "2 painéis enviando"; dois PIDs intercalados são.
// CC-1117: `vivas` por projeto usa o mesmo corte de esquecida (3 dias) do resto da tela.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { montar, ehEsquecida, limiteEsquecida } from './src/cockpit2.mjs'
import { empurradoresSimultaneos } from './src/federacao.mjs'

let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok  ${nome}`) }
const espera = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

// ── CC-1116, a regra pura ──
await t('troca em sequência (velho parou, novo começou) devolve só o novo', () => {
  const r = empurradoresSimultaneos([
    { tipo: 'painel', pid: 3030434, desde: 1000, em: 5000 },
    { tipo: 'painel', pid: 2289608, desde: 6000, em: 6000 },
  ])
  assert.deepEqual(r.map((e) => e.pid), [2289608])
})
await t('dois PIDs intercalados continuam sendo duplicado, com os dois', () => {
  const r = empurradoresSimultaneos([
    { tipo: 'painel', pid: 1, desde: 1000, em: 9000 }, // mandou DEPOIS do primeiro envio do outro
    { tipo: 'reporte', pid: 2, desde: 5000, em: 6000 },
  ])
  assert.deepEqual(r.map((e) => e.pid).sort(), [1, 2])
})
await t('um só e lista vazia ficam como estão', () => {
  assert.equal(empurradoresSimultaneos([{ tipo: 'painel', pid: 1, desde: 1, em: 2 }]).length, 1)
  assert.deepEqual(empurradoresSimultaneos(undefined), [])
})

// ── CC-1116, de ponta a ponta pelo arquivo do pacote ──
await t('gravar pacotes: religar não avisa, intercalar avisa', async () => {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1116-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  try {
    const F = await import(`./src/federacao.mjs?casa=${encodeURIComponent(casa)}`)
    const maquina = { id: 'vps9', nome: 'VPS9' }
    const manda = (pid) => { F.gravarPacote({ maquina, jobs: [], origem: { pid, tipo: 'painel' }, em: Date.now() }); espera(8) }
    const conta = () => F.maquinasConhecidas(F.lerPacotes(), { id: 'pc', nome: 'PC' }).find((m) => m.id === 'vps9').empurradores
    manda(100); manda(100)
    manda(200) // o 100 morreu (systemctl restart), o 200 nasceu
    manda(200)
    assert.deepEqual(conta().map((e) => e.pid), [200], 'troca: sem aviso')
    manda(100) // o antigo voltou a mandar depois do primeiro envio do novo: agora são dois de verdade
    assert.deepEqual(conta().map((e) => e.pid).sort(), [100, 200], 'duplicado real: com aviso')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
  }
})

// ── CC-1117 ──
const agora = 1_800_000_000_000
const job = (id, status, ha) => ({ id, project: 'cockpit', status, updatedAt: agora - ha, subject: 'x', model: 'opus' })
const vivasDe = (jobs) => montar({ jobs, local: { id: 'pc', nome: 'PC' }, agora, falaDe: () => null })
  .projetos.reduce((t, p) => t + p.vivas, 0)

await t('a conta de esquecida é uma só e respeita o corte de 3 dias', () => {
  assert.equal(limiteEsquecida(), 3 * 864e5)
  assert.equal(ehEsquecida({ estado: 'espera você', desdeMs: 14 * 864e5 }), true)
  assert.equal(ehEsquecida({ estado: 'espera você', desdeMs: 2 * 864e5 }), false)
  assert.equal(ehEsquecida({ estado: 'trabalhando', desdeMs: 14 * 864e5 }), false, 'trabalhando nunca é esquecida')
})
await t('vivas por projeto: "espera você" parada há 14 dias não conta; a de 1 hora conta', () => {
  assert.equal(vivasDe([job('aaaa1111', 'waiting', 14 * 864e5)]), 0)
  assert.equal(vivasDe([job('bbbb2222', 'waiting', 3600_000)]), 1)
  assert.equal(vivasDe([job('aaaa1111', 'waiting', 14 * 864e5), job('bbbb2222', 'waiting', 3600_000)]), 1)
})

console.log(`\n${ok} verificações, 0 falhas`)
