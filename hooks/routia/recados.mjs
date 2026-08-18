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
 *
 * ## Motor puro em `src/recados.mjs`
 *
 * `ler`, `gravar`, `enviar`, `pendentes`, `log` e `TIPOS` moram lá, não aqui.
 * Achado em 18/08, tentando ler o log deste arquivo do PAINEL: este arquivo tem
 * código de topo que interpreta `process.argv` e chama `process.exit()` sem
 * condição nenhuma — importá-lo de dentro do painel derrubava QUALQUER comando
 * do `cc.mjs`, porque o `argv` de quem importa nunca é `enviar`/`caixa`/etc, e o
 * arquivo saía sozinho no meio do carregamento. O painel importa
 * `src/recados.mjs`; este arquivo continua sendo a única porta de entrada para
 * quem fala com ele por hook ou por terminal.
 */
import { readFileSync } from 'node:fs'
import {
  TIPOS, acharRaiz, enviar, ler, log, marcarEntregue, pendentes, textoDoRecado,
} from '../../src/recados.mjs'

export { TIPOS, acharRaiz, enviar, ler, log, marcarEntregue, pendentes, textoDoRecado }

const liberar = () => process.exit(0)

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
