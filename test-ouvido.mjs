// CC-1120: o ouvido. O gancho de verdade (hooks/ouvido.mjs) como processo filho, numa casa temporária, e a entrega pela
// federação gravando na caixa. Nada toca a casa dele.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const raiz = path.dirname(fileURLToPath(import.meta.url))
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ouvido-'))
const casa = path.join(base, '.claude')
fs.mkdirSync(casa, { recursive: true })
process.env.CC_HOME = casa
const O = await import('./src/ouvido.mjs')
const F = await import('./src/federacao.mjs')
const dir = O.dirCaixas()
assert.ok(dir.startsWith(base), `caixa fora da casa de teste: ${dir}`)

let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok  ${nome}`) }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const ate = async (cond, teto = 5000) => { const fim = Date.now() + teto; while (Date.now() < fim) { if (cond()) return true; await esperar(50) } return false }

/** Sobe o gancho como o Claude Code subiria: JSON no stdin. Devolve o processo e a promessa da saída. */
function ouvido(sessao, teto) {
  const p = spawn(process.execPath, [path.join(raiz, 'hooks', 'ouvido.mjs')], {
    env: { ...process.env, CC_HOME: casa, CC_OUVIDO_TETO_MS: String(teto), CC_OUVIDO_PASSO_MS: '100' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let erro = ''
  p.stderr.on('data', (d) => { erro += d })
  p.stdin.end(JSON.stringify({ session_id: sessao, transcript_path: null, cwd: raiz, hook_event_name: 'Stop' }))
  const saida = new Promise((r) => p.on('exit', (code) => r({ code, erro })))
  return { p, saida }
}

const S1 = 'aaaa1111-2222-3333-4444-555566667777'
const S2 = 'bbbb1111-2222-3333-4444-555566667777'
const S3 = 'cccc1111-2222-3333-4444-555566667777'

try {
  await t('caixa chega: o gancho sai com 2 e o texto limpo no stderr; caixa e marcador somem', async () => {
    const { p, saida } = ouvido(S1, 15000)
    assert.ok(await ate(() => O.ouvidoVivo(S1) === S1), 'o marcador de ouvido vivo não apareceu')
    assert.equal(O.lerVivo(S1).pid, p.pid)
    assert.equal(O.gravarCaixa(S1, 'segue\x1b[2J com\x03 o plano\nagora').ok, true)
    const r = await saida
    assert.equal(r.code, 2)
    assert.equal(r.erro, 'Mensagem dele pelo cockpit: segue com o plano agora')
    assert.equal(fs.existsSync(path.join(dir, `${S1}.txt`)), false)
    assert.equal(fs.existsSync(path.join(dir, `${S1}.vivo`)), false)
  })
  await t('sem caixa até o teto: sai 0 calado e limpa o marcador', async () => {
    const { saida } = ouvido(S2, 700)
    const r = await saida
    assert.equal(r.code, 0)
    assert.equal(r.erro, '')
    assert.equal(fs.existsSync(path.join(dir, `${S2}.vivo`)), false)
  })
  await t('trava: segundo ouvido da mesma sessão sai 0 na hora e o primeiro segue escutando', async () => {
    const a = ouvido(S3, 15000)
    assert.ok(await ate(() => O.ouvidoVivo(S3) === S3))
    const inicio = Date.now()
    const b = await ouvido(S3, 15000).saida
    assert.equal(b.code, 0)
    assert.ok(Date.now() - inicio < 4000, 'o segundo ouvido não saiu na hora')
    assert.equal(O.lerVivo(S3).pid, a.p.pid, 'o segundo pisou no marcador do primeiro')
    O.gravarCaixa(S3, 'oi')
    assert.equal((await a.saida).code, 2)
  })
  await t('marcador de processo morto ou velho não conta como vivo', () => {
    fs.writeFileSync(path.join(dir, `${S2}.vivo`), JSON.stringify({ pid: 999999, sessao: S2, hora: Date.now() }))
    assert.equal(O.ouvidoVivo(S2), null)
    fs.writeFileSync(path.join(dir, `${S2}.vivo`), JSON.stringify({ pid: process.pid, sessao: S2, hora: Date.now() - O.VIVO_MS - 1 }))
    assert.equal(O.ouvidoVivo(S2), null)
  })

  const semTerminal = { sessoes: async () => ({}), enviar: async () => assert.fail('não devia digitar'), apertarTecla: async () => assert.fail('não devia apertar') }
  await t('federação: sessão fora do terminal com ouvido vivo recebe na caixa, pelo id curto do pacote', async () => {
    fs.writeFileSync(path.join(dir, `${S1}.vivo`), JSON.stringify({ pid: process.pid, sessao: S1, hora: Date.now() }))
    const r = await F.entregarMensagemRemota({ acao: 'mensagem', conversa: S1.slice(0, 8), texto: 'pela\x1b[31m VPS\x07' }, semTerminal)
    assert.equal(r.ok, true, r.erro)
    assert.equal(fs.readFileSync(path.join(dir, `${S1}.txt`), 'utf8'), 'pela VPS')
    assert.equal((await F.entregarMensagemRemota({ conversa: S1, texto: 'segunda' }, semTerminal)).ok, true)
    assert.equal(fs.readFileSync(path.join(dir, `${S1}.txt`), 'utf8'), 'pela VPS\nsegunda', 'a caixa não lida perdeu a anterior')
  })
  await t('federação: sem ouvido continua recusando; tecla não vai pela caixa', async () => {
    const r = await F.entregarMensagemRemota({ acao: 'mensagem', conversa: 'dddd1111-2222-3333-4444-555566667777', texto: 'oi' }, semTerminal)
    assert.equal(r.ok, false)
    assert.match(r.erro, /não está num terminal/)
    assert.equal((await F.entregarMensagemRemota({ conversa: S1, tecla: 'parar' }, semTerminal)).ok, false)
  })
  await t('o pacote leva a marca ouvido; pacote velho sem ela continua aceito', () => {
    const v = F.validarPacote(JSON.parse(JSON.stringify(F.montarPacote({ maquina: { id: 'pc-ouvido', nome: 'PCO' }, jobs: [{ id: S1.slice(0, 8), sessionId: S1, ouvido: true }] })))).pacote
    assert.equal(v.jobs[0].ouvido, true)
    const velho = F.validarPacote(JSON.parse(JSON.stringify(F.montarPacote({ maquina: { id: 'pc-velho', nome: 'PCV' }, jobs: [{ id: 'eeeeeeee' }] })))).pacote
    assert.equal(Boolean(velho.jobs[0].ouvido), false)
  })
  await t('registrar pelo instalador leva asyncRewake e timeout nos dois eventos (sem isso o Stop travaria a sessão)', async () => {
    fs.writeFileSync(path.join(casa, 'settings.json'), '{}')
    const R = await import('./src/hooksRegistro.mjs')
    const { hookDe } = await import('./src/hooksCatalogo.mjs')
    assert.equal(R.instalar([hookDe('ouvido')]).feitos[0].acao, 'registrado')
    const s = JSON.parse(fs.readFileSync(path.join(casa, 'settings.json'), 'utf8'))
    for (const ev of ['Stop', 'SessionStart']) {
      const h = s.hooks[ev][0].hooks[0]
      assert.ok(h.command.includes('ouvido.mjs') && h.asyncRewake === true && h.timeout === 3600, `${ev} sem as opções: ${JSON.stringify(h)}`)
    }
  })
  await t('a rota local e o pacote do painel usam o ouvido', () => {
    const web = fs.readFileSync(path.join(raiz, 'src', 'web.mjs'), 'utf8')
    assert.match(web, /const sessao = ouvidoVivo\(conversa\)\s+if \(sessao\) r = gravarCaixa\(sessao, texto\)/)
    assert.match(web, /ouvido: Boolean\(ouv\)/)
  })
} finally {
  fs.rmSync(base, { recursive: true, force: true })
}
console.log(`test-ouvido: ${ok} verificações, 0 falhas`)
