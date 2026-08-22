/**
 * CC-297: o log das travas, ao vivo.
 *
 * Pedido dele em 22/08: *"ao invés de experimentar, me mostrar as travas em
 * tempo real em um log pra mim, pra eu ficar acompanhando, lá no control
 * center, assim eu mesmo poderia acompanhar"*.
 *
 * Ele disse antes disso que **sente o framework melhorando os resultados**, e
 * escolheu acompanhar em vez de desligar as travas para comparar. A escolha é
 * dele e fecha o assunto do experimento.
 *
 * ## Por que ler o transcrito, e não instrumentar as 41 travas
 *
 * Cada trava é um programa separado, e fazer as 41 gravarem num log comum seria
 * 41 lugares para manter e 41 chances de uma esquecer. O transcrito **já
 * registra** cada devolução, com hora, nome do programa e o texto inteiro que
 * ele devolveu. É a mesma escolha da zona inteligente: ler o que já está
 * escrito sai mais barato e não pode dessincronizar.
 *
 * ## O custo, e como ele é mantido baixo
 *
 * Varrer os 173 MB leva 17 segundos, e isso não pode acontecer num painel que
 * se atualiza de 2 em 2 segundos. Aqui se lê **só a cauda** de cada arquivo
 * (256 KB), com cache por tamanho e data de alteração, exatamente como o painel
 * já faz para achar o último pedido. Arquivo que não mudou não é reaberto.
 *
 * O preço é não enxergar trava antiga: a cauda cobre as últimas horas de cada
 * conversa. Para o histórico existe a série diária, que é outra pergunta.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

const CAUDA = 512 * 1024

/** Cache por arquivo: caminho -> { size, mtimeMs, eventos } */
const cache = new Map()

function lerCauda(file, bytes = CAUDA) {
  const fd = fs.openSync(file, 'r')
  try {
    const { size } = fs.fstatSync(fd)
    const len = Math.min(bytes, size)
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, size - len)
    return { text: buf.toString('utf8'), partial: len < size }
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * O nome do programa que travou, e o recado em português que ele devolveu.
 *
 * O texto vem no formato `[node /caminho/hooks/nome.mjs]: RECADO`. O caminho
 * inteiro não serve para ninguém ler, e o recado sim: é ele que diz o que
 * precisa ser refeito.
 */
function lerErro(texto) {
  const s = String(texto || '')
  const nome = s.match(/hooks\/([a-z0-9-]+)\.(?:mjs|js)/)?.[1] || null
  const corpo = s.replace(/^\s*\[node [^\]]*\]:\s*/, '').trim()
  const linhas = corpo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return {
    trava: nome,
    /* A primeira linha é o título do recado, em maiúsculas, e é o que cabe numa
       linha de log. O resto vira o detalhe, que só aparece quando ele abre. */
    titulo: linhas[0] || corpo.slice(0, 120) || 'sem texto',
    detalhe: linhas.slice(1).join('\n').slice(0, 1200) || null,
  }
}

const projetoDe = (cwd) => (cwd ? path.basename(String(cwd).replace(/[\\/]+$/, '')) : null)

/** A pasta onde o Claude Code guarda as conversas. */
const raizConversas = () => path.join(casaClaude(), 'projects')

function arquivosDeConversa() {
  const raiz = raizConversas()
  const saida = []
  let pastas = []
  try { pastas = fs.readdirSync(raiz) } catch { return saida }
  for (const p of pastas) {
    const dir = path.join(raiz, p)
    try {
      if (!fs.statSync(dir).isDirectory()) continue
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.jsonl')) saida.push(path.join(dir, f))
      }
    } catch { /* pasta sumiu no meio da leitura */ }
  }
  return saida
}

function eventosDoArquivo(file) {
  let stat
  try { stat = fs.statSync(file) } catch { return [] }
  const hit = cache.get(file)
  if (hit && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) return hit.eventos

  let cauda
  try { cauda = lerCauda(file) } catch { return [] }
  const linhas = cauda.text.split('\n')
  /* A primeira linha da cauda vem cortada ao meio: começa no meio de um JSON e
     nunca dá parse. Descartar é obrigatório, não defensivo. */
  if (cauda.partial) linhas.shift()

  const sessao = path.basename(file, '.jsonl')
  const eventos = []
  let cwd = null
  for (const linha of linhas) {
    if (!linha.trim()) continue
    if (!cwd && linha.includes('"cwd":"')) {
      const m = linha.match(/"cwd":"((?:[^"\\]|\\.)*)"/)
      if (m) { try { cwd = JSON.parse(`"${m[1]}"`) } catch { cwd = m[1] } }
    }
    if (!linha.includes('"hookErrors"')) continue
    let o
    try { o = JSON.parse(linha) } catch { continue }
    const errs = Array.isArray(o.hookErrors) ? o.hookErrors : []
    if (!errs.length) continue
    for (const e of errs) {
      const { trava, titulo, detalhe } = lerErro(e)
      eventos.push({
        /* O id junta sessão, hora e nome: é estável entre leituras, que é o que
           permite o julgamento dele sobreviver ao próximo tique. */
        id: `${sessao}|${o.timestamp || ''}|${trava || 'sem-nome'}`,
        quando: o.timestamp || null,
        trava,
        titulo,
        detalhe,
        sessao,
        projeto: projetoDe(o.cwd || cwd),
      })
    }
  }
  cache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, eventos })
  return eventos
}

/* ── O histórico ────────────────────────────────────────────────────────────
 *
 * A cauda alcança as últimas horas de cada conversa, e só isso: medido em
 * 22/08, 22 eventos contra 126 que existem no disco inteiro. Para acompanhar
 * dia após dia isso não basta, e reler os 173 MB a cada tique está fora de
 * questão.
 *
 * A saída é a mesma do armazém: **o que a cauda mostra é acrescentado a um
 * arquivo que só cresce**, e a leitura junta os dois. Cada evento entra uma vez
 * porque o id é estável entre leituras. Quem só acrescenta nunca perde o que já
 * estava lá, mesmo que o processo morra no meio da escrita.
 */
export const ARQUIVO_LOG = () => path.join(casaClaude(), 'control-center-travas.jsonl')
export const ARQUIVO_LOG_ABRIGO = () => path.join(
  path.dirname(DIR_SESSOES_ABRIGO()), 'control-center-travas.jsonl',
)
const LOGS = () => [ARQUIVO_LOG(), ARQUIVO_LOG_ABRIGO()]

function lerHistorico() {
  const porId = new Map()
  for (const arq of LOGS()) {
    let bruto = ''
    try { bruto = fs.readFileSync(arq, 'utf8') } catch { continue }
    for (const linha of bruto.split('\n')) {
      if (!linha.trim()) continue
      /* Linha cortada ao meio é o caso normal num arquivo que só cresce, não
         uma anomalia: pular em silêncio é o comportamento certo. */
      try { const o = JSON.parse(linha); if (o?.id) porId.set(o.id, o) } catch { /* segue */ }
    }
  }
  return porId
}

/** Acrescenta ao histórico o que ainda não está lá. Não lança: log que derruba
 *  o painel por não conseguir gravar seria pior que log curto. */
function guardar(novos = []) {
  if (!novos.length) return { gravados: 0, onde: null }
  const texto = novos.map((e) => JSON.stringify(e)).join('\n') + '\n'
  for (const arq of LOGS()) {
    try {
      fs.mkdirSync(path.dirname(arq), { recursive: true })
      fs.appendFileSync(arq, texto, 'utf8')
      return { gravados: novos.length, onde: arq }
    } catch { /* tenta o próximo */ }
  }
  return { gravados: 0, onde: null }
}

/**
 * As travas mais recentes, de todas as conversas.
 *
 * Ordenado do mais novo para o mais velho, que é a ordem de quem acompanha.
 */
export function eventos({ limite = 80, desde = null, trava = null, projeto = null, guardarNovos = true } = {}) {
  const daCauda = []
  for (const f of arquivosDeConversa()) daCauda.push(...eventosDoArquivo(f))

  /* O histórico primeiro, a cauda por cima: quando os dois têm o mesmo evento,
     o da cauda vence, porque é a leitura mais recente do mesmo texto. */
  const porId = lerHistorico()
  const novos = daCauda.filter((e) => !porId.has(e.id))
  for (const e of daCauda) porId.set(e.id, e)
  if (guardarNovos && novos.length) guardar(novos)

  let todos = [...porId.values()]
  if (desde) todos = todos.filter((e) => e.quando && e.quando >= desde)
  if (trava) todos = todos.filter((e) => e.trava === trava)
  if (projeto) todos = todos.filter((e) => e.projeto === projeto)
  todos.sort((a, b) => String(b.quando).localeCompare(String(a.quando)))
  return todos.slice(0, limite)
}

/** Quantas vezes cada trava apareceu no que a cauda alcança. */
export function resumo(lista = eventos({ limite: 1000 })) {
  const m = new Map()
  for (const e of lista) {
    const k = e.trava || 'sem nome'
    if (!m.has(k)) m.set(k, { trava: k, vezes: 0, ultima: null, titulo: e.titulo })
    const x = m.get(k)
    x.vezes += 1
    if (!x.ultima || String(e.quando) > String(x.ultima)) x.ultima = e.quando
  }
  return [...m.values()].sort((a, b) => b.vezes - a.vezes)
}

/* ── O julgamento dele ──────────────────────────────────────────────────────
 *
 * É a peça que faltava para saber se as travas valem a pena, e a análise de
 * 22/08 mostrou por quê: dá para medir quanto elas custam, e não existe nada
 * medindo se ajudaram. Erro evitado não deixa rastro.
 *
 * Com ele marcando no log, o número nasce de quem sente o resultado, sem
 * precisar desligar nada para comparar. Foi a alternativa que ele escolheu:
 * *"assim eu mesmo poderia acompanhar"*.
 */
export const ARQUIVO = () => path.join(casaClaude(), 'control-center-travas.json')
export const ARQUIVO_ABRIGO = () => path.join(
  path.dirname(DIR_SESSOES_ABRIGO()), 'control-center-travas.json',
)
const ARQUIVOS = () => [ARQUIVO(), ARQUIVO_ABRIGO()]

export function lerJulgamentos() {
  const junto = {}
  for (const arq of ARQUIVOS()) {
    try { Object.assign(junto, JSON.parse(fs.readFileSync(arq, 'utf8'))) } catch { /* não existe ainda */ }
  }
  return junto
}

/**
 * Marca um evento como tendo ajudado ou não.
 *
 * `null` desmarca, porque clicar por engano tem que ter volta. Falha em voz
 * alta quando não consegue gravar: cair no abrigo em silêncio é como o dado
 * parece sumir.
 */
export function julgar(id, valor) {
  if (!id) throw new Error('sem id, não dá para marcar nada')
  if (!['ajudou', 'atrapalhou', null].includes(valor)) throw new Error(`valor desconhecido: ${valor}`)
  const atual = lerJulgamentos()
  if (valor === null) delete atual[id]
  else atual[id] = { valor, em: new Date().toISOString() }

  const texto = JSON.stringify(atual, null, 1)
  for (const arq of ARQUIVOS()) {
    try {
      fs.mkdirSync(path.dirname(arq), { recursive: true })
      /* Escrita atômica: o arquivo inteiro é reescrito a cada marca, e uma
         queda no meio deixaria o julgamento de todos os dias pela metade. */
      const tmp = `${arq}.tmp`
      fs.writeFileSync(tmp, texto, 'utf8')
      fs.renameSync(tmp, arq)
      return { ok: true, onde: arq, total: Object.keys(atual).length }
    } catch { /* tenta o próximo */ }
  }
  throw new Error('não consegui gravar a sua marca em nenhum lugar')
}

/** O placar por trava: quantas ajudaram, quantas atrapalharam, quantas faltam. */
export function placar(lista = eventos({ limite: 1000 })) {
  const j = lerJulgamentos()
  const m = new Map()
  for (const e of lista) {
    const k = e.trava || 'sem nome'
    if (!m.has(k)) m.set(k, { trava: k, vezes: 0, ajudou: 0, atrapalhou: 0, semMarca: 0 })
    const x = m.get(k)
    x.vezes += 1
    const v = j[e.id]?.valor
    if (v === 'ajudou') x.ajudou += 1
    else if (v === 'atrapalhou') x.atrapalhou += 1
    else x.semMarca += 1
  }
  return [...m.values()].map((x) => ({
    ...x,
    /* A proporção só aparece com marca suficiente. Uma marca só viraria "100%
       ajudou", e um número desses na tela é pior que número nenhum. */
    proporcao: (x.ajudou + x.atrapalhou) >= 3
      ? Number((x.ajudou / (x.ajudou + x.atrapalhou) * 100).toFixed(0))
      : null,
    julgadas: x.ajudou + x.atrapalhou,
  })).sort((a, b) => b.vezes - a.vezes)
}

/**
 * A carga inicial: lê as conversas INTEIRAS uma vez e enche o histórico.
 *
 * Cara de propósito, e por isso separada: varre os arquivos completos em vez da
 * cauda. Existe para o log não nascer mostrando as últimas horas quando há
 * meses de história no disco, e para ser chamada de novo se alguém apagar o
 * arquivo acumulado.
 *
 * Roda sob clique, nunca em relógio. É a mesma regra da colheita da zona
 * inteligente e da varredura de portas: leitura de segundos não entra no fluxo
 * que atualiza a tela.
 */
export function recolherTudo() {
  const jaTinha = lerHistorico()
  const achados = []
  for (const file of arquivosDeConversa()) {
    let bruto = ''
    try { bruto = fs.readFileSync(file, 'utf8') } catch { continue }
    const sessao = path.basename(file, '.jsonl')
    let cwd = null
    for (const linha of bruto.split('\n')) {
      if (!linha.trim()) continue
      if (!cwd && linha.includes('"cwd":"')) {
        const m = linha.match(/"cwd":"((?:[^"\\]|\\.)*)"/)
        if (m) { try { cwd = JSON.parse(`"${m[1]}"`) } catch { cwd = m[1] } }
      }
      if (!linha.includes('"hookErrors"')) continue
      let o
      try { o = JSON.parse(linha) } catch { continue }
      const errs = Array.isArray(o.hookErrors) ? o.hookErrors : []
      for (const e of errs) {
        const { trava, titulo, detalhe } = lerErro(e)
        achados.push({
          id: `${sessao}|${o.timestamp || ''}|${trava || 'sem-nome'}`,
          quando: o.timestamp || null,
          trava, titulo, detalhe, sessao,
          projeto: projetoDe(o.cwd || cwd),
        })
      }
    }
  }
  const novos = achados.filter((e) => !jaTinha.has(e.id))
  const r = guardar(novos)
  return { lidos: achados.length, novos: novos.length, ...r }
}

/* ── CC-300: o "?" de cada regra ────────────────────────────────────────────
 *
 * Pedido dele em 22/08: *"coloque '?' em todas as regras explicando o que são,
 * como se ativam e até o prompt. pra eu entender bem"*.
 *
 * São quatro perguntas, e cada uma vem de uma fonte diferente:
 *
 * | pergunta | de onde sai |
 * |---|---|
 * | o que é | a descrição escrita no catálogo de hooks |
 * | quando dispara | o evento declarado, traduzido para português |
 * | o que ela faz ao disparar | o nível: recusa, avisa, devolve, injeta |
 * | o texto que ela devolve | **o último recado de verdade, tirado do log** |
 *
 * A última linha é a decisão que importa. O texto podia ser extraído do código
 * da trava, e sairia cheio de buraco: metade dele é montada na hora com o
 * número de itens, o nome do modo, a lista da fila. **O log guarda o que ela
 * REALMENTE disse**, com os valores preenchidos, que é o que ele leu na tela.
 */

/** O evento do Claude Code em português, porque o nome em inglês não diz nada. */
const QUANDO = {
  PreToolUse: 'antes de eu rodar qualquer comando ou edição',
  PostToolUse: 'depois que um comando termina',
  PostToolUseFailure: 'quando um comando falha',
  PermissionRequest: 'quando eu peço permissão para algo',
  Notification: 'quando o sistema tem um aviso',
  Stop: 'quando eu termino de responder, antes de a resposta chegar em você',
  SessionStart: 'quando a conversa começa',
  SessionEnd: 'quando a conversa termina',
  PreCompact: 'antes de a conversa ser resumida por falta de espaço',
  PostCompact: 'depois de a conversa ser resumida',
  UserPromptSubmit: 'assim que você manda uma mensagem, antes de eu ler',
}

/**
 * Tudo sobre uma regra, para o "?" dela.
 *
 * Devolve `conhecida: false` quando a regra disparou mas não está no catálogo.
 * **Esse caso não pode sumir em silêncio**: é a mesma família do defeito já
 * registrado, em que uma peça fora do catálogo se comporta como se estivesse
 * desligada e ninguém percebe.
 */
export async function explicar(nome, lista = eventos({ limite: 1000 })) {
  const H = await import('./hooksCatalogo.mjs')
  const doCatalogo = (H.HOOKS || []).find((h) => h.id === nome) || null
  const meus = lista.filter((e) => e.trava === nome)
  const ultimo = meus[0] || null
  const j = lerJulgamentos()
  const ajudou = meus.filter((e) => j[e.id]?.valor === 'ajudou').length
  const atrapalhou = meus.filter((e) => j[e.id]?.valor === 'atrapalhou').length

  return {
    trava: nome,
    conhecida: Boolean(doCatalogo),
    label: doCatalogo?.label || null,
    modulo: doCatalogo?.modulo || null,
    descricao: doCatalogo?.descricao
      || 'esta regra disparou mas não está descrita no catálogo, então não dá para dizer o que ela cobra sem abrir o código dela.',
    evento: doCatalogo?.evento || null,
    quando: QUANDO[doCatalogo?.evento] || 'não está declarado quando ela dispara',
    nivel: doCatalogo?.nivel || null,
    oQueFaz: H.NIVEIS?.[doCatalogo?.nivel] || 'não declarado',
    arquivo: doCatalogo?.script || `${nome}.mjs`,
    vezes: meus.length,
    ajudou,
    atrapalhou,
    /* O recado inteiro, do jeito que ele saiu. É a parte que ele pediu por
       último e a que mais ensina: a regra em abstrato não diz nada, o texto
       que ela devolve diz tudo. */
    ultimoRecado: ultimo ? { quando: ultimo.quando, titulo: ultimo.titulo, detalhe: ultimo.detalhe } : null,
  }
}
