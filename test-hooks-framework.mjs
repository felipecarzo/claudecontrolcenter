/**
 * Liga os dois testes de hook do framework ao gate.
 *
 * Eles existiam desde 18/08 e NUNCA entraram no `npm test`: rodavam só quando
 * alguém lembrava de digitar `bash hooks/testar-...`. O preço apareceu em
 * 30/08, fazendo o CC-45: os dois estavam quebrados no Windows havia semanas,
 * e o `testar-framework-inicio.sh` era pior que quebrado — os casos positivos
 * falhavam e os NEGATIVOS passavam por vacuidade, verde afirmando que o hook
 * fica calado quando ele nem tinha achado onde olhar.
 *
 * A causa era a mesma dos outros seis casos de "supõe Linux" deste projeto
 * (ver `docs/guias/PC-E-VPS.md`): caminho POSIX viajando dentro do JSON do
 * stdin, que o MSYS não converte.
 *
 * Sem `bash` na máquina isto PULA e diz que pulou. Gate que trava por falta de
 * ferramenta opcional é gate que alguém remove na semana seguinte, e o projeto
 * já usa esse padrão em outros casos.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ARQUIVOS = ['hooks/testar-framework-guard.sh', 'hooks/testar-framework-inicio.sh']

const temBash = spawnSync('bash', ['--version'], { encoding: 'utf8' }).status === 0
if (!temBash) {
  console.log('  (pulado: sem bash nesta máquina, os testes de hook do framework não rodam)')
  process.exit(0)
}

let falhas = 0
for (const rel of ARQUIVOS) {
  const r = spawnSync('bash', [join(AQUI, rel)], { encoding: 'utf8' })
  const saida = `${r.stdout || ''}${r.stderr || ''}`
  if (r.status === 0) {
    const quantos = (saida.match(/^\s+ok/gm) || []).length
    console.log(`  ok   ${rel} — ${quantos} caso(s)`)
  } else {
    falhas++
    console.log(`  FALHA ${rel} (saída ${r.status})`)
    for (const l of saida.split('\n').filter((x) => /FALH/.test(x))) console.log(`    ${l}`)
  }
}

if (falhas) process.exit(1)
