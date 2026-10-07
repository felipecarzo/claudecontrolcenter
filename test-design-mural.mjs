// CC-656: o mural de referências dentro do projeto, numa casa e num projeto de mentira em tmp.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, readdirSync, existsSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const casa = mkdtempSync(join(tmpdir(), 'mural-'))
process.env.HOME = casa
process.env.CC_HOME = join(casa, '.claude')
const raiz = join(casa, 'VPS_prova'); mkdirSync(raiz, { recursive: true })
const M = await import('./src/designMural.mjs')
let ok = 0; const t = (n, f) => { f(); ok += 1; console.log('  ok   ' + n) }
const linhas = () => readFileSync(join(raiz, 'docs/design/mural.jsonl'), 'utf8').split('\n').filter(Boolean).length
// cabeçalhos reais de cada formato, com um corpo curto atrás
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('x')]).toString('base64')
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString('base64')
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBPVP8 ')]).toString('base64')

t('recado com vírgula e com travessão vira texto limpo', () => {
  const r = M.acrescentar(raiz, { texto: 'quero assim, mais ar' + String.fromCharCode(0x2014) + 'menos borda' })
  assert.equal(r.ok, true)
  assert.equal(r.item.texto, 'quero assim, mais ar, menos borda')
  assert.ok(!new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(r.item.texto))
  assert.equal(M.acrescentar(raiz, { texto: 'sem-hifen quebrado' }).item.texto, 'sem-hifen quebrado', 'hífen comum não muda')
})
t('link: ftp recusado, https aceito', () => {
  assert.equal(M.acrescentar(raiz, { url: 'ftp://x' }).ok, false)
  assert.equal(M.acrescentar(raiz, { url: 'javascript:alert(1)' }).ok, false)
  assert.equal(M.acrescentar(raiz, { url: 'https://exemplo.com' }).ok, true)
})
t('png, jpg e webp pelos bytes criam arquivo dentro do mural', () => {
  const p = M.acrescentar(raiz, { nome: 'Meu Print.png', mime: 'image/png', dados: 'data:image/png;base64,' + PNG })
  assert.equal(p.ok, true); assert.ok(p.item.img.startsWith('docs/design/mural/m'))
  assert.ok(existsSync(join(raiz, p.item.img)))
  assert.ok(M.acrescentar(raiz, { nome: 'a', mime: 'image/jpeg', dados: JPG }).item.img.endsWith('.jpg'))
  assert.ok(M.acrescentar(raiz, { nome: 'b', mime: 'image/webp', dados: WEBP }).item.img.endsWith('.webp'))
})
t('tipo vem dos bytes: gif, html e svg com nome de imagem são recusados, mime que mente também', () => {
  assert.equal(M.acrescentar(raiz, { mime: 'image/gif', dados: PNG }).ok, false)
  const html = Buffer.from('<script>alert(1)</script>').toString('base64')
  assert.equal(M.acrescentar(raiz, { nome: 'x.png', mime: 'image/png', dados: html }).ok, false)
  const svg = Buffer.from('<svg onload="alert(1)"/>').toString('base64')
  assert.equal(M.acrescentar(raiz, { nome: 'x.png', mime: 'image/png', dados: svg }).ok, false)
  assert.equal(M.acrescentar(raiz, { nome: 'x.png', mime: 'image/png', dados: JPG }).ok, false, 'jpg declarado como png')
})
t('imagem vazia, grande demais e item vazio são recusados, sem deixar arquivo', () => {
  const antes = readdirSync(join(raiz, 'docs/design/mural')).length
  assert.equal(M.acrescentar(raiz, { mime: 'image/png', dados: '=' }).ok, false)
  const grande = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(M.LIMITE_IMAGEM)])
  assert.equal(M.acrescentar(raiz, { mime: 'image/png', dados: grande.toString('base64') }).ok, false)
  assert.equal(M.acrescentar(raiz, { mime: 'image/png', dados: Buffer.alloc(M.LIMITE_IMAGEM + 1).toString('base64') }).ok, false)
  assert.equal(M.acrescentar(raiz, {}).ok, false)
  assert.equal(readdirSync(join(raiz, 'docs/design/mural')).length, antes)
})
t('lerMural devolve o mais novo primeiro', () => {
  const a = M.acrescentar(raiz, { texto: 'primeiro da prova' }).item
  const b = M.acrescentar(raiz, { texto: 'segundo da prova' }).item
  const l = M.lerMural(raiz)
  assert.equal(l[0].id, b.id); assert.ok(l.findIndex((i) => i.id === a.id) > 0)
})
t('apagar tira da leitura, o jsonl só cresce, e item que não existe dá ok false', () => {
  const x = M.acrescentar(raiz, { texto: 'vai sair' }).item
  const n = linhas()
  assert.equal(M.apagar(raiz, x.id).ok, true)
  assert.ok(!M.lerMural(raiz).some((i) => i.id === x.id))
  assert.equal(linhas(), n + 1)
  assert.equal(M.apagar(raiz, 'nao-existe').ok, false)
  assert.equal(linhas(), n + 1)
})
t('caminhoDaImagem: o de verdade passa; .., absoluto, fora do mural e symlink para fora não', () => {
  const img = M.acrescentar(raiz, { nome: 'c', mime: 'image/png', dados: PNG }).item.img
  assert.ok(M.caminhoDaImagem(raiz, img))
  assert.equal(M.caminhoDaImagem(raiz, 'docs/design/mural/../x.png'), null)
  assert.equal(M.caminhoDaImagem(raiz, '/etc/hostname'), null)
  assert.equal(M.caminhoDaImagem(raiz, 'docs/design/mural.jsonl'), null)
  assert.equal(M.caminhoDaImagem(raiz, 'docs/design/mural/nao-existe.png'), null)
  symlinkSync('/etc/hostname', join(raiz, 'docs/design/mural/link.png'))
  assert.equal(M.caminhoDaImagem(raiz, 'docs/design/mural/link.png'), null)
})
t('paraOAgente traz o recado, o link e a imagem', () => {
  const s = M.paraOAgente(raiz).join('\n')
  assert.ok(s.includes('segundo da prova')); assert.ok(s.includes('imagem em docs/design/mural/'))
  assert.ok(M.paraOAgente(raiz, 2).length <= 2)
})
t('linha ruim no jsonl é ignorada', () => {
  appendFileSync(join(raiz, 'docs/design/mural.jsonl'), '{isto nao e json\n')
  const r = M.acrescentar(raiz, { texto: 'depois da linha ruim' })
  assert.equal(M.lerMural(raiz)[0].id, r.item.id)
})

console.log(ok + ' testes do mural passaram')
