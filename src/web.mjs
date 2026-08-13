// Servidor local: serve a página, o JSON e um stream SSE.
// Sem dependência: http + fs nativos.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJobs, summarize, writeMeta } from './jobs.mjs'
import { tarefas } from './tarefas.mjs'
import { arquivar, jobsHistoricos } from './historico.mjs'
import { readUso } from './uso.mjs'
import {
  estado as estadoMidia, acao as acaoMidia,
  volume as volumeMidia, mudo as mudoMidia,
} from './midia.mjs'
import { estado as estadoMaquina } from './maquina.mjs'
import { lerRoadmap } from './roadmap.mjs'
import { garantirMercado } from './mercado.mjs'
import {
  readServers, killServer, duplicados, recentes, projetosLancaveis,
  subirServidor, abrirLocal, esquecerCache,
} from './servers.mjs'
import { readPaineis, ligarPainel, desligarPainel } from './paineis.mjs'
import { readNotes, writeNotes } from './notes.mjs'
import { resumo as resumoTempo } from './tempo.mjs'
import {
  setTaxa, setCambio, setAssinatura, setGraficos, setMercado, setSessao, setServidor, setPip,
  setVpsConfig, setCalendario, removerCalendario, hookEnabled, setHookEnabled, readConfig,
} from './config.mjs'
import { agenda, esquecerCache as esquecerAgenda } from './calendario.mjs'
import { HOOKS } from './hooksCatalogo.mjs'
import { registradoTodos } from './hooksRegistro.mjs'
import { porProjeto } from './cockpit.mjs'
import { listarContainers } from './docker.mjs'
import { atualizarSnapshot } from './vps.mjs'
import { estado as estadoProcessos } from './processos.mjs'
import { garantirCambio } from './cambio.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UI = path.join(HERE, 'ui.html')
const GRAFICOS = path.join(HERE, 'graficos.js')

const snapshot = () => {
  const jobs = readJobs()
  // O CLI apaga job antigo, e com ele a única cópia dos to-dos. Arquivar aqui
  // é barato: só grava quando algo mudou, e o painel já releu tudo mesmo.
  arquivar(jobs)
  // Vai junto do snapshot porque tem que aparecer em toda aba, sempre: é
  // leitura de um JSON de 200 bytes, não pesa no tique de 2s.
  //
  // `cockpit` também vem pronto do servidor, pelo mesmo motivo do `summary`:
  // é derivado dos mesmos jobs (map/sort em memória, zero I/O) e a lógica de
  // ordenação por urgência mora em `cockpit.mjs`, que o `npm test` cobre —
  // duplicá-la em JS de navegador seria ter duas verdades pra "o que é
  // urgente".
  return { jobs, summary: summarize(jobs), cockpit: porProjeto(jobs), uso: readUso(), at: Date.now() }
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

/** Junta o corpo, com teto contra payload absurdo, e devolve o JSON. */
const comCorpo = (req, res, max, fn) => {
  let body = ''
  req.on('data', (c) => {
    body += c
    if (body.length > max) req.destroy()
  })
  req.on('end', () => {
    try {
      send(res, 200, { ok: true, ...fn(JSON.parse(body)) })
    } catch (e) {
      send(res, 400, { ok: false, error: String(e.message || e) })
    }
  })
}

/** Igual ao `comCorpo`, para quando o que responde devolve promessa. */
const comCorpoAsync = (req, res, max, fn) => {
  let body = ''
  req.on('data', (c) => {
    body += c
    if (body.length > max) req.destroy()
  })
  req.on('end', async () => {
    try {
      send(res, 200, { ok: true, ...(await fn(JSON.parse(body))) })
    } catch (e) {
      send(res, 400, { ok: false, error: String(e.message || e) })
    }
  })
}

function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')

  if (url.pathname === '/') return send(res, 200, fs.readFileSync(UI, 'utf8'), 'text/html; charset=utf-8')
  if (url.pathname === '/graficos.js') {
    return send(res, 200, fs.readFileSync(GRAFICOS, 'utf8'), 'text/javascript; charset=utf-8')
  }
  if (url.pathname === '/api/jobs') return send(res, 200, snapshot())

  // Escrita de meta pela própria página (marcar todo, anotar).
  if (url.pathname === '/api/meta' && req.method === 'POST') {
    return comCorpo(req, res, 1e6, ({ id, patch }) => {
      if (!id || typeof patch !== 'object') throw new Error('id e patch obrigatórios')
      return { meta: writeMeta(id, patch) }
    })
  }

  // Bloco de notas da máquina. Fora de /api/jobs: nota não é agente, e o
  // stream compara os jobs pra decidir se manda evento.
  if (url.pathname === '/api/notes') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 5e6, ({ notes }) => ({ notes: writeNotes(notes) }))
    }
    return send(res, 200, { notes: readNotes() })
  }

  // Consultado só pela aba de servidores: a varredura leva ~3s e não pode
  // pesar no painel principal nem no stream.
  if (url.pathname === '/api/servers') {
    const servers = readServers()
    return send(res, 200, {
      servers,
      // só os PIDs: a página já tem a lista inteira e não precisa dela de novo
      duplicados: duplicados(servers).map((g) => ({
        project: g.project, kind: g.kind, manter: g.manter.pid, matar: g.matar.map((s) => s.pid),
      })),
      recentes: recentes(),
    })
  }

  // Apelido, explicação e favorito de um servidor. Some do cache na hora:
  // esperar os 15s da varredura pareceria que o texto não foi salvo.
  if (url.pathname === '/api/servidor' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ chave, patch }) => {
      if (!chave || typeof patch !== 'object') throw new Error('chave e patch obrigatórios')
      const salvo = setServidor(chave, patch)
      esquecerCache()
      return { servidor: salvo }
    })
  }

  // Varre o disco atrás de pastas de projeto: só o construtor de "subir" pede.
  if (url.pathname === '/api/projetos') return send(res, 200, { projetos: projetosLancaveis() })

  if (url.pathname === '/api/subir' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, (corpo) => ({ subiu: subirServidor(corpo) }))
  }

  if (url.pathname === '/api/abrir' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ dir, como }) => ({ aberto: abrirLocal(dir, como) }))
  }

  // Containers Docker desta máquina. Fora do stream, mesmo motivo da máquina
  // e dos servidores: `docker ps` spawna processo e não pode travar o tique
  // de 2s dos agentes.
  if (url.pathname === '/api/docker') {
    return listarContainers({ force: url.searchParams.has('force') }).then((d) => send(res, 200, d))
  }

  // Top processos por CPU/RAM/VRAM. É o mais caro dos três (PowerShell +
  // Get-Process de todos os processos), por isso o cache mais largo dentro
  // do próprio módulo — aqui só repassa.
  if (url.pathname === '/api/processos') {
    return estadoProcessos({ force: url.searchParams.has('force') }).then((d) => send(res, 200, d || { indisponivel: true }))
  }

  // "Onde eu mexo agora": projetos ordenados por urgência. Barato de
  // propósito — só relê os mesmos jobs do snapshot, sem tempo.mjs nem spawn,
  // então pode ser consultado à vontade.
  if (url.pathname === '/api/cockpit') {
    return send(res, 200, { projetos: porProjeto(readJobs()), at: Date.now() })
  }

  // Catálogo de hooks + se cada um está ligado (control-center.json) e
  // registrado de verdade (settings.json do Claude Code, só leitura).
  if (url.pathname === '/api/hooks') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ id, on }) => {
        if (!HOOKS.some((h) => h.id === id)) throw new Error(`hook desconhecido: ${id}`)
        return { ligado: setHookEnabled(id, on) }
      })
    }
    const registrados = registradoTodos(HOOKS)
    return send(res, 200, {
      hooks: HOOKS.map((h) => ({ ...h, ligado: hookEnabled(h.id), registrado: registrados[h.id] })),
    })
  }

  // O que a janela flutuante mostra. GET pra montar o painel de configurações
  // sem esperar o primeiro /api/jobs; POST grava a escolha.
  if (url.pathname === '/api/pip') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ blocos, layout }) => ({ pip: setPip({ blocos, layout }) }))
    }
    return send(res, 200, { pip: readConfig().pip })
  }

  // Config de conexão + o último retrato lido. Nunca devolve o caminho da
  // chave: não é segredo, mas não tem por que trafegar pro navegador.
  if (url.pathname === '/api/vps') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, ({ host, usuario, chave }) => ({ vps: setVpsConfig({ host, usuario, chave }) }))
    }
    const cfg = readConfig()
    return send(res, 200, {
      configurado: Boolean(cfg.vps?.host),
      host: cfg.vps?.host || null,
      usuario: cfg.vps?.usuario || 'root',
      snapshot: cfg.vpsSnapshot,
    })
  }

  // SSH de verdade, só aqui: botão clicado pelo Felipe, nunca timer. Pode
  // demorar (rede + comando remoto), por isso o timeout mais largo.
  if (url.pathname === '/api/vps/atualizar' && req.method === 'POST') {
    return atualizarSnapshot()
      .then((snapshot) => send(res, 200, { ok: true, snapshot }))
      .catch((e) => send(res, 500, { ok: false, error: String(e.message || e) }))
  }

  // Agenda do Google, por iCal. GET traz os eventos da janela pedida; POST
  // cadastra um calendário. A resposta NUNCA inclui o endereço: ele é a
  // credencial de leitura da agenda, e uma captura de tela do painel vazaria
  // a agenda inteira do Felipe pra quem visse a imagem.
  if (url.pathname === '/api/calendario') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e4, (corpo) => {
        const cal = setCalendario(corpo)
        esquecerAgenda() // senão o calendário novo só apareceria 15 min depois
        return { calendario: cal }
      })
    }
    const dias = Number(url.searchParams.get('dias'))
    return agenda({
      dias: Number.isFinite(dias) ? dias : 7,
      force: url.searchParams.has('force'),
    }).then((d) => send(res, 200, d)).catch((e) => send(res, 500, { erro: String(e.message || e) }))
  }

  if (url.pathname === '/api/calendario/remover' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ id }) => {
      const calendarios = removerCalendario(id)
      esquecerAgenda()
      return { calendarios }
    })
  }

  // Idem: lê ~800MB de transcript na primeira vez. Só a aba de tempo pede, e
  // as vezes seguintes releem apenas o que mudou.
  if (url.pathname === '/api/tempo') {
    const num = (v, padrao) => (Number.isFinite(Number(v)) ? Number(v) : padrao)
    const dia = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null)
    // A cotação é buscada antes do resumo, e não em paralelo, porque o resumo
    // lê o câmbio do config: em paralelo, a primeira carga do dia sairia sem
    // real e só a segunda mostraria a coluna.
    return garantirCambio().then(() => {
      try {
        send(res, 200, resumoTempo({
          corteMin: num(url.searchParams.get('corte'), 15),
          de: dia(url.searchParams.get('de')),
          ate: dia(url.searchParams.get('ate')),
          force: url.searchParams.has('force'),
        }))
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  // Cotação digitada à mão. Grava `manual`, e a busca automática passa a
  // respeitar o número — quem fecha preço não quer o valor trocando sozinho.
  if (url.pathname === '/api/cambio' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ valor }) => ({
      cambio: setCambio({ brlPorUsd: valor, manual: Number(valor) > 0 }),
    }))
  }

  // Taxa em R$/hora, global ou por projeto. Fica no config e não no cache de
  // tempo: mudar a taxa não pode invalidar 800 MB de varredura.
  if (url.pathname === '/api/taxa' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ valor, projeto }) => ({
      config: setTaxa(valor, { projeto: projeto || null }),
    }))
  }

  if (url.pathname === '/api/graficos') {
    if (req.method === 'POST') {
      return comCorpo(req, res, 1e5, ({ graficos }) => ({ graficos: setGraficos(graficos) }))
    }
    return send(res, 200, { graficos: readConfig().graficos })
  }

  if (url.pathname === '/api/assinatura' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ valor }) => ({ config: setAssinatura(valor) }))
  }

  // Preço por tarefa. Puxa o mercado antes do cálculo, pelo mesmo motivo do
  // câmbio: o cálculo lê as faixas do config e sairia sem elas na primeira vez.
  if (url.pathname === '/api/tarefas') {
    const num = (v, padrao) => (Number.isFinite(Number(v)) ? Number(v) : padrao)
    return garantirMercado({ force: url.searchParams.has('mercado') }).then(() => {
      try {
        send(res, 200, tarefas({
          corteMin: num(url.searchParams.get('corte'), 15),
          unidade: url.searchParams.get('unidade') === 'sessao' ? 'sessao' : 'todo',
        }))
      } catch (e) {
        send(res, 500, { error: String(e.message || e) })
      }
    })
  }

  if (url.pathname === '/api/mercado' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, (m) => ({ mercado: setMercado({ ...m, manual: true }) }))
  }

  // Correção de nível e tempo digitado. Sessão vai pro config; to-do vai pro
  // meta.json do job, mesclado item a item para não apagar as outras tarefas.
  if (url.pathname === '/api/tarefa' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ sessao, job, tarefa, nivel, horas }) => {
      if (sessao) return { ajuste: setSessao(sessao, { nivel, horas }) }
      if (!job || !tarefa) throw new Error('informe sessao, ou job e tarefa')
      const atual = readJobs().find((j) => j.id === job)
      if (!atual) throw new Error(`job ${job} não existe`)
      const niveis = { ...atual.niveis }
      const estimativas = { ...atual.estimativas }
      if (['junior', 'pleno', 'senior'].includes(nivel)) niveis[tarefa] = nivel
      else delete niveis[tarefa]
      if (Number(horas) > 0) estimativas[tarefa] = Math.min(Number(horas), 1000)
      else delete estimativas[tarefa]
      return { meta: writeMeta(job, { niveis, estimativas }) }
    })
  }

  // Mapa do projeto, lido do ROADMAP.md dele. Recebe o `cwd` de um agente
  // porque é de lá que se sobe até achar o arquivo — o painel não guarda
  // caminho de projeto em lugar nenhum.
  if (url.pathname === '/api/roadmap') {
    const cwd = url.searchParams.get('cwd') || ''
    const mapa = cwd ? lerRoadmap(cwd) : null
    return send(res, 200, mapa || { vazio: true })
  }

  // Sensores da máquina. Fora do stream pelo mesmo motivo da mídia: a leitura
  // da GPU spawna processo, e o tique de 2s dos agentes não pode depender disso.
  if (url.pathname === '/api/maquina') {
    return estadoMaquina({ force: url.searchParams.has('force') })
      .then((d) => send(res, 200, d))
      .catch((e) => send(res, 500, { erro: String(e.message || e) }))
  }

  // Mídia: consultada pela barra do player, que pergunta a cada poucos
  // segundos. Cache curto mora no módulo; aqui só se decide ler ou escrever.
  if (url.pathname === '/api/midia') {
    return estadoMidia({ force: url.searchParams.has('force') })
      .then((d) => send(res, 200, d))
      .catch((e) => send(res, 500, { erro: String(e.message || e) }))
  }

  if (url.pathname === '/api/midia/acao' && req.method === 'POST') {
    return comCorpoAsync(req, res, 1e4, ({ indice, qual }) => acaoMidia(indice, qual))
  }

  if (url.pathname === '/api/midia/volume' && req.method === 'POST') {
    return comCorpoAsync(req, res, 1e4, ({ pid, nivel, mudo }) => (
      mudo === undefined ? volumeMidia(pid, nivel) : mudoMidia(pid, mudo)
    ))
  }

  if (url.pathname === '/api/kill' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ pid }) => ({ killed: killServer(pid) }))
  }

  // Painéis de acompanhamento (aba escritório). Estado sai da mesma varredura
  // de portas da aba de servidores, então não custa consulta nova.
  if (url.pathname === '/api/paineis') {
    return send(res, 200, { paineis: readPaineis({ force: url.searchParams.has('force') }) })
  }

  // Ligar e desligar recebem `id`, nunca pid: o pid vem da porta declarada no
  // próprio módulo, então a página não consegue mandar encerrar processo
  // arbitrário mesmo se alguém mexer no JavaScript.
  if (url.pathname === '/api/paineis/ligar' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ id }) => ({ painel: ligarPainel(id) }))
  }

  if (url.pathname === '/api/paineis/desligar' && req.method === 'POST') {
    return comCorpo(req, res, 1e4, ({ id }) => ({ painel: desligarPainel(id) }))
  }

  // Existe pra `daemon restart` conseguir derrubar o processo antigo: o servidor
  // não recarrega módulo, então mexer no código exige reiniciar de verdade.
  if (url.pathname === '/api/shutdown' && req.method === 'POST') {
    send(res, 200, { ok: true })
    setTimeout(() => process.exit(0), 100)
    return
  }

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    })
    let last = ''
    const push = () => {
      const snap = snapshot()
      const json = JSON.stringify(snap)
      // compara sem o timestamp, senão manda evento a cada tick
      const fingerprint = JSON.stringify([snap.jobs, snap.uso])
      if (fingerprint === last) return
      last = fingerprint
      res.write(`data: ${json}\n\n`)
    }
    push()
    const timer = setInterval(push, 2000)
    req.on('close', () => clearInterval(timer))
    return
  }

  send(res, 404, { error: 'not found' })
}

/** Sobe na primeira porta livre a partir de `port`. */
export function startWeb({ port = 8099, tries = 10 } = {}) {
  return new Promise((resolve, reject) => {
    let attempt = 0
    const server = http.createServer(handler)
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && attempt < tries) {
        attempt++
        server.listen(port + attempt, '127.0.0.1')
      } else reject(e)
    })
    server.on('listening', () => resolve({ server, url: `http://localhost:${server.address().port}` }))
    server.listen(port, '127.0.0.1')
  })
}
