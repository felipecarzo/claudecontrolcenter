// CC-1107 peça A: o resumo da federação leva commit, arquivos soltos e "painel com código velho" de cada máquina
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { codigoDaqui, recortarCodigo } from './src/codigoDaMaquina.mjs'
import { montarPacote, validarPacote } from './src/federacao.mjs'

// recorte de quem recebe pela rede
assert.equal(recortarCodigo(null), null, 'sem campo: null, não zero')
assert.equal(recortarCodigo([1]), null, 'lista não é retrato')
const r = recortarCodigo({ commit: '6a2efdf; rm -rf', soltos: 12.9, rodando: 'abc1234', painelVelho: true, em: 5 })
assert.equal(r.commit, '6a2efdfrm-rf','texto vira só letras, números e . _ -')
assert.equal(r.soltos, 12)
assert.equal(r.painelVelho, true)
assert.equal(recortarCodigo({ soltos: 'muitos', painelVelho: 'sim' }).soltos, null, 'soltos não numérico vira null')
assert.equal(recortarCodigo({ painelVelho: 'sim' }).painelVelho, null, 'painelVelho só aceita booleano (null não vira false)')

// viaja no pacote e sobrevive à validação; pacote de versão velha (sem o campo) continua aceito
const maq = { id: 'abc12345', nome: 'PC' }
const comCodigo = montarPacote({ maquina: maq, codigo: { commit: 'aaa1111', soltos: 3, rodando: 'aaa1111', painelVelho: false, em: 1 } })
assert.equal(validarPacote(JSON.parse(JSON.stringify(comCodigo))).pacote.codigo.soltos, 3)
const semCodigo = montarPacote({ maquina: maq })
assert.equal(validarPacote(JSON.parse(JSON.stringify(semCodigo))).pacote.codigo, null, 'versão velha: campo ausente é null')

// medida de verdade, num repositório de mentira: commit, solto e painel velho
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-codigo-'))
const g = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: 'ignore' })
g('init', '-q')
fs.writeFileSync(path.join(dir, 'a.txt'), '1')
g('add', '.'); g('commit', '-qm', 'um')
const primeiro = await codigoDaqui({ raiz: dir, agora: 1_000_000 })
assert.match(primeiro.commit, /^[0-9a-f]{7,}$/)
assert.equal(primeiro.soltos, 0)
assert.equal(primeiro.painelVelho, false, 'recém subido: rodando = commit')
fs.writeFileSync(path.join(dir, 'b.txt'), '2')
g('add', '.'); g('commit', '-qm', 'dois')
fs.writeFileSync(path.join(dir, 'c.txt'), '3')
const depois = await codigoDaqui({ raiz: dir, agora: 1_000_000 + 60_000 })
assert.equal(depois.rodando, primeiro.commit, 'o painel continua com o commit que carregou')
assert.notEqual(depois.commit, primeiro.commit)
assert.equal(depois.painelVelho, true, 'commit andou e o painel não: painel velho')
assert.equal(depois.soltos, 1)
const igual = await codigoDaqui({ raiz: dir, agora: 1_000_000 + 61_000 })
assert.equal(igual.em, depois.em, 'dentro de 30 s vem do cache, sem rodar git de novo')
fs.rmSync(dir, { recursive: true, force: true })

// pasta sem git: não sabe dizer, e não finge
const sem = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-semgit-'))
const nada = await codigoDaqui({ raiz: sem, agora: 9_000_000 })
assert.equal(nada.commit, null)
assert.equal(nada.soltos, null)
assert.equal(nada.painelVelho, null)
fs.rmSync(sem, { recursive: true, force: true })
console.log('test-codigo-maquina: ok')
