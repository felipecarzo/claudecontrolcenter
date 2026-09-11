/**
 * As regras que a VPS DECLARA e as outras máquinas obedecem.
 *
 * ## O que ele aprovou, e a diferença que isso faz
 *
 * Plano de Unificação, aprovado por ele em 11/09 na forma completa: *"a VPS
 * decide a regra (qual trava vale, qual modo, qual perfil) e o PC executa o que
 * ela mandou na última sincronia"*.
 *
 * Metade disso já existia e foi medida antes de escrever este arquivo: o canal
 * entre máquinas tem 10 ações, e 5 delas já decidem regra no PC
 * (`framework-ligar`, `-desligar`, `-modo`, `-modulo`, `-mvp`).
 *
 * **O que faltava é a NATUREZA.** Aquelas cinco são EVENTO: acontecem uma vez,
 * quando ele clica num botão. O que ele aprovou é ESTADO: a regra vale sempre,
 * e a máquina que divergir volta ao combinado na sincronia seguinte.
 *
 * A diferença aparece no dia seguinte, não no dia do clique: hoje, se alguém
 * trocar o modo no PC depois do pedido, ele fica diferente da VPS para sempre e
 * ninguém percebe. Nada no sistema compara.
 *
 * ## As quatro travas, e cada uma vem de um erro já pago neste projeto
 *
 * 1. **Campo ausente NUNCA muda nada.** A VPS declarar `{}` não é declarar
 *    "desligue tudo": é declarar "não tenho opinião". Confundir os dois
 *    desligaria o framework dos 12 projetos de uma vez, em silêncio, e é a
 *    mesma distinção entre `null` e `[]` que a federação já respeita.
 * 2. **A escolha LOCAL feita depois vence, até a próxima declaração.** Ele
 *    mexeu no painel do PC porque quis; a VPS sobrescrever no mesmo minuto
 *    faria o clique dele parecer quebrado. A VPS só reafirma quando a
 *    declaração é mais nova que a escolha local.
 * 3. **Nada é aplicado sem registro do que mudou e de onde veio.** Regra que
 *    muda sozinha e não deixa rastro é indistinguível de defeito, e ele não
 *    teria como saber por que o projeto trocou de modo.
 * 4. **Recusa declarar o que não existe.** Modo, módulo e projeto são listas
 *    fechadas: um nome errado na VPS viraria trava desligada em silêncio no
 *    PC, que é exatamente o formato de defeito que este projeto mais repete.
 *
 * ## O que este módulo NÃO faz
 *
 * Não fala com a rede e não escreve no framework: só decide O QUE deveria
 * mudar. Quem aplica é o mesmo caminho que já atende os pedidos hoje
 * (`atenderPedidos`, em `web.mjs`), porque duas formas de aplicar a mesma coisa
 * é como o modo passou a divergir da tela em 27/08.
 */

import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

/** Onde a máquina que MANDA guarda o que declarou. */
export const arquivoDeclaracoes = () => path.join(casaClaude(), 'cockpit-regras.json')

/** As regras que uma declaração pode carregar. Lista fechada de propósito. */
export const CAMPOS = ['ligado', 'modo', 'modulos', 'metodo']

const hoje = () => new Date().toISOString()

function lerArquivo(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')) } catch { return {} }
}

/** Escrita atômica, como todo o resto do projeto: tmp + rename. */
function gravarArquivo(dados, arquivo) {
  const tmp = arquivo + '.tmp'
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2), 'utf8')
  fs.renameSync(tmp, arquivo)
}

/**
 * Declara uma regra para uma máquina e um projeto.
 *
 * Valida contra o catálogo antes de gravar: nome de modo que não existe vira
 * trava desligada em silêncio do outro lado.
 */
export function declarar({ maquina, projeto, regras }, { arquivo = arquivoDeclaracoes(), modos = null, modulos = null } = {}) {
  if (!maquina || !projeto) return { ok: false, erro: 'declaração precisa de máquina e projeto' }
  if (!regras || typeof regras !== 'object') return { ok: false, erro: 'declaração sem regras' }

  const limpo = {}
  for (const [k, v] of Object.entries(regras)) {
    if (!CAMPOS.includes(k)) return { ok: false, erro: `campo desconhecido: ${k}. Os que valem: ${CAMPOS.join(', ')}` }
    if (v === undefined) continue
    if (k === 'modo' && modos && v !== null && !modos.includes(v)) {
      return { ok: false, erro: `modo desconhecido: ${v}. Os que existem: ${modos.join(', ')}` }
    }
    if (k === 'modulos' && modulos && v) {
      const fora = Object.keys(v).filter((m) => !modulos.includes(m))
      if (fora.length) return { ok: false, erro: `módulo desconhecido: ${fora.join(', ')}` }
    }
    limpo[k] = v
  }
  if (!Object.keys(limpo).length) return { ok: false, erro: 'nenhuma regra válida na declaração' }

  const tudo = lerArquivo(arquivo)
  tudo[maquina] ??= {}
  tudo[maquina][projeto] = { regras: limpo, em: hoje() }
  gravarArquivo(tudo, arquivo)
  return { ok: true, maquina, projeto, regras: limpo }
}

/** O que foi declarado para uma máquina. Vazio quando não há nada. */
export function declaracoesPara(maquina, { arquivo = arquivoDeclaracoes() } = {}) {
  const tudo = lerArquivo(arquivo)
  return tudo[maquina] || {}
}

/** Tira uma declaração. Sem isso, declarar seria caminho sem volta. */
export function esquecer({ maquina, projeto }, { arquivo = arquivoDeclaracoes() } = {}) {
  const tudo = lerArquivo(arquivo)
  if (!tudo[maquina]?.[projeto]) return { ok: true, jaNaoTinha: true }
  delete tudo[maquina][projeto]
  if (!Object.keys(tudo[maquina]).length) delete tudo[maquina]
  gravarArquivo(tudo, arquivo)
  return { ok: true }
}

/**
 * O que esta máquina precisa mudar para obedecer ao que foi declarado.
 *
 * Recebe o estado ATUAL de cada projeto daqui e as declarações que vieram, e
 * devolve a lista de diferenças. **Não escreve nada**: quem aplica é o caminho
 * que já atende os pedidos, e ter duas formas de aplicar a mesma coisa é como
 * o modo passou a divergir da tela em 27/08.
 *
 * `mexidoEm` é a hora da última escolha LOCAL, e é o que faz a trava 2 valer:
 * escolha feita depois da declaração vence, até a VPS declarar de novo.
 */
export function diferencas(declaracoes = {}, estadoLocal = {}) {
  const saida = []
  for (const [projeto, decl] of Object.entries(declaracoes)) {
    const regras = decl?.regras
    if (!regras || typeof regras !== 'object') continue
    const atual = estadoLocal[projeto]
    if (!atual) {
      saida.push({ projeto, campo: null, de: null, para: null, pulou: 'este projeto não existe nesta máquina' })
      continue
    }

    /* Trava 2: escolha local mais nova que a declaração vence. Sem isto, o
       clique dele no painel do PC seria desfeito no minuto seguinte.
       ⚠️ **Só vale quando há diferença de verdade, e a primeira versão errou
       nisto.** Aplicar a trava antes de comparar fazia todo projeto JÁ EM DIA
       aparecer como "pulei por causa da escolha local", e a lista enchia de
       linhas sobre coisa que não ia mudar nada. Pego pela prova de ponta a
       ponta, no passo que confere se a sincronia seguinte fica quieta. */
    const declEm = Date.parse(decl.em || '')
    const localEm = Date.parse(atual.mexidoEm || '')
    const localVence = Number.isFinite(declEm) && Number.isFinite(localEm) && localEm > declEm

    for (const campo of CAMPOS) {
      /* Trava 1: campo ausente não é "desligue". É "não tenho opinião". */
      if (!(campo in regras)) continue
      const querido = regras[campo]
      const temAgora = atual[campo]
      if (campo === 'modulos') {
        for (const [m, v] of Object.entries(querido || {})) {
          if (Boolean(temAgora?.[m]) === Boolean(v)) continue
          saida.push(localVence
            ? { projeto, campo: null, pulou: `módulo ${m} difere, e houve escolha local depois da declaração` }
            : { projeto, campo: 'modulo', modulo: m, de: Boolean(temAgora?.[m]), para: Boolean(v) })
        }
        continue
      }
      if (temAgora === querido) continue
      saida.push(localVence
        ? { projeto, campo: null, pulou: `${campo} difere, e houve escolha local depois da declaração: ela vence até a próxima` }
        : { projeto, campo, de: temAgora ?? null, para: querido })
    }
  }
  return saida
}

/**
 * O registro do que foi aplicado, para ele poder perguntar "por que mudou?".
 *
 * Trava 3. Append puro, com teto: regra que muda sozinha e não deixa rastro é
 * indistinguível de defeito.
 */
export const arquivoDiario = () => path.join(casaClaude(), 'cockpit-regras-aplicadas.jsonl')

export function registrar(mudancas, { de = null, arquivo = arquivoDiario(), teto = 500 } = {}) {
  if (!mudancas?.length) return { gravadas: 0 }
  const linhas = mudancas.map((m) => JSON.stringify({ ...m, de_maquina: de, em: hoje() }))
  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    fs.appendFileSync(arquivo, linhas.join('\n') + '\n', 'utf8')
    /* Teto por reescrita, e só quando passa: ler e reescrever a cada linha
       custaria mais que o registro vale. */
    const todas = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/).filter(Boolean)
    if (todas.length > teto) {
      const tmp = arquivo + '.tmp'
      fs.writeFileSync(tmp, todas.slice(-teto).join('\n') + '\n', 'utf8')
      fs.renameSync(tmp, arquivo)
    }
  } catch { return { gravadas: 0, falhou: true } }
  return { gravadas: linhas.length }
}

/** O que mudou por declaração, para a tela responder "por que isto mudou?". */
export function aplicadas({ arquivo = arquivoDiario(), limite = 50 } = {}) {
  let cru
  try { cru = fs.readFileSync(arquivo, 'utf8') } catch { return [] }
  const saida = []
  for (const l of cru.split(/\r?\n/)) {
    if (!l.trim()) continue
    try { saida.push(JSON.parse(l)) } catch { /* linha torta não derruba o resto */ }
  }
  return saida.slice(-limite).reverse()
}
