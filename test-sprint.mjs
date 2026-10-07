// CC-899: histórico do uso do plano e medida de capacidade
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { anotarHistorico, lerHistorico, gastoPorSemana } from './src/uso.mjs'
import { capacidade, tokensUteis, PONTOS, escolher, previsao, janelaDe, velocidade, custosDoRobo, metaDoSprint, montar, caminhoPorSprint, contaDaSemana } from './src/sprint.mjs'
import { execFileSync } from 'node:child_process'
import { diaDoLote, datasNoTexto, dataReal, comDataReal, idNormal } from './src/dataReal.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-'))

try {
  t('anotarHistorico não repete linha igual e anota quando muda', () => {
    const arq = path.join(casa, 'h.jsonl')
    const d = (s, c) => ({ em: 1, semana: { pct: s, resetaEm: 1000 }, cincoHoras: { pct: c, resetaEm: 5 } })
    assert.equal(anotarHistorico(d(10, 1), arq), true)
    assert.equal(anotarHistorico(d(10, 1), arq), false)
    assert.equal(anotarHistorico(d(11, 1), arq), true)
    assert.equal(lerHistorico({}, arq).length, 2)
    assert.equal(lerHistorico({ desde: 2 }, arq).length, 0)
  })
  t('gastoPorSemana pega o maior pct de cada janela', () => {
    const g = gastoPorSemana([
      { semana: 10, semanaReset: 2000 }, { semana: 72, semanaReset: 2000 }, { semana: 40, semanaReset: 2000 },
      { semana: 5, semanaReset: 1000 }, { semana: null, semanaReset: 3000 },
    ])
    assert.deepEqual(g, [{ resetaEm: 1000, pct: 5 }, { resetaEm: 2000, pct: 72 }])
  })
  t('tokensUteis soma saída e escrita, nunca a leitura de cache', () => {
    assert.equal(tokensUteis({ input: 7, output: 100, escrita5m: 10, escrita1h: 5, leitura: 99999 }), 115)
  })
  t('capacidade separa por semana e calcula horas por dia ativo', () => {
    const agora = new Date(2026, 8, 30, 12).getTime() // quarta 30/09; a semana atual começa em 28/09
    const h = 36e5
    const fake = () => ({ projetos: [
      { projeto: 'VPS_x', dias: [{ dia: '2026-09-28', ativoMs: 2 * h }, { dia: '2026-09-29', ativoMs: 4 * h }, { dia: '2026-09-21', ativoMs: 3 * h }],
        usoDias: [
          { dia: '2026-09-28', modelo: 'a', output: 100, escrita5m: 10, escrita1h: 0, leitura: 1e6 },
          { dia: '2026-09-21', modelo: 'a', output: 40, escrita5m: 0, escrita1h: 10, leitura: 1e6 },
          { dia: '2026-01-01', modelo: 'a', output: 999, escrita5m: 0, escrita1h: 0, leitura: 0 },
        ] },
      { projeto: 'outro', dias: [{ dia: '2026-09-28', ativoMs: 50 * h }], usoDias: [] },
    ] })
    const c = capacidade('/home/x/projetos/VPS_x', { agora, semanas: 2, resumoFn: fake })
    assert.deepEqual(c.semanas.map((s) => s.de), ['2026-09-21', '2026-09-28'])
    assert.deepEqual(c.semanas.map((s) => s.tokens), [50, 110])
    assert.deepEqual(c.semanas.map((s) => s.diasAtivos), [1, 2])
    assert.equal(c.horasPorDiaAtivo, 3)
    assert.equal(c.tokensPorSemanaMediana, 80)
    assert.equal(c.horasDele, 'aberto')
  })

  /* ---- CC-901 C2 a C4: tudo em pasta temporária; nada de backlog ou abrigo de verdade ---- */
  const item = (id, extra = {}) => ({ id, titulo: id, estado: 'B1', frente: 'login', criado: '2026-09-01', tamanho: 'M', pronto: 'pronto escrito aqui', conferir: 'auto:node x.mjs', ...extra })
  const fechado = (id, tamanho, dia, extra = {}) => item(id, { estado: 'OK', tamanho, fechado: dia, prova: 'ok', ...extra })

  t('escolher respeita a ordem e a capacidade, e o primeiro sempre entra', () => {
    const fila = [item('CC-1', { tamanho: 'G' }), item('CC-2', { tamanho: 'P' }), item('CC-3', { tamanho: 'P' })]
    assert.deepEqual(escolher(fila, { capacidade: 3, custoDe: (i) => PONTOS[i.tamanho] }).map((i) => i.id), ['CC-1'])
    assert.deepEqual(escolher(fila, { capacidade: 9, custoDe: (i) => PONTOS[i.tamanho] }).map((i) => i.id), ['CC-1', 'CC-2'])
    assert.deepEqual(escolher(fila, { capacidade: 10, custoDe: (i) => PONTOS[i.tamanho] }).map((i) => i.id), ['CC-1', 'CC-2', 'CC-3'])
  })
  t('previsao passa para medido só com 5 amostras de cada tamanho', () => {
    const mk = (tam, n) => Array.from({ length: n }, (_, k) => fechado(`CC-${tam}${k}`, tam, '2026-09-01'))
    const itens = [...mk('P', 5), ...mk('M', 5), ...mk('G', 4)]
    const custos = new Map(itens.map((i, k) => [i.id, 100 * (k + 1)]))
    const a = previsao(itens, custos)
    assert.equal(a.P.tokens > 0, true); assert.equal(a.G.tokens, null); assert.equal(a.G.n, 4); assert.equal(a.fonte, 'pontos')
    const b = previsao([...itens, fechado('CC-G9', 'G', '2026-09-01')], new Map([...custos, ['CC-G9', 50]]))
    assert.equal(b.fonte, 'medido')
  })
  t('janelaDe tem 7 dias exatos, na âncora e na segunda', () => {
    const anc = new Date(2026, 9, 7, 15).getTime()
    const j = janelaDe(anc + 3 * 864e5, anc)
    assert.equal(j.de, anc); assert.equal(j.ate - j.de, 7 * 864e5)
    assert.equal(janelaDe(anc + 7 * 864e5, anc).de, anc + 7 * 864e5) // na virada, a janela nova
    assert.equal(janelaDe(anc - 1, anc).ate, anc)
    const seg = janelaDe(new Date(2026, 9, 4, 12).getTime(), null) // domingo 04/10
    assert.equal(new Date(seg.de).getDay(), 1); assert.equal(Math.round((seg.ate - seg.de) / 864e5), 7)
  })
  t('velocidade usa a mediana das janelas com trabalho e ignora micro tarefa', () => {
    const j = [0, 1, 2, 3, 4].map((k) => ({ de: new Date(2026, 8, 7 + 7 * k).getTime(), ate: new Date(2026, 8, 14 + 7 * k).getTime() }))
    const itens = [fechado('CC-1', 'G', '2026-09-08'), fechado('CC-2', 'M', '2026-09-16'), fechado('CC-3', 'P', '2026-09-23'), fechado('CC-4', 'M', '2026-09-24'),
      fechado('CC-5', 'G', '2026-09-09', { pai: 'CC-1' }), fechado('CC-6', 'G', '2026-09-30', { pai: 'CC-1' })]
    assert.equal(velocidade(itens, j), 4) // janelas com 8, 3 e 4 pontos (as filhas não contam): mediana 4
    assert.equal(velocidade([], j), 10) // sem histórico
  })
  t('custosDoRobo soma só as mensagens do claude, por item pai', () => {
    const itens = [item('CC-1'), { ...item('CC-2'), pai: 'CC-1', estado: 'OK', conversa: 'c1' }, { ...item('CC-3'), pai: 'CC-1', estado: 'OK', conversa: 'c2' }, { ...item('CC-4'), pai: 'CC-1', estado: 'EM', conversa: 'c3' }]
    const msg = { c1: [{ de: 'claude', custo: { saida: 10, cacheCriado: 5, cacheLido: 9999 } }, { de: 'felipe', custo: { saida: 1000 } }], c2: [{ de: 'claude', custo: { saida: 1, cacheCriado: 1 } }], c3: [{ de: 'claude', custo: { saida: 777 } }] }
    assert.deepEqual([...custosDoRobo(itens, (id) => msg[id])], [['CC-1', 17]])
  })
  t('metaDoSprint pega a parte do mapa com mais pontos', () => {
    const produto = { partes: [{ codigo: 'login' }, { codigo: 'pagar' }] }
    const l = [item('CC-1', { frente: 'login', tamanho: 'P' }), item('CC-2', { frente: 'pagar', tamanho: 'G' }), item('CC-3', { frente: 'outra', tamanho: 'G' })]
    assert.equal(metaDoSprint(l, produto), 'pagar')
    assert.equal(metaDoSprint(l, null), null)
    assert.equal(metaDoSprint([l[2]], produto), null)
  })
  t('montar dá passados, atual e previstos com os itens certos', () => {
    const agora = new Date(2026, 8, 30, 12).getTime() // quarta; a janela atual (segunda) começa em 28/09
    const itens = [fechado('CC-1', 'M', '2026-09-22'), fechado('CC-2', 'P', '2026-09-29'), item('CC-3', { tamanho: 'M', criado: '2026-09-02' }), item('CC-4', { tamanho: 'M', criado: '2026-09-03' }), item('CC-5', { tamanho: 'G', criado: '2026-09-04' }), item('CC-6', { tamanho: 'M', criado: '2026-09-05' })]
    const prev = previsao(itens, new Map())
    const m = montar(itens, { agora, ancora: null, previsao: prev, capacidade: 7, gravados: [], custos: new Map() })
    assert.deepEqual(m.passados.map((s) => s.itens.map((i) => i.id)), [['CC-1']])
    assert.deepEqual(m.atual.itens.map((i) => i.id), ['CC-2', 'CC-3', 'CC-4']) // feito agora (1) + 3 + 3 = 7
    assert.deepEqual(m.previstos.map((s) => s.itens.map((i) => i.id)), [['CC-5'], ['CC-6']])
    assert.deepEqual(m.atual.previsto, { pontos: 7, tokens: null })
    assert.equal(m.previstos[0].n, m.atual.n + 1)
  })

  /* caminhoPorSprint num projeto temporário: formato do caminhoDe e gravação preguiçosa de uma linha só */
  const raiz = path.join(casa, 'VPS_demo'); fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  const agoraC = new Date(2026, 8, 30, 12).getTime()
  const itensC = [fechado('CC-1', 'M', '2026-09-22'), fechado('CC-2', 'P', '2026-09-29'), item('CC-3', { tamanho: 'M', criado: '2026-09-02' }), item('CC-4', { tamanho: 'G', criado: '2026-09-03' })]
  fs.writeFileSync(path.join(raiz, 'docs', 'backlog.jsonl'), itensC.map((i) => JSON.stringify(i)).join('\n') + '\n')
  const opc = { ancora: null, produto: null, lerMensagens: () => [], gravar: true }
  t('caminhoPorSprint devolve o formato do caminhoDe, com sprint.estado, e grava abrir uma vez só', () => {
    const c = caminhoPorSprint(raiz, agoraC, opc)
    assert.equal(c.ok, true); assert.equal(c.por, 'sprint'); assert.equal(c.avisoGravacao, undefined)
    for (const k of ['trechos', 'atual', 'marcos', 'pct', 'feitos', 'total']) assert.ok(k in c, k)
    assert.deepEqual(c.trechos.map((x) => x.sprint.estado), ['passado', 'atual', 'previsto'])
    assert.equal(c.trechos[c.atual].sprint.estado, 'atual')
    assert.match(c.trechos[0].descricao, /^\d\d\/\d\d a \d\d\/\d\d/)
    assert.equal(c.trechos[0].completo, true)
    for (const k of ['chave', 'frente', 'descricao', 'total', 'feitos', 'completo', 'itens']) assert.ok(k in c.trechos[1], k)
    caminhoPorSprint(raiz, agoraC, opc)
    const linhas = fs.readFileSync(path.join(raiz, 'docs', 'sprints.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    assert.equal(linhas.filter((l) => l.tipo === 'abrir').length, 1)
  })
  t('semana seguinte fecha a anterior uma vez e abre a nova', () => {
    const depois = agoraC + 7 * 864e5
    caminhoPorSprint(raiz, depois, opc); caminhoPorSprint(raiz, depois, opc)
    const linhas = fs.readFileSync(path.join(raiz, 'docs', 'sprints.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    assert.equal(linhas.filter((l) => l.tipo === 'fechar').length, 1)
    assert.equal(linhas.filter((l) => l.tipo === 'abrir').length, 2)
    assert.deepEqual(linhas.find((l) => l.tipo === 'fechar').feitos, ['CC-2'])
  })
  t('falha de gravação não é engolida', () => {
    const r2 = path.join(casa, 'VPS_ro'); fs.mkdirSync(path.join(r2, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(r2, 'docs', 'backlog.jsonl'), JSON.stringify(item('CC-1')) + '\n')
    fs.mkdirSync(path.join(r2, 'docs', 'sprints.jsonl')) // diretório no lugar do arquivo: o append falha
    const err = console.error; let ouviu = ''; console.error = (m) => { ouviu += m }
    try { const c = caminhoPorSprint(r2, agoraC, opc); assert.match(c.avisoGravacao, /não consegui gravar/) } finally { console.error = err }
    assert.match(ouviu, /\[sprint\]/)
  })

  /* C4 */
  t('contaDaSemana: % esperada com histórico e resumo falsos, e semMedida sem histórico', () => {
    const agoraS = new Date(2026, 9, 4, 12).getTime()
    const reset = new Date(2026, 9, 1, 0).getTime() // a semana completa terminou em 01/10
    const hist = [{ em: reset - 8 * 864e5, semana: 5, semanaReset: reset }, { em: reset - 1000, semana: 50, semanaReset: reset }]
    const resumoFn = () => ({ projetos: [{ usoDias: [{ dia: '2026-09-28', output: 4000, escrita5m: 500, escrita1h: 500, leitura: 1e9 }] }] }) // 5000 úteis para 50% = 100 por ponto
    const cam = (estado, previsto, fonte) => () => ({ ok: true, trechos: [{ sprint: { estado, previsto, fonte } }] })
    const uso = { semana: { pct: 33 } }
    const c = contaDaSemana(['/x/VPS_a'], { uso, hist, resumoFn, agora: agoraS, caminhoFn: cam('atual', { pontos: 9, tokens: 2000 }, 'medido') })
    assert.equal(c.pctPrevisto, 20); assert.equal(c.pctAgora, 33); assert.equal(c.semMedida, false); assert.equal(c.estimadoPor, 'VPS')
    const p = contaDaSemana(['/x/VPS_a'], { uso, hist, resumoFn, agora: agoraS, caminhoFn: cam('atual', { pontos: 9, tokens: null }, 'pontos') })
    assert.equal(p.pctPrevisto, null); assert.equal(p.previsto.pontos, 9); assert.equal(p.previsto.projetosEmPontos, 1)
    const s = contaDaSemana(['/x/VPS_a'], { uso, hist: [], resumoFn, agora: agoraS, caminhoFn: cam('atual', { pontos: 9, tokens: 2000 }, 'medido') })
    assert.equal(s.semMedida, true); assert.equal(s.pctPrevisto, null)
  })

  /* ---- CC-937: data real dos itens fechados em lote; tudo em pasta temporária, com git temporário ---- */
  t('diaDoLote exige 10 migrados no mesmo dia', () => {
    const mig = (n, d) => Array.from({ length: n }, (_, k) => fechado(`CC-${d}${k}`, 'M', d, { origem: 'migrado-do-roadmap' }))
    assert.equal(diaDoLote([...mig(12, '2026-09-11'), ...mig(3, '2026-09-20')]), '2026-09-11')
    assert.equal(diaDoLote(mig(9, '2026-09-11')), null)
  })
  t('datasNoTexto lê DD/MM, DD/MM/AA e recusa dia que não existe', () => {
    assert.deepEqual(datasNoTexto('provado em 10/09', '2026-09-11'), ['2026-09-10'])
    assert.deepEqual(datasNoTexto('25/12', '2026-09-11'), ['2025-12-25'])
    assert.deepEqual(datasNoTexto('10/09/25', '2026-09-11'), ['2025-09-10'])
    assert.deepEqual(datasNoTexto('31/02', '2026-09-11'), [])
    // o texto escrito no próprio dia da migração vale (19 itens do cockpit dizem "11/09")
    assert.deepEqual(datasNoTexto('provado em 11/09', '2026-09-11'), ['2026-09-11'])
    assert.deepEqual(dataReal({ id: 'CC-77', estado: 'OK', fechado: '2026-09-11', criado: '2026-08-10', prova: 'provado em 11/09' }, { lote: '2026-09-11' }), { dia: '2026-09-11', fonte: 'texto' })
    assert.equal(idNormal('CC-042'), 'CC-42')
  })
  const hist = path.join(casa, 'VPS_hist'); fs.mkdirSync(path.join(hist, 'docs', 'diario'), { recursive: true })
  const git = (args, d) => execFileSync('git', ['-C', hist, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], { stdio: 'ignore', env: { ...process.env, GIT_AUTHOR_DATE: d, GIT_COMMITTER_DATE: d } })
  execFileSync('git', ['init', '-q', hist], { stdio: 'ignore' })
  git(['commit', '-q', '--allow-empty', '-m', 'feito CC-10'], '2026-08-25T12:00:00')
  git(['commit', '-q', '--allow-empty', '-m', 'feat: CC-13 depois do lote'], '2026-09-12T12:00:00')
  fs.writeFileSync(path.join(hist, 'docs', 'diario', '2026-08-20.md'), 'fechei o CC-9 hoje\n')
  const mig = (id, extra = {}) => item(id, { estado: 'OK', tamanho: 'M', origem: 'migrado-do-roadmap', criado: '2026-09-11', fechado: '2026-09-11', ...extra })
  const itensH = [
    ...Array.from({ length: 8 }, (_, k) => mig(`CC-${k + 1}`)),
    mig('CC-9', { criado: '2026-08-10' }), mig('CC-010', { criado: '2026-08-10' }),
    mig('CC-11', { criado: '2026-08-10', prova: 'provado no PC em 22/08' }),
    mig('CC-12', { criado: '2026-08-18' }),
    mig('CC-13', { criado: '2026-08-10', prova: '3/4 das telas' }),
    item('CC-14', { estado: 'OK', origem: 'felipe', criado: '2026-09-30', fechado: '2026-10-01' }),
    item('CC-15'),
  ]
  const arqH = path.join(hist, 'docs', 'backlog.jsonl')
  fs.writeFileSync(arqH, itensH.map((i) => JSON.stringify(i)).join('\n') + '\n')
  const optH = { gravar: false, ancora: null, produto: null, lerMensagens: () => [] }
  const agoraH = new Date(2026, 9, 6, 12).getTime()
  t('comDataReal acha a data de cada item, na ordem texto, registro, criado, sem data', () => {
    const r = Object.fromEntries(comDataReal(hist, itensH).map((i) => [idNormal(i.id), i]))
    assert.deepEqual([r['CC-9'].fonteData, r['CC-9'].fechado], ['registro', '2026-08-20'])
    assert.deepEqual([r['CC-10'].fonteData, r['CC-10'].fechado], ['registro', '2026-08-25'])
    assert.deepEqual([r['CC-11'].fonteData, r['CC-11'].fechado], ['texto', '2026-08-22'])
    assert.deepEqual([r['CC-12'].fonteData, r['CC-12'].fechado], ['criado', '2026-08-18'])
    assert.deepEqual([r['CC-13'].fonteData, r['CC-13'].fechado], ['criado', '2026-08-10']) // o commit depois do lote não vale
    assert.equal(r['CC-14'].fechado, '2026-10-01'); assert.equal(r['CC-14'].fonteData, undefined)
    assert.equal(r['CC-1'].semData, true); assert.equal(r['CC-1'].fechado, '2026-09-11')
    assert.equal(dataReal(itensH[0], { lote: null }).fonte, 'gravada')
  })
  t('caminhoPorSprint põe o sem data em "Antes do histórico", sem reescrever o backlog', () => {
    const antes = fs.readFileSync(arqH, 'utf8')
    const c = caminhoPorSprint(hist, agoraH, optH)
    assert.equal(c.trechos[0].chave, 'antes'); assert.equal(c.trechos[0].frente, 'Antes do histórico'); assert.equal(c.trechos[0].total, 8)
    assert.ok(c.trechos.slice(1).every((x) => x.total < 8))
    const ns = c.trechos.slice(1).map((x) => x.sprint.n)
    assert.deepEqual(ns, [...new Set(ns)].sort((a, b) => a - b))
    assert.equal(fs.readFileSync(arqH, 'utf8'), antes)
    assert.equal(fs.existsSync(path.join(hist, 'docs', 'sprints.jsonl')), false)
  })
  t('o número do sprint sai da janela, não da linha gravada', () => {
    const cur = janelaDe(agoraH, null)
    fs.writeFileSync(path.join(hist, 'docs', 'sprints.jsonl'), JSON.stringify({ tipo: 'abrir', n: 4, de: new Date(cur.de).toISOString(), ate: new Date(cur.ate).toISOString(), itens: ['CC-15'], previsto: { pontos: 3, tokens: null }, fonte: 'pontos', meta: null }) + '\n')
    const c = caminhoPorSprint(hist, agoraH, optH)
    const esperado = Math.round((cur.de - new Date(2026, 7, 10).getTime()) / (7 * 864e5)) + 1 // a semana mais antiga é a de 10/08
    assert.equal(c.trechos[c.atual].sprint.n, esperado); assert.notEqual(esperado, 4)
    const ns = c.trechos.slice(1).map((x) => x.sprint.n)
    assert.equal(new Set(ns).size, ns.length)
  })
  t('CC-958: o lugar manda no sprint e a ordem do Caminho é a ordem da fila', () => {
    const agora = new Date(2026, 9, 7, 12).getTime()
    const cur = janelaDe(agora, null)
    const lug = (onde) => ({ lugar: { onde, em: new Date(2026, 9, 7, 9).toISOString() } })
    const dia = (n) => `2026-09-0${n}`
    const itens = [
      item('CC-1', { criado: dia(1) }), item('CC-2', { criado: dia(2) }), item('CC-3', { criado: dia(3), ...lug('agora') }),
      item('CC-4', { criado: dia(4), ...lug('backlog') }), item('CC-5', { criado: dia(5), titulo: '(depois do MVP) importar' }),
      item('CC-6', { criado: dia(6), ...lug('sprint') }), item('CC-7', { criado: dia(7), estado: 'B0' }),
    ]
    const row = { tipo: 'abrir', n: 1, de: new Date(cur.de).toISOString(), ate: new Date(cur.ate).toISOString(), itens: ['CC-1', 'CC-4', 'CC-5'] }
    const m = montar(itens, { agora, ancora: null, previsao: previsao(itens, new Map()), capacidade: 3, gravados: [row], custos: new Map() })
    assert.deepEqual(m.ordem.map((i) => i.id), ['CC-3', 'CC-1', 'CC-6', 'CC-2', 'CC-4'])
    assert.deepEqual(m.atual.itens.map((i) => i.id).sort(), ['CC-1', 'CC-3', 'CC-6'])
    assert.deepEqual(m.fimDoBacklog.map((i) => i.id), ['CC-4'])
    for (const p of m.previstos) for (const i of p.itens) assert.ok(!['CC-4', 'CC-5', 'CC-7'].includes(i.id), i.id)
    // o mesmo, pelo caminhoPorSprint num projeto de mentira
    const r2 = path.join(casa, 'VPS_lugar'); fs.mkdirSync(path.join(r2, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(r2, 'docs', 'backlog.jsonl'), itens.map((i) => JSON.stringify(i)).join('\n') + '\n')
    fs.writeFileSync(path.join(r2, 'docs', 'sprints.jsonl'), JSON.stringify(row) + '\n')
    const c = caminhoPorSprint(r2, agora, { ancora: null, produto: null, lerMensagens: () => [], gravar: false })
    const at = c.trechos[c.atual]
    assert.deepEqual(at.itens.map((i) => i.id), ['CC-3', 'CC-1', 'CC-6'])
    assert.equal(at.itens[0].lugarRot, 'agora')
    assert.equal(c.trechos.at(-1).chave, 'fim'); assert.deepEqual(c.trechos.at(-1).itens.map((i) => i.id), ['CC-4'])
    assert.deepEqual(c.foraDoMvp.itens.map((i) => i.id), ['CC-5'])
    assert.deepEqual(c.ideiasSemLugar.itens.map((i) => i.id), ['CC-7'])
    assert.equal(c.total, 5)
    assert.equal(c.lugares.length, 5)
  })
} finally { fs.rmSync(casa, { recursive: true, force: true }) }
console.log('\n0 falhas (sprint)')
