// CC-1107, peça A: o retrato do CÓDIGO desta máquina, para o resumo da federação levar.
// Três fatos que ele descobria à mão: em que commit a máquina está, quantos arquivos soltos (sem commit) ela tem,
// e se o painel que RODA carrega código mais velho que esse commit (o painel não recarrega módulo sozinho).
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { versaoInstalada } from './publicar.mjs'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const VALIDADE_MS = 30_000
let cache = null

const git = (args, raiz) => new Promise((resolve) => {
  execFile('git', ['-C', raiz, ...args], { encoding: 'utf8', windowsHide: true, timeout: 5000 }, (erro, saida) => {
    resolve(erro ? null : String(saida).trim())
  })
})

/* O commit que o painel CARREGOU: o carimbo da cópia publicada quando o painel roda dela, senão o commit visto no
   primeiro uso (este módulo carrega junto com o painel, que não recarrega módulo). Promessa guardada: vale uma vez. */
const carregados = new Map()
const commitCarregado = (raiz) => {
  if (!carregados.has(raiz)) {
    carregados.set(raiz, (async () => {
      const carimbo = versaoInstalada(raiz)
      return carimbo?.commit || await git(['rev-parse', '--short', 'HEAD'], raiz)
    })())
  }
  return carregados.get(raiz)
}

/** `{ commit, soltos, rodando, painelVelho, em }`. Campo `null` = esta máquina não soube medir (nunca zero). */
export async function codigoDaqui({ raiz = RAIZ, agora = Date.now() } = {}) {
  if (cache && cache.raiz === raiz && agora - cache.em < VALIDADE_MS) return cache.valor
  const rodando = await commitCarregado(raiz)
  /* A cópia publicada não tem .git, mas o carimbo diz de onde saiu (`de`): o "commit atual" e os soltos são os
     das obras. Sem .git e sem carimbo, a máquina não sabe, e o campo fica null. */
  const obras = versaoInstalada(raiz)?.de || raiz
  const commit = await git(['rev-parse', '--short', 'HEAD'], obras)
  const status = await git(['status', '--porcelain'], obras)
  const valor = {
    commit,
    soltos: status === null ? null : status.split('\n').filter(Boolean).length,
    rodando: rodando || null,
    painelVelho: commit && rodando ? commit !== rodando : null,
    em: agora,
  }
  cache = { raiz, em: agora, valor }
  return valor
}

/** Para quem monta tela de forma síncrona: devolve o último retrato medido e dispara a próxima medida em segundo
 *  plano. Na primeira chamada devolve `null` (ainda não mediu), nunca um valor inventado. */
export function codigoEmCache() {
  codigoDaqui().catch(() => {})
  return cache?.valor ?? null
}

/** Recorte de quem recebe pela rede: número é número, texto curto, `null` continua `null`. */
export function recortarCodigo(bruto) {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null
  const texto = (v) => (v ? String(v).replace(/[^0-9a-zA-Z._-]/g, '').slice(0, 40) || null : null)
  return {
    commit: texto(bruto.commit),
    soltos: Number.isFinite(bruto.soltos) ? Math.max(0, Math.min(100000, Math.trunc(bruto.soltos))) : null,
    rodando: texto(bruto.rodando),
    painelVelho: typeof bruto.painelVelho === 'boolean' ? bruto.painelVelho : null,
    em: Number(bruto.em) || null,
  }
}
