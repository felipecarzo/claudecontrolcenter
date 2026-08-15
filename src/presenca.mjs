/**
 * CC-49: cruzar o quadro de rotas com quem ainda está vivo.
 *
 * ## O problema, com prova
 *
 * Em 14/08 a rota `backlog` deste projeto estava 🔴 ocupada por `5805d6bb`,
 * sessão que tinha encerrado o dia e commitado o fechamento **mais de uma hora
 * antes**. O quadro mentia, e o próximo agente respeitava a mentira: não é que
 * ele fosse enganado por pouco tempo, é que rota esquecida fica ocupada para
 * sempre, porque só quem marcou costuma liberar.
 *
 * O painel já sabe quem está vivo (job de background pelo `updatedAt`, sessão
 * interativa pelo `mtime` do transcrito). Faltava juntar as duas coisas.
 *
 * ## O limite, e ele importa
 *
 * **Presença detecta colisão em curso, não previne a próxima.** Saber que
 * `5805d6bb` sumiu não diz nada sobre a sessão que vai começar em dez minutos.
 * Isto complementa a marcação à mão, nunca substitui — e por isso o veredito é
 * "provavelmente órfã", nunca "livre". Quem decide retomar é quem lê.
 *
 * ## Por que não libera sozinho
 *
 * Porque um agente pode estar pensando há vinte minutos sem escrever nada, e
 * liberar a rota dele por silêncio é exatamente a colisão que o método existe
 * para evitar. O silêncio vira informação na tela, não ação automática.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Silêncio a partir do qual a rota passa a ser suspeita. Uma hora é folgado
 *  de propósito: sessão longa passa dezenas de minutos numa tarefa só. */
export const SILENCIO_MS = 60 * 60 * 1000

/** Linha de tabela que descreve uma rota: tem barra vertical e um dos sinais.
 *  A linha `[exemplo]` vem do template e não é rota de ninguém — contá-la
 *  fazia todo projeto recém-instalado aparecer com uma rota ocupada fantasma. */
const ehLinhaDeRota = (l) => l.includes('|')
  && (l.includes('🔴') || l.includes('🟢'))
  && !/\[exemplo\]/i.test(l)

/** O id de sessão citado na linha. São 8 hexadecimais, o formato que o painel
 *  mostra e que o `rota-guard` manda escrever. */
const idNaLinha = (linha) => (linha.match(/\b([0-9a-f]{8})\b/i) || [])[1] || null

/** O nome da rota vem entre crases na primeira coluna. */
const nomeNaLinha = (linha) => (linha.match(/`([^`]+)`/) || [])[1] || null

/**
 * Lê o quadro e devolve uma linha por rota ocupada, dizendo se quem a marcou
 * ainda dá sinal.
 *
 * `sinais` é um mapa `id curto -> timestamp do último sinal`, montado por quem
 * chama a partir de `readJobs()` e `readSessoes()` — assim este módulo continua
 * puro e testável sem disco.
 */
export function rotasOcupadas(textoDoQuadro, sinais = new Map(), agora = Date.now()) {
  const ocupadas = []
  /* Comentário HTML fora primeiro. Os quadros trazem, dentro de `<!-- -->`, um
     exemplo de como preencher uma linha ocupada — e ele casava todos os
     critérios de rota de verdade. O quadro deste projeto acusava uma
     `feature/checkout` ocupada que nunca existiu. */
  const semExemplos = String(textoDoQuadro || '').replace(/<!--[\s\S]*?-->/g, '')
  for (const linha of semExemplos.split(/\r?\n/)) {
    if (!ehLinhaDeRota(linha) || !linha.includes('🔴')) continue

    const id = idNaLinha(linha)
    const ultimoSinal = id ? (sinais.get(id) ?? null) : null
    const silencioMs = ultimoSinal == null ? null : agora - ultimoSinal

    ocupadas.push({
      rota: nomeNaLinha(linha),
      id,
      ultimoSinal,
      silencioMs,
      /* Três vereditos, e o do meio é o que o CC-49 acrescenta:
         - `ativa`: deu sinal há pouco, respeite;
         - `orfa`: marcada por alguém que sumiu, provavelmente esquecida;
         - `desconhecida`: sem id na linha, ou id que o painel não conhece —
           pode ser sessão de outra máquina, então NÃO é o mesmo que órfã. */
      veredito: silencioMs == null
        ? 'desconhecida'
        : silencioMs > SILENCIO_MS ? 'orfa' : 'ativa',
    })
  }
  return ocupadas
}

/** `3h 12min`, para caber numa linha de tabela. */
export function humanizar(ms) {
  if (ms == null) return '—'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  return `${h}h ${min % 60}min`
}

/**
 * Último sinal de cada sessão que existe NO DISCO, sem janela de tempo.
 *
 * Não dá para reusar `readSessoes()` aqui, e a razão é o caso que motivou o
 * CC-49: `5805d6bb` marcou a rota e sumiu **no dia anterior**. A janela de 24h
 * do painel existe para a tela não virar arquivo morto, mas aqui ela apagava
 * justamente a sessão que se quer denunciar — a rota aparecia como "sem sinal
 * conhecido", que é o mesmo rótulo de sessão de outra máquina.
 *
 * Com o disco inteiro, os dois casos ficam distinguíveis: existe transcrito e é
 * velho, então é órfã; não existe transcrito nenhum, então é de outra máquina e
 * não se pode afirmar nada.
 */
export function sinaisDoDisco(pastaProjetos) {
  const sinais = new Map()
  let pastas = []
  try {
    pastas = fs.readdirSync(pastaProjetos, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(pastaProjetos, d.name))
  } catch { return sinais }

  for (const pasta of pastas) {
    let arquivos = []
    try { arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.jsonl')) } catch { continue }
    for (const nome of arquivos) {
      let st
      try { st = fs.statSync(path.join(pasta, nome)) } catch { continue }
      const curto = path.basename(nome, '.jsonl').slice(0, 8)
      // a sessão pode ter transcrito em mais de um projeto: vale o mais recente
      if (!sinais.has(curto) || sinais.get(curto) < st.mtimeMs) sinais.set(curto, st.mtimeMs)
    }
  }
  return sinais
}

export const quadroDe = (dir) => path.join(dir, 'docs', 'ROTAS-ATIVAS.md')

export function lerQuadro(dir) {
  try { return fs.readFileSync(quadroDe(dir), 'utf8') } catch { return null }
}

/**
 * O retrato pronto para a tela, já com os sinais do painel cruzados.
 *
 * Recebe as duas listas em vez de importá-las para não criar ciclo com
 * `jobs.mjs`, e para o teste conseguir montar o cenário sem disco.
 */
export function retratoDoQuadro(dir, { jobs = [], sessoes = [], pastaProjetos = null, agora = Date.now() } = {}) {
  const texto = lerQuadro(dir)
  if (texto == null) return null

  // o disco primeiro (alcança sessão velha), e o painel por cima (mais preciso)
  const sinais = pastaProjetos ? sinaisDoDisco(pastaProjetos) : new Map()
  for (const j of [...jobs, ...sessoes]) {
    if (!j?.id) continue
    const quando = Number(j.updatedAt) || Date.parse(j.updatedAt) || 0
    if (quando) sinais.set(String(j.id).slice(0, 8), quando)
  }

  const ocupadas = rotasOcupadas(texto, sinais, agora)
  return {
    arquivo: quadroDe(dir),
    ocupadas,
    orfas: ocupadas.filter((r) => r.veredito === 'orfa'),
  }
}
