/**
 * CC-930: o vigia do Coderoom. Pedido dele em 06/10: "bota um guarda no Code Room para estar vendo isso de segundo
 * em segundo". Medido nos registros de 5 dias: 10 de 92 turnos do opencode disseram "criei" sem usar ferramenta
 * nenhuma, e esses turnos esperaram 65 s (mediana) para começar, contra 20 s dos outros: é o modelo grátis
 * congestionado respondendo pior.
 *
 * A detecção é do PROGRAMA, não de IA: ele já vê cada passo do agente, e uma regra não erra o que mede. Cada achado
 * vira uma nota na conversa (ele vê na hora) e uma linha em `vigia.jsonl` (para contar depois, por modelo).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const ESPERA_ALERTA_MS = Number(process.env.CC_VIGIA_ESPERA_MS) || 90000

/* "Criei", "adicionei", "implementei"... em português ou inglês: o agente afirma ter MEXIDO em algo. */
const AFIRMA_ACAO = /\b(criei|adicionei|implementei|alterei|ajustei|corrigi|editei|escrevi|inclu[ií]|removi|atualizei|mudei|coloquei|configurei|created|added|implemented|updated|fixed|wrote|modified|changed)\b/i

/**
 * O que deu errado neste turno, ou null. Só para agentes que trabalham com ferramenta (opencode e agy): o Claude
 * de conversa pura e a revisão em modo só leitura não contam.
 */
export function diagnosticoDoTurno({ agente, estado, texto, ferramentas = [], erro, somenteLer = false }) {
  if (!['opencode', 'agy'].includes(agente) || somenteLer) return null
  const t = String(texto || '').trim()
  if (erro) return { tipo: 'erro', frase: `o agente parou com erro: ${String(erro).split('\n')[0].slice(0, 160)}` }
  if (estado === 'interrompido') return { tipo: 'interrompido', frase: 'a resposta foi interrompida antes de terminar' }
  if (!t && !ferramentas.length) return { tipo: 'vazio', frase: 'o agente terminou sem responder nada e sem mexer em nada' }
  // "Não escrevi nada ainda": honesto, mas a tarefa também não andou (medido em 06/10, 1 dos 8 casos acusados)
  if (!ferramentas.length && /\bn[aã]o\s+(\S+\s+){0,2}(escrevi|criei|fiz|alterei|mexi)\b/i.test(t)) return { tipo: 'nao-fez', frase: 'o agente avisou que não fez a tarefa e não usou nenhuma ferramenta' }
  if (!ferramentas.length && AFIRMA_ACAO.test(t)) return { tipo: 'disse-sem-fazer', frase: 'o agente disse que fez, mas não usou nenhuma ferramenta neste turno: nenhum arquivo foi lido nem alterado' }
  return null
}

/** O texto da nota na conversa. */
export const notaDoVigia = (d, modelo) => `Vigia: ${d.frase}${modelo ? ` (modelo ${modelo})` : ''}.`

/** Registro para contar depois. Nunca derruba quem chama. */
export function registrar(achado, { arquivo = path.join(process.env.CC_HOME || path.join(os.homedir(), '.local', 'share', 'agent-cockpit'), 'vigia.jsonl') } = {}) {
  try { fs.mkdirSync(path.dirname(arquivo), { recursive: true }); fs.appendFileSync(arquivo, JSON.stringify({ em: Date.now(), ...achado }) + '\n') } catch { /* o registro é extra */ }
}

/** Falha que é do MODELO (não do código): a próxima tentativa deve ir para outro modelo, numa conversa limpa. */
export const falhaDoModelo = (erro) => /nenhum arquivo do projeto foi alterado|não terminou no prazo|terminou sem responder|disse que fez|não fez a tarefa|limite de uso|rate limit|interrompida/i.test(String(erro || ''))

/**
 * A escada de quem constrói, do mais barato para o mais caro. O Agy (Gemini, já pago) é o último degrau: no ensaio de
 * 05/10 ele acertou 3 de 3, mais devagar (150 s contra 97 s) e com 9 vezes mais texto.
 */
export const ESCADA = [
  { agente: 'opencode', modelo: 'opencode/big-pickle' },
  { agente: 'opencode', modelo: 'opencode/nemotron-3-ultra-free' },
  { agente: 'agy', modelo: null },
]
export const degrauDe = (n) => ESCADA[Math.min(Math.max(Number(n) || 0, 0), ESCADA.length - 1)]
