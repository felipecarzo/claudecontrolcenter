/* CC-1066, MANUAL (fora do npm test): precisa do Chrome local, rode fora do sandbox.
   Sobe uma página de 1 arquivo, fotografa 3 cartas e confere os JPEGs e o sem_print. */
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { imprimir } from './src/printTextos.mjs'

const html = '<!doctype html><meta name=viewport content="width=device-width"><h1>Título da página</h1><p>Um parágrafo comum de teste.</p><button style="text-transform:uppercase">Quero saber mais</button><div style="height:1200px"></div>'
const form = '<!doctype html><meta name=viewport content="width=device-width"><h1>Lista</h1><form><input id=email><button type=button id=ok>Enviar</button></form><p id=msg></p><script>ok.onclick=async()=>{const v=email.value;if(!/@/.test(v)){msg.textContent="E-mail inválido";return}msg.textContent="Enviando";try{const r=await fetch("/api/enviar",{method:"POST"});msg.textContent=r.ok?"Enviado, obrigado":"Erro do servidor"}catch{msg.textContent="Sem rede"}}</script>'
const srv = http.createServer((q, s) => { s.setHeader('content-type', 'text/html; charset=utf-8'); s.end(q.url.startsWith('/form') ? form : html) })
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const link = `http://127.0.0.1:${srv.address().port}/pagina#x`
const linkForm = link.replace('/pagina#x', '/form')
const pasta = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'print-'))
fs.mkdirSync(path.join(pasta, 'docs', 'cartas'), { recursive: true })
const arq = path.join(pasta, 'docs', 'cartas', 'textos-teste.json')
fs.writeFileSync(arq, JSON.stringify({ titulo: 'Teste', cartas: [
  { id: 'achavel', titulo: 'a', link, editar: 'Um parágrafo comum de teste.' },
  { id: 'caixa-alta', titulo: 'b', link, editar: 'Quero saber mais' },
  { id: 'inexistente', titulo: 'c', link, editar: 'Isto não existe na página' },
  { id: 'erro-email', titulo: 'd', link: linkForm, editar: 'E-mail inválido' },
  { id: 'enviado', titulo: 'e', link: linkForm, editar: 'Enviado, obrigado' },
  { id: 'passo-ruim', titulo: 'f', link: linkForm, editar: 'Nunca aparece' },
  { id: 'sem-estado', titulo: 'g', link: linkForm, editar: 'E-mail inválido' },
] }))
fs.writeFileSync(path.join(pasta, 'docs', 'cartas', 'estados.json'), JSON.stringify({
  'erro-email': { passos: [{ preencher: { '#email': 'sem-arroba' } }, { clicar: '#ok' }] },
  enviado: { passos: [{ interceptar: { '**/api/enviar': { status: 200 } } }, { preencher: { '#email': 'a@b.c' } }, { clicar: '#ok' }, { esperar: 300 }] },
  'passo-ruim': { passos: [{ clicar: '#nao-existe' }] },
}))
try {
  const r = await imprimir({ baralhoArquivo: arq, pasta })
  const j = JSON.parse(fs.readFileSync(arq, 'utf8'))
  console.log(r)
  for (const id of ['achavel', 'caixa-alta']) {
    const c = j.cartas.find((x) => x.id === id)
    assert.ok(c.img, id + ' sem img')
    assert.ok(fs.statSync(path.join(pasta, c.img)).size > 1000, id + ' vazio')
  }
  assert.equal(j.cartas[2].sem_print, 'texto não achado na página')
  assert.ok(!j.cartas[2].img)
  for (const id of ['erro-email', 'enviado']) {
    const c = j.cartas.find((x) => x.id === id)
    assert.ok(c.img, id + ' sem img: ' + c.sem_print)
    assert.ok(fs.statSync(path.join(pasta, c.img)).size > 1000, id + ' vazio')
  }
  assert.equal(j.cartas.find((x) => x.id === 'passo-ruim').sem_print, 'passo do estado falhou: clicar #nao-existe')
  assert.equal(j.cartas.find((x) => x.id === 'sem-estado').sem_print, 'texto não achado na página') // sem estado, a página nova não tem o erro
  console.log('test-print-textos-navegador: ok', pasta)
} finally { srv.close() }
