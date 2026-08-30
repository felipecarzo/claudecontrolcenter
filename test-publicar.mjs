/**
 * CC-439: a cópia que roda, separada da que se edita.
 *
 * ⚠️ **Tudo em pasta temporária, com `CC_INSTALADO`.** Sem isso este teste
 * publicaria na instalação de verdade dele, e é o mesmo erro do bloco de notas
 * que é candidato à causa do apagamento de 2026-08-09.
 *
 * O gate de dentro do `publicar()` fica DESLIGADO aqui (`gate: false`): ligado,
 * cada caso rodaria o `test.mjs` inteiro por dentro, e o gate chamaria a si
 * mesmo em laço.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'publicar-'))
process.env.CC_INSTALADO = path.join(casa, 'instalado')

const P = await import('./src/publicar.mjs')

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

/** Um cockpit de mentira, com o mínimo que `publicar` reconhece. */
function repoFalso(nome, versao, marca) {
  const dir = path.join(casa, nome)
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'hooks'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'node_modules', 'algo'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'cc.mjs'), `// ${marca}\n`)
  fs.writeFileSync(path.join(dir, 'src', 'jobs.mjs'), `export const marca = '${marca}'\n`)
  fs.writeFileSync(path.join(dir, 'hooks', 'algum.mjs'), `// ${marca}\n`)
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', version: versao }))
  fs.writeFileSync(path.join(dir, 'docs', 'ROADMAP.md'), '# nao e produto\n')
  fs.writeFileSync(path.join(dir, 'node_modules', 'algo', 'index.js'), 'nao copiar\n')
  fs.writeFileSync(path.join(dir, 'test.mjs'), 'nao e produto\n')
  return dir
}

const marcaDe = (dir) => fs.readFileSync(path.join(dir, 'cc.mjs'), 'utf8').trim()

try {
  const inst = process.env.CC_INSTALADO
  assert.equal(P.pastaInstalada(), inst, 'CC_INSTALADO tem que redirecionar, senão o teste escreve na dele')
  ok('o teste publica numa pasta temporária, nunca na instalação de verdade')

  try {
    assert.equal(P.versaoInstalada(inst), null, 'sem nada instalado, é null e não objeto vazio')
    const s0 = P.situacao({ repo: repoFalso('obras-v1', '1.0.0', 'v1'), destino: inst })
    assert.equal(s0.publicada, false)
    assert.equal(s0.temAnterior, false)
    ok('antes da primeira publicação, o retrato diz que não há nada instalado')
  } catch (e) { erro('estado inicial', e) }

  const v1 = repoFalso('obras-v1', '1.0.0', 'v1')
  try {
    const r = P.publicar({ repo: v1, destino: inst, gate: false })
    assert.equal(r.ok, true, r.erro)
    assert.equal(marcaDe(inst), '// v1')
    assert.equal(P.versaoInstalada(inst).versao, '1.0.0')
    ok('publicar copia o produto e carimba a versão')
  } catch (e) { erro('primeira publicação', e) }

  try {
    assert.ok(fs.existsSync(path.join(inst, 'hooks', 'algum.mjs')), 'hooks entra: o settings.json aponta pra ele')
    assert.ok(!fs.existsSync(path.join(inst, 'docs')), 'docs não é produto')
    assert.ok(!fs.existsSync(path.join(inst, 'test.mjs')), 'teste não é produto')
    assert.ok(!fs.existsSync(path.join(inst, 'node_modules')), 'node_modules nunca')
    ok('só o que é produto atravessa: sem docs, sem teste, sem node_modules')
  } catch (e) { erro('o que é produto', e) }

  /* O ponto inteiro do módulo: a pasta de obras muda e a instalada NÃO. É o que
     hoje não acontece, porque o comando global é um atalho para o repositório. */
  try {
    fs.writeFileSync(path.join(v1, 'cc.mjs'), '// quebrei tudo\n')
    assert.equal(marcaDe(inst), '// v1', 'editar a pasta de obras não pode mexer na que roda')
    ok('salvar uma linha errada nas obras não derruba a versão que ele usa')
  } catch (e) { erro('isolamento', e) }

  const v2 = repoFalso('obras-v2', '2.0.0', 'v2')
  try {
    const r = P.publicar({ repo: v2, destino: inst, gate: false })
    assert.equal(r.ok, true, r.erro)
    assert.equal(marcaDe(inst), '// v2')
    assert.equal(P.versaoInstalada(inst).versao, '2.0.0')
    assert.equal(marcaDe(path.join(inst, 'anterior')), '// v1', 'a anterior fica guardada inteira')
    ok('publicar de novo guarda a anterior antes de trocar')
  } catch (e) { erro('segunda publicação', e) }

  try {
    const r = P.voltar({ destino: inst })
    assert.equal(r.ok, true, r.erro)
    assert.equal(marcaDe(inst), '// v1', 'voltar devolve a versão de antes')
    assert.equal(P.versaoInstalada(inst).versao, '1.0.0')
    ok('voltar restaura a versão anterior, que é a promessa do "um clique"')
  } catch (e) { erro('voltar', e) }

  /* Voltar TROCA, não descarta: se ele voltar por engano, ou se a anterior
     também estiver quebrada, o caminho de ida precisa continuar existindo. */
  try {
    assert.equal(marcaDe(path.join(inst, 'anterior')), '// v2', 'a que estava rodando vira a anterior')
    const r = P.voltar({ destino: inst })
    assert.equal(r.ok, true, r.erro)
    assert.equal(marcaDe(inst), '// v2', 'voltar de novo desfaz o voltar')
    ok('voltar troca as duas de lugar, então voltar por engano tem conserto')
  } catch (e) { erro('voltar de novo', e) }

  try {
    // repositório próprio: o `v1` foi sujado de propósito no caso do isolamento
    const v3 = repoFalso('obras-v3', '3.0.0', 'v3')
    const limpo = path.join(casa, 'instalado-limpo')
    const r = P.publicar({ repo: v3, destino: limpo, gate: false })
    assert.equal(r.ok, true, r.erro)
    const semAnterior = P.voltar({ destino: limpo })
    assert.equal(semAnterior.ok, false, 'sem anterior, recusa')
    assert.match(semAnterior.erro, /primeira publicação/)
    assert.equal(marcaDe(limpo), '// v3', 'e a recusa não pode ter mexido no que estava lá')
    ok('sem versão anterior, voltar avisa em vez de esvaziar a pasta')
  } catch (e) { erro('voltar sem anterior', e) }

  try {
    const r = P.publicar({ repo: path.join(casa, 'nao-existe'), destino: inst, gate: false })
    assert.equal(r.ok, false)
    assert.match(r.erro, /não parece o cockpit/)
    assert.equal(marcaDe(inst), '// v2', 'origem inválida não pode ter tocado na instalada')
    ok('origem que não é o cockpit é recusada, sem mexer no que está no ar')
  } catch (e) { erro('origem inválida', e) }

  try {
    const s = P.situacao({ repo: v2, destino: inst })
    assert.equal(s.publicada, true)
    assert.equal(s.temAnterior, true)
    assert.equal(s.obras.versao, '2.0.0')
    assert.equal(s.instalada.versao, '2.0.0')
    ok('o retrato diz o que está instalado, o que está nas obras, e se há volta')
  } catch (e) { erro('situação', e) }
} finally {
  delete process.env.CC_INSTALADO
  fs.rmSync(casa, { recursive: true, force: true })
}

if (falhou) process.exit(1)
console.log('test-publicar: ok')
