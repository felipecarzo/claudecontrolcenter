// CC-1043: Coderoom em paridade com o app (servidor): modo plano e fila que sai sozinha.
// Nada de Claude de verdade: a decisão é função pura, e o fluxo roda com um agente falso numa casa temporária (CC_HOME).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-coderoom-app-'))
process.env.CC_HOME = casa
process.env.CC_SEM_NICE = '1'
process.env.CC_SEM_AGY = '1'
process.env.CC_SEM_FOTOS = '1'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const G = await import('./src/gate.mjs')
  const A = await import('./src/gateAgentes.mjs')
  const T = await import('./src/gateTurno.mjs')

  // ---- 1. modo plano: args do Claude
  const args = A.AGENTES_GATE.claude.args
  const base = { sessao: null, novaSessao: 'x', cwd: casa, conversa: 'c1' }
  const modo = (a) => a[a.indexOf('--permission-mode') + 1]
  ok(modo(args({ ...base, permissao: 'plano' })) === 'plan', 'permissão "plano" vira --permission-mode plan')
  ok(!args({ ...base, permissao: 'plano' }).includes('--settings'), 'plano não carrega o gancho de pergunte-antes')
  ok(modo(args({ ...base, permissao: 'acceptEdits' })) === 'acceptEdits', 'aceitar edições continua acceptEdits')
  ok(modo(args({ ...base, permissao: 'pergunteAntes' })) === 'default' && args({ ...base, permissao: 'pergunteAntes' }).includes('--settings'), 'manual continua default com o gancho')
  ok(modo(args({ ...base, permissao: 'acceptEdits', somenteLer: true })) === 'plan', 'modo Planejamento do projeto continua forçando plan')
  ok(modo(args({ ...base, permissao: 'plano', somenteLer: true })) === 'plan', 'plano e Planejamento juntos dão plan, uma vez só')
  // opencode e agy não recebem permissão nos args: plano ali não tem efeito e não quebra
  const semPlano = (ag) => { const a = A.AGENTES_GATE[ag].args({ modelo: null, cwd: casa, permissao: 'plano' }); return !a.includes('plan') && !a.some((x) => /plano|permission/.test(x)) }
  ok(semPlano('opencode') && semPlano('agy'), 'plano não muda os args do opencode nem do agy')

  // ---- 2. a rota de permissão (lida do fonte: subir o servidor inteiro traz rede e timers)
  const web = fs.readFileSync(new URL('./src/web.mjs', import.meta.url), 'utf8')
  const lista = web.match(/if \(!\[([^\]]*)\]\.includes\(permissao\)\)/)?.[1] || ''
  ok(/'plano'/.test(lista) && /'acceptEdits'/.test(lista) && /'pergunteAntes'/.test(lista), '/api/gate/permissao aceita os três valores')
  ok(!/bypass|auto/i.test(lista), '/api/gate/permissao continua recusando bypass e auto')
  ok(/naFila/.test(web.match(/url\.pathname === '\/api\/gate\/conversa'[\s\S]{0,1500}/)?.[0] || ''), 'GET /api/gate/conversa expõe naFila')

  // ---- 3. a decisão da fila (pura)
  const M = (...xs) => xs.map(([de, seq, extra]) => ({ de, seq, ...(de === 'claude' ? { turnoId: 't' + seq } : {}), ...(extra || {}) }))
  const msgs = M(['felipe', 1], ['claude', 2], ['felipe', 3], ['felipe', 4])
  ok(G.falasNaFila(msgs, 2).length === 2, 'falas depois do que foi entregue estão na fila')
  ok(G.falasNaFila(msgs, 4).length === 0, 'nada na fila quando tudo foi entregue')
  ok(G.falasNaFila(msgs, undefined).length === 2, 'conversa antiga (sem enviadoAte) usa a última resposta do agente como corte')
  const d = (extra) => G.decidirFila({ mensagens: msgs, enviadoAte: 2, estado: 'pronto', ...extra })
  ok(d().sai && d().falas.length === 2, 'turno pronto com fala na fila: sai')
  ok(!d({ estado: 'interrompido' }).sai, 'turno que falhou ou caiu não dispara')
  ok(!d({ parou: true }).sai, 'depois de "parar" dele não dispara')
  ok(!d({ arquivada: true }).sai, 'conversa arquivada não dispara')
  ok(!d({ emTurno: true }).sai, 'com outro turno em curso não dispara')
  ok(!d({ enviadoAte: 4 }).sai, 'fila vazia não dispara (sem laço: o turno que sai marca as falas como entregues)')

  // ---- 4. o fluxo todo, com agente falso
  const falso = path.join(casa, 'agente-falso.mjs')
  fs.writeFileSync(falso, `#!/usr/bin/env node
let e = ''; process.stdin.on('data', (d) => (e += d)).on('end', () => {
  const falas = e.split('\\n').filter((l) => l.startsWith('[Felipe]')).join(' | ')
  const dizer = () => { console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'resp: ' + falas }] } })); console.log(JSON.stringify({ type: 'result', subtype: 'success', duration_ms: 1, usage: {} })) }
  setTimeout(dizer, /lento/.test(e) ? 1500 : 0)
})`)
  fs.chmodSync(falso, 0o755)
  const { ehWindows } = await import('./src/platform.mjs')
  const bin = ehWindows ? falso.replace(/\.mjs$/, '.cmd') : falso
  if (ehWindows) fs.writeFileSync(bin, `@"${process.execPath}" "${falso}" %*\r\n`)

  const nova = (t) => G.criar({ titulo: t, projeto: 'p', cwd: casa }).id
  const respostas = (id) => G.lerConversa(id).mensagens.filter((m) => m.de === 'claude')
  const ate = async (cond, ms = 12000) => { for (let i = 0; i < ms / 200; i++) { if (cond()) return true; await espera(200) } return false }
  const manda = (id, texto) => T.responder(id, { texto, agente: 'claude', binario: bin })

  // 4a. fala durante o turno vivo sai sozinha, uma vez
  const a = nova('fila')
  manda(a, 'lento primeira')
  const guardado = manda(a, 'segunda fala')
  ok(guardado.guardado === true, 'fala com turno vivo é gravada e não dispara na hora')
  ok(T.naFilaDe(T.conversaAoVivo(a)) === 1, 'naFila conta 1 enquanto o turno está vivo')
  ok(await ate(() => respostas(a).length >= 2 && respostas(a).every((m) => m.estado === 'pronto')), 'terminado o turno, sai um turno novo sozinho')
  ok(/segunda fala/.test(respostas(a)[1].texto), 'o turno automático leva a fala que estava na fila')
  ok(G.lerConversa(a).mensagens.filter((m) => m.de === 'felipe').length === 2, 'a fala não é gravada duas vezes')
  await espera(1500)
  ok(respostas(a).length === 2 && T.naFilaDe(T.conversaAoVivo(a)) === 0, 'sem laço: não sai um terceiro turno e a fila fica em 0')

  // 4b. parar não dispara
  const b = nova('parar')
  manda(b, 'lento primeira')
  manda(b, 'não sai')
  await espera(400)
  T.parar(b)
  await espera(2500)
  ok(respostas(b).length === 1 && respostas(b)[0].estado === 'interrompido', 'depois de parar, a fala na fila não dispara sozinha')

  // 4c. conversa arquivada não dispara
  const c = nova('arquivada')
  manda(c, 'lento primeira')
  manda(c, 'não sai')
  G.gravarCabecalho(c, { arquivada: true })
  ok(await ate(() => respostas(c).length >= 1 && respostas(c)[0].estado === 'pronto'), 'o turno da conversa arquivada termina')
  await espera(1500)
  ok(respostas(c).length === 1, 'conversa arquivada não dispara a fila')
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}

console.log(`\n${n} verificações ok`)
process.exit(0)
