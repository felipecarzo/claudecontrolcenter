/**
 * CC-1076: a frente acabou de ficar pronta?
 *
 * "Frente" é o campo `frente` do item, o mesmo agrupamento do ROADMAP gerado (`regerarRoadmap` em backlog.mjs, que
 * agrupa por `item.frente`; micro tarefa, com `pai`, aparece como andamento do pai e não conta). Pronta = nenhum item
 * da frente em B0, B1, EM, DE ou TR (fora os que ele mandou para fora do MVP, `lugar.onde: "fora"`), todos em PR ou OK
 * (KO não conta contra), e ao menos um item mudou de estado para PR ou OK nos últimos 30 minutos.
 *
 * Não repete: o conjunto de ids em PR/OK já coberto por frente fica em
 * `~/.local/share/agent-cockpit/guias-frente/<projeto>.json`. Só devolve a frente se houver id novo fora dele.
 * Não chama modelo e não escreve no backlog.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { movidosRecentes } from './guias.mjs'

const ABERTOS = new Set(['B0', 'B1', 'EM', 'DE', 'TR'])
const JANELA_PADRAO = 30 * 60e3

export const slugDaFrente = (nome) => String(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frente'

export const arquivoCobertura = (raiz, home = os.homedir()) =>
  path.join(home, '.local', 'share', 'agent-cockpit', 'guias-frente', `${path.basename(raiz).replace(/[^\w.-]/g, '_')}.json`)

export function lerCobertura(raiz, home = os.homedir()) {
  try { return JSON.parse(fs.readFileSync(arquivoCobertura(raiz, home), 'utf8')) || {} } catch { return {} }
}

/** Grava os ids cobertos da frente (união com o que já estava). Falha de gravação não derruba. */
export function marcarCobertos(raiz, frente, ids, { home = os.homedir(), agora = Date.now() } = {}) {
  try {
    const todo = lerCobertura(raiz, home)
    const antes = new Set(todo[frente]?.ids || [])
    for (const i of ids) antes.add(i)
    todo[frente] = { ids: [...antes].sort(), em: new Date(agora).toISOString() }
    const f = arquivoCobertura(raiz, home)
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, JSON.stringify(todo))
    return true
  } catch { return false }
}

/** Itens do backlog por frente, só pedidos (sem `pai`). Varredura simples, sem validar. */
export function itensPorFrente(raiz) {
  let texto = ''
  try { texto = fs.readFileSync(path.join(raiz, 'docs', 'backlog.jsonl'), 'utf8') } catch { return new Map() }
  const por = new Map()
  for (const l of texto.split('\n')) {
    if (!l) continue
    let i; try { i = JSON.parse(l) } catch { continue }
    if (!i?.id || i.pai) continue
    const f = String(i.frente || 'sem frente')
    if (!por.has(f)) por.set(f, [])
    por.get(f).push(i)
  }
  return por
}

/**
 * As frentes que acabaram de ficar prontas, cada uma como `{ frente, itens, novos }` (`itens`: todos os ids em PR/OK;
 * `novos`: os que o último guia não cobriu). Com `gravar` (padrão), já marca o conjunto como coberto: é o que impede a
 * segunda disparada enquanto o Haiku ainda escreve. O `--ensaio` passa `gravar: false`.
 * ponytail: a janela vale no máximo 30 min, o teto de `movidosRecentes`.
 */
export function frentesConcluidas(raiz, { agora = Date.now(), janelaMs = JANELA_PADRAO, home = os.homedir(), gravar = true } = {}) {
  const recentes = new Set(movidosRecentes(raiz, { desde: agora - janelaMs, agora }))
  if (!recentes.size) return []
  const cobertura = lerCobertura(raiz, home)
  const saida = []
  for (const [frente, itens] of itensPorFrente(raiz)) {
    if (frente === 'sem frente') continue
    if (itens.some((i) => ABERTOS.has(i.estado) && i.lugar?.onde !== 'fora')) continue
    const prontos = itens.filter((i) => i.estado === 'PR' || i.estado === 'OK').map((i) => i.id)
    if (!prontos.some((id) => recentes.has(id))) continue
    const cobertos = new Set(cobertura[frente]?.ids || [])
    const novos = prontos.filter((id) => !cobertos.has(id))
    if (!novos.length) continue
    saida.push({ frente, itens: prontos, novos })
    if (gravar) marcarCobertos(raiz, frente, prontos, { home, agora })
  }
  return saida
}
