#!/usr/bin/env node
/**
 * Reprovou? Desce um degrau de abstracao antes de tentar de novo.
 *
 * ## A regra dele, em 16/08
 *
 * > "se nós quebrarmos a tarefa em microtarefas cada vez que a tarefa não for
 * > executada com sucesso (...) por exemplo se a tarefa era fazer uma landing
 * > page, e eu reprovar, a lógica seguinte é a gente quebrar essa landing page
 * > em seções. E tudo bem se não quebrar em seções, quebrar em botões, não tem
 * > problema exagerar na busca dessa abstração. O grande problema é a gente
 * > simplesmente não descer nenhum nível."
 *
 * ## Por que ela e certa, medido no mesmo dia
 *
 * Ele reprovou o design duas vezes, e nas duas eu refiz **no mesmo nivel**:
 * tela inteira, tela inteira de novo. A terceira acertou por insistencia, nao
 * por metodo. Se na primeira negativa eu tivesse descido para "as cores", "o
 * espacamento", "o tamanho do cartao", cada pedaco teria sido aprovado ou
 * reprovado sozinho, e eu saberia qual era o problema.
 *
 * **Negativa nao significa tentar melhor. Significa tentar menor.**
 *
 * ## O outro lado do mesmo eixo
 *
 * Ele reparou que o modo sugestivo do framework e esta regra ao contrario:
 * quando nao ha o que fazer, ele SOBE um degrau e propoe coisas acima. Descer
 * quando erra, subir quando falta. Eu so tinha construido metade.
 *
 * ## Como o hook sabe que ele reprovou
 *
 * Pelo texto, sem exigir palavra combinada: ele ofereceu escrever "negado" e eu
 * preferi nao fazer ele decorar nada. Medido nas 154 mensagens dele deste dia,
 * a lista de sinais pega 14 e nenhuma delas era aprovacao.
 *
 * Se errar, ele corrige, e ai sim vale combinar a palavra.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('descida-guard')) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let cauda = ''
try { cauda = readFileSync(arquivo, 'utf8').slice(-300_000) } catch { sair() }

/** A ultima coisa que uma pessoa escreveu. */
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
 * Como ele reprova, tirado das mensagens reais deste dia.
 *
 * A lista e de PALAVRA DELE, nao de sentimento genérico: "ruim",
 * "horripilante", "refaz". Ampliar para qualquer coisa negativa pegaria
 * conversa comum e o hook viraria ruido.
 */
const REPROVOU = [
  /\b(horripilante|horr[íi]vel|p[ée]ssim[oa]|feio)\b/i,
  /\b(muito|ta|t[áa]|est[áa])\s+ruim\b/i,
  /\bn[ãa]o\s+(gostei|era isso|[ée] isso|ficou bom|t[áa] bom|funciona|entendi)\b/i,
  /\brefa[zç]\w*\b/i,
  /\b(negado|reprovad[oa])\b/i,
  /\bficou\s+(ruim|feio|estranho|confuso)\b/i,
  /\bt[áa]\s+(dif[íi]cil de|confuso|bagun[çc]ado)\b/i,
]
if (!REPROVOU.some((re) => re.test(pedido))) sair()

/* Ele reprovou. Eu desci um degrau, ou refiz no mesmo nivel?
   O sinal e mecanico: registrei tarefas novas neste turno? */
const corte = cauda.lastIndexOf('"type":"user"')
const turno = corte >= 0 ? cauda.slice(corte) : cauda
/* Duas buscas soltas, e não uma sozinha atravessando os dois termos: no
   transcrito o comando vem com as aspas escapadas (`{\"todos\":...}`), então
   qualquer `[^"]*` entre `set` e `todos` para na primeira barra invertida. O
   teste pegou isso, e é o tipo de erro que passaria despercebido em produção
   porque o hook simplesmente cobraria demais. */
const registrou = (/cc\.mjs\s+set\b/.test(turno) && /todos/.test(turno))
  || /"todos"\s*:/.test(turno)
if (registrou) sair()

/* Nem toda reprovacao pede trabalho novo: as vezes ele so esta explicando algo
   e a resposta certa e conversar. Se eu nao mexi em NADA, nao ha o que quebrar. */
const mexeu = /"name"\s*:\s*"(Edit|Write|NotebookEdit)"/.test(turno)
if (!mexeu) sair()

console.error(
  'ELE REPROVOU E VOCÊ REFEZ NO MESMO NÍVEL.\n\n'
  + `O que ele disse:\n  "${pedido.replace(/\s+/g, ' ').trim().slice(0, 150)}"\n\n`
  + 'Regra dele, 16/08: **negativa não significa tentar melhor, significa tentar\n'
  + 'menor.** Se a tarefa era a landing page e ele reprovou, a seguinte é quebrar\n'
  + 'em seções. Se reprovar de novo, em botões. Exagerar não é problema; não\n'
  + 'descer nenhum degrau é.\n\n'
  + 'No mesmo dia isto aconteceu duas vezes: ele reprovou o design e eu refiz a\n'
  + 'tela inteira nas duas. A terceira acertou por insistência, não por método.\n\n'
  + 'Antes de tentar de novo, quebre em partes menores e registre:\n\n'
  + '    node cc.mjs set \'{"todos":[{"text":"...","done":false,"pronto":"..."}]}\'\n\n'
  + '  · cada parte precisa poder ser aprovada ou reprovada SOZINHA por ele\n'
  + '  · três ou mais, senão não houve descida de verdade\n\n'
  + 'Assim, quando ele reprovar de novo, você saberá qual pedaço estava errado.\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
