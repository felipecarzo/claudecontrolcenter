// CC-899: a medida de capacidade de um projeto, por semana (segunda a domingo).
// Só a parte de capacidade; o resto do sprint entra nas outras peças.
//
// Tokens: saída mais escrita de cache. NUNCA a leitura de cache, que é quase
// todo o volume e não mede esforço. As horas dele (atenção) não têm medida:
// vão marcadas como "aberto", não inventadas.

import fs from 'node:fs'
import path from 'node:path'
import { resumo } from './tempo.mjs'
import { projectOf } from './jobs.mjs'
import * as B from './backlog.mjs'
import { custosDoProjeto } from './custoItem.mjs'
import { lerConversa } from './gate.mjs'
import { readUso, lerHistorico, gastoPorSemana } from './uso.mjs'
import { nomeDe, itemDoCaminho, secaoGuardada } from './caminho.mjs'
import * as P from './produto.mjs'
import { comDataReal } from './dataReal.mjs'
import { artefatosDoSprint } from './artefatos.mjs'

export const tokensUteis = (u) => (u?.output || 0) + (u?.escrita5m || 0) + (u?.escrita1h || 0)

const dia = (d) => d.toLocaleDateString('sv') // YYYY-MM-DD, no relógio local
const mediana = (v) => {
  if (!v.length) return 0
  const o = [...v].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

export function capacidade(raiz, { agora = Date.now(), semanas = 4, resumoFn = resumo } = {}) {
  const projeto = projectOf(raiz).project
  const hoje = new Date(agora)
  const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - ((hoje.getDay() + 6) % 7))
  const lista = []
  for (let i = semanas - 1; i >= 0; i--) {
    const ini = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() - 7 * i)
    const fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6)
    lista.push({ de: dia(ini), ate: dia(fim), tokens: 0, horasAgente: 0, diasAtivos: 0 })
  }
  const r = resumoFn({ de: lista[0].de, ate: lista[lista.length - 1].ate })
  const p = (r?.projetos || []).find((x) => x.projeto === projeto)
  const semanaDe = (d) => lista.find((s) => d >= s.de && d <= s.ate)
  for (const u of p?.usoDias || []) {
    const s = semanaDe(u.dia)
    if (s) s.tokens += tokensUteis(u)
  }
  for (const d of p?.dias || []) {
    const s = semanaDe(d.dia)
    if (s && d.ativoMs > 0) { s.horasAgente += d.ativoMs / 36e5; s.diasAtivos++ }
  }
  const horas = lista.reduce((a, s) => a + s.horasAgente, 0)
  const dias = lista.reduce((a, s) => a + s.diasAtivos, 0)
  return {
    projeto,
    semanas: lista,
    horasPorDiaAtivo: dias ? horas / dias : 0,
    tokensPorSemanaMediana: mediana(lista.filter((s) => s.tokens > 0).map((s) => s.tokens)),
    horasDele: 'aberto', // D17: atenção dele não tem medida
  }
}

/* ===================================================================
   CC-901 (C2 a C4): o sprint líquido. Por projeto, 7 dias corridos como teto de
   tempo, a semana começando no reset semanal do plano. O orçamento de tokens
   continua EM ABERTO por decisão dele: o código mede e mostra, nunca corta pelo
   limite. O gasto do PC não entra; só o desta máquina (a VPS), e os rótulos
   dizem isso.
   =================================================================== */

// ponytail: pesos fixos até haver 5 medidas por tamanho; depois a mediana medida manda
export const PONTOS = { P: 1, M: 3, G: 8 }
const DIA = 864e5
const SEMANA = 7 * DIA
const TAMANHOS_ORDEM = ['P', 'M', 'G']
const pontosDe = (i) => PONTOS[i.tamanho] ?? PONTOS.M
const msDe = (iso) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null }
const isoDe = (ms) => new Date(ms).toISOString()
const ddmm = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/** O custo de cada item pai, em tokens, pelo que o robô gastou nas micro tarefas fechadas. */
export function custosDoRobo(itens, lerMensagens = (id) => lerConversa(id)?.mensagens || []) {
  const por = new Map()
  for (const i of itens) {
    if (!i.pai || i.estado !== 'OK' || !i.conversa) continue
    let t = 0
    // ponytail: a cauda do log do gate pode cortar conversa longa; a previsão só vira tokens com 5 amostras
    for (const m of lerMensagens(i.conversa) || []) if (m.de === 'claude') t += (m.custo?.saida || 0) + (m.custo?.cacheCriado || 0)
    if (t > 0) por.set(i.pai, (por.get(i.pai) || 0) + t)
  }
  return por
}

/** A mediana de tokens por tamanho, só com 5 ou mais amostras. Fonte 'medido' só quando os três tamanhos têm. */
export function previsao(itens, custosMedidos) {
  const out = {}
  for (const t of TAMANHOS_ORDEM) {
    const v = itens.filter((i) => !i.pai && i.estado === 'OK' && i.tamanho === t && custosMedidos.get(i.id) > 0).map((i) => custosMedidos.get(i.id))
    out[t] = { tokens: v.length >= 5 ? Math.round(mediana(v)) : null, n: v.length }
  }
  out.fonte = TAMANHOS_ORDEM.every((t) => out[t].tokens) ? 'medido' : 'pontos'
  return out
}

/** A janela de 7 dias corridos que contém `agora`. Âncora: a hora do reset semanal do plano; sem ela, segunda 00:00 local. */
export function janelaDe(agora, ancora = null) {
  if (Number.isFinite(ancora) && ancora > 0) {
    const de = ancora + Math.floor((agora - ancora) / SEMANA) * SEMANA
    return { de, ate: de + SEMANA }
  }
  const h = new Date(agora)
  const seg = h.getDate() - ((h.getDay() + 6) % 7)
  return { de: new Date(h.getFullYear(), h.getMonth(), seg).getTime(), ate: new Date(h.getFullYear(), h.getMonth(), seg + 7).getTime() }
}

const tops = (itens) => itens.filter((i) => !i.pai && i.estado === 'OK' && !i.semData && msDe(i.fechado) != null)

/** Pontos fechados por janela (só itens sem pai); mediana das últimas 4 janelas com trabalho. Sem histórico, 10. */
export function velocidade(itens, janelas = []) {
  const fechados = tops(itens)
  const por = janelas.map((j) => fechados.filter((i) => { const f = msDe(i.fechado); return f >= j.de && f < j.ate }).reduce((s, i) => s + pontosDe(i), 0)).filter((p) => p > 0)
  // ponytail: o fechamento em lote infla a semana; a mediana de 4 janelas amortece
  const ult = por.slice(-4)
  return ult.length ? mediana(ult) : 10
}

/** Percorre a fila na ordem somando o custo; para quando o próximo não cabe. O primeiro sempre entra. */
export function escolher(fila, { capacidade, custoDe }) {
  const out = []; let soma = 0
  for (const i of fila) {
    const c = custoDe(i)
    if (out.length && soma + c > capacidade) break
    out.push(i); soma += c
  }
  return out
}

/** A parte do mapa (frente) com mais pontos no sprint, ou null sem mapa ou sem item que caia nele. */
export function metaDoSprint(itensDoSprint, produto) {
  const partes = new Set((produto?.partes || []).map((p) => p.codigo))
  const soma = {}
  for (const i of itensDoSprint) if (partes.has(i.frente)) soma[i.frente] = (soma[i.frente] || 0) + pontosDe(i)
  let melhor = null
  for (const [k, v] of Object.entries(soma)) if (melhor === null || v > soma[melhor]) melhor = k
  return melhor
}

/** CC-958: a fila aberta na ordem da fila mista (a mesma conta do agente), com a micro tarefa voltando para o pai. */
function filaAberta(itens, sprint = new Set()) {
  const f = B.filaDoAgente(itens, { sprint })
  const ordem = B.ordemDaFila(itens, { sprint })
  const porId = new Map(itens.map((i) => [i.id, i]))
  const vistos = new Set(); const out = []
  for (const x of [...f.sozinho, ...f.semEspec, ...f.dele].sort(ordem)) {
    const alvo = (x.pai && porId.get(x.pai)) || x
    if (!vistos.has(alvo.id)) { vistos.add(alvo.id); out.push(alvo) }
  }
  return out
}

const mesmaJanela = (row, w) => Math.abs(Date.parse(row.de) - w.de) < DIA

export function montar(itens, { agora, ancora = null, previsao: prev, capacidade: cap, gravados = [], produto = null, custos = new Map() }) {
  const cur = janelaDe(agora, ancora)
  const tokens = prev.fonte === 'medido'
  const custoDe = tokens ? (i) => prev[i.tamanho]?.tokens ?? prev.M.tokens : pontosDe
  const previstoDe = (lista) => ({ pontos: lista.reduce((s, i) => s + pontosDe(i), 0), tokens: tokens ? lista.reduce((s, i) => s + custoDe(i), 0) : null })
  const abrirs = gravados.filter((g) => g.tipo === 'abrir'); const fechars = gravados.filter((g) => g.tipo === 'fechar')
  const porId = new Map(itens.map((i) => [i.id, i]))
  // janelas que já tiveram trabalho fechado, antes da atual
  const fechadosPor = new Map()
  for (const i of tops(itens)) {
    const w = janelaDe(msDe(i.fechado), ancora)
    if (!fechadosPor.has(w.de)) fechadosPor.set(w.de, { w, lista: [] })
    fechadosPor.get(w.de).lista.push(i)
  }
  const base = Math.min(cur.de, ...[...fechadosPor.keys()], ...abrirs.map((g) => Date.parse(g.de)).filter(Number.isFinite))
  const numero = (w) => Math.round((w.de - base) / SEMANA) + 1
  const info = (w, lista, row, fechar, estado) => ({
    n: numero(w), de: w.de, ate: w.ate, estado, itens: lista, // CC-937: o número sai da janela; a linha gravada só empresta previsto, gasto e meta
    previsto: row?.previsto || (estado === 'passado' ? null : previstoDe(lista)),
    gasto: fechar?.gasto || null, fonte: row?.fonte || (tokens ? 'medido' : 'pontos'),
    meta: row?.meta ?? metaDoSprint(lista, produto),
  })
  // passados: o que fechou em cada janela anterior; a linha `abrir` empresta o previsto
  const passados = [...fechadosPor.values()].filter((x) => x.w.de < cur.de).sort((a, b) => a.w.de - b.w.de).map(({ w, lista }) => {
    const row = abrirs.find((g) => mesmaJanela(g, w)); const fechar = row && fechars.find((g) => g.n === row.n)
    return info(w, lista, row, fechar, 'passado')
  })
  // atual: o compromisso gravado, ou a escolha da fila; o que já fechou nesta janela entra sempre
  const feitosAgora = fechadosPor.get(cur.de)?.lista || []
  const rowAtual = abrirs.find((g) => mesmaJanela(g, cur))
  const fila = filaAberta(itens, new Set(rowAtual?.itens || []))
  // CC-958: o lugar escolhido por ele vence a linha gravada; fim do backlog vira trecho próprio, depois dos previstos
  const L = (i) => (B.estaAberto(i) ? B.lugarDe(i) : null)
  const fimDoBacklog = fila.filter((i) => L(i) === 'backlog')
  const filaSem = fila.filter((i) => L(i) !== 'backlog')
  let doAtual
  if (rowAtual) doAtual = (rowAtual.itens || []).map((id) => porId.get(id)).filter(Boolean)
  else {
    const gasto = feitosAgora.reduce((s, i) => s + custoDe(i), 0)
    doAtual = [...feitosAgora, ...(cap - gasto > 0 || !feitosAgora.length ? escolher(filaSem, { capacidade: cap - gasto, custoDe }) : [])]
  }
  for (const i of feitosAgora) if (!doAtual.includes(i)) doAtual.push(i)
  // CC-958: andando, agora, fim do dia e fim do sprint estão no sprint atual; fim do backlog e fora do MVP saem dele
  doAtual = doAtual.filter((i) => !['backlog', 'fora'].includes(L(i)))
  for (const i of filaSem) if ((i.estado === 'EM' || ['agora', 'dia', 'sprint'].includes(L(i))) && !doAtual.includes(i)) doAtual.push(i)
  // ponytail: o que entra pelo lugar não está na linha `abrir`, então o fechamento preguiçoso não soma o gasto dele
  const atual = info(cur, doAtual, rowAtual, null, 'atual')
  // previstos: o resto da fila em blocos de capacidade, no máximo 6
  const usados = new Set(doAtual.map((i) => i.id))
  let resto = filaSem.filter((i) => !usados.has(i.id)); const previstos = []
  for (let k = 1; k <= 6 && resto.length; k++) {
    const bloco = escolher(resto, { capacidade: cap, custoDe }); resto = resto.slice(bloco.length)
    const w = { de: cur.de + k * SEMANA, ate: cur.ate + k * SEMANA }
    previstos.push({ ...info(w, bloco, null, null, 'previsto'), n: atual.n + k })
  }
  return { passados, atual, previstos, fimDoBacklog, ordem: fila, custos }
}

/* ---- o diário do sprint: docs/sprints.jsonl, só por acréscimo ---- */
export const arquivoDeSprints = (raiz) => path.join(raiz, 'docs', 'sprints.jsonl')
function lerGravados(arq) {
  let t = ''; try { t = fs.readFileSync(arq, 'utf8') } catch { return [] }
  return t.split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
}

/**
 * O Caminho em sprints, no MESMO formato de `caminhoDe`. Cada trecho é um sprint.
 * O ciclo é preguiçoso: ler sem achar a linha `abrir` da janela atual grava ela,
 * e achar a janela anterior sem `fechar` grava o fechamento. Falha de gravação
 * não é engolida: vai para o stderr e para `avisoGravacao` na resposta.
 */
export function caminhoPorSprint(raiz, agora = Date.now(), opcoes = {}) {
  const { gravar = true, produto = P.ler(raiz), lerMensagens, resumoFn } = opcoes
  const ancora = opcoes.ancora === undefined ? (readUso()?.semana?.resetaEm ?? null) : opcoes.ancora
  const arquivo = B.caminhoPadrao(raiz)
  const lido = B.ler(arquivo); const existe = lido.existe
  const itens = existe ? comDataReal(raiz, lido.itens) : []
  if (!existe) return { ok: false, erro: 'este projeto ainda não tem backlog' }
  const custos = new Map(custosDoProjeto(arquivo))
  for (const [id, t] of custosDoRobo(itens, lerMensagens)) custos.set(id, (custos.get(id) || 0) + t)
  let prev = previsao(itens, custos)
  const cur = janelaDe(agora, ancora)
  const anteriores = []; for (let k = 8; k >= 1; k--) anteriores.push(janelaDe(cur.de - 1 - (k - 1) * SEMANA, ancora))
  let cap = velocidade(itens, anteriores)
  if (prev.fonte === 'medido') {
    const t = capacidade(raiz, { agora, resumoFn }).tokensPorSemanaMediana
    if (t > 0) cap = t; else prev = { ...prev, fonte: 'pontos' }
  }
  const arq = arquivoDeSprints(raiz)
  const gravados = lerGravados(arq)
  const novas = []
  // fechamento preguiçoso: janela que já acabou, com `abrir` e sem `fechar`
  for (const g of gravados.filter((x) => x.tipo === 'abrir')) {
    if (Date.parse(g.ate) > agora || gravados.some((x) => x.tipo === 'fechar' && x.n === g.n)) continue
    const feitos = (g.itens || []).filter((id) => { const i = itens.find((x) => x.id === id); return i?.estado === 'OK' && msDe(i.fechado) < Date.parse(g.ate) })
    const tk = feitos.reduce((s, id) => s + (custos.get(id) || 0), 0)
    novas.push({ tipo: 'fechar', n: g.n, em: isoDe(Date.parse(g.ate)), feitos, gasto: { tokens: tk || null, pct: null } })
  }
  const todos = [...gravados, ...novas]
  const m = montar(itens, { agora, ancora, previsao: prev, capacidade: cap, gravados: todos, produto, custos })
  if (m.atual.itens.length && !gravados.some((g) => g.tipo === 'abrir' && mesmaJanela(g, cur))) {
    novas.push({ tipo: 'abrir', n: m.atual.n, de: isoDe(m.atual.de), ate: isoDe(m.atual.ate), itens: m.atual.itens.map((i) => i.id), previsto: m.atual.previsto, fonte: m.atual.fonte, meta: m.atual.meta })
  }
  let avisoGravacao = null
  if (gravar && novas.length) {
    try { fs.appendFileSync(arq, novas.map((r) => JSON.stringify(r) + '\n').join('')) } catch (e) {
      avisoGravacao = `não consegui gravar ${arq}: ${e.message}`
      console.error('[sprint] ' + avisoGravacao)
    }
  }
  const nomeParte = (c) => (produto?.partes || []).find((p) => p.codigo === c)?.nome || c
  const aberto = (i) => i.estado !== 'OK' && i.estado !== 'KO'
  // CC-958: o aberto aparece na ordem da fila (a mesma do agente); o fechado, o mais recente primeiro
  const pos = new Map(m.ordem.map((i, k) => [i.id, k]))
  const naFila = (l) => [...l].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9) || String(b.mexido || '').localeCompare(String(a.mexido || '')))
  const trecho = (s) => {
    const vivos = s.itens.filter((i) => i.estado !== 'KO')
    const feitos = vivos.filter((i) => i.estado === 'OK'); const abertos = vivos.filter(aberto)
    const andando = abertos.filter((i) => i.estado === 'EM' || i.estado === 'PR')
    const recentes = (l) => [...l].sort((a, b) => String(b.mexido || '').localeCompare(String(a.mexido || '')))
    return {
      chave: 'S' + s.n, frente: 'Sprint ' + s.n,
      descricao: `${ddmm(s.de)} a ${ddmm(s.ate - 1)}${s.meta ? ' · meta: ' + nomeParte(s.meta) : ''}`,
      total: vivos.length, feitos: feitos.length, cancelados: s.itens.length - vivos.length,
      andando: andando.length, fila: abertos.filter((i) => i.estado === 'B0' || i.estado === 'B1').length,
      parado: abertos.filter((i) => i.estado === 'DE' || i.estado === 'TR').length,
      completo: s.estado === 'passado' || (vivos.length > 0 && abertos.length === 0),
      comeco: isoDe(s.de).slice(0, 10), mexido: s.itens.map((i) => i.mexido || '').sort().at(-1) || '',
      emendas: s.itens.filter((i) => i.origem === 'emenda' && i.estado !== 'KO').length,
      itens: [...naFila(abertos), ...recentes(feitos)].slice(0, 14)
        .map(itemDoCaminho),
      sprint: { n: s.n, estado: s.estado, previsto: s.previsto, gasto: s.gasto, fonte: s.fonte },
      artefatos: artefatosDoSprint(s.itens, raiz), // CC-927: calculado, nunca gravado
    }
  }
  const trechos = [...m.passados, m.atual, ...m.previstos].map(trecho).filter((t) => t.total > 0 || t.sprint.estado === 'atual')
  // CC-937: o que fechou sem data registrada vira um trecho só, antes do primeiro sprint, e fica fora da velocidade
  const semData = itens.filter((i) => i.semData && !i.pai)
  if (semData.length) trechos.unshift({ ...trecho({ n: 0, de: 0, ate: DIA, estado: 'passado', itens: semData, previsto: null, gasto: null, fonte: null, meta: null }), chave: 'antes', frente: 'Antes do histórico', descricao: 'fechados sem data registrada' })
  // CC-958: fim do backlog é o último trecho antes da chegada
  if (m.fimDoBacklog.length) { const ult = m.previstos.at(-1) || m.atual; trechos.push({ ...trecho({ n: ult.n + 1, de: ult.ate, ate: ult.ate + SEMANA, estado: 'previsto', itens: m.fimDoBacklog, previsto: null, gasto: null, fonte: null, meta: null }), chave: 'fim', frente: 'Fim do backlog', descricao: 'o que você mandou para depois de tudo' }) }
  const feitos = trechos.reduce((s, t) => s + t.feitos, 0); const total = trechos.reduce((s, t) => s + t.total, 0)
  const emendas = trechos.reduce((s, t) => s + t.emendas, 0)
  return {
    ok: true, por: 'sprint', raiz, nome: nomeDe(raiz), feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0,
    marcos: trechos.filter((t) => t.completo).length, emendas, crescimento: total - emendas ? Math.round((emendas / (total - emendas)) * 100) : 0,
    trechos, atual: Math.max(0, trechos.findIndex((t) => t.sprint.estado === 'atual')), at: agora,
    capacidade: { valor: cap, unidade: prev.fonte === 'medido' ? 'tokens' : 'pontos' }, horasDele: 'aberto',
    // CC-958: guardados fora da estrada, fora do andado e dos marcos
    foraDoMvp: secaoGuardada('fora', 'Fora do MVP', 'guardado: não entra na fila até você promover', itens.filter((i) => !i.pai && B.estaAberto(i) && B.lugarDe(i) === 'fora')),
    ideiasSemLugar: secaoGuardada('ideias', 'Ideias esperando o seu lugar', 'ainda fora da fila: escolha onde cada uma entra', itens.filter((i) => !i.pai && i.estado === 'B0' && !B.lugarDe(i))),
    lugares: B.LUGARES,
    ...(avisoGravacao ? { avisoGravacao } : {}),
  }
}

/**
 * C4: a soma dos sprints abertos de todos os projetos contra a semana da conta.
 * Só o gasto desta máquina (a VPS) entra: o do PC não chega aqui (D18). Não corta
 * nada pelo limite (D5). `tokensPorPct` sai da última semana completa do histórico:
 * tokens úteis desta máquina na janela divididos pelo % gasto nela.
 */
export function contaDaSemana(raizes, { uso = readUso(), hist = lerHistorico(), resumoFn = resumo, agora = Date.now(), caminhoFn = caminhoPorSprint } = {}) {
  // ponytail: a janela da conta tem hora de reset; aqui entram os dias inteiros que ela toca
  let tokensPorPct = null
  const primeira = Math.min(...hist.map((l) => l.em).filter(Number.isFinite))
  const semana = gastoPorSemana(hist).filter((s) => s.resetaEm <= agora && s.pct > 0 && s.resetaEm - SEMANA >= primeira - DIA).at(-1)
  if (semana) {
    const r = resumoFn({ de: new Date(semana.resetaEm - SEMANA).toLocaleDateString('sv'), ate: new Date(semana.resetaEm - 1).toLocaleDateString('sv') })
    const tk = (r?.projetos || []).reduce((s, p) => s + (p.usoDias || []).reduce((a, u) => a + tokensUteis(u), 0), 0)
    if (tk > 0) tokensPorPct = tk / semana.pct
  }
  let tokens = 0; let pontos = 0; let emPontos = 0; const gastos = []
  for (const raiz of raizes) {
    let c; try { c = caminhoFn(raiz, agora, { gravar: false }) } catch { continue }
    const at = c?.ok && c.trechos.find((t) => t.sprint.estado === 'atual'); if (!at) continue
    pontos += at.sprint.previsto?.pontos || 0
    if (at.sprint.fonte === 'medido' && at.sprint.previsto?.tokens) tokens += at.sprint.previsto.tokens; else emPontos++
    for (const g of lerGravados(arquivoDeSprints(raiz))) if (g.tipo === 'fechar' && g.gasto?.tokens) gastos.push(g.gasto.tokens)
  }
  const media = gastos.length ? gastos.reduce((a, b) => a + b, 0) / gastos.length : null
  return {
    // só há % quando todos os sprints abertos estão em tokens e existe uma semana medida
    pctPrevisto: tokensPorPct && !emPontos && tokens ? Math.round(tokens / tokensPorPct) : null,
    pctAgora: uso?.semana?.pct ?? null,
    mediaGastoPorSprint: { tokens: media ? Math.round(media) : null, pct: media && tokensPorPct ? Math.round(media / tokensPorPct) : null, n: gastos.length },
    previsto: { tokens, pontos, projetosEmPontos: emPontos },
    estimadoPor: 'VPS', semMedida: !tokensPorPct, horasDele: 'aberto',
  }
}
