// CC-987: cada aba do painel instalável como app separado
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ABAS, manifestoDaAba, htmlDaAba } from './src/appsAbas.mjs'

let n = 0
const t = (nome, fn) => { fn(); n++; console.log('  ok   ' + nome) }
const base = JSON.parse(readFileSync(new URL('./src/app.webmanifest', import.meta.url), 'utf8'))
const ui = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')

t('o app de sempre tem id próprio, para não colidir com os das abas', () => assert.equal(base.id, '/'))
t('cada aba tem id, início e escopo próprios, e nome com a aba', () => {
  const vistos = new Set()
  for (const k of Object.keys(ABAS)) {
    const m = manifestoDaAba(base, k)
    assert.equal(m.id, '/app/' + k); assert.equal(m.start_url, '/app/' + k); assert.equal(m.scope, '/app/' + k)
    assert.equal(m.short_name, ABAS[k].nome); assert.ok(!m.shortcuts, 'atalhos são do app de sempre')
    assert.ok(m.icons?.length, 'leva os ícones'); vistos.add(m.id)
  }
  assert.equal(vistos.size, Object.keys(ABAS).length)
})
t('aba desconhecida: nada (a rota responde 404)', () => {
  assert.equal(manifestoDaAba(base, 'nada'), null); assert.equal(htmlDaAba(ui, 'nada'), null); assert.equal(manifestoDaAba(base, 'toString'), null)
})
t('a página da aba aponta o manifesto dela e abre na tela dela', () => {
  const h = htmlDaAba(ui, 'sessoes')
  assert.ok(h.includes('<link rel="manifest" href="/app/sessoes.webmanifest">') && !h.includes('href="/app.webmanifest"'))
  assert.ok(h.includes("history.replaceState(null,'','#decisoes')"), 'Sessões abre por #decisoes; #sessoes cai na Início')
})
t('todo hash da lista é uma tela do menu ou um apelido conhecido', () => {
  for (const { hash } of Object.values(ABAS)) assert.ok(ui.includes('data-target="view-' + hash + '"') || ['projetos', 'armario'].includes(hash), hash)
})
// 07/10: o Chrome busca o manifesto sem o cookie de login; manifesto fora da lista da porta de entrada = 401 = "não é possível instalar"
t('a porta de entrada libera sem login o manifesto de toda aba instalável, e só ele', () => {
  const auth = readFileSync(new URL('./tools/porta-entrada/cockpit-auth.mjs', import.meta.url), 'utf8')
  const lista = JSON.parse(/const ABAS_INSTALAVEIS = (\[[^\]]*\])/.exec(auth)[1].replace(/'/g, '"'))
  assert.deepEqual([...lista].sort(), Object.keys(ABAS).sort())
  assert.ok(/ABAS_INSTALAVEIS\.map\(\(a\) => `\/app\/\$\{a\}\.webmanifest`\)/.test(auth), 'só o manifesto de cada aba, nunca a página /app/<aba>')
})
t('sem travessão', () => assert.ok(!/[—–]/.test(JSON.stringify(ABAS) + JSON.stringify(manifestoDaAba(base, 'caminho')))))
console.log(`test-apps: ${n} verificações, 0 falhas`)
