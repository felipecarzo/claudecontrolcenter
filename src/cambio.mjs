// Cotação do dólar, só pra mostrar o custo de API em real ao lado do valor
// cobrado — comparar $ com R$ na mesma linha não diz nada.
//
// Vem da AwesomeAPI, que não pede chave nem cadastro. É a única chamada de
// rede do painel inteiro: se falhar, vale o último valor gravado, porque
// cotação velha com data na tela é melhor que coluna vazia.

import { readConfig, setCambio } from './config.mjs'

const URL_COTACAO = 'https://economia.awesomeapi.com.br/json/last/USD-BRL'
const VALIDADE_MS = 12 * 60 * 60_000

/**
 * Cotação fora de faixa é erro de formato, não câmbio: se a API inverter o par
 * e devolver 0,18 dólar por real, gravar isso faria a tela mentir com
 * confiança — um custo de R$ 5 mil apareceria como R$ 160.
 */
export const cotacaoPlausivel = (n) => Number.isFinite(n) && n > 0.5 && n < 100

/**
 * Devolve `{brlPorUsd, em, manual}` — possivelmente vazio, se nunca houve
 * cotação e a rede está fora. Nunca lança: câmbio indisponível esconde uma
 * coluna, não pode derrubar a aba de tempo.
 */
export async function garantirCambio() {
  const { cambio = {} } = readConfig()
  if (cambio.manual) return cambio
  if (cambio.brlPorUsd && Date.now() - (cambio.em || 0) < VALIDADE_MS) return cambio

  try {
    const resposta = await fetch(URL_COTACAO, { signal: AbortSignal.timeout(4000) })
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    const bid = Number((await resposta.json())?.USDBRL?.bid)
    if (!cotacaoPlausivel(bid)) throw new Error(`cotação improvável: ${bid}`)
    return setCambio({ brlPorUsd: bid, em: Date.now(), manual: false })
  } catch {
    return cambio
  }
}

export const _internals = { URL_COTACAO, VALIDADE_MS }
