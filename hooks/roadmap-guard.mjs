#!/usr/bin/env node
/**
 * F10: o gate de documentação.
 *
 * Roda no `Stop` e avisa quando há item concluído parado no ROADMAP. A regra
 * existe escrita há semanas, na linha 3 do próprio arquivo ("Só o que está
 * aberto. Concluído sai daqui e vira linha no diário"), e não foi seguida por
 * ninguém, inclusive por mim, dez vezes em 14/08, quando cada CC fechado virou
 * três parágrafos de "medido em 14/08..." dentro do arquivo. O ROADMAP chegou a
 * 993 linhas com quase metade descrevendo passado.
 *
 * É o segundo caso de teste do princípio do framework, e o mais barato: a
 * instrução era clara, recente e escrita no lugar certo, e não segurou nada.
 *
 * ## Por que avisa em vez de bloquear
 *
 * `Stop` com exit 2 devolve o texto pro modelo e o faz continuar trabalhando.
 * Num gate de documentação isso é ruim: o fim da sessão é justamente quando se
 * escreve o diário, e travar ali criaria laço (para arrumar o ROADMAP eu
 * preciso terminar o turno). Então este hook informa, e quem decide é quem lê.
 *
 * O `todo-guard` já usa esse mesmo tom no mesmo evento, pelo mesmo motivo.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const liberar = () => process.exit(0)

let entrada = ''
try { entrada = readFileSync(0, 'utf8') } catch { liberar() }

let dados = null
try { dados = JSON.parse(entrada) } catch { liberar() }

/** Sobe a árvore procurando o ROADMAP. Projeto sem ele passa direto. */
function acharRoadmap(dir) {
  let atual = resolve(dir || process.cwd())
  for (let i = 0; i < 40; i++) {
    const alvo = join(atual, 'docs', 'ROADMAP.md')
    if (existsSync(alvo)) return alvo
    const pai = dirname(atual)
    if (pai === atual) return null
    atual = pai
  }
  return null
}

const arquivo = acharRoadmap(dados?.cwd)
if (!arquivo) liberar()

let texto = ''
try { texto = readFileSync(arquivo, 'utf8') } catch { liberar() }

// Só as seções `###`, que é o que o `roadmap.mjs` também considera frente. E
// `\r?\n` porque os arquivos são CRLF: `.` não casa `\r`, e um regex ingênuo
// aqui devolveria zero em metade dos projetos (armadilha já paga neste repo).
const feitas = texto.split(/\r?\n/)
  .filter((l) => /^###\s/.test(l) && /✅/.test(l))
  /* Tira o selo e a data, e MANTÉM o título. A versão anterior cortava tudo a
     partir do ✅, e como ele escreve `### CC-95 ✅ 16/08, o agente reporta o
     trabalho`, o aviso saía como uma lista de códigos secos: "CC-01, CC-03".
     É a queixa dele sobre cartão sem contexto, do lado de dentro da trava:
     "os cards nunca fazem sentido (…) não tem o contexto de que é na verdade".
     Achado em 18/08, ao escrever o primeiro teste desta trava. */
  .map((l) => l
    .replace(/^###\s+/, '')
    .replace(/✅\s*(\d{1,2}\/\d{1,2}(\/\d{2,4})?)?\s*(—|-|:)?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim())

if (!feitas.length) liberar()

const lista = feitas.slice(0, 6).map((t) => `  - ${t}`).join('\n')
const resto = feitas.length > 6 ? `\n  … e mais ${feitas.length - 6}` : ''

process.stderr.write(`ROADMAP com ${feitas.length} ite${feitas.length === 1 ? 'm' : 'ns'} concluído${
  feitas.length === 1 ? '' : 's'} parado${feitas.length === 1 ? '' : 's'} lá dentro:

${lista}${resto}

A regra do projeto está na linha 3 do próprio arquivo: "Só o que está aberto.
Concluído sai daqui e vira linha no diário." Em 14/08 esse acúmulo levou o
ROADMAP a 993 linhas, com quase metade descrevendo passado.

Mover para \`docs/diario/<data>.md\` antes de encerrar mantém o mapa legível.
`)
process.exit(0)
