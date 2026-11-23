// CC-1080, passos 2 e 3: o painel da cápsula (rotas /api/capsula/* e a tela Cápsulas).
// Casa falsa, registro falso e Docker FALSO (tools/capsula/docker-falso.mjs). Nenhum comando docker de verdade, nenhum projeto real.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { WIN } from './test/windows.mjs'

// CC-1118: a cápsula é da VPS (registro na máquina VPS, falsos de pm2 e crontab em shell, tar GNU, gpg). Roda lá.
if (WIN) { console.log('test-capsula-painel: PULADO no Windows (precisa de tar GNU, gpg, /bin/sh e do registro da VPS)'); process.exit(0) }

const T =fs.mkdtempSync(path.join(os.tmpdir(), 'test-capsula-painel-'))
const CASA = path.join(T, 'casa')
const HOME_CLAUDE = path.join(CASA, '.claude')
const CAPS = path.join(CASA, 'caps')
fs.mkdirSync(HOME_CLAUDE, { recursive: true })
process.env.HOME = CASA
process.env.USERPROFILE = CASA // CC-1118: no Windows os.homedir() lê USERPROFILE, não HOME
process.env.CC_HOME = HOME_CLAUDE
process.env.CC_CAPSULAS = CAPS
process.env.CC_SEM_NAVEGADOR = '1'

const { criarFalso, criarProjetoDocker, prepararGpg, SENHA_DO_BANCO } = await import('./tools/capsula/docker-falso.mjs')
const { criarServidorFalso } = await import('./tools/capsula/servidor-falso.mjs')
const gpgReal = prepararGpg(T)
const falso = criarFalso(T)
falso.ligar() // CC_DOCKER_BIN aponta para o falso; os processos filhos herdam
const FD = criarProjetoDocker(T, falso)
// o servidor também é FALSO: nginx, unidades, pm2 e crontab de mentira (o job é um processo filho e herda estas variáveis)
const SF = criarServidorFalso(T)
const binS = path.join(T, 'bin-servidor-painel'); fs.mkdirSync(binS)
fs.writeFileSync(path.join(binS, 'pm2'), '#!/bin/sh\necho "[]"\n', { mode: 0o755 })
fs.writeFileSync(path.join(binS, 'crontab'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
process.env.CC_NGINX_DIR = SF.nginxDir
process.env.CC_UNIT_DIR = SF.readers.unitDir
process.env.CC_PM2_BIN = path.join(binS, 'pm2')
process.env.CC_CRONTAB_BIN = path.join(binS, 'crontab')

// um segundo projeto, sem Docker, e um terceiro cuja pasta não existe nesta máquina
const SEM = path.join(T, 'meus', 'projeto-sem-docker'); fs.mkdirSync(SEM, { recursive: true }); fs.writeFileSync(path.join(SEM, 'a.txt'), 'oi')
const reg = (id, raiz) => ({ id, nome: id, estado: 'ativo', cliente: null, ativo: true, site: null, github: null, maquinas: { VPS: { provisionado: true, raiz } }, criadoEm: 1, criadoPor: null })
fs.writeFileSync(path.join(HOME_CLAUDE, 'cockpit-projetos.json'), JSON.stringify({ projetos: [reg('fe-teste-site', FD.raiz), reg('projeto-sem-docker', SEM), reg('delta', SF.delta), reg('so-no-pc', 'D:\\\\Documentos\\\\so-no-pc')] }))

const SENHA = 'senha-do-painel-NAO-VAZAR-2026'
let n = 0
const t = async (nome, fn) => { await fn(); n += 1; console.log('  ok   ' + nome) }
const livrePorta = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)) }) })
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const espera = async (fn, ms = 180000) => { const f = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > f) throw new Error('tempo esgotado'); await dorme(300) } }
const medirPeloServidor = async (base, projeto, extra = {}) => {
  // o Estimar de verdade: POST devolve o id; o resultado vem no andamento (a medição é de um processo filho)
  const r = await fetch(base + '/api/capsula/ensaio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projeto, ...extra }) }).then(async (x) => ({ status: x.status, ...(await x.json()) }))
  if (!r.ok) return r
  const s = await espera(async () => { const e = await fetch(base + '/api/capsula/estado/' + r.id).then((x) => x.json()); return e.fim ? e : null }, 60000)
  return { status: 200, ...(s.resultado || {}), ok: s.ok === true, error: s.erro, andamento: s }
}
const grepSenha = (dir, senha) => spawnSync('grep', ['-rl', '--binary-files=text', '-e', senha, dir], { encoding: 'utf8' }).stdout.trim()

const P = await import('./src/capsulaPainel.mjs')
let srv = null
try {
  await t('projetosLocais: só os do registro que têm pasta nesta máquina', () => {
    assert.deepEqual(P.projetosLocais().map((p) => p.id).sort(), ['delta', 'fe-teste-site', 'projeto-sem-docker'])
  })

  await t('lista vazia: projetos, disco livre e nenhum andamento', async () => {
    const l = await P.lista()
    assert.equal(l.projetos.length, 3); assert.equal(l.ativo, null); assert.ok(l.livre > 0); assert.equal(l.minimo, 2 * 1024 ** 3)
    assert.ok(l.projetos.every((p) => p.capsulas.length === 0))
  })

  await t('ensaio: mede a pasta e a parte Docker, só pelo registro', async () => {
    const e = await P.ensaio('fe-teste-site')
    assert.equal(e.docker.projeto_compose, 'fe-teste'); assert.equal(e.docker.volumes.length, 2); assert.ok(e.bytes_total > e.bytes); assert.equal(typeof e.cabe, 'boolean')
    assert.deepEqual(e.segredos, ['.env'])
    for (const ruim of ['nao-existe', '/etc', '../..', '/home', 'so-no-pc']) await assert.rejects(() => P.ensaio(ruim), /não está no registro/, `recusa "${ruim}"`)
    const sem = await P.ensaio('projeto-sem-docker')
    assert.equal(sem.docker.projeto_compose, null)
  })

  await t('ensaio mostra os blocos do nginx achados (com o motivo) e os domínios, ANTES de fazer', async () => {
    const e = await P.ensaio('fe-teste-site')
    assert.equal(e.servidor.nginx.lido, true)
    assert.deepEqual(e.servidor.nginx.arquivos.map((f) => f.arquivo), ['fe-teste'])
    const b = e.servidor.nginx.arquivos[0].blocos[0]
    assert.equal(b.certeza, 'certo'); assert.match(b.motivos[0].motivo, /porta 3055.*Docker, serviço web/)
    assert.deepEqual(e.servidor.dominios.map((d) => d.dominio), ['fe.exemplo.com'])
    assert.equal(e.servidor.pm2.lido, false, 'o ensaio não consulta o PM2 (travaria o painel)')
    assert.ok(!JSON.stringify(e.servidor).includes('upstream'), 'o resumo não leva o texto dos arquivos')
    const so = await P.ensaio('projeto-sem-docker')
    assert.equal(so.servidor.nginx.arquivos.length, 0)
  })

  await t('ensaio do site publicado: pastas root/alias de fora separadas em certas e candidatas, com tamanho, e o candidato só conta se marcado', async () => {
    const e = await P.ensaio('delta')
    const pa = e.servidor.publicado_achado
    assert.deepEqual(pa.map((x) => `${x.caminho.split('/').pop()}:${x.certeza}`).sort(), ['delta-midia:certo', 'delta-promo:candidato', 'delta-publico:certo', 'delta-trancado:certo'])
    assert.ok(e.bytes_publicado > 0 && e.bytes_publicado_candidatas > 0)
    assert.equal(e.bytes_total, e.bytes + e.bytes_publicado, 'sem marcar, o candidato não entra na conta de disco')
    assert.equal(typeof e.cabe_com_candidatos, 'boolean')
    const c = await P.ensaio('delta', { incluirCandidatos: true })
    assert.equal(c.bytes_total, e.bytes_total + e.bytes_publicado_candidatas, 'marcando, entra')
    assert.ok(!JSON.stringify(e.servidor).includes('CHAVE-PRIVADA'), 'o ensaio não leva conteúdo de arquivo')
  })

  // ---- o Estimar não trava o painel: a medição é de um processo filho, com id, andamento e teto de tempo ---------------
  const livreDeEnsaio = () => espera(() => (P.ensaioAtivo() ? null : true), 20000)
  await t('iniciarEnsaio: devolve o id na hora e o resultado chega pelo estado, igual ao da medição direta', async () => {
    const t0 = Date.now()
    const r = P.iniciarEnsaio('fe-teste-site')
    assert.match(r.id, /^[0-9a-f]{16}$/); assert.equal(r.projeto, 'fe-teste-site')
    assert.ok(Date.now() - t0 < 500, 'o id volta na hora, sem esperar a medição')
    const s = await espera(() => { const e = P.estado(r.id); return e.fim ? e : null }, 60000)
    assert.equal(s.ok, true, JSON.stringify(s).slice(0, 300)); assert.equal(s.tipo, 'ensaio'); assert.equal(s.fase, 'pronta')
    assert.equal(s.resultado.docker.projeto_compose, 'fe-teste'); assert.equal(s.resultado.docker.volumes.length, 2)
    assert.deepEqual(s.resultado.segredos, ['.env']); assert.equal(typeof s.resultado.cabe, 'boolean')
    const direto = await P.ensaio('fe-teste-site')
    assert.equal(s.resultado.bytes_total, direto.bytes_total); assert.deepEqual(s.resultado.servidor.dominios, direto.servidor.dominios)
    await livreDeEnsaio()
  })
  await t('iniciarEnsaio: projeto fora do registro é recusado, e nenhuma senha é pedida nem aparece', async () => {
    for (const ruim of ['/etc', '../..', 'so-no-pc', 'nao-existe']) assert.throws(() => P.iniciarEnsaio(ruim), /não está no registro/, ruim)
    assert.equal(P.ensaioAtivo(), null)
  })
  await t('iniciarEnsaio: o mesmo projeto de novo acompanha a mesma medição; outro projeto espera a vez', async () => {
    const a = P.iniciarEnsaio('delta', { atrasoMs: 1500 })
    const b = P.iniciarEnsaio('delta', { atrasoMs: 1500 })
    assert.equal(b.id, a.id); assert.equal(b.ja_medindo, true)
    assert.throws(() => P.iniciarEnsaio('fe-teste-site'), /já tem uma medição em andamento \(VPS_delta\)/)
    assert.equal(P.jobAtivo(), null, 'medir não conta como fazer cápsula')
    const s = await espera(() => { const e = P.estado(a.id); return e.fim ? e : null }, 60000)
    assert.equal(s.ok, true); assert.equal(s.resultado.servidor.publicado_achado.length, 4)
    await livreDeEnsaio()
  })
  await t('iniciarEnsaio: estourou o teto, o processo é morto e a mensagem diz o que houve; depois já dá para medir de novo', async () => {
    const r = P.iniciarEnsaio('projeto-sem-docker', { tetoMs: 1000, atrasoMs: 8000 })
    const t0 = Date.now()
    const s = await espera(() => { const e = P.estado(r.id); return e.fim ? e : null }, 30000)
    assert.equal(s.ok, false); assert.equal(s.fase, 'falhou'); assert.match(s.erro, /a medição passou de 1 s e foi interrompida .*disco lento.*segunda vez/)
    assert.ok(Date.now() - t0 < 6000, 'foi interrompida pelo teto, não esperou o atraso inteiro')
    await livreDeEnsaio()
    const r2 = P.iniciarEnsaio('projeto-sem-docker')
    const s2 = await espera(() => { const e = P.estado(r2.id); return e.fim ? e : null }, 60000)
    assert.equal(s2.ok, true); await livreDeEnsaio()
  })
  await t('estado de uma medição que o painel perdeu (reinício): diz "meça de novo"', () => {
    fs.mkdirSync(path.join(CAPS, '.estado'), { recursive: true })
    fs.writeFileSync(path.join(CAPS, '.estado', 'aaaaaaaaaaaaaaaa.json'), JSON.stringify({ id: 'aaaaaaaaaaaaaaaa', tipo: 'ensaio', projeto: 'x', inicio: 1, fase: 'medindo', ok: null }))
    const e = P.estado('aaaaaaaaaaaaaaaa')
    assert.equal(e.ok, false); assert.match(e.erro, /reiniciou no meio da medição; meça de novo/)
  })

  await t('fazer recusa senha curta ou com quebra de linha, e projeto fora do registro', () => {
    for (const s of ['', 'curta', 'a'.repeat(11), undefined, 12345678901234, 'a'.repeat(12) + '\nb']) assert.throws(() => P.iniciar('fe-teste-site', s), /12 caracteres|quebra de linha/)
    assert.throws(() => P.iniciar('/etc', SENHA), /não está no registro/)
    assert.equal(P.jobAtivo(), null, 'nada começou')
  })

  let id, arquivo
  await t('fazer: devolve o id na hora, recusa um segundo ao mesmo tempo, e termina provada', async () => {
    falso.zerarLog()
    const r = P.iniciar('fe-teste-site', SENHA)
    id = r.id
    assert.match(id, /^[0-9a-f]{16}$/); assert.equal(r.projeto, 'fe-teste-site')
    assert.throws(() => P.iniciar('projeto-sem-docker', SENHA), /já tem uma cápsula/)
    assert.equal(P.jobAtivo().id, id)
    const vistas = new Set()
    let amostraPs = false
    const e = await espera(() => {
      const s = P.estado(id); vistas.add(s.fase)
      if (!amostraPs) { const ps = spawnSync('ps', ['-eo', 'args'], { encoding: 'utf8' }); if (ps.status === 0) { amostraPs = true; assert.ok(!ps.stdout.includes(SENHA), 'a senha apareceu na linha de comando de algum processo') } }
      return s.fim ? s : null
    })
    assert.equal(e.ok, true, JSON.stringify(e)); assert.equal(e.fase, 'pronta'); assert.equal(e.prova.ok, true)
    assert.equal(e.docker.projeto_compose, 'fe-teste'); assert.equal(e.docker.volumes, 2); assert.equal(e.docker.bancos, 2); assert.equal(e.docker.falhas, 0)
    assert.equal(e.servidor.nginx_certos, 1); assert.equal(e.servidor.nginx_candidatos, 0); assert.equal(e.servidor.dominios, 1)
    assert.equal(e.pastas.montagens, 1, 'a pasta montada pelo contêiner (fora do projeto) entrou na cápsula'); assert.equal(e.pastas.publicado, 0)
    assert.ok(vistas.size >= 2, `o andamento mudou de fase: ${[...vistas].join(' > ')}`)
    arquivo = e.arquivo
    assert.ok(fs.existsSync(path.join(CAPS, arquivo)) && e.bytes > 0)
    assert.equal(P.jobAtivo(), null, 'terminou: libera para o próximo')
  })

  await t('fazer o site publicado: as pastas de fora entram, o candidato não, e a lista conta', async () => {
    const r = P.iniciar('delta', SENHA)
    const e = await espera(() => { const s = P.estado(r.id); return s.fim ? s : null })
    assert.equal(e.ok, true, JSON.stringify(e)); assert.match(e.prova.motivo, /2 publicada/)
    assert.equal(e.pastas.publicado, 2); assert.equal(e.pastas.montagens, 0); assert.equal(e.pastas.candidatas_nao_incluidas, 1)
    const l = await P.lista()
    assert.equal(l.projetos.find((x) => x.id === 'delta').capsulas[0].pastas.publicado, 2)
  })

  await t('o Docker falso só recebeu comandos permitidos durante o fazer do painel', () => {
    const L = falso.linhas()
    assert.ok(L.length > 10 && L.every((l) => ['ps', 'inspect', 'image', 'exec', 'run', 'save', 'version'].includes(l.split(' ')[0])))
    assert.ok(!L.some((l) => /^(stop|restart|rm|kill|pull|compose|down|up)\b/.test(l)))
  })

  await t('lista depois: a cápsula aparece com tamanho, data, prova e resumo do Docker', async () => {
    const l = await P.lista()
    const p = l.projetos.find((x) => x.id === 'fe-teste-site')
    assert.equal(p.capsulas.length, 1); const c = p.capsulas[0]
    assert.equal(c.arquivo, arquivo); assert.ok(c.bytes > 0 && c.criada_em); assert.equal(c.provada.ok, true)
    assert.deepEqual([c.docker.imagens, c.docker.volumes, c.docker.bancos, c.docker.falhas], [2, 2, 2, 0])
    assert.equal(c.servidor.nginx_certos, 1); assert.equal(c.servidor.dominios, 1); assert.equal(c.pastas.montagens, 1)
    assert.equal(l.orfas.length, 0)
  })

  await t('baixar: só o arquivo da pasta de cápsulas, nunca caminho', () => {
    const a = P.arquivoParaBaixar(arquivo)
    assert.ok(a && a.bytes === fs.statSync(path.join(CAPS, arquivo)).size)
    for (const ruim of ['../' + arquivo, '..', '../../etc/passwd', '/etc/passwd', 'a/../' + arquivo, '.estado/x.json', arquivo + '/x', 'x.capsula.tar.gz', '..capsula.tar.gz', 'a..b.capsula.tar.gz', '', null, undefined]) assert.equal(P.arquivoParaBaixar(ruim), null, `recusa "${ruim}"`)
  })

  await t('estado: id inválido ou desconhecido dá erro', () => {
    assert.throws(() => P.estado('../../etc'), /inválido/); assert.throws(() => P.estado('0123456789abcdef'), /não conheço/)
  })

  await t('a senha não foi gravada em NENHUM arquivo da casa falsa (nem aberta a cápsula)', () => {
    const aberta = path.join(T, 'aberta'); fs.mkdirSync(aberta)
    assert.equal(spawnSync('tar', ['-xzf', path.join(CAPS, arquivo), '-C', aberta]).status, 0)
    assert.equal(grepSenha(T, SENHA), '', 'a senha apareceu em arquivo')
    assert.notEqual(grepSenha(T, SENHA_DO_BANCO), '', 'controle: o grep acha mesmo uma senha que está no disco (o .env do projeto de teste)')
    assert.equal(grepSenha(T, SENHA_DO_BANCO) && grepSenha(T, SENHA_DO_BANCO).split('\n').filter((f) => !f.includes(`${path.sep}meus${path.sep}`) && !f.includes('inspect.json')).join(), '', 'a senha do banco apareceu fora do projeto de teste e do inspect falso')
  })

  // ---- as rotas, pelo servidor de verdade (casa isolada, Docker falso) --------------------------------------
  const porta = await livrePorta()
  const base = `http://127.0.0.1:${porta}`
  const logSrv = path.join(T, 'servidor.log')
  const fd = fs.openSync(logSrv, 'w')
  // CC_CAPSULA_ENSAIO_ATRASO_MS: a medição do processo filho ganha 2,5 s de bloqueio síncrono, como uma pasta grande a frio
  srv = spawn(process.execPath, ['cc.mjs', '--web-only', '--port', String(porta)], { env: { ...process.env, ...falso.env(), CC_PROJECTS_BASE: path.join(T, 'meus'), CC_CAPSULA_ENSAIO_ATRASO_MS: '2500' }, stdio: ['ignore', fd, fd] })
  await espera(async () => { try { await fetch(base + '/api/jobs'); return true } catch { return false } }, 30000)
  const json = async (r) => ({ status: r.status, ...(await r.json()) })
  const post = (rota, corpo) => fetch(base + rota, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then(json)

  await t('GET /api/capsula/lista pelo servidor', async () => {
    const l = await fetch(base + '/api/capsula/lista').then(json)
    assert.equal(l.status, 200); assert.equal(l.ok, true); assert.equal(l.projetos.length, 3)
    assert.equal(l.projetos.find((p) => p.id === 'fe-teste-site').capsulas.length, 1)
  })
  await t('POST /api/capsula/ensaio pelo servidor, e recusa projeto fora do registro', async () => {
    const e = await medirPeloServidor(base, 'fe-teste-site')
    assert.equal(e.ok, true, JSON.stringify(e).slice(0, 300)); assert.equal(e.docker.volumes.length, 2)
    const ruim = await post('/api/capsula/ensaio', { projeto: '/etc' })
    assert.equal(ruim.status, 400); assert.equal(ruim.ok, false)
  })
  await t('o Estimar NÃO trava o painel: durante uma medição lenta (2,5 s de bloqueio no filho) a lista e outra rota respondem em menos de 1 s', async () => {
    const r = await post('/api/capsula/ensaio', { projeto: 'delta' })
    assert.equal(r.ok, true); assert.match(r.id, /^[0-9a-f]{16}$/)
    const tempos = []
    let fim = null
    while (!fim) {
      for (const rota of ['/api/capsula/lista', '/api/jobs']) {
        const t0 = performance.now(); const x = await fetch(base + rota); await x.arrayBuffer(); tempos.push({ rota, ms: performance.now() - t0, status: x.status })
      }
      const s = await fetch(base + '/api/capsula/estado/' + r.id).then(json)
      if (s.fim) fim = s; else await dorme(100)
      assert.ok(tempos.length < 400, 'a medição não terminou')
    }
    const durante = tempos.filter((x) => x.ms >= 0)
    assert.ok(durante.length >= 8, `poucas amostras durante a medição (${durante.length})`)
    assert.ok(durante.every((x) => x.status === 200))
    const max = Math.max(...durante.map((x) => x.ms))
    console.log(`       ${durante.length} respostas durante a medição de ${((fim.fim - fim.inicio) / 1000).toFixed(1)} s, a mais lenta levou ${max.toFixed(0)} ms`)
    assert.ok(fim.fim - fim.inicio >= 2000, 'a medição simulada durou de fato (o filho bloqueou 2,5 s)')
    assert.ok(max < 1000, `uma rota demorou ${max.toFixed(0)} ms enquanto o Estimar rodava`)
    assert.equal(fim.ok, true); assert.equal(fim.resultado.servidor.publicado_achado.length, 4)
  })
  await t('POST /api/capsula/fazer recusa senha com menos de 12 caracteres (400) e nada começa', async () => {
    const r = await post('/api/capsula/fazer', { projeto: 'fe-teste-site', senha: 'curta' })
    assert.equal(r.status, 400); assert.match(r.error, /12 caracteres/)
    assert.equal((await fetch(base + '/api/capsula/lista').then(json)).ativo, null)
  })
  await t('GET /api/capsula/baixar: entrega o arquivo inteiro como download, e recusa ../', async () => {
    const r = await fetch(base + '/api/capsula/baixar/' + encodeURIComponent(arquivo))
    assert.equal(r.status, 200); assert.match(r.headers.get('content-disposition'), /^attachment; filename=".*\.capsula\.tar\.gz"$/)
    const corpo = Buffer.from(await r.arrayBuffer())
    assert.equal(corpo.length, fs.statSync(path.join(CAPS, arquivo)).size); assert.ok(corpo.equals(fs.readFileSync(path.join(CAPS, arquivo))))
    for (const ruim of ['..%2F' + arquivo, '%2e%2e%2f%2e%2e%2fetc%2fpasswd', '..', '%2Fetc%2Fpasswd', 'inexistente.capsula.tar.gz', '.estado%2F' + id + '.json', 'x%00.capsula.tar.gz']) {
      const e = await fetch(base + '/api/capsula/baixar/' + ruim)
      assert.equal(e.status, 404, `baixar/${ruim} devia ser 404 e foi ${e.status}`)
    }
  })
  await t('POST /api/capsula/fazer pelo servidor: id, andamento e prova; a senha não vai para log nem arquivo', async () => {
    const r = await post('/api/capsula/fazer', { projeto: 'projeto-sem-docker', senha: SENHA })
    assert.equal(r.ok, true); assert.match(r.id, /^[0-9a-f]{16}$/)
    const e = await espera(async () => { const s = await fetch(base + '/api/capsula/estado/' + r.id).then(json); return s.fim ? s : null })
    assert.equal(e.ok, true, JSON.stringify(e)); assert.equal(e.docker.projeto_compose, null)
    assert.equal((await fetch(base + '/api/capsula/estado/ffffffffffffffff').then(json)).status, 404)
    const l = await fetch(base + '/api/capsula/lista').then(json)
    assert.equal(l.projetos.find((p) => p.id === 'projeto-sem-docker').capsulas.length, 1)
  })
  await t('POST /api/capsula/fazer com incluirCandidatos: a pasta do candidato entra (3 publicadas)', async () => {
    let r = await post('/api/capsula/fazer', { projeto: 'delta', senha: SENHA, incluirCandidatos: true })
    // o processo da cápsula anterior grava o fim e só depois sai: dá uns instantes para o painel liberar o próximo
    for (let i = 0; i < 20 && r.ok === false && /já tem uma cápsula/.test(r.error || ''); i++) { await dorme(300); r = await post('/api/capsula/fazer', { projeto: 'delta', senha: SENHA, incluirCandidatos: true }) }
    assert.equal(r.ok, true, JSON.stringify(r))
    const e = await espera(async () => { const s = await fetch(base + '/api/capsula/estado/' + r.id).then(json); return s.fim ? s : null })
    assert.equal(e.ok, true, JSON.stringify(e)); assert.equal(e.pastas.publicado, 3); assert.equal(e.pastas.candidatas_nao_incluidas, 0)
    const en = await medirPeloServidor(base, 'delta', { incluirCandidatos: true })
    assert.equal(en.ok, true); assert.equal(en.incluir_candidatos, true)
  })
  await t('depois das rotas, a senha continua fora de todo arquivo e do log do servidor', () => {
    assert.equal(grepSenha(T, SENHA), '', 'a senha apareceu em arquivo ou no log do servidor')
    assert.ok(fs.statSync(logSrv).size >= 0)
  })

  // ---- a tela ----------------------------------------------------------------------------------------------
  const ui = fs.readFileSync('src/ui_cockpit2.html', 'utf8')
  await t('a tela existe, tem item no menu e chama todas as rotas', () => {
    assert.ok(ui.includes('data-target="view-capsulas"') && ui.includes('id="view-capsulas"') && ui.includes("'view-capsulas': { title: 'Cápsulas'"))
    for (const rota of ['/api/capsula/lista', '/api/capsula/ensaio', '/api/capsula/fazer', '/api/capsula/estado/', '/api/capsula/baixar/']) assert.ok(ui.includes(rota), `a tela não chama ${rota}`)
  })
  await t('a tela mede pelo andamento (id, "Medindo…" e erro de teto), sem campo dentro do bloco redesenhado', () => {
    assert.ok(ui.includes('async function capMedir') && ui.includes("/api/capsula/estado/' + encodeURIComponent(r.id)") && ui.includes('s.resultado') && ui.includes('capSegundos') && ui.includes('Medindo… '))
    const i = ui.indexOf('async function capMedir'), fim = ui.indexOf('/* A caixa da senha.', i)
    assert.ok(i > 0 && fim > i && !/<input|<textarea|<select/.test(ui.slice(i, fim)) && !/[—–]/.test(ui.slice(i, fim)))
    assert.ok(!ui.includes("capPost('/api/capsula/ensaio', { projeto: id }, 180000)") && !ui.includes("capPost('/api/capsula/ensaio', { projeto: p.id }, 180000)"), 'nenhuma chamada espera o ensaio pelo POST')
  })
  await t('a tela mostra os blocos do nginx (certos e candidatos, com o motivo) e os domínios', () => {
    assert.ok(ui.includes('function capServHtml') && ui.includes('capServHtml(e.servidor)') && ui.includes('CANDIDATO') && ui.includes('Ver cada bloco e o motivo') && ui.includes('Não coletado, precisa de root'))
    const i = ui.indexOf('function capServHtml'), fim = ui.indexOf('function capEstHtml', i)
    assert.ok(!/<input|<textarea|<select/.test(ui.slice(i, fim)) && !/[—–]/.test(ui.slice(i, fim)))
  })
  await t('a tela lista as pastas publicadas (certas e candidatas) e tem a caixa de marcar os candidatos FORA do bloco redesenhado', () => {
    assert.ok(ui.includes('publicado_achado') && ui.includes('incluirCandidatos') && ui.includes('Site publicado'))
    const dlg = ui.slice(ui.indexOf('<dialog id="cap-dlg"'), ui.indexOf('</dialog>', ui.indexOf('<dialog id="cap-dlg"')))
    assert.ok(dlg.includes('id="cap-cand"') && dlg.includes('type="checkbox"'))
    const i = ui.indexOf('function capServHtml'), fim = ui.indexOf('function capEstHtml', i)
    assert.ok(!/<input/.test(ui.slice(i, fim)) && !/[—–]/.test(ui.slice(i, fim)))
  })
  await t('a senha mora FORA do bloco redesenhado, e o bloco usa pintar()', () => {
    const tela = ui.slice(ui.indexOf('id="cap-tela"'), ui.indexOf('id="cap-tela"') + 200)
    assert.ok(!/<input|<textarea/.test(tela))
    const i = ui.indexOf('function capRender()'), fim = ui.indexOf('async function capEstimar', i)
    const render = ui.slice(i, fim)
    assert.ok(i > 0 && !/<input|<textarea|<select/.test(render) && render.includes('pintar(el'))
    const dlg = ui.slice(ui.indexOf('<dialog id="cap-dlg"'), ui.indexOf('</dialog>', ui.indexOf('<dialog id="cap-dlg"')))
    assert.ok(dlg.includes('id="cap-s1"') && dlg.includes('id="cap-s2"') && dlg.includes('type="password"'))
  })
  await t('a tela pede a senha duas vezes e mostra tamanho e disco antes de confirmar; sem grade inline', () => {
    assert.ok(ui.includes('Repita a senha') && ui.includes('capDlgCabe') && ui.includes('Disco livre:') && ui.includes('Total estimado:'))
    const bloco = ui.slice(ui.indexOf('CC-1080 passo 2: a tela Cápsulas'), ui.indexOf('data-target="view-capsulas"]\').forEach'))
    assert.ok(bloco.length > 2000 && !/style="[^"]*grid-template-columns/.test(bloco) && !/[—–]/.test(bloco))
  })
} finally {
  if (srv) { srv.kill('SIGTERM'); await dorme(300); try { srv.kill('SIGKILL') } catch { /* já saiu */ } }
  if (!gpgReal) console.log('\nAVISO: o gpg REAL não funciona neste ambiente (sem socket unix). Usei um gpg de mentira feito com openssl.')
  SF.destrancar()
  fs.rmSync(T, { recursive: true, force: true })
}
console.log(`\n${n} verificações ok`)
process.exit(0)
