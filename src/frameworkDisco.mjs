/**
 * A camada de disco do framework. Fica separada de `framework.mjs` de propósito:
 * o motor é puro e testável, este arquivo é o que sabe onde as coisas moram.
 *
 * O estado vive DENTRO do projeto (`.framework/estado.json`), não em
 * `~/.claude`. Motivo medido em 14/08: hook e configuração que moram no home
 * não viajam com o repositório, e aí o PC e a VPS passam a ter opiniões
 * diferentes sobre a fase do mesmo projeto. É a frente "Sincronia entre
 * máquinas" (CC-47 a CC-53) acontecendo de novo, e dá para não repetir.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { acharModo, estadoInicial } from './framework.mjs'
import { linhaEhDaSessao } from './routia.mjs'

export const PASTA = '.framework'
export const ARQUIVO = 'estado.json'

/** Sobe a árvore procurando o projeto com framework ligado. null = desligado,
 *  que é o padrão: opt-in por repositório, igual ao Método Routia. */
export function acharRaiz(dir) {
  let atual = resolve(dir || process.cwd())
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(atual, PASTA, ARQUIVO))) return atual
    const pai = dirname(atual)
    if (pai === atual) return null
    atual = pai
  }
  return null
}

/**
 * CC-116 — o modo pode ser POR SESSÃO, não só por projeto.
 *
 * Pedido dele em 17/08:
 *
 * > "quero poder ter uma sessão de frontend e uma de backend no mesmo projeto
 * > (…) uma no restritivo e outra no sugestivo"
 *
 * O estado do projeto continua sendo um arquivo só. O que a sessão pode ter é
 * uma CAMADA por cima, em `.framework/sessoes/<id>.json`, que hoje sobrepõe
 * só `modo` e `tom` — os dois campos que fazem sentido divergir entre agentes.
 * MVP, critérios e verificação continuam do projeto, porque o "pronto" é um
 * só, não importa quantos agentes trabalhem.
 *
 * A sessão vem do ambiente por padrão, então TODOS os hooks ganham o modo por
 * sessão sem mudar uma linha: eles já chamam `ler(raiz)`.
 */
const idCurto = (s) => String(s || '').slice(0, 8).replace(/[^0-9a-f]/gi, '')

/**
 * CC-123: o modo declarado na ROTA, lido do quadro do Routia.
 *
 * Pedido dele: *"eu posso ta no mesmo projeto fazendo backend e frontend. eu
 * quero dialogar sobre o frontend mas o backend ja tem backlog entao eu posso
 * colocar como restritivo"*. A capa por sessão (CC-116) já resolvia, com um
 * custo: a sessão morre e renasce com outro número, então o modo se perdia a
 * cada reinício e ninguém via pelo quadro quem estava em qual modo.
 *
 * A rota não tem esse problema: ela já declara os arquivos dela (é o que separa
 * front de back sem inventar nome novo), mora no repositório e é visível.
 *
 * Escreve-se na própria linha da rota, junto do resto:
 *
 *     | `front` | 🔴 ocupada | ab5121a0 — telas 🎚 sugestivo 📁 src/ui.html#viewRemoto | hoje |
 *
 * ⚠️ **Só modo de COMPORTAMENTO vale aqui** (tom, ritmo, se pergunta). Modo que
 * tranca escrita continua sendo do projeto: duas travas discordando sobre quem
 * pode escrever num arquivo é o cenário ruim, e é justamente o que o Routia
 * existe para evitar.
 */
export function modoDaRota(raiz, sessao) {
  const marca = idCurto(sessao)
  if (!marca) return null
  let texto = null
  try { texto = readFileSync(join(raiz, 'docs', 'ROTAS-ATIVAS.md'), 'utf8') } catch { return null }
  for (const linha of texto.split(/\r?\n/)) {
    /* `linhaEhDaSessao`, e não `includes`: a linha cita o histórico dela
       inteiro, então uma sessão só CITADA herdava o modo de uma rota que
       nunca teve. Medido em 27/08, e é a causa do CC-362. Ver o comentário
       de `donoDaLinha` em `routia.mjs`, onde a regra mora. */
    if (!linhaEhDaSessao(linha, marca)) continue
    const m = linha.match(/🎚\s*`?([a-zà-ú-]+)`?/i)
    if (!m) continue

    /* Achado em 18/08, e o sintoma era o pior tipo: silencioso e ao contrário.
       O que se escreve na rota é o nome que aparece na tela ("continuativo",
       "autônomo"), não o identificador interno. `modoDe()` não resolve apelido,
       então o modo caía no padrão — que é o LIVRE, o mais permissivo de todos.
       Ou seja: marcar a rota com o nome certo DESLIGAVA as travas, e o quadro
       continuava anunciando o modo como se ele estivesse valendo.

       Duas regras daqui em diante: apelido e título resolvem, e o que não
       resolve não vale nada. Devolver `null` deixa valer o modo do projeto,
       que é a escolha segura; devolver o texto cru era trocar a trava por
       nenhuma sem ninguém ver. */
    const achado = acharModo(m[1])
    if (!achado) continue
    return { modo: achado.id, rota: (linha.match(/`([^`]+)`/) || [])[1] || null }
  }
  return null
}

export function ler(raiz, { sessao = process.env.CLAUDE_CODE_SESSION_ID } = {}) {
  let estado = null
  try {
    estado = JSON.parse(readFileSync(join(raiz, PASTA, ARQUIVO), 'utf8'))
  } catch {
    return null
  }

  const id = idCurto(sessao)
  if (!id) return estado

  /* Três camadas, e a ordem é do menos específico para o mais: projeto, depois
     ROTA (CC-123), depois a capa da sessão (CC-116). A capa vence porque é a
     escolha mais recente e mais deliberada; a rota vence o projeto porque é o
     que separa frontend de backend sem inventar nome novo, e sobrevive ao
     reinício da sessão, que era o furo da capa. */
  /* `_origemModo` responde "de ONDE veio o modo que está valendo", e é a peça
     que faltava para a tela poder contar. Sem ela havia só `_rota`, que ficava
     na resposta mesmo quando a capa da sessão vencia depois: a origem dizia
     rota e quem decidia era a capa. Era duas verdades dentro do mesmo objeto,
     o defeito que este arquivo já tinha pago duas vezes (ver `vigente()` em
     `framework.mjs`). Agora quem escreve o modo escreve a origem junto, na
     mesma linha, e não há como uma andar sem a outra. */
  let saida = estado
  let origem = 'projeto'
  let rota = null
  const daRota = modoDaRota(raiz, sessao)
  if (daRota?.modo) {
    saida = { ...saida, modo: daRota.modo }
    origem = 'rota'
    rota = daRota.rota
  }

  let capa = null
  try {
    capa = JSON.parse(readFileSync(join(raiz, PASTA, 'sessoes', `${id}.json`), 'utf8'))
  } catch { /* sessão sem capa é o normal: só existe quando alguém escolheu */ }

  if (capa?.modo || capa?.tom) {
    /* Só os campos de comportamento. Se a capa pudesse sobrepor `ligado` ou o
       MVP, uma sessão desligaria o framework das outras sem ninguém ver. */
    saida = {
      ...saida,
      ...(capa.modo ? { modo: capa.modo } : {}),
      ...(capa.tom ? { tom: capa.tom } : {}),
    }
    if (capa.modo) { origem = 'sessao'; rota = null }
  }

  return { ...saida, _sessao: id, _origemModo: origem, ...(rota ? { _rota: rota } : {}) }
}

/** De onde veio o modo que está valendo, em português, para a tela. Recebe o
 *  que `ler()` devolveu. */
export function origemDoModo(estado) {
  const de = estado?._origemModo || 'projeto'
  if (de === 'rota') return { de, texto: `da rota \`${estado._rota}\`, marcada por você no quadro` }
  if (de === 'sessao') return { de, texto: 'desta sessão, escolhido só para ela' }
  return { de, texto: 'do projeto, valendo para todas as sessões' }
}

/** Grava a capa de uma sessão: só modo e tom, nada além. */
export function gravarSessao(raiz, sessao, { modo = null, tom = null } = {}) {
  const id = idCurto(sessao)
  if (!id) return { ok: false, erro: 'sem identidade de sessão' }
  const dir = join(raiz, PASTA, 'sessoes')
  mkdirSync(dir, { recursive: true })
  const arquivo = join(dir, `${id}.json`)
  const atual = (() => { try { return JSON.parse(readFileSync(arquivo, 'utf8')) } catch { return {} } })()
  const capa = { ...atual, ...(modo ? { modo } : {}), ...(tom ? { tom } : {}) }
  const tmp = `${arquivo}.tmp`
  writeFileSync(tmp, JSON.stringify(capa, null, 2))
  renameSync(tmp, arquivo)
  return { ok: true, arquivo, capa }
}

/** Escrita atômica (tmp + rename), a mesma regra do `meta.json`: leitor
 *  concorrente nunca pode pegar arquivo pela metade. */
export function gravar(raiz, estado) {
  const pasta = join(raiz, PASTA)
  mkdirSync(pasta, { recursive: true })
  const alvo = join(pasta, ARQUIVO)

  /* Se o estado veio de `ler()` com alguma camada por cima, o `modo` e o `tom`
     dele são DA SESSÃO ou DA ROTA, e regravá-los aqui promoveria a escolha de um
     agente a escolha do projeto, em silêncio. Restaura os dois do arquivo cru
     antes de escrever; mudança de sessão passa por `gravarSessao`, nunca daqui.

     ⚠️ **Todo campo derivado sai, e a regra é o prefixo `_`, não a lista.**
     A versão anterior apagava só `_sessao`, e `_rota` (nascido depois) passou
     direto: em 27/08 o `estado.json` deste projeto estava com `_rota:
     "sistemas"` GRAVADO, de uma rota fechada no dia anterior. O caminho é o
     `cc framework autorizar`, que faz `gravar(ler())`: ler injeta a origem,
     gravar persistia junto. O efeito é o pior tipo para o CC-362: toda sessão
     SEM rota nenhuma passava a receber uma origem de volta, e uma tela que
     mostre de onde veio o modo mentiria com confiança. Campo derivado que vira
     dado é indistinguível de dado de verdade na leitura seguinte. */
  let limpo = estado
  const derivados = estado ? Object.keys(estado).filter((k) => k.startsWith('_')) : []
  if (derivados.length) {
    limpo = { ...estado }
    for (const k of derivados) delete limpo[k]
    try {
      const cru = JSON.parse(readFileSync(alvo, 'utf8'))
      if ('modo' in cru) limpo.modo = cru.modo; else delete limpo.modo
      if ('tom' in cru) limpo.tom = cru.tom; else delete limpo.tom
    } catch { /* sem arquivo cru: primeiro grava, nada a restaurar */ }
  }

  const tmp = `${alvo}.tmp`
  writeFileSync(tmp, JSON.stringify(limpo, null, 1) + '\n', 'utf8')
  renameSync(tmp, alvo)
  return alvo
}

/** Liga o framework num projeto. Não sobrescreve estado existente: religar por
 *  engano não pode apagar o MVP e o histórico de escopo de ninguém. */
export function iniciar(raiz, metodo = 'mvp-basico') {
  const jaTem = ler(raiz)
  if (jaTem) return { ok: false, erro: 'este projeto já tem framework ligado', estado: jaTem }
  const estado = estadoInicial(metodo)
  gravar(raiz, estado)
  return { ok: true, estado }
}

/**
 * O que o botão do painel chama. Liga, e liga de novo o que estava desligado,
 * sem tocar no MVP nem no histórico.
 *
 * `ligado` ausente conta como ligado: é o formato que o `iniciar()` gravava
 * antes deste campo existir, e estado antigo não pode virar projeto destravado
 * de surpresa.
 */
export function ligar(raiz, metodo = 'mvp-basico') {
  const atual = ler(raiz)
  if (!atual) return { ...iniciar(raiz, metodo), criou: true }
  const estado = { ...atual, ligado: true }
  gravar(raiz, estado)
  return { ok: true, estado, criou: false }
}

/** Desliga preservando tudo. Apagar de vez é apagar a pasta `.framework`, e
 *  isso o painel não faz: destruir dado do projeto não pode ser um clique. */
export function desligar(raiz) {
  const atual = ler(raiz)
  if (!atual) return { ok: false, erro: 'este projeto não tem framework' }
  const estado = { ...atual, ligado: false }
  gravar(raiz, estado)
  return { ok: true, estado }
}

/**
 * CC-383, 28/08: o backlog da entrevista entra no `docs/ROADMAP.md`.
 *
 * ⚠️ **ACRESCENTA, nunca sobrescreve, e a diferença aqui é destruição de
 * trabalho.** O roadmap é o arquivo mais caro de cada projeto dele: são meses
 * de decisão escrita à mão. Gravar o conteúdo novo por cima apagaria tudo, e
 * apagaria calado, porque ninguém relê um roadmap logo depois de mexer nele.
 *
 * Duas defesas, e as duas importam:
 *
 * 1. o texto vai para o FIM do arquivo, depois do que já está lá;
 * 2. **não entra duas vezes.** A entrevista pode ser refeita, e cada volta
 *    geraria outro bloco idêntico. A marca é o título com a data, que é o que
 *    identifica aquela entrevista.
 *
 * Sem arquivo, cria um com cabeçalho mínimo: projeto pode ter nascido fora do
 * botão de criar, e recusar por isso seria empurrar o problema para ele.
 */
export function gravarBacklog(raiz, texto, { titulo = null } = {}) {
  if (!texto || !String(texto).trim()) return { ok: false, erro: 'nada a escrever' }
  const alvo = join(raiz, 'docs', 'ROADMAP.md')

  let atual = ''
  let existia = true
  try { atual = readFileSync(alvo, 'utf8') } catch { existia = false }

  /* A marca de já-escrito é a primeira linha do bloco, que carrega a data. Se
     ela já está no arquivo, este backlog já entrou e não entra de novo. */
  const marca = titulo || String(texto).split(/\r?\n/).find((l) => l.startsWith('## '))
  if (marca && atual.includes(marca.trim())) {
    return { ok: false, erro: 'este backlog já está no roadmap', jaEstava: true, arquivo: alvo }
  }

  const cabeca = existia ? '' : [
    '---',
    'tipo: roadmap',
    'resumo: Só o que está aberto. Concluído sai daqui e vira linha no diário.',
    '---',
    '',
    '# ROADMAP',
    '',
    'Só o que está **aberto**. Concluído sai daqui e vira linha no diário.',
    '',
    '---',
    '',
  ].join('\n')

  /* Separador só quando há o que separar, e uma linha em branco garantida
     entre o que havia e o que entra: markdown cola cabeçalho na linha de cima
     e o parser passa a ler os dois como um. */
  const meio = existia && atual.trim() ? `${atual.replace(/\s*$/, '')}\n\n---\n\n` : cabeca
  const conteudo = `${meio}${String(texto).replace(/\s*$/, '')}\n`

  mkdirSync(dirname(alvo), { recursive: true })
  const tmp = `${alvo}.tmp`
  writeFileSync(tmp, conteudo, 'utf8')
  renameSync(tmp, alvo)

  /* Quantos itens foram MESMO escritos, contados do texto que acabou de entrar
     no arquivo. É este número que o portão da fase de planejamento lê, e por
     isso ele não pode vir da entrevista: ali seria o que se pretendia escrever,
     e aqui é o que está no disco. A diferença aparece quando a gravação falha
     pela metade. */
  const itens = (String(texto).match(/^###\s+/gm) || []).length
  return { ok: true, arquivo: alvo, criou: !existia, itens, bytesAntes: atual.length, bytesDepois: conteudo.length }
}

/**
 * CC-385, 28/08: fechar a sprint devolve à fila o que não coube.
 *
 * Palavras dele ao escolher o que "sprint" quer dizer: *"o que não coube volta
 * para a fila"*.
 *
 * ⚠️ **Este é o passo em que trabalho some, se for feito calado.** Uma sprint
 * que termina e é apagada leva junto tudo o que não foi feito, e ninguém
 * percebe: o item não estava fechado, e some do arquivo como se estivesse.
 *
 * Por isso o que sai daqui NÃO é uma limpeza:
 *
 * - o título da sprint ganha a marca de encerrada, com o placar do que foi
 *   feito. Sprint fechada continua legível, e é o histórico dele;
 * - os itens ABERTOS são movidos para uma seção de fila, com uma linha dizendo
 *   de onde vieram. Nada é apagado, nada muda de estado;
 * - o que estava feito fica na sprint, que é onde ele conta a história.
 *
 * Devolve o texto novo e o que mudou, sem gravar: quem grava confere primeiro.
 */
export function fecharSprint(texto, tituloDaSprint, { quando = null } = {}) {
  const linhas = String(texto || '').split(/\r?\n/)
  const dia = String(quando || new Date().toISOString()).slice(0, 10)

  /* Onde a sprint começa e onde ela acaba: do `##` dela até o próximo `##`. */
  const inicio = linhas.findIndex((l) => /^##\s+(?!#)/.test(l) && l.includes(tituloDaSprint))
  if (inicio < 0) return { ok: false, erro: 'não achei essa sprint no roadmap' }
  let fim = linhas.length
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (/^##\s+(?!#)/.test(linhas[i])) { fim = i; break }
  }

  /* Cada item da sprint, com o bloco de texto dele inteiro. Cortar o corpo
     junto é o que permite mover o item sem perder a explicação. */
  const dentro = linhas.slice(inicio + 1, fim)
  const itens = []
  let atual = null
  for (const l of dentro) {
    if (/^###\s+(?!#)/.test(l)) {
      if (atual) itens.push(atual)
      atual = { titulo: l, corpo: [] }
    } else if (atual) atual.corpo.push(l)
  }
  if (atual) itens.push(atual)

  const feito = (it) => /✅|✔/u.test(it.titulo)
  const fechados = itens.filter(feito)
  const abertos = itens.filter((it) => !feito(it))

  const cabecaNova = `${linhas[inicio].replace(/\s*$/, '')} 🏁 encerrada em ${dia.slice(8, 10)}/${dia.slice(5, 7)}`
    + ` (${fechados.length} de ${itens.length})`

  const corpoDaSprint = [cabecaNova, '']
  if (!itens.length) corpoDaSprint.push('Nenhum item entrou nesta sprint.', '')
  for (const it of fechados) corpoDaSprint.push(it.titulo, ...it.corpo)
  if (abertos.length) {
    corpoDaSprint.push(
      `**${abertos.length} item(ns) não couberam e voltaram para a fila**, na seção logo abaixo.`,
      '',
    )
  }

  const filaNova = abertos.length ? [
    `## ▶ De volta à fila, da ${tituloDaSprint}`,
    '',
    'Estes itens estavam na sprint que fechou e não foram concluídos. Nada aqui',
    'foi apagado nem marcado: eles voltam abertos, como estavam.',
    '',
    ...abertos.flatMap((it) => [it.titulo, ...it.corpo]),
  ] : []

  const saida = [
    ...linhas.slice(0, inicio),
    ...corpoDaSprint,
    ...filaNova,
    ...(filaNova.length ? [''] : []),
    ...linhas.slice(fim),
  ]

  return {
    ok: true,
    texto: saida.join('\n').replace(/\n{4,}/g, '\n\n\n'),
    fechados: fechados.length,
    devolvidos: abertos.length,
    total: itens.length,
  }
}

/** Retrato para a tela: existe? está ligado? em que fase? o que falta? */
export function situacao(raiz) {
  const estado = raiz ? ler(raiz) : null
  if (!estado) return { existe: false, ligado: false }
  return { existe: true, ligado: estado.ligado !== false, estado }
}
