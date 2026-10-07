// CC-923 e CC-931: a varredura de segurança ASVS, com projetos de mentira numa pasta temporária
// e um servidor HTTP local de mentira para os cabeçalhos. Nada real é lido nem escrito.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import * as V from './tools/varredura-seguranca/varredura.mjs'

let n = 0
const t = async (nome, fn) => { await fn(); n += 1; console.log('  ok   ' + nome) }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-varredura-'))
const base = path.join(tmp, 'projetos'); fs.mkdirSync(base)
const SEGREDO = 'sk-' + 'Z9x'.repeat(10) // chave falsa; o teste confere que ela nunca aparece num relatório
const escreve = (proj, f, txt) => { const p = path.join(base, proj, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt) }
const git = (proj, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', path.join(base, proj), ...a], { stdio: 'ignore' })
const sobe = (headers) => new Promise((ok) => { const s = http.createServer((q, r) => { r.writeHead(200, headers); r.end('ok') }); s.listen(0, '127.0.0.1', () => ok(s)) })
const livre = () => new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)) }) })
const por = (r, asvs, resultado) => r.itens.filter((i) => i.asvs === asvs && (!resultado || i.resultado === resultado))

const servidores = []
try {
  // VPS_ruim: tudo errado de propósito
  git('.', '--version')
  fs.mkdirSync(path.join(base, 'VPS_ruim'))
  git('VPS_ruim', 'init', '-q')
  escreve('VPS_ruim', '.env', `OPENAI_API_KEY=${SEGREDO}\n`)
  escreve('VPS_ruim', 'package.json', JSON.stringify({ dependencies: { express: '^4.0.0' } }))
  escreve('VPS_ruim', 'src/config.js', `export const chave = '${SEGREDO}'\n`)
  escreve('VPS_ruim', 'src/login.js', [
    "import crypto from 'node:crypto'",
    'export function login(req, res) {',
    '  const { email, password } = req.body',
    '  if (password.length < 6) return res.status(400).end()',
    "  const hash = crypto.createHash('md5').update(password).digest('hex')",
    "  res.cookie('sid', hash, { path: '/' })",
    '}',
    'export function buscar(db, nome) {',
    "  return db.query('SELECT * FROM usuarios WHERE nome = ' + nome)",
    '}',
    '',
  ].join('\n'))
  git('VPS_ruim', 'add', '-f', '.')
  git('VPS_ruim', 'commit', '-q', '-m', 'ruim')

  // VPS_bom: o mesmo, certo
  fs.mkdirSync(path.join(base, 'VPS_bom'))
  git('VPS_bom', 'init', '-q')
  escreve('VPS_bom', '.gitignore', '.env\n')
  escreve('VPS_bom', 'package.json', JSON.stringify({ dependencies: { express: '^4.0.0' } }))
  escreve('VPS_bom', 'package-lock.json', '{}')
  escreve('VPS_bom', 'src/login.js', [
    "import bcrypt from 'bcrypt'",
    'export async function login(req, res) {',
    '  const { email, password } = req.body',
    '  if (password.length < 12) return res.status(400).end()',
    '  const ok = await bcrypt.compare(password, guardado)',
    "  res.cookie('sid', ok, { httpOnly: true, secure: true, sameSite: 'strict' })",
    '}',
    'export function buscar(db, nome) {',
    "  return db.query('SELECT * FROM usuarios WHERE nome = $1', [nome])",
    '}',
    '',
  ].join('\n'))
  git('VPS_bom', 'add', '.')
  git('VPS_bom', 'commit', '-q', '-m', 'bom')

  // o que a varredura tem de ignorar
  fs.mkdirSync(path.join(base, 'VPS_bom-nisaba'))
  fs.symlinkSync(path.join(base, 'VPS_bom'), path.join(base, 'VPS_atalho'))
  fs.mkdirSync(path.join(base, 'outra-coisa'))

  const ruim = await sobe({ 'x-content-type-options': 'nosniff' })
  const bom = await sobe({ 'strict-transport-security': 'max-age=31536000; includeSubDomains', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" })
  servidores.push(ruim, bom)
  const url = (s) => `http://127.0.0.1:${s.address().port}/`
  const morta = `http://127.0.0.1:${await livre()}/`
  const urls = { VPS_ruim: [url(ruim)], VPS_bom: [url(bom)] }

  await t('só entram pastas VPS_ de verdade: sem atalho, sem cópia nisaba, sem pasta de outro nome', () => {
    assert.deepEqual(V.listarProjetos(base), ['VPS_bom', 'VPS_ruim'])
  })

  const rs = await V.varrer({ base, raizCockpit: tmp, urls, destino: path.join(tmp, 'saida') })
  const R = Object.fromEntries(rs.map((r) => [r.projeto, r]))
  const md = (p) => fs.readFileSync(path.join(tmp, 'saida', p + '.md'), 'utf8')

  await t('o .env rastreado não cumpre, com o arquivo como prova, sem abrir o conteúdo', () => {
    const i = por(R.VPS_ruim, 'V2.10.4', 'não cumpre').find((x) => /\.env fora/.test(x.titulo))
    assert.ok(i, 'achado .env rastreado')
    assert.match(i.provas[0], /^\.env está rastreado/)
  })
  await t('a chave falsa no código sai com arquivo:linha e tipo', () => {
    const i = por(R.VPS_ruim, 'V2.10.4', 'não cumpre').find((x) => /segredo/.test(x.titulo))
    assert.ok(i)
    assert.ok(i.provas.includes('src/config.js:1 (chave de API (sk-))'), i.provas.join('|'))
  })
  await t('.env sem .gitignore não cumpre; no projeto bom ele é ignorado', () => {
    assert.ok(por(R.VPS_ruim, 'V2.10.4', 'não cumpre').some((x) => /ignorado/.test(x.titulo)))
    assert.ok(por(R.VPS_bom, 'V2.10.4', 'cumpre').some((x) => /ignorado/.test(x.titulo)))
  })
  await t('senha com md5 não cumpre e aponta a linha; bcrypt cumpre', () => {
    assert.match(por(R.VPS_ruim, 'V2.4.1', 'não cumpre')[0].provas[0], /^src\/login\.js:5 /)
    assert.equal(por(R.VPS_bom, 'V2.4.1', 'cumpre').length, 1)
  })
  await t('senha de 6 caracteres não cumpre (V2.1.1); 12 cumpre', () => {
    assert.match(por(R.VPS_ruim, 'V2.1.1', 'não cumpre')[0].provas[0], /^src\/login\.js:4 aceita senha de 6/)
    assert.equal(por(R.VPS_bom, 'V2.1.1', 'cumpre').length, 1)
  })
  await t('cookie sem HttpOnly, Secure e SameSite não cumpre com a linha; o bom cumpre os três', () => {
    for (const a of ['V3.4.1', 'V3.4.2', 'V3.4.3']) {
      assert.match(por(R.VPS_ruim, a, 'não cumpre')[0].provas[0], /^src\/login\.js:6 /)
      assert.equal(por(R.VPS_bom, a, 'cumpre').length, 1, a)
    }
  })
  await t('consulta concatenada é suspeita (nunca falha); a parametrizada cumpre', () => {
    assert.match(por(R.VPS_ruim, 'V5.3.4', 'suspeito')[0].provas[0], /^src\/login\.js:9 /)
    assert.equal(por(R.VPS_ruim, 'V5.3.4', 'não cumpre').length, 0)
    assert.equal(por(R.VPS_bom, 'V5.3.4', 'cumpre').length, 1)
  })
  await t('package.json com dependência e sem lockfile não cumpre; com lockfile cumpre', () => {
    assert.match(por(R.VPS_ruim, 'V14.2.1', 'não cumpre')[0].provas[0], /^package\.json /)
    assert.equal(por(R.VPS_bom, 'V14.2.1', 'cumpre').length, 1)
  })
  await t('cabeçalhos: falta HSTS e frame no servidor ruim, nosniff cumpre; o bom cumpre os três', () => {
    assert.match(por(R.VPS_ruim, 'V14.4.5', 'não cumpre')[0].provas[0], /respondeu 200 sem Strict-Transport-Security/)
    assert.match(por(R.VPS_ruim, 'V14.4.7', 'não cumpre')[0].provas[0], /sem frame-ancestors/)
    assert.match(por(R.VPS_ruim, 'V14.4.4', 'cumpre')[0].provas[0], /nosniff/)
    for (const a of ['V14.4.5', 'V14.4.4', 'V14.4.7']) assert.ok(por(R.VPS_bom, a).length === 1)
    assert.equal(por(R.VPS_bom, 'V14.4.5')[0].resultado, 'cumpre')
  })
  await t('rede que falha vira "não medido", nunca "cumpre"', async () => {
    const m = await V.medirCabecalhos([morta], { tempo: 2000 })
    for (const i of V.itensDeCabecalhos(m)) assert.equal(i.resultado, 'não medido')
    assert.equal(V.itensDeCabecalhos([])[0].resultado, 'não medido') // sem endereço também
    const meio = V.itensDeCabecalhos([...(await V.medirCabecalhos([url(bom)])), ...m])
    assert.equal(meio[0].resultado, 'não medido') // um respondeu bem, o outro caiu: não dá para afirmar
  })
  await t('o relatório diz a conclusão no título e traz a prova em cada item', () => {
    const m = md('VPS_ruim')
    assert.match(m, /^# VPS_ruim: \d+ requisito\(s\) não cumprem/)
    assert.match(m, /src\/login\.js:5/)
    assert.match(md('VPS_bom'), /^# VPS_bom: /)
  })
  await t('o resumo ordena e conta; o segredo falso nunca aparece em relatório algum', () => {
    const readme = fs.readFileSync(path.join(tmp, 'saida', 'README.md'), 'utf8')
    assert.match(readme, /\| \[VPS_ruim\]\(VPS_ruim\.md\) \| [1-9]/)
    for (const f of fs.readdirSync(path.join(tmp, 'saida'))) {
      const txt = fs.readFileSync(path.join(tmp, 'saida', f), 'utf8')
      assert.ok(!txt.includes('Z9xZ9x'), `${f} vazou o segredo`)
      assert.ok(!new RegExp(String.fromCharCode(91, 8212, 8211, 93)).test(txt), `${f} tem travessão`)
    }
  })
  await t('--projeto varre um só e não apaga o resumo dos outros', async () => {
    const antes = fs.readFileSync(path.join(tmp, 'saida', 'README.md'), 'utf8')
    const um = await V.varrer({ base, raizCockpit: tmp, urls, destino: path.join(tmp, 'saida'), so: 'bom' })
    assert.equal(um.length, 1)
    assert.equal(fs.readFileSync(path.join(tmp, 'saida', 'README.md'), 'utf8'), antes)
    await assert.rejects(V.varrer({ base, raizCockpit: tmp, urls, so: 'nao-existe' }), /não encontrado/)
  })
  await t('a varredura não escreveu nada dentro dos projetos varridos', () => {
    assert.equal(execFileSync('git', ['-C', path.join(base, 'VPS_bom'), 'status', '--short'], { encoding: 'utf8' }), '')
    assert.ok(!fs.existsSync(path.join(base, 'VPS_ruim', 'docs')))
  })
  console.log(`\n  ${n} verificações de segurança passaram\n`)
} finally {
  for (const s of servidores) s.close()
  fs.rmSync(tmp, { recursive: true, force: true })
}
