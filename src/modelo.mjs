/**
 * CC-960: qual modelo e qual esforço cada tarefa pede, decidido ANTES.
 *
 * Decisão dele em 07/10, com a correção que mudou o desenho: *"não é sobre
 * refazer a tarefa, é sobre intervalar as tarefas e colocar critérios de
 * avaliação do modelo correto e orientar a próxima sessão pra fazer no modelo
 * correto, se não aumentamos o gasto de token com retrabalho"*.
 *
 * Por isso a indicação nasce na tarefa (por critério escrito, ajustável por
 * ele), a sessão abre sabendo (CC-974) e a trava dos ajudantes só confere
 * (CC-975). Nada aqui troca modelo sozinho: o Claude Code não deixa um gancho
 * trocar o modelo da conversa, só o dos ajudantes.
 *
 * As regras são uma lista em ordem, e a primeira que casa decide. Lista e não
 * pontuação: com pontos, ninguém consegue dizer de cabeça por que uma tarefa
 * caiu no Opus, e a regra que ele não lê não é regra dele.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const MODELOS = [
  { codigo: 'sonnet', rotulo: 'Sonnet', desc: 'executa o que já está claro' },
  { codigo: 'opusplan', rotulo: 'Opus planeja, Sonnet executa', desc: 'o Opus escreve o plano em arquivo, cada peça vai para um ajudante Sonnet' },
  { codigo: 'opus', rotulo: 'Opus', desc: 'achar causa, decidir desenho, mexer no que outra sessão ou o cliente sente' },
]

/** Os três níveis do Claude Code (effortLevel), com o nome dele. */
export const ESFORCOS = [
  { codigo: 'low', rotulo: 'baixo' },
  { codigo: 'medium', rotulo: 'médio' },
  { codigo: 'high', rotulo: 'alto' },
]

/* `area` e `risco` vêm das escalas do backlog.mjs: trava, agente e maquinas são
   as áreas em que o estrago sai desta sessão. */
const ALCANCE_LARGO = new Set(['trava', 'agente', 'maquinas'])

export const REGRAS = [
  { quando: 'decisão dele', se: (i) => i.natureza === 'DEC', modelo: null, esforco: null, porque: 'quem resolve é ele, não um modelo' },
  { quando: 'tarefa grande', se: (i) => i.tamanho === 'G', modelo: 'opusplan', esforco: 'high', porque: 'grande: o Opus planeja em arquivo e o Sonnet faz cada peça' },
  { quando: 'defeito', se: (i) => i.natureza === 'DEF', modelo: 'opus', esforco: (i) => (i.tamanho === 'P' ? 'medium' : 'high'), porque: 'defeito: achar a causa, e a primeira hipótese costuma estar errada' },
  { quando: 'chega no cliente', se: (i) => i.risco === 'cliente', modelo: 'opus', esforco: 'high', porque: 'o estrago chega em quem paga' },
  { quando: 'alcance largo', se: (i) => ALCANCE_LARGO.has(i.area) || i.risco === 'compartilhado', modelo: 'opus', esforco: 'medium', porque: 'mexe no que outra sessão ou outra máquina sente' },
  { quando: 'medição', se: (i) => i.natureza === 'MED', modelo: 'sonnet', esforco: 'medium', porque: 'medir sem mexer em nada' },
  { quando: 'registro', se: (i) => i.natureza === 'DOC', modelo: 'sonnet', esforco: 'low', porque: 'texto, sem código' },
  { quando: 'pedido médio', se: (i) => i.tamanho === 'M', modelo: 'sonnet', esforco: 'high', porque: 'pedido claro, de até uma hora, em tela, dado ou texto' },
  { quando: 'pedido pequeno', se: () => true, modelo: 'sonnet', esforco: 'medium', porque: 'pedido pequeno e claro' },
]

const valido = (lista, v) => lista.some((x) => x.codigo === v)

/**
 * O que a tarefa pede. O ajuste dele (`item.modelo`, `item.esforco`) vence o
 * critério, campo por campo: ele pode trocar só o esforço e deixar o modelo.
 * Micro tarefa sem tamanho herda o do pai só pela regra, não por cópia.
 */
export function indicado(item) {
  if (!item) return null
  const r = REGRAS.find((x) => x.se(item))
  const esf = typeof r.esforco === 'function' ? r.esforco(item) : r.esforco
  const ajuste = { modelo: valido(MODELOS, item.modelo) ? item.modelo : null, esforco: valido(ESFORCOS, item.esforco) ? item.esforco : null }
  return {
    modelo: ajuste.modelo || r.modelo,
    esforco: ajuste.esforco || esf,
    regra: r.quando,
    porque: ajuste.modelo || ajuste.esforco ? 'ajuste dele na tarefa' : r.porque,
    ajustado: Boolean(ajuste.modelo || ajuste.esforco),
  }
}

export const rotuloModelo = (c) => MODELOS.find((x) => x.codigo === c)?.rotulo || c
export const rotuloEsforco = (c) => ESFORCOS.find((x) => x.codigo === c)?.rotulo || c

/** A família de um nome de modelo como ele aparece por aí: `opus[1m]`, `claude-opus-5-5`, `opusplan`, `sonnet`. */
export function familia(nome) {
  const n = String(nome || '').toLowerCase()
  if (n.includes('opusplan')) return 'opusplan'
  if (n.includes('opus')) return 'opus'
  if (n.includes('sonnet')) return 'sonnet'
  if (n.includes('haiku')) return 'haiku'
  return null
}

/**
 * O modelo em que a sessão abriu. A entrada do gancho traz `model` quando o
 * Claude Code manda; senão vale a configuração, na ordem dele: a local do
 * projeto, a do projeto, a global. `env.CC_HOME` isola o teste da casa real.
 */
export function modeloDaSessao(dados, raiz, casa = process.env.CC_HOME || join(homedir(), '.claude')) {
  const m = dados?.model
  if (m) return typeof m === 'string' ? m : m.id || m.display_name || null
  for (const f of [join(raiz, '.claude', 'settings.local.json'), join(raiz, '.claude', 'settings.json'), join(casa, 'settings.json')]) {
    try { const s = JSON.parse(readFileSync(f, 'utf8')); if (s.model) return s.model } catch { /* sem o arquivo, o próximo */ }
  }
  return null
}

/**
 * CC-975: a tarefa que ESTA sessão pôs em andamento, pelo diário do backlog
 * (as marcas de medida carregam a sessão). A última entrada em "andando" sem
 * saída da mesma sessão. Outra sessão andando com outra tarefa não conta.
 */
export function andandoDaSessao(eventos, sessao) {
  if (!sessao) return null
  let id = null
  for (const e of eventos) {
    if (e.tipo !== 'medida' || e.sessao !== sessao) continue
    if (e.estado === 'EM') id = e.id
    else if (e.id === id) id = null
  }
  return id
}

/* Ajudante que só lê e busca não é execução da tarefa: passa sempre. */
const SO_LEITURA = new Set(['Explore', 'claude-code-guide', 'statusline-setup', 'caveman:cavecrew-investigator'])

/**
 * CC-975: a chamada de ajudante bate com o modelo que a tarefa pede? Devolve o
 * motivo da recusa, ou null. Sem `model` na chamada o ajudante herda o da
 * sessão, e o `fork` herda sempre (ignora `model`).
 */
export function conferirAjudante(item, entrada = {}, modeloDaSessao = null) {
  const ind = indicado(item)
  if (!ind?.modelo || SO_LEITURA.has(entrada.subagent_type)) return null
  const herdado = familia(entrada.subagent_type === 'fork' ? modeloDaSessao : entrada.model || modeloDaSessao)
  const vai = herdado === 'opusplan' ? 'sonnet' : herdado // fora do planejamento, opusplan executa em Sonnet
  if (!vai) return null // sem saber em que modelo sai, não barra
  const leve = vai === 'sonnet' || vai === 'haiku'
  const certo = ind.modelo === 'opus' ? vai === 'opus'
    : ind.modelo === 'opusplan' ? leve || entrada.subagent_type === 'Plan'
      : leve
  if (certo) return null
  const quer = ind.modelo === 'opus' ? 'opus' : 'sonnet'
  return `${item.id} pede ${rotuloModelo(ind.modelo)} (${ind.porque}), e este ajudante sairia em ${vai}${entrada.subagent_type === 'fork' ? ' (o fork herda o modelo da sessão)' : ''}. `
    + `Refaça a chamada com model: "${quer}"${entrada.subagent_type === 'fork' ? ' num general-purpose' : ''}. `
    + `Se a tarefa precisa mesmo de outro modelo, ajuste nela, que fica na história: node cc.mjs backlog modelo ${item.id} <sonnet|opusplan|opus>.`
}

/* Força relativa, para saber se a sessão abriu acima ou abaixo do que a tarefa pede.
   `opusplan` conta como Opus para quem abre a sessão: é o Opus que planeja. */
const FORCA = { haiku: 0, sonnet: 1, opusplan: 2, opus: 2 }

/**
 * CC-974: a orientação para a sessão que abre. Nunca troca nada: diz o que a
 * tarefa pede e o que fazer com a diferença.
 *
 * Abaixo do pedido: avisar ele para abrir no modelo certo, porque gancho não
 * troca o modelo da conversa. Acima: tarefa P faz direto (delegar custa a
 * releitura do ajudante, que não herda nada); tarefa M vai INTEIRA para um
 * ajudante no modelo certo, uma chamada, nunca picada.
 */
export function orientar(item, modeloDaSessao) {
  const ind = indicado(item)
  if (!ind?.modelo) return null
  const base = `${item.id} pede ${rotuloModelo(ind.modelo)}, esforço ${rotuloEsforco(ind.esforco)} (${ind.porque}).`
  const sessao = familia(modeloDaSessao)
  if (!sessao) return { ...ind, texto: base }
  /* Decisão dele em 07/10: os projetos abrem em opusplan ("inicia em sonnet, e se formos planejar liga o opus").
     A sessão já executa em Sonnet e planeja em Opus: nada a delegar, só dizer quando planejar. */
  if (sessao === 'opusplan') {
    return ind.modelo === 'sonnet'
      ? { ...ind, acao: 'seguir', texto: `${base} A sessão executa em Sonnet: siga direto, sem modo de planejamento.` }
      : { ...ind, acao: 'planejar', texto: `${base} Entre no modo de planejamento (é o Opus) para ${ind.modelo === 'opus' ? 'achar a causa e decidir' : `planejar em docs/${item.id}.md`}; saia dele para executar, que é o Sonnet.` }
  }
  const pede = FORCA[ind.modelo]; const tem = FORCA[sessao]
  if (tem < pede) {
    return { ...ind, acao: 'avisar', texto: `${base} Esta sessão abriu em ${sessao}, abaixo do que a tarefa pede: AVISE ele no começo para abrir com /model ${ind.modelo === 'opusplan' ? 'opusplan' : 'opus'} antes de você começar, e não comece a tarefa sem a resposta dele.` }
  }
  if (ind.modelo === 'opusplan') {
    return { ...ind, acao: 'planejar', texto: `${base} Planeje em docs/${item.id}.md e mande cada peça para UM ajudante (Agent com model: "sonnet"), uma peça por chamada; confira teste e tela de cada uma.` }
  }
  if (tem > pede) {
    if (item.tamanho === 'P') return { ...ind, acao: 'direto', texto: `${base} Esta sessão abriu em ${sessao}, acima do que a tarefa pede, mas ela é pequena: faça direto. Delegar custa a releitura do ajudante, que sai mais caro que a tarefa.` }
    return { ...ind, acao: 'delegar', texto: `${base} Esta sessão abriu em ${sessao}, acima do que a tarefa pede: mande a tarefa INTEIRA para um ajudante (Agent com model: "${ind.modelo}"), numa chamada só, com o pronto e o como conferir dela; depois confira você.` }
  }
  return { ...ind, acao: 'seguir', texto: `${base} A sessão já está no modelo certo.` }
}
