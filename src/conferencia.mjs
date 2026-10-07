/**
 * CC-838 (Nisaba): as conferências de lista fechada.
 *
 * O campo `conferir: auto:...` era texto livre, e o plano pode vir de IA: um
 * "auto:rm -rf ~" escrito por ela nunca pode rodar. Aqui só existem os tipos
 * abaixo; o que não casar devolve `conhecido: false` e NÃO roda (vira
 * conferência de olho). Nenhum tipo passa por shell: o programa e cada
 * argumento vão separados para o `execFile`, então texto nenhum é interpretado.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { caminhoSeguro } from './tarefa.mjs'

const HOSTS = /^https?:\/\/(127\.0\.0\.1|localhost|testedevoo\.carzo\.com\.br)(:\d+)?(\/|$)/
export const TIPOS_DE_CONFERENCIA = ['build', 'npm test', 'node <test-*.mjs>', 'pytest [<caminho>]', 'contem <arquivo> <texto>', 'responde <url>', 'abre <url>', 'anda <url>']

/** Lê `auto:...` e devolve o que rodar. Função pura: não toca em nada. */
export function lerConferencia(conferir) {
  const m = /^auto:\s*(.+)$/s.exec(String(conferir || '').trim())
  if (!m) return { conhecido: false, motivo: 'não é conferência automática (auto:)' }
  const t = m[1].trim()
  if (/^(build|npm run build)$/.test(t)) return { conhecido: true, tipo: 'build', cmd: 'npm', args: ['run', 'build'] }
  /* 02/10: nos monorepos o build mora em apps/<nome>, não na raiz. Uma ou mais
     pastas, cada uma relativa e dentro do projeto. */
  let p = /^build\s+(.+)$/.exec(t)
  if (p) {
    const pastas = p[1].trim().split(/\s+/)
    const ruim = pastas.map((x) => caminhoSeguro(x)).find(Boolean)
    return ruim ? { conhecido: false, motivo: `build: ${ruim}` } : { conhecido: true, tipo: 'build', pastas }
  }
  if (/^(teste|npm test)$/.test(t)) return { conhecido: true, tipo: 'teste', cmd: 'npm', args: ['test'] }
  let x = /^node\s+((?:hooks\/testar-|test-)[\w-]+\.mjs)$/.exec(t)
  if (x) return { conhecido: true, tipo: 'teste', cmd: process.execPath, args: [x[1]], arquivo: x[1] }
  /* CC-872: teste em Python. Sempre `python -m pytest -q`, nunca um comando livre; o alvo, se vier,
     é um caminho relativo dentro do projeto. Usa o python do .venv do projeto quando ele existe. */
  x = /^pytest(?:\s+(\S+))?$/.exec(t)
  if (x) {
    const ruim = x[1] ? caminhoSeguro(x[1]) : null
    if (ruim) return { conhecido: false, motivo: `pytest: ${ruim}` }
    return { conhecido: true, tipo: 'teste', pytest: true, cmd: 'python3', args: ['-m', 'pytest', '-q', ...(x[1] ? [x[1]] : [])], arquivo: x[1] || null, rotulo: x[1] ? `pytest ${x[1]}` : 'pytest' }
  }
  x = /^contem\s+(\S+)\s+(.+)$/s.exec(t)
  if (x) {
    const p = caminhoSeguro(x[1])
    return p ? { conhecido: false, motivo: `contem: ${p}` } : { conhecido: true, tipo: 'contem', arquivo: x[1], texto: x[2] }
  }
  x = /^responde\s+(\S+)$/.exec(t)
  if (x) return HOSTS.test(x[1]) ? { conhecido: true, tipo: 'responde', url: x[1] } : { conhecido: false, motivo: 'responde: só endereço local ou do testedevoo' }
  // CC-845: comportamento, num navegador sem tela (src/abrir.mjs)
  x = /^(abre|anda)\s+(\S+)$/.exec(t)
  if (x) return HOSTS.test(x[2]) ? { conhecido: true, tipo: x[1], url: x[2] } : { conhecido: false, motivo: `${x[1]}: só endereço local ou do testedevoo` }
  return { conhecido: false, motivo: `comando fora da lista fechada: ${t.slice(0, 80)} (vale ${TIPOS_DE_CONFERENCIA.join(', ')})` }
}

const rodar = (cmd, args, cwd, timeout) => new Promise((ok) => {
  execFile(cmd, args, { cwd, timeout, maxBuffer: 16 * 1024 * 1024 }, (e, out, err) => ok({ ok: !e, saida: `${out || ''}\n${err || e?.message || ''}` }))
})

/** Roda uma conferência já lida. Devolve `{ ok, prova }` ou `{ ok: false, erro }`. */
export async function rodarConferencia(cwd, c, { timeout = 600000 } = {}) {
  if (!c?.conhecido) return { ok: false, erro: c?.motivo || 'conferência desconhecida', rodou: false }
  if (c.arquivo && c.tipo === 'teste' && !fs.existsSync(path.join(cwd, c.arquivo))) return { ok: false, erro: `o teste ${c.arquivo} não existe neste projeto`, rodou: false }
  if (c.pastas) { // build por pasta, uma de cada vez e com prioridade baixa (a máquina serve sites no ar)
    for (const pasta of c.pastas) {
      const dir = path.join(cwd, pasta)
      if (!fs.existsSync(path.join(dir, 'package.json'))) return { ok: false, erro: `build: ${pasta} não tem package.json`, rodou: false }
      const r = await rodar('nice', ['-n', '19', 'npm', 'run', 'build'], dir, timeout)
      if (!r.ok) {
        const i = r.saida.search(/Error|error TS|Failed to compile|ERR!/)
        return { ok: false, erro: `build de ${pasta} falhou:\n${i >= 0 ? r.saida.slice(i, i + 700) : r.saida.slice(-600)}`, rodou: true }
      }
    }
    return { ok: true, prova: `robô: build passou em ${c.pastas.join(', ')}`, rodou: true }
  }
  if (c.cmd) {
    // CC-872: o python do .venv do projeto vence o do sistema, que costuma não ter o pytest
    const venv = path.join(cwd, '.venv', 'bin', 'python')
    const cmd = c.pytest && fs.existsSync(venv) ? venv : c.cmd
    const r = await rodar(cmd, c.args, cwd, timeout)
    if (r.ok) return { ok: true, prova: `robô: ${c.rotulo || (c.tipo === 'build' ? 'npm run build' : c.arquivo || 'npm test')} passou`, rodou: true }
    /* 02/10, no teste de liberação: "falh" casava com "12 ok, 0 falhas", e o
       agente do conserto recebeu linhas de SUCESSO como erro. O trecho certo
       começa na asserção que quebrou; linha de sucesso nunca entra. */
    const i = r.saida.search(/AssertionError|Error:|✗|FALHOU|não bate/)
    const linhas = i >= 0 ? [r.saida.slice(i, i + 700)]
      : r.saida.split('\n').filter((l) => /error|erro|falh|fail|assert|cannot|not found/i.test(l) && !/\b0 falhas?\b|0 falha\(s\)|^\s*ok\b/i.test(l)).slice(-6)
    return { ok: false, erro: `${c.tipo} falhou:\n${linhas.join('\n') || r.saida.slice(-600)}`, rodou: true }
  }
  if (c.tipo === 'contem') {
    let txt = null; try { txt = fs.readFileSync(path.join(cwd, c.arquivo), 'utf8') } catch { /* não existe */ }
    if (txt == null) return { ok: false, erro: `${c.arquivo} não existe`, rodou: true }
    return txt.includes(c.texto) ? { ok: true, prova: `robô: ${c.arquivo} contém "${c.texto.slice(0, 60)}"`, rodou: true } : { ok: false, erro: `${c.arquivo} não contém "${c.texto.slice(0, 60)}"`, rodou: true }
  }
  if (c.tipo === 'responde') {
    try {
      const r = await fetch(c.url, { signal: AbortSignal.timeout(20000), redirect: 'manual' })
      return r.status < 400 ? { ok: true, prova: `robô: ${c.url} respondeu ${r.status}`, rodou: true } : { ok: false, erro: `${c.url} respondeu ${r.status}`, rodou: true }
    } catch (e) { return { ok: false, erro: `${c.url} não respondeu: ${e.message}`, rodou: true } }
  }
  if (c.tipo === 'abre' || c.tipo === 'anda') {
    const script = new URL('./abrir.mjs', import.meta.url)
    const r = await rodar(process.execPath, ['--experimental-websocket', fileURLToPath(script), c.url, c.tipo], cwd, 90000)
    let v = null; try { v = JSON.parse(r.saida.trim().split('\n').filter((l) => l.startsWith('{')).at(-1)) } catch { /* saída quebrada */ }
    if (!v) return { ok: false, erro: `${c.tipo}: a conferência não respondeu (${r.saida.slice(-200)})`, rodou: true }
    return v.ok
      ? { ok: true, prova: c.tipo === 'anda' ? `robô: em ${c.url} apertar W mexe a cena (${v.andando} andando contra ${v.parado} parado, de 0 a 255)` : `robô: ${c.url} abre sem erro de código`, rodou: true }
      : { ok: false, erro: `${c.tipo}: ${v.motivo}`, rodou: true }
  }
  return { ok: false, erro: 'tipo sem execução', rodou: false }
}
