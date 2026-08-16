/**
 * As oficinas: uma pasta de trabalho por agente, derivada do git.
 *
 * ## A pergunta dele, em 16/08
 *
 * Ao escolher worktree por agente, ele emendou o que importa:
 *
 * > "podemos criar formas de armazenar esses dados, esses node_modules
 * > duplicados, lembrar em qual pasta está cada agente, isso tudo pode ser
 * > armazenado como dado? Pq daí a gente cria um sistema pra automatizar isso
 * > perfeitamente e mecanicamente, sem depender apenas de IA."
 *
 * **A resposta é melhor que armazenar: é derivar.** Guardar num JSON "o agente X
 * está na pasta Y na branch Z" cria uma segunda verdade, que envelhece calada no
 * primeiro `git worktree remove` feito à mão. O git já sabe tudo isso, e sempre
 * certo. Este módulo é uma leitura, não um registro — pelo mesmo motivo que o
 * peso, a sprint e a presença do painel são calculados e nunca digitados.
 *
 * Nada aqui grava estado próprio. O que existe:
 *
 * | pergunta | de onde a resposta vem |
 * |---|---|
 * | quais pastas existem, em que branch | `git worktree list --porcelain` |
 * | quem está trabalhando em cada uma | `ROTAS-ATIVAS.md` da pasta + `presenca.mjs` |
 * | tem trabalho não commitado? | `git status --porcelain` na pasta |
 * | está atrás da principal? | `git rev-list --count` |
 *
 * ## Por que "oficina" e não "worktree"
 *
 * O vocabulário da tela é o dele, e ele nunca usou "worktree". Oficina é o que a
 * coisa é: uma bancada separada onde um agente trabalha sem esbarrar no outro.
 * `worktree` continua no comentário e no comando, que é onde o termo técnico
 * precisa estar.
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/** Roda git na pasta e devolve texto, ou null se não der. Nunca lança. */
async function git(cwd, args, timeout = 15_000) {
  try {
    const { stdout } = await exec('git', args, { cwd, timeout, maxBuffer: 4e6 })
    return stdout
  } catch { return null }
}

/**
 * As oficinas deste repositório.
 *
 * `--porcelain` em vez da saída bonita: o formato humano alinha por espaço e
 * quebra com caminho que tem espaço no nome, que é comum no Windows dele.
 */
export async function listar(raiz) {
  const bruto = await git(raiz, ['worktree', 'list', '--porcelain'])
  if (!bruto) return []

  const oficinas = []
  let atual = null
  for (const linha of bruto.split(/\r?\n/)) {
    if (linha.startsWith('worktree ')) {
      atual = { pasta: linha.slice(9), branch: null, solta: false, principal: false }
      oficinas.push(atual)
    } else if (linha.startsWith('branch ') && atual) {
      atual.branch = linha.slice(7).replace('refs/heads/', '')
    } else if (linha === 'detached' && atual) {
      // sem branch: commit avulso. Vale avisar, porque commitar aqui some do mapa
      atual.solta = true
    }
  }
  if (oficinas[0]) oficinas[0].principal = true
  return oficinas
}

/**
 * O retrato de uma oficina: o que decide se dá para mexer nela agora.
 *
 * Roda quatro comandos git na pasta, todos baratos. Não entra em `setInterval`
 * mesmo assim: é leitura sob clique, como a aba da VPS — quatro comandos vezes
 * cinco oficinas a cada dois segundos seria desperdício puro.
 */
export async function retrato(oficina, principal = null) {
  const { pasta } = oficina
  const [status, ahead, atras, ultimo] = await Promise.all([
    git(pasta, ['status', '--porcelain']),
    principal && oficina.branch ? git(pasta, ['rev-list', '--count', `${principal}..HEAD`]) : null,
    principal && oficina.branch ? git(pasta, ['rev-list', '--count', `HEAD..${principal}`]) : null,
    git(pasta, ['log', '-1', '--format=%h|%cr|%s']),
  ])

  const linhas = (status || '').split(/\r?\n/).filter(Boolean)
  const [hash, quando, assunto] = (ultimo || '').trim().split('|')

  return {
    ...oficina,
    existe: fs.existsSync(pasta),
    sujos: linhas.filter((l) => !l.startsWith('??')).length,
    novos: linhas.filter((l) => l.startsWith('??')).length,
    aFrente: ahead == null ? null : Number(ahead.trim()),
    atras: atras == null ? null : Number(atras.trim()),
    ultimo: hash ? { hash, quando, assunto } : null,
    rotas: rotasDaPasta(pasta),
    // node_modules é o custo que ele levantou; dizer o tamanho é o que permite
    // decidir entre duplicar e compartilhar, em vez de adivinhar
    node: pesoDoNode(pasta),
  }
}

/** Quem está com rota marcada no quadro daquela pasta. */
function rotasDaPasta(pasta) {
  let texto = ''
  try { texto = fs.readFileSync(path.join(pasta, 'docs', 'ROTAS-ATIVAS.md'), 'utf8') } catch { return [] }
  return texto.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)
    .filter((l) => l.trim().startsWith('|') && l.includes('🔴'))
    .map((l) => ({
      rota: (l.match(/`([^`]+)`/) || [])[1] || '?',
      quem: (l.match(/\b([0-9a-f]{8})\b/) || [])[1] || null,
      arquivos: arquivosDeclarados(l),
    }))
}

/** Os caminhos que a linha reivindica com 📁 — mesmo formato do `rota-guard`. */
export function arquivosDeclarados(linha) {
  const i = linha.indexOf('📁')
  if (i < 0) return []
  return linha.slice(i + 2).split('|')[0].split(/[\s,]+/)
    .map((s) => s.trim().replace(/^`|`$/g, ''))
    .filter((s) => s && /[/.]/.test(s))
}

/**
 * Tamanho do `node_modules`, e se ele é cópia ou atalho.
 *
 * Só o topo da pasta: somar recursivamente uma árvore de 40 mil arquivos levaria
 * segundos e a resposta que interessa é grosseira — "duplicou 300 MB" ou "é um
 * atalho". `lstat` em vez de `stat` de propósito: `stat` segue o link e diria
 * que o atalho é uma pasta cheia.
 */
function pesoDoNode(pasta) {
  const alvo = path.join(pasta, 'node_modules')
  let st = null
  try { st = fs.lstatSync(alvo) } catch { return { existe: false } }
  if (st.isSymbolicLink()) {
    let destino = null
    try { destino = fs.readlinkSync(alvo) } catch { /* link quebrado */ }
    return { existe: true, atalho: true, destino }
  }
  let pacotes = 0
  try { pacotes = fs.readdirSync(alvo).length } catch { /* sem permissão */ }
  return { existe: true, atalho: false, pacotes }
}

/**
 * Duas oficinas mexendo no mesmo arquivo: o conflito de merge antes de existir.
 *
 * É a lacuna que a worktree NÃO resolve e que ele apontou sozinho ao perguntar
 * se branch bastava. Isolar o disco impede que um quebre o outro hoje; não
 * impede que os dois editem `src/ui.html` e o merge conflite amanhã. O cruzamento
 * é por arquivo declarado no quadro de cada pasta.
 */
export function colisoes(retratos) {
  const dono = new Map()
  const achados = []
  for (const of of retratos) {
    for (const r of of.rotas || []) {
      for (const arquivo of r.arquivos) {
        const antes = dono.get(arquivo)
        if (antes && antes.pasta !== of.pasta) {
          achados.push({ arquivo, entre: [antes, { pasta: of.pasta, rota: r.rota, quem: r.quem }] })
        } else if (!antes) {
          dono.set(arquivo, { pasta: of.pasta, rota: r.rota, quem: r.quem })
        }
      }
    }
  }
  return achados
}

/** O mapa inteiro, que é o que a tela e o CLI consomem. */
export async function mapa(raiz) {
  const oficinas = await listar(raiz)
  if (!oficinas.length) return { ok: false, erro: 'esta pasta não é um repositório git' }
  const principal = oficinas[0]?.branch || null
  const retratos = await Promise.all(oficinas.map((o) => retrato(o, principal)))
  return { ok: true, principal, oficinas: retratos, colisoes: colisoes(retratos) }
}

/**
 * Cria a oficina: pasta, branch, e o `node_modules` como ATALHO.
 *
 * O atalho é a resposta ao custo que ele levantou. `npm install` numa worktree
 * nova baixaria tudo de novo — em projeto grande, centenas de MB e minutos por
 * agente. Um link simbólico para o `node_modules` da pasta principal custa zero
 * e resolve o caso comum, que é as duas oficinas terem as mesmas dependências.
 *
 * ⚠️ **O atalho tem um limite honesto:** se uma oficina trocar de dependência,
 * as duas trocam junto, porque é a mesma pasta. Quando isso for o trabalho, o
 * certo é `npm install` de verdade ali — daí o `--sem-atalho`.
 */
export async function criar(raiz, nome, { branch = null, semAtalho = false } = {}) {
  if (!/^[a-z0-9][a-z0-9._-]{0,40}$/i.test(String(nome || ''))) {
    return { ok: false, erro: 'nome de oficina: letras, números, ponto, hífen e sublinhado' }
  }
  const pasta = path.resolve(raiz, '..', `${path.basename(raiz)}--${nome}`)
  if (fs.existsSync(pasta)) return { ok: false, erro: `já existe: ${pasta}` }

  const ramo = branch || nome
  const saida = await git(raiz, ['worktree', 'add', pasta, '-b', ramo], 60_000)
  if (saida === null) {
    // branch já existe: aproveita em vez de falhar, que é o caso de retomar
    const r2 = await git(raiz, ['worktree', 'add', pasta, ramo], 60_000)
    if (r2 === null) return { ok: false, erro: `não deu para criar a oficina em ${pasta}` }
  }

  let node = null
  const origem = path.join(raiz, 'node_modules')
  if (!semAtalho && fs.existsSync(origem)) {
    try {
      fs.symlinkSync(origem, path.join(pasta, 'node_modules'), 'junction')
      node = 'atalho para o node_modules da pasta principal'
    } catch (e) { node = `sem atalho (${String(e.code || e.message)}): rode npm install ali` }
  }

  return { ok: true, pasta, branch: ramo, node }
}

/**
 * Fecha a oficina, e RECUSA quando há trabalho dentro.
 *
 * Sem esta trava o comando seria uma forma silenciosa de apagar horas de
 * alguém: `git worktree remove` some com a pasta, e o que não estava commitado
 * não está em lugar nenhum. Ação destrutiva pede confirmação, e aqui a
 * confirmação é ver o número antes.
 */
export async function fechar(raiz, nome, { forcar = false } = {}) {
  const oficinas = await listar(raiz)
  const alvo = oficinas.find((o) => path.basename(o.pasta).endsWith(`--${nome}`) || o.branch === nome)
  if (!alvo) return { ok: false, erro: `não achei a oficina "${nome}"` }
  if (alvo.principal) return { ok: false, erro: 'a oficina principal não se fecha' }

  const r = await retrato(alvo)
  if ((r.sujos || r.novos) && !forcar) {
    return {
      ok: false,
      erro: `a oficina tem ${r.sujos} arquivo(s) modificado(s) e ${r.novos} novo(s) sem commit. `
        + 'Commite lá dentro, ou repita com --forcar se for mesmo para jogar fora.',
    }
  }
  const saida = await git(raiz, ['worktree', 'remove', ...(forcar ? ['--force'] : []), alvo.pasta], 60_000)
  if (saida === null) return { ok: false, erro: 'o git recusou remover a oficina' }
  return { ok: true, pasta: alvo.pasta, branch: alvo.branch }
}
