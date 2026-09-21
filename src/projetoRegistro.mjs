/**
 * O registro central de projeto: o framework declara que um projeto EXISTE
 * antes de ter pasta em máquina nenhuma. Pasta é a parte física, que vem
 * depois — decisão dele em 11/09 (CC-539), depois de achar o kamilleLeal
 * invisível pro framework por não ter `.git`/`CLAUDE.md`.
 *
 * O que este módulo NÃO faz: não mexe em `.framework/estado.json`. Fase,
 * MVP, modo, papel continuam vivendo por pasta, em `frameworkDisco.mjs`,
 * sem mudança nenhuma. Isto é uma camada ACIMA, que resolve só EXISTÊNCIA:
 * "este projeto existe, este é o repositório GitHub dele, em quais máquinas
 * ele já tem pasta". Duas coisas separadas de propósito — reforma pequena
 * em cima de uma peça que já funciona é o oposto de reescrevê-la.
 *
 * Onde mora: `~/.claude/cockpit-projetos.json`, mesmo padrão de
 * `regras.mjs` (`cockpit-regras.json`) — o arquivo é local a CADA máquina, e
 * quem publica os dados sobre o próprio arquivo é a rota HTTP dessa máquina.
 * A máquina que ele escolheu como cofre (a VPS, porque é a única que as duas
 * pontas sempre alcançam) é quem os outros consultam; o PC guarda uma cópia
 * de leitura em `cockpit-projetos-espelho.json`, escrita pelo mesmo ciclo de
 * 30s que já empurra o pacote da federação — nenhum timer novo.
 */

import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

export const arquivoRegistro = () => path.join(casaClaude(), 'cockpit-projetos.json')
export const arquivoEspelho = () => path.join(casaClaude(), 'cockpit-projetos-espelho.json')

const hoje = () => Date.now()

function lerArquivo(arquivo) {
  try {
    const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
    return Array.isArray(d?.projetos) ? d : { projetos: [] }
  } catch {
    return { projetos: [] }
  }
}

/** Cópia da versão anterior antes de sobrescrever, mesmo padrão de `notes.mjs`:
 *  arquivo que só existe por escolha de alguém não pode ter uma versão só. */
function guardarAnterior(arquivo) {
  try {
    if (!fs.existsSync(arquivo)) return
    fs.copyFileSync(arquivo, `${arquivo}.bak`)
  } catch { /* falhar o backup não pode impedir a gravação */ }
}

function gravarArquivo(dados, arquivo) {
  guardarAnterior(arquivo)
  const tmp = `${arquivo}.tmp`
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2), 'utf8')
  fs.renameSync(tmp, arquivo)
}

/** Nome vira id: minúsculo, sem acento tratado por quem chama, um projeto por nome. */
export function idDe(nome) {
  return String(nome || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function listar({ arquivo = arquivoRegistro() } = {}) {
  return lerArquivo(arquivo).projetos
}

export function achar(id, { arquivo = arquivoRegistro() } = {}) {
  return lerArquivo(arquivo).projetos.find((p) => p.id === id) || null
}

/**
 * Declara um projeto novo: só o nome, nenhuma pasta ainda.
 *
 * Recusa nome repetido (mesmo id) — declarar de novo o que já existe seria
 * apagar o que as máquinas já provisionaram silenciosamente.
 */
export function declarar({ nome, criadoPor = null }, { arquivo = arquivoRegistro() } = {}) {
  const limpo = String(nome || '').trim()
  if (!limpo) return { ok: false, erro: 'declaração sem nome' }
  const id = idDe(limpo)
  if (!id) return { ok: false, erro: 'nome sem caractere aproveitável' }

  const d = lerArquivo(arquivo)
  if (d.projetos.some((p) => p.id === id)) return { ok: false, erro: `já existe um projeto declarado com este nome: ${id}` }

  const entrada = {
    id, nome: limpo, estado: 'declarado',
    github: null,
    maquinas: {},
    criadoEm: hoje(), criadoPor,
  }
  d.projetos.push(entrada)
  gravarArquivo(d, arquivo)
  return { ok: true, projeto: entrada }
}

/** Grava o repositório GitHub criado para o projeto (Fase 2 usa isto). */
export function definirGithub(id, { repo, criadoEm = hoje() }, { arquivo = arquivoRegistro() } = {}) {
  const d = lerArquivo(arquivo)
  const p = d.projetos.find((x) => x.id === id)
  if (!p) return { ok: false, erro: `projeto desconhecido: ${id}` }
  p.github = { repo, criadoEm }
  gravarArquivo(d, arquivo)
  return { ok: true, projeto: p }
}

/**
 * Marca que ESTA máquina já tem pasta para o projeto.
 *
 * Nunca cria a pasta — quem cria é `novoProjeto.mjs` (Fase 3). Isto só
 * registra o fato, depois de já ter acontecido, porque ele pediu que a
 * pasta local espere clique, nunca nasça sozinha por causa do registro.
 */
export function provisionarNestaMaquina(id, { maquina, raiz }, { arquivo = arquivoRegistro() } = {}) {
  if (!maquina) return { ok: false, erro: 'provisionar sem nome de máquina' }
  if (!raiz) return { ok: false, erro: 'provisionar sem pasta' }
  const d = lerArquivo(arquivo)
  const p = d.projetos.find((x) => x.id === id)
  if (!p) return { ok: false, erro: `projeto desconhecido: ${id}` }
  p.maquinas[maquina] = { provisionado: true, raiz }
  if (p.estado === 'declarado') p.estado = 'ativo'
  gravarArquivo(d, arquivo)
  return { ok: true, projeto: p }
}

/** A cópia de leitura que o PC guarda a cada ciclo de federação — nunca é
 *  gravada por escolha local, só por chegada do que a VPS respondeu. */
export function espelhar(projetos, { arquivo = arquivoEspelho() } = {}) {
  if (!Array.isArray(projetos)) return { ok: false, erro: 'espelho sem lista' }
  gravarArquivo({ projetos, em: hoje() }, arquivo)
  return { ok: true, total: projetos.length }
}

export function lerEspelho({ arquivo = arquivoEspelho() } = {}) {
  return lerArquivo(arquivo).projetos
}
