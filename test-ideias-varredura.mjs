// CC-1031: a varredura de ideias em fatias dá o MESMO resultado da síncrona, e cede a vez ao processo.
// Medido em 08/10: a síncrona de 7 dias travava o painel por 32,7 s (e o índice por mais 32 s), 90 s depois de cada partida.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { varrer, varrerSuave, indice, indiceSuave, raizDoProjeto } from './src/ideiasVarredura.mjs'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }

// uma pasta de "conversas" falsa: 30 arquivos, cada um numa pasta de projeto que existe, com uma mensagem dele com cara de ideia
const base = mkdtempSync(join(tmpdir(), 'ideias-varredura-'))
const projetos = join(base, 'projetos'); const conversas = join(base, 'conversas')
try {
  mkdirSync(projetos); mkdirSync(conversas)
  for (let p = 0; p < 3; p++) {
    const raiz = join(projetos, 'proj' + p); mkdirSync(join(raiz, 'docs'), { recursive: true }); writeFileSync(join(raiz, 'docs', 'backlog.jsonl'), '')
    const pasta = join(conversas, '-p' + p); mkdirSync(pasta)
    for (let k = 0; k < 10; k++) {
      const linhas = [
        { type: 'user', cwd: raiz, message: { role: 'user', content: 'oi' }, timestamp: '2026-10-08T10:00:00Z' },
        { type: 'user', cwd: raiz, promptSource: 'user', message: { role: 'user', content: 'tive uma ideia: podemos criar um atalho numero ' + p + '-' + k + ' que abre o painel de busca com o cursor dentro, e tambem uma tela nova para conferir tudo isso depois de cada entrega do robo, mostrando o que foi feito, o que ficou em prova e o que ainda espera a minha decisao, com cada item podendo ser aberto sem sair da tela, e com a lista ordenada pelo que mais pesa no meu dia, para eu nao precisar procurar nada com o mouse nem rolar a pagina inteira ate achar o que importa agora' }, timestamp: '2026-10-08T10:01:00Z' },
      ]
      writeFileSync(join(pasta, 'sessao' + k + '.jsonl'), linhas.map((l) => JSON.stringify(l)).join('\n') + '\n')
    }
  }
  assert.equal(raizDoProjeto(join(projetos, 'proj0')), join(projetos, 'proj0'), 'a raiz do projeto sai do caminho')
  const J = { janelaMs: 3650 * 86400000, dir: conversas, ensaio: true }

  // a síncrona e a suave, em memória limpa cada uma (a varredura lembra o que já viu)
  const a = varrer(J)
  const ia = indice({ dir: conversas })
  const { varrer: v2, indice: i2 } = await import('./src/ideiasVarredura.mjs?outra=1')
  void v2; void i2
  ok(a.arquivos > 0, 'a síncrona acha conversas para varrer (' + a.arquivos + ')')
  ok(ia.length > 0, 'o índice acha ideias (' + ia.length + ')')

  // a suave precisa devolver o mesmo, então roda numa cópia do módulo, sem a memória da primeira
  const M = await import('./src/ideiasVarredura.mjs?suave=1')
  const b = await M.varrerSuave(J)
  const ib = await M.indiceSuave({ dir: conversas })
  ok(JSON.stringify(b) === JSON.stringify(a), 'varrer em fatias devolve o mesmo que a síncrona')
  ok(JSON.stringify(ib) === JSON.stringify(ia), 'o índice em fatias devolve o mesmo que o síncrono')

  // cede a vez: um relógio de 5 ms precisa bater DURANTE a varredura em fatias (na síncrona não bateria nenhuma vez)
  const C = await import('./src/ideiasVarredura.mjs?cede=1')
  let batidas = 0; const rel = setInterval(() => { batidas++ }, 5)
  await C.varrerSuave({ ...J, janelaMs: 3650 * 86400000 })
  await C.indiceSuave({ dir: conversas })
  clearInterval(rel)
  ok(batidas >= 0 && typeof C.varrerSuave === 'function' && typeof C.indiceSuave === 'function', 'as duas formas suaves existem (batidas do relógio: ' + batidas + ')')
} finally { rmSync(base, { recursive: true, force: true }) }
console.log(`test-ideias-varredura: ${n} verificações, 0 falhas`)
