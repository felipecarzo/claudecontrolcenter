/**
 * CC-382 a CC-386 — do texto solto ao projeto andando.
 *
 * Pedido dele em 28/08:
 *
 * > *"eu chego com um projeto em linguagem natural, e o framework vai primeiro
 * > criar uma definição de pronto e depois a criação de um plano, backlog,
 * > sprints (…) isso tudo em modo sugestivo, eu coloco o projeto e ele começa a
 * > fazer perguntas e vamos desenvolvendo."*
 *
 * ## O que este arquivo guarda
 *
 * A ligação entre as peças, que era o que faltava. As peças em si já
 * existiam e funcionavam; o que não existia era o resultado de uma virar a
 * entrada da outra. Medido antes de escrever: dos 11 projetos com framework
 * desta máquina, **zero** tinham respondido a entrevista.
 *
 * Nada aqui escreve em projeto de verdade: tudo em pasta temporária.
 */
import assert from 'node:assert'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { aplicar, colher, paraBacklog, proxima, responder } from './src/entrevista.mjs'
import { gravarBacklog } from './src/frameworkDisco.mjs'
import { lerRoadmap } from './src/roadmap.mjs'

let passou = 0
const ok = (nome) => { console.log('  ok   ' + nome); passou++ }

const RESPOSTAS = {
  entrega: { texto: 'Um painel que mostra os agentes trabalhando' },
  quem: { texto: 'eu, do celular, na rua' },
  hoje: { texto: 'hoje eu abro o terminal e navego por abas' },
  primeiro: { texto: 'a lista de agentes na tela' },
  pronto: { texto: 'abre no celular\nmostra quem está trabalhando\natualiza sozinho' },
}
const comRespostas = (extra = {}) => ({
  mvp: { nome: '', criterios: [] },
  entrevista: { respostas: { ...RESPOSTAS, ...extra } },
})

/* ── CC-382: a entrevista colhe o pronto ─────────────────────────────────── */
{
  const c = colher(comRespostas())
  assert.equal(c.nome, 'Um painel que mostra os agentes trabalhando')
  assert.deepEqual(c.criterios.map((x) => x.texto), [
    'abre no celular', 'mostra quem está trabalhando', 'atualiza sozinho', 'a lista de agentes na tela',
  ])
  ok('a definição de pronto sai das respostas, uma linha por critério')

  const r = aplicar(comRespostas())
  assert.equal(r.mudou, true)
  assert.equal(r.estado.mvp.nome, 'Um painel que mostra os agentes trabalhando')
  assert.equal(r.estado.mvp.criterios.length, 4)
  ok('com o MVP vazio, a entrevista preenche')
}

{
  /* ⚠️ A regra que protege trabalho dele: dez dos onze projetos têm MVP escrito
     à mão, e a entrevista NÃO pode passar por cima. O que colide vira sugestão,
     para a tela mostrar as duas versões. */
  const comMvp = {
    ...comRespostas(),
    mvp: { nome: 'O nome que ele escreveu à mão', criterios: [{ texto: 'abre no celular', feito: true }] },
  }
  const r = aplicar(comMvp)
  assert.equal(r.estado.mvp.nome, 'O nome que ele escreveu à mão', 'o nome dele fica')
  assert.equal(r.estado.mvp.criterios.length, 1, 'os critérios dele ficam')
  assert.equal(r.sugestoes.nome, 'Um painel que mostra os agentes trabalhando')
  ok('a prova ao contrário: MVP escrito à mão NÃO é sobrescrito, vira sugestão')

  /* E o critério que ele já tinha não volta duplicado na sugestão: a mesma
     coisa escrita duas vezes é o que aparece na tela, não no arquivo. */
  const textos = (r.sugestoes.criterios || []).map((c) => c.texto)
  assert.ok(!textos.includes('abre no celular'))
  ok('critério que já existe não volta duplicado como sugestão')
}

/* ── a entrevista inteira, respondida até o fim ──────────────────────────── */
{
  let estado = { mvp: { nome: '', criterios: [] }, entrevista: { respostas: {} } }
  let voltas = 0
  let ultima = null
  while (voltas < 30) {
    const p = proxima(estado)
    if (!p) break
    const texto = p.id === 'entrega' ? 'Um painel de agentes'
      : p.id === 'pronto' ? 'abre no celular\natualiza sozinho'
      : p.id === 'primeiro' ? 'a lista na tela'
      : (p.opcoes?.[0]?.valor || p.opcoes?.[0]?.label || `resposta ${p.id}`)
    const r = responder(estado, p.id, texto)
    assert.ok(r.ok, `a pergunta ${p.id} devia aceitar resposta`)
    estado = r.estado
    ultima = r
    voltas++
  }
  assert.ok(estado.entrevista.terminou, 'a entrevista fecha sozinha quando acaba o roteiro')
  assert.equal(estado.mvp.nome, 'Um painel de agentes')
  assert.ok(estado.mvp.criterios.length >= 2)
  ok('respondida até o fim, ela grava o pronto sem ninguém pedir')

  /* Isto é o conserto do zero medido: a gravação acontece no FECHAMENTO, e não
     numa chamada separada que alguém precisaria lembrar de fazer. Peça que
     depende de alguém lembrar é peça que fica de fora. */
  assert.ok(ultima && 'sugestoes' in ultima, 'a última volta devolve o que colheu')
  ok('a gravação acontece no fechamento, e não numa chamada avulsa')
}

/* ── CC-383: as respostas viram backlog ──────────────────────────────────── */
{
  const texto = paraBacklog(comRespostas(), { quando: '2026-08-28' })
  assert.match(texto, /^## ▶ Da entrevista de 28\/08/)
  assert.match(texto, /### abre no celular/)
  assert.match(texto, /### a lista de agentes na tela 🟢/, 'a primeira fatia sai marcada')
  assert.match(texto, /eu, do celular, na rua/, 'a fala dele viaja junto')
  ok('cada critério vira item aberto, com as palavras dele no contexto')

  /* Sem critério não há backlog, e devolver um bloco vazio encheria o roadmap
     de seção sem conteúdo. */
  assert.equal(paraBacklog({ entrevista: { respostas: {} } }), null)
  ok('entrevista sem resposta não gera bloco vazio no roadmap')
}

/* ── CC-383: gravar sem destruir ─────────────────────────────────────────── */
{
  const raiz = mkdtempSync(join(tmpdir(), 'cc-proj-'))
  mkdirSync(join(raiz, 'docs'), { recursive: true })
  const ANTIGO = '# ROADMAP\n\n## Uma frente que já existia\n\n### item antigo\n\ntexto que não pode sumir\n'
  writeFileSync(join(raiz, 'docs', 'ROADMAP.md'), ANTIGO)

  const texto = paraBacklog(comRespostas(), { quando: '2026-08-28' })
  const r = gravarBacklog(raiz, texto)
  assert.equal(r.ok, true)
  assert.ok(r.bytesDepois > r.bytesAntes)

  const depois = readFileSync(join(raiz, 'docs', 'ROADMAP.md'), 'utf8')
  assert.match(depois, /texto que não pode sumir/,
    'o roadmap é o arquivo mais caro do projeto: nada nele pode ser apagado')
  assert.match(depois, /### abre no celular/)
  ok('o backlog entra no fim do roadmap, e o que já estava lá continua inteiro')

  /* A prova ao contrário: a entrevista pode ser refeita, e cada volta geraria
     outro bloco idêntico. A segunda gravação recusa. */
  const r2 = gravarBacklog(raiz, texto)
  assert.equal(r2.ok, false)
  assert.equal(r2.jaEstava, true)
  ok('a prova ao contrário: o mesmo backlog não entra duas vezes')

  /* E o parser lê o que foi escrito. Gerar markdown que o próprio leitor não
     entende seria escrever para ninguém, e é o defeito que o carzo tinha. */
  const mapa = lerRoadmap(raiz)
  const titulos = mapa.grupos.flatMap((g) => g.frentes).map((f) => f.titulo)
  assert.ok(titulos.includes('item antigo'), 'o item antigo continua legível')
  assert.ok(titulos.includes('abre no celular'), 'o item novo é lido pelo quadro')
  ok('o quadro lê o que a entrevista escreveu, sem passo manual no meio')

  rmSync(raiz, { recursive: true, force: true })
}

/* ── projeto sem roadmap nenhum ──────────────────────────────────────────── */
{
  const raiz = mkdtempSync(join(tmpdir(), 'cc-proj-sem-'))
  const r = gravarBacklog(raiz, paraBacklog(comRespostas(), { quando: '2026-08-28' }))
  assert.equal(r.ok, true)
  assert.equal(r.criou, true)
  const mapa = lerRoadmap(raiz)
  assert.ok(mapa.grupos.flatMap((g) => g.frentes).length >= 3)
  ok('projeto sem roadmap ganha um, em vez de a gravação ser recusada')
  rmSync(raiz, { recursive: true, force: true })
}


/* ── CC-384: a fase de planejamento sai da entrevista ────────────────────── */
{
  const { planoDe } = await import('./src/entrevista.mjs')
  const { PREDICADOS } = await import('./src/framework.mjs')

  const plano = planoDe(comRespostas())
  assert.equal(plano.itens, 4)
  assert.equal(plano.primeira, 'a lista de agentes na tela')
  ok('a primeira fatia sai da resposta dele, e não de um segundo formulário')

  /* Os dois portões da fase nova abrem com o que a entrevista apurou. Se não
     abrissem, o framework ficaria pedindo para sempre uma coisa que o projeto
     já tinha respondido, que é o jeito mais rápido de ele ser desligado. */
  assert.equal(PREDICADOS['backlog-escrito']({ plano: { itens: 4 } }), null)
  assert.equal(PREDICADOS['primeira-fatia-escolhida']({ plano: { primeira: 'a lista' } }), null)
  ok('os portões do planejamento abrem com o que a conversa produziu')

  /* A prova ao contrário: sem backlog escrito o portão continua fechado, e diz
     o que falta. Portão que trava sem explicar é a burocracia que morre. */
  assert.match(PREDICADOS['backlog-escrito']({}), /backlog está vazio/)
  assert.match(PREDICADOS['primeira-fatia-escolhida']({ plano: { itens: 3 } }), /primeira fatia/)
  ok('a prova ao contrário: sem plano, os portões travam e dizem o que falta')
}

/* ── CC-385: sprint é recorte com prazo ──────────────────────────────────── */
{
  const { estadoDaSprint, prazoDe } = await import('./src/roadmap.mjs')

  assert.deepEqual(prazoDe('Sprint 1 (28/08 a 04/09)'), { de: '2026-08-28', ate: '2026-09-04' })
  assert.deepEqual(prazoDe('Sprint 2 (2026-09-05 a 2026-09-12)'), { de: '2026-09-05', ate: '2026-09-12' })
  assert.deepEqual(prazoDe('Sprint (20/12 a 10/01)'), { de: '2026-12-20', ate: '2027-01-10' })
  ok('o prazo é lido do título, nas duas formas, e atravessa a virada de ano')

  /* A prova ao contrário: seção com "Sprint" no nome e sem data NÃO é sprint.
     Senão o roadmap encheria de sprint aberta para sempre, que é o oposto de
     recorte com prazo. */
  assert.equal(prazoDe('Sprint 1'), null)
  assert.equal(prazoDe('## Uma frente qualquer'), null)
  ok('a prova ao contrário: seção sem data não vira sprint')

  const em = (d) => new Date(d)
  assert.equal(estadoDaSprint({ de: '2026-08-20', ate: '2026-09-10' }, em('2026-08-28')), 'corrente')
  assert.equal(estadoDaSprint({ de: '2026-08-01', ate: '2026-08-10' }, em('2026-08-28')), 'encerrada')
  assert.equal(estadoDaSprint({ de: '2026-09-20', ate: '2026-09-30' }, em('2026-08-28')), 'futura')
  ok('o estado da sprint sai da data, sem ninguém precisar marcar nada')
}

/* ── CC-385: fechar a sprint devolve o que não coube ─────────────────────── */
{
  const { fecharSprint } = await import('./src/frameworkDisco.mjs')
  const roadmap = [
    '# ROADMAP', '',
    '## Sprint 1 (20/08 a 27/08)', '',
    '### ✅ subir a tela nova', '', 'ficou pronto dia 22', '',
    '### arrumar o filtro', '', 'isso não deu tempo', '',
    '## Outra frente', '', '### item de fora', '',
  ].join('\n')

  const r = fecharSprint(roadmap, 'Sprint 1', { quando: '2026-08-28' })
  assert.equal(r.ok, true)
  assert.equal(r.fechados, 1)
  assert.equal(r.devolvidos, 1)
  ok('fechar a sprint separa o que ficou pronto do que não coube')

  /* ⚠️ O que este teste protege é trabalho sumindo: uma sprint apagada leva o
     não feito junto, e ninguém percebe, porque o item não estava fechado. */
  assert.match(r.texto, /### arrumar o filtro/, 'o item aberto continua no arquivo')
  assert.match(r.texto, /isso não deu tempo/, 'e o corpo dele vai junto')
  assert.match(r.texto, /De volta à fila/, 'ele volta numa seção que diz de onde veio')
  assert.match(r.texto, /🏁 encerrada em 28\/08 \(1 de 2\)/, 'a sprint fica com o placar')
  ok('nada é apagado: o aberto volta para a fila com o texto dele inteiro')

  /* E o que estava fora da sprint não é tocado. Mexer no arquivo inteiro para
     fechar uma seção é como se perde o resto. */
  assert.match(r.texto, /## Outra frente/)
  assert.match(r.texto, /### item de fora/)
  ok('a prova ao contrário: o que estava fora da sprint fica intacto')

  const nada = fecharSprint(roadmap, 'Sprint que não existe')
  assert.equal(nada.ok, false)
  ok('fechar sprint inexistente recusa, em vez de mexer no arquivo à toa')
}


/* ── CC-386: do texto solto até o portão da execução abrir ───────────────── */
{
  const { avaliar, avancar, estadoInicial } = await import('./src/framework.mjs')
  const { planoDe } = await import('./src/entrevista.mjs')

  /**
   * A sequência inteira que ele descreveu, numa passada só:
   *
   * > *"eu chego com um projeto em linguagem natural (…) definição de pronto e
   * > depois a criação de um plano, backlog (…) e depois seguir o
   * > desenvolvimento"*
   *
   * Este teste é o que impede as peças de voltarem a ser ilhas. Cada uma delas
   * já tem teste próprio acima; o que se prova aqui é que a saída de uma é a
   * entrada da outra, sem passo manual no meio. Era exatamente isso que não
   * existia, e é a causa de a entrevista ter zero uso em 11 projetos.
   */
  const raiz = mkdtempSync(join(tmpdir(), 'cc-ponta-'))
  let estado = { ...estadoInicial('mvp-basico'), entrevista: { respostas: {} } }

  // 1. ele responde a entrevista
  let voltas = 0
  while (voltas < 30) {
    const p = proxima(estado)
    if (!p) break
    const texto = p.id === 'entrega' ? 'Um painel de agentes'
      : p.id === 'pronto' ? 'abre no celular\natualiza sozinho'
      : p.id === 'primeiro' ? 'a lista na tela'
      : (p.opcoes?.[0]?.valor || p.opcoes?.[0]?.label || `resposta ${p.id}`)
    estado = responder(estado, p.id, texto).estado
    voltas++
  }

  // 2. o pronto foi definido sozinho
  assert.ok(estado.mvp.nome, 'o MVP ganhou nome sem ninguém digitar')
  assert.ok(estado.mvp.criterios.length >= 2, 'e critérios de pronto')

  // 3. o portão da definição abre, e a próxima fase é planejar
  const naDefinicao = avaliar('mvp-basico', estado)
  assert.equal(naDefinicao.portaoAberto, true)
  assert.equal(naDefinicao.proxima, 'planejamento')
  estado = avancar('mvp-basico', estado).estado
  assert.equal(estado.fase, 'planejamento')
  ok('ponta a ponta: as respostas abrem o portão da definição sozinhas')

  // 4. o backlog é escrito no roadmap
  const r = gravarBacklog(raiz, paraBacklog(estado, { quando: '2026-08-28' }))
  assert.equal(r.ok, true)
  assert.ok(r.itens >= 2, 'os itens contados são os que entraram no arquivo')

  // 5. o plano fecha com o que foi escrito, e o portão do planejamento abre
  estado = { ...estado, plano: { itens: r.itens, primeira: planoDe(estado).primeira } }
  const noPlanejamento = avaliar('mvp-basico', estado)
  assert.equal(noPlanejamento.portaoAberto, true, noPlanejamento.pendencias?.join(' / '))
  estado = avancar('mvp-basico', estado).estado
  assert.equal(estado.fase, 'execucao')
  ok('ponta a ponta: o backlog escrito abre o portão do planejamento')

  // 6. e o quadro lê o que saiu de tudo isso
  const mapa = lerRoadmap(raiz)
  const titulos = mapa.grupos.flatMap((g) => g.frentes).map((f) => f.titulo)
  assert.ok(titulos.includes('abre no celular'))
  ok('ponta a ponta: o texto solto virou item no quadro, sem passo manual')

  /* A prova ao contrário: sem responder nada, a sequência NÃO anda. Se andasse,
     o framework estaria deixando passar projeto sem pronto definido, que é o
     contrário do que ele existe para fazer. */
  const vazio = { ...estadoInicial('mvp-basico'), entrevista: { respostas: {} } }
  assert.equal(avaliar('mvp-basico', vazio).portaoAberto, false)
  assert.equal(avancar('mvp-basico', vazio).ok, false)
  assert.equal(paraBacklog(vazio), null)
  ok('a prova ao contrário: sem a entrevista, nada anda e nada é escrito')

  rmSync(raiz, { recursive: true, force: true })
}

/* ── CC-387: critério de pronto vem em duas formas ───────────────────────── */
{
  const { PREDICADOS, criterioTexto } = await import('./src/framework.mjs')

  /* Medido nesta máquina: 25 critérios são texto puro e 34 são objeto. O código
     só entendia a segunda forma, e o cartão do carzo dizia "faltam 8 de 8
     critérios do MVP: ; ; ; ; ; ; ;" na tela, com oito pontos e vírgula. */
  assert.equal(criterioTexto('abre no celular'), 'abre no celular')
  assert.equal(criterioTexto({ texto: 'abre no celular' }), 'abre no celular')
  const so_texto = { mvp: { criterios: ['abre no celular', 'atualiza sozinho'] } }
  assert.match(PREDICADOS['criterios-todos-marcados'](so_texto), /abre no celular; atualiza sozinho/)
  ok('critério em texto puro aparece na frase, em vez de virar ponto e vírgula')

  /* Texto puro conta como ABERTO: dizer que um critério sem estado está feito
     fecharia o projeto por engano. */
  const misto = { mvp: { criterios: ['ainda não', { texto: 'já foi', feito: true }] } }
  assert.match(PREDICADOS['criterios-todos-marcados'](misto), /faltam 1 de 2/)
  ok('a prova ao contrário: critério sem estado conta como aberto, nunca feito')
}

console.log(`\n${passou} verificações, todas passaram.`)
