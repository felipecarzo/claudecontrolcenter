/**
 * O retrato do Método Routia para a tela: quem segura o quê, e o que os agentes
 * combinaram entre si.
 *
 * ## Por que existe
 *
 * Pedido dele em 27/08, à noite, depois de aprovar as três telas de projeto:
 *
 * > *"seria legal ter uma aba lateral dedicada só pra essa questão das rotas,
 * > pra ver as rotas que estão sendo mexidas entre os agentes (…) quais arquivos
 * > estão se cruzando (…) pra ver a gravidade de quando esses agentes estão
 * > mexendo no mesmo arquivo"*
 *
 * E, junto:
 *
 * > *"poderia ter um campo de tickets que são sendo gerados, por projeto e por
 * > rota (…) que são as conversas entre os agentes pra autorizar o que vai ser
 * > feito, o que não vai ser feito"*
 *
 * ## O que foi medido antes de escrever isto, e o que mudou por causa disso
 *
 * - **A conversa já está gravada e ninguém a vê.** `docs/.recados.json` tinha 13
 *   recados com autor, destino, tipo e arquivo em jogo.
 * - **Os pedidos de autorização também, e é pior:** `docs/.rotas-pedidos.json`
 *   tinha 16 pedidos, TODOS com status `pendente`. Ninguém respondeu nenhum,
 *   porque não existia tela que os mostrasse. O mecanismo funcionava, o dado se
 *   acumulava, e o buraco era invisível porque ninguém desobedeceu.
 * - **O quadro tem 53 linhas e 8 ocupadas.** Ele guarda histórico e estado no
 *   mesmo arquivo, então o que vale hoje fica afogado.
 * - **`situacaoRotas()` só sabe contar.** Devolve total e ocupadas, mais nada.
 *   Quem, em que arquivo e em que modo não saía de lugar nenhum: é essa peça
 *   que nasce aqui.
 *
 * ## A regra que este módulo NÃO reinventa
 *
 * Quem é o dono de uma linha vem de `donoDaLinha()`, em `routia.mjs`. A
 * pergunta é POSICIONAL, nunca textual: a linha carrega o histórico dela
 * inteiro, então perguntar com `includes` faz toda sessão apenas CITADA virar
 * dona. Isso custou dois defeitos medidos em 27/08, um deles o CC-362. Uma
 * segunda conta aqui seria o mesmo erro pela terceira vez.
 */
import fs from 'node:fs'
import path from 'node:path'
import { donoDaLinha } from './routia.mjs'

const QUADRO = ['docs', 'ROTAS-ATIVAS.md']
const RECADOS = ['docs', '.recados.json']
const PEDIDOS = ['docs', '.rotas-pedidos.json']

const lerJson = (arquivo) => {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')) } catch { return null }
}

/**
 * Uma linha da tabela vira objeto.
 *
 * O corte é por `|`, e as colunas do meio são REJUNTADAS de propósito: o texto
 * que as sessões escrevem ali contém barra vertical de vez em quando (caminho,
 * alternativa, tabela citada), e cortar em pedaços fixos perderia metade do
 * recado sem erro nenhum aparecer.
 */
export function lerLinha(linha) {
  const bruta = String(linha || '')
  if (!/^\|\s*[^|]*`[^`]+`/.test(bruta)) return null

  const partes = bruta.split('|')
  /* Primeiro e último pedaço são o vazio antes e depois das barras da borda. */
  const campos = partes.slice(1, -1)
  if (campos.length < 2) return null

  const colRota = campos[0]
  const colEstado = campos[1] || ''
  const colDesde = campos.length > 3 ? campos[campos.length - 1] : ''
  const corpo = (campos.length > 3 ? campos.slice(2, -1) : campos.slice(2)).join('|')

  const nome = (colRota.match(/`([^`]+)`/) || [])[1] || null
  if (!nome) return null

  const ocupada = colEstado.includes('🔴')
  const ticket = colEstado.includes('🎫')
  /* Linha riscada com `~~` é histórico que a sessão deixou no quadro para não
     perder o rastro. Ela não disputa nada, e misturá-la com o que vale hoje é
     justamente o que faz 53 linhas afogarem 8. */
  const historico = /~~/.test(colRota)

  return {
    rota: nome,
    ocupada,
    ticket,
    historico,
    dono: ocupada ? donoDaLinha(bruta) : null,
    /* O modo declarado na linha. Só de comportamento: modo que tranca escrita
       continua sendo do projeto, e duas travas discordando sobre quem escreve
       é o cenário que o Routia existe para evitar. */
    modo: (corpo.match(/🎚\s*`?([a-zà-ú-]+)`?/i) || [])[1] || null,
    arquivos: [...corpo.matchAll(/📁\s*([^\s|📁🎚]+)/g)].map((m) => m[1]),
    desde: colDesde.trim().replace(/^[-—:\s]+$/, '') || null,
    texto: corpo.trim(),
  }
}

/**
 * Só as linhas que valem: as de dentro de comentário HTML ficam de fora.
 *
 * ⚠️ **Isto não é preciosismo, é a terceira vez que o mesmo defeito aparece.**
 * O quadro guarda exemplos de como preencher uma linha, e eles são linhas de
 * tabela de verdade. Soltos, viravam rota ocupada: em 22/08 um exemplo travou
 * `src/ui.html` para valer, e antes disso a `feature/checkout`, que nunca
 * existiu, aparecia como ocupada. A defesa da época foi enfiar os exemplos
 * dentro de `<!-- -->`, e ela funciona para quem lê o arquivo. Para quem lê com
 * regex, não: medido em 27/08, este módulo contava a `feature/checkout` como a
 * oitava rota ocupada, com dono nenhum.
 *
 * A conta certa é por ESTADO, varrendo de cima para baixo, e não por linha
 * isolada: um comentário abre numa linha e fecha noutra, então nenhuma regex
 * aplicada a uma linha sozinha consegue saber se ela está dentro dele.
 */
export function foraDeComentario(linhas) {
  const saida = []
  let dentro = false
  for (const linha of linhas) {
    const abre = linha.lastIndexOf('<!--')
    const fecha = linha.lastIndexOf('-->')
    const jaEstava = dentro
    if (abre > fecha) dentro = true
    else if (fecha > abre) dentro = false
    /* A própria linha que ABRE o comentário já está comentada da abertura em
       diante, e a que FECHA vale a partir do fechamento. Nos dois casos a linha
       de tabela inteira fica de um lado só, porque ninguém escreve meia linha
       de tabela: basta não deixar passar a que abre. */
    if (!jaEstava && !dentro) saida.push(linha)
    else if (jaEstava && !dentro) saida.push(linha)
  }
  return saida
}

/** Todas as linhas do quadro de um projeto, já lidas. */
export function lerQuadro(raiz) {
  let texto = null
  try { texto = fs.readFileSync(path.join(raiz, ...QUADRO), 'utf8') } catch { return null }
  /* `split(/\r?\n/)`, nunca `.` no regex: os arquivos deste projeto viajam
     entre Windows e Linux, e um `\r` sobrando já zerou um parser inteiro aqui. */
  return foraDeComentario(texto.split(/\r?\n/)).map(lerLinha).filter(Boolean)
}

/**
 * Os recados e os pedidos, normalizados no mesmo formato.
 *
 * São duas origens porque são duas coisas diferentes que ele chamou pelo mesmo
 * nome: o recado é a conversa ("vou mexer no seu arquivo"), o pedido é o
 * bloqueio virando autorização ("o guarda me barrou neste arquivo"). Na tela
 * eles respondem a mesma pergunta, então saem juntos e com a origem marcada.
 */
export function lerTickets(raiz) {
  const saida = []

  const recados = lerJson(path.join(raiz, ...RECADOS))?.recados || []
  for (const r of recados) {
    saida.push({
      fonte: 'recado',
      id: r.id || null,
      de: r.de || null,
      para: r.para || null,
      tipo: r.tipo || 'aviso',
      arquivo: r.arquivo || null,
      quando: Number(r.em) || null,
      texto: r.texto || '',
      /* Só os dois tipos que PEDEM resposta entram como pendentes. Um aviso
         nunca fica devendo nada, e contá-lo como pendente encheria a tela de
         alarme falso, que é o jeito mais rápido de ela virar paisagem. */
      pedeResposta: r.tipo === 'vou_mexer' || r.tipo === 'pare',
      respondido: false,
    })
  }

  /* Um recado que pede resposta é considerado respondido quando existe, DEPOIS
     dele, um recado no sentido contrário entre as mesmas duas sessões. É a
     leitura honesta do que está gravado: não há campo de resposta no arquivo,
     e inventar um aqui faria a tela afirmar mais do que sabe. */
  for (const t of saida) {
    if (!t.pedeResposta) continue
    t.respondido = saida.some((o) => o.fonte === 'recado'
      && o.de === t.para && o.para === t.de
      && Number(o.quando) > Number(t.quando))
  }

  const pedidos = lerJson(path.join(raiz, ...PEDIDOS))?.pedidos || []
  for (const p of pedidos) {
    saida.push({
      fonte: 'pedido',
      id: p.id || null,
      de: p.de || null,
      /* Pedido não tem destinatário: ele nasce de um bloqueio, e quem responde
         é quem estiver segurando a rota do arquivo. A tela precisa saber disso
         para não desenhar uma seta para ninguém. */
      para: null,
      tipo: 'autorizacao',
      arquivo: p.arquivo || null,
      quando: Number(p.em) || null,
      texto: '',
      rotasOcupadas: Array.isArray(p.rotasOcupadas) ? p.rotasOcupadas : [],
      tentativas: Number(p.tentativas) || 1,
      pedeResposta: true,
      respondido: p.status && p.status !== 'pendente',
      status: p.status || 'pendente',
    })
  }

  /* Mais novo primeiro: o que acabou de acontecer é o que ele precisa ver. */
  saida.sort((a, b) => (b.quando || 0) - (a.quando || 0))
  return saida
}

/**
 * O cruzamento: qual arquivo tem mais de uma rota ocupada em cima.
 *
 * ⚠️ **O silêncio aqui é enganoso, e por isso ele vem acompanhado.** Uma rota
 * que não declara `📁` nenhum é invisível para este cálculo: ela pode estar
 * mexendo no mesmo arquivo de outra e nada apareceria. Devolver só a lista de
 * disputas faria a tela dizer "está tudo tranquilo" sobre o que não olhou, que
 * é a família de defeito mais cara deste painel. Por isso `semArquivo` sai
 * junto, e a tela é obrigada a contar as duas coisas.
 */
/**
 * A "awareness": este agente sabe o que o outro está fazendo no arquivo dele?
 *
 * ## O pedido, e por que ele não é um desenho
 *
 * Palavras dele em 27/08: *"qual é a awareness do agente que está na rota em
 * relação ao que o outro agente está fazendo naquela rota e vice-versa"*.
 *
 * Isso não é uma tela nova: é uma PERGUNTA, e ela tem resposta no dado que já
 * existe. Os recados registram quem avisou quem, quando, e sobre o quê. Duas
 * rotas no mesmo arquivo COM conversa entre os donos é o caso bom, e aconteceu
 * de verdade em 27/08: duas sessões no mesmo arquivo, quatro recados trocados,
 * zero estrago. Duas rotas no mesmo arquivo SEM conversa nenhuma é o acidente
 * de 06/08, em que ninguém avisou ninguém.
 *
 * ⚠️ **A conversa conta em qualquer direção, e conta mesmo sem citar o
 * arquivo.** Quase nenhum recado real traz `arquivo` preenchido: dos 29 medidos
 * neste projeto, a maioria vem com `null`. Exigir que o recado nomeie o arquivo
 * disputado daria "ninguém se falou" em todo caso real, e o alarme mais caro é
 * o que toca sempre.
 *
 * ⚠️ **E o silêncio não é acusação de ninguém.** A resposta é sobre a DUPLA,
 * não sobre um culpado: quem chegou primeiro não tinha como avisar de uma rota
 * que ainda não existia.
 */
export function awareness(disputados = [], tickets = []) {
  const falou = new Set()
  for (const t of tickets) {
    if (!t?.de || !t?.para) continue
    falou.add(`${t.de}|${t.para}`)
  }
  const seConhecem = (a, b) => falou.has(`${a}|${b}`) || falou.has(`${b}|${a}`)

  return disputados.map((d) => {
    const quem = d.quem || []
    const pares = []
    for (let i = 0; i < quem.length; i++) {
      for (let j = i + 1; j < quem.length; j++) {
        const a = quem[i]
        const b = quem[j]
        pares.push({
          rotas: [a.rota, b.rota],
          donos: [a.dono, b.dono],
          conversaram: seConhecem(a.dono, b.dono),
          /* Quantos recados existem entre os dois, para a tela poder dizer
             "quatro recados" em vez de só "conversaram". */
          recados: tickets.filter((t) => (t.de === a.dono && t.para === b.dono)
            || (t.de === b.dono && t.para === a.dono)).length,
        })
      }
    }
    const cegos = pares.filter((p) => !p.conversaram)
    return {
      arquivo: d.arquivo,
      quem,
      pares,
      /* O veredito em uma palavra, que é o que cabe no cartão. */
      estado: !pares.length ? 'sozinho' : cegos.length ? 'cego' : 'avisado',
    }
  })
}

export function cruzamentos(linhas) {
  const vivas = linhas.filter((l) => l.ocupada && !l.historico)
  const porArquivo = new Map()
  for (const l of vivas) {
    for (const a of l.arquivos) {
      porArquivo.set(a, [...(porArquivo.get(a) || []), { rota: l.rota, dono: l.dono }])
    }
  }
  const disputados = []
  for (const [arquivo, quem] of porArquivo) {
    if (quem.length > 1) disputados.push({ arquivo, quem })
  }
  disputados.sort((a, b) => b.quem.length - a.quem.length || a.arquivo.localeCompare(b.arquivo))
  return {
    disputados,
    semArquivo: vivas.filter((l) => !l.arquivos.length).map((l) => ({ rota: l.rota, dono: l.dono })),
  }
}

/**
 * O retrato inteiro de um projeto, numa leitura só.
 *
 * `null` em `quadro` quer dizer "este projeto não usa o método", que é
 * diferente de "usa e está tudo livre". A tela precisa dos dois para não
 * anunciar tranquilidade sobre um projeto que nunca foi vigiado.
 */
export function retratoRotas(raiz, { projeto = null } = {}) {
  const linhas = lerQuadro(raiz)
  if (!linhas) return { projeto, raiz, usa: false, rotas: [], tickets: [], cruzamentos: null }

  const vivas = linhas.filter((l) => !l.historico)
  const ocupadas = vivas.filter((l) => l.ocupada)
  const tickets = lerTickets(raiz)

  return {
    projeto,
    raiz,
    usa: true,
    /* Ocupadas primeiro, depois as que têm ticket pendente, depois o resto:
       a ordem responde "o que exige alguém agora" antes de "o que existe". */
    rotas: vivas.slice().sort((a, b) => (b.ocupada ? 1 : 0) - (a.ocupada ? 1 : 0)
      || (b.ticket ? 1 : 0) - (a.ticket ? 1 : 0)
      || a.rota.localeCompare(b.rota)),
    historicas: linhas.length - vivas.length,
    tickets,
    esperando: tickets.filter((t) => t.pedeResposta && !t.respondido).length,
    cruzamentos: cruzamentos(linhas),
    /* CC-376, fatia 3: a awareness viaja junto do cruzamento porque ela é uma
       propriedade DELE, não uma leitura à parte. Calcular na tela criaria uma
       segunda conta para "os dois se falaram?", e duas contas discordam. */
    awareness: awareness(cruzamentos(linhas).disputados, tickets),
    /* Quantas sessões diferentes seguram rota aqui. Uma sessão com três rotas
       não é o mesmo risco que três sessões com uma cada, e o número sozinho
       não distinguia os dois casos. */
    sessoes: [...new Set(ocupadas.map((l) => l.dono).filter(Boolean))],
  }
}
