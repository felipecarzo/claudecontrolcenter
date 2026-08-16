/**
 * CC-52: o tamanho real do buraco do Método Routia.
 *
 * ## A pergunta certa não é "quantos projetos têm quadro"
 *
 * O Routia protege contra **duas sessões mexendo na mesma parte ao mesmo
 * tempo**. Num projeto onde só trabalha uma sessão por vez, não ter quadro não
 * custa nada — é cerimônia vazia. Então "12 de 14 projetos sem Routia" é um
 * número que assusta e não informa.
 *
 * O que informa: **em quantos projetos duas sessões de fato se sobrepuseram no
 * tempo, sem quadro para se enxergarem?** Esse é o buraco, e é sempre menor que
 * o outro número — e muito mais acionável.
 *
 * ## De onde sai a medida
 *
 * Do transcrito, que é o único registro honesto de quando uma sessão viveu:
 * o começo do arquivo dá a hora da primeira mensagem, o `mtime` dá a última.
 * Duas sessões do mesmo projeto se sobrepõem quando uma começa antes de a
 * outra ter terminado.
 *
 * ⚠️ **A medida é da máquina em que roda, e isso muda o resultado.** Na VPS o
 * trabalho é interativo pelo celular, uma sessão por vez: dá zero sobreposição,
 * o que é verdade sobre a VPS e não sobre o projeto. O número que vale sai do
 * PC, onde os jobs de background rodam em paralelo. Por isso a saída sempre diz
 * de que máquina está falando.
 */
import fs from 'node:fs'
import path from 'node:path'
import { cabecaDe, PROJETOS_DIR } from './sessoes.mjs'

/** Transcrito menor que isto é sessão de recado, não trabalho: entra na conta
 *  e distorce, porque abrir e fechar o CLI já cria arquivo. */
const MINIMO_BYTES = 3000

const quadroDe = (dir) => path.join(dir, 'docs', 'ROTAS-ATIVAS.md')

/** As sessões de cada projeto, com a janela de vida de cada uma. */
function sessoesPorProjeto() {
  const porProjeto = new Map()
  let pastas = []
  try {
    pastas = fs.readdirSync(PROJETOS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(PROJETOS_DIR, d.name))
  } catch { return porProjeto }

  for (const pasta of pastas) {
    let arquivos = []
    try { arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith('.jsonl')) } catch { continue }
    for (const nome of arquivos) {
      const arquivo = path.join(pasta, nome)
      let st
      try { st = fs.statSync(arquivo) } catch { continue }
      if (st.size < MINIMO_BYTES) continue

      const cabeca = cabecaDe(arquivo)
      if (!cabeca?.cwd) continue // sem cwd não dá pra dizer de que projeto é

      const dir = String(cabeca.cwd).replace(/[\\/]+$/, '')
      const atual = porProjeto.get(dir) || []
      atual.push({
        inicio: new Date(cabeca.criadoEm || st.mtimeMs).getTime(),
        fim: st.mtimeMs,
      })
      porProjeto.set(dir, atual)
    }
  }
  return porProjeto
}

/** Quantos pares de sessões do mesmo projeto viveram ao mesmo tempo. */
export function sobreposicoes(janelas) {
  const ordenadas = [...janelas].sort((a, b) => a.inicio - b.inicio)
  let pares = 0
  for (let i = 1; i < ordenadas.length; i++) {
    // basta comparar com as anteriores que ainda não terminaram
    for (let j = 0; j < i; j++) {
      if (ordenadas[i].inicio < ordenadas[j].fim) { pares++; break }
    }
  }
  return pares
}

/**
 * O retrato: uma linha por projeto que teve sessão, mais o resumo.
 *
 * `expostos` é a resposta do CC-52: projetos que tiveram sessões simultâneas e
 * **não** têm quadro. É a lista que vale agir, e costuma ser bem menor que "os
 * projetos sem Routia".
 */
export function retrato() {
  const porProjeto = sessoesPorProjeto()
  const projetos = []

  for (const [dir, janelas] of porProjeto) {
    projetos.push({
      dir,
      nome: path.basename(dir),
      sessoes: janelas.length,
      simultaneas: sobreposicoes(janelas),
      temQuadro: fs.existsSync(quadroDe(dir)),
    })
  }

  projetos.sort((a, b) => b.simultaneas - a.simultaneas || b.sessoes - a.sessoes)
  const expostos = projetos.filter((p) => p.simultaneas > 0 && !p.temQuadro)

  return {
    projetos,
    expostos,
    resumo: {
      comSessao: projetos.length,
      comQuadro: projetos.filter((p) => p.temQuadro).length,
      comParalelismo: projetos.filter((p) => p.simultaneas > 0).length,
      expostos: expostos.length,
    },
  }
}
