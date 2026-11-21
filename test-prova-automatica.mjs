// CC-1095: a prova automática. O voto dele muda o estado do item, e só ele; a receita de texto dá carta válida.
// Roda numa cópia do backlog numa pasta temporária: nunca toca o backlog real.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as P from './src/provaAutomatica.mjs'
import * as C from './src/cartas.mjs'
import * as B from './src/backlog.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'prova-'))
try {
  fs.mkdirSync(path.join(raiz, 'docs', 'cartas'), { recursive: true })
  for (const f of ['backlog.jsonl', 'frentes.json']) if (fs.existsSync(path.join('docs', f))) fs.copyFileSync(path.join('docs', f), path.join(raiz, 'docs', f))
  const arq = B.caminhoPadrao(raiz)
  const [a, b] = (await P.itensDeOlho(raiz)).map((x) => x.id)
  ok(a && b, 'há itens em prova com conferência de olhar tela')

  // a carta de texto: lida do arquivo agora, válida no baralho, sem travessão
  const rec = P.receitas()
  const deTexto = Object.entries(rec).filter(([, r]) => r.texto)
  ok(deTexto.length >= 1, 'há receita de texto')
  for (const [id, r] of deTexto) { const l = P.trecho(r.texto); ok(l.length >= 1 && l.every((x) => !/[—–]/.test(x)), `${id}: o trecho existe e saiu sem travessão`) }

  const deck = { titulo: 'teste', cartas: [a, b].map((id) => ({ id, titulo: 't', opcoes: ['Aprovo', 'Não aprovo'] })) }
  ok(C.validarDeck(deck).length === 0, 'o baralho das provas passa na validação')
  fs.writeFileSync(path.join(raiz, 'docs', 'cartas', P.DECK + '.json'), JSON.stringify(deck))

  // o voto: Aprovo fecha, Não aprovo volta para andando com a nota
  C.votar(raiz, P.DECK, a, { escolhas: ['Aprovo'] })
  C.votar(raiz, P.DECK, b, { escolhas: ['Não aprovo'], nota: 'o botão está cortado' })
  const feitos = await P.aplicarVotosPendentes(raiz)
  const est = (id) => B.ler(arq).itens.find((x) => x.id === id)
  ok(feitos.length === 2, 'os dois votos foram aplicados')
  ok(est(a).estado === 'OK', 'Aprovo fecha o item')
  ok(est(b).estado === 'EM', 'Não aprovo volta o item para andando')
  ok(fs.readFileSync(path.join(raiz, 'docs', 'eventos.jsonl'), 'utf8').includes('o botão está cortado'), 'a nota dele fica no diário do item')
  ok((await P.aplicarVotosPendentes(raiz)).length === 0, 'rodar de novo não aplica o mesmo voto duas vezes')
  ok(!(await P.aplicarVoto(raiz, a, ['Aprovo'])).ok, 'item que não está em prova não muda por voto')
} finally { fs.rmSync(raiz, { recursive: true, force: true }) }
console.log(`test-prova-automatica: ${n} verificações, 0 falhas`)
