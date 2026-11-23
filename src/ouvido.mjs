/**
 * CC-1120, desenho D1: o "ouvido". Uma caixa por sessão onde o painel deixa a mensagem dele, e o gancho
 * `hooks/ouvido.mjs` (Stop e SessionStart, com `asyncRewake`) espera, lê e acorda a sessão saindo com 2.
 *
 * Serve a sessão que o painel NÃO abriu: a do app do desktop, a de um terminal qualquer. A do terminal do painel
 * continua indo pelo `enviarMensagem` do `decisao.mjs`.
 *
 * A pasta é o abrigo (`~/.local/share/agent-cockpit/caixas`), não `~/.claude`: lá a sessão no sandbox não grava
 * (EROFS, guia PC-E-VPS), e no PC o painel roda como administrador e a sessão como usuário comum, então a pasta
 * precisa ser do perfil dele, onde os dois escrevem. `CC_HOME` vence `XDG_DATA_HOME`, como no `metaSessao.mjs`.
 *
 *   <sessao>.vivo  {pid, sessao, hora, cwd, transcrito}: o gancho renova a cada 20 s enquanto espera
 *   <sessao>.txt   a mensagem; o gancho lê e apaga
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'
import { limparTextoRemoto } from './federacao.mjs'

export const dirCaixas = () => path.join(
  (!process.env.CC_HOME && process.env.XDG_DATA_HOME) || path.join(casaClaude(), '..', '.local', 'share'),
  'agent-cockpit', 'caixas',
)

export const ID_SESSAO = /^[0-9a-f-]{8,40}$/i
/** O marcador vale 60 s: o gancho renova a cada 20, então dois atrasos seguidos ainda contam como vivo. */
export const VIVO_MS = 60_000

/** EPERM é processo vivo de outro usuário (o painel administrador olhando o gancho do usuário comum). */
export function pidVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (e) { return e?.code === 'EPERM' }
}

export function lerVivo(sessao, dir = dirCaixas()) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, `${sessao}.vivo`), 'utf8')) } catch { return null }
}

export const marcadorValido = (v, agora = Date.now()) => Boolean(v && agora - (v.hora || 0) < VIVO_MS && pidVivo(v.pid))

/** Ids das sessões com ouvido vivo agora. */
export function ouvidosVivos({ dir = dirCaixas(), agora = Date.now() } = {}) {
  let nomes = []
  try { nomes = fs.readdirSync(dir) } catch { return [] }
  return nomes.filter((n) => n.endsWith('.vivo')).map((n) => n.slice(0, -5))
    .filter((s) => ID_SESSAO.test(s) && marcadorValido(lerVivo(s, dir), agora))
}

/** A sessão (id completo) que escuta esta conversa; aceita o id curto do pacote. `null` sem ouvido vivo. */
export function ouvidoVivo(conversa, opcoes = {}) {
  const c = String(conversa || '')
  if (!ID_SESSAO.test(c)) return null
  return ouvidosVivos(opcoes).find((s) => s === c || s.startsWith(c)) || null
}

/**
 * Deixa a mensagem na caixa. Texto limpo aqui (o painel) e de novo no gancho, teto de 4000. Caixa ainda não lida
 * ganha a mensagem nova embaixo, em vez de perder a anterior.
 * ponytail: ler, juntar e trocar não é atômico contra o gancho lendo no mesmo instante; janela de milissegundos.
 */
export function gravarCaixa(sessao, texto, { dir = dirCaixas() } = {}) {
  if (!ID_SESSAO.test(String(sessao || ''))) return { ok: false, erro: 'sessão inválida' }
  const limpo = limparTextoRemoto(texto)
  if (!limpo) return { ok: false, erro: 'mensagem sem texto' }
  const alvo = path.join(dir, `${sessao}.txt`)
  let antes = ''
  try { antes = fs.readFileSync(alvo, 'utf8').trim() } catch { /* caixa vazia */ }
  try {
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${alvo}.${process.pid}.tmp`
    fs.writeFileSync(tmp, (antes ? `${antes}\n` : '') + limpo, 'utf8')
    fs.renameSync(tmp, alvo)
  } catch (e) { return { ok: false, erro: `não consegui gravar a caixa da sessão: ${e.message}` } }
  return { ok: true, entregue: 'ouvido', aviso: 'deixei na caixa da sessão; ela acorda e responde' }
}
