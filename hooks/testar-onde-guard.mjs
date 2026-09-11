#!/usr/bin/env node
/**
 * A prova do guarda do ONDE: barra o anúncio de comportamento novo sem o
 * lugar, e deixa passar o que diz onde ficou.
 *
 * Roda o gancho de verdade contra um transcrito de mentira, e confere o código
 * de saída (2 barra, 0 passa). Com prova negativa: a mesma frase, com o lugar
 * dito, tem que passar.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const casa = mkdtempSync(path.join(tmpdir(), 'onde-guard-'))
let ok = 0
let falhou = 0

const paraJson = (p) => p.split(path.sep).join('/')

function rodar(texto) {
  const alvo = path.join(casa, 'transcrito.jsonl')
  writeFileSync(alvo, `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: texto }] } })}\n`)
  const r = spawnSync(process.execPath, [path.join(AQUI, 'onde-guard.mjs')], {
    input: JSON.stringify({ transcript_path: paraJson(alvo) }),
    encoding: 'utf8',
    cwd: RAIZ,
  })
  return r.status
}

function caso(nome, esperado, texto) {
  const s = rodar(texto)
  if (s === esperado) { ok += 1; console.log(`  ok   ${nome}`) } else { falhou += 1; console.log(`  FALHOU  ${nome}: esperava ${esperado}, veio ${s}`) }
}

console.log('BARRA o anúncio sem o lugar:')
caso('a partir de agora', 2, 'A partir de agora eu corrijo e sigo, sem te contar que fui barrado.')
caso('agora eu não faço mais', 2, 'Agora eu não vou mais repetir a explicação.')
caso('salvei, sem dizer onde', 2, 'Salvei isso e fica valendo.')
caso('virou regra', 2, 'Combinado e salvo: isso vira regra daqui pra frente.')

console.log('PASSA quando diz onde ficou:')
caso('diz o arquivo de ganchos', 0, 'A partir de agora eu corrijo e sigo. Ficou no arquivo de ganchos (settings.json), então vale em toda sessão desta máquina.')
caso('diz o arquivo global', 0, 'Agora eu digo sempre o lugar. Escrevi no CLAUDE.md global.')
caso('diz a memória do projeto', 0, 'Salvei na memória do projeto: vale só nas sessões desta pasta.')
caso('diz que é só a conversa', 0, 'Anotei, mas só nesta conversa, e some ao fechar.')
caso('diz o alcance direto', 0, 'Passa a valer em todas as sessões desta máquina.')

console.log('NÃO dispara em resposta comum:')
caso('resposta de fato', 0, 'O erro era o cache desligado. A resposta caiu de 2s para 44ms.')
caso('resposta que só mede', 0, 'Medido nos 543 itens: 524 fecharam no mesmo dia em que nasceram.')
caso('resposta vazia', 0, '')

rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} ok, ${falhou} falha(s) (onde-guard)`)
process.exit(falhou ? 1 : 0)
