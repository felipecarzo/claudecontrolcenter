// CC-558, peça A: o agente recebe o design do projeto (identidade, tela aprovada e mural)
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-design-ctx-'))
process.env.CC_HOME = path.join(casa, '.claude')
const { secaoDesignDoProjeto } = await import('./src/designContexto.mjs')
try {
  const pj = path.join(casa, 'proj-design')
  const esc = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(pj, rel)), { recursive: true }); fs.writeFileSync(path.join(pj, rel), txt) }
  esc('DESIGN.md', '---\ncolors:\n  primary: "#3366ff"\n---\n# design\n')
  esc('docs/design/telas/login/v1.html', '<!doctype html><title>login</title>')
  esc('docs/cartas/design.votos.jsonl', JSON.stringify({ em: '2026-10-07T10:00:00Z', carta: 'tela-login-v1', escolhas: ['Aprovo'], nota: '', de: 'felipe' }) + '\n')
  esc('docs/design/mural.jsonl', JSON.stringify({ id: 'm1', em: '2026-10-07T10:00:00Z', de: 'felipe', texto: 'quero botões grandes' }) + '\n')
  const s = secaoDesignDoProjeto(pj)
  assert.equal(s.titulo, 'O DESIGN DESTE PROJETO')
  const tudo = s.linhas.join('\n')
  assert.ok(tudo.includes('DESIGN.md'), 'diz onde está a identidade')
  assert.ok(/aprovada/.test(tudo) && /\b1\b/.test(tudo), 'diz qual versão da tela foi aprovada: ' + tudo)
  assert.ok(tudo.includes('quero botões grandes'), 'leva o mural')
  console.log('  ok   o pacote leva identidade, tela aprovada e mural')
  const vazio = path.join(casa, 'vazio'); fs.mkdirSync(vazio)
  assert.equal(secaoDesignDoProjeto(vazio), null)
  assert.equal(secaoDesignDoProjeto(null), null)
  console.log('  ok   projeto sem design não ganha seção')
} finally { fs.rmSync(casa, { recursive: true, force: true }) }
console.log('design-contexto ok')
