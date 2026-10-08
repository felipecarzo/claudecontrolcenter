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
import { spawnSync } from 'node:child_process'
import { transicionar } from './tarefa.mjs'
import { catalogoDe, ehFrente, listaDeFrentes } from './frentes.mjs'
import { MODELOS, ESFORCOS } from './modelo.mjs'

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

/* ===================================================================
   O VOCABULÁRIO DO ITEM, decidido por ele em 11/09
   ===================================================================

   Ele parou o trabalho de tela e nomeou a raiz: *"precisamos transformar o
   projeto num FRAMEWORK"*, e a primeira peça é o item deixar de ser prosa.

   > *"não é pra colocar 'o felipe pediu p eu fazer um framework', é 'pedido:
   > construcao de sistema - intenção: ~ criar framework pra gerenciar agentes
   > - definição de pronto: blablabla'"*

   O `~` marca a única parte interpretada; o resto é código rastreável.

   ## O que foi MEDIDO antes de escolher as etiquetas (543 itens, 11/09)

   Ele perguntou se faltava etiqueta (prazo, importância, hora). O dado
   respondeu, e recusou duas delas:

   - **524 de 543 itens fecharam no MESMO dia em que nasceram.** Prazo seria
     campo vazio em 9 de cada 10, e campo vazio na tela vira ruído. Prazo de
     verdade é do projeto, não do item.
   - **`peso` está preenchido em 8%**, com quatro valores. Campo que 92%
     ignora mente. Vira `tamanho`, com três valores e obrigatório na criação,
     que é quando quem escreve sabe.
   - **`depende` está em 0%.** Nunca foi usado; fica como está, sem promoção.
   - **Das 300 provas escritas, 27 citam comando ou teste.** As outras 273 só
     um humano confere. É por isso que `conferir` existe: sem ele o leitor
     diário que ele pediu (*"uma máquina ler rápido a documentação de todos os
     projetos ativos todo dia e verificar se as tarefas tão prontas"*) não tem
     como funcionar.
   - **`origem` está em 100%**, porque é derivado e nunca digitado. É o molde
     de campo que sobrevive.

   ## A regra de convivência com os 543 que já existem

   Decisão dele: **só os itens ABERTOS vão para o formato novo.** Item fechado
   é história e ninguém vai relê-lo. Por isso a exigência vale na CRIAÇÃO e
   para item aberto, e nunca para `OK`/`KO` antigo. */

/** O que o item É. Um por item, obrigatório. */
export const NATUREZAS = [
  { codigo: 'DEF', rotulo: 'defeito', desc: 'existia e quebrou' },
  { codigo: 'PED', rotulo: 'pedido', desc: 'não existe e precisa existir' },
  { codigo: 'DEC', rotulo: 'decisão', desc: 'só ele resolve, e a escolha muda o que será feito' },
  { codigo: 'MED', rotulo: 'medição', desc: 'descobrir antes de agir, sem mexer em nada' },
  { codigo: 'DOC', rotulo: 'registro', desc: 'texto que alguém vai ler, sem código' },
]

/** Onde o item mexe. Escolhida por quem escreve: 211 dos 543 títulos batem em
 *  duas áreas, então derivar por palavra erraria em quase metade. */
export const AREAS = [
  { codigo: 'dado', desc: 'o que é gravado e lido: formato, campo, registro' },
  { codigo: 'tela', desc: 'o que ele vê e clica' },
  { codigo: 'agente', desc: 'sessões, rotas, recados, os três programas' },
  { codigo: 'maquinas', desc: 'as duas máquinas, portas, serviço, publicação' },
  { codigo: 'trava', desc: 'o que barra: ganchos, gates, guardas' },
  { codigo: 'texto', desc: 'documento, roadmap, glossário, a forma de falar' },
]

/** O tamanho, na escala dele. Obrigatório na criação. */
export const TAMANHOS = [
  { codigo: 'P', desc: 'minutos, cabe numa linha do painel' },
  { codigo: 'M', desc: 'até uma hora' },
  { codigo: 'G', desc: 'mais que isso: quebre em dois antes de começar' },
]

/**
 * QUEM consegue dizer que está pronto. O campo que faz o leitor diário existir.
 *
 * Formato `modo:texto`, e o modo é fechado:
 *   auto:<comando>          a máquina roda e sabe sozinha
 *   olho:<o que olhar>      alguém abre a tela e vê
 *   dele:<o que confirmar>  só ele pode dizer
 */
export const MODOS_DE_CONFERIR = ['auto', 'olho', 'dele']

/** Quem destrava um item parado. `mundo:` é o que não depende de ninguém aqui. */
export const MODOS_DE_TRAVA = ['dele', 'item', 'mundo']

/** Até onde o estrago chega. É o que separa o reversível do que sai da máquina. */
export const RISCOS = [
  { codigo: 'local', desc: 'só esta máquina, e dá para desfazer' },
  { codigo: 'compartilhado', desc: 'outra máquina ou outra sessão sente' },
  { codigo: 'cliente', desc: 'chega em quem paga' },
]

const TETO_INTENCAO = 140

const listaTem = (lista, v) => lista.some((x) => (x.codigo || x) === v)

/* CC-958, decisão dele em 07/10: fila mista. O Caminho é a prioridade, e ideia nova entra no lugar que ele escolhe. */
export const LUGARES = [
  { codigo: 'agora', rotulo: 'agora', desc: 'urgente: fura a fila, logo depois do que está andando' },
  { codigo: 'dia', rotulo: 'fim do dia', desc: 'ainda hoje, antes do resto do sprint atual' },
  { codigo: 'sprint', rotulo: 'fim do sprint', desc: 'neste sprint, depois do que já estava nele' },
  { codigo: 'backlog', rotulo: 'fim do backlog', desc: 'depois de tudo o que já existe' },
  { codigo: 'fora', rotulo: 'fora do MVP', desc: 'guardada: não entra na fila até você promover' },
]
// dado gravado não se conserta, se interpreta: o "(depois do MVP)" escrito antes do campo vale como fora do MVP
const MARCA_FORA = /^\s*\(depois do MVP\)/i
export function lugarDe(item) {
  if (item?.lugar !== undefined) return listaTem(LUGARES, item.lugar?.onde) ? item.lugar.onde : null
  return MARCA_FORA.test(String(item?.titulo || item?.intencao || '')) ? 'fora' : null
}
export const diaLocal = (d = new Date()) => new Date(d).toLocaleDateString('sv')
export function rotuloDoLugar(item, hoje = diaLocal()) {
  const l = lugarDe(item); if (!l) return null
  const r = LUGARES.find((x) => x.codigo === l).rotulo
  const d = item.lugar?.em ? diaLocal(item.lugar.em) : null
  return l === 'dia' && d && d < hoje ? `${r}, sobrou de ${d.slice(8, 10)}/${d.slice(5, 7)}` : r
}

/**
 * O item está no formato novo? Devolve a lista do que falta.
 *
 * Separada de `problemas()` de propósito: aquela vale para os 543 itens que já
 * existem, e passar a recusá-los transformaria o arquivo inteiro em erro.
 */
export function problemasDoFormato(item) {
  const p = []
  if (!item || typeof item !== 'object') return ['não é um objeto']
  if (!item.natureza) p.push('falta natureza (DEF, PED, DEC, MED ou DOC)')
  else if (!listaTem(NATUREZAS, item.natureza)) p.push(`natureza desconhecida: ${item.natureza}`)
  if (!item.area) p.push('falta area (dado, tela, agente, maquinas, trava ou texto)')
  else if (!listaTem(AREAS, item.area)) p.push(`area desconhecida: ${item.area}`)
  if (!item.tamanho) p.push('falta tamanho (P, M ou G)')
  else if (!listaTem(TAMANHOS, item.tamanho)) p.push(`tamanho fora da escala: ${item.tamanho}`)
  if (!item.intencao) p.push('falta intencao')
  else if (String(item.intencao).length > TETO_INTENCAO) p.push(`intencao com ${String(item.intencao).length} caracteres, o teto é ${TETO_INTENCAO}`)
  if (!item.pronto) p.push('falta pronto: o que se observa quando estiver feito')
  if (!item.conferir) p.push(`falta conferir (${MODOS_DE_CONFERIR.join(':, ')}:)`)
  else {
    const [modo, ...resto] = String(item.conferir).split(':')
    if (!MODOS_DE_CONFERIR.includes(modo)) p.push(`conferir começa por ${MODOS_DE_CONFERIR.join(', ')}, e veio "${modo}"`)
    else if (!resto.join(':').trim()) p.push(`conferir "${modo}:" sem dizer o quê`)
  }
  if (item.trava) {
    const [modo, ...resto] = String(item.trava).split(':')
    if (!MODOS_DE_TRAVA.includes(modo)) p.push(`trava começa por ${MODOS_DE_TRAVA.join(', ')}, e veio "${modo}"`)
    else if (modo !== 'dele' && !resto.join(':').trim()) p.push(`trava "${modo}:" sem dizer o quê`)
  }
  if (item.risco && !listaTem(RISCOS, item.risco)) p.push(`risco desconhecido: ${item.risco}`)
  return p
}

/** O item já nasceu no formato novo? Serve para a tela separar sem cobrar. */
export const noFormatoNovo = (item) => Boolean(item?.natureza && item?.area && item?.conferir)

/** O que a tela mostra no lugar do título livre: natureza, área e intenção. */
export function comoSeLe(item) {
  if (!noFormatoNovo(item)) return item?.titulo || ''
  return `${item.natureza} ${item.area}: ${item.intencao}`
}

const PORCODIGO = new Map(ESTADOS.map((e) => [e.codigo, e]))
export const ehEstado = (c) => PORCODIGO.has(String(c || '').toUpperCase())
export const estadoDe = (c) => PORCODIGO.get(String(c || '').toUpperCase()) || null
/** Estado que ainda pede trabalho ou decisão. */
export const estaAberto = (item) => item.estado !== 'OK' && item.estado !== 'KO'

/**
 * CC-920: esta prova pode ser aprovada pelo olho dele, no Tinder? Só item em PR cujo
 * `conferir` começa por "olho:" ou "dele:". As "auto:" só o robô fecha
 * (`node cc.mjs backlog conferir`, regra 3 do Nisaba).
 */
export const podeAprovarPorOlho = (item) => item?.estado === 'PR' && /^(olho|dele):/.test(String(item.conferir || ''))

/** O peso, e ele não é duração. Escala declarada para não virar chute mudo. */
export const PESOS = { 1: 'até uma hora', 2: 'até meio dia', 3: 'até um dia', 5: 'vários dias', 8: 'não cabe, quebre antes' }

const CAMPOS_OBRIGATORIOS = ['id', 'titulo', 'estado', 'frente']

/**
 * Um item válido. Devolve a lista de problemas, vazia quando está tudo bem.
 *
 * Valida de verdade, e alto: o motivo de existir este módulo é que item mal
 * formado sumia calado. Recusar aqui é mais barato que descobrir na tela.
 */
export function problemas(item, frentes = null) {
  const p = []
  if (!item || typeof item !== 'object') return ['não é um objeto']
  for (const c of CAMPOS_OBRIGATORIOS) if (!item[c]) p.push(`falta ${c}`)
  if (item.id && !/^[A-Z]{2,4}-\d{1,5}$/.test(item.id)) p.push(`id fora do formato XX-000: ${item.id}`)
  if (item.estado && !ehEstado(item.estado)) p.push(`estado desconhecido: ${item.estado}`)
  if (item.peso != null && !PESOS[item.peso]) p.push(`peso fora da escala: ${item.peso}`)
  /* CC-521: item aberto carrega só o código do catálogo de frentes. Fechado é
     história e não se reescreve. */
  if (item.frente && frentes && estaAberto(item) && !ehFrente(item.frente, frentes)) {
    p.push(`frente "${item.frente}" fora do catálogo do projeto (uma palavra, de docs/frentes.json): ${listaDeFrentes(frentes)}`)
  }
  if (item.estado === 'OK' && !item.prova) p.push('fechado sem prova')
  if (item.estado === 'KO' && !item.porque) p.push('cancelado sem motivo')
  if (item.estado === 'TR' && !item.porque) p.push('travado sem a causa escrita')
  if (item.estado === 'DE' && !item.decisao) p.push('esperando decisão dele sem dizer qual é a decisão')
  if (item.pai != null && !/^[A-Z]{2,4}-\d{1,5}$/.test(item.pai)) p.push(`pai fora do formato XX-000: ${item.pai}`)
  if (item.pai && item.pai === item.id) p.push('um item não pode ser filho de si mesmo')
  if (item.lugar != null && (!listaTem(LUGARES, item.lugar.onde) || Number.isNaN(Date.parse(item.lugar.em)))) p.push(`lugar desconhecido: ${JSON.stringify(item.lugar)} (vale ${LUGARES.map((l) => l.codigo).join(', ')}, com a data em "em")`)
  /* Formato novo: cobrado só de quem JÁ está nele, e de item aberto que nasceu
     depois da virada. Item fechado antes de 11/09 é história, e decisão dele é
     que história não se reescreve. Sem esta linha, os 510 fechados virariam
     510 erros na primeira leitura. */
  if (noFormatoNovo(item)) p.push(...problemasDoFormato(item))
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
    const p = problemas(o, catalogoDe(arquivo))
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

/* 07/10, medido às 21h de Brasília: com a data em UTC, o "mexido" virava o dia três horas antes do relógio dele, e a
   trava do Nisaba (que pede tarefa andando mexida HOJE) barrava todo trabalho das 21h à meia-noite. Dia local. */
const hoje = () => diaLocal()

/** O próximo id livre, no prefixo dado. Nunca reusa número morto. */
export function proximoId(itens, prefixo = 'CC') {
  let maior = 0
  for (const i of itens) {
    const m = String(i.id || '').match(/^([A-Z]{2,4})-(\d+)$/)
    if (m && m[1] === prefixo) maior = Math.max(maior, Number(m[2]))
  }
  return `${prefixo}-${maior + 1}`
}

/**
 * Acrescenta um item, já validado. Devolve o item gravado.
 *
 * ⚠️ **Item novo NÃO NASCE fora do formato**, e é escolha dele de 11/09,
 * perguntado na hora: o comando recusa e diz o que falta. O outro caminho era
 * deixar nascer torto e cobrar depois numa lista, e lista de cobrança é o que
 * este projeto já viu apodrecer três vezes.
 *
 * `permitirAntigo` existe para UM caso, e só: trazer para o dado o que já
 * estava escrito em prosa (a migração, e os 543 itens de antes). Quem chama
 * declara, e o padrão é recusar.
 */
export function acrescentar(campos, arquivo = caminhoPadrao()) {
  const { itens } = ler(arquivo)
  /* Padrão de projeto, decisão dele em 01/10: a micro tarefa é FILHA de um item,
     no mesmo arquivo (um lugar só para tarefa). Ela herda do pai o que é do
     pai (frente, natureza, área) e nasce pequena. */
  const pai = campos.pai ? itens.find((x) => x.id === campos.pai) : null
  if (campos.pai && !pai) throw new Error(`item recusado: o pai ${campos.pai} não existe`)
  if (pai?.pai) throw new Error(`item recusado: ${pai.id} já é filho de ${pai.pai}; micro tarefa não tem neta`)
  if (pai) {
    campos = { ...campos, frente: campos.frente && campos.frente !== 'sem frente' ? campos.frente : pai.frente, natureza: campos.natureza || pai.natureza, area: campos.area || pai.area, tamanho: campos.tamanho || 'P' }
  }
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
    /* Os campos do formato novo. `null` quando quem chamou não passou, e aí a
       recusa abaixo explica o que falta, em vez de gravar meio item. */
    natureza: campos.natureza || null,
    area: campos.area || null,
    tamanho: campos.tamanho || null,
    intencao: campos.intencao || null,
    pronto: campos.pronto || null,
    conferir: campos.conferir || null,
    trava: campos.trava || null,
    risco: campos.risco || null,
    ...(campos.pai ? { pai: campos.pai } : {}),
    ...(campos.arquivos?.length ? { arquivos: campos.arquivos } : {}),
    ...(campos.lugar ? { lugar: campos.lugar } : {}),
  }
  /* O título continua existindo para quem lê de fora do painel, mas quem manda
     é a intenção: sem título, ele é escrito a partir dela. */
  if (!item.titulo && item.intencao) item.titulo = item.intencao
  /* `problemas()` já cobra o formato quando o item JÁ está nele; aqui a cobrança
     é do item que nem começou. Sem o `Set`, quem manda meio formato recebia a
     mesma queixa duas vezes. */
  const p = new Set(problemas(item, catalogoDe(arquivo)))
  if (!campos.permitirAntigo) for (const x of problemasDoFormato(item)) p.add(x)
  if (p.size) throw new Error(`item recusado: ${[...p].join('; ')}`)
  if (itens.some((i) => i.id === item.id)) throw new Error(`id repetido: ${item.id}`)
  itens.push(item)
  gravar(itens, arquivo)
  registrar([{ tipo: 'criada', id: item.id, estado: item.estado, ...(item.pai ? { pai: item.pai } : {}), ...(item.citacao ? { texto: item.citacao } : {}) }], arquivo)
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
  // CC-835: a regra de estado mora em tarefa.mjs (tabela, guardas e efeitos), uma conta só
  const r = transicionar(itens, id, estado, extras, { hoje: hoje(), validar: (x) => problemas(x, catalogoDe(arquivo)) })
  gravar(r.itens, arquivo)
  // CC-836: a mudança vai para o diário com o motivo que veio junto (prova, porque, decisão)
  const motivo = extras.prova || extras.porque || extras.decisao
  registrar(r.eventos.map((e) => (e.id === id && motivo && !e.porque ? { ...e, porque: String(motivo).slice(0, 500) } : e)), arquivo)
  return r.item
}

/* ===================================================================
   CC-836 (Nisaba): o diário da tarefa. Só por acréscimo.
   Pedido dele: "aquelas minhas palavras que eu falaria poderiam ficar
   registradas ali dentro". Mora ao lado do backlog, um evento por linha:
   o estado atual está no backlog, e a HISTÓRIA de como chegou lá, aqui.
   =================================================================== */

export const caminhoEventos = (arquivo = caminhoPadrao()) => path.join(path.dirname(arquivo), 'eventos.jsonl')

/** Acrescenta eventos. Nunca reescreve: `appendFileSync` de linhas inteiras. */
export function registrar(eventos, arquivo = caminhoPadrao()) {
  if (!eventos?.length) return 0
  const em = new Date().toISOString()
  const corpo = eventos.map((e) => JSON.stringify({ em, ...e })).join('\n') + '\n'
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.appendFileSync(caminhoEventos(arquivo), corpo, 'utf8')
  return eventos.length
}

export const TIPOS_DE_FALA = ['fala', 'decisao', 'nota']

/** Uma fala no debate de uma tarefa. `de` é quem falou: felipe, agente, robo. */
export function debater(id, texto, { de = 'felipe', tipo = 'fala' } = {}, arquivo = caminhoPadrao()) {
  if (!ler(arquivo).itens.some((x) => x.id === id)) throw new Error(`não achei ${id}`)
  if (!TIPOS_DE_FALA.includes(tipo)) throw new Error(`tipo de fala desconhecido: ${tipo} (vale ${TIPOS_DE_FALA.join(', ')})`)
  if (!String(texto || '').trim()) throw new Error('fala vazia')
  registrar([{ tipo, id, de, texto: String(texto).trim() }], arquivo)
}

/** A história de uma tarefa e das micro tarefas dela, em ordem. */
export function historia(id, arquivo = caminhoPadrao()) {
  const filhas = new Set(filhasDe(ler(arquivo).itens, id).map((x) => x.id))
  let cru = ''; try { cru = fs.readFileSync(caminhoEventos(arquivo), 'utf8') } catch { return [] }
  return cru.split(/\r?\n/).filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
    .filter((e) => e.id === id || filhas.has(e.id))
}

/** As micro tarefas de um item, na ordem em que nasceram. */
export function filhasDe(itens, id) {
  return itens.filter((x) => x.pai === id).sort((a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]))
}

/** O andamento de um item pai: quantas micro tarefas fecharam de quantas. `null` sem filhas. */
export function andamento(itens, id) {
  const f = filhasDe(itens, id).filter((x) => x.estado !== 'KO')
  return f.length ? { feitas: f.filter((x) => x.estado === 'OK').length, total: f.length } : null
}

/**
 * CC-557, decisão dele em 28/09: engenharia de "especificação primeiro". Todo
 * item ganha o que é pronto e como conferir, e o agente executa sozinho, em
 * fila, o que ele mesmo prova. A fila tem três grupos, e é a MESMA conta para
 * o comando, a abertura da sessão e o painel:
 *  - sozinho: pronto escrito, conferido por máquina ou por foto (auto, olho),
 *    sem trava dele e sem ser decisão;
 *  - semEspec: falta o pronto ou o como conferir (especificar antes de fazer);
 *  - dele: conferir é dele, trava é dele, ou é uma decisão.
 * Ideia ainda não avaliada (B0) fica de fora: ela não é pedido ainda.
 * CC-958: a ordem é a da fila mista (ordemDaFila), e o que está fora do MVP não entra.
 */
/** CC-958: a ordem do trabalho. 0 andando, 1 agora, 2 fim do dia, 3 sprint atual, 4 fim do sprint, 5 próximos, 6 fim do backlog. */
export function ordemDaFila(itens, { sprint = new Set() } = {}) {
  const porId = new Map(itens.map((x) => [x.id, x]))
  const ref = (x) => (x.pai && porId.get(x.pai)) || x // a micro tarefa vai no lugar do pai
  const lugar = (x) => lugarDe(x) || lugarDe(ref(x))
  const grupo = (x) => {
    if (x.estado === 'EM') return 0
    const l = lugar(x)
    if (l === 'agora') return 1
    if (l === 'dia') return 2
    if (l === 'sprint') return 4
    if (l === 'backlog') return 6
    return sprint.has(x.id) || sprint.has(ref(x).id) ? 3 : 5
  }
  const em = (x) => String((x.lugar || ref(x).lugar)?.em || '')
  const num = (x) => Number(String(x.id).split('-')[1] || 0)
  return (a, b) => grupo(a) - grupo(b) || em(a).localeCompare(em(b)) || String(ref(a).criado || '').localeCompare(String(ref(b).criado || ''))
    || num(ref(a)) - num(ref(b)) || num(a) - num(b) || String(a.id).localeCompare(String(b.id))
}

export function filaDoAgente(itens, { sprint = new Set() } = {}) {
  /* Padrão de projeto (01/10): item que já foi dividido sai da fila enquanto
     tiver micro tarefa aberta; quem anda são as filhas, na ordem. */
  const comFilhaAberta = new Set(itens.filter((x) => x.pai && estaAberto(x)).map((x) => x.pai))
  const porId = new Map(itens.map((x) => [x.id, x]))
  const foraDoMvp = (x) => (lugarDe(x) || lugarDe((x.pai && porId.get(x.pai)) || x)) === 'fora'
  const abertos = itens.filter((x) => estaAberto(x) && !['DE', 'TR', 'B0'].includes(x.estado) && !comFilhaAberta.has(x.id) && !foraDoMvp(x))
  const ordem = ordemDaFila(itens, { sprint })
  const modo = (x) => String(x.conferir || '').split(':')[0]
  const ehDele = (x) => modo(x) === 'dele' || x.trava === 'dele' || x.natureza === 'DEC'
  const temEspec = (x) => String(x.pronto || '').trim().length >= 10 && MODOS_DE_CONFERIR.includes(modo(x))
  const dele = abertos.filter(ehDele).sort(ordem)
  const semEspec = abertos.filter((x) => !ehDele(x) && !temEspec(x)).sort(ordem)
  const sozinho = abertos.filter((x) => !ehDele(x) && temEspec(x)).sort(ordem)
  return { sozinho, semEspec, dele, proximo: [...sozinho, ...semEspec].sort(ordem)[0] || null }
}

/** CC-958: os ids do sprint atual, pela linha `abrir` de docs/sprints.jsonl cuja janela contém agora. Sem linha, vazio. */
export function sprintAtualIds(raiz, agora = Date.now()) {
  let t = ''; try { t = fs.readFileSync(path.join(raiz, 'docs', 'sprints.jsonl'), 'utf8') } catch { return new Set() }
  const rows = t.split(/\r?\n/).filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
  return new Set(rows.find((g) => g.tipo === 'abrir' && Date.parse(g.de) <= agora && agora < Date.parse(g.ate))?.itens || [])
}

/** CC-958: põe um item aberto num lugar da fila, ou tira com 'nenhum'. A ideia (B0) que ganha um lugar fora o "fora" vira definida: o toque dele é a confirmação. */
export function porNoLugar(id, onde, { agora = new Date(), de = 'felipe' } = {}, arquivo = caminhoPadrao()) {
  if (onde !== 'nenhum' && !listaTem(LUGARES, onde)) throw new Error(`lugar desconhecido: ${onde} (vale ${LUGARES.map((l) => l.codigo).join(', ')} ou nenhum)`)
  const i = ler(arquivo).itens.find((x) => x.id === id)
  if (!i) throw new Error(`não achei ${id}`)
  if (!estaAberto(i)) throw new Error(`${id} já fechou: lugar só vale para item aberto`)
  const para = i.estado === 'B0' && !['fora', 'nenhum'].includes(onde) ? 'B1' : i.estado
  const novo = mover(id, para, { lugar: onde === 'nenhum' ? null : { onde, em: agora.toISOString() } }, arquivo)
  registrar([{ tipo: 'lugar', id, de, texto: onde === 'nenhum' ? 'sem lugar: volta para a ordem do Caminho' : LUGARES.find((l) => l.codigo === onde).rotulo }], arquivo)
  return novo
}

/**
 * CC-522/530: o leitor do dia de UM projeto. O que fechou desde ontem (e
 * quanto disso o agente provou sozinho, conferência auto ou olho), o que
 * espera ele (a mesma conta da fila) e o que travou. Calculado na hora a
 * partir do backlog: o "roda de manhã e grava um arquivo" do pedido original
 * vira leitura sob demanda, que dá o mesmo resultado sem mais um processo.
 */
export function leitorDoDia(itens, agora = new Date()) {
  const dia = (d) => d.toISOString().slice(0, 10)
  const ontem = new Date(agora.getTime() - 86400000)
  const recentes = new Set([dia(agora), dia(ontem)])
  const fechados = itens.filter((x) => x.estado === 'OK' && recentes.has(String(x.fechado || '')))
  const sozinho = fechados.filter((x) => /^(auto|olho)/.test(String(x.conferir || '')))
  const f = filaDoAgente(itens)
  const curto = (x) => ({ id: x.id, titulo: x.titulo })
  return {
    fechados: fechados.length,
    sozinho: sozinho.map(curto),
    dele: f.dele.map(curto),
    travados: itens.filter((x) => x.estado === 'TR').map(curto),
  }
}

/** Grava a especificação de um item: o que é pronto e como conferir. */
export function especificar(id, { pronto, conferir } = {}, arquivo = caminhoPadrao()) {
  const { itens } = ler(arquivo)
  const i = itens.find((x) => x.id === id)
  if (!i) throw new Error(`não achei ${id}`)
  const novo = { ...i, mexido: hoje() }
  if (pronto != null) novo.pronto = String(pronto).trim()
  if (conferir != null) novo.conferir = String(conferir).trim()
  const p = problemas(novo, catalogoDe(arquivo))
  if (p.length) throw new Error(p.join('; '))
  itens[itens.indexOf(i)] = novo
  gravar(itens, arquivo)
  return novo
}

/** CC-973: o ajuste dele no modelo e no esforço de uma tarefa. 'criterio' apaga o ajuste e volta para a regra. */
export function ajustarModelo(id, { modelo, esforco } = {}, arquivo = caminhoPadrao()) {
  const { itens } = ler(arquivo)
  const i = itens.find((x) => x.id === id)
  if (!i) throw new Error(`não achei ${id}`)
  const novo = { ...i, mexido: hoje() }
  const campo = (nome, v, lista) => {
    if (v == null) return
    if (v === 'criterio') { delete novo[nome]; return }
    if (!lista.some((x) => x.codigo === v)) throw new Error(`${nome} fora da lista: ${v} (vale ${lista.map((x) => x.codigo).join(', ')} ou criterio)`)
    novo[nome] = v
  }
  campo('modelo', modelo, MODELOS)
  campo('esforco', esforco, ESFORCOS)
  itens[itens.indexOf(i)] = novo
  gravar(itens, arquivo)
  registrar([{ tipo: 'nota', id, de: 'felipe', texto: `modelo ${novo.modelo || 'pelo critério'}, esforço ${novo.esforco || 'pelo critério'}` }], arquivo)
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
  // o mapa é dos pedidos dele; as micro tarefas aparecem como andamento do pai (01/10)
  for (const i of abertos.filter((x) => !x.pai)) {
    if (!porFrente.has(i.frente)) porFrente.set(i.frente, [])
    porFrente.get(i.frente).push(i)
  }
  return {
    existe,
    // as contagens são de pedidos: micro tarefa já aparece como "X de Y" no pai
    total: itens.filter((x) => !x.pai).length,
    abertos: abertos.filter((x) => !x.pai).length,
    fechados: itens.filter((x) => !x.pai && !estaAberto(x)).length,
    porEstado,
    frentes: [...porFrente.entries()].map(([nome, is]) => ({ nome, itens: is })),
    ruins,
    andamentos: Object.fromEntries(abertos.filter((x) => !x.pai).map((x) => [x.id, andamento(itens, x.id)]).filter(([, a]) => a)),
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

/**
 * CC-873: quantos itens há em cada estado (pelo rótulo que a tela mostra). Micro tarefa (item com
 * `pai`) não entra: ela é parte do pai, e contar as duas inflaria o total. Feito primeiro numa
 * cópia de teste do projeto e trazido para cá.
 */
export function contarPorEstado(itens = []) {
  const contagem = {}
  for (const e of ESTADOS) contagem[e.rotulo] = 0
  for (const i of itens) {
    if (i && typeof i === 'object' && i.pai) continue
    const e = estadoDe(i?.estado)
    if (e) contagem[e.rotulo] = (contagem[e.rotulo] || 0) + 1
  }
  return contagem
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
      const a = r.andamentos[i.id]
      l.push(`| ${i.id} | ${e ? e.rotulo : i.estado}${a ? ` · ${a.feitas} de ${a.total}` : ''} | ${i.peso ?? '-'} | ${String(i.titulo).replace(/\|/g, '/')} |`)
    }
    l.push('')
  }
  return l.join('\n')
}

/* Padrão de projeto (01/10): usados pelo maestro, pela entrevista e pelo criador de projeto. */

/** Siglas escolhidas à mão, onde a automática ficaria ruim ou ambígua. */
const SIGLAS = new Map([
  ['cockpit', 'CC'],
  ['inovallbond', 'NV'],
  ['fibraessencia', 'FB'],
  ['boxboutique', 'BX'],
  ['ibrics', 'IB'],
  ['ghoscode', 'GH'],
  ['coepiloto', 'CP'],
  ['productvideomaker', 'PV'],
  ['ratomacaco', 'RM'],
  ['reunion', 'RU'],
  ['rhydon', 'RH'],
  ['carzo', 'CZ'],
  ['vps', 'VP'],
  ['escritorio', 'ES'],
  ['entreg4', 'EN'],
  ['hutukara', 'HK'],
  ['renanmarchon', 'RN'],
  /* `cockpit--front` é OUTRA pasta, com outra branch e outro backlog, e daria
     `CC` pela regra automática. Dois projetos com a mesma sigla viram um item
     só no dia em que dois backlogs forem somados numa tela, e o número fica
     maior e plausível. É o mesmo cuidado da lista de renomeações. */
  ['cockpitfront', 'CF'],
  ['maurice', 'MC'],
  ['sumauma', 'SU'],
  ['mnzs', 'MZ'],
  ['profinance', 'PF'],
  ['ahtleta', 'AT'],
  ['geolev4', 'GL'],
  // 01/10: as duas saíam HT, e pierre saía PR, que é o código do estado "prova"
  ['ahtletacorrida', 'AC'],
  ['ahtletaescalada', 'AE'],
  ['pierre', 'PI'],
])

/**
 * A sigla de um projeto: duas ou três letras, estáveis.
 *
 * Estável importa mais que bonita: a sigla vira parte do id, e id que muda
 * quebra toda referência já escrita. Por isso a lista acima é explícita, e a
 * regra automática só cobre o que não está nela.
 */
export function siglaDe(projeto) {
  // desde 23/08 as pastas têm prefixo de máquina: sem tirar, `VPS_inovallbond` virava `VP`
  const cru = String(projeto || '').replace(/^(VPS|PC)_/i, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (SIGLAS.has(cru)) return SIGLAS.get(cru)
  // CC-945: id é XX-000, só letras na sigla; pasta '9' ou 'd3' dava sigla com dígito e todo item era recusado
  const letras = cru.replace(/[0-9]/g, '')
  const consoantes = letras.replace(/[aeiou]/g, '')
  const fonte = consoantes.length >= 2 ? consoantes : letras
  const base = fonte.slice(0, 2).toUpperCase()
  if (base.length < 2) return 'XX'
  // sigla igual a código de estado (PR, DE, TR...) confunde a leitura do id
  return ehEstado(base) ? fonte.slice(0, 3).toUpperCase() : base
}

/** Prefixo dos ids do projeto: o que o backlog já usa, senão a sigla do projeto. */
export function prefixoDoProjeto(itens, cwd) {
  const conta = {}
  for (const i of itens) { const m = String(i.id).match(/^([A-Z]{2,4})-\d+$/); if (m) conta[m[1]] = (conta[m[1]] || 0) + 1 }
  const usado = Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0]
  return usado || siglaDe(path.basename(cwd))
}

/** O ROADMAP sai do backlog quando ele não existe ou já é gerado; o escrito à mão não é tocado. */
export function regerarRoadmap(raiz) {
  const alvo = path.join(raiz, 'docs', 'ROADMAP.md')
  let atual = null; try { atual = fs.readFileSync(alvo, 'utf8') } catch { /* não existe */ }
  if (atual != null && !atual.includes('GERADO por src/backlog.mjs')) return false
  /* 02/10, no teste de liberação: projeto que tem o PRÓPRIO gerador (uma cópia
     do cockpit) gera com o dele. Gerar com este aqui deu "114 abertos" contra
     "115" pela conta da cópia, e o teste dela reprovou o pedido inteiro. */
  const proprio = path.join(raiz, 'cc.mjs')
  if (fs.existsSync(path.join(raiz, 'src', 'backlog.mjs')) && fs.existsSync(proprio) && path.resolve(raiz) !== path.resolve(new URL('..', import.meta.url).pathname)) {
    const r = spawnSync(process.execPath, [proprio, 'backlog', 'gerar'], { cwd: raiz, timeout: 60000, stdio: 'ignore' })
    return r.status === 0
  }
  fs.writeFileSync(alvo, comoMarkdown(caminhoPadrao(raiz)), 'utf8')
  return true
}
