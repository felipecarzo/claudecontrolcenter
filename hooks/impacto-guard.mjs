#!/usr/bin/env node
/**
 * impacto-guard — a trava de ação escolhida por ele em 23/08.
 *
 * Barra renomear/mover/apagar uma PASTA DE PROJETO INTEIRA (filha direta de
 * `~/projetos`) enquanto a varredura de impacto não tiver rodado há pouco. O
 * estrago do dia 23/08 aconteceu na AÇÃO, não na frase "não quebra nada", então
 * é a ação que esta trava segura.
 *
 * Roda como hook PreToolUse do Bash. Recebe no stdin o JSON do Claude Code com
 * `tool_name` e `tool_input.command`. Sai com código 2 (bloqueia e devolve o
 * texto ao modelo) quando o comando mexe numa pasta de projeto e o carimbo da
 * varredura está ausente ou velho.
 *
 * O carimbo é `~/.local/share/agent-cockpit/impacto-ok.json`, gravado por
 * `node varredura-impacto.mjs --marca`. Vale por 15 minutos: tempo de varrer,
 * ler e agir, sem virar salvo-conduto para a tarde inteira.
 *
 * Falha ABERTA em erro próprio (stdin ilegível, etc.): travar por bug do
 * próprio guarda é o jeito mais rápido de ser desligado. O que ele barra é só o
 * caso claro; na dúvida, deixa passar.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const VALIDADE_MS = 15 * 60 * 1000
const HOME = os.homedir()
const BASE = path.join(HOME, 'projetos')

function sair(codigo, msg) {
  if (msg) process.stderr.write(msg + '\n')
  process.exit(codigo)
}

let entrada = ''
try { entrada = fs.readFileSync(0, 'utf8') } catch { sair(0) }

let cmd = ''
try {
  const j = JSON.parse(entrada)
  if ((j.tool_name || j.toolName) !== 'Bash') sair(0)
  cmd = String(j.tool_input?.command ?? j.toolInput?.command ?? '')
} catch { sair(0) }
if (!cmd.trim()) sair(0)

// Só olha comandos que MOVEM ou APAGAM. Copiar, listar, ler não entram.
if (!/\b(mv|rm|rmdir|rename)\b/.test(cmd)) sair(0)

/* Uma pasta de PROJETO é filha direta de ~/projetos: um segmento só depois da
   base. `~/projetos/inovallbond` conta; `~/projetos/inovallbond/apps/x` não é o
   projeto, é dentro dele, e mover lá não quebra ponteiro de fora. Aceita `~`,
   `$HOME` e o caminho absoluto. */
const basesTxt = [BASE, '~/projetos', '$HOME/projetos'].map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const reProjeto = new RegExp('(?:' + basesTxt.join('|') + ')/([A-Za-z0-9._-]+)(?![A-Za-z0-9._/-])', 'g')

const projetos = new Set()
let m
while ((m = reProjeto.exec(cmd)) !== null) projetos.add(m[1])
if (projetos.size === 0) sair(0) // mexe em projetos/ mas não numa pasta de projeto inteira

// Carimbo fresco? Então libera.
const carimbo = path.join(HOME, '.local/share/agent-cockpit/impacto-ok.json')
try {
  const c = JSON.parse(fs.readFileSync(carimbo, 'utf8'))
  if (c && typeof c.em === 'number' && (Date.now() - c.em) < VALIDADE_MS) sair(0)
} catch { /* sem carimbo: cai na trava abaixo */ }

sair(2,
  `TRAVA DE IMPACTO: renomear/mover/apagar pasta de projeto sem varrer antes.\n\n`
  + `  pasta(s) de projeto no comando: ${[...projetos].join(', ')}\n\n`
  + `Em 23/08 renomear as pastas foi dito como "não quebra nada" e quebrou o venv\n`
  + `de dois projetos, uma dependência cruzada e quatro conversas do painel. O que\n`
  + `guarda caminho absoluto por dentro não segue a pasta, e falha calado depois.\n\n`
  + `Antes de mexer, rode a varredura e AJA no que ela achar:\n\n`
  + `    node varredura-impacto.mjs --marca\n\n`
  + `Ela lista todo ponteiro que aponta para uma pasta que vai deixar de existir\n`
  + `(venv, serviço do sistema, link do npm, atalho de shell, cópia do git, conversa\n`
  + `do painel, script solto), e grava o carimbo que libera esta trava por 15 min.\n\n`
  + `Depois de renomear, rode de novo SEM --marca e conserte o que ela apontar.\n`
  + `Só então diga a ele se quebrou ou não, com as duas metades: o que conferiu e\n`
  + `o que NÃO conseguiu descartar.`)
