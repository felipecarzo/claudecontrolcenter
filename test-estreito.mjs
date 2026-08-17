/**
 * O gate do estreito: nenhuma tela pode vazar de lado no telefone.
 *
 * ## Por que existe, e por que fora do `npm test`
 *
 * O CC-73 consertou o vazamento lateral em 15/08 e ele voltou em 16/08, por
 * outro caminho: o `#tabs` é filho de um flex e nasce com `min-width: auto`, ou
 * seja, com a largura do conteúdo. As 15 abas somavam 480px num painel de 390, e
 * o `<select>` do CC-77 herdou essa largura errada.
 *
 * **Conferir isso a olho não escala:** são 15 telas, e o defeito aparece em uma
 * só. Aqui o navegador mede `getBoundingClientRect()` de todo elemento e acusa
 * quem passa da borda — o mesmo método que achou o `#tabs`, em vez de eu chutar
 * qual elemento era.
 *
 * Fica FORA do `npm test` pela mesma razão do `test-ui.mjs`: precisa de Chrome, e
 * o gate tem que rodar em qualquer máquina.
 *
 * ```bash
 * node test-estreito.mjs                 # painel na porta padrão
 * node test-estreito.mjs 8123            # outra porta
 * ```
 *
 * ## O que NÃO é vazamento
 *
 * Elemento com `overflow-x: auto` rola dentro de si mesmo — é a solução, não o
 * problema (tabela larga, faixa de módulos). O teste pula esses de propósito.
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'

const PORTA = process.argv[2] || 5180
const BASE = `http://127.0.0.1:${PORTA}`
const LARGURA = 390 // iPhone 12/13/14 em CSS pixels, o aparelho dele
const ALTURA = 780

const CHROME = [
  `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`,
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p))

const PW = ['/usr/local/lib/hermes-agent/index.js', '/opt/hermes-work/ahtleta/index.js']
  .map((raiz) => { try { return createRequire(raiz)('playwright-core') } catch { return null } })
  .find(Boolean)

if (!CHROME || !PW) {
  console.log('pulado: esta máquina não tem Chrome nem playwright-core')
  process.exit(0)
}

const abas = [...fs.readFileSync('src/ui.html', 'utf8')
  .match(/const TABS = \[([\s\S]*?)\n\]/)[1].matchAll(/id: '([a-z]+)'/g)].map((m) => m[1])

const browser = await PW.chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: LARGURA, height: ALTURA } })

let falhas = 0
for (const aba of abas) {
  /* Os DOIS temas, não um: o claro nasceu em 17/08 e vazamento pode ser
     específico de tema, porque sombra e borda têm larguras diferentes nos
     dois. E `tema=escuro` não existe mais: os nomes são noite e papel. */
  for (const tema of ['noite', 'papel']) {
    await page.goto(`${BASE}/?static=1&tema=${tema}&tab=${aba}`, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const r = await page.evaluate(() => {
    const limite = document.documentElement.clientWidth
    const vaza = []
    for (const el of document.querySelectorAll('body *')) {
      const cx = el.getBoundingClientRect()
      if (cx.right <= limite + 1 || cx.width < 30) continue
      /* Rolar dentro de si é a solução, não o defeito. Vale para o elemento E
         para os filhos dele: a fileira de abas do modo aplicativo (17/08) rola
         na horizontal de propósito, e as pastilhas de dentro passariam da borda
         em qualquer largura de telefone. Antes daqui a checagem só olhava o
         próprio elemento e um `.rolagem` no caminho, então filho de contêiner
         rolável era acusado como vazamento. */
      let dentroDeRolagem = false
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(p).overflowX)) { dentroDeRolagem = true; break }
      }
      if (dentroDeRolagem) continue
      if (el.closest('[style*="overflow"], .rolagem')) continue
      const nome = el.tagName.toLowerCase()
        + (el.id ? `#${el.id}` : '')
        + (typeof el.className === 'string' && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '')
      vaza.push(`${nome} passa ${Math.round(cx.right - limite)}px`)
    }
    return { scroll: document.documentElement.scrollWidth, limite, vaza: [...new Set(vaza)].slice(0, 5) }
  })
  const rolaLado = r.scroll > r.limite + 1
  if (r.vaza.length || rolaLado) {
    falhas += 1
    console.log(`  FALHOU ${aba} [${tema}]${rolaLado ? `, a página rola de lado (${r.scroll}px)` : ''}`)
    r.vaza.forEach((v) => console.log(`           ${v}`))
  } else {
    console.log(`  ok     ${aba} [${tema}]`)
  }
  }
}

/* --- o menu de navegação sobrevive ao stream? ---

   Queixa dele em 16/08, usando o painel no telefone: "clico lá e aparece
   cockpit etc, antes de dar tempo de eu clicar ele some e eu tenho que clicar
   de novo".

   O `render()` reescreve `#tabs` a cada 2 segundos, e o <select> aberto morre
   junto — levando o popup nativo do sistema, que nem aparece no DOM. É a mesma
   família da armadilha do textarea, e enganou porque o <select> parece seguro:
   é pequeno e não tem texto digitado.

   Este teste roda SEM `?static=1` de propósito. Com o stream desligado o
   defeito não existe, e um teste que não pode falhar não prova nada. */
console.log('\n— o menu de navegação, com o stream ligado —')
/* O alvo mudou em 17/08: o menu de uma linha morreu com a chegada do modo
   aplicativo (barra de baixo com os quatro grupos), mas a ARMADILHA continua
   viva no seletor de modo do framework, dentro da lista de módulos. O teste
   passou a usar ele, que é `<select>` de verdade dentro do bloco redesenhado
   pelo stream. */
const SEL = 'select.fw-modo'
await page.goto(`${BASE}/?tema=noite&tab=projetos`, { waitUntil: 'load' })
await page.waitForTimeout(1800)
await page.click('[data-fw-lista]')
await page.waitForSelector(SEL, { timeout: 8000 })

await page.focus(SEL)
await page.evaluate((s) => { document.querySelector(s).dataset.marca = 'aberto' }, SEL)
await page.waitForTimeout(5000) // mais de dois tiques

const sobreviveu = await page.evaluate((s) => {
  const el = document.querySelector(s)
  return { mesmo: el?.dataset.marca === 'aberto', focado: document.activeElement === el }
}, SEL)

if (!sobreviveu.mesmo || !sobreviveu.focado) {
  falhas += 1
  console.log('  FALHOU o <select> aberto foi destruído pelo render() — o menu fecha na cara dele')
} else {
  console.log('  ok     sobrevive a 5s de stream com o foco dentro')
}

/* A navegação do modo aplicativo: a barra de baixo troca de grupo e a aba
   escolhida vira a primeira do grupo novo. É o caminho que substituiu o menu,
   então é ele que precisa de prova. */
await page.evaluate((sel) => document.querySelector(sel)?.blur(), SEL)
await page.click('#app-bar button[data-grupo="custo"]')
await page.waitForTimeout(1200)
const trocou = await page.evaluate(() => localStorage.getItem('cc-tab'))
if (!['tempo', 'graficos', 'preco'].includes(trocou)) {
  falhas += 1
  console.log(`  FALHOU a barra de baixo não trocou de grupo (ficou em ${trocou})`)
} else {
  console.log('  ok     a barra de baixo troca de grupo')
}
await page.goto(`${BASE}/?tema=noite&tab=projetos`, { waitUntil: 'load' })
await page.waitForTimeout(1800)
await page.click('[data-fw-lista]')
await page.waitForSelector(SEL, { timeout: 8000 })
await page.focus(SEL)

/* E o redesenho precisa VOLTAR depois: segurar para sempre congelaria as
   contagens das abas, que é trocar um defeito por outro mais difícil de notar. */
await page.evaluate((s) => document.querySelector(s).blur(), SEL)
await page.evaluate((s) => { document.querySelector(s).dataset.marca = 'velho' }, SEL)
await page.waitForTimeout(4500)
const voltou = await page.evaluate((s) => document.querySelector(s)?.dataset.marca === undefined, SEL)
if (!voltou) {
  falhas += 1
  console.log('  FALHOU o redesenho não voltou depois do blur — a tela congela')
} else {
  console.log('  ok     o redesenho volta quando o foco sai')
}

/* O teste consegue MESMO pegar o defeito?
   Desliga a guarda pela janela e confere que o <select> volta a morrer. Um
   teste que só sabe dizer "hoje passa" não prova que pegaria a regressão —
   este reproduz o problema original em cima do código já consertado. */
const semGuarda = await browser.newPage({ viewport: { width: LARGURA, height: ALTURA } })
await semGuarda.addInitScript(() => { window.SEM_GUARDA = true })
await semGuarda.goto(`${BASE}/?tema=noite&tab=projetos`, { waitUntil: 'load' })
await semGuarda.waitForTimeout(1800)
await semGuarda.click('[data-fw-lista]')
await semGuarda.waitForSelector(SEL, { timeout: 8000 })
await semGuarda.focus(SEL)
await semGuarda.evaluate((s) => { document.querySelector(s).dataset.marca = 'aberto' }, SEL)
await semGuarda.waitForTimeout(5000)
const aindaPega = await semGuarda.evaluate(
  (s) => document.querySelector(s)?.dataset.marca !== 'aberto', SEL,
)
if (!aindaPega) {
  falhas += 1
  console.log('  FALHOU este teste não pega mais o defeito — a checagem virou decorativa')
} else {
  console.log('  ok     sem a guarda o defeito volta, então o teste vale')
}
await semGuarda.close()

await browser.close()
console.log(falhas ? `\n${falhas} falha(s) em ${LARGURA}px` : `\nok — ${abas.length} telas cabem em ${LARGURA}px, e o menu sobrevive ao stream`)
process.exit(falhas ? 1 : 0)
