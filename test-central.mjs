/**
 * CC-332: a central de comando abre sessão e conversa, e diz o que está no ar.
 *
 * ## Por que este teste existe
 *
 * Queixa dele em 23/08, olhando o telefone: *"o painel de sessões quebrou, eu
 * não consigo iniciar direito as sessões, só consegui pelo coderoom. e também
 * os botões tão errados, as sessões não tão como iniciadas lá, e tb não tem a
 * opção de começar sessão no coderoom nem de abrir uma extra (de cada)"*.
 *
 * A causa medida: o cartão da central tinha um botão só, "abrir sessão", e num
 * projeto que já tinha sessão a rota respondia `{"ok":true,"ja":true}`. O
 * servidor devolvia a sessão existente, nada abria, e a tela não dizia nada.
 *
 * ## O que este teste mede, e o que ele recusa medir
 *
 * Mede o que ele VÊ: quais botões existem no cartão de um projeto com sessão no
 * ar e no de um projeto sem, se há caminho para o Coderoom em todos, e se o
 * aviso aparece quando o servidor devolve a sessão que já existia.
 *
 * **Não abre sessão de verdade em nenhum projeto.** A resposta `ja: true` é
 * simulada trocando o `fetch` da página: abrir uma sessão real deixaria
 * processo vivo na máquina dele como efeito de um teste.
 *
 * ## Prova negativa
 *
 * Cada verificação estrutural é refeita depois de arrancar do DOM aquilo que
 * ela procura. Teste que só sabe dizer "hoje passa" não prova que pegaria a
 * volta do defeito.
 *
 * ## Por que fora do `npm test`
 *
 * Precisa de Chrome e de um painel no ar:
 *     node --experimental-websocket test-central.mjs [url]
 */
import { spawn } from 'node:child_process'
import { chromePath } from './src/platform.mjs'

const CHROME = chromePath()
const URL_BASE = process.argv[2] || 'http://127.0.0.1:5180/'
const PORTA = 9890 + (process.pid % 40)
const PERFIL = `${process.env.TMPDIR || '/tmp'}/cc-central-${process.pid}`

if (!CHROME) {
  console.error('sem Chrome nesta máquina. Aponte um com CC_CHROME=<caminho>')
  process.exit(1)
}

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--force-device-scale-factor=1', `--remote-debugging-port=${PORTA}`,
  '--user-data-dir=' + PERFIL, 'about:blank',
], { stdio: 'ignore' })

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let ws = null
let falhas = 0
const conta = (nome, ok, detalhe = '') => {
  console.log(`  ${ok ? 'ok    ' : 'FALHOU'} ${nome}${detalhe ? `: ${detalhe}` : ''}`)
  if (!ok) falhas++
}

try {
  let pronto = false
  for (let i = 0; i < 40 && !pronto; i++) {
    await esperar(250)
    try { await (await fetch(`http://127.0.0.1:${PORTA}/json/version`)).json(); pronto = true } catch { /* subindo */ }
  }
  if (!pronto) throw new Error('o Chrome não abriu a porta de depuração')

  /* Aba própria, aberta por `/json/new`. Pegar a primeira da lista devolve
     qualquer aba que já estivesse no perfil, e uma captura pedida em 390
     acabava medindo a janela de 1280 da execução anterior. */
  const nova = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(nova.webSocketDebuggerUrl)
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x })
  let id = 0
  const pend = new Map()
  const erros = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.method === 'Runtime.exceptionThrown') {
      erros.push(String(m.params?.exceptionDetails?.exception?.description || 'erro').split('\n')[0])
    }
    if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  }
  const cmd = (metodo, params = {}) => new Promise((r) => { const meu = ++id; pend.set(meu, r); ws.send(JSON.stringify({ id: meu, method: metodo, params })) })
  const js = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

  await cmd('Page.enable')
  await cmd('Runtime.enable')
  /* 390px de verdade. Captura mais larga do que afirma já mentiu por 28% neste
     projeto, e a régua barata é a barra de baixo. */
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
  await cmd('Page.navigate', { url: URL_BASE + '#remoto' })
  await esperar(9000)

  const regua = await js(`JSON.stringify([...document.querySelectorAll('.barra-baixo .bb-item')]
    .map((b) => Math.round(b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2)))`)
  conta('a medida é de 390px de verdade', regua === '[39,117,195,273,351]', regua)

  const naTela = await js(`document.querySelector('.view-section.active')?.id`)
  conta('a Central está no palco', naTela === 'view-remoto', String(naTela))

  /* O retrato de cada cartão: nome, o que o selo diz, e o rótulo de cada botão
     agrupado pelo destino a que ele pertence. */
  const RETRATO = `JSON.stringify([...document.querySelectorAll('#cc-central .cc-card')].map((c) => ({
    nome: c.querySelector('.cc-cab b')?.textContent.trim().split(' ')[0],
    selo: c.querySelector('.cc-selo')?.textContent.trim(),
    grupos: Object.fromEntries([...c.querySelectorAll('.rc-grupo')].map((g) => [
      g.querySelector('.rc-grupo-nome')?.textContent.trim(),
      [...g.querySelectorAll('button')].map((b) => b.textContent.trim()),
    ])),
  })))`
  const cartoes = JSON.parse(await js(RETRATO))
  conta('a central listou os projetos', cartoes.length > 5, `${cartoes.length} cartões`)

  const comSessao = cartoes.filter((c) => /sess(ão|ões) no ar/.test(c.selo || ''))
  const semSessao = cartoes.filter((c) => c.selo === 'sem sessão')
  conta('há cartão dos dois estados para comparar', comSessao.length > 0 && semSessao.length > 0,
    `${comSessao.length} com sessão, ${semSessao.length} sem`)

  /* O defeito que ele viu: com sessão no ar, o cartão oferecia "abrir sessão",
     que devolvia a que já existia e não avisava nada. */
  const erradoNoAr = comSessao.filter((c) => (c.grupos['Claude Code'] || []).includes('abrir sessão'))
  conta('projeto com sessão no ar NÃO oferece "abrir sessão"', erradoNoAr.length === 0,
    erradoNoAr.map((c) => c.nome).join(', '))
  const semDesligar = comSessao.filter((c) => !(c.grupos['Claude Code'] || []).includes('desligar'))
  conta('projeto com sessão no ar oferece desligar', semDesligar.length === 0, semDesligar.map((c) => c.nome).join(', '))
  const semMais = comSessao.filter((c) => !(c.grupos['Claude Code'] || []).includes('mais uma'))
  conta('projeto com sessão no ar oferece abrir mais uma', semMais.length === 0, semMais.map((c) => c.nome).join(', '))
  const semAbrir = semSessao.filter((c) => !(c.grupos['Claude Code'] || []).includes('abrir sessão'))
  conta('projeto sem sessão oferece abrir sessão', semAbrir.length === 0, semAbrir.map((c) => c.nome).join(', '))

  /* "não tem a opção de começar sessão no coderoom": todo cartão precisa ter
     caminho para lá, tenha ele conversa aberta ou não. */
  const semCoderoom = cartoes.filter((c) => !(c.grupos.Coderoom || []).length)
  conta('todo cartão tem caminho para o Coderoom', semCoderoom.length === 0, semCoderoom.map((c) => c.nome).join(', '))
  const coderoomLendo = cartoes.filter((c) => (c.grupos.Coderoom || []).includes('lendo…'))
  conta('as conversas já foram lidas, e nenhum botão ficou preso em "lendo…"', coderoomLendo.length === 0,
    coderoomLendo.map((c) => c.nome).join(', '))
  const comConversa = cartoes.filter((c) => (c.grupos.Coderoom || []).includes('mais uma'))
  conta('quem tem conversa aberta pode abrir uma extra', comConversa.length > 0,
    comConversa.map((c) => c.nome).join(', ') || 'nenhum projeto com conversa aberta agora')

  /* O framework continua no cartão, que é o ponto do desenho da central: o modo
     é escolhido ANTES de abrir a sessão, e no mesmo lugar. */
  const semFw = cartoes.filter((c) => !(c.grupos.Framework || []).length)
  conta('o framework continua no mesmo cartão', semFw.length === 0, semFw.map((c) => c.nome).join(', '))

  /* ===== o aviso de "já estava aberta" =====
     O `fetch` da página responde `ja: true` só para esta chamada, que é o que o
     servidor faz quando a sessão já existe. Nenhuma sessão é aberta de verdade. */
  const alvo = semSessao[0]?.nome
  if (!alvo) {
    conta('há projeto sem sessão para testar o aviso', false, 'todos estão no ar')
  } else {
    await js(`(() => {
      window.__realFetch = window.fetch;
      window.fetch = (u, o) => (String(u).includes('/api/remote-control') && o?.method === 'POST'
        ? Promise.resolve(new Response(JSON.stringify({ ok: true, ja: true, sessao: 'fingida' }), { status: 200, headers: { 'content-type': 'application/json' } }))
        : window.__realFetch(u, o));
    })()`)
    const clicou = await js(`(() => {
      const b = [...document.querySelectorAll('#cc-central [data-remoto-ligar]')]
        .find((x) => x.dataset.remotoLigar === ${JSON.stringify(alvo)});
      if (!b) return false;
      b.scrollIntoView(); b.click(); return true;
    })()`)
    conta('dá para clicar em abrir sessão no cartão', clicou === true, String(alvo))
    await esperar(600)
    const perguntou = await js(`document.getElementById('conf-fundo')?.hidden === false
      && document.getElementById('conf-titulo')?.textContent`)
    conta('a central pergunta antes de abrir', typeof perguntou === 'string' && perguntou.includes(alvo), String(perguntou))
    const diz = await js(`document.getElementById('conf-detalhe')?.textContent || ''`)
    conta('a pergunta mostra a pasta e o modo', /pasta:/.test(diz), diz.slice(0, 90))

    await js(`document.getElementById('conf-sim').click()`)
    await esperar(1200)
    const rotulo = await js(`(() => {
      const b = [...document.querySelectorAll('#cc-central [data-remoto-ligar]')]
        .find((x) => x.dataset.remotoLigar === ${JSON.stringify(alvo)});
      return b ? b.textContent.trim() : '(o botão sumiu)';
    })()`)
    conta('quando o servidor devolve a sessão que já existia, o botão diz isso',
      rotulo === 'já estava aberta', String(rotulo))
    await js(`(() => { window.fetch = window.__realFetch })()`)
  }

  /* ===== prova negativa =====
     Arranca do DOM o que cada verificação procura e refaz a conta. Se ela
     continuar passando, ela não está medindo o que diz medir. */
  await js(`(() => {
    document.querySelectorAll('#cc-central .rc-grupo').forEach((g) => {
      if (g.querySelector('.rc-grupo-nome')?.textContent.trim() === 'Coderoom') g.remove();
    });
  })()`)
  const semCoderoomAgora = JSON.parse(await js(RETRATO)).filter((c) => !(c.grupos.Coderoom || []).length)
  conta('prova negativa: sem os botões do Coderoom, a verificação acusa',
    semCoderoomAgora.length > 0, `${semCoderoomAgora.length} cartões acusados`)

  await js(`(() => {
    document.querySelectorAll('#cc-central .cc-card .rc-grupo').forEach((g) => {
      if (g.querySelector('.rc-grupo-nome')?.textContent.trim() !== 'Claude Code') return;
      const b = g.querySelector('[data-remoto-desligar]');
      if (b) b.remove();
    });
  })()`)
  const semDesligarAgora = JSON.parse(await js(RETRATO))
    .filter((c) => /sess(ão|ões) no ar/.test(c.selo || ''))
    .filter((c) => !(c.grupos['Claude Code'] || []).includes('desligar'))
  conta('prova negativa: sem o botão de desligar, a verificação acusa',
    semDesligarAgora.length > 0, `${semDesligarAgora.length} cartões acusados`)

  conta('nenhum erro de execução na tela', erros.length === 0, erros.slice(0, 3).join(' | '))
} catch (e) {
  console.error('  FALHOU  ' + (e?.message || e))
  falhas++
} finally {
  try { ws?.close() } catch { /* já foi */ }
  chrome.kill()
}

console.log(falhas ? `\n  ${falhas} verificação(ões) falharam` : '\n  central de comando: tudo passou')
process.exit(falhas ? 1 : 0)
