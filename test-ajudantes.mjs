// CC-1102: os ajudantes padrão (agents/*.md) declaram o modelo e o esforço do tipo de tarefa deles no catálogo
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { catalogo } from './src/tipoTarefa.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const cat = catalogo()

const cabecalho = (arq) => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(arq, 'utf8'))
  assert.ok(m, `${arq}: sem cabeçalho`)
  return Object.fromEntries(m[1].split('\n').map((l) => l.split(/:\s*(.*)/).slice(0, 2)))
}
const ajudantes = fs.readdirSync('agents').filter((f) => f.endsWith('.md'))

t('há o executor genérico, o conferidor e as especializações de Blender e Unity', () => {
  assert.deepEqual(ajudantes.sort(), ['conferidor.md', 'executor-blender.md', 'executor-unity.md', 'executor.md'])
})
t('cada um declara nome igual ao arquivo, descrição, modelo e esforço', () => {
  for (const a of ajudantes) {
    const h = cabecalho('agents/' + a)
    assert.equal(h.name, a.replace('.md', ''), `${a}: nome`)
    assert.ok(h.description && h.description.length > 40, `${a}: descrição`)
    assert.ok(h.model && h.effort, `${a}: modelo e esforço no cabeçalho`)
  }
})
t('o modelo e o esforço batem com o tipo no catálogo (executor-* é Executar, conferidor é Conferir)', () => {
  for (const a of ajudantes) {
    const tipo = a.startsWith('executor') ? cat.tipos.Executar : cat.tipos.Conferir
    const h = cabecalho('agents/' + a)
    assert.equal(h.model, tipo.modelo, `${a}: modelo`)
    assert.equal(h.effort, tipo.esforco, `${a}: esforço`)
    assert.ok(tipo.ajudante && a.startsWith(tipo.ajudante), `${a}: o catálogo chama o ajudante de "${tipo.ajudante}"`)
  }
})
t('o conferidor não edita arquivo (só lê e roda), e nenhum ajudante tem a ferramenta de pergunta ou de agente', () => {
  assert.ok(!/Edit|Write/.test(cabecalho('agents/conferidor.md').tools))
  for (const a of ajudantes) assert.ok(!/Agent|AskUserQuestion/.test(cabecalho('agents/' + a).tools), `${a}: não delega nem pergunta`)
})

// CC-1104: genérico, por skill, instalável no PC
const A = await import('./src/ajudantes.mjs')
const S = await import('./src/skills.mjs')
t('o gerador tira modelo, esforço e ferramentas do catálogo, e recusa Decidir e nome fora do prefixo', () => {
  const txt = A.corpoDoAjudante({ nome: 'executor-teste', tipo: 'Executar', faz: 'teste' })
  assert.ok(txt.includes(`model: ${cat.tipos.Executar.modelo}\neffort: ${cat.tipos.Executar.esforco}\ntools: ${cat.tipos.Executar.ferramentas}`))
  assert.ok(A.corpoDoAjudante({ nome: 'conferidor-x', tipo: 'Conferir' }).includes('tools: Read, Glob, Grep, Bash'))
  assert.throws(() => A.corpoDoAjudante({ nome: 'executor', tipo: 'Decidir' }), /não tem ajudante/)
  assert.throws(() => A.corpoDoAjudante({ nome: 'blender', tipo: 'Executar' }), /começa por "executor"/)
})
t('o executor genérico do repositório é exatamente o que o gerador escreve', () => {
  assert.equal(fs.readFileSync('agents/executor.md', 'utf8'), A.corpoDoAjudante({ nome: 'executor', tipo: 'Executar' }))
})
t('instalar copia os ajudantes para a pasta de destino, e a segunda vez não mexe em nada', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ajud-'))
  const um = S.instalarAgentesDoRepositorio({ destino: d }).feitos
  assert.equal(um.filter((f) => f.acao === 'criado').length, ajudantes.length)
  assert.deepEqual(S.instalarAgentesDoRepositorio({ destino: d }).feitos, [])
  fs.rmSync(d, { recursive: true, force: true })
})
t('qual: o verbo escolhe o tipo, e os que servem são o genérico mais as especializações', () => {
  const lista = [{ nome: 'executor' }, { nome: 'executor-blender' }, { nome: 'conferidor' }]
  assert.deepEqual(A.qual('rodar o render da cena', { lista }).servem.map((a) => a.nome), ['executor', 'executor-blender'])
  assert.deepEqual(A.qual('conferir o teste', { lista }).servem.map((a) => a.nome), ['conferidor'])
  assert.equal(A.qual('decidir a forma do barco', { lista }).ajudante, null)
})
t('a skill ajudantes existe no repositório (vai para os três agentes) e as pastas do repositório são achadas', () => {
  assert.match(fs.readFileSync('skills/ajudantes/SKILL.md', 'utf8'), /^---\nname: ajudantes\ndescription: "/)
  /* No Windows, `new URL(...).pathname` dava `/D:/...` e a pasta nunca era achada. */
  assert.ok(fs.existsSync(S.dirDoRepositorio()) && fs.existsSync(S.agentesDoRepositorio()))
  assert.ok(!/new URL\(import\.meta\.url\)\.pathname/.test(fs.readFileSync('src/skills.mjs', 'utf8')))
})
t('o lançador do Windows marca o painel real, e o painel instala ajudantes com essa marca', () => {
  assert.ok(fs.readFileSync('src/arrancar.ps1', 'utf8').includes("$env:CC_PAINEL_REAL = '1'"))
  const w = fs.readFileSync('src/web.mjs', 'utf8')
  assert.ok(w.includes("CC_PAINEL_REAL === '1'") && w.includes('instalarAgentesDoRepositorio()'))
})
console.log('test-ajudantes: 10 grupos, 0 falhas')
