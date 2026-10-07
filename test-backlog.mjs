/**
 * O backlog em dado: as travas que ele existe para ter.
 *
 * Roda numa pasta temporária, nunca no backlog de verdade. A lição já foi paga
 * neste projeto: o gate escrevia nas notas reais do Felipe e é candidato à
 * causa do apagamento de 2026-08-09.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ordemDaFila, porNoLugar, rotuloDoLugar, sprintAtualIds, lugarDe, acrescentar, caminhoEventos, comoMarkdown, debater, especificar, ESTADOS, fechadosNosCommits, filaDoAgente, gravar, historia, ler, mover, problemas, proximoId, retrato, siglaDe, sincronizarComCommits } from './src/backlog.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok++; console.log('  ok  ', nome) }
const recusa = (nome, fn, trecho) => {
  let erro = null
  try { fn() } catch (e) { erro = e }
  assert.ok(erro, `${nome}: devia ter recusado e não recusou`)
  if (trecho) assert.ok(String(erro.message).includes(trecho), `${nome}: recusou por outro motivo: ${erro.message}`)
  ok++
  console.log('  ok  ', nome)
}

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-backlog-'))
const arq = path.join(casa, 'docs', 'backlog.jsonl')

console.log('\nbacklog em dado\n')

t('arquivo que não existe devolve vazio, sem explodir', () => {
  const r = ler(path.join(casa, 'nao-existe.jsonl'))
  assert.deepEqual(r.itens, [])
  assert.equal(r.existe, false)
})

/* `permitirAntigo` desde 11/09: o item passou a exigir natureza, área,
   tamanho, intenção, pronto e conferir, e quem testa o formato NOVO é o
   test-backlog-formato.mjs. Aqui o assunto é outro (id, estados, recusas), e
   o item de teste é o de antes da virada, que continua tendo que funcionar. */
t('acrescentar grava e devolve o item', () => {
  const i = acrescentar({ titulo: 'a fundação', frente: 'fundacao', estado: 'B1', peso: 3, permitirAntigo: true }, arq)
  assert.equal(i.id, 'CC-1')
  assert.equal(i.estado, 'B1')
  assert.equal(ler(arq).itens.length, 1)
})

t('o id anda sozinho e nunca reusa número', () => {
  acrescentar({ titulo: 'segundo', frente: 'fundacao', permitirAntigo: true }, arq)
  const { itens } = ler(arq)
  assert.equal(itens[1].id, 'CC-2')
  assert.equal(proximoId(itens), 'CC-3')
})

recusa('fechar sem prova é recusado', () => mover('CC-1', 'OK', {}, arq), 'sem prova')

t('fechar COM prova passa, e carimba a data', () => {
  const i = mover('CC-1', 'OK', { prova: 'gate verde e captura em 390px' }, arq)
  assert.equal(i.estado, 'OK')
  assert.ok(i.fechado, 'devia ter carimbado a data de fechamento')
})

recusa('cancelar sem motivo é recusado', () => mover('CC-2', 'KO', {}, arq), 'sem motivo')
recusa('travar sem a causa é recusado', () => mover('CC-2', 'TR', {}, arq), 'sem a causa')
recusa('esperar decisão dele sem dizer qual é recusado', () => mover('CC-2', 'DE', {}, arq), 'sem dizer qual')
recusa('estado inventado é recusado', () => mover('CC-2', 'ZZ', {}, arq), 'estado desconhecido')
/* `permitirAntigo` aqui pelo mesmo motivo dos dois acima, e a falta dele
   derrubou o gate em 11/09: sem a marca, o item novo é recusado ANTES por
   faltar natureza, e o teste passa a medir outra coisa. A mensagem de erro
   dizia "falta natureza" onde o teste esperava "id repetido", que é o sintoma
   exato de verificação que deixou de verificar o que dizia. */
recusa('id repetido é recusado', () => acrescentar({ id: 'CC-1', titulo: 'clone', frente: 'fundacao', permitirAntigo: true }, arq), 'id repetido')
recusa('peso fora da escala é recusado', () => acrescentar({ titulo: 'x', frente: 'fundacao', peso: 4, permitirAntigo: true }, arq), 'peso fora da escala')

t('item sem campo obrigatório é apontado, não engolido', () => {
  const p = problemas({ id: 'CC-9' })
  assert.ok(p.some((x) => x.includes('titulo')), 'devia cobrar o titulo')
  assert.ok(p.some((x) => x.includes('frente')), 'devia cobrar a frente')
})

t('id fora do formato é apontado', () => {
  assert.ok(problemas({ id: 'banana', titulo: 't', estado: 'B0', frente: 'fundacao' }).some((x) => x.includes('formato')))
})

t('linha quebrada não derruba a leitura, e aparece na lista de ruins', () => {
  const sujo = path.join(casa, 'sujo.jsonl')
  fs.writeFileSync(sujo, '{"id":"CC-1","titulo":"bom","estado":"B0","frente":"fundacao"}\n{quebrado\n', 'utf8')
  const r = ler(sujo)
  assert.equal(r.itens.length, 1, 'o item bom tem que sobreviver')
  assert.equal(r.ruins.length, 1, 'o ruim tem que ser contado')
})

t('CRLF é lido igual, porque os arquivos daqui são CRLF', () => {
  const crlf = path.join(casa, 'crlf.jsonl')
  fs.writeFileSync(crlf, '{"id":"CC-1","titulo":"um","estado":"B0","frente":"fundacao"}\r\n{"id":"CC-2","titulo":"dois","estado":"B0","frente":"fundacao"}\r\n', 'utf8')
  assert.equal(ler(crlf).itens.length, 2)
})

t('o retrato separa aberto de fechado e agrupa por frente', () => {
  const r = retrato(arq)
  assert.equal(r.total, 2)
  assert.equal(r.fechados, 1)
  assert.equal(r.abertos, 1)
  assert.equal(r.frentes.length, 1)
})

t('o markdown gerado avisa que é saída, não fonte', () => {
  const md = comoMarkdown(arq)
  assert.ok(md.includes('NÃO EDITE'), 'sem o aviso, alguém edita o markdown e nasce a segunda verdade')
  assert.ok(md.includes('CC-2'), 'o item aberto tem que aparecer')
})

t('todo estado tem código, rótulo e lugar na esteira', () => {
  for (const e of ESTADOS) {
    assert.ok(e.codigo && e.rotulo && e.desc, `estado incompleto: ${JSON.stringify(e)}`)
    assert.equal(typeof e.esteira, 'number')
  }
  assert.equal(new Set(ESTADOS.map((e) => e.codigo)).size, ESTADOS.length, 'código repetido')
})

t('o commit que diz "fecha CC-x" fecha, e a mensagem vira a prova', () => {
  const arq2 = path.join(casa, 'sync.jsonl')
  gravar([
    { id: 'CC-1', titulo: 'um', estado: 'B1', frente: 'fundacao' },
    { id: 'CC-2', titulo: 'dois', estado: 'B1', frente: 'fundacao' },
  ], arq2)
  const r = sincronizarComCommits(['feat(x): a coisa nova, fecha CC-1'], { arquivo: arq2 })
  assert.equal(r.feitos.length, 1)
  const i = ler(arq2).itens.find((x) => x.id === 'CC-1')
  assert.equal(i.estado, 'OK')
  assert.ok(i.prova.includes('commit:'), 'a mensagem do commit tinha que virar a prova')
  assert.equal(ler(arq2).itens.find((x) => x.id === 'CC-2').estado, 'B1', 'fechou item que ninguém citou')
})

t('⚠️ CITAR o id no commit NÃO fecha: só a forma explícita conta', () => {
  const arq3 = path.join(casa, 'sync2.jsonl')
  gravar([{ id: 'CC-1', titulo: 'um', estado: 'B1', frente: 'fundacao' }], arq3)
  const r = sincronizarComCommits(['fix: mesmo defeito do CC-1, mas em outro lugar'], { arquivo: arq3 })
  assert.deepEqual(r.feitos, [], 'citação virou fechamento, e o quadro encheria de trabalho falso')
  assert.equal(ler(arq3).itens[0].estado, 'B1')
})

t('as formas de fechar que o commit aceita', () => {
  for (const frase of ['fecha CC-9', 'fechou CC-9', 'closes CC-9', 'resolve CC-9', 'Fecha CC-9']) {
    assert.ok(fechadosNosCommits([frase]).has('CC-9'), `não reconheceu: ${frase}`)
  }
})

t('sincronizar em ensaio não grava', () => {
  const arq4 = path.join(casa, 'sync3.jsonl')
  gravar([{ id: 'CC-1', titulo: 'um', estado: 'B1', frente: 'fundacao' }], arq4)
  const r = sincronizarComCommits(['fecha CC-1'], { arquivo: arq4, ensaio: true })
  assert.equal(r.feitos[0].acao, 'fecharia', 'ensaio dizendo que fez faz ele não rodar de verdade')
  assert.equal(ler(arq4).itens[0].estado, 'B1', 'ensaio gravou')
})

t('a gravação ordena por número, não por ordem de chegada', () => {
  const fora = path.join(casa, 'ordem.jsonl')
  gravar([{ id: 'CC-10', titulo: 'a', estado: 'B0', frente: 'fundacao' }, { id: 'CC-2', titulo: 'b', estado: 'B0', frente: 'fundacao' }], fora)
  assert.deepEqual(ler(fora).itens.map((i) => i.id), ['CC-2', 'CC-10'])
})

/* CC-557: a fila do agente, especificação primeiro. */
t('fila: sozinho, sem especificação e dele, com ideia e fechado de fora', () => {
  const it = (id, campos) => ({ id, titulo: id, estado: 'B1', criado: '2026-09-01', ...campos })
  const f = filaDoAgente([
    it('A', { pronto: 'a tela mostra X', conferir: 'auto:teste Y' }),
    it('B', { pronto: 'foto em 390', conferir: 'olho:foto' }),
    it('C', { pronto: '', conferir: null }),
    it('D', { pronto: 'ele aprova', conferir: 'dele:abrir no telefone' }),
    it('E', { pronto: 'x feito e provado', conferir: 'auto:y', trava: 'dele' }),
    it('F', { estado: 'B0', pronto: 'ideia', conferir: 'auto:z' }),
    it('G', { estado: 'OK', pronto: 'fechado ja', conferir: 'auto:z' }),
    it('H', { estado: 'EM', pronto: 'em curso agora', conferir: 'auto:w', criado: '2026-09-20' }),
  ])
  assert.deepEqual(f.sozinho.map((x) => x.id), ['H', 'A', 'B'], 'em curso primeiro, depois os mais antigos')
  assert.deepEqual(f.semEspec.map((x) => x.id), ['C'])
  assert.deepEqual(f.dele.map((x) => x.id).sort(), ['D', 'E'])
})
t('especificar grava pronto e conferir, e recusa conferir sem modo válido', () => {
  const arq = path.join(casa, 'espec.jsonl')
  acrescentar({ titulo: 'coisa a especificar', frente: 'fundacao', natureza: 'PED', area: 'tela', tamanho: 'P', conferir: 'auto:x', pronto: 'provisorio', risco: 'local', origem: 'felipe', citacao: 'x', intencao: 'x' }, arq)
  const id = ler(arq).itens[0].id
  const i = especificar(id, { pronto: 'a lista mostra os itens do filtro', conferir: 'auto:teste de tela' }, arq)
  assert.equal(i.pronto, 'a lista mostra os itens do filtro')
  assert.throws(() => especificar(id, { conferir: 'talvez:nao sei' }, arq))
})

/* Padrão de projeto (01/10): a micro tarefa é filha do item, no mesmo arquivo. */
t('micro tarefas: filhas herdam do pai, ROADMAP mostra o andamento e nao lista as filhas', () => {
  const arq = path.join(casa, 'filhas.jsonl')
  const base = { natureza: 'PED', area: 'tela', tamanho: 'M', pronto: 'o contador aparece no canto', conferir: 'olho:abrir o jogo', risco: 'local', origem: 'felipe' }
  const pai = acrescentar({ ...base, intencao: 'contador de monstros', frente: 'padrao', estado: 'B1' }, arq)
  const f1 = acrescentar({ pai: pai.id, intencao: 'criar o elemento na tela', pronto: 'o elemento existe no html', conferir: 'auto:npm run build', estado: 'B1' }, arq)
  acrescentar({ pai: pai.id, intencao: 'contar as mortes', pronto: 'o número sobe ao matar', conferir: 'auto:npm run build', estado: 'B1' }, arq)
  assert.equal(f1.frente, 'padrao'); assert.equal(f1.natureza, 'PED'); assert.equal(f1.tamanho, 'P')
  const md = comoMarkdown(arq)
  assert.ok(md.includes(`| ${pai.id} | definida · 0 de 2 |`), 'o pai mostra o andamento')
  assert.ok(!md.includes('criar o elemento na tela'), 'a filha não vira linha do mapa')
  assert.equal(retrato(arq).abertos, 1, 'conta o pedido, não as micro tarefas')
})
t('micro tarefas: a fila entrega as filhas e esconde o pai; a 1a filha andando poe o pai andando', () => {
  const arq = path.join(casa, 'filhas.jsonl')
  const { itens } = ler(arq)
  const [pai, f1, f2] = itens
  const fila = filaDoAgente(itens).sozinho.map((x) => x.id)
  assert.deepEqual(fila, [f1.id, f2.id], 'só as filhas, na ordem')
  mover(f1.id, 'EM', {}, arq)
  assert.equal(ler(arq).itens.find((x) => x.id === pai.id).estado, 'EM')
})
recusa('micro tarefas: o pai nao fecha com filha aberta', () => {
  const arq = path.join(casa, 'filhas.jsonl')
  mover(ler(arq).itens[0].id, 'OK', { prova: 'x' }, arq)
}, 'micro tarefa(s) aberta(s)')
t('micro tarefas: com todas as filhas fechadas o pai fecha, e o pai some da fila so enquanto tem filha aberta', () => {
  const arq = path.join(casa, 'filhas.jsonl')
  const [pai, f1, f2] = ler(arq).itens
  mover(f1.id, 'OK', { prova: 'build passou' }, arq); mover(f2.id, 'OK', { prova: 'build passou' }, arq)
  assert.ok(comoMarkdown(arq).includes('2 de 2'))
  assert.deepEqual(filaDoAgente(ler(arq).itens).sozinho.map((x) => x.id), [pai.id], 'sem filha aberta, o pai volta para a fila')
  assert.equal(mover(pai.id, 'OK', { prova: 'as duas micro tarefas passaram' }, arq).estado, 'OK')
})
recusa('micro tarefas: pai que nao existe e recusado', () => acrescentar({ pai: 'CC-999', intencao: 'x', pronto: 'xxxxxxxxxx', conferir: 'auto:x', natureza: 'PED', area: 'tela', tamanho: 'P' }, path.join(casa, 'filhas.jsonl')), 'não existe')
recusa('micro tarefas: filha de filha e recusada', () => {
  const arq = path.join(casa, 'filhas.jsonl')
  acrescentar({ pai: ler(arq).itens[1].id, intencao: 'neta', pronto: 'xxxxxxxxxx', conferir: 'auto:x' }, arq)
}, 'não tem neta')

/* CC-836 (Nisaba): o diário da tarefa, só por acréscimo. */
t('diário: criar, mover e o efeito no pai viram eventos, e a fala dele entra na história', () => {
  const arq = path.join(casa, 'diario', 'backlog.jsonl')
  const base = { frente: 'padrao', natureza: 'PED', area: 'tela', tamanho: 'M', pronto: 'o placar aparece', conferir: 'auto:npm test', estado: 'B1' }
  const pai = acrescentar({ ...base, intencao: 'placar', citacao: 'quero ver quantos matei' }, arq)
  const f = acrescentar({ pai: pai.id, intencao: 'somar', pronto: 'soma ao matar', conferir: 'auto:npm test', estado: 'B1' }, arq)
  debater(pai.id, 'no meio da tela, grande', {}, arq)
  mover(f.id, 'EM', {}, arq)
  mover(f.id, 'OK', { prova: 'build passou' }, arq)
  const h = historia(pai.id, arq).map((e) => `${e.id}:${e.tipo}:${e.para || e.texto || ''}`)
  assert.deepEqual(h, [
    `${pai.id}:criada:quero ver quantos matei`, `${f.id}:criada:`, `${pai.id}:fala:no meio da tela, grande`,
    `${f.id}:estado:EM`, `${pai.id}:estado:EM`, `${f.id}:estado:OK`, `${pai.id}:estado:PR`,
  ])
  assert.equal(historia(pai.id, arq).find((e) => e.id === f.id && e.para === 'OK').porque, 'build passou', 'o motivo viaja junto')
})
t('diário: só cresce, nunca reescreve, e ficar no mesmo estado não polui', () => {
  const arq = path.join(casa, 'diario', 'backlog.jsonl')
  const antes = fs.readFileSync(caminhoEventos(arq), 'utf8')
  mover(ler(arq).itens[0].id, 'PR', { nota: 'x' }, arq)
  assert.ok(fs.readFileSync(caminhoEventos(arq), 'utf8').startsWith(antes), 'o que já estava continua igual')
  assert.equal(fs.readFileSync(caminhoEventos(arq), 'utf8'), antes, 'mesmo estado não gera evento')
})
recusa('diário: tipo de fala desconhecido é recusado', () => debater(ler(path.join(casa, 'diario', 'backlog.jsonl')).itens[0].id, 'x', { tipo: 'ordem' }, path.join(casa, 'diario', 'backlog.jsonl')), 'tipo de fala desconhecido')
recusa('diário: fala em tarefa que não existe é recusada', () => debater('ZZ-1', 'x', {}, path.join(casa, 'diario', 'backlog.jsonl')), 'não achei')

// CC-521: a frente é um código de uma palavra do catálogo do projeto (docs/frentes.json)
import { catalogoDe, ehFrente } from './src/frentes.mjs'
const CAT = catalogoDe(path.join(process.cwd(), 'docs', 'backlog.jsonl'))
t('CC-521: todo código do catálogo é uma palavra [a-z0-9]+ com descrição', () => {
  assert.ok(CAT, 'docs/frentes.json sumiu ou está quebrado')
  for (const [c, d] of Object.entries(CAT)) {
    assert.match(c, /^[a-z0-9]+$/, `código fora do formato: ${c}`)
    assert.ok(String(d).length > 10, `frente ${c} sem descrição`)
  }
})
t('CC-521: o backlog de verdade não tem item aberto com frente fora do catálogo', () => {
  const real = ler(path.join(process.cwd(), 'docs', 'backlog.jsonl')).itens
  const fora = real.filter((i) => i.estado !== 'OK' && i.estado !== 'KO' && !ehFrente(i.frente, CAT)).map((i) => `${i.id}:${i.frente}`)
  assert.deepEqual(fora, [], 'item aberto com frente de texto livre: ' + fora.join(', '))
})
const comCatalogo = path.join(casa, 'frentes', 'docs', 'backlog.jsonl')
fs.mkdirSync(path.dirname(comCatalogo), { recursive: true })
fs.writeFileSync(path.join(path.dirname(comCatalogo), 'frentes.json'), JSON.stringify({ cockpit: 'o painel do cockpit inteiro' }))
recusa('CC-521: item novo com frente fora do catálogo é recusado, e a mensagem lista as válidas', () => {
  acrescentar({ titulo: 'x', frente: 'cockpit novo', permitirAntigo: true }, comCatalogo)
}, 'fora do catálogo do projeto')
t('CC-521: com a frente do catálogo o item entra; fechado com texto livre antigo não é cobrado', () => {
  const i = acrescentar({ titulo: 'x', frente: 'cockpit', permitirAntigo: true }, comCatalogo)
  assert.equal(i.frente, 'cockpit')
  assert.equal(problemas({ id: 'CC-9', titulo: 'velho', estado: 'OK', prova: 'p', frente: 'Frente nova de 2026' }, CAT).length, 0)
})
t('CC-521: projeto sem docs/frentes.json não é cobrado (os outros projetos da VPS têm as suas frentes)', () => {
  const i = acrescentar({ titulo: 'x', frente: 'texto livre qualquer', permitirAntigo: true }, path.join(casa, 'semcat', 'backlog.jsonl'))
  assert.equal(i.frente, 'texto livre qualquer')
})

// CC-873: o contar por estado, sem contar micro tarefa
import { contarPorEstado } from './src/backlog.mjs'
t('CC-873: contarPorEstado conta cada estado pelo rótulo e deixa as micro tarefas de fora', () => {
  const c = contarPorEstado([
    { id: 'CC-1', estado: 'B1' }, { id: 'CC-2', estado: 'B1' }, { id: 'CC-3', estado: 'OK' },
    { id: 'CC-4', estado: 'B1', pai: 'CC-1' }, { id: 'CC-5', estado: 'KO' }, null, { id: 'CC-6', estado: 'XX' },
  ])
  assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 4, 'micro tarefa, item nulo e estado inexistente não contam')
  assert.equal(Object.keys(contarPorEstado([])).length, ESTADOS.length, 'todo estado aparece, mesmo com zero')
  assert.equal(c[ESTADOS.find((e) => e.codigo === 'B1').rotulo], 2)
})

// CC-920 (F1): aprovar provas pelo olho dele. A lógica das rotas, em pasta temporária.
import { podeAprovarPorOlho } from './src/backlog.mjs'
import { aprovar, cartasDeProvas, _limpar as limparProvas } from './src/provas.mjs'
import { pendencias, _limpar as limparEspera } from './src/esperaDele.mjs'
{
  const raiz = path.join(casa, 'proj-provas')
  const arqP = path.join(raiz, 'docs', 'backlog.jsonl')
  const it = (id, estado, extra = {}) => ({ id, titulo: id, intencao: `item ${id}`, estado, frente: 'f', criado: '2026-10-01', mexido: '2026-10-03', depende: [], origem: 'agente', natureza: 'PED', area: 'tela', tamanho: 'P', pronto: 'pronto quando X', ...extra })
  const recomeca = () => {
    gravar([
      it('PV-001', 'PR', { conferir: 'dele: ver no celular', prova: 'robô passou' }), it('PV-002', 'PR', { conferir: 'auto:npm test', prova: 'x' }),
      it('PV-003', 'PR', { conferir: 'olho: ver a tela', prova: 'print' }), it('PV-004', 'EM', { conferir: 'dele: x' }),
    ], arqP)
    fs.rmSync(caminhoEventos(arqP), { force: true }) // diário limpo a cada caso
    limparProvas(); limparEspera()
  }
  const ctx = { raizes: [raiz], agora: new Date(2026, 9, 4) }
  const estadoDe = (id) => ler(arqP).itens.find((x) => x.id === id)

  t('CC-920: podeAprovarPorOlho aceita PR com olho: ou dele:, recusa auto: e outro estado', () => {
    recomeca()
    const p = (id) => podeAprovarPorOlho(estadoDe(id))
    assert.deepEqual(['PV-001', 'PV-002', 'PV-003', 'PV-004'].map(p), [true, false, true, false])
  })
  t('CC-920: as cartas só trazem o que o olho dele pode aprovar', () => {
    recomeca()
    const c = cartasDeProvas({ raizes: [raiz] })
    assert.deepEqual(c.map((x) => x.id), ['PV-001', 'PV-003'])
    assert.deepEqual(c[0], { id: 'PV-001', raiz, projeto: 'proj-provas', titulo: 'item PV-001', porque: 'robô passou', opcoes: ['Aprovo', 'Não aprovo'], origem: 'prova' })
  })
  t('CC-920: "Aprovo" fecha com a prova acrescida, e a pendência some da fila dele', () => {
    recomeca()
    assert.ok(pendencias({ raizes: [raiz] }).some((x) => x.item === 'PV-001'), 'antes: está na fila')
    const r = aprovar({ raiz, ids: ['PV-001'], escolha: 'Aprovo' }, ctx)
    assert.deepEqual(r.resultados, { 'PV-001': { ok: true } })
    assert.equal(estadoDe('PV-001').estado, 'OK')
    assert.equal(estadoDe('PV-001').prova, 'robô passou; dele: aprovado no Tinder em 04/10')
    assert.equal(pendencias({ raizes: [raiz] }).some((x) => x.item === 'PV-001'), false, 'depois: saiu da fila')
    assert.equal(cartasDeProvas({ raizes: [raiz] }).some((x) => x.id === 'PV-001'), false, 'e das cartas')
  })
  t('CC-920: prova "auto:" é recusada e não derruba as outras (resposta parcial)', () => {
    recomeca()
    const r = aprovar({ raiz, ids: ['PV-002', 'PV-003', 'PV-009'], escolha: 'Aprovo' }, ctx)
    assert.match(r.resultados['PV-002'].erro, /não é uma prova/)
    assert.match(r.resultados['PV-009'].erro, /não achei/)
    assert.equal(r.resultados['PV-003'].ok, true)
    assert.equal(estadoDe('PV-002').estado, 'PR'); assert.equal(estadoDe('PV-003').estado, 'OK')
  })
  t('CC-920: "Não aprovo" volta a EM com o motivo no diário', () => {
    recomeca()
    const r = aprovar({ raiz, ids: ['PV-001'], escolha: 'Não aprovo', nota: 'o botão corta no celular' }, ctx)
    assert.equal(r.resultados['PV-001'].ok, true)
    assert.equal(estadoDe('PV-001').estado, 'EM')
    const h = historia('PV-001', arqP)
    assert.ok(h.some((e) => e.tipo === 'decisao' && e.de === 'felipe' && e.texto === 'o botão corta no celular'))
    assert.ok(h.some((e) => e.tipo === 'estado' && e.para === 'EM' && /botão corta/.test(e.porque)))
  })
  t('CC-920: id repetido na lista aprova uma vez só', () => {
    recomeca()
    const r = aprovar({ raiz, ids: ['PV-001', 'PV-001', 'PV-001'], escolha: 'Aprovo' }, ctx)
    assert.deepEqual(Object.keys(r.resultados), ['PV-001'])
    assert.equal(historia('PV-001', arqP).filter((e) => e.tipo === 'estado' && e.para === 'OK').length, 1)
  })
  recusa('CC-920: projeto fora da lista, escolha inventada e lista grande demais são recusados', () => aprovar({ raiz: '/outro', ids: ['PV-001'], escolha: 'Aprovo' }, ctx), 'projeto desconhecido')
  recusa('CC-920: escolha inventada', () => aprovar({ raiz, ids: ['PV-001'], escolha: 'Talvez' }, ctx), 'escolha')
  recusa('CC-920: mais de 50 ids', () => aprovar({ raiz, ids: Array.from({ length: 51 }, (_, k) => 'P-' + k), escolha: 'Aprovo' }, ctx), 'no máximo')
}

t('CC-945: pasta com número no nome gera sigla só de letras', () => {
  for (const p of ['9', 'd3', 'VPS_entreg4', '3dmundo', 'dengonator2000']) assert.match(siglaDe(p), /^[A-Z]{2,4}$/, p + ' deu ' + siglaDe(p))
  assert.equal(siglaDe('VPS_entreg4'), 'EN', 'a tabela fixa continua valendo antes da regra')
  assert.equal(siglaDe('dengonator2000'), 'DN')
})

t('CC-956: o comando de criar tarefa e o de micro tarefa usam o código do próprio projeto', () => {
  const cli = fs.readFileSync(new URL('./cc.mjs', import.meta.url), 'utf8')
  const n = (cli.match(/B\.acrescentar\(\{\s*(?:\/\/[^\n]*\n\s*)?prefixo: B\.prefixoDoProjeto\(B\.ler\(\)\.itens, process\.cwd\(\)\)/g) || []).length
  assert.equal(n, 2, 'os dois pontos de criação do comando passam o código do projeto')
})

/* CC-958: a fila mista. O Caminho é a prioridade; o lugar que ele escolhe manda. */
const itL = (id, x) => ({ id, titulo: id, estado: 'B1', criado: '2026-09-01', pronto: 'pronto escrito aqui', conferir: 'auto:x', ...x })
const L = (onde, em = '2026-10-07T12:00:00.000Z') => ({ lugar: { onde, em } })
t('CC-958: a fila mista segue o Caminho: andando, agora, fim do dia, sprint atual, fim do sprint, próximos, fim do backlog; fora não entra', () => {
  const f = filaDoAgente([
    itL('CC-1'), itL('CC-2', { criado: '2026-08-01' }), itL('CC-3'), itL('CC-4', L('sprint')), itL('CC-5', L('agora')),
    itL('CC-6', L('dia', '2026-10-07T15:00:00.000Z')), itL('CC-7', L('dia', '2026-10-06T15:00:00.000Z')), itL('CC-8', L('backlog')),
    itL('CC-9', L('fora')), itL('CC-10', { estado: 'EM' }), itL('CC-11', { titulo: '(depois do MVP) importar do Garmin' }),
    itL('CC-12', L('backlog')), itL('CC-13', { estado: 'PR' }),
  ], { sprint: new Set(['CC-2', 'CC-3', 'CC-12']) })
  assert.deepEqual(f.sozinho.map((x) => x.id), ['CC-10', 'CC-5', 'CC-7', 'CC-6', 'CC-2', 'CC-3', 'CC-4', 'CC-1', 'CC-13', 'CC-8', 'CC-12'])
  assert.equal(f.proximo.id, 'CC-10')
})
t('CC-958: o que espera ele segue a mesma lógica de lugar', () => {
  const f = filaDoAgente([itL('CC-20', { conferir: 'dele:x' }), itL('CC-21', { conferir: 'dele:y', ...L('agora') }), itL('CC-22', { conferir: 'dele:z', ...L('fora') })])
  assert.deepEqual(f.dele.map((x) => x.id), ['CC-21', 'CC-20'])
})
t('CC-958: a micro tarefa vai no lugar do pai', () => {
  const f = filaDoAgente([itL('CC-30', { ...L('agora'), criado: '2026-09-10' }), itL('CC-31', { pai: 'CC-30' }), itL('CC-32', { criado: '2026-09-01' })])
  assert.deepEqual(f.sozinho.map((x) => x.id), ['CC-31', 'CC-32'])
})
t('CC-958: porNoLugar grava o lugar com a data, promove a ideia e registra no diário; nenhum tira o lugar', () => {
  const arq3 = path.join(casa, 'lugar', 'docs', 'backlog.jsonl')
  const ideia = (titulo) => acrescentar({ titulo, intencao: titulo, frente: 'fundacao', natureza: 'PED', area: 'tela', tamanho: 'P', conferir: 'dele:ver', pronto: 'ele olha e aprova a ideia', risco: 'local', origem: 'emenda', citacao: 'x', estado: 'B0' }, arq3)
  const a = ideia('ideia que ganha lugar')
  assert.equal(a.estado, 'B0')
  const agora = new Date(2026, 9, 7, 10)
  const n = porNoLugar(a.id, 'dia', { agora }, arq3)
  assert.equal(n.estado, 'B1')
  assert.equal(n.lugar.onde, 'dia')
  assert.equal(n.lugar.em, agora.toISOString())
  assert.ok(historia(a.id, arq3).some((e) => e.tipo === 'lugar' && e.texto === 'fim do dia'))
  assert.equal(porNoLugar(a.id, 'nenhum', {}, arq3).lugar, null)
  const b = ideia('ideia que fica guardada')
  assert.equal(porNoLugar(b.id, 'fora', {}, arq3).estado, 'B0')
  recusa('CC-958: lugar inventado é recusado', () => porNoLugar(a.id, 'amanha', {}, arq3), 'lugar desconhecido')
  mover(b.id, 'KO', { porque: 'não vale' }, arq3)
  recusa('CC-958: item fechado não ganha lugar', () => porNoLugar(b.id, 'dia', {}, arq3), 'já fechou')
})
t('CC-958: rotuloDoLugar diz o que sobrou do dia anterior', () => {
  const dia = (d) => ({ estado: 'B1', lugar: { onde: 'dia', em: new Date(2026, 9, d, 15).toISOString() } })
  assert.equal(rotuloDoLugar(dia(6), '2026-10-07'), 'fim do dia, sobrou de 06/10')
  assert.equal(rotuloDoLugar(dia(7), '2026-10-07'), 'fim do dia')
  assert.equal(lugarDe({ titulo: '(depois do MVP) x', lugar: null }), null)
})
t('CC-958: sprintAtualIds lê a linha abrir cuja janela contém agora', () => {
  const raiz = path.join(casa, 'sp')
  fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'docs', 'sprints.jsonl'), [
    { tipo: 'abrir', n: 2, de: '2026-09-28T03:00:00Z', ate: '2026-10-05T03:00:00Z', itens: ['CC-1'] },
    { tipo: 'abrir', n: 3, de: '2026-10-05T03:00:00Z', ate: '2026-10-12T03:00:00Z', itens: ['CC-2', 'CC-3'] },
  ].map((l) => JSON.stringify(l)).join('\n') + '\n')
  assert.deepEqual([...sprintAtualIds(raiz, Date.parse('2026-10-07T12:00:00Z'))].sort(), ['CC-2', 'CC-3'])
  assert.equal(sprintAtualIds(path.join(casa, 'sem-sprint')).size, 0)
})

fs.rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas\n`)
