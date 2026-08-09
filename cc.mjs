#!/usr/bin/env node
// Control Center — painel dos agentes do Claude Code.
//
//   node cc.mjs                    tabela no terminal + web, imprime o link
//   node cc.mjs open               garante o painel no ar e abre no navegador
//   node cc.mjs daemon install     roda sozinho no logon + atalho no Desktop
//   node cc.mjs daemon status|restart|uninstall
//   node cc.mjs set '<json>'       agente grava seu meta.json
//   node cc.mjs done "tarefa"      fecha um to-do sem reenviar a lista
//   node cc.mjs check              usado pelo hook: avisa to-do aberto na entrega
//   node cc.mjs on|off [--project X]   liga/desliga o reporte
//   node cc.mjs json               despeja o estado atual e sai
//
//   flags: --no-web  --web-only  --port <n>

import { readJobs, summarize, writeMeta, marcarTodo, metaStatus, currentJobId } from './src/jobs.mjs'
import { startTui } from './src/tui.mjs'
import { startWeb } from './src/web.mjs'
import * as daemon from './src/daemon.mjs'
import * as install from './src/install.mjs'
import { isEnabled, setEnabled, describe } from './src/config.mjs'

const argv = process.argv.slice(2)
const FLAGS_WITH_VALUE = new Set(['--port', '--job', '--project'])

const has = (f) => argv.includes(f)
const val = (f, d = null) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
/** Posicionais = tudo que não é flag nem valor de flag. */
const positional = argv.filter((a, i) => {
  if (a.startsWith('--')) return false
  const prev = argv[i - 1]
  return !(prev && FLAGS_WITH_VALUE.has(prev))
})

const [cmd, arg] = positional
const port = Number(val('--port', daemon.DEFAULT_PORT))
const die = (msg) => {
  console.error(msg)
  process.exit(1)
}

switch (cmd) {
  case 'set': {
    if (!isEnabled()) process.exit(0) // desligado: no-op silencioso, de propósito
    const id = val('--job') || currentJobId()
    if (!id) die('sem job: rode dentro de um job do Claude Code ou passe --job <id>')
    if (!arg) die(`uso: node cc.mjs set '{"subject":"...","todos":[{"text":"...","done":false}]}'`)
    let patch
    try {
      patch = JSON.parse(arg)
    } catch (e) {
      die(`JSON inválido: ${e.message}`)
    }
    console.log(JSON.stringify(writeMeta(id, patch), null, 2))
    break
  }

  /**
   * Captura o uso do plano do JSON que o Claude Code manda para o statusLine,
   * e repassa a entrada intacta para o comando de statusline que já existia.
   *
   * É o único lugar de onde o número oficial sai sem chamar API nem tocar em
   * credencial. Falha aberta em tudo: se este comando quebrar, a statusline do
   * Felipe some da tela, o que é pior que não ter o dado no painel.
   */
  case 'statusline': {
    const entrada = await new Promise((resolve) => {
      let buf = ''
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (c) => { buf += c })
      process.stdin.on('end', () => resolve(buf))
      process.stdin.on('error', () => resolve(''))
    })
    try {
      const { gravarUso } = await import('./src/uso.mjs')
      gravarUso(JSON.parse(entrada))
    } catch { /* sem rate_limits, JSON quebrado ou disco cheio: segue o jogo */ }

    const embrulhado = val('--wrap')
    if (!embrulhado) break
    let saida = ''
    try {
      const { spawnSync } = await import('node:child_process')
      // 15s: a statusline embrulhada pode chamar ferramenta externa lenta (a
      // do Felipe cai num `npx ccusage` quando o binário não está instalado).
      const r = spawnSync(embrulhado, { input: entrada, shell: true, encoding: 'utf8', timeout: 15000 })
      saida = r.stdout || ''
    } catch { /* fica com a linha mínima abaixo */ }

    // Se a original travou ou não imprimiu nada, ainda assim sai algo: barra
    // vazia parece painel quebrado, e o uso do plano é a informação que mais
    // importa ali.
    if (!saida.trim()) {
      try {
        const j = JSON.parse(entrada)
        const u = (await import('./src/uso.mjs')).readUso()
        const pct = (x) => (x ? `${Math.round(x.pct)}%` : '—')
        saida = [
          j.workspace?.current_dir ? j.workspace.current_dir.split(/[\\/]/).filter(Boolean).pop() : '',
          j.model?.display_name,
          u ? `plano 5h ${pct(u.cincoHoras)} · semana ${pct(u.semana)}` : '',
        ].filter(Boolean).join('  ·  ')
      } catch { /* nem isso: sai vazio mesmo */ }
    }
    if (saida) process.stdout.write(saida)
    break
  }

  // Fechar tarefa sem reenviar a lista: era esse atrito que fazia o agente
  // adiar a marcação, e adiar virou nunca.
  case 'done':
  case 'undone': {
    if (!isEnabled()) process.exit(0)
    const id = val('--job') || currentJobId()
    if (!id) die('sem job: rode dentro de um job do Claude Code ou passe --job <id>')
    if (!arg) die(`uso: node cc.mjs ${cmd} "texto da tarefa"`)
    try {
      const r = marcarTodo(id, arg, cmd === 'done')
      console.log(`${r.done ? '✓' : '○'} ${r.tarefa}`)
    } catch (e) {
      die(e.message)
    }
    break
  }

  // Chamado pelo hook Stop: avisa se o agente vai encerrar deixando a métrica
  // suja. Nunca falha o processo — hook que quebra vira hook desligado.
  case 'check': {
    const id = val('--job') || currentJobId()
    if (!id || !isEnabled()) process.exit(0)
    const job = readJobs().find((j) => j.id === id)
    if (!job || !job.todos.length) process.exit(0)
    const abertos = job.todos.filter((t) => !t.done)
    if (!abertos.length) process.exit(0)
    // O `state` do CLI vira "done" ao fim de CADA turno, então usá-lo aqui
    // faria o hook cobrar a cada resposta, inclusive no meio do trabalho. O
    // gatilho é o que o agente ESCREVEU no próprio status ao dar por encerrado.
    if (!/entreg|pronto|conclu|finaliz/i.test(metaStatus(id) || '')) process.exit(0)
    console.error(
      `${abertos.length} to-do${abertos.length > 1 ? 's' : ''} em aberto com o trabalho dado por pronto:\n`
      + abertos.map((t) => `  ○ ${t.text}`).join('\n')
      + `\n\nFeche o que terminou com  cc done "texto da tarefa"  — ou explique em blockers`
      + ' o que ficou. Métrica de tempo por tarefa depende disso.',
    )
    process.exit(2)
  }

  case 'on':
  case 'off': {
    const on = cmd === 'on'
    const project = val('--project')
    setEnabled(on, { project })
    const d = describe()
    console.log(
      project
        ? `reporte ${on ? 'ligado' : 'desligado'} para o projeto ${project}`
        : `reporte ${on ? 'ligado' : 'desligado'} globalmente`,
    )
    if (d.disabledProjects.length) console.log(`projetos desligados: ${d.disabledProjects.join(', ')}`)
    console.log(`config: ${d.file}`)
    break
  }

  case 'status': {
    const d = describe()
    const s = await daemon.status(port)
    console.log(`reporte global: ${d.global ? 'ligado' : 'desligado'}`)
    console.log(`projeto atual (${d.project}): ${d.projectEnabled ? 'ligado' : 'desligado'}`)
    if (d.disabledProjects.length) console.log(`desligados: ${d.disabledProjects.join(', ')}`)
    console.log(`autostart: ${s.installed ? s.autostart : 'não instalado'}`)
    console.log(`painel: ${s.running ? `no ar em http://localhost:${s.port}` : 'fora do ar'}`)
    if (s.shortcut) console.log(`atalho: ${s.shortcut}`)
    break
  }

  case 'daemon': {
    switch (arg) {
      case 'install': {
        const r = daemon.install({ port })
        const up = await daemon.ensureUp(port)
        console.log(`autostart: ${r.vbs}`)
        console.log(`atalho: ${r.shortcut || 'não criado (Desktop não encontrado)'}`)
        console.log(`painel: ${up.url}`)
        break
      }
      case 'uninstall': {
        await daemon.shutdown(port)
        const r = daemon.uninstall()
        for (const f of r.removed) console.log(`removido: ${f}`)
        if (!r.removed.length) console.log('nada pra remover')
        break
      }
      case 'restart': {
        await daemon.shutdown(port)
        const up = await daemon.ensureUp(port)
        console.log(`painel reiniciado: ${up.url}`)
        break
      }
      case 'status':
      case undefined: {
        const s = await daemon.status(port)
        console.log(JSON.stringify(s, null, 2))
        break
      }
      default:
        die(`subcomando desconhecido: daemon ${arg}`)
    }
    break
  }

  case 'open': {
    const up = await daemon.ensureUp(port)
    daemon.openBrowser(up.url)
    console.log(up.url)
    break
  }

  case 'install': {
    const dir = arg || process.cwd()
    const r = install.installInto(dir, { create: has('--create') })
    if (r.action === 'missing') die(`${r.file} não existe — use --create pra criar um`)
    console.log(`${r.action}: ${r.file}`)
    break
  }

  case 'sync': {
    const rows = install.syncAll({ dryRun: has('--dry-run'), remove: has('--remove') })
    for (const r of rows) console.log(`${String(r.action).padEnd(18)} ${r.project}`)
    const counts = rows.reduce((a, r) => ({ ...a, [r.action]: (a[r.action] || 0) + 1 }), {})
    console.log(`\n${rows.length} projetos — ` + Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', '))
    break
  }

  case 'json': {
    const jobs = readJobs()
    console.log(JSON.stringify({ jobs, summary: summarize(jobs) }, null, 2))
    break
  }

  case undefined: {
    const wantWeb = !has('--no-web')
    const wantTui = !has('--web-only')
    const { url } = wantWeb ? await startWeb({ port }) : { url: null }
    if (wantTui) startTui({ link: url })
    else console.log(`control center: ${url}`)
    break
  }

  default:
    die(`comando desconhecido: ${cmd}\nveja os comandos no topo de cc.mjs`)
}
