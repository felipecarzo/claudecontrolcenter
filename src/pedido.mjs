/**
 * O que ELE pediu, lido do transcrito.
 *
 * Existia copiado dentro do `commit-guard`; virou módulo em 17/08 porque as
 * travas de fidelidade ao pedido precisam da mesma leitura, e duas cópias
 * divergiriam no primeiro conserto.
 *
 * ⚠️ Nem toda mensagem `user` foi escrita por uma pessoa: injeção de skill vem
 * com `isMeta`, saída de ferramenta com `toolUseResult`, e feedback de hook
 * entra como texto que começa com `<`. Sem esse filtro, o "pedido" viria a ser o
 * texto de uma skill, que já aconteceu no painel.
 */
import { readFileSync } from 'node:fs'

/** A última coisa que uma PESSOA escreveu no turno. */
export function ultimoPedido(arquivo, limite = 200_000) {
  let texto = null
  try { texto = readFileSync(arquivo, 'utf8').slice(-limite) } catch { return null }
  const linhas = texto.split('\n')
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    let l = null
    try { l = JSON.parse(linhas[i]) } catch { continue }
    if (l?.type !== 'user' || l?.isMeta || l?.toolUseResult) continue
    const c = l?.message?.content
    const t = typeof c === 'string'
      ? c
      : Array.isArray(c) ? c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n') : ''
    if (t && !t.startsWith('<')) return t
  }
  return null
}

/* Palavras que aparecem em qualquer frase e não identificam nada. Sem esta
   lista, "para" e "coisa" entrariam como termo do pedido e a trava barraria
   qualquer comentário. */
const COMUNS = new Set(('para pela pelo pelos pelas isso essa esse esses essas isto este esta aquele aquela '
  + 'coisa coisas jeito forma modo agora depois antes ainda também tambem talvez porque porquê porque '
  + 'quando onde como quer quero queria pode podemos vamos fazer faz feito fica ficar sendo tudo todo '
  + 'toda todos todas outro outra outros outras mesmo mesma muito muita pouco pouca nada alguma algum '
  + 'sobre entre desde ate até você voce vocês eles elas nossa nosso meus minhas seus suas dele dela '
  + 'aqui ali lado dois duas três tres primeiro segundo tipo tipos exemplo favor deus amor kkkk '
  + 'preciso precisa precisamos gente pessoa cara conta caso vez vezes dias dia hoje ontem amanha '
  + 'amanhã tempo hora minuto sempre nunca cada qual quais quem '
  /* Advérbios e comparativos entraram depois do primeiro falso positivo, em
     17/08: "mais" veio de uma mensagem dele ("mais controle") e casou com
     "fica mais limpo" num comentário qualquer, barrando escrita legítima.
     Palavra que aparece em toda frase não identifica pedido nenhum. */
  + 'mais menos muito pouco bem melhor pior legal otimo ótimo ruim horrivel horrível '
  + 'certo errado igual identico idêntico assim ainda apenas somente inclusive '
  + 'realmente exatamente provavelmente talvez claro simples facil fácil dificil difícil').split(/\s+/))

const semAcento = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Os termos que identificam o pedido: palavras de conteúdo, sem as comuns.
 *
 * Serve para cruzar com o que eu escrevo: se estou justificando uma escolha
 * contra um termo do pedido, a decisão é dele, não minha. Foi assim que
 * "tabela" apareceu ao lado de "seria pior" dentro de um comentário de CSS em
 * 17/08, e ele só descobriu abrindo o painel.
 */
export function termosDoPedido(texto, { min = 4, max = 24 } = {}) {
  if (!texto) return []
  const vistos = new Set()
  for (const bruta of semAcento(texto).split(/[^a-z0-9]+/)) {
    if (bruta.length < min || COMUNS.has(bruta)) continue
    if (/^\d+$/.test(bruta)) continue
    vistos.add(bruta)
    if (vistos.size >= max) break
  }
  return [...vistos]
}

/**
 * As ferramentas usadas DESDE a última mensagem dele, com a entrada de cada
 * uma. É o que permite a uma trava perguntar "você mostrou?" em vez de acreditar
 * no que eu escrevi: mandar arquivo é uma chamada de ferramenta, e ela ou está
 * no transcrito ou não está.
 */
export function ferramentasDoTurno(arquivo, limite = 400_000) {
  let texto = null
  try { texto = readFileSync(arquivo, 'utf8').slice(-limite) } catch { return [] }
  const linhas = texto.split('\n')

  // acha onde o turno começa: a última mensagem escrita por uma PESSOA
  let inicio = 0
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    let l = null
    try { l = JSON.parse(linhas[i]) } catch { continue }
    if (l?.type !== 'user' || l?.isMeta || l?.toolUseResult) continue
    const c = l?.message?.content
    const t = typeof c === 'string' ? c
      : Array.isArray(c) ? c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n') : ''
    if (t && !t.startsWith('<')) { inicio = i; break }
  }

  const usos = []
  for (const linha of linhas.slice(inicio)) {
    let l = null
    try { l = JSON.parse(linha) } catch { continue }
    const c = l?.message?.content
    if (!Array.isArray(c)) continue
    for (const parte of c) {
      if (parte?.type === 'tool_use') usos.push({ nome: parte.name, entrada: parte.input || {} })
    }
  }
  return usos
}

/** Casa um termo com um texto qualquer, tolerando plural e flexão curta. */
export function mencionado(termo, texto) {
  const t = semAcento(texto)
  const raiz = termo.length > 5 ? termo.slice(0, -1) : termo
  return t.includes(raiz)
}
