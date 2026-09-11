/**
 * O backlog como DADO, e não como prosa.
 *
 * ## Por que este arquivo existe
 *
 * Medido em 11/09, no quadro real: **152 dos 226 itens (67%) não tinham
 * identificador**, e o painel inventava um para conseguir desenhar. O
 * `docs/ROADMAP.md` deste projeto tinha 11.659 linhas, das quais **9.577 eram
 * item já fechado**, e 110 números `CC-nn` eram citados sem seção nenhuma, sem
 * estado que alguém pudesse ler.
 *
 * A queixa dele, na mesma noite, e ela nomeia a causa:
 *
 * > *"as ias criam os documentos meio que dentro de um padrão, mas um padrão
 * > que não tem tag, não tá em linguagem natural de programação, tá em
 * > 'resenha', ou seja, não tem como rodar um hook ou um script que transforme
 * > isso em dado real. quando falo tag é de tag de programação, uma linha de
 * > código, uma id, um dado rastreável"*
 *
 * E a decisão dele, escolhida na hora: o backlog vira dado, o markdown vira
 * VISTA gerada, *"o que for melhor pra máquina"*.
 *
 * ## A regra que decide os empates daqui
 *
 * **Uma fonte só, e ela é o `.jsonl`.** O `ROADMAP.md` passa a ser saída, nunca
 * entrada. Enquanto os dois forem editáveis, o dia em que discordarem ninguém
 * saberá qual estava certo, e é assim que 110 itens ficaram sem estado.
 *
 * ## Por que JSONL e não JSON
 *
 * Uma linha por item, acrescentar é barato, e o `git diff` mostra o item que
 * mudou em vez do arquivo inteiro. Num JSON único, mexer no estado de um item
 * reescreve o arquivo e o conflito de merge entre duas máquinas vira o arquivo
 * todo. Esse conflito já aconteceu neste projeto, no quadro de rotas, em 31/08.
 *
 * ## O que este módulo NÃO faz, de propósito
 *
 * Não apaga item, nunca. `cancelado` é estado, não sumiço: item que desaparece
 * sem rastro é a queixa dele sobre informação que perde o sentido, pelo pior
 * lado. O histórico sai para outro arquivo quando ele mandar, e continua
 * legível.
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * Os estados de produção, com código curto.
 *
 * Ele pediu código explicitamente: *"até mesmo se criarmos códigos pra cada
 * estado de produção predefinidas"*. O código é o que a máquina grava e
 * compara; o rótulo é o que a tela mostra. Nunca o contrário: rótulo mudou de
 * texto duas vezes neste projeto, e um estado gravado por rótulo teria virado
 * estado desconhecido calado.
 *
 * A ordem da lista é a ordem da esteira, e o quadro desenha nela.
 */
export const ESTADOS = [
  { codigo: 'B0', rotulo: 'ideia', desc: 'registrada com as palavras dele, ainda não avaliada', esteira: 0 },
  { codigo: 'B1', rotulo: 'definida', desc: 'tem critério de pronto escrito, pode ser pega', esteira: 1 },
  { codigo: 'EM', rotulo: 'andando', desc: 'alguém está fazendo agora', esteira: 2 },
  { codigo: 'PR', rotulo: 'prova', desc: 'o código existe, falta a prova na tela', esteira: 3 },
  { codigo: 'DE', rotulo: 'decisão dele', desc: 'parado esperando ele, e só ele resolve', esteira: 4 },
  { codigo: 'TR', rotulo: 'travado', desc: 'parado por obstáculo técnico, com a causa escrita', esteira: 4 },
  { codigo: 'OK', rotulo: 'fechado', desc: 'pronto, com prova registrada', esteira: 5 },
  { codigo: 'KO', rotulo: 'cancelado', desc: 'não vai acontecer, com o motivo escrito', esteira: 5 },
]

const PORCODIGO = new Map(ESTADOS.map((e) => [e.codigo, e]))
export const ehEstado = (c) => PORCODIGO.has(String(c || '').toUpperCase())
export const estadoDe = (c) => PORCODIGO.get(String(c || '').toUpperCase()) || null
/** Estado que ainda pede trabalho ou decisão. */
export const estaAberto = (item) => item.estado !== 'OK' && item.estado !== 'KO'

/** O peso, e ele não é duração. Escala declarada para não virar chute mudo. */
export const PESOS = { 1: 'até uma hora', 2: 'até meio dia', 3: 'até um dia', 5: 'vários dias', 8: 'não cabe, quebre antes' }

const CAMPOS_OBRIGATORIOS = ['id', 'titulo', 'estado', 'frente']

/**
 * Um item válido. Devolve a lista de problemas, vazia quando está tudo bem.
 *
 * Valida de verdade, e alto: o motivo de existir este módulo é que item mal
 * formado sumia calado. Recusar aqui é mais barato que descobrir na tela.
 */
export function problemas(item) {
  const p = []
  if (!item || typeof item !== 'object') return ['não é um objeto']
  for (const c of CAMPOS_OBRIGATORIOS) if (!item[c]) p.push(`falta ${c}`)
  if (item.id && !/^[A-Z]{2,4}-\d{1,5}$/.test(item.id)) p.push(`id fora do formato XX-000: ${item.id}`)
  if (item.estado && !ehEstado(item.estado)) p.push(`estado desconhecido: ${item.estado}`)
  if (item.peso != null && !PESOS[item.peso]) p.push(`peso fora da escala: ${item.peso}`)
  if (item.estado === 'OK' && !item.prova) p.push('fechado sem prova')
  if (item.estado === 'KO' && !item.porque) p.push('cancelado sem motivo')
  if (item.estado === 'TR' && !item.porque) p.push('travado sem a causa escrita')
  if (item.estado === 'DE' && !item.decisao) p.push('esperando decisão dele sem dizer qual é a decisão')
  return p
}

export const caminhoPadrao = (raiz = process.cwd()) => path.join(raiz, 'docs', 'backlog.jsonl')

/** Lê o arquivo. Linha quebrada não derruba o resto, mas é contada e devolvida. */
export function ler(arquivo = caminhoPadrao()) {
  let cru
  try { cru = fs.readFileSync(arquivo, 'utf8') } catch { return { itens: [], ruins: [], arquivo, existe: false } }
  const itens = []
  const ruins = []
  /* `split(/\r?\n/)` e não `split('\n')`: os arquivos deste ecossistema são
     CRLF, e um `\r` sobrando no fim já zerou um parser inteiro aqui. */
  const linhas = cru.split(/\r?\n/)
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim()
    if (!l || l.startsWith('//')) continue
    let o
    try { o = JSON.parse(l) } catch (e) { ruins.push({ linha: i + 1, erro: 'JSON inválido', texto: l.slice(0, 80) }); continue }
    const p = problemas(o)
    if (p.length) ruins.push({ linha: i + 1, erro: p.join('; '), texto: o.id || l.slice(0, 60) })
    itens.push(o)
  }
  return { itens, ruins, arquivo, existe: true }
}

/** Escrita atômica: tmp + rename. O arquivo nunca fica pela metade. */
export function gravar(itens, arquivo = caminhoPadrao()) {
  const ordem = [...itens].sort((a, b) => {
    const na = Number(String(a.id).split('-')[1] || 0)
    const nb = Number(String(b.id).split('-')[1] || 0)
    return na - nb
  })
  const corpo = ordem.map((i) => JSON.stringify(i)).join('\n') + '\n'
  const tmp = arquivo + '.tmp'
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(tmp, corpo, 'utf8')
  fs.renameSync(tmp, arquivo)
  return ordem.length
}

const hoje = () => new Date().toISOString().slice(0, 10)

/** O próximo id livre, no prefixo dado. Nunca reusa número morto. */
export function proximoId(itens, prefixo = 'CC') {
  let maior = 0
  for (const i of itens) {
    const m = String(i.id || '').match(/^([A-Z]{2,4})-(\d+)$/)
    if (m && m[1] === prefixo) maior = Math.max(maior, Number(m[2]))
  }
  return `${prefixo}-${maior + 1}`
}

/** Acrescenta um item, já validado. Devolve o item gravado. */
export function acrescentar(campos, arquivo = caminhoPadrao()) {
  const { itens } = ler(arquivo)
  const item = {
    id: campos.id || proximoId(itens, campos.prefixo || 'CC'),
    titulo: String(campos.titulo || '').trim(),
    estado: String(campos.estado || 'B0').toUpperCase(),
    frente: String(campos.frente || 'sem frente').trim(),
    peso: campos.peso ?? null,
    criado: campos.criado || hoje(),
    mexido: hoje(),
    prova: campos.prova || null,
    porque: campos.porque || null,
    decisao: campos.decisao || null,
    citacao: campos.citacao || null,
    depende: campos.depende || [],
    origem: campos.origem || 'agente',
  }
  const p = problemas(item)
  if (p.length) throw new Error(`item recusado: ${p.join('; ')}`)
  if (itens.some((i) => i.id === item.id)) throw new Error(`id repetido: ${item.id}`)
  itens.push(item)
  gravar(itens, arquivo)
  return item
}

/**
 * Muda o estado de um item.
 *
 * A validação é o ponto: fechar sem prova é recusado aqui, e não lembrado num
 * texto. É a trava que o projeto já paga há meses no `cc done`, agora no dado.
 */
export function mover(id, estado, extras = {}, arquivo = caminhoPadrao()) {
  const { itens } = ler(arquivo)
  const i = itens.find((x) => x.id === id)
  if (!i) throw new Error(`não achei ${id}`)
  const novo = { ...i, ...extras, estado: String(estado).toUpperCase(), mexido: hoje() }
  if (novo.estado === 'OK' && !novo.fechado) novo.fechado = hoje()
  const p = problemas(novo)
  if (p.length) throw new Error(p.join('; '))
  itens[itens.indexOf(i)] = novo
  gravar(itens, arquivo)
  return novo
}

/** O retrato para a tela e para o terminal. */
export function retrato(arquivo = caminhoPadrao()) {
  const { itens, ruins, existe } = ler(arquivo)
  const abertos = itens.filter(estaAberto)
  const porEstado = {}
  for (const e of ESTADOS) porEstado[e.codigo] = 0
  for (const i of itens) porEstado[i.estado] = (porEstado[i.estado] || 0) + 1
  const porFrente = new Map()
  for (const i of abertos) {
    if (!porFrente.has(i.frente)) porFrente.set(i.frente, [])
    porFrente.get(i.frente).push(i)
  }
  return {
    existe,
    total: itens.length,
    abertos: abertos.length,
    fechados: itens.length - abertos.length,
    porEstado,
    frentes: [...porFrente.entries()].map(([nome, is]) => ({ nome, itens: is })),
    ruins,
    esperandoEle: abertos.filter((i) => i.estado === 'DE'),
    travados: abertos.filter((i) => i.estado === 'TR'),
    /* **Item velho não é item morto, é item que ninguém perguntou.**
     *
     * O caso que ele levantou em 11/09: *"VPS_INOVALLBOND por exemplo tem
     * tarefas ainda do jogo que já tá pronto a muito mais de 1 mês"*. Medido:
     * 25 itens do jogo abertos, e oito dos quinze projetos do quadro nunca
     * fecharam nada. Fechar por conta própria seria inventar; o que faltava
     * era o quadro PERGUNTAR.
     *
     * 30 dias, e não 7: sprint curto deixa item legítimo parado uma ou duas
     * semanas o tempo todo, e alarme que dispara no normal é alarme que ele
     * desliga na terceira vez. */
    parados: abertos.filter((i) => diasDesde(i.mexido) > 30).sort((a, b) => diasDesde(b.mexido) - diasDesde(a.mexido)),
  }
}

/** Dias desde uma data `AAAA-MM-DD`. Devolve 0 quando não dá para saber. */
export function diasDesde(data) {
  if (!data) return 0
  const t = Date.parse(String(data) + 'T12:00:00Z')
  if (Number.isNaN(t)) return 0
  return Math.floor((Date.now() - t) / 86400000)
}

/**
 * O que os COMMITS dizem que fechou, e o backlog ainda não sabe.
 *
 * ## Por que existe
 *
 * Queixa dele em 10/09: *"não são atualizadas sempre retroativamente"*, e o
 * caso concreto era o jogo do `inovallbond`, pronto há mais de um mês e ainda
 * na fila. Medido em 11/09: **oito dos quinze projetos do quadro nunca fecharam
 * um item sequer**, porque fechar era digitar num texto e ninguém digita.
 *
 * O que ele pediu no lugar: *"quando falo tag é de tag de programação, uma
 * linha de código, uma id, um dado rastreável"*. O commit já é isso. Se a
 * mensagem cita o item, o item fechou, e a mensagem vira a prova.
 *
 * ## O que conta como fechar, e por que só isto conta
 *
 * Só a forma explícita: `fecha CC-123`, `fechou`, `closes`, `resolve`. Citar o
 * id no meio da mensagem NÃO fecha, porque commit cita item vizinho o tempo
 * todo ("mesmo defeito do CC-45"), e fechar por citação encheria o quadro de
 * item fechado errado, com aparência de trabalho feito. Falso positivo aqui é
 * pior que falso negativo: ele confere o que está aberto, não o que fechou.
 */
export function fechadosNosCommits(linhas) {
  const achados = new Map()
  const padrao = /\b(?:fecha|fechou|fechado|closes?|close|resolve[ud]?|resolvido)\s+([A-Z]{2,4}-\d{1,5})\b/gi
  for (const l of linhas) {
    for (const m of String(l).matchAll(padrao)) {
      const id = m[1].toUpperCase()
      if (!achados.has(id)) achados.set(id, String(l).trim().slice(0, 200))
    }
  }
  return achados
}

/**
 * Fecha no backlog o que os commits disseram que fechou.
 *
 * A mensagem do commit vira a prova, e é prova de verdade: tem hash, autor e
 * data atrás dela, ao contrário de uma frase escrita à mão depois.
 */
export function sincronizarComCommits(linhas, { arquivo = caminhoPadrao(), ensaio = false } = {}) {
  const dizem = fechadosNosCommits(linhas)
  const { itens } = ler(arquivo)
  const feitos = []
  for (const [id, mensagem] of dizem) {
    const i = itens.find((x) => x.id === id)
    if (!i) { feitos.push({ id, acao: 'não existe neste backlog' }); continue }
    if (!estaAberto(i)) continue
    feitos.push({ id, acao: ensaio ? 'fecharia' : 'fechado', titulo: i.titulo })
    if (!ensaio) {
      i.estado = 'OK'
      i.fechado = hoje()
      i.mexido = hoje()
      i.prova = `commit: ${mensagem}`
    }
  }
  if (!ensaio && feitos.some((f) => f.acao === 'fechado')) gravar(itens, arquivo)
  return { feitos, citados: dizem.size }
}

/**
 * O ROADMAP.md, gerado do dado.
 *
 * Cabeçalho avisando que é saída: sem isso, alguém edita o markdown, o dado
 * não muda, e nasce a segunda verdade que este arquivo existe para matar.
 */
export function comoMarkdown(arquivo = caminhoPadrao()) {
  const r = retrato(arquivo)
  const l = []
  l.push('<!-- GERADO por src/backlog.mjs a partir de docs/backlog.jsonl.')
  l.push('     NÃO EDITE ESTE ARQUIVO: a fonte é o .jsonl, e o que você escrever aqui')
  l.push('     some na próxima geração. Para mexer: `cc backlog`. -->')
  l.push('')
  l.push('# ROADMAP — o que está aberto neste projeto')
  l.push('')
  l.push(`${r.abertos} abertos, ${r.fechados} fechados, ${r.total} no total. Gerado em ${hoje()}.`)
  l.push('')
  if (r.esperandoEle.length) {
    l.push('## ⛔ Esperando ELE, e só ele resolve')
    l.push('')
    for (const i of r.esperandoEle) l.push(`- **${i.id}** ${i.titulo} — ${i.decisao}`)
    l.push('')
  }
  if (r.travados.length) {
    l.push('## ⚠️ Travados, com a causa medida')
    l.push('')
    for (const i of r.travados) l.push(`- **${i.id}** ${i.titulo} — ${i.porque}`)
    l.push('')
  }
  for (const f of r.frentes) {
    l.push(`## ${f.nome}`)
    l.push('')
    l.push('| id | estado | peso | o que é |')
    l.push('|---|---|---|---|')
    for (const i of f.itens) {
      const e = estadoDe(i.estado)
      l.push(`| ${i.id} | ${e ? e.rotulo : i.estado} | ${i.peso ?? '-'} | ${String(i.titulo).replace(/\|/g, '/')} |`)
    }
    l.push('')
  }
  return l.join('\n')
}
