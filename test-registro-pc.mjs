// CC-861: o PC manda as pastas dele para o registro central da VPS pela federação,
// sem registro paralelo. Duas máquinas de mentira: a VPS (um painel de verdade, em casa
// isolada) tem 3 projetos; o PC manda 4 pastas, 2 em comum. O registro termina com 5.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-registro-pc-'))
const home = path.join(casa, '.claude'); fs.mkdirSync(home, { recursive: true })
process.env.CC_HOME = home // antes de qualquer import do projeto: nada real é tocado
const M = await import('./src/migrarRegistro.mjs')
const R = await import('./src/projetoRegistro.mjs')
const F = await import('./src/federacao.mjs')

let n = 0
const t = async (nome, fn) => { await fn(); n += 1; console.log('  ok   ' + nome) }
const livre = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)) }) })
const arquivo = R.arquivoRegistro()
const PC = [
  { raiz: 'D:\\Documentos\\Ti\\projetos\\PC_alfa', ativo: true },
  { raiz: 'D:\\Documentos\\Ti\\projetos\\PC_beta', ativo: false },
  { raiz: 'D:\\Documentos\\Ti\\projetos\\PC_delta', ativo: true },
  { raiz: 'D:\\Documentos\\Ti\\projetos\\PC_epsilon', ativo: false },
]
let srv = null
try {
  await t('a VPS começa com 3 projetos no registro', () => {
    const r = M.migrar({ pastas: ['/v/VPS_alfa', '/v/VPS_beta', '/v/VPS_gama'], maquina: 'VPS', arquivo, ativoDe: () => true })
    assert.equal(r.ok, true); assert.equal(R.listar({ arquivo }).length, 3)
  })

  await t('o pacote leva as pastas só quando quem monta manda, e a validação recorta', () => {
    assert.equal('pastas' in F.montarPacote({ maquina: { id: 'pc1', nome: 'PC' } }), false)
    const p = F.montarPacote({ maquina: { id: 'pc1', nome: 'PC' }, pastas: PC })
    const v = F.validarPacote({ ...p, pastas: [...p.pastas, { raiz: 'x'.repeat(400), ativo: 'sim' }, { nada: 1 }] })
    assert.equal(v.ok, true); assert.equal(v.pacote.pastas.length, 5, 'a vazia sai, a longa é cortada')
    assert.equal(v.pacote.pastas[4].raiz.length, 300); assert.equal(v.pacote.pastas[4].ativo, false, 'ativo só com true de verdade')
    assert.equal(F.validarPacote({ maquina: { id: 'pc1' } }).pacote.pastas, null, 'ausente é "não mandou"')
  })

  // a VPS de verdade: painel em casa isolada, com federação ligada por token
  fs.writeFileSync(path.join(home, 'control-center.json'), JSON.stringify({ federacao: { token: 'tok-teste' } }))
  const porta = await livre()
  const base = fs.mkdtempSync(path.join(casa, 'base-'))
  srv = spawn(process.execPath, ['cc.mjs', '--web-only', '--port', String(porta)], { env: { ...process.env, CC_HOME: home, CC_PROJECTS_BASE: base, CC_SEM_NAVEGADOR: '1' }, stdio: 'ignore' })
  const url = `http://127.0.0.1:${porta}`
  for (let i = 0; i < 100; i += 1) { try { await fetch(url + '/api/jobs'); break } catch { await new Promise((r) => setTimeout(r, 150)) } }

  await t('token errado não toca o registro', async () => {
    const r = await F.enviar({ enviarPara: url, token: 'outro', pacote: F.montarPacote({ maquina: { id: 'pc1', nome: 'PC' }, pastas: PC }) })
    assert.equal(r.status, 401); assert.equal(R.listar({ arquivo }).length, 3)
  })

  await t('o PC manda 4 pastas (2 em comum): 5 entradas, PC nas 2 em comum, nenhuma duplicada', async () => {
    const r = await F.enviar({ enviarPara: url, token: 'tok-teste', pacote: F.montarPacote({ maquina: { id: 'pc1', nome: 'PC' }, pastas: PC }) })
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300))
    assert.deepEqual(r.registroPastas, { novos: 2, completar: 2, iguais: 0, total: 5 })
    const lista = R.listar({ arquivo })
    assert.equal(lista.length, 5); assert.equal(new Set(lista.map((p) => p.id)).size, 5)
    for (const id of ['alfa', 'beta']) assert.deepEqual(Object.keys(R.achar(id, { arquivo }).maquinas).sort(), ['PC', 'VPS'], id)
    assert.equal(R.achar('alfa', { arquivo }).maquinas.PC.raiz, PC[0].raiz, 'guarda o caminho do PC como veio')
    assert.equal(R.achar('delta', { arquivo }).ativo, true); assert.equal(R.achar('epsilon', { arquivo }).ativo, false)
    assert.ok(Array.isArray(r.registro?.projetos ?? r.registro), 'a mesma resposta já leva o registro de volta para o espelho do PC')
  })

  await t('mandar de novo não muda nada', async () => {
    const r = await F.enviar({ enviarPara: url, token: 'tok-teste', pacote: F.montarPacote({ maquina: { id: 'pc1', nome: 'PC' }, pastas: PC }) })
    assert.deepEqual(r.registroPastas, { novos: 0, completar: 0, iguais: 4, total: 5 })
  })
} finally {
  if (srv) srv.kill()
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`${n} verificações do registro entre máquinas, 0 falhas`)
process.exit(0)
