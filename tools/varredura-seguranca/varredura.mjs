// CC-923 e CC-931: varredura de segurança (OWASP ASVS 4.0, nível 1) de todos os projetos da VPS.
//
// SÓ LEITURA. Lê o que o git rastreia (git ls-files) e, para os sites com endereço, faz um GET.
// Nada é escrito fora da pasta de relatórios que quem chama indicar.
//
// Cada requisito sai com um destes resultados e SEMPRE com a prova (arquivo:linha ou cabeçalho):
//   cumpre | não cumpre | suspeito | não se aplica | não medido
// "não medido" é o que sobra quando a prova não se obtém (rede caiu, sem endereço). Nunca vira "cumpre".
//
// REGRA DE OURO: o valor de um segredo nunca sai daqui. Só arquivo, linha e o tipo.
// Arquivos .env nunca são abertos: estar rastreado já é o defeito, e o conteúdo é do dono.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RESULTADOS = ['não cumpre', 'suspeito', 'não medido', 'cumpre', 'não se aplica']

// Os que têm login e dados de pessoas vêm primeiro.
const PRIORIDADE = ['VPS_ahtleta-corrida', 'VPS_ahtleta-escalada', 'VPS_ahtleta', 'VPS_inovallbond', 'VPS_conta-de-casa', 'fibraessencia', 'VPS_fibraessencia', 'VPS_ibrics', 'VPS_profinance', 'VPS_mnzs']
const EXTRAS = ['fibraessencia'] // existe sem o prefixo, e o Felipe a pediu pelo nome
const IGNORAR = /nisaba|--|^VPS_teste/ // cópias de teste

// Endereços dos sites no ar, lidos do nginx desta VPS. Os do deploy seguro vêm de alvos.json.
const URLS_FIXAS = {
  VPS_cockpit: ['https://cockpit.carzo.com.br/'],
  VPS_ibrics: ['https://ibrics.carzo.com.br/'],
  fibraessencia: ['https://fibraessencia.carzo.com.br/'],
  VPS_fibraessencia: ['https://fibraessencia.carzo.com.br/'],
  VPS_profinance: ['https://profinance.carzo.com.br/'],
  VPS_inovallbond: ['https://inovallbond.com.br/', 'https://app.inovallbond.com.br/'],
  VPS_pierre: ['https://pierre.carzo.com.br/'],
  VPS_ahtleta: ['https://ahtleta.com.br/', 'https://app.ahtleta.com.br/'],
  VPS_coepiloto: ['https://coepiloto.carzo.com.br/'],
  VPS_dengonator2000: ['https://app.dengonator2000.carzo.com.br/'],
  VPS_ghoscode: ['https://api.ghoscode.com.br/'],
}

export function urlsDosProjetos(raizCockpit) {
  const mapa = {}
  for (const [k, v] of Object.entries(URLS_FIXAS)) mapa[k] = [...v]
  try {
    const alvos = JSON.parse(fs.readFileSync(path.join(raizCockpit, 'tools/deploy-seguro/alvos.json'), 'utf8'))
    for (const a of alvos) {
      if (!a.repo || !a.url) continue
      const nome = path.basename(a.repo)
      mapa[nome] = [...new Set([...(mapa[nome] || []), a.url])]
    }
  } catch { /* sem alvos.json, ficam só os fixos */ }
  return mapa
}

export function listarProjetos(base) {
  const nomes = fs.readdirSync(base).filter((n) => /^VPS_/.test(n) || EXTRAS.includes(n))
  const ok = []
  for (const n of nomes) {
    if (IGNORAR.test(n)) continue
    const p = path.join(base, n)
    let st
    try { st = fs.lstatSync(p) } catch { continue }
    if (st.isSymbolicLink() || !st.isDirectory()) continue
    ok.push(n)
  }
  const pos = (n) => { const i = PRIORIDADE.indexOf(n); return i < 0 ? 999 : i }
  return ok.sort((a, b) => pos(a) - pos(b) || a.localeCompare(b))
}

// ---------- leitura do repositório ----------

function git(pasta, args, timeout = 20000) {
  // safe.directory só vale para este comando: repositório de outro dono (ex. VPS_ghoscode) é lido, nunca alterado
  return execFileSync('git', ['-c', `safe.directory=${pasta}`, '-C', pasta, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout, stdio: ['ignore', 'pipe', 'ignore'] })
}

const TEXTO = /\.(m?js|cjs|jsx|tsx?|json|py|php|rb|go|java|html?|vue|svelte|sh|ya?ml|toml|conf|ini|txt|md|sql|env|cfg)$/i
const FORA = /(^|\/)(node_modules|dist[^/]*|build|\.next|\.expo|coverage|vendor|\.git)\//
const LOCKS = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|npm-shrinkwrap\.json)$/
const ehEnv = (f) => /(^|\/)\.env(\..+)?$/.test(f) || /\.env$/.test(f)
const ehModeloEnv = (f) => /\.(example|sample|template|dist)$/.test(f)
const ehTeste = (f) => /(^|\/)(tests?|__tests__|e2e|fixtures?|mocks?)\/|\.(test|spec)\.[a-z]+$|(^|\/)test[-_.]|(playwright|jest|vitest|cypress)\.config/i.test(f)
const ehComentario = (l) => /^\s*(\/\/|\/\*|\*|#)/.test(l)

function lerRepo(pasta) {
  const todos = git(pasta, ['ls-files', '-z']).split('\0').filter(Boolean)
  const arquivos = []
  for (const f of todos) {
    if (FORA.test(f) || LOCKS.test(f) || ehEnv(f) || !TEXTO.test(f) || /\.min\.|\.map$/.test(f)) continue
    try {
      const abs = path.join(pasta, f)
      const st = fs.statSync(abs)
      if (!st.isFile() || st.size === 0 || st.size > 400 * 1024) continue
      arquivos.push({ f, linhas: fs.readFileSync(abs, 'utf8').split(/\r?\n/) })
    } catch { /* arquivo apagado na árvore: ignora */ }
  }
  return { todos, arquivos }
}

const ref = (f, i) => `${f}:${i + 1}`

// Varre linhas com um regex e devolve até `max` provas "arquivo:linha".
function achar(arquivos, re, { pular = () => false, max = 8, linhaOk = () => true } = {}) {
  const provas = []
  let total = 0
  for (const { f, linhas } of arquivos) {
    if (pular(f)) continue
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]
      if (l.length > 3000) continue
      if (re.test(l) && !ehComentario(l) && linhaOk(l, f, i, linhas)) { total++; if (provas.length < max) provas.push({ f, i, l }) }
    }
  }
  return { provas, total }
}

const item = (asvs, nivel, titulo, resultado, provas, peso = 1) => ({ asvs, nivel, titulo, resultado, provas, peso })
const lista = (r, rot) => r.provas.map((p) => (rot ? `${ref(p.f, p.i)} (${typeof rot === 'function' ? rot(p) : rot})` : ref(p.f, p.i))).concat(r.total > r.provas.length ? [`e mais ${r.total - r.provas.length} ocorrência(s)`] : [])

// ---------- as checagens ----------

const SEGREDOS = [
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'chave de API (sk-)'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'chave de acesso AWS (AKIA)'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada (PEM)'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'token do GitHub'],
]
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/
const ATRIB = /(password|passwd|senha|secret|api[_-]?key|token)["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/i
const PLACEHOLDER = /(your|seu|sua|xxx|example|exemplo|changeme|troque|placeholder|fake|falso|dummy|test|process\.env|\$\{|<)/i

function segredos({ arquivos }) {
  const provas = []
  const add = (f, i, tipo) => { if (provas.length < 12) provas.push(`${ref(f, i)} (${tipo})`) }
  let total = 0
  let definitivo = 0
  for (const { f, linhas } of arquivos) {
    const teste = ehTeste(f)
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]
      for (const [re, tipo] of SEGREDOS) if (re.test(l) && !(teste && PLACEHOLDER.test(l))) { total++; definitivo++; add(f, i, tipo) }
      const j = JWT.exec(l)
      if (j) {
        let papel = ''
        try { papel = JSON.parse(Buffer.from(j[1], 'base64url').toString('utf8')).role || '' } catch { /* ignora */ }
        if (papel === 'service_role') { total++; definitivo++; add(f, i, 'chave service_role do Supabase') }
      }
      if (l.length < 400 && !teste) {
        const a = ATRIB.exec(l)
        if (a && !PLACEHOLDER.test(a[2]) && !/^[A-Z_]+$/.test(a[2])) { total++; add(f, i, 'atribuição literal a nome de segredo, suspeito') }
      }
    }
  }
  return { provas, total, definitivo }
}

function checarSegredos(repo) {
  const s = segredos(repo)
  const extra = s.total > s.provas.length ? [`e mais ${s.total - s.provas.length} ocorrência(s)`] : []
  if (s.definitivo) return item('V2.10.4', 1, 'nenhum segredo (chave, token, chave privada) dentro do repositório', 'não cumpre', [...s.provas, ...extra], 10)
  if (s.total) return item('V2.10.4', 1, 'nenhum segredo (chave, token, chave privada) dentro do repositório', 'suspeito', [...s.provas, ...extra], 6)
  return item('V2.10.4', 1, 'nenhum segredo (chave, token, chave privada) dentro do repositório', 'cumpre', [`${repo.arquivos.length} arquivo(s) de texto lidos, nenhum padrão de segredo`], 1)
}

function checarEnv(pasta, repo) {
  const rast = repo.todos.filter((f) => ehEnv(f) && !ehModeloEnv(f))
  const itens = []
  itens.push(rast.length
    ? item('V2.10.4', 1, 'arquivo .env fora do controle de versão', 'não cumpre', rast.map((f) => `${f} está rastreado pelo git (o conteúdo não foi aberto)`), 9)
    : item('V2.10.4', 1, 'arquivo .env fora do controle de versão', 'cumpre', ['git ls-files não lista nenhum .env real'], 1))
  // .env no .gitignore: raiz e cada pasta com package.json
  const dirs = new Set([''])
  for (const f of repo.todos) if (/(^|\/)package\.json$/.test(f) && !FORA.test(f)) dirs.add(path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f))
  const sem = []
  for (const d of dirs) {
    const alvo = d ? `${d}/.env` : '.env'
    try { git(pasta, ['check-ignore', '-q', alvo]) } catch { sem.push(alvo) }
  }
  itens.push(sem.length
    ? item('V2.10.4', 1, '.env ignorado pelo .gitignore', 'não cumpre', sem.map((a) => `git check-ignore ${a}: não ignorado (.gitignore na raiz ou em ${path.posix.dirname(a)})`).slice(0, 6), 5)
    : item('V2.10.4', 1, '.env ignorado pelo .gitignore', 'cumpre', [`git check-ignore confirma .env ignorado em ${dirs.size} pasta(s)`], 1))
  // já foi commitado alguma vez?
  let hist = []
  try {
    hist = [...new Set(git(pasta, ['log', '--all', '--diff-filter=A', '--name-only', '--format=', '--', ':(glob)**/.env', ':(glob)**/.env.*']).split('\n').filter((f) => f && !ehModeloEnv(f)))]
  } catch { itens.push(item('V2.10.4', 1, '.env nunca entrou no histórico do git', 'não medido', ['git log falhou ou estourou o tempo'], 1)); return itens }
  itens.push(hist.length
    ? item('V2.10.4', 1, '.env nunca entrou no histórico do git', 'suspeito', hist.slice(0, 6).map((f) => `${f} já foi adicionado em algum commit (git log --diff-filter=A); o conteúdo continua no histórico mesmo apagado hoje`), 7)
    : item('V2.10.4', 1, '.env nunca entrou no histórico do git', 'cumpre', ['git log --all não mostra nenhum .env adicionado'], 1))
  return itens
}

const HASH_FRACO = /createHash\(\s*["'`](md5|sha1|sha-1)["'`]\)|\b(md5|sha1)\s*\(|hashlib\.(md5|sha1)|password_hash\([^)]*PASSWORD_(DEFAULT|BCRYPT)/i
const HASH_FORTE = /\b(bcrypt|bcryptjs|argon2|scrypt|scryptSync|pbkdf2|pbkdf2Sync|password_hash)\b/i
const DELEGADO = /signInWithPassword|signUp\(|createUserWithEmailAndPassword|signInWithEmailAndPassword|clerk|auth0|next-auth|NextAuth/i

function checarSenha({ arquivos }) {
  return [checarTamanhoSenha(arquivos), checarHashSenha(arquivos)]
}

const codigoDe = (arquivos) => arquivos.filter((a) => /\.(m?js|cjs|jsx|tsx?|py|php|rb|go|java)$/.test(a.f) && !ehTeste(a.f))
const temLogin = (codigo) => achar(codigo, /(login|signin|sign_in|authenticate|autentic)/i, { max: 1 }).total && achar(codigo, /(password|senha)/i, { max: 1 }).total

// V2.1.1: senha com no mínimo 12 caracteres. A prova é o número escrito no código que valida o tamanho.
function checarTamanhoSenha(arquivos) {
  const T = 'senha exige no mínimo 12 caracteres'
  const codigo = codigoDe(arquivos)
  if (!temLogin(codigo)) return item('V2.1.1', 1, T, 'não se aplica', ['nenhum código de login com senha encontrado nos arquivos rastreados'], 1)
  const achados = []
  for (const { f, linhas } of codigo) {
    linhas.forEach((l, i) => {
      if (ehComentario(l) || l.length > 400) return
      let m = /(password|senha|passwd)\w*\)?\.length\s*(<=?|<)\s*(\d+)/i.exec(l)
      if (m) return achados.push({ f, i, n: m[2] === '<=' ? +m[3] + 1 : +m[3] })
      m = /(password|senha|passwd)\w*[^\n]{0,40}(minLength|\.min\()\s*[:(]?\s*(\d+)/i.exec(l)
      if (m) achados.push({ f, i, n: +m[3] })
    })
  }
  if (!achados.length) return item('V2.1.1', 1, T, 'não medido', ['há login com senha, mas nenhuma validação de tamanho foi reconhecida no código (pode estar no provedor de login)'], 3)
  const curtos = achados.filter((a) => a.n < 12)
  if (curtos.length) return item('V2.1.1', 1, T, 'não cumpre', curtos.slice(0, 6).map((a) => `${ref(a.f, a.i)} aceita senha de ${a.n} caracteres (o mínimo do ASVS é 12)`), 6)
  return item('V2.1.1', 1, T, 'cumpre', achados.slice(0, 3).map((a) => `${ref(a.f, a.i)} exige ${a.n} caracteres ou mais`), 1)
}

function checarHashSenha(arquivos) {
  const T = 'senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)'
  const codigo = codigoDe(arquivos)
  const login = achar(codigo, /(login|signin|sign_in|authenticate|autentic)/i, { max: 1 })
  if (!temLogin(codigo)) return item('V2.4.1', 2, T, 'não se aplica', ['nenhum código de login com senha encontrado nos arquivos rastreados'], 1)
  // md5/sha1 só conta perto de "senha": a linha ou as 3 anteriores falam de password
  const fraco = achar(codigo, HASH_FRACO, { linhaOk: (l, f, i, ls) => /(password|senha|passwd|\bpw\b)/i.test(ls.slice(Math.max(0, i - 3), i + 2).join('\n')) })
  if (fraco.total) return item('V2.4.1', 2, T, 'não cumpre', lista(fraco, 'hash fraco perto de código de senha'), 9)
  const forte = achar(codigo, HASH_FORTE, { max: 3 })
  if (forte.total) return item('V2.4.1', 2, T, 'cumpre', lista(forte, 'hash forte'), 1)
  const deleg = achar(codigo, DELEGADO, { max: 3 })
  if (deleg.total) return item('V2.4.1', 2, T, 'não se aplica', lista(deleg, 'senha tratada pelo provedor de login, fora deste código'), 1)
  return item('V2.4.1', 2, T, 'não medido', [`há login com senha (${ref(login.provas[0].f, login.provas[0].i)}) mas nenhum hash conhecido nem provedor de login foi reconhecido`], 4)
}

function janela(linhas, i) { return linhas.slice(i, i + 9).join('\n') }

function checarCookies({ arquivos }) {
  const codigo = arquivos.filter((a) => /\.(m?js|cjs|jsx|tsx?|py|php|html?)$/.test(a.f) && !ehTeste(a.f))
  const sites = []
  for (const { f, linhas } of codigo) {
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]
      if (l.length > 3000) continue
      if (/\b(res|reply|response|ctx)\.cookie\(|cookies\(\)\.set\(|cookies\.set\(|\.setCookie\(/.test(l)) sites.push({ f, i, tipo: 'servidor', texto: janela(linhas, i) })
      else if (/Set-Cookie/i.test(l) && /(setHeader|header|append|set\()/i.test(l)) sites.push({ f, i, tipo: 'servidor', texto: janela(linhas, i) })
      else if (/document\.cookie\s*=/.test(l)) sites.push({ f, i, tipo: 'navegador', texto: l })
    }
  }
  // "secure: process.env.NODE_ENV === 'production'" conta: o atributo está lá, só não vale em http de desenvolvimento
  const alvo = [['V3.4.1', 'Secure', /secure\s*[:=]\s*(?!false\b|0\b|!1)\S|;\s*secure/i], ['V3.4.2', 'HttpOnly', /httponly\s*[:=]\s*(?!false\b|0\b|!1)\S|;\s*httponly/i], ['V3.4.3', 'SameSite', /samesite\s*[:=]\s*["'`]?(strict|lax)|;\s*samesite=(strict|lax)/i]]
  return alvo.map(([asvs, nome, re]) => {
    const T = `cookie definido pelo código com o atributo ${nome}`
    if (!sites.length) return item(asvs, 1, T, 'não se aplica', ['nenhum cookie é definido no código rastreado'], 1)
    const faltam = sites.filter((s) => !re.test(s.texto) && !(nome === 'HttpOnly' && s.tipo === 'navegador'))
    const deNavegador = nome === 'HttpOnly' ? sites.filter((s) => s.tipo === 'navegador') : []
    if (faltam.length) return item(asvs, 1, T, 'não cumpre', faltam.slice(0, 8).map((s) => `${ref(s.f, s.i)} define cookie sem ${nome}`).concat(faltam.length > 8 ? [`e mais ${faltam.length - 8}`] : []), 8)
    if (deNavegador.length) return item(asvs, 1, T, 'suspeito', deNavegador.slice(0, 6).map((s) => `${ref(s.f, s.i)} escreve cookie por document.cookie, que o JavaScript sempre enxerga; confirme que não é de sessão`), 5)
    return item(asvs, 1, T, 'cumpre', sites.slice(0, 4).map((s) => `${ref(s.f, s.i)} traz ${nome}`), 1)
  })
}

const SQL_VERBO = /\b(SELECT\s.+\sFROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)\b/i
const SQL_CONCAT = /\$\{[^}]+\}|["'`]\s*\+\s*[A-Za-z_]|[A-Za-z_\])]\s*\+\s*["'`]|%s|\.format\(|f["'].*\{/
const SQL_PARAM = /\$\d+|\?\s*[,)]|:\w+|@\w+/

function checarSql({ arquivos }) {
  const T = 'consulta ao banco com parâmetros, nunca montada por concatenação de texto'
  const codigo = arquivos.filter((a) => /\.(m?js|cjs|jsx|tsx?|py|php|rb|go|java)$/.test(a.f) && !ehTeste(a.f))
  const sql = achar(codigo, SQL_VERBO, { max: 3, linhaOk: (l) => /["'`]/.test(l) && !/^\s*(\/\/|\*|#)/.test(l) })
  if (!sql.total) return item('V5.3.4', 1, T, 'não se aplica', ['nenhuma consulta SQL no código rastreado'], 1)
  const conc = achar(codigo, SQL_VERBO, { max: 8, linhaOk: (l) => /["'`]/.test(l) && !/^\s*(\/\/|\*|#)/.test(l) && SQL_CONCAT.test(l) })
  if (conc.total) return item('V5.3.4', 1, T, 'suspeito', lista(conc, (p) => (SQL_PARAM.test(p.l) ? 'valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa' : 'consulta montada com texto variável, heurística: confira se o valor vem do usuário')), 7)
  const par = achar(codigo, SQL_VERBO, { max: 3, linhaOk: (l) => SQL_PARAM.test(l) })
  return item('V5.3.4', 1, T, 'cumpre', par.total ? lista(par, 'consulta com parâmetro') : lista(sql, 'consulta sem texto variável'), 1)
}

function checarEval({ arquivos }) {
  const T = 'sem eval() nem execução dinâmica de código'
  const r = achar(arquivos.filter((a) => /\.(m?js|cjs|jsx|tsx?|py|php)$/.test(a.f) && !ehTeste(a.f)), /(^|[^\w.$])eval\(|new Function\(/, { linhaOk: (l) => !/^\s*(\/\/|\*|#)/.test(l) })
  return r.total ? item('V5.2.4', 1, T, 'suspeito', lista(r, 'eval ou new Function'), 4) : item('V5.2.4', 1, T, 'cumpre', ['nenhum eval() nem new Function() no código rastreado'], 1)
}

function checarCors({ arquivos }) {
  const T = 'CORS com lista de origens, não com asterisco'
  const r = achar(arquivos.filter((a) => /\.(m?js|cjs|jsx|tsx?|py|php|conf)$/.test(a.f) && !ehTeste(a.f)), /Access-Control-Allow-Origin["'`]?\s*[,:=]\s*["'`]\*["'`]|origin\s*:\s*["'`]\*["'`]/i)
  return r.total ? item('V14.5.3', 1, T, 'suspeito', lista(r, 'origem liberada para todos; ok só se a rota for pública de propósito'), 5) : item('V14.5.3', 1, T, 'cumpre', ['nenhum Access-Control-Allow-Origin com asterisco no código rastreado'], 1)
}

function checarLock(repo) {
  const T = 'dependências travadas por lockfile (base do V14.2.1)'
  const pacotes = repo.todos.filter((f) => /(^|\/)package\.json$/.test(f) && !FORA.test(f))
  if (!pacotes.length) return item('V14.2.1', 1, T, 'não se aplica', ['nenhum package.json rastreado'], 1)
  const lockDe = (dir) => {
    for (let d = dir; ; d = path.posix.dirname(d)) {
      if (repo.todos.some((f) => LOCKS.test(f) && path.posix.dirname(f) === d)) return true
      if (d === '.') return false
    }
  }
  const com = [], sem = []
  for (const p of pacotes) {
    let j = {}
    try { j = JSON.parse(fs.readFileSync(path.join(repo.pasta, p), 'utf8')) } catch { /* ilegível */ }
    if (!Object.keys({ ...j.dependencies, ...j.devDependencies }).length) continue // sem dependência: nada a travar
    ;(lockDe(path.posix.dirname(p)) ? com : sem).push(p)
  }
  if (sem.length) return item('V14.2.1', 1, T, 'não cumpre', sem.slice(0, 6).map((p) => `${p} declara dependências e nenhum lockfile está rastreado ao lado dele nem acima`), 5)
  if (!com.length) return item('V14.2.1', 1, T, 'não se aplica', ['os package.json rastreados não declaram dependência nenhuma'], 1)
  return item('V14.2.1', 1, T, 'cumpre', com.slice(0, 4).map((p) => `${p} tem lockfile rastreado`), 1)
}

// ---------- cabeçalhos HTTP (CC-931) ----------

const CAB = [
  ['V14.4.5', 'Strict-Transport-Security (HSTS)', (h) => h.get('strict-transport-security'), (v) => /max-age=\d+/i.test(v) && !/max-age=0\b/i.test(v), 'Strict-Transport-Security'],
  ['V14.4.4', 'X-Content-Type-Options: nosniff', (h) => h.get('x-content-type-options'), (v) => v.split(',').every((x) => x.trim().toLowerCase() === 'nosniff'), 'X-Content-Type-Options'], // "nosniff, nosniff" (duas camadas enviando) vale: o navegador lê o primeiro
  ['V14.4.7', 'frame-ancestors (CSP) ou X-Frame-Options', (h) => [h.get('content-security-policy'), h.get('x-frame-options')].filter(Boolean).join(' | '), (v) => /frame-ancestors|(^|\|\s*)(deny|sameorigin)/i.test(v), 'frame-ancestors/X-Frame-Options'],
]

export async function medirCabecalhos(urls, { fetchFn = fetch, tempo = 8000 } = {}) {
  const medidas = []
  for (const url of urls) {
    try {
      const r = await fetchFn(url, { redirect: 'manual', signal: AbortSignal.timeout(tempo), headers: { 'user-agent': 'ogumia-varredura/1' } })
      medidas.push({ url, status: r.status, headers: r.headers })
    } catch (e) { medidas.push({ url, erro: e?.cause?.code || e?.name || 'falha' }) }
  }
  return medidas
}

export function itensDeCabecalhos(medidas) {
  return CAB.map(([asvs, titulo, pega, ok, nome]) => {
    const T = `resposta HTTPS traz ${titulo}`
    if (!medidas.length) return item(asvs, 1, T, 'não medido', ['este projeto não tem endereço conhecido no painel, nada foi pedido'], 1)
    const provas = []
    let falta = 0, falha = 0, bom = 0
    for (const m of medidas) {
      if (m.erro) { falha++; provas.push(`${m.url}: sem resposta (${m.erro}), não medido`); continue }
      const v = pega(m.headers) || ''
      if (v && ok(v)) { bom++; provas.push(`${m.url} respondeu ${m.status} com ${nome}: ${v.slice(0, 120)}`) } else { falta++; provas.push(`${m.url} respondeu ${m.status} sem ${nome}${v ? ` (recebido: ${v.slice(0, 80)})` : ''}`) }
    }
    const res = falta ? 'não cumpre' : falha ? 'não medido' : 'cumpre'
    return item(asvs, 1, T, res, provas, falta ? 6 : 1)
  })
}

// ---------- orquestração ----------

export async function varrerProjeto({ nome, pasta, urls = [], medir = true, fetchFn }) {
  const base = { projeto: nome, pasta, urls, itens: [] }
  let repo
  try {
    repo = { ...lerRepo(pasta), pasta }
  } catch (e) {
    return { ...base, erro: `não consegui ler o repositório (${String(e.message).split('\n')[0]})`, itens: [] }
  }
  const itens = [checarSegredos(repo), ...checarEnv(pasta, repo), ...checarSenha(repo), ...checarCookies(repo), checarSql(repo), checarEval(repo), checarCors(repo), checarLock(repo)]
  const medidas = medir ? await medirCabecalhos(urls, { fetchFn }) : urls.map((url) => ({ url, erro: 'medição desligada' }))
  itens.push(...itensDeCabecalhos(medidas))
  return { ...base, arquivos: repo.arquivos.length, itens }
}

export function contar(r) {
  const c = Object.fromEntries(RESULTADOS.map((x) => [x, 0]))
  for (const i of r.itens) c[i.resultado]++
  return c
}

export function pior(r) {
  for (const res of ['não cumpre', 'suspeito']) {
    const ruins = r.itens.filter((i) => i.resultado === res).sort((a, b) => b.peso - a.peso)
    if (ruins.length) return { ...ruins[0], rotulo: res }
  }
  return null
}

const NIVEL = { 1: 'nível 1', 2: 'nível 2 no catálogo' }

export function relatorioMarkdown(r, data = new Date().toISOString().slice(0, 10)) {
  const c = contar(r)
  const titulo = r.erro ? `${r.projeto}: a varredura não conseguiu ler o repositório`
    : c['não cumpre'] ? `${r.projeto}: ${c['não cumpre']} requisito(s) não cumprem`
      : c.suspeito ? `${r.projeto}: nada falhou, mas ${c.suspeito} ponto(s) pedem conferência`
        : `${r.projeto}: nenhum requisito medido falhou`
  const o = [`# ${titulo}`, '', `Varredura automática do OWASP ASVS 4.0, só leitura, em ${data}. Gerada por \`node cc.mjs seguranca varrer\`. Não edite à mão.`, '']
  if (r.erro) return o.concat([r.erro, '']).join('\n')
  o.push(`Lidos ${r.arquivos} arquivo(s) de texto rastreados pelo git. ${r.urls.length ? `Endereços medidos: ${r.urls.join(', ')}.` : 'Sem endereço conhecido: os cabeçalhos HTTP não foram medidos.'}`, '')
  o.push(`Placar: ${RESULTADOS.map((x) => `${c[x]} ${x}`).join(', ')}.`, '')
  const secoes = [['não cumpre', 'O que não cumpre'], ['suspeito', 'O que é suspeito e pede conferência'], ['não medido', 'O que não foi medido'], ['cumpre', 'O que cumpre'], ['não se aplica', 'O que não se aplica']]
  for (const [res, tit] of secoes) {
    const is = r.itens.filter((i) => i.resultado === res)
    if (!is.length) continue
    o.push(`## ${tit}`, '')
    for (const i of is) {
      o.push(`- **${i.asvs}** (${NIVEL[i.nivel]}): ${i.titulo}`)
      for (const p of i.provas) o.push(`  - ${p}`)
    }
    o.push('')
  }
  o.push('## Como ler', '', '- "Suspeito" é heurística: o código pode estar certo. Quem confere é gente.', '- "Não medido" nunca vale como "cumpre".', '- O valor de qualquer segredo achado não aparece aqui, só arquivo, linha e tipo.', '')
  return o.join('\n')
}

export function resumoMarkdown(rs, data = new Date().toISOString().slice(0, 10)) {
  const soma = (x) => rs.reduce((n, r) => n + (r.itens ? contar(r)[x] : 0), 0)
  const o = ['# Segurança dos projetos: o que a varredura ASVS achou', '', `Varredura de ${data}, ${rs.length} projeto(s), só leitura. Um relatório por projeto nesta pasta. Gerada por \`node cc.mjs seguranca varrer\`.`, '', `Total: ${soma('não cumpre')} não cumprem, ${soma('suspeito')} suspeitos, ${soma('não medido')} não medidos.`, '', '| Projeto | Não cumprem | Suspeitos | Pior achado |', '| --- | ---: | ---: | --- |']
  for (const r of rs) {
    if (r.erro) { o.push(`| [${r.projeto}](${r.projeto}.md) | n/d | n/d | ${r.erro} |`); continue }
    const c = contar(r), p = pior(r)
    const piorTxt = p ? `${p.asvs} ${p.titulo}: ${p.provas[0]} (${p.rotulo})`.replace(/\|/g, '/') : 'nenhum'
    o.push(`| [${r.projeto}](${r.projeto}.md) | ${c['não cumpre']} | ${c.suspeito} | ${piorTxt} |`)
  }
  o.push('', 'Os cabeçalhos HTTP que faltam no nginx têm o passo a passo em [nginx-cabecalhos.md](nginx-cabecalhos.md).', '')
  return o.join('\n')
}

export function escrever(rs, destino, data) {
  fs.mkdirSync(destino, { recursive: true })
  for (const r of rs) fs.writeFileSync(path.join(destino, `${r.projeto}.md`), relatorioMarkdown(r, data))
  fs.writeFileSync(path.join(destino, 'README.md'), resumoMarkdown(rs, data))
}

export async function varrer({ base, raizCockpit, destino, so = null, medir = true, fetchFn, urls = null, aoAndar = () => {} } = {}) {
  let nomes = listarProjetos(base)
  if (so) {
    const alvo = nomes.filter((n) => n === so || n === 'VPS_' + so)
    if (!alvo.length) throw new Error(`projeto "${so}" não encontrado entre: ${nomes.join(', ')}`)
    nomes = alvo
  }
  const mapa = urls || urlsDosProjetos(raizCockpit)
  const rs = []
  for (const nome of nomes) {
    const r = await varrerProjeto({ nome, pasta: path.join(base, nome), urls: mapa[nome] || [], medir, fetchFn })
    rs.push(r)
    aoAndar(r)
  }
  // varredura parcial (--projeto) não pode apagar o resumo dos outros: só reescreve o README se a varredura é completa
  if (destino) {
    if (so) { fs.mkdirSync(destino, { recursive: true }); for (const r of rs) fs.writeFileSync(path.join(destino, `${r.projeto}.md`), relatorioMarkdown(r)) } else escrever(rs, destino)
  }
  return rs
}

// uso direto: node tools/varredura-seguranca/varredura.mjs [--projeto X]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const i = process.argv.indexOf('--projeto')
  const rs = await varrer({ base: path.join(os.homedir(), 'projetos'), raizCockpit: raiz, destino: path.join(raiz, 'docs/seguranca'), so: i > 0 ? process.argv[i + 1] : null })
  for (const r of rs) console.log(`${r.projeto}: ${r.erro || JSON.stringify(contar(r))}`)
}
