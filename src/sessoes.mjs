/**
 * Sessões INTERATIVAS do Claude Code, derivadas dos transcritos.
 *
 * Por que existe (CC-51, medido em 14/08): `jobs.mjs` só enxerga
 * `~/.claude/jobs`, e essa pasta só ganha `state.json` quando o job roda em
 * BACKGROUND. Trabalhar pelo celular via Remote Control é sessão interativa, e
 * nesta VPS não existe nenhum job de background: o painel mostrava a aba de
 * agentes vazia mesmo com uma sessão trabalhando havia horas. O painel não
 * estava errado, estava cego para metade do trabalho.
 *
 * Contrato de segurança, o mesmo do `jobs.mjs`: aqui **só se lê**. Os
 * transcritos são do Claude Code; nada neste arquivo escreve neles.
 *
 * A saída é do mesmo formato dos jobs (reusa `buildJob`), com `tipo:
 * 'interativa'`, para o resto do painel não precisar saber a diferença.
 */
import fs from 'node:fs'
import path from 'node:path'
import { listar as listarCoderoom, ultimoDoAgente } from './gate.mjs'
import { buildJob, readJobs } from './jobs.mjs'

/**
 * CC-260: o gasto por sessão, atualizado NOUTRO ritmo.
 *
 * Fica num mapa em memória em vez de ser lido aqui: a varredura custa ~305ms na
 * primeira chamada, e este arquivo é percorrido a cada 2 segundos pelo painel.
 * Quem enche o mapa é `atualizarTokens()`, chamada pelo servidor a cada 30s.
 *
 * Nasce vazio de propósito: até a primeira varredura, `tokens` continua `null`,
 * e a tela diz que não sabe em vez de mostrar zero.
 */
let TOKENS_CONHECIDOS = {}

export function atualizarTokens(mapa) {
  if (mapa && typeof mapa === 'object') TOKENS_CONHECIDOS = mapa
  return Object.keys(TOKENS_CONHECIDOS).length
}
import { PROJETOS_DIR as pastaProjetos, lerMetaSessao, limparOrfaos } from './metaSessao.mjs'

// via `casaClaude()`, para o gate poder apontar tudo pra uma casa temporária
export const PROJETOS_DIR = pastaProjetos()

/** Só o que teve sinal recente. Sem isso, o PC do Felipe traria centenas de
 *  sessões mortas e o painel viraria arquivo morto em vez de "o que está
 *  acontecendo agora". */
export const JANELA_MS = 24 * 60 * 60 * 1000

/**
 * As sessões ABERTAS de verdade nesta máquina (27/09). A lista de sessões sai
 * das conversas gravadas nas últimas 24h, e conversa gravada não diz se o
 * programa ainda está aberto: a sessão de teste, já fechada, seguia
 * "conectada" e "parada esperando você". O Claude Code mantém um registro por
 * processo em `~/.claude/sessions/<pid>.json`, com o id da conversa; vale o que
 * tiver processo vivo. Sem o registro (outra máquina, casa de teste), devolve
 * null e ninguém é marcado: melhor não saber do que afirmar que fechou.
 */
export function sessoesAbertas() {
  const dir = path.join(path.dirname(PROJETOS_DIR), 'sessions')
  let nomes
  try { nomes = fs.readdirSync(dir).filter((f) => f.endsWith('.json')) } catch { return null }
  /* CC-606: sessionId -> status do registro. `waiting` é o terminal parado
     num pedido de permissão (medido em 27/09 com o ahtleta-escalada). */
  const abertas = new Map()
  for (const f of nomes) {
    try {
      const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      if (!o.sessionId || !o.pid) continue
      process.kill(o.pid, 0) // lança se o processo não existe mais
      abertas.set(o.sessionId, o.status || null)
    } catch { /* registro velho ou ilegível: não conta como aberta */ }
  }
  return abertas
}

/** Cabeça do arquivo: onde mora o `cwd`. Nunca muda, então o cache é eterno
 *  (mesma lição do `transcript.mjs`, onde ler 25 MB a cada 2s travava tudo). */
const CABECA_BYTES = 16 * 1024
const cacheCabeca = new Map() // arquivo -> { cwd, criadoEm, remoto }
const CABECA_MAX = 256 * 1024 // teto da busca pelo `cwd`, igual à cauda que a aba tempo lê

/**
 * Lê o começo do transcrito atrás do `cwd`.
 *
 * O nome da pasta NÃO serve: `-home-claudedev-projetos-proj-controlcenter`
 * troca `/` e `_` pelo mesmo `-`, então não dá para saber se é
 * `proj_controlcenter` ou `proj/controlcenter`. O caminho de verdade está
 * dentro do arquivo, nas linhas que carregam `cwd`.
 */
export function cabecaDe(arquivo) {
  const emCache = cacheCabeca.get(arquivo)
  if (emCache) return emCache

  let cwd = null
  let criadoEm = null
  let remoto = false
  let appUrl = null
  let entrada = null
  let fd = null
  try {
    fd = fs.openSync(arquivo, 'r')
    /* Lê em blocos e cresce até achar o `cwd`, não só os primeiros 16 KB.
       Sessão pilotada pelo celular (Remote Control) tem preâmbulo grande, e o
       primeiro `cwd` já apareceu no byte ~20 KB: com janela fixa de 16 KB a
       sessão sumia da Central inteira. O começo do arquivo nunca muda, e o
       resultado é cacheado, então ler mais custa uma vez só. O teto evita que
       transcrito gigante sem `cwd` (não devia existir) leia sem fim. */
    let pos = 0
    let resto = ''
    while (pos < CABECA_MAX) {
      const buf = Buffer.alloc(CABECA_BYTES)
      const lidos = fs.readSync(fd, buf, 0, CABECA_BYTES, pos)
      if (lidos <= 0) break
      pos += lidos
      const linhas = (resto + buf.subarray(0, lidos).toString('utf8')).split('\n')
      resto = linhas.pop() // a última pode vir cortada no meio; junta no próximo bloco
      for (const linha of linhas) {
        if (!linha.trim()) continue
        let o = null
        try { o = JSON.parse(linha) } catch { continue }
        // `bridge-session` é o marcador de Remote Control: a sessão está sendo
        // pilotada de fora (celular, claude.ai), não de um terminal desta máquina.
        if (o.type === 'bridge-session') {
          remoto = true
          /* CC-740: `cse_X` é a sessão `claude.ai/code/session_X` no app (medido em
             30/09 com a própria sessão). Com isto, sessão de outra máquina ganha
             "abrir no app", onde ele responde o que o painel não alcança. */
          const m = /^cse_([A-Za-z0-9]{10,60})$/.exec(String(o.bridgeSessionId || ''))
          if (m) appUrl = 'https://claude.ai/code/session_' + m[1]
        }
        /* 27/09: `sdk-cli` é o `claude -p`, sessão disparada por PROGRAMA (um
           teste, um script), não aberta por ele. Ela roda, responde e acaba:
           ninguém responde a ela. Sem esta marca, dois testes da skill das
           gavetas, rodados na pasta do sumauma, viraram "decisões" dele. */
        if (!entrada && typeof o.entrypoint === 'string') entrada = o.entrypoint
        if (!cwd && typeof o.cwd === 'string' && o.cwd) cwd = o.cwd
        if (!criadoEm && o.timestamp) criadoEm = Date.parse(o.timestamp) || null
      }
      if (cwd && criadoEm && entrada) break
      if (lidos < CABECA_BYTES) break // chegou ao fim do arquivo
    }
  } catch {
    return null
  } finally {
    if (fd !== null) { try { fs.closeSync(fd) } catch { /* já fechado */ } }
  }

  if (!cwd) return null
  const achado = { cwd, criadoEm, remoto, appUrl, porPrograma: entrada === 'sdk-cli' }
  cacheCabeca.set(arquivo, achado)
  return achado
}

/**
 * Status de sessão interativa, que é diferente do de job.
 *
 * Job tem `state.fan` para dizer se há ferramenta rodando. Aqui o único sinal
 * é o arquivo crescer. A leitura segue a mesma lógica já registrada para os
 * jobs: escrevendo agora está trabalhando; parou há pouco, acabou de responder
 * e espera o Felipe; parou há muito, está ociosa.
 */
export function statusDe(idadeMs) {
  if (idadeMs < 60 * 1000) return 'working'
  if (idadeMs < 30 * 60 * 1000) return 'waiting'
  return 'idle'
}

/* CC-727, queixa dele em 30/09: "o agente já parou de trabalhar e demora
   muito pra atualizar que parou no cockpit". Pela idade do arquivo, a sessão
   que acabou de responder contava como trabalhando por mais 60 s. O registro
   do Claude Code diz `idle` na hora em que o turno acaba, e esse sinal é
   confiável: vira "parou" na hora. O `busy` NÃO manda (com ajudante em
   segundo plano ele fica `busy` parado num pedido, CC-640), então sem `idle`
   segue a regra da idade, e a tela do terminal corrige o resto. */
export function estadoDaSessao(doRegistro, idadeMs) {
  if (doRegistro === 'waiting') return 'waiting'
  const pelaIdade = statusDe(idadeMs)
  if (doRegistro === 'idle' && pelaIdade === 'working') return 'waiting'
  return pelaIdade
}

const arquivosEm = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.jsonl'))
      .map((d) => path.join(dir, d.name))
  } catch {
    return []
  }
}

const pastasEm = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(dir, d.name))
  } catch {
    return []
  }
}

/**
 * As sessões interativas com sinal dentro da janela.
 *
 * `ignorar` recebe os ids que já vieram como job de background: a MESMA sessão
 * pode ter transcrito e job, e aí apareceria duas vezes na tela.
 */
export function readSessoes(now = Date.now(), { janelaMs = JANELA_MS, ignorar = [] } = {}) {
  const jaVistos = new Set(ignorar.filter(Boolean))
  const sessoes = []
  const abertas = sessoesAbertas()

  for (const pasta of pastasEm(PROJETOS_DIR)) {
    for (const arquivo of arquivosEm(pasta)) {
      let st = null
      try { st = fs.statSync(arquivo) } catch { continue }
      const atualizado = st.mtimeMs
      if (now - atualizado > janelaMs) continue

      const sessionId = path.basename(arquivo, '.jsonl')
      const curto = sessionId.slice(0, 8)
      if (jaVistos.has(sessionId) || jaVistos.has(curto)) continue

      const cabeca = cabecaDe(arquivo)
      if (!cabeca) continue // transcrito sem cwd: não dá pra dizer de que projeto é

      const idade = now - atualizado
      // Estado sintético no formato que `buildJob` espera. Reusar ele é o que
      // faz a sessão interativa cair no resto do painel (cockpit, filtros,
      // ordenação) sem nenhum caso especial espalhado por aí.
      const state = {
        sessionId,
        cwd: cabeca.cwd,
        createdAt: new Date(cabeca.criadoEm || atualizado).toISOString(),
        updatedAt: new Date(atualizado).toISOString(),
        linkScanPath: arquivo,
        /* CC-621, print dele: "demorou mas aparece". Pela idade do arquivo, a
           sessão parada num pedido conta como trabalhando no primeiro minuto
           (acabou de escrever), e o cartão só nascia depois. O registro do
           Claude Code diz `waiting` um segundo depois do pedido (medido no
           dengonator: pedido às 21:42:05, registro às 21:42:06). */
        state: estadoDaSessao(abertas?.get(sessionId), idade),
        fan: [],
        tokens: 0,
      }

      /* CC-56: a sessão agora pode reportar o próprio estado, e ele entra aqui
         como o `meta` que o job de background sempre teve. É o que faz to-do,
         frente e bloqueio aparecerem iguais nos dois tipos de linha — sem isso
         o painel enxergava a sessão mas ela não tinha voz. */
      const job = buildJob(curto, state, lerMetaSessao(sessionId), [], now)
      sessoes.push({
        ...job,
        // O que a tela precisa para não mentir sobre o que é cada linha.
        tipo: 'interativa',
        remoto: cabeca.remoto,
        appUrl: cabeca.appUrl || null,
        porPrograma: Boolean(cabeca.porPrograma),
        /* true/false quando o registro existe; undefined quando não se sabe.
           Sessão por programa nunca está no registro depois de acabar, e não
           precisa: ela já sai pela marca própria. */
        aberta: abertas ? abertas.has(sessionId) : undefined,
        permissao: abertas?.get(sessionId) === 'waiting',
        // Sessão interativa não tem contagem de token barata: o total exigiria
        // parsear o transcrito inteiro, que é trabalho da aba tempo. Melhor
        // dizer que não se sabe do que mostrar zero como se fosse medida.
        /* CC-260: o total sai do mapa que a aba Tempo já mantém, e nunca de uma
           leitura feita aqui: o comentário acima continua valendo, contar na
           hora custaria caro demais para o tique de 2 segundos. `null` segue
           sendo o padrão honesto quando o mapa ainda não tem esta sessão. */
        tokens: TOKENS_CONHECIDOS[sessionId] ?? TOKENS_CONHECIDOS[curto] ?? null,
        transcript: arquivo,
      })
    }
  }

  return sessoes.sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * TODOS os agentes desta máquina: os de background mais as sessões interativas.
 *
 * Existe porque essa soma já era feita à mão em dois lugares (o `cc json` e o
 * `/api/jobs` do painel), e quem esquecia dela lia ZERO agente com cinco
 * trabalhando. É o CC-124, e ele voltou no CC-232: o primeiro rascunho dos
 * ganchos de tarefa chamou `readJobs()` sozinho e passou calado justamente no
 * caso que precisava cobrar — a pasta de background está vazia nesta VPS, onde
 * quase tudo é sessão interativa via Remote Control.
 *
 * `ignorar` evita contar duas vezes quem tem as duas caras.
 */
export function todosOsJobs(now = Date.now(), opcoes = {}) {
  let doBackground = []
  /* Uma fonte que falha não pode zerar a outra: o modo mais barato de este
     helper mentir seria devolver lista vazia por causa de uma pasta ausente. */
  try { doBackground = readJobs() } catch { doBackground = [] }
  let interativas = []
  try {
    interativas = readSessoes(now, {
      ...opcoes,
      ignorar: doBackground.flatMap((j) => [j.id, j.sessionId]).filter(Boolean),
    })
  } catch { interativas = [] }
  
  let coderoom = []
  try {
    coderoom = listarCoderoom({ arquivadas: false }).map(c => {
      const isWorking = c.estado !== null
      const statusStr = isWorking ? 'working' : 'waiting' // Se não tem agente trabalhando, pode estar esperando o usuário

      /* A última resposta do agente, lida do log da conversa. É o que faz o
         cartão de Sessões mostrar fala e resumo no coderoom, e o que permite
         responder por ele: sem isto, o cartão só sabia o nome da conversa. */
      const ultima = ultimoDoAgente(c.id)

      const state = {
        sessionId: c.id,
        cwd: c.cwd || '',
        createdAt: new Date(c.criadaEm || now).toISOString(),
        updatedAt: new Date(c.mexidaEm || c.criadaEm || now).toISOString(),
        state: statusStr,
        fan: [],
        tokens: 0,
        template: c.estado?.agente || c.agentePadrao || 'claude',
      }
      const meta = {
        subject: c.titulo,
        project: c.projeto,
        status: isWorking ? `respondendo (${state.template})` : 'aguardando',
      }
      
      const job = buildJob(c.id, state, meta, [], now)
      return {
        ...job,
        tipo: 'coderoom', // Para que a UI reconheça como coderoom
        /* Qual agente responde nesta conversa. `buildJob` não repassa o
           `template`, e o cartão precisa dele para não dizer "claude code
           (fundo)" embaixo de uma conversa do opencode. */
        template: state.template,
        /* CC-728: o modelo escolhido para esse agente nesta conversa (vazio é o
           padrão dele), para o cartão em Sessões mostrar e deixar trocar. */
        model: c.modelos?.[state.template] || null,
        aberta: true,
        permissao: false, // Coderoom tem permissões aceitas automaticamente
        transcript: null,
        /* Texto cru, do jeito que o agente escreveu. Quem decide o que é a
           "primeira frase" e o "resumo" é o `cockpit2.mjs`, que é quem já
           faz isso para o Claude Code, e os dois caminhos precisam cair no
           mesmo formato. */
        ultima: ultima ? { de: ultima.de, texto: ultima.texto, em: ultima.em } : null,
        origem: { id: 'coderoom', nome: 'Coderoom', idadeMs: 0, semContato: false },
      }
    })
  } catch (e) {
    console.error('Erro ao ler sessoes do coderoom', e)
    coderoom = []
  }

  return [...doBackground, ...interativas, ...coderoom]
}
