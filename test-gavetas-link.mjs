// CC-10: o menu do painel tem o link para as gavetas e o clique nele não é engolido pelo menu.
// Lê o HTML do painel como texto: não sobe servidor nem navegador.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const html = readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
const link = html.match(/<a [^>]*href="https:\/\/testedevoo\.carzo\.com\.br\/gavetas\/?"[^>]*data-externo="[^"]*"[^>]*>/)
assert.ok(link, 'falta o item Gavetas no menu lateral')
assert.match(link[0], /target="_blank"/)
assert.match(link[0], /rel="noopener"/)
assert.ok(!/data-target=/.test(link[0]), 'o item Gavetas não pode ter data-target (troca de tela)')

// O listener do menu sai antes de preventDefault para links externos.
const ordem = html.indexOf("if (item.dataset.externo) return;")
const cancela = html.indexOf('e.preventDefault();', html.indexOf('function setupNavigation'))
assert.ok(ordem > 0 && cancela > ordem, 'o menu precisa deixar o link externo seguir sozinho')

console.log('ok')
