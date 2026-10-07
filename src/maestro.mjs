/**
 * CC-828: o maestro do Coderoom. Divide um pedido em micro tarefas, roda uma a
 * uma no opencode e confere cada uma com um robô, gastando IA só onde precisa.
 *
 * Pedido dele em 01/10: "dividir as tarefas em micro tarefas, usar dois
 * modelos, um para dividir e criar um backlog, e um script rodando cada demanda
 * uma a uma, sempre um robô para verificar, o máximo robótico possível". E logo
 * depois: "menos processamento, menos tokens, para não ter essas pausas
 * gigantes". Escolhas dele: o plano sai do Gemini Pro pelo agy; o motor é UM só
 * com duas portas, primeiro o comando de terminal, o botão do Coderoom depois.
 *
 * Padrão de projeto, decisões dele em 01/10 (perguntadas na hora):
 *   - a micro tarefa é FILHA de um item do `docs/backlog.jsonl` do projeto. Um
 *     lugar só para tarefa: o ROADMAP mostra o pai com o andamento ("2 de 5");
 *   - o escopo geral do projeto mora no AGENTS.md, que o opencode já lê sozinho.
 *     Se faltar, o planejador escreve e o maestro grava ali;
 *   - cada micro tarefa roda numa conversa LIMPA, sem carregar as outras; o
 *     robô confere, e o que ele reprovar vira uma filha nova de conserto
 *     ("anota os erros, cria as tarefas de conserto e faz").
 *
 * Por que assim, medido nas simulações de 30/09 e 01/10:
 *   - o opencode anunciava 6 passos e fazia 1: o plano mora FORA dele;
 *   - pedido grande levava de 13 a 63 minutos e afogava o contexto;
 *   - "pronto" dito pelo modelo não provava nada: quem decide é o robô;
 *   - a resposta vinha vazia: o resumo final é escrito pelo robô, não pela IA.
 *
 * Porta 1 (terminal):
 *   node src/maestro.mjs --pasta <projeto> "<pedido>"            planeja e roda
 *   node src/maestro.mjs --pasta <projeto> --plano "<pedido>"    só planeja (ele revisa no backlog)
 *   node src/maestro.mjs --pasta <projeto> --pai XX-1 "<pedido>" divide um item que já existe
 *   node src/maestro.mjs --pasta <projeto> --continuar [XX-1]    roda as micro tarefas abertas
 */
import * as Vigia from './vigia.mjs'
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolverBinario } from './paineis.mjs'
import { lerTurno } from './gateAgentes.mjs'
import * as B from './backlog.mjs'
import { caminhoSeguro, validarPlano } from './tarefa.mjs'
import { lerConferencia, rodarConferencia } from './conferencia.mjs'
import { limparSegredos } from './segredo.mjs'
import { destravar, travar } from './travaArquivo.mjs'

export const PAINEL = process.env.CC_PAINEL || 'http://127.0.0.1:5180'
export const MODELO_PLANO = process.env.CC_MAESTRO_MODELO || 'gemini-3.1-pro-low'
export const MAX_TENTATIVAS = 3 // a tarefa e até dois consertos dela
// maior que a soma das esperas de limite do painel (2+4+8+15+15+15 = 59 min), senão o maestro desiste antes dele
export const ESPERA_TAREFA_MS = 90 * 60 * 1000

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const rodar = (cmd, args, opts = {}) => new Promise((ok) => {
  execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, ...opts }, (e, out, err) => ok({ ok: !e, out: String(out || ''), err: String(err || e?.message || '') }))
})

/* ============================== o lugar das tarefas ============================== */

const arqBacklog = (cwd) => B.caminhoPadrao(cwd)

/** O escopo mora no AGENTS.md. Grava o do planejador só quando o arquivo não traz um. */
export function garantirEscopo(cwd, escopo) {
  const arq = path.join(cwd, 'AGENTS.md')
  let atual = ''; try { atual = fs.readFileSync(arq, 'utf8') } catch { /* não existe */ }
  if (!escopo || /^##\s*Escopo/im.test(atual)) return false
  const bloco = `## Escopo do projeto\n\n${escopo.trim()}\n`
  fs.writeFileSync(arq, atual ? atual.trimEnd() + '\n\n' + bloco : `# ${path.basename(cwd)}\n\n` + bloco, 'utf8')
  return true
}

/**
 * Grava o plano como filhas de um item. Sem `pai`, cria o item com as palavras
 * dele (`citacao`). Devolve `{ pai, filhas }`.
 */
/** CC-845: a conferência de comportamento do projeto, declarada uma vez no AGENTS.md ("Conferência padrão: auto:anda <url>"). */
/**
 * CC-938, pedido dele em 06/10: "coloca o AGI então agora ao invés do Open Code". Quem constrói é escolha do PROJETO,
 * numa linha do AGENTS.md ("Construtor: agy"). Vale como o primeiro degrau da escada; sem a linha, o opencode.
 */
export function degrauInicial(cwd) {
  let t = ''; try { t = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8') } catch { return 0 }
  const nome = /^\s*[-*]?\s*construtor:\s*(\S+)/im.exec(t)?.[1]?.toLowerCase()
  const i = nome ? Vigia.ESCADA.findIndex((d) => d.agente === nome || d.modelo === nome) : -1
  return i < 0 ? 0 : i
}

export function conferenciaDoProjeto(cwd) {
  let t = ''; try { t = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8') } catch { return null }
  return /^\s*[-*]?\s*confer[eê]ncia padr[aã]o:\s*(auto:\S.*?)\s*$/im.exec(t)?.[1] || null
}

/**
 * CC-852: declara a conferência padrão no AGENTS.md, logo abaixo do título.
 * Troca a que já existir (uma linha só); sem AGENTS.md, cria pelo modelo.
 * Não valida: quem chama roda a conferência antes e só declara a que passou.
 */
export async function declararConferencia(cwd, conf, nota = '') {
  const arq = path.join(cwd, 'AGENTS.md')
  const linha = `Conferência padrão: ${conf}${nota ? `\n(${nota})` : ''}`
  let t = null; try { t = fs.readFileSync(arq, 'utf8') } catch { /* sem AGENTS.md */ }
  if (t == null) {
    const { AGENTS } = await import('./novoProjeto.mjs')
    t = AGENTS(path.basename(cwd).replace(/^(VPS|PC)_/i, ''), '')
  }
  const re = /^[ \t]*[-*]?[ \t]*confer[eê]ncia padr[aã]o:.*\n(\(.*\)\n)?/im
  if (re.test(t)) t = t.replace(re, linha + '\n')
  else { const i = t.indexOf('\n'); t = i < 0 ? `${t}\n\n${linha}\n` : `${t.slice(0, i + 1)}\n${linha}\n${t.slice(i + 1)}` }
  fs.writeFileSync(arq, t, 'utf8')
  return conferenciaDoProjeto(cwd) === conf
}

/* ===================================================================
   CC-919, 04/10: "as microtarefas todas precisam de mim, tem coisas repetidas que agentes podem testar, não eu".
   Projeto sem build nem teste não tem como o robô provar nada, e tudo cai no aceite dele. Nesse caso o PROGRAMA
   (não o planejador) acrescenta ao fim do plano a tarefa de escrever o teste do pedido, e esse teste vira a
   conferência do pedido: o robô o roda no fim e, se falhar, abre conserto.
   =================================================================== */

/** Sem build, sem teste e sem conferência declarada: o robô não tem como provar nada neste projeto. */
const scriptsDe = (cwd) => { try { return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).scripts || {} } catch { return {} } }

export function projetoSemProva(cwd) {
  try { const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')); if (pkg.scripts?.build || pkg.scripts?.test) return false } catch { /* sem package.json */ }
  const c = conferenciaDoProjeto(cwd)
  return !(c && !/^auto:build\b/.test(c))
}

/**
 * CC-941, medido em 07/10 no Conta de Casa: ele apontou que a sobra estava errada (CN-94), o robô corrigiu, e na obra
 * seguinte o teste ANTIGO (que descrevia a conta errada) falhou. O conserto mudou o código para o teste passar: o defeito
 * voltou, e o robô aprovou sozinho porque "o teste passou". As decisões dele vão junto do conserto, e mandam no teste.
 */
export function decisoesDele(itens) {
  const deles = itens.filter((x) => x.origem === 'felipe' && x.citacao && (x.natureza === 'DEF' || /^Sim\b/i.test(x.intencao || ''))).slice(-6)
  if (!deles.length) return ''
  return `\nDECISÕES DELE (valem mais que qualquer teste antigo; se um teste contradiz uma delas, corrija o TESTE, nunca o código):\n${deles.map((x) => `- ${x.id}: ${String(x.citacao).replace(/\s+/g, ' ').slice(0, 280)}`).join('\n')}`
}

/** Roda cada test-*.mjs da raiz do projeto que a conferência ainda não cobriu. Devolve a primeira falha, ou a conferência original. */
export async function todosOsTestes(cwd, base) {
  let arqs = []; try { arqs = fs.readdirSync(cwd).filter((f) => /^test-[\w-]+\.mjs$/.test(f)).sort() } catch { return base }
  const ja = new Set((String(JSON.stringify(scriptsDe(cwd).test || '')).match(/test-[\w-]+\.mjs/g) || []))
  const rodados = []
  for (const f of arqs.filter((x) => !ja.has(x))) {
    const r = await rodarConferencia(cwd, lerConferencia(`auto:node ${f}`))
    if (!r.ok) return { ok: false, erro: `o teste ${f} falhou: ${String(r.erro || '').split('\n')[0].slice(0, 300)}` }
    rodados.push(f)
  }
  return rodados.length ? { ...base, prova: `${base.prova || 'conferência passou'}; e mais ${rodados.length} teste(s) do projeto: ${rodados.join(', ')}` } : base
}

export const nomeDoTeste = (pai) => `test-${String(pai).toLowerCase()}.mjs`

/** Teste de fachada não vale: precisa de 3+ verificações e de falar com o servidor (fetch ou http). */
export function testeEhReal(cwd, arquivo) {
  let t = ''; try { t = fs.readFileSync(path.join(cwd, arquivo), 'utf8') } catch { return { ok: false, erro: `o teste ${arquivo} não existe: escreva-o na raiz do projeto` } }
  const verificacoes = (t.match(/\bassert(?:\.\w+)?\s*\(/g) || []).length
  if (verificacoes < 3) return { ok: false, erro: `o teste ${arquivo} é fraco: tem ${verificacoes} verificação(ões) e precisa de pelo menos 3, com node:assert, cobrindo o que o pedido construiu` }
  if (!/\bfetch\s*\(|http\.(get|request)\s*\(|\bsupertest\b/.test(t)) return { ok: false, erro: `o teste ${arquivo} não fala com o servidor: use fetch (ou http) para exercitar as rotas e as telas que o pedido construiu` }
  return { ok: true }
}

const tarefaDoTeste = (pedido, arquivo, arquivosDasOutras) => ({
  titulo: 'Escrever o teste do pedido',
  pedido: `Crie ${arquivo} na raiz do projeto (ESM, sem biblioteca nova): o teste automático do que este pedido construiu ("${String(pedido).replace(/\s+/g, ' ').slice(0, 160)}"). Ele sobe o servidor do projeto numa porta livre (o servidor lê a porta de process.env.PORT; se ele exportar o app, use listen(0)), exercita com fetch as rotas e telas novas, inclusive o que deve ser RECUSADO, confere com node:assert (no mínimo 3 verificações) e sai com código diferente de zero se algo falhar. Rode com node ${arquivo} e corrija até passar. Se o teste mostrar defeito real no código, conserte o código.`,
  arquivos: [arquivo, ...arquivosDasOutras],
  deixa: '',
})

export function gravarPlano(cwd, pedido, tarefas, { pai = null, area = 'tela', conferirPai = null } = {}) {
  const arq = arqBacklog(cwd)
  const { itens } = B.ler(arq)
  const prefixo = B.prefixoDoProjeto(itens, cwd)
  let arquivoDoTeste = null
  if (!pai) {
    pai = B.acrescentar({
      prefixo, natureza: 'PED', area, tamanho: 'M', estado: 'B1', origem: 'felipe', citacao: pedido,
      intencao: pedido.replace(/\s+/g, ' ').slice(0, 140),
      pronto: 'todas as micro tarefas passaram no robô do maestro, o build final passou e o projeto funciona',
      // CC-919, medido em 07/10: o Conta de Casa tinha `npm test` e o pedido foi gravado "auto:build" num projeto sem build: o teste nunca rodou
      conferir: conferirPai || conferenciaDoProjeto(cwd) || (scriptsDe(cwd).test ? 'auto:npm test' : 'auto:build'),
    }, arq).id
    if (!conferirPai && projetoSemProva(cwd)) {
      arquivoDoTeste = nomeDoTeste(pai)
      B.especificar(pai, { conferir: `auto:node ${arquivoDoTeste}` }, arq)
      tarefas = [...tarefas, tarefaDoTeste(pedido, arquivoDoTeste, [...new Set(tarefas.flatMap((t) => t.arquivos || []))])]
    }
  }
  const filhas = tarefas.map((t) => B.acrescentar({
    // CC-846: o que ela deixa para as próximas entra no pronto, e assim chega às irmãs pelo resumo do que já foi feito
    prefixo, pai, estado: 'B1', origem: 'maestro', intencao: t.titulo, pronto: t.deixa ? `${t.pedido}\nDeixa para as próximas: ${t.deixa}` : t.pedido, arquivos: t.arquivos,
    conferir: arquivoDoTeste && t.titulo === 'Escrever o teste do pedido' ? `auto:node ${arquivoDoTeste}` : 'auto:build',
  }, arq))
  B.regerarRoadmap(cwd)
  return { pai, filhas }
}

/* ============================== o planejador ============================== */

export function pedidoDePlano(pedido, arquivos, temEscopo = false) {
  return [
    'Você planeja, não executa. Divida o pedido abaixo em 2 a 8 micro tarefas pequenas, na ordem em que devem ser feitas.',
    'Cada uma tem de caber numa resposta curta de um programador: um assunto só, poucos arquivos, e o resultado tem de ser visível ou testável.',
    'Cada micro tarefa roda SEM ver as outras nem a conversa: o pedido dela tem de se bastar.',
    temEscopo ? 'O escopo do projeto já existe no AGENTS.md: deixe "escopo" vazio.'
      : 'Escreva também o ESCOPO do projeto: o que ele é, onde fica cada parte (arquivo e papel), e as regras que valem para qualquer tarefa. No máximo 25 linhas.',
    'Responda SÓ um JSON, sem texto antes nem depois:',
    '{"escopo":"texto do escopo, com \\n entre as linhas","tarefas":[{"titulo":"até 8 palavras","pedido":"o que fazer, em 1 a 3 frases, citando nomes concretos","arquivos":["caminho/relativo.js"],"deixa":"o que esta tarefa cria para as próximas usarem (id de elemento, nome de função, variável); obrigatório em todas menos a última"}]}',
    'Use só arquivos que existem na lista abaixo, ou novos com nome claro. Em português do Brasil, sem travessão.',
    '', `PEDIDO: ${pedido}`, '', 'ARQUIVOS DO PROJETO:', ...arquivos.slice(0, 120),
  ].join('\n')
}

async function arquivosDoProjeto(cwd) {
  const g = await rodar('git', ['-C', cwd, 'ls-files', '--cached', '--others', '--exclude-standard'], { timeout: 20000 })
  return g.out.split('\n').filter((l) => l && !/node_modules|^dist\/|package-lock/.test(l))
}

/** Pede o plano ao Gemini Pro pelo agy (escolha dele), só leitura. */
export async function planejar(pedido, cwd) {
  const pasta = '/tmp/claude-1001'
  fs.mkdirSync(pasta, { recursive: true })
  const base = path.join(pasta, `maestro-plano-${Date.now()}`)
  let agents = ''; try { agents = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8') } catch { /* sem escopo ainda */ }
  const corpo = pedidoDePlano(pedido, await arquivosDoProjeto(cwd), /^##\s*Escopo/im.test(agents))
  const agy = process.env.CC_MAESTRO_AGY || resolverBinario('agy')
  const perguntar = (texto, k) => new Promise((ok) => {
    const p = execFile(agy, ['--output-format', 'stream-json', '--mode', 'plan', '--model', MODELO_PLANO, '--add-dir', cwd], { cwd, timeout: 240000, maxBuffer: 16 * 1024 * 1024 }, (e, out, err) => {
      fs.writeFileSync(`${base}-${k}.jsonl`, String(out || '')); fs.writeFileSync(`${base}-${k}.err`, String(err || ''))
      ok(lerTurno(`${base}-${k}.jsonl`, 'agy', `${base}-${k}.err`))
    })
    p.stdin.end(limparSegredos(texto)) // CC-841: segredo nunca vai para modelo
  })
  /* CC-837 (Nisaba): o contrato decide. Recusado, o erro EXATO volta ao
     planejador uma vez; recusado de novo, para com o motivo, sem garimpar. */
  let r = await perguntar(corpo, 1)
  let v = validarPlano(r.texto)
  if (!v.ok) {
    r = await perguntar(`${corpo}\n\nSUA RESPOSTA ANTERIOR FOI RECUSADA PELO CONTRATO:\n- ${v.erros.slice(0, 8).join('\n- ')}\nResponda de novo, só o JSON.`, 2)
    v = validarPlano(r.texto)
  }
  if (!v.ok) throw new Error(`o plano foi recusado pelo contrato duas vezes: ${v.erros.slice(0, 4).join('; ')}${r.erro ? ' (' + r.erro + ')' : ''}`)
  return v.plano
}

/* ============================== o robô ============================== */

// o que o próprio maestro escreve não conta como "o agente mexeu": sem eventos.jsonl aqui, tarefa vazia passava (CC-839)
const FORA_DA_CONTA = /node_modules|^dist\/|^\.coderoom\/|^docs\/(backlog\.jsonl|eventos\.jsonl|ROADMAP\.md)$/

/**
 * Arquivos do projeto mexidos depois de `desde`. Com `head` (o commit de antes
 * da tarefa), conta também o que já entrou em commit: medido em 01/10, o jogo
 * recebe um commit automático ao fim de cada resposta, e o robô, olhando só o
 * que estava pendente, reprovou 3 vezes uma tarefa por "nenhum arquivo".
 */
export async function mexidosDesde(cwd, desde, head = null) {
  const pendentes = await rodar('git', ['-C', cwd, 'ls-files', '--modified', '--others', '--exclude-standard'], { timeout: 20000 })
  const commitados = head ? await rodar('git', ['-C', cwd, 'diff', '--name-only', head], { timeout: 20000 }) : { out: '' }
  const todos = new Set((pendentes.out + '\n' + commitados.out).split('\n').filter((l) => l && !FORA_DA_CONTA.test(l)))
  return [...todos].filter((l) => {
    try { return fs.statSync(path.join(cwd, l)).mtimeMs > desde } catch { return false }
  }).sort()
}

export async function headDe(cwd) {
  const r = await rodar('git', ['-C', cwd, 'rev-parse', 'HEAD'], { timeout: 10000 })
  return r.ok ? r.out.trim() : null
}

/* ===================================================================
   CC-839 (Nisaba): menor privilégio e ponto de volta.
   A micro tarefa declara os arquivos; mexer fora deles reprova. Reprovada,
   os arquivos que ela mexeu voltam ao que eram ANTES dela, sem `git stash`
   nem `reset`: outra sessão pode ter trabalho sem commit na mesma pasta, e
   só o que esta tentativa tocou é desfeito.
   =================================================================== */

/** Arquivos mexidos fora da lista declarada. Lista vazia declara "qualquer um". */
/* CC-889, 04/10: no Conta de Casa o robô reprovou 4 de 6 micro tarefas por "mexeu fora dos arquivos
   declarados", e os arquivos eram efeito normal de fazer a tarefa: instalar uma biblioteca mexe em
   package.json e no lock, rodar o app cria o banco e os uploads. Cada reprovação desfez o trabalho e
   abriu um conserto. Código alheio continua reprovado; isto aqui não é código de ninguém. */
const EFEITO_NORMAL = [
  /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json)$/,
  /(^|\/)node_modules\//, /(^|\/)\.gitignore$/, /(^|\/)uploads\//,
  /\.(db|db-shm|db-wal|sqlite|sqlite3|sqlite-shm|sqlite-wal)$/,
  // 07/10: o estado do projeto que o PAINEL escreve (backlog, diário, sprints, mapa) não é código do agente; sprints.jsonl reprovou 2 tarefas boas
  /^docs\/[^/]+\.jsonl$/, /^docs\/ROADMAP\.md$/, /^\.framework\//,
]
export function foraDoDeclarado(mexidos, declarados) {
  if (!declarados?.length) return []
  const norm = (f) => String(f).replace(/\\/g, '/').replace(/^\.\//, '')
  const ok = new Set(declarados.map(norm))
  return mexidos.map(norm).filter((f) => !ok.has(f) && !EFEITO_NORMAL.some((re) => re.test(f)))
}

/** Marca o estado da pasta antes da tentativa. `git stash create` fotografa o que está sem commit sem mexer em nada. */
export async function pontoDeVolta(cwd) {
  const foto = (await rodar('git', ['-C', cwd, 'stash', 'create'], { timeout: 20000 })).out.trim()
  const ref = foto || await headDe(cwd)
  const soltos = (await rodar('git', ['-C', cwd, 'ls-files', '--others', '--exclude-standard'], { timeout: 20000 })).out.split('\n').filter((l) => l && !FORA_DA_CONTA.test(l))
  const guardados = new Map()
  let total = 0
  for (const f of soltos) {
    try { const b = fs.readFileSync(path.join(cwd, f)); total += b.length; if (total > 20e6) break; guardados.set(f, b) } catch { /* sumiu */ }
  }
  return { ref, guardados, conteudo: await fotoDoConteudo(cwd) }
}

/* ===================================================================
   O que o agente mudou, pelo CONTEÚDO e não pela hora (01/10).
   A conta antiga (hora do arquivo + diferença para o commit de antes)
   reprovou três vezes uma tarefa que não mexeu em nada: o commit
   automático no meio dela juntou mudanças de uma rodada anterior, e o
   robô as pôs na conta do agente. Comparar o conteúdo antes e depois
   ignora regravação igual e commit no meio.
   =================================================================== */

/** O hash do conteúdo de cada arquivo do projeto (fora o que não conta). */
export async function fotoDoConteudo(cwd) {
  const r = await rodar('git', ['-C', cwd, 'ls-files', '--cached', '--others', '--exclude-standard'], { timeout: 20000 })
  const mapa = new Map()
  for (const f of r.out.split('\n').filter((l) => l && !FORA_DA_CONTA.test(l))) {
    try { const b = fs.readFileSync(path.join(cwd, f)); if (b.length < 5e6) mapa.set(f, crypto.createHash('sha1').update(b).digest('hex')) } catch { /* apagado ou ilegível */ }
  }
  return mapa
}

/** Os arquivos cujo conteúdo mudou, nasceu ou sumiu entre duas fotos. */
export function mudadosEntre(antes, depois) {
  const s = new Set()
  for (const [f, h] of depois) if (antes.get(f) !== h) s.add(f)
  for (const f of antes.keys()) if (!depois.has(f)) s.add(f)
  return [...s].sort()
}

/**
 * Reescrita destrutiva: arquivo que perdeu mais de 80 linhas e encolheu para
 * menos de 60% do que era. Visto ao vivo em 01/10: um agente regravou o
 * index.html inteiro com `cat > arquivo` (257 linhas a menos, painel do jogo
 * sumido), compilou, abriu sem erro de código e PASSOU. Conta, não IA.
 */
export async function encolhidos(cwd, ponto, mexidos) {
  if (!ponto?.ref) return []
  const linhas = (t) => (t.match(/\n/g) || []).length
  const achados = []
  for (const f of mexidos) {
    const antes = ponto.guardados.has(f) ? ponto.guardados.get(f).toString('utf8') : (await rodar('git', ['-C', cwd, 'show', `${ponto.ref}:${f}`], { timeout: 10000 })).out
    let depois = ''; try { depois = fs.readFileSync(path.join(cwd, f), 'utf8') } catch { /* apagado: conta como zero */ }
    const [a, d] = [linhas(antes), linhas(depois)]
    if (a - d > 80 && d < a * 0.6) achados.push(`${f} (${a} para ${d} linhas)`)
  }
  return achados
}

/** Devolve os arquivos ao ponto. Sem git não há ponto confiável, e aí nada é desfeito. */
export async function voltar(cwd, ponto, arquivos) {
  if (!ponto?.ref) return []
  const desfeitos = []
  for (const f of arquivos) {
    if (caminhoSeguro(f)) continue
    const alvo = path.join(cwd, f)
    if (ponto.guardados.has(f)) { fs.writeFileSync(alvo, ponto.guardados.get(f)); desfeitos.push(f); continue }
    const existia = (await rodar('git', ['-C', cwd, 'cat-file', '-e', `${ponto.ref}:${f}`], { timeout: 10000 })).ok
    if (existia) { if ((await rodar('git', ['-C', cwd, 'checkout', ponto.ref, '--', f], { timeout: 20000 })).ok) desfeitos.push(f) }
    else { fs.rmSync(alvo, { force: true }); desfeitos.push(f) } // nasceu nesta tentativa
  }
  return desfeitos
}

/** O build do projeto, quando existe. `{ ok, erro }` com as linhas que importam. */
export async function build(cwd) {
  let pkg = null; try { pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) } catch { /* sem build */ }
  if (!pkg?.scripts?.build || !fs.existsSync(path.join(cwd, 'node_modules'))) return { ok: true, erro: null, rodou: false }
  const b = await rodar('npm', ['run', 'build'], { cwd, timeout: 180000 })
  if (b.ok) return { ok: true, erro: null, rodou: true }
  const linhas = (b.out + '\n' + b.err).split('\n').filter((l) => /error|erro|failed|cannot|unexpected|not found|does not provide/i.test(l)).slice(0, 6)
  return { ok: false, erro: 'o build falhou:\n' + (linhas.join('\n') || (b.err || b.out).slice(-600)), rodou: true }
}

/** O robô que confere uma micro tarefa. Devolve `{ ok, erro, mexidos }` com o erro EXATO. */
export async function conferir(cwd, desde, head = null, conferirItem = 'auto:build', ponto = null) {
  const mexidos = ponto?.conteudo ? mudadosEntre(ponto.conteudo, await fotoDoConteudo(cwd)) : await mexidosDesde(cwd, desde, head)
  if (!mexidos.length) return { ok: false, erro: 'nenhum arquivo do projeto foi alterado nesta tarefa', mexidos }
  // CC-838: a conferência da tarefa, só de lista fechada; build (ou nada a conferir) segue pelo build() daqui
  const c = lerConferencia(conferirItem)
  const b = c.conhecido && c.tipo !== 'build' ? await rodarConferencia(cwd, c) : await build(cwd)
  if (!b.ok) return { ok: false, erro: b.erro || null, mexidos }
  /* Visto ao vivo em 01/10: um agente reescreveu o index.html inteiro (257
     linhas a menos, painel do jogo sumido), compilou, e a micro tarefa PASSOU.
     Toda micro tarefa agora também abre a página sem erro de código, quando o
     projeto declarou endereço; quebrou, reprova na hora e o ponto de volta desfaz. */
  const url = /^auto:(?:abre|anda)\s+(\S+)/.exec(conferenciaDoProjeto(cwd) || '')?.[1]
  if (url) {
    const a = await rodarConferencia(cwd, lerConferencia(`auto:abre ${url}`))
    if (!a.ok) return { ok: false, erro: a.erro, mexidos }
  }
  return { ok: true, erro: null, mexidos }
}

/* ============================== a execução ============================== */

const api = async (rota, corpo) => {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(PAINEL + rota, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(30000) } : { signal: AbortSignal.timeout(30000) })
      return await r.json()
    } catch (e) { if (i > 60) throw e; await dorme(3000) } // painel religando: espera uns 3 minutos
  }
}

/* Medido na 1ª rodada (01/10): depois da resposta o painel tira as fotos (~3 min
   SEM resposta aberta) e então abre a revisão do Claude. O maestro via 30 s
   quietos, mandava a tarefa seguinte no meio da revisão, a mensagem ficava
   guardada e nenhum agente a pegava: 40 minutos esperando nada. "Ocupada" agora
   inclui a conferência das fotos em andamento. */
export function ocupada(c) {
  if (c?.turnoAberto) return true
  if ((c?.cabecalho?.esperandoLimite || 0) > Date.now()) return true // o painel espera o limite do grátis passar e tenta sozinho
  const ult = (c?.mensagens || []).at(-1)
  return Boolean(ult && ult.de === 'sistema' && /^Conferindo/.test(ult.texto || ''))
}

/** Espera a conversa ficar livre de verdade: `quietos` olhadas seguidas (3 s cada) sem nada em andamento. */
async function esperarLivre(id, { desde = 0, quietos = 10, ate = Date.now() + ESPERA_TAREFA_MS } = {}) {
  let quieto = 0
  while (Date.now() < ate) {
    await dorme(3000)
    let c; try { c = await api(`/api/gate/conversa?id=${id}`) } catch { continue }
    const houve = !desde || (c.mensagens || []).slice(desde).some((m) => m.de !== 'felipe' && m.de !== 'sistema')
    quieto = ocupada(c) ? 0 : quieto + 1
    if (houve && quieto >= quietos) return c
  }
  return null
}

/** A mensagem de uma micro tarefa. Conserto leva o erro exato do robô. */
/**
 * A mensagem de uma micro tarefa. Conserto leva o erro exato do robô.
 * CC-846: `feitas` são as irmãs já fechadas. Sem elas, cada conversa limpa
 * ignorava o que a anterior criou: em 01/10 a 1ª fez o quadro do recorde e a
 * 2ª, sem saber dele, escreveu o recorde num texto solto, e o quadro ficou
 * escondido para sempre, com as duas aprovadas pelo robô.
 */
export function textoDaTarefa(t, erro = null, feitas = [], pedidoOriginal = null) {
  const arquivos = t.arquivos?.length ? `Arquivos: ${t.arquivos.join(', ')}.` : ''
  const antes = feitas.length ? ['JÁ FEITO NESTE PEDIDO (use o que já existe, não recrie):', ...feitas.map((x) => `- ${x.id} ${x.intencao}: ${String(x.pronto || '').replace(/\s+/g, ' ').slice(0, 300)} (${String(x.prova || '').replace(/^robô: /, '').split(';')[0]})`), '---'].join('\n') : ''
  /* 01/10: o conserto ia só com o erro. Quando o plano errou o lugar (mandou
     procurar no CSS uma faixa que é objeto do cenário 3D), o agente não tinha
     como saber: o pedido original, com as palavras dele, vai junto. */
  const original = pedidoOriginal ? `PEDIDO ORIGINAL (as palavras dele; se o plano desta tarefa errou o lugar, siga o pedido):\n${String(pedidoOriginal).slice(0, 1200)}` : ''
  if (erro) return [antes, `Micro tarefa ${t.id}: ${t.intencao}.`, t.pronto, 'A tentativa anterior NÃO passou na conferência automática:', erro, original, arquivos, 'Corrija só isso.'].filter(Boolean).join('\n')
  return [antes, `Micro tarefa ${t.id}: ${t.intencao}.`, t.pronto, arquivos, 'Faça SÓ esta tarefa, sem mexer em mais nada, e responda em uma linha o que fez.'].filter(Boolean).join('\n')
}

export function resumoDoRobo(filhas, mexidos, final) {
  const valem = filhas.filter((t) => t.estado !== 'KO')
  const ok = valem.filter((t) => t.estado === 'OK').length
  return [
    `Maestro: ${ok} de ${valem.length} micro tarefas passaram na conferência.`,
    ...filhas.map((t) => `${t.estado === 'OK' ? '✓' : '✕'} ${t.id}. ${t.intencao}${t.estado === 'OK' ? '' : ': ' + String(t.porque || t.estado).split('\n')[0]}`),
    mexidos.length ? `Arquivos alterados: ${mexidos.slice(0, 15).join(', ')}${mexidos.length > 15 ? ' e outros' : ''}.` : 'Nenhum arquivo alterado.',
    final,
  ].join('\n')
}

/** Abre uma conversa limpa para a micro tarefa. */
async function conversaNova(t) {
  const id = (await api('/api/gate/nova', { cwd: t.cwd, titulo: '' })).id
  await api('/api/gate/renomear', { id, titulo: `${t.id}: ${t.intencao}`.slice(0, 60) })
  await api('/api/gate/opencode-modo', { id, modo: 'normal' })
  return id
}

/** Manda uma mensagem e espera a resposta inteira. `null` se o agente não terminou no prazo. */
async function mandarEEsperar(id, texto, degrau = 0) {
  const { agente, modelo } = Vigia.degrauDe(degrau) // CC-929: quem constrói depende do degrau da tarefa
  await esperarLivre(id, { quietos: 5 }) // nada em andamento antes de mandar
  const antes = (await api(`/api/gate/conversa?id=${id}`)).mensagens.length
  let env = await api('/api/gate/mensagem', { id, agente, modelo, texto })
  /* 07/10, medido no backup do Conta de Casa: com a VPS sobrecarregada o painel SEGURA agente novo (CC-857) e devolve
     "sobrecarregada". O maestro ignorava, achava que o modelo não fez nada e gastava as 3 tentativas em 3 minutos: era o
     "o agy trava" que ele via. Agora espera a carga baixar (até 30 min) e manda de novo, sem contar como falha do modelo. */
  for (let k = 0; env && env.ok === false && /sobrecarregad/i.test(String(env.error || env.erro || '')) && k < 60; k++) {
    if (k === 0) await api('/api/gate/nota', { id, texto: 'Maestro: a VPS está sobrecarregada e o painel está segurando agentes novos. Espero a carga baixar e mando a tarefa de novo.' }).catch(() => {})
    await dorme(30000)
    const c = await api('/api/carga').catch(() => null)
    if (c && c.segurando) continue
    env = await api('/api/gate/mensagem', { id, agente, modelo, texto })
  }
  if (env && env.ok === false) return null // não chegou ao agente: "não terminou no prazo", não "não fez nada"
  // caiu como "guardada" (alguém respondendo): ninguém a pega sozinho; espera e manda de novo
  for (let k = 0; env?.guardado && k < 3; k++) {
    await esperarLivre(id, { quietos: 5 })
    env = await api('/api/gate/mensagem', { id, agente, modelo, texto })
  }
  return esperarLivre(id, { desde: antes })
}

/** O item mais recente com micro tarefa aberta: é o que `--continuar` sem id retoma. */
export function paiAberto(itens) {
  const pais = new Set(itens.filter((x) => x.pai && B.estaAberto(x)).map((x) => x.pai))
  return itens.filter((x) => pais.has(x.id)).at(-1)?.id || null
}

/**
 * Roda as filhas abertas de `pai`, uma por conversa limpa. Reprovada pelo robô,
 * a filha é cancelada com o erro e nasce uma filha de conserto, na mesma
 * conversa (ela sabe o que fez). Depois de MAX_TENTATIVAS, a última fica travada
 * com a causa escrita, e a fila segue.
 */
export const RODADAS_DO_PEDIDO = 2 // a fila e mais uma volta de conserto do pedido inteiro

/* 02/10, medido: encerrado o maestro, o AGENTE que ele chamou seguiu vivo (é
   processo próprio) e continuou mexendo no jogo sem robô nenhum conferindo,
   com as travas já soltas. Ao ser encerrado, o maestro para a resposta em
   andamento e solta as travas antes de sair. */
let emAndamento = null // { conversa, dono }
const aoEncerrar = async () => {
  const a = emAndamento
  if (a) { try { destravar(a.dono); await api('/api/gate/parar', { id: a.conversa }) } catch { /* saindo de qualquer jeito */ } }
  process.exit(1)
}


export async function executar(cwd, pai, { log = console.log, rodada = 1 } = {}) {
  const arq = arqBacklog(cwd)
  /* Conserto primeiro (tem `erroAnterior`): roda logo depois da reprovação, na
     mesma conversa, enquanto o agente sabe o que fez. Medido em 01/10: pela
     ordem do número, o conserto da 1ª ia para o fim da fila, depois das outras.
     ponytail: o robô sabe QUAIS arquivos mudaram, não QUEM mudou; com o maestro
     rodando, ninguém mexe no projeto (em 01/10 uma edição minha reprovou SIM-15). */
  const filhasAbertas = () => {
    const abertas = B.filhasDe(B.ler(arq).itens, pai).filter((x) => B.estaAberto(x) && x.estado !== 'TR')
    return [...abertas.filter((x) => x.erroAnterior), ...abertas.filter((x) => !x.erroAnterior)]
  }
  const inicio = Date.now()
  const head0 = await headDe(cwd)
  log(`${pai}: ${filhasAbertas().length} micro tarefas abertas`)
  let t
  while ((t = filhasAbertas()[0])) {
    const comeco = Date.now()
    const conversa = t.conversa || await conversaNova({ ...t, cwd })
    t = B.mover(t.id, 'EM', { conversa }, arq)
    const tentativa = t.tentativa || 1
    const head = await headDe(cwd)
    const ponto = await pontoDeVolta(cwd)
    const feitas = B.filhasDe(B.ler(arq).itens, pai).filter((x) => x.estado === 'OK')
    // CC-847: os arquivos declarados ficam travados para qualquer outra sessão enquanto a tarefa roda
    const dono = `gate:${conversa}`
    emAndamento = { conversa, dono }
    if (t.arquivos?.length) travar(cwd, t.arquivos, { dono, ate: Date.now() + ESPERA_TAREFA_MS + 10 * 60000, motivo: `${t.id} ${t.intencao}`.slice(0, 120) })
    let r
    try {
      const citacao = B.ler(arq).itens.find((x) => x.id === pai)?.citacao || null
      const c = await mandarEEsperar(conversa, textoDaTarefa(t, t.erroAnterior || null, feitas, citacao), t.degrau ?? degrauInicial(cwd))
      r = c ? await conferir(cwd, comeco - 1000, head, t.conferir, ponto) : { ok: false, erro: 'o agente não terminou no prazo', mexidos: mudadosEntre(ponto.conteudo, await fotoDoConteudo(cwd)) }
      const fora = foraDoDeclarado(r.mexidos, t.arquivos)
      if (r.ok && fora.length) r = { ...r, ok: false, erro: `mexeu fora dos arquivos declarados (${(t.arquivos || []).join(', ')}): ${fora.join(', ')}` }
      // CC-919: o teste do pedido que o agente escreveu tem de ser de verdade (3+ verificações e fala com o servidor)
      const mt = /^auto:node (test-[\w-]+\.mjs)$/.exec(t.conferir || '')
      if (r.ok && mt && mt[1] === nomeDoTeste(pai)) { const q = testeEhReal(cwd, mt[1]); if (!q.ok) r = { ...r, ok: false, erro: q.erro } }
      const destruidos = r.ok ? await encolhidos(cwd, ponto, r.mexidos) : []
      if (destruidos.length) r = { ...r, ok: false, erro: `reescrita destrutiva: apagou boa parte de ${destruidos.join(', ')}. Mude só o trecho necessário, sem regravar o arquivo inteiro` }
      if (!r.ok && r.mexidos.length) {
        const desfeitos = await voltar(cwd, ponto, r.mexidos)
        if (desfeitos.length) r = { ...r, erro: `${r.erro}\n(as mudanças desta tentativa foram desfeitas: ${desfeitos.join(', ')})` }
      }
    } finally { destravar(dono); emAndamento = null }
    B.registrar([{ tipo: 'robo', id: t.id, ok: r.ok, texto: r.ok ? `alterou ${r.mexidos.join(', ')}` : r.erro, conversa }], arq) // CC-836: o diário conta o que o robô viu
    const segundos = Math.round((Date.now() - comeco) / 1000)
    log(`  ${t.id}. ${t.intencao}: ${r.ok ? 'passou' : 'reprovada: ' + r.erro.split('\n')[0]}`)
    if (r.ok) {
      B.mover(t.id, 'OK', { prova: `robô: alterou ${r.mexidos.join(', ')}; build passou`, segundos }, arq); B.regerarRoadmap(cwd)
      // CC-891, decisão dele em 04/10: a conversa da micro tarefa que passou vai para os arquivados. O conserto reaproveita a mesma conversa, então ela só sai da lista quando passa.
      api('/api/gate/arquivar', { id: conversa, arquivar: true }).catch(() => { /* a lista fica como estava */ })
      continue
    }
    if (tentativa >= MAX_TENTATIVAS) { B.mover(t.id, 'TR', { porque: `reprovada ${tentativa} vezes pelo robô: ${r.erro}`, segundos }, arq); B.regerarRoadmap(cwd); continue }
    const conserto = B.acrescentar({
      pai, estado: 'B1', origem: 'maestro', intencao: `conserto de ${t.id}: ${t.intencao}`.slice(0, 140), pronto: t.pronto, arquivos: t.arquivos,
      conferir: t.conferir, prefixo: t.id.split('-')[0],
    }, arq)
    /* CC-929, medido em 06/10: quando a falha é do MODELO (não escreveu nada, vazio, limite), repetir no mesmo modelo
       e na mesma conversa repete a falha: ele relê o próprio "criei" e diz de novo. O conserto sobe um degrau da escada
       (outro modelo, depois o Agy) numa conversa limpa. Falha do CÓDIGO segue na mesma conversa, que sabe o que fez. */
    const doModelo = Vigia.falhaDoModelo(r.erro)
    const atual = t.degrau ?? degrauInicial(cwd)
    const proximo = doModelo ? Math.min(atual + 1, Vigia.ESCADA.length - 1) : atual
    B.mover(conserto.id, 'B1', { ...(doModelo ? {} : { conversa }), tentativa: tentativa + 1, erroAnterior: r.erro, degrau: proximo }, arq)
    if (doModelo) log(`  ${conserto.id}: a falha foi do modelo; a nova tentativa vai para ${Vigia.degrauDe(proximo).agente}${Vigia.degrauDe(proximo).modelo ? ' ' + Vigia.degrauDe(proximo).modelo : ''}, numa conversa limpa`)
    B.mover(t.id, 'KO', { porque: `reprovada pelo robô: ${r.erro}; conserto em ${conserto.id}`, segundos }, arq)
    B.regerarRoadmap(cwd)
  }
  const filhas = B.filhasDe(B.ler(arq).itens, pai)
  const mexidos = await mexidosDesde(cwd, inicio - 1000, head0)
  const final = await build(cwd)
  /* CC-845: build passar não diz que o projeto funciona (o jogo travado
     passava). A conferência do pedido pai roda no fim; reprovada, vira uma
     micro tarefa de conserto com o erro medido, e a fila roda de novo. */
  const cPai = lerConferencia(B.ler(arq).itens.find((x) => x.id === pai)?.conferir)
  // build por pasta (monorepo) roda sempre: o build() acima só vê a raiz
  const comportamento0 = final.ok && cPai.conhecido && (cPai.tipo !== 'build' || cPai.pastas) ? await rodarConferencia(cwd, cPai) : null
  /* CC-941, medido em 07/10 no Conta de Casa: o agente escreveu o teste da regra dele (test-sobra-mes.mjs) num arquivo à
     parte, e o "npm test" do projeto rodava só o teste ANTIGO, que exigia a conta errada. O teste novo nunca rodou. No fim
     da obra roda TODO teste da raiz (test-*.mjs) além da conferência do pedido; um que falhe reprova o pedido. */
  const comportamento = comportamento0 && comportamento0.ok ? await todosOsTestes(cwd, comportamento0) : comportamento0
  if (comportamento) B.registrar([{ tipo: 'robo', id: pai, ok: comportamento.ok, texto: comportamento.ok ? comportamento.prova : comportamento.erro }], arq)
  const travadas = filhas.filter((x) => B.estaAberto(x))
  if (comportamento && !comportamento.ok && !travadas.length && rodada < RODADAS_DO_PEDIDO) {
    log(`  ${pai}: o projeto não passou na conferência de comportamento: ${comportamento.erro}`)
    const ult = filhas.at(-1)
    const conserto = B.acrescentar({
      pai, estado: 'B1', origem: 'maestro', prefixo: pai.split('-')[0], arquivos: [], conferir: 'auto:build',
      intencao: `conserto do pedido ${pai}: o projeto não funciona como pedido`.slice(0, 140),
      pronto: `As micro tarefas passaram, mas a conferência do projeto reprovou: ${comportamento.erro}. Ache a causa e conserte.${decisoesDele(B.ler(arq).itens)}`,
    }, arq)
    if (ult?.conversa) B.mover(conserto.id, 'B1', { conversa: ult.conversa }, arq)
    B.regerarRoadmap(cwd)
    return executar(cwd, pai, { log, rodada: rodada + 1 })
  }
  const linhaFinal = [!final.rodou ? 'Sem build no projeto.' : final.ok ? 'Build final: passou.' : 'Build final: ' + final.erro.split('\n')[0],
    comportamento ? (comportamento.ok ? `Comportamento: passou (${comportamento.prova.replace(/^robô: /, '')}).` : `Comportamento: reprovou (${comportamento.erro}).`) : null].filter(Boolean).join('\n')
  const resumo = resumoDoRobo(filhas, mexidos, linhaFinal)
  if (!travadas.length && final.ok && (!comportamento || comportamento.ok)) B.mover(pai, 'OK', { prova: resumo }, arq)
  B.regerarRoadmap(cwd)
  return { pai, resumo, filhas }
}

/* ============================== porta 1: o terminal ============================== */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2)
  const valor = (f) => { const i = a.indexOf(f); return i >= 0 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : null }
  const cwd = path.resolve(valor('--pasta') || process.cwd())
  const usados = new Set(['--pasta', '--pai', '--continuar', '--conferir', '--avisar'].flatMap((f) => { const i = a.indexOf(f); return valor(f) ? [i + 1] : [] }))
  const pedido = a.filter((x, k) => !x.startsWith('--') && !usados.has(k)).join(' ').trim()
  const so = a.includes('--plano'); const continuar = a.includes('--continuar')
  /* CC-849: --avisar <conversa> escreve o andamento na conversa do Coderoom de
     onde veio o pedido (porta 2: o celular). Sem ela, só o terminal. */
  process.once('SIGTERM', aoEncerrar) // só quando roda como programa, não quando é importado
  process.once('SIGINT', aoEncerrar)
  const conversaDele = valor('--avisar')
  const log = (l) => { console.log(l); if (conversaDele) api('/api/gate/nota', { id: conversaDele, texto: `Maestro: ${String(l).trim()}` }).catch(() => {}) }
  ;(async () => {
    // CC-854: desligado na tela Projetos, o maestro não roda neste projeto (trava, não aviso)
    const { moduloLigado, projetoDe } = await import('./config.mjs')
    if (!moduloLigado('nisaba', projetoDe(cwd))) throw new Error(`o Nisaba está desligado em ${projetoDe(cwd)} (tela Projetos)`)
    let pai = valor('--pai') || valor('--continuar')
    if (!continuar) {
      if (!pedido) throw new Error('uso: node src/maestro.mjs --pasta <projeto> [--plano] [--pai XX-1] "<pedido>"  |  --continuar [XX-1]')
      console.log(`planejando com ${MODELO_PLANO}...`)
      const t0 = Date.now()
      const { tarefas, escopo } = await planejar(pedido, cwd)
      if (garantirEscopo(cwd, escopo)) console.log('escopo do projeto gravado no AGENTS.md')
      const g = gravarPlano(cwd, pedido, tarefas, { pai, conferirPai: valor('--conferir') })
      pai = g.pai
      log(`plano em ${Math.round((Date.now() - t0) / 1000)} s, ${g.filhas.length} micro tarefas no pedido ${pai}:\n${g.filhas.map((f) => `${f.id}. ${f.intencao}`).join('\n')}`)
      for (const f of g.filhas) console.log(`  ${f.id}. ${f.intencao}  [${(f.arquivos || []).join(', ')}]\n     ${f.pronto}`)
      if (so) return console.log(`\nrevise em docs/backlog.jsonl e rode: node src/maestro.mjs --pasta ${cwd} --continuar ${pai}`)
    }
    pai = pai || paiAberto(B.ler(arqBacklog(cwd)).itens)
    if (!pai) throw new Error('não há micro tarefa aberta neste projeto')
    const r = await executar(cwd, pai, { log })
    log(r.resumo)
  })().catch((e) => { log(`parou com erro: ${e.message || e}`); setTimeout(() => process.exit(1), 1500) })
}
