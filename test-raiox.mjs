// CC-683: a leitura fixa do comando do cartão de permissão.
import assert from 'node:assert/strict'
import { raioX } from './src/raioX.mjs'

const textos = (c) => raioX(c).map((f) => f.texto).join(' | ')
const ssh = 'ssh -i $HOME/.ssh/id_x -o ConnectTimeout=20 root@72.60.140.91 "cd /opt/site-novo && (nohup docker compose build app > /tmp/b.log 2>&1 &) ; sleep 2"'
const r = raioX(ssh)
assert.match(textos(ssh), /outra máquina: 72\.60\.140\.91/)
assert.ok(r.find((f) => /root/.test(f.texto)).perigo, 'root é perigo')
assert.match(textos(ssh), /mexe em: \/opt\/site-novo/)
assert.match(textos(ssh), /constrói uma imagem Docker/)
assert.ok(!/\.ssh/.test(textos(ssh)), 'caminho da chave não aparece como pasta mexida')
const d = raioX('rm -rf /tmp/x && git push --force origin main')
assert.ok(d.find((f) => /rm -rf/.test(f.texto)).perigo)
assert.ok(d.find((f) => /forçado/.test(f.texto)).perigo)
assert.ok(!/envia commits/.test(d.map((f) => f.texto).join('|')), 'push forçado não repete o push comum')
assert.deepEqual(raioX(''), [])
assert.deepEqual(raioX('ls -la'), [])
console.log('test-raiox: ok')
