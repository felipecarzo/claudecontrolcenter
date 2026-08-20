/**
 * Testes da federação. Rodam em qualquer máquina, sem rede e sem job real.
 *
 *   node test-federacao.mjs
 */
import assert from 'node:assert'
import {
  LIMITE_PACOTE, SEM_CONTATO_MS, carimbar, maquinasConhecidas, mesclar,
  mesclarTempo, montarPacote, validarPacote,
} from './src/federacao.mjs'

let n = 0
const ok = (nome) => { n++; console.log('  ok  ', nome) }

const LOCAL = { id: 'aaa11111', nome: 'VPS' }
const PC = { id: 'bbb22222', nome: 'ALIENWARE-LIPE' }

// ------------------------------------------------------------- validação
assert.equal(validarPacote(null).ok, false)
assert.equal(validarPacote({}).ok, false, 'pacote sem máquina tem que ser recusado')
assert.equal(validarPacote({ maquina: { id: '' } }).ok, false)
ok('pacote sem identidade é recusado')

// id vira nome de arquivo: travessia de caminho não pode passar
const sujo = validarPacote({ maquina: { id: '../../etc/passwd', nome: 'x' } })
assert.equal(sujo.ok, true)
assert.equal(sujo.pacote.maquina.id, 'etcpasswd', 'id tem que ser higienizado')
assert.ok(!sujo.pacote.maquina.id.includes('/'))
assert.ok(!sujo.pacote.maquina.id.includes('.'))
ok('id malicioso é higienizado antes de virar caminho')

const gigante = validarPacote({ maquina: { id: 'x' }, jobs: new Array(5000).fill({ id: 'j' }) })
assert.equal(gigante.pacote.jobs.length, 500, 'lista gigante tem que ser cortada')
assert.deepEqual(validarPacote({ maquina: { id: 'x' }, jobs: 'nao é lista' }).pacote.jobs, [])
ok('lista absurda é cortada e tipo errado vira lista vazia')

const nomeLongo = validarPacote({ maquina: { id: 'x', nome: 'n'.repeat(500) } })
assert.equal(nomeLongo.pacote.maquina.nome.length, 60)
ok('nome longo é truncado')

// ---------------------------------------------------------------- carimbo
const carimbado = carimbar([{ id: 'j1' }, { id: 'j2' }], LOCAL)
assert.equal(carimbado.length, 2)
assert.deepEqual(carimbado[0].origem, LOCAL)
assert.deepEqual(carimbar(null, LOCAL), [], 'nada não pode explodir')
ok('carimbo de origem em lista, inclusive vazia')

// ----------------------------------------------------------------- mescla
const pacoteDoPc = {
  maquina: PC,
  jobs: [{ id: 'j1', subject: 'do PC' }, { id: 'x9', subject: 'outro do PC' }],
  idadeMs: 1000, semContato: false,
}
const juntos = mesclar([{ id: 'j1', subject: 'da VPS' }], [pacoteDoPc], LOCAL)
assert.equal(juntos.length, 3, 'mesmo id em máquinas diferentes são agentes diferentes')
assert.equal(juntos.filter((j) => j.id === 'j1').length, 2)
assert.deepEqual(juntos[0].origem.nome, 'VPS')
assert.equal(juntos.find((j) => j.subject === 'do PC').origem.nome, 'ALIENWARE-LIPE')
ok('mescla não deixa uma máquina sobrescrever job de outra com id igual')

// o mesmo pacote duas vezes não duplica
const duplicado = mesclar([], [pacoteDoPc, pacoteDoPc], LOCAL)
assert.equal(duplicado.length, 2)
ok('pacote repetido não duplica linha')

// campo diferente de jobs
const comServidores = mesclar([{ pid: 1 }], [{ maquina: PC, servidores: [{ pid: 2 }] }], LOCAL, 'servidores')
assert.equal(comServidores.length, 2)
assert.equal(comServidores[1].origem.nome, 'ALIENWARE-LIPE')
ok('mescla serve para servidores, não só para agentes')

// ------------------------------------------------------------- as máquinas
const ms = maquinasConhecidas([{ maquina: PC, idadeMs: SEM_CONTATO_MS + 1, semContato: true }], LOCAL)
assert.equal(ms.length, 2)
assert.equal(ms[0].local, true, 'a máquina local vem primeiro')
assert.equal(ms[0].nome, 'VPS')
assert.equal(ms[1].semContato, true, 'máquina velha continua na lista, marcada')
ok('lista de máquinas para o filtro, com quem está sem contato marcado')

// ------------------------------------------------------------- montar
const pacote = montarPacote({
  maquina: LOCAL,
  jobs: [{
    id: 'j1', subject: 'ok', status: 'working', tokens: 10,
    // campos pesados que NÃO podem ir na rede
    rawState: { enorme: 'x'.repeat(1000) }, intent: 'y'.repeat(1000), explicacoes: { a: 1 },
  }],
})
assert.equal(pacote.jobs.length, 1)
assert.equal(pacote.jobs[0].subject, 'ok')
assert.equal(pacote.jobs[0].rawState, undefined, 'estado cru não vai na rede')
assert.equal(pacote.jobs[0].intent, undefined)
assert.ok(pacote.em > 0)
assert.ok(JSON.stringify(pacote).length < LIMITE_PACOTE)
ok('pacote leva só o que a tela precisa, sem o estado cru')

// --------------------------------------------------------- tempo somado
const tempoVps = { projetos: [
  { projeto: 'inovallbond', ativoMs: 3_600_000, tokens: 100, valor: 500, custoReal: 40, sobra: 460 },
  { projeto: 'proj_carzo', ativoMs: 1_800_000, tokens: 50, valor: 0, custoReal: null, sobra: null },
] }
const tempoPc = { projetos: [
  { projeto: 'inovallbond', ativoMs: 7_200_000, tokens: 900, valor: 9999, custoReal: 111, sobra: 1 },
] }
const somado = mesclarTempo(tempoVps, [{ maquina: PC, tempo: tempoPc, idadeMs: 5 }], LOCAL)

const inovall = somado.projetos.find((p) => p.projeto === 'inovallbond')
assert.equal(inovall.ativoMs, 10_800_000, '1h da VPS + 2h do PC = 3h')
assert.equal(inovall.tokens, 1000)
assert.equal(inovall.porMaquina.length, 2, 'a quebra por máquina é o que o filtro usa')
assert.equal(inovall.porMaquina[0].maquina.nome, 'VPS')
assert.equal(inovall.porMaquina[1].ativoMs, 7_200_000)
ok('horas e tokens somam entre as máquinas, com a quebra por origem')

// dinheiro NÃO soma: taxa e assinatura são de cada config
assert.equal(inovall.valor, 0, 'valor tem que ser recalculado por quem exibe')
assert.equal(inovall.custoReal, null)
assert.equal(inovall.sobra, null)
ok('dinheiro não é somado entre máquinas com tabelas diferentes')

// projeto que só existe numa das máquinas continua inteiro
const carzo = somado.projetos.find((p) => p.projeto === 'proj_carzo')
assert.equal(carzo.ativoMs, 1_800_000)
assert.equal(carzo.porMaquina.length, 1)
// e a ordem é por tempo, o maior primeiro
assert.equal(somado.projetos[0].projeto, 'inovallbond')
assert.equal(somado.federado, true)
ok('projeto de uma máquina só sobrevive, e a ordem é por tempo')

// sem pacote nenhum, o resultado é o local intacto
const sozinho = mesclarTempo(tempoVps, [], LOCAL)
assert.equal(sozinho.projetos.length, 2)
assert.equal(sozinho.federado, false)
assert.equal(mesclarTempo(null, [], LOCAL).projetos.length, 0, 'sem dado nenhum não pode explodir')
ok('sem outra máquina, a aba tempo continua como sempre foi')

// ------------------------------------------------------- ida e volta
const ida = montarPacote({ maquina: PC, jobs: [{ id: 'j9', subject: 'viajou' }] })
const volta = validarPacote(JSON.parse(JSON.stringify(ida)))
assert.equal(volta.ok, true)
assert.equal(volta.pacote.jobs[0].subject, 'viajou')
assert.equal(volta.pacote.maquina.nome, 'ALIENWARE-LIPE')
assert.ok(volta.pacote.recebidoEm > 0)
ok('pacote sobrevive ao ida e volta por JSON')

// ------------------------------- CC-165: o backlog de cada projeto no pacote
{
  const { resumirBacklogs } = await import('./src/federacao.mjs')

  const mapa = {
    atualizadoEm: 1700000000000,
    grupos: [
      {
        titulo: 'Aberto',
        frentes: [
          { titulo: 'CC-01 fazer a coisa', estado: 'aberto' },
          { titulo: 'CC-02 já foi', estado: 'feito' },
          { titulo: 'CC-03 outra coisa', estado: 'aberto' },
        ],
      },
    ],
  }

  const r = resumirBacklogs([{ projeto: 'meu_projeto', mapa }])
  assert.equal(r.length, 1)
  assert.equal(r[0].projeto, 'meu_projeto')
  assert.equal(r[0].frentes, 3)
  assert.equal(r[0].abertas, 2, 'frente feita não conta como aberta')
  assert.deepEqual(r[0].titulos, ['CC-01 fazer a coisa', 'CC-03 outra coisa'])
  ok('o resumo do backlog conta as frentes e separa o que está aberto')

  // projeto sem roadmap simplesmente não entra: mandar `null` faria a outra
  // ponta mostrar uma linha vazia com o nome do projeto e nada dentro
  assert.equal(resumirBacklogs([{ projeto: 'sem_roadmap', mapa: null }]).length, 0)
  assert.equal(resumirBacklogs([]).length, 0)
  assert.equal(resumirBacklogs([null, undefined]).length, 0)
  ok('projeto sem roadmap fica de fora, e lista suja não explode')

  // o teto de títulos existe porque o pacote inteiro tem limite de 2 MB
  const muitas = {
    grupos: [{ frentes: Array.from({ length: 50 }, (_, i) => ({ titulo: `CC-${i} item`, estado: 'aberto' })) }],
  }
  const cortado = resumirBacklogs([{ projeto: 'grande', mapa: muitas }])[0]
  assert.equal(cortado.abertas, 50, 'a CONTAGEM não pode ser cortada, só a lista')
  assert.equal(cortado.titulos.length, 6)
  ok('a lista de títulos tem teto, e a contagem continua inteira')

  // o pacote carrega e o validador higieniza
  const comBacklog = montarPacote({ maquina: PC, backlogs: r })
  assert.equal(comBacklog.backlogs[0].projeto, 'meu_projeto')
  const validado = validarPacote(JSON.parse(JSON.stringify(comBacklog)))
  assert.equal(validado.ok, true)
  assert.equal(validado.pacote.backlogs[0].abertas, 2)
  ok('o backlog sobrevive ao ida e volta por JSON')

  // pacote malformado não pode virar tela travada nem campo estranho
  const sujoB = validarPacote({
    maquina: { id: 'x1', nome: 'X' },
    backlogs: [
      { projeto: 'ok', frentes: 'muitas', abertas: null, titulos: 'nao é lista' },
      { semProjeto: true },
    ],
  })
  assert.equal(sujoB.pacote.backlogs.length, 1, 'item sem projeto é descartado')
  assert.equal(sujoB.pacote.backlogs[0].frentes, 0, 'texto no lugar de número vira zero')
  assert.deepEqual(sujoB.pacote.backlogs[0].titulos, [], 'texto no lugar de lista vira lista vazia')
  ok('backlog malformado é higienizado, campo a campo')
}

// ------------------------------------- CC-166: pedir sessão a outra máquina
//
// Casa isolada: a fila mora em disco, e escrever na pasta de federação DE
// VERDADE do Felipe durante o gate é o defeito que este projeto já cometeu
// uma vez com o bloco de notas dele.
{
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ped-'))
  const antes = process.env.CC_HOME
  process.env.CC_HOME = casa
  try {
    const F = await import(`./src/federacao.mjs?casa=${encodeURIComponent(casa)}`)

    // o caminho feliz
    assert.equal(F.pedirSessao({ paraMaquina: 'ALIENWARE-LIPE', projeto: 'proj_carzo' }).ok, true)
    assert.equal(F.pedidosPendentes().length, 1)
    ok('pedido para outra máquina entra na fila')

    // o que NÃO pode virar pedido: nada que pareça caminho
    assert.equal(F.pedirSessao({ paraMaquina: 'ALIENWARE-LIPE', projeto: '../../etc/passwd' }).ok, false)
    assert.equal(F.pedirSessao({ paraMaquina: 'ALIENWARE-LIPE', projeto: 'C:/Windows' }).ok, false)
    assert.equal(F.pedirSessao({ paraMaquina: 'ALIENWARE-LIPE', projeto: '' }).ok, false)
    assert.equal(F.pedirSessao({ paraMaquina: '', projeto: 'proj_carzo' }).ok, false)
    assert.equal(F.pedidosPendentes().length, 1, 'nenhum pedido inválido pode ter entrado')
    ok('nome com caminho, vazio, ou sem destino é recusado antes de ser gravado')

    // dedo duplo no botão não abre duas sessões
    assert.equal(F.pedirSessao({ paraMaquina: 'ALIENWARE-LIPE', projeto: 'proj_carzo' }).jaPedido, true)
    assert.equal(F.pedidosPendentes().length, 1)
    ok('mesmo projeto pedido de novo não duplica a fila')

    // a leitura consome, senão a sessão reabriria a cada ciclo de 30s
    F.pedirSessao({ paraMaquina: 'VPS', projeto: 'outro_projeto' })
    const meus = F.pegarPedidos('ALIENWARE-LIPE')
    assert.equal(meus.length, 1)
    assert.equal(meus[0].projeto, 'proj_carzo')
    assert.equal(F.pegarPedidos('ALIENWARE-LIPE').length, 0, 'ler duas vezes traria a mesma sessão de novo')
    ok('pegar consome o pedido, e é de uso único')

    // e não leva o que é de outra máquina junto
    assert.equal(F.pedidosPendentes().length, 1, 'o pedido da outra máquina tinha que continuar lá')
    assert.equal(F.pegarPedidos('VPS')[0].projeto, 'outro_projeto')
    ok('cada máquina só leva o que é dela')

    // pedido velho é pedido que ninguém foi buscar
    F.pedirSessao({ paraMaquina: 'ALIENWARE-LIPE', projeto: 'antigo', now: Date.now() - F.VALIDADE_PEDIDO_MS - 1000 })
    assert.equal(F.pegarPedidos('ALIENWARE-LIPE').length, 0, 'pedido vencido não pode abrir sessão horas depois')
    ok('pedido vencido não é entregue')

    // a fila não pode ser lida como se fosse pacote de máquina
    assert.equal(F.lerPacotes().length, 0, '_pedidos.json não é uma máquina')
    ok('o arquivo da fila não vira máquina fantasma no painel')

    /* 19/08: o pacote seguinte não pode apagar o que o anterior trouxe.
       As horas viajam a cada 15 minutos e o pacote é empurrado a cada 30
       segundos; substituindo o arquivo inteiro, a VPS ficava 14 minutos e
       meio de cada 15 sem saber o tempo do PC. Medido na VPS: `porMaquina`
       da aba de tempo listava só a máquina local. */
    const maquina = { id: 'aa11bb22', nome: 'DESKTOP-TESTE' }
    F.gravarPacote({ maquina, jobs: [], em: Date.now() - 60000, tempo: { corteMin: 15, projetos: [{ projeto: 'proj_x', ativoMs: 3600000, tokens: 500 }] } })
    F.gravarPacote({ maquina, jobs: [], em: Date.now() })
    const guardado = F.lerPacotes().find((p) => p.maquina.id === 'aa11bb22')
    assert.ok(guardado?.tempo, 'o empurrão seguinte apagou as horas que o anterior trouxe')
    assert.equal(guardado.tempo.projetos[0].ativoMs, 3600000)
    ok('pacote sem horas não apaga as horas do anterior')

    // e a idade do campo herdado é a dele, não a do pacote que chegou agora
    assert.ok(guardado.idades?.tempo, 'o campo herdado precisa dizer de quando ele é')
    assert.ok(Date.now() - guardado.idades.tempo >= 59000, 'a idade das horas não pode ser a do pacote novo')
    ok('hora herdada carrega a própria idade, e não se disfarça de recém-chegada')

    // e quando o pacote novo TRAZ o campo, ele vence o guardado
    F.gravarPacote({ maquina, jobs: [], em: Date.now(), tempo: { corteMin: 15, projetos: [{ projeto: 'proj_x', ativoMs: 7200000, tokens: 900 }] } })
    const atualizado = F.lerPacotes().find((p) => p.maquina.id === 'aa11bb22')
    assert.equal(atualizado.tempo.projetos[0].ativoMs, 7200000, 'hora nova tem que vencer a guardada')
    ok('quando as horas novas chegam, elas substituem as antigas')

    /* CC-205: preservar sem prazo cria o defeito irmão. Se a varredura passar
       a falhar do outro lado, a máquina continua empurrando pacotes sem
       `tempo`, o arquivo continua devolvendo o último bom, e a tela mostra
       hora de anteontem com a máquina marcada em verde. Campo ausente a tela
       sabe dizer; campo velho ela não. */
    const velha = { id: 'cc33dd44', nome: 'PAROU-DE-MEDIR' }
    const antes = Date.now() - F.VALIDADE_HERDADO_MS - 60000
    F.gravarPacote({ maquina: velha, jobs: [], em: antes, tempo: { corteMin: 15, projetos: [{ projeto: 'p', ativoMs: 100 }] } })
    F.gravarPacote({ maquina: velha, jobs: [], em: Date.now() })
    const expirado = F.lerPacotes().find((p) => p.maquina.id === 'cc33dd44')
    assert.equal(expirado.tempo, undefined, 'hora vencida não pode continuar sendo servida como se fosse de agora')
    assert.ok(expirado.descartados?.some((d) => d.campo === 'tempo' && d.motivo === 'velho'), 'o descarte precisa ficar registrado, senão some calado')
    ok('dado herdado tem prazo, e vencido some em vez de posar de atual')

    // e dentro do prazo ele continua valendo, senão a correção acima teria
    // desfeito o conserto de 19/08
    const ainda = { id: 'ee55ff66', nome: 'AINDA-VALE' }
    F.gravarPacote({ maquina: ainda, jobs: [], em: Date.now() - 60000, tempo: { corteMin: 15, projetos: [{ projeto: 'p', ativoMs: 100 }] } })
    F.gravarPacote({ maquina: ainda, jobs: [], em: Date.now() })
    assert.ok(F.lerPacotes().find((p) => p.maquina.id === 'ee55ff66')?.tempo, 'hora de um minuto atrás continua valendo')
    ok('e dentro do prazo o herdado continua de pé')

    /* CC-204: o teto do ARQUIVO não é o teto do pacote. O que chega pela rede
       passa por `LIMITE_PACOTE`; o que vai pro disco é isso mais o herdado, e
       é ele que entra no caminho de 2 em 2 segundos. */
    const gorda = { id: 'gg77hh88', nome: 'PACOTE-GORDO' }
    const enche = (n) => ({ corteMin: 15, projetos: [{ projeto: 'x'.repeat(n), ativoMs: 1 }] })
    F.gravarPacote({ maquina: gorda, jobs: [], em: Date.now(), tempo: enche(F.LIMITE_ARQUIVO) })
    F.gravarPacote({ maquina: gorda, jobs: [], em: Date.now(), uso: { cincoHoras: { usado: 1 } } })
    const arquivo = fs.statSync(path.join(F.dirFederacao(), 'gg77hh88.json'))
    assert.ok(arquivo.size <= F.LIMITE_ARQUIVO, `arquivo passou do teto: ${arquivo.size}`)
    const cortado = F.lerPacotes().find((p) => p.maquina.id === 'gg77hh88')
    assert.ok(cortado.uso, 'o que chegou AGORA nunca pode ser a coisa descartada')
    assert.ok(cortado.descartados?.some((d) => d.campo === 'tempo'), 'o corte precisa dizer o que caiu')
    ok('o arquivo tem teto próprio, e o herdado cai antes do que acabou de chegar')

    /* CC-206: as horas somam as duas máquinas, os dias vinham de `Math.max`.
       Com 10 dias no PC e 3 na VPS, as horas das duas caíam dentro dos 10 dias
       do PC, e "por dia" saía inflada. Agora o dado carrega a faixa. */
    const doisAparelhos = F.mesclarTempo(
      { projetos: [{ projeto: 'compartilhado', ativoMs: 36e5 * 20, tokens: 0, custo: 0, custoBrl: 0, taxaHora: 0, diasTrabalhados: 10, dias: [], sessoes: [], uso: [] }] },
      [{ maquina: { id: 'zz99', nome: 'OUTRA' }, em: Date.now(), tempo: { projetos: [{ projeto: 'compartilhado', ativoMs: 36e5 * 6, tokens: 0, diasTrabalhados: 3 }] } }],
      { id: 'local1', nome: 'AQUI' },
    )
    const comp = doisAparelhos.projetos.find((p) => p.projeto === 'compartilhado')
    assert.equal(comp.ativoMs, 36e5 * 26, 'as horas continuam somando as duas máquinas')
    assert.equal(comp.diasTrabalhados, 10, 'o piso é o maior de uma máquina só')
    assert.equal(comp.diasSomados, 13, 'o teto é a soma, quando nenhum dia coincide')
    assert.equal(comp.diasIncerto, true, 'com duas máquinas a contagem de dias precisa se declarar incerta')
    ok('dias de duas máquinas viram faixa, e a média por dia para de inflar')

    // e com uma máquina só nada muda: continua número exato
    const soUm = F.mesclarTempo(
      { projetos: [{ projeto: 'sozinho', ativoMs: 36e5 * 5, tokens: 0, custo: 0, custoBrl: 0, taxaHora: 0, diasTrabalhados: 5, dias: [], sessoes: [], uso: [] }] },
      [],
      { id: 'local1', nome: 'AQUI' },
    )
    assert.equal(soUm.projetos[0].diasIncerto, false, 'uma máquina só não tem incerteza para declarar')
    ok('e com um aparelho só a contagem segue exata')

    /* 19/08: projeto que só existe na OUTRA máquina precisa nascer com os
       campos que a tela formata. O pacote é enxuto (só projeto, horas e
       tokens), e sem isto a aba de tempo morria em
       `Cannot read properties of undefined (reading 'toFixed')` antes de
       escrever qualquer coisa. O sintoma era a tela presa em "lendo os
       transcritos" para sempre, sem nenhuma mensagem de erro. */
    const mesclado = F.mesclarTempo(
      { projetos: [{ projeto: 'daqui', ativoMs: 1000, tokens: 10, custo: 1.5, custoBrl: 8, taxaHora: 100, diasTrabalhados: 2, dias: [], sessoes: [], uso: [] }] },
      F.lerPacotes(),
      { id: 'local1', nome: 'AQUI' },
    )
    const soDeLa = mesclado.projetos.find((p) => p.projeto === 'proj_x')
    assert.ok(soDeLa, 'o projeto que só existe na outra máquina tem que aparecer')
    for (const campo of ['custo', 'taxaHora', 'diasTrabalhados']) {
      assert.notEqual(soDeLa[campo], undefined, `${campo} indefinido quebra a formatação da tela inteira`)
    }
    assert.equal(soDeLa.ativoMs, 7200000)
    assert.equal(soDeLa.porMaquina.length, 1)
    ok('projeto vindo só da outra máquina nasce formatável, sem campo indefinido')

    /* DINHEIRO NÃO PODE DOBRAR. A primeira versão desta garantia pôs os
       campos zerados ANTES do espalhamento do projeto, então o valor voltava
       para dentro e a soma logo abaixo contava duas vezes: todo custo do
       painel saía dobrado, com ou sem federação. O teste anterior não pegou
       porque só conferia que o campo não era indefinido. */
    const daqui = mesclado.projetos.find((p) => p.projeto === 'daqui')
    assert.equal(daqui.custo, 1.5, 'custo dobrou: o campo foi zerado antes do espalhamento')
    assert.equal(daqui.custoBrl, 8, 'custo em reais dobrou pelo mesmo motivo')
    assert.equal(daqui.ativoMs, 1000, 'horas dobraram')
    assert.equal(daqui.tokens, 10, 'tokens dobraram')
    ok('somar não conta o mesmo valor duas vezes')

    // e o projeto que existe nas duas soma as horas e guarda a quebra
    F.gravarPacote({ maquina, jobs: [], em: Date.now(), tempo: { corteMin: 15, projetos: [{ projeto: 'daqui', ativoMs: 500, tokens: 5 }] } })
    const m2 = F.mesclarTempo(
      { projetos: [{ projeto: 'daqui', ativoMs: 1000, tokens: 10, custo: 1.5, custoBrl: 8, taxaHora: 100, diasTrabalhados: 2, dias: [], sessoes: [], uso: [] }] },
      F.lerPacotes(),
      { id: 'local1', nome: 'AQUI' },
    )
    const nos2 = m2.projetos.find((p) => p.projeto === 'daqui')
    assert.equal(nos2.ativoMs, 1500, 'as horas das duas máquinas têm que somar')
    assert.equal(nos2.porMaquina.length, 2, 'e a quebra por aparelho tem que sobreviver à soma')
    ok('projeto tocado nos dois aparelhos soma o total e mantém a quebra')
  } finally {
    if (antes === undefined) delete process.env.CC_HOME
    else process.env.CC_HOME = antes
    fs.rmSync(casa, { recursive: true, force: true })
  }
}

console.log(`\n${n} grupos de asserção passaram`)
