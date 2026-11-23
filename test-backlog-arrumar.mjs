/**
 * CC-1124, passos 2 e 3: andando parado volta para definida; andando citado em commit vai para prova.
 * Tudo num repositório git temporário, com backlog e diário falsos.
 *
 *   node test-backlog-arrumar.mjs
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { gravar, ler, lerEventos, caminhoPadrao, caminhoEventos, planoDeArrumar, arrumar, arrumarProjeto, diaLocal } from './src/backlog.mjs'

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1124-'))
const arquivo = caminhoPadrao(raiz)
const HORA = 3600e3
const agora = Date.now()
const dia = (ms) => diaLocal(new Date(ms))
const tresDias = agora - 72 * HORA
const item = (id, estado, mexido, extra = {}) => ({ id, titulo: `tarefa ${id}`, estado, frente: 'teste', mexido: dia(mexido), criado: dia(mexido), prova: null, porque: estado === 'TR' ? 'x' : null, decisao: estado === 'DE' ? 'qual?' : null, pronto: 'algo se observa', ...extra })
const SESSAO_VIVA = '11111111-1111-1111-1111-111111111111'
const SESSAO_MORTA = '22222222-2222-2222-2222-222222222222'
const sinal = (s) => (s === SESSAO_VIVA ? agora - HORA : s === SESSAO_MORTA ? tresDias : 0)

const preparar = () => {
  fs.rmSync(path.join(raiz, 'docs'), { recursive: true, force: true })
  gravar([
    item('CC-1', 'EM', tresDias), // parada há 3 dias: volta
    item('CC-2', 'EM', agora), // mexida hoje: fica
    item('CC-3', 'EM', tresDias), // parada, mas a sessão que a mediu está viva: fica
    item('CC-4', 'DE', tresDias), // decisão dele: nunca expira
    item('CC-5', 'PR', tresDias), // prova: nunca expira
    item('CC-6', 'EM', tresDias), // commit cita depois de entrar em andando: vai para prova
    item('CC-7', 'EM', tresDias), // commit cita ANTES de entrar em andando: não conta, e expira
    item('CC-8', 'EM', tresDias), // só a sessão morta a mediu: volta
  ], arquivo)
  const ev = (id, quando, e) => JSON.stringify({ em: new Date(quando).toISOString(), id, ...e })
  fs.writeFileSync(caminhoEventos(arquivo), [
    ev('CC-1', tresDias, { tipo: 'estado', de: 'B1', para: 'EM' }),
    ev('CC-3', tresDias, { tipo: 'estado', de: 'B1', para: 'EM' }),
    ev('CC-3', tresDias, { tipo: 'medida', estado: 'EM', sessao: SESSAO_VIVA, tokens: 1 }),
    ev('CC-6', tresDias, { tipo: 'estado', de: 'B1', para: 'EM' }),
    ev('CC-7', tresDias, { tipo: 'estado', de: 'B1', para: 'EM' }),
    ev('CC-8', tresDias, { tipo: 'medida', estado: 'EM', sessao: SESSAO_MORTA, tokens: 1 }),
  ].join('\n') + '\n')
}

const commits = [
  { hash: 'aaaaaaa1111', em: agora - 2 * HORA, titulo: 'fix(x): conserta a coisa (CC-6)', ids: new Set(['CC-6']) },
  { hash: 'bbbbbbb2222', em: tresDias - 10 * HORA, titulo: 'feat: antigo (CC-7)', ids: new Set(['CC-7']) },
]

/* 1. o plano, sem gravar */
preparar()
const plano = planoDeArrumar(ler(arquivo).itens, lerEventos(arquivo), { agora, commits, sinal })
const para = Object.fromEntries(plano.map((a) => [a.id, a.para]))
assert.deepStrictEqual(para, { 'CC-1': 'B1', 'CC-6': 'PR', 'CC-7': 'B1', 'CC-8': 'B1' }, JSON.stringify(plano))
ok('parada há 3 dias volta; mexida hoje, sessão viva, DE e PR ficam; commit leva para prova')

/* 2. aplicado: estados, mexido preservado, prova do commit, motivo no diário */
arrumar(arquivo, { agora, commits, sinal })
const porId = Object.fromEntries(ler(arquivo).itens.map((x) => [x.id, x]))
assert.strictEqual(porId['CC-1'].estado, 'B1')
assert.strictEqual(porId['CC-1'].mexido, dia(tresDias), 'a volta automática não pode contar como toque')
assert.strictEqual(porId['CC-2'].estado, 'EM')
assert.strictEqual(porId['CC-3'].estado, 'EM')
assert.strictEqual(porId['CC-4'].estado, 'DE')
assert.strictEqual(porId['CC-5'].estado, 'PR')
assert.strictEqual(porId['CC-6'].estado, 'PR')
assert.match(porId['CC-6'].prova, /^commit aaaaaaa: fix\(x\)/)
ok('gravado: B1 com o mexido antigo, PR com o commit como prova, nada fechou')

const evs = lerEventos(arquivo)
const de = (id) => evs.filter((e) => e.id === id && e.tipo === 'estado' && e.por === 'robo')
assert.strictEqual(de('CC-1')[0].porque, 'ninguém mexeu há 48 h')
assert.deepStrictEqual([de('CC-1')[0].de, de('CC-1')[0].para], ['EM', 'B1'])
assert.strictEqual(de('CC-6')[0].porque, 'o commit aaaaaaa cita CC-6')
assert.ok(!evs.some((e) => e.id === 'CC-2' && e.por === 'robo'))
ok('o diário de cada tarefa conta o motivo')

/* 3. rodar de novo não muda nada (a varredura do painel repete de 10 em 10 minutos) */
assert.deepStrictEqual(planoDeArrumar(ler(arquivo).itens, lerEventos(arquivo), { agora, commits, sinal }), [])
ok('segunda passada não acha nada')

/* 4. o Nisaba continua achando a tarefa de hoje: a guarda pede EM mexida hoje */
const { avaliarEdicao } = await import('./src/nisabaGuard.mjs')
fs.mkdirSync(path.join(raiz, 'src'), { recursive: true })
assert.strictEqual(avaliarEdicao(path.join(raiz, 'src', 'a.mjs')).bloquear, false)
ok('a sessão que trabalha hoje continua podendo editar')

/* 5. de ponta a ponta com git de verdade: o commit que cita a tarefa a leva para prova */
preparar()
const git = (...a) => execFileSync('git', ['-c', 'user.name=teste', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: raiz, stdio: 'pipe' })
git('init', '-q')
fs.writeFileSync(path.join(raiz, 'a.txt'), 'x')
git('add', 'a.txt')
git('commit', '-q', '-m', 'fix: a coisa', '-m', 'corpo citando CC-6 e CC-2')
await arrumarProjeto(raiz, { agora, sinal })
const depois = Object.fromEntries(ler(arquivo).itens.map((x) => [x.id, x.estado]))
assert.strictEqual(depois['CC-6'], 'PR')
assert.strictEqual(depois['CC-2'], 'PR', 'mexida hoje e citada em commit de agora: vai para prova')
assert.strictEqual(depois['CC-1'], 'B1')
assert.strictEqual(depois['CC-3'], 'EM')
ok('git real: corpo do commit cita, a tarefa vai para prova')

fs.rmSync(raiz, { recursive: true, force: true })
console.log(`\n  ${n} ok\n`)
