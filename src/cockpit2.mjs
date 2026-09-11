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
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    const l = linhas[i].trim()
    if (!l || !l.includes('"assistant"')) continue
    let e = null
    try { e = JSON.parse(l) } catch { continue }
    if (e?.type !== 'assistant' || e.isSidechain) continue
    const partes = Array.isArray(e.message?.content) ? e.message.content : []
    const pergunta = partes.find((p) => p?.type === 'tool_use' && p.name === 'AskUserQuestion')
    if (pergunta) {
      const qs = Array.isArray(pergunta.input?.questions) ? pergunta.input.questions : []
      const q = qs[0] || {}
      return {
        tipo: 'pergunta',
        texto: String(q.question || '').trim() || null,
        opcoes: (q.options || []).map((o) => String(o?.label || '')).filter(Boolean),
        quantas: qs.length,
        em: e.timestamp || null,
      }
    }
    const txt = partes.filter((p) => p?.type === 'text').map((p) => p.text).join(' ').trim()
    if (txt) return { tipo: 'fala', texto: primeiraFrase(txt), opcoes: [], quantas: 0, em: e.timestamp || null }
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
  if (soParado && job.status !== 'waiting') return null
  return ultimaFalaDoAgente(transcritoDe(job))
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
  if (j.tipo === 'interativa') return j.remoto ? 'remote control' : 'claude code'
  return 'claude code (fundo)'
}

const estadoDaSessao = (j) => {
  if (j.stale) return 'sem sinal'
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

/** O que o cartão de aviso mostra sobre um agente parado. Sem fala legível,
 *  diz isso com todas as letras em vez de devolver o assunto. */
export function avisoDoAgente(j, fala, dispositivo, agora) {
  const travado = bloqueioDe(j)
  const base = {
    tipo: 'agente', id: j.id, projeto: chaveDeProjeto(j.project), nome: nomeCanonico(j.project),
    frente: j.frente || null, assunto: j.subject || null, dispositivo, modelo: j.model || null,
    desdeMs: Math.max(0, agora - (j.updatedAt || agora)), sessao: tipoDaSessao(j),
  }
  if (travado) return { ...base, rotulo: 'travado', pergunta: travado, opcoes: [], acao: 'destravar' }
  if (fala?.tipo === 'pergunta' && fala.texto) {
    return { ...base, rotulo: 'pergunta', pergunta: fala.texto, opcoes: fala.opcoes, quantas: fala.quantas, acao: 'responder' }
  }
  if (fala?.tipo === 'fala' && fala.texto) {
    return { ...base, rotulo: 'parou', pergunta: fala.texto, opcoes: [], acao: 'responder' }
  }
  return { ...base, rotulo: 'parou sem perguntar', pergunta: null, opcoes: [], acao: 'abrir' }
}

const porTempo = (a, b) => (b.desdeMs || 0) - (a.desdeMs || 0)

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
  ignorar = [], maquinas = null,
} = {}) {
  const disp = local.nome || 'esta máquina'
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
    if (!p.raiz && j.cwd && !j.origem) p.raiz = j.cwd
    if (!semContato && !j.stale) p.presenca.add(onde)
    p.ultimaAtividade = Math.max(p.ultimaAtividade, j.updatedAt || 0)
    p.sessoes.push({
      id: j.id, tipo: tipoDaSessao(j), dispositivo: onde, modelo: j.model || null,
      estado: estadoDaSessao(j), ferramenta: ferramentaCurta(j.inFlight?.[0]?.label) || null,
      desdeMs: Math.max(0, agora - (j.updatedAt || agora)), frente: j.frente || null, assunto: j.subject || null,
      todos: j.todos?.length || 0, todosDone: j.todosDone || 0,
    })
    if ((j.status === 'working' || j.status === 'waiting') && j.frente && !p.frenteEmCurso) p.frenteEmCurso = j.frente
    if (j.status === 'waiting' && !j.stale && !semContato) {
      p.espera.push(avisoDoAgente(j, falaDe(j), onde, agora))
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
  for (const t of tarefas) {
    if (t.feito) continue
    const p = t.projeto ? projetoDe(t.projeto) : null
    const pend = {
      tipo: 'pendencia', id: t.id, projeto: p?.chave || null, nome: p?.nome || 'geral', frente: t.frente || null,
      pergunta: t.texto, porque: t.porque || null, dispositivo: t.maquina || disp,
      desdeMs: t.em ? Math.max(0, agora - t.em) : null, acao: 'feito',
    }
    if (p) { p.pendencias.push(pend); p.espera.push(pend) } else soltas.push(pend)
  }

  const semana = semanaDe(tempo, agora)
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
      }))
      : [{ id: local.id, nome: disp, local: true, contato: true, idadeMs: 0 }],
    projetos: lista,
    espera,
    rodando,
    servicos,
    semana,
    resumo: {
      projetos: lista.length, comPresenca: lista.filter((p) => p.presenca.length).length,
      espera: espera.length, agentesEsperando: espera.filter((e) => e.tipo === 'agente').length,
      pendencias: espera.filter((e) => e.tipo === 'pendencia').length,
      rodando: rodando.length, servicos: servicos.length,
    },
    lidoEm: agora,
  }
}

/** Os últimos 7 dias, do cache de tempo: total, um valor por dia, e os
 *  projetos que mais levaram. Sem cache, vem vazio e a tela diz isso. */
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
function tempoBarato() {
  /* Só lê o que a aba Tempo já gravou. Sem cache no disco, a varredura custa
     segundos e não cabe numa rota que a tela chama a cada 5s. */
  if (!fs.existsSync(TEMPO_CACHE)) return null
  if (Date.now() - tempoCache.em < 60_000) return tempoCache.dados
  try { tempoCache = { em: Date.now(), dados: resumoTempo({ corteMin: 15 }) } } catch { tempoCache = { em: Date.now(), dados: null } }
  return tempoCache.dados
}

export async function responder() {
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
    jobs, servers, containers, tarefas, tempo, local, agora, maquinas,
    /* Sessão da outra máquina traz a fala pronta no pacote: o transcrito dela
       está no disco de lá e não atravessa. Quem é daqui é lido do arquivo. */
    falaDe: (j) => (j.origem ? (j.ultimaFala || null) : ultimaFalaDoAgente(transcritoDe(j))),
    ignorar: [path.basename(os.homedir())],
  })
  /* As ideias dele que ainda não viraram item, uma fila por projeto. Só dos
     projetos com sinal: varrer 29 pastas a cada 5s não cabe aqui. */
  dados.ideias = []
  for (const p of dados.projetos) {
    if (!p.raiz) continue
    try {
      for (const i of (lerFila(p.raiz)?.pendentes || [])) {
        dados.ideias.push({ projeto: p.chave, nome: p.nome, texto: String(i.texto || i.trecho || '').slice(0, 240), em: i.em || i.quando || null })
      }
    } catch { /* fila ilegível conta como vazia */ }
  }
  dados.ideias.sort((a, b) => (b.em || 0) - (a.em || 0))
  dados.custoMs = Date.now() - t0
  return dados
}

export const _internals = { primeiraFrase, transcritoDe, tipoDaSessao, estadoDaSessao, ferramentaCurta }
