/**
 * O histórico de decisões por projeto (CC-582, 27/09). Pedido dele: *"acho que
 * precisamos criar um 'histórico' de decisões por projeto"*, depois de ver
 * cartões sumindo sem saber para onde.
 *
 * Cada decisão que aparece (agente parado esperando ele) entra em `abertas`,
 * pela chave id+marca da fala. Quando ela deixa de aparecer, vai para
 * `fechadas` com o jeito que terminou:
 *  - "respondida pelo painel": ele respondeu por aqui (marcada pelas rotas);
 *  - "fechada por você": o × do cartão;
 *  - "sessão desligada": o programa da sessão foi fechado;
 *  - "seguiu na sessão": o agente andou (ele respondeu no terminal, ou o
 *    agente continuou sozinho).
 * O cartão que saiu da lista pela idade continua aberto: ele ainda espera.
 *
 * Grava só quando algo muda, não a cada leitura de 5 segundos. Mora no abrigo,
 * que o sandbox deixa escrever. Guarda as 2000 últimas fechadas.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

const ARQ = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'decisoes-historico.json')
const MAX_FECHADAS = 2000
const respondidas = new Map() // id do agente -> quando respondeu pelo painel

export function ler(arq = ARQ()) {
  try {
    const o = JSON.parse(fs.readFileSync(arq, 'utf8'))
    return { abertas: o.abertas || {}, fechadas: Array.isArray(o.fechadas) ? o.fechadas : [] }
  } catch { return { abertas: {}, fechadas: [] } }
}

function gravar(estado, arq) {
  try {
    fs.mkdirSync(path.dirname(arq), { recursive: true })
    fs.writeFileSync(`${arq}.tmp`, JSON.stringify({ abertas: estado.abertas, fechadas: estado.fechadas.slice(-MAX_FECHADAS) }))
    fs.renameSync(`${arq}.tmp`, arq)
  } catch { /* histórico é conveniência: falhar aqui não pode derrubar a tela */ }
}

/** As rotas de responder e mandar mensagem avisam aqui. */
export function marcarRespondida(id, agora = Date.now()) { if (id) respondidas.set(id, agora) }

const chave = (e) => `${e.id}::${e.marca || ''}`

/**
 * Compara as decisões de agora com as abertas e grava o que mudou.
 * `dados` é o que `montar` devolve. Devolve o estado, para teste.
 */
export function registrar(dados, { agora = Date.now(), arq = ARQ(), fechadasPorEle = new Set() } = {}) {
  const estado = ler(arq)
  let mudou = false
  const vivas = new Map()
  for (const e of [...(dados.espera || []), ...(dados.ocultas || []).filter((o) => o.oculta !== 'fechada')]) {
    if (e.tipo !== 'agente') continue
    vivas.set(chave(e), e)
  }
  for (const [k, e] of vivas) {
    if (estado.abertas[k]) continue
    estado.abertas[k] = {
      k, id: e.id, projeto: e.projeto, nome: e.nome, dispositivo: e.dispositivo || null, rotulo: e.rotulo,
      texto: e.pergunta || null, opcoes: e.opcoes || [], desde: agora - (e.desdeMs || 0),
    }
    mudou = true
  }
  const sessoes = new Map()
  for (const p of dados.projetos || []) for (const s of p.sessoes || []) sessoes.set(s.id, s.estado)
  for (const [k, r] of Object.entries(estado.abertas)) {
    if (vivas.has(k)) continue
    const estadoSessao = sessoes.get(r.id)
    const fim = fechadasPorEle.has(k) ? 'fechada por você'
      : respondidas.has(r.id) && respondidas.get(r.id) >= r.desde ? 'respondida pelo painel'
      : !estadoSessao || estadoSessao === 'encerrada' ? 'sessão desligada'
      : 'seguiu na sessão'
    estado.fechadas.push({ ...r, fim, ate: agora })
    delete estado.abertas[k]
    mudou = true
  }
  if (mudou) gravar(estado, arq)
  return estado
}

/** Para a tela: abertas e fechadas juntas, a mais recente primeiro, de um
 *  projeto (pela chave) ou de todos. */
export function listar({ projeto = null, limite = 200 } = {}, arq = ARQ()) {
  const { abertas, fechadas } = ler(arq)
  return [...Object.values(abertas).map((r) => ({ ...r, fim: null, ate: null })), ...fechadas]
    .filter((r) => !projeto || r.projeto === projeto)
    .sort((a, b) => (b.ate || b.desde || 0) - (a.ate || a.desde || 0))
    .slice(0, limite)
}
