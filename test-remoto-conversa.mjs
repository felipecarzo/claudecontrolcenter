/**
 * CC-357: cada rótulo do controle remoto casa com a SUA conversa.
 *
 * O furo era `conversaDe(cwd)` devolver a conversa mais nova para todos os
 * rótulos do mesmo projeto. Este teste guarda o casamento por tempo de criação,
 * com os NÚMEROS reais medidos no painel vivo em 26/08.
 *
 * A função `casarConversas` não é exportada (é interna do estado()), então o
 * teste replica a mesma regra e, no fim, confere que o código do arquivo
 * continua casando por `criadoEm` e não por "mais nova".
 */
import assert from 'node:assert'
import fs from 'node:fs'

let falhou = false
const ok = (m) => console.log(`  ok   ${m}`)
const erro = (m, e) => { falhou = true; console.error(`  FALHOU ${m}\n         ${e?.message || e}`) }

// réplica fiel de casarConversas (mesma regra do remotecontrol.mjs)
function casar(sessoes, convsPorCwd) {
  const mapa = new Map()
  const porCwd = new Map()
  for (const s of sessoes) { if (!s.cwd) continue; if (!porCwd.has(s.cwd)) porCwd.set(s.cwd, []); porCwd.get(s.cwd).push(s) }
  const TOL = 5000
  for (const [cwd, labels] of porCwd) {
    const convs = [...(convsPorCwd[cwd] || [])].sort((a, b) => a.criadoEm - b.criadoEm)
    const usadas = new Set()
    for (const s of [...labels].sort((a, b) => a.criado - b.criado)) {
      let c = convs.find((x) => !usadas.has(x.id) && x.criadoEm >= s.criado - TOL)
      if (!c) { for (let i = convs.length - 1; i >= 0; i--) { if (!usadas.has(convs[i].id)) { c = convs[i]; break } } }
      if (c) { usadas.add(c.id); mapa.set(s.nome, c.id) }
    }
  }
  return mapa
}

// 1. o caso real medido: dois rótulos, cada um com a conversa nascida logo depois
try {
  const cwd = '/home/claudedev/projetos/VPS_cockpit'
  const sessoes = [
    { nome: 'cc-remote-VPS_cockpit', criado: 1787648058000, cwd },
    { nome: 'cc-remote-VPS_cockpit-2', criado: 1787676432000, cwd },
  ]
  const convs = { [cwd]: [
    { id: 'fbabdeb0', criadoEm: 1787648062000 }, // 4s depois do 1o rótulo
    { id: 'd4b47d4e', criadoEm: 1787676435000 }, // 3s depois do 2o rótulo
    { id: '21e88ed9', criadoEm: 1787588516000 }, // mais velha, de antes
  ] }
  const m = casar(sessoes, convs)
  assert.equal(m.get('cc-remote-VPS_cockpit'), 'fbabdeb0', 'o 1o rótulo casa com a conversa nascida logo depois dele')
  assert.equal(m.get('cc-remote-VPS_cockpit-2'), 'd4b47d4e', 'o 2o rótulo casa com a SUA conversa, não com a mais nova')
  assert.notEqual(m.get('cc-remote-VPS_cockpit'), m.get('cc-remote-VPS_cockpit-2'), 'os dois NÃO podem apontar para a mesma conversa')
  ok('cada rótulo casa com a conversa nascida logo depois dele (números reais)')
} catch (e) { erro('caso real', e) }

// 2. sessão retomada (conversa velha) cai no reserva, não trava
try {
  const cwd = '/x'
  const sessoes = [{ nome: 'cc-remote-x', criado: 2000000000000, cwd }]
  const convs = { [cwd]: [{ id: 'velha', criadoEm: 1000000000000 }] } // nasceu MUITO antes
  const m = casar(sessoes, convs)
  assert.equal(m.get('cc-remote-x'), 'velha', 'sem conversa nascida depois, fica com a única disponível (reserva)')
  ok('sessão retomada cai no reserva em vez de ficar sem conversa')
} catch (e) { erro('retomada', e) }

// 3. o código do arquivo casa por criadoEm, não por "a mais nova"
try {
  const src = fs.readFileSync(new URL('./src/remotecontrol.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes('function casarConversas'), 'a função de casamento precisa existir')
  assert.ok(src.includes('nascimentosDe'), 'precisa ler o nascimento das conversas, não só a modificação')
  const i = src.indexOf('function casarConversas')
  const trecho = src.slice(i, i + 900)
  assert.ok(/criadoEm >= s\.criado/.test(trecho), 'o casamento tem que ser por tempo de criação (criadoEm >= criado)')
  ok('o remotecontrol.mjs casa por tempo de criação')
} catch (e) { erro('código usa criadoEm', e) }

/* 28/09: religar o celular apagava o texto digitado e não enviado. */
try {
  const { rascunhoDaTela: r } = await import('./src/remotecontrol.mjs')
  assert.equal(r('───\n❯ monta as perguntas pra kolibri\n───'), 'monta as perguntas pra kolibri')
  assert.equal(r('───\n❯ \x1b[2mcommit\x1b[0m\n───'), '', 'sugestão esmaecida não é rascunho')
  assert.equal(r('❯ Continue\n  Enter to select · Esc'), '', 'menu aberto não é rascunho')
  assert.equal(r('❯ \n'), '')
  ok('o rascunho do campo sobrevive a religar e soltar o celular')
} catch (e) { erro('rascunho do campo', e) }

/* CC-675: a saúde da sessão lida no rodapé, com as telas medidas em 28/09. */
try {
  const { saudeDaTela: f } = await import('./src/remotecontrol.mjs')
  assert.deepEqual(f('❯ \n───\n  ⏸ manual mode on         ✔ Update installed\n                          /rc'), { celular: true, presa: null, trabalhando: false, fechadaNoApp: false })
  assert.deepEqual(f('● Remote Control disconnected (code 4090)\n❯ monta\n───\n  ⏸ manual mode on\n                          /rc failed'), { celular: false, presa: null, trabalhando: false, fechadaNoApp: false })
  assert.deepEqual(f('Do you trust the files in this folder?\n ❯ 1. Yes, I trust this folder\n   2. No, exit\n Enter to confirm · Esc to cancel'), { celular: null, presa: 'parada na pergunta de confiança da pasta', trabalhando: false, fechadaNoApp: false })
  assert.deepEqual(f('  4. Estudo\n  5. Type something.\n───\n  6. Chat about this\nEnter to select · ↑/↓ to navigate · Esc to cancel\n─── VPS_ecommerce_apps ─'), { celular: null, presa: null, trabalhando: false, fechadaNoApp: false }, 'pergunta do agente não é sessão presa')
  assert.equal(f('  ⎿  Running…\n✢ Frolicking… (13m 45s · ↓ 31.9k tokens)\n───\n❯ \n───\n  ⏵⏵ auto mode on\n                    /rc').trabalhando, true, 'turno em andamento')
  assert.equal(f('✻ Crunched for 16m 53s · done 4:47 AM\n───\n❯ \n───\n  ⏸ manual mode on\n                    /rc').trabalhando, false, 'turno acabado')
  assert.equal(f('Network request outside of sandbox\n Host: r.jina.ai\n Do you want to allow this connection?\n ❯ 1. Yes\n   2. No').celular, null, 'com o pedido na tela, não dá para saber do celular')
  ok('a tela diz se o celular caiu, se a sessão está presa num menu e se está trabalhando')

  /* CC-1090: a tela de verdade da sessão cc-remote-vr_apps-2, copiada de `tmux capture-pane` em 07/11 (travessão
     escrito como \u2014 e o espaço depois do ❯ como \u00a0, que é como o terminal entrega). Ele fechou a sessão no
     app com /exit; o processo ficou vivo, o rodapé diz "/rc failed" e a mensagem quebra a linha no meio da frase. */
  const TELA_FECHADA = [
    '\u273b Worked for 4m 21s \u00b7 done 10:19 PM',
    '',
    '\u25cf Remote Control disconnected \u2014 the server no longer reports this',
    '  session \u2014 it may have been deleted from another device or app (code',
    '  4090)',
    '',
    '\u2500'.repeat(60),
    '\u276f\u00a0testei, ficou melhor que o app',
    '\u2500'.repeat(60),
    '  \u23f5\u23f5 auto mode on (shift+tab to cycle)  \u2714 Update installed \u00b7 Restart to update',
    '                                          new task? /clear to save 118k tokens',
    '                                                                    /rc failed',
  ].join('\n')
  const real = f(TELA_FECHADA)
  assert.equal(real.fechadaNoApp, true, 'a frase quebrada em duas linhas tem que ser reconhecida')
  assert.equal(real.celular, false, 'o rodapé diz /rc failed')
  assert.equal(f(TELA_FECHADA.replace('/rc failed', '/rc')).fechadaNoApp, false, 'celular religado: a mensagem velha não vale')
  const MSG = TELA_FECHADA.split('\n').slice(2, 5).join('\n')
  const semFrase = TELA_FECHADA.replace(MSG, '\u25cf Remote Control disconnected (code 4090)')
  assert.equal(f(semFrase).fechadaNoApp, false, 'sem a frase do servidor não é fechada no app')
  assert.equal(f(semFrase).celular, false)
  const soMetade = TELA_FECHADA.replace(MSG, '\u25cf Remote Control disconnected\n  it may have been deleted from another device or app (code 4090)')
  assert.equal(f(soMetade).fechadaNoApp, true, 'a outra frase do aviso (deleted from another device) também vale')
  ok('sessão fechada no app: a tela de verdade da vr_apps-2 é reconhecida, e celular caído sem querer não')

  /* O texto no campo dessa mesma tela vem esmaecido (ESC[2m): é a SUGESTÃO do Claude Code, não uma resposta dele
     parada. Medido na tela de verdade com `tmux capture-pane -e`. */
  const { rascunhoDaTela: rasc } = await import('./src/remotecontrol.mjs')
  const comCor = TELA_FECHADA.replace('\u276f\u00a0testei, ficou melhor que o app', '\u276f\u00a0\x1b[2mtestei, ficou melhor que o app\x1b[0m')
  assert.equal(rasc(comCor), '', 'sugestão esmaecida não vira "resposta parada"')
  assert.equal(rasc(TELA_FECHADA.replace('testei, ficou melhor que o app', 'testei, ficou melhor que o app')), 'testei, ficou melhor que o app', 'o mesmo texto SEM esmaecer é digitado por ele')
  ok('a sugestão esmaecida do campo não é tomada por resposta que ficou parada')
} catch (e) { erro('saúde da sessão', e) }

/* Sessão morta no reinício da VPS: vínculo "vivo" sem terminal, com conversa em disco. */
try {
  const { filtrarMortas } = await import('./src/remotecontrol.mjs')
  const agora = Date.now()
  const pasta = process.cwd()
  const vinculos = {
    morta: { conversa: 'c-morta', cwd: pasta, certeza: 'medida', desde: 10, encerradaEm: null },
    'morta-2': { conversa: 'c-morta', cwd: pasta, certeza: 'medida', desde: 20, encerradaEm: null },
    viva: { conversa: 'c-viva', cwd: pasta, encerradaEm: null },
    forasolta: { conversa: 'c-fora', cwd: pasta, encerradaEm: null },
    encerrada: { conversa: 'c-enc', cwd: pasta, encerradaEm: agora - 1000 },
    semConversa: { conversa: null, cwd: pasta, encerradaEm: null },
    velha: { conversa: 'c-velha', cwd: pasta, encerradaEm: null },
    sumiu: { conversa: 'c-sumiu', cwd: '/nao/existe/mesmo', encerradaEm: null },
  }
  const ultima = (c) => ({ 'c-morta': agora - 3600e3, 'c-viva': agora, 'c-fora': agora, 'c-enc': agora, 'c-velha': agora - 30 * 86400e3, 'c-sumiu': agora })[c] || 0
  const r = filtrarMortas({ vinculos, vivos: new Set(['viva']), conversasVivas: new Set(['c-viva', 'c-fora']), ultima, agora })
  assert.deepEqual(r.map((x) => x.rotulo), ['morta-2'], 'só a morta; mesma conversa em dois rótulos conta uma vez (a mais nova)')
  ok('sessão morta no reinício aparece uma vez; viva, encerrada, antiga e sem pasta ficam de fora')
} catch (e) { erro('sessões mortas', e) }

if (falhou) process.exit(1)
console.log('test-remoto-conversa: ok')
