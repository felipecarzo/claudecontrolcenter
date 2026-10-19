// CC-1063: a sala de realidade virtual. Dado enxuto, a mesma conta do painel, rotas e as ligações da página.
// O imersivo só o óculos prova; o que dá para provar daqui está aqui.
import assert from 'node:assert/strict'
import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { estadoVR, estadoDoAgente, contaComoEsperando, ehQA, ehNada } from './src/vrEstado.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }
const ler = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')

const dados = {
  lidoEm: 123,
  espera: [
    { tipo: 'agente', id: 'a1', projeto: 'cockpit', nome: 'cockpit', dispositivo: 'VPS', rotulo: 'pergunta', pergunta: 'Qual cor?   ' + 'x'.repeat(400), opcoes: ['Azul', 'Verde', 'Roxo', 'Preto', 'Branco'], conversa: 'c1' },
    { tipo: 'pendencia', id: 'p1', pergunta: 'tarefa dele, não é agente' },
    { tipo: 'agente', id: 'a2', projeto: 'medialab', nome: 'medialab', dispositivo: 'ALIENWARE-LIPE', rotulo: 'parou', resumo: 'terminei', escreve: false },
    { tipo: 'agente', id: 'a5', projeto: 'velha', nome: 'velha', rotulo: 'parou', esquecida: true },
    { tipo: 'agente', id: 'a6', projeto: 'qa', nome: 'qa', rotulo: 'parou', resumoIA: { etiqueta: 'testar' } },
    { tipo: 'agente', id: 'a7', projeto: 'nada', nome: 'nada', rotulo: 'parou', resumoIA: { etiqueta: 'nada' } },
    { tipo: 'agente', id: 'a8', projeto: 'perg', nome: 'perg', rotulo: 'pergunta', resumoIA: { etiqueta: 'nada' }, pergunta: 'pergunta nunca sai' },
  ],
  conectadas: [
    { id: 'a1', projeto: 'cockpit', estado: 'parada', dispositivo: 'VPS' },
    { id: 'a3', projeto: 'elite', estado: 'trabalhando', dispositivo: 'ALIENWARE-LIPE' },
    { id: 'a4', projeto: 'x', estado: 'falhou' },
    { id: 'a9', projeto: 'sem cartao', estado: 'espera você' },
    { id: 'a10', projeto: 'velha', estado: 'parada', esquecida: true },
  ],
}
const e = estadoVR(dados)
ok(e.cartoes.map((c) => c.id).join() === 'a1,a2,a8', 'cartões: só agentes, sem esquecida, sem QA, sem "nada"; pergunta nunca sai')
ok(e.contagem.esperando === 4, 'contagem esperando = 3 cartões + a sessão em "espera você" sem cartão, como no painel')
ok(e.cartoes[0].pergunta.length <= 280 && e.cartoes[0].pergunta.endsWith('…') && !/\s{2}/.test(e.cartoes[0].pergunta), 'pergunta cortada em 280 e sem espaço repetido')
ok(e.cartoes[0].acao.tipo === 'no-painel' && /responda no painel/.test(e.cartoes[0].acao.motivo), 'pergunta sem opções que a sala responda: o cartão manda ao painel, nunca "nada a decidir"')
ok(e.cartoes[1].pergunta === 'terminei', 'sem pergunta usa o resumo')
ok(e.agentes.find((a) => a.id === 'a1').estado === 'esperando', 'agente com cartão esperando aparece como esperando')
ok(e.agentes.find((a) => a.id === 'a3').estado === 'trabalhando' && e.agentes.find((a) => a.id === 'a4').estado === 'falhou', 'trabalhando e falhou com a palavra')
ok(e.agentes.find((a) => a.id === 'a10').esquecida === true, 'agente esquecido vem marcado')
ok(estadoVR({ espera: [{ tipo: 'agente', id: 'o', nome: 'o', responder: { conversa: 'c', id: 'q', perguntas: [{ opcoes: [{ label: 'Sim' }, { texto: 'Não' }] }] } }] }).cartoes[0].acao.opcoes.join('|') === 'Sim|Não', 'opção como objeto vira o texto dela, nunca [object Object]')
const pior = estadoVR({
  espera: Array.from({ length: 50 }, (_, i) => ({ tipo: 'agente', id: 'z' + i, projeto: 'p'.repeat(40), pergunta: 'q'.repeat(400), opcoes: ['o'.repeat(80), 'o', 'o', 'o'] })),
  conectadas: Array.from({ length: 60 }, (_, i) => ({ id: 'c' + i, projeto: 'p'.repeat(40), estado: 'trabalhando' })),
})
ok(pior.cartoes.length === 8 && pior.agentes.length === 24 && JSON.stringify(pior).length < 16000, 'pior caso: 8 cartões e 24 agentes, abaixo de 16 KB (' + JSON.stringify(pior).length + ' B)')
ok(estadoVR(null).cartoes.length === 0 && estadoVR(undefined).contagem.total === 0, 'sem dado não quebra')
ok(estadoDoAgente({ estado: 'espera você' }) === 'esperando' && estadoDoAgente({}) === 'parada', 'estado desconhecido vira parada')
ok(!contaComoEsperando(null) && ehQA({ resumoIA: { etiqueta: 'testar' } }) && !ehQA({ resumoIA: { etiqueta: 'testar' }, rotulo: 'permissão' }) && ehNada({ resumoIA: { etiqueta: 'nada' } }), 'QA e "nada" nunca tiram pergunta nem permissão')

// M2: o que a sala sabe responder, com o mesmo corpo que o painel manda
const { acaoDoCartao } = await import('./src/vrEstado.mjs')
const { botoesDoCartao, angulosDoArco, angulosDaMesa } = await import('./src/vr/puro.js')
const perg = acaoDoCartao({ responder: { conversa: 'c', id: 'q1', perguntas: [{ opcoes: ['A', 'B'], multipla: false }] } })
ok(perg.tipo === 'pergunta' && JSON.stringify(botoesDoCartao(perg)[1].envio) === JSON.stringify({ rota: 'responder', corpo: { conversa: 'c', id: 'q1', respostas: [{ opcao: 1 }] } }), 'pergunta de uma questão: cada opção vira botão com o corpo de /api/decisao/responder')
ok(acaoDoCartao({ responder: { conversa: 'c', id: 'q', perguntas: [{ opcoes: ['a'] }, { opcoes: ['b'] }] } }).tipo === 'no-painel' && acaoDoCartao({ responder: { conversa: 'c', id: 'q', perguntas: [{ opcoes: ['a'], multipla: true }] } }).tipo === 'no-painel', 'várias perguntas ou várias escolhas: o cartão manda responder no painel')
const perm = acaoDoCartao({ rotulo: 'permissão', permissaoId: 'remoto:PC:9', conversa: 'c', sempre: true })
const bp = botoesDoCartao(perm)
ok(bp.map((b) => b.envio.corpo.decisao).join() === 'sim,sempre,nao' && bp[0].envio.rota === 'permitir' && bp[0].envio.corpo.id === 'remoto:PC:9' && bp[2].perigo, 'permissão: permitir, sempre (só quando oferecido) e negar, com o id que a VPS encaminha ao PC')
ok(botoesDoCartao(acaoDoCartao({ rotulo: 'permissão', permissaoId: 'p', conversa: 'c' })).length === 2, 'sem "sempre" oferecido, só permitir e negar')
// o formato REAL da pergunta do Coderoom (cockpit2.mjs, pedidos do gancho): rótulo "pergunta", com escolhas e id do gancho
const coderoom = { rotulo: 'pergunta', permissaoId: 'gancho:7', conversa: 'gate:abc', escolhas: ['usar X', 'usar Y'] }
ok(botoesDoCartao(acaoDoCartao(coderoom)).map((b) => b.envio.corpo.decisao).join() === 'escolha:usar X,escolha:usar Y', 'pergunta do Coderoom (rótulo "pergunta" com escolhas) vira botões "escolha:<texto>"')
ok(acaoDoCartao(coderoom, { daqui: false }).tipo === 'no-painel' && acaoDoCartao({ ...coderoom, escolhas: ['a', 'b', 'c', 'd', 'e'] }).tipo === 'no-painel', 'escolha de outra máquina, ou mais de 4, vai para o painel (como o painel faz)')
ok(acaoDoCartao({ rotulo: 'pergunta', pergunta: 'q', arquiteto: { pergunta: 'q' } }).tipo === 'no-painel' && acaoDoCartao({ rotulo: 'pergunta', pergunta: 'q' }).tipo === 'no-painel', 'pergunta do arquiteto, ou sem opções, manda ao painel: nunca "nada a decidir"')
ok(acaoDoCartao({ rotulo: 'permissão', permissaoId: 'p', conversa: null }).tipo === 'no-painel' && acaoDoCartao({ rotulo: 'permissão', permissaoId: 'p', conversa: 'c', dispositivo: 'PC' }, { daqui: false }).tipo === 'no-painel', 'permissão sem conversa, ou de outra máquina sem o encaminhamento, não ganha botão que nunca funciona')
ok(acaoDoCartao({ rotulo: 'permissão', permissaoId: 'p', conversa: 'c', dispositivo: 'PC', deOutraMaquina: 'PC' }, { daqui: false }).tipo === 'permissao', 'permissão do PC encaminhada pela VPS tem botão, como no painel')
ok(acaoDoCartao({ rotulo: 'permissão', permissaoId: 'p', conversa: 'c', comando: 'x'.repeat(500) }).tipo === 'no-painel', 'comando longo demais para ler na sala: sem botão de permitir')
{
  const ep = estadoVR({ espera: [{ tipo: 'agente', id: 'pm', nome: 'n', rotulo: 'permissão', permissaoId: 'p', conversa: 'c', ferramenta: 'Bash', pergunta: 'Rodar testes', comando: 'rm -rf build && npm test', raio: [{ texto: 'apaga a pasta build', perigo: true }, { texto: 'roda os testes' }] }] })
  const c = ep.cartoes[0]
  ok(c.comando === 'rm -rf build && npm test' && c.ferramenta === 'Bash' && c.perigos.join() === 'apaga a pasta build' && c.acao.tipo === 'permissao', 'a permissão leva o comando, a ferramenta e as marcas de perigo, que o cartão mostra antes do botão (achado 2)')
}
{
  // o agrupamento e as exclusões do número do painel (achado 7)
  const tres = (rot, extra = {}) => ['g1', 'g2', 'g3'].map((id) => ({ tipo: 'agente', id, nome: 'p', dispositivo: 'VPS', rotulo: rot, ...extra }))
  ok(estadoVR({ espera: tres('parou') }).contagem.esperando === 1, '3 paradas do mesmo projeto e máquina contam 1, como o grupo do painel')
  ok(estadoVR({ espera: tres('pergunta', { pergunta: 'Mesma?' }) }).contagem.esperando === 1, '3 perguntas iguais contam 1')
  ok(estadoVR({ espera: tres('parou', { resumoIA: { etiqueta: 'testar' } }) }).contagem.esperando === 1, 'grupo só com QA conta 1, como no painel')
  const grp = estadoVR({ espera: tres('parou') }).cartoes[0]
  ok(grp.id === 'grupo:p|VPS' && grp.acao.tipo === 'no-painel', 'o grupo vira um cartão que manda responder uma por uma no painel')
  ok(estadoVR({ projetos: [{ chave: 'pess', pastaPessoal: true }], conectadas: [{ id: 's', projeto: 'pess', estado: 'espera você' }] }).contagem.esperando === 0, 'sessão da pasta pessoal não conta')
  ok(estadoVR({ ocultas: [{ id: 's', oculta: 'depois' }], conectadas: [{ id: 's', projeto: 'x', estado: 'espera você' }] }).contagem.esperando === 0, 'sessão "para depois" não conta')
  const uiP = ler('./src/ui_cockpit2.html')
  ok(uiP.includes('const C2_GRUPO_MIN = 3;') && uiP.includes("&& e.sessao !== 'coderoom');") && uiP.includes("String(e.pergunta).trim().toLowerCase()") && uiP.includes('!pessoalTopo.has(s.projeto) && !idsDecTopo.has(s.id) && !idsDepois.has(s.id)'), 'o agrupamento e as exclusões do painel continuam os que a sala copia')
}
ok(acaoDoCartao({ rotulo: 'parou' }) === null && botoesDoCartao(null).length === 0, 'cartão sem decisão não ganha botão')
ok(angulosDoArco(3).join() === '0,34,-34' && angulosDaMesa(1).join() === '0' && angulosDaMesa(0).length === 0 && Math.max(...angulosDaMesa(12)) <= 80, 'ângulos do arco e da mesa')

const web = ler('./src/web.mjs'), vr = ler('./src/ui_vr.html'), ui = ler('./src/ui_cockpit2.html'), kit = ler('./src/vr/kit.js'), sala = ler('./src/vr/sala.js'), chat = ler('./src/vr/chat.js')
// a regra do painel (no navegador) e a da sala (no servidor) têm de ser a mesma: as duas cópias conferidas aqui
ok(ui.includes("const c2EhQA = (x) => c2Eti(x) === 'testar' && x.rotulo !== 'pergunta' && x.rotulo !== 'permissão' && x.estado !== 'trabalhando'")
  && ui.includes("const c2EhNada = (x) => c2Eti(x) === 'nada' && x.rotulo !== 'pergunta' && x.rotulo !== 'permissão' && x.estado !== 'trabalhando'")
  && ui.includes('esperando.filter((e) => !e.esquecida)'), 'a regra do painel continua a mesma que a sala copia (se mudar lá, mude em src/vrEstado.mjs)')
ok(web.includes("url.pathname === '/vr'") && web.includes("url.pathname === '/api/vr/estado'"), 'rotas da sala e do dado enxuto existem')
ok(/'\/vendor\/three\/three\.module\.js' \|\| url\.pathname === '\/vendor\/three\/three\.core\.js'/.test(web), 'só os dois arquivos do three.js são servidos, por nome')
ok(/'cache-control': 'public, max-age=604800, immutable'/.test(web) && web.includes('THREE_CACHE'), 'three.js com cache de verdade e em memória (o send gravava no-store)')
ok(/\/\^\\\/vr\\\/\(\[a-z0-9-\]\+\)\\\.js\$\//.test(web), 'peças da sala servidas só por nome simples (sem barra nem ponto)')
const versao = readFileSync(new URL('./src/vendor/three/VERSAO', import.meta.url), 'utf8').trim()
ok(existsSync(new URL('./src/vendor/three/LICENSE', import.meta.url)) && ler('./src/vendor/three/three.core.js').includes(`REVISION = '${versao.split('.')[1]}'`), 'three.js com licença, e VERSAO bate com o REVISION do arquivo (' + versao + ')')
ok(vr.includes("requestSession(tipo") && vr.includes("'immersive-vr'") && vr.includes("'immersive-ar'") && vr.includes("fetch('/api/vr/estado'"), 'a página abre VR e o quarto, e lê o dado enxuto')
ok(/AbortSignal\.timeout\(5000\)/.test(vr) && /if \(lendo\) return/.test(vr) && vr.includes('r.status === 401'), 'leitura com limite de tempo, sem pedido acumulado, e o login vencido dito em frase')
ok(vr.includes("'lendo o painel…'") && vr.includes('Nenhum pedido esperando você'), 'antes do dado diz que está lendo; sem pedido, diz por quê (regra 11)')
const chaveCab = /cab\.atualizar\(([^\n]*)\)/.exec(vr)?.[1] || ''
ok(chaveCab && !/\bfps\b/.test(chaveCab), 'a textura grande não repinta por causa dos quadros por segundo (painel próprio, pequeno)')
ok(/tipoAtual = tipo; modo = /.test(vr) && vr.indexOf('await renderer.xr.setSession(s)') < vr.indexOf('tipoAtual = tipo; modo = '), 'o modo só muda depois de a sessão estar de pé')
ok(kit.includes('setFromXRController') && kit.includes("addEventListener('select'") && vr.includes('setAnimationLoop'), 'raio do controle (ou pinça) e laço de quadros')
ok(sala.includes('export const OLHO = 1.2') && vr.includes('function recentrar()'), 'a sala na altura de quem está sentado, com recentrar de verdade')
ok(vr.includes("const ROTAS_ACAO = { responder: '/api/decisao/responder', permitir: '/api/decisao/permitir', parar: '/api/decisao/parar', mensagem: '/api/decisao/mensagem' }") && vr.includes("if (!url) return { ok: false, erro: 'ação desconhecida' }"), 'M2 e M3: a sala só manda para as quatro rotas do painel, lista fechada')
ok(/if \(!armado\) \{\s*armado = true/.test(chat) && chat.includes('ele interrompe o que está fazendo, e a sessão fica aberta'), 'parar (no chat) pede um segundo toque e diz a consequência no primeiro')
// revisão do M2: o cartão é do PEDIDO, não da posição; e o que acabou de mudar não aceita toque
ok(sala.includes('const porId = new Map()') && sala.includes('agir(card.dado.id, d)') && sala.includes('const agora = porId.get(id)'), 'cartão preso ao id: a resposta volta ao cartão certo mesmo se a lista mudou (achado 1)')
ok(/Date\.now\(\) - card\.mudouEm < ESPERA_DEPOIS_DE_MUDAR\) return/.test(sala), 'toque num cartão que mudou há menos de 1,5 s não vale')
ok(sala.includes("(dado?.id || '') + '|' + (dado?.acao?.id || '')"), 'o "enviado" é do pedido (sessão + pergunta): pergunta nova começa limpa (achado 8)')
ok(vr.includes('const PRAZO_ACAO = { responder: 35000, mensagem: 30000 }') && vr.includes('talvez: true') && sala.includes('if (ev && ev.erro && !ev.talvez) mostrarBotoes(agora, true)'), 'responder espera 35 s como o painel, e prazo estourado não devolve os botões (achado 5)')
ok(vr.includes('JA_RESOLVIDO') && vr.includes('fraseDoErro('), 'resposta "já respondido" é resolvida, e erro técnico vira frase (achado 13)')
ok(kit.includes('obj.rotation.set(0, -a, 0)') && !/obj\.lookAt\(0, altura, 0\)/.test(kit), 'noArco gira no espaço local: o recentrar não entorta a sala (achado 9)')
ok((sala.match(/descartar\(/g) || []).length >= 3 && kit.includes('export function descartar'), 'o que sai da sala devolve geometria, material e textura (achado 6)')
ok(web.includes("url.pathname === '/api/vr/estado' && req.method === 'GET'"), 'o dado da sala só responde a leitura')
{
  // contraste das cores de estado sobre o fundo da sala (regra 9: 4,5:1)
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
  const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const cores = [...kit.matchAll(/\{ cor: '(#[0-9a-f]{6})', palavra/g)].map((m) => m[1])
  ok(cores.length === 4 && cores.every((c) => contraste(c, '#0b0e14') >= 4.5), 'as quatro cores de estado passam de 4,5:1 sobre o fundo (' + cores.map((c) => contraste(c, '#0b0e14').toFixed(1)).join(', ') + ')')
}
ok(ui.includes('id="vr-btn"') && /<button type="button" class="tema-btn" id="vr-btn" hidden/.test(ui) && ui.includes('.fonte-ctl .tema-btn[hidden] { display: none !important; }') && ui.includes("isSessionSupported('immersive-vr')"), 'o botão VR do painel é botão, escondido de verdade fora do Quest')
// a sintaxe do script da página (erro de sintaxe num <script type="module"> não dá erro visível nenhum)
const dir = mkdtempSync(join(tmpdir(), 'vr-sintaxe-'))
try {
  const script = /<script type="module">([\s\S]*?)<\/script>/.exec(vr)[1]
  for (const [nome, texto] of [['pagina.mjs', script], ['kit.mjs', kit], ['sala.mjs', sala], ['puro.mjs', ler('./src/vr/puro.js')], ['chat.mjs', chat]]) { writeFileSync(join(dir, nome), texto); execFileSync(process.execPath, ['--check', join(dir, nome)]) }
  ok(true, 'sintaxe do script da página, do kit, da sala e do chat')
} finally { rmSync(dir, { recursive: true, force: true }) }
for (const [nome, t] of [['ui_vr.html', vr], ['kit.js', kit], ['sala.js', sala], ['chat.js', chat]]) ok(!/[—–]/.test(t), nome + ' sem travessão')

// M3: o chat do agente
{
  const { janela } = await import('./src/vr/puro.js')
  const it = [{ tipo: 'voce', texto: 'a' }, { tipo: 'ferramentas', lista: [] }, { tipo: 'agente', texto: 'b' }, { tipo: 'agente', texto: '  ' }, { tipo: 'voce', texto: 'c' }]
  const j0 = janela(it, 0, 2)
  ok(j0.total === 3 && j0.falas.map((f) => f.texto).join('') === 'bc' && j0.temAntes && !j0.temDepois, 'janela: só falas com texto, as últimas, e diz que há mais antigas')
  const j1 = janela(it, 1, 2)
  ok(j1.falas.map((f) => f.texto).join('') === 'ab' && !j1.temAntes && j1.temDepois, 'janela: subir mostra as anteriores')
  ok(janela(null).total === 0 && janela(it, 99).falas.length === 0, 'janela: sem conversa ou subindo além do começo não quebra')
  // mesma rota e mesmo corpo do chat das Sessões (src/ui_cockpit2.html), e a mesma leitura da conversa
  ok(vr.includes("mensagem: '/api/decisao/mensagem'") && chat.includes("rota: 'mensagem', corpo: { conversa, texto }") && ui.includes("fetch('/api/decisao/mensagem'"), 'mensagem da sala vai pela rota do painel, com { conversa, texto }')
  ok(vr.includes("'/api/sessao/conversa?app=1&conversa='") && web.includes("url.pathname === '/api/sessao/conversa'"), 'a sala lê a conversa pela rota das Sessões, com as falas formatadas')
  // o que se manda passa pelo olho dele primeiro: a voz vira rascunho, e só "enviar" manda
  ok(/S\.rascunho = r\.texto; modoRascunho\(true\)/.test(chat) && !/ouvir\(\)[^\n]*aoAgir/.test(chat), 'voz vira rascunho para conferir, nunca envio direto')
  ok(/else \{ S\.rascunho = texto; modoRascunho\(true\)/.test(chat), 'envio que falha devolve o texto ao rascunho')
  ok(/visivel = \(o\) => \{ for \(; o; o = o\.parent\) if \(!o\.visible\) return false/.test(kit), 'o raio só aperta o que está visível com todos os pais (botão de grupo escondido não reage)')
  ok(chat.includes('raio?.anteparo(tela.mesh)') && sala.includes('mostrarCartoes') && vr.includes('sala.mostrarCartoes(!aberto)'), 'chat aberto: o raio não atravessa o painel e os cartões de trás somem')
}
console.log(`test-vr: ${n} verificações, 0 falhas`)
