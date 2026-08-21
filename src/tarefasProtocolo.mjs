/**
 * CC-232: a conta do protocolo de tarefas, fora do hook para o gate alcançar.
 *
 * O hook (`hooks/tarefas-fim.mjs`) lê disco, decide e escreve na tela. Nada
 * disso é testável sem montar uma máquina inteira de mentira. O que decide de
 * verdade — quais pendências existem e quais ainda não estão na lista dele —
 * são funções puras, e moram aqui.
 *
 * A lição que motivou a separação é do próprio projeto: em 21/08 o primeiro
 * rascunho do hook passou calado no caso real, e só o teste manual pegou.
 * Lógica que o gate não enxerga é lógica que volta a quebrar.
 */

/**
 * A chave de comparação: sem acento, sem caixa, sem espaço dobrado.
 *
 * É a mesma regra do `cc done`, e pelo mesmo motivo: o agente escreve o
 * bloqueio numa sessão e a tarefa noutra, muitas vezes ditadas por voz. "Conferir
 * os apontamentos" e "conferir os apontamentos" são a mesma coisa, e criar item
 * novo por causa de um acento faria a lista dele encher de duplicata — que é
 * como uma lista deixa de ser lida.
 */
export const chaveDe = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

/**
 * O que aquela sessão declarou que depende DELE.
 *
 * Duas fontes, porque o protocolo sempre aceitou as duas: o `blockers` do
 * cartão (o jeito usado em 20/08, e o que se perdeu) e o to-do marcado com
 * `dono: 'felipe'`.
 *
 * `meuId` é obrigatório de propósito. Sem ele a conta pegaria bloqueio de
 * OUTRO agente, e o hook mandaria alguém registrar o que não é seu.
 */
export function pendenciasDe(jobs = [], meuId = null) {
  if (!meuId) return []
  const alvo = String(meuId).slice(0, 8)
  const saida = []
  for (const j of jobs) {
    if (j?.id !== alvo) continue
    for (const b of j.blockers || []) {
      const texto = typeof b === 'string' ? b : (b?.text || b?.t || '')
      if (String(texto).trim()) saida.push(String(texto).trim())
    }
    for (const t of j.todos || []) {
      /* `done` fecha o assunto: tarefa dele que já foi resolvida não volta a
         ser cobrada, senão o aviso vira ruído e o ruído se ignora. */
      if (t?.dono === 'felipe' && !t.done && t.text) saida.push(String(t.text).trim())
    }
  }
  return [...new Set(saida)]
}

/**
 * Das pendências, as que ainda NÃO estão na lista dele.
 *
 * Só compara com o que veio da lista (`fonte: 'lista'`): as outras fontes são
 * derivadas do próprio cartão e do roadmap, então casar com elas faria o hook
 * concluir "já está registrado" olhando para o próprio reflexo — e a pendência
 * morreria junto com o job, que é exatamente o defeito de 20/08.
 */
export function faltandoNaLista(pendencias = [], tarefas = []) {
  const jaTem = new Set(
    tarefas
      .filter((t) => !t.feito && (t.fonte === 'lista' || t.fonte === undefined))
      .map((t) => chaveDe(t.texto)),
  )
  return pendencias.filter((p) => !jaTem.has(chaveDe(p)))
}
