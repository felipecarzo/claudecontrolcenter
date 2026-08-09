// Quanto o mercado cobra pela hora de um desenvolvedor, por senioridade.
//
// O Felipe pediu que fosse buscado na web, sabendo do risco: página muda de
// layout e o raspador para de achar o número. Por isso são duas fontes
// independentes, e três camadas de queda — se a primeira falha tenta a
// segunda, se as duas falham vale o último valor buscado, e se nunca houve
// nenhum vale a tabela escrita aqui. A tela sempre diz de onde veio e quando.
//
// Nenhuma dessas faixas é lei: são referência de freelance no Brasil, que
// varia por cidade, stack e cliente. O valor final é escolha de quem cobra.

import { readConfig, setMercado } from './config.mjs'

const VALIDADE_MS = 7 * 24 * 60 * 60_000

/**
 * Cada fonte devolve seis números: mínimo e máximo de júnior, pleno e sênior.
 * O padrão é escrito contra o texto da página SEM as tags, com espaços já
 * colapsados — é assim que `limpar()` entrega.
 */
const FONTES = [
  {
    nome: 'facturapdf',
    url: 'https://facturapdf.app/pt/blog/quanto-cobrar-hora-freelancer-brasil/',
    // "Desenvolvedor web/app R$ 60–90/h R$ 100–180/h R$ 200–400/h"
    padrao: /Desenvolvedor web\/app\s*R\$\s*(\d+)\s*[–-]\s*(\d+)\s*\/h\s*R\$\s*(\d+)\s*[–-]\s*(\d+)\s*\/h\s*R\$\s*(\d+)\s*[–-]\s*(\d+)\s*\/h/i,
  },
  {
    nome: 'geracontratos',
    url: 'https://geracontratos.com.br/recursos/tabela-valores-servicos-profissionais',
    // "Desenvolvedor Full Stack: R$ 70-120 / R$ 120-200 / R$ 200-400"
    padrao: /Desenvolvedor Full Stack:\s*R\$\s*(\d+)\s*[–-]\s*(\d+)\s*\/\s*R\$\s*(\d+)\s*[–-]\s*(\d+)\s*\/\s*R\$\s*(\d+)\s*[–-]\s*(\d+)/i,
  },
]

/** Última rede: os números que as duas fontes traziam em 08/08/2026. */
export const TABELA_BASE = {
  junior: { min: 60, max: 90 },
  pleno: { min: 100, max: 180 },
  senior: { min: 200, max: 400 },
  fonte: 'tabela de referência de 2026-08-08',
  em: Date.parse('2026-08-08T00:00:00Z'),
}

const limpar = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')

/**
 * Faixa só vale se os números fizerem sentido entre si. Uma página que troque
 * a ordem das colunas passaria no regex e entregaria sênior mais barato que
 * júnior — o que viraria proposta errada sem nenhum erro na tela.
 */
export function faixasPlausiveis(n) {
  const [jMin, jMax, pMin, pMax, sMin, sMax] = n
  if (n.some((v) => !Number.isFinite(v) || v < 10 || v > 2000)) return false
  if (jMin > jMax || pMin > pMax || sMin > sMax) return false
  return jMax <= pMax && pMax <= sMax
}

export function extrair(texto, fonte) {
  const m = fonte.padrao.exec(texto)
  if (!m) return null
  const n = m.slice(1, 7).map(Number)
  if (!faixasPlausiveis(n)) return null
  return {
    junior: { min: n[0], max: n[1] },
    pleno: { min: n[2], max: n[3] },
    senior: { min: n[4], max: n[5] },
    fonte: fonte.nome,
    em: Date.now(),
  }
}

/**
 * Devolve as faixas, buscando na web quando o cache passou de uma semana.
 * Nunca lança: preço de mercado indisponível vira número velho com data, não
 * uma aba quebrada.
 */
export async function garantirMercado({ force = false } = {}) {
  const guardado = readConfig().mercado || {}
  if (guardado.manual) return guardado
  if (!force && guardado.em && Date.now() - guardado.em < VALIDADE_MS) return guardado

  for (const fonte of FONTES) {
    try {
      const resposta = await fetch(fonte.url, {
        signal: AbortSignal.timeout(8000),
        // Sem isto algumas hospedagens devolvem 403 para cliente sem navegador.
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; control-center)' },
      })
      if (!resposta.ok) continue
      const achado = extrair(limpar(await resposta.text()), fonte)
      if (achado) return setMercado(achado)
    } catch {
      // rede fora, tempo esgotado ou HTML inesperado: tenta a próxima
    }
  }
  return guardado.em ? guardado : setMercado(TABELA_BASE)
}

/** O meio da faixa é o que vira preço; a faixa inteira aparece ao lado. */
export const meioDa = (faixa) => (faixa ? (faixa.min + faixa.max) / 2 : 0)

export const _internals = { FONTES, limpar, VALIDADE_MS }
