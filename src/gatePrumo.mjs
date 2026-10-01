/**
 * CC-803: o "prumo", o gancho que segura o modelo no projeto.
 *
 * Pedido dele em 30/09, na simulação 3 (um jogo feito só pelo Coderoom): "tudo
 * que você ver que ele tá demorando ou simplesmente não responde, você cria um
 * hook pra segurar o modelo no projeto".
 *
 * Medido na simulação, antes de escrever uma regra:
 *   - o opencode passou os 4 primeiros minutos do pedido do jogo SEM criar
 *     nada: lendo a lista de projetos de teste (`~/.config/testedevoo`) e
 *     olhando portas com `ss`, coisa que o pedido não mandava fazer;
 *   - no pedido dos 48 px ele declarou 6 passos e parou no 1º;
 *   - o opencode recusa pasta fora do projeto só para as ferramentas de arquivo,
 *     não para `cat /home/...` dentro do `bash`.
 *
 * Aqui só mora a decisão (pura, testável). Quem liga isto ao opencode é
 * `hooks/opencode-prumo.mjs`, um plugin com o gancho `tool.execute.before`:
 * lançar erro ali devolve o texto ao modelo como erro da ferramenta, e medido em
 * 30/09 ele lê e obedece, no meio da resposta e sem matar o processo.
 *
 * Três regras, todas com o texto que o modelo recebe:
 *   rodeio     muitas leituras seguidas sem escrever nada
 *   repeticao  o mesmo comando de novo e de novo
 *   fora       `bash` mexendo em pasta da casa que não é do projeto
 */
import path from 'node:path'

export const LIMITE_LEITURAS = 10
export const LIMITE_REPETICAO = 3

const ESCRITA = new Set(['write', 'edit', 'patch', 'multiedit'])
// ferramentas que não são nem investigação nem ação: não contam para nada
const NEUTRAS = new Set(['todowrite', 'todoread', 'task', 'question', 'skill'])
/* `bash` que MUDA alguma coisa (cria, instala, roda, sobe): conta como ação.
   O resto (ls, cat, grep, ss, ps, curl, head...) é investigar. */
const MUDA = /(^|[;&|(]\s*|\s)(mkdir|touch|cp|mv|rm|npm|npx|pnpm|yarn|bun|node|vite|python3?|pip3?|git\s+(add|commit|init|checkout|merge|restore)|tee|chmod|ln)\b|>>?\s*[^\s&]|sed\s+-i|\bdev\.sh\b/

export const novoEstado = () => ({ leituras: 0, recentes: [] })

const dentro = (p, base) => p === base || p.startsWith(base + path.sep)

/** O primeiro caminho da casa que o comando cita e que não é do projeto, ou null. */
export function foraDoProjeto(cmd, { cwd, home, liberadas = [] }) {
  const toks = String(cmd || '').match(/(?:~|\$HOME|\/home\/[A-Za-z0-9_.-]+)(?:\/[^\s'"`;|&)<>]*)?/g) || []
  /* Liberar a casa inteira (`/home/x/*`) desligaria a regra toda: fica de fora. */
  const livres = [path.join(home, 'dev.sh'), path.join(home, 'logs'), path.join(home, '.npm'), path.join(home, '.cache'), ...liberadas.filter((l) => l && path.resolve(l) !== home)]
  for (const t of toks) {
    const p = path.resolve(t.replace(/^\$HOME/, home).replace(/^~/, home))
    if (p === home || dentro(p, cwd) || livres.some((l) => dentro(p, path.resolve(l)))) continue
    return p
  }
  return null
}

/**
 * Decide uma chamada de ferramenta. Devolve `{ bloquear, regra, motivo }`.
 * `est` é o estado da sessão (muda aqui). Nunca lança: o gancho falha aberto.
 */
export function avaliar(est, tool, args, ctx) {
  const livre = { bloquear: false }
  try {
    if (NEUTRAS.has(tool) || String(tool).startsWith('painel_') || String(tool).includes('perguntar')) return livre
    const cmd = tool === 'bash' ? String(args?.command || '').trim() : ''

    if (tool === 'bash') {
      const fora = foraDoProjeto(cmd, ctx)
      if (fora) {
        return { bloquear: true, regra: 'fora', motivo: `Isto está fora do projeto (${fora}). Fique em ${ctx.cwd}: é o seu mundo neste pedido. Para mostrar o projeto no endereço de teste use só ~/dev.sh <nome>, e o log fica em ~/logs/<nome>.log. Se precisa mesmo de outra pasta, diga ao Felipe o que quer e por quê, e espere a resposta.` }
      }
    }

    const chave = tool + ' ' + (cmd || JSON.stringify(args || {}))
    est.recentes.push(chave); if (est.recentes.length > 6) est.recentes.shift()
    const ult = est.recentes.slice(-LIMITE_REPETICAO)
    if (ult.length === LIMITE_REPETICAO && ult.every((c) => c === chave)) {
      est.recentes = []
      return { bloquear: true, regra: 'repeticao', motivo: `Você repetiu o mesmo comando ${LIMITE_REPETICAO} vezes e o resultado não vai mudar. Mude de abordagem: leia o erro com atenção, escreva a correção, ou diga ao Felipe o que está travando.` }
    }

    const acao = ESCRITA.has(tool) || (tool === 'bash' && MUDA.test(cmd))
    if (acao) { est.leituras = 0; return livre }
    est.leituras++
    if (est.leituras >= LIMITE_LEITURAS) {
      const n = est.leituras
      est.leituras = Math.floor(LIMITE_LEITURAS / 2) // se continuar, avisa de novo daqui a 5
      return { bloquear: true, regra: 'rodeio', motivo: `Você já fez ${n} leituras seguidas sem escrever nada. Pare de investigar: escolha o próximo passo concreto do pedido e escreva o código agora. Se falta uma informação que só o Felipe tem, pergunte pela ferramenta de perguntar em vez de procurar.` }
    }
    return livre
  } catch {
    return livre
  }
}
