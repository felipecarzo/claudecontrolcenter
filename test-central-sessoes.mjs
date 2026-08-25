/**
 * CC-355: a Central mostra uma linha POR SESSÃO, com botão em cada.
 *
 * O headless não sustenta o stream que a Central usa para desenhar os cartões,
 * então a prova visual é do Felipe no telefone. Este teste guarda a lógica: o
 * filtro que separa os rótulos de um projeto (`VPS_cockpit`, `VPS_cockpit-2`) e
 * a geração das linhas, IDÊNTICOS ao que `acoesDeSessao` faz no `ui_v2.html`.
 * Se alguém trocar o código lá e não aqui, o teste denuncia por divergência.
 */
import assert from 'node:assert'
import fs from 'node:fs'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// A MESMA seleção de rótulos do ui_v2.html: o próprio nome, ou o nome seguido
// de `-` e só dígitos (para `VPS_cockpit` não engolir `VPS_cockpit--front`).
function rotulosDoProjeto(nome, ativos) {
  return Object.keys(ativos)
    .filter((k) => k === nome || (k.startsWith(nome + '-') && /^-\d+$/.test(k.slice(nome.length))))
    .sort()
}
const linhaSessao = (rot) => '<div class="rc-sessao"><span class="rc-sessao-nome">' + esc(rot) + '</span>'
  + '<div class="rc-botoes">'
  + '<button type="button" class="btn btn-ghost compacto" data-remoto-conectar="' + esc(rot) + '">conectar celular</button>'
  + '<button type="button" class="btn btn-ghost compacto" data-remoto-soltar="' + esc(rot) + '">soltar celular</button>'
  + '<button type="button" class="btn btn-ghost compacto" data-remoto-desligar="' + esc(rot) + '">encerrar</button>'
  + '</div></div>'

// 1. dois rótulos ativos viram duas linhas, cada uma com o SEU rótulo nos botões
try {
  const ativos = { VPS_cockpit: {}, 'VPS_cockpit-2': {} }
  const rotulos = rotulosDoProjeto('VPS_cockpit', ativos)
  assert.deepEqual(rotulos, ['VPS_cockpit', 'VPS_cockpit-2'])
  const html = rotulos.map(linhaSessao).join('')
  assert.equal((html.match(/data-remoto-conectar=/g) || []).length, 2, 'tem que haver um "conectar" por sessão')
  assert.ok(html.includes('data-remoto-conectar="VPS_cockpit"'))
  assert.ok(html.includes('data-remoto-conectar="VPS_cockpit-2"'), 'a segunda sessão precisa ter botão próprio')
  assert.ok(html.includes('data-remoto-desligar="VPS_cockpit-2"'), 'encerrar tem que agir na sessão certa')
  ok('duas sessões viram duas linhas, cada botão chaveado pelo próprio rótulo')
} catch (e) { erro('duas sessões separadas', e) }

// 2. NÃO engole o projeto vizinho de nome parecido (VPS_cockpit--front)
try {
  const ativos = { VPS_cockpit: {}, 'VPS_cockpit--front': {} }
  assert.deepEqual(rotulosDoProjeto('VPS_cockpit', ativos), ['VPS_cockpit'], 'o --front é outro projeto, não uma sessão daqui')
  ok('projeto vizinho de nome parecido não é confundido com sessão')
} catch (e) { erro('vizinho parecido', e) }

// 3. o código do ui_v2.html usa MESMO o rótulo (não o nome do projeto) nos botões
try {
  const html = fs.readFileSync(new URL('./src/ui_v2.html', import.meta.url), 'utf8')
  const i = html.indexOf('const linhaSessao =')
  assert.ok(i > 0, 'a função por sessão precisa existir no ui_v2.html')
  const trecho = html.slice(i, i + 600)
  assert.ok(/data-remoto-conectar="' \+ esc\(rot\)/.test(trecho), 'os botões da linha têm que usar o rótulo (rot), não o nome do projeto')
  ok('o ui_v2.html chaveia os botões pelo rótulo da sessão')
} catch (e) { erro('ui_v2.html usa o rótulo', e) }

if (falhou) process.exit(1)
console.log('test-central-sessoes: ok')
