// Teste do módulo GitHub (CC-541). Só a parte PURA (parsing de texto): nunca
// chama `gh` de verdade, nunca cria repositório real na conta do Felipe.
import assert from 'node:assert/strict'
import { repoDeUrl } from './src/github.mjs'

let ok = 0
function testar(nome, fn) {
  try {
    fn()
    console.log(`  ok   ${nome}`)
    ok++
  } catch (e) {
    console.log(`  FALHA ${nome}\n    ${e.message}`)
    process.exitCode = 1
  }
}

testar('tira owner/repo da URL que o gh imprime na saída', () => {
  assert.equal(repoDeUrl('✓ Created repository felipecarzo/kamilleLeal on GitHub\n  https://github.com/felipecarzo/kamilleLeal\n'), 'felipecarzo/kamilleLeal')
})

testar('tira a barra final quando vem', () => {
  assert.equal(repoDeUrl('https://github.com/felipecarzo/kamilleLeal/'), 'felipecarzo/kamilleLeal')
})

testar('tira o .git quando vem', () => {
  assert.equal(repoDeUrl('https://github.com/felipecarzo/kamilleLeal.git'), 'felipecarzo/kamilleLeal')
})

testar('saída sem URL nenhuma devolve null, nunca lança', () => {
  assert.equal(repoDeUrl('deu erro, sem link nenhum'), null)
  assert.equal(repoDeUrl(''), null)
  assert.equal(repoDeUrl(null), null)
})

testar('pega a URL mesmo cercada de mais texto na mesma linha', () => {
  assert.equal(repoDeUrl('algo antes https://github.com/felipecarzo/x algo depois'), 'felipecarzo/x')
})

console.log(`\n  ${ok} verificação(ões) do módulo GitHub (CC-541) ok\n`)
