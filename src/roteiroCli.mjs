/**
 * CC-1081: `cc roteiro <sub>`, a linha de comando do roteiro de uso.
 *
 * Quem opera é trocável: ele no terminal, uma IA pelos mesmos comandos, ou o
 * programa nas partes que são medição. Sem subcomando, MOSTRA a próxima
 * pergunta e para (como `framework entrevista`): quem responde é quem opera.
 *
 * `main(argv)` recebe os argumentos DEPOIS de `roteiro` (um `roteiro` na frente
 * também é aceito) e lê as próprias flags, então o `cc.mjs` não precisa
 * registrar nenhuma delas. O projeto avaliado é a pasta atual, ou `--projeto <pasta>`.
 *
 * O navegador mora em outros dois arquivos, carregados SÓ quando o comando
 * pede (`mapa` e `agente`): se um deles faltar, a mensagem diz isso e o resto
 * do roteiro continua funcionando.
 */
import { existsSync, statSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import * as R from './roteiro.mjs'

const CMD = R.CMD

const USO = `uso: ${CMD} [status]
     ${CMD} responder "<texto>" [--de ia:<modelo> | --de ele --citacao "<palavras dele>"]
     ${CMD} confirmar <id> [--citacao "<palavras dele>"]
     ${CMD} desfazer <id>
     ${CMD} tarefa "<objetivo>" --sucesso "<texto visível>" [--de ia:<modelo> | --de ele --citacao "<palavras dele>"]
     ${CMD} mapa <url> [--max N] [--prazo <minutos>] [--nao-tocar "<regex>" | --nao-tocar-so "<regex>"] [--idioma pt-BR] [--qualquer-url]
     ${CMD} agente <T1> --cerebro humano --quem "<nome>" | "comando:..." | roteiro:<arquivo> [--persona x] [--vezes 3] [--nao-tocar "<regex>" | --nao-tocar-so "<regex>"] [--idioma pt-BR] [--qualquer-url]
     ${CMD} achados
     ${CMD} relatorio
     (em outra pasta: --projeto <pasta>)
     Sem terminal de verdade (uma IA rodando o comando): responder e tarefa exigem --de, e quem fala por ele
     (--de ele, e confirmar) exige --citacao com as palavras dele. O navegador só abre file://, localhost,
     127.0.0.1 e https://testedevoo.carzo.com.br, a menos que se passe --qualquer-url.`

/* ===================================================================== */
/* Argumentos                                                             */
/* ===================================================================== */

/** Flags que comem o argumento seguinte. Esquecer uma aqui faria o valor virar posicional. */
const COM_VALOR = new Set(['--projeto', '--dir', '--de', '--sucesso', '--estado', '--papel', '--cerebro', '--persona', '--vezes', '--max', '--prazo', '--nao-tocar', '--nao-tocar-so', '--idioma', '--citacao', '--quem'])

export function analisar(argv) {
  const pos = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    let a = String(argv[i])
    if (!a.startsWith('--')) { pos.push(a); continue }
    let valor
    const igual = a.indexOf('=')
    if (igual > 0) { valor = a.slice(igual + 1); a = a.slice(0, igual) }
    if (COM_VALOR.has(a)) (flags[a] ||= []).push(valor ?? String(argv[++i] ?? ''))
    else flags[a] = [true]
  }
  return { pos, flag: (n) => flags[n]?.[0], todos: (n) => flags[n] || [], tem: (n) => n in flags }
}

function falhar(msg) {
  console.error(msg)
  process.exitCode = 1
  return 1
}

/**
 * As flags que vão para o navegador: `--prazo <minutos>` (vira `prazoMs`, só no
 * mapa), `--nao-tocar "<regex>"` (vira `naoTocar`, SOMA à lista padrão de coisas
 * que não se clicam), `--nao-tocar-so "<regex>"` (vira `naoTocarSo`, TROCA a lista
 * padrão), `--idioma pt-BR` e `--qualquer-url` (vira `qualquerUrl: true`; sem ela o
 * navegador só abre file://, localhost, 127.0.0.1 e o endereço de teste de voo).
 * A regex é conferida aqui: expressão quebrada só estouraria dentro do processo filho.
 */
export function opcoesDoNavegador(a, { prazo = false } = {}) {
  const opcoes = {}
  if (prazo && a.tem('--prazo')) {
    const min = Number(String(a.flag('--prazo')).replace(',', '.'))
    if (!(min > 0)) return { erro: '--prazo é em minutos, maior que zero (exemplo: --prazo 10)' }
    opcoes.prazoMs = Math.round(min * 60000)
  }
  const soma = a.flag('--nao-tocar')
  const troca = a.flag('--nao-tocar-so')
  if (soma && troca) return { erro: 'use --nao-tocar (soma à lista padrão) ou --nao-tocar-so (troca a lista padrão), não os dois' }
  for (const [flag, chave, valor] of [['--nao-tocar', 'naoTocar', soma], ['--nao-tocar-so', 'naoTocarSo', troca]]) {
    if (!valor) continue
    try { new RegExp(valor, 'i') } catch (e) { return { erro: `${flag} não é uma expressão regular válida: ${e.message}` } }
    opcoes[chave] = valor
  }
  if (a.flag('--idioma')) opcoes.idioma = a.flag('--idioma')
  if (a.tem('--qualquer-url')) opcoes.qualquerUrl = true
  return { opcoes }
}

/**
 * Quem está escrevendo, e se dá para acreditar. O programa não sabe se do outro
 * lado há ele ou uma IA, e ele opera pelo celular conversando com a IA, que roda
 * o comando por ele. Então:
 * - em terminal de verdade, sem `--de`, vale como ele (foi ele que digitou);
 * - sem terminal, `--de` é obrigatório: `ia:<modelo>` (palpite) ou `ele`, e `ele`
 *   exige `--citacao` com as palavras dele, que fica gravada junto (`por`);
 * - `--de programa` nunca vem da linha de comando: só o código grava 'programa'.
 * Devolve `{ de, por? }` ou `{ erro }`.
 */
function autoria(a, deps) {
  const tty = deps.tty()
  const informado = a.flag('--de')
  const citacao = String(a.flag('--citacao') || '').trim()
  if (informado === 'programa') return { erro: "--de programa é recusado na linha de comando: só o código grava 'programa' (o que o mapa e as sessões medem)" }
  if (informado === undefined && !tty) {
    return { erro: 'sem terminal de verdade, diga quem está escrevendo: --de ia:<modelo> (palpite, ele confirma depois) ou --de ele --citacao "<as palavras dele>"' }
  }
  const de = informado ?? 'ele'
  if (de !== 'ele') return { de }
  if (!tty && !citacao) return { erro: '--de ele sem terminal de verdade exige --citacao "<as palavras dele>": só vale como dele o que ele disse' }
  return { de, por: { de: 'ele', via: tty ? 'terminal' : 'ia', ...(citacao && { citacao }) } }
}

const curto = (s, n = 70) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s))

/** O que o programa mediu até aqui (mapa e sessões), que alimenta os avisos das fases 3 a 5. */
const contexto = (raiz) => ({ mapa: R.lerMapa(raiz), sessoes: R.lerSessoes(raiz) })

/* ===================================================================== */
/* Saída de terminal                                                      */
/* ===================================================================== */

function mostrarPergunta(p) {
  console.log(`\n[${p.feitas + 1} de ${p.total}] ${p.header} (fase ${p.fase}, ${p.faseTitulo})`)
  console.log(`  ${p.pergunta}`)
  if (p.ajuda) console.log(`  (${p.ajuda})`)
  for (const o of p.opcoes || []) console.log(`    · ${o.valor.padEnd(10)} ${o.label}${o.descricao ? `: ${o.descricao}` : ''}`)
  console.log(`\n  responder: ${CMD} responder "<sua resposta>"\n`)
}

function mostrarSituacao(estado, ctx) {
  const s = R.situacao(estado, ctx)
  const atual = s.fases[s.fase]
  console.log(`\nRoteiro de uso: ${s.prontas} de ${s.total} fases prontas`)
  if (s.emDia) {
    console.log('Todas as fases estão prontas. A fase 8 segue em dia enquanto houver data marcada.')
  } else {
    console.log(`Agora: fase ${s.fase}, ${s.titulo}`)
    /* Pergunta sem resposta já aparece logo abaixo, uma por vez: listá-las aqui
       só repetiria. Fica o que a pergunta não resolve (palpite, tarefa, medida). */
    const semResposta = atual.falta.filter((f) => /: sem resposta$/.test(f)).length
    const outras = atual.falta.filter((f) => !/: sem resposta$/.test(f))
    if (semResposta) console.log(`  faltam ${plural(semResposta, 'pergunta', 'perguntas')} desta fase`)
    for (const f of outras.slice(0, 5)) console.log(`  falta: ${f}`)
    if (outras.length > 5) console.log(`  (e mais ${outras.length - 5})`)
  }
  for (const av of atual.avisos.slice(0, 3)) console.log(`  aviso: ${av}`)
  if (s.palpites.length) {
    console.log(`\n${s.palpites.length} palpite(s) de IA esperando você (confirmar: ${CMD} confirmar <id>, e sem terminal de verdade com --citacao "<palavras dele>"):`)
    for (const p of s.palpites.slice(0, 5)) console.log(`  ${p.id}  ${curto(p.texto)}  (${p.de})`)
  }
  const p = R.proxima(estado)
  if (p) mostrarPergunta(p)
  else if (!s.emDia) console.log('\nSem pergunta pendente nesta fase: resolva o que falta, na lista acima.\n')
  else console.log('')
}

/** A análise do mapa, em estrutura: serve ao terminal e ao relatório. */
export function analiseDoMapa(mapa) {
  /* `nome` é o nome da tela que o mapa dá (no Nexus todo `titulo` saía "APPS"); sem ele, o título, e sem ele, o id. */
  const nome = (id) => { const t = (mapa.telas || []).find((x) => x.id === id); return t?.nome || t?.titulo || id }
  const prof = R.profundidades(mapa)
  const porNivel = {}
  for (const [id, n] of Object.entries(prof)) (porNivel[n] ||= []).push(nome(id))
  const ri = R.rotulosInconsistentes(mapa)
  /* Rótulo inconsistente aparece aos montes em app real (o cartão de atalho e a
     aba levam à mesma tela, e isso é normal): ficam os 5 mais fortes, os com
     mais rótulos (ou mais destinos) diferentes primeiro, e o resto vira "e mais N". */
  const destinos = ri.mesmoDestino.map((x) => ({ destino: nome(x.para), rotulos: x.rotulos })).sort((x, y) => y.rotulos.length - x.rotulos.length)
  const rotulos = ri.mesmoRotulo.map((x) => ({ rotulo: x.rotulo, destinos: x.destinos.map(nome) })).sort((x, y) => y.destinos.length - x.destinos.length)
  return {
    telas: (mapa.telas || []).length || Object.keys(prof).length,
    caminhos: (mapa.arestas || []).length,
    porNivel,
    semVolta: R.semVolta(mapa).map(nome),
    naoExploradas: R.naoExploradas(mapa).length,
    mesmoDestino: destinos.slice(0, LIMITE_ROTULOS),
    mesmoDestinoMais: Math.max(0, destinos.length - LIMITE_ROTULOS),
    mesmoRotulo: rotulos.slice(0, LIMITE_ROTULOS),
    mesmoRotuloMais: Math.max(0, rotulos.length - LIMITE_ROTULOS),
  }
}

const LIMITE_ROTULOS = 5

/** A linha do que o tempo cortou, ou null quando o mapa foi até o fim. */
const linhaNaoExploradas = (m) => (m.naoExploradas
  ? `${m.naoExploradas} de ${m.telas} telas não foram exploradas até o fim (o tempo acabou): rode de novo com --prazo maior`
  : null)

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

export function mostrarMapa(mapa) {
  const m = analiseDoMapa(mapa)
  console.log(`\nMapa: ${plural(m.telas, 'tela', 'telas')} e ${plural(m.caminhos, 'caminho', 'caminhos')}`)
  console.log('Cliques até cada tela, a partir da raiz:')
  for (const [n, nomes] of Object.entries(m.porNivel)) {
    console.log(`  ${n} ${Number(n) === 1 ? 'clique' : 'cliques'} (${plural(nomes.length, 'tela', 'telas')}): ${nomes.slice(0, 8).join(', ')}${nomes.length > 8 ? `, e mais ${nomes.length - 8}` : ''}`)
  }
  console.log(m.semVolta.length
    ? `Sem volta à raiz (${m.semVolta.length} de ${m.telas} telas): ${m.semVolta.join(', ')}`
    : `Sem volta à raiz: nenhuma (0 de ${m.telas} telas)`)
  const nao = linhaNaoExploradas(m)
  if (nao) console.log(nao)
  if (!m.mesmoDestino.length && !m.mesmoRotulo.length) console.log('Rótulos inconsistentes: nenhum')
  for (const x of m.mesmoDestino) console.log(`Rótulos diferentes para o mesmo lugar (${x.destino}): ${x.rotulos.map((r) => `"${r}"`).join(' e ')}`)
  if (m.mesmoDestinoMais) console.log(`  e mais ${plural(m.mesmoDestinoMais, 'lugar', 'lugares')} com rótulos diferentes`)
  for (const x of m.mesmoRotulo) console.log(`Mesmo rótulo para lugares diferentes ("${x.rotulo}"): ${x.destinos.join(' e ')}`)
  if (m.mesmoRotuloMais) console.log(`  e mais ${plural(m.mesmoRotuloMais, 'rótulo', 'rótulos')} que levam a lugares diferentes`)
  console.log('')
}

function mostrarAchados(ss, mapa = null) {
  const r = R.achados(ss, { mapa })
  console.log(`\nAchados de ${plural(ss.length, 'sessão', 'sessões')}`)
  const lista = (titulo, itens) => {
    console.log(`${titulo}: ${itens.length}`)
    for (const a of itens) console.log(`  ${a.texto}${a.tarefa ? ` (${a.tarefa})` : ''}: ${plural(a.sessoes.length, 'sessão', 'sessões')}, ${plural(a.autores.length, 'autor', 'autores')}`)
  }
  lista('Confirmados (2 ou mais autores diferentes)', r.confirmados)
  lista('Não confirmados (1 autor só)', r.naoConfirmados)
  if (r.naoClicou.length) lista('Cliques que o programa não fez (não contam como achado da interface)', r.naoClicou)
  console.log('')
  return r
}

/* ===================================================================== */
/* Subcomandos                                                            */
/* ===================================================================== */

const ACOES = {
  status(a, raiz) {
    mostrarSituacao(R.ler(raiz), contexto(raiz))
  },

  responder(a, raiz, deps) {
    const texto = a.pos.slice(1).join(' ')
    if (!texto) return falhar(`uso: ${CMD} responder "<sua resposta>" [--de ia:<modelo> | --de ele --citacao "<palavras dele>"]`)
    const estado = R.ler(raiz)
    const atual = R.proxima(estado)
    if (!atual) return falhar(`não há pergunta pendente agora (veja: ${CMD})`)
    const au = autoria(a, deps)
    if (au.erro) return falhar(au.erro)
    const res = R.responder(estado, atual.id, texto, { de: au.de, por: au.por })
    if (!res.ok) return falhar(res.erro)
    R.gravar(raiz, res.estado)
    console.log(`${atual.header}: ${res.resposta.texto}`)
    if (au.de.startsWith('ia:')) console.log(`  palpite de ${au.de}: vale como hipótese até você confirmar (${CMD} confirmar ${atual.id})`)
    if (au.por?.via === 'ia') console.log(`  registrado como dele, com a citação: "${curto(au.por.citacao, 60)}"`)
    mostrarSituacao(res.estado, contexto(raiz))
  },

  confirmar(a, raiz, deps) {
    const id = a.pos[1]
    if (!id) return falhar(`uso: ${CMD} confirmar <id> [--citacao "<palavras dele>"]`)
    /* Confirmar é o ato que transforma palpite de IA em fato. Em terminal de verdade
       é ele. Sem terminal, só com as palavras dele, gravadas junto: ele opera pelo
       celular, conversando com a IA, e a citação é o que permite conferir depois. */
    const tty = deps.tty()
    const citacao = String(a.flag('--citacao') || '').trim()
    if (!tty && !citacao) {
      return falhar('sem terminal de verdade, confirmar exige --citacao "<as palavras dele>": a frase em que ele confirmou (ele opera pelo celular, conversando com a IA)')
    }
    const por = { de: 'ele', via: tty ? 'terminal' : 'ia', ...(citacao && { citacao }) }
    const res = R.confirmar(R.ler(raiz), id, { por })
    if (!res.ok) return falhar(res.erro)
    R.gravar(raiz, res.estado)
    console.log(`confirmado: ${id} (${res.alvo})`)
    mostrarSituacao(res.estado, contexto(raiz))
  },

  desfazer(a, raiz) {
    const id = a.pos[1]
    if (!id) return falhar(`uso: ${CMD} desfazer <id da pergunta>`)
    const res = R.desfazer(R.ler(raiz), id)
    if (!res.ok) return falhar(res.erro)
    R.gravar(raiz, res.estado)
    console.log(`apagada: ${id}`)
    if (res.orfas.length) console.log(`saíram junto, porque só existiam por causa dela: ${res.orfas.join(', ')}`)
    mostrarSituacao(res.estado, contexto(raiz))
  },

  tarefa(a, raiz, deps) {
    const objetivo = a.pos.slice(1).join(' ')
    if (!objetivo) return falhar(`uso: ${CMD} tarefa "<objetivo>" --sucesso "<texto visível>" [--de ia:<modelo> | --de ele --citacao "<palavras dele>"]`)
    const au = autoria(a, deps)
    if (au.erro) return falhar(au.erro)
    const sucesso = { texto: a.flag('--sucesso'), estado: a.flag('--estado') }
    const res = R.novaTarefa(R.ler(raiz), { objetivo, papel: a.flag('--papel'), sucesso, de: au.de, por: au.por })
    if (!res.ok) return falhar(res.erro)
    R.gravar(raiz, res.estado)
    const t = res.tarefa
    console.log(`${t.id}: ${t.objetivo}`)
    if (R.ehPalpite(t)) console.log(`  palpite de ${t.de}: não vira pergunta nem sessão até você confirmar (${CMD} confirmar ${t.id})`)
    if (!t.sucesso.texto && !t.sucesso.estado) console.log('  sem --sucesso: o agente não terá como saber que a tarefa deu certo, e a fase 1 fica aberta')
  },

  async mapa(a, raiz, deps) {
    const url = a.pos[1]
    if (!url) return falhar(`uso: ${CMD} mapa <url> [--max N] [--prazo <minutos>] [--nao-tocar "<regex>" | --nao-tocar-so "<regex>"] [--idioma pt-BR] [--qualquer-url]`)
    const nav = opcoesDoNavegador(a, { prazo: true })
    if (nav.erro) return falhar(nav.erro)
    let M
    try {
      M = await deps.mapa()
    } catch (e) {
      return falhar(`o mapa automático não está disponível: não consegui carregar src/roteiroMapa.mjs (${e.message}).\nO resto do roteiro continua funcionando.`)
    }
    if (typeof M.executarMapa !== 'function') return falhar('src/roteiroMapa.mjs não exporta executarMapa(plano)')

    const dir = join(raiz, 'docs', 'roteiro')
    const max = Number(a.flag('--max'))
    const plano = { url, raiz, saida: dir, fotos: join(dir, 'fotos'), ...(max > 0 && { maxTelas: max }), ...nav.opcoes }
    console.log(`mapeando ${url} (pode levar alguns minutos)`)
    const r = await M.executarMapa(plano)

    /* Aceita o caminho do mapa.json, ou o próprio mapa, ou o arquivo já no lugar. */
    const caminho = typeof r === 'string' ? r : (r?.mapa && typeof r.mapa === 'string' ? r.mapa : r?.caminho)
    let mapa = null
    if (caminho && existsSync(caminho)) mapa = JSON.parse(readFileSync(caminho, 'utf8'))
    else if (r && typeof r === 'object' && Array.isArray(r.telas)) mapa = r
    else mapa = R.lerMapa(raiz)
    if (!mapa) return falhar('o mapa terminou, mas não achei o mapa.json')
    R.gravarMapa(raiz, mapa)
    mostrarMapa(mapa)
  },

  async agente(a, raiz, deps) {
    const id = a.pos[1]
    if (!id) return falhar(`uso: ${CMD} agente <T1> --cerebro humano --quem "<nome>" | "comando:..." | roteiro:<arquivo> [--persona x] [--vezes 3]`)
    const estado = R.ler(raiz)
    const tarefa = estado.tarefas.find((t) => t.id === id)
    if (!tarefa) return falhar(`não achei a tarefa "${id}" (cadastre com: ${CMD} tarefa "<objetivo>" --sucesso "<texto visível>")`)
    if (R.ehPalpite(tarefa)) return falhar(`a tarefa ${id} é palpite de ${tarefa.de}: confirme antes de medir (${CMD} confirmar ${id})`)
    const cerebros = a.todos('--cerebro').filter(Boolean)
    if (!cerebros.length) return falhar('diga quem escolhe os cliques: --cerebro humano, "comando:<linha>" ou roteiro:<arquivo>')
    const nomes = a.todos('--persona').filter(Boolean)
    const personas = (nomes.length ? nomes : ['novato']).map((nome) => ({ nome }))
    const vezes = Number(a.flag('--vezes')) > 0 ? Number(a.flag('--vezes')) : 3
    const nav = opcoesDoNavegador(a)
    if (nav.erro) return falhar(nav.erro)
    /* O voto precisa saber QUEM foi o humano: a mesma pessoa com duas personas é uma
       opinião só, e sem o nome não há como separar. */
    const quem = String(a.flag('--quem') || '').trim()
    if (cerebros.some((c) => c === 'humano' || c.startsWith('humano:')) && !quem) {
      return falhar('--cerebro humano exige --quem "<nome da pessoa>": o voto precisa saber quem fez o teste (a mesma pessoa com duas personas conta como uma só)')
    }

    let G
    try {
      G = await deps.agente()
    } catch (e) {
      return falhar(`o agente não está disponível: não consegui carregar src/roteiroAgente.mjs (${e.message}).\nO resto do roteiro continua funcionando.`)
    }
    const rodar = G.rodadas || G.default
    if (typeof rodar !== 'function') return falhar('src/roteiroAgente.mjs não exporta rodadas(tarefa, opções)')

    console.log(`${id}: ${plural(cerebros.length * personas.length * vezes, 'rodada', 'rodadas')} (${plural(cerebros.length, 'cérebro', 'cérebros')}, ${plural(personas.length, 'persona', 'personas')}, ${vezes} vezes cada)`)
    await rodar(tarefa, { cerebros, personas, vezes, raiz, mapa: R.lerMapa(raiz), estado, ...(quem && { quem }), ...nav.opcoes })

    const dela = R.lerSessoes(raiz).filter((s) => s.tarefa === id)
    for (const s of dela) {
      const m = R.metricas(s.passos, Number.isFinite(s.otimo) ? s.otimo : null, { sucesso: s.sucesso })
      const fim = s.sucesso ? 'chegou ao fim' : s.desistiu ? 'desistiu' : 'não chegou'
      console.log(`  ${s.id}: ${fim}, ${m.passos} passos${m.otimo ? ` (ótimo ${m.otimo})` : ''}, desorientação ${m.desorientacao ?? 'sem mapa'}`)
    }
    console.log(`\nver o voto das sessões: ${CMD} achados\n`)
  },

  achados(a, raiz) {
    const ss = R.lerSessoes(raiz)
    if (!ss.length) {
      console.log(`\nnenhuma sessão ainda (rode: ${CMD} agente <T1> --cerebro humano)\n`)
      return
    }
    mostrarAchados(ss, R.lerMapa(raiz))
  },

  relatorio(a, raiz) {
    const arq = join(raiz, 'docs', 'roteiro', 'relatorio.html')
    const estado = R.ler(raiz)
    R.escreverAtomico(arq, relatorioHtml({ estado, mapa: R.lerMapa(raiz), sessoes: R.lerSessoes(raiz) }))
    const s = R.situacao(estado, contexto(raiz))
    console.log(`\nrelatório gerado: ${arq}`)
    console.log(`  ${s.prontas} de ${s.total} fases prontas, ${plural((estado.tarefas || []).length, 'tarefa', 'tarefas')}\n`)
  },
}

/**
 * `injetados` troca os módulos do navegador (`{ mapa, agente }`, cada um uma
 * função que devolve o módulo) e a pergunta "há terminal de verdade?" (`tty`, uma
 * função que devolve verdadeiro ou falso). Só os testes usam: é como conferir as
 * flags, o que chega ao plano e as regras de autoria sem abrir um Chrome.
 */
export async function main(argv = [], injetados = {}) {
  const deps = { mapa: () => import('./roteiroMapa.mjs'), agente: () => import('./roteiroAgente.mjs'), tty: () => Boolean(process.stdin.isTTY), ...injetados }
  const a = analisar(argv[0] === 'roteiro' ? argv.slice(1) : argv)
  const sub = a.pos[0] || 'status'
  const raiz = resolve(a.flag('--projeto') || a.flag('--dir') || process.cwd())
  if (!Object.prototype.hasOwnProperty.call(ACOES, sub)) return falhar(`comando desconhecido: ${sub}\n${USO}`)
  try {
    if (!existsSync(raiz) || !statSync(raiz).isDirectory()) return falhar(`a pasta do projeto não existe: ${raiz}`)
    return (await ACOES[sub](a, raiz, deps)) ?? 0
  } catch (e) {
    return falhar(e.message)
  }
}

/* ===================================================================== */
/* Relatório para o celular                                               */
/* ===================================================================== */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const CSS = `
*{box-sizing:border-box}
body{font:19px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0 auto;padding:16px;max-width:720px;color:#1b1b1b;background:#fff}
h1{font-size:26px;line-height:1.2;margin:0 0 6px}
h2{font-size:22px;line-height:1.25;margin:30px 0 8px}
.sec,small,.meta{font-size:16px;color:#555}
.cartao{border:1px solid #d6d6d6;border-radius:10px;padding:12px 14px;margin:10px 0}
.alerta{background:#fff6dc;border-color:#e6cf8a}
.bom{background:#eaf6ea;border-color:#a7d3a7}
.marca{display:inline-block;font-size:16px;padding:0 8px;border-radius:8px;background:#eee;margin-left:4px}
ul{padding-left:22px;margin:6px 0}
li{margin:4px 0}
`

/**
 * O relatório inteiro numa página só, para ler no celular (corpo 19px, título
 * 26px, secundário 16px). Puro: recebe tudo pronto e devolve o HTML. Achado
 * confirmado e não confirmado ficam em seções separadas, de propósito.
 */
export function relatorioHtml({ estado, mapa = null, sessoes = [], quando = new Date() }) {
  const s = R.situacao(estado, { mapa, sessoes })
  const atual = s.fases[s.fase]
  const lista = (itens, vazio) => (itens.length ? `<ul>${itens.map((i) => `<li>${i}</li>`).join('')}</ul>` : `<p class="sec">${vazio}</p>`)
  const partes = []

  partes.push(`<h1>Roteiro de uso</h1><p class="meta">${s.prontas} de ${s.total} fases prontas. Gerado em ${esc(quando.toISOString().slice(0, 16).replace('T', ' '))}.</p>`)

  // fase atual
  partes.push('<h2>Fase atual</h2>')
  partes.push(s.emDia
    ? '<div class="cartao bom">Todas as fases estão prontas. A fase 8 segue em dia enquanto houver data marcada.</div>'
    : `<div class="cartao alerta"><strong>Fase ${s.fase}, ${esc(s.titulo)}</strong>${lista(atual.falta.map(esc), 'nada faltando')}</div>`)
  if (atual.avisos.length) partes.push(`<p class="sec">Avisos do programa:</p>${lista(atual.avisos.map(esc), '')}`)
  partes.push(`<p class="sec">${s.fases.map((f) => `${f.id} ${esc(f.titulo)}: ${f.ok ? 'pronta' : f.id === s.fase ? 'agora' : 'aberta'}`).join(' | ')}</p>`)
  if (s.palpites.length) {
    partes.push(`<h2>Palpites esperando confirmação (${s.palpites.length})</h2>${lista(s.palpites.map((p) => `${esc(p.id)}: ${esc(curto(p.texto, 120))} <span class="marca">${esc(p.de)}</span>`), '')}`)
  }

  // tarefas
  const ts = estado.tarefas || []
  partes.push(`<h2>Tarefas (${ts.length})</h2>`)
  partes.push(ts.length
    ? ts.map((t) => `<div class="cartao"><strong>${esc(t.id)}</strong> ${esc(t.objetivo)}${R.ehPalpite(t) ? ' <span class="marca">palpite</span>' : ''}<br><small>Deu certo quando: ${esc(t.sucesso?.texto || t.sucesso?.estado || 'não definido')}. Autor: ${esc(t.de)}${t.papel ? `. Papel: ${esc(t.papel)}` : ''}</small></div>`).join('')
    : '<p class="sec">nenhuma tarefa cadastrada ainda</p>')

  // análise do mapa
  partes.push('<h2>Análise do mapa</h2>')
  if (mapa) {
    const m = analiseDoMapa(mapa)
    partes.push(`<p class="sec">${plural(m.telas, 'tela', 'telas')} e ${plural(m.caminhos, 'caminho', 'caminhos')}</p>`)
    partes.push('<h3 style="font-size:19px;margin:14px 0 4px">Cliques até cada tela</h3>')
    partes.push(lista(Object.entries(m.porNivel).map(([n, nomes]) => `${n} ${Number(n) === 1 ? 'clique' : 'cliques'}: ${nomes.map(esc).join(', ')}`), 'sem telas'))
    partes.push(`<h3 style="font-size:19px;margin:14px 0 4px">Telas sem volta (${m.semVolta.length} de ${m.telas})</h3>`)
    partes.push(lista(m.semVolta.map(esc), 'nenhuma'))
    const nao = linhaNaoExploradas(m)
    if (nao) partes.push(`<div class="cartao alerta">${esc(nao)}</div>`)
    partes.push('<h3 style="font-size:19px;margin:14px 0 4px">Rótulos inconsistentes</h3>')
    partes.push(lista([
      ...m.mesmoDestino.map((x) => `O lugar "${esc(x.destino)}" tem rótulos diferentes: ${x.rotulos.map((r) => `"${esc(r)}"`).join(' e ')}`),
      ...(m.mesmoDestinoMais ? [`e mais ${plural(m.mesmoDestinoMais, 'lugar', 'lugares')} com rótulos diferentes`] : []),
      ...m.mesmoRotulo.map((x) => `O rótulo "${esc(x.rotulo)}" leva a lugares diferentes: ${x.destinos.map(esc).join(' e ')}`),
      ...(m.mesmoRotuloMais ? [`e mais ${plural(m.mesmoRotuloMais, 'rótulo', 'rótulos')} que levam a lugares diferentes`] : []),
    ], 'nenhum'))
  } else {
    partes.push(`<p class="sec">o mapa ainda não foi feito (${esc(CMD)} mapa &lt;url&gt;)</p>`)
  }

  // sessões
  partes.push(`<h2>Sessões (${sessoes.length})</h2>`)
  partes.push(sessoes.length
    ? sessoes.map((x) => {
      const m = R.metricas(x.passos, Number.isFinite(x.otimo) ? x.otimo : null, { sucesso: x.sucesso })
      const fim = x.sucesso ? 'chegou ao fim' : x.desistiu ? 'desistiu' : 'não chegou'
      return `<div class="cartao ${x.sucesso ? 'bom' : 'alerta'}"><strong>${esc(x.id)}</strong> ${esc(x.tarefa || '')}: ${fim}<br><small>${esc(R.autorDaSessao(x).replace('|', ' / '))}. ${m.passos} passos${m.otimo ? ` (ótimo ${m.otimo})` : ''}, ${m.voltas} voltas, ${m.revisitas} revisitas,${m.rolagens ? ` ${m.rolagens} rolagens,` : ''} desorientação ${m.desorientacao ?? 'sem mapa'}.</small></div>`
    }).join('')
    : '<p class="sec">nenhuma sessão ainda</p>')

  // achados: confirmados e não confirmados, separados
  const ach = R.achados(sessoes, { mapa })
  const item = (x) => `${esc(x.texto)}${x.tarefa ? ` (${esc(x.tarefa)})` : ''}: ${plural(x.sessoes.length, 'sessão', 'sessões')}, ${plural(x.autores.length, 'autor', 'autores')}`
  partes.push(`<h2>Achados confirmados (${ach.confirmados.length})</h2><p class="sec">Apareceram em 2 ou mais sessões de autores diferentes.</p>${lista(ach.confirmados.map(item), 'nenhum ainda')}`)
  partes.push(`<h2>Achados não confirmados (${ach.naoConfirmados.length})</h2><p class="sec">Um autor só: é hipótese, não resultado.</p>${lista(ach.naoConfirmados.map(item), 'nenhum')}`)
  if (ach.naoClicou.length) {
    partes.push(`<h2>Cliques que o programa não fez (${ach.naoClicou.length})</h2><p class="sec">Botão protegido, tapado ou fora da janela. Não diz nada sobre a interface, por isso não entra nos achados.</p>${lista(ach.naoClicou.map(item), 'nenhum')}`)
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roteiro de uso</title>
<style>${CSS}</style>
</head>
<body>
${partes.join('\n')}
</body>
</html>
`
}
