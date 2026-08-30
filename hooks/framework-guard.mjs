#!/usr/bin/env node
/**
 * O ponto de aplicação do framework: o gate de MVP.
 *
 * Chamado como hook `PreToolUse` (Edit|Write|MultiEdit|NotebookEdit). Recebe o
 * JSON do Claude Code no stdin e usa o código de saída como resposta:
 *
 *   exit 0 = libera    exit 2 = bloqueia, e o stderr volta para o modelo
 *
 * Este arquivo mora NO REPOSITÓRIO, não em `~/.claude/hooks`. Medido em 14/08:
 * o conserto dos testes do Routia ficou preso na VPS porque hook no home não
 * viaja com o projeto e nenhum `git pull` leva. Instalar no `settings.json`
 * continua sendo manual, por decisão antiga do projeto (o painel nunca escreve
 * no settings.json do Claude Code).
 *
 * Três regras que vieram de erro já cometido aqui:
 *   - Projeto sem `.framework/estado.json` passa direto. Opt-in por repositório.
 *   - Qualquer falha nossa (JSON quebrado, estado corrompido) LIBERA. Framework
 *     que trava por bug próprio é desligado no mesmo dia, e com razão.
 *   - A recusa diz o que falta e como sair. Gate mudo é a burocracia que morre
 *     na terceira semana (achado do CC-32).
 */
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança ERR_UNSUPPORTED_ESM_URL_SCHEME, e como quase toda chamada aqui
   está dentro de um `.catch`, o módulo some sem erro visível: foi assim que
   o interruptor de módulos deixou de valer em 31 hooks, sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))

const liberar = () => process.exit(0)

/**
 * CC-91 parte 3: registra o PEDIDO antes de recusar.
 *
 * Sem isto ele só vê que eu fui barrado, e a saída mais fácil é autorizar tudo
 * com `**` — o atalho que esvazia o modo. Com o pedido registrado, ele libera
 * o arquivo que eu pedi, sabendo qual é.
 *
 * Dentro de `try`: não conseguir registrar não pode impedir a recusa, que é a
 * parte que protege.
 */
function bloquear(texto, pedido = null) {
  if (pedido) {
    try {
      const r = pedirAutorizacao(pedido.estado, { alvo: pedido.alvo, quando: new Date().toISOString() })
      if (r.ok) gravarEstado(pedido.raiz, r.estado)
    } catch { /* segue e recusa */ }
  }
  process.stderr.write(texto + '\n')
  process.exit(2)
}

let entrada = ''
try {
  entrada = readFileSync(0, 'utf8')
} catch {
  liberar()
}

let dados = null
try {
  dados = JSON.parse(entrada)
} catch {
  liberar()
}

const caminho = dados?.tool_input?.file_path
if (!caminho) liberar()

const { acharRaiz, ler, gravar: gravarEstado } = await import(urlDeModulo(AQUI, '../src/frameworkDisco.mjs')).catch(liberar)
const { avaliar, podeEditar, pedir: pedirAutorizacao } = await import(urlDeModulo(AQUI, '../src/framework.mjs')).catch(liberar)

const alvo = resolve(String(caminho))
const raiz = acharRaiz(dirname(alvo))
if (!raiz) liberar()

const estado = ler(raiz)
if (!estado) liberar()

const rel = relative(raiz, alvo).replace(/\\/g, '/')
const veredito = podeEditar(estado.metodo, estado, rel)
if (veredito.ok) liberar()

// Recusa por MODO é outra conversa que recusa por fase: aqui o MVP pode estar
// completo e o portão aberto — o que falta é a autorização dele. Dizer "falta
// definir o MVP" nesse caso mandaria o agente consertar a coisa errada.
if (veredito.modo) {
  bloquear(`FRAMEWORK: modo ${veredito.modo.toUpperCase()}, escrita em código bloqueada em ${rel}

${veredito.motivoModo}

Neste modo, escrever código exige autorização explícita do Felipe. Enquanto ela
não vier, o caminho é perguntar, não decidir sozinho.

Como sair daqui, e as duas saídas são DELE, não suas:
  - ele autoriza pelo painel, no cartão do projeto, ou
  - ele troca o modo do projeto ("cc framework modo <nome> --projeto")

Editar o modo em ${raiz}/.framework/estado.json por conta própria é desligar a
trava que ele ligou. É a mesma família do que o CC-45 consertou aqui embaixo.

Documentação, backlog e o próprio estado continuam livres: é o que a conversa
produz, e travar isso tornaria impossível registrar a decisão.

Já registrei o pedido de "${rel}": ele aparece no cartão do projeto para você
liberar SÓ este arquivo, em vez de liberar tudo.`, { estado, raiz, alvo: rel })
}

const a = avaliar(estado.metodo, estado)
bloquear(`FRAMEWORK: ${a.tituloFase.toUpperCase()}, edição de código bloqueada em ${rel}

${a.explica}

Falta:
${veredito.pendencias.map((p) => `  - ${p}`).join('\n')}

Como sair daqui: ENTREVISTE o Felipe. Rode

  cc framework entrevista

e faça a pergunta que ele devolver, UMA por vez, no AskUserQuestion, com as
opções que vierem do roteiro. Grave cada resposta com

  cc framework entrevista responder "<o que ele respondeu>"

NÃO preencha o MVP sozinho, e não invente critério de pronto: um agente já fez
exatamente isso, com 7 critérios que ele mesmo escreveu, e é o que este gate
existe para impedir. Se ele mandar registrar direto, "cc framework mvp" aceita.

Se o arquivo travado aqui for configuração da raiz e não código de produto, o
lugar de resolver é a lista SEMPRE_LIVRE em src/framework.mjs: acrescente o
padrão dele, com o porquê ao lado.

Este é o gate de MVP. Ele não julga se o MVP é bom, só confere se ele existe.
Desligar no projeto: apague a pasta .framework.`)
