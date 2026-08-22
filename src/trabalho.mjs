/**
 * A tela que abre o painel: "em que pé está o trabalho?"
 *
 * ## A mudança, numa frase
 *
 * A unidade da tela deixa de ser o agente e passa a ser **o item do backlog**.
 * O resto é consequência disso.
 *
 * Pedido dele em 16/08, e a ordem em que ele olha as coisas:
 *
 * > "primeiro eu preciso ver em qual item do backlog estamos, depois preciso
 * > ver em que tarefas estamos e em paralelo ver se tem pendencias minhas como
 * > humano travando o projeto"
 *
 * O painel tinha dezessete telas e nenhuma respondia a primeira dessas
 * perguntas. Cada uma respondia bem uma pergunta isolada; nenhuma respondia a
 * sequência.
 *
 * ## O que este módulo faz, e o que ele deliberadamente NÃO faz
 *
 * Junta três coisas que já existem: o backlog de cada projeto, os agentes
 * trabalhando, e o que só ele resolve. **Não guarda nada** e não inventa campo:
 * tudo aqui é leitura cruzada do que o roadmap e os agentes já dizem.
 *
 * O elo entre o agente e o item de backlog é o campo de frente que o agente
 * escreve. É o mesmo elo que o cartão do agente usa desde 15/08, e por isso ele
 * existe: sem ele, "Pierre: travessia gamificada" não dizia nada a ele, embora
 * "Pierre" fosse uma seção do roadmap.
 */
import fs from 'node:fs'
import path from 'node:path'
import { lerRoadmap, ordenar, pesoDe, citacaoDe, deOutraPlataforma } from './roadmap.mjs'

/**
 * O estado do item em uma palavra, com o porquê ao lado.
 *
 * Estado sozinho é rótulo; estado com motivo é resposta. É a terceira regra da
 * frente "a tela fala a língua dele": todo estado tem veredito, não só valor.
 *
 * A ordem das perguntas importa: um item com agente dentro está ANDANDO mesmo
 * que o roadmap o marque como parado, porque o mundo real venceu o arquivo.
 */
export function estadoDoItem(frente, { agentes = [], pendencias = [] } = {}) {
  if (frente.estado === 'feito') return { palavra: 'FECHADA', cor: 'done', porque: null }
  if (agentes.length) {
    return {
      palavra: 'ANDANDO',
      cor: 'working',
      porque: `${agentes.length} agente${agentes.length > 1 ? 's' : ''}`,
    }
  }
  if (pendencias.length) {
    const n = pendencias.length
    return { palavra: 'VOCÊ DECIDE', cor: 'waiting', porque: n > 1 ? `${n} coisas suas` : '1 coisa sua' }
  }
  if (frente.estado === 'esperando') return { palavra: 'VOCÊ DECIDE', cor: 'waiting', porque: motivoDoTitulo(frente.titulo) }
  if (frente.estado === 'bloqueado') return { palavra: 'TRAVADA', cor: 'failed', porque: motivoDoTitulo(frente.titulo) }
  return { palavra: 'NA FILA', cor: 'idle', porque: null }
}

/** O que vem depois do marcador de pausa no título já é o motivo escrito. */
function motivoDoTitulo(titulo) {
  const m = /⏸\s*([^—:]+)/.exec(String(titulo))
  return m ? m[1].trim().slice(0, 40) : null
}

/**
 * O título vira duas coisas: um nome curto e uma descrição.
 *
 * Medido nos roadmaps reais: o título tem 61 caracteres em média e 80 no pior
 * caso. A pastilha antiga mostrava 28, cortando o dado principal da tela para
 * caber num enfeite redondo.
 *
 * Os títulos já têm forma regular (`Frente: X`, `CC-98 ✅ 16/08 — Y`), então o
 * corte é derivado, sem ninguém reescrever nada: fora o identificador e a data,
 * o nome é o que vem antes do primeiro separador.
 */
export function partirTitulo(titulo) {
  /* A ordem destas duas linhas é o conserto de um defeito visível na tela: o
     título real é `CC-102 Frente: o projeto visto por rotas`, com o código na
     FRENTE da palavra "Frente". Tirando "Frente:" primeiro, o padrão nunca
     casava, e a palavra sobrava em nove cartões seguidos do mesmo projeto,
     dizendo a mesma coisa nove vezes. */
  const limpo = String(titulo || '')
    .replace(/^\s*[A-Z]{1,3}-\d+\s*/, '')
    .replace(/^\s*(?:Frente:\s*)?/i, '')
    /* O marcador de pausa vem seguido do MOTIVO, não do nome: "⏸ decisão do
       Felipe — o estudo está pronto". Sem comer o motivo junto, o cartão diria
       "decisão do Felipe" como se esse fosse o nome do item — o motivo já
       aparece no estado, e repetir ali apagaria o nome de verdade.

       ⚠️ **O `⏸` já foi embora quando o título chega aqui**, e por isso as duas
       linhas que dependem dele nunca casaram. `limpar()`, no `roadmap.mjs`,
       apaga todos os marcadores (`[🔴🟡🟢🔥✅✔⛔⏳📌⏸]`) antes de o título sair
       de lá, então este passo recebia `você decide — o estudo está pronto` sem
       marcador nenhum e só o corte genérico agia: nome virava "você decide".

       O estrago era invisível no código e visível na tela: **CC-80 e CC-155
       viraram o MESMO cartão**. Os dois começam com "⏸ você decide", os dois
       ficaram com `nome: "você decide"`, e a chave do cartão é
       `projeto:nome` — clicar em um abria o outro, com a descrição do outro.
       Foi ele quem viu, perguntando se os dois itens eram a mesma coisa.

       Por isso o marcador é OPCIONAL nos dois padrões abaixo: funciona com ele
       (título cru) e sem ele (título já limpo). Tirar a limpeza de lá seria
       consertar pelo lado errado, porque o marcador tem que sumir do texto que
       aparece na tela. */
    .replace(/^[✅⚠️🔴🟢🟡]+\s*/u, '')
    .replace(/^⏸\s*[^—–]{0,40}[—–]\s*/u, '')
    .replace(/^⏸\s*/u, '')
    .replace(/^\s*\d{2}\/\d{2}(\s*\([^)]*\))?\s*/, '')
    .replace(/^\s*[—–:-]\s*/, '')
    /* Rabicho de fim de título, que na lista vira ruído puro. Dois padrões, e
       os dois são apêndice, nunca o nome:
         "Bancada, auditoria e teste agnóstico, ver [[produto/BANCADA]]"
         "a tela fala a língua dele, aprovada em 15/08"
       O ponteiro de documento some porque o detalhe mostra o título cru; a data
       de aprovação some porque a coluna da idade já responde "de quando é isto".
       A vírgula na frente é obrigatória de propósito: sem ela, "Visão registrada
       em 14/08: o cockpit vira um framework" perderia o nome inteiro. */
    .replace(/[\s,—–]*\bver\s*\[\[[^\]]+\]\]\s*$/i, '')
    .replace(/,\s*(?:aprovad|abert|aceit|decidid)[ao]\b[^,]*?\bem\s+\d{2}\/\d{2}\s*$/i, '')
    .trim()

  /* 6 e não 12: "Bancada — auditoria e teste agnóstico" tem o separador na
     posição 7, e o limite alto deixava o título inteiro como nome. */
  const corte = limpo.search(/\s[—–]\s|:\s|,\s|\(/)
  if (corte > 6 && corte < 60) {
    return { limpo, nome: limpo.slice(0, corte).trim(), descricao: limpo.slice(corte).replace(/^[\s—–:,(]+/, '').trim() }
  }
  return { limpo, nome: limpo, descricao: '' }
}

/** O identificador que aparece no roadmap, quando existe. Serve para buscar. */
const idDoTitulo = (t) => (/\b([A-Z]{1,3}-\d+)\b/.exec(String(t)) || [])[1] || null

/**
 * O número que aparece na lista, e de onde ele vem.
 *
 * Pedido dele em 16/08, olhando a tela nova: *"como era antes, com o numero da
 * tarefa e o nome da tarefa do lado"*. A tela anterior mostrava o título cru do
 * roadmap, que começa pelo identificador; ao partir o título em nome e
 * descrição, o identificador se perdeu — e com ele o jeito de apontar para um
 * item pelo nome curto.
 *
 * **Só oito dos 52 itens têm identificador de verdade.** Os outros são
 * cabeçalhos `###` escritos sem código. Sem um número em todos, os nomes ficam
 * desalinhados e a lista deixa de ser varrível de olho, que é o uso inteiro.
 *
 * Então: quem tem código mostra o código; quem não tem mostra a POSIÇÃO no
 * arquivo, com `#` na frente e em cinza. As duas coisas não se confundem, e a
 * segunda não é inventada — é onde o item está no `ROADMAP.md`, contando os
 * `###` de cima para baixo. Quando alguém der um código ao item, ele aparece
 * sozinho aqui.
 */
export function marcaDoItem(titulo, posicao) {
  const id = idDoTitulo(titulo)
  if (id) return { texto: id, real: true }
  return { texto: `#${String(posicao).padStart(2, '0')}`, real: false }
}

/**
 * Fração de tarefas fechadas, e ela só aparece quando é verdade.
 *
 * Medido em 16/08 nos 14 roadmaps: este projeto tem 30 itens de lista e **zero
 * caixinhas marcadas**, então a fração diria `0/30` em todo cartão, para
 * sempre. Barra de progresso vazia por falta de dado mente mais que a ausência
 * dela — e é o mesmo defeito da camada que dizia "limpo" sem ter olhado.
 */
const fracaoHonesta = (f) => (f.feitos > 0 ? { feitos: f.feitos, itens: f.itens } : null)

/**
 * Monta a tela inteira.
 *
 * Recebe os jobs já mesclados (com as máquinas remotas dentro) e a lista de
 * pendências dele, para não reler disco: quem lê é o servidor, uma vez por
 * requisição.
 */
export function montar({ projetos = [], jobs = [], pendencias = [], ordem = 'importancia' } = {}) {
  const grupos = []

  for (const { projeto, raiz, mapa, ordens } of projetos) {
    if (!mapa?.grupos?.length) continue

    /* A ordem sai pronta do roadmap quando existe; sem git, cai na ordem do
       arquivo, que é melhor que nenhuma. */
    const ordenadas = ordens
      ? (ordem === 'tempo' ? ordens.porTempo : ordens.porImportancia)
      : mapa.grupos.flatMap((g) => g.frentes)

    /* A posição é a do ARQUIVO, não a da tela: trocar a ordenação não pode
       renumerar a lista, senão o número deixa de servir para apontar. */
    const posicoes = new Map()
    mapa.grupos.flatMap((g) => g.frentes).forEach((f, i) => posicoes.set(f.titulo, i + 1))

    const cartoes = []
    for (const f of ordenadas) {
      if (f.estado === 'feito') continue // fechadas ficam no rodapé, dobradas

      const daFrente = jobs.filter((j) => j.project === projeto
        && j.frente && casaFrente(j.frente, f.titulo))
      const minhas = pendencias.filter((p) => p.projeto === projeto
        && p.frente && casaFrente(p.frente, f.titulo))

      /* `tituloCru` quando existe: ele ainda tem o `⏸`, e `partirTitulo` usa
         esse marcador para separar o MOTIVO da pausa do nome do item. Com o
         título já limpo, "⏸ você decide — o estudo está pronto" perdia a
         âncora e virava nome "você decide", igual em todo item pausado. Ver o
         comentário em `partirTitulo` e o que isso causou na tela. */
      const { limpo, nome, descricao } = partirTitulo(f.tituloCru || f.titulo)
      cartoes.push({
        id: idDoTitulo(f.titulo),
        marca: marcaDoItem(f.titulo, posicoes.get(f.titulo) || cartoes.length + 1),
        /* O que a linha mostra: o título inteiro, sem o código nem a data, que
           já têm coluna própria. Partir em nome e descrição servia ao cartão,
           que tinha um nome grande em cima e a prosa embaixo. Numa lista de uma
           linha ele vira mutilação: "o que pre-commit, husky e Danger já
           resolveram" cortado na vírgula sai "o que pre-commit", que não é
           nome de nada. */
        rotulo: limpo,
        nome,
        descricao,
        titulo: f.titulo,
        citacao: f.citacao || null,
        estado: estadoDoItem(f, { agentes: daFrente, pendencias: minhas }),
        peso: pesoDe(f),
        nasceuEm: f.nasceuEm || null,
        dependeDe: f.dependeDe || [],
        importancia: f.importancia ?? null,
        fracao: fracaoHonesta(f),
        tarefas: daFrente.flatMap((j) => (j.todos || [])
          .filter((t) => !t.done && t.dono !== 'felipe')
          /* O código composto é o formato dele, `produto10_sprint01`: o item
             de backlog dá o sobrenome e a tarefa dá o número. Só existe quando
             a frente casou; sem item, a tarefa fica com o código curto dela. */
          .map((t) => ({ texto: t.text, job: j.id, agente: j.subject || null, codigo: t.codigo || null }))),
        /* `fonte` vai junto porque a tela decide por ela se cabe uma caixinha:
           só o que mora na lista dele pode ser marcado. Pendência lida do
           roadmap não tem onde gravar, e caixinha que não grava é controle
           morto — o pior defeito possível numa lista de tarefas. */
        pendencias: minhas.map((p) => ({ id: p.id, texto: p.texto, em: p.em, fonte: p.fonte || null })),
      })
    }

    const fechadas = mapa.grupos.flatMap((g) => g.frentes).filter((f) => f.estado === 'feito').length
    if (cartoes.length || fechadas) grupos.push({ projeto, raiz, cartoes, fechadas })
  }

  /* O inverso da dependência: quem eu destravo quando fechar. Calculado aqui,
     onde todos os cartões de todos os projetos já existem, porque a dependência
     pode cruzar projeto. É a linha da planilha dele: "qual tarefa dependência
     de outra ou desbloqueava outra". */
  const desbloqueios = new Map()
  for (const g of grupos) for (const c of g.cartoes) {
    for (const alvo of c.dependeDe || []) {
      if (!desbloqueios.has(alvo)) desbloqueios.set(alvo, [])
      if (c.id) desbloqueios.get(alvo).push(c.id)
    }
  }
  for (const g of grupos) for (const c of g.cartoes) {
    c.desbloqueia = c.id ? (desbloqueios.get(c.id) || []) : []
  }

  /* Projeto sem nada aberto não vira seção: vira uma linha no fim. É a quinta
     regra da frente da linguagem — cada nível responde sozinho, o de baixo só
     aparece se pedirem. */
  const comAberto = grupos.filter((g) => g.cartoes.length)
  const semNada = grupos.filter((g) => !g.cartoes.length).map((g) => g.projeto)

  return {
    grupos: comAberto,
    semNada,
    pendencias,
    veredito: veredito(comAberto, pendencias, jobs),
    ordem,
    at: Date.now(),
  }
}

/**
 * O agente diz a frente com as palavras dele, e o roadmap com as dele.
 *
 * "Bancada" casa com "Frente: Bancada, auditoria e teste agnóstico". Comparar
 * texto exato falharia em quase todo caso real, e foi por isso que o campo de
 * frente quase não serviu quando nasceu.
 */
function casaFrente(daSessao, doRoadmap) {
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const a = norm(daSessao)
  const b = norm(doRoadmap)
  if (!a || a.length < 3) return false
  return b.includes(a) || a.includes(norm(partirTitulo(doRoadmap).nome))
}

/** A frase do topo. Sem número solto: ele discorda de frase, não de "87". */
function veredito(grupos, pendencias, jobs = []) {
  /* A frase conta AGENTES, não frentes do roadmap, e a mudança conserta uma
     contradição que aparecia na tela inteira ao mesmo tempo: o veredito dizia
     "nada andando agora" enquanto a linha logo abaixo dizia "RODANDO
     proj_controlcenter", o cabeçalho dizia "1 ATIVOS" e cinco quadrados
     apareciam marcados como andando.

     Nenhum dos dois números estava errado. Eles contavam universos
     diferentes, frentes com item em progresso contra agentes vivos, e essa
     distinção é invisível para quem lê. A regra que sai daqui: o veredito do
     topo fala do MESMO universo que a tela mostra embaixo dele. */
  const andando = jobs.filter((j) => j.status === 'working').length
  const esperando = jobs.filter((j) => j.status === 'waiting').length
  const travadas = pendencias.filter((p) => !p.feito).length

  /* O estado de calma, que faltava: a tela era idêntica com cinco coisas
     travadas nele e com nenhuma. Um painel que não muda quando o mundo muda
     não é painel, é papel de parede, e ele perde o hábito de olhar.

     `cor` sai junto porque a moldura do topo precisa concordar com a frase:
     dizer "está tudo em ordem" numa faixa laranja seria pior que não dizer. */
  const parado = (n) => `${n} andando`

  if (!travadas && !esperando && !andando) {
    return { frase: 'nada esperando você, e nada rodando agora', cor: 'bom', calmo: true }
  }
  if (!travadas && !esperando) {
    return { frase: `nada esperando você, ${parado(andando)}`, cor: 'bom', calmo: true }
  }

  const partes = []
  if (esperando) partes.push(`${esperando} agente${esperando > 1 ? 's' : ''} esperando você`)
  if (travadas) partes.push(`${travadas} coisa${travadas > 1 ? 's' : ''} travada${travadas > 1 ? 's' : ''} em você`)
  if (andando) partes.push(parado(andando))
  return { frase: partes.join(', '), cor: 'atencao', calmo: false }
}

/**
 * A pasta principal de um checkout, ou `null` se ele já é a principal.
 *
 * Numa árvore de trabalho do git (`git worktree`), `.git` é um ARQUIVO com uma
 * linha `gitdir: /caminho/principal/.git/worktrees/nome`. Na pasta principal
 * ele é um diretório. É a checagem mais barata que existe e não chama git.
 */
function principalDe(raiz) {
  try {
    const g = path.join(raiz, '.git')
    if (fs.statSync(g).isDirectory()) return null
    const m = /gitdir:\s*(.+?)[\\/]\.git[\\/]worktrees[\\/]/.exec(fs.readFileSync(g, 'utf8'))
    return m ? m[1].trim() : null
  } catch { return null }
}

/**
 * Os projetos que valem carregar: os que têm agente vivo ou roadmap.
 *
 * **Árvore de trabalho não é projeto novo.** Achado em 16/08: `proj_controlcenter`
 * e `proj_controlcenter--front` são o mesmo repositório em duas branches, e a
 * lista mostrava os mesmos itens duas vezes, quinze linhas repetidas de 52.
 * Ler o roadmap da branch de trabalho e o da principal dá dois backlogs para um
 * projeto só, e nenhum jeito de saber qual é o de verdade. Fica a principal;
 * a secundária só entra se a principal não estiver na lista.
 */
export function projetosDe(jobs = [], achar = () => []) {
  const vistos = new Map()

  /* CC-305: a pasta LOCAL vence a que veio de outra máquina.
     A federação traz o `cwd` dos agentes do PC no formato do Windows, e um
     projeto que existe nas duas máquinas ficava com o caminho de lá. O
     `fibraessencia` tem roadmap próprio nesta VPS e aparecia com backlog zero,
     porque a lista apontava para `D:\…\fibraessencia`, que aqui não existe. */
  const locais = new Map()
  for (const raiz of achar()) locais.set(path.basename(raiz), raiz)

  for (const j of jobs) {
    if (!j.cwd || vistos.has(j.project)) continue
    if (deOutraPlataforma(j.cwd) && locais.has(j.project)) {
      vistos.set(j.project, locais.get(j.project))
      continue
    }
    vistos.set(j.project, j.cwd)
  }
  for (const raiz of achar()) {
    const nome = path.basename(raiz)
    if (!vistos.has(nome)) vistos.set(nome, raiz)
  }

  const raizes = new Set([...vistos.values()].map((r) => path.resolve(r)))
  return [...vistos]
    .filter(([, raiz]) => {
      const principal = principalDe(raiz)
      return !(principal && raizes.has(path.resolve(principal)))
    })
    .map(([projeto, raiz]) => ({ projeto, raiz }))
}

/** Lê o roadmap de cada projeto, com as duas ordens. Uma leitura por projeto. */
export function carregar(lista) {
  return lista.map(({ projeto, raiz }) => {
    let mapa = null
    let ordens = null
    try { mapa = lerRoadmap(raiz) } catch { /* projeto sem roadmap */ }
    if (mapa) {
      try { ordens = ordenar(raiz, mapa) } catch { /* sem git: fica sem ordem */ }
      // a citação alimenta o cartão, e o parser já a extrai do corpo
      for (const g of mapa.grupos) for (const f of g.frentes) f.citacao ||= citacaoDe(f.corpo)
    }
    return { projeto, raiz, mapa, ordens }
  }).filter((p) => p.mapa)
}
