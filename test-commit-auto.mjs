/**
 * A autorização contínua de commit por sessão (CC-359-adjacente, atrito de 26/08).
 *
 * Prova o marcador: ligado para uma sessão libera aquela sessão, e ninguém mais;
 * desligado, ninguém. É o que faz o "salva cada item ao fechar" dele valer sem o
 * hook cobrar a cada commit.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { liberadoPara, lerLiberado, MARCADOR } from './hooks/commit-auto.mjs'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

const tinha = fs.existsSync(MARCADOR)
const backup = tinha ? fs.readFileSync(MARCADOR, 'utf8') : null

// grava o marcador pelo módulo (sem shell), como o `on` faria
/* Achado em 26/08, primeira vez rodando no PC: a troca por regex
   (`/\/[^/]+$/`) só reconhece `/`, e o Windows separa pasta com `\`. Sem
   bater, `.replace` devolve o CAMINHO INTEIRO, e `mkdirSync` cria uma PASTA
   com o nome do arquivo (`commit-liberado.json/`) em vez da pasta-mãe. O
   `writeFileSync` seguinte falha com EISDIR, e o `hooks/commit-auto.mjs`
   real nunca teve esse bug: ele já usa `path.dirname`. */
function ligar(sessao) {
  fs.mkdirSync(path.dirname(MARCADOR), { recursive: true })
  fs.writeFileSync(MARCADOR, JSON.stringify({ ligado: true, sessao, desde: Date.now() }))
}
function desligar() { try { fs.rmSync(MARCADOR, { force: true }) } catch { /* nada */ } }

try {
  // 1. desligado: ninguém é liberado
  desligar()
  try {
    assert.equal(liberadoPara('aaaa1111'), false)
    assert.equal(lerLiberado(), null)
    ok('desligado, nenhuma sessão é liberada')
  } catch (e) { erro('desligado', e) }

  // 2. ligado para uma sessão: só ela passa
  try {
    ligar('aaaa1111-xxxx')
    assert.equal(liberadoPara('aaaa1111-xxxx'), true, 'a sessão que ligou é liberada')
    assert.equal(liberadoPara('bbbb2222-yyyy'), false, 'outra sessão NÃO é liberada')
    assert.equal(liberadoPara(''), false, 'sem id, não libera')
    ok('ligado libera só a sessão que ligou, nunca outra')
  } catch (e) { erro('ligado por sessão', e) }

  // 3. casa pelos 8 primeiros do id (curto e longo são a mesma sessão)
  try {
    ligar('cccc3333-4444-5555')
    assert.equal(liberadoPara('cccc3333'), true, 'o id curto casa com o longo')
    ok('id curto e longo da mesma sessão são tratados como a mesma')
  } catch (e) { erro('curto casa longo', e) }
} finally {
  if (backup !== null) fs.writeFileSync(MARCADOR, backup)
  else desligar()
}

if (falhou) process.exit(1)
console.log('test-commit-auto: ok')
