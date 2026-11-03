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
import { spawn } from 'node:child_process'
import * as R from './roteiro.mjs'

const CMD = R.CMD

const USO = `uso: ${CMD} [status]
     ${CMD} proxima [--para ele|ia|programa]
     ${CMD} responder "<texto>" [--id <pergunta>] [--de ia:<modelo> | --de ele --citacao "<palavras dele>"]
     ${CMD} confirmar <id> | tudo [--citacao "<palavras dele>"]
     ${CMD} desfazer <id>
     ${CMD} tarefa "<objetivo>" --sucesso "<texto visível>" [--de ia:<modelo> | --de ele --citacao "<palavras dele>"]
     ${CMD} mapa <url> [--max N] [--prazo <minutos>] [--nao-tocar "<regex>" | --nao-tocar-so "<regex>"] [--idioma pt-BR] [--qualquer-url] [--acesso <arquivo>] [--permitir <host>]
     ${CMD} agente <T1> --cerebro humano --quem "<nome>" | "comando:..." | roteiro:<arquivo> [--persona x] [--vezes 3] [--nao-tocar "<regex>" | --nao-tocar-so "<regex>"] [--idioma pt-BR] [--qualquer-url] [--acesso <arquivo>] [--permitir <host>]
     ${CMD} mercado [--tipo familia/tipo] [--cerebro "comando:..." | roteiro:<arquivo>] (2 ou mais) [--acesso <arquivo>] [--permitir <host>] [--listar] [--base <pasta>]
     ${CMD} achados
     ${CMD} relatorio
     (em outra pasta: --projeto <pasta>)
     Cada pergunta é de um: dele (poucas), da IA (palpite que ele aprova com "confirmar tudo") ou do
     programa (calculada do mapa e das sessões). Sem terminal de verdade (uma IA rodando o comando):
     responder e tarefa exigem --de, e quem fala por ele (--de ele, e confirmar) exige --citacao com as
     palavras dele. O navegador só abre file://, localhost, 127.0.0.1 e https://testedevoo.carzo.com.br,
     a menos que se passe --qualquer-url.`

/* ===================================================================== */
/* Argumentos                                                             */
/* ===================================================================== */

/** Flags que comem o argumento seguinte. Esquecer uma aqui faria o valor virar posicional. */
const COM_VALOR = new Set(['--projeto', '--dir', '--de', '--sucesso', '--estado', '--papel', '--cerebro', '--persona', '--vezes', '--max', '--prazo', '--nao-tocar', '--nao-tocar-so', '--idioma', '--citacao', '--quem', '--id', '--para', '--acesso', '--permitir', '--base', '--tipo'])

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
  /* O arquivo de acesso (login) só é nomeado aqui: o conteúdo nunca é lido nem impresso por este arquivo. */
  const acesso = a.flag('--acesso')
  if (acesso) {
    const arq = resolve(acesso)
    if (!existsSync(arq)) return { erro: `--acesso: o arquivo não existe: ${arq}` }
    opcoes.acesso = arq
  }
  const permitir = a.todos('--permitir').filter(Boolean)
  if (permitir.length) opcoes.permitir = permitir
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
const contexto = (raiz) => ({ mapa: R.lerMapa(raiz), sessoes: R.lerSessoes(raiz), mercado: R.lerResultadosMercado(raiz).resultados })

/** O estado do projeto já com os achados confirmados de agora (de onde saem as perguntas por achado), e o que o programa mediu. */
function carregar(raiz) {
  const ctx = contexto(raiz)
  return { estado: R.sincronizar(R.ler(raiz), ctx), ctx }
}

/* ===================================================================== */
/* Saída de terminal                                                      */
/* ===================================================================== */

function mostrarPergunta(p) {
  console.log(`\n[${p.feitas + 1} de ${p.total}] ${p.header} (fase ${p.fase}, ${p.faseTitulo})`)
  console.log(`  ${p.pergunta}`)
  if (p.ajuda) console.log(`  (${p.ajuda})`)
  for (const o of p.opcoes || []) console.log(`    · ${o.valor.padEnd(10)} ${o.label}${o.descricao ? `: ${o.descricao}` : ''}`)
  if (p.para === 'ele') console.log('  Se não souber, responda "não sei": vale, e não gera outra pergunta.')
  console.log(`\n  responder: ${CMD} responder "<sua resposta>"\n`)
}

/**
 * O estado em poucas linhas, nesta ordem: onde está, o que falta a ELE, o que está
 * com a IA (uma linha), o que espera aprovação, o que falta ao programa, e SÓ a
 * próxima pergunta dele. O que é da IA e do programa nunca vira pergunta aqui.
 */
function mostrarSituacao(estado, ctx) {
  const s = R.situacao(estado, ctx)
  const atual = s.fases[s.fase]
  console.log(`\nRoteiro de uso: ${s.prontas} de ${s.total} fases prontas`)
  if (s.emDia) {
    console.log('Todas as fases estão prontas. A fase 8 segue em dia enquanto houver rodada nova a cada versão.')
  } else {
    console.log(`Agora: fase ${s.fase}, ${s.titulo}`)
    /* Pergunta dele sem resposta já aparece logo abaixo: listá-la aqui só repetiria. */
    const dele = atual.itens.filter((i) => i.tipo === 'ele' && !/: sem resposta$/.test(i.texto))
    for (const i of dele.slice(0, 5)) console.log(`  falta: ${i.texto}`)
    if (dele.length > 5) console.log(`  (e mais ${dele.length - 5})`)
  }
  for (const av of atual.avisos.slice(0, 3)) console.log(`  aviso: ${av}`)
  if (s.iaPendentes) console.log(`a IA tem ${plural(s.iaPendentes, 'item', 'itens')} para preencher: ${CMD} proxima --para ia`)
  if (s.palpites.length) {
    console.log(`${plural(s.palpites.length, 'palpite', 'palpites')} da IA esperando você (aprovar tudo: ${CMD} confirmar tudo, e sem terminal de verdade com --citacao "<palavras dele>"):`)
    for (const p of s.palpites.slice(0, 5)) console.log(`  ${p.id}  ${curto(p.texto)}  (${p.de})`)
    if (s.palpites.length > 5) console.log(`  (e mais ${s.palpites.length - 5})`)
  }
  for (const f of s.faltaPrograma.slice(0, 4)) console.log(`falta: ${f}`)
  const p = R.proxima(estado)
  if (p) mostrarPergunta(p)
  else console.log('\nNenhuma pergunta para você agora.\n')
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

/** As faltas de mercado (confirmadas e hipóteses), em duas listas curtas. Devolve quantas mostrou. */
function mostrarMercadoAchados(resultados) {
  const m = R.achadosDeMercado(resultados)
  if (!m.confirmados.length && !m.naoConfirmados.length) return 0
  console.log(`\nFaltas de mercado confirmadas (sonda do programa, ou 2 ou mais cérebros diferentes): ${m.confirmados.length}`)
  for (const a of m.confirmados) console.log(`  ${a.texto}`)
  console.log(`Faltas de mercado como hipótese (1 cérebro só): ${m.naoConfirmados.length}`)
  for (const a of m.naoConfirmados) console.log(`  ${a.texto}`)
  return m.confirmados.length + m.naoConfirmados.length
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
/* Mercado: o cérebro que responde "tem, não tem ou não dá para ver"       */
/* ===================================================================== */

/** `comando:<linha>`: roda no shell, entrega o pedido pela entrada, FECHA a entrada e lê a saída. Devolve o texto, ou `{ erro }`. */
function rodarComando(linha, pedido, prazoMs = 120000) {
  return new Promise((ok) => {
    const f = spawn(linha, { shell: true, stdio: ['pipe', 'pipe', 'pipe'], detached: true, windowsHide: true })
    let out = ''
    let err = ''
    const matar = () => { try { process.kill(-f.pid, 'SIGKILL') } catch { try { f.kill('SIGKILL') } catch { /* já saiu */ } } }
    const t = setTimeout(() => { matar(); ok({ erro: `o cérebro não respondeu em ${Math.round(prazoMs / 1000)} s` }) }, prazoMs)
    f.stdout.on('data', (d) => { out += d })
    f.stderr.on('data', (d) => { err = (err + d).slice(-400) })
    f.on('error', (e) => { clearTimeout(t); ok({ erro: `não consegui rodar o cérebro: ${e.message}` }) })
    f.on('close', (codigo) => { clearTimeout(t); ok(out.trim() || { erro: `o cérebro não disse nada (código ${codigo}) ${err.trim().split('\n').pop() || ''}`.trim() }) })
    f.stdin.on('error', () => { /* o comando não leu a entrada: a resposta vem assim mesmo */ })
    f.stdin.end(pedido)
  })
}

/**
 * Pergunta a um cérebro sobre um padrão. `comando:<linha>` (qualquer IA pelo terminal) ou
 * `roteiro:<arquivo.json>` (respostas gravadas por id do padrão, para teste sem IA:
 * `{ "<id>": { "status": "nao-tem", "porque": "..." } }`). Devolve o texto da resposta, ou `{ erro }`.
 */
export async function perguntarCerebro(spec, pedido, { padrao } = {}) {
  if (spec.startsWith('comando:')) return rodarComando(spec.slice('comando:'.length).trim(), pedido)
  if (spec.startsWith('roteiro:')) {
    const gravado = JSON.parse(readFileSync(spec.slice('roteiro:'.length).trim(), 'utf8'))[padrao?.id]
    if (gravado === undefined) return JSON.stringify({ status: 'nao-da', porque: 'o roteiro não traz este padrão' })
    return JSON.stringify(typeof gravado === 'string' ? { status: gravado } : gravado)
  }
  return { erro: `cérebro desconhecido: "${spec}" (use comando:<linha> ou roteiro:<arquivo.json>)` }
}

/** Uma consulta, com uma segunda chance no formato. Resposta que não serve vira `nao-da` (nunca achado). */
async function consultar(deps, spec, pedido, padrao) {
  let erro = ''
  for (let i = 0; i < 2; i++) {
    let bruto
    try {
      bruto = await deps.perguntar(spec, i === 0 ? pedido : `${pedido}\n\nSua resposta anterior não serviu (${erro}). Responda só a linha JSON.`, { padrao })
    } catch (e) {
      return { status: 'nao-da', porque: `o cérebro falhou: ${e.message}` }
    }
    if (bruto?.erro) return { status: 'nao-da', porque: `o cérebro falhou: ${bruto.erro}` }
    const r = R.analisarStatus(bruto)
    if (r.ok) return r
    erro = r.erro
  }
  return { status: 'nao-da', porque: `resposta fora do formato: ${erro}` }
}

/** O que `executarSondas` devolveu, em `Map<id da sonda, { status, porque }>`. Aceita lista, `{ resultados }` ou `{ id: resultado }`. */
function normalizarSondas(r) {
  const lista = Array.isArray(r) ? r : Array.isArray(r?.resultados) ? r.resultados
    : r && typeof r === 'object' ? Object.entries(r).map(([id, v]) => (v && typeof v === 'object' ? { id, ...v } : { id, status: v })) : []
  const mapa = new Map()
  for (const x of lista) {
    const id = x?.id ?? x?.sonda
    const status = R.normStatus(x?.status ?? x?.tem)
    if (id && status) mapa.set(id, { status, porque: String(x.evidencia ?? x.porque ?? '').trim() })
  }
  return mapa
}

/* ===================================================================== */
/* Subcomandos                                                            */
/* ===================================================================== */

const ACOES = {
  status(a, raiz) {
    const { estado, ctx } = carregar(raiz)
    mostrarSituacao(estado, ctx)
  },

  /** `proxima` mostra só a pergunta dele; `--para ia` lista o que a IA tem a preencher; `--para programa`, o que o programa calculou. */
  proxima(a, raiz) {
    const para = a.flag('--para') || 'ele'
    if (!['ele', 'ia', 'programa'].includes(para)) return falhar('--para é ele, ia ou programa')
    const { estado, ctx } = carregar(raiz)
    if (para === 'ele') {
      const p = R.proxima(estado)
      if (p) mostrarPergunta(p)
      else console.log('\nNenhuma pergunta para você agora.\n')
      return
    }
    if (para === 'ia') {
      const lista = R.pendentes(estado, 'ia')
      if (!lista.length) { console.log('\nA IA não tem nada pendente.\n'); return }
      console.log(`\nA IA tem ${plural(lista.length, 'item', 'itens')} para preencher, tirando do código e dos documentos do projeto.`)
      console.log(`Responda cada um com: ${CMD} responder "<texto>" --id <id> --de ia:<modelo>`)
      for (const p of lista) {
        console.log(`\n[${p.id}] ${p.header} (fase ${p.fase}, ${p.faseTitulo})\n  ${p.pergunta}`)
        if (p.ajuda) console.log(`  (${p.ajuda})`)
      }
      console.log(`\nDepois ele aprova tudo de uma vez: ${CMD} confirmar tudo\n`)
      return
    }
    const itens = R.itensDoRoteiro(estado, ctx).filter((i) => i.para === 'programa')
    console.log(`\nO programa calcula ${plural(itens.length, 'item', 'itens')}, sem perguntar a ninguém:`)
    for (const i of itens) console.log(`  ${i.header}: ${i.texto ?? `falta: ${i.falta}`}`)
    console.log('')
  },

  responder(a, raiz, deps) {
    let texto = a.pos.slice(1).join(' ')
    if (!texto) return falhar(`uso: ${CMD} responder "<sua resposta>" [--id <pergunta>] [--de ia:<modelo> | --de ele --citacao "<palavras dele>"]`)
    const { estado, ctx } = carregar(raiz)
    /* Sem --id é a pergunta dele da vez; com --id é a que se nomeia (é como a IA responde as dela). */
    const id = a.flag('--id')
    const alvo = id ? R.todas(estado).find((x) => x.id === id) : R.proxima(estado)
    if (!alvo) return falhar(id ? `pergunta desconhecida: ${id}` : `não há pergunta para você agora (as da IA: ${CMD} proxima --para ia)`)
    const au = autoria(a, deps)
    if (au.erro) return falhar(au.erro)
    /* O tipo da plataforma só vale se existir na base de mercado: é com ele que o projeto é comparado. */
    if (alvo.id === 'f0-tipo') {
      const dir = a.flag('--base') || deps.mercadoDir
      const base = R.lerMercado(dir)
      if (!base.tipos.length) return falhar(`a base de mercado está vazia: ${dir}`)
      const { tipos, desconhecidos } = R.acharTipos(base, texto.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))
      if (!tipos.length || desconhecidos.length) return falhar(`tipo fora da base: ${desconhecidos.join(', ') || texto}. Tipos: ${base.tipos.map((t) => t.id).join(', ')}`)
      texto = tipos.map((t) => t.id).join(', ')
    }
    const res = R.responder(estado, alvo.id, texto, { de: au.de, por: au.por })
    if (!res.ok) return falhar(res.erro)
    R.gravar(raiz, res.estado)
    console.log(`${alvo.header}: ${res.resposta.texto}`)
    if (au.de.startsWith('ia:')) console.log(`  palpite de ${au.de}: vale como hipótese até você aprovar (${CMD} confirmar ${alvo.id}, ou confirmar tudo)`)
    if (au.por?.via === 'ia') console.log(`  registrado como dele, com a citação: "${curto(au.por.citacao, 60)}"`)
    mostrarSituacao(res.estado, ctx)
  },

  confirmar(a, raiz, deps) {
    const id = a.pos[1]
    if (!id) return falhar(`uso: ${CMD} confirmar <id> | tudo [--citacao "<palavras dele>"]`)
    /* Confirmar é o ato que transforma palpite de IA em fato. Em terminal de verdade
       é ele. Sem terminal, só com as palavras dele, gravadas junto: ele opera pelo
       celular, conversando com a IA, e a citação é o que permite conferir depois. */
    const tty = deps.tty()
    const citacao = String(a.flag('--citacao') || '').trim()
    if (!tty && !citacao) {
      return falhar('sem terminal de verdade, confirmar exige --citacao "<as palavras dele>": a frase em que ele confirmou (ele opera pelo celular, conversando com a IA)')
    }
    const por = { de: 'ele', via: tty ? 'terminal' : 'ia', ...(citacao && { citacao }) }
    const { estado, ctx } = carregar(raiz)
    if (id === 'tudo') {
      const res = R.confirmarTudo(estado, { por })
      if (!res.quantos) { console.log('\nnenhum palpite para confirmar\n'); return }
      R.gravar(raiz, res.estado)
      console.log(`confirmados ${plural(res.quantos, 'palpite', 'palpites')}: ${res.ids.slice(0, 8).join(', ')}${res.ids.length > 8 ? `, e mais ${res.ids.length - 8}` : ''}`)
      mostrarSituacao(res.estado, ctx)
      return
    }
    const res = R.confirmar(estado, id, { por })
    if (!res.ok) return falhar(res.erro)
    R.gravar(raiz, res.estado)
    console.log(`confirmado: ${id} (${res.alvo})`)
    mostrarSituacao(res.estado, ctx)
  },

  desfazer(a, raiz) {
    const id = a.pos[1]
    if (!id) return falhar(`uso: ${CMD} desfazer <id da pergunta>`)
    const { estado, ctx } = carregar(raiz)
    const res = R.desfazer(estado, id)
    if (!res.ok) return falhar(res.erro)
    R.gravar(raiz, res.estado)
    console.log(`apagada: ${id}`)
    if (res.orfas.length) console.log(`saíram junto, porque só existiam por causa dela: ${res.orfas.join(', ')}`)
    mostrarSituacao(res.estado, ctx)
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

  /**
   * Compara o projeto com a prática de mercado do tipo dele. Cada padrão (convenção primeiro, depois
   * por prevalência) é medido por uma sonda do programa quando alguma casa com ele, e senão perguntado
   * a cada cérebro com o retrato das telas do mapa. Grava docs/roteiro/mercado.json, com o autor de cada resultado.
   */
  async mercado(a, raiz, deps) {
    const dir = a.flag('--base') || deps.mercadoDir
    const base = R.lerMercado(dir)
    if (a.tem('--listar')) {
      if (!base.tipos.length) return falhar(`a base de mercado está vazia: ${dir}`)
      console.log(`\nTipos na base (${dir}):`)
      for (const t of base.tipos) console.log(`  ${t.id}: ${plural(t.padroes.length, 'padrão', 'padrões')}`)
      for (const e of base.erros) console.log(`  arquivo ilegível: ${e}`)
      console.log('')
      return
    }
    if (!base.tipos.length) return falhar(`a base de mercado está vazia: ${dir}`)
    const { estado } = carregar(raiz)
    const lista = base.tipos.map((t) => t.id).join(', ')
    const pedidos = a.todos('--tipo').flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean)
    const ids = pedidos.length ? pedidos : R.tiposDoProjeto(estado)
    if (!ids.length) {
      return falhar(`diga o tipo do projeto: --tipo familia/tipo (ou a IA responde "Que tipo de plataforma é este projeto?": ${CMD} responder "<familia/tipo>" --id f0-tipo --de ia:<modelo>). Tipos: ${lista}`)
    }
    const { tipos, desconhecidos } = R.acharTipos(base, ids)
    if (desconhecidos.length) return falhar(`tipo fora da base: ${desconhecidos.join(', ')}. Tipos: ${lista}`)
    const mapa = R.lerMapa(raiz)
    if (!mapa) return falhar(`falta: mapa (rode: ${CMD} mapa <url>), porque o cérebro lê o retrato das telas`)
    const nav = opcoesDoNavegador(a)
    if (nav.erro) return falhar(nav.erro)
    const cerebros = a.todos('--cerebro').filter(Boolean)
    const ruim = cerebros.find((c) => !c.startsWith('comando:') && !c.startsWith('roteiro:'))
    if (ruim) return falhar(`cérebro "${ruim}": o mercado aceita comando:<linha> ou roteiro:<arquivo.json> (humano fica de fora)`)
    if (!pedidos.length && R.ehPalpite(estado.respostas?.['f0-tipo'])) console.log('  aviso: o tipo é palpite da IA, ainda não aprovado')
    if (cerebros.length === 1) console.log('  aviso: com 1 cérebro só, a falta fica como hipótese (confirmar pede 2 ou mais diferentes)')

    // as sondas do programa: carregadas só aqui, e a falta delas não impede os cérebros
    let mod = null
    try { mod = await deps.sondas() } catch (e) { console.log(`  as sondas não estão disponíveis (${e.message}): só os cérebros respondem`) }
    const casadas = new Map()
    for (const t of tipos) for (const p of t.padroes) { const s = R.casarSonda(p, mod?.SONDAS || []); if (s) casadas.set(`${t.id}|${p.id}`, s) }
    let medidas = new Map()
    const usadas = [...new Map([...casadas.values()].map((s) => [s.id, s])).values()]
    if (usadas.length && typeof mod?.executarSondas === 'function') {
      try {
        console.log(`medindo ${plural(usadas.length, 'sonda', 'sondas')} do programa`)
        medidas = normalizarSondas(await mod.executarSondas({ sondas: usadas, url: mapa.url, raiz, mapa, ...nav.opcoes }))
      } catch (e) {
        console.log(`  as sondas falharam (${e.message}): os padrões delas vão para os cérebros`)
      }
    }

    const quando = new Date().toISOString()
    const novos = []
    let semResposta = 0
    for (const t of tipos) {
      for (const p of R.padroesDoTipo(t)) {
        const info = { tipo: t.id, tipoNome: t.tipo, padrao: p.id, nome: p.nome, tipo_de_padrao: p.tipo_de_padrao || null, prevalencia: p.prevalencia || null, referencias: R.referenciasDe(p) }
        const sonda = casadas.get(`${t.id}|${p.id}`)
        const m = sonda && medidas.get(sonda.id)
        if (m) { novos.push({ ...info, status: m.status, porque: m.porque, evidencia: m.porque, autor: 'programa', via: 'sonda', sonda: sonda.id, quando }); continue }
        if (!cerebros.length) { semResposta++; continue }
        const pedido = R.pedidoMercado({ padrao: p, tipo: t, mapa })
        const respostas = await Promise.all(cerebros.map((spec) => consultar(deps, spec, pedido, p)))
        respostas.forEach((r, i) => novos.push({ ...info, status: r.status, porque: r.porque, autor: cerebros[i], via: 'cerebro', quando }))
      }
    }
    // o resultado novo substitui o antigo dos MESMOS tipos; o de outros tipos fica
    const antes = R.lerResultadosMercado(raiz).resultados.filter((r) => !tipos.some((t) => t.id === r.tipo))
    R.gravarResultadosMercado(raiz, { quando, resultados: [...antes, ...novos] })

    for (const c of R.comparacaoMercado(novos)) {
      console.log(`\nMercado (${c.tipoNome}): ${plural(c.tem.length + c.faltaConfirmada.length + c.faltaHipotese.length + c.naoDa.length, 'padrão', 'padrões')} medidos`)
      console.log(`  tem: ${c.tem.length}, falta confirmada: ${c.faltaConfirmada.length}, falta como hipótese: ${c.faltaHipotese.length}, não deu para ver: ${c.naoDa.length}`)
      for (const i of c.faltaConfirmada) console.log(`  falta (confirmada): ${i.nome} (${i.tipo_de_padrao === 'convencao' ? 'convenção' : i.tipo_de_padrao || 'padrão'}, ${i.prevalencia || '?'})`)
    }
    if (semResposta) console.log(`\n${plural(semResposta, 'padrão ficou', 'padrões ficaram')} sem resposta: nenhuma sonda casou e não há --cerebro (2 ou mais)`)
    const n = R.achadosDeMercado(novos).confirmados.length
    console.log(n ? `\n${plural(n, 'falta confirmada vira', 'faltas confirmadas viram')} pergunta para ele: ${CMD}\n` : '')
  },

  achados(a, raiz) {
    const ss = R.lerSessoes(raiz)
    const mercado = R.lerResultadosMercado(raiz).resultados
    if (!ss.length && !mercado.length) {
      console.log(`\nnenhuma sessão ainda (rode: ${CMD} agente <T1> --cerebro humano) e nenhuma comparação com o mercado (rode: ${CMD} mercado)\n`)
      return
    }
    if (ss.length) mostrarAchados(ss, R.lerMapa(raiz))
    if (mostrarMercadoAchados(mercado)) console.log('')
  },

  relatorio(a, raiz) {
    const arq = join(raiz, 'docs', 'roteiro', 'relatorio.html')
    const estado = R.ler(raiz)
    R.escreverAtomico(arq, relatorioHtml({ estado, mapa: R.lerMapa(raiz), sessoes: R.lerSessoes(raiz), mercado: R.lerResultadosMercado(raiz).resultados }))
    const s = R.situacao(estado, contexto(raiz))
    console.log(`\nrelatório gerado: ${arq}`)
    console.log(`  ${s.prontas} de ${s.total} fases prontas, ${plural((estado.tarefas || []).length, 'tarefa', 'tarefas')}\n`)
  },
}

/**
 * `injetados` troca os módulos do navegador (`{ mapa, agente, sondas }`, cada um uma
 * função que devolve o módulo), o cérebro do mercado (`perguntar(spec, pedido)`), a pasta da base (`mercadoDir`) e a pergunta "há terminal de verdade?" (`tty`, uma
 * função que devolve verdadeiro ou falso). Só os testes usam: é como conferir as
 * flags, o que chega ao plano e as regras de autoria sem abrir um Chrome.
 */
export async function main(argv = [], injetados = {}) {
  const deps = { mapa: () => import('./roteiroMapa.mjs'), agente: () => import('./roteiroAgente.mjs'), sondas: () => import('./roteiroSondas.mjs'), perguntar: perguntarCerebro, mercadoDir: R.MERCADO_DIR, tty: () => Boolean(process.stdin.isTTY), ...injetados }
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
export function relatorioHtml({ estado: estadoCru, mapa = null, sessoes = [], mercado = [], quando = new Date() }) {
  const estado = R.sincronizar(estadoCru, { mapa, sessoes, mercado })
  const s = R.situacao(estado, { mapa, sessoes })
  const atual = s.fases[s.fase]
  const lista = (itens, vazio) => (itens.length ? `<ul>${itens.map((i) => `<li>${i}</li>`).join('')}</ul>` : `<p class="sec">${vazio}</p>`)
  const partes = []

  partes.push(`<h1>Roteiro de uso</h1><p class="meta">${s.prontas} de ${s.total} fases prontas. Gerado em ${esc(quando.toISOString().slice(0, 16).replace('T', ' '))}.</p>`)

  // fase atual
  partes.push('<h2>Fase atual</h2>')
  const dele = atual.itens.filter((i) => i.tipo === 'ele' && !/: sem resposta$/.test(i.texto)).map((i) => esc(i.texto))
  partes.push(s.emDia
    ? '<div class="cartao bom">Todas as fases estão prontas. A fase 8 segue em dia enquanto houver rodada nova a cada versão.</div>'
    : `<div class="cartao alerta"><strong>Fase ${s.fase}, ${esc(s.titulo)}</strong>${lista(dele, 'nada faltando a você agora')}</div>`)
  if (atual.avisos.length) partes.push(`<p class="sec">Avisos do programa:</p>${lista(atual.avisos.map(esc), '')}`)
  partes.push(`<p class="sec">${s.fases.map((f) => `${f.id} ${esc(f.titulo)}: ${s.emDia || f.id < s.fase ? 'pronta' : f.id === s.fase ? 'agora' : 'aberta'}`).join(' | ')}</p>`)

  // quem tem o quê: ele, a IA e o programa
  partes.push('<h2>Quem tem o quê</h2>')
  const ele = R.progresso(estado, 'ele')
  partes.push(lista([
    `Com você: ${ele.total - ele.feitas} de ${plural(ele.total, 'pergunta', 'perguntas')} sem resposta`,
    `Com a IA: ${plural(s.iaPendentes, 'item', 'itens')} para preencher`,
    `Esperando você aprovar: ${plural(s.palpites.length, 'palpite', 'palpites')} da IA`,
    ...s.faltaPrograma.map((f) => `Falta ao programa: ${esc(f)}`),
  ], ''))
  if (s.palpites.length) {
    partes.push(`<p class="sec">Palpites esperando aprovação (${esc(CMD)} confirmar tudo):</p>${lista(s.palpites.map((p) => `${esc(p.id)}: ${esc(curto(p.texto, 120))} <span class="marca">${esc(p.de)}</span>`), '')}`)
  }

  // tarefas
  const ts = estado.tarefas || []
  partes.push(`<h2>Tarefas (${ts.length})</h2>`)
  partes.push(ts.length
    ? ts.map((t) => `<div class="cartao"><strong>${esc(t.id)}</strong> ${esc(t.objetivo)}${R.ehPalpite(t) ? ' <span class="marca">palpite</span>' : ''}<br><small>Deu certo quando: ${esc(t.sucesso?.texto || t.sucesso?.estado || 'não definido')}. Autor: ${esc(t.de)}${t.papel ? `. Papel: ${esc(t.papel)}` : ''}</small></div>`).join('')
    : '<p class="sec">nenhuma tarefa cadastrada ainda</p>')

  // respostas por fase, cada uma marcada com quem respondeu
  partes.push('<h2>Respostas por fase</h2>')
  const itens = R.itensDoRoteiro(estado, { mapa, sessoes })
  const marcaDe = (i) => {
    if (i.para === 'programa') return i.texto !== null ? '<span class="marca">programa</span>' : ''
    if (!i.de) return ''
    if (i.palpite) return `<span class="marca">${esc(i.de)}, palpite</span>`
    if (i.de.startsWith('ia:')) return `<span class="marca">${esc(i.de)}, confirmado</span>`
    return `<span class="marca">${esc(i.de)}</span>`
  }
  for (const f of s.fases) {
    const dela = itens.filter((i) => i.fase === f.id)
    if (!dela.length) continue
    partes.push(`<h3 style="font-size:19px;margin:14px 0 4px">Fase ${f.id}, ${esc(f.titulo)}</h3>`)
    partes.push(lista(dela.map((i) => {
      const corpo = i.para === 'programa'
        ? (i.texto !== null ? esc(i.texto) : `<span class="sec">falta: ${esc(i.falta)}</span>`)
        : (i.texto !== null ? esc(i.texto) : `<span class="sec">${i.para === 'ia' ? 'a IA ainda não preencheu' : 'sem resposta'}</span>`)
      return `<strong>${esc(i.header)}</strong>: ${corpo} ${marcaDe(i)}`
    }), 'nada nesta fase'))
  }

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

  // comparado com o mercado, um bloco por tipo
  const comparacoes = R.comparacaoMercado(mercado)
  if (!comparacoes.length) {
    partes.push(`<h2>Comparado com o mercado</h2><p class="sec">ainda não foi feito (${esc(CMD)} mercado --tipo familia/tipo)</p>`)
  }
  const linhaMercado = (i) => `<strong>${esc(i.nome)}</strong> <span class="marca">${esc(i.tipo_de_padrao === 'convencao' ? 'convenção' : (i.tipo_de_padrao || 'padrão'))}, ${esc(i.prevalencia || '?')}</span>${i.porque ? ` ${esc(i.porque)}` : ''}${i.referencias.length ? `<br><small>Referências: ${i.referencias.map(esc).join(', ')}</small>` : ''}`
  for (const c of comparacoes) {
    partes.push(`<h2>Comparado com o mercado (${esc(c.tipoNome)})</h2>`)
    for (const [titulo, itens, vazio] of [
      [`O projeto tem (${c.tem.length})`, c.tem, 'nenhum padrão confirmado'],
      [`Falta, confirmado (${c.faltaConfirmada.length})`, c.faltaConfirmada, 'nenhuma falta confirmada'],
      [`Falta, hipótese de um cérebro só (${c.faltaHipotese.length})`, c.faltaHipotese, 'nenhuma hipótese'],
      [`Não deu para ver (${c.naoDa.length})`, c.naoDa, 'nenhum'],
    ]) partes.push(`<h3 style="font-size:19px;margin:14px 0 4px">${titulo}</h3>${lista(itens.map(linhaMercado), vazio)}`)
  }

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
