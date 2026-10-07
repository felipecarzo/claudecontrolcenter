// CC-522: o leitor diário grava sozinho de manhã, um arquivo por projeto, uma vez por dia.
import assert from 'node:assert/strict'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'leitor-'))
process.env.CC_HOME = casa
const LD = await import('./src/leitorDiario.mjs')
const proj = [{ nome: 'cockpit', leitor: { fechados: 3, sozinho: [{ id: 'CC-1', titulo: 'feito sozinho' }], dele: [{ id: 'CC-2', titulo: 'decide você' }], travados: [] } },
  { nome: 'VPS/ahtleta', leitor: { fechados: 0, sozinho: [], dele: [], travados: [{ id: 'AH-9', titulo: 'travou' }] } }]
let n = 0; const ok = (m) => { n++; console.log('  ok  ' + m) }
try {
  // 9h59 UTC = 6h59 de Brasília: ainda não
  assert.equal(LD.talvezGravar(proj, new Date('2026-10-02T09:59:00Z')), null); ok('antes das 7h de Brasília não grava')
  const r = LD.talvezGravar(proj, new Date('2026-10-02T10:01:00Z'))
  assert.deepEqual([r.dia, r.arquivos], ['2026-10-02', 2]); ok('às 7h01 de Brasília grava o dia, um arquivo por projeto')
  const md = fs.readFileSync(path.join(r.pasta, 'cockpit.md'), 'utf8')
  assert.match(md, /O que fechou sozinho[\s\S]*CC-1: feito sozinho/); assert.match(md, /O que espera você[\s\S]*CC-2: decide você/); assert.match(md, /O que travou\n- nada/)
  ok('o arquivo tem as três seções: fechou sozinho, espera você, travou')
  assert.ok(fs.existsSync(path.join(r.pasta, 'VPS_ahtleta.md'))); ok('nome de projeto com barra vira nome de arquivo seguro')
  assert.equal(LD.talvezGravar(proj, new Date('2026-10-02T15:00:00Z')), null); ok('o mesmo dia não grava de novo')
  // 02h UTC do dia 3 = 23h do dia 2 em Brasília: ainda é o dia 2
  assert.equal(LD.talvezGravar(proj, new Date('2026-10-03T02:00:00Z')), null); ok('o dia segue o relógio de Brasília, não o de Londres')
  const u = LD.ultima(); assert.equal(u.dia, '2026-10-02'); assert.equal(u.arquivos, 2); ok('a última gravação é lida para a tela')
  console.log(`\n${n} verificações do leitor diário, todas passaram`)
} finally { fs.rmSync(casa, { recursive: true, force: true }) }
