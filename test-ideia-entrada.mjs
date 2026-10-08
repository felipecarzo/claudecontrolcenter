// CC-986: a área de ideias do Caminho. Contrato do agy, montagem com sugestão e gravação. O agy NÃO é chamado: a leitura dele é de mentira.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as I from './src/ideiaEntrada.mjs'
import * as B from './src/backlog.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++ }
const tem = (fn, re, m) => { assert.throws(fn, re, m); n++ }

const boa = { intencao: 'mostrar o saldo no topo da tela', natureza: 'PED', area: 'tela', tamanho: 'P', pronto: 'o saldo aparece no topo', conferir: 'olho: abrir a tela e ler o saldo' }
const mae = { intencao: 'painel de saldo com aviso de saldo baixo', natureza: 'PED', area: 'tela', tamanho: 'M', pronto: 'o saldo e o aviso aparecem na tela', conferir: 'olho: abrir a tela e ler o saldo' }
const esc1 = { pergunta: 'o saldo fica no topo ou no rodapé?', opcoes: ['topo', 'rodapé'] }
const json = (o) => JSON.stringify(o)
const quebra = (partes = [boa], escolhas = [], ideia = mae) => json({ ideia, escolhas, partes })

// o contrato
const v1 = I.validarQuebra(quebra())
ok(v1.ok && v1.ideia.intencao === mae.intencao && v1.partes.length === 1 && v1.escolhas.length === 0, 'JSON puro bom passa: mãe e uma parte')
ok(I.validarQuebra('```json\n' + quebra([boa, { ...boa, area: 'dado' }]) + '\n```').partes.length === 2, 'bloco ```json passa, com duas partes')
ok(I.validarQuebra(quebra([])).ok, 'mãe sem partes passa (ideia simples)')
ok(!I.validarQuebra(json({ tarefas: [boa] })).ok && !I.validarQuebra(json({ partes: [boa] })).ok, 'formato velho ou sem "ideia" é recusado')
ok(!I.validarQuebra(quebra([boa], [], { ...mae, natureza: 'XXX' })).ok, 'natureza da mãe fora da escala é recusada')
ok(!I.validarQuebra(quebra([{ ...boa, natureza: 'XXX' }])).ok, 'natureza de uma parte fora da escala é recusada')
ok(!I.validarQuebra(quebra([{ ...boa, area: 'banana' }])).ok, 'área fora da escala é recusada')
ok(!I.validarQuebra(quebra([{ ...boa, tamanho: 'GG' }])).ok, 'tamanho fora da escala é recusado')
ok(!I.validarQuebra(quebra([{ ...boa, conferir: 'talvez: ver' }])).ok, 'modo de conferir fora da lista é recusado')
ok(!I.validarQuebra(quebra([{ ...boa, conferir: 'olho:' }])).ok, 'conferir sem o quê é recusado')
ok(!I.validarQuebra(quebra([{ ...boa, intencao: 'a'.repeat(141) }])).ok, 'intenção acima de 140 letras é recusada')
ok(I.validarQuebra(quebra([{ ...boa, intencao: 'a'.repeat(140) }])).ok, 'intenção de 140 letras passa')
ok(!I.validarQuebra(quebra([{ ...boa, pronto: 'fica pronto — e pronto' }])).ok, 'travessão é recusado')
ok(!I.validarQuebra(quebra([boa, boa, boa, boa, boa, boa, boa])).ok, 'mais de 6 partes é recusado')
ok(I.validarQuebra(quebra([boa, boa, boa, boa, boa, boa])).ok, 'seis partes passam')
ok(!I.validarQuebra('desculpe, não consegui').ok && !I.validarQuebra('').ok, 'sem JSON e vazio são recusados')
ok(I.validarQuebra(quebra([boa], [], { ...mae, frente: 'loja' }), { frentes: { loja: 'x' } }).ideia.frente === 'loja', 'frente do catálogo é mantida na mãe')
ok(I.validarQuebra(quebra([boa], [], { ...mae, frente: 'inventada' }), { frentes: { loja: 'x' } }).ideia.frente === undefined, 'frente fora do catálogo cai, sem recusar a quebra')
// as escolhas dele
const ve = I.validarQuebra(quebra([], [esc1]))
ok(ve.ok && ve.escolhas.length === 1 && ve.escolhas[0].opcoes.length === 2 && ve.partes.length === 0, 'escolha com 2 opções passa, com partes vazias')
ok(I.validarQuebra(quebra([], [{ pergunta: 'qual?', opcoes: ['a', 'b', 'c', 'd'] }])).ok, 'escolha com 4 opções passa')
ok(!I.validarQuebra(quebra([], [{ pergunta: 'qual?', opcoes: ['só uma'] }])).ok, 'escolha com 1 opção é recusada')
ok(!I.validarQuebra(quebra([], [{ pergunta: 'qual?', opcoes: ['a', 'b', 'c', 'd', 'e'] }])).ok, 'escolha com 5 opções é recusada')
ok(!I.validarQuebra(quebra([], [{ pergunta: '', opcoes: ['a', 'b'] }])).ok, 'escolha sem pergunta é recusada')
ok(!I.validarQuebra(quebra([], [{ pergunta: 'a — b?', opcoes: ['a', 'b'] }])).ok, 'travessão na escolha é recusado')
ok(I.validarQuebra(quebra([], [esc1, esc1, esc1])).ok && !I.validarQuebra(quebra([], [esc1, esc1, esc1, esc1])).ok, 'até 3 escolhas passam, 4 não')
ok(I.validarQuebra(quebra([boa], [esc1])).partes.length === 0, 'com escolha pendente as partes ficam de lado')
ok(I.validarQuebra(quebra([boa]), { comRespostas: true }).ok, 'com respostas, mãe e partes passam')
ok(!I.validarQuebra(quebra([boa], [esc1]), { comRespostas: true }).ok, 'com respostas, perguntar de novo é recusado')
ok(!I.validarQuebra(quebra([]), { comRespostas: true }).ok, 'com respostas, sem partes é recusado')

// o pedido leva o texto, as escalas, os abertos recentes e as respostas
const ped = I.pedidoDeQuebra('quero ver o saldo', { projeto: 'VPS_demo', frentes: { loja: 'a loja' }, abertos: [{ id: 'DM-001', estado: 'B1', criado: '2026-10-01', intencao: 'tarefa velha' }, { id: 'DM-002', estado: 'OK', criado: '2026-10-02', intencao: 'fechada' }] })
ok(ped.includes('quero ver o saldo') && ped.includes('VPS_demo') && ped.includes('loja (a loja)') && ped.includes('DM-001') && !ped.includes('DM-002'), 'pedido traz texto, projeto, frentes e só os abertos')
ok(ped.includes('"ideia"') && ped.includes('"escolhas"') && ped.includes('"partes"') && /decisão do dono NUNCA é parte/.test(ped) && !ped.includes('ESCOLHAS JÁ FEITAS'), 'pedido explica mãe, partes e escolhas')
const pedR = I.pedidoDeQuebra('quero ver o saldo', { projeto: 'VPS_demo', respostas: [{ pergunta: 'topo ou rodapé?', resposta: 'topo' }] })
ok(pedR.includes('ESCOLHAS JÁ FEITAS') && pedR.includes('topo ou rodapé? => topo') && pedR.includes('escolhas vem vazio'), 'com respostas, o pedido leva as escolhas e manda o agy não perguntar')
ok(!/[—–]/.test(ped + pedR), 'o pedido não tem travessão')
tem(() => I.limparRespostas([{ pergunta: 'a', resposta: '' }]), /resposta/, 'resposta vazia é recusada')
tem(() => I.limparRespostas([{ pergunta: 'a', resposta: 'x'.repeat(301) }]), /acima/, 'resposta enorme é recusada')
tem(() => I.limparRespostas('x'), /respostas/, 'respostas que não são lista são recusadas')

// projeto de mentira, sempre em pasta temporária
const base = mkdtempSync(join(tmpdir(), 'ideia-'))
try {
  const raiz = join(base, 'VPS_demo'); mkdirSync(join(raiz, 'docs'), { recursive: true })
  writeFileSync(join(raiz, 'docs', 'frentes.json'), JSON.stringify({ loja: 'a loja', pagamento: 'o pagamento' }))
  const it = (id, estado, frente, criado) => ({ id, titulo: `item ${id}`, intencao: `item ${id}`, estado, frente, criado, mexido: criado, depende: [], origem: 'agente' })
  B.gravar([it('DM-001', 'OK', 'loja', '2026-09-01'), it('DM-002', 'EM', 'loja', '2026-09-10')], B.caminhoPadrao(raiz))

  // agy de mentira: guarda o que foi pedido e devolve o que o teste mandar
  const falso = (resposta) => {
    const pedidos = []
    return { pedidos, pedirTexto: (p) => pedidos.push(p), obterTexto: () => resposta.pronto || null, falhaDe: () => resposta.erro || null }
  }
  const texto = 'e se o saldo aparecesse no topo ou no rodapé da tela? e também um aviso quando ficar baixo'

  const espera = falso({ pronto: { estado: 'resumindo' } })
  ok(I.organizar(raiz, texto, { agy: espera }).estado === 'resumindo', 'enquanto o agy trabalha, devolve o estado')
  ok(espera.pedidos.length === 1 && espera.pedidos[0].k.startsWith('ideia::'), 'pede ao agy com chave ideia::')
  I.organizar(raiz, texto, { agy: espera })
  ok(espera.pedidos[1].k === espera.pedidos[0].k, 'o mesmo texto e a mesma pasta têm a mesma chave')
  ok(espera.pedidos[0].k !== (() => { const o = falso({}); I.organizar(raiz, texto + ' x', { agy: o }); return o.pedidos[0].k })(), 'texto outro, chave outra')
  const respostas = [{ pergunta: esc1.pergunta, resposta: 'topo' }]
  const comResp = falso({ pronto: { estado: 'resumindo' } })
  I.organizar(raiz, texto, { agy: comResp, respostas })
  ok(comResp.pedidos[0].k !== espera.pedidos[0].k && comResp.pedidos[0].prompt.includes('topo'), 'a chave inclui as respostas, e o pedido leva a resposta')
  tem(() => I.organizar(raiz, '   ', { agy: espera }), /ideia/, 'texto vazio é recusado em voz alta')
  tem(() => I.organizar(raiz, texto, { agy: espera, respostas: [{ pergunta: 'a' }] }), /resposta/, 'resposta torta é recusada em voz alta')

  // escolha sem resposta: devolve só as escolhas
  const pergunta = I.organizar(raiz, texto, { agy: falso({ pronto: { texto: quebra([], [esc1]) } }) })
  ok(pergunta.escolhas?.length === 1 && pergunta.escolhas[0].opcoes[1] === 'rodapé' && !pergunta.partes && !pergunta.semIA, 'escolha sem resposta devolve { escolhas } e nada de partes')
  // com resposta: mãe, partes e a sugestão do lugar da mãe
  const certo = I.organizar(raiz, texto, { agy: falso({ pronto: { texto: quebra([boa, { ...boa, intencao: 'avisar quando o saldo ficar baixo' }]) } }), respostas })
  ok(certo.ideia.intencao === mae.intencao && certo.partes.length === 2 && !certo.semIA, 'saída boa vira a mãe e as partes')
  ok(['agora', 'dia', 'sprint', 'backlog', 'fora'].includes(certo.sugestao.onde) && certo.sugestao.porque, 'a mãe vem com a sugestão de lugar')
  ok(certo.ideia.frente === 'loja' && certo.partes.every((p) => !('sugestao' in p)), 'sem frente do agy, vale a frente atual; só a mãe leva sugestão')
  const pergunta2 = I.organizar(raiz, texto, { agy: falso({ pronto: { texto: quebra([boa], [esc1]) } }), respostas })
  ok(pergunta2.semIA && /fora do formato/.test(pergunta2.semIA) && pergunta2.partes.length === 0, 'agy perguntando de novo depois da resposta cai na reserva')

  const lixo = I.organizar(raiz, texto, { agy: falso({ pronto: { texto: 'não sei fazer isso' } }) })
  ok(lixo.partes.length === 0 && /fora do formato/.test(lixo.semIA) && lixo.sugestao.onde, 'lixo vira só a mãe com o texto dele, sem partes, com o motivo')
  ok(lixo.ideia.intencao.startsWith('e se o saldo'), 'a mãe de reserva guarda o que ele ditou')
  const falha = I.organizar(raiz, texto, { agy: falso({ erro: 'tempo esgotado' }) })
  ok(falha.partes.length === 0 && /tempo esgotado/.test(falha.semIA) && falha.ideia.intencao, 'falha do agy vira só a mãe, com o motivo')
  ok(I.organizar(raiz, texto, { agy: falso({}) }).semIA === 'o agy não respondeu', 'agy fora do ar também não perde a ideia')
  const longo = I.organizar(raiz, 'x'.repeat(500) + ' — fim', { agy: falso({}) }).ideia.intencao
  ok(longo.length <= 140 && !/[—–]/.test(longo), 'a reserva respeita o teto de 140 e não tem travessão')
  ok(B.problemasDoFormato(lixo.ideia).length === 0, 'a mãe de reserva já está no formato do backlog')

  // gravar: tudo ou nada, lugar obrigatório, citação inteira
  const antes = B.ler(B.caminhoPadrao(raiz)).itens.length
  const eventosAntes = existsSync(B.caminhoEventos(B.caminhoPadrao(raiz))) ? readFileSync(B.caminhoEventos(B.caminhoPadrao(raiz)), 'utf8') : ''
  const g = (o) => () => I.gravar(raiz, { texto, ideia: mae, partes: [boa], lugar: 'sprint', respostas, ...o })
  tem(g({ lugar: undefined }), /lugar/, 'mãe sem lugar é recusada')
  tem(g({ lugar: 'hoje' }), /lugar/, 'lugar desconhecido é recusado')
  tem(g({ ideia: { ...mae, natureza: 'XXX' } }), /ideia.*natureza/, 'mãe torta recusa tudo')
  tem(g({ ideia: undefined }), /ideia/, 'sem mãe, recusa')
  tem(g({ partes: [boa, { ...boa, natureza: 'XXX' }] }), /parte 2.*natureza/, 'uma parte torta recusa o lote todo, antes de gravar a mãe')
  tem(g({ partes: [boa, { ...boa, pronto: 'ok — e pronto' }] }), /travessão/, 'travessão numa parte recusa o lote')
  tem(g({ partes: [boa, boa, boa, boa, boa, boa, boa] }), /partes/, 'mais de 6 partes é recusado')
  tem(g({ ideia: { ...mae, frente: 'inventada' } }), /catálogo/, 'frente fora do catálogo é recusada antes de gravar')
  tem(g({ texto: '' }), /texto/, 'sem o texto ditado, recusa')
  tem(g({ respostas: [{ pergunta: 'a', resposta: '' }] }), /resposta/, 'resposta torta recusa antes de gravar')
  ok(B.ler(B.caminhoPadrao(raiz)).itens.length === antes, 'nenhuma recusa gravou meia coisa')
  ok((existsSync(B.caminhoEventos(B.caminhoPadrao(raiz))) ? readFileSync(B.caminhoEventos(B.caminhoPadrao(raiz)), 'utf8') : '') === eventosAntes, 'nenhuma recusa escreveu na história')

  const r = I.gravar(raiz, { texto, ideia: { ...mae, sugestao: { onde: 'x' } }, partes: [boa, { ...boa, intencao: 'avisar saldo baixo', frente: 'pagamento' }], lugar: 'agora', respostas })
  ok(/^DM-\d+$/.test(r.id) && r.filhas.length === 2 && r.filhas.every((id) => /^DM-\d+$/.test(id)), 'devolve o id da mãe e os das filhas')
  const itens = B.ler(B.caminhoPadrao(raiz)).itens
  const m = itens.find((x) => x.id === r.id); const fs2 = r.filhas.map((id) => itens.find((x) => x.id === id))
  ok(m.citacao === texto && m.origem === 'emenda' && m.lugar.onde === 'agora' && m.estado === 'B1' && m.frente === 'loja' && !m.pai, 'a mãe entra como emenda, no lugar escolhido, com o texto inteiro na citação')
  ok(fs2.every((f) => f.pai === r.id && f.estado === 'B1' && f.origem === 'emenda' && f.frente === 'loja'), 'cada filha tem o pai certo, entra em B1 como emenda e herda a frente da mãe')
  ok(!fs2.some((f) => f.lugar) && itens.length === antes + 3 && !('sugestao' in m), 'o lugar mora só na mãe, e campo extra da tela não vai para o backlog')
  ok(B.filhasDe(itens, r.id).length === 2, 'o backlog enxerga as duas como filhas da mãe')
  const hist = B.historia(r.id, B.caminhoPadrao(raiz))
  const dec = hist.filter((e) => e.tipo === 'decisao' && e.id === r.id)
  ok(dec.length === 1 && dec[0].de === 'felipe' && dec[0].texto === `${esc1.pergunta} > topo`, 'a resposta dele entra na história da mãe como decisão')
  const r0 = I.gravar(raiz, { texto, ideia: mae, partes: [], lugar: 'fora' })
  ok(r0.filhas.length === 0 && B.ler(B.caminhoPadrao(raiz)).itens.find((x) => x.id === r0.id).estado === 'B0', 'ideia sem partes e sem respostas grava só a mãe (fora do MVP fica como ideia)')
} finally { rmSync(base, { recursive: true, force: true }) }

// a tela (peça C): chama as duas rotas e tem o botão de gravar
const tela = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
ok(tela.includes('/api/ideia/organizar') && tela.includes('/api/ideia/gravar'), 'a tela chama as duas rotas de ideia')
ok(tela.includes('gravar no backlog'), 'a tela tem o rótulo "gravar no backlog"')
ok(tela.includes('respostas: E.respostas') && tela.includes('lugar: E.lugar') && tela.includes('partes: E.partes.map'), 'a tela manda respostas e, ao gravar, a mãe, as partes e o lugar')
ok(/function c2IdeiaCartao[\s\S]*E\.fase === 'escolha'[\s\S]*data-ideia-escolha/.test(tela) && tela.includes('cam-ideia-op{') && /\.cam-ideia-op\{[^}]*min-height:44px/.test(tela), 'a tela tem a fase de escolha, com botões de 44 px')
ok(tela.includes('parte da ideia acima') && tela.includes('ideia \' + esc(E.id)'), 'a tela liga as partes à mãe e diz "ideia CC-n com N partes"')
ok(!/\.cam-ideia[^{]*\{[^}]*font-size:(?:[0-9]|1[01])px/.test(tela), 'nenhuma letra abaixo de 12 px na área de ideias')

console.log(`${n} verificações, 0 falhas`)
