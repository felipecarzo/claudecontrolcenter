// Botão "ligar projetos": dispara `claude --remote-control` num projeto, pra
// acessar do celular via claude.ai/code, sem precisar abrir terminal na mão.
//
// Achado testando de verdade em 13/08, no PC e na VPS: `claude
// --remote-control` falha com "Input must be provided either through stdin
// or as a prompt argument when using --print" quando o processo não tem um
// TTY de verdade. O comando confere isatty no stdout, e sem terminal real
// cai num caminho que se comporta como `--print`, que aí sim exige prompt.
// A primeira versão deste módulo redirecionava stdout pra arquivo de log —
// isso é exatamente o que mata o TTY. Por isso:
//
// - Linux/VPS: `tmux new-session -d`. tmux aloca um pseudo-terminal de
//   verdade pra sessão, e ela sobrevive independente de quem a criou —
//   inclusive a um restart do painel, porque quem segura o PTY é o tmux, não
//   o Node. `tmux capture-pane` lê o que apareceu na tela, é como o link de
//   conexão é recuperado sem precisar de stdout redirecionado.
// - Windows: sem tmux nativo. `spawn()` sem redirecionar stdio e com
//   `detached: true` faz o Windows abrir um console novo de verdade pro
//   filho (comportamento documentado do próprio Node) — é TTY genuíno, só
//   que visível. Sem esse console não dá pra capturar o link por aqui: quem
//   usa lê a janela que abriu.
//
// Liveness: nunca mais re-testar `process.kill(pid, 0)` depois que o
// processo pode ter morrido — o SO recicla PID, e isso já gerou um falso
// "ligado" com processo morto (medido em 13/08). No Windows o pid rastreado
// é o do `cmd /c`, que só sai quando o `claude` de dentro sair: o evento
// `exit` do próprio filho é a fonte de verdade. No Linux a fonte é `tmux
// has-session`/`list-sessions`, porque o tmux sobrevive ao processo que criou.

import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import { ehWindows } from './platform.mjs'

const PREFIXO_SESSAO = 'cc-remote-'

const slug = (projeto) => PREFIXO_SESSAO + String(projeto).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)

const tmux = (args, ms = 8000) => new Promise((resolve) => {
  execFile('tmux', args, { encoding: 'utf8', timeout: ms, maxBuffer: 4 * 1024 * 1024 },
    (erro, saida, err) => resolve(erro
      ? { ok: false, out: String(saida || err || erro.message || '').trim() }
      : { ok: true, out: saida }))
})

/** Só existe no Windows: aqui não tem tmux pra ser a fonte de verdade. */
const ativosWindows = new Map() // projeto -> { pid, desde, cwd }

/** O que está ligado agora. */
export async function estado() {
  if (ehWindows) {
    const out = {}
    for (const [projeto, info] of ativosWindows) out[projeto] = info
    return out
  }
  const r = await tmux(['list-sessions', '-F', '#{session_name}\t#{session_created}'])
  if (!r.ok) return {} // tmux ausente ou nenhuma sessão viva: mesmo resultado, vazio
  const out = {}
  for (const linha of r.out.split('\n')) {
    const [nome, criado] = linha.trim().split('\t')
    if (!nome || !nome.startsWith(PREFIXO_SESSAO)) continue
    out[nome.slice(PREFIXO_SESSAO.length)] = { sessao: nome, desde: (Number(criado) || 0) * 1000 || null }
  }
  return out
}

/**
 * Dispara `claude --remote-control "<nome>"` na pasta do projeto, com PTY
 * de verdade. Nunca espera terminar: é sessão que fica viva até o Felipe
 * fechar pelo celular, o `desligar` daqui, ou (só no Windows) o painel cair.
 */
export async function ligar(projeto, cwd, { binario = 'claude' } = {}) {
  if (!cwd || !fs.existsSync(cwd)) return { ok: false, erro: `pasta não existe: ${cwd}` }

  const existente = (await estado())[projeto]
  if (existente) return { ok: true, ja: true, ...existente }

  if (ehWindows) {
    try {
      // Sem stdio redirecionado + detached: o Windows abre console novo de
      // verdade pro filho. `cmd /c` porque `claude` é `.cmd` do npm global
      // (spawn não invoca `.cmd` sem ele, e `shell: true` com args dinâmicos
      // é injeção de comando); o cmd só sai quando o claude de dentro sair,
      // então o pid do cmd rastreia exatamente o tempo de vida da sessão.
      const filho = spawn('cmd', ['/c', binario, '--remote-control', projeto], {
        cwd, detached: true, stdio: 'ignore', windowsHide: false,
      })
      filho.unref()
      const info = { pid: filho.pid, desde: Date.now(), cwd }
      ativosWindows.set(projeto, info)
      filho.on('exit', () => ativosWindows.delete(projeto))
      filho.on('error', () => ativosWindows.delete(projeto))
      return { ok: true, ja: false, ...info }
    } catch (e) {
      return { ok: false, erro: String(e.message || e) }
    }
  }

  const sessao = slug(projeto)
  // Args separados (não uma string só): tmux exec direto, sem passar por
  // shell nenhum — nome de projeto com espaço ou aspas não vira injeção.
  const r = await tmux(['new-session', '-d', '-s', sessao, '-c', cwd, binario, '--remote-control', projeto])
  if (!r.ok) return { ok: false, erro: `tmux falhou: ${r.out || 'tmux está instalado?'}` }
  return { ok: true, ja: false, sessao, desde: Date.now(), cwd }
}

/** Mata a sessão. A conexão remota cai junto: é o processo local que sustenta ela. */
export async function desligar(projeto) {
  if (ehWindows) {
    const info = ativosWindows.get(projeto)
    if (!info) return { ok: true, ja: false }
    // O pid rastreado é do `cmd /c`, e `claude` no Windows é outro `.cmd` —
    // matar só o topo deixa a árvore de processos (e a janela) orfã. `/T`
    // mata a árvore inteira, `/F` força, sem precisar do PowerShell.
    await new Promise((resolve) => execFile('taskkill', ['/PID', String(info.pid), '/T', '/F'], () => resolve()))
    ativosWindows.delete(projeto)
    return { ok: true, ja: true }
  }
  const r = await tmux(['kill-session', '-t', slug(projeto)])
  return { ok: true, ja: r.ok }
}

/**
 * URL de conexão que `claude --remote-control` imprime ao subir. Só existe
 * no Linux: sai da tela virtual do tmux, a única captura de saída que não
 * exige redirecionar stdout — que é o próprio bug que este módulo existe
 * pra evitar.
 */
export async function link(projeto) {
  if (ehWindows) return { ok: false, erro: 'no Windows o link aparece na janela do console que abriu' }
  const r = await tmux(['capture-pane', '-t', slug(projeto), '-p', '-S', '-500'])
  if (!r.ok) return { ok: false, erro: `sessão não encontrada: ${r.out}` }
  const achados = r.out.match(/https?:\/\/\S+/g)
  if (!achados) return { ok: false, erro: 'sem link na tela ainda, tenta de novo em alguns segundos' }
  return { ok: true, url: achados[achados.length - 1] }
}

export const _internals = { slug, tmux, ativosWindows }
