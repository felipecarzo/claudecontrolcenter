#!/usr/bin/env node
/**
 * CC-944, pedido dele em 07/10: "eu quero que você consiga acessar o servidor,
 * veja as corridas (...) um token que dure 24 horas". Desenho escolhido por ele:
 * liberação com o código do autenticador, valendo 24 horas, e tudo sem dado pessoal.
 *
 * O LADO PROTEGIDO DA LEITURA DO BANCO. Mesmo modelo do deploy seguro, ao lado:
 *  - roda num usuário próprio do systemd (DynamicUser), nem root nem claudedev;
 *  - a senha do banco chega pelo systemd (LoadCredential) e nunca fica legível
 *    para os agentes; o usuário do banco só lê, e não enxerga as colunas de
 *    nome, e-mail, senha e chave (o instalador faz isso no próprio banco);
 *  - os agentes só PEDEM consultas por 127.0.0.1, e só enquanto ele deixou aberto;
 *  - quem abre é ele, com o código do autenticador, numa página servida POR ESTE
 *    serviço (o Cockpit é editado pelos agentes e poderia capturar o código);
 *  - toda consulta fica registrada, e a página mostra a lista.
 *
 * Sem dependência: só o que vem com o Node, e o psql do sistema.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { conferirCodigo, esc, corpoDe, json } from './deploy-seguro.mjs'

const PORTA = Number(process.env.LEITURA_PORTA || 5194)
const ESTADO_DIR = process.env.STATE_DIRECTORY || process.env.LEITURA_ESTADO || '/var/lib/cockpit-leitura'
const CRED_DIR = process.env.CREDENTIALS_DIRECTORY || process.env.LEITURA_CRED || '/etc/cockpit-leitura'
const PSQL = process.env.LEITURA_PSQL || 'psql'
const EU = process.env.LEITURA_EU || null // o user_id dele, para achar os treinos dele sem precisar do e-mail
export const ABERTO_MS = 24 * 60 * 60 * 1000
export const LIMITE_LINHAS = 500
const MAX_FALHAS = 5
const BLOQUEIO_MS = 15 * 60 * 1000
export const PAGINA = 'https://cockpit.carzo.com.br/leitura-segura/'

const cred = (nome) => fs.readFileSync(path.join(CRED_DIR, nome), 'utf8').trim()
const ARQ = () => path.join(ESTADO_DIR, 'estado.json')
const REG = () => path.join(ESTADO_DIR, 'registro.jsonl')
export function lerEstado() {
  try { return { abertoAte: 0, falhas: 0, bloqueadoAte: 0, ultimoPasso: 0, ...JSON.parse(fs.readFileSync(ARQ(), 'utf8')) } } catch { return { abertoAte: 0, falhas: 0, bloqueadoAte: 0, ultimoPasso: 0 } }
}
function gravarEstado(e) {
  fs.mkdirSync(ESTADO_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(ARQ() + '.tmp', JSON.stringify(e), { mode: 0o600 }); fs.renameSync(ARQ() + '.tmp', ARQ())
}
const registrar = (l) => { fs.mkdirSync(ESTADO_DIR, { recursive: true, mode: 0o700 }); fs.appendFileSync(REG(), JSON.stringify(l) + '\n', { mode: 0o600 }) }
// ponytail: lê o registro inteiro para mostrar as últimas; trocar por leitura do fim do arquivo se passar de alguns MB
export const ultimas = (n = 30) => { try { return fs.readFileSync(REG(), 'utf8').trim().split('\n').filter(Boolean).slice(-n).reverse().map((l) => JSON.parse(l)) } catch { return [] } }

/** Libera por 24 horas com o código do autenticador (o mesmo do deploy). Devolve null quando passou, ou o motivo. */
export function liberar(codigo, { agora = Date.now(), segredo = null } = {}) {
  const e = lerEstado()
  if (agora < e.bloqueadoAte) return 'bloqueado por códigos errados até as ' + new Date(e.bloqueadoAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const passo = conferirCodigo(segredo || cred('totp'), codigo, agora)
  if (passo === null || passo <= e.ultimoPasso) {
    e.falhas += 1
    if (e.falhas >= MAX_FALHAS) { e.bloqueadoAte = agora + BLOQUEIO_MS; e.falhas = 0 }
    gravarEstado(e)
    return passo !== null ? 'esse código já foi usado: espere o próximo' : (e.bloqueadoAte > agora ? 'código errado: bloqueado por 15 minutos' : `código errado (${e.falhas} de ${MAX_FALHAS} antes de bloquear)`)
  }
  Object.assign(e, { falhas: 0, ultimoPasso: passo, abertoAte: agora + ABERTO_MS }); gravarEstado(e)
  registrar({ em: agora, evento: 'liberado', ate: e.abertoAte })
  return null
}
export function revogar(agora = Date.now()) { const e = lerEstado(); e.abertoAte = 0; gravarEstado(e); registrar({ em: agora, evento: 'fechado' }) }

/** Uma consulta só, de leitura. O banco já recusa escrita e coluna pessoal; aqui é a segunda camada. */
export function validarSql(sql) {
  const s = String(sql || '').trim().replace(/;\s*$/, '')
  if (!s) return { erro: 'consulta vazia' }
  if (s.length > 8000) return { erro: 'consulta grande demais (máximo 8000 caracteres)' }
  if (s.includes(';')) return { erro: 'uma consulta por vez, sem ponto e vírgula no meio' }
  if (!/^(select|with)\b/i.test(s)) return { erro: 'só consulta de leitura (select ou with)' }
  return { sql: s }
}

/** Terceira camada: e-mail que escapar dentro de um JSON (cópia do app, eventos) sai trocado. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const CHAVE_PESSOAL = /^(e_?mail|phone|telefone|celular|cpf|password|senha|access_token|refresh_token|token)$/i
export function limpar(v) {
  if (typeof v === 'string') return v.replace(EMAIL, '[e-mail]')
  if (Array.isArray(v)) return v.map(limpar)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !CHAVE_PESSOAL.test(k)).map(([k, x]) => [k, limpar(x)]))
  return v
}

function envDoBanco() {
  const u = new URL(cred('banco'))
  return { PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: decodeURIComponent(u.pathname.slice(1)) || 'postgres', PGSSLMODE: u.searchParams.get('sslmode') || 'prefer', PGAPPNAME: 'leitura-segura' }
}
/* A senha vai por variável de ambiente, nunca na linha de comando: a linha de
   comando de qualquer processo é visível para os outros usuários da máquina. */
export function rodarSql(sql, { psql = PSQL, env = null } = {}) {
  const q = `select coalesce(json_agg(t), '[]'::json) from (select * from (${sql}) q limit ${LIMITE_LINHAS + 1}) t`
  return new Promise((ok) => {
    execFile(psql, ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', 'BEGIN READ ONLY', '-c', q, '-c', 'ROLLBACK'],
      { env: { PATH: '/usr/bin:/bin', ...(env || envDoBanco()) }, timeout: 20000, maxBuffer: 32 * 1024 * 1024 },
      (err, out, errOut) => {
        if (err) return ok({ erro: (String(errOut || '').trim().split('\n').find((l) => /ERROR|FATAL|erro/i.test(l)) || err.message).slice(0, 400) })
        try { const linhas = JSON.parse(String(out).trim() || '[]'); ok({ linhas: limpar(linhas.slice(0, LIMITE_LINHAS)), cortado: linhas.length > LIMITE_LINHAS }) } catch (e) { ok({ erro: 'resposta do banco ilegível: ' + e.message }) }
      })
  })
}

export function criarServidor({ executar = rodarSql } = {}) {
  return http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x')
    try {
      // ── a API, para os agentes, só por 127.0.0.1 (o nginx só repassa /leitura-segura/) ──
      if (u.pathname === '/api/estado') { const e = lerEstado(); const aberto = Date.now() < e.abertoAte; return json(res, 200, { aberto, ate: aberto ? e.abertoAte : null, eu: EU, liberar: PAGINA }) }
      if (u.pathname === '/api/consultar' && req.method === 'POST') {
        const d = JSON.parse(await corpoDe(req, 16384) || '{}')
        const agora = Date.now(); const de = String(d.de || '?').slice(0, 60)
        if (agora >= lerEstado().abertoAte) return json(res, 403, { ok: false, erro: 'fechado: ele precisa liberar com o código do autenticador', liberar: PAGINA })
        const v = validarSql(d.sql)
        if (v.erro) { registrar({ em: agora, de, sql: String(d.sql || '').slice(0, 2000), erro: v.erro }); return json(res, 400, { ok: false, erro: v.erro }) }
        const r = await executar(v.sql)
        registrar({ em: agora, de, sql: v.sql.slice(0, 2000), ms: Date.now() - agora, ...(r.erro ? { erro: r.erro } : { linhas: r.linhas.length, cortado: r.cortado }) })
        return json(res, r.erro ? 400 : 200, r.erro ? { ok: false, erro: r.erro } : { ok: true, ...r })
      }
      // ── a página: só ele, com o código ──
      if (u.pathname === '/leitura-segura/' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' })
        return res.end(pagina(lerEstado(), u.searchParams.get('msg')))
      }
      if ((u.pathname === '/leitura-segura/liberar' || u.pathname === '/leitura-segura/fechar') && req.method === 'POST') {
        const f = new URLSearchParams(await corpoDe(req))
        let msg
        if (u.pathname.endsWith('/fechar')) { revogar(); msg = 'fechado: nenhuma consulta passa até você liberar de novo' } else { const erro = liberar(f.get('codigo')); msg = erro || 'liberado por 24 horas' }
        res.writeHead(303, { location: '/leitura-segura/?msg=' + encodeURIComponent(msg) }); return res.end()
      }
      json(res, 404, { erro: 'não existe' })
    } catch (err) { json(res, 500, { erro: err.message }) }
  })
}

function pagina(e, msg) {
  const hora = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const aberto = Date.now() < e.abertoAte
  const linha = (l) => l.evento
    ? `<li class="ev"><b>${l.evento === 'liberado' ? 'você liberou' : 'fechado'}</b> <span class="m">${hora(l.em)}</span></li>`
    : `<li><div class="lh"><span class="m">${hora(l.em)} · ${esc(l.de)}</span><span class="tag ${l.erro ? 'mau' : 'ok'}">${l.erro ? 'recusada' : `${l.linhas} linha${l.linhas === 1 ? '' : 's'}`}</span></div><pre>${esc(l.sql)}</pre>${l.erro ? `<p class="aviso">${esc(l.erro)}</p>` : ''}</li>`
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60"><title>Leitura segura · Ogumia</title>
<style>
:root{--bg:#e6e9f0;--card:#eef1f6;--txt:#1f2433;--dim:#5b6476;--acc:#4f46e5;--ok:#15803d;--mau:#b91c1c;--alto:6px 6px 14px rgba(163,177,198,.55),-6px -6px 14px rgba(255,255,255,.9);--fundo:inset 3px 3px 7px rgba(163,177,198,.5),inset -3px -3px 7px rgba(255,255,255,.85)}
@media (prefers-color-scheme:dark){:root{--bg:#1b1f2a;--card:#212634;--txt:#e7eaf2;--dim:#9aa3b5;--acc:#818cf8;--ok:#4ade80;--mau:#f87171;--alto:6px 6px 14px rgba(0,0,0,.45),-4px -4px 12px rgba(255,255,255,.035);--fundo:inset 3px 3px 7px rgba(0,0,0,.45),inset -3px -3px 7px rgba(255,255,255,.04)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:17px/1.5 Inter,system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:480px;margin:0 auto;padding:28px 16px 40px}h1{font-size:26px;margin:0}.sub{color:var(--dim);font-size:16px;margin:4px 0 22px}
.c{background:var(--card);border-radius:18px;padding:18px;box-shadow:var(--alto);margin:0 0 18px}.est{font-size:19px;font-weight:600;margin:0 0 6px}.est.ok{color:var(--ok)}.m{color:var(--dim);font-size:15px}
label{display:block;font-size:15px;color:var(--dim);margin:14px 0 6px}input[name=codigo]{width:100%;font:600 30px/1 ui-monospace,monospace;letter-spacing:.42em;text-align:center;padding:14px 10px 14px 22px;border:0;border-radius:14px;background:var(--bg);color:var(--txt);box-shadow:var(--fundo);outline:none}
.bts{display:flex;justify-content:flex-end;margin-top:14px}button{font:inherit;border:0;border-radius:12px;cursor:pointer;min-height:44px;padding:0 18px}.pri{background:var(--acc);color:#fff;font-weight:600;box-shadow:var(--alto)}.sec{background:var(--bg);color:var(--txt);box-shadow:var(--alto)}
.msg{border-radius:12px;padding:12px 14px;margin:0 0 18px;background:var(--card);box-shadow:var(--alto);border-left:4px solid var(--acc)}.aviso{color:var(--mau);font-size:15px;margin:6px 0 0}
h3{font-size:14px;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin:28px 0 10px}ul{list-style:none;margin:0;padding:0}li{background:var(--card);border-radius:14px;padding:12px 14px;margin:0 0 10px;box-shadow:var(--alto)}li.ev{box-shadow:none;background:none;padding:4px 14px}
.lh{display:flex;gap:10px;align-items:center;justify-content:space-between}.tag{font-size:13px;white-space:nowrap;padding:2px 9px;border-radius:999px;background:var(--bg)}.tag.ok{color:var(--ok)}.tag.mau{color:var(--mau)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;background:var(--bg);padding:10px;border-radius:10px;margin:8px 0 0;box-shadow:var(--fundo)}
</style></head><body><main>
<h1>Leitura segura</h1><p class="sub">O Claude só consulta o banco do Ahtleta quando você libera. Ele lê, não altera nada, e não vê nome, e-mail, senha nem chave de ninguém.</p>
${msg ? `<p class="msg">${esc(msg)}</p>` : ''}
<section class="c">${aberto
    ? `<p class="est ok">Aberto até ${hora(e.abertoAte)}</p><p class="m">Depois disso fecha sozinho.</p><form method="post" action="/leitura-segura/fechar"><div class="bts"><button class="sec">fechar agora</button></div></form>`
    : `<p class="est">Fechado</p><p class="m">Com o código do autenticador (o mesmo do deploy), abre por 24 horas.</p><form method="post" action="/leitura-segura/liberar"><label for="c">código do autenticador</label><input id="c" name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required><div class="bts"><button class="pri">liberar por 24 horas</button></div></form>`}</section>
<h3>O que o Claude consultou</h3><ul>${ultimas().map(linha).join('') || '<li class="m">nada ainda</li>'}</ul>
</main></body></html>`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  criarServidor().listen(PORTA, '127.0.0.1', () => console.log(`leitura segura em 127.0.0.1:${PORTA}`))
}
