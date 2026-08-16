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
  { chave: 'esperando', emoji: /🟡|⏳/u, palavra: /aguardand|depende d[eao]\s+(?!mim)/i },
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
  .replace(/[🔴🟡🟢🔥✅✔⛔⏳📌]/gu, '')
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
  const texto = corpo.join('\n')

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
    // o corpo alimenta a citação e o peso; nada dele vai inteiro para a tela
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
