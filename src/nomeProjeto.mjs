/**
 * O nome de um projeto, e quando dois nomes são o mesmo projeto.
 *
 * ## Por que isto é um módulo próprio
 *
 * A conta nasceu dentro de `trabalho.mjs`, em 27/08, para o quadro. Em 29/08 o
 * armazém de séries precisou dela também, e importar `trabalho.mjs` de dentro
 * de um módulo de dados arrastaria o leitor de roadmap junto, sem necessidade.
 *
 * Vale a regra que já governa este projeto: **uma conta só**. Duas
 * implementações de "é o mesmo projeto?" discordariam no dia em que uma das
 * máquinas renomeasse de novo, e o sintoma seria dado sumindo de uma tela e
 * não da outra. `trabalho.mjs` reexporta daqui.
 */

/**
 * Renomeações de VERDADE, onde o nome mudou e não só o prefixo.
 *
 * Tirar prefixo é regra e vale para sempre. Isto aqui é o contrário: é a lista
 * curta e explícita dos casos em que a coisa passou a se chamar outra coisa, e
 * nenhuma regra geral acharia sozinha.
 *
 * ⚠️ **Só entra aqui o que foi CONFERIDO como o mesmo projeto.** Um par errado
 * aqui funde duas histórias diferentes num gráfico só, e ninguém percebe:
 * o número fica maior e continua plausível.
 */
export const RENOMEADOS = new Map([
  /* Este painel. Nasceu `proj_controlcenter`, virou `cockpit` na renomeação de
     23/08. A pasta velha ainda existe nesta VPS como ATALHO para a nova, então
     as duas grafias continuam sendo gravadas, hoje, ao mesmo tempo. */
  ['controlcenter', 'cockpit'],
])

/**
 * O nome reduzido ao que identifica o projeto: sem máquina, sem tipo, sem
 * caixa e sem acento. Serve para COMPARAR, não para mostrar.
 *
 * ⚠️ **O sufixo NÃO é rótulo e fica.** `VPS_cockpit--front` é outra pasta, em
 * outra branch, com outro roadmap: juntar as duas misturaria um backlog de
 * 16/08 com o de hoje. Só o prefixo cai.
 */
export function chaveDeProjeto(nome) {
  const cru = String(nome || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^(vps|pc)_/, '')
    .replace(/^(proj|app|web|game)_/, '')
    .trim()
  return RENOMEADOS.get(cru) || cru
}

/** O agente e o item de backlog são do mesmo projeto? */
export const mesmoProjeto = (a, b) => Boolean(chaveDeProjeto(a)) && chaveDeProjeto(a) === chaveDeProjeto(b)

/**
 * O nome para MOSTRAR: sem os prefixos, com a caixa preservada.
 *
 * `chaveDeProjeto` não serve na tela porque derruba a caixa: `renanMarchon`
 * viraria `renanmarchon`, e ele lê essas telas no telefone. São duas funções de
 * propósito — uma compara, a outra apresenta.
 */
export function nomeCanonico(nome) {
  const limpo = String(nome || '')
    .replace(/^(VPS|PC|vps|pc)_/, '')
    .replace(/^(proj|app|web|game)_/, '')
    .trim()
  /* Renomeado de verdade: mostra o nome de hoje, não o de quando foi gravado.
     Comparar em minúsculo, mostrar o que a lista diz. */
  const novo = RENOMEADOS.get(limpo.toLowerCase())
  return novo || limpo || String(nome || '')
}
