// CC-944: a leitura segura do banco. Parte 1 roda o serviço numa casa temporária, com o
// banco simulado. Parte 2 sobe um Postgres descartável (se o initdb existir) e prova as
// barreiras do próprio banco: só leitura, sem e-mail, sem chave, sem escrita.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'leitura-segura-'))
process.env.LEITURA_ESTADO = path.join(casa, 'estado')
process.env.LEITURA_CRED = path.join(casa, 'cred')
fs.mkdirSync(process.env.LEITURA_CRED)
const D = await import('./tools/deploy-seguro/deploy-seguro.mjs')
const SEG = D.base32Codificar(Buffer.from('segredo-de-teste-123'))
fs.writeFileSync(path.join(process.env.LEITURA_CRED, 'totp'), SEG)
const L = await import('./tools/deploy-seguro/leitura-segura.mjs')

let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok  ${nome}`) }
const codigo = (agora) => D.totp(SEG, Math.floor(agora / 30000))

try {
  // ── parte 1: o serviço ──
  const falso = async (sql) => (sql.includes('erro') ? { erro: 'ERROR: permission denied for table profiles' } : { linhas: [{ n: 1, dono: 'fulano@exemplo.com', blob: { email: 'x@y.com', km: 5 } }], cortado: false })
  const srv = L.criarServidor({ executar: async (sql) => { const r = await falso(sql); return r.erro ? r : { ...r, linhas: L.limpar(r.linhas) } } })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${srv.address().port}`
  const consultar = (sql) => fetch(base + '/api/consultar', { method: 'POST', body: JSON.stringify({ sql, de: 'teste' }) })

  await t('fechado por padrão: a consulta é recusada e aponta a página de liberar', async () => {
    const r = await consultar('select 1')
    assert.equal(r.status, 403)
    assert.equal((await r.json()).liberar, L.PAGINA)
  })

  await t('código errado não abre, e cinco erros bloqueiam', () => {
    const agora = 1_790_000_000_000
    assert.match(L.liberar('000000', { agora, segredo: SEG }), /código errado \(1 de 5/)
    for (let i = 0; i < 4; i++) L.liberar('000000', { agora, segredo: SEG })
    assert.match(L.liberar(codigo(agora), { agora, segredo: SEG }), /bloqueado/, 'bloqueado vale até para o código certo')
    assert.equal(L.lerEstado().abertoAte, 0)
  })

  await t('código certo abre por 24 horas, e o mesmo código não vale duas vezes', () => {
    const agora = Date.now()
    fs.rmSync(path.join(process.env.LEITURA_ESTADO, 'estado.json'))
    assert.equal(L.liberar(codigo(agora), { agora, segredo: SEG }), null)
    assert.equal(L.lerEstado().abertoAte, agora + L.ABERTO_MS)
    assert.match(L.liberar(codigo(agora), { agora, segredo: SEG }), /já foi usado/)
  })

  await t('aberto: consulta passa, e e-mail dentro do resultado sai trocado', async () => {
    const r = await consultar('select 1;')
    assert.equal(r.status, 200)
    const d = await r.json()
    assert.equal(d.linhas[0].dono, '[e-mail]')
    assert.deepEqual(d.linhas[0].blob, { km: 5 }, 'a chave "email" dentro do JSON some')
  })

  await t('só leitura, uma consulta por vez', async () => {
    for (const sql of ['delete from profiles', 'select 1; drop table x', '', 'update x set y=1']) {
      const r = await consultar(sql)
      assert.equal(r.status, 400, sql)
    }
    assert.equal(L.validarSql('with a as (select 1) select * from a').sql, 'with a as (select 1) select * from a')
  })

  await t('erro do banco volta para quem pediu, e tudo fica no registro', async () => {
    const r = await consultar('select erro from profiles')
    assert.match((await r.json()).erro, /permission denied/)
    const reg = L.ultimas()
    assert.equal(reg[0].erro.includes('permission denied'), true)
    assert.equal(reg.some((l) => l.evento === 'liberado'), true)
    assert.equal(reg.filter((l) => !l.evento).length, 6, 'as recusadas também ficam')
  })

  await t('a página mostra o estado e a lista, e escapa o texto da consulta', async () => {
    await consultar('select \'<script>\' as x')
    const h = await (await fetch(base + '/leitura-segura/')).text()
    assert.match(h, /Aberto até/)
    assert.equal(h.includes('<script>'), false)
    assert.match(h, /&lt;script&gt;/)
  })

  await t('fechar agora: a consulta volta a ser recusada', async () => {
    const r = await fetch(base + '/leitura-segura/fechar', { method: 'POST', redirect: 'manual' })
    assert.equal(r.status, 303)
    assert.equal((await consultar('select 1')).status, 403)
  })
  srv.close()

  // ── parte 2: as barreiras no Postgres de verdade ──
  const bin = fs.existsSync('/usr/lib/postgresql') ? fs.readdirSync('/usr/lib/postgresql').map((v) => `/usr/lib/postgresql/${v}/bin`).find((b) => fs.existsSync(b + '/initdb')) : null
  if (!bin) { console.log('  --  sem initdb nesta máquina: parte do banco pulada') } else {
    const dados = path.join(casa, 'pg'); const sock = path.join(casa, 's'); fs.mkdirSync(sock)
    execFileSync(bin + '/initdb', ['-D', dados, '-U', 'dono', '--auth=trust', '-E', 'UTF8'], { stdio: 'ignore' })
    execFileSync(bin + '/pg_ctl', ['-D', dados, '-o', `-k ${sock} -c listen_addresses= -p 55439`, '-w', 'start'], { stdio: 'ignore' })
    const env = { PGHOST: sock, PGPORT: '55439', PGDATABASE: 'postgres' }
    const dono = (args, input) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], { env: { ...process.env, ...env, PGUSER: 'dono' }, input, encoding: 'utf8' })
    try {
      dono(['-c', `create table profiles (user_id uuid primary key, email text, name text, bio text, weight int);
        create table sessions_advanced (user_id uuid, session_date date, name text, hr_avg int, route_geo jsonb);
        create table strava_tokens (user_id uuid, access_token text);
        create table mensagens (id int, de_id uuid, texto text, criado_em timestamptz);
        insert into profiles values ('00000000-0000-0000-0000-000000000001', 'eu@x.com', 'Fulano', 'oi', 70);
        insert into sessions_advanced values ('00000000-0000-0000-0000-000000000001', '2026-10-06', 'Corrida', 151, '[]');`])
      dono(['-v', 'papel=claude_leitura', '-v', 'senha=abc', '-f', path.resolve('tools/deploy-seguro/leitura-segura.sql')])
      dono(['-v', 'papel=claude_leitura', '-v', 'senha=abc', '-f', path.resolve('tools/deploy-seguro/leitura-segura.sql')]) // rodar duas vezes não quebra
      const leitor = { ...env, PGUSER: 'claude_leitura', PGPASSWORD: 'abc' }
      const q = (sql) => L.rodarSql(sql, { env: leitor })

      await t('banco: o treino aparece, com nome do treino e batimento', async () => {
        const r = await q('select session_date, name, hr_avg from sessions_advanced')
        assert.deepEqual(r.linhas, [{ session_date: '2026-10-06', name: 'Corrida', hr_avg: 151 }])
      })
      await t('banco: perfil sem nome, e-mail nem bio, mas com o peso', async () => {
        assert.deepEqual((await q('select user_id, weight from profiles')).linhas, [{ user_id: '00000000-0000-0000-0000-000000000001', weight: 70 }])
        for (const c of ['email', 'name', 'bio', '*']) assert.match((await q(`select ${c} from profiles`)).erro, /permission denied/, c)
      })
      await t('banco: chave do Strava e texto de mensagem recusados', async () => {
        assert.match((await q('select user_id from strava_tokens')).erro, /permission denied/)
        assert.match((await q('select texto from mensagens')).erro, /permission denied/)
        assert.equal((await q('select id, criado_em from mensagens')).linhas.length, 0)
      })
      await t('banco: escrita recusada pelo próprio banco, mesmo escondida numa consulta', async () => {
        assert.ok((await q('with x as (delete from sessions_advanced returning 1) select * from x')).erro)
        const tenta = (sql) => { try { execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env: { ...process.env, ...leitor }, stdio: 'pipe' }); return true } catch { return false } }
        assert.equal(tenta('delete from sessions_advanced'), false)
        assert.equal(tenta('create table x (a int)'), false)
        assert.equal(tenta('set default_transaction_read_only = off; delete from sessions_advanced'), false, 'desligar o só leitura não adianta: falta a permissão')
        assert.equal(dono(['-t', '-A', '-c', 'select count(*) from sessions_advanced']).trim(), '1')
      })
    } finally { execFileSync(bin + '/pg_ctl', ['-D', dados, '-m', 'immediate', 'stop'], { stdio: 'ignore' }) }
  }
  console.log(`\n  ${ok} de ${ok} conferências passaram\n`)
} finally { fs.rmSync(casa, { recursive: true, force: true }) }
