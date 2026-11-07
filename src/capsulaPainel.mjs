/* CC-1080, passo 2: o que o painel oferece da cápsula (rotas /api/capsula/*, tela Cápsulas).
 *
 * O painel é o ÚNICO lugar onde o Docker roda (ver capsulaDocker.mjs). Aqui só se escolhe projeto do registro: o painel nunca
 * recebe um caminho de fora. A senha vai ao processo filho por stdin e não é gravada nem logada em lugar nenhum.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as C from './capsula.mjs'
import * as Dk from './capsulaDocker.mjs'
import { contar } from './capsulaServidor.mjs'
import { listar as listarRegistro } from './projetoRegistro.mjs'

export const SENHA_MIN = 12
/** A medição (Estimar) roda num processo filho e tem teto: a frio, medir uma pasta grande chegou a 15 s só no disco. */
export const ENSAIO_TETO_MS = 120000
const NOME_RE = /^[A-Za-z0-9._-]+\.capsula\.tar\.gz$/
const BASE_RE = /^(.+)-\d{8}-\d{4}(?:-\d+)?\.capsula\.tar\.gz$/
const ID_RE = /^[0-9a-f]{16}$/
const JOB = fileURLToPath(new URL('./capsulaJob.mjs', import.meta.url))
const estadoDir = () => path.join(C.pastaCapsulas(), '.estado')
const JOBS = new Map() // id -> { proc, projeto, tipo: 'fazer' | 'ensaio', estourou }
const vivo = (proc) => proc.exitCode === null && proc.signalCode === null

/** Os projetos do registro que têm pasta NESTA máquina. */
export function projetosLocais() {
  const r = []
  for (const p of listarRegistro()) {
    const raiz = Object.values(p.maquinas || {}).map((m) => m && m.raiz).find((x) => typeof x === 'string' && x.startsWith('/') && fs.existsSync(x) && fs.statSync(x).isDirectory())
    if (raiz) r.push({ id: p.id, nome: path.basename(raiz), raiz })
  }
  return r
}
const achar = (q) => {
  const p = projetosLocais().find((x) => x.id === q || x.nome === q)
  if (!p) throw new Error(`projeto "${q}" não está no registro, ou não tem pasta nesta máquina`)
  return p
}

const cache = new Map()
const lerManifesto = (f) => new Promise((resolve) => {
  execFile('tar', ['-xzOf', f, '--occurrence=1', 'manifesto.json'], { maxBuffer: 16 * 1024 * 1024, timeout: 60000 }, (e, out) => {
    if (e) return resolve(null)
    try { resolve(JSON.parse(out)) } catch { resolve(null) }
  })
})

async function infoCapsula(nome) {
  const f = path.join(C.pastaCapsulas(), nome)
  const st = fs.statSync(f)
  const chave = `${nome}:${st.size}:${st.mtimeMs}`
  let r = cache.get(chave)
  if (!r) {
    const m = await lerManifesto(f)
    const d = m && m.docker
    r = {
      arquivo: nome, bytes: st.size, criada_em: (m && m.criada_em) || st.mtime.toISOString(),
      provada: m ? m.provada : { ok: null, motivo: 'não consegui ler o manifesto desta cápsula' },
      docker: d ? { projeto_compose: d.projeto_compose || null, motivo: d.motivo || null, imagens: (d.imagens || []).length, volumes: (d.volumes || []).length, bancos: (d.bancos || []).length, falhas: (d.falhas || []).length } : null,
      servidor: m ? contar(m.servidor) : null,
      pastas: m ? { publicado: (m.publicado || []).filter((x) => x.estado === 'coletada').length, montagens: (m.montagens || []).filter((x) => x.estado === 'coletada').length } : null,
      nao_coletado: (m && m.nao_coletado_total) || 0,
    }
    cache.set(chave, r)
  }
  return r
}

export const jobAtivo = () => {
  for (const [id, j] of JOBS) if (j.tipo === 'fazer' && vivo(j.proc)) return { id, projeto: j.projeto }
  return null
}
export const ensaioAtivo = () => {
  for (const [id, j] of JOBS) if (j.tipo === 'ensaio' && vivo(j.proc)) return { id, projeto: j.projeto }
  return null
}

/** GET /api/capsula/lista */
export async function lista() {
  const pasta = C.pastaCapsulas()
  const nomes = (fs.existsSync(pasta) ? fs.readdirSync(pasta) : []).filter((n) => NOME_RE.test(n))
  const caps = (await Promise.all(nomes.map(infoCapsula))).sort((a, b) => (a.criada_em < b.criada_em ? 1 : -1))
  const base = (c) => (BASE_RE.exec(c.arquivo) || [])[1]
  const projetos = projetosLocais().map((p) => ({ ...p, capsulas: caps.filter((c) => base(c) === p.nome) }))
  const conhecidos = new Set(projetos.map((p) => p.nome))
  return { pasta, livre: C.discoLivre(pasta), minimo: C.MIN_SOBRA, projetos, orfas: caps.filter((c) => !conhecidos.has(base(c))), ativo: jobAtivo() }
}

/** A medição em si (só mede; no Docker só lê). SÍNCRONA em boa parte (varre pastas): por isso a rota NUNCA a chama no processo do
 *  painel, só o processo filho (capsulaJob.mjs, modo ensaio) e os testes. `p` = { nome, raiz }. */
export async function medir(p, { executar = null, servidor = {}, incluirCandidatos = false } = {}) {
  // PM2 e crontab só são consultados ao FAZER (rodam em processo filho): aqui o painel não pode travar. nginx, unidades e domínios sim.
  const e = await C.ensaioCompleto(p.raiz, { incluirCandidatos: incluirCandidatos === true, docker: { executar: executar || Dk.executorPadrao() }, servidor: { lerPm2: false, crontab: () => ({ ok: false, motivo: 'só é consultado ao fazer a cápsula' }), ...servidor } })
  return { projeto: p.nome, ...e }
}
/** Mede no processo de quem chama (testes, uso direto). O painel usa `iniciarEnsaio`. */
export async function ensaio(q, opts = {}) { return medir(achar(q), opts) }

/** POST /api/capsula/ensaio: devolve um id na hora; a medição é do processo filho (como o fazer), com teto de tempo. O resultado
 *  vem em GET /api/capsula/estado/:id, no campo `resultado`. `tetoMs` e `atrasoMs` só os testes mexem (atraso = medição lenta simulada). */
export function iniciarEnsaio(q, { incluirCandidatos = false, tetoMs = Number(process.env.CC_CAPSULA_ENSAIO_TETO_MS) || ENSAIO_TETO_MS, atrasoMs = Number(process.env.CC_CAPSULA_ENSAIO_ATRASO_MS) || 0 } = {}) {
  const p = achar(q)
  const ativo = ensaioAtivo()
  if (ativo && ativo.projeto === p.nome) return { id: ativo.id, projeto: p.nome, ja_medindo: true } // clique repetido: acompanha a mesma medição
  if (ativo) throw new Error(`já tem uma medição em andamento (${ativo.projeto}). Espere ela terminar.`)
  const id = crypto.randomBytes(8).toString('hex')
  fs.mkdirSync(estadoDir(), { recursive: true, mode: 0o700 })
  const estado = path.join(estadoDir(), `${id}.json`)
  fs.writeFileSync(estado, JSON.stringify({ id, tipo: 'ensaio', projeto: p.nome, inicio: Date.now(), fase: 'medindo', ok: null }), { mode: 0o600 })
  const proc = spawn(process.execPath, [JOB, JSON.stringify({ modo: 'ensaio', id, projeto: p.nome, pasta: p.raiz, estado, incluirCandidatos: incluirCandidatos === true, atrasoMs })], { stdio: ['ignore', 'ignore', 'pipe'], env: process.env })
  let erro = ''
  proc.stderr.on('data', (d) => { erro = (erro + d).slice(-1500) })
  const j = { proc, projeto: p.nome, tipo: 'ensaio', estourou: false }
  const relogio = setTimeout(() => { j.estourou = true; try { proc.kill('SIGKILL') } catch { /* já saiu */ } }, tetoMs)
  relogio.unref()
  proc.on('close', (code) => {
    clearTimeout(relogio)
    const e = lerEstado(id)
    if (e && e.fim == null) {
      const msg = String(erro).trim().split('\n').slice(-3).join(' | ')
      const motivo = j.estourou
        ? `a medição passou de ${Math.round(tetoMs / 1000)} s e foi interrompida (disco lento ou pasta muito grande). Tente de novo: a segunda vez costuma ser bem mais rápida, com o disco já em cache.`
        : `o processo da medição terminou (código ${code}) sem concluir${msg ? `: ${msg}` : ''}`
      fs.writeFileSync(estado, JSON.stringify({ ...e, fase: 'falhou', fim: Date.now(), ok: false, erro: motivo }), { mode: 0o600 })
    }
  })
  JOBS.set(id, j)
  return { id, projeto: p.nome }
}

/** POST /api/capsula/fazer: devolve um id na hora; o trabalho é do processo filho. A senha vai só por stdin. */
export function iniciar(q, senha, { incluirCandidatos = false } = {}) {
  if (typeof senha !== 'string' || senha.length < SENHA_MIN) throw new Error(`a senha precisa ter pelo menos ${SENHA_MIN} caracteres`)
  if (/[\r\n]/.test(senha)) throw new Error('a senha não pode ter quebra de linha')
  const p = achar(q)
  const ativo = jobAtivo()
  if (ativo) throw new Error(`já tem uma cápsula sendo feita (${ativo.projeto}). Espere ela terminar.`)
  const id = crypto.randomBytes(8).toString('hex')
  fs.mkdirSync(estadoDir(), { recursive: true, mode: 0o700 })
  const estado = path.join(estadoDir(), `${id}.json`)
  fs.writeFileSync(estado, JSON.stringify({ id, projeto: p.nome, inicio: Date.now(), fase: 'iniciando', ok: null }), { mode: 0o600 })
  const proc = spawn(process.execPath, [JOB, JSON.stringify({ id, projeto: p.nome, pasta: p.raiz, saida: C.pastaCapsulas(), estado, incluirCandidatos: incluirCandidatos === true })], { stdio: ['pipe', 'ignore', 'pipe'], env: process.env })
  let erro = ''
  proc.stderr.on('data', (d) => { erro = (erro + d).slice(-1500) })
  proc.stdin.on('error', () => {})
  proc.stdin.end(senha + '\n')
  proc.on('close', (code) => {
    const e = lerEstado(id)
    if (e && e.fim == null) {
      const msg = String(erro).split(senha).join('***').trim().split('\n').slice(-3).join(' | ')
      fs.writeFileSync(estado, JSON.stringify({ ...e, fase: 'falhou', fim: Date.now(), ok: false, erro: `o processo da cápsula terminou (código ${code}) sem concluir${msg ? `: ${msg}` : ''}` }), { mode: 0o600 })
    }
  })
  JOBS.set(id, { proc, projeto: p.nome, tipo: 'fazer' })
  return { id, projeto: p.nome }
}

function lerEstado(id) {
  try { return JSON.parse(fs.readFileSync(path.join(estadoDir(), `${id}.json`), 'utf8')) } catch { return null }
}

/** GET /api/capsula/estado/:id */
export function estado(id) {
  if (!ID_RE.test(String(id))) throw new Error('id inválido')
  const e = lerEstado(id)
  if (!e) throw new Error('não conheço esse andamento')
  if (e.fim == null && !JOBS.has(id)) return { ...e, fase: 'interrompida', fim: Date.now(), ok: false, erro: e.tipo === 'ensaio' ? 'o painel reiniciou no meio da medição; meça de novo' : 'o painel reiniciou no meio da cápsula; refaça' }
  return e
}

/** GET /api/capsula/baixar/:arquivo: só arquivo .capsula.tar.gz direto da pasta de cápsulas, sem caminho. */
export function arquivoParaBaixar(nome) {
  if (typeof nome !== 'string' || nome.includes('..') || !NOME_RE.test(nome)) return null
  const f = path.join(C.pastaCapsulas(), nome)
  try { const st = fs.statSync(f); return st.isFile() ? { caminho: f, bytes: st.size } : null } catch { return null }
}
