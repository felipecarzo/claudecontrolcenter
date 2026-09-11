/**
 * `cc sincronia`: ele responde a verdade nos quatro estados?
 *
 * Pergunta dele em 11/09: *"eu acredito que esse sistema que verifica a cada
 * 30 segundos exista, mas onde ele tá, como eu garanto que funciona?!"*.
 *
 * O comando existe para ele responder isso sozinho. Um comando que só sabe
 * dizer "está tudo bem" não serve para garantir nada, então o que este arquivo
 * guarda são os casos RUINS: sem configuração, pausado, parado há muito tempo,
 * e o painel fora do ar.
 *
 * Roda contra um servidor de mentira, sem tocar na sincronia de verdade.
 */
import assert from 'node:assert'
import { execFile } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
let ok = 0
const t = async (nome, fn) => { await fn(); ok++; console.log('  ok  ', nome) }

/** Um painel de mentira que responde o que o teste mandar.
 *  `listen` é assíncrono: sem esperar o evento, `address()` volta `null` e o
 *  teste morre antes de testar coisa nenhuma. */
function painelFalso(resposta) {
  const s = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(resposta))
  })
  return new Promise((pronto) => {
    s.listen(0, '127.0.0.1', () => pronto(s))
  })
}

/**
 * ⚠️ **Assíncrono de propósito, e a versão síncrona travava sem erro nenhum.**
 *
 * O painel de mentira roda NESTE processo. `execFileSync` bloqueia o event
 * loop enquanto espera o filho, então o servidor não consegue responder, o
 * filho espera para sempre, e o teste recebe saída VAZIA. Nenhum dos dois
 * lados dá erro: parece que o comando não imprime nada.
 */
const rodar = (porta, extra = []) => new Promise((pronto) => {
  execFile(process.execPath, [path.join(AQUI, 'cc.mjs'), 'sincronia', '--port', String(porta), ...extra], {
    encoding: 'utf8', timeout: 40000, env: { ...process.env, CC_SEM_NAVEGADOR: '1' },
  }, (erro, saida, err) => pronto(String(saida || '') + String(err || '')))
})

console.log('\ncc sincronia: responde a verdade nos quatro estados\n')

await t('LIGADA e recente: diz para onde manda e quando foi', async () => {
  const s = await painelFalso({
    token: 'x', enviandoPara: 'https://exemplo.com', ativo: true,
    empurrando: { em: Date.now() - 5000, ok: true, jobs: 7, erro: null },
  })
  const saida = await rodar(s.address().port)
  s.close()
  assert.ok(saida.includes('ligada'), saida)
  assert.ok(saida.includes('exemplo.com'), 'tem que dizer para ONDE manda')
  assert.ok(saida.includes('7 sessões'), 'tem que dizer quanto levou')
})

await t('⚠️ SEM configuração: diz que NÃO está ligado, e por quê', async () => {
  const s = await painelFalso({ token: null, enviandoPara: null, empurrando: {} })
  const saida = await rodar(s.address().port)
  s.close()
  assert.ok(saida.includes('NÃO está ligado'), `devia dizer que não está ligado: ${saida}`)
  assert.ok(saida.includes('não há erro nem aviso'), 'a trava discreta precisa ser dita: sem os dois, nada viaja e nada avisa')
  assert.ok(saida.includes('cc.mjs federar'), 'acusar sem dar a saída é a burocracia que ele desliga')
})

await t('PAUSADA por ele: diz que é pausa, não defeito', async () => {
  const s = await painelFalso({ token: 'x', enviandoPara: 'https://exemplo.com', ativo: false, empurrando: {} })
  const saida = await rodar(s.address().port)
  s.close()
  assert.ok(saida.includes('PAUSADA'), saida)
  assert.ok(!saida.includes('NÃO está ligado'), 'pausa e falta de configuração são coisas diferentes')
})

await t('⚠️ PARADA há mais de três ciclos: avisa', async () => {
  const s = await painelFalso({
    token: 'x', enviandoPara: 'https://exemplo.com', ativo: true,
    empurrando: { em: Date.now() - 300_000, ok: true, jobs: 3 },
  })
  const saida = await rodar(s.address().port)
  s.close()
  assert.ok(saida.includes('três ciclos'), `devia avisar do atraso: ${saida}`)
})

await t('atraso PEQUENO não vira alarme', async () => {
  const s = await painelFalso({
    token: 'x', enviandoPara: 'https://exemplo.com', ativo: true,
    empurrando: { em: Date.now() - 45_000, ok: true, jobs: 3 },
  })
  const saida = await rodar(s.address().port)
  s.close()
  assert.ok(!saida.includes('três ciclos'), 'alarme que dispara no normal é alarme que ele desliga na terceira vez')
})

await t('⚠️ o último envio FALHOU: mostra o erro, não esconde', async () => {
  const s = await painelFalso({
    token: 'x', enviandoPara: 'https://exemplo.com', ativo: true,
    empurrando: { em: Date.now() - 5000, ok: false, erro: 'ECONNREFUSED', jobs: 0 },
  })
  const saida = await rodar(s.address().port)
  s.close()
  assert.ok(saida.includes('NÃO'), `devia dizer que não deu certo: ${saida}`)
  assert.ok(saida.includes('ECONNREFUSED'), 'o motivo tem que aparecer, senão ele não tem o que investigar')
})

await t('painel FORA DO AR: diz isso, e não finge que está tudo bem', async () => {
  const saida = await rodar(59_999) // porta onde não há ninguém
  assert.ok(saida.includes('não consegui falar com o painel'), saida)
  assert.ok(saida.includes('sobe ele'), 'tem que dizer como resolver')
})

console.log(`\n${ok} verificações, 0 falhas\n`)
