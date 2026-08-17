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

const CAMINHOS = [['docs', 'ROADMAP.md'], ['ROADMAP.md'], ['docs', 'roadmap.md'], ['ROADMAP.MD']]

/** Sobe do diretório de trabalho até achar um roadmap. `null` se não houver. */
export function acharRoadmap(cwd) {
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
  { chave: 'bloqueado', emoji: /🔴|⛔/u, palavra: /bloquead|travad|impedid/i },
  /* ⏸ nasceu em 16/08 e é diferente de "esperando" por um detalhe que decide:
     ele diz que o item está aberto e parado por motivo que NÃO depende do
     agente — direção em vez de tarefa, decisão dele, ou ambiente que não
     existe. Sem essa chave o `fluxo-guard` cobrava seis itens impossíveis, e
     guarda que cobra o impossível ensina a ser ignorado. */
  { chave: 'esperando', emoji: /⏸|🟡|⏳/u, palavra: /aguardand|depende d[eao]\s+(?!mim)|decis[ãa]o d(o|ele)|dire[çc][ãa]o/i },
  { chave: 'feito', emoji: /✅|✔/u, palavra: /conclu[íi]d|entregue|hist[óo]rico|feito/i },
  { chave: 'aberto', emoji: /🟢/u, palavra: /aberto|agora|pr[óo]xim|fazer/i },
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
  .replace(/[🔴🟡🟢🔥✅✔⛔⏳📌⏸]/gu, '')
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
export function lerRoadmap(cwd) {
  const arquivo = acharRoadmap(cwd)
  if (!arquivo) return null
  let texto
  try { texto = fs.readFileSync(arquivo, 'utf8') } catch { return null }

  const grupos = []
  let grupo = null
  let frente = null

  // `\r?\n` e não `\n`: com CRLF sobra um `\r` no fim da linha, e `.` no regex
  // NÃO casa `\r`. Resultado: `(.+)$` falhava em todo cabeçalho e o roadmap
  // inteiro saía com zero grupos, sem erro nenhum. Metade dos arquivos é CRLF.
  for (const linha of texto.split(/\r?\n/)) {
    const h2 = /^##\s+(?!#)(.+)$/.exec(linha)
    const h3 = /^###\s+(?!#)(.+)$/.exec(linha)
    const item = /^\s*[-*]\s+(?!\[)(.+)$/.exec(linha)
    const marcado = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/.exec(linha)

    if (h2) {
      grupo = { titulo: limpar(h2[1]), estado: estadoDe(h2[1]), frentes: [], itens: 0, feitos: 0 }
      grupos.push(grupo)
      frente = null
      continue
    }
    if (h3) {
      if (!grupo) {
        grupo = { titulo: '', estado: 'aberto', frentes: [], itens: 0, feitos: 0 }
        grupos.push(grupo)
      }
      frente = { titulo: limpar(h3[1]), estado: estadoDe(h3[1]), itens: 0, feitos: 0, corpo: [] }
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
