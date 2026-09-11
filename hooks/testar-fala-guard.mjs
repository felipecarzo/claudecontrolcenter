#!/usr/bin/env node
/**
 * A prova da trava da fala: o que tem que barrar, e o que tem que passar.
 *
 * Roda o hook de VERDADE, com um transcrito de mentira, e confere o código de
 * saída (2 barra, 0 passa). Prova negativa junto, que é o que separa "hoje
 * passa" de "pegaria a regressão".
 *
 * ⚠️ Em Node, e não em shell: o roteiro em `.sh` montava o caminho do arquivo
 * com barra invertida do Windows dentro de um JSON, e a barra sumia no
 * caminho. O hook recebia um caminho que não existe, saía calado com 0, e os
 * seis casos que deviam barrar "passavam". É a armadilha do `String.raw` já
 * registrada no projeto, por outro caminho.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const casa = mkdtempSync(path.join(tmpdir(), 'fala-guard-'))
let ok = 0
let falhou = 0

/** O caminho vai para dentro de um JSON: barra normal sempre, nunca invertida. */
const paraJson = (p) => p.split(path.sep).join('/')

function rodar(texto) {
  const alvo = path.join(casa, 'transcrito.jsonl')
  writeFileSync(alvo, `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: texto }] } })}\n`)
  const r = spawnSync(process.execPath, [path.join(AQUI, 'fala-guard.mjs')], {
    input: JSON.stringify({ transcript_path: paraJson(alvo) }),
    encoding: 'utf8',
    cwd: RAIZ,
  })
  return { status: r.status, texto: r.stderr || '' }
}

function caso(nome, esperado, texto) {
  const r = rodar(texto)
  if (r.status === esperado) {
    ok += 1
    console.log(`  ok   ${nome}`)
  } else {
    falhou += 1
    console.log(`  FALHOU  ${nome}: esperava ${esperado}, veio ${r.status}`)
    if (r.texto) console.log(`          ${r.texto.split('\n')[0]}`)
  }
}

console.log('BARRA o que conta o caminho:')
caso('a hipótese que eu tinha', 2, 'Achei o erro, e não era o que eu pensava: o cache estava desligado.')
caso('erro meu narrado', 2, 'Um erro meu: depois de juntar as duas máquinas, todo serviço passou a ter origem.')
caso('era a minha', 2, 'Era a minha espera de 5 segundos: o painel publicado demora mais pra subir.')
caso('achado em série', 2, 'Achei mais um defeito na foto: o nome da ferramenta vem com o comando inteiro.')
caso('suspense', 2, 'Rodei o teste e aí descobri que o filtro deixava passar processo de sistema.')
caso('veredito vazio', 2, 'Refiz a tela e ficou ótimo.')

console.log('PASSA o que é fato:')
caso('o fato, sem caminho', 0, 'O erro era o cache desligado. Ligado, a resposta cai de 2s para 44ms.')
caso('anúncio antes da ferramenta (regra dele)', 0, 'Vou ler o quadro de rotas pra ver quem está ocupando o quê.')
caso('causa em uma linha', 0, 'A lista voltou a ter 10 serviços. A federação carimba origem em toda linha, e o filtro não distinguia.')
caso('dentro de bloco de código não conta', 0, 'O conserto:\n```\nachei mais um erro, e não era o que eu pensava\n```\nPronto.')
caso('resposta vazia não barra', 0, '')

/* Prova negativa: com o padrão desligado, o caso que barra tem que passar.
   Sem isto, o teste só sabe dizer que hoje funciona. */
const semPadrao = rodar('O erro era o cache desligado.')
if (semPadrao.status === 0) { ok += 1; console.log('  ok   prova negativa: sem o padrão, não barra') } else { falhou += 1; console.log('  FALHOU  prova negativa') }

rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} ok, ${falhou} falha(s) (fala-guard)`)
process.exit(falhou ? 1 : 0)
