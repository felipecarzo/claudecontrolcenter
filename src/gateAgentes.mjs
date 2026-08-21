/**
 * Os três agentes do gate, numa assinatura só.
 *
 * `opencode.mjs` se declara, no próprio cabeçalho, como "os agentes que NÃO são
 * o Claude", e o contrato dele é disparo-e-esquece. Alargar aquela tabela em
 * silêncio quebraria o significado documentado, e `--resume` não cabe num
 * `args: (prompt, modelo) => [...]`. Por isso este arquivo existe ao lado, e
 * importa de lá o que já está medido em vez de recopiar.
 *
 * ## O que foi MEDIDO contra os binários reais em 21/08, nesta VPS
 *
 * Nada aqui foi lido em documentação. `claude` 2.1.231, `opencode` e `agy`:
 *
 * 1. **As proteções disparam sem terminal.** Pedido ao `claude -p` para escrever
 *    um travessão num `.html`, com permissão liberada: o `travessao-guard`
 *    barrou, a explicação voltou como resultado de ferramenta, e o agente parou
 *    e ofereceu alternativas. É a rede que ele nomeou ao dizer "pode agir livre
 *    mas seguindo o framework e os hooks", e ela vale aqui.
 * 2. **O pedido TEM que ir pela entrada padrão.** Passando o texto como
 *    argumento com a entrada aberta, o CLI espera 3s e morre com "Input must be
 *    provided either through stdin or as a prompt argument". Vai por `stdin` e
 *    acabou, o que de quebra some com o teto de tamanho da linha de comando: um
 *    delta com contexto passa fácil de 100 KB, e estourar aquele teto é `E2BIG`,
 *    que o `spawn` engole em silêncio.
 * 3. **Retomar sessão funciona, e é barato.** Um turno guardou um número, o
 *    seguinte devolveu. Custo do primeiro: US$ 0,46. Do segundo: US$ 0,023, com
 *    45 mil tokens lidos do cache. O medo de custo era exagerado.
 * 4. **Sessão perdida falha alto**, com saída não-zero e "No conversation found
 *    with session ID". É detectável, que é o que torna o marcador honesto.
 * 5. **opencode e agy aceitam o pedido por `stdin`** sem argumento nenhum.
 *
 * ## A regra de spawn, que já foi paga neste projeto
 *
 * Sem `detached`, sem `unref`: o disparo vem de DENTRO do processo do painel,
 * que não sai sozinho, e `detached` quebra a captura de saída por `fd` cru. E
 * nunca `shell: true` com argumento dinâmico, que é injeção de comando real e
 * não questão de estilo. Ver o cabeçalho de `opencode.mjs`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { resolverBinario } from './paineis.mjs'
import { ehWindows } from './platform.mjs'

export const PASTA_LOG = path.join(os.tmpdir(), 'cc-gate')

/**
 * O catálogo.
 *
 * `precisaSessao` diz quem tem memória endereçável, e é o que decide se vale
 * manter marcador de leitura para aquele agente. Só o Claude tem.
 */
export const AGENTES_GATE = {
  claude: {
    binario: 'claude',
    rotulo: 'Claude Code',
    paga: 'a sua assinatura',
    aceitaModelo: true,
    precisaSessao: true,
    args: ({ sessao, novaSessao, permissao, cwd, pacote, modelo }) => [
      '-p',
      '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
      '--permission-mode', permissao,
      '--add-dir', cwd,
      ...(sessao ? ['--resume', sessao] : ['--session-id', novaSessao]),
      ...(pacote ? ['--append-system-prompt-file', pacote] : []),
      ...(modelo ? ['--model', modelo] : []),
    ],
  },
  opencode: {
    binario: 'opencode',
    rotulo: 'opencode',
    paga: 'os modelos gratuitos',
    aceitaModelo: true,
    modeloPadrao: 'opencode/big-pickle',
    precisaSessao: false,
    args: ({ modelo }) => ['run', '--model', modelo || 'opencode/big-pickle', '--format', 'json'],
  },
  agy: {
    binario: 'agy',
    rotulo: 'agy',
    paga: 'a conta Google logada nele',
    /* Sem escolha de modelo, de propósito: ele decide pela conta logada, e
       mandar um nome desconhecido derruba a chamada inteira. A tela diz
       "definido pela conta Google" e NUNCA fica em branco, porque campo vazio
       não distingue "não tem" de "não consegui ler". */
    aceitaModelo: false,
    precisaSessao: false,
    args: () => ['--output-format', 'stream-json'],
  },
}

export const agenteDe = (nome) => AGENTES_GATE[nome] || AGENTES_GATE.claude

/**
 * Manda uma mensagem para um agente. Devolve na hora; quem acompanha lê o log.
 *
 * `texto` é o delta da conversa, já formatado como transcrição por `gate.mjs`.
 * `pacote` é o caminho de um arquivo com o contexto do projeto, ou `null`.
 */
export function enviar({ agente = 'claude', texto, cwd, permissao = 'acceptEdits', sessao = null, modelo = null, pacote = null, pacoteTexto = null, binario = null }) {
  if (!texto) throw new Error('mensagem vazia')
  if (!cwd) throw new Error('sem pasta: o agente não teria onde agir')

  fs.mkdirSync(PASTA_LOG, { recursive: true })
  const turnoId = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const logFile = path.join(PASTA_LOG, `${turnoId}.jsonl`)
  const erroFile = path.join(PASTA_LOG, `${turnoId}.err`)

  const a = agenteDe(agente)
  const novaSessao = randomUUID()
  const alvo = binario || resolverBinario(a.binario)

  /* O contexto do projeto entra por caminhos diferentes, e NUNCA pelos dois ao
     mesmo tempo: pagar o pacote duas vezes é token jogado fora a cada turno.
     O Claude tem opção própria para isso, e recebe por arquivo. Os outros dois
     recebem colado na frente do pedido, separado com um cabeçalho que diz o que
     é: sem essa marca, o agente lê o estado do projeto como se fosse ordem. */
  const usaArquivo = Boolean(pacote) && a.aceitaArquivoDeContexto !== false && agente === 'claude'
  const corpo = (!usaArquivo && pacoteTexto)
    ? `${pacoteTexto}\n\n--- fim do estado do projeto. a conversa começa abaixo. ---\n\n${texto}`
    : texto

  const args = a.args({
    sessao, novaSessao, permissao, cwd,
    pacote: usaArquivo ? pacote : null,
    modelo: a.aceitaModelo ? (modelo || a.modeloPadrao || null) : null,
  })
  const [cmd, cmdArgs] = ehWindows ? ['cmd', ['/c', alvo, ...args]] : [alvo, args]

  try {
    const saida = fs.openSync(logFile, 'a')
    const erro = fs.openSync(erroFile, 'a')
    /* A entrada é `pipe` porque o pedido vai por ela (medição 2). A saída e o
       erro vão para arquivo por `fd` cru, que é o que sobrevive ao fim deste
       processo e o que a tela lê enquanto a resposta cresce. */
    const filho = spawn(cmd, cmdArgs, {
      cwd, stdio: ['pipe', saida, erro], windowsHide: true,
    })
    filho.on('error', () => { /* falha aberta: binário ausente não derruba o painel */ })
    filho.stdin.on('error', () => { /* o filho pode morrer antes de ler tudo */ })
    filho.stdin.end(corpo)
    fs.closeSync(saida)
    fs.closeSync(erro)
    return {
      ok: true, turnoId, logFile, erroFile, pid: filho.pid,
      contextoPor: usaArquivo ? 'arquivo' : (pacoteTexto ? 'texto' : 'nenhum'),
      sessaoUsada: sessao || (a.precisaSessao ? novaSessao : null),
      agente, modelo: a.aceitaModelo ? (modelo || a.modeloPadrao || null) : null,
      permissao,
    }
  } catch (e) {
    return { ok: false, turnoId, logFile, erroFile, agente, erro: String(e.message || e) }
  }
}

/* ============================ ler o que voltou ============================ */

const linhas = (arquivo) => {
  let cru = ''
  try { cru = fs.readFileSync(arquivo, 'utf8') } catch { return [] }
  const fora = []
  for (const l of cru.split('\n')) {
    if (!l.trim()) continue
    try { fora.push(JSON.parse(l)) } catch { /* linha pela metade de uma escrita em voo */ }
  }
  return fora
}

/** Uma proteção barrou a ferramenta. É assim que a recusa chega, medido. */
const ehRecusaDeHook = (t) => /PreToolUse:.*hook error|hook error:/i.test(String(t || ''))

/**
 * O turno normalizado, venha de qual agente vier.
 *
 * São TRÊS gramáticas diferentes, e o resto do painel não deveria saber disso:
 *
 * - **Claude**: `assistant` com `message.content[]` de `text` e `tool_use`;
 *   `user` com `tool_result`; `result` com `session_id`, `total_cost_usd`,
 *   `usage` e `duration_ms`; e `rate_limit_event` com a cota do plano.
 * - **opencode**: `{type:'text',part:{text}}` e `{type:'tool_use',part:{tool}}`.
 * - **agy**: `step_update.text_delta`, `step_update.step_type==='tool_use'`, e
 *   `{event:'result',result:{response,usage}}` fechando com a resposta INTEIRA
 *   (por isso o fechamento vence o acúmulo, senão o texto sairia duplicado).
 */
export function lerTurno(logFile, agente = 'claude', erroFile = null) {
  const eventos = linhas(logFile)
  const fora = {
    texto: '', ferramentas: [], custo: null, segundos: null,
    sessao: null, terminou: false, estado: null, erro: null,
    cota: null, barradoPorProtecao: false,
  }
  let fechamento = null

  for (const o of eventos) {
    /* ---- Claude ---- */
    if (o.type === 'assistant' && o.message?.content) {
      for (const c of o.message.content) {
        if (c.type === 'text' && typeof c.text === 'string') fora.texto += c.text
        if (c.type === 'tool_use') fora.ferramentas.push({ nome: c.name, alvo: alvoDe(c.input) })
      }
    }
    if (o.type === 'user' && o.message?.content) {
      for (const c of o.message.content) {
        if (c.type !== 'tool_result') continue
        const t = typeof c.content === 'string' ? c.content : JSON.stringify(c.content)
        if (ehRecusaDeHook(t)) fora.barradoPorProtecao = true
      }
    }
    if (o.type === 'rate_limit_event' && o.rate_limit_info) {
      fora.cota = {
        tipo: o.rate_limit_info.rateLimitType || null,
        estado: o.rate_limit_info.status || null,
        resetaEm: Number.isFinite(o.rate_limit_info.resetsAt) ? o.rate_limit_info.resetsAt * 1000 : null,
      }
    }
    if (o.type === 'result') {
      fora.terminou = true
      fora.estado = o.subtype === 'success' ? 'pronto' : 'falhou'
      fora.sessao = o.session_id || fora.sessao
      fora.segundos = Number.isFinite(o.duration_ms) ? Math.round(o.duration_ms / 1000) : null
      fora.custo = {
        dolar: Number.isFinite(o.total_cost_usd) ? o.total_cost_usd : null,
        entrada: o.usage?.input_tokens || 0,
        saida: o.usage?.output_tokens || 0,
        cacheLido: o.usage?.cache_read_input_tokens || 0,
        cacheCriado: o.usage?.cache_creation_input_tokens || 0,
      }
      if (fora.estado === 'falhou') fora.erro = o.result || o.error || 'o agente terminou com erro'
    }
    if (o.type === 'system' && o.subtype === 'init' && o.session_id) fora.sessao = o.session_id

    /* ---- opencode ---- */
    if (o.type === 'text' && typeof o.part?.text === 'string') fora.texto += o.part.text
    if (o.type === 'tool_use' && o.part?.tool) {
      fora.ferramentas.push({ nome: o.part.tool, alvo: o.part?.state?.input?.filePath || null })
    }

    /* ---- agy ---- */
    const passo = o.step_update
    if (passo?.step_type === 'agent_response' && typeof passo.text_delta === 'string') fora.texto += passo.text_delta
    if (passo?.step_type === 'tool_use') fora.ferramentas.push({ nome: passo.tool_name || 'ferramenta', alvo: null })
    if (o.event === 'init' && o.conversation_id) fora.sessao = fora.sessao || o.conversation_id
    if (o.event === 'result') {
      fora.terminou = true
      fechamento = typeof o.result?.response === 'string' ? o.result.response : fechamento
      fora.estado = o.result?.status === 'SUCCESS' ? 'pronto' : 'falhou'
      fora.segundos = o.result?.duration_seconds ?? fora.segundos
      const u = o.result?.usage
      if (u) fora.custo = { dolar: null, entrada: u.input_tokens || 0, saida: u.output_tokens || 0, cacheLido: 0, cacheCriado: 0 }
    }
  }

  if (fechamento && fechamento.trim()) fora.texto = fechamento

  /* O erro do CLI não vem no fluxo, vem na saída de erro. É de lá que sai a
     prova de que a sessão sumiu, e sem ela o marcador continuaria mentindo. */
  if (erroFile) {
    let e = ''
    try { e = fs.readFileSync(erroFile, 'utf8') } catch { /* pode não existir */ }
    if (/No conversation found with session ID/i.test(e)) {
      fora.sessaoPerdida = true
      /* Esta frase VENCE o erro genérico do fechamento, e não é detalhe: o
         fluxo fecha com "error_during_execution", que descreve o sintoma. A
         causa é a sessão ter sumido, e é ela que diz o que fazer a seguir
         (recomeçar mandando a conversa inteira). */
      fora.erro = 'a sessão anterior não existe mais'
    } else if (e.trim() && !fora.terminou) {
      fora.erro = fora.erro || e.trim().split('\n').slice(-1)[0]
    }
  }

  return fora
}

/** O alvo da ferramenta, para a tela dizer "Edit src/web.mjs" e não só "Edit". */
function alvoDe(input) {
  if (!input || typeof input !== 'object') return null
  const p = input.file_path || input.filePath || input.path || input.notebook_path
  if (p) return String(p).replace(/\\/g, '/').split('/').slice(-2).join('/')
  if (input.command) return String(input.command).slice(0, 40)
  if (input.pattern) return String(input.pattern).slice(0, 40)
  return null
}

/* ================== CC-249: a troca quando a cota aperta ==================
 *
 * Escolha dele, entre quatro caminhos: *"Troca sozinho quando apertar"* — perto
 * do teto do plano, o painel manda para outro agente em vez do Claude, e conta
 * que trocou.
 *
 * **O furo que a medição resolveu de um jeito melhor que o planejado.** A
 * leitura de cota do painel nunca teve dado nesta VPS: ela grava numa pasta que
 * o sandbox tranca, e falha calada. O plano previa consertar isso primeiro.
 * Medindo, apareceu caminho mais curto: **a cota vem dentro de cada resposta do
 * Claude**, num evento próprio com o tipo da janela, o estado e quando ela
 * reseta. O gate colhe sozinho, sem depender de conserto nenhum.
 *
 * O estado é o do próprio programa, não conta nossa: `allowed`, `warning`,
 * `rejected`. Inventar um percentual em cima disso seria número sem fonte.
 */
export const ESTADOS_QUE_APERTAM = new Set(['warning', 'rejected'])

/**
 * Quem responde de verdade, dado quem ele pediu e a última cota conhecida.
 *
 * Devolve SEMPRE o motivo junto, mesmo quando não troca: quem chama precisa
 * poder dizer na tela por que a resposta veio de outro. Troca silenciosa seria
 * o painel escolhendo por ele sem contar, que é o oposto do que ele pediu.
 *
 * `null` em `cota` quer dizer "ainda não sei", e nesse caso **não se troca
 * nada**: trocar por desconhecimento seria tirar o Claude dele com base em
 * nada.
 */
export function agentePara(pedido, cota, { reserva = 'agy' } = {}) {
  const igual = { agente: pedido, trocou: false, motivo: null }
  /* Só o Claude consome a janela do plano. Os outros dois pagam por fora, então
     não há o que aliviar trocando um pelo outro. */
  if (pedido !== 'claude') return igual
  if (!cota || !ESTADOS_QUE_APERTAM.has(cota.estado)) return igual
  if (!AGENTES_GATE[reserva]) return igual

  const quando = cota.resetaEm ? new Date(cota.resetaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null
  const janela = cota.tipo === 'five_hour' ? 'a janela de 5 horas' : cota.tipo === 'seven_day' ? 'a janela da semana' : 'a janela do plano'
  const fim = cota.estado === 'rejected'
    ? `${janela} estourou`
    : `${janela} está perto do teto`
  return {
    agente: reserva,
    trocou: true,
    motivo: `${fim}, então quem respondeu foi o ${AGENTES_GATE[reserva].rotulo}, que ${AGENTES_GATE[reserva].paga}.${quando ? ` O Claude volta às ${quando}.` : ''}`,
  }
}

/** Continua de pé? Usado pelo conserto na subida do painel. */
export function vivo(pid) {
  if (!Number.isFinite(pid)) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

/** Parar é decisão dele, nunca efeito colateral de trocar de agente. */
export function parar(pid) {
  if (!vivo(pid)) return false
  try { process.kill(pid, 'SIGTERM'); return true } catch { return false }
}
