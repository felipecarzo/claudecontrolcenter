/**
 * As tarefas do Felipe: o que depende dele, de todos os projetos, num lugar.
 *
 * Pedido em 14/08: "quando eu tenho uma tarefa que você fala que eu tenho que
 * fazer, por exemplo se a gente está fazendo um jogo, eu tenho que cortar
 * alguns [assets] que você não consegue cortar — onde ficam as minhas tarefas?
 * a gente tem que criar uma forma de eu identificar o que são as tarefas em
 * andamento por IA e as tarefas em andamento minhas".
 *
 * ## Por que arquivo próprio, e não só um campo no meta.json
 *
 * A primeira versão lia apenas `todos` com `dono: 'felipe'` dentro do
 * `meta.json` de cada job. Testei e voltou vazia, o que expôs dois defeitos:
 *
 *   1. **Job é efêmero.** O CLI apaga job antigo (em 08/08 restavam 9 de
 *      semanas de trabalho). A tarefa dele sumiria junto, e tarefa de humano
 *      dura mais que a sessão que a criou.
 *   2. **Sessão interativa não tem job.** Trabalhando pelo celular, `cc set`
 *      recusa com "sem job" (CC-56). Eu não conseguiria nem registrar o que
 *      preciso dele enquanto trabalho com ele.
 *
 * Então a fonte principal é este arquivo, no molde do `notes.mjs`. O que vier
 * de `meta.json` com `dono: 'felipe'` continua sendo agregado por cima: agente
 * de background segue podendo pedir algo a ele.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const ARQUIVO = path.join(os.homedir(), '.claude', 'control-center-meu.json')

const vazio = () => ({ tarefas: [] })

export function ler() {
  try {
    const d = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'))
    return { tarefas: Array.isArray(d.tarefas) ? d.tarefas : [] }
  } catch {
    return vazio()
  }
}

/** Backup antes de sobrescrever, a mesma regra do `notes.mjs`: isto é texto
 *  digitado à mão, não tem outra fonte. Lá o arquivo já amanheceu vazio uma vez
 *  e duas listas se perderam. */
export function gravar(dados) {
  const dir = path.dirname(ARQUIVO)
  fs.mkdirSync(dir, { recursive: true })
  try { if (fs.existsSync(ARQUIVO)) fs.copyFileSync(ARQUIVO, `${ARQUIVO}.bak`) } catch { /* segue */ }
  const tmp = `${ARQUIVO}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 1))
  fs.renameSync(tmp, ARQUIVO)
  return dados
}

const id = () => Math.random().toString(36).slice(2, 9)

/**
 * Acrescenta uma tarefa dele. `projeto` e `frente` são opcionais: nem tudo que
 * depende dele pertence a um projeto (autorizar sudo, decidir uma direção).
 */
export function acrescentar({ texto, projeto = null, frente = null, porque = null, em = null }) {
  const t = String(texto || '').trim()
  if (!t) return { ok: false, erro: 'tarefa sem texto' }
  const d = ler()
  // mesmo texto no mesmo projeto não entra duas vezes: eu registro isto de
  // dentro de sessões diferentes, e ele leria a mesma coisa duplicada
  if (d.tarefas.some((x) => x.texto === t && x.projeto === projeto && !x.feito)) {
    return { ok: true, jaExistia: true, tarefas: d.tarefas }
  }
  d.tarefas.push({ id: id(), texto: t, projeto, frente, porque, feito: false, em: em || Date.now() })
  gravar(d)
  return { ok: true, tarefas: d.tarefas }
}

export function marcar(idAlvo, feito = true) {
  const d = ler()
  const t = d.tarefas.find((x) => x.id === idAlvo)
  if (!t) return { ok: false, erro: 'tarefa não encontrada' }
  t.feito = Boolean(feito)
  t.feitoEm = t.feito ? Date.now() : null
  gravar(d)
  return { ok: true, tarefas: d.tarefas }
}

export function remover(idAlvo) {
  const d = ler()
  const antes = d.tarefas.length
  d.tarefas = d.tarefas.filter((x) => x.id !== idAlvo)
  if (d.tarefas.length === antes) return { ok: false, erro: 'tarefa não encontrada' }
  gravar(d)
  return { ok: true, tarefas: d.tarefas }
}

/**
 * A lista completa: o arquivo mais o que os agentes pediram no `meta.json`.
 *
 * Aberta primeiro, e dentro disso a mais antiga no topo — mesma regra do
 * cockpit, o que apodrece primeiro sobe.
 */
export function tudo(jobs = []) {
  const doArquivo = ler().tarefas.map((t) => ({ ...t, fonte: 'lista' }))

  const dosAgentes = []
  for (const j of jobs) {
    for (const t of j.todos || []) {
      if (t.dono !== 'felipe' || t.done) continue
      dosAgentes.push({
        id: `job:${j.id}:${t.text.slice(0, 20)}`,
        texto: t.text,
        projeto: j.project,
        frente: j.frente || null,
        porque: j.subject || null,
        feito: false,
        em: j.updatedAt,
        fonte: 'agente',
        job: j.id,
      })
    }
  }

  const vistos = new Set()
  return [...doArquivo, ...dosAgentes]
    .filter((t) => {
      const chave = `${t.projeto}|${t.texto}`
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .sort((a, b) => (a.feito ? 1 : 0) - (b.feito ? 1 : 0) || (a.em || 0) - (b.em || 0))
}
