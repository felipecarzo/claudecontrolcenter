// CC-1041: o Claude Code de verdade dentro do painel. Trava as três ligações que, soltas, deixam a peça inalcançável sem erro.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }
const ler = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
const ui = ler('./src/ui_cockpit2.html'), web = ler('./src/web.mjs'), c2 = ler('./src/cockpit2.mjs')

ok(/function portaRepasse\(id\) \{ return id === 'claude' \? PORTA_CLAUDE : portaDe\(id\) \}/.test(web) && web.includes('export const PORTA_CLAUDE = 5185'), 'o repasse conhece o terminal do Claude na porta 5185')
ok((web.match(/const porta = portaRepasse\(partes\[1\]\)/g) || []).length === 2, 'a página E a conexão ao vivo passam pelo repasse (sem a segunda, o terminal abre preto)')
ok(c2.includes('tmuxDaConversa.set(s.conversa, s.sessao)') && /s\.tmux = tmuxDaConversa\.get/.test(c2), 'cada sessão do painel leva o nome do terminal onde roda')
ok(ui.includes('function c2Terminal(arg, titulo)') && ui.includes("'/painel/claude/?arg=' + encodeURIComponent(arg)"), 'a tela abre o terminal pelo repasse, com o argumento escapado')
const botoes = (ui.match(/data-claude-term="' \+ esc\(/g) || []).length
ok(botoes >= 3, 'há botão de terminal no cartão da sessão, em cada sessão do projeto e no projeto sem sessão (achados: ' + botoes + ')')
const slug = (r) => 'cc-remote-' + String(r).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)
ok(ler('./src/remotecontrol.mjs').includes("const slug = (projeto) => PREFIXO_SESSAO + String(projeto).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)") && ui.includes("return 'cc-remote-' + String(rotulo).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50)") && slug('VPS_cockpit-2') === 'cc-remote-VPS_cockpit-2', 'a tela monta o nome do terminal igual ao servidor')
console.log(`test-terminal-claude: ${n} verificações, 0 falhas`)
