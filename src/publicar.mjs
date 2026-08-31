/**
 * CC-439 — a cópia que RODA, separada da cópia que se edita.
 *
 * ## O problema, com as palavras dele
 *
 * 30/08: *"a gente atualiza ele todo dia, não chega num produto final (…) quero
 * que isso pare de ser um produto que eu vou criar todo dia pra eu passar a
 * criar nele uma vez por semana só, focar em trabalhar nos meus projetos, porque
 * eu estou perdendo muito tempo nele."*
 *
 * A causa não é falta de instalador: o cockpit já sobe no logon, já tem ícone na
 * barra e já se religa sozinho. A causa é que **o comando instalado é um atalho
 * para a pasta onde se edita**. Está escrito nas armadilhas do `CLAUDE.md` desde
 * 2026-08-08: `AppData/Roaming/npm/node_modules/claude-control-center` é um link
 * simbólico para o repositório, e a consequência é a alínea (c) de lá, "código
 * quebrado no repo quebra o `cc` de todos os agentes na hora".
 *
 * Uma linha errada salva às 15h derruba o painel dele às 15h, e não existe "a
 * versão que funcionava" para voltar. É isso que este módulo resolve.
 *
 * ## O desenho, e por que não é git
 *
 * A cópia instalada é uma cópia de ARQUIVOS, sem `.git`, sem `node_modules`,
 * sem `docs/` e sem teste. Três motivos, e o terceiro é o que decide:
 *
 * 1. Ela precisa sobreviver a um repositório em qualquer estado, inclusive no
 *    meio de um rebase ou com conflito aberto.
 * 2. `git worktree` compartilha o `.git`, então o que quebra a pasta de obras
 *    alcança a instalada.
 * 3. **Voltar tem que funcionar sem saber git.** É ele quem vai voltar, num
 *    momento em que o painel está fora do ar, e a promessa é "um clique".
 *
 * Cada publicação guarda a anterior inteira em `anterior/`, e é só isso que
 * `voltar()` faz: troca as duas de lugar. Uma geração só, de propósito — o que
 * ele precisa é desfazer a última mudança, não navegar um histórico, e o
 * histórico de verdade está no git.
 *
 * ## O carimbo
 *
 * `versao.json` na pasta instalada guarda a versão do `package.json`, o commit,
 * a data e se o gate passou. Sem ele, "a mesma versão nos dois lados" continuaria
 * sem como ser conferida — que é o CC-434, o item que abriu esta frente.
 *
 * ## Quando o NÚMERO sobe, e por que ele estava parado
 *
 * CC-434, medido em 30/08: as três cópias do produto diziam `0.2.0` e eram
 * código diferente, com 46 commits de distância entre a mais nova e a mais
 * velha. **O número nunca tinha sido movido**, então ele não separava nada, e
 * era justamente a peça que "a mesma versão nos dois lados" precisa ter.
 *
 * A regra, e ela é curta de propósito para ser seguida:
 *
 * - **o terceiro número** (`0.2.x`) sobe quando o que muda é conserto: nada do
 *   que já funcionava passa a funcionar diferente;
 * - **o do meio** (`0.x.0`) sobe quando entra recurso, ou quando algo que ele
 *   usava passa a se comportar de outro jeito. Foi o caso de 30/08: a versão
 *   que roda separada da que se edita, o programa em janela própria, e o
 *   pacote levando o roadmap inteiro;
 * - **o primeiro** fica em zero enquanto isto for ferramenta dele, e não
 *   produto para outra pessoa instalar.
 *
 * O que o número NÃO precisa fazer: distinguir dois commits do mesmo dia. Para
 * isso já existe o commit no carimbo, que é exato. Subir o número a cada
 * publicação o transformaria num contador, e contador ninguém lê.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ehWindows, ehMac } from './platform.mjs'

const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** O que é o PRODUTO. Sai da lista `files` do `package.json`, que já existe para
 *  o pacote npm: duas listas do que é produto divergiriam na primeira pasta
 *  nova. `hooks/` entra porque o `settings.json` aponta para ele. */
export const DO_PRODUTO = ['cc.mjs', 'src', 'hooks', 'package.json', 'AGENTS.md', 'README.md', 'LICENSE']

/** Nunca copiado, mesmo dentro das pastas acima. */
const FORA = new Set(['node_modules', '.git', 'anterior', 'versao.json'])

/**
 * Onde a cópia que roda mora, por sistema.
 *
 * Fora do repositório de propósito: dentro dele, um `git checkout` ou um
 * `reset --hard` alcançaria a versão instalada, que é exatamente o que este
 * módulo existe para impedir.
 *
 * `CC_INSTALADO` redireciona, e é o que o teste usa: sem isso, o gate publicaria
 * na instalação de verdade dele — o mesmo erro que o bloco de notas cometeu e
 * que é candidato à causa do apagamento de 2026-08-09.
 */
export function pastaInstalada() {
  if (process.env.CC_INSTALADO) return process.env.CC_INSTALADO
  if (ehWindows) {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return path.join(base, 'AgentCockpit')
  }
  if (ehMac) return path.join(os.homedir(), 'Library', 'Application Support', 'AgentCockpit')
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'agent-cockpit')
}

/** O carimbo da cópia instalada, ou `null` quando não há nenhuma. `null` e
 *  "instalada mas sem carimbo" são casos diferentes: o segundo devolve objeto
 *  com `versao: null`, para a tela poder dizer que existe e não sabe qual é. */
export function versaoInstalada(dir = pastaInstalada()) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'versao.json'), 'utf8'))
  } catch {
    return fs.existsSync(path.join(dir, 'cc.mjs')) ? { versao: null, em: null, commit: null } : null
  }
}

/** `stdio` com `stderr: 'ignore'`: pasta sem git é caso NORMAL aqui (a instalada
 *  não tem `.git` de propósito), e deixar o "fatal: not a git repository" vazar
 *  no terminal faria parecer erro o que é o funcionamento certo. */
const commitDe = (repo) => {
  try {
    return execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8', windowsHide: true, timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch { return null }
}

/** Cópia recursiva pulando o que não é produto. `fs.cpSync` existe desde o Node
 *  16 e resolve link simbólico por padrão, que é o certo aqui: o pacote global
 *  do npm é um link, e copiar o link em vez do conteúdo daria uma instalação que
 *  aponta de volta para a pasta de obras. */
function copiar(de, para) {
  fs.mkdirSync(para, { recursive: true })
  for (const nome of fs.readdirSync(de)) {
    if (FORA.has(nome)) continue
    const origem = path.join(de, nome)
    const destino = path.join(para, nome)
    const st = fs.statSync(origem)
    if (st.isDirectory()) copiar(origem, destino)
    else fs.copyFileSync(origem, destino)
  }
}

/**
 * Publica a pasta de obras como a versão que roda.
 *
 * `gate` roda `npm test` antes e RECUSA se falhar. É o ponto inteiro: publicar
 * sem conferir seria o mesmo que ter uma cópia só. Quem quiser publicar mesmo
 * assim passa `gate: false` e assume, e a recusa diz isso.
 */
export function publicar({ repo = RAIZ_REPO, destino = pastaInstalada(), gate = true, agora = new Date() } = {}) {
  if (!fs.existsSync(path.join(repo, 'cc.mjs'))) {
    return { ok: false, erro: `isto não parece o cockpit: ${repo}` }
  }

  if (gate) {
    try {
      execFileSync(process.execPath, [path.join(repo, 'test.mjs')], {
        cwd: repo, encoding: 'utf8', windowsHide: true, timeout: 10 * 60 * 1000, stdio: 'pipe',
      })
    } catch (e) {
      return { ok: false, erro: 'o gate não passou, e publicar assim poria o defeito no ar', detalhe: String(e.stderr || e.message || '').slice(-800) }
    }
  }

  /* A anterior é guardada ANTES de qualquer escrita na pasta nova. Falhar no
     meio da cópia com a anterior já apagada deixaria ele sem nenhuma das duas,
     que é o pior estado possível deste módulo. */
  const anterior = path.join(destino, 'anterior')
  const temAtual = fs.existsSync(path.join(destino, 'cc.mjs'))
  if (temAtual) {
    const guardando = `${anterior}.novo`
    fs.rmSync(guardando, { recursive: true, force: true })
    fs.mkdirSync(guardando, { recursive: true })
    for (const nome of fs.readdirSync(destino)) {
      if (nome === 'anterior' || nome === 'anterior.novo') continue
      fs.cpSync(path.join(destino, nome), path.join(guardando, nome), { recursive: true })
    }
    fs.rmSync(anterior, { recursive: true, force: true })
    fs.renameSync(guardando, anterior)
  }

  for (const nome of DO_PRODUTO) {
    const origem = path.join(repo, nome)
    if (!fs.existsSync(origem)) continue
    const alvo = path.join(destino, nome)
    fs.rmSync(alvo, { recursive: true, force: true })
    if (fs.statSync(origem).isDirectory()) copiar(origem, alvo)
    else { fs.mkdirSync(destino, { recursive: true }); fs.copyFileSync(origem, alvo) }
  }

  let versao = null
  try { versao = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version || null } catch { /* sem package */ }
  const carimbo = {
    versao,
    commit: commitDe(repo),
    em: agora.toISOString(),
    gate: Boolean(gate),
    de: repo,
    temAnterior: temAtual,
  }
  fs.writeFileSync(path.join(destino, 'versao.json'), `${JSON.stringify(carimbo, null, 2)}\n`, 'utf8')
  return { ok: true, destino, ...carimbo }
}

/**
 * Volta para a versão anterior. É o "um clique" da promessa.
 *
 * Troca as duas de lugar em vez de descartar a atual: se ele voltar por engano,
 * ou se a anterior também estiver quebrada, o caminho de ida continua existindo.
 * Sem isso, voltar seria tão irreversível quanto publicar.
 */
export function voltar({ destino = pastaInstalada() } = {}) {
  const anterior = path.join(destino, 'anterior')
  if (!fs.existsSync(path.join(anterior, 'cc.mjs'))) {
    return { ok: false, erro: 'não há versão anterior guardada: esta é a primeira publicação' }
  }

  const trocando = path.join(destino, '.trocando')
  fs.rmSync(trocando, { recursive: true, force: true })
  fs.mkdirSync(trocando, { recursive: true })
  for (const nome of fs.readdirSync(destino)) {
    if (nome === 'anterior' || nome === '.trocando') continue
    fs.renameSync(path.join(destino, nome), path.join(trocando, nome))
  }
  for (const nome of fs.readdirSync(anterior)) {
    fs.renameSync(path.join(anterior, nome), path.join(destino, nome))
  }
  fs.rmSync(anterior, { recursive: true, force: true })
  fs.renameSync(trocando, anterior)

  return { ok: true, destino, agora: versaoInstalada(destino) }
}

/** O retrato para a tela e para o comando: o que está instalado, o que está na
 *  pasta de obras, e se as duas batem. */
export function situacao({ repo = RAIZ_REPO, destino = pastaInstalada() } = {}) {
  const inst = versaoInstalada(destino)
  const commitObras = commitDe(repo)
  let versaoObras = null
  try { versaoObras = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version || null } catch { /* sem package */ }
  return {
    instalada: inst,
    obras: { versao: versaoObras, commit: commitObras, dir: repo },
    destino,
    publicada: Boolean(inst),
    iguais: Boolean(inst && commitObras && inst.commit === commitObras),
    temAnterior: fs.existsSync(path.join(destino, 'anterior', 'cc.mjs')),
  }
}
