// CC-658 (S1): a escrita do arquivo de design. Casa e projetos de mentira em mkdtemp, nada de dado real.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'design-'))
process.env.CC_HOME = path.join(casa, '.claude')
const { identidade, editarCor, editarFonte, acrescentarRegra, gravarNoProjeto, regrasDoPainel } = await import('./src/design.mjs')
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }

const projeto = (nome, arquivos) => {
  const raiz = path.join(casa, 'projetos', nome)
  fs.mkdirSync(raiz, { recursive: true })
  for (const [rel, txt] of Object.entries(arquivos)) fs.writeFileSync(path.join(raiz, rel), txt)
  return raiz
}
const lerA = (raiz, rel) => fs.readFileSync(path.join(raiz, rel), 'utf8')

const ORIGINAL = [
  '---', 'colors:', '  bg: "#1c2320"', '  vez: "#e8776b"', 'typography:', '  body:', '    fontFamily: "Inter, sans-serif"',
  '  label:', '    fontFamily: "Archivo Narrow, sans-serif"', '---', 'Texto com a cor #e8776b citada.', '', '## Outra seção', '',
].join('\n')

try {
  const A = projeto('VPS_a', { 'DESIGN.md': ORIGINAL })
  const B = projeto('VPS_b', { 'DESIGN.md': 'cor #ABC aqui, #abcdef ali e #abc de novo.\n' })
  const E = projeto('VPS_e', { 'CLAUDE.md': '# e\n' })

  t('cor no cabeçalho: troca só a chave, guarda a cópia fora do projeto', () => {
    const r = editarCor(A, { nome: 'vez', para: '#112233' })
    assert.equal(r.ok, true)
    assert.equal(r.trocas, 1)
    assert.equal(r.identidade.cores.find((c) => c.nome === 'vez').hex, '#112233')
    assert.equal(identidade(A).cores.find((c) => c.nome === 'vez').hex, '#112233')
    assert.ok(lerA(A, 'DESIGN.md').includes('cor #e8776b citada'), 'o corpo não pode mudar')
    assert.equal(fs.readFileSync(r.copia, 'utf8'), ORIGINAL)
    assert.ok(r.copia.startsWith(casa) && !r.copia.startsWith(A))
  })

  t('recusas: cor inválida e nome inexistente deixam o arquivo igual', () => {
    const antes = fs.readFileSync(path.join(A, 'DESIGN.md'))
    assert.equal(editarCor(A, { nome: 'vez', para: 'azul' }).ok, false)
    assert.equal(editarCor(A, { nome: 'nao-existe', para: '#000000' }).ok, false)
    assert.ok(antes.equals(fs.readFileSync(path.join(A, 'DESIGN.md'))))
  })

  t('cor sem cabeçalho: troca todas as ocorrências, sem pegar a mais longa', () => {
    const r = editarCor(B, { de: '#abc', para: '#00FF00' })
    assert.equal(r.trocas, 2)
    assert.equal(lerA(B, 'DESIGN.md'), 'cor #00ff00 aqui, #abcdef ali e #00ff00 de novo.\n')
  })

  t('fonte: troca só a pedida; sem cabeçalho recusa', () => {
    const r = editarFonte(A, { de: 'Inter', para: 'Roboto' })
    assert.equal(r.ok, true)
    const txt = lerA(A, 'DESIGN.md')
    assert.ok(txt.includes('fontFamily: "Roboto, sans-serif"'))
    assert.ok(txt.includes('fontFamily: "Archivo Narrow, sans-serif"'))
    assert.equal(editarFonte(B, { de: 'Inter', para: 'Roboto' }).ok, false)
  })

  t('regra nova: cria a seção uma vez, acumula e recusa curta', () => {
    const r = acrescentarRegra(A, 'botão principal sempre verde ' + String.fromCharCode(0x2014) + ' nunca vermelho')
    assert.equal(r.ok, true)
    const txt = lerA(A, 'DESIGN.md')
    assert.equal(txt.split('## Regras do painel').length, 2)
    assert.ok(txt.includes('- botão principal sempre verde, nunca vermelho (pelo painel, '))
    // o hífen comum fica: mini-jogo continua mini-jogo
    acrescentarRegra(A, 'o mini-jogo usa a mesma paleta')
    assert.ok(lerA(A, 'DESIGN.md').includes('- o mini-jogo usa a mesma paleta (pelo painel, '))
    assert.ok(!lerA(A, 'DESIGN.md').includes('mini, jogo'))
    assert.match(txt, /\(pelo painel, \d\d\/\d\d\/\d{4}\)/)
    acrescentarRegra(A, 'segunda regra')
    assert.equal(identidade(A).regras.length, 3)
    assert.equal(acrescentarRegra(A, 'ab').ok, false)
  })

  t('regra no meio do arquivo: entra depois da última linha da seção', () => {
    const C = projeto('VPS_c', { 'DESIGN.md': '## Regras do painel\n\n- antiga\n\n## Depois\n' })
    acrescentarRegra(C, 'nova regra')
    const ls = lerA(C, 'DESIGN.md').split('\n')
    const a = ls.indexOf('- antiga')
    const n = ls.findIndex((l) => l.startsWith('- nova regra'))
    const d = ls.indexOf('## Depois')
    assert.ok(a >= 0 && n === a + 1 && d > n, ls.join('|'))
    assert.deepEqual(regrasDoPainel(lerA(C, 'DESIGN.md')).length, 2)
  })

  t('projeto sem arquivo: cor recusa, regra cria o DESIGN.md sem cópia', () => {
    assert.equal(editarCor(E, { nome: 'x', para: '#000000' }).ok, false)
    const r = acrescentarRegra(E, 'primeira regra')
    assert.equal(r.ok, true)
    assert.equal(r.copia, null)
    assert.ok(fs.existsSync(path.join(E, 'DESIGN.md')))
  })

  t('CRLF continua CRLF', () => {
    const D = projeto('VPS_d', { 'DESIGN.md': ORIGINAL.replace(/\n/g, '\r\n') })
    assert.equal(editarCor(D, { nome: 'bg', para: '#000000' }).ok, true)
    assert.ok(!/[^\r]\n/.test(lerA(D, 'DESIGN.md')))
  })

  t('caminho fora do projeto lança', () => {
    assert.throws(() => gravarNoProjeto(A, '../fora.md', 'x'))
    assert.throws(() => gravarNoProjeto(A, '/etc/x', 'x'))
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log('test-design: ok')
