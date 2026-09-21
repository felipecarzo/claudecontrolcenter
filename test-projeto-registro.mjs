// Teste do registro central de projeto (CC-540). Arquivo isolado por teste,
// nunca toca `~/.claude/cockpit-projetos.json` de verdade.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as R from './src/projetoRegistro.mjs'

let ok = 0
function testar(nome, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-registro-'))
  const arquivo = path.join(dir, 'cockpit-projetos.json')
  try {
    fn(arquivo)
    console.log(`  ok   ${nome}`)
    ok++
  } catch (e) {
    console.log(`  FALHA ${nome}\n    ${e.message}`)
    process.exitCode = 1
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

testar('declarar sem pasta cria entrada com estado "declarado"', (arquivo) => {
  const r = R.declarar({ nome: 'kamilleLeal', criadoPor: 'felipe' }, { arquivo })
  assert.equal(r.ok, true)
  assert.equal(r.projeto.estado, 'declarado')
  assert.equal(r.projeto.id, 'kamilleleal')
  assert.deepEqual(r.projeto.maquinas, {})
  assert.equal(r.projeto.github, null)
})

testar('nome vira id: minúsculo, sem acento tratado por quem chama, hífen no lugar do resto', (arquivo) => {
  const r = R.declarar({ nome: 'Ecommerce Apps!!' }, { arquivo })
  assert.equal(r.projeto.id, 'ecommerce-apps')
})

testar('declarar sem nome é recusado', (arquivo) => {
  const r = R.declarar({ nome: '' }, { arquivo })
  assert.equal(r.ok, false)
  assert.match(r.erro, /sem nome/)
})

testar('nome repetido (mesmo id) é recusado, não sobrescreve', (arquivo) => {
  R.declarar({ nome: 'sumauma' }, { arquivo })
  const r2 = R.declarar({ nome: 'sumauma' }, { arquivo })
  assert.equal(r2.ok, false)
  assert.match(r2.erro, /já existe/)
  assert.equal(R.listar({ arquivo }).length, 1)
})

testar('listar devolve o que foi declarado, achar por id acha um só', (arquivo) => {
  R.declarar({ nome: 'projetoA' }, { arquivo })
  R.declarar({ nome: 'projetoB' }, { arquivo })
  assert.equal(R.listar({ arquivo }).length, 2)
  assert.equal(R.achar('projetob', { arquivo }).nome, 'projetoB')
  assert.equal(R.achar('nao-existe', { arquivo }), null)
})

testar('definirGithub grava o repo na entrada existente', (arquivo) => {
  R.declarar({ nome: 'reunion' }, { arquivo })
  const r = R.definirGithub('reunion', { repo: 'felipecarzo/reunion' }, { arquivo })
  assert.equal(r.ok, true)
  assert.equal(r.projeto.github.repo, 'felipecarzo/reunion')
})

testar('definirGithub em projeto desconhecido é recusado', (arquivo) => {
  const r = R.definirGithub('nao-existe', { repo: 'a/b' }, { arquivo })
  assert.equal(r.ok, false)
})

testar('provisionar marca a máquina e sobe o estado pra "ativo"', (arquivo) => {
  R.declarar({ nome: 'mnzs' }, { arquivo })
  const r = R.provisionarNestaMaquina('mnzs', { maquina: 'ALIENWARE-LIPE', raiz: 'D:/x/mnzs' }, { arquivo })
  assert.equal(r.ok, true)
  assert.equal(r.projeto.estado, 'ativo')
  assert.equal(r.projeto.maquinas['ALIENWARE-LIPE'].provisionado, true)
  assert.equal(r.projeto.maquinas['ALIENWARE-LIPE'].raiz, 'D:/x/mnzs')
})

testar('provisionar sem raiz ou sem máquina é recusado, nunca grava parcial', (arquivo) => {
  R.declarar({ nome: 'geolev4' }, { arquivo })
  const r1 = R.provisionarNestaMaquina('geolev4', { maquina: 'vps' }, { arquivo })
  assert.equal(r1.ok, false)
  const r2 = R.provisionarNestaMaquina('geolev4', { raiz: '/x' }, { arquivo })
  assert.equal(r2.ok, false)
  assert.deepEqual(R.achar('geolev4', { arquivo }).maquinas, {})
})

testar('provisionar em projeto desconhecido é recusado', (arquivo) => {
  const r = R.provisionarNestaMaquina('fantasma', { maquina: 'vps', raiz: '/x' }, { arquivo })
  assert.equal(r.ok, false)
})

testar('gravação faz backup .bak da versão anterior', (arquivo) => {
  R.declarar({ nome: 'um' }, { arquivo })
  R.declarar({ nome: 'dois' }, { arquivo })
  assert.equal(fs.existsSync(`${arquivo}.bak`), true)
  const bak = JSON.parse(fs.readFileSync(`${arquivo}.bak`, 'utf8'))
  assert.equal(bak.projetos.length, 1) // a versão ANTES do segundo declarar
})

testar('arquivo ausente ou corrompido devolve lista vazia, nunca lança', (arquivo) => {
  assert.deepEqual(R.listar({ arquivo }), [])
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(arquivo, '{ isto não é json')
  assert.deepEqual(R.listar({ arquivo }), [])
})

testar('espelhar grava a lista recebida, lerEspelho devolve de volta', (arquivo) => {
  const espelho = arquivo.replace('cockpit-projetos.json', 'cockpit-projetos-espelho.json')
  const r = R.espelhar([{ id: 'x', nome: 'X' }], { arquivo: espelho })
  assert.equal(r.ok, true)
  assert.equal(r.total, 1)
  assert.equal(R.lerEspelho({ arquivo: espelho })[0].id, 'x')
})

testar('espelhar recusa quando não vem lista', (arquivo) => {
  const espelho = arquivo.replace('cockpit-projetos.json', 'cockpit-projetos-espelho.json')
  const r = R.espelhar(null, { arquivo: espelho })
  assert.equal(r.ok, false)
})

console.log(`\n  ${ok} verificação(ões) do registro central de projeto (CC-540) ok\n`)
