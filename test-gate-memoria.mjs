/* CC-698 e CC-697: memória do opencode no Coderoom e o sinal do turno aberto.
 *
 * Roda numa casa temporária (CC_HOME): teste que escreve em dado real dele é
 * defeito, mesmo com restauração no fim. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-gate-mem-'))
process.env.CC_HOME = casa
process.env.CC_SILENCIO_MS = '1500' // CC-803: o vigia de silêncio, com limite de teste
process.env.CC_LIMITE_CONTEXTO = '50000' // CC-813: o limite de contexto, com valor de teste
// CC-731: turno de mentira que termina "pronto" não pode pedir nome ao agy de verdade
process.env.CC_SEM_AGY = '1'
// CC-743: nem build nem foto de verdade dentro do teste
process.env.CC_SEM_FOTOS = '1'
const G = await import('./src/gate.mjs')
const A = await import('./src/gateAgentes.mjs')

let ok = 0
const passa = (nome, fn) => { fn(); ok++; console.log('  ok', nome) }

try {
  const { id } = G.criar({ titulo: 't', projeto: 'p', cwd: casa })
  G.acrescentar(id, { tipo: 'dele', texto: 'primeira' })
  G.acrescentar(id, { tipo: 'turno', turnoId: 'a', agente: 'opencode' })
  G.acrescentar(id, { tipo: 'pedaco', turnoId: 'a', texto: 'resposta do opencode' })
  G.acrescentar(id, { tipo: 'fim', turnoId: 'a', estado: 'pronto' })
  const ate = G.lerConversa(id).ultimoSeq
  G.gravarCabecalho(id, { sessoes: { opencode: 'ses_x', agy: 'conv_y' } })
  G.marcarLido(id, 'opencode', ate)
  G.marcarLido(id, 'agy', ate)
  G.acrescentar(id, { tipo: 'dele', texto: 'segunda' })

  passa('opencode com sessao recebe so o que falta', () => {
    const d = G.deltaPara(id, 'opencode')
    assert.ok(d.texto.includes('segunda'))
    assert.ok(!d.texto.includes('primeira'))
    assert.ok(!d.texto.includes('resposta do opencode'))
  })
  passa('CC-716: opencode em flash recebe a conversa inteira e vai pelo servidor, sem sessao', () => {
    const d = G.deltaPara(id, 'opencode', { semMemoria: true })
    assert.ok(d.texto.includes('primeira') && d.texto.includes('segunda'))
    const a = A.AGENTES_GATE.opencode.args({ flash: true, sessao: 'ses_x', cwd: '/p/proj' })
    assert.deepEqual(a.slice(a.indexOf('--attach'), a.indexOf('--attach') + 4), ['--attach', A.OC_URL, '--dir', '/p/proj'])
    assert.ok(!a.includes('--session'))
  })
  passa('CC-718: modo avulso recebe so a ultima mensagem dele', () => {
    const d = G.deltaPara(id, 'opencode', { semMemoria: true, soUltima: true })
    assert.ok(d.texto.includes('segunda'))
    assert.ok(!d.texto.includes('primeira') && !d.texto.includes('resposta do opencode'))
  })
  const Pk = await import('./src/gatePacote.mjs')
  passa('CC-742: regras de design lidas do arquivo delas, mapa e conferencia', () => {
    const arq = path.join(casa, 'regras.md')
    fs.writeFileSync(arq, '## Mapa\n\n| # | regra | f |\n|---|---|---|\n| 1 | Nada surge do nada | m |\n| 2 | Cor nunca fala sozinha | l |\n\n## Conferência antes de dizer que terminou\n\n1. Cliquei em tudo.\n2. Olhei em cinza.\n')
    const s = Pk.secaoDesign(arq)
    assert.ok(s.linhas.some((l) => l.includes('1. Nada surge do nada')))
    assert.ok(s.linhas.some((l) => l.includes('☐ Olhei em cinza.')))
    assert.equal(Pk.secaoDesign(path.join(casa, 'nao-existe.md')), null)
  })
  const F = await import('./src/gateFotos.mjs')
  const Tu = await import('./src/gateTurno.mjs')
  passa('CC-743: so resposta que mexe em arquivo de tela pede fotos', () => {
    assert.equal(F.mexeuEmTela([{ nome: 'edit', alvo: 'src/components/Hero.jsx' }]), true)
    assert.equal(F.mexeuEmTela([{ nome: 'Edit', caminho: '/p/src/index.css' }]), true)
    assert.equal(F.mexeuEmTela([{ nome: 'Bash', alvo: 'npm run build' }, { nome: 'edit', alvo: 'README.md' }]), false)
  })
  passa('CC-797: o explorador nunca toca no que sai, apaga ou zera, e toca no resto', () => {
    for (const t of ['Sair do sistema', 'Limpar registro', 'Excluir contrato', 'Apagar', 'Logout', 'Abrir menu', 'Recolher menu']) assert.ok(F.NAO_TOCAR.test(t), t)
    for (const t of ['Registro', 'Contratos', 'Manutencao de frota', 'Ler como contratado']) assert.ok(!F.NAO_TOCAR.test(t), t)
  })
  const Cfg = await import('./src/config.mjs') // casa temporária (CC_HOME)
  passa('CC-797: login de teste por projeto: grava, le, e usuario vazio apaga', () => {
    assert.deepEqual(Cfg.setAcessoTeste('/p/x', { usuario: ' felipe ', senha: '1234' }), { usuario: 'felipe', senha: '1234' })
    assert.equal(Cfg.acessoTesteDe('/p/outro'), null)
    assert.equal(Cfg.setAcessoTeste('/p/x', { usuario: '' }), null)
  })
  passa('CC-744: o pedido do revisor visual leva os caminhos das fotos e o formato da resposta', () => {
    const p = Tu.pedidoDeRevisaoVisual('opencode', 'mudei o hero', ['/x/celular.jpg', '/x/computador.jpg'])
    assert.ok(p.includes('/x/celular.jpg') && p.includes('REVISÃO OK') && p.includes('mudei o hero'))
  })
  passa('revisao: veredito vale em qualquer linha, e problema so quando escrito', () => {
    assert.equal(Tu.revisaoAprovou('Vou ler as fotos.\nREVISÃO OK\nTudo certo.'), true)
    assert.equal(Tu.revisaoAprovou('REVISÃO: PROBLEMAS\n- play em cima do texto'), false)
    assert.equal(Tu.revisaoAprovou('olhei e achei estranho'), false)
  })
  passa('texto repetido do Claude (resposta de novo por trava de fim) entra uma vez', () => {
    const log = path.join(casa, 'dup.jsonl')
    const a = (t) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: t }] } })
    fs.writeFileSync(log, [a('Vou ler. '), a('REVISÃO OK'), a('REVISÃO OK')].join('\n') + '\n')
    assert.equal(A.lerTurno(log, 'claude').texto, 'Vou ler. REVISÃO OK')
  })
  passa('pedacos de texto do opencode nao saem grudados (print de 30/09)', () => {
    const log = path.join(casa, 'cola.jsonl')
    const t = (x) => JSON.stringify({ type: 'text', part: { text: x } })
    fs.writeFileSync(log, [t('antes de mexer.'), t('O nome do arquivo estava errado.')].join('\n') + '\n')
    assert.equal(A.lerTurno(log, 'opencode').texto, 'antes de mexer.\n\nO nome do arquivo estava errado.')
  })
  passa('comando do opencode entra no alvo, e a cobranca ve o navegador usado', () => {
    const log = path.join(casa, 'oc-cmd.jsonl')
    fs.writeFileSync(log, JSON.stringify({ type: 'tool_use', part: { tool: 'bash', state: { input: { command: 'cd /tmp/x && node heroshot.cjs # chrome cdp 9333' } } } }) + '\n')
    const r = A.lerTurno(log, 'opencode')
    assert.match(r.ferramentas[0].alvo, /heroshot/)
    const { id: ic2 } = G.criar({ titulo: 'c2', projeto: 'p', cwd: casa })
    assert.equal(Tu.cobrarConferencia(ic2, { texto: 'Conferi no navegador.', ferramentas: r.ferramentas }), false)
  })
  passa('CC-745: disse que conferiu no navegador sem usar navegador ganha aviso; usando, nao', () => {
    const { id: ic } = G.criar({ titulo: 'c', projeto: 'p', cwd: casa })
    assert.equal(Tu.cobrarConferencia(ic, { texto: 'Pronto, reconfiro no navegador depois.', ferramentas: [{ nome: 'bash', alvo: 'npm run build' }] }), true)
    assert.equal(Tu.cobrarConferencia(ic, { texto: 'Conferi no navegador.', ferramentas: [{ nome: 'mcp__chrome__screenshot' }] }), false)
    assert.equal(Tu.cobrarConferencia(ic, { texto: 'Mudei a cor.', ferramentas: [] }), false)
    assert.ok(G.lerConversa(ic).mensagens.some((m) => /não usou navegador/.test(m.texto || '')))
  })
  passa('CC-745/746: portugues, microtarefas e nao prometer conferencia vao no contexto', () => {
    const t = Pk.montar({ cwd: casa, projeto: 'p' }, { jobs: [] }).texto
    assert.match(t, /sempre em português/); assert.match(t, /microtarefas/); assert.match(t, /Não diga que conferiu/)
  })
  passa('agy, mesmo com id guardado, recebe a conversa inteira', () => {
    const d = G.deltaPara(id, 'agy')
    assert.ok(d.texto.includes('primeira') && d.texto.includes('segunda'))
  })

  passa('o id da sessao do opencode sai da resposta e vai no --session', () => {
    const log = path.join(casa, 'oc.jsonl')
    fs.writeFileSync(log, JSON.stringify({ type: 'text', sessionID: 'ses_abc', part: { text: 'OK' } }) + '\n')
    assert.equal(A.lerTurno(log, 'opencode').sessao, 'ses_abc')
    const args = A.AGENTES_GATE.opencode.args({ sessao: 'ses_abc' })
    assert.deepEqual(args.slice(args.indexOf('--session'), args.indexOf('--session') + 2), ['--session', 'ses_abc'])
  })
  passa('turno do opencode fecha pronto no step_finish com reason stop, somando o gasto', () => {
    const log = path.join(casa, 'oc-fim.jsonl')
    const fim = (reason, input) => JSON.stringify({ type: 'step_finish', sessionID: 's', part: { reason, cost: 0, tokens: { input, output: 2, cache: { read: 10, write: 0 } } } })
    fs.writeFileSync(log, fim('tool-calls', 100) + '\n')
    assert.equal(A.lerTurno(log, 'opencode').terminou, false)
    fs.appendFileSync(log, fim('stop', 50) + '\n')
    const r = A.lerTurno(log, 'opencode')
    assert.equal(r.estado, 'pronto')
    assert.equal(r.custo.entrada, 150)
  })
  passa('CC-739: pasta recusada pelo opencode e lida da saida de erro, sem cor', () => {
    const log = path.join(casa, 'oc-pasta.jsonl'); const err = path.join(casa, 'oc-pasta.err')
    fs.writeFileSync(log, ''); fs.writeFileSync(err, '\x1b[93m\x1b[1m! \x1b[0mpermission requested: external_directory (/tmp/*, /home/x/*); auto-rejecting\n')
    const r = A.lerTurno(log, 'opencode', err)
    assert.deepEqual(r.pastasRecusadas, ['/tmp/*', '/home/x/*'])
    assert.ok(!/\x1b/.test(r.erro || ''))
  })
  passa('sessao perdida do opencode e detectada', () => {
    const log = path.join(casa, 'oc2.jsonl'); const err = path.join(casa, 'oc2.err')
    fs.writeFileSync(log, ''); fs.writeFileSync(err, 'Error: Session not found\n')
    assert.equal(A.lerTurno(log, 'opencode', err).sessaoPerdida, true)
  })

  passa('turno aberto informa a hora do ultimo sinal', () => {
    const log = path.join(casa, 'vivo.jsonl'); fs.writeFileSync(log, '{}\n')
    G.gravarCabecalho(id, { estado: { turnoId: 'b', logFile: log } })
    const s = G.lerConversa(id).sinalEm
    assert.ok(Number.isFinite(s) && Math.abs(Date.now() - s) < 60000)
    G.gravarCabecalho(id, { estado: null })
    assert.equal(G.lerConversa(id).sinalEm, null)
  })
  /* CC-700: agente que sobreviveu ao reinício volta a ser acompanhado. */
  const T = await import('./src/gateTurno.mjs')
  const { id: id2 } = G.criar({ titulo: 't2', projeto: 'p', cwd: casa })
  G.acrescentar(id2, { tipo: 'dele', texto: 'oi' })
  G.acrescentar(id2, { tipo: 'turno', turnoId: 'r1', agente: 'claude' })
  const logR = path.join(casa, 'sobrevivente.jsonl')
  fs.writeFileSync(logR, [
    { type: 'assistant', message: { content: [{ type: 'text', text: 'terminei depois do reinicio' }] } },
    { type: 'result', subtype: 'success', session_id: 'sess-r', duration_ms: 1000, usage: {} },
  ].map((o) => JSON.stringify(o)).join('\n') + '\n')
  G.gravarCabecalho(id2, { estado: { turnoId: 'r1', agente: 'claude', pid: process.pid, desde: Date.now(), logFile: logR, ate: 1 } })
  assert.equal(T.retomar(id2), true)
  passa('o turno grava revisar e semMemoria, para a retomada nao perder (medido na simulacao de 30/09)', () => {
    const fonte = fs.readFileSync('./src/gateTurno.mjs', 'utf8')
    assert.match(fonte, /ate: delta\.ate, revisar, semMemoria: flash \}/)
  })
  await new Promise((r) => setTimeout(r, 900))
  passa('turno retomado depois do reinicio fecha pronto, com o texto e a sessao', () => {
    const c = G.lerConversa(id2)
    const m = c.mensagens.find((x) => x.turnoId === 'r1')
    assert.equal(m.estado, 'pronto'); assert.equal(m.texto, 'terminei depois do reinicio')
    assert.equal(c.turnoAberto, null); assert.equal(c.cabecalho.sessoes.claude, 'sess-r')
  })
  /* CC-701: revisão em dupla, com um agente de mentira que responde pelo texto. */
  const falso = path.join(casa, 'agente-falso.mjs')
  fs.writeFileSync(falso, `#!/usr/bin/env node
let e = ''; process.stdin.on('data', (d) => (e += d)).on('end', () => {
  const t = /pediu REVISÃO/.test(e) ? (/\\[ok\\]/.test(e) ? 'REVISÃO OK, atende.' : 'REVISÃO: PROBLEMAS\\n- faltou o teste')
    : /revisou sua última resposta/.test(e) ? 'corrigido' : 'feito ' + (e.match(/\\[ok\\]/) ? '[ok]' : '')
  console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: t }] } }))
  console.log(JSON.stringify({ type: 'result', subtype: 'success', duration_ms: 1, usage: {} }))
})`)
  fs.chmodSync(falso, 0o755)
  /* No Windows um .mjs não roda como programa (achado por baa1393b: este
     bloco reprovava no PC e barrava a publicação). O Coderoom lá dispara por
     `cmd /c`, então um .cmd que chama o Node com o falso resolve. */
  const { ehWindows } = await import('./src/platform.mjs')
  const binFalso = ehWindows ? falso.replace(/\.mjs$/, '.cmd') : falso
  if (ehWindows) fs.writeFileSync(binFalso, `@"${process.execPath}" "${falso}" %*\r\n`)
  // CC-755: o revisor sai da configuração; aqui, o agy (casa temporária)
  const Cf = await import('./src/config.mjs')
  Cf.setRevisor({ principal: { agente: 'agy' }, reserva: null })
  const rodar = async (texto) => {
    const { id: cid } = G.criar({ titulo: 'rev', projeto: 'p', cwd: casa })
    T.responder(cid, { texto, agente: 'claude', binario: binFalso, revisar: true })
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 200))
      const c = G.lerConversa(cid)
      if (!c.turnoAberto && c.mensagens.length >= 4 && i > 10) return c.mensagens
    }
    return G.lerConversa(cid).mensagens
  }
  const comProblema = await rodar('faça a coisa')
  passa('revisao que aponta problema volta UMA vez ao autor, e ele corrige', () => {
    const agentes = comProblema.filter((m) => m.de !== 'felipe' && m.de !== 'sistema').map((m) => `${m.de}:${m.texto.split('\n')[0]}`)
    assert.deepEqual(agentes, ['claude:feito ', 'agy:REVISÃO: PROBLEMAS', 'claude:corrigido'])
  })
  const aprovada = await rodar('faça a coisa [ok]')
  passa('revisao OK encerra ali, sem volta ao autor', () => {
    const agentes = aprovada.filter((m) => m.de !== 'felipe' && m.de !== 'sistema').map((m) => m.de)
    assert.deepEqual(agentes, ['claude', 'agy'])
  })
  /* CC-796: um agente que cai no meio (escreve e sai sem o "fim") e, pedido
     para continuar, termina. O lento cai devagar, para dar tempo de parar. */
  const caidor = path.join(casa, 'agente-caidor.mjs')
  fs.writeFileSync(caidor, `#!/usr/bin/env node
let e = ''; process.stdin.on('data', (d) => (e += d)).on('end', () => {
  const dizer = (t) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: t }] } }))
  if (/caiu no meio/.test(e)) { dizer('continuei'); console.log(JSON.stringify({ type: 'result', subtype: 'success', duration_ms: 1, usage: {} })); return }
  dizer('comecei'); setTimeout(() => process.exit(0), /devagar/.test(e) ? 3000 : 0)
})`)
  fs.chmodSync(caidor, 0o755)
  const binCaidor = ehWindows ? caidor.replace(/\.mjs$/, '.cmd') : caidor
  if (ehWindows) fs.writeFileSync(binCaidor, `@"${process.execPath}" "${caidor}" %*\r\n`)
  const rodarCaidor = async (texto, pararEm) => {
    const { id: cid } = G.criar({ titulo: 'queda', projeto: 'p', cwd: casa })
    T.responder(cid, { texto, agente: 'claude', binario: binCaidor })
    if (pararEm) { await new Promise((r) => setTimeout(r, pararEm)); T.parar(cid) }
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 200))
      const c = G.lerConversa(cid)
      if (!c.turnoAberto && i > 15) return c.mensagens
    }
    return G.lerConversa(cid).mensagens
  }
  const caiu = await rodarCaidor('faça')
  passa('CC-796: queda sem ordem dele e retomada UMA vez, de onde parou', () => {
    const agentes = caiu.filter((m) => m.de === 'claude').map((m) => `${m.texto}:${m.estado}`)
    assert.deepEqual(agentes, ['comecei:interrompido', 'continuei:pronto'])
    assert.ok(caiu.some((m) => m.de === 'sistema' && /caiu no meio/.test(m.texto)))
  })
  const parado = await rodarCaidor('faça devagar', 1200)
  passa('CC-796: parar pela mao nao retoma', () => {
    assert.deepEqual(parado.filter((m) => m.de === 'claude').map((m) => m.estado), ['interrompido'])
  })
  /* CC-803: o prumo, que segura o modelo no projeto. */
  const Pr = await import('./src/gatePrumo.mjs')
  const ctxPr = { cwd: '/home/u/projetos/VPS_jogo', home: '/home/u', liberadas: [] }
  passa('CC-803: leituras demais sem escrever barram; escrever zera a conta; ferramenta neutra nao conta', () => {
    const est = Pr.novoEstado()
    for (let i = 1; i < Pr.LIMITE_LEITURAS; i++) assert.equal(Pr.avaliar(est, 'read', { filePath: `/home/u/projetos/VPS_jogo/a${i}.js` }, ctxPr).bloquear, false, 'leitura ' + i)
    Pr.avaliar(est, 'todowrite', {}, ctxPr) // neutra: não conta
    const b = Pr.avaliar(est, 'grep', { pattern: 'x' }, ctxPr)
    assert.equal(b.bloquear, true); assert.equal(b.regra, 'rodeio'); assert.match(b.motivo, /leituras seguidas/)
    assert.equal(Pr.avaliar(est, 'write', { filePath: 'x' }, ctxPr).bloquear, false)
    assert.equal(est.leituras, 0, 'escrever zera')
    assert.equal(Pr.avaliar(Pr.novoEstado(), 'bash', { command: 'mkdir -p src && npm install' }, ctxPr).bloquear, false)
  })
  passa('CC-803: o mesmo comando 3 vezes barra', () => {
    const est = Pr.novoEstado()
    assert.equal(Pr.avaliar(est, 'bash', { command: 'cat a.txt' }, ctxPr).bloquear, false)
    assert.equal(Pr.avaliar(est, 'bash', { command: 'cat a.txt' }, ctxPr).bloquear, false)
    assert.equal(Pr.avaliar(est, 'bash', { command: 'cat a.txt' }, ctxPr).regra, 'repeticao')
  })
  passa('CC-803: bash fora do projeto barra, e o permitido passa', () => {
    const f = (cmd, c = ctxPr) => Pr.avaliar(Pr.novoEstado(), 'bash', { command: cmd }, c)
    assert.equal(f('cat /home/u/.config/testedevoo/projetos.txt').regra, 'fora')
    assert.equal(f('ls ~/projetos/VPS_outro').regra, 'fora')
    assert.equal(f('cat $HOME/.ssh/id_rsa').regra, 'fora')
    assert.equal(f('~/dev.sh sim-jogo').bloquear, false, 'o endereço de teste é permitido')
    assert.equal(f('tail -n 30 ~/logs/sim-jogo.log').bloquear, false, 'o log também')
    assert.equal(f('cd /home/u/projetos/VPS_jogo && npm run build').bloquear, false, 'o próprio projeto')
    assert.equal(f('cat /tmp/x.txt && ls /usr/bin').bloquear, false, 'fora da casa não é assunto daqui')
    assert.equal(f('cat /tmp2/x', { ...ctxPr, liberadas: ['/home/u/projetos/VPS_outro'] }).bloquear, false)
    assert.equal(f('ls /home/u/projetos/VPS_outro', { ...ctxPr, liberadas: ['/home/u/projetos/VPS_outro'] }).bloquear, false, 'pasta que ele liberou')
    assert.equal(f('cat /home/u/.ssh/id_rsa', { ...ctxPr, liberadas: ['/home/u'] }).regra, 'fora', 'liberar a casa inteira não desliga a regra')
  })
  const plugPr = await import('./hooks/opencode-prumo.mjs')
  passa('CC-803: a decisão nunca lança, e o plugin exporta só o plugin', () => {
    assert.equal(Pr.avaliar(null, 'bash', { command: 'ls' }, ctxPr).bloquear, false, 'estado quebrado falha aberto')
    assert.deepEqual(Object.keys(plugPr), ['Prumo'], 'o opencode chama toda função exportada como plugin')
  })
  passa('CC-807: o endereço de teste do projeto sai do mapa do dev.sh, pela pasta', () => {
    const mapa = path.join(casa, 'dev-projetos.json')
    fs.writeFileSync(mapa, JSON.stringify({ jogo: { porta: 5294, dir: '/p/VPS_jogo' }, mono: { porta: 5195, dir: '/p/mono/apps/web' } }))
    process.env.CC_DEV_MAPA = mapa
    assert.deepEqual(F.enderecoDe('/p/VPS_jogo'), { nome: 'jogo', url: 'https://testedevoo.carzo.com.br/jogo/' })
    assert.equal(F.enderecoDe('/p/mono').nome, 'mono', 'conversa na raiz do monorepo acha o app que está no ar')
    assert.equal(F.enderecoDe('/p/VPS_jogo/src').nome, 'jogo', 'e dentro de uma subpasta')
    assert.equal(F.enderecoDe('/p/outro'), null, 'projeto que não está no ar não tem endereço')
    process.env.CC_DEV_MAPA = path.join(casa, 'nao-existe.json')
    assert.equal(F.enderecoDe('/p/VPS_jogo'), null, 'sem mapa não quebra')
  })
  /* CC-803: resposta vazia. Um opencode que roda uma ferramenta e termina sem
     escrever nada é pedido a resumir, uma vez; o que escreve normalmente, não. */
  const calado = path.join(casa, 'opencode-calado.mjs')
  fs.writeFileSync(calado, `#!/usr/bin/env node
let e = ''; process.stdin.on('data', (d) => (e += d)).on('end', () => {
  const fim = () => { console.log(JSON.stringify({ type: 'step_finish', part: { reason: 'stop', tokens: {} } })); process.exit(0) }
  if (/terminou sem escrever nada/.test(e)) { console.log(JSON.stringify({ type: 'text', part: { type: 'text', text: 'Fiz o ajuste.' } })); return fim() }
  console.log(JSON.stringify({ type: 'tool_use', part: { type: 'tool', tool: 'bash', state: { status: 'completed', input: { command: 'ls' }, output: 'x' } } }))
  fim()
})`)
  fs.chmodSync(calado, 0o755)
  const binCalado = ehWindows ? calado.replace(/\.mjs$/, '.cmd') : calado
  if (ehWindows) fs.writeFileSync(binCalado, `@"${process.execPath}" "${calado}" %*\r\n`)
  const { id: cidCalado } = G.criar({ titulo: 'calado', projeto: 'p', cwd: casa })
  T.responder(cidCalado, { texto: 'faça', agente: 'opencode', binario: binCalado })
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 200)); const c = G.lerConversa(cidCalado); if (!c.turnoAberto && i > 12 && c.mensagens.filter((m) => m.de === 'opencode').length >= 2) break }
  const msgsCalado = G.lerConversa(cidCalado).mensagens
  passa('CC-803: agente que trabalha e termina sem escrever nada e pedido a resumir, UMA vez', () => {
    assert.deepEqual(msgsCalado.filter((m) => m.de === 'opencode').map((m) => (m.texto || '') + ':' + m.estado), [':pronto', 'Fiz o ajuste.:pronto'])
    assert.equal(msgsCalado.filter((m) => m.de === 'sistema' && /terminou sem escrever nada/.test(m.texto)).length, 1)
  })
  /* CC-813: sessão do opencode grande demais é trocada por uma nova, levando a
     conversa em transcrição. O falso fala "vi o historico" só se o pedido
     trouxer os DOIS pedidos: com a sessão mantida, o 2º chegaria sozinho. */
  const grande = path.join(casa, 'opencode-grande.mjs')
  fs.writeFileSync(grande, `#!/usr/bin/env node
let e = ''; process.stdin.on('data', (d) => (e += d)).on('end', () => {
  const ve = e.includes('primeiro pedido') && e.includes('segundo pedido')
  console.log(JSON.stringify({ type: 'text', sessionID: 'ses_fake', part: { type: 'text', text: ve ? 'vi o historico' : 'ok' } }))
  console.log(JSON.stringify({ type: 'step_finish', sessionID: 'ses_fake', part: { reason: 'stop', tokens: { input: 90000, output: 5, cache: { read: 0, write: 0 } } } }))
  process.exit(0)
})`)
  fs.chmodSync(grande, 0o755)
  const binGrande = ehWindows ? grande.replace(/\.mjs$/, '.cmd') : grande
  if (ehWindows) fs.writeFileSync(binGrande, `@"${process.execPath}" "${grande}" %*\r\n`)
  const { id: cidGrande } = G.criar({ titulo: 'grande', projeto: 'p', cwd: casa })
  const esperaFim = async () => { for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 200)); if (!G.lerConversa(cidGrande).turnoAberto && i > 8) return } }
  T.responder(cidGrande, { texto: 'primeiro pedido', agente: 'opencode', binario: binGrande }); await esperaFim()
  const contextoGuardado = G.lerConversa(cidGrande).cabecalho.contextoOpencode
  T.responder(cidGrande, { texto: 'segundo pedido', agente: 'opencode', binario: binGrande }); await esperaFim()
  const msgsGrande = G.lerConversa(cidGrande).mensagens
  passa('CC-813: contexto acima do limite troca a sessao e leva o historico em transcricao', () => {
    assert.equal(contextoGuardado, 90000, 'o tamanho da sessão fica guardado ao fim da resposta')
    assert.deepEqual(msgsGrande.filter((m) => m.de === 'opencode').map((m) => m.texto), ['ok', 'vi o historico'])
    assert.ok(msgsGrande.some((m) => m.de === 'sistema' && /conversa nova com o opencode.*90 mil tokens/.test(m.texto)), 'a conversa conta o motivo')
  })
  /* CC-803: o vigia de silêncio. Um opencode que escreve uma linha e fica mudo
     é parado e pedido a retomar; o que pede para agir termina normalmente. */
  const mudo = path.join(casa, 'opencode-mudo.mjs')
  fs.writeFileSync(mudo, `#!/usr/bin/env node
let e = ''; process.stdin.on('data', (d) => (e += d)).on('end', () => {
  const fim = (t) => { console.log(JSON.stringify({ type: 'text', part: { type: 'text', text: t } })); console.log(JSON.stringify({ type: 'step_finish', part: { reason: 'stop', tokens: {} } })); process.exit(0) }
  if (/sem agir/.test(e)) return fim('retomei')
  console.log(JSON.stringify({ type: 'text', part: { type: 'text', text: 'comecei' } }))
  setTimeout(() => process.exit(0), 20000)
})`)
  fs.chmodSync(mudo, 0o755)
  const binMudo = ehWindows ? mudo.replace(/\.mjs$/, '.cmd') : mudo
  if (ehWindows) fs.writeFileSync(binMudo, `@"${process.execPath}" "${mudo}" %*\r\n`)
  const { id: cidMudo } = G.criar({ titulo: 'mudo', projeto: 'p', cwd: casa })
  T.responder(cidMudo, { texto: 'faça', agente: 'opencode', binario: binMudo })
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 200)); const c = G.lerConversa(cidMudo); if (!c.turnoAberto && i > 20 && c.mensagens.filter((m) => m.de === 'opencode').length >= 2) break }
  const msgsMudo = G.lerConversa(cidMudo).mensagens
  passa('CC-803: agente calado alem do limite e parado e pedido a retomar UMA vez', () => {
    assert.deepEqual(msgsMudo.filter((m) => m.de === 'opencode').map((m) => `${m.texto}:${m.estado}`), ['comecei:interrompido', 'retomei:pronto'])
    assert.ok(msgsMudo.some((m) => m.de === 'sistema' && /sem sinal.*prumo parou/.test(m.texto)), 'a conversa conta o que aconteceu')
  })
  /* CC-805: o opencode PARA sozinho quando a pasta é recusada. Isso não é queda:
     tem de virar pedido de pasta, e não o "continue de onde parou". */
  const recusador = path.join(casa, 'opencode-recusador.mjs')
  fs.writeFileSync(recusador, `#!/usr/bin/env node
process.stdin.resume(); process.stdin.on('end', () => {})
process.stderr.write('\\x1b[93m\\x1b[1m! \\x1b[0mpermission requested: external_directory (/tmp/fora/*); auto-rejecting\\n')
console.log(JSON.stringify({ type: 'text', part: { type: 'text', text: 'vou olhar fora do projeto' } }))
setTimeout(() => process.exit(0), 300)`)
  fs.chmodSync(recusador, 0o755)
  const binRecusador = ehWindows ? recusador.replace(/\.mjs$/, '.cmd') : recusador
  if (ehWindows) fs.writeFileSync(binRecusador, `@"${process.execPath}" "${recusador}" %*\r\n`)
  const { id: cidPasta } = G.criar({ titulo: 'pasta', projeto: 'p', cwd: casa })
  T.responder(cidPasta, { texto: 'faça', agente: 'opencode', binario: binRecusador })
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 200)); if (!G.lerConversa(cidPasta).turnoAberto && i > 10) break }
  await new Promise((r) => setTimeout(r, 1500)) // a retomada, se disparasse, abriria um turno logo depois do fim
  const { DIR_PERMISSOES } = await import('./src/decisao.mjs')
  const dirPed = DIR_PERMISSOES()
  const pedidosPasta = (fs.existsSync(dirPed) ? fs.readdirSync(dirPed) : []).filter((n) => { try { return JSON.parse(fs.readFileSync(path.join(dirPed, n), 'utf8')).coderoom === cidPasta } catch { return false } })
  passa('CC-805: pasta recusada vira pedido de pasta, e nao a retomada de agente caido', () => {
    const msgs = G.lerConversa(cidPasta).mensagens
    assert.ok(!msgs.some((m) => m.de === 'sistema' && /caiu no meio/.test(m.texto)), 'nao e queda')
    assert.equal(pedidosPasta.length, 1, 'o pedido de pasta existe')
  })
  passa('CC-714: projeto em Planejamento sobe os tres agentes no modo de plano', () => {
    const proj = path.join(casa, 'proj-plano'); fs.mkdirSync(path.join(proj, '.framework'), { recursive: true })
    fs.writeFileSync(path.join(proj, '.framework', 'estado.json'), JSON.stringify({ ligado: true, modo: 'planejamento' }))
    assert.equal(T.modoDoProjeto(proj), 'planejamento')
    const cl = A.AGENTES_GATE.claude.args({ somenteLer: true, permissao: 'pergunteAntes', cwd: proj, novaSessao: 'x' })
    assert.equal(cl[cl.indexOf('--permission-mode') + 1], 'plan')
    assert.ok(!cl.includes('--settings'), 'plano vence o pergunte antes')
  })
  passa('o revisor vai em modo de leitura nos dois agentes', () => {
    assert.ok(A.AGENTES_GATE.agy.args({ somenteLer: true }).join(' ').includes('--mode plan'))
    assert.ok(A.AGENTES_GATE.opencode.args({ somenteLer: true }).join(' ').includes('--agent plan'))
  })
  passa('CC-755/758: fila do revisor; Claude sai acima de 75% da janela; foto so com quem enxerga', () => {
    const cfg = { principal: { agente: 'claude', modelo: 'haiku' }, reserva: { agente: 'opencode', modelo: null }, visualAuto: true, tetoJanela: 0.75 }
    const vazio = { cincoHoras: { pct: 10 }, em: Date.now() }
    assert.deepEqual(T.escolherRevisores(null, cfg, { uso: vazio }).map((r) => r.agente), ['claude', 'opencode'])
    assert.deepEqual(T.escolherRevisores({ estado: 'rejected', tipo: 'five_hour' }, cfg, { uso: vazio }).map((r) => r.agente), ['opencode'])
    assert.deepEqual(T.escolherRevisores(null, cfg, { uso: { cincoHoras: { pct: 80 }, em: Date.now() } }).map((r) => r.agente), ['opencode'], 'painel diz 80%')
    assert.deepEqual(T.escolherRevisores({ utilizacao5h: 0.76 }, cfg, { uso: vazio }).map((r) => r.agente), ['opencode'], 'resposta do Claude diz 76%')
    assert.deepEqual(T.escolherRevisores(null, cfg, { visual: true, uso: vazio }).map((r) => r.agente), ['claude', 'agy'], 'opencode nao enxerga, agy entra')
    assert.deepEqual(T.escolherRevisores(null, cfg, { visual: true, uso: { cincoHoras: { pct: 90 }, em: Date.now() } }).map((r) => r.agente), ['agy'])
    const log = path.join(casa, 'cota.jsonl')
    fs.writeFileSync(log, JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', unifiedWindows: { five_hour: { utilization: 0.19 } } } }) + '\n')
    assert.equal(A.lerTurno(log, 'claude').cota.utilizacao5h, 0.19)
    const r = Cf.setRevisor({ principal: { agente: 'opencode', modelo: 'opencode/big-pickle' }, reserva: { agente: 'claude', modelo: 'haiku' }, visualAuto: false })
    assert.equal(r.principal.agente, 'opencode'); assert.equal(r.visualAuto, false)
    assert.equal(Cf.setRevisor({ principal: { agente: 'invasor' } }).principal.agente, 'opencode', 'agente desconhecido nao entra')
  })
} finally {
  fs.rmSync(casa, { recursive: true, force: true })
}
console.log(`test-gate-memoria: ${ok} verificações, 0 falhas`)
