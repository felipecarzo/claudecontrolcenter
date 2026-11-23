/**
 * CC-1124, passo 4: o cartão semanal das tarefas paradas há mais de 30 dias, no Decidir um por um.
 *
 * Um cartão por semana, num baralho que só guarda o da semana (`docs/cartas/parados-da-semana.json`): o da semana
 * anterior sem resposta é trocado pelo novo, então nunca há dois abertos. Respondido, não volta até a segunda
 * seguinte. Quem monta é a varredura da máquina dona do backlog (`arrumarProjeto`); os números se refazem a cada
 * varredura enquanto ele não responde.
 *
 * Cada grupo leva as três partes da regra 10 (docs/produto/ESCRITA.md): de onde vem, o que cada opção muda, o peso.
 * A resposta dele aplica pelo comando do backlog (porNoLugar, mover), uma tarefa por vez, e passa pelas regras. A
 * varredura não desfaz: toda resposta põe o `mexido` em hoje, então são 30 dias até a tarefa contar como parada de novo.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as B from './backlog.mjs'
import * as C from './cartas.mjs'

export const DECK = 'parados-da-semana'
export const OP = {
  backlog: 'Sem lugar: pôr todas no fim do backlog',
  cancelar: 'Sem lugar: cancelar todas',
  agora: 'Agora e fim do dia: pôr todas no fim do backlog',
  manter: 'Manter tudo como está',
  vi: 'Entendi',
}

/** A segunda-feira da semana de `agora`, em dia local `AAAA-MM-DD`. */
export function segundaDe(agora = Date.now()) {
  const d = new Date(agora); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return B.diaLocal(d)
}

/** As paradas (sem micro tarefa) por grupo do cartão. Sprint e backlog não perguntam: a varredura já cuida delas. */
export function grupos(itens, { agora = Date.now() } = {}) {
  const g = { semLugar: [], agora: [], prova: [], decisao: [], fora: [], total: 0, abertas: 0 }
  for (const i of itens) {
    if (i.pai || !B.estaAberto(i)) continue
    g.abertas++
    if (!B.estaParada(i, agora)) continue
    g.total++
    const l = B.lugarDe(i)
    if (i.estado === 'PR') g.prova.push(i)
    else if (i.estado === 'DE') g.decisao.push(i)
    else if (l === 'agora' || l === 'dia') g.agora.push(i)
    else if (l === 'fora') g.fora.push(i)
    else if (!l) g.semLugar.push(i)
  }
  for (const k of ['semLugar', 'agora', 'prova', 'decisao', 'fora']) g[k].sort((a, b) => B.diasDesde(b.mexido, agora) - B.diasDesde(a.mexido, agora))
  return g
}

/** O que a regra dos 30 dias fez sozinha desde a segunda: `{ movidas, canceladas }`. `pendentes` são as do ensaio. */
export function feitasNaSemana(eventos, { agora = Date.now(), pendentes = [] } = {}) {
  const desde = Date.parse(`${segundaDe(agora)}T00:00:00`)
  const daSemana = eventos.filter((e) => e.regra === B.REGRA_TRINTA && Date.parse(e.em) >= desde)
  return {
    movidas: daSemana.filter((e) => e.tipo === 'lugar').length + pendentes.filter((a) => a.lugar).length,
    canceladas: daSemana.filter((e) => e.tipo === 'estado' && e.para === 'KO').length + pendentes.filter((a) => a.para === 'KO').length,
  }
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const maisParada = (lista, agora) => `a mais parada é a ${lista[0].id}, há ${B.diasDesde(lista[0].mexido, agora)} dias`

/** O cartão, sem gravar nada. `null` quando não há o que perguntar nem o que contar. Função pura. */
export function cartaDaSemana(itens, eventos, { agora = Date.now(), pendentes = [], ensaio = false } = {}) {
  const g = grupos(itens, { agora })
  const f = feitasNaSemana(eventos, { agora, pendentes })
  if (!g.total && !f.movidas && !f.canceladas) return null
  const de = (n) => `${n} das ${g.total}`
  const um = f.movidas === 1
  const verbos = ensaio ? (um ? ['iria', 'sairia'] : ['iriam', 'sairiam']) : (um ? ['foi', 'saiu'] : ['foram', 'saíram'])
  const partes = [
    f.movidas && `${f.movidas} ${verbos[0]} para o fim do backlog e ${verbos[1]} do sprint`,
    f.canceladas && `${plural(f.canceladas, ensaio ? 'seria cancelada' : 'foi cancelada', ensaio ? 'seriam canceladas' : 'foram canceladas')} por estar no fim do backlog`,
  ].filter(Boolean)
  const passos = [partes.length
    ? `${ensaio ? 'Em ensaio, nada gravado: a varredura mexeria sozinha' : 'Nesta semana a varredura mexeu sozinha'} em tarefas paradas há mais de 30 dias: ${partes.join(', e ')}. O motivo ${ensaio ? 'iria para o' : 'está no'} histórico de cada uma.`
    : 'Nesta semana a varredura não mexeu sozinha em nenhuma tarefa.']
  if (g.semLugar.length) passos.push(`Sem lugar na fila: ${de(g.semLugar.length)}. De onde vem: nunca ganharam um lugar e ninguém mexe nelas há mais de 30 dias; ${maisParada(g.semLugar, agora)}. `
    + 'Pôr no fim do backlog: saem do sprint e ficam depois de tudo. Peso: um toque no Caminho traz de volta, e se ficarem mais 30 dias paradas lá, são canceladas sozinhas. '
    + 'Cancelar: fecham com o motivo escrito. Peso: o histórico fica, e reabrir é uma por uma.')
  if (g.agora.length) passos.push(`Agora e fim do dia: ${de(g.agora.length)}. De onde vem: você pôs na frente da fila e ninguém mexe há mais de 30 dias; ${maisParada(g.agora, agora)}. Elas nunca mudam sozinhas. `
    + 'Pôr no fim do backlog: deixam de furar a fila. Peso: um toque no Caminho põe de volta, e se ficarem mais 30 dias paradas lá, são canceladas sozinhas.')
  if (g.prova.length) passos.push(`Em prova: ${de(g.prova.length)}. De onde vem: o código existe e falta conferir. Este cartão não muda nada nelas; quem decide é o baralho Provas do backlog, uma por uma.`)
  if (g.decisao.length) passos.push(`Esperando decisão sua: ${de(g.decisao.length)}. Nada muda sozinho; a pergunta de cada uma está no Caminho.`)
  if (g.fora.length) passos.push(`Fora do MVP: ${de(g.fora.length)}. Ficam guardadas e nada muda.`)
  const opcoes = [
    ...(g.semLugar.length ? [OP.backlog, OP.cancelar] : []),
    ...(g.agora.length ? [OP.agora] : []),
  ]
  if (opcoes.length) opcoes.push(OP.manter)
  else opcoes.push(OP.vi)
  return {
    id: `semana-${segundaDe(agora)}`,
    titulo: `${g.total} das ${g.abertas} tarefas abertas estão paradas há mais de 30 dias`,
    pergunta: opcoes.length > 1
      ? 'O que faço com cada grupo? Marque quantas quiser. Manter: as sem lugar e as de agora ficam onde estão e saem deste cartão por 30 dias. O que você não marcar fica como está e volta na semana que vem.'
      : 'Nada aqui pede escolha sua esta semana; o cartão só conta o que aconteceu.',
    passos,
    opcoes,
    ...(opcoes.length > 1 ? { multipla: true } : {}),
  }
}

const arqDoDeck = (raiz) => path.join(raiz, 'docs', 'cartas', DECK + '.json')

/**
 * Monta o cartão da semana e grava o baralho, só quando o conteúdo muda (o arquivo vai pelo git).
 * Semana já respondida: não monta. `ensaio`: devolve sem gravar. Devolve `{ carta, deck }` ou `{ carta: null, respondido? }`.
 */
export function montarCartao(raiz, { agora = Date.now(), ensaio = false, acoes = [] } = {}) {
  const id = `semana-${segundaDe(agora)}`
  if (C.votos(raiz, DECK).some((v) => v.carta === id)) return { carta: null, respondido: true }
  const arq = B.caminhoPadrao(raiz)
  const pendentes = ensaio ? acoes.filter((a) => a.regra === B.REGRA_TRINTA && !a.recusa) : []
  const carta = cartaDaSemana(B.ler(arq).itens, B.lerEventos(arq), { agora, pendentes, ensaio })
  if (!carta) return { carta: null }
  const deck = { titulo: 'Paradas há 30 dias: uma pergunta por semana', criado: `${segundaDe(agora)}T12:00:00.000Z`, cartas: [carta] }
  const erros = C.validarDeck(deck)
  if (erros.length) throw new Error('cartão semanal inválido: ' + erros.join('; '))
  if (!ensaio) {
    const corpo = JSON.stringify(deck, null, 2) + '\n'
    let velho = ''; try { velho = fs.readFileSync(arqDoDeck(raiz), 'utf8') } catch { /* primeira vez */ }
    if (velho !== corpo) { fs.mkdirSync(path.dirname(arqDoDeck(raiz)), { recursive: true }); fs.writeFileSync(arqDoDeck(raiz), corpo) }
  }
  return { carta, deck }
}

/**
 * A resposta dele: grava o voto e aplica, grupo por grupo, pelo comando do backlog. Opções que se contradizem são
 * recusadas antes de gravar o voto. Devolve `{ ok, feitas, recusas }` ou `{ erro }`.
 * Tudo num lote só (`moverEmLote`, a regra do `mover`): uma por vez, 43 tarefas levavam 17 s e a tela desiste em 15.
 */
export function responder(raiz, carta, escolhas, nota = '') {
  const tem = (o) => Array.isArray(escolhas) && escolhas.includes(o)
  if (tem(OP.manter) && escolhas.length > 1) return { erro: `"${OP.manter}" não combina com as outras opções` }
  if (tem(OP.backlog) && tem(OP.cancelar)) return { erro: 'as sem lugar vão para o fim do backlog ou são canceladas, não as duas' }
  const v = C.votar(raiz, DECK, carta, { escolhas, nota })
  if (!v.ok) return v
  const arq = B.caminhoPadrao(raiz)
  const g = grupos(B.ler(arq).itens)
  const dia = B.diaLocal()
  const em = new Date().toISOString()
  const nota_ = nota ? `: ${String(nota).slice(0, 300)}` : ''
  // a regra do porNoLugar: a ideia (B0) que ganha lugar vira definida
  const aoFim = (i) => ({ id: i.id, para: i.estado === 'B0' ? 'B1' : i.estado, extras: { lugar: { onde: 'backlog', em } }, evento: { tipo: 'lugar', de: 'felipe', texto: `fim do backlog, no cartão semanal de ${dia}${nota_}` } })
  const pedidos = [
    ...(tem(OP.backlog) ? g.semLugar.map(aoFim) : []),
    ...(tem(OP.cancelar) ? g.semLugar.map((i) => ({ id: i.id, para: 'KO', extras: { porque: `cancelada por você no cartão semanal de ${dia}: parada há mais de 30 dias, sem lugar${nota_}` } })) : []),
    ...(tem(OP.agora) ? g.agora.map(aoFim) : []),
    // mesmo estado: só o `mexido` vira hoje
    ...(tem(OP.manter) ? [...g.semLugar, ...g.agora].map((i) => ({ id: i.id, para: i.estado, evento: { tipo: 'nota', de: 'felipe', texto: `mantida no cartão semanal de ${dia}${nota_}` } })) : []),
  ]
  return { ok: true, voto: v.voto, ...B.moverEmLote(pedidos, arq) }
}
