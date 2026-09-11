/**
 * O migrador de backlog: as travas que ele existe para ter.
 *
 * Roda em pasta temporária. Nenhum projeto de verdade é tocado aqui.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { extrair, migrar, siglaDe } from './src/migrarBacklog.mjs'
import { ler } from './src/backlog.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok++; console.log('  ok  ', nome) }

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-migrar-'))
const projeto = (nome, roadmap) => {
  const raiz = path.join(casa, nome)
  fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true })
  if (roadmap != null) fs.writeFileSync(path.join(raiz, 'docs', 'ROADMAP.md'), roadmap, 'utf8')
  return raiz
}

console.log('\nmigrador de backlog em prosa\n')

const EXEMPLO = [
  '# ROADMAP',
  '',
  '## Frente do site',
  '',
  '### NV-01 ✅ 04/08: a home no ar',
  'texto qualquer, com prova: gate verde',
  '',
  '### NV-02: o jogo do evento',
  'ainda não começou',
  '',
  '### ⏸ NV-03: decisão dele sobre o deploy',
  '',
  '## Outra frente',
  '',
  '### Uma coisa sem número nenhum',
  'o parser tem que inventar um id estável',
  '',
  'O NV-99 foi citado aqui e não tem seção.',
].join('\r\n') // CRLF de propósito: metade dos arquivos daqui é assim

t('lê CRLF e acha todos os itens', () => {
  const itens = extrair(EXEMPLO, { sigla: 'NV' })
  const ids = itens.map((i) => i.id)
  assert.ok(ids.includes('NV-01') && ids.includes('NV-02') && ids.includes('NV-03'), `achou ${ids.join(',')}`)
  assert.ok(itens.length >= 5, `achou só ${itens.length}`)
})

t('o emoji vira estado, e cada um no seu', () => {
  const por = Object.fromEntries(extrair(EXEMPLO, { sigla: 'NV' }).map((i) => [i.id, i.estado]))
  assert.equal(por['NV-01'], 'OK', 'o ✅ tinha que fechar')
  assert.equal(por['NV-02'], 'B1', 'sem marcador é item definido')
  assert.equal(por['NV-03'], 'DE', 'o ⏸ é decisão dele')
})

t('item fechado leva prova, porque é onde a prova foi escrita', () => {
  const i = extrair(EXEMPLO, { sigla: 'NV' }).find((x) => x.id === 'NV-01')
  assert.ok(i.prova && i.prova.length > 5, 'fechado sem prova seria recusado pelo contrato')
  assert.ok(i.fechado, 'fechado sem data')
})

t('número citado sem seção vira cancelado com motivo, não item aberto', () => {
  const i = extrair(EXEMPLO, { sigla: 'NV' }).find((x) => x.id === 'NV-99')
  assert.equal(i.estado, 'KO')
  assert.ok(i.porque.includes('sem seção'), 'cancelado sem dizer por quê')
})

t('item sem número ganha id com a sigla do projeto', () => {
  const inventados = extrair(EXEMPLO, { sigla: 'NV' }).filter((i) => /^NV-\d{3}$/.test(i.id))
  assert.ok(inventados.length >= 1, 'o item sem número sumiu em vez de ganhar id')
})

t('o título perde marcador e número, e sobra texto legível', () => {
  const i = extrair(EXEMPLO, { sigla: 'NV' }).find((x) => x.id === 'NV-03')
  assert.ok(!/⏸/.test(i.titulo), `marcador vazou para o título: ${i.titulo}`)
  assert.ok(!/NV-03/.test(i.titulo), `o id vazou para o título: ${i.titulo}`)
  assert.ok(i.titulo.includes('decisão'), `título ficou vazio: ${i.titulo}`)
})

t('a frente vem do agrupamento do markdown', () => {
  const i = extrair(EXEMPLO, { sigla: 'NV' }).find((x) => x.id === 'NV-01')
  assert.ok(i.frente.includes('site'), `frente errada: ${i.frente}`)
})

t('sigla é estável e sai da lista quando existe', () => {
  assert.equal(siglaDe('inovallbond'), 'NV')
  assert.equal(siglaDe('cockpit'), 'CC')
  assert.equal(siglaDe('projeto-novo-qualquer'), siglaDe('projeto-novo-qualquer'), 'a mesma entrada tem que dar a mesma sigla sempre')
  assert.match(siglaDe('zzz-desconhecido'), /^[A-Z]{2}$/)
})

t('migrar grava o arquivo e ele volta válido pelo leitor', () => {
  const raiz = projeto('alfa', EXEMPLO)
  const r = migrar(raiz, { projeto: 'alfa' })
  assert.ok(r.ok, `falhou: ${r.motivo}`)
  const lido = ler(path.join(raiz, 'docs', 'backlog.jsonl'))
  assert.deepEqual(lido.ruins, [], 'gravou item que o próprio contrato recusa')
  assert.equal(lido.itens.length, r.total)
})

t('⚠️ NUNCA apaga o roadmap em prosa: desfazer tem que ser barato', () => {
  const raiz = projeto('beta', EXEMPLO)
  migrar(raiz, { projeto: 'beta' })
  assert.ok(fs.existsSync(path.join(raiz, 'docs', 'ROADMAP.md')), 'apagou a fonte, e são 27 projetos de cliente')
})

t('não sobrescreve backlog que já existe, a não ser com forcar', () => {
  const raiz = projeto('gama', EXEMPLO)
  migrar(raiz, { projeto: 'gama' })
  fs.appendFileSync(path.join(raiz, 'docs', 'backlog.jsonl'), JSON.stringify({ id: 'NV-500', titulo: 'escrito à mão depois', estado: 'B1', frente: 'f' }) + '\n')
  const r = migrar(raiz, { projeto: 'gama' })
  assert.equal(r.ok, false, 'sobrescreveu e perdeu o que foi mexido no meio')
  assert.ok(ler(path.join(raiz, 'docs', 'backlog.jsonl')).itens.some((i) => i.id === 'NV-500'))
  assert.ok(migrar(raiz, { projeto: 'gama', forcar: true }).ok, 'com forcar tinha que passar')
})

t('⚠️ forçar faz cópia antes: em 11/09 isto apagou um backlog curado à mão', () => {
  const raiz = projeto('epsilon', EXEMPLO)
  migrar(raiz, { projeto: 'epsilon' })
  const antes = fs.readFileSync(path.join(raiz, 'docs', 'backlog.jsonl'), 'utf8')
  migrar(raiz, { projeto: 'epsilon', forcar: true })
  const bak = path.join(raiz, 'docs', 'backlog.jsonl.bak')
  assert.ok(fs.existsSync(bak), 'sobrescreveu sem cópia, e é exatamente como o backlog do cockpit se perdeu')
  assert.equal(fs.readFileSync(bak, 'utf8'), antes, 'a cópia não é a versão anterior')
})

t('ensaio não escreve nada', () => {
  const raiz = projeto('delta', EXEMPLO)
  const r = migrar(raiz, { projeto: 'delta', ensaio: true })
  assert.ok(r.ok && r.total > 0, 'o ensaio precisa dizer quantos sairiam')
  assert.equal(fs.existsSync(path.join(raiz, 'docs', 'backlog.jsonl')), false, 'ensaio escreveu de verdade')
})

t('projeto sem roadmap explica em vez de estourar', () => {
  const raiz = projeto('vazio', null)
  const r = migrar(raiz, { projeto: 'vazio' })
  assert.equal(r.ok, false)
  assert.ok(r.motivo.includes('não tem roadmap'), `motivo obscuro: ${r.motivo}`)
})

t('item escrito em LISTA também entra, e o marcado sai fechado', () => {
  const lista = [
    '# ROADMAP',
    '',
    '## Épico 1 — Manuseio',
    '',
    '- [ ] Seleção múltipla e caixa de seleção, com Del apagando o conjunto',
    '- [x] Copiar, colar e duplicar elemento pelo teclado',
    '- curto',
    '',
  ].join('\n')
  const itens = extrair(lista, { sigla: 'PV' })
  assert.equal(itens.length, 2, `esperava 2 itens de lista, veio ${itens.length}: ${itens.map((i) => i.titulo).join(' | ')}`)
  const fechado = itens.find((i) => i.estado === 'OK')
  assert.ok(fechado, 'o [x] tinha que virar item fechado')
  assert.ok(fechado.prova, 'fechado sem prova seria recusado pelo contrato')
  assert.ok(itens.every((i) => i.frente.includes('Épico')), 'a frente do item de lista tem que vir do ## acima')
})

t('⚠️ travessão NÃO passa para o título: ele vira cartão no telefone dele', () => {
  const com = '# R\n\n## Frente\n\n### NV-50 — o item que tinha travessão — e outro pedaço\n'
  for (const i of extrair(com, { sigla: 'NV' })) {
    assert.ok(!/[—–]/.test(i.titulo), `travessão no título: ${i.titulo}`)
    assert.ok(!/[—–]/.test(i.frente), `travessão na frente: ${i.frente}`)
  }
})

t('a sigla de cockpit--front não colide com a do cockpit', () => {
  assert.notEqual(siglaDe('cockpit--front'), siglaDe('cockpit'), 'duas siglas iguais fundem dois backlogs num só')
})

t('roadmap sem item legível explica, e não grava arquivo vazio', () => {
  const raiz = projeto('prosa', '# Só um texto\n\nsem título de item nenhum aqui.\n')
  const r = migrar(raiz, { projeto: 'prosa' })
  assert.equal(r.ok, false)
  assert.equal(fs.existsSync(path.join(raiz, 'docs', 'backlog.jsonl')), false)
})

fs.rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas\n`)
