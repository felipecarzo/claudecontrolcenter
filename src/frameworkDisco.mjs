/**
 * A camada de disco do framework. Fica separada de `framework.mjs` de propósito:
 * o motor é puro e testável, este arquivo é o que sabe onde as coisas moram.
 *
 * O estado vive DENTRO do projeto (`.framework/estado.json`), não em
 * `~/.claude`. Motivo medido em 14/08: hook e configuração que moram no home
 * não viajam com o repositório, e aí o PC e a VPS passam a ter opiniões
 * diferentes sobre a fase do mesmo projeto. É a frente "Sincronia entre
 * máquinas" (CC-47 a CC-53) acontecendo de novo, e dá para não repetir.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { estadoInicial } from './framework.mjs'

export const PASTA = '.framework'
export const ARQUIVO = 'estado.json'

/** Sobe a árvore procurando o projeto com framework ligado. null = desligado,
 *  que é o padrão: opt-in por repositório, igual ao Método Routia. */
export function acharRaiz(dir) {
  let atual = resolve(dir || process.cwd())
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(atual, PASTA, ARQUIVO))) return atual
    const pai = dirname(atual)
    if (pai === atual) return null
    atual = pai
  }
  return null
}

export function ler(raiz) {
  try {
    return JSON.parse(readFileSync(join(raiz, PASTA, ARQUIVO), 'utf8'))
  } catch {
    return null
  }
}

/** Escrita atômica (tmp + rename), a mesma regra do `meta.json`: leitor
 *  concorrente nunca pode pegar arquivo pela metade. */
export function gravar(raiz, estado) {
  const pasta = join(raiz, PASTA)
  mkdirSync(pasta, { recursive: true })
  const alvo = join(pasta, ARQUIVO)
  const tmp = `${alvo}.tmp`
  writeFileSync(tmp, JSON.stringify(estado, null, 1) + '\n', 'utf8')
  renameSync(tmp, alvo)
  return alvo
}

/** Liga o framework num projeto. Não sobrescreve estado existente: religar por
 *  engano não pode apagar o MVP e o histórico de escopo de ninguém. */
export function iniciar(raiz, metodo = 'mvp-basico') {
  const jaTem = ler(raiz)
  if (jaTem) return { ok: false, erro: 'este projeto já tem framework ligado', estado: jaTem }
  const estado = estadoInicial(metodo)
  gravar(raiz, estado)
  return { ok: true, estado }
}

/**
 * O que o botão do painel chama. Liga, e liga de novo o que estava desligado,
 * sem tocar no MVP nem no histórico.
 *
 * `ligado` ausente conta como ligado: é o formato que o `iniciar()` gravava
 * antes deste campo existir, e estado antigo não pode virar projeto destravado
 * de surpresa.
 */
export function ligar(raiz, metodo = 'mvp-basico') {
  const atual = ler(raiz)
  if (!atual) return { ...iniciar(raiz, metodo), criou: true }
  const estado = { ...atual, ligado: true }
  gravar(raiz, estado)
  return { ok: true, estado, criou: false }
}

/** Desliga preservando tudo. Apagar de vez é apagar a pasta `.framework`, e
 *  isso o painel não faz: destruir dado do projeto não pode ser um clique. */
export function desligar(raiz) {
  const atual = ler(raiz)
  if (!atual) return { ok: false, erro: 'este projeto não tem framework' }
  const estado = { ...atual, ligado: false }
  gravar(raiz, estado)
  return { ok: true, estado }
}

/** Retrato para a tela: existe? está ligado? em que fase? o que falta? */
export function situacao(raiz) {
  const estado = raiz ? ler(raiz) : null
  if (!estado) return { existe: false, ligado: false }
  return { existe: true, ligado: estado.ligado !== false, estado }
}
