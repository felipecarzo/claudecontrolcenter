/** CC-1068, M4: a tela chama a rota do Regente e o botão existe; o script do timer tem sintaxe válida. Só leitura. */
import assert from 'node:assert'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
const html = fs.readFileSync(new URL('./src/ui_cockpit2.html', import.meta.url), 'utf8')
let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok   ' + m) }
ok(html.includes("'/api/regente'"), "a tela faz POST em '/api/regente'")
ok(html.includes("'/api/regente?cwd='"), "a tela lê GET '/api/regente?cwd='")
ok(html.includes('ligar o Regente') && html.includes('desligar o Regente'), 'os dois botões existem')
ok(html.includes('data-regente-alternar'), 'o botão tem o gancho do clique')
ok(html.includes('O Regente decide sozinho e não para'), 'ligar pede confirmação')
ok(html.includes('Regente ligado'), 'a conversa do Arquiteto tem a pílula')
execFileSync('bash', ['-n', new URL('./tools/plantao/regente.sh', import.meta.url).pathname])
ok(true, 'bash -n regente.sh')
console.log(`\n${n} verificações`)
