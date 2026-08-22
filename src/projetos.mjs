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
} = {}) {
  const lista = projetosDe(jobs, achar)

  /* Agentes vivos por projeto. `done` fica de fora porque o CLI marca `done` ao
     fim de CADA turno, e um agente entregue não é trabalho em andamento: é a
     armadilha registrada que já pôs agente trabalhando na faixa de "prontos". */
  const agentesPor = new Map()
  for (const j of jobs) {
    if (!j.project) continue
    if (!agentesPor.has(j.project)) agentesPor.set(j.project, [])
    agentesPor.get(j.project).push(j)
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
    const vivos = meus.filter((j) => j.status && j.status !== 'done')
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

    return {
      projeto,
      raiz,
      daqui,
      /* Pasta que existe aqui mas não é projeto (sem `.git` e sem `CLAUDE.md`)
         é lugar de passagem, não trabalho: scratchpad, pasta temporária. */
      ehProjeto: daqui && (existe(path.join(raiz, '.git')) || existe(path.join(raiz, 'CLAUDE.md'))),
      agentes: meus.length,
      vivos: vivos.length,
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

  return {
    projetos: saida,
    /* Quantos estão quietos, para a tela poder recolher dizendo quantos são em
       vez de cortar em silêncio. */
    quietos: saida.filter((p) => quieto(p)).length,
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
 */
export const quieto = (p) => !p.vivos && !p.esperando && !p.conversas && !p.sessaoNoAr

function maisCitada(lista) {
  if (!lista.length) return null
  const conta = new Map()
  for (const x of lista) conta.set(x, (conta.get(x) || 0) + 1)
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export const nomeDaPasta = (raiz) => path.basename(String(raiz || ''))

const existe = (p) => { try { return fs.existsSync(p) } catch { return false } }
