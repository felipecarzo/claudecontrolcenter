// CC-666: o Armário (gavetas, arquivos, documentação), numa casa temporária.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const casa = mkdtempSync(join(tmpdir(), 'armario-'))
process.env.HOME = casa
process.env.CC_HOME = join(casa, '.claude')
const A = await import('./src/armario.mjs')
const N = await import('./src/notes.mjs')
let ok = 0; const t = (n, f) => { f(); ok += 1; console.log('  ok   ' + n) }

t('gaveta nova, e nome repetido (ou "Notas") recusado', () => {
  const g = A.criarGaveta('Contratos'); assert.equal(g.ok, true)
  assert.equal(A.criarGaveta('contratos').ok, false)
  assert.equal(A.criarGaveta('Notas').ok, false)
})
t('arquivo sobe, tipo perigoso não, e gaveta com coisa dentro não se apaga', () => {
  const g = A.gavetas()[0]
  const r = A.subirArquivo({ gaveta: g.id, nome: 'x.png', mime: 'image/png', dados: Buffer.from('oi').toString('base64') })
  assert.equal(r.ok, true)
  assert.equal(A.subirArquivo({ gaveta: g.id, nome: 'x.exe', mime: 'application/x-msdownload', dados: 'AAAA' }).ok, false)
  assert.equal(A.apagarGaveta(g.id).ok, false, 'apagar não leva nada junto')
  assert.ok(A.arquivoParaServir(r.arquivo.id))
  assert.equal(A.apagarArquivo(r.arquivo.id).ok, true)
  assert.equal(A.apagarGaveta(g.id).ok, true)
})
/* CC-709, decisão dele em 29/09: as abas do Armário são as pastas do padrão, e
   diário e legado são duas delas. Antes ficavam de fora. */
t('documentação: docs até dois níveis e README, com diário e legado', () => {
  const raiz = join(casa, 'proj')
  for (const d of ['docs/produto', 'docs/diario', 'docs/legacy']) mkdirSync(join(raiz, d), { recursive: true })
  for (const f of ['README.md', 'docs/ROADMAP.md', 'docs/produto/VISAO.md', 'docs/diario/2026-09-28.md', 'docs/legacy/velho.md']) writeFileSync(join(raiz, f), '# x')
  assert.deepEqual(A.docsDe(raiz).sort(), ['README.md', 'docs/ROADMAP.md', 'docs/diario/2026-09-28.md', 'docs/legacy/velho.md', 'docs/produto/VISAO.md'])
})
t('projeto do arquivo: projeto desconhecido recusado, vazio tira do projeto', () => {
  const r = A.subirArquivo({ gaveta: 'notas', nome: 'y.png', mime: 'image/png', dados: Buffer.from('oi').toString('base64'), projeto: '/nao/existe' })
  assert.equal(r.ok, false, 'projeto que a máquina não conhece não entra')
  const s = A.subirArquivo({ gaveta: 'notas', nome: 'y.png', mime: 'image/png', dados: Buffer.from('oi').toString('base64') })
  assert.equal(s.ok, true); assert.equal(s.arquivo.projeto, null)
  assert.equal(A.projetoDoArquivo(s.arquivo.id, '/nao/existe').ok, false)
  assert.equal(A.projetoDoArquivo(s.arquivo.id, '').ok, true)
  assert.equal(A.projetoDoArquivo('nao-existe', '').ok, false)
  A.apagarArquivo(s.arquivo.id)
})
t('a nota guarda o projeto dela ao gravar', () => {
  const [n] = N.writeNotes([{ title: 'x', text: 'y', projeto: '/home/p/VPS_x' }])
  assert.equal(n.projeto, '/home/p/VPS_x')
})
console.log(`${ok} ok, 0 falhas (armário)`)
