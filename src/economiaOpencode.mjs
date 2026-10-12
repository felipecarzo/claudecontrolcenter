// CC-984: quanto o opencode gastou num projeto, e quanto isso pesaria no limite do plano Claude.
// Uso: node src/economiaOpencode.mjs <pasta do projeto> [saida.md]
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, basename, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const CACHE_LIDO = 0.1 // ponytail: cache lido pesa 10% de entrada nova, como no preço; o limite real do plano não é publicado
const SEMANA_MS = 7 * 86400000
const SEMANAS_NO_MES = 30 / 7

const pesado = (t) => t.entrada + t.saida + t.cacheEscrito + CACHE_LIDO * t.cacheLido
const zero = () => ({ entrada: 0, saida: 0, cacheEscrito: 0, cacheLido: 0, mensagens: 0 })
function somar(a, u) {
  a.entrada += u.input_tokens || 0; a.saida += u.output_tokens || 0
  a.cacheEscrito += u.cache_creation_input_tokens || 0; a.cacheLido += u.cache_read_input_tokens || 0; a.mensagens++
}

/** Tokens de todos os transcritos do Claude desde `desde`, por pasta de projeto e por modelo. Cada mensagem conta uma vez (id). */
export function lerClaude(desde, base = join(process.env.CC_HOME || join(homedir(), '.claude'), 'projects')) {
  const porProjeto = {}; const vistos = new Set()
  for (const pasta of readdirSync(base)) {
    const dir = join(base, pasta)
    let arqs; try { arqs = readdirSync(dir).filter((f) => f.endsWith('.jsonl')) } catch { continue }
    for (const f of arqs) {
      const arq = join(dir, f)
      if (statSync(arq).mtimeMs < desde) continue
      for (const l of readFileSync(arq, 'utf8').split('\n')) {
        if (!l.includes('"usage"')) continue
        let j; try { j = JSON.parse(l) } catch { continue }
        const u = j.message?.usage; const id = j.message?.id
        if (!u || !id || vistos.has(id) || Date.parse(j.timestamp) < desde) continue
        vistos.add(id)
        const p = (porProjeto[pasta] ||= { total: zero(), modelos: {} })
        somar(p.total, u); somar((p.modelos[j.message.model] ||= zero()), u)
      }
    }
  }
  return porProjeto
}

/** Mensagens do opencode cuja sessão rodou na pasta do projeto, por agente e modelo. */
export function lerOpencode(pasta, db = join(homedir(), '.local/share/opencode/opencode.db')) {
  const Banco = createRequire(join(pasta, 'package.json'))('better-sqlite3')
  const d = new Banco(db, { readonly: true, fileMustExist: true })
  const linhas = d.prepare("select m.data from message m join session s on s.id = m.session_id where s.directory like ? and m.data like '%\"role\":\"assistant\"%'").all(`%${basename(pasta)}%`)
  const porAgente = {}; const total = zero(); let de = Infinity; let ate = 0
  for (const { data } of linhas) {
    const m = JSON.parse(data); const t = m.tokens
    if (!t) continue
    const u = { input_tokens: t.input + (t.reasoning || 0), output_tokens: t.output, cache_creation_input_tokens: t.cache?.write, cache_read_input_tokens: t.cache?.read }
    somar(total, u); somar((porAgente[`${m.agent || '?'} / ${m.modelID}`] ||= zero()), u)
    de = Math.min(de, m.time?.created ?? de); ate = Math.max(ate, m.time?.created ?? ate)
  }
  return { total, porAgente, de, ate }
}

const f = (n) => Math.round(n).toLocaleString('pt-BR')
const linha = (nome, t) => `| ${nome} | ${f(t.mensagens)} | ${f(t.entrada)} | ${f(t.saida)} | ${f(t.cacheEscrito)} | ${f(t.cacheLido)} | ${f(pesado(t))} |`
const CAB = '| Quem | Mensagens | Entrada | Saída | Cache escrito | Cache lido | Peso (tokens) |\n|---|---|---|---|---|---|---|'

export function relatorio(pasta, uso, agora = Date.now()) {
  const nome = basename(pasta)
  const fim = uso.semana.resetaEm; const ini = fim - SEMANA_MS
  const claude = lerClaude(ini)
  const todos = Object.values(claude).reduce((a, p) => { for (const k of Object.keys(a)) a[k] += p.total[k]; return a }, zero())
  const pesoSemana = pesado(todos)
  const porPct = pesoSemana / uso.semana.pct // tokens por 1% do limite semanal, na semana em curso
  const op = lerOpencode(pasta)
  const pesoOp = pesado(op.total)
  const pctSemana = pesoOp / porPct / 100 * 100
  const pctMes = pctSemana / SEMANAS_NO_MES
  const meu = Object.entries(claude).find(([k]) => k.toLowerCase().includes(nome.toLowerCase().replace(/^vps_/, '')))?.[1]
  const dias = (op.ate - op.de) / 86400000
  const L = []
  L.push(`# Relatório de economia do opencode: ${nome}`, '', `Gerado em ${new Date(agora).toISOString().slice(0, 10)}. Fonte: banco do opencode (só leitura) e transcritos do Claude.`, '')
  L.push('## 1. Tokens gastos por agente', '', 'opencode (modelo gratuito, custo em dinheiro zero):', '', CAB)
  for (const [k, t] of Object.entries(op.porAgente).sort((a, b) => pesado(b[1]) - pesado(a[1]))) L.push(linha(k, t))
  L.push(linha('**opencode, total**', op.total), '')
  if (meu) { L.push(`Claude no mesmo projeto, na semana em curso:`, '', CAB); for (const [m, t] of Object.entries(meu.modelos)) L.push(linha(m, t)); L.push(linha('**Claude, total**', meu.total), '') }
  else L.push('Claude neste projeto, na semana em curso: nenhum transcrito encontrado.', '')
  L.push('## 2. Quanto isso pesaria no limite do Claude', '')
  L.push(`Se o mesmo trabalho tivesse sido feito pelo Claude, com os mesmos tokens do opencode, o peso seria de ${f(pesoOp)} tokens (cache lido a ${CACHE_LIDO * 100}%).`, '')
  L.push(`- **Limite semanal:** cerca de ${pctSemana.toFixed(1)}% de uma semana (de 0 a 100).`, `- **Limite mensal:** cerca de ${pctMes.toFixed(1)}% de um mês (${SEMANAS_NO_MES.toFixed(1)} semanas).`, '')
  L.push('Como foi calculado: o plano não publica o limite em tokens. Medi quanto o painel marca de uso semanal (' + uso.semana.pct + '% de 0 a 100) e quantos tokens o Claude gastou em todos os projetos desde ' + new Date(ini).toISOString().slice(0, 10) + ' (' + f(pesoSemana) + '). Daí saiu ' + f(porPct) + ' tokens por 1% da semana. É uma régua de estimativa, não uma fatura.', '')
  L.push('## 3. O que fica de fora da conta', '', `- O opencode rodou ${dias.toFixed(1)} dias neste projeto; o tokenizador dele difere do Claude (a contagem real no Claude pode variar).`, '- O modelo gratuito pode ter feito mais idas e vindas que o Claude faria; o número é o custo bruto, não o custo ajustado por qualidade.', '- A calibração usa uma semana só; semana com muito cache lido distorce a régua.', '')
  return { texto: L.join('\n'), pctSemana, pctMes, pesoOp }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pasta = resolve(process.argv[2] || '.')
  const uso = JSON.parse(readFileSync(join(process.env.CC_HOME || join(homedir(), '.claude'), 'control-center-uso.json'), 'utf8'))
  if (!uso.semana?.pct) { console.error('sem leitura do uso semanal (statusLine ainda não gravou)'); process.exit(1) }
  const r = relatorio(pasta, uso)
  const saida = process.argv[3]
  if (saida) { writeFileSync(saida, r.texto); console.log(`gravado em ${saida}`) } else console.log(r.texto)
  console.log(`\nresumo: ${r.pesoOp} tokens-peso, ${r.pctSemana.toFixed(1)}% da semana, ${r.pctMes.toFixed(1)}% do mês`)
}
