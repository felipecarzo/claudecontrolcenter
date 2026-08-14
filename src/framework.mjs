/**
 * O framework de engenharia de software: o motor.
 *
 * Visão em `docs/produto/FRAMEWORK.md`. Primeira fatia: o gate de MVP.
 *
 * A ideia central, e o motivo deste arquivo existir separado do hook: o método
 * é DADO, não código. Este módulo é o motor que lê método mais estado e diz o
 * que pode. Quem aplica é outra camada (o hook), quem mostra é outra (o painel).
 * É a forma do ESLint: um motor, regras como dado, vários pontos de aplicação.
 *
 * Duas consequências que não podem ser perdidas numa refatoração:
 *
 *   - Nada aqui toca disco, rede ou IA. Recebe objeto, devolve objeto. É o que
 *     permite testar de verdade e é o que cumpre o "sem IA futuramente" da
 *     visão: quem lê o método é código comum.
 *   - Portão é MECÂNICO, nunca julgamento. Pergunta "existe critério de MVP
 *     registrado?", que é verificável, e nunca "o MVP está bom?". Julgamento de
 *     IA pode virar conselho na tela, jamais trava. O projeto já tem a evidência
 *     de por quê: 545 testes verdes com a tela quebrada no navegador.
 */

/** Nunca travadas, em método nenhum. Trava em doc quebra o `/end-session`,
 *  lição que o `rota-guard` já aprendeu, e travar o próprio estado tornaria
 *  impossível sair da fase. */
export const SEMPRE_LIVRE = ['docs/**', 'assets/**', '.framework/**', '*']

/**
 * Predicados: o vocabulário que uma fase usa em `exige`. Cada um devolve `null`
 * quando está satisfeito, ou a frase do que falta.
 *
 * A frase importa tanto quanto a regra: gate que trava sem dizer por que é a
 * burocracia que se desliga na terceira semana (achado do CC-32). Por isso
 * nenhum predicado devolve booleano nu.
 */
export const PREDICADOS = {
  'mvp-definido': (e) => {
    const n = e?.mvp?.criterios?.length || 0
    return n > 0 ? null : 'o MVP não tem nenhum critério de pronto registrado'
  },
  'mvp-tem-nome': (e) => (e?.mvp?.nome || '').trim()
    ? null
    : 'o MVP não tem nome: em uma frase, o que este projeto entrega',
  'criterios-todos-marcados': (e) => {
    const cs = e?.mvp?.criterios || []
    if (!cs.length) return 'não há critério de pronto para conferir'
    const abertos = cs.filter((c) => !c.feito)
    return abertos.length
      ? `faltam ${abertos.length} de ${cs.length} critérios do MVP: ${abertos.map((c) => c.texto).join('; ')}`
      : null
  },
}

/** Métodos prontos. Trocar de método é trocar de dado, nunca de código. */
export const METODOS = {
  'mvp-basico': {
    id: 'mvp-basico',
    titulo: 'MVP básico: definir antes de construir',
    fases: [
      {
        id: 'definicao',
        titulo: 'Definição',
        explica: 'Antes de escrever código, o projeto precisa dizer o que entrega e como se sabe que ficou pronto.',
        exige: ['mvp-tem-nome', 'mvp-definido'],
        trava: ['src/**', 'apps/**', 'tools/**', 'lib/**', 'app/**'],
      },
      {
        id: 'execucao',
        titulo: 'Execução',
        explica: 'Código liberado. O projeto só é dado como pronto quando todos os critérios do MVP estiverem marcados.',
        exige: ['criterios-todos-marcados'],
        trava: [],
      },
    ],
  },
}

/** Casamento de caminho simples: `src/**` pega tudo sob `src/`, `*` pega o que
 *  está na raiz, nome exato pega ele mesmo. Sem dependência, de propósito. */
export function casa(padrao, rel) {
  const alvo = String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '')
  if (!alvo) return false
  if (padrao === '**') return true
  if (padrao === '*') return !alvo.includes('/')
  if (padrao.endsWith('/**')) {
    const base = padrao.slice(0, -3)
    return alvo === base || alvo.startsWith(base + '/')
  }
  return alvo === padrao
}

export const estadoInicial = (metodo = 'mvp-basico') => ({
  metodo,
  fase: METODOS[metodo]?.fases[0]?.id || null,
  mvp: { nome: '', criterios: [] },
  historico: [],
})

const metodoDe = (m) => (typeof m === 'string' ? METODOS[m] : m) || null

/**
 * O coração. Devolve a fase atual, o que falta para sair dela e o que ela trava.
 * `pendencias` vazio significa que o portão está aberto para a próxima fase.
 */
export function avaliar(metodo, estado) {
  const M = metodoDe(metodo)
  if (!M) return { erro: 'método desconhecido', fase: null, pendencias: [], trava: [] }
  // Desligado é diferente de inexistente, e a diferença é o dado: desligar
  // preserva o MVP e o histórico de escopo, apagar a pasta joga fora. O botão
  // do painel desliga; quem quiser sumir com tudo apaga `.framework` à mão.
  if (estado?.ligado === false) {
    return {
      metodo: M.id, ligado: false, fase: estado?.fase || null, pendencias: [],
      portaoAberto: true, trava: [], proxima: null, tituloFase: 'Desligado',
      explica: 'O framework está desligado neste projeto. Nada é travado.',
      indice: 0, ultima: false,
    }
  }

  const idx = Math.max(0, M.fases.findIndex((f) => f.id === estado?.fase))
  const fase = M.fases[idx]
  const pendencias = (fase.exige || [])
    .map((p) => (PREDICADOS[p] ? PREDICADOS[p](estado) : `predicado desconhecido: ${p}`))
    .filter(Boolean)

  return {
    metodo: M.id,
    ligado: true,
    fase: fase.id,
    tituloFase: fase.titulo,
    explica: fase.explica,
    indice: idx,
    ultima: idx === M.fases.length - 1,
    pendencias,
    portaoAberto: pendencias.length === 0,
    trava: fase.trava || [],
    proxima: M.fases[idx + 1]?.id || null,
  }
}

/**
 * O que o hook pergunta. `rel` é o caminho relativo à raiz do projeto.
 * Liberar é o padrão: qualquer dúvida (método ausente, estado corrompido)
 * libera, porque um framework que trava por bug próprio é desligado no mesmo dia.
 */
export function podeEditar(metodo, estado, rel) {
  const a = avaliar(metodo, estado)
  if (a.erro) return { ok: true, motivo: 'método desconhecido, liberando' }
  if (a.ligado === false) return { ok: true, motivo: 'framework desligado neste projeto' }
  if (SEMPRE_LIVRE.some((p) => casa(p, rel))) return { ok: true, motivo: 'caminho sempre livre' }
  if (!a.trava.some((p) => casa(p, rel))) return { ok: true, motivo: 'fase não trava este caminho' }
  if (a.portaoAberto) return { ok: true, motivo: 'portão aberto, falta só avançar de fase' }
  return { ok: false, fase: a.fase, pendencias: a.pendencias, explica: a.explica }
}

/** Avança de fase. Recusa com o que falta, em vez de avançar calado. */
export function avancar(metodo, estado) {
  const a = avaliar(metodo, estado)
  if (!a.portaoAberto) return { ok: false, pendencias: a.pendencias }
  if (a.ultima) return { ok: false, pendencias: ['já está na última fase'] }
  return { ok: true, estado: { ...estado, fase: a.proxima } }
}

/**
 * Mudança de escopo DECLARÁVEL, e é de propósito que ela não seja proibida.
 * Travar mudança de escopo tem dois desfechos previsíveis: o Felipe desliga o
 * framework, ou burla. Mudar de ideia no meio é comportamento real e legítimo
 * dele (o reposicionamento de 13/08 mudou o backlog inteiro num dia). O valor
 * está em a mudança ficar REGISTRADA, não em impedir.
 */
export function mudarEscopo(estado, { mvp, motivo, quando }) {
  if (!motivo || !String(motivo).trim()) {
    return { ok: false, erro: 'mudança de escopo exige motivo' }
  }
  return {
    ok: true,
    estado: {
      ...estado,
      mvp: mvp || estado.mvp,
      historico: [
        ...(estado.historico || []),
        { tipo: 'escopo', de: estado.mvp, para: mvp, motivo, quando: quando || null },
      ],
    },
  }
}

/** Frase única para o `SessionStart` e para o painel. Sem número solto: o
 *  Felipe não teria como discordar de um "87", mas discorda de uma frase. */
export function resumo(metodo, estado) {
  const a = avaliar(metodo, estado)
  if (a.erro) return a.erro
  if (a.ligado === false) return 'Framework desligado neste projeto. O MVP registrado continua guardado.'
  const onde = `fase ${a.indice + 1} de ${METODOS[a.metodo]?.fases.length}: ${a.tituloFase}`
  if (a.portaoAberto) {
    return a.ultima
      ? `${onde}. Todos os critérios do MVP estão marcados.`
      : `${onde}. Portão aberto, dá para avançar para "${a.proxima}".`
  }
  return `${onde}. Falta: ${a.pendencias.join('; ')}.`
}
