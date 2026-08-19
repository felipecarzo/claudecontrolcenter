#!/usr/bin/env node
/**
 * F12: o hook que impede dado pessoal de chegar em mim.
 *
 * `PreToolUse` em `Read`. Com o modo Pierre ligado no projeto, ele troca o
 * caminho do arquivo pela cópia MASCARADA antes da leitura acontecer. Eu leio
 * `<PESSOA_1> paga a <EMPRESA_2>`; o nome real nunca entra no meu contexto e,
 * por consequência, nunca vai para a nuvem.
 *
 * Pedido do Felipe em 15/08: "eu subo muitos arquivos [...] isso tem que
 * acontecer em qualquer arquivo que eu subir, desde que seja com o framework
 * ligado". Anonimizar à mão, arquivo por arquivo, não é solução para quem sobe
 * documento o dia inteiro.
 *
 * O motor é o `anonimizar.ts` do **Pierre**, portado em `src/anonimizar.mjs` e
 * provado contra os 33 casos de teste originais dele.
 *
 * ## Falha FECHADA, ao contrário dos outros hooks deste projeto
 *
 * Todo hook daqui libera quando algo dá errado, porque travar por bug próprio é
 * o jeito mais rápido de ser desligado. **Este é o oposto, e de propósito:** se
 * o mascaramento falhar, a leitura é BLOQUEADA. Falhar aberto aqui significa o
 * dado pessoal passar em claro, e esse erro não tem desfazer — o conteúdo já
 * estaria no contexto do modelo.
 *
 * A exceção que confirma: se o projeto não tem o modo ligado, ele nem entra em
 * ação. A escolha de proteger é explícita; o comportamento dentro dela é
 * rigoroso.
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

function bloquear(texto) {
  process.stderr.write(`${texto}\n`)
  process.exit(2)
}

/** Troca a entrada da ferramenta sem interromper o turno: o Read acontece, só
 *  que na cópia limpa. É o que faz isto ser transparente em vez de atrito. */
function trocarPor(caminho, aviso) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput: { file_path: caminho },
      additionalContext: aviso,
    },
  })}\n`)
  process.exit(0)
}

let entrada = ''
try { entrada = readFileSync(0, 'utf8') } catch { liberar() }

let dados = null
try { dados = JSON.parse(entrada) } catch { liberar() }

const alvo = dados?.tool_input?.file_path
if (!alvo) liberar()

const { acharRaiz, ler } = await import(urlDeModulo(AQUI, '../src/frameworkDisco.mjs')).catch(liberar)
const { deveMascarar, ehOpaco, mascararArquivo } = await import(urlDeModulo(AQUI, '../src/anonimoDisco.mjs')).catch(liberar)

// O modo Pierre é por PROJETO, e o projeto é o do arquivo que está sendo lido —
// não o diretório da sessão. Ler um contrato de outro repositório a partir daqui
// tem que respeitar a regra de LÁ.
const raiz = acharRaiz(dirname(alvo))
  || acharRaiz(dados?.cwd || process.cwd())
if (!raiz) liberar()

const estado = ler(raiz)
if (!estado || estado.ligado === false || !estado.anonimizar) liberar()

// A cópia mascarada e o próprio estado não podem ser mascarados de novo:
// laço infinito, e o segundo passe destruiria as etiquetas do primeiro.
if (alvo.includes('cc-anon') || alvo.includes('.framework')) liberar()
if (!deveMascarar(alvo)) liberar()

if (ehOpaco(alvo)) {
  bloquear(`ANONIMIZAÇÃO: ${alvo} é um formato binário (PDF, DOCX) e o mascarador de texto não enxerga o conteúdo dele.

Com o modo Pierre ligado, ler esse arquivo em claro está bloqueado — dizer que
protegeu sem ter protegido seria pior que não proteger.

Saídas: converter para texto antes (e aí o mascaramento funciona), ou desligar o
modo neste projeto com "cc framework anonimizar off" se o arquivo não tiver dado
pessoal.`)
}

const r = mascararArquivo(alvo)
if (!r.ok) {
  bloquear(`ANONIMIZAÇÃO FALHOU em ${alvo}: ${r.erro}

A leitura foi bloqueada de propósito. Este hook falha FECHADO, ao contrário dos
outros: deixar passar significaria o dado pessoal entrar no contexto do modelo,
e isso não tem desfazer.`)
}

trocarPor(r.copia, `Este arquivo foi anonimizado antes de você ler (modo Pierre).
${r.quantos} valor(es) mascarado(s), dos tipos: ${r.tipos.join(', ') || 'nenhum'}.
${r.duvidosos ? `${r.duvidosos} com confiança baixa — trate as etiquetas com cuidado.\n` : ''}Fale sempre pelas etiquetas (<PESSOA_1>, <EMPRESA_2>): o Felipe vê os nomes reais
na tela dele, porque o mapa fica na máquina e nunca sai. Mapa: ${r.id}.`)
