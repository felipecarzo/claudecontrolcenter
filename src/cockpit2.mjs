/**
 * Cockpit 2: o motor de leitura do modelo "projeto único, máquina é atributo".
 *
 * Pesquisa e decisões em `docs/produto/COCKPIT2-PESQUISA.md` (seções 4 e 9.5).
 * Só junta o que os outros módulos já derivam; não grava nada e não muda o
 * formato de ninguém. A tela `/cockpit2` lê apenas `GET /api/cockpit2`.
 *
 * O campo novo de verdade é `espera[].pergunta`: a última fala do agente,
 * lida da cauda do transcrito. Sem ele o cartão "precisa de você" só sabia
 * devolver o assunto, que era a queixa dele em 11/09.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { todosOsJobs } from './sessoes.mjs'
import { JOBS_DIR } from './jobs.mjs'
import { readServers } from './servers.mjs'
import { listarContainers } from './docker.mjs'
import * as meu from './meu.mjs'
import { maquina as maquinaLocal, origem as origemDaMaquina } from './maquina-id.mjs'
import { chaveDeProjeto, nomeCanonico } from './nomeProjeto.mjs'
import { CACHE_FILE as TEMPO_CACHE, resumo as resumoTempo } from './tempo.mjs'
import { lerFila } from './ideias.mjs'
import { lerPacotes, mesclar, maquinasConhecidas } from './federacao.mjs'
import { configAtual, lerFechadas, lerMantidas, chaveDoCartao, lerDepois, depoisVale, permissaoDaTela, teclaDaPermissao, lerPedidosDoGancho } from './decisao.mjs'
import { estado as estadoRC, saudeDaTela } from './remotecontrol.mjs'
import { execFile } from 'node:child_process'
import { registrar as registrarHistorico } from './decisaoHistorico.mjs'
import * as resumoAgy from './resumoAgy.mjs'
import { raioX } from './raioX.mjs'
import { createHash } from 'node:crypto'
import { casaClaude as casaClaudeDir, memoriaDosProcessos } from './platform.mjs'

const CAUDA = 256 * 1024
const MIN_PORTA = 1024

/* ───────────────────────── a última fala do agente ───────────────────────── */

function lerCauda(arquivo, bytes = CAUDA) {
  const fd = fs.openSync(arquivo, 'r')
  try {
    const { size } = fs.fstatSync(fd)
    const len = Math.min(bytes, size)
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, size - len)
    return { texto: buf.toString('utf8'), parcial: len < size }
  } finally {
    fs.closeSync(fd)
  }
}

/* Linha de separação ("---- // resumo // ----", "===") e cabeçalho markdown
   não são fala: sem isto o cartão mostrava uma régua de traços como se o
   agente tivesse dito aquilo. */
const semMarcadores = (s) => String(s || '')
  .split('\n')
  .filter((l) => !/^\s*[-=_*#]{3,}.*$/.test(l) && !/^\s*[-=_ ]*\/\/.*\/\/[-=_ ]*\s*$/.test(l))
  .map((l) => l.replace(/^\s*#{1,6}\s+/, ''))
  .join('\n')

/* CC-589, 27/09: o resumo do cartão. Os agentes dele separam o raciocínio do
   que mudou para ele com a linha "// resumo //"; o resumo é o que vem ABAIXO
   dela. Sem a linha, as três primeiras frases. Nenhuma chamada a modelo. */
export function resumoDaFala(txt) {
  const linhas = String(txt || '').split('\n')
  const i = linhas.findIndex((l) => /\/\/\s*resumo\s*\/\//i.test(l))
  const corpo = i >= 0 ? linhas.slice(i + 1).join('\n') : null
  const limpo = (s) => s.split('\n').map((l) => l.replace(/^\s*#{1,6}\s+/, '').replace(/\*\*([^*]*)\*\*/g, '$1').replace(/`([^`]*)`/g, '$1').trimEnd())
    .filter((l, k, a) => l.trim() || (k > 0 && a[k - 1].trim())).join('\n').trim()
  if (corpo && corpo.trim()) { const r = limpo(corpo); return r.length > 900 ? r.slice(0, 897).trimEnd() + '…' : r }
  const t = semMarcadores(txt).replace(/\s+/g, ' ').trim()
  const frases = t.match(/[^.!?]+[.!?]+(\s|$)/g) || [t]
  const r = frases.slice(0, 3).join('').trim()
  return r.length > 420 ? r.slice(0, 417).trimEnd() + '…' : r
}

const primeiraFrase = (s) => {
  const t = semMarcadores(s).replace(/\s+/g, ' ').trim()
  const m = t.match(/^(.{20,240}?[.!?])\s/)
  return (m ? m[1] : t.slice(0, 240)).trim()
}

/**
 * Lê as linhas de um transcrito (já em texto) de trás para frente e devolve a
 * última fala do agente: o texto e, se a fala foi uma pergunta com opções
 * (AskUserQuestion), a pergunta e as opções. Puro, para o teste.
 */
export function falaDasLinhas(texto, { parcial = false } = {}) {
  const linhas = String(texto || '').split('\n')
  if (parcial) linhas.shift()
  /* 27/09: pergunta já respondida (no terminal ou pelo painel) não é mais
     pergunta. Lendo de trás para frente, a resposta (tool_result) aparece
     ANTES da pergunta; sem guardar isso, o cartão mostrava a pergunta enquanto
     o agente já pensava na resposta. */
  const respondidas = new Set()
  /* CC-606: a última ação ainda sem resultado. Com o registro dizendo
     `waiting`, é o que o terminal está pedindo para permitir. */
  let pendente; let achou = false
  const r = (x) => (x && pendente ? { ...x, pendente } : x)
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    const l = linhas[i].trim()
    if (!l) continue
    if (l.includes('"tool_result"')) {
      try {
        const u = JSON.parse(l)
        if (u?.type === 'user') for (const x of (u.message?.content || [])) if (x?.type === 'tool_result' && x.tool_use_id) respondidas.add(x.tool_use_id)
      } catch { /* linha cortada */ }
    }
    if (!l.includes('"assistant"')) continue
    let e = null
    try { e = JSON.parse(l) } catch { continue }
    if (e?.type !== 'assistant' || e.isSidechain) continue
    const partes = Array.isArray(e.message?.content) ? e.message.content : []
    if (!achou) {
      achou = true
      const p = partes.find((x) => x?.type === 'tool_use' && x.name !== 'AskUserQuestion' && !respondidas.has(x.id))
      if (p) pendente = { id: p.id || null, nome: p.name, descricao: String(p.input?.description || '').slice(0, 200), comando: String(p.input?.command || p.input?.file_path || p.input?.url || '').slice(0, 600) }
    }
    const pergunta = partes.find((p) => p?.type === 'tool_use' && p.name === 'AskUserQuestion' && !respondidas.has(p.id))
    const jaRespondida = partes.some((p) => p?.type === 'tool_use' && p.name === 'AskUserQuestion' && respondidas.has(p.id))
    if (jaRespondida && !pergunta) {
      const t = partes.filter((p) => p?.type === 'text').map((p) => p.text).join(' ').trim()
      return r({ tipo: 'fala', texto: t ? primeiraFrase(t) : 'pergunta respondida, o agente está seguindo', resumo: t ? resumoDaFala(t) : null, opcoes: [], quantas: 0, em: e.timestamp || null, respondida: true })
    }
    if (pergunta) {
      const qs = Array.isArray(pergunta.input?.questions) ? pergunta.input.questions : []
      const q = qs[0] || {}
      /* CC-596, print dele de um cartão "sem info nenhuma": o contexto é o que
         o agente escreveu ANTES de perguntar, na mesma resposta e nas anteriores
         até a última mensagem dele (Felipe). Sai da própria conversa. */
      const antes = [partes.filter((p) => p?.type === 'text').map((p) => p.text).join('\n')]
      for (let j = i - 1; j >= 0 && j > i - 400; j -= 1) {
        const lj = linhas[j].trim(); if (!lj) continue
        let x = null
        try { x = JSON.parse(lj) } catch { continue }
        if (x?.isSidechain) continue
        const cs = Array.isArray(x?.message?.content) ? x.message.content : (typeof x?.message?.content === 'string' ? [{ type: 'text', text: x.message.content }] : [])
        if (x?.type === 'user' && cs.some((c) => c?.type === 'text')) break // a mensagem dele: o contexto começa depois dela
        if (x?.type === 'assistant') antes.unshift(cs.filter((c) => c?.type === 'text').map((c) => c.text).join('\n'))
      }
      /* O que explica a pergunta é o que veio por ÚLTIMO antes dela: junta de
         trás para frente até ~700 letras, em vez de pegar o começo da sequência
         (que medido no ahtleta-corrida era "Renderizo o corredor…", e a parte que
         importava, "Montei três propostas de logo…", ficava de fora). */
      const falas = antes.filter((t) => t && t.trim())
      const escolhidas = []
      for (let k = falas.length - 1; k >= 0; k -= 1) {
        escolhidas.unshift(falas[k])
        if (escolhidas.join('\n\n').length > 700) break
      }
      const contextoCru = escolhidas.join('\n\n').trim()
      return {
        tipo: 'pergunta',
        texto: String(q.question || '').trim() || null,
        opcoes: (q.options || []).map((o) => String(o?.label || '')).filter(Boolean),
        contexto: contextoCru ? resumoDaFala(contextoCru) : null,
        quantas: qs.length,
        em: e.timestamp || null,
        /* CC-556: o id e as perguntas inteiras, para responder pelo painel.
           O servidor confere de novo no transcrito antes de apertar tecla. */
        id: pergunta.id || null,
        perguntas: qs.map((x) => ({
          pergunta: String(x?.question || '').trim(),
          opcoes: (x?.options || []).map((o) => String(o?.label || '')).filter(Boolean),
          /* CC-596: a explicação que o agente escreveu para cada opção. */
          descricoes: (x?.options || []).filter((o) => o?.label).map((o) => String(o?.description || '')),
          multipla: Boolean(x?.multiSelect),
        })),
      }
    }
    const txt = partes.filter((p) => p?.type === 'text').map((p) => p.text).join(' ').trim()
    if (txt) return r({ tipo: 'fala', texto: primeiraFrase(txt), resumo: resumoDaFala(txt), opcoes: [], quantas: 0, em: e.timestamp || null })
  }
  return pendente ? { tipo: 'fala', texto: null, opcoes: [], quantas: 0, em: null, pendente } : null
}

/**
 * CC-589: a última resposta INTEIRA do agente, para o "ver resposta completa"
 * do cartão. Só conversa desta máquina; o id é conferido antes de virar nome de
 * arquivo, para a rota não servir de leitor de arquivo qualquer.
 */
/**
 * CC-631: as últimas falas da conversa, dos dois lados, para o modo lista da
 * tela Sessões. Puro sobre o texto do transcrito. Fica de fora o que não é
 * fala de gente: saída de ferramenta, texto de skill, comando, sub-agente.
 */
export function falasDaConversa(texto, { parcial = false, limite = 30 } = {}) {
  const linhas = String(texto || '').split('\n'); if (parcial) linhas.shift()
  const out = []
  for (const l of linhas) {
    /* Linha gigante é imagem embutida (print): parsear custava segundos e não
       tem fala para mostrar. */
    if (l.length > 200000) continue
    if (!l.includes('"user"') && !l.includes('"assistant"')) continue
    let o = null
    try { o = JSON.parse(l) } catch { continue }
    if (o?.isSidechain || o?.isMeta) continue
    const c = o?.message?.content
    if (o.type === 'user') {
      const t = typeof c === 'string' ? c : (Array.isArray(c) ? c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n') : '')
      if (!t || !t.trim() || /^\s*<(command|system|local-command|task-notification)/.test(t)) continue
      out.push({ quem: 'voce', texto: t.trim().slice(0, 6000), em: o.timestamp || null })
    } else if (o.type === 'assistant' && Array.isArray(c)) {
      const t = c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n').trim()
      const perg = c.find((x) => x?.type === 'tool_use' && x.name === 'AskUserQuestion')
      const txt = t || (perg ? (perg.input?.questions || []).map((q) => q.question).join('\n') : '')
      if (!txt) continue
      /* A mesma resposta do agente chega em várias linhas seguidas: junta. */
      const ult = out[out.length - 1]
      if (ult && ult.quem === 'agente' && ult.junta) { ult.texto = (ult.texto + '\n\n' + txt).slice(-8000); ult.em = o.timestamp || ult.em }
      else out.push({ quem: 'agente', texto: txt.slice(0, 8000), em: o.timestamp || null, junta: true })
    }
  }
  return out.slice(-limite).map(({ junta, ...x }) => x)
}

export function conversaRecente(conversa) {
  if (!/^[0-9a-f-]{8,40}$/i.test(String(conversa || ''))) return null
  const base = path.join(casaClaudeDir(), 'projects')
  let arquivo = null
  try {
    for (const d of fs.readdirSync(base, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const f = path.join(base, d.name, conversa + '.jsonl')
      if (fs.existsSync(f)) { arquivo = f; break }
    }
  } catch { return null }
  if (!arquivo) return null
  let st
  try { st = fs.statSync(arquivo) } catch { return null }
  const c = cacheConversa.get(arquivo)
  if (c && c.size === st.size && c.mtimeMs === st.mtimeMs) return c.r
  const { texto, parcial } = lerCauda(arquivo, 1024 * 1024)
  const r = { falas: falasDaConversa(texto, { parcial }) }
  cacheConversa.set(arquivo, { size: st.size, mtimeMs: st.mtimeMs, r })
  return r
}
const cacheConversa = new Map()

export function falaCompleta(conversa) {
  if (!/^[0-9a-f-]{8,40}$/i.test(String(conversa || ''))) return null
  const base = path.join(casaClaudeDir(), 'projects')
  let arquivo = null
  try {
    for (const d of fs.readdirSync(base, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const f = path.join(base, d.name, conversa + '.jsonl')
      if (fs.existsSync(f)) { arquivo = f; break }
    }
  } catch { return null }
  if (!arquivo) return null
  const { texto, parcial } = lerCauda(arquivo)
  const linhas = texto.split('\n'); if (parcial) linhas.shift()
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    if (!linhas[i].includes('"assistant"')) continue
    let e = null
    try { e = JSON.parse(linhas[i]) } catch { continue }
    if (e?.type !== 'assistant' || e.isSidechain) continue
    const txt = (e.message?.content || []).filter((p) => p?.type === 'text').map((p) => p.text).join('\n').trim()
    if (txt) return { texto: txt.length > 20000 ? txt.slice(0, 20000) + '\n…' : txt, em: e.timestamp || null }
  }
  return null
}

const cacheFala = new Map() // arquivo -> { size, mtimeMs, fala }

export function ultimaFalaDoAgente(arquivo) {
  if (!arquivo) return null
  let st
  try { st = fs.statSync(arquivo) } catch { return null }
  const c = cacheFala.get(arquivo)
  if (c && c.size === st.size && c.mtimeMs === st.mtimeMs) return c.fala
  let fala = null
  try {
    const { texto, parcial } = lerCauda(arquivo)
    fala = falaDasLinhas(texto, { parcial })
    /* CC-596: o contexto da pergunta pode estar antes do pedaço final lido
       (256 KB). Medido no ahtleta-corrida: as últimas linhas carregavam imagem
       embutida, e o pedaço cobria só elas. Pergunta sem contexto relê até 4 MB,
       uma vez por mudança do arquivo (o resultado fica no cache abaixo). */
    if (fala?.tipo === 'pergunta' && !fala.contexto) {
      const maior = lerCauda(arquivo, 4 * 1024 * 1024)
      const f2 = falaDasLinhas(maior.texto, { parcial: maior.parcial })
      if (f2?.tipo === 'pergunta' && f2.contexto) fala.contexto = f2.contexto
    }
    /* CC-556: a conversa é o nome do transcrito. É ela que o painel manda de
       volta para responder a pergunta pelo terminal da sessão. */
    if (fala) fala.conversa = path.basename(arquivo, '.jsonl')
  } catch { fala = null }
  cacheFala.set(arquivo, { size: st.size, mtimeMs: st.mtimeMs, fala })
  return fala
}

/**
 * A última fala do agente de UM job, seja ele de fundo ou sessão interativa.
 *
 * Existe exportada porque quem monta o pacote da federação precisa dela: é o
 * que faz o cartão da outra máquina dizer o que o agente perguntou, em vez de
 * "parou sem perguntar". Devolve `null` para quem não está parado, e a conta
 * de custo é essa: ler a cauda só de quem espera resposta.
 */
export function falaDeJob(job, { soParado = true } = {}) {
  if (!job) return null
  if (soParado && job.status !== 'waiting' && !job.permissao) return null
  return ultimaFalaDoAgente(transcritoDe(job))
}

/** Conversa desta máquina em que o agente ainda não disse nada. Só olha
 *  arquivo pequeno: conversa grande já teve troca, e ler inteira custaria. */
export function conversaSemFala(arquivo) {
  if (!arquivo) return false
  try {
    if (fs.statSync(arquivo).size > CAUDA) return false
    return !/"type"\s*:\s*"assistant"/.test(fs.readFileSync(arquivo, 'utf8'))
  } catch { return false }
}

const cacheTranscrito = new Map() // id do job -> caminho
function transcritoDe(job) {
  if (job.transcript) return job.transcript
  if (cacheTranscrito.has(job.id)) return cacheTranscrito.get(job.id)
  let caminho = null
  try {
    const st = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, job.id, 'state.json'), 'utf8'))
    caminho = st.linkScanPath || null
  } catch { caminho = null }
  cacheTranscrito.set(job.id, caminho)
  return caminho
}

/* ───────────────────────────── o modelo ───────────────────────────── */

const tipoDaSessao = (j) => {
  if (j.tipo === 'coderoom') return 'coderoom'
  if (j.tipo === 'interativa') return j.remoto ? 'remote control' : 'claude code'
  return 'claude code (fundo)'
}
/* CC-740: o endereço da sessão no app do Claude. Vem pela rede quando a sessão
   é de outra máquina, então só passa no formato exato. */
const appUrlDe = (j) => (/^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]{10,60}$/.test(String(j?.appUrl || '')) ? j.appUrl : null)

/**
 * A fala de uma conversa do coderoom, no MESMO formato da fala lida do arquivo
 * de transcrição do Claude Code.
 *
 * O motivo de existir é o pedido dele: o cartão das sessões do opencode tinha
 * que ser igual ao do Claude, com resumo e com campo para responder. O
 * histórico do coderoom não é um `.jsonl` do Claude Code, é o log do gate, e
 * `falaDe` só sabe ler o primeiro. Esta função é a ponte, e ela fica aqui, ao
 * lado de `primeiraFrase` e `resumoDaFala`, para os dois caminhos nunca
 * divergirem no que é "resumo" e no que é "primeira frase".
 *
 * O `conversa` sai com o prefixo `gate:` porque é ele que diz ao resto do
 * painel para onde mandar a resposta: `decisao.mjs` escreve no terminal, o
 * coderoom tem o caminho dele. Sem o prefixo, os dois se confundem e a
 * mensagem vai para o terminal errado.
 */
const falaDoCoderoom = (j) => {
  if (!j.ultima?.texto) return null
  return {
    tipo: 'fala',
    texto: primeiraFrase(j.ultima.texto),
    /* O marcador `// resumo //` é dos agentes do Claude Code; no coderoom o
       resumo que vale é o automático (o agy lê o texto e escreve), pedido logo
       abaixo em `responder()`. */
    resumo: resumoDaFala(j.ultima.texto),
    conversa: 'gate:' + j.id,
    em: j.ultima.em || null,
  }
}

const estadoDaSessao = (j) => {
  if (j.stale) return 'sem sinal'
  /* 27/09: o programa da sessão foi fechado (registro de sessões abertas do
     Claude Code). A conversa gravada continua, mas não há ninguém do outro
     lado: nem conectada, nem decisão. */
  if (j.aberta === false) return 'encerrada'
  if (j.permissao) return 'espera você' // CC-606: parada no pedido de permissão
  if (j.status === 'working') return 'trabalhando'
  if (j.status === 'waiting') return 'espera você'
  if (j.status === 'failed') return 'falhou'
  if (j.status === 'done') return 'entregou'
  return 'ociosa'
}

const bloqueioDe = (j) => {
  const b = (j.blockers || []).filter(Boolean)[0]
  return typeof b === 'string' ? b : (b?.text || b?.t || null)
}

/** Pasta pessoal de usuário, em qualquer sistema: `C:\Users\fulano`,
 *  `/home/fulano`, `/Users/fulano`. Só a pasta em si; subpasta é projeto. */
export function ehPastaPessoal(cwd) {
  return /^(?:[A-Za-z]:)?[\\/](?:Users|home)[\\/][^\\/]+[\\/]?$/i.test(String(cwd || '').trim())
}

/** O que o cartão de aviso mostra sobre um agente parado. Sem fala legível,
 *  diz isso com todas as letras em vez de devolver o assunto. */
export function avisoDoAgente(j, fala, dispositivo, agora) {
  const travado = bloqueioDe(j)
  const base = {
    tipo: 'agente', id: j.id, projeto: chaveDeProjeto(j.project), nome: nomeCanonico(j.project),
    frente: j.frente || null, assunto: j.subject || null, dispositivo, modelo: j.model || null,
    desdeMs: Math.max(0, agora - (j.updatedAt || agora)), sessao: tipoDaSessao(j),
    // CC-728: quem responde na conversa do Coderoom, para o seletor do cartão
    agente: j.tipo === 'coderoom' ? (j.template || null) : null,
  }
  if (travado) return { ...base, rotulo: 'travado', pergunta: travado, opcoes: [], acao: 'destravar' }
  /* CC-606: o terminal parado num pedido de permissão. */
  if (j.permissao && fala?.pendente) {
    const pd = fala.pendente
    return { ...base, rotulo: 'permissão', pergunta: pd.descricao || ('quer usar ' + pd.nome), ferramenta: pd.nome, comando: pd.comando || null, permissaoId: pd.id || null, opcoes: [], acao: 'responder' }
  }
  if (fala?.tipo === 'pergunta' && fala.texto) {
    return {
      ...base, rotulo: 'pergunta', pergunta: fala.texto, opcoes: fala.opcoes, quantas: fala.quantas, acao: 'responder',
      contexto: fala.contexto || null, perguntasTodas: fala.perguntas || null,
      responder: fala.id && fala.conversa ? { conversa: fala.conversa, id: fala.id, perguntas: fala.perguntas || [] } : null,
    }
  }
  if (fala?.tipo === 'fala' && fala.texto) {
    return { ...base, rotulo: 'parou', pergunta: fala.texto, resumo: fala.resumo || null, opcoes: [], acao: 'responder' }
  }
  return { ...base, rotulo: 'parou sem perguntar', pergunta: null, opcoes: [], acao: 'abrir' }
}

const porTempo = (a, b) => (b.desdeMs || 0) - (a.desdeMs || 0)
/** CC-561: pendência parada há mais disto sai das decisões e vai para a gaveta. */
export const GAVETA_MS = 7 * 24 * 3600 * 1000
/** Cartão de agente parado SEM pergunta, sem movimento há mais disto, sai
 *  sozinho das decisões (26/09). Pergunta com opções nunca sai sozinha. */
export const TRAVADA_MS = 2 * 3600 * 1000

/* O rótulo da ferramenta em voo às vezes é a linha de comando INTEIRA: medido
   em 11/09, um `Bash` veio com 240 caracteres de `cd ... && node ... | grep`,
   e a linha da sessão quebrava em quatro no inspetor. Cortar aqui e não na
   tela porque as duas telas mostram o mesmo campo. */
const ferramentaCurta = (s, n = 60) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

function servicoDaPorta(s, dispositivo, agora) {
  return {
    tipo: 'porta', nome: s.kind || s.name || '?', porta: s.ports?.[0] ?? null, pid: s.pid,
    projeto: s.project ? chaveDeProjeto(s.project) : null, nomeProjeto: s.project ? nomeCanonico(s.project) : null,
    dispositivo, desdeMs: s.startedAt ? Math.max(0, agora - s.startedAt) : null,
    url: s.url || null, encerravel: Boolean(s.dev && !s.protegido), detalhe: s.resumo || s.titulo || null,
  }
}

function servicoDoContainer(c, chaves, dispositivo) {
  const nome = String(c.nome || '')
  const chave = chaves.find((k) => k && (nome === k || nome.startsWith(`${k}-`) || nome.startsWith(`${k}_`))) || null
  return {
    tipo: 'container', nome, porta: (c.portas || []).map((p) => String(p).match(/:(\d+)->/)?.[1]).filter(Boolean)[0] ?? null,
    projeto: chave, nomeProjeto: chave, dispositivo, desdeMs: null, url: null, encerravel: false,
    detalhe: `${c.imagem || ''} · ${c.status || ''}`.trim(),
  }
}

/**
 * Junta tudo no formato da seção 9.5 da pesquisa. Puro: recebe listas prontas
 * e a função que lê a fala (injetada, para o teste não tocar disco).
 */
export function montar({
  jobs = [], servers = [], containers = [], tarefas = [], tempo = null,
  local = { id: null, nome: 'esta máquina' }, agora = Date.now(), falaDe = () => null,
  ignorar = [], maquinas = null, fechadas = new Set(), mantidas = new Set(), depois = {}, blocosTempo = null,
} = {}) {
  const disp = local.nome || 'esta máquina'
  let fechadasOcultas = 0
  let travadasOcultas = 0
  const ocultas = []
  /* De qual máquina veio esta linha. O que chega pela federação carrega
     `origem`; o que é daqui não carrega nada. É esta função que faz o projeto
     ser UM só com a máquina ao lado, em vez de dois projetos. */
  const ondeEsta = (x) => x?.origem?.nome || disp
  /* Veio de OUTRA máquina? Não basta ter `origem`: ao juntar as listas, a
     federação carimba a origem em TODAS as linhas, inclusive nas daqui. Sem
     esta distinção o filtro de serviços deixava passar processo de sistema
     (medido: a lista foi de 10 para 33, com `mDNSResponder` e `wslrelay`
     dentro), porque "tem origem" virou sempre verdadeiro. */
  const deFora = (x) => Boolean(x?.origem?.id && local.id && x.origem.id !== local.id)
  const projetos = new Map()
  /* A pasta de usuário vira "projeto" quando uma sessão abre nela. Não é
     trabalho, é lugar de passagem, e não entra na lista. */
  const fora = new Set(ignorar.map(chaveDeProjeto).filter(Boolean))
  const projetoDe = (nomeCru) => {
    const chave = chaveDeProjeto(nomeCru)
    if (!chave || fora.has(chave)) return null
    if (!projetos.has(chave)) {
      projetos.set(chave, {
        chave, nome: nomeCanonico(nomeCru), presenca: new Set(), espera: [], sessoes: [], servicos: [],
        frenteEmCurso: null, pendencias: [], horasHoje: null, ultimaAtividade: 0, raiz: null,
      })
    }
    return projetos.get(chave)
  }

  for (const j of jobs) {
    const p = projetoDe(j.project)
    if (!p) continue
    const semContato = Boolean(j.origem?.semContato)
    const onde = ondeEsta(j)
    /* A pasta só vale se a sessão é DESTA máquina. ⚠️ `mesclar` carimba
       `origem` também nas sessões locais (o mesmo defeito de 23/09 na fala):
       "sem origem" deixava todo projeto sem pasta, e a fila de ideias nunca
       era lida. Medido em 26/09: as filas tinham 2 ideias, a Início mostrava 0. */
    const daqui = !j.origem || (local.id && j.origem.id === local.id)
    if (!p.raiz && j.cwd && daqui) p.raiz = j.cwd
    /* 26/09, item 1 da tela Projetos ("limpar a lista"): a pasta pessoal de
       OUTRA máquina (C:\Users\fulano, /home/fulano) também não é projeto. A
       daqui já sai por `ignorar`; a de lá não dá para saber pelo nome, só pela
       pasta. Não some do painel: as decisões e sessões dela continuam na
       Início; só a lista de Projetos a deixa de fora. */
    if (ehPastaPessoal(j.cwd)) p.pastaPessoal = true
    if (!semContato && !j.stale) p.presenca.add(onde)
    p.ultimaAtividade = Math.max(p.ultimaAtividade, j.updatedAt || 0)
    /* 26/09, item 4 da Início: a linha da sessão mostrava o PEDIDO dele
       (o `subject` cai no último prompt quando o agente não resumiu), e não o
       que o agente está fazendo. A última fala do agente vai junto, e a
       conversa também, para o botão de parar saber qual terminal é. Só para
       quem trabalha agora: a leitura tem cache por tamanho do arquivo. */
    /* Item 6 da tela Projetos (26/09): a parada também mostra a última fala,
       não só a que trabalha. */
    const falaSessao = (j.status === 'working' || j.status === 'waiting' || j.status === 'idle') && !j.stale && !semContato
      ? (j.tipo === 'coderoom' ? falaDoCoderoom(j) : falaDe(j))
      : null
    p.sessoes.push({
      id: j.id, tipo: tipoDaSessao(j), dispositivo: onde, modelo: j.model || null,
      estado: estadoDaSessao(j), ferramenta: ferramentaCurta(j.inFlight?.[0]?.label) || null,
      desdeMs: Math.max(0, agora - (j.updatedAt || agora)), frente: j.frente || null, assunto: j.subject || null,
      todos: j.todos?.length || 0, todosDone: j.todosDone || 0,
      /* Qual agente responde nesta sessão. Só o coderoom tem: lá a escolha é
         dele e muda de conversa para conversa, e sem isso o cartão dizia
         "claude code (fundo)" para uma conversa do opencode. */
      agente: j.tipo === 'coderoom' ? (j.template || null) : null,
      fala: falaSessao?.texto || null, conversa: falaSessao?.conversa || null,
      resumo: falaSessao?.resumo || null, marca: falaSessao?.em || null,
      porPrograma: Boolean(j.porPrograma),
      appUrl: appUrlDe(j),
    })
    if ((j.status === 'working' || j.status === 'waiting') && j.frente && !p.frenteEmCurso) p.frenteEmCurso = j.frente
    if (!j.stale && !semContato && j.aberta !== false && (j.status === 'waiting' || j.status === 'idle' || j.status === 'working')) {
      /* Três regras de 23 e 26/09, nesta ordem:
         1. Pergunta com opções entra NA HORA, qualquer que seja o estado: o
            "espera você" só vale depois de 1 minuto sem escrever, e a pergunta
            já estava lá (pedido dele, item 3 da Início). E não envelhece:
            ociosa há horas com pergunta aberta continua esperando.
         2. Parada SEM pergunta há mais de 2 horas sai sozinha ("auto-deletar
            decisões que estão travadas"), e sai contada, não calada.
         3. Cartão que ele fechou some até a sessão se mexer (fala nova muda a
            marca e o cartão volta, porque aí é outra decisão). */
      /* CC-728: conversa do Coderoom não tem transcrito do Claude Code; a fala
         dela sai do log do gate. Lida pelo caminho do terminal, vinha vazia, e
         o aviso "parou" nascia sem fala e sem conversa: sem campo de resposta
         e sem o seletor de quem responde (medido em 30/09). */
      const fala = j.tipo === 'coderoom' ? falaDoCoderoom(j) : falaDe(j)
      /* Sessão "trabalhando" com outra ferramenta em andamento (Edit, Bash)
         não está parada na pergunta, mesmo que ela seja a última fala do
         arquivo: o teste do motor pegou isso na primeira versão. */
      const outraFerramenta = j.status === 'working' && (j.inFlight || []).some((x) => x?.label && !/AskUserQuestion/i.test(x.label))
      /* CC-606: pedido de permissão conta como pergunta: entra na hora e não envelhece. */
      const ehPergunta = (fala?.tipo === 'pergunta' && !outraFerramenta) || Boolean(j.permissao && fala?.pendente)
      /* 26/09: sessão aberta pelo painel e ainda sem conversa nenhuma virava
         "parou sem pergunta legível" na Decisões. Não há decisão ali: ela
         espera o primeiro pedido dele, e já aparece em Sessões. */
      if (!fala && conversaSemFala(transcritoDe(j))) continue
      /* 26/09, print dele do app com 8 sessões conectadas: parada sem
         pergunta começa "espera você" e, com o tempo, vira "ociosa", e aí
         saía da Decisões SEM ir para "Fechadas e antigas". Sumia calada, com
         "write 'pode codar' to unblock coding" esperando ele. Ociosa com fala
         do agente é parada também, e segue a regra das 2 horas. */
      const ociosaComFala = j.status === 'idle' && Boolean(fala?.texto)
      /* 27/09: sessão disparada por programa (`claude -p`) não é decisão
         dele: rodou, respondeu e acabou, e não há a quem responder. Dois
         testes da skill das gavetas, rodados na pasta do sumauma, apareceram
         como "PAROU · sumauma" por causa da regra da ociosa com fala. */
      if (j.porPrograma) continue
      if (ehPergunta || j.status === 'waiting' || ociosaComFala) {
        const aviso = avisoDoAgente(j, fala, onde, agora)
        aviso.marca = fala?.em || null
        /* Para onde mandar mensagem livre. Só existe para sessão DAQUI: a
           conversa de outra máquina não tem terminal que o painel alcance. */
        aviso.conversa = fala?.conversa || null
        aviso.esperaTerminal = Boolean(j.permissao) // CC-638: o registro diz que o terminal espera
        aviso.appUrl = appUrlDe(j) // CC-740
        /* 26/09, tela Decisões item 4: o que sai da lista também vai, marcado,
           para a aba "Fechadas e antigas", com "reabrir". Cartão reaberto
           (mantidas) não some pela idade. */
        const k = chaveDoCartao(aviso.id, aviso.marca)
        /* CC-630: "para depois" vem antes de tudo, inclusive de pergunta. */
        const dp = depois[aviso.id]
        if (dp && depoisVale(dp, aviso.marca, agora, { pergunta: ehPergunta })) ocultas.push({ ...aviso, oculta: 'depois', depoisModo: dp.modo, depoisAte: dp.ate || null })
        else if (fechadas.has(k)) { fechadasOcultas += 1; ocultas.push({ ...aviso, oculta: 'fechada' }) }
        /* 27/09, decisão dele: "um projeto ativo sempre aparece". Sessão
           com o programa ABERTO nunca sai sozinha pela idade: só sai quando é
           desligada, volta a trabalhar, ou ele fecha o cartão. A regra das 2
           horas fica só para quem não se sabe se está aberto (a outra máquina,
           os jobs de fundo). */
        else if (!ehPergunta && j.aberta !== true && aviso.desdeMs > TRAVADA_MS && !mantidas.has(k)) { travadasOcultas += 1; ocultas.push({ ...aviso, oculta: 'antiga' }) }
        else p.espera.push(aviso)
      }
    }
  }

  for (const s of servers) {
    if (s.protegido || (s.ports?.[0] ?? 0) < MIN_PORTA) continue
    /* O que vem de fora não traz `dev`: a outra ponta já filtrou o que valia a
       pena mandar. Exigir `dev` aqui apagaria a metade remota da lista. */
    if (!s.project && !s.dev && !deFora(s)) continue
    const sv = servicoDaPorta(s, ondeEsta(s), agora)
    const p = s.project ? projetoDe(s.project) : null
    if (p) { p.servicos.push(sv); p.presenca.add(sv.dispositivo) }
    else sv.projeto = null
    sv._solto = !p
  }
  const chaves = [...projetos.keys()]
  for (const c of containers) {
    if (c.rodando === false) continue
    const sv = servicoDoContainer(c, chaves, disp)
    const p = sv.projeto ? projetos.get(sv.projeto) : null
    if (p) p.servicos.push(sv)
    sv._solto = !p
  }

  const soltas = []
  /* CC-561, a gaveta. Medido em 25/09: a Início listava 76 decisões, e só 5
     eram agentes esperando; as outras 71 eram pendências dele, 65 com mais de
     7 dias e 28 com mais de um mês. As perguntas vivas ficavam afogadas.
     Pendência parada há mais de 7 dias sai das decisões e vai para a gaveta:
     continua no cartão do projeto e na gaveta, e NADA é apagado. Quem fecha
     pendência continua sendo só ele. */
  const gaveta = []
  for (const t of tarefas) {
    if (t.feito) continue
    const p = t.projeto ? projetoDe(t.projeto) : null
    const pend = {
      tipo: 'pendencia', id: t.id, projeto: p?.chave || null, nome: p?.nome || 'geral', frente: t.frente || null,
      pergunta: t.texto, porque: t.porque || null, dispositivo: t.maquina || disp,
      desdeMs: t.em ? Math.max(0, agora - t.em) : null, acao: 'feito',
    }
    if (p) p.pendencias.push(pend)
    if (pend.desdeMs != null && pend.desdeMs > GAVETA_MS) { gaveta.push(pend); continue }
    if (p) p.espera.push(pend); else soltas.push(pend)
  }

  /* 26/09: com os trechos do cache, a semana sai por relógio e por agente,
     no dia de Brasília; sem eles, cai na conta antiga pelos totais. */
  const semana = blocosTempo ? semanaDosBlocos(blocosTempo, { agora }) : semanaDe(tempo, agora)
  if (blocosTempo && local.nome) semana.fonte = local.nome
  if (tempo?.projetos) {
    const hoje = new Date(agora).toISOString().slice(0, 10)
    for (const tp of tempo.projetos) {
      const p = projetos.get(chaveDeProjeto(tp.projeto))
      if (!p) continue
      const dia = (tp.dias || []).find((d) => d.dia === hoje)
      p.horasHoje = dia?.ativoMs ?? 0
      p.ultimos7 = semana.dias.map((d) => (tp.dias || []).find((x) => x.dia === d.dia)?.ativoMs || 0)
    }
  }

  const lista = [...projetos.values()].map((p) => ({
    ...p,
    presenca: [...p.presenca],
    espera: p.espera.sort(porTempo),
    sessoes: p.sessoes.sort((a, b) => a.desdeMs - b.desdeMs),
    vivas: p.sessoes.filter((s) => s.estado === 'trabalhando' || s.estado === 'espera você').length,
  })).sort((a, b) =>
    b.espera.length - a.espera.length
    || b.vivas - a.vivas
    || b.ultimaAtividade - a.ultimaAtividade)

  const servicos = [
    ...servers.filter((s) => !s.protegido && (s.ports?.[0] ?? 0) >= MIN_PORTA && (s.project || s.dev || deFora(s))).map((s) => servicoDaPorta(s, ondeEsta(s), agora)),
    ...containers.filter((c) => c.rodando !== false).map((c) => servicoDoContainer(c, chaves, disp)),
  ]

  const espera = [...lista.flatMap((p) => p.espera), ...soltas].sort(porTempo)
  const rodando = lista.flatMap((p) => p.sessoes.filter((s) => s.estado === 'trabalhando').map((s) => ({ ...s, projeto: p.chave, nome: p.nome })))
  /* 26/09: o bloco Sessões da Início passa a mostrar TODAS as conectadas,
     não só quem trabalha neste minuto ("as duas coisas"). Trabalhando no
     topo, depois quem espera ele, depois as ociosas; dentro de cada uma, a
     mais recente primeiro. Sem sinal e entregue ficam de fora. */
  const ORDEM_ESTADO = { trabalhando: 0, 'espera você': 1, ociosa: 2 }
  /* Sessão disparada por programa só conta enquanto trabalha: depois, o
     programa acabou e não há ninguém conectado ali (27/09). */
  const conectadas = lista.flatMap((p) => p.sessoes.filter((s) => s.estado in ORDEM_ESTADO && (!s.porPrograma || s.estado === 'trabalhando')).map((s) => ({ ...s, projeto: p.chave, nome: p.nome })))
    .sort((a, b) => ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado] || (a.desdeMs || 0) - (b.desdeMs || 0))

  return {
    /* As máquinas vêm de quem sabe (a federação); sem essa lista, esta máquina
       é a única que existe. `contato` diz se ela deu sinal recente: máquina
       calada continua na lista, porque sumir seria a tela escondendo que
       existe algo que ela não consegue ver. */
    dispositivos: Array.isArray(maquinas) && maquinas.length
      ? maquinas.map((m) => ({
        id: m.id || null,
        nome: m.nome || '?',
        local: Boolean(m.local ?? (m.id && m.id === local.id)),
        contato: !m.semContato,
        idadeMs: m.idadeMs ?? null,
        empurradores: Array.isArray(m.empurradores) ? m.empurradores : [],
        hw: m.hw || null,
      }))
      : [{ id: local.id, nome: disp, local: true, contato: true, idadeMs: 0 }],
    projetos: lista,
    espera,
    /* A mais velha primeiro: é a que mais precisa de uma decisão, nem que
       seja "não vale mais". */
    gaveta: gaveta.sort((a, b) => (b.desdeMs || 0) - (a.desdeMs || 0)),
    /* As decisões que saíram da lista (fechadas por ele ou paradas há mais
       de 2 horas), para a aba da tela Decisões. */
    ocultas: ocultas.sort(porTempo),
    conectadas,
    rodando,
    servicos,
    semana,
    resumo: {
      projetos: lista.length, comPresenca: lista.filter((p) => p.presenca.length).length,
      espera: espera.length, agentesEsperando: espera.filter((e) => e.tipo === 'agente').length,
      pendencias: espera.filter((e) => e.tipo === 'pendencia').length,
      gaveta: gaveta.length,
      fechadasOcultas, travadasOcultas,
      rodando: rodando.length, servicos: servicos.length,
    },
    lidoEm: agora,
  }
}

/** Os últimos 7 dias, do cache de tempo: total, um valor por dia, e os
 *  projetos que mais levaram. Sem cache, vem vazio e a tela diz isso. */
/**
 * A semana a partir dos TRECHOS de trabalho de cada conversa (26/09, item 11
 * da Início). Três defeitos medidos no bloco antigo, que usava os totais:
 *   1. somava sessões em paralelo: o "hoje" tinha 12,8h numa madrugada que
 *      só tinha ~8h de relógio;
 *   2. virava o dia à meia-noite de Londres (21h de Brasília);
 *   3. não dizia que é só esta máquina.
 * Aqui saem as DUAS contas: horas de agente (a soma de todas as sessões) e
 * horas de relógio (a união dos trechos: houve algum agente trabalhando).
 * `sessoes` é o mapa do cache de tempo: { arquivo: { cwd, blocos: [[ini, fim]] } }.
 * Puro. O fuso é fixo em -3h: o Brasil não tem horário de verão desde 2019.
 */
export function semanaDosBlocos(sessoes, { agora = Date.now(), corteMs = 15 * 60_000, fusoMs = -3 * 3600_000 } = {}) {
  const diaLocal = (ms) => new Date(ms + fusoMs).toISOString().slice(0, 10)
  const inicioDoDia = (dia) => Date.parse(`${dia}T00:00:00Z`) - fusoMs
  const dias = []
  for (let i = 6; i >= 0; i -= 1) dias.push({ dia: diaLocal(agora - i * 86_400_000), ms: 0, relogioMs: 0 })
  const janelaIni = inicioDoDia(dias[0].dia)
  /* Junta trechos vizinhos que cabem no corte, como a tela Tempo faz. */
  const juntar = (bs) => {
    const out = []
    for (const [i, f] of [...bs].sort((a, b) => a[0] - b[0])) {
      const u = out[out.length - 1]
      if (u && i - u[1] <= corteMs) u[1] = Math.max(u[1], f)
      else out.push([i, f])
    }
    return out
  }
  /* Soma por dia local, cortando o trecho na meia-noite de Brasília. */
  const somarNosDias = (trechos, campo, porProj = null, proj = null) => {
    for (const [i0, f] of trechos) {
      let i = Math.max(i0, janelaIni)
      while (i < f) {
        const dia = diaLocal(i)
        const fimDia = inicioDoDia(dia) + 86_400_000
        const fim = Math.min(f, fimDia)
        const d = dias.find((x) => x.dia === dia)
        if (d) { d[campo] += fim - i; if (porProj) porProj.set(proj, (porProj.get(proj) || 0) + (fim - i)) }
        i = fim
      }
    }
  }
  const porProjeto = new Map()
  const todos = []
  let temAlgo = false
  for (const s of Object.values(sessoes || {})) {
    const bs = (s?.blocos || []).filter(([, f]) => f >= janelaIni)
    if (!bs.length) continue
    temAlgo = true
    const unidos = juntar(bs)
    const proj = nomeCanonico(path.basename(String(s.cwd || '?')))
    somarNosDias(unidos, 'ms', porProjeto, proj)
    todos.push(...unidos)
  }
  somarNosDias(juntar(todos), 'relogioMs')
  return {
    disponivel: temAlgo || Object.keys(sessoes || {}).length > 0,
    totalMs: dias.reduce((a, d) => a + d.ms, 0),
    relogioMs: dias.reduce((a, d) => a + d.relogioMs, 0),
    dias,
    porProjeto: [...porProjeto.entries()].map(([nome, ms]) => ({ nome, ms })).sort((a, b) => b.ms - a.ms),
    fonte: 'esta máquina',
  }
}

export function semanaDe(tempo, agora = Date.now()) {
  const dias = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(agora - i * 86_400_000)
    dias.push({ dia: d.toISOString().slice(0, 10), ms: 0 })
  }
  if (!tempo?.projetos) return { disponivel: false, totalMs: 0, dias, porProjeto: [] }
  const porProjeto = new Map()
  for (const tp of tempo.projetos) {
    let ms = 0
    for (const d of dias) {
      const v = (tp.dias || []).find((x) => x.dia === d.dia)?.ativoMs || 0
      d.ms += v
      ms += v
    }
    if (ms > 0) {
      const chave = chaveDeProjeto(tp.projeto)
      porProjeto.set(chave, { chave, nome: nomeCanonico(tp.projeto), ms: (porProjeto.get(chave)?.ms || 0) + ms })
    }
  }
  const lista = [...porProjeto.values()].sort((a, b) => b.ms - a.ms)
  return { disponivel: true, totalMs: dias.reduce((a, d) => a + d.ms, 0), dias, porProjeto: lista.slice(0, 5) }
}

/* ───────────────────────────── a rota ───────────────────────────── */

let tempoCache = { em: 0, dados: null }
/* Os trechos crus do cache de tempo, para a semana (26/09). Mesmo cuidado do
   `tempoBarato`: só lê o que a tela Tempo já gravou, e relê no máximo a cada
   minuto, porque a Início chama a cada 5 segundos. */
let blocosCache = { em: 0, dados: null }
function blocosDoTempo() {
  if (Date.now() - blocosCache.em < 60_000) return blocosCache.dados
  let dados = null
  try { dados = JSON.parse(fs.readFileSync(TEMPO_CACHE, 'utf8')).arquivos || null } catch { dados = null }
  blocosCache = { em: Date.now(), dados }
  return dados
}

function tempoBarato() {
  /* Só lê o que a aba Tempo já gravou. Sem cache no disco, a varredura custa
     segundos e não cabe numa rota que a tela chama a cada 5s. */
  if (!fs.existsSync(TEMPO_CACHE)) return null
  if (Date.now() - tempoCache.em < 60_000) return tempoCache.dados
  try { tempoCache = { em: Date.now(), dados: resumoTempo({ corteMin: 15 }) } } catch { tempoCache = { em: Date.now(), dados: null } }
  return tempoCache.dados
}

/* CC-724, 01/10, print dele: "não apareceu no cockpit", um pedido de permissão
   que ficou na tela sem virar cartão. Medido: naquele minuto o painel não
   respondeu esta rota em 20 s. A montagem leva 0,4 s sozinha, mas dentro do
   painel levava de 2 a 14 s, porque cada tela aberta (celular, PC, Coderoom,
   teste) pede a montagem inteira a cada 5 s e elas disputam o mesmo processo.
   Pedidos simultâneos agora esperam a MESMA montagem, e uma de menos de 2 s
   atrás é reaproveitada: a tela pede de 5 em 5, então 2 s não atrasam nada. */
let montando = null
let ultimaMontagem = { em: 0, dados: null }
export function responder() {
  if (ultimaMontagem.dados && Date.now() - ultimaMontagem.em < 2000) return Promise.resolve(ultimaMontagem.dados)
  if (montando) return montando
  montando = montarResposta()
    .then((d) => { ultimaMontagem = { em: Date.now(), dados: d }; return d })
    .finally(() => { montando = null })
  return montando
}

async function montarResposta() {
  const t0 = Date.now()
  const agora = Date.now()

  /* As duas máquinas, não só esta. O que a outra manda já está guardado em
     disco pela federação (o desktop guarda o retrato da VPS desde a M6 do
     plano); aqui só se junta, com `mesclar`, que é a mesma conta que o resto
     do painel usa e que carimba a origem em cada linha. Falha na leitura dos
     pacotes não pode zerar o que é daqui: é o defeito de "vazio parece
     resposta" que este projeto já pagou três vezes. */
  let pacotes = []
  let eu = null
  let maquinas = null
  try {
    eu = origemDaMaquina()
    pacotes = lerPacotes()
    maquinas = maquinasConhecidas(pacotes, eu)
  } catch { pacotes = []; maquinas = null }

  const locais = todosOsJobs(agora)
  let jobs = locais
  try { jobs = eu ? mesclar(locais, pacotes, eu) : locais } catch { jobs = locais }

  let servers = []
  try { servers = readServers() } catch { servers = [] }
  try { if (eu) servers = mesclar(servers, pacotes, eu, 'servidores') } catch { /* fica só o local */ }
  let containers = []
  try { containers = (await listarContainers())?.containers || [] } catch { containers = [] }
  let tarefas = []
  try {
    const r = meu.tudo(jobs)
    tarefas = Array.isArray(r) ? r : (r?.tarefas || [])
  } catch { tarefas = [] }
  let local = { id: null, nome: 'esta máquina' }
  try { const m = maquinaLocal(); local = { id: m.id, nome: m.nome } } catch { /* fica o padrão */ }
  const tempo = tempoBarato()
  const dados = montar({
    jobs, servers, containers, tarefas, tempo, local, agora, maquinas, fechadas: lerFechadas(), mantidas: lerMantidas(), depois: lerDepois(), blocosTempo: blocosDoTempo(),
    /* Sessão da outra máquina traz a fala pronta no pacote: o transcrito dela
       está no disco de lá e não atravessa. Quem é daqui é lido do arquivo. */
    /* ⚠️ `mesclar` carimba `origem` também nas sessões DESTA máquina (medido em
       23/09: `origem.id` igual ao `eu.id`). Perguntar só "tem origem?" tratava
       toda sessão local como de fora, lia `ultimaFala` (que só o pacote traz),
       achava nada, e o cartão dizia "sem pergunta legível" para qualquer
       pergunta daqui. De fora é só quem tem origem de OUTRA máquina. */
    falaDe: (j) => (j.origem && (!eu || j.origem.id !== eu.id) ? (j.ultimaFala || null) : ultimaFalaDoAgente(transcritoDe(j))),
    ignorar: [path.basename(os.homedir())],
  })
  /* CC-554: quanto cada serviço desta máquina come de memória (com os filhos). */
  try {
    const pids = [...new Set((dados.servicos || []).filter((s) => s.tipo === 'porta' && s.pid && s.dispositivo === local.nome).map((s) => s.pid))]
    const mem = await memoriaDosProcessos(pids)
    const pinta = (s) => { if (s && s.pid && mem.has(s.pid)) s.memoria = mem.get(s.pid) }
    for (const s of dados.servicos || []) pinta(s)
    for (const p of dados.projetos || []) for (const s of p.servicos || []) pinta(s)
  } catch { /* sem a memória, a tela segue como antes */ }
  /* CC-638, print dele: o pedido de rede do sandbox ("Allow network
     connection to overpass-api.de?") não aparecia. Ele não é ação na conversa
     principal (veio de um ajudante em segundo plano), então só a TELA do
     terminal sabe dele.
     CC-640, pedido dele: "quero que tudo apareça". Medido no mesmo projeto:
     com um ajudante trabalhando em segundo plano, o registro marca a sessão
     como OCUPADA (`busy`) mesmo com o terminal parado no pedido, e a regra
     antiga (só quem o registro diz esperando) nunca olhava. Agora a TELA de
     toda sessão aberta pelo painel é lida a cada leitura (poucas sessões,
     alguns milissegundos cada), e pedido na tela vira cartão, qualquer que
     seja o estado do registro. Cartão que já veio da conversa fica como está. */
  const nomeDaConversa = new Map() // CC-708: conversa -> nome que ele deu à sessão
  try {
    const rcTodas = Object.entries(await estadoRC().catch(() => ({})) || {}).filter(([, s]) => s?.sessao)
    // sem nome dado por ele, vale o do terminal ("VPS_cockpit-2"); a tela esconde o que repete o projeto
    for (const [rotulo, s] of rcTodas) if (s.conversa) nomeDaConversa.set(s.conversa, s.nomeSessao || rotulo)
    const telaDe = new Map(await Promise.all(rcTodas.map(([, s]) => new Promise((ok) => execFile('tmux', ['capture-pane', '-t', s.sessao, '-p', '-S', '-60'], { encoding: 'utf8', timeout: 3000 }, (err, out) => ok([s.sessao, err ? '' : out]))))))
    const sessoesRC = rcTodas.map(([, s]) => s).filter((s) => s.conversa)
    const telas = sessoesRC.map((s) => telaDe.get(s.sessao) || '')
    /* CC-675, pedido dele: "o cockpit tem que reconhecer que temos sessões
       congeladas ou perdidas (…) temos que ser capazes de enxergá-las".
       Garantia: TODA sessão viva num terminal do painel aparece na lista,
       com a saúde lida na tela (celular ligado? presa num menu?). A que o
       registro do Claude Code dava por sem sinal (fibraessencia, 2 dias com o
       celular caído) ou que nunca teve conversa (boxboutique, parado na
       pergunta de confiança) entra marcada como perdida, em vez de sumir. */
    const local = (dados.dispositivos || []).find((d) => d.local) || {}
    for (const [rotulo, s] of rcTodas) {
      const saude = saudeDaTela(telaDe.get(s.sessao))
      const c = (dados.conectadas || []).find((x) => s.conversa && (x.conversa === s.conversa || x.id === String(s.conversa).slice(0, 8)))
      if (c) {
        Object.assign(c, { celular: saude.celular, presa: saude.presa, rotuloRC: rotulo, sessaoNome: s.nomeSessao || rotulo })
        /* A tela diz que o turno está em andamento: a sessão trabalha, mesmo
           que o registro diga parada. Sai o cartão de "parou" dela (pergunta
           e permissão ficam: essas pedem resposta de qualquer jeito). */
        if (saude.trabalhando && c.estado !== 'trabalhando') {
          c.estado = 'trabalhando'
          if (!(dados.rodando || []).some((x) => x.id === c.id)) (dados.rodando || (dados.rodando = [])).push(c)
          dados.espera = (dados.espera || []).filter((e) => !(e.tipo === 'agente' && e.conversa === s.conversa && e.rotulo !== 'pergunta' && e.rotulo !== 'permissão'))
        }
        continue
      }
      const p = (dados.projetos || []).find((x) => x.raiz && x.raiz === s.cwd)
      ;(dados.conectadas || (dados.conectadas = [])).push({
        id: String(s.conversa || rotulo).slice(0, 8), tipo: 'remote control', dispositivo: local.nome || 'esta máquina', modelo: null,
        estado: 'ociosa', perdida: true, desdeMs: Math.max(0, agora - (s.ativa || s.desde || agora)),
        projeto: p ? p.chave : path.basename(s.cwd || rotulo), nome: p ? p.nome : path.basename(s.cwd || rotulo),
        conversa: s.conversa || null, fala: null, assunto: saude.presa || 'viva no terminal, sem sinal no registro do Claude Code',
        celular: saude.celular, presa: saude.presa, rotuloRC: rotulo, todos: 0, todosDone: 0,
      })
    }
    /* CC-645, print dele: respondeu no terminal e o cartão continuou, com
       "o pedido na tela não é o do cartão". O cartão vinha da conversa
       gravada, e o botão confere a tela: duas fontes. Nas sessões do painel,
       a TELA é a única fonte do cartão de permissão. Sem pedido na tela, o
       cartão sai; com pedido, ele usa o que está na tela. */
    const doPainel = new Set(sessoesRC.map((s) => s.conversa))
    const naTela = new Map(sessoesRC.map((s, i) => [s.conversa, permissaoDaTela(telas[i])]))
    dados.espera = (dados.espera || []).filter((e) => !(e.tipo === 'agente' && e.rotulo === 'permissão' && doPainel.has(e.conversa) && !naTela.get(e.conversa)))
    sessoesRC.forEach((s, i) => {
      const pr = naTela.get(s.conversa)
      if (!pr) return
      const campos = { rotulo: 'permissão', pergunta: pr.descricao || (pr.titulo + (pr.detalhe ? ': ' + pr.detalhe.split('\n')[0] : '')), ferramenta: /network/i.test(pr.titulo) ? 'rede' : (pr.titulo.split(' ')[0] || 'ação'), comando: pr.detalhe || pr.pergunta, permissaoId: 'tela:' + pr.chave, acao: 'responder', marca: 'tela:' + pr.chave,
        // CC-726: o terminal oferece "sempre permitir" para este pedido?
        sempre: Boolean(teclaDaPermissao(telas[i], 'sempre')) }
      const ja = (dados.espera || []).find((e) => e.tipo === 'agente' && e.conversa === s.conversa)
      if (ja) { Object.assign(ja, campos); return }
      const c = (dados.conectadas || []).find((x) => x.conversa === s.conversa || x.id === String(s.conversa).slice(0, 8))
      if (!c) return
      ;(dados.espera || (dados.espera = [])).unshift({ tipo: 'agente', id: c.id, projeto: c.projeto, nome: c.nome, frente: c.frente || null, assunto: c.assunto || null, dispositivo: c.dispositivo, modelo: c.modelo || null, desdeMs: 0, sessao: c.tipo, conversa: s.conversa, opcoes: [], ...campos })
    })
  } catch { /* a tela é um extra: sem ela, o cartão fica como estava */ }
  /* CC-651: os pedidos do gancho de permissão valem MAIS que a tela e a
     conversa: vêm do próprio Claude Code, de qualquer origem (inclusive de
     ajudante em segundo plano), e se respondem sem apertar tecla. */
  try {
    for (const pg of lerPedidosDoGancho(undefined, agora)) {
      /* CC-723: pedido do Coderoom cai no cartão da PRÓPRIA conversa
         (`gate:<id>`), e não num cartão solto com o número da sessão do Claude. */
      const conv = pg.coderoom ? 'gate:' + pg.coderoom : pg.sessao
      const c = (dados.conectadas || []).find((x) => x.conversa === conv || x.id === String(conv || '').slice(0, 8))
      const ehPergunta = pg.tipo === 'pergunta'
      const campos = {
        rotulo: ehPergunta ? 'pergunta' : 'permissão',
        pergunta: ehPergunta ? pg.pergunta : (pg.ajudante ? 'Ajudante em segundo plano: ' : '') + (pg.descricao || ('quer usar ' + (pg.ferramenta || 'uma ferramenta'))),
        /* CC-723: as opções da pergunta do Coderoom, uma por botão. */
        escolhas: ehPergunta ? (pg.opcoes || []) : null,
        ferramenta: pg.ferramenta || 'ação', comando: ehPergunta ? null : pg.comando || null, permissaoId: 'gancho:' + pg.id, acao: 'responder',
        // CC-739: pedido de pasta não tem ninguém esperando, então não tem prazo
        marca: 'gancho:' + pg.id, conversa: conv, prazo: pg.tipo === 'pasta' ? null : pg.ate || null, doAjudante: Boolean(pg.ajudante),
        // CC-726: o gancho guarda as regras que o Claude Code sugere; com elas, dá para "sempre permitir"
        sempre: Array.isArray(pg.sugestoes) && pg.sugestoes.length > 0,
        /* CC-699: pedido do "pergunte antes" do Coderoom. Sem resposta ele é
           BARRADO, não vai para terminal nenhum, e o cartão precisa dizer isso. */
        doCoderoom: Boolean(pg.coderoom),
      }
      const ja = (dados.espera || []).find((e) => e.tipo === 'agente' && e.conversa === conv)
      if (ja) { Object.assign(ja, campos); continue }
      ;(dados.espera || (dados.espera = [])).unshift({
        tipo: 'agente', id: c ? c.id : String(pg.sessao || pg.id).slice(0, 8), projeto: c ? c.projeto : path.basename(pg.cwd || ''), nome: c ? c.nome : path.basename(pg.cwd || 'sessão'),
        frente: c?.frente || null, assunto: c?.assunto || null, dispositivo: c ? c.dispositivo : local.nome, modelo: c?.modelo || null, desdeMs: Math.max(0, agora - (pg.em || agora)), sessao: c?.tipo || 'claude code', opcoes: [], ...campos,
      })
    }
  } catch { /* sem os pedidos do gancho, ficam os da tela e da conversa */ }
  /* CC-735, decisão dele em 30/09 ("responder daqui"): os pedidos de permissão
     das OUTRAS máquinas, que chegam no pacote. A resposta vira ordem na fila
     daquela máquina (`remoto:<máquina>:<id>`), e o cartão some quando o pacote
     seguinte chega sem o pedido. Máquina calada há mais de 5 min fica de fora:
     o gancho de lá já desistiu. */
  try {
    for (const p of pacotes) {
      if (p.semContato) continue
      const maq = p.maquina?.nome || p.maquina?.id
      for (const pg of p.permissoes || []) {
        const curto = String(pg.sessao || '').slice(0, 8)
        const c = (dados.conectadas || []).find((x) => x.dispositivo === maq && x.id === curto)
        const campos = {
          rotulo: 'permissão',
          pergunta: (pg.ajudante ? 'Ajudante em segundo plano: ' : '') + (pg.descricao || ('quer usar ' + (pg.ferramenta || 'uma ferramenta'))),
          escolhas: null, ferramenta: pg.ferramenta || 'ação', comando: pg.comando || null,
          permissaoId: `remoto:${maq}:${pg.id}`, acao: 'responder', marca: `remoto:${maq}:${pg.id}`,
          conversa: c?.conversa || pg.sessao, prazo: null, doAjudante: Boolean(pg.ajudante), sempre: Boolean(pg.sempre), deOutraMaquina: maq,
        }
        const ja = (dados.espera || []).find((e) => e.tipo === 'agente' && e.dispositivo === maq && e.id === curto)
        if (ja) { Object.assign(ja, campos); continue }
        ;(dados.espera || (dados.espera = [])).unshift({
          tipo: 'agente', id: c ? c.id : curto || pg.id, projeto: c ? c.projeto : String(pg.cwd || '').split(/[\\/]/).pop(), nome: c ? c.nome : String(pg.cwd || 'sessão').split(/[\\/]/).pop(),
          frente: c?.frente || null, assunto: c?.assunto || null, dispositivo: maq, modelo: c?.modelo || null,
          desdeMs: Math.max(0, (p.em || agora) - (pg.em || p.em || agora)) + (p.idadeMs || 0), sessao: c?.tipo || 'claude code', opcoes: [], ...campos,
        })
      }
    }
  } catch { /* sem os pedidos de fora, ficam os daqui */ }
  // CC-708: toda pergunta e permissão leva o nome da sessão de onde veio
  /* CC-727, pedido dele: "nomear os chats de forma que fique entendível no
     sessões qual a sessão do coderoom". O cartão mostrava só o projeto, e
     duas conversas no mesmo projeto eram dois "VPS_cockpit" iguais. O título
     da conversa entra no mesmo lugar do nome da sessão de terminal. */
  for (const j of jobs) if (j.tipo === 'coderoom' && j.subject && !nomeDaConversa.has('gate:' + j.id)) nomeDaConversa.set('gate:' + j.id, j.subject)
  for (const s of dados.conectadas || []) if (!s.sessaoNome && s.conversa && nomeDaConversa.has(s.conversa)) s.sessaoNome = nomeDaConversa.get(s.conversa)
  for (const e of dados.espera || []) if (e.conversa && nomeDaConversa.has(e.conversa)) e.sessaoNome = nomeDaConversa.get(e.conversa)
  /* CC-599: o resumo do agy para cada sessão parada DESTA máquina (decisão
     dele: automático, um por parada). Pede o que falta e junta o que está
     pronto; o pedido roda em segundo plano, esta leitura não espera. */
  try {
    const arquivoDe = new Map()
    for (const j of locais) { const a = transcritoDe(j); if (a) arquivoDe.set(path.basename(a, '.jsonl'), a) }
    const alvo = (x) => x && x.conversa && arquivoDe.has(x.conversa)
    /* 30/09, pedido dele: o seletor de modelo e esforço já vem marcado no que a sessão usa. */
    for (const x of [...(dados.espera || []), ...(dados.conectadas || [])]) if (alvo(x)) x.cfgAtual = configAtual(arquivoDe.get(x.conversa))
    for (const e of dados.espera || []) {
      if (e.tipo !== 'agente' || !alvo(e)) continue
      resumoAgy.pedir({ conversa: e.conversa, marca: e.marca, arquivo: arquivoDe.get(e.conversa) })
      e.resumoIA = resumoAgy.obter(e.conversa, e.marca)
    }
    for (const s of dados.conectadas || []) {
      if (s.estado === 'trabalhando' || s.porPrograma || !alvo(s)) continue
      resumoAgy.pedir({ conversa: s.conversa, marca: s.marca, arquivo: arquivoDe.get(s.conversa) })
      s.resumoIA = resumoAgy.obter(s.conversa, s.marca)
    }
    /* O coderoom não tem arquivo de transcrição, e é por isso que o cartão dele
       não tinha resumo. O texto que o agente acabou de escrever está no job, e
       o mesmo agy da fila de cima o resume: é a peça de que o Claude Code
       (CC-599) é servido, com a entrada diferente.
       A chave é a conversa, e não a marca: no coderoom o texto muda só quando
       o turno acaba, e uma chave por escrita faria o mesmo resumo ser pedido
       de novo a cada tique. */
    const textoDoCoderoom = new Map()
    for (const j of jobs) if (j.tipo === 'coderoom' && j.ultima?.texto) textoDoCoderoom.set('gate:' + j.id, j.ultima.texto)
    for (const s of dados.conectadas || []) {
      const txt = s.conversa && textoDoCoderoom.get(s.conversa)
      if (!txt || s.estado === 'trabalhando' || s.porPrograma) continue
      const k = 'sess::' + s.conversa
      const r = resumoAgy.obterTexto(k)
      resumoAgy.pedirTexto({ k, prompt: 'Um agente de programação acabou de responder no Coderoom, a tela de conversa do painel de projetos dele. Escreva em português do Brasil, sem travessão, no máximo 3 frases curtas: o que ele fez, o que ele mudou e o que falta. Para quem não é programador. Sem markdown. Não use ferramentas.\n\n' + resumoAgy.INSTRUCAO_ETIQUETA + 'RESPOSTA DO AGENTE:\n' + txt.slice(0, 4000), comEtiqueta: true })
      s.resumoIA = r
    }
  } catch { /* resumo é conveniência: falhar aqui não derruba a tela */ }
  /* CC-683: o pedido de permissão explica o comando. A leitura fixa (raio) é
     calculada na hora; a frase do agy chega em segundos e vem marcada. */
  try {
    for (const e of dados.espera || []) {
      if (e.rotulo !== 'permissão' || !e.comando) continue
      e.raio = raioX(e.comando)
      const k = 'perm::' + createHash('sha1').update(e.comando).digest('hex').slice(0, 16)
      const r = resumoAgy.obterTexto(k)
      if (!r) resumoAgy.pedirTexto({ k, prompt: 'Um agente de programação pediu permissão para rodar este comando de terminal. Escreva em português do Brasil, sem travessão, no máximo 3 frases curtas, para quem não é programador: em que máquina roda, o que ele faz exatamente, quais pastas ou serviços toca e se pode estragar algo no ar. Sem markdown. Não use ferramentas.\n\nCOMANDO:\n' + e.comando.slice(0, 1500) })
      e.explicacaoIA = r?.texto ? { texto: r.texto } : { estado: 'resumindo' }
    }
  } catch { /* explicação é conveniência */ }
  /* CC-582: o histórico de decisões por projeto aprende a cada leitura. */
  try { registrarHistorico(dados, { agora, fechadasPorEle: lerFechadas() }) } catch { /* histórico não derruba a tela */ }
  /* As ideias dele que ainda não viraram item, uma fila por projeto. Só dos
     projetos com sinal: varrer 29 pastas a cada 5s não cabe aqui. */
  dados.ideias = []
  /* 26/09: além dos projetos com sessão, TODAS as pastas de `projetos/` que
     têm fila. A varredura de hora em hora guarda ideia de projeto sem sessão
     aberta (o carzo, medido), e só olhar quem tem sessão escondia essas. São
     poucos arquivos pequenos, um `existsSync` por pasta. */
  const raizes = new Map(dados.projetos.filter((p) => p.raiz).map((p) => [p.raiz, p]))
  for (const base of new Set([...raizes.keys()].map((r) => path.dirname(r)).concat(path.join(os.homedir(), 'projetos')))) {
    let nomes = []
    try { nomes = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name) } catch { continue }
    for (const n of nomes) {
      const r = path.join(base, n)
      if (!raizes.has(r) && fs.existsSync(path.join(r, 'docs', '.ideias-pendentes.json'))) raizes.set(r, { chave: chaveDeProjeto(n), nome: nomeCanonico(n), raiz: r })
    }
  }
  for (const p of raizes.values()) {
    if (!p.raiz) continue
    try {
      for (const i of (lerFila(p.raiz)?.pendentes || [])) {
        dados.ideias.push({
          projeto: p.chave, nome: p.nome, texto: String(i.texto || i.trecho || '').slice(0, 240), em: i.em || i.quando || null,
          /* 26/09: id e raiz para os botões "virar item" e "descartar". */
          id: i.id || null, raiz: p.raiz, aprovada: Boolean(i.aprovada),
        })
      }
    } catch { /* fila ilegível conta como vazia */ }
  }
  dados.ideias.sort((a, b) => (b.em || 0) - (a.em || 0))
  dados.custoMs = Date.now() - t0
  return dados
}

export const _internals = { primeiraFrase, transcritoDe, tipoDaSessao, estadoDaSessao, ferramentaCurta }
