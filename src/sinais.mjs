// CC-41: os padrões medidos em docs/produto/CICLO.md, virando sinal que o
// painel enxerga sozinho. Três limiares, e eles são DECISÃO, não chute a
// recalibrar até "parecer certo" — saíram da análise de 235 mensagens reais.
//
// Pura lógica, sem I/O: recebe as mensagens já lidas (por
// `transcript.humanMessagesTail`) e devolve o que encontrou. Testável sem
// tocar disco, mesmo motivo de cockpit.mjs receber `jobs` como parâmetro.

const JANELA_RAJADA_MS = 6 * 60 * 1000
const MIN_RAJADA = 3
const JANELA_SILENCIO_MS = 10 * 60 * 1000
// Reenvio em menos de 5min substitui a mensagem anterior, não soma — regra
// medida do ciclo. Sem isso, ele reescrevendo rápido a própria mensagem
// contaria como duas intenções em vez de uma.
const JANELA_SUBSTITUICAO_MS = 5 * 60 * 1000

const normaliza = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Palavras de 4+ letras, sem repetição — é o que decide sobreposição, não pontuação. */
const palavrasSignificativas = (s) => new Set(normaliza(s).split(/[^a-z0-9çãõáéíóúâêô]+/i).filter((w) => w.length >= 4))

/** Fração de sobreposição entre dois conjuntos de palavras, 0 a 1. */
function sobreposicao(a, b) {
  if (!a.size || !b.size) return 0
  let comuns = 0
  for (const w of a) if (b.has(w)) comuns++
  return comuns / Math.min(a.size, b.size)
}

// Reenvio de verdade tem a MESMA ideia por trás — "sempre maior e mais
// precisa", nunca um assunto novo. Sem exigir sobreposição de conteúdo, o
// colapso comeria uma rajada de 3 mensagens curtas e DIFERENTES em menos de
// 5min, tratando burst genuíno como se fosse a mesma frase sendo reescrita —
// achado pelo próprio teste deste módulo.
const LIMIAR_MESMA_IDEIA = 0.5

/**
 * Colapsa reenvios rápidos (< 5min, mesma ideia) num só, ficando com a
 * versão mais recente — ela substitui a anterior, não soma.
 */
function colapsarReenvios(mensagens) {
  const out = []
  for (const m of mensagens) {
    const anterior = out[out.length - 1]
    const mesmaIdeia = anterior
      && sobreposicao(palavrasSignificativas(m.texto), palavrasSignificativas(anterior.texto)) >= LIMIAR_MESMA_IDEIA
    if (anterior && mesmaIdeia && m.em - anterior.em < JANELA_SUBSTITUICAO_MS) {
      out[out.length - 1] = m // a nova substitui, mesmo índice
    } else {
      out.push(m)
    }
  }
  return out
}

/**
 * Os sinais de um projeto, a partir das mensagens humanas recentes (já
 * ordenadas do mais antigo pro mais novo). `agora` é injetável pro teste.
 */
export function sinaisDe(mensagens, { agora = Date.now() } = {}) {
  const colapsadas = colapsarReenvios(mensagens)
  if (!colapsadas.length) return { rajada: false, repeticao: false, silencio: false }

  // Rajada: MIN_RAJADA+ mensagens (já sem reenvio) dentro da janela.
  const naJanela = colapsadas.filter((m) => agora - m.em <= JANELA_RAJADA_MS)
  const rajada = naJanela.length >= MIN_RAJADA

  // Repetição: a última mensagem tem sobreposição alta com alguma anterior
  // (não a imediatamente anterior — ele pode repetir depois de tentar outra
  // coisa). Prefere errar pra menos: limiar alto, senão o aviso "repetiu o
  // pedido" dispara à toa e ele aprende a ignorar.
  const ultima = colapsadas[colapsadas.length - 1]
  const palavrasUltima = palavrasSignificativas(ultima.texto)
  let repeticao = false
  for (let i = colapsadas.length - 2; i >= 0; i--) {
    if (sobreposicao(palavrasUltima, palavrasSignificativas(colapsadas[i].texto)) >= 0.6) {
      repeticao = true
      break
    }
  }

  const silencio = agora - ultima.em > JANELA_SILENCIO_MS

  return { rajada, repeticao, silencio, ultimaEm: ultima.em, naJanela: naJanela.length }
}

export const _internals = { normaliza, palavrasSignificativas, sobreposicao, colapsarReenvios }
