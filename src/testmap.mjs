/**
 * O test-map: tudo que é testável e verificável no painel, como DADO.
 *
 * Pedido dele em 21/08, com as palavras dele: *"podemos mapear todo o site,
 * funções e botões? a minha intenção é criar um test-map, de tudo que tem que
 * ser testavel e verificavel no site. botões, textos, descrições, etc."*.
 *
 * E a decisão que define o formato: **"é um planejamento para usar como teste
 * em diversas ferramentas"**. Não é tela e não é documento de leitura. É um
 * artefato que o Playwright, o gate, o agy ou qualquer outra ferramenta lê.
 *
 * ## Por que ele nasceu
 *
 * O painel cresceu mais rápido que a medição, e ninguém sabia o tamanho do
 * buraco. Medido no dia em que este arquivo nasceu: 24 telas, 79 tipos de ação,
 * 65 endereços de dados, e **6 desses 65 apareciam em algum teste**.
 *
 * O padrão de defeito deste projeto está escrito cinco vezes no `CLAUDE.md`: a
 * tela afirma com confiança algo que não sabe. Bloco vazio embaixo de cabeçalho,
 * botão que responde "ok" com o processo morto atrás, coluna cortada no
 * telefone. Nenhum quebra nada; todos mentem. Enumerar a superfície é o que
 * transforma "não medimos isso" em item visível.
 *
 * ## A restrição que decidiu a arquitetura
 *
 * **73 das 79 ações nascem dentro de template literal**, em execução, dependendo
 * de dado. Varredura de texto conhece o VOCABULÁRIO, e não sabe o que aparece em
 * qual tela: sondado ao vivo, `view-agora` tem 247 elementos e 6 ações
 * presentes, e só o DOM sabe disso.
 *
 * Por isso cada item declara sua `camada`:
 *
 * - `estatica` — dá para provar lendo o fonte, e roda no `npm test` em
 *   milissegundos;
 * - `viva` — exige navegador e painel no ar (`test-map-vivo.mjs`).
 *
 * **Sem essa distinção o mapa prometeria o que não mede**, que é exatamente o
 * defeito que ele existe para atacar.
 *
 * ## Honestidade da cobertura
 *
 * `coberto` só é preenchido com o que dá para PROVAR: o nome do arquivo de teste
 * onde o item é citado. "Citado" não é "testado", e o campo `como` diz qual das
 * duas coisas foi verificada. Inflar isso tornaria o mapa um relatório bonito,
 * e ele existe justamente contra relatório bonito.
 */
import fs from 'node:fs'
import path from 'node:path'
import { lerPalavrasDaTela } from './glossario.mjs'

/** As cinco dimensões são DELE, escolhidas em 21/08. A quinta ele acrescentou
 *  por escrito: *"que se auto descreve (os `?`) com profundidade"*. */
export const DIMENSOES = {
  existe: 'está na tela, abre, e o endereço responde',
  funciona: 'clicar faz o que promete, e o dado chega no servidor',
  explica: 'a palavra técnica da tela tem explicação escrita',
  estreito: 'cabe em 390px, sem corte e sem rolagem lateral',
  profundo: 'a explicação ensina, em vez de só definir',
}

/** Os arquivos de teste que existem hoje, e o que cada um sabe provar. */
const TESTES = [
  { arquivo: 'test.mjs', roda: 'npm test', navegador: false },
  { arquivo: 'test-endereco.mjs', roda: 'npm run test:endereco', navegador: true },
  { arquivo: 'test-estreito.mjs', roda: 'node test-estreito.mjs', navegador: true },
  { arquivo: 'test-ui.mjs', roda: 'npm run test:ui', navegador: true },
  { arquivo: 'test-framework.mjs', roda: 'npm test', navegador: false },
  { arquivo: 'test-federacao.mjs', roda: 'npm test', navegador: false },
]

const ler = (raiz, rel) => {
  try { return fs.readFileSync(path.join(raiz, rel), 'utf8') } catch { return '' }
}

/** `meu-abrir` → `meuAbrir`. O DOM expõe `dataset` em camelo, e os testes citam
 *  as duas formas: procurar só uma perderia metade das ocorrências. */
const camelo = (s) => s.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())

/**
 * Onde este termo é citado, entre os arquivos de teste.
 *
 * Devolve `null` quando ninguém cita. **Não confunda com "testado"**: citar é o
 * que dá para provar lendo, e é isso que o campo `como` diz em voz alta.
 */
function citadoEm(raiz, termos, cacheTestes) {
  const alvos = termos.filter(Boolean)
  for (const t of TESTES) {
    const texto = cacheTestes[t.arquivo]
    if (!texto) continue
    if (alvos.some((a) => texto.includes(a))) return t.arquivo
  }
  return null
}

const dimensao = (coberto, como, nota = null) => {
  /* `undefined` e `null` são coisas DIFERENTES aqui, e confundir os dois é a
     família de erro mais cara deste painel: dimensão ausente é defeito de
     leitura, `coberto: null` é trabalho a fazer. Por isso a chave sempre
     existe, mesmo vazia. */
  const d = { coberto: coberto || null, como: como || null }
  if (nota) d.nota = nota
  return d
}

/**
 * As 24 telas do menu.
 *
 * A ligação com a explicação é por DERIVAÇÃO, não por lista: `view-agentes`
 * procura o verbete `tela: agentes`. É a mesma regra do "?" (CC-230), e o efeito
 * colateral bom é que tela nova nasce sem explicação e o mapa acusa.
 */
function telas(raiz, cache, palavras) {
  const html = ler(raiz, 'src/ui_v2.html')
  const ids = [...new Set([...html.matchAll(/data-target="(view-[a-z-]+)"/g)].map((m) => m[1]))]
  const verbetes = new Map(palavras.map((p) => [p.termo.toLowerCase(), p]))

  return ids.map((id) => {
    const curto = id.replace(/^view-/, '')
    const verbete = verbetes.get(`tela: ${curto}`)
    /* O campo é `texto`, e a primeira versão deste arquivo leu `corpo`: o mapa
       saiu afirmando que NENHUMA das 50 explicações ensina, o que é falso. É o
       defeito que este mapa existe para pegar, e ele quase nasceu com um. */
    const corpo = String(verbete?.texto || '').trim()
    /* A régua do CC-229: explicação que só repete o nome não ensina nada. O
       corte de 120 caracteres saiu de lá, não é chute deste arquivo. */
    const ensina = corpo.length >= 120
    return {
      id: `tela:${curto}`,
      tipo: 'tela',
      rotulo: curto,
      onde: `src/ui_v2.html#${id}`,
      camada: 'viva',
      dimensoes: {
        /* O CC-231 fez o `test-endereco` abrir TODAS as telas do menu, uma a
           uma, ouvindo `Runtime.exceptionThrown` e recusando tela que abra
           praticamente vazia. Então esta dimensão é coberta por construção:
           tela nova entra na varredura dele sozinha. */
        existe: dimensao('test-endereco.mjs', 'abre a tela e escuta erro de execução do navegador'),
        funciona: dimensao(citadoEm(raiz, [id, curto], cache), 'a tela é citada, o que NÃO prova que os botões dela funcionam'),
        explica: dimensao(verbete ? 'test.mjs' : null, verbete ? 'tem verbete `tela: ' + curto + '`' : null,
          verbete ? null : 'sem explicação escrita: o "?" desta tela não nasce'),
        estreito: dimensao(null, null, 'test-estreito.mjs ainda mede o painel ANTIGO (src/ui.html)'),
        profundo: dimensao(ensina ? 'test.mjs' : null, ensina ? 'o verbete tem corpo de verdade' : null,
          ensina ? null : 'explicação curta demais: define sem ensinar'),
      },
    }
  })
}

/** Os tipos de ação (`data-*`). É o vocabulário do que dá para clicar. */
function acoes(raiz, cache) {
  const html = ler(raiz, 'src/ui_v2.html')
  const nomes = [...new Set([...html.matchAll(/data-([a-z-]+)=/g)].map((m) => `data-${m[1]}`))]
  /* `data-i`, `data-n` e afins carregam DADO, não ação. Separá-los evita
     encher o mapa de item que ninguém vai clicar. */
  const soDado = new Set(['data-i', 'data-n', 'data-note', 'data-meu-texto', 'data-explica', 'data-ajuda', 'data-como'])

  return nomes.map((nome) => {
    const emTemplate = new RegExp(`${nome}="\\$\\{`).test(html)
    const dado = soDado.has(nome)
    return {
      id: `acao:${nome.replace(/^data-/, '')}`,
      tipo: dado ? 'dado-de-tela' : 'acao',
      rotulo: nome,
      onde: 'src/ui_v2.html',
      /* Nasce em execução? Então só o DOM sabe onde ela aparece. */
      camada: emTemplate ? 'viva' : 'estatica',
      dimensoes: {
        existe: dimensao('src/ui_v2.html', 'o atributo existe no fonte'),
        funciona: dimensao(citadoEm(raiz, [nome, camelo(nome)], cache),
          'o nome aparece num teste, o que ainda não prova o clique de ponta a ponta'),
        explica: dimensao(null, null, 'ação não tem verbete próprio: quem explica é a tela'),
        estreito: dimensao(null, null, 'depende do bloco onde ela aparece'),
        profundo: dimensao(null, null, 'não se aplica a uma ação isolada'),
      },
    }
  })
}

/** Os endereços de dados que o painel serve. */
function enderecos(raiz, cache) {
  const web = ler(raiz, 'src/web.mjs')
  const rotas = [...new Set([...web.matchAll(/url\.pathname === '(\/api\/[a-z/-]+)'/g)].map((m) => m[1]))]
  return rotas.map((rota) => {
    const escreve = new RegExp(`${rota.replace(/\//g, '\\/')}'[\\s\\S]{0,400}?req\\.method === 'POST'`).test(web)
    return {
      id: `endereco:${rota.replace(/^\/api\//, '')}`,
      tipo: 'endereco',
      rotulo: rota,
      onde: 'src/web.mjs',
      camada: 'estatica',
      escreve,
      dimensoes: {
        existe: dimensao('src/web.mjs', 'a rota está declarada'),
        funciona: dimensao(citadoEm(raiz, [rota], cache), 'a rota é citada em teste'),
        explica: dimensao(null, null, 'endereço não aparece para ele: não precisa de verbete'),
        estreito: dimensao(null, null, 'não se aplica'),
        profundo: dimensao(null, null, 'não se aplica'),
      },
    }
  })
}

/** As palavras que a tela explica, e os pontos que usam cada uma. */
function palavrasDaTela(raiz, palavras) {
  const html = ler(raiz, 'src/ui_v2.html')
  const usados = new Set([
    ...[...html.matchAll(/data-explica="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/ajuda\('([^']+)'\)/g)].map((m) => m[1]),
  ])
  return palavras.map((p) => {
    const corpo = String(p.texto || '').trim()
    const ensina = corpo.length >= 120
    const usada = usados.has(p.termo) || [...usados].some((u) => u.toLowerCase() === p.termo.toLowerCase())
    return {
      id: `palavra:${p.termo}`,
      tipo: 'palavra',
      rotulo: p.termo,
      onde: 'docs/produto/PALAVRAS-DA-TELA.md',
      camada: 'estatica',
      dimensoes: {
        existe: dimensao('test.mjs', 'o verbete está escrito'),
        funciona: dimensao(usada ? 'src/ui_v2.html' : null, usada ? 'algum ponto da tela usa este termo' : null,
          usada ? null : 'escrita e nunca usada: o "?" dela não aparece em lugar nenhum'),
        explica: dimensao('test.mjs', 'o gate recusa termo declarado sem corpo'),
        estreito: dimensao(null, null, 'não se aplica'),
        profundo: dimensao(ensina ? 'test.mjs' : null, ensina ? `corpo com ${corpo.length} caracteres` : null,
          ensina ? null : 'curta demais: define sem ensinar'),
      },
    }
  })
}

/**
 * O mapa inteiro.
 *
 * `at` fica FORA dos itens de propósito: o carimbo de hora muda a cada geração,
 * e se ele entrasse item a item o `git diff` do arquivo derivado seria ruído
 * puro, escondendo a única coisa que importa ver, que é o que mudou de verdade.
 */
export function montarMapa(raiz = process.cwd()) {
  const cache = {}
  for (const t of TESTES) cache[t.arquivo] = ler(raiz, t.arquivo)
  const palavras = lerPalavrasDaTela(raiz)

  const itens = [
    ...telas(raiz, cache, palavras),
    ...acoes(raiz, cache),
    ...enderecos(raiz, cache),
    ...palavrasDaTela(raiz, palavras),
  ]

  const resumo = {}
  for (const it of itens) {
    const r = resumo[it.tipo] || (resumo[it.tipo] = { total: 0, ...Object.fromEntries(Object.keys(DIMENSOES).map((d) => [d, 0])) })
    r.total++
    for (const [dim, v] of Object.entries(it.dimensoes)) if (v.coberto) r[dim]++
  }

  return { versao: 1, at: Date.now(), dimensoes: DIMENSOES, resumo, itens }
}

/** A mesma coisa em tabela, para ele ler no celular e para o git mostrar. */
export function paraMarkdown(mapa) {
  const L = []
  L.push('# TEST-MAP: o que é testável e verificável no painel')
  L.push('')
  L.push('> **Arquivo derivado. Não edite à mão.** Ele é gerado por `cc testmap`,')
  L.push('> e o gate recusa quando o conteúdo não bate com a varredura.')
  L.push('')
  L.push('Pedido dele em 21/08: *"criar um test-map, de tudo que tem que ser')
  L.push('testavel e verificavel no site. botões, textos, descrições, etc."*, para')
  L.push('*"usar como teste em diversas ferramentas"*. O contrato para as')
  L.push('ferramentas é o `TEST-MAP.json` ao lado; este arquivo é a leitura humana.')
  L.push('')
  L.push('## As cinco dimensões')
  L.push('')
  L.push('| dimensão | o que ela quer dizer |')
  L.push('|---|---|')
  for (const [k, v] of Object.entries(mapa.dimensoes)) L.push(`| \`${k}\` | ${v} |`)
  L.push('')
  L.push('## Onde estamos')
  L.push('')
  L.push('| tipo | itens | ' + Object.keys(mapa.dimensoes).map((d) => `\`${d}\``).join(' | ') + ' |')
  L.push('|---|---|' + Object.keys(mapa.dimensoes).map(() => '---').join('|') + '|')
  for (const [tipo, r] of Object.entries(mapa.resumo)) {
    L.push(`| ${tipo} | ${r.total} | ` + Object.keys(mapa.dimensoes).map((d) => `${r[d]}/${r.total}`).join(' | ') + ' |')
  }
  L.push('')
  L.push('**Coberto quer dizer CITADO num arquivo de teste, não testado de ponta a')
  L.push('ponta.** A diferença está na coluna `como` do JSON, item a item. Inflar')
  L.push('este número tornaria o mapa um relatório bonito, e ele existe contra isso.')
  L.push('')

  for (const tipo of Object.keys(mapa.resumo)) {
    const doTipo = mapa.itens.filter((i) => i.tipo === tipo)
    L.push(`## ${tipo} (${doTipo.length})`)
    L.push('')
    L.push('| item | camada | onde | o que falta |')
    L.push('|---|---|---|---|')
    for (const it of doTipo) {
      const falta = Object.entries(it.dimensoes)
        .filter(([, v]) => !v.coberto && !/não se aplica/.test(v.nota || ''))
        .map(([d]) => d)
      L.push(`| \`${it.rotulo}\` | ${it.camada} | ${it.onde} | ${falta.join(', ') || 'nada'} |`)
    }
    L.push('')
  }
  return L.join('\n') + '\n'
}

/** Grava os dois arquivos irmãos e devolve os caminhos. */
export function gravar(raiz = process.cwd(), mapa = montarMapa(raiz)) {
  const dir = path.join(raiz, 'docs')
  fs.mkdirSync(dir, { recursive: true })
  const json = path.join(dir, 'TEST-MAP.json')
  const md = path.join(dir, 'TEST-MAP.md')
  /* O carimbo de hora NÃO vai para o arquivo versionado.
     Achado em 21/08, quando a sessão do PC avisou que o `TEST-MAP.json` estava
     sempre modificado: o `at` mudava a cada geração e o git acusava alteração
     mesmo com o conteúdo idêntico, item por item. Ruído garantido em todo
     commit futuro, escondendo a única coisa que importa ver, que é o mapa ter
     mudado de verdade.
     Quem quiser saber quando foi gerado pergunta ao git, que é quem guarda
     isso direito. O `at` continua na resposta de `montarMapa()`, para quem
     consome o mapa em memória. */
  const { at, ...paraDisco } = mapa
  fs.writeFileSync(json, `${JSON.stringify(paraDisco, null, 1)}\n`)
  fs.writeFileSync(md, paraMarkdown(mapa))
  return { json, md }
}
