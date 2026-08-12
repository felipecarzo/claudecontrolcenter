// A agenda do Felipe dentro do painel, lida do Google Calendar.
//
// Por que iCal e não a API do Google: a URL secreta (Configurações do
// calendário › "Endereço secreto no formato iCal") entrega o calendário
// inteiro num GET, sem OAuth, sem chave, sem cadastro de aplicativo e sem
// dependência nova — o painel continua com zero pacote de runtime. Escrever
// evento continua fora daqui: é o CC-21, por MCP no Claude Code.
//
// A URL É a credencial: quem tem o link lê a agenda toda. Por isso ela mora
// no `control-center.json` da máquina (nunca no repositório, que é público) e
// NUNCA volta pro navegador — `/api/calendario` devolve nome e eventos, jamais
// o endereço. Mesma decisão do host da VPS.
//
// Rede: é a segunda e última chamada de rede do painel, junto do câmbio. Não é
// cara como a VPS (não usa chave privada) nem como `Get-Process` (não trava o
// event loop), então pode ser buscada sob demanda com cache. Ainda assim não
// entra no tique de 2s dos agentes: quem pede é a aba, quando aberta.

import { readConfig } from './config.mjs'

const VALIDADE_MS = 15 * 60_000
const MAX_ICS = 8 * 1024 * 1024 // agenda de anos ainda cabe; acima disso é engano
const MAX_OCORRENCIAS = 500 // teto por evento: RRULE sem fim não pode virar loop

const cache = new Map() // url -> { em, eventos }

/**
 * ICS quebra linha longa em 75 octetos e continua na linha seguinte começando
 * com espaço ou tab. Sem desdobrar isso primeiro, um título comprido vira dois
 * campos e o segundo não casa com nada.
 *
 * Split por `/\r?\n/` e não por `\n`: os arquivos vêm CRLF, e `.` do regex não
 * casa `\r` — foi exatamente o que zerou o leitor de roadmap uma vez.
 */
export function desdobrar(texto) {
  const linhas = []
  for (const linha of String(texto).split(/\r?\n/)) {
    if (/^[ \t]/.test(linha) && linhas.length) linhas[linhas.length - 1] += linha.slice(1)
    else linhas.push(linha)
  }
  return linhas
}

/** `DTSTART;TZID=America/Sao_Paulo:20260812T140000` → nome, params e valor. */
function campo(linha) {
  const corte = linha.indexOf(':')
  if (corte < 0) return null
  const [nome, ...partes] = linha.slice(0, corte).split(';')
  const params = {}
  for (const p of partes) {
    const i = p.indexOf('=')
    if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, '')
  }
  return { nome: nome.toUpperCase(), params, valor: linha.slice(corte + 1) }
}

/** Texto de ICS escapa vírgula, ponto e vírgula e quebra de linha. */
const destextar = (v) => String(v)
  .replace(/\\n/gi, '\n')
  .replace(/\\([,;\\])/g, '$1')
  .trim()

/**
 * Converte data de ICS em Date.
 *
 * Três formatos: `20260812` (dia inteiro), `20260812T140000Z` (UTC) e
 * `20260812T140000` (horário local do calendário).
 *
 * ponytail: horário sem `Z` é tratado como horário desta máquina, ignorando o
 * TZID. Certo para quem lê a própria agenda no próprio fuso, que é o caso.
 * Errado ao ler calendário de outro fuso — aí o caminho é `Intl.DateTimeFormat`
 * com `timeZone` para achar o deslocamento, e só vale a pena quando acontecer.
 */
export function paraData(valor, params = {}) {
  const v = String(valor || '').trim()
  const dia = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (dia) return { data: new Date(+dia[1], +dia[2] - 1, +dia[3]), diaInteiro: true }

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v)
  if (!m) return null
  const [, a, mes, d, h, min, s, z] = m
  const data = z
    ? new Date(Date.UTC(+a, +mes - 1, +d, +h, +min, +s))
    : new Date(+a, +mes - 1, +d, +h, +min, +s)
  return { data, diaInteiro: params.VALUE === 'DATE' }
}

const DIAS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

/** `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T000000Z` → objeto. */
function lerRegra(valor) {
  const r = {}
  for (const parte of String(valor).split(';')) {
    const i = parte.indexOf('=')
    if (i > 0) r[parte.slice(0, i).toUpperCase()] = parte.slice(i + 1)
  }
  return {
    freq: (r.FREQ || '').toUpperCase(),
    intervalo: Math.max(1, Number(r.INTERVAL) || 1),
    conta: Number(r.COUNT) || 0,
    ate: r.UNTIL ? paraData(r.UNTIL)?.data || null : null,
    dias: (r.BYDAY || '').split(',').map((d) => DIAS[d.slice(-2).toUpperCase()]).filter((n) => n >= 0),
  }
}

/**
 * Expande um evento recorrente dentro da janela pedida.
 *
 * ponytail: cobre FREQ diário/semanal/mensal/anual com INTERVAL, COUNT, UNTIL,
 * BYDAY e EXDATE — que é o que uma agenda de trabalho usa. Fica de fora
 * BYMONTHDAY/BYSETPOS ("toda última sexta") e RECURRENCE-ID (a instância que
 * foi movida sozinha aparece no horário original). Suportar isso direito é
 * reescrever a RFC 5545; quando aparecer um evento assim na tela, o caminho é
 * ler a instância já expandida da API do Google em vez de expandir aqui.
 */
function repetir(inicio, regra, excecoes, de, ate) {
  const fora = new Set(excecoes.map((d) => d.getTime()))
  const datas = []
  const cursor = new Date(inicio)
  const limite = regra.ate && regra.ate < ate ? regra.ate : ate
  const semanal = regra.freq === 'WEEKLY' && regra.dias.length > 0
  // COUNT conta OCORRÊNCIA, não repetição da regra: "FREQ=WEEKLY;BYDAY=MO,WE;
  // COUNT=3" são três reuniões, não três semanas. Contar volta a partir do
  // começo da série, inclusive o que ficou antes da janela pedida.
  let geradas = 0

  const guardar = (d) => {
    if (d < inicio) return
    if (regra.conta && geradas >= regra.conta) return
    geradas++
    if (d >= de && d <= limite && !fora.has(d.getTime())) datas.push(new Date(d))
  }

  const dias = [...regra.dias].sort((a, b) => a - b) // em ordem, senão o COUNT corta o dia errado

  for (let i = 0; i < MAX_OCORRENCIAS; i++) {
    if (regra.conta && geradas >= regra.conta) break

    if (semanal) {
      // A parada olha o DOMINGO da semana, não o cursor. Parar no cursor perde
      // a última semana inteira: com janela terminando na quarta, o cursor da
      // semana seguinte já nasce depois do limite e a segunda e a terça, que
      // cabiam, nunca chegam a ser geradas.
      const domingo = new Date(cursor)
      domingo.setDate(cursor.getDate() - cursor.getDay())
      if (domingo > limite) break
      for (const dia of dias) {
        const d = new Date(domingo)
        d.setDate(domingo.getDate() + dia)
        d.setHours(cursor.getHours(), cursor.getMinutes(), cursor.getSeconds(), 0)
        guardar(d)
      }
    } else {
      if (cursor > limite) break
      guardar(new Date(cursor))
    }

    if (regra.freq === 'DAILY') cursor.setDate(cursor.getDate() + regra.intervalo)
    else if (regra.freq === 'WEEKLY') cursor.setDate(cursor.getDate() + 7 * regra.intervalo)
    else if (regra.freq === 'MONTHLY') cursor.setMonth(cursor.getMonth() + regra.intervalo)
    else if (regra.freq === 'YEARLY') cursor.setFullYear(cursor.getFullYear() + regra.intervalo)
    else break // frequência que não se sabe expandir: fica só a primeira
  }
  return datas
}

/**
 * Lê o ICS inteiro e devolve os eventos que caem na janela, já com as
 * recorrências expandidas. Evento cancelado (`STATUS:CANCELLED`) fica de fora:
 * o Google mantém a linha no arquivo depois de excluído.
 */
export function lerIcs(texto, { de, ate } = {}) {
  const janelaDe = de || new Date(0)
  const janelaAte = ate || new Date(8.64e15)
  const eventos = []
  let atual = null

  for (const linha of desdobrar(texto)) {
    if (linha === 'BEGIN:VEVENT') { atual = { excecoes: [] }; continue }
    if (linha === 'END:VEVENT') {
      if (atual?.inicio && atual.status !== 'CANCELLED') {
        const duracao = atual.fim ? atual.fim - atual.inicio : (atual.diaInteiro ? 864e5 : 36e5)
        const quando = atual.regra
          ? repetir(atual.inicio, atual.regra, atual.excecoes, janelaDe, janelaAte)
          : (atual.inicio <= janelaAte && new Date(+atual.inicio + duracao) >= janelaDe ? [atual.inicio] : [])

        for (const inicio of quando) {
          eventos.push({
            uid: atual.uid || '',
            titulo: atual.titulo || '(sem título)',
            local: atual.local || '',
            inicio: +inicio,
            fim: +inicio + duracao,
            diaInteiro: !!atual.diaInteiro,
            repete: !!atual.regra,
          })
        }
      }
      atual = null
      continue
    }
    if (!atual) continue

    const c = campo(linha)
    if (!c) continue
    if (c.nome === 'SUMMARY') atual.titulo = destextar(c.valor)
    else if (c.nome === 'LOCATION') atual.local = destextar(c.valor)
    else if (c.nome === 'UID') atual.uid = c.valor.trim()
    else if (c.nome === 'STATUS') atual.status = c.valor.trim().toUpperCase()
    else if (c.nome === 'RRULE') atual.regra = lerRegra(c.valor)
    else if (c.nome === 'DTSTART') {
      const d = paraData(c.valor, c.params)
      if (d) { atual.inicio = d.data; atual.diaInteiro = d.diaInteiro }
    } else if (c.nome === 'DTEND') {
      const d = paraData(c.valor, c.params)
      if (d) atual.fim = d.data
    } else if (c.nome === 'EXDATE') {
      for (const v of c.valor.split(',')) {
        const d = paraData(v, c.params)
        if (d) atual.excecoes.push(d.data)
      }
    }
  }

  return eventos.sort((a, b) => a.inicio - b.inicio)
}

/** Baixa um calendário, com cache por URL. Nunca lança: agenda fora do ar esconde um cartão. */
async function baixar(url, { force = false } = {}) {
  const guardado = cache.get(url)
  if (!force && guardado && Date.now() - guardado.em < VALIDADE_MS) return guardado

  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    const texto = await resposta.text()
    if (texto.length > MAX_ICS) throw new Error('ICS grande demais')
    if (!texto.includes('BEGIN:VCALENDAR')) throw new Error('não parece um calendário')
    const novo = { em: Date.now(), texto, erro: null }
    cache.set(url, novo)
    return novo
  } catch (e) {
    // Falhou: vale o último texto lido, com a idade na tela — igual ao câmbio.
    const caido = { ...(guardado || { texto: '' }), erro: String(e.message || e) }
    cache.set(url, caido)
    return caido
  }
}

/** Só o que é seguro mandar pro navegador: a URL é credencial e fica aqui. */
const semSegredo = (c, i) => ({ id: c.id || `cal${i}`, nome: c.nome || `calendário ${i + 1}`, cor: c.cor || null })

/**
 * A agenda dos próximos `dias`, juntando todos os calendários configurados.
 * `passados` traz também o que já começou hoje, que é o que responde "o que eu
 * fiz hoje" — a pergunta do digest de conteúdo, não só "o que vem agora".
 */
export async function agenda({ dias = 7, force = false } = {}) {
  const { calendarios = [] } = readConfig()
  if (!calendarios.length) return { configurado: false, calendarios: [], eventos: [], em: Date.now() }

  const de = new Date()
  de.setHours(0, 0, 0, 0)
  const ate = new Date(de)
  ate.setDate(de.getDate() + Math.min(Math.max(1, dias), 90))

  const lidos = await Promise.all(calendarios.map((c) => baixar(c.url, { force })))
  const eventos = []
  const fontes = []

  lidos.forEach((lido, i) => {
    const cal = semSegredo(calendarios[i], i)
    fontes.push({ ...cal, erro: lido.erro || null, em: lido.em || null })
    if (!lido.texto) return
    for (const e of lerIcs(lido.texto, { de, ate })) eventos.push({ ...e, calendario: cal.id, cor: cal.cor })
  })

  return {
    configurado: true,
    calendarios: fontes,
    eventos: eventos.sort((a, b) => a.inicio - b.inicio),
    de: +de,
    ate: +ate,
    em: Date.now(),
  }
}

export function esquecerCache() { cache.clear() }

export const _internals = { VALIDADE_MS, MAX_OCORRENCIAS, lerRegra, repetir }
