/**
 * CC-1126: só a máquina dona grava a varredura do backlog. PC (envia) grava; VPS (só recebe) devolve o ensaio
 * e não toca no arquivo; `backlogDono` forçado vale sobre a regra; máquina sem federação grava.
 * Configuração falsa numa casa isolada (CC_HOME), backlog num diretório temporário.
 *
 *   node test-backlog-dono.mjs
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1126-casa-'))
process.env.CC_HOME = casa // antes de importar: CONFIG_FILE é resolvido ao carregar config.mjs
const B = await import('./src/backlog.mjs')

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

const PC = { federacao: { token: 't', enviarPara: 'https://vps.exemplo', ativo: true } }
const VPS = { federacao: { token: 't', enviarPara: '', ativo: true } }

/* 1. a regra, pura */
assert.strictEqual(B.ehDonoDoBacklog(PC), true)
assert.strictEqual(B.ehDonoDoBacklog(VPS), false)
assert.strictEqual(B.ehDonoDoBacklog({}), true)
assert.strictEqual(B.ehDonoDoBacklog({ federacao: { token: '', enviarPara: '' } }), true)
assert.strictEqual(B.ehDonoDoBacklog({ ...VPS, backlogDono: true }), true)
assert.strictEqual(B.ehDonoDoBacklog({ ...PC, backlogDono: false }), false)
ok('a regra do dono: PC sim, VPS não, sem federação sim, backlogDono vale sobre a regra')

/* 2. pela configuração de verdade (falsa, na casa isolada), o caminho do painel */
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1126-proj-'))
const arquivo = B.caminhoPadrao(raiz)
const tresDias = B.diaLocal(new Date(Date.now() - 72 * 3600e3))
const preparar = () => {
  fs.rmSync(path.join(raiz, 'docs'), { recursive: true, force: true })
  B.gravar([{ id: 'CC-1', titulo: 'parada', estado: 'EM', frente: 'teste', mexido: tresDias, criado: tresDias, prova: null, porque: null, decisao: null, pronto: 'algo se observa' }], arquivo)
}
const config = (cfg) => fs.writeFileSync(path.join(casa, 'control-center.json'), JSON.stringify(cfg))
const estado = () => B.ler(arquivo).itens[0].estado
const eventos = () => { try { return fs.readFileSync(B.caminhoEventos(arquivo), 'utf8') } catch { return '' } }

const caso = async (cfg, grava, nome) => {
  preparar(); config(cfg)
  const antes = fs.readFileSync(arquivo, 'utf8')
  const acoes = await B.arrumarProjeto(raiz)
  assert.strictEqual(acoes.length, 1, JSON.stringify(acoes))
  assert.strictEqual(acoes[0].para, 'B1')
  if (grava) {
    assert.strictEqual(estado(), 'B1', nome)
    assert.ok(eventos().includes('"por":"robo"'), 'o diário ganha o evento')
    assert.ok(!acoes[0].naoDono)
  } else {
    assert.strictEqual(fs.readFileSync(arquivo, 'utf8'), antes, `${nome}: o backlog não pode mudar`)
    assert.strictEqual(eventos(), '', `${nome}: o diário não pode mudar`)
    assert.strictEqual(acoes[0].naoDono, true)
    assert.ok(!acoes[0].feito)
  }
  ok(nome)
}
await caso(PC, true, 'PC (enviarPara) grava')
await caso(VPS, false, 'VPS (só receptora) não grava e devolve o ensaio')
await caso({ ...VPS, backlogDono: true }, true, 'VPS com backlogDono: true grava')
await caso({ ...PC, backlogDono: false }, false, 'PC com backlogDono: false não grava')
await caso({}, true, 'máquina sem federação grava')

/* 3. o comando dele, na VPS: a linha em palavras comuns e nada gravado */
preparar(); config(VPS)
const antes = fs.readFileSync(arquivo, 'utf8')
const cc = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cc.mjs')
const r = spawnSync(process.execPath, [cc, 'backlog', 'arrumar'], { cwd: raiz, encoding: 'utf8', timeout: 60000, env: { ...process.env, CC_HOME: casa, CC_SEM_NAVEGADOR: '1' } })
assert.ok(r.stdout.includes(B.AVISO_NAO_DONO), r.stdout + r.stderr)
assert.ok(/mudaria\s+CC-1/.test(r.stdout), r.stdout)
assert.strictEqual(fs.readFileSync(arquivo, 'utf8'), antes)
ok('cc backlog arrumar na VPS: diz que não é a dona, mostra o que mudaria, não grava')

fs.rmSync(raiz, { recursive: true, force: true })
fs.rmSync(casa, { recursive: true, force: true })
console.log(`\n  ${n} verificações passaram\n`)
