/**
 * CC-374 e CC-376 — o retrato das rotas e os tickets entre agentes.
 *
 * Entra no `npm test` porque não precisa de navegador nem de rede: tudo aqui é
 * leitura de arquivo num quadro montado à mão numa pasta temporária.
 *
 * **Nada escreve em dado real dele.** A casa já pagou por isto uma vez: um
 * teste que gravava nas notas de verdade é candidato à causa do apagamento de
 * 2026-08-09.
 */
import assert from 'node:assert'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { cruzamentos, foraDeComentario, lerLinha, lerQuadro, lerTickets, retratoRotas } from './src/rotas.mjs'

let passou = 0
const ok = (nome) => { console.log('  ok   ' + nome); passou++ }

function casa(quadro, { recados = null, pedidos = null } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'cc-rotas-'))
  mkdirSync(join(raiz, 'docs'), { recursive: true })
  writeFileSync(join(raiz, 'docs', 'ROTAS-ATIVAS.md'), quadro)
  if (recados) writeFileSync(join(raiz, 'docs', '.recados.json'), JSON.stringify(recados))
  if (pedidos) writeFileSync(join(raiz, 'docs', '.rotas-pedidos.json'), JSON.stringify(pedidos))
  return raiz
}

/* ── a linha vira objeto ─────────────────────────────────────────────────── */
{
  const l = lerLinha('| `front` | 🔴 ocupada | abcd1234 — a tela 🎚 continuativo 📁 src/ui.html 📁 src/web.mjs | 2026-08-27 |')
  assert.equal(l.rota, 'front')
  assert.equal(l.ocupada, true)
  assert.equal(l.dono, 'abcd1234')
  assert.equal(l.modo, 'continuativo')
  assert.deepEqual(l.arquivos, ['src/ui.html', 'src/web.mjs'])
  assert.equal(l.desde, '2026-08-27')
  ok('a linha do quadro vira rota, dono, modo, arquivos e data')
}

{
  /* A regra do dono é POSICIONAL, e é a causa do CC-362. A linha carrega o
     histórico dela inteiro, então uma sessão apenas CITADA aparece no texto sem
     nunca ter tido a rota. */
  const l = lerLinha('| `front` | 🔴 ocupada | aaaa1111 — TOMADA de bbbb2222, que estava calada | hoje |')
  assert.equal(l.dono, 'aaaa1111')
  ok('quem toma a rota é o dono, e a sessão citada no histórico não é')

  /* A prova ao contrário: se a pergunta fosse textual, como era antes, a sessão
     apenas citada passaria. É exatamente o defeito que custou dois módulos. */
  assert.equal(l.texto.includes('bbbb2222'), true)
  ok('a prova ao contrário: a sessão citada ESTÁ no texto, e mesmo assim não é dona')
}

/* ── o exemplo dentro de comentário não é rota ───────────────────────────── */
{
  const quadro = [
    '| Rota | Status | Quem | Desde |',
    '|---|---|---|---|',
    '| `real` | 🔴 ocupada | aaaa1111 — trabalho de verdade 📁 src/a.mjs | hoje |',
    '',
    '<!--',
    'Como preencher uma linha ocupada:',
    '| `feature/checkout` | 🔴 ocupada | id da sessão — "ajustando cupom" | 2026-08-12 |',
    '-->',
  ].join('\n')
  const raiz = casa(quadro)
  const linhas = lerQuadro(raiz)
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].rota, 'real')
  ok('exemplo dentro de comentário não vira rota ocupada')

  /* A prova ao contrário, e ela vale muito aqui: SEM o filtro, o exemplo entra.
     Foi o que aconteceu de verdade, três vezes: a `feature/checkout` que nunca
     existiu era contada como a oitava rota ocupada deste projeto. */
  const cru = quadro.split(/\r?\n/).map(lerLinha).filter(Boolean)
  assert.equal(cru.length, 2)
  assert.equal(cru[1].rota, 'feature/checkout')
  ok('a prova ao contrário: sem o filtro, o exemplo POSA de rota ocupada')

  rmSync(raiz, { recursive: true, force: true })
}

{
  /* Um comentário que abre e fecha na mesma linha não pode engolir o resto do
     arquivo, senão o quadro inteiro sumiria por causa de uma nota curta. */
  const linhas = foraDeComentario([
    'antes',
    '<!-- nota curta -->',
    '| `viva` | 🔴 ocupada | aaaa1111 | hoje |',
  ])
  assert.equal(linhas.includes('| `viva` | 🔴 ocupada | aaaa1111 | hoje |'), true)
  ok('comentário de uma linha só não engole o quadro inteiro')
}

/* ── o cruzamento, e o que ele NÃO enxerga ───────────────────────────────── */
{
  const linhas = [
    lerLinha('| `a` | 🔴 ocupada | aaaa1111 — 📁 src/mesmo.mjs 📁 src/so-da-a.mjs | hoje |'),
    lerLinha('| `b` | 🔴 ocupada | bbbb2222 — 📁 src/mesmo.mjs | hoje |'),
    lerLinha('| `c` | 🔴 ocupada | cccc3333 — sem declarar nada | hoje |'),
    lerLinha('| `d` | 🟢 livre | — 📁 src/mesmo.mjs | — |'),
  ]
  const c = cruzamentos(linhas)
  assert.equal(c.disputados.length, 1)
  assert.equal(c.disputados[0].arquivo, 'src/mesmo.mjs')
  assert.deepEqual(c.disputados[0].quem.map((q) => q.rota).sort(), ['a', 'b'])
  ok('arquivo com duas rotas ocupadas em cima aparece como disputa')

  /* Rota LIVRE que declara o mesmo arquivo não é disputa: ninguém a segura. */
  assert.equal(c.disputados[0].quem.length, 2)
  ok('rota livre não entra na disputa, mesmo declarando o mesmo arquivo')

  /* E o buraco declarado: quem não diz onde mexe é invisível para esta conta.
     Devolver só a lista de disputas faria a tela afirmar tranquilidade sobre o
     que não olhou. */
  assert.deepEqual(c.semArquivo.map((x) => x.rota), ['c'])
  ok('a rota que não declara arquivo sai contada à parte, e não some')
}

/* ── os tickets ──────────────────────────────────────────────────────────── */
{
  const raiz = casa('| `x` | 🟢 livre | — | — |', {
    recados: {
      recados: [
        { id: 'r1', de: 'aaaa1111', para: 'bbbb2222', tipo: 'vou_mexer', arquivo: 'src/a.mjs', em: 1000, texto: 'posso?' },
        { id: 'r2', de: 'aaaa1111', para: 'cccc3333', tipo: 'vou_mexer', arquivo: 'src/b.mjs', em: 2000, texto: 'posso?' },
        { id: 'r3', de: 'bbbb2222', para: 'aaaa1111', tipo: 'liberado', em: 3000, texto: 'pode' },
        { id: 'r4', de: 'aaaa1111', para: 'todos', tipo: 'aviso', em: 4000, texto: 'fyi' },
      ],
    },
    pedidos: {
      pedidos: [
        { id: 'p1', de: 'dddd4444', arquivo: 'src/c.mjs', rotasOcupadas: ['front'], status: 'pendente', tentativas: 3, em: 5000 },
        { id: 'p2', de: 'dddd4444', arquivo: 'src/d.mjs', rotasOcupadas: [], status: 'autorizado', tentativas: 1, em: 6000 },
      ],
    },
  })

  const t = lerTickets(raiz)
  assert.equal(t.length, 6)
  assert.equal(t[0].quando, 6000, 'mais novo primeiro')
  ok('recados e pedidos saem juntos, do mais novo para o mais velho')

  const esperando = t.filter((x) => x.pedeResposta && !x.respondido)
  /* r2 (ninguém respondeu) e p1 (pendente). r1 foi respondido por r3, no sentido
     contrário e depois dele. */
  assert.deepEqual(esperando.map((x) => x.id).sort(), ['p1', 'r2'])
  ok('só fica esperando quem pediu resposta e não recebeu')

  const aviso = t.find((x) => x.id === 'r4')
  assert.equal(aviso.pedeResposta, false)
  ok('aviso nunca fica devendo resposta, e não vira alarme falso')

  const pedido = t.find((x) => x.id === 'p1')
  assert.equal(pedido.para, null)
  assert.equal(pedido.tentativas, 3)
  ok('pedido de autorização não inventa destinatário, e carrega as tentativas')

  rmSync(raiz, { recursive: true, force: true })
}

/* ── projeto sem quadro é diferente de projeto tranquilo ─────────────────── */
{
  const vazio = mkdtempSync(join(tmpdir(), 'cc-rotas-sem-'))
  const r = retratoRotas(vazio, { projeto: 'nada' })
  assert.equal(r.usa, false)
  assert.deepEqual(r.rotas, [])
  assert.equal(r.cruzamentos, null)
  ok('projeto sem quadro diz que NÃO usa o método, em vez de posar de tranquilo')
  rmSync(vazio, { recursive: true, force: true })
}

/* ── CC-372: a coluna de pausado ─────────────────────────────────────────── */
{
  const { estadoDoItem } = await import('./src/trabalho.mjs')
  const frente = { estado: 'aberto', titulo: 'uma frente qualquer' }

  const parado = estadoDoItem(frente, { agentes: [{ status: 'idle' }, { status: 'idle' }] })
  assert.equal(parado.palavra, 'PAUSADA')
  assert.equal(parado.cor, 'paused')
  assert.equal(parado.porque, '2 agentes parados')
  ok('item com todos os agentes parados vai para PAUSADA, e diz quantos são')

  /* A prova ao contrário, e é ela que dá valor à primeira: UM agente vivo no
     meio dos parados devolve o item para ANDANDO. Sem isto, a coluna nova
     engoliria trabalho em curso, que é pior que o defeito que ela conserta. */
  const misto = estadoDoItem(frente, { agentes: [{ status: 'idle' }, { status: 'working' }] })
  assert.equal(misto.palavra, 'ANDANDO')
  assert.equal(misto.porque, '1 agente', 'conta só quem está de fato trabalhando')
  ok('a prova ao contrário: um agente vivo entre parados mantém o item ANDANDO')

  /* E o motivo de a coluna existir: até 27/08 isto devolvia ANDANDO, com a
     sessão calada havia horas. Foi o print dele de 25/08. */
  const soEsperando = estadoDoItem(frente, { agentes: [{ status: 'waiting' }] })
  assert.equal(soEsperando.palavra, 'ANDANDO')
  ok('agente que parou para te perguntar continua ANDANDO, e não pausado')

  /* Sem agente nenhum, nada muda: o caminho antigo continua inteiro. */
  assert.equal(estadoDoItem(frente, { agentes: [] }).palavra, 'NA FILA')
  ok('item sem agente segue NA FILA, o caminho de antes não mudou')
}

/* ── CC-373: nenhuma cor usada sem existir ───────────────────────────────── */
{
  const html = readFileSync('src/ui_v2.html', 'utf8')
  const css = html.slice(html.indexOf('<style>'), html.lastIndexOf('</style>'))

  const definidos = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  /* Uso COM valor reserva (`var(--x, monospace)`) é escolha deliberada e passa:
     ali quem escreveu já disse o que acontece se o token não existir. */
  const semReserva = [...css.matchAll(/var\((--[a-z0-9-]+)\s*(,)?/g)]
    .filter((m) => !m[2]).map((m) => m[1])
  const orfaos = [...new Set(semReserva.filter((v) => !definidos.has(v)))]

  assert.deepEqual(orfaos, [], 'cor usada e nunca definida: ' + orfaos.join(', ')
    + '. Variável de CSS que não existe NÃO é erro no navegador, é herança: a '
    + 'propriedade simplesmente não é aplicada, e ninguém vê. Medido em 27/08: '
    + '`--waiting` e `--failed` estavam assim, e os títulos das colunas "VOCÊ '
    + 'DECIDE" e "TRAVADA" saíam brancos e iguais entre si. Metade do código de '
    + 'cores do quadro estava morta havia semanas.')
  ok('nenhuma cor do painel é usada sem estar definida')

  /* A prova ao contrário: a rede pega mesmo? Um uso inventado tem que cair. */
  const falso = css + '\n.teste { color: var(--cor-que-nao-existe); }'
  const defsF = new Set([...falso.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  const orfaosF = [...falso.matchAll(/var\((--[a-z0-9-]+)\s*(,)?/g)]
    .filter((m) => !m[2] && !defsF.has(m[1])).map((m) => m[1])
  assert.deepEqual(orfaosF, ['--cor-que-nao-existe'])
  ok('a prova ao contrário: a rede acusa uma cor inventada')

  /* E os cinco estados do quadro continuam distinguíveis entre si, que é o
     ponto de eles serem semânticos. Cor repetida faria duas colunas dizerem a
     mesma coisa, que é o defeito que acabou de ser consertado. */
  const raiz = /:root\s*\{([^}]*)\}/g
  let blocos = ''
  for (const m of css.matchAll(raiz)) blocos += m[1]
  const valor = (t) => (blocos.match(new RegExp(t + '\\s*:\\s*([^;]+);')) || [])[1]?.trim()
  const estados = ['--working', '--waiting', '--failed', '--done', '--paused'].map(valor)
  assert.equal(new Set(estados).size, estados.length,
    'dois estados do quadro com a mesma cor: ' + estados.join(', '))
  ok('os cinco estados do quadro têm cores diferentes entre si')
}


/* ── CC-377: projeto lido que não rende cartão não pode sumir ────────────── */
{
  const { montar } = await import('./src/trabalho.mjs')

  /* O caso real do carzo: o roadmap existe, tem seções e itens, e nenhuma
     frente, porque é escrito em tabela e o leitor entende cabeçalho. */
  const emTabela = {
    projeto: 'VPS_carzo',
    raiz: '/tmp/carzo',
    mapa: { grupos: [{ titulo: 'Sprint 0', frentes: [], itens: 8 }, { titulo: 'Sprint 1', frentes: [], itens: 31 }] },
  }
  const q = montar({ projetos: [emTabela], jobs: [], pendencias: [] })
  assert.equal(q.grupos.length, 0, 'sem frente não há cartão, e isso continua certo')
  assert.equal(q.naoRenderam.length, 1)
  assert.equal(q.naoRenderam[0].projeto, 'VPS_carzo')
  assert.equal(q.naoRenderam[0].itens, 39)
  assert.match(q.naoRenderam[0].motivo, /39 item/)
  ok('projeto com itens e zero frentes aparece com o motivo, em vez de sumir')

  /* A prova ao contrário: projeto que RENDE cartão não entra na lista de
     mudos. Sem isto, a faixa acusaria todo mundo e viraria paisagem. */
  const normal = {
    projeto: 'VPS_ok',
    raiz: '/tmp/ok',
    mapa: { grupos: [{ titulo: 'Frente', frentes: [{ titulo: 'fazer algo', estado: 'aberto' }], itens: 1 }] },
  }
  const q2 = montar({ projetos: [normal], jobs: [], pendencias: [] })
  assert.equal(q2.grupos.length, 1)
  assert.equal(q2.naoRenderam.length, 0)
  ok('a prova ao contrário: projeto que rende cartão NÃO entra na faixa de avisos')

  /* E projeto sem roadmap nenhum diz isso, que é outra coisa. */
  const semArquivo = { projeto: 'VPS_nada', raiz: '/tmp/nada', mapa: null }
  const q3 = montar({ projetos: [semArquivo], jobs: [], pendencias: [] })
  assert.match(q3.naoRenderam[0].motivo, /não tem docs\/ROADMAP\.md/)
  ok('projeto sem roadmap diz que não tem o arquivo, e não que está vazio')
}


/* ── CC-378: roadmap escrito em tabela ───────────────────────────────────── */
{
  const { lerCabecalhoDeTabela, lerRoadmap } = await import('./src/roadmap.mjs')

  const cab = lerCabecalhoDeTabela('| ID | Task | Prioridade | Complexidade | Status | Depende de |')
  assert.equal(cab.id, 0)
  assert.equal(cab.tarefa, 1)
  assert.equal(cab.status, 4)
  ok('a tabela é lida pelo CABEÇALHO, e não pela posição das colunas')

  /* A prova ao contrário, e é a que impede o estrago: tabela que NÃO descreve
     trabalho continua não sendo trabalho. Um roadmap tem legenda de símbolos,
     lista de branches e quadro de fases, e todas são tabelas. */
  assert.equal(lerCabecalhoDeTabela('| Símbolo | Significado |'), null)
  assert.equal(lerCabecalhoDeTabela('| Branch | Tipo | Último commit | Estado |'), null)
  assert.equal(lerCabecalhoDeTabela('| Fase | Escopo | Sprints |'), null)
  ok('a prova ao contrário: legenda, branches e fases NÃO viram tarefa')

  const raiz = mkdtempSync(join(tmpdir(), 'cc-tabela-'))
  mkdirSync(join(raiz, 'docs'), { recursive: true })
  writeFileSync(join(raiz, 'docs', 'ROADMAP.md'), [
    '# Roadmap',
    '',
    '## Legenda',
    '',
    '| Símbolo | Significado |',
    '|---|---|',
    '| ✅ | Concluído |',
    '',
    '## Sprint 0',
    '',
    '| ID | Task | Status |',
    '|---|---|---|',
    '| INF-01 | Criar o projeto | ✅ |',
    '| INF-02 | Configurar o build | ⏳ |',
    '| INF-03 | Subir para o servidor | 🔒 |',
    '',
  ].join('\n'))

  const m = lerRoadmap(raiz)
  const todas = m.grupos.flatMap((g) => g.frentes)
  assert.equal(todas.length, 3, 'as três da tabela de tarefa, e nenhuma da legenda')
  assert.equal(todas.filter((f) => f.estado === 'feito').length, 1)
  assert.equal(todas.find((f) => /INF-03/.test(f.titulo)).estado, 'bloqueado')
  ok('linha de tabela vira item, com o estado saindo da coluna de status')

  /* ⚠️ A regressão que este teste guarda, paga em 28/08: ao ensinar o `🔒`, ele
     passou a vencer o `✅` na lista de estados, e um item CONCLUÍDO em 18/08
     voltou a ser trabalho aberto dez dias depois, sem ninguém tocar no arquivo.
     Concluído é terminal, e por isso vem primeiro na lista. */
  writeFileSync(join(raiz, 'docs', 'ROADMAP.md'),
    '## Feitas\n\n### CC-146 ✅ 18/08: o login do Google 🔒 só ele\n')
  const m2 = lerRoadmap(raiz)
  assert.equal(m2.grupos[0].frentes[0].estado, 'feito',
    'item com visto E cadeado continua FEITO: concluído é estado terminal')
  ok('a regressão guardada: visto vence cadeado, pausa e cor no mesmo título')

  rmSync(raiz, { recursive: true, force: true })
}


/* ── CC-379: a caixa de marcar também é tarefa ───────────────────────────── */
{
  const { lerRoadmap } = await import('./src/roadmap.mjs')
  const raiz = mkdtempSync(join(tmpdir(), 'cc-caixa-'))
  mkdirSync(join(raiz, 'docs'), { recursive: true })
  writeFileSync(join(raiz, 'docs', 'ROADMAP.md'), [
    '## Épico 1',
    '',
    '- [ ] Seleção múltipla e caixa de seleção',
    '- [x] Copiar e colar elemento',
    '- explicação solta que não é tarefa',
    '',
    '## Limites aceitos hoje',
    '',
    '- não há histórico de desfazer',
    '- o vídeo sai só em 1080p',
    '',
    '## Com frentes próprias',
    '',
    '### Uma frente de verdade',
    '',
    '- [ ] subtarefa dela',
    '',
  ].join('\n'))

  const m = lerRoadmap(raiz)
  const epico = m.grupos.find((g) => /Épico/.test(g.titulo))
  assert.equal(epico.frentes.length, 2, 'as duas com caixa viram cartão')
  assert.equal(epico.frentes.filter((f) => f.estado === 'feito').length, 1)
  ok('item com caixa de marcar vira cartão quando o grupo não tem frente própria')

  /* A prova ao contrário, e ela é a que decide: traço SEM caixa continua sendo
     explicação. Medido em 28/08, é o que separa 104 tarefas reais dos 34
     "Limites aceitos hoje" deste projeto, que não são trabalho nenhum. */
  const limites = m.grupos.find((g) => /Limites/.test(g.titulo))
  assert.equal(limites.frentes.length, 0,
    'traço sem caixa é explicação, e um quadro com lixo dentro ensina a não ser olhado')
  ok('a prova ao contrário: lista sem caixa NÃO vira cartão')

  /* E onde já existe frente, a caixa é subtarefa dela: promovê-la duplicaria o
     mesmo trabalho em dois níveis do quadro. */
  const comFrente = m.grupos.find((g) => /frentes próprias/.test(g.titulo))
  assert.equal(comFrente.frentes.length, 1)
  assert.equal(comFrente.frentes[0].itens, 1)
  ok('onde já há frente, a caixa continua sendo subtarefa dela')

  rmSync(raiz, { recursive: true, force: true })
}

console.log(`\n${passou} verificações, todas passaram.`)
