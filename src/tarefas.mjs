// Quanto vale cada tarefa resolvida.
//
// Junta três coisas que já existem soltas: os to-dos concluídos (meta.json), o
// tempo ativo da sessão daquele agente (transcript) e as faixas de mercado por
// senioridade. Daí sai um preço por tarefa e uma média por projeto.
//
// A honestidade do número depende de saber o que ele NÃO é:
//
// - O tempo por tarefa é RATEADO. O meta.json não guarda quando cada to-do foi
//   fechado, então o tempo da sessão é dividido entre as tarefas concluídas
//   dela. Duas tarefas de tamanhos muito diferentes saem com o mesmo tempo. O
//   `doneAt`, que o painel passou a carimbar, conserta isso daqui pra frente.
// - A complexidade é HEURÍSTICA. Sai de sinais de esforço, não de entendimento
//   do problema: uma tarefa difícil resolvida em duas linhas parece fácil. Por
//   isso a sugestão é corrigível, e a correção vence para sempre.
// - O tempo cobrado pode ser a MÉDIA entre o medido e o que o Felipe digitou.
//   O medido ignora o tempo dele pensando fora do Claude Code; o digitado é
//   memória. A média entre os dois erra menos que qualquer um sozinho.

import { readJobs, projectOf } from './jobs.mjs'
import { jobsHistoricos } from './historico.mjs'
import { varrer, ativoMs, GRAO_MS, CORTE_PADRAO_MIN, custoDe } from './tempo.mjs'
import { readConfig } from './config.mjs'
import { meioDa, TABELA_BASE } from './mercado.mjs'

export const NIVEIS = ['junior', 'pleno', 'senior']

/**
 * Cada sinal vira nota de 0 a 3, e o nível sai da soma ponderada.
 *
 * O peso da duração é deliberadamente baixo: tempo longo é tarefa GRANDE, não
 * tarefa DIFÍCIL, e quem paga sênior está pagando por dificuldade — senão
 * bastaria arrastar o trabalho para subir de faixa. O que pesa mais é voltar
 * no mesmo arquivo, que é o sinal de que a primeira tentativa não resolveu.
 *
 * Os cortes foram calibrados contra as 125 sessões reais desta máquina até
 * a distribuição parar de empilhar tudo em sênior.
 */
const SINAIS = [
  {
    id: 'duracao', rotulo: 'duração ativa',
    cortes: [0.5, 2, 6], peso: 1,
    valor: (t) => t.ms / 36e5,
    mostrar: (v) => `${Math.floor(v)}h${String(Math.round((v % 1) * 60)).padStart(2, '0')}`,
  },
  {
    id: 'tokens', rotulo: 'tokens gastos',
    cortes: [150e3, 600e3, 2e6], peso: 1,
    valor: (t) => t.tokens,
    mostrar: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`),
  },
  {
    id: 'arquivos', rotulo: 'arquivos mexidos',
    cortes: [1, 4, 10], peso: 2,
    valor: (t) => t.arquivos,
    mostrar: (v) => String(Math.round(v)),
  },
  {
    id: 'turnos', rotulo: 'idas e voltas',
    cortes: [10, 40, 120], peso: 1,
    valor: (t) => t.turnos,
    mostrar: (v) => String(Math.round(v)),
  },
  {
    // Voltar no mesmo arquivo é o sinal mais honesto de dificuldade que o
    // transcript dá: significa que a primeira tentativa não resolveu.
    id: 'reeditados', rotulo: 'arquivos reabertos',
    cortes: [0, 3, 8], peso: 3,
    valor: (t) => t.reeditados,
    mostrar: (v) => String(Math.round(v)),
  },
  {
    id: 'modelo', rotulo: 'modelo',
    cortes: [0, 1, 2], peso: 1,
    valor: (t) => ({ haiku: 0, sonnet: 1, fable: 2, opus: 3 }[t.familia] ?? 1),
    mostrar: (v, t) => t.familia || '—',
  },
]

const nota = (v, cortes) => (v > cortes[2] ? 3 : v > cortes[1] ? 2 : v > cortes[0] ? 1 : 0)
const PONTOS_MAX = SINAIS.reduce((a, s) => a + s.peso * 3, 0)

/** Pontua e sugere o nível. Devolve os sinais para a tela poder justificar. */
export function classificar(t) {
  const detalhe = SINAIS.map((s) => {
    const bruto = s.valor(t)
    const n = nota(bruto, s.cortes)
    return { id: s.id, rotulo: s.rotulo, texto: s.mostrar(bruto, t), nota: n, peso: s.peso }
  })
  const pontos = detalhe.reduce((a, d) => a + d.nota * d.peso, 0)
  const fracao = pontos / PONTOS_MAX
  // Cortes tirados dos percentis das 125 sessões reais desta máquina, não de
  // números redondos: a distribuição é bimodal (muita sessão curta de recado,
  // muita sessão longa de trabalho), e terços iguais jogavam metade em sênior.
  // Isto dá aproximadamente 34% júnior, 42% pleno e 24% sênior.
  const nivel = fracao >= 0.85 ? 'senior' : fracao >= 0.32 ? 'pleno' : 'junior'
  return { pontos, fracao, nivel, sinais: detalhe }
}

/** Família do modelo que gastou mais token na sessão — "opus", "sonnet"… */
function familiaDominante(porDia) {
  const soma = {}
  for (const porModelo of Object.values(porDia || {})) {
    for (const [modelo, u] of Object.entries(porModelo)) {
      const total = u.input + u.output + u.escrita5m + u.escrita1h + u.leitura
      soma[modelo] = (soma[modelo] || 0) + total
    }
  }
  const campeao = Object.entries(soma).sort((a, b) => b[1] - a[1])[0]
  if (!campeao) return null
  const m = /claude-(opus|sonnet|haiku|fable)/.exec(campeao[0])
  return m ? m[1] : null
}

const tokensDe = (porDia) => {
  let n = 0
  for (const porModelo of Object.values(porDia || {})) {
    for (const u of Object.values(porModelo)) n += u.input + u.output + u.escrita5m + u.escrita1h + u.leitura
  }
  return n
}

const custoDeSessao = (porDia) => {
  let n = 0
  for (const porModelo of Object.values(porDia || {})) {
    for (const [modelo, u] of Object.entries(porModelo)) n += custoDe(modelo, u) || 0
  }
  return n
}

/**
 * A lista de tarefas resolvidas, com esforço, nível e preço.
 *
 * Duas unidades de "um problema", porque as duas mentem de jeitos diferentes:
 *
 * - `todo` é a unidade certa — uma tarefa fechada é uma coisa resolvida — mas
 *   depende de o agente marcar concluído, o que hoje quase não acontece, e o
 *   job some quando o Claude Code limpa. Serve para o que vier daqui em diante.
 * - `sessao` tem centenas de amostras e início e fim exatos, mas uma sessão
 *   longa resolve várias coisas, então a média por sessão é sempre maior que a
 *   média por problema.
 *
 * @param {number} corteMin  mesma parada que encerra trabalho na aba de tempo
 * @param {'todo'|'sessao'} unidade
 */
export function tarefas({ corteMin = CORTE_PADRAO_MIN, unidade = 'todo' } = {}) {
  const corteMs = Math.max(corteMin, GRAO_MS / 60_000) * 60_000
  const cfg = readConfig()
  const mercado = cfg.mercado?.junior?.max ? cfg.mercado : TABELA_BASE
  const valorHora = {
    junior: meioDa(mercado.junior),
    pleno: meioDa(mercado.pleno),
    senior: meioDa(mercado.senior),
  }

  const { arquivos } = varrer()
  const porSessao = {}
  for (const dados of Object.values(arquivos)) {
    if (dados.sessao) porSessao[dados.sessao] = dados
  }

  const lista = unidade === 'sessao'
    ? porSessaoLista({ arquivos, corteMs, valorHora, cfg })
    : porTodoLista({ porSessao, corteMs, valorHora, cfg })

  lista.sort((a, b) => b.preco - a.preco)

  const comTempo = lista.filter((t) => t.cobradoMs > 0)
  const mediaMs = comTempo.length ? comTempo.reduce((a, t) => a + t.cobradoMs, 0) / comTempo.length : 0
  const porNivel = {}
  for (const nivel of NIVEIS) {
    const dele = comTempo.filter((t) => t.nivel === nivel)
    porNivel[nivel] = {
      nivel,
      quantas: dele.length,
      mediaMs: dele.length ? dele.reduce((a, t) => a + t.cobradoMs, 0) / dele.length : 0,
      total: dele.reduce((a, t) => a + t.preco, 0),
      valorHora: valorHora[nivel],
      faixa: mercado[nivel],
    }
  }

  return {
    unidade,
    tarefas: lista,
    mercado,
    valorHora,
    resumo: {
      quantas: lista.length,
      semTempo: lista.length - comTempo.length,
      mediaMs,
      totalMs: comTempo.reduce((a, t) => a + t.cobradoMs, 0),
      total: lista.reduce((a, t) => a + t.preco, 0),
      digitadas: lista.filter((t) => t.digitadoMs != null).length,
      rateadas: lista.filter((t) => t.rateada).length,
    },
    porNivel,
  }
}

/** Uma linha por to-do concluído, com o tempo da sessão rateado entre eles. */
function porTodoLista({ porSessao, corteMs, valorHora, cfg }) {
  const lista = []
  // Vivos mais arquivados: sem os arquivados, a conta só enxergaria a última
  // semana, que é o tempo que um job sobrevive antes de o CLI limpar.
  const { vivos, mortos } = jobsHistoricos(readJobs())
  for (const job of [...vivos, ...mortos]) {
    const feitos = job.todos.filter((t) => t.done)
    if (!feitos.length) continue

    const s = job.sessionId ? porSessao[job.sessionId] : null
    const ms = s ? ativoMs([...s.blocos].sort((a, b) => a[0] - b[0]), corteMs) : 0
    const sinais = s?.sinais || { turnos: 0, arquivos: 0, reeditados: 0 }
    const n = feitos.length
    // Rateio simples: sem marca de início e fim por tarefa, dividir por igual é
    // a única divisão que não inventa uma diferença que ninguém mediu.
    const base = {
      ms: ms / n,
      tokens: tokensDe(s?.porDia) / n,
      custoApi: custoDeSessao(s?.porDia) / n,
      arquivos: sinais.arquivos / n,
      turnos: sinais.turnos / n,
      reeditados: sinais.reeditados / n,
      familia: familiaDominante(s?.porDia),
    }

    for (const t of feitos) {
      const chave = t.text
      const auto = classificar(base)
      const escolhido = NIVEIS.includes(job.niveis?.[chave]) ? job.niveis[chave] : auto.nivel
      // O digitado entra como média, não como substituto: um corrige o outro.
      const digitadoMs = Number(job.estimativas?.[chave]) > 0 ? Number(job.estimativas[chave]) * 36e5 : null
      const cobradoMs = digitadoMs == null ? base.ms : (base.ms + digitadoMs) / 2
      lista.push({
        job: job.id,
        projeto: job.project,
        assunto: job.subject,
        tarefa: chave,
        medidoMs: base.ms,
        digitadoMs,
        cobradoMs,
        tokens: base.tokens,
        custoApi: base.custoApi,
        rateada: n > 1,
        nivelAuto: auto.nivel,
        nivel: escolhido,
        corrigido: escolhido !== auto.nivel,
        pontos: auto.pontos,
        fracao: auto.fracao,
        sinais: auto.sinais,
        valorHora: valorHora[escolhido],
        preco: (cobradoMs / 36e5) * valorHora[escolhido],
        semTranscript: !s,
      })
    }
  }
  return lista
}

/**
 * Uma linha por sessão do Claude Code. Sem rateio nenhum — o tempo é o da
 * própria sessão — mas cada linha pode conter mais de um problema resolvido.
 */
function porSessaoLista({ arquivos, corteMs, valorHora, cfg }) {
  const ajustes = cfg.sessoes || {}
  const lista = []
  for (const dados of Object.values(arquivos)) {
    const ms = ativoMs([...(dados.blocos || [])].sort((a, b) => a[0] - b[0]), corteMs)
    if (!ms) continue
    const s = dados.sinais || { turnos: 0, arquivos: 0, reeditados: 0 }
    const base = {
      ms,
      tokens: tokensDe(dados.porDia),
      custoApi: custoDeSessao(dados.porDia),
      arquivos: s.arquivos,
      turnos: s.turnos,
      reeditados: s.reeditados,
      familia: familiaDominante(dados.porDia),
    }
    const chave = dados.sessao
    const auto = classificar(base)
    const escolhido = NIVEIS.includes(ajustes[chave]?.nivel) ? ajustes[chave].nivel : auto.nivel
    const digitadoMs = Number(ajustes[chave]?.horas) > 0 ? Number(ajustes[chave].horas) * 36e5 : null
    const cobradoMs = digitadoMs == null ? ms : (ms + digitadoMs) / 2
    lista.push({
      job: null,
      sessao: chave,
      projeto: projectOf(dados.cwd || '').project,
      assunto: dados.titulo || '(sem pedido registrado)',
      tarefa: dados.titulo || chave.slice(0, 8),
      medidoMs: ms,
      digitadoMs,
      cobradoMs,
      tokens: base.tokens,
      custoApi: base.custoApi,
      rateada: false,
      nivelAuto: auto.nivel,
      nivel: escolhido,
      corrigido: escolhido !== auto.nivel,
      pontos: auto.pontos,
      fracao: auto.fracao,
      sinais: auto.sinais,
      valorHora: valorHora[escolhido],
      preco: (cobradoMs / 36e5) * valorHora[escolhido],
      semTranscript: false,
    })
  }
  return lista
}
