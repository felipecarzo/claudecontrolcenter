// O mapa do projeto, lido do ROADMAP.md que já existe.
//
// Por que existe: o cartão do agente dizia "Pierre: travessia gamificada na
// leitura das clausulas" e o Felipe não reconhecia o que era — embora "Pierre"
// seja uma seção do roadmap do próprio inovallbond. O painel mostrava a folha
// sem a árvore. Aqui se lê a árvore.
//
// Uma fonte só, de propósito: o arquivo que ele e os agentes já editam. Nada
// de banco paralelo que envelhece sozinho.
//
// O parser é deliberadamente tolerante — são 43 roadmaps, escritos ao longo de
// meses, sem formato combinado. Vale o que o Markdown já diz: `##` agrupa,
// `###` é a frente de trabalho, item de lista é tarefa.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ehWindows } from './platform.mjs'

const CAMINHOS = [['docs', 'ROADMAP.md'], ['ROADMAP.md'], ['docs', 'roadmap.md'], ['ROADMAP.MD']]

/**
 * Caminho de OUTRA máquina, que não se pode ler aqui.
 *
 * A federação traz o `cwd` dos agentes do PC dele, e ele vem no formato do
 * Windows: `D:\Documentos\Ti\projetos\CLIENTS\renanMarchon`. No Linux isso não
 * é caminho absoluto, é um NOME DE PASTA com barras invertidas dentro, e tudo
 * o que se faz com ele passa a ser relativo à pasta onde o painel roda.
 *
 * No Windows a marca é o normal da casa: todo cwd local tem `C:\` e barra
 * invertida. Achado em 25/08 rodando `npm test` no PC — `acharRoadmap` não
 * achava nem o roadmap do próprio projeto, cwd real, sem federação nenhuma no
 * meio. A guarda só faz sentido em quem NÃO É Windows.
 */
export const deOutraPlataforma = (p) => {
  if (ehWindows) return false
  const s = String(p || '')
  /* A marca conta em QUALQUER posição, não só no começo, e isso não é excesso
     de zelo: a sessão do Coderoom mediu o caso misto em 22/08, quando um
     `path.resolve` cola o caminho do Windows depois de uma pasta daqui.
       /home/claudedev/projetos/proj_controlcenter/D:\Documentos\…\renanMarchon
     Esse caminho É absoluto, passava pela primeira versão desta guarda, e
     `acharRoadmap` subia um nível e entregava o roadmap DO PAINEL. Na tela isso
     virou 145 tarefas alheias; dentro do pacote de contexto de um agente, o
     mesmo vazamento fica invisível.
     Barra invertida em nome de pasta é legal no Linux e praticamente não
     existe: recusar é mais barato que o defeito que ela esconde. */
  return /[A-Za-z]:[\\/]/.test(s) || s.includes('\\')
}

/**
 * Sobe do diretório de trabalho até achar um roadmap. `null` se não houver.
 *
 * **Recusa caminho que não é desta máquina, e o motivo é um defeito medido em
 * 22/08.** Com `D:\…\renanMarchon`, `path.dirname` sobe direto para `.` na
 * primeira volta, e a busca encontrava `docs/ROADMAP.md` do PRÓPRIO PAINEL.
 * Resultado: cinco projetos do PC dele apareciam na tela Trabalho com os mesmos
 * 6 cartões e as mesmas 145 tarefas fechadas, que eram do proj_controlcenter.
 * Nenhum erro, nenhum aviso, e um backlog inteiro atribuído a quem não é dono.
 *
 * Caminho relativo legítimo continua funcionando: a recusa é só para o que
 * carrega marca de outro sistema operacional.
 */
export function acharRoadmap(cwd) {
  if (deOutraPlataforma(cwd)) return null
  let dir = cwd
  for (let i = 0; i < 8 && dir; i++) {
    for (const partes of CAMINHOS) {
      const alvo = path.join(dir, ...partes)
      try { if (fs.statSync(alvo).isFile()) return alvo } catch { /* segue */ }
    }
    const pai = path.dirname(dir)
    if (pai === dir) break
    dir = pai
  }
  return null
}

/**
 * Emoji e palavra viram o mesmo estado: os roadmaps usam ora um, ora outro.
 *
 * **Mas as duas não valem no mesmo lugar, e é isso que o CC-46 consertou.**
 * Emoji é marcador inequívoco: ninguém escreve ✅ no meio de uma frase sem
 * querer dizer "feito". Palavra é ambígua, e testá-la contra o título inteiro
 * dava falso positivo em cima do assunto da tarefa:
 *
 *   "CC-23 — Histórico rico"        virava FEITO      (por "histórico")
 *   "CC-04 — ...agente travado..."  virava BLOQUEADO  (por "travado")
 *
 * Nos dois casos a palavra descreve **o que a tarefa é**, não em que pé ela
 * está. Por isso a palavra só conta na ETIQUETA do título: o pedaço antes do
 * primeiro travessão ou dois-pontos, depois de tirar o identificador
 * (`CC-46`, `F16.`, `3)`). É onde o estado é escrito quando é escrito.
 *
 * **Quando os dois se contradizem, o emoji ganha.** Achado ao varrer os 14
 * roadmaps: o inovallbond tem `🟡 Bloqueado — depende do Felipe`, e antes ele
 * saía vermelho no painel enquanto o arquivo mostrava amarelo. Escolher 🟡 e
 * não 🔴 é deliberado, e "depende de alguém" é esperar, não estar impedido. Foi
 * a única mudança de estado em 83 títulos reais, e é para melhor.
 */
const ESTADOS = [
  /* ⚠️ **FEITO vem primeiro, e a ordem é a regra.** `find` devolve o primeiro
     que casa, então quem está no topo vence.
     Achado em 28/08, ao ensinar o leitor a entender `🔒`: o item
     `### CC-146 ✅ 18/08 ... 🔒 só ele` passou a ser lido como BLOQUEADO,
     porque o cadeado casava antes do visto. Um item concluído em 18/08 voltou
     a ser trabalho aberto, dez dias depois, sem ninguém tocar no arquivo.
     Concluído é estado TERMINAL: um item feito que cita um cadeado, uma pausa
     ou uma cor no título continua feito. Marcador novo entra abaixo desta
     linha, nunca acima. */
  { chave: 'feito', emoji: /✅|✔/u, palavra: /conclu[íi]d|entregue|hist[óo]rico|feito/i },
  { chave: 'bloqueado', emoji: /🔴|⛔|🔒/u, palavra: /bloquead|travad|impedid/i },
  /* ⏸ nasceu em 16/08 e é diferente de "esperando" por um detalhe que decide:
     ele diz que o item está aberto e parado por motivo que NÃO depende do
     agente — direção em vez de tarefa, decisão dele, ou ambiente que não
     existe. Sem essa chave o `fluxo-guard` cobrava seis itens impossíveis, e
     guarda que cobra o impossível ensina a ser ignorado. */
  { chave: 'esperando', emoji: /⏸|🟡|⏳/u, palavra: /aguardand|depende d[eao]\s+(?!mim)|decis[ãa]o d(o|ele)|dire[çc][ãa]o/i },
  /* 🏗️ entrou em 28/08 com a leitura de tabela: o roadmap do carzo usa esse
     marcador para "em progresso", que é um item ABERTO com alguém dentro. */
  { chave: 'aberto', emoji: /🟢|🏗/u, palavra: /aberto|agora|pr[óo]xim|fazer/i },
]

/** `CC-46 — casa por regex solto` → `casa por regex solto` → `` (etiqueta vazia).
 *  O identificador sai primeiro porque ele contém hífen: cortar no primeiro
 *  separador sem tirá-lo deixaria só "CC". */
const etiquetaDe = (titulo) => String(titulo)
  .replace(/^\s*(?:[A-Za-z]{1,4}-?\d+[.:)]?|\d+[.)])\s*/, '')
  .split(/[—–:·]|\s-\s/)[0]

const estadoDe = (titulo) => {
  const porEmoji = ESTADOS.find((e) => e.emoji.test(titulo))
  if (porEmoji) return porEmoji.chave
  const etiqueta = etiquetaDe(titulo)
  return ESTADOS.find((e) => e.palavra.test(etiqueta))?.chave || 'aberto'
}

/** `## 🔴 Bloqueado — só o Felipe destrava` → `Bloqueado — só o Felipe destrava` */
const limpar = (s) => s
  .replace(/^#+\s*/, '')
  .replace(/`[^`]*`/g, '')             // tags tipo `#pierre`
  /* CC-236: a lista era fechada, então marcador novo VAZAVA para o cartão. Ele
     mandou print com "▶ LIBERADO para construir em 21/08" dentro do cartão do
     backlog, e o `▶` era meu, escrito no título horas antes. Agora entram os
     marcadores de execução e os sinais de lista que aparecem em título. */
  .replace(/[🔴🟡🟢🔵⚪⚫🔥✅✔☑⛔⏳📌⏸▶►▸➤⏭🚧🆕⭐]/gu, '')
  .replace(/\s+/g, ' ')
  .trim()

/**
 * As palavras DELE dentro de um item, quando existirem.
 *
 * Pedido em 15/08, olhando o mapa do roadmap no celular: *"cada uma delas pode
 * conter o trecho da conversa onde eu te pedi, pra eu lembrar exatamente o que
 * eu quis dizer (…) ali eu posso identificar se você entendeu o que eu falei de
 * fato"*.
 *
 * São **duas funções numa**: ele relembra o que quis dizer, e confere se a
 * tradução que eu fiz bate com o pedido. A segunda é a que importa mais, e é
 * a única forma barata de pegar um mal-entendido antes de virar código.
 *
 * A convenção já existia sem nome: 9 dos 32 itens do ROADMAP hoje trazem uma
 * citação, ora como bloco `>`, ora em itálico. As duas formas contam.
 */
export function citacaoDe(corpo = []) {
  /* Só o começo do item, e o motivo custou um defeito visível.

     Em 17/08 o cartão da Sincronia entre máquinas mostrava uma fala dele sobre
     a Bancada. Dois cabeçalhos tinham sido rebaixados de `###` para `####` no
     mesmo dia, para sairem da lista, e o texto deles passou a ser absorvido
     pelo item de cima — a citação veio de 40 linhas adiante, sobre outro
     assunto.

     Cortar no primeiro `####` seria pior: subseção DENTRO do item é legítima e
     comum aqui. O corte por distância acerta os dois casos, porque a citação
     que resume um item mora no começo dele. */
  const texto = corpo.slice(0, 25).join('\n')

  const bloco = texto.match(/^>\s*[*_"“]*(.+?)[*_"”]*\s*$/m)
  if (bloco && bloco[1].length > 20) return bloco[1].trim()

  // itálico entre aspas, o formato usado no meio de parágrafo
  const solto = texto.match(/\*"([^"]{20,400})"\*/)
  if (solto) return solto[1].replace(/\s+/g, ' ').trim()

  return null
}

/**
 * Quanto aquele item pesa, de 1 a 3.
 *
 * Queixa dele no mesmo dia: *"está tudo empilhado como se fosse só pequenas
 * tarefas, e não é bem isso"*. Sem peso, o mapa dá a mesma altura para uma
 * frente inteira e para um conserto de regex.
 *
 * O peso é **derivado, nunca digitado**: frente com muitos itens pesa mais que
 * item solto; item que traz as palavras dele pesa mais que item que eu inventei
 * sozinho; e o que já está feito pesa menos, porque não pede mais decisão.
 */
export function pesoDe(f) {
  if (f.estado === 'feito') return 1
  let p = 1
  if (/^frente[:\s]/i.test(f.titulo)) p += 1
  if (f.itens >= 4) p += 1
  if (f.citacao) p += 1
  if (f.estado === 'bloqueado') p += 1
  return Math.min(3, p)
}

/**
 * CC-98 — quando cada item do backlog nasceu, derivado do git.
 *
 * Pedido dele em 16/08: *"me deem uma nocao de preenchimento em ordem de tempo
 * e importancia"*. Hoje o ROADMAP tem uma ordem só, e implícita: a ordem em que
 * os itens foram escritos.
 *
 * **Uma chamada de git, não uma por item.** `git log -S "CC-95"` responde certo
 * mas custa uma chamada por item — 40 itens seriam 40 processos. Ler os diffs
 * de uma vez e procurar a linha `+### <título>` custa 276ms para o histórico
 * inteiro deste arquivo, medido.
 *
 * A data é a do commit que **introduziu** o cabeçalho. Reescrever o item depois
 * não muda o nascimento, que é o que se quer: o mapa mostra há quanto tempo
 * aquilo está esperando, não quando mexi nele pela última vez.
 *
 * Devolve `Map<títuloNormalizado, timestampMs>`, vazio quando não é git.
 */
export function nascimentos(cwd) {
  const arquivo = acharRoadmap(cwd)
  if (!arquivo) return new Map()
  const raiz = path.dirname(path.dirname(arquivo))
  const nomeRel = path.relative(raiz, arquivo)

  let saida = ''
  try {
    /* O marcador NÃO pode ser `@`: as linhas de contexto do diff começam com
       `@@ -1,5 +1,7 @@`, e o parser lia isso como data, virando NaN. */
    saida = execFileSync('git', ['log', '--format=__quando__%at', '--diff-filter=AM', '-p', '--', nomeRel], {
      cwd: raiz, encoding: 'utf8', timeout: 20_000, maxBuffer: 3e7, stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch { return new Map() }

  /* O log vem do mais novo para o mais velho, então a ÚLTIMA vez que um título
     aparece como linha adicionada é o commit mais antigo — o nascimento. */
  const quando = new Map()
  let commit = 0
  for (const linha of saida.split('\n')) {
    if (linha.startsWith('__quando__')) {
      const t = Number(linha.slice(10))
      if (Number.isFinite(t) && t > 0) commit = t * 1000
      continue
    }
    if (!linha.startsWith('+###')) continue
    const chave = chaveDoTitulo(linha.slice(1))
    if (chave && commit) quando.set(chave, commit) // sobrescreve: fica o mais antigo
  }
  return quando
}

/** O identificador estável de um título, para casar entre versões reescritas. */
const chaveDoTitulo = (linha) => {
  const id = /\b([A-Z]{1,3}-\d+)\b/.exec(linha)
  if (id) return id[1]
  const limpo = limpar(linha)
  return limpo ? limpo.slice(0, 40).toLowerCase() : null
}

/**
 * CC-98 — quanto este item importa, de 0 a 100.
 *
 * Derivado, nunca digitado, que é a regra mais usada deste projeto. Quatro
 * sinais, e cada um responde a uma pergunta diferente:
 *
 * | sinal | pergunta |
 * |---|---|
 * | quantos itens dependem dele | destrava outros? |
 * | o peso que já existia | é frente grande ou conserto solto? |
 * | traz as palavras dele | é pedido dele ou coisa que eu inventei? |
 * | há quanto tempo espera | está encalhado? |
 *
 * **Item parado (`⏸`) e item feito pesam pouco de propósito.** Importância aqui
 * é "o que fazer agora": um item que depende de decisão dele não é urgente para
 * mim, por mais central que seja.
 *
 * A idade entra com peso pequeno e teto. Sem teto, um item de três meses
 * dominaria a lista para sempre — e velho não é o mesmo que importante.
 */
export function importanciaDe(frente, { dependentes = 0, nasceuEm = null, agora = Date.now() } = {}) {
  if (frente.estado === 'feito') return 0
  if (frente.estado === 'esperando') return 10

  let p = 20
  p += Math.min(30, dependentes * 15)          // destravar outros é o que mais conta
  p += (pesoDe(frente) - 1) * 10               // 0, 10 ou 20
  if (frente.citacao) p += 15                  // pedido dele vale mais que ideia minha
  if (frente.estado === 'bloqueado') p += 10

  if (nasceuEm) {
    const dias = Math.max(0, (agora - nasceuEm) / 86_400_000)
    p += Math.min(10, Math.round(dias))        // teto: velho não é o mesmo que importante
  }
  return Math.min(100, p)
}

/**
 * Quem depende de quem, lido do texto que já está escrito.
 *
 * "Depende do CC-60" é como os itens sempre disseram isso — não há campo novo
 * a preencher, e não deve haver: mais um lugar para envelhecer.
 */
export function dependencias(grupos) {
  const conta = new Map()
  for (const g of grupos) {
    for (const f of g.frentes) {
      const texto = [f.titulo, ...(f.corpo || [])].join(' ')
      for (const m of texto.matchAll(/depende (?:do|de|dos)\s+([A-Z]{1,3}-\d+)/gi)) {
        const alvo = m[1].toUpperCase()
        conta.set(alvo, (conta.get(alvo) || 0) + 1)
      }
    }
  }
  return conta
}

/**
 * O backlog nas DUAS ordens que ele pediu, no mesmo objeto.
 *
 * Não escolhe por ele: devolve as duas listas e deixa a tela mostrar as duas.
 * Escolher uma seria decidir por ele qual pergunta importa mais hoje.
 */
export function ordenar(cwd, mapa) {
  const quando = nascimentos(cwd)
  const deps = dependencias(mapa.grupos || [])
  const agora = Date.now()

  const itens = (mapa.grupos || []).flatMap((g) => g.frentes.map((f) => {
    const chave = chaveDoTitulo(f.titulo)
    const nasceuEm = quando.get(chave) || null
    const dependentes = deps.get(chave) || 0
    return {
      titulo: f.titulo,
      /* Vai junto porque este objeto SUBSTITUI a frente daqui para a frente, e
         quem monta os cartões usa o cru para separar o motivo da pausa do nome
         do item. Reconstruir campo a campo é o que fez o `tituloCru` sumir na
         primeira tentativa de consertar isto: o conserto estava certo no
         `lerRoadmap` e o dado morria aqui, dois passos depois. */
      tituloCru: f.tituloCru || f.titulo,
      estado: f.estado,
      grupo: g.titulo,
      citacao: f.citacao || null,
      itens: f.itens,
      nasceuEm,
      dependentes,
      importancia: importanciaDe(f, { dependentes, nasceuEm, agora }),
    }
  }))

  return {
    // o mais antigo primeiro: é a ordem que mostra o que está encalhado
    porTempo: [...itens].sort((a, b) => (a.nasceuEm || Infinity) - (b.nasceuEm || Infinity)),
    porImportancia: [...itens].sort((a, b) => b.importancia - a.importancia),
  }
}

/**
 * Devolve os grupos (`##`) com suas frentes (`###`) e a contagem de itens.
 * Sem o texto inteiro: o painel mostra o mapa, não o documento — quem quer ler
 * tudo abre o arquivo.
 */
/**
 * CC-378, 28/08: roadmap escrito em TABELA também vira trabalho.
 *
 * Ele: *"não to vendo na aba trabalho o projeto carzo"*. Medido: o roadmap do
 * carzo tem 39 itens contados e ZERO frentes, porque as tarefas de verdade
 * moram em tabela, e o leitor só entendia cabeçalho `###` e lista com traço.
 * As linhas `| INF-01 | Criar projeto Next.js | P0 | Baixa | ✅ | … |` eram
 * texto solto para ele. Escolha dele entre três: *"ensino o quadro a ler
 * tabela"*.
 *
 * **O cabeçalho é quem manda, e não a posição das colunas.** Cada projeto
 * monta a tabela dele de um jeito, e ler pela posição faria a coluna
 * "Prioridade" de um virar o nome da tarefa de outro, em silêncio.
 *
 * **E é o cabeçalho que impede o pior caso:** um roadmap tem tabela de legenda,
 * de branches, de fases. Sem uma coluna que seja TAREFA e outra que seja
 * STATUS, a tabela não vira nada. É por isso que a legenda de símbolos do
 * carzo, que tem cinco linhas, continua sendo legenda.
 */
const COLUNA = {
  id: /^(id|c[óo]digo|ref|chave)$/i,
  tarefa: /^(task|tarefa|item|descri[çc][ãa]o|o que|nome|entrega)$/i,
  status: /^(status|estado|situa[çc][ãa]o|progresso)$/i,
}

export function lerCabecalhoDeTabela(linha) {
  const celulas = String(linha).split('|').slice(1, -1).map((c) => c.trim())
  if (celulas.length < 2) return null
  const achar = (re) => celulas.findIndex((c) => re.test(c.replace(/\*/g, '').trim()))
  const tarefa = achar(COLUNA.tarefa)
  const status = achar(COLUNA.status)
  /* As duas são obrigatórias. Uma tabela sem tarefa não descreve trabalho, e
     uma sem status descreveria trabalho sem dizer se já foi feito, o que
     encheria o quadro de itens fechados como se fossem abertos. */
  if (tarefa < 0 || status < 0) return null
  return { tarefa, status, id: achar(COLUNA.id), largura: celulas.length }
}

/** A linha `|---|---|` que separa o cabeçalho do corpo. É ela que confirma que
 *  a linha de cima era mesmo cabeçalho, e não uma linha de dados qualquer. */
const ehSeparador = (linha) => /^\s*\|[\s:|-]+\|\s*$/.test(linha) && linha.includes('-')

/**
 * CC-385, 28/08: a sprint, que é um recorte COM PRAZO.
 *
 * Escolha dele, entre as três leituras que ofereci para a palavra "sprint": não
 * é "a próxima fatia" nem "agrupamento por tema". É recorte com data de começo
 * e fim, e *"o que não coube volta para a fila"*.
 *
 * O prazo mora no TÍTULO da seção, e não em campo à parte, por dois motivos:
 * o roadmap continua legível por uma pessoa fora do painel, e não nasce um
 * segundo lugar onde a mesma data pode divergir.
 *
 * Formas aceitas, e as duas existem porque ele escreve das duas:
 *
 *     ## Sprint 1 (28/08 a 04/09)
 *     ## Sprint 1 (2026-08-28 a 2026-09-04)
 *
 * Sem data, é seção comum: um roadmap cheio de "Sprint" no título sem prazo
 * nenhum viraria um monte de sprint aberta para sempre, que é o contrário do
 * que ele pediu.
 */
export function prazoDe(titulo) {
  const t = String(titulo || '')
  /* ISO primeiro: `2026-08-28` também casaria o padrão curto pelo pedaço
     `08-28`, e a ordem evita ler o ano como dia. */
  const iso = t.match(/\((\d{4}-\d{2}-\d{2})\s*(?:a|até|->|→)\s*(\d{4}-\d{2}-\d{2})\)/i)
  if (iso) return { de: iso[1], ate: iso[2] }

  const curto = t.match(/\((\d{2})\/(\d{2})\s*(?:a|até|->|→)\s*(\d{2})\/(\d{2})\)/i)
  if (!curto) return null
  /* Sem ano escrito, o ano é o de agora. É o que ele quer dizer ao escrever
     28/08, e inventar outro ano seria pior que perguntar. */
  const ano = new Date().getFullYear()
  const [, d1, m1, d2, m2] = curto
  const inicio = `${ano}-${m1}-${d1}`
  /* Sprint que termina num mês anterior ao de início atravessou o ano. */
  const fim = `${Number(m2) < Number(m1) ? ano + 1 : ano}-${m2}-${d2}`
  return { de: inicio, ate: fim }
}

/**
 * O estado de uma sprint pela data, sem depender de ninguém marcar nada.
 *
 * `null` quando não há prazo. Data que passou é `encerrada`, e é ela que
 * dispara a pergunta que ele pediu: o que não coube volta para a fila.
 */
export function estadoDaSprint(prazo, agora = new Date()) {
  if (!prazo?.de || !prazo?.ate) return null
  const hoje = agora.toISOString().slice(0, 10)
  if (hoje < prazo.de) return 'futura'
  if (hoje > prazo.ate) return 'encerrada'
  return 'corrente'
}

export function lerRoadmap(cwd) {
  const arquivo = acharRoadmap(cwd)
  if (!arquivo) return null
  let texto
  try { texto = fs.readFileSync(arquivo, 'utf8') } catch { return null }

  const grupos = []
  let grupo = null
  let frente = null
  /* O estado da tabela que está sendo lida agora. `candidato` guarda a linha
     anterior: só a linha `|---|---|` confirma que ela era cabeçalho, e sem essa
     confirmação qualquer linha com barras viraria tabela. */
  let tabela = null
  let candidato = null

  // `\r?\n` e não `\n`: com CRLF sobra um `\r` no fim da linha, e `.` no regex
  // NÃO casa `\r`. Resultado: `(.+)$` falhava em todo cabeçalho e o roadmap
  // inteiro saía com zero grupos, sem erro nenhum. Metade dos arquivos é CRLF.
  for (const linha of texto.split(/\r?\n/)) {
    const h2 = /^##\s+(?!#)(.+)$/.exec(linha)
    const h3 = /^###\s+(?!#)(.+)$/.exec(linha)
    const item = /^\s*[-*]\s+(?!\[)(.+)$/.exec(linha)
    const marcado = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/.exec(linha)

    /* ===== CC-378: a leitura de tabela ===== */
    const daTabela = /^\s*\|.*\|\s*$/.test(linha)
    if (!daTabela) { tabela = null; candidato = null }
    else if (ehSeparador(linha)) {
      tabela = candidato ? lerCabecalhoDeTabela(candidato) : null
      candidato = null
      continue
    } else if (tabela) {
      const celulas = linha.split('|').slice(1, -1).map((c) => c.trim())
      const nome = celulas[tabela.tarefa] || ''
      /* Linha sem nome de tarefa é continuação de célula ou sobra de formatação,
         e virar cartão vazio na tela é pior que ser ignorada. */
      if (!nome) continue
      const id = tabela.id >= 0 ? (celulas[tabela.id] || '').replace(/[`*]/g, '').trim() : ''
      const bruto = (id ? id + ' ' + nome : nome).replace(/\*\*/g, '')
      if (!grupo) {
        grupo = { titulo: '', estado: 'aberto', frentes: [], itens: 0, feitos: 0 }
        grupos.push(grupo)
      }
      /* O estado sai da CÉLULA de status, e não do nome: escrito no nome, um
         "✅" no meio de uma frase marcaria como feito um item que só cita outro. */
      const item = {
        titulo: limpar(bruto),
        tituloCru: bruto,
        estado: estadoDe(celulas[tabela.status] || ''),
        itens: 0, feitos: 0, corpo: [],
        deTabela: true,
      }
      grupo.frentes.push(item)
      /* ⚠️ **Não incrementa `itens` do grupo, e a falta disso é o conserto.**
         `itens` conta o que está DENTRO de uma frente (subtarefa), e a tela
         Projetos soma `itens - feitos` como "backlog solto". Uma linha que
         virou frente já é contada como frente: somá-la aqui também fazia o
         carzo anunciar 41 itens de backlog tendo UMA tarefa aberta. Medido em
         28/08, logo depois de a leitura de tabela entrar. */
      frente = null
      continue
    } else { candidato = linha; continue }

    if (h2) {
      /* O prazo sai do título CRU, antes de `limpar()`: ele apaga os
         marcadores, e o parêntese com as datas some junto se a limpeza vier
         primeiro. */
      const prazo = prazoDe(h2[1])
      grupo = {
        titulo: limpar(h2[1]),
        estado: estadoDe(h2[1]),
        frentes: [],
        itens: 0,
        feitos: 0,
        ...(prazo ? { prazo, sprint: estadoDaSprint(prazo) } : {}),
      }
      grupos.push(grupo)
      frente = null
      continue
    }
    if (h3) {
      if (!grupo) {
        grupo = { titulo: '', estado: 'aberto', frentes: [], itens: 0, feitos: 0 }
        grupos.push(grupo)
      }
      /* `tituloCru` guarda a linha com os marcadores, e ele existe por um
         defeito real, achado por ele em 19/08 ao perguntar se CC-80 e CC-155
         eram o mesmo item.

         `limpar()` apaga `⏸` junto com os outros marcadores, o que está certo
         para o texto que vai à tela. Só que `partirTitulo()`, no
         `trabalho.mjs`, usa o `⏸` como âncora para saber onde o MOTIVO da
         pausa termina e o nome começa. Sem a âncora, "⏸ você decide — o estudo
         está pronto" virava nome "você decide" — e como a chave do cartão é
         `projeto:nome`, os DOIS itens que começam assim viraram o mesmo
         cartão na tela: clicar em um abria o outro, com a descrição do outro.

         Guardar o cru é mais barato que ensinar `partirTitulo` a adivinhar
         motivo sem marcador, e não muda nada do que já é exibido. */
      frente = {
        titulo: limpar(h3[1]), tituloCru: String(h3[1]).trim(), estado: estadoDe(h3[1]), itens: 0, feitos: 0, corpo: [],
      }
      grupo.frentes.push(frente)
      continue
    }
    /* O corpo alimenta a citação e o peso; nada dele vai inteiro para a tela.

       ⚠️ Subseção (`####`) ENCERRA a coleta, e isso não é detalhe. Em 17/08 o
       cartão da Sincronia entre máquinas mostrava uma fala dele sobre a
       Bancada: dois cabeçalhos tinham sido rebaixados de `###` para `####` no
       mesmo dia, para sairem da lista de itens, e com isso o texto deles passou
       a ser absorvido pelo item de cima. Citação trocada é pior que citação
       ausente — ele lê as próprias palavras no lugar errado e conclui que eu
       não entendi o pedido. */
    if (frente && linha.trim()) frente.corpo.push(linha)
    // Só conta item de lista; parágrafo solto é explicação, não tarefa.
    if (marcado || item) {
      const feito = marcado ? marcado[1].toLowerCase() === 'x' : false
      const onde = frente || grupo
      if (!onde) continue
      onde.itens++
      if (feito) onde.feitos++
      if (frente && grupo) { grupo.itens++; if (feito) grupo.feitos++ }

      /* ===== CC-379: a CAIXA de marcar também é uma tarefa =====
       *
       * Mesmo problema do CC-378 por outro formato. Alguns roadmaps não usam
       * cabeçalho por item: escrevem `## Épico 2` e listam as tarefas com
       * caixa embaixo. Sem frente, nada virava cartão, e o projeto sumia.
       *
       * **A caixa é o sinal, e o traço sozinho não é.** Medido em 28/08 nos 12
       * roadmaps desta máquina: a regra com caixa traz 104 itens de trabalho
       * real (24 do productVideoMaker, 31 do fibraessencia, 10 do coepiloto e
       * 7 do inovallbond que dependem DELE), e não traz nenhum falso. A regra
       * sem a caixa traria junto os 34 itens de "Limites aceitos hoje" deste
       * projeto, que são limitações documentadas e não trabalho. Um quadro com
       * lixo dentro é pior que um quadro que perde coisa: ele ensina a não ser
       * olhado.
       *
       * **Só em grupo que não tem nenhuma frente `###`.** Onde há frentes, a
       * caixa é subtarefa DELAS, e promovê-la duplicaria o mesmo trabalho em
       * dois níveis. */
      if (marcado && grupo && !frente) {
        /* Mesma regra da tabela: a caixa que vira frente sai da contagem de
           item solto do grupo, senão ela é contada duas vezes. O incremento
           aconteceu logo acima, no caminho normal, e aqui ele é desfeito. */
        grupo.itens--
        if (feito) grupo.feitos--
        const texto = String(marcado[2]).replace(/\*\*/g, '').trim()
        grupo.frentes.push({
          titulo: limpar(texto),
          tituloCru: texto,
          estado: feito ? 'feito' : estadoDe(texto),
          itens: 0, feitos: 0, corpo: [],
          daCaixa: true,
        })
      }
    }
  }

  for (const g of grupos) for (const f of g.frentes || []) {
    f.citacao = citacaoDe(f.corpo)
    f.peso = pesoDe(f)
    /* De quem este item depende, lido do texto que já está escrito: "depende do
       CC-60" é como os itens sempre disseram isso. Vem da planilha que ele
       usava nos produtos (17/08): a dependência morava na linha da tarefa, e é
       o que deixa a tela dizer "desbloqueia X" sem campo novo para envelhecer. */
    const textoTodo = [f.titulo, ...(f.corpo || [])].join(' ')
    f.dependeDe = [...new Set(
      [...textoTodo.matchAll(/depende (?:do|de|da|dos)\s+([A-Z]{1,3}-\d+)/gi)].map((m) => m[1].toUpperCase()),
    )]
    delete f.corpo // o corpo é matéria-prima, não sai daqui
  }

  return {
    arquivo,
    linhas: texto.split('\n').length,
    atualizadoEm: (() => { try { return fs.statSync(arquivo).mtimeMs } catch { return null } })(),
    grupos: grupos.filter((g) => g.titulo || g.frentes.length),
  }
}

/**
 * Casa o que o agente declarou como `frente` com uma frente do roadmap.
 * Sem acento e sem caixa, e aceita que um contenha o outro: o agente escreve
 * "Pierre" e o roadmap diz "Pierre — anonimização local e o caminho da redação".
 */
export function acharFrente(mapa, declarada) {
  if (!mapa || !declarada) return null
  const norma = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const alvo = norma(declarada)
  if (!alvo) return null
  for (const g of mapa.grupos) {
    for (const f of g.frentes) {
      const t = norma(f.titulo)
      if (t === alvo || t.startsWith(alvo) || alvo.startsWith(t.split(' ')[0])) {
        return { grupo: g.titulo, ...f }
      }
    }
  }
  return null
}

export const _internals = { limpar, estadoDe }
