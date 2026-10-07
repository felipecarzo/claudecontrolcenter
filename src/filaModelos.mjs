/**
 * CC-840 (Nisaba): a fila de modelos, declarada como dado. Uma regra só.
 *
 * Pedido dele em 01/10: "usar o Antigravity, eu já pago de qualquer jeito,
 * tentar sempre os gratuitos, em último caso usar o Haiku". Antes, esgotados
 * os grátis, o Coderoom só esperava ou perguntava; nunca subia um degrau.
 *
 * A ordem é a fila. Cada degrau tem uma chave; a chave que deu limite fica
 * fora por um tempo (o disjuntor, em gateTurno.mjs) e volta sozinha. `teto`
 * é o orçamento: uma tarefa pode dizer até onde a fila pode subir.
 */

/* CC-823: a ordem entre os grátis do opencode. Os de código primeiro (MiMo e
   Nemotron Ultra, pesquisa de 30/09); o Muse Spark por último porque na fase
   gratuita os prompts dele treinam o modelo da Meta. */
export const RESERVA_OPENCODE = [
  'opencode/big-pickle',
  'opencode/mimo-v2.6-flash-free',
  'opencode/nemotron-3-ultra-free',
  'opencode/longcat-2.5-preview-free',
  'opencode/muse-spark-1.3-contributor-free',
]

export const FILA_DE_MODELOS = [
  ...RESERVA_OPENCODE.map((modelo) => ({ agente: 'opencode', modelo, custo: 'grátis' })),
  { agente: 'agy', modelo: null, custo: 'Antigravity, já pago' },
  { agente: 'claude', modelo: 'haiku', custo: 'plano do Claude, último caso' },
]

/** A chave de um degrau. Modelo do opencode é a própria chave (compatível com o que já estava gravado). */
export const chaveDe = (d) => (d.agente === 'opencode' ? d.modelo || RESERVA_OPENCODE[0] : `${d.agente}:${d.modelo || 'padrão'}`)

export const rotuloDe = (d) => (d.agente === 'opencode'
  ? `${String(d.modelo || RESERVA_OPENCODE[0]).replace(/^opencode\//, '').replace(/-free$/, '')} (grátis)`
  : d.agente === 'agy' ? 'o Antigravity (agy, já pago)' : `o Claude ${d.modelo || ''} (último caso)`.replace('  ', ' '))

/**
 * O próximo degrau livre: nem tentado nesta resposta, nem com limite lembrado.
 * `teto` corta a fila no degrau dado (agente ou chave). `null` quando acabou.
 */
export function proximoDegrau({ tentados = [], limitados = new Map(), agora = Date.now(), teto = null } = {}) {
  let fila = FILA_DE_MODELOS
  if (teto) {
    const ate = fila.findIndex((d) => d.agente === teto || chaveDe(d) === teto)
    if (ate >= 0) fila = fila.slice(0, ate + 1)
  }
  return fila.find((d) => !tentados.includes(chaveDe(d)) && !((limitados.get(chaveDe(d)) || 0) > agora)) || null
}
