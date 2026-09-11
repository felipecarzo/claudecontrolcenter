/**
 * CC-441: o cockpit abre como programa, em janela própria.
 *
 * Ele pediu duas vezes, e a segunda foi cobrança: *"queria fechar um programa
 * no desktop que funcionasse como um programa"*, e ao escolher a forma:
 * *"janela própria, sem cara de navegador"*.
 *
 * O que este teste NÃO faz: abrir uma janela de verdade. Isso deixaria uma
 * janela órfã por execução do gate, e é o mesmo formato do servidor de
 * background que ficou 11 horas vivo. O que ele prova é a DECISÃO: qual motor
 * escolher, com que argumentos, e o que acontece quando não há nenhum.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'janela-'))
const antes = { CC_JANELA: process.env.CC_JANELA, CC_HOME: process.env.CC_HOME }
process.env.CC_HOME = casa

const P = await import('./src/platform.mjs')

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

try {
  try {
    // um "navegador" de mentira, para não depender do que a máquina tem
    const falso = path.join(casa, P.ehWindows ? 'navegador.exe' : 'navegador')
    fs.writeFileSync(falso, '')
    process.env.CC_JANELA = falso
    assert.equal(P.motorDeJanela(), falso, 'CC_JANELA vem primeiro, e é o que o teste usa')
    ok('dá para apontar o motor de janela, então o teste não depende da máquina')
  } catch (e) { erro('CC_JANELA', e) }

  try {
    process.env.CC_JANELA = path.join(casa, 'isso-nao-existe.exe')
    const m = P.motorDeJanela()
    assert.notEqual(m, process.env.CC_JANELA, 'caminho que não existe não pode ser escolhido')
    ok('motor apontado para caminho inexistente é ignorado, não devolvido')
  } catch (e) { erro('motor inexistente', e) }

  try {
    delete process.env.CC_JANELA
    const m = P.motorDeJanela()
    // nesta máquina há Edge; em outra pode não haver, e null é resposta legítima
    assert.ok(m === null || fs.existsSync(m), 'ou acha um que existe, ou devolve null')
    ok(`sem apontar, procura o que a máquina tem (${m ? path.basename(m) : 'nenhum'})`)
  } catch (e) { erro('procura', e) }

  try {
    process.env.CC_JANELA = path.join(casa, 'nada-aqui.exe')
    /* ⛔ **A trava fica LIGADA aqui dentro, e não é detalhe de teste.**
     *
     * Esta verificação chamava `abrirComoApp` de verdade, e numa máquina com
     * Edge isso abre uma JANELA REAL: `CC_JANELA` apontado para arquivo que
     * não existe faz `motorDeJanela()` ignorar o valor e procurar o Edge de
     * verdade, que está instalado aqui. Medido em 11/09: cinco janelas na
     * tela dele entre 01:53 e 01:58, uma por `npm test`. Palavras dele:
     * *"isso tava me atrapalhando muito (…) é inadmissível"*.
     *
     * Ligar a trava aqui, em vez de depender de quem roda o gate lembrar dela,
     * é a diferença entre regra escrita e regra que vale. O caso logo abaixo
     * prova que a trava funciona; este prova que a resposta continua no
     * formato certo. */
    process.env.CC_SEM_NAVEGADOR = '1'
    const r = P.abrirComoApp('http://127.0.0.1:9/x', { perfil: path.join(casa, 'perfil') })
    assert.equal(typeof r.ok, 'boolean', 'sempre responde, nunca lança')
    if (!r.ok) assert.ok('caiuNaAba' in r, 'quando falha, diz se conseguiu abrir de outro jeito')
    ok('sem motor de janela, cai na aba comum e avisa, em vez de não fazer nada')
  } catch (e) { erro('sem motor', e) } finally { delete process.env.CC_SEM_NAVEGADOR }

  /* ⛔ **O gate não pode abrir janela na cara dele, e abria.**
   *
   * Medido em 11/09: cinco janelas do Edge entre 01:53 e 01:58, uma por
   * execução do `npm test`. A causa era o teste acima, que chama
   * `abrirComoApp` de verdade numa máquina que TEM Edge. Ele reclamou na
   * hora: *"isso tava me atrapalhando muito (…) é inadmissível"*.
   *
   * Este caso é a rede: se a trava sumir do `platform.mjs`, ele falha aqui em
   * vez de falhar abrindo janela na tela dele. */
  try {
    process.env.CC_SEM_NAVEGADOR = '1'
    delete process.env.CC_JANELA
    const r = P.abrirComoApp('http://127.0.0.1:9/x', { perfil: path.join(casa, 'perfil2') })
    assert.equal(r.pulado, true, 'com CC_SEM_NAVEGADOR=1 nada pode ser aberto')
    assert.equal(r.ok, true, 'pular de propósito não é falha')
    const n = P.abrirNavegador('http://127.0.0.1:9/x')
    assert.equal(n.pulado, true, 'a aba comum também tem que respeitar a trava')
    ok('CC_SEM_NAVEGADOR=1 impede QUALQUER janela: é o que faz o gate rodar calado')
  } catch (e) { erro('trava de navegador', e) } finally { delete process.env.CC_SEM_NAVEGADOR }
} finally {
  for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  fs.rmSync(casa, { recursive: true, force: true })
}

if (falhou) process.exit(1)
console.log('test-janela: ok')
