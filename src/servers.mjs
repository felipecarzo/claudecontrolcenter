// Servidores locais: o que está escutando porta nesta máquina, de qual projeto
// veio, e o link pra abrir. Serve pra achar o link esquecido e pra matar o
// duplicado que ficou rodando de ontem.

import { projectOf, PROJECT_DIRS } from './jobs.mjs'
import { listarPortas, matarProcesso } from './platform.mjs'

// Abaixo de 1024 é porta de sistema: não entra na lista e não pode ser morta.
const MIN_PORT = 1024
const CACHE_MS = 15000
let cache = { at: 0, list: [] }

/** Nunca encerráveis: derrubar qualquer um destes derruba a sessão do Windows. */
const PROTEGIDOS = new Set([
  'lsass', 'services', 'wininit', 'winlogon', 'csrss', 'smss', 'svchost',
  'spoolsv', 'system', 'registry', 'dwm', 'explorer',
])

/** Adivinha o que é o processo pelo executável e pela linha de comando. */
function kindOf(name = '', cmd = '') {
  const c = `${name} ${cmd}`.toLowerCase()
  if (c.includes('vite')) return 'vite'
  if (c.includes('next')) return 'next'
  if (c.includes('serve ')) return 'serve'
  if (/\bnode\b|node\.exe/.test(c)) return 'node'
  if (/python|uvicorn|flask/.test(c)) return 'python'
  if (/docker|com\.docker/.test(c)) return 'docker'
  if (/ssh|putty/.test(c)) return 'ssh'
  return name.replace(/\.exe$/i, '') || 'desconhecido'
}

/**
 * Acha o caminho de projeto dentro da linha de comando.
 * Corta em `node_modules`: o vite é lançado pelo binário dentro dele, e o que
 * identifica o app é a pasta logo acima, não o caminho do pacote.
 */
function projectFromCmd(cmd = '') {
  const pastas = PROJECT_DIRS.join('|')
  // caminho do Windows (D:\...) ou do Unix (/home/...) contendo a pasta de projetos
  const re = new RegExp(String.raw`(?:[A-Z]:\\|/)[^"'\s]*?[\\/](?:${pastas})[\\/][^"'\s]*`, 'i')
  const m = cmd.match(re)
  if (!m) return { project: null, path: null }
  const path = m[0].split(/[\\/]node_modules\b/i)[0]
  return { project: projectOf(path).project, path }
}

export function readServers({ force = false } = {}) {
  const now = Date.now()
  if (!force && now - cache.at < CACHE_MS) return cache.list

  const parsed = listarPortas()
  if (!parsed) return cache.list // consulta falhou: mantém a última lista boa

  const list = parsed
    .filter((p) => p && p.pid > 4)
    .map((p) => {
      const { project, path } = projectFromCmd(p.cmd || '')
      const ports = (p.ports || []).filter((n) => n >= MIN_PORT)
      const kind = kindOf(p.name, p.cmd)
      const base = String(p.name || '').replace(/\.exe$/i, '').toLowerCase()
      // "meu" = servidor de desenvolvimento: veio de um projeto ou é runtime de dev
      const dev = Boolean(project) || ['node', 'vite', 'next', 'serve', 'python'].includes(kind)
      return {
        pid: p.pid,
        ports,
        name: p.name || '?',
        kind,
        cmd: (p.cmd || '').trim(),
        project,
        path,
        dev,
        protegido: PROTEGIDOS.has(base),
        startedAt: p.started ? Date.parse(p.started) : null,
        // porta mais baixa costuma ser a que a pessoa quer abrir
        url: ports.length ? `http://localhost:${Math.min(...ports)}` : null,
      }
    })
    .filter((s) => s.ports.length)
    .sort((a, b) => Math.min(...a.ports) - Math.min(...b.ports))

  cache = { at: now, list }
  return list
}

/**
 * Encerra um processo. Três travas, porque a lista contém processos do Windows
 * e matar o errado derruba a sessão:
 *   1. o PID tem que estar na lista atual (não dá pra mandar matar qualquer coisa)
 *   2. tem que ser servidor de desenvolvimento, não processo do sistema
 *   3. nomes críticos ficam barrados mesmo se algo os classificar como dev
 */
export function killServer(pid) {
  const id = Number(pid)
  if (!Number.isInteger(id) || id <= 4) throw new Error('pid inválido')
  const alvo = readServers({ force: true }).find((s) => s.pid === id)
  if (!alvo) throw new Error(`pid ${id} não está na lista de servidores locais`)
  if (alvo.protegido) throw new Error(`${alvo.name} é processo do Windows e não pode ser encerrado aqui`)
  if (!alvo.dev) throw new Error(`${alvo.name} não é servidor de desenvolvimento — encerre pelo Gerenciador de Tarefas`)

  matarProcesso(id)
  cache = { at: 0, list: [] }
  return alvo
}

export const _internals = { kindOf, projectFromCmd }
