// CC-884: commit e push do cartão do projeto, contra um repositório e um remoto de mentira
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { mudancas, salvar } from './src/salvarGit.mjs'
const t = async (nome, fn) => { await fn(); console.log('  ok   ' + nome) }
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'salvar-git-'))
const g = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' }).trim()
const remoto = path.join(base, 'remoto.git'); execFileSync('git', ['init', '--bare', '-q', remoto])
const proj = path.join(base, 'proj'); fs.mkdirSync(proj)
g(proj, 'init', '-q', '-b', 'main'); g(proj, 'config', 'user.email', 't@t'); g(proj, 'config', 'user.name', 't')
fs.writeFileSync(path.join(proj, 'a.txt'), '1'); g(proj, 'add', '-A'); g(proj, 'commit', '-qm', 'inicio')

await t('sem remoto origin: faz o commit e diz que pulou o push', async () => {
  fs.writeFileSync(path.join(proj, 'b.txt'), '2')
  const m = await mudancas(proj); assert.equal(m.arquivos.length, 1); assert.equal(m.temRemoto, false)
  const r = await salvar(proj, 'feat: arquivo b'); assert.equal(r.ok, true); assert.equal(r.empurrou, false)
  assert.equal(g(proj, 'status', '--porcelain'), '')
})
await t('mensagem curta demais é recusada e nada é commitado', async () => {
  fs.writeFileSync(path.join(proj, 'c.txt'), '3')
  const r = await salvar(proj, 'x'); assert.equal(r.ok, false); assert.match(r.erro, /o que mudou/)
  assert.match(g(proj, 'status', '--porcelain'), /c\.txt/)
})
await t('com remoto sem upstream: commit, push -u, e o remoto recebe o ramo; coautoria é removida', async () => {
  g(proj, 'remote', 'add', 'origin', remoto)
  const r = await salvar(proj, 'fix: arquivo c\n\nCo-Authored-By: Alguem <a@a>')
  assert.equal(r.ok, true); assert.equal(r.empurrou, true)
  assert.equal(g(remoto, 'rev-parse', 'main'), g(proj, 'rev-parse', 'HEAD'))
  assert.ok(!/co-authored/i.test(g(proj, 'log', '-1', '--format=%B')))
})
await t('sem mudança e tudo empurrado: recusa em vez de fingir', async () => {
  const r = await salvar(proj, 'nada'); assert.equal(r.ok, false); assert.match(r.erro, /nada para salvar/)
})
await t('só push: commit já feito e ainda não empurrado sobe sem pedir mensagem', async () => {
  fs.writeFileSync(path.join(proj, 'd.txt'), '4'); g(proj, 'add', '-A'); g(proj, 'commit', '-qm', 'local')
  assert.equal((await mudancas(proj)).porEmpurrar, 1)
  const r = await salvar(proj, ''); assert.equal(r.ok, true); assert.equal(g(remoto, 'rev-parse', 'main'), g(proj, 'rev-parse', 'HEAD'))
})
await t('pasta que não é repositório e push que falha são ditos com o passo', async () => {
  assert.equal((await mudancas(base)).ok, false)
  g(proj, 'remote', 'set-url', 'origin', path.join(base, 'nao-existe.git'))
  fs.writeFileSync(path.join(proj, 'e.txt'), '5')
  const r = await salvar(proj, 'feat: arquivo e'); assert.equal(r.ok, false); assert.match(r.erro, /^push falhou/); assert.equal(r.commitFeito, true)
})
fs.rmSync(base, { recursive: true, force: true })
