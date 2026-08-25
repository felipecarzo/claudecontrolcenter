/**
 * O controle único do framework, na central, dirigido por navegador.
 *
 * FORA do `npm test`: precisa do painel no ar e de um Chrome. Rodar à mão:
 *
 *     npm run test:framework-unico
 *
 * Por que existe: em 25/08 ele mandou print de um projeto que mostrava o
 * framework em modo "Desligado" e, ao lado, um botão dizendo que ele estava
 * ligado. *"pra eu desligar eu preciso colocar desligado em dois lugares"*.
 * Eram dois controles para um fato só. Agora é uma lista só, e este arquivo
 * guarda as três coisas que não podem voltar: existir um controle só, ligar e
 * escolher num gesto só, e perguntar antes de desligar.
 *
 * NÃO escreve nada de verdade: a chamada de escrita é interceptada dentro da
 * página e só registrada. Teste que mexe no framework real dele é defeito.
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'

const CHROME = [
  `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`,
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p))
const PW = ['/usr/local/lib/hermes-agent/index.js', '/opt/hermes-work/ahtleta/index.js']
  .map((raiz) => { try { return createRequire(raiz)('playwright-core') } catch { return null } })
  .find(Boolean)

if (!CHROME || !PW) { console.log('pulado: esta máquina não tem Chrome nem playwright-core'); process.exit(0) }

const browser = await PW.chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 860 } })
const erros = []
page.on('pageerror', (e) => erros.push(String(e)))

await page.goto('http://127.0.0.1:5180/?tema=noite', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('[data-target="view-remoto"]')]
  ;(t.find((el) => el.getBoundingClientRect().width > 0) || t[0]).click()
})
await page.waitForTimeout(9000)

/* A partir daqui nenhuma escrita sai da página. */
await page.evaluate(() => {
  window.__chamadas = []
  const original = window.fetch
  window.fetch = (url, opcoes) => {
    if (String(url).includes('/api/framework') && opcoes?.method === 'POST') {
      window.__chamadas.push(JSON.parse(opcoes.body))
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }))
    }
    return original(url, opcoes)
  }
})

let falhas = 0
const ok = (c, m) => { if (!c) falhas++; console.log(`${c ? 'ok  ' : 'FALHA'}  ${m}`) }

// 1) Um controle só existe, e o botão separado sumiu
const estrutura = await page.evaluate(() => ({
  seletores: document.querySelectorAll('[data-cc-estado]').length,
  botaoAntigo: document.querySelectorAll('[data-cc-fw]').length,
  pastilhas: document.querySelectorAll('[data-cc-modo]').length,
}))
ok(estrutura.seletores > 0, `um controle por projeto: ${estrutura.seletores} seletores`)
ok(estrutura.botaoAntigo === 0, `o botão separado de ligar e desligar sumiu: ${estrutura.botaoAntigo} restantes`)
ok(estrutura.pastilhas === 0, `as pastilhas de modo sumiram: ${estrutura.pastilhas} restantes`)

// 2) Escolher um modo num projeto DESLIGADO tem que ligar e escolher, nessa ordem
const caso = await page.evaluate(async () => {
  /* Tem que ser um que NUNCA teve framework, senão não há o que ligar: o
     cartão diz isso com todas as letras, e é por essa frase que eu acho. */
  const cartao = [...document.querySelectorAll('.cc-card')]
    .find((c) => /nunca teve framework/i.test(c.textContent))
  const sel = cartao?.querySelector('[data-cc-estado]')
  if (!sel) return { erro: 'nenhum projeto sem framework na tela' }
  const opcao = [...sel.options].find((o) => o.value && o.value !== 'desligado')
  sel.value = opcao.value
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 1200))
  return { projeto: sel.dataset.ccEstado, escolhido: opcao.value, chamadas: window.__chamadas }
})
if (caso.erro) { falhas++; console.log('FALHA ', caso.erro) } else {
  const acoes = (caso.chamadas || []).map((c) => c.acao)
  ok(acoes[0] === 'ligar', `ligou primeiro (${acoes.join(' → ') || 'nada'})`)
  ok(acoes.length === 2 && (acoes[1] === 'modo' || acoes[1] === 'perfil'),
    `e escolheu em seguida, num gesto só: ${acoes.join(' → ')}`)
  ok((caso.chamadas || []).every((c) => c.projeto === caso.projeto), 'tudo no projeto certo')
}

// 2b) Num projeto JÁ ligado, trocar o modo não pode ligar de novo
const jaLigado = await page.evaluate(async () => {
  window.__chamadas = []
  const cartao = [...document.querySelectorAll('.cc-card')]
    .find((c) => /instalado e guardando o MVP/i.test(c.textContent))
  const sel = cartao?.querySelector('[data-cc-estado]')
  if (!sel) return { erro: 'nenhum projeto ligado no modo desligado agora' }
  const opcao = [...sel.options].find((o) => o.value && o.value !== 'desligado')
  sel.value = opcao.value
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 1200))
  return { chamadas: window.__chamadas }
})
if (jaLigado.erro) console.log('aviso:', jaLigado.erro)
else {
  const acoes = (jaLigado.chamadas || []).map((c) => c.acao)
  ok(!acoes.includes('ligar') && acoes.length === 1,
    `projeto já ligado não liga de novo, só troca: ${acoes.join(' → ') || 'nada'}`)
}

// 3) Escolher "Desligado" num projeto valendo tem que PERGUNTAR antes
const desliga = await page.evaluate(async () => {
  window.__chamadas = []
  const sel = [...document.querySelectorAll('[data-cc-estado]')].find((s) => s.value !== 'desligado')
  if (!sel) return { erro: 'nenhum projeto ligado na tela' }
  sel.value = 'desligado'
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 1200))
  const texto = document.body.innerText
  return { perguntou: /Desligar o framework/i.test(texto), chamadas: window.__chamadas }
})
if (desliga.erro) { console.log('aviso:', desliga.erro) } else {
  ok(desliga.perguntou, 'pergunta antes de desligar')
  ok((desliga.chamadas || []).length === 0, 'e não desligou nada enquanto a pergunta está aberta')
}

if (erros.length) console.log('ERROS NA PÁGINA:', erros.slice(0, 3))
else console.log('nenhum erro de execução na página')
await browser.close()
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
process.exit(falhas ? 1 : 0)
