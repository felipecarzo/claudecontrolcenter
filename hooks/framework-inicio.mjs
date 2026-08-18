#!/usr/bin/env node
/**
 * F8: a entrevista. O hook que faz o framework CONDUZIR em vez de só recusar.
 *
 * Roda no `SessionStart` e injeta, no começo da sessão, três coisas: onde o
 * projeto está, com que tom falar, e **a próxima pergunta a fazer ao Felipe**
 * quando há pendência.
 *
 * É a inversão da visão dele: "ele me demandaria tarefas estruturais de um
 * sistema, pra gente definir o que a gente vai fazer [...] é como se começasse
 * uma sequência de desenvolvimento". Até aqui o framework só sabia dizer não
 * (`framework-guard`, no `PreToolUse`); isto é o que faz ele puxar.
 *
 * ## Por que injetar em vez de bloquear
 *
 * `SessionStart` não tem como recusar nada — não existe ferramenta para barrar.
 * O que ele faz é colocar contexto na mesa. Aqui isso basta, porque a trava já
 * existe do outro lado: se eu ignorar a pergunta e for escrever código, o
 * `framework-guard` me recusa. Um conduz, o outro segura.
 *
 * ## A pergunta vem do catálogo, não da minha cabeça
 *
 * `PERGUNTAS`, em `src/framework.mjs`. É a decisão dele de 14/08, e o motivo é o
 * risco que ele mesmo nomeou: quem escreve as opções molda a decisão. Se eu
 * inventasse a pergunta e as alternativas na hora, teria filtrado o mundo antes
 * de ele escolher. O `AskUserQuestion` sempre acrescenta resposta livre por
 * conta própria, que é a válvula contra a moldura que sobrar.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let entrada = ''
try { entrada = readFileSync(0, 'utf8') } catch { sair() }

let dados = null
try { dados = JSON.parse(entrada) } catch { sair() }

const { acharRaiz, ler } = await import(resolve(AQUI, '../src/frameworkDisco.mjs')).catch(sair)
const F = await import(resolve(AQUI, '../src/framework.mjs')).catch(sair)

const raiz = acharRaiz(dados?.cwd || process.cwd())
if (!raiz) sair() // projeto sem framework: silêncio total

const estado = ler(raiz)
if (!estado || estado.ligado === false) sair()

const modo = F.modoDe(estado)
const tom = F.tomDe(estado)
const linhas = [
  `FRAMEWORK ligado neste projeto — ${F.resumo(estado.metodo, estado)}`,
  `Modo ${modo.titulo}: ${modo.explica}`,
  `Tom ${tom}: ${F.TONS[tom]}`,
  /* A regra que ele chamou de "segredo master do framework", e que eu quebrei
     em 15/08 perguntando em prosa no meio de uma resposta longa. Ele:
     "por que você me fez essa pergunta no chat, em vez daquele formato de
     perguntinha na tela? Aquilo é a regra, o framework tem que usar aquilo."

     A diferença não é estética: em prosa a pergunta fica no fim de um texto
     que ele pode não terminar de ler, e a resposta vira mais prosa. Na
     ferramenta ela é uma tela, com as opções medidas e o tradeoff visível —
     que é o que ele pediu desde o começo: "no mouse e poucas teclas resolver
     problemas complexos". */
  'REGRA: pergunta decisiva vai no AskUserQuestion, nunca em prosa no meio da '
    + 'resposta. Se a resposta muda o que será feito, é decisiva.',
]

/* O fluxo do modo, quando ele define um. No restritivo é o que dá mecanismo ao
   modo: sem isto, ele é só um rótulo (dívida registrada em produto/FRAMEWORK). */
if (modo.fluxo) {
  linhas.push(
    `FLUXO deste modo — pedido novo: ${modo.fluxo.pedidoNovo}.`,
    `Só pare para: ${modo.fluxo.paradaLegitima}.`,
    `NÃO pare para: ${modo.fluxo.naoPara}.`,
  )
}

if (modo.trava) {
  const n = (estado.autorizado || []).length
  linhas.push(n
    ? `Autorização em vigor para: ${estado.autorizado.join(', ')}.`
    : 'Sem autorização em vigor: escrever código está bloqueado até ele autorizar.')
}

/**
 * CC-135: o sugestivo SUGERE, não só trava.
 *
 * Dele em 16/08, corrigindo o desenho anterior: *"o modo sugestivo é
 * exatamente o oposto do que eu falei. Porque ao invés de você fazer uma
 * abstração pra dentro, o modo sugestivo faz uma abstração pra fora, ele
 * busca características acima. Ele vai sugerir coisas que possam ser feitas
 * no projeto, e sempre manter a opção de eu poder escrever, porque dessas
 * coisas que eu leio surgem novas ideias."*
 *
 * "Pra fora" é o roadmap, não a próxima tarefa: as FRENTES abertas, na mesma
 * ordem de importância que a aba do painel já usa (`ordenar()`), para as duas
 * telas nunca discordarem sobre o que é prioridade. Sem roadmap, sem
 * sugestão — silêncio, porque inventar frente sem fonte seria a mesma moldura
 * que o `AskUserQuestion` existe para evitar em outro lugar deste arquivo.
 */
if (modo.sugereFrentes) {
  try {
    const R = await import(resolve(AQUI, '../src/roadmap.mjs'))
    const mapa = R.lerRoadmap(raiz)
    const abertas = R.ordenar(raiz, mapa).porImportancia.filter((f) => f.estado !== 'feito')
    if (abertas.length) {
      linhas.push('', `SUGIRA, NÃO IMPONHA — frentes abertas neste projeto, da mais para a menos importante:`)
      for (const f of abertas.slice(0, 5)) {
        const marca = f.citacao ? ` — nas palavras dele: "${f.citacao}"` : ''
        linhas.push(`  - [${f.grupo}] ${f.titulo}${f.itens ? ` (${f.itens} item(ns))` : ''}${marca}`)
      }
      linhas.push(
        'Apresente como opções, no começo da conversa, não como plano já decidido.',
        'A escrita livre dele vale sempre: se ele disser outra coisa, é o que vale, '
          + 'e ler estas opções pode só ter feito ele lembrar do que já queria.',
      )
    }
  } catch { /* sem roadmap.mjs ou sem docs/ROADMAP.md: modo sugestivo sem o que sugerir, fica calado */ }
}

const p = F.proximaPergunta(estado.metodo, estado)
if (p) {
  linhas.push('', `PERGUNTE AO FELIPE ANTES DE SEGUIR — "${p.pergunta}"`)
  linhas.push(`(${p.ajuda})`)
  linhas.push('Use AskUserQuestion com estas opções, que vêm do catálogo do framework:')
  for (const o of p.opcoes) linhas.push(`  - ${o.label}: ${o.descricao}`)
  linhas.push('A resposta livre é automática, não invente uma opção "outro".')
  linhas.push(`Resolve a pendência: ${p.falta}`)
}

process.stdout.write(`${linhas.join('\n')}\n`)
process.exit(0)
