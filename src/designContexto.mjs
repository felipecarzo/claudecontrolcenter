/**
 * CC-558, peça A: o design DESTE projeto, para o agente seguir ao mexer em tela. O arquivo de identidade,
 * a versão aprovada de cada tela desenhada, o ajuste pedido e o mural de referências dele.
 *
 * Mora fora de gatePacote.mjs porque aquele arquivo é de outra rota: lá entram só o import e a linha da
 * lista de seções. Nunca lança: sem design, devolve null e a seção some do pacote.
 */
import { identidade } from './design.mjs'
import { paraOAgente as telasParaOAgente } from './designTelas.mjs'
import { paraOAgente as muralParaOAgente } from './designMural.mjs'

export const GATE_MAX_PROJ_DESIGN = 1400

/** O mesmo corte do gatePacote: para no teto e diz quanto ficou de fora. */
function cortar(linhas, teto) {
  const fora = []; let tamanho = 0
  for (const l of linhas) { if (tamanho + l.length + 1 > teto) break; fora.push(l); tamanho += l.length + 1 }
  const restam = linhas.length - fora.length
  if (restam > 0) fora.push(`  (e mais ${restam} linhas de design, cortadas pelo teto deste resumo)`)
  return { linhas: fora, cortadas: restam }
}

export function secaoDesignDoProjeto(cwd) {
  if (!cwd) return null
  const linhas = []
  try {
    const principal = identidade(cwd).principal
    if (principal) linhas.push('  a identidade (cores, fontes e regras) está em ' + principal + '. Siga o arquivo ao mexer em tela.')
    linhas.push(...telasParaOAgente(cwd))
    const m = muralParaOAgente(cwd)
    if (m.length) linhas.push('  o mural de referências dele, o mais novo primeiro:', ...m)
  } catch { return null }
  if (!linhas.length) return null
  return { titulo: 'O DESIGN DESTE PROJETO', ...cortar(linhas, GATE_MAX_PROJ_DESIGN) }
}
