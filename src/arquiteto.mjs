/**
 * CC-867: o arquiteto em modo Product Owner. Etapa 1: o cérebro.
 *
 * Pedido dele em 02/10: "quero que ele SEMPRE faça tudo em modo pergunta pra
 * mim, eu não quero desenvolver, eu quero ser só o product owner com esse
 * arquiteto". Plano aprovado em docs/CC-867.md.
 *
 * A regra é a do Nisaba: a IA sugere, a regra decide. O arquiteto não é um chat
 * solto com o Haiku: este programa junta o estado do projeto (`lerEstado`),
 * pede UMA proposta ao Haiku (`propor`) e confere a proposta por contrato
 * (`validarProposta`) antes de ela virar pergunta. Proposta fora do formato é
 * recusada, nunca interpretada.
 *
 *   node src/arquiteto.mjs --pasta <projeto> --propor     uma proposta, só imprime (etapa 1)
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import http from 'node:http'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as B from './backlog.mjs'
import { itemDoBacklog, violacoes } from './auditoria.mjs'
import { enderecoDe, fotografar, fotografarUrl } from './gateFotos.mjs'
import { lerCabecalho as lerCabecalhoGate } from './gate.mjs'
import { limparSegredos } from './segredo.mjs'
import { resolverBinario } from './paineis.mjs'
import { fecharEntrevista, gravar as gravarFramework, ler as lerFramework } from './frameworkDisco.mjs'
import { desfazer as desfazerEntrevista, itensDoBacklog, proxima as proximaEntrevista, respostasDe, responder as responderEntrevista } from './entrevista.mjs'
import { avancar } from './framework.mjs'
import { catalogoDe } from './frentes.mjs'
import { frenteAtual } from './emenda.mjs'
import * as P from './produto.mjs'

/* ATENÇÃO, medido em 02/10: neste Claude Code, `--model haiku` é atendido pelo claude-sonnet-5
   (o transcrito e o `modelUsage` dizem isso). O Haiku de verdade é `claude-haiku-4-5-20251001`,
   cerca de 4x mais barato por chamada. Decisão dele em 02/10: manter assim, o uso é quase nulo
   (~US$ 2 de referência no Conta de Casa) e a qualidade aprovada é a do Sonnet. */
export const MODELO_ARQUITETO = process.env.CC_ARQUITETO_MODELO || 'haiku'
export const TIPOS_PROPOSTA = ['ideia', 'pedido', 'revisao', 'melhoria']
const TETOS = { titulo: 80, porqueMin: 10, porque: 500, perguntaMin: 10, pergunta: 300, opcoes: [2, 4], opcao: 120, pedidoMin: 10, pedido: 600 }

/** O que o arquiteto sabe do projeto antes de propor. Só leitura, tudo do disco. */
export function lerEstado(cwd) {
  const arq = B.caminhoPadrao(cwd)
  const { itens } = B.ler(arq)
  const fila = B.filaDoAgente(itens)
  let fw = null
  try { fw = JSON.parse(fs.readFileSync(path.join(cwd, '.framework', 'estado.json'), 'utf8')) } catch { /* sem framework */ }
  let agents = ''; try { agents = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8') } catch { /* sem memorial */ }
  const escopo = /## Escopo do projeto\n([\s\S]*?)(\n## |$)/.exec(agents)?.[1]?.trim() || null
  let eventos = []
  try {
    eventos = fs.readFileSync(B.caminhoEventos(arq), 'utf8').split(/\r?\n/).filter(Boolean)
      .flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
  } catch { /* sem diário */ }
  const resumo = (x) => ({ id: x.id, intencao: x.intencao || x.titulo, estado: x.estado, origem: x.origem || null })
  /* O furo do "casal" (CN-26): ele tinha dito na entrevista que o app é só dele, e a proposta não via
     essas respostas. Entram inteiras, e as perguntas já feitas com a escolha dele. */
  const entrevista = fw ? Object.fromEntries(Object.entries(respostasDe(fw)).map(([k, r]) => [k, String(r?.texto || '').slice(0, 300)])) : {}
  const jaPerguntadas = itens.filter((x) => x.origem === 'arquiteto' && x.proposta?.tipo !== 'entrevista' && x.estado === 'OK' && x.decisao)
    .slice(-12).map((x) => ({ id: x.id, pergunta: String(x.decisao).slice(0, 200), ele_escolheu: String(x.escolha || '').slice(0, 200) }))
  return {
    projeto: path.basename(cwd),
    fase: fw?.fase || null,
    metodo: fw?.metodo || null,
    mvp: fw?.mvp || null,
    escopo,
    respostasDaEntrevista: entrevista,
    /* CC-904: o que ELE já aprovou. Sem isto o arquiteto lia fichas velhas ("login: em andamento") e propôs construir o
       login de novo, e o robô construiu duas vezes. */
    jaConstruidoEAprovado: itens.filter((x) => x.origem === 'arquiteto' && x.proposta?.tipo === 'revisao' && x.estado === 'OK' && /^est[aá] bom/i.test(String(x.escolha || '')))
      .map((x) => ({ id: x.id, o_que: String(x.titulo || '').replace(/^Revisar: (Faltou parte: )?/, '') })),
    perguntasJaFeitas: jaPerguntadas,
    abertos: itens.filter((x) => B.estaAberto(x) && !x.pai).length,
    // os itens que ELE criou entram na fila que a IA enxerga, mesmo os que nascem "ele confere" (07/10: a IA não via o CN-129)
    fila: [...fila.dele.filter((x) => x.origem === 'felipe'), ...fila.sozinho].slice(0, 10).map(resumo),
    esperandoDele: fila.dele.slice(0, 10).map(resumo),
    reprovacoes: eventos.filter((e) => e.tipo === 'robo' && e.ok === false).slice(-10).map((e) => ({ id: e.id, erro: String(e.texto || '').split('\n')[0].slice(0, 200) })),
    decisoes: eventos.filter((e) => e.tipo === 'decisao').slice(-10).map((e) => ({ id: e.id, texto: String(e.texto || '').slice(0, 300) })),
  }
}

/** O pedido ao Haiku: o estado, o formato exato e as regras do modo Product Owner. */
export function pedidoDeProposta(estado) {
  return [
    'Você é o arquiteto de um projeto de software e trabalha para o dono do produto (o Felipe), que decide TUDO.',
    'Você não executa nada: propõe UM próximo passo, e ele escolhe entre opções. Ele não é técnico: escreva para quem decide, não para quem programa.',
    'Tipos de proposta: "ideia" (algo novo para o produto), "pedido" (algo do backlog para executar agora), "melhoria" (mudar o PROCESSO de trabalho; só propor, citando números do estado abaixo). Revisão de algo já feito NÃO é sua: o programa faz depois de cada obra. Se ele apontou um defeito (está na fila dele), proponha o pedido que o corrige.',
    'Responda SÓ um JSON, sem texto antes nem depois:',
    '{"tipo":"ideia|pedido|revisao|melhoria","titulo":"até 80 letras","porque":"por que agora, citando o estado","pergunta":"a pergunta para ele, curta","opcoes":["2 a 4 opções concretas e diferentes"],"pedido":"o pedido técnico que o maestro executaria se ele aprovar (obrigatório em pedido)","executa":"em pedido: a opção, copiada igual, que significa sim, construa agora"}',
    'Em "pedido" a pergunta é só para aprovar a construção: a PRIMEIRA opção é o "sim, construa agora" (e vai em "executa"), as outras são não ou ajustar. Escolha de detalhe técnico (stack, banco, framework, biblioteca) NUNCA vira pergunta: decida você e descreva no pedido.',
    'Em "pedido": se ele executa um item da lista "fila" do estado (itens que o dono já escolheu), ponha em "daFila" o id desse item (ex.: CN-16). O programa então constrói SEM perguntar, porque ele já decidiu. Só use se o pedido executa mesmo aquele item, e omita "daFila" em qualquer ideia nova que ele não escolheu.',
    'O que está em "jaConstruidoEAprovado" JÁ EXISTE e ele aprovou: nunca proponha construir de novo, proponha o PRÓXIMO passo do produto.',
    'Se ele já respondeu "sim, começa" a um pedido, o robô vai construir: NUNCA pergunte de novo se pode começar. Respeite as RESPOSTAS DA ENTREVISTA e as DECISÕES: elas já foram decididas, não pergunte outra vez nem contradiga (se o app é só dele, não pergunte do casal).',
    'Em português do Brasil, sem travessão. Opções concretas: nada de "talvez" ou "depende".',
    // CC-940, regra geral dele em 07/10
    'Projeto inicial não tem login nem senha: só proponha login quando o projeto já guarda informação de alguém (cadastro, gasto, foto, mensagem). Antes disso, login é atrito sem nada a proteger.',
    '', 'ESTADO DO PROJETO:', JSON.stringify(estado, null, 1),
  ].join('\n')
}

/**
 * O contrato da proposta. Devolve `{ ok, proposta, erros }`.
 * Aceita o JSON puro ou UM bloco ```json em volta, e mais nada.
 */
export function validarProposta(texto) {
  const erros = []
  const cru = String(texto || '').trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1').trim()
  let v
  try { v = JSON.parse(cru) } catch { return { ok: false, proposta: null, erros: ['a resposta não é um JSON só: responda apenas o objeto'] } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, proposta: null, erros: ['esperava um objeto'] }
  const T = TETOS
  const texto_ = (c, min, max) => typeof v[c] === 'string' && v[c].trim().length >= min && v[c].length <= max
  for (const k of Object.keys(v)) if (!['tipo', 'titulo', 'porque', 'pergunta', 'opcoes', 'pedido', 'executa', 'daFila'].includes(k)) erros.push(`campo desconhecido: ${k}`)
  if (!TIPOS_PROPOSTA.includes(v.tipo)) erros.push(`tipo tem de ser ${TIPOS_PROPOSTA.join(', ')}`)
  if (!texto_('titulo', 3, T.titulo)) erros.push(`titulo de 3 a ${T.titulo} letras`)
  if (!texto_('porque', T.porqueMin, T.porque)) erros.push(`porque de ${T.porqueMin} a ${T.porque} letras`)
  if (!texto_('pergunta', T.perguntaMin, T.pergunta)) erros.push(`pergunta de ${T.perguntaMin} a ${T.pergunta} letras`)
  const ops = Array.isArray(v.opcoes) ? v.opcoes.map((o) => String(o).trim()) : []
  if (ops.length < T.opcoes[0] || ops.length > T.opcoes[1]) erros.push(`opcoes: de ${T.opcoes[0]} a ${T.opcoes[1]}`)
  if (ops.some((o) => o.length < 2 || o.length > T.opcao)) erros.push(`cada opção de 2 a ${T.opcao} letras`)
  if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length) erros.push('opções repetidas')
  if (ops.some((o) => /^(talvez|depende|tanto faz)\b/i.test(o))) erros.push('opção vaga: talvez, depende ou tanto faz não decidem nada')
  if (v.tipo === 'pedido' && !texto_('pedido', T.pedidoMin, T.pedido)) erros.push(`pedido técnico de ${T.pedidoMin} a ${T.pedido} letras, obrigatório quando o tipo é pedido`)
  /* CC-885: pergunta de "pedido" tem de dizer qual opção significa "sim, construa". Sem isso o "sim" dele
     não aciona nada e o arquiteto pergunta de novo (8 sins seguidos no Conta de Casa, 02/10). */
  if (v.tipo === 'pedido' && String(v.executa || '').trim() !== ops[0]) erros.push('executa: obrigatório quando o tipo é pedido, e igual à PRIMEIRA opção, que tem de ser o "sim, construa agora" (as outras são recusar ou ajustar)')
  /* 03/10: o dono não é técnico e pediu para não decidir isso. Pergunta de detalhe técnico o arquiteto decide e escreve no pedido. */
  if (/\b(stack|framework|biblioteca|linguagem de programa|banco de dados|postgres|sqlite|mysql|next\.?js|react|node)\b/i.test(`${v.pergunta} ${ops.join(' ')}`)) erros.push('pergunta de detalhe técnico (stack, banco, framework): decida você e escreva no pedido. Pergunte só o que muda o que o produto faz, o que ele vê ou o que custa')
  if (v.daFila != null && !/^[A-Z]{2,4}-\d{1,5}$/.test(String(v.daFila))) erros.push('daFila: o id de um item da fila, como CN-16, ou omita')
  if (/[—–]/.test(JSON.stringify(v))) erros.push('sem travessão')
  if (erros.length) return { ok: false, proposta: null, erros }
  return { ok: true, proposta: { tipo: v.tipo, titulo: v.titulo.trim(), porque: v.porque.trim(), pergunta: v.pergunta.trim(), opcoes: ops, ...(v.pedido ? { pedido: String(v.pedido).trim() } : {}), ...(v.executa ? { executa: String(v.executa).trim() } : {}), ...(v.daFila && v.tipo === 'pedido' ? { daFila: String(v.daFila) } : {}) }, erros: [] }
}

const rodarComEntrada = (bin, args, entrada, cwd) => new Promise((ok) => {
  // CC_SEM_PONTO: o Claude daqui só lê e propõe; a caixa de ponto (commit ao sair) não deve varrer o projeto por causa dele
  const p = execFile(bin, args, { cwd, timeout: 180000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CC_SEM_PONTO: '1' } }, (e, out, err) => ok({ ok: !e, out: String(out || ''), err: String(err || e?.message || '') }))
  p.stdin.on('error', () => { /* o programa morreu antes de ler: o erro dele já vem no retorno */ })
  p.stdin.end(limparSegredos(entrada)) // segredo nunca vai para modelo
})

/**
 * CC-885 e CC-904: a proposta manda construir DE NOVO algo que já foi construído? Só vale para pedido, e só contra pedido
 * que ele já aprovou e o robô já executou. Comparar a frase da pergunta dava falso alarme: "Constrói a tela de login?" e
 * "Constrói a tela de lançar gasto?" têm o mesmo molde, e a pergunta de revisão deve mesmo se repetir a cada obra. Palavras
 * de 5+ letras do pedido, sem acento, Jaccard de 0,7 (alto de propósito: barrar pedido novo é mais caro que deixar passar).
 */
const palavras = (t, min = 5) => new Set(String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= min))
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const w of a) if (b.has(w)) i++; return i / (a.size + b.size - i) }
export function perguntaRepetida(proposta, anteriores) {
  if (!proposta?.pedido) return null
  return anteriores.find((ant) => ant.pedido && jaccard(palavras(proposta.pedido), palavras(ant.pedido)) >= 0.7) || null
}
const anterioresDe = (cwd) => B.ler(B.caminhoPadrao(cwd)).itens
  .filter((x) => x.origem === 'arquiteto' && x.estado === 'OK' && x.proposta?.tipo === 'pedido' && aprovouExecutar(x.proposta, x.escolha)).slice(-12) // só o que o robô já executou
  .map((x) => ({ id: x.id, pergunta: x.decisao, pedido: x.proposta.pedido }))

/**
 * Pede UMA proposta ao Haiku, só leitura (modo de planejar), e confere pelo
 * contrato. Recusada, devolve o erro ao Haiku uma vez; de novo, desiste.
 */
export async function propor(cwd, { binario = process.env.CC_ARQUITETO_CLAUDE || resolverBinario('claude') } = {}) {
  const estado = lerEstado(cwd)
  const corpo = pedidoDeProposta(estado)
  const args = ['-p', '--model', MODELO_ARQUITETO, '--permission-mode', 'plan', '--output-format', 'text']
  let r = await rodarComEntrada(binario, args, corpo, cwd)
  const anteriores = anterioresDe(cwd)
  const itensAgora = B.ler(B.caminhoPadrao(cwd)).itens
  const ultimas = itensAgora.filter((x) => x.origem === 'arquiteto' && x.decisao && x.proposta?.tipo !== 'entrevista').slice(-1).map((x) => ({ id: x.id, tipo: x.proposta?.tipo, pergunta: x.decisao }))
  const conferir = (txt) => {
    const c = validarProposta(txt)
    /* CC-941: as regras combinadas com ele viram trava aqui, antes de a pergunta existir. Repetida, técnica e "pedido
       fora do backlog" voltam ao modelo com o motivo. "Redundante" (o pedido executa um item do backlog dele) não é
       recusada: vira execução sem pergunta, no passo. */
    const barradas = c.ok ? violacoes(c.proposta, { itens: itensAgora, anteriores: ultimas }).filter((v) => ['repetida', 'tecnica', 'fora'].includes(v.regra)) : []
    // CC-941: revisão só nasce de uma obra, montada pelo programa com as fotos. A IA propondo "revisão" de código que ela leu (CN-93) é recusada.
    if (c.ok && c.proposta.tipo === 'revisao') return { ok: false, erros: ['"revisao" é só do programa, depois de uma obra com fotos: proponha ideia, pedido ou melhoria'] }
    if (barradas.length) return { ok: false, erros: barradas.map((v) => v.regra === 'fora' ? 'o pedido não é de nenhum item do backlog dele: execute um item da fila (ponha o id em daFila) ou, se é algo novo, proponha como "ideia" perguntando se entra no produto' : v.motivo) }
    const rep = c.ok && perguntaRepetida(c.proposta, anteriores)
    return rep ? { ok: false, erros: [`o pedido é quase igual ao de ${rep.id} ("${String(rep.pedido).slice(0, 90)}"), que ele já aprovou e o robô já construiu. Proponha OUTRO passo, o que vem DEPOIS, não repita`] } : c
  }
  let v = conferir(r.out)
  if (!v.ok) {
    r = await rodarComEntrada(binario, args, `${corpo}\n\nSUA RESPOSTA ANTERIOR FOI RECUSADA PELO CONTRATO:\n- ${v.erros.join('\n- ')}\nResponda de novo, só o JSON.`, cwd)
    v = conferir(r.out)
  }
  if (!v.ok) throw new Error(`a proposta foi recusada pelo contrato duas vezes: ${v.erros.slice(0, 4).join('; ')}${r.ok ? '' : ` (${r.err.slice(0, 200)})`}`)
  return { estado, proposta: v.proposta }
}

/* ===================================================================
   Etapa 2: a pergunta que espera SEM prender processo (docs/CC-867.md).
   Ele responde da rua, às vezes horas depois: a pergunta vira uma ficha
   "decisão dele" no backlog do projeto, com as opções e a proposta, e o
   arquiteto termina. A resposta chega pela rota do painel, que grava a
   escolha no diário da ficha e chama o próximo passo.
   =================================================================== */

/** A pergunta do arquiteto que ainda espera por ele (no máximo uma por projeto). */
export const perguntaAberta = (itens) => itens.find((x) => x.origem === 'arquiteto' && x.estado === 'DE') || null

/** A pergunta aberta deste projeto no formato que os cartões das Sessões e do Coderoom desenham, ou null. */
export function perguntaDoArquiteto(cwd) {
  const it = perguntaAberta(B.ler(B.caminhoPadrao(cwd)).itens)
  if (!it) return null
  const p = it.proposta || {}
  return { ficha: it.id, titulo: p.titulo || '', porque: p.porque || '', pergunta: it.decisao, opcoes: it.opcoes || [], descricoes: p.descricoes || [], multipla: p.multipla === true }
}

/** Grava a proposta como ficha "decisão dele", com a pergunta, as opções e a proposta inteira. */
export function registrarPergunta(cwd, proposta) {
  const arq = B.caminhoPadrao(cwd)
  const { itens } = B.ler(arq)
  /* Projeto com catálogo de frentes recusa item sem frente de uma palavra do catálogo, e a
     pergunta do arquiteto quebrava ali (achado em 04/10, no próprio cockpit). Vale o trecho onde
     o projeto está no Caminho; sem ele, a primeira frente do catálogo; sem catálogo, qualquer uma. */
  const catalogo = catalogoDe(arq)
  const frente = frenteAtual(cwd) || (catalogo ? Object.keys(catalogo)[0] : 'sem frente')
  const it = B.acrescentar({
    frente, prefixo: B.prefixoDoProjeto(itens, cwd), natureza: 'DEC', area: 'agente', tamanho: 'P', estado: 'B1', origem: 'arquiteto',
    intencao: proposta.titulo.slice(0, 140), pronto: 'ele escolheu uma das opções da pergunta do arquiteto', conferir: 'dele:a escolha dele',
  }, arq)
  return B.mover(it.id, 'DE', { decisao: proposta.pergunta, opcoes: proposta.opcoes, proposta }, arq)
}

/** A resposta dele: vai para o diário da ficha (como decisão) e fecha a pergunta. */
export function responder(cwd, ficha, escolha, { automatico = null } = {}) {
  const arq = B.caminhoPadrao(cwd)
  const it = B.ler(arq).itens.find((x) => x.id === ficha)
  if (!it || it.origem !== 'arquiteto' || it.estado !== 'DE') throw new Error(`${ficha} não é uma pergunta do arquiteto esperando resposta`)
  // CC-902: a rota manda uma string; quem chama direto pode mandar o array de rótulos marcados
  const marcadas = Array.isArray(escolha) ? escolha.map((x) => String(x).trim()).filter(Boolean) : null
  const texto = marcadas ? marcadas.join(', ') : String(escolha || '').trim()
  if (!texto) throw new Error('resposta vazia')
  // pergunta da entrevista: a resposta entra na entrevista de verdade; a última fecha e gera o backlog
  if (it.proposta?.tipo === 'entrevista') {
    const est = lerFramework(cwd, { sessao: null })
    const r = responderEntrevista(est, it.proposta.entrevista, texto)
    if (!r.ok) throw new Error(`a entrevista recusou a resposta: ${r.erro}`)
    gravarFramework(cwd, r.estado)
    if (!proximaEntrevista(r.estado)) fecharEntrevista(cwd, r.estado, itensDoBacklog(r.estado))
    avancarProduto(cwd)
  }
  if (it.proposta?.tipo === 'produto') responderProduto(cwd, it.proposta, texto, marcadas)
  if (it.proposta?.tipo === 'rota') responderRota(cwd, it.proposta, texto, marcadas)
  B.debater(ficha, `"${it.decisao}" > ${texto}`, { tipo: 'decisao' }, arq)
  if (automatico) B.debater(ficha, `decidido pelo programa, não por ele: ${automatico}`, { tipo: 'nota' }, arq)
  const fechada = B.mover(ficha, 'OK', { prova: automatico ? `automático: ${automatico}` : `ele escolheu: ${texto.slice(0, 300)}`, escolha: texto.slice(0, 300), ...(automatico ? { automatico } : {}) }, arq)
  const pedido = aprovouExecutar(it.proposta, texto)
  if (pedido) fechada.executar = pedido // quem chama dispara o robô: o "sim" nunca pode virar só mais uma pergunta
  const p = it.proposta || {}
  // aprovou a revisão (ou aceitou "assim, sem isso"): o pedido e o que ficou obsoleto nele fecham
  if (p.encerra?.length && ((p.tipo === 'revisao' && texto.startsWith(p.opcoes?.[0] || '\0')) || (p.aceita && texto.startsWith(p.aceita)))) {
    fechada.encerrou = encerrarObsoletos(cwd, p.encerra, `aprovado por ele na ${ficha}: o pedido está atendido, o que sobrou aberto ficou obsoleto`)
  }
  /* CC-941: ele reprovou a entrega e escreveu o que está errado: isso entra no backlog, com as palavras dele. Sem o item,
     o conserto seria "pedido fora do backlog" e a trava o barraria; com ele, o conserto roda sozinho. */
  const extra = texto.replace(new RegExp('^' + String(p.opcoes?.find((o) => texto.startsWith(o)) || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '').replace(/^[.,;:\s]+/, '').trim()
  if (p.tipo === 'revisao' && !texto.startsWith(p.opcoes?.[0] || '\0') && extra.length >= 10) {
    const doItem = B.acrescentar({ prefixo: B.prefixoDoProjeto(B.ler(arq).itens, cwd), natureza: 'DEF', area: 'tela', tamanho: 'P', estado: 'B1', origem: 'felipe',
      intencao: extra.replace(/\s+/g, ' ').slice(0, 140), citacao: extra, pronto: `o que ele apontou na revisão ${ficha} está resolvido: ${extra.slice(0, 300)}`, conferir: 'dele:ele confere na próxima revisão' }, arq)
    fechada.virouItem = doItem.id
  }
  /* CC-941: ele aceitou uma IDEIA de produto: ela entra no backlog dele, com a escolha dele. Sem isto o pedido seguinte
     seria "fora do backlog" e a trava o barraria (previsto em 07/10 na CN-102). Escolha negativa não cria nada. */
  const negativa = /^(n[aã]o\b|nenhuma|depois|parar|outra dire|tente propor)/i
  // pedido de direção: "Fazer: <item>" escolhido constrói aquele item, sem voltar a perguntar à IA
  const opcaoFazer = Object.keys(p.fazer || {}).find((o) => texto.startsWith(o))
  if (opcaoFazer) fechada.fazer = p.fazer[opcaoFazer]
  // "Outra direção (escreva abaixo)" com o texto dele: o que ele escreveu é o pedido, e entra no backlog
  if (p.tipo === 'ideia' && /^outra dire/i.test(texto) && extra.length >= 10) {
    const novo = B.acrescentar({ prefixo: B.prefixoDoProjeto(B.ler(arq).itens, cwd), natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe',
      intencao: extra.replace(/\s+/g, ' ').slice(0, 140), citacao: extra, pronto: `${extra.slice(0, 300)} (pedido dele na ${ficha})`, conferir: 'dele:ele confere na revisão' }, arq)
    fechada.virouItem = novo.id
    fechada.fazer = novo.id // o que ele acabou de pedir é o que se constrói agora, sem a IA escolher outra coisa
  } else if (p.tipo === 'ideia' && p.titulo !== 'Preciso da sua direção' && !negativa.test(texto)) {
    const novo = B.acrescentar({ prefixo: B.prefixoDoProjeto(B.ler(arq).itens, cwd), natureza: 'PED', area: 'tela', tamanho: 'M', estado: 'B1', origem: 'felipe',
      intencao: texto.replace(/\s+/g, ' ').slice(0, 140), citacao: `${it.decisao} > ${texto}`, pronto: `${texto.slice(0, 300)} (decidido por ele na ${ficha})`, conferir: 'dele:ele confere na revisão' }, arq)
    fechada.virouItem = novo.id
    /* 07/10: ele escolheu "backup diário", e no passo seguinte a IA escolheu sozinha o item mais antigo da fila (o pacote
       do MVP, já construído) e começou a reconstruir a tela de lançamento. A escolha dele é o que se constrói agora. */
    fechada.fazer = novo.id
  }
  if (p.tipo === 'revisao' && p.juntar && texto.startsWith(p.opcoes?.[0] || '\0')) fechada.juntar = p.juntar // aprovou a revisão de uma obra na cópia
  return fechada
}

/* ===================================================================
   CC-918 e CC-919, pedido dele em 04/10: "as microtarefas todas precisam de mim, tem coisas repetidas que agentes podem
   testar, não eu". Duas coisas deixam de ir para ele: (1) o "constrói agora?" de um item que ELE já escolheu (a fila do
   projeto), e (2) a revisão de uma obra que o robô PROVOU sozinho. A regra decide, com teto por dia.
   =================================================================== */
export const TETO_AUTOMATICO = Number(process.env.CC_ARQUITETO_TETO_AUTO) || 6

/** Quantas coisas o programa decidiu sozinho hoje neste projeto, e se ainda cabe mais uma. */
export function podeAutomatico(cwd, teto = TETO_AUTOMATICO) {
  const hoje = new Date().toISOString().slice(0, 10)
  // conta só as OBRAS que o robô começou sozinho; aprovar com prova não abre obra nova
  return B.ler(B.caminhoPadrao(cwd)).itens.filter((x) => x.automatico && x.mexido === hoje && x.proposta?.tipo === 'pedido').length < teto
}

/**
 * CC-967, 07/10: o robô reconstruiu sozinho o MVP já pronto e construiu o backup duas vezes: nos dois casos o item dele
 * estava aberto e já tinha tido obra APROVADA. A trava olha o histórico, não o estado do item (que pode ficar aberto por
 * vários motivos): se já houve pedido executando este item e a revisão dele foi aprovada, a obra automática não sai.
 */
export function jaTeveObraAprovada(itemId, itens) {
  const pedidos = itens.filter((x) => x.origem === 'arquiteto' && x.proposta?.tipo === 'pedido' && x.proposta?.daFila === itemId && x.estado === 'OK').map((x) => x.id)
  if (!pedidos.length) return null
  // a revisão aprovada de uma obra dessas: revisão OK com escolha "Está bom" (dele ou do robô com prova), criada depois do pedido
  const num = (id) => Number(String(id).split('-')[1] || 0)
  const primeiro = Math.min(...pedidos.map(num))
  const rev = itens.find((x) => x.origem === 'arquiteto' && x.proposta?.tipo === 'revisao' && x.estado === 'OK' && num(x.id) > primeiro && /^est[aá] bom/i.test(String(x.escolha || '')))
  return rev ? { pedido: pedidos[0], revisao: rev.id } : null
}

/** O pedido executa um item da fila que ELE criou? (o id vem do modelo, a conferência é do programa) */
export function deveRodarSozinho(proposta, estado) {
  if (proposta?.tipo !== 'pedido' || !proposta.daFila || !proposta.executa) return null
  // CC-941: vale item dele em qualquer fila (o defeito que ele apontou nasce "ele confere" e mora na fila dele, não na do robô: CN-94)
  return [...(estado?.fila || []), ...(estado?.esperandoDele || [])].find((x) => x.id === proposta.daFila && x.origem === 'felipe') || null
}

/**
 * O robô provou sozinho que a obra funciona? Só vale em obra feita direto na pasta (nunca em cópia, que é projeto no ar),
 * sem pendência, com o teste do pedido passando, e com o app abrindo limpo (foto tirada, sem problema anotado).
 */
/** CC-939: as fotos só pegaram a tela de login? (o explorador nomeia cada foto pela tela: 01-login-celular.jpg) */
export const soPortaDeEntrada = (ver) => Boolean(ver?.fotos?.length) && ver.fotos.every((f) => /(^|[\\/])\d+-(login|entrar|entrada|signin|sign-in)\b/i.test(f))

export function provaAutomatica(r, ver) {
  const res = r?.resultado
  if (!r?.ok || r.copia) return { ok: false, motivo: r?.copia ? 'obra em cópia: quem aprova é ele' : 'o robô não terminou' }
  if (!res?.pai || res.pendentes?.length) return { ok: false, motivo: 'ficou parte sem fazer' }
  if (!/Comportamento: passou/.test(String(r.saida || ''))) return { ok: false, motivo: 'sem teste do pedido passando' }
  if (!ver?.ok || (ver.problemas || []).length) return { ok: false, motivo: 'o app não abriu limpo' }
  if (soPortaDeEntrada(ver)) return { ok: false, motivo: 'as fotos só mostram a tela de entrada: o robô não conseguiu entrar' }
  return { ok: true, provas: ['o teste automático do pedido passou', 'o app abriu sem erro e foi fotografado'] }
}

/**
 * CC-943: o item da fila DELE que esta obra executou (daFila), se for de uma função só. Item que junta várias funções
 * ("Lançar gasto com foto, Contas fixas separadas, Ver quanto sobra") fica aberto: uma obra cobre uma parte dele.
 */
export function itemDaFilaFechavel(it) {
  const id = it?.proposta?.daFila
  if (!id || !it.proposta.daFilaTexto) return [] // sem o texto, não dá para saber se é uma função só: não fecha
  // ideia aceita vira item "Sim, criar a área ...": o "Sim," não é uma função
  return String(it.proposta.daFilaTexto).replace(/^\s*sim\s*[,:.-]\s*/i, '').split(/[,;]/).filter((x) => x.trim()).length > 1 ? [] : [id]
}

/**
 * CC-904: aprovar a obra fecha o pedido e as tarefas que ficaram para trás (travadas, em andamento). No Conta de Casa o
 * pedido do login ficou "em andamento" e uma tarefa "travada" depois de ele aprovar a tela refeita, e o arquiteto leu isso
 * como "login ainda falta". Devolve os ids que fechou.
 */
export function encerrarObsoletos(cwd, ids, motivo) {
  const arq = B.caminhoPadrao(cwd), feitos = []
  for (const id of [...new Set(ids || [])]) {
    for (const f of B.filhasDe(B.ler(arq).itens, id)) if (['TR', 'EM', 'B1'].includes(f.estado)) { B.mover(f.id, 'KO', { porque: motivo }, arq); feitos.push(f.id) }
    const pai = B.ler(arq).itens.find((x) => x.id === id)
    if (pai && !['OK', 'KO'].includes(pai.estado)) { B.mover(id, 'OK', { prova: motivo }, arq); feitos.push(id) }
  }
  return feitos
}

/** O "sim" dele a uma pergunta de pedido? Devolve o pedido técnico (com o que ele escreveu a mais), ou null. */
export function aprovouExecutar(proposta, texto) {
  const p = proposta || {}, t = String(texto || '').trim()
  if (p.tipo !== 'pedido' || !p.executa || !p.pedido || !t.startsWith(p.executa)) return null
  const extra = t.slice(p.executa.length).replace(/^[.,;:\s]+/, '').trim()
  return extra ? `${p.pedido}\nObservação dele: ${extra}` : p.pedido
}

/* ===================================================================
   Etapa 4 (CC-875, CC-885): o "sim" CONSTRÓI. O pedido vai ao maestro, que divide em
   micro tarefas, constrói e confere. Onde constrói depende do projeto estar no ar:
   no ar (ou sem a linha), numa cópia separada; "No ar: não" no AGENTS.md, direto na pasta.
   Pedido dele em 03/10: "os dois modos são complementares".
   =================================================================== */

/** O projeto está no ar? Linha "No ar: sim|não" do AGENTS.md. Sem a linha vale "sim": na dúvida, cópia. */
export function noAr(cwd) {
  let a = ''; try { a = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8') } catch { /* sem memorial: na dúvida, no ar */ }
  const m = /^[ \t]*[-*]?[ \t]*no ar:[ \t]*(sim|n[aã]o)/im.exec(a)
  return !(m && /^n/i.test(m[1]))
}

/** A cópia separada do projeto (git worktree numa branch própria), fora de ~/projetos para não virar "projeto novo" no painel. */
export function copiaIsolada(cwd, ficha) {
  const base = process.env.CC_ARQUITETO_COPIAS || path.join(os.homedir(), '.local', 'share', 'agent-cockpit', 'copias')
  fs.mkdirSync(base, { recursive: true })
  const dir = path.join(base, `${path.basename(cwd)}-${ficha.toLowerCase()}`)
  if (fs.existsSync(dir)) return dir
  // o git 2.43 cria uma cópia VAZIA sem avisar quando não há commit: melhor recusar do que construir no vazio
  try { execFileSync('git', ['-C', cwd, 'rev-parse', '--verify', 'HEAD'], { stdio: 'pipe' }) } catch { throw new Error('não consegui criar a cópia separada (o projeto precisa ter pelo menos um commit)') }
  try { execFileSync('git', ['-C', cwd, 'worktree', 'add', '-b', `arquiteto/${ficha.toLowerCase()}`, dir], { stdio: 'pipe' }) } catch (e) {
    throw new Error(`não consegui criar a cópia separada (o projeto precisa ter pelo menos um commit): ${String(e.stderr || e.message).split('\n')[0]}`)
  }
  return dir
}

/* Estado do projeto que cada lado escreve por conta própria: nunca entra na junção, senão o diário e o backlog dele seriam sobrescritos. */
const ESTADO_DO_PROJETO = [/^docs\/(backlog|eventos)\.jsonl$/, /^docs\/ROADMAP\.md$/, /^\.framework\//, /^\.coderoom\//, /(^|\/)node_modules\//, /^\.git(\/|$)/]

/**
 * CC-886: junta o que o robô fez na cópia ao projeto de verdade, depois que ele aprovou a revisão.
 * Regras: (1) arquivo que mudou DOS DOIS LADOS, ou que ele deixou sujo no projeto, não é tocado e a junção inteira
 * é recusada com a lista; (2) o resultado fica preparado para commit e NÃO é commitado (regra dele); (3) o diário e o
 * backlog de cada lado não entram; (4) a cópia fica, como cópia de segurança. Devolve `{ ok, aplicados, removidos, conflitos }`.
 */
export function juntarCopia(cwd, dir) {
  const git = (raiz, ...a) => execFileSync('git', ['-C', raiz, ...a], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }).toString()
  const ramo = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').trim()
  const base = git(cwd, 'merge-base', 'HEAD', ramo).trim()
  const nomes = new Map() // caminho -> 'A' | 'M' | 'D'
  for (const l of git(dir, 'diff', '--name-status', '--no-renames', base).split('\n').filter(Boolean)) { const [st, ...resto] = l.split('\t'); nomes.set(resto.join('\t'), st[0] === 'D' ? 'D' : 'M') }
  for (const f of git(dir, 'ls-files', '-o', '--exclude-standard').split('\n').filter(Boolean)) nomes.set(f, 'M')
  const caminhos = [...nomes.keys()].filter((f) => !path.isAbsolute(f) && !f.split('/').includes('..') && !ESTADO_DO_PROJETO.some((re) => re.test(f)))
  const conflitos = [], aplicar = []
  for (const f of caminhos) {
    const aqui = path.join(cwd, f), la = path.join(dir, f)
    const igual = nomes.get(f) !== 'D' && fs.existsSync(aqui) && fs.existsSync(la) && fs.readFileSync(aqui).equals(fs.readFileSync(la))
    if (igual || (nomes.get(f) === 'D' && !fs.existsSync(aqui))) continue // já está igual
    let sujo = false, mudou = false
    try { sujo = git(cwd, 'status', '--porcelain', '--', f).trim() !== '' } catch { sujo = true }
    try { execFileSync('git', ['-C', cwd, 'diff', '--quiet', base, 'HEAD', '--', f], { stdio: 'pipe' }) } catch { mudou = true }
    if (sujo || mudou) conflitos.push(f); else aplicar.push(f)
  }
  if (conflitos.length) return { ok: false, aplicados: [], removidos: [], conflitos }
  const aplicados = [], removidos = []
  for (const f of aplicar) {
    const aqui = path.join(cwd, f), la = path.join(dir, f)
    if (nomes.get(f) === 'D') { fs.rmSync(aqui, { force: true }); removidos.push(f); continue }
    if (fs.lstatSync(la).isSymbolicLink()) continue // atalho não atravessa a junção
    fs.mkdirSync(path.dirname(aqui), { recursive: true }); fs.copyFileSync(la, aqui); aplicados.push(f)
  }
  if (aplicados.length + removidos.length) git(cwd, 'add', '-A', '--', ...aplicados, ...removidos)
  return { ok: true, aplicados, removidos, conflitos: [] }
}

/**
 * CC-941, medido em 07/10: ele reprovou a sobra (CN-94), o robô corrigiu, e duas obras depois a conta errada voltou. O teste
 * antigo do projeto EXIGIA a conta errada ("a conta fixa entra na soma e volta na subtração"), então toda obra que mexia na
 * sobra passava no teste desfazendo a decisão dele. A decisão dele tem de virar teste: o pedido leva as palavras dele.
 */
/**
 * As decisões dele que valem para o projeto inteiro: as escolhas de CONTEÚDO de todo o histórico ("nada aparece sem login",
 * "sou só eu", "login fixo"), sem as rotineiras ("sim, constrói", "está bom", "refaz"), que não ensinam nada à obra.
 */
export function decisoesDoProjeto(cwd, max = 12) {
  let ev = []; try { ev = fs.readFileSync(B.caminhoEventos(B.caminhoPadrao(cwd)), 'utf8').split(/\r?\n/).filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } }) } catch { return [] }
  const rotina = /^(sim,? (constr|corrige|refaz|come[cç]a|monta|faz)|est[aá] bom|aceito|n[aã]o, depois|tente propor|parar)/i
  return ev.filter((e) => e.tipo === 'decisao' && e.texto && !rotina.test(String(e.texto).split(' > ').pop().trim())).slice(-max).map((e) => ({ id: e.id, texto: e.texto }))
}

export function pedidoComARegraDele(pedido, item, decisoes = []) {
  /* 07/10: o backup saiu com os endereços abertos sem login, contra a decisão dele "nada aparece sem login funcionando"
     (CN-24). A obra só recebia a regra do item; as decisões dele que valem para o projeto inteiro vão junto. */
  const geral = decisoes.length ? `\nDECISÕES DELE QUE VALEM PARA O PROJETO INTEIRO (respeite em tudo que construir):\n${decisoes.slice(-10).map((d) => `- ${String(d.texto || d).replace(/\s+/g, ' ').slice(0, 220)}`).join('\n')}` : ''
  if (!item || item.origem !== 'felipe' || !item.citacao) return pedido + geral
  return `${pedido}\nREGRA DELE, com as palavras dele: "${String(item.citacao).replace(/\s+/g, ' ').slice(0, 400)}". Escreva (ou ajuste) um teste automático que prove essa regra NO QUE A TELA MOSTRA (o valor que a página exibe para a pessoa, não só um campo da resposta do servidor: em 07/10 o servidor tinha a sobra certa num campo e a tela lia outro). Teste antigo que diga o contrário da regra dele está errado: corrija o TESTE, nunca volte o código.${geral}`
}

const maestro = () => process.env.CC_ARQUITETO_MAESTRO || fileURLToPath(new URL('./maestro.mjs', import.meta.url)) // lido na hora: o teste troca por um de mentira

/** Roda o maestro com o pedido e espera terminar. O andamento vai para a conversa pelo próprio maestro (--avisar). */
export function executarPedido(cwd, ficha, pedido, { conversa = null } = {}) {
  const copia = noAr(cwd)
  const dir = copia ? copiaIsolada(cwd, ficha) : cwd
  return new Promise((ok) => {
    execFile(process.execPath, [maestro(), '--pasta', dir, ...(conversa ? ['--avisar', conversa] : []), pedido],
      { cwd: dir, timeout: 2 * 3600 * 1000, maxBuffer: 32 * 1024 * 1024 },
      (e, out, err) => ok({ ok: !e && !/parou com erro/.test(String(out)), dir, copia, saida: String(out || ''), erro: String(err || e?.message || ''), resultado: resultadoDoPai(dir, String(out || '')) }))
  })
}

/* ===================================================================
   CC-894, print dele em 04/10: "o coderoom tá fazendo tarefa sem mandar nem o print e nem o link do testedevoo p
   conferência?". A revisão perguntava "está bom?" e dizia "confira você" sem dar como. Agora o app é fotografado
   rodando, e as fotos vão na própria pergunta.
   =================================================================== */

/** Como subir o app para ver: um servidor na raiz do projeto, ou `npm start`. Vite e Next ficam com o ~/dev.sh (já têm endereço). */
export function comandoParaVer(cwd) {
  let pkg = null; try { pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) } catch { /* sem package.json */ }
  if (pkg?.scripts?.start && !/vite|next|expo/.test(pkg.scripts.start)) return { cmd: 'npm', args: ['run', 'start'] }
  for (const f of ['server.js', 'index.js', 'app.js', 'src/server.js', 'src/index.js']) if (fs.existsSync(path.join(cwd, f))) return { cmd: process.execPath, args: [f] }
  return null
}

/**
 * CC-939, 06/10: "aparece para mim a tela do login, independente do print, porque ele não fez login". O app do Conta
 * de Casa lê usuário e senha de variáveis que não estavam definidas em lugar nenhum: ninguém entrava. Quando o robô
 * sobe o app para fotografar, cria um usuário de teste DESCARTÁVEL (senha aleatória, só nesta subida) e entra com ele.
 * Quais variáveis são diz o AGENTS.md: "Login para as fotos: ADMIN_USER ADMIN_PASS".
 */
export function loginParaFotos(cwd) {
  let t = ''; try { t = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8') } catch { return null }
  const m = /^\s*[-*]?\s*login para as fotos:\s*([A-Z][A-Z0-9_]*)\s+([A-Z][A-Z0-9_]*)/im.exec(t)
  if (!m) return null
  const usuario = 'teste-painel', senha = 'f' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return { env: { [m[1]]: usuario, [m[2]]: senha }, acesso: { usuario, senha } }
}

/** Porta livre na faixa de teste de voo (5270 a 5279, dentro da 5250-5299 do ~/dev.sh). NUNCA a 3000: 3000 a 3021 são sites de cliente em produção. */
export async function portaLivre(de = 5270, ate = 5279) {
  for (let p = de; p <= ate; p++) {
    const livre = await new Promise((ok) => { const s = net.createServer(); s.once('error', () => ok(false)); s.listen(p, '127.0.0.1', () => s.close(() => ok(true))) })
    if (livre) return p
  }
  return null
}

const respondeEm = (porta) => new Promise((ok) => {
  const r = http.get({ host: '127.0.0.1', port: porta, path: '/', timeout: 2000 }, (res) => { res.resume(); ok(true) })
  r.on('error', () => ok(false)); r.on('timeout', () => { r.destroy(); ok(false) })
})
export async function aguardarNoAr(porta, ms = 20000) {
  for (const fim = Date.now() + ms; Date.now() < fim;) { if (await respondeEm(porta)) return true; await new Promise((r) => setTimeout(r, 700)) }
  return false
}

/**
 * Fotografa o app rodando. Projeto com endereço no testedevoo: fotografa o endereço (e devolve o link).
 * Sem endereço: sobe o app numa porta de teste, fotografa, e derruba. Nunca lança.
 * Devolve `{ ok, fotos, link, erro }`.
 */
export async function verOApp(cwd, { saida, foto = fotografarUrl, espera = 20000 } = {}) {
  try {
    const end = enderecoDe(cwd)
    if (end) { const r = await fotografar({ cwd, saida }); return { ...r, link: end.url } }
    const cmd = comandoParaVer(cwd)
    if (!cmd) return { ok: false, link: null, erro: 'não achei como subir o app (sem servidor na raiz do projeto)' }
    const porta = await portaLivre()
    if (!porta) return { ok: false, link: null, erro: 'sem porta livre na faixa de teste' }
    const logArq = path.join(os.homedir(), 'logs', `ver-${path.basename(cwd)}-${porta}.log`)
    fs.mkdirSync(path.dirname(logArq), { recursive: true })
    const fd = fs.openSync(logArq, 'a')
    // PORT é sempre passada: o app do Conta de Casa assume 3000 (produção) quando ninguém diz a porta
    const login = loginParaFotos(cwd)
    const filho = spawn(cmd.cmd, cmd.args, { cwd, env: { ...process.env, ...(login?.env || {}), PORT: String(porta) }, detached: true, stdio: ['ignore', fd, fd] })
    filho.on('error', () => { /* o log diz */ }); fs.closeSync(fd)
    try {
      if (!(await aguardarNoAr(porta, espera))) return { ok: false, link: null, erro: `o app não respondeu em ${Math.round(espera / 1000)} s na porta ${porta} (log em ${logArq})` }
      const r = await foto({ cwd, url: `http://127.0.0.1:${porta}/`, saida, acesso: login?.acesso || null })
      return { ...r, link: null }
    } finally { try { process.kill(-filho.pid) } catch { /* já tinha saído */ } }
  } catch (e) { return { ok: false, link: null, erro: String(e.message || e).slice(0, 200) } }
}

/** A frase das fotos e do link na pergunta de revisão. */
const frasePrint = (ver) => !ver ? ''
  : ver.ok && soPortaDeEntrada(ver) ? ' ATENÇÃO: as fotos só mostram a tela de entrada, o robô não conseguiu entrar no app. Elas não provam o que foi feito.'
  : ver.ok ? ` Fotografei o app rodando (veja as fotos).${ver.link ? ` Endereço de teste: ${ver.link}` : ' Ainda não há endereço de teste (testedevoo) para este projeto.'}`
  : ` Não consegui fotografar o app: ${String(ver.erro || 'sem motivo').slice(0, 140)}.`

/**
 * CC-890: o que sobrou aberto do pedido, lido do backlog e não do rodapé do relatório. No Conta de Casa a revisão
 * mostrou só as 4 últimas linhas e escondeu que a tela de login falhou 3 vezes (nunca foi criada): ele aprovou sem login.
 */
export function resultadoDoPai(dir, saida) {
  const pai = /no pedido ([A-Z]+-\d+)/.exec(saida)?.[1] || null
  const semBuild = /Sem build no projeto/.test(saida)
  const arquivos = /Arquivos alterados: (.+)/.exec(saida)?.[1]?.trim() || ''
  if (!pai) return { pai: null, pendentes: [], semBuild, arquivos }
  let itens = []; try { itens = B.ler(B.caminhoPadrao(dir)).itens } catch { /* sem backlog: nada a listar */ }
  const pendentes = B.filhasDe(itens, pai).filter((x) => B.estaAberto(x)).map((x) => ({ id: x.id, intencao: x.intencao || x.titulo || '', pronto: x.pronto || '' }))
  return { pai, pendentes, semBuild, arquivos }
}

/** A pergunta de revisão, montada pelo programa (sem IA): o veredito primeiro, e saídas que fazem sentido para ele. */
export function perguntaDeRevisao(it, r) {
  const res = r.resultado
  if (r.ok && res?.pendentes?.length) {
    // incompleto: nada de "está bom". A primeira opção refaz SÓ o que faltou, pelo mesmo caminho do "sim, construa".
    const faltas = res.pendentes.map((p) => String(p.intencao).replace(/^(conserto de [A-Z]+-\d+: )+/, ''))
    const unicas = [...new Set(faltas)]
    return {
      encerra: [res.pai, ...(it?.proposta?.encerra || [])].filter(Boolean), aceita: 'Aceito assim, sem isso, e sigo',
      // 07/10: sem o vínculo, o item dele (CN-142, backup) ficou aberto depois de refeito, e o backup foi construído duas vezes
      ...(it?.proposta?.daFila ? { daFila: it.proposta.daFila, daFilaTexto: it.proposta.daFilaTexto } : {}),
      tipo: 'pedido', titulo: `Faltou parte: ${unicas[0]}`.slice(0, 80),
      porque: `O robô NÃO terminou tudo. Faltou: ${unicas.join('; ')}.${res.semBuild ? ' Também nenhum teste rodou neste pedido, então não há como provar que o resto funciona.' : ''}${frasePrint(r.ver)}${r.copia ? ' (Obra feita numa cópia separada: nada foi juntado ao projeto.)' : ''}`.slice(0, 500),
      pergunta: 'Faltou parte do pedido. Mando o robô refazer só o que faltou?',
      opcoes: ['Sim, refaz o que faltou', 'Quero ajustar o pedido (escreva abaixo)', 'Aceito assim, sem isso, e sigo'],
      executa: 'Sim, refaz o que faltou',
      pedido: `Refazer o que faltou do pedido anterior. As tentativas anteriores terminaram sem alterar arquivo algum, então escreva o arquivo de fato e confira que ele existe. Partes que faltam: ${res.pendentes.map((p) => `${String(p.intencao).replace(/^(conserto de [A-Z]+-\d+: )+/, '')} (pronto quando: ${p.pronto})`).join(' | ')}`.slice(0, 600),
    }
  }
  const fim = res ? `${res.arquivos ? 'Arquivos alterados: ' + res.arquivos + '. ' : ''}${res.semBuild ? 'Atenção: nenhum teste rodou neste pedido, então o robô não provou que funciona; confira você.' : ''}`.trim()
    : String(r.saida || '').trim().split(/\n/).filter(Boolean).slice(-4).join(' ').slice(0, 380)
  const onde = r.copia ? ` Foi feito numa cópia separada (${r.dir}). Se estiver bom, eu junto no projeto de verdade, deixo pronto para commit e não commito.` : ' Foi feito direto na pasta do projeto.'
  const quadro = r.ok ? `O robô terminou todas as micro tarefas. ${fim}` : `O robô parou com erro. ${r.erro || fim}`
  return {
    tipo: 'revisao', titulo: `Revisar: ${String(it.titulo || it.intencao || 'o que foi construído')}`.slice(0, 80),
    porque: `${quadro}${frasePrint(r.ver)}${onde}`.slice(0, 500),
    pergunta: r.ok ? 'O que o robô entregou está bom?' : 'O robô não terminou. Como seguimos?',
    opcoes: r.ok ? [r.copia ? 'Está bom, junte ao projeto de verdade' : 'Está bom, segue para o próximo passo', 'Quase: quero ajustar (escreva abaixo o quê)', 'Não serve: refaz de outro jeito (escreva abaixo)']
      : ['Tenta de novo do jeito que estava', 'Quero ajustar o pedido (escreva abaixo)', 'Para por aqui e propõe outro passo'],
    ...(r.copia && r.ok ? { juntar: r.dir } : {}), // o "sim" da primeira opção aciona a junção
    ...(r.ok ? { encerra: [res?.pai, ...(it?.proposta?.encerra || []), ...itemDaFilaFechavel(it)].filter(Boolean) } : {}), // aprovar fecha o pedido, o que ficou para trás e o item da fila dele que a obra executou
  }
}

/**
 * Com a entrevista do projeto aberta, a pergunta sai do ROTEIRO dela, sem IA:
 * as perguntas já estão escritas, com as opções. É a regra decidindo, e a
 * resposta dele vai para a entrevista de verdade (medido em 02/10: o Haiku
 * propôs a 1a pergunta da entrevista como "pedido", e a resposta se perderia).
 */
export function perguntaDaEntrevista(cwd) {
  const est = lerFramework(cwd, { sessao: null })
  // só na Definição: projeto que já passou dela não volta a ser entrevistado
  if (!est || est.fase !== 'definicao') return null
  const p = proximaEntrevista(est)
  if (!p) return null
  return {
    tipo: 'entrevista', entrevista: p.id, titulo: `Entrevista: ${p.header}`.slice(0, 80),
    porque: p.ajuda || 'a entrevista define o projeto antes de qualquer código',
    pergunta: p.pergunta, opcoes: (p.opcoes || []).map((o) => o.label).slice(0, 6),
    ...((p.opcoes || []).some((o) => o.descricao) ? { descricoes: (p.opcoes || []).map((o) => o.descricao || '').slice(0, 6) } : {}),
    ...(p.multipla ? { multipla: true } : {}),
    _p: p, _respostas: respostasDaEntrevista(est),
  }
}

/** O que ele já respondeu, em linhas curtas, para o Haiku sugerir respostas que combinem. */
const respostasDaEntrevista = (est) => Object.entries(respostasDe(est)).map(([k, r]) => `${k}: ${String(r?.texto || '').slice(0, 300)}`)

/**
 * Pergunta sem opção no roteiro ("O que ele entrega, numa frase?"): obrigar a
 * escrever é o jeito mais caro de responder (pedido dele, 02/10). O Haiku sugere
 * 3 ou 4 respostas candidatas a partir do que ele já disse, e a tela sempre
 * deixa o campo extra. Falhou ou veio fora do formato: sem sugestão, só o campo.
 */
export async function sugerirOpcoes(cwd, q, { binario = process.env.CC_ARQUITETO_CLAUDE || resolverBinario('claude') } = {}) {
  const corpo = `Você ajuda o dono de um projeto a responder uma pergunta de entrevista sem precisar escrever.
Projeto: ${path.basename(cwd).replace(/^(VPS|PC)_/i, '')}
O que ele já respondeu:
${(q._respostas || []).join('\n') || '(nada ainda)'}

Pergunta: ${q.pergunta}
Para que serve: ${q.porque}

Dê de 3 a 4 respostas candidatas, curtas, escritas como ele responderia (primeira pessoa), coerentes com o que ele já disse. Se a pergunta aceita mais de uma resposta ao mesmo tempo, marque multipla true.
Regras: português do Brasil, sem travessão, sem emoji, cada rótulo com até 100 caracteres, cada descrição com até 140.
Responda SÓ um JSON: {"multipla":false,"opcoes":[{"rotulo":"...","descricao":"..."}]}`
  const r = await rodarComEntrada(binario, ['-p', '--model', MODELO_ARQUITETO, '--permission-mode', 'plan', '--output-format', 'text'], corpo, cwd)
  try {
    const bruto = (/```(?:json)?\s*([\s\S]*?)```/.exec(r.out)?.[1] || r.out).trim()
    const j = JSON.parse(bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1))
    const ops = (j.opcoes || []).filter((o) => o && typeof o.rotulo === 'string' && o.rotulo.trim() && o.rotulo.length <= 120 && !/[—–]/.test(o.rotulo + (o.descricao || '')))
    if (ops.length < 2) return null
    return { opcoes: ops.slice(0, 4).map((o) => o.rotulo.trim()), descricoes: ops.slice(0, 4).map((o) => String(o.descricao || '').slice(0, 140)), multipla: j.multipla === true }
  } catch { return null }
}

/* ===================================================================
   CC-902: criação de produto. Depois da entrevista, as perguntas da definição de produto e do mapa
   saem do PROGRAMA (src/produto.mjs); o Haiku só sugere as partes e as características, e o contrato
   confere antes de virarem opção. Plano em docs/CC-897.md, peça 6.
   =================================================================== */

export function pedidoDePartes(def, natureza, recusadas = []) {
  const jornada = natureza === 'estudo' ? 'perguntas que o estudo responde, na ordem em que serão respondidas'
    : natureza === 'biblioteca' ? 'comandos ou funções que quem consome usa, na ordem de uso'
      : 'telas e fluxos que quem usa percorre, na ordem da jornada (como no mapa de histórias de Jeff Patton)'
  return [
    'Você ajuda o dono de um produto (que não é técnico) a desenhar o mapa do produto.',
    `Liste de 3 a 8 PARTES do produto: ${jornada}. Cada parte é uma atividade de quem usa, não um detalhe técnico.`,
    'Responda SÓ um JSON, sem texto antes nem depois:',
    `{"partes":[{"codigo":"2 a 20 letras minúsculas ou números, sem acento nem hífen","nome":"2 a 40 letras","tipo":"${P.TIPOS_DE_PARTE.join('|')}","atividade":"5 a 140 letras, o que quem usa faz aqui"}]}`,
    'Código único em cada parte. Português do Brasil, sem travessão, sem emoji.',
    ...(recusadas.length ? [`Ele já recusou estas, não repita: ${recusadas.map((x) => x.nome).join(', ')}`] : []),
    '', 'DEFINIÇÃO DO PRODUTO:', P.textoDaDefinicao(def),
  ].join('\n')
}

export function pedidoDeCaracteristicas(def, parte) {
  return [
    'Você ajuda o dono de um produto (que não é técnico) a dizer o que precisa ser verdade em uma parte dele.',
    `Parte: ${parte.nome} (${parte.tipo}). O que quem usa faz aqui: ${parte.atividade}`,
    'Liste de 3 a 4 CARACTERÍSTICAS, cada uma uma frase curta do que a parte tem de garantir (por exemplo: carrega rápido, funciona sem rede, só quem tem login entra). Nada de detalhe técnico.',
    'Responda SÓ um JSON, sem texto antes nem depois:',
    '{"caracteristicas":["5 a 80 letras cada"]}',
    'Português do Brasil, sem travessão, sem emoji.',
    '', 'DEFINIÇÃO DO PRODUTO:', P.textoDaDefinicao(def),
  ].join('\n')
}

const ARGS_HAIKU = ['-p', '--model', MODELO_ARQUITETO, '--permission-mode', 'plan', '--output-format', 'text']
/** Pede ao Haiku e confere pelo contrato. Recusada, devolve o erro a ele uma vez; recusada de novo, joga erro. */
async function pedirComContrato(cwd, binario, corpo, validar, nome) {
  let r = await rodarComEntrada(binario, ARGS_HAIKU, corpo, cwd)
  let v = validar(r.out)
  if (!v.ok) {
    r = await rodarComEntrada(binario, ARGS_HAIKU, `${corpo}\n\nSUA RESPOSTA ANTERIOR FOI RECUSADA PELO CONTRATO:\n- ${v.erros.join('\n- ')}\nResponda de novo, só o JSON.`, cwd)
    v = validar(r.out)
  }
  if (!v.ok) throw new Error(`${nome} recusadas pelo contrato duas vezes: ${v.erros.slice(0, 4).join('; ')}${r.ok ? '' : ` (${r.err.slice(0, 200)})`}`)
  return v
}

export async function sugerirPartes(cwd, def, { binario = process.env.CC_ARQUITETO_CLAUDE || resolverBinario('claude'), recusadas = [] } = {}) {
  return (await pedirComContrato(cwd, binario, pedidoDePartes(def, def?.natureza, recusadas), P.validarPartes, 'as partes')).partes
}

export async function sugerirCaracteristicas(cwd, parte, def, { binario = process.env.CC_ARQUITETO_CLAUDE || resolverBinario('claude') } = {}) {
  return (await pedirComContrato(cwd, binario, pedidoDeCaracteristicas(def, parte), P.validarCaracteristicas, 'as características')).caracteristicas
}

/**
 * A próxima pergunta da criação de produto, ou null. Só no método `produto`, com a entrevista terminada e o mapa ainda
 * não aprovado. Lê ou cria o docs/produto.json, e grava as sugestões antes de perguntar (a pergunta não depende de nova chamada).
 */
export async function perguntaDoProduto(cwd, { binario } = {}) {
  const est = lerFramework(cwd, { sessao: null })
  if (est?.metodo !== 'produto' || !est.entrevista?.terminou || est.produto?.mapa) return null
  const existia = P.ler(cwd)
  let pr = existia || P.produtoVazio()
  if (!pr.definicao.confirmada) pr = { ...pr, definicao: { ...pr.definicao, ...P.definicaoDaEntrevista(est) } }
  if (!existia || JSON.stringify(pr.definicao) !== JSON.stringify(existia.definicao)) P.gravar(cwd, pr)
  const prox = P.proximoPasso(pr)
  if (!prox) return null
  const opt = binario ? { binario } : {}
  const base = { tipo: 'produto' }
  const nomes = (l) => l.map((x) => x.nome)
  const resumoPartes = pr.partes.map((x) => x.nome).join(', ') || '(nenhuma ainda)'
  switch (prox.passo) {
    case 'sucesso': {
      const q = { pergunta: 'Como você vai saber que o produto deu certo?', porque: 'Falta dizer o que prova que o produto funcionou. O resto da definição já veio da entrevista.' }
      const s = await sugerirOpcoes(cwd, { ...q, _respostas: respostasDaEntrevista(est) }, opt).catch(() => null)
      return { ...base, titulo: 'Criação de produto: como se sabe que deu certo', ...q, opcoes: s?.opcoes || [], ...(s?.descricoes?.some(Boolean) ? { descricoes: s.descricoes } : {}), ...(s?.multipla ? { multipla: true } : {}), produto: { passo: 'sucesso', opcoes: s?.opcoes || [] } }
    }
    case 'definicao':
      return { ...base, titulo: 'Criação de produto: a definição', porque: P.textoDaDefinicao(pr.definicao), pergunta: 'Esta é a definição do produto?', opcoes: ['Está certa', 'Refazer a entrevista'], produto: { passo: 'definicao', opcoes: ['Está certa', 'Refazer a entrevista'] } }
    case 'partes': {
      if (!pr.sugeridas.length && !pr.partes.length) {
        const novas = await sugerirPartes(cwd, pr.definicao, { ...opt, recusadas: pr.recusadas })
        const sem = new Set(pr.recusadas.map((x) => x.codigo))
        pr = { ...pr, sugeridas: novas.filter((x) => !sem.has(x.codigo)) }
        if (!pr.sugeridas.length) throw new Error('o Haiku só repetiu partes que ele já recusou')
        P.gravar(cwd, pr)
      }
      const lote = pr.sugeridas.slice(0, 4)
      return { ...base, titulo: 'Criação de produto: as partes', porque: 'O mapa do produto lista o que quem usa percorre, na ordem. Marque as que o produto tem; o que não marcar sai do mapa.', pergunta: 'Quais destas partes o produto tem?', opcoes: nomes(lote), descricoes: lote.map((x) => x.atividade), multipla: true, produto: { passo: 'partes', opcoes: nomes(lote) } }
    }
    case 'faltou':
      return { ...base, titulo: 'Criação de produto: falta alguma parte', porque: `Partes até agora: ${resumoPartes}.`, pergunta: 'Falta alguma parte?', opcoes: ['Não, está completo'], produto: { passo: 'faltou', opcoes: ['Não, está completo'] } }
    case 'caracteristicas': {
      const parte = pr.partes.find((x) => x.codigo === prox.parte)
      const lista = await sugerirCaracteristicas(cwd, parte, pr.definicao, opt)
      return { ...base, titulo: `Criação de produto: ${parte.nome}`.slice(0, 80), porque: `${parte.nome} (${parte.tipo}): ${parte.atividade}`, pergunta: `O que precisa ser verdade em ${parte.nome}?`, opcoes: lista, multipla: true, produto: { passo: 'caracteristicas', parte: parte.codigo, opcoes: lista } }
    }
    default: { // mapa
      const mapa = pr.partes.map((x) => `${x.ordem}. ${x.nome} (${x.tipo}): ${x.caracteristicas.join('; ') || 'sem características'}`).join('\n')
      return { ...base, titulo: 'Criação de produto: o mapa', porque: mapa.slice(0, 1200), pergunta: 'Aprovo o mapa?', opcoes: ['Aprovo o mapa', 'Quero mudar uma parte'], produto: { passo: 'mapa', opcoes: ['Aprovo o mapa', 'Quero mudar uma parte'] } }
    }
  }
}

/** No método `produto`, avança a fase enquanto o portão estiver aberto. Devolve a fase em que ficou, ou null. */
export function avancarProduto(cwd) {
  let est = lerFramework(cwd, { sessao: null })
  if (est?.metodo !== 'produto' || est.ligado === false) return null
  let mudou = false
  for (let r = avancar('produto', est); r.ok; r = avancar('produto', est)) { est = r.estado; mudou = true }
  if (mudou) gravarFramework(cwd, est)
  return est.fase
}

/* CC-913: com o mapa aprovado, a rota de cada parte (2 a 4 itens do backlog) sai do Haiku, e o contrato confere. */
export function pedidoDeRota(produto, parte, existentes = []) {
  return [
    'Você ajuda o dono de um produto (que não é técnico) a quebrar uma parte do produto em passos pequenos de trabalho.',
    `Liste de 2 a 4 ITENS que, juntos, entregam a parte "${parte.nome}" (${parte.tipo}). Cada item é pequeno e tem um resultado que dá para olhar ou testar.`,
    'Responda SÓ um JSON, sem texto antes nem depois:',
    '{"itens":[{"intencao":"10 a 140 letras, o que será feito","pronto":"10 a 300 letras, o que se observa quando estiver feito","tamanho":"P|M|G","natureza":"PED|MED|DOC","area":"' + B.AREAS.map((a) => a.codigo).join('|') + '","conferir":"olho:o que olhar | dele:o que só ele confirma | auto:node test-algo.mjs"}]}',
    'Use auto: só para "node test-<nome>.mjs", "build" ou "npm test". Na dúvida use olho:. Português do Brasil, sem travessão, sem emoji.',
    ...(existentes.length ? ['Já existem no backlog, não repita:', ...existentes.map((x) => `- ${x}`)] : []),
    '', 'DEFINIÇÃO DO PRODUTO:', P.textoDaDefinicao(produto.definicao),
    '', `PARTE: ${parte.nome} (${parte.tipo}): ${parte.atividade}`,
    `CARACTERÍSTICAS: ${(parte.caracteristicas || []).join('; ') || '(nenhuma)'}`,
  ].join('\n')
}

/** A pergunta da rota da próxima parte do mapa, ou null. Só no método `produto`, com o mapa aprovado. */
export async function perguntaDaRota(cwd, { binario = process.env.CC_ARQUITETO_CLAUDE || resolverBinario('claude') } = {}) {
  const est = lerFramework(cwd, { sessao: null })
  if (est?.metodo !== 'produto' || !est.produto?.mapa) return null
  const pr = P.ler(cwd)
  const parte = P.proximaParteSemRota(pr)
  if (!parte) return null
  const existentes = B.ler(B.caminhoPadrao(cwd)).itens.filter((x) => !x.pai && !x.proposta).map((x) => String(x.intencao || x.titulo || '').slice(0, 100)).filter(Boolean).slice(-30)
  const itens = (await pedirComContrato(cwd, binario, pedidoDeRota(pr, parte, existentes), P.validarRota, 'os itens da rota')).itens
  const opcoes = itens.map((x) => x.intencao.slice(0, 120))
  return {
    tipo: 'rota', titulo: `Rota: ${parte.nome}`.slice(0, 80),
    porque: `Passos para entregar ${parte.nome}: ${parte.atividade}. O que você marcar vira item do backlog nesta parte, na ordem do mapa.`.slice(0, 500),
    pergunta: 'Quais destes passos entram no backlog?', opcoes, descricoes: itens.map((x) => `pronto: ${x.pronto}`.slice(0, 300)),
    multipla: true, rota: { parte: parte.codigo, itens },
  }
}

/** A resposta a uma pergunta de rota: cada passo marcado vira item B1 na frente da parte; o extra vira B0 com a fala dele. */
function responderRota(cwd, proposta, texto, marcadas) {
  const info = proposta.rota || {}
  const { escolhas, extra } = marcadas ? { escolhas: marcadas, extra: '' } : P.separarEscolha(texto, proposta.opcoes || [])
  const pr = P.ler(cwd)
  const parte = pr?.partes.find((x) => x.codigo === info.parte)
  if (!parte) throw new Error(`a parte ${info.parte} não está em docs/produto.json`)
  if (parte.rota) return // já respondida (duas abas, duas respostas): repetir duplicaria os itens da rota
  const arq = B.caminhoPadrao(cwd)
  const prefixo = B.prefixoDoProjeto(B.ler(arq).itens, cwd)
  const criados = []
  for (const e of escolhas) {
    const i = (proposta.opcoes || []).indexOf(e)
    if (i < 0 || !info.itens?.[i]) continue
    criados.push(B.acrescentar({ prefixo, frente: parte.codigo, origem: 'arquiteto', estado: 'B1', ...info.itens[i] }, arq))
  }
  if (extra && !P.ehNenhuma(extra)) {
    criados.push(B.acrescentar({ prefixo, frente: parte.codigo, origem: 'arquiteto', estado: 'B0', natureza: 'PED', area: 'tela', tamanho: 'M',
      intencao: extra.slice(0, 140), pronto: 'ele reconhece o passo pronto em: ' + parte.nome, conferir: 'dele:o passo que ele pediu em ' + parte.nome, citacao: extra }, arq))
  }
  parte.rota = new Date().toISOString()
  P.gravar(cwd, pr)
  if (!P.proximaParteSemRota(pr)) {
    const todos = B.ler(arq).itens.filter((x) => !x.pai && !x.proposta && x.estado !== 'KO' && pr.partes.some((p) => p.codigo === x.frente))
    const primeiro = todos.find((x) => x.estado === 'B1') || todos[0]
    const est = lerFramework(cwd, { sessao: null })
    gravarFramework(cwd, { ...est, plano: { itens: todos.length, primeira: primeiro ? String(primeiro.intencao || primeiro.titulo).slice(0, 140) : '' } })
    avancarProduto(cwd)
  }
  B.regerarRoadmap(cwd)
}

/**
 * A resposta a uma pergunta de produto (chamada por `responder`). `marcadas` é o array de rótulos quando quem chama o
 * tem; senão a string é separada pelos rótulos que o cartão ofereceu (limite: ver `separarEscolha`).
 */
function responderProduto(cwd, proposta, texto, marcadas) {
  const info = proposta.produto || {}
  const { escolhas, extra } = marcadas ? { escolhas: marcadas, extra: '' } : P.separarEscolha(texto, info.opcoes || proposta.opcoes || [])
  const antes = P.ler(cwd)
  if (!antes) throw new Error('docs/produto.json não existe: não há o que responder')
  const pr = P.aplicarResposta(antes, info.passo, { escolhas, extra, opcoes: info.opcoes || [], parte: info.parte || null })
  P.gravar(cwd, pr)
  const agora = new Date().toISOString()
  let est = lerFramework(cwd, { sessao: null })
  if (info.passo === 'definicao' && pr.definicao.confirmada) est = { ...est, produto: { ...(est.produto || {}), definicao: agora } }
  if (info.passo === 'definicao' && !pr.definicao.confirmada && escolhas.some((e) => /^refazer/i.test(e))) {
    // recomeça a entrevista: apaga cada resposta (o desfazer leva junto as que dependiam dela) e volta à fase da entrevista
    for (const id of Object.keys(respostasDe(est))) { const d = desfazerEntrevista(est, id); if (d.ok) est = d.estado }
    est = { ...est, fase: 'definicao', produto: {} }
  }
  if (info.passo === 'mapa' && pr.mapaAprovado) {
    est = { ...est, produto: { ...(est.produto || {}), mapa: agora } }
    const arq = B.caminhoPadrao(cwd), catalogo = catalogoDe(arq)
    const novas = P.frentesDoMapa(pr, catalogo)
    if (Object.keys(novas).length) { // o catálogo só recebe as frentes quando ele já existe
      const f = path.join(path.dirname(arq), 'frentes.json'), tmp = `${f}.tmp`
      fs.writeFileSync(tmp, JSON.stringify({ ...catalogo, ...novas }, null, 2) + '\n', 'utf8'); fs.renameSync(tmp, f)
    }
  }
  gravarFramework(cwd, est)
  avancarProduto(cwd)
}

/** Um passo do ciclo: com pergunta esperando, para; com entrevista aberta, pergunta dela; senão, o Haiku propõe. */
export async function passo(cwd, { binario } = {}) {
  const aberta = perguntaAberta(B.ler(B.caminhoPadrao(cwd)).itens)
  if (aberta) return { esperando: aberta }
  const daEntrevista = perguntaDaEntrevista(cwd)
  if (daEntrevista) {
    const { _p, _respostas, ...q } = daEntrevista
    if (!q.opcoes.length) Object.assign(q, await sugerirOpcoes(cwd, daEntrevista, binario ? { binario } : {}).catch(() => null) || {})
    return { pergunta: registrarPergunta(cwd, q), proposta: q }
  }
  const doProduto = await perguntaDoProduto(cwd, binario ? { binario } : {})
  if (doProduto) return { pergunta: registrarPergunta(cwd, doProduto), proposta: doProduto }
  const daRota = await perguntaDaRota(cwd, binario ? { binario } : {})
  if (daRota) return { pergunta: registrarPergunta(cwd, daRota), proposta: daRota }
  const { proposta, estado } = await propor(cwd, binario ? { binario } : {})
  // CC-918: pedido que executa item da fila que ELE já escolheu não pergunta "constrói agora?"; o teto por dia segura o resto
  // CC-941: o modelo não apontou o item, mas o pedido executa um item do backlog dele: a regra decide, não o modelo
  // (daFila ausente OU apontando para item que não está na fila: o programa procura pelo conteúdo)
  // o id que a IA aponta só vale se o CONTEÚDO bater; senão o programa procura (07/10: a IA ou o comparador apontou CN-15 para outra coisa)
  if (proposta.tipo === 'pedido' && proposta.executa) { const it = itemDoBacklog(proposta, B.ler(B.caminhoPadrao(cwd)).itens); proposta.daFila = it ? it.id : undefined; proposta.daFilaTexto = it ? (it.intencao || it.titulo || '') : undefined }
  let daFila = deveRodarSozinho(proposta, estado)
  // CC-967: item que já teve obra aprovada nunca é construído sozinho de novo; a pergunta diz isso
  const jaFeito = daFila && jaTeveObraAprovada(daFila.id, B.ler(B.caminhoPadrao(cwd)).itens)
  if (jaFeito) {
    proposta.porque = `${proposta.porque} (Atenção: o item ${daFila.id} já teve uma obra aprovada (pedido ${jaFeito.pedido}, revisão ${jaFeito.revisao}). Não construo de novo sozinho: confirme se é mesmo para refazer.)`.slice(0, 500)
    daFila = null
  }
  const cabe = podeAutomatico(cwd)
  // o teto segurou: a pergunta diz por quê, senão parece redundante (07/10, CN-131)
  if (daFila && !cabe) proposta.porque = `${proposta.porque} (Este item você já escolheu, mas hoje o robô já começou ${TETO_AUTOMATICO} obras sozinho, o limite do dia: por isso pergunto.)`.slice(0, 500)
  // grava DEPOIS de conferir o item: antes a ficha ficava sem o vínculo com o item dele
  const ficha = registrarPergunta(cwd, proposta)
  if (daFila && cabe) {
    const fechada = responder(cwd, ficha.id, proposta.executa, { automatico: `item da fila que ele já escolheu (${daFila.id}: ${String(daFila.intencao).slice(0, 80)})` })
    return { pergunta: fechada, proposta, automatico: true, daFila }
  }
  return { pergunta: ficha, proposta }
}

/**
 * CC-890: a trava de repetição recusou as duas propostas do Haiku e o arquiteto MORRIA calado (o "Está bom" dele
 * não gerou pergunta nenhuma, 04/10). Sem proposta, pede a direção dele, e o que ele escrever entra no contexto.
 */
export function perguntaDeSocorro(motivo, estado = {}) {
  /* CC-904: "Tente propor de novo" era a primeira opção e só repetia a falha (10 voltas no Conta de Casa). Agora as opções
     são passos reais: o que está na fila do projeto, ou parar. */
  // CC-941: os itens DELE primeiro (o defeito que ele apontou mora na fila dele, não na do robô: CN-121), depois o resto
  const itens = [...(estado.esperandoDele || []).filter((x) => x.origem === 'felipe'), ...(estado.fila || [])].filter((x, i, a) => a.findIndex((y) => (x.id ? y.id === x.id : y === x)) === i).slice(0, 2)
  const fila = itens.map((x) => `Fazer: ${String(x.intencao).replace(/\s+/g, ' ').slice(0, 100)}`)
  const repetia = /quase igual/.test(String(motivo))
  return {
    tipo: 'ideia', titulo: 'Preciso da sua direção',
    porque: repetia ? 'Todas as ideias que tive repetiam algo que você já decidiu ou que já foi construído.' : `Não consegui propor o próximo passo sozinho: ${String(motivo).replace(/\s+/g, ' ').slice(0, 300)}`,
    pergunta: 'O que você quer fazer agora?',
    opcoes: [...fila, fila.length ? 'Outra direção (escreva abaixo)' : 'Parar por enquanto', ...(fila.length ? [] : ['Outra direção (escreva abaixo)'])].slice(0, 4),
    fazer: Object.fromEntries(itens.map((x, i) => [fila[i], x.id])), // "Fazer: X" escolhido constrói o item X direto
  }
}
export async function passoOuSocorro(cwd, o = {}) {
  try { return await passo(cwd, o) } catch (e) {
    let estado = {}; try { estado = lerEstado(cwd) } catch { /* sem estado: o socorro vai só com as saídas fixas */ }
    return { pergunta: registrarPergunta(cwd, perguntaDeSocorro(e.message || e, estado)), socorro: true }
  }
}

/** A mensagem da pergunta na conversa do Coderoom, com uma opção por botão. */
export function mensagemDaPergunta(it) {
  const p = it.proposta || {}
  const tipo = { ideia: 'Ideia', pedido: 'Pedido', revisao: 'Revisão', melhoria: 'Melhoria no processo', entrevista: 'Definição do projeto', produto: 'Criação de produto', rota: 'Rota do produto' }[p.tipo] || 'Pergunta'
  // a tela monta o formulário (opções, caixinhas se múltipla, campo extra sempre) a partir dos botões
  const ops = (it.opcoes || []).length ? it.opcoes : null
  return {
    texto: `Arquiteto, ${tipo} (${it.id}): ${p.titulo}\n${p.porque}\n\n${it.decisao}`,
    acoes: ops ? ops.map((o, i) => ({ rotulo: o, arquiteto: it.id, ...(p.descricoes?.[i] ? { descricao: p.descricoes[i] } : {}), ...(p.multipla ? { multipla: true } : {}) }))
      : [{ rotulo: 'Outra resposta', arquiteto: it.id, soTexto: true }],
  }
}

const PAINEL = process.env.CC_PAINEL || 'http://127.0.0.1:5180'
const api = async (rota, corpo) => {
  const r = await fetch(PAINEL + rota, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(30000) } : { signal: AbortSignal.timeout(30000) })
  return r.json()
}

/** A conversa do arquiteto neste projeto: a que já existe, ou uma nova. */
async function conversaDoArquiteto(cwd) {
  const titulo = `Arquiteto · ${path.basename(cwd).replace(/^(VPS|PC)_/i, '')}`
  const lista = await api('/api/gate/conversas')
  const ja = (lista.conversas || lista || []).find((c) => (c.titulo || c.cabecalho?.titulo) === titulo)
  return ja ? ja.id : (await api('/api/gate/nova', { cwd, titulo })).id
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2)
  const i = a.indexOf('--pasta')
  const cwd = path.resolve(i >= 0 ? a[i + 1] : process.cwd())
  const valor = (f) => { const k = a.indexOf(f); return k >= 0 && a[k + 1] && !a[k + 1].startsWith('--') ? a[k + 1] : null }
  ;(async () => {
    const { moduloLigado, projetoDe } = await import('./config.mjs')
    if (!moduloLigado('nisaba', projetoDe(cwd))) throw new Error(`o Nisaba está desligado em ${projetoDe(cwd)} (tela Projetos)`)
    if (a.includes('--propor')) return console.log(JSON.stringify((await propor(cwd)).proposta, null, 1))
    /**
     * Executa uma ficha de pedido já aprovada (por ele, ou pelo programa quando veio da fila dele) e fecha o ciclo: com prova
     * automática passando, o robô aprova a própria revisão e AVISA; sem prova (ou em obra de cópia), pergunta como sempre.
     */
    const executarFicha = async (ficha, conversa, { automatico = null, profundidade = 0 } = {}) => {
      const it = B.ler(B.caminhoPadrao(cwd)).itens.find((x) => x.id === ficha)
      const pedido = it && aprovouExecutar(it.proposta, it.escolha)
      if (!pedido) throw new Error(`${ficha} não é um pedido aprovado`)
      const copia = noAr(cwd)
      await api('/api/gate/nota', { id: conversa, texto: automatico
        ? `Arquiteto: este item você já escolheu (${automatico}), então vou construir sem perguntar: "${it.titulo}". Fica ${copia ? 'numa cópia separada do projeto' : 'direto na pasta do projeto'}. Para segurar o que vier depois, desligue o Nisaba deste projeto na tela Projetos.`
        : `Arquiteto: vou construir "${it.titulo}" ${copia ? 'numa cópia separada do projeto' : 'direto na pasta do projeto'}. O andamento aparece aqui, e eu volto com uma pergunta quando terminar.` })
      const r = await executarPedido(cwd, ficha, pedidoComARegraDele(pedido, B.ler(B.caminhoPadrao(cwd)).itens.find((x) => x.id === it.proposta?.daFila), decisoesDoProjeto(cwd)), { conversa })
      // CC-894: a revisão leva fotos do app rodando. Obra em cópia é fotografada na cópia, que é onde está o código novo.
      const saidaFotos = path.join(lerCabecalhoGate(conversa)?._onde || os.tmpdir(), `${conversa}.anexos`, `revisao-${ficha}`)
      r.ver = await verOApp(r.copia ? r.dir : cwd, { saida: saidaFotos })
      const proposta = perguntaDeRevisao(it, r)
      const rev = registrarPergunta(cwd, proposta)
      const fotos = r.ver.ok && r.ver.fotos?.length ? { fotos: r.ver.fotos } : {}
      const prova = proposta.tipo === 'revisao' ? provaAutomatica(r, r.ver) : { ok: false, motivo: 'faltou parte' }
      if (!prova.ok || !podeAutomatico(cwd)) {
        await api('/api/gate/nota', { id: conversa, ...mensagemDaPergunta(rev), ...fotos })
        return console.log(`construído (${r.ok ? 'ok' : 'com erro'}); pergunta de revisão ${rev.id}${prova.ok ? ' (teto de decisões automáticas do dia atingido)' : ' (' + prova.motivo + ')'}`)
      }
      // CC-919: provou sozinho. Aprova a própria revisão, avisa com as fotos, e segue.
      responder(cwd, rev.id, proposta.opcoes[0], { automatico: `provas: ${prova.provas.join('; ')}` })
      await api('/api/gate/nota', { id: conversa, texto: `Arquiteto: o robô provou sozinho e eu aprovei "${it.titulo}": ${prova.provas.join('; ')}. Fotos abaixo. Se discordar, diga na próxima pergunta, no campo "outra resposta".`, ...fotos })
      console.log(`construído e aprovado pelo robô (${rev.id}); seguindo`)
      return seguir(conversa, profundidade + 1)
    }
    /** O próximo passo: pergunta para ele, ou (item da fila que ele escolheu) constrói sozinho e segue. */
    const seguir = async (conversa, profundidade = 0) => {
      const r = await passoOuSocorro(cwd)
      if (r.esperando) return console.log(`esperando a resposta dele em ${r.esperando.id}: ${r.esperando.decisao}`)
      if (r.automatico && profundidade < 4) return executarFicha(r.pergunta.id, conversa, { automatico: `${r.daFila.id}: ${String(r.daFila.intencao).slice(0, 80)}`, profundidade })
      await api('/api/gate/nota', { id: conversa, ...mensagemDaPergunta(r.pergunta) })
      return console.log(`pergunta ${r.pergunta.id} na conversa ${conversa}`)
    }
    if (a.includes('--fazer')) {
      const id = valor('--fazer'); const item = B.ler(B.caminhoPadrao(cwd)).itens.find((x) => x.id === id)
      if (!item || item.origem !== 'felipe') throw new Error(`${id} não é um item dele`)
      const texto = String(item.citacao || item.intencao || '')
      const q = registrarPergunta(cwd, { tipo: 'pedido', titulo: String(item.intencao || '').slice(0, 80), porque: 'ele escolheu fazer este item no pedido de direção', pergunta: 'Constrói este item agora?', opcoes: ['Sim, constrói agora', 'Não, depois'], executa: 'Sim, constrói agora', pedido: texto.slice(0, 600), daFila: item.id, daFilaTexto: item.intencao || '' })
      responder(cwd, q.id, 'Sim, constrói agora', { automatico: `ele escolheu fazer ${id} no pedido de direção` })
      return executarFicha(q.id, valor('--avisar') || await conversaDoArquiteto(cwd), { automatico: `${id}: ${String(item.intencao).slice(0, 80)}` })
    }
    if (a.includes('--executar')) return executarFicha(valor('--executar'), valor('--avisar') || await conversaDoArquiteto(cwd))
    if (a.includes('--juntar')) {
      const ficha = valor('--juntar')
      const it = B.ler(B.caminhoPadrao(cwd)).itens.find((x) => x.id === ficha)
      const dir = it?.proposta?.juntar
      if (!dir) throw new Error(`${ficha} não é uma revisão de obra feita numa cópia`)
      const conversa = valor('--avisar') || await conversaDoArquiteto(cwd)
      const r = juntarCopia(cwd, dir)
      if (!r.ok) {
        // conflito: nada foi tocado. Ele resolve à mão e manda tentar de novo, ou deixa só na cópia.
        const rev = registrarPergunta(cwd, { tipo: 'revisao', titulo: 'Não consegui juntar: arquivos mexidos nos dois lados', porque: `Estes arquivos mudaram na cópia e no projeto: ${r.conflitos.slice(0, 8).join(', ')}${r.conflitos.length > 8 ? ' e mais ' + (r.conflitos.length - 8) : ''}. Não toquei em nada.`.slice(0, 500), pergunta: 'Como seguimos com a junção?', opcoes: ['Já resolvi, junte de novo', 'Deixe só na cópia por enquanto'], juntar: dir })
        await api('/api/gate/nota', { id: conversa, ...mensagemDaPergunta(rev) })
        return console.log(`junção recusada: ${r.conflitos.length} conflito(s); pergunta ${rev.id}`)
      }
      B.debater(ficha, `juntado ao projeto: ${r.aplicados.length} arquivo(s) novos ou alterados, ${r.removidos.length} removido(s). Preparado para commit, sem commitar. A cópia segue em ${dir}.`, { tipo: 'nota' }, B.caminhoPadrao(cwd))
      await api('/api/gate/nota', { id: conversa, texto: `Arquiteto: juntei ao projeto de verdade. ${r.aplicados.length} arquivo(s) novos ou alterados e ${r.removidos.length} removido(s), prontos para commit (não commitei). A cópia continua guardada em ${dir}.` })
      console.log(`juntado: ${r.aplicados.length} aplicados, ${r.removidos.length} removidos`)
      return seguir(conversa)
    }
    if (a.includes('--passo')) return seguir(valor('--avisar') || await conversaDoArquiteto(cwd))
    console.log('uso: node src/arquiteto.mjs --pasta <projeto> --propor | --passo [--avisar <conversa>]')
  })().catch((e) => { console.error('arquiteto: ' + e.message); process.exit(1) })
}
