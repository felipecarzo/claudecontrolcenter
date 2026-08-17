#!/usr/bin/env node
/**
 * Ele disse "igual ao que já temos": a entrega mostra os DOIS lado a lado.
 *
 * ## Por que existe (escolha dele em 17/08)
 *
 * Ele pediu a visão de tarefas em tabela, com a referência explícita: *"nós já
 * usamos em diversos projetos"*. Eu fui ver os arquivos, fiz outra coisa, e
 * mandei UM print chamando de planilha. Ele abriu no telefone e viu blocos.
 *
 * > "NEM EU FALANDO EXPLICITAMENTE PRA FAZER IDENTICO AO QUE JA TEMOS VOCE VAI
 * > LA E MUDA!!!"
 *
 * A trava não julga se ficou igual, porque isso eu não sou confiável para
 * julgar: ela exige o PAR. Com o original e o novo lado a lado, quem compara é
 * ele, em dois segundos, sem depender do meu resumo.
 *
 * ## O que conta como par, e por que é verificável
 *
 * Mandar arquivo é chamada de ferramenta: está no transcrito ou não está. Vale
 * como par:
 *
 * - um envio com 2 ou mais arquivos, ou dois envios no mesmo turno;
 * - um envio de arquivo mais o original citado em bloco de código na resposta
 *   (é o caso de referência que é TEXTO, como uma tabela de ROADMAP.md).
 *
 * Não vale: descrever a comparação em prosa. Foi exatamente o que eu fiz.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('referencia-guard')) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const P = await import(resolve(AQUI, '../src/pedido.mjs')).catch(() => null)
const E = await import(resolve(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!P || !E) sair()

const pedido = P.ultimoPedido(arquivo)
if (!pedido) sair()

/* As formas dele de apontar uma referência que já existe. Medidas nas mensagens
   reais: ele diz "igual", "identico", "como já fazemos", "nós já usamos", "do
   jeito que está no", "mesmo formato". */
const REFERENCIA = /\b(igual ao|igual a|igual\b|id[êe]ntico|mesmo formato|mesmo estilo|mesma cara|como (?:j[áa] |a gente |n[óo]s )?(?:temos|fazemos|usamos|est[áa]|era)|(?:n[óo]s|a gente|j[áa]) (?:j[áa] )?usa(?:mos|va)|do jeito que (?:est[áa]|era|t[áa])|que j[áa] (?:temos|existe|usamos))\b/i
if (!REFERENCIA.test(pedido)) sair()

/* Só cobra quando houve TRABALHO no turno: conversa sobre a referência, sem
   editar nada, não precisa de par de imagens. */
const usos = P.ferramentasDoTurno(arquivo)
const mexeu = usos.some((u) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(u.nome))
if (!mexeu) sair()

const enviados = usos
  .filter((u) => u.nome === 'SendUserFile')
  .reduce((n, u) => n + (Array.isArray(u.entrada?.files) ? u.entrada.files.length : 0), 0)

const resposta = E.respostaDoTurno(arquivo) || E.ultimaResposta(arquivo) || ''
const temBloco = /```/.test(resposta)

if (enviados >= 2 || (enviados >= 1 && temBloco)) sair()

console.error(
  'ELE PEDIU IGUAL A ALGO QUE JÁ EXISTE, E A ENTREGA NÃO MOSTRA O PAR.\n\n'
  + `O que ele escreveu: "${pedido.replace(/\s+/g, ' ').slice(0, 160)}"\n\n`
  + `Arquivos mostrados neste turno: ${enviados}. Precisa de dois:\n`
  + '  · o ORIGINAL que ele citou (print, ou o trecho em bloco de código)\n'
  + '  · o NOVO, na largura em que ele usa (390px, o telefone dele)\n\n'
  + 'A trava não julga se ficou igual, e é de propósito: quem compara é ele, em\n'
  + 'dois segundos. Descrever a comparação em prosa não conta, porque foi\n'
  + 'exatamente o que eu fiz em 17/08 quando a tabela virou blocos.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
