/**
 * CC-1124, passo 6: o aviso único de sprint que não cabe. Backlog, diário e casa (CC_HOME) falsos, em pasta temporária.
 * Sprint que cabe: nada. Não cabe: um aviso. Segunda leitura no mesmo sprint: nada. Sprint novo: outro.
 * Máquina que não é dona: nada. Interruptor desligado: nada. E as duas respostas.
 *
 *   node test-aviso-sprint.mjs
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1124-aviso-'))
process.env.CC_HOME = path.join(tmp, 'casa') // antes de importar: config.mjs resolve o arquivo ao carregar
const B = await import('./src/backlog.mjs')
const S = await import('./src/sprint.mjs')
const C = await import('./src/cartas.mjs')
const A = await import('./src/avisoDeSprint.mjs')

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }
const DIA = 864e5
const agora = new Date(2026, 10, 23, 12).getTime() // segunda, sprint da janela 23/11 a 29/11
const em = new Date(agora - DIA).toISOString()
const item = (id, extra = {}) => ({ id, titulo: `tarefa ${id}`, estado: 'B1', frente: 'teste', criado: '2026-11-01', mexido: '2026-11-22', tamanho: 'M', prova: null, pronto: 'algo se observa', ...extra })
// ritmo: 4 tarefas M fechadas nas 4 semanas anteriores = 12 pontos, 3 por semana
const ritmo = ['2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17'].map((d, k) => item('CC-R' + k, { estado: 'OK', fechado: d, prova: 'ok' }))
const caminhoFn = (r, a, o) => S.caminhoPorSprint(r, a, { ...o, produto: null, lerMensagens: () => [] })
const op = { ancora: null, caminhoFn }
const projeto = (nome, abertos) => {
  const raiz = path.join(tmp, nome); fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  B.gravar([...ritmo, ...abertos], B.caminhoPadrao(raiz)); fs.writeFileSync(B.caminhoEventos(B.caminhoPadrao(raiz)), '')
  return raiz
}
const deckDe = (raiz) => path.join(raiz, 'docs', 'cartas', A.DECK + '.json')
// não cabe: 1 andando P (1 ponto) e 5 marcadas como agora, M (15 pontos) = 16 pontos contra 3 por semana
const cheio = () => [item('CC-1', { estado: 'EM', tamanho: 'P' }), ...[2, 3, 4, 5, 6].map((k) => item('CC-' + k, { lugar: { onde: 'agora', em } }))]

try {
  /* 1. sprint que cabe: nenhum aviso, mas a semana fica vista */
  const cabe = projeto('cabe', [item('CC-1')]) // 3 pontos, ritmo 3
  assert.deepStrictEqual(A.emitir(cabe, { cfg: {}, agora, ...op }), { carta: null })
  assert.ok(!fs.existsSync(deckDe(cabe)))
  assert.strictEqual(A.emitir(cabe, { cfg: {}, agora: agora + 3600e3, ...op }).pulado, 'ja-visto')
  ok('sprint que cabe no ritmo: nenhum aviso, e a semana fica marcada como vista')

  /* 2. não cabe: um aviso, com as três partes da regra 10 */
  const raiz = projeto('cheio', cheio())
  const r1 = A.emitir(raiz, { cfg: {}, agora, ...op })
  assert.ok(r1.carta, JSON.stringify(r1))
  const deck = JSON.parse(fs.readFileSync(deckDe(raiz), 'utf8'))
  assert.deepStrictEqual(C.validarDeck(deck), [])
  const c = deck.cartas[0]
  assert.match(c.titulo, /^O sprint \d+ tem 16 pontos e nas últimas 4 semanas vocês fecharam 12, uns 3 por semana$/, c.titulo)
  assert.ok(c.pergunta.startsWith('Cabe menos da metade. No ritmo de agora, ele leva umas 6 semanas para fechar. O que você quer fazer com o resto?'), c.pergunta)
  assert.ok(c.passos[0].startsWith('De onde vem: 6 tarefas abertas'), c.passos[0])
  assert.ok(c.passos[1].startsWith(A.OP.passar + ': ficam 1 tarefa (1 ponto) e saem 5') && c.passos[1].includes('Peso:'), c.passos[1])
  assert.ok(c.passos[2].startsWith(A.OP.manter + ': nada muda. Peso:'), c.passos[2])
  assert.ok(c.passos[3].includes('CC-2 (tarefa CC-2)'), c.passos[3])
  assert.deepStrictEqual(c.opcoes, [A.OP.passar, A.OP.manter])
  ok('não cabe: um aviso, com de onde vem, o que cada opção muda e o peso, e a lista do que sai')

  /* 3. segunda leitura no mesmo sprint, sem resposta: nada, e o baralho não é reescrito */
  const antes = fs.readFileSync(deckDe(raiz), 'utf8')
  assert.strictEqual(A.emitir(raiz, { cfg: {}, agora: agora + 2 * DIA, ...op }).pulado, 'ja-visto')
  assert.strictEqual(fs.readFileSync(deckDe(raiz), 'utf8'), antes)
  ok('segunda leitura no mesmo sprint, sem resposta: nenhum aviso novo')

  /* 4. sprint novo: outro aviso */
  const agora2 = agora + 7 * DIA
  const r2 = A.emitir(raiz, { cfg: {}, agora: agora2, ...op })
  assert.ok(r2.carta && r2.carta.id !== c.id, JSON.stringify(r2))
  const estado = JSON.parse(fs.readFileSync(A.arquivoDeEstado(), 'utf8'))
  assert.ok(A.arquivoDeEstado().startsWith(process.env.CC_HOME), 'o estado mora na casa isolada')
  assert.strictEqual(estado[path.resolve(raiz)].aviso, r2.carta.id)
  ok('sprint novo: outro aviso, e o estado mora ao lado da configuração (CC_HOME)')

  /* 5. máquina que não é dona e 6. interruptor */
  const vps = projeto('vps', cheio())
  assert.strictEqual(A.emitir(vps, { cfg: { federacao: { token: 'x' } }, agora, ...op }).pulado, 'nao-dono')
  assert.strictEqual(A.emitir(vps, { cfg: { avisoDeSprint: false }, agora, ...op }).pulado, 'desligado')
  assert.ok(!fs.existsSync(deckDe(vps)))
  ok('máquina que não é dona e "avisoDeSprint": false: nenhum aviso, nada gravado')

  /* 7. manter: só o voto */
  assert.ok(A.emitir(vps, { cfg: {}, agora, ...op }).carta)
  const backlogAntes = fs.readFileSync(B.caminhoPadrao(vps), 'utf8')
  const id7 = JSON.parse(fs.readFileSync(deckDe(vps), 'utf8')).cartas[0].id
  assert.ok(A.responder(vps, id7, [A.OP.manter], '', { agora, ...op }).ok)
  assert.strictEqual(fs.readFileSync(B.caminhoPadrao(vps), 'utf8'), backlogAntes)
  assert.ok(!fs.existsSync(S.arquivoDeSprints(vps)))
  ok('manter: grava o voto e nada muda no backlog nem no sprint')

  /* 8. passar: tira do sprint pelo diário do sprint e pelo comando do backlog; andando fica */
  const r8 = A.responder(raiz, r2.carta.id, [A.OP.passar], 'teste', { agora: agora2, ...op })
  assert.strictEqual(r8.ok, true); assert.strictEqual(r8.tiradas, 5); assert.strictEqual(r8.feitas, 5, JSON.stringify(r8))
  const depois = caminhoFn(raiz, agora2, { gravar: false, ancora: null })
  assert.deepStrictEqual(depois.trechos[depois.atual].abertosNaOrdem.map((i) => i.id), ['CC-1'])
  const seguinte = depois.trechos[depois.atual + 1]
  assert.ok(seguinte.itens.some((i) => i.id === 'CC-2'), 'as marcadas como agora voltam no sprint seguinte')
  const evs = B.lerEventos(B.caminhoPadrao(raiz)).filter((e) => e.tipo === 'nota' && /aviso de sprint que não cabe/.test(e.texto))
  assert.strictEqual(evs.length, 5)
  assert.strictEqual(B.ler(B.caminhoPadrao(raiz)).itens.find((x) => x.id === 'CC-2').lugar.onde, 'agora', 'a marca dele continua')
  const j = S.janelaDe(agora2, null)
  fs.appendFileSync(S.arquivoDeSprints(raiz), JSON.stringify({ tipo: 'abrir', n: 9, de: new Date(j.de).toISOString(), ate: new Date(j.ate).toISOString(), itens: ['CC-1', 'CC-2', 'CC-3'] }) + '\n')
  assert.deepStrictEqual([...B.sprintAtualIds(raiz, agora2)], ['CC-1'])
  assert.strictEqual(A.emitir(raiz, { cfg: {}, agora: agora2 + DIA, ...op }).pulado, 'ja-visto')
  ok('passar: as 5 saem do sprint com uma linha no histórico, a andando fica, a fila do agente desconta, e o aviso não volta')

  /* 9. carta velha de outro sprint: só o voto */
  const r9 = A.responder(raiz, c.id, [A.OP.passar], '', { agora: agora2, ...op })
  assert.ok(!r9.ok || r9.recusas?.length, JSON.stringify(r9)) // a carta da semana 1 já saiu do baralho
  ok('resposta a carta de outro sprint não tira nada')
} finally { fs.rmSync(tmp, { recursive: true, force: true }) }
console.log(`\n${n} ok, 0 falhas (aviso de sprint)`)
