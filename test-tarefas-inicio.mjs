/**
 * CC-1124, passo 5: a abertura de sessão mostra no máximo 4 tarefas dele (as que mudaram
 * em 7 dias, ou da frente da sessão) e uma frase com o resto. Roda o gancho de verdade,
 * com a lista falsa numa casa isolada (CC_HOME): a lista real dele nunca é lida.
 *
 *   node test-tarefas-inicio.mjs
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1124-abertura-'))
const casa = path.join(raiz, 'casa') // o abrigo da lista mora no pai da casa: fica dentro de `raiz`
fs.mkdirSync(casa)
process.env.CC_HOME = casa
const M = await import('./src/meu.mjs')

const DIA = 86400000
const agora = Date.now()
const lista = (n, recentes) => Array.from({ length: n }, (_, i) => ({
  id: `t${i}`, texto: i < recentes ? `recente ${i}` : `velha ${i}`, projeto: 'outro', frente: null,
  feito: false, em: i < recentes ? agora - DIA : agora - 40 * DIA,
}))

const rodar = (tarefas) => {
  fs.writeFileSync(path.join(casa, 'control-center-meu.json'), JSON.stringify({ tarefas }))
  const inicio = Date.now()
  const r = spawnSync('node', ['hooks/tarefas-inicio.mjs'], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd: raiz, session_id: 'teste' }),
    env: { ...process.env, CC_HOME: casa, CC_SEM_NAVEGADOR: '1' }, encoding: 'utf8', timeout: 20000,
  })
  assert.strictEqual(r.status, 0, `o gancho precisa sair com 0 (falha aberta). stderr: ${r.stderr}`)
  return { linhas: r.stdout.split('\n').filter(Boolean), ms: Date.now() - inicio }
}
const FRASE = /paradas há mais de 7 dias; estão no Caminho e no Decidir um por um\.$/
let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

try {
  /* 1. 248 tarefas, 4 recentes: 4 linhas, a frase com escala, a instrução de uma frase */
  {
    const { linhas, ms } = rodar(lista(248, 4))
    const itens = linhas.filter((l) => l.startsWith('  - '))
    assert.strictEqual(itens.length, 4, linhas.join('\n'))
    assert.ok(itens.every((l) => l.includes('recente')), 'só as recentes entram')
    assert.ok(linhas.some((l) => FRASE.test(l) && l.startsWith('244 de 248 ')), linhas.join('\n'))
    assert.strictEqual(linhas.at(-1), 'Mencione só se tocar o trabalho de hoje; não execute nem feche por ele.')
    assert.ok(linhas.length <= 7, `abertura com ${linhas.length} linhas`)
    assert.ok(!/[—–]/.test(linhas.join('')), 'travessão na saída')
    assert.ok(ms < 10000, `o gancho levou ${ms} ms`)
    ok(`248 tarefas, 4 recentes: ${linhas.length} linhas, ${linhas.join('\n').length} caracteres, ${ms} ms`)
  }

  /* 2. zero recentes: nenhuma tarefa listada, só a frase (e a instrução) */
  {
    const { linhas } = rodar(lista(248, 0))
    assert.strictEqual(linhas.filter((l) => l.startsWith('  - ')).length, 0, linhas.join('\n'))
    assert.ok(linhas.some((l) => FRASE.test(l) && l.startsWith('As 248 tarefas')), linhas.join('\n'))
    assert.strictEqual(linhas.length, 2, linhas.join('\n'))
    ok('248 tarefas, zero recentes: só a frase e a instrução')
  }

  /* 3. nenhuma tarefa dele: silêncio */
  {
    const { linhas } = rodar([])
    assert.strictEqual(linhas.length, 0, linhas.join('\n'))
    ok('nenhuma tarefa dele: silêncio')
  }

  /* 4. mais de 4 recentes: teto de 4, com a conta; decisão sobe primeiro */
  {
    const t = lista(10, 6)
    t[5].texto = 'Decidir uma coisa nova'
    const { linhas } = rodar(t)
    const itens = linhas.filter((l) => l.startsWith('  - '))
    assert.strictEqual(itens.length, 4)
    assert.ok(itens[0].includes('Decidir uma coisa nova'), 'decisão da semana vem primeiro')
    assert.ok(linhas[0].includes('(4 de 6)'), linhas[0])
    assert.ok(linhas.some((l) => l.startsWith('4 de 10 ') && FRASE.test(l)), linhas.join('\n'))
    ok('6 recentes: mostra 4, diz "4 de 6", decisão no topo')
  }

  /* 5. a frente da sessão traz a tarefa velha do mesmo projeto e frente, e só ela */
  {
    const t = [
      { id: 'a', texto: 'velha da frente', projeto: 'cockpit', frente: 'Sincronia', feito: false, em: agora - 40 * DIA },
      { id: 'b', texto: 'velha de outra frente', projeto: 'cockpit', frente: 'Outra', feito: false, em: agora - 40 * DIA },
      { id: 'c', texto: 'mesma frente, outro projeto', projeto: 'outro', frente: 'Sincronia', feito: false, em: agora - 40 * DIA },
    ]
    const s = M.paraAbertura(t, { agora, projeto: 'cockpit', frente: 'Sincronia' })
    assert.deepStrictEqual(s.mostrar.map((x) => x.id), ['a'])
    assert.strictEqual(s.paradas, 2)
    assert.strictEqual(M.paraAbertura(t, { agora, projeto: 'cockpit' }).mostrar.length, 0, 'sem frente da sessão, nada velho entra')
    ok('frente da sessão: entra a velha do mesmo projeto e frente, e só ela')
  }

  /* 6. o gancho nunca fecha tarefa dele: a lista fica igual depois de rodar */
  {
    const t = lista(5, 2)
    rodar(t)
    const depois = JSON.parse(fs.readFileSync(path.join(casa, 'control-center-meu.json'), 'utf8')).tarefas
    assert.deepStrictEqual(depois, t)
    ok('o gancho não mexe na lista dele')
  }
} finally {
  fs.rmSync(raiz, { recursive: true, force: true })
}
console.log(`  ${n} ok`)
