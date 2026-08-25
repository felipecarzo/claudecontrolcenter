/**
 * CC-357: cada rótulo do controle remoto casa com a SUA conversa.
 *
 * O furo era `conversaDe(cwd)` devolver a conversa mais nova para todos os
 * rótulos do mesmo projeto. Este teste guarda o casamento por tempo de criação,
 * com os NÚMEROS reais medidos no painel vivo em 26/08.
 *
 * A função `casarConversas` não é exportada (é interna do estado()), então o
 * teste replica a mesma regra e, no fim, confere que o código do arquivo
 * continua casando por `criadoEm` e não por "mais nova".
 */
import assert from 'node:assert'
import fs from 'node:fs'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

// réplica fiel de casarConversas (mesma regra do remotecontrol.mjs)
function casar(sessoes, convsPorCwd) {
  const mapa = new Map()
  const porCwd = new Map()
  for (const s of sessoes) { if (!s.cwd) continue; if (!porCwd.has(s.cwd)) porCwd.set(s.cwd, []); porCwd.get(s.cwd).push(s) }
  const TOL = 5000
  for (const [cwd, labels] of porCwd) {
    const convs = [...(convsPorCwd[cwd] || [])].sort((a, b) => a.criadoEm - b.criadoEm)
    const usadas = new Set()
    for (const s of [...labels].sort((a, b) => a.criado - b.criado)) {
      let c = convs.find((x) => !usadas.has(x.id) && x.criadoEm >= s.criado - TOL)
      if (!c) { for (let i = convs.length - 1; i >= 0; i--) { if (!usadas.has(convs[i].id)) { c = convs[i]; break } } }
      if (c) { usadas.add(c.id); mapa.set(s.nome, c.id) }
    }
  }
  return mapa
}

// 1. o caso real medido: dois rótulos, cada um com a conversa nascida logo depois
try {
  const cwd = '/home/claudedev/projetos/VPS_cockpit'
  const sessoes = [
    { nome: 'cc-remote-VPS_cockpit', criado: 1787648058000, cwd },
    { nome: 'cc-remote-VPS_cockpit-2', criado: 1787676432000, cwd },
  ]
  const convs = { [cwd]: [
    { id: 'fbabdeb0', criadoEm: 1787648062000 }, // 4s depois do 1o rótulo
    { id: 'd4b47d4e', criadoEm: 1787676435000 }, // 3s depois do 2o rótulo
    { id: '21e88ed9', criadoEm: 1787588516000 }, // mais velha, de antes
  ] }
  const m = casar(sessoes, convs)
  assert.equal(m.get('cc-remote-VPS_cockpit'), 'fbabdeb0', 'o 1o rótulo casa com a conversa nascida logo depois dele')
  assert.equal(m.get('cc-remote-VPS_cockpit-2'), 'd4b47d4e', 'o 2o rótulo casa com a SUA conversa, não com a mais nova')
  assert.notEqual(m.get('cc-remote-VPS_cockpit'), m.get('cc-remote-VPS_cockpit-2'), 'os dois NÃO podem apontar para a mesma conversa')
  ok('cada rótulo casa com a conversa nascida logo depois dele (números reais)')
} catch (e) { erro('caso real', e) }

// 2. sessão retomada (conversa velha) cai no reserva, não trava
try {
  const cwd = '/x'
  const sessoes = [{ nome: 'cc-remote-x', criado: 2000000000000, cwd }]
  const convs = { [cwd]: [{ id: 'velha', criadoEm: 1000000000000 }] } // nasceu MUITO antes
  const m = casar(sessoes, convs)
  assert.equal(m.get('cc-remote-x'), 'velha', 'sem conversa nascida depois, fica com a única disponível (reserva)')
  ok('sessão retomada cai no reserva em vez de ficar sem conversa')
} catch (e) { erro('retomada', e) }

// 3. o código do arquivo casa por criadoEm, não por "a mais nova"
try {
  const src = fs.readFileSync(new URL('./src/remotecontrol.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes('function casarConversas'), 'a função de casamento precisa existir')
  assert.ok(src.includes('nascimentosDe'), 'precisa ler o nascimento das conversas, não só a modificação')
  const i = src.indexOf('function casarConversas')
  const trecho = src.slice(i, i + 900)
  assert.ok(/criadoEm >= s\.criado/.test(trecho), 'o casamento tem que ser por tempo de criação (criadoEm >= criado)')
  ok('o remotecontrol.mjs casa por tempo de criação')
} catch (e) { erro('código usa criadoEm', e) }

if (falhou) process.exit(1)
console.log('test-remoto-conversa: ok')
