// Containers Docker rodando NESTA máquina (Docker Desktop), não na VPS —
// isso é a aba VPS. Mesma ideia da aba servidores (o que está no ar agora),
// só que pelo `docker ps` em vez de porta escutando.

import { quietAsync } from './platform.mjs'

const CACHE_MS = 10000
let cache = { at: 0, containers: null, disponivel: null }

// `\t` como separador: nome de container e imagem podem ter espaço, `|` não
// aparece nos campos do Docker mas `\t` é mais seguro ainda contra colisão.
const FORMATO = ['{{.ID}}', '{{.Names}}', '{{.Image}}', '{{.Status}}', '{{.Ports}}', '{{.State}}'].join('\t')

function linhaParaContainer(linha) {
  const [id, nome, imagem, status, portas, state] = linha.split('\t')
  if (!id) return null
  return {
    id,
    nome,
    imagem,
    status,
    portas: (portas || '').split(',').map((p) => p.trim()).filter(Boolean),
    rodando: state === 'running',
  }
}

/**
 * `null` quando o Docker não está instalado ou o daemon não está de pé —
 * os dois casos fazem `docker ps` falhar do mesmo jeito, e não dá pra
 * distinguir sem mais uma chamada. A tela trata os dois como "sem Docker
 * aqui" e some o bloco, em vez de mostrar erro pra quem nunca instalou.
 */
/* CC-1031, medido em 09/10 depois de religar: a montagem do dado principal esperava o `docker ps`, que levou de 0,5 s a
   6 s com a máquina carregada. A lista de containers quase não muda, então a leitura devolve na hora a última (de até
   5 min) e atualiza por trás quando passou de CACHE_MS. Só a primeira leitura, sem nada guardado, espera. */
const VELHO_MS = 5 * 60 * 1000
let atualizando = null
export async function listarContainers({ force = false } = {}) {
  const agora = Date.now()
  if (!force && cache.containers && agora - cache.at < CACHE_MS) return cache
  if (!force && cache.containers && agora - cache.at < VELHO_MS) {
    if (!atualizando) atualizando = lerContainers().catch(() => {}).finally(() => { atualizando = null })
    return cache
  }
  return lerContainers()
}
async function lerContainers() {
  const agora = Date.now()
  const r = await quietAsync('docker', ['ps', '-a', '--format', FORMATO], 8000)
  if (!r.ok) {
    cache = { at: agora, containers: null, disponivel: false }
    return cache
  }
  const containers = r.out.split('\n').map((l) => l.trim()).filter(Boolean)
    .map(linhaParaContainer).filter(Boolean)
  cache = { at: agora, containers, disponivel: true }
  return cache
}
