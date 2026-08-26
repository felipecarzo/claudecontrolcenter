#!/usr/bin/env node
/**
 * Gancho de PreToolUse (Bash): trava renomear/mover/apagar pasta de projeto até
 * a varredura de impacto ter rodado para ela nesta sessão.
 *
 * Nasceu do estrago de 23/08 e da regra que ele escreveu depois: *"precisamos
 * repensar uma regra de hooks que assegure que isso seja verificado de fato"*.
 * Escolha dele em 26/08 entre três: **travar a AÇÃO até eu investigar**. O
 * estrago mora na ação (renomear a pasta), não na frase, então travar a ação
 * protege mais que corrigir a resposta.
 *
 * Como funciona: lê o comando do stdin. Se ele renomeia, move ou apaga uma pasta
 * de projeto (`~/projetos/<algo>`), exige que `impacto-scan.mjs` tenha rodado
 * para AQUELA pasta há pouco (o scan deixa um marcador com o nome dela). Sem o
 * marcador, barra com `exit 2` e manda rodar a varredura primeiro.
 *
 * Nunca barra o que não é pasta de projeto: mover um arquivo, um `rm` de arquivo
 * solto, nada disso passa por aqui. Só o gesto que já quebrou de verdade.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = os.homedir()
const RAIZ_PROJETOS = path.join(home, 'projetos')
const VALIDADE_MS = 2 * 60 * 60 * 1000 // a varredura vale por 2h; depois cobra de novo

let entrada = ''
try { entrada = fs.readFileSync(0, 'utf8') } catch { process.exit(0) }
let evento = {}
try { evento = JSON.parse(entrada || '{}') } catch { process.exit(0) }
const comando = String(evento?.tool_input?.command || '')
if (!comando) process.exit(0)

function ehPastaProjeto(p) {
  try { return fs.statSync(p).isDirectory() && path.dirname(p) === RAIZ_PROJETOS } catch { return false }
}

/** Um token de caminho vira a pasta de projeto que ele aponta, ou `null`. Cobre
 *  `~/projetos/X`, `/home/…/projetos/X`, `projetos/X` e o nome nu `X` (resolvido
 *  contra o cwd do comando). Só conta quando é pasta direta de `~/projetos`. */
function resolverProjeto(tok, cwd) {
  let t = tok.replace(/^['"]|['"]$/g, '')
  if (!t || t.startsWith('-')) return null
  if (t.startsWith('~/')) t = path.join(home, t.slice(2))
  let abs
  if (path.isAbsolute(t)) abs = t
  else if (t.startsWith('projetos/')) abs = path.join(home, t)
  else abs = path.resolve(cwd || home, t)
  return ehPastaProjeto(abs) ? abs : null
}

/* As pastas de projeto que o comando REALMENTE renomeia, move ou apaga.
 *
 * Precisão é tudo aqui: a primeira versão barrou o próprio `git commit` porque a
 * MENSAGEM mencionava "mv/rm", lidos como se fossem comando. Agora:
 *  1. o corpo de heredoc é descartado (só o que vem ANTES de `<<` é comando);
 *  2. o comando é quebrado em segmentos por `; && || |` e quebra de linha;
 *  3. um segmento só conta se COMEÇA com `mv`, `rm -r`, `rmdir` ou `git mv`,
 *     depois de descontar variáveis de ambiente na frente.
 * Assim, `mv` dentro de aspas ou de mensagem nunca dispara. */
function pastasDeProjetoTocadas(cmd, cwd) {
  const semHeredoc = cmd.split(/<<-?\s*['"]?[A-Za-z_]\w*/)[0]
  const achadas = new Set()
  for (let seg of semHeredoc.split(/\n|;|&&|\|\||\|/)) {
    seg = seg.trim().replace(/^(?:[A-Za-z_]\w*=\S+\s+)+/, '') // tira VAR=val na frente
    const ehMv = /^mv\s/.test(seg)
    const ehRmR = /^rm\s+-\S*r/.test(seg) || /^rm\s+(?:-\S+\s+)*-\S*r/.test(seg) || /^rm\s+--recursive\b/.test(seg)
    const ehRmdir = /^rmdir\s/.test(seg)
    const ehGitMv = /^git\s+mv\s/.test(seg)
    if (!(ehMv || ehRmR || ehRmdir || ehGitMv)) continue
    const args = seg.split(/\s+/).slice(ehGitMv ? 2 : 1)
    for (const tok of args) {
      const p = resolverProjeto(tok, cwd)
      if (p) achadas.add(p)
    }
  }
  return [...achadas]
}

function varreduraRecente(p) {
  try {
    const f = path.join(home, '.cache', 'agent-cockpit', 'impacto', encodeURIComponent(path.basename(p)))
    const dados = JSON.parse(fs.readFileSync(f, 'utf8'))
    return dados.alvo === p && (Date.now() - dados.quando) < VALIDADE_MS
  } catch { return false }
}

const pastas = pastasDeProjetoTocadas(comando, evento?.cwd)
const semVarredura = pastas.filter((p) => !varreduraRecente(p))
if (!semVarredura.length) process.exit(0) // nada de projeto, ou já varrido: libera

const lista = semVarredura.map((p) => `  node hooks/impacto-scan.mjs ${p}`).join('\n')
process.stderr.write(
  `AÇÃO TRAVADA: renomear/mover/apagar pasta de projeto sem varredura de impacto.\n\n`
  + `Em 23/08 um "não quebra nada" de checagem parcial quebrou o venv de dois projetos, `
  + `uma instalação cruzada e as conversas do painel. A pasta guarda o caminho absoluto `
  + `em lugares que não aparecem olhando nginx, porta e config.\n\n`
  + `Rode a varredura de cada pasta ANTES, e leia o que ela achar:\n${lista}\n\n`
  + `Depois responda em DUAS partes: o que verifiquei COM prova, e o que NÃO consegui `
  + `descartar. Só então repita o comando.\n`,
)
process.exit(2)
