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
import path from 'node:path'
import { casaClaude } from './platform.mjs'
import { DIR_SESSOES_ABRIGO } from './metaSessao.mjs'

/* CC-232: passou a resolver por `casaClaude()` em vez de `os.homedir()`, sem
   mudar de lugar (os dois dão o mesmo caminho nesta máquina, conferido). O que
   muda é o teste poder escrever numa casa temporária via `CC_HOME`: esta lista
   é digitada à mão e não tem outra fonte, e o gate já apagou dado real do
   Felipe uma vez por escrever no arquivo de verdade. */
export const ARQUIVO = path.join(casaClaude(), 'control-center-meu.json')

/**
 * CC-232, o abrigo: dentro do sandbox do Claude Code, `~/.claude` está montada
 * SOMENTE LEITURA.
 *
 * Descoberto tentando registrar as quatro pendências de 20/08 pelo comando novo:
 * `EROFS` na cara, quatro vezes. É a mesma armadilha do CC-157, em que a sessão
 * sumia do painel — e ali ela custou uma queixa dele de que uma sessão parecia
 * *"funcionando por fora do cockpit"*.
 *
 * Sem isto, o protocolo inteiro seria decorativo justamente onde ele trabalha:
 * o hook do fim de sessão mandaria registrar, e o comando não conseguiria.
 *
 * O caminho sai de `DIR_SESSOES_ABRIGO()` de propósito, subindo um nível, para
 * existir UMA conta de abrigo no projeto. Ela já respeita `CC_HOME`, que é o que
 * mantém o teste fora do dado real dele.
 */
export const ARQUIVO_ABRIGO = path.join(path.dirname(DIR_SESSOES_ABRIGO()), 'control-center-meu.json')

/** Os dois lugares onde a lista pode estar, na ordem em que valem. */
const ARQUIVOS = () => [ARQUIVO, ARQUIVO_ABRIGO]

const vazio = () => ({ tarefas: [] })

function lerDe(arquivo) {
  try {
    const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
    return { tarefas: Array.isArray(d.tarefas) ? d.tarefas : [] }
  } catch {
    return vazio()
  }
}

/**
 * A lista inteira, juntando casa e abrigo.
 *
 * Sem a junção, uma tarefa registrada de dentro do sandbox ficaria invisível
 * para o painel — que é o mesmo defeito de escrever no cartão da sessão, só que
 * mais difícil de perceber.
 */
export function ler() {
  const vistos = new Set()
  const tarefas = []
  for (const arq of ARQUIVOS()) {
    for (const t of lerDe(arq).tarefas) {
      if (!t || vistos.has(t.id)) continue
      vistos.add(t.id)
      tarefas.push(t)
    }
  }
  return { tarefas }
}

/** Backup antes de sobrescrever, a mesma regra do `notes.mjs`: isto é texto
 *  digitado à mão, não tem outra fonte. Lá o arquivo já amanheceu vazio uma vez
 *  e duas listas se perderam. */
function gravarEm(arquivo, dados) {
  const dir = path.dirname(arquivo)
  fs.mkdirSync(dir, { recursive: true })
  try { if (fs.existsSync(arquivo)) fs.copyFileSync(arquivo, `${arquivo}.bak`) } catch { /* segue */ }
  const tmp = `${arquivo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 1))
  fs.renameSync(tmp, arquivo)
  return dados
}

/**
 * Grava na casa; se ela estiver trancada, no abrigo.
 *
 * Devolve por onde saiu, para quem chama poder dizer isso em voz alta — a lição
 * do CC-157 é que cair no abrigo em SILÊNCIO é como o dado parece sumir.
 */
export function gravar(dados) {
  let ultimoErro = null
  for (const arq of ARQUIVOS()) {
    try {
      gravarEm(arq, dados)
      return { ...dados, _onde: arq, _abrigo: arq !== ARQUIVO }
    } catch (e) { ultimoErro = e }
  }
  throw ultimoErro || new Error('não consegui gravar a lista dele em lugar nenhum')
}

/** Em qual dos dois arquivos aquela tarefa mora. */
function arquivoDa(idAlvo) {
  for (const arq of ARQUIVOS()) {
    if (lerDe(arq).tarefas.some((t) => t.id === idAlvo)) return arq
  }
  return null
}

const id = () => Math.random().toString(36).slice(2, 9)

/**
 * Acrescenta uma tarefa dele. `projeto` e `frente` são opcionais: nem tudo que
 * depende dele pertence a um projeto (autorizar sudo, decidir uma direção).
 */
export function acrescentar({ texto, projeto = null, frente = null, porque = null, em = null, prova = null }) {
  const t = String(texto || '').trim()
  if (!t) return { ok: false, erro: 'tarefa sem texto' }
  const todas = ler().tarefas
  // mesmo texto no mesmo projeto não entra duas vezes: eu registro isto de
  // dentro de sessões diferentes, e ele leria a mesma coisa duplicada
  if (todas.some((x) => x.texto === t && x.projeto === projeto && !x.feito)) {
    return { ok: true, jaExistia: true, tarefas: todas }
  }
  /* CC-262: `prova` é como se sabe, sozinho, que esta tarefa acabou. Opcional
     de propósito: nem tudo que depende dele dá para observar no mundo, e exigir
     prova de tudo faria a lista deixar de ser usada. */
  const nova = { id: id(), texto: t, projeto, frente, porque, prova: prova || null, feito: false, em: em || Date.now() }

  /* Escreve no arquivo, NÃO a lista fundida: cada um guarda só as suas.
     Gravar o conjunto inteiro no abrigo faria uma tarefa apagada na casa
     ressuscitar na leitura seguinte, vinda da cópia. */
  let ultimoErro = null
  for (const arq of ARQUIVOS()) {
    try {
      const d = lerDe(arq)
      d.tarefas.push(nova)
      gravarEm(arq, d)
      return { ok: true, tarefas: ler().tarefas, abrigo: arq !== ARQUIVO }
    } catch (e) { ultimoErro = e }
  }
  return { ok: false, erro: `não consegui gravar a lista dele: ${ultimoErro?.message || 'motivo desconhecido'}` }
}

/** Aplica uma mudança na tarefa, no arquivo onde ela realmente mora. */
function mexerNa(idAlvo, transformar) {
  const arq = arquivoDa(idAlvo)
  if (!arq) return { ok: false, erro: 'tarefa não encontrada' }
  const d = lerDe(arq)
  const resultado = transformar(d)
  if (resultado?.erro) return resultado
  try {
    gravarEm(arq, d)
  } catch (e) {
    /* Só acontece com a tarefa na casa trancada e o processo dentro do sandbox.
       Dizer isso em voz alta é melhor que falhar calado: quem lê consegue rodar
       o mesmo comando de fora e resolver. */
    return { ok: false, erro: `a tarefa está em ${arq}, que não aceitou escrita (${e.code || e.message})` }
  }
  return { ok: true, tarefas: ler().tarefas }
}

export function marcar(idAlvo, feito = true) {
  return mexerNa(idAlvo, (d) => {
    const t = d.tarefas.find((x) => x.id === idAlvo)
    if (!t) return { ok: false, erro: 'tarefa não encontrada' }
    t.feito = Boolean(feito)
    t.feitoEm = t.feito ? Date.now() : null
    return null
  })
}

export function remover(idAlvo) {
  return mexerNa(idAlvo, (d) => {
    d.tarefas = d.tarefas.filter((x) => x.id !== idAlvo)
    return null
  })
}

/**
 * CC-262: ensina a tarefa a se conferir sozinha.
 *
 * Passa por `mexerNa` como as outras, e não por `gravar()` direto. A primeira
 * versão usou `gravar()` e a prova **não pegou em três tarefas**: `gravar()`
 * escreve a lista FUNDIDA no primeiro arquivo gravável, então a tarefa que mora
 * na casa virava uma cópia no abrigo, e a leitura continuava achando a original
 * sem prova. Silencioso: o comando dizia "agora sabe se conferir" e nada mudava.
 */
export function definirProva(idAlvo, prova) {
  return mexerNa(idAlvo, (d) => {
    const t = d.tarefas.find((x) => x.id === idAlvo)
    if (!t) return { ok: false, erro: 'tarefa não encontrada' }
    t.prova = prova || null
    return null
  })
}

/**
 * A lista completa: o arquivo mais o que os agentes pediram no `meta.json`.
 *
 * Aberta primeiro, e dentro disso a mais antiga no topo — mesma regra do
 * cockpit, o que apodrece primeiro sobe.
 */
/**
 * Item de backlog parado esperando decisão dele TAMBÉM é pendência dele.
 *
 * Defeito achado em 16/08, e o pior tipo: a tela que responde "o que depende de
 * mim" não mostrava um item que estava literalmente parado esperando ele
 * escolher. Ela lia só a lista dele e os to-dos marcados com dono `felipe`, e
 * ignorava o roadmap.
 *
 * A marca é a mesma que o resto do projeto já usa: `⏸` no título, com o motivo
 * ao lado. Nada de campo novo.
 */
function doRoadmap(projetos = []) {
  const saida = []
  for (const p of projetos) {
    for (const g of p.mapa?.grupos || []) {
      for (const f of g.frentes || []) {
        if (f.estado !== 'esperando') continue
        // só o que espera ELE; "depende do CC-60" espera outro item, não ele
        if (!/decis[ãa]o d(o felipe|ele)|voc[êe] (decide|escolhe)|falta ele/i.test(f.titulo)) continue
        saida.push({
          id: `roadmap:${p.projeto}:${f.titulo.slice(0, 30)}`,
          texto: f.titulo.replace(/^\S+\s*⏸?\s*/, '').trim() || f.titulo,
          projeto: p.projeto,
          frente: f.titulo,
          porque: f.citacao || null,
          feito: false,
          em: f.nasceuEm || null,
          fonte: 'roadmap',
        })
      }
    }
  }
  return saida
}

/**
 * CC-227: toda pendência diz de qual máquina ela veio.
 *
 * Pedido dele, olhando um cartão que dizia só `proj_controlcenter / CC-60`:
 * *"não está falando que está na VPS, não está falando que está no desktop,
 * não está falando nada. Sendo que eu tinha pedido pra você pra ser uma regra
 * de todos os quadros"*.
 *
 * As três fontes precisam de tratamento diferente, e por isso o carimbo nasce
 * aqui e não na tela:
 *  · `agente`: a máquina é a da sessão, e ela já viaja carimbada na federação;
 *  · `lista` e `roadmap`: são lidas do disco de quem monta a resposta, então a
 *    máquina é a local. Sem isto, uma pendência escrita no PC apareceria sem
 *    dono ao ser lida pela VPS.
 */
export function tudo(jobs = [], { projetos = [], maquinaLocal = null } = {}) {
  const daqui = (t) => (maquinaLocal ? { ...t, maquina: maquinaLocal } : t)
  const doArquivo = ler().tarefas.map((t) => daqui({ ...t, fonte: 'lista' }))
  const doMapa = doRoadmap(projetos).map(daqui)

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
        /* A máquina da SESSÃO, nunca a de quem lê: uma pendência de agente do
           PC continua sendo do PC quando a VPS mostra. */
        maquina: j.origem?.nome || j.origem?.id || maquinaLocal || null,
        semContato: Boolean(j.origem?.semContato),
      })
    }
  }

  const vistos = new Set()
  return [...doArquivo, ...dosAgentes, ...doMapa]
    .filter((t) => {
      const chave = `${t.projeto}|${t.texto}`
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .sort((a, b) => (a.feito ? 1 : 0) - (b.feito ? 1 : 0) || (a.em || 0) - (b.em || 0))
}
