/**
 * CC-223 — cada tela tem endereço, voltar volta, recarregar mantém.
 *
 * ## Por que este teste existe fora do gate
 *
 * Ele precisa de um Chrome e de um painel no ar, então não entra no `npm test`,
 * que roda em segundos e sem rede. Roda com `npm run test:endereco`.
 *
 * ## Por que ele NÃO usa `?static=1`
 *
 * A armadilha já registrada: com o fluxo ao vivo desligado, todo teste de
 * interação passa e não prova nada, porque o defeito clássico deste painel é o
 * redesenho de 2 em 2 segundos atropelando o estado da tela. Aqui isso importa
 * em dobro: se um tique do fluxo reescrevesse a lista de agentes, o agente
 * aberto se fecharia sozinho e o endereço apontaria para o vazio.
 *
 * ## O que ele guarda
 *
 * Os dois sintomas que ele descreveu, nas palavras dele: *"clico em um outro
 * painel e decido clicar em voltar ele não volta pra anterior"*, e *"se eu
 * atualizar a página ele volta pra aba inicial"*.
 */
import { spawn } from 'node:child_process'
import { chromePath } from './src/platform.mjs'

const CHROME = chromePath()
const URL_BASE = process.argv[2] || 'http://127.0.0.1:5180/'
const PORTA = 9700 + (process.pid % 200)
const PERFIL = `${process.env.TMPDIR || process.env.TEMP || '/tmp'}/cc-endereco-${process.pid}`

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
  console.log(`  ${ok ? 'ok    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}

try {
  let pronto = false
  for (let i = 0; i < 40 && !pronto; i++) {
    await esperar(250)
    try { await (await fetch(`http://127.0.0.1:${PORTA}/json/version`)).json(); pronto = true } catch { /* subindo */ }
  }
  if (!pronto) throw new Error('o Chrome não abriu a porta de depuração')

  /* Aba NOVA, e conectar nela pelo id: `lista[0]` pega qualquer aba que já
     estivesse no perfil, armadilha que já fez uma medição de 390 acontecer
     numa janela de 1280 de outra execução. */
  const nova = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(nova.webSocketDebuggerUrl)
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x })
  let id = 0
  const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const cmd = (metodo, params = {}) => new Promise((r) => { const meu = ++id; pend.set(meu, r); ws.send(JSON.stringify({ id: meu, method: metodo, params })) })
  const js = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

  await cmd('Page.enable')
  await cmd('Runtime.enable')

  /* CC-231: erro em tempo de execução não é erro de sintaxe, e o gate só sabe
     ver o segundo. Uma variável que deixou de existir fez `renderViewAgora`
     lançar no meio: a tela Agora ficou com o bloco central vazio, prometendo
     pendências no cabeçalho e mostrando nada. Ninguém viu por horas, porque a
     página carrega, navega e não mostra erro em lugar algum.
     Daqui em diante o Chrome conta o que aconteceu. */
  const erros = []
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params?.exceptionDetails
      erros.push(`${d?.exception?.description || d?.text || 'erro'}`.split('\n')[0])
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      erros.push(`console.error: ${(m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 160))
    }
  })
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 })
  await cmd('Page.navigate', { url: URL_BASE })
  await esperar(5000)

  const estado = () => js('({ hash: location.hash, tela: document.querySelector(\'.view-section.active\')?.id, ag: (typeof agSelecionado !== \'undefined\' ? agSelecionado : null) })')

  let e = await estado()
  conta('abre no Cockpit, sem endereço na barra', e.tela === 'view-cockpit' && !e.hash, JSON.stringify(e))

  await js("showPage('view-trabalho')"); await esperar(1200)
  e = await estado()
  conta('ir para Trabalho grava #trabalho', e.hash === '#trabalho' && e.tela === 'view-trabalho', JSON.stringify(e))

  await js("showPage('view-agentes')"); await esperar(1500)
  e = await estado()
  conta('ir para Agentes grava #agentes', e.hash === '#agentes' && e.tela === 'view-agentes', JSON.stringify(e))

  const abriu = await js("(() => { const el = document.querySelector('[data-ag]'); if (!el) return null; el.click(); return el.dataset.ag })()")
  await esperar(1200)
  e = await estado()
  conta('abrir um agente grava #agentes/<id>', Boolean(abriu) && e.hash === '#agentes/' + abriu && e.ag === abriu, JSON.stringify(e))

  await js('history.back()'); await esperar(1200)
  e = await estado()
  conta('voltar fecha o agente e fica em Agentes', e.hash === '#agentes' && e.tela === 'view-agentes' && !e.ag, JSON.stringify(e))

  /* CC-370, decisão dele em 27/08: **voltar de novo NÃO troca de tela.**
     Ele usa Android, onde voltar é gesto do sistema, e o gesto da borda o
     tirava da tela em que estava. Trocar de tela passou a SUBSTITUIR a parada
     em vez de empilhar, então o painel inteiro guarda no máximo duas: onde ele
     está, e o que ele abriu por cima.
     O teste anterior afirmava o contrário, e ele decidiu com o tradeoff na
     mesa. A verificação agora é a que sobrou de pé: navegar não engorda o
     histórico. `<= 2` e não `=== 1` porque o Chrome já começa com a parada da
     página em branco antes de navegar. */
  const paradas = await js('history.length')
  await js("showPage('view-cockpit')"); await esperar(600)
  await js("showPage('view-trabalho')"); await esperar(600)
  await js("showPage('view-agentes')"); await esperar(600)
  const paradasDepois = await js('history.length')
  conta('trocar de tela não empilha parada no histórico',
    paradasDepois === paradas, `antes=${paradas} depois=${paradasDepois}`)

  /* O botão de voltar DA TELA e o do aparelho precisam concordar. Fechando o
     agente na mão, o toque em voltar do telefone traria ele de volta, e os dois
     botões diriam coisas diferentes sobre onde ele está. */
  await js("showPage('view-agentes')"); await esperar(1200)
  await js("document.querySelector('[data-ag]')?.click()"); await esperar(1200)
  await js("document.querySelector('[data-ag-voltar]')?.click()"); await esperar(1200)
  e = await estado()
  conta('o voltar da tela concorda com o do navegador', e.hash === '#agentes' && !e.ag, JSON.stringify(e))

  await cmd('Page.navigate', { url: URL_BASE + '#trabalho' })
  await esperar(5000)
  e = await estado()
  conta('recarregar em #trabalho abre em Trabalho', e.tela === 'view-trabalho', JSON.stringify(e))

  /* Endereço que não existe não pode deixar a tela em branco: link velho,
     erro de digitação e favorito de uma tela que mudou de nome caem aqui. */
  await cmd('Page.navigate', { url: URL_BASE + '#nao-existe' })
  await esperar(5000)
  e = await estado()
  conta('endereço desconhecido cai no Cockpit', e.tela === 'view-cockpit', JSON.stringify(e))

  /* CC-231: abre TODAS as telas do menu, uma a uma, e cobra duas coisas:
     que nada exploda, e que a tela não fique muda. Bloco central vazio com o
     cabeçalho prometendo conteúdo foi o defeito que passou despercebido. */
  const telas = await js("[...new Set([...document.querySelectorAll('.nav-item[data-target]')].map((a) => a.dataset.target))]")
  /* ⚠️ **Esperar um tempo fixo transforma corrida em teste que oscila.**
     Medido em 29/08: com 900ms cegos, a tela dos painéis dele passava numa
     rodada e falhava na seguinte, sem nada mudar no código. Um teste que
     oscila ensina a ignorar a falha, que é pior que não ter teste.
     Agora ele INSISTE até um teto, e a falha só é declarada quando o teto
     estoura — aí é defeito de verdade, não fila do navegador. O tempo que
     cada tela levou aparece junto: tela que precisa de segundos é lenta na
     mão dele, mesmo passando. */
  /* 12 segundos, e o número é medido, não chutado. Com 6s as telas de Tempo e
     Escritório eram lidas no meio da carga: elas varrem ~800 MB de transcrito e
     levam mais que isso. O teste então as declarava "curtas", e eu quase fui
     consertar duas telas que estavam cheias.
     O preço é a rodada demorar mais. Ela roda fora do gate, sob pedido. */
  const TETO_MS = 12000
  for (const tela of telas || []) {
    await js(`showPage('${tela}')`)
    const comecou = Date.now()
    let vazio = ''
    for (;;) {
      vazio = await js(`(() => {
        const v = document.getElementById('${tela}');
        if (!v) return 'a tela não existe no DOM';
        const t = (v.innerText || '').trim();
        /* ⚠️ **"carregando…" não é o único jeito de dizer "espera".** Medido em
           29/08: sete telas foram lidas no meio da carga porque diziam "lendo
           os quadros de rota…", "calculando…", "abrindo a estante…" ou
           "cruzando histórico…". O teste declarava "abre com conteúdo" sobre
           uma tela que ainda não tinha nada, e a medida de tela curta que
           depende disso saía errada junto.
           O sinal comum é o reticências no fim de um texto curto: nenhuma tela
           pronta cabe em 80 caracteres terminados em "…". */
        if (/^(carregando|lendo|calculando|abrindo|cruzando|buscando|varrendo|montando|colhendo)/i.test(t)) return 'a tela ficou presa em "' + t.slice(0, 40) + '"';
        if (t.length < 80 && /…\s*$/.test(t)) return 'a tela ficou presa em "' + t.slice(0, 40) + '"';
        return t.length < 12 ? 'a tela abriu praticamente vazia' : '';
      })()`)
      if (!vazio || Date.now() - comecou > TETO_MS) break
      await esperar(300)
    }
    const levou = Date.now() - comecou
    conta(`${tela} abre com conteúdo`, !vazio, vazio ? `${vazio} (${TETO_MS}ms de espera)` : '')
    if (!vazio && levou > 1500) console.log(`  (lenta: ${tela} levou ${levou}ms para mostrar algo)`)

    /* ⚠️ **Tela que é só um botão PASSA no teste de conteúdo.** O Digest tinha
       16 caracteres — o rótulo de um botão — contra 300 KB de dado pronto do
       outro lado da rota, e passava porque 16 é mais que 12. Achado em 29/08
       lendo o texto de cada tela, não o código.
       Isto não falha de propósito: existe tela legitimamente curta, e um
       limiar chutado viraria falha que se aprende a ignorar. Ele LISTA, para
       a tela quase morta aparecer de graça na próxima leitura. */
    if (!vazio) {
      /* ⚠️ **Medir aqui é medir cedo.** O laço acima para no INSTANTE em que a
         tela passa do limiar, e uma tela que ainda vai encher passa por curta.
         Medido em 29/08: Escritório e Tempo apareciam com 13 e 47 caracteres, e
         as duas estavam cheias — só levam mais uns segundos. Quase fui
         consertar duas telas que não têm defeito nenhum.
         Só quem parece curto paga a espera extra, então custa quase nada. */
      let texto = String(await js(`(document.getElementById('${tela}')?.innerText||'').trim()`))
      if (texto.length < 60) {
        await esperar(4000)
        texto = String(await js(`(document.getElementById('${tela}')?.innerText||'').trim()`))
      }
      if (texto.length < 60) console.log(`  (curta: ${tela} tem ${texto.length} caracteres — "${texto.replace(/\n/g, ' / ').slice(0, 70)}")`)
    }
  }
  /* ⚠️ **Tela que abre no lugar vazio passa em tudo que se mede acima.**
     A Análise abria escolhendo o primeiro projeto com sessão aberta, e esse
     projeto não tinha roadmap: as quatro abas do mapa existiam, funcionavam, e
     a tela dizia "este projeto não tem docs/ROADMAP.md" em toda abertura.
     Nenhum erro, texto de sobra, e o recurso inteiro invisível. É a peça
     inalcançável de novo, pela porta de entrada.
     A régua é a contagem: com um projeto que tem roadmap escolhido, o mapa
     traz grupos. Zero grupos com projetos que têm roadmap na máquina é o
     defeito.

     A prova ao contrário está MEDIDA, e foi ela que gerou este teste: com o
     `VPS_ibrics` escolhido, que é o que o padrão antigo pegava, o mapa vinha
     com ZERO grupos e a tela dizia que o projeto não tem roadmap. A régua
     acusa esse estado.

     ⚠️ E ela já se absolveu sozinha uma vez: a primeira versão lia
     `window.DATA`, que não existe (a variável é do escopo do script, não do
     objeto global). Tudo vinha vazio, a condição "se não há projeto com
     roadmap, tudo bem" absolvia, e o teste assinava embaixo. Teste que se
     absolve é pior que teste nenhum. Por isso ele agora EXIGE `comRoadmap > 0`
     em vez de tratar zero como caso benigno. */
  await js("showPage('view-analise')")
  /* ⚠️ **Esperar um tempo fixo aqui fez o teste passar por ESCAPE.** Na
     primeira versão, `comRoadmap` vinha zero porque a lista de projetos ainda
     não tinha chegado, e a condição "se não há projeto com roadmap, tudo bem"
     absolvia. Um teste que se absolve sozinho é pior que teste nenhum: ele
     assina que está tudo certo. Agora ele ESPERA a lista existir e só então
     mede, e diz quando desistiu de esperar. */
  let chegaram = 0
  for (let i = 0; i < 20; i++) {
    chegaram = await js(`(typeof DATA === 'undefined' ? [] : (DATA.projetos?.projetos || [])).length`)
    if (chegaram > 0) break
    await esperar(700)
  }
  await esperar(3000)
  const mapa = await js(`(() => {
    const proj = document.getElementById('analise-proj')?.value || '';
    const grupos = (typeof DATA === 'undefined' ? [] : (DATA.mapa?.grupos || [])).length;
    const comRoadmap = (typeof DATA === 'undefined' ? [] : (DATA.projetos?.projetos || []))
      .filter((p) => p.daqui && p.ehProjeto && ((p.frentes || 0) > 0 || (p.backlog || 0) > 0)).length;
    return { proj, grupos, comRoadmap };
  })()`)
  conta('a lista de projetos chega na tela Análise', chegaram > 0, `chegaram ${chegaram} projeto(s)`)
  conta('a Análise abre num projeto que tem o que mostrar',
    Boolean(mapa) && mapa.comRoadmap > 0 && mapa.grupos > 0,
    mapa ? `abriu em "${mapa.proj}" com ${mapa.grupos} grupo(s), e há ${mapa.comRoadmap} projeto(s) com roadmap na máquina` : 'não deu para medir')

  conta(`nenhum erro de execução nas ${(telas || []).length} telas`, erros.length === 0, erros.slice(0, 4).join(' | '))
} catch (err) {
  console.error('ERRO:', err?.message || err)
  falhas++
} finally {
  try { ws?.close() } catch { /* já fechado */ }
  chrome.kill()
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo passou')
  process.exit(falhas ? 1 : 0)
}
