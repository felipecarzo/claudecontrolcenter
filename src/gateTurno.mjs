/**
 * O turno do gate, de ponta a ponta: junta a conversa, o agente e o contexto.
 *
 * As três peças existem separadas de propósito e nenhuma conhece as outras:
 * `gate.mjs` guarda e calcula delta sem disparar nada, `gateAgentes.mjs`
 * dispara sem saber o que é uma conversa, e `gatePacote.mjs` monta o contexto.
 * Este arquivo é o único que sabe a ordem das coisas, e é o único que o
 * servidor precisa chamar.
 *
 * ## A regra que decide o desenho: devolver ANTES da resposta
 *
 * Resposta de agente leva minutos. Se a rota esperasse, o navegador dele
 * penduraria, e no telefone na rua isso é a tela morrendo. Então `responder()`
 * devolve assim que o processo sobe, e um acompanhamento em segundo plano vai
 * gravando os pedaços na conversa conforme chegam. A tela lê o que já está
 * gravado.
 *
 * ## O que acontece se o painel cair no meio
 *
 * O filho morre junto, porque `detached` não sai do grupo do systemd e o
 * conserto exige root. Não prometemos que a resposta continua chegando: o que
 * chegou está gravado, e `reconciliar()` fecha o turno órfão na subida dizendo
 * até onde foi. Pedir de novo é barato, porque a conversa do Claude é retomada.
 */
import {
  lerConversa, acrescentar, gravarCabecalho, deltaPara, marcarLido,
  esquecerSessao, guardarCota,
} from './gate.mjs'
import { enviar, lerTurno, vivo, agentePara } from './gateAgentes.mjs'
import { montar, gravarPacote } from './gatePacote.mjs'

/* De quanto em quanto tempo o acompanhamento olha o log.
 *
 * CC-252b: ele pediu a resposta nascendo na tela, palavra por palavra, como no
 * app do Claude. O agente já entrega os pedaços conforme escreve; quem segurava
 * era este relógio. 300ms é o intervalo em que o olho lê como texto crescendo, e
 * a leitura é de um arquivo local que o sistema mantém em memória, então o custo
 * é desprezível perto de uma resposta de minutos. */
const OLHAR_MS = 300
/* Teto de vida de um turno. Existe para um agente travado não deixar a conversa
   presa para sempre: sem isto, `estado.turnoAberto` nunca limparia e ele não
   conseguiria mais mandar mensagem naquela conversa. */
const TETO_MS = 30 * 60 * 1000

/** Os acompanhamentos em curso, para não subir dois na mesma conversa. */
const emCurso = new Map()

/**
 * O nome da conversa, tirado da primeira coisa que ele disse.
 *
 * Corta na primeira frase, e não em N caracteres cegos: cortar no meio de uma
 * palavra produz título que não se lê de relance, que é justamente o uso dele.
 * Mensagem ditada por voz vem sem pontuação nenhuma, e aí o corte por tamanho
 * é a reserva.
 */
export function tituloDe(texto) {
  const limpo = String(texto || '').trim().replace(/\s+/g, ' ')
  if (!limpo) return 'conversa'
  const frase = limpo.split(/(?<=[.!?])\s/)[0]
  const base = frase.length <= 60 ? frase : limpo.slice(0, 60).replace(/\s+\S*$/, '')
  return base.replace(/[.!?]+$/, '') || 'conversa'
}

/**
 * Manda uma mensagem dele e põe um agente para responder.
 *
 * Devolve na hora. `recusado` vem preenchido quando havia turno em voo: a
 * mensagem dele **foi gravada mesmo assim**, e entra no delta do próximo turno.
 * Perder o que ele escreveu porque o agente anterior ainda estava falando seria
 * o pior dos dois mundos.
 */
/* `binario` existe para o TESTE poder pôr um agente de mentira no lugar do
   verdadeiro, e não tem uso em produção. Ele é o que permitiu exercitar a
   devolução: os agentes de verdade recusam produzir o gatilho depois de
   ensinados, e uma régua que nunca dispara é uma régua que pode estar quebrada
   sem ninguém saber. */
export function responder(id, { texto, agente = 'claude', binario = null }) {
  const c = lerConversa(id)
  if (!c) throw new Error(`conversa ${id} não existe`)

  /* A mensagem dele entra SEMPRE, antes de qualquer decisão. */
  acrescentar(id, { tipo: 'dele', texto })

  /* CC-252b: a conversa ganha nome pela primeira mensagem dele, para ele
     reconhecer na lista sem abrir. Só na primeira: renomear a cada mensagem
     faria o nome mudar debaixo do dedo dele na lista. E título que ele mesmo
     escreveu nunca é sobrescrito. */
  if (!c.mensagens.some((m) => m.de === 'felipe') && !c.cabecalho.tituloDele) {
    gravarCabecalho(id, { titulo: tituloDe(texto) })
  }

  if (c.turnoAberto && vivo(c.cabecalho.estado?.pid)) {
    return { ok: true, guardado: true, recusado: 'um agente ainda está respondendo. Sua mensagem entra na vez dele.' }
  }

  /* CC-249: perto do teto do plano, quem responde muda, e a conversa registra
     por quê. Troca silenciosa seria o painel escolhendo por ele sem contar. */
  const escolha = agentePara(agente, c.cabecalho.cota || null)
  if (escolha.trocou) acrescentar(id, { tipo: 'sistema', texto: escolha.motivo })
  const quem = escolha.agente

  const delta = deltaPara(id, quem)
  const pacote = montar(c.cabecalho, { agente: quem })
  const turnoId = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const arqPacote = gravarPacote(pacote, turnoId)

  const t = enviar({
    agente: quem,
    texto: delta.texto,
    cwd: c.cabecalho.cwd,
    permissao: c.cabecalho.permissao || 'acceptEdits',
    sessao: c.cabecalho.sessoes?.[quem] || null,
    pacote: arqPacote,
    pacoteTexto: pacote.texto,
    binario,
  })

  if (!t.ok) {
    acrescentar(id, { tipo: 'sistema', texto: `Não consegui chamar o ${quem}: ${t.erro}` })
    return { ok: false, erro: t.erro }
  }

  acrescentar(id, {
    tipo: 'turno', turnoId: t.turnoId, agente: quem,
    modelo: t.modelo, permissao: t.permissao,
  })
  gravarCabecalho(id, {
    estado: { turnoId: t.turnoId, agente: quem, pid: t.pid, desde: Date.now(), logFile: t.logFile, erroFile: t.erroFile },
  })

  acompanhar(id, { ...t, agente: quem, ate: delta.ate, cwd: c.cabecalho.cwd, permissao: c.cabecalho.permissao, binario })
  return { ok: true, turnoId: t.turnoId, agente: quem, trocou: escolha.trocou, motivo: escolha.motivo }
}

/**
 * Olha o log de tempos em tempos e vai gravando o que chegou.
 *
 * Grava o texto INTEIRO de novo a cada olhada, em vez de só o pedaço novo, e
 * isso é de propósito: as três gramáticas entregam a resposta de jeitos
 * diferentes (uma delas fecha com o texto completo num evento só), e tentar
 * calcular o que é novo duplicaria a resposta em pelo menos um dos três. A
 * dobra em `lerConversa` usa o último `pedaco` de cada turno.
 */
function acompanhar(id, t) {
  const antigo = emCurso.get(id)
  if (antigo) clearInterval(antigo.tique)
  const comecou = Date.now()
  let ultimoGravado = ''
  let gravadoEm = 0
  let ultimasFer = 0

  const tique = setInterval(() => {
    const r = lerTurno(t.logFile, t.agente, t.erroFile)

    /* O texto vivo fica em MEMÓRIA, e a tela o lê daqui.
     *
     * Gravar em disco a cada 300ms escreveria uma cópia do texto inteiro mil
     * vezes numa resposta de cinco minutos, e o arquivo da conversa cresceria
     * sem relação com o que ela contém. O disco recebe de dois em dois segundos
     * e no fim do turno, que é o suficiente para nada se perder num travamento;
     * a tela vê o texto crescendo no ritmo do olho. */
    const vivoAgora = emCurso.get(id)
    if (vivoAgora) {
      vivoAgora.texto = r.texto || ''
      vivoAgora.ferramentas = r.ferramentas
    }

    if (r.texto && r.texto !== ultimoGravado && Date.now() - gravadoEm > 2000) {
      acrescentar(id, { tipo: 'pedaco', turnoId: t.turnoId, texto: r.texto, substitui: true })
      ultimoGravado = r.texto
      gravadoEm = Date.now()
    }
    for (let i = ultimasFer; i < r.ferramentas.length; i++) {
      acrescentar(id, { tipo: 'ferramenta', turnoId: t.turnoId, nome: r.ferramentas[i].nome, alvo: r.ferramentas[i].alvo })
    }
    ultimasFer = r.ferramentas.length

    if (r.cota) guardarCota(id, r.cota)

    const estourou = Date.now() - comecou > TETO_MS
    const acabou = r.terminou || !vivo(t.pid) || estourou
    if (!acabou) return

    clearInterval(tique)
    emCurso.delete(id)

    /* O texto final vai para o disco antes do `fim`, senão o último trecho
       ficaria só na memória e sumiria com o processo. */
    if (r.texto && r.texto !== ultimoGravado) {
      acrescentar(id, { tipo: 'pedaco', turnoId: t.turnoId, texto: r.texto, substitui: true })
    }

    /* A sessão do Claude sumiu: o marcador passa a mentir, e o conserto é
       zerar e recomeçar dizendo isso na tela. Reinício calado é como o dado
       parece sumir. */
    if (r.sessaoPerdida) esquecerSessao(id, t.agente)

    const estado = estourou ? 'interrompido' : (r.estado || (r.terminou ? 'pronto' : 'interrompido'))
    acrescentar(id, {
      tipo: 'fim', turnoId: t.turnoId, estado,
      custo: r.custo, segundos: r.segundos,
      erro: estourou ? `passou de ${Math.round(TETO_MS / 60000)} minutos e eu parei de esperar` : r.erro,
    })

    if (estado === 'pronto') {
      const cab = lerConversa(id)?.cabecalho
      if (r.sessao && cab) gravarCabecalho(id, { sessoes: { ...(cab.sessoes || {}), [t.agente]: r.sessao } })
      /* Só marca quem leu de verdade: turno que falhou não leu nada, e marcar
         ali faria o agente perder para sempre o que nunca chegou a ver. */
      marcarLido(id, t.agente, t.ate)
    }
    gravarCabecalho(id, { estado: null })

    if (estado === 'pronto' && !t.jaVoltou) devolverParaCorrigir(id, t, r.texto)
  }, OLHAR_MS)

  emCurso.set(id, { tique, turnoId: t.turnoId, agente: t.agente, texto: '', ferramentas: [] })
}

/**
 * A conversa com o que está sendo escrito NESTE instante mesclado por cima.
 *
 * O que já foi gravado vem do disco; o trecho vivo do turno em voo vem da
 * memória. Sem isto, a resposta apareceria em saltos de dois em dois segundos,
 * que é o ritmo da gravação, e não no ritmo em que o agente escreve.
 */
export function conversaAoVivo(id) {
  const c = lerConversa(id)
  if (!c) return null
  const v = emCurso.get(id)
  if (!v) return c
  const m = c.mensagens.find((x) => x.turnoId === v.turnoId)
  if (m) {
    if (v.texto && v.texto.length > (m.texto || '').length) m.texto = v.texto
    if (v.ferramentas?.length > (m.ferramentas || []).length) m.ferramentas = v.ferramentas
  }
  return c
}

/* ============ CC-263: a trava mora no PAINEL, não no agente ============
 *
 * As 43 travas deste projeto seguram o Claude Code e mais nada. Está medido que
 * opencode e agy **não têm equivalente ao gancho de fim de turno**: dá para
 * alimentar na abertura, não dá para recusar na entrega.
 *
 * O que destrava: no Coderoom o painel é dono do turno, e a resposta passa por
 * ele antes de virar mensagem na tela. Então a recusa pode ficar aqui. Resposta
 * que quebra uma regra volta para o agente com o motivo, que é a mesma mecânica
 * de laço que os ganchos usam com o Claude Code, só que do lado de fora.
 *
 * Vale para qualquer agente que venha depois, sem depender de o programa dele
 * suportar gancho nenhum.
 *
 * ## Só o que dá para MEDIR entra aqui
 *
 * "Trouxe prova?" e "respeitou a forma que ele pediu?" são julgamento, e uma
 * trava que chuta isso devolveria resposta boa sem motivo, gastando o turno
 * dele. Essas continuam ensinadas no pacote, não cobradas aqui. O travessão é
 * medível, é a regra que ele mais cobra, e é a que ele reconhece na hora.
 *
 * ## Uma volta só, sempre
 *
 * Duas voltas seriam laço: o agente que não consegue obedecer na segunda não
 * vai conseguir na terceira, e cada volta é token dele. Depois da primeira, a
 * resposta entra como veio e o painel escreve na conversa o que aconteceu, em
 * vez de esconder.
 */
const TRACO = /[—–]/g

export function conferir(texto) {
  const t = String(texto || '')
  const tracos = (t.match(TRACO) || []).length
  if (!tracos) return null
  return {
    regra: 'travessao',
    quantos: tracos,
    recado: `A sua resposta tem ${tracos} travessão(ões). A regra número 1 dele é não usar traço longo em texto nenhum, e ele reconhece na hora. Reescreva usando duas frases com ponto, vírgula, ou dois pontos. O hífen comum continua valendo em palavra composta.`,
  }
}

/**
 * Devolve a resposta ao agente pedindo que ele reescreva, e registra na
 * conversa que devolveu.
 *
 * `jaVoltou` no turno novo é o que fecha o laço: a segunda resposta entra como
 * vier.
 */
function devolverParaCorrigir(id, t, texto) {
  const falta = conferir(texto)
  if (!falta) return

  acrescentar(id, {
    tipo: 'sistema',
    texto: `Devolvi esta resposta ao ${t.agente}: ela tinha ${falta.quantos} travessão(ões), e essa é a regra que você mais cobra. Pedi para reescrever.`,
  })

  const c = lerConversa(id)
  const novo = enviar({
    agente: t.agente,
    texto: falta.recado,
    cwd: t.cwd || c?.cabecalho?.cwd,
    permissao: t.permissao || c?.cabecalho?.permissao || 'acceptEdits',
    sessao: c?.cabecalho?.sessoes?.[t.agente] || null,
    binario: t.binario || null,
  })
  if (!novo.ok) {
    acrescentar(id, { tipo: 'sistema', texto: `Não consegui devolver para o ${t.agente}: ${novo.erro}` })
    return
  }
  acrescentar(id, { tipo: 'turno', turnoId: novo.turnoId, agente: t.agente, modelo: t.modelo, permissao: t.permissao })
  gravarCabecalho(id, { estado: { turnoId: novo.turnoId, agente: t.agente, pid: novo.pid, desde: Date.now() } })
  acompanhar(id, { ...novo, agente: t.agente, ate: t.ate, cwd: t.cwd, permissao: t.permissao, binario: t.binario, jaVoltou: true })
}

/** Parar é decisão dele, e não efeito colateral de trocar de agente. */
export function parar(id) {
  const c = lerConversa(id)
  const pid = c?.cabecalho?.estado?.pid
  if (!pid) return { ok: false, erro: 'nenhum agente respondendo agora' }
  try { process.kill(pid, 'SIGTERM') } catch { /* já morreu */ }
  acrescentar(id, { tipo: 'sistema', texto: 'Você parou esta resposta. O que já tinha chegado continua acima.' })
  return { ok: true }
}
