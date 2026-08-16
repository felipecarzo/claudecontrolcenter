/**
 * Sessões INTERATIVAS do Claude Code, derivadas dos transcritos.
 *
 * Por que existe (CC-51, medido em 14/08): `jobs.mjs` só enxerga
 * `~/.claude/jobs`, e essa pasta só ganha `state.json` quando o job roda em
 * BACKGROUND. Trabalhar pelo celular via Remote Control é sessão interativa, e
 * nesta VPS não existe nenhum job de background: o painel mostrava a aba de
 * agentes vazia mesmo com uma sessão trabalhando havia horas. O painel não
 * estava errado, estava cego para metade do trabalho.
 *
 * Contrato de segurança, o mesmo do `jobs.mjs`: aqui **só se lê**. Os
 * transcritos são do Claude Code; nada neste arquivo escreve neles.
 *
 * A saída é do mesmo formato dos jobs (reusa `buildJob`), com `tipo:
 * 'interativa'`, para o resto do painel não precisar saber a diferença.
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildJob } from './jobs.mjs'
import { PROJETOS_DIR as pastaProjetos, lerMetaSessao, limparOrfaos } from './metaSessao.mjs'

// via `casaClaude()`, para o gate poder apontar tudo pra uma casa temporária
export const PROJETOS_DIR = pastaProjetos()

/** Só o que teve sinal recente. Sem isso, o PC do Felipe traria centenas de
 *  sessões mortas e o painel viraria arquivo morto em vez de "o que está
 *  acontecendo agora". */
export const JANELA_MS = 24 * 60 * 60 * 1000

/** Cabeça do arquivo: onde mora o `cwd`. Nunca muda, então o cache é eterno
 *  (mesma lição do `transcript.mjs`, onde ler 25 MB a cada 2s travava tudo). */
const CABECA_BYTES = 16 * 1024
const cacheCabeca = new Map() // arquivo -> { cwd, criadoEm, remoto }

/**
 * Lê o começo do transcrito atrás do `cwd`.
 *
 * O nome da pasta NÃO serve: `-home-claudedev-projetos-proj-controlcenter`
 * troca `/` e `_` pelo mesmo `-`, então não dá para saber se é
 * `proj_controlcenter` ou `proj/controlcenter`. O caminho de verdade está
 * dentro do arquivo, nas linhas que carregam `cwd`.
 */
export function cabecaDe(arquivo) {
  const emCache = cacheCabeca.get(arquivo)
  if (emCache) return emCache

  let texto = ''
  try {
    const fd = fs.openSync(arquivo, 'r')
    try {
      const buf = Buffer.alloc(CABECA_BYTES)
      const lidos = fs.readSync(fd, buf, 0, CABECA_BYTES, 0)
      texto = buf.subarray(0, lidos).toString('utf8')
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }

  let cwd = null
  let criadoEm = null
  let remoto = false
  for (const linha of texto.split('\n')) {
    if (!linha.trim()) continue
    let o = null
    try { o = JSON.parse(linha) } catch { continue } // última linha vem cortada
    // `bridge-session` é o marcador de Remote Control: a sessão está sendo
    // pilotada de fora (celular, claude.ai), não de um terminal desta máquina.
    if (o.type === 'bridge-session') remoto = true
    if (!cwd && typeof o.cwd === 'string' && o.cwd) cwd = o.cwd
    if (!criadoEm && o.timestamp) criadoEm = Date.parse(o.timestamp) || null
    if (cwd && criadoEm) break
  }

  if (!cwd) return null
  const achado = { cwd, criadoEm, remoto }
  cacheCabeca.set(arquivo, achado)
  return achado
}

/**
 * Status de sessão interativa, que é diferente do de job.
 *
 * Job tem `state.fan` para dizer se há ferramenta rodando. Aqui o único sinal
 * é o arquivo crescer. A leitura segue a mesma lógica já registrada para os
 * jobs: escrevendo agora está trabalhando; parou há pouco, acabou de responder
 * e espera o Felipe; parou há muito, está ociosa.
 */
export function statusDe(idadeMs) {
  if (idadeMs < 60 * 1000) return 'working'
  if (idadeMs < 30 * 60 * 1000) return 'waiting'
  return 'idle'
}

const arquivosEm = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.jsonl'))
      .map((d) => path.join(dir, d.name))
  } catch {
    return []
  }
}

const pastasEm = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(dir, d.name))
  } catch {
    return []
  }
}

/**
 * As sessões interativas com sinal dentro da janela.
 *
 * `ignorar` recebe os ids que já vieram como job de background: a MESMA sessão
 * pode ter transcrito e job, e aí apareceria duas vezes na tela.
 */
export function readSessoes(now = Date.now(), { janelaMs = JANELA_MS, ignorar = [] } = {}) {
  const jaVistos = new Set(ignorar.filter(Boolean))
  const sessoes = []

  for (const pasta of pastasEm(PROJETOS_DIR)) {
    for (const arquivo of arquivosEm(pasta)) {
      let st = null
      try { st = fs.statSync(arquivo) } catch { continue }
      const atualizado = st.mtimeMs
      if (now - atualizado > janelaMs) continue

      const sessionId = path.basename(arquivo, '.jsonl')
      const curto = sessionId.slice(0, 8)
      if (jaVistos.has(sessionId) || jaVistos.has(curto)) continue

      const cabeca = cabecaDe(arquivo)
      if (!cabeca) continue // transcrito sem cwd: não dá pra dizer de que projeto é

      const idade = now - atualizado
      // Estado sintético no formato que `buildJob` espera. Reusar ele é o que
      // faz a sessão interativa cair no resto do painel (cockpit, filtros,
      // ordenação) sem nenhum caso especial espalhado por aí.
      const state = {
        sessionId,
        cwd: cabeca.cwd,
        createdAt: new Date(cabeca.criadoEm || atualizado).toISOString(),
        updatedAt: new Date(atualizado).toISOString(),
        linkScanPath: arquivo,
        state: statusDe(idade),
        fan: [],
        tokens: 0,
      }

      /* CC-56: a sessão agora pode reportar o próprio estado, e ele entra aqui
         como o `meta` que o job de background sempre teve. É o que faz to-do,
         frente e bloqueio aparecerem iguais nos dois tipos de linha — sem isso
         o painel enxergava a sessão mas ela não tinha voz. */
      const job = buildJob(curto, state, lerMetaSessao(sessionId), [], now)
      sessoes.push({
        ...job,
        // O que a tela precisa para não mentir sobre o que é cada linha.
        tipo: 'interativa',
        remoto: cabeca.remoto,
        // Sessão interativa não tem contagem de token barata: o total exigiria
        // parsear o transcrito inteiro, que é trabalho da aba tempo. Melhor
        // dizer que não se sabe do que mostrar zero como se fosse medida.
        tokens: null,
        transcript: arquivo,
      })
    }
  }

  return sessoes.sort((a, b) => b.updatedAt - a.updatedAt)
}
