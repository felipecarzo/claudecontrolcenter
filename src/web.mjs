// Servidor local: serve a página, o JSON e um stream SSE.
// Sem dependência: http + fs nativos.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJobs, summarize, writeMeta } from './jobs.mjs'
import { readServers, killServer } from './servers.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UI = path.join(HERE, 'ui.html')

const snapshot = () => {
  const jobs = readJobs()
  return { jobs, summary: summarize(jobs), at: Date.now() }
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')

  if (url.pathname === '/') return send(res, 200, fs.readFileSync(UI, 'utf8'), 'text/html; charset=utf-8')
  if (url.pathname === '/api/jobs') return send(res, 200, snapshot())

  // Escrita de meta pela própria página (marcar todo, anotar).
  if (url.pathname === '/api/meta' && req.method === 'POST') {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > 1e6) req.destroy() // guarda simples contra payload absurdo
    })
    req.on('end', () => {
      try {
        const { id, patch } = JSON.parse(body)
        if (!id || typeof patch !== 'object') throw new Error('id e patch obrigatórios')
        send(res, 200, { ok: true, meta: writeMeta(id, patch) })
      } catch (e) {
        send(res, 400, { ok: false, error: String(e.message || e) })
      }
    })
    return
  }

  // Consultado só pela aba de servidores: a varredura leva ~3s e não pode
  // pesar no painel principal nem no stream.
  if (url.pathname === '/api/servers') return send(res, 200, { servers: readServers() })

  if (url.pathname === '/api/kill' && req.method === 'POST') {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > 1e4) req.destroy()
    })
    req.on('end', () => {
      try {
        const { pid } = JSON.parse(body)
        send(res, 200, { ok: true, killed: killServer(pid) })
      } catch (e) {
        send(res, 400, { ok: false, error: String(e.message || e) })
      }
    })
    return
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
      const fingerprint = JSON.stringify(snap.jobs)
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
