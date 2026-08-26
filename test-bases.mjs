/**
 * CC-352: o cockpit lê de VÁRIAS pastas de projeto, não só uma.
 *
 * Ele pediu poder apontar mais de uma pasta (TI, música, etc.). Este teste prova
 * que `findProjects` varre todas as pastas configuradas, e que `projectsBases`
 * une as fontes sem repetir. O instalador (lado do PC) preenche a lista; aqui é
 * a leitura.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findProjects } from './src/install.mjs'
import { ehWindows } from './src/platform.mjs'

/* Achado em 26/08, primeira vez rodando no PC: `:` é o separador do `PATH`
   do Linux, e no Windows ele já está ocupado pela letra de unidade
   (`D:\...`). Sem jeito de usar `:` entre dois caminhos de Windows, então o
   teste monta a lista com o separador de cada máquina, igual o código real
   (`projectsBases`, em `src/install.mjs`) passou a exigir. */
const SEP = ehWindows ? ';' : ':'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bases-'))
try {
  // duas pastas "projetos" de mentira, cada uma com um projeto (tem .git)
  const p1 = path.join(base, 'TI', 'projetos')
  const p2 = path.join(base, 'Musica', 'projetos')
  for (const [p, nome] of [[p1, 'site_cliente'], [p2, 'album_novo']]) {
    fs.mkdirSync(path.join(p, nome, '.git'), { recursive: true })
  }

  // 1. varrer UMA pasta acha só o dela
  try {
    const so1 = findProjects(p1).map((d) => path.basename(d))
    assert.deepEqual(so1, ['site_cliente'])
    ok('varrer uma pasta acha só o projeto dela')
  } catch (e) { erro('uma pasta', e) }

  // 2. sem base explícita, varre TODAS as configuradas (via env com duas)
  try {
    process.env.CC_PROJECTS_BASE = `${p1}${SEP}${p2}`
    const todos = findProjects().map((d) => path.basename(d)).sort()
    assert.deepEqual(todos, ['album_novo', 'site_cliente'])
    ok(`sem base explícita, varre as duas pastas configuradas (env com "${SEP}")`)
  } catch (e) { erro('duas pastas', e) }

  // 3. pasta repetida não duplica projeto
  try {
    process.env.CC_PROJECTS_BASE = `${p1}${SEP}${p1}`
    const r = findProjects().map((d) => path.basename(d))
    assert.deepEqual(r, ['site_cliente'])
    ok('pasta repetida não duplica o projeto')
  } catch (e) { erro('sem duplicar', e) }
} finally {
  delete process.env.CC_PROJECTS_BASE
  fs.rmSync(base, { recursive: true, force: true })
}

if (falhou) process.exit(1)
console.log('test-bases: ok')
