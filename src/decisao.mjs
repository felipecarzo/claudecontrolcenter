/**
 * Responder pelo painel a pergunta que um agente fez (CC-556).
 *
 * Pedido dele em 23/09/2026: "um local que seja interativo (…) você criou o
 * backlog, daí tem 3 decisões, ao invés de eu só falar aqui, eu falo por lá
 * também". Até aqui o painel VIA a pergunta (a Início mostrava o cartão) e não
 * deixava responder: a resposta só existia dentro da própria sessão.
 *
 * O caminho de volta é o terminal. As sessões que o painel abre vivem no tmux
 * (`remotecontrol.mjs`), e o menu de perguntas do Claude Code se responde por
 * tecla. Medido numa sessão real em 23/09, versão 2.1.280:
 *
 *   - uma pergunta: o número da opção já envia;
 *   - várias: um número por pergunta, o menu avança sozinho, e no fim vem uma
 *     tela de revisão em que "1" envia tudo;
 *   - resposta escrita: o número de "Type something" (uma depois da última
 *     opção), o texto, e Enter.
 *
 * ⚠️ A trava que não pode sair: antes de apertar qualquer tecla, conferir que a
 * pergunta ainda está NA TELA. Se o agente já seguiu, um "2" digitado vira uma
 * mensagem "2" mandada para ele, e ninguém percebe até ele agir em cima.
 * Por isso a ordem é: transcrito diz que a pergunta está pendente, a tela diz
 * que ela está visível, e só então as teclas; depois, o transcrito confirma.
 */
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { transcritoDe, DIR_SESSOES_ABRIGO, PROJETOS_DIR } from './metaSessao.mjs'

/* CC-694: "não está num terminal aberto pelo painel" valia para dois casos
   diferentes, e o cartão não dizia qual. Sessão FECHADA (não está no registro
   de sessões abertas do Claude Code) diz isso com todas as letras; aberta noutro
   lugar (app, outro terminal) continua mandando responder direto nela. */
export function sessaoAberta(conversa, dir = path.join(path.dirname(PROJETOS_DIR()), 'sessions')) {
  let nomes; try { nomes = fs.readdirSync(dir).filter((f) => f.endsWith('.json')) } catch { return null }
  for (const f of nomes) {
    try {
      const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      if (o.sessionId !== conversa || !o.pid) continue
      process.kill(o.pid, 0)
      return true
    } catch { /* registro velho ou processo morto */ }
  }
  return false
}
function semTerminal(conversa, verbo, deps) {
  const aberta = (deps.aberta || sessaoAberta)(conversa)
  if (aberta === false) return { ok: false, fechada: true, erro: 'essa sessão já foi fechada: não há ninguém do outro lado para receber' }
  return { ok: false, erro: `essa conversa não está num terminal aberto pelo painel: ${verbo} direto nela` }
}
import { estado as estadoDasSessoes } from './remotecontrol.mjs'

/* ── Cartões fechados por ele (26/09) ─────────────────────────────────────
   "tem que ter opção de fechar um pedido". Fechar vale para AQUELE momento da
   sessão: a chave é o id do agente mais a marca da última fala. Quando a
   sessão se mexer (fala nova), a marca muda e o cartão volta, porque aí é
   outra decisão. Mora no abrigo, que o sandbox deixa escrever. */
const ARQ_FECHADAS = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'decisoes-fechadas.json')

export const chaveDoCartao = (id, marca) => `${id}::${marca || ''}`

const lerArquivo = (arq) => { try { return JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { return {} } }

export function lerFechadas(arq = ARQ_FECHADAS()) {
  return new Set(lerArquivo(arq).fechadas || [])
}

/** Cartões que ele reabriu (26/09, tela Decisões, item 4): a regra das 2
 *  horas não os esconde de novo. Mesma chave, mesmo arquivo. */
export function lerMantidas(arq = ARQ_FECHADAS()) {
  return new Set(lerArquivo(arq).mantidas || [])
}

/* Guarda só os 500 mais recentes de cada lista: ela cresce a cada cartão, e
   chave de sessão antiga nunca mais casa com nada. */
function gravar(arq, { fechadas, mantidas }) {
  try {
    fs.mkdirSync(path.dirname(arq), { recursive: true })
    fs.writeFileSync(`${arq}.tmp`, JSON.stringify({ fechadas: [...fechadas].slice(-500), mantidas: [...mantidas].slice(-500) }))
    fs.renameSync(`${arq}.tmp`, arq)
  } catch (e) { return { ok: false, erro: 'não consegui gravar: ' + e.message } }
  return { ok: true }
}

export function fechar({ id, marca }, arq = ARQ_FECHADAS()) {
  if (!id) return { ok: false, erro: 'faltou dizer qual cartão' }
  const k = chaveDoCartao(id, marca)
  const fechadas = lerFechadas(arq); const mantidas = lerMantidas(arq)
  fechadas.add(k); mantidas.delete(k)
  return gravar(arq, { fechadas, mantidas })
}

/** Reabrir: sai das fechadas e entra nas mantidas, para voltar à lista mesmo
 *  parado há mais de 2 horas. */
export function reabrir({ id, marca }, arq = ARQ_FECHADAS()) {
  if (!id) return { ok: false, erro: 'faltou dizer qual cartão' }
  const k = chaveDoCartao(id, marca)
  const fechadas = lerFechadas(arq); const mantidas = lerMantidas(arq)
  fechadas.delete(k); mantidas.add(k)
  return gravar(arq, { fechadas, mantidas })
}

/* ── "Para depois" (CC-630, 27/09) ────────────────────────────────────────
   Pedido dele: "tem coisas que eu não posso resolver agora, tipo alguma
   tarefa que me aguarda testar no PC (…) jogar ela pra outro lugar pra
   esperar lá e sair da esperando você". Decisão dele: as três formas de
   voltar, escolhidas na hora ("os 3"):
     manual  só volta quando ele trouxer;
     mexer   volta quando a sessão falar de novo (a marca muda);
     amanha  volta sozinho às 8h de Brasília do dia seguinte. */
const ARQ_DEPOIS = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'decisoes-depois.json')
export const MODOS_DEPOIS = ['manual', 'mexer', 'amanha']

export function lerDepois(arq = ARQ_DEPOIS()) {
  const o = lerArquivo(arq)
  return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
}

/** A próxima 8h de Brasília (UTC−3, sem horário de verão desde 2019). */
export function proximaManha(agora = Date.now()) {
  const br = new Date(agora - 3 * 3600e3)
  let alvo = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate(), 8 + 3)
  if (alvo <= agora) alvo += 24 * 3600e3
  return alvo
}

/** O cartão continua guardado? Puro. */
export function depoisVale(d, marca, agora = Date.now(), { pergunta = false } = {}) {
  if (!d) return false
  /* 01/10, escolha dele: "pergunta nova volta". Uma sessão em "para depois"
     que faz pergunta NOVA (a fala mudou desde que ele adiou) está travada
     esperando decisão: volta para Sessões, em qualquer modo. */
  if (pergunta && (d.marca || '') !== (marca || '')) return false
  if (d.modo === 'mexer') return (d.marca || '') === (marca || '')
  if (d.modo === 'amanha') return agora < (d.ate || 0)
  return true
}

function gravarDepois(arq, obj) {
  try {
    fs.mkdirSync(path.dirname(arq), { recursive: true })
    const chaves = Object.keys(obj).sort((a, b) => (obj[b].em || 0) - (obj[a].em || 0)).slice(0, 300)
    fs.writeFileSync(`${arq}.tmp`, JSON.stringify(Object.fromEntries(chaves.map((k) => [k, obj[k]]))))
    fs.renameSync(`${arq}.tmp`, arq)
  } catch (e) { return { ok: false, erro: 'não consegui gravar: ' + e.message } }
  return { ok: true }
}

export function adiar({ id, marca, modo }, arq = ARQ_DEPOIS(), agora = Date.now()) {
  if (!id) return { ok: false, erro: 'faltou dizer qual cartão' }
  if (!MODOS_DEPOIS.includes(modo)) return { ok: false, erro: 'modo desconhecido' }
  const d = lerDepois(arq)
  d[id] = { marca: marca || null, modo, em: agora, ...(modo === 'amanha' ? { ate: proximaManha(agora) } : {}) }
  return gravarDepois(arq, d)
}

export function trazer({ id }, arq = ARQ_DEPOIS()) {
  if (!id) return { ok: false, erro: 'faltou dizer qual cartão' }
  const d = lerDepois(arq)
  delete d[id]
  return gravarDepois(arq, d)
}

/**
 * A última pergunta do agente que ainda não teve resposta, lida do transcrito.
 * Puro: recebe o texto do `.jsonl`. Devolve `null` quando não há pergunta
 * pendente, inclusive quando a última pergunta já foi respondida.
 */
export function perguntaPendente(texto) {
  let ultima = null
  const respondidas = new Set()
  for (const linha of String(texto || '').split('\n')) {
    const l = linha.trim()
    if (!l) continue
    let e
    try { e = JSON.parse(l) } catch { continue }
    if (e?.isSidechain) continue
    const partes = Array.isArray(e?.message?.content) ? e.message.content : []
    if (e?.type === 'assistant') {
      const p = partes.find((x) => x?.type === 'tool_use' && x.name === 'AskUserQuestion')
      if (p?.id) ultima = { id: p.id, em: e.timestamp || null, perguntas: normalizar(p.input?.questions) }
    } else if (e?.type === 'user') {
      for (const x of partes) if (x?.type === 'tool_result' && x.tool_use_id) respondidas.add(x.tool_use_id)
    }
  }
  if (!ultima || respondidas.has(ultima.id) || !ultima.perguntas.length) return null
  return ultima
}

function normalizar(qs) {
  return (Array.isArray(qs) ? qs : []).map((q) => ({
    pergunta: String(q?.question || '').trim(),
    cabecalho: String(q?.header || '').trim() || null,
    opcoes: (q?.options || []).map((o) => ({ rotulo: String(o?.label || '').trim(), explica: String(o?.description || '').trim() || null })).filter((o) => o.rotulo),
    multipla: Boolean(q?.multiSelect),
  })).filter((q) => q.pergunta)
}

/**
 * As teclas que respondem o menu, na ordem. Puro.
 * `respostas[i]` é `{ opcao: <índice> }` ou `{ texto: '...' }`.
 */
export function teclasPara(perguntas, respostas) {
  if (!Array.isArray(perguntas) || !perguntas.length) throw new Error('não há pergunta para responder')
  if (!Array.isArray(respostas) || respostas.length !== perguntas.length) {
    throw new Error(`são ${perguntas.length} pergunta(s), e chegaram ${Array.isArray(respostas) ? respostas.length : 0} resposta(s)`)
  }
  const passos = []
  perguntas.forEach((q, i) => {
    const r = respostas[i] || {}
    /* CC-624, medido em 27/09 numa sessão de teste: na pergunta de várias
       escolhas, o número MARCA a caixinha (sem enviar), e a seta para a
       direita leva adiante (à próxima pergunta ou à revisão). A resposta
       escrita nesse menu prende a seta dentro do texto e não foi fechada:
       recusar é melhor que chutar a sequência. */
    if (q.multipla) {
      const js = Array.isArray(r.opcoes) ? [...new Set(r.opcoes)].filter((j) => Number.isInteger(j) && j >= 0 && j < q.opcoes.length) : []
      const texto = typeof r.texto === 'string' ? r.texto.replace(/\s*\n\s*/g, ' ').trim() : ''
      if (!js.length && !texto) throw new Error(`marque pelo menos uma opção na pergunta ${i + 1}`)
      for (const j of js.sort((a, b) => a - b)) passos.push({ pergunta: i, tecla: String(j + 1) })
      if (!texto) { passos.push({ pergunta: i, tecla: 'Right' }); return }
      /* CC-625, medido em 27/09: o cursor fica na primeira linha; desce até
         "Type something" (uma linha por opção), o texto marca a caixinha dela
         sozinho, desce até "Submit" e o Enter leva adiante. Resultado medido:
         "Banana, e kiwi". */
      for (let d = 0; d < q.opcoes.length; d += 1) passos.push({ pergunta: i, tecla: 'Down' })
      passos.push({ pergunta: i, texto })
      passos.push({ pergunta: i, tecla: 'Down' })
      passos.push({ pergunta: i, tecla: 'Enter' })
      return
    }
    if (Number.isInteger(r.opcao) && r.opcao >= 0 && r.opcao < q.opcoes.length) {
      passos.push({ pergunta: i, tecla: String(r.opcao + 1) })
    } else if (typeof r.texto === 'string' && r.texto.trim()) {
      passos.push({ pergunta: i, tecla: String(q.opcoes.length + 1) })
      passos.push({ pergunta: i, texto: r.texto.replace(/\s*\n\s*/g, ' ').trim() })
      passos.push({ pergunta: i, tecla: 'Enter' })
    } else {
      throw new Error(`a resposta da pergunta ${i + 1} está vazia`)
    }
  })
  /* A revisão ("Submit answers", tecla 1) aparece com mais de uma pergunta e
     também depois de uma de várias escolhas. */
  if (perguntas.length > 1 || perguntas.some((q) => q.multipla)) passos.push({ revisao: true, tecla: '1' })
  return passos
}

/** A tela do terminal mostra esta pergunta? Ignora espaço e quebra de linha,
 *  porque o terminal quebra frase longa no meio. */
export function telaMostra(tela, pergunta) {
  const sem = (s) => String(s || '').replace(/\s+/g, '')
  const alvo = sem(pergunta).slice(0, 40)
  return Boolean(alvo) && sem(tela).includes(alvo)
}

const tmux = (args, ms = 5000) => new Promise((resolve) => {
  execFile('tmux', args, { encoding: 'utf8', timeout: ms }, (erro, saida, err) =>
    resolve(erro ? { ok: false, out: String(err || erro.message || '').trim() } : { ok: true, out: saida }))
})

const DEPS = {
  sessoes: estadoDasSessoes,
  lerTranscrito: (conversa) => {
    const arq = transcritoDe(conversa)
    if (!arq) return null
    try { return fs.readFileSync(arq, 'utf8') } catch { return null }
  },
  capturar: async (sessao, { cor = false } = {}) => {
    const r = await tmux(['capture-pane', '-t', sessao, '-p', ...(cor ? ['-e'] : []), '-S', '-60'])
    return r.ok ? r.out : null
  },
  apertar: (sessao, tecla) => tmux(['send-keys', '-t', sessao, tecla]),
  escrever: (sessao, texto) => tmux(['send-keys', '-t', sessao, '-l', texto]),
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
}

/** A tela está no campo de digitar, e não num menu? Puro. Menu do Claude Code
 *  sempre termina com a linha de ajuda "Enter to select/confirm". */
export function telaNoCampo(tela) {
  /* 27/09, print dele ("pq deu isso?"): o campo mostrava "❯ commit", com a
     SUGESTÃO do Claude Code em texto esmaecido (ESC[2m) e um espaço especial
     (U+00A0) depois do ❯. Nenhum dos dois é texto digitado: tira o esmaecido,
     tira as cores, e aceita qualquer espaço. */
  const t = String(tela || '').replace(/\x1b\[2m[^\x1b]*(\x1b\[(0|22)m)?/g, '').replace(/\x1b\[[0-9;]*m/g, '')
  if (/Enter to (select|confirm)/i.test(t)) return false
  return t.split('\n').some((l) => /^\s*❯(\s|$)/.test(l))
}

/**
 * Manda uma mensagem livre para uma sessão parada (26/09, item 3 da Início:
 * o cartão PAROU ganha um campo). Mesmas garantias do `responder`: a sessão
 * precisa estar num terminal do painel, sem pergunta pendente, com a tela no
 * campo de digitar; e o transcrito tem de confirmar a mensagem.
 */
export async function enviarMensagem({ conversa, texto }, deps = DEPS) {
  const msg = String(texto || '').replace(/\s*\n\s*/g, ' ').trim()
  if (!conversa || !msg) return { ok: false, erro: 'faltou a conversa ou o texto' }
  const sessoes = await deps.sessoes().catch(() => ({}))
  const aqui = Object.values(sessoes || {}).find((s) => s?.conversa === conversa)
  if (!aqui?.sessao) return semTerminal(conversa, 'mande', deps)
  const antes = deps.lerTranscrito(conversa) || ''
  if (perguntaPendente(antes)) return { ok: false, erro: 'a sessão está com uma pergunta aberta: responda pelos botões da pergunta' }
  if (!telaNoCampo(await deps.capturar(aqui.sessao, { cor: true }))) {
    return { ok: false, erro: 'a sessão não está esperando texto agora (está num menu ou trabalhando), então não escrevi nada' }
  }
  const r1 = await deps.escrever(aqui.sessao, msg)
  if (!r1?.ok) return { ok: false, erro: 'o terminal recusou o texto' }
  await deps.esperar(300)
  const r2 = await deps.apertar(aqui.sessao, 'Enter')
  if (!r2?.ok) return { ok: false, erro: 'o terminal recusou o Enter' }
  const pedaco = msg.slice(0, 40)
  for (let i = 0; i < 20; i += 1) {
    await deps.esperar(500)
    const depois = deps.lerTranscrito(conversa) || ''
    if (depois.length > antes.length && depois.slice(antes.length).includes(pedaco.replace(/"/g, '\\"'))) return { ok: true, sessao: aqui.sessao }
  }
  return { ok: false, erro: 'escrevi, mas a sessão não confirmou que recebeu: confira nela' }
}

/**
 * Interrompe uma sessão que está trabalhando (26/09, item 4 da Início: o
 * botão de parar). É o Esc do próprio Claude Code: para a resposta em curso e
 * deixa a sessão aberta, esperando o próximo pedido. Nada é apagado.
 * A prova é a tela: o Claude Code escreve "Interrupted" quando o Esc pega.
 */
export async function parar({ conversa }, deps = DEPS) {
  if (!conversa) return { ok: false, erro: 'faltou dizer qual conversa' }
  const sessoes = await deps.sessoes().catch(() => ({}))
  const aqui = Object.values(sessoes || {}).find((s) => s?.conversa === conversa)
  if (!aqui?.sessao) return semTerminal(conversa, 'pare', deps)
  const r = await deps.apertar(aqui.sessao, 'Escape')
  if (!r?.ok) return { ok: false, erro: 'o terminal recusou a tecla' }
  for (let i = 0; i < 6; i += 1) {
    await deps.esperar(500)
    if (/Interrupted/i.test(await deps.capturar(aqui.sessao) || '')) return { ok: true, sessao: aqui.sessao }
  }
  return { ok: true, sessao: aqui.sessao, aviso: 'mandei o Esc, mas a tela não confirmou a interrupção: pode ser que ela já estivesse parada' }
}

/**
 * CC-757, pedido dele em 30/09: trocar o modelo e o esforço da sessão pelo
 * cartão. O Claude Code aceita os dois como comando numa sessão aberta
 * (`/model <apelido>` e `/effort <nível>`, lidos do programa instalado,
 * 2.1.231), então isto digita o comando no terminal dela, como o campo de
 * mensagem já faz. As duas listas são FECHADAS: o que a tela manda nunca vira
 * texto livre no terminal.
 *
 * ⚠️ Escrito e testado com terminal simulado. NÃO foi provado contra um Claude
 * de verdade: o menu de comandos com barra pode pegar o Enter antes do
 * comando. Por isso a resposta diz `confirmado` só quando a tela mostra o
 * valor novo; sem isso volta com aviso, nunca com sucesso afirmado.
 */
/* 30/09, pedido dele: "tem que ter todos os modelos". Os apelidos (sempre o
   mais novo de cada família) e os nomes completos que o Claude Code 2.1.231
   conhece, lidos do programa. Qual a conta aceita só o terminal diz: se ele
   recusar, a troca volta com aviso, nunca como feita. */
export const MODELOS_SESSAO = ['fable', 'opus', 'sonnet', 'haiku',
  'claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-sonnet-5', 'claude-haiku-4-5',
  'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-sonnet-4-5']
export const ESFORCOS_SESSAO = ['low', 'medium', 'high', 'xhigh', 'max']

/**
 * Modelo e esforço que a sessão está usando AGORA: os da última resposta
 * gravada no histórico (`model` e `effort`, medidos em 30/09). Lê só o fim do
 * arquivo, com cache por tamanho, porque roda a cada leitura da tela.
 */
const cacheConfig = new Map()
export function configAtual(arquivo) {
  let st = null
  try { st = fs.statSync(arquivo) } catch { return null }
  const c = cacheConfig.get(arquivo)
  if (c && c.tam === st.size) return c.valor
  let valor = null
  let fd = null
  try {
    fd = fs.openSync(arquivo, 'r')
    const n = Math.min(st.size, 256 * 1024)
    const buf = Buffer.alloc(n)
    fs.readSync(fd, buf, 0, n, st.size - n)
    const linhas = buf.toString('utf8').split('\n')
    for (let i = linhas.length - 1; i >= 0 && !valor; i -= 1) {
      if (!linhas[i].includes('"type":"assistant"')) continue
      let o = null; try { o = JSON.parse(linhas[i]) } catch { continue }
      const modelo = o?.message?.model
      if (!modelo || modelo === '<synthetic>') continue
      valor = { modelo, esforco: o.effort || o.perTurnEffort || null }
    }
  } catch { valor = null } finally { if (fd !== null) try { fs.closeSync(fd) } catch { /* já fechado */ } }
  cacheConfig.set(arquivo, { tam: st.size, valor })
  return valor
}

export async function trocarConfig({ conversa, modelo = null, esforco = null }, deps = DEPS) {
  if (!conversa) return { ok: false, erro: 'faltou dizer qual conversa' }
  if (!modelo && !esforco) return { ok: false, erro: 'faltou dizer o modelo ou o esforço' }
  if (modelo && !MODELOS_SESSAO.includes(modelo)) return { ok: false, erro: 'modelo fora da lista' }
  if (esforco && !ESFORCOS_SESSAO.includes(esforco)) return { ok: false, erro: 'esforço fora da lista' }
  const sessoes = await deps.sessoes().catch(() => ({}))
  const aqui = Object.values(sessoes || {}).find((s) => s?.conversa === conversa)
  if (!aqui?.sessao) return semTerminal(conversa, 'troque', deps)
  if (!telaNoCampo(await deps.capturar(aqui.sessao, { cor: true }))) {
    return { ok: false, erro: 'a sessão não está esperando texto agora (está trabalhando ou num menu), então não mudei nada' }
  }
  const feitos = []
  for (const [comando, valor] of [['model', modelo], ['effort', esforco]]) {
    if (!valor) continue
    const r1 = await deps.escrever(aqui.sessao, `/${comando} ${valor}`)
    if (!r1?.ok) return { ok: false, erro: 'o terminal recusou o comando', feitos }
    await deps.esperar(300)
    const r2 = await deps.apertar(aqui.sessao, 'Enter')
    if (!r2?.ok) return { ok: false, erro: 'o terminal recusou o Enter', feitos }
    let visto = false
    for (let i = 0; i < 8 && !visto; i += 1) {
      await deps.esperar(500)
      const tela = String(await deps.capturar(aqui.sessao) || '')
      visto = new RegExp(`(set|changed|now using)[^\\n]{0,60}\\b${valor}\\b|\\b${valor}\\b[^\\n]{0,30}(set|selected)`, 'i').test(tela)
    }
    feitos.push({ comando, valor, confirmado: visto })
    // duas trocas seguidas: a segunda só entra com o campo livre de novo
    if (modelo && esforco && comando === 'model') await deps.esperar(800)
  }
  const naoVistos = feitos.filter((f) => !f.confirmado)
  return naoVistos.length
    ? { ok: true, sessao: aqui.sessao, feitos, aviso: 'mandei o comando, mas a tela não mostrou a confirmação: confira na sessão' }
    : { ok: true, sessao: aqui.sessao, feitos }
}

/**
 * CC-609: a última ação do agente (fora AskUserQuestion) ainda sem resultado.
 * É o que o terminal está pedindo para permitir. Puro.
 */
export function acaoPendente(texto) {
  let ultima = null
  const feitas = new Set()
  for (const linha of String(texto || '').split('\n')) {
    let e
    try { e = JSON.parse(linha) } catch { continue }
    if (e?.isSidechain) continue
    const partes = Array.isArray(e?.message?.content) ? e.message.content : []
    if (e?.type === 'assistant') for (const p of partes) { if (p?.type === 'tool_use' && p.name !== 'AskUserQuestion' && p.id) ultima = { id: p.id, comando: String(p.input?.command || p.input?.file_path || ''), descricao: String(p.input?.description || '') } }
    else if (e?.type === 'user') for (const x of partes) if (x?.type === 'tool_result' && x.tool_use_id) feitas.add(x.tool_use_id)
  }
  return ultima && !feitas.has(ultima.id) ? ultima : null
}

/* 01/10, medido gravando a tela a cada segundo: o texto de um pedido JÁ
   respondido continua visível mais acima (na saída de um comando, por exemplo),
   e a leitura da tela inteira o achava. O pedido de verdade é a caixa de baixo,
   depois da última linha divisória; sem divisória, vale a tela toda. */
export function caixaDeBaixo(tela) {
  const linhas = String(tela || '').split('\n')
  let i = linhas.length - 1
  while (i >= 0 && !/^\s*─{20,}\s*$/.test(linhas[i])) i -= 1
  return i < 0 ? linhas.join('\n') : linhas.slice(i + 1).join('\n')
}

/**
 * CC-609: a tecla do menu de permissão, lida da TELA. Medido em 27/09 (versão
 * da VPS): "Do you want to proceed?", "1. Yes", "2. Yes, and switch to auto
 * mode", "3. No", "Esc to cancel". A lista muda (às vezes vem "don't ask
 * again"), então o número sai da tela e nunca é fixo. Puro; null se não é o menu.
 */
export function teclaDaPermissao(tela, decisao) {
  const t = caixaDeBaixo(tela)
  /* O pedido de rede do sandbox não tem "Esc to cancel" (o esc vem dentro da
     opção 3), mas tem a pergunta "Do you want to…". Um dos dois basta. */
  if (!/Esc to cancel|Do you want to/i.test(t)) return null
  const sim = t.match(/^[\s❯]*(\d)\.\s+Yes\s*$/m)
  const nao = t.match(/^[\s❯]*(\d)\.\s+No\b/m)
  if (!sim || !nao) return null
  /* CC-726, pedido dele: o "sempre permitir" do terminal e do app. É a opção
     "Yes, and don't ask again…" ou "Yes, allow all edits…". A de "switch to
     auto mode" NÃO conta: ela muda o modo da sessão inteira. Sem a opção na
     tela, null: o cartão não oferece o que o terminal não tem. */
  if (decisao === 'sempre') {
    const s = t.match(/^[\s❯]*(\d)\.\s+Yes,\s+(?!and switch)(?:and don.t ask again|allow all|always)/im)
    return s ? s[1] : null
  }
  return decisao === 'sim' ? sim[1] : nao[1]
}

/**
 * CC-638: o pedido de permissão lido da TELA, para o que não aparece na
 * conversa principal (o de rede do sandbox, o de um ajudante em segundo
 * plano). Medido em 27/09 no ahtleta-escalada:
 *   "Network request outside of sandbox / Host: overpass-api.de /
 *    Do you want to allow this connection? / 1. Yes / 2. Yes, and don't ask
 *    again… / 3. No, and tell Claude what to do differently (esc)".
 * Puro. Devolve { titulo, detalhe, pergunta, chave } ou null.
 */
export function permissaoDaTela(tela) {
  const linhas = String(tela || '').split('\n').map((l) => l.replace(/\s+$/, ''))
  let q = -1
  for (let i = linhas.length - 1; i >= 0; i -= 1) if (/Do you want to/i.test(linhas[i])) { q = i; break }
  if (q < 0 || !teclaDaPermissao(tela, 'sim')) return null
  let ini = q - 1
  while (ini >= 0 && !/^[─━-]{10,}\s*$/.test(linhas[ini].trim())) ini -= 1
  /* A dica "Tip: auto mode…" quebra em duas linhas ("… choose" / "below"):
     as duas saem. Medido no coepiloto em 27/09. */
  const bloco = linhas.slice(ini + 1, q).map((l) => l.trim()).filter((l) => l && !/^Tip:|auto mode/i.test(l) && !/^below$/i.test(l))
  if (!bloco.length) return null
  const titulo = bloco[0]
  /* O comando vem com "│" na frente de cada linha; a descrição, sem. */
  const cmd = bloco.slice(1).filter((l) => l.startsWith('│')).map((l) => l.replace(/^│\s?/, ''))
  const outras = bloco.slice(1).filter((l) => !l.startsWith('│'))
  const detalhe = cmd.length ? cmd.join('\n') : outras.join('\n')
  const descricao = cmd.length ? outras.join(' ') : ''
  let h = 5381
  for (const c of titulo + '|' + detalhe) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0
  return { titulo, detalhe, descricao, pergunta: linhas[q].trim(), chave: h.toString(36) }
}

/* ── CC-651: os pedidos que o gancho de permissão gravou ──────────────────
   A mesma pasta que `hooks/permissao-painel.mjs` usa. O painel marca que está
   aberto (o gancho só espera quando há alguém olhando), lê os pedidos vivos e
   responde gravando a decisão ao lado do pedido. */
export const DIR_PERMISSOES = () => path.join(DIR_SESSOES_ABRIGO(), '..', 'permissoes')

/* CC-735: `remoto` é ele olhando o painel da OUTRA máquina. Marca as duas: a
   de sempre (o gancho espera) e `.remoto-vendo` (o gancho espera mais, porque
   a resposta atravessa a rede). */
export function marcarPainelAberto(dir = DIR_PERMISSOES(), { remoto = false } = {}) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const t = new Date()
    for (const nome of remoto ? ['.painel-aberto', '.remoto-vendo'] : ['.painel-aberto']) {
      const f = path.join(dir, nome)
      try { fs.utimesSync(f, t, t) } catch { fs.writeFileSync(f, '') }
    }
  } catch { /* sem a marca, o gancho não espera: o pedido vai ao terminal */ }
}

/** CC-735: alguém leu ESTE painel nos últimos 20 s (a marca remota não conta). */
export function painelAbertoAgora(dir = DIR_PERMISSOES(), agora = Date.now()) {
  try {
    const aberto = fs.statSync(path.join(dir, '.painel-aberto')).mtimeMs
    let remoto = 0
    try { remoto = fs.statSync(path.join(dir, '.remoto-vendo')).mtimeMs } catch { /* nunca */ }
    return agora - aberto < 20000 && aberto > remoto + 500
  } catch { return false }
}

export function lerPedidosDoGancho(dir = DIR_PERMISSOES(), agora = Date.now()) {
  let nomes = []
  try { nomes = fs.readdirSync(dir).filter((n) => /^[0-9a-f-]+\.json$/.test(n)) } catch { return [] }
  const out = []
  for (const n of nomes) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))
      if (p && p.id && (!p.ate || p.ate > agora)) out.push(p)
    } catch { /* gravando agora */ }
  }
  return out.sort((a, b) => (a.em || 0) - (b.em || 0))
}

/** Responde um pedido do gancho. Confirma que o gancho leu (o pedido some). */
export async function responderGancho(idGancho, decisao, { dir = DIR_PERMISSOES(), esperar = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  if (!/^[0-9a-f-]{6,20}$/.test(String(idGancho || ''))) return { ok: false, erro: 'pedido inválido' }
  const arq = path.join(dir, idGancho + '.json')
  if (!fs.existsSync(arq)) return { ok: false, erro: 'esse pedido já passou para o terminal (mais de 30 s) ou foi respondido lá: responda na sessão' }
  try { fs.writeFileSync(path.join(dir, idGancho + '.resposta.json'), JSON.stringify({ decisao, em: Date.now() })) } catch (e) { return { ok: false, erro: 'não consegui gravar a resposta: ' + e.message } }
  for (let i = 0; i < 20; i += 1) {
    await esperar(200)
    if (!fs.existsSync(arq)) return { ok: true }
  }
  return { ok: false, erro: 'gravei a resposta, mas o Claude Code não confirmou: confira na sessão' }
}

/** Permite (uma vez) ou nega o pedido de permissão da sessão. */
export async function permitir({ conversa, id, decisao }, deps = DEPS) {
  /* CC-723: a pergunta do Coderoom responde com `escolha:<opção>`. Só pelo
     gancho: pergunta de terminal continua sendo responder na sessão. */
  const escolha = String(id || '').startsWith('gancho:') && /^escolha:.{1,300}$/s.test(String(decisao || ''))
  if (!conversa || !id || (!escolha && !['sim', 'nao', 'sempre'].includes(decisao))) return { ok: false, erro: 'faltou dizer a conversa, o pedido ou a decisão' }
  /* CC-651: pedido que veio do gancho se responde pelo gancho, sem tecla. */
  if (String(id).startsWith('gancho:')) return responderGancho(String(id).slice(7), decisao, deps.gancho || {})
  const sessoes = await deps.sessoes().catch(() => ({}))
  const aqui = Object.values(sessoes || {}).find((s) => s?.conversa === conversa)
  if (!aqui?.sessao) return semTerminal(conversa, 'responda', deps)
  const daTela = String(id).startsWith('tela:')
  const pend = daTela ? null : acaoPendente(deps.lerTranscrito(conversa))
  if (!daTela && (!pend || pend.id !== id)) return { ok: false, erro: 'esse pedido já foi respondido ou trocou: recarregue' }
  const tela = await deps.capturar(aqui.sessao)
  const tecla = teclaDaPermissao(tela, decisao)
  if (!tecla && decisao === 'sempre' && teclaDaPermissao(tela, 'sim')) return { ok: false, erro: 'o terminal não oferece "sempre permitir" para este pedido: use permitir uma vez' }
  if (!tecla) return { ok: false, erro: 'o pedido de permissão não está na tela da sessão agora, então não apertei nada' }
  /* O pedido da tela tem que ser o do cartão: sem isso, um pedido novo que
     apareceu no meio receberia o "sim" dado ao anterior. */
  if (daTela) {
    const pr = permissaoDaTela(tela)
    if (!pr || 'tela:' + pr.chave !== id) return { ok: false, erro: 'o pedido na tela não é o do cartão: recarregue' }
  } else if ((pend.comando || pend.descricao) && !telaMostra(tela, pend.comando) && !telaMostra(tela, pend.descricao)) {
    return { ok: false, erro: 'o pedido na tela não é o do cartão: recarregue' }
  }
  const r = await deps.apertar(aqui.sessao, tecla)
  if (!r?.ok) return { ok: false, erro: 'o terminal recusou a tecla' }
  /* CC-649, print dele: "tá falando que permitiu, mas não permitiu". Duas
     brechas medidas em 27/09:
     1. a conferência tratava leitura de tela FALHA (vazia) como "o pedido
        sumiu", e respondia ok com o pedido ainda lá. Agora só conta leitura
        que veio, e que mostra o pedido fora da tela;
     2. com três opções, o número pode só mover o cursor. Se o pedido segue na
        tela com o cursor na opção escolhida, vai um Enter, uma vez. */
  const mesmoPedido = (t) => (daTela ? (permissaoDaTela(t)?.chave === String(id).slice(5)) : Boolean(teclaDaPermissao(t, 'sim')))
  let enter = false
  for (let i = 0; i < 12; i += 1) {
    await deps.esperar(500)
    const t = await deps.capturar(aqui.sessao)
    if (typeof t !== 'string' || !t.trim()) continue
    if (!mesmoPedido(t)) return { ok: true, sessao: aqui.sessao }
    const cursor = t.match(/❯\s*(\d)\./)
    if (!enter && i >= 1 && cursor && cursor[1] === tecla) { enter = true; await deps.apertar(aqui.sessao, 'Enter') }
  }
  return { ok: false, erro: 'apertei, mas o pedido continua na tela do terminal: confira na sessão' }
}

/**
 * Responde a pergunta pendente da conversa `conversa`, com identificador `id`
 * (o do `tool_use`, que o painel recebeu junto com a pergunta). Nunca lança:
 * devolve `{ ok, erro? }`, com o motivo dito em português.
 */
export async function responder({ conversa, id, respostas }, deps = DEPS) {
  if (!conversa || !id) return { ok: false, erro: 'faltou dizer qual conversa e qual pergunta' }

  const sessoes = await deps.sessoes().catch(() => ({}))
  const aqui = Object.values(sessoes || {}).find((s) => s?.conversa === conversa)
  if (!aqui?.sessao) return semTerminal(conversa, 'responda', deps)

  const pend = perguntaPendente(deps.lerTranscrito(conversa))
  if (!pend || pend.id !== id) return { ok: false, erro: 'essa pergunta já foi respondida ou trocou: recarregue' }

  let passos
  try { passos = teclasPara(pend.perguntas, respostas) } catch (e) { return { ok: false, erro: e.message } }

  const tela = await deps.capturar(aqui.sessao)
  if (!telaMostra(tela, pend.perguntas[0].pergunta)) {
    return { ok: false, erro: 'a pergunta não está na tela da sessão agora, então não apertei nada' }
  }

  /* 30/09, print dele: "a pergunta 2 não apareceu na tela; parei no meio".
     Medido no terminal: na pergunta com PRÉVIA desenhada ao lado das opções,
     o número só move o cursor e é o Enter que escolhe; a tela ficou parada na
     pergunta 1. Em vez de adivinhar pelo formato, confere: se a tela ainda
     está na mesma pergunta (e não na revisão), manda UM Enter e confere de
     novo. A revisão tem texto próprio, e ali um Enter a mais enviaria tudo. */
  const naRevisao = (t) => /Review your answers|Submit answers|Ready to submit your answers/.test(String(t || ''))
  const aindaNa = (t, i) => !naRevisao(t) && telaMostra(t, pend.perguntas[i].pergunta)
  const empurrar = async (anterior) => {
    if (anterior < 0 || pend.perguntas[anterior].multipla) return
    if (aindaNa(await deps.capturar(aqui.sessao), anterior)) { await deps.apertar(aqui.sessao, 'Enter'); await deps.esperar(500) }
  }

  let atual = 0
  for (const p of passos) {
    /* Antes da primeira tecla de cada pergunta seguinte, a tela tem que ter
       avançado para ela. Sem isso, um menu que não avançou recebe a resposta
       da pergunta 2 como se fosse da 1. */
    if (p.pergunta !== undefined && p.pergunta !== atual) {
      const anterior = atual
      atual = p.pergunta
      await deps.esperar(500)
      let tela = await deps.capturar(aqui.sessao)
      if (!telaMostra(tela, pend.perguntas[atual].pergunta) || aindaNa(tela, anterior)) { await empurrar(anterior); tela = await deps.capturar(aqui.sessao) }
      if (!telaMostra(tela, pend.perguntas[atual].pergunta)) {
        return { ok: false, erro: `a pergunta ${atual + 1} não apareceu na tela; parei no meio, confira a sessão` }
      }
    }
    if (p.revisao) {
      await deps.esperar(500)
      if (!naRevisao(await deps.capturar(aqui.sessao))) await empurrar(pend.perguntas.length - 1)
      if (!naRevisao(await deps.capturar(aqui.sessao))) return { ok: false, erro: 'respondi, mas a tela de revisão não apareceu; parei antes de enviar, confira a sessão' }
    }
    const r = p.texto !== undefined ? await deps.escrever(aqui.sessao, p.texto) : await deps.apertar(aqui.sessao, p.tecla)
    if (!r?.ok) return { ok: false, erro: `o terminal recusou a tecla: ${r?.out || 'sem motivo'}` }
    await deps.esperar(250)
  }

  /* A prova é o transcrito, não a tela: a resposta vira `tool_result` do mesmo
     id. Até 10s, porque a sessão grava depois de fechar o menu. */
  for (let i = 0; i < 20; i += 1) {
    await deps.esperar(500)
    const agora = perguntaPendente(deps.lerTranscrito(conversa))
    if (!agora || agora.id !== id) return { ok: true, sessao: aqui.sessao }
  }
  return { ok: false, erro: 'mandei as teclas, mas a sessão não confirmou a resposta: confira nela' }
}
