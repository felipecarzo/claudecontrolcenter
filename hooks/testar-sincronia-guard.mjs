#!/usr/bin/env node
/**
 * CC-161: prova do `sincronia-guard` contra repositório git DE VERDADE.
 *
 * `.mjs` e não `.sh` como os outros testes de hook, e o motivo é medido: o
 * caminho de repositório no Windows tem barra invertida, e montar o JSON de
 * entrada dentro do shell transforma `\U` e `\5` em escape inválido. O JSON
 * chega quebrado, o hook cai no `catch` e sai calado — e o teste registra um
 * falso "passou" enquanto o hook nunca chegou a rodar. Foi exatamente o que
 * aconteceu na primeira tentativa de provar isto.
 *
 * Repositório real, nunca simulado: o que se está provando é a leitura do
 * `git status` e da contagem contra o upstream, e as duas só existem de
 * verdade num repositório de verdade.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const HOOK = join(AQUI, 'sincronia-guard.mjs')

let passaram = 0
const falhas = []

const ok = (nome, condicao, detalhe = '') => {
  if (condicao) { passaram++; console.log(`  ok   ${nome}`) } else {
    falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ''}`)
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

/** Roda o hook com o cwd dado. O JSON vai por stdin já serializado por
 *  `JSON.stringify`, nunca montado à mão: é isso que evita a armadilha da
 *  barra invertida descrita no cabeçalho. */
function rodar(cwd) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ cwd, stop_hook_active: false }),
    encoding: 'utf8',
    timeout: 20000,
  })
  return { saida: `${r.stderr || ''}${r.stdout || ''}`, status: r.status }
}

const git = (raiz, ...args) => execFileSync('git', ['-C', raiz, ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
})

const base = mkdtempSync(join(tmpdir(), 'cc-sinc-'))
try {
  /* --- um repositório limpo, sem upstream --- */
  const limpo = join(base, 'limpo')
  execFileSync('git', ['init', '-q', limpo], { stdio: 'ignore' })
  git(limpo, 'config', 'user.email', 'teste@teste')
  git(limpo, 'config', 'user.name', 'teste')
  writeFileSync(join(limpo, 'a.txt'), 'conteudo\n')
  git(limpo, 'add', 'a.txt')
  git(limpo, 'commit', '-qm', 'inicial')

  const rLimpo = rodar(limpo)
  ok('repositório limpo e sem upstream fica calado', rLimpo.saida.trim() === '',
    `disse: ${rLimpo.saida.slice(0, 120)}`)
  ok('e sai com zero, porque avisar nunca trava', rLimpo.status === 0)

  /* --- o mesmo repositório, agora com trabalho não commitado --- */
  appendFileSync(join(limpo, 'a.txt'), 'mudanca sem commit\n')
  const rSujo = rodar(limpo)
  ok('árvore suja é anunciada', /sem commit nesta máquina/.test(rSujo.saida),
    `disse: ${rSujo.saida.slice(0, 120)}`)
  ok('e o arquivo mexido aparece pelo nome', /a\.txt/.test(rSujo.saida))
  ok('avisar continua não travando', rSujo.status === 0)

  /* --- commit feito aqui que o remoto ainda não tem ---
     Um clone dá upstream de verdade, que é o que a contagem lê. Sem isso, a
     única forma de testar seria simular a saída do git, e aí o teste provaria
     o simulador. */
  const clone = join(base, 'clone')
  execFileSync('git', ['clone', '-q', limpo, clone], { stdio: 'ignore' })
  git(clone, 'config', 'user.email', 'teste@teste')
  git(clone, 'config', 'user.name', 'teste')

  const rClone = rodar(clone)
  ok('clone recém-feito, igual ao remoto, fica calado', rClone.saida.trim() === '',
    `disse: ${rClone.saida.slice(0, 120)}`)

  writeFileSync(join(clone, 'b.txt'), 'novo\n')
  git(clone, 'add', 'b.txt')
  git(clone, 'commit', '-qm', 'trabalho local')

  const rNaoEmpurrado = rodar(clone)
  ok('commit local que o remoto não tem é anunciado',
    /não empurrados/.test(rNaoEmpurrado.saida),
    `disse: ${rNaoEmpurrado.saida.slice(0, 160)}`)

  /* --- fora de repositório nenhum --- */
  const rForaDeRepo = rodar(base)
  ok('fora de repositório fica calado', rForaDeRepo.saida.trim() === '',
    `disse: ${rForaDeRepo.saida.slice(0, 120)}`)

  /* --- a guarda contra laço --- */
  const rLaco = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ cwd: limpo, stop_hook_active: true }),
    encoding: 'utf8',
    timeout: 20000,
  })
  ok('com stop_hook_active não fala de novo, para não virar laço',
    `${rLaco.stderr || ''}`.trim() === '')
} finally {
  rmSync(base, { recursive: true, force: true })
}

console.log(`\n${passaram} caso(s) passaram`)
if (falhas.length) {
  console.error(`\n${falhas.length} FALHA(S):\n${falhas.map((f) => `  · ${f}`).join('\n')}`)
  process.exit(1)
}
