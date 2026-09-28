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

console.log(`\n${ok} ok, 0 falhas (cockpit2)`)
