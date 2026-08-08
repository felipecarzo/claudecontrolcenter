/* Motor de gráficos do painel — SVG na mão, sem biblioteca.
 *
 * A ideia central: em vez de N gráficos escritos um a um, existe um ÍNDICE do
 * que pode ser cruzado (dimensões × medidas) e um punhado de formas que sabem
 * desenhar qualquer cruzamento válido. Um gráfico novo passa a ser uma linha
 * de configuração, não código.
 *
 * Nem toda combinação existe, e isso é dado e não bug: horas vêm dos blocos de
 * tempo, que não sabem qual modelo rodou; tokens vêm do uso, que não sabe
 * quanto tempo levou. Por isso cada medida declara sua FONTE, cada dimensão
 * declara em quais fontes ela existe, e o construtor desabilita o resto.
 *
 * Vive fora do ui.html porque somar isto lá dentro deixaria os dois ilegíveis.
 * Exporta um único objeto global, e recebe os formatadores de fora para não
 * duplicar as regras de exibição que a página já tem.
 */
(function () {
  'use strict'

  // ---------------------------------------------------------------- índice

  const diaSemana = (dia) => {
    // Date com 'YYYY-MM-DD' é lido como UTC; sem o T12:00 o fuso do Brasil
    // puxa a data um dia para trás e segunda vira domingo.
    const nomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    return nomes[new Date(dia + 'T12:00:00').getDay()]
  }
  const ORDEM_SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

  const DIMENSOES = {
    projeto: { rotulo: 'projeto', fontes: ['tempo', 'uso'], de: (f) => f.projeto },
    dia: { rotulo: 'dia', fontes: ['tempo', 'uso'], de: (f) => f.dia, cronologica: true },
    mes: { rotulo: 'mês', fontes: ['tempo', 'uso'], de: (f) => f.dia.slice(0, 7), cronologica: true },
    semana: {
      rotulo: 'dia da semana', fontes: ['tempo', 'uso'],
      de: (f) => diaSemana(f.dia), ordem: ORDEM_SEMANA,
    },
    modelo: { rotulo: 'modelo', fontes: ['uso'], de: (f) => f.modelo },
    nenhuma: { rotulo: '— nenhuma —', fontes: ['tempo', 'uso'], de: () => 'tudo' },
  }

  // `precisa` é o que faz a medida sumir da lista quando não dá pra calcular:
  // valor sem taxa seria zero em toda linha, e um gráfico de zeros mente.
  const MEDIDAS = {
    horas: { rotulo: 'horas', fonte: 'tempo', de: (f) => f.ms / 36e5, fmt: 'horas' },
    valor: {
      rotulo: 'valor cobrado', fonte: 'tempo', fmt: 'brl', precisa: 'taxa',
      de: (f) => (f.ms / 36e5) * f.taxaHora,
    },
    custoReal: {
      rotulo: 'custo da assinatura', fonte: 'tempo', fmt: 'brl', precisa: 'assinatura',
      de: (f) => (f.ms / 36e5) * f.custoHoraMes,
    },
    sobra: {
      rotulo: 'sobra (valor − assinatura)', fonte: 'tempo', fmt: 'brl',
      precisa: 'taxa+assinatura', permiteNegativo: true,
      de: (f) => (f.ms / 36e5) * (f.taxaHora - f.custoHoraMes),
    },
    tokens: { rotulo: 'tokens', fonte: 'uso', de: (f) => f.tokens, fmt: 'tok' },
    entrada: { rotulo: 'tokens de entrada', fonte: 'uso', de: (f) => f.input, fmt: 'tok' },
    saida: { rotulo: 'tokens de saída', fonte: 'uso', de: (f) => f.output, fmt: 'tok' },
    cacheEscrito: {
      rotulo: 'cache escrito', fonte: 'uso', fmt: 'tok',
      de: (f) => f.escrita5m + f.escrita1h,
    },
    cacheLido: { rotulo: 'cache lido', fonte: 'uso', de: (f) => f.leitura, fmt: 'tok' },
    custoApi: {
      rotulo: 'custo de API', fonte: 'uso', fmt: 'moeda',
      de: (f) => f.custo || 0,
    },
  }

  const FORMAS = {
    barras: { rotulo: 'barras', serie: true },
    linha: { rotulo: 'linha acumulada', serie: true, exigeCronologica: true },
    rosca: { rotulo: 'rosca', serie: false },
    calendario: { rotulo: 'calendário', serie: false, exigeDimensao: 'dia' },
    tabela: { rotulo: 'tabela', serie: true },
  }

  // Combinações prontas — as perguntas que já se sabe que valem a pena.
  const PRONTOS = [
    { nome: 'Ritmo do ano', forma: 'calendario', dimensao: 'dia', serie: 'nenhuma', medida: 'horas' },
    { nome: 'Fatia de cada projeto', forma: 'rosca', dimensao: 'projeto', serie: 'nenhuma', medida: 'horas' },
    { nome: 'Dinheiro acumulado', forma: 'linha', dimensao: 'dia', serie: 'projeto', medida: 'valor' },
    { nome: 'Dias divididos por projeto', forma: 'barras', dimensao: 'dia', serie: 'projeto', medida: 'horas' },
    { nome: 'Gasto por modelo', forma: 'barras', dimensao: 'modelo', serie: 'nenhuma', medida: 'custoApi' },
    { nome: 'Em que dia da semana eu trabalho', forma: 'barras', dimensao: 'semana', serie: 'nenhuma', medida: 'horas' },
    { nome: 'Sobra por projeto', forma: 'barras', dimensao: 'projeto', serie: 'nenhuma', medida: 'sobra' },
    { nome: 'Cache lido por dia e modelo', forma: 'barras', dimensao: 'dia', serie: 'modelo', medida: 'cacheLido' },
  ]

  /** O que está disponível agora, dado o que o Felipe configurou. */
  function indice(estado) {
    const temTaxa = !!estado.temTaxa
    const temAssinatura = !!estado.temAssinatura
    const podeMedir = (m) => ({
      taxa: temTaxa,
      assinatura: temAssinatura,
      'taxa+assinatura': temTaxa && temAssinatura,
    })[m.precisa] ?? true

    const medidas = Object.entries(MEDIDAS)
      .filter(([, m]) => podeMedir(m))
      .map(([id, m]) => ({ id, ...m }))
    const bloqueadas = Object.entries(MEDIDAS)
      .filter(([, m]) => !podeMedir(m))
      .map(([id, m]) => ({ id, rotulo: m.rotulo, precisa: m.precisa }))
    return { medidas, bloqueadas, dimensoes: DIMENSOES, formas: FORMAS }
  }

  const FALTA = {
    taxa: 'defina a taxa em R$ por hora, na aba tempo',
    assinatura: 'defina quanto você paga de assinatura por mês, na aba tempo',
    'taxa+assinatura': 'defina a taxa por hora e o valor da assinatura, na aba tempo',
  }

  /** Uma configuração só é desenhável se dimensão, série e medida convivem. */
  function validar(spec, estado) {
    const medida = MEDIDAS[spec.medida]
    const dim = DIMENSOES[spec.dimensao]
    const serie = DIMENSOES[spec.serie || 'nenhuma']
    const forma = FORMAS[spec.forma]
    if (!medida || !dim || !serie || !forma) return 'configuração incompleta'
    // Sem taxa, "valor" daria zero em toda linha e o gráfico apareceria vazio,
    // como se não houvesse trabalho. Dizer o que falta é a informação útil.
    if (medida.precisa && estado) {
      const disponivel = {
        taxa: estado.temTaxa,
        assinatura: estado.temAssinatura,
        'taxa+assinatura': estado.temTaxa && estado.temAssinatura,
      }[medida.precisa]
      if (!disponivel) return `${medida.rotulo}: ${FALTA[medida.precisa]}`
    }
    if (!dim.fontes.includes(medida.fonte)) {
      return `${dim.rotulo} não existe em ${medida.rotulo} — ${
        medida.fonte === 'tempo'
          ? 'o relógio não sabe qual modelo rodou'
          : 'o uso de token não sabe quanto tempo levou'}`
    }
    if (!serie.fontes.includes(medida.fonte)) return `a série ${serie.rotulo} não existe em ${medida.rotulo}`
    if (forma.exigeDimensao && spec.dimensao !== forma.exigeDimensao) {
      return `${forma.rotulo} só funciona por ${DIMENSOES[forma.exigeDimensao].rotulo}`
    }
    if (forma.exigeCronologica && !dim.cronologica) return `${forma.rotulo} precisa de uma dimensão com ordem no tempo`
    if (!forma.serie && spec.serie && spec.serie !== 'nenhuma') return `${forma.rotulo} não aceita série`
    return null
  }

  // ------------------------------------------------------------- agregação

  /**
   * Vira as duas tabelas de fatos numa matriz dimensão × série.
   * `dados` traz {tempo: [...], uso: [...]} já montados pela página.
   */
  function agregar(spec, dados) {
    const medida = MEDIDAS[spec.medida]
    const dim = DIMENSOES[spec.dimensao]
    const serieDim = DIMENSOES[spec.serie || 'nenhuma']
    const fatos = dados[medida.fonte] || []

    const celulas = new Map()
    const chaves = new Set()
    const series = new Set()
    for (const f of fatos) {
      const k = dim.de(f)
      const s = serieDim.de(f)
      const v = medida.de(f)
      if (!Number.isFinite(v) || (v === 0 && !medida.permiteNegativo)) continue
      chaves.add(k)
      series.add(s)
      const id = k + ' ' + s
      celulas.set(id, (celulas.get(id) || 0) + v)
    }

    const ordenar = (lista, d) => {
      const arr = [...lista]
      if (d.ordem) return arr.sort((a, b) => d.ordem.indexOf(a) - d.ordem.indexOf(b))
      if (d.cronologica) return arr.sort()
      // Sem ordem natural, a maior fatia primeiro: é o que se quer ler.
      const total = (k) => [...series].reduce((a, s) => a + (celulas.get(k + ' ' + s) || 0), 0)
      return arr.sort((a, b) => total(b) - total(a))
    }

    const eixo = ordenar(chaves, dim)
    // Série sempre pela maior soma: a legenda fica na ordem da importância.
    const somaSerie = (s) => eixo.reduce((a, k) => a + (celulas.get(k + ' ' + s) || 0), 0)
    const legenda = [...series].sort((a, b) => somaSerie(b) - somaSerie(a))

    return {
      eixo, legenda, medida, dim, serieDim,
      valor: (k, s) => celulas.get(k + ' ' + s) || 0,
      totalDe: (k) => legenda.reduce((a, s) => a + (celulas.get(k + ' ' + s) || 0), 0),
      total: eixo.reduce((a, k) => a + legenda.reduce((b, s) => b + (celulas.get(k + ' ' + s) || 0), 0), 0),
    }
  }

  // --------------------------------------------------------------- desenho

  // Paleta que sobrevive aos dois temas: nenhuma cor clara demais para o
  // branco nem escura demais para o preto.
  const CORES = [
    '#4da3ff', '#f0a92b', '#3fd07f', '#c47cf5', '#ff7a6b',
    '#4bd6d0', '#e86bb0', '#9db24f', '#8a90ff', '#d99a5a',
  ]
  const cor = (i) => CORES[i % CORES.length]
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const curta = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(k) ? k.slice(8) + '/' + k.slice(5, 7)
    : /^\d{4}-\d{2}$/.test(k) ? k.slice(5) + '/' + k.slice(2, 4) : k)

  function legendaHtml(ag, mostrar) {
    if (!mostrar || ag.legenda.length < 2) return ''
    return `<div class="g-leg">${ag.legenda.map((s, i) =>
      `<span><i style="background:${cor(i)}"></i>${esc(s)}</span>`).join('')}</div>`
  }

  function barras(ag, fmt) {
    const maior = Math.max(...ag.eixo.map((k) => Math.abs(ag.totalDe(k))), 1)
    const negativos = ag.eixo.some((k) => ag.totalDe(k) < 0)
    return `<div class="g-barras${negativos ? ' com-neg' : ''}">
      ${ag.eixo.map((k) => {
        const total = ag.totalDe(k)
        const alt = (Math.abs(total) / maior) * 100
        const pedacos = ag.legenda.map((s, i) => {
          const v = ag.valor(k, s)
          if (!v) return ''
          return `<i style="height:${(Math.abs(v) / Math.abs(total || 1)) * 100}%;background:${cor(i)}"
            title="${esc(s)}: ${fmt(v, ag.medida.fmt)}"></i>`
        }).join('')
        return `<div class="g-col" title="${esc(k)}: ${fmt(total, ag.medida.fmt)}">
          <div class="g-pilha ${total < 0 ? 'neg' : ''}" style="height:${alt}%">${pedacos}</div>
          <span class="g-rot">${esc(curta(k))}</span>
        </div>`
      }).join('')}
    </div>
    <div class="g-escala"><span>0</span><span>${fmt(maior, ag.medida.fmt)}</span></div>`
  }

  function linha(ag, fmt) {
    const L = 620, A = 200, pad = { e: 8, d: 8, c: 8, b: 18 }
    // Acumulado: cada série soma o que veio antes, então a linha só sobe.
    const acumulado = {}
    let teto = 0
    for (const s of ag.legenda) {
      let soma = 0
      acumulado[s] = ag.eixo.map((k) => { soma += ag.valor(k, s); return soma })
      teto = Math.max(teto, soma)
    }
    if (!teto) teto = 1
    const x = (i) => pad.e + (i / Math.max(ag.eixo.length - 1, 1)) * (L - pad.e - pad.d)
    const y = (v) => pad.c + (1 - v / teto) * (A - pad.c - pad.b)

    return `<svg class="g-svg" viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img">
      ${ag.legenda.map((s, i) => {
        const pontos = acumulado[s].map((v, j) => `${x(j)},${y(v)}`).join(' ')
        return `<polyline points="${pontos}" fill="none" stroke="${cor(i)}" stroke-width="2"
          vector-effect="non-scaling-stroke"><title>${esc(s)}: ${fmt(acumulado[s].at(-1), ag.medida.fmt)}</title></polyline>`
      }).join('')}
    </svg>
    <div class="g-escala"><span>${esc(curta(ag.eixo[0] || ''))}</span>
      <span>topo ${fmt(teto, ag.medida.fmt)}</span>
      <span>${esc(curta(ag.eixo.at(-1) || ''))}</span></div>`
  }

  function rosca(ag, fmt) {
    const total = ag.total || 1
    const R = 60, r = 36, C = 2 * Math.PI * ((R + r) / 2), largura = R - r
    let acumulado = 0
    const fatias = ag.eixo.slice(0, 12).map((k, i) => {
      const v = ag.totalDe(k)
      const frac = v / total
      const traco = `${frac * C} ${C}`
      const deslocamento = -acumulado * C
      acumulado += frac
      return `<circle r="${(R + r) / 2}" cx="0" cy="0" fill="none" stroke="${cor(i)}"
        stroke-width="${largura}" stroke-dasharray="${traco}" stroke-dashoffset="${deslocamento}"
        transform="rotate(-90)"><title>${esc(k)}: ${fmt(v, ag.medida.fmt)} (${(frac * 100).toFixed(1)}%)</title></circle>`
    }).join('')
    return `<div class="g-rosca">
      <svg viewBox="-70 -70 140 140" role="img">${fatias}</svg>
      <ol class="g-lista">${ag.eixo.slice(0, 12).map((k, i) => `
        <li><i style="background:${cor(i)}"></i><span class="g-nome">${esc(k)}</span>
          <b>${fmt(ag.totalDe(k), ag.medida.fmt)}</b>
          <span class="g-pct">${((ag.totalDe(k) / total) * 100).toFixed(0)}%</span></li>`).join('')}
      </ol>
    </div>`
  }

  function calendario(ag, fmt) {
    if (!ag.eixo.length) return ''
    const valores = ag.eixo.map((k) => ag.totalDe(k))
    const maior = Math.max(...valores, 1)
    const primeiro = new Date(ag.eixo[0] + 'T12:00:00')
    const ultimo = new Date(ag.eixo.at(-1) + 'T12:00:00')
    // Começa no domingo anterior para as colunas baterem com as semanas.
    primeiro.setDate(primeiro.getDate() - primeiro.getDay())

    const porDia = new Map(ag.eixo.map((k) => [k, ag.totalDe(k)]))
    const semanas = []
    let atual = []
    for (let d = new Date(primeiro); d <= ultimo; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      atual.push({ iso, v: porDia.get(iso) || 0 })
      if (atual.length === 7) { semanas.push(atual); atual = [] }
    }
    if (atual.length) semanas.push(atual)

    return `<div class="g-cal">${semanas.map((sem) => `<div class="g-sem">${sem.map((c) => {
      const int = c.v ? 0.18 + 0.82 * (c.v / maior) : 0
      return `<i class="${c.v ? '' : 'vazio'}" style="${c.v ? `background:${cor(0)};opacity:${int.toFixed(2)}` : ''}"
        title="${c.iso}: ${c.v ? fmt(c.v, ag.medida.fmt) : 'nada'}"></i>`
    }).join('')}</div>`).join('')}</div>
    <div class="g-escala"><span>${esc(ag.eixo[0])}</span>
      <span>maior dia ${fmt(maior, ag.medida.fmt)}</span><span>${esc(ag.eixo.at(-1))}</span></div>`
  }

  function tabela(ag, fmt) {
    const comSerie = ag.legenda.length > 1
    return `<table class="g-tab">
      <tr><th>${esc(ag.dim.rotulo)}</th>
        ${comSerie ? ag.legenda.map((s) => `<th class="num">${esc(s)}</th>`).join('') : ''}
        <th class="num">total</th></tr>
      ${ag.eixo.map((k) => `<tr><td>${esc(k)}</td>
        ${comSerie ? ag.legenda.map((s) => `<td class="num">${ag.valor(k, s) ? fmt(ag.valor(k, s), ag.medida.fmt) : '·'}</td>`).join('') : ''}
        <td class="num forte">${fmt(ag.totalDe(k), ag.medida.fmt)}</td></tr>`).join('')}
    </table>`
  }

  const DESENHO = { barras, linha, rosca, calendario, tabela }

  /** Devolve o HTML do gráfico inteiro, ou uma explicação do porquê não dá. */
  function desenhar(spec, dados, fmt, estado) {
    const erro = validar(spec, estado)
    if (erro) return `<div class="g-erro">${esc(erro)}</div>`
    const ag = agregar(spec, dados)
    if (!ag.eixo.length) return '<div class="g-erro">nenhum dado no período</div>'
    const corpo = DESENHO[spec.forma](ag, fmt)
    return legendaHtml(ag, FORMAS[spec.forma].serie) + corpo
  }

  /** Frase curta do que o gráfico mostra, para o cabeçalho do cartão. */
  function descrever(spec) {
    const m = MEDIDAS[spec.medida]
    const d = DIMENSOES[spec.dimensao]
    const s = DIMENSOES[spec.serie || 'nenhuma']
    if (!m || !d) return ''
    const porSerie = s && spec.serie && spec.serie !== 'nenhuma' ? `, dividido por ${s.rotulo}` : ''
    return `${m.rotulo} por ${d.rotulo}${porSerie}`
  }

  window.CCGraficos = { DIMENSOES, MEDIDAS, FORMAS, PRONTOS, indice, validar, agregar, desenhar, descrever }
})()
