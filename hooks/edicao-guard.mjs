#!/usr/bin/env node
/**
 * Editar arquivo do repositório por script de shell é o que falha calado.
 *
 * ## O caso que criou este hook, em 16/08
 *
 * Eu commitei dizendo que o CC-77 e o CC-93 estavam marcados no ROADMAP. **O
 * título tinha sido trocado; o corpo não.** A edição foi feita por um
 * `python3 - <<'PY'` com `assert`, encadeado com outros comandos: o `assert`
 * falhou, o script morreu, o comando seguinte rodou assim mesmo, e o commit
 * saiu com a mensagem errada.
 *
 * O Felipe tinha nomeado essa classe de erro poucas horas antes:
 *
 * > "você diz que fez. eu confio, e no momento seguinte eu descubro que não
 * > verdade o que você fez não eh exatamente o que eu pedi"
 *
 * ## A diferença que decide a regra
 *
 * **`Edit` falha em voz alta.** Se a string não bater exatamente, a ferramenta
 * recusa e eu vejo o erro na hora, no meio da conversa. `sed -i`, `perl -i` e
 * `open(arquivo, 'w')` fazem o oposto: não acham, não trocam, não reclamam, e
 * saem com código 0. O arquivo fica intacto e a resposta diz que mudou.
 *
 * Não é preferência de estilo. É a única das duas que **consegue** avisar.
 *
 * ## O que passa
 *
 * - Qualquer coisa em `/tmp` — rascunho é onde script solto deve viver.
 * - Arquivo que não é do repositório.
 * - `>` e `>>` criando arquivo NOVO: aí não há conteúdo para perder, e o
 *   `Write` já cobre o caso quando importa.
 * - `git`, `npm`, formatador: reescrevem arquivo por função própria, não por
 *   substituição cega de texto.
 *
 * Falha ABERTA: erro aqui não pode travar o trabalho.
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
if (dados?.tool_name !== 'Bash') sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('edicao-guard')) sair()

const bruto = String(dados?.tool_input?.command || '')
if (!bruto.trim()) sair()

/**
 * Tira o conteúdo dos heredocs antes de procurar.
 *
 * O hook barrou o primeiro commit que falava dele mesmo: a mensagem citava
 * `sed -i` como exemplo, dentro de um `git commit -F - <<'MSG'`. Texto passado
 * por heredoc é **dado**, não comando — o shell não o executa, e tratá-lo como
 * código transforma o guarda em censor de prosa.
 *
 * Vale para todo heredoc, não só o do commit: escrever um arquivo por `cat > x
 * <<EOF` com um exemplo dentro é legítimo, e é como este próprio repositório
 * escreve script de teste.
 */
const cmd = bruto.replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?^\1\s*$/gm, '<<heredoc>>')

/* Rascunho é o lugar certo do script solto, e não tem o que perder lá. */
const soEmTemp = (trecho) => /\/tmp\/|\$TMPDIR|mktemp/.test(trecho)

/**
 * As três formas de sobrescrever texto sem ninguém ficar sabendo.
 *
 * Cada padrão vem com o nome do que ele faz, porque a mensagem tem que dizer
 * qual foi o comando — "use o Edit" sem apontar o trecho é conselho, não gate.
 */
const FORMAS = [
  { re: /\bsed\s+(-[a-zA-Z]*i|--in-place)\b[^\n|;]*/g, nome: 'sed -i' },
  { re: /\bperl\s+-[a-zA-Z]*i[a-zA-Z]*\b[^\n|;]*/g, nome: 'perl -i' },
  { re: /\bopen\(\s*[^)]*,\s*['"]w['"]\s*\)[^\n]*/g, nome: "open(arquivo, 'w') em Python" },
  { re: /\bwriteFileSync\([^\n]*/g, nome: 'writeFileSync em Node' },
  { re: /\.replace\(\s*[^\n]*\)\s*\)?\s*$/gm, nome: null }, // só reforça, não acusa sozinho
]

const achados = []
for (const { re, nome } of FORMAS) {
  if (!nome) continue
  for (const m of cmd.matchAll(re)) {
    const trecho = m[0]
    if (soEmTemp(trecho) || soEmTemp(cmd.slice(Math.max(0, m.index - 120), m.index))) continue
    achados.push({ nome, trecho: trecho.trim().slice(0, 110) })
  }
}

if (!achados.length) sair()

console.error(
  'EDIÇÃO DE ARQUIVO POR SCRIPT — use o Edit, que falha em voz alta.\n\n'
  + achados.map((a) => `  ${a.nome}\n    ${a.trecho}`).join('\n')
  + '\n\nEm 16/08 isto trocou o título do CC-77 no ROADMAP e não trocou o corpo: o\n'
  + '`assert` do script falhou, o comando seguinte rodou assim mesmo, e o commit\n'
  + 'saiu dizendo que o item estava fechado. O Felipe tinha nomeado esse erro\n'
  + 'poucas horas antes ("você diz que fez, eu confio").\n\n'
  + 'A diferença não é estilo: `Edit` RECUSA quando a string não bate, e você vê\n'
  + 'o erro na hora. `sed -i` e `open(f, "w")` não acham, não trocam, não\n'
  + 'reclamam, e saem com código 0. Só uma das duas consegue avisar.\n\n'
  + 'Como fazer:\n'
  + '  · uma troca pontual → Edit (use replace_all para todas as ocorrências)\n'
  + '  · arquivo inteiro   → Write\n'
  + '  · muitos arquivos   → o script pode existir, mas escreva em /tmp e depois\n'
  + '    confira o resultado antes de mover\n',
)
process.exit(2)
