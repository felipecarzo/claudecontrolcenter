/**
 * A trava contra "não vai quebrar nada": barra renomear pasta de projeto até a
 * varredura de impacto ter rodado para ela.
 *
 * Escolha dele em 26/08: travar a AÇÃO até investigar. Este teste prova os três
 * casos que importam: barra sem varredura, libera depois dela, e não atrapalha
 * o que não é pasta de projeto.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

const home = os.homedir()
const guard = new URL('./hooks/quebra-guard.mjs', import.meta.url).pathname

// roda o guard com um comando no stdin; devolve { code }
function rodar(comando) {
  try {
    execFileSync('node', [guard], { input: JSON.stringify({ tool_input: { command: comando } }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    return { code: 0 }
  } catch (e) { return { code: e.status ?? 1, erro: (e.stderr || '').toString() } }
}

/* acha uma pasta de projeto real para o teste (existe ~/projetos/<algo>).
   Achado em 26/08, rodando isto pela primeira vez no PC: `~/projetos` é
   convenção só da VPS. No PC os projetos moram em
   `D:\Documentos\Ti\projetos\{PESSOAL|CLIENTS|...}`, então a pasta nem
   existe, e `readdirSync` sem guarda derrubava o `npm test` inteiro (exceção
   não capturada, não "falhou") — tudo que vem depois na cadeia, `test.mjs`
   incluso, nem chegava a rodar. Pula aqui, mesmo padrão do Pierre e dos
   extratores: máquina sem o cenário não pode fingir que testou. */
const projetos = path.join(home, 'projetos')
let listaProjetos = []
try { listaProjetos = fs.readdirSync(projetos) } catch {
  console.log('  (pulado: esta máquina não tem ~/projetos, convenção só da VPS)')
  process.exit(0)
}
const alvo = listaProjetos.find((n) => {
  try { return fs.statSync(path.join(projetos, n)).isDirectory() && n.startsWith('VPS_') } catch { return false }
})
if (!alvo) {
  console.log('  (pulado: nenhuma pasta VPS_* dentro de ~/projetos nesta máquina)')
  process.exit(0)
}
const marcador = path.join(home, '.cache', 'agent-cockpit', 'impacto', encodeURIComponent(alvo || 'x'))
const tinhaMarcador = fs.existsSync(marcador)
const backup = tinhaMarcador ? fs.readFileSync(marcador, 'utf8') : null

try {
  // garante começar SEM marcador válido
  try { fs.rmSync(marcador) } catch { /* já não existe */ }

  // 1. renomear pasta de projeto SEM varredura: barra (exit 2)
  try {
    const r = rodar(`mv ~/projetos/${alvo} ~/projetos/${alvo}_novo`)
    assert.equal(r.code, 2, 'devia travar sem varredura')
    assert.match(r.erro, /AÇÃO TRAVADA/)
    ok('renomear pasta de projeto sem varredura é travado')
  } catch (e) { erro('barra sem varredura', e) }

  // 2. depois da varredura, o mesmo comando passa
  try {
    execFileSync('node', [new URL('./hooks/impacto-scan.mjs', import.meta.url).pathname, path.join(projetos, alvo), '--json'], { encoding: 'utf8' })
    const r = rodar(`mv ~/projetos/${alvo} ~/projetos/${alvo}_novo`)
    assert.equal(r.code, 0, 'depois da varredura, libera: ' + (r.erro || ''))
    ok('depois da varredura da pasta, a ação é liberada')
  } catch (e) { erro('libera após varredura', e) }

  // 3. mexer em ARQUIVO (não pasta de projeto) nunca trava
  try {
    const r = rodar('mv src/web.mjs src/web2.mjs')
    assert.equal(r.code, 0, 'mover arquivo não pode travar')
    ok('mover um arquivo não é travado (só pasta de projeto)')
  } catch (e) { erro('arquivo não trava', e) }

  // 4. comando inofensivo (ls) nunca trava
  try {
    assert.equal(rodar('ls ~/projetos').code, 0)
    ok('comando inofensivo passa')
  } catch (e) { erro('inofensivo passa', e) }

  // 5. FALSO POSITIVO que me pegou: git commit cuja MENSAGEM menciona mv/rm e o
  //    nome de um projeto. Não pode travar: "mv" está no texto, não é comando.
  try {
    const msg = `feat: trava mv/rm/rmdir de pasta de ~/projetos/${alvo} até varrer`
    const r = rodar(`git commit -q -m "${msg}"`)
    assert.equal(r.code, 0, 'commit com mv/rm no texto NÃO pode travar: ' + (r.erro || ''))
    ok('git commit com "mv/rm" na mensagem não é travado (texto não é comando)')
  } catch (e) { erro('commit não trava', e) }

  // 6. heredoc com mv/rm no corpo também não trava
  try {
    const r = rodar(`git commit -F - << 'EOF'\nmexe em mv e rm de ~/projetos/${alvo}\nEOF`)
    assert.equal(r.code, 0, 'heredoc com mv/rm não pode travar: ' + (r.erro || ''))
    ok('heredoc mencionando mv/rm não é travado')
  } catch (e) { erro('heredoc não trava', e) }

  // 7. echo com a palavra mv não trava
  try {
    assert.equal(rodar(`echo "vou mv a pasta ${alvo}"`).code, 0)
    ok('echo com a palavra mv não é travado')
  } catch (e) { erro('echo não trava', e) }
} finally {
  // restaura o marcador como estava, para não mexer no estado real dele
  try {
    if (backup !== null) fs.writeFileSync(marcador, backup)
    else fs.rmSync(marcador, { force: true })
  } catch { /* melhor esforço */ }
}

if (falhou) process.exit(1)
console.log('test-quebra: ok')
