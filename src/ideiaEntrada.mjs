/**
 * CC-986: a área de ideias no Caminho. Ele dita ou escreve uma ideia solta, o agy propõe UMA ideia-mãe com as partes
 * dela, ele escolhe o lugar da mãe uma vez e tudo entra no backlog: a mãe como emenda, as partes como filhas dela.
 *
 * A IA sugere, a regra decide, ele escolhe: o agy só propõe; `validarQuebra` confere o formato antes de a tela ver;
 * `gravar` recusa mãe sem lugar. Escolha dele dentro da ideia ("A OU B") nunca vira parte: o agy devolve `escolhas`,
 * a tela pergunta, e a resposta volta em `respostas` (e fica na história da mãe como decisão). Se o agy falhar ou
 * devolver lixo, sai só a mãe com o texto dele: o que ele ditou nunca se perde. O texto inteiro vai em `citacao` da mãe.
 */
import { createHash } from 'node:crypto'
import * as B from './backlog.mjs'
import path from 'node:path'
import { catalogoDe, ehFrente, listaDeFrentes } from './frentes.mjs'
import { emendar, frenteAtual, sugerirLugar } from './emenda.mjs'
import * as AGY from './resumoAgy.mjs'

const TETO_INTENCAO = 140 // o mesmo do backlog: acima disso ele recusa o item
const MAX_PARTES = 6
const MAX_ESCOLHAS = 3
const MAX_TEXTO = 20000
const TETO_RESPOSTA = 300 // pergunta e resposta, cada uma
const TRAVESSAO = /[—–]/
const codigos = (lista) => lista.map((x) => x.codigo || x)

/** As respostas dele limpas: [{pergunta, resposta}] com texto, no teto de tamanho e de quantidade. Torta, recusa. */
export function limparRespostas(respostas) {
  if (respostas == null) return []
  if (!Array.isArray(respostas) || respostas.length > MAX_ESCOLHAS) throw new Error(`mande de 0 a ${MAX_ESCOLHAS} respostas`)
  return respostas.map((r, i) => {
    const pergunta = String(r?.pergunta || '').trim(); const resposta = String(r?.resposta || '').trim()
    if (!pergunta || !resposta) throw new Error(`resposta ${i + 1}: faltou a pergunta ou a resposta`)
    if (pergunta.length > TETO_RESPOSTA || resposta.length > TETO_RESPOSTA) throw new Error(`resposta ${i + 1}: acima de ${TETO_RESPOSTA} letras`)
    return { pergunta, resposta }
  })
}

/** O pedido ao agy. Contexto: { projeto, frentes (catálogo ou null), abertos (itens do backlog), respostas (escolhas já feitas) }. */
export function pedidoDeQuebra(texto, { projeto = '', frentes = null, abertos = [], respostas = [] } = {}) {
  const recentes = abertos.filter(B.estaAberto).sort((a, b) => String(b.criado).localeCompare(String(a.criado)) || b.id.localeCompare(a.id)).slice(0, 10)
  return `Você ajuda o dono do projeto "${projeto}" a transformar uma ideia solta, ditada ou escrita, em UMA ideia-mãe com as partes dela no backlog. Não use ferramentas, só leia o texto.

Responda SOMENTE com JSON, sem texto antes nem depois, neste formato:
{"ideia":{"intencao":"...","natureza":"...","area":"...","tamanho":"...","pronto":"...","conferir":"...","frente":"..."},"escolhas":[{"pergunta":"...","opcoes":["...","..."]}],"partes":[{"intencao":"...","natureza":"...","area":"...","tamanho":"...","pronto":"...","conferir":"..."}]}

Regras:
- ideia: a mãe. Resume o TODO que o dono quer, numa frase, e vale para a ideia inteira.
- partes: de 0 a ${MAX_PARTES}, cada uma é uma entrega que faz sentido sozinha e diz, na intenção ou no pronto, como se liga à ideia. Nada de tarefa solta; ideia simples vem com poucas partes ou nenhuma.
- decisão do dono NUNCA é parte. Quando o texto traz uma escolha dele (por exemplo "A ou B"), ela vai em escolhas: de 0 a ${MAX_ESCOLHAS} escolhas, cada uma com a pergunta e de 2 a 4 opções curtas.
${respostas.length ? `- o dono JÁ respondeu as escolhas abaixo: escolhas vem vazio e as partes seguem essas respostas, de 1 a ${MAX_PARTES} partes.` : '- se houver escolha, as partes podem vir vazias: elas são montadas depois que o dono responder.'}
- tudo em português do Brasil, sem travessão.
- intencao: uma frase do que se quer, no máximo 120 letras.
- natureza, uma de: ${B.NATUREZAS.map((n) => `${n.codigo} (${n.desc})`).join('; ')}.
- area, uma de: ${B.AREAS.map((a) => `${a.codigo} (${a.desc})`).join('; ')}.
- tamanho, um de: ${B.TAMANHOS.map((t) => `${t.codigo} (${t.desc})`).join('; ')}. Se der G, quebre em partes menores.
- pronto: o que se observa quando estiver feito.
- conferir: "modo:o que conferir", com modo ${B.MODOS_DE_CONFERIR.join(', ')} (auto: a máquina roda um comando; olho: alguém abre a tela e vê; dele: só o dono pode dizer).
- frente (só na ideia, opcional): ${frentes ? `um destes códigos: ${listaDeFrentes(frentes)}` : 'deixe de fora'}.
${recentes.length ? `\nTarefas abertas agora (não duplique):\n${recentes.map((i) => `- ${i.id}: ${String(i.intencao || i.titulo || '').slice(0, 90)}`).join('\n')}\n` : ''}${respostas.length ? `\nESCOLHAS JÁ FEITAS PELO DONO:\n${respostas.map((r) => `- ${r.pergunta} => ${r.resposta}`).join('\n')}\n` : ''}
IDEIA DO DONO:
${String(texto).slice(0, 6000)}`
}

/** Confere uma tarefa (a mãe ou uma parte) contra as escalas do backlog. Devolve o objeto limpo e empurra os erros. */
function conferirTarefa(t, n, erros) {
  const o = { intencao: String(t?.intencao || '').trim(), natureza: t?.natureza, area: t?.area, tamanho: t?.tamanho, pronto: String(t?.pronto || '').trim(), conferir: String(t?.conferir || '').trim() }
  if (!o.intencao) erros.push(`${n}: falta intencao`)
  else if (o.intencao.length > TETO_INTENCAO) erros.push(`${n}: intencao com ${o.intencao.length} letras, o teto é ${TETO_INTENCAO}`)
  if (!codigos(B.NATUREZAS).includes(o.natureza)) erros.push(`${n}: natureza fora da escala: ${o.natureza}`)
  if (!codigos(B.AREAS).includes(o.area)) erros.push(`${n}: area fora da escala: ${o.area}`)
  if (!codigos(B.TAMANHOS).includes(o.tamanho)) erros.push(`${n}: tamanho fora da escala: ${o.tamanho}`)
  if (!o.pronto) erros.push(`${n}: falta pronto`)
  const [modo, ...resto] = o.conferir.split(':')
  if (!B.MODOS_DE_CONFERIR.includes(modo) || !resto.join(':').trim()) erros.push(`${n}: conferir deve ser modo:texto (${B.MODOS_DE_CONFERIR.join(', ')})`)
  if (TRAVESSAO.test(`${o.intencao}${o.pronto}${o.conferir}`)) erros.push(`${n}: travessão no texto`)
  return o
}

/**
 * Aceita o JSON puro ou um bloco ```json. Devolve { ok, ideia, escolhas, partes, erros }.
 * `frentes` (catálogo) confere o campo opcional da mãe. Com `comRespostas`, o agy não pode perguntar de novo e
 * precisa montar de 1 a 6 partes; sem respostas, escolha pendente deixa as partes de lado (a tela pergunta antes).
 */
export function validarQuebra(saida, { frentes = null, comRespostas = false } = {}) {
  const vazio = { ok: false, ideia: null, escolhas: [], partes: [] }
  const erros = []
  let s = String(saida || '').trim()
  const bloco = /```(?:json)?\s*([\s\S]*?)```/i.exec(s)
  if (bloco) s = bloco[1].trim()
  let j
  try { j = JSON.parse(s) } catch { return { ...vazio, erros: ['a resposta não é JSON'] } }
  if (!j?.ideia || typeof j.ideia !== 'object') return { ...vazio, erros: ['faltou "ideia"'] }
  const ideia = conferirTarefa(j.ideia, 'ideia', erros)
  // frente é opcional: só vale a do catálogo; fora dele cai na frente atual do Caminho, sem recusar a quebra
  if (frentes && typeof j.ideia.frente === 'string' && Object.hasOwn(frentes, j.ideia.frente)) ideia.frente = j.ideia.frente

  const escolhasCruas = j.escolhas == null ? [] : j.escolhas
  if (!Array.isArray(escolhasCruas)) erros.push('"escolhas" deve ser uma lista')
  const escolhas = (Array.isArray(escolhasCruas) ? escolhasCruas : []).slice(0, MAX_ESCOLHAS).map((e, i) => {
    const n = `escolha ${i + 1}`
    const pergunta = String(e?.pergunta || '').trim()
    const opcoes = Array.isArray(e?.opcoes) ? e.opcoes.map((x) => String(x ?? '').trim()) : []
    if (!pergunta) erros.push(`${n}: falta a pergunta`)
    else if (pergunta.length > TETO_RESPOSTA) erros.push(`${n}: pergunta com mais de ${TETO_RESPOSTA} letras`)
    if (opcoes.length < 2 || opcoes.length > 4) erros.push(`${n}: são de 2 a 4 opções, vieram ${opcoes.length}`)
    else if (opcoes.some((x) => !x || x.length > TETO_RESPOSTA)) erros.push(`${n}: opção vazia ou longa demais`)
    if (TRAVESSAO.test(`${pergunta}${opcoes.join('')}`)) erros.push(`${n}: travessão no texto`)
    return { pergunta, opcoes }
  })
  if (Array.isArray(escolhasCruas) && escolhasCruas.length > MAX_ESCOLHAS) erros.push(`${escolhasCruas.length} escolhas, o teto é ${MAX_ESCOLHAS}`)

  const partesCruas = j.partes == null ? [] : j.partes
  if (!Array.isArray(partesCruas)) erros.push('"partes" deve ser uma lista')
  else if (partesCruas.length > MAX_PARTES) erros.push(`${partesCruas.length} partes, o teto é ${MAX_PARTES}`)
  const confere = escolhas.length && !comRespostas ? [] : (Array.isArray(partesCruas) ? partesCruas : []) // escolha pendente: as partes ainda não valem
  const partes = confere.slice(0, MAX_PARTES).map((t, i) => conferirTarefa(t, `parte ${i + 1}`, erros))
  if (comRespostas && escolhas.length) erros.push('o dono já respondeu: "escolhas" tem de vir vazio')
  if (comRespostas && !partes.length) erros.push('o dono já respondeu: faltaram as partes')
  return { ok: !erros.length, ideia: erros.length ? null : ideia, escolhas: erros.length ? [] : escolhas, partes: erros.length ? [] : partes, erros }
}

/** A mãe de reserva, com o que ele ditou, para quando o agy não ajuda. */
function ideiaDoTexto(texto) {
  const t = String(texto).replace(/[—–]/g, ',').replace(/\s+/g, ' ').trim()
  return { intencao: t.length > TETO_INTENCAO ? `${t.slice(0, TETO_INTENCAO - 1)}…` : t, natureza: 'PED', area: 'texto', tamanho: 'M', pronto: 'a ideia foi lida, entendida e virou trabalho de verdade', conferir: 'dele: confirmar que a tarefa diz o que ele quis dizer' }
}

const chaveDe = (raiz, texto, respostas) => `ideia::${createHash('sha1').update(`${raiz}\0${texto}\0${JSON.stringify(respostas)}`).digest('hex')}`

/**
 * Pede a quebra ao agy pela fila e devolve:
 *   { estado }                      ainda não chegou: a tela pergunta de novo
 *   { escolhas }                    o texto traz escolha dele sem resposta: a tela pergunta e chama de novo com `respostas`
 *   { ideia, partes, sugestao }     a mãe (com `frente`) e as partes; `sugestao` { onde, porque } é o lugar da mãe
 * `semIA` (o motivo) marca a mãe de reserva, sem partes. `agy` existe para o teste trocar a leitura do agy.
 */
export function organizar(raiz, texto, { agy = AGY, respostas = [] } = {}) {
  const t = String(texto || '').trim().slice(0, MAX_TEXTO)
  if (!t) throw new Error('escreva ou dite a ideia antes de organizar')
  const resp = limparRespostas(respostas)
  const arquivo = B.caminhoPadrao(raiz)
  const { itens } = B.ler(arquivo)
  const frentes = catalogoDe(arquivo)
  const k = chaveDe(raiz, t, resp)
  agy.pedirTexto({ k, max: 8000, prompt: pedidoDeQuebra(t, { projeto: path.basename(raiz), frentes, abertos: itens, respostas: resp }) })
  const r = agy.obterTexto(k)
  if (r?.estado) return { estado: r.estado }
  let v = null; let semIA = null
  if (r?.texto) {
    v = validarQuebra(r.texto, { frentes, comRespostas: resp.length > 0 })
    if (!v.ok) { semIA = `o agy devolveu algo fora do formato (${v.erros[0]})`; v = null }
  } else semIA = agy.falhaDe(k) ? `o agy falhou: ${agy.falhaDe(k)}` : 'o agy não respondeu'
  if (v?.escolhas.length) return { escolhas: v.escolhas }
  const mae = v ? v.ideia : ideiaDoTexto(t)
  const frente = mae.frente || frenteAtual(raiz)
  const ideia = { ...mae, frente }
  return {
    ideia,
    partes: v ? v.partes : [],
    sugestao: sugerirLugar({ ...ideia, citacao: t }, { itens, sprint: B.sprintAtualIds(raiz) }),
    ...(semIA ? { semIA } : {}),
  }
}

/**
 * Grava a ideia-mãe e as partes. Tudo ou nada: confere a mãe, o lugar e cada parte antes de gravar a primeira.
 * A mãe entra por `emendar` com o lugar escolhido e o texto ditado inteiro em `citacao`; cada resposta dele vira uma
 * decisão na história da mãe ("pergunta > resposta"); cada parte entra como filha (`pai` = a mãe), em B1.
 * Devolve { id, filhas: [ids] }.
 */
export function gravar(raiz, { texto, ideia, partes = [], lugar, respostas = [] } = {}) {
  const citacao = String(texto || '').trim().slice(0, MAX_TEXTO)
  if (!citacao) throw new Error('falta o texto da ideia')
  if (!B.LUGARES.some((l) => l.codigo === lugar)) throw new Error(`falta o lugar da ideia na fila (${B.LUGARES.map((l) => l.codigo).join(', ')})`)
  if (!ideia || typeof ideia !== 'object') throw new Error('falta a ideia')
  if (!Array.isArray(partes) || partes.length > MAX_PARTES) throw new Error(`mande de 0 a ${MAX_PARTES} partes`)
  const resp = limparRespostas(respostas)
  const falhas = (o) => B.problemasDoFormato(o).concat(TRAVESSAO.test(`${o.intencao}${o.pronto}${o.conferir}`) ? ['travessão no texto'] : [])
  const miolo = (t) => ({ intencao: String(t.intencao || '').trim(), natureza: t.natureza, area: t.area, tamanho: t.tamanho, pronto: String(t.pronto || '').trim(), conferir: String(t.conferir || '').trim() })
  const mae = { ...miolo(ideia), citacao, lugar }
  if (typeof ideia.frente === 'string' && ideia.frente) mae.frente = ideia.frente
  const pm = falhas(mae)
  if (pm.length) throw new Error(`ideia: ${pm.join('; ')}`)
  if (!mae.frente && !frenteAtual(raiz)) throw new Error('ideia: não achei em que trecho o projeto está')
  if (mae.frente && !ehFrente(mae.frente, catalogoDe(B.caminhoPadrao(raiz)))) throw new Error(`ideia: frente "${mae.frente}" fora do catálogo do projeto`)
  const filhas = partes.map((t, i) => {
    const c = miolo(t ?? {})
    const p = falhas(c)
    if (p.length) throw new Error(`parte ${i + 1}: ${p.join('; ')}`)
    return c
  })
  const arquivo = B.caminhoPadrao(raiz)
  const m = emendar(raiz, mae)
  for (const r of resp) B.debater(m.id, `${r.pergunta} > ${r.resposta}`, { tipo: 'decisao', de: 'felipe' }, arquivo)
  const prefixo = B.prefixoDoProjeto(B.ler(arquivo).itens, raiz)
  return { id: m.id, filhas: filhas.map((c) => B.acrescentar({ ...c, pai: m.id, estado: 'B1', origem: 'emenda', prefixo }, arquivo).id) }
}
