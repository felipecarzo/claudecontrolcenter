#!/usr/bin/env node
/**
 * CC-1045: prova de que o programa único (`hooks/parada.mjs`) devolve o mesmo
 * que os guardas rodando sozinhos.
 *
 * Entradas REAIS: conversas paradas há mais de 30 minutos em ~/.claude/projects,
 * de projetos diferentes, lidas sem escrever nada. Para cada entrada e cada
 * guarda, compara código, stdout e stderr do guarda sozinho (processo próprio,
 * como o Claude Code roda hoje) contra o mesmo guarda dentro do programa.
 *
 * Nenhum guarda roda com a casa real: cada execução ganha uma pasta temporária
 * nova, com `CC_HOME` e `HOME` apontando para ela (o `estilo.mjs` grava a
 * lembrança do jargão por `os.homedir()`, que não passa pelo `CC_HOME`).
 *
 * Rápido por padrão (2 entradas, para o gate). Completo: PARADA_COMPLETO=1.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GUARDAS, SOZINHOS, juntar } from './hooks/parada.mjs'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const HOOKS = path.join(RAIZ, 'hooks')
const COMPLETO = !!process.env.PARADA_COMPLETO
const PROJETOS = path.join(os.homedir(), '.claude', 'projects')
const PROIBIDAS = /racioc|pensament|thinking|reasoning|chain of thought/i

let falhas = 0
const ok = (cond, msg) => { if (!cond) { falhas++; console.error(`FALHOU: ${msg}`) } }

/* A lista: os 31 do settings de 12/10, cada um uma vez, dentro ou fora. */
const NOMES_31 = ['routia/todo-guard', 'routia/routia-fim', 'roadmap-guard', 'estilo-fim', 'pergunta-guard',
  'gate-guard', 'fluxo-guard', 'guia-guard', 'bancada-guard', 'reporte-guard', 'pronto-guard', 'jargao-guard',
  'resumo-guard', 'fila-guard', 'tarefa-vaga-guard', 'referencia-guard', 'forma-guard', 'enfileirada-guard',
  'teto-guard', 'travessao-guard', 'visual-guard', 'descida-guard', 'medir-guard', 'diario-guard',
  'sincronia-guard', 'tarefas-fim', 'quadro-guard', 'copiar-guard', 'onde-guard', 'fala-guard', 'ideia-guard']
const todos = [...GUARDAS, ...SOZINHOS.map((s) => s.nome)]
ok(todos.length === 31 && new Set(todos).size === 31 && NOMES_31.every((n) => todos.includes(n)), 'lista de guardas diferente dos 31')
for (const s of SOZINHOS) ok(s.motivo, `${s.nome} fora do programa sem motivo`)
for (const g of GUARDAS) ok(fs.existsSync(path.join(HOOKS, `${g}.mjs`)), `${g}.mjs não existe`)

/* O texto que o programa junta não pode ter as palavras que acionam as travas. */
const fonte = fs.readFileSync(path.join(HOOKS, 'parada.mjs'), 'utf8')
ok(!PROIBIDAS.test(fonte), 'parada.mjs tem palavra proibida')

function cwdDe(arquivo) {
  const fd = fs.openSync(arquivo, 'r')
  try {
    const tam = fs.fstatSync(fd).size
    const n = Math.min(tam, 512 * 1024)
    const buf = Buffer.alloc(n)
    fs.readSync(fd, buf, 0, n, tam - n)
    const m = [...buf.toString('utf8').matchAll(/"cwd":"([^"]+)"/g)].pop()
    return m ? m[1] : null
  } finally { fs.closeSync(fd) }
}

function entradas(quantas) {
  const agora = Date.now()
  const achadas = []
  const vistos = new Set()
  for (const d of fs.readdirSync(PROJETOS)) {
    const dir = path.join(PROJETOS, d)
    let arqs = []
    try { arqs = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => ({ f: path.join(dir, f), s: fs.statSync(path.join(dir, f)) })) } catch { continue }
    const bom = arqs.filter((a) => agora - a.s.mtimeMs > 30 * 60e3 && a.s.size > 20e3 && a.s.size < 120e6)
      .sort((a, b) => b.s.mtimeMs - a.s.mtimeMs)[0]
    if (!bom) continue
    const cwd = cwdDe(bom.f)
    if (!cwd || !cwd.startsWith('/home/') || !fs.existsSync(cwd) || vistos.has(cwd)) continue
    vistos.add(cwd)
    achadas.push({ quando: bom.s.mtimeMs, session_id: path.basename(bom.f, '.jsonl'), transcript_path: bom.f, cwd })
  }
  achadas.sort((a, b) => b.quando - a.quando)
  const base = achadas.slice(0, quantas).map(({ quando, ...e }) => ({ ...e, hook_event_name: 'Stop', stop_hook_active: false }))
  /* A segunda passada (`stop_hook_active`) também tem de bater. */
  return [...base, ...base.slice(0, COMPLETO ? 2 : 1).map((e) => ({ ...e, stop_hook_active: true }))]
}

const casas = []
function casaNova() {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'parada-'))
  fs.mkdirSync(path.join(t, '.claude'))
  casas.push(t)
  return t
}
const ambiente = (casa, extra = {}) => {
  const env = { ...process.env, HOME: casa, CC_HOME: path.join(casa, '.claude'), ...extra }
  delete env.CLAUDE_JOB_DIR
  delete env.XDG_DATA_HOME
  return env
}

function rodar(arquivo, entrada, env) {
  return new Promise((pronto) => {
    const t0 = performance.now()
    const p = spawn(process.execPath, [arquivo], { env, cwd: JSON.parse(entrada).cwd })
    let stdout = ''; let stderr = ''
    p.stdout.on('data', (c) => { stdout += c })
    p.stderr.on('data', (c) => { stderr += c })
    p.on('close', (codigo) => pronto({ codigo, stdout, stderr, ms: performance.now() - t0 }))
    p.stdin.end(entrada)
  })
}

async function emParalelo(tarefas, limite) {
  const saida = []
  let i = 0
  await Promise.all(Array.from({ length: limite }, async () => {
    while (i < tarefas.length) { const k = i++; saida[k] = await tarefas[k]() }
  }))
  return saida
}

const lista = entradas(COMPLETO ? 8 : 1)
ok(lista.length >= (COMPLETO ? 6 : 2), `poucas entradas reais achadas: ${lista.length}`)

let iguais = 0; let total = 0; let barradas = 0
const temposParada = []
try {
  for (const e of lista) {
    const entrada = JSON.stringify(e)
    const sozinhos = await emParalelo(GUARDAS.map((g) => () => rodar(path.join(HOOKS, `${g}.mjs`), entrada, ambiente(casaNova()))), os.cpus().length)

    const casa = casaNova()
    const detalhe = path.join(casa, 'detalhe.json')
    const junto = await rodar(path.join(HOOKS, 'parada.mjs'), entrada, ambiente(casa, { PARADA_DETALHE: detalhe }))
    if (!e.stop_hook_active) temposParada.push(junto.ms)
    let dentro = []
    try { dentro = JSON.parse(fs.readFileSync(detalhe, 'utf8')) } catch { ok(false, `${e.session_id}: parada não gravou o detalhe`) }

    GUARDAS.forEach((g, k) => {
      const a = sozinhos[k]; const b = dentro[k] || {}
      total++
      if (a.codigo === 2) barradas++
      const igual = b.nome === g && a.codigo === b.codigo && a.stdout === b.stdout && a.stderr === b.stderr
      if (igual) iguais++
      else ok(false, `${g} em ${path.basename(e.cwd)} (ativo=${e.stop_hook_active}): sozinho ${a.codigo} ${JSON.stringify((a.stderr + a.stdout).slice(0, 160))}, junto ${b.codigo} ${JSON.stringify(((b.stderr || '') + (b.stdout || '')).slice(0, 160))}`)
    })

    const esperado = juntar(GUARDAS.map((g, k) => ({ nome: g, ...sozinhos[k] })))
    ok(junto.codigo === esperado.codigo && junto.stdout === esperado.stdout && junto.stderr === esperado.stderr,
      `${path.basename(e.cwd)}: saída juntada difere (código ${junto.codigo} contra ${esperado.codigo})`)
    ok(!PROIBIDAS.test(junto.stdout + junto.stderr), `${path.basename(e.cwd)}: texto juntado com palavra proibida`)
    /* As medidas da aba Hooks: uma linha, um registro por guarda. */
    const med = path.join(casa, '.local', 'share', 'agent-cockpit', 'parada-medidas.jsonl')
    let linha = null
    try { linha = JSON.parse(fs.readFileSync(med, 'utf8').trim()) } catch { /* conferido abaixo */ }
    ok(linha?.guardas?.length === GUARDAS.length, `${path.basename(e.cwd)}: medidas por guarda não gravadas no abrigo`)
  }
} finally {
  for (const c of casas) fs.rmSync(c, { recursive: true, force: true })
}

/* A junção, sem processo: bloqueio com aviso de tela vira a forma JSON. */
const j = juntar([{ nome: 'a', codigo: 2, stdout: '', stderr: 'x\n' }, { nome: 'b', codigo: 0, stdout: '{"systemMessage":"m"}', stderr: '' }])
ok(j.codigo === 0 && JSON.parse(j.stdout).decision === 'block' && JSON.parse(j.stdout).systemMessage === 'm', 'bloqueio com aviso de tela')
const j2 = juntar([{ nome: 'a', codigo: 2, stdout: '', stderr: 'x\n' }, { nome: 'b', codigo: 2, stdout: '', stderr: 'y' }])
ok(j2.codigo === 2 && j2.stderr === '[a]\nx\n\n[b]\ny\n', 'dois bloqueios juntados')

const melhor = Math.min(...temposParada)
ok(melhor < 1500, `programa único levou ${Math.round(melhor)} ms (teto 1500)`)

console.log(`test-parada: ${lista.length} entradas x ${GUARDAS.length} guardas = ${total}, ${iguais} idênticas, ${barradas} barradas; programa único ${temposParada.map((t) => Math.round(t)).join('/')} ms${COMPLETO ? '' : ' (rápido; completo com PARADA_COMPLETO=1)'}`)
if (falhas) { console.error(`test-parada: ${falhas} falha(s)`); process.exit(1) }
