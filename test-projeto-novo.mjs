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


/* ── CC-388: projeto novo nasce em Sugestivo ─────────────────────────────── */
{
  const { criar } = await import('./src/novoProjeto.mjs')
  const { ler } = await import('./src/frameworkDisco.mjs')

  const base = mkdtempSync(join(tmpdir(), 'cc-base-'))
  const r = criar(base, { nome: 'projeto_de_teste', descricao: 'um app de fotos' })
  assert.equal(r.ok, true)

  const estado = ler(r.raiz, { sessao: null })
  assert.equal(estado.modo, 'sugestivo',
    'ele pediu "isso tudo em modo sugestivo": é o único modo que trava código E '
    + 'pede autorização por arquivo, que é o comportamento descrito no pedido')
  assert.equal(estado.fase, 'definicao')
  ok('projeto novo nasce em modo Sugestivo, na Definição')

  /* ⚠️ A armadilha que este teste guarda, paga em 28/08: `gravar()` restaura
     `modo` e `tom` do arquivo cru sempre que o objeto tem campo derivado (`_`),
     que é a defesa do CC-362. Ler COM sessão traz esses campos, e a gravação
     virava no-op calada: o modo continuava `dialogo` e nada acusava. */
  assert.ok(!('_origemModo' in estado), 'ler sem sessão não injeta campo derivado')
  ok('a armadilha guardada: ler sem sessão é o que faz a gravação do modo valer')

  /* E o resto do que ele pediu nasce junto: pasta própria com git, e os
     documentos. "separação de pasta pro projeto ter seu próprio git". */
  const { existsSync } = await import('node:fs')
  assert.ok(existsSync(join(r.raiz, '.git')), 'git próprio')
  assert.ok(existsSync(join(r.raiz, 'docs', 'ROADMAP.md')), 'roadmap')
  assert.ok(existsSync(join(r.raiz, 'CLAUDE.md')), 'instruções do projeto')
  ok('a pasta nasce com git próprio, roadmap e as instruções do projeto')

  rmSync(base, { recursive: true, force: true })
}


/* ── CC-389 a CC-392: a prosa, o palpite e a frente ──────────────────────── */
{
  const E = await import('./src/entrevista.mjs')

  /* A prosa é guardada inteira, e não só o que eu tirei dela: se amanhã eu ler
     melhor, ou se ele quiser conferir o que deduzi contra o que escreveu, o
     texto original precisa estar ali. */
  const g = E.guardarProsa({ entrevista: { respostas: {} } }, 'um app de fotos por evento')
  assert.equal(g.ok, true)
  assert.equal(g.estado.entrevista.prosa.texto, 'um app de fotos por evento')
  assert.equal(E.guardarProsa({}, '   ').ok, false)
  ok('a prosa é guardada inteira, e prosa vazia é recusada')

  const r = E.preencherDaProsa(g.estado, {
    entrega: 'um app de fotos', quem: 'eu mesmo', naoExiste: 'x',
  })
  assert.deepEqual(r.aceitas, ['entrega', 'quem'])
  assert.equal(r.recusadas[0].id, 'naoExiste')
  assert.deepEqual(E.palpites(r.estado).map((p) => p.id), ['entrega', 'quem'])
  ok('o que eu deduzo da prosa entra marcado como palpite, e o desconhecido é recusado')

  /* ⚠️ A regra central desta frente: **palpite meu não é fala dele.** Sem isto o
     resumo do projeto citaria como dele uma frase que eu inventei, e ele leria
     as próprias palavras no lugar errado. */
  assert.equal(E.colher(r.estado).nome, '', 'palpite não define o pronto')
  assert.match(E.resumo(r.estado), /deduzido da sua descrição, confirme/)
  ok('palpite não vira critério de pronto, e sai marcado no resumo')

  const dele = E.responder(r.estado, 'entrega', 'um app que organiza fotos por evento')
  assert.equal(dele.estado.entrevista.respostas.entrega.de, 'ele')
  assert.equal(E.colher(dele.estado).nome, 'um app que organiza fotos por evento')
  ok('quando ele confirma, a resposta vira dele e passa a valer')

  /* A prova ao contrário: palpite não passa por cima do que ele digitou. */
  const tenta = E.preencherDaProsa(dele.estado, { entrega: 'palpite atrasado' })
  assert.equal(tenta.recusadas[0].porque, 'ele já respondeu isto')
  assert.equal(tenta.estado.entrevista.respostas.entrega.texto, 'um app que organiza fotos por evento')
  ok('a prova ao contrário: palpite NÃO sobrescreve o que ele digitou')
}

/* ── CC-392: a entrevista não pode destruir MVP escrito à mão ────────────── */
{
  const E = await import('./src/entrevista.mjs')

  /**
   * Este é o defeito mais caro achado em 29/08, e ele estava vivo.
   *
   * Cada pergunta pode ter um gancho que grava no estado: "a entrega" escrevia
   * `mvp.nome` DIRETO. Num projeto que já existe, começar uma entrevista
   * trocava o MVP escrito à mão pela primeira frase digitada, sem aviso.
   * **Dez dos onze projetos desta máquina têm MVP escrito à mão.**
   */
  const comMvp = {
    mvp: { nome: 'A v2 do carzo.com.br no ar', criterios: [{ texto: 'a home fala pela casa', feito: false }] },
    entrevista: { respostas: {} },
  }
  const depois = E.responder(comMvp, 'entrega', 'uma frase nova qualquer').estado
  assert.equal(depois.mvp.nome, 'A v2 do carzo.com.br no ar',
    'nome de MVP já escrito não pode ser trocado por uma resposta de entrevista')
  ok('a entrevista não sobrescreve o nome do MVP que já existe')

  /* Acrescentar critério continua valendo: somar não destrói, trocar o nome
     destrói. As duas coisas vinham do mesmo gancho, e só uma delas apaga. */
  const maisUm = E.responder(comMvp, 'pronto', 'funciona no celular').estado
  assert.equal(maisUm.mvp.criterios.length, 2)
  ok('a prova ao contrário: acrescentar critério continua funcionando')

  /* E projeto NOVO, com ele respondendo, continua ganhando nome e critérios:
     é o caso para o qual o gancho nasceu, e ele não pode ter sido quebrado. */
  const novo = E.responder({ mvp: { nome: '', criterios: [] }, entrevista: { respostas: {} } },
    'entrega', 'um painel de agentes').estado
  assert.equal(novo.mvp.nome, 'um painel de agentes')
  ok('projeto novo continua ganhando o nome do MVP pela entrevista')
}

/* ── CC-391: entrevista de FRENTE, em projeto que já existe ──────────────── */
{
  const E = await import('./src/entrevista.mjs')

  let est = {
    mvp: { nome: 'O site carzo v2', criterios: [{ texto: 'a home fala pela casa', feito: false }] },
    entrevista: { respostas: {} },
  }
  est = E.guardarProsa(est, 'um estúdio de vídeo dentro do site', { frente: 'O estúdio de vídeo' }).estado
  assert.equal(E.frenteDa(est), 'O estúdio de vídeo')

  est = E.responder(est, 'entrega', 'um estúdio de vídeo no site').estado
  est = E.responder(est, 'pronto', 'o cliente vê o processo').estado

  /* ⚠️ Uma frente nova NÃO redefine o que o projeto inteiro entrega. */
  assert.equal(est.mvp.nome, 'O site carzo v2', 'o MVP do projeto fica intocado')
  assert.equal(est.mvp.criterios.length, 1, 'e os critérios dele também')
  ok('entrevista de frente não toca no MVP nem nos critérios do projeto')

  /* O que ela produz é backlog, com o nome da frente no título: no roadmap ele
     precisa distinguir o que veio de qual conversa. */
  const texto = E.paraBacklog(est, { quando: '2026-08-29' })
  assert.match(texto, /^## ▶ O estúdio de vídeo \(da entrevista de 29\/08\)/)
  ok('o backlog da frente entra com o nome dela, ao lado do que já existe')

  /* Trocar de frente zera as respostas: são de outra conversa. Herdá-las faria
     o backlog novo descrever o trabalho velho, com as palavras de outro dia. */
  const outra = E.guardarProsa(est, 'outra coisa', { frente: 'Outra frente' }).estado
  assert.deepEqual(outra.entrevista.respostas, {})
  assert.equal(E.frenteDa(outra), 'Outra frente')
  ok('a prova ao contrário: frente nova começa com a conversa em branco')
}


/* ── CC-393 e CC-394: o método novo, e o método virando escolha ──────────── */
{
  const { METODOS, avaliar, PREDICADOS } = await import('./src/framework.mjs')

  const pn = METODOS['projeto-novo']
  assert.ok(pn, 'o método do projeto que nasce de uma descrição precisa existir')
  assert.deepEqual(pn.fases.map((f) => f.id), ['descricao', 'entrevista', 'planejamento', 'execucao'])
  /* As duas primeiras travam código, e é o ponto do método: não se constrói o
     que ainda não foi descrito. */
  assert.ok(pn.fases[0].trava.includes('src/**'))
  assert.ok(pn.fases[1].trava.includes('src/**'))
  ok('o método projeto-novo tem quatro fases, e as duas primeiras travam código')

  assert.match(PREDICADOS['prosa-escrita']({}), /descreva o projeto/)
  assert.equal(PREDICADOS['prosa-escrita']({ entrevista: { prosa: { texto: 'um app que organiza fotos por evento' } } }), null)
  /* Prosa de três palavras não é descrição: o portão pediria e ele fecharia com
     qualquer coisa, e a entrevista sairia sem nada para ler. */
  assert.match(PREDICADOS['prosa-escrita']({ entrevista: { prosa: { texto: 'um app' } } }), /descreva/)
  ok('o portão da descrição recusa prosa curta demais para ser lida')

  /* ⚠️ Palpite meu não fecha fase. Sem isto, a fase avançaria sobre uma frase
     que ele nunca escreveu, e o projeto inteiro seria planejado em cima dela. */
  assert.match(PREDICADOS['entrevista-confirmada']({ entrevista: { respostas: { a: { de: 'prosa' } } } }),
    /palpite meu/)
  assert.equal(PREDICADOS['entrevista-confirmada']({ entrevista: { respostas: { a: { de: 'ele' } } } }), null)
  ok('a fase da entrevista não fecha enquanto houver palpite meu sem confirmação')
}


/* ── CC-397: o painel 2.0 vive ao lado, e a raiz não muda ────────────────── */
{
  const v2 = readFileSync('src/ui_v2.html', 'utf8')
  const v3 = readFileSync('src/ui_novo.html', 'utf8')

  /**
   * Pedido dele em 29/08: *"vamos executar um plano em etapas p nao atrapalhar
   * o funcionamento do meu fluxo atual (…) talvez um cockpit 2.0 e só trocar
   * quando estiver aprovado"*.
   *
   * A promessa inteira depende de UMA coisa: o painel de todo dia continuar
   * intocado enquanto o novo é construído. Este teste é o que segura isso.
   */
  assert.ok(!v2.includes('faixa-novo'),
    'a faixa do painel em construção vazou para o painel de todo dia. A raiz é '
    + 'o que ele usa na rua, e ela não pode mudar antes de ele aprovar.')
  ok('a faixa do painel novo não vaza para o que ele usa hoje')

  /* O novo tem que dizer onde ele está. Dois painéis idênticos em endereços
     diferentes é ele mexendo num achando que é o outro. */
  assert.ok(v3.includes('faixa-novo'), 'o painel novo precisa se identificar')
  assert.match(v3, /Cockpit 2\.0/)
  ok('o painel novo diz que é o painel novo, e aponta o caminho de volta')

  /* Os dois compilam. Erro de sintaxe no painel é o defeito mais caro daqui:
     acontece antes de qualquer código rodar, e nem `window.onerror` pega. A
     tela fica em "carregando" para sempre, sem nada na tela. */
  for (const [nome, html] of [['ui_v2', v2], ['ui_novo', v3]]) {
    const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    assert.ok(blocos.length >= 1, `${nome}.html deixou de ter bloco de script`)
    for (const [i, b] of blocos.entries()) {
      assert.doesNotThrow(() => new Function(b), `${nome}.html tem erro de sintaxe no bloco ${i}`)
    }
  }
  ok('os dois painéis compilam, o de hoje e o em construção')

  /* E o servidor serve os dois, em endereços diferentes. Sem isto, a bifurcação
     existe no disco e não existe para ele. */
  const web = readFileSync('src/web.mjs', 'utf8')
  assert.match(web, /url\.pathname === '\/novo'/)
  assert.match(web, /url\.pathname === '\/' \|\| url\.pathname === '\/v2'/,
    'a raiz continua servindo o painel de todo dia')
  ok('a raiz serve o de hoje, e /novo serve o em construção')
}

console.log(`\n${passou} verificações, todas passaram.`)
