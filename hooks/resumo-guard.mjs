#!/usr/bin/env node
/**
 * Resposta longa sem o separador não sai.
 *
 * ## Por que este hook existe, e é o pior tipo de motivo
 *
 * Em 16/08 eu implementei o separador que ele pediu, escrevi a regra no arquivo
 * de estilo, e **na resposta seguinte não usei**. Deixei a verificação só
 * MEDINDO — no mesmo dia em que escrevi, com todas as letras, que instrução
 * escrita não me segura e que medir não é segurar.
 *
 * Palavras dele:
 *
 * > "cade o separador de resumo que a gente combinou? eu to ficando maluco
 * > claude, eu te peço uma coisa, voce ignora e depois fala que foi erro humano
 * > pq eu nao pedi o suficiente"
 *
 * ## A regra
 *
 * Passou de três parágrafos, precisa da linha de separação antes do que ele
 * decide ou confere. Ele LÊ o raciocínio — isto não corta nada, só marca onde
 * uma parte acaba e a outra começa.
 *
 * Resposta curta não precisa: separador em cima de duas linhas é ruído.
 *
 * Falha ABERTA, uma volta só.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(resolve(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('resumo-guard')) sair()

const E = await import(resolve(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const texto = E.ultimaResposta(arquivo)
if (!texto) sair()

/* A mesma medição que a aba de estilo usa — uma conta só, para a tela e o hook
   nunca discordarem sobre a mesma resposta. */
const m = E.medir(texto)
if (!m.semMarcador) sair()

console.error(
  `RESPOSTA DE ${m.paragrafos} PARÁGRAFOS SEM O SEPARADOR.\n\n`
  + 'Antes do que ele decide ou confere, uma linha sozinha:\n\n'
  + '    ---------------------------------- // resumo // ----------------------------------\n\n'
  + 'Acima dela: como você chegou lá, o que mediu, o que descartou.\n'
  + 'Abaixo: o que mudou para ele, e o que ele precisa fazer.\n\n'
  + 'Ele pediu isto em 16/08 e você implementou no mesmo dia — e não usou na\n'
  + 'resposta seguinte. As palavras dele: "eu te peço uma coisa, voce ignora e\n'
  + 'depois fala que foi erro humano pq eu nao pedi o suficiente".\n\n'
  + 'Isto NÃO é para cortar o raciocínio: ele lê o raciocínio, e disse isso na\n'
  + 'mesma mensagem em que pediu o separador. É só marcar onde uma parte acaba.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
