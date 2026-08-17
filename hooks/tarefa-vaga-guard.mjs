#!/usr/bin/env node
/**
 * Tarefa escrita em telegrama não sai do turno.
 *
 * ## O pedido, e o exemplo dele (17/08)
 *
 * > "os cards nunca fazem sentido. o texto é algo vago como 'profissão escolhe
 * > quem entra', não tem o contexto de que é na verdade, tipo 'a profissão do
 * > agente define se ele entra na tarefa', entende?"
 *
 * ## O discriminador saiu de medição, não de opinião
 *
 * A primeira hipótese era tamanho, e ela é FALSA: nas 29 tarefas reais desta
 * máquina a mediana é de 9 palavras, e só uma tem menos de cinco. "cada entrega
 * diz se precisa do seu olho" tem oito palavras e é clara; "profissão escolhe
 * quem entra" tem quatro e é vaga. Contar palavras não separa as duas.
 *
 * O que separa é a ausência de **palavras de ligação** (artigo, preposição,
 * possessivo). É o que faz um texto virar título de commit: "profissão escolhe
 * quem entra" tem ZERO, e a versão que ele quer, "a profissão do agente define
 * se ele entra na tarefa", tem quatro. Medido nas 29: exatamente uma tarefa com
 * zero, e é a que ele citou.
 *
 * Por isso o limite é 2, e não "escreva melhor": sem artigo nem preposição, o
 * sujeito e o objeto desaparecem, e a linha só é legível para quem a escreveu.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('tarefa-vaga-guard')) sair()

const id = process.env.CLAUDE_CODE_SESSION_ID || dados?.session_id
if (!id) sair()
const M = await import(resolve(AQUI, '../src/metaSessao.mjs')).catch(() => null)
if (!M) sair()

let meta = null
try { meta = JSON.parse(readFileSync(resolve(M.DIR_SESSOES(), `${id}.json`), 'utf8')) } catch { sair() }
const tarefas = (meta?.todos || []).map((t) => (typeof t === 'string' ? t : t?.text ?? t?.t)).filter(Boolean)
if (!tarefas.length) sair()

/* A lista é de palavras funcionais do português, as que carregam sujeito e
   lugar. `neste/nesta/nele` entraram depois de medir: sem elas, "modo contínuo
   criado e ligado neste projeto" era acusada, e ela é clara. Um falso positivo
   em 29 já era demais. */
const LIGACAO = new Set(('a o as os um uma uns umas de do da dos das no na nos nas em num numa '
  + 'para pra por pelo pela com que se seu sua seus suas meu minha nosso nossa cada ao aos à às '
  + 'e ou sem sobre entre até desde neste nesta nesses nessas nele nela deste desta disso quando '
  + 'onde qual quais').split(' '))

const limpa = (p) => p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
const ligacoes = (texto) => texto.split(/\s+/).filter((p) => LIGACAO.has(limpa(p))).length

/* O código no começo (`ESC-132`) não conta como palavra: ele é identificador, e
   deixá-lo dentro da conta premiava justamente quem escreve em telegrama. */
const semCodigo = (t) => t.replace(/^\s*[A-Z]{2,5}-\d+\b[:.\-\s]*/, '')

const vagas = tarefas.filter((t) => ligacoes(semCodigo(t)) < 2)
if (!vagas.length) sair()

console.error(
  `${vagas.length} TAREFA(S) ESCRITA(S) EM TELEGRAMA.\n\n`
  + vagas.map((t) => `    "${t}"`).join('\n')
  + '\n\nSem artigo nem preposição o sujeito e o objeto desaparecem, e a linha só\n'
  + 'é legível para quem escreveu. Ele leu uma dessas e disse:\n\n'
  + '    "os cards nunca fazem sentido. o texto é algo vago como \'profissão\n'
  + '     escolhe quem entra\', não tem o contexto de que é na verdade, tipo\n'
  + '     \'a profissão do agente define se ele entra na tarefa\'"\n\n'
  + 'Reescreva cada uma como frase inteira: quem faz, o que muda, e onde.\n'
  + 'Depois grave de novo com `cc set`, mandando a lista toda.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
