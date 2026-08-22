#!/usr/bin/env node
/**
 * Boa prática pedida pelo Felipe em 18/08: *"seria bom termos isso como boa
 * prática, usando hook, não gate"*, depois de perguntar se os consertos
 * ficam anotados em algum lugar. A resposta já era sim (ROADMAP e diário),
 * mas só porque eu lembrava. Isto tira a memória da equação.
 *
 * `Stop`, mesmo evento do `roadmap-guard` e pelo mesmo motivo: bloquear no
 * fim do turno criaria laço (para escrever o diário eu preciso terminar o
 * turno). Então avisa, e quem decide é quem lê.
 *
 * O sinal: o turno editou código (fora de `docs/`) e não tocou no diário de
 * hoje. Não distingue "foi conserto" de "foi funcionalidade nova", a
 * convenção deste projeto já pede diário pros dois, não só pro conserto.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança ERR_UNSUPPORTED_ESM_URL_SCHEME, e como quase toda chamada aqui
   está dentro de um `.catch`, o módulo some sem erro visível: foi assim que
   o interruptor de módulos deixou de valer em 31 hooks, sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const liberar = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { liberar() }
if (dados?.stop_hook_active) liberar()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('diario-guard')) liberar()

/** Sobe a árvore procurando `docs/diario`. Projeto sem a pasta passa direto,
 *  a convenção é opt-in, do jeito que o resto do projeto já trata `docs/`. */
function acharDocs(dir) {
  let atual = resolve(dir || process.cwd())
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(atual, 'docs', 'diario'))) return join(atual, 'docs')
    const pai = dirname(atual)
    if (pai === atual) return null
    atual = pai
  }
  return null
}

const docsDir = acharDocs(dados?.cwd)
if (!docsDir) liberar()
const raiz = dirname(docsDir)

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) liberar()

let cauda = ''
try { cauda = readFileSync(arquivo, 'utf8').slice(-160_000) } catch { liberar() }

/* Mesmo corte do `fluxo-guard`: tudo depois da última mensagem de gente. */
const corte = cauda.lastIndexOf('"type":"user"')
const turno = corte >= 0 ? cauda.slice(corte) : cauda

/* Os `file_path` (Edit/Write/MultiEdit) e `notebook_path` (NotebookEdit)
   citados no turno. Regex sobre o texto bruto do `.jsonl`, no mesmo espírito
   das outras travas que leem transcrito sem fazer parse de linha por linha,
   mais barato, e o pior caso é um falso negativo (não avisa), nunca travar. */
const RE_ALVO = /"(?:file_path|notebook_path)"\s*:\s*"((?:[^"\\]|\\.)*)"/g
const alvos = new Set()
for (const m of turno.matchAll(RE_ALVO)) {
  try { alvos.add(JSON.parse(`"${m[1]}"`)) } catch { /* aspas quebradas: ignora este alvo */ }
}
if (!alvos.size) liberar()

const relativos = [...alvos]
  .map((a) => { try { return resolve(a).slice(raiz.length + 1).split('\\').join('/') } catch { return '' } })
  .filter(Boolean)

const forDoDocs = relativos.filter((r) => !r.startsWith('docs/'))
if (!forDoDocs.length) liberar() // turno só mexeu em docs/: nada de código para registrar

const hoje = new Date().toISOString().slice(0, 10)
const diarioDeHoje = `docs/diario/${hoje}.md`
if (relativos.includes(diarioDeHoje)) liberar() // já registrado neste mesmo turno

process.stderr.write(
  `CÓDIGO MEXIDO SEM PASSAR PELO DIÁRIO, ${forDoDocs.length} arquivo(s) fora de docs/ neste turno:\n\n`
  + forDoDocs.slice(0, 6).map((r) => `  · ${r}`).join('\n')
  + (forDoDocs.length > 6 ? `\n  … e mais ${forDoDocs.length - 6}` : '')
  + `\n\n${diarioDeHoje} não foi tocado neste turno.\n\n`
  + 'Não trava, o fim do turno é exatamente quando o diário se escreve, e '
  + 'travar aqui criaria laço. Só avisa: se o que mudou vale registro, este é '
  + 'o lugar; se já foi registrado em turno anterior do mesmo dia, ignore.\n',
)
process.exit(0)
