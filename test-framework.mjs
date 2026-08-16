/**
 * Testes do motor do framework. Rodam em qualquer máquina: não leem disco do
 * projeto, não precisam de job, não precisam de Chrome. É de propósito, e é o
 * contraste com o `npm test`, que hoje falha na VPS por exigir job real com
 * transcript (CC-53).
 *
 *   node test-framework.mjs
 */
import assert from 'node:assert'
import {
  METODOS, PREDICADOS, SEMPRE_LIVRE, avaliar, avancar, casa,
  estadoInicial, mudarEscopo, podeEditar, resumo,
} from './src/framework.mjs'

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

// ---------------------------------------------------------------- casamento
assert.equal(casa('src/**', 'src/jobs.mjs'), true)
assert.equal(casa('src/**', 'src/a/b/c.mjs'), true)
assert.equal(casa('src/**', 'src'), true)
assert.equal(casa('src/**', 'srcx/jobs.mjs'), false, 'prefixo solto não pode casar')
assert.equal(casa('*', 'package.json'), true)
assert.equal(casa('*', 'src/jobs.mjs'), false, '* não desce pasta')
assert.equal(casa('src/**', ''), false)
assert.equal(casa('src/**', 'src\\jobs.mjs'), true, 'caminho do Windows')
ok('casamento de caminho, inclusive barra invertida')

// ------------------------------------------------------------------ estado
const vazio = estadoInicial()
assert.equal(vazio.fase, 'definicao')
assert.equal(vazio.mvp.criterios.length, 0)
ok('estado inicial começa na definição, sem MVP')

// --------------------------------------------------------------- predicados
assert.ok(PREDICADOS['mvp-definido'](vazio), 'sem critério tem que acusar')
assert.equal(PREDICADOS['mvp-definido']({ mvp: { criterios: [{ texto: 'x' }] } }), null)
assert.ok(PREDICADOS['mvp-tem-nome'](vazio))
assert.equal(PREDICADOS['mvp-tem-nome']({ mvp: { nome: 'painel' } }), null)
// a frase do que falta é parte do contrato, não enfeite
assert.match(PREDICADOS['mvp-definido'](vazio), /critério/)
ok('predicados devolvem a frase do que falta, nunca booleano nu')

// ------------------------------------------------------------------ o gate
const g1 = podeEditar('mvp-basico', vazio, 'src/jobs.mjs')
assert.equal(g1.ok, false, 'código sem MVP tem que travar')
assert.equal(g1.pendencias.length, 2)
ok('sem MVP, código é travado, com as duas pendências nomeadas')

for (const livre of ['docs/HANDOFF.md', 'assets/img/a.png', '.framework/estado.json', 'package.json']) {
  assert.equal(podeEditar('mvp-basico', vazio, livre).ok, true, `${livre} tinha que passar`)
}
ok('docs, assets, o próprio estado e a raiz nunca travam')

// método desconhecido e estado corrompido LIBERAM: framework que trava por bug
// próprio é desligado no mesmo dia
assert.equal(podeEditar('nao-existe', vazio, 'src/a.mjs').ok, true)
assert.equal(podeEditar('mvp-basico', {}, 'src/a.mjs').ok, false) // sem fase cai na primeira
assert.equal(podeEditar('mvp-basico', null, 'docs/a.md').ok, true)
ok('dúvida libera: método desconhecido não pode travar ninguém')

// ------------------------------------------------------- definiu, liberou
const definido = { ...vazio, mvp: { nome: 'painel dos agentes', criterios: [{ texto: 'uma linha por agente', feito: false }] } }
const a1 = avaliar('mvp-basico', definido)
assert.equal(a1.portaoAberto, true)
assert.equal(a1.proxima, 'execucao')
assert.equal(podeEditar('mvp-basico', definido, 'src/jobs.mjs').ok, true)
ok('com MVP definido o portão abre e o código libera')

const av = avancar('mvp-basico', definido)
assert.equal(av.ok, true)
assert.equal(av.estado.fase, 'execucao')
assert.equal(avancar('mvp-basico', vazio).ok, false, 'não avança com pendência')
assert.deepEqual(avancar('mvp-basico', av.estado).pendencias, [
  'faltam 1 de 1 critérios do MVP: uma linha por agente',
])
ok('avançar recusa com o que falta, em vez de avançar calado')

// -------------------------------------------------------- definição de pronto
const emExecucao = av.estado
assert.equal(avaliar('mvp-basico', emExecucao).portaoAberto, false)
const pronto = { ...emExecucao, mvp: { ...emExecucao.mvp, criterios: [{ texto: 'uma linha por agente', feito: true }] } }
const a2 = avaliar('mvp-basico', pronto)
assert.equal(a2.portaoAberto, true)
assert.equal(a2.ultima, true)
ok('pronto é critério marcado, não opinião')

// ------------------------------------------------- ligado contra desligado
const desligado = { ...vazio, ligado: false }
assert.equal(avaliar('mvp-basico', desligado).ligado, false)
assert.equal(podeEditar('mvp-basico', desligado, 'src/a.mjs').ok, true, 'desligado não trava nada')
assert.match(resumo('mvp-basico', desligado), /desligado/i)
// desligar preserva o dado: é a diferença entre desligar e apagar a pasta
const comMvpDesligado = { ...definido, ligado: false }
assert.equal(comMvpDesligado.mvp.criterios.length, 1)
assert.equal(podeEditar('mvp-basico', comMvpDesligado, 'src/a.mjs').ok, true)
assert.equal(avaliar('mvp-basico', { ...comMvpDesligado, ligado: true }).portaoAberto, true, 'religar devolve o estado de antes')
// estado gravado antes deste campo existir conta como LIGADO: projeto antigo
// não pode destravar sozinho numa atualização
assert.equal(avaliar('mvp-basico', vazio).ligado, true)
assert.equal(podeEditar('mvp-basico', vazio, 'src/a.mjs').ok, false)
ok('desligado libera tudo e preserva o MVP; ausência do campo conta como ligado')

// ------------------------------------------------------------- os modos
const { MODOS, modoDe, autorizar, trocarModo } = await import('./src/framework.mjs')

// estado antigo, sem o campo, não pode mudar de comportamento sozinho
assert.equal(modoDe({}).id, 'dialogo')
assert.equal(modoDe({ modo: 'nao-existe' }).id, 'dialogo')
assert.equal(estadoInicial().modo, 'dialogo')
ok('sem modo declarado, o padrão é diálogo')

// no diálogo o código passa quando o portão está aberto (o fluxo de hoje)
const emDialogo = { ...definido, fase: 'execucao', modo: 'dialogo' }
assert.equal(podeEditar('mvp-basico', emDialogo, 'src/a.mjs').ok, true)
ok('diálogo não trava: é o fluxo de sempre')

// sugestivo trava MESMO com MVP definido e portão aberto — é o conserto do
// erro de 14/08, onde o projeto estava em Execução e nada me impediu
const emSugestivo = { ...emDialogo, modo: 'sugestivo' }
const bloq = podeEditar('mvp-basico', emSugestivo, 'src/a.mjs')
assert.equal(bloq.ok, false, 'sugestivo tem que travar mesmo com o MVP pronto')
assert.equal(bloq.modo, 'sugestivo')
assert.match(bloq.pendencias[0], /autorização/)
/* O restritivo NÃO trava mais, e a mudança é de 15/08. Este teste afirmava o
   contrário porque eu tinha copiado o `trava` do sugestivo por engano — e o
   sintoma foi ele desligar o framework três vezes numa tarde para eu conseguir
   trabalhar, que é o oposto de um framework. O escopo do restritivo é a ROTA,
   e quem trava rota é o `rota-guard`, de fora. */
assert.equal(podeEditar('mvp-basico', { ...emDialogo, modo: 'restritivo' }, 'src/a.mjs').ok, true,
  'restritivo travando de novo: ele teria que desligar o framework para trabalhar')
ok('só o sugestivo trava com o portão aberto — no restritivo a contenção é a rota')

// e não travam o que nunca trava
for (const livre of ['docs/x.md', '.framework/estado.json', 'package.json']) {
  assert.equal(podeEditar('mvp-basico', emSugestivo, livre).ok, true, `${livre} tinha que passar`)
}
ok('nos modos que travam, docs e o próprio estado continuam livres')

// autorizar libera, e deixa rastro
const aut = autorizar(emSugestivo, { alvo: '**', motivo: 'pode implementar' })
assert.equal(podeEditar('mvp-basico', aut.estado, 'src/a.mjs').ok, true)
assert.equal(aut.estado.historico.at(-1).tipo, 'autorizacao')
assert.equal(aut.estado.historico.at(-1).motivo, 'pode implementar')
// autorização por caminho não vaza para outro caminho
const soSrc = autorizar(emSugestivo, { alvo: 'src/**' })
assert.equal(podeEditar('mvp-basico', soSrc.estado, 'src/a.mjs').ok, true)
assert.equal(podeEditar('mvp-basico', soSrc.estado, 'apps/b.mjs').ok, false)
ok('autorizar libera com rastro, e o alvo não vaza para outro caminho')

// trocar de modo zera autorização: senão o rigor vira decoração
const voltou = trocarModo(aut.estado, 'sugestivo')
assert.deepEqual(voltou.estado.autorizado, [])
assert.equal(podeEditar('mvp-basico', voltou.estado, 'src/a.mjs').ok, false)
assert.equal(voltou.estado.historico.at(-1).tipo, 'modo')
assert.equal(trocarModo(emDialogo, 'inventado').ok, false)
ok('trocar de modo zera as autorizações e fica no histórico')

// desligado é mais forte que qualquer modo
assert.equal(podeEditar('mvp-basico', { ...emSugestivo, ligado: false }, 'src/a.mjs').ok, true)
ok('desligado vence o modo: nada trava')

// o resumo diz o modo quando ele trava
assert.match(resumo('mvp-basico', emSugestivo), /Sugestivo/)
assert.match(resumo('mvp-basico', aut.estado), /autoriza/i)
// e os quatro modos existem com explicação
assert.deepEqual(Object.keys(MODOS), ['desligado', 'dialogo', 'sugestivo', 'restritivo'])
for (const m of Object.values(MODOS)) assert.ok(m.explica && m.titulo, `modo ${m.id} sem texto`)
ok('os quatro modos existem, com título e explicação, e o resumo os mostra')

// --------------------------------- F4 e F6: ferramentas e o segundo método
const { escolherFerramentas, registrarVerificacao } = await import('./src/framework.mjs')

// o segundo método existe pra provar que método é DADO: 4 fases, sem tocar no motor
assert.ok(METODOS['entrega-cliente'], 'o segundo método precisa existir')
assert.equal(METODOS['entrega-cliente'].fases.length, 4)
assert.equal(METODOS['mvp-basico'].fases.length, 2)
ok('dois métodos convivem, com número de fases diferente')

// na Definição do entrega-cliente, MVP pronto NÃO basta: falta escolher ferramenta
const cliente = { ...estadoInicial('entrega-cliente'), mvp: definido.mvp }
const semFerramenta = avaliar('entrega-cliente', cliente)
assert.equal(semFerramenta.portaoAberto, false)
assert.ok(semFerramenta.pendencias.some((p) => /ferramenta/.test(p)))
ok('entrega-cliente exige escolher as ferramentas na Definição')

const comFerramenta = escolherFerramentas(cliente, ['gitleaks', 'rls']).estado
assert.deepEqual(comFerramenta.ferramentas, ['gitleaks', 'rls'])
assert.equal(avaliar('entrega-cliente', comFerramenta).portaoAberto, true)
assert.equal(comFerramenta.historico.at(-1).tipo, 'ferramentas')
// duplicata não entra duas vezes
assert.deepEqual(escolherFerramentas(cliente, ['a', 'a', ' a ']).estado.ferramentas, ['a'])
ok('escolher ferramentas abre o portão e deixa rastro, sem duplicar')

// a fase de Verificação segura enquanto não rodou, e enquanto acusou problema
const naVerificacao = { ...comFerramenta, fase: 'verificacao' }
assert.match(avaliar('entrega-cliente', naVerificacao).pendencias[0], /falta rodar/)
const rodou1 = registrarVerificacao(naVerificacao, 'gitleaks', { ok: true }).estado
assert.match(avaliar('entrega-cliente', rodou1).pendencias[0], /falta rodar: rls/)
const rodouSujo = registrarVerificacao(rodou1, 'rls', { ok: false, detalhe: 'tabela aberta' }).estado
assert.ok(avaliar('entrega-cliente', rodouSujo).pendencias.some((p) => /acusou problema/.test(p)))
const rodouLimpo = registrarVerificacao(rodou1, 'rls', { ok: true }).estado
assert.equal(avaliar('entrega-cliente', rodouLimpo).portaoAberto, true)
assert.equal(registrarVerificacao(naVerificacao, '', { ok: true }).ok, false)
ok('verificação segura a fase: precisa ter rodado E não pode ter acusado problema')

// o mvp-basico não ganhou exigência nenhuma com isso
assert.equal(avaliar('mvp-basico', definido).portaoAberto, true)
ok('o método antigo não mudou de comportamento')

// ------------------------------- F8 e F13: entrevista e tom
const { PERGUNTAS, TONS, TOM_RECOMENDADO, proximaPergunta, tomDe } = await import('./src/framework.mjs')

// projeto novo pergunta o nome primeiro, uma coisa por vez
const nova = proximaPergunta('mvp-basico', vazio)
assert.equal(nova.predicado, 'mvp-tem-nome')
assert.ok(nova.opcoes.length >= 2, 'pergunta sem opção não serve ao AskUserQuestion')
assert.ok(nova.falta, 'a pergunta carrega qual pendência ela resolve')
// com nome, a próxima é o critério
const soNome = { ...vazio, mvp: { nome: 'x', criterios: [] } }
assert.equal(proximaPergunta('mvp-basico', soNome).predicado, 'mvp-definido')
// resolvido tudo, silêncio
assert.equal(proximaPergunta('mvp-basico', definido), null)
assert.equal(proximaPergunta('mvp-basico', { ...vazio, ligado: false }), null)
ok('entrevista pergunta uma coisa por vez e cala quando não há pendência')

// toda pergunta do catálogo aponta pra um predicado que existe
for (const [pred, q] of Object.entries(PERGUNTAS)) {
  assert.ok(PREDICADOS[pred], `pergunta órfã: ${pred}`)
  assert.ok(q.pergunta && q.header && q.ajuda, `pergunta ${pred} incompleta`)
  assert.ok(q.header.length <= 12, `header "${q.header}" passa de 12 caracteres`)
  for (const o of q.opcoes) assert.ok(o.label && o.descricao, `opção sem texto em ${pred}`)
}
ok('todo verbete do catálogo é válido para o AskUserQuestion')

// o entrega-cliente também pergunta as ferramentas
const cli2 = { ...estadoInicial('entrega-cliente'), mvp: definido.mvp }
assert.equal(proximaPergunta('entrega-cliente', cli2).predicado, 'ferramentas-escolhidas')
ok('o segundo método reusa o catálogo, sem pergunta nova no código')

// F13: tom é eixo separado do modo
assert.equal(tomDe({}), 'explicativo')
assert.equal(tomDe({ modo: 'sugestivo' }), 'direto')
assert.equal(tomDe({ modo: 'sugestivo', tom: 'explicativo' }), 'explicativo', 'tom escolhido vence o recomendado')
assert.equal(tomDe({ modo: 'sugestivo', tom: 'inventado' }), 'direto', 'tom inválido cai no recomendado')
for (const m of Object.keys(MODOS)) assert.ok(TONS[TOM_RECOMENDADO[m]], `modo ${m} sem tom recomendado válido`)
ok('tom é independente do modo, com recomendado por modo')

// ------------------------------------------------------------ mudar escopo
const semMotivo = mudarEscopo(pronto, { mvp: { nome: 'outro', criterios: [] } })
assert.equal(semMotivo.ok, false, 'mudança de escopo sem motivo tem que recusar')

const mud = mudarEscopo(pronto, {
  mvp: { nome: 'outro produto', criterios: [{ texto: 'novo', feito: false }] },
  motivo: 'o Felipe reposicionou o produto',
})
assert.equal(mud.ok, true)
assert.equal(mud.estado.historico.length, 1)
assert.equal(mud.estado.historico[0].motivo, 'o Felipe reposicionou o produto')
assert.equal(mud.estado.historico[0].de.nome, 'painel dos agentes')
assert.equal(mud.estado.mvp.nome, 'outro produto')
// e o histórico não some na mudança seguinte
const mud2 = mudarEscopo(mud.estado, { mvp: { nome: 'terceiro', criterios: [] }, motivo: 'de novo' })
assert.equal(mud2.estado.historico.length, 2)
ok('escopo muda com motivo registrado, e o histórico acumula')

// ------------------------------------------------------------------- resumo
assert.match(resumo('mvp-basico', vazio), /Falta:/)
assert.match(resumo('mvp-basico', definido), /Portão aberto/)
assert.match(resumo('mvp-basico', pronto), /critérios do MVP estão marcados/)
// sem número solto na frase do usuário: "fase 1 de 2" é posição, não nota
assert.ok(!/\b\d{2,}\b/.test(resumo('mvp-basico', vazio)), 'nada de pontuação numérica')
ok('resumo é frase, com o que falta escrito')

// ------------------------------------------------------------- pureza
const antes = JSON.stringify(definido)
avaliar('mvp-basico', definido); podeEditar('mvp-basico', definido, 'src/a.mjs')
avancar('mvp-basico', definido); mudarEscopo(definido, { mvp: {}, motivo: 'x' })
assert.equal(JSON.stringify(definido), antes, 'nenhuma função pode mutar o estado recebido')
ok('motor é puro: nada muta o estado que recebeu')

// --------------------------------------------------------------- integridade
assert.ok(SEMPRE_LIVRE.includes('docs/**'), 'travar docs quebraria o /end-session')
for (const m of Object.values(METODOS)) {
  assert.ok(m.fases.length > 0)
  for (const f of m.fases) {
    assert.ok(f.explica, `fase ${f.id} sem explicação: gate mudo se desliga na terceira semana`)
    for (const p of f.exige || []) {
      assert.ok(PREDICADOS[p], `fase ${f.id} exige predicado inexistente: ${p}`)
    }
  }
}
ok('todo método declarado usa predicado que existe, e toda fase explica')

/* CC-68: os métodos `conserto` e `estudo`.

   O ponto do catálogo é que **método é dado, não código** — então o teste mais
   importante aqui é o de baixo, que confere que nenhum deles trouxe predicado
   ou fase que o motor não soubesse tratar. */
{
  assert.equal(Object.keys(METODOS).length, 4, 'o catálogo tem que ter os quatro')

  // conserto: reproduzir ANTES trava o código, e é o ponto do método
  const c = METODOS.conserto
  assert.deepEqual(c.fases.map((f) => f.id), ['reproducao', 'execucao', 'prova'])
  assert.ok(c.fases[0].trava.includes('src/**'), 'a reprodução tem que travar código')
  assert.equal(c.fases[1].trava.length, 0, 'a fase de consertar não pode travar código')

  const semNada = avaliar('conserto', { fase: 'reproducao' })
  assert.equal(semNada.portaoAberto, false)
  assert.match(semNada.pendencias[0], /COMO o defeito aparece/)

  const soComo = avaliar('conserto', { fase: 'reproducao', reproducao: { como: 'clico e some' } })
  assert.match(soComo.pendencias[0], /esperava ver/)

  const reproduzido = avaliar('conserto', {
    fase: 'reproducao', reproducao: { como: 'clico e some', esperado: 'devia abrir' },
  })
  assert.equal(reproduzido.portaoAberto, true)

  /* Prova sem teste que guarde não fecha: é a regra 1 do ciclo dele, e a
     lembrança de que 545 testes verdes já conviveram com a tela quebrada. */
  const semTeste = avaliar('conserto', { fase: 'prova', prova: { como: 'rodei e passou' } })
  assert.match(semTeste.pendencias[0], /teste que guarda/)
  assert.equal(avaliar('conserto', { fase: 'prova', prova: { como: 'rodei', guardado: true } }).portaoAberto, true)

  // estudo: as DUAS fases travam código, porque a entrega é a decisão
  const e = METODOS.estudo
  assert.deepEqual(e.fases.map((f) => f.id), ['pergunta', 'decisao'])
  for (const f of e.fases) assert.ok(f.trava.includes('src/**'), `${f.id} tem que travar código`)

  assert.match(avaliar('estudo', { fase: 'pergunta' }).pendencias[0], /pergunta que este estudo responde/)
  // uma opção só não é estudo: é escolha já feita, com aparência de pesquisa
  assert.match(
    avaliar('estudo', { fase: 'decisao', estudo: { opcoes: [{ nome: 'a', medida: '1' }] } }).pendencias[0],
    /menos de duas opções/,
  )
  assert.match(
    avaliar('estudo', { fase: 'decisao', estudo: { opcoes: [{ nome: 'a', medida: '1' }, { nome: 'b' }] } }).pendencias[0],
    /sem medida: b/,
  )
  assert.equal(avaliar('estudo', {
    fase: 'decisao',
    estudo: { opcoes: [{ nome: 'a', medida: '1' }, { nome: 'b', medida: '2' }], decisao: 'fica a' },
  }).portaoAberto, true)
}
ok('CC-68: conserto reproduz antes e prova depois; estudo trava código nas duas fases')

/* O restritivo NÃO trava código, e isso é decisão dele em 15/08 — corrigindo
   uma implementação minha que copiou o `trava` do sugestivo por engano.

   O teste existe porque o sintoma foi caro: ele desligou o framework três vezes
   numa tarde para eu conseguir trabalhar, o que é o oposto de um framework. */
{
  assert.equal(MODOS.restritivo.trava, false, 'o restritivo voltou a travar código')
  assert.equal(MODOS.sugestivo.trava, true, 'o sugestivo tem que travar: a trava É o ponto dele')
  assert.equal(MODOS.dialogo.trava, false)

  // e o efeito prático: no restritivo, escrever código passa
  const emRestritivo = { ligado: true, modo: 'restritivo', fase: 'execucao', mvp: { nome: 'x', criterios: [{ texto: 'a', feito: true }] } }
  assert.equal(podeEditar('mvp-basico', emRestritivo, 'src/qualquer.mjs').ok, true,
    'restritivo travando código: ele teria que desligar o framework para trabalhar')
  // e o sugestivo continua travando sem autorização, que é o desenho dele
  assert.equal(podeEditar('mvp-basico', { ...emRestritivo, modo: 'sugestivo' }, 'src/qualquer.mjs').ok, false)
}
ok('o restritivo restringe por rota, não por clique — quem trava é o sugestivo')

/* CC-91 parte 3: o agente PEDE antes de escrever.

   Inverte o fluxo, e a inversão é o ponto: sem pedido, a saída mais fácil para
   ele é autorizar tudo com `**`, que é o atalho que esvazia o modo. */
{
  const { pedir, resolverPedido } = await import('./src/framework.mjs')
  let e = { modo: 'sugestivo', autorizado: [], pedidos: [] }

  e = pedir(e, { alvo: 'src/a.mjs' }).estado
  e = pedir(e, { alvo: 'src/b.mjs' }).estado
  assert.deepEqual(e.pedidos.map((p) => p.alvo), ['src/a.mjs', 'src/b.mjs'])

  // pedir o mesmo arquivo de novo não vira segunda linha na fila
  e = pedir(e, { alvo: 'src/a.mjs', motivo: 'agora com motivo' }).estado
  assert.equal(e.pedidos.filter((p) => p.alvo === 'src/a.mjs').length, 1)

  // autorizar tira da fila: pedido resolvido não pode continuar pedindo
  e = autorizar(e, { alvo: 'src/a.mjs' }).estado
  assert.deepEqual(e.pedidos.map((p) => p.alvo), ['src/b.mjs'])
  assert.ok(e.autorizado.includes('src/a.mjs'))

  // recusar também tira, senão a fila só cresce
  assert.deepEqual(resolverPedido(e, 'src/b.mjs').pedidos, [])

  assert.equal(pedir(e, { alvo: '' }).ok, false, 'pedido sem alvo tinha que ser recusado')

  /* Trocar de modo zera autorização E fila: pedido feito sob outro modo não
     pode sobreviver, senão trocar de modo não muda nada. */
  const trocado = trocarModo(e, 'dialogo').estado
  assert.deepEqual(trocado.autorizado, [])
}
ok('CC-91: o agente pede por arquivo, e autorizar tira o pedido da fila')

console.log(`\n${n} grupos de asserção passaram`)
