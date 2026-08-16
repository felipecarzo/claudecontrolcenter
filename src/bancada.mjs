/**
 * O runner da Bancada, e a ponte dela com o framework (F5).
 *
 * Roda as camadas escolhidas num projeto e grava o resultado no
 * `.framework/estado.json`. É isso que faz o gate de Verificação do método
 * `entrega-cliente` funcionar: os predicados `verificacao-rodada` e
 * `verificacao-limpa` já existiam esperando alguém preencher esse campo.
 *
 * ## Serial, e sem fila
 *
 * Uma camada por vez, um projeto por vez. Sem paralelismo: se duas camadas ao
 * mesmo tempo virar necessidade medida, aí sim. Complexidade de fila sem
 * demanda é o tipo de coisa que se paga em bug e não em valor.
 *
 * ## O que ele NÃO faz, de propósito
 *
 * Não conserta nada. Mostra o achado e o comando de conserto; aplicar é decisão
 * de quem lê, igual à aba de rotinas. E não instala ferramenta: camada cuja
 * ferramenta não existe aparece como indisponível, com o motivo.
 */
import {
  camadaDe, camadasDe, todasAsCamadas,
  NIVEIS, NIVEL_PADRAO, camadasDoNivel, avaliarNivel, nivelDaCamada,
} from './bancadaCatalogo.mjs'
import { registrarVerificacao } from './framework.mjs'
import { gravar as gravarEstado, ler as lerEstado } from './frameworkDisco.mjs'

/** O catálogo aplicável a um projeto, com o que já foi rodado. Serve à tela. */
export function situacao(raiz, cfg = {}) {
  const estado = lerEstado(raiz)
  const escolhidas = estado?.ferramentas || []
  const resultados = estado?.verificacao || {}

  return {
    // todas, não só as que cabem: camada que some da lista é indistinguível de
    // camada que não existe, e a decisão dele foi ter o catálogo inteiro à vista
    camadas: todasAsCamadas(raiz, cfg).map((c) => ({
      id: c.id,
      nome: c.nome,
      grupo: c.grupo,
      custo: c.custo,
      duracao: c.duracao,
      explica: c.explica,
      implementada: c.implementada,
      cabe: c.cabe,
      porQueNao: c.porQueNao,
      // em que nível de exigência esta camada entra; `null` = fora da escala,
      // como as de IA, que dependem do projeto ter modelo e não do rigor
      nivel: nivelDaCamada(c.id),
      escolhida: escolhidas.includes(c.id),
      resultado: resultados[c.id] || null,
    })),
    escolhidas,
  }
}

/**
 * Roda uma camada e registra o resultado no estado do framework.
 *
 * O resultado é DADO, não julgamento: a camada diz se passou, o framework só
 * confere se rodou e se passou. Isso mantém o gate mecânico, que é a regra que
 * impede a IA de se auto-aprovar.
 */
export async function rodar(raiz, id, cfg = {}) {
  const camada = camadaDe(id)
  if (!camada) return { ok: false, erro: `camada desconhecida: ${id}` }

  const inicio = Date.now()
  let r
  try {
    r = await camada.rodar(raiz, cfg)
  } catch (e) {
    // Camada que explode é falha DELA, não do projeto: reportar como erro em vez
    // de dizer que o projeto está sujo seria acusar o inocente.
    return { ok: false, erro: `a camada ${id} falhou: ${String(e?.message || e)}` }
  }

  const resultado = {
    ok: Boolean(r.ok),
    achados: r.achados || [],
    nota: r.nota || null,
    /* "não achei nada" e "não consegui olhar" são resultados DIFERENTES, e
       confundir os dois é o pior defeito de uma ferramenta de verificação.
       Achado rodando a camada `pacote-malicioso` contra o `mnzs`: o npm falhava
       por falta de `node_modules` e ela respondia limpo.

       Camada antiga não declara o campo e é `true` por padrão — todas de fato
       verificam quando `aplicaA` deixa passar. Quem não consegue olhar precisa
       dizer, e a partir daí a verificação NÃO conta como aprovada no framework. */
    verificou: r.verificou !== false,
    duracaoMs: Date.now() - inicio,
  }

  const estado = lerEstado(raiz)
  if (estado) {
    const x = registrarVerificacao(estado, id, {
      // camada que não conseguiu olhar não vale como verificação aprovada
      ok: resultado.ok && resultado.verificou,
      achados: resultado.achados.length,
      verificou: resultado.verificou,
      // CC-71: dizer QUE recorte foi olhado. Verificação incremental que se
      // registra como completa e o pior dos dois mundos — rápida e mentirosa.
      escopo: cfg.soMudou ? 'mudou' : 'tudo',
      detalhe: resultado.achados.length
        ? `${resultado.achados.length} achado(s): ${resultado.achados[0].titulo}`
        : (resultado.nota || null),
      quando: new Date().toISOString(),
    })
    if (x.ok) gravarEstado(raiz, x.estado)
  }

  return { ok: true, camada: id, ...resultado }
}

/** Roda todas as camadas escolhidas na Definição, em série. */
/**
 * Roda o nível inteiro, pulando o que não cabe no projeto.
 *
 * O nível é a resposta à pergunta dele sobre "níveis diferentes de engenharia de
 * cibersegurança": em vez de escolher dezenove caixinhas, escolhe-se **quem
 * alcança o projeto** — e a lista de camadas sai disso.
 *
 * Camada declarada e sem execução é PULADA, não falha: dívida nossa não pode
 * travar o projeto dele. Ela volta no veredito como `semExecucao`, que é
 * informação, não reprovação.
 */
export async function rodarNivel(raiz, nivel = NIVEL_PADRAO, cfg = {}) {
  if (!NIVEIS[nivel]) return { ok: false, erro: `nível desconhecido: ${nivel}` }

  const porId = Object.fromEntries(situacao(raiz, cfg).camadas.map((c) => [c.id, c]))

  const resultados = []
  for (const id of camadasDoNivel(nivel)) {
    const c = porId[id]
    if (!c?.implementada || !c.cabe) continue
    resultados.push(await rodar(raiz, id, cfg))
  }

  // relê a situação: o `rodar` gravou cada resultado no estado do framework
  const veredito = avaliarNivel(nivel, situacao(raiz, cfg).camadas)
  return { ok: true, nivel, veredito, resultados }
}

export async function rodarEscolhidas(raiz, cfg = {}) {
  const estado = lerEstado(raiz)
  const ids = estado?.ferramentas || []
  if (!ids.length) return { ok: false, erro: 'nenhuma ferramenta escolhida para este projeto' }

  const resultados = []
  for (const id of ids) resultados.push(await rodar(raiz, id, cfg))
  return {
    ok: resultados.every((r) => r.ok && r.ok !== false),
    // quantas realmente olharam, para a tela não somar cinza com verde
    verificaram: resultados.filter((r) => r.verificou !== false).length,
    limpo: resultados.every((r) => r.ok && r.achados?.length === 0),
    resultados,
  }
}
