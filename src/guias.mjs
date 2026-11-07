/**
 * CC-1071: o guia de capacidades de toda função pronta.
 *
 * Guias moram em `docs/guias/capacidades/<funcao>.md`, com um cabeçalho de linhas simples:
 *   itens: CC-1070, CC-1071
 *   codigo: src/a.mjs, hooks/b.mjs
 *   atualizado: 2026-10-22
 * Os ganchos `hooks/guia-fim.mjs` e `hooks/guia-contexto.mjs` leem só esse cabeçalho. Nenhum chama modelo.
 *
 * Leitura do backlog e dos eventos é por varredura de linha, e não por `backlog.ler()`: medido em 22/10, o `ler`
 * valida os 1105 itens e custa ~73 ms (mais ~27 ms de import), contra um orçamento de 40 ms para os dois ganchos.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readTail } from './transcript.mjs'

export const PASTA_GUIAS = path.join('docs', 'guias', 'capacidades')
const JANELA_EVENTOS_MS = 30 * 60e3
const CODIGO_SOB = /^(?:src|hooks)\/|^cc\.mjs$/
/* Sem função nova para descrever: defeito (conserto), registro, medição e decisão. */
const SEM_GUIA = new Set(['DEF', 'DOC', 'MED', 'DEC'])
const CONSERTO = /\b(consert\w*|fix\w*)\b/i

/** A pasta do projeto: a primeira, subindo de `cwd`, que tem `docs/backlog.jsonl`. */
export function acharRaiz(cwd) {
  let d = path.resolve(cwd || process.cwd())
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, 'docs', 'backlog.jsonl'))) return d
    const pai = path.dirname(d)
    if (pai === d) break
    d = pai
  }
  return null
}

const lerJson = (l) => { try { return JSON.parse(l) } catch { return null } }

/* O backlog tem ~750 KB: procurar a agulha no Buffer e decodificar só a linha dela custa ~1 ms, contra ~8 ms para
   decodificar e dividir o arquivo todo. */
function linhasComAgulha(raiz, agulha, onde) {
  let buf
  try { buf = fs.readFileSync(path.join(raiz, 'docs', 'backlog.jsonl')) } catch { return [] }
  const out = []
  for (let i = buf.indexOf(agulha); i >= 0;) {
    const ini = buf.lastIndexOf(10, i) + 1
    let fim = buf.indexOf(10, i)
    if (fim < 0) fim = buf.length
    const o = lerJson(buf.toString('utf8', ini, fim))
    if (o?.id && onde(o)) out.push(o)
    i = buf.indexOf(agulha, fim)
  }
  return out
}
export const itemDe = (raiz, id) => linhasComAgulha(raiz, `{"id":"${id}"`, (o) => o.id === id)[0] || null
export const itensAndando = (raiz) => linhasComAgulha(raiz, '"estado":"EM"', (o) => o.estado === 'EM')

const JANELA_ANDANDO_MS = 24 * 60 * 60e3
/**
 * Itens andando que ANDARAM de verdade há pouco: os eventos do backlog não dizem a sessão, então o que dá para provar
 * é o item ter ido para "andando" nas últimas 24 horas. Sem isso, o aviso de contexto cobria guia de 18 itens parados
 * há semanas (medido em 22/10: 3 recentes entre 18 andando).
 */
export function andandoRecentes(raiz, { agora = Date.now() } = {}) {
  let texto = ''
  try { texto = readTail(path.join(raiz, 'docs', 'eventos.jsonl'), 256 * 1024).text } catch { return [] }
  const recentes = new Set()
  for (const l of texto.split('\n')) {
    if (!l.includes('"para":"EM"')) continue
    const e = lerJson(l)
    if (e?.tipo === 'estado' && e.para === 'EM' && Date.parse(e.em) >= agora - JANELA_ANDANDO_MS) recentes.add(e.id)
  }
  return recentes.size ? itensAndando(raiz).filter((i) => recentes.has(i.id)) : []
}

/** Itens que foram para prova (PR) ou fechados (OK) desde `desde`, no máximo 30 min atrás. */
export function movidosRecentes(raiz, { desde = 0, agora = Date.now() } = {}) {
  const corte = Math.max(desde || 0, agora - JANELA_EVENTOS_MS)
  let texto = ''
  try { texto = readTail(path.join(raiz, 'docs', 'eventos.jsonl'), 64 * 1024).text } catch { return [] }
  const ids = new Set()
  for (const l of texto.split('\n')) {
    if (!l.includes('"tipo":"estado"') || !(l.includes('"para":"PR"') || l.includes('"para":"OK"'))) continue
    const e = lerJson(l)
    if (e?.tipo === 'estado' && (e.para === 'PR' || e.para === 'OK') && Date.parse(e.em) >= corte) ids.add(e.id)
  }
  return [...ids]
}

/** Esse item pede guia novo? Não pede: conserto, e natureza sem função nova. */
export const pedeGuia = (item) => Boolean(item) && !SEM_GUIA.has(item.natureza)
  && !CONSERTO.test(`${item.titulo || ''} ${item.intencao || ''}`)

const lista = (v) => String(v || '').split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)

/** Os guias da pasta, com o que o cabeçalho diz e o mtime do arquivo. */
export function guiasDe(raiz) {
  const dir = path.join(raiz, PASTA_GUIAS)
  let nomes = []
  try { nomes = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'INDICE.md') } catch { return [] }
  const guias = []
  for (const nome of nomes) {
    const arq = path.join(dir, nome)
    let cabeca = ''; let mtimeMs = 0
    try { cabeca = fs.readFileSync(arq, 'utf8').split('\n').slice(0, 25).join('\n'); mtimeMs = fs.statSync(arq).mtimeMs } catch { continue }
    const campo = (k) => (cabeca.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'mi')) || [])[1]
    guias.push({ nome, itens: lista(campo('itens')), codigo: lista(campo('codigo')), mtimeMs })
  }
  return guias
}

/** Guias cujo código listado foi editado depois deles. `editados` são caminhos (absolutos ou relativos à raiz). */
export function guiasVelhos(raiz, guias, editados) {
  const rel = new Set()
  for (const e of editados) {
    const r = path.relative(raiz, path.resolve(raiz, e)).split(path.sep).join('/')
    if (CODIGO_SOB.test(r)) rel.add(r)
  }
  const mt = new Map()
  for (const r of rel) { try { mt.set(r, fs.statSync(path.join(raiz, r)).mtimeMs) } catch { /* apagado: não pede guia */ } }
  const velhos = []
  for (const g of guias) {
    const arqs = g.codigo.filter((c) => mt.has(c) && mt.get(c) > g.mtimeMs)
    if (arqs.length) velhos.push({ guia: g.nome, arquivos: arqs })
  }
  return velhos
}

/** O que falta de guia neste turno: ids sem guia e guias velhos. `registro` é o de `registroTurno.mjs`. */
export function faltaDoGuia(raiz, registroDe, { agora = Date.now() } = {}) {
  const guias = guiasDe(raiz)
  const movidos = movidosRecentes(raiz, { agora })
  const comCodigo = guias.some((g) => g.codigo.length)
  if (!movidos.length && !comCodigo) return { semGuia: [], velhos: [] }
  const reg = registroDe()
  const desde = Date.parse(reg?.pedidoEm || '') || 0
  const doTurno = desde ? movidosRecentes(raiz, { desde, agora }) : movidos
  const semGuia = doTurno.filter((id) => !guias.some((g) => g.itens.includes(id)) && pedeGuia(itemDe(raiz, id)))
  const editados = (reg?.mudou || []).filter((m) => m.tipo !== 'Bash' && m.alvo).map((m) => m.alvo)
  return { semGuia, velhos: editados.length ? guiasVelhos(raiz, guias, editados) : [] }
}

/* ---------- contexto cheio (peça 2) ---------- */

export const configGuias = (home = os.homedir()) => {
  const base = { janela: 200000, limite: 0.75 }
  try { return { ...base, ...JSON.parse(fs.readFileSync(path.join(home, '.config', 'agent-cockpit', 'guias.json'), 'utf8')) } } catch { return base }
}

/** Tokens de entrada da última resposta do assistente com `usage`, e o modelo dela. */
export function contextoUsado(arquivo) {
  /* Cauda pequena primeiro: a última resposta com `usage` quase sempre está nela. */
  for (const bytes of [64 * 1024, 1024 * 1024]) {
    let leitura
    try { leitura = readTail(arquivo, bytes) } catch { return null }
    const linhas = leitura.text.split('\n')
    for (let i = linhas.length - 1; i >= 0; i--) {
      const l = linhas[i]
      if (!l.includes('"usage"') || !l.includes('"assistant"')) continue
      const e = lerJson(l)
      const u = e?.message?.usage
      if (e?.type !== 'assistant' || e.isSidechain || !u) continue
      const tokens = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
      if (tokens > 0) return { tokens, modelo: String(e.message.model || '') }
    }
    if (!leitura.partial) break
  }
  return null
}

const arquivoFaixa = (sessao, home) => path.join(home, '.local', 'share', 'agent-cockpit', 'guias', `${String(sessao).replace(/[^\w-]/g, '_')}.json`)
/* `faixa`: última faixa de 10% avisada. `grande`: esta sessão já passou da janela padrão, logo a janela dela é a de 1M. */
const estadoGravado = (sessao, home) => { try { return JSON.parse(fs.readFileSync(arquivoFaixa(sessao, home), 'utf8')) || {} } catch { return {} } }
const gravarEstado = (sessao, home, estado) => {
  try { const f = arquivoFaixa(sessao, home); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(estado)) } catch { /* sem abrigo: o aviso repete, não some */ }
}

/**
 * Passou do limite? Devolve `{ pct, faixa }` UMA vez por faixa de 10% (e grava), ou null.
 * Voltar abaixo do limite (limpou ou compactou) zera a faixa gravada, para o aviso poder voltar.
 */
export function contextoCheio(arquivo, sessao, { home = os.homedir() } = {}) {
  const cfg = configGuias(home)
  const uso = contextoUsado(arquivo)
  if (!uso) return null
  const gravado = sessao ? estadoGravado(sessao, home) : {}
  const padrao = Number(cfg.janela) || 200000
  /* A janela de 200 mil não comporta mais de 200 mil: passou disso, a sessão é a de 1M, e isso fica lembrado (depois de
     compactar o contexto volta a ser pequeno, e sem a lembrança o aviso voltaria a achar que a janela é de 200 mil). */
  const grande = Boolean(gravado.grande) || /\[1m\]$/.test(uso.modelo) || uso.tokens > padrao
  const janela = grande ? 1000000 : padrao
  const razao = uso.tokens / janela
  const faixa = Math.floor(razao * 10)
  const anterior = Number(gravado.faixa) || 0
  const lembrar = (f) => { if (sessao) gravarEstado(sessao, home, { faixa: f, grande }) }
  if (razao < cfg.limite) { if (anterior || (grande && !gravado.grande)) lembrar(0); return null }
  if (faixa <= anterior) return null
  lembrar(faixa)
  return { pct: Math.round(razao * 100), faixa }
}
