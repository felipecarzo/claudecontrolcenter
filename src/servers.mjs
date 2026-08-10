// Servidores locais: o que está escutando porta nesta máquina, de qual projeto
// veio, e o link pra abrir. Serve pra achar o link esquecido e pra matar o
// duplicado que ficou rodando de ontem.

import fs from 'node:fs'
import path from 'node:path'
import { projectOf, PROJECT_DIRS } from './jobs.mjs'
import {
  listarPortas, matarProcesso, abrirPasta, abrirEditor, abrirTerminal, lancarComando,
} from './platform.mjs'
import { readConfig, setServidor } from './config.mjs'
import { findProjects, projectsBase } from './install.mjs'

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
 * O que o processo está de fato executando, extraído da linha de comando.
 *
 * Duas pistas, nesta ordem: o pacote dentro de `node_modules` (é assim que
 * `npm run dev` acaba virando um processo chamado só "node") e, quando não há,
 * o script próprio do projeto. Sem isso a lista fica com meia dúzia de "node"
 * idênticos e ninguém sabe qual é qual — foi a reclamação que originou isto.
 */
// Segmentos que são caminho, não nome de ferramenta. `.bin` e `..` aparecem
// juntos e às vezes com barra dobrada (`node_modules\.bin\\..\next`), que foi
// o que fez a primeira versão anunciar um servidor chamado ".bin".
const RUIDO = /^(\.bin|\.\.|\.|dist|bin|lib|build|out|src|index|node_modules)$/i

function alvoDoCmd(cmd = '') {
  const depois = cmd.split(/node_modules[\\/]+/i)[1]
  if (depois) {
    const partes = depois.split(/[\\/]+/).filter(Boolean)
    const i = partes.findIndex((p) => !RUIDO.test(p))
    if (i >= 0) {
      // pacote com escopo (`@scope/pkg`) só faz sentido com os dois pedaços
      const nome = partes[i].startsWith('@') && partes[i + 1]
        ? `${partes[i]}/${partes[i + 1]}`
        : partes[i]
      return nome.split(/["\s]/)[0].replace(/\.(cmd|ps1|js|mjs|exe)$/i, '')
    }
  }
  const script = cmd.match(/[\\/]([\w.-]+\.(?:mjs|cjs|js|ts|py))(?=["\s]|$)/i)
  if (script && !/node_modules/i.test(script[0])) return script[1]
  return null
}

/**
 * O trecho achado na linha de comando pode terminar num arquivo
 * (`.../app/dist/cli.js`) e não numa pasta. Tira o arquivo e as pastas de
 * build que sobram, senão "abrir a pasta do projeto" abriria o `dist` e
 * "subir de novo" rodaria `npm` onde não há `package.json`.
 */
function soPasta(p) {
  return p
    .replace(/[\\/][^\\/]*\.[a-z0-9]{1,4}$/i, '')
    .replace(/([\\/](?:dist|build|out|\.next|\.output|bin))+$/i, '')
}

/**
 * Uma linha explicando o que este servidor abre. Vazia quando não há nada
 * honesto a dizer — melhor silêncio do que repetir "node" com outras palavras.
 */
export function descrever({ kind, project, cmd, sub }) {
  const alvo = alvoDoCmd(cmd)
  const onde = [project, sub].filter(Boolean).join('/')
  if (alvo && onde) return `${alvo} rodando em ${onde}`
  if (alvo) return alvo
  if (onde) return `${kind} rodando em ${onde}`
  return ''
}

/**
 * Identidade do servidor entre reinícios. PID não serve: muda a cada
 * `npm run dev`, e é justamente depois de reiniciar que o apelido precisa
 * continuar lá. Caminho + porta é o par que se repete.
 */
export function chaveServidor({ path: p, name, ports }) {
  const base = (p || name || '?').toLowerCase().replace(/[\\/]+$/, '')
  return `${base}#${ports?.length ? Math.min(...ports) : 0}`
}

/**
 * Acha o caminho de projeto dentro da linha de comando.
 * Corta em `node_modules`: o vite é lançado pelo binário dentro dele, e o que
 * identifica o app é a pasta logo acima, não o caminho do pacote.
 */
function projectFromCmd(cmd = '') {
  const pastas = PROJECT_DIRS.join('|')
  // Caminho do Windows (`D:\...` ou `D:/...`) ou do Unix (`/home/...`) contendo
  // a pasta de projetos. O `[\\/]` depois da letra do drive não é enfeite: com
  // barra normal o padrão antigo começava a casar no primeiro `/` e o caminho
  // saía sem o `D:`, virando uma pasta que não existe.
  const re = new RegExp(String.raw`(?:[A-Za-z]:[\\/]|/)[^"'\s]*?[\\/](?:${pastas})[\\/][^"'\s]*`, 'i')
  const m = cmd.match(re)
  if (!m) return { project: null, sub: null, path: null }
  const dir = soPasta(m[0].split(/[\\/]node_modules\b/i)[0])
  return { ...projectOf(dir), path: dir }
}

/**
 * Guarda de onde este servidor subiu, para ele aparecer em "recentes" e poder
 * ser levantado de novo depois de fechado.
 *
 * A gravação é rara de propósito: registro novo, ou carimbo com mais de uma
 * hora. A varredura roda a cada 15s e escrever o config nesse ritmo seria
 * bater no disco por nada.
 */
const UMA_HORA = 3600e3
function registrarVistos(list) {
  const salvos = readConfig().servidores || {}
  for (const s of list) {
    if (!s.dev || !s.path) continue // sem pasta não há como subir de novo
    const antigo = salvos[s.chave]
    if (antigo && Date.now() - (antigo.ultimoEm || 0) < UMA_HORA) continue
    try {
      setServidor(s.chave, { cwd: s.path, comando: antigo?.comando || s.cmd, ultimoEm: Date.now() })
    } catch { /* config sem permissão de escrita não pode derrubar a lista */ }
  }
}

export function readServers({ force = false } = {}) {
  const now = Date.now()
  if (!force && now - cache.at < CACHE_MS) return cache.list

  const parsed = listarPortas()
  if (!parsed) return cache.list // consulta falhou: mantém a última lista boa

  const salvos = readConfig().servidores || {}
  const list = parsed
    .filter((p) => p && p.pid > 4)
    .map((p) => {
      const { project, sub, path: dir } = projectFromCmd(p.cmd || '')
      const ports = (p.ports || []).filter((n) => n >= MIN_PORT)
      const kind = kindOf(p.name, p.cmd)
      const base = String(p.name || '').replace(/\.exe$/i, '').toLowerCase()
      // "meu" = servidor de desenvolvimento: veio de um projeto ou é runtime de dev
      const dev = Boolean(project) || ['node', 'vite', 'next', 'serve', 'python'].includes(kind)
      const s = {
        pid: p.pid,
        ports,
        name: p.name || '?',
        kind,
        cmd: (p.cmd || '').trim(),
        project,
        sub,
        path: dir,
        dev,
        protegido: PROTEGIDOS.has(base),
        startedAt: p.started ? Date.parse(p.started) : null,
        // porta mais baixa costuma ser a que a pessoa quer abrir
        url: ports.length ? `http://localhost:${Math.min(...ports)}` : null,
      }
      s.chave = chaveServidor(s)
      s.resumo = descrever(s)
      const meu = salvos[s.chave] || {}
      s.apelido = meu.apelido || null
      s.nota = meu.nota || null
      s.favorito = !!meu.favorito
      // o que a lista mostra em letra grande: o que a pessoa escreveu vence
      s.titulo = s.apelido || s.project || alvoDoCmd(s.cmd) || s.name
      return s
    })
    .filter((s) => s.ports.length)
    .sort((a, b) => Math.min(...a.ports) - Math.min(...b.ports))

  registrarVistos(list)
  cache = { at: now, list }
  return list
}

/** Invalida o cache: quem escreve apelido precisa ver o efeito na hora. */
export function esquecerCache() {
  cache = { at: 0, list: [] }
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

/**
 * Grupos de servidores repetidos, com quem fica e quem sai.
 *
 * Repetido é o MESMO tipo no MESMO projeto — dois `vite` do inovallbond. Um
 * `next` e um `vite` lado a lado não são duplicata: monorepo sobe os dois de
 * propósito, e matar um seria estragar o ambiente em vez de limpar.
 *
 * Fica o mais recente, porque é o que a pessoa acabou de subir. Quem sai vai
 * na tela antes de qualquer clique: adivinhar errado aqui derruba trabalho.
 */
export function duplicados(list = readServers()) {
  const grupos = new Map()
  for (const s of list) {
    if (!s.dev || s.protegido || !s.project) continue
    const chave = `${s.project}|${s.kind}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(s)
  }
  return [...grupos]
    .filter(([, itens]) => itens.length > 1)
    .map(([chave, itens]) => {
      // sem data de início, o desempate é a porta: a maior costuma ser a nova
      const ordem = [...itens].sort((a, b) =>
        (b.startedAt || 0) - (a.startedAt || 0) || Math.min(...b.ports) - Math.min(...a.ports))
      const [manter, ...sair] = ordem
      const [project, kind] = chave.split('|')
      return { project, kind, manter, matar: sair }
    })
}

/**
 * Servidores que já rodaram e não estão no ar agora. Sai do config, alimentado
 * pela varredura — é o "ontem eu abri alguma coisa nesse projeto, o que era?".
 */
export function recentes({ limite = 12 } = {}) {
  const noAr = new Set(readServers().map((s) => s.chave))
  return Object.entries(readConfig().servidores || {})
    .filter(([chave, v]) => v.cwd && !noAr.has(chave))
    .sort((a, b) => (b[1].ultimoEm || 0) - (a[1].ultimoEm || 0))
    .slice(0, limite)
    .map(([chave, v]) => ({
      chave,
      nome: v.apelido || path.basename(v.cwd),
      cwd: v.cwd,
      comando: v.comando || null,
      nota: v.nota || null,
      favorito: !!v.favorito,
      ultimoEm: v.ultimoEm || null,
      porta: Number(chave.split('#').pop()) || null,
    }))
}

/**
 * Scripts de `package.json` que sobem alguma coisa. Só esses: oferecer `test`
 * ou `typecheck` num botão escrito "subir" faria a pessoa rodar a suíte
 * achando que estava levantando o servidor.
 */
function scriptsDe(dir) {
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  } catch {
    return []
  }
  return Object.keys(pkg.scripts || {})
    .filter((n) => /^(dev|start|serve|preview|watch)/i.test(n))
    .slice(0, 6)
}

const subpastasDe = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !/^(node_modules|\.|dist|build|out)/i.test(d.name))
      .map((d) => path.join(dir, d.name))
  } catch {
    return []
  }
}

/**
 * Pastas onde dá pra subir alguma coisa, com os scripts de cada uma.
 *
 * Desce um nível quando a raiz não tem `package.json`: nos monorepos do Felipe
 * (`inovallbond/apps/app_pierre`) é lá que mora o servidor, e parar na raiz
 * deixaria justamente os projetos grandes de fora da lista.
 */
export function projetosLancaveis() {
  const saida = []
  for (const dir of findProjects()) {
    const raiz = scriptsDe(dir)
    if (raiz.length) {
      saida.push({ nome: path.basename(dir), dir, scripts: raiz })
      continue
    }
    for (const sub of subpastasDe(dir)) {
      // `apps/` e `packages/` são só agrupamento: o app está um nível abaixo
      const alvos = /^(apps|packages|services|sites)$/i.test(path.basename(sub))
        ? subpastasDe(sub) : [sub]
      for (const alvo of alvos) {
        const scripts = scriptsDe(alvo)
        if (scripts.length) {
          saida.push({ nome: `${path.basename(dir)}/${path.basename(alvo)}`, dir: alvo, scripts })
        }
      }
    }
  }
  return saida.slice(0, 60)
}

/**
 * Só pasta de projeto. A trava não é contra ataque — o servidor só escuta em
 * 127.0.0.1 — é contra o painel virar um executor de comando em qualquer
 * lugar do disco por causa de um caminho digitado errado.
 */
function pastaValida(dir) {
  const alvo = String(dir || '')
  if (!alvo || !fs.existsSync(alvo)) throw new Error(`pasta não existe: ${alvo || '(vazia)'}`)
  if (!fs.statSync(alvo).isDirectory()) throw new Error('o caminho não é uma pasta')
  const base = projectsBase()
  const dentroDaBase = base && alvo.toLowerCase().startsWith(base.toLowerCase())
  const pastaDeProjetos = alvo.split(/[\\/]/).some((p) => PROJECT_DIRS.includes(p.toLowerCase()))
  if (!dentroDaBase && !pastaDeProjetos) {
    throw new Error('fora da pasta de projetos — o painel só abre e sobe coisa de projeto')
  }
  return alvo
}

/** Abre a pasta do projeto: no explorador, no editor ou num terminal. */
export function abrirLocal(dir, como = 'pasta') {
  const alvo = pastaValida(dir)
  if (como === 'editor') return abrirEditor(alvo), { dir: alvo, como }
  if (como === 'terminal') return abrirTerminal(alvo), { dir: alvo, como }
  if (como === 'pasta') return abrirPasta(alvo), { dir: alvo, como }
  throw new Error(`não sei abrir como "${como}"`)
}

/**
 * Sobe um servidor numa pasta de projeto. Guarda o par pasta+comando, que é o
 * que faz o item aparecer em "recentes" e poder ser repetido com um clique.
 */
export function subirServidor({ cwd, comando, chave = null }) {
  const alvo = pastaValida(cwd)
  const cmd = String(comando || '').trim()
  if (!cmd) throw new Error('comando obrigatório')
  if (cmd.length > 300) throw new Error('comando longo demais')

  lancarComando(cmd, alvo)
  // sem porta ainda: ele acabou de subir. A varredura corrige a chave depois.
  setServidor(chave || `${alvo.toLowerCase()}#0`, { cwd: alvo, comando: cmd, ultimoEm: Date.now() })
  esquecerCache()
  return { cwd: alvo, comando: cmd }
}

export const _internals = { kindOf, projectFromCmd, alvoDoCmd, pastaValida, scriptsDe }
