#!/usr/bin/env node
/**
 * CC-1045, os guardas do fim de resposta num processo só.
 *
 * Eram 31 ganchos de `Stop` no settings, e o Claude Code roda todos juntos ao
 * fim de cada resposta: 31 processos Node nascendo ao mesmo tempo em 6 núcleos,
 * cada um carregando os mesmos módulos de `src/`. Sozinho, cada guarda leva 0,17
 * a 0,8 s; juntos, ~4,3 s cada, e a mediana da espera era 5,7 s.
 *
 * Aqui eles rodam em sequência, no mesmo processo, e os módulos de `src/` ficam
 * em cache de um para o outro. Nenhum guarda muda: para cada um, este programa
 * monta o ambiente que ele teria sozinho.
 *
 *   - `readFileSync(0)` devolve a entrada, lida UMA vez aqui;
 *   - `process.exit(n)` vira um sinal que encerra só aquele guarda com o código n;
 *   - stdout e stderr (e `console.*`, que escreve neles) vão para a conta dele;
 *   - `process.argv[1]` aponta para ele, porque dois guardas (copiar e ideia) só
 *     rodam quando são o programa principal.
 *
 * O resultado se junta como o Claude Code juntaria ganchos separados: algum
 * barrou (código 2), sai 2 com o stderr dos que barraram, cada um com o nome em
 * cabeçalho. O catálogo continua valendo por guarda: cada um ainda pergunta ao
 * catálogo se está ligado, e este programa não consulta nada lá.
 *
 * A prova de que nada mudou é `test-parada.mjs`: cada guarda sozinho contra o
 * mesmo guarda aqui dentro, em entradas reais, tem de dar código e texto iguais.
 */
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))

/** A ordem é a do settings em 12/10. Caminho relativo a `hooks/`, sem `.mjs`. */
export const GUARDAS = [
  'routia/todo-guard', 'routia/routia-fim', 'roadmap-guard', 'estilo-fim', 'pergunta-guard',
  'gate-guard', 'fluxo-guard', 'guia-guard', 'bancada-guard', 'reporte-guard', 'pronto-guard',
  'jargao-guard', 'resumo-guard', 'fila-guard', 'tarefa-vaga-guard', 'referencia-guard',
  'forma-guard', 'enfileirada-guard', 'teto-guard', 'travessao-guard', 'visual-guard',
  'descida-guard', 'medir-guard', 'diario-guard', 'sincronia-guard', 'tarefas-fim',
  'quadro-guard', 'copiar-guard', 'onde-guard', 'fala-guard', 'ideia-guard',
]

/** Guardas que não cabem no mesmo processo e continuam registrados sozinhos. */
export const SOZINHOS = [
  // { nome, motivo }. Vazio em 12/10: os 31 passaram no teste de equivalência.
]

const TETO_MS = 8000

/**
 * Junta os resultados como o Claude Code juntaria ganchos separados.
 * Exportada para o teste montar o esperado a partir dos guardas sozinhos.
 */
export function juntar(resultados) {
  const barraram = resultados.filter((r) => r.codigo === 2)
  const saidas = resultados.map((r) => r.stdout).filter((s) => s && s.trim())
  if (!barraram.length) {
    return {
      codigo: 0,
      stdout: saidas.join('\n'),
      stderr: resultados.map((r) => r.stderr).filter(Boolean).join(''),
    }
  }
  const motivo = barraram.map((r) => `[${r.nome}]\n${r.stderr.trimEnd()}`).join('\n\n')
  if (!saidas.length) return { codigo: 2, stdout: '', stderr: `${motivo}\n` }
  /* Com saída 2 o Claude Code não lê o JSON do stdout, e o aviso que ia para a
     tela dele (o `systemMessage` do routia-fim) se perderia. Separados, os dois
     chegavam. A forma JSON do mesmo bloqueio leva os dois juntos. */
  const avisos = []
  for (const s of saidas) {
    try { const j = JSON.parse(s); if (j?.systemMessage) avisos.push(j.systemMessage) } catch { avisos.push(s.trim()) }
  }
  const json = { decision: 'block', reason: motivo }
  if (avisos.length) json.systemMessage = avisos.join('\n')
  return { codigo: 0, stdout: JSON.stringify(json), stderr: '' }
}

class Saida { constructor(codigo) { this.codigo = codigo } }
class Cortado {}

/** Roda os guardas em sequência, cada um no ambiente que teria sozinho. */
export async function rodarGuardas(entrada, lista = GUARDAS) {
  /* O transcrito da entrada é lido inteiro por quase todo guarda
     (`readFileSync(arquivo, 'utf8').slice(-N)`). Numa conversa de 82 MB isso
     custava ~1,3 s POR guarda, e em sequência somava 14 s: a leitura sai uma
     vez e as outras recebem o mesmo texto. Só esse arquivo, só como texto. */
  let transcrito = null
  try { transcrito = JSON.parse(entrada)?.transcript_path || null } catch { /* sem entrada */ }
  let textoTranscrito = null
  const lerOriginal = fs.readFileSync
  fs.readFileSync = function (alvo, opcoes) {
    const cod = typeof opcoes === 'string' ? opcoes : opcoes?.encoding
    if (alvo === 0 || alvo === '/dev/stdin') return cod ? entrada : Buffer.from(entrada)
    if (transcrito && alvo === transcrito && /^utf-?8$/i.test(cod || '')) {
      return (textoTranscrito ??= lerOriginal.apply(this, arguments))
    }
    return lerOriginal.apply(this, arguments)
  }
  syncBuiltinESMExports()

  const sairOriginal = process.exit
  process.exit = (codigo) => { throw new Saida(codigo ?? process.exitCode ?? 0) }

  let atual = null
  const desviar = (stream, campo) => {
    const original = stream.write
    stream.write = function (pedaco, cod, cb) {
      if (!atual) return original.apply(this, arguments)
      atual[campo] += typeof pedaco === 'string' ? pedaco : Buffer.from(pedaco).toString()
      const fim = typeof cod === 'function' ? cod : cb
      if (typeof fim === 'function') process.nextTick(fim)
      return true
    }
    return () => { stream.write = original }
  }
  const voltaOut = desviar(process.stdout, 'stdout')
  const voltaErr = desviar(process.stderr, 'stderr')
  /* Promessa solta de um guarda que rejeita com o sinal não pode derrubar os outros. */
  const engolir = (e) => { if (!(e instanceof Saida)) throw e }
  process.on('unhandledRejection', engolir)

  const argv1 = process.argv[1]
  const resultados = []
  try {
    for (const nome of lista) {
      const arquivo = join(AQUI, `${nome}.mjs`)
      const r = { nome, codigo: 0, stdout: '', stderr: '', ms: 0 }
      process.argv[1] = arquivo
      process.exitCode = undefined
      atual = r
      const t0 = performance.now()
      let relogio
      try {
        await Promise.race([
          import(pathToFileURL(arquivo).href),
          new Promise((_, nao) => { relogio = setTimeout(() => nao(new Cortado()), TETO_MS) }),
        ])
        r.codigo = process.exitCode ?? 0
      } catch (e) {
        if (e instanceof Saida) r.codigo = Number(e.codigo) || 0
        /* ponytail: cortado só vale para espera assíncrona; um guarda preso em
           código síncrono segura o processo até o timeout do settings. */
        else if (e instanceof Cortado) r.cortado = true
        else { r.codigo = 1; r.stderr += `${e?.stack || e}\n` }
      } finally {
        clearTimeout(relogio)
        atual = null
        r.ms = Math.round(performance.now() - t0)
      }
      resultados.push(r)
    }
  } finally {
    process.argv[1] = argv1
    process.exitCode = undefined
    process.exit = sairOriginal
    voltaOut(); voltaErr()
    fs.readFileSync = lerOriginal
    syncBuiltinESMExports()
    process.off('unhandledRejection', engolir)
  }
  return resultados
}

/** Uma linha por resposta no abrigo, para a aba Hooks ver cada guarda. */
async function gravarMedidas(entrada, resultados, totalMs) {
  try {
    const { ARQUIVO_MEDIDAS_PARADA } = await import('../src/hooksMonitor.mjs')
    const arquivo = ARQUIVO_MEDIDAS_PARADA()
    let e = {}
    try { e = JSON.parse(entrada) || {} } catch { /* sem entrada */ }
    const linha = JSON.stringify({
      em: new Date().toISOString(), sessao: e.session_id || null, cwd: e.cwd || null, ms: totalMs,
      guardas: resultados.map((r) => ({ nome: r.nome, ms: r.ms, codigo: r.codigo, barrou: r.codigo === 2, ...(r.cortado ? { cortado: true } : {}) })),
    })
    fs.mkdirSync(dirname(arquivo), { recursive: true })
    /* Teto de tamanho: passou de 2 MB, a metade velha vai para `.1` (que sobrescreve a anterior). */
    try { if (fs.statSync(arquivo).size > 2e6) fs.renameSync(arquivo, `${arquivo}.1`) } catch { /* não existe ainda */ }
    fs.appendFileSync(arquivo, `${linha}\n`)
  } catch { /* medida é extra: sem lugar para gravar, os guardas valem igual */ }
}

const principal = (() => {
  try { return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url) } catch { return false }
})()

if (principal) {
  const t0 = performance.now()
  let entrada = ''
  try { entrada = fs.readFileSync(0, 'utf8') } catch { /* sem entrada: cada guarda decide */ }
  const resultados = await rodarGuardas(entrada)
  const total = Math.round(performance.now() - t0)
  await gravarMedidas(entrada, resultados, total)
  if (process.env.PARADA_DETALHE) {
    try { fs.writeFileSync(process.env.PARADA_DETALHE, JSON.stringify(resultados)) } catch { /* só o teste pede */ }
  }
  const { codigo, stdout, stderr } = juntar(resultados)
  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)
  /* Sai explícito: promessa solta de algum guarda não segura o fim da resposta. */
  process.exit(codigo)
}
