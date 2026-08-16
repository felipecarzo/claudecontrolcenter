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

    /* Um hook pode precisar de mais de um evento, e o `travessao-guard` é o
       primeiro: a regra vale para a resposta na tela E para o texto que entra
       em arquivo. Sem isto ele nasceu cobrindo só metade, e o instalador
       reportou "registrado" como se estivesse inteiro — que é o tipo de meia
       verdade que este projeto passou o dia consertando. */
    for (const extra of hook.tambemEm || []) {
      const [ev, matcher] = String(extra).split(':')
      settings.hooks[ev] ??= []
      const grupo = { ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: comando }] }
      settings.hooks[ev].push(grupo)
    }

    const eventos = [hook.evento, ...(hook.tambemEm || [])].join(' + ')
    feitos.push({ id: hook.id, acao: 'registrado', evento: eventos, comando })
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


/* ======================= CC-72: `cc hooks sync` =======================
   O CC-65 versionou os hooks globais e deixou dito em negrito que é **cópia,
   não fonte**: mexer no repositório não muda o que roda. Isso é uma armadilha
   esperando alguém — exatamente o formato das 22 rotinas desatualizadas que o
   CC-42 encontrou em 5 projetos.

   `rotinas.mjs` já resolve esse mesmo problema para os comandos `/algo`
   copiados dentro dos projetos, incluindo a normalização de CRLF que custou
   tempo lá. Aqui a comparação é a mesma ideia, sem a parte de projeto. */

/** CRLF não é diferença de conteúdo. Foi o que enganou a comparação de rotinas
 *  no CC-42: arquivo igual acusava divergência só por causa do fim de linha. */
const normalizar = (t) => String(t).replace(/\r\n/g, '\n').trimEnd()

/** O comando com que aquele hook está de fato registrado, se estiver. */
function comandoRegistradoDe(hook, settings = readSettings()) {
  const alvo = hook.registradoVia || hook.script
  for (const grupo of settings?.hooks?.[hook.evento] || []) {
    for (const h of grupo.hooks || []) {
      if (typeof h.command === 'string' && alvo && h.command.includes(alvo)) return h.command
    }
  }
  return null
}

/** Onde o hook instalado mora — a casa do Claude Code, não o repositório. */
export const pastaInstalada = () => path.join(casaClaude(), 'hooks')

/**
 * Compara cada hook do repositório com o que está instalado.
 *
 * Três respostas possíveis, e a terceira é a que mais importa: `divergente`
 * quer dizer que **o que roda não é o que está versionado**, e ninguém saberia.
 */
export function comparar(hooks = []) {
  const base = pastaHooks()
  const instalada = pastaInstalada()
  return hooks.map((h) => {
    const alvo = h.script
    if (!alvo) return { id: h.id, estado: 'sem script' }

    const noRepo = [alvo, path.join('routia', alvo)]
      .map((rel) => path.join(base, rel))
      .find((c) => fs.existsSync(c))
    const instalado = path.join(instalada, alvo)

    /* Se o settings.json aponta para o ARQUIVO DO REPOSITÓRIO, não há cópia a
       manter: o que roda já é o versionado, que é o ideal. Sem esta checagem o
       comparador mandava copiar `estilo-inicio` para `~/.claude/hooks`, criando
       justamente a segunda cópia que este comando existe para evitar. */
    const registrado = comandoRegistradoDe(h)
    if (noRepo && registrado && registrado.includes(noRepo.split(path.sep).join('/'))) {
      return { id: h.id, estado: 'roda do repositório', noRepo }
    }

    if (!noRepo) return { id: h.id, estado: 'só instalado', instalado }
    if (!fs.existsSync(instalado)) return { id: h.id, estado: 'só no repositório', noRepo }

    try {
      const igual = normalizar(fs.readFileSync(noRepo, 'utf8')) === normalizar(fs.readFileSync(instalado, 'utf8'))
      return { id: h.id, estado: igual ? 'igual' : 'divergente', noRepo, instalado }
    } catch (e) {
      return { id: h.id, estado: 'erro', erro: String(e.message || e) }
    }
  })
}

/** Copia o do repositório por cima do instalado. O repositório é a referência:
 *  é ele que passa por revisão e commit. */
export function sincronizar(hooks = [], { dryRun = false } = {}) {
  const feitos = []
  for (const c of comparar(hooks)) {
    if (c.estado !== 'divergente' && c.estado !== 'só no repositório') continue
    if (dryRun) { feitos.push({ ...c, acao: 'copiaria' }); continue }
    try {
      fs.mkdirSync(pastaInstalada(), { recursive: true })
      fs.copyFileSync(c.noRepo, path.join(pastaInstalada(), path.basename(c.noRepo)))
      feitos.push({ ...c, acao: 'copiado' })
    } catch (e) {
      feitos.push({ ...c, acao: 'falhou', erro: String(e.message || e) })
    }
  }
  return feitos
}
