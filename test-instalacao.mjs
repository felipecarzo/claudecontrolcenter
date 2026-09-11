/**
 * O verificador de instalação: as travas que ele existe para ter.
 *
 * Roda em casa temporária (`CC_HOME`), nunca no `settings.json` de verdade.
 * O gate deste projeto já escreveu em dado real do Felipe uma vez, e isso é
 * candidato à causa do apagamento das notas de 2026-08-09.
 *
 * A prova NEGATIVA é o coração daqui: um teste que só sabe dizer "hoje passa"
 * não prova que pegaria a regressão. Cada caso confere que a falta é vista
 * quando existe, e some quando é consertada.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-inst-'))
fs.mkdirSync(path.join(casa, 'hooks'), { recursive: true })
process.env.CC_HOME = casa

const { conferir, conferirUma, exigencias, GRAVIDADE, ligar, pastaPluginOpencode } = await import('./src/instalacao.mjs')
const { HOOKS } = await import('./src/hooksCatalogo.mjs')

let ok = 0
const t = (nome, fn) => { fn(); ok++; console.log('  ok  ', nome) }

console.log('\nverificador de instalação\n')

const settingsVazio = { hooks: {} }

t('sem nada registrado, TODO hook do catálogo aparece como ausente', () => {
  fs.writeFileSync(path.join(casa, 'settings.json'), JSON.stringify(settingsVazio), 'utf8')
  const doCatalogo = exigencias().filter((e) => e.tipo === 'hook')
  const ausentes = doCatalogo.filter((e) => conferirUma(e, { settings: settingsVazio }).ok === false)
  assert.equal(ausentes.length, doCatalogo.length, 'casa vazia tem que acusar todos')
  assert.ok(doCatalogo.length >= 30, `o catálogo encolheu: só ${doCatalogo.length} hooks`)
})

t('⚠️ os dois hooks do framework ESTÃO declarados, e é o que torna a falta visível', () => {
  const ids = exigencias().map((e) => e.id)
  assert.ok(ids.includes('hook:framework-guard'), 'framework-guard fora da declaração: a falta dele volta a ser invisível')
  assert.ok(ids.includes('hook:framework-inicio'), 'framework-inicio fora da declaração')
})

t('hook registrado é reconhecido, e a mesma exigência muda de resposta', () => {
  const e = exigencias().find((x) => x.id === 'hook:travessao-guard')
  assert.ok(e, 'o catálogo perdeu o travessao-guard')
  assert.equal(conferirUma(e, { settings: settingsVazio }).ok, false)
  const comEle = { hooks: { [e.hook.evento]: [{ hooks: [{ type: 'command', command: `node /qualquer/${e.hook.script}` }] }] } }
  assert.equal(conferirUma(e, { settings: comEle }).ok, true, 'registrado e não reconhecido')
})

t('settings ilegível vira "não sei", NUNCA "está faltando"', () => {
  const e = exigencias().find((x) => x.tipo === 'hook')
  const r = conferirUma(e, { settings: null })
  assert.equal(r.ok, null, 'falha de leitura não pode parecer ausência: era o defeito mais caro deste painel')
})

t('o vizinho que falta é apontado, e some quando é copiado', () => {
  const e = exigencias().find((x) => x.tipo === 'vizinho')
  assert.equal(conferirUma(e, {}).ok, false, 'casa temporária não tem o arquivo, tinha que acusar')
  fs.copyFileSync(path.join(process.cwd(), 'hooks', 'routia', 'acharCC.mjs'), path.join(casa, 'hooks', 'acharCC.mjs'))
  assert.equal(conferirUma(e, {}).ok, true, 'depois de copiar tinha que passar')
})

t('toda exigência tem gravidade conhecida e motivo escrito', () => {
  for (const e of exigencias()) {
    assert.ok(GRAVIDADE[e.gravidade], `gravidade desconhecida em ${e.id}: ${e.gravidade}`)
    assert.ok(e.porque && e.porque.length > 15, `exigência sem motivo legível: ${e.id}`)
    assert.ok(e.titulo, `exigência sem título: ${e.id}`)
  }
})

t('id de exigência não se repete', () => {
  const ids = exigencias().map((e) => e.id)
  assert.equal(new Set(ids).size, ids.length, 'id repetido faria uma exigência esconder a outra')
})

t('o retrato conta certo e dá a frase de uma linha', () => {
  fs.writeFileSync(path.join(casa, 'settings.json'), JSON.stringify(settingsVazio), 'utf8')
  const r = conferir()
  assert.equal(r.ok + r.faltando.length + r.naoSei.length, r.total, 'a conta não fecha')
  assert.ok(r.frase.includes('não estão ativas'), `frase errada com peça faltando: ${r.frase}`)
})

t('faltando vem ordenado por gravidade, o que quebra primeiro', () => {
  const r = conferir()
  const pesos = r.faltando.map((f) => GRAVIDADE[f.gravidade].peso)
  assert.deepEqual(pesos, [...pesos].sort((a, b) => b - a), 'o que quebra tem que vir antes do que atrasa')
})

t('ligar em modo de ensaio NÃO escreve nada', () => {
  const antes = fs.readFileSync(path.join(casa, 'settings.json'), 'utf8')
  const r = ligar({ dryRun: true })
  assert.ok(r.feitos.length, 'com casa vazia tinha que ter o que ligar')
  assert.equal(fs.readFileSync(path.join(casa, 'settings.json'), 'utf8'), antes, 'ensaio escreveu de verdade')
})

t('o ensaio fala no futuro, porque ler "registrado" faz ele não rodar de verdade', () => {
  const r = ligar({ dryRun: true })
  const passado = r.feitos.filter((f) => f.acao === 'registrado' || f.acao === 'copiado')
  assert.deepEqual(passado, [], `ensaio dizendo que fez: ${passado.map((p) => p.id).join(', ')}`)
})

t('ligar de verdade registra, e a conferência seguinte concorda', () => {
  const alvo = 'hook:framework-guard'
  const antes = conferir().faltando.some((f) => f.id === alvo)
  assert.ok(antes, 'o framework-guard tinha que estar faltando aqui')
  ligar({ apenas: [alvo] })
  const depois = conferir().faltando.some((f) => f.id === alvo)
  assert.equal(depois, false, 'ligou e a conferência não viu: as duas contas discordam')
})

t('a versão publicada nunca é ligada sozinha: é decisão dele', () => {
  const r = ligar({ dryRun: true })
  assert.ok(!r.feitos.some((f) => f.id.startsWith('versao:')), 'publicar troca o painel dele e não pode sair de um comando de conserto')
})

t('a pasta de plugin do opencode é a que o opencode lê', () => {
  const p = pastaPluginOpencode()
  assert.ok(p.includes('opencode') && p.endsWith('plugin'), `caminho estranho: ${p}`)
})

t('hook não implementado fica fora da cobrança', () => {
  const naoImpl = HOOKS.filter((h) => h.implementado === false)
  const ids = new Set(exigencias().map((e) => e.id))
  for (const h of naoImpl) assert.ok(!ids.has(`hook:${h.id}`), `${h.id} não existe ainda e está sendo cobrado`)
})

fs.rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas\n`)
