/**
 * CC-349 — há quanto tempo cada frente do backlog não é mexida.
 *
 * Pedido dele ao rejeitar a primeira versão dos cartões: *"quanto tempo que ela
 * foi aberta, quanto tempo ela tá em pausa, coisas assim, faça uma curadoria
 * dos dados que podemos preencher nisso"*.
 *
 * "Aberta há" já existia (`nascimentos`, em `roadmap.mjs`): é o commit mais
 * ANTIGO em que o título aparece como linha adicionada. "Parada há" é o mesmo
 * varrimento lido pela outra ponta, o commit mais RECENTE. O log já vem do novo
 * para o velho, então é a PRIMEIRA aparição em vez da última.
 *
 * ## Por que módulo próprio, e não uma linha em `roadmap.mjs`
 *
 * Aquele arquivo está reservado por outra rota do Método Routia, e a dona
 * mexeu nele hoje cedo. Um campo a mais ali seria invadir por conveniência, e o
 * custo de um arquivo novo é zero.
 *
 * ## O cache não é otimização, é requisito
 *
 * `git log -p` no ROADMAP inteiro custa centenas de milissegundos por projeto,
 * e a tela do quadro relê a lista a cada visita. Sem cache por tamanho e data
 * do arquivo, abrir o quadro com dez projetos viraria segundos de espera. É a
 * mesma regra que o cache de transcritos segue.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const CAMINHOS = [['docs', 'ROADMAP.md'], ['ROADMAP.md'], ['docs', 'roadmap.md'], ['ROADMAP.MD']]

const acharArquivo = (raiz) => {
  for (const partes of CAMINHOS) {
    const p = path.join(raiz, ...partes)
    try { if (fs.statSync(p).isFile()) return p } catch { /* segue */ }
  }
  return null
}

/* A MESMA chave de `roadmap.mjs`, e isto é uma cópia consciente: os dois lados
   precisam casar título com linha do mesmo jeito, e importar de lá exigiria
   exportar de um arquivo que não é meu. Se um dia divergirem, o sintoma é
   "parada há" sumindo de alguns cartões, nunca aparecendo errado. */
const MARCADORES = /[🔴🟡🟢🔵⚪⚫🔥✅✔☑⛔⏳📌⏸▶►▸➤⏭🚧🆕⭐]/gu
const chaveDoTitulo = (linha) => {
  const id = /\b([A-Z]{1,3}-\d+)\b/.exec(linha)
  if (id) return id[1]
  const limpo = String(linha).replace(/^#+\s*/, '').replace(/`[^`]*`/g, '')
    .replace(MARCADORES, '').replace(/\s+/g, ' ').trim()
  return limpo ? limpo.slice(0, 40).toLowerCase() : null
}

const cache = new Map() // raiz -> { chave, mapa }

/**
 * Quando cada frente foi mexida pela última vez, em milissegundos.
 *
 * Devolve mapa vazio quando não há git ou não há roadmap. Vazio aqui quer dizer
 * "não sei", e quem exibe precisa tratar como ausência: um cartão sem data é
 * melhor que um cartão dizendo "parada há 0 dias" sobre o que não foi medido.
 */
export function ultimaMexida(raiz) {
  const arquivo = acharArquivo(raiz)
  if (!arquivo) return new Map()

  let selo = null
  try { const st = fs.statSync(arquivo); selo = `${st.size}:${st.mtimeMs}` } catch { return new Map() }
  const guardado = cache.get(raiz)
  if (guardado && guardado.chave === selo) return guardado.mapa

  const base = path.dirname(path.dirname(arquivo))
  const rel = path.relative(base, arquivo)
  let saida = ''
  try {
    saida = execFileSync('git', ['log', '--format=__quando__%at', '--diff-filter=AM', '-p', '--', rel], {
      cwd: base, encoding: 'utf8', timeout: 20_000, maxBuffer: 3e7, stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    cache.set(raiz, { chave: selo, mapa: new Map() })
    return new Map()
  }

  const mapa = new Map()
  let commit = 0
  for (const linha of saida.split('\n')) {
    if (linha.startsWith('__quando__')) {
      const t = Number(linha.slice(10))
      if (Number.isFinite(t) && t > 0) commit = t * 1000
      continue
    }
    if (!linha.startsWith('+###')) continue
    const chave = chaveDoTitulo(linha.slice(1))
    /* PRIMEIRA aparição vence, e é o oposto de `nascimentos`: o log vem do mais
       novo para o mais velho, então a primeira vez que o título aparece é a
       mudança mais recente dele. */
    if (chave && commit && !mapa.has(chave)) mapa.set(chave, commit)
  }
  cache.set(raiz, { chave: selo, mapa })
  return mapa
}

/** A chave de um cartão, para quem exibe casar com o mapa acima. */
export const chaveDe = (id, titulo) => (id || chaveDoTitulo(titulo || ''))
