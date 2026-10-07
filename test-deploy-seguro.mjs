// CC-789: o lado protegido do deploy. Roda numa casa temporária, sem root,
// com o build e o site simulados: nada de verdade é publicado.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-seguro-'))
process.env.DEPLOY_CONF = path.join(casa, 'conf')
process.env.DEPLOY_ESTADO = path.join(casa, 'estado')
process.env.DEPLOY_BACKUP = path.join(casa, 'backup')
process.env.COCKPIT_AUDITORIA = path.join(casa, 'auditoria.jsonl') // nunca o registro de verdade
const D = await import('./tools/deploy-seguro/deploy-seguro.mjs')

let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok  ${nome}`) }

try {
  await t('TOTP bate com os exemplos oficiais do padrão (RFC 6238, SHA-1)', () => {
    const seg = Buffer.from('12345678901234567890')
    assert.equal(D.totp(seg, Math.floor(59 / 30), 8), '94287082')
    assert.equal(D.totp(seg, Math.floor(1111111109 / 30), 8), '07081804')
    assert.equal(D.totp(seg, Math.floor(1234567890 / 30), 8), '89005924')
    assert.deepEqual(D.base32Decodificar(D.base32Codificar(seg)), seg, 'o segredo vai e volta pelo base32')
  })

  const SEG = D.base32Codificar(Buffer.from('segredo-de-teste-123'))
  await t('código: aceita um passo de folga para cada lado, recusa o resto', () => {
    const agora = 1_790_000_000_000; const passo = Math.floor(agora / 30000)
    assert.equal(D.conferirCodigo(SEG, D.totp(SEG, passo), agora), passo)
    assert.equal(D.conferirCodigo(SEG, D.totp(SEG, passo - 1), agora), passo - 1)
    assert.equal(D.conferirCodigo(SEG, D.totp(SEG, passo + 2), agora), null)
    assert.equal(D.conferirCodigo(SEG, 'abcdef', agora), null)
  })

  await t('CC-869: o código vale em outras portas, e cada finalidade tem os próprios contadores', () => {
    const agora = 1_790_000_000_000; const passo = Math.floor(agora / 30000)
    const e = { pedidos: [], historico: [], falhas: 0, bloqueadoAte: 0, ultimoPasso: 0, ultimoCommit: {} }
    const cod = D.totp(SEG, passo)
    assert.deepEqual(D.verificarCodigo(e, 'login', cod, { agora, segredo: SEG }), { ok: true })
    assert.equal(D.verificarCodigo(e, 'login', cod, { agora, segredo: SEG }).motivo, 'usado', 'o mesmo código não vale duas vezes na mesma finalidade')
    assert.deepEqual(D.verificarCodigo(e, 'religar', cod, { agora, segredo: SEG }), { ok: true }, 'mas vale uma vez em cada finalidade')
    assert.equal(e.ultimoPasso, 0, 'o passo do deploy não foi gasto')
    assert.equal(e.falhas, 0)
    assert.equal(D.verificarCodigo(e, 'inventada', cod, { agora, segredo: SEG }).motivo, 'finalidade')
  })
  await t('CC-869: cinco erros bloqueiam SÓ aquela finalidade, por 15 minutos', () => {
    const agora = 1_790_000_100_000; const passo = Math.floor(agora / 30000)
    const e = { pedidos: [], historico: [], falhas: 0, bloqueadoAte: 0, ultimoPasso: 0, ultimoCommit: {} }
    let r
    for (let i = 0; i < 5; i++) r = D.verificarCodigo(e, 'login', '000000', { agora, segredo: SEG })
    assert.equal(r.motivo, 'errado'); assert.ok(r.bloqueadoAte > agora, 'o quinto erro já bloqueia')
    const certo = D.totp(SEG, passo)
    assert.equal(D.verificarCodigo(e, 'login', certo, { agora, segredo: SEG }).motivo, 'bloqueado', 'nem o código certo passa bloqueado')
    assert.deepEqual(D.verificarCodigo(e, 'religar', certo, { agora, segredo: SEG }), { ok: true }, 'o reinício segue livre')
    assert.deepEqual(D.verificarCodigo(e, 'login', D.totp(SEG, passo + 31), { agora: agora + 16 * 60 * 1000, segredo: SEG }), { ok: true }, 'passados 15 minutos, volta')
  })
  await t('CC-869: sem o arquivo do segredo recusa com a causa, nunca aceita', () => {
    const e = { pedidos: [], historico: [], falhas: 0, bloqueadoAte: 0, ultimoPasso: 0, ultimoCommit: {} }
    assert.equal(D.verificarCodigo(e, 'login', '123456').motivo, 'sem-segredo')
  })
  await t('CC-869: a rota /api/verificar responde só sim ou não e nunca devolve o segredo', async () => {
    fs.mkdirSync(process.env.DEPLOY_CONF, { recursive: true })
    fs.writeFileSync(path.join(process.env.DEPLOY_CONF, 'totp.secret'), SEG)
    const srv = D.criarServidor({})
    await new Promise((r) => srv.listen(0, '127.0.0.1', r))
    const base = 'http://127.0.0.1:' + srv.address().port
    const est = await (await fetch(base + '/api/verificar/estado')).json()
    assert.deepEqual(est, { ok: true, finalidades: ['login', 'religar'], configurado: true })
    const cod = D.totp(SEG, Math.floor(Date.now() / 30000))
    const post = (corpo) => fetch(base + '/api/verificar', { method: 'POST', body: JSON.stringify(corpo) }).then((r) => r.text())
    const bom = await post({ finalidade: 'religar', codigo: cod })
    assert.deepEqual(JSON.parse(bom), { ok: true })
    assert.equal(JSON.parse(await post({ finalidade: 'religar', codigo: '000000' })).ok, false)
    for (const resposta of [bom, JSON.stringify(est)]) assert.ok(!resposta.includes(SEG), 'o segredo nunca sai nas respostas')
    await new Promise((r) => srv.close(r))
  })

  await t('build com link simbólico é recusado (não expõe arquivo do sistema pelo site)', () => {
    const d = path.join(casa, 'build-mau'); fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, 'index.html'), 'oi')
    fs.symlinkSync('/etc/passwd', path.join(d, 'senhas.txt'))
    assert.throws(() => D.inspecionar(d), /link simbólico/)
    const sem = path.join(casa, 'build-sem-index'); fs.mkdirSync(sem)
    assert.throws(() => D.inspecionar(sem), /index.html/)
  })

  // um site estático de mentira: repo com dist pronto, destino com a versão velha
  const repo = path.join(casa, 'repo'); const dist = path.join(repo, 'dist'); const destino = path.join(casa, 'www', 'site')
  fs.mkdirSync(dist, { recursive: true }); fs.mkdirSync(destino, { recursive: true })
  fs.writeFileSync(path.join(destino, 'index.html'), 'VELHO')
  const alvo = { id: 'site', nome: 'site', repo, dir: '.', build: 'true', saida: 'dist', destino, url: 'https://exemplo/', usuarioBuild: null }

  await t('deploy estático: troca, guarda cópia e confere o site servindo o arquivo novo', async () => {
    fs.writeFileSync(path.join(dist, 'index.html'), 'NOVO-1')
    let log = ''
    const r = await D.deployEstatico(alvo, {}, { log: (s) => { log += s }, buscar: async () => ({ status: 200, text: async () => fs.readFileSync(path.join(destino, 'index.html'), 'utf8') }) })
    assert.equal(fs.readFileSync(path.join(destino, 'index.html'), 'utf8'), 'NOVO-1')
    assert.ok(fs.existsSync(r.copia), 'a cópia da versão anterior existe')
    assert.equal(fs.readFileSync(path.join(destino + '.antigo', 'index.html'), 'utf8'), 'VELHO')
  })

  await t('deploy estático: site não serve o novo, a versão anterior volta sozinha', async () => {
    fs.writeFileSync(path.join(dist, 'index.html'), 'NOVO-2')
    await assert.rejects(D.deployEstatico(alvo, {}, { log: () => {}, buscar: async () => ({ status: 502, text: async () => 'erro' }) }), /anterior foi devolvida/)
    assert.equal(fs.readFileSync(path.join(destino, 'index.html'), 'utf8'), 'NOVO-1', 'voltou a que estava no ar')
    assert.equal(fs.readFileSync(path.join(destino + '.falhou', 'index.html'), 'utf8'), 'NOVO-2')
  })

  // CC-935: a árvore inteira (caminhos + bytes) vira uma impressão digital, para provar "byte a byte"
  const crypto = await import('node:crypto')
  const digital = (dir) => {
    const h = crypto.createHash('sha256')
    const andar = (d) => { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) { h.update('D:' + path.relative(dir, p) + '\n'); andar(p) } else { h.update('F:' + path.relative(dir, p) + '\n'); h.update(fs.readFileSync(p)) } } }
    andar(dir); return h.digest('hex')
  }
  const escrever = (dir, arquivos) => { fs.rmSync(dir, { recursive: true, force: true }); for (const [n, c] of Object.entries(arquivos)) { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), c) } }
  const serve = (dest) => async () => ({ status: 200, text: async () => fs.readFileSync(path.join(dest, 'index.html'), 'utf8') })

  await t('CC-935: um deploy estático é desfeito pelo deploy seguro, byte a byte; a volta também se desfaz', async () => {
    const repoV = path.join(casa, 'repo-volta'); const distV = path.join(repoV, 'dist'); const dest = path.join(casa, 'www', 'volta')
    const v1 = { 'index.html': '<h1>v1</h1>', 'assets/logo.bin': Buffer.from([0, 255, 1, 254, 2, 253]), 'sub/fundo/x.txt': 'só existe na v1' }
    const v2 = { 'index.html': '<h1>v2</h1>', 'assets/logo.bin': Buffer.from([9, 9, 9]), 'novo.txt': 'só existe na v2' }
    escrever(dest, v1); escrever(distV, v2)
    const d1 = digital(dest)
    const alvoV = { id: 'volta', nome: 'volta', repo: repoV, dir: '.', build: 'true', saida: 'dist', destino: dest, url: 'https://exemplo/', usuarioBuild: null }
    await assert.rejects(D.reverterEstatico(alvoV, {}, { log: () => {}, buscar: serve(dest) }), /não há versão anterior/, 'sem cópia guardada, recusa sem tocar em nada')
    assert.equal(digital(dest), d1)
    await D.deployEstatico(alvoV, {}, { log: () => {}, buscar: serve(dest) })
    const d2 = digital(dest)
    assert.notEqual(d2, d1, 'o deploy trocou a versão')
    assert.ok(fs.existsSync(path.join(dest, 'novo.txt')))
    await new Promise((r) => setTimeout(r, 5)) // o nome da cópia leva a data em milissegundos
    let log = ''
    await D.reverterEstatico(alvoV, {}, { log: (s) => { log += s }, buscar: serve(dest) })
    assert.equal(digital(dest), d1, 'voltou a versão anterior, byte a byte (arquivos, pastas e conteúdo)')
    assert.ok(!fs.existsSync(path.join(dest, 'novo.txt')) && fs.existsSync(path.join(dest, 'sub/fundo/x.txt')), 'o que só existia na v2 saiu, o que só existia na v1 voltou')
    assert.match(log, /conferindo o site/)
    assert.deepEqual(fs.readdirSync(path.dirname(dest)).filter((n) => n.startsWith('.voltar-')), [], 'não sobra pasta temporária')
    await new Promise((r) => setTimeout(r, 5))
    await D.reverterEstatico(alvoV, {}, { log: () => {}, buscar: serve(dest) })
    assert.equal(digital(dest), d2, 'repetir o pedido desfaz a volta: a v2 está de novo no ar')
    await new Promise((r) => setTimeout(r, 5))
    await assert.rejects(D.reverterEstatico(alvoV, {}, { log: () => {}, buscar: async () => ({ status: 502, text: async () => 'erro' }) }), /foi devolvida/)
    assert.equal(digital(dest), d2, 'a volta que o site não serviu foi desfeita sozinha')
  })

  await t('CC-935: deploy de processo é desfeito: devolve os arquivos da cópia anterior, religa e confere', async () => {
    const prod = path.join(casa, 'opt', 'volta-proc'); const work = path.join(casa, 'work-volta')
    escrever(prod, { 'app.txt': 'v1', '.env': 'SENHA=prod', 'lib/a.js': 'a1' }); escrever(work, { 'app.txt': 'v2', 'lib/a.js': 'a2' })
    const antes = digital(prod)
    const chamadas = []
    const exec = async (cmd, args, op) => { chamadas.push(cmd); return cmd === 'docker' ? { ok: true } : D.rodar(cmd, args, op) }
    const alvoP = { id: 'volta-proc', tipo: 'docker', repo: work, dir: '.', dirProducao: prod, url: 'https://x/' }
    await D.deployProcesso(alvoP, {}, { log: () => {}, exec, buscar: async () => ({ status: 200 }), esperaMs: 1 })
    assert.equal(fs.readFileSync(path.join(prod, 'app.txt'), 'utf8'), 'v2')
    await new Promise((r) => setTimeout(r, 5))
    await D.reverterProcesso(alvoP, {}, { log: () => {}, exec, buscar: async () => ({ status: 200 }), esperaMs: 1 })
    assert.equal(digital(prod), antes, 'a pasta de produção voltou como estava antes do deploy, byte a byte')
    assert.equal(chamadas.filter((c) => c === 'docker').length, 2, 'religou o container no deploy e na volta')
    await new Promise((r) => setTimeout(r, 5))
    await assert.rejects(D.reverterProcesso(alvoP, {}, { log: () => {}, exec, buscar: async () => ({ status: 502 }), esperaMs: 1 }), /foi devolvida/)
    assert.equal(digital(prod), antes, 'volta que não subiu é desfeita sozinha')
  })

  await t('descoberta: lê nginx, Docker, PM2 e portas, e sugere o repositório', () => {
    const sites = D.lerNginx([{ nome: 'a', texto: 'server { server_name ibrics.carzo.com.br; location / { proxy_pass http://127.0.0.1:3003; } }\nserver { server_name x.com.br; location / { return 410; } }\nserver { server_name mnzs.carzo.com.br; root /var/www/mnzs; }\nserver { server_name app.ex.com.br; root /var/www/ex; location /api/ { proxy_pass http://127.0.0.1:3001; } }' }])
    assert.deepEqual(sites.map((s) => s.dominio), ['ibrics.carzo.com.br', 'mnzs.carzo.com.br', 'app.ex.com.br'], 'site desligado (410) fica de fora')
    const docker = D.lerDocker(JSON.stringify({ Names: 'ibrics-web', Ports: '127.0.0.1:3003->3000/tcp', Labels: 'com.docker.compose.project.working_dir=/opt/web_ibrics,com.docker.compose.service=web' }))
    assert.deepEqual(docker.get(3003), { container: 'ibrics-web', dir: '/opt/web_ibrics', servico: 'web' })
    const portas = D.lerPortas('LISTEN 0 511 127.0.0.1:3001 0.0.0.0:* users:(("node",pid=77,fd=18))')
    const pm2 = D.lerPm2(JSON.stringify([{ name: 'ex', pid: 77, pm2_env: { pm_cwd: '/var/www/ex' } }]), portas)
    assert.deepEqual(pm2.get(3001), { processo: 'ex', dir: '/var/www/ex' })
    const repos = ['/p/VPS_ibrics', '/p/VPS_mnzs', '/p/VPS_ex']
    const sug = D.montarSugestoes({ sites, docker, pm2, repos, alvos: [{ destino: '/var/www/mnzs' }] })
    assert.deepEqual(sug.map((s) => [s.dominio, s.tipo, s.repo]), [['ibrics.carzo.com.br', 'docker', '/p/VPS_ibrics'], ['app.ex.com.br', 'pm2', '/p/VPS_ex']], 'mnzs já cadastrado sai; a pasta do processo PM2 não vira site estático')
  })

  await t('cadastro: só aceita caminhos e comandos dentro do permitido', () => {
    const base = { id: 'Site X', tipo: 'docker', repo: '/home/claudedev/projetos/VPS_cockpit', dirProducao: '/opt/web_x', url: 'https://x.carzo.com.br/' }
    assert.equal(D.validarAlvo(base).id, 'site-x')
    assert.throws(() => D.validarAlvo({ ...base, dirProducao: '/etc' }), /produção fora/)
    assert.throws(() => D.validarAlvo({ ...base, repo: '/root' }), /repositório fora/)
    assert.throws(() => D.validarAlvo({ ...base, url: 'https://x.com/; rm -rf' }), /endereço/)
    assert.throws(() => D.validarAlvo({ ...base, tipo: 'estatico', destino: '/var/www/x', build: 'npm run build && curl mau' }), /build não permitido/)
    assert.throws(() => D.validarAlvo({ ...base, tipo: 'pm2', processo: 'x; reboot' }), /processo inválido/)
  })

  await t('deploy de processo: copia sem apagar, religa, confere; se não responder, devolve a cópia', async () => {
    const prod = path.join(casa, 'opt', 'site'); const work = path.join(casa, 'work')
    fs.mkdirSync(prod, { recursive: true }); fs.mkdirSync(work, { recursive: true })
    fs.writeFileSync(path.join(prod, 'app.txt'), 'v1'); fs.writeFileSync(path.join(prod, '.env'), 'SENHA=prod')
    fs.writeFileSync(path.join(work, 'app.txt'), 'v2'); fs.writeFileSync(path.join(work, '.env'), 'SENHA=dev')
    const chamadas = []
    const exec = async (cmd, args, op) => { chamadas.push(cmd + ' ' + args.slice(0, 2).join(' ')); if (cmd === 'docker') return { ok: true }; return D.rodar(cmd, args, op) }
    const alvoP = { id: 'site', tipo: 'docker', repo: work, dir: '.', dirProducao: prod, url: 'https://x/' }
    await D.deployProcesso(alvoP, {}, { log: () => {}, exec, buscar: async () => ({ status: 200 }), esperaMs: 1 })
    assert.equal(fs.readFileSync(path.join(prod, 'app.txt'), 'utf8'), 'v2', 'o código novo foi')
    assert.equal(fs.readFileSync(path.join(prod, '.env'), 'utf8'), 'SENHA=prod', 'a senha da produção não foi tocada')
    assert.ok(chamadas.some((c) => c.startsWith('docker compose up')), 'religou o container')
    fs.writeFileSync(path.join(work, 'app.txt'), 'v3-quebrada')
    await assert.rejects(D.deployProcesso(alvoP, {}, { log: () => {}, exec, buscar: async () => ({ status: 502 }), esperaMs: 1 }), /anterior foi devolvida/)
    assert.equal(fs.readFileSync(path.join(prod, 'app.txt'), 'utf8'), 'v2', 'voltou a versão que estava no ar')
  })

  await t('serviço do sistema (o coepiloto): descoberto pelo processo, religa sem tocar na pasta do projeto', async () => {
    const lido = D.lerOutro(9, (f) => (f.endsWith('cgroup') ? '0::/system.slice/coepiloto.service\n' : 'python\0-m\0uvicorn\0'), () => '/home/claudedev/projetos/VPS_coepiloto')
    assert.deepEqual(lido, { unidade: 'coepiloto.service', dir: '/home/claudedev/projetos/VPS_coepiloto', comando: 'python -m uvicorn' })
    const sites = D.lerNginx([{ nome: 'a', texto: 'server { server_name coepiloto.carzo.com.br; location / { proxy_pass http://127.0.0.1:5174; } }\nserver { server_name solto.com.br; location / { proxy_pass http://127.0.0.1:4000; } }\nserver { server_name a.com.br; root /var/www/a; location /i/ { alias /var/www/a/icons; } }' }])
    const outros = new Map([[5174, lido], [4000, { unidade: null, dir: '/opt/solto', comando: 'node x.js' }]])
    const sug = D.montarSugestoes({ sites, docker: new Map(), pm2: new Map(), outros, repos: ['/home/claudedev/projetos/VPS_coepiloto', '/p/VPS_a'], alvos: [] })
    assert.equal(D.montarSugestoes({ sites, docker: new Map(), pm2: new Map(), outros, repos: [], alvos: [{ url: 'https://solto.com.br/' }] }).filter((x) => x.dominio === 'solto.com.br').length, 0, 'site já cadastrado não volta como porta solta')
    assert.deepEqual(sug.map((s) => [s.dominio, s.tipo, s.unidade || s.destino || s.dirProducao]), [['coepiloto.carzo.com.br', 'systemd', 'coepiloto.service'], ['solto.com.br', 'manual', '/opt/solto'], ['a.com.br', 'estatico', '/var/www/a']], 'a subpasta de ícones não vira site; processo sem dono aparece como manual')
    assert.equal(sug[0].repo, '/home/claudedev/projetos/VPS_coepiloto')
    const base = { id: 'coepiloto', tipo: 'systemd', repo: '/home/claudedev/projetos/VPS_cockpit', dirProducao: '/home/claudedev/projetos/VPS_cockpit', unidade: 'coepiloto.service', url: 'https://coepiloto.carzo.com.br/' }
    assert.equal(D.validarAlvo(base).unidade, 'coepiloto.service')
    assert.throws(() => D.validarAlvo({ ...base, unidade: 'nginx.service' }), /serviço do sistema inválido/, 'o nginx nunca é religado por aqui')
    assert.throws(() => D.validarAlvo({ ...base, unidade: 'x; reboot' }), /serviço do sistema inválido/)
    const proj = path.join(casa, 'coep'); fs.mkdirSync(proj, { recursive: true }); fs.writeFileSync(path.join(proj, 'app.py'), 'meu trabalho')
    const chamadas = []; const exec = async (cmd, args) => { chamadas.push(cmd + ' ' + args.join(' ')); return { ok: true } }
    const alvoS = { id: 'coep', tipo: 'systemd', repo: proj, dir: '.', dirProducao: proj, unidade: 'coepiloto.service', url: 'https://x/' }
    await D.deployProcesso(alvoS, {}, { log: () => {}, exec, buscar: async () => ({ status: 200 }), esperaMs: 1 })
    assert.deepEqual(chamadas, ['systemctl restart coepiloto.service'], 'só religa: nem cópia, nem git, nem tar na pasta dele')
    await assert.rejects(D.deployProcesso(alvoS, {}, { log: () => {}, exec, buscar: async () => ({ status: 502 }), esperaMs: 1 }), /não há versão anterior/)
    assert.equal(fs.readFileSync(path.join(proj, 'app.py'), 'utf8'), 'meu trabalho', 'a falha não mexe na pasta do projeto')
  })

  // o servidor: pedir, recusar código errado, bloquear, confirmar uma vez só
  fs.mkdirSync(process.env.DEPLOY_CONF, { recursive: true })
  fs.writeFileSync(path.join(process.env.DEPLOY_CONF, 'alvos.json'), JSON.stringify([{ ...alvo, repo: casa }]))
  fs.writeFileSync(path.join(process.env.DEPLOY_CONF, 'totp.secret'), SEG)
  const executados = []
  const revertidos = []; let codigoVolta = ''
  const srv = D.criarServidor({ executar: async (a) => { executados.push(a.id); return { copia: 'x' } }, reverter: async (a) => { revertidos.push(a.id); return { copia: '/backup/site-anterior.tar.gz' } } })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${srv.address().port}`
  const post = (u, corpo, tipo = 'application/json') => fetch(base + u, { method: 'POST', headers: { 'content-type': tipo }, body: corpo, redirect: 'manual' })
  try {
    await t('servidor: alvo fora da lista é recusado; pedido válido espera a confirmação', async () => {
      assert.equal((await post('/api/pedir', JSON.stringify({ alvo: 'outro' }))).status, 400)
      const r = await (await post('/api/pedir', JSON.stringify({ alvo: 'site', de: 'teste' }))).json()
      assert.equal(r.ok, true)
      const pg = await (await fetch(base + '/deploy-seguro/')).text()
      assert.match(pg, /código do autenticador/)
      assert.equal(executados.length, 0, 'pedir não publica nada')
    })
    await t('CC-859: a página instala como app: manifesto, ícones e service worker respondem, e a página os aponta', async () => {
      const m = await fetch(base + '/deploy-seguro/app.webmanifest')
      assert.equal(m.status, 200); assert.match(m.headers.get('content-type'), /manifest\+json/)
      const man = await m.json()
      assert.equal(man.name, 'Deploy seguro'); assert.equal(man.start_url, '/deploy-seguro/'); assert.equal(man.scope, '/deploy-seguro/')
      assert.equal(man.display, 'standalone'); assert.equal(man.theme_color, '#2B2F36'); assert.equal(man.background_color, '#2B2F36')
      const outro = JSON.parse((await import('./tools/app-seguranca/app-seguranca.mjs')).manifesto('religar'))
      assert.notEqual(man.name, outro.name, 'cada página é um app com nome próprio'); assert.notEqual(man.scope, outro.scope)
      assert.ok(man.icons.some((i) => i.purpose === 'maskable') && man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512'))
      for (const i of man.icons) { const r = await fetch(base + i.src); assert.equal(r.status, 200, i.src); assert.equal(r.headers.get('content-type').split(';')[0], i.type, i.src) }
      const png = Buffer.from(await (await fetch(base + '/deploy-seguro/icone-192.png')).arrayBuffer())
      assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), 192); assert.equal(png.readUInt32BE(20), 192)
      const sw = await fetch(base + '/deploy-seguro/sw.js')
      assert.equal(sw.status, 200); assert.match(sw.headers.get('content-type'), /javascript/)
      const fonte = await sw.text()
      assert.match(fonte, /addEventListener\('fetch'/); assert.ok(!/caches\.|\.put\(|\.addAll\(/.test(fonte), 'o service worker não guarda resposta nenhuma')
      assert.equal((await fetch(base + '/deploy-seguro/chute.js')).status, 404, 'lista exata, não prefixo')
      const res = await fetch(base + '/deploy-seguro/'); const pg = await res.text()
      assert.match(pg, /<link rel="manifest" href="\/deploy-seguro\/app\.webmanifest">/)
      assert.ok(pg.includes('<script>' + (await import('./tools/app-seguranca/app-seguranca.mjs')).scriptRegistro('deploy') + '</script>'), 'o script da página é o que a CSP carimbou')
      const csp = res.headers.get('content-security-policy')
      assert.ok(csp.includes((await import('./tools/app-seguranca/app-seguranca.mjs')).hashRegistro('deploy')) && /manifest-src 'self'/.test(csp) && /worker-src 'self'/.test(csp), 'a CSP deixa o registro, o manifesto e o worker passarem')
      assert.match(csp, /default-src 'none'/); assert.equal(res.headers.get('cache-control'), 'no-store', 'a página continua sem cache')
    })
    const id =D.lerEstado().pedidos[0].id
    const form = (codigo) => new URLSearchParams({ id, codigo }).toString()
    await t('servidor: código errado não publica, e 5 erros bloqueiam', async () => {
      for (let i = 0; i < 5; i += 1) await post('/deploy-seguro/confirmar', form('000000'), 'application/x-www-form-urlencoded')
      assert.equal(executados.length, 0)
      assert.ok(D.lerEstado().bloqueadoAte > Date.now(), 'bloqueado')
      const certo = D.totp(SEG, Math.floor(Date.now() / 30000))
      const r = await post('/deploy-seguro/confirmar', form(certo), 'application/x-www-form-urlencoded')
      assert.match(decodeURIComponent(r.headers.get('location')), /bloqueado/)
      assert.equal(executados.length, 0, 'nem o código certo passa durante o bloqueio')
    })
    await t('servidor: código certo publica uma vez; o mesmo código não serve de novo', async () => {
      const e = D.lerEstado(); e.bloqueadoAte = 0; e.falhas = 0; D.gravarEstado(e)
      const certo = D.totp(SEG, Math.floor(Date.now() / 30000))
      await post('/deploy-seguro/confirmar', form(certo), 'application/x-www-form-urlencoded')
      await new Promise((r) => setTimeout(r, 100))
      assert.deepEqual(executados, ['site'])
      await post('/api/pedir', JSON.stringify({ alvo: 'site' }))
      const id2 = D.lerEstado().pedidos.find((p) => p.estado === 'esperando').id
      await post('/deploy-seguro/confirmar', new URLSearchParams({ id: id2, codigo: certo }).toString(), 'application/x-www-form-urlencoded')
      await new Promise((r) => setTimeout(r, 100))
      assert.deepEqual(executados, ['site'], 'o código já usado é recusado')
    })
    await t('servidor: confirmar pelo cartão do Cockpit (JSON) segue as mesmas regras; recusar tira o pedido', async () => {
      const id3 = D.lerEstado().pedidos.find((p) => p.estado === 'esperando').id
      const errado = await (await post('/api/confirmar', JSON.stringify({ id: id3, codigo: '123' }))).json()
      assert.equal(errado.ok, false); assert.match(errado.msg, /código errado/)
      const rec = await (await post('/api/recusar', JSON.stringify({ id: id3 }))).json()
      assert.equal(rec.ok, true)
      assert.equal(D.lerEstado().pedidos.some((p) => p.id === id3), false, 'saiu da lista de esperando')
      assert.equal(D.lerEstado().historico[0].estado, 'recusado')
    })
    await t('CC-935: pedir a volta passa pela mesma confirmação com código e só então chama a volta', async () => {
      assert.equal((await post('/api/pedir', JSON.stringify({ alvo: 'site', de: 'agente-x', reverter: true }))).status, 200)
      const pv = D.lerEstado().pedidos.find((p) => p.estado === 'esperando')
      assert.equal(pv.acao, 'reverter'); assert.match(pv.voltaPara, /^site-.*\.tar\.gz$/)
      assert.match(await (await fetch(base + '/deploy-seguro/')).text(), /confirmar e voltar/)
      assert.equal(revertidos.length, 0, 'pedir a volta não volta nada')
      const errado = await (await post('/api/confirmar', JSON.stringify({ id: pv.id, codigo: '000000' }))).json()
      assert.equal(errado.ok, false); assert.equal(revertidos.length, 0)
      codigoVolta = D.totp(SEG, Math.floor(Date.now() / 30000) + 1) // o passo seguinte: o anterior já foi gasto no deploy
      const bom = await (await post('/api/confirmar', JSON.stringify({ id: pv.id, codigo: codigoVolta }))).json()
      assert.equal(bom.ok, true, bom.msg)
      await new Promise((r) => setTimeout(r, 100))
      assert.deepEqual(revertidos, ['site']); assert.deepEqual(executados, ['site'], 'a volta não passa pelo caminho do deploy')
      assert.equal(D.lerEstado().historico[0].estado, 'revertido')
    })
    await t('CC-933: o deploy e a volta deixaram linhas no registro de auditoria, sem nenhum código nem segredo', () => {
      const bruto = fs.readFileSync(process.env.COCKPIT_AUDITORIA, 'utf8')
      const linhas = bruto.trim().split('\n').map((l) => JSON.parse(l))
      const acoes = linhas.map((l) => l.acao)
      for (const a of ['deploy-pedido', 'codigo-recusado', 'deploy-confirmado', 'deploy-resultado', 'deploy-recusado', 'rollback-pedido', 'rollback-confirmado', 'rollback-resultado', 'segundo-fator']) assert.ok(acoes.includes(a), 'falta a linha ' + a)
      assert.ok(linhas.every((l) => l.em && l.acao), 'toda linha tem data e ação')
      const pedido = linhas.find((l) => l.acao === 'rollback-pedido'); assert.equal(pedido.quem, 'agente-x'); assert.equal(pedido.alvo, 'site')
      assert.equal(linhas.find((l) => l.acao === 'rollback-resultado').ok, true)
      assert.ok(linhas.some((l) => l.acao === 'codigo-recusado' && l.ok === false))
      const certo = D.totp(SEG, Math.floor(Date.now() / 30000))
      for (const proibido of [SEG, codigoVolta, certo, '000000']) assert.ok(!bruto.includes(proibido), 'o registro nunca guarda código nem segredo')
    })
    await t('CC-933: se o registro não puder ser gravado, a ação segue e o aviso sai no stderr', async () => {
      const { registrar } = await import('./tools/auditoria/auditoria.mjs')
      const guardado = process.env.COCKPIT_AUDITORIA; const err = process.stderr.write.bind(process.stderr); let aviso = ''
      process.env.COCKPIT_AUDITORIA = path.join(casa, 'auditoria.jsonl', 'dentro-de-arquivo.jsonl') // o "pai" é um arquivo: impossível
      process.stderr.write = (s) => { aviso += s; return true }
      let r; try { r = registrar({ acao: 'teste', ok: true }) } finally { process.stderr.write = err; process.env.COCKPIT_AUDITORIA = guardado }
      assert.equal(r, false); assert.match(aviso, /auditoria: não consegui registrar/)
    })
  } finally { srv.close() }
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`\n${ok} verificações do deploy seguro, todas passaram`)
