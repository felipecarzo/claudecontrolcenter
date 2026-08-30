/**
 * CC-304: a tela Projetos, o que cada projeto tem, reunido num lugar só.
 *
 * Pedido dele em 22/08, e a frase que decide o desenho:
 *
 * > *"seria bom ter um com todos os projetos e as opções de projeto que já
 * > temos nos apps, mas concentradas dentro dos projetos. isso dá uma boa visão
 * > de funções por projeto, que é como eu acabo enxergando os trabalhos."*
 *
 * ## O problema, medido
 *
 * Um projeto está espalhado por **14 telas**: agentes no Cockpit, backlog em
 * Trabalho, roadmap em Estrutura, sessões em Remoto, fase em Framework, mais
 * Rotinas, Bancada, Tempo, Custo, Travas, Tendências e Digest. O servidor já
 * sabe responder por projeto em 21 lugares. **O dado existe inteiro e nunca foi
 * reunido.**
 *
 * ## A divisão que decide tudo: barato e caro
 *
 * Este módulo entrega só o BARATO, o que já está em memória ou custa uma
 * leitura curta, para os vinte projetos de uma vez.
 *
 * O caro fica de fora e é buscado por projeto, sob clique: ler o git de um
 * projeto custa ~83ms, e vinte deles seriam 1,6 segundo a cada abertura de
 * tela. É a mesma regra da varredura de portas e da colheita da zona
 * inteligente, e este painel já pagou a conta de esquecê-la.
 */
import fs from 'node:fs'
import path from 'node:path'
import { findProjects } from './install.mjs'
import { projetosDe } from './trabalho.mjs'
import { deOutraPlataforma } from './roadmap.mjs'
import { nomeDoAgenteCom } from './trabalho.mjs'
import { chaveDeProjeto } from './nomeProjeto.mjs'

/** Horas em texto curto. Zero vira null: bloco vazio some, não mostra "0h". */
const horas = (ms) => {
  if (!ms || ms < 60_000) return null
  const h = Math.floor(ms / 3_600_000)
  const m = Math.round((ms % 3_600_000) / 60_000)
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

/**
 * O retrato de todos os projetos.
 *
 * Recebe tudo pronto de fora em vez de buscar: quem chama (a rota) já tem os
 * agentes do fluxo e o resumo de trabalho em cache, e refazer essas leituras
 * aqui seria pagar duas vezes pelo mesmo dado.
 */
export function retrato({
  jobs = [],
  trabalho = null,
  tempo = null,
  sessoesAtivas = {},
  conversas = null,
  visitas = {},
  achar = findProjects,
  remotos = [],
} = {}) {
  const lista = projetosDe(jobs, achar)

  /* Agentes vivos por projeto. `done` fica de fora porque o CLI marca `done` ao
     fim de CADA turno, e um agente entregue não é trabalho em andamento: é a
     armadilha registrada que já pôs agente trabalhando na faixa de "prontos". */
  /* ⚠️ **A MESMA conta de nome que a lista usa.** Agrupar por `j.project` cru
     enquanto a lista chama o projeto de `games/hutukara` deixa o cartão com
     zero agentes e cara de desligado, com seis rodando dentro. Medido em 30/08,
     e foi o defeito que a primeira versão do conserto criou. */
  const nomeDoAgente = nomeDoAgenteCom(new Map(lista.map((x) => [x.projeto, x.raiz])))
  const agentesPor = new Map()
  for (const j of jobs) {
    const nome = nomeDoAgente(j)
    if (!nome) continue
    if (!agentesPor.has(nome)) agentesPor.set(nome, [])
    agentesPor.get(nome).push(j)
  }

  /* Um grupo por projeto, e os `cartoes` são os itens abertos do backlog dele.
     Os nomes vêm de `/api/trabalho`, conferidos na resposta real: um grupo tem
     `{projeto, raiz, cartoes, fechadas}`, e não `itens` nem `abertos`. */
  const backlogPor = new Map()
  for (const g of trabalho?.grupos || []) {
    if (!g.projeto) continue
    const cartoes = Array.isArray(g.cartoes) ? g.cartoes : []
    backlogPor.set(g.projeto, {
      /* Frentes abertas mais itens soltos: os roadmaps dele são escritos dos
         dois jeitos, e contar só um esconderia metade dos projetos. */
      abertos: cartoes.length + Number(g.soltos || 0),
      frentes: cartoes.length,
    })
  }

  /* As pendências humanas vêm em `pendencias`, no topo da resposta, e não
     dentro do grupo do projeto. Cada uma já carrega o projeto a que pertence. */
  const meuPor = new Map()
  for (const m of trabalho?.pendencias || []) {
    if (!m.projeto || m.feito) continue
    meuPor.set(m.projeto, (meuPor.get(m.projeto) || 0) + 1)
  }

  const tempoPor = new Map((tempo?.projetos || []).map((p) => [p.projeto, p]))

  const hoje = new Date().toISOString().slice(0, 10)
  const saida = lista.map(({ projeto, raiz }) => {
    const meus = agentesPor.get(projeto) || []
    /* CC-337, 25/08: `idle` sai de `vivos`, e ele achou isto na tela.
     *
     * Print dele com o coepiloto no grupo "sem sessão aberta" e o cartão
     * dizendo "1 TRABALHANDO": *"identifique porque que vps-coepiloto ta ali
     * se ele ja ta off"*. Medido: a sessão não tinha tmux, não tinha processo,
     * e o transcrito dela estava parado havia 3h24.
     *
     * A causa era esta linha contando qualquer status diferente de `done`.
     * `idle` quer dizer justamente o contrário de trabalhando: é o que
     * `statusDe()` devolve depois de 30 minutos de silêncio. Sobrou `working`
     * (escrevendo agora) e `waiting` (parou há pouco, espera ele), que são os
     * dois estados em que existe alguém do outro lado.
     *
     * `ociosos` não some: vira campo próprio, para a tela poder dizer "1
     * ocioso" em vez de esconder o agente ou mentir que ele trabalha. */
    const vivos = meus.filter((j) => j.status === 'working' || j.status === 'waiting')
    const ociosos = meus.filter((j) => j.status === 'idle')
    const esperando = meus.filter((j) => j.status === 'waiting').length
    const t = tempoPor.get(projeto) || null
    const doDia = (t?.dias || []).find((d) => d.dia === hoje) || null
    /* `null` quer dizer "ainda não li as conversas", e é diferente de zero.
       Tratar os dois igual faz o cartão afirmar "parado" sobre o que não sabe,
       defeito que já apareceu na tela Remoto ontem. */
    const conv = Array.isArray(conversas)
      ? conversas.filter((c) => c.projeto === projeto).length
      : null

    /* Onde este projeto mora, e a distinção não é detalhe.
       A federação traz agentes do PC, e junto vêm pastas que não são projeto
       daqui: a home do Windows, o scratchpad de uma sessão. Misturadas com os
       projetos locais, elas viram linhas que ele não reconhece e não pode
       abrir. A tela separa em vez de esconder: esconder faria sumir agente que
       está mesmo trabalhando. */
    const daqui = !deOutraPlataforma(raiz) && existe(raiz)

    /* ===== CC-365: "ligado" vira UMA conta, e ela mora aqui =====
     *
     * Definição dele, dada em 27/08 ao desenhar as três telas: *"ligado é com
     * sessão ativa no Claude ou coderoom"*. São as duas fontes, e a segunda é
     * a mudança: em 25/08 ele tinha decidido que conversa parada do Coderoom
     * NÃO contava, e a tela guardava essa régua num `temSessaoNoAr` próprio.
     * Agora conta.
     *
     * Por que no servidor e não na tela: eram duas contas para o mesmo fato, e
     * elas já divergiam. A tela FILTRAVA por uma régua (que inclui conversa) e
     * AGRUPAVA por outra (que exclui) — o mesmo projeto entrava na lista por
     * ter conversa e caía na faixa "sem sessão aberta" logo abaixo. Duas
     * verdades no mesmo quadro é o defeito que este painel já pagou várias
     * vezes.
     *
     * `ociosos` fica de fora de propósito: `idle` é o que `statusDe()` devolve
     * depois de 30 minutos de silêncio, e contá-lo é o CC-337 de volta (ele viu
     * um projeto morto anunciando "1 TRABALHANDO").
     *
     * ⚠️ `conv` é `null` enquanto as conversas não foram lidas, e `null` não
     * liga ninguém: afirmar "desligado" sobre o que não se leu seria mentir com
     * confiança. Quem precisa saber olha `leuConversas`, que viaja no topo. */
    const ligadoPor = [
      ...(vivos.length ? ['agente'] : []),
      ...(sessoesAtivas[projeto] ? ['sessao'] : []),
      ...(conv ? ['coderoom'] : []),
    ]

    return {
      /* A resposta pronta para a pergunta que a tela faz o tempo todo. */
      ligado: ligadoPor.length > 0,
      /* E por QUE ele está ligado: "ligado" sozinho não deixa o cartão dizer se
         é agente escrevendo agora ou conversa esperando resposta. */
      ligadoPor,
      projeto,
      raiz,
      daqui,
      /* De qual máquina este projeto é, quando não é daqui. Sai do próprio
         agente que trouxe o projeto pela federação (`origem.nome`, carimbado
         em `mesclar()`), o mesmo nome que `pedirSessao` espera em
         `paraMaquina` — é o que permite o cartão pedir "abra uma sessão aí",
         em vez de só avisar que o projeto é de outro lugar. */
      maquinaDeFora: daqui ? null : (meus[0]?.origem?.nome || null),
      /* Pasta que existe aqui mas não é projeto (sem `.git` e sem `CLAUDE.md`)
         é lugar de passagem, não trabalho: scratchpad, pasta temporária. */
      ehProjeto: daqui && (existe(path.join(raiz, '.git')) || existe(path.join(raiz, 'CLAUDE.md'))),
      agentes: meus.length,
      vivos: vivos.length,
      ociosos: ociosos.length,
      /* Há quanto tempo o mais recente dos ociosos falou. A tela precisa DIZER
         o silêncio, senão "1 ocioso" e "1 ocioso há três dias" viram a mesma
         linha, e foi confundir idade com atividade que criou o estrago de
         ontem no controle remoto. */
      ociosoDesde: ociosos.length
        ? Math.max(...ociosos.map((j) => Number(j.updatedAt) || 0)) || null
        : null,
      /* ── CC-430: quando foi o último sinal DESTE projeto, seja qual for ─────
       *
       * Ele, em 30/08: *"o hatukara não tá parado, tô mexendo nele agora
       * mesmo"*, sobre um cartão que dizia parado. E ele estava certo: entre a
       * medida anterior e aquele instante o agente voltou a trabalhar.
       *
       * ⚠️ **O painel não vê a tela dele, vê o último sinal.** O que chega é a
       * última vez que a sessão escreveu no arquivo de conversa, empurrado a
       * cada 30 segundos pela outra máquina. Enquanto uma ferramenta longa roda,
       * ou enquanto ele lê e pensa, esse relógio não anda, e existe uma janela
       * em que ele está trabalhando e o painel ainda não sabe.
       *
       * Sem dizer a idade, "trabalhando" e "trabalhando há 40 minutos" viram a
       * mesma linha, e ele não tem como saber em qual dos dois está olhando. É
       * a mesma decisão do `ociosoDesde`, agora para o projeto inteiro. */
      ultimoSinal: meus.length
        ? Math.max(...meus.map((j) => Number(j.updatedAt) || 0)) || null
        : null,
      esperando,
      /* A frente mais citada pelos agentes: é o vocabulário DELE, tirado do
         roadmap, e foi por isso que o campo nasceu. "Pierre" diz algo; o
         assunto que o agente inventou, não. */
      frente: maisCitada(meus.map((j) => j.meta?.frente).filter(Boolean)),
      sessaoNoAr: Boolean(sessoesAtivas[projeto]),
      conversas: conv,
      backlog: backlogPor.get(projeto)?.abertos || 0,
      frentes: backlogPor.get(projeto)?.frentes || 0,
      soSeus: meuPor.get(projeto) || 0,
      /* CC-438: nasce `null` nos DOIS caminhos, e é preenchido depois que a
         lista inteira existe. Campo que só aparece num dos ramos obriga quem lê
         a testar `undefined` e `null`, e um dos dois sempre escapa. */
      tambemEm: null,
      horasHoje: horas(doDia?.ativoMs),
      horasTotal: horas(t?.ativoMs),
      custoBrl: t?.custoBrl ?? null,
      visto: visitas[projeto] || null,
    }
  })

  /* Ordem: quem exige agora vem primeiro, e o resto por trabalho recente.
     Alfabético seria arbitrário e faria a tela mudar de sentido conforme o
     nome do projeto. */
  saida.sort((a, b) => (
    (b.esperando - a.esperando)
    || (b.vivos - a.vivos)
    || ((b.conversas || 0) - (a.conversas || 0))
    || (b.backlog - a.backlog)
    || a.projeto.localeCompare(b.projeto)
  ))

  /* ===== CC-422: os projetos da OUTRA máquina, mesmo sem agente aberto =====
   *
   * Queixa dele em 29/08, em cinco palavras: *"não consigo ver os projetos do
   * pc"*.
   *
   * Medido: a lista sai de `projetosDe(jobs)`, ou seja, um projeto de fora só
   * existe aqui se tiver AGENTE aberto lá. O PC tinha 3 agentes em 2 pastas, e
   * as duas estavam ligadas, então a tela Remoto escondia as duas (ela esconde
   * o que já tem sessão) e sobrava uma seção vazia.
   *
   * E o dado estava chegando o tempo todo: o PC manda 11 backlogs, um por
   * projeto com roadmap. Onze projetos conhecidos, zero na tela.
   *
   * ⚠️ **O mesmo projeto aparece nas DUAS máquinas de propósito.** `cockpit`
   * existe no PC e aqui, e são duas pastas, dois roadmaps e dois estados de
   * git. Juntar os dois numa linha só é o que a tela fazia antes de 27/08, e é
   * a queixa que gerou a separação por máquina: *"os projetos eram separados
   * por desktop e vps"*.
   */
  const jaTem = new Set(saida.filter((p) => !p.daqui).map((p) => `${p.maquinaDeFora}|${p.projeto}`))
  for (const r of remotos) {
    if (!r?.projeto || !r?.maquina) continue
    if (jaTem.has(`${r.maquina}|${r.projeto}`)) continue
    jaTem.add(`${r.maquina}|${r.projeto}`)
    saida.push({
      ligado: false,
      ligadoPor: [],
      projeto: r.projeto,
      raiz: r.raiz || null,
      daqui: false,
      maquinaDeFora: r.maquina,
      /* Ter roadmap com frentes É a prova de que é projeto: não dá para olhar o
         disco da outra máquina daqui, e afirmar sobre o que não se leu é o
         defeito que este painel mais paga. */
      ehProjeto: true,
      agentes: 0,
      vivos: 0,
      ociosos: 0,
      ociosoDesde: null,
      /* Projeto que veio só do backlog não tem agente, então não tem sinal.
         `null` aqui quer dizer "não dá para saber", e não "faz muito tempo". */
      ultimoSinal: null,
      esperando: 0,
      frente: null,
      sessaoNoAr: false,
      conversas: null,
      backlog: r.abertas || 0,
      frentes: r.frentes || 0,
      soSeus: 0,
      horasHoje: null,
      horasTotal: null,
      /* Só o que a outra ponta mandou. Campo derivado de disco fica nulo, e
         nulo aqui quer dizer "não dá para saber daqui", não "é zero". */
      soDoBacklog: true,
      /* ── CC-438: este projeto existe TAMBÉM na outra máquina? ─────────────
       *
       * Pergunta dele em 30/08: *"cadê o PC_cockpit?"*. Ele estava lá, com 38
       * itens de backlog, chamado de `cockpit` — que é o nome de verdade da
       * pasta no PC. A regra dele, de 23/08, manda toda pasta do PC começar com
       * `PC_`; as onze de lá não começam, e o painel mostra o que existe.
       *
       * ⚠️ **Inventar o prefixo na tela seria pior.** O painel passaria a
       * mostrar um nome que não existe em disco nenhum, e um dia ele procura
       * `PC_cockpit` na máquina e não acha.
       *
       * O que resolve a confusão de verdade é dizer o que a regra dele queria
       * evitar: que o mesmo trabalho aparece duas vezes na lista. Dez dos
       * catorze projetos do PC têm um irmão aqui, e a tela pode nomear o par
       * em vez de deixar ele descobrir sozinho. */
      tambemEm: null,
      /* Quando a máquina parou de responder, e há quanto tempo. A tela precisa
         DIZER isso: lista igual à de ontem com a máquina desligada é o mesmo
         defeito das horas congeladas em verde, e ninguém descobre. */
      semContato: Boolean(r.semContato),
      idadeMs: r.idadeMs || 0,
    })
  }

  /* CC-438: o par entre as máquinas, dito nos DOIS cartões. `chaveDeProjeto`
     tira o prefixo de máquina, então `cockpit` do PC casa com `VPS_cockpit`
     daqui, que é exatamente o que a regra de nomes dele queria distinguir.
     ⚠️ O sufixo continua separando: `cockpit--front` é outra árvore de
     trabalho, com outro roadmap, e juntar as duas misturaria backlogs. */
  const porChave = new Map()
  for (const p of saida) {
    const k = chaveDeProjeto(p.projeto)
    if (!k) continue
    if (!porChave.has(k)) porChave.set(k, [])
    porChave.get(k).push(p)
  }
  for (const [, pares] of porChave) {
    if (pares.length < 2) continue
    for (const p of pares) {
      const outros = pares.filter((x) => x !== p)
      p.tambemEm = outros.map((x) => ({
        projeto: x.projeto,
        onde: x.daqui ? 'aqui' : (x.maquinaDeFora || 'outra máquina'),
      }))
    }
  }

  return {
    projetos: saida,
    /* Quantos estão quietos, para a tela poder recolher dizendo quantos são em
       vez de cortar em silêncio. */
    quietos: saida.filter((p) => quieto(p)).length,
    /* CC-365: as duas contagens que as telas novas mostram no cabeçalho. Saem
       daqui e não da tela, pelo mesmo motivo de `ligado`: contar de novo lá é
       criar a segunda verdade. */
    ligados: saida.filter((p) => p.ligado).length,
    total: saida.length,
    /* Contados à parte para a tela poder dizer quantos são, em vez de os
       misturar ou os cortar em silêncio. */
    deFora: saida.filter((p) => !p.daqui).length,
    dePassagem: saida.filter((p) => p.daqui && !p.ehProjeto).length,
    /* `null` viaja até a tela: sem isso ela não consegue distinguir "não há
       conversa" de "ainda não perguntei". */
    leuConversas: Array.isArray(conversas),
  }
}

/**
 * Projeto quieto: **nenhum agente vivo E nada esperando E nenhuma conversa**.
 *
 * A régua está em `docs/produto/CRITERIOS-DE-TELA.md` e foi decidida em 19/08:
 * não é tempo puro. Só o relógio esconderia um projeto que mudou às 3 da manhã
 * por outra máquina, que é exatamente o caso que a federação passou a produzir.
 *
 * CC-365: passou a ser o AVESSO de `ligado`, em vez de repetir a conta com
 * `!==` trocados. Quem chama de fora (com um objeto que não veio de `retrato`)
 * continua atendido pelo segundo ramo, que é a conta antiga, letra por letra.
 */
export const quieto = (p) => ('ligado' in Object(p)
  ? !p.ligado
  : !p.vivos && !p.esperando && !p.conversas && !p.sessaoNoAr)

function maisCitada(lista) {
  if (!lista.length) return null
  const conta = new Map()
  for (const x of lista) conta.set(x, (conta.get(x) || 0) + 1)
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export const nomeDaPasta = (raiz) => path.basename(String(raiz || ''))

const existe = (p) => { try { return fs.existsSync(p) } catch { return false } }
