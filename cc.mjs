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
//   node cc.mjs federar                mostra a que cockpit esta máquina reporta
//   node cc.mjs federar ligar --para <url> --token <t> [--nome "MEU PC"]
//   node cc.mjs federar desligar       para de empurrar
//   node cc.mjs hooks                  lista hooks e se estão ligados
//   node cc.mjs hooks on|off <id>      liga/desliga um hook específico
//   node cc.mjs hooks install [--dry-run]  registra os hooks no settings.json
//   node cc.mjs hooks sync [--dry-run]     copia o hook do repo para ~/.claude/hooks
//   node cc.mjs routia install [pasta] cria docs/ROTAS-ATIVAS.md pro Método Routia
//   node cc.mjs routia cobertura       onde o Routia está descoberto nesta máquina
//   node cc.mjs deps [arquivo]     o que quebra se eu mexer aqui
//   node cc.mjs previa <arq.md>    vira HTML no tamanho do telefone dele
//   node cc.mjs bancada [rodar X] as camadas de verificação, uma a uma
//   node cc.mjs json               despeja o estado atual e sai
//
//   flags: --no-web  --web-only  --port <n>

import fs from 'node:fs'
import path from 'node:path'
import { readJobs, summarize, writeMeta, marcarTodo, revisarTodo, metaStatus, currentJobId } from './src/jobs.mjs'
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
  '--prova', '--pronto', '--branch', '--alvo', '--apontou', '--respondeu', '--quem',
  // CC-187: ligar um aparelho novo ao cockpit sem SSH
  '--para', '--token',
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
      // CC-97: `--prova` é o que separa "marquei" de "verifiquei". Opcional no
      // comando, cobrado pelo `pronto-guard` na entrega.
      const r = marcarTodo(id, arg, cmd === 'done', { prova: val('--prova') })
      console.log(`${r.done ? '✓' : '○'} ${r.tarefa}`)
      if (r.prova) console.log(`  prova: ${r.prova}`)
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
    /* Os termos em INGLÊS entraram em 18/08, ao escrever o primeiro teste desta
       trava. O protocolo dá o exemplo em português (`"status":"entregue"`), mas
       agente nenhum é obrigado a copiar o exemplo: eu mesmo reportei
       `"status":"done"` a sessão inteira naquele dia, e a cobrança nunca teria
       disparado. Trava que depende do idioma que o agente escolheu não é trava. */
    if (!/entreg|pronto|conclu|finaliz|\bdone\b|\bdelivered\b|\bfinish|\bcomplet/i.test(metaStatus(id) || '')) process.exit(0)
    console.error(
      `${abertos.length} to-do${abertos.length > 1 ? 's' : ''} em aberto com o trabalho dado por pronto:\n`
      + abertos.map((t) => `  ○ ${t.text}`).join('\n')
      + `\n\nFeche o que terminou com  cc done "texto da tarefa"  — ou explique em blockers`
      + ' o que ficou. Métrica de tempo por tarefa depende disso.',
    )
    process.exit(2)
  }

  /* CC-99: a revisão fica na tarefa, não na conversa.
       cc revisar "tarefa" --apontou "o menu fecha sozinho"
       cc revisar "tarefa" --respondeu "guarda no renderTabs, 4 casos"
     Sem `--quem`, a revisão é dele: é ele quem revisa na prática, e escrever
     "felipe" toda vez seria atrito no celular. */
  case 'revisar': {
    const id = val('--job') || currentJobId()
    if (!id) die('sem job: rode dentro de uma sessão do Claude Code ou passe --job <id>')
    if (!arg) die('uso: node cc.mjs revisar "texto da tarefa" --apontou "..." | --respondeu "..."')
    try {
      const r = revisarTodo(id, arg, {
        apontou: val('--apontou'),
        respondeu: val('--respondeu'),
        quem: val('--quem') || 'felipe',
      })
      console.log(`↺ ${r.tarefa}`)
      for (const rev of r.revisoes) {
        console.log(`  ${rev.quem} apontou: ${rev.apontou}`)
        if (rev.respondeu) console.log(`  respondido: ${rev.respondeu}`)
      }
    } catch (e) { die(e.message) }
    break
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

  /* CC-82: a estante pelo terminal, que é como ela funciona do celular.
     `cc doc add "<titulo>" "<texto>"` cria; sem o texto, lê da entrada padrão,
     que é o que permite `pbpaste | cc doc add "titulo"` e o ditado.
     `cc doc + <id> "<linha>"` acrescenta ao fim — o caso que ele descreveu foi
     "adiciona uma nota lá pra mim", nunca "troca o documento inteiro". */
  /* Uma pasta de trabalho por agente, para dois não escreverem no mesmo arquivo.
     Tudo aqui é DERIVADO do git — não existe registro paralelo de "quem está
     onde", que era a pergunta dele em 16/08. Um JSON com essa informação viraria
     mentira no primeiro `git worktree remove` feito à mão. */
  case 'oficina': {
    const O = await import('./src/oficinas.mjs')
    const raiz = process.cwd()
    const sub = arg || 'list'

    if (sub === 'list' || sub === 'ls') {
      const m = await O.mapa(raiz)
      if (!m.ok) die(m.erro)
      console.log(`principal: ${m.principal}\n`)
      for (const o of m.oficinas) {
        const pend = o.sujos || o.novos ? `${o.sujos}M ${o.novos}?` : 'limpa'
        const dist = o.aFrente == null ? '' : `  ${o.aFrente}↑ ${o.atras}↓`
        console.log(`${o.principal ? '★' : ' '} ${(o.branch || '(sem branch)').padEnd(34)} ${pend.padEnd(9)}${dist}`)
        console.log(`    ${o.pasta}`)
        for (const r of o.rotas) {
          console.log(`    rota \`${r.rota}\` · ${r.quem || 'sem id'}${r.arquivos.length ? ` · 📁 ${r.arquivos.join(' ')}` : ' · sem arquivo declarado'}`)
        }
        if (o.node?.existe) {
          console.log(`    node_modules: ${o.node.atalho ? `atalho → ${o.node.destino}` : `${o.node.pacotes} pacote(s), cópia própria`}`)
        }
      }
      if (m.colisoes.length) {
        console.log('\n⚠️  o mesmo arquivo reivindicado em duas oficinas — vai conflitar no merge:')
        for (const c of m.colisoes) {
          console.log(`   ${c.arquivo}: \`${c.entre[0].rota}\` e \`${c.entre[1].rota}\``)
        }
      }
      break
    }

    if (sub === 'criar' || sub === 'nova') {
      const r = await O.criar(raiz, positional[2], {
        branch: val('--branch'),
        semAtalho: process.argv.includes('--sem-atalho'),
      })
      if (!r.ok) die(r.erro)
      console.log(`oficina criada\n  pasta:  ${r.pasta}\n  branch: ${r.branch}`)
      if (r.node) console.log(`  node:   ${r.node}`)
      console.log('\nAbra o agente lá dentro e marque a rota no quadro daquela pasta,')
      console.log('declarando os arquivos com 📁 — sem isso a rota não protege nada.')
      break
    }

    if (sub === 'fechar' || sub === 'rm') {
      const r = await O.fechar(raiz, positional[2], { forcar: process.argv.includes('--forcar') })
      if (!r.ok) die(r.erro)
      console.log(`oficina fechada: ${r.pasta}\nA branch \`${r.branch}\` continua existindo — falta o merge.`)
      break
    }

    die('uso: node cc.mjs oficina [list|criar <nome>|fechar <nome>]')
    break
  }

  /* Todo item do backlog ganha codigo estavel. Antes disto a tela mostrava a
     POSICAO no arquivo (#07, #12), que muda quando alguem insere um item no
     meio: numero que anda sozinho e pior que nenhum. */
  case 'ticket': {
    const T = await import('./src/tickets.mjs')
    const seco = process.argv.includes('--seco')
    const alvos = val('--dir')
      ? [path.resolve(val('--dir'))]
      : (await import('./src/install.mjs')).findProjects()

    let total = 0
    for (const raiz of alvos) {
      const r = T.aplicar(raiz, { seco })
      if (!r.ok || !r.mudancas.length) continue
      total += r.mudancas.length
      console.log(`${path.basename(raiz)}  (${r.prefixo})  ${r.mudancas.length} item(ns)${seco ? '  [simulacao]' : ''}`)
      for (const m of r.mudancas) console.log(`   ${m.codigo}  ${m.titulo}`)
    }
    console.log(total
      ? `\n${total} item(ns)${seco ? ' ganhariam' : ' ganharam'} codigo. Copia do anterior em ROADMAP.md.bak`
      : 'todo item do backlog ja tem codigo')
    break
  }

  case 'doc': {
    const DOC = await import('./src/documentos.mjs')
    const sub = arg || 'list'

    if (sub === 'list' || sub === 'ls') {
      const lista = DOC.listar()
      if (!lista.length) { console.log('a estante está vazia'); break }
      for (const d of lista) {
        const quando = new Date(d.mexidoEm).toISOString().slice(0, 10)
        console.log(`${d.id.padEnd(34)} ${String(d.palavras).padStart(6)} palavras  ${quando}  ${d.titulo}`)
      }
      break
    }

    if (sub === 'ver' || sub === 'cat') {
      const doc = DOC.ler(positional[2])
      if (!doc) die(`documento não existe: ${positional[2]}`)
      console.log(doc.texto)
      break
    }

    if (sub === 'add' || sub === 'novo') {
      const titulo = positional[2]
      if (!titulo) die('uso: node cc.mjs doc add "<titulo>" ["<texto>"]')
      // sem texto no argumento, lê da entrada padrão: é o que deixa encadear
      // com pipe, e ditar no celular sem escapar aspas de um texto longo
      const texto = positional[3] ?? (process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8'))
      const r = DOC.gravar({ titulo, texto, fonte: 'terminal' })
      if (!r.ok) die(r.erro)
      console.log(`guardado: ${r.id}`)
      break
    }

    if (sub === '+' || sub === 'append') {
      const id = positional[2]
      const linha = positional[3] ?? (process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8'))
      if (!id || !String(linha).trim()) die('uso: node cc.mjs doc + <id> "<linha>"')
      const r = DOC.acrescentar(id, linha)
      if (!r.ok) die(r.erro)
      console.log(`acrescentado em ${r.id}`)
      break
    }

    if (sub === 'rm' || sub === 'apagar') {
      const r = DOC.apagar(positional[2])
      if (!r.ok) die(r.erro)
      console.log(`apagado (o arquivo virou .apagado, dá para recuperar)`)
      break
    }

    if (sub === 'publicar') {
      const r = DOC.publicar(positional[2], path.resolve(val('--dir') || process.cwd()))
      if (!r.ok) die(r.erro)
      console.log(`publicado em ${r.arquivo} — agora tem git`)
      break
    }

    die('uso: node cc.mjs doc [list|ver|add|+|rm|publicar]')
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

    /* CC-103: o `pre-commit run --all-files` que faltava. O gate só existia no
       gatilho, então saber se uma trava ainda pega o que promete exigia
       provocá-la de propósito, uma por uma. */
    if (arg === 'testar' || arg === 'provar') {
      const P = await import('./src/hooksProva.mjs')
      const pedidos = positional.slice(2)
      if (pedidos.some((id) => !HOOKS.some((h) => h.id === id))) {
        die(`hook desconhecido: ${pedidos.find((id) => !HOOKS.some((h) => h.id === id))}`)
      }
      console.log('')
      const marca = { provado: '✓', falhou: '✗', 'sem prova': '?' }
      const { resumo } = await P.rodar(pedidos.length ? pedidos : null, {
        aoTerminar: (r) => {
          const extra = r.estado === 'provado' ? `${r.casos} caso(s), ${r.ms}ms`
            : r.estado === 'sem prova' ? 'nenhum teste escrito' : ''
          console.log(`  ${marca[r.estado]} ${r.id.padEnd(18)} ${r.estado.padEnd(10)} ${extra}`)
          if (r.detalhe) r.detalhe.split('\n').forEach((l) => console.log(`      ${l.trim()}`))
        },
      })
      console.log(`\n  ${resumo.provado} provada(s), ${resumo.falhou} com defeito, `
        + `${resumo.semProva} sem teste, de ${resumo.total}.`)
      console.log('  "sem teste" não é o mesmo que quebrada: é trava cujo comportamento ninguém mediu.\n')
      process.exit(resumo.falhou ? 1 : 0)
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
      // dir nulo de propósito: esta lista é o interruptor GLOBAL, e o cwd de
      // quem digitou o comando não pode colorir a resposta (CC-115)
      const on = hookEnabled(h.id, undefined, null)
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
      /* Perfil: a combinação de modos com nome de profissão, pedida por ele em
         17/08 ("seria o profissional que eu contrataria praquela tarefa"). Mora
         no mesmo comando porque, do lado dele, escolher "Designer" e escolher
         "desenho" é a mesma ação. */
      case 'perfil': {
        const r = exigeRaiz()
        const alvo = positional[2]
        const estado = D.ler(r, { sessao: null })
        if (!alvo) {
          const v = F.vigente(estado)
          console.log(`\nagora: ${v.titulo}${v.perfil ? '' : '  (modo, sem perfil)'}`)
          console.log(`  ${v.explica}\n`)
          for (const p of Object.values(F.PERFIS)) {
            const res = F.perfilResolvido(p.id)
            console.log(`  ${p.id.padEnd(13)} ${p.titulo.padEnd(13)} ${p.contrataria}`)
            console.log(`  ${''.padEnd(13)} ${''.padEnd(13)} exige: ${res.exige.join(', ') || 'nada'}`
              + `${res.desliga.length ? ` · desliga: ${res.desliga.join(', ')}` : ''}`
              + `${res.teto != null ? ` · teto de ${res.teto} entrega` : ''}`)
          }
          console.log('')
          break
        }
        if (alvo === 'nenhum' || alvo === 'off') {
          const semPerfil = { ...estado }
          delete semPerfil.perfil
          D.gravar(r, semPerfil)
          console.log(`perfil removido, vale o modo: ${F.modoDe(semPerfil).titulo}`)
          break
        }
        if (!F.PERFIS[alvo]) die(`perfil desconhecido: ${alvo}\ndisponíveis: ${Object.keys(F.PERFIS).join(', ')}`)
        const res = F.perfilResolvido(alvo)
        D.gravar(r, { ...estado, perfil: alvo, modo: res.base.id })
        console.log(`perfil: ${res.titulo} (${res.contrataria})`)
        console.log(`  exige: ${res.exige.join(', ') || 'nada'}`)
        if (res.desliga.length) console.log(`  desliga de propósito: ${res.desliga.join(', ')}`)
        if (res.teto != null) console.log(`  teto: ${res.teto} entrega antes de mostrar`)
        break
      }
      case 'modo': {
        const r = exigeRaiz()
        const alvo0 = positional[2]
        // apelidos: `livre`, `continuativo`, `autonomo`, `debug`, `design`
        const achado = alvo0 ? F.acharModo(alvo0) : null
        const alvo = achado ? achado.id : alvo0
        if (!alvo) {
          const v = F.vigente(D.ler(r))
          console.log(`agora: ${v.titulo}${v.perfil ? ` (perfil, base ${v.modo.id})` : ''}`)
          console.log(`disponíveis: ${Object.values(F.MODOS).map((m) => `${m.id} (${m.titulo})`).join(', ')}`)
          console.log(`perfis prontos: ${Object.keys(F.PERFIS).join(', ')}  →  cc framework perfil <nome>`)
          break
        }
        if (!achado) die(`modo desconhecido: ${alvo0}\ndisponíveis: ${Object.keys(F.MODOS).join(', ')}`)
        /* CC-116: rodando dentro de uma sessão, o padrão é mudar SÓ ela — é o
           que permite frontend no restritivo e backend no sugestivo no mesmo
           projeto. `--projeto` muda para todos, o comportamento antigo. */
        const sessaoAtual = process.env.CLAUDE_CODE_SESSION_ID
        if (sessaoAtual && !has('--projeto')) {
          if (!F.MODOS[alvo]) die(`modo desconhecido: ${alvo}\ndisponíveis: ${Object.keys(F.MODOS).join(', ')}`)
          const g = D.gravarSessao(r, sessaoAtual, { modo: alvo })
          if (!g.ok) die(g.erro)
          const doProjeto = F.modoDe(D.ler(r, { sessao: null })).id
          console.log(`modo desta sessão: ${alvo}`)
          if (doProjeto !== alvo) console.log(`o projeto continua em ${doProjeto} — para mudar todos: --projeto`)
          break
        }
        const t = F.trocarModo(D.ler(r, { sessao: null }), alvo, { quando: new Date().toISOString() })
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
      /* F15: achado sobre OUTRO projeto vira ticket NELE, no git dele — não
         precisa de `exigeRaiz()`, o alvo é sempre um projeto diferente do
         atual. `<projeto>` é o nome da pasta entre os que este cockpit
         conhece (varredura de `findProjects`), `<texto>` é o achado. */
      case 'ticket': {
        const [projeto, texto] = [positional[2], positional[3]]
        if (!projeto || !texto) {
          die('uso: node cc.mjs framework ticket <projeto> "<texto do achado>"')
        }
        const Tk = await import('./src/ticket.mjs')
        const res = Tk.registrarTicket(projeto, texto, { origem: path.basename(process.cwd()) })
        if (!res.ok) die(res.erro)
        console.log(`ticket registrado e commitado em ${res.relativo} (${projeto})`)
        break
      }
      case 'bancada': {
        const r = exigeRaiz()
        const B = await import('./src/bancada.mjs')
        const alvo = positional[2]
        /* CC-71: `--so-mudou` roda as camadas de arquivo apenas no diff.
           Sem git, ou fora de repositorio, degrada para varrer TUDO — camada de
           seguranca que se cala por nao saber o que mudou seria pior que
           lentidao. */
        const cfg = { alvo: val('--alvo'), soMudou: process.argv.includes('--so-mudou') }

        if (!alvo) {
          const s = B.situacao(r, cfg)
          for (const c of s.camadas) {
            const marca = c.escolhida ? '*' : ' '
            /* A ordem importa e estava errada: o resultado GUARDADO vencia o
               "não se aplica", e a linha saía "ok · nenhum domínio configurado".
               Resultado antigo é de outra configuração, e mostrá-lo como válido
               é dizer que verificou algo que hoje nem roda. */
            const res = !c.implementada ? 'a fazer'
              : !c.cabe ? 'n/a'
                : c.resultado ? (c.resultado.ok ? 'ok' : 'FALHOU') : '—'
            console.log(`${marca} ${c.id.padEnd(18)} ${res.padEnd(8)} ${c.cabe ? c.explica : c.porQueNao}`)
          }
          console.log('\n* = escolhida na Definição. Rodar: framework bancada <camada|tudo>')
          break
        }

        /* `bancada nivel <x>`: a exigência escolhida por quem alcança o projeto,
           em vez de dezenove caixinhas. Sem argumento, mostra os quatro e diz
           qual está declarado — perguntar "quais níveis existem?" tem que ser
           mais fácil que abrir o código. */
        if (alvo === 'nivel') {
          const C = await import('./src/bancadaCatalogo.mjs')
          const estado = D.ler(r) || {}
          const pedido = positional[3]

          if (!pedido) {
            const atual = estado.nivelBancada || 'rascunho (padrão, não declarado)'
            console.log(`nível deste projeto: ${atual}\n`)
            for (const n of Object.values(C.NIVEIS)) {
              console.log(`${n.id === estado.nivelBancada ? '▸' : ' '} ${n.id.padEnd(9)} ${n.pergunta}`)
              console.log(`    ${n.explica}`)
              console.log(`    camadas: ${C.camadasDoNivel(n.id).join(', ')}\n`)
            }
            console.log('declarar: node cc.mjs framework bancada nivel <nome>')
            console.log('rodar:    node cc.mjs framework bancada nivel <nome> --rodar')
            break
          }

          if (!C.NIVEIS[pedido]) die(`nível desconhecido: ${pedido}. São: ${Object.keys(C.NIVEIS).join(', ')}`)

          if (!process.argv.includes('--rodar')) {
            D.gravar(r, { ...estado, nivelBancada: pedido })
            console.log(`nível declarado: ${pedido}`)
            console.log(`camadas exigidas: ${C.camadasDoNivel(pedido).join(', ')}`)
            console.log('\nrodar agora: node cc.mjs framework bancada nivel ' + pedido + ' --rodar')
            break
          }

          const res = await B.rodarNivel(r, pedido, cfg)
          if (!res.ok) die(res.erro)
          for (const x of res.resultados) {
            const v = x.verificou === false ? 'NÃO VERIFICADO'
              : x.ok && !x.achados?.length ? 'limpo' : `${x.achados?.length || 0} achado(s)`
            console.log(`${x.camada.padEnd(20)} ${v}`)
            if (x.nota) console.log(`  ${x.nota}`)
            for (const a of x.achados || []) console.log(`  [${a.gravidade}] ${a.titulo} — ${a.onde}`)
          }
          const v = res.veredito
          console.log(`\n${pedido}: ${v.aprovado ? 'APROVADO' : 'REPROVADO'}`)
          if (v.falhou.length) console.log(`  achou problema: ${v.falhou.join(', ')}`)
          if (v.faltaRodar.length) console.log(`  não rodou: ${v.faltaRodar.join(', ')}`)
          if (v.naoSeAplica.length) console.log(`  não se aplica aqui: ${v.naoSeAplica.join(', ')}`)
          if (v.semExecucao.length) console.log(`  ainda sem execução (dívida nossa): ${v.semExecucao.join(', ')}`)
          break
        }

        const saida = alvo === 'tudo' ? await B.rodarEscolhidas(r, cfg) : await B.rodar(r, alvo, cfg)
        if (saida.erro) die(saida.erro)
        const lista = saida.resultados || [saida]
        for (const x of lista) {
          /* "não olhei" nunca pode sair impresso como "limpo" — foi o defeito
             pego na camada `pacote-malicioso` em 16/08, com o npm falhando por
             falta de node_modules e a camada respondendo que estava tudo certo. */
          const veredito = x.verificou === false
            ? 'NÃO VERIFICADO'
            : x.ok && !x.achados?.length ? 'limpo' : `${x.achados?.length || 0} achado(s)`
          console.log(`${x.camada}: ${veredito}`)
          if (x.nota) console.log(`  ${x.nota}`)
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

      /* CC-133: a entrevista que conduz. Sem subcomando ela MOSTRA a próxima
         pergunta e para: quem responde é ele, e disparar a próxima sozinho
         seria transformar a conversa de volta em formulário. */
      case 'entrevista': {
        const r = exigeRaiz()
        const E = await import('./src/entrevista.mjs')
        const acao = positional[2]
        const e = D.ler(r)

        const mostrarProxima = (estado) => {
          const p = E.proxima(estado)
          if (!p) {
            console.log(`\nentrevista completa: ${E.progresso(estado).total} perguntas`)
            console.log(E.resumo(estado))
            const a = F.avaliar(estado.metodo, estado)
            if (a.pendencias?.length) a.pendencias.forEach((x) => console.log(`  ainda falta: ${x}`))
            else console.log(`  a fase ${a.tituloFase} está com tudo que precisa`)
            console.log('')
            return
          }
          console.log(`\n[${p.feitas + 1} de ${p.total}] ${p.header}`)
          console.log(`  ${p.pergunta}`)
          if (p.ajuda) console.log(`  (${p.ajuda})`)
          for (const o of p.opcoes || []) console.log(`    · ${o.valor.padEnd(11)} ${o.label} — ${o.descricao}`)
          console.log(`\n  responder: node cc.mjs framework entrevista responder "<sua resposta>"\n`)
        }

        if (acao === 'responder') {
          const texto = positional.slice(3).join(' ')
          if (!texto) die('uso: node cc.mjs framework entrevista responder "<sua resposta>"')
          const atual = E.proxima(e)
          if (!atual) { console.log('a entrevista já acabou'); break }
          const res = E.responder(e, atual.id, texto)
          if (!res.ok) die(res.erro)
          D.gravar(r, res.estado)
          console.log(`${atual.header}: ${res.resposta.texto}`)
          mostrarProxima(res.estado)
          break
        }

        if (acao === 'desfazer') {
          const id = positional[3]
          if (!id) die('uso: node cc.mjs framework entrevista desfazer <id da pergunta>')
          const res = E.desfazer(e, id)
          if (!res.ok) die(res.erro)
          D.gravar(r, res.estado)
          console.log(`apagada: ${id}`)
          if (res.orfas.length) console.log(`saíram junto, porque só existiam por causa dela: ${res.orfas.join(', ')}`)
          mostrarProxima(res.estado)
          break
        }

        if (acao === 'resumo') {
          console.log('\n' + E.resumo(e) + '\n')
          break
        }

        mostrarProxima(e)
        break
      }

      case 'status':
      case undefined: {
        if (!raiz) { console.log('este projeto não tem framework ligado'); break }
        mostrar(raiz)
        break
      }
      default:
        die(`uso: node cc.mjs framework [status|iniciar|modo <nome>|entrevista|autorizar [alvo]|mvp|avancar]`)
    }
    break
  }

  /* ===================== CC-187: um aparelho novo entra sozinho =====================
   *
   * Pedido dele: *"qualquer outro local que eu conecte meus agentes"*. Isso só
   * é verdade se ligar uma máquina nova não exigir uma pessoa com SSH: hoje o
   * caminho existe, e foi percorrido à mão, uma vez, por dentro da VPS.
   *
   * Três coisas e nenhuma a mais: como esta máquina se chama, para onde ela
   * empurra, e o token. O comando confirma na hora mandando um pacote de
   * verdade, porque configuração que só se prova amanhã não é configuração,
   * é esperança.
   */
  case 'federar': {
    const { readConfig } = await import('./src/config.mjs')
    const { setMaquina: gravarMaquina, setFederacao: gravarFederacao } = await import('./src/config.mjs')
    const sub = arg

    if (!sub || sub === 'status') {
      const cfg = readConfig()
      const f = cfg.federacao || {}
      console.log(`esta máquina : ${cfg.maquina?.nome || '(sem nome)'}${cfg.maquina?.id ? ` (${cfg.maquina.id})` : ''}`)
      console.log(`empurra para : ${f.enviarPara || '(ninguém)'}`)
      console.log(`token        : ${f.token ? `${f.token.slice(0, 4)}… (${f.token.length} caracteres)` : '(nenhum)'}`)
      if (!f.token || !f.enviarPara) {
        console.log('')
        console.log('para ligar esta máquina ao cockpit:')
        console.log('  cc federar ligar --para https://cockpit.exemplo.com --token <o token> [--nome "MEU PC"]')
        console.log('')
        console.log('o token é o mesmo do cockpit que recebe, na tela Remoto, campo "senha combinada".')
      }
      break
    }

    if (sub === 'desligar') {
      gravarFederacao({ token: '', enviarPara: '' })
      console.log('esta máquina parou de empurrar. O que já chegou lá continua lá.')
      break
    }

    if (sub !== 'ligar') {
      die('uso: cc federar [status]\n'
        + '     cc federar ligar --para <url> --token <token> [--nome "MEU PC"]\n'
        + '     cc federar desligar')
    }

    const para = val('--para', null)
    const token = val('--token', null)
    const nome = val('--nome', null)

    if (!para || !token) die('faltou --para <url do cockpit> ou --token <token>')
    if (!/^https?:\/\//i.test(para)) die(`--para precisa começar com http:// ou https://, recebi "${para}"`)

    if (nome) gravarMaquina({ nome })
    gravarFederacao({ token, enviarPara: para })

    /* A confirmação é o ponto do comando. Gravar e dizer "pronto" repetiria o
       defeito que este projeto passou o dia inteiro consertando: dizer que
       funcionou sem ter olhado. */
    const cfg = readConfig()
    console.log(`gravado: ${cfg.maquina?.nome || '(sem nome)'} empurra para ${cfg.federacao.enviarPara}`)
    console.log('conferindo com um envio de verdade…')
    const { montarPacote, enviar } = await import('./src/federacao.mjs')
    const { readJobs } = await import('./src/jobs.mjs')
    try {
      /* O pacote de conferência é o mesmo que o painel manda no ciclo normal,
         só que montado aqui: os jobs desta máquina e nada mais. Mandar um
         pacote vazio provaria só que o token passa, não que o dado chega. */
      const meus = readJobs()
      const r = await enviar({
        enviarPara: cfg.federacao.enviarPara,
        token: cfg.federacao.token,
        pacote: montarPacote({ maquina: cfg.maquina, jobs: meus }),
      })
      if (r?.ok) {
        console.log(`✓ chegou. Abra ${cfg.federacao.enviarPara} e esta máquina já aparece na lista.`)
      } else {
        console.log(`✗ não chegou: ${r?.erro || `resposta ${r?.status || 'sem status'}`}`)
        console.log('  o token e o endereço ficaram gravados. Confira o token no cockpit que recebe e rode de novo.')
        process.exitCode = 1
      }
    } catch (e) {
      console.log(`✗ não deu para enviar: ${e.message}`)
      console.log('  o token e o endereço ficaram gravados. Confira se o cockpit está no ar e rode de novo.')
      process.exitCode = 1
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
  /* CC-118: o que ele digitou e a fila descartou. Queixa dele: "as vezes eu
     digito aqui e o texto fica em itálico. daí ao sair da janela e voltar, o
     texto simplesmente some". O texto está no registro, e este comando o
     devolve, sem ninguém precisar escrever script na hora. */
  case 'fila': {
    const F = await import('./src/fila.mjs')
    const M = await import('./src/metaSessao.mjs')
    const sessao = val('--sessao') || M.sessaoAtual()
    if (!sessao) die('não sei de qual sessão: passe --sessao <id>')
    const transcrito = M.transcritoDe(sessao)
    if (!transcrito) die(`não achei o registro da sessão ${sessao}`)

    const lista = F.perdidas(transcrito)
    if (has('--json')) { console.log(JSON.stringify(lista, null, 2)); break }
    if (!lista.length) {
      console.log('\nnenhuma mensagem sua se perdeu nesta sessão.\n')
      break
    }
    const quantas = Number(val('--quantas', has('--tudo') ? lista.length : 5))
    console.log(`\n${lista.length} mensagem(ns) que você escreveu e a fila descartou antes de virar mensagem.`)
    console.log(`Mostrando ${Math.min(quantas, lista.length)}, da mais recente. Todas: --tudo\n`)
    for (const p of lista.slice(0, quantas)) {
      const quando = p.quando ? new Date(p.quando).toLocaleString('pt-BR') : 'sem hora'
      console.log(`── ${quando}  (${p.palavras} palavras)`)
      console.log(p.texto.split('\n').map((l) => `   ${l}`).join('\n'))
      console.log('')
    }
    break
  }
  /* O que ele falou e nunca virou item. Ideia dele em 17/08, ao encerrar o dia:
     "será que eh interessante colocar algo assim no end-session p ele procurar
     ideias não utilizadas e colocar no backlog se já não tiver?".

     Lista candidatas e diz se cada uma parece registrada. NÃO escreve no
     roadmap: quem decide o que vira item é ele, e quem escreve é o agente, com
     as palavras dele. Extrator que escrevesse sozinho encheria o backlog de
     ruído, e backlog com ruído é backlog que ninguém lê. */
  case 'ideias': {
    const I = await import('./src/ideias.mjs')
    const M = await import('./src/metaSessao.mjs')
    const fsx = await import('node:fs')

    const alvo = val('--roadmap') || path.join(process.cwd(), 'docs', 'ROADMAP.md')
    const raizProjeto = path.dirname(path.dirname(alvo))

    /* Ler a fila e resolver item NÃO dependem de sessão: quem retoma amanhã
       está noutra sessão, e exigir o transcrito da que capturou tornaria a fila
       inalcançável justamente para quem ela existe. Medido tentando: o comando
       morria com "não achei o registro da sessão". */

    /* A FILA, correção dele em 17/08: o fim da sessão captura, a próxima
       processa. Registrar item no encerramento adia o término de quem está com
       pressa, e a ideia acabava se perdendo de novo. */
    if (arg === 'pendentes' || arg === 'fila') {
      const fila = I.lerFila(raizProjeto)
      const ps = fila.pendentes || []
      if (has('--json')) { console.log(JSON.stringify(ps, null, 2)); break }
      if (!ps.length) { console.log('\nnenhuma ideia guardada esperando decisão\n'); break }
      console.log(`\n${ps.length} ideia(s) dele esperando virar item (ou serem descartadas).\n`)
      for (const p of ps) {
        const q = p.quando ? new Date(p.quando).toLocaleString('pt-BR') : 'sem hora'
        console.log(`── ${p.id}  ${q}`)
        console.log(p.texto.split('\n').map((l) => `   ${l}`).join('\n').slice(0, 1200))
        console.log('')
      }
      console.log('  Virou item, ou ele descartou?  node cc.mjs ideias resolver <id>\n')
      break
    }
    if (arg === 'resolver') {
      const id = positional[2]
      if (!id) die('uso: node cc.mjs ideias resolver <id>')
      const r = I.resolver(raizProjeto, id)
      if (!r.ok) die(r.erro)
      console.log(`ideia ${id} saiu da fila, restam ${r.restam}`)
      break
    }

    // daqui para baixo é a varredura, e ela precisa do registro da sessão
    const sessao = val('--sessao') || M.sessaoAtual()
    if (!sessao) die('não sei de qual sessão: passe --sessao <id>')
    const transcrito = M.transcritoDe(sessao)
    if (!transcrito) die(`não achei o registro da sessão ${sessao}`)
    let roadmap = ''
    try { roadmap = fsx.readFileSync(alvo, 'utf8') } catch { die(`não achei ${alvo}`) }

    const tudo = I.levantar(transcrito, roadmap)
    const faltando = tudo.filter((x) => !x.registrada)
    if (has('--json')) { console.log(JSON.stringify(faltando, null, 2)); break }

    /* Guardar é o padrão, e não uma opção: se depender de alguém lembrar da
       flag, a ideia se perde exatamente como se perdia antes. `--so-listar`
       existe para quem só quer ver. */
    const guardadas = has('--so-listar')
      ? null
      : I.guardar(raizProjeto, faltando, { sessao: String(sessao).slice(0, 8) })

    console.log(`\n${tudo.length} ideia(s) longa(s) dele nesta sessão, `
      + `${tudo.length - faltando.length} já cobertas pelo backlog.\n`)
    if (!faltando.length) { console.log('  nada a guardar\n'); break }

    for (const x of faltando) {
      const q = x.quando ? new Date(x.quando).toLocaleString('pt-BR') : 'sem hora'
      console.log(`── ${q}  (${x.palavras} palavras, ${Math.round(x.cobertura * 100)}% no backlog)`)
      console.log(x.texto.split('\n').map((l) => `   ${l}`).join('\n').slice(0, 900))
      console.log('')
    }
    if (guardadas) {
      console.log(`  ${guardadas.novos} guardada(s) para a próxima sessão, ${guardadas.total} na fila.`)
      console.log('  Não precisa decidir nada agora: `cc ideias pendentes` retoma com calma.\n')
    } else {
      console.log('  Nada guardado (--so-listar).\n')
    }
    break
  }
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

  /* A Bancada: o catálogo inteiro, e cada camada rodando sozinha.
     Decisão dele em 15/08 — declarar tudo vale por si, porque o catálogo passa
     a ser o mapa do que EXISTE para verificar, não a lista do que eu escrevi. */
  case 'bancada': {
    const B = await import('./src/bancada.mjs')
    const C = await import('./src/bancadaCatalogo.mjs')
    const raiz = path.resolve(val('--dir') || process.cwd())

    if (arg && arg !== 'rodar') die('uso: node cc.mjs bancada [rodar <camada>] [--dir X]')

    /* Os domínios da camada TLS saem do retrato da VPS que já existe — o
       `serverName` do nginx. Ele traz VÁRIOS por linha
       ("ahtleta.com.br www.ahtleta.com.br"), e passar a linha inteira como
       endereço deu dois falsos positivos no primeiro teste. */

    if (arg === 'rodar') {
      const id = positional[2]
      if (!id) die(`uso: node cc.mjs bancada rodar <camada>\ncamadas: ${C.CAMADAS.filter((c) => c.implementada).map((c) => c.id).join(', ')}`)
      const camada = C.camadaDe(id)
      if (!camada) die(`camada desconhecida: ${id}`)
      if (!camada.implementada) {
        die(`"${camada.nome}" está declarada mas ainda não roda.\n  ${camada.explica}\n`
          + `  ferramenta prevista: ${camada.ferramenta || '(própria)'}`)
      }
      console.log(`\n${camada.nome} — ${raiz}\n`)

      /* Os domínios da camada TLS saem do retrato da VPS que já existe. O
         `serverName` do nginx traz VÁRIOS por linha ("a.com.br www.a.com.br"),
         e passar a linha inteira como endereço deu dois falsos positivos no
         primeiro teste — daí o split. */
      const { readConfig } = await import('./src/config.mjs')
      const dominios = [...new Set(
        (readConfig().vpsSnapshot?.nginx || [])
          .flatMap((n) => String(n.serverName || '').split(/\s+/))
          .filter((d) => d.includes('.') && !d.includes('_') && !d.startsWith('*')),
      )]

      const r = await B.rodar(raiz, id, { dominios })
      if (r.erro) die(`  falhou: ${r.erro}`)
      if (!r.achados?.length) { console.log('  nada encontrado\n'); break }
      for (const a of r.achados) {
        console.log(`  [${a.gravidade}] ${a.titulo}`)
        console.log(`     onde: ${a.onde}`)
        if (a.conserto) console.log(`     como consertar: ${a.conserto}`)
      }
      console.log(`\n  ${r.achados.length} achado(s)\n`)
      process.exitCode = 1 // serve em CI: achado é falha
      break
    }

    const porGrupo = new Map()
    for (const c of C.CAMADAS) {
      if (!porGrupo.has(c.grupo)) porGrupo.set(c.grupo, [])
      porGrupo.get(c.grupo).push(c)
    }
    const rodam = C.CAMADAS.filter((c) => c.implementada).length
    console.log(`\n${C.CAMADAS.length} camadas · ${rodam} rodam hoje · ${C.CAMADAS.length - rodam} declaradas\n`)
    for (const [grupo, lista] of porGrupo) {
      console.log(`  ${grupo}`)
      for (const c of lista) {
        console.log(`    ${c.implementada ? '●' : '○'} ${c.id.padEnd(18)} ${c.nome}`)
      }
    }
    console.log('\n  ● roda agora   ○ declarada, ainda não implementada')
    console.log('  rodar uma:  cc bancada rodar <camada>\n')
    break
  }

  case 'json': {
    /* CC-124: achado em 17/08 pela sessão do app_escritorio, e confirmado
       medindo os dois lados no mesmo minuto — este comando respondia
       `{"jobs":[],"summary":{"total":0,...}}` com cinco agentes de verdade
       trabalhando, porque só varria a pasta de jobs de BACKGROUND. Sessão
       interativa (o caso normal na VPS, via Remote Control) grava em
       `control-center-sessoes/`, por outro caminho, que só o painel lia.

       O estrago está no `summary` zerado, não na lista vazia: `total: 0` e
       `projects: []` respondem com ar de autoridade, e quem confere acha que
       o reporte falhou — mesma família do botão que responde "ok" com o
       processo morto atrás. A correção é somar as duas fontes, a mesma conta
       que `/api/jobs` já faz no painel (`ignorar` evita duplicar quando a
       sessão interativa também tem job). */
    const doBackground = readJobs()
    const { readSessoes } = await import('./src/sessoes.mjs')
    const interativas = readSessoes(Date.now(), {
      ignorar: doBackground.flatMap((j) => [j.id, j.sessionId]),
    })
    const jobs = [...doBackground, ...interativas]
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
