#!/usr/bin/env node
// Agent Cockpit — painel dos agentes do Claude Code.
//
//   node cc.mjs                    tabela no terminal + web, imprime o link
//   node cc.mjs open               garante o painel no ar e abre no navegador
//   node cc.mjs daemon install     roda sozinho no logon + atalho no Desktop
//   node cc.mjs daemon status|restart|uninstall
//   node cc.mjs set '<json>'       agente grava seu meta.json
//   node cc.mjs done "tarefa"      fecha um to-do sem reenviar a lista
//   node cc.mjs check              usado pelo hook: avisa to-do aberto na entrega
//   node cc.mjs on|off [--project X]   liga/desliga o reporte
//   node cc.mjs hooks                  lista hooks e se estão ligados
//   node cc.mjs hooks on|off <id>      liga/desliga um hook específico
//   node cc.mjs routia install [pasta] cria docs/ROTAS-ATIVAS.md pro Método Routia
//   node cc.mjs json               despeja o estado atual e sai
//
//   flags: --no-web  --web-only  --port <n>

import fs from 'node:fs'
import path from 'node:path'
import { readJobs, summarize, writeMeta, marcarTodo, metaStatus, currentJobId } from './src/jobs.mjs'
import { startTui } from './src/tui.mjs'
import { startWeb } from './src/web.mjs'
import * as daemon from './src/daemon.mjs'
import * as install from './src/install.mjs'
import { isEnabled, setEnabled, describe, hookEnabled, setHookEnabled } from './src/config.mjs'
import { HOOKS } from './src/hooksCatalogo.mjs'
import { instalarRotas, detectarPastas } from './src/routia.mjs'

const argv = process.argv.slice(2)
// Flag que come o argumento seguinte. Esquecer de registrar aqui faz o VALOR da
// flag virar posicional: `framework autorizar --dir /tmp/x` tratava `/tmp/x`
// como o alvo a autorizar. Achado testando o CLI do framework em 14/08.
const FLAGS_WITH_VALUE = new Set([
  '--port', '--job', '--project', '--dir', '--metodo', '--motivo', '--nome', '--criterio', '--pastas',
])

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
    if (!id || !isEnabled() || !hookEnabled('cc-check')) process.exit(0)
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

  // `cc hooks` lista; `cc hooks on|off <id>` liga/desliga um hook específico —
  // não confundir com `cc on|off`, que é o interruptor geral do reporte.
  case 'hooks': {
    if (arg === 'on' || arg === 'off') {
      const id = positional[2]
      if (!id) die(`uso: node cc.mjs hooks ${arg} <id>`)
      if (!HOOKS.some((h) => h.id === id)) die(`hook desconhecido: ${id}`)
      setHookEnabled(id, arg === 'on')
      console.log(`${id}: ${arg === 'on' ? 'ligado' : 'desligado'}`)
      break
    }
    for (const h of HOOKS) {
      const on = hookEnabled(h.id)
      console.log(`${on ? '●' : '○'} ${h.id.padEnd(14)} ${h.evento.padEnd(14)} ${on ? 'ligado' : 'desligado'}${h.implementado ? '' : '  (ainda não implementado)'}`)
    }
    break
  }

  // Instala o quadro do Método Routia num projeto. O hook que bloqueia
  // (rota-guard.mjs) já roda global — isto só cria docs/ROTAS-ATIVAS.md com
  // o escopo de pasta chutado pra estrutura real, sem nunca sobrescrever.
  case 'routia': {
    if (arg !== 'install') die(`uso: node cc.mjs routia install [pasta]\nsem pasta, usa o diretório atual`)
    const dir = path.resolve(positional[2] || process.cwd())
    if (!fs.existsSync(dir)) die(`pasta não existe: ${dir}`)
    const pastasArg = val('--pastas')
    const r = instalarRotas(dir, { pastas: pastasArg ? pastasArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined })
    if (r.acao === 'ja-existe') {
      console.log(`já existe: ${r.arquivo}`)
    } else {
      console.log(`criado: ${r.arquivo}`)
      console.log(`pastas-controladas: [${r.pastas.join(', ')}]`)
      console.log(`\nse não bater com a estrutura real, edite o front-matter à mão.`)
    }
    break
  }

  /**
   * O framework de engenharia, pela linha de comando.
   *
   * Existe porque registrar MVP editando `.framework/estado.json` à mão é o que
   * me deixou burlar o próprio gate em 14/08: o arquivo é sempre livre (tem que
   * ser, senão não há como sair da fase), então quem edita à mão passa por
   * cima. Comando não conserta isso sozinho, mas tira o incentivo.
   */
  case 'framework': {
    const F = await import('./src/framework.mjs')
    const D = await import('./src/frameworkDisco.mjs')
    const dir = path.resolve(val('--dir') || process.cwd())
    const raiz = D.acharRaiz(dir)

    const exigeRaiz = () => {
      if (!raiz) die(`este projeto não tem framework ligado\nligue com: node cc.mjs framework iniciar`)
      return raiz
    }
    const mostrar = (r) => {
      const e = D.ler(r)
      console.log(F.resumo(e.metodo, e))
      const a = F.avaliar(e.metodo, e)
      if (a.pendencias?.length) a.pendencias.forEach((p) => console.log(`  falta: ${p}`))
      if ((e.autorizado || []).length) console.log(`  autorizado: ${e.autorizado.join(', ')}`)
    }

    switch (arg) {
      case 'iniciar': {
        if (raiz) die(`já existe framework em ${raiz}`)
        const r = D.iniciar(dir, val('--metodo') || 'mvp-basico')
        if (!r.ok) die(r.erro)
        console.log(`framework ligado em ${dir}`)
        mostrar(dir)
        break
      }
      case 'modo': {
        const r = exigeRaiz()
        const alvo = positional[2]
        if (!alvo) {
          console.log(`modo atual: ${F.modoDe(D.ler(r)).id}`)
          console.log(`disponíveis: ${Object.keys(F.MODOS).join(', ')}`)
          break
        }
        const t = F.trocarModo(D.ler(r), alvo, { quando: new Date().toISOString() })
        if (!t.ok) die(t.erro)
        D.gravar(r, t.estado)
        console.log(`modo: ${alvo}`)
        mostrar(r)
        break
      }
      case 'autorizar': {
        const r = exigeRaiz()
        const a = F.autorizar(D.ler(r), {
          alvo: positional[2] || '**',
          motivo: val('--motivo') || null,
          quando: new Date().toISOString(),
        })
        D.gravar(r, a.estado)
        console.log(`autorizado: ${positional[2] || '**'}`)
        break
      }
      case 'avancar': {
        const r = exigeRaiz()
        const av = F.avancar(D.ler(r).metodo, D.ler(r))
        if (!av.ok) {
          console.log('não dá para avançar ainda:')
          av.pendencias.forEach((p) => console.log(`  ${p}`))
          process.exitCode = 1
          break
        }
        D.gravar(r, av.estado)
        mostrar(r)
        break
      }
      case 'ferramentas': {
        const r = exigeRaiz()
        const e = D.ler(r)
        const lista = positional.slice(2)
        if (!lista.length) {
          console.log((e.ferramentas || []).join(', ') || '(nenhuma escolhida)')
          for (const [f, v] of Object.entries(e.verificacao || {})) {
            console.log(`  ${v.ok ? 'ok  ' : 'FALHOU'} ${f}${v.detalhe ? ` — ${v.detalhe}` : ''}`)
          }
          break
        }
        const x = F.escolherFerramentas(e, lista, { quando: new Date().toISOString() })
        D.gravar(r, x.estado)
        console.log(`ferramentas: ${x.estado.ferramentas.join(', ')}`)
        mostrar(r)
        break
      }
      case 'verificou': {
        const r = exigeRaiz()
        const nome = positional[2]
        if (!nome) die(`uso: node cc.mjs framework verificou <ferramenta> [--falhou] [--detalhe "..."]`)
        const x = F.registrarVerificacao(D.ler(r), nome, {
          ok: !argv.includes('--falhou'),
          detalhe: val('--detalhe'),
          quando: new Date().toISOString(),
        })
        if (!x.ok) die(x.erro)
        D.gravar(r, x.estado)
        mostrar(r)
        break
      }
      case 'bancada': {
        const r = exigeRaiz()
        const B = await import('./src/bancada.mjs')
        const alvo = positional[2]
        const cfg = { alvo: val('--alvo') }

        if (!alvo) {
          const s = B.situacao(r, cfg)
          for (const c of s.camadas) {
            const marca = c.escolhida ? '*' : ' '
            const res = c.resultado ? (c.resultado.ok ? 'ok' : 'FALHOU') : '—'
            console.log(`${marca} ${c.id.padEnd(14)} ${res.padEnd(7)} ${c.explica}`)
          }
          console.log('\n* = escolhida na Definição. Rodar: framework bancada <camada|tudo>')
          break
        }

        const saida = alvo === 'tudo' ? await B.rodarEscolhidas(r, cfg) : await B.rodar(r, alvo, cfg)
        if (saida.erro) die(saida.erro)
        const lista = saida.resultados || [saida]
        for (const x of lista) {
          console.log(`${x.camada}: ${x.ok && !x.achados?.length ? 'limpo' : `${x.achados?.length || 0} achado(s)`}`)
          for (const a of x.achados || []) console.log(`  [${a.gravidade}] ${a.titulo} — ${a.onde}`)
        }
        mostrar(r)
        break
      }
      case 'metodos': {
        for (const m of Object.values(F.METODOS)) {
          console.log(`${m.id}${' '.repeat(Math.max(1, 18 - m.id.length))}${m.titulo}`)
          console.log(`  fases: ${m.fases.map((f) => f.id).join(' → ')}`)
        }
        break
      }
      case 'mvp': {
        const r = exigeRaiz()
        const e = D.ler(r)
        const nome = val('--nome')
        const criterio = val('--criterio')
        if (!nome && !criterio) {
          console.log(`nome: ${e.mvp?.nome || '(sem nome)'}`)
          for (const c of e.mvp?.criterios || []) console.log(`  [${c.feito ? 'x' : ' '}] ${c.texto}`)
          break
        }
        const mvp = { ...e.mvp }
        if (nome) mvp.nome = nome
        if (criterio) mvp.criterios = [...(mvp.criterios || []), { texto: criterio, feito: false }]
        D.gravar(r, { ...e, mvp })
        mostrar(r)
        break
      }
      case 'status':
      case undefined: {
        if (!raiz) { console.log('este projeto não tem framework ligado'); break }
        mostrar(raiz)
        break
      }
      default:
        die(`uso: node cc.mjs framework [status|iniciar|modo <nome>|autorizar [alvo]|mvp|avancar]`)
    }
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
