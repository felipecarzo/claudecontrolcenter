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
    { tipo: 'agente', id: 'a1', projeto: 'cockpit', dispositivo: 'VPS', rotulo: 'pergunta', pergunta: 'Qual cor?   ' + 'x'.repeat(400), opcoes: ['Azul', 'Verde', 'Roxo', 'Preto', 'Branco'], conversa: 'c1' },
    { tipo: 'pendencia', id: 'p1', pergunta: 'tarefa dele, não é agente' },
    { tipo: 'agente', id: 'a2', projeto: 'medialab', dispositivo: 'ALIENWARE-LIPE', rotulo: 'parou', resumo: 'terminei', escreve: false },
    { tipo: 'agente', id: 'a5', projeto: 'velha', rotulo: 'parou', esquecida: true },
    { tipo: 'agente', id: 'a6', projeto: 'qa', rotulo: 'parou', resumoIA: { etiqueta: 'testar' } },
    { tipo: 'agente', id: 'a7', projeto: 'nada', rotulo: 'parou', resumoIA: { etiqueta: 'nada' } },
    { tipo: 'agente', id: 'a8', projeto: 'perg', rotulo: 'pergunta', resumoIA: { etiqueta: 'nada' }, pergunta: 'pergunta nunca sai' },
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
ok(e.cartoes[0].opcoes.length === 4, 'no máximo 4 opções por cartão')
ok(e.cartoes[1].pergunta === 'terminei' && e.cartoes[1].escreve === false, 'sem pergunta usa o resumo; respeita quem não aceita texto')
ok(e.agentes.find((a) => a.id === 'a1').estado === 'esperando', 'agente com cartão esperando aparece como esperando')
ok(e.agentes.find((a) => a.id === 'a3').estado === 'trabalhando' && e.agentes.find((a) => a.id === 'a4').estado === 'falhou', 'trabalhando e falhou com a palavra')
ok(e.agentes.find((a) => a.id === 'a10').esquecida === true, 'agente esquecido vem marcado')
ok(estadoVR({ espera: [{ tipo: 'agente', id: 'o', opcoes: [{ label: 'Sim' }, { texto: 'Não' }, 7] }] }).cartoes[0].opcoes.join('|') === 'Sim|Não|', 'opção como objeto vira o texto dela, nunca [object Object]')
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
ok(botoesDoCartao(acaoDoCartao({ rotulo: 'permissão', permissaoId: 'g', escolhas: ['usar X', 'usar Y'] })).map((b) => b.envio.corpo.decisao).join() === 'escolha:usar X,escolha:usar Y', 'escolha do Coderoom vai como "escolha:<texto>"')
ok(acaoDoCartao({ rotulo: 'parou' }) === null && botoesDoCartao(null).length === 0, 'cartão sem decisão não ganha botão')
ok(angulosDoArco(3).join() === '0,34,-34' && angulosDaMesa(1).join() === '0' && angulosDaMesa(0).length === 0 && Math.max(...angulosDaMesa(12)) <= 80, 'ângulos do arco e da mesa')

const web = ler('./src/web.mjs'), vr = ler('./src/ui_vr.html'), ui = ler('./src/ui_cockpit2.html'), kit = ler('./src/vr/kit.js'), sala = ler('./src/vr/sala.js')
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
ok(vr.includes("const ROTAS_ACAO = { responder: '/api/decisao/responder', permitir: '/api/decisao/permitir', parar: '/api/decisao/parar' }") && vr.includes("if (!url) return { ok: false, erro: 'ação desconhecida' }"), 'M2: a sala só manda para as três rotas do painel, lista fechada')
ok(/if \(!armado\) \{ armado = true/.test(sala), 'parar pede um segundo toque (desfaz trabalho)')
ok(ui.includes('id="vr-btn"') && /<button type="button" class="tema-btn" id="vr-btn" hidden/.test(ui) && ui.includes('.fonte-ctl .tema-btn[hidden] { display: none !important; }') && ui.includes("isSessionSupported('immersive-vr')"), 'o botão VR do painel é botão, escondido de verdade fora do Quest')
// a sintaxe do script da página (erro de sintaxe num <script type="module"> não dá erro visível nenhum)
const dir = mkdtempSync(join(tmpdir(), 'vr-sintaxe-'))
try {
  const script = /<script type="module">([\s\S]*?)<\/script>/.exec(vr)[1]
  for (const [nome, texto] of [['pagina.mjs', script], ['kit.mjs', kit], ['sala.mjs', sala], ['puro.mjs', ler('./src/vr/puro.js')]]) { writeFileSync(join(dir, nome), texto); execFileSync(process.execPath, ['--check', join(dir, nome)]) }
  ok(true, 'sintaxe do script da página, do kit e da sala')
} finally { rmSync(dir, { recursive: true, force: true }) }
for (const [nome, t] of [['ui_vr.html', vr], ['kit.js', kit], ['sala.js', sala]]) ok(!/[—–]/.test(t), nome + ' sem travessão')
console.log(`test-vr: ${n} verificações, 0 falhas`)
