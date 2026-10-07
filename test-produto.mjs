/**
 * CC-902: criação de produto (src/produto.mjs, o método em framework.mjs, as perguntas em arquiteto.mjs).
 * Sem IA de verdade: o Haiku é um script de mentira (CC_ARQUITETO_CLAUDE / opção binario), e tudo roda em pasta temporária.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'produto-'))
process.env.CC_HOME = path.join(tmp, 'casa') // nada deste teste toca o ~/.claude de verdade
const P = await import('./src/produto.mjs')
const F = await import('./src/framework.mjs')
const D = await import('./src/frameworkDisco.mjs')
const Ar = await import('./src/arquiteto.mjs')
const Bk = await import('./src/backlog.mjs')

let ok = 0
const t = async (nome, fn) => { await fn(); ok++; console.log('  ok   ' + nome) }

/* ---- A1: o dado e as regras puras ---- */
await t('definicaoDaEntrevista lê a entrevista e ignora palpite (de: prosa)', () => {
  const est = { entrevista: { respostas: {
    natureza: { valor: 'cliente', texto: 'Site ou app para cliente', de: 'ele' },
    entrega: { texto: 'um app de contas', de: 'ele' },
    quem: { texto: 'a família', de: 'prosa' },
    hoje: { texto: 'planilha solta', de: 'ele' },
  } } }
  assert.deepEqual(P.definicaoDaEntrevista(est), { oque: 'um app de contas', paraQuem: '', problema: 'planilha solta', natureza: 'cliente' })
})

await t('proximoPasso segue a ordem dos seis passos', () => {
  const p = P.produtoVazio()
  assert.equal(P.proximoPasso(p).passo, 'sucesso')
  p.definicao.sucesso = 'usam toda semana'
  assert.equal(P.proximoPasso(p).passo, 'definicao')
  p.definicao.confirmada = 'x'
  assert.equal(P.proximoPasso(p).passo, 'partes', 'sem partes nem sugeridas, pergunta partes')
  p.sugeridas = [{ codigo: 'a', nome: 'A' }]
  assert.equal(P.proximoPasso(p).passo, 'partes')
  p.sugeridas = []; p.partes = [{ codigo: 'a', nome: 'A', caracteristicasFeitas: false }]
  assert.equal(P.proximoPasso(p).passo, 'faltou')
  p.faltouPerguntado = true
  assert.deepEqual(P.proximoPasso(p), { passo: 'caracteristicas', parte: 'a' })
  p.partes[0].caracteristicasFeitas = true
  assert.equal(P.proximoPasso(p).passo, 'mapa')
  p.mapaAprovado = 'x'
  assert.equal(P.proximoPasso(p), null)
})

const quatro = () => ({ ...P.produtoVazio(), definicao: { ...P.produtoVazio().definicao, natureza: 'cliente' }, sugeridas: [
  { codigo: 'entrar', nome: 'Entrar', tipo: 'tela', atividade: 'a pessoa entra no app' },
  { codigo: 'lancar', nome: 'Lançar gasto', tipo: 'fluxo', atividade: 'a pessoa registra um gasto' },
  { codigo: 'resumo', nome: 'Resumo do mês', tipo: 'tela', atividade: 'a pessoa vê o total' },
  { codigo: 'avisos', nome: 'Avisos', tipo: 'fluxo', atividade: 'a pessoa recebe lembretes' },
] })

await t('aplicarResposta em partes: 2 de 4 marcadas entram com ordem, as outras vão para recusadas', () => {
  const nomes = ['Entrar', 'Lançar gasto', 'Resumo do mês', 'Avisos']
  const p = P.aplicarResposta(quatro(), 'partes', { escolhas: ['Entrar', 'Resumo do mês'], opcoes: nomes })
  assert.deepEqual(p.partes.map((x) => [x.codigo, x.ordem]), [['entrar', 1], ['resumo', 2]])
  assert.deepEqual(p.recusadas.map((x) => x.codigo), ['lancar', 'avisos'])
  assert.equal(p.sugeridas.length, 0)
})

await t('o extra vira parte nova, com código sem acento e tipo pelo tipo do projeto', () => {
  const p = P.aplicarResposta(quatro(), 'partes', { escolhas: ['Entrar'], extra: 'Álbum de fotos', opcoes: ['Entrar', 'Lançar gasto', 'Resumo do mês', 'Avisos'] })
  const nova = p.partes.at(-1)
  assert.equal(nova.codigo, 'albumdefotos'); assert.equal(nova.tipo, 'tela'); assert.equal(nova.ordem, 2)
  const f = P.aplicarResposta({ ...P.produtoVazio(), partes: [{ codigo: 'a', nome: 'A', caracteristicas: [] }] }, 'faltou', { extra: 'Ajuda' })
  assert.equal(f.partes.length, 2); assert.equal(f.faltouPerguntado, false, 'pergunta de novo até ele dizer que está completo')
  assert.equal(P.aplicarResposta(f, 'faltou', { escolhas: ['Não, está completo'] }).faltouPerguntado, true)
})

await t('"Nenhuma destas" (deslizar para a esquerda) não vira parte, característica nem sucesso', () => {
  const ops = ['Entrar', 'Lançar gasto', 'Resumo do mês', 'Avisos']
  const p = P.aplicarResposta(quatro(), 'partes', { escolhas: [], extra: 'Nenhuma destas', opcoes: ops })
  assert.equal(p.partes.length, 0, 'nenhuma parte nova'); assert.equal(p.recusadas.length, 4, 'as quatro oferecidas foram recusadas')
  const c = P.aplicarResposta({ ...P.produtoVazio(), partes: [{ codigo: 'a', nome: 'A', caracteristicas: ['x'], caracteristicasFeitas: false }] }, 'caracteristicas', { parte: 'a', extra: 'Nenhuma destas.' })
  assert.deepEqual(c.partes[0].caracteristicas, ['x']); assert.equal(c.partes[0].caracteristicasFeitas, true)
  assert.equal(P.aplicarResposta(P.produtoVazio(), 'sucesso', { extra: 'nenhuma destas' }).definicao.sucesso, '')
  assert.equal(P.ehNenhuma('  Nenhuma destas '), true); assert.equal(P.ehNenhuma('Nenhuma destas partes serve'), false, 'frase maior é texto dele')
})

await t('características: as marcadas mais o extra entram na parte e fecham o passo', () => {
  const p = P.aplicarResposta({ ...P.produtoVazio(), partes: [{ codigo: 'a', nome: 'A', caracteristicas: [], caracteristicasFeitas: false }] }, 'caracteristicas', { escolhas: ['carrega rápido'], extra: 'funciona sem rede', parte: 'a' })
  assert.deepEqual(p.partes[0].caracteristicas, ['carrega rápido', 'funciona sem rede']); assert.equal(p.partes[0].caracteristicasFeitas, true)
})

const partesOk = (n = 3) => JSON.stringify({ partes: Array.from({ length: n }, (_, i) => ({ codigo: `parte${i}`, nome: `Parte ${i}`, tipo: 'tela', atividade: 'a pessoa faz algo aqui' })) })
await t('validarPartes recusa código com acento, 9 partes, travessão e campo a mais; aceita bloco json', () => {
  assert.ok(P.validarPartes(partesOk(3)).ok); assert.ok(P.validarPartes('```json\n' + partesOk(4) + '\n```').ok)
  const com = (campo, valor) => JSON.stringify({ partes: JSON.parse(partesOk(3)).partes.map((x, i) => i === 0 ? { ...x, [campo]: valor } : x) })
  assert.match(P.validarPartes(com('codigo', 'ação')).erros.join(), /codigo/)
  assert.match(P.validarPartes(partesOk(9)).erros.join(), /de 3 a 8/)
  assert.match(P.validarPartes(com('atividade', 'faz algo — e mais')).erros.join(), /travessão/)
  assert.match(P.validarPartes(com('extra', 'x')).erros.join(), /campo desconhecido/)
  assert.match(P.validarPartes(com('tipo', 'botao')).erros.join(), /tipo/)
  assert.ok(!P.validarPartes(JSON.stringify({ partes: [...JSON.parse(partesOk(3)).partes.slice(0, 2), JSON.parse(partesOk(3)).partes[0]] })).ok, 'código repetido')
})

await t('validarCaracteristicas: 3 a 4 itens de 5 a 80 letras, sem travessão', () => {
  assert.ok(P.validarCaracteristicas('{"caracteristicas":["carrega rápido","funciona sem rede","só entra quem tem login"]}').ok)
  assert.ok(!P.validarCaracteristicas('{"caracteristicas":["carrega rápido","funciona sem rede"]}').ok)
  assert.match(P.validarCaracteristicas('{"caracteristicas":["rápido — muito","funciona sem rede","só quem tem login"]}').erros.join(), /travessão/)
})

await t('frentesDoMapa só traz códigos novos e, sem catálogo, não cria nada', () => {
  const pr = { partes: [{ codigo: 'entrar', nome: 'Entrar', atividade: 'a pessoa entra' }, { codigo: 'resumo', nome: 'Resumo', atividade: 'a pessoa vê o total' }] }
  assert.deepEqual(Object.keys(P.frentesDoMapa(pr, { entrar: 'já existe' })), ['resumo'])
  assert.deepEqual(P.frentesDoMapa(pr, null), {})
})

await t('separarEscolha separa os rótulos oferecidos do que ele escreveu, e a string sem rótulo vira extra', () => {
  const ops = ['Entrar', 'Lançar gasto, rápido', 'Resumo']
  assert.deepEqual(P.separarEscolha('Entrar, Lançar gasto, rápido. Quero também ajuda', ops), { escolhas: ['Entrar', 'Lançar gasto, rápido'], extra: 'Quero também ajuda' })
  assert.deepEqual(P.separarEscolha('só texto meu', ops), { escolhas: [], extra: 'só texto meu' })
})

await t('o método produto: primeira fase é definicao, sem mudar teste do seletor, e os portões respondem', () => {
  assert.equal(F.METODOS.produto.fases[0].id, 'definicao')
  assert.deepEqual(F.METODOS.produto.fases.map((f) => f.id), ['definicao', 'produto', 'mapa', 'planejamento', 'execucao'])
  assert.ok(F.PREDICADOS['produto-definido']({}) && !F.PREDICADOS['produto-definido']({ produto: { definicao: 'x' } }))
  assert.ok(F.PREDICADOS['mapa-aprovado']({}) && !F.PREDICADOS['mapa-aprovado']({ produto: { mapa: 'x' } }))
})

/* ---- A2: o arquiteto, com o Haiku de mentira ---- */
const falso = path.join(tmp, 'haiku.mjs')
fs.writeFileSync(falso, `#!/usr/bin/env node
let s = ''; process.stdin.on('data', (d) => { s += d }); process.stdin.on('end', () => {
  if (s.includes('{"partes":[')) console.log(${JSON.stringify(JSON.stringify({ partes: [
    { codigo: 'entrar', nome: 'Entrar', tipo: 'tela', atividade: 'a pessoa entra no app' },
    { codigo: 'lancar', nome: 'Lançar gasto', tipo: 'fluxo', atividade: 'a pessoa registra um gasto' },
    { codigo: 'resumo', nome: 'Resumo do mês', tipo: 'tela', atividade: 'a pessoa vê o total' },
    { codigo: 'avisos', nome: 'Avisos', tipo: 'fluxo', atividade: 'a pessoa recebe lembretes' },
    { codigo: 'ajuda', nome: 'Ajuda', tipo: 'tela', atividade: 'a pessoa tira dúvidas' }] }))})
  else if (s.includes('{"caracteristicas":[')) console.log(${JSON.stringify(JSON.stringify({ caracteristicas: ['carrega rápido', 'funciona sem rede', 'só entra quem tem login'] }))})
  else console.log(${JSON.stringify(JSON.stringify({ multipla: false, opcoes: [{ rotulo: 'A família usa toda semana', descricao: 'uso real' }, { rotulo: 'Sobra dinheiro no fim do mês' }] }))})
})
`)
fs.chmodSync(falso, 0o755)

const novoProjeto = (nome, extra = {}) => {
  const d = path.join(tmp, nome, 'VPS_conta-teste') // o prefixo das fichas sai do nome da pasta
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  D.gravar(d, { metodo: 'produto', modo: 'sugestivo', fase: 'definicao', ligado: true,
    mvp: { nome: 'um app de contas', criterios: [{ texto: 'registra gasto', feito: false }] },
    plano: { itens: 3, primeira: '' },
    entrevista: { terminou: '2026-10-04T10:00:00Z', respostas: {
      natureza: { valor: 'cliente', texto: 'Site ou app para cliente', de: 'ele' },
      entrega: { texto: 'um app de contas', de: 'ele' }, quem: { texto: 'a família', de: 'ele' }, hoje: { texto: 'planilha solta', de: 'ele' } } },
    ...extra })
  return d
}
const estado = (d) => D.ler(d, { sessao: null })

await t('passo() no método produto, com a entrevista terminada, gera ficha DE tipo produto e a fase avança para a definição', async () => {
  const d = novoProjeto('a')
  assert.equal(Ar.avancarProduto(d), 'produto', 'entrevista pronta e MVP com nome e critério abrem o portão')
  assert.equal(estado(d).fase, 'produto')
  const r = await Ar.passo(d, { binario: falso })
  assert.equal(r.proposta.tipo, 'produto'); assert.equal(r.pergunta.estado, 'DE'); assert.equal(r.proposta.produto.passo, 'sucesso')
  assert.ok(r.proposta.opcoes.includes('A família usa toda semana'))
  const pr = P.ler(d)
  assert.equal(pr.definicao.oque, 'um app de contas'); assert.equal(pr.definicao.paraQuem, 'a família'); assert.equal(pr.definicao.natureza, 'cliente')
  assert.equal((await Ar.passo(d, { binario: falso })).esperando.id, r.pergunta.id, 'uma pergunta aberta por projeto')
})

await t('o caminho inteiro: responder grava produto.json, a fase anda e o mapa aprovado abre o planejamento', async () => {
  const d = novoProjeto('b', { produto: {} })
  Ar.avancarProduto(d)
  const sempre = async () => { const r = await Ar.passo(d, { binario: falso }); assert.equal(r.proposta.tipo, 'produto'); return r }
  let r = await sempre()
  Ar.responder(d, r.pergunta.id, 'A família usa toda semana')
  assert.equal(P.ler(d).definicao.sucesso, 'A família usa toda semana')
  r = await sempre(); assert.equal(r.proposta.produto.passo, 'definicao'); assert.match(r.proposta.porque, /Problema: planilha solta/)
  Ar.responder(d, r.pergunta.id, 'Está certa')
  assert.ok(estado(d).produto.definicao); assert.equal(estado(d).fase, 'mapa')
  r = await sempre(); assert.equal(r.proposta.produto.passo, 'partes'); assert.equal(r.proposta.multipla, true); assert.equal(r.proposta.opcoes.length, 4)
  assert.equal(P.ler(d).sugeridas.length, 5, 'as sugestões foram gravadas antes de perguntar')
  // o array de escolhas, como a peça D1 vai mandar
  Ar.responder(d, r.pergunta.id, ['Entrar', 'Resumo do mês'])
  let pr = P.ler(d)
  assert.deepEqual(pr.partes.map((x) => x.codigo), ['entrar', 'resumo']); assert.deepEqual(pr.sugeridas.map((x) => x.codigo), ['ajuda'], 'a 5ª sugestão espera a vez')
  r = await sempre(); assert.equal(r.proposta.produto.passo, 'partes'); assert.deepEqual(r.proposta.opcoes, ['Ajuda'])
  // a string que /api/arquiteto/responder monta hoje: rótulos juntos por ", " e o extra depois de ". "
  Ar.responder(d, r.pergunta.id, 'Ajuda. Painel do dono')
  pr = P.ler(d); assert.deepEqual(pr.partes.map((x) => x.codigo), ['entrar', 'resumo', 'ajuda', 'paineldodono'])
  r = await sempre(); assert.equal(r.proposta.produto.passo, 'faltou')
  Ar.responder(d, r.pergunta.id, 'Não, está completo')
  for (let i = 0; i < 4; i++) {
    r = await sempre(); assert.equal(r.proposta.produto.passo, 'caracteristicas'); assert.match(r.proposta.pergunta, /O que precisa ser verdade em/)
    Ar.responder(d, r.pergunta.id, 'carrega rápido, funciona sem rede')
  }
  assert.ok(P.ler(d).partes.every((x) => x.caracteristicasFeitas && x.caracteristicas.length === 2))
  r = await sempre(); assert.equal(r.proposta.produto.passo, 'mapa'); assert.match(r.proposta.porque, /1\. Entrar \(tela\): carrega rápido; funciona sem rede/)
  Ar.responder(d, r.pergunta.id, 'Aprovo o mapa')
  assert.ok(P.ler(d).mapaAprovado); assert.ok(estado(d).produto.mapa)
  assert.equal(estado(d).fase, 'planejamento', 'mapa aprovado e backlog escrito: só a primeira fatia falta')
  assert.equal(fs.existsSync(path.join(d, 'docs', 'frentes.json')), false, 'sem catálogo, ele não é criado')
  const depois = await Ar.perguntaDoProduto(d, { binario: falso }); assert.equal(depois, null)
})

await t('"Quero mudar uma parte" volta a perguntar se falta alguma; o catálogo de frentes existente recebe só as novas', async () => {
  const d = novoProjeto('c'); Ar.avancarProduto(d)
  const base = { ...P.produtoVazio(), definicao: { oque: 'x', paraQuem: 'y', problema: 'z', sucesso: 'w', natureza: 'cliente', confirmada: 'x' }, faltouPerguntado: true,
    partes: [{ codigo: 'entrar', nome: 'Entrar', tipo: 'tela', atividade: 'a pessoa entra', ordem: 1, caracteristicas: ['rápido'], caracteristicasFeitas: true, rota: null },
      { codigo: 'resumo', nome: 'Resumo', tipo: 'tela', atividade: 'a pessoa vê o total', ordem: 2, caracteristicas: ['claro'], caracteristicasFeitas: true, rota: null }] }
  P.gravar(d, base)
  let r = await Ar.passo(d, { binario: falso }); assert.equal(r.proposta.produto.passo, 'mapa')
  Ar.responder(d, r.pergunta.id, 'Quero mudar uma parte. Falta a parte de pagamento')
  assert.equal(P.ler(d).faltouPerguntado, false); assert.equal(P.ler(d).mapaAprovado, null)
  r = await Ar.passo(d, { binario: falso }); assert.equal(r.proposta.produto.passo, 'faltou')
  Ar.responder(d, r.pergunta.id, 'Não, está completo'); r = await Ar.passo(d, { binario: falso })
  // o catálogo entra depois de a pergunta existir: registrarPergunta não manda frente, e projeto com catálogo a recusa (limite que já existia)
  fs.writeFileSync(path.join(d, 'docs', 'frentes.json'), JSON.stringify({ entrar: 'já era minha', geral: 'o resto' }))
  Ar.responder(d, r.pergunta.id, 'Aprovo o mapa')
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(d, 'docs', 'frentes.json'), 'utf8')), { entrar: 'já era minha', geral: 'o resto', resumo: 'Resumo: a pessoa vê o total' })
})

await t('"Refazer a entrevista" apaga as respostas e volta para a fase da entrevista', async () => {
  const d = novoProjeto('d')
  Ar.avancarProduto(d)
  P.gravar(d, { ...P.produtoVazio(), definicao: { oque: 'um app de contas', paraQuem: 'a família', problema: 'planilha', sucesso: 'usam', natureza: 'cliente', confirmada: null } })
  const r = await Ar.passo(d, { binario: falso }); assert.equal(r.proposta.produto.passo, 'definicao')
  Ar.responder(d, r.pergunta.id, 'Refazer a entrevista')
  const est = estado(d)
  assert.equal(est.fase, 'definicao'); assert.equal(est.entrevista.terminou, null); assert.deepEqual(Object.keys(est.entrevista.respostas), [])
  const volta = await Ar.passo(d, { binario: '/bin/false' })
  assert.equal(volta.proposta.tipo, 'entrevista', 'a entrevista pergunta de novo, sem Haiku')
})

await t('Haiku que erra o contrato duas vezes joga erro (o passoOuSocorro pega), e outro método não é afetado', async () => {
  const d = novoProjeto('e', { produto: {} })
  Ar.avancarProduto(d)
  P.gravar(d, { ...P.produtoVazio(), definicao: { oque: 'x', paraQuem: 'y', problema: 'z', sucesso: 'w', natureza: 'cliente', confirmada: 'x' } })
  await assert.rejects(() => Ar.passo(d, { binario: '/bin/true' }), /recusadas pelo contrato duas vezes/)
  const s = await Ar.passoOuSocorro(d, { binario: '/bin/true' }); assert.equal(s.socorro, true)
  const outro = novoProjeto('f'); D.gravar(outro, { ...estado(outro), metodo: 'mvp-basico' })
  assert.equal(await Ar.perguntaDoProduto(outro, { binario: falso }), null); assert.equal(Ar.avancarProduto(outro), null)
})

await t('a mensagem da pergunta de produto usa o nome Criação de produto', async () => {
  const d = novoProjeto('g'); Ar.avancarProduto(d)
  const r = await Ar.passo(d, { binario: falso })
  assert.match(Ar.mensagemDaPergunta(r.pergunta).texto, /Criação de produto \(/)
})

await t('projeto COM catálogo de frentes: a pergunta do arquiteto não quebra e cai numa frente do catálogo', async () => {
  const d = novoProjeto('h'); Ar.avancarProduto(d)
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(d, 'docs', 'frentes.json'), JSON.stringify({ site: 'o site', loja: 'a loja' }))
  const r = await Ar.passo(d, { binario: falso })
  assert.ok(r.pergunta, 'a pergunta foi registrada')
  const ficha = Bk.ler(Bk.caminhoPadrao(d)).itens.find((i) => i.id === r.pergunta.id || i.id === r.pergunta)
  assert.ok(ficha && ['site', 'loja'].includes(ficha.frente), 'frente do catálogo: ' + (ficha && ficha.frente))
})

assert.ok(Bk, 'backlog carregado')
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas (produto)\n`)
