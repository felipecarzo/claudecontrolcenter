/**
 * A caixa de ponto do git, provada num repositório de mentira com remoto local.
 *
 * Cobre o que a decisão dele exige: o commit ao sair é LOCAL (não empurra), e só
 * a última a sair empurra. Sem rede de verdade: o "remoto" é um repositório bare
 * no próprio disco.
 */
import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { commitAoSair, apagarLuz, situacao, raizGit } from './src/caixaGit.mjs'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }
const g = (raiz, ...a) => execFileSync('git', ['-C', raiz, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'caixa-'))
try {
  // remoto: um bare no disco, para push funcionar sem internet
  const remoto = path.join(base, 'remoto.git')
  fs.mkdirSync(remoto)
  g(remoto, 'init', '--bare', '-b', 'main')

  // clone de trabalho
  const trab = path.join(base, 'trabalho')
  execFileSync('git', ['clone', remoto, trab], { stdio: ['ignore', 'pipe', 'pipe'] })
  g(trab, 'config', 'user.name', 'teste')
  g(trab, 'config', 'user.email', 'teste@local')
  fs.writeFileSync(path.join(trab, 'README.md'), '# inicio\n')
  g(trab, 'add', '-A'); g(trab, 'commit', '-m', 'inicial'); g(trab, 'push', '-u', 'origin', 'main')

  // 1. commit ao sair é LOCAL e não empurra
  try {
    fs.writeFileSync(path.join(trab, 'novo.txt'), 'trabalho de uma sessao\n')
    const r = commitAoSair(trab, { sessionId: 'aaaa1111-xxxx' })
    assert.ok(r.commitou, 'devia ter commitado: ' + (r.motivo || ''))
    assert.equal(r.arquivos, 1)
    // o remoto NÃO recebeu (push não aconteceu)
    const noRemoto = g(remoto, 'log', '--oneline').split('\n').length
    assert.equal(noRemoto, 1, 'o remoto não pode ter recebido o commit ao sair')
    // e o local TEM um commit a mais que o remoto
    const s = situacao(trab, 'aaaa1111-xxxx')
    assert.equal(s.git.naoEmpurrados, 1, 'o local devia ter 1 commit não empurrado')
    ok('commit ao sair salva local e NÃO empurra (a regra dele)')
  } catch (e) { erro('commit ao sair local', e) }

  // 2. árvore limpa não cria commit vazio
  try {
    const r = commitAoSair(trab, { sessionId: 'aaaa1111-xxxx' })
    assert.equal(r.commitou, false)
    assert.match(r.motivo, /limpa/)
    ok('árvore limpa não vira commit vazio')
  } catch (e) { erro('árvore limpa', e) }

  // 3. a última a sair empurra (sem script de teste, o repo de mentira pula a trava)
  try {
    const r = apagarLuz(trab, { rodarTeste: true })
    assert.ok(r.empurrou, 'devia ter empurrado: ' + (r.motivo || ''))
    const noRemoto = g(remoto, 'log', '--oneline').split('\n').length
    assert.equal(noRemoto, 2, 'o remoto agora tem o commit que a última empurrou')
    ok('a última a sair apaga a luz e empurra')
  } catch (e) { erro('apagar a luz', e) }

  // 4. nada a empurrar não inventa push
  try {
    const r = apagarLuz(trab, { rodarTeste: false })
    assert.equal(r.empurrou, false)
    assert.ok(r.jaEmDia, 'devia dizer que já está em dia')
    ok('sem commit novo, não empurra nada')
  } catch (e) { erro('nada a empurrar', e) }

  // 5. pasta que não é repositório é dita, não quebra
  try {
    assert.equal(raizGit(base), null)
    const s = situacao(base)
    assert.equal(s.repo, null)
    ok('pasta sem git é dita, não derruba')
  } catch (e) { erro('sem git', e) }
} finally {
  fs.rmSync(base, { recursive: true, force: true })
}

if (falhou) process.exit(1)
console.log('test-caixa: ok')
