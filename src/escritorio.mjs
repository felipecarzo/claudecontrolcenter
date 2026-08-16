/**
 * CC-60 e CC-79 — o cockpit alimentando o escritório do Felipe.
 *
 * ## A decisão dele, em 16/08
 *
 * > "eu só quero ficar com o plugin que é um fork meu no projeto app_escritorio,
 * > e eu tô fazendo ele pra mesclar todos os meus agentes, da vps ou locais, pra
 * > funcionar no cockpit"
 *
 * Isso encerra o CC-60: dos três Pixel Agents que existiam nesta VPS (o oficial
 * do npm na 3101, o do usuário `agente` na 3100, e o fork), fica **só o fork**.
 *
 * ## O que este módulo resolve, e por que ele existe aqui e não lá
 *
 * "Mesclar agentes da VPS ou locais" já está resolvido neste repositório: é a
 * federação (CC-47). Cada máquina empurra um pacote, o painel une as listas e
 * carimba a origem em cada agente. Refazer isso dentro do fork significaria
 * **duas implementações da mesma coisa**, e a segunda envelheceria calada — o
 * erro que este projeto evita em todo lugar.
 *
 * Então a divisão é: o cockpit sabe QUEM está trabalhando; o escritório sabe
 * DESENHAR. Este módulo é a fronteira entre os dois.
 *
 * ## Por que o id vira número, e por que ele é derivado
 *
 * O protocolo do Pixel Agents usa `id: number` (ver `core/src/messages.ts`).
 * Nossos identificadores são strings de sessão. Um contador incremental seria a
 * escolha óbvia e a errada: o número mudaria a cada reinício do painel, e cada
 * boneco trocaria de lugar e de cor sem ninguém ter mexido em nada.
 *
 * O número sai de um hash do par `origem + id`. Estável entre reinícios, estável
 * entre máquinas, e sem registro paralelo para envelhecer.
 */

/**
 * Hash de 31 bits, determinístico e sem dependência.
 *
 * FNV-1a: a mesma string dá sempre o mesmo número, em qualquer máquina e em
 * qualquer versão do Node. O `>>> 0` e a máscara mantêm o valor dentro do
 * inteiro positivo que o protocolo espera — número negativo ou acima de 2^31
 * quebraria a chave do lado deles sem erro visível.
 */
export function idNumerico(chave) {
  let h = 0x811c9dc5
  const s = String(chave)
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) & 0x7fffffff
}

/**
 * O estado que o escritório precisa desenhar, por agente.
 *
 * `active` e `waiting` são os dois únicos valores do protocolo deles
 * (`AgentActivityStatus`). Nossos cinco estados colapsam nesses dois, e a perda
 * é intencional: o boneco só sabe trabalhar ou esperar. O estado rico continua
 * no cartão do cockpit, que é onde ele é útil.
 */
const ATIVIDADE = { working: 'active', waiting: 'waiting', failed: 'waiting', done: 'waiting', idle: 'waiting' }

/**
 * A ferramenta que está rodando agora.
 *
 * ⚠️ `fan[]` guarda resíduo da última ferramenta mesmo depois do job terminar —
 * armadilha já registrada no CLAUDE.md. Por isso só é lida enquanto o status é
 * `working`: sem essa guarda, o boneco ficaria para sempre "usando o Bash".
 */
const ferramentaDe = (job) => (job.status === 'working' && job.fan?.length
  ? String(job.fan[0]?.name || job.fan[0] || '').slice(0, 40) || null
  : null)

/**
 * Traduz um agente do cockpit para o vocabulário do escritório.
 *
 * O que vai além do protocolo deles — `origem`, `rota`, `frente` — vai em campos
 * próprios, nunca sobrescrevendo os que eles já definem. Assim o fork consome o
 * que entende hoje e ganha o resto quando quiser, sem quebrar em nenhum momento.
 */
export function paraEscritorio(job, { rotas = [] } = {}) {
  const origem = job.origem?.nome || job.origem?.id || 'aqui'
  const chave = `${job.origem?.id || 'local'}:${job.id}`

  /* CC-79: a rota que este agente ocupa.
     O elo é o id de sessão, que os dois lados já conhecem — nada de inventar
     identificador novo. Casa pelos 8 primeiros caracteres, que é a marca que o
     quadro de rotas usa. */
  const marca = String(job.sessionId || job.id || '').slice(0, 8)
  const minhas = rotas.filter((r) => r.quem && marca && r.quem.startsWith(marca))

  return {
    id: idNumerico(chave),
    chave,
    folderName: job.project || null,
    // o boneco de outra máquina precisa ser reconhecível como tal, senão o
    // escritório vira uma sala só e a federação perde o sentido na tela
    isExternal: Boolean(job.origem && !job.origem.local),
    status: ATIVIDADE[job.status] || 'waiting',
    awaitingInput: job.status === 'waiting',
    toolName: ferramentaDe(job),
    // extras nossos, fora do protocolo — nomeados para não colidir
    ccOrigem: origem,
    ccOrigemLocal: Boolean(job.origem?.local),
    ccSemContato: Boolean(job.origem?.semContato),
    ccRotas: minhas.map((r) => r.rota),
    ccArquivos: minhas.flatMap((r) => r.arquivos || []),
    ccFrente: job.meta?.frente || null,
    ccAssunto: job.meta?.subject || null,
    ccModelo: job.model || null,
  }
}

/**
 * O escritório inteiro: agentes de todas as máquinas, com as rotas cruzadas.
 *
 * Recebe o snapshot já mesclado em vez de ler disco: quem federa é o `web.mjs`,
 * e ler de novo aqui daria uma segunda leitura que pode discordar da primeira no
 * mesmo tique.
 */
export function montar(jobs = [], { rotas = [], maquinas = [] } = {}) {
  const agentes = jobs.map((j) => paraEscritorio(j, { rotas }))

  /* Duas salas: quem está aqui e quem está em outra máquina. O escritório
     desenha uma sala por origem, e sem esse agrupamento pronto ele teria que
     reimplementar a conta de "quantas máquinas existem" — que já é resposta
     conhecida da federação. */
  const porOrigem = new Map()
  for (const a of agentes) {
    if (!porOrigem.has(a.ccOrigem)) porOrigem.set(a.ccOrigem, [])
    porOrigem.get(a.ccOrigem).push(a.id)
  }

  return {
    agentes,
    salas: [...porOrigem].map(([nome, ids]) => ({
      nome,
      agentes: ids,
      local: agentes.find((a) => a.ccOrigem === nome)?.ccOrigemLocal || false,
      semContato: agentes.find((a) => a.ccOrigem === nome)?.ccSemContato || false,
    })),
    // máquina conhecida SEM agente também aparece: sala vazia é informação
    // ("o PC está ligado e ninguém trabalhando"), sumir com ela não é
    maquinas: maquinas.map((m) => ({ id: m.id, nome: m.nome, local: m.local, semContato: m.semContato })),
    at: Date.now(),
  }
}
