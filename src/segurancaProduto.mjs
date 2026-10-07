/**
 * CC-922: os requisitos de segurança do mapa do produto, com o estado vindo da última varredura.
 *
 * A varredura (tools/varredura-seguranca/varredura.mjs) NUNCA roda aqui dentro: quem a roda é o comando
 * `node cc.mjs seguranca requisitos`, e o resultado entra por `conferirSeguranca`. O resto do tempo este módulo só
 * lê o que a última varredura deixou em `docs/produto.json` (`varreduraSeguranca`), então não há temporizador nem rede.
 *
 * O portão do pronto (`seguranca-testavel-limpa`, em framework.mjs, que não lê disco) lê a cópia do veredito que
 * `conferirSeguranca` grava em `estado.produto.seguranca`: `{ quando, barra: [frases] }`.
 */
import { NOME_DO_TIPO, requisitosDosTipos, tiposDaParte } from './catalogoSeguranca.mjs'
import * as D from './frameworkDisco.mjs'
import { gravar, ler } from './produto.mjs'

const ORDEM = ['não cumpre', 'suspeito', 'não medido', 'cumpre', 'não se aplica'] // do pior para o melhor

/** O resultado da varredura em um mapa `{ idAsvs: { resultado, provas } }`, ficando com o pior quando o id repete. */
export function resumirVarredura(varredura, quando = new Date().toISOString()) {
  const itens = {}
  for (const i of varredura?.itens || []) {
    const atual = itens[i.asvs]
    if (atual && ORDEM.indexOf(atual.resultado) <= ORDEM.indexOf(i.resultado)) continue
    itens[i.asvs] = { resultado: i.resultado, provas: (i.provas || []).slice(0, 4) }
  }
  return { varridoEm: quando, itens }
}

/** Uma parte do mapa vira `{ parte, tipos, requisitos: [{ id, frase, testavel, estado, provas, barra }] }`. */
export function requisitosDoProduto(raiz, { varredura = null } = {}) {
  const produto = ler(raiz)
  if (!produto) return []
  const fonte = varredura ? resumirVarredura(varredura) : produto.varreduraSeguranca || null
  return (produto.partes || []).map((parte) => {
    const tipos = tiposDaParte(parte, produto)
    const requisitos = requisitosDosTipos(tipos).map((q) => {
      const testavel = !!q.checagem
      const achado = testavel ? fonte?.itens?.[q.checagem] : null
      const estado = !testavel ? 'só olhando' : achado ? achado.resultado : 'não medido'
      return { id: q.id, tipo: q.tipo, frase: q.frase, testavel, estado, provas: achado?.provas || [], barra: testavel && estado === 'não cumpre' }
    })
    return { parte: { codigo: parte.codigo, nome: parte.nome }, tipos, requisitos, varridoEm: fonte?.varridoEm || null }
  })
}

/** O que barra o pronto: cada requisito testável que "não cumpre", com a parte e a prova (arquivo:linha). */
export function barraDoProduto(lista) {
  const barra = []
  for (const p of lista) {
    for (const q of p.requisitos) if (q.barra) barra.push(`${p.parte.nome}: ${q.id} ${q.frase} Prova: ${q.provas[0] || 'sem prova registrada'}`)
  }
  return barra
}

/**
 * Registra uma varredura (o resultado de `varrerProjeto`) no projeto: a prova detalhada vai para docs/produto.json e o
 * veredito para o estado do framework, onde o portão lê. Devolve `{ lista, barra }`.
 */
export function conferirSeguranca(raiz, varredura, quando = new Date().toISOString()) {
  const produto = ler(raiz)
  if (!produto) throw new Error('docs/produto.json não existe: o mapa do produto ainda não foi começado')
  gravar(raiz, { ...produto, varreduraSeguranca: resumirVarredura(varredura, quando) })
  const lista = requisitosDoProduto(raiz)
  const barra = barraDoProduto(lista)
  const est = D.ler(raiz, { sessao: null })
  if (est) D.gravar(raiz, { ...est, produto: { ...(est.produto || {}), seguranca: { quando, barra } } })
  return { lista, barra }
}

/** O texto do comando, em português, por parte. */
export function textoDosRequisitos(lista, { projeto = '', varreu = true } = {}) {
  const o = ['', `  Requisitos de segurança${projeto ? ` de ${projeto}` : ''} (OWASP ASVS nível 1)`]
  if (!lista.length) return [...o, '', '  Não há mapa do produto neste projeto (docs/produto.json).', ''].join('\n')
  const quando = lista.find((p) => p.varridoEm)?.varridoEm
  o.push(quando ? `  Última varredura: ${quando.slice(0, 16).replace('T', ' ')}` : '  Nenhuma varredura registrada: o que dá para testar aparece como "não medido".')
  if (!varreu) o.push('  (leitura da última varredura, sem rodar de novo)')
  let barram = 0, suspeitos = 0
  for (const p of lista) {
    o.push('', `  ${p.parte.nome}${p.tipos.length ? ` (${p.tipos.map((t) => NOME_DO_TIPO[t]).join(', ')})` : ''}`)
    if (!p.requisitos.length) o.push('    nenhum requisito de segurança para esta parte')
    for (const q of p.requisitos) {
      const marca = q.barra ? 'NÃO CUMPRE, BARRA O PRONTO' : q.estado
      if (q.barra) barram++
      if (q.estado === 'suspeito') suspeitos++
      o.push(`    [${marca}] ${q.id} ${q.frase}`)
      if (q.testavel && ['não cumpre', 'suspeito'].includes(q.estado)) for (const pr of q.provas) o.push(`        prova: ${pr}`)
    }
  }
  o.push('', barram ? `  Barra o pronto: ${barram} requisito(s) que dá para testar e não cumprem.` : '  Nada barra o pronto.')
  if (suspeitos) o.push(`  Suspeitos: ${suspeitos} (não barram, mas pedem conferência).`)
  o.push('')
  return o.join('\n')
}
