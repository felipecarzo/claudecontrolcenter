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
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))

const liberar = () => process.exit(0)

function bloquear(texto) {
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

const { acharRaiz, ler } = await import(resolve(AQUI, '../src/frameworkDisco.mjs')).catch(liberar)
const { avaliar, podeEditar } = await import(resolve(AQUI, '../src/framework.mjs')).catch(liberar)

const alvo = resolve(String(caminho))
const raiz = acharRaiz(dirname(alvo))
if (!raiz) liberar()

const estado = ler(raiz)
if (!estado) liberar()

const rel = relative(raiz, alvo).replace(/\\/g, '/')
const veredito = podeEditar(estado.metodo, estado, rel)
if (veredito.ok) liberar()

const a = avaliar(estado.metodo, estado)
bloquear(`FRAMEWORK: ${a.tituloFase.toUpperCase()}, edição de código bloqueada em ${rel}

${a.explica}

Falta:
${veredito.pendencias.map((p) => `  - ${p}`).join('\n')}

Como sair daqui: registre o MVP em ${raiz}/.framework/estado.json, no campo
"mvp" (nome, e a lista "criterios" com o texto de cada critério de pronto).
Depois avance a fase com "avancar" do motor, ou escrevendo "fase": "execucao".

Este é o gate de MVP. Ele não julga se o MVP é bom, só confere se ele existe.
Desligar no projeto: apague a pasta .framework.`)
