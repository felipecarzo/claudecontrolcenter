/**
 * CC-232: o mesmo protocolo de tarefas do Claude Code, agora no opencode/agy.
 *
 * ## Por que este arquivo existe
 *
 * A decisão dele em 21/08 foi "cada ferramenta avisa": o Claude Code usa o
 * gancho que já tem, e o opencode ganha o encaixe equivalente. O motivo é o
 * problema que ele mesmo nomeou — *"precisamos atrelar isso ao sistema e não só
 * ao Claude, pq usamos o OPENCODE e o agy aqui tb"*. Um protocolo que só vale
 * numa das três ferramentas nasce valendo para um terço do trabalho.
 *
 * ## O que dá e o que não dá, medido na interface do opencode 1.18
 *
 * | queria | tem | usa |
 * |---|---|---|
 * | injetar contexto ao abrir | `experimental.chat.system.transform` | sim |
 * | saber que a sessão parou | evento `session.idle` | sim, só para lembrar |
 * | RECUSAR a entrega | não existe equivalente ao `Stop` que devolve | não |
 *
 * A consequência honesta: no Claude Code o fim de sessão **devolve** quando uma
 * pendência dele fica fora da lista; aqui só dá para lembrar. É diferença real
 * de ferramenta, não descuido — e a lição registrada neste projeto é que aviso
 * escrito não segura comportamento. O que segura, aqui, é a lista ser a mesma:
 * o que o opencode registrar aparece no mesmo painel.
 *
 * ## Onde instalar
 *
 * `~/.config/opencode/plugin/tarefas.js`, por atalho para este arquivo, para o
 * conserto viajar no `git pull` em vez de virar cópia esquecida. É a mesma
 * armadilha das rotinas copiadas dentro dos projetos: a cópia vence a global e
 * envelhece calada.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const rodar = promisify(execFile)

/**
 * Onde procurar o comando do painel, e por que a ordem importa.
 *
 * **Em Linux, `cc` NUNCA entra na lista**: `/usr/bin/cc` é o compilador C do
 * sistema, e é por isso que a VPS instala o painel como `cockpit`. Chamar
 * `cc meu list` aqui invocaria o compilador — que falharia, seria engolido pelo
 * `catch`, e deixaria a lista vazia sem nenhum sinal de que a pergunta foi
 * feita ao programa errado.
 *
 * E não basta o nome: binário instalado por npm global não está no PATH de
 * serviço, armadilha que já fez um botão do painel responder "ok" sem subir
 * nada. Por isso os caminhos conhecidos entram junto.
 */
function candidatos() {
  const nomes = platform() === 'linux' ? ['cockpit'] : ['cc', 'cockpit']
  const caminhos = []
  for (const n of nomes) {
    caminhos.push(n) // pelo PATH, quando ele tem
    for (const dir of [join(homedir(), '.npm-global', 'bin'), join(homedir(), '.local', 'bin'), '/usr/local/bin']) {
      const p = join(dir, n)
      if (existsSync(p)) caminhos.push(p)
    }
  }
  return caminhos
}

async function lista() {
  for (const bin of candidatos()) {
    try {
      const { stdout } = await rodar(bin, ['meu', 'list', '--json'], { timeout: 8000 })
      const tarefas = JSON.parse(stdout)
      if (Array.isArray(tarefas)) return tarefas
    } catch { /* próximo candidato */ }
  }
  return null
}

export const TarefasDoFelipe = async () => ({
  /**
   * O equivalente do início de sessão: o que depende dele entra no contexto.
   *
   * `system` é um array de blocos, e o certo é ACRESCENTAR. Substituir apagaria
   * a instrução do próprio opencode, e o agente perderia o que sabe fazer.
   */
  'experimental.chat.system.transform': async (_input, output) => {
    const tarefas = await lista()
    /* `null` é "não consegui perguntar", `[]` é "não há nada". Sem essa
       distinção, um comando ausente viraria a afirmação "ele não tem
       pendência", que é o tipo de mentira calada que este projeto persegue. */
    if (!tarefas || !tarefas.length) return

    const linhas = [
      `${tarefas.length} coisa(s) dependem do Felipe, não de você. Não são suas tarefas:`,
    ]
    for (const t of tarefas.slice(0, 8)) {
      const onde = [t.projeto, t.frente].filter(Boolean).join(' › ')
      linhas.push(`  - ${t.texto}${onde ? `  [${onde}]` : ''}`)
    }
    if (tarefas.length > 8) linhas.push(`  ... e mais ${tarefas.length - 8}.`)
    linhas.push(
      '',
      'Mencione as que interessam ao trabalho de hoje e siga. Não execute por',
      'ele e não marque como feita: só ele fecha tarefa dele.',
      '',
      'E o contrário vale sempre: ao descobrir algo que depende DELE (uma senha,',
      'uma decisão, um acesso que você não tem), registre na hora com',
      '`cockpit meu add "..." --porque "..."` (ou `cc meu add`). Deixar isso só',
      'na conversa é como perder: em 20/08 quatro pendências ficaram fora da',
      'lista e ele não as viu no painel no dia seguinte.',
    )
    output.system.push(linhas.join('\n'))
  },

  /**
   * O fim de sessão, na medida do que a ferramenta permite.
   *
   * `session.idle` é o mais próximo do `Stop` do Claude Code, mas ele NÃO pode
   * recusar nem devolver texto ao modelo. Então aqui não há cobrança: só a
   * garantia de que a lista continua legível de fora, que é o que faz o painel
   * mostrar a mesma verdade para as três ferramentas.
   */
  event: async ({ event }) => {
    if (event?.type !== 'session.idle') return
    /* De propósito sem efeito colateral. Marcar tarefa, criar item ou "limpar"
       a lista a partir de um evento automático é como a lista passa a mentir —
       e ela é o único lugar onde o trabalho dele mora. */
  },
})

export default TarefasDoFelipe
