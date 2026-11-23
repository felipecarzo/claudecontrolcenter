#!/usr/bin/env node
/**
 * CC-1076: o guia de uma frente, escrito pelo Haiku e disparado por código.
 *
 * Casa falsa (HOME e CC_HOME), projeto de mentira e `claude` falso no PATH: o modelo de verdade NUNCA é chamado.
 * Casos do plano: a (frente toda em PR/OK com evento novo: dispara uma vez), b (de novo: não), c (item andando: não),
 * d (id novo em PR depois do guia: dispara de novo), e (--ensaio não chama o modelo), f (citação inexistente apontada,
 * existente aceita), g (teto por hora), h (falha do modelo passa e grava o log), i (CC_GUIA_HAIKU=1 não dispara o gancho).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathComFalso, WIN } from './test/windows.mjs'
import { fileURLToPath } from 'node:url'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const CASA = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1076-'))
const CC_HOME = path.join(CASA, '.claude')
const PROJ = path.join(CASA, 'projeto')
const GUIAS = path.join(PROJ, 'docs', 'guias', 'capacidades')
const BIN = path.join(CASA, 'bin')
for (const d of [CC_HOME, GUIAS, BIN, path.join(PROJ, 'src')]) fs.mkdirSync(d, { recursive: true })
fs.writeFileSync(path.join(PROJ, 'src', 'a.mjs'), 'linha 1\nlinha 2\nlinha 3\n')
fs.writeFileSync(path.join(GUIAS, 'INDICE.md'), '# Guias\n\n| função | guia | itens do backlog | código (arquivos) | atualizado | manual |\n|---|---|---|---|---|---|\n')
fs.writeFileSync(path.join(CC_HOME, 'control-center.json'), JSON.stringify({ hooks: { 'guia-frente': true } }))

process.env.CC_HOME = CC_HOME // o estado dos ganchos lê o config da casa falsa, nunca o de verdade
let falhas = 0
const ok = (cond, msg) => { if (!cond) { falhas++; console.error(`FALHOU: ${msg}`) } else console.log(`ok ${msg}`) }

const item = (id, estado, extra = {}) => JSON.stringify({ id, titulo: `Função ${id}`, estado, frente: 'teste', natureza: 'PED', intencao: `Criar ${id}`, pronto: `${id} pronta`, conferir: 'olhar', ...extra })
const evento = (id, para = 'PR', msDepois = -60000) => ({ em: new Date(Date.now() + msDepois).toISOString(), tipo: 'estado', id, de: 'EM', para })
const mundo = (itens, eventos = []) => {
  fs.writeFileSync(path.join(PROJ, 'docs', 'backlog.jsonl'), itens.join('\n') + '\n')
  fs.writeFileSync(path.join(PROJ, 'docs', 'eventos.jsonl'), eventos.map((e) => JSON.stringify(e)).join('\n') + (eventos.length ? '\n' : ''))
}
const zerarCobertura = () => fs.rmSync(path.join(CASA, '.local'), { recursive: true, force: true })


/* o claude falso: conta a chamada, grava entrada, argumentos e ambiente, e devolve FAKE_SAIDA (ou falha, conforme FAKE_MODO) */
const FALSO = path.join(BIN, 'claude')
fs.writeFileSync(FALSO, [
  '#!/bin/bash',
  'cat > "$FAKE_ENTRADA"',
  'echo x >> "$FAKE_ENTRADA.n"',
  'echo "$@" > "$FAKE_ENTRADA.args"',
  'echo "$CC_GUIA_HAIKU $CC_CONFERENTE" > "$FAKE_ENTRADA.env"',
  'case "$FAKE_MODO" in',
  '  erro) echo "boom" >&2; exit 1;;',
  'esac',
  'cat "$FAKE_SAIDA"',
].join('\n'))
fs.chmodSync(FALSO, 0o755)
const FAKE_ENTRADA = path.join(CASA, 'fake-entrada.txt')
const FAKE_SAIDA = path.join(CASA, 'fake-saida.json')
const chamadas = () => { try { return fs.readFileSync(`${FAKE_ENTRADA}.n`, 'utf8').split('\n').filter(Boolean).length } catch { return 0 } }
const GUIA_FALSO = '# Titulo do modelo\n\n## 1. Estado\nPronto \u2014 em prova. Ver `src/a.mjs:2` e `src/a.mjs:99` e `src/nao-existe.mjs:1`.\n\n## Não verificado\n- nada\n'
const guiaFalso = (texto = GUIA_FALSO) => fs.writeFileSync(FAKE_SAIDA, JSON.stringify({ result: texto, modelUsage: { 'claude-haiku-falso': { inputTokens: 1 } }, usage: { input_tokens: 10, output_tokens: 20 } }))
guiaFalso()
const ENV = { ...process.env, HOME: CASA, USERPROFILE: CASA, CC_HOME, PATH: pathComFalso(BIN, 'claude'), FAKE_ENTRADA, FAKE_SAIDA } // CC-1118: homedir e PATH do Windows, nunca o claude real
for (const k of ['CLAUDE_CODE_ENTRYPOINT', 'CC_CONFERENTE', 'CC_GUIA_HAIKU', 'FAKE_MODO']) delete ENV[k]
const rodar = (args, { env = {}, entrada = '\n' } = {}) => {
  const r = spawnSync('node', args, { input: entrada, env: { ...ENV, ...env }, encoding: 'utf8', cwd: PROJ, timeout: 30000 })
  return { codigo: r.status, out: r.stdout || '', err: r.stderr || '' }
}
const espera = (cond, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (cond()) return true; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100) } return false }
const GUIA = path.join(GUIAS, 'teste.md')
const LOG = path.join(CASA, 'logs', 'guia-haiku.log')
const linhasDoLog = () => { try { return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }
const stop = (extra = {}, env = {}) => rodar([path.join(RAIZ, 'hooks', 'guia-frente.mjs')], { entrada: JSON.stringify({ hook_event_name: 'Stop', cwd: PROJ, session_id: 'sx', transcript_path: path.join(CASA, 'conversa.jsonl'), ...extra }), env })
/* uma conversa de verdade: fala dele e da IA, mais saída de ferramenta que NÃO pode entrar no material */
fs.writeFileSync(path.join(CASA, 'conversa.jsonl'), [
  { type: 'user', message: { role: 'user', content: 'quero a função teste' } },
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Feito, a função teste existe.' }] } },
  { type: 'user', toolUseResult: { ok: 1 }, message: { role: 'user', content: [{ type: 'tool_result', content: 'SAIDA-DE-FERRAMENTA-SECRETA' }] } },
].map((l) => JSON.stringify(l)).join('\n') + '\n')

/* ---------- peça 1: frentesConcluidas ---------- */
const F = await import('./src/frenteConcluida.mjs')
const rodaF = (extra = {}) => F.frentesConcluidas(PROJ, { home: CASA, ...extra })

mundo([item('CC-1', 'PR'), item('CC-2', 'OK')], [evento('CC-1')])
let r = rodaF()
ok(r.length === 1 && r[0].frente === 'teste' && r[0].novos.length === 2, 'a: frente toda em PR/OK com evento novo é devolvida')
ok(rodaF().length === 0, 'b: a mesma frente de novo não é devolvida')
zerarCobertura()
mundo([item('CC-1', 'PR'), item('CC-2', 'EM')], [evento('CC-1')])
ok(rodaF().length === 0, 'c: frente com item andando não é devolvida')
mundo([item('CC-1', 'PR'), item('CC-2', 'B1', { lugar: { onde: 'fora' } }), item('CC-3', 'KO'), item('CC-4', 'EM', { pai: 'CC-1' })], [evento('CC-1')])
ok(rodaF({ gravar: false }).length === 1, 'c: item fora do MVP, cancelado e micro tarefa (pai) não contam contra')
mundo([item('CC-1', 'PR')], [evento('CC-1', 'PR', -3 * 3600e3)])
ok(rodaF({ gravar: false }).length === 0, 'a: sem evento nos últimos 30 min não devolve')
mundo([item('CC-1', 'PR'), item('CC-2', 'PR')], [evento('CC-2')])
ok(rodaF({ gravar: false })[0].novos.length === 2 && rodaF({ gravar: false }).length === 1, 'ensaio (gravar:false) não marca como coberto')
zerarCobertura()
mundo([item('CC-1', 'PR')], [evento('CC-1')])
rodaF()
mundo([item('CC-1', 'PR'), item('CC-5', 'PR')], [evento('CC-5')])
r = rodaF()
ok(r.length === 1 && r[0].novos.join() === 'CC-5', 'd: id novo em PR depois do guia dispara de novo, só com o id novo em "novos"')
ok(F.slugDaFrente('Jogo do evento') === 'jogo-do-evento', 'slug da frente')


/* ---------- peça 2: guiaHaiku ---------- */
const H = await import('./src/guiaHaiku.mjs')
const mat = H.montarMaterial(PROJ, 'teste', { transcrito: path.join(CASA, 'conversa.jsonl') })
ok(mat.texto.includes('quero a função teste') && mat.texto.includes('a função teste existe') && !mat.texto.includes('SAIDA-DE-FERRAMENTA-SECRETA'), 'material: leva a fala dele e da IA e NÃO leva saída de ferramenta')
ok(H.montarMaterial(PROJ, 'nao-existe').erro, 'material: frente inexistente dá erro')
const c = H.conferirCitacoes('veja `src/a.mjs:2`, src/a.mjs:99, src/nao-existe.mjs:1, ../fora.mjs:1 e src/a.mjs:2-3', PROJ)
ok(c.total === 5 && c.certas === 2 && c.ruins.length === 3 && c.ruins.some((r) => r.citacao === 'src/a.mjs:99' && /linha não existe/.test(r.motivo)) && c.ruins.some((r) => /não existe/.test(r.motivo)), 'f: citação que existe é aceita; arquivo ou linha que não existe é apontada')

/* e: o --ensaio não chama o modelo */
mundo([item('CC-1', 'PR'), item('CC-2', 'OK')], [evento('CC-1')])
let n0 = chamadas()
let x = rodar([path.join(RAIZ, 'cc.mjs'), 'guia', 'frente', 'teste', '--ensaio'])
ok(x.codigo === 0 && /2 itens/.test(x.out) && /bytes de material/.test(x.out) && /nenhum modelo foi chamado/.test(x.out) && chamadas() === n0 && !fs.existsSync(GUIA), 'e: o --ensaio mostra tamanho e itens, não chama o modelo e não grava guia')

/* CC-1118: do caso a até o --saida tudo depende do claude falso (script de shell), que o Windows não executa */
if (WIN) console.log('PULADO no Windows: casos a até h e --saida do guia-frente (o claude falso é script de shell, o Windows só executa .exe)')
else {
/* a: o gancho dispara uma vez; o filho solto escreve o guia */
zerarCobertura()
mundo([item('CC-1', 'PR'), item('CC-2', 'OK')], [evento('CC-1')])
n0 = chamadas()
x = stop()
ok(x.codigo === 2 && x.err.startsWith('[guia-frente]') && x.err.includes('teste') && !x.err.includes('\u2014') && !/racioc|pensament/i.test(x.err), 'a: frente pronta, o gancho devolve uma linha e dispara')
ok(espera(() => linhasDoLog().some((l) => l.status === 'gravou')), 'a: o processo solto terminou e gravou no log')
ok(chamadas() === n0 + 1, 'a: uma única chamada ao modelo')
const args = fs.readFileSync(`${FAKE_ENTRADA}.args`, 'utf8')
ok(/--model haiku/.test(args) && /--output-format json/.test(args) && /--no-session-persistence/.test(args) && /--tools/.test(args), 'a: chamada com modelo haiku, JSON, sem ferramenta e sem sessão gravada')
ok(fs.readFileSync(`${FAKE_ENTRADA}.env`, 'utf8').trim() === '1 1', 'a: o filho roda com CC_GUIA_HAIKU=1 e CC_CONFERENTE=1')
const pedido = fs.readFileSync(FAKE_ENTRADA, 'utf8')
ok(pedido.includes('arquivo:linha') && pedido.includes('Não verificado') && pedido.includes('11') && pedido.includes('quero a função teste'), 'a: o pedido traz as regras, as 11 partes e o contexto da conversa')
const g = fs.readFileSync(GUIA, 'utf8')
ok(/^itens: CC-1, CC-2$/m.test(g) && /^gerado: haiku$/m.test(g) && /^citacoes: 1 de 3 conferidas$/m.test(g) && /^origem: \d{4}-\d\d-\d\d$/m.test(g) && /^manual:$/m.test(g), 'f: cabeçalho com itens, gerado: haiku, citações 1 de 3 e manual vazio')
ok(g.includes('## Citações que não conferem') && g.includes('`src/a.mjs:99`') && g.includes('`src/nao-existe.mjs:1`'), 'f: a seção das citações que não conferem lista as duas')
ok(!g.includes('\u2014') && !g.includes('\u2013') && !g.includes('# Titulo do modelo'), 'o guia gravado não tem travessão e o título do modelo foi trocado')
ok(/\| \[teste\.md\]\(teste\.md\) \| CC-1, CC-2 \|/.test(fs.readFileSync(path.join(GUIAS, 'INDICE.md'), 'utf8')), 'a linha do guia entrou no INDICE')
const gravou = linhasDoLog().find((l) => l.status === 'gravou')
ok(gravou.modelo === 'claude-haiku-falso' && gravou.citacoes === '1 de 3' && gravou.frente === 'teste' && gravou.tokens?.saida === 20, 'o log tem a hora, a frente, o modelo que respondeu, os tokens e as citações')

/* b: de novo, não dispara */
n0 = chamadas()
x = stop()
ok(x.codigo === 0 && !x.err, 'b: a mesma frente de novo não dispara')
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
ok(chamadas() === n0, 'b: e nenhuma chamada ao modelo')

/* stop_hook_active passa */
ok(stop({ stop_hook_active: true }).codigo === 0, 'stop_hook_active passa')

/* d: id novo em PR depois do guia */
mundo([item('CC-1', 'PR'), item('CC-2', 'OK'), item('CC-3', 'PR')], [evento('CC-3')])
n0 = chamadas()
x = stop()
ok(x.codigo === 2 && espera(() => chamadas() === n0 + 1), 'd: id novo em PR depois do guia dispara de novo')
espera(() => linhasDoLog().filter((l) => l.status === 'gravou').length === 2)
ok(/^origem: /m.test(fs.readFileSync(GUIA, 'utf8')) && /^itens: CC-1, CC-2, CC-3$/m.test(fs.readFileSync(GUIA, 'utf8')), 'd: o guia da frente é regerado inteiro, com os três itens')
ok((fs.readFileSync(path.join(GUIAS, 'INDICE.md'), 'utf8').match(/\]\(teste\.md\)/g) || []).length === 1, 'd: a linha do INDICE é trocada, não duplicada')

/* c: item andando não dispara */
zerarCobertura()
mundo([item('CC-1', 'PR'), item('CC-2', 'EM')], [evento('CC-1')])
n0 = chamadas()
ok(stop().codigo === 0 && chamadas() === n0, 'c: frente com item andando não dispara pelo gancho')

/* i: dentro do próprio guia (CC_GUIA_HAIKU) o gancho não dispara de volta */
mundo([item('CC-1', 'PR')], [evento('CC-1')])
n0 = chamadas()
x = stop({}, { CC_GUIA_HAIKU: '1' })
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
ok(x.codigo === 0 && !x.err && chamadas() === n0 && !F.lerCobertura(PROJ, CASA).teste, 'i: CC_GUIA_HAIKU=1 não dispara o gancho, nem marca a frente')
ok(stop({}, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' }).codigo === 0, 'i: claude -p também não dispara')
const { conferirTeto } = await import('./hooks/teto-robo.mjs')
ok(conferirTeto({ cwd: PROJ, env: { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli', CC_GUIA_HAIKU: '1' }, home: CASA }) === null, 'i: o teto-robo ignora o CC_GUIA_HAIKU')

/* g: teto por hora */
fs.mkdirSync(path.dirname(LOG), { recursive: true })
fs.writeFileSync(LOG, Array.from({ length: 6 }, () => JSON.stringify({ em: new Date().toISOString(), chamada: true, status: 'gravou' })).join('\n') + '\n')
mundo([item('CC-1', 'PR')], [evento('CC-1')])
n0 = chamadas()
let r2 = H.gerar({ raiz: PROJ, frente: 'teste', home: CASA, env: ENV })
ok(r2.status === 'teto' && chamadas() === n0 && linhasDoLog().some((l) => l.status === 'teto'), 'g: com 6 chamadas na última hora não chama e grava "teto" no log')
fs.writeFileSync(LOG, Array.from({ length: 6 }, () => JSON.stringify({ em: new Date(Date.now() - 2 * 3600e3).toISOString(), chamada: true })).join('\n') + '\n')
ok(H.gerar({ raiz: PROJ, frente: 'teste', home: CASA, env: ENV }).status === 'gravou', 'g: chamadas de mais de uma hora atrás não contam')

/* h: falha do modelo passa e grava o log */
fs.rmSync(LOG)
const antes = fs.readFileSync(GUIA, 'utf8')
n0 = chamadas()
x = rodar([path.join(RAIZ, 'src', 'guiaHaiku.mjs'), '--raiz', PROJ, '--frente', 'teste'], { env: { FAKE_MODO: 'erro' } })
const falha = linhasDoLog().find((l) => l.status === 'erro')
ok(x.codigo === 0 && falha && /saiu com 1/.test(falha.erro) && chamadas() === n0 + 1 && fs.readFileSync(GUIA, 'utf8') === antes, 'h: falha do modelo passa (saída 0), grava o erro no log, tenta uma vez só e não mexe no guia')

/* ---------- correção de 30/10: o ESTADO vem do código ---------- */
mundo([item('CC-1', 'PR'), item('CC-2', 'OK'), item('CC-3', 'EM')], [evento('CC-1')])
const est = H.estadoReal(PROJ, 'teste')
ok(est.itens.find((i) => i.id === 'CC-1').palavra === 'em prova' && est.itens.find((i) => i.id === 'CC-3').palavra === 'andando' && est.itens.find((i) => i.id === 'CC-2').palavra === 'fechado', 'estado real: cada item da frente com o estado atual do backlog (em prova, andando, fechado)')
const eh = (id) => est.hooks.find((h) => h.id === id)
ok(eh('guia-fim').estado === 'aposentado' && eh('guia-frente').estado === 'ligado' && eh('guia-guard').estado !== 'aposentado' && est.guardas.includes('guia-frente') && !est.guardas.includes('guia-fim'), 'estado real: ganchos (aposentado, ligado pelo interruptor) e a lista real de GUARDAS')
const m2 = H.montarMaterial(PROJ, 'teste')
const iE = m2.texto.indexOf('## ESTADO REAL')
ok(iE > 0 && iE < m2.texto.indexOf('## Itens da frente') && m2.texto.includes('- CC-3: andando') && m2.texto.includes('- guia-fim: aposentado') && /MANDA e vence/.test(m2.texto), 'material: o bloco ESTADO REAL vem antes de tudo, com os estados e a ordem de que manda')
ok(/## Planos dos itens \(HISTÓRICO, pode estar desatualizado/.test(m2.texto) && /Conversa da sessão[^\n]*HISTÓRICO/.test(m2.texto), 'material: plano e conversa entram rotulados como histórico')
ok(/SÓ do bloco "ESTADO REAL"/.test(H.montarPedido('teste', m2.texto)) && /vale o bloco/.test(H.montarPedido('teste', m2.texto)), 'pedido: manda tirar estado só do bloco e dizer a contradição em "Não verificado"')
const GUIA_ERRADO = 'CC-1 está em andamento. CC-2 fechado.\nO gancho `guia-fim` está ativo. O `guia-frente` roda. O `guia-fim` está aposentado. CC-1 não está em andamento. CC-3 andando.'
const ce = H.conferirEstado(GUIA_ERRADO, est)
ok(ce.total === 6 && ce.certas === 4 && ce.falhas.length === 2 && ce.falhas.some((f) => f.id === 'CC-1' && f.dito === 'em andamento' && f.real === 'em prova') && ce.falhas.some((f) => f.id === 'guia-fim' && f.real === 'aposentado'), 'estado: guia falso que erra de propósito é apontado (item em prova dito andando, gancho aposentado dito ativo); o certo e a negação passam')
const cl = H.conferirEstado('Estão em prova (CC-1 e CC-2) ou andando (CC-3). Ficaram fechados: CC-2.', est)
ok(cl.total === 4 && cl.certas === 3 && cl.falhas.length === 1 && cl.falhas[0].id === 'CC-2' && cl.falhas[0].real === 'fechado', 'estado: lista de ids vale como grupo (palavra antes do grupo, ou depois com verbo de ligação), e "(A) ou andando" não atribui a palavra ao grupo errado')
ok(H.conferirEstado('Nada de estado aqui, só `src/a.mjs:1`.', est).total === 0, 'estado: texto sem afirmação de estado não conta')
const ca = H.conferirCitacoes('veja a.mjs:2, b.mjs:1 e src/a.mjs:3', PROJ, ['src/a.mjs', 'tools/b.mjs', 'hooks/b.mjs'])
ok(ca.texto.includes('src/a.mjs:2') && ca.texto.includes(' b.mjs:1') && ca.certas === 2 && ca.ruins.length === 1 && ca.ruins[0].citacao === 'b.mjs:1', 'citação só com o nome: um arquivo na lista vira caminho completo e confere; dois com o mesmo nome fica como está e não confere')
/* terceira correção: MENÇÃO a gancho desligado ou aposentado */
const m1 = H.conferirEstado('O `guia-fim` verifica o fim de cada resposta e avisa.', est)
ok(m1.total === 1 && m1.certas === 0 && m1.falhas.length === 1 && m1.falhas[0].id === 'guia-fim' && m1.falhas[0].real === 'aposentado' && /guia-fim/.test(m1.falhas[0].dito), 'menção: gancho aposentado descrito como ativo, sem palavra de estado, é apontado (nome, estado real e trecho)')
const m2b = H.conferirEstado('O `guia-fim` foi aposentado. O guia-contexto não roda mais. O `guia-frente` dispara o guia ao fechar a frente.', est)
ok(m2b.falhas.length === 0 && m2b.certas === m2b.total, 'menção: gancho aposentado dito aposentado e gancho ligado não são apontados')
const m3 = H.conferirEstado('O `guia-fim` está ativo e verifica o fim.', est)
ok(m3.falhas.length === 1 && m3.total === 1, 'menção: afirmação de estado errada não conta duas vezes')
ok(/Os ganchos desligados ou aposentados estão listados na seção 1; não os descreva como ativos/.test(H.montarPedido('teste', 'x')), 'pedido: manda não descrever desligado ou aposentado como ativo')
ok(H.TEMPO_MS === 180000, 'tempo por chamada: 180 s')

/* --saida: grava lá, não mexe no INDICE nem na pasta de guias */
guiaFalso('## 1. Estado\nCC-1 está em andamento e CC-2 fechado. O `guia-fim` está ativo. Ver `a.mjs:2`.\n\n## Não verificado\n- nada\n')
const SAIDA = path.join(CASA, 'fora', 'prova.md')
const indiceAntes = fs.readFileSync(path.join(GUIAS, 'INDICE.md'), 'utf8'); const guiaAntes = fs.readFileSync(GUIA, 'utf8')
mundo([item('CC-1', 'PR'), item('CC-2', 'OK')], [evento('CC-1')])
fs.writeFileSync(path.join(PROJ, 'src', 'b.mjs'), 'x\n')
fs.writeFileSync(path.join(PROJ, 'docs', 'CC-1.md'), 'plano em src/a.mjs\n')
n0 = chamadas()
x = rodar([path.join(RAIZ, 'cc.mjs'), 'guia', 'frente', 'teste', '--saida', SAIDA])
const gs = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8') : ''
ok(x.codigo === 0 && chamadas() === n0 + 1 && /estado 1 de 3/.test(x.out), '--saida: o comando imprime o estado conferido')
ok(/^estado: 1 de 3 afirmações conferem$/m.test(gs) && /^citacoes: 1 de 1 conferidas$/m.test(gs) && gs.includes('## Afirmações de estado que não conferem') && gs.includes('CC-1: o guia diz "em andamento", o estado real é "em prova"') && gs.includes('guia-fim: o guia diz "ativo", o estado real é "aposentado"'), '--saida: cabeçalho com estado X de Y e a seção das afirmações que não conferem (citação a.mjs:2 corrigida para src/a.mjs:2)')
ok(fs.readFileSync(path.join(GUIAS, 'INDICE.md'), 'utf8') === indiceAntes && fs.readFileSync(GUIA, 'utf8') === guiaAntes, '--saida: não mexe no INDICE nem no guia da pasta')
ok(linhasDoLog().some((l) => l.status === 'gravou' && l.estado === '1 de 3'), 'log: leva o estado conferido')

/* ---------- segunda correção: a seção 1 sai do código, o Haiku não conta nem dá estado ---------- */
mundo([item('CC-1', 'PR'), item('CC-2', 'OK'), item('CC-3', 'EM', { titulo: 'Terceira | função' }), item('CC-9', 'PR', { frente: 'outra' })], [evento('CC-1')])
const est2 = H.estadoReal(PROJ, 'teste')
ok(est2.outros.length === 1 && est2.outros[0].id === 'CC-9' && est2.itens.length === 3, 'estado real: guarda os itens de outras frentes à parte')
const s1 = H.secaoEstado('teste', est2, ['hooks/guia-frente.mjs', 'hooks/guia-fim.mjs', 'src/a.mjs'])
ok(s1.startsWith('## 1. Estado e para quem vale') && s1.includes('| CC-3 | Terceira / função | andando |') && s1.includes('| CC-1 | Função CC-1 | em prova |') && !s1.includes('CC-9')
  && /Contagem por estado: em prova 1, fechado 1, andando 1\./.test(s1) && s1.includes('| guia-frente | ligado |') && s1.includes('| guia-fim | aposentado |') && !s1.includes('| src/a.mjs')
  && new RegExp(`Ganchos ligados no catálogo agora: ${est2.hooks.filter((h) => h.estado === 'ligado').length} de ${est2.hooks.length}\\.`).test(s1), 'seção 1: tabela dos itens DA frente, contagens por estado, ganchos do código com estado e total de ligados')
const TEXTO_RUIM = 'Há cinco itens na frente e 35 ganchos ligados. CC-9 está em prova. Cada função chama outra. Existem dois ganchos aqui. O CC-1 está em prova.'
const cr = H.conferirEstado(TEXTO_RUIM, est2)
ok(cr.total === 5 && cr.certas === 1 && cr.falhas.length === 4 && cr.falhas.some((f) => f.id === 'CC-9' && /não é item desta frente/.test(f.real)) && cr.falhas.filter((f) => /contagem/.test(f.real)).length === 3
  && cr.falhas.some((f) => /35 ganchos/.test(f.id)) && cr.falhas.some((f) => /contagem de ganchos é da seção 1/.test(f.real)), 'estado: id de outra frente com palavra de estado e TODA contagem de itens ou ganchos são apontados; o id da frente dito certo passa')
guiaFalso('## 2. Funções\nHá cinco itens e 35 ganchos ligados. CC-9 está em prova. Ver `src/a.mjs:2`.\n\n## Não verificado\n- nada\n')
const SAIDA2 = path.join(CASA, 'fora', 'prova2.md')
x = rodar([path.join(RAIZ, 'cc.mjs'), 'guia', 'frente', 'teste', '--saida', SAIDA2])
const g2 = fs.existsSync(SAIDA2) ? fs.readFileSync(SAIDA2, 'utf8') : ''
ok(x.codigo === 0 && /estado 0 de 3/.test(x.out) && g2.indexOf('## 1. Estado e para quem vale') < g2.indexOf('## 2. Funções') && g2.includes('| CC-3 | Terceira / função | andando |') && !g2.includes('cinco itens na frente')
  && g2.includes('## Afirmações de estado que não conferem') && g2.includes('CC-9: o guia diz "em prova"') && g2.includes('35 ganchos'), 'guia gravado: a seção 1 do script vem antes das do modelo e está certa apesar do texto falso; as três falhas aparecem no fim')
ok(/SÓ estas partes/.test(fs.readFileSync(FAKE_ENTRADA, 'utf8')) && !/\n1\. Estado e para quem vale/.test(fs.readFileSync(FAKE_ENTRADA, 'utf8')) && /\n2\. O que a ferramenta/.test(fs.readFileSync(FAKE_ENTRADA, 'utf8')) && /NÃO ESCREVA CONTAGEM/.test(fs.readFileSync(FAKE_ENTRADA, 'utf8')), 'pedido: pede só as partes 2 a 11 e proíbe contagem e estado')
/* claude falso: guia-fim como ativo (apontado), como aposentado (não), guia-frente ligado (não) */
guiaFalso('## 2. Funções\nO `guia-fim` verifica o fim da resposta. O `guia-fim` foi aposentado. O `guia-frente` dispara ao fechar. Ver `src/a.mjs:2`.\n\n## Não verificado\n- nada\n')
const SAIDA3 = path.join(CASA, 'fora', 'prova3.md')
x = rodar([path.join(RAIZ, 'cc.mjs'), 'guia', 'frente', 'teste', '--saida', SAIDA3])
const g3 = fs.existsSync(SAIDA3) ? fs.readFileSync(SAIDA3, 'utf8') : ''
ok(x.codigo === 0 && /estado 1 de 2/.test(x.out) && /^- guia-fim: o guia diz "menção a "guia-fim"[^\n]*o estado real é "aposentado"/m.test(g3) && (g3.match(/^- guia-/gm) || []).length === 1, 'guia gravado: menção a gancho aposentado como ativo é apontada; dito aposentado e gancho ligado não')
} // fim do trecho que depende do claude falso (CC-1118)

/* o parada.mjs despacha o guia-frente, e os dois antigos saíram da lista */
const P = await import('./hooks/parada.mjs?lista')
ok(P.GUARDAS.includes('guia-frente') && !P.GUARDAS.includes('guia-fim') && !P.GUARDAS.includes('guia-contexto'), 'parada: guia-frente entrou na lista e guia-fim e guia-contexto saíram')
const { hookDe } = await import('./src/hooksCatalogo.mjs')
const hn = hookDe('guia-frente')
ok(hn?.padrao === true && hn.implementado === true && hn.evento === 'Stop', 'catálogo: guia-frente é padrão e implementado')
for (const id of ['guia-fim', 'guia-contexto']) ok(hookDe(id)?.padrao === false && hookDe(id)?.implementado === false, `catálogo: ${id} aposentado (padrao e implementado falsos)`)
const { EXPLICA } = await import('./src/hooksExplica.mjs')
ok(typeof EXPLICA['guia-frente'] === 'string', 'hooksExplica: tem a entrada do guia-frente')

fs.rmSync(CASA, { recursive: true, force: true })
if (falhas) { console.error(`\n${falhas} falha(s)`); process.exit(1) }
console.log('\nCC-1076: todas as peças conferidas')
