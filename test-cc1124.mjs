// CC-1124, passo 1: a tela Caminho separa andando de em prova, e a régua do sprint
// vem das últimas 4 semanas, contando as semanas zeradas. Só dado falso, em pasta temporária.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ritmo, velocidade, fraseDoRitmo, caminhoPorSprint } from './src/sprint.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok += 1; console.log(`  ok   ${nome}`) }
const item = (id, extra = {}) => ({ id, titulo: id, estado: 'B1', frente: 'x', criado: '2026-09-01', mexido: '2026-11-20', tamanho: 'M', pronto: 'pronto escrito aqui', conferir: 'auto:node x.mjs', ...extra })
const fechado = (id, tamanho, dia) => item(id, { estado: 'OK', tamanho, fechado: dia, prova: 'ok' })
const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1124-'))

try {
  // quatro semanas de segunda a domingo, a mais nova por último (a ordem que o sprint usa)
  const seg = (k) => new Date(2026, 10, 2 + 7 * k) // 02/11, 09/11, 16/11, 23/11
  const janelas = [0, 1, 2, 3].map((k) => ({ de: seg(k).getTime(), ate: seg(k + 1).getTime() }))
  // o fechamento em lote de setembro (55 tarefas G = 440 pontos) fica FORA das 4 semanas
  const lote = Array.from({ length: 55 }, (_, k) => fechado(`CC-L${k}`, 'G', '2026-09-15'))
  // 28 pontos nas 4 semanas: duas semanas com trabalho, duas zeradas
  const reais = [fechado('CC-1', 'G', '2026-11-03'), fechado('CC-2', 'G', '2026-11-04'), fechado('CC-3', 'G', '2026-11-05'), fechado('CC-4', 'M', '2026-11-18'), fechado('CC-5', 'P', '2026-11-19')]
  const itens = [...lote, ...reais]

  t('ritmo soma as últimas 4 semanas, com as zeradas, sem o lote antigo', () => {
    const r = ritmo(itens, janelas)
    assert.deepEqual(r, { semanas: 4, total: 28, porSemana: 7 })
    assert.equal(velocidade(itens, janelas), 7)
  })
  t('só entram as 4 últimas janelas, mesmo com mais janelas na lista', () => {
    const antes = { de: seg(-1).getTime(), ate: seg(0).getTime() }
    assert.equal(ritmo([...itens, fechado('CC-9', 'G', '2026-10-28')], [antes, ...janelas]).total, 28)
  })
  t('semanas zeradas puxam a média para baixo (a mediana só das semanas com trabalho daria 14)', () => {
    assert.equal(ritmo(reais, janelas).porSemana, 7)
  })
  t('a frase diz escala e origem em palavras comuns', () => {
    assert.equal(fraseDoRitmo(ritmo(itens, janelas)), 'nas últimas 4 semanas, 28 pontos no total, 7 por semana')
    assert.equal(fraseDoRitmo({ semanas: 4, total: 7, porSemana: 1.75 }), 'nas últimas 4 semanas, 7 pontos no total, 1,8 por semana')
  })
  t('4 semanas zeradas dão ritmo 0; sem nenhum fechamento com data, 10', () => {
    assert.equal(velocidade([fechado('CC-1', 'G', '2026-09-15')], janelas), 0)
    assert.equal(velocidade([item('CC-2')], janelas), 10)
  })

  // o Caminho por sprint: 2 andando, 3 em prova, 1 definida
  const raiz = path.join(casa, 'VPS_demo'); fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  const agora = new Date(2026, 10, 23, 12).getTime()
  const abertos = [item('CC-10', { estado: 'EM' }), item('CC-11', { estado: 'EM' }), item('CC-12', { estado: 'PR' }), item('CC-13', { estado: 'PR' }), item('CC-14', { estado: 'PR' }), item('CC-15')]
  fs.writeFileSync(path.join(raiz, 'docs', 'backlog.jsonl'), [...reais, ...abertos].map((i) => JSON.stringify(i)).join('\n') + '\n')
  const c = caminhoPorSprint(raiz, agora, { ancora: null, produto: null, lerMensagens: () => [], gravar: false })

  t('o trecho conta andando e em prova separados, e a prova nunca vira andando', () => {
    assert.equal(c.ok, true)
    const soma = (k) => c.trechos.reduce((s, x) => s + (x[k] || 0), 0)
    assert.equal(soma('andando'), 2)
    assert.equal(soma('emProva'), 3)
    const at = c.trechos[c.atual]
    assert.equal(at.andando, 2) // só as duas em andamento; antes saíam 5
    assert.ok(at.emProva <= 3)
    for (const x of c.trechos) if (x !== at) assert.equal(x.andando, 0, x.frente)
  })
  t('a régua vai na resposta: valor, pesos, ritmo e a frase', () => {
    assert.equal(c.capacidade.unidade, 'pontos')
    assert.equal(c.capacidade.ritmo.semanas, 4)
    assert.deepEqual(c.capacidade.pesos, { P: 1, M: 3, G: 8 })
    assert.match(c.capacidade.frase, /^nas últimas 4 semanas, \d+(,\d)? pontos no total, \d+(,\d)? por semana$/)
  })
  t('a tela mostra em prova ao lado de andando e explica o previsto', () => {
    const ui = fs.readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
    assert.ok(ui.includes("chip(t.emProva, 'em prova'"), 'chip em prova')
    assert.ok(ui.includes("t.emProva + ' em prova'"), 'palavra do trecho')
    assert.ok(ui.includes('cp.frase'), 'a frase da régua aparece')
    assert.ok(ui.includes('tamanho de cada tarefa'), 'diz de que é feito')
    assert.ok(!ui.includes('projeto(s) em pontos'), 'o texto antigo saiu')
  })

  // CC-1124: o que não cabe no ritmo fica embaixo do último sprint, nunca some.
  // Ritmo 3 pontos por semana (4 tarefas M nas 4 semanas), 10 tarefas M abertas: cabe 1 por sprint.
  const raiz2 = path.join(casa, 'VPS_fila'); fs.mkdirSync(path.join(raiz2, 'docs'), { recursive: true })
  const ritmo3 = ['2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17'].map((d, k) => fechado('CC-R' + k, 'M', d))
  const fila10 = Array.from({ length: 10 }, (_, k) => item('CC-F' + k))
  fs.writeFileSync(path.join(raiz2, 'docs', 'backlog.jsonl'), [...ritmo3, ...fila10].map((i) => JSON.stringify(i)).join('\n') + '\n')
  const c2 = caminhoPorSprint(raiz2, agora, { ancora: null, produto: null, lerMensagens: () => [], gravar: false })
  const futuros = c2.trechos.filter((x) => x.sprint.estado === 'previsto')

  t('sprint que cabe inteiro não tem a linha; o último leva o que não cabe', () => {
    assert.equal(c2.capacidade.ritmo.porSemana, 3)
    assert.equal(futuros.length, 6)
    assert.equal(futuros[0].naoCabe, 0)
    assert.equal(futuros[0].naoCabePor, null)
    const ult = futuros.at(-1)
    assert.equal(ult.naoCabe, 3) // 10 abertas, 1 no sprint atual, 1 em cada um dos 6 futuros
    assert.equal(ult.naoCabeItens.length, 3)
    assert.equal(ult.naoCabePor, 'ritmo das últimas 4 semanas: 3 pontos por semana')
  })
  t('nenhuma tarefa some: as que cabem mais as que não cabem dão o total', () => {
    const abertas = (x) => x.total - x.feitos
    const ids = new Set(c2.trechos.flatMap((x) => [...x.itens, ...(x.naoCabeItens || [])].map((i) => i.id)))
    assert.equal(c2.trechos.reduce((s, x) => s + abertas(x) + x.naoCabe, 0), 10)
    for (const i of fila10) assert.ok(ids.has(i.id), i.id)
    assert.equal(c2.total, 14) // 4 fechadas + 10 abertas
  })
  t('a tela desenha a linha recolhida embaixo do sprint', () => {
    const ui = fs.readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
    assert.ok(ui.includes('<details class="cam-nao-cabe"'), 'bloco recolhido, sem open fixo')
    assert.ok(ui.includes("tarefas não cabem') + ' até esta semana ("), 'a frase')
  })
} finally { fs.rmSync(casa, { recursive: true, force: true }) }
console.log(`\n${ok} ok, 0 falhas (cc1124)`)
