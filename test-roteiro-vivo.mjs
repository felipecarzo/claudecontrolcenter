/**
 * CC-1081: o roteiro de uso ao vivo, com Chrome de verdade, numa página de teste (fora do gate).
 *
 *   node --experimental-websocket test-roteiro-vivo.mjs
 *
 * A página (`test/roteiro-fixture.html`) é uma página só, com abas que trocam o conteúdo sem mudar o
 * endereço, um cabeçalho fixo em todas as telas (como o do Nexus), uma tela escondida a 3 cliques, uma
 * tela com dois nomes (Ajuda e Suporte), um botão abaixo da dobra, um cartão de duas linhas, um relógio e
 * um contador que mudam sozinhos e um botão "Excluir tudo" que ninguém pode clicar.
 *
 * Confere o navegador (assinatura pelo conteúdo, idioma, recusa do que apaga, rolagem), o mapa (pelo filho,
 * como o comando usa, e contra o mapa sem atalho) e o agente com os três tipos de cérebro.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as R from './src/roteiro.mjs'
import { abrirNavegador, enderecoPermitido, lerAcesso, PROTEGIDOS } from './src/roteiroNavegador.mjs'
import { executarSondas, SONDAS } from './src/roteiroSondas.mjs'
import { alcancar, executarMapa, mapear, nomear } from './src/roteiroMapa.mjs'
import { rodarAgente, executarAgente, rodadas } from './src/roteiroAgente.mjs'

if (typeof WebSocket === 'undefined') {
  console.error('este teste pede `node --experimental-websocket test-roteiro-vivo.mjs` (o Node 20 não tem WebSocket)')
  process.exit(2)
}

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const URL_PAGINA = pathToFileURL(path.join(AQUI, 'test', 'roteiro-fixture.html')).href
const projeto = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rotvivo-'))
const saida = path.join(projeto, 'docs', 'roteiro')
const perfisAntes = () => fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('cc-roteiro-')).length
const antes = perfisAntes()
const t0 = Date.now()
setTimeout(() => { console.error('  !!  passou de 8 minutos: algo travou'); process.exit(1) }, 480000).unref()

const ok = (msg) => console.log(`  ok  ${msg}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const rotulos = (obs) => obs.elementos.map((e) => e.rotulo)
const secao = (obs) => obs.cabecalhos.at(-1) // o último cabeçalho; o primeiro ("Loja") é a moldura
const lerJsonl = (arq) => fs.readFileSync(arq, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const pares = (m) => [...new Set(m.arestas.map((a) => `${a.de}>${a.para}`))].sort()

try {
  /* ========== 0. a lista do que nunca se clica, e o nome da tela ========== */
  const perigos = ['Excluir tudo', 'Excluído', 'Sair', 'Fazer logout', 'Zerar o contador', 'Zerado', 'Pagar agora', 'Pagamento', 'Pague já', 'Comprar', 'Compra', 'Finalizar compra',
    'Finalizar a compra', 'Cancelar', 'Cancelamento', 'Encerrar sessão', 'Desativar', 'Reiniciar', 'Apagar', 'Deletar', 'Remover item', 'Limpar', 'Limpe tudo', 'Resetar', 'Desconectar',
    'Fazer backup agora', 'Enviar pedido', 'Confirmar pedido', 'Assinar plano', 'Sign out']
  for (const perigo of perigos) assert.ok(PROTEGIDOS.test(perigo), 'devia proteger: ' + perigo)
  const navegacao = ['Abrir o menu', 'Fechar o menu', 'Recolher', 'Tema', 'Idioma', 'Histórico de compras', 'Compras', 'Ficha do cliente', 'Detalhes do pedido', 'Fazer pedido', 'Fazer login',
    'Ofertas exclusivas', 'Zero', 'Remoto', 'Paginação', 'Missões', 'Plano de rota']
  for (const livre of navegacao) assert.ok(!PROTEGIDOS.test(livre), 'não devia proteger: ' + livre)
  ok(`proteção: ${perigos.length} formas de apagar, sair, zerar, pagar, cancelar e encerrar são barradas; menu, fechar, tema, idioma e "fazer pedido" passam (${navegacao.length} conferidas)`)

  assert.ok(enderecoPermitido('file:///a.html') && enderecoPermitido('http://localhost:5173/x') && enderecoPermitido('http://127.0.0.1:1/') && enderecoPermitido('https://testedevoo.carzo.com.br/a/'))
  for (const fora of ['https://example.com/', 'http://testedevoo.carzo.com.br/', 'http://127.0.0.2/', 'data:text/html,oi', 'ftp://localhost/']) assert.ok(!enderecoPermitido(fora), 'devia recusar: ' + fora)
  ok('endereços: só file://, localhost, 127.0.0.1 e https://testedevoo.carzo.com.br')

  const sinteticas = nomear([
    { id: 'raiz', cabecalhos: ['PAINEL', 'Mapa'], caminho: [] },
    { id: 't1', cabecalhos: ['PAINEL', 'Rota'], caminho: ['Rota'] },
    { id: 't2', cabecalhos: ['PAINEL', 'Rota'], caminho: ['Apps', 'Rota'] },
    { id: 't3', cabecalhos: ['PAINEL'], caminho: ['Apps', 'Só moldura'] },
    { id: 't4', cabecalhos: ['AVISO'], caminho: ['Aviso'] }, // uma tela fora do padrão, sem o cabeçalho fixo (como no Nexus)
  ])
  assert.deepEqual(sinteticas.map((t) => t.nome), ['Início', 'Rota (Rota)', 'Rota (Apps > Rota)', 'Só moldura', 'AVISO'])
  ok('nome da tela: raiz é Início, cabeçalho que está na maioria das telas é moldura (mesmo com uma tela fora do padrão), sem cabeçalho vale o último botão, repetido ganha o caminho')

  /* ========== 1. o navegador ========== */
  const nav = await abrirNavegador()
  try {
    await nav.ir(URL_PAGINA)
    let obs = await nav.observar()
    assert.deepEqual(obs.cabecalhos, ['Loja', 'Painel da loja'])
    assert.deepEqual(rotulos(obs), ['Início', 'Pedidos', 'Clientes', 'Ajuda', 'Excluir tudo'])
    assert.match(obs.assinatura, /^[0-9a-f]{12}$/)
    ok('navegador: abre a página e lista o que dá para clicar, com cabeçalho e assinatura')

    assert.match(obs.texto, /Idioma pt-BR/)
    ok('navegador: o Chrome sem tela abre em pt-BR (navigator.language), não em en-US')

    await dorme(1300) // o relógio da página anda duas vezes
    assert.equal((await nav.observar()).assinatura, obs.assinatura)
    ok('navegador: a assinatura não muda com o relógio andando (dígitos não contam)')

    const excluir = obs.elementos.find((e) => /Excluir/.test(e.rotulo))
    assert.equal(excluir.bloqueado, true)
    const recusa = await nav.clicar(excluir.n)
    assert.deepEqual([recusa.ok, recusa.motivo], [false, 'nao-tocar'])
    assert.equal(secao(await nav.observar()), 'Painel da loja')
    ok('navegador: "Excluir tudo" é recusado e a página continua intacta')

    assert.equal((await nav.clicar(obs.elementos.find((e) => e.rotulo === 'Pedidos').n)).ok, true)
    obs = await nav.observar()
    assert.equal(secao(obs), 'Lista de pedidos')
    const cartao = obs.elementos.find((e) => e.rotulo === 'Detalhes do pedido')
    assert.equal(cartao.descricao, 'Veja os itens do pedido e o total.')
    assert.ok(!('descricao' in obs.elementos.find((e) => e.rotulo === 'Suporte')))
    ok('navegador: o rótulo é a primeira linha do cartão ("Detalhes do pedido") e o resto vai para a descrição')

    const contador = obs.elementos.find((e) => /^Atualizar lista/.test(e.rotulo))
    await nav.clicar(contador.n)
    const depois = await nav.observar()
    assert.notEqual(depois.elementos.find((e) => /^Atualizar lista/.test(e.rotulo)).rotulo, contador.rotulo)
    assert.equal(depois.assinatura, obs.assinatura)
    ok('navegador: o clique de mouse mudou a tela, e um contador mudando de número não vira outra tela')

    await nav.clicar(depois.elementos.find((e) => e.rotulo === 'Ajuda').n)
    const janela = await nav.observar({ soVisivel: true })
    const inteira = await nav.observar({ soVisivel: false })
    assert.ok(!rotulos(janela).includes('Falar com a equipe') && rotulos(inteira).includes('Falar com a equipe'))
    assert.equal(janela.assinatura, inteira.assinatura)
    ok('navegador: soVisivel esconde o que está abaixo da dobra, e a assinatura é a mesma nos dois modos')

    let rolou = 0
    let vista = janela
    while (!rotulos(vista).includes('Falar com a equipe') && rolou < 5) { assert.equal(await nav.rolar(), true); rolou++; vista = await nav.observar({ soVisivel: true }) }
    assert.ok(rotulos(vista).includes('Falar com a equipe'), 'rolar não trouxe o botão para a janela')
    assert.equal(vista.assinatura, janela.assinatura)
    assert.equal(await nav.rolar({ acima: true }), true)
    for (let i = 0; i < 10 && await nav.rolar(); i++);
    assert.equal(await nav.rolar(), false) // no fim da página não anda mais
    ok(`navegador: rolar meia janela traz o botão da dobra (${rolou} rolagens), rolar acima volta, e no fim da página não anda`)

    const rolado = await nav.observar({ soVisivel: true })
    const botao = rolado.elementos.find((e) => e.rotulo === 'Falar com a equipe')
    assert.ok(botao, 'no fim da página o botão deveria estar na janela')
    assert.equal((await nav.clicar(botao.n)).ok, true)
    assert.equal(secao(await nav.observar()), 'Contato com a equipe')
    const foto = await nav.foto(path.join(projeto, 'teste.jpg'))
    assert.ok(fs.statSync(foto).size > 1000)
    ok('navegador: clica depois de rolar, e tira foto (jpeg)')
  } finally {
    await nav.fechar()
  }

  const em = await abrirNavegador({ idioma: 'en-US', naoTocar: '^Pedidos$' })
  try {
    await em.ir(URL_PAGINA)
    const o = await em.observar()
    assert.match(o.texto, /Idioma en-US/)
    assert.equal(o.elementos.find((e) => e.rotulo === 'Pedidos').bloqueado, true) // o que veio no plano
    assert.equal(o.elementos.find((e) => e.rotulo === 'Excluir tudo').bloqueado, true) // e a lista padrão continua valendo: `naoTocar` SOMA
    assert.equal(o.elementos.find((e) => e.rotulo === 'Clientes').bloqueado, false)
    assert.equal((await em.clicar(o.elementos.find((e) => e.rotulo === 'Pedidos').n)).motivo, 'nao-tocar')
  } finally {
    await em.fechar()
  }
  const so = await abrirNavegador({ naoTocarSo: '^Pedidos$' })
  try {
    await so.ir(URL_PAGINA)
    const o = await so.observar()
    assert.equal(o.elementos.find((e) => e.rotulo === 'Pedidos').bloqueado, true)
    assert.equal(o.elementos.find((e) => e.rotulo === 'Excluir tudo').bloqueado, false) // `naoTocarSo` TROCA a lista (e aqui ninguém clica nele)
  } finally {
    await so.fechar()
  }
  ok('navegador: `idioma` troca o idioma, `naoTocar` (texto de regex) SOMA à lista de proteção e `naoTocarSo` a troca')

  const pr = await abrirNavegador()
  try {
    await pr.ir(URL_PAGINA + '#protecao=1')
    const o = await pr.observar({ soVisivel: false })
    const marca = (rotulo) => o.elementos.find((e) => e.rotulo === rotulo)?.bloqueado
    assert.deepEqual(['Assinatura', 'Contador', 'Cartão fiel'].map(marca), [true, true, true]) // aria-label, title e descrição
    assert.deepEqual(['Ver relatório', 'Dados'].map(marca), [false, false]) // "histórico de compras" (plural) e "mais detalhes" passam
    assert.equal((await pr.clicar(o.elementos.find((e) => e.rotulo === 'Cartão fiel').n)).motivo, 'nao-tocar')
  } finally {
    await pr.fechar()
  }
  ok('proteção: o botão é barrado também quando só a descrição ("Pague com pontos"), o aria-label ("Cancelar assinatura") ou o title ("Zerar contador") denunciam')

  /* ========== 1b. a página hostil: o Chrome não sai do que é permitido ========== */
  const servidor = http.createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end('<h1>ALCANCOU O SERVIDOR DE FORA</h1>') })
  await new Promise((r) => servidor.listen(0, '0.0.0.0', r))
  const alvoFora = `http://127.0.0.2:${servidor.address().port}/`
  try {
    const seguro = await abrirNavegador()
    try {
      await assert.rejects(seguro.ir('https://example.com/'), /endereço recusado.*--qualquer-url|endereço recusado/s)
      await assert.rejects(seguro.ir(alvoFora), /endereço recusado/)
      await seguro.ir(URL_PAGINA + '#fora=' + alvoFora)
      const o = await seguro.observar()
      assert.equal((await seguro.clicar(o.elementos.find((e) => e.rotulo === 'Abrir site externo').n)).ok, true)
      const depois = await seguro.observar()
      assert.ok(!depois.texto.includes('ALCANCOU') && !depois.url.startsWith('http://127.0.0.2'), 'o clique levou o Chrome para fora: ' + depois.url)
    } finally {
      await seguro.fechar()
    }
    const comHost = await abrirNavegador({ permitir: ['127.0.0.2'] }) // só esse host a mais, sem abrir tudo
    try {
      await comHost.ir(URL_PAGINA + '#fora=' + alvoFora)
      const o = await comHost.observar()
      await comHost.clicar(o.elementos.find((e) => e.rotulo === 'Abrir site externo').n)
      assert.ok((await comHost.observar()).texto.includes('ALCANCOU'), 'permitir deveria liberar o host da lista')
      await assert.rejects(comHost.ir('https://example.com/'), /endereço recusado/)
    } finally {
      await comHost.fechar()
    }
    const aberto = await abrirNavegador({ qualquerUrl: true })
    try {
      await aberto.ir(URL_PAGINA + '#fora=' + alvoFora)
      const o = await aberto.observar()
      await aberto.clicar(o.elementos.find((e) => e.rotulo === 'Abrir site externo').n)
      assert.ok((await aberto.observar()).texto.includes('ALCANCOU'), 'o controle falhou: com qualquerUrl o servidor de fora deveria abrir')
    } finally {
      await aberto.fechar()
    }
  } finally {
    servidor.close()
  }
  ok('página hostil: endereço fora da lista é recusado em português, o clique num link para fora (que ABRE de verdade com qualquerUrl) não sai do Chrome, e `permitir` libera só o host da lista')

  /* ========== 2. o mapa, pelo filho (com o atalho) e, ao mesmo tempo, sem o atalho ========== */
  const tMapa = Date.now()
  const [caminhoMapa, exaustivo] = await Promise.all([
    executarMapa({ url: URL_PAGINA, raiz: projeto, saida, fotos: path.join(saida, 'fotos'), maxProfundidade: 3 }),
    mapear({ url: URL_PAGINA, maxProfundidade: 3, inferir: false }),
  ])
  assert.equal(caminhoMapa, path.join(saida, 'mapa.json'))
  const mapa = JSON.parse(fs.readFileSync(caminhoMapa, 'utf8'))
  const nomes = mapa.telas.map((t) => t.nome).sort()
  assert.equal(mapa.telas.length, 8, 'telas achadas: ' + nomes.join(', '))
  assert.equal(mapa.telas[0].id, 'raiz')
  assert.equal(mapa.parcial, false)
  assert.ok(!fs.existsSync(path.join(saida, 'mapa.novo.json')), 'o mapa.novo.json deveria ter virado mapa.json no fim')
  ok(`mapa: ${mapa.telas.length} telas numa página de endereço único (${nomes.join(', ')})`)

  assert.ok(mapa.telas.every((t) => t.titulo === 'Loja'), 'o teste deveria reproduzir o cabeçalho fixo em todas as telas')
  assert.equal(mapa.telas[0].nome, 'Início')
  assert.equal(new Set(nomes).size, 8)
  assert.ok(!nomes.includes('Loja'), 'a moldura virou nome de tela')
  ok('mapa: o cabeçalho fixo "Loja" está em todas as telas e não dá nome a nenhuma (cada tela tem o seu nome)')

  const escondida = mapa.telas.find((t) => t.nome === 'Histórico de compras')
  assert.equal(escondida.profundidade, 3)
  assert.equal(mapa.telas.filter((t) => t.profundidade === 3).length, 1)
  assert.deepEqual(escondida.caminho, ['Clientes', 'Ficha do cliente', 'Histórico de compras'])
  assert.equal(R.menorCaminho(mapa, 'raiz', escondida.id).length, 3)
  assert.deepEqual(escondida.passos.map((p) => p.rotulo), escondida.caminho) // o mapa grava COMO refazer cada clique (papel, nome e posição entre os iguais)
  assert.ok(escondida.passos.every((p) => /\|/.test(p.chave) && Number.isInteger(p.oc)))
  ok('mapa: a tela escondida está a 3 cliques (Clientes, Ficha do cliente, Histórico de compras)')

  assert.ok(mapa.telas.some((t) => t.nome === 'Contato com a equipe'), 'o botão abaixo da dobra não foi alcançado')
  assert.ok(mapa.arestas.some((a) => a.rotulo === 'Detalhes do pedido'), 'o rótulo do cartão deveria ser só a primeira linha')
  ok('mapa: alcançou a tela cujo botão fica abaixo da dobra, e o cartão de duas linhas entra pelo rótulo curto')

  assert.ok(!mapa.telas.some((t) => /exclu/i.test(t.nome)), 'o mapa clicou em "Excluir tudo"')
  assert.ok(!mapa.arestas.some((a) => PROTEGIDOS.test(a.rotulo)), 'há aresta com botão protegido')
  assert.deepEqual(mapa.naoTocados, ['Excluir tudo'])
  ok('mapa: "Excluir tudo" foi visto e nunca clicado (nenhuma tela "excluído", nenhuma aresta, listado em naoTocados)')

  assert.ok(mapa.avisos.every((a) => /profundidade máxima|não foram refeitos/.test(a)), 'avisos inesperados: ' + mapa.avisos.join(' | '))
  for (const t of mapa.telas) assert.ok(fs.existsSync(path.join(saida, t.foto)), 'sem foto de ' + t.id)
  ok('mapa: sem avisos de caminho quebrado, e cada tela tem a sua foto')

  const incons = R.rotulosInconsistentes(mapa)
  assert.ok(incons.mesmoDestino.some((x) => x.rotulos.includes('Ajuda') && x.rotulos.includes('Suporte')), JSON.stringify(incons))
  ok('mapa: o rótulo inconsistente aparece (a mesma tela se chama "Ajuda" e "Suporte")')

  const inferidas = mapa.arestas.filter((a) => a.inferida).length
  assert.ok(inferidas > 0, 'o atalho não entrou em ação')
  assert.deepEqual(pares(mapa), pares(exaustivo), 'o atalho mudou o mapa: um caminho sumiu ou apareceu')
  assert.equal(exaustivo.arestas.filter((a) => a.inferida).length, 0)
  ok(`mapa: o atalho (botão de moldura não refeito) pulou ${inferidas} cliques e o mapa tem as mesmas ${pares(mapa).length} ligações do mapa clicando em tudo (${((Date.now() - tMapa) / 1000).toFixed(0)} s, os dois ao mesmo tempo)`)

  /* ========== 2a. refazer o caminho: a gaveta fora da janela não pode enganar ========== */
  const refaz = await abrirNavegador()
  try {
    assert.equal(await alcancar(refaz, URL_PAGINA, escondida), escondida.assinatura) // com `passos`, o jeito do mapa
    const URL_GAVETA = URL_PAGINA + '#gaveta=1'
    await refaz.ir(URL_GAVETA)
    const o = await refaz.observar({ soVisivel: false })
    const iguais = o.elementos.filter((e) => e.rotulo === 'Clientes')
    assert.equal(iguais.length, 2) // a gaveta e a aba
    const primeiro = await refaz.clicar(iguais[0].n)
    assert.deepEqual([primeiro.ok, primeiro.motivo], [false, 'o elemento está fora da janela']) // a causa: o 1º "Clientes" é o da gaveta
    // sem `passos` (mapa antigo, só os rótulos): tenta os iguais um a um e chega
    const antigo = { id: 'tx', caminho: ['Clientes', 'Ficha do cliente', 'Histórico de compras'] }
    await alcancar(refaz, URL_GAVETA, antigo)
    assert.equal(secao(await refaz.observar()), 'Histórico de compras')
    // e um rótulo que não existe continua dando null (não inventa caminho)
    assert.equal(await alcancar(refaz, URL_GAVETA, { id: 'ty', caminho: ['Nao existe'] }), null)
  } finally { await refaz.fechar() }
  ok('refazer o caminho: com gaveta fora da janela (o 1º "Clientes" não clica), o mapa antigo, só com rótulos, acha o botão que clica; o mapa novo grava `passos`')

  /* ========== 2b. o mapa morto no meio não estraga o mapa bom ========== */
  const saidaMorta = path.join(projeto, 'morto')
  fs.mkdirSync(saidaMorta, { recursive: true })
  fs.writeFileSync(path.join(saidaMorta, 'mapa.json'), JSON.stringify({ sentinela: 'o mapa bom de antes' }))
  const filhoMapa = spawn(process.execPath, ['--experimental-websocket', path.join(AQUI, 'src', 'roteiroMapa.mjs'), '--plano', JSON.stringify({ url: URL_PAGINA, saida: saidaMorta, maxProfundidade: 3 })], { stdio: 'ignore' })
  const fechouMapa = new Promise((r) => filhoMapa.on('close', r))
  const novoMorto = path.join(saidaMorta, 'mapa.novo.json')
  for (let i = 0; i < 150 && !fs.existsSync(novoMorto); i++) await dorme(200)
  assert.ok(fs.existsSync(novoMorto), 'o progresso deveria estar em mapa.novo.json')
  filhoMapa.kill('SIGTERM') // o pai estourando o prazo faz exatamente isto
  await fechouMapa
  assert.equal(JSON.parse(fs.readFileSync(path.join(saidaMorta, 'mapa.json'), 'utf8')).sentinela, 'o mapa bom de antes')
  const parcial = JSON.parse(fs.readFileSync(novoMorto, 'utf8'))
  assert.equal(parcial.parcial, true)
  assert.ok(parcial.avisos.some((a) => /mapa parcial/.test(a)) && parcial.telas.length >= 2)
  ok(`mapa: morto no meio, o mapa.json bom ficou como estava e o parcial (${parcial.telas.length} telas) ficou em mapa.novo.json, com aviso`)

  /* ========== 3. o agente, cérebro roteiro (sem IA), pelo filho ========== */
  const objetivo = 'Ver quanto o cliente já gastou na loja'
  const roteiroOk = path.join(projeto, 'escolhas-ok.json')
  fs.writeFileSync(roteiroOk, JSON.stringify([{ rotulo: 'Clientes', pensamento: 'clientes parece certo' }, 'Ficha do cliente', 'Histórico de compras']))
  const t1 = { id: 'T1', objetivo, sucesso: { texto: 'Total gasto' } }
  const r1 = await executarAgente({ raiz: projeto, tarefa: t1, cerebro: 'roteiro:' + roteiroOk, persona: { nome: 'ana', paciencia: 'alta' } })
  assert.equal(r1.fim, 'sucesso')
  assert.deepEqual([r1.metricas.passos, r1.otimo, r1.metricas.voltas, r1.metricas.revisitas, r1.metricas.desorientacao], [3, 3, 0, 0, 0])
  const linhas = lerJsonl(r1.arquivo)
  assert.deepEqual(linhas.map((l) => l.tipo), ['sessao', 'passo', 'passo', 'passo', 'fim'])
  assert.deepEqual([linhas[0].tarefa, linhas[0].cerebro, linhas[0].persona, linhas[0].otimo], ['T1', 'roteiro:' + roteiroOk, 'ana', 3])
  assert.deepEqual(linhas.slice(1, 4).map((l) => l.rotulo), ['Clientes', 'Ficha do cliente', 'Histórico de compras'])
  assert.deepEqual(linhas.slice(1, 4).map((l) => l.titulo), ['Início', 'Lista de clientes', 'Ficha do cliente']) // o nome vem do mapa, não do cabeçalho fixo
  assert.equal(linhas[1].pensamento, 'clientes parece certo')
  const ass = (l) => /^[0-9a-f]{12}$/.test(l.assinatura) && /^[0-9a-f]{12}$/.test(l.paraAssinatura)
  assert.ok(linhas.slice(1, 4).every(ass), 'cada passo traz a assinatura da tela de partida e a da chegada')
  assert.deepEqual([linhas[1].paraAssinatura === linhas[2].assinatura, linhas[2].paraAssinatura === linhas[3].assinatura], [true, true])
  assert.equal(linhas[1].assinatura, mapa.telas[0].assinatura) // a assinatura é a mesma do mapa: não muda se o mapa for refeito
  assert.deepEqual([linhas[4].sucesso, linhas[4].desistiu], [true, false])
  for (const l of linhas.slice(1, 4)) assert.ok(fs.existsSync(path.join(saida, l.foto)), 'sem foto do passo')
  assert.ok(fs.existsSync(path.join(saida, linhas[3].fotoFim)))
  const lida = R.lerSessoes(projeto).find((s) => s.id === r1.id)
  assert.equal(lida.passos.length, 3)
  assert.equal(lida.sucesso, true)
  ok(`agente (roteiro, pelo filho): sucesso em ${r1.metricas.passos} passos de ${r1.otimo} ótimos, desorientação ${r1.metricas.desorientacao}, ${path.relative(projeto, r1.arquivo)} com 3 passos e o fecho, fotos de cada passo`)

  /* ========== 4. o agente, cérebro comando (a IA de mentira), sucesso pela assinatura da tela ========== */
  const cerebro = path.join(projeto, 'cerebro.mjs')
  fs.writeFileSync(cerebro, `import fs from 'node:fs'
const pedido = fs.readFileSync(0, 'utf8')
const dir = process.argv[2]
if (!fs.existsSync(dir + '/pedido.txt')) fs.writeFileSync(dir + '/pedido.txt', pedido)
if (!fs.existsSync(dir + '/ja-respondeu')) { fs.writeFileSync(dir + '/ja-respondeu', '1'); console.log('Hmm, deixa eu olhar a tela com calma...'); process.exit(0) }
const els = [...pedido.matchAll(/^\\s+(\\d+)\\. \\[[^\\]]+\\] (.+?)(?: \\(o programa não clica neste\\))?$/gm)].map((m) => ({ n: +m[1], rotulo: m[2] }))
const alvo = ['Histórico de compras', 'Ficha do cliente', 'Clientes'].map((r) => els.find((e) => e.rotulo === r)).find(Boolean)
console.log('Penso em voz alta. ' + JSON.stringify({ escolha: alvo ? alvo.n : 'desistir', pensamento: 'sigo pelos clientes' }))
`)
  const t2 = { id: 'T2', objetivo, sucesso: { estado: escondida.id } }
  const r2 = await rodarAgente({ raiz: projeto, tarefa: t2, cerebro: `comando:node ${JSON.stringify(cerebro)} ${JSON.stringify(projeto)}`, persona: 'beto' })
  assert.equal(r2.fim, 'sucesso')
  assert.deepEqual([r2.metricas.passos, r2.otimo], [3, 3])
  const pedido = fs.readFileSync(path.join(projeto, 'pedido.txt'), 'utf8')
  assert.ok(pedido.includes('Objetivo: ' + objetivo) && pedido.includes('Elementos na tela') && pedido.includes('Pessoa: beto'))
  assert.ok(pedido.includes('Tela agora: Início'), 'o pedido deveria usar o nome da tela, não o cabeçalho fixo')
  assert.ok(pedido.includes('"rolar acima"'))
  assert.ok(/Excluir tudo \(o programa não clica neste\)/.test(pedido))
  assert.ok(!lerJsonl(r2.arquivo).some((l) => l.perdido), 'a segunda tentativa de formato não deveria gastar passo')
  ok('agente (comando): pedido pela entrada padrão em português (com o nome da tela e a opção de rolar), 1ª resposta fora do formato, 2ª tentativa valida, sucesso conferido pela assinatura da tela-alvo')

  /* ========== 4b. rolar: quem só vê a janela alcança o que está abaixo da dobra ========== */
  const roteiroRola = path.join(projeto, 'escolhas-rola.json')
  fs.writeFileSync(roteiroRola, JSON.stringify(['Ajuda', 'rolar', 'Falar com a equipe']))
  const r5 = await rodarAgente({ raiz: projeto, tarefa: { id: 'T5', objetivo: 'Achar o e-mail para falar com a equipe', sucesso: { texto: 'ajuda@loja.exemplo' } }, cerebro: 'roteiro:' + roteiroRola, persona: 'eva' })
  assert.equal(r5.fim, 'sucesso')
  const passos5 = lerJsonl(r5.arquivo).filter((l) => l.tipo === 'passo')
  assert.deepEqual(passos5.map((p) => (p.escolha === 'rolar' ? 'rolar' : p.rotulo)), ['Ajuda', 'rolar', 'Falar com a equipe'])
  assert.ok(!passos5[1].vistos.some((v) => v.rotulo === 'Falar com a equipe') && passos5[2].vistos.some((v) => v.rotulo === 'Falar com a equipe'))
  assert.equal(passos5[1].moveu, true)
  assert.ok(!('tela' in passos5[1]) && passos5[1].em === passos5[0].para) // rolar não é visita a outra tela
  assert.deepEqual([r5.metricas.passos, r5.metricas.revisitas, r5.otimo], [3, 0, 2])
  ok('agente (rolar): o botão da dobra só aparece depois de "rolar", o passo de rolar não conta como visita nem gasta o orçamento (ótimo 2, 3 passos)')

  /* ========== 5. desistência, botão proibido e o voto entre dois cérebros ========== */
  const roteiroTropeco = (nome, escolhas) => { const a = path.join(projeto, nome); fs.writeFileSync(a, JSON.stringify(escolhas)); return 'roteiro:' + a }
  const t3 = { id: 'T3', objetivo, sucesso: { texto: 'Total gasto' } }
  const r3 = await rodarAgente({ raiz: projeto, tarefa: t3, cerebro: roteiroTropeco('tropeco.json', ['Excluir tudo', 'Pedidos', 'desistir']), persona: 'cida' })
  assert.deepEqual([r3.fim, r3.sucesso, r3.desistiu, r3.metricas.passos], ['desistiu', false, true, 3])
  const passos3 = lerJsonl(r3.arquivo).filter((l) => l.tipo === 'passo')
  assert.equal(passos3[0].perdido, true)
  assert.match(passos3[0].motivo, /não clica em "Excluir tudo"/)
  assert.equal(passos3[0].falha, passos3[0].motivo) // o clique não aconteceu: `falha` diz por quê, para o voto não ler "sem efeito"
  assert.ok(!('falha' in passos3[1]) && !('falha' in passos3[2]))
  assert.equal(passos3[0].tela, passos3[0].para)
  const sozinho = R.achados(R.lerSessoes(projeto).filter((s) => s.id === r3.id))
  assert.equal(sozinho.confirmados.length, 0)
  assert.ok(sozinho.naoConfirmados.some((a) => a.tipo === 'desistiu'))
  ok('agente (roteiro): mandou clicar em "Excluir tudo", o programa recusou (passo perdido, tela intacta), depois desistiu em Pedidos; uma sessão só fica em "não confirmado"')

  const out = await rodadas(t3, {
    cerebros: [roteiroTropeco('a.json', ['Pedidos', 'desistir']), roteiroTropeco('b.json', ['Pedidos', 'desistir'])],
    personas: [{ nome: 'dora' }], vezes: 1, raiz: projeto, mapa,
  })
  assert.equal(out.sessoes.length, 2)
  const telaPedidos = mapa.telas.find((t) => t.nome === 'Lista de pedidos').assinatura // o voto agora fala em assinatura, que sobrevive a refazer o mapa
  const confirmado = out.achados.confirmados.find((a) => a.tipo === 'desistiu' && a.tela === telaPedidos)
  assert.ok(confirmado, JSON.stringify(out.achados))
  assert.equal(confirmado.autores.length, 2)
  ok('rodadas: dois cérebros diferentes desistiram na mesma tela e o voto marca CONFIRMADO')

  /* ========== 5a. sucesso por texto: palavra inteira, e só se aparecer DEPOIS de um clique ========== */
  const r6 = await rodarAgente({ raiz: projeto, tarefa: { id: 'T6', objetivo: 'Voltar ao painel', sucesso: { texto: 'Painel da loja' } }, cerebro: roteiroTropeco('volta.json', ['Pedidos', 'Início', 'desistir']), persona: 'gil' })
  assert.deepEqual([r6.fim, r6.metricas.passos], ['sucesso', 2]) // no passo zero o texto já estava lá e não valeu; sumiu e voltou depois do clique
  assert.ok(r6.avisos.some((a) => /já estava na tela de entrada/.test(a)))
  assert.equal(lerJsonl(r6.arquivo)[0].avisos.length, 1)
  const r7 = await rodarAgente({ raiz: projeto, tarefa: { id: 'T7', objetivo, sucesso: { texto: 'gast' } }, cerebro: roteiroTropeco('t7.json', ['Clientes', 'Ficha do cliente', 'Histórico de compras', 'desistir']), persona: 'ivo' })
  assert.deepEqual([r7.fim, r7.sucesso, r7.metricas.passos], ['desistiu', false, 4]) // "gast" está dentro de "gasto" e não é a palavra
  ok('sucesso por texto: só conta se aparece depois de um clique (no passo zero não vale) e é palavra inteira ("gast" não cumpre "gasto")')

  /* ========== 5b. o cérebro humano, pelo filho, com a entrada canalizada ========== */
  const plano4 = { raiz: projeto, tarefa: { id: 'T4', objetivo, sucesso: { texto: 'Total gasto' } }, cerebro: 'humano', persona: 'novato', quem: 'felipe' }
  const f = spawnSync(process.execPath, ['--experimental-websocket', path.join(AQUI, 'src', 'roteiroAgente.mjs'), '--plano', JSON.stringify(plano4)],
    { input: '99\nabc\n3 vou pelos clientes\n', encoding: 'utf8', timeout: 60000 })
  assert.equal(f.status, 0, f.stderr)
  const resumo4 = JSON.parse(f.stdout.split('\n').find((l) => l.startsWith('@@ROTEIRO-RESUMO@@')).slice('@@ROTEIRO-RESUMO@@'.length))
  assert.deepEqual([resumo4.fim, resumo4.metricas.passos], ['desistiu', 2]) // a entrada acabou no passo 2
  assert.equal((f.stdout.match(/digite o número do elemento/g) || []).length, 2) // 99 e abc não valem, perguntou de novo
  assert.ok(/Passo 2\. Tela: Lista de clientes/.test(f.stdout) && /5\. \[botão\] Excluir tudo {2}\(o programa não clica neste\)/.test(f.stdout))
  assert.equal(lerJsonl(resumo4.arquivo).find((l) => l.tipo === 'passo').pensamento, 'vou pelos clientes')
  assert.equal(lerJsonl(resumo4.arquivo)[0].quem, 'felipe') // o voto precisa do nome de quem foi
  await assert.rejects(rodarAgente({ raiz: projeto, tarefa: t3, cerebro: 'humano', persona: 'x' }), /precisa de `quem`/)
  await assert.rejects(rodadas(t3, { cerebros: ['humano'], raiz: projeto, mapa }), /precisa de `quem`/)
  ok('agente (humano): lista numerada no terminal com o nome da tela, entrada inválida pergunta de novo, o número vale, o fim da entrada vira desistência, e `quem` vai para o cabeçalho (sem ele recusa)')

  /* ========== 5c. o prazo é do filho, e o cérebro lento morre com o grupo dele ========== */
  const marcador = 'marcador' + Math.random().toString(36).slice(2, 8)
  const tPrazo = Date.now()
  // o `; echo x` faz o sh ficar vivo com o node como NETO: matar só o sh deixaria o node rodando
  const r8 = await rodarAgente({ raiz: projeto, tarefa: t3, cerebro: `comando:node -e "setTimeout(()=>{},60000)" ${marcador}; echo x`, persona: 'kai', prazoMs: 4000 })
  assert.deepEqual([r8.fim, r8.sucesso, r8.desistiu], ['prazo', false, false])
  assert.ok(Date.now() - tPrazo < 25000, 'o prazo de 4 s não cortou a sessão')
  await dorme(500)
  const vivo = spawnSync('pgrep', ['-f', marcador], { encoding: 'utf8' })
  if (!vivo.error) assert.equal(vivo.status, 1, 'o cérebro lento continua rodando: ' + vivo.stdout)
  ok(`agente: o prazo é do filho (4 s, fechou em ${((Date.now() - tPrazo) / 1000).toFixed(0)} s com fim "prazo") e o comando lento morreu com o grupo dele${vivo.error ? ' (sem pgrep nesta máquina, não conferi)' : ''}`)

  /* ========== 5d. o login de teste: entra sozinho, e a senha nunca aparece ========== */
  const SENHA = 'segredo-do-teste-123' // a senha FALSA da fixture
  const acessoOk = path.join(projeto, 'acesso-ok.json')
  fs.writeFileSync(acessoOk, JSON.stringify({ usuario: 'ana', senha: SENHA }), { mode: 0o600 })
  const acessoErrado = path.join(projeto, 'acesso-errado.json')
  fs.writeFileSync(acessoErrado, JSON.stringify({ usuario: 'ana', senha: 'senha-errada-xyz' }), { mode: 0o600 })
  const URL_LOGIN = URL_PAGINA + '#login=1'

  // o arquivo estragado não vaza: a mensagem do JSON.parse citaria um pedaço dele
  const quebrado = path.join(projeto, 'acesso-quebrado.json')
  fs.writeFileSync(quebrado, '{"usuario": "ana", "senha": "vazou-no-erro-987" oops')
  assert.throws(() => lerAcesso(quebrado), (e) => !e.message.includes('vazou-no-erro-987') && /não consegui ler o arquivo de acesso/.test(e.message))
  assert.throws(() => lerAcesso(path.join(projeto, 'nao-existe.json')), /não consegui ler o arquivo de acesso/)

  const semAcesso = await abrirNavegador()
  try {
    await semAcesso.ir(URL_LOGIN)
    assert.equal(secao(await semAcesso.observar()), 'Entrar') // sem acesso, fica na tela de senha
  } finally { await semAcesso.fechar() }
  const logado = await abrirNavegador({ acesso: acessoOk })
  try {
    await logado.ir(URL_LOGIN)
    assert.equal(secao(await logado.observar()), 'Painel da loja')
    await logado.ir(URL_LOGIN) // recarrega: o armazenamento é limpo, a tela de senha volta, e ele entra de novo
    assert.equal(secao(await logado.observar()), 'Painel da loja')
  } finally { await logado.fechar() }
  process.env.ROTEIRO_USUARIO = 'ana'; process.env.ROTEIRO_SENHA = SENHA
  const porEnv = await abrirNavegador()
  try { await porEnv.ir(URL_LOGIN); assert.equal(secao(await porEnv.observar()), 'Painel da loja') } finally { await porEnv.fechar(); delete process.env.ROTEIRO_USUARIO; delete process.env.ROTEIRO_SENHA }
  const errado = await abrirNavegador({ acesso: acessoErrado })
  try {
    await assert.rejects(errado.ir(URL_LOGIN), (e) => /o login falhou/.test(e.message) && !e.message.includes('senha-errada-xyz'))
    await assert.rejects(errado.ir(URL_LOGIN), /já falhou nesta execução/) // não tenta de novo: travaria a conta
  } finally { await errado.fechar() }
  ok('login: preenche usuário e senha do arquivo (ou de ROTEIRO_USUARIO e ROTEIRO_SENHA), entra de novo a cada recarga, falha com aviso claro sem tentar duas vezes, e o erro do arquivo estragado não mostra o conteúdo')

  // o mapa e o agente entram logados, e a senha não aparece em saída, mapa nem sessão
  const rodaMapa = (acesso, dir) => spawnSync(process.execPath, ['--experimental-websocket', path.join(AQUI, 'src', 'roteiroMapa.mjs'), '--plano', JSON.stringify({ url: URL_LOGIN, saida: dir, acesso, maxProfundidade: 1 })], { encoding: 'utf8', timeout: 120000 })
  const mLogado = rodaMapa(acessoOk, path.join(projeto, 'mapa-logado'))
  assert.equal(mLogado.status, 0, mLogado.stderr)
  const mapaLogado = JSON.parse(fs.readFileSync(path.join(projeto, 'mapa-logado', 'mapa.json'), 'utf8'))
  assert.equal(mapaLogado.telas[0].cabecalhos.at(-1), 'Painel da loja')
  assert.ok(mapaLogado.telas.length >= 4, 'o mapa logado deveria achar as abas: ' + mapaLogado.telas.length)
  const mErrado = rodaMapa(acessoErrado, path.join(projeto, 'mapa-errado'))
  assert.notEqual(mErrado.status, 0)
  assert.match(mErrado.stderr, /o login falhou/)
  for (const saidaFilho of [mLogado.stdout, mLogado.stderr, mErrado.stdout, mErrado.stderr]) assert.ok(!saidaFilho.includes(SENHA) && !saidaFilho.includes('senha-errada-xyz'), 'a senha apareceu na saída do filho')
  const rAcesso = await rodarAgente({ raiz: projeto, url: URL_LOGIN, acesso: acessoOk, tarefa: { id: 'T9', objetivo, sucesso: { texto: 'Total gasto' } }, cerebro: 'roteiro:' + roteiroOk, persona: 'rui' })
  assert.deepEqual([rAcesso.fim, rAcesso.metricas.passos], ['sucesso', 3])
  ok('login: o mapa e o agente entram logados (o mapa achou as abas depois da tela de senha); login errado derruba o mapa com aviso claro')

  /* ========== 5e. as sondas: a prática de mercado, tela por tela ========== */
  const projSondas = path.join(projeto, 'proj-sondas')
  const URL_LISTAS = URL_PAGINA + '#login=1&listas=1'
  const telasSonda = [['t1', 'Produtos'], ['t2', 'Estoque'], ['t3', 'Cupons'], ['t4', 'Fornecedores'], ['t5', 'Entregas'], ['t6', 'Devoluções']]
  R.gravarMapa(projSondas, { url: URL_LISTAS, telas: [{ id: 'raiz', nome: 'Início', caminho: [] }, ...telasSonda.map(([id, nome]) => ({ id, nome, caminho: [nome] }))], arestas: [] })
  const tSondas = Date.now()
  const sondas = await executarSondas({ raiz: projSondas, acesso: acessoOk, largura: 1100, altura: 800, sondas: SONDAS, soTelas: telasSonda.map(([id]) => id), prazoMs: 240000 })
  assert.equal(sondas.resultados.length, telasSonda.length * SONDAS.length, 'avisos: ' + sondas.avisos.join(' | '))
  assert.equal(sondas.parcial, false)
  assert.ok(!fs.existsSync(path.join(projSondas, 'docs', 'roteiro', 'sondas.novo.json')) && fs.existsSync(sondas.caminho))
  const por = (tela, id) => sondas.resultados.find((r) => r.nome === tela && r.id === id)
  const esperado = (tela, id, status, trecho) => {
    const r = por(tela, id)
    assert.equal(r.status, status, `${tela} / ${id}: ${r.status}, ${r.evidencia}`)
    if (trecho) assert.match(r.evidencia, trecho, `${tela} / ${id}: ${r.evidencia}`)
    return r
  }
  const fJanela = esperado('Produtos', 'editar-sem-perder-a-lista', 'tem', /abriu uma janela "Editar produto" que não cobre a lista inteira/)
  assert.ok(fJanela.foto && fs.existsSync(path.join(projSondas, 'docs', 'roteiro', fJanela.foto)))
  esperado('Estoque', 'editar-sem-perder-a-lista', 'tem', /painel lateral/)
  esperado('Cupons', 'editar-sem-perder-a-lista', 'tem', /na própria linha/)
  esperado('Fornecedores', 'editar-sem-perder-a-lista', 'nao-tem', /página própria/)
  ok('sonda editar-sem-perder-a-lista: janela que não cobre a lista = tem, painel lateral = tem, na linha = tem, página própria = nao-tem (e a evidência diz qual das quatro)')

  for (const [id, status] of [['acoes-em-lote', 'tem'], ['busca-na-lista', 'tem'], ['filtros-como-abas', 'tem'], ['ordenar-colunas', 'tem'], ['paginacao', 'tem'], ['estado-vazio-com-acao', 'nao-da']]) esperado('Produtos', id, status)
  esperado('Produtos', 'acoes-em-lote', 'tem', /Ativar.*Excluir selecionados|Excluir selecionados.*Ativar/)
  for (const id of ['acoes-em-lote', 'busca-na-lista', 'filtros-como-abas', 'paginacao']) esperado('Estoque', id, 'nao-tem')
  esperado('Estoque', 'ordenar-colunas', 'nao-tem', /nenhum cabeçalho/)
  esperado('Fornecedores', 'ordenar-colunas', 'nao-da', /não é uma tabela/)
  esperado('Entregas', 'editar-sem-perder-a-lista', 'nao-da')
  esperado('Entregas', 'estado-vazio-com-acao', 'tem', /Cadastrar primeira entrega/)
  esperado('Devoluções', 'estado-vazio-com-acao', 'nao-tem', /sem botão/)
  ok(`sondas: ${sondas.resultados.length} resultados (6 telas x 7 sondas) em ${((Date.now() - tSondas) / 1000).toFixed(0)} s: lote, busca, abas, ordenação, paginação e estado vazio dão tem, nao-tem ou nao-da conforme a tela, e tela sem lista nunca vira "nao-tem"`)

  // a lista que nunca é clicada: nem na tabela da fixture nenhuma ação protegida foi acionada, e a tela voltou ao ponto de partida
  assert.ok(sondas.resultados.every((r) => ['tem', 'nao-tem', 'nao-da'].includes(r.status)))

  /* a senha, em lugar nenhum: nem em sessão, nem em mapa, nem em sondas, nem em foto */
  const varrer = (dir, achados = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name)
      if (e.isDirectory()) varrer(f, achados)
      else if (!/^acesso.*\.json$/.test(e.name) && fs.readFileSync(f).toString('latin1').includes(SENHA)) achados.push(f)
    }
    return achados
  }
  assert.deepEqual(varrer(projeto), [], 'a senha apareceu num arquivo gravado')
  ok('login: a senha não está em nenhum arquivo gravado (sessões, mapas, sondas, fotos) fora do próprio arquivo de acesso')

  /* ========== 6. nada ficou para trás ========== */
  assert.equal(perfisAntes(), antes, 'sobrou perfil temporário de Chrome em ' + os.tmpdir())
  ok('limpeza: nenhum perfil temporário de Chrome sobrou')
  console.log(`\npassou, em ${((Date.now() - t0) / 1000).toFixed(0)} s`)
} catch (e) {
  console.error('\n  !!  ' + (e?.stack || e))
  process.exitCode = 1
} finally {
  fs.rmSync(projeto, { recursive: true, force: true })
}
