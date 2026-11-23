/**
 * CC-1124, passo 6: o aviso único de sprint que não cabe, no Decidir um por um.
 *
 * Na primeira varredura da semana (a máquina dona do backlog, de 10 em 10 minutos), o sprint atual é comparado com o
 * ritmo das últimas 4 semanas. Passou do ritmo: uma carta no baralho `docs/cartas/sprint-que-nao-cabe.json`, com as três
 * partes da regra 10 (docs/produto/ESCRITA.md). Cabe: nada. Em qualquer dos dois casos a semana fica marcada como vista
 * em `aviso-de-sprint.json`, ao lado da configuração (respeita CC_HOME): o aviso não se repete no mesmo sprint, nem sem
 * resposta. Sprint novo é janela nova, e a conta é feita de novo.
 *
 * A resposta "passar" grava uma linha `tirar` no diário do sprint (docs/sprints.jsonl, por acréscimo) e põe uma linha no
 * histórico de cada tarefa pelo comando do backlog (moverEmLote, mesmo estado). Desliga: "avisoDeSprint": false.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as B from './backlog.mjs'
import * as C from './cartas.mjs'
import * as S from './sprint.mjs'
import { casaClaude } from './platform.mjs'
import { readUso } from './uso.mjs'
import { readConfig } from './config.mjs'

export const DECK = 'sprint-que-nao-cabe'
export const OP = {
  passar: 'Passar o que não cabe para o próximo sprint',
  manter: 'Manter tudo e aceitar o atraso',
}
// ponytail: sem abrigo para o sandbox da VPS; só a dona grava, e a dona é o PC. Falha de gravação sai em voz alta.
export const arquivoDeEstado = () => path.join(casaClaude(), 'aviso-de-sprint.json')
const n1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',')
const ancoraDe = (a) => (a === undefined ? (readUso()?.semana?.resetaEm ?? null) : a)
const limpo = (t, n) => { const s = String(t || '').replace(/[—–]/g, ',').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s }

/** O que fica e o que sai, na ordem da fila. Andando sempre fica; da primeira que não cabe em diante, tudo sai. Função pura. */
export function dividir(abertos, porSemana) {
  const fica = abertos.filter((i) => i.estado === 'EM')
  let soma = fica.reduce((s, i) => s + i.pontos, 0)
  const sai = []
  for (const i of abertos) {
    if (i.estado === 'EM') continue
    if (!sai.length && soma + i.pontos <= porSemana) { fica.push(i); soma += i.pontos } else sai.push(i)
  }
  return { fica, sai, pontosQueFicam: soma }
}

/** A frase da escala: quanto do sprint cabe no ritmo. */
export function escala(pontos, porSemana) {
  if (porSemana <= 0) return 'Não cabe nada. Nas últimas semanas nada fechou, então não dá para dizer quando ele termina.'
  const f = porSemana / pontos
  const frase = f < 0.15 ? 'Cabe quase nada.' : f < 0.5 ? 'Cabe menos da metade.' : 'Cabe a maior parte, não tudo.'
  return `${frase} No ritmo de agora, ele leva umas ${Math.ceil(pontos / porSemana)} semanas para fechar.`
}

const idDe = (trecho) => `sprint-${trecho.sprint.n}-${trecho.comeco}`

/** A carta, sem gravar nada. `null` quando o sprint cabe no ritmo. Função pura. */
export function cartaDoSprint(trecho, ritmo) {
  const abertos = trecho?.abertosNaOrdem || []
  const pontos = abertos.reduce((s, i) => s + i.pontos, 0)
  if (!abertos.length || pontos <= ritmo.porSemana) return null
  const n = trecho.sprint.n
  const { fica, sai, pontosQueFicam } = dividir(abertos, ritmo.porSemana)
  const prova = abertos.filter((i) => i.estado === 'PR').length
  const agora = abertos.filter((i) => ['agora', 'dia'].includes(i.lugar)).length
  const marcadasQueSaem = sai.filter((i) => ['agora', 'dia', 'sprint'].includes(i.lugar)).length
  const tarefas = (k) => `${k} ${k === 1 ? 'tarefa' : 'tarefas'}`
  const passos = [
    `De onde vem: ${tarefas(abertos.length)} abertas estão no sprint ${n}. Os pontos somam o tamanho de cada uma (P vale 1, M vale 3, G vale 8), e o ritmo conta o que fechou nas últimas ${ritmo.semanas} semanas, as semanas paradas inclusive.`
      + (prova ? ` ${prova} delas estão em prova: o código existe e falta você conferir.` : '')
      + (agora ? ` ${agora} estão marcadas como agora ou fim do dia.` : ''),
    `${OP.passar}: ficam ${tarefas(fica.length)} (${n1(pontosQueFicam)} ${pontosQueFicam === 1 ? 'ponto' : 'pontos'}) e saem ${sai.length}, na ordem da fila. Tarefa andando nunca sai. `
      + 'Peso: nada é apagado, e cada uma ganha uma linha no histórico dizendo que saiu por este aviso. '
      + (marcadasQueSaem ? `As ${marcadasQueSaem} marcadas como agora, fim do dia ou fim do sprint voltam todas no sprint ${n + 1}, porque a marca continua${marcadasQueSaem < sai.length ? '; as outras entram nos próximos sprints na vez delas' : ''}.` : 'Elas entram nos próximos sprints na vez delas.'),
    `${OP.manter}: nada muda. Peso: o sprint ${n} termina com quase tudo ainda aberto, e o que sobrar segue na fila do Caminho.`,
    `O que não cabe, na ordem da fila: ${sai.slice(0, 6).map((i) => `${i.id} (${limpo(i.titulo, 45)})`).join('; ')}${sai.length > 6 ? `; e mais ${sai.length - 6}, no Caminho` : ''}.`,
  ]
  return {
    id: idDe(trecho),
    titulo: `O sprint ${n} tem ${n1(pontos)} pontos e nas últimas ${ritmo.semanas} semanas vocês fecharam ${n1(ritmo.total)}, uns ${n1(ritmo.porSemana)} por semana`,
    pergunta: `${escala(pontos, ritmo.porSemana)} O que você quer fazer com o resto? Sem resposta, nada muda e este aviso não volta neste sprint.`,
    passos,
    opcoes: [OP.passar, OP.manter],
  }
}

function lerEstado() { try { return JSON.parse(fs.readFileSync(arquivoDeEstado(), 'utf8')) } catch { return {} } }

/**
 * Na primeira leitura da semana, monta o aviso e grava o baralho; nas outras, não faz nada.
 * Devolve `{ carta }`, `{ carta: null }` (cabe) ou `{ pulado }` (desligado, nao-dono, ja-visto, sem-backlog), ou `{ erro }`.
 */
export function emitir(raiz, { cfg = readConfig(), agora = Date.now(), ancora, caminhoFn = S.caminhoPorSprint } = {}) {
  if (cfg.avisoDeSprint === false) return { pulado: 'desligado' }
  if (!B.ehDonoDoBacklog(cfg)) return { pulado: 'nao-dono' }
  const anc = ancoraDe(ancora)
  const cur = S.janelaDe(agora, anc)
  const chave = path.resolve(raiz)
  const est = lerEstado()
  if (est[chave]?.de === cur.de) return { pulado: 'ja-visto' }
  const c = caminhoFn(raiz, agora, { gravar: false, ancora: anc })
  if (!c?.ok) return { pulado: 'sem-backlog' }
  const t = c.trechos[c.atual]
  const carta = cartaDoSprint(t, c.capacidade.ritmo)
  est[chave] = { de: cur.de, sprint: t?.sprint?.n ?? null, em: new Date(agora).toISOString(), aviso: carta ? carta.id : null }
  // o estado vai antes do baralho: sem ele gravado, o aviso voltaria a cada varredura
  try { fs.mkdirSync(path.dirname(arquivoDeEstado()), { recursive: true }); fs.writeFileSync(arquivoDeEstado(), JSON.stringify(est, null, 2) + '\n') } catch (e) {
    console.error(`[aviso de sprint] não consegui gravar ${arquivoDeEstado()}: ${e.message}`)
    return { erro: e.message }
  }
  if (!carta) return { carta: null }
  const deck = { titulo: 'Sprint que não cabe no ritmo: um aviso por sprint', criado: new Date(agora).toISOString(), cartas: [carta] }
  const erros = C.validarDeck(deck)
  if (erros.length) throw new Error('aviso de sprint inválido: ' + erros.join('; '))
  const arq = path.join(raiz, 'docs', 'cartas', DECK + '.json')
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq, JSON.stringify(deck, null, 2) + '\n')
  return { carta }
}

/** A resposta dele: grava o voto e, em "passar", tira do sprint o que não cabe. Sprint que já mudou: só o voto. */
export function responder(raiz, cartaId, escolhas, nota = '', { agora = Date.now(), ancora, caminhoFn = S.caminhoPorSprint } = {}) {
  const v = C.votar(raiz, DECK, cartaId, { escolhas, nota })
  if (!v.ok) return v
  if (!escolhas.includes(OP.passar)) return { ok: true, voto: v.voto, feitas: 0, recusas: [] }
  const anc = ancoraDe(ancora)
  const c = caminhoFn(raiz, agora, { gravar: false, ancora: anc })
  const t = c?.ok && c.trechos[c.atual]
  if (!t || idDe(t) !== cartaId) return { ok: true, voto: v.voto, feitas: 0, recusas: ['o sprint já mudou: nada foi tirado'] }
  const { sai } = dividir(t.abertosNaOrdem, c.capacidade.ritmo.porSemana)
  const dia = B.diaLocal(new Date(agora))
  const texto = `saiu do sprint ${t.sprint.n} para os próximos, no aviso de sprint que não cabe de ${dia}${nota ? `: ${String(nota).slice(0, 300)}` : ''}`
  S.tirarDoSprint(raiz, S.janelaDe(agora, anc), sai.map((i) => i.id), { agora, porque: 'aviso de sprint que não cabe' })
  const r = B.moverEmLote(sai.map((i) => ({ id: i.id, para: i.estado, evento: { tipo: 'nota', de: 'felipe', texto } })), B.caminhoPadrao(raiz))
  return { ok: true, voto: v.voto, tiradas: sai.length, ...r }
}
