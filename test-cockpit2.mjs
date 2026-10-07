// O motor do cockpit 2: a fala do agente, a presença e a montagem do modelo.
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { falaDasLinhas, montar, avisoDoAgente, semanaDe, semanaDosBlocos, conversaSemFala, ehPastaPessoal, resumoDaFala, falasDaConversa, _internals } from './src/cockpit2.mjs'
import { primeiraFrase, paragrafoDepois } from './src/projetoResumo.mjs'
import { contextoDaConversa } from './src/resumoAgy.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok += 1; console.log(`  ok  ${nome}`) }

const linha = (o) => JSON.stringify(o)
const assistente = (content, extra = {}) => linha({ type: 'assistant', timestamp: '2026-09-11T06:00:00Z', message: { content }, ...extra })
const usuario = (texto) => linha({ type: 'user', message: { content: texto }, promptSource: 'terminal' })

t('a última fala com AskUserQuestion vira pergunta com opções', () => {
  const txt = [
    usuario('faz o deploy'),
    assistente([{ type: 'text', text: 'Antes de subir preciso saber uma coisa.' }, { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [{ question: 'Subo com ou sem a migração do banco?', options: [{ label: 'Com migração' }, { label: 'Sem migração' }] }] } }]),
  ].join('\n')
  const f = falaDasLinhas(txt)
  assert.equal(f.tipo, 'pergunta')
  assert.equal(f.texto, 'Subo com ou sem a migração do banco?')
  assert.deepEqual(f.opcoes, ['Com migração', 'Sem migração'])
})

t('fala sem pergunta devolve a primeira frase, curta', () => {
  const longa = 'Terminei a leitura dos 40 arquivos e não achei nada errado. Depois disso fui olhar o servidor. E mais coisa.'
  const f = falaDasLinhas([usuario('olha'), assistente([{ type: 'text', text: longa }])].join('\n'))
  assert.equal(f.tipo, 'fala')
  assert.equal(f.texto, 'Terminei a leitura dos 40 arquivos e não achei nada errado.')
})

t('a régua de traços e o marcador de resumo não viram fala', () => {
  const txt = '---------------------------------- // resumo // ----------------------------------\n\nOs dois que eu podia fazer sozinho estão prontos. Falta o deploy.'
  assert.equal(_internals.primeiraFrase(txt), 'Os dois que eu podia fazer sozinho estão prontos.')
  assert.equal(_internals.primeiraFrase('Raciocínio antes do marcador. Depois vem o resto.'), 'Raciocínio antes do marcador.')
  assert.equal(_internals.primeiraFrase('## Título\n---\nA frase de verdade vem aqui.'), 'Título A frase de verdade vem aqui.')
})

t('fala de sub-agente e linha cortada da cauda são ignoradas', () => {
  const txt = [
    '{"type":"assistant","message":{"content":[{"type":"text","text":"cortada',
    assistente([{ type: 'text', text: 'de um sub-agente' }], { isSidechain: true }),
    assistente([{ type: 'text', text: 'a de verdade.' }]),
    usuario('ok'),
  ].join('\n')
  assert.equal(falaDasLinhas(txt, { parcial: true }).texto, 'a de verdade.')
  assert.equal(falaDasLinhas('', { parcial: true }), null)
})

const agora = 1_000_000_000
const job = (extra) => ({ id: 'j1', project: 'VPS_inovallbond', status: 'waiting', updatedAt: agora - 60_000, subject: 'deploy do pierre', frente: 'Pierre', model: 'sonnet', ...extra })

t('aviso: pergunta do agente vira o texto do cartão, nunca o assunto', () => {
  const a = avisoDoAgente(job(), { tipo: 'pergunta', texto: 'Subo?', opcoes: ['sim', 'não'], quantas: 1 }, 'alienware', agora)
  assert.equal(a.rotulo, 'pergunta')
  assert.equal(a.pergunta, 'Subo?')
  assert.deepEqual(a.opcoes, ['sim', 'não'])
  assert.equal(a.projeto, 'inovallbond')
  assert.equal(a.desdeMs, 60_000)
})

t('aviso: sem fala legível diz "parou sem perguntar", e bloqueio vence tudo', () => {
  assert.equal(avisoDoAgente(job(), null, 'x', agora).rotulo, 'parou sem perguntar')
  const b = avisoDoAgente(job({ blockers: ['falta a senha da VPS'] }), { tipo: 'pergunta', texto: 'x' }, 'x', agora)
  assert.equal(b.rotulo, 'travado')
  assert.equal(b.pergunta, 'falta a senha da VPS')
})

t('montar: o mesmo projeto em duas grafias vira UM, com presença', () => {
  const d = montar({
    jobs: [job(), job({ id: 'j2', project: 'pc_inovallbond', status: 'working', inFlight: [{ label: 'Edit' }] })],
    servers: [{ pid: 1, ports: [3000], kind: 'next', project: 'inovallbond', dev: true, startedAt: agora - 5000, url: 'http://localhost:3000' },
      { pid: 2, ports: [1026], name: 'services.exe', protegido: true }],
    containers: [{ nome: 'inovallbond-db', imagem: 'postgres', status: 'Up', portas: ['127.0.0.1:5432->5432/tcp'], rodando: true }],
    tarefas: [{ id: 't1', texto: 'decidir o deploy', projeto: 'inovallbond', em: agora - 86_400_000, feito: false }, { id: 't2', texto: 'feita', projeto: 'inovallbond', feito: true }],
    local: { id: 'm1', nome: 'alienware' }, agora,
    falaDe: () => ({ tipo: 'pergunta', texto: 'Subo?', opcoes: ['sim'], quantas: 1 }),
  })
  assert.equal(d.projetos.length, 1)
  const p = d.projetos[0]
  assert.equal(p.chave, 'inovallbond')
  assert.deepEqual(p.presenca, ['alienware'])
  assert.equal(p.sessoes.length, 2)
  assert.equal(p.servicos.length, 2, 'porta dev + container; o processo protegido fica de fora')
  assert.equal(p.espera.length, 2, 'a pergunta do agente e a pendência dele')
  assert.equal(p.espera[0].tipo, 'pendencia', 'a mais antiga primeiro')
  assert.equal(p.frenteEmCurso, 'Pierre')
  assert.equal(d.rodando.length, 1)
  assert.equal(d.rodando[0].ferramenta, 'Edit')
  assert.equal(d.servicos.length, 2)
  assert.equal(d.resumo.espera, 2)
})

t('26/09, Semana: relógio é a união, agente é a soma, e o dia vira à meia-noite de Brasília', () => {
  const H = 3600e3
  const ag = Date.parse('2026-09-26T08:00:00Z') // 05h de Brasília
  const s = {
    a: { cwd: '/p/VPS_a', blocos: [[ag - 4 * H, ag - 1 * H]] }, // 01h às 04h, dia 26
    b: { cwd: '/p/VPS_b', blocos: [[ag - 3 * H, ag - 2 * H]] }, // 02h às 03h, em paralelo
    c: { cwd: '/p/VPS_a', blocos: [[Date.parse('2026-09-26T01:00:00Z'), Date.parse('2026-09-26T02:00:00Z')]] }, // 22h de Brasília, dia 25
  }
  const r = semanaDosBlocos(s, { agora: ag })
  const [d25, d26] = r.dias.slice(-2)
  assert.deepEqual([d25.dia, d25.ms / H, d25.relogioMs / H], ['2026-09-25', 1, 1], 'às 22h de Brasília ainda é dia 25; o corte de Londres jogava no 26')
  assert.deepEqual([d26.ms / H, d26.relogioMs / H], [4, 3], 'duas sessões em paralelo somam 4h de agente em 3h de relógio')
})

t('26/09: sessão DESTA máquina carimbada com origem dá a pasta ao projeto; a de outra máquina, não', () => {
  const d = montar({
    jobs: [
      job({ id: 'l', project: 'a', cwd: '/proj/a', origem: { id: 'm1', nome: 'vps' } }),
      job({ id: 'f', project: 'b', cwd: 'D:\\proj\\b', origem: { id: 'pc', nome: 'pc' } }),
    ],
    local: { id: 'm1', nome: 'vps' }, agora, falaDe: () => null,
  })
  const raiz = Object.fromEntries(d.projetos.map((p) => [p.chave, p.raiz]))
  assert.equal(raiz.a, '/proj/a', 'o carimbo de origem da própria máquina apagava a pasta (e a fila de ideias nunca era lida)')
  assert.ok(!raiz.b, 'pasta de outra máquina não pode virar raiz aqui')
})

t('26/09: pergunta entra NA HORA, parada sem pergunta há mais de 2h sai, e cartão fechado some', () => {
  const PERG = { tipo: 'pergunta', texto: 'Publico?', opcoes: ['sim'], quantas: 1, em: 'p1' }
  const FALA = (em) => ({ tipo: 'fala', texto: 'terminei', opcoes: [], quantas: 0, em })
  const base = { agora, tarefas: [] }
  // 1. trabalhando há segundos, com a pergunta aberta: entra já
  let d = montar({ ...base, jobs: [job({ id: 'a', status: 'working', updatedAt: agora - 5000 })], falaDe: () => PERG })
  assert.deepEqual(d.espera.map((e) => e.rotulo), ['pergunta'], 'pergunta esperava 1 minuto de silêncio para aparecer')
  // 2. parada sem pergunta há 3h: sai, e sai contada
  d = montar({ ...base, jobs: [job({ id: 'b', status: 'waiting', updatedAt: agora - 3 * 3600_000 })], falaDe: () => FALA('f1') })
  assert.equal(d.espera.length, 0, 'travada há 3h continuava nas decisões')
  assert.equal(d.resumo.travadasOcultas, 1)
  // ...mas pergunta de 3h NÃO sai (pergunta pendente não envelhece)
  d = montar({ ...base, jobs: [job({ id: 'c', status: 'idle', updatedAt: agora - 3 * 3600_000 })], falaDe: () => PERG })
  assert.equal(d.espera.length, 1)
  // 3. fechado some; fala nova (outra marca) traz de volta
  const fechadas = new Set(['d::f1'])
  d = montar({ ...base, fechadas, jobs: [job({ id: 'd', status: 'waiting' })], falaDe: () => FALA('f1') })
  assert.equal(d.espera.length, 0)
  assert.equal(d.resumo.fechadasOcultas, 1)
  d = montar({ ...base, fechadas, jobs: [job({ id: 'd', status: 'waiting' })], falaDe: () => FALA('f2') })
  assert.equal(d.espera.length, 1, 'a sessão se mexeu: o cartão é outra decisão e volta')
})

t('26/09: ociosa com fala do agente não some calada; conectadas lista todas; reaberta fica', () => {
  const FALA = { tipo: 'fala', texto: "write 'pode codar' to unblock coding", opcoes: [], quantas: 0, em: 'f1' }
  const base = { agora, tarefas: [] }
  // ociosa recente com fala: é decisão
  let d = montar({ ...base, jobs: [job({ id: 'o1', status: 'idle', updatedAt: agora - 50 * 60_000 })], falaDe: () => FALA })
  assert.equal(d.espera.length, 1, 'ociosa com fala sumia da Decisões')
  // ociosa antiga: vai para as ocultas, marcada, em vez de sumir
  d = montar({ ...base, jobs: [job({ id: 'o2', status: 'idle', updatedAt: agora - 8 * 3600_000 })], falaDe: () => FALA })
  assert.equal(d.espera.length, 0)
  assert.deepEqual(d.ocultas.map((o) => o.oculta), ['antiga'], 'antiga tem que ir para "Fechadas e antigas"')
  // reaberta (mantida) volta mesmo antiga
  d = montar({ ...base, mantidas: new Set(['o2::f1']), jobs: [job({ id: 'o2', status: 'idle', updatedAt: agora - 8 * 3600_000 })], falaDe: () => FALA })
  assert.equal(d.espera.length, 1, 'reaberta sumiu de novo pela idade')
  // 27/09: sessão disparada por programa (claude -p) nunca é decisão nem conectada parada
  d = montar({ ...base, jobs: [job({ id: 'p1', status: 'idle', porPrograma: true, updatedAt: agora - 40 * 60_000 })], falaDe: () => FALA })
  assert.equal(d.espera.length, 0, 'teste rodado por programa virou decisão dele')
  assert.equal(d.conectadas.length, 0)
  // 27/09: programa fechado (fora do registro de abertas) não é conectada nem decisão
  d = montar({ ...base, jobs: [job({ id: 'f1', status: 'idle', aberta: false, updatedAt: agora - 26 * 60_000 })], falaDe: () => FALA })
  assert.equal(d.espera.length, 0, 'sessão fechada seguia como decisão')
  assert.equal(d.conectadas.length, 0, 'sessão fechada seguia como conectada')
  // sem saber (aberta undefined, ex.: a outra máquina), nada muda
  d = montar({ ...base, jobs: [job({ id: 'f2', status: 'idle', updatedAt: agora - 26 * 60_000 })], falaDe: () => FALA })
  assert.equal(d.espera.length, 1)
  // conectadas: trabalhando primeiro, ociosa depois
  d = montar({ ...base, jobs: [job({ id: 'x', project: 'X', status: 'idle', updatedAt: agora - 60_000 }), job({ id: 'y', project: 'Y', status: 'working', updatedAt: agora - 5000 })], falaDe: () => null })
  assert.deepEqual(d.conectadas.map((s) => s.estado), ['trabalhando', 'ociosa'])
})

t('CC-561: pendência de mais de 7 dias vai para a gaveta, sem sumir do projeto; a recente fica nas decisões', () => {
  const dia = 86400_000
  const d = montar({
    jobs: [job({ id: 'j1', project: 'a', status: 'working' })],
    tarefas: [
      { id: 'velha', texto: 'decidir a landing', projeto: 'a', em: agora - 8 * dia },
      { id: 'nova', texto: 'conferir o print', projeto: 'a', em: agora - 1 * dia },
    ],
    agora, falaDe: () => null,
  })
  assert.deepEqual(d.espera.filter((e) => e.tipo === 'pendencia').map((e) => e.id), ['nova'], 'a velha poluía as decisões')
  assert.deepEqual(d.gaveta.map((e) => e.id), ['velha'])
  assert.equal(d.resumo.gaveta, 1)
  assert.deepEqual(d.projetos[0].pendencias.map((e) => e.id).sort(), ['nova', 'velha'], 'no cartão do projeto as duas continuam: gaveta não é apagar')
})

t('CC-556: sessão ociosa há horas com PERGUNTA pendente continua nas decisões; sem pergunta, não', () => {
  const PERG = { tipo: 'pergunta', texto: 'Publico hoje?', opcoes: ['sim', 'não'], quantas: 1 }
  const d = montar({
    jobs: [
      job({ id: 'perg', project: 'a', status: 'idle', updatedAt: agora - 3 * 3600_000 }),
      job({ id: 'muda', project: 'b', status: 'idle', updatedAt: agora - 3 * 3600_000 }),
    ],
    agora, falaDe: (j) => (j.id === 'perg' ? PERG : { tipo: 'fala', texto: 'terminei', opcoes: [], quantas: 0 }),
  })
  assert.deepEqual(d.espera.map((e) => e.id), ['perg'], 'a pergunta de 3h atrás some da Início se a idade vencer')
  assert.equal(d.espera[0].rotulo, 'pergunta')
})

t('federado: o mesmo projeto nas duas máquinas vira UM, com as duas presenças', () => {
  const d = montar({
    jobs: [
      job({ id: 'aqui', project: 'inovallbond', status: 'working' }),
      job({ id: 'la', project: 'VPS_inovallbond', status: 'waiting', origem: { id: 'v1', nome: 'vps' }, ultimaFala: { tipo: 'pergunta', texto: 'Subo o deploy?', opcoes: ['sim', 'não'], quantas: 1 } }),
    ],
    servers: [{ pid: 9, ports: [3000], kind: 'next', project: 'inovallbond', origem: { id: 'v1', nome: 'vps' } }],
    maquinas: [{ id: 'm1', nome: 'alienware', local: true }, { id: 'v1', nome: 'vps', semContato: false }],
    local: { id: 'm1', nome: 'alienware' }, agora,
    falaDe: (j) => (j.origem ? j.ultimaFala : null),
  })
  assert.equal(d.projetos.length, 1, 'um projeto só, não dois')
  assert.deepEqual(d.projetos[0].presenca.sort(), ['alienware', 'vps'])
  assert.deepEqual(d.projetos[0].sessoes.map((s) => s.dispositivo).sort(), ['alienware', 'vps'])
  assert.equal(d.projetos[0].servicos[0].dispositivo, 'vps', 'a porta da outra máquina entra com o nome dela')
  assert.deepEqual(d.dispositivos.map((x) => x.nome), ['alienware', 'vps'])
  /* A pergunta que veio no pacote é a que aparece: sem isto o cartão da outra
     máquina só saberia dizer "parou sem perguntar". */
  assert.equal(d.espera[0].rotulo, 'pergunta')
  assert.equal(d.espera[0].pergunta, 'Subo o deploy?')
  assert.equal(d.espera[0].dispositivo, 'vps')
})

t('federado: origem carimbada no que é daqui não abre a porta para processo de sistema', () => {
  /* Ao juntar as duas máquinas, a federação carimba a origem em TODA linha,
     inclusive nas locais. Se "tem origem" contasse como "veio de fora", o
     filtro de serviços deixaria passar processo de sistema: medido, a lista
     ia de 10 para 33 com `mDNSResponder` e `wslrelay` dentro. */
  const eu = { id: 'm1', nome: 'alienware' }
  const d = montar({
    servers: [
      { pid: 1, ports: [5354], name: 'mDNSResponder', origem: eu },
      { pid: 2, ports: [3000], kind: 'next', project: 'ibrics', dev: true, origem: eu },
      { pid: 3, ports: [4000], name: 'algo-de-la', project: 'ibrics', origem: { id: 'v1', nome: 'vps' } },
    ],
    local: eu, agora,
  })
  assert.deepEqual(d.servicos.map((s) => s.porta), [3000, 4000], 'o de sistema fica de fora, o remoto entra')
  assert.equal(d.servicos[1].dispositivo, 'vps')
})

t('federado: máquina calada continua na lista, dita como sem contato', () => {
  const d = montar({
    jobs: [job({ id: 'la', project: 'x', status: 'waiting', origem: { id: 'v1', nome: 'vps', semContato: true } })],
    maquinas: [{ id: 'm1', nome: 'alienware', local: true }, { id: 'v1', nome: 'vps', semContato: true }],
    local: { id: 'm1', nome: 'alienware' }, agora,
  })
  assert.equal(d.dispositivos.length, 2)
  assert.equal(d.dispositivos[1].contato, false)
  assert.deepEqual(d.projetos[0].presenca, [], 'máquina calada não dá presença')
  assert.equal(d.espera.length, 0, 'e não cobra decisão que ele não tem como tomar')
})

t('montar: máquina sem contato e sessão sem sinal não dão presença nem aviso', () => {
  const d = montar({ jobs: [job({ origem: { semContato: true } }), job({ id: 'j3', project: 'x', stale: true })], local: { nome: 'vps' }, agora })
  assert.deepEqual(d.projetos.map((p) => p.presenca), [[], []])
  assert.equal(d.espera.length, 0)
})

t('montar: a pasta de usuário não vira projeto', () => {
  const d = montar({ jobs: [job({ project: 'lfeli.ALIENWARE-LIPE' }), job({ id: 'j9', project: 'ibrics', status: 'working' })], ignorar: ['lfeli.ALIENWARE-LIPE'], agora })
  assert.deepEqual(d.projetos.map((p) => p.chave), ['ibrics'])
  assert.equal(d.espera.length, 0)
})

t('montar: tarefa dele sem projeto entra no que espera, e não some', () => {
  const d = montar({ tarefas: [{ id: 't1', texto: 'decidir o deploy', projeto: null, em: agora - 1000, feito: false }], agora })
  assert.equal(d.espera.length, 1)
  assert.equal(d.espera[0].nome, 'geral')
  assert.equal(d.resumo.pendencias, 1)
  assert.equal(d.resumo.agentesEsperando, 0)
})

t('semana: soma os últimos 7 dias por dia e por projeto, e diz quando não há cache', () => {
  const hoje = new Date(agora).toISOString().slice(0, 10)
  const ontem = new Date(agora - 86_400_000).toISOString().slice(0, 10)
  const velho = new Date(agora - 10 * 86_400_000).toISOString().slice(0, 10)
  const tempo = { projetos: [
    { projeto: 'VPS_inovallbond', dias: [{ dia: hoje, ativoMs: 3_600_000 }, { dia: velho, ativoMs: 99 }] },
    { projeto: 'pc_inovallbond', dias: [{ dia: ontem, ativoMs: 1_800_000 }] },
    { projeto: 'ibrics', dias: [{ dia: hoje, ativoMs: 600_000 }] },
  ] }
  const s = semanaDe(tempo, agora)
  assert.equal(s.disponivel, true)
  assert.equal(s.dias.length, 7)
  assert.equal(s.totalMs, 6_000_000, 'o dia velho fica de fora')
  assert.deepEqual(s.porProjeto.map((p) => [p.chave, p.ms]), [['inovallbond', 5_400_000], ['ibrics', 600_000]])
  assert.equal(semanaDe(null, agora).disponivel, false)
  const d = montar({ jobs: [job({ project: 'ibrics', status: 'working' })], tempo, agora })
  assert.equal(d.projetos[0].ultimos7.length, 7)
  assert.equal(d.projetos[0].ultimos7[6], 600_000)
})

t('montar: vazio de verdade é lista vazia com resumo zerado, nunca exceção', () => {
  const d = montar({})
  assert.deepEqual(d.projetos, [])
  assert.equal(d.resumo.espera, 0)
  assert.equal(d.dispositivos[0].nome, 'esta máquina')
})

t('a ferramenta em voo é cortada: linha de comando inteira quebrava o cartão', () => {
  const gigante = 'cd "D:/Documentos/projetos/cockpit" && node prova.js 2>&1 | grep -E "medido|FALHA" | sed s/x/y/'
  const curta = _internals.ferramentaCurta(gigante)
  assert.ok(curta.length <= 60, `veio com ${curta.length}`)
  assert.ok(curta.endsWith('…'))
  assert.equal(_internals.ferramentaCurta('Edit'), 'Edit')
  assert.equal(_internals.ferramentaCurta(null), '')
  const d = montar({ jobs: [job({ status: 'working', inFlight: [{ label: gigante }] })], agora })
  assert.ok(d.rodando[0].ferramenta.length <= 60)
})

t('tipo e estado da sessão', () => {
  assert.equal(_internals.tipoDaSessao({ tipo: 'interativa', remoto: true }), 'remote control')
  assert.equal(_internals.tipoDaSessao({}), 'claude code (fundo)')
  assert.equal(_internals.estadoDaSessao({ status: 'waiting' }), 'espera você')
  assert.equal(_internals.estadoDaSessao({ status: 'working', stale: true }), 'sem sinal')
})

t('01/10: cartão de tela que se redesenha sozinha não usa content-visibility (fazia a rolagem pular para o topo)', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const regras = [...ui.matchAll(/([^{}\n]*)\{[^}]*content-visibility\s*:\s*auto/g)].map((m) => m[1])
  const ruins = regras.filter((sel) => /c2-aviso|hist-linha|view-decisoes|view-inicio|view-projetos2/.test(sel))
  assert.deepEqual(ruins, [], 'medido: com ele, um cartão novo em Sessões levava a rolagem de 1600 para 115 px')
})

t('01/10: abrir sessão, publicar e as ações dos cartões passam pela bandeja de andamento', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  for (const rota of ['/api/remote-control', '/api/agy-remote-control', '/api/deploy/pedir', '/api/deploy/cadastrar'])
    assert.match(ui, new RegExp("c2Andamento\\([^\\n]*" + rota.replace(/\//g, '\\/')), rota + ' fora da bandeja: ele sai da tela e não sabe se abriu')
  assert.match(ui, /function c2Proc\([^]*?c2AndaInicio\(/, 'as ações dos cartões também aparecem na bandeja')
})

t('CC-527/528: o aviso mostra o item do backlog e o que falta dele; sem item diz "sem item declarado"', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.match(ui, /const c2Trilha = \(e, qa\)/, 'sumiu a linha de item e o que falta dele')
  assert.ok(ui.includes('sem item declarado'), 'o aviso sem item tem que dizer isso com todas as letras')
  assert.match(ui, /\+ c2Trilha\(e, qa\)\s*\n\s*\+ '<div class="c2-perg">'/, 'a linha tem que ficar logo antes da pergunta (projeto, item, o que falta)')
  const c2 = readFileSync(new URL('./src/cockpit2.mjs', import.meta.url), 'utf8')
  assert.ok((c2.match(/item: (j|c|c\?)\.item \|\| null/g) || []).length >= 4, 'o item declarado pela sessão tem que chegar até os cartões')
  const jobs = readFileSync(new URL('./src/jobs.mjs', import.meta.url), 'utf8')
  assert.match(jobs, /item: meta\.item \|\| null/, 'o meta da sessão carrega o item')
})

// CC-493: bloco com await de verdade (o auxiliar t() não espera função assíncrona)
{
  const fs = await import('node:fs'); const os = await import('node:os'); const pathM = await import('node:path')
  const { palpiteDeFrente } = await import('./src/cockpit2.mjs')
  const raiz = fs.mkdtempSync(pathM.join(os.tmpdir(), 'cc-palpite-'))
  fs.mkdirSync(pathM.join(raiz, 'docs'))
  fs.writeFileSync(pathM.join(raiz, 'docs', 'backlog.jsonl'), JSON.stringify({ id: 'CC-1', titulo: 'o coderoom perde a conversa ao trocar de aba', estado: 'B1', frente: 'coderoom' }) + '\n')
  const transcrito = pathM.join(raiz, 't.jsonl')
  fs.writeFileSync(transcrito, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: pathM.join(raiz, 'src', 'coderoom.mjs') } }] } }) + '\n')
  const j = { id: 's1', cwd: raiz, transcript: transcrito, frente: null }
  const p = palpiteDeFrente(j)
  assert.equal(p && p.frente, 'coderoom', 'o palpite sai dos arquivos mexidos contra os itens abertos')
  assert.match(p.porque, /deduzido/)
  assert.equal(palpiteDeFrente({ ...j, frente: 'a que ele declarou' }), null, 'declarada vence: sem palpite')
  const ui = fs.readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('class="c2-palpite"'), 'a tela marca como palpite')
  fs.rmSync(raiz, { recursive: true, force: true })
  t('CC-493: sessão sem frente recebe o palpite deduzido dos arquivos que mexeu; com frente declarada não há palpite', () => {})
}

t('CC-543: projeto só declarado no registro, sem pasta aqui, mostra o botão "criar aqui"', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes("fetch('/api/registro/projetos')"), 'a tela lê o registro de verdade')
  assert.ok(ui.includes('soDeclarado: true') && ui.includes('data-proj-criar-aqui'), 'projeto só declarado entra na lista com o botão')
  assert.match(ui, /post\('\/api\/projeto\/novo', \{ nome \}\)/, 'o botão chama a criação, que clona quando há repositório')
  assert.ok(ui.includes('sem pasta nesta máquina'), 'diz por que o botão aparece')
})

t('CC-878: o capacete é a marca (menu, app instalado, login e Deploy seguro) e o nome é Ogumia', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('id="sbCapacete"') && ui.includes('<h2>OGUMIA</h2>') && !ui.includes('<h2>AGENT COCKPIT</h2>'), 'o topo do menu mostra o capacete e OGUMIA')
  const man = JSON.parse(readFileSync(new URL('./src/app.webmanifest', import.meta.url), 'utf8'))
  assert.equal(man.name, 'Ogumia'); assert.equal(man.short_name, 'Ogumia')
  assert.ok(readFileSync(new URL('./src/icone.svg', import.meta.url), 'utf8').includes('capacete'), 'o ícone do app segue sendo o capacete')
  assert.ok(readFileSync(new URL('./tools/deploy-seguro/deploy-seguro.mjs', import.meta.url), 'utf8').includes('mDeploy'), 'a página do Deploy seguro leva o capacete')
})

t('CC-880: no celular as faixas recolhem uma a uma (Sessões e Projetos)', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('function c2FaixasCtl(') && ui.includes('data-faixa-tudo'), 'sumiu a fileira que recolhe as faixas')
  assert.match(ui, /c2FaixasCtl\('decisoes'/, 'Sessões usa as faixas recolhíveis')
  assert.match(ui, /c2FaixasCtl\('projetos'/, 'Projetos usa as faixas recolhíveis')
  assert.ok(/function c2Estreito|const c2Estreito/.test(ui) && ui.includes("max-width: 700px)').matches"), 'só no celular: no computador nada muda')
  assert.ok(!ui.includes('data-bb-recolher') && !ui.includes('body.barra-mini'), 'CC-966: a barra de baixo saiu, e o recolher com ela')
})

t('CC-881/CC-966: o painel lateral mantém o "Ir para"; a barra de baixo e a chave de fixá-la saíram', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(!ui.includes('barra-oculta') && !ui.includes('data-barra-fixar') && !ui.includes('C2.barraFixa'), 'nada some ao rolar: a faixa do topo é presa')
  assert.ok(ui.includes('function c2IrPara()') && ui.includes('data-lat-ir'), 'o painel lateral ainda lista as telas')
  assert.ok(/latLarga\(\) \? '' : c2IrPara\(\)/.test(ui), 'o "Ir para" só aparece quando o painel é gaveta')
})

t('CC-858: a aba Tarefas tem a caixa de pedido, a lista de pedidos, as tarefas por projeto e a gaveta, e nada disso vaza para o Tudo', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  for (const peca of ["c2PedirHtml()", "c2PedidosHtml()", "c2TarefasPorProjeto(pend)", "['tarefas+', c2Gaveta(D)]"]) assert.ok(ui.includes(peca), 'a aba monta ' + peca)
  assert.ok(ui.includes("blocos.filter(([k]) => !k.endsWith('+'))"), 'o Tudo não mostra os blocos exclusivos da aba')
  assert.ok(ui.includes("fetch('/api/pedidos'") && ui.includes('data-pedido-proj'), 'o pedido vai ao servidor e o projeto é trocável')
  assert.ok(ui.includes('.c2-pedido .c2-voz,.c2-pedido .c2-enviar{width:44px;height:44px'), 'alvos de toque de 44 px')
})

t('CC-884: o cartão do projeto tem commit e push ao lado do deploy, mostra o que vai junto e nunca força', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/salvarGit.mjs', import.meta.url), 'utf8')
  assert.ok(/c2DeployLinha\(p\)\s*\+ c2GitLinha\(p\)/.test(ui), 'a linha do git vem logo depois da do deploy')
  assert.ok(ui.includes('data-git-ok') && ui.includes('O envio não dá para desfazer daqui') && ui.includes('data-git-msg'), 'confirma dizendo a consequência e pede o texto do commit')
  assert.ok(ui.includes('[data-git-abrir],[data-git-ok],[data-git-nao]{min-height:44px;}'), 'alvos de toque de 44 px')
  assert.ok(!/['"](--force|--force-with-lease|--no-verify|-f)['"]/.test(srv),'o push não é forçado e os hooks do repositório não são pulados')
})

t('CC-887: a mesma pergunta do mesmo projeto vira um cartão que abre, e nunca ganha "fechar todas" nem resposta em lote', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes("e.rotulo === 'pergunta' && !!e.pergunta") && ui.includes("String(e.pergunta).trim().toLowerCase()"), 'agrupa por projeto, máquina e texto da pergunta')
  assert.ok(ui.includes("frase: 'sessões fazendo a mesma pergunta'") && ui.includes("fechaveis.length && !g.pergunta"), 'o grupo de perguntas não fecha todas de uma vez')
  assert.ok(ui.includes("(!x.dec.grupo || x.dec.pergunta)"), 'o grupo de perguntas continua aparecendo no filtro Perguntas')
})

t('CC-896: a tela Caminho está no menu, desenha a estrada com marcador e respeita movimento reduzido', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('data-target="view-caminho"') && ui.includes('id="view-caminho"') && ui.includes("'view-caminho': { title: 'Caminho'"), 'menu, tela e título')
  assert.ok(ui.includes("'view-tarefas', 'view-caminho'") && ui.includes("else if (v === 'view-caminho') c2RenderCaminho();"), 'a tela é redesenhada com as outras')
  assert.ok(ui.includes('function c2CaminhoCorpo') && ui.includes('function c2CaminhoPosicionar') && ui.includes('cam-percorrido') && ui.includes('você está aqui'), 'estrada, trecho percorrido e marcador')
  assert.ok(ui.includes('(prefers-reduced-motion: reduce)') && ui.includes('K.animou'), 'a animação roda uma vez e respeita movimento reduzido')
  assert.ok(ui.includes('.cam-no{--i:0;position:absolute') && /\.cam-no\{[^}]*min-height:44px/.test(ui), 'alvos de toque de 44 px')
})

t('CC-901 C3/C4: o Caminho abre em Sprints, lembra a escolha, pede por= e mostra a conta da semana', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('data-cam-por="') && ui.includes("localStorage.setItem('c2-cam-por'") && ui.includes("'&por=' + K.por"), 'seletor Sprints | Frentes, lembrado no aparelho, e a URL leva por=')
  assert.ok(ui.includes("fetch('/api/sprints/conta')") && ui.includes('function camConta()') && ui.includes('ainda sem uma semana inteira medida'), 'a linha da conta, com o caso sem medida dito por extenso')
  assert.ok(ui.includes("K.dados[raiz + '|' + K.por]") || ui.includes('K.dados[ch]'), 'cache de dados por projeto e por agrupamento')
})
t('CC-903: o Caminho tem estrada e lista; tocar na parada abre o painel lateral, que mora no body e some fora da tela', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('data-cam-modo="') && ui.includes("localStorage.setItem('c2-cam-modo'"), 'os dois modos, lembrados no aparelho')
  assert.ok(ui.includes('function camLista(r)') && ui.includes('function camGaveta(r)') && ui.includes('function camItens(t)'), 'lista, painel e itens são uma peça só para os dois modos')
  assert.ok(ui.includes("portal.id = 'cam-portal'; document.body.appendChild(portal)") && ui.includes('body:not(:has(#view-caminho.active)) #cam-portal{display:none;}'), 'o painel não fica preso por ancestral nem por cima de outra tela')
  assert.ok(ui.includes("ev.key === 'Escape' && C2.cam.raiz && C2.cam.gaveta[C2.cam.raiz]"), 'Esc fecha o painel')
})

t('CC-927: o painel lateral do sprint tem a seção Artefatos deste sprint, com feito ou a fazer e letra de 12 px ou mais', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('function camArtefatos(t)') && ui.includes('Artefatos deste sprint') && ui.includes("'<div class=\"cam-gav-corpo\">' + camArtefatos(t) + camItens(t)"), 'a seção entra no painel lateral')
  assert.ok(ui.includes("a.existe ? 'feito' : 'a fazer'") && ui.includes('if (!L.length) return'), 'palavra feito ou a fazer, e some sem artefato')
  const css = ui.match(/\.cam-art[^{]*\{[^}]*\}/g).join('')
  assert.ok(!/font-size:(\d|1[01])px/.test(css), 'nenhuma letra abaixo de 12 px')
})

t('CC-914: o painel recusa a segunda subida do mesmo teste de voo enquanto a primeira está em curso', () => {
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(srv.includes("execFile('pgrep', ['-f', `dev\\\\.sh ${alvo.nome}$`]") && srv.includes('já está subindo'), 'o servidor confere se a subida já roda antes de disparar o script')
  assert.ok(srv.indexOf('já está subindo') < srv.indexOf("spawn(script, [alvo.nome]"), 'a conferência vem antes do disparo')
  assert.ok(ui.includes("/^já está/.test(r.erro || '')") && ui.includes('}, 100000);'), 'a tela mostra a frase certa e espera mais de 60 s')
})

t('CC-915: pendência do backlog só ganha o visto quando o motivo é conferir', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const meu = readFileSync(new URL('./src/meu.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("String(t.id).startsWith('backlog:') && !/^Conferir:/.test(t.pergunta || '')") && ui.includes('responda no Tinder'), 'decisão e trava não têm o visto')
  assert.ok(meu.includes('...doBacklog') && meu.includes("startsWith('backlog:')"), 'a fila lê o backlog e o visto fecha o item de lá')
})

t('CC-916: o Caminho mostra as emendas no topo, na parada e no item', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes("r.emendas ? ', ' + r.emendas + ' de emenda (+' + r.crescimento + '%)'"), 'o número do topo diz quanto o escopo cresceu')
  assert.ok(ui.includes("(t.emendas ? ' · +' + t.emendas + ' emenda'") && ui.includes("chip(t.emendas, t.emendas === 1 ? 'emenda' : 'emendas'") && ui.includes("i.emenda ? ' · emenda: ideia nova no meio do projeto'"), 'parada, chip e item marcados')
})

t('CC-508: agente que entregou não vira cartão de parada', () => {
  const tarefas = [{ text: 'a', done: true }, { text: 'b', done: true }]
  assert.equal(_internals.estadoDaSessao({ status: 'waiting', todos: tarefas, todosDone: 2 }), 'entregou', '6 de 6 tarefas: entregou')
  assert.equal(_internals.estadoDaSessao({ status: 'idle', detail: 'done' }), 'entregou', 'o agente declarou que terminou')
  assert.equal(_internals.estadoDaSessao({ status: 'waiting', todos: tarefas, todosDone: 1 }), 'espera você', 'tarefa aberta: ainda espera')
  assert.equal(_internals.estadoDaSessao({ status: 'working', todos: tarefas, todosDone: 2 }), 'trabalhando', 'trabalhando vence')
  assert.equal(_internals.estadoDaSessao({ status: 'waiting', permissao: true, todos: tarefas, todosDone: 2 }), 'espera você', 'pedido de permissão vence')
})

/* ============ O rótulo de tela é NOME DE COISA, nunca frase ============
 *
 * Decisão dele em 11/09, vendo "quem espera você" no cartão: *"que porra de
 * linguagem essa IA camarada? Quem espera o quê? Quem é esse 'quem'? É um card
 * de tarefas, do projeto, da tarefa tal"*.
 *
 * Este bloco é a metade que acerta sempre: rótulo é texto em arquivo, então a
 * regra é lista de palavra, não julgamento. A outra metade, a minha fala no
 * chat, é a trava `fala-guard`, que pega por padrão e não por juízo.
 */
const UI = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')

/**
 * Palavra que só existe em frase, nunca em nome de coisa.
 *
 * ⚠️ Sem `\b`, e é medido: em JavaScript a fronteira de palavra não conhece
 * letra acentuada, então `\bs[óo]\b` NÃO casa "SÓ VOCÊ RESOLVE" (o acento
 * conta como não-letra, e a fronteira depois dele não existe). A regra passava
 * batido justamente no rótulo que ele recusou. Aqui a vizinhança é declarada.
 */
const DE_FRASE = /(?<![a-zà-ÿ])(que|quem|você|voce|seu|sua|meu|minha|está|esta|espera|precisa|falta|só|no ar|do dia)(?![a-zà-ÿ])/i

const rotulos = [
  ...[...UI.matchAll(/(?:c2Bloco|iniBloco)\('([^']{2,40})'/g)].map((m) => ({ onde: 'bloco do Início', texto: m[1] })),
  ...[...UI.matchAll(/'<h4>([^<'(]{2,40})/g)].map((m) => ({ onde: 'seção do inspetor', texto: m[1] })),
  ...[...UI.matchAll(/<th>([^<]{2,40})<\/th>/g)].map((m) => ({ onde: 'coluna da tabela', texto: m[1] })),
]

t(`rótulo de tela é nome de coisa, não frase (${rotulos.length} conferidos)`, () => {
  assert.ok(rotulos.length >= 15, `esperava achar os rótulos, achei ${rotulos.length}`)
  const ruins = rotulos
    .map((r) => ({ ...r, texto: r.texto.replace(/\s*·\s*$/, '').trim() }))
    .filter((r) => DE_FRASE.test(r.texto) || r.texto.split(/\s+/).length > 3)
  assert.deepEqual(ruins, [], `rótulo em forma de frase:\n${ruins.map((r) => `  "${r.texto}" (${r.onde})`).join('\n')}\nUse o nome da coisa: TAREFAS, SESSÕES, DECISÕES, SERVIÇOS.`)
})

t('a regra do rótulo pega o caso que ele recusou (prova negativa)', () => {
  assert.ok(DE_FRASE.test('QUEM ESPERA VOCÊ'), 'a regra tem que pegar o rótulo que ele recusou')
  assert.ok(DE_FRASE.test('O QUE ESTÁ RODANDO'))
  assert.ok(DE_FRASE.test('SÓ VOCÊ RESOLVE'))
  assert.ok(!DE_FRASE.test('DECISÕES'))
  assert.ok(!DE_FRASE.test('SERVIÇOS'))
  assert.ok(!DE_FRASE.test('SEMANA'))
})

t('descrição do projeto: primeira frase da seção Projeto, sem marcação', () => {
  const md = '# x\n\n## Projeto\n> citação que não conta\n\nPainel dos **agentes** do `Claude`. Segunda frase.\n\n## Outra\ntexto'
  assert.equal(primeiraFrase(paragrafoDepois(md, /^##\s+Projeto\b/i)), 'Painel dos agentes do Claude.')
  assert.equal(paragrafoDepois('## Outra\nnada', /^##\s+Projeto\b/i), null, 'sem a seção, não inventa')
  assert.equal(primeiraFrase(''), null)
  assert.ok(primeiraFrase('a'.repeat(300)).length <= 160, 'frase longa é cortada')
})

t('27/09: pergunta já respondida (tool_result depois dela) não volta como pergunta', () => {
  const perg = JSON.stringify({ type: 'assistant', timestamp: 't1', message: { content: [{ type: 'tool_use', name: 'AskUserQuestion', id: 'q1', input: { questions: [{ question: 'Logo?', options: [{ label: 'A' }] }] } }] } })
  const resp = JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'q1', content: 'A' }] } })
  assert.equal(falaDasLinhas(perg).tipo, 'pergunta', 'sem resposta, é pergunta')
  const f = falaDasLinhas(perg + '\n' + resp)
  assert.notEqual(f.tipo, 'pergunta', 'respondida no terminal seguia como pergunta')
  assert.equal(f.respondida, true)
})

t('CC-596: a pergunta traz o contexto (o que o agente disse antes) e a explicação de cada opção', () => {
  const ele = JSON.stringify({ type: 'user', message: { content: 'faz o logo' } })
  const a1 = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Montei três propostas de logo.' }] } })
  const perg = JSON.stringify({ type: 'assistant', timestamp: 't', message: { content: [{ type: 'text', text: 'Sugiro A.' }, { type: 'tool_use', name: 'AskUserQuestion', id: 'q9', input: { questions: [{ question: 'Qual logo?', options: [{ label: 'A', description: 'empilhado' }, { label: 'B', description: 'em linha' }] }] } }] } })
  const f = falaDasLinhas([ele, a1, perg].join('\n'))
  assert.equal(f.tipo, 'pergunta')
  assert.match(f.contexto, /três propostas/)
  assert.match(f.contexto, /Sugiro A/)
  assert.deepEqual(f.perguntas[0].descricoes, ['empilhado', 'em linha'])
  assert.equal(falaDasLinhas([a1, ele, perg].join('\n')).contexto, 'Sugiro A.', 'o contexto para na mensagem dele')
})

t('CC-589: o resumo é o trecho abaixo de "// resumo //"; sem ele, três frases', () => {
  const com = 'Medi tudo.\nDescartei X.\n\n---- // resumo // ----\n\n- **Feito:** a tela.\n- Falta: o PC.'
  assert.equal(resumoDaFala(com), '- Feito: a tela.\n- Falta: o PC.')
  assert.equal(resumoDaFala('Um. Dois. Três. Quatro.'), 'Um. Dois. Três.')
  assert.ok(resumoDaFala('a'.repeat(2000) + '.').length <= 421)
})

t('pasta pessoal de qualquer máquina não é projeto; subpasta dela é', () => {
  assert.equal(ehPastaPessoal('C:\\Users\\lfeli.ALIENWARE-LIPE'), true)
  assert.equal(ehPastaPessoal('/home/claudedev'), true)
  assert.equal(ehPastaPessoal('/Users/felipe/'), true)
  assert.equal(ehPastaPessoal('C:\\Users\\lfeli\\projetos\\tradutor'), false)
  assert.equal(ehPastaPessoal('/home/claudedev/projetos/VPS_cockpit'), false)
  assert.equal(ehPastaPessoal(null), false)
})

t('sessão aberta sem conversa não é decisão; com fala do agente, é', () => {
  const dir = mkdtempSync(join(tmpdir(), 'c2-vazia-'))
  const f = join(dir, 'x.jsonl')
  writeFileSync(f, '{"type":"mode"}\n{"type":"system","subtype":"bridge_status"}\n')
  assert.equal(conversaSemFala(f), true)
  writeFileSync(f, '{"type":"user"}\n{"type":"assistant","message":{}}\n')
  assert.equal(conversaSemFala(f), false)
  assert.equal(conversaSemFala(join(dir, 'nao-existe.jsonl')), false)
  assert.equal(conversaSemFala(null), false)
  rmSync(dir, { recursive: true })
})

t('permissão: ação sem resultado + registro "waiting" vira cartão de permissão; com resultado, não', () => {
  const acao = assistente([{ type: 'text', text: 'Vou fotografar.' }, { type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'node fotos3.mjs', description: 'Clica em Começar e fotografa' } }])
  const f = falaDasLinhas([usuario('testa'), acao].join('\n'))
  assert.equal(f.pendente.nome, 'Bash')
  assert.equal(f.pendente.comando, 'node fotos3.mjs')
  const a = avisoDoAgente(job({ permissao: true }), f, 'vps', agora)
  assert.equal(a.rotulo, 'permissão')
  assert.equal(a.pergunta, 'Clica em Começar e fotografa')
  assert.notEqual(avisoDoAgente(job(), f, 'vps', agora).rotulo, 'permissão', 'sem o registro dizer waiting, não é permissão')
  const feita = linha({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'b1', content: 'ok' }] } })
  assert.equal(falaDasLinhas([usuario('testa'), acao, feita].join('\n')).pendente, undefined)
})

t('CC-631: a conversa traz as falas dos dois lados, junta a resposta em partes e pula o que não é fala', () => {
  const txt = [
    usuario('me mostre o plano'),
    linha({ type: 'user', isMeta: true, message: { content: 'texto de skill' } }),
    assistente([{ type: 'text', text: 'Vou ler.' }, { type: 'tool_use', name: 'Read', input: {} }]),
    linha({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: 'arquivo' }] } }),
    assistente([{ type: 'text', text: 'Aqui está.' }]),
    assistente([{ type: 'text', text: 'de um sub-agente' }], { isSidechain: true }),
    usuario('<command-name>/clear</command-name>'),
    usuario('valeu'),
  ].join('\n')
  const f = falasDaConversa(txt)
  assert.deepEqual(f.map((x) => x.quem + ':' + x.texto), ['voce:me mostre o plano', 'agente:Vou ler.\n\nAqui está.', 'voce:valeu'])
})

t('resumo do agy: contexto começa no último pedido dele e ignora o que veio antes', () => {
  const L = (o) => JSON.stringify(o)
  const txt = [
    L({ type: 'user', message: { content: 'pedido velho' } }),
    L({ type: 'assistant', message: { content: [{ type: 'text', text: 'resposta velha' }] } }),
    L({ type: 'user', isMeta: true, message: { content: 'texto de skill' } }),
    L({ type: 'user', message: { content: 'faz o logo' } }),
    L({ type: 'assistant', message: { content: [{ type: 'text', text: 'Montei.' }, { type: 'tool_use', name: 'Edit', input: { file_path: 'a.js' } }] } }),
  ].join('\n')
  const c = contextoDaConversa(txt)
  assert.ok(c.startsWith('PEDIDO DO DONO: faz o logo'))
  assert.ok(c.includes('AGENTE: Montei.') && c.includes('AÇÃO Edit'))
  assert.ok(!c.includes('velh') && !c.includes('skill'))
})

/* CC-907 e CC-908: decidir um por um. O bloco novo vai de c2TdrCartoes até o marcador de fim. */
const uiTdr = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
const blocoTdr = uiTdr.slice(uiTdr.indexOf('function c2TdrCartoes'), uiTdr.indexOf('/* fim do Tinder (CC-907) */'))

t('CC-910: o lote do Tinder (marcar todas, Aprovar marcadas, esquerda = Nenhuma destas) só existe para o arquiteto', () => {
  for (const s of ['function c2TdrLote', 'function c2TdrTodas', 'function c2TdrEsquerda', 'data-tdr-todas', "'Nenhuma destas'", 'marque ao menos uma', 'nenhuma: true']) assert.ok(blocoTdr.includes(s), s)
  assert.ok(blocoTdr.includes("' Aprovar marcadas ('"), 'o botão fixo diz Aprovar marcadas (n)')
  assert.ok(/function c2TdrLote\(c\) \{\s*return c\.tipo === 'resp' && Boolean\(c\.e\.arquiteto\)/.test(blocoTdr), 'lote exige e.arquiteto: agente nunca')
  assert.ok(/\.tdr-op\.tdr-ir\[disabled\]/.test(uiTdr) && blocoTdr.includes(' disabled aria-disabled="true"'), 'desligado com n = 0, por atributo e palavra')
})

t('CC-907: o Tinder usa o mesmo envio dos cartões, sem rota nem fetch próprios', () => {
  assert.ok(blocoTdr.length > 5000, 'o recorte do bloco achou o Tinder')
  assert.ok(blocoTdr.includes('c2DecEnviar(') && blocoTdr.includes('c2PermEnviar(') && blocoTdr.includes('c2MsgEnviar('), 'os três envios compartilhados')
  /* CC-909: a única rota do Tinder é a da explicação do AGY, e só dentro de cartaPerguntar */
  /* CC-920 e CC-911: as outras rotas são só as das provas e dos baralhos, lidas em c2TdrLer e enviadas por c2TdrAprovar e pelo voto */
  const semExplicar = blocoTdr.replace(/async function cartaPerguntar[\s\S]*?\n    \}\n/, '').replace(/async function c2TdrLer[\s\S]*?\n    \}\n/, '')
    .replace(/'\/api\/(backlog\/provas|backlog\/aprovar|cartas\/votar|cartas\/img\?cwd=)/g, "'")
  assert.ok(!semExplicar.includes('fetch(') && !semExplicar.includes("'/api/"), 'nenhuma chamada nem rota nova além da explicação do AGY, das provas e dos baralhos')
  assert.ok(!blocoTdr.includes('data-msg-enviar') && !blocoTdr.includes('data-msg-conversa'), 'o tratador de Sessões mandaria o texto para outra rota')
  assert.ok(uiTdr.includes('async function c2DecEnviar(k)') && uiTdr.includes('async function c2PermEnviar({ conv, id, decisao, avisoId })') && uiTdr.includes('async function c2MsgEnviar(id, conversa, texto)'), 'os envios foram extraídos')
  assert.ok(uiTdr.includes('const c2Rep =() => { c2RenderDecisoes(); c2RenderInicio(); c2TdrRender(); };') && uiTdr.includes("try { c2TdrRender(); } catch (e) { console.error('tinder', e); }"), 'a tela do Tinder acompanha o redesenho')
})

t('CC-907: deslizar tem alternativa por botão e por teclado, e o gesto deixa a rolagem vertical em paz', () => {
  for (const s of ['pointerdown', 'setPointerCapture', 'data-tdr-pular', 'data-tdr-enviar', 'ArrowLeft', 'ArrowRight', 'pointercancel']) assert.ok(blocoTdr.includes(s), s)
  assert.ok(uiTdr.includes('touch-action:pan-y'), 'o cartão deixa o navegador rolar na vertical')
  assert.ok(blocoTdr.includes("aria-modal=\"true\"") && blocoTdr.includes('aria-live="polite"') && blocoTdr.includes('tabindex="-1"'), 'diálogo, aviso ao vivo e foco no título')
})

t('CC-907: decidir espera 6 s e dá para desfazer; esconder a página manda na hora', () => {
  assert.ok(blocoTdr.includes('c2Desfazer(') && blocoTdr.includes('clearTimeout') && blocoTdr.includes('6000'), 'desfazer de 6 s')
  assert.ok(blocoTdr.includes("visibilitychange") && blocoTdr.includes('c2TdrDispara(k)'), 'perder a resposta é pior que perder o desfazer')
})

t('CC-907: alvos de toque de 48 px e letra de 14 px no mínimo, movimento reduzido respeitado', () => {
  const css = uiTdr.slice(uiTdr.indexOf('#tdr-portal{display:none;}'), uiTdr.indexOf('.tdr-carta{transition:opacity .15s!important;}}') + 60)
  assert.ok(/\.tdr-op\{min-height:56px;font-size:16px/.test(css) && /\.tdr-chip\{min-height:48px/.test(css) && /\.tdr-x\{min-width:48px;min-height:48px/.test(css), 'opções, chips e fechar')
  assert.ok(/\.tdr-perg\{font-size:18px/.test(css) && /\.tdr-carta\{[^}]*font-size:16px/.test(css), '18 px na pergunta, 16 px no corpo')
  const miudo = [...css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((n) => n < 14)
  assert.deepEqual(miudo, [], 'nenhuma letra abaixo de 14 px')
  assert.ok(/prefers-reduced-motion: reduce\)\{\.tdr-carta\.entra/.test(css), 'movimento reduzido')
  assert.ok(!/grid-template-columns/.test(blocoTdr), 'nenhuma grade em style inline')
})

t('CC-908: entra por Sessões e pelo cartão do projeto', () => {
  assert.ok(uiTdr.includes("const statsV = c2TdrEntrada() + (c2Faixa('decisoes', 'resumo') ? statsH : '');") && !uiTdr.includes("'<div class=\"dec-fixo\">' + c2TdrEntrada()"), 'botão na tela Sessões, rolando com o conteúdo e não preso no topo')
  assert.ok(uiTdr.includes("data-tdr-abrir=\"' + esc(e.nome || '') + '\">um por um"), 'botão no cartão do projeto')
  assert.ok(/function c2TdrEntrada\(\)[\s\S]{0,1800}Decidir um por um/.test(uiTdr), 'o rótulo e a contagem')
})

{
  /* A lógica pura, recortada do HTML como no test-kb-detalhe.mjs. */
  const ini = uiTdr.indexOf('function c2TdrCartoes'), fimPuro = uiTdr.indexOf('function c2TdrRender')
  const esc = (s) => String(s ?? '')
  const semMd = (s) => String(s || '')
  // eslint-disable-next-line no-new-func
  const { c2TdrCartoes, c2TdrOrdenar } = new Function('esc', 'c2semMd', uiTdr.slice(ini, fimPuro) + '; return { c2TdrCartoes, c2TdrOrdenar };')(esc, semMd)
  const ag = (o) => ({ tipo: 'agente', id: 'x', nome: 'proj', projeto: 'proj', dispositivo: 'VPS', desdeMs: 1000, marca: '1', conversa: 'c-' + (o.id || 'x'), ...o })
  const resp = (id, q, desde, extra = {}) => ag({ id, rotulo: 'pergunta', pergunta: q, desdeMs: desde, responder: { id, conversa: 'c-' + id, perguntas: [{ pergunta: q, opcoes: ['A (Recomendado)', 'B'], descricoes: ['', 'depende'], multipla: false }] }, ...extra })
  const perm = (id, extra = {}) => ag({ id, rotulo: 'permissão', permissaoId: 'p-' + id, ferramenta: 'Bash', comando: 'ls', ...extra })
  const T0 = () => ({ aberto: true, proj: null, atual: null, ordem: {}, seq: 0, pulados: {}, pend: new Map(), passo: {}, erro: {}, feitos: {} })
  const opts = { local: 'VPS', pessoal: new Set() }

  t('CC-907 (lógica): grupo de perguntas iguais vira um cartão por sessão; grupo de paradas fica de fora', () => {
    const grupo = { grupo: true, pergunta: 'subo?', itens: [resp('a', 'subo?', 3), resp('b', 'subo?', 2), resp('c', 'subo?', 1)] }
    const paradas = { grupo: true, itens: [ag({ id: 'p1', rotulo: 'parou' }), ag({ id: 'p2', rotulo: 'parou' }), ag({ id: 'p3', rotulo: 'parou' })] }
    assert.equal(c2TdrCartoes([grupo], opts).cartoes.length, 3)
    assert.equal(c2TdrCartoes([paradas], opts).cartoes.length, 0)
  })

  t('CC-910 (lógica): só a pergunta do ARQUITETO com várias opções tem lote; a de agente nunca', () => {
    // eslint-disable-next-line no-new-func
    const { c2TdrLote } = new Function('esc', 'c2semMd', 'C2', uiTdr.slice(ini, fimPuro) + '; return { c2TdrLote };')(esc, semMd, { tdr: { passo: {} }, dec: {}, decAviso: {} })
    const arq = ag({ id: 'arq', rotulo: 'pergunta', conversa: 'gate:x', sessao: 'coderoom', arquiteto: { ficha: 'CC-1', pergunta: 'Quais partes?', multipla: true, opcoes: ['A', 'B', 'C'] } })
    const arq1 = ag({ id: 'arq1', rotulo: 'pergunta', conversa: 'gate:y', sessao: 'coderoom', arquiteto: { ficha: 'CC-2', pergunta: 'Qual?', multipla: false, opcoes: ['A', 'B'] } })
    const agente = ag({ id: 'ag', rotulo: 'pergunta', pergunta: 'Quais?', responder: { id: 'ag', conversa: 'c-ag', perguntas: [{ pergunta: 'Quais?', opcoes: ['A', 'B'], multipla: true }] } })
    const cs = c2TdrCartoes([arq, arq1, agente], opts).cartoes
    const por = (id) => cs.find((c) => c.id === id)
    assert.equal(cs.length, 3)
    assert.equal(c2TdrLote(por('arq')), true, 'arquiteto com várias opções tem lote')
    assert.equal(c2TdrLote(por('arq1')), false, 'arquiteto de uma opção só não tem')
    assert.equal(c2TdrLote(por('ag')), false, 'pergunta de agente com várias opções NUNCA tem lote (decisão de 03/10)')
  })

  t('CC-907 (lógica): o que esta máquina não responde só conta em "fora"; pasta pessoal e pendência não entram', () => {
    const r = c2TdrCartoes([resp('a', 'q?', 1, { dispositivo: 'ALIENWARE' }), resp('b', 'q?', 1), { tipo: 'pendencia', id: 'pe' }, resp('c', 'q?', 1, { projeto: 'casa' })], { local: 'VPS', pessoal: new Set(['casa']) })
    assert.equal(r.cartoes.length, 1)
    assert.equal(r.fora, 1)
  })

  t('CC-907 (lógica): "Recomendado" vira destaque; permissão com perigo fica sem destaque', () => {
    assert.equal(c2TdrCartoes([resp('a', 'q?', 1)], opts).cartoes[0].destaque, 0)
    const livre = c2TdrCartoes([perm('p')], opts).cartoes[0]
    assert.equal(livre.destaque, 0)
    const risco = c2TdrCartoes([perm('p', { raio: [{ texto: 'apaga tudo', perigo: true }] })], opts).cartoes[0]
    assert.equal(risco.destaque, null)
    assert.deepEqual(risco.perguntas[0].opcoes.map((o) => o.v), ['sim', 'nao'])
    assert.equal(c2TdrCartoes([perm('p', { sempre: true })], opts).cartoes[0].perguntas[0].opcoes[1].v, 'sempre')
  })

  t('CC-907 (lógica): o cartão na mão nunca é trocado por um que chegou depois', () => {
    const T = T0()
    const um = c2TdrCartoes([resp('a', 'q1?', 500), resp('b', 'q2?', 400)], opts).cartoes
    const f1 = c2TdrOrdenar(um, T)
    assert.equal(T.atual, f1[0].key)
    T.atual = 'b::1' // ele está com o b na mão
    const dois = c2TdrCartoes([resp('a', 'q1?', 500), resp('b', 'q2?', 400), resp('velho', 'q3?', 9000)], opts).cartoes
    const f2 = c2TdrOrdenar(dois, T)
    assert.equal(f2[0].key, 'b::1')
    assert.equal(T.atual, 'b::1')
    assert.equal(f2.length, 3)
  })

  t('CC-907 (lógica): pular manda para o fim; o que está saindo some da fila; erro volta como próximo', () => {
    const T = T0()
    const cs = c2TdrCartoes([resp('a', 'q1?', 500), resp('b', 'q2?', 400), resp('c', 'q3?', 300)], opts).cartoes
    const f1 = c2TdrOrdenar(cs, T)
    const primeiro = f1[0].key
    T.pulados[primeiro] = true; T.atual = null
    const f2 = c2TdrOrdenar(cs, T)
    assert.equal(f2[f2.length - 1].key, primeiro)
    T.pend.set(f2[0].key, {})
    const f3 = c2TdrOrdenar(cs, T)
    assert.ok(!f3.some((c) => T.pend.has(c.key)) && f3.length === 2)
    const erro = f3[f3.length - 1].key
    T.erro[erro] = 'falhou'; delete T.pulados[erro]; T.atual = null // o envio que falha limpa o "pulado", como c2TdrDispara
    assert.equal(c2TdrOrdenar(cs, T)[0].key, erro)
  })
}

t('CC-902: criar o produto tem botão, rotas e seção, e a pergunta do arquiteto vira cartão do Tinder', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("produto: { rotulo: 'criar o produto', attr: 'data-produto-comecar' }"), 'o botão está nas ações do cartão')
  assert.ok(ui.includes("[data-produto-comecar]") && ui.includes("'/api/arquiteto/comecar'"), 'o clique chama a rota')
  assert.ok(ui.includes("'/api/produto?cwd='") && ui.includes("'<h4>PRODUTO</h4>"), 'a seção Produto lê o arquivo')
  assert.ok(ui.includes("data-prod-parte") && ui.includes('<details class="pj-prod-parte"'), 'as partes em sanfona')
  assert.ok(/e\.arquiteto && !r[\s\S]{0,700}c2TdrEnviarArquiteto/.test(ui) || ui.includes('c2TdrEnviarArquiteto(c, x)'), 'a pergunta do arquiteto vira cartão e responde pela rota do arquiteto')
  assert.ok(/c2ArqEnviar\(e, q\.ficha, escolhas\.filter\(Boolean\)/.test(ui) && ui.includes("ficha, escolhas, extra });"), 'o Tinder e o cartão de Sessões mandam as escolhas em array, pelo mesmo envio')
  assert.ok(srv.includes("'/api/arquiteto/comecar'") && srv.includes("'/api/produto'") && srv.includes('function dispararArquiteto'), 'as rotas e o disparo no servidor')
  assert.ok(srv.includes("acao: 'produto'"), 'o retrato do framework aponta para o botão')
  assert.ok(!/(?:^|[^\\])style="[^"]*grid-template-columns[^"]*pj-prod/.test(ui), 'sem grade em style inline')
})

t('CC-912: régua de toque só no celular', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const a = ui.indexOf('/* CC-912: régua de toque')
  const z = ui.indexOf('/* fim CC-912 */')
  assert.ok(a > 0 && z > a, 'o bloco da régua existe, com marca de começo e de fim')
  const bloco = ui.slice(a, z)
  assert.ok(/@media \(max-width: 899px\) \{/.test(bloco), 'a régua está dentro de @media (max-width: 899px)')
  assert.ok(bloco.includes('min-height: 44px') && bloco.includes('font-size: 12px'), 'alvo de 44px e letra de 12px')
  // nada do bloco vale fora do @media: depois do abre-chaves do media só há o fechamento final
  const depoisMedia = bloco.slice(bloco.indexOf('@media'))
  assert.ok(depoisMedia.trimEnd().endsWith('}'), 'o @media fecha o bloco')
  assert.ok(!/(^|\n)\s*(button|select|input)[^{\n]*\{[^}]*min-height: 44px/.test(bloco.slice(0, bloco.indexOf('@media'))), 'nenhuma regra de altura antes do @media')
  assert.ok(!/class="bb-item"|\.bb-item\s*\{/.test(ui), 'CC-966: não há botão de barra de baixo')
  assert.ok(!/[—–]/.test(bloco), 'sem travessão no bloco')
})

t('CC-909: o "?" só aparece nas perguntas do arquiteto (permissão e pergunta de agente não mandam texto ao Google)', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('return c.e && c.e.arquiteto && cartaEhCurta(o.rot, o.desc)'), 'o botão exige carta do arquiteto')
})

t('CC-854: o interruptor do Nisaba aparece no cartão do projeto mesmo com o framework desligado, e só ele', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('const soNisaba = !valendo && fw.existe && cat.nisaba;') && ui.includes("valendo ? Object.keys(cat).map(botaoMod).join('') : soNisaba ? botaoMod('nisaba') : ''"), 'framework desligado mostra só o Nisaba')
  assert.ok(ui.includes("(valendo ? 'o que o framework governa aqui' : 'Nisaba neste projeto')"), 'o título da gaveta diz o que ela contém')
})

/* CC-909 (D2): a folha da explicação do AGY no Tinder */
t('CC-909: o "?" e a folha existem, a rota é chamada, o texto do AGY passa por esc( e a folha usa pintar(', () => {
  for (const s of ['data-carta-explicar', 'function cartaExplicar', "'/api/cartas/explicar'", 'aria-label="explicar esta opção"', 'o AGY não respondeu a tempo', 'tentar de novo', 'Escolher esta', 'o AGY está escrevendo']) assert.ok(blocoTdr.includes(s) || uiTdr.includes(s), s)
  const folha = blocoTdr.slice(blocoTdr.indexOf('function cartaFolhaHtml'), blocoTdr.indexOf('async function cartaPerguntar'))
  assert.ok(/pintar\(document\.getElementById\('tdr-folha-corpo'\)/.test(folha), 'a folha se pinta com pintar(')
  assert.ok(folha.includes('esc(x.texto)'), 'o texto do AGY entra por esc(')
  assert.ok(!/innerHTML\s*=\s*[^;]*x\.texto/.test(blocoTdr), 'o texto do AGY nunca vai direto a innerHTML')
  assert.ok(!/long ?press|contextmenu|touchhold/i.test(folha + blocoTdr.slice(blocoTdr.indexOf('function cartaEhCurta'))), 'nunca toque longo')
  assert.ok(/\.tdr-folha-fundo\{[^}]*z-index:170/.test(uiTdr) && /\.tdr-folha-caixa\{[^}]*z-index:171/.test(uiTdr), 'a folha fica acima do Tinder (151) e abaixo do desfazer (180)')
  assert.ok(/#c2-desf \{[^}]*z-index: 180/.test(uiTdr), 'o desfazer segue em 180')
  assert.ok(/@media \(prefers-reduced-motion: reduce\)\{\.tdr-folha-fundo/.test(uiTdr), 'movimento reduzido respeitado')
})

const { ehCurta } = await import('./src/cartas.mjs')
t('CC-909 (lógica): cartaEhCurta da tela concorda com ehCurta de src/cartas.mjs nos mesmos casos', () => {
  const i = blocoTdr.indexOf('function cartaEhCurta')
  // eslint-disable-next-line no-new-func
  const cartaEhCurta = new Function(blocoTdr.slice(i, blocoTdr.indexOf('\n', i)) + '\nreturn cartaEhCurta;')()
  const casos = [['Sim', ''], ['Sim', 'faz tudo de uma vez'], ['Subir agora mesmo', 'sobe e confere'], ['Subir tudo agora mesmo', 'sobe e confere'], ['Subir tudo agora mesmo', ''], ['  Com   migração  ', 'roda o banco'], ['', 'x'], ['Um dois três quatro', undefined], ['Um dois três quatro', null]]
  for (const [rotulo, descricao] of casos) assert.equal(cartaEhCurta(rotulo, descricao), ehCurta({ rotulo, descricao }), JSON.stringify([rotulo, descricao]))
})

/* CC-920 (F2) e CC-911 (D3b): provas e baralhos no Tinder */
t('CC-920: o Tinder tem a origem Provas, o "Aprovar todas as que vi (n)" e chama as rotas certas', () => {
  for (const s of ['Aprovar todas as que vi (', '/api/backlog/aprovar', '/api/backlog/provas', 'data-tdr-aprovar-todas', 'data-tdr-orig', 'Fecha \' + vistas + \' provas como aprovadas por você', 'Dá para ver o histórico de cada uma no backlog']) assert.ok(blocoTdr.includes(s), s)
  assert.ok(blocoTdr.includes('c2TdrVistasLista') && /const c2TdrVistasLista = \(\) => C2\.tdr\.fila\.filter\(\(c\) => c\.tipo === 'prova' && C2\.tdr\.vistas\[c\.key\]\)/.test(blocoTdr), 'só as provas já mostradas')
  assert.ok(blocoTdr.includes("c2Desfazer('Aprovadas: '") && /6000\) \}|, 6000\)/.test(blocoTdr), 'o lote sai depois do desfazer de 6 s')
  assert.ok(/for \(let i = 0; i < lista\.length; i \+= 50\)/.test(blocoTdr), 'no máximo 50 ids por pedido, como o servidor')
  assert.ok(blocoTdr.includes('x.j === 1 ? \'Não aprovo\' : \'Aprovo\'') && blocoTdr.includes('c2TdrAbrirCampo(c)'), '"Não aprovo" sem motivo abre o campo do motivo')
  assert.ok(blocoTdr.includes('const c2TdrOculta') && /c2TdrOrdenar[\s\S]{0,600}c2TdrOculta\(T, c\.key\)/.test(blocoTdr), 'a carta nova entra sem pular a da mão e as do lote somem da fila')
})

t('CC-911: o baralho entra pelas rotas /api/cartas, a imagem só por /api/cartas/img e todo texto do baralho passa por esc(', () => {
  for (const s of ['/api/cartas/votar', '/api/cartas/img', "fetch('/api/cartas')", 'loading="lazy"', 'rel="noopener noreferrer"']) assert.ok(blocoTdr.includes(s), s)
  const imgs = [...blocoTdr.matchAll(/<img\b[^>]*/g)].map((m) => m[0])
  assert.ok(imgs.length === 1 && /src="' \+ esc\('\/api\/cartas\/img\?cwd=' \+ encodeURIComponent\(c\.raiz\) \+ '&arq=' \+ encodeURIComponent\(k\.img\)\)/.test(blocoTdr), 'a única <img> do Tinder vem de /api/cartas/img com os dois valores codificados')
  assert.ok(!/src="' \+ (?!esc\(')/.test(blocoTdr), 'nenhum src montado com texto solto')
  const deck = blocoTdr.slice(blocoTdr.indexOf('function c2TdrCartaDeck'), blocoTdr.indexOf('function c2TdrCarta(c, proximo)'))
  for (const campo of ['k.olhe', 'k.pergunta', 'k.titulo', 'k.link', 'c.deckTitulo', 'c.projeto', 'T.nota[c.key]', 's']) assert.ok(deck.includes('esc(' + campo), 'esc( em ' + campo)
  assert.ok(!/innerHTML\s*=/.test(deck), 'a carta de baralho nunca escreve innerHTML direto')
  assert.ok(/\^https\?:\\\/\\\//.test(deck) && deck.includes('target="_blank"'), 'link só http(s), em nova aba')
  assert.ok(blocoTdr.includes("startsWith('docs/cartas/')"), 'a tela também recusa imagem fora de docs/cartas/')
})

{
  /* Lógica por recorte (padrão do test-kb-detalhe.mjs): carta de agente NUNCA ganha "aprovar todas"; só a de prova, e só com 2 ou mais vistas. */
  const ini = uiTdr.indexOf('function c2TdrOps(c) {'), fim = uiTdr.indexOf('function c2TdrPortal()')
  const esc = (s) => String(s ?? '')
  const T = { outra: null, mais: {}, conf: false, fila: [], vistas: {} }
  const C2 = { tdr: T, dec: {}, decAviso: {}, msg: {} }
  const ic = () => ''
  const fn = new Function('C2', 'esc', 'ic', 'c2semMd', 'cartaEhCurta', 'C2_DITADO', 'C2_OUVINTE', 'C2_MIC', 'c2TdrPasso', 'c2TdrPode', 'c2TdrSt', 'c2TdrLote', 'c2TdrMarca', 'c2TdrVistasLista',
    uiTdr.slice(ini, fim) + '; return c2TdrOps;')
  const mk = (tipo, extra) => ({ key: 'k-' + tipo, tipo, perguntas: [{ pergunta: 'p', multipla: false, livre: true, destaque: 0, opcoes: [{ rot: 'A', desc: '', v: 0 }, { rot: 'B', desc: '', v: 1 }] }], ...extra })
  const vistasDe = (cartas) => () => cartas.filter((c) => c.tipo === 'prova')
  const ops = (c, cartas) => fn(C2, esc, ic, (s) => s, () => false, null, null, '', () => 0, () => ({ j: 0 }), () => ({ esc: [] }), () => false, () => false, vistasDe(cartas))(c)
  t('CC-920 (lógica): "Aprovar todas as que vi" só aparece em prova com 2 ou mais vistas, nunca em pergunta de agente', () => {
    const p1 = mk('prova'), p2 = mk('prova', { key: 'k2' })
    assert.ok(ops(p1, [p1, p2]).includes('data-tdr-aprovar-todas') && ops(p1, [p1, p2]).includes('Aprovar todas as que vi (2)'), 'prova com duas vistas')
    assert.ok(!ops(p1, [p1]).includes('data-tdr-aprovar-todas'), 'com uma vista só, não')
    for (const tipo of ['resp', 'escolha', 'perm', 'msg']) {
      const a = mk(tipo, { e: { arquiteto: tipo === 'resp' ? {} : undefined } })
      assert.ok(!ops(a, [p1, p2]).includes('data-tdr-aprovar-todas'), 'agente (' + tipo + ') nunca ganha o botão, mesmo havendo provas vistas')
    }
  })
}

t('CC-936: a aba Tarefas tem o caminho do projeto embaixo, com a mesma peça do Caminho', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.indexOf('id="c2-tarefas"') < ui.indexOf('id="c2-tar-caminho"'), 'o contêiner do caminho vem depois das tarefas')
  assert.ok(ui.includes("document.getElementById(naTar ? 'c2-tar-caminho' : 'c2-caminho')"), 'o alvo troca conforme a tela ativa')
  assert.ok(ui.includes('c2CaminhoPosicionar(anima, alvo)'), 'a estrada é posicionada no alvo recebido')
  assert.ok(!ui.includes("document.querySelector('#c2-caminho .cam-estrada')"), 'nada preso ao contêiner do Caminho')
  assert.ok(ui.includes('body:has(#view-tarefas.active) #cam-portal{display:block;}'), 'o painel lateral aparece também na aba Tarefas')
  // 3b: a explicação de cada item e a rota que a escreve
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("fetch('/api/explicacoes'") && ui.includes('function c2ExplPedir'), 'a tela pede as explicações à rota')
  assert.ok(ui.includes('texto do agente') && ui.includes('o que muda para você:'), 'sem explicação aparece o texto do agente; com ela, o que muda')
  assert.ok(!/setInterval\([^)]*c2ExplPedir/.test(ui), 'o pedido nunca anda por temporizador')
  assert.ok(ui.includes("if (!['na fila', 'escrevendo'].includes(r.estado)) faltam.forEach"), 'sem fila andando, a tela para de pedir o que não vai vir')
  assert.ok(srv.includes("url.pathname === '/api/explicacoes'"), 'a rota existe no servidor')
  assert.ok(ui.includes("i.emenda ? ' · emenda: ideia nova no meio do projeto'"), 'a marca de emenda do CC-916 continua')
})

t('CC-946 e CC-947: controles do Caminho numa barra presa, e o projeto escolhido numa folha de cartões', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('.cam-topo{position:sticky;'), 'a barra dos controles fica presa no topo, como a das Sessões')
  assert.ok(!ui.includes('<select data-cam-proj>'), 'a lista nativa de opções saiu: no celular ela era ilegível')
  assert.ok(ui.includes('data-cam-proj-abrir') && ui.includes('function camProjAbrir') && ui.includes('data-cam-proj-ir='), 'o botão abre a folha e o cartão troca o projeto')
  assert.ok(ui.includes('data-cam-proj-busca') && ui.includes("ev.key === 'Escape' && document.body.classList.contains('cam-proj-on')"), 'a folha tem busca e fecha no Esc')
  assert.ok(ui.includes('% andado</span>'), 'cada cartão diz quanto já andou, em palavra além da barra')
})

t('CC-948: na estrada, a virada passa pela borda da coluna e frase longa não vaza do rótulo', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('const ex = q.x + sg * (dx / 2 - 14)'), 'a curva desce pela borda, fora da largura do rótulo')
  assert.ok(!ui.includes("' C' + (q.x + sg * o)"), 'a curva antiga, que cortava o texto, saiu')
  assert.ok(ui.includes("/^\\d\\d\\/\\d\\d/.test(t.descricao)"), 'só a data do sprint fica sem quebrar linha')
  assert.ok(ui.includes("Math.round(270 * escala)") && ui.includes('escala >= 1.4 ? 1 : 2'), 'o espaço entre linhas cresce com a letra, e com letra muito grande vira uma coluna')
})

t('CC-950: com o resumo dizendo que nada é necessário, o cartão não diz espera você', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes("const c2EhNada = (x) => c2Eti(x) === 'nada'"), 'existe a regra do nada')
  assert.ok(ui.includes("c2EhNada(s) ? ['check', 'var(--text-dim)', 'terminou, nada pendente']"), 'o cartão de sessão troca o rótulo')
  assert.ok(ui.includes("c2EhNada(e) ? 'TERMINOU, NADA PENDENTE'"), 'o cartão de decisão troca o rótulo')
  assert.ok(ui.includes("s.estado === 'espera você' && !c2EhQA(s) && !c2EhNada(s)"), 'e sai da contagem de Esperando você')
})

t('CC-951: cada zona do Início encolhe e abre pelo título, e a escolha fica lembrada', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('data-bloco-recolher="') && ui.includes("closest('[data-bloco-recolher]')"), 'botão e tratador do encolher')
  assert.ok(ui.includes("localStorage.setItem('c2-recolhidos'") && ui.includes("localStorage.getItem('c2-recolhidos')"), 'a escolha fica no aparelho')
  assert.ok(ui.includes("(fechado ? '' : '<div class=\"c2-corpo\">'"), 'encolhida não desenha o corpo')
  assert.ok(/\.c2-encolher\{[^}]*min-width:44px;min-height:44px/.test(ui), 'o botão tem o tamanho do dedo')
})

t('CC-949: Tinder no celular com uma fileira de filtros, conteúdo no meio da carta e aviso acima das opções', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('<span class="tdr-sep" aria-hidden="true"></span>'), 'o que decidir e os projetos numa fileira só, com um traço entre eles')
  assert.ok(ui.includes('.tdr-carta > .tdr-perg{margin-top:auto;}'), 'texto curto fica no meio da carta')
  assert.ok(ui.includes('<details class="tdr-det" open><summary>o que aconteceu</summary>'), 'o resumo já vem aberto')
  assert.ok(!ui.includes('body.tdr-on #c2-desf{top:calc(76px'), 'o aviso não fica mais em cima do título')
  assert.ok(ui.includes("setProperty('--tdr-ops-h'"), 'o aviso fica acima das opções, pela altura medida delas')
  assert.ok(ui.includes("if (c2EhNada(e)) continue;"), 'sessão que não pede nada não vira carta')
})

t('CC-856: o custo do trabalho tem tela em Ajustes, e as rotas do painel antigo saíram', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes('id="aj-custo"') && ui.includes("fetch('/api/custo')") && ui.includes("post('/api/taxa'") && ui.includes("post('/api/assinatura'") && ui.includes("post('/api/cambio'"), 'o formulário lê e grava os três números')
  assert.ok(!/name="(taxa|assinatura|cambio)"[^>]*type="number"|type="number"[^>]*name="(taxa|assinatura|cambio)"/.test(ui), 'campo numérico recusa a vírgula de 5,40')
  assert.ok(!/config: setTaxa|config: setAssinatura/.test(srv), 'a gravação não devolve a configuração inteira (com o token da federação)')
  for (const r of ['/api/visita', '/api/recados', '/api/pip', '/api/enriquecer', '/api/midia']) assert.ok(!srv.includes("url.pathname === '" + r + "'"), r + ' saiu do servidor')
})

t('CC-922: a segurança do produto tem tela (seção Produto) e o portão não depende de comando à mão', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("c2Post('/api/produto/seguranca'") && srv.includes("url.pathname === '/api/produto/seguranca'"), 'o botão "medir agora" chama a rota que mede e grava o veredito')
  assert.ok(ui.includes('function segParte(codigo)') && ui.includes(", barra o pronto'"), 'cada parte mostra os requisitos e o que barra')
  assert.ok(srv.includes('S.requisitosDoProduto(dir)'), 'a leitura do produto já traz os requisitos')
})

t('CC-559: notas no telefone: o endereço abre a nota, a Início leva a ela, copiar e letra mínima', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes("ARM.aba = 'notas'; if (agente) { ARM.item = decodeURIComponent(agente);"), '#notas abre na aba Notas, e #notas/<id> abre a nota')
  assert.ok(ui.includes('href="#notas/\' + encodeURIComponent(n.id)'), 'a nota da Início abre a própria nota')
  assert.ok(ui.includes("location.hash = '#notas/' + n.id"), 'a busca geral abre a nota achada')
  assert.ok(ui.includes('data-arm-copiar') && ui.includes('navigator.clipboard.writeText'), 'um toque copia a nota')
  assert.ok(ui.includes("return document.querySelector('[data-arm-corpo]')?.focus();"), 'a nota nova começa no texto')
  assert.ok(!/\.arm-sec \{ font-size: 11px/.test(ui) && !ui.includes('font-size: 11px !important; color: var(--text-muted)'), 'nenhuma letra das notas abaixo de 12 px')
})

t('CC-559: #notas/<id> abre a nota mesmo com o clique do menu regravando o endereço, e recarregar continua nela', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('window.C2_ARM_HASH = location.hash;'), 'o endereço pedido é guardado antes do clique do menu')
  assert.ok(ui.includes("if (window.C2_ARM_HASH) armHash();"), 'a nota é aplicada quando os dados chegam')
  assert.ok(ui.includes("history.replaceState(null, '', '#notas/' + agente)"), 'a barra fica com o endereço da nota')
})

t('CC-658: a tela Design troca cor, fonte e regra pela rota de edição', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("fetch('/api/design/editar'"), 'a tela chama a rota de edição')
  assert.ok(ui.includes('type="color" class="dsg-cor-in"'), 'tocar numa cor abre o seletor do sistema')
  assert.ok(ui.includes('data-dsg-regra-gravar'), 'há botão para gravar a regra')
  assert.ok(ui.includes('data-dsg-fonte-salvar'), 'há botão para gravar a fonte')
  assert.ok(srv.includes("url.pathname === '/api/design/editar'"), 'a rota existe no servidor')
  assert.ok(!/setInterval\([^)]*(design|dsg)/i.test(ui), 'a tela Design não é redesenhada por temporizador')
})

t('CC-658: a regra digitada num projeto não vai para outro ao trocar de projeto', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes("if (DSG.sel !== raiz) DSG.regra = '';"), 'trocar de projeto descarta o rascunho da regra')
})

t('CC-655: a aba Telas lê, fotografa uma por vez e vota no baralho design', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("fetch('/api/design/telas?raiz='"), 'a tela lê as telas')
  assert.ok(ui.includes("fetch('/api/design/fotografar'"), 'a tela pede a foto')
  assert.ok(ui.includes("deck: 'design'"), 'o voto vai para o baralho design')
  assert.ok(ui.includes('pintar(tela, '), 'a tela Design usa pintar')
  assert.ok(ui.includes('const DSG_CORPO = { telas: dsgTelasHtml };'), 'a aba Telas está ligada ao corpo')
  assert.ok(srv.includes("url.pathname === '/api/design/telas'") && srv.includes("url.pathname === '/api/design/fotografar'"), 'as rotas existem')
  assert.ok(!/setTimeout\([^)]*dsgTelasLer/.test(ui), 'a foto nunca sai por temporizador')
})

t('CC-656: a aba Mural põe print, link e recado, e o seletor de arquivo mora fora do bloco redesenhado', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("fetch('/api/design/mural'"), 'a tela envia ao mural')
  assert.ok(ui.includes("fetch('/api/design/mural?raiz='"), 'a tela lê o mural')
  assert.ok(ui.includes('<input type="file" id="dsg-arquivo"'), 'o seletor de arquivo é fixo no HTML')
  const linhas = ui.split('\n'), iCard = linhas.findIndex((l) => l.includes('id="design-tela"'))
  assert.ok(iCard >= 0 && linhas[iCard + 1].includes('id="dsg-arquivo"'), 'o input vem logo depois do card redesenhado, fora dele')
  assert.ok(!/(?:innerHTML|pintar)[^\n]*dsg-arquivo/.test(ui), 'o seletor nunca é escrito pelo redesenho')
  assert.ok(ui.includes("DSG_ABAS.push(['mural', 'Mural', 'pasta'])"), 'a aba Mural está na lista')
  assert.ok(ui.includes('f.size > 12 * 1024 * 1024'), 'o teto de tamanho vale já no navegador')
  assert.ok(srv.includes("url.pathname === '/api/design/mural'") && srv.includes('M.caminhoDaImagem(raizA, relA)'), 'a rota e a imagem validada existem')
  const bloco = ui.slice(ui.indexOf('const DSG = {'), ui.indexOf('const ARM = {'))
  assert.ok(bloco.length > 1000 && !/style="[^"]*grid-template-columns/.test(bloco), 'grade da tela Design nunca em style inline')
  assert.ok(/\.dsg-mural \{ display: grid;/.test(ui), 'a grade do mural está em regra de CSS')
})

t('CC-657: o antes e depois lê as rodadas do Coderoom, vota e manda o ajuste para a conversa', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("fetch('/api/design/comparar?raiz='"), 'a tela lê a comparação')
  assert.ok(ui.includes("c2Post('/api/gate/mensagem', { id: cmp.conversa"), 'o pedido de ajuste vai para a conversa do Coderoom')
  assert.ok(ui.includes("DSG_ABAS.push(['comparar', 'Antes e depois', 'relogio'])"), 'a aba está na lista')
  assert.ok(srv.includes("url.pathname === '/api/design/comparar'"), 'a rota existe')
  assert.ok(/\.dsg-par-fotos \{ display: grid;/.test(ui), 'a grade do lado a lado está em regra de CSS')
  assert.ok(!/setTimeout\([^)]*dsgCompLer|setInterval\([^)]*dsgCompLer/.test(ui), 'a leitura nunca sai por temporizador')
  const bloco = ui.slice(ui.indexOf('const DSG = {'), ui.indexOf('const ARM = {'))
  assert.ok(!/style="[^"]*grid-template-columns/.test(bloco), 'grade da tela Design nunca em style inline')
})

t('CC-765: a ordem dos painéis (Coderoom e Sessões) e as setas do Coderoom', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const ini = ui.indexOf('    function c2PainelOrdem('), fim = ui.indexOf('\n', ui.indexOf('    function c2PainelMover('))
  assert.ok(ini > 0 && fim > ini, 'a conta de ordem está inteira em duas linhas')
  const { c2PainelOrdem, c2PainelMover } = new Function(ui.slice(ini, fim) + '\nreturn { c2PainelOrdem, c2PainelMover };')()
  const L = [['a'], ['b'], ['c'], ['d']]
  const ks = (l) => l.map((x) => (Array.isArray(x) ? x[0] : x)).join(',')
  assert.equal(ks(c2PainelOrdem(L, ['c', 'a'])), 'c,a,b,d')
  assert.equal(ks(c2PainelMover(L, [], [], 'b', 1)), 'a,c,b,d')
  assert.equal(ks(c2PainelMover(L, [], ['c'], 'b', 1)), 'a,d,c,b')
  assert.equal(ks(c2PainelMover(L, [], [], 'a', -1)), 'a,b,c,d')
  assert.ok(ui.includes('c2PainelOrdem(BLOCOS, E.ordem)'), 'o Coderoom desenha na ordem gravada')
  assert.ok(ui.includes('data-gctx-mover'), 'as setas do Coderoom existem')
  assert.ok(ui.includes('E.ordem ||= [];'), 'a ordem nasce no estado')
})

t('CC-765: Sessões em tela larga vira painéis que se movem, saem, voltam e fixam uma segunda sessão', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('if (c2SesLargo()) return c2SesPaineis(vis, lista, sel, idDe, falasSel);'), 'a tela larga troca o modo lista pelos painéis')
  assert.ok(ui.includes("localStorage.setItem('c2-ses-paineis'"), 'a escolha fica no aparelho')
  assert.ok(ui.includes('data-ses-fixar'), 'dá para fixar uma segunda sessão')
  assert.ok(ui.includes('#dec-tela .ses-paineis > .ses-painel'), 'os painéis deslizam ao mudar de lugar')
  assert.ok(ui.includes('.ses-paineis { display: flex;'), 'o lado a lado está em regra de CSS')
  assert.ok(!/style="[^"]*ses-painel/.test(ui), 'nada do painel em style inline')
  assert.ok(ui.includes('window.innerWidth >= 1280'), 'só a partir de 1280 px')
})

t('CC-958: o lugar na fila aparece em cada item, muda com um toque, e fora do MVP fica guardado', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  assert.ok(ui.includes("c2Post('/api/backlog/lugar'"), 'a escolha grava pela rota do lugar')
  assert.ok(ui.includes('data-cam-lugar="'), 'cada item aberto tem o botão do lugar')
  assert.ok(ui.includes('function camLugarAbrir(id, onde)'), 'a folha dos lugares existe')
  assert.ok(ui.includes('function camGuardados(r)'), 'as seções guardadas existem')
  assert.ok(ui.includes("(r && r.ok ? camGuardados(r) : '')"), 'as guardadas vão embaixo da estrada')
  assert.ok(ui.includes('r.lugares'), 'o vocabulário dos lugares vem do servidor')
  assert.ok(ui.includes('body.cam-lugar-on #cam-lugar{display:block;}'), 'a folha só aparece quando aberta')
  assert.ok(ui.includes("i.emenda ? ' · emenda: ideia nova no meio do projeto'"), 'a marca de emenda do CC-916 continua')
  assert.ok(!/setInterval\([^)]*camLugar/.test(ui), 'a folha nunca é desenhada no tique')
  assert.ok(srv.includes("url.pathname === '/api/backlog/lugar'"), 'a rota do lugar existe')
  assert.ok(srv.includes('B.porNoLugar('), 'a rota usa a função do núcleo')
})

t('CC-966: no celular a gaveta entra pela esquerda, com o menu, os ajustes e Ver aplicativos', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  const a = ui.indexOf('/* CC-966: celular sem barra de baixo */'); const z = ui.indexOf('/* fim CC-966 */')
  assert.ok(a > 0 && z > a, 'o bloco existe, com começo e fim')
  const bloco = ui.slice(a, z)
  assert.equal(bloco.slice(0, bloco.indexOf('@media')).replace(/\/\*[\s\S]*?\*\//g, '').trim(), '', 'nada do bloco vale fora do celular')
  assert.ok(bloco.includes('@media (max-width: 899px) {') && bloco.includes('transform: translateX(-105%)') && bloco.includes('width: min(320px, 85vw)'), 'gaveta lateral só no celular')
  assert.ok(!new RegExp(String.fromCharCode(8212) + '|' + String.fromCharCode(8211)).test(bloco), 'sem travessão')
  for (const s of ['class="gaveta-x" data-gaveta-x', 'class="gaveta-apps" data-sb-grade', 'class="gv-bt" data-tema-ciclo data-gv-tema', 'class="gv-bt" data-modos-abrir', 'class="gv-bt" data-lateral-alternar', 'class="gv-pct" data-fonte="0"'])
    assert.ok(ui.includes(s), 'falta na gaveta: ' + s)
  assert.ok(!ui.includes('id="gaveta-escolha"') && !ui.includes('gaveta-puxador'), 'a folha de baixo saiu')
  assert.ok(ui.includes('for (const n of document.body.children) if (n !== g) n.inert = abrir;'), 'foco preso: o resto fica inerte')
  assert.ok(ui.includes("b.setAttribute('aria-expanded', String(abrir))") && ui.includes('if (!g || abrir === MENU_GAV.aberta) return;'), 'aria-expanded e fechar o fechado é nada')
  assert.ok(ui.includes("[data-gaveta-x], #gaveta [data-sb-grade], #gaveta [data-modos-abrir], #gaveta [data-lateral-alternar]") && ui.includes("eixo === 'x' && dx < -60"), 'fecha no X, nos atalhos e ao arrastar')
  assert.ok(ui.includes("querySelectorAll('#fonte-pct, .gv-pct')") && ui.includes("document.querySelectorAll('[data-tema-ciclo]').forEach"), 'letra e tema atualizam as duas cópias')
  assert.ok(ui.includes("sec.querySelectorAll('.nav-item[data-target]')"), 'a galeria não tem ícone morto')
  // peça 2: a faixa do topo
  assert.ok(ui.includes('<button type="button" class="topo-menu" data-gaveta-abrir aria-controls="gaveta" aria-expanded="false" aria-label="abrir o menu">'), 'o botão de menu no topo')
  const base = ui.indexOf('    .topo-menu { display: none; }'); assert.ok(base > 0 && base < a, 'no computador o botão não aparece')
  for (const s of [':root { --topo-fixo: calc(52px + env(safe-area-inset-top, 0px)); }', 'order: -1; flex: none; position: sticky; top: -32px; z-index: 50;', '.sidebar { display: none; }', '.kb-fixo, #pj-topo, .dec-fixo, .ini-fixo, .cam-topo { top: calc(-20px + var(--topo-fixo)); }', '.ini-hero-txt { display: none; }', '.main-content > header.header .topo-canto > .fonte-ctl { display: none; }'])
    assert.ok(bloco.includes(s), 'falta no topo do celular: ' + s)
  // peça 3: sai a barra de baixo
  assert.ok(!ui.includes('id="barra-baixo"') && !ui.includes('--barra-baixo') && !ui.includes('--gate-pe'), 'a barra e as contas dela saíram')
  assert.ok(!/function (montarBarraBaixo|marcarBarraBaixo|carregarBarraBaixo|trocarNaBarra|montarEscolhaBarra|telaConhecida)\b/.test(ui) && !ui.includes('montarBarraBaixo()'), 'o código da barra saiu')
  assert.ok(!ui.includes('calc(84px + env(safe-area-inset-bottom))') && ui.includes('const pe = 16;'), 'avisos e Coderoom sem reservar a barra')
})

t('CC-966: na faixa do celular o sino é plano (a sombra em relevo passava da borda e parecia cortado)', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('.main-content > header.header .sino { width: 44px; height: 44px; box-shadow: none !important; background: none; }'))
})

t('puxar para baixo no topo não recarrega o app no celular (pedido dele em 07/10)', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('html, body { overscroll-behavior-y: none; }'))
})

t('CC-970: topo do celular com buscar, sino e o painel de responder à direita; no PC os dois botões somem', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes('class="topo-icone topo-buscar" data-busca-abrir'), 'botão de buscar')
  assert.ok(ui.includes('class="topo-icone topo-lado" data-lateral-alternar'), 'botão do painel de responder')
  assert.ok(ui.includes('.topo-icone { display: none; }'), 'no PC os botões não aparecem')
  assert.ok(ui.includes("ev.target.closest('[data-busca-abrir]')"), 'o buscar abre a busca')
  assert.ok(!/topo-lado[^"]*lat-btn|lat-btn[^"]*topo-lado/.test(ui), 'sem a classe que vazava para o PC')
})

t('CC-971: a tela abre com o último dado guardado no aparelho e o novo pinta por cima', () => {
  const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
  assert.ok(ui.includes("localStorage.getItem(C2_ULTIMO)") && ui.includes('localStorage.setItem(C2_ULTIMO'), 'lê e grava o guardado')
  assert.ok(ui.includes('if (on && C2.guardadoEm)'), 'pinta com o guardado assim que a tela liga, sem esperar o servidor')
  assert.ok(ui.includes('C2.erro = null; C2.guardadoEm = 0;'), 'o dado novo apaga o aviso de guardado')
})

console.log(`\n${ok} ok, 0 falhas (cockpit2)`)
