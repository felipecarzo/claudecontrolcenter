// CC-544: os projetos que já existem nas pastas viram entradas do registro central.
//
// O registro (projetoRegistro.mjs) só conhecia projeto declarado depois da decisão dele
// de 11/09. Os que já existiam em disco eram invisíveis a ele. Aqui cada pasta achada
// (PC ou VPS) vira UMA entrada, casada pela chave de nomeProjeto: `VPS_cockpit` no PC
// e `PC_cockpit` na VPS são o mesmo projeto, nunca duas linhas.
//
// Roda por máquina: cada uma registra as pastas que TEM. O que já está no registro é
// preservado (cliente, site, github, ativo escolhido por ele); só falta a máquina entra.
// `ativo` nasce pela regra dele (4 commits ou mais nos últimos 30 dias) e só na criação
// da entrada: depois, quem muda é ele (leitor do dia, CC-526).
import { execFileSync } from 'node:child_process'
import * as R from './projetoRegistro.mjs'
import { chaveDeProjeto, nomeCanonico } from './nomeProjeto.mjs'

/* CC-861: a pasta pode vir do PC (`D:\...\VPS_alfa`), e na VPS `path.basename` não corta
   na barra invertida: cada projeto do PC viraria um projeto novo com o caminho inteiro de nome. */
const nomeDaPasta = (raiz) => String(raiz || '').split(/[\\/]/).filter(Boolean).pop() || ''

/** 4 commits ou mais nos últimos 30 dias: a regra de "ativo" dele. */
export function ativoPorGit(raiz) {
  try {
    const n = execFileSync('git', ['-C', raiz, 'rev-list', '--count', '--since=30.days', 'HEAD'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return Number(n) >= 4
  } catch { return false }
}

/**
 * `pastas`: caminhos de projeto desta máquina. Devolve o plano e, se não for ensaio, aplica.
 * Antes/depois contam o registro todo, para a conta "sem sumiço, sem duplicata" ser visível.
 */
export function migrar({ pastas, maquina, arquivo = R.arquivoRegistro(), ensaio = false, ativoDe = ativoPorGit } = {}) {
  if (!maquina) return { ok: false, erro: 'sem o nome desta máquina' }
  const opc = { arquivo }
  const antes = R.listar(opc)

  // uma entrada por chave: nomes diferentes da mesma coisa (prefixo de máquina) juntam aqui
  const porChave = new Map()
  for (const raiz of pastas) {
    const k = chaveDeProjeto(nomeDaPasta(raiz))
    if (!k) continue
    if (!porChave.has(k)) porChave.set(k, { nome: nomeCanonico(nomeDaPasta(raiz)), raiz })
  }

  const achado = (nome) => {
    const k = chaveDeProjeto(nome)
    return antes.find((p) => chaveDeProjeto(p.nome) === k) || null
  }

  const plano = { novos: [], completar: [], iguais: [] }
  for (const { nome, raiz } of porChave.values()) {
    const ja = achado(nome)
    if (!ja) plano.novos.push({ nome, raiz })
    else if (!ja.maquinas?.[maquina]?.provisionado) plano.completar.push({ id: ja.id, nome: ja.nome, raiz })
    else plano.iguais.push({ id: ja.id })
  }

  if (!ensaio) {
    for (const n of plano.novos) {
      const d = R.declarar({ nome: n.nome, ativo: ativoDe(n.raiz) }, opc)
      if (!d.ok) return { ok: false, erro: `${n.nome}: ${d.erro}`, plano }
      n.id = d.projeto.id
      const p = R.provisionarNestaMaquina(n.id, { maquina, raiz: n.raiz }, opc)
      if (!p.ok) return { ok: false, erro: `${n.nome}: ${p.erro}`, plano }
    }
    for (const c of plano.completar) {
      const p = R.provisionarNestaMaquina(c.id, { maquina, raiz: c.raiz }, opc)
      if (!p.ok) return { ok: false, erro: `${c.nome}: ${p.erro}`, plano }
    }
  }
  const depois = ensaio ? null : R.listar(opc)
  return {
    ok: true, ensaio, plano, pastasLidas: pastas.length, entradas: porChave.size,
    antes: antes.length, depois: depois ? depois.length : antes.length + plano.novos.length,
    ids: depois ? new Set(depois.map((p) => p.id)).size : null,
  }
}

/**
 * CC-861: as pastas de OUTRA máquina, chegadas pela federação, entram no registro desta
 * (o cofre), pela mesma conta de `migrar`: projeto em comum ganha a máquina, projeto novo
 * ganha entrada, nada duplica. `ativo` vem medido do lado de lá, onde o git está.
 * Recorta campo a campo: é dado que veio pela rede.
 */
export function receberPastas({ maquina, pastas }, opc = {}) {
  const nome = String(maquina || '').trim().slice(0, 60)
  if (!nome) return { ok: false, erro: 'pastas sem o nome da máquina' }
  if (!Array.isArray(pastas) || !pastas.length) return { ok: false, erro: 'lista de pastas vazia' }
  const lista = pastas.slice(0, 300)
    .map((p) => (typeof p === 'string' ? { raiz: p, ativo: false } : { raiz: String(p?.raiz || ''), ativo: p?.ativo === true }))
    .filter((p) => p.raiz && p.raiz.length <= 300)
  const ativo = new Map(lista.map((p) => [p.raiz, p.ativo]))
  return migrar({ ...opc, pastas: lista.map((p) => p.raiz), maquina: nome, ativoDe: (r) => ativo.get(r) === true })
}

/** As pastas desta máquina como a federação leva: caminho e `ativo` medido aqui. */
export const pastasParaEnviar = (raizes) => raizes.map((raiz) => ({ raiz, ativo: ativoPorGit(raiz) }))
