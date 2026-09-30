/**
 * CC-722, revisão de segurança de 30/09. O painel roda comando na máquina de
 * propósito (/api/subir, remote-control, gate), então um pedido que ele não
 * iniciou é execução de código. As três travas moram aqui, puras, para o
 * teste conferir cada uma sem subir o servidor (test-seguranca.mjs).
 */
import crypto from 'node:crypto'
import path from 'node:path'

/* O navegador diz de onde o pedido veio (`Sec-Fetch-Site`). Ação vinda de um
   SUBDOMÍNIO (o cookie do login vai junto: SameSite=Lax não separa
   subdomínios, e testedevoo.carzo.com.br serve projeto em teste) ou de outro
   site é recusada. Ferramenta local (ganchos, `cockpit done`, curl) não manda
   o cabeçalho e segue passando. */
export function pedidoDeFora(headers) {
  const s = String((headers || {})['sec-fetch-site'] || '').toLowerCase()
  return s === 'same-site' || s === 'cross-site'
}

/** Token comparado em tempo constante; vazio nunca confere. */
export function tokenIgual(recebido, esperado) {
  const a = Buffer.from(String(recebido ?? '')); const b = Buffer.from(String(esperado ?? ''))
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b)
}

/* A pasta que vem no pedido só vale dentro de uma das pastas de projetos ou de
   um projeto conhecido. Antes o `cwd` era aceito cru, e /api/projetos/arquivo
   com cwd=/home/claudedev lia credenciais da casa inteira. */
export function cwdPermitido(c, bases = [], projetos = []) {
  if (!c) return false
  const norm = (p) => { const r = path.resolve(String(p)); return path.sep === '\\' ? r.toLowerCase() : r }
  const r = norm(c)
  const dentro = (base) => { const b = norm(base); return r === b || r.startsWith(b + path.sep) }
  return bases.some(dentro) || projetos.some(dentro)
}
