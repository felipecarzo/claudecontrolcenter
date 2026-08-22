/**
 * CC-281: os coletores da zona inteligente.
 *
 * Cada coletor sabe produzir números de UMA fonte, e devolve sempre o mesmo
 * formato: `{ dia, projeto, medida, valor }`. Quem guarda é `armazem.mjs`, que
 * não sabe de onde veio nada.
 *
 * ## Por que estas medidas, e não outras
 *
 * A terceira rodada da iteração (`docs/produto/ZONA-INTELIGENTE.md`) achou o
 * que já está escrito no disco e nunca foi lido. Varrido em 22/08: 9.938
 * medidas de duração, 147 recusas de permissão dele, 47 interrupções, 319
 * ferramentas que falharam, 490 travadas de hook. **Nada disso precisa de
 * instrumentação nova.** É a fonte mais barata que existe aqui, e por isso é a
 * primeira.
 *
 * ## A regra de leitura, herdada da aba de tempo
 *
 * `JSON.parse` NÃO roda em toda linha. São 173 MB, e a aba de tempo já pagou
 * essa conta: parse em tudo leva segundos e trava o laço de eventos. Aqui os
 * campos saem por busca de texto, que é o suficiente porque todos são
 * marcadores presentes ou ausentes, não estruturas.
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { casaClaude } from './platform.mjs'
import { hojeISO } from './armazem.mjs'

const rodar = promisify(execFile)

/**
 * As medidas do transcrito, com o nome que aparece na tela.
 *
 * O rótulo mora aqui junto da definição de propósito: medida cujo nome só
 * existe no código chega na tela como sigla, e sigla é exatamente o que ele
 * não tem por que decorar.
 */
export const MEDIDAS_TRANSCRITO = {
  'sessoes': { rotulo: 'sessões trabalhadas', ajuda: 'quantas conversas tiveram atividade naquele dia' },
  'tool.chamadas': { rotulo: 'ferramentas usadas', ajuda: 'total de comandos, edições e leituras disparados' },
  'tool.erro': { rotulo: 'ferramentas que falharam', ajuda: 'comando que voltou com erro, e teve que ser refeito' },
  /* Duas medidas separadas, e a separação não é preciosismo: elas dizem coisas
     opostas sobre quem está no comando.
     Medido em 22/08: das 148 recusas, 138 são regra automática e só 5 são ele
     recusando de fato. O rótulo antigo era "quantas vezes ele recusou uma
     ação", e estava errado em 93% dos casos. Somadas, as duas viram um número
     que descreve a máquina e leva a culpa para a pessoa. */
  'permissao.regra': { rotulo: 'barrado pela trava', ajuda: 'a regra automática de segurança impediu um comando, sem ninguém decidir nada' },
  'permissao.dele': { rotulo: 'recusado por você', ajuda: 'você viu o pedido e disse não: é o número que mede desacordo de verdade' },
  'interrupcao': { rotulo: 'interrupções dele', ajuda: 'ele cortou a resposta no meio: sinal de rumo errado' },
  'hook.travou': { rotulo: 'travadas de guarda', ajuda: 'uma regra do projeto barrou a entrega e mandou refazer' },
  'api.erro': { rotulo: 'falhas de conexão', ajuda: 'a resposta não chegou por problema de rede ou serviço' },
}

/**
 * O projeto ao qual um transcrito pertence.
 *
 * **Sai do `cwd` escrito dentro do arquivo, nunca do nome da pasta.** A primeira
 * versão deduzia do nome da pasta, e estava errada em silêncio: o Claude Code
 * troca barra E sublinhado por hífen ao montar o nome, então
 * `~/projetos/proj_controlcenter` vira `-home-claudedev-projetos-proj-controlcenter`,
 * e a troca é irreversível.
 *
 * O estrago aparecia só no cruzamento: o transcrito dizia `controlcenter` e o
 * git dizia `proj_controlcenter`. **Dos 12 projetos, 3 casavam.** Nenhum erro,
 * nenhum aviso, e um gráfico de esforço contra resultado que ficaria vazio para
 * quase todos sem ninguém entender por quê.
 */
function projetoDoArquivo(caminho, cwdLido) {
  if (cwdLido) return path.basename(cwdLido.replace(/[\\/]+$/, '')) || null
  /* Sem `cwd` no arquivo, é melhor não ter projeto do que ter um inventado:
     `null` some do cruzamento, e um nome errado polui a série de outro. */
  return null
}

/** Uma contagem por dia, para um transcrito só. */
async function lerTranscrito(caminho) {
  const porDia = new Map()
  const pega = (dia) => {
    if (!porDia.has(dia)) {
      porDia.set(dia, {
        'tool.chamadas': 0, 'tool.erro': 0, 'permissao.regra': 0, 'permissao.dele': 0,
        'interrupcao': 0, 'hook.travou': 0, 'api.erro': 0, duracoes: [],
      })
    }
    return porDia.get(dia)
  }

  const fluxo = readline.createInterface({
    input: fs.createReadStream(caminho, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let ultimoDia = null
  let cwd = null
  for await (const linha of fluxo) {
    if (!linha) continue
    if (!cwd) {
      const c = linha.match(/"cwd":"((?:[^"\\]|\\.)*)"/)
      if (c) { try { cwd = JSON.parse(`"${c[1]}"`) } catch { cwd = c[1] } }
    }
    /* O dia vem do carimbo de tempo. Linha sem carimbo herda o dia da anterior:
       são linhas de controle no meio da conversa, e jogá-las fora perderia
       contagem sem motivo. */
    const t = linha.indexOf('"timestamp":"')
    if (t !== -1) ultimoDia = linha.slice(t + 13, t + 23)
    if (!ultimoDia) continue
    const d = pega(ultimoDia)

    if (linha.includes('"type":"tool_use"')) {
      /* Uma linha de resposta pode disparar várias ferramentas de uma vez. */
      d['tool.chamadas'] += (linha.match(/"type":"tool_use"/g) || []).length
    }
    if (linha.includes('"is_error":true')) d['tool.erro'] += 1
    /* `user-rejected` é ele dizendo não; `permission-rule` e
       `automode-blocked` são a máquina. Contar junto misturaria desacordo com
       configuração de segurança. */
    if (linha.includes('"toolDenialKind":"user-rejected"')) d['permissao.dele'] += 1
    else if (linha.includes('toolDenialKind')) d['permissao.regra'] += 1
    if (linha.includes('interruptedMessageId')) d['interrupcao'] += 1
    /* A travada aparece em `hookErrors` com conteúdo, NÃO em
       `preventedContinuation`.
       A primeira versão contava `preventedContinuation:true`, e o campo é
       sempre falso: 498 ocorrências no disco, 498 falsas. A medida dava zero em
       todos os dias e o zero parecia um fato, quando a conta real é 125.
       Uma medida sempre zerada ou está certa ou está quebrada, e não dá para
       saber qual das duas sem ir ver. */
    if (linha.includes('"hookErrors":["')) d['hook.travou'] += 1
    if (linha.includes('"isApiErrorMessage":true')) d['api.erro'] += 1

    const m = linha.match(/"durationMs":(\d+)/)
    if (m) d.duracoes.push(Number(m[1]))
  }
  return { porDia, cwd }
}

/**
 * Varre os transcritos e devolve os registros prontos para gravar.
 *
 * `desde` corta por dia, e existe porque recolher o histórico inteiro faz
 * sentido uma vez só. O uso do dia a dia pede os últimos dias, e varrer 173 MB
 * para atualizar ontem seria desperdício.
 */
export async function coletarTranscritos({ desde = null, base = null } = {}) {
  const raiz = base || path.join(casaClaude(), 'projects')
  let pastas = []
  try { pastas = fs.readdirSync(raiz) } catch { return [] }

  /* Acumula por dia e projeto ANTES de virar registro: um projeto tem várias
     sessões no mesmo dia, e cada uma é um arquivo. */
  const acc = new Map()
  let lidos = 0

  for (const p of pastas) {
    const dir = path.join(raiz, p)
    let arquivos = []
    try {
      if (!fs.statSync(dir).isDirectory()) continue
      arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    } catch { continue }

    for (const f of arquivos) {
      const caminho = path.join(dir, f)
      let porDia, cwd
      try { ({ porDia, cwd } = await lerTranscrito(caminho)) } catch { continue }
      const projeto = projetoDoArquivo(caminho, cwd)
      lidos += 1

      for (const [dia, d] of porDia) {
        if (desde && dia < desde) continue
        const k = `${dia}|${projeto}`
        if (!acc.has(k)) acc.set(k, { dia, projeto, sessoes: 0, duracoes: [] })
        const a = acc.get(k)
        a.sessoes += 1
        for (const medida of Object.keys(MEDIDAS_TRANSCRITO)) {
          if (medida === 'sessoes') continue
          a[medida] = (a[medida] || 0) + (d[medida] || 0)
        }
        a.duracoes.push(...d.duracoes)
      }
    }
  }

  const registros = []
  for (const a of acc.values()) {
    for (const medida of Object.keys(MEDIDAS_TRANSCRITO)) {
      const valor = medida === 'sessoes' ? a.sessoes : (a[medida] || 0)
      registros.push({ dia: a.dia, projeto: a.projeto, medida, valor, de: 'transcrito' })
    }
    if (a.duracoes.length) {
      const ord = a.duracoes.slice().sort((x, y) => x - y)
      /* A mediana, não a média: uma varredura de 30 segundos entre trezentas
         chamadas de 40 milissegundos puxaria a média para longe do que o dia
         realmente foi. */
      registros.push({
        dia: a.dia, projeto: a.projeto, medida: 'tool.duracao.mediana',
        valor: ord[Math.floor(ord.length / 2)], de: 'transcrito',
      })
    }
  }
  return { registros, transcritos: lidos }
}

/**
 * CC-282: o que o git sabe e o cockpit não.
 *
 * O cockpit mede **esforço** (hora, token, dólar) e o git mede **resultado**
 * (commit, arquivo, linha). Separados, nenhum dos dois responde nada que
 * interesse. A chave que junta os dois é `projeto` mais `dia`, e ela sai de
 * graça dos dois lados.
 */
export const MEDIDAS_GIT = {
  'git.commits': { rotulo: 'commits', ajuda: 'quantas vezes o trabalho foi salvo em definitivo naquele dia' },
  'git.arquivos': { rotulo: 'arquivos mexidos', ajuda: 'quantos arquivos diferentes mudaram' },
  'git.linhas': { rotulo: 'linhas mexidas', ajuda: 'somando o que entrou e o que saiu' },
}

/**
 * O nome sob o qual um diretório de trabalho é contado.
 *
 * Worktree do git aponta para o mesmo repositório com pasta e branch próprias.
 * Contando pela pasta, `proj_controlcenter--front` apareceu como um décimo
 * nono projeto com 146 commits, **e são os mesmos commits do principal**, que
 * já tinha 213. Somar os dois inventaria trabalho que não houve.
 *
 * `--git-common-dir` devolve o `.git` compartilhado, e o pai dele é o repo de
 * verdade.
 */
async function repoDe(dir) {
  try {
    const r = await rodar('git', ['rev-parse', '--git-common-dir'], { cwd: dir, encoding: 'utf8', timeout: 15_000 })
    const comum = path.resolve(dir, (r.stdout || '').trim())
    return path.basename(path.dirname(comum)) || path.basename(dir)
  } catch { return path.basename(dir) }
}

export async function coletarGit(dirs = [], { desde = null } = {}) {
  /* Acumula por repo, não por pasta, e guarda o hash de cada commit: duas
     worktrees do mesmo projeto veem a mesma história, e sem o hash o mesmo
     commit entraria duas vezes na contagem do dia. */
  const porRepo = new Map()

  for (const dir of dirs) {
    if (!fs.existsSync(path.join(dir, '.git'))) continue
    const projeto = await repoDe(dir)
    const args = ['log', '--date=short', '--pretty=format:@%H %ad', '--numstat']
    if (desde) args.push(`--since=${desde}`)

    let saida = ''
    try {
      /* `maxBuffer` alto: o inovallbond sozinho tem 444 commits em 30 dias, e o
         padrão de 1 MB corta a saída no meio sem avisar. */
      const r = await rodar('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60_000 })
      saida = r.stdout || ''
    } catch { continue }

    if (!porRepo.has(projeto)) porRepo.set(projeto, { vistos: new Set(), porDia: new Map() })
    const repo = porRepo.get(projeto)

    let dia = null
    let contando = false
    for (const linha of saida.split(/\r?\n/)) {
      if (linha.startsWith('@')) {
        const m = linha.match(/^@([0-9a-f]+) (\d{4}-\d{2}-\d{2})$/)
        if (!m) { contando = false; continue }
        const [, hash, d] = m
        /* Commit já visto por outra worktree do mesmo repo: pula ele e as
           linhas de arquivo que vêm logo abaixo. */
        contando = !repo.vistos.has(hash)
        if (!contando) continue
        repo.vistos.add(hash)
        dia = d
        if (!repo.porDia.has(dia)) repo.porDia.set(dia, { commits: 0, arquivos: new Set(), linhas: 0 })
        repo.porDia.get(dia).commits += 1
        continue
      }
      if (!contando || !dia || !linha.trim()) continue
      const m = linha.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
      if (!m) continue
      const d = repo.porDia.get(dia)
      d.arquivos.add(m[3])
      /* `-` é arquivo binário: o git não conta linha nele, e somar zero é
         verdade, enquanto somar o tamanho seria invenção. */
      d.linhas += (m[1] === '-' ? 0 : Number(m[1])) + (m[2] === '-' ? 0 : Number(m[2]))
    }
  }

  const registros = []
  for (const [projeto, repo] of porRepo) {
    for (const [d, v] of repo.porDia) {
      registros.push({ dia: d, projeto, medida: 'git.commits', valor: v.commits, de: 'git' })
      registros.push({ dia: d, projeto, medida: 'git.arquivos', valor: v.arquivos.size, de: 'git' })
      registros.push({ dia: d, projeto, medida: 'git.linhas', valor: v.linhas, de: 'git' })
    }
  }
  return { registros }
}

/** Todas as medidas conhecidas, com rótulo, para a tela e para o comando. */
export const CATALOGO = { ...MEDIDAS_TRANSCRITO, ...MEDIDAS_GIT,
  'tool.duracao.mediana': {
    rotulo: 'duração típica (ms)',
    ajuda: 'quanto demora a ferramenta do meio, em milissegundos',
    /* CC-288: a ÚNICA que não soma. Ela já é um resumo do dia (uma mediana), e
       somar sete medianas para virar "a semana" daria um número que não existe
       em lugar nenhum, exibido enorme e sem nada denunciando. */
    agregacao: 'media',
  },
}

/** Como a medida vira semana, mês ou ano. Somar é o padrão porque quase tudo
 *  aqui conta coisas; o que já é resumo declara `media`. */
export const agregacaoDe = (m) => CATALOGO[m]?.agregacao || 'soma'

export const rotuloDaMedida = (m) => CATALOGO[m]?.rotulo || m
export { hojeISO }
