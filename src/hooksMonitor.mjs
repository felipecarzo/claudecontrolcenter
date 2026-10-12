/**
 * CC-1044, pedido dele em 11/10: "monitorar melhor os hooks". Lê das conversas gravadas pelo Claude Code
 * (~/.claude/projects/<projeto>/<sessão>.jsonl) cada execução de hook e junta por hook:
 *   disparos, tempo médio e máximo, quantas vezes passou do tempo (cancelado), quantas vezes barrou ou devolveu,
 *   e os últimos retornos.
 *
 * De onde cada número sai (formato medido em 11/10 em 40 conversas desta VPS):
 *   - Stop: o registro `stop_hook_summary` traz TODOS os hooks da parada, com o tempo de cada um (`hookInfos`) e as
 *     devoluções (`hookErrors`). Os mesmos hooks também aparecem como `hook_success` avulso quando têm saída, então
 *     para o Stop só vale o resumo, senão a conta dobra.
 *   - Os outros eventos (SessionStart, PreToolUse, UserPromptSubmit...): `hook_success`, com comando, tempo e código.
 *     O Claude Code só grava o hook que DEU saída: um PreToolUse que passou calado não aparece, e a contagem dele é
 *     o mínimo, não o total.
 *   - `hook_cancelled`: passou do tempo limite e foi cortado.
 *   - Barrada de ferramenta: o resultado da ferramenta começa com "PreToolUse:<Ferramenta> hook error: [comando]".
 *
 * Só lê. Guarda por arquivo (tamanho + data) o que já leu, para não reler conversa que não cresceu.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { EXPLICA } from './hooksExplica.mjs'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

const BASE = () => path.join(process.env.CC_HOME || path.join(os.homedir(), '.claude'), 'projects')
const cache = new Map() // arquivo -> { tam, mtime, eventos }

/** O nome curto de um hook a partir do comando: `node /x/hooks/edicao-guard.mjs` vira `edicao-guard`. */
export function nomeDoHook(cmd) {
  const s = String(cmd || '').trim()
  const m = /([\w.-]+)\.(m?js|sh|py)\b/.exec(s)
  if (m) return m[1]
  return s.split(/\s+/).pop()?.split('/').pop()?.slice(0, 60) || '?'
}
const projetoDe = (cwd) => path.basename(String(cwd || '')).replace(/^(VPS|PC)_/, '') || '?'

/* CC-1049, pedido dele: quanto token cada hook custa. O Claude Code não grava token por hook, só por resposta; aqui é
   ESTIMATIVA pelo tamanho do texto que o hook pôs na conversa (o que o Claude lê): o contexto de abertura e de mensagem,
   e o texto das devoluções e barradas. Português dá perto de 3,6 caracteres por token. */
export const CARACTERES_POR_TOKEN = 3.6
export const tokensDe = (chars) => Math.ceil((Number(chars) || 0) / CARACTERES_POR_TOKEN)
/** Quanto texto um hook avulso pôs na conversa: o contexto que ele devolveu (JSON) ou, na abertura e na mensagem, a saída. */
export function charsDoSucesso(a) {
  const out = String(a?.stdout || '')
  try { const j = JSON.parse(out); return String(j?.hookSpecificOutput?.additionalContext || '').length + String(j?.systemMessage || '').length } catch { /* saída em texto */ }
  return /^(SessionStart|UserPromptSubmit)$/.test(a?.hookEvent || '') ? out.length : 0
}

/** Os eventos de hook de UMA conversa. Puro sobre o texto, para testar sem disco. */
export function eventosDoTexto(texto) {
  const ev = []
  for (const linha of String(texto).split('\n')) {
    if (!linha.includes('hook')) continue
    let x; try { x = JSON.parse(linha) } catch { continue }
    const em = Date.parse(x.timestamp) || 0; const projeto = projetoDe(x.cwd)
    const a = x.attachment
    if (x.subtype === 'stop_hook_summary') {
      /* os hooks de parada rodam JUNTOS: o que ele espera ao fim de cada resposta é o mais lento deles */
      const tempos = (x.hookInfos || []).map((h) => Number(h.durationMs) || 0)
      if (tempos.length) ev.push({ em, projeto, evento: 'Stop', parada: true, hook: '(parada inteira)', ms: Math.max(...tempos), qtd: tempos.length })
      for (const h of x.hookInfos || []) ev.push({ em, projeto, evento: 'Stop', hook: nomeDoHook(h.command), comando: h.command, ms: Number(h.durationMs) || null })
      for (const e of x.hookErrors || []) {
        const m = /^\[([^\]]+)\]:?\s*([\s\S]*)$/.exec(String(e))
        if (!m) continue
        /* CC-1045: a devolução da parada junta vários guardas, cada um com o nome numa linha `[nome]`. */
        const partes = nomeDoHook(m[1]) === 'parada' ? m[2].split(CABECALHO_PARADA).slice(1) : null
        if (partes?.length) {
          for (let i = 0; i < partes.length; i += 2) {
            const t = partes[i + 1].trim()
            ev.push({ em, projeto, evento: 'Stop', hook: partes[i].split('/').pop(), comando: m[1], barrou: true, texto: t.slice(0, 400), chars: t.length })
          }
        } else ev.push({ em, projeto, evento: 'Stop', hook: nomeDoHook(m[1]), comando: m[1], barrou: true, texto: m[2].slice(0, 400), chars: m[2].length })
      }
    } else if (a?.type === 'hook_success' && a.hookEvent !== 'Stop') {
      ev.push({ em, projeto, evento: a.hookEvent || a.hookName, hook: nomeDoHook(a.command), comando: a.command, ms: Number(a.durationMs) || null, codigo: a.exitCode, chars: charsDoSucesso(a) })
    } else if (a?.type === 'hook_cancelled') {
      ev.push({ em, projeto, evento: a.hookEvent || a.hookName, hook: nomeDoHook(a.command), comando: a.command, ms: Number(a.durationMs) || null, cancelado: true })
    } else if (x.type === 'user' && Array.isArray(x.message?.content)) {
      for (const c of x.message.content) {
        const t = c?.type === 'tool_result' ? (typeof c.content === 'string' ? c.content : (c.content || []).map((p) => p?.text || '').join('')) : ''
        const m = /^(PreToolUse|PostToolUse):(\w+) hook error: \[([^\]]+)\]:?\s*([\s\S]*)/.exec(t)
        if (m) ev.push({ em, projeto, evento: m[1], ferramenta: m[2], hook: nomeDoHook(m[3]), comando: m[3], barrou: true, texto: m[4].slice(0, 400), chars: m[4].length })
      }
    }
  }
  return ev
}

/* CC-1045: os guardas do fim de resposta rodam dentro de UM programa (`hooks/parada.mjs`), e a conversa só registra
   ele. O tempo de cada guarda vem do arquivo de medidas que o programa grava no abrigo, uma linha por resposta. */
const CABECALHO_PARADA = /^\[([a-z][\w/-]*(?:-guard|-fim))\]\n/m
export const ARQUIVO_MEDIDAS_PARADA = () => path.join(path.dirname(DIR_SESSOES_ABRIGO()), 'parada-medidas.jsonl')
/** Os disparos de cada guarda da parada. A barrada não entra aqui: ela vem da conversa, com o texto. */
export function eventosDaParada(texto) {
  const ev = []
  for (const linha of String(texto).split('\n')) {
    let x; try { x = JSON.parse(linha) } catch { continue }
    const em = Date.parse(x.em) || 0; const projeto = projetoDe(x.cwd)
    for (const g of x.guardas || []) {
      ev.push({ em, projeto, evento: 'Stop', hook: String(g.nome).split('/').pop(), comando: 'parada', ms: Number(g.ms) || 0, ...(g.cortado ? { cancelado: true } : {}) })
    }
  }
  return ev
}

function eventosDoArquivo(arq) {
  let st; try { st = fs.statSync(arq) } catch { return [] }
  const c = cache.get(arq)
  if (c && c.tam === st.size && c.mtime === st.mtimeMs) return c.eventos
  let texto = ''; try { texto = fs.readFileSync(arq, 'utf8') } catch { return [] }
  const eventos = eventosDoTexto(texto)
  cache.set(arq, { tam: st.size, mtime: st.mtimeMs, eventos })
  return eventos
}

/** Junta por hook. `eventos` de qualquer fonte; `desde` corta por data. */
export function juntar(eventos, { desde = 0 } = {}) {
  const por = new Map()
  for (const e of eventos) {
    if (e.em && e.em < desde) continue
    if (e.parada) continue // vai para o resumo das paradas, não para a lista de hooks
    const k = e.hook
    const h = por.get(k) || { hook: k, comando: e.comando, eventos: new Set(), projetos: new Set(), disparos: 0, comTempo: 0, somaMs: 0, maxMs: 0, cancelados: 0, barrou: 0, ultimas: [], ultimoEm: 0, chars: 0, comTexto: 0 }
    h.eventos.add(e.evento); h.projetos.add(e.projeto); h.ultimoEm = Math.max(h.ultimoEm, e.em || 0)
    if (e.chars) { h.chars += e.chars; h.comTexto++ }
    if (e.barrou) { h.barrou++; h.ultimas.push({ em: e.em, projeto: e.projeto, ferramenta: e.ferramenta || null, texto: e.texto }) }
    else { h.disparos++; if (e.cancelado) h.cancelados++; if (e.ms != null) { h.comTempo++; h.somaMs += e.ms; h.maxMs = Math.max(h.maxMs, e.ms) } }
    por.set(k, h)
  }
  return [...por.values()].map((h) => ({
    hook: h.hook, comando: h.comando, eventos: [...h.eventos].sort(), projetos: [...h.projetos].sort(),
    disparos: h.disparos, mediaMs: h.comTempo ? Math.round(h.somaMs / h.comTempo) : null, maxMs: h.comTempo ? h.maxMs : null,
    cancelados: h.cancelados, barrou: h.barrou, ultimoEm: h.ultimoEm,
    tokens: tokensDe(h.chars), tokensPorVez: h.comTexto ? tokensDe(h.chars / h.comTexto) : 0, vezesComTexto: h.comTexto,
    ultimas: h.ultimas.sort((a, b) => b.em - a.em).slice(0, 5),
  })).sort((a, b) => (b.mediaMs || 0) * b.disparos - (a.mediaMs || 0) * a.disparos)
}

/** Quanto ele espera ao fim de cada resposta: a mediana e o pior 5% das paradas, e quantas passaram de 10 s. */
export function paradas(eventos, { desde = 0 } = {}) {
  const ms = eventos.filter((e) => e.parada && (!e.em || e.em >= desde)).map((e) => e.ms).sort((a, b) => a - b)
  if (!ms.length) return { total: 0, medianaMs: null, p95Ms: null, acima10s: 0, hooksPorParada: null }
  const q = (p) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))]
  const qtd = eventos.filter((e) => e.parada).map((e) => e.qtd)
  return { total: ms.length, medianaMs: q(0.5), p95Ms: q(0.95), acima10s: ms.filter((m) => m > 10000).length, hooksPorParada: Math.max(...qtd) }
}

/* CC-1046, ele em 11/10 ao ver a aba: "as explicações tão horríveis, não dá pra entender nada". O nome interno, o caminho
   do arquivo e o texto cortado no meio saem da frente. Cada hook ganha um TÍTULO em português (o do catálogo de travas) e
   UMA frase do que ele faz com ele, pelo tipo. A barrada vira a frase principal inteira, sem letra maiúscula gritando. */
const FAZ = {
  trava: 'Pode impedir o Claude de editar ou rodar um comando, até ele corrigir o que faltou.',
  devolve: 'Ao fim da resposta, pode devolver o Claude para refazer, uma vez.',
  avisa: 'Confere a resposta no fim e, se achar algo errado, devolve com um aviso.',
  injeta: 'Põe instruções no começo da conversa. Não impede nada.',
  mede: 'Só registra números por trás. Você não vê nada.',
}
/* os que não estão no catálogo de travas do painel (são de fora, ou do próprio Claude Code) */
const FORA = {
  'todo-guard': ['Lista de tarefas aberta na entrega', 'Lembra o Claude quando ele entrega com tarefa da lista ainda aberta.'],
  'segredo-guard': ['Senha ou chave no texto', 'Impede o Claude de ler ou escrever arquivo com senha e chave.'],
  'inject-claude-md': ['Regras do projeto no começo', 'Põe as regras do projeto no começo da conversa.'],
  'session-start-profiler': ['Medição da abertura', 'Só mede quanto a abertura da conversa demora.'],
  'claude-hook': ['Hook interno de um plugin', 'Hook de um plugin instalado no Claude Code (não é deste painel).'],
  parada: ['Conferência do fim da resposta', 'Roda todas as conferências do fim da resposta de uma vez; cada uma aparece na lista com o próprio tempo.'],
}
let catalogo = null
export async function catalogoDosHooks() {
  if (catalogo) return catalogo
  try { const { HOOKS } = await import('./hooksCatalogo.mjs'); catalogo = new Map(HOOKS.map((h) => [String(h.script || '').replace(/\.m?js$/, ''), h])) } catch { catalogo = new Map() }
  return catalogo
}
/** A frase principal de uma barrada: o primeiro trecho até o ponto, inteiro, sem gritar em maiúsculas. */
export function frasePrincipal(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim()
  const m = /^(.{12,220}?[.!?])(\s|$)/.exec(s)
  let f = m ? m[1] : s.slice(0, 220).replace(/\s+\S*$/, '') + '…'
  // gritando: todo trecho de 2 ou mais palavras seguidas em maiúscula vira minúscula (sigla solta, como VPS, fica);
  // o que está entre aspas fica como veio
  const PAL = '[A-ZÀ-Þ0-9()]{1,}'
  const grito = new RegExp('(?:^|(?<=[\\s:,.]))' + PAL + '(?:[\\s,:]+' + PAL + ')+(?=[\\s,.:!?]|$)', 'g')
  f = f.split(/("[^"]*")/).map((p, i) => (i % 2 ? p : p.replace(grito, (m) => (/[A-ZÀ-Þ]{2}/.test(m) ? m.toLowerCase() : m)))).join('')
  return f.charAt(0).toUpperCase() + f.slice(1)
}
/** Título e explicação simples de cada hook. */
export function explicar(hooks, cat = new Map()) {
  return hooks.map((h) => {
    const c = cat.get(h.hook); const fora = FORA[h.hook]
    // CC-1047: a explicação própria do hook vence a frase por tipo, que era igual para 28 deles
    return { ...h, titulo: c?.label || fora?.[0] || h.hook, oQueFaz: EXPLICA[h.hook] || (c && FAZ[c.nivel]) || fora?.[1] || 'Hook sem descrição no catálogo do painel.',
      ultimas: h.ultimas.map((u) => ({ ...u, frase: frasePrincipal(u.texto) })) }
  })
}

/** O relatório: conversas mexidas nos últimos `dias` dias, de todos os projetos desta máquina. */
export function relatorio({ dias = 7, agora = Date.now(), base = BASE(), medidas = ARQUIVO_MEDIDAS_PARADA() } = {}) {
  const desde = agora - dias * 86400000; const eventos = []; let conversas = 0
  for (const arq of [`${medidas}.1`, medidas]) { try { eventos.push(...eventosDaParada(fs.readFileSync(arq, 'utf8'))) } catch { /* ainda não existe */ } }
  let pastas = []; try { pastas = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()) } catch { return { dias, conversas, hooks: [] } }
  for (const p of pastas) {
    let arqs = []; try { arqs = fs.readdirSync(path.join(base, p.name)).filter((f) => f.endsWith('.jsonl')) } catch { continue }
    for (const f of arqs) {
      const arq = path.join(base, p.name, f)
      let st; try { st = fs.statSync(arq) } catch { continue }
      if (st.mtimeMs < desde) continue
      conversas++; eventos.push(...eventosDoArquivo(arq))
    }
  }
  const hooks = juntar(eventos, { desde })
  return { dias, conversas, paradas: paradas(eventos, { desde }), tokens: hooks.reduce((s, h) => s + h.tokens, 0), hooks }
}
