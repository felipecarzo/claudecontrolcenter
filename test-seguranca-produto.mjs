/**
 * CC-922: requisitos de segurança no mapa do produto, e o portão do pronto.
 * Produto de mentira em pasta temporária, varredura de mentira passada à mão (a de verdade nunca roda aqui),
 * e nada deste teste toca o ~/.claude de ninguém.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seguranca-produto-'))
process.env.CC_HOME = path.join(tmp, 'casa')
const C = await import('./src/catalogoSeguranca.mjs')
const S = await import('./src/segurancaProduto.mjs')
const P = await import('./src/produto.mjs')
const F = await import('./src/framework.mjs')
const D = await import('./src/frameworkDisco.mjs')

let ok = 0
const t = async (nome, fn) => { await fn(); ok++; console.log('  ok   ' + nome) }

const parte = (codigo, nome, atividade, extra = {}) => ({ codigo, nome, tipo: 'tela', atividade, ordem: 1, caracteristicas: [], caracteristicasFeitas: true, rota: null, ...extra })
const montar = (nome, partes, definicao = {}) => {
  const d = path.join(tmp, nome)
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true })
  P.gravar(d, { ...P.produtoVazio(), definicao: { ...P.produtoVazio().definicao, ...definicao }, partes })
  return d
}
const login = parte('login', 'Login', 'a pessoa faz o cadastro e entra com e-mail e senha')
const publica = parte('publica', 'Página pública', 'apresenta o produto e os planos')
const ids = (d, cod) => P.ler(d).partes.find((x) => x.codigo === cod).seguranca
const lista = (d, v) => S.requisitosDoProduto(d, v ? { varredura: v } : {})
const porParte = (l, cod) => l.find((x) => x.parte.codigo === cod)
// o formato de `varrerProjeto`: itens com asvs, resultado e provas (arquivo:linha)
const falsa = (itens) => ({ projeto: 'x', itens: itens.map(([asvs, resultado, provas]) => ({ asvs, nivel: 1, titulo: asvs, resultado, provas, peso: 1 })) })

const comDado = montar('com-dado', [login, publica])

await t('o catálogo: todo requisito tem id ASVS real e frase sem travessão, e só os testáveis têm checagem', () => {
  for (const [tipo, reqs] of Object.entries(C.CATALOGO)) {
    assert.ok(C.TIPOS_SEGURANCA.includes(tipo))
    for (const q of reqs) {
      assert.match(q.id, /^V\d+\.\d+\.\d+$/)
      assert.ok(q.frase.length > 15 && !new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(q.frase), q.id)
      assert.ok(q.checagem === null || q.checagem === q.id, q.id)
    }
  }
  assert.deepEqual(C.CATALOGO.conta.map((q) => q.id).slice(0, 2), ['V2.1.1', 'V2.4.1'])
})

await t('projeto que guarda dado: a parte login recebe os requisitos de conta, a pública só os de cabeçalho', () => {
  assert.deepEqual(C.tiposDaParte(login, P.ler(comDado)), ['conta', 'entrada'], 'cadastro tem formulário: conta e entrada')
  assert.deepEqual(C.tiposDaParte(publica, P.ler(comDado)), ['publico'])
  const l = lista(comDado)
  const idsLogin = porParte(l, 'login').requisitos.map((q) => q.id)
  for (const id of ['V2.1.1', 'V2.4.1', 'V2.2.1', 'V3.4.1', 'V3.4.2', 'V3.4.3']) assert.ok(idsLogin.includes(id), id)
  assert.deepEqual(porParte(l, 'publica').requisitos.map((q) => q.id), ['V14.4.5', 'V14.4.4', 'V14.4.7'])
})

await t('gravar o mapa põe seguranca: [ids] em cada parte', () => {
  assert.ok(ids(comDado, 'login').includes('V2.1.1'))
  assert.deepEqual(ids(comDado, 'publica'), ['V14.4.5', 'V14.4.4', 'V14.4.7'])
})

await t('projeto inicial sem dado NÃO recebe login nem dado de pessoa, mesmo com uma parte chamada Entrar', () => {
  const d = montar('inicial', [parte('entrar', 'Entrar', 'a pessoa entra no site'), publica], { oque: 'um site de apresentação', problema: 'ninguém conhece a empresa' })
  assert.equal(C.projetoGuardaDado(P.ler(d)), false)
  for (const p of P.ler(d).partes) {
    assert.ok(!p.seguranca.some((id) => /^V(2|3|4)\./.test(id)), `${p.codigo}: ${p.seguranca}`)
    assert.deepEqual(p.seguranca, ['V14.4.5', 'V14.4.4', 'V14.4.7'])
  }
})

await t('dado de pessoa, entrada e arquivo: dedução pelo texto da parte, só quando o projeto guarda dado', () => {
  const d = montar('variado', [
    parte('perfil', 'Meu perfil', 'a pessoa vê o histórico dela'),
    parte('lancar', 'Lançar gasto', 'a pessoa preenche o formulário do gasto', { tipo: 'fluxo' }),
    parte('foto', 'Enviar foto', 'a pessoa anexa a foto do recibo'),
    parte('cli', 'Comando', 'o terminal mostra a versão', { tipo: 'comando' }),
  ])
  const pr = P.ler(d)
  assert.deepEqual(C.tiposDaParte(pr.partes[0], pr), ['dadoPessoa'])
  assert.deepEqual(C.tiposDaParte(pr.partes[1], pr), ['dadoPessoa', 'entrada'], 'gasto lançado é dado guardado e formulário')
  assert.deepEqual(C.tiposDaParte(pr.partes[2], pr), ['dadoPessoa', 'arquivo'], 'foto do recibo é dado e arquivo')
  assert.deepEqual(C.tiposDaParte(pr.partes[3], pr), [], 'comando de terminal não é página pública')
  assert.ok(ids(d, 'foto').includes('V12.1.1'))
})

await t('o tipo é editável no dado da parte e vence a dedução (lista vazia também)', () => {
  const d = montar('editado', [{ ...login, tiposSeguranca: ['arquivo'] }, { ...publica, tiposSeguranca: [] }])
  assert.deepEqual(ids(d, 'login'), ['V12.1.1', 'V12.5.2'])
  assert.deepEqual(ids(d, 'publica'), [])
})

await t('sem varredura: o testável aparece como "não medido", o resto como "só olhando", e nada barra', () => {
  const l = lista(comDado)
  const q = (id) => porParte(l, 'login').requisitos.find((x) => x.id === id)
  assert.equal(q('V2.1.1').estado, 'não medido')
  assert.equal(q('V2.2.1').estado, 'só olhando')
  assert.equal(q('V2.2.1').testavel, false)
  assert.deepEqual(S.barraDoProduto(l), [])
})

await t('varredura com "não cumpre" num testável: barra, e a mensagem diz a parte e o arquivo:linha', () => {
  const l = lista(comDado, falsa([['V2.1.1', 'não cumpre', ['src/auth/login.js:12 aceita senha de 6 caracteres']]]))
  const barra = S.barraDoProduto(l)
  assert.equal(barra.length, 1)
  assert.match(barra[0], /Login/)
  assert.match(barra[0], /V2\.1\.1/)
  assert.match(barra[0], /src\/auth\/login\.js:12/)
})

await t('"suspeito", "não medido" e "não se aplica" não barram, mas aparecem no texto do comando', () => {
  const l = lista(comDado, falsa([['V3.4.1', 'suspeito', ['src/s.js:3 define cookie sem Secure']], ['V2.4.1', 'não se aplica', ['sem login no código']], ['V14.4.5', 'não medido', ['sem endereço']]]))
  assert.deepEqual(S.barraDoProduto(l), [])
  const txt = S.textoDosRequisitos(l, { projeto: 'x' })
  assert.match(txt, /\[suspeito\] V3\.4\.1/)
  assert.match(txt, /prova: src\/s\.js:3/)
  assert.match(txt, /Nada barra o pronto/)
  assert.match(txt, /Suspeitos: 1/)
})

await t('o portão do pronto: "não cumpre" barra o método produto na execução, e consertar solta', () => {
  const d = montar('portao', [login, publica])
  const base = { metodo: 'produto', modo: 'sugestivo', fase: 'execucao', ligado: true, mvp: { nome: 'x', criterios: [{ texto: 'ok', feito: true }] } }
  D.gravar(d, base)
  assert.equal(F.avaliar('produto', D.ler(d, { sessao: null })).portaoAberto, true, 'sem varredura, não barra')

  const ruim = S.conferirSeguranca(d, falsa([['V2.1.1', 'não cumpre', ['src/login.js:12 aceita senha de 6 caracteres']], ['V3.4.1', 'suspeito', ['src/s.js:3 cookie']]]))
  assert.equal(ruim.barra.length, 1)
  const a = F.avaliar('produto', D.ler(d, { sessao: null }))
  assert.equal(a.portaoAberto, false)
  assert.match(a.pendencias.join('\n'), /Login: V2\.1\.1.*src\/login\.js:12/)
  assert.ok(P.ler(d).varreduraSeguranca.itens['V2.1.1'], 'a prova detalhada fica no docs/produto.json')

  // só suspeito: passa
  S.conferirSeguranca(d, falsa([['V3.4.1', 'suspeito', ['src/s.js:3 cookie']]]))
  assert.equal(F.avaliar('produto', D.ler(d, { sessao: null })).portaoAberto, true)
  assert.equal(F.avaliar('mvp-basico', { ...base, metodo: 'mvp-basico' }).portaoAberto, true, 'os outros métodos não mudam')
})

await t('o portão lê só o veredito gravado: estado sem seguranca nunca barra', () => {
  assert.equal(F.PREDICADOS['seguranca-testavel-limpa']({}), null)
  assert.match(F.PREDICADOS['seguranca-testavel-limpa']({ produto: { seguranca: { quando: '2026-10-07T10:00:00Z', barra: ['Login: V2.1.1 x Prova: a.js:1'] } } }), /a\.js:1/)
})

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas (segurança do produto)\n`)
