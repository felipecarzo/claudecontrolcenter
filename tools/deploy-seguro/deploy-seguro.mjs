#!/usr/bin/env node
/**
 * CC-789, pedido dele em 30/09: "precisamos ser capazes de fazer deploy dos
 * sistemas, mesmo que com alguma confirmação de segurança".
 *
 * O LADO PROTEGIDO. Roda como root, instalado por ele em /opt/cockpit-deploy, e
 * os agentes (usuário claudedev, sem sudo) não conseguem alterá-lo. Desenho
 * decidido com ele:
 *
 *  - o Cockpit e os agentes só PEDEM ("publicar mnzs"), por 127.0.0.1;
 *  - quem confirma é ele, com o código do autenticador (TOTP), numa página
 *    servida POR ESTE serviço. A página não pode ser do Cockpit: os agentes
 *    mexem no código do Cockpit e poderiam capturar o que ele digita;
 *  - a lista de alvos é fechada e mora em /etc/cockpit-deploy, de root;
 *  - o build roda como o usuário comum (é código escrito pelos agentes, nunca
 *    roda como root); o root só copia o resultado, recusa link simbólico,
 *    guarda cópia da versão anterior, confere o site e volta sozinho se falhar.
 *
 * Sem dependência: só o que vem com o Node.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const CONF_DIR = process.env.DEPLOY_CONF || '/etc/cockpit-deploy'
export const ESTADO_DIR = process.env.DEPLOY_ESTADO || '/var/lib/cockpit-deploy'
export const BACKUP_DIR = process.env.DEPLOY_BACKUP || '/var/backups/cockpit-deploy'
// 5190 é do osrm (rotas de mapa) nesta VPS; 5193 estava livre em 30/09
const PORTA = Number(process.env.DEPLOY_PORTA || 5193)
const VALIDADE_PEDIDO_MS = 30 * 60 * 1000
const MAX_FALHAS = 5
const BLOQUEIO_MS = 15 * 60 * 1000

/* ── TOTP (RFC 6238): o código de 6 números do autenticador ─────────────── */
export function base32Decodificar(s) {
  const ALF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const limpo = String(s || '').toUpperCase().replace(/[\s=]/g, '')
  let bits = ''
  for (const c of limpo) { const v = ALF.indexOf(c); if (v < 0) throw new Error('segredo inválido'); bits += v.toString(2).padStart(5, '0') }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}
export function base32Codificar(buf) {
  const ALF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0')
  let s = ''; for (let i = 0; i < bits.length; i += 5) s += ALF[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  return s
}
export function totp(segredo, passo, digitos = 6) {
  const chave = Buffer.isBuffer(segredo) ? segredo : base32Decodificar(segredo)
  const cont = Buffer.alloc(8); cont.writeBigUInt64BE(BigInt(passo))
  const h = crypto.createHmac('sha1', chave).update(cont).digest()
  const o = h[h.length - 1] & 0xf
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 10 ** digitos).padStart(digitos, '0')
}
/** Confere o código aceitando um passo de folga para cada lado (relógio do
 *  celular adiantado ou atrasado). Devolve o passo que bateu, ou null. */
export function conferirCodigo(segredo, codigo, agora = Date.now()) {
  const c = String(codigo || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return null
  const passo = Math.floor(agora / 30000)
  for (const d of [0, -1, 1]) {
    const esperado = totp(segredo, passo + d)
    if (crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(c))) return passo + d
  }
  return null
}

/* ── estado: pedidos, bloqueio, último passo usado ─────────────────────── */
const ARQ_ESTADO = () => path.join(ESTADO_DIR, 'estado.json')
export function lerEstado() {
  try { return { pedidos: [], historico: [], falhas: 0, bloqueadoAte: 0, ultimoPasso: 0, ultimoCommit: {}, ...JSON.parse(fs.readFileSync(ARQ_ESTADO(), 'utf8')) } } catch { return { pedidos: [], historico: [], falhas: 0, bloqueadoAte: 0, ultimoPasso: 0, ultimoCommit: {} } }
}
export function gravarEstado(e) {
  fs.mkdirSync(ESTADO_DIR, { recursive: true, mode: 0o700 })
  const tmp = ARQ_ESTADO() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(e, null, 1), { mode: 0o600 })
  fs.renameSync(tmp, ARQ_ESTADO())
}
export function lerAlvos() {
  const lista = JSON.parse(fs.readFileSync(path.join(CONF_DIR, 'alvos.json'), 'utf8'))
  return Array.isArray(lista) ? lista.filter((a) => a && /^[a-z0-9-]{2,40}$/.test(a.id)) : []
}
const lerSegredo = () => fs.readFileSync(path.join(CONF_DIR, 'totp.secret'), 'utf8').trim()

/* ── comandos: o build roda como o usuário comum ───────────────────────── */
function idDe(usuario) {
  const uid = Number(execFileSync('id', ['-u', usuario], { encoding: 'utf8' }).trim())
  const gid = Number(execFileSync('id', ['-g', usuario], { encoding: 'utf8' }).trim())
  return { uid, gid }
}
export function rodar(cmd, args, { cwd, usuario = null, log, timeout = 10 * 60 * 1000, env = {} } = {}) {
  return new Promise((resolve) => {
    const op = { cwd, timeout, env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: usuario ? `/home/${usuario}` : '/root', ...env } }
    if (usuario) Object.assign(op, idDe(usuario))
    const p = spawn(cmd, args, op)
    const junta = (d) => log && log(String(d))
    p.stdout.on('data', junta); p.stderr.on('data', junta)
    p.on('error', (e) => resolve({ ok: false, codigo: -1, erro: e.message }))
    p.on('close', (codigo) => resolve({ ok: codigo === 0, codigo }))
  })
}
async function saida(cmd, args, op) {
  let t = ''; const r = await rodar(cmd, args, { ...op, log: (s) => { t += s } })
  return r.ok ? t.trim() : null
}

/** Recusa link simbólico e conta o tamanho: o que sai do build é dos agentes. */
export function inspecionar(dir, limite = 500 * 1024 * 1024) {
  let total = 0; let arquivos = 0
  const andar = (d) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name)
      if (n.isSymbolicLink()) throw new Error('o build tem um link simbólico (' + path.relative(dir, p) + '): recusado')
      if (n.isDirectory()) andar(p)
      else if (n.isFile()) { total += fs.statSync(p).size; arquivos += 1 } else throw new Error('arquivo de tipo estranho no build: ' + path.relative(dir, p))
      if (total > limite) throw new Error('o build passou de ' + Math.round(limite / 1048576) + ' MB: recusado')
    }
  }
  andar(dir)
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error('o build não tem index.html')
  return { total, arquivos }
}

/* ── o deploy estático, passo a passo, com volta automática ────────────── */
export async function deployEstatico(alvo, pedido, { log, buscar = fetch } = {}) {
  const passo = (t) => log(`\n▸ ${t}\n`)
  const repo = alvo.repo; const dir = path.join(repo, alvo.dir || '.'); const saidaDir = path.join(dir, alvo.saida || 'dist')
  const destino = alvo.destino; const pai = path.dirname(destino); const base = path.basename(destino)
  /* repositório sem dependências instaladas (medido no mnzs em 30/09: sem
     node_modules, o build sai com 127, "comando não encontrado") */
  if (alvo.build && !fs.existsSync(path.join(dir, 'node_modules')) && fs.existsSync(path.join(dir, 'package.json'))) {
    passo(`instalando as dependências (npm ${fs.existsSync(path.join(dir, 'package-lock.json')) ? 'ci' : 'install'}), como ${alvo.usuarioBuild}`)
    const inst = await rodar('npm', [fs.existsSync(path.join(dir, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: dir, usuario: alvo.usuarioBuild, log })
    if (!inst.ok) throw new Error('não consegui instalar as dependências (código ' + inst.codigo + ')')
  }
  // variáveis do build por site (ex.: o climbing sobe com as contas de demonstração); só nome válido e texto
  const env = Object.fromEntries(Object.entries(alvo.env || {}).filter(([k, v]) => /^[A-Z_][A-Z0-9_]*$/.test(k) && typeof v === 'string'))
  // página pronta (lev4, entreg4): sem build, a pasta de saída é publicada como está
  if (alvo.build) {
    passo(`gerando os arquivos (${alvo.build}${Object.keys(env).length ? ', com ' + Object.keys(env).join(', ') : ''}), como ${alvo.usuarioBuild}`)
    const [cmd, ...args] = String(alvo.build).split(' ')
    const b = await rodar(cmd, args, { cwd: dir, usuario: alvo.usuarioBuild, log, env })
    if (!b.ok) throw new Error('o build falhou (código ' + b.codigo + ')')
  } else passo('página pronta: sem etapa de build')
  passo('conferindo o que saiu do build')
  const insp = inspecionar(saidaDir)
  log(`${insp.arquivos} arquivos, ${Math.round(insp.total / 1024)} KB\n`)
  passo('guardando cópia da versão no ar')
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 })
  const copia = path.join(BACKUP_DIR, `${alvo.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`)
  if (fs.existsSync(destino)) { const t = await rodar('tar', ['-czf', copia, '-C', pai, base], { log }); if (!t.ok) throw new Error('não consegui guardar a cópia') ; log(copia + '\n') }
  passo('copiando a versão nova ao lado da que está no ar')
  const novo = destino + '.novo'; const antigo = destino + '.antigo'
  fs.rmSync(novo, { recursive: true, force: true })
  const c = await rodar('cp', ['-r', '--no-dereference', saidaDir, novo], { log })
  if (!c.ok) throw new Error('não consegui copiar o build')
  if (fs.existsSync(destino)) {
    const st = fs.statSync(destino)
    await rodar('chown', ['-R', `${st.uid}:${st.gid}`, novo], { log })
    fs.chmodSync(novo, st.mode & 0o7777)
  }
  passo('trocando')
  fs.rmSync(antigo, { recursive: true, force: true })
  if (fs.existsSync(destino)) fs.renameSync(destino, antigo)
  fs.renameSync(novo, destino)
  passo(`conferindo o site no ar (${alvo.url})`)
  const esperado = fs.readFileSync(path.join(destino, 'index.html'), 'utf8')
  let okSite = false
  for (let i = 0; i < 3 && !okSite; i += 1) {
    try { const r = await buscar(alvo.url, { headers: { 'cache-control': 'no-cache' } }); const corpo = await r.text(); okSite = r.status === 200 && corpo.trim() === esperado.trim(); log(`resposta ${r.status}${okSite ? ', serve o index.html novo' : ', mas não é o arquivo novo'}\n`) } catch (e) { log('falhou: ' + e.message + '\n') }
    if (!okSite) await new Promise((r) => setTimeout(r, 1500))
  }
  if (!okSite) {
    passo('o site não serviu a versão nova: voltando a anterior')
    fs.rmSync(destino + '.falhou', { recursive: true, force: true })
    fs.renameSync(destino, destino + '.falhou')
    if (fs.existsSync(antigo)) fs.renameSync(antigo, destino)
    throw new Error('o site não serviu a versão nova; a anterior foi devolvida (a nova ficou em ' + base + '.falhou)')
  }
  return { copia, arquivos: insp.arquivos }
}

/* ── deploy de site que roda como programa (PM2 ou Docker) ─────────────────
   Pedido dele em 30/09: "coloque todos". Dois modos de levar o código novo:
   - produção é repositório git (profinance, inovallbond): `git pull` lá;
   - produção é cópia solta (ibrics, fibraessencia, lev4, ahtleta...): copia
     da pasta de trabalho, SEM apagar nada da produção e sem tocar no que só
     existe lá (senhas, dados, dependências instaladas, build).
   Antes guarda cópia da produção; depois reconstrói (Docker) ou reinicia
   (PM2), confere o site e, se não responder, devolve a cópia e religa. */
export const EXCLUIR_COPIA = ['.git', 'node_modules', '.next', '.venv', 'venv', '__pycache__', '.env', '.env.*', 'data', 'media', 'cache', 'uploads', '*.log', '*.bak*', 'CREDENCIAIS.md', 'dist', 'build']
export async function deployProcesso(alvo, pedido, { log, buscar = fetch, exec = rodar, esperaMs = 4000 } = {}) {
  const passo = (t) => log(`\n▸ ${t}\n`)
  const prod = alvo.dirProducao
  if (!prod || !fs.existsSync(prod)) throw new Error('a pasta de produção não existe: ' + prod)
  // serviço que roda direto da pasta do projeto (o coepiloto): não há o que copiar, e devolver arquivo ali apagaria trabalho dele
  const naPasta = alvo.tipo === 'systemd' && path.resolve(prod) === path.resolve(alvo.repo)
  const ehGit = !naPasta && fs.existsSync(path.join(prod, '.git'))
  let copia = null, antes = null
  if (!naPasta) {
  passo('guardando cópia da produção (sem dependências nem dados)')
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 })
  copia = path.join(BACKUP_DIR, `${alvo.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`)
  const fora = ['node_modules', '.next', '.venv', 'venv', 'data', 'media', 'cache', 'uploads'].flatMap((x) => ['--exclude', x])
  const t = await exec('tar', ['-czf', copia, ...fora, '-C', path.dirname(prod), path.basename(prod)], { log })
  if (!t.ok) throw new Error('não consegui guardar a cópia da produção')
  if (ehGit) {
    antes = (await saida('git', ['-C', prod, 'rev-parse', 'HEAD'], {})) || null
    passo(`puxando o código novo do GitHub (${alvo.ramo || 'ramo atual'})`)
    const f = await exec('git', ['-C', prod, 'pull', '--ff-only', ...(alvo.ramo ? ['origin', alvo.ramo] : [])], { log })
    if (!f.ok) throw new Error('o git pull falhou (a produção tem mudança local, ou o ramo divergiu): nada foi trocado')
  } else {
    const origem = path.join(alvo.repo, alvo.dir || '.')
    passo(`copiando de ${origem} (sem apagar nada da produção)`)
    const ex = [...EXCLUIR_COPIA, ...(alvo.excluir || [])].flatMap((x) => ['--exclude', x])
    // --checksum: compara o conteúdo; pelo tamanho e horário, uma correção de uma letra no mesmo segundo ficaria de fora
    const r = await exec('rsync', ['-a', '--checksum', '--no-owner', '--no-group', ...ex, origem.replace(/\/?$/, '/'), prod.replace(/\/?$/, '/')], { log })
    if (!r.ok) throw new Error('a cópia falhou')
  }
  }
  const religar = async () => {
    if (alvo.tipo === 'docker') {
      passo('reconstruindo e religando o container (docker compose up -d --build)')
      return exec('docker', ['compose', 'up', '-d', '--build', ...(alvo.servico ? [alvo.servico] : [])], { cwd: prod, log, timeout: 20 * 60 * 1000 })
    }
    if (alvo.tipo === 'systemd') { passo(`religando o serviço (systemctl restart ${alvo.unidade})`); return exec('systemctl', ['restart', alvo.unidade], { log }) }
    if (fs.existsSync(path.join(prod, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(prod, 'package.json'), 'utf8'))
      passo('instalando as dependências')
      const i = await exec('npm', [fs.existsSync(path.join(prod, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: prod, log })
      if (!i.ok) return i
      if (pkg.scripts && pkg.scripts.build) { passo('gerando (npm run build)'); const b = await exec('npm', ['run', 'build'], { cwd: prod, log }); if (!b.ok) return b }
    }
    passo(`reiniciando o processo (pm2 restart ${alvo.processo})`)
    return exec('pm2', ['restart', alvo.processo, '--update-env'], { cwd: prod, log, env: { PM2_HOME: '/root/.pm2' } })
  }
  const conferir = async () => {
    passo(`conferindo o site (${alvo.url})`)
    for (let i = 0; i < 12; i += 1) {
      try { const r = await buscar(alvo.url, { redirect: 'manual' }); log(`resposta ${r.status}\n`); if (r.status < 500) return true } catch (e) { log('ainda sem resposta: ' + e.message + '\n') }
      await new Promise((ok) => setTimeout(ok, esperaMs))
    }
    return false
  }
  const r = await religar()
  if (r.ok && await conferir()) return { copia }
  if (naPasta) throw new Error('o serviço não voltou depois de religar; ele roda da pasta do projeto, então não há versão anterior para devolver')
  passo('não subiu direito: devolvendo a versão anterior')
  if (ehGit && antes) await exec('git', ['-C', prod, 'reset', '--hard', antes], { log })
  else await exec('tar', ['-xzf', copia, '-C', path.dirname(prod)], { log })
  await religar()
  throw new Error(r.ok ? 'o site não respondeu depois de publicar; a versão anterior foi devolvida' : 'falhou ao gerar ou religar; a versão anterior foi devolvida')
}
export const deployAlvo = (alvo, pedido, op) => (alvo.tipo === 'estatico' ? deployEstatico(alvo, pedido, op) : deployProcesso(alvo, pedido, op))

/* ── descoberta: quais sites existem e de onde vêm ────────────────────────
   Pedido dele: "deveríamos criar um processo que automatize isso, sem gastar
   tokens sempre". O lado protegido (root) enxerga o nginx, o PM2 e o Docker
   inteiros; os agentes não. As leituras são funções puras, testáveis. */
export function lerNginx(arquivos) {
  const sites = []
  for (const { nome, texto } of arquivos) {
    for (const bloco of String(texto).split(/\bserver\s*\{/).slice(1)) {
      if (/return\s+410/.test(bloco) && !/proxy_pass|root\s+\/var\/www/.test(bloco)) continue
      const dominio = (bloco.match(/server_name\s+([^;\s]+)/) || [])[1]
      if (!dominio || dominio === '_') continue
      const raizes = [...bloco.matchAll(/(?:root|alias)\s+(\/var\/www\/[^;\s]+)/g)].map((m) => m[1].replace(/\/$/, '')).filter((r) => !/\/var\/www\/html$/.test(r))
      const portas = [...bloco.matchAll(/proxy_pass\s+https?:\/\/127\.0\.0\.1:(\d+)/g)].map((m) => Number(m[1]))
      const ja = sites.find((s) => s.dominio === dominio)
      if (ja) { ja.raizes = [...new Set([...ja.raizes, ...raizes])]; ja.portas = [...new Set([...ja.portas, ...portas])] } else sites.push({ dominio, arquivo: nome, raizes: [...new Set(raizes)], portas: [...new Set(portas)] })
    }
  }
  return sites
}
export function lerDocker(linhas) {
  const porta = new Map()
  for (const l of String(linhas).split('\n').filter(Boolean)) {
    let o; try { o = JSON.parse(l) } catch { continue }
    const rot = Object.fromEntries(String(o.Labels || '').split(',').map((x) => x.split('=')))
    for (const m of String(o.Ports || '').matchAll(/127\.0\.0\.1:(\d+)->/g)) porta.set(Number(m[1]), { container: o.Names, dir: rot['com.docker.compose.project.working_dir'] || null, servico: rot['com.docker.compose.service'] || null })
  }
  return porta
}
export function lerPm2(json, pidsPorPorta) {
  let lista = []; try { lista = JSON.parse(json) } catch { return new Map() }
  const porPid = new Map(lista.map((p) => [p.pid, { processo: p.name, dir: p.pm2_env && p.pm2_env.pm_cwd }]))
  const porta = new Map()
  for (const [p, pids] of pidsPorPorta) for (const pid of pids) if (porPid.has(pid)) porta.set(p, porPid.get(pid))
  return porta
}
export function lerPortas(ssSaida) {
  const m = new Map()
  for (const l of String(ssSaida).split('\n')) {
    const p = (l.match(/127\.0\.0\.1:(\d+)\s/) || l.match(/\*:(\d+)\s/) || l.match(/0\.0\.0\.0:(\d+)\s/) || [])[1]
    if (!p) continue
    const pids = [...l.matchAll(/pid=(\d+)/g)].map((x) => Number(x[1]))
    m.set(Number(p), [...(m.get(Number(p)) || []), ...pids])
  }
  return m
}
const normNome = (s) => String(s || '').toLowerCase().replace(/\.(com|carzo)(\.br)?.*$/, '').replace(/^(vps|pc|web|app|proj|game)[_-]/, '').replace(/[^a-z0-9]/g, '')
export function sugerirRepo(candidatos, repos) {
  const chaves = candidatos.filter(Boolean).map(normNome).filter((x) => x.length >= 3)
  let melhor = null
  for (const r of repos) {
    const k = normNome(path.basename(r))
    const pts = chaves.some((c) => c === k) ? 3 : chaves.some((c) => k && (c.startsWith(k) || k.startsWith(c))) ? 2 : chaves.some((c) => k && (c.includes(k) || k.includes(c))) ? 1 : 0
    if (pts > (melhor?.pts || 0)) melhor = { repo: r, pts }
  }
  return melhor ? melhor.repo : null
}
// os serviços da própria máquina e do Cockpit: nunca viram site para publicar
const UNIDADES_PROTEGIDAS = ['agent-cockpit.service', 'cockpit-auth.service', 'cockpit-deploy.service', 'nginx.service', 'docker.service', 'ssh.service', 'containerd.service']
/** Quem atende a porta quando não é Docker nem PM2: a unidade do systemd sai do cgroup do processo. */
export function lerOutro(pid, ler = (f) => fs.readFileSync(f, 'utf8'), link = fs.readlinkSync) {
  let unidade = null, dir = null, comando = null
  try { const m = ler(`/proc/${pid}/cgroup`).match(/system\.slice\/([^/\s]+\.service)/); unidade = m ? m[1] : null } catch { /* sumiu */ }
  try { dir = link(`/proc/${pid}/cwd`) } catch { /* sem permissão */ }
  try { comando = ler(`/proc/${pid}/cmdline`).split('\0').filter(Boolean).join(' ').slice(0, 160) } catch { /* sumiu */ }
  return { unidade, dir, comando }
}
export function montarSugestoes({ sites, docker, pm2, outros = new Map(), repos, alvos }) {
  const cadastrado = (x) => alvos.some((a) => a.destino === x || a.dirProducao === x)
  const sug = []
  const INFRA = ['cockpit.carzo.com.br', 'testedevoo.carzo.com.br'] // o próprio Cockpit e o teste de voo não são sites para publicar
  // subpasta de outra raiz (os ícones do ahtleta dentro de /var/www/ahtleta) não é site
  const raizes = [...sites.flatMap((x) => x.raizes), ...alvos.map((a) => a.destino).filter(Boolean)]
  const dentroDeOutra = (r) => raizes.some((o) => o !== r && r.startsWith(o + '/'))
  for (const s of sites.filter((x) => !INFRA.includes(x.dominio))) {
    for (const raiz of s.raizes) if (!dentroDeOutra(raiz) && !cadastrado(raiz) && ![...pm2.values()].some((p) => p.dir === raiz)) sug.push({ dominio: s.dominio, tipo: 'estatico', destino: raiz, url: `https://${s.dominio}/`, repo: sugerirRepo([path.basename(raiz), s.dominio], repos) })
    for (const porta of s.portas) {
      const d = docker.get(porta); const p = pm2.get(porta); const o = outros.get(porta)
      const item = d ? { tipo: 'docker', dirProducao: d.dir, servico: d.servico, porta } : p ? { tipo: 'pm2', dirProducao: p.dir, processo: p.processo, porta }
        : o && o.unidade && !UNIDADES_PROTEGIDAS.includes(o.unidade) ? { tipo: 'systemd', dirProducao: o.dir, unidade: o.unidade, porta }
        // processo sem Docker, PM2 nem serviço: aparece, para ele saber que existe, mas não há como religar com segurança
          : { tipo: 'manual', dirProducao: o && o.dir, comando: o && o.comando, porta }
      if ((item.tipo !== 'manual' && !item.dirProducao) || (item.dirProducao && (cadastrado(item.dirProducao) || sug.some((x) => x.dirProducao === item.dirProducao)))) continue
      // porta solta de um site que já tem cadastro ou sugestão (a API que o running do ahtleta repassa) não é outro site
      if (item.tipo === 'manual' && (sug.some((x) => x.dominio === s.dominio) || alvos.some((x) => x.url === `https://${s.dominio}/`))) continue
      sug.push({ dominio: s.dominio, ...item, url: `https://${s.dominio}/`, repo: sugerirRepo([item.dirProducao && path.basename(item.dirProducao), item.processo, item.unidade && item.unidade.replace(/\.service$/, ''), s.dominio], repos) })
    }
  }
  return sug
}
export async function descobrir() {
  const nginxDir = '/etc/nginx/sites-enabled'
  const arquivos = fs.readdirSync(nginxDir).map((n) => { try { return { nome: n, texto: fs.readFileSync(path.join(nginxDir, n), 'utf8') } } catch { return null } }).filter(Boolean)
  const sites = lerNginx(arquivos)
  const docker = lerDocker((await saida('docker', ['ps', '--format', '{{json .}}'], {})) || '')
  const portas = lerPortas((await saida('ss', ['-ltnpH'], {})) || '')
  const pm2 = lerPm2((await saida('pm2', ['jlist'], { env: { PM2_HOME: '/root/.pm2' } })) || '[]', portas)
  const base = '/home/claudedev/projetos'
  const repos = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.')).map((d) => path.join(base, d.name))
  const outros = new Map([...portas].filter(([p, pids]) => pids.length && !docker.has(p) && !pm2.has(p)).map(([p, pids]) => [p, lerOutro(pids[0])]))
  return montarSugestoes({ sites, docker, pm2, outros, repos, alvos: lerAlvos() })
}

/* Cadastro de site novo: validado aqui de novo, porque vem de formulário. */
export function validarAlvo(a) {
  const id = String(a.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  if (id.length < 2) throw new Error('nome curto demais')
  const tipo = ['estatico', 'pm2', 'docker', 'systemd'].includes(a.tipo) ? a.tipo : null
  if (!tipo) throw new Error('tipo inválido')
  const sobPasta = (p, bases) => { const r = path.resolve(String(p || '')); return bases.some((b) => r === b || r.startsWith(b + '/')) ? r : null }
  const repo = sobPasta(a.repo, ['/home/claudedev/projetos'])
  if (!repo || !fs.existsSync(repo)) throw new Error('repositório fora de /home/claudedev/projetos')
  const dir = String(a.dir || '.'); if (dir.includes('..') || path.isAbsolute(dir)) throw new Error('subpasta inválida')
  const url = /^https:\/\/[a-z0-9.-]+\/$/.test(String(a.url || '')) ? a.url : null
  if (!url) throw new Error('endereço inválido')
  const o = { id, nome: String(a.nome || id).slice(0, 60), tipo, repo, dir, url, usuarioBuild: 'claudedev' }
  if (tipo === 'estatico') {
    o.destino = sobPasta(a.destino, ['/var/www']); if (!o.destino || o.destino === '/var/www') throw new Error('pasta no ar fora de /var/www')
    o.build = a.build ? String(a.build).slice(0, 120) : null
    if (o.build && !/^(npm|npx|pnpm|yarn) [a-zA-Z0-9 ._:=/-]+$/.test(o.build)) throw new Error('comando de build não permitido')
    o.saida = String(a.saida || 'dist'); if (o.saida.includes('..') || path.isAbsolute(o.saida)) throw new Error('pasta de saída inválida')
  } else {
    o.dirProducao = sobPasta(a.dirProducao, ['/opt', '/var/www', ...(tipo === 'systemd' ? ['/home/claudedev/projetos'] : [])]); if (!o.dirProducao || ['/opt', '/var/www', '/home/claudedev/projetos'].includes(o.dirProducao)) throw new Error('pasta de produção fora de /opt ou /var/www')
    if (tipo === 'systemd') { o.unidade = String(a.unidade || ''); if (!/^[a-zA-Z0-9_.@-]{1,60}\.service$/.test(o.unidade) || UNIDADES_PROTEGIDAS.includes(o.unidade)) throw new Error('serviço do sistema inválido') }
    if (tipo === 'pm2') { o.processo = String(a.processo || ''); if (!/^[a-zA-Z0-9_.-]{1,60}$/.test(o.processo)) throw new Error('nome de processo inválido') }
    if (tipo === 'docker' && a.servico) { o.servico = String(a.servico); if (!/^[a-zA-Z0-9_.-]{1,60}$/.test(o.servico)) throw new Error('serviço inválido') }
  }
  return o
}
export function cadastrarAlvo(novo) {
  const lista = JSON.parse(fs.readFileSync(path.join(CONF_DIR, 'alvos.json'), 'utf8'))
  if (lista.some((a) => a.id === novo.id)) throw new Error('já existe um site com esse nome')
  lista.push(novo)
  const arq = path.join(CONF_DIR, 'alvos.json'); fs.copyFileSync(arq, arq + '.antes-' + Date.now())
  fs.writeFileSync(arq + '.tmp', JSON.stringify(lista, null, 2), { mode: 0o600 }); fs.renameSync(arq + '.tmp', arq)
}

/* ── o servidor ────────────────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const corpoDe = (req, max = 4096) => new Promise((ok, falha) => { let t = ''; req.on('data', (d) => { t += d; if (t.length > max) { req.destroy(); falha(new Error('grande demais')) } }); req.on('end', () => ok(t)) })
const json = (res, c, o) => { res.writeHead(c, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)) }

async function infoDoRepo(alvo) {
  const op = { cwd: alvo.repo, usuario: alvo.usuarioBuild }
  const ramo = await saida('git', ['branch', '--show-current'], op)
  const commit = await saida('git', ['log', '-1', '--format=%h %s'], op)
  const ultimo = lerEstado().ultimoCommit[alvo.id]
  const novos = ultimo ? await saida('git', ['log', '--oneline', `${ultimo}..HEAD`, '--', alvo.dir || '.'], op) : null
  const sujo = await saida('git', ['status', '--short', '--', alvo.dir || '.'], op)
  return { ramo, commit, novos: novos ? novos.split('\n').filter(Boolean).slice(0, 30) : null, arquivosSemCommit: sujo ? sujo.split('\n').filter(Boolean).length : 0 }
}

/** Confere o código e já aplica o bloqueio. Devolve null quando passou, ou o motivo. */
function usarCodigo(e, codigo, agora) {
  if (agora < e.bloqueadoAte) return 'bloqueado por códigos errados: tente depois das ' + new Date(e.bloqueadoAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const passo = conferirCodigo(lerSegredo(), codigo, agora)
  if (passo === null || passo <= e.ultimoPasso) {
    e.falhas += 1
    if (e.falhas >= MAX_FALHAS) { e.bloqueadoAte = agora + BLOQUEIO_MS; e.falhas = 0 }
    gravarEstado(e)
    return passo !== null ? 'esse código já foi usado: espere o próximo' : (e.bloqueadoAte > agora ? 'código errado: bloqueado por 15 minutos' : 'código errado (' + e.falhas + ' de ' + MAX_FALHAS + ' antes de bloquear)')
  }
  e.falhas = 0; e.ultimoPasso = passo; gravarEstado(e)
  return null
}
let SUGESTOES = { em: 0, lista: [] }

export function criarServidor({ executar = deployAlvo, descobrirFn = descobrir } = {}) {
  return http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x')
    try {
      // ── a API, para o Cockpit e os agentes: só pedir e ler ──
      if (u.pathname === '/api/alvos') return json(res, 200, lerAlvos().map((a) => ({ id: a.id, nome: a.nome, url: a.url, repo: a.repo })))
      if (u.pathname === '/api/pedidos') { const e = lerEstado(); return json(res, 200, { pedidos: e.pedidos.map(({ log, ...p }) => p), historico: e.historico.slice(0, 20).map(({ log, ...p }) => p) }) }
      if (u.pathname === '/api/pedir' && req.method === 'POST') {
        const d = JSON.parse(await corpoDe(req) || '{}')
        const alvo = lerAlvos().find((a) => a.id === d.alvo)
        if (!alvo) return json(res, 400, { ok: false, erro: 'alvo fora da lista' })
        const e = lerEstado(); const agora = Date.now()
        e.pedidos = e.pedidos.filter((p) => p.estado !== 'esperando' || agora - p.em < VALIDADE_PEDIDO_MS)
        if (e.pedidos.some((p) => p.alvo === alvo.id && (p.estado === 'esperando' || p.estado === 'rodando'))) return json(res, 200, { ok: true, jaPedido: true })
        if (e.pedidos.filter((p) => p.estado === 'esperando').length >= 5) return json(res, 429, { ok: false, erro: 'pedidos demais esperando' })
        const p = { id: crypto.randomBytes(6).toString('hex'), alvo: alvo.id, nome: alvo.nome, url: alvo.url, de: String(d.de || 'cockpit').slice(0, 60), em: agora, estado: 'esperando', ...(await infoDoRepo(alvo)) }
        e.pedidos.unshift(p); gravarEstado(e)
        return json(res, 200, { ok: true, id: p.id, confirmar: '/deploy-seguro/' })
      }
      // ── a página de confirmação: só ele, com o código do autenticador ──
      if (u.pathname === '/deploy-seguro/' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' })
        return res.end(pagina(lerEstado(), u.searchParams.get('msg')))
      }
      /* A decisão é uma só: a página (formulário) e o cartão do Cockpit (JSON,
         escolha dele em 30/09: "pode até pedir o código dentro do próprio card")
         passam pelas mesmas regras. */
      const decidir = (id, codigo, recusar) => {
        const e = lerEstado(); const agora = Date.now()
        const p = e.pedidos.find((x) => x.id === id && x.estado === 'esperando')
        if (!p) return { ok: false, msg: 'esse pedido não está mais esperando' }
        if (recusar) { p.estado = 'recusado'; p.fim = agora; e.historico.unshift(p); e.pedidos = e.pedidos.filter((y) => y.id !== p.id); gravarEstado(e); return { ok: true, msg: 'pedido recusado' } }
        const erroCodigo = usarCodigo(e, codigo, agora)
        if (erroCodigo) return { ok: false, msg: erroCodigo }
        p.estado = 'rodando'; p.inicio = agora; p.log = ''
        gravarEstado(e)
        const alvo = lerAlvos().find((a) => a.id === p.alvo)
        const anota = (t) => { const x = lerEstado(); const q = x.pedidos.find((y) => y.id === p.id); if (q) { q.log = (q.log + t).slice(-20000); gravarEstado(x) } }
        executar(alvo, p, { log: anota }).then((r) => {
          const x = lerEstado(); const q = x.pedidos.find((y) => y.id === p.id)
          q.estado = 'publicado'; q.fim = Date.now(); q.copia = r.copia
          x.ultimoCommit[p.alvo] = (p.commit || '').split(' ')[0] || x.ultimoCommit[p.alvo]
          x.historico.unshift(q); x.pedidos = x.pedidos.filter((y) => y.id !== p.id); gravarEstado(x)
        }).catch((err) => {
          const x = lerEstado(); const q = x.pedidos.find((y) => y.id === p.id)
          q.estado = 'falhou'; q.fim = Date.now(); q.erro = err.message; q.log = (q.log + '\n✗ ' + err.message).slice(-20000)
          x.historico.unshift(q); x.pedidos = x.pedidos.filter((y) => y.id !== p.id); gravarEstado(x)
        })
        return { ok: true, msg: 'confirmado: publicando ' + p.nome }
      }
      /* Descoberta e cadastro (pedido dele: "automatize isso, sem gastar tokens").
         Ler as sugestões é livre; cadastrar exige o código, como publicar. */
      if (u.pathname === '/api/sugestoes') {
        if (Date.now() - SUGESTOES.em > 5 * 60 * 1000 || u.searchParams.get('agora')) SUGESTOES = { em: Date.now(), lista: await descobrirFn() }
        // a lista de repositórios vai junto: no cadastro ele troca o sugerido, que às vezes erra (running caía no VPS_ahtleta)
        let repos = []; try { repos = fs.readdirSync('/home/claudedev/projetos', { withFileTypes: true }).filter((d) => d.isDirectory() && !/^[_.]/.test(d.name)).map((d) => '/home/claudedev/projetos/' + d.name).sort() } catch { /* sem a lista, vale a sugestão */ }
        return json(res, 200, { em: SUGESTOES.em, sugestoes: SUGESTOES.lista, repos })
      }
      if (u.pathname === '/api/cadastrar' && req.method === 'POST') {
        const d = JSON.parse(await corpoDe(req, 8192) || '{}')
        let novo; try { novo = validarAlvo(d.alvo || {}) } catch (err) { return json(res, 200, { ok: false, msg: err.message }) }
        const e = lerEstado(); const erroCodigo = usarCodigo(e, d.codigo, Date.now())
        if (erroCodigo) return json(res, 200, { ok: false, msg: erroCodigo })
        try { cadastrarAlvo(novo) } catch (err) { return json(res, 200, { ok: false, msg: err.message }) }
        SUGESTOES.em = 0
        return json(res, 200, { ok: true, msg: 'cadastrado: ' + novo.nome, id: novo.id })
      }
      if ((u.pathname === '/api/confirmar' || u.pathname === '/api/recusar') && req.method === 'POST') {
        const d = JSON.parse(await corpoDe(req) || '{}')
        return json(res, 200, decidir(String(d.id || ''), d.codigo, u.pathname.endsWith('/recusar')))
      }
      if ((u.pathname === '/deploy-seguro/confirmar' || u.pathname === '/deploy-seguro/recusar') && req.method === 'POST') {
        const f = new URLSearchParams(await corpoDe(req))
        const r = decidir(f.get('id'), f.get('codigo'), u.pathname.endsWith('/recusar'))
        res.writeHead(303, { location: '/deploy-seguro/?msg=' + encodeURIComponent(r.msg) }); return res.end()
      }
      json(res, 404, { erro: 'não existe' })
    } catch (err) { json(res, 500, { erro: err.message }) }
  })
}

function pagina(e, msg) {
  const quando = (t) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')
  const esperando = e.pedidos.filter((p) => p.estado === 'esperando')
  const rodando = e.pedidos.filter((p) => p.estado === 'rodando')
  /* 30/09, print dele: "esse design tá ruim demais". Coluna central de até
     480 px, tema claro ou escuro do aparelho, cartão em relevo como o Cockpit,
     campo do código grande e botões no tamanho normal. */
  const ESTADO = { publicado: ['publicado', 'ok'], falhou: ['falhou', 'mau'], recusado: ['recusado', 'neutro'], rodando: ['publicando', 'neutro'] }
  const cartao = (p) => `<section class="c"><div class="cab"><span class="ponto"></span><div><h2>${esc(p.nome)}</h2><p class="m">pedido por ${esc(p.de)} · ${quando(p.em)}</p></div></div>
    <dl><dt>site</dt><dd><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></dd>
    <dt>ramo</dt><dd>${esc(p.ramo || '?')}</dd><dt>último commit</dt><dd>${esc(p.commit || '?')}</dd></dl>
    ${p.arquivosSemCommit ? `<p class="aviso">${p.arquivosSemCommit} arquivo(s) mudados sem commit também vão junto</p>` : ''}
    ${p.novos ? `<details class="novos"${p.novos.length <= 5 ? ' open' : ''}><summary>o que entra (${p.novos.length} commit${p.novos.length === 1 ? '' : 's'})</summary><ul>${p.novos.map((l) => `<li>${esc(l)}</li>`).join('') || '<li>nenhum commit novo</li>'}</ul></details>` : '<p class="m">primeira publicação por aqui: sem histórico para comparar</p>'}
    <form method="post" action="/deploy-seguro/confirmar"><input type="hidden" name="id" value="${esc(p.id)}">
      <label for="c-${esc(p.id)}">código do autenticador</label>
      <input id="c-${esc(p.id)}" name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required>
      <div class="bts"><button class="pri">confirmar e publicar</button></div></form>
    <form method="post" action="/deploy-seguro/recusar" class="rec"><input type="hidden" name="id" value="${esc(p.id)}"><button class="sec">recusar este pedido</button></form></section>`
  const linha = (p) => { const [rot, cls] = ESTADO[p.estado] || [p.estado, 'neutro']; return `<li><div class="lh"><b>${esc(p.nome)}</b><span class="tag ${cls}">${esc(rot)}</span><span class="m">${quando(p.fim || p.inicio || p.em)}</span></div>${p.erro ? `<p class="aviso">${esc(p.erro)}</p>` : ''}${p.log ? `<details><summary>o que aconteceu</summary><pre>${esc(p.log)}</pre></details>` : ''}</li>` }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="${rodando.length ? 4 : 60}"><title>Deploy seguro</title>
<style>
:root{--bg:#e6e9f0;--card:#eef1f6;--txt:#1f2433;--dim:#5b6476;--borda:rgba(30,40,70,.12);--acc:#4f46e5;--ok:#15803d;--mau:#b91c1c;--alto:6px 6px 14px rgba(163,177,198,.55),-6px -6px 14px rgba(255,255,255,.9);--fundo:inset 3px 3px 7px rgba(163,177,198,.5),inset -3px -3px 7px rgba(255,255,255,.85)}
@media (prefers-color-scheme:dark){:root{--bg:#1b1f2a;--card:#212634;--txt:#e7eaf2;--dim:#9aa3b5;--borda:rgba(255,255,255,.08);--acc:#818cf8;--ok:#4ade80;--mau:#f87171;--alto:6px 6px 14px rgba(0,0,0,.45),-4px -4px 12px rgba(255,255,255,.035);--fundo:inset 3px 3px 7px rgba(0,0,0,.45),inset -3px -3px 7px rgba(255,255,255,.04)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.5 Inter,system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:480px;margin:0 auto;padding:28px 16px 40px}h1{font-size:24px;margin:0;letter-spacing:-.01em}.sub{color:var(--dim);font-size:14px;margin:4px 0 22px}
.c{background:var(--card);border-radius:18px;padding:18px;box-shadow:var(--alto);margin:0 0 18px}.cab{display:flex;gap:12px;align-items:center;margin-bottom:12px}.ponto{width:12px;height:12px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.18)}
h2{font-size:19px;margin:0}.m{color:var(--dim);font-size:13.5px;margin:0}dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 12px;font-size:14.5px}dt{color:var(--dim)}dd{margin:0;overflow-wrap:anywhere}a{color:var(--acc)}
.aviso{color:var(--mau);font-size:14px;margin:6px 0}.novos summary,details summary{cursor:pointer;color:var(--dim);font-size:14px}.novos ul{margin:8px 0 4px;padding-left:18px;font-size:14px}
label{display:block;font-size:13.5px;color:var(--dim);margin:14px 0 6px}input[name=codigo]{width:100%;font:600 30px/1 ui-monospace,monospace;letter-spacing:.42em;text-align:center;padding:14px 10px 14px 22px;border:0;border-radius:14px;background:var(--bg);color:var(--txt);box-shadow:var(--fundo);outline:none}input[name=codigo]:focus{box-shadow:var(--fundo),0 0 0 2px var(--acc)}
.bts{display:flex;justify-content:flex-end;margin-top:14px}button{font:inherit;border:0;border-radius:12px;cursor:pointer;min-height:44px;padding:0 18px}.pri{background:var(--acc);color:#fff;font-weight:600;box-shadow:var(--alto)}.rec{margin-top:6px;text-align:right}.sec{background:none;color:var(--dim);font-size:14px;text-decoration:underline;min-height:36px;padding:0 4px}
.msg{border-radius:12px;padding:12px 14px;margin:0 0 18px;background:var(--card);box-shadow:var(--alto);border-left:4px solid var(--acc)}.vazio{color:var(--dim);margin:0 0 22px}
h3{font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin:28px 0 10px}ul.h{list-style:none;margin:0;padding:0}ul.h li{background:var(--card);border-radius:14px;padding:12px 14px;margin:0 0 10px;box-shadow:var(--alto)}.lh{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.lh .m{margin-left:auto}
.tag{font-size:12px;padding:2px 9px;border-radius:999px;background:var(--bg)}.tag.ok{color:var(--ok)}.tag.mau{color:var(--mau)}pre{white-space:pre-wrap;font-size:12px;background:var(--bg);padding:10px;border-radius:10px;max-height:45vh;overflow:auto;box-shadow:var(--fundo)}
</style></head><body><main>
<h1>Deploy seguro</h1><p class="sub">Lado protegido da VPS. Nada é publicado sem o código do seu autenticador.</p>
${msg ? `<p class="msg">${esc(msg)}</p>` : ''}
${rodando.map((p) => `<section class="c"><div class="cab"><span class="ponto"></span><h2>publicando ${esc(p.nome)}…</h2></div><pre>${esc(p.log || '')}</pre></section>`).join('')}
${esperando.length ? esperando.map(cartao).join('') : (rodando.length ? '' : '<p class="vazio">Nenhum pedido esperando.</p>')}
<h3>Últimos</h3><ul class="h">${e.historico.slice(0, 10).map(linha).join('') || '<li class="m">nada ainda</li>'}</ul>
</main></body></html>`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  criarServidor().listen(PORTA, '127.0.0.1', () => console.log(`deploy seguro em 127.0.0.1:${PORTA}`))
}
