// CC-666: o Armário (gavetas, arquivos, documentação), numa casa temporária.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const casa = mkdtempSync(join(tmpdir(), 'armario-'))
process.env.HOME = casa
process.env.CC_HOME = join(casa, '.claude')
const A = await import('./src/armario.mjs')
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
t('documentação: docs até dois níveis e README, sem diário nem legado', () => {
  const raiz = join(casa, 'proj')
  for (const d of ['docs/produto', 'docs/diario', 'docs/legacy']) mkdirSync(join(raiz, d), { recursive: true })
  for (const f of ['README.md', 'docs/ROADMAP.md', 'docs/produto/VISAO.md', 'docs/diario/2026-09-28.md', 'docs/legacy/velho.md']) writeFileSync(join(raiz, f), '# x')
  assert.deepEqual(A.docsDe(raiz).sort(), ['README.md', 'docs/ROADMAP.md', 'docs/produto/VISAO.md'])
})
console.log(`${ok} ok, 0 falhas (armário)`)
