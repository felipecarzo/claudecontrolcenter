/**
 * O contexto do projeto viajando junto com a conversa.
 *
 * ## O pedido
 *
 * Perguntado o que atravessa quando ele troca de agente no meio de uma conversa,
 * ele escolheu o mais completo dos três caminhos: **a conversa, as regras e o
 * estado do projeto**. A conversa já atravessa, por `gate.mjs`. Este arquivo é o
 * resto.
 *
 * ## O achado que enxuga o custo pela metade
 *
 * Metade disso **já chega de graça**, e duplicar dobraria o custo por turno sem
 * ganho nenhum:
 *
 * | o que | Claude | opencode | agy |
 * |---|---|---|---|
 * | as regras do projeto | lê sozinho | lê sozinho | precisa injetar |
 * | as pendências dele | proteção que já existe | encaixe que já existe | idem |
 * | o mapa do projeto | **aqui** | **aqui** | **aqui** |
 * | quem está em qual rota | **aqui** | **aqui** | **aqui** |
 * | quem trabalha agora | **aqui** | **aqui** | **aqui** |
 *
 * Sobra o que MUDA a toda hora, que é justamente o que nenhum deles tem como
 * saber sozinho.
 *
 * ## As rotas são a peça de segurança, não enfeite
 *
 * Ele autorizou o agente do gate a agir livre, com os hooks como rede. Mas ele
 * opera de 4 a 15 agentes em paralelo, e o Método Routia existe para eles não se
 * atropelarem. Um agente do gate que não sabe quais arquivos já têm dono é
 * exatamente a colisão que o método evita. **Sem esta seção, "agir livre" vira
 * colisão.**
 *
 * ## Teto POR SEÇÃO, não só total
 *
 * O mapa deste projeto sozinho tem 235 KB. Com teto só no total, ele comeria as
 * rotas e os agentes inteiros, e ninguém saberia. Cada seção tem o seu, e **todo
 * corte se declara** no próprio texto: truncar calado é a família de defeito que
 * este projeto mais paga.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lerRoadmap } from './roadmap.mjs'
import { retratoDoQuadro, humanizar } from './presenca.mjs'
import { todosOsJobs } from './sessoes.mjs'

/* Os tetos, em caracteres. ~4 caracteres por token, então 6000 é perto de 1500
   tokens por turno. Numa conversa de 30 turnos isso é 45 mil tokens só de
   contexto, e é por isso que o número mora aqui em cima, visível, e não escondido
   no meio de uma função. */
export const GATE_MAX_PACOTE = 6000
export const GATE_MAX_ROADMAP = 2000
export const GATE_MAX_ROTAS = 1500
export const GATE_MAX_AGENTES = 1500

/**
 * Corta pelo teto e DIZ que cortou.
 *
 * A contagem vai no texto que o agente lê, não num campo que só o painel vê: o
 * agente precisa saber que a lista continua, senão ele responde como se aquilo
 * fosse tudo o que existe.
 */
function cortar(linhas, teto, nomeDoQueSobra) {
  const fora = []
  let tamanho = 0
  for (const l of linhas) {
    if (tamanho + l.length + 1 > teto) break
    fora.push(l)
    tamanho += l.length + 1
  }
  const restam = linhas.length - fora.length
  if (restam > 0) fora.push(`  (e mais ${restam} ${nomeDoQueSobra}, cortadas pelo teto deste resumo)`)
  return { linhas: fora, cortadas: restam }
}

/** O que está aberto no mapa do projeto. Só o aberto: o feito é ruído aqui. */
function secaoRoadmap(cwd) {
  let mapa = null
  try { mapa = lerRoadmap(cwd) } catch { mapa = null }
  /* `null` é "não achei o mapa", e é diferente de "o mapa está vazio". Dizer
     qual dos dois é o que impede o agente de concluir que não há trabalho
     aberto quando na verdade a leitura não aconteceu. */
  if (!mapa) return { titulo: 'O QUE ESTÁ ABERTO NESTE PROJETO', linhas: ['  não achei o mapa do projeto (docs/ROADMAP.md)'], cortadas: 0 }

  const abertas = []
  for (const g of mapa.grupos || []) {
    if (g.estado === 'feito') continue
    for (const f of g.frentes || []) {
      if (f.estado === 'feito') continue
      abertas.push(`  · ${f.titulo}${f.dependeDe?.length ? ` (depende de ${f.dependeDe.join(', ')})` : ''}`)
    }
  }
  if (!abertas.length) return { titulo: 'O QUE ESTÁ ABERTO NESTE PROJETO', linhas: ['  nada aberto no mapa agora'], cortadas: 0 }

  const c = cortar(abertas, GATE_MAX_ROADMAP, 'frentes abertas')
  return { titulo: 'O QUE ESTÁ ABERTO NESTE PROJETO', ...c }
}

/**
 * Quem está em qual rota, e se dá para acreditar.
 *
 * Os três vereditos vêm de `presenca.mjs` e a diferença entre eles importa aqui:
 * `ativa` é dono trabalhando agora e precisa ser respeitado; `orfa` é marca
 * esquecida por quem sumiu; `desconhecida` pode ser sessão de outra máquina, e
 * NÃO é o mesmo que órfã. Tratar as duas últimas como iguais faria o agente
 * atropelar trabalho vivo de outra máquina.
 */
function secaoRotas(cwd, jobs) {
  let retrato = null
  try { retrato = retratoDoQuadro(cwd, { jobs, sessoes: [] }) } catch { retrato = null }
  if (!retrato) return { titulo: 'QUEM JÁ TEM DONO AQUI (Método Routia)', linhas: ['  este projeto não usa o quadro de rotas'], cortadas: 0 }
  if (!retrato.ocupadas.length) return { titulo: 'QUEM JÁ TEM DONO AQUI (Método Routia)', linhas: ['  nenhuma rota ocupada agora'], cortadas: 0 }

  const linhas = retrato.ocupadas.map((r) => {
    const quem = r.id ? `sessão ${r.id}` : 'sem id na linha'
    const quando = r.silencioMs == null ? 'sem sinal conhecido' : `deu sinal há ${humanizar(r.silencioMs)}`
    const ressalva = r.veredito === 'orfa' ? ' — provavelmente esquecida'
      : r.veredito === 'desconhecida' ? ' — pode ser sessão de outra máquina, não presuma que está livre'
      : ''
    return `  · rota ${r.rota}: ${quem}, ${quando}${ressalva}`
  })
  const c = cortar(linhas, GATE_MAX_ROTAS, 'rotas')
  return {
    titulo: 'QUEM JÁ TEM DONO AQUI (Método Routia)',
    ...c,
    rodape: 'Antes de editar um arquivo, confira se ele já tem dono acima. Rota ocupada por outra sessão não é sua.',
  }
}

/**
 * CC-263: as regras dele, valendo em QUALQUER agente.
 *
 * As 43 travas deste projeto seguram o Claude Code e mais nada. O opencode e o
 * agy respondem sem saber de travessão, de rota ocupada, ou de que ele quer
 * prova antes de "feito". Perguntado o que queria que valesse nos três, ele
 * respondeu **"tudo"**.
 *
 * O que entra aqui é o que se ENSINA. O que precisa RECUSAR uma entrega é outra
 * metade, e mora no painel, porque nenhum dos dois tem gancho de fim de turno.
 *
 * Curto de propósito: isto viaja a cada turno, e regra que não cabe no teto é
 * regra que empurra outra para fora. São as que ele cobrou mais de uma vez.
 */
const REGRAS = [
  'Nunca use travessão nem meia-risca, em texto nenhum. Use duas frases, vírgula ou dois pontos. É a regra mais quebrada e a que ele reconhece na hora.',
  'Prova antes de dizer feito. Sem imagem, endereço ou saída de comando, diga que não conseguiu conferir, em vez de descrever a intenção como resultado.',
  'O mecanismo que ele nomeia É o pedido. Se ele disse tabela, é tabela. Discorde ANTES, nunca entregue a troca como fato consumado.',
  'Mensagem longa que abre com "e se" ou "tive uma ideia" é visão, não tarefa: registre com as palavras dele e execute depois.',
  'Ordem curta é para executar e calar. Perguntar se pode confirmar é ruído.',
  'Não cite nome de arquivo, de trava ou de código de tarefa como se ele soubesse o que é. Diga o que a coisa faz com ele.',
  'Antes de editar um arquivo, veja se ele já tem dono na lista de rotas acima. Rota de outra sessão não é sua.',
  'Se o mesmo pedido vier duas vezes, pare e pergunte o que a palavra quer dizer. A causa quase nunca é implementação errada.',
]

function secaoRegras() {
  return {
    titulo: 'COMO ELE TRABALHA (vale para você, seja qual for o programa)',
    linhas: REGRAS.map((r) => `  · ${r}`),
    cortadas: 0,
  }
}

/** Quem está trabalhando agora, para o agente não repetir trabalho em curso. */
function secaoAgentes(jobs, projeto) {
  const vivos = (jobs || []).filter((j) => j.status === 'working' || j.status === 'waiting')
  if (!vivos.length) return { titulo: 'QUEM ESTÁ TRABALHANDO AGORA', linhas: ['  nenhum agente trabalhando neste momento'], cortadas: 0 }

  /* Os do mesmo projeto primeiro: são os que podem colidir com o que este
     agente vai fazer. */
  const ordem = [...vivos].sort((a, b) => (b.project === projeto) - (a.project === projeto))
  const linhas = ordem.map((j) => {
    const onde = `${j.project || '?'}${j.frente ? ' › ' + j.frente : ''}`
    const estado = j.status === 'waiting' ? 'esperando o Felipe' : 'trabalhando'
    return `  · ${onde}: ${j.subject || 'sem assunto'} (${estado})`
  })
  const c = cortar(linhas, GATE_MAX_AGENTES, 'agentes')
  return { titulo: 'QUEM ESTÁ TRABALHANDO AGORA', ...c }
}

/**
 * O pacote inteiro, pronto para ser injetado.
 *
 * `agente` muda o que entra: os três leem as regras do projeto sozinhos, mas o
 * agy é o único que não recebe as pendências dele por mecanismo próprio, então
 * para ele vale acrescentar a linha que diz onde procurar.
 */
export function montar(conversa, { agente = 'claude', jobs = null } = {}) {
  const cwd = conversa?.cwd
  if (!cwd) throw new Error('sem pasta: não há projeto de que falar')

  let agentes = jobs
  if (!agentes) {
    /* Nunca `readJobs()` sozinho: a pasta de agentes de fundo está VAZIA nesta
       VPS, e ele devolveria zero com cinco trabalhando. É o CC-124 de volta. */
    try { agentes = todosOsJobs() } catch { agentes = [] }
    if (agentes && typeof agentes.then === 'function') agentes = []
  }

  const secoes = [
    {
      titulo: 'ONDE VOCÊ ESTÁ',
      linhas: [
        `  projeto: ${conversa.projeto || path.basename(cwd)}`,
        `  pasta: ${cwd}`,
        `  esta conversa é do painel do Felipe (o cockpit), e mais de um agente responde nela.`,
        `  o histórico que você recebeu pode ter sido escrito por outro agente.`,
      ],
      cortadas: 0,
    },
    /* As regras vêm ANTES do estado do projeto: é o que decide COMO ele
       responde, e o resto é o que ele responde SOBRE. */
    secaoRegras(),
    secaoRoadmap(cwd),
    secaoRotas(cwd, agentes || []),
    secaoAgentes(agentes || [], conversa.projeto),
  ]

  const partes = secoes.map((s) => `## ${s.titulo}\n${s.linhas.join('\n')}${s.rodape ? '\n  ' + s.rodape : ''}`)
  let texto = ['# O estado do projeto agora, escrito pelo painel', ...partes].join('\n\n')

  /* O teto total é a última rede, depois dos tetos por seção. Chegar aqui já é
     sinal de que algum teto de seção está frouxo, então o corte diz isso. */
  let cortadoNoTotal = false
  if (texto.length > GATE_MAX_PACOTE) {
    texto = texto.slice(0, GATE_MAX_PACOTE) + '\n\n(este resumo foi cortado no teto total)'
    cortadoNoTotal = true
  }

  return {
    texto,
    secoes: secoes.map((s) => ({ titulo: s.titulo, linhas: s.linhas.length, cortadas: s.cortadas })),
    cortes: secoes.reduce((a, s) => a + (s.cortadas || 0), 0),
    cortadoNoTotal,
    bytes: texto.length,
    agente,
  }
}

/**
 * Escreve o pacote num arquivo e devolve o caminho.
 *
 * Vai por arquivo, e não na linha de comando, pelo mesmo motivo medido do
 * pedido: um pacote grande estoura o teto de tamanho da linha de comando, e esse
 * erro é engolido em silêncio pelo sistema.
 */
export function gravarPacote(pacote, turnoId) {
  const dir = path.join(os.tmpdir(), 'cc-gate')
  fs.mkdirSync(dir, { recursive: true })
  const arq = path.join(dir, `${turnoId}.contexto.md`)
  fs.writeFileSync(arq, pacote.texto)
  return arq
}

/**
 * O encaixe do opencode e do agy está instalado?
 *
 * O Claude recebe o pacote por opção própria do programa. Os outros dois
 * recebem pelo encaixe que já existe. Sem ele, o pacote precisa entrar no
 * próprio pedido — e nunca pelos dois caminhos ao mesmo tempo, que seria pagar
 * o contexto duas vezes.
 */
export function plugInstalado() {
  try {
    return fs.existsSync(path.join(os.homedir(), '.config', 'opencode', 'plugin', 'tarefas.js'))
  } catch {
    return false
  }
}
