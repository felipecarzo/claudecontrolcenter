// O que está tocando na máquina, e os controles.
//
// Toda a conversa com o sistema fica em platform.mjs — aqui só se normaliza o
// que volta e se guarda um cache curto, porque cada consulta custa ~500ms e a
// barra do player pergunta a cada poucos segundos.
//
// Duas coisas que o Windows separa e a tela junta: SMTC dá o transporte
// (play/pause/faixa) e WASAPI dá o volume por aplicativo. Quando os dois não
// casam pelo nome do processo, a sessão aparece sem controle de volume — o
// transporte continua funcionando.

import { midiaComando, midiaDisponivel } from './platform.mjs'

const VALIDADE_MS = 2500

let cache = { em: 0, dados: null }
let emVoo = null

const nomeBonito = (app) => {
  if (!app) return 'mídia'
  // AUMID da Store: 5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App → WhatsAppDesktop
  let s = String(app).split('!')[0].split('_')[0]
  if (s.includes('.')) {
    const partes = s.split('.').filter(Boolean)
    s = partes[partes.length - 1] === 'exe' ? partes[partes.length - 2] : partes[partes.length - 1]
  }
  return s.replace(/\.exe$/i, '') || String(app)
}

function normalizar(bruto) {
  let j
  try { j = JSON.parse(bruto) } catch { return { erro: 'resposta ilegível do controlador de mídia' } }
  if (j.erro) return { erro: String(j.erro) }

  // O PowerShell serializa objeto único fora de array quando só há um.
  const lista = Array.isArray(j.sessoes) ? j.sessoes : j.sessoes ? [j.sessoes] : []
  const sessoes = lista.map((s) => ({
    indice: Number(s.indice) || 0,
    app: nomeBonito(s.app),
    appId: s.app || '',
    titulo: (s.titulo || '').trim(),
    artista: (s.artista || '').trim(),
    tocando: s.estado === 'Playing',
    estado: s.estado || '',
    podePlay: !!s.podePlay,
    podePausa: !!s.podePausa,
    podeProximo: !!s.podeProximo,
    podeAnterior: !!s.podeAnterior,
    pid: Number(s.pid) || null,
    volume: s.volume == null ? null : Number(s.volume),
    mudo: !!s.mudo,
  }))
  // Escolher "o que está tocando" não basta: o WhatsApp registra sessão de
  // mídia e apareceu na frente do YouTube só por vir primeiro na lista. Vale
  // mais quem tem som saindo de verdade e controles de faixa habilitados.
  const peso = (s) => (s.tocando ? 8 : 0)
    + (s.pid ? 4 : 0)
    + (s.podeProximo || s.podeAnterior ? 2 : 0)
    + (s.artista ? 1 : 0)
  sessoes.sort((a, b) => peso(b) - peso(a))
  return { sessoes, em: Date.now() }
}

/** Estado atual, com cache curto. Chamadas simultâneas dividem a mesma ida. */
export async function estado({ force = false } = {}) {
  if (!midiaDisponivel()) return { indisponivel: true, sessoes: [] }
  if (!force && cache.dados && Date.now() - cache.em < VALIDADE_MS) return cache.dados
  if (emVoo) return emVoo

  emVoo = midiaComando('estado').then((bruto) => {
    const dados = normalizar(bruto)
    cache = { em: Date.now(), dados }
    emVoo = null
    return dados
  })
  return emVoo
}

const ACOES = new Set(['play', 'pause', 'toggle', 'next', 'prev'])

export async function acao(indice, qual) {
  if (!midiaDisponivel()) throw new Error('controle de mídia só existe no Windows por enquanto')
  if (!ACOES.has(qual)) throw new Error(`ação inválida: ${qual}`)
  const i = Number(indice)
  if (!Number.isInteger(i) || i < 0) throw new Error('sessão inválida')
  const r = JSON.parse(await midiaComando('acao', String(i), qual))
  if (r.erro) throw new Error(r.erro)
  cache = { em: 0, dados: null } // o estado mudou: a próxima leitura é fresca
  return r
}

export async function volume(pid, nivel) {
  if (!midiaDisponivel()) throw new Error('controle de mídia só existe no Windows por enquanto')
  const p = Number(pid)
  const v = Math.max(0, Math.min(100, Math.round(Number(nivel))))
  if (!Number.isInteger(p) || p <= 0) throw new Error('processo inválido')
  if (!Number.isFinite(v)) throw new Error('volume inválido')
  const r = JSON.parse(await midiaComando('volume', String(p), String(v)))
  if (r.erro) throw new Error(r.erro)
  cache = { em: 0, dados: null }
  return r
}

export async function mudo(pid, valor) {
  if (!midiaDisponivel()) throw new Error('controle de mídia só existe no Windows por enquanto')
  const p = Number(pid)
  if (!Number.isInteger(p) || p <= 0) throw new Error('processo inválido')
  const r = JSON.parse(await midiaComando('mudo', String(p), valor ? 'true' : 'false'))
  if (r.erro) throw new Error(r.erro)
  cache = { em: 0, dados: null }
  return r
}

export const _internals = { nomeBonito, normalizar }
