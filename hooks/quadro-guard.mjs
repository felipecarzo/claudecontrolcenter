#!/usr/bin/env node
/**
 * O guarda que confere, na SUA máquina e agora, se algum projeto sumiu do
 * quadro.
 *
 * ## Por que ele existe, nas palavras dele
 *
 * Depois de o carzo voltar ao quadro, ele perguntou: *"como a gente está
 * garantindo que vai ler esses projetos?"*. Eu respondi que havia uma conta e
 * um teste. Ele cortou, com razão:
 *
 * > *"vamos ser mais explícitos. como assim uma conta? isso é garantia do quê?
 * > sabemos que a única coisa que garante é Hook"*
 *
 * Ele está certo, e o limite é real. O teste do gate prova que a FUNÇÃO soma
 * certo, com dados inventados por mim, e só roda quando alguém roda o gate. Um
 * projeto novo que chegue amanhã, com um formato que ninguém previu, some
 * igual, e o teste continua verde. Teste é garantia de desenvolvimento; hook é
 * garantia de operação.
 *
 * ## A conta
 *
 * Todo projeto que existe no disco tem que cair em UM de três lugares:
 *
 *   1. no quadro, se rendeu tarefa;
 *   2. na faixa "li e não consegui mostrar", com o motivo;
 *   3. na linha dos que não têm roadmap nenhum.
 *
 * Se a soma dos três não bate com o total, alguém está sendo descartado em
 * silêncio. Foi exatamente assim que 11 projetos saíam por um `.filter()` no
 * meio do caminho, e o carzo passou dias invisível.
 *
 * ## Três reações, e não uma
 *
 * Escolha dele: *"acho que os 3 em perspectivas diferentes"*. A gradação é por
 * gravidade, e cada nível ganha a insistência que merece:
 *
 * - **a conta não fecha** é defeito de código, e barra sempre. Ninguém deveria
 *   conseguir acrescentar um filtro novo e seguir a vida;
 * - **um projeto SAIU do quadro** é regressão, e cobra em toda resposta até
 *   ser resolvido. Ontem aparecia, hoje não: alguma coisa quebrou;
 * - **um projeto novo nasceu fora do quadro** é informação, e fala UMA vez.
 *   Se ele decidir conviver, o guarda cala. Alarme que repete o que já foi
 *   decidido vira paisagem, e paisagem não protege nada.
 *
 * ## Custo, medido
 *
 * 62ms: 8ms para achar os projetos e 54ms para ler os roadmaps. A conta NÃO
 * chama `ordenar()`, que roda git e custa 840ms sozinho, e não precisa dele:
 * a pergunta aqui é quem entrou, não em que ordem.
 *
 * ## As regras da casa, aplicadas
 *
 * - **FALHA ABERTA.** Erro deste hook nunca pode travar trabalho. Um guarda
 *   que quebra por defeito próprio é desligado no mesmo dia, e com razão.
 * - **Nada de escrever em `~/.claude`**, que é somente leitura dentro do
 *   sandbox. A foto anterior mora no abrigo, e o `CC_HOME` é respeitado.
 * - **`stop_hook_active`** corta o laço: um empurrão por turno, nunca dois.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const sair = () => process.exit(0)

/* `pathToFileURL`, nunca `file://` mais o caminho cru: no Windows um caminho
   com letra de unidade lança `ERR_UNSUPPORTED_ESM_URL_SCHEME`, e como a
   chamada está dentro de um `catch`, o hook sumiria calado justamente na
   máquina dele. É o sexto ponto do guia de PC e VPS. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { /* sem stdin: segue */ }
if (dados?.stop_hook_active) sair()

const RAIZ = resolve(AQUI, '..')

let T = null
let I = null
let P = null
try {
  T = await import(urlDeModulo(RAIZ, 'src', 'trabalho.mjs'))
  I = await import(urlDeModulo(RAIZ, 'src', 'install.mjs'))
  P = await import(urlDeModulo(RAIZ, 'src', 'metaSessao.mjs'))
} catch { sair() }

/* A foto anterior. No abrigo, e não em `~/.claude`: lá dentro do sandbox a
   escrita falha com `EROFS` quatro vezes seguidas, e um guarda que não
   consegue lembrar do que já avisou repete tudo para sempre. */
const ARQUIVO_FOTO = (() => {
  try { return join(dirname(P.DIR_SESSOES_ABRIGO()), 'quadro-foto.json') } catch { return null }
})()

const lerFoto = () => {
  try { return JSON.parse(readFileSync(ARQUIVO_FOTO, 'utf8')) } catch { return null }
}
const gravarFoto = (foto) => {
  if (!ARQUIVO_FOTO) return
  try {
    mkdirSync(dirname(ARQUIVO_FOTO), { recursive: true })
    const tmp = `${ARQUIVO_FOTO}.tmp`
    writeFileSync(tmp, JSON.stringify(foto, null, 1))
    renameSync(tmp, ARQUIVO_FOTO)
  } catch { /* sem lugar para gravar: o guarda avisa de novo, e é o certo */ }
}

let conta = null
let listaCrua = []
try {
  listaCrua = T.projetosDe([], I.findProjects)
  const q = T.montar({ projetos: T.carregar(listaCrua), jobs: [], pendencias: [] })
  conta = {
    total: listaCrua.length,
    noQuadro: q.grupos.map((g) => g.projeto).sort(),
    avisados: q.naoRenderam.map((x) => ({ projeto: x.projeto, motivo: x.motivo })),
    semRoadmap: (q.semRoadmap || []).map((x) => x.projeto).sort(),
  }
} catch { sair() }

const somados = conta.noQuadro.length + conta.avisados.length + conta.semRoadmap.length

/* Sem projeto nenhum não há o que conferir, e insistir aqui seria cobrar de
   quem trabalha numa máquina que ainda não tem projeto algum. */
if (!conta.total) sair()

const foto = lerFoto()
const antesNoQuadro = new Set(foto?.noQuadro || [])
const jaAvisados = new Set(foto?.jaAvisados || [])

/* ── nível 1: a conta não fecha. Defeito de código, barra sempre ─────────── */
if (somados !== conta.total) {
  const conhecidos = new Set([...conta.noQuadro, ...conta.semRoadmap, ...conta.avisados.map((a) => a.projeto)])
  const sumidos = listaCrua.map((p) => p.projeto).filter((n) => !conhecidos.has(n))
  console.error(
    `A CONTA DOS PROJETOS NÃO FECHA: ${somados} de ${conta.total}.\n\n`
    + 'Todo projeto do disco tem que cair em um de três lugares: no quadro, na\n'
    + 'faixa de aviso, ou na linha dos sem roadmap. Se a soma não bate, alguma\n'
    + 'coisa no caminho está descartando projeto em silêncio.\n\n'
    + (sumidos.length ? `Sumiram sem serem contados:\n${sumidos.map((s) => `    · ${s}`).join('\n')}\n\n` : '')
    + 'Foi assim que 11 projetos saíam por um `.filter()` no fim de `carregar()`,\n'
    + 'e o carzo passou dias invisível sem ninguém conseguir dizer por quê.\n\n'
    + 'Procure filtro novo em `carregar()` ou em `montar()`, em src/trabalho.mjs.\n\n'
    + 'Esta é a única volta: a próxima passa.',
  )
  process.exit(2)
}

/* ── nível 2: um projeto SAIU do quadro. Regressão, cobra toda vez ───────── */
const agoraNoQuadro = new Set(conta.noQuadro)
const sairam = [...antesNoQuadro].filter((p) => !agoraNoQuadro.has(p))
if (sairam.length) {
  /* A foto NÃO é atualizada aqui, de propósito: enquanto o projeto não voltar,
     o guarda cobra de novo na resposta seguinte. É a diferença entre este
     nível e o de baixo. */
  const porque = new Map(conta.avisados.map((a) => [a.projeto, a.motivo]))
  console.error(
    `${sairam.length} PROJETO(S) SAÍRAM DO QUADRO DESDE A ÚLTIMA VOLTA.\n\n`
    + sairam.map((p) => `    · ${p}${porque.has(p) ? `: ${porque.get(p)}` : ''}`).join('\n')
    + '\n\nAntes apareciam, agora não. Isso é regressão, não novidade: ou o\n'
    + 'roadmap mudou de formato, ou o código que o lê parou de entender.\n\n'
    + 'Este aviso volta em toda resposta até o projeto voltar ao quadro, ou até\n'
    + 'você decidir que ele não deve mais estar lá.\n\n'
    + 'Esta é a única volta: a próxima passa.',
  )
  process.exit(2)
}

/* ── nível 3: projeto novo fora do quadro. Informação, fala uma vez ──────── */
const forasNovos = conta.avisados.filter((a) => !jaAvisados.has(a.projeto))
gravarFoto({
  noQuadro: conta.noQuadro,
  jaAvisados: [...new Set([...jaAvisados, ...conta.avisados.map((a) => a.projeto)])],
  em: new Date().toISOString(),
})

if (!forasNovos.length) sair()

console.error(
  `${forasNovos.length} PROJETO(S) LIDO(S) E FORA DO QUADRO, PELA PRIMEIRA VEZ.\n\n`
  + forasNovos.map((a) => `    · ${a.projeto}: ${a.motivo}`).join('\n')
  + '\n\nO painel achou a pasta e leu o roadmap. O que ele não conseguiu foi\n'
  + 'tirar tarefa de lá. Isso costuma ser formato: o quadro entende cabeçalho,\n'
  + 'lista com caixa de marcar, e tabela com coluna de tarefa e de status.\n\n'
  + 'Aviso ÚNICO: se você decidir conviver com isso, ele não volta a falar.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
