#!/usr/bin/env node
/**
 * A regra zero: não citar o nome da peça, e sim o que ela faz com ele.
 *
 * ## O pedido, em 16/08, e por que é urgente
 *
 * > "eu não lembro o que que é reporte guard. Você tem que entender que você lê
 * > um código e consegue referenciar o que ele é em segundos (…) o meu cérebro
 * > não consegue absorver tudo o que você queria"
 *
 * E o risco, que é o que faz este hook nascer antes de qualquer outra coisa:
 *
 * > "eu acabo virando uma pessoa dependente (…) quando dá um problema eu nem
 * > sei qual o problema que está dando, e isso vai me quebrar"
 *
 * **O problema não é o tamanho da resposta, é a memória exigida.** `reporte-guard`,
 * `frente`, `meta.json`, `CC-98` são nomes que eu resolvo no código em dois
 * segundos. Ele não tem por que carregar nenhum deles.
 *
 * ## O que este hook conta
 *
 * Nomes internos do projeto na PROSA — fora de bloco de código, fora de comando
 * que ele vai rodar, fora de caminho de arquivo que ele vai abrir. Passando do
 * limite, devolve com a lista do que apareceu.
 *
 * ## Por que um limite e não zero
 *
 * Zero seria impossível de cumprir e viraria hook desligado na primeira hora.
 * Dois nomes numa resposta é o custo de dizer onde uma coisa mora quando ele
 * pergunta; oito é índice de código disfarçado de resumo.
 *
 * Falha ABERTA, uma volta só.
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
if (cfg?.hookEnabled && !cfg.hookEnabled('jargao-guard')) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

// mesma razão do guarda do separador: a resposta é escrita em blocos
const texto = E.respostaDoTurno(arquivo) || E.ultimaResposta(arquivo)
if (!texto) sair()

/* Sai da conta:
   - bloco de código: é comando que ele roda, e ali o nome exato é obrigatório
   - linha de comando com `cc `: idem
   - o marcador de resumo e as tabelas de terminal */
const prosa = texto
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/^\s{4,}\S.*$/gm, ' ')       // bloco indentado também é código
  .replace(/^\s*[·|]\s.*$/gm, ' ')      // explicação de flag, linha a linha

const LIMITE = 2

/**
 * Os nomes que só existem na minha cabeça.
 *
 * A lista é de PADRÃO, não de palavra: hook novo entra sozinho, sem alguém
 * lembrar de cadastrar. Foi assim que três hooks rodaram calados esta semana
 * por não estarem numa lista.
 */
const PADROES = [
  { re: /\b[a-z]+-guard\b/g, o: 'nome de hook' },
  { re: /\b[a-zA-Z]+\.(mjs|json|html|js)\b/g, o: 'nome de arquivo' },
  { re: /\bCC-\d+\b/g, o: 'número de tarefa' },
  { re: /\b(meta\.json|feitoEm|subject|todos|blockers)\b/g, o: 'campo interno' },
  { re: /\b(gate|federação|federacao|derivad[oa]|normaliza\w*|parser|snapshot)\b/gi, o: 'jargão' },
]

const achados = []
for (const { re, o } of PADROES) {
  for (const m of prosa.matchAll(re)) achados.push({ termo: m[0], o })
}

/* Nome que vem logo depois de uma explicação, entre parênteses, é o formato
   permitido: "o sistema me obriga a anotar (`reporte-guard`)". */
const unicos = [...new Map(achados.map((a) => [a.termo.toLowerCase(), a])).values()]
  .filter((a) => !new RegExp(`\\([^)]*${a.termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(prosa))

if (unicos.length <= LIMITE) sair()

console.error(
  `${unicos.length} NOMES INTERNOS NA CONVERSA. Ele não tem como lembrar disso.\n\n`
  + unicos.slice(0, 10).map((a) => `  · ${a.termo}  (${a.o})`).join('\n')
  + '\n\nRegra dele, 16/08: "eu não lembro o que que é reporte guard (…) o meu\n'
  + 'cérebro não consegue absorver tudo". O problema não é o tamanho da resposta,\n'
  + 'é a memória que ela exige.\n\n'
  + 'Reescreva dizendo o EFEITO sobre ele:\n\n'
  + '  em vez de  "o reporte-guard devolve quando falta `frente` no meta.json"\n'
  + '  escreva    "se eu trabalhar e não anotar no painel, o sistema me obriga\n'
  + '              a voltar e anotar antes de encerrar"\n\n'
  + 'O nome fica no código, no backlog e no diário, lugares onde ele PROCURA.\n'
  + 'Na conversa ele só passa os olhos.\n\n'
  + 'Precisa mesmo do nome? Ele vem depois do que faz, entre parênteses e uma\n'
  + 'vez só. Bloco de código não conta: ali o nome exato é obrigatório.\n\n'
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
