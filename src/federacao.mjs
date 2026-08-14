/**
 * Federação: um painel só, com as duas máquinas dentro.
 *
 * Pedido do Felipe em 14/08: "eu queria abrir os dois e estar sempre os dois
 * online, sempre os dois pegando tudo que os dois estão fazendo", com filtro no
 * topo e a origem escrita ao lado de cada agente.
 *
 * ## A topologia é torta, e não por escolha
 *
 * O desktop alcança a VPS (`cockpit.carzo.com.br`); a VPS **nunca** alcança o
 * desktop atrás de NAT. Então a VPS é o servidor e o desktop é cliente que
 * empurra. Qualquer desenho simétrico não sai do papel.
 *
 * ## O que trafega é resumo, nunca arquivo
 *
 * Os transcritos do PC têm centenas de MB. O pacote leva o que a tela precisa
 * (jobs já derivados, uso do plano, totais de tempo, portas em escuta) e nunca
 * o material bruto. `LIMITE_PACOTE` existe para isso não degenerar com o tempo.
 *
 * ## Falha de rede é silenciosa
 *
 * Mesma regra do câmbio: sem contato, cada painel continua inteiro com o que é
 * local, e a máquina ausente aparece como "sem contato há Xmin". Nunca sumir
 * calada, que faria parecer que o trabalho não existiu.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DIR = path.join(os.homedir(), '.claude', 'control-center-federacao')

/** Acima disto o pacote é recusado: 2 MB já é muito para um resumo de tela. */
export const LIMITE_PACOTE = 2 * 1024 * 1024

/** Depois disso a máquina conta como sem contato, mas o dado continua visível
 *  (marcado como velho) em vez de sumir. */
export const SEM_CONTATO_MS = 5 * 60 * 1000

const seguro = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)

/**
 * Valida o que chegou pela rede. Nada aqui confia no remetente: id sujo vira
 * caminho de arquivo, e lista gigante vira memória.
 */
export function validarPacote(bruto) {
  if (!bruto || typeof bruto !== 'object') return { ok: false, erro: 'pacote vazio' }
  const id = seguro(bruto.maquina?.id)
  if (!id) return { ok: false, erro: 'pacote sem identidade de máquina' }

  const lista = (v, max) => (Array.isArray(v) ? v.slice(0, max) : [])
  return {
    ok: true,
    pacote: {
      maquina: { id, nome: String(bruto.maquina?.nome || id).slice(0, 60) },
      jobs: lista(bruto.jobs, 500),
      servidores: lista(bruto.servidores, 200),
      uso: bruto.uso && typeof bruto.uso === 'object' ? bruto.uso : null,
      tempo: bruto.tempo && typeof bruto.tempo === 'object' ? bruto.tempo : null,
      em: Number(bruto.em) || Date.now(),
      recebidoEm: Date.now(),
    },
  }
}

/** Escrita atômica, a mesma regra do `meta.json`: leitor concorrente nunca
 *  pode pegar arquivo pela metade. */
export function gravarPacote(pacote) {
  fs.mkdirSync(DIR, { recursive: true })
  const alvo = path.join(DIR, `${pacote.maquina.id}.json`)
  const tmp = `${alvo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(pacote))
  fs.renameSync(tmp, alvo)
  return alvo
}

/** O que as outras máquinas mandaram. Arquivo corrompido é ignorado, nunca
 *  derruba a leitura das demais. */
export function lerPacotes(now = Date.now()) {
  let arquivos = []
  try {
    arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  const pacotes = []
  for (const f of arquivos) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
      if (!p?.maquina?.id) continue
      const idade = now - (p.recebidoEm || p.em || 0)
      pacotes.push({ ...p, idadeMs: idade, semContato: idade > SEM_CONTATO_MS })
    } catch { /* pacote quebrado não pode cegar o painel inteiro */ }
  }
  return pacotes.sort((a, b) => a.maquina.nome.localeCompare(b.maquina.nome))
}

/**
 * Carimba a origem numa lista local. Feito na leitura, e não na gravação, para
 * o dado em disco continuar do jeito que sempre foi: renomear a máquina não
 * pode exigir reescrever histórico.
 */
export const carimbar = (lista, origem) =>
  (Array.isArray(lista) ? lista : []).map((x) => ({ ...x, origem }))

/**
 * Junta local com remoto.
 *
 * A chave é `origem.id + id`, nunca só `id`: duas máquinas podem ter job com o
 * mesmo identificador curto, e o de uma sobrescreveria o da outra em silêncio.
 */
export function mesclar(locais, pacotes, origemLocal, campo = 'jobs') {
  const fora = pacotes.flatMap((p) =>
    carimbar(p[campo], { ...p.maquina, idadeMs: p.idadeMs, semContato: p.semContato }))
  const tudo = [...carimbar(locais, { ...origemLocal, idadeMs: 0, semContato: false }), ...fora]

  const vistos = new Set()
  return tudo.filter((x) => {
    const chave = `${x.origem?.id}:${x.id ?? x.pid ?? JSON.stringify(x).slice(0, 40)}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

/** As máquinas conhecidas, para montar o filtro do topo. A local vem primeiro:
 *  é a que o Felipe está olhando. */
export function maquinasConhecidas(pacotes, origemLocal) {
  return [
    { ...origemLocal, local: true, idadeMs: 0, semContato: false },
    ...pacotes.map((p) => ({ ...p.maquina, local: false, idadeMs: p.idadeMs, semContato: p.semContato })),
  ]
}

/**
 * Monta o que ESTA máquina manda para o servidor.
 *
 * Recebe os dados prontos em vez de ir buscá-los: mantém o módulo testável e
 * evita que a montagem do pacote dispare, sem querer, a varredura de 800 MB da
 * aba tempo dentro do tique de 2 segundos.
 */
export function montarPacote({ maquina, jobs = [], servidores = [], uso = null, tempo = null }) {
  const enxuto = jobs.map((j) => ({
    id: j.id, status: j.status, subject: j.subject, project: j.project, sub: j.sub,
    route: j.route, frente: j.frente, model: j.model, tokens: j.tokens, tipo: j.tipo || 'background',
    remoto: j.remoto || false, todos: j.todos, todosDone: j.todosDone, blockers: j.blockers,
    detail: j.detail, createdAt: j.createdAt, updatedAt: j.updatedAt, cwd: j.cwd,
    lastPrompt: j.lastPrompt, entregueEmAberto: j.entregueEmAberto, sinais: j.sinais,
  }))
  return { maquina, jobs: enxuto, servidores, uso, tempo, em: Date.now() }
}

/**
 * Empurra o pacote para o servidor. Nunca lança: se a rede cair, o painel local
 * segue inteiro e a próxima tentativa resolve.
 */
export async function enviar({ enviarPara, token, pacote }) {
  if (!enviarPara || !token) return { ok: false, erro: 'federação não configurada' }
  const corpo = JSON.stringify(pacote)
  if (corpo.length > LIMITE_PACOTE) return { ok: false, erro: 'pacote grande demais' }
  try {
    const r = await fetch(`${enviarPara}/api/federacao`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cc-token': token },
      body: corpo,
      signal: AbortSignal.timeout(10_000),
    })
    return { ok: r.ok, status: r.status }
  } catch (e) {
    return { ok: false, erro: String(e?.message || e) }
  }
}
