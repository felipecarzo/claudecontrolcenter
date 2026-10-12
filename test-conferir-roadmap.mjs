// CC-1040: fechar um item pela conferência regera o ROADMAP.md. Sem isso, o teste do próprio painel (que exige o
// roadmap igual ao backlog) reprovava a conferência SEGUINTE, e conferir vários itens em sequência derrubava os outros.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import * as B from './src/backlog.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }

const d = mkdtempSync(join(tmpdir(), 'conferir-roadmap-'))
try {
  mkdirSync(join(d, 'docs'), { recursive: true })
  const item = (id, titulo) => JSON.stringify({ id, titulo, estado: 'PR', frente: 'f', natureza: 'PED', area: 'texto', tamanho: 'P', criado: '2026-10-11', mexido: '2026-10-11', pronto: 'algo que se observa pronto', conferir: 'auto:node test-ok.mjs', intencao: titulo })
  writeFileSync(join(d, 'test-ok.mjs'), "console.log('1 verificação, 0 falhas')\n")
  writeFileSync(join(d, 'docs', 'backlog.jsonl'), [item('TT-001', 'primeiro item'), item('TT-002', 'segundo item')].join('\n') + '\n')
  B.regerarRoadmap(d)
  const roadmap = () => readFileSync(join(d, 'docs', 'ROADMAP.md'), 'utf8').replace(/\r\n/g, '\n')
  const esperado = () => B.comoMarkdown(B.caminhoPadrao(d))
  ok(roadmap() === esperado(), 'ponto de partida: o roadmap bate com o backlog')

  const r = spawnSync(process.execPath, [new URL('./cc.mjs', import.meta.url).pathname, 'backlog', 'conferir', 'TT-001'], { cwd: d, encoding: 'utf8', env: { ...process.env, CC_HOME: join(d, 'casa') } })
  ok(/TT-001 → fechado/.test(r.stdout), 'a conferência automática fecha o item (' + r.stdout.trim().split('\n').pop() + ')')
  ok(B.ler(B.caminhoPadrao(d)).itens.find((x) => x.id === 'TT-001').estado === 'OK', 'o estado no backlog é OK')
  ok(roadmap() === esperado(), 'DEPOIS de fechar, o roadmap já bate com o backlog (antes ficava velho e reprovava o teste seguinte)')
} finally { rmSync(d, { recursive: true, force: true }) }
console.log(`test-conferir-roadmap: ${n} verificações, 0 falhas`)
