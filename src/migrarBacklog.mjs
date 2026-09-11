/**
 * Levar um `ROADMAP.md` em prosa para o backlog em dado.
 *
 * ## Por que existe
 *
 * O backlog deste projeto virou dado em 11/09 e os itens sem identificador
 * caíram de 67% para zero. Os outros 27 projetos continuaram em prosa, e no
 * quadro inteiro ainda eram **111 de 210 cartões sem id**, com o painel
 * inventando `#01`, `#02` para conseguir desenhar.
 *
 * Queixa dele, e ela vale para todos: *"as ias criam os documentos meio que
 * dentro de um padrão, mas um padrão que não tem tag (…) não tem como rodar um
 * hook ou um script que transforme isso em dado real"*.
 *
 * ## As três decisões que evitam estrago
 *
 * 1. **Nunca apaga o `ROADMAP.md` do projeto.** Só ACRESCENTA
 *    `docs/backlog.jsonl` ao lado. O leitor prefere o dado quando ele existe,
 *    então a migração vale na hora, e desfazer é apagar um arquivo. Migração
 *    que destrói a fonte não tem volta, e são 27 projetos de clientes.
 * 2. **Recusa gravar por cima de um backlog que já existe**, a não ser com
 *    `forcar`. Rodar duas vezes não pode perder o que foi mexido no meio.
 * 3. **Prefixo por projeto, derivado do nome.** `inovallbond` vira `NV`,
 *    `fibraessencia` vira `FB`. Id repetido entre projetos não quebra nada
 *    hoje, mas o dia em que dois backlogs forem somados numa tela só, dois
 *    `CC-12` diferentes viram um item só, e o número fica plausível.
 *
 * ## O que a prosa consegue dizer, e o que não
 *
 * O estado sai do emoji do título, que é o único sinal inequívoco que existe
 * em prosa: `✅` fechado, `⏸`/`🔵` decisão dele, `🟡` falta prova, `⛔` travado.
 * Sem emoji, entra como `B1` (definida). Item já fechado leva a própria linha
 * do título como prova, porque é lá que as provas foram escritas.
 *
 * **Um número citado no texto sem seção própria vira `KO` com o motivo**, e não
 * um item aberto: ninguém sabe o estado dele, e deixá-lo aberto encheria o
 * quadro de trabalho que talvez nem exista. O texto original continua no
 * `ROADMAP.md`, que não é apagado.
 */

import fs from 'node:fs'
import path from 'node:path'
import { gravar, problemas } from './backlog.mjs'
import { nascimentos } from './roadmap.mjs'

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
])

/**
 * A sigla de um projeto: duas ou três letras, estáveis.
 *
 * Estável importa mais que bonita: a sigla vira parte do id, e id que muda
 * quebra toda referência já escrita. Por isso a lista acima é explícita, e a
 * regra automática só cobre o que não está nela.
 */
export function siglaDe(projeto) {
  const cru = String(projeto || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (SIGLAS.has(cru)) return SIGLAS.get(cru)
  const consoantes = cru.replace(/[aeiou]/g, '')
  const base = (consoantes.length >= 2 ? consoantes : cru).slice(0, 2)
  return (base || 'XX').toUpperCase()
}

/**
 * Limpa o texto para virar título de item.
 *
 * **O travessão sai aqui, e não é preciosismo.** O título do item vira cartão
 * na tela do telefone dele, e travessão é a regra número 1 do arquivo de
 * instruções: *"o travessão é a marca registrada de texto escrito por máquina,
 * e o Felipe reconhece na hora"*. Os roadmaps antigos estão cheios deles, e sem
 * esta troca a migração levaria centenas para dentro da tela de uma vez. O gate
 * deste projeto pegou isso na primeira execução depois da migração.
 *
 * Vira dois pontos quando separa duas ideias, e some quando está solto.
 */
const limpar = (s) => String(s)
  .replace(/[*`_]/g, '')
  .replace(/\s+[—–]\s+/g, ': ')
  .replace(/[—–]/g, '-')
  .replace(/\s+/g, ' ')
  .replace(/:\s*:/g, ':')
  .trim()

function estadoDoTitulo(t) {
  if (/✅|✔|☑/.test(t)) return 'OK'
  /* `❌` no título é item recusado, e o contrato exige motivo para cancelar.
     A linha do título é o motivo que a prosa tem, e sem isto a migração
     recusava o projeto inteiro por causa de um item. Medido na reconstrução
     do próprio cockpit, em 11/09. */
  if (/❌/.test(t)) return 'KO'
  if (/⏸|🔵/.test(t)) return 'DE'
  if (/🟡/.test(t)) return 'PR'
  if (/⛔/.test(t)) return 'TR'
  return 'B1'
}

const MARCADORES = /[🔴🟡🟢🔵⚪⚫🔥✅✔☑❌⛔⏳📌⏸▶►▸➤⏭🚧🆕⭐⚠️]/gu

/**
 * Lê um `ROADMAP.md` e devolve os itens, sem gravar nada.
 *
 * Separado de `migrar()` de propósito: dá para ver o que sairia antes de
 * escrever, e o ensaio usa exatamente este caminho.
 */
export function extrair(texto, { sigla = 'XX', hoje = new Date().toISOString().slice(0, 10), soTitulos = false } = {}) {
  /* `\r?\n` e não `\n`: metade dos arquivos deste ecossistema é CRLF, e um
     `\r` sobrando já zerou um parser inteiro aqui. */
  const linhas = String(texto).split(/\r?\n/)
  const itens = new Map()
  let frente = 'sem frente'
  let dataDaFrente = null
  let n = 0

  for (const l of linhas) {
    if (/^##\s+(?!#)/.test(l)) {
      frente = limpar(l.replace(/^#+\s*/, '')).replace(MARCADORES, '').replace(/^[\s:·-]+/, '').slice(0, 60) || 'sem frente'
      const d = l.match(/(\d{2})\/(\d{2})/)
      dataDaFrente = d ? `${hoje.slice(0, 4)}-${d[2]}-${d[1]}` : null
      continue
    }
    /* **Item de LISTA também é item, e ignorar isso deixava projeto inteiro
       de fora.** Medido no ensaio de 11/09: `productVideoMaker` e `escritorio`
       escrevem tudo em `- [ ]` dentro de `##`, e o migrador dizia "nenhum item
       que eu saiba ler" nos dois. O leitor de roadmap do painel já entendia
       esse formato desde sempre: o migrador é que estava mais burro que ele.
       `[x]` marcado é item fechado; a prova é a própria linha, que é o que a
       prosa tem. */
    const daLista = soTitulos ? null : /^\s*[-*]\s+(?:\[([ xX])\]\s+)?(.+)$/.exec(l)
    if (!/^#{3,4}\s+/.test(l)) {
      if (!daLista) continue
      const texto = limpar(daLista[2])
      /* Linha de lista curta demais é enumeração de prosa, não tarefa. O corte
         em 12 é o mesmo piso que o resto do projeto usa para "tem conteúdo". */
      if (texto.length < 12) continue
      /* Fechado por DUAS vias, e a primeira versão só via uma: o `[x]` da
         caixinha e o `✅` escrito no meio do texto. Medido no ensaio: 20 itens
         do `fibraessencia` fechavam pelo emoji e saíam sem prova, e o contrato
         recusava o projeto inteiro por causa disso. A prova é a própria linha
         nos dois casos, que é o que a prosa tem para dar. */
      const marcado = (daLista[1] && daLista[1].toLowerCase() === 'x') || estadoDoTitulo(l) === 'OK'
      const achadoL = l.match(/\b([A-Z]{2,4})-(\d{1,4})\b/)
      const idL = achadoL ? `${achadoL[1]}-${achadoL[2]}` : `${sigla}-${String(++n).padStart(3, '0')}`
      if (itens.has(idL)) continue
      itens.set(idL, {
        id: idL,
        titulo: texto.replace(/\b[A-Z]{2,4}-\d{1,4}\b/, '').replace(MARCADORES, '').replace(/^[\s:·-]+/, '').slice(0, 160) || idL,
        estado: marcado ? 'OK' : estadoDoTitulo(l),
        frente,
        peso: null,
        /* Item de lista quase nunca traz data própria: a data que existe é a
           do cabeçalho da frente, herdada em `dataDaFrente`. Sem ela, todo
           item de lista nasceria com a idade de hoje, que é a mentira que o
           ramo de cima acabou de consertar. */
        criado: dataDaFrente || hoje,
        mexido: dataDaFrente || hoje,
        fechado: marcado ? hoje : undefined,
        prova: marcado ? texto.slice(0, 220) : null,
        /* Mesmo motivo do ramo de cima, e o gate pegou este segundo caminho
           depois do primeiro: cancelado e travado exigem motivo escrito, e a
           própria linha é o motivo que a prosa tem. Dois ramos com a mesma
           regra é onde este projeto mais erra. */
        porque: ['KO', 'TR'].includes(marcado ? 'OK' : estadoDoTitulo(l)) ? `herdado do roadmap em prosa: ${texto.slice(0, 150)}` : null,
        decisao: (marcado ? 'OK' : estadoDoTitulo(l)) === 'DE' ? 'herdado do roadmap em prosa: ver a seção original' : null,
        citacao: null,
        depende: [],
        origem: 'migrado-de-lista',
      })
      continue
    }

    const achado = l.match(/\b([A-Z]{2,4})-(\d{1,4})\b/)
    const estado = estadoDoTitulo(l)
    const id = achado ? `${achado[1]}-${achado[2]}` : `${sigla}-${String(++n).padStart(3, '0')}`
    if (itens.has(id)) {
      /* Citado duas vezes: fechado vence, porque fechar é o fato mais recente. */
      const ja = itens.get(id)
      if (estado === 'OK' && ja.estado !== 'OK') { ja.estado = 'OK'; ja.prova = limpar(l).slice(0, 220); ja.fechado = hoje }
      continue
    }

    const titulo = limpar(l.replace(/^#+\s*/, '').replace(/\b[A-Z]{2,4}-\d{1,4}\b/, '').replace(MARCADORES, ''))
      .replace(/^[\s:·-]+/, '').slice(0, 160) || id
    const data = l.match(/(\d{2})\/(\d{2})/)
    const nascido = data ? `${hoje.slice(0, 4)}-${data[2]}-${data[1]}` : hoje

    itens.set(id, {
      id,
      titulo,
      estado,
      frente,
      peso: null,
      criado: nascido,
      /* **`mexido` herda a data do texto, e a primeira versão punha `hoje`.**
         Isso apagava a idade de todo item migrado, e a idade é justamente o
         sinal que ele pediu: *"tem tarefas ainda do jogo que já tá pronto a
         muito mais de 1 mês"*. Com tudo carimbado de hoje, nada aparecia como
         parado, e o quadro nascia mentindo que estava tudo fresco. */
      mexido: nascido,
      fechado: estado === 'OK' ? hoje : undefined,
      prova: estado === 'OK' ? limpar(l).slice(0, 220) : null,
      porque: estado === 'TR' || estado === 'KO' ? `herdado do roadmap em prosa: ${limpar(l).slice(0, 150)}` : null,
      decisao: estado === 'DE' ? 'herdado do roadmap em prosa: ver a seção original' : null,
      citacao: null,
      depende: [],
      origem: 'migrado-do-roadmap',
    })
  }

  /* Número citado no corpo sem seção própria. Entra como cancelado com o
     motivo, porque "estado desconhecido" não pode posar de trabalho aberto. */
  const inteiro = linhas.join('\n')
  for (const m of inteiro.matchAll(/\b([A-Z]{2,4})-(\d{1,4})\b/g)) {
    const id = `${m[1]}-${m[2]}`
    if (itens.has(id)) continue
    itens.set(id, {
      id,
      titulo: 'citado no roadmap sem seção própria, estado nunca declarado',
      estado: 'KO',
      frente: 'herdado sem estado',
      peso: null,
      criado: hoje,
      mexido: hoje,
      prova: null,
      porque: 'o número aparecia no texto sem seção que dissesse o que era nem se fechou. Cancelado para não posar de trabalho aberto; o texto original continua no ROADMAP.md, que não foi apagado',
      decisao: null,
      citacao: null,
      depende: [],
      origem: 'migrado-fantasma',
    })
  }

  return [...itens.values()]
}

export const caminhoRoadmap = (raiz) => {
  for (const p of [['docs', 'ROADMAP.md'], ['ROADMAP.md'], ['docs', 'roadmap.md']]) {
    const alvo = path.join(raiz, ...p)
    try { if (fs.statSync(alvo).isFile()) return alvo } catch { /* segue */ }
  }
  return null
}

/**
 * Migra um projeto. Devolve sempre o que fez ou por que não fez, nunca lança.
 *
 * Falhar em voz alta, projeto a projeto: uma exceção no meio de 27 pararia a
 * migração e deixaria metade feita, que é o pior dos estados.
 */
export function migrar(raiz, { projeto = path.basename(raiz), ensaio = false, forcar = false, soTitulos = false } = {}) {
  const destino = path.join(raiz, 'docs', 'backlog.jsonl')
  if (fs.existsSync(destino) && !forcar) {
    return { projeto, ok: false, motivo: 'já tem backlog em dado: não sobrescrevo sem --forcar' }
  }
  /* ⚠️ **Cópia antes de sobrescrever, e ela nasceu de um estrago de verdade.**
   *
   * Em 11/09 rodei a migração com `--forcar` em todos os projetos para aplicar
   * um conserto, e ela passou por cima do backlog do PRÓPRIO cockpit, que
   * estava curado à mão (30 itens abertos, frentes arrumadas). Sobraram 4
   * itens, e a recuperação custou meia hora de reconstrução.
   *
   * `--forcar` é para reaplicar a extração, não para perder trabalho humano.
   * Vale a mesma lição do `notes.mjs`: arquivo que alguém edita à mão e que não
   * tem outra fonte precisa de cópia antes de ser reescrito. */
  if (fs.existsSync(destino) && forcar && !ensaio) {
    try { fs.copyFileSync(destino, destino + '.bak') } catch { /* sem cópia é melhor que não migrar, mas tentamos */ }
  }
  const fonte = caminhoRoadmap(raiz)
  if (!fonte) return { projeto, ok: false, motivo: 'não tem roadmap para migrar' }

  let texto
  try { texto = fs.readFileSync(fonte, 'utf8') } catch (e) { return { projeto, ok: false, motivo: `não consegui ler: ${e.message}` } }

  const itens = extrair(texto, { sigla: siglaDe(projeto), soTitulos })

  /* **A idade vem do GIT, e sem isso a migração apaga o sinal mais útil.**
   *
   * Medido em 11/09: o roadmap do `inovallbond` não tem data em cabeçalho
   * nenhum, então o extrator carimbava tudo com hoje e os 102 itens abertos
   * nasciam "frescos". O caso que ele levantou (*"tarefas ainda do jogo que já
   * tá pronto a muito mais de 1 mês"*) ficava invisível justo na migração que
   * deveria expô-lo.
   *
   * `nascimentos()` já existe e já era usada pelo quadro: é o commit em que a
   * linha do item apareceu pela primeira vez. Reusar é obrigatório aqui, não
   * elegante. Duas contas de "quando isto nasceu" discordariam no dia em que
   * alguém renomeasse um item, e o sintoma seria idade sumindo de uma tela e
   * não da outra. */
  try {
    const quando = nascimentos(raiz)
    if (quando.size) {
      for (const i of itens) {
        const t = quando.get(i.id) || quando.get(String(i.titulo).slice(0, 40).toLowerCase())
        if (!t) continue
        const dia = new Date(t).toISOString().slice(0, 10)
        i.criado = dia
        /* `mexido` só anda para TRÁS aqui: um item pode ter nascido em agosto e
           ter sido mexido ontem, e a migração não sabe disso. Dizer que parou
           em agosto seria inventar parado; dizer hoje seria apagar a idade.
           O nascimento é o que a prosa consegue provar. */
        if (!i.fechado) i.mexido = dia
      }
    }
  } catch { /* sem git, ou repositório estranho: fica a data do texto */ }
  if (!itens.length) return { projeto, ok: false, motivo: 'o roadmap não tem nenhum item que eu saiba ler' }

  const ruins = itens.flatMap((i) => problemas(i).map((p) => `${i.id}: ${p}`))
  if (ruins.length) return { projeto, ok: false, motivo: `${ruins.length} item(ns) fora do contrato: ${ruins[0]}` }

  const abertos = itens.filter((i) => i.estado !== 'OK' && i.estado !== 'KO').length
  if (!ensaio) {
    try { gravar(itens, destino) } catch (e) { return { projeto, ok: false, motivo: `não consegui gravar: ${e.message}` } }
  }
  return { projeto, ok: true, total: itens.length, abertos, fechados: itens.length - abertos, destino, ensaio }
}
