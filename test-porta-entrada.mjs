// CC-869: o código do autenticador na porta de entrada do painel (login em aparelho novo e
// reinício de emergência), conferido pelo serviço do Deploy seguro. Tudo numa casa temporária,
// com o serviço do administrador de verdade e uma Contabo de mentira: nada real é tocado.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'porta-entrada-'))
process.env.DEPLOY_CONF = path.join(casa, 'conf')
process.env.DEPLOY_ESTADO = path.join(casa, 'estado')
process.env.DEPLOY_BACKUP = path.join(casa, 'backup')
process.env.COCKPIT_AUDITORIA = path.join(casa, 'auditoria.jsonl') // nunca o registro de verdade; a porta e o CLI herdam
const D = await import('./tools/deploy-seguro/deploy-seguro.mjs')

const livre = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)) }) })
let n = 0
const t = async (nome, fn) => { await fn(); n += 1; console.log('  ok  ' + nome) }
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

// ── o serviço do administrador, de verdade, com um segredo de teste ──
const SEG = D.base32Codificar(Buffer.from('segredo-da-porta-123'))
fs.mkdirSync(process.env.DEPLOY_CONF, { recursive: true })
fs.writeFileSync(path.join(process.env.DEPLOY_CONF, 'totp.secret'), SEG)
let deploy = D.criarServidor({})
const portaDeploy = await livre()
await new Promise((r) => deploy.listen(portaDeploy, '127.0.0.1', r))
const agora = () => Math.floor(Date.now() / 30000)
const codigo = (passo) => D.totp(SEG, passo)

// ── uma Contabo de mentira: só conta as chamadas ──
const contabo = { chamadas: [] }
const srvContabo = http.createServer((req, res) => {
  contabo.chamadas.push(req.method + ' ' + req.url)
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(req.url.includes('token') ? { access_token: 'x' } : { data: [{ status: 'running' }] }))
})
const portaContabo = await livre()
await new Promise((r) => srvContabo.listen(portaContabo, '127.0.0.1', r))

// ── a porta de entrada, de verdade, numa casa de mentira ──
const HOME = path.join(casa, 'home'); fs.mkdirSync(path.join(HOME, 'logs'), { recursive: true })
const portaEntrada = await livre()
const portaFechada = await livre() // ninguém escuta: serve de "painel fora do ar" e de "serviço fora do ar"
const env = {
  ...process.env, HOME, COCKPIT_AUTH_PORT: String(portaEntrada), COCKPIT_ALVO_PORT: String(portaFechada),
  COCKPIT_DEPLOY_PORT: String(portaDeploy),
  COCKPIT_VIGIA: 'off', COCKPIT_PUSH_DIR: path.join(casa, 'push'), // CC-932: sem vigia (não há painel de verdade aqui) e com as chaves numa pasta temporária
  COCKPIT_CONTABO_AUTH_URL: `http://127.0.0.1:${portaContabo}/token`, COCKPIT_CONTABO_API_URL: `http://127.0.0.1:${portaContabo}/v1`,
}
// assíncrono de propósito: o serviço do administrador roda DENTRO deste processo, e spawnSync o travaria
const cliCom = (ambiente, ...args) => new Promise((ok) => {
  const f = spawn(process.execPath, ['tools/porta-entrada/cockpit-auth-cli.mjs', ...args], { env: ambiente })
  let stdout = ''; let stderr = ''
  f.stdout.on('data', (c) => { stdout += c }); f.stderr.on('data', (c) => { stderr += c })
  f.on('close', (status) => ok({ status, stdout, stderr }))
})
const cli = (...args) => cliCom(env, ...args)
const SENHA = 'senha-de-teste-123'
assert.equal(spawnSync(process.execPath, ['tools/porta-entrada/cockpit-auth-cli.mjs', 'senha', SENHA], { env }).status, 0)
fs.writeFileSync(path.join(HOME, '.contabo-api.json'), JSON.stringify({ clientId: 'c', clientSecret: 's', apiUser: 'u', apiPassword: 'p', instanceId: '1' }))

const porta = spawn(process.execPath, ['tools/porta-entrada/cockpit-auth.mjs'], { env, stdio: 'ignore' })
const base = `http://127.0.0.1:${portaEntrada}`
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break } catch { await espera(100) } }

const entrar = async (senha, cod) => {
  const corpo = new URLSearchParams({ senha, ...(cod !== undefined ? { codigo: cod } : {}) })
  const r = await fetch(base + '/__login', { method: 'POST', body: corpo, redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' } })
  return { status: r.status, texto: await r.text(), cookie: (r.headers.get('set-cookie') || '').split(';')[0] }
}

try {
  await t('desligado (o padrão): o login segue só com a senha, como sempre', async () => {
    assert.equal((await entrar('senha errada')).status, 401)
    const ok = await entrar(SENHA)
    assert.equal(ok.status, 302); assert.match(ok.cookie, /^cockpit_sess=/)
    assert.ok(!(await (await fetch(base + '/')).text()).includes('name="codigo"'), 'a página não pede código quando está desligado')
    const pg = await (await fetch(base + '/')).text()
    assert.ok(pg.includes('Ogumia') && pg.includes('<mask') && !pg.includes('Agent Cockpit'), 'a tela de login mostra o capacete e o nome Ogumia')
  })

  await t('CC-859: o app "Religar VPS" instala: manifesto, ícones e service worker passam SEM sessão, e a página continua exigindo login', async () => {
    const m = await fetch(base + '/__religar/app.webmanifest')
    assert.equal(m.status, 200); assert.match(m.headers.get('content-type'), /manifest\+json/)
    const man = await m.json()
    assert.equal(man.name, 'Religar VPS'); assert.equal(man.start_url, '/__religar/'); assert.equal(man.scope, '/__religar/')
    assert.equal(man.display, 'standalone'); assert.equal(man.theme_color, '#2B2F36'); assert.equal(man.background_color, '#2B2F36')
    assert.ok(man.icons.some((i) => i.purpose === 'maskable') && man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512'))
    for (const i of man.icons) { const r = await fetch(base + i.src); assert.equal(r.status, 200, i.src); assert.equal(r.headers.get('content-type').split(';')[0], i.type, i.src) }
    const png = Buffer.from(await (await fetch(base + '/__religar/icone-512.png')).arrayBuffer())
    assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), 512)
    const sw = await fetch(base + '/__religar/sw.js')
    assert.equal(sw.status, 200); assert.match(sw.headers.get('content-type'), /javascript/)
    const fonte = await sw.text()
    assert.match(fonte, /addEventListener\('fetch'/); assert.ok(!/caches\.|\.put\(|\.addAll\(/.test(fonte), 'o service worker não guarda resposta nenhuma')
    assert.equal((await fetch(base + '/__religar/credencial')).status, 401, 'só a lista exata passa: o resto continua atrás da sessão')
    assert.equal((await fetch(base + '/__religar/sw.js', { method: 'POST' })).status, 401, 'só leitura')
    const pagina = await fetch(base + '/__religar')
    assert.equal(pagina.status, 401); assert.match(await pagina.text(), /name="senha"/, 'sem sessão a página pede o login, como hoje')
    const logada = await entrar(SENHA)
    const dentro = await (await fetch(base + '/__religar', { headers: { cookie: logada.cookie } })).text()
    assert.match(dentro, /<link rel="manifest" href="\/__religar\/app\.webmanifest">/); assert.match(dentro, /serviceWorker\.register\('\/__religar\/sw\.js'/)
  })

  await t('CC-924: a sessão nasce com 90 dias, cada acesso renova, e a vencida pede a senha de novo', async () => {
    const ok = await entrar(SENHA); const tok = ok.cookie.split('=')[1]
    const arq = path.join(HOME, '.cockpit-sessions.json'); const dia = 864e5
    let s = JSON.parse(fs.readFileSync(arq, 'utf8'))
    assert.ok(Math.abs(s[tok].expiraEm - (Date.now() + 90 * dia)) < 60e3, 'nasce com 90 dias, não com 1 ano')
    s[tok].expiraEm = Date.now() + dia; s[tok].ultimoUso = Date.now() - 2 * 3600e3; fs.writeFileSync(arq, JSON.stringify(s))
    await (await fetch(base + '/', { headers: { cookie: ok.cookie }, redirect: 'manual' })).text()
    s = JSON.parse(fs.readFileSync(arq, 'utf8'))
    assert.ok(s[tok].expiraEm > Date.now() + 89 * dia, 'o acesso empurrou a validade para mais 90 dias')
    s[tok].expiraEm = Date.now() - 1000; fs.writeFileSync(arq, JSON.stringify(s))
    const venc = await (await fetch(base + '/', { headers: { cookie: ok.cookie }, redirect: 'manual' })).text()
    assert.match(venc, /name="senha"/, 'vencida volta para a tela de login')
  })

  await t('CC-932: as rotas /__push/* são da porta e exigem sessão; com ela, dão a chave, guardam a inscrição e o teste conta os aparelhos', async () => {
    const json = { 'content-type': 'application/json' }
    for (const [m, r] of [['GET', 'chave'], ['POST', 'inscrever'], ['POST', 'teste']]) {
      const x = await fetch(`${base}/__push/${r}`, { method: m, headers: json, body: m === 'POST' ? '{}' : undefined })
      assert.equal(x.status, 401, `${m} /__push/${r} sem sessão`); assert.match(await x.text(), /name="senha"/, 'sem sessão pede o login, e nada vaza')
    }
    const { cookie } = await entrar(SENHA); const com = { ...json, cookie }
    const k = await fetch(base + '/__push/chave', { headers: { cookie } }); assert.equal(k.status, 200)
    assert.equal(Buffer.from((await k.json()).chave, 'base64url').length, 65, 'a chave pública VAPID')
    assert.equal((await fetch(base + '/__push/inscrever', { method: 'POST', headers: { cookie, 'content-type': 'text/plain' }, body: '{}' })).status, 415, 'só JSON')
    assert.equal((await fetch(base + '/__push/inscrever', { method: 'POST', headers: com, body: '{"endpoint":"https://push.exemplo.org/x"}' })).status, 400, 'inscrição sem chaves')
    const sub = { endpoint: 'https://push.exemplo.org/x', keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } }
    const i = await fetch(base + '/__push/inscrever', { method: 'POST', headers: com, body: JSON.stringify(sub) })
    assert.equal(i.status, 200); assert.equal((await i.json()).inscritos, 1)
    assert.equal(fs.statSync(path.join(casa, 'push', 'inscricoes.json')).mode & 0o777, 0o600)
    assert.equal((await fetch(base + '/__push/desconhecida', { headers: { cookie } })).status, 404)
  })

  await t('CC-952: sem sessão, o login guarda de onde veio e volta para lá; endereço de fora vira o painel', async () => {
    const pg = await (await fetch(base + '/__religar', { redirect: 'manual' })).text()
    assert.match(pg, /name="volta" value="\/__religar"/, 'a página de login guarda o caminho do Religar')
    const post = async (volta) => (await fetch(base + '/__login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ senha: SENHA, volta }) })).headers.get('location')
    assert.equal(await post('/__religar'), '/__religar', 'depois do login, volta para o Religar')
    for (const ruim of ['//outro.site', 'https://outro.site', '/\\outro.site', '/__login', 'javascript:alert(1)']) assert.equal(await post(ruim), '/', ruim + ' não pode ser destino')
  })

  await t('ligar testa a conexão antes: com o serviço fora do ar recusa e não liga', async () => {
    const r = await cliCom({ ...env, COCKPIT_DEPLOY_PORT: String(portaFechada) }, 'codigo', 'ligar')
    assert.equal(r.status, 1); assert.match(r.stderr, /Nao liguei/)
    assert.match((await cli('codigo', 'estado')).stdout, /desligado/)
  })

  await t('ligar com o serviço de pé liga; a página de login passa a pedir o código', async () => {
    const r = await cli('codigo', 'ligar'); assert.equal(r.status, 0, r.stderr)
    assert.match((await cli('codigo', 'estado')).stdout, /LIGADO/)
    assert.match(await (await fetch(base + '/')).text(), /name="codigo"/)
  })

  await t('ligado: senha certa sem código, ou com código errado, não cria sessão e diz a causa', async () => {
    const sem = await entrar(SENHA, ''); assert.equal(sem.status, 401); assert.match(sem.texto, /6 números/); assert.equal(sem.cookie, '')
    const errado = await entrar(SENHA, '000000'); assert.equal(errado.status, 401); assert.match(errado.texto, /código errado/); assert.equal(errado.cookie, '')
  })

  const P = agora()
  await t('senha errada com código certo NÃO queima o código (quem não sabe a senha não gasta tentativa)', async () => {
    const r = await entrar('senha errada', codigo(P)); assert.equal(r.status, 401); assert.match(r.texto, /senha incorreta/)
  })

  let sessao
  await t('ligado: senha certa + código certo entra; o mesmo código não entra duas vezes', async () => {
    const ok = await entrar(SENHA, codigo(P)); assert.equal(ok.status, 302, ok.texto); assert.match(ok.cookie, /^cockpit_sess=/)
    sessao = ok.cookie
    const de_novo = await entrar(SENHA, codigo(P)); assert.equal(de_novo.status, 401); assert.match(de_novo.texto, /já foi usado/)
  })

  const religar = (cod, extra = {}) => fetch(base + '/__religar/executar', { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: sessao },
    body: new URLSearchParams({ senha: SENHA, confirmo: 'on', ...(cod !== undefined ? { codigo: cod } : {}), ...extra }) }).then((r) => r.text())

  await t('religar: a página pede o código, e sem ele nada chega na Contabo', async () => {
    const pagina = await (await fetch(base + '/__religar', { headers: { cookie: sessao } })).text()
    assert.match(pagina, /name="codigo"/)
    const antes = contabo.chamadas.length
    assert.match(await religar(''), /6 números/)
    assert.match(await religar('000000'), /código errado/)
    assert.equal(contabo.chamadas.length, antes, 'recusado antes de falar com a Contabo')
  })

  await t('religar: com o código certo dispara; o contador é SEPARADO do login (o mesmo passo vale aqui)', async () => {
    const r = await religar(codigo(P))   // o passo P já foi gasto no LOGIN, e aqui vale: finalidades independentes
    assert.match(r, /reinicio disparado/, r.slice(0, 400))
    assert.ok(contabo.chamadas.some((c) => c.includes('/actions/restart')), 'a Contabo recebeu o restart')
  })

  await t('religar: um segundo disparo cai no cooldown, mesmo com código novo', async () => {
    const r = await religar(codigo(P + 1)); assert.match(r, /cooldown/)
    assert.equal(contabo.chamadas.filter((c) => c.includes('/actions/restart')).length, 1)
  })

  await t('serviço do administrador fora do ar: o login recusa (falha fechada) e diz o que fazer', async () => {
    await new Promise((r) => deploy.close(r))
    const r = await entrar(SENHA, codigo(P + 1)); assert.equal(r.status, 401)
    assert.match(r.texto, /não respondeu/); assert.match(r.texto, /codigo desligar/); assert.equal(r.cookie, '')
  })

  await t('desligar não depende do serviço (é o caminho de recuperação) e o login volta a ser só senha', async () => {
    assert.equal((await cli('codigo', 'desligar')).status, 0)
    const r = await entrar(SENHA); assert.equal(r.status, 302)
  })

  await t('CC-933: login certo e errado, código, religar e revogar viram linhas de auditoria, sem senha nem código no arquivo', async () => {
    const r = await cli('revogar'); assert.equal(r.status, 0, r.stderr)
    const bruto = fs.readFileSync(process.env.COCKPIT_AUDITORIA, 'utf8')
    const L = bruto.trim().split('\n').map((l) => JSON.parse(l))
    const logins = L.filter((l) => l.acao === 'login')
    assert.ok(logins.some((l) => l.ok === false && /senha incorreta/.test(l.detalhe) && l.de === '127.0.0.1' && l.aparelho), 'login com senha errada, com IP e aparelho')
    assert.ok(logins.some((l) => l.ok === true && l.alvo.startsWith('sessão ') && l.de === '127.0.0.1' && l.aparelho), 'login certo, com IP, aparelho e a sessão criada')
    assert.ok(logins.some((l) => l.ok === false && /código recusado: (errado|usado)/.test(l.detalhe)), 'senha certa com código errado ou repetido')
    assert.ok(logins.some((l) => l.ok === true && /autenticador/.test(l.detalhe)), 'login com o código do autenticador')
    assert.ok(L.some((l) => l.acao === 'religar-vps' && l.ok === true && l.de === '127.0.0.1'), 'o religar disparado')
    assert.ok(L.some((l) => l.acao === 'religar-vps' && l.ok === false), 'o religar recusado (cooldown)')
    assert.ok(L.some((l) => l.acao === 'sessao-revogada' && l.alvo === 'todas' && /^terminal/.test(l.quem)), 'revogar pelo terminal')
    assert.ok(L.some((l) => l.acao === 'segundo-fator-config' && l.detalhe === 'ligado'), 'ligar o código do autenticador')
    assert.ok(L.some((l) => l.acao === 'segundo-fator-config' && l.detalhe === 'DESLIGADO'), 'desligar o código do autenticador')
    assert.ok(L.every((l) => l.em && l.acao), 'toda linha tem data e ação')
    for (const proibido of [SENHA, 'senha errada', codigo(P), codigo(P + 1), SEG, '000000']) assert.ok(!bruto.includes(proibido), 'o registro nunca guarda senha, código ou segredo')
    assert.ok(!/cockpit_sess=[0-9a-f]{32}/.test(bruto) && !bruto.includes(sessao.split('=')[1]), 'nem o cookie de sessão')
  })

  await t('o arquivo da porta de entrada nunca guarda nem recebe o segredo do autenticador', () => {
    for (const f of ['segundo-fator.mjs', 'cockpit-auth.mjs', 'cockpit-auth-cli.mjs']) {
      const fonte = fs.readFileSync(path.join('tools/porta-entrada', f), 'utf8')
      assert.ok(!/totp\.secret|lerSegredo|conferirCodigo/.test(fonte), `${f} não pode ler o segredo`)
    }
    assert.ok(!fs.readdirSync(HOME, { recursive: true }).some((p) => String(p).includes('totp')), 'nenhum arquivo de segredo na casa da porta de entrada')
  })
} finally {
  porta.kill(); srvContabo.close(); deploy.close?.()
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`${n} verificações da porta de entrada, todas passaram`)
process.exit(0)
