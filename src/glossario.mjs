/**
 * O glossário: os documentos do projeto reduzidos ao que cabe numa tela.
 *
 * Pedido do Felipe em 14/08, e a razão dele importa mais que o recurso:
 *
 * > "eu preciso ter um acesso a todos esses documentos de forma resumida pra eu
 * > saber as coisas sem ter que ficar lendo um livro gigante, porque o problema
 * > é a minha velocidade de leitura [...] se eu quiser lembrar o que que é a
 * > bancada que eu mesmo criei há pouco tempo atrás, eu já não lembro, eu teria
 * > que pesquisar pra ler. E eu não posso, toda hora que eu esquecer, ficar
 * > lendo um documento gigante."
 *
 * Medido no mesmo dia, e é o tamanho do problema: 44 arquivos em `docs/`, 7060
 * linhas, e o `BANCADA.md` sozinho com 459. Só 4 tinham cabeçalho estruturado.
 *
 * ## O documento continua grande, e isso é de propósito
 *
 * O doc extenso é a fonte de verdade para a IA, que lê rápido e precisa do
 * detalhe. O que este módulo faz é extrair a camada curta para o humano, do
 * PRÓPRIO arquivo — nunca de um segundo arquivo escrito à mão. Um fato mora num
 * lugar só; aqui ele só é lido de dois jeitos.
 *
 * Isso é a visão do framework aplicada à documentação: "o artefato é para a
 * máquina, e o insight chega destilado pelo cockpit".
 */
import fs from 'node:fs'
import path from 'node:path'

/** Frontmatter YAML simples: só o que este projeto usa, sem dependência.
 *  Aceita `chave: valor`, listas `[a, b]` e blocos indentados de `termo: def`. */
export function lerFrontmatter(texto) {
  if (!texto.startsWith('---')) return {}
  const fim = texto.indexOf('\n---', 3)
  if (fim === -1) return {}

  const dados = {}
  let chaveAninhada = null
  for (const linha of texto.slice(4, fim).split(/\r?\n/)) {
    if (!linha.trim() || linha.trim().startsWith('#')) continue

    // linha indentada: pertence à chave anterior (usado por `termos:`)
    if (/^\s+\S/.test(linha) && chaveAninhada) {
      const m = linha.trim().match(/^([^:]+):\s*(.*)$/)
      if (m) (dados[chaveAninhada] ||= {})[m[1].trim()] = m[2].trim()
      continue
    }

    const m = linha.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (!m) continue
    const [, chave, bruto] = m
    const valor = bruto.trim()
    if (!valor) { chaveAninhada = chave; dados[chave] = {}; continue }
    chaveAninhada = null
    dados[chave] = valor.startsWith('[') && valor.endsWith(']')
      ? valor.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
      : valor
  }
  return dados
}

/** Primeira frase de conteúdo, para documento que ainda não tem `resumo:`.
 *  Melhor um começo tosco do que um cartão vazio: cartão vazio some da tela e
 *  o documento vira invisível, que é o problema que este módulo resolve. */
export function primeiraFrase(texto) {
  const corpo = texto.startsWith('---')
    ? texto.slice(texto.indexOf('\n---', 3) + 4)
    : texto
  for (const linha of corpo.split(/\r?\n/)) {
    const l = linha.trim()
    if (!l || l.startsWith('#') || l.startsWith('>') || l.startsWith('|')
      || l.startsWith('-') || l.startsWith('```')) continue
    const frase = l.split(/(?<=\.)\s/)[0]
    return frase.length > 180 ? `${frase.slice(0, 177)}…` : frase
  }
  return ''
}

const TITULO = (texto, arquivo) => {
  const m = texto.match(/^#\s+(.+)$/m)
  return (m ? m[1] : path.basename(arquivo, '.md')).replace(/[`[\]]/g, '').trim()
}

/** Um verbete: o que a tela mostra sem ninguém abrir arquivo nenhum. */
export function verbeteDe(arquivo, raiz) {
  let texto = ''
  try { texto = fs.readFileSync(arquivo, 'utf8') } catch { return null }
  const fm = lerFrontmatter(texto)
  const linhas = texto.split(/\r?\n/).length

  return {
    id: path.relative(raiz, arquivo).replace(/\\/g, '/'),
    titulo: TITULO(texto, arquivo),
    resumo: fm.resumo || primeiraFrase(texto),
    // `estado` e `tipo` são o que responde "isso existe ou é ideia?" de relance
    tipo: fm.tipo || null,
    estado: fm.estado || null,
    atualizado: fm.atualizado || null,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    termos: fm.termos && typeof fm.termos === 'object' ? fm.termos : {},
    linhas,
    // sem `resumo:` no arquivo o cartão sai de um chute; a tela avisa, para o
    // documento ser corrigido em vez de ficar com resumo ruim para sempre
    resumoAutomatico: !fm.resumo,
  }
}

const IGNORAR = /(^|\/)(node_modules|legacy|diario)(\/|$)/

/**
 * Todos os verbetes de `docs/`.
 *
 * `diario/` fica de fora: é histórico append-only, não conceito. Quem procura
 * "o que é a bancada" não quer 7 diários no meio do caminho.
 */
export function lerGlossario(projetoDir) {
  const raiz = path.join(projetoDir, 'docs')
  const achados = []
  const andar = (dir) => {
    let itens = []
    try { itens = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const it of itens) {
      const cheio = path.join(dir, it.name)
      if (IGNORAR.test(path.relative(raiz, cheio).replace(/\\/g, '/'))) continue
      if (it.isDirectory()) andar(cheio)
      else if (it.name.endsWith('.md')) {
        const v = verbeteDe(cheio, raiz)
        if (v) achados.push(v)
      }
    }
  }
  andar(raiz)

  // Ordem: o que tem estado declarado primeiro (é o que está vivo), depois por
  // título. Sem isso o índice abre pelo alfabeto, e o alfabeto não diz nada.
  achados.sort((a, b) => (b.estado ? 1 : 0) - (a.estado ? 1 : 0) || a.titulo.localeCompare(b.titulo))
  return achados
}

/** Busca por texto: título, resumo, tags e os termos. Serve à caixa de busca
 *  da tela, e é o caminho de "não lembro o nome, lembro a palavra". */
export function buscar(verbetes, q) {
  const alvo = String(q || '').trim().toLowerCase()
  if (!alvo) return verbetes
  return verbetes.filter((v) => [
    v.titulo, v.resumo, v.tipo, v.estado, ...v.tags,
    ...Object.keys(v.termos), ...Object.values(v.termos),
  ].join(' ').toLowerCase().includes(alvo))
}

/**
 * CC-229: as explicações longas do "?" do painel.
 *
 * A primeira versão usava os `termos:` do cabeçalho, que cabem numa linha. Ele
 * leu e reprovou: *"voce colocou os '?' bem ruinzinhos (…) voce falou como se
 * eu fosse um imbecil. Eu quero explicacoes mais tecnicas"*. Uma linha não
 * comporta explicar o bloco inteiro da tela, de onde vem cada pedaço e o que a
 * cor significa.
 *
 * Então a fonte passa a ser o CORPO de `docs/produto/PALAVRAS-DA-TELA.md`: cada
 * `## palavra` é uma explicação, e o texto abaixo dela é o que ele lê. Fica
 * legível como documento e comporta parágrafos, listas e destaque.
 *
 * As seções antes da primeira palavra são instruções de escrita, não verbetes:
 * o `#` do título e o `## Como escrever aqui` ficam de fora.
 */
export const ARQUIVO_PALAVRAS = path.join('docs', 'produto', 'PALAVRAS-DA-TELA.md')
const NAO_E_VERBETE = /^(como escrever aqui|as palavras da tela)$/i

export function lerPalavrasDaTela(projetoDir) {
  let texto = ''
  try { texto = fs.readFileSync(path.join(projetoDir, ARQUIVO_PALAVRAS), 'utf8') } catch { return [] }

  // fora o cabeçalho, que já é lido por `lerFrontmatter`
  if (texto.startsWith('---')) {
    const fim = texto.indexOf('\n---', 3)
    if (fim > -1) texto = texto.slice(fim + 4)
  }

  const palavras = []
  let atual = null
  /* CRLF: dividir por \n sozinho deixaria um \r no fim de cada título, e o
     termo nunca casaria com o que a tela pede. Armadilha já registrada. */
  for (const linha of texto.split(/\r?\n/)) {
    const cabecalho = linha.match(/^##\s+(.+?)\s*$/)
    if (cabecalho) {
      if (atual) palavras.push(atual)
      atual = NAO_E_VERBETE.test(cabecalho[1]) ? null : { termo: cabecalho[1], corpo: [] }
      continue
    }
    if (atual) atual.corpo.push(linha)
  }
  if (atual) palavras.push(atual)

  return palavras
    .map((p) => ({ termo: p.termo, texto: p.corpo.join('\n').trim() }))
    .filter((p) => p.texto)
}

/** Todos os termos de todos os documentos, achatados e com a origem. É o
 *  glossário de verdade: "o que era mesmo camada 13?" sem abrir arquivo. */
export function termosDe(verbetes) {
  const lista = []
  for (const v of verbetes) {
    for (const [termo, definicao] of Object.entries(v.termos)) {
      lista.push({ termo, definicao, onde: v.titulo, id: v.id })
    }
  }
  return lista.sort((a, b) => a.termo.localeCompare(b.termo))
}
