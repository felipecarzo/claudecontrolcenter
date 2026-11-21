/**
 * CC-1096: navegador sem tela esquecido.
 *
 * Medido em 19/11: um `chrome-headless-shell` aberto por uma sessão da loja ficou 9 dias de pé, com 52 abas em 58
 * processos, 6,6 GB de RAM e 6,8 GB de troca, e a VPS vivia no limite sem nada no painel dizer por quê. Este módulo
 * acha o navegador raiz (o processo sem `--type=`) de cada árvore, soma a memória dela e conta as abas.
 *
 * Lê `/proc` direto, sem `ps`: sem `/proc` (Windows, Mac) devolve `null` e a tela esconde o bloco. Só processos do
 * próprio usuário: o Chrome do Docker (`remote-chrome`) roda com outro usuário e fica de fora, e nem daria para fechar.
 * Caro o bastante para ficar fora do tique de 2 s: só quando a tela Máquina abre.
 */
import fs from 'node:fs'
import path from 'node:path'

const TICK = 100 // ponytail: CLK_TCK fixo em 100, o padrão do Linux x86; ler `getconf CLK_TCK` se algum dia variar

const ler = (f) => { try { return fs.readFileSync(f, 'utf8') } catch { return null } }

/** Um processo de /proc: pid, pai, usuário, início (ms), memória (KB) e linha de comando. */
function processo(raiz, pid, btime) {
  const stat = ler(path.join(raiz, pid, 'stat'))
  const cmd = ler(path.join(raiz, pid, 'cmdline'))
  const status = ler(path.join(raiz, pid, 'status'))
  if (!stat || !cmd || !status) return null
  const f = stat.slice(stat.lastIndexOf(')') + 2).split(' ') // o nome entre parênteses pode ter espaço
  return {
    pid: Number(pid), pai: Number(f[1]),
    uid: Number(/^Uid:\s+(\d+)/m.exec(status)?.[1]),
    inicio: (btime + Number(f[19]) / TICK) * 1000,
    rssKB: Number(/^VmRSS:\s+(\d+)/m.exec(status)?.[1] || 0),
    args: cmd.split('\0').filter(Boolean),
  }
}

const ehChrome = (p) => /chrom|headless_shell/i.test(path.basename(p.args[0] || ''))
const semTela = (p) => p.args.some((a) => /^--headless|^--remote-debugging-(port|pipe)/.test(a))

/**
 * Os navegadores sem tela deste usuário abertos há pelo menos `horas`, do mais pesado para o mais leve.
 * Cada um: { pid, desde, horas, abas, processos, memoriaMB, porta, perfil }.
 */
export function navegadoresSemTela({ horas = 24, raiz = '/proc', uid = process.getuid?.(), agora = Date.now() } = {}) {
  const st = ler(path.join(raiz, 'stat'))
  if (!st) return null
  const btime = Number(/^btime (\d+)/m.exec(st)?.[1] || 0)
  const todos = []
  for (const d of fs.readdirSync(raiz)) if (/^\d+$/.test(d)) { const p = processo(raiz, d, btime); if (p) todos.push(p) }
  const filhos = new Map()
  for (const p of todos) { if (!filhos.has(p.pai)) filhos.set(p.pai, []); filhos.get(p.pai).push(p) }
  const arvore = (p) => [p, ...(filhos.get(p.pid) || []).flatMap(arvore)]
  const raizes = todos.filter((p) => p.uid === uid && ehChrome(p) && !p.args.some((a) => a.startsWith('--type=')) && semTela(p))
  return raizes
    .map((p) => {
      const t = arvore(p)
      const opc = (nome) => p.args.find((a) => a.startsWith(nome + '='))?.split('=')[1] || null
      return {
        pid: p.pid, desde: new Date(p.inicio).toISOString(), horas: Math.round((agora - p.inicio) / 36e5),
        abas: null, // vem da porta, em `comAbas`: a aba nasce por fork do zygote e herda a linha de comando dele
        processos: t.length, memoriaMB: Math.round(t.reduce((s, x) => s + x.rssKB, 0) / 1024),
        porta: opc('--remote-debugging-port'), perfil: opc('--user-data-dir'),
      }
    })
    .filter((n) => n.horas >= horas)
    .sort((a, b) => b.memoriaMB - a.memoriaMB)
}

/** Conta as abas pela porta de controle (`/json/list`, só `page`). Sem porta, ou sem resposta em 1,5 s, fica `null`. */
export async function comAbas(lista) {
  if (!lista) return lista
  await Promise.all(lista.filter((n) => n.porta).map(async (n) => {
    try { n.abas = (await (await fetch(`http://127.0.0.1:${n.porta}/json/list`, { signal: AbortSignal.timeout(1500) })).json()).filter((x) => x.type === 'page').length } catch { /* fica null */ }
  }))
  return lista
}

/** Fecha o navegador `pid`, só se ele ainda está na lista; SIGTERM e, 5 s depois, SIGKILL (o SIGTERM não bastou em 19/11). */
export async function fecharNavegador(pid, { horas = 0 } = {}) {
  const alvo = (navegadoresSemTela({ horas }) || []).find((n) => n.pid === Number(pid))
  if (!alvo) return { ok: false, erro: 'esse navegador não está mais na lista' }
  const vivo = () => { try { process.kill(alvo.pid, 0); return true } catch { return false } }
  try { process.kill(alvo.pid, 'SIGTERM') } catch (e) { return { ok: false, erro: String(e.message || e) } }
  for (let i = 0; i < 10 && vivo(); i++) await new Promise((r) => setTimeout(r, 500))
  if (vivo()) try { process.kill(alvo.pid, 'SIGKILL') } catch { /* morreu entre as duas */ }
  await new Promise((r) => setTimeout(r, 300))
  return vivo() ? { ok: false, erro: 'o navegador não fechou' } : { ok: true, memoriaMB: alvo.memoriaMB }
}
