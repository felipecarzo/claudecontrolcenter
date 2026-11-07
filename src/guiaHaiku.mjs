#!/usr/bin/env node
/**
 * CC-1076: o guia de funções de uma frente, escrito pelo Haiku.
 *
 * Disparado por `hooks/guia-frente.mjs` (processo solto, uma chamada, termina sozinho) ou à mão:
 *   node cc.mjs guia frente <nome> [--ensaio]
 *   node src/guiaHaiku.mjs --raiz <pasta> --frente <nome> [--transcrito <jsonl>] [--sessao <id>] [--ensaio] [--saida <arquivo>]
 *
 * Reúne o material (itens, planos, código, conversa) com teto de ~120 KB, faz UMA chamada `claude -p --model haiku`
 * sem ferramenta, CONFERE POR CÓDIGO cada `arquivo:linha` do texto devolvido, e grava
 * `docs/guias/capacidades/<frente>.md` mais a linha no INDICE. Teto de 6 chamadas por hora, 180 s por chamada, uma
 * tentativa. O ESTADO (item, gancho) vem calculado do código no início do material e é conferido de novo no texto devolvido.
 * `--saida <arquivo>` grava o guia lá e NÃO mexe no INDICE nem em docs/guias/capacidades/. Falha passa e fica em ~/logs/guia-haiku.log. Sem laço, sem timer, sem nova chamada sozinho.
 * `--ensaio` monta o material, imprime o tamanho e NÃO chama o modelo.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GUARDAS } from '../hooks/parada.mjs'
import { hookEnabled, readConfig } from './config.mjs'
import { itensPorFrente, slugDaFrente } from './frenteConcluida.mjs'
import { guiasDe, PASTA_GUIAS } from './guias.mjs'
import { HOOKS } from './hooksCatalogo.mjs'
import { readTail } from './transcript.mjs'

export const TETO_TOTAL = 120 * 1024
export const TETO_CONVERSA = 60 * 1024
const TETO_PLANOS = 40 * 1024
const TETO_PLANO = 15 * 1024
const TETO_ARQUIVO = 6 * 1024
export const TETO_POR_HORA = 6
export const TEMPO_MS = 180000
const HORA = 3600e3

export const arquivoLog = (home = os.homedir()) => path.join(home, 'logs', 'guia-haiku.log')

export function gravarLog(linha, { home = os.homedir() } = {}) {
  try {
    fs.mkdirSync(path.join(home, 'logs'), { recursive: true })
    fs.appendFileSync(arquivoLog(home), `${JSON.stringify({ em: new Date().toISOString(), ...linha })}\n`)
  } catch { /* o log é extra */ }
}

export function chamadasNaHora({ home = os.homedir(), agora = Date.now() } = {}) {
  let n = 0
  try {
    for (const l of fs.readFileSync(arquivoLog(home), 'utf8').split('\n').slice(-2000)) {
      if (!l.includes('"chamada":true')) continue
      try { if (agora - Date.parse(JSON.parse(l).em) <= HORA) n++ } catch { /* linha ruim */ }
    }
  } catch { /* sem log ainda */ }
  return n
}

/* ---------- o ESTADO REAL, calculado do código ---------- */

const hoje = () => new Date().toISOString().slice(0, 10)
const PALAVRA_ESTADO = { B0: 'ideia', B1: 'a fazer', EM: 'andando', PR: 'em prova', DE: 'decisão dele', TR: 'travado', OK: 'fechado', KO: 'cancelado' }

/** Estado atual dos itens da frente (backlog) e dos ganchos (catálogo mais interruptor global). Sem IA, sem dependência do texto. */
export function estadoReal(raiz, frente) {
  const por = itensPorFrente(raiz)
  const itens = (por.get(frente) || []).map((i) => ({ id: i.id, titulo: i.titulo || '', codigo: i.estado, palavra: PALAVRA_ESTADO[i.estado] || i.estado }))
  /* itens de OUTRAS frentes: o guia não pode dar estado a eles (conferirEstado) */
  const outros = [...por].filter(([f]) => f !== frente).flatMap(([, l]) => l).map((i) => ({ id: i.id, palavra: PALAVRA_ESTADO[i.estado] || i.estado }))
  let cfg; try { cfg = readConfig() } catch { cfg = {} }
  const hooks = HOOKS.map((h) => {
    let ligado = false
    try { ligado = !!hookEnabled(h.id, cfg, null) } catch { /* sem config: desligado */ }
    return { id: h.id, padrao: !!h.padrao, implementado: !!h.implementado, estado: !h.implementado ? 'aposentado' : (ligado ? 'ligado' : 'desligado') }
  })
  return { itens, outros, hooks, guardas: [...GUARDAS] }
}

export function blocoEstado(frente, est) {
  return ['## ESTADO REAL (calculado agora pelo código; MANDA e vence qualquer outro texto deste material)', '',
    `### Itens da frente "${frente}" e o estado atual de cada um`, ...est.itens.map((i) => `- ${i.id}: ${i.palavra}`), '',
    '### Ganchos do catálogo (padrão, implementado, interruptor global agora)',
    ...est.hooks.map((h) => `- ${h.id}: ${h.estado} (padrao=${h.padrao}, implementado=${h.implementado})`), '',
    `### Lista real de GUARDAS que o hooks/parada.mjs roda (${est.guardas.length})`, est.guardas.join(', '), ''].join('\n')
}

/**
 * A seção "1. Estado e para quem vale", ESCRITA POR CÓDIGO (o Haiku não conta nem resume estado): tabela dos itens da
 * frente, contagens por estado, e os ganchos do cabeçalho `codigo:` que estão no catálogo, com o total de ligados.
 */
export function secaoEstado(frente, est, arquivos = []) {
  const cel = (s) => String(s).replace(/\|/g, '/').replace(/\s+/g, ' ').trim()
  const cont = new Map()
  for (const i of est.itens) cont.set(i.palavra, (cont.get(i.palavra) || 0) + 1)
  const ids = new Set(arquivos.map((a) => (a.match(/^hooks\/([\w-]+)\.mjs$/) || [])[1]).filter(Boolean))
  const rel = est.hooks.filter((h) => ids.has(h.id))
  const ligados = est.hooks.filter((h) => h.estado === 'ligado').length
  return ['## 1. Estado e para quem vale', '',
    `Escrito por código em ${hoje()} a partir do backlog e do catálogo de ganchos; não vem do modelo.`, '',
    `### Itens da frente "${frente}" (${est.itens.length})`, '', '| item | título | estado |', '|---|---|---|',
    ...est.itens.map((i) => `| ${i.id} | ${cel(i.titulo)} | ${i.palavra} |`), '',
    `Contagem por estado: ${[...cont].map(([p, n]) => `${p} ${n}`).join(', ') || 'nenhum item'}.`, '',
    '### Ganchos relacionados (arquivos `hooks/` do cabeçalho `codigo:` que estão no catálogo)', '',
    ...(rel.length ? ['| gancho | estado |', '|---|---|', ...rel.map((h) => `| ${h.id} | ${h.estado} |`)] : ['Nenhum.']), '',
    `Ganchos ligados no catálogo agora: ${ligados} de ${est.hooks.length}.`, ''].join('\n')
}

/* ---------- o material ---------- */

const bytes = (s) => Buffer.byteLength(s, 'utf8')
function corta(s, max, cortes, rotulo) {
  if (bytes(s) <= max) return s
  cortes.push(`${rotulo}: ${bytes(s)} -> ${max} bytes`)
  return `${Buffer.from(s, 'utf8').subarray(0, max).toString('utf8')}\n[cortado]`
}

/** Só a fala dele e da IA, sem saída de ferramenta, e só o fim (`max` bytes). */
export function conversaDe(transcrito, max = TETO_CONVERSA) {
  if (!transcrito) return ''
  let texto
  try { texto = readTail(transcrito, 1024 * 1024).text } catch { return '' }
  const falas = []
  for (const l of texto.split('\n')) {
    if (!l.includes('"message"')) continue
    let e; try { e = JSON.parse(l) } catch { continue }
    if ((e.type !== 'user' && e.type !== 'assistant') || e.isMeta || e.isSidechain || e.toolUseResult || e.isCompactSummary) continue
    const c = e.message?.content
    const t = typeof c === 'string' ? c : (Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n') : '')
    if (t.trim()) falas.push(`${e.type === 'user' ? 'ELE' : 'IA'}: ${t.trim()}`)
  }
  const junto = falas.join('\n\n')
  const buf = Buffer.from(junto, 'utf8')
  return buf.length <= max ? junto : `[início cortado]\n${buf.subarray(buf.length - max).toString('utf8')}`
}

const CODIGO = /(?:\b(?:src|hooks|tools)\/[\w./-]+\.(?:mjs|js|html|json|sh)|\bcc\.mjs|\btest-[\w-]+\.mjs)\b/g

/**
 * Monta o material da frente. Devolve `{ texto, bytes, itens, arquivos, cortes }`, ou `{ erro }`.
 * `itens`: os da frente em PR ou OK (KO fica de fora).
 */
export function montarMaterial(raiz, frente, { transcrito = null } = {}) {
  const todos = itensPorFrente(raiz).get(frente)
  if (!todos) return { erro: `frente "${frente}" não existe no backlog` }
  const itens = todos.filter((i) => i.estado === 'PR' || i.estado === 'OK')
  if (!itens.length) return { erro: `frente "${frente}" não tem item em prova nem fechado` }
  const cortes = []
  const blocoItens = itens.map((i) => [`### ${i.id} (${i.estado}): ${i.titulo}`,
    i.intencao && `intenção: ${i.intencao}`, i.pronto && `pronto: ${i.pronto}`, i.conferir && `conferir: ${i.conferir}`].filter(Boolean).join('\n')).join('\n\n')

  let planos = ''
  const mencionados = new Set()
  for (const i of itens) {
    let p
    try { p = fs.readFileSync(path.join(raiz, 'docs', `${i.id}.md`), 'utf8') } catch { continue }
    for (const m of p.match(CODIGO) || []) mencionados.add(m)
    planos += `\n\n### Plano ${i.id}\n${corta(p, TETO_PLANO, cortes, `plano ${i.id}`)}`
  }
  planos = corta(planos, TETO_PLANOS, cortes, 'planos')

  const ids = new Set(itens.map((i) => i.id))
  for (const g of guiasDe(raiz)) if (g.itens.some((x) => ids.has(x))) for (const c of g.codigo) mencionados.add(c)
  const arquivos = [...mencionados].filter((f) => {
    const abs = path.resolve(raiz, f)
    return abs.startsWith(`${path.resolve(raiz)}${path.sep}`) && fs.existsSync(abs) && fs.statSync(abs).isFile()
  }).sort()

  let stat = ''
  if (arquivos.length) {
    const r = spawnSync('git', ['-C', raiz, 'diff', '--stat', '--', ...arquivos], { encoding: 'utf8', timeout: 10000 })
    stat = r.status === 0 ? r.stdout.trim() : ''
  }
  const conversa = conversaDe(transcrito)
  const estado = estadoReal(raiz, frente)

  const montar = (codigo) => [
    `# FRENTE: ${frente}`, '', blocoEstado(frente, estado), '## Itens da frente (título, intenção e pronto; o ESTADO está no bloco acima)', blocoItens, '',
    '## Planos dos itens (HISTÓRICO, pode estar desatualizado: nunca tire estado daqui)', planos || '(nenhum plano em docs/)', '',
    '## Arquivos de código citados', arquivos.join('\n') || '(nenhum)', stat ? `\n## git diff --stat\n${stat}` : '', '',
    '## Código (HISTÓRICO do que existe no disco; cada linha com o número dela, para citar arquivo:linha; nunca tire estado de item ou de gancho daqui)', codigo || '(não coube no teto)', '',
    '## Conversa da sessão que fechou a frente (HISTÓRICO, pode estar desatualizado; só fala, sem saída de ferramenta)', conversa || '(sem conversa disponível)',
  ].join('\n')

  /* O código entra com o que sobra do teto, os menores primeiro: sem ele o Haiku não tem linha nenhuma para citar.
     Teste (test-*.mjs) fica de fora: descreve a função, não é ela. Os cortes vão resumidos em duas linhas. */
  let codigo = ''
  let sobra = TETO_TOTAL - bytes(montar(''))
  const truncados = []; const fora = []
  const fonte = arquivos.filter((f) => !/(^|\/)test-[^/]*$/.test(f))
  for (const f of fonte.sort((a, b) => fs.statSync(path.resolve(raiz, a)).size - fs.statSync(path.resolve(raiz, b)).size)) {
    let t; try { t = fs.readFileSync(path.resolve(raiz, f), 'utf8') } catch { continue }
    const num = t.split('\n').map((l, n) => `${n + 1}: ${l}`).join('\n')
    const parte = `\n--- ${f} ---\n${corta(num, TETO_ARQUIVO, [], '')}`
    if (bytes(parte) > sobra) { fora.push(f); continue }
    if (bytes(num) > TETO_ARQUIVO) truncados.push(f)
    codigo += parte; sobra -= bytes(parte)
  }
  if (truncados.length) cortes.push(`código: ${truncados.length} arquivos truncados em ${TETO_ARQUIVO} bytes cada (${truncados.join(', ')})`)
  if (fora.length) cortes.push(`código: ${fora.length} arquivos fora, sem espaço no teto (${fora.join(', ')})`)
  const texto = montar(codigo)
  return { texto, bytes: bytes(texto), itens: itens.map((i) => i.id), arquivos, cortes, conversaBytes: bytes(conversa), estado }
}

/* ---------- o pedido ---------- */

const PARTES = ['O que a ferramenta é, em uma frase, e o que NÃO é', 'Vocabulário (cada palavra do projeto, com o sentido exato e a tradução se for inglês ou sigla)',
  'O ciclo completo de ponta a ponta (do gatilho ao resultado, passo a passo)', 'Onde cada coisa mora (arquivos, pastas, configuração, logs)',
  'A interface, item por item (cada botão, comando ou campo e o que faz)', 'Regras e limites (o que recusa, o que tem teto, o que vale só em certo caso)',
  'O que a combinação de várias funções torna possível', 'O que ainda não existe (o que alguém vai achar que existe e não existe)',
  'Receitas curtas ("para fazer X, rode Y")', 'Como provar que continua funcionando (comandos de teste e o mapa dos outros documentos)']

export function montarPedido(frente, material) {
  return [
    `Você escreve o GUIA DE FUNÇÕES da frente "${frente}" de um projeto. Ninguém vai lê-lo: serve para uma IA escrever os manuais de usuário depois. Por isso é explícito e completo.`,
    '',
    'Escreva em português do Brasil, em Markdown, SEM título de nível 1 (o título é posto depois), com SÓ estas partes (de 2 a 11 do modelo de 11; a parte 1, "Estado e para quem vale", o script escreve e cola antes da sua, NÃO escreva ela), nesta ordem, cada uma como "## N. Nome" com o número aqui:',
    ...PARTES.map((p, i) => `${i + 2}. ${p}`),
    '',
    'Seja explícito sobre: todas as funções implementadas, no âmbito técnico E no conceitual; usabilidade E funcionalidade; rotas em nível de código (arquivo, função, rota HTTP, comando) E em nível de uso humano (o que a pessoa faz e vê); o que a COMBINAÇÃO das funções torna possível; o que NÃO existe.',
    '',
    'REGRAS DURAS:',
    '- ESTADO: o estado de cada item e de cada gancho (ligado, desligado, aposentado) vem SÓ do bloco "ESTADO REAL" do material. Nunca deduza estado de plano, guia, conversa ou código. Se o histórico contradisser o bloco, vale o bloco, e a contradição vai em "## Não verificado". Gancho aposentado não é ativo; item "em prova" não é "andando".',
    '- NÃO ESCREVA CONTAGEM de itens nem de ganchos ("cinco itens", "35 ganchos", "dois ganchos") e NÃO escreva o estado de item ou de gancho (andando, em prova, fechado, pronto, ligado, desligado, aposentado, ativo): o estado está na parte 1, que o script escreve. Descreva só o que cada função faz.',
    '- Os ganchos desligados ou aposentados estão listados na seção 1; não os descreva como ativos, nem cite o nome deles, a não ser para dizer que estão desligados ou aposentados.',
    '- Afirme só o que está no MATERIAL abaixo. Não invente função, botão, rota nem comportamento.',
    '- Toda afirmação sobre código cita `arquivo:linha`, com o caminho relativo à raiz do projeto e a linha como aparece numerada no material (exemplo: `src/a.mjs:12`). Escreva SEMPRE o caminho completo como aparece na lista de arquivos do material (`hooks/conferente.mjs:40`), nunca só o nome do arquivo.',
    '- O que você não achou no material vai em uma seção final "## Não verificado", uma linha por item. Melhor listar ali do que supor.',
    '- Nunca use travessão (o caractere longo) nem meia-risca. Use ponto, vírgula, dois pontos ou parênteses. O hífen comum pode.',
    '- Devolva só o guia, sem comentário antes nem depois.',
    '',
    '=== MATERIAL ===',
    material,
  ].join('\n')
}

/* ---------- a chamada ---------- */

/** Uma chamada, uma tentativa. `claude` vem do PATH (o teste põe um falso na frente). */
export function chamarHaiku(pedido, { home = os.homedir(), env = process.env, timeout = TEMPO_MS } = {}) {
  const cwd = path.join(home, '.local', 'share', 'agent-cockpit', 'guia-haiku')
  try { fs.mkdirSync(cwd, { recursive: true }) } catch { /* o spawn acusa */ }
  const t0 = Date.now()
  const r = spawnSync('claude', ['-p', '--model', 'haiku', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--setting-sources', 'local'],
    { input: pedido, encoding: 'utf8', cwd, timeout, maxBuffer: 8 * 1024 * 1024, env: { ...env, CC_CONFERENTE: '1', CC_GUIA_HAIKU: '1' } })
  const ms = Date.now() - t0
  if (r.error) return { erro: r.error.code === 'ETIMEDOUT' ? 'tempo esgotado' : String(r.error.message || r.error), ms }
  if (r.status !== 0) return { erro: `claude saiu com ${r.status}: ${String(r.stderr || r.stdout || '').trim().slice(0, 160)}`, ms }
  let texto = String(r.stdout || '').trim(); let modelo = null; let tokens = null
  try {
    const j = JSON.parse(texto)
    if (j && typeof j === 'object' && 'result' in j) {
      texto = String(j.result || '')
      modelo = Object.keys(j.modelUsage || {})[0] || j.model || null
      if (j.usage) tokens = { entrada: j.usage.input_tokens ?? null, saida: j.usage.output_tokens ?? null }
    }
  } catch { /* saída crua */ }
  texto = texto.trim().replace(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/, '$1').trim()
  if (!texto) return { erro: 'resposta vazia', ms, modelo }
  return { texto, modelo, tokens, ms }
}

/* ---------- a conferência de citações, sem IA ---------- */

const CITACAO = /([\w./-]+\.(?:mjs|js|json|html|md|sh|css|ts|jsonl)):(\d+)(?:-(\d+))?/g

/** Cada `arquivo:linha` do texto: o arquivo existe na raiz e a linha existe nele? */
export function conferirCitacoes(texto, raiz, arquivos = []) {
  /* Citação só com o nome do arquivo: se UM arquivo da lista do material tem esse nome, vira o caminho completo; se
     houver mais de um, fica como está (e conta como não conferida). */
  const porNome = new Map()
  for (const f of arquivos) { const n = path.basename(f); porNome.set(n, [...(porNome.get(n) || []), f]) }
  texto = texto.replace(CITACAO, (m, arq) => {
    const c = arq.includes('/') ? null : porNome.get(arq)
    return c?.length === 1 && c[0] !== arq ? c[0] + m.slice(arq.length) : m
  })
  const vistas = new Map()
  for (const m of texto.matchAll(CITACAO)) {
    const chave = m[0]
    if (!vistas.has(chave)) vistas.set(chave, { arq: m[1], ini: Number(m[2]), fim: Number(m[3] || m[2]) })
  }
  const base = path.resolve(raiz)
  const ruins = []
  let certas = 0
  for (const [chave, { arq, ini, fim }] of vistas) {
    const abs = path.resolve(base, arq)
    let motivo = null
    if (!abs.startsWith(`${base}${path.sep}`)) motivo = 'fora da pasta do projeto'
    else if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) motivo = 'arquivo não existe'
    else {
      const linhas = fs.readFileSync(abs, 'utf8').split('\n').length - (fs.readFileSync(abs, 'utf8').endsWith('\n') ? 1 : 0)
      if (ini < 1 || fim < ini || fim > linhas) motivo = `linha não existe (o arquivo tem ${linhas})`
    }
    if (motivo) ruins.push({ citacao: chave, motivo }); else certas++
  }
  return { total: vistas.size, certas, ruins, texto }
}

/* ---------- a conferência do ESTADO, sem IA ---------- */

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PALAVRAS_ITEM = [[/\b(?:em andamento|andando)\b/i, ['EM'], 'andando'], [/\bem prova\b/i, ['PR'], 'em prova'],
  [/\bfechad[oa]s?\b/i, ['OK'], 'fechado'], [/\ba fazer\b/i, ['B1', 'B0'], 'a fazer']]
const PALAVRAS_GANCHO = [[/\bdesligad[oa]s?\b/i, ['desligado', 'aposentado'], 'desligado'], [/\baposentad[oa]s?\b/i, ['aposentado'], 'aposentado'],
  [/(?<!des)\bligad[oa]s?\b|\bativ[oa]s?\b|\broda\b/i, ['ligado'], 'ativo/ligado/roda']]
const NUMEROS = Object.fromEntries('dois duas três tres quatro cinco seis sete oito nove dez onze doze treze catorze quatorze quinze vinte trinta'.split(' ').map((p) => [p, 0]))
const CONTAGEM = new RegExp(`(?<![\\w-])(\\d+|${Object.keys(NUMEROS).join('|')})\\s+(?:(?:[\\wÀ-ú]+\\s+){0,2}?)(itens|ganchos)(?![\\w-])`, 'gi')
const DECLARA = /\b(?:aposentad[oa]s?|desligad[oa]s?|n[aã]o roda mais|n[aã]o rodam mais|substitu[ií]d[oa]s?)\b/i
const COPULA = /^[`'"*)\s]*(?:(?:está|estão|esta|estao|foi|foram|ficou|ficaram|segue|seguem|continua|continuam|é|são|já|ainda)\s+){0,2}$/i
const ENTRE_IDS = /^(?:[\s,;`'"*]|\be\b)+$/

/**
 * Afirmações de estado de uma frase. Ids vizinhos ("CC-1, CC-2 e CC-3") formam um GRUPO, e a palavra de estado vale para o
 * grupo inteiro em duas formas: "<grupo> está <palavra>" (só com verbo de ligação no meio, o que deixa de fora "(A) ou
 * andando" e a negação) ou "<palavra> (<grupo>)", "<palavra>: <grupo>". Devolve `[{ ids, aceitos, dito }]`.
 */
function reivindicacoes(frase, ocorr, tabela) {
  const grupos = []
  for (const o of ocorr) {
    const g = grupos[grupos.length - 1]
    if (g && ENTRE_IDS.test(frase.slice(g.fim, o.ini))) { g.ids.push(o.id); g.fim = o.fim } else grupos.push({ ids: [o.id], ini: o.ini, fim: o.fim })
  }
  const saida = []
  for (const g of grupos) {
    const depois = frase.slice(g.fim)
    let achou = null
    for (const [re, aceitos] of tabela) {
      const m = depois.match(re)
      if (m && (!achou || m.index < achou.m.index)) achou = { m, aceitos }
    }
    if (achou && COPULA.test(depois.slice(0, achou.m.index))) { saida.push({ ids: g.ids, aceitos: achou.aceitos, dito: achou.m[0].toLowerCase() }); continue }
    const antes = frase.slice(0, g.ini)
    for (const [re, aceitos] of tabela) {
      const m = antes.match(new RegExp(`(${re.source})[\\s:(\`'"*]*$`, 'i'))
      if (m) { saida.push({ ids: g.ids, aceitos, dito: m[1].toLowerCase() }); break }
    }
  }
  return saida
}

/**
 * Para cada frase do guia: id de item (CC-n) com "andando/em prova/fechado/a fazer", e nome de gancho com
 * "ativo/ligado/roda/desligado/aposentado", confere contra o estado real. Só conta a afirmação que as duas formas de
 * `reivindicacoes` reconhecem; frase solta no meio de uma lista não conta (melhor não conferir que apontar à toa).
 */
export function conferirEstado(texto, est) {
  const itens = new Map(est.itens.map((i) => [i.id, i]))
  const hooks = new Map(est.hooks.map((h) => [h.id, h]))
  const reHook = est.hooks.length ? new RegExp(`(?<![\\w-])(${[...hooks.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![\\w-])`, 'g') : null
  let total = 0; let certas = 0
  const falhas = []
  let tratados = new Set()
  const confere = (frase, ocorr, real, tabela) => {
    for (const r of reivindicacoes(frase, ocorr, tabela)) {
      for (const id of r.ids) {
        tratados.add(id)
        total++
        const v = real(id)
        if (r.aceitos.includes(v.chave)) certas++
        else falhas.push({ frase: frase.slice(0, 200), id, dito: r.dito, real: v.rotulo })
      }
    }
  }
  const fora = new Map((est.outros || []).map((i) => [i.id, i]))
  const nHooks = est.hooks.length, ligados = est.hooks.filter((h) => h.estado === 'ligado').length
  for (const frase of texto.split(/(?<=[.!?])\s+|\n+/).map((f) => f.trim()).filter(Boolean)) {
    /* (a) id que NÃO é da frente, dito com palavra de estado */
    const of = [...frase.matchAll(/\bCC-\d+\b/g)].filter((m) => fora.has(m[0])).map((m) => ({ id: m[0], ini: m.index, fim: m.index + m[0].length }))
    for (const r of reivindicacoes(frase, of, PALAVRAS_ITEM)) for (const id of r.ids) {
      total++; falhas.push({ frase: frase.slice(0, 200), id, dito: r.dito, real: `não é item desta frente (no backlog está ${fora.get(id).palavra})` })
    }
    /* (b) toda contagem de itens ou de ganchos: o Haiku não conta, o número vem da seção 1 */
    for (const m of frase.matchAll(CONTAGEM)) {
      total++
      const gancho = /^gancho/i.test(m[2])
      const real = gancho ? `contagem de ganchos é da seção 1 (${ligados} ligados de ${nHooks} no catálogo)` : `contagem de itens é da seção 1 (${est.itens.length} itens na frente)`
      falhas.push({ frase: frase.slice(0, 200), id: m[0], dito: m[0], real })
    }
    const ids = [...frase.matchAll(/\bCC-\d+\b/g)].filter((m) => itens.has(m[0])).map((m) => ({ id: m[0], ini: m.index, fim: m.index + m[0].length }))
    confere(frase, ids, (id) => ({ chave: itens.get(id).codigo, rotulo: itens.get(id).palavra }), PALAVRAS_ITEM)
    const hs = reHook ? [...frase.matchAll(reHook)].map((m) => ({ id: m[1], ini: m.index, fim: m.index + m[1].length })) : []
    tratados = new Set()
    confere(frase, hs, (id) => ({ chave: hooks.get(id).estado, rotulo: hooks.get(id).estado }), PALAVRAS_GANCHO)
    /* (c) MENÇÃO a gancho desligado ou aposentado sem palavra que o declare na mesma frase (o que a frase diz de estado já foi conferido acima) */
    if (!DECLARA.test(frase)) {
      for (const id of new Set(hs.map((h) => h.id))) {
        const h = hooks.get(id)
        if (h.estado === 'ligado' || tratados.has(id)) continue
        total++
        const i = frase.indexOf(id)
        falhas.push({ frase: frase.slice(0, 200), id, dito: `menção a "${id}" como se estivesse em uso (trecho: "${frase.slice(Math.max(0, i - 30), i + id.length + 30).replace(/\s+/g, ' ')}")`, real: h.estado })
      }
    }
  }
  return { total, certas, falhas }
}

/* ---------- gravar o guia e o INDICE ---------- */

const semTravessao = (s) => String(s).replace(/\s*[\u2014\u2013]\s*/g, ', ')

export function gravarGuia(raiz, frente, { itens, arquivos, texto, citacoes, estado = { total: 0, certas: 0, falhas: [] }, saida = null, secao1 = '' }) {
  const slug = slugDaFrente(frente)
  const dir = path.join(raiz, PASTA_GUIAS)
  const alvo = saida ? path.resolve(saida) : path.join(dir, `${slug}.md`)
  fs.mkdirSync(path.dirname(alvo), { recursive: true })
  let origem = hoje()
  try {
    const velho = fs.readFileSync(alvo, 'utf8')
    origem = (velho.match(/^origem:[ \t]*(\S+)/m) || velho.match(/^atualizado:[ \t]*(\S+)/m) || [])[1] || origem
  } catch { /* primeiro guia da frente */ }
  const corpo = semTravessao(texto).replace(/^#\s+[^\n]*\n+/, '')
  const fim = (citacoes.ruins.length
    ? `\n\n## Citações que não conferem\n\n${citacoes.ruins.map((r) => `- \`${r.citacao}\`: ${r.motivo}`).join('\n')}\n` : '')
    + (estado.falhas.length
      ? `\n\n## Afirmações de estado que não conferem\n\n${estado.falhas.map((f) => `- ${f.id}: o guia diz "${f.dito}", o estado real é "${f.real}". Frase: ${f.frase.replace(/\s+/g, ' ')}`).join('\n')}\n` : '')
    || '\n'
  const cab = ['# Guia: ' + frente, '', `itens: ${itens.join(', ')}`, `codigo: ${arquivos.join(', ')}`, `atualizado: ${hoje()}`,
    'gerado: haiku', `origem: ${origem}`, `citacoes: ${citacoes.certas} de ${citacoes.total} conferidas`, `estado: ${estado.certas} de ${estado.total} afirmações conferem`, 'manual:', '', ''].join('\n')
  fs.writeFileSync(alvo, cab + (secao1 ? `${semTravessao(secao1).trim()}\n\n` : '') + corpo.trim() + fim, 'utf8')
  if (saida) return alvo // prova de qualidade: não suja a pasta nem o INDICE

  const indice = path.join(dir, 'INDICE.md')
  let t = ''; try { t = fs.readFileSync(indice, 'utf8') } catch { /* sem índice */ }
  const linha = `| Frente ${frente} (guia gerado pelo Haiku) | [${slug}.md](${slug}.md) | ${itens.join(', ')} | ${arquivos.join(', ')} | ${hoje()} |  |`
  const L = t.split('\n')
  const i = L.findIndex((l) => l.includes(`](${slug}.md)`))
  if (i >= 0) L[i] = linha
  else {
    let ult = -1
    L.forEach((l, k) => { if (l.startsWith('|')) ult = k })
    if (ult >= 0) L.splice(ult + 1, 0, linha); else L.push(linha)
  }
  fs.writeFileSync(indice, L.join('\n').replace(/\n*$/, '\n'), 'utf8')
  return alvo
}

/* ---------- o fluxo todo ---------- */

/** Gera o guia da frente. Nunca lança: devolve `{ status }` e grava o log. */
export function gerar({ raiz, frente, transcrito = null, sessao = null, ensaio = false, saida = null, home = os.homedir(), env = process.env }) {
  const mat = montarMaterial(raiz, frente, { transcrito })
  if (mat.erro) { if (!ensaio) gravarLog({ frente, sessao, status: 'erro', erro: mat.erro }, { home }); return { status: 'erro', erro: mat.erro } }
  if (ensaio) return { status: 'ensaio', bytes: mat.bytes, itens: mat.itens, arquivos: mat.arquivos, cortes: mat.cortes, conversaBytes: mat.conversaBytes }
  const base = { frente, sessao, itens: mat.itens.length, bytes: mat.bytes, ...(mat.cortes.length ? { cortes: mat.cortes } : {}) }
  if (chamadasNaHora({ home }) >= TETO_POR_HORA) { gravarLog({ ...base, status: 'teto', limite: TETO_POR_HORA }, { home }); return { status: 'teto' } }
  const r = chamarHaiku(montarPedido(frente, mat.texto), { home, env })
  if (r.erro) { gravarLog({ ...base, chamada: true, status: 'erro', erro: r.erro, ms: r.ms, modelo: r.modelo || null }, { home }); return { status: 'erro', erro: r.erro } }
  const citacoes = conferirCitacoes(r.texto, raiz, mat.arquivos)
  const estado = conferirEstado(citacoes.texto, mat.estado)
  let arq
  try { arq = gravarGuia(raiz, frente, { itens: mat.itens, arquivos: mat.arquivos, texto: citacoes.texto, citacoes, estado, saida, secao1: secaoEstado(frente, mat.estado, mat.arquivos) }) } catch (e) {
    gravarLog({ ...base, chamada: true, status: 'erro', erro: `não gravou o guia: ${e.message}`, ms: r.ms, modelo: r.modelo }, { home })
    return { status: 'erro', erro: String(e.message) }
  }
  gravarLog({ ...base, chamada: true, status: 'gravou', modelo: r.modelo, tokens: r.tokens, ms: r.ms, citacoes: `${citacoes.certas} de ${citacoes.total}`, estado: `${estado.certas} de ${estado.total}`, guia: path.relative(raiz, arq) }, { home })
  return { status: 'gravou', arquivo: arq, modelo: r.modelo, tokens: r.tokens, citacoes, estado }
}

const principal = (() => { try { return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url) } catch { return false } })()
if (principal) {
  const a = process.argv.slice(2)
  const v = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : null }
  const raiz = v('--raiz') || process.cwd(); const frente = v('--frente')
  if (!frente) { console.error('uso: node src/guiaHaiku.mjs --raiz <pasta> --frente <nome> [--transcrito <jsonl>] [--sessao <id>] [--ensaio] [--saida <arquivo>]'); process.exit(1) }
  const r = gerar({ raiz: path.resolve(raiz), frente, transcrito: v('--transcrito'), sessao: v('--sessao'), ensaio: a.includes('--ensaio'), saida: v('--saida') })
  if (r.status === 'ensaio') {
    console.log(`ensaio da frente "${frente}": ${r.itens.length} itens (${r.itens.join(', ')}), ${r.bytes} bytes de material (teto ${TETO_TOTAL}), conversa ${r.conversaBytes} bytes, ${r.arquivos.length} arquivos de código`)
    for (const c of r.cortes) console.log(`  cortou: ${c}`)
    console.log('nenhum modelo foi chamado')
  } else if (r.status === 'gravou') console.log(`guia gravado: ${r.arquivo} (modelo ${r.modelo}, citações ${r.citacoes.certas} de ${r.citacoes.total}, estado ${r.estado.certas} de ${r.estado.total})`)
  else console.log(`guia não gerado: ${r.status}${r.erro ? `: ${r.erro}` : ''} (log: ${arquivoLog()})`)
  process.exit(0)
}
