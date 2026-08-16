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
//   node cc.mjs hooks install [--dry-run]  registra os hooks no settings.json
//   node cc.mjs hooks sync [--dry-run]     copia o hook do repo para ~/.claude/hooks
//   node cc.mjs routia install [pasta] cria docs/ROTAS-ATIVAS.md pro Método Routia
//   node cc.mjs routia cobertura       onde o Routia está descoberto nesta máquina
//   node cc.mjs deps [arquivo]     o que quebra se eu mexer aqui
//   node cc.mjs previa <arq.md>    vira HTML no tamanho do telefone dele
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
    /* CC-67: o gancho nasce com o projeto. O husky resolveu isto no git há
       anos; aqui doeu em 15/08, com três hooks esperando registro à mão no PC
       enquanto o padrão de resposta valia só na VPS. */
    /* CC-72: o que roda é `~/.claude/hooks`, e o repositório é só cópia. Sem
       isto, mexer no repositório não muda nada e ninguém percebe — o mesmo
       formato das 22 rotinas desatualizadas do CC-42. */
    if (arg === 'sync') {
      const R = await import('./src/hooksRegistro.mjs')
      const simular = has('--dry-run')
      const comp = R.comparar(HOOKS.filter((h) => h.script))
      console.log(`\n  repositório: ${R.pastaHooks()}\n  instalado:   ${R.pastaInstalada()}\n`)
      for (const c of comp) {
        const marca = {
          igual: '·', 'roda do repositório': '✓',
          divergente: '≠', 'só no repositório': '+', 'só instalado': '!',
        }[c.estado] || '?'
        console.log(`  ${marca} ${c.id.padEnd(16)} ${c.estado}`)
      }
      const mexer = comp.filter((c) => c.estado === 'divergente' || c.estado === 'só no repositório')
      if (!mexer.length) { console.log('\n  tudo em dia\n'); break }
      const feitos = R.sincronizar(HOOKS.filter((h) => h.script), { dryRun: simular })
      console.log(simular
        ? `\n  ${feitos.length} seria(m) copiado(s). Sem --dry-run, copio de verdade.\n`
        : `\n  ${feitos.filter((f) => f.acao === 'copiado').length} copiado(s) do repositório para a casa do Claude Code.\n`)
      break
    }

    if (arg === 'install') {
      const R = await import('./src/hooksRegistro.mjs')
      const simular = has('--dry-run')
      const r = R.instalar(HOOKS.filter((h) => h.implementado), { dryRun: simular })
      if (!r.ok) die(`não deu: ${r.erro}`)
      console.log(`\n${R.SETTINGS_FILE}${simular ? '  (simulação, nada gravado)' : ''}\n`)
      for (const f of r.feitos) {
        const marca = { registrado: '+', 'já estava': '·' }[f.acao] || '!'
        console.log(`  ${marca} ${f.id.padEnd(16)} ${f.acao}${f.evento ? `  (${f.evento})` : ''}`)
      }
      const novos = r.feitos.filter((f) => f.acao === 'registrado').length
      console.log(novos
        ? `\n  ${novos} registrado(s). Cópia do anterior em ${r.backup}\n  Abra /hooks no Claude Code, ou reinicie, para valer nesta sessão.\n`
        : '\n  nada a fazer: todos já estavam registrados\n')
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
    /* CC-52: quanto o método está descoberto NESTA máquina. Subcomando, e não
       linha no painel, porque a resposta muda de máquina para máquina: na VPS o
       trabalho é interativo, um por vez, e o paralelismo de verdade acontece no
       PC. Um número só na tela esconderia de onde ele veio. */
    if (arg === 'cobertura') {
      const { retrato } = await import('./src/routiaCobertura.mjs')
      const r = retrato()
      if (has('--json')) { console.log(JSON.stringify(r, null, 2)); break }

      const { hostname } = await import('node:os')
      console.log(`\nMétodo Routia em ${hostname()}\n`)
      if (!r.projetos.length) {
        console.log('  nenhuma sessão com trabalho de verdade nesta máquina\n')
        break
      }
      console.log(`  ${'projeto'.padEnd(28)}${'sessões'.padStart(8)}${'simultâneas'.padStart(13)}   quadro`)
      for (const p of r.projetos) {
        const marca = p.temQuadro ? 'sim' : (p.simultaneas > 0 ? 'NÃO ← descoberto' : 'não')
        console.log(`  ${p.nome.padEnd(28)}${String(p.sessoes).padStart(8)}${String(p.simultaneas).padStart(13)}   ${marca}`)
      }
      const { comSessao, comQuadro, comParalelismo, expostos } = r.resumo
      console.log(`\n  ${comSessao} projeto(s) com sessão, ${comQuadro} com quadro, ${comParalelismo} com sessões simultâneas.`)
      console.log(expostos
        ? `  ⚠️  ${expostos} tiveram sessões ao mesmo tempo SEM quadro: ${r.expostos.map((p) => p.nome).join(', ')}\n`
        : '  Nenhum projeto teve sessões simultâneas sem quadro nesta máquina.\n')
      break
    }

    /* CC-49: quem está com rota marcada e já sumiu. Nunca libera sozinho — um
       agente pode passar vinte minutos pensando sem escrever nada, e liberar
       por silêncio é a colisão que o método existe para evitar. */
    if (arg === 'presenca') {
      const { retratoDoQuadro, humanizar, SILENCIO_MS } = await import('./src/presenca.mjs')
      const { readSessoes } = await import('./src/sessoes.mjs')
      const dir = path.resolve(val('--dir') || positional[2] || process.cwd())
      const jobs = readJobs()
      const { PROJETOS_DIR } = await import('./src/sessoes.mjs')
      const r = retratoDoQuadro(dir, {
        jobs,
        sessoes: readSessoes(Date.now(), { ignorar: jobs.map((j) => j.id) }),
        pastaProjetos: PROJETOS_DIR,
      })
      if (!r) die(`sem quadro de rotas em ${dir}/docs/ROTAS-ATIVAS.md`)
      if (has('--json')) { console.log(JSON.stringify(r, null, 2)); break }

      console.log(`\n${r.arquivo}\n`)
      if (!r.ocupadas.length) { console.log('  nenhuma rota ocupada\n'); break }
      for (const o of r.ocupadas) {
        const marca = { ativa: '🟢 ativa', orfa: '⚠️  provavelmente órfã', desconhecida: '？ sem sinal conhecido' }[o.veredito]
        console.log(`  ${String(o.rota).padEnd(20)} ${String(o.id || '—').padEnd(10)} ${marca.padEnd(26)} calado há ${humanizar(o.silencioMs)}`)
      }
      const forasteiras = r.ocupadas.filter((o) => o.veredito === 'desconhecida').length
      if (r.orfas.length) {
        console.log(`\n  ${r.orfas.length} rota(s) sem sinal há mais de ${humanizar(SILENCIO_MS)}.`)
        console.log('  Confirme antes de retomar: silêncio não é liberação.')
      } else {
        console.log('\n  Nenhuma rota com dono sumido nesta máquina.')
      }
      /* "Sem sinal conhecido" NÃO é órfã: é sessão cujo transcrito não existe
         aqui, quase sempre da outra máquina. Dizer "todas têm dono vivo" nesse
         caso seria afirmar o que esta máquina não tem como saber. */
      if (forasteiras) {
        console.log(`  ${forasteiras} rota(s) marcada(s) por sessão de outra máquina: daqui não dá para saber se ainda vive.`)
      }
      console.log('')
      break
    }

    if (arg !== 'install') {
      die('uso: node cc.mjs routia install [pasta]     cria o quadro\n'
        + '     node cc.mjs routia cobertura [--json]  onde o método está descoberto\n'
        + '     node cc.mjs routia presenca [--dir X]  rotas ocupadas por quem sumiu')
    }
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

    /* CC-70: rodar o gate sem esperar o gatilho.
       `pre-commit run --all-files` existe porque gate que só dispara no gatilho
       não responde "como está o projeto AGORA?". Aqui a falta era a mesma: para
       saber se um projeto passaria, era preciso tentar editar e ser recusado.

       Serve para três coisas: conferir antes de começar, rodar em CI, e dar ao
       painel o estado real em vez do registrado. */
    if (arg === 'check') {
      const alvos = val('--dir')
        ? [path.resolve(val('--dir'))]
        : (await import('./src/install.mjs')).findProjects()

      const linhas = []
      for (const dir of alvos) {
        const sit = D.situacao(dir)
        if (!sit.existe) continue
        const a = F.avaliar(sit.estado.metodo, sit.estado)
        const modo = F.modoDe(sit.estado)
        linhas.push({
          projeto: path.basename(dir),
          ligado: sit.ligado,
          modo: modo.id,
          fase: a.tituloFase,
          passa: sit.ligado === false || a.portaoAberto,
          pendencias: a.pendencias || [],
        })
      }

      if (has('--json')) { console.log(JSON.stringify(linhas, null, 2)); break }
      if (!linhas.length) { console.log('\nnenhum projeto com framework ligado por aqui\n'); break }

      console.log('')
      for (const l of linhas) {
        console.log(`  ${l.passa ? '✓' : '✗'} ${l.projeto.padEnd(22)} ${
          (l.ligado === false ? 'desligado' : `${l.fase} · ${l.modo}`)}`)
        for (const p of l.pendencias) console.log(`      falta: ${p}`)
      }
      const barrados = linhas.filter((l) => !l.passa).length
      console.log(barrados
        ? `\n  ${barrados} projeto(s) não escreveriam código agora.\n`
        : '\n  todos passariam.\n')
      // sai com erro quando algo barra: é o que deixa isto servir em CI
      if (barrados) process.exitCode = 1
      break
    }
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
      case 'anonimizar': {
        const r = exigeRaiz()
        const e = D.ler(r)
        const arg2 = positional[2]
        if (!arg2) {
          console.log(`modo Pierre: ${e.anonimizar ? 'ligado' : 'desligado'}`)
          const { registro } = await import('./src/anonimoDisco.mjs')
          const reg = registro(10)
          if (reg.length) {
            console.log('\núltimos arquivos mascarados:')
            for (const x of reg) console.log(`  ${x.em?.slice(0, 16)} ${x.quantos} valor(es) [${x.tipos.join(', ')}] ${x.origem}`)
          }
          break
        }
        if (!['on', 'off'].includes(arg2)) die('uso: node cc.mjs framework anonimizar [on|off]')
        D.gravar(r, { ...e, anonimizar: arg2 === 'on' })
        console.log(`modo Pierre: ${arg2 === 'on' ? 'ligado' : 'desligado'}`)
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
      /* CC-68: os campos que os métodos `conserto` e `estudo` exigem. Sem
         comando, registrá-los seria editar `.framework/estado.json` à mão — e
         foi exatamente assim que eu burlei o próprio gate em 14/08. */
      case 'reproducao': {
        const r = exigeRaiz()
        const e = D.ler(r)
        const como = val('--como')
        const esperado = val('--esperado')
        if (!como && !esperado) {
          console.log(`como aparece: ${e.reproducao?.como || '(não registrado)'}`)
          console.log(`esperado:     ${e.reproducao?.esperado || '(não registrado)'}`)
          break
        }
        D.gravar(r, { ...e, reproducao: { ...e.reproducao, ...(como && { como }), ...(esperado && { esperado }) } })
        mostrar(r)
        break
      }
      case 'prova': {
        const r = exigeRaiz()
        const e = D.ler(r)
        const como = val('--como')
        if (!como && !has('--guardado')) {
          console.log(`prova:    ${e.prova?.como || '(não registrada)'}`)
          console.log(`guardado: ${e.prova?.guardado ? 'sim' : 'não'}`)
          break
        }
        D.gravar(r, { ...e, prova: { ...e.prova, ...(como && { como }), ...(has('--guardado') && { guardado: true }) } })
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

  /* O padrão de resposta dele, e quanto eu o sigo. Sem argumento mostra o
     retrato; `cc estilo padrao` imprime o texto e onde ele mora, para editar. */
  case 'estilo': {
    const E = await import('./src/estilo.mjs')
    if (arg === 'padrao') {
      console.log(`${E.ARQUIVO_PADRAO()}\n`)
      console.log(E.lerPadrao())
      break
    }
    const r = E.retrato()
    if (has('--json')) { console.log(JSON.stringify(r, null, 2)); break }
    if (!r) {
      console.log('\nainda não medi nenhuma resposta. O hook `estilo-fim` precisa estar registrado.\n')
      break
    }
    const seta = r.tendenciaPalavras == null ? '' : r.tendenciaPalavras < 0 ? '↓' : '↑'
    console.log(`\nPadrão de resposta — últimas ${r.janela} de ${r.total}\n`)
    console.log(`  ${String(r.linhas).padStart(4)} linhas por resposta, em média`)
    console.log(`  ${String(r.palavras).padStart(4)} palavras ${
      r.tendenciaPalavras == null ? '(sem passado para comparar ainda)' : `${seta} ${Math.abs(r.tendenciaPalavras)}% contra as ${r.janela} anteriores`}`)
    console.log(`  ${String(r.autodefesa).padStart(4)} com parágrafo de autodefesa`)
    console.log('\n  Tendência, não nota: falso positivo é esperado.\n')
    break
  }

  /* CC-86: "o que quebra se eu mexer aqui?", lido do código de agora.
     Sem argumento, mostra os arquivos mais perigosos de tocar no projeto. */
  case 'deps': {
    const D = await import('./src/dependencias.mjs')
    const raiz = path.resolve(val('--dir') || process.cwd())
    const g = D.mapear(raiz)
    if (has('--json')) { console.log(JSON.stringify({ ...g, usa: undefined, usadoPor: undefined, top: D.maisUsados(g, 20) }, null, 2)); break }

    console.log(`\n${g.arquivos} arquivos · ${g.ligacoes} ligações · lido ${g.kb} KB em ${g.ms}ms\n`)
    if (!arg) {
      console.log('  os mais perigosos de tocar (quantos dependem deles):\n')
      for (const m of D.maisUsados(g, 8)) {
        console.log(`  ${String(m.dependentes).padStart(3)}  ${m.arquivo}`)
      }
      console.log('\n  para um arquivo:  cc deps <caminho>\n')
      break
    }
    const i = D.impactoDe(g, arg)
    if (!i.existe) { console.log(`  ${i.arquivo}: não achei este arquivo no projeto\n`); break }
    console.log(`  ${i.arquivo}\n`)
    console.log(i.diretos.length
      ? `  usam ele diretamente (${i.diretos.length}):\n${i.diretos.map((a) => `    ${a}`).join('\n')}`
      : '  ninguém usa este arquivo')
    const indiretos = i.todos.filter((a) => !i.diretos.includes(a))
    if (indiretos.length) {
      console.log(`\n  e por tabela (${indiretos.length}):\n${indiretos.map((a) => `    ${a}`).join('\n')}`)
    }
    console.log('')
    break
  }

  /* CC-94: a prévia que vai para o telefone dele, padronizada.
     Antes era um script novo em /tmp a cada vez, e todos saíram com fonte de
     tela larga — ele lê andando, e teve que dar zoom em todos. */
  case 'previa': {
    const P = await import('./src/previa.mjs')
    if (!arg) {
      die('uso: node cc.mjs previa <arquivo.md> [--saida x.html] [--layout]\n'
        + '     --layout usa o CSS real do painel, para conferir TELA (não para ler)')
    }
    const origem = path.resolve(arg)
    if (!fs.existsSync(origem)) die(`não achei: ${origem}`)

    const md = fs.readFileSync(origem, 'utf8')
    // o `# título` do arquivo vira o título da página; o nome é o reserva
    const titulo = (md.match(/^#\s+(.+)$/m) || [])[1] || path.basename(origem, path.extname(origem))
    const saida = path.resolve(val('--saida') || path.join(
      process.env.TMPDIR || '/tmp', `${path.basename(origem, path.extname(origem))}.html`))

    P.gravar(saida, {
      titulo,
      subtitulo: `de ${path.relative(process.cwd(), origem)}`,
      corpo: P.deMarkdown(md.replace(/^---[\s\S]*?---\n/, '').replace(/^#\s+.+$/m, '')),
      modo: has('--layout') ? 'layout' : 'leitura',
    })
    console.log(saida)
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
