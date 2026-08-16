#!/usr/bin/env node
/**
 * A tarefa se auto-verifica antes de ser entregue.
 *
 * ## O pedido dele, em 16/08
 *
 * > "voltemos à questão de garantir por hook que toda tarefa use a banca pra se
 * > auto-testar"
 *
 * O `gate-guard` cobre o `npm test`, que responde "eu quebrei alguma coisa?".
 * Este cobre a outra pergunta, a que o teste nunca responde: **"eu deixei
 * alguma coisa insegura?"** Suíte verde convive perfeitamente com chave
 * commitada, tabela sem RLS e certificado vencido.
 *
 * ## O que ele exige, e por que só isso
 *
 * As camadas do **nível declarado do projeto**, e só as que cabem nele. O nível
 * é a escolha dele — `rascunho` num script pessoal, `exposto` num site com dado
 * de cliente — e é o que impede o hook de ser insuportável no lugar errado.
 * Sem nível declarado, assume `rascunho`: uma camada só, a de segredo, que é a
 * única cujo estrago é irreversível (commit fica no histórico depois de apagar
 * o arquivo).
 *
 * ## Rodou ANTES da edição não conta
 *
 * Mesma regra do `gate-guard`, e pelo mesmo motivo: verificação de um estado
 * que não existe mais é pior que nenhuma, porque parece cobertura.
 *
 * ## O que ele NUNCA faz
 *
 * Não roda camada sozinho. Uma varredura de minutos disparada no fim do turno,
 * sem ele pedir, é a receita para o recurso ser desligado — e camada de rede
 * fala com servidor de verdade. O hook diz o comando; quem roda é quem trabalha.
 *
 * Falha ABERTA, uma volta só.
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }
if (dados?.stop_hook_active) sair()

const cfg = await import(resolve(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('bancada-guard')) sair()

const D = await import(resolve(AQUI, '../src/frameworkDisco.mjs')).catch(() => null)
const B = await import(resolve(AQUI, '../src/bancada.mjs')).catch(() => null)
const C = await import(resolve(AQUI, '../src/bancadaCatalogo.mjs')).catch(() => null)
if (!D || !B || !C) sair()

const raiz = D.acharRaiz(dados?.cwd || process.cwd())
if (!raiz) sair()

const estado = D.ler(raiz)
// projeto sem framework ligado não é cobrado: a Bancada é opt-in por projeto
if (!estado || estado.ligado === false) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

/* Os arquivos de código que ESTE turno tocou, com a hora de cada um. */
let cauda = ''
try { cauda = readFileSync(arquivo, 'utf8').slice(-400_000) } catch { sair() }
const corte = cauda.lastIndexOf('"type":"user"')
const turno = corte >= 0 ? cauda.slice(corte) : cauda

const CODIGO = /\.(mjs|js|cjs|ts|tsx|jsx|html|css|json|ps1|sh|py|sql)$/i
const SO_TEXTO = /(^|\/)(docs|assets)\//i

const tocados = new Set()
for (const linha of turno.split('\n')) {
  if (!linha.includes('"tool_use"')) continue
  let ev = null
  try { ev = JSON.parse(linha) } catch { continue }
  for (const b of ev?.message?.content || []) {
    if (b?.type !== 'tool_use') continue
    if (!['Edit', 'Write', 'NotebookEdit'].includes(b.name)) continue
    const alvo = String(b.input?.file_path || '')
    if (CODIGO.test(alvo) && !SO_TEXTO.test(alvo)) tocados.add(alvo)
  }
}
if (!tocados.size) sair()

/* A hora da última edição sai do disco, não do transcript: mtime é o que o
   projeto realmente tem, e sobrevive a edição feita fora da conversa. */
let editadoEm = 0
for (const a of tocados) {
  try { editadoEm = Math.max(editadoEm, statSync(a).mtimeMs) } catch { /* apagado depois */ }
}
if (!editadoEm) sair()

const nivel = estado.nivelBancada || 'rascunho'
const camadas = B.situacao(raiz, estado.bancadaCfg || {}).camadas

/* CC-71: o gate sugere o modo incremental, não o completo.
   `lint-staged` existe porque gate que roda no repositório inteiro a cada
   entrega é o tipo de lentidão que faz desligar o recurso. Aqui a mesma regra:
   a entrega mexeu em N arquivos, e são esses que precisam de olhar novo. O
   completo continua a um comando de distância, sem a flag. */
const SUGESTAO = `node cc.mjs framework bancada nivel ${nivel} --rodar --so-mudou`
const veredito = C.avaliarNivel(nivel, camadas)

const porId = Object.fromEntries(camadas.map((c) => [c.id, c]))
const velhas = veredito.ok.filter((id) => {
  const q = porId[id]?.resultado?.em
  return q && new Date(q).getTime() < editadoEm
})

const pendentes = [...veredito.faltaRodar, ...velhas]
if (!pendentes.length && !veredito.falhou.length) sair()

const N = C.NIVEIS[nivel]
const linhas = []
if (veredito.falhou.length) {
  linhas.push(`  ACHOU PROBLEMA: ${veredito.falhou.join(', ')}`)
}
if (veredito.faltaRodar.length) {
  linhas.push(`  nunca rodou:    ${veredito.faltaRodar.join(', ')}`)
}
if (velhas.length) {
  linhas.push(`  rodou ANTES da sua edição: ${velhas.join(', ')}`)
}

console.error(
  `A BANCADA DO NÍVEL "${nivel}" NÃO COBRE ESTE TRABALHO.\n\n`
  + `${N.titulo} pergunta: ${N.pergunta}\n`
  + `${N.explica}\n\n`
  + `Você mexeu em ${tocados.size} arquivo(s) de código neste turno.\n\n`
  + `${linhas.join('\n')}\n\n`
  + `    ${SUGESTAO}\n\n`
  + `  · \`bancada nivel ${nivel} --rodar\` = roda as camadas exigidas por este\n`
  + '    nível, pulando as que não se aplicam ao projeto\n'
  + '  · `--so-mudou` = só nos arquivos que mudaram desde o último commit.\n'
  + '    Sem git, varre tudo — nunca menos verificação, só menos espera\n\n'
  + 'O `npm test` responde "eu quebrei alguma coisa?". A Bancada responde\n'
  + '"eu deixei alguma coisa insegura?" — e suíte verde convive muito bem com\n'
  + 'chave commitada e tabela sem proteção.\n\n'
  + `Nível errado para este projeto? \`node cc.mjs framework bancada nivel <outro>\`\n`
  + `— os quatro são: ${Object.keys(C.NIVEIS).join(', ')}.\n`
  + 'Esta é a única volta: a próxima passa.',
)
process.exit(2)
