/**
 * CC-280: o armazém da zona inteligente.
 *
 * Pedido dele em 22/08: *"conseguimos criar uma zona inteligente? pra gente
 * conseguir medir coisas legais e ter mais dados pra medir e achar tendências.
 * dados são tudo camarada!"*
 *
 * A ideia foi iterada dez vezes antes de virar código, e o caminho inteiro está
 * em `docs/produto/ZONA-INTELIGENTE.md`. Duas conclusões daquelas rodadas
 * decidem tudo o que este arquivo faz:
 *
 * 1. **Isto não é uma tela, é uma camada que grava.** A primeira ideia era uma
 *    aba nova com gráficos, e ela morreu porque o painel já tem motor de
 *    gráficos: falta matéria-prima, não vitrine.
 * 2. **Hoje o dado morre.** O Claude Code apaga trabalho antigo sozinho, e o
 *    transcrito é relido do zero a cada vez. Sem série gravada não existe
 *    tendência, só fotografia.
 *
 * ## O formato, e por que é append-only
 *
 * Uma linha por registro, em JSONL, com a chave `dia` + `projeto` + `medida`.
 * Regravar o mesmo dia acrescenta uma linha nova, e a leitura fica com a
 * última.
 *
 * A alternativa era um JSON único reescrito a cada gravação, e ela foi
 * descartada pela lição de 09/08, quando as notas dele amanheceram vazias sem
 * que ninguém conseguisse provar quem tinha gravado. **Quem só acrescenta nunca
 * perde o que já estava lá**, mesmo que o processo morra no meio da escrita:
 * uma linha truncada é uma linha ignorada na leitura, e não um arquivo perdido.
 *
 * O preço é o arquivo crescer, e `compactar()` existe para isso. Ele é
 * explícito, nunca automático, porque compactação é a única operação aqui que
 * pode perder dado.
 *
 * ## O que este módulo NÃO faz
 *
 * Não coleta nada. Quem sabe produzir número é o coletor, e ele mora fora
 * (`src/coletores.mjs`). Este arquivo só sabe guardar, devolver e comparar com
 * a média das semanas anteriores.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

export const ARQUIVO = () => path.join(casaClaude(), 'control-center-armazem.jsonl')

/* O mesmo abrigo dos outros módulos: dentro do sandbox do Claude Code
   `~/.claude` fica somente leitura, e sem isto o armazém nasceria mudo em
   metade das sessões. Respeita `CC_HOME`, que é o que isola o teste do dado
   real dele. */
export const ARQUIVO_ABRIGO = () => path.join(
  path.dirname(DIR_SESSOES_ABRIGO()), 'control-center-armazem.jsonl',
)

const ARQUIVOS = () => [ARQUIVO(), ARQUIVO_ABRIGO()]

export const hojeISO = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** A chave que define "o mesmo registro". Dois com a mesma chave, o último vale. */
export const chaveDe = (r) => `${r.dia}|${r.projeto || ''}|${r.medida}`

/**
 * Acrescenta registros.
 *
 * Tenta a casa e cai no abrigo, nesta ordem, e **não lança**: armazém que
 * derruba o painel por não conseguir gravar seria pior que armazém vazio. O
 * retorno diz onde escreveu, para quem chamou saber se caiu no abrigo.
 */
export function gravar(registros = []) {
  const lista = (Array.isArray(registros) ? registros : [registros]).filter(
    (r) => r && r.dia && r.medida && Number.isFinite(Number(r.valor)),
  )
  if (!lista.length) return { ok: true, gravados: 0, onde: null }

  const em = new Date().toISOString()
  const texto = lista.map((r) => JSON.stringify({
    dia: r.dia,
    projeto: r.projeto || null,
    medida: r.medida,
    valor: Number(r.valor),
    /* `de` diz qual coletor produziu o número. Sem isso, dois coletores
       medindo a mesma coisa por caminhos diferentes ficam indistinguíveis, e
       descobrir qual dos dois está errado vira arqueologia. */
    de: r.de || null,
    em,
  })).join('\n') + '\n'

  for (const arq of ARQUIVOS()) {
    try {
      fs.mkdirSync(path.dirname(arq), { recursive: true })
      fs.appendFileSync(arq, texto, 'utf8')
      return { ok: true, gravados: lista.length, onde: arq }
    } catch { /* tenta o próximo */ }
  }
  return { ok: false, gravados: 0, onde: null, erro: 'nenhum lugar gravável' }
}

/**
 * Todos os registros, já resolvidos: mesma chave, o último ganha.
 *
 * Linha corrompida é pulada em silêncio de propósito. Num arquivo append-only
 * que pode ser cortado por um processo morto no meio da escrita, a última linha
 * truncada é o caso NORMAL, não uma anomalia que mereça erro.
 */
export function ler({ desde = null, ate = null, projeto = null, medida = null } = {}) {
  const porChave = new Map()
  for (const arq of ARQUIVOS()) {
    let bruto = ''
    try { bruto = fs.readFileSync(arq, 'utf8') } catch { continue }
    for (const linha of bruto.split('\n')) {
      if (!linha.trim()) continue
      let r
      try { r = JSON.parse(linha) } catch { continue }
      if (!r?.dia || !r?.medida) continue
      porChave.set(chaveDe(r), r)
    }
  }
  let saida = [...porChave.values()]
  if (desde) saida = saida.filter((r) => r.dia >= desde)
  if (ate) saida = saida.filter((r) => r.dia <= ate)
  if (projeto) saida = saida.filter((r) => r.projeto === projeto)
  if (medida) saida = saida.filter((r) => r.medida === medida)
  return saida.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0))
}

/** Quais medidas existem, com quantos dias e quais projetos cada uma cobre. */
export function medidas() {
  const mapa = new Map()
  for (const r of ler()) {
    if (!mapa.has(r.medida)) mapa.set(r.medida, { medida: r.medida, dias: new Set(), projetos: new Set() })
    const m = mapa.get(r.medida)
    m.dias.add(r.dia)
    if (r.projeto) m.projetos.add(r.projeto)
  }
  return [...mapa.values()]
    .map((m) => ({
      medida: m.medida,
      dias: m.dias.size,
      projetos: [...m.projetos].sort(),
      primeiro: [...m.dias].sort()[0] || null,
      ultimo: [...m.dias].sort().slice(-1)[0] || null,
    }))
    .sort((a, b) => a.medida.localeCompare(b.medida))
}

/**
 * Uma medida ao longo do tempo.
 *
 * Sem `projeto`, soma todos os projetos daquele dia. Com `projeto: '*'`, devolve
 * separado por projeto, que é o cruzamento da nona rodada: a régua útil não é o
 * mundo lá fora, é um projeto dele contra o outro.
 */
export function serie(medida, { projeto = null, desde = null, ate = null } = {}) {
  const regs = ler({ medida, desde, ate, projeto: projeto === '*' ? null : projeto })
  if (projeto === '*') {
    const porProjeto = new Map()
    for (const r of regs) {
      const k = r.projeto || '(sem projeto)'
      if (!porProjeto.has(k)) porProjeto.set(k, [])
      porProjeto.get(k).push({ dia: r.dia, valor: r.valor })
    }
    return [...porProjeto.entries()]
      .map(([p, pontos]) => ({ projeto: p, pontos, total: pontos.reduce((s, x) => s + x.valor, 0) }))
      .sort((a, b) => b.total - a.total)
  }
  const porDia = new Map()
  for (const r of regs) porDia.set(r.dia, (porDia.get(r.dia) || 0) + r.valor)
  return [...porDia.entries()].map(([dia, valor]) => ({ dia, valor })).sort((a, b) => (a.dia < b.dia ? -1 : 1))
}

const media = (ns) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0)

/**
 * O valor de hoje contra a base das semanas anteriores.
 *
 * É a quarta rodada da iteração, e a mais importante delas: **número solto não
 * é tendência**. "319 ferramentas falharam" não diz se é muito, se está
 * piorando, nem se aconteceu tudo num dia só.
 *
 * `fora` só é verdadeiro com base suficiente. Um desvio calculado sobre dois
 * dias de história diria "fora da faixa" toda semana, e alarme que sempre toca
 * é alarme que se aprende a ignorar. É a mesma lição da guarda que cobrava o
 * impossível: cobrança que não dá para atender ensina a passar por cima.
 */
export function faixa(medida, { projeto = null, dia = hojeISO(), semanas = 4, minimo = 7 } = {}) {
  const pontos = serie(medida, { projeto })
  const hoje = pontos.find((p) => p.dia === dia)
  const base = pontos.filter((p) => p.dia < dia).slice(-(semanas * 7))
  /* O retorno tem SEMPRE a mesma forma, com ou sem base. A primeira versão
     devolvia um objeto curto quando não havia história, e `fora` chegava
     indefinido em quem consultasse: um `if (f.fora)` passa reto, e um
     `f.fora === false` falha, para a mesma situação. Campo ausente e campo
     falso são coisas diferentes, e confundir os dois é a família de defeito
     mais cara deste painel. */
  const ns = base.map((p) => p.valor)
  const m = media(ns)
  const desvio = ns.length ? Math.sqrt(media(ns.map((n) => (n - m) ** 2))) : 0
  const valor = hoje?.valor ?? null
  const suficiente = base.length >= minimo
  /* Dois desvios: a faixa onde ~95% das observações caem quando nada mudou.
     Com desvio zero (série constante), qualquer valor diferente é notícia. */
  const limite = desvio > 0 ? 2 * desvio : 0
  const fora = suficiente && valor !== null && Math.abs(valor - m) > limite

  return {
    medida,
    projeto,
    dia,
    valor,
    media: Number(m.toFixed(2)),
    desvio: Number(desvio.toFixed(2)),
    base: base.length,
    suficiente,
    fora,
    direcao: valor === null ? null : valor > m ? 'acima' : valor < m ? 'abaixo' : 'igual',
  }
}

/**
 * A oitava conclusão: o mesmo dado sai em CSV, para fora do cockpit.
 *
 * Ele pediu outros formatos, e planilha é o formato que qualquer ferramenta
 * abre sem pedir licença.
 */
export function paraCSV(registros = ler()) {
  const linhas = ['dia,projeto,medida,valor,de']
  for (const r of registros) {
    const campo = (v) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    linhas.push([r.dia, r.projeto, r.medida, r.valor, r.de].map(campo).join(','))
  }
  return linhas.join('\n')
}

/**
 * Reescreve o arquivo sem as linhas já superadas.
 *
 * **Explícito, nunca automático.** É a única operação deste módulo que pode
 * perder dado, e por isso guarda uma cópia antes, como as notas fazem desde
 * 09/08. Escrita atômica (temporário e rename), senão uma queda no meio deixa
 * o armazém pela metade justamente na operação que apaga.
 */
export function compactar() {
  const vivos = ler()
  const antes = ARQUIVOS().reduce((s, a) => {
    try { return s + fs.readFileSync(a, 'utf8').split('\n').filter(Boolean).length } catch { return s }
  }, 0)

  const texto = vivos.map((r) => JSON.stringify(r)).join('\n') + (vivos.length ? '\n' : '')
  let onde = null
  for (const arq of ARQUIVOS()) {
    try {
      if (!fs.existsSync(arq)) continue
      fs.copyFileSync(arq, `${arq}.bak`)
      const tmp = `${arq}.tmp`
      fs.writeFileSync(tmp, onde ? '' : texto, 'utf8')
      fs.renameSync(tmp, arq)
      /* O conteúdo inteiro vai para o PRIMEIRO arquivo que existe, e os
         demais ficam vazios. Escrever nos dois duplicaria a leitura, que funde
         casa e abrigo. */
      onde = onde || arq
    } catch { /* segue */ }
  }
  return { ok: true, antes, depois: vivos.length, removidas: Math.max(0, antes - vivos.length), onde }
}

/**
 * CC-282: duas medidas na mesma linha, pela chave projeto mais dia.
 *
 * É a quinta rodada da iteração, e a parte que ele chamou de legal. O cockpit
 * mede **esforço** (hora, token, ferramenta usada) e o git mede **resultado**
 * (commit, arquivo, linha). Separados, nenhum dos dois responde nada que
 * interesse. Juntos aparecem "quanto custou um commit" e "quanto trabalho virou
 * entrega".
 *
 * `por` decide o grão: `'projeto'` responde qual projeto sai mais caro, `'dia'`
 * responde se a semana está melhorando.
 *
 * **Só entra quem tem os dois lados.** Dia com esforço e sem commit, ou o
 * contrário, fica de fora e é contado em `sozinhos`. Dividir por zero daria
 * infinito, e pior: incluir com zero faria a razão despencar por um dia em que
 * ninguém trabalhou, o que leria como piora sem nada ter piorado.
 */
export function cruzar(medidaA, medidaB, { por = 'projeto', desde = null, ate = null } = {}) {
  const regsA = ler({ medida: medidaA, desde, ate })
  const regsB = ler({ medida: medidaB, desde, ate })

  /* A interseção é por PROJETO E DIA, e isto não é preciosismo: sem ela o
     cruzamento mente com confiança.
     Medido em 22/08, na primeira versão: `app_maurice` apareceu com 51 commits
     e zero ferramentas, e `proj_carzo` com 0,05 ferramenta por commit. Os dois
     números eram falsos pelo mesmo motivo. O git guarda anos de história e o
     transcrito da VPS só existe desde 13/08, então a conta dividia o trabalho
     de nove dias pelos commits de vinte e oito.
     Comparar só onde os dois lados enxergam o mesmo dia é a única forma de a
     razão querer dizer alguma coisa. */
  const parA = new Map(regsA.map((r) => [`${r.projeto || ''}|${r.dia}`, r]))
  const comuns = regsB.filter((r) => parA.has(`${r.projeto || ''}|${r.dia}`))
  const chavesComuns = new Set(comuns.map((r) => `${r.projeto || ''}|${r.dia}`))

  const chave = (r) => (por === 'dia' ? r.dia : (r.projeto || '(sem projeto)'))
  const somar = (regs) => {
    const m = new Map()
    for (const r of regs) {
      if (!chavesComuns.has(`${r.projeto || ''}|${r.dia}`)) continue
      m.set(chave(r), (m.get(chave(r)) || 0) + r.valor)
    }
    return m
  }
  const a = somar(regsA)
  const b = somar(comuns)

  const linhas = []
  for (const [k, va] of a) {
    const vb = b.get(k)
    /* Dividir por zero daria infinito, e incluir com zero faria a razão
       despencar por um dia em que ninguém commitou, o que leria como piora sem
       nada ter piorado. */
    if (!vb) continue
    linhas.push({ chave: k, a: va, b: vb, razao: Number((va / vb).toFixed(2)) })
  }

  /* Quantos pares (projeto, dia) cada lado tinha sozinho. É o número que
     explica um cruzamento magro, em vez de deixar a tela parecer vazia sem
     motivo: bloco que pode ficar vazio precisa dizer por quê. */
  const sozinhos = (regsA.length - chavesComuns.size) + (regsB.length - chavesComuns.size)

  return {
    medidaA, medidaB, por,
    linhas: linhas.sort((x, y) => y.razao - x.razao),
    diasComuns: chavesComuns.size,
    sozinhos: Math.max(0, sozinhos),
    /* A mediana das razões, não a média: um projeto de um commit só distorce a
       média e não distorce a mediana. É a mesma escolha da duração típica. */
    tipico: linhas.length
      ? linhas.map((l) => l.razao).sort((x, y) => x - y)[Math.floor(linhas.length / 2)]
      : null,
  }
}

/* ── CC-288: o grão do tempo ────────────────────────────────────────────────
 *
 * Pedido dele em 22/08: *"ver por semana, mês, ano"*. Um ano em grão de dia são
 * 365 barras de um pixel, que não se lê.
 *
 * **A soma não é a mesma conta para toda medida**, e é aqui que se erra fácil:
 * contagem soma (dez interrupções na segunda mais cinco na terça são quinze na
 * semana), mas mediana não. Somar sete medianas de duração daria um número que
 * não existe em lugar nenhum. Por isso cada medida declara como se agrega, e o
 * padrão é somar apenas porque a maioria conta coisas.
 */

/** Segunda-feira da semana daquele dia, em texto. Semana começa na segunda. */
function segundaDe(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  /* getUTCDay: domingo é 0. Recuar (dia+6)%7 leva qualquer dia à segunda
     anterior, inclusive o domingo, que pertence à semana que começou seis dias
     antes e não à que começa amanhã. */
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7))
  return dt.toISOString().slice(0, 10)
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** A chave e o rótulo de um dia, no grão pedido. */
export function balde(iso, grao = 'dia') {
  const [a, m, d] = iso.split('-')
  if (grao === 'ano') return { chave: a, rotulo: a }
  if (grao === 'mes') return { chave: `${a}-${m}`, rotulo: `${MESES[Number(m) - 1]} de ${a}` }
  if (grao === 'semana') {
    const seg = segundaDe(iso)
    const [sa, sm, sd] = seg.split('-')
    const fim = new Date(Date.UTC(Number(sa), Number(sm) - 1, Number(sd) + 6)).toISOString().slice(0, 10)
    const [, fm, fd] = fim.split('-')
    return { chave: seg, rotulo: `${sd}/${sm} a ${fd}/${fm}` }
  }
  return { chave: iso, rotulo: `${d}/${m}` }
}

/**
 * Junta pontos diários no grão pedido.
 *
 * `modo` é `'soma'` ou `'media'`. Medida que já é um resumo (a duração típica é
 * uma mediana) precisa de `'media'`: somar resumos produz um número sem
 * significado, e ele apareceria enorme na tela sem nada denunciando.
 */
export function agregar(pontos = [], grao = 'dia', modo = 'soma') {
  if (grao === 'dia') return pontos.map((p) => ({ ...p, ...balde(p.dia, 'dia'), n: 1 }))
  const mapa = new Map()
  for (const p of pontos) {
    const b = balde(p.dia, grao)
    if (!mapa.has(b.chave)) mapa.set(b.chave, { ...b, dia: b.chave, valor: 0, n: 0, de: p.dia, ate: p.dia })
    const x = mapa.get(b.chave)
    x.valor += p.valor
    x.n += 1
    if (p.dia < x.de) x.de = p.dia
    if (p.dia > x.ate) x.ate = p.dia
  }
  const saida = [...mapa.values()].sort((a, b) => (a.chave < b.chave ? -1 : 1))
  if (modo === 'media') for (const x of saida) x.valor = Number((x.valor / Math.max(1, x.n)).toFixed(1))
  return saida
}

/* ── CC-290: a leitura de tendência, no vocabulário que ele nomeou ──────────
 *
 * Palavras dele: *"em forma de ondas poder tratar como curvas de tendências,
 * como em daytrade"*.
 *
 * Quem olha gráfico de mercado lê três coisas ao mesmo tempo: a linha, uma
 * média que alisa o ruído, e um canal em volta que diz o que é normal. As três
 * já existem aqui, só nunca foram desenhadas juntas: o canal é exatamente a
 * conta que o alarme faz (média mais ou menos dois desvios), agora calculada em
 * cada ponto em vez de só no último.
 */

/** Média móvel simples. Os primeiros pontos usam a janela que existe. */
export function mediaMovel(pontos = [], janela = 7) {
  return pontos.map((p, i) => {
    const fatia = pontos.slice(Math.max(0, i - janela + 1), i + 1).map((x) => x.valor)
    return { dia: p.dia, valor: Number((fatia.reduce((s, n) => s + n, 0) / fatia.length).toFixed(2)) }
  })
}

/**
 * O canal do normal, ponto a ponto.
 *
 * Cada ponto é comparado com a janela ANTERIOR a ele, nunca com uma janela que
 * o inclui: um pico que entra no próprio cálculo alarga a banda que deveria
 * denunciá-lo, e o desenho passa a esconder justamente o que ele existe para
 * mostrar.
 */
export function canal(pontos = [], janela = 14) {
  return pontos.map((p, i) => {
    const antes = pontos.slice(Math.max(0, i - janela), i).map((x) => x.valor)
    if (antes.length < 3) return { dia: p.dia, valor: p.valor, centro: null, alto: null, baixo: null, fora: false }
    const m = antes.reduce((s, n) => s + n, 0) / antes.length
    const dp = Math.sqrt(antes.reduce((s, n) => s + (n - m) ** 2, 0) / antes.length)
    const alto = m + 2 * dp
    const baixo = Math.max(0, m - 2 * dp)
    return {
      dia: p.dia,
      valor: p.valor,
      centro: Number(m.toFixed(2)),
      alto: Number(alto.toFixed(2)),
      baixo: Number(baixo.toFixed(2)),
      fora: dp > 0 && (p.valor > alto || p.valor < baixo),
    }
  })
}
