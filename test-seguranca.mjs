// CC-722: as travas da revisão de segurança de 30/09. Cada uma falha se a trava sumir.
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const casa = mkdtempSync(join(tmpdir(), 'seguranca-'))
process.env.HOME = casa
process.env.CC_HOME = join(casa, '.claude')
const S = await import('./src/seguranca.mjs')
const J = await import('./src/jobs.mjs')
let ok = 0; const t = (n, f) => { f(); ok += 1; console.log('  ok   ' + n) }

t('ação vinda de subdomínio ou de outro site é "de fora"; a própria página e o curl não', () => {
  assert.equal(S.pedidoDeFora({ 'sec-fetch-site': 'same-site' }), true)
  assert.equal(S.pedidoDeFora({ 'sec-fetch-site': 'cross-site' }), true)
  assert.equal(S.pedidoDeFora({ 'sec-fetch-site': 'same-origin' }), false)
  assert.equal(S.pedidoDeFora({ 'sec-fetch-site': 'none' }), false)
  assert.equal(S.pedidoDeFora({}), false, 'gancho local e curl não mandam o cabeçalho')
})
t('token: só o igual passa, e vazio nunca', () => {
  assert.equal(S.tokenIgual('abc123', 'abc123'), true)
  assert.equal(S.tokenIgual('abc124', 'abc123'), false)
  assert.equal(S.tokenIgual('abc', 'abc123'), false)
  assert.equal(S.tokenIgual('', ''), false)
  assert.equal(S.tokenIgual(undefined, ''), false)
})
t('pasta: dentro da base de projetos passa; a casa, .ssh e "base-irmã" não', () => {
  const bases = ['/home/u/projetos']; const projetos = ['/srv/outro/VPS_x']
  assert.equal(S.cwdPermitido('/home/u/projetos/VPS_a', bases, projetos), true)
  assert.equal(S.cwdPermitido('/home/u/projetos/VPS_a/apps/web', bases, projetos), true)
  assert.equal(S.cwdPermitido('/srv/outro/VPS_x/src', bases, projetos), true)
  assert.equal(S.cwdPermitido('/home/u', bases, projetos), false)
  assert.equal(S.cwdPermitido('/home/u/.ssh', bases, projetos), false)
  assert.equal(S.cwdPermitido('/home/u/projetos/../.ssh', bases, projetos), false, 'o ".." é resolvido antes')
  assert.equal(S.cwdPermitido('/home/u/projetos-falso', bases, projetos), false, 'prefixo de nome não é pasta de dentro')
  assert.equal(S.cwdPermitido('', bases, projetos), false)
})
t('link de agente: só http e https; javascript: sai', () => {
  assert.equal(J.normalizeLink('javascript:fetch("/api/subir")'), null)
  assert.equal(J.normalizeLink({ label: 'x', url: ' JavaScript:alert(1)' }), null)
  assert.equal(J.normalizeLink({ label: 'x', url: 'data:text/html,oi' }), null)
  assert.equal(J.normalizeLink('https://exemplo.com/a').url, 'https://exemplo.com/a')
  assert.equal(J.normalizeLink({ label: 'y', url: 'http://127.0.0.1:5173' }).label, 'y')
})
t('estado de agente: nome com ".." ou barra é recusado', () => {
  assert.equal(J.caminhoDoEstado('../../projetos/X'), null)
  assert.equal(J.caminhoDoEstado('a/b'), null)
  assert.equal(J.caminhoDoEstado(''), null)
})
console.log(`${ok} ok, 0 falhas (segurança)`)
