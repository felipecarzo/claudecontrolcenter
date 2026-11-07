#!/usr/bin/env node
/**
 * CC-1072: UserPromptSubmit. Substitui o set-terminal-title.sh do PC, que dependia de bash e jq (no Windows o "bash"
 * sem caminho resolvia para o do WSL e quebrava com "execvpe(/bin/bash) failed").
 *
 * Faz o que o script fazia, em node puro:
 *   - lê o JSON do stdin e pega session_id e cwd;
 *   - acha a raiz do projeto com `git rev-parse --show-toplevel` (se não for repositório, usa o cwd);
 *   - cria <projeto>/.claude/sessions e grava o session_id em <projeto>/.claude/current-session.tmp (uma linha com \n,
 *     só quando há session_id);
 *   - grava o nome do projeto em ~/.claude/current-title.tmp (uma linha com \n; um hook do PowerShell do PC lê no
 *     próximo prompt, então o formato fica idêntico ao do .sh);
 *   - imprime só o nome do projeto e um \n no stdout (aparece na conversa como "UserPromptSubmit hook success: nome").
 *   Formato conferido com a PC_cockpit, que leu o final do .sh em 22/10.
 *
 * Em ambiente onde ~/.claude é somente leitura (sandbox da VPS) a gravação do título falha em silêncio: é só enfeite
 * de aba, nunca deve travar o pedido. Falha aberta, sempre saída 0.
 *
 * Caminho de casa: CC_HOME (quando existe) manda, igual ao resto do cockpit.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function raizDoProjeto(cwd) {
  try {
    const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', timeout: 2000 })
    const topo = r.status === 0 ? String(r.stdout).trim() : ''
    if (topo) return path.normalize(topo)
  } catch { /* sem git: cai no cwd */ }
  return cwd
}

export function titulo({ session_id: sessao, cwd } = {}, casa = process.env.CC_HOME || path.join(os.homedir(), '.claude')) {
  const base = cwd || process.cwd()
  const raiz = raizDoProjeto(base)
  const nome = path.basename(raiz)
  const gravados = []
  try {
    if (sessao) {
      const pasta = path.join(raiz, '.claude')
      fs.mkdirSync(path.join(pasta, 'sessions'), { recursive: true })
      fs.writeFileSync(path.join(pasta, 'current-session.tmp'), String(sessao) + '\n')
      gravados.push('current-session.tmp')
    }
  } catch { /* somente leitura ou sem permissão */ }
  try {
    fs.mkdirSync(casa, { recursive: true })
    fs.writeFileSync(path.join(casa, 'current-title.tmp'), nome + '\n')
    gravados.push('current-title.tmp')
  } catch { /* somente leitura ou sem permissão */ }
  return { nome, raiz, gravados }
}

// só executa quando chamado como gancho, para o teste importar as funções sem efeito colateral.
// pathToFileURL, nunca `file://` + caminho cru: o cru quebra no Windows (CLAUDE.md, armadilha nº 6 do PC-E-VPS)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let corpo = ''
    try { corpo = fs.readFileSync(0, 'utf8') } catch { /* sem stdin */ }
    let entrada = {}
    try { entrada = JSON.parse(corpo || '{}') } catch { /* JSON ruim: segue com o cwd do processo */ }
    process.stdout.write(titulo(entrada).nome + '\n')
  } catch { /* falha aberta */ }
  process.exit(0)
}
