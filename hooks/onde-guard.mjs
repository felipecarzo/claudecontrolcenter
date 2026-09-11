#!/usr/bin/env node
/**
 * Mudou o comportamento? Diga ONDE ficou e PARA QUEM vale.
 *
 * ## O pedido, em 11/09
 *
 * > "essa alteração que você fez ficou salvo em todas as minhas sessões? isso é
 * > outro problema que precisamos verificar na comunicação, eu rodo 6, 7, 8
 * > sessões de claude, quando te mostro um problema você tem que deixar claro
 * > onde isso ficou salvo, se é um hook no cockpit, uma trava simples, só um
 * > prompt"
 *
 * ## Por que isto existe, e não é preciosismo
 *
 * Ele aponta um defeito numa sessão. O conserto vai para um lugar: um gancho
 * global, o arquivo de instruções, a memória de UM projeto, o código de UM
 * repositório, ou só a conversa. Cada um desses tem alcance diferente, e a
 * diferença decide se o problema volta amanhã no projeto ao lado.
 *
 * Medido no dia em que ele perguntou: a trava nova estava no `settings.json`
 * global (valia nos 7 projetos) e a decisão de comportamento estava só na
 * memória do cockpit (valia em um). Eu tinha entregado as duas na mesma frase,
 * como se tivessem o mesmo alcance.
 *
 * ## O que dispara
 *
 * Resposta que ANUNCIA mudança de comportamento ("agora eu...", "passa a...",
 * "a partir de agora...", "salvei", "registrei") e não diz onde nem para quem.
 * Dizer o LUGAR já basta: o alcance sai dele, e a tabela está no arquivo de
 * instruções global.
 *
 * Não dispara em resposta que só faz ou só mede: mexer em código de um arquivo
 * que ele acabou de pedir não é mudança de comportamento a declarar.
 *
 * Falha ABERTA, uma volta só.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('onde-guard')) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const texto = E.respostaDoTurno(arquivo) || E.ultimaResposta(arquivo)
if (!texto) sair()

const prosa = texto.replace(/```[\s\S]*?```/g, ' ')

/** Anúncio de comportamento novo: o que vale daqui para a frente. */
const ANUNCIA = [
  /\b(a partir de agora|daqui (pra|para) (a )?frente|de agora em diante|passa a (valer|ser|barrar|cobrar|exigir))\b/i,
  /\b(agora eu (n[ãa]o )?(vou|fa[çc]o|corrijo|sigo|digo|escrevo|paro))\b/i,
  /\b(salvei|registrei|guardei|anotei|gravei) (na|no|isso|essa|esse|tudo)\b/i,
  /\b(combinado e salvo|fica valendo|virou regra|vira regra)\b/i,
]

/** O LUGAR onde a coisa ficou. Dito isso, o alcance se deduz. */
const DIZ_ONDE = [
  /\b(settings\.json|arquivo de ganchos|ganchos? global)/i,
  /\b(CLAUDE\.md|arquivo (de instru[çc][õo]es|global))/i,
  /\bmem[óo]ria (do projeto|deste projeto|global)/i,
  /\b(no reposit[óo]rio|no c[óo]digo d[eo]|commit|commitado)/i,
  /\b(s[óo] (nesta|nessa) conversa|s[óo] aqui, e some)/i,
  /\bvale (em|para|pra) (todas|todos|as sess[õo]es|os projetos|este projeto|esta pasta)/i,
  /\b(todas as sess[õo]es|todos os projetos|s[óo] (as sess[õo]es|neste projeto|nesta pasta))/i,
]

const anuncia = ANUNCIA.some((re) => re.test(prosa))
if (!anuncia) sair()
if (DIZ_ONDE.some((re) => re.test(prosa))) sair()

console.error(
  'MUDANÇA ANUNCIADA SEM DIZER ONDE FICOU.\n\n'
  + 'Ele roda 6 a 8 sessões ao mesmo tempo, em projetos diferentes. Sem o\n'
  + 'lugar, ele não tem como saber se isto vale nas outras, e descobre dias\n'
  + 'depois que não valia.\n\n'
  + 'Acrescente o lugar, em uma linha:\n\n'
  + '  arquivo de ganchos (settings.json)   toda sessão desta máquina\n'
  + '  arquivo de instruções global         toda sessão desta máquina\n'
  + '  CLAUDE.md do projeto                 só as sessões deste projeto\n'
  + '  memória do projeto                   só as sessões deste projeto\n'
  + '  código do repositório                só quem puxar o repositório\n'
  + '  só esta conversa                     nada: some ao fechar\n\n'
  + 'Ele em 11/09: "quando te mostro um problema você tem que deixar claro\n'
  + 'onde isso ficou salvo, se é um hook no cockpit, uma trava simples, só um\n'
  + 'prompt".\n\n'
  + 'E se vale só num lugar e devia valer em todos, diga isso agora.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
