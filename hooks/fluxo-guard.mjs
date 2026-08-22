#!/usr/bin/env node
/**
 * A trava de execução contínua do modo restritivo.
 *
 * ## Duas versões, e por que a primeira estava errada
 *
 * A primeira versão, escrita em 16/08, só disparava quando eu **prometia**
 * continuar ("sigo", "continuo pelo que sobrou") e não continuava. Ele apontou o
 * furo no mesmo dia:
 *
 * > "um gate parece permissivo demais e o restritivo deveria ter foco contínuo
 * > em execução do backlog"
 *
 * Está certo, e o buraco é literal: **parar calado passava.** Que é justamente o
 * comportamento que a queixa original nomeia, eu paro, ele acha que o trabalho
 * segue, e descobre depois que não seguiu.
 *
 * ## A inversão
 *
 * Antes: continuar era o padrão, e parar precisava de promessa quebrada para ser
 * pego. Agora: **com backlog aberto, parar é a exceção, e a exceção tem que ser
 * declarada.** Nada de deduzir intenção do texto.
 *
 * ## As quatro saídas legítimas, em ordem de precedência
 *
 * 1. **Ele perguntou algo** (a mensagem dele termina em `?`). Responder É a
 *    entrega; empurrar backlog em cima de uma pergunta é não escutar.
 * 2. **`AskUserQuestion` foi usado no turno.** Parada legítima por definição:
 *    a bola está com ele.
 * 3. **Parada declarada**: uma linha começando com `Parada:` e o motivo. É o
 *    "gosto, prioridade entre frentes, risco que ele assume" do próprio modo.
 * 4. **Backlog zerado.** Nada a empurrar.
 *
 * ## Por que uma volta só, e não até zerar
 *
 * `stop_hook_active` limita a um empurrão por turno. Ignorar isso criaria um
 * laço que executa o backlog inteiro sem ele conseguir entrar no meio, e a
 * regra dele é a oposta, ele confere cada entrega. Uma volta basta: o efeito é
 * que eu nunca paro sem ter continuado ou dito por que parei.
 *
 * Falha ABERTA em tudo: erro aqui não pode travar o fim do turno.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança ERR_UNSUPPORTED_ESM_URL_SCHEME, e como quase toda chamada aqui
   está dentro de um `.catch`, o módulo some sem erro visível: foi assim que
   o interruptor de módulos deixou de valer em 31 hooks, sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('fluxo-guard')) sair()

const D = await import(urlDeModulo(AQUI, '../src/frameworkDisco.mjs')).catch(() => null)
const F = await import(urlDeModulo(AQUI, '../src/framework.mjs')).catch(() => null)
if (!D || !F) sair()

const raiz = D.acharRaiz(dados?.cwd || process.cwd())
if (!raiz) sair()

const estado = D.ler(raiz)
if (!estado || estado.ligado === false) sair()

const modo = F.modoDe(estado)
if (!modo?.fluxo) sair() // só onde o combinado é executar em sequência

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let cauda = ''
try { cauda = readFileSync(arquivo, 'utf8').slice(-160_000) } catch { sair() }

/* Delimita o turno: tudo depois da última mensagem de gente. */
const corte = cauda.lastIndexOf('"type":"user"')
const turno = corte >= 0 ? cauda.slice(corte) : cauda

/* 0. o turno é uma ROTINA que termina esperando por ele, ver `rotinaQuePausa` */
const pausa = rotinaQuePausa(turno, dados?.cwd || process.cwd(), raiz)
if (pausa) sair()

/* 2. a caixa de pergunta foi usada, a bola está com ele */
if (turno.includes('AskUserQuestion')) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

/* 1. ele perguntou: responder é a entrega */
const pedido = ultimoPedido(cauda)
if (pedido && /\?\s*$/.test(pedido.trim())) sair()

/* 3. parada declarada, com motivo */
const resposta = E.ultimaResposta(arquivo) || ''
if (/^\s*(\*\*)?Parada:/im.test(resposta)) sair()

/* 4. backlog: os itens do ROADMAP sem a marca de concluído, tirando os que
      estão com OUTRA sessão. Ver `deOutraRota`. */
const RT = await import(urlDeModulo(AQUI, '../src/routia.mjs')).catch(() => null)
const abertos = backlogAberto(raiz)
  .filter((t) => !(RT?.deOutraSessao?.(t, raiz, dados?.session_id)))
if (!abertos.length) sair()

console.error(
  `PAROU COM ${abertos.length} ITENS ABERTOS, no modo ${modo.titulo}.\n\n`
  + `Não pare para: ${modo.naoPara || modo.fluxo.naoPara}.\n`
  + `Só pare para: ${modo.fluxo.paradaLegitima}.\n\n`
  + 'Próximos na fila:\n'
  + abertos.slice(0, 3).map((t) => `  · ${t}`).join('\n')
  + '\n\nDuas saídas, e só estas duas:\n\n'
  + '  1. EXECUTE agora o próximo item, sem anunciar que vai executar. Anúncio\n'
  + '     não é execução: o turno acaba quando você para de chamar ferramenta.\n'
  + '  2. Ou abra a resposta com uma linha "Parada: <motivo>". O motivo tem\n'
  + '     que ser decisão dele, não dúvida técnica sua. Dúvida técnica você\n'
  + '     resolve e reporta. Se for decisão dele mesmo, use o AskUserQuestion.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)

/**
 * A quinta saída legítima, e ela nasceu de um erro meu, em 18/08.
 *
 * Ele digitou `/start-session`, que é a rotina de abertura e termina dizendo,
 * com todas as letras, *"aguarde instrução do usuário para começar a
 * trabalhar"*. Eu apresentei o resumo e parei, que é exatamente o combinado. A
 * trava me devolveu com "PAROU COM 16 ITENS ABERTOS" e eu fui programar. A
 * queixa dele:
 *
 * > *"eu só dei start session e você começou a programar, era pra você de
 * > repente trazer um resumo da onde a gente parou (…) é um fato que não era
 * > pra ter feito"*
 *
 * A causa é literal: `ultimoPedido()` descarta qualquer mensagem que comece com
 * `<`, e a invocação de uma rotina chega ao transcript exatamente assim
 * (`<command-message>…</command-message>`). Então a trava não via pedido
 * nenhum, não via pergunta, não via parada declarada, e cobrava.
 *
 * O conserto **não é uma lista de rotinas escrita aqui dentro**, de propósito:
 * lista aqui envelhece calada quando alguém cria uma rotina nova, e o defeito
 * volta sem aviso. Quem manda é a própria rotina, se o texto dela declara que
 * termina esperando, a trava obedece. A rotina é a fonte, este arquivo só lê.
 *
 * Duas formas de declarar, e a segunda é a rede para as que já existem:
 *
 * 1. `pausa-no-fim: true` no cabeçalho da rotina, que é explícito e não depende
 *    de como a frase foi escrita;
 * 2. a frase em português mesmo ("aguarde instrução do usuário", "aguarde
 *    aprovação"), que é como as 25 rotinas de hoje já dizem isso.
 *
 * E vale a regra do projeto: **a cópia dentro do projeto vence a global**, a
 * mesma coisa que o `rotinas.mjs` já mede, senão a trava leria uma rotina e o
 * Claude Code executaria outra.
 */
function rotinaQuePausa(turnoTexto, cwd, raizProjeto) {
  const m = /<command-name>\/?([a-z0-9:_-]+)<\/command-name>/i.exec(turnoTexto)
  if (!m) return null
  const nome = m[1].toLowerCase()

  const casa = process.env.CC_HOME || process.env.HOME || process.env.USERPROFILE || ''
  const candidatos = [
    join(raizProjeto, '.claude', 'commands', `${nome}.md`),
    join(cwd, '.claude', 'commands', `${nome}.md`),
    casa ? join(casa, '.claude', 'commands', `${nome}.md`) : null,
  ].filter(Boolean)

  for (const caminho of candidatos) {
    let md = ''
    try { md = readFileSync(caminho, 'utf8') } catch { continue }
    const declarado = /^\s*pausa-no-fim\s*:\s*(true|sim)\s*$/im.test(md)
    const naFrase = /aguard\w*\s+(?:a\s+|o\s+|as\s+|os\s+)?(?:instru|aprova|confirma|resposta|retorno|orienta|autoriza)/i.test(md)
    return (declarado || naFrase) ? { nome, caminho } : null // a primeira que existe é a que vale
  }
  return null
}

/** A última coisa que uma PESSOA escreveu, injeção de skill e saída de tool não contam. */
function ultimoPedido(texto) {
  const linhas = texto.split('\n')
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    let l = null
    try { l = JSON.parse(linhas[i]) } catch { continue }
    if (l?.type !== 'user' || l?.isMeta || l?.toolUseResult) continue
    const c = l?.message?.content
    const t = typeof c === 'string'
      ? c
      : Array.isArray(c) ? c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n') : ''
    if (t && !t.startsWith('<')) return t
  }
  return null
}

/**
 * Itens abertos E EXECUTÁVEIS do ROADMAP.
 *
 * O `roadmap.mjs` não serve aqui: ele lê o formato de frentes com `## Aberto`, e
 * este arquivo usa `### CC-NN`. Contar o que não tem ✅ é grosseiro de propósito
 *, o hook precisa de "sobrou trabalho", não do mapa inteiro.
 *
 * ## Os dois marcadores, e por que ⏸ precisou existir
 *
 * `✅` é feito. `⏸` é **aberto e parado por motivo que não depende de mim**,
 * direção em vez de tarefa, dependência de outro item, ambiente que não existe,
 * ou decisão que só o Felipe toma.
 *
 * Sem essa distinção o hook me devolvia com "6 itens abertos" quando nenhum dos
 * seis era executável, e a única saída seria declarar parada toda vez. Guarda
 * que cobra o impossível ensina a ignorá-lo, e aí ele não segura mais o caso
 * real, que é justamente o que ele existe para pegar.
 *
 * O motivo vai no próprio título, depois do ⏸, para a lista da devolução ser
 * legível sem abrir o arquivo.
 */
/* Achado em 18/08: o título de uma frente vem hoje como "### CC-101 Frente:
   ...", com o número ANTES da palavra. A exclusão só casava "### Frente:" sem
   número, então "CC-101 Frente", "CC-102 Frente" e "CC-104 Frente", todas
   sem próximo passo executável, todas já registradas como estudo ou visão,
   voltavam pra fila do mesmo jeito que um item comum sem ✅. O prefixo
   `(?:CC-\d+\s+)?` deixa o número opcional antes da palavra que classifica. */
/**
 * Os itens do backlog que ainda não foram fechados.
 *
 * **Item de backlog tem código.** Todo item deste projeto nasce como
 * `### CC-nnn …`, e a exigência do código não é formalidade: sem ela, qualquer
 * título de seção contava como tarefa. Ele achou isso em 20/08, com o backlog
 * já zerado, perguntando *"o guarda ve coisas abertas de resposta anterior…
 * mas e ai? precisamos resolve-las? ou nao?"*.
 *
 * Eram sete, e nenhuma era tarefa: "O que falta", "A ordem de migração, por
 * valor para ele", "O estado das 24 telas, medido em 20/08". Títulos do texto
 * que explica a frente, cobrados como se fossem trabalho pendente.
 *
 * O custo do defeito é pior que o barulho: a trava que existe para eu não
 * parar no meio do trabalho passou a cobrar trabalho que não existe, e a
 * primeira coisa que se aprende com uma cobrança falsa é a ignorá-la.
 */
/**
 * O item está com OUTRA sessão? Então não é trabalho meu, e cobrar é errado.
 *
 * ## O que motivou, em 21/08
 *
 * Ele abriu uma segunda sessão só para tela, e o quadro do Método Routia passou
 * a rota `front` para ela, com o CC-156 e o CC-235 dentro. Deste lado o hook
 * continuou cobrando os dois a cada parada: os únicos itens abertos do backlog
 * eram justamente os que eu não posso tocar sem pisar no dono da rota.
 *
 * É exatamente o defeito que o comentário do `⏸` acima descreve, agora por
 * outro caminho: **guarda que cobra o impossível ensina a ser ignorado**, e aí
 * ele não segura mais o caso real.
 *
 * ## Por que o quadro de rotas, e não uma marca no título
 *
 * Marcar o item como "não é seu" no ROADMAP seria uma segunda verdade sobre
 * posse, e ela envelhece sozinha: a rota muda de dono e o título fica mentindo.
 * O quadro já é a fonte de quem segura o quê, e é lido no começo de toda sessão.
 * Derivar dele é a mesma escolha que o resto do projeto faz.
 *
 * Rota MINHA continua cobrando, de propósito: o que eu mesmo reservei é
 * trabalho meu, e não poder ser cobrado por ele seria o furo ao contrário.
 */
/* A conta mora em `src/routia.mjs` (`deOutraSessao`), e não aqui, para o gate
   poder medi-la: hook não é importável, e regra que o gate não enxerga é regra
   que volta a quebrar calada. */
function backlogAberto(raizProjeto) {
  let md = ''
  try { md = readFileSync(join(raizProjeto, 'docs', 'ROADMAP.md'), 'utf8') } catch { return [] }
  return md.split(/\r?\n/)
    .filter((l) => /^###\s+CC-\d+/i.test(l)
      && !l.includes('✅')
      && !l.includes('⏸')
      && !/^###\s*(?:CC-\d+\s+)?(Frente|Visão|Decis)/i.test(l))
    .map((l) => l.replace(/^###\s*/, '').trim())
}
