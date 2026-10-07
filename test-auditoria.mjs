// CC-933: o registro de auditoria central. Tudo numa pasta temporária; o registro de verdade nunca é tocado.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'auditoria-'))
const arq = path.join(casa, 'sub', 'auditoria.jsonl')
process.env.COCKPIT_AUDITORIA = arq
const A = await import('./tools/auditoria/auditoria.mjs')

let n = 0
const t = (nome, fn) => { fn(); n += 1; console.log('  ok  ' + nome) }

try {
  t('o caminho vem da variável de ambiente; sem ela, cai na casa do usuário', () => {
    assert.equal(A.caminhoAuditoria(), arq)
    delete process.env.COCKPIT_AUDITORIA
    // sem variável e sem o arquivo central, o padrão é o de ~/.local/share (só calculado, nunca gravado aqui)
    if (!fs.existsSync(A.CAMINHO_CENTRAL)) assert.equal(A.caminhoAuditoria(), path.join(os.homedir(), '.local', 'share', 'agent-cockpit', 'auditoria.jsonl'))
    process.env.COCKPIT_AUDITORIA = arq
  })

  t('cada evento vira UMA linha JSON, com data ISO, e acrescenta sem apagar', () => {
    assert.equal(A.registrar({ acao: 'login', quem: 'dono', de: '1.2.3.4', alvo: 'sessão abc', ok: true, detalhe: 'só senha', aparelho: 'iPhone' }), true)
    assert.equal(A.registrar({ acao: 'deploy-pedido', quem: 'agente-x', de: '127.0.0.1', alvo: 'mnzs', ok: false, detalhe: 'sem versão' }), true)
    const linhas = fs.readFileSync(arq, 'utf8').split('\n')
    assert.equal(linhas.length, 3, 'duas linhas e o fim de linha')
    const [a, b] = linhas.slice(0, 2).map((l) => JSON.parse(l))
    assert.match(a.em, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
    assert.deepEqual({ ...a, em: 0 }, { em: 0, acao: 'login', quem: 'dono', de: '1.2.3.4', alvo: 'sessão abc', ok: true, aparelho: 'iPhone', detalhe: 'só senha' })
    assert.equal(b.ok, false); assert.equal(b.alvo, 'mnzs')
  })

  t('token comprido que escorrega para um texto é escondido; quebra de linha não parte o registro', () => {
    const token = 'a1b2c3d4'.repeat(8)
    A.registrar({ acao: 'teste', detalhe: `cookie=${token}\nfalso: {"acao":"login"}` })
    const bruto = fs.readFileSync(arq, 'utf8')
    assert.ok(!bruto.includes(token), 'o token não foi gravado')
    assert.equal(bruto.trim().split('\n').length, 3, 'uma linha por evento, mesmo com \\n no texto')
  })

  t('ler devolve as últimas N, ignora linha quebrada e arquivo que não existe', () => {
    fs.appendFileSync(arq, '{linha pela metade\n')
    A.registrar({ acao: 'logout', ok: true })
    const todas = A.ler({ ultimos: 100 })
    assert.deepEqual(todas.map((l) => l.acao), ['login', 'deploy-pedido', 'teste', 'logout'])
    assert.deepEqual(A.ler({ ultimos: 2 }).map((l) => l.acao), ['teste', 'logout'])
    process.env.COCKPIT_AUDITORIA = path.join(casa, 'nao-existe.jsonl')
    assert.deepEqual(A.ler(), [])
    process.env.COCKPIT_AUDITORIA = arq
  })

  t('legível: português, com o que deu errado marcado e de onde veio', () => {
    const certo = A.legivel({ em: '2026-10-07T14:32:00.000Z', acao: 'login', quem: 'dono', de: '1.2.3.4', aparelho: 'iPhone', ok: true, detalhe: 'só senha' })
    assert.match(certo, /ok\s+login, por dono, de 1\.2\.3\.4 \(iPhone\): só senha/)
    const errado = A.legivel({ em: '2026-10-07T14:32:00.000Z', acao: 'rollback-resultado', alvo: 'mnzs', ok: false, detalhe: 'o site não serviu' })
    assert.match(errado, /ERRO\s+volta de versão terminou mnzs: o site não serviu/)
    assert.match(A.legivel({ em: 'lixo', acao: 'x' }), /\?\?\/\?\?/, 'data quebrada não derruba a leitura')
  })

  t('se não der para gravar, devolve false e avisa no stderr, sem lançar erro', () => {
    process.env.COCKPIT_AUDITORIA = path.join(arq, 'dentro-de-arquivo.jsonl') // o "pai" é um arquivo
    const err = process.stderr.write.bind(process.stderr); let aviso = ''
    process.stderr.write = (s) => { aviso += s; return true }
    let r; try { r = A.registrar({ acao: 'login', ok: true }) } finally { process.stderr.write = err; process.env.COCKPIT_AUDITORIA = arq }
    assert.equal(r, false); assert.match(aviso, /auditoria: não consegui registrar "login"/)
  })

  t('node cc.mjs auditoria --ultimos N mostra as últimas linhas legíveis', () => {
    const r = spawnSync(process.execPath, ['cc.mjs', 'auditoria', '--ultimos', '2'], { env: { ...process.env, COCKPIT_AUDITORIA: arq }, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /as últimas 2/); assert.match(r.stdout, /saída do painel/)
    assert.ok(!r.stdout.includes('só senha'), 'só as 2 últimas')
    const vazio = spawnSync(process.execPath, ['cc.mjs', 'auditoria'], { env: { ...process.env, COCKPIT_AUDITORIA: path.join(casa, 'vazio.jsonl') }, encoding: 'utf8' })
    assert.match(vazio.stdout, /nenhuma linha ainda/)
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`\n${n} verificações do registro de auditoria, todas passaram`)
