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

/* CC-541: criar o repositório com um `gh` de mentira no PATH, nos três estados
   que importam: sem o programa, sem login, e funcionando. Nada sai desta máquina. */
{
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const { criarRepo } = await import('./src/github.mjs')
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-falso-'))
  const PATH0 = process.env.PATH
  const ghFalso = (corpo) => { fs.writeFileSync(path.join(pasta, 'gh'), '#!/bin/sh\n' + corpo + '\n', { mode: 0o755 }) }
  try {
    process.env.PATH = pasta // só a pasta do falso: sem gh nenhum dentro dela ainda
    let r = await criarRepo('x'); assert.equal(r.ok, false); assert.match(r.erro, /não está instalado/); ok++; console.log('  ok   sem o gh instalado, diz isso em português')
    ghFalso('[ "$1 $2" = "auth status" ] && { echo "You are not logged into any GitHub hosts" >&2; exit 1; }')
    process.env.PATH = pasta + ':' + PATH0
    r = await criarRepo('x'); assert.equal(r.ok, false); assert.match(r.erro, /não está autenticado/); ok++; console.log('  ok   gh sem login: avisa que não está autenticado, antes de tentar criar')
    ghFalso('[ "$1 $2" = "auth status" ] && exit 0\n[ "$1 $2" = "repo create" ] && { echo "https://github.com/felipecarzo/$3"; exit 0; }')
    r = await criarRepo('projeto-teste'); assert.deepEqual(r, { ok: true, repo: 'felipecarzo/projeto-teste', url: 'https://github.com/felipecarzo/projeto-teste' }); ok++; console.log('  ok   gh logado: cria e devolve o repositório')
  } finally { process.env.PATH = PATH0; fs.rmSync(pasta, { recursive: true, force: true }) }
}

console.log(`\n  ${ok} verificação(ões) do módulo GitHub (CC-541) ok\n`)
