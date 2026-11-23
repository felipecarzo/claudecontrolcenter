/**
 * CC-1124, passo 4: a regra dos 30 dias (cada linha da tabela de 23/11) e o cartão semanal do Decidir um por um.
 * Tudo numa pasta temporária, com backlog e diário falsos. Não lê nem grava a configuração dele (o `cfg` vai junto).
 *
 *   node test-carta-semanal.mjs
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as B from './src/backlog.mjs'
import * as S from './src/cartaSemanal.mjs'
import * as C from './src/cartas.mjs'

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1124-30d-'))
const arquivo = B.caminhoPadrao(raiz)
const deckArq = path.join(raiz, 'docs', 'cartas', S.DECK + '.json')
const DIA = 86400e3
const agora = Date.now()
const hoje = B.diaLocal()
const ha = (d) => B.diaLocal(new Date(agora - d * DIA))
const em = new Date(agora - 40 * DIA).toISOString()
const item = (id, estado, dias, onde, extra = {}) => ({ id, titulo: `tarefa ${id}`, estado, frente: 'teste', criado: ha(dias), mexido: ha(dias), prova: null,
  porque: estado === 'TR' ? 'obstáculo' : null, decisao: estado === 'DE' ? 'qual?' : null, pronto: 'algo se observa', ...(onde ? { lugar: { onde, em } } : {}), ...extra })
const porId = () => Object.fromEntries(B.ler(arquivo).itens.map((x) => [x.id, x]))

const preparar = () => {
  fs.rmSync(path.join(raiz, 'docs'), { recursive: true, force: true })
  B.gravar([
    item('CC-1', 'B1', 40, 'agora'), // agora: só pergunta
    item('CC-2', 'B1', 40, 'dia'), // fim do dia: só pergunta
    item('CC-3', 'B1', 40, 'sprint'), // sprint: fim do backlog
    item('CC-4', 'B1', 40, 'backlog'), // backlog: cancelada
    item('CC-5', 'B1', 40, 'fora'), // fora do MVP: nada
    item('CC-6', 'B1', 40, null), // sem lugar: só pergunta
    item('CC-7', 'PR', 40, 'sprint'), // prova: nunca muda
    item('CC-8', 'DE', 40, 'backlog'), // decisão dele: nunca muda
    item('CC-9', 'B1', 10, 'sprint'), // parada há 10 dias: não é parada
    item('CC-10', 'B1', 40, 'backlog'), // tem micro tarefa aberta: não é cancelada
    item('CC-11', 'B1', 40, null, { pai: 'CC-10' }), // micro tarefa: segue o pai
    item('CC-12', 'TR', 40, 'sprint'), // travada no sprint: fim do backlog
    item('CC-13', 'B0', 40, null), // ideia sem lugar: só pergunta
  ], arquivo)
  fs.writeFileSync(B.caminhoEventos(arquivo), '')
}

/* 1. a tabela, sem gravar */
preparar()
const plano = B.planoDosTrintaDias(B.ler(arquivo).itens, { agora })
assert.deepStrictEqual(Object.fromEntries(plano.map((a) => [a.id, a.lugar || a.para])), { 'CC-3': 'backlog', 'CC-4': 'KO', 'CC-12': 'backlog' }, JSON.stringify(plano))
ok('a tabela: sprint vai para o fim do backlog, backlog é cancelada; agora, fim do dia, fora, sem lugar, PR, DE, micro tarefa e pai com micro aberta ficam')
assert.ok(plano.find((a) => a.id === 'CC-4').porque.includes('parada há 30 dias, no lugar backlog'))
ok('o motivo da cancelada diz "parada há 30 dias, no lugar backlog"')

/* 2. o interruptor desliga, e a máquina que não é dona não grava */
const antes = fs.readFileSync(arquivo, 'utf8')
await B.arrumarProjeto(raiz, { cfg: { nisabaTrintaDias: false }, dono: true })
assert.strictEqual(fs.readFileSync(arquivo, 'utf8'), antes)
assert.ok(!fs.existsSync(deckArq))
ok('"nisabaTrintaDias": false desliga a regra e o cartão: nada muda')
const ensaio = await B.arrumarProjeto(raiz, { cfg: {}, dono: false })
assert.strictEqual(ensaio.length, 3)
assert.ok(ensaio.every((a) => a.naoDono))
assert.strictEqual(fs.readFileSync(arquivo, 'utf8'), antes)
assert.ok(!fs.existsSync(deckArq))
ok('máquina que não é dona: mostra as 3 mudanças, não grava backlog nem cartão')

/* 3. o cartão em ensaio conta o que mudaria */
const ens = S.montarCartao(raiz, { ensaio: true, acoes: ensaio })
assert.ok(ens.carta.passos[0].includes('2 iriam para o fim do backlog') && ens.carta.passos[0].includes('1 seria cancelada'), ens.carta.passos[0])
assert.ok(!fs.existsSync(deckArq))
ok('ensaio: o cartão diz "2 iriam para o fim do backlog, 1 seria cancelada" e nada é gravado')

/* 4. de verdade, na dona */
const acoes = await B.arrumarProjeto(raiz, { cfg: {}, dono: true })
assert.strictEqual(acoes.filter((a) => a.feito).length, 3, JSON.stringify(acoes))
let p = porId()
assert.strictEqual(p['CC-3'].lugar.onde, 'backlog'); assert.strictEqual(p['CC-3'].estado, 'B1'); assert.strictEqual(p['CC-3'].mexido, hoje)
assert.strictEqual(p['CC-12'].lugar.onde, 'backlog'); assert.strictEqual(p['CC-12'].estado, 'TR')
assert.strictEqual(p['CC-4'].estado, 'KO'); assert.ok(p['CC-4'].porque.includes('no lugar backlog'))
for (const id of ['CC-1', 'CC-2', 'CC-5', 'CC-6', 'CC-7', 'CC-8', 'CC-9', 'CC-10', 'CC-11', 'CC-13']) assert.strictEqual(p[id].mexido, ha(id === 'CC-9' ? 10 : 40), id)
const ev = B.lerEventos(arquivo).filter((e) => e.regra === B.REGRA_TRINTA)
assert.deepStrictEqual(ev.map((e) => `${e.id}:${e.tipo}:${e.por}`).sort(), ['CC-12:lugar:robo', 'CC-3:lugar:robo', 'CC-4:estado:robo'])
ok('na dona: CC-3 e CC-12 no fim do backlog (mexido hoje), CC-4 cancelada; as outras 10 intocadas; motivo no histórico com por: robo')
assert.strictEqual(B.planoDosTrintaDias(B.ler(arquivo).itens).length, 0)
ok('a que foi para o fim do backlog não é cancelada na varredura seguinte: tem mais 30 dias lá')

/* 5. o cartão agrupa e conta */
const deck = JSON.parse(fs.readFileSync(deckArq, 'utf8'))
assert.deepStrictEqual(C.validarDeck(deck), [])
assert.strictEqual(deck.cartas.length, 1)
const c = deck.cartas[0]
assert.strictEqual(c.id, `semana-${S.segundaDe()}`)
// paradas abertas sem micro: 1, 2, 5, 6, 7, 8, 10, 13 = 8; abertas sem micro: 1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13 = 11
assert.strictEqual(c.titulo, '8 das 11 tarefas abertas estão paradas há mais de 30 dias')
const linha = (inicio) => c.passos.find((x) => x.startsWith(inicio)) || ''
assert.ok(c.passos[0].includes('2 foram para o fim do backlog e saíram do sprint') && c.passos[0].includes('1 foi cancelada'), c.passos[0])
assert.ok(linha('Sem lugar na fila: 2 das 8').includes('De onde vem') && linha('Sem lugar na fila').includes('Peso'))
assert.ok(linha('Agora e fim do dia: 2 das 8').includes('nunca mudam sozinhas'))
assert.ok(linha('Em prova: 1 das 8')); assert.ok(linha('Esperando decisão sua: 1 das 8')); assert.ok(linha('Fora do MVP: 1 das 8'))
assert.deepStrictEqual(c.opcoes, [S.OP.backlog, S.OP.cancelar, S.OP.agora, S.OP.manter]); assert.strictEqual(c.multipla, true)
assert.ok(!/[—–]/.test(JSON.stringify(deck)))
ok('o cartão: um só, "8 das 11", grupos sem lugar 2, agora 2, prova 1, decisão 1, fora 1, cada um "X das 8", com de onde vem e peso; sem travessão')
assert.strictEqual(C.pendentes(raiz).find((d) => d.deck === S.DECK).pendentes.length, 1)
ok('o cartão aparece no Decidir um por um (cartas.pendentes), como qualquer baralho')

/* 6. não duplica */
const corpo = fs.readFileSync(deckArq, 'utf8')
S.montarCartao(raiz); S.montarCartao(raiz)
assert.strictEqual(fs.readFileSync(deckArq, 'utf8'), corpo)
const semana2 = S.montarCartao(raiz, { agora: agora + 7 * DIA })
assert.strictEqual(semana2.deck.cartas.length, 1); assert.notStrictEqual(semana2.carta.id, c.id)
ok('remontar na mesma semana não muda o arquivo; na semana seguinte o cartão velho sem resposta é trocado, nunca dois abertos')
S.montarCartao(raiz) // volta para a semana de hoje

/* 7. a resposta dele */
assert.ok(S.responder(raiz, c.id, [S.OP.backlog, S.OP.cancelar]).erro)
assert.ok(S.responder(raiz, c.id, [S.OP.manter, S.OP.agora]).erro)
assert.strictEqual(C.votos(raiz, S.DECK).length, 0)
ok('opções que se contradizem são recusadas antes de gravar o voto')
const r = S.responder(raiz, c.id, [S.OP.backlog, S.OP.agora], 'teste')
assert.ok(r.ok, JSON.stringify(r)); assert.strictEqual(r.feitas, 4, JSON.stringify(r))
p = porId()
for (const id of ['CC-6', 'CC-13', 'CC-1', 'CC-2']) { assert.strictEqual(p[id].lugar.onde, 'backlog', id); assert.strictEqual(p[id].mexido, hoje, id) }
assert.strictEqual(p['CC-13'].estado, 'B1') // a ideia que ganha lugar vira definida, a regra de porNoLugar
assert.strictEqual(p['CC-7'].estado, 'PR'); assert.strictEqual(p['CC-8'].estado, 'DE')
ok('a resposta aplica pelo comando do backlog: sem lugar e agora no fim do backlog; prova e decisão intocadas')
await B.arrumarProjeto(raiz, { cfg: {}, dono: true })
p = porId()
for (const id of ['CC-6', 'CC-13', 'CC-1', 'CC-2']) assert.strictEqual(p[id].estado === 'KO', false, id)
assert.deepStrictEqual(S.montarCartao(raiz), { carta: null, respondido: true })
assert.strictEqual(JSON.parse(fs.readFileSync(deckArq, 'utf8')).cartas[0].id, c.id)
ok('a varredura seguinte não desfaz a resposta, e a semana respondida não ganha cartão novo')

/* 8. manter */
preparar()
await B.arrumarProjeto(raiz, { cfg: {}, dono: true })
const c2 = JSON.parse(fs.readFileSync(deckArq, 'utf8')).cartas[0]
assert.ok(S.responder(raiz, c2.id, [S.OP.manter]).ok)
p = porId()
for (const id of ['CC-1', 'CC-2', 'CC-6', 'CC-13']) { assert.strictEqual(p[id].mexido, hoje, id); assert.strictEqual(B.lugarDe(p[id]), B.lugarDe(item(id, 'B1', 0, { 'CC-1': 'agora', 'CC-2': 'dia' }[id] || null)), id) }
assert.strictEqual(p['CC-7'].mexido, ha(40))
ok('manter: ficam onde estão, com o mexido de hoje (saem do cartão por 30 dias); prova intocada')

fs.rmSync(raiz, { recursive: true, force: true })
console.log(`\n  ${n} verificações, todas passaram\n`)
