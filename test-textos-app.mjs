// CC-1037: o ciclo dos textos do app: levantar -> baralhos -> votar "Editar" -> aplicar no código.
// Usa o TypeScript de um projeto da máquina (CC_TYPESCRIPT, ou o do Ahtleta Corrida). Sem ele, o teste avisa e pula.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const CAND = [process.env.CC_TYPESCRIPT, '/home/claudedev/projetos/VPS_ahtleta-corrida/node_modules/typescript', '/home/claudedev/projetos/VPS_ahtleta-escalada/node_modules/typescript'].filter(Boolean)
const tsDir = CAND.find((d) => existsSync(join(d, 'package.json')))
if (!tsDir) { console.log('test-textos-app: pulado (nenhum TypeScript encontrado nesta máquina; defina CC_TYPESCRIPT)'); process.exit(0) }

const X = await import('./src/textosApp.mjs')
const C = await import('./src/cartas.mjs')
let n = 0
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok  ' + m) }

// pareceTexto: o que é frase e o que é código
ok(X.pareceTexto('Salvar o treino agora?') && X.pareceTexto('Início') && X.pareceTexto('Calcanhar no glúteo'), 'frase e palavra de interface contam')
ok(!['play-circle', '#FFFFFF', '/planos', 'https://x.com', 'MAX_VALOR', 'center', 'icone.png', '12px', 'a'].some(X.pareceTexto), 'ícone, cor, rota, endereço, constante, imagem e medida não contam')

const proj = mkdtempSync(join(tmpdir(), 'textos-app-'))
const ts = createRequire(join(tsDir, 'x.js'))(tsDir)
try {
  mkdirSync(join(proj, 'node_modules'), { recursive: true }); symlinkSync(tsDir, join(proj, 'node_modules', 'typescript'))
  writeFileSync(join(proj, 'package.json'), '{"name":"app-falso"}')
  mkdirSync(join(proj, 'src', 'app'), { recursive: true }); mkdirSync(join(proj, 'src', 'data'), { recursive: true })
  const tela = [
    "import { Text, Alert } from 'react-native'",
    'export default function Tela() {',
    "  Alert.alert('Atenção', 'Salvar o treino agora?')",
    '  return (<View>',
    '    <Text title="Início" style={{ color: "red" }} testID="campo-nome">Bem-vindo ao app — vamos correr</Text>',
    "    <Text>{'Texto em expressão'}</Text>",
    '    <Input placeholder="Digite seu nome" />',
    '    <Text>',
    '      Texto em duas',
    '      linhas aqui',
    '    </Text>',
    '    <Text>{`Olá ${nome}, tudo bem?`}</Text>',
    '  </View>)',
    '}',
    '',
  ].join('\n')
  writeFileSync(join(proj, 'src', 'app', 'index.tsx'), tela)
  writeFileSync(join(proj, 'src', 'data', 'treinos.ts'), "export const T = [{ titulo: 'Corrida leve', icone: 'play-circle', cor: '#fff' }, { texto: 'Use o \\'ritmo\\' confortável' }]\n")
  writeFileSync(join(proj, 'src', 'app', 'index.test.tsx'), '<Text>Texto de teste que não conta</Text>\n')

  const r = X.levantar(proj)
  const textos = r.itens.map((i) => i.texto)
  ok(r.itens.length === 9, `acha os 9 textos (achou ${r.itens.length}: ${textos.join(' | ')})`)
  ok(['Início', 'Bem-vindo ao app — vamos correr', 'Texto em expressão', 'Digite seu nome', 'Texto em duas linhas aqui', 'Atenção', 'Salvar o treino agora?', 'Corrida leve', "Use o 'ritmo' confortável"].every((t) => textos.includes(t)), 'texto de tela, atributo, expressão, várias linhas, alerta e dado')
  ok(!textos.some((t) => /play-circle|#fff|campo-nome|red|nome, tudo|de teste/.test(t)), 'ícone, cor, id de teste, estilo, texto montado em tempo de execução e arquivo de teste ficam de fora')
  ok(r.itens.every((i) => i.original === readFileSync(join(proj, i.arquivo), 'utf8').slice(i.ini, i.fim)), 'cada posição aponta exatamente para o trecho original')
  ok(JSON.stringify(X.levantar(proj).itens.map((i) => i.id)) === JSON.stringify(r.itens.map((i) => i.id)), 'os ids são estáveis entre levantamentos (os votos continuam valendo)')

  // baralhos
  const pacote = X.montarBaralhos(r.itens, { projeto: 'app-falso', agora: new Date('2026-10-09T12:00:00Z') })
  const gravados = X.gravar(proj, pacote)
  ok(gravados.map((g) => g.nome).sort().join() === 'textos-app,textos-dados', 'um baralho por área: ' + gravados.map((g) => g.nome + ':' + g.cartas))
  ok(C.listarDecks(proj).join() === 'textos-app,textos-dados', 'o painel lista os baralhos e ignora a tabela de posições')
  const dApp = C.lerDeck(proj, 'textos-app').deck
  const cTrav = dApp.cartas.find((c) => /vamos correr/.test(c.titulo))
  ok(!/[—–]/.test(JSON.stringify(dApp)) && /travessão/.test(cTrav.olhe), 'o travessão do código sai da carta, e a carta avisa que vale editar')
  ok(cTrav.opcoes.length === 3 && cTrav.opcoes[1].startsWith('Editar'), 'três saídas: Aprovo, Editar e Recuso')
  // CC-1035: a carta leva o texto atual para a tela abrir o campo de editar já preenchido
  ok(cTrav.editar === 'Bem-vindo ao app - vamos correr' && dApp.cartas.every((c) => typeof c.editar === 'string'), 'cada carta leva o texto atual em "editar" (o travessão já sai, como na carta)')
  const ruim = { titulo: 't', criado: '2026-10-10T00:00:00Z', cartas: [{ id: 'x1', titulo: 'a', editar: 'y'.repeat(601) }, { id: 'x2', titulo: 'b', editar: 'com — travessão' }, { id: 'x3', titulo: 'c', editar: 5 }] }
  ok(C.validarDeck(ruim).length === 3, 'o painel recusa "editar" com mais de 600 caracteres, com travessão ou que não é texto')
  ok(C.validarDeck({ titulo: 't', criado: '2026-10-10T00:00:00Z', cartas: [{ id: 'ok1', titulo: 'a', editar: 'texto normal' }] }).length === 0, 'e aceita o normal')
  const grande = X.montarBaralhos([{ id: 'Tgrande', tipo: 'jsx', texto: 'palavra '.repeat(100), arquivo: 'src/app/x.tsx', linha: 1, ini: 0, fim: 10, quote: '', direto: false, original: 'x' }])
  ok(grande.baralhos['textos-app'].cartas[0].editar === undefined, 'texto comprido demais para o aplicador (600) vira carta sem campo de editar, em vez de recusar o baralho')

  // votos: edita três textos de jeitos diferentes, aprova um, recusa um
  const idDe = (frag) => dApp.cartas.find((c) => c.titulo.includes(frag)).id
  const idDado = C.lerDeck(proj, 'textos-dados').deck.cartas.find((c) => /ritmo/.test(c.titulo)).id
  const v = (deck, id, op, nota) => assert.ok(C.votar(proj, deck, id, { escolhas: [op], nota }).ok, 'voto ' + id)
  v('textos-app', idDe('vamos correr'), X.OP_EDITAR, 'Bem-vindo ao app, vamos correr')
  v('textos-app', idDe('Digite seu nome'), X.OP_EDITAR, 'Como "você" quer ser chamado?')
  v('textos-app', idDe('Texto em duas'), X.OP_EDITAR, 'Texto com <tag> proibida')
  v('textos-app', idDe('Atenção'), X.OP_APROVO)
  v('textos-app', idDe('Texto em expressão'), X.OP_RECUSO)
  v('textos-dados', idDado, X.OP_EDITAR, "Use o ritmo 'confortável' e leve")

  const ensaio = X.aplicar(proj, { ensaio: true })
  ok(ensaio.aplicadas.length === 3 && readFileSync(join(proj, 'src/app/index.tsx'), 'utf8') === tela, `ensaio mostra 3 edições e não grava nada (aplicadas ${JSON.stringify(ensaio.aplicadas.map((a) => a.para))}, puladas ${JSON.stringify(ensaio.puladas)})`)
  const ap = X.aplicar(proj)
  ok(ap.aplicadas.length === 3 && ap.puladas.length === 1 && /não pode ter/.test(ap.puladas[0].motivo), 'aplica 3, pula a que tem < > (não é válida em texto de tela)')
  const novo = readFileSync(join(proj, 'src/app/index.tsx'), 'utf8')
  ok(novo.includes('>Bem-vindo ao app, vamos correr</Text>'), 'texto de tela trocado no lugar exato')
  ok(novo.includes('placeholder="Como &quot;você&quot; quer ser chamado?"'), 'aspas do texto novo viram entidade dentro do atributo (JSX não aceita barra invertida ali)')
  ok(novo.includes('title="Início"') && novo.includes("{'Texto em expressão'}") && novo.includes('Texto em duas\n      linhas aqui') && novo.includes("'Salvar o treino agora?'"), 'o que ele aprovou, recusou ou não tocou continua igual')
  ok(readFileSync(join(proj, 'src/data/treinos.ts'), 'utf8').includes("texto: 'Use o ritmo \\'confortável\\' e leve'"), 'texto de dado trocado com a aspa escapada')
  const sf = ts.createSourceFile('x.tsx', novo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  ok(!sf.parseDiagnostics.length, 'o arquivo continua válido depois das trocas')
  const de_novo = X.aplicar(proj)
  ok(de_novo.aplicadas.length === 0 && de_novo.puladas.filter((p) => /já estava/.test(p.motivo)).length === 3, 'rodar de novo não repete: "já estava aplicada"')

  // uma edição NOVA no mesmo arquivo, depois de outras já aplicadas (as posições andaram): cai no lugar certo
  v('textos-app', idDe('Salvar o treino'), X.OP_EDITAR, 'Quer salvar este treino agora, com tudo certo?')
  const seg = X.aplicar(proj)
  ok(seg.aplicadas.length === 1 && readFileSync(join(proj, 'src/app/index.tsx'), 'utf8').includes("'Atenção', 'Quer salvar este treino agora, com tudo certo?')"), 'edição nova depois de outra já aplicada cai no lugar certo (a tabela de posições se atualiza)')

  // arquivo que mudou depois do levantamento: não troca
  writeFileSync(join(proj, 'src/app/index.tsx'), novo.replace('Bem-vindo ao app, vamos correr', 'Outro texto agora'))
  const mudou = X.aplicar(proj)
  ok(mudou.puladas.some((p) => /mudou desde o levantamento/.test(p.motivo)), 'trecho que mudou desde o levantamento não é sobrescrito')
} finally { rmSync(proj, { recursive: true, force: true }) }
console.log(`test-textos-app: ${n} verificações, 0 falhas`)
