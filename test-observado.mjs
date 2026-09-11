/**
 * O que a sessão fez, lido do transcrito: as travas.
 *
 * Medido em 11/09: 13 das 18 sessões desta máquina não reportavam nada ao
 * painel, e todas as mudas eram interativas. Este módulo lê o que aconteceu
 * em vez de esperar o agente contar.
 *
 * Roda em pasta temporária, com transcrito de mentira. Nenhuma conversa real
 * é lida aqui.
 */
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { frase, frenteProvavel, observar, transcritoDe } from './src/observado.mjs'

let ok = 0
const t = (nome, fn) => { fn(); ok++; console.log('  ok  ', nome) }

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-obs-'))
const RAIZ = path.join(casa, 'projeto')
fs.mkdirSync(RAIZ, { recursive: true })

const usoDeFerramenta = (nome, input, quando = '2026-09-11T10:00:00.000Z') => JSON.stringify({
  type: 'assistant',
  timestamp: quando,
  message: { content: [{ type: 'tool_use', name: nome, input }] },
})

function transcrito(nome, linhas) {
  const f = path.join(casa, nome)
  fs.writeFileSync(f, linhas.join('\n') + '\n', 'utf8')
  return f
}

console.log('\nо que a sessão fez, lido do transcrito\n'.replace('о', 'o'))

t('transcrito que não existe devolve retrato vazio, sem explodir', () => {
  const r = observar(path.join(casa, 'nao-existe.jsonl'))
  assert.equal(r.leu, false)
  assert.deepEqual(r.arquivos, [])
})

t('conta escrita de arquivo e devolve caminho relativo à raiz', () => {
  const f = transcrito('a.jsonl', [
    usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'src', 'x.mjs') }),
    usoDeFerramenta('Write', { file_path: path.join(RAIZ, 'src', 'x.mjs') }),
    usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'docs', 'y.md') }),
  ])
  const r = observar(f, { raiz: RAIZ })
  assert.equal(r.escritas, 3)
  assert.equal(r.arquivos.length, 2)
  assert.equal(r.arquivos[0].caminho, 'src/x.mjs', 'o mais mexido vem primeiro')
  assert.equal(r.arquivos[0].vezes, 2)
})

t('⚠️ LER arquivo não conta como trabalho', () => {
  const f = transcrito('b.jsonl', [
    usoDeFerramenta('Read', { file_path: path.join(RAIZ, 'src', 'x.mjs') }),
    usoDeFerramenta('Grep', { pattern: 'x' }),
    usoDeFerramenta('Glob', { pattern: '**' }),
  ])
  const r = observar(f, { raiz: RAIZ })
  assert.equal(r.escritas, 0, 'sessão que só investigou não pode parecer sessão que produziu')
  assert.deepEqual(r.arquivos, [])
  assert.equal(r.ferramentas, 3, 'mas as ferramentas continuam contadas')
})

t('reconhece teste, commit e push pelo comando', () => {
  const f = transcrito('c.jsonl', [
    usoDeFerramenta('Bash', { command: 'npm test' }),
    usoDeFerramenta('Bash', { command: 'node test-backlog.mjs' }),
    usoDeFerramenta('Bash', { command: 'git commit -m "x"' }),
    usoDeFerramenta('Bash', { command: 'git push origin main' }),
    usoDeFerramenta('Bash', { command: 'ls -la' }),
  ])
  const r = observar(f, { raiz: RAIZ })
  assert.equal(r.testes, 2)
  assert.equal(r.commits, 1)
  assert.equal(r.pushes, 1)
})

t('⚠️ arquivo FORA da raiz não entra: seria trabalho atribuído ao projeto errado', () => {
  const f = transcrito('d.jsonl', [
    usoDeFerramenta('Edit', { file_path: path.join(casa, 'outro-projeto', 'z.mjs') }),
    usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'dentro.mjs') }),
  ])
  const r = observar(f, { raiz: RAIZ })
  assert.deepEqual(r.arquivos.map((a) => a.caminho), ['dentro.mjs'])
  assert.equal(r.escritas, 2, 'a escrita ainda é contada: ela aconteceu, só não é deste projeto')
})

t('o que o modelo DIZ não conta, só o que ele faz', () => {
  const f = transcrito('e.jsonl', [
    JSON.stringify({ type: 'assistant', timestamp: '2026-09-11T10:00:00.000Z', message: { content: [{ type: 'text', text: 'Vou editar o arquivo src/x.mjs e rodar npm test agora.' }] } }),
  ])
  const r = observar(f, { raiz: RAIZ })
  assert.equal(r.escritas, 0, 'frase não é fato')
  assert.equal(r.testes, 0)
})

t('linha quebrada no meio não derruba a leitura', () => {
  const f = transcrito('f.jsonl', [
    '{quebrado tool_use',
    usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'ok.mjs') }),
  ])
  assert.equal(observar(f, { raiz: RAIZ }).escritas, 1)
})

t('a frase diz o que aconteceu, e é null quando nada aconteceu', () => {
  const vazio = transcrito('g.jsonl', [usoDeFerramenta('Read', { file_path: 'x' })])
  assert.equal(frase(observar(vazio, { raiz: RAIZ })), null, 'frase inventada sobre sessão parada faz a tela mentir')
  const cheio = transcrito('h.jsonl', [
    usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'travas.mjs') }),
    usoDeFerramenta('Bash', { command: 'npm test' }),
  ])
  const f = frase(observar(cheio, { raiz: RAIZ }))
  assert.ok(f.includes('travas.mjs'), `frase sem o arquivo: ${f}`)
  assert.ok(f.includes('teste'), `frase sem o teste: ${f}`)
})

t('a frente deduzida vem MARCADA como deduzida', () => {
  const f = transcrito('i.jsonl', [usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'src', 'travas.mjs') })])
  const r = observar(f, { raiz: RAIZ })
  const d = frenteProvavel(r, [{ id: 'CC-1', titulo: 'a taxa de cada trava por 100 respostas', frente: 'travas' }])
  assert.equal(d.frente, 'travas')
  assert.equal(d.deduzido, true, 'palpite sem marca vira fato na tela, e é o defeito que 11/09 passou o dia tirando')
  assert.ok(d.porque.includes('deduzido'))
})

t('sem item que case, não inventa frente', () => {
  const f = transcrito('j.jsonl', [usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'src', 'zzzz.mjs') })])
  assert.equal(frenteProvavel(observar(f, { raiz: RAIZ }), [{ id: 'CC-1', titulo: 'outra coisa', frente: 'outra' }]), null)
})

t('o cache não devolve retrato velho quando o arquivo cresce', () => {
  const f = transcrito('k.jsonl', [usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'um.mjs') })])
  assert.equal(observar(f, { raiz: RAIZ }).escritas, 1)
  fs.appendFileSync(f, usoDeFerramenta('Edit', { file_path: path.join(RAIZ, 'dois.mjs') }) + '\n', 'utf8')
  assert.equal(observar(f, { raiz: RAIZ }).escritas, 2, 'o cache segurou um retrato velho')
})

t('acha o transcrito pelo prefixo do id, que é o que o painel mostra', () => {
  const projetos = path.join(casa, 'projects', 'D--projeto')
  fs.mkdirSync(projetos, { recursive: true })
  const inteiro = '84be1862-9f00-4b22-a6ac-5b5d02b38f04'
  fs.writeFileSync(path.join(projetos, inteiro + '.jsonl'), '', 'utf8')
  const achado = transcritoDe('84be1862', { casa: path.join(casa, 'projects') })
  assert.ok(achado && achado.endsWith(inteiro + '.jsonl'), `não achou: ${achado}`)
  assert.equal(transcritoDe('zzz', { casa: path.join(casa, 'projects') }), null)
})

fs.rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} verificações, 0 falhas\n`)
