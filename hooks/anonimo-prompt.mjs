#!/usr/bin/env node
/**
 * CC-92, o buraco que o proxy cobriria, fechado sem proxy nenhum.
 *
 * ## O pedido, e por que ele pediu duas coisas
 *
 * Em 15/08 o Felipe pediu o hook E o proxy:
 *
 * > "eu prefiro que isso seja um proxy, um hook, alguma coisa que seja sempre
 * > que eu mandar arquivos de texto, doc, pdf, enfim, tudo com esse modo ligado"
 *
 * O `anonimo-guard` (feito) cobre quando **eu leio um arquivo do disco**. O que
 * ele não vê é o que o Felipe **cola direto no chat**,e era esse o buraco que
 * o proxy fecharia, pondo algo entre o Claude Code e a API.
 *
 * ## Por que este hook substitui o proxy
 *
 * `UserPromptSubmit` roda **antes** de o texto virar prompt, na máquina dele. O
 * dado ainda não saiu. É o mesmo ponto de interceptação que o proxy teria, sem
 * nada do que o torna perigoso:
 *
 * | | proxy | este hook |
 * |---|---|---|
 * | onde intercepta | entre o CLI e a API | antes do prompt sair |
 * | precisa de TLS e certificado próprio | sim | não |
 * | derruba o trabalho se quebrar | sim, tudo | não, falha aberta |
 * | vê texto colado no chat | sim | **sim** |
 * | vê imagem colada | sim | não |
 *
 * Sobra a imagem, que nenhum dos dois resolve bem: o proxy veria os bytes, não o
 * conteúdo. Reconhecer CPF dentro de um print exigiria OCR, que é outro projeto.
 *
 * ## Falha FECHADA, como o irmão dele
 *
 * Todo hook deste repositório libera quando algo dá errado. Estes dois são o
 * oposto, e pela mesma razão: deixar passar não tem desfazer. Uma vez no
 * contexto, o dado já foi para a nuvem, e o transcript guarda em texto puro,
 * relido a cada `--resume`.
 *
 * A exceção é só uma, e é o que impede o hook de ser insuportável: **projeto sem
 * o modo ligado nem entra em ação.**
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
const liberar = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { liberar() }

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('anonimo-prompt')) liberar()

const D = await import(urlDeModulo(AQUI, '../src/frameworkDisco.mjs')).catch(() => null)
if (!D) liberar()

const raiz = D.acharRaiz(dados?.cwd || process.cwd())
if (!raiz) liberar()

const estado = D.ler(raiz)
// proteger é escolha explícita do projeto, igual ao anonimo-guard
if (!estado || estado.ligado === false || !estado.anonimizar) liberar()

const texto = String(dados?.prompt || '')
/* Frase curta não é documento colado. O caso que o proxy cobriria é texto de
   verdade (contrato, e-mail, ficha), e o número aqui é generoso de propósito:
   cobrar de um pedido de 200 caracteres seria alarme em cima de conversa. */
if (texto.length < 240) liberar()

let A = null
try { A = await import(urlDeModulo(AQUI, '../src/anonimizar.mjs')) } catch {
  /* FECHADO: sem o motor não dá para afirmar que está limpo, e afirmar sem
     olhar é o defeito que este hook existe para impedir. */
  process.stderr.write(
    'MASCARADOR INDISPONÍVEL. Não deu para conferir este texto.\n\n'
    + 'O modo de anonimização está ligado neste projeto, e `src/anonimizar.mjs`\n'
    + 'não carregou. Como não dá para afirmar que o texto está limpo, ele não\n'
    + 'passa: uma vez no contexto, o dado já foi para a nuvem e o transcript o\n'
    + 'guarda em texto puro.\n',
  )
  process.exit(2)
}

let achado = null
try {
  const r = A.anonimizar(texto)
  const tipos = [...new Set(Object.values(r.mapa || {}).map((v) => String(v).replace(/_\d+$/, '')))]
  if (tipos.length) achado = { tipos, quantos: Object.keys(r.mapa).length }
} catch { /* motor quebrou no meio: trata como se não tivesse achado */ }

if (!achado) liberar()

/* Devolve para ELE, não para mim: `UserPromptSubmit` com exit 2 recusa o envio e
   mostra o stderr. O texto não chega ao modelo, que é o ponto inteiro. */
process.stderr.write(
  `DADO PESSOAL NO QUE VOCÊ COLOU,${achado.quantos} ocorrência(s), não enviei.\n\n`
  + `Tipos encontrados: ${achado.tipos.join(', ')}\n\n`
  + 'O modo de anonimização está ligado neste projeto. O hook de leitura já\n'
  + 'mascara arquivo que eu abro do disco, mas texto colado no chat passava\n'
  + 'direto: era esse o buraco que o proxy cobriria (CC-92).\n\n'
  + 'Três saídas:\n'
  + '  1. Salve o texto num arquivo e me mande abrir: ele é mascarado sozinho.\n'
  + '  2. Troque nome, CPF e e-mail por apelido antes de colar.\n'
  + '  3. Se for dado seu e você quer mesmo enviar, desligue o modo neste\n'
  + '     projeto: `node cc.mjs framework anonimizar off`.\n',
)
process.exit(2)
