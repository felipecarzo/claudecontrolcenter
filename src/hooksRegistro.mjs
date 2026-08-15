// Confere e (desde 15/08) TAMBÉM registra hook do catálogo no settings.json do
// Claude Code. Nasceu só de leitura; o CC-67 acrescentou a escrita.
//
// Só leitura: confere se um hook do catálogo está de fato registrado no
// settings.json do Claude Code. Existe pra o toggle do painel nunca mentir —
// ligar um hook que não está registrado em lugar nenhum não faz nada, e sem
// isso ninguém saberia por quê.
//
// Parser tolerante, mesmo espírito de `roadmap.mjs`: documento vivo, o
// settings.json do Felipe já tem ~200 linhas e cresce com outros sistemas
// dele (pixel-agents) — um campo a mais não pode quebrar a leitura.

import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

// via `casaClaude()`: o gate precisa apontar isto para uma casa temporária, e
// escrever no settings.json de verdade num teste seria repetir o erro das notas
export const SETTINGS_FILE = path.join(casaClaude(), 'settings.json')

export function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
  } catch {
    return null // arquivo ausente ou JSON quebrado: nenhum hook está registrado, do ponto de vista de quem lê
  }
}

/**
 * `registradoVia` existe pra hook que não tem script próprio no settings.json
 * — `cc-check` vive dentro de `cc.mjs` e quem está lá é `todo-guard.mjs`, que
 * o chama por dentro. Procurar "cc.mjs" no settings.json nunca acharia nada.
 */
export function registrado(hook, settings = readSettings()) {
  const alvo = hook.registradoVia || hook.script
  const grupos = settings?.hooks?.[hook.evento]
  if (!alvo || !Array.isArray(grupos)) return false
  return grupos.some((grupo) =>
    (grupo.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes(alvo)))
}

export function registradoTodos(hooks, settings = readSettings()) {
  return Object.fromEntries(hooks.map((h) => [h.id, registrado(h, settings)]))
}


/* ============================ CC-67: escrever ============================
   O husky resolveu isto no mundo do git há anos: gancho não é versionado, então
   cada máquina teria que instalar à mão. Aqui é pior — o `settings.json` é
   global e o caminho muda de máquina (`D:/...` no PC dele, `/home/...` aqui).

   Prova de que doía: em 15/08 três hooks ficaram esperando ele registrar à mão
   no PC, e enquanto isso o padrão de resposta valia só na VPS. */

import { fileURLToPath } from 'node:url'

/** A pasta `hooks/` deste repositório, na máquina em que o comando roda.
 *  Derivada do próprio arquivo: fixar caminho aqui quebraria no PC. */
export const pastaHooks = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks')

/**
 * O comando que vai para o settings.json.
 *
 * Barra normal mesmo no Windows: o Node aceita, e barra invertida dentro de
 * JSON exige escape duplo — que já quebrou o `.lnk` do Desktop uma vez, em
 * silêncio (armadilha registrada no CLAUDE.md).
 */
export function comandoDe(hook, base = pastaHooks()) {
  const alvo = hook.registradoVia || hook.script
  if (!alvo) return null
  const achado = [alvo, path.join('routia', alvo)]
    .map((rel) => path.join(base, rel))
    .find((cheio) => fs.existsSync(cheio))
  return achado ? `node ${achado.split(path.sep).join('/')}` : null
}

/**
 * Registra os hooks que faltam. **Merge, nunca substituição.**
 *
 * O `settings.json` do Felipe tem ~200 linhas e é compartilhado com outros
 * sistemas dele (o pixel-agents registra em 11 eventos). Trocar a lista de um
 * evento apagaria os hooks de terceiros sem aviso — é o mesmo cuidado que o
 * `install.mjs` tem com o CLAUDE.md.
 *
 * Faz cópia antes de gravar, pela mesma razão de `notes.mjs`: arquivo que o
 * usuário edita à mão e que não tem outra fonte.
 */
export function instalar(hooks, { dryRun = false } = {}) {
  const settings = readSettings()
  if (!settings) {
    return { ok: false, erro: `não consegui ler ${SETTINGS_FILE} — arquivo ausente ou JSON quebrado` }
  }

  const feitos = []
  for (const hook of hooks) {
    if (registrado(hook, settings)) { feitos.push({ id: hook.id, acao: 'já estava' }); continue }
    const comando = comandoDe(hook)
    if (!comando) { feitos.push({ id: hook.id, acao: 'sem script neste repositório' }); continue }

    settings.hooks ??= {}
    settings.hooks[hook.evento] ??= []
    settings.hooks[hook.evento].push({ hooks: [{ type: 'command', command: comando }] })
    feitos.push({ id: hook.id, acao: 'registrado', evento: hook.evento, comando })
  }

  const mudou = feitos.filter((f) => f.acao === 'registrado')
  if (dryRun || !mudou.length) return { ok: true, feitos, gravou: false }

  try {
    // cópia antes de sobrescrever: o arquivo é editado à mão e não tem backup
    try { fs.copyFileSync(SETTINGS_FILE, `${SETTINGS_FILE}.bak`) } catch { /* segue */ }
    const texto = JSON.stringify(settings, null, 2)
    JSON.parse(texto) // conferência antes de gravar: settings quebrado desliga TUDO
    const tmp = `${SETTINGS_FILE}.tmp`
    fs.writeFileSync(tmp, `${texto}\n`)
    fs.renameSync(tmp, SETTINGS_FILE)
  } catch (e) {
    return { ok: false, erro: String(e.message || e), feitos }
  }
  return { ok: true, feitos, gravou: true, backup: `${SETTINGS_FILE}.bak` }
}
