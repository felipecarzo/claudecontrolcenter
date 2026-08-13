// "Onde eu mexo agora?" — a pergunta que o painel não respondia.
//
// O Felipe toca 4-5 projetos em paralelo e se perde. O contexto dele é grande
// e vago; o poder dele é decisão e abstração, não acompanhar cada linha que o
// agente escreve. A aba de projetos mostrava tokens e rotas — informação que
// não decide nada. Aqui o projeto é ordenado por URGÊNCIA, e o topo da lista é
// onde ele deve mexer.
//
// Duas regras de desenho que vêm de erro passado:
//
//   1. O peso NUNCA aparece na tela. O que aparece é a frase ("travado: falta
//      credencial da VPS"). Número sem explicação é o tipo de burocracia que se
//      desliga na terceira semana — e ele não teria como discordar de um "87".
//
//   2. Só dado que já está no snapshot de 2s. Nada de `tempo.mjs` (800 MB) nem
//      de spawn. Última atividade sai de `updatedAt` dos jobs: de graça, e mais
//      fresco que o cache do tempo, que só atualiza quando a aba tempo abre.
//
// Módulo separado do `ui.html` por um motivo prático: `npm test` é o único gate
// do projeto, e lógica dentro do HTML não é testável.

/**
 * A razão nº 1 de olhar pra este agente, com peso pra ordenar e frase pra
 * mostrar. Primeira que casa vence — a ordem da lista É a regra de negócio.
 *
 * `blockers` ganha de tudo porque é a única em que o agente ESCREVEU o que
 * trava; o resto é inferência do painel.
 */
export function motivoDe(job, agora = Date.now()) {
  const idle = Number.isFinite(job.idleMs) ? job.idleMs : (agora - (job.updatedAt || agora))

  if (job.blockers?.length) return { peso: 5, tipo: 'travado', frase: `travado: ${job.blockers[0]}`, desde: idle }
  if (job.status === 'failed') return { peso: 4, tipo: 'failed', frase: 'falhou', desde: idle }
  // `stale` já é "diz que trabalha e não dá sinal há 10min" — provavelmente travou.
  if (job.stale) return { peso: 4, tipo: 'stale', frase: 'sem sinal', desde: idle }
  if (job.status === 'waiting') return { peso: 3, tipo: 'waiting', frase: 'esperando você', desde: idle }
  if (job.entregueEmAberto) return { peso: 2, tipo: 'aberto', frase: 'entregou com tudo em aberto', desde: idle }
  if (job.status === 'working') return { peso: 1, tipo: 'working', frase: 'trabalhando', desde: idle }
  return { peso: 0, tipo: 'parado', frase: 'parado', desde: idle }
}

/**
 * A mesma precedência de "o que mostrar sobre este agente" do cartão da aba de
 * agentes (`cartao()` no ui.html). Existe aqui para as duas telas nunca
 * divergirem — foi o CC-17: a nota mostrava o pedido do Felipe por cima do
 * status que o agente escreveu, e ele não reconhecia o texto.
 */
export function notaDe(job) {
  if (job.stale) return { tipo: 'stale', texto: 'sem sinal' }
  if (job.blockers?.length) return { tipo: 'bloqueio', texto: job.blockers[0] }
  if (job.inFlight?.length) return { tipo: 'ferramenta', texto: job.inFlight[0].label }
  if (job.detail) return { tipo: 'status', texto: job.detail }
  if (job.lastPrompt) return { tipo: 'pedido', texto: job.lastPrompt }
  return null
}

/**
 * Agrupa por projeto e ordena por urgência. O peso do projeto é o do seu agente
 * mais urgente; empate desempata pelo que está assim há mais tempo — o que
 * apodrece primeiro sobe.
 *
 * Projeto sem agente nenhum entra com peso 0 em vez de sumir: "esse projeto
 * está parado há 3 dias" é resposta legítima pra "onde eu mexo agora".
 */
export function porProjeto(jobs, { agora = Date.now() } = {}) {
  const grupos = new Map()
  for (const j of jobs) {
    if (!grupos.has(j.project)) grupos.set(j.project, [])
    grupos.get(j.project).push(j)
  }

  const projetos = [...grupos].map(([projeto, lista]) => {
    const comMotivo = lista.map((j) => ({ job: j, motivo: motivoDe(j, agora) }))
    // o mais urgente primeiro; entre iguais, o mais esquecido
    comMotivo.sort((a, b) => b.motivo.peso - a.motivo.peso || b.motivo.desde - a.motivo.desde)
    const topo = comMotivo[0]

    const porStatus = {}
    for (const j of lista) porStatus[j.status] = (porStatus[j.status] || 0) + 1

    return {
      projeto,
      peso: topo?.motivo.peso ?? 0,
      motivo: topo?.motivo ?? { peso: 0, tipo: 'parado', frase: 'sem agente', desde: 0 },
      // quem espera decisão dele: é o que o cockpit existe pra despachar
      esperando: comMotivo
        .filter(({ motivo }) => motivo.peso >= 3)
        .map(({ job, motivo }) => ({
          id: job.id, subject: job.subject, frente: job.frente || null,
          motivo: motivo.frase, tipo: motivo.tipo, idleMs: motivo.desde, nota: notaDe(job),
        })),
      agentes: lista.length,
      porStatus,
      // "faz quanto tempo que não olho pra isso", de graça
      ultimaAtividade: lista.reduce((max, j) => Math.max(max, j.updatedAt || 0), 0),
      tokens: lista.reduce((a, j) => a + (j.tokens || 0), 0),
      abertos: lista.filter((j) => j.todos?.some((t) => !t.done)).length,
      jobs: comMotivo.map(({ job, motivo }) => ({
        id: job.id, subject: job.subject, status: job.status, route: job.route,
        frente: job.frente || null, motivo: motivo.frase, tipo: motivo.tipo,
        idleMs: motivo.desde, todos: job.todos?.length || 0, todosDone: job.todosDone || 0,
      })),
    }
  })

  projetos.sort((a, b) => b.peso - a.peso || b.motivo.desde - a.motivo.desde)
  return projetos
}
