// Rotinas do Claude Code (os comandos `/algo`) espalhadas pelos projetos.
//
// Uma rotina é um arquivo .md em `.claude/commands/`. Ela mora em dois lugares,
// e o do PROJETO vence o global. Por isso uma cópia velha dentro do projeto
// desliga a rotina boa sem avisar ninguém. Foi o que aconteceu: medido em
// 13/08, as cinco cópias de `start-session.md` eram idênticas entre si e 29
// linhas mais curtas que a global, nenhuma com o passo do Método Routia, e a do
// `app_maurice` se apresentava como "projeto Juju".
//
// Este módulo só LÊ e COMPARA. As duas escritas (sincronizar, remover) são
// chamadas sob clique, nunca em timer: varrer o disco de 22 projetos é caro,
// mesma decisão de processos.mjs e vps.mjs.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findProjects, projectsBase } from './install.mjs'

/** Onde moram as rotinas que valem em todo projeto. */
export const GLOBAL_DIR = path.join(os.homedir(), '.claude', 'commands')

/** Onde o projeto guarda as dele. */
const dirDoProjeto = (raiz) => path.join(raiz, '.claude', 'commands')

/**
 * Comparação tem que ser por CONTEÚDO, nunca por data: copiar uma pasta renova
 * o mtime e faria arquivo velho passar por novo. E os arquivos são CRLF, então
 * comparar sem normalizar acusaria diferença em tudo que passou por editor
 * diferente.
 */
const normalizar = (texto) =>
  texto.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim()

/** Lê os .md de uma pasta. Pasta que não existe é caso normal, não erro. */
function lerRotinas(dir) {
  const mapa = new Map()
  let nomes = []
  try {
    nomes = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.md'))
  } catch {
    return mapa
  }
  for (const nome of nomes) {
    try {
      const bruto = fs.readFileSync(path.join(dir, nome), 'utf8')
      const texto = normalizar(bruto)
      mapa.set(nome, { bruto, texto, linhas: texto.split('\n').length })
    } catch {
      // arquivo ilegível é como se não existisse: não derruba a varredura inteira
    }
  }
  return mapa
}

/** Quantas linhas diferem entre os dois textos, pra dar tamanho à divergência. */
function quantasLinhasDiferem(a, b) {
  const la = a.split('\n')
  const lb = b.split('\n')
  const setA = new Set(la)
  const setB = new Set(lb)
  let n = 0
  for (const l of la) if (!setB.has(l)) n++
  for (const l of lb) if (!setA.has(l)) n++
  return n
}

/**
 * Estado de todas as rotinas de todos os projetos.
 *
 * Quatro situações, e só uma é problema:
 * - `divergente`: existe nos dois e o conteúdo difere. É o caso grave, porque a
 *   cópia do projeto vence e o Felipe roda a versão velha sem saber.
 * - `igual`: cópia redundante, inofensiva hoje. Vira problema no dia em que a
 *   global mudar, e por isso continua aparecendo.
 * - `propria`: só existe no projeto. Legítima: rotina que só faz sentido ali.
 * - global sem cópia nenhuma nem entra na lista: é o funcionamento normal.
 */
export function estado({ base = projectsBase() } = {}) {
  const globais = lerRotinas(GLOBAL_DIR)
  const projetos = []

  for (const dir of findProjects(base)) {
    const locais = lerRotinas(dirDoProjeto(dir))
    if (!locais.size) continue

    const rotinas = []
    for (const [nome, local] of locais) {
      const global = globais.get(nome)
      if (!global) {
        rotinas.push({ nome, situacao: 'propria', linhas: local.linhas })
        continue
      }
      const igual = local.texto === global.texto
      rotinas.push({
        nome,
        situacao: igual ? 'igual' : 'divergente',
        linhas: local.linhas,
        linhasGlobal: global.linhas,
        diferencas: igual ? 0 : quantasLinhasDiferem(local.texto, global.texto),
      })
    }

    projetos.push({
      projeto: path.basename(dir),
      dir,
      rotinas: rotinas.sort((a, b) => a.nome.localeCompare(b.nome)),
      divergentes: rotinas.filter((r) => r.situacao === 'divergente').length,
    })
  }

  return {
    globais: [...globais.keys()].sort(),
    projetos: projetos.sort(
      (a, b) => b.divergentes - a.divergentes || a.projeto.localeCompare(b.projeto),
    ),
    at: Date.now(),
  }
}

/**
 * O texto dos dois lados, pra mostrar ANTES de escrever. Sincronizar apaga o
 * que a cópia tinha de próprio (o nome do projeto no corpo, por exemplo), então
 * a decisão nunca é tomada às cegas. Mesma regra do encerrar servidor.
 */
export function comparar(dir, nome) {
  const global = lerRotinas(GLOBAL_DIR).get(nome)
  const local = lerRotinas(dirDoProjeto(dir)).get(nome)
  return { nome, global: global ? global.bruto : null, local: local ? local.bruto : null }
}

/**
 * Trava única das duas escritas: o alvo tem que ser um .md simples dentro de um
 * projeto que a varredura enxerga. Sem isso, um nome vindo do navegador
 * escreveria em qualquer lugar do disco.
 */
function alvoValido(dir, nome, base) {
  if (!nome.toLowerCase().endsWith('.md') || nome.includes('/') || nome.includes('\\')) {
    throw new Error(`nome de rotina inválido: ${nome}`)
  }
  // Comparar caminho como texto cru rejeita projeto legítimo: `findProjects`
  // devolve com barra invertida no Windows e o navegador manda com barra
  // normal. `path.resolve` põe os dois na mesma forma antes de comparar.
  const alvo = path.resolve(dir)
  if (!findProjects(base).some((p) => path.resolve(p) === alvo)) {
    throw new Error(`fora da base de projetos: ${dir}`)
  }
  return path.join(dirDoProjeto(alvo), nome)
}

/** A global passa a valer também dentro do projeto. */
export function sincronizar(dir, nome, { base = projectsBase() } = {}) {
  const destino = alvoValido(dir, nome, base)
  const global = lerRotinas(GLOBAL_DIR).get(nome)
  if (!global) throw new Error(`não existe rotina global chamada ${nome}`)
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, global.bruto)
  return { acao: 'sincronizada', arquivo: destino }
}

/** Apaga a cópia do projeto. A global volta a valer ali, que é o normal. */
export function remover(dir, nome, { base = projectsBase() } = {}) {
  const alvo = alvoValido(dir, nome, base)
  if (!fs.existsSync(alvo)) return { acao: 'já não existia', arquivo: alvo }
  fs.unlinkSync(alvo)
  return { acao: 'removida', arquivo: alvo }
}
