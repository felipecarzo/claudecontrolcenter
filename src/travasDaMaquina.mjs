/**
 * CC-340 — o retrato das travas e do framework DESTA máquina, para viajar na
 * federação.
 *
 * ## Por que existe
 *
 * Pergunta dele em 25/08, sobre o PC: *"ueh, mas os ganchos tão registrados lá,
 * não estão?"*. Medido na hora: **ninguém tinha como responder**. O pacote que o
 * PC empurra carrega jobs, servidores, uso, tempo, rotas, backlogs, agentes e
 * limites, e não carrega nem os ganchos registrados nem o estado do framework.
 *
 * O estrago não é a falta do campo, é o que ela produz: a lista de pendências
 * dele guardava havia dez dias um "registrar o hook no PC" que **não dava para
 * confirmar nem para fechar de nenhum dos dois lados**. É o mesmo formato de
 * defeito das rotinas que apontavam para o lugar errado: some do radar porque
 * ninguém desobedeceu.
 *
 * ## O que é barato aqui, e por que isso importa
 *
 * `montarPacote` recebe os dados prontos de propósito, para a montagem nunca
 * disparar a varredura de 800 MB da aba tempo dentro do tique. Este módulo
 * respeita a mesma regra por outro caminho: ele é barato de verdade. Lê UM
 * arquivo de configuração e um `estado.json` por projeto citado nos jobs, que
 * são meia dúzia. Nada de varrer disco, nada de listar projeto.
 *
 * ## `null` nunca quer dizer zero
 *
 * A federação inteira trata campo ausente e campo vazio como coisas diferentes,
 * e aqui isso é a diferença entre "esta máquina não sabe dizer" e "sabe, e não
 * tem nenhum". Uma tela que confunde os dois afirma que as travas estão
 * desligadas quando na verdade a leitura falhou, que é a família de defeito mais
 * cara deste painel.
 */
import fs from 'node:fs'
import path from 'node:path'
import { HOOKS, MODULOS } from './hooksCatalogo.mjs'
import { hookEnabled, moduloLigado, readConfig } from './config.mjs'
import { readSettings, registrado } from './hooksRegistro.mjs'
import { PASTA, ARQUIVO } from './frameworkDisco.mjs'

/**
 * As travas do catálogo, uma linha por hook implementado.
 *
 * Dois estados independentes, e confundir os dois é justamente o que deixou o
 * assunto no escuro:
 *
 * - `registrado`: está no `settings.json` do Claude Code desta máquina. Sem
 *   isso o hook não roda, não importa o interruptor.
 * - `ligado`: o interruptor global do painel. Um hook registrado e desligado
 *   também não faz nada, e é um caso bem diferente de não estar registrado.
 *
 * Devolve `null` quando o arquivo de configuração não pôde ser lido: aí não se
 * sabe nada sobre nenhum hook, e dizer "nenhum registrado" seria inventar.
 */
export function travasDaqui() {
  const settings = readSettings()
  if (!settings) return null
  const cfg = readConfig()
  return HOOKS
    .filter((h) => h.implementado)
    .map((h) => ({
      id: h.id,
      evento: h.evento,
      registrado: registrado(h, settings),
      /* `dir` nulo de propósito: é o interruptor GLOBAL, e a pasta em que o
         empurrador está rodando não pode colorir o retrato que viaja (mesma
         razão da lista do `cc hooks`, CC-115). */
      ligado: hookEnabled(h.id, cfg, null),
    }))
}

/**
 * O framework dos projetos que esta máquina realmente usou, tirado dos `cwd`
 * dos jobs que já estão no pacote.
 *
 * Sai dos jobs, e não de uma varredura da pasta de projetos, por duas razões:
 * é barato, e é a mesma fonte que `raizDoCockpit` já usa para descobrir onde o
 * projeto mora naquela máquina. Projeto que ninguém abriu não interessa aqui.
 *
 * Lê o arquivo cru, sem passar por `ler()`, de propósito: `ler()` sobrepõe modo
 * por rota e por sessão, e o que precisa viajar é o estado DO PROJETO. O modo de
 * uma sessão do PC não é fato sobre o projeto.
 */
export function frameworkDaqui(jobs = []) {
  /* CC-352: o mesmo nome pode vir de duas pastas, e ganha a mais recente.
     Mesma regra de `projetosDe`, e pelo mesmo motivo: com ele movendo projetos
     de lugar, o retrato do framework saía da pasta que aparecesse primeiro na
     lista, não da que ele está usando. */
  const raizes = new Map()
  const quando = new Map()
  for (const j of jobs) {
    const cwd = j?.cwd
    if (!cwd || typeof cwd !== 'string') continue
    const nome = j.project || path.basename(cwd)
    const t = Number(j.updatedAt) || 0
    if (!raizes.has(nome) || t > (quando.get(nome) || 0)) {
      raizes.set(nome, cwd)
      quando.set(nome, t)
    }
  }

  const saida = []
  for (const [projeto, raiz] of raizes) {
    /* Sobe a árvore igual `acharRaiz`, mas sem importá-la: o `cwd` de um job
       costuma ser uma subpasta do projeto, e parar na primeira tentativa faria
       o framework parecer ausente em quase todo mundo. */
    let atual = raiz
    let achado = null
    for (let i = 0; i < 40; i++) {
      const alvo = path.join(atual, PASTA, ARQUIVO)
      if (fs.existsSync(alvo)) { achado = alvo; break }
      const pai = path.dirname(atual)
      if (pai === atual) break
      atual = pai
    }
    if (!achado) { saida.push({ projeto, existe: false, ligado: false }); continue }
    try {
      const estado = JSON.parse(fs.readFileSync(achado, 'utf8'))
      saida.push({
        projeto,
        existe: true,
        /* `ligado` ausente conta como ligado: é o formato que `iniciar()`
           gravava antes do campo existir, e estado antigo não pode virar
           projeto destravado de surpresa. Mesma regra de `situacao()`. */
        ligado: estado.ligado !== false,
        modo: estado.modo || null,
        fase: estado.fase || null,
        perfil: estado.perfil || null,
        /* CC-344: quais grupos de trava estão valendo NAQUELE projeto.
           Moram no config da máquina, não no `estado.json` do projeto, e é por
           isso que não saem da leitura acima. Sem eles a outra ponta desenha o
           modo e não tem como desenhar as travas, que foi o que ele estranhou:
           ligou o modo e a lista continuou sem aparecer. */
        modulos: Object.fromEntries(Object.keys(MODULOS).map((m) => [m, moduloLigado(m, projeto)])),
      })
    } catch {
      /* Arquivo ilegível não é projeto sem framework: é leitura que falhou, e a
         tela precisa poder dizer isso em vez de afirmar o contrário. */
      saida.push({ projeto, existe: true, ligado: null, erro: 'não deu para ler' })
    }
  }
  return saida
}

/** O retrato inteiro, do jeito que entra no pacote. */
export function retratoDaqui(jobs = []) {
  return { travas: travasDaqui(), framework: frameworkDaqui(jobs), em: Date.now() }
}

/**
 * O mesmo retrato, com cache curto, para o caminho de 2 em 2 segundos.
 *
 * A tela precisa mostrar a máquina LOCAL do lado das remotas, senão não há o
 * que comparar e a pergunta que originou tudo isto continua sem resposta de um
 * dos lados. Só que `/api/jobs` responde a cada dois segundos, e ler o
 * `settings.json` mais um `estado.json` por projeto nesse ritmo é trabalho de
 * disco que ninguém pediu.
 *
 * 30 segundos é o mesmo ritmo em que o retrato já viaja na federação: mais que
 * isso a tela ficaria mais velha que a da outra máquina, o que seria absurdo, e
 * menos não melhora nada — registrar um hook é coisa que se faz uma vez.
 */
const CACHE_MS = 30_000
let cache = null

export function retratoComCache(jobs = [], now = Date.now()) {
  if (cache && now - cache.em < CACHE_MS) return cache.valor
  const valor = { travas: travasDaqui(), framework: frameworkDaqui(jobs) }
  cache = { em: now, valor }
  return valor
}

/** Para o gate: cache que sobrevive entre casos esconderia o caso seguinte. */
export function limparCache() { cache = null }
