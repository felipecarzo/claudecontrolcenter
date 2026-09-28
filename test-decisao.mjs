// Responder pelo painel a pergunta do agente (CC-556): ler, traduzir em teclas,
// e a trava de só apertar com a pergunta visível na tela.
import assert from 'node:assert/strict'
import { perguntaPendente, teclasPara, telaMostra, responder, fechar, reabrir, lerFechadas, lerMantidas, chaveDoCartao, telaNoCampo, enviarMensagem, parar, acaoPendente, teclaDaPermissao, permitir, adiar, trazer, lerDepois, depoisVale, proximaManha, permissaoDaTela } from './src/decisao.mjs'

let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok  ${nome}`) }

const linha = (o) => JSON.stringify(o)
const pergunta = (id, questions) => linha({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions } }] } })
const resposta = (id) => linha({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } })
const COR = [{ question: 'Qual cor?', options: [{ label: 'Azul' }, { label: 'Verde' }, { label: 'Vermelho' }] }]
const DUAS = [
  { question: 'Fruta?', options: [{ label: 'Maca' }, { label: 'Pera' }] },
  { question: 'Bicho?', options: [{ label: 'Gato' }, { label: 'Cao' }] },
]

await t('pergunta sem resposta no transcrito é a pendente', () => {
  const p = perguntaPendente([pergunta('a1', COR)].join('\n'))
  assert.equal(p.id, 'a1')
  assert.equal(p.perguntas[0].pergunta, 'Qual cor?')
  assert.deepEqual(p.perguntas[0].opcoes.map((o) => o.rotulo), ['Azul', 'Verde', 'Vermelho'])
})

await t('pergunta já respondida não é pendente', () => {
  assert.equal(perguntaPendente([pergunta('a1', COR), resposta('a1')].join('\n')), null)
})

await t('só a ÚLTIMA pergunta conta: uma velha sem resposta não volta', () => {
  const p = perguntaPendente([pergunta('velha', COR), resposta('velha'), pergunta('nova', DUAS)].join('\n'))
  assert.equal(p.id, 'nova')
  assert.equal(p.perguntas.length, 2)
})

await t('pergunta de subagente (sidechain) não é do agente principal', () => {
  const lateral = linha({ type: 'assistant', isSidechain: true, message: { content: [{ type: 'tool_use', id: 's1', name: 'AskUserQuestion', input: { questions: COR } }] } })
  assert.equal(perguntaPendente(lateral), null)
})

await t('uma pergunta: só o número da opção (medido: o menu já envia)', () => {
  const p = perguntaPendente(pergunta('a1', COR))
  assert.deepEqual(teclasPara(p.perguntas, [{ opcao: 1 }]).map((x) => x.tecla), ['2'])
})

await t('duas perguntas: um número por pergunta e "1" na revisão', () => {
  const p = perguntaPendente(pergunta('a1', DUAS))
  const passos = teclasPara(p.perguntas, [{ opcao: 1 }, { opcao: 0 }])
  assert.deepEqual(passos.map((x) => x.tecla), ['2', '1', '1'])
  assert.equal(passos.at(-1).revisao, true)
})

await t('resposta escrita: "Type something" é a opção depois da última', () => {
  const p = perguntaPendente(pergunta('a1', DUAS))
  const passos = teclasPara(p.perguntas, [{ opcao: 1 }, { texto: 'Capivara\ncom quebra' }])
  assert.deepEqual(passos.map((x) => x.tecla ?? `texto:${x.texto}`), ['2', '3', 'texto:Capivara com quebra', 'Enter', '1'])
})

await t('resposta faltando, vazia ou fora das opções é recusada', () => {
  const p = perguntaPendente(pergunta('a1', DUAS))
  assert.throws(() => teclasPara(p.perguntas, [{ opcao: 0 }]), /2 pergunta/)
  assert.throws(() => teclasPara(p.perguntas, [{ opcao: 0 }, { texto: '  ' }]), /vazia/)
  assert.throws(() => teclasPara(p.perguntas, [{ opcao: 7 }, { opcao: 0 }]), /vazia/)
})

await t('CC-624: várias escolhas marca cada número, seta para a direita e "1" na revisão (medido numa sessão de teste)', () => {
  const p = perguntaPendente(pergunta('a1', [{ ...COR[0], multiSelect: true }]))
  const teclas = teclasPara(p.perguntas, [{ opcoes: [2, 0, 2] }]).map((x) => x.tecla)
  assert.deepEqual(teclas, ['1', '3', 'Right', '1'], 'marca Azul e Vermelho uma vez cada, avança e envia')
  assert.throws(() => teclasPara(p.perguntas, [{ opcoes: [] }]), /pelo menos uma/)
  // CC-625: com resposta escrita, desce até "Type something", escreve, desce até Submit e Enter.
  const comTexto = teclasPara(p.perguntas, [{ opcoes: [1], texto: 'e kiwi' }]).map((x) => x.tecla || 'texto:' + x.texto)
  assert.deepEqual(comTexto, ['2', 'Down', 'Down', 'Down', 'texto:e kiwi', 'Down', 'Enter', '1'])
  assert.deepEqual(teclasPara(p.perguntas, [{ texto: 'só isso' }]).map((x) => x.tecla || 'texto'), ['Down', 'Down', 'Down', 'texto', 'Down', 'Enter', '1'])
})

await t('a tela confere a pergunta mesmo quebrada em duas linhas', () => {
  const longa = 'Subo com ou sem a migração do banco de produção nesta janela de manutenção?'
  assert.equal(telaMostra('❯ Subo com ou sem a migração do banco\n de produção nesta janela', longa), true)
  assert.equal(telaMostra('❯ algo completamente diferente', longa), false)
  assert.equal(telaMostra('qualquer tela', ''), false)
})

// --- o responder de ponta a ponta, com terminal de mentira ---
function falso({ tela, transcrito, confirma = true, conversa = 'c1' }) {
  const log = []
  let txt = transcrito
  return {
    log,
    deps: {
      sessoes: async () => ({ proj: { sessao: 'cc-remote-proj', conversa } }),
      lerTranscrito: () => txt,
      capturar: async () => (typeof tela === 'function' ? tela(log) : tela),
      apertar: async (s, k) => { log.push(k); if (confirma && (k === '1' || /^[0-9]$/.test(k)) && log.length >= 1) txt = `${transcrito}\n${resposta('a1')}`; return { ok: true } },
      escrever: async (s, x) => { log.push(`texto:${x}`); return { ok: true } },
      esperar: async () => {},
    },
  }
}

await t('responde quando a pergunta está pendente E na tela, e confirma pelo transcrito', async () => {
  const f = falso({ tela: '❯ Qual cor?\n 1. Azul', transcrito: pergunta('a1', COR) })
  const r = await responder({ conversa: 'c1', id: 'a1', respostas: [{ opcao: 2 }] }, f.deps)
  assert.equal(r.ok, true)
  assert.deepEqual(f.log, ['3'])
})

await t('A TRAVA: pergunta fora da tela, nenhuma tecla é apertada', async () => {
  const f = falso({ tela: '❯ o agente já seguiu e está escrevendo código', transcrito: pergunta('a1', COR) })
  const r = await responder({ conversa: 'c1', id: 'a1', respostas: [{ opcao: 0 }] }, f.deps)
  assert.equal(r.ok, false)
  assert.match(r.erro, /não apertei nada/)
  assert.deepEqual(f.log, [])
})

await t('pergunta já respondida ou trocada: recusa sem apertar', async () => {
  const f = falso({ tela: 'Qual cor?', transcrito: [pergunta('a1', COR), resposta('a1')].join('\n') })
  const r = await responder({ conversa: 'c1', id: 'a1', respostas: [{ opcao: 0 }] }, f.deps)
  assert.match(r.erro, /já foi respondida/)
  assert.deepEqual(f.log, [])
})

await t('conversa fora de terminal do painel: diz para responder nela', async () => {
  const f = falso({ tela: 'Qual cor?', transcrito: pergunta('a1', COR), conversa: 'outra' })
  const r = await responder({ conversa: 'c1', id: 'a1', respostas: [{ opcao: 0 }] }, f.deps)
  assert.match(r.erro, /terminal aberto pelo painel/)
})

await t('menu que não avança para a pergunta 2 para no meio, sem mandar a resposta errada', async () => {
  const f = falso({ tela: 'Fruta?', transcrito: pergunta('a1', DUAS), confirma: false })
  const r = await responder({ conversa: 'c1', id: 'a1', respostas: [{ opcao: 0 }, { opcao: 1 }] }, f.deps)
  assert.equal(r.ok, false)
  assert.match(r.erro, /pergunta 2 não apareceu/)
  assert.deepEqual(f.log, ['1'])
})

await t('teclas enviadas sem confirmação no transcrito: não finge sucesso', async () => {
  const f = falso({ tela: 'Qual cor?', transcrito: pergunta('a1', COR), confirma: false })
  const r = await responder({ conversa: 'c1', id: 'a1', respostas: [{ opcao: 0 }] }, f.deps)
  assert.equal(r.ok, false)
  assert.match(r.erro, /não confirmou/)
})

await t('CC-638: o pedido de rede do sandbox é lido da tela, e permitir aperta o 1 só se for o mesmo pedido', async () => {
  // A tela real do ahtleta-escalada em 27/09.
  const TELA = '✻ Waiting for 1 background agent to finish\n────────────────────────────────────────\n Network request outside of sandbox\n   Host: overpass-api.de\n   Do you want to allow this connection?\n   ❯ 1. Yes\n     2. Yes, and don\'t ask again for overpass-api.de\n     3. No, and tell Claude what to do differently (esc)'
  const pr = permissaoDaTela(TELA)
  assert.equal(pr.titulo, 'Network request outside of sandbox')
  assert.equal(pr.detalhe, 'Host: overpass-api.de')
  assert.equal(teclaDaPermissao(TELA, 'sim'), '1')
  assert.equal(teclaDaPermissao(TELA, 'nao'), '3')
  assert.equal(permissaoDaTela('terminei\n❯ '), null)
  // CC-640: a tela real do coepiloto, com a dica quebrada e o comando com "│".
  const BASH = '────────────────\n Bash command (unsandboxed)\n Tip: auto mode handles these prompts for you — choose "switch to auto mode"\n below\n   │ cd /tmp/x &&\n   │ python -c "print(1)"\n   Fotografa a barra de navegação com os ícones\n Do you want to proceed?\n ❯ 1. Yes\n   2. Yes, and switch to auto mode\n   3. No\n Esc to cancel · Tab to amend'
  const pb = permissaoDaTela(BASH)
  assert.equal(pb.titulo, 'Bash command (unsandboxed)')
  assert.equal(pb.detalhe, 'cd /tmp/x &&\npython -c "print(1)"')
  assert.equal(pb.descricao, 'Fotografa a barra de navegação com os ícones')
  let tela = TELA; const log = []
  const deps = { sessoes: async () => ({ p: { sessao: 's', conversa: 'c1' } }), lerTranscrito: () => '', capturar: async () => tela, apertar: async (s, k) => { log.push(k); tela = 'seguiu'; return { ok: true } }, esperar: async () => {} }
  assert.equal((await permitir({ conversa: 'c1', id: 'tela:outra', decisao: 'sim' }, deps)).ok, false, 'pedido trocado não recebe o sim')
  assert.equal((await permitir({ conversa: 'c1', id: 'tela:' + pr.chave, decisao: 'sim' }, deps)).ok, true)
  assert.deepEqual(log, ['1'])
  // CC-649: leitura de tela que falha depois de apertar NÃO é sucesso.
  let lidas = 0
  const falha = { ...deps, capturar: async () => (lidas++ === 0 ? TELA : null), apertar: async () => ({ ok: true }) }
  assert.equal((await permitir({ conversa: 'c1', id: 'tela:' + pr.chave, decisao: 'sim' }, falha)).ok, false, 'tela vazia era lida como pedido atendido')
  // CC-649: o número só move o cursor; o Enter de reserva confirma.
  let t2 = TELA; const log2 = []
  const cursor = { ...deps, capturar: async () => t2, apertar: async (s, k) => { log2.push(k); if (k === 'Enter') t2 = 'seguiu'; return { ok: true } } }
  assert.equal((await permitir({ conversa: 'c1', id: 'tela:' + pr.chave, decisao: 'sim' }, cursor)).ok, true)
  assert.deepEqual(log2, ['1', 'Enter'])
  // e se nem o Enter resolve, diz que não foi
  const teimoso = { ...deps, capturar: async () => TELA, apertar: async () => ({ ok: true }) }
  assert.equal((await permitir({ conversa: 'c1', id: 'tela:' + pr.chave, decisao: 'sim' }, teimoso)).ok, false)
})

await t('CC-630: para depois nas três formas de voltar, e trazer de volta', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const arq = mkdtempSync(tmpdir() + '/depois-') + '/d.json'
  const agora = Date.UTC(2026, 8, 27, 23, 0) // 20h de Brasília
  assert.equal(proximaManha(agora), Date.UTC(2026, 8, 28, 11, 0), '8h de Brasília do dia seguinte')
  assert.equal(proximaManha(Date.UTC(2026, 8, 28, 5, 0)), Date.UTC(2026, 8, 28, 11, 0), 'às 2h da manhã é a mesma manhã')
  assert.equal(adiar({ id: 'a', marca: 'm1', modo: 'manual' }, arq, agora).ok, true)
  assert.equal(adiar({ id: 'b', marca: 'm1', modo: 'mexer' }, arq, agora).ok, true)
  assert.equal(adiar({ id: 'c', marca: 'm1', modo: 'amanha' }, arq, agora).ok, true)
  assert.equal(adiar({ id: 'd', modo: 'qualquer' }, arq, agora).ok, false)
  const d = lerDepois(arq)
  assert.equal(depoisVale(d.a, 'outra', agora + 9e9), true, 'manual: só volta quando ele trouxer')
  assert.equal(depoisVale(d.b, 'm1', agora), true)
  assert.equal(depoisVale(d.b, 'm2', agora), false, 'mexer: fala nova traz de volta')
  assert.equal(depoisVale(d.c, 'm1', agora + 3600e3), true)
  assert.equal(depoisVale(d.c, 'm1', Date.UTC(2026, 8, 28, 11, 1)), false, 'amanhã: volta às 8h')
  assert.equal(trazer({ id: 'a' }, arq).ok, true)
  assert.equal(lerDepois(arq).a, undefined)
})

await t('fechar grava a chave do cartão e lerFechadas devolve; arquivo ausente vira vazio', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const arq = mkdtempSync(tmpdir() + '/fechadas-') + '/f.json'
  assert.equal(lerFechadas(arq).size, 0)
  assert.equal(fechar({ id: 'x', marca: 'm1' }, arq).ok, true)
  assert.ok(lerFechadas(arq).has(chaveDoCartao('x', 'm1')))
  assert.equal(fechar({}, arq).ok, false)
})

await t('CC-582: o histórico abre, fecha com o motivo certo e lista por projeto', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const H = await import('./src/decisaoHistorico.mjs')
  const arq = mkdtempSync(tmpdir() + '/hist-') + '/h.json'
  const dec = (id, marca, projeto) => ({ tipo: 'agente', id, marca, projeto, nome: projeto, rotulo: 'parou', pergunta: 'e agora?', desdeMs: 1000 })
  const sess = (id, estado) => ({ projetos: [{ sessoes: [{ id, estado }] }] })
  const agora = 1_000_000
  H.registrar({ espera: [dec('a', 'm1', 'x'), dec('b', 'm1', 'x'), dec('c', 'm1', 'y'), dec('d', 'm1', 'y')], ...sess('a', 'espera você') }, { agora, arq })
  assert.equal(Object.keys(H.ler(arq).abertas).length, 4)
  H.marcarRespondida('a', agora + 10)
  // a: respondida pelo painel; b: fechada por ele; c: sessão viva e andou; d: sessão sumiu
  H.registrar({ espera: [], projetos: [{ sessoes: [{ id: 'a', estado: 'trabalhando' }, { id: 'b', estado: 'ociosa' }, { id: 'c', estado: 'trabalhando' }] }] }, { agora: agora + 20, arq, fechadasPorEle: new Set(['b::m1']) })
  const fim = Object.fromEntries(H.ler(arq).fechadas.map((r) => [r.id, r.fim]))
  assert.deepEqual(fim, { a: 'respondida pelo painel', b: 'fechada por você', c: 'seguiu na sessão', d: 'sessão desligada' })
  assert.deepEqual(H.listar({ projeto: 'y' }, arq).map((r) => r.id).sort(), ['c', 'd'])
  // cartão que saiu pela idade continua aberto
  H.registrar({ espera: [], ocultas: [{ ...dec('e', 'm1', 'z'), oculta: 'antiga' }] }, { agora: agora + 30, arq })
  H.registrar({ espera: [], ocultas: [{ ...dec('e', 'm1', 'z'), oculta: 'antiga' }] }, { agora: agora + 40, arq })
  assert.ok(H.ler(arq).abertas['e::m1'], 'a antiga fechou sem ninguém responder')
})

await t('reabrir tira das fechadas e marca como mantida; fechar de novo desfaz a marca', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const arq = mkdtempSync(tmpdir() + '/fechadas-') + '/f.json'
  const k = chaveDoCartao('y', 'm2')
  fechar({ id: 'y', marca: 'm2' }, arq)
  assert.equal(reabrir({ id: 'y', marca: 'm2' }, arq).ok, true)
  assert.equal(lerFechadas(arq).has(k), false)
  assert.equal(lerMantidas(arq).has(k), true, 'reaberta não pode sumir pela idade de novo')
  fechar({ id: 'y', marca: 'm2' }, arq)
  assert.equal(lerMantidas(arq).has(k), false)
  assert.equal(lerFechadas(arq).has(k), true)
  assert.equal(reabrir({}, arq).ok, false)
})

await t('mensagem livre: só escreve com a tela no campo de digitar', async () => {
  assert.equal(telaNoCampo('texto\n❯ \n  ⏸ manual mode on'), true)
  assert.equal(telaNoCampo('❯ 1. Azul\n  2. Verde\nEnter to select · ↑/↓ to navigate'), false)
  // 27/09, ahtleta-corrida: sugestão esmaecida e espaço especial depois do ❯.
  assert.equal(telaNoCampo('feito\n\x1b[39m❯ \x1b[2mcommit\x1b[0m\n  ⏸ manual mode on'), true)
  const semPergunta = linha({ type: 'assistant', message: { content: [{ type: 'text', text: 'terminei' }] } })
  const log = []
  let txt = semPergunta
  const deps = {
    sessoes: async () => ({ p: { sessao: 's', conversa: 'c1' } }),
    lerTranscrito: () => txt,
    capturar: async () => 'terminei\n❯ ',
    escrever: async (s, x) => { log.push(x); txt += '\n' + linha({ type: 'user', message: { content: x } }); return { ok: true } },
    apertar: async (s, k) => { log.push(k); return { ok: true } },
    esperar: async () => {},
  }
  const r = await enviarMensagem({ conversa: 'c1', texto: 'pode seguir\ncom a opção 2' }, deps)
  assert.equal(r.ok, true)
  assert.deepEqual(log, ['pode seguir com a opção 2', 'Enter'])
  // num menu, recusa sem escrever nada
  const log2 = []
  const r2 = await enviarMensagem({ conversa: 'c1', texto: 'oi' }, { ...deps, capturar: async () => 'Enter to confirm', escrever: async (s, x) => { log2.push(x); return { ok: true } } })
  assert.equal(r2.ok, false)
  assert.deepEqual(log2, [])
  // com pergunta aberta, manda usar os botões
  const r3 = await enviarMensagem({ conversa: 'c1', texto: 'oi' }, { ...deps, lerTranscrito: () => pergunta('a1', COR) })
  assert.match(r3.erro, /botões da pergunta/)
})

await t('parar manda Esc e confirma pela tela; conversa fora do painel é recusada', async () => {
  const log = []; let tela = 'trabalhando...'
  const deps = { sessoes: async () => ({ p: { sessao: 's', conversa: 'c1' } }), apertar: async (s, k) => { log.push(k); tela = '⎿ Interrupted · What should Claude do instead?'; return { ok: true } }, capturar: async () => tela, esperar: async () => {} }
  assert.deepEqual(await parar({ conversa: 'c1' }, deps), { ok: true, sessao: 's' })
  assert.deepEqual(log, ['Escape'])
  assert.match((await parar({ conversa: 'x' }, deps)).erro, /terminal aberto pelo painel/)
})

await t('sessão DESTA máquina lê a fala do próprio transcrito, mesmo carimbada com origem', async () => {
  /* O defeito de 23/09: `mesclar` põe `origem` também nas sessões locais, e o
     motor tratava toda sessão com origem como de fora. Resultado: toda pergunta
     daqui virava "sem pergunta legível". A leitura tem que comparar com `eu`. */
  const { readFileSync } = await import('node:fs')
  const fonte = readFileSync(new URL('./src/cockpit2.mjs', import.meta.url), 'utf8')
  const linha = fonte.split('\n').find((l) => l.includes('falaDe: (j) =>'))
  assert.ok(linha, 'a leitura da fala sumiu do motor')
  assert.match(linha, /j\.origem\.id !== eu\.id/, 'a leitura da fala voltou a tratar sessão local como de fora')
})

await t('CC-609: permitir e negar leem o número da tela, e recusam pedido trocado', async () => {
  // A tela real do webscrapper em 27/09.
  const TELA = ' Bash command (unsandboxed)\n\n   loginctl show-user claudedev -p Linger\n   Confere se serviços do usuário ligam sem login\n\n Do you want to proceed?\n ❯ 1. Yes\n   2. Yes, and switch to auto mode · auto mode handles these prompts for you\n   3. No\n\n Esc to cancel · Tab to amend'
  assert.equal(teclaDaPermissao(TELA, 'sim'), '1')
  assert.equal(teclaDaPermissao(TELA, 'nao'), '3')
  assert.equal(teclaDaPermissao('terminei\n❯ ', 'sim'), null, 'fora do menu não há tecla')
  const acao = linha({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'loginctl show-user claudedev -p Linger', description: 'Confere se serviços do usuário ligam sem login' } }] } })
  assert.equal(acaoPendente(acao).id, 'b1')
  assert.equal(acaoPendente(acao + '\n' + resposta('b1')), null)
  let tela = TELA; const log = []
  const deps = {
    sessoes: async () => ({ p: { sessao: 's', conversa: 'c1' } }),
    lerTranscrito: () => acao,
    capturar: async () => tela,
    apertar: async (s, k) => { log.push(k); tela = 'rodando…'; return { ok: true } },
    esperar: async () => {},
  }
  assert.equal((await permitir({ conversa: 'c1', id: 'b1', decisao: 'nao' }, deps)).ok, true)
  assert.deepEqual(log, ['3'])
  tela = TELA.replace('loginctl show-user claudedev -p Linger', 'rm -rf pasta').replace('Confere se serviços', 'Apaga')
  const r = await permitir({ conversa: 'c1', id: 'b1', decisao: 'sim' }, deps)
  assert.equal(r.ok, false, 'pedido novo na tela não pode receber o sim dado ao anterior')
  assert.deepEqual(log, ['3'])
  assert.equal((await permitir({ conversa: 'c1', id: 'outro', decisao: 'sim' }, deps)).ok, false)
})

console.log(`\n${ok} verificações das decisões pelo painel, todas passaram`)
