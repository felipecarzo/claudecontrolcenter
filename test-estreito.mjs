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
  await page.goto(`${BASE}/?static=1&tema=escuro&tab=${aba}`, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const r = await page.evaluate(() => {
    const limite = document.documentElement.clientWidth
    const vaza = []
    for (const el of document.querySelectorAll('body *')) {
      const cx = el.getBoundingClientRect()
      if (cx.right <= limite + 1 || cx.width < 30) continue
      // rolar dentro de si é a solução, não o defeito
      if (/auto|scroll/.test(getComputedStyle(el).overflowX)) continue
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
    console.log(`  FALHOU ${aba}${rolaLado ? ` — a página rola de lado (${r.scroll}px)` : ''}`)
    r.vaza.forEach((v) => console.log(`           ${v}`))
  } else {
    console.log(`  ok     ${aba}`)
  }
}

await browser.close()
console.log(falhas ? `\n${falhas} de ${abas.length} telas vazam em ${LARGURA}px` : `\nok — ${abas.length} telas cabem em ${LARGURA}px`)
process.exit(falhas ? 1 : 0)
