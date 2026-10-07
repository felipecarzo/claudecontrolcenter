/**
 * NISABA (CC-834), nome dado por ele em 01/10, a deusa suméria da escrita: o
 * sistema de projetos. Este arquivo é o núcleo dele.
 *
 * A tarefa como máquina de estados. A "classe" de toda tarefa.
 *
 * Ideia dele em 01/10: "sempre que entrasse uma nova tarefa, puxaria uma função
 * que criaria um novo objeto a partir de uma classe", e o porquê: "é mais fácil
 * prever erros em sistemas que regem sob regras". O princípio que saiu do
 * debate: a IA só sugere, a regra decide.
 *
 * Tudo aqui é função PURA: recebe os itens, devolve os itens novos e os
 * eventos que aconteceram. Quem grava é o backlog.mjs. Assim a regra se testa
 * sem disco, e a mesma conta vale para o terminal, o painel e o maestro.
 */

/**
 * De onde para onde. Fechar (OK) e cancelar (KO) valem de qualquer estado
 * aberto, porque os agentes fecham direto e a guarda (prova, motivo) já cobra.
 * O que a tabela proíbe é pular etapa: ideia sem especificação não anda, e
 * "falta prova" só existe depois de andar.
 */
export const TRANSICOES = {
  B0: ['B1', 'DE', 'TR', 'OK', 'KO'],
  B1: ['B0', 'EM', 'DE', 'TR', 'OK', 'KO'],
  EM: ['B1', 'PR', 'DE', 'TR', 'OK', 'KO'],
  PR: ['EM', 'DE', 'TR', 'OK', 'KO'],
  DE: ['B0', 'B1', 'EM', 'TR', 'OK', 'KO'],
  TR: ['B0', 'B1', 'EM', 'DE', 'OK', 'KO'],
  OK: ['B1', 'EM'], // reabrir
  KO: ['B0', 'B1'], // reviver
}

const aberto = (i) => i.estado !== 'OK' && i.estado !== 'KO'

/** Guardas: a condição para ENTRAR num estado. Devolve o motivo da recusa, ou null. */
const GUARDAS = {
  EM: (novo) => (!novo.pronto ? 'não anda sem critério de pronto: especifique antes (cc backlog especificar)' : null),
  OK: (novo, itens) => {
    const abertas = itens.filter((x) => x.pai === novo.id && aberto(x))
    return abertas.length ? `${novo.id} ainda tem ${abertas.length} micro tarefa(s) aberta(s): ${abertas.map((x) => x.id).join(', ')}` : null
  },
}

/** Pode ir de `de` para `para`? Ficar no mesmo estado vale (é só acrescentar campo). */
export function podeIr(de, para) {
  if (de === para) return true
  return Boolean(TRANSICOES[de]?.includes(para))
}

/**
 * Aplica uma mudança de estado. Devolve `{ itens, item, eventos }` ou lança com
 * o motivo. `validar` é o `problemas()` do backlog, passado de fora para este
 * arquivo não depender dele.
 */
export function transicionar(itens, id, para, extras = {}, { hoje, validar = () => [] }) {
  const i = itens.find((x) => x.id === id)
  if (!i) throw new Error(`não achei ${id}`)
  para = String(para).toUpperCase()
  if (!TRANSICOES[para]) throw new Error(`estado desconhecido: ${para}`)
  if (!podeIr(i.estado, para)) throw new Error(`${id} não pode ir de ${i.estado} para ${para}: a tabela de estados não permite (de ${i.estado} vai para ${TRANSICOES[i.estado].join(', ')})`)
  const novo = { ...i, ...extras, estado: para, mexido: hoje }
  if (para === 'OK' && !novo.fechado) novo.fechado = hoje
  const p = validar(novo)
  if (p.length) throw new Error(p.join('; '))
  if (para !== i.estado) {
    const recusa = GUARDAS[para]?.(novo, itens)
    if (recusa) throw new Error(recusa)
  }
  const saida = itens.map((x) => (x === i ? novo : x))
  const eventos = para !== i.estado ? [{ tipo: 'estado', id, de: i.estado, para }] : []
  eventos.push(...efeitos(saida, novo, i.estado, hoje))
  return { itens: saida, item: novo, eventos }
}

/**
 * Efeitos: o que acontece sozinho depois de uma mudança. Mexem em OUTROS itens
 * (o pai) e já vêm escritos como evento, para o diário contar.
 *   - a primeira micro tarefa andando põe o pai andando;
 *   - a última micro tarefa fechando põe o pai em "falta prova": quem fecha o
 *     pai é a conferência dele, não a soma das filhas.
 */
function efeitos(itens, novo, antes, hoje) {
  const ev = []
  const pai = novo.pai ? itens.find((x) => x.id === novo.pai) : null
  if (!pai || antes === novo.estado) return ev
  const trocar = (para, porque) => {
    itens[itens.indexOf(pai)] = { ...pai, estado: para, mexido: hoje }
    ev.push({ tipo: 'estado', id: pai.id, de: pai.estado, para, porque })
  }
  if (novo.estado === 'EM' && ['B0', 'B1'].includes(pai.estado)) trocar('EM', `a micro tarefa ${novo.id} começou`)
  else if (!aberto(novo) && ['B1', 'EM'].includes(pai.estado)) {
    const filhas = itens.filter((x) => x.pai === pai.id)
    if (filhas.every((x) => !aberto(x)) && filhas.some((x) => x.estado === 'OK')) trocar('PR', `as ${filhas.length} micro tarefas fecharam`)
  }
  return ev
}

/* ===================================================================
   CC-837 (Nisaba): o contrato do plano. A saída da IA é DADO, nunca
   instrução: ou cabe exatamente no formato, ou é recusada com o motivo.
   Antes o maestro garimpava o primeiro "[...]" que parecesse lista no
   meio do texto e cortava o excesso, ou seja, interpretava.
   =================================================================== */

export const TETOS_DO_PLANO = { tarefas: 8, titulo: 80, pedidoMin: 10, pedido: 600, arquivos: 8, escopo: 2500 }

/** Caminho aceitável numa micro tarefa: relativo, dentro do projeto, longe de segredo e do git. */
export function caminhoSeguro(c) {
  const s = String(c || '')
  if (!s || s.length > 200) return 'caminho vazio ou longo demais'
  if (/^([/\\]|[a-z]:)/i.test(s)) return 'caminho absoluto'
  if (s.split(/[/\\]/).includes('..')) return 'caminho sai do projeto (..)'
  if (/(^|[/\\])\.git([/\\]|$)/.test(s)) return 'mexe no .git'
  if (/(^|[/\\])\.env(\.|$)/.test(s) && !/\.env\.example$/.test(s)) return 'mexe em arquivo de segredo (.env)'
  return null
}

/**
 * Valida o texto que o planejador devolveu. Devolve `{ ok, plano, erros }`.
 * Aceita o JSON puro ou UM bloco ```json em volta, e mais nada.
 */
export function validarPlano(texto) {
  const erros = []
  const cru = String(texto || '').trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1').trim()
  let v
  try { v = JSON.parse(cru) } catch { return { ok: false, plano: null, erros: ['a resposta não é um JSON só: responda apenas o objeto, sem texto antes nem depois'] } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, plano: null, erros: ['esperava um objeto {"escopo","tarefas"}'] }
  const T = TETOS_DO_PLANO
  for (const k of Object.keys(v)) if (!['escopo', 'tarefas'].includes(k)) erros.push(`campo desconhecido no plano: ${k}`)
  if (v.escopo != null && (typeof v.escopo !== 'string' || v.escopo.length > T.escopo)) erros.push(`escopo tem de ser texto de até ${T.escopo} caracteres`)
  if (!Array.isArray(v.tarefas) || !v.tarefas.length || v.tarefas.length > T.tarefas) erros.push(`tarefas tem de ser uma lista de 1 a ${T.tarefas}`)
  const tarefas = (Array.isArray(v.tarefas) ? v.tarefas : []).map((t, k) => {
    const n = k + 1
    if (!t || typeof t !== 'object' || Array.isArray(t)) { erros.push(`tarefa ${n} não é um objeto`); return null }
    for (const c of Object.keys(t)) if (!['titulo', 'pedido', 'arquivos', 'deixa'].includes(c)) erros.push(`tarefa ${n}: campo desconhecido ${c}`)
    // CC-846: toda tarefa menos a última diz o que deixa para as próximas usarem
    const ultima = k === v.tarefas.length - 1
    if (!ultima && (typeof t.deixa !== 'string' || t.deixa.trim().length < 5 || t.deixa.length > 300)) erros.push(`tarefa ${n}: falta "deixa", o que ela cria para as próximas usarem (5 a 300 caracteres)`)
    if (typeof t.titulo !== 'string' || !t.titulo.trim() || t.titulo.length > T.titulo) erros.push(`tarefa ${n}: titulo tem de ter de 1 a ${T.titulo} caracteres`)
    if (typeof t.pedido !== 'string' || t.pedido.trim().length < T.pedidoMin || t.pedido.length > T.pedido) erros.push(`tarefa ${n}: pedido tem de ter de ${T.pedidoMin} a ${T.pedido} caracteres`)
    const arquivos = t.arquivos ?? []
    if (!Array.isArray(arquivos) || arquivos.length > T.arquivos) erros.push(`tarefa ${n}: arquivos tem de ser uma lista de até ${T.arquivos}`)
    else for (const a of arquivos) { const p = caminhoSeguro(a); if (p) erros.push(`tarefa ${n}: ${a}: ${p}`) }
    return { titulo: String(t.titulo || '').trim(), pedido: String(t.pedido || '').trim(), arquivos: Array.isArray(arquivos) ? arquivos.map(String) : [], ...(t.deixa ? { deixa: String(t.deixa).trim() } : {}) }
  })
  if (erros.length) return { ok: false, plano: null, erros }
  return { ok: true, plano: { escopo: v.escopo?.trim() || null, tarefas }, erros: [] }
}
