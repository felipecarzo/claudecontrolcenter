/**
 * O que a sessão FEZ, lido do transcrito, sem ela precisar contar.
 *
 * ## Por que existe
 *
 * Medido em 11/09, nas duas fontes: **13 das 18 sessões desta máquina não
 * reportam nada** ao painel. As cinco que reportam são todas de background; as
 * treze mudas são todas interativas, que é onde ele passa o dia. A causa é de
 * desenho: `cc set` descobre o job pelo ambiente (`CLAUDE_JOB_DIR`), e sessão
 * interativa não tem isso, então o protocolo inteiro depende do agente lembrar
 * de rodar um comando que na maior parte das vezes nem funciona.
 *
 * Queixa dele que nomeia o problema, de 11/09:
 *
 * > *"as ias criam os documentos meio que dentro de um padrão, mas um padrão
 * > que não tem tag (…) não tem como rodar um hook ou um script que transforme
 * > isso em dado real"*
 *
 * O backlog virou dado no mesmo dia. Isto é a outra metade: **o que o agente
 * fez também vira dado**, e sai de onde já está escrito, não de relato.
 *
 * ## O princípio que decide os empates daqui
 *
 * **Só entra o que aconteceu, nunca o que foi dito.** Uma chamada de `Edit` no
 * transcrito é um arquivo que mudou; uma frase do modelo dizendo "vou editar o
 * arquivo" não é nada. A diferença é a mesma entre `cc done` e `cc done
 * --prova`, e é o motivo de este módulo não ler texto do assistente.
 *
 * ## O custo, e por que ele cabe
 *
 * Transcrito passa de 25 MB, e ler inteiro a cada tique travaria o painel (já
 * aconteceu). Aqui se lê a CAUDA, com cache por tamanho e mtime, igual ao
 * `transcript.mjs`: o arquivo que não cresceu não é relido.
 */

import fs from 'node:fs'
import path from 'node:path'

/** 256 KB: o mesmo teto do resto do projeto, e cabe umas 200 interações. */
const CAUDA = 256 * 1024
const cache = new Map()

function lerCauda(file, bytes = CAUDA) {
  const fd = fs.openSync(file, 'r')
  try {
    const { size } = fs.fstatSync(fd)
    const inicio = Math.max(0, size - bytes)
    const buf = Buffer.alloc(Math.min(bytes, size))
    fs.readSync(fd, buf, 0, buf.length, inicio)
    return { texto: buf.toString('utf8'), cortado: inicio > 0 }
  } finally { fs.closeSync(fd) }
}

/**
 * O que cada ferramenta significa em termos de FATO.
 *
 * Fora daqui de propósito: `Read`, `Grep`, `Glob` e afins. Ler arquivo não é
 * trabalho entregue, e contá-los encheria o retrato de ruído: uma sessão que
 * só investigou pareceria uma sessão que produziu.
 */
const ESCRITA = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])

/** Comandos que dizem algo sobre o estado do trabalho. */
function lerComando(cmd) {
  const c = String(cmd || '')
  if (/\bgit\s+commit\b/.test(c)) return 'commit'
  if (/\bgit\s+push\b/.test(c)) return 'push'
  if (/\bnpm\s+(run\s+)?test\b|\bnode\s+test-/.test(c)) return 'teste'
  if (/\bcc\s+(backlog|done|set)\b|cc\.mjs\s+(backlog|done|set)\b/.test(c)) return 'painel'
  return null
}

/**
 * Onde mora o transcrito de uma sessão, achado pelo id.
 *
 * Existe porque o objeto que o painel monta NÃO carrega esse caminho para
 * todo mundo: `linkScanPath` vive dentro do `state.json` dos jobs de
 * background, e `transcript` só aparece nas sessões interativas. Quem precisa
 * dos dois lados (que é o caso aqui, e é a regra do projeto desde o CC-124)
 * teria que conhecer as duas formas.
 *
 * Busca por PREFIXO, e não por nome exato: o painel mostra o id curto de oito
 * caracteres, e o arquivo tem o id inteiro.
 */
export function transcritoDe(sessionId, { casa = null } = {}) {
  const curto = String(sessionId || '').slice(0, 8)
  if (curto.length < 6) return null
  let raiz = casa
  if (!raiz) {
    const home = process.env.CC_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude')
    raiz = path.join(home, 'projects')
  }
  let pastas
  try { pastas = fs.readdirSync(raiz, { withFileTypes: true }) } catch { return null }
  for (const d of pastas) {
    if (!d.isDirectory()) continue
    const dir = path.join(raiz, d.name)
    let achado
    try { achado = fs.readdirSync(dir).find((f) => f.endsWith('.jsonl') && f.startsWith(curto)) } catch { continue }
    if (achado) return path.join(dir, achado)
  }
  return null
}

/**
 * Lê o transcrito e devolve o que a sessão fez.
 *
 * Nunca lança: sessão sem transcrito, arquivo sumido no meio da leitura ou
 * linha malformada devolvem um retrato vazio, que é a verdade ("não sei"), e
 * não um erro que derrubaria o painel inteiro.
 */
export function observar(arquivo, { raiz = null } = {}) {
  const vazio = { leu: false, arquivos: [], escritas: 0, testes: 0, commits: 0, pushes: 0, ultimaEm: null, ferramentas: 0 }
  if (!arquivo) return vazio
  let stat
  try { stat = fs.statSync(arquivo) } catch { return vazio }

  const hit = cache.get(arquivo)
  if (hit && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) return hit.retrato

  let cauda
  try { cauda = lerCauda(arquivo) } catch { return vazio }
  const linhas = cauda.texto.split('\n')
  /* A primeira linha da cauda vem cortada ao meio e nunca é JSON válido. */
  if (cauda.cortado) linhas.shift()

  const arquivos = new Map()
  let escritas = 0
  let testes = 0
  let commits = 0
  let pushes = 0
  let ferramentas = 0
  let ultimaEm = null

  for (const linha of linhas) {
    const l = linha.trim()
    if (!l || !l.includes('tool_use')) continue
    let o
    try { o = JSON.parse(l) } catch { continue }
    const blocos = o?.message?.content
    if (!Array.isArray(blocos)) continue
    const em = o.timestamp ? Date.parse(o.timestamp) : NaN

    for (const b of blocos) {
      if (b?.type !== 'tool_use') continue
      ferramentas += 1
      if (Number.isFinite(em) && (!ultimaEm || em > ultimaEm)) ultimaEm = em

      if (ESCRITA.has(b.name)) {
        escritas += 1
        const alvo = b.input?.file_path || b.input?.notebook_path
        if (alvo) {
          const rel = raiz ? path.relative(raiz, String(alvo)).split(path.sep).join('/') : String(alvo)
          /* Arquivo fora da raiz do projeto sai com `..` no começo: é edição em
             outro projeto, e contá-la aqui atribuiria trabalho ao projeto
             errado. */
          if (!rel.startsWith('..')) arquivos.set(rel, (arquivos.get(rel) || 0) + 1)
        }
        continue
      }

      if (b.name === 'Bash' || b.name === 'PowerShell') {
        const tipo = lerComando(b.input?.command)
        if (tipo === 'teste') testes += 1
        else if (tipo === 'commit') commits += 1
        else if (tipo === 'push') pushes += 1
      }
    }
  }

  const retrato = {
    leu: true,
    /* Mais mexido primeiro: é o que responde "no que essa sessão está?". */
    arquivos: [...arquivos.entries()].sort((a, b) => b[1] - a[1]).map(([caminho, vezes]) => ({ caminho, vezes })),
    escritas,
    testes,
    commits,
    pushes,
    ferramentas,
    ultimaEm,
  }
  cache.set(arquivo, { size: stat.size, mtimeMs: stat.mtimeMs, retrato })
  return retrato
}

/**
 * Uma frase do que a sessão fez, para o cartão.
 *
 * Existe porque o painel hoje mostra o ÚLTIMO PEDIDO dele como assunto quando
 * o agente não reportou, e o último pedido costuma ser "seguir" ou "ok". Isto
 * responde outra pergunta: não o que foi pedido, o que está acontecendo.
 *
 * Devolve `null` quando não há o que dizer, e quem chama mostra o que já
 * mostrava hoje.
 */
export function frase(retrato) {
  if (!retrato?.leu) return null
  const p = []
  if (retrato.arquivos.length) {
    const nomes = retrato.arquivos.slice(0, 2).map((a) => a.caminho.split('/').pop())
    p.push(`mexeu em ${nomes.join(' e ')}${retrato.arquivos.length > 2 ? ` e mais ${retrato.arquivos.length - 2}` : ''}`)
  }
  if (retrato.testes) p.push(`rodou teste ${retrato.testes}x`)
  if (retrato.commits) p.push(`${retrato.commits} commit(s)`)
  if (!p.length) return null
  const texto = p.join(', ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * A frente provável, cruzando os arquivos mexidos com o backlog em dado.
 *
 * O `cc set` pede a frente ao agente e 13 das 18 sessões nunca responderam.
 * Aqui ela é DEDUZIDA: se a sessão mexeu em `src/travas.mjs` e existe item
 * aberto cujo título ou frente cite travas, é um palpite com base.
 *
 * ⚠️ **Palpite sai marcado como palpite**, no campo `deduzido`, e quem mostra
 * na tela precisa dizer isso junto. Foi a regra que o dia inteiro de 11/09
 * pagou: número plausível sem origem é o que faz a tela perder o sentido.
 */
export function frenteProvavel(retrato, itensAbertos = []) {
  if (!retrato?.leu || !retrato.arquivos.length || !itensAbertos.length) return null
  const palavras = new Set()
  for (const a of retrato.arquivos.slice(0, 5)) {
    const base = a.caminho.split('/').pop().replace(/\.[a-z]+$/i, '').toLowerCase()
    if (base.length >= 4) palavras.add(base)
  }
  if (!palavras.size) return null

  const pontos = new Map()
  for (const i of itensAbertos) {
    const alvo = `${i.titulo || ''} ${i.frente || ''}`.toLowerCase()
    for (const p of palavras) {
      if (!alvo.includes(p)) continue
      pontos.set(i.frente, (pontos.get(i.frente) || 0) + 1)
    }
  }
  if (!pontos.size) return null
  const [frente, n] = [...pontos.entries()].sort((a, b) => b[1] - a[1])[0]
  return { frente, porque: `deduzido: ${n} item(ns) abertos da frente citam o que esta sessão está mexendo`, deduzido: true }
}
