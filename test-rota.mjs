/**
 * CC-913: a rota inteira. Com o mapa aprovado, o arquiteto propõe os itens do backlog parte por parte.
 * Sem IA de verdade: o Haiku é um script de mentira, e tudo roda em pasta temporária.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rota-'))
process.env.CC_HOME = path.join(tmp, 'casa') // nada deste teste toca o ~/.claude de verdade
const P = await import('./src/produto.mjs')
const D = await import('./src/frameworkDisco.mjs')
const Ar = await import('./src/arquiteto.mjs')
const Bk = await import('./src/backlog.mjs')

let ok = 0
const t = async (nome, fn) => { await fn(); ok++; console.log('  ok   ' + nome) }

const item = (o = {}) => ({ intencao: 'montar a tela de entrar no app', pronto: 'a pessoa digita e entra no app', tamanho: 'M', natureza: 'PED', area: 'tela', conferir: 'olho:abrir a tela de entrar', ...o })
const rota = (itens, extra = {}) => JSON.stringify({ itens, ...extra })

await t('validarRota troca auto fora da lista fechada por olho, e mantém auto conhecido', () => {
  const r = P.validarRota(rota([item({ conferir: 'auto:rm -rf ~' }), item({ conferir: 'auto:node test-entrar.mjs' })]))
  assert.ok(r.ok, r.erros.join())
  assert.equal(r.itens[0].conferir, 'olho:a pessoa digita e entra no app')
  assert.equal(r.itens[1].conferir, 'auto:node test-entrar.mjs')
  assert.ok(P.validarRota('```json\n' + rota([item(), item()]) + '\n```').ok)
})

await t('validarRota recusa 5 itens, 1 item, travessão, campo a mais, natureza e área fora da lista', () => {
  const cinco = P.validarRota(rota(Array.from({ length: 5 }, () => item())))
  assert.ok(!cinco.ok); assert.match(cinco.erros.join(), /de 2 a 4/)
  assert.match(P.validarRota(rota([item()])).erros.join(), /de 2 a 4/)
  assert.match(P.validarRota(rota([item({ pronto: 'a pessoa entra \u2014 e vê o resumo' }), item()])).erros.join(), /travessão/)
  assert.match(P.validarRota(rota([item({ extra: 'x' }), item()])).erros.join(), /campo desconhecido/)
  assert.match(P.validarRota(rota([item({ natureza: 'DEF' }), item()])).erros.join(), /natureza/)
  assert.match(P.validarRota(rota([item({ area: 'nuvem' }), item()])).erros.join(), /area/)
  assert.match(P.validarRota(rota([item({ conferir: 'confia em mim' }), item()])).erros.join(), /conferir/)
  assert.match(P.validarRota(rota([item({ intencao: 'curta' }), item()])).erros.join(), /intencao/)
})

await t('proximaParteSemRota segue a ordem, não a posição no array', () => {
  const pr = { partes: [{ codigo: 'b', ordem: 2, rota: null }, { codigo: 'a', ordem: 1, rota: 'x' }, { codigo: 'c', ordem: 3, rota: null }] }
  assert.equal(P.proximaParteSemRota(pr).codigo, 'b')
  pr.partes[0].rota = 'x'; assert.equal(P.proximaParteSemRota(pr).codigo, 'c')
  pr.partes[2].rota = 'x'; assert.equal(P.proximaParteSemRota(pr), null)
})

/* ---- o arquiteto, com o Haiku de mentira: devolve 3 itens com o nome da parte na intenção ---- */
const falso = path.join(tmp, 'haiku.mjs')
fs.writeFileSync(falso, `#!/usr/bin/env node
let s = ''; process.stdin.on('data', (d) => { s += d }); process.stdin.on('end', () => {
  const parte = /PARTE: ([^(\\n]+?) \\(/.exec(s)?.[1] || 'x'
  const it = (n) => ({ intencao: 'passo ' + n + ' da parte ' + parte, pronto: 'o passo ' + n + ' de ' + parte + ' funciona e dá para ver', tamanho: 'P', natureza: 'PED', area: 'tela', conferir: 'auto:rm -rf ~' })
  console.log(JSON.stringify({ itens: [it(1), it(2), it(3)] }))
})
`)
fs.chmodSync(falso, 0o755)

const parteDe = (codigo, nome, ordem) => ({ codigo, nome, tipo: 'tela', atividade: 'a pessoa usa ' + nome, ordem, caracteristicas: ['rápido'], caracteristicasFeitas: true, rota: null })
const projeto = (nome, { catalogo = false } = {}) => {
  const d = path.join(tmp, nome, 'VPS_conta-teste')
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'backlog.jsonl'), '')
  if (catalogo) fs.writeFileSync(path.join(d, 'docs', 'frentes.json'), JSON.stringify({ geral: 'o resto', entrar: 'Entrar: a pessoa entra', resumo: 'Resumo: a pessoa vê o total' }))
  D.gravar(d, { metodo: 'produto', modo: 'sugestivo', fase: 'mapa', ligado: true,
    mvp: { nome: 'um app de contas', criterios: [{ texto: 'registra gasto', feito: false }] },
    plano: { itens: 0, primeira: '' },
    produto: { definicao: '2026-10-04T10:00:00Z', mapa: '2026-10-04T11:00:00Z' },
    entrevista: { terminou: '2026-10-04T10:00:00Z', respostas: {
      natureza: { valor: 'cliente', texto: 'Site ou app para cliente', de: 'ele' },
      entrega: { texto: 'um app de contas', de: 'ele' }, quem: { texto: 'a família', de: 'ele' }, hoje: { texto: 'planilha solta', de: 'ele' } } } })
  P.gravar(d, { ...P.produtoVazio(), definicao: { oque: 'um app de contas', paraQuem: 'a família', problema: 'planilha solta', sucesso: 'usam', natureza: 'cliente', confirmada: 'x' },
    faltouPerguntado: true, mapaAprovado: '2026-10-04T11:00:00Z', partes: [parteDe('entrar', 'Entrar', 1), parteDe('resumo', 'Resumo do mês', 2)] })
  return d
}
const itensDe = (d) => Bk.ler(Bk.caminhoPadrao(d)).itens.filter((x) => !x.proposta)

await t('perguntaDaRota devolve um cartão multipla da primeira parte, com o pronto nas descrições', async () => {
  const d = projeto('a')
  const q = await Ar.perguntaDaRota(d, { binario: falso })
  assert.equal(q.tipo, 'rota'); assert.equal(q.multipla, true); assert.equal(q.titulo, 'Rota: Entrar')
  assert.equal(q.opcoes.length, 3); assert.equal(q.rota.parte, 'entrar')
  assert.match(q.descricoes[0], /^pronto: /)
  assert.equal(q.rota.itens[0].conferir, 'olho:' + q.rota.itens[0].pronto, 'o auto de mentira virou olho')
  assert.match(Ar.mensagemDaPergunta({ id: 'X-1', proposta: q, opcoes: q.opcoes, decisao: q.pergunta }).texto, /Rota do produto \(/)
})

await t('sem mapa aprovado, ou em outro método, não pergunta rota', async () => {
  const d = projeto('b'); D.gravar(d, { ...D.ler(d, { sessao: null }), produto: { definicao: 'x' } })
  assert.equal(await Ar.perguntaDaRota(d, { binario: falso }), null)
  const o = projeto('c'); D.gravar(o, { ...D.ler(o, { sessao: null }), metodo: 'mvp-basico' })
  assert.equal(await Ar.perguntaDaRota(o, { binario: falso }), null)
})

await t('Haiku que erra o contrato duas vezes joga erro', async () => {
  await assert.rejects(() => Ar.perguntaDaRota(projeto('d'), { binario: '/bin/true' }), /recusadas pelo contrato duas vezes/)
})

const caminho = async (d) => {
  let r = await Ar.passo(d, { binario: falso }); assert.equal(r.proposta.tipo, 'rota'); assert.equal(r.proposta.rota.parte, 'entrar')
  // 2 de 3 marcadas, na string que a rota do painel monta, mais um extra
  Ar.responder(d, r.pergunta.id, `${r.proposta.opcoes[0]}, ${r.proposta.opcoes[2]}. Também quero um aviso na entrada`)
  let itens = itensDe(d)
  assert.equal(itens.length, 3, '2 marcadas mais o extra')
  assert.deepEqual(itens.map((x) => x.estado), ['B1', 'B1', 'B0'])
  assert.ok(itens.every((x) => x.frente === 'entrar'), 'a frente é o código da parte')
  assert.deepEqual(itens.slice(0, 2).map((x) => x.origem), ['arquiteto', 'arquiteto'])
  for (const x of itens) assert.deepEqual(Bk.problemasDoFormato(x), [], `${x.id} no formato novo`)
  assert.equal(itens[2].citacao, 'Também quero um aviso na entrada')
  assert.match(itens[0].intencao, /passo 1 da parte Entrar/); assert.match(itens[1].intencao, /passo 3/)
  assert.ok(P.ler(d).partes[0].rota); assert.equal(P.ler(d).partes[1].rota, null)
  assert.equal(D.ler(d, { sessao: null }).plano.itens, 0, 'ainda falta a rota da segunda parte')
  // segunda e última parte, pelo array de rótulos
  r = await Ar.passo(d, { binario: falso }); assert.equal(r.proposta.rota.parte, 'resumo')
  Ar.responder(d, r.pergunta.id, [r.proposta.opcoes[1]])
  itens = itensDe(d)
  assert.equal(itens.length, 4); assert.equal(itens[3].frente, 'resumo'); assert.deepEqual(Bk.problemasDoFormato(itens[3]), [])
  assert.deepEqual(itens.map((x) => Number(x.id.split('-')[1])), [...itens.map((x) => Number(x.id.split('-')[1]))].sort((a, b) => a - b), 'ordem de criação = ordem do mapa')
  const est = D.ler(d, { sessao: null })
  assert.equal(est.plano.itens, 4); assert.equal(est.plano.primeira, itens[0].intencao)
  assert.equal(est.fase, 'execucao', 'backlog escrito e primeira fatia escolhida: o portão do planejamento abre')
  assert.equal(await Ar.perguntaDaRota(d, { binario: falso }), null, 'todas as partes têm rota')
  assert.ok(fs.existsSync(path.join(d, 'docs', 'ROADMAP.md')), 'o roadmap foi regerado')
}

await t('responder: 2 de 3 escolhas viram B1 na frente da parte, o extra vira B0, e a última parte grava o plano', async () => {
  await caminho(projeto('e'))
})

await t('projeto COM catálogo de frentes (as partes entram nele na aprovação do mapa): a rota não é recusada', async () => {
  await caminho(projeto('f', { catalogo: true }))
})

await t('resposta só com o extra cria só o B0, e rótulo que não existe é ignorado', async () => {
  const d = projeto('g')
  const r = await Ar.passo(d, { binario: falso })
  Ar.responder(d, r.pergunta.id, 'Só quero que a entrada tenha logo')
  const itens = itensDe(d)
  assert.equal(itens.length, 1); assert.equal(itens[0].estado, 'B0'); assert.equal(itens[0].frente, 'entrar')
  assert.ok(P.ler(d).partes[0].rota, 'a parte conta como proposta mesmo sem passo marcado')
})

await t('"Nenhuma destas" na rota não cria item de backlog, mas conta a parte como respondida', async () => {
  const d = projeto('i')
  const r = await Ar.passo(d, { binario: falso })
  Ar.responder(d, r.pergunta.id, 'Nenhuma destas')
  assert.equal(itensDe(d).length, 0); assert.ok(P.ler(d).partes[0].rota, 'a parte tem rota (vazia), e a pergunta não volta')
})

await t('duas perguntas da mesma rota respondidas (duas abas): a segunda não duplica os itens', async () => {
  const d = projeto('h')
  const r = await Ar.passo(d, { binario: falso })
  const gemea = Ar.registrarPergunta(d, r.proposta) // a mesma pergunta, ficha nova
  Ar.responder(d, r.pergunta.id, 'Só quero que a entrada tenha logo')
  assert.equal(itensDe(d).length, 1)
  Ar.responder(d, gemea.id, 'Só quero que a entrada tenha logo')
  assert.equal(itensDe(d).length, 1, 'a parte já tinha rota: nada novo')
})

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas (rota)\n`)
