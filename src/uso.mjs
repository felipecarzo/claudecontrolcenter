// Quanto do plano já foi usado: janela de 5 horas e janela semanal.
//
// De onde vem: o Claude Code entrega `rate_limits` no JSON que manda para o
// comando de statusLine, a cada resposta. É o número OFICIAL da conta, o mesmo
// do `/usage` — não é estimativa por custo, como faz o ccusage, e não é gasto
// de API. Por isso não há chamada de rede aqui, nem leitura de credencial.
//
// O preço disso é que o valor só anda quando o Claude Code responde alguma
// coisa. Fora de uso, o painel mostra a última leitura com a hora dela.

import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

/**
 * CC-257: a barra de uso do plano NUNCA teve dado nesta VPS, e ninguém notou.
 *
 * Apontado em 21/08 pela sessão do gate, e conferido: o arquivo simplesmente
 * não existe aqui. A causa é a de sempre, a terceira vez no mesmo dia:
 * `~/.claude` está montada SOMENTE LEITURA dentro do sandbox do Claude Code,
 * então a gravação falha, o `catch` engole, e a tela mostra uma barra vazia
 * como se o plano estivesse sem uso.
 *
 * **Esse é o defeito mais caro deste painel**, e está escrito cinco vezes no
 * `CLAUDE.md`: a tela afirmando com confiança algo que não sabe. Barra vazia
 * não distingue "não usei nada" de "não consegui ler".
 *
 * Mesmo abrigo do `meu.mjs` (CC-232) e do `metaSessao.mjs` (CC-157): tenta a
 * casa, cai para `~/.local/share/agent-cockpit/` quando ela está trancada, e a
 * leitura junta os dois lugares, preferindo o mais NOVO.
 */
export const USO_FILE = path.join(casaClaude(), 'control-center-uso.json')
export const USO_FILE_ABRIGO = path.join(path.dirname(DIR_SESSOES_ABRIGO()), 'control-center-uso.json')

/** Os dois lugares onde o uso pode estar, na ordem em que se tenta gravar. */
const ARQUIVOS = () => [USO_FILE, USO_FILE_ABRIGO]

/**
 * CC-261: o marcador de "a barra de status FOI chamada".
 *
 * Sem ele não dá para distinguir dois estados que a tela mostra igual:
 *
 *  - a barra nunca rodou nesta máquina (o caso desta VPS, onde as sessões vêm
 *    por Remote Control e não há terminal para desenhar barra nenhuma);
 *  - a barra rodou, mas o Claude Code não mandou `rate_limits` (acontece em
 *    conta sem assinatura, ou antes da primeira resposta da sessão).
 *
 * Os dois deixam o painel sem número, e o conserto de cada um é diferente. Por
 * isso o marcador guarda a hora da última chamada e se ela trouxe o dado.
 */
export const CHAMADA_FILE = path.join(path.dirname(USO_FILE_ABRIGO), 'control-center-statusline.json')

export function marcarChamada(temRateLimits) {
  try {
    fs.mkdirSync(path.dirname(CHAMADA_FILE), { recursive: true })
    const antes = lerChamada()
    fs.writeFileSync(CHAMADA_FILE, JSON.stringify({
      em: Date.now(),
      comDado: Boolean(temRateLimits),
      vezes: (antes?.vezes || 0) + 1,
      /* A primeira vez fica gravada para sempre: é ela que responde "isto
         alguma vez funcionou aqui?". */
      primeiraEm: antes?.primeiraEm || Date.now(),
    }))
  } catch { /* diagnóstico não pode derrubar a barra */ }
}

export function lerChamada() {
  try { return JSON.parse(fs.readFileSync(CHAMADA_FILE, 'utf8')) } catch { return null }
}

/**
 * CC-261: buscar o gasto do plano direto, quando a barra de status não roda.
 *
 * ## Por que isto existe, e por que era evitado
 *
 * Até 21/08 o painel **não lia credencial de propósito**, e o `CLAUDE.md` dizia
 * isso com todas as letras. A troca foi decisão dele, depois de medido que
 * nesta VPS a barra de status **nunca é chamada**: as sessões vêm por Remote
 * Control, sem terminal para desenhar barra nenhuma, então o número oficial não
 * chega por ali e o painel exibia o dado do PC, parado havia 21 horas.
 *
 * Palavras dele: *"precisamos resolver isso urgente, pq me ajuda bastante"*.
 *
 * ## O que isto NÃO faz
 *
 * Não renova token e não escreve no arquivo de credencial. Ele é do Claude Code,
 * que o mantém; aqui é **somente leitura**. Token vencido devolve `null` com o
 * motivo, e o painel segue com o último valor conhecido, como faz com o câmbio.
 *
 * ## O formato é outro, e isso importa
 *
 * A barra de status manda `used_percentage` e `resets_at` em segundos; esta
 * resposta manda `utilization` e `resets_at` em texto ISO. Normalizar aqui é o
 * que impede duas verdades sobre a mesma barra na tela.
 */
export const CREDENCIAL = path.join(casaClaude(), '.credentials.json')

/** De quanto em quanto tempo vale perguntar de novo. Cinco minutos: o número
 *  muda devagar, e é a segunda chamada de rede do painel inteiro. */
export const INTERVALO_BUSCA_MS = 5 * 60 * 1000

const pct = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.min(100, Number(n))) : null)
const quando = (iso) => {
  const t = Date.parse(iso || '')
  return Number.isFinite(t) ? t : null
}
const janelaRemota = (j) => {
  if (!j) return null
  const p = pct(j.utilization)
  return p === null ? null : { pct: p, resetaEm: quando(j.resets_at) }
}

export async function buscarUsoDaConta({ agora = Date.now(), fetchFn = fetch } = {}) {
  let cred = null
  try {
    cred = JSON.parse(fs.readFileSync(CREDENCIAL, 'utf8'))?.claudeAiOauth
  } catch { return { erro: 'não achei a credencial desta máquina' } }
  if (!cred?.accessToken) return { erro: 'a credencial não tem token de acesso' }
  if (cred.expiresAt && cred.expiresAt < agora) {
    return { erro: 'o token desta máquina venceu, e quem renova é o Claude Code' }
  }
  try {
    const r = await fetchFn('https://api.anthropic.com/api/oauth/usage', {
      headers: { authorization: `Bearer ${cred.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return { erro: `a conta respondeu ${r.status}` }
    const d = await r.json()
    const dados = {
      cincoHoras: janelaRemota(d.five_hour),
      semana: janelaRemota(d.seven_day),
      semanaOpus: janelaRemota(d.seven_day_opus),
      semanaSonnet: janelaRemota(d.seven_day_sonnet),
      em: agora,
      buscado: true,
    }
    if (!dados.cincoHoras && !dados.semana) return { erro: 'a resposta veio sem as janelas do plano' }
    return { dados }
  } catch (e) {
    /* Falha de rede degrada como o câmbio: sem contato, o painel fica com o
       último valor conhecido em vez de zerar a barra. */
    return { erro: `não consegui perguntar: ${e.name === 'TimeoutError' ? 'demorou demais' : e.message}` }
  }
}

/** Busca e grava, respeitando o intervalo. Devolve o que ficou valendo. */
export async function atualizarUsoDaConta({ agora = Date.now(), forcar = false } = {}) {
  const atual = readUso()
  if (!forcar && atual?.em && agora - atual.em < INTERVALO_BUSCA_MS) return { dados: atual, doCache: true }
  const r = await buscarUsoDaConta({ agora })
  if (r.erro) return { erro: r.erro, dados: atual || null }
  for (const arq of ARQUIVOS()) {
    try {
      fs.mkdirSync(path.dirname(arq), { recursive: true })
      const tmp = `${arq}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(r.dados))
      fs.renameSync(tmp, arq)
      break
    } catch { /* próximo lugar */ }
  }
  return { dados: r.dados }
}

const janela = (j) => {
  if (!j || typeof j !== 'object') return null
  const pct = Number(j.used_percentage)
  if (!Number.isFinite(pct)) return null
  const reset = Number(j.resets_at)
  return {
    pct: Math.max(0, Math.min(100, pct)),
    // resets_at vem em segundos epoch; guardar em ms evita confusão na tela
    resetaEm: Number.isFinite(reset) && reset > 0 ? reset * 1000 : null,
  }
}

/**
 * O uso mais NOVO entre a casa e o abrigo.
 *
 * A ordem aqui é por data, e não por lugar, e a diferença importa: o painel roda
 * fora do sandbox e escreve na casa; o agente roda dentro e escreve no abrigo.
 * Preferir sempre a casa mostraria um número velho enquanto o novo estava do
 * lado, que é o mesmo tipo de mentira que este conserto remove.
 */
export function readUso() {
  let melhor = null
  for (const arq of ARQUIVOS()) {
    try {
      const u = JSON.parse(fs.readFileSync(arq, 'utf8'))
      if (!u || typeof u !== 'object') continue
      if (!melhor || (u.em || 0) > (melhor.em || 0)) melhor = u
    } catch { /* o outro pode ter */ }
  }
  return melhor
}

/**
 * Grava o que veio do statusLine. Devolve `null` quando não há nada de útil —
 * `rate_limits` só aparece para quem é assinante, e só depois da primeira
 * resposta da sessão.
 */
export function gravarUso(entrada) {
  const rl = entrada?.rate_limits
  if (!rl) return null
  // Estas são TODAS as janelas que o Claude Code reporta — conferido no bundle
  // do CLI. Não existe janela do Fable: ele consome da semanal, com teto de
  // 50% dela, e mais rápido que o Opus. Por isso não há como mostrar "quanto
  // resta de Fable" sem inventar.
  const dados = {
    cincoHoras: janela(rl.five_hour),
    semana: janela(rl.seven_day),
    semanaOpus: janela(rl.seven_day_opus),
    semanaSonnet: janela(rl.seven_day_sonnet),
    em: Date.now(),
  }
  if (!dados.cincoHoras && !dados.semana) return null

  // Só grava quando algum número mudou: o statusLine roda a cada render, e
  // reescrever o arquivo a cada tecla seria I/O à toa.
  const antes = readUso()
  const chave = (d) => JSON.stringify([d.cincoHoras, d.semana, d.semanaOpus, d.semanaSonnet])
  if (antes && chave(antes) === chave(dados)) return antes

  /* Tenta a casa; se ela estiver trancada, o abrigo. Antes havia um lugar só, e
     o `catch` mudo transformava "não consegui gravar" em barra vazia na tela.
     O statusLine continua sem poder falhar por causa disto, então o erro segue
     engolido — mas agora só depois das DUAS tentativas. */
  for (const arq of ARQUIVOS()) {
    try {
      fs.mkdirSync(path.dirname(arq), { recursive: true })
      const tmp = `${arq}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(dados))
      fs.renameSync(tmp, arq)
      return dados
    } catch { /* próximo lugar */ }
  }
  return dados
}
