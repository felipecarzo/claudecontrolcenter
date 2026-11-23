// CC-1130: o guarda de memória só AVISA. Funções puras e dados falsos, nada de processo de verdade.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc1130-'))
process.env.CC_HOME = casa // o registro vai para a pasta temporária, nunca para a de verdade
delete process.env.CC_MEMORIA_PISO_GB
const G = await import('./src/guardaMemoria.mjs')

const GB = 2 ** 30
const MIN = 60_000
let ok = 0
const t = async (nome, fn) => { await fn(); ok += 1; console.log(`  ok   ${nome}`) }
const T0 = Date.parse('2026-11-23T14:00:00Z')

// processos falsos: 56 do Chrome (5 GB do medialab), 22 do Claude, 1 ffmpeg
const chrome = (i, ram, cmd) => ({ pid: 100 + i, nome: 'chrome', ramB: ram, comprometidaB: ram * 2, cmd })
const falsos = () => [
  ...Array.from({ length: 5 }, (_, i) => chrome(i, 1 * GB, '"chrome.exe" --user-data-dir=D:\\projetos\\medialab\\.perfil-automacao')),
  ...Array.from({ length: 51 }, (_, i) => chrome(10 + i, (2.3 / 51) * GB, '"chrome.exe" --type=renderer')),
  ...Array.from({ length: 22 }, (_, i) => ({ pid: 300 + i, nome: 'claude', ramB: (4.1 / 22) * GB, comprometidaB: (8.8 / 22) * GB, cmd: 'claude --resume' })),
  { pid: 900, nome: 'ffmpeg', ramB: 0.6 * GB, comprometidaB: 0.6 * GB, cmd: 'ffmpeg -i x.mp4' },
  { pid: 901, nome: 'svchost', ramB: 0.05 * GB, comprometidaB: 0.05 * GB, cmd: '' },
]
const leitura = (extra = {}) => async () => ({ processos: falsos(), comprometidaGB: 57.5, limiteGB: 63.4, paginasPorSeg: 260, ...extra })

const novo = () => { G._reiniciar(); const linhas = []; return { linhas, registrar: (l) => linhas.push(l) } }
const leitura1 = (disp, agora, ler = leitura(), r) => G.tick({ livreB: disp * GB, totalB: 31.7 * GB, piso: 4, agora, ler, registrar: r.registrar, mapa: { medialab: 'medialab', automate: 'automate' } })

await t('piso: padrão 4, configuração vale, variável de ambiente (só de teste) vence', () => {
  assert.equal(G.pisoGB({}), 4)
  assert.equal(G.pisoGB({ memoriaPisoGB: 6 }), 6)
  assert.equal(G.pisoGB({ memoriaPisoGB: -1 }), 4)
  process.env.CC_MEMORIA_PISO_GB = '40'
  assert.equal(G.pisoGB({ memoriaPisoGB: 6 }), 40)
  delete process.env.CC_MEMORIA_PISO_GB
})

await t('cai abaixo do piso: dispara UMA vez; continuar baixo não repete', async () => {
  const r = novo()
  assert.equal((await leitura1(8, T0, undefined, r)).dispara, false) // acima do piso
  assert.equal((await leitura1(3.2, T0 + 10_000, undefined, r)).dispara, true)
  assert.equal((await leitura1(3.0, T0 + 20_000, undefined, r)).dispara, false)
  assert.equal((await leitura1(3.1, T0 + 30 * MIN, undefined, r)).dispara, false) // nem passados 30 min: só rearma depois de subir
  assert.equal(r.linhas.length, 1)
})

await t('sobe 1 GB acima do piso: rearma, e o aviso sai da tela', async () => {
  const r = novo()
  await leitura1(3.2, T0, undefined, r)
  assert.ok(G.retrato({ livreB: 3.2 * GB, totalB: 31.7 * GB, piso: 4 }).aviso)
  await leitura1(4.9, T0 + 10_000, undefined, r) // 0,9 acima: ainda não rearmou
  assert.ok(G.retrato({ livreB: 4.9 * GB, totalB: 31.7 * GB, piso: 4 }).aviso)
  await leitura1(5.0, T0 + 20_000, undefined, r) // 1 GB acima: rearmou
  assert.equal(G.retrato({ livreB: 5 * GB, totalB: 31.7 * GB, piso: 4 }).aviso, null)
  const x = await leitura1(3.0, T0 + 20 * MIN, undefined, r) // caiu de novo, passados 15 min
  assert.equal(x.dispara, true)
  assert.equal(r.linhas.length, 2)
})

await t('menos de 15 minutos desde o último aviso: não repete, e avisa quando os 15 passam se ainda estiver baixo', async () => {
  const r = novo()
  await leitura1(3.2, T0, undefined, r)
  await leitura1(5.5, T0 + 10_000, undefined, r) // rearmou
  assert.equal((await leitura1(3.0, T0 + 5 * MIN, undefined, r)).dispara, false) // 5 min depois: silêncio
  assert.equal((await leitura1(3.0, T0 + 14 * MIN, undefined, r)).dispara, false)
  assert.equal((await leitura1(3.0, T0 + 15 * MIN, undefined, r)).dispara, true)
})

await t('proximoEstado é puro: não mexe no estado que recebe', () => {
  const e = G.estadoInicial()
  const { estado, dispara } = G.proximoEstado(e, 1, 4, T0)
  assert.equal(dispara, true)
  assert.deepEqual(e, { armado: true, ultimoEm: null })
  assert.equal(estado.armado, false)
})

await t('falha ao ler a lista de processos: ainda avisa, sem a lista', async () => {
  const r = novo()
  const x = await leitura1(3.2, T0, async () => { throw new Error('powershell caiu') }, r)
  assert.equal(x.dispara, true)
  assert.match(x.aviso.texto, /A memória disponível caiu para 3,2 GB \(de 31,7 GB\), abaixo do piso de 4 GB\./)
  assert.match(x.aviso.texto, /Não consegui ler quem está usando a memória/)
  assert.ok(!/Quem mais pesa/.test(x.aviso.texto))
  assert.equal(r.linhas[0].leituraFalhou, true)
  assert.deepEqual(r.linhas[0].grupos, [])
  // leitura que devolve null (falhou sem lançar) cai no mesmo caminho
  const r2 = novo()
  assert.match((await leitura1(3.2, T0, async () => null, r2)).aviso.texto, /Não consegui ler/)
})

await t('o texto diz número, escala, quem pesa por programa e projeto, e o que fazer', async () => {
  const r = novo()
  const { aviso } = await leitura1(3.2, T0, undefined, r)
  const tx = aviso.texto
  assert.match(tx, /^A memória disponível caiu para 3,2 GB \(de 31,7 GB\), abaixo do piso de 4 GB\. Quem mais pesa: Chrome 7,3 GB \(56 processos, dos quais 5 GB do medialab\), sessões do Claude 4,1 GB \(22 processos\), ffmpeg 0,6 GB \(1 processo\)\./)
  assert.match(tx, /comprometida .* está em 57,5 de 63,4 GB, 91% do limite/)
  assert.match(tx, /está usando o disco no lugar da memória \(260 páginas por segundo\), e é isso que trava o PC\./)
  assert.match(tx, /Você pode fechar abas do Chrome ou encerrar sessões do Claude paradas\.$/)
  assert.ok(!/[\u2014\u2013]/.test(tx), 'sem travessão nem meia-risca')
  assert.ok(!/svchost/.test(tx), 'processo pequeno não entra')
})

await t('com poucas páginas por segundo o texto não afirma que o disco está sendo usado', async () => {
  const r = novo()
  const { aviso } = await leitura1(3.2, T0, leitura({ paginasPorSeg: 3 }), r)
  assert.match(aviso.texto, /ainda não está usando o disco no lugar da memória \(3 páginas por segundo\)/)
})

await t('agrupar: por programa, ordenado por memória, com o projeto dono quando a linha de comando traz o nome', () => {
  const g = G.agrupar(falsos(), { medialab: 'medialab' })
  assert.deepEqual(g.map((x) => x.nome), ['Chrome', 'sessões do Claude', 'ffmpeg', 'svchost'])
  assert.equal(g[0].processos, 56)
  assert.ok(Math.abs(g[0].projetos.medialab / GB - 5) < 1e-9)
  assert.equal(G.projetoDe('node D:\\Dark-Channels\\run.js', { darkchannel: 'Dark Channels' }), 'Dark Channels')
  assert.equal(G.projetoDe('node outro.js', { medialab: 'medialab' }), null)
  assert.equal(G.nomesDeProjetos().cuboverso, 'cuboverso')
})

await t('registro por acréscimo: hora, disponível, comprometida, páginas por segundo e os 8 maiores grupos', async () => {
  // o registro de verdade (sem `registrar` injetado), em CC_HOME temporário
  G._reiniciar()
  const grupos = Array.from({ length: 12 }, (_, i) => ({ nome: 'prog' + i, processos: 1, ramB: (12 - i) * GB * 0.1 + 0.3 * GB, comprometidaB: GB, projetos: {} }))
  const lerMuitos = async () => ({ processos: grupos.map((g, i) => ({ pid: i, nome: g.nome, ramB: g.ramB, comprometidaB: g.comprometidaB, cmd: '' })), comprometidaGB: 57.5, limiteGB: 63.4, paginasPorSeg: 260 })
  await G.tick({ livreB: 3.2 * GB, totalB: 31.7 * GB, piso: 4, agora: T0, ler: lerMuitos })
  G._reiniciar()
  await G.tick({ livreB: 2.9 * GB, totalB: 31.7 * GB, piso: 4, agora: T0 + 20 * MIN, ler: lerMuitos })
  const linhas = fs.readFileSync(G.ARQUIVO_REGISTRO(), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(linhas.length, 2, 'acrescenta, não sobrescreve')
  assert.ok(G.ARQUIVO_REGISTRO().startsWith(casa), 'respeita CC_HOME')
  const l = linhas[0]
  assert.equal(l.quando, '2026-11-23T14:00:00.000Z')
  assert.equal(l.disponivelGB, 3.2); assert.equal(l.comprometidaGB, 57.5); assert.equal(l.paginasPorSeg, 260)
  assert.equal(l.grupos.length, 8)
  assert.equal(l.grupos[0].nome, 'prog0')
})

await t('retrato: número fresco, perto do piso e abaixo dele', () => {
  G._reiniciar()
  const r = (d) => G.retrato({ livreB: d * GB, totalB: 31.7 * GB, piso: 4 })
  assert.deepEqual([r(8).abaixo, r(8).perto], [false, false])
  assert.deepEqual([r(4.5).abaixo, r(4.5).perto], [false, true])
  assert.deepEqual([r(3.9).abaixo, r(3.9).perto], [true, true])
  assert.equal(r(4.8).disponivelGB, 4.8)
})

await t('o guarda não toca em processo nenhum: o módulo não importa matar, prioridade nem pausa', () => {
  const fonte = fs.readFileSync(new URL('./src/guardaMemoria.mjs', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')
  assert.ok(!/matarProcesso|setPriority|taskkill|process\.kill|SIGSTOP|Suspend/i.test(fonte))
})

fs.rmSync(casa, { recursive: true, force: true })
console.log(`\n${ok} verificações passaram (guarda de memória)`)
