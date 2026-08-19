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
import path from 'node:path'
import { casaClaude } from './platform.mjs'

/* `casaClaude()`, nunca `os.homedir()`: é o único lugar que resolve a pasta
   `.claude`, e `CC_HOME` redireciona tudo para uma casa isolada. Achado em
   17/08 ao tentar provar a tela de rotas de outra máquina com um pacote de
   laboratório: a instância de teste continuava lendo a pasta REAL, então o
   teste não podia funcionar e um pacote de mentira teria acabado no painel
   dele. Função e não constante, porque `CC_HOME` pode mudar entre chamadas. */
export const dirFederacao = () => path.join(casaClaude(), 'control-center-federacao')
export const DIR = dirFederacao()

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
      // CC-48: 40 projetos é folgado e limita o estrago de um pacote malformado
      rotas: lista(bruto.rotas, 40),
      /* CC-165: o resumo dos backlogs. Mesmo teto das rotas, e cada item é
         recortado campo a campo em vez de aceito inteiro: um `titulos` com
         mil entradas de 10 KB passaria pelo limite do pacote e só apareceria
         como tela travada, que é o tipo de defeito que não se lê no código. */
      backlogs: lista(bruto.backlogs, 40).map((b) => ({
        projeto: String(b?.projeto || '').slice(0, 80),
        atualizadoEm: Number(b?.atualizadoEm) || null,
        frentes: Number(b?.frentes) || 0,
        abertas: Number(b?.abertas) || 0,
        titulos: (Array.isArray(b?.titulos) ? b.titulos : [])
          .slice(0, 6).map((t) => String(t).slice(0, 160)),
      })).filter((b) => b.projeto),
      em: Number(bruto.em) || Date.now(),
      recebidoEm: Date.now(),
    },
  }
}

/** Escrita atômica, a mesma regra do `meta.json`: leitor concorrente nunca
 *  pode pegar arquivo pela metade. */
export function gravarPacote(pacote) {
  const dir = dirFederacao()
  fs.mkdirSync(dir, { recursive: true })
  const alvo = path.join(dir, `${pacote.maquina.id}.json`)
  const tmp = `${alvo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(pacote))
  fs.renameSync(tmp, alvo)
  return alvo
}

/* ===================== CC-166: pedidos de uma máquina para outra =====================
 *
 * Pedido dele: abrir uma sessão no desktop a partir do celular, *"daí eu já
 * abro a sessão no app, que é onde eu mais uso"*.
 *
 * ## Por que é pergunta, e não ordem
 *
 * A VPS **nunca** alcança o PC atrás do NAT. Então quem pergunta é sempre o
 * PC: no mesmo ciclo de 30s em que ele já empurra o pacote, ele lê o que
 * ficou guardado para ele. Nenhuma porta nova, nenhum serviço novo.
 *
 * ## O que um pedido pode dizer, e o que não pode
 *
 * Decisão dele em 18/08, escolhendo entre três desenhos: **só projeto que a
 * máquina-alvo já conhece**. Um pedido carrega um NOME de projeto, nunca um
 * comando, nunca um caminho. Quem executa resolve o nome contra a própria
 * lista de projetos e recusa o que não achar.
 *
 * A diferença importa: com comando livre, quem escrevesse na fila da VPS
 * rodaria qualquer coisa no PC do Felipe. Com nome de projeto, o pior caso é
 * abrir uma sessão numa pasta que já era dele.
 *
 * Pedido é de uso único e some ao ser lido: fila que não esvazia reabriria a
 * mesma sessão a cada 30 segundos, para sempre. */

const arquivoPedidos = () => path.join(dirFederacao(), '_pedidos.json')

const lerPedidosBrutos = () => {
  try { return JSON.parse(fs.readFileSync(arquivoPedidos(), 'utf8')) } catch { return [] }
}

const gravarPedidos = (lista) => {
  const dir = dirFederacao()
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${arquivoPedidos()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(lista, null, 1))
  fs.renameSync(tmp, arquivoPedidos())
}

/** Pedido velho é pedido que ninguém foi buscar: a máquina estava desligada, e
 *  abrir a sessão horas depois seria surpresa, não serviço. */
export const VALIDADE_PEDIDO_MS = 10 * 60 * 1000

/**
 * Enfileira "abra uma sessão no projeto X" para a máquina Y.
 *
 * `projeto` é um nome, e é higienizado como tal: quem executa ainda vai
 * conferir se conhece esse projeto, mas nada que pareça caminho pode sequer
 * ser gravado aqui.
 */
export function pedirSessao({ paraMaquina, projeto, de = null, now = Date.now() }) {
  const alvo = seguro(paraMaquina)
  const nome = String(projeto || '').trim()
  if (!alvo) return { ok: false, erro: 'sem máquina de destino' }
  if (!nome || /[\\/:]|\.\./.test(nome)) return { ok: false, erro: 'nome de projeto inválido' }

  const lista = lerPedidosBrutos().filter((p) => now - (p.em || 0) < VALIDADE_PEDIDO_MS)
  /* Mesmo projeto pedido duas vezes seguidas é dedo duplo no botão, não duas
     sessões. Abrir duas sem querer é o desperdício que a própria tela avisa. */
  if (lista.some((p) => p.paraMaquina === alvo && p.projeto === nome)) {
    return { ok: true, jaPedido: true }
  }
  lista.push({ id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, paraMaquina: alvo, projeto: nome, de, em: now })
  gravarPedidos(lista)
  return { ok: true, projeto: nome, paraMaquina: alvo }
}

/**
 * Os pedidos de uma máquina, e a leitura os CONSOME.
 *
 * Some ao ser lido de propósito: fila que não esvazia reabriria a mesma sessão
 * a cada ciclo de 30 segundos, para sempre. O preço é que uma falha de rede
 * entre ler e executar perde o pedido, e esse é o lado certo de errar: pedido
 * perdido custa um clique, pedido repetido custa uma sessão fantasma por
 * ciclo.
 */
export function pegarPedidos(maquina, now = Date.now()) {
  const alvo = seguro(maquina)
  if (!alvo) return []
  const todos = lerPedidosBrutos()
  const meus = todos.filter((p) => p.paraMaquina === alvo && now - (p.em || 0) < VALIDADE_PEDIDO_MS)
  if (!meus.length) {
    /* Aproveita para varrer o que venceu, mas só grava se algo mudou: escrita
       a cada 30 segundos por máquina, sem motivo, é disco à toa. */
    const vivos = todos.filter((p) => now - (p.em || 0) < VALIDADE_PEDIDO_MS)
    if (vivos.length !== todos.length) gravarPedidos(vivos)
    return []
  }
  gravarPedidos(todos.filter((p) => !meus.includes(p) && now - (p.em || 0) < VALIDADE_PEDIDO_MS))
  return meus
}

/** Só para a tela e para o teste: o que está na fila, sem consumir. */
export const pedidosPendentes = (now = Date.now()) =>
  lerPedidosBrutos().filter((p) => now - (p.em || 0) < VALIDADE_PEDIDO_MS)

/** O que as outras máquinas mandaram. Arquivo corrompido é ignorado, nunca
 *  derruba a leitura das demais. */
export function lerPacotes(now = Date.now()) {
  const dir = dirFederacao()
  let arquivos = []
  try {
    /* O `_` na frente marca o que é da casa e não é pacote de máquina
       (`_pedidos.json`, do CC-166). O `if (!p?.maquina?.id)` abaixo já
       descartaria, mas por acidente: quem lesse isto depois não teria como
       saber que existe outro arquivo nesta pasta de propósito. */
    arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  } catch {
    return []
  }
  const pacotes = []
  for (const f of arquivos) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
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

/**
 * Soma a aba tempo das várias máquinas, por projeto.
 *
 * O Felipe pediu "os dados de todos os meus dispositivos, somados, e eu poder
 * filtrar pra separar o que é da VPS e o que é deste desktop". Some-se o que é
 * físico (horas e tokens) e guarde-se a quebra por origem, que é o que o filtro
 * usa e o que responde "onde eu trabalhei mais".
 *
 * O que NÃO é somado, de propósito: dinheiro. `valor`, `custoReal` e `sobra`
 * saem da taxa e da assinatura, que moram no config de CADA máquina e podem
 * divergir. Somar dois números calculados com tabelas diferentes daria um total
 * que não é de ninguém. Eles são recalculados na máquina que exibe, sobre as
 * horas já somadas.
 */
export function mesclarTempo(local, pacotes, origemLocal) {
  const porProjeto = new Map()

  const juntar = (resumo, origem) => {
    for (const p of resumo?.projetos || []) {
      const atual = porProjeto.get(p.projeto) || {
        ...p, ativoMs: 0, tokens: 0, porMaquina: [],
        // zerados: quem exibe recalcula com a própria taxa
        valor: 0, custoReal: null, sobra: null,
      }
      atual.ativoMs += p.ativoMs || 0
      atual.tokens += p.tokens || 0
      atual.porMaquina.push({ maquina: origem, ativoMs: p.ativoMs || 0, tokens: p.tokens || 0 })
      porProjeto.set(p.projeto, atual)
    }
  }

  juntar(local, origemLocal)
  for (const pac of pacotes) {
    if (pac.tempo) juntar(pac.tempo, { ...pac.maquina, idadeMs: pac.idadeMs, semContato: pac.semContato })
  }

  const projetos = [...porProjeto.values()].sort((a, b) => b.ativoMs - a.ativoMs)
  return { ...(local || {}), projetos, federado: pacotes.some((p) => p.tempo) }
}

/** As máquinas conhecidas, para montar o filtro do topo. A local vem primeiro:
 *  é a que o Felipe está olhando. */
/**
 * CC-48: as rotas ocupadas em TODAS as máquinas, por projeto.
 *
 * A resposta que o `rota-guard` precisa antes de liberar uma rota: ela pode
 * estar livre no quadro daqui e ocupada por uma sessão do outro lado que ainda
 * não commitou.
 *
 * ⚠️ **Rota ocupada em qualquer máquina conta como ocupada.** Na dúvida entre
 * bloquear demais e deixar duas sessões se pisarem, bloquear demais custa uma
 * mensagem; a colisão custa trabalho perdido. O `veredito` acompanha para quem
 * lê decidir — órfã do outro lado continua sendo órfã.
 */
export function rotasDeTodos(locais = [], pacotes = [], origemLocal = 'local') {
  const porProjeto = new Map()

  const juntar = (quadros, origem, idade = 0) => {
    for (const q of quadros || []) {
      if (!q?.projeto) continue
      const lista = porProjeto.get(q.projeto) || []
      for (const o of q.ocupadas || []) {
        // mesma rota reportada pelas duas máquinas: fica a de sinal mais novo
        const igual = lista.find((x) => x.rota === o.rota && x.id === o.id)
        if (igual) {
          if ((o.ultimoSinal || 0) > (igual.ultimoSinal || 0)) Object.assign(igual, o, { origem, idade })
          continue
        }
        lista.push({ ...o, origem, idade })
      }
      porProjeto.set(q.projeto, lista)
    }
  }

  juntar(locais, origemLocal)
  for (const p of pacotes) juntar(p.rotas, p.maquina?.nome || p.maquina?.id || 'remota', p.idade)

  return Object.fromEntries(porProjeto)
}

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
/**
 * CC-48: as rotas viajam no pacote, e por isso deixam de esperar commit.
 *
 * Antes, marcar rota no PC só chegava na VPS depois de commit, push e pull —
 * latência e ruído justamente no arquivo mais disputado, que foi a queixa do
 * Felipe ("a gente faz muitos testes internos"). O quadro em markdown continua
 * sendo a verdade legível e versionada; o que muda é **o canal**.
 *
 * Vai só o essencial de cada rota ocupada, nunca o arquivo inteiro: o quadro do
 * inovallbond passa de 60 KB, quase todo histórico de rota fechada, e o limite
 * de pacote é 2 MB para a federação inteira.
 */
export const enxugarRotas = (quadros) => quadros
  .filter((q) => q?.projeto)
  .map((q) => ({
    projeto: q.projeto,
    ocupadas: (q.ocupadas || []).map((o) => ({
      rota: o.rota, id: o.id, ultimoSinal: o.ultimoSinal, veredito: o.veredito,
    })),
  }))

/**
 * CC-165: o backlog de cada projeto, reduzido ao que cabe numa tela.
 *
 * Pedido dele ao desenhar o serviço: *"fazendo uma varredura nos projetos
 * onlines e nos seus backlogs"*. Até aqui o pacote levava agentes, uso e
 * horas, nunca o que cada projeto tem para fazer, então a VPS sabia QUEM
 * estava trabalhando e nunca EM QUÊ.
 *
 * ## O que viaja, e o que fica
 *
 * Só a contagem e os títulos das frentes ABERTAS. Nunca o texto do
 * `ROADMAP.md`, e a razão é o CC-161: o arquivo viaja pelo git, que é o
 * transporte com histórico e resolução de conflito. Mandar o conteúdo aqui
 * criaria uma segunda cópia, mais nova ou mais velha que a do git dependendo
 * do dia, e ninguém saberia qual vale.
 *
 * Medido em 19/08: ler o roadmap dos 23 projetos custa **14ms**, então isto
 * cabe no ciclo sem o cuidado que as horas exigiram.
 */
export function resumirBacklogs(mapas = []) {
  return mapas
    .filter((m) => m && m.mapa)
    .map(({ projeto, mapa }) => {
      const frentes = (mapa.grupos || []).flatMap((g) => g.frentes || [])
      const abertas = frentes.filter((f) => f.estado !== 'feito')
      return {
        projeto,
        atualizadoEm: mapa.atualizadoEm || null,
        frentes: frentes.length,
        abertas: abertas.length,
        /* Seis títulos, não todos: o pacote tem teto de 2 MB e a tela mostra
           uma linha por projeto. Quem quiser a lista inteira abre o projeto,
           onde o arquivo está por completo. */
        titulos: abertas.slice(0, 6).map((f) => f.titulo),
      }
    })
}

export function montarPacote({
  maquina, jobs = [], servidores = [], uso = null, tempo = null, rotas = [], backlogs = null,
}) {
  const enxuto = jobs.map((j) => ({
    id: j.id, status: j.status, subject: j.subject, project: j.project, sub: j.sub,
    route: j.route, frente: j.frente, model: j.model, tokens: j.tokens, tipo: j.tipo || 'background',
    remoto: j.remoto || false, todos: j.todos, todosDone: j.todosDone, blockers: j.blockers,
    detail: j.detail, createdAt: j.createdAt, updatedAt: j.updatedAt, cwd: j.cwd,
    lastPrompt: j.lastPrompt, entregueEmAberto: j.entregueEmAberto, sinais: j.sinais,
  }))
  return {
    maquina, jobs: enxuto, servidores, uso, tempo, rotas: enxugarRotas(rotas), backlogs, em: Date.now(),
  }
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
    /* O CORPO da resposta importa desde o CC-166: é por ele que voltam os
       pedidos guardados para esta máquina, e é a única direção possível
       (o servidor nunca alcança quem está atrás de NAT). Até 19/08 esta
       função devolvia só `ok` e `status`, então o pedido chegava e era
       descartado aqui, sem erro nenhum — o envio dizia 200 e nada acontecia
       do outro lado. Resposta sem JSON válido não é problema: o servidor
       pode ser uma versão antiga, e aí simplesmente não há pedido. */
    let corpoResposta = null
    try { corpoResposta = await r.json() } catch { /* servidor antigo ou resposta vazia */ }
    return { ok: r.ok, status: r.status, ...(corpoResposta && typeof corpoResposta === 'object' ? corpoResposta : {}) }
  } catch (e) {
    return { ok: false, erro: String(e?.message || e) }
  }
}
