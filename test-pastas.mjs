/**
 * CC-352, a parte do PC: ele ESCOLHE onde ficam os projetos, e são várias
 * pastas. Aqui é a escrita; `test-bases.mjs` cuida da leitura.
 *
 * ⚠️ **Casa isolada por `CC_HOME`, e por import dinâmico.** `CONFIG_FILE`, em
 * `src/config.mjs`, é resolvido no topo do módulo: com `import` estático o
 * arquivo já estaria apontando para o `~/.claude` de verdade antes da primeira
 * linha rodar, e este teste gravaria a lista de pastas DELE. É a mesma lição do
 * bloco de notas, que é candidato à causa do apagamento de 2026-08-09.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'pastas-casa-'))
process.env.CC_HOME = casa
delete process.env.CC_PROJECTS_BASE

/* ⚠️ **`CC_HOME` isola a configuração, e NÃO isola a descoberta.** Medido em
   31/08, quando este teste chegou do PC e falhou na VPS sem ter mudado uma
   linha: sem job nenhum, `detectarBase()` procura as pastas convencionais
   direto em `os.homedir()`, que é disco de verdade e não passa por `CC_HOME`.

   No Windows dele isso não acha nada, porque os projetos moram noutra unidade;
   na VPS existe `~/projetos`, então a lista nascia com uma pasta real dentro e
   três casos caíam em cascata. O teste não estava errado: ele estava medindo a
   máquina junto com o código.

   `os.homedir()` respeita `HOME` no Linux e `USERPROFILE` no Windows. Apontar
   os dois para a casa temporária faz a descoberta encontrar o mesmo nada nas
   duas máquinas, que é a única forma de este teste significar a mesma coisa
   dos dois lados. Seguro porque roda em processo próprio. */
process.env.HOME = casa
process.env.USERPROFILE = casa

const I = await import('./src/install.mjs')
const C = await import('./src/config.mjs')

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'pastas-'))
const musica = path.join(raiz, 'musica')
const ti = path.join(raiz, 'TI')
fs.mkdirSync(musica, { recursive: true })
fs.mkdirSync(ti, { recursive: true })

try {
  // a casa isolada tem que ser mesmo a isolada, senão tudo abaixo grava no dele
  assert.ok(C.CONFIG_FILE.startsWith(casa), `o config foi parar fora da casa de teste: ${C.CONFIG_FILE}`)
  ok('o teste grava numa casa temporária, nunca no ~/.claude dele')

  try {
    assert.deepEqual(I.basesEscolhidas(), [], 'quem nunca escolheu não tem lista')
    const r = I.adicionarBase(musica)
    assert.equal(r.ok, true)
    assert.deepEqual(I.basesEscolhidas(), [path.resolve(musica)])
    ok('a primeira pasta escolhida entra na lista')
  } catch (e) { erro('primeira pasta', e) }

  try {
    I.adicionarBase(ti)
    assert.deepEqual(I.basesEscolhidas(), [path.resolve(musica), path.resolve(ti)])
    ok('a segunda entra junto, que é o pedido dele (TI e música)')
  } catch (e) { erro('segunda pasta', e) }

  try {
    const r = I.adicionarBase(ti)
    assert.equal(r.jaTinha, true)
    assert.equal(I.basesEscolhidas().length, 2, 'repetir não pode duplicar')
    ok('adicionar de novo não duplica, e diz que já tinha')
  } catch (e) { erro('sem duplicar', e) }

  try {
    const r = I.adicionarBase(path.join(raiz, 'isso-nao-existe'))
    assert.equal(r.ok, false)
    assert.match(r.erro, /não existe/)
    assert.equal(I.basesEscolhidas().length, 2, 'a lista não pode mudar quando o caminho é ruim')
    ok('pasta que não existe é recusada, com a frase do porquê')
  } catch (e) { erro('pasta inexistente', e) }

  try {
    const r = I.removerBase(musica)
    assert.equal(r.ok, true)
    assert.deepEqual(I.basesEscolhidas(), [path.resolve(ti)])
    assert.equal(r.voltouPraAutomatico, false)
    ok('remover tira só a que foi pedida')
  } catch (e) { erro('remover', e) }

  try {
    const r = I.removerBase(path.join(raiz, 'nunca-esteve'))
    assert.equal(r.ok, false)
    ok('remover o que não estava na lista avisa, em vez de fingir que fez')
  } catch (e) { erro('remover inexistente', e) }

  try {
    const r = I.removerBase(ti)
    assert.equal(r.voltouPraAutomatico, true)
    assert.deepEqual(I.basesEscolhidas(), [], 'lista vazia é "apaguei todas"')
    ok('esvaziar a lista devolve a máquina para a descoberta automática')
  } catch (e) { erro('esvaziar', e) }

  /* A semeadura, e é o caso que mais importa: enquanto nada foi escolhido a
     leitura cai na descoberta. Se a primeira pasta escolhida virasse a lista
     inteira, acrescentar "música" APAGARIA a pasta de trabalho que funcionava,
     e o sintoma seria o painel esvaziando sem erro nenhum. */
  try {
    const trabalho = path.join(raiz, 'trabalho')
    fs.mkdirSync(trabalho, { recursive: true })
    process.env.CC_PROJECTS_BASE = trabalho
    assert.deepEqual(I.basesEscolhidas(), [], 'ainda sem escolha registrada')
    I.adicionarBase(musica)
    const depois = I.basesEscolhidas().map((p) => path.resolve(p))
    assert.ok(depois.includes(path.resolve(trabalho)), 'a pasta que já valia não pode sumir')
    assert.ok(depois.includes(path.resolve(musica)))
    ok('a primeira escolha começa com o que já estava valendo, sem perder pasta')
  } catch (e) { erro('semeadura', e) }
} finally {
  delete process.env.CC_PROJECTS_BASE
  fs.rmSync(raiz, { recursive: true, force: true })
  fs.rmSync(casa, { recursive: true, force: true })
}

if (falhou) process.exit(1)
console.log('test-pastas: ok')
