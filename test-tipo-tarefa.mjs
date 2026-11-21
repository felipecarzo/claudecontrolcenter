// CC-1103: o tipo de cada caixa do ROADMAP sai do que está escrito ou do verbo, e o catálogo diz modelo, esforço e ajudante
import assert from 'node:assert/strict'
import { catalogo, contar, indicadoDoTipo, lerCaixas, tipoDe } from './src/tipoTarefa.mjs'
const t = (nome, fn) => { fn(); console.log('  ok   ' + nome) }
const cat = catalogo()

const ROADMAP = `# ROADMAP

### CV-05 O chapéu
- [ ] CV-05.1: Achar fotos de referência do chapéu
- [x] **CV-05.2** Decidir a forma da aba
- [ ] Rodar a varredura de malhas no Blender
- [ ] 3. Exportar o chapéu em FBX
- [ ] Medir os triângulos do modelo
- [ ] Conferir o print do chapéu no jogo
- [ ] Mandar print para o painel
- [ ] Atualizar o ROADMAP e o painel
- [ ] Ajustar a cor [Conferir]
- [ ] Algo sem verbo conhecido, tipo: Executar
- [ ] Pensar no resto
- texto solto que não é caixa
`

t('o catálogo tem os três tipos, com modelo e esforço do pedido dele', () => {
  assert.deepEqual(Object.keys(cat.tipos), ['Decidir', 'Executar', 'Conferir'])
  assert.deepEqual([cat.tipos.Decidir.modelo, cat.tipos.Decidir.esforco], ['opus', 'high'])
  assert.deepEqual([cat.tipos.Executar.modelo, cat.tipos.Executar.esforco], ['sonnet', 'medium'])
  assert.deepEqual([cat.tipos.Conferir.modelo, cat.tipos.Conferir.esforco], ['sonnet', 'low'])
  assert.equal(cat.padrao, 'Decidir', 'na dúvida não se economiza')
})
t('o verbo do começo decide, com acento, caixa alta, número de item e negrito na frente', () => {
  assert.equal(tipoDe('Achar fotos', cat).tipo, 'Decidir')
  assert.equal(tipoDe('CV-05.1: Achar fotos', cat).tipo, 'Decidir')
  assert.equal(tipoDe('**CV-05.2** Decidir a forma', cat).tipo, 'Decidir')
  assert.equal(tipoDe('3. Exportar o chapéu', cat).tipo, 'Executar')
  assert.equal(tipoDe('RODAR a varredura', cat).tipo, 'Executar')
  assert.equal(tipoDe('Mandar print', cat).tipo, 'Conferir')
  assert.equal(tipoDe('Esboçar a aba', cat).tipo, 'Decidir', 'verbo com cedilha casa sem ela')
})
t('o que está escrito na caixa vence o verbo', () => {
  assert.deepEqual(tipoDe('Ajustar a cor [Conferir]', cat), { tipo: 'Conferir', por: 'escrito', verbo: null })
  assert.equal(tipoDe('Algo qualquer, tipo: Executar', cat).tipo, 'Executar')
})
t('verbo desconhecido cai no padrão e diz que foi por isso', () => {
  const r = tipoDe('Pensar no resto', cat)
  assert.deepEqual(r, { tipo: 'Decidir', por: 'padrão', verbo: 'pensar' })
})
t('lerCaixas lê só as caixas, marca as feitas e traz o que o tipo manda', () => {
  const c = lerCaixas(ROADMAP, cat)
  assert.equal(c.length, 11, 'o texto solto e os títulos não são caixa')
  assert.equal(c.filter((x) => x.feita).length, 1)
  assert.deepEqual(contar(c), { Decidir: 3, Executar: 4, Conferir: 4 })
  const exp = c.find((x) => /FBX/.test(x.texto))
  assert.deepEqual([exp.tipo, exp.modelo, exp.esforco, exp.ajudante], ['Executar', 'sonnet', 'medium', 'executor'])
  assert.equal(c.find((x) => /ROADMAP e o painel/.test(x.texto)).ajudante, 'conferidor')
  assert.equal(c.find((x) => /forma da aba/.test(x.texto)).ajudante, null, 'Decidir fica na sessão principal')
})
t('cada tipo do catálogo usa modelo e esforço que o modelo.mjs conhece', async () => {
  const { MODELOS, ESFORCOS } = await import('./src/modelo.mjs')
  for (const nome of Object.keys(cat.tipos)) {
    const i = indicadoDoTipo(nome, cat)
    assert.ok(MODELOS.some((m) => m.codigo === i.modelo), `${nome}: modelo ${i.modelo}`)
    assert.ok(ESFORCOS.some((e) => e.codigo === i.esforco), `${nome}: esforço ${i.esforco}`)
  }
})
console.log('test-tipo-tarefa: 6 grupos, 0 falhas')
