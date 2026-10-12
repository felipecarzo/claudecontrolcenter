// CC-1056: as regras de escrita têm UMA fonte, e é dela que o começo de toda sessão lê.
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lerPadrao, lerEscrita, ARQUIVO_ESCRITA, MARCA_ESCRITA } from './src/estilo.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }
const fonte = readFileSync(ARQUIVO_ESCRITA(), 'utf8')

ok(!/[—–]/.test(fonte), 'a fonte única não tem travessão (a regra 1 dela mesma)')
ok(fonte.includes(MARCA_ESCRITA) && fonte.indexOf('## De onde veio cada regra') > fonte.indexOf(MARCA_ESCRITA), 'a origem das regras fica depois da marca')
const sessao = lerPadrao()
ok(sessao.includes('Defina antes de concluir') && sessao.includes('Um nome por coisa'), 'o começo da sessão leva a regra nova')
ok(!sessao.includes('De onde veio cada regra') && !sessao.includes(MARCA_ESCRITA), 'a origem das regras não entra na sessão (não pesa em token)')
ok(sessao.length < 8000, 'o que entra na sessão cabe em menos de 8 mil caracteres (era 8,8 mil antes da fonte única): ' + sessao.length)

// sem o arquivo (repositório velho), devolve null e o aviso cai no arquivo antigo
const d = mkdtempSync(join(tmpdir(), 'escrita-'))
try {
  ok(lerEscrita(join(d, 'nao-existe.md')) === null, 'sem a fonte, lerEscrita devolve null (o aviso usa o arquivo antigo)')
  writeFileSync(join(d, 'e.md'), 'regra A\n' + MARCA_ESCRITA + '\nhistória')
  ok(lerEscrita(join(d, 'e.md')) === 'regra A\n', 'corta exatamente na marca')
} finally { rmSync(d, { recursive: true, force: true }) }

// os outros lugares apontam para a fonte, em vez de repetir
const home = process.env.HOME
for (const [onde, arq] of [['skill copy', '.claude/skills/copy/SKILL.md'], ['regras de design', '.claude/skills/regras-design/SKILL.md'], ['instruções globais', '.claude/CLAUDE.md']]) {
  let t = null; try { t = readFileSync(join(home, arq), 'utf8') } catch { /* outra máquina: não confere */ }
  if (t !== null) ok(t.includes('docs/produto/ESCRITA.md'), onde + ' aponta para a fonte única')
}
console.log(`test-escrita: ${n} verificações, 0 falhas`)
