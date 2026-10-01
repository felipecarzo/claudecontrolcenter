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
  esquecerSessao, guardarCota, lerCabecalho,
} from './gate.mjs'
import * as resumoAgy from './resumoAgy.mjs'
import { fotografar, mexeuEmTela, enderecoDe } from './gateFotos.mjs'
import { execFileSync } from 'node:child_process'
import { enviar, lerTurno, vivo, agentePara, servidorOpencodeVivo, garantirServidorOpencode } from './gateAgentes.mjs'
import { montar, gravarPacote } from './gatePacote.mjs'
import { ler as lerFramework } from './frameworkDisco.mjs'
import { modoDe } from './framework.mjs'
import { DIR_PERMISSOES } from './decisao.mjs'
import { revisorDe } from './config.mjs'
import { readUso } from './uso.mjs'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * CC-723: tira da tela a pergunta e a permissão em aberto desta conversa.
 * Parar ou apagar a conversa mata o agente e a ferramenta junto, sem chance de
 * ela limpar o que gravou; e resposta que terminou não tem pedido vivo. Medido
 * em 30/09: sem isto, a pergunta ficava pendurada numa conversa já apagada.
 */
export function limparPedidos(id, { manterPastas = false } = {}) {
  const dir = DIR_PERMISSOES()
  let nomes = []
  try { nomes = fs.readdirSync(dir).filter((n) => /^[0-9a-f-]+\.json$/.test(n)) } catch { return 0 }
  let n = 0
  for (const nome of nomes) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, nome), 'utf8'))
      if (p?.coderoom === id && !(manterPastas && p.tipo === 'pasta')) { fs.unlinkSync(path.join(dir, nome)); n++ }
    } catch { /* sendo gravado agora */ }
  }
  return n
}

/**
 * CC-739: o opencode quis mexer fora do projeto e recusou sozinho. O pedido
 * fica no painel ("liberar nesta conversa e repetir?") até ele responder: não
 * há processo esperando, é o painel que libera e reenvia (ver `liberarPasta`).
 */
export function pedirPasta(id, padroes) {
  const dir = DIR_PERMISSOES()
  const agora = Date.now()
  const pid = crypto.randomUUID().slice(0, 13)
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, pid + '.json'), JSON.stringify({
      id: pid, tipo: 'pasta', coderoom: id, sessao: 'gate:' + id, padroes,
      ferramenta: 'pasta fora do projeto',
      descricao: 'O opencode quis mexer fora da pasta do projeto e foi recusado. Liberar nesta conversa e repetir?',
      comando: padroes.join(', '), em: agora, ate: agora + 24 * 3600 * 1000,
    }))
    return pid
  } catch { return null }
}

/** Resposta ao pedido de pasta: libera na conversa e reenvia, ou só registra o não. */
export function liberarPasta(pedidoId, sim) {
  const arq = path.join(DIR_PERMISSOES(), pedidoId + '.json')
  let p = null
  try { p = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch { return { ok: false, erro: 'esse pedido não existe mais' } }
  if (p?.tipo !== 'pasta') return null
  try { fs.unlinkSync(arq) } catch { /* já saiu */ }
  const id = p.coderoom
  const cab = lerCabecalho(id)
  if (!cab) return { ok: false, erro: 'a conversa não existe mais' }
  if (!sim) {
    acrescentar(id, { tipo: 'sistema', texto: `Você não liberou ${p.padroes.join(', ')}. O opencode continua sem acesso fora do projeto.` })
    return { ok: true }
  }
  gravarCabecalho(id, { opencodePastas: [...new Set([...(cab.opencodePastas || []), ...p.padroes])] })
  return responder(id, { texto: `Liberei o acesso a ${p.padroes.join(', ')} nesta conversa. Tente de novo o que você ia fazer.`, agente: 'opencode' })
}

/* ============ CC-727: o nome curto da conversa, escrito pelo agy ============
 *
 * Pedido dele: entender em Sessões qual conversa do Coderoom está mexendo. O
 * título era a primeira mensagem cortada ("Use a ferramenta perguntar para me
 * perguntar qual fruta eu"). Depois da primeira resposta, o agy (grátis, na
 * mesma fila dos resumos do painel) escreve 3 a 6 palavras. Nome dado por ele
 * (`tituloDele`) nunca é trocado. */
const esperandoNome = new Set()
export function limparNome(texto) {
  const t = String(texto || '').split('\n').map((l) => l.trim()).find(Boolean) || ''
  const n = t.replace(/^(nome|titulo|título)\s*:\s*/i, '').replace(/[*"'`“”]/g, '').replace(/[—–]/g, ' ').replace(/[.!?:;]+$/, '').replace(/\s+/g, ' ').trim()
  return n.length >= 3 && n.length <= 60 ? n : null
}
function nomearSozinho(id) {
  /* CC-731: teste nunca chama o agy de verdade. Medido por baa1393b em 30/09:
     o test-gate-memoria disparava o agy 3 vezes por rodada, gastando cota e
     virando pedido de permissão de rede na sessão que rodava o teste. */
  if (process.env.CC_SEM_AGY) return
  const c = lerConversa(id)
  const cab = c?.cabecalho
  if (!cab || cab.tituloDele || cab.tituloAuto || esperandoNome.has(id)) return
  const dele = c.mensagens.find((m) => m.de === 'felipe')
  const resp = c.mensagens.find((m) => m.de !== 'felipe' && m.de !== 'sistema' && m.estado === 'pronto')
  if (!dele || !resp) return
  const k = 'titulo:gate:' + id
  resumoAgy.pedirTexto({ k, prompt: 'Dê um nome curto para esta conversa, de 3 a 6 palavras, em português do Brasil, que diga o assunto. '
    + 'Sem aspas, sem travessão, sem ponto final. Responda só o nome. Não use ferramentas.\n\n'
    + 'PRIMEIRA MENSAGEM DELE:\n' + String(dele.texto || '').slice(0, 1500) + '\n\nRESPOSTA DO AGENTE:\n' + String(resp.texto || '').slice(0, 1500) })
  esperandoNome.add(id)
  let voltas = 0
  const tique = setInterval(() => {
    const r = resumoAgy.obterTexto(k)
    const nome = r?.texto ? limparNome(r.texto) : null
    if (nome || !r || ++voltas > 60) {
      clearInterval(tique); esperandoNome.delete(id)
      const agora = lerCabecalho(id)
      if (nome && agora && !agora.tituloDele) gravarCabecalho(id, { titulo: nome, tituloAuto: true })
    }
  }, 5000)
  tique.unref?.()
}

/* ============ CC-747: o resumo da resposta longa ============
 * Pedido dele: "criar resumos do que o agente falou e poder colapsar a
 * mensagem maior". Resposta acima do teto ganha até 3 frases do agy (grátis,
 * na mesma fila dos outros resumos); a tela mostra o resumo e recolhe o resto. */
export const RESUMO_A_PARTIR = 600
function resumirSozinho(id, turnoId, texto) {
  if (process.env.CC_SEM_AGY || String(texto || '').length < RESUMO_A_PARTIR) return
  const k = `resumo:gate:${id}:${turnoId}`
  resumoAgy.pedirTexto({ k, prompt: 'Resuma a resposta abaixo, de um agente de programação para o Felipe, em no máximo 3 frases curtas em português do Brasil: '
    + 'o que foi feito, o que mudou para ele e o que falta ou o que ele precisa decidir. Sem travessão, sem markdown, sem nome de arquivo. Não use ferramentas.\n\n'
    + 'RESPOSTA:\n' + String(texto).slice(0, 6000) })
  let voltas = 0
  const tique = setInterval(() => {
    const r = resumoAgy.obterTexto(k)
    if (r?.texto || !r || ++voltas > 60) {
      clearInterval(tique)
      const limpo = String(r?.texto || '').replace(/[—–]/g, ',').trim()
      if (limpo) acrescentar(id, { tipo: 'resumo', turnoId, texto: limpo.slice(0, 600) })
    }
  }, 5000)
  tique.unref?.()
}

/** O modo do framework do projeto, ou null quando ele não usa framework. */
export function modoDoProjeto(cwd) {
  if (!cwd) return null
  try {
    const est = lerFramework(cwd, { sessao: null })
    return est ? modoDe(est).id : null
  } catch { return null }
}

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

/* ============ CC-280: o que o agente mexeu, linha por linha ============
 *
 * A conversa mostrava só o NOME do arquivo editado. Ele pediu para ver o que
 * mudou de verdade, sem sair da conversa.
 *
 * **Como se sabe o que o turno mudou, e por que não basta olhar no fim.** Um
 * `git diff` no fim mostra tudo o que está diferente do último commit, e não só
 * o que aquele agente fez: o trabalho de antes apareceria como se fosse dele.
 * Por isso se tira um retrato ANTES do turno e a diferença sai da comparação.
 *
 * Projeto que não é repositório fica de fora, e isso se diz em voz alta em vez
 * de mostrar um bloco vazio.
 */
const GIT_TETO = 400 * 1024

/**
 * Roda um comando do git e devolve a saída, ou `null` quando falha.
 *
 * `umSignificaAchou` existe porque **o código de saída 1 quer dizer coisas
 * opostas em dois comandos do git**, e confundir os dois derrubou este recurso
 * duas vezes seguidas:
 *
 * - em `diff --no-index`, o 1 quer dizer "ACHEI diferença", que é o sucesso;
 * - em `ls-files --error-unmatch`, o 1 quer dizer "NÃO achei o arquivo".
 *
 * Tratar o 1 como sucesso em tudo fez todo arquivo parecer rastreado, e o diff
 * saiu vazio. Tratar como falha em tudo fez o arquivo novo não aparecer. Por
 * isso quem chama diz qual dos dois espera.
 */
function gitDo(cwd, args, { umSignificaAchou = false } = {}) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8', maxBuffer: GIT_TETO * 4, timeout: 15000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (e) {
    if (umSignificaAchou && e?.status === 1 && typeof e.stdout === 'string') return e.stdout
    return null
  }
}

/** O retrato de antes: o que já estava mexido quando o turno começou. */
function retratoAntes(cwd) {
  if (!cwd || !gitDo(cwd, ['rev-parse', '--is-inside-work-tree'])) return null
  return {
    /* O commit em que a árvore estava quando o turno começou.
     *
     * É contra ELE que o diff é tirado, e não contra `HEAD`: **o agente pode
     * commitar**, e aí `git diff HEAD` sai vazio logo depois de ele reescrever
     * meio projeto. Foi exatamente o que aconteceu na primeira tentativa: a
     * conversa dizia "nenhuma mudança" com o arquivo criado e commitado. */
    head: (gitDo(cwd, ['rev-parse', 'HEAD']) || '').trim() || null,
    naoVersionados: new Set((gitDo(cwd, ['ls-files', '--others', '--exclude-standard']) || '').split('\n').filter(Boolean)),
  }
}

/**
 * O que mudou entre o retrato e agora, restrito aos arquivos que o agente
 * declarou ter tocado.
 *
 * Restringir aos tocados é o que separa o trabalho DELE do que já estava
 * mexido: sem isso, uma edição minha de meia hora atrás entraria no diff do
 * turno dele.
 */
function mudancasDoTurno(cwd, antes, ferramentas) {
  if (!cwd || !antes) return null
  /* O caminho INTEIRO, nunca o alvo curto da tela: o curto é cortado nas duas
     últimas partes para caber no cartão, e o git nunca acharia o arquivo. */
  const tocados = [...new Set(
    (ferramentas || [])
      .map((f) => f.caminho)
      .filter(Boolean)
      .map((a) => (a.startsWith(cwd) ? a.slice(cwd.length).replace(/^\//, '') : a))
      .filter((a) => a && !a.startsWith('/') && !/\s/.test(a)),
  )]
  if (!tocados.length) return null

  const partes = []
  let cortou = false
  for (const alvo of tocados) {
    /* Arquivo que o git ainda NÃO rastreia não aparece em `git diff`, e dizer
       "nada mudou" num arquivo que o agente acabou de criar seria mentir. Para
       esses, o diff é contra o vazio.
       A decisão sai do estado ATUAL do git, e não da lista do retrato: o
       arquivo recém-criado não estava em lista nenhuma antes do turno, que é
       justamente o caso a cobrir. */
    const rastreado = gitDo(cwd, ['ls-files', '--error-unmatch', alvo]) !== null
    const d = rastreado
      ? gitDo(cwd, ['diff', antes.head || 'HEAD', '--', alvo], { umSignificaAchou: true })
      : gitDo(cwd, ['diff', '--no-index', '--', '/dev/null', alvo], { umSignificaAchou: true })
    if (!d || !d.trim()) continue
    if (partes.join('').length + d.length > GIT_TETO) { cortou = true; break }
    partes.push(d)
  }
  if (!partes.length) return null
  return { diff: partes.join('\n'), arquivos: tocados.length, cortou }
}

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
export function responder(id, { texto, agente = 'agy', modelo = null, esforco = null, anexos = [], binario = null, revisar = false }) {
  const c = lerConversa(id)
  if (!c) throw new Error(`conversa ${id} não existe`)

  /* A mensagem dele entra SEMPRE, antes de qualquer decisão. */
  acrescentar(id, { tipo: 'dele', texto, ...(anexos.length ? { anexos } : {}) })

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

  /* CC-716: o modo Flash do opencode é por conversa. Sem memória: recebe a
     conversa inteira e não toca na sessão nem no marcador do modo Normal,
     para a troca de volta não herdar um marcador de mensagens que a sessão
     nunca viu. O servidor sobe em segundo plano se não estiver de pé. */
  const flash = quem === 'opencode' && ['flash', 'avulso'].includes(c.cabecalho.opencodeModo)
  if (flash && !servidorOpencodeVivo()) garantirServidorOpencode().catch(() => {})
  const avulso = flash && c.cabecalho.opencodeModo === 'avulso'
  /* CC-813, medido na simulação 3 (jogo): com 77 a 138 mil tokens de sessão o
     opencode grátis travava, parava no meio e respondia vazio; a mesma tarefa
     numa sessão limpa (26 a 59 mil) saiu inteira. Passou do limite, a próxima
     mensagem abre sessão NOVA e leva a conversa em transcrição. Feito aqui, e
     não no fim da resposta, para as voltas automáticas do painel (retomar,
     resumir, consertar o endereço) seguirem na sessão em curso. */
  let sessaoZerada = false
  if (quem === 'opencode' && !flash && c.cabecalho.sessoes?.opencode && (c.cabecalho.contextoOpencode || 0) > LIMITE_CONTEXTO) {
    esquecerSessao(id, 'opencode', `a sessão dele chegou a ${Math.round(c.cabecalho.contextoOpencode / 1000)} mil tokens de contexto, e acima de uns ${Math.round(LIMITE_CONTEXTO / 1000)} mil o modelo grátis trava, para no meio e responde vazio`)
    gravarCabecalho(id, { contextoOpencode: 0 })
    sessaoZerada = true
  }
  const delta = deltaPara(id, quem, { semMemoria: flash, soUltima: avulso })
  const pacote = montar(c.cabecalho, { agente: quem })
  const turnoId = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const arqPacote = gravarPacote(pacote, turnoId)

  /* CC-714: projeto no modo Planejamento sobe o agente no modo de plano dele.
     Lido com `sessao: null`: é a escolha do PROJETO, a mesma que a tela mostra. */
  const planejar = modoDoProjeto(c.cabecalho.cwd) === 'planejamento'

  const t = enviar({
    agente: quem,
    texto: delta.texto,
    cwd: c.cabecalho.cwd,
    permissao: c.cabecalho.permissao || 'acceptEdits',
    somenteLer: planejar,
    flash,
    pastas: c.cabecalho.opencodePastas || [],
    conversa: id,
    sessao: flash || sessaoZerada ? null : c.cabecalho.sessoes?.[quem] || null,
    /* CC-718: avulso vai sem o estado do projeto. Medido em 30/09: a lista de
       agentes do pacote traz a PRÓPRIA conversa, com a primeira mensagem dele
       como título, e a pergunta "qual palavra eu pedi" foi respondida por ali. */
    pacote: avulso ? null : arqPacote,
    pacoteTexto: avulso ? null : pacote.texto,
    /* O modelo da vez vence o guardado na conversa, e o guardado vence o padrão
       do agente. Guardar por conversa é o que faz a escolha dele sobreviver ao
       fechar a tela, em vez de voltar ao padrão a cada mensagem. */
    modelo: modelo || c.cabecalho.modelos?.[quem] || null,
    esforco: esforco || c.cabecalho.esforcos?.[quem] || null,
    /* Os anexos das mensagens que este agente ainda não viu.
     *
     * Vão pelo caminho NATIVO de cada um (`--file` no opencode, `--add-dir` no
     * agy), e não só citados no texto: o opencode recusa ler fora da pasta de
     * trabalho e devolve `auto-rejecting`, e os anexos moram junto da conversa
     * de propósito. Foi ele quem achou, mandando um print. */
    anexos: [...new Set((delta.anexos || []).map((a) => a.caminho).filter(Boolean))],
    binario,
  })

  if (!t.ok) {
    acrescentar(id, { tipo: 'sistema', texto: `Não consegui chamar o ${quem}: ${t.erro}` })
    return { ok: false, erro: t.erro }
  }

  acrescentar(id, {
    tipo: 'turno', turnoId: t.turnoId, agente: quem,
    modelo: t.modelo, permissao: planejar ? 'planejamento' : t.permissao,
  })
  gravarCabecalho(id, {
    /* CC-728: o último agente usado vira o da conversa, e é ele que responde
       quando ele escreve pelo cartão em Sessões. */
    agentePadrao: quem,
    /* `revisar` e `semMemoria` vão gravados para a retomada depois de um
       reinício (CC-700) não perdê-los. Medido em 30/09 na simulação: o painel
       religou no meio do pedido com revisão, a resposta terminou e a revisão
       nunca foi pedida. */
    estado: { turnoId: t.turnoId, agente: quem, pid: t.pid, desde: Date.now(), logFile: t.logFile, erroFile: t.erroFile, ate: delta.ate, revisar, semMemoria: flash },
    ...(modelo ? { modelos: { ...(c.cabecalho.modelos || {}), [quem]: modelo } } : {}),
    ...(esforco ? { esforcos: { ...(c.cabecalho.esforcos || {}), [quem]: esforco } } : {}),
  })

  acompanhar(id, {
    ...t, agente: quem, ate: delta.ate,
    cwd: c.cabecalho.cwd, permissao: c.cabecalho.permissao, binario, revisar, semMemoria: flash,
    /* O retrato tirado ANTES do turno. É ele que separa o que este agente fez
       do que já estava mexido na árvore. */
    antes: retratoAntes(c.cabecalho.cwd),
  })
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
  /* Retomado depois de um reinício, o teto conta do começo de verdade. */
  const comecou = t.desde || Date.now()
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
    /* CC-803: o vigia de silêncio. O agente calado há tempo demais (sem
       ferramenta nova, sem texto, sem filho trabalhando, sem esperar resposta
       dele) é parado, e a saída dele cai na retomada de baixo, que pede para ele
       agir. Medido em 30/09: um bloco grande de código deixa o registro parado
       por ~140 s, então o limite é MAIOR que isso. */
    if (!t.silencio && !r.terminou && t.agente === 'opencode' && vivo(t.pid) && silencioDoTurno(t, id) > SILENCIO_MS) {
      t.silencio = true
      try { process.kill(t.pid, 'SIGTERM') } catch { /* já saiu */ }
    }
    const acabou = r.terminou || !vivo(t.pid) || estourou
    if (!acabou) return

    clearInterval(tique)
    limparPedidos(id, { manterPastas: true })
    if (t.agente === 'opencode' && r.pastasRecusadas?.length) pedirPasta(id, r.pastasRecusadas)
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

    /* CC-280: o que ele mexeu. Só quando houve ferramenta com alvo: turno de
       conversa pura não tem o que mostrar, e um bloco vazio ali diria que ele
       mexeu em algo e não mostrou. */
    let mudou = null
    try { mudou = mudancasDoTurno(t.cwd, t.antes, r.ferramentas) } catch { mudou = null }
    if (mudou) acrescentar(id, { tipo: 'mudancas', turnoId: t.turnoId, ...mudou })

    acrescentar(id, {
      tipo: 'fim', turnoId: t.turnoId, estado,
      custo: r.custo, segundos: r.segundos,
      erro: estourou ? `passou de ${Math.round(TETO_MS / 60000)} minutos e eu parei de esperar` : r.erro,
    })

    /* CC-803: o que o prumo barrou nesta resposta, contado na conversa. É como
       ele fica sabendo que o agente tentou sair do projeto ou rodear. */
    try {
      const arqPrumo = t.logFile && String(t.logFile).replace(/\.jsonl$/, '.prumo')
      if (arqPrumo && fs.existsSync(arqPrumo)) {
        const barras = fs.readFileSync(arqPrumo, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
        const nome = { rodeio: 'lendo demais sem escrever', repeticao: 'repetindo o mesmo comando', fora: 'mexendo fora do projeto' }
        const conta = {}; for (const b of barras) conta[b.regra] = (conta[b.regra] || 0) + 1
        if (barras.length) acrescentar(id, { tipo: 'sistema', texto: `O prumo segurou o ${t.agente} ${barras.length === 1 ? 'uma vez' : barras.length + ' vezes'}: ${Object.entries(conta).map(([r, n]) => `${nome[r] || r} (${n})`).join(', ')}.` })
      }
    } catch { /* o aviso é conforto: sem ele a resposta segue igual */ }

    /* O turno do REVISOR não mexe na memória dele: a sessão dele só viu o
       pedido de revisão, e marcar a conversa como lida faria ele, mais tarde
       como autor, receber só o fim da conversa achando que sabe o começo. */
    if (estado === 'pronto' && !t.revisao && !t.semMemoria) {
      const cab = lerConversa(id)?.cabecalho
      if (r.sessao && cab) gravarCabecalho(id, { sessoes: { ...(cab.sessoes || {}), [t.agente]: r.sessao } })
      /* Só marca quem leu de verdade: turno que falhou não leu nada, e marcar
         ali faria o agente perder para sempre o que nunca chegou a ver. */
      marcarLido(id, t.agente, t.ate)
    }
    // CC-813: o tamanho da sessão do opencode, para a próxima mensagem decidir se troca
    gravarCabecalho(id, { estado: null, ...(t.agente === 'opencode' && !t.revisao && !t.semMemoria && r.contexto ? { contextoOpencode: r.contexto } : {}) })

    /* CC-796: medido em 30/09, o opencode sai no meio sem erro nenhum (registro
       parado logo depois de um comando, processo morto, ninguém mandou parar).
       Duas vezes no mesmo dia. Queda que não foi ordem dele é retomada UMA vez. */
    const parouPelaMao = PARADOS.delete(id)
    /* CC-805, achado na simulação 3: o opencode PARA sozinho quando a pasta é
       recusada (e o painel já pergunta a ele), e isso não é queda. A retomada
       disparava também aí, e mandava um "continue" em cima do pedido de pasta. */
    if (estado === 'interrompido' && !estourou && !parouPelaMao && !t.revisao && !t.retomado && !r.pastasRecusadas?.length) {
      if (t.silencio) {
        return devolver(id, t, `Você ficou ${rotuloTempo(SILENCIO_MS)} sem agir: nem ferramenta, nem resposta. Retome do passo em que estava e faça a próxima ação concreta agora: escreva o código ou rode o comando. Não volte a pesquisar o que já viu.`,
          `O ${t.agente} ficou ${rotuloTempo(SILENCIO_MS)} sem sinal. O prumo parou a resposta e pediu que retome, uma vez.`, { retomado: true })
      }
      return devolver(id, t, 'Sua última resposta caiu no meio (o processo saiu sem erro). Continue exatamente de onde parou, no passo em que estava, sem recomeçar.',
        `O ${t.agente} caiu no meio sem erro. Pedi que continue de onde parou, uma vez.`, { retomado: true })
    }

    /* CC-755: revisão que falhou (sem crédito, cota, erro) tenta a reserva. */
    if (t.revisao && estado !== 'pronto' && t.reservaRevisao) {
      const rr = t.reservaRevisao
      acrescentar(id, { tipo: 'sistema', texto: `O ${t.agente} não conseguiu revisar${r.erro ? ' (' + String(r.erro).slice(0, 120) + ')' : ''}. A revisão foi para a reserva.` })
      return despacharRevisao(id, t, rr, rr.fila)
    }
    if (estado !== 'pronto') return
    nomearSozinho(id)
    resumirSozinho(id, t.turnoId, r.texto)
    if (t.revisao) return voltarDaRevisao(id, t, r.texto)
    cobrarConferencia(id, r)
    if (!t.jaVoltou && devolverParaCorrigir(id, t, r.texto)) return
    /* CC-743/744: resposta que mexeu em tela ganha build, fotos e o revisor
       visual; a revisão de texto do agy fica para o que não é tela. */
    /* CC-803, medido na simulação 3: três vezes no mesmo dia o opencode trabalhou
       (ferramentas rodaram) e terminou SEM escrever nada, e o Felipe ficou sem
       saber o que foi feito nem onde ver. Quem lê o painel não lê código. */
    const semResposta = estado === 'pronto' && !t.resumoPedido && t.agente === 'opencode' && !String(r.texto || '').trim() && (r.ferramentas || []).length > 0
    if (mexeuEmTela(r.ferramentas) && !process.env.CC_SEM_FOTOS) return conferirTela(id, t, r.texto, { revisar: t.revisar || revisorDe().visualAuto, semResposta })
    if (semResposta) return pedirResumo(id, t)
    if (t.revisar) pedirRevisao(id, t, r.texto, mudou)
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
/**
 * CC-700: volta a acompanhar um turno cujo agente sobreviveu ao reinício.
 *
 * Hoje o agente morre junto com o painel, e isto não roda. Com
 * `KillMode=process` no serviço (exige root), ele sobrevive, e sem esta função
 * ninguém voltaria a ler o log: a resposta ficaria "em andamento" para sempre,
 * que é pior que o corte de hoje, porque o corte ao menos diz que parou. Não
 * devolve para corrigir travessão (`jaVoltou`): o retrato de antes do turno se
 * perdeu com a memória do painel, e a devolução é um extra, não o essencial.
 */
export function retomar(id) {
  const c = lerConversa(id)
  const e = c?.cabecalho?.estado
  if (!e?.turnoId || !e.logFile || emCurso.has(id)) return false
  acompanhar(id, { ...e, cwd: c.cabecalho.cwd, permissao: c.cabecalho.permissao, antes: null, jaVoltou: true })
  return true
}

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
  if (!falta) return false

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
    conversa: id,
    sessao: c?.cabecalho?.sessoes?.[t.agente] || null,
    binario: t.binario || null,
  })
  if (!novo.ok) {
    acrescentar(id, { tipo: 'sistema', texto: `Não consegui devolver para o ${t.agente}: ${novo.erro}` })
    return false
  }
  acrescentar(id, { tipo: 'turno', turnoId: novo.turnoId, agente: t.agente, modelo: t.modelo, permissao: t.permissao })
  gravarCabecalho(id, { estado: { turnoId: novo.turnoId, agente: t.agente, pid: novo.pid, desde: Date.now(), logFile: novo.logFile, erroFile: novo.erroFile, ate: t.ate } })
  /* `revisar` viaja junto: a revisão pedida vale para a resposta corrigida. */
  acompanhar(id, { ...novo, agente: t.agente, ate: t.ate, cwd: t.cwd, permissao: t.permissao, binario: t.binario, jaVoltou: true, revisar: t.revisar })
  return true
}

/* ================= CC-701: a revisão em dupla, quando ele pede ================
 *
 * Decisão dele em 29/09: só quando ele pedir, mensagem a mensagem. Um segundo
 * agente lê a resposta e o que mudou nos arquivos, em modo de leitura (medido:
 * `--mode plan` no agy, `--agent plan` no opencode), e diz se está certo. Se
 * apontar problema, o autor recebe a revisão UMA vez para corrigir. Uma volta
 * só pelo mesmo motivo da trava do travessão: o autor que não conserta na
 * segunda não conserta na terceira, e cada volta é token dele.
 *
 * O revisor é o agy, que é gratuito; se o autor for o agy, revisa o opencode. */
/* O veredito vale em qualquer linha, não só na primeira: o revisor costuma
   abrir com "Vou ler as fotos..." e só depois escrever. Medido em 30/09: um
   REVISÃO OK na segunda linha virou "apontou problemas" e mandou corrigir o
   que estava certo. Problema é só quando ele ESCREVE que há problema. */
export const REVISAO_OK = /(^|\n)\s*\**\s*REVIS[ÃA]O OK/i
export const REVISAO_PROBLEMAS = /REVIS[ÃA]O:\s*PROBLEMAS/i
export const revisaoAprovou = (texto) => !REVISAO_PROBLEMAS.test(texto || '') && REVISAO_OK.test(texto || '')

export function pedidoDeRevisao(autor, texto, mudou) {
  const diff = mudou?.diff ? String(mudou.diff).slice(0, 20000) : ''
  return [
    `O Felipe pediu REVISÃO da resposta abaixo, escrita pelo ${autor} para o último pedido dele.`,
    'Leia com olhar crítico: ela atende o que ele pediu? Há erro, afirmação sem prova, ou mudança de código com defeito?',
    'Você está em modo de leitura. Não edite nenhum arquivo.',
    'Se estiver tudo certo, comece a resposta com "REVISÃO OK" e diga em uma linha por quê.',
    'Se houver problema, comece com "REVISÃO: PROBLEMAS" e liste cada um numa linha, com o arquivo quando houver.',
    '',
    `--- resposta do ${autor} ---`,
    String(texto || '').slice(0, 20000),
    ...(diff ? ['', '--- o que mudou nos arquivos ---', diff, ...(mudou.cortou || String(mudou.diff).length > 20000 ? ['[diferença cortada por tamanho]'] : [])] : []),
  ].join('\n')
}

/* ============ CC-755: quem revisa, escolhido por ele, com reserva ============
 * Pedido dele: "definir qual é o modelo padrão e qual o secundário, tipo uma
 * fila, não tendo crédito num vai pro outro". O padrão e a reserva moram na
 * configuração do painel. O Claude perto do teto do plano pula direto para a
 * reserva (a mesma conta do CC-249); e revisão que FALHA tenta a reserva uma vez. */
/* Quem enxerga imagem, medido em 30/09 pedindo a cor de fundo e a primeira
   palavra de uma foto do clone: Claude sim, agy sim, opencode (big-pickle)
   respondeu "NAO VEJO IMAGEM". */
export const VE_IMAGEM = { claude: true, agy: true, opencode: false }

/** Quanto da janela de 5 horas do Claude já foi usado (0 a 1), o maior entre o
 *  registro do painel (statusLine, se tiver menos de 3 h) e o que veio na
 *  última resposta do Claude nesta conversa. */
export function usoDaJanela(cota, uso = (() => { try { return readUso() } catch { return null } })(), agora = Date.now()) {
  const doPainel = uso?.cincoHoras && agora - (uso.em || 0) < 3 * 3600e3 ? (uso.cincoHoras.pct || 0) / 100 : 0
  return Math.max(doPainel, Number(cota?.utilizacao5h) || 0)
}

export function escolherRevisores(cota, cfg = revisorDe(), { visual = false, uso } = {}) {
  let fila = [cfg.principal, cfg.reserva].filter(Boolean)
  /* Revisão de foto só com quem enxerga; se a reserva não enxerga, o agy
     entra no lugar dela (é o outro que enxerga). */
  if (visual) {
    fila = fila.filter((r) => VE_IMAGEM[r.agente])
    if (!fila.some((r) => r.agente !== 'claude')) fila.push({ agente: 'agy', modelo: null })
  }
  /* CC-758: trava de segurança. O Claude sai da fila acima do teto da janela
     (75%, escolha dele) ou quando ele mesmo avisou que está perto do fim. */
  const cheio = usoDaJanela(cota, uso) >= cfg.tetoJanela
  const livres = fila.filter((r) => r.agente !== 'claude' || (!cheio && !agentePara('claude', cota).trocou))
  return livres
}

function despacharRevisao(id, t, { texto, dirs = [], oque }, fila) {
  const [quem, ...resto] = fila
  if (!quem) { acrescentar(id, { tipo: 'sistema', texto: 'Não há revisor disponível: o padrão e a reserva estão sem crédito ou desligados.' }); return }
  const c = lerConversa(id)
  const novo = enviar({
    agente: quem.agente, modelo: quem.modelo, texto,
    cwd: t.cwd || c?.cabecalho?.cwd, conversa: id, somenteLer: true, dirsExtras: dirs,
    binario: t.binario || null,
  })
  if (!novo.ok) {
    acrescentar(id, { tipo: 'sistema', texto: `Não consegui pedir a revisão ao ${quem.agente}: ${novo.erro}` })
    if (resto.length) despacharRevisao(id, t, { texto, dirs, oque }, resto)
    return
  }
  acrescentar(id, { tipo: 'sistema', texto: `Revisão pedida: o ${quem.agente}${quem.modelo ? ' (' + quem.modelo + ')' : ''} vai ${oque}, sem editar nada.` })
  acrescentar(id, { tipo: 'turno', turnoId: novo.turnoId, agente: quem.agente, modelo: novo.modelo, revisao: true })
  gravarCabecalho(id, { estado: { turnoId: novo.turnoId, agente: quem.agente, pid: novo.pid, desde: Date.now(), logFile: novo.logFile, erroFile: novo.erroFile } })
  acompanhar(id, {
    ...novo, agente: quem.agente, cwd: t.cwd, revisao: true, autor: t.autor || t.agente, autorPermissao: t.autorPermissao || t.permissao, binario: t.binario,
    // se esta revisão falhar, a próxima da fila tenta, uma vez
    reservaRevisao: resto.length ? { texto, dirs, oque, fila: resto } : null,
  })
}

function pedirRevisao(id, t, texto, mudou) {
  despacharRevisao(id, t, { texto: pedidoDeRevisao(t.agente, texto, mudou), oque: `ler a resposta do ${t.agente} e o que mudou` },
    escolherRevisores(lerCabecalho(id)?.cota))
}

/* ============ CC-745: o painel cobra a conferência prometida ============
 * Simulação de 30/09: "reconfiro no navegador" com uma ferramenta só, o build.
 * Não barra a resposta (não há como provar o contrário pelo texto), mas deixa
 * escrito na conversa, onde ele lê. */
const DISSE_QUE_CONFERIU = /\b(confer\w*|reconfir\w*|verifiq\w*|verifiquei|olhei|testei)\b.{0,50}\b(navegador|browser|na tela|visualmente|no celular)/i
const USOU_NAVEGADOR = /browser|chrome|screenshot|playwright|puppeteer|navegador|cdp/i
export function cobrarConferencia(id, r) {
  if (!DISSE_QUE_CONFERIU.test(r.texto || '')) return false
  if ((r.ferramentas || []).some((f) => USOU_NAVEGADOR.test(`${f.nome} ${f.alvo || ''}`))) return false
  acrescentar(id, { tipo: 'sistema', texto: 'O agente disse que conferiu no navegador, mas nesta resposta não usou navegador nenhum. Trate como não conferido.' })
  return true
}

/* ============ CC-743/744: fotos da tela e o revisor visual ============ */
async function conferirTela(id, t, texto, { revisar = true, semResposta = false } = {}) {
  const cab = lerCabecalho(id)
  if (!cab?.cwd) return
  const alvo = enderecoDe(cab.cwd)
  acrescentar(id, { tipo: 'sistema', texto: alvo
    ? `Conferindo o endereço de teste (${alvo.url}): o painel abre, percorre o site (login, menu, cartões) e fotografa cada tela no celular e no computador.`
    : 'Conferindo a tela: build, e o painel percorre o site (login, menu, cartões) fotografando cada tela no celular e no computador.' })
  const saida = path.join(cab._onde, `${id}.anexos`, `fotos-${t.turnoId}`)
  const res = await fotografar({ cwd: cab.cwd, saida })
  if (res.ok) acrescentar(id, { tipo: 'fotos', turnoId: t.turnoId, fotos: res.fotos })
  /* CC-807, medido na simulação 3: o jogo respondia 200 e estava quebrado
     (prefixo duplicado: 404 no script, página sem estilo). O que o Felipe abre é
     o ENDEREÇO, então é ele que se confere, e o que estiver errado volta ao
     agente, uma vez, com a lista na mão. */
  if (res.endereco && (!res.ok || res.problemas?.length)) {
    const lista = [...(res.ok ? [] : [res.erro]), ...(res.problemas || [])].slice(0, 5)
    if (!t.enderecoCorrigido) {
      return devolver(id, t, `O painel abriu ${res.endereco.url} e achou problema:\n${lista.map((p) => '- ' + p).join('\n')}\nConserte, abra o endereço de novo para conferir (sem 404 e sem erro no console), e responda em uma linha dizendo o que era.`,
        `O endereço de teste está com problema: ${lista.slice(0, 2).join('; ')}${lista.length > 2 ? ` e mais ${lista.length - 2}` : ''}. Devolvi ao ${t.agente} para consertar, uma vez.`, { enderecoCorrigido: true })
    }
    acrescentar(id, { tipo: 'sistema', texto: `O endereço de teste ainda tem problema depois da correção: ${lista.join('; ')}.` })
  }
  if (!res.ok) { acrescentar(id, { tipo: 'sistema', texto: `Não consegui fotografar a tela: ${res.erro}.` }); if (semResposta) pedirResumo(id, t); return }
  if (semResposta) return pedirResumo(id, t) // sem texto não há o que revisar; o resumo vem primeiro
  /* CC-800, print dele: a lista inteira de falhas, com erro técnico, enchia a
     conversa. Fica a conta e as duas primeiras, em português. */
  if (res.falhas?.length) {
    const curtas = res.falhas.slice(0, 2).map((f) => f.split(':')[0].trim())
    acrescentar(id, { tipo: 'sistema', texto: `${res.falhas.length === 1 ? 'Uma tela não saiu' : `${res.falhas.length} telas não saíram`} na foto (${curtas.join(', ')}${res.falhas.length > 2 ? ' e outras' : ''}).` })
  }
  /* Revisor só na primeira volta (a correção não é revisada de novo) e só se
     ninguém mandou mensagem nova enquanto as fotos saíam. */
  /* CC-755: com a revisão visual automática desligada por ele, só as fotos;
     "com revisão" na mensagem ainda pede a revisão. */
  if (!revisar || t.jaVoltou || lerConversa(id)?.turnoAberto) return
  pedirRevisaoVisual(id, t, texto, res.fotos, saida)
}

export function pedidoDeRevisaoVisual(autor, texto, fotos) {
  return [
    `O Felipe pediu mudanças de tela ao ${autor}. Abaixo estão as fotos do site DEPOIS da resposta, tiradas pelo painel.`,
    'Abra cada imagem com a ferramenta de leitura e aponte defeitos visuais OBJETIVOS: texto cortado ou sobreposto, elemento em cima de outro, pouco contraste, algo saindo da tela no celular, espaçamento quebrado.',
    'Não opine sobre gosto. Você está em modo de leitura: não edite nada.',
    'Se estiver tudo certo, comece com "REVISÃO OK". Se houver defeito, comece com "REVISÃO: PROBLEMAS" e liste um por linha, dizendo em qual foto e onde.',
    '',
    'FOTOS:', ...fotos.map((f) => '  ' + f),
    '', `--- resposta do ${autor} ---`, String(texto || '').slice(0, 3000),
  ].join('\n')
}

function pedirRevisaoVisual(id, t, texto, fotos, dirFotos) {
  /* Quem revisa sai da escolha dele (CC-755); o padrão é o Claude Haiku, que
     enxerga imagem e é barato. */
  despacharRevisao(id, t, { texto: pedidoDeRevisaoVisual(t.agente, texto, fotos), dirs: [dirFotos], oque: 'olhar as fotos da tela' },
    escolherRevisores(lerCabecalho(id)?.cota, revisorDe(), { visual: true }))
}

/* CC-796: paradas por ordem dele (botão parar); a queda sem ordem é retomada */
const PARADOS = new Set()

/* CC-803: quanto o agente pode ficar calado. Medido: silêncio de 138 s com o
   modelo escrevendo um arquivo grande, em máquina carregada; 300 s dá folga. */
export const SILENCIO_MS = Number(process.env.CC_SILENCIO_MS) || 5 * 60 * 1000

/* CC-813: a partir de quantos tokens de sessão o opencode ganha sessão nova.
   Medido: falhas só apareceram acima de 77 mil; 80 mil dá folga sem trocar à toa. */
export const LIMITE_CONTEXTO = Number(process.env.CC_LIMITE_CONTEXTO) || 80000
const rotuloTempo = (ms) => ms >= 60000 ? `${Math.round(ms / 60000)} minutos` : `${Math.round(ms / 1000)} segundos`

/** Há quanto tempo o turno está calado, ou 0 se não dá para chamar de calado. */
function silencioDoTurno(t, id) {
  try {
    // esperando a resposta DELE (pergunta ou permissão): o silêncio é legítimo
    const dir = DIR_PERMISSOES()
    if (fs.existsSync(dir)) {
      for (const nome of fs.readdirSync(dir)) {
        try { const p = JSON.parse(fs.readFileSync(path.join(dir, nome), 'utf8')); if (p?.coderoom === id) return 0 } catch { /* sendo gravado */ }
      }
    }
    // uma ferramenta rodando (npm install, build): o registro só anda quando ela termina.
    // O servidor de perguntas é filho fixo do opencode e não conta.
    const filhos = execFileSync('pgrep', ['-a', '-P', String(t.pid)], { encoding: 'utf8', timeout: 3000 }).split('\n')
    if (filhos.some((l) => l.trim() && !/mcpPainel|opencode-prumo/.test(l))) return 0
  } catch { /* pgrep sai com 1 quando não há filho: segue para a medida */ }
  try { return Date.now() - fs.statSync(t.logFile).mtimeMs } catch { return 0 }
}

/**
 * Manda ao MESMO agente um pedido do painel (continuar de onde caiu), com a
 * sessão dele, e acompanha a volta carregando as marcas do turno.
 */
function devolver(id, t, texto, aviso, marcas = {}) {
  const c = lerConversa(id)
  acrescentar(id, { tipo: 'sistema', texto: aviso })
  const novo = enviar({
    agente: t.agente, texto,
    cwd: t.cwd || c?.cabecalho?.cwd, conversa: id,
    permissao: t.permissao || c?.cabecalho?.permissao || 'acceptEdits',
    sessao: c?.cabecalho?.sessoes?.[t.agente] || null,
    modelo: c?.cabecalho?.modelos?.[t.agente] || null,
    binario: t.binario || null,
  })
  if (!novo.ok) { acrescentar(id, { tipo: 'sistema', texto: `Não consegui falar com o ${t.agente}: ${novo.erro}` }); return }
  const ate = c?.ultimoSeq || 0
  const revisar = marcas.revisar ?? t.revisar
  acrescentar(id, { tipo: 'turno', turnoId: novo.turnoId, agente: t.agente, modelo: novo.modelo, permissao: novo.permissao })
  // ponytail: a marca `retomado` não vai para o estado gravado; se o painel religar no meio, a volta segue o caminho comum
  gravarCabecalho(id, { estado: { turnoId: novo.turnoId, agente: t.agente, pid: novo.pid, desde: Date.now(), logFile: novo.logFile, erroFile: novo.erroFile, ate, revisar } })
  acompanhar(id, { ...novo, agente: t.agente, ate, cwd: t.cwd, permissao: novo.permissao, binario: t.binario, jaVoltou: t.jaVoltou, retomado: t.retomado, ...marcas, revisar })
}

/** CC-803: o agente trabalhou e não disse nada; pede o resumo, em linguagem simples, uma vez. */
function pedirResumo(id, t) {
  devolver(id, t, 'Você terminou sem escrever nada ao Felipe, e ele não lê código. Responda agora em 2 ou 3 linhas simples: o que você fez, o que ficou faltando e, se o projeto está no endereço de teste, o endereço em linha própria.',
    `O ${t.agente} trabalhou e terminou sem escrever nada. Pedi um resumo em linguagem simples, uma vez.`, { resumoPedido: true })
}

function voltarDaRevisao(id, t, texto) {
  if (revisaoAprovou(texto)) return
  const c = lerConversa(id)
  acrescentar(id, { tipo: 'sistema', texto: `O ${t.agente} apontou problemas. Mandei a revisão ao ${t.autor} para corrigir, uma vez.` })
  const novo = enviar({
    agente: t.autor,
    texto: `O ${t.agente} revisou sua última resposta e escreveu:\n\n${texto}\n\nCorrija o que for procedente e diga o que mudou. Se discordar de algum ponto, explique por quê.`,
    cwd: t.cwd || c?.cabecalho?.cwd, conversa: id,
    permissao: t.autorPermissao || c?.cabecalho?.permissao || 'acceptEdits',
    sessao: c?.cabecalho?.sessoes?.[t.autor] || null,
    modelo: c?.cabecalho?.modelos?.[t.autor] || null,
    binario: t.binario || null,
  })
  if (!novo.ok) {
    acrescentar(id, { tipo: 'sistema', texto: `Não consegui devolver ao ${t.autor}: ${novo.erro}` })
    return
  }
  const ate = c?.ultimoSeq || 0
  acrescentar(id, { tipo: 'turno', turnoId: novo.turnoId, agente: t.autor, modelo: novo.modelo, permissao: novo.permissao })
  gravarCabecalho(id, { estado: { turnoId: novo.turnoId, agente: t.autor, pid: novo.pid, desde: Date.now(), logFile: novo.logFile, erroFile: novo.erroFile, ate } })
  acompanhar(id, { ...novo, agente: t.autor, ate, cwd: t.cwd, permissao: novo.permissao, binario: t.binario, jaVoltou: true })
}

/** Parar é decisão dele, e não efeito colateral de trocar de agente. */
export function parar(id) {
  const c = lerConversa(id)
  const pid = c?.cabecalho?.estado?.pid
  if (!pid) return { ok: false, erro: 'nenhum agente respondendo agora' }
  try { process.kill(pid, 'SIGTERM') } catch { /* já morreu */ }
  PARADOS.add(id) // queda por ordem dele não é retomada sozinha
  limparPedidos(id)
  acrescentar(id, { tipo: 'sistema', texto: 'Você parou esta resposta. O que já tinha chegado continua acima.' })
  return { ok: true }
}
