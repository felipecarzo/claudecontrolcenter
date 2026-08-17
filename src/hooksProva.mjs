/**
 * As travas estão funcionando AGORA? (CC-103)
 *
 * A lacuna que o `pre-commit run --all-files` cobre e nós não: o gate só
 * existia no gatilho. Para saber se uma trava ainda pega o que deve pegar, era
 * preciso provocá-la de propósito, uma por uma, o que ninguém faz.
 *
 * Cada guarda tem (ou deveria ter) um arquivo `testar-<id>.sh` ao lado, com os
 * casos que precisam barrar e os que precisam passar. Este módulo roda esses
 * arquivos sob demanda e responde em três categorias:
 *
 * - **provado**: o teste rodou e passou. A trava pega o que promete.
 * - **falhou**: rodou e acusou. É defeito, e o texto do teste diz onde.
 * - **sem prova**: o guarda existe e não tem teste. Não é "quebrado", é
 *   desconhecido, e a diferença importa: dizer "tudo certo" sobre o que nunca
 *   foi medido é o erro que este projeto inteiro tenta evitar.
 *
 * Roda em série de propósito: são processos que sobem Node e Chrome não entra
 * aqui. Em paralelo, dez shells competindo pela mesma casa de teste dariam
 * falha intermitente, que é pior que lentidão.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { HOOKS } from './hooksCatalogo.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
export const pastaHooks = () => path.resolve(AQUI, '..', 'hooks')

/** Onde está o teste de um guarda, se existe. Procura na pasta dos hooks e na
 *  do Routia, que fica separada porque aqueles seis viajam juntos. */
export function testeDe(id) {
  for (const sub of ['', 'routia']) {
    const p = path.join(pastaHooks(), sub, `testar-${id}.sh`)
    if (fs.existsSync(p)) return p
  }
  return null
}

/** O retrato sem rodar nada: quem tem prova e quem não tem. Serve para a tela
 *  abrir instantânea, e só rodar quando ele pedir. */
export function situacao() {
  return HOOKS.filter((h) => h.implementado).map((h) => ({
    id: h.id,
    label: h.label,
    nivel: h.nivel,
    modulo: h.modulo,
    teste: testeDe(h.id) ? path.basename(testeDe(h.id)) : null,
  }))
}

const TEMPO_MAX = 90_000

/** Roda um teste. Nunca lança: falha de execução é resultado, não exceção. */
export function rodarUm(id) {
  const arquivo = testeDe(id)
  if (!arquivo) return Promise.resolve({ id, estado: 'sem prova' })
  return new Promise((ok) => {
    const t0 = Date.now()
    execFile('bash', [arquivo], { timeout: TEMPO_MAX, cwd: path.resolve(pastaHooks(), '..') },
      (erro, saida, erroSaida) => {
        const texto = `${saida || ''}${erroSaida || ''}`
        /* O corpo dos testes imprime "FALHOU <caso>" e sai com código 1. Os dois
           sinais são conferidos: teste que esquece de propagar o código sairia
           como aprovado, e foi assim que um caso quebrado passou batido no
           `testar-rota-guard.sh` em 17/08. */
        const acusou = /\bFALHOU\b/.test(texto)
        const estado = erro || acusou ? 'falhou' : 'provado'
        const casos = (texto.match(/^\s*ok\s/gm) || []).length
        ok({
          id,
          estado,
          casos,
          ms: Date.now() - t0,
          detalhe: estado === 'falhou'
            ? (texto.split('\n').filter((l) => /FALHOU/.test(l)).slice(0, 4).join('\n')
               || (erro?.killed ? 'passou do tempo' : erro?.message || 'saiu com erro'))
            : null,
        })
      })
  })
}

/** Roda tudo (ou os ids pedidos) em série, e resume. */
export async function rodar(ids = null, { aoTerminar = null } = {}) {
  const alvos = (ids?.length ? ids : situacao().map((s) => s.id))
  const resultados = []
  for (const id of alvos) {
    const r = await rodarUm(id)
    resultados.push(r)
    if (aoTerminar) aoTerminar(r)
  }
  const conta = (e) => resultados.filter((r) => r.estado === e).length
  return {
    resultados,
    resumo: {
      provado: conta('provado'),
      falhou: conta('falhou'),
      semProva: conta('sem prova'),
      total: resultados.length,
    },
  }
}
