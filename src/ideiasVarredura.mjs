/**
 * A varredura de hora em hora das ideias dele (26/09, item 8 da Início).
 *
 * Medido antes: as oito filas de ideias dos projetos existiam e estavam TODAS
 * vazias desde sempre. A fila só era preenchida pelo encerramento formal de
 * sessão, que quase nunca roda, então o bloco Ideias da Início mostrava zero
 * para sempre: peça pronta que nunca recebe nada.
 *
 * Aqui o painel faz o que o encerramento fazia: olha as conversas mexidas nas
 * últimas 24 horas, acha as mensagens dele com cara de ideia ("e se", "tive
 * uma ideia", "podemos"…, regra 4 do ciclo) que ainda não estão no backlog do
 * projeto, e GUARDA na fila daquele projeto. Não escreve no backlog: quem
 * escreve é a sessão seguinte, com as palavras dele (passo 2.5 do
 * `/start-session`), e quem decide é ele.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PROJETOS_DIR } from './metaSessao.mjs'
import { cabecaDe } from './sessoes.mjs'
import { levantar, guardar, lerFila, idDe } from './ideias.mjs'

/** A raiz do projeto de uma pasta de trabalho, se ela estiver dentro de
 *  `projetos/`. Puro. Fora dali (home, /tmp) não é projeto e devolve null. */
export function raizDoProjeto(cwd) {
  const m = /^(.*[\\/]projetos)[\\/]([^\\/]+)/i.exec(String(cwd || ''))
  if (!m || m[2].startsWith('.')) return null
  return path.join(m[1], m[2])
}

/** O texto contra o qual se decide "já está no backlog": o roteiro e o dado. */
function backlogDe(raiz) {
  let t = ''
  for (const f of ['docs/ROADMAP.md', 'docs/backlog.jsonl', 'ROADMAP.md']) {
    try { t += '\n' + fs.readFileSync(path.join(raiz, f), 'utf8') } catch { /* não tem */ }
  }
  return t
}

/* Arquivo já varrido, com o tamanho de então: conversa que não cresceu não se
   relê. Em memória, porque o pior caso de perder é varrer de novo. */
const varridos = new Map()

/**
 * Uma passada. Devolve o que achou, por projeto. Nunca lança.
 * `janelaMs` é o quanto para trás olhar (padrão 24 horas).
 */
export function varrer({ janelaMs = 24 * 3600 * 1000, agora = Date.now(), dir = PROJETOS_DIR(), ensaio = false } = {}) {
  const saida = { arquivos: 0, novas: 0, porProjeto: {} }
  let pastas = []
  try { pastas = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()) } catch { return saida }
  for (const p of pastas) {
    let nomes = []
    try { nomes = fs.readdirSync(path.join(dir, p.name)).filter((n) => n.endsWith('.jsonl')) } catch { continue }
    for (const n of nomes) {
      const arq = path.join(dir, p.name, n)
      let st
      try { st = fs.statSync(arq) } catch { continue }
      if (agora - st.mtimeMs > janelaMs) continue
      if (varridos.get(arq) === st.size) continue
      varridos.set(arq, st.size)
      const cab = cabecaDe(arq)
      const raiz = raizDoProjeto(cab?.cwd)
      if (!raiz || !fs.existsSync(raiz)) continue
      saida.arquivos += 1
      try {
        const novas = levantar(arq, backlogDe(raiz)).filter((a) => !a.registrada)
        if (!novas.length) continue
        if (ensaio) {
          varridos.delete(arq)
          saida.novas += novas.length
          ;(saida.exemplos || (saida.exemplos = [])).push(...novas.map((a) => path.basename(raiz) + ': ' + String(a.texto).replace(/\s+/g, ' ').slice(0, 90)))
          saida.porProjeto[path.basename(raiz)] = (saida.porProjeto[path.basename(raiz)] || 0) + novas.length
          continue
        }
        const r = guardar(raiz, novas, { sessao: path.basename(arq, '.jsonl') })
        saida.novas += r.novos
        if (r.novos) saida.porProjeto[path.basename(raiz)] = (saida.porProjeto[path.basename(raiz)] || 0) + r.novos
      } catch { /* conversa ilegível não derruba a passada */ }
    }
  }
  return saida
}

/* ── O índice de TODAS as ideias (26/09, a tela Ideias) ───────────────────
   Pedido dele: "tem mais dessas? podemos organizar isso em algum lugar que eu
   possa ler e filtrar por projetos e outras coisas?". Medido: 29 mensagens com
   cara de ideia nas conversas desta VPS, 10 já no backlog e 19 nunca viraram
   item. O índice junta todas com o estado de cada uma; a fila continua sendo
   só o que espera decisão (a Início mostra a fila, a tela mostra o índice). */
const cacheIndice = new Map() // arquivo -> { size, itens }

/** Estado de uma ideia, por ordem de precedência. Puro. */
export function estadoDaIdeia({ id, registrada }, fila) {
  const p = (fila?.pendentes || []).find((x) => x.id === id)
  if (p) return p.aprovada ? 'aprovada' : 'esperando'
  if ((fila?.descartados || []).includes(id)) return 'descartada'
  return registrada ? 'no backlog' : 'nunca virou item'
}

export function indice({ dir = PROJETOS_DIR() } = {}) {
  const itens = []
  const filas = new Map()
  let pastas = []
  try { pastas = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()) } catch { return itens }
  for (const p of pastas) {
    let nomes = []
    try { nomes = fs.readdirSync(path.join(dir, p.name)).filter((n) => n.endsWith('.jsonl')) } catch { continue }
    for (const n of nomes) {
      const arq = path.join(dir, p.name, n)
      let st
      try { st = fs.statSync(arq) } catch { continue }
      const raiz = raizDoProjeto(cabecaDe(arq)?.cwd)
      if (!raiz || !fs.existsSync(raiz)) continue
      let achados = cacheIndice.get(arq)
      if (!achados || achados.size !== st.size) {
        let lista = []
        try { lista = levantar(arq, backlogDe(raiz)) } catch { lista = [] }
        achados = { size: st.size, itens: lista.map((a) => ({ id: idDe(a.texto), texto: a.texto, quando: a.quando || null, registrada: Boolean(a.registrada), sessao: path.basename(arq, '.jsonl') })) }
        cacheIndice.set(arq, achados)
      }
      if (!filas.has(raiz)) filas.set(raiz, lerFila(raiz))
      for (const a of achados.itens) itens.push({ ...a, raiz, projeto: path.basename(raiz), estado: estadoDaIdeia(a, filas.get(raiz)) })
    }
  }
  /* A mesma ideia dita em duas conversas aparece uma vez só. */
  const unicos = new Map()
  for (const i of itens) if (!unicos.has(i.raiz + i.id)) unicos.set(i.raiz + i.id, i)
  return [...unicos.values()].sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')))
}
