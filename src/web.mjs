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
import { garantirMercado } from './mercado.mjs'
import { readServers, killServer } from './servers.mjs'
import { readPaineis, ligarPainel, desligarPainel } from './paineis.mjs'
import { readNotes, writeNotes } from './notes.mjs'
import { resumo as resumoTempo } from './tempo.mjs'
import { setTaxa, setCambio, setAssinatura, setGraficos, setMercado, setSessao, readConfig } from './config.mjs'
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
  return { jobs, summary: summarize(jobs), uso: readUso(), at: Date.now() }
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
  if (url.pathname === '/api/servers') return send(res, 200, { servers: readServers() })

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
