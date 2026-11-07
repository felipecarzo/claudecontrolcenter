/**
 * CC-1068, peça M2: o arquiteto no modo Regente. Pasta temporária e CC_HOME isolado; o "claude" é um script falso que
 * devolve a proposta ou a decisão conforme o pedido, então nada abre o modelo de verdade.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arq-regente-'))
process.env.CC_HOME = path.join(tmp, 'claude')
const cwd = path.join(tmp, 'VPS_ensaio')
fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true })
const falso = path.join(tmp, 'claude-falso.sh')
// recebe o pedido por stdin: se for do Regente devolve a decisão, senão a proposta que está em $PROPOSTA
fs.writeFileSync(falso, '#!/bin/bash\nt=$(cat)\nif echo "$t" | grep -q "Você é o Regente"; then echo \'{"escolha":"Fazer o cadastro de gasto","porque":"é o que o MVP pede agora"}\'; else cat "$PROPOSTA"; fi\n', { mode: 0o755 })
process.env.CC_ARQUITETO_CLAUDE = falso

const A = await import('./src/arquiteto.mjs')
const R = await import('./src/regente.mjs')
const B = await import('./src/backlog.mjs')

let falhou = false, n = 0
const teste = async (m, fn) => { try { await fn(); n++; console.log(`  ok   ${m}`) } catch (e) { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.stack || e}`) } }
const arq = () => B.caminhoPadrao(cwd)
const proposta = (o) => { const f = path.join(tmp, 'proposta.json'); fs.writeFileSync(f, JSON.stringify(o)); process.env.PROPOSTA = f }

await teste('mensagemDoRegente tem escolha, título, porque e como corrigir', () => {
  const m = A.mensagemDoRegente({ titulo: 'Tela de gasto' }, { escolha: 'Construir agora', porque: 'o MVP pede isso.' })
  assert.strictEqual(m, 'Regente: decidi Construir agora em "Tela de gasto". Por quê: o MVP pede isso. Corrija escrevendo aqui (regra: ... para virar regra deste projeto; geral: ... para valer em todos).')
  assert.ok(!/[—–]/.test(m))
})
await teste('opcaoNegativa acha o "não" e nunca a opção que executa', () => {
  assert.strictEqual(A.opcaoNegativa({ opcoes: ['Sim, construa', 'Não, depois'], executa: 'Sim, construa' }), 'Não, depois')
  assert.strictEqual(A.opcaoNegativa({ opcoes: ['Construa', 'Mude a cor'], executa: 'Construa' }), 'Mude a cor')
})
await teste('itemQueExigeDele: pedido de item sensível sim, item comum e outros tipos não', () => {
  const itens = [{ id: 'X-1', intencao: 'Cadastrar a conta no domínio novo', pronto: 'a conta existe' }, { id: 'X-2', intencao: 'Tela de gasto', pronto: 'a tela salva o gasto' }]
  assert.strictEqual(A.itemQueExigeDele({ tipo: 'pedido', daFila: 'X-1' }, itens)?.id, 'X-1')
  assert.strictEqual(A.itemQueExigeDele({ tipo: 'pedido', daFila: 'X-2' }, itens), null)
  assert.strictEqual(A.itemQueExigeDele({ tipo: 'ideia', daFila: 'X-1' }, itens), null)
})
await teste('pedidoDeProposta: regras entram antes do estado, só quando existem', () => {
  const sem = A.pedidoDeProposta({ projeto: 'p' })
  assert.ok(!sem.includes('REGRAS DO DONO'))
  const com = A.pedidoDeProposta({ projeto: 'p', regras: '## Regras deste projeto\n- 20/10: sem login por enquanto' })
  assert.ok(com.indexOf('REGRAS DO DONO') > 0 && com.indexOf('REGRAS DO DONO') < com.indexOf('ESTADO DO PROJETO'))
  assert.ok(com.includes('sem login por enquanto'))
  assert.ok(!/"regras"/.test(com), 'as regras não se repetem dentro do JSON do estado')
})
await teste('lerEstado traz regente e as regras do caderno', () => {
  R.aprender(cwd, 'Nunca criar login antes de haver dado a proteger')
  assert.strictEqual(A.lerEstado(cwd).regente, false)
  R.ligar(cwd)
  const e = A.lerEstado(cwd)
  assert.strictEqual(e.regente, true)
  assert.ok(e.regras.includes('Nunca criar login'))
})
await teste('decidirFicha fecha a ficha com a decisão e marca a origem', async () => {
  const p = { tipo: 'ideia', titulo: 'Próximo passo', porque: 'o MVP não tem gasto', pergunta: 'O que fazemos?', opcoes: ['Fazer o cadastro de gasto', 'Fazer o relatório'] }
  const ficha = A.registrarPergunta(cwd, p)
  const r = await A.decidirFicha(cwd, ficha, p, {}, { chamar: async () => JSON.stringify({ escolha: 'Fazer o cadastro de gasto', porque: 'é o que o MVP pede agora' }) })
  assert.strictEqual(r.regente.origem, 'modelo')
  assert.strictEqual(r.pergunta.estado, 'OK')
  assert.ok(r.pergunta.automatico.startsWith('regente: '))
  assert.ok(r.pergunta.fazer, 'a ideia aceita vira item e "fazer" aponta para ele')
})
await teste('passo no Regente: o modelo propõe, o Regente decide e a ficha fecha sozinha', async () => {
  proposta({ tipo: 'ideia', titulo: 'Cadastro de gasto', porque: 'o MVP precisa registrar o gasto do dia', pergunta: 'Começamos pelo cadastro de gasto?', opcoes: ['Fazer o cadastro de gasto', 'Fazer o relatório'] })
  const r = await A.passo(cwd)
  assert.ok(r.automatico && r.regente, JSON.stringify(r).slice(0, 300))
  assert.strictEqual(r.regente.escolha, 'Fazer o cadastro de gasto')
  assert.strictEqual(A.perguntaDoArquiteto(cwd), null, 'nenhuma pergunta ficou esperando por ele')
})
await teste('passo no Regente: pedido de item que exige o Felipe vai para a fila dele e não executa', async () => {
  const it = B.acrescentar({ prefixo: 'EN', natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe', intencao: 'Cadastrar a conta de pagamento no domínio novo', citacao: 'cadastrar a conta de pagamento no domínio novo', pronto: 'a conta de pagamento cadastrada no domínio novo funciona', conferir: 'dele:ele confere' }, arq())
  proposta({ tipo: 'pedido', titulo: 'Cadastrar a conta de pagamento', porque: 'está na fila dele', pergunta: 'Construo agora?', opcoes: ['Construa agora', 'Não, depois'], executa: 'Construa agora', pedido: 'Cadastrar a conta de pagamento no domínio novo', daFila: it.id })
  const r = await A.passo(cwd)
  assert.ok(r.bloqueou && r.bloqueou.id === it.id, JSON.stringify(r).slice(0, 300))
  assert.ok(!r.pergunta.executar, 'o robô não recebe ordem de executar')
  assert.strictEqual(B.ler(arq()).itens.find((x) => x.id === it.id).estado, 'DE')
  assert.ok(!A.lerEstado(cwd).fila.some((x) => x.id === it.id), 'e some das opções do robô')
})
await teste('modelo indisponível (aviso de limite): passo não grava ficha nem decisão e não cai no socorro', async () => {
  R.ligar(cwd)
  const antes = B.ler(arq()).itens.length
  const f = path.join(tmp, 'limite.txt'); fs.writeFileSync(f, 'Claude AI usage limit reached. Your limit will reset at 11:40.\n'); process.env.PROPOSTA = f
  const r = await A.passoOuSocorro(cwd)
  assert.ok(r.indisponivel && /modelo indisponível/.test(r.indisponivel), JSON.stringify(r).slice(0, 200))
  assert.ok(!r.socorro && !r.pergunta)
  assert.strictEqual(B.ler(arq()).itens.length, antes, 'nenhuma ficha nova')
  assert.strictEqual(R.ler(cwd).ligado, true, 'e o Regente segue ligado')
})
await teste('decisão repetida 3 vezes desliga o Regente com motivo e deixa a ficha aberta', async () => {
  R.ligar(cwd)
  const mk = () => ({ tipo: 'ideia', titulo: 'Preciso da sua direção', porque: 'não achei próximo passo', pergunta: 'O que fazemos?', opcoes: ['Fazer: Fundação', 'Outra direção (escreva abaixo)'] })
  const chamar = async () => JSON.stringify({ escolha: 'Fazer: Fundação', porque: 'é o item que sobrou na fila' })
  const r1 = await A.decidirFicha(cwd, A.registrarPergunta(cwd, mk()), mk(), {}, { chamar })
  const r2 = await A.decidirFicha(cwd, A.registrarPergunta(cwd, mk()), mk(), {}, { chamar })
  assert.ok(r1.regente && r2.regente)
  const f3 = A.registrarPergunta(cwd, mk())
  const r3 = await A.decidirFicha(cwd, f3, mk(), {}, { chamar })
  assert.ok(r3.desligou && /3 vezes seguidas/.test(r3.desligou) && !r3.regente, JSON.stringify(r3).slice(0, 200))
  assert.strictEqual(R.ler(cwd).ligado, false)
  assert.match(R.ler(cwd).motivo, /^laço: Preciso da sua direção Fazer: Fundação repetida$/)
  assert.strictEqual(B.ler(arq()).itens.find((x) => x.id === f3.id).estado, 'DE', 'a terceira ficha ficou aberta para ele')
  B.mover(f3.id, 'OK', { prova: 'limpeza do teste' }, arq())
})
await teste('item da fila que já tem commit: fecha com a prova "feito: commit" e não vira obra', async () => {
  const { execFileSync } = await import('node:child_process')
  const sh = (...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' })
  sh('init', '-q'); sh('config', 'user.email', 't@t'); sh('config', 'user.name', 't')
  fs.writeFileSync(path.join(cwd, 'base.txt'), 'x\n'); sh('add', 'base.txt'); sh('commit', '-q', '-m', 'feat(FU-1): fundação do projeto')
  const it = B.acrescentar({ prefixo: 'FU', natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe', intencao: 'Fundação do projeto', citacao: 'fundação do projeto', pronto: 'a base existe', conferir: 'auto:build' }, arq())
  assert.strictEqual(await A.fecharSeFeito(cwd, B.ler(arq()).itens.find((x) => x.id === it.id)), null, 'desligado: não mexe')
  R.ligar(cwd)
  const c = await A.fecharSeFeito(cwd, B.ler(arq()).itens.find((x) => x.id === it.id))
  assert.ok(c && c.hash)
  const fechado = B.ler(arq()).itens.find((x) => x.id === it.id)
  assert.strictEqual(fechado.estado, 'OK')
  assert.match(fechado.prova, /^feito: commit [0-9a-f]+ /)
  R.desligar(cwd)
})
await teste('conferência pelo conteúdo (CM-9): fecha, recusa prova falsa, não feito, indisponível e cache do dia', async () => {
  fs.writeFileSync(path.join(cwd, 'servidor.yml'), 'x\n')
  const mk = () => B.acrescentar({ prefixo: 'CF', natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe', intencao: 'Alicerce zeta do projeto', citacao: 'alicerce zeta', pronto: 'o alicerce existe', conferir: 'auto:build' }, arq())
  const pega = (id) => B.ler(arq()).itens.find((x) => x.id === id)
  const conta = { n: 0 }
  const com = (resp) => ({ chamar: async () => { conta.n++; if (resp instanceof Error) throw resp; return resp } })
  R.ligar(cwd)
  // (1) feito true com arquivo existente fecha (o maestro nem entra: quem chama só segue ao próximo)
  const a = mk()
  assert.ok(await A.fecharSeFeito(cwd, pega(a.id), com('{"feito":true,"prova":"servidor.yml existe e sobe o servidor com login"}')))
  assert.strictEqual(pega(a.id).estado, 'OK')
  assert.match(pega(a.id).prova, /^feito \(conferido pelo Regente\): servidor\.yml/)
  // (2) caminho inexistente: inválida, constrói
  const b = mk()
  assert.strictEqual(await A.fecharSeFeito(cwd, pega(b.id), com('{"feito":true,"prova":"o arquivo nao-existe/zeta.yml cobre tudo"}')), null)
  assert.notStrictEqual(pega(b.id).estado, 'OK')
  // (3) feito false: constrói
  const c = mk()
  assert.strictEqual(await A.fecharSeFeito(cwd, pega(c.id), com('{"feito":false,"prova":""}')), null)
  assert.notStrictEqual(pega(c.id).estado, 'OK')
  // (5) cache do mesmo dia: não chama o modelo de novo
  const antes = conta.n
  assert.strictEqual(await A.fecharSeFeito(cwd, pega(c.id), com('{"feito":true,"prova":"servidor.yml existe sim"}')), null)
  assert.strictEqual(conta.n, antes, 'cache do dia')
  // (4) indisponível: constrói e não grava cache
  const d = mk()
  assert.strictEqual(await A.fecharSeFeito(cwd, pega(d.id), com(new Error('usage limit reached'))), null)
  assert.ok(!R.ler(cwd).conferidos?.[d.id])
  assert.strictEqual(await A.fecharSeFeito(cwd, pega(d.id), com('You have hit your usage limit, resets 3pm')), null)
  assert.ok(!R.ler(cwd).conferidos?.[d.id])
  // ensaio devolve o resultado e não grava nada
  const r = await R.conferirPorConteudo(cwd, pega(d.id), { ensaio: true, chamar: async () => '{"feito":true,"prova":"servidor.yml existe sim"}' })
  assert.strictEqual(r.feito, true); assert.ok(!R.ler(cwd).conferidos?.[d.id])
  R.desligar(cwd)
})
await teste('passo com o Regente desligado volta a perguntar a ele', async () => {
  R.desligar(cwd)
  proposta({ tipo: 'ideia', titulo: 'Relatório', porque: 'o gasto já existe e falta resumir', pergunta: 'Fazemos o relatório mensal?', opcoes: ['Fazer o relatório', 'Deixar para depois'] })
  const r = await A.passo(cwd)
  assert.ok(!r.regente && r.pergunta.estado === 'DE')
  assert.ok(A.perguntaDoArquiteto(cwd))
})

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${n} verificações${falhou ? ', COM FALHA' : ''}`)
process.exit(falhou ? 1 : 0)
