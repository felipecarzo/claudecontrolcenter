#!/usr/bin/env node
/**
 * CC-84 — dois agentes no mesmo projeto, se falando.
 *
 * ## Por que existe
 *
 * O Felipe vai colocar dois agentes no mesmo projeto a partir de 16/08. Palavras
 * dele: *"se dois agentes trabalham em rotas diferentes e um precisa mexer num
 * arquivo que está na rota do outro, ele pode abrir um ticket, e um vai parar o
 * Claude no meio do que ele está fazendo e avisar"*.
 *
 * Hoje a conversa entre sessões é o `ROTAS-ATIVAS.md`, com 336 linhas de recado
 * em markdown. Diagnóstico dele: *"esse recadinho que a gente ta fazendo é
 * ineficiente"*.
 *
 * O `rota-pedidos.mjs` resolveu UM caso — pedir autorização de rota — e é o
 * irmão mais velho disto. Aqui a conversa é geral.
 *
 * ## O achado técnico que muda o desenho, e melhora
 *
 * Ele pediu "parar o Claude no meio". **Isso não existe:** não há como
 * interromper um agente que está pensando. Mas todo agente passa por
 * `PreToolUse` a cada ferramenta que usa, várias vezes por minuto.
 *
 * **O ponto de interrupção mais cedo possível é a próxima ferramenta, não o fim
 * do turno.** É o que este hook usa, e é muito melhor que o `routia-fim`, que só
 * avisa no `Stop` — se o outro estiver numa tarefa longa, o recado espera.
 *
 * ## Por que o recado INTERROMPE, mesmo sendo só aviso
 *
 * Um hook `PreToolUse` só tem uma forma de fazer o agente LER alguma coisa:
 * recusar a chamada e devolver o texto (exit 2). Com exit 0 o agente nunca fica
 * sabendo. Então todo recado custa uma interrupção — **uma só**: ele é marcado
 * como entregue e a ferramenta seguinte passa.
 *
 * É barato e é honesto: um recado que não interrompe é um recado que ninguém lê,
 * e foi exatamente esse o problema do markdown.
 *
 * ## Princípios herdados do rota-guard
 *
 * - **FALHA ABERTA.** Erro aqui nunca pode travar trabalho. Roda em TODA
 *   chamada de ferramenta: hook lento ou quebrado trava os dois agentes.
 * - **Estado no projeto** (`docs/.recados.json`), que é onde as sessões daquele
 *   repositório se encontram — mesma decisão do `rota-pedidos`.
 *
 * ## Uso
 *
 *   node recados.mjs enviar <para> <tipo> "texto"   [--arquivo x] [--dir .]
 *   node recados.mjs caixa [--dir .]                o que chegou pra mim
 *   node recados.mjs log [--dir .] [--n 30]         tudo que foi dito, recente primeiro
 *   node recados.mjs quem [--dir .]                 sessões vistas neste projeto
 *
 * `para` aceita o id curto de outra sessão, ou `todos`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const liberar = () => process.exit(0)

/** Tipos de recado, e o que cada um pede de quem recebe. Poucos de propósito:
 *  lista longa vira taxonomia que ninguém lembra na hora de mandar. */
export const TIPOS = {
  aviso: {
    rotulo: 'aviso',
    acao: 'Leia e siga o que estava fazendo. Nada a responder.',
  },
  vou_mexer: {
    rotulo: 'vou mexer num arquivo seu',
    acao: 'Se isso atrapalha o que você está fazendo, responda com `pare`; '
      + 'se não atrapalha, responda com `liberado` e siga.',
  },
  pare: {
    rotulo: 'PARE e me responda',
    acao: 'Pare o que está fazendo agora, responda, e só então continue.',
  },
  liberado: {
    rotulo: 'pode mexer, não me atrapalha',
    acao: 'Você está liberado para o que pediu. Siga.',
  },
  terminei: {
    rotulo: 'terminei, pode ir',
    acao: 'O arquivo está livre. Se você estava esperando por isto, siga.',
  },
}

const arquivoDe = (raiz) => join(raiz, 'docs', '.recados.json')

/** Sobe até achar a raiz do projeto (a que tem o quadro de rotas). */
export function acharRaiz(inicio) {
  let dir = resolve(inicio || process.cwd())
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'docs', 'ROTAS-ATIVAS.md'))) return dir
    const pai = dirname(dir)
    if (pai === dir) break
    dir = pai
  }
  return null
}

export function ler(raiz) {
  try { return JSON.parse(readFileSync(arquivoDe(raiz), 'utf8')) } catch { return { recados: [] } }
}

/** Escrita atômica, o padrão do projeto: nunca deixar o arquivo pela metade. */
export function gravar(raiz, dados) {
  const arq = arquivoDe(raiz)
  mkdirSync(dirname(arq), { recursive: true })
  const tmp = `${arq}.tmp`
  writeFileSync(tmp, JSON.stringify(dados, null, 1))
  renameSync(tmp, arq)
}

const curto = (id) => String(id || '').slice(0, 8)

export function enviar(raiz, { de, para, tipo, texto, arquivo = null }) {
  if (!TIPOS[tipo]) throw new Error(`tipo desconhecido: ${tipo}. Use ${Object.keys(TIPOS).join(', ')}`)
  const dados = ler(raiz)
  const recado = {
    id: `${curto(de)}-${Date.now().toString(36)}`,
    de: curto(de),
    para: para === 'todos' ? 'todos' : curto(para),
    tipo,
    texto: String(texto || '').slice(0, 600),
    arquivo,
    em: Date.now(),
    entregue: [],
  }
  dados.recados = [...(dados.recados || []), recado].slice(-300)
  gravar(raiz, dados)
  return recado
}

/** O que ainda não foi entregue a esta sessão. Recado dela mesma não conta. */
export function pendentes(raiz, eu) {
  const meu = curto(eu)
  return (ler(raiz).recados || []).filter((r) => r.de !== meu
    && (r.para === meu || r.para === 'todos')
    && !(r.entregue || []).includes(meu))
}

export function marcarEntregue(raiz, eu, ids) {
  const meu = curto(eu)
  const dados = ler(raiz)
  for (const r of dados.recados || []) {
    if (ids.includes(r.id)) r.entregue = [...new Set([...(r.entregue || []), meu])]
  }
  gravar(raiz, dados)
}

/** CC-85: o log. Recente primeiro, porque a pergunta é sempre "o que houve
 *  agora?" e não "o que houve no começo". */
export const log = (raiz, n = 30) => [...(ler(raiz).recados || [])].reverse().slice(0, n)

const textoDoRecado = (r) => {
  const quando = new Date(r.em).toISOString().slice(11, 16)
  return [
    `[${quando}] ${r.de} → ${r.para}: ${TIPOS[r.tipo]?.rotulo || r.tipo}`,
    r.arquivo ? `  arquivo: ${r.arquivo}` : '',
    `  ${r.texto}`,
    `  → ${TIPOS[r.tipo]?.acao || ''}`,
  ].filter(Boolean).join('\n')
}

/* ------------------------------- hook -------------------------------
   Sem argumento, é hook de PreToolUse: lê a entrada do Claude Code, entrega
   o que chegou e sai. Com argumento, é comando de terminal. */

const [cmd, ...resto] = process.argv.slice(2)
const val = (f, d = null) => {
  const i = resto.indexOf(f)
  return i >= 0 && resto[i + 1] ? resto[i + 1] : d
}
const posicionais = resto.filter((a, i) => !a.startsWith('--') && !(resto[i - 1] || '').startsWith('--'))

if (!cmd) {
  let dados = null
  try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { liberar() }

  const eu = process.env.CLAUDE_CODE_SESSION_ID
    || (process.env.CLAUDE_JOB_DIR || '').split(/[\\/]/).filter(Boolean).pop()
  if (!eu) liberar() // sem identidade não há caixa

  const raiz = acharRaiz(dados?.cwd)
  if (!raiz) liberar() // projeto sem Routia: silêncio total

  let meus = []
  try { meus = pendentes(raiz, eu) } catch { liberar() }
  if (!meus.length) liberar()

  try { marcarEntregue(raiz, eu, meus.map((r) => r.id)) } catch { /* segue */ }

  const precisaParar = meus.some((r) => r.tipo === 'pare' || r.tipo === 'vou_mexer')
  console.error(
    `${meus.length} recado(s) de outro agente neste projeto:\n\n`
    + meus.map(textoDoRecado).join('\n\n')
    + `\n\nResponda com:  node ${process.argv[1]} enviar <id-de-quem-mandou> <tipo> "texto"`
    + (precisaParar ? '\n\nIsto NÃO é aviso: alguém está esperando sua resposta.' : '')
    + '\n\nEsta é a única interrupção deste recado — a próxima ferramenta passa.',
  )
  process.exit(2)
}

const raiz = acharRaiz(val('--dir') || process.cwd())
if (!raiz) {
  console.error('sem docs/ROTAS-ATIVAS.md: este projeto não usa o Método Routia')
  process.exit(1)
}
const eu = process.env.CLAUDE_CODE_SESSION_ID
  || (process.env.CLAUDE_JOB_DIR || '').split(/[\\/]/).filter(Boolean).pop()
  || 'terminal'

if (cmd === 'enviar') {
  const [para, tipo, texto] = posicionais
  if (!para || !tipo || !texto) {
    console.error(`uso: recados.mjs enviar <para|todos> <${Object.keys(TIPOS).join('|')}> "texto" [--arquivo x]`)
    process.exit(1)
  }
  /* CC-86: com `--arquivo`, o recado leva o impacto junto. Muda "vou mexer no
     seu arquivo" para algo que o outro julga sem abrir nada.

     O cálculo roda AQUI, no envio, que é raro — nunca no hook, que roda em toda
     chamada de ferramenta. São ~50ms: aceitável uma vez, inaceitável mil. */
  let alvo = val('--arquivo')
  let comImpacto = texto
  if (alvo) {
    try {
      const D = await import(new URL('../../src/dependencias.mjs', import.meta.url))
      comImpacto = `${texto}\n  impacto: ${D.aviso(D.mapear(raiz), alvo)}`
    } catch { /* sem o módulo, o recado vai sem o impacto: melhor que não ir */ }
  }
  const r = enviar(raiz, { de: eu, para, tipo, texto: comImpacto, arquivo: alvo })
  console.log(`enviado ${r.id} para ${r.para}: ${TIPOS[r.tipo].rotulo}`)
} else if (cmd === 'caixa') {
  const meus = pendentes(raiz, eu)
  console.log(meus.length ? meus.map(textoDoRecado).join('\n\n') : 'nenhum recado novo')
} else if (cmd === 'log') {
  const n = Number(val('--n', 30))
  const l = log(raiz, n)
  console.log(l.length ? l.map(textoDoRecado).join('\n\n') : 'ninguém falou nada neste projeto ainda')
} else if (cmd === 'quem') {
  const vistos = new Map()
  for (const r of ler(raiz).recados || []) {
    vistos.set(r.de, Math.max(vistos.get(r.de) || 0, r.em))
    for (const e of r.entregue || []) vistos.set(e, Math.max(vistos.get(e) || 0, r.em))
  }
  if (!vistos.size) { console.log('nenhuma sessão trocou recado neste projeto') } else {
    for (const [s, q] of [...vistos].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${s}${s === eu.slice(0, 8) ? ' (você)' : ''} — visto ${Math.round((Date.now() - q) / 60000)}min atrás`)
    }
  }
} else {
  console.error('comandos: enviar, caixa, log, quem')
  process.exit(1)
}
