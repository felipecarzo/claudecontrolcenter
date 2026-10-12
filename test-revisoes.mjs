// CC-1038: a aba Revisões: a conta de andamento por projeto, e a aba existindo de verdade na tela.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { revisoesDe, listar } from './src/revisoes.mjs'
import { votar } from './src/cartas.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }
const deck = (titulo, ids) => ({ titulo, criado: '2026-10-10T00:00:00Z', cartas: ids.map((id) => ({ id, titulo: 'carta ' + id, opcoes: ['Aprovo', 'Editar (escreva o texto novo na nota)', 'Recuso'] })) })

const base = mkdtempSync(join(tmpdir(), 'revisoes-'))
try {
  const mk = (nome) => { const r = join(base, nome); mkdirSync(join(r, 'docs', 'cartas'), { recursive: true }); return r }
  const app = mk('VPS_app-falso'); const vazio = mk('VPS_sem-nada'); const so = mk('VPS_so-design')
  const g = (r, nome, d) => writeFileSync(join(r, 'docs', 'cartas', nome + '.json'), JSON.stringify(d))
  g(app, 'textos-app', deck('Textos de app: app', ['a1', 'a2', 'a3', 'a4']))
  g(app, 'textos-app-2', deck('Textos de app: app (parte 2)', ['b1', 'b2']))
  g(app, 'design', deck('Design: telas para aprovar', ['d1']))
  writeFileSync(join(app, 'docs', 'cartas', 'textos.fontes.json'), '{}')
  g(so, 'design', deck('Design', ['x1', 'x2']))

  // sem voto nenhum: tudo pendente, nada para aplicar
  let r = revisoesDe(app); const t0 = r.find((x) => x.chave === 'textos')
  ok(r.length === 2 && t0.total === 6 && t0.pendentes === 6 && !t0.podeAplicar, 'os baralhos textos-* viram UMA revisão (6 cartas, 6 faltando, nada para aplicar)')
  ok(JSON.stringify(t0.decks.sort()) === JSON.stringify(['textos-app', 'textos-app-2']) && t0.titulo === 'Textos do app', 'com o nome que ele lê, e os baralhos que a compõem')
  ok(revisoesDe(vazio).length === 0, 'projeto sem baralho não tem revisão')

  // votos de verdade: aprova um, edita um, recusa um, em baralhos diferentes da mesma revisão
  const v = (r2, d, id, op, nota) => assert.ok(votar(r2, d, id, { escolhas: [op], nota }).ok, 'voto ' + id)
  v(app, 'textos-app', 'a1', 'Aprovo'); v(app, 'textos-app', 'a2', 'Editar (escreva o texto novo na nota)', 'Novo texto'); v(app, 'textos-app-2', 'b1', 'Recuso')
  v(app, 'design', 'd1', 'Aprovo')
  r = revisoesDe(app); const t1 = r.find((x) => x.chave === 'textos'); const d1 = r.find((x) => x.chave === 'design')
  ok(t1.aprovados === 1 && t1.editados === 1 && t1.recusados === 1 && t1.pendentes === 3, 'conta aprovados, editados, recusados e o que falta, somando os dois baralhos')
  ok(t1.podeAplicar === true, 'há edição votada e a tabela de posições existe: pode aplicar')
  ok(d1.pendentes === 0 && d1.total === 1 && d1.titulo === 'Telas desenhadas' && !d1.podeAplicar, 'revisão de design completa, sem botão de aplicar (isso é só dos textos do app)')
  ok(r[0].chave === 'textos', 'a revisão com mais cartas faltando vem primeiro')

  // sem tabela de posições (baralho de texto de outra origem): não oferece aplicar
  rmSync(join(app, 'docs', 'cartas', 'textos.fontes.json'))
  ok(revisoesDe(app).find((x) => x.chave === 'textos').podeAplicar === false, 'sem a tabela de posições não há como aplicar, e a aba não oferece')

  // de todos os projetos
  const l = listar([vazio, so, app])
  ok(l.length === 2 && l[0].projeto === 'app-falso' && l[1].projeto === 'so-design', 'só projetos com revisão, o com mais pendências primeiro, sem o prefixo VPS_')
  ok(Array.isArray(listar([join(base, 'nao-existe')])) && listar([join(base, 'nao-existe')]).length === 0, 'pasta que não existe não derruba nada')
} finally { rmSync(base, { recursive: true, force: true }) }

// a aba existe na tela: menu, seção, título, código, botões, atalho e as duas rotas
const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
const web = readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
ok(ui.includes('data-target="view-revisoes"') && ui.includes('id="view-revisoes" class="view-section"') && ui.includes("'view-revisoes': { title: 'Revisões'"), 'a aba está no menu, tem a seção e o título')
ok(ui.includes("fetch('/api/revisoes')") && web.includes("url.pathname === '/api/revisoes'") && ui.includes("'/api/revisoes/aplicar'") && web.includes("url.pathname === '/api/revisoes/aplicar'"), 'a tela chama as duas rotas, e as duas existem no servidor')
ok(ui.includes('data-rev-revisar') && ui.includes("C2.tdr.orig = 'cartas'; c2TdrAbrir(") && ui.includes('data-rev-ensaio') && ui.includes('data-rev-aplicar'), 'os três botões: revisar um por um, ver o que muda, aplicar')
ok(/data-rev-aplicar="' \+ esc\(p\.raiz\) \+ '">Aplicar no código/.test(ui) && /r\.ensaio && r\.aplicadas\.length \?/.test(ui), 'o botão de aplicar só aparece depois de ver o que muda (ensaio primeiro)')
ok(web.includes('ensaio !== false') , 'o servidor trata qualquer coisa diferente de "false" como ensaio: gravar exige pedir de propósito')
ok(ui.includes("atalho('revisoes', 'R'") && ui.includes("revisoes: 'Revisões'"), 'a aba tem atalho no manual de atalhos')
console.log(`test-revisoes: ${n} verificações, 0 falhas`)
