/**
 * CC-916: a emenda. Ideia nova no meio do projeto entra no backlog JÁ no trecho
 * do Caminho onde o projeto está agora, marcada como emenda, e o escopo cresce de
 * forma visível. Vem do pedido dele de 04/10: ideia que o agente só escreve no
 * texto não chega ao Caminho (a fila de `ideias.mjs` guarda para a próxima sessão
 * e, por desenho, não escreve no backlog).
 *
 * Emenda nasce no estado B0 ("ideia, ainda não avaliada"): entra na hora, não se
 * perde, e ele confirma ou descarta depois. Não precisa de campo novo: a marca é
 * `origem: 'emenda'`.
 */
import * as B from './backlog.mjs'
import { caminhoDe } from './caminho.mjs'

export const ORIGEM = 'emenda'

/** A frente do trecho onde o projeto está agora, ou null quando esse trecho não é uma frente de verdade. */
export function frenteAtual(raiz) {
  const c = caminhoDe(raiz)
  if (!c.ok) return null
  const t = c.trechos[c.atual]
  return t && !t.chave.startsWith('_') ? t.chave : null
}

/**
 * Registra a emenda. `frente` vence; sem ela vale o trecho atual do Caminho.
 * Sem nenhuma das duas, recusa em voz alta: emenda sem lugar no caminho some.
 */
export function emendar(raiz, campos) {
  const arquivo = B.caminhoPadrao(raiz)
  const itens = B.ler(arquivo).itens
  // CC-958: ideia que melhora uma função que já existe entra no trecho (frente) dessa função
  const melhora = campos.melhora ? itens.find((x) => x.id === campos.melhora) : null
  if (campos.melhora && !melhora) throw new Error(`não achei ${campos.melhora}, o item que a ideia melhora`)
  const frente = campos.frente || melhora?.frente || frenteAtual(raiz)
  if (!frente) throw new Error('não achei em que trecho o projeto está: diga a frente com --frente')
  const onde = campos.lugar || null
  if (onde && !B.LUGARES.some((l) => l.codigo === onde)) throw new Error(`lugar desconhecido: ${onde} (vale ${B.LUGARES.map((l) => l.codigo).join(', ')})`)
  return B.acrescentar({
    ...campos, frente, origem: ORIGEM,
    // sem lugar, fica como ideia (B0), fora da fila; com o lugar escolhido por ele, entra definida, menos o "fora do MVP"
    estado: onde && onde !== 'fora' ? 'B1' : 'B0',
    lugar: onde ? { onde, em: new Date().toISOString() } : undefined,
    prefixo: campos.prefixo || B.prefixoDoProjeto(itens, raiz),
  }, arquivo)
}

/** CC-958: a sugestão de lugar. Só sugere: quem escolhe é ele, na pergunta ou no Caminho. */
// ponytail: regras fixas; trocar por medida quando houver histórico de onde ele põe cada tipo
export function sugerirLugar(campos, { itens = [], sprint = new Set() } = {}) {
  const fala = `${campos.intencao || ''} ${campos.citacao || ''}`
  if (/\b(depois do mvp|fora do mvp|no futuro|algum dia)\b/i.test(fala)) return { onde: 'fora', porque: 'a fala põe a ideia depois do MVP' }
  if (campos.natureza === 'DEF') return campos.risco === 'cliente' ? { onde: 'agora', porque: 'defeito que chega em quem paga' } : { onde: 'dia', porque: 'defeito: algo que funcionava quebrou' }
  if (campos.tamanho === 'G') return { onde: 'backlog', porque: 'grande: melhor quebrar antes de entrar num sprint' }
  const frentes = new Set(itens.filter((i) => sprint.has(i.id) && B.estaAberto(i)).map((i) => i.frente))
  return frentes.has(campos.frente) ? { onde: 'sprint', porque: `a frente ${campos.frente} está no sprint atual` } : { onde: 'backlog', porque: 'a frente dela não está no sprint atual' }
}

/** As opções da pergunta: o AskUserQuestion mostra no máximo 4. A sugestão vem primeiro, e o lugar que sobra vai escrito no texto da pergunta. */
export function opcoesDaPergunta(onde) {
  const noTexto = onde === 'fora' ? 'agora' : 'fora'
  return { opcoes: [onde, ...B.LUGARES.map((l) => l.codigo).filter((c) => c !== onde && c !== noTexto)], noTexto }
}

/** Quanto o escopo cresceu: emendas contra o que existia sem elas. */
export function crescimento(itens) {
  const emendas = itens.filter((i) => i.origem === ORIGEM && i.estado !== 'KO')
  const base = itens.filter((i) => i.origem !== ORIGEM && i.estado !== 'KO').length
  return { emendas: emendas.length, abertas: emendas.filter((i) => i.estado !== 'OK').length, pct: base ? Math.round((emendas.length / base) * 100) : 0 }
}
