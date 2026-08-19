#!/usr/bin/env node
/**
 * Ele descreveu um sintoma. Voce mediu, ou adivinhou?
 *
 * ## O metodo, formulado por ele em 16/08
 *
 * > "através de linguagem natural usando a minha criatividade pra demonstrar o
 * > que estou vendo você conseguiria achar isso no codigo e juntos
 * > construiriamos a ferramenta dessa forma, metodologicamente?"
 *
 * Sim, e funcionou o dia inteiro. Mas em tres tempos, nao dois: ele descreve, eu
 * **meço**, ele confirma. O do meio e o que separa achar a causa de chutar.
 *
 * Quatro casos daquele dia, e em todos a medicao achou coisa diferente do que a
 * metafora sugeria na superficie:
 *
 * - "os nomes dançam"  ->  a mesma regra de estilo escrita duas vezes
 * - "linhas mais gordinhas"  ->  sombra e superficie, nao espessura de borda
 * - "parece site feio feito por IA"  ->  cartoes esticados por 1860px
 *
 * Se eu tivesse agido na metafora, teria mexido em alinhamento, em espessura de
 * linha e em quantidade de texto. Nenhum dos tres era a causa.
 *
 * **As duas telas que ele rejeitou naquele dia foram as duas em que pulei a
 * medicao.** E ja estava registrado no projeto, de semanas antes, que agir na
 * hipotese dele sem medir piorou o produto duas vezes no mesmo dia.
 *
 * ## O que conta como medir
 *
 * Qualquer coisa que produza um NUMERO ou uma leitura do estado real antes da
 * mudanca: contar ocorrencias, ler o arquivo, rodar uma consulta, tirar print e
 * olhar. Nao conta abrir o arquivo para editar.
 *
 * Falha ABERTA, uma volta so.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança ERR_UNSUPPORTED_ESM_URL_SCHEME, e como quase toda chamada aqui
   está dentro de um `.catch`, o módulo some sem erro visível: foi assim que
   o interruptor de módulos deixou de valer em 31 hooks, sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('medir-guard')) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let cauda = ''
try { cauda = readFileSync(arquivo, 'utf8').slice(-300_000) } catch { sair() }

function ultimoPedido(texto) {
  const linhas = texto.split('\n')
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    let l = null
    try { l = JSON.parse(linhas[i]) } catch { continue }
    if (l?.type !== 'user' || l?.isMeta || l?.toolUseResult) continue
    const c = l?.message?.content
    const t = typeof c === 'string'
      ? c
      : Array.isArray(c) ? c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n') : ''
    if (t && !t.startsWith('<')) return t
  }
  return null
}

const pedido = ultimoPedido(cauda)
if (!pedido) sair()

/**
 * Ele esta descrevendo um SINTOMA, nao mandando fazer uma coisa.
 *
 * A diferenca importa: "faz uma aba nova" e ordem, e nao pede medicao. "ta
 * estranho", "nao ta funcionando", "ficou apertado" e sintoma, e medir e o
 * unico jeito de nao chutar a causa.
 *
 * A lista e curta de proposito. Cada padrao a mais e uma chance de cobrar
 * medicao de conversa comum, e hook chato vira hook desligado.
 */
const SINTOMA = [
  /\b(t[áa]|est[áa]|ficou|parece)\s+(estranho|esquisito|apertado|confuso|torto|feio|ruim|pequeno|grande demais)\b/i,
  /\bn[ãa]o\s+(t[áa]|est[áa])\s+(funcionando|bom|legal|dando certo)\b/i,
  /* As formas do verbo, não só o infinitivo. O teste pegou "o menu fica
     sumindo" passando batido porque a lista tinha "some" e "sumiu" e não o
     gerúndio, que é justamente como se descreve algo que acontece toda hora. */
  /\b(some|sumiu|sumindo|desaparec\w*|pisca\w*|trava\w*|demora\w*|corta\w*|vaza\w*|quebra\w*)\b/i,
  /\bn[ãa]o\s+(consigo|d[áa] pra)\s+(ver|ler|clicar|achar|entender)\b/i,
  /\b(dif[íi]cil de|ruim de)\s+(ler|ver|usar|achar)\b/i,
]
if (!SINTOMA.some((re) => re.test(pedido))) sair()

/* Ele descreveu um sintoma. Eu medi antes de mexer, ou fui direto? */
const corte = cauda.lastIndexOf('"type":"user"')
const turno = corte >= 0 ? cauda.slice(corte) : cauda

let mexeu = false
let mediu = false

for (const linha of turno.split('\n')) {
  if (!linha.includes('"tool_use"')) continue
  let ev = null
  try { ev = JSON.parse(linha) } catch { continue }
  for (const b of ev?.message?.content || []) {
    if (b?.type !== 'tool_use') continue

    if (['Edit', 'Write', 'NotebookEdit'].includes(b.name)) mexeu = true

    // ler o codigo para entender e medir; Grep e Read contam
    if (b.name === 'Grep' || b.name === 'Glob') mediu = true
    if (b.name === 'Read' && !/\.(png|jpe?g|webp)$/i.test(String(b.input?.file_path || ''))) mediu = true
    // print olhado tambem e medicao: e ver o estado real
    if (b.name === 'Read' && /\.(png|jpe?g|webp)$/i.test(String(b.input?.file_path || ''))) mediu = true
    if (b.name === 'Bash') {
      const c = String(b.input?.command || '')
      // contar, procurar, consultar, capturar: tudo que produz leitura do real
      /* `medir`/`prova` no nome do script entraram em 18/08, ao escrever o
         primeiro teste desta trava: rodar `node medir-largura.mjs 390` é
         medição óbvia e não era reconhecida, porque a lista só previa `node -e`.
         Script de medição com nome próprio é o caso NORMAL quando a conta é
         maior que uma linha. */
      if (/\b(grep|wc|curl|node -e|find|git log|git diff|screenshot|evaluate|test|medi\w*|prova\w*)\b/.test(c)) mediu = true
    }
  }
}

if (!mexeu || mediu) sair()

console.error(
  'ELE DESCREVEU UM SINTOMA E VOCÊ MEXEU SEM MEDIR.\n\n'
  + `O que ele disse:\n  "${pedido.replace(/\s+/g, ' ').trim().slice(0, 150)}"\n\n'`
  + 'Método dele, 16/08: são TRÊS tempos, e o do meio é o que não pode faltar.\n'
  + '  1. ele descreve o que vê, do jeito dele\n'
  + '  2. VOCÊ MEDE no código e mostra o número\n'
  + '  3. ele confirma que era isso, ou corrige o rumo\n\n'
  + 'A metáfora dele aponta o rumo, não a causa. Naquele dia:\n'
  + '  "os nomes dançam"            -> a mesma regra de estilo escrita 2x\n'
  + '  "linhas mais gordinhas"      -> sombra e superfície, não espessura\n'
  + '  "parece site feito por IA"   -> cartões esticados por 1860px\n\n'
  + 'Agir na metáfora teria mexido em alinhamento, espessura e texto. Nenhum dos\n'
  + 'três era a causa. E as duas telas que ele rejeitou foram as duas em que a\n'
  + 'medição foi pulada.\n\n'
  + 'Meça primeiro: conte, leia o arquivo, rode a consulta, tire o print e olhe.\n'
  + 'Depois mostre o número a ele. Esta é a única volta: a próxima passa.',
)
process.exit(2)
