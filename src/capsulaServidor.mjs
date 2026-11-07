/* CC-1080, passo 3: a configuração de servidor do projeto (nginx, domínios, PM2, unidades de usuário, cron).
 *
 * SÓ LÊ. Nunca grava em /etc, /opt nem /var/www, nunca roda nginx, certbot, systemctl nem pm2 start/stop. As únicas
 * chamadas de programa são `pm2 jlist` e `crontab -l` (as duas só listam; CC_PM2_BIN e CC_CRONTAB_BIN trocam o binário, e
 * CC_NGINX_DIR e CC_UNIT_DIR trocam as pastas, para o teste do painel não tocar a máquina de verdade). Tudo que toca o sistema entra por um leitor
 * INJETÁVEL (pasta do nginx, comando do pm2, crontab, pasta de unidades), para o teste usar cópias falsas.
 *
 * Três promessas, todas conferidas em test-capsula.mjs:
 *  1. Certificado e chave privada NUNCA são lidos: o leitor padrão recusa /etc/letsencrypt, *.key, *.pem e /private/. Do
 *     certificado só sai o NOME do domínio (da linha ssl_certificate do bloco), e a restauração reemite com o certbot.
 *  2. Nenhum valor de variável de ambiente ou segredo em claro vai para a cápsula: do PM2 só o NOME das variáveis; em unidade,
 *     cron e nginx o valor vira "***". O arquivo que o bloco aponta como segredo (auth_basic_user_file, EnvironmentFile)
 *     não é copiado para a pasta servidor/: vai separado, para entrar só no segredos.tar.gpg (ver capsula.mjs).
 *  3. Ligação incerta é "candidato" com o motivo, nunca certeza. Só o "certo" é instalado pela restauração por padrão.
 *
 * Lacuna do site publicado: a pasta do `root` e de cada `alias` que fica FORA do projeto (por exemplo /var/www/<site>) entra na
 * cápsula como `publicado/<caminho codificado>.tar.gz`. Só leitura (ver capsulaPastas.mjs). A pasta de bloco "candidato" só entra
 * com `incluirCandidatos`. Domínio citado em 3 ou mais projetos (ruído, como o de teste) não vira candidato por citação.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import * as Pa from './capsulaPastas.mjs'

export const PRECISA_ROOT = 'não coletado, precisa de root'
export const PROIBIDO = /\/etc\/letsencrypt|privkey|\.key$|\.pem$|\/private(\/|$)/i
const erro = (codigo, msg) => Object.assign(new Error(msg), { codigo })
const unicos = (a) => [...new Set(a)]
const semAspas = (s) => String(s).replace(/^["']|["']$/g, '')
const seguro = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '_').slice(0, 80) || 'x'
const campo = (s) => String(s).replace(/[\t\r\n]+/g, ' ')

/** O leitor de verdade. Qualquer caminho de certificado ou chave é barrado aqui, antes de chegar ao disco. */
export function leitorPadrao() {
  const barra = (p) => { if (PROIBIDO.test(String(p))) throw erro('PROIBIDO', `recusei ler ${p}: certificado e chave privada nunca são lidos`) }
  return {
    ler(p) { barra(p); return fs.readFileSync(p, 'utf8') },
    listar(d) { barra(d); return fs.readdirSync(d) },
    real(p) { barra(p); return fs.realpathSync(p) },
    pode(p) { barra(p); try { fs.accessSync(p, fs.constants.R_OK); return true } catch { return false } },
  }
}

/** `pm2 jlist` do usuário que roda (o que ele enxerga). Só lista. */
export function pm2Padrao() {
  const r = spawnSync(process.env.CC_PM2_BIN || 'pm2', ['jlist'], { encoding: 'utf8', timeout: 20000, maxBuffer: 64 * 1024 * 1024 })
  if (r.error) return { ok: false, motivo: r.error.code === 'ENOENT' ? 'o pm2 não está instalado aqui' : r.error.message }
  if (r.status !== 0) return { ok: false, motivo: `pm2 jlist saiu com código ${r.status}` }
  const i = String(r.stdout).indexOf('[')
  try { return { ok: true, lista: JSON.parse(String(r.stdout).slice(i)) } } catch { return { ok: false, motivo: 'pm2 jlist devolveu algo que não é JSON' } }
}

/** `crontab -l` do usuário. Sem crontab não é erro. */
export function crontabPadrao() {
  const r = spawnSync(process.env.CC_CRONTAB_BIN || 'crontab', ['-l'], { encoding: 'utf8', timeout: 10000 })
  if (r.error) return { ok: false, motivo: r.error.code === 'ENOENT' ? 'o crontab não está instalado aqui' : r.error.message }
  if (r.status !== 0) return { ok: true, texto: '' }
  return { ok: true, texto: r.stdout }
}

// ---- o projeto: portas que ele usa e o texto onde procurar domínios -------------------------------------------------------------------

const IGNORAR_DIR = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.cache', 'coverage', '.venv', 'venv', '__pycache__', '.turbo', 'target', 'vendor', '.nuxt', '.svelte-kit', '.pnpm-store'])
const EXT_TEXTO = /\.(md|json|ya?ml|js|mjs|cjs|ts|tsx|jsx|txt|conf|sh|toml|html)$/i
const ehEnv = (n) => n === '.env' || (n.startsWith('.env.') && !/\.(example|sample|template)$/i.test(n))
const PORTA_OK = (n) => Number.isInteger(n) && n >= 1024 && n <= 65535

/** Anda no projeto (sem seguir atalhos, com teto) e devolve as portas e o texto minúsculo dos arquivos que não são segredo.
 *  Do `.env` só se tira o NOME da variável que termina em PORT e o número da porta; o resto do arquivo nunca é guardado. */
export function lerProjeto(pasta, { maxArquivos = 3000, maxBytes = 16e6, maxProf = 4 } = {}) {
  const portas = new Map()
  const textos = []
  let n = 0, bytes = 0
  const porta = (num, certeza, origem) => {
    num = Number(num); if (!PORTA_OK(num)) return
    const p = portas.get(num) || { porta: num, certeza, origem: [] }
    if (certeza === 'certo') p.certeza = 'certo'
    if (!p.origem.includes(origem)) p.origem.push(origem)
    portas.set(num, p)
  }
  const ir = (dir, rel, prof) => {
    let ents
    try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      const r = rel ? `${rel}/${e.name}` : e.name
      const abs = path.join(dir, e.name)
      if (e.isSymbolicLink()) continue
      if (e.isDirectory()) { if (!IGNORAR_DIR.has(e.name) && !e.name.startsWith('.next') && prof < maxProf) ir(abs, r, prof + 1); continue }
      if (!e.isFile() || n >= maxArquivos) continue
      let st; try { st = fs.statSync(abs) } catch { continue }
      if (ehEnv(e.name)) {
        let t; try { t = fs.readFileSync(abs, 'utf8') } catch { continue }
        for (const l of t.split(/\r?\n/)) {
          const m = /^\s*(?:export\s+)?([A-Z0-9_]*PORT)\s*=\s*["']?(\d{2,5})["']?\s*(?:#.*)?$/.exec(l)
          if (m) porta(m[2], 'certo', `${r}, variável ${m[1]}`)
        }
        continue
      }
      if (e.name.startsWith('.env')) continue
      if (!EXT_TEXTO.test(e.name) || st.size > 200 * 1024 || bytes + st.size > maxBytes) continue
      let t; try { t = fs.readFileSync(abs, 'utf8') } catch { continue }
      n++; bytes += st.size
      textos.push({ arq: r, t: t.toLowerCase() })
      if (e.name === 'package.json') {
        let sc = {}; try { sc = JSON.parse(t).scripts || {} } catch { /* package.json quebrado: só o texto vale */ }
        for (const [k, v] of Object.entries(sc)) for (const m of String(v).matchAll(/(?:--port[ =]|-p[ =]?|PORT=)(\d{2,5})\b/g)) porta(m[1], 'candidato', `${r}, scripts.${k}`)
      } else if (/^ecosystem\.config\./.test(e.name)) {
        for (const m of t.matchAll(/\bPORT['"]?\s*[:=]\s*['"]?(\d{2,5})/g)) porta(m[1], 'candidato', `${r}, PORT`)
      }
    }
  }
  ir(pasta, '', 0)
  return { portas, textos, lidos: n }
}

/** Quantos OUTROS projetos (as pastas irmãs da pasta do projeto) citam o domínio. Lê só texto pequeno de cada um, sem segredo,
 *  e só quando alguém pergunta. ponytail: só enxerga as pastas irmãs; upgrade: o registro de projetos. */
export function citacoesEmOutros(raiz) {
  let textos = null
  return (dominio) => {
    if (!textos) {
      textos = []
      const pai = path.dirname(raiz)
      const vistos = new Set([raiz])
      let ents = []
      try { ents = fs.readdirSync(pai, { withFileTypes: true }) } catch { /* sem pasta pai legível: nenhum outro */ }
      for (const e of ents) {
        if (!e.isDirectory() || e.name.startsWith('.')) continue
        const abs = path.join(pai, e.name)
        let rr = abs; try { rr = fs.realpathSync(abs) } catch { continue }
        if (vistos.has(rr) || vistos.has(abs)) continue
        vistos.add(rr)
        textos.push(lerProjeto(abs, { maxArquivos: 600, maxBytes: 4e6, maxProf: 3 }).textos)
      }
    }
    return textos.filter((ts) => ts.some((x) => x.t.includes(dominio))).length
  }
}

// ---- nginx --------------------------------------------------------------------------------------------------------------------------

/** Tira os comentários (# até o fim da linha) fora de aspas. */
function limpar(s) {
  let o = '', q = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) { o += c; if (c === '\\') o += s[++i] ?? ''; else if (c === q) q = null; continue }
    if (c === '"' || c === "'") { q = c; o += c; continue }
    if (c === '#') { while (i < s.length && s[i] !== '\n') i++; o += '\n'; continue }
    o += c
  }
  return o
}

/** Os blocos de nível mais alto: `server { }`, `upstream x { }`. Com o texto original (comentários dentro) e o corpo limpo. */
export function blocosTopo(t) {
  const out = []
  let i = 0, prof = 0, cab = '', cabIni = -1, corpoIni = -1
  while (i < t.length) {
    const c = t[i]
    if (c === '#') { while (i < t.length && t[i] !== '\n') i++; continue }
    if (c === '"' || c === "'") {
      const q = c; i++
      while (i < t.length && t[i] !== q) { if (t[i] === '\\') i++; i++ }
      if (prof === 0) { if (cabIni < 0) cabIni = i; cab += ' x ' }
      i++; continue
    }
    if (c === '{') { if (prof === 0) { corpoIni = i + 1; if (cabIni < 0) cabIni = i }; prof++; i++; continue }
    if (c === '}') {
      prof--
      if (prof === 0) {
        out.push({ cab: cab.trim().replace(/\s+/g, ' '), ini: cabIni, fim: i + 1, corpo: limpar(t.slice(corpoIni, i)) })
        cab = ''; cabIni = -1
      }
      if (prof < 0) prof = 0
      i++; continue
    }
    if (prof === 0) {
      if (c === ';') { cab = ''; cabIni = -1 } else { if (cabIni < 0 && !/\s/.test(c)) cabIni = i; cab += c }
    }
    i++
  }
  return out
}

const declaracoes = (corpo) => corpo.split(/[;{}]/).map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+/))

function analisarServer(corpo) {
  const b = { nomes: [], listen: [], proxy: [], caminhos: [], certs: [], chaves: 0, auth: [], incs: [] }
  for (const [d, ...a] of declaracoes(corpo)) {
    if (d === 'server_name') b.nomes.push(...a.map((x) => semAspas(x).toLowerCase()))
    else if (d === 'listen') b.listen.push(a.join(' '))
    else if (d === 'proxy_pass' && a[0]) b.proxy.push(semAspas(a[0]))
    else if ((d === 'root' || d === 'alias') && a[0]) b.caminhos.push({ dir: d, valor: semAspas(a[0]).replace(/(.)\/+$/, '$1') })
    else if (d === 'ssl_certificate' && a[0]) b.certs.push(semAspas(a[0]))
    else if (d === 'ssl_certificate_key') b.chaves++
    else if ((d === 'auth_basic_user_file' || d === 'ssl_password_file') && a[0]) b.auth.push(semAspas(a[0]))
    else if (d === 'include' && a[0]) b.incs.push(semAspas(a[0]))
  }
  return b
}

const dentro = (pai, filho) => filho === pai || filho.startsWith(pai.endsWith('/') ? pai : pai + '/')
const nomeValido = (n) => n !== '_' && !n.startsWith('~') && n.includes('.') && !/[$\s]/.test(n)

/** As portas locais que um proxy_pass alcança (resolvendo `upstream`). Host remoto não conta. */
function portasDoAlvo(alvo, upstreams) {
  const m = /^[a-z]+:\/\/(\[[^\]]+\]|[^/:\s]+)(?::(\d+))?/i.exec(alvo)
  if (!m) return []
  const host = m[1].toLowerCase()
  if (m[2]) return ['127.0.0.1', 'localhost', '[::1]', '0.0.0.0', '[::]'].includes(host) ? [Number(m[2])] : []
  return upstreams.get(host) || []
}

const SEGREDO_NOME = /(authorization|api[-_]?key|x-api|token|secret|passw|senha|credential)/i
/** Linha de nginx que carrega segredo em claro (cabeçalho de autorização, token em variável): o valor vira ***. */
function redigirConf(texto) {
  const redigidos = []
  const t = texto.split('\n').map((l) => l.replace(/^(\s*(?:proxy_set_header|add_header|fastcgi_param|set|more_set_headers)\s+(\$?"?[^\s;"]+"?)\s+)(.+?)(\s*;.*)$/, (m, a, nome, valor, fim) => {
    if (!SEGREDO_NOME.test(nome) || /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(valor.trim())) return m
    redigidos.push(semAspas(nome))
    return a + '***' + fim
  })).join('\n')
  return { texto: t, redigidos }
}

/** A mesma configuração sem SSL, para quando o certificado ainda não existe no servidor novo: o bloco 443 vira 80, e o certbot
 *  acrescenta o HTTPS sozinho. Bloco só-HTTP com o mesmo server_name de um bloco SSL é descartado (o 80 novo o substitui).
 *  ponytail: linha a linha, só pega diretiva em linha própria (como o certbot e o nginx escrevem); upgrade: parser de verdade. */
function semSsl(blocos) {
  const ssl = blocos.filter((b) => b.a.certs.length)
  if (!ssl.length) return null
  const nomesSsl = new Set(ssl.flatMap((b) => b.a.nomes))
  const partes = []
  for (const b of blocos) {
    if (b.a.certs.length) {
      partes.push(b.texto.split('\n')
        .filter((l) => !/^\s*(ssl_certificate|ssl_certificate_key|ssl_dhparam|ssl_trusted_certificate|ssl_protocols|ssl_ciphers|ssl_prefer_server_ciphers|ssl_session_\w+)\s/.test(l) && !/^\s*include\s+\S*options-ssl-nginx\.conf\s*;/.test(l))
        .map((l) => (/^\s*listen\s/.test(l) ? l.replace(/\b443\b/, '80').replace(/\s+ssl\b/, '').replace(/\s+http2\b/, '') : l))
        .map((l) => l.replace(/\s*# managed by Certbot/, '')).join('\n')) // a marca do certbot sai: ele não deve achar que estas linhas são dele
    } else if (!b.a.nomes.some((n) => nomesSsl.has(n))) partes.push(b.texto)
  }
  return partes.join('\n\n') + '\n'
}

/** Lê o nginx e acha os blocos LIGADOS ao projeto, cada um com o motivo. ctx = { raiz, raizReal, slug, portas: Map, textos }. */
export function descobrirNginx(ctx, { nginxDir = process.env.CC_NGINX_DIR || '/etc/nginx', leitor = leitorPadrao() } = {}) {
  const r = { lido: false, motivo: null, dir: nginxDir, entradas: 0, arquivos: [], nao_coletado: [], segredos_externos: [], dominios: [], ruido: [] }
  const enabled = path.join(nginxDir, 'sites-enabled')
  let nomes
  try { nomes = leitor.listar(enabled) } catch (e) {
    r.motivo = e.code === 'ENOENT' ? `${enabled} não existe: este servidor não tem nginx` : `${enabled}: ${PRECISA_ROOT}`
    if (e.code !== 'ENOENT') r.nao_coletado.push({ caminho: enabled, motivo: PRECISA_ROOT })
    return r
  }
  r.lido = true
  // um arquivo real pode ter vários atalhos: fica o atalho de mesmo nome do arquivo, ou o primeiro
  const porReal = new Map()
  for (const nome of nomes.filter((n) => !n.startsWith('.')).sort()) {
    const abs = path.join(enabled, nome)
    let real
    try { real = leitor.real(abs) } catch { r.nao_coletado.push({ caminho: abs, motivo: PRECISA_ROOT }); continue }
    const g = porReal.get(real) || []
    g.push(nome); porReal.set(real, g)
  }
  const lidos = []
  for (const [real, grupo] of porReal) {
    let texto
    try { texto = leitor.ler(real) } catch (e) {
      if (e.code === 'PROIBIDO') continue
      r.nao_coletado.push({ caminho: real, motivo: PRECISA_ROOT }); continue
    }
    const nome = grupo.find((g) => g === path.basename(real)) || grupo[0]
    const tops = blocosTopo(texto)
    const upstreams = new Map()
    const ups = new Map()
    const servers = []
    for (const b of tops) {
      if (/^upstream\s/.test(b.cab)) {
        const un = b.cab.split(' ')[1].toLowerCase()
        const ps = declaracoes(b.corpo).filter((d) => d[0] === 'server').map((d) => /^(?:\[[^\]]+\]|[^:\s]+):(\d+)$/.exec(d[1] || '')).filter(Boolean).map((m) => Number(m[1]))
        upstreams.set(un, ps); ups.set(un, texto.slice(b.ini, b.fim))
      } else if (b.cab === 'server') servers.push({ texto: texto.slice(b.ini, b.fim), a: analisarServer(b.corpo) })
    }
    lidos.push({ nome, grupo, real, texto, upstreams, ups, servers })
  }
  r.entradas = lidos.length
  const upGlobal = new Map()
  for (const f of lidos) for (const [k, v] of f.upstreams) upGlobal.set(k, v)

  // 1. cada bloco: por que ele é do projeto?
  const todos = []
  for (const f of lidos) f.servers.forEach((b, i) => { b.arq = f.nome; b.i = i; b.motivos = []; todos.push(b) })
  const citado = (n) => { const t = ctx.textos.find((x) => x.t.includes(n)); return t ? t.arq : null }
  for (const b of todos) {
    const add = (certeza, motivo) => b.motivos.push({ certeza, motivo })
    for (const alvo of b.a.proxy) for (const p of portasDoAlvo(alvo, upGlobal)) {
      const pr = ctx.portas.get(p)
      if (pr) add(pr.certeza, `proxy_pass para a porta ${p}, que o projeto usa (${pr.origem.join('; ')})`)
    }
    for (const c of b.a.caminhos) {
      if (c.valor.includes('$')) continue
      if (dentro(ctx.raiz, c.valor) || dentro(ctx.raizReal, c.valor)) { add('certo', `${c.dir} ${c.valor} está dentro da pasta do projeto`); continue }
      const m = /^\/(?:var\/www|opt|srv)\/([^/]+)/.exec(c.valor)
      if (!m) continue
      const seg = m[1].toLowerCase()
      if (seg === ctx.slug) add('certo', `${c.dir} ${c.valor} tem o nome da pasta do projeto (${ctx.slug})`)
      else if ((seg.startsWith(ctx.slug) || (seg.length >= 4 && ctx.slug.startsWith(seg)))) add('candidato', `${c.dir} ${c.valor} tem nome parecido com o do projeto (${ctx.slug})`)
    }
  }
  // 2. irmãos: outro bloco com o mesmo server_name de um bloco ligado (o desvio de http para https, por exemplo)
  const irmaos = (bases) => {
    for (const b of todos.filter((x) => !x.motivos.length)) {
      const irmao = bases.find((l) => l.a.nomes.some((n) => nomeValido(n) && b.a.nomes.includes(n)))
      if (!irmao) continue
      const n = b.a.nomes.find((x) => nomeValido(x) && irmao.a.nomes.includes(x))
      b.motivos.push({ certeza: irmao.motivos.some((m) => m.certeza === 'certo') ? 'certo' : 'candidato', motivo: `mesmo server_name (${n}) de um bloco ligado, em ${irmao.arq}` })
    }
  }
  irmaos(todos.filter((b) => b.motivos.length))
  // 3. server_name citado em arquivo do projeto: só candidato
  const comMotivo = todos.filter((b) => b.motivos.length)
  for (const b of todos.filter((x) => !x.motivos.length)) {
    for (const n of b.a.nomes.filter(nomeValido)) {
      const onde = citado(n)
      if (!onde) continue
      // domínio citado em 3 ou mais projetos (contando este) é ruído: não vira candidato por citação. Ainda pode ser certo por porta ou pasta.
      const total = ctx.outros ? ctx.outros(n) + 1 : 1
      if (total >= 3) { if (!r.ruido.some((x) => x.dominio === n)) r.ruido.push({ dominio: n, projetos: total }); continue }
      b.motivos.push({ certeza: 'candidato', motivo: `server_name ${n} aparece em ${onde}, dentro do projeto` }); break
    }
  }
  // o irmão de um bloco achado só por citação também entra, como candidato
  irmaos(todos.filter((b) => b.motivos.length && !comMotivo.includes(b)))
  const certezaDe = (b) => (b.motivos.some((m) => m.certeza === 'certo') ? 'certo' : 'candidato')

  // 3. por arquivo: o texto a copiar (com os upstreams que os blocos usam), o certificado, os segredos que ele aponta
  for (const f of lidos) {
    const lig = f.servers.filter((b) => b.motivos.length)
    if (!lig.length) continue
    const usados = unicos(lig.flatMap((b) => b.a.proxy.map((p) => (/^[a-z]+:\/\/([^/:\s]+)/i.exec(p) || [])[1]?.toLowerCase()).filter((u) => u && f.ups.has(u))))
    const red = []
    const lim = (t) => { const x = redigirConf(t); red.push(...x.redigidos); return x.texto }
    const blocos = lig.map((b) => ({ ...b, texto: lim(b.texto) }))
    const texto = [...usados.map((u) => lim(f.ups.get(u))), ...blocos.map((b) => b.texto)].join('\n\n') + '\n'
    let ssl = semSsl(blocos)
    if (ssl) ssl = [...usados.map((u) => lim(f.ups.get(u))), ssl].join('\n\n')
    const certs = unicos(lig.flatMap((b) => b.a.certs)).map((c) => {
      const m = /^\/etc\/letsencrypt\/live\/([^/]+)\//.exec(c)
      return m ? { tipo: 'certbot', dominio: m[1].toLowerCase() } : { tipo: 'outro', caminho: c }
    })
    const fora = unicos(lig.flatMap((b) => b.a.caminhos).map((c) => c.valor).filter((v) => !v.includes('$') && !dentro(ctx.raiz, v) && !dentro(ctx.raizReal, v)))
    const incs = unicos(lig.flatMap((b) => b.a.incs)).filter((i) => !/letsencrypt/.test(i))
    const snippets = []
    for (const i of incs) {
      const abs = i.startsWith('/') ? i : path.join(nginxDir, i)
      const rel = path.relative(nginxDir, abs)
      if (rel.startsWith('..') || !rel.startsWith('snippets/')) continue
      if (!leitor.pode(abs)) { r.nao_coletado.push({ caminho: abs, motivo: PRECISA_ROOT }); continue }
      snippets.push({ rel, abs })
    }
    for (const a of unicos(lig.flatMap((b) => b.a.auth))) {
      const abs = a.startsWith('/') ? a : path.join(nginxDir, a)
      const legivel = leitor.pode(abs)
      r.segredos_externos.push({ caminho: abs, origem: `nginx ${f.nome}`, legivel })
      if (!legivel) r.nao_coletado.push({ caminho: abs, motivo: PRECISA_ROOT })
    }
    for (const c of certs.filter((c) => c.tipo === 'outro')) {
      r.nao_coletado.push({ caminho: c.caminho, motivo: `certificado fora do certbot: o certificado e a chave privada nunca são lidos de propósito; ${PRECISA_ROOT}` })
    }
    const cert = lig.some((b) => b.motivos.some((m) => m.certeza === 'certo')) ? 'certo' : 'candidato'
    const doms = unicos(lig.filter((b) => b.a.certs.some((c) => c.startsWith('/etc/letsencrypt/'))).flatMap((b) => b.a.nomes).filter((n) => nomeValido(n) && !n.startsWith('*')))
    r.arquivos.push({
      nome: f.nome, origem: f.real, outros_atalhos: f.grupo.filter((g) => g !== f.nome),
      certeza: cert, texto, texto_sem_ssl: ssl, dominios_certbot: doms, certificados: certs, snippets,
      redigidos: unicos(red), fora_da_capsula: fora, usa_includes: incs,
      blocos: lig.map((b) => ({ server_name: b.a.nomes, listen: b.a.listen, certeza: certezaDe(b), motivos: b.motivos, caminhos: b.a.caminhos.map((c) => ({ dir: c.dir, valor: c.valor })) })),
    })
  }
  // os domínios dos blocos ligados, com a certeza e o tipo de certificado
  const vistos = new Map()
  for (const f of r.arquivos) for (const b of f.blocos) for (const n of b.server_name.filter(nomeValido)) {
    const v = vistos.get(n) || { dominio: n, certeza: b.certeza, arquivo: f.nome, certificado: 'sem-ssl' }
    if (b.certeza === 'certo') v.certeza = 'certo'
    const tipo = f.certificados.some((c) => c.tipo === 'certbot' && (c.dominio === n || f.dominios_certbot.includes(n))) ? 'certbot' : f.certificados.length ? 'outro' : 'sem-ssl'
    if (tipo !== 'sem-ssl' && v.certificado === 'sem-ssl') v.certificado = tipo
    vistos.set(n, v)
  }
  for (const f of r.arquivos) for (const c of f.certificados.filter((c) => c.tipo === 'certbot')) if (!vistos.has(c.dominio) && nomeValido(c.dominio)) vistos.set(c.dominio, { dominio: c.dominio, certeza: f.certeza, arquivo: f.nome, certificado: 'certbot' })
  r.dominios = [...vistos.values()].sort((a, b) => (a.dominio < b.dominio ? -1 : 1))
  return r
}

// ---- PM2, unidades de usuário, cron -------------------------------------------------------------------------------------------------

const VAR_RUIDO = /^(PATH|HOME|USER|LOGNAME|SHELL|LANG|LANGUAGE|PWD|OLDPWD|TERM|SHLVL|_|HOSTNAME|LC_\w+|XDG_\w+|DBUS_\w+|SSH_\w+|MAIL|LS_COLORS|LESS\w*|PM2_\w+|pm_\w+|unique_id|NODE_APP_INSTANCE|SUDO_\w+)$/

export function descobrirPm2(ctx, { pm2 = pm2Padrao } = {}) {
  const r = { lido: false, motivo: null, processos: [], portas: [], nao_coletado: [] }
  let o
  try { o = pm2() } catch (e) { o = { ok: false, motivo: e.message } }
  if (!o || !o.ok) { r.motivo = (o && o.motivo) || 'o pm2 não respondeu'; return r }
  r.lido = true
  for (const p of o.lista || []) {
    const e = p.pm2_env || {}
    const cwd = e.pm_cwd || '', script = e.pm_exec_path || ''
    const meu = [cwd, script].some((x) => x && (dentro(ctx.raiz, x) || dentro(ctx.raizReal, x)))
    if (!meu) continue
    const args = Array.isArray(e.args) ? e.args.map(String) : e.args ? String(e.args).split(/\s+/) : []
    r.processos.push({
      nome: p.name, script, cwd, args: redigir(args.join(' ')).split(' ').filter(Boolean),
      interpretador: e.exec_interpreter || null, modo: e.exec_mode || null, instancias: e.instances ?? null,
      // SÓ os nomes das variáveis; o valor nunca é lido para fora desta linha
      variaveis: Object.keys(e.env || {}).filter((k) => !VAR_RUIDO.test(k) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)).sort(),
    })
    for (const m of args.join(' ').matchAll(/(?:--port[ =]|-p[ =]?)(\d{2,5})\b/g)) if (PORTA_OK(Number(m[1]))) r.portas.push({ porta: Number(m[1]), origem: `pm2 ${p.name}, args` })
  }
  return r
}

const SAFE_ENV = /^(PORT|HOST|HOSTNAME|NODE_ENV|TZ|LANG|PATH|NODE_OPTIONS|NEXT_TELEMETRY_DISABLED|PYTHONUNBUFFERED)$/
const SEG_KV = /\b([A-Za-z0-9_]*(?:PASS(?:WORD)?|SENHA|SECRET|TOKEN|API_?KEY|PRIVATE|CREDENTIAL)[A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S+)/gi
const SEG_FLAG = /(--?(?:password|passwd|token|secret|api-?key)[= ])(\S+)/gi
/** Valor de segredo em linha de comando ou de cron vira ***. */
export const redigir = (t) => String(t).replace(SEG_KV, (_, k) => `${k}=***`).replace(SEG_FLAG, '$1***')

function redigirUnidade(texto) {
  const vars = []
  const t = texto.split('\n').map((l) => l.replace(/^(\s*Environment=)(.*)$/, (m, a, b) => a + b.replace(/("?)([A-Za-z_][A-Za-z0-9_]*)=([^"\s]*)\1/g, (mm, q, k) => { vars.push(k); return SAFE_ENV.test(k) ? mm : `${q}${k}=***${q}` }))).join('\n')
  return { texto: redigir(t), vars: unicos(vars) }
}

const citaPasta = (texto, ctx) => [ctx.raiz, ctx.raizReal].some((p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_-])').test(texto))

export function descobrirUnidades(ctx, { unitDir = process.env.CC_UNIT_DIR || path.join(os.homedir(), '.config', 'systemd', 'user'), leitor = leitorPadrao() } = {}) {
  const r = { lido: false, motivo: null, dir: unitDir, unidades: [], portas: [], segredos_externos: [], nao_coletado: [] }
  let nomes
  try { nomes = leitor.listar(unitDir) } catch (e) { r.motivo = e.code === 'ENOENT' ? 'não há unidades de usuário' : PRECISA_ROOT; if (e.code !== 'ENOENT') r.nao_coletado.push({ caminho: unitDir, motivo: PRECISA_ROOT }); return r }
  r.lido = true
  const txt = new Map()
  for (const n of nomes.filter((x) => /\.(service|timer)$/.test(x)).sort()) {
    const abs = path.join(unitDir, n)
    try { txt.set(n, leitor.ler(abs)) } catch { r.nao_coletado.push({ caminho: abs, motivo: PRECISA_ROOT }) }
  }
  const servicos = new Set([...txt].filter(([n, t]) => n.endsWith('.service') && citaPasta(t, ctx)).map(([n]) => n))
  const escolhidas = [...txt.keys()].filter((n) => servicos.has(n) || (n.endsWith('.timer') && (servicos.has(n.replace(/\.timer$/, '.service')) || citaPasta(txt.get(n), ctx))))
  for (const n of escolhidas) {
    const t = txt.get(n)
    const x = redigirUnidade(t)
    r.unidades.push({ nome: n, texto: x.texto, variaveis: x.vars })
    for (const m of t.matchAll(/Environment=["']?PORT=(\d{2,5})/g)) if (PORTA_OK(Number(m[1]))) r.portas.push({ porta: Number(m[1]), origem: `unidade ${n}, PORT` })
    for (const m of t.matchAll(/ExecStart=.*?(?:--port[ =]|-p[ =]?)(\d{2,5})\b/g)) if (PORTA_OK(Number(m[1]))) r.portas.push({ porta: Number(m[1]), origem: `unidade ${n}, ExecStart` })
    for (const m of t.matchAll(/^\s*EnvironmentFile=-?(\S+)/gm)) {
      const abs = m[1]
      if (dentro(ctx.raiz, abs) || dentro(ctx.raizReal, abs)) continue // já está nos segredos do projeto
      const legivel = leitor.pode(abs)
      r.segredos_externos.push({ caminho: abs, origem: `unidade ${n}`, legivel })
      if (!legivel) r.nao_coletado.push({ caminho: abs, motivo: PRECISA_ROOT })
    }
  }
  return r
}

export function descobrirCron(ctx, { crontab = crontabPadrao } = {}) {
  const r = { lido: false, motivo: null, linhas: [] }
  let o
  try { o = crontab() } catch (e) { o = { ok: false, motivo: e.message } }
  if (!o || !o.ok) { r.motivo = (o && o.motivo) || 'o crontab não respondeu'; return r }
  r.lido = true
  r.linhas = String(o.texto || '').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#') && citaPasta(l, ctx)).map(redigir)
  return r
}

// ---- tudo junto -------------------------------------------------------------------------------------------------------------------

export const nomeDoProjeto = (pasta) => path.basename(pasta).replace(/^(VPS|PC)_/i, '').toLowerCase()

/** Lê tudo. Nada é gravado. `portasDocker` = as portas que o Docker mostrou que o projeto publica (passo 2). */
export function descobrir(pasta, { nginxDir = process.env.CC_NGINX_DIR || '/etc/nginx', unitDir, leitor = leitorPadrao(), pm2 = pm2Padrao, crontab = crontabPadrao, portasDocker = [], projeto = null, lerPm2 = true, mapear = (p) => p, outros } = {}) {
  const raiz = path.resolve(pasta)
  let raizReal = raiz; try { raizReal = fs.realpathSync(raiz) } catch { /* pasta sumiu: segue com o caminho dado */ }
  const proj = projeto || lerProjeto(raiz)
  const ctx = { raiz, raizReal, slug: nomeDoProjeto(raiz), portas: new Map(proj.portas), textos: proj.textos, outros: outros === undefined ? citacoesEmOutros(raiz) : outros }
  const poe = (porta, certeza, origem) => {
    const p = ctx.portas.get(porta) || { porta, certeza, origem: [] }
    if (certeza === 'certo') p.certeza = 'certo'
    if (!p.origem.includes(origem)) p.origem.push(origem)
    ctx.portas.set(porta, p)
  }
  for (const p of portasDocker) if (p.publica) poe(Number(p.publica), 'certo', `Docker, serviço ${p.servico}`)
  const p2 = lerPm2 && pm2 ? descobrirPm2(ctx, { pm2 }) : { lido: false, motivo: 'não consultado', processos: [], portas: [], nao_coletado: [] }
  const un = descobrirUnidades(ctx, { unitDir, leitor })
  const cr = descobrirCron(ctx, { crontab })
  for (const p of [...p2.portas, ...un.portas]) poe(p.porta, 'certo', p.origem)
  const ng = descobrirNginx(ctx, { nginxDir, leitor })

  // porta que o nginx leva a um bloco ligado e nenhum processo conhecido do usuário explica: pode ser PM2 do root
  const nao = [...ng.nao_coletado, ...un.nao_coletado, ...p2.nao_coletado]
  // porta que o nginx leva a um bloco ligado e que nenhum processo conhecido do usuário (Docker, unidade, PM2) explica: pode ser PM2 do root
  const explicada = (n) => (ctx.portas.get(n)?.origem || []).some((o) => /^(Docker|unidade|pm2)/.test(o))
  const portasProxy = unicos(ng.arquivos.flatMap((f) => f.blocos.filter((b) => b.certeza === 'certo').flatMap((b) => b.motivos.map((m) => /proxy_pass para a porta (\d+)/.exec(m.motivo)?.[1]).filter(Boolean))))
    .map(Number).filter((n) => !explicada(n))
  if (portasProxy.length) {
    nao.push({ caminho: `PM2 do root (porta ${portasProxy.join(', ')})`, motivo: `o nginx leva a porta ${portasProxy.join(', ')} a este projeto e o usuário não vê processo dela (nem PM2, nem unidade, nem Docker); se o PM2 de produção é do root, ${PRECISA_ROOT}` })
  }
  if (!p2.lido && p2.motivo !== 'não consultado') nao.push({ caminho: 'PM2', motivo: `${p2.motivo}; ${PRECISA_ROOT}` })
  // as pastas que os blocos ligados servem e que ficam FORA do projeto (lacuna do site publicado): medidas aqui, coletadas em coletar()
  const pubMap = new Map()
  for (const f of ng.arquivos) for (const b of f.blocos) for (const c of b.caminhos || []) {
    const v = c.valor
    if (!v.startsWith('/') || v.includes('$') || dentro(raiz, v) || dentro(raizReal, v)) continue
    const e = pubMap.get(v) || { caminho: v, certeza: 'candidato', origens: [] }
    if (b.certeza === 'certo') e.certeza = 'certo'
    const o = `nginx ${f.nome}, ${b.server_name.join(' ') || 'sem server_name'} (${c.dir})`
    if (!e.origens.includes(o)) e.origens.push(o)
    pubMap.set(v, e)
  }
  const publicado = [...pubMap.values()].sort((a, b) => (a.caminho < b.caminho ? -1 : 1)).map((e) => ({ ...e, av: Pa.avaliar(e.caminho, { raizes: [raiz, raizReal], mapear }) }))
  const vistosNao = new Set()
  const naoUnico = nao.filter((x) => { const k = x.caminho + '|' + x.motivo; if (vistosNao.has(k)) return false; vistosNao.add(k); return true })
  return {
    projeto: path.basename(raiz), slug: ctx.slug, lidos: proj.lidos,
    portas: [...ctx.portas.values()].sort((a, b) => a.porta - b.porta),
    nginx: ng, pm2: p2, unidades: un, cron: cr, dominios: ng.dominios, publicado, ruido: ng.ruido,
    segredos_externos: [...ng.segredos_externos, ...un.segredos_externos],
    nao_coletado: naoUnico,
  }
}

/** O que vai para o manifesto e para a tela: tudo menos os textos dos arquivos. */
export function resumir(d) {
  return {
    portas: d.portas,
    nginx: {
      lido: d.nginx.lido, motivo: d.nginx.motivo, pasta: d.nginx.dir, arquivos_lidos: d.nginx.entradas,
      arquivos: d.nginx.arquivos.map((f) => ({
        arquivo: f.nome, copia: f.copia || null, copia_sem_ssl: f.copia_sem_ssl || null, origem: f.origem, outros_atalhos: f.outros_atalhos, certeza: f.certeza, blocos: f.blocos, certificados: f.certificados,
        dominios_certbot: f.dominios_certbot, tem_variante_sem_ssl: !!f.texto_sem_ssl, usa_includes: f.usa_includes, fora_da_capsula: f.fora_da_capsula, redigidos: f.redigidos,
      })),
    },
    dominios: d.dominios,
    publicado_achado: (d.publicado || []).map(Pa.resumirAv),
    ruido: d.ruido || [],
    pm2: { lido: d.pm2.lido, motivo: d.pm2.motivo, processos: d.pm2.processos },
    unidades: { lido: d.unidades.lido, motivo: d.unidades.motivo, arquivos: d.unidades.unidades.map((u) => ({ arquivo: u.nome, variaveis: u.variaveis })) },
    cron: { lido: d.cron.lido, motivo: d.cron.motivo, linhas: d.cron.linhas.length },
    segredos_externos: d.segredos_externos.map((s) => ({ caminho: s.caminho, origem: s.origem, legivel: s.legivel })),
    nao_coletado: d.nao_coletado,
  }
}

/** Contagem curta para a tela e o estado do trabalho. */
export function contar(sv) {
  if (!sv) return null
  const blocos = (sv.nginx?.arquivos || []).flatMap((f) => f.blocos)
  return {
    nginx_certos: blocos.filter((b) => b.certeza === 'certo').length, nginx_candidatos: blocos.filter((b) => b.certeza !== 'certo').length,
    dominios: (sv.dominios || []).length, pm2: (sv.pm2?.processos || []).length, unidades: (sv.unidades?.arquivos || []).length,
    cron: sv.cron?.linhas || 0, nao_coletado: (sv.nao_coletado || []).length,
    publicado_certas: (sv.publicado_achado || []).filter((x) => x.certeza === 'certo').length, publicado_candidatas: (sv.publicado_achado || []).filter((x) => x.certeza !== 'certo').length,
  }
}

/** [bytes das pastas publicadas de ligação certa, bytes A MAIS se os candidatos entrarem]. Só conta o que seria guardado, sem contar pasta dentro de pasta duas vezes. */
export const bytesPublicado = (d) => {
  const todas = d.publicado || []
  const certas = Pa.bytesDe(todas.filter((p) => p.certeza === 'certo'))
  return [certas, Pa.bytesDe(todas) - certas]
}

/** Descobre e grava em `<stage>/servidor/` (e os segredos externos em `<stage>/.ext/_servidor/`, que quem chama cifra e apaga). */
export function coletar(pasta, stage, opts = {}) {
  const d = opts.descoberta || descobrir(pasta, opts)
  const { leitor = leitorPadrao() } = opts
  const arquivos = []
  const plano = []
  const w = (rel, txt, modo) => {
    fs.mkdirSync(path.dirname(path.join(stage, rel)), { recursive: true })
    fs.writeFileSync(path.join(stage, rel), txt, modo ? { mode: modo } : undefined)
    arquivos.push(rel)
  }
  const usados = new Set()
  const nomeArq = (n) => { let b = seguro(n); if (!b.endsWith('.conf')) b += '.conf'; while (usados.has(b)) b = '_' + b; usados.add(b); return b }
  const snips = new Set()
  for (const f of d.nginx.arquivos) {
    const arq = nomeArq(f.nome)
    f.copia = arq
    w(`servidor/nginx/${arq}`, f.texto)
    let sem = '-'
    if (f.texto_sem_ssl) { sem = arq.replace(/\.conf$/, '.sem-ssl.conf'); f.copia_sem_ssl = sem; w(`servidor/nginx/${sem}`, f.texto_sem_ssl) }
    plano.push(['nginx', campo(f.nome), f.certeza, arq, sem, f.dominios_certbot.length ? f.dominios_certbot.join(' ') : '-'])
    for (const s of f.snippets) {
      if (snips.has(s.rel)) continue
      snips.add(s.rel)
      try { w(`servidor/nginx/${s.rel}`, leitor.ler(s.abs)); plano.push(['snippet', s.rel, '-']) } catch { d.nao_coletado.push({ caminho: s.abs, motivo: PRECISA_ROOT }) }
    }
  }
  if (d.pm2.processos.length) {
    w('servidor/pm2.json', JSON.stringify(d.pm2.processos, null, 2) + '\n')
    for (const p of d.pm2.processos) plano.push(['pm2', campo(p.nome), campo(p.script), campo(p.cwd), campo(p.interpretador || '-'), campo(p.args.join(' ')) || '-'])
  }
  for (const u of d.unidades.unidades) { w(`servidor/systemd/${seguro(u.nome)}`, u.texto); plano.push(['unidade', seguro(u.nome), '-']) }
  if (d.cron.linhas.length) w('servidor/cron.txt', d.cron.linhas.join('\n') + '\n')
  if (d.dominios.length) w('servidor/dominios.txt', d.dominios.map((x) => x.dominio).join('\n') + '\n')

  // segredos que os blocos e as unidades apontam: só os legíveis, e fora da pasta servidor/
  const externos = []
  const extDir = path.join(stage, '.ext')
  let n = 0
  for (const s of d.segredos_externos.filter((x) => x.legivel)) {
    let t
    try { t = leitor.ler(s.caminho) } catch { d.nao_coletado.push({ caminho: s.caminho, motivo: PRECISA_ROOT }); continue }
    n++
    const membro = `_servidor/${n}-${seguro(path.basename(s.caminho))}`
    fs.mkdirSync(path.join(extDir, '_servidor'), { recursive: true, mode: 0o700 })
    fs.writeFileSync(path.join(extDir, membro), t, { mode: 0o600 })
    externos.push({ membro, caminho: s.caminho, origem: s.origem })
    plano.push(['segredo', membro, campo(s.caminho)])
  }
  // as pastas publicadas (root e alias fora do projeto): só as de ligação certa; candidatas só com incluirCandidatos
  const entraPub = (p) => p.certeza === 'certo' || opts.incluirCandidatos === true
  const pub = Pa.coletar(d.publicado.filter(entraPub), stage, 'publicado', { tipo: 'publicado' })
  const naoIncl = d.publicado.filter((p) => !entraPub(p)).map((p) => ({ caminho: p.caminho, certeza: p.certeza, origens: p.origens, tipo_origem: p.av.tipo, estado: 'candidata-nao-incluida', bytes_origem: p.av.bytes, motivo: 'bloco candidato: a pasta só entra se a opção de incluir candidatos for marcada' }))
  d.nao_coletado.push(...pub.naoColetado)
  let usuario = '-'; try { usuario = os.userInfo().username } catch { /* sem usuário: segue */ }
  const temAlgo = arquivos.length > 0
  if (temAlgo) {
    plano.push(['nginxdir', campo(d.nginx.dir), '-'], ['usuario', campo(usuario), '-'])
    w('servidor/plano.tsv', plano.map((l) => l.join('\t')).join('\n') + '\n')
  }
  const resumo = { ...resumir(d), usuario, coletado_em: new Date().toISOString(), arquivos_na_capsula: arquivos.length + pub.arquivos.length }
  return { arquivos: [...arquivos, ...pub.arquivos], externos, extDir, resumo, descoberta: d, pastas: { somas: pub.somas, plano: pub.plano, entradas: [...pub.entradas, ...naoIncl], segredos: pub.segredos } }
}
