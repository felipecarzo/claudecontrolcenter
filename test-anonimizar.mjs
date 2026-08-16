/**
 * Gate do F12: o mascarador que roda antes de qualquer arquivo chegar até mim.
 *
 * Este arquivo NÃO é a suíte de verdade. A suíte de verdade tem 35 casos e mora
 * no Pierre (`app_pierre/src/lib/anonimizar.test.mjs`), porque é lá que o
 * detector nasceu e é contra contrato real que ele foi calibrado. Duplicar os
 * 35 casos aqui criaria duas verdades para o mesmo comportamento, e uma das
 * duas ficaria velha em silêncio — que é exatamente o defeito que este arquivo
 * existe para pegar.
 *
 * Então ele faz duas coisas, nessa ordem de importância:
 *
 * 1. **Se o Pierre estiver no disco**, roda os 35 casos DELE contra o port
 *    daqui. É a prova de sincronia: se alguém consertar um lado só, quebra.
 *    Foi o que aconteceu em 15/08 com o `RE_ENDERECO` (commit `46999be` lá).
 * 2. **Sempre**, roda o mínimo que o cockpit precisa garantir sozinho, porque
 *    ele tem que funcionar em máquina que não tem o inovallbond clonado.
 *
 * O mínimo é curto de propósito, e cada caso guarda uma decisão que já custou
 * caro. Cobertura ampla é responsabilidade do item 1.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { anonimizar, reidentificar, vazou } from './src/anonimizar.mjs'
import { mascararArquivo } from './src/anonimoDisco.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
let contados = 0

const caso = (nome, fn) => {
  try { fn(); contados++ } catch (e) {
    console.error(`\n✗ ${nome}\n  ${e.message}\n`)
    process.exitCode = 1
  }
}

/* ── 1. sincronia com a origem ─────────────────────────────────────────────
   O caminho é procurado, nunca fixado: a VPS e o PC do Felipe guardam os
   projetos em lugares diferentes, e `CC_PROJECTS_BASE` é a saída para quem
   guarda em um terceiro. Não achar não é falha — é máquina sem o Pierre. */
const basesPossiveis = [
  process.env.CC_PROJECTS_BASE,
  path.join(AQUI, '..'),
  path.join(AQUI, '..', '..'),
].filter(Boolean)

const suiteDoPierre = basesPossiveis
  .map((b) => path.join(b, 'inovallbond', 'apps', 'app_pierre', 'src', 'lib', 'anonimizar.test.mjs'))
  .find((p) => fs.existsSync(p))

if (suiteDoPierre) {
  /* A suíte importa `./anonimizar.ts`, que o Node não executa. Trocamos o
     import pelo port e rodamos o arquivo inteiro, sem tocar no original. */
  const fonte = fs.readFileSync(suiteDoPierre, 'utf8')
    .replace(/from ["']\.\/anonimizar\.ts["']/, `from ${JSON.stringify(path.join(AQUI, 'src', 'anonimizar.mjs'))}`)

  const temporario = path.join(AQUI, `.anonimizar-sincronia-${process.pid}.mjs`)
  fs.writeFileSync(temporario, fonte, 'utf8')
  try {
    await import(`file://${temporario}`)
    console.log('sincronia com o Pierre: a suíte de lá passa contra o port daqui')
  } finally {
    fs.rmSync(temporario, { force: true })
  }
} else {
  console.log('sincronia com o Pierre: pulada, o inovallbond não está nesta máquina')
}

/* ── 2. o mínimo que vale sozinho ──────────────────────────────────────── */

caso('mascara e devolve: o caminho de volta é exato', () => {
  const original = 'Joao da Silva Pereira, CPF 111.444.777-35, mora na Rua Augusta 10, sala 402.'
  const r = anonimizar(original)
  assert.notEqual(r.texto, original, 'não mascarou nada')
  assert.equal(reidentificar(r.texto, r.mapa), original)
})

caso('a rede de segurança acusa quando algo escapa', () => {
  /* `vazou()` é o que faz o hook falhar FECHADO. Se ele parar de acusar, o
     hook passa a deixar dado real ir embora achando que mascarou. */
  const r = anonimizar('CPF 111.444.777-35 e nada mais.')
  assert.equal(vazou(r.texto, r.mapa).length, 0)
  assert.ok(vazou(`o CPF era 111.444.777-35`, r.mapa).length > 0, 'não acusou o vazamento')
})

caso('endereço não engole o texto depois da vírgula (regressão de 15/08)', () => {
  /* O defeito que este port encontrou e devolveu ao Pierre. Fica aqui também
     porque é o único caso em que o port foi ORIGEM da correção. */
  const r = anonimizar('com sede na Avenida Paulista 1000, doravante CONTRATADA.')
  assert.ok(r.texto.includes('doravante CONTRATADA'), `engoliu: ${JSON.stringify(r.texto)}`)
})

caso('mas o complemento de verdade continua dentro', () => {
  const r = anonimizar('na Avenida das Nacoes 1200, conjunto 71, o escritorio.')
  const e = r.achados.find((a) => a.tipo === 'ENDERECO')
  assert.equal(e?.valor, 'Avenida das Nacoes 1200, conjunto 71')
})

caso('CPF inválido não vira etiqueta', () => {
  /* Contraprova: o dígito verificador é conferido. Sem isso, qualquer número
     com 11 dígitos viraria dado pessoal, e o texto ficaria ilegível. */
  const r = anonimizar('protocolo 111.111.111-11 do processo')
  assert.equal(r.achados.filter((a) => a.tipo === 'CPF').length, 0)
})

/* ── 3. os extratores, medidos contra contrato real ────────────────────────
   O detector é do Pierre e tem a suíte dele. Os extratores são daqui, e o teste
   que vale para eles não é "extraiu alguma coisa": é **o mascarador acha no PDF
   o mesmo que acha no `.txt` equivalente**. Foi assim que o F16 foi decidido, e
   é assim que uma regressão aparece.

   Sem os contratos no disco, esta parte é pulada em vez de fingir que passou. */
const contratos = basesPossiveis
  .map((b) => path.join(b, 'inovallbond', 'assets', 'contratos-exemplo'))
  .find((p) => fs.existsSync(p))

if (!contratos) {
  console.log('extratores: pulados, os contratos de exemplo não estão nesta máquina')
} else {
  const { extrairPdf } = await import('./src/extrairPdf.mjs')
  const { extrairDocx } = await import('./src/extrairDocx.mjs')

  const valoresDe = (texto) => new Set(Object.values(anonimizar(texto).mapa))

  const mesmoQueOTxt = (nome, extrair) => caso(`${nome}: nada escapa que o .txt pegaria`, () => {
    const base = path.join(contratos, nome)
    const extraido = extrair(base)
    const referencia = fs.readFileSync(base.replace(/\.\w+$/, '.txt'), 'utf8')
    const escaparam = [...valoresDe(referencia)].filter((v) => !valoresDe(extraido).has(v))
    assert.deepEqual(escaparam, [], `escaparam: ${JSON.stringify(escaparam)}`)
  })

  for (const n of ['01-servicos-abusivo.pdf', '04-saas-renovacao-automatica.pdf', '06-mutuo-conversivel.pdf']) {
    mesmoQueOTxt(n, extrairPdf)
  }
  for (const n of ['02-nda-equilibrado.docx', '03-acordo-socios-startup.docx']) {
    mesmoQueOTxt(n, extrairDocx)
  }

  caso('o PDF de duas páginas não perde a segunda', () => {
    /* Regressão de 15/08: `N 0 obj` aparece por acaso dentro dos dados binários
       da fonte, e indexar os objetos por número fazia metade do contrato sumir
       sem erro nenhum — 1201 de 2386 caracteres, cortando no meio de uma frase.
       O contrato 06 tem 2 páginas e é o que pega isso. */
    const t = extrairPdf(path.join(contratos, '06-mutuo-conversivel.pdf'))
    assert.ok(t.length > 2000, `saiu curto demais: ${t.length} chars`)
    assert.ok(/ARBITRAGEM/i.test(t), 'a cláusula da segunda página não veio')
  })

  caso('PDF ilegível é BLOQUEADO, nunca mascarado pela metade', () => {
    /* O hook falha fechado, e o piso de 40 caracteres é o que separa "li" de
       "não li". PDF escaneado, cifrado ou com objeto comprimido cai aqui. */
    const falso = path.join(os.tmpdir(), `cc-teste-${process.pid}.pdf`)
    fs.writeFileSync(falso, '%PDF-1.4\nisto nao e um PDF de verdade\n%%EOF')
    try {
      const r = mascararArquivo(falso)
      assert.equal(r.ok, false, 'deixou passar um PDF que não conseguiu ler')
      assert.ok(r.opaco, 'não marcou como opaco')
    } finally {
      fs.rmSync(falso, { force: true })
    }
  })
}

console.log(`anonimizar (mínimo do cockpit): ${contados} casos passaram`)
