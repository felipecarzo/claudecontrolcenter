/**
 * CC-1072: os dois ganchos que vieram do PC, refeitos em node. Cada um roda como processo, com casa falsa (HOME e
 * CC_HOME temporários), para nunca tocar dado real.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1072-'))
const casa = path.join(tmp, 'casa')
fs.mkdirSync(casa, { recursive: true })
const rodar = (arq, entrada) => spawnSync(process.execPath, [path.join(aqui, 'hooks', arq)], {
  // '' não fecha o canal de entrada do filho em spawnSync, e o gancho ficaria esperando para sempre: manda uma linha em branco
  input: (typeof entrada === 'string' ? entrada : JSON.stringify(entrada ?? {})) || '\n',
  encoding: 'utf8',
  env: { ...process.env, HOME: tmp, USERPROFILE: tmp, CC_HOME: casa },
})
let n = 0
const ok = (nome, fn) => { fn(); n++; console.log('ok', nome) }

try {
  // 1. PreCompact
  const c = rodar('compactar-idioma.mjs', '{}')
  ok('compactar: saída 0 e ordem de português', () => {
    assert.equal(c.status, 0)
    assert.match(c.stdout, /português do Brasil/)
    assert.match(c.stdout, /acentuação correta/)
  })
  ok('compactar: sem travessão e sem meia-risca no texto', () => assert.ok(!/[—–]/.test(c.stdout)))
  ok('compactar: não cita o bloco de análise nem o raciocínio', () => assert.ok(!/analysis|análise|raciocínio/i.test(c.stdout)))
  ok('compactar: cabe em uma a quatro linhas', () => assert.ok(c.stdout.trim().split('\n').length <= 4))

  // 2. título do terminal
  const proj = path.join(tmp, 'meu-projeto')
  fs.mkdirSync(path.join(proj, 'sub'), { recursive: true })
  spawnSync('git', ['init', '-q'], { cwd: proj })
  const t = rodar('titulo-terminal.mjs', { session_id: 'abc-123', cwd: path.join(proj, 'sub') })
  ok('título: saída 0 e imprime o nome do projeto (raiz do git, não a subpasta)', () => {
    assert.equal(t.status, 0)
    assert.equal(t.stdout.trim(), 'meu-projeto')
  })
  ok('título: grava a sessão na raiz do projeto com quebra de linha', () => {
    assert.equal(fs.readFileSync(path.join(proj, '.claude', 'current-session.tmp'), 'utf8'), 'abc-123\n')
  })
  ok('título: cria .claude/sessions como o .sh criava', () => assert.ok(fs.statSync(path.join(proj, '.claude', 'sessions')).isDirectory()))
  ok('título: grava o nome em current-title.tmp na casa', () => {
    assert.equal(fs.readFileSync(path.join(casa, 'current-title.tmp'), 'utf8'), 'meu-projeto\n')
  })
  ok('título: sem session_id não grava current-session.tmp', () => {
    const outro = path.join(tmp, 'sem-sessao')
    fs.mkdirSync(outro)
    rodar('titulo-terminal.mjs', { cwd: outro })
    assert.ok(!fs.existsSync(path.join(outro, '.claude', 'current-session.tmp')))
  })
  const semGit = path.join(tmp, 'solta')
  fs.mkdirSync(semGit)
  const s = rodar('titulo-terminal.mjs', { session_id: 'x', cwd: semGit })
  ok('título: fora de repositório usa a pasta do cwd', () => assert.equal(s.stdout.trim(), 'solta'))
  ok('título: JSON ruim e stdin vazio saem com 0 sem travar', () => {
    assert.equal(rodar('titulo-terminal.mjs', 'isso não é json').status, 0)
    assert.equal(rodar('titulo-terminal.mjs', '').status, 0)
  })
  ok('título: casa que não dá para criar não derruba (falha aberta)', () => {
    // casa dentro de um arquivo comum: o mkdir falha na hora (ENOTDIR), como numa pasta somente leitura
    const arquivo = path.join(tmp, 'arquivo-comum')
    fs.writeFileSync(arquivo, 'x')
    const r = spawnSync(process.execPath, [path.join(aqui, 'hooks', 'titulo-terminal.mjs')], {
      input: JSON.stringify({ session_id: 'y', cwd: semGit }), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, HOME: tmp, USERPROFILE: tmp, CC_HOME: path.join(arquivo, 'casa') },
    })
    assert.equal(r.status, 0)
    assert.equal(r.stdout.trim(), 'solta')
  })
  ok('título: o arquivo não monta URL de módulo com file:// e caminho cru', () => {
    const fonte = fs.readFileSync(path.join(aqui, 'hooks', 'titulo-terminal.mjs'), 'utf8')
    assert.ok(!/`file:\/\/\$\{/.test(fonte) && /pathToFileURL/.test(fonte))
  })
  console.log(`\nCC-1072: ${n} verificações, todas conferidas`)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
