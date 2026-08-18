// rota-guard — impede escrever em código sem antes marcar a rota no quadro.
//
// Por que existe: o Método Routia já estava escrito no CLAUDE.md do inovallbond
// desde o acidente de 2026-08-04 (três sessões mexendo na mesma parte do jogo
// sem se ver). Em 2026-08-06 duas sessões colidiram DE NOVO — e nenhuma das
// duas tinha lido o quadro. Regra sem consequência é lembrete, e lembrete
// compete com outras duzentas linhas de instrução.
//
// Como funciona: antes de Edit/Write nas pastas controladas do projeto,
// procura no docs/ROTAS-ATIVAS.md uma rota 🔴 marcada com o id DESTA sessão.
// Sem isso, bloqueia e diz exatamente qual linha escrever.
//
// Princípios:
//   - FALHA ABERTA. Qualquer erro do próprio hook libera a edição. Um guard de
//     coordenação que trava o trabalho por bug próprio é pior que o problema.
//   - Não toca em projeto sem ROTAS-ATIVAS.md — o quadro é opt-in por repo.
//   - Nunca bloqueia a edição do próprio quadro, senão marcar rota fica impossível.
//   - Não bloqueia docs/ nem assets/: travar documentação travaria o /end-session,
//     e a colisão que dói é em código.
//
// Pastas controladas: 2026-08-13, deixou de ser `apps`/`tools` fixo no código.
// Lê `pastas-controladas: [x, y]` do front-matter do próprio ROTAS-ATIVAS.md;
// sem esse campo (quadro antigo, como o do inovallbond), cai no hardcode de
// sempre — comportamento antigo intacto pra quem já usa. Existe pra projeto
// de app único (código em `src/`, sem `apps/`/`tools/`) poder usar o método
// também, em vez do guard nunca agir nele — instalado por `cc routia install`.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Libera e encerra. Todo caminho de erro passa por aqui. */
function liberar() { process.exit(0) }

/** Bloqueia: exit 2 devolve o stderr pro modelo como recusa da ferramenta. */
function bloquear(mensagem) {
  process.stderr.write(mensagem)
  process.exit(2)
}

function lerEntrada() {
  try { return JSON.parse(readFileSync(0, 'utf8')) } catch { return null }
}

/**
 * A pasta principal do repositório, quando esta é uma worktree secundária.
 *
 * Numa worktree, `.git` não é pasta: é um arquivo de uma linha com
 * `gitdir: /caminho/da/principal/.git/worktrees/<nome>`. Recortar antes de
 * `/.git/worktrees/` dá a principal, sem rodar git nenhum — derivado, e a
 * mesma informação que o `git worktree list` daria por muito mais caro.
 *
 * `null` quando esta já é a principal, ou quando não é repositório.
 */
function raizPrincipal(dir) {
  let texto = ''
  try { texto = readFileSync(join(dir, '.git'), 'utf8') } catch { return null }
  const m = /^gitdir:\s*(.+?)[\\/]\.git[\\/]worktrees[\\/]/m.exec(texto.trim())
  return m ? m[1] : null
}

/**
 * Sobe a árvore procurando o quadro. null = projeto sem Routia.
 *
 * ⚠️ **Numa oficina (worktree), o quadro que vale é o da pasta PRINCIPAL.**
 * Achado em 16/08, minutos depois de criar a primeira: cada worktree tem sua
 * própria cópia dos arquivos, então cada uma tinha um quadro diferente, vindo do
 * último commit. Dois agentes marcando rota em dois quadros que nunca se veem —
 * a coordenação viraria teatro exatamente no cenário para o qual ela existe.
 *
 * Um quadro só, na principal, e todas as oficinas leem e escrevem nele.
 */
function acharQuadro(partida) {
  let dir = partida
  for (let i = 0; i < 30; i++) {
    const alvo = join(dir, 'docs', 'ROTAS-ATIVAS.md')
    try {
      readFileSync(alvo, 'utf8')
      const principal = raizPrincipal(dir)
      if (principal) {
        const doTronco = join(principal, 'docs', 'ROTAS-ATIVAS.md')
        // se a principal sumiu ou não tem quadro, fica no local: falha aberta
        try { readFileSync(doTronco, 'utf8'); return { quadro: doTronco, raiz: dir } } catch { /* usa o local */ }
      }
      return { quadro: alvo, raiz: dir }
    } catch { /* sobe */ }
    const pai = dirname(dir)
    if (pai === dir) break
    dir = pai
  }
  return null
}

/** O quadro traz uma legenda e um exemplo comentado que PARECEM linhas de rota.
 *  Sem tirar os dois, a mensagem de bloqueio lista lixo — e mensagem com lixo é
 *  mensagem que a próxima sessão ignora. */
function linhasDeRota(texto) {
  return texto
    .replace(/<!--[\s\S]*?-->/g, '')            // fora o exemplo comentado
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.includes('`'))  // só linha de tabela com rota
}

/**
 * `pastas-controladas: [src, apps]` do front-matter YAML do quadro. Parser
 * ingênuo de propósito — não é YAML genérico, é uma linha com uma lista
 * simples entre colchetes. `null` quando o campo não existe (quadro antigo),
 * pra quem chama cair no hardcode de sempre.
 */
function pastasControladas(texto) {
  // BOM no início (comum em arquivo salvo por algumas ferramentas do Windows,
  // como PowerShell `Set-Content -Encoding utf8`) faria `^---` nunca casar.
  const m = /^\uFEFF?---[\s\S]*?^pastas-controladas:\s*\[([^\]]*)\][\s\S]*?^---/m.exec(texto)
  if (!m) return null
  const lista = m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  return lista.length ? lista : null
}

/**
 * Os arquivos que uma linha de rota reivindica, marcados com 📁.
 *
 * ## Por que isto existe, achado em 16/08
 *
 * Até aqui o guard perguntava só "esta sessão marcou ALGUMA rota?" — e, se sim,
 * liberava a pasta controlada inteira. Duas sessões com rotas diferentes
 * editavam o mesmo `src/ui.html` sem nenhum aviso. A separação era convenção,
 * não trava, e o quadro dava a impressão contrária.
 *
 * O Felipe perguntou exatamente isso ao querer abrir um segundo agente para o
 * front-end: *"o que temos de segurança pra fazer isso sem quebrar o projeto?"*
 *
 * ## O formato, e por que ele não quebra quadro nenhum
 *
 * Na coluna "Quem / o quê", em qualquer lugar dela:
 *
 *     | `cockpit` | 🔴 ocupada | ff0d68b2 — abas 📁 src/ui.html src/web.mjs | hoje |
 *
 * **Rota sem 📁 continua funcionando como antes** (libera a pasta inteira). É o
 * que mantém os outros projetos e o histórico deste intactos: quem não declara
 * nada não perde nada, e quem declara ganha a trava.
 *
 * Casa por prefixo, então `📁 src/` cobre a pasta e `📁 src/ui.html` cobre um
 * arquivo. Glob completo seria mais poderoso e menos previsível de ler no
 * quadro, que é um documento para humano antes de ser entrada de parser.
 */
function arquivosDaLinha(linha) {
  const i = linha.indexOf('📁')
  if (i < 0) return null
  const brutos = linha.slice(i + 2)
    .split('|')[0]                       // não vaza para a coluna seguinte
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^`|`$/g, ''))

  /* Para no primeiro token que NÃO tem cara de caminho, em vez de filtrar a
     linha inteira. O motivo é de 17/08: uma rota escreveu
     `📁 src/a.mjs src/b.mjs · precisa de src/ui.html, que é da rota cockpit`,
     e o filtro antigo colheu `src/ui.html` do meio da PROSA, dando ao vizinho a
     posse de um arquivo que ele estava justamente pedindo emprestado. O guarda
     barrou o dono do próprio arquivo.

     Explicar o que a rota faz depois dos arquivos é uso normal do quadro, que é
     documento para humano antes de ser entrada de parser. */
  const caminho = /^[\w.@-]+(?:\/[\w.@-]*)*(?:#[\w.-]+)?$/
  const saida = []
  for (const bruto of brutos) {
    if (!bruto) continue
    /* Repetir o 📁 em cada arquivo é a forma mais natural de escrever, e três
       rotas fizeram isso sem que ninguém percebesse o custo: o marcador não tem
       cara de caminho, o laço parava nele, e tudo depois do PRIMEIRO arquivo
       ficava sem proteção nenhuma. Silencioso e ao contrário, como a leitura do
       modo pela rota: o quadro anunciava a posse, e a trava não tinha nenhuma.
       Medido em 18/08, com `📁 src/entrevista.mjs 📁 cc.mjs 📁 test.mjs`
       protegendo só o primeiro dos três. */
    const t = bruto.replace(/^📁/, '')
    if (!t) continue
    if (!caminho.test(t) || !/[/.]/.test(t)) break
    saida.push(t)
  }
  return saida
}

/** Nomes de rota do quadro, pra mensagem de erro ser acionável. */
function rotasDisponiveis(texto) {
  const nomes = []
  for (const linha of linhasDeRota(texto)) {
    const m = linha.match(/\|\s*\S*\s*`([^`]+)`\s*\|/)
    if (m && !nomes.includes(m[1])) nomes.push(m[1])
  }
  return nomes
}

const entrada = lerEntrada()
if (!entrada) liberar()

const arquivo = entrada.tool_input?.file_path
if (!arquivo) liberar()

const sessao = String(entrada.session_id || '')
if (!sessao) liberar()          // sem identidade não dá pra cobrar rota
const marca = sessao.slice(0, 8)

let caminho
try { caminho = resolve(arquivo) } catch { liberar() }

const achado = acharQuadro(dirname(caminho))
if (!achado) liberar()          // projeto sem quadro: nada a cobrar

// Editar o próprio quadro é como se marca a rota — nunca pode ser bloqueado.
if (caminho === resolve(achado.quadro)) liberar()

let texto
try { texto = readFileSync(achado.quadro, 'utf8') } catch { liberar() }

// Só código. Documentação, assets e configuração de raiz passam direto. O
// escopo vem do quadro (`pastas-controladas`); sem o campo, hardcode antigo.
const relativo = caminho.slice(achado.raiz.length + 1)
const primeiraPasta = relativo.split(sep)[0]
const pastas = pastasControladas(texto) || ['apps', 'tools']
if (!pastas.includes(primeiraPasta)) liberar()

/* Arquivo reivindicado por OUTRA sessão barra mesmo quem tem rota própria.
   Esta checagem vem ANTES da liberação por rota, e é o conserto inteiro: até
   16/08 o guard perguntava só "esta sessão marcou alguma rota?", e uma resposta
   sim liberava a pasta controlada inteira. Dois agentes com rotas diferentes
   editavam o mesmo arquivo em silêncio.

   Rota sem 📁 não reivindica nada e não barra ninguém — é o que mantém todo
   quadro existente funcionando igual. */
const relBarra = relativo.split(sep).join('/')

/* CC-114: a reivindicação aceita `arquivo#parte` (função, classe, ativo):
   `📁 src/ui.html#viewTrabalho`. O guard não tem como saber qual função uma
   edição toca, então a regra mecânica é de PARTILHA DECLARADA: quem reivindica
   só uma parte deixa de barrar quem TAMBÉM declarou o mesmo arquivo na própria
   rota — os dois assumiram a divisão por escrito. Reivindicar o arquivo sem
   `#` continua sendo posse inteira, como sempre foi. */
const soCaminho = (a) => a.split('#')[0]
const cobre = (a, rel) => rel === soCaminho(a) || rel.startsWith(soCaminho(a).replace(/\/?$/, '/'))
const minhasLinhas = linhasDeRota(texto).filter((l) => l.includes('🔴') && l.includes(marca))
const declareiEste = minhasLinhas.some((l) => (arquivosDaLinha(l) || []).some((a) => cobre(a, relBarra)))

const donoDoArquivo = linhasDeRota(texto).find((l) => {
  if (!l.includes('🔴') || l.includes(marca)) return false
  const alvos = arquivosDaLinha(l)
  return alvos?.some((a) => cobre(a, relBarra) && !(a.includes('#') && declareiEste))
})

if (donoDoArquivo) {
  const nome = (donoDoArquivo.match(/`([^`]+)`/) || [])[1] || 'outra rota'
  const quem = (donoDoArquivo.match(/\b([0-9a-f]{8})\b/) || [])[1] || 'outra sessão'
  process.stderr.write(
    `ARQUIVO DE OUTRA ROTA — ${relBarra} está reivindicado por \`${nome}\`.\n\n`
    + `Dono agora: ${quem}. Sua marca: ${marca}.\n\n`
    + `    ${donoDoArquivo}\n\n`
    + 'Ter rota marcada não dá acesso ao projeto inteiro: a rota que declara\n'
    + 'arquivos com 📁 fica com eles. Foi assim que, em 06/08, uma sessão\n'
    + 'commitou três vezes o código que a outra tinha acabado de escrever.\n\n'
    + 'O que fazer, em ordem:\n'
    + '  1. Trabalhe no que é seu — quase sempre há outro arquivo na sua rota.\n'
    + `  2. Precisa mesmo deste? Peça ao dono pelo recado do Routia, ou espere\n`
    + `     ele liberar. Não edite o quadro para tomar a rota de alguém.\n`,
  )
  process.exit(2)
}

// Uma rota vale se está ocupada E carrega o id desta sessão.
const marcada = linhasDeRota(texto).some(l => l.includes('🔴') && l.includes(marca))
if (marcada) {
  const aviso = await avisoDeVizinhanca(achado.raiz, relBarra, texto, marca).catch(() => '')
  if (aviso) {
    process.stdout.write(`${JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: aviso },
    })}\n`)
  }
  liberar()
}

/**
 * CC-140, primeira fatia: aviso de VIZINHANÇA — nunca trava.
 *
 * O quadro protege o arquivo DECLARADO, e o furo real é o arquivo que ninguém
 * declarou mas que o meu depende de, ou que depende do meu. Aconteceu em
 * 17/08 sem custo por sorte: um campo novo em `web.mjs` alimentava a tela que
 * outra sessão estava escrevendo, e nenhum mecanismo avisou.
 *
 * Só calcula o grafo quando pode valer a pena — alguma OUTRA rota já
 * reivindicou arquivo com 📁 — porque mapear o projeto tem custo (site deste
 * repositório: ~130ms) e a maioria das edições não tem ninguém para avisar.
 * Falha aberta, como todo hook daqui: qualquer erro devolve string vazia e a
 * edição segue normal, sem aviso.
 *
 * Sempre AVISA, nunca bloqueia: a metáfora tem topologia que muda a cada
 * commit (o próprio CC-140 registra isso), e travar em cima de um grafo
 * aproximado seria pior que o problema que ele resolve.
 *
 * ⚠️ **`dependencias.mjs` é código do cockpit, não do projeto protegido.**
 * Este hook roda em QUALQUER projeto com quadro (não só neste repositório), e
 * a instalação global fica achatada em `~/.claude/hooks/` — `../../src/...`
 * resolveria certo dentro do repositório, mas erra por dois níveis quando
 * copiado ali. Mesmo achado do `acharCC.mjs` (18/08): reusa ele para achar o
 * `cc.mjs` desta máquina e deriva o caminho de `dependencias.mjs` a partir
 * dele, em vez de um `../../` fixo que só serve a uma das duas localizações.
 */
async function avisoDeVizinhanca(raiz, relBarra, texto, marca) {
  const outrasComArquivo = linhasDeRota(texto)
    .filter((l) => l.includes('🔴') && !l.includes(marca) && (arquivosDaLinha(l) || []).length)
  if (!outrasComArquivo.length) return ''

  const D = await importDependencias()
  if (!D) return ''
  const grafo = D.mapear(raiz)
  const impacto = D.impactoDe(grafo, relBarra, { profundidade: 1 })
  const vizinhos = new Set([...impacto.diretos, ...(grafo.usa.get(relBarra) || [])])
  if (!vizinhos.size) return ''

  const achadas = []
  for (const linha of outrasComArquivo) {
    const alvos = arquivosDaLinha(linha) || []
    const bate = [...vizinhos].filter((v) => alvos.some((a) => cobre(a, v)))
    if (bate.length) {
      const nome = (linha.match(/`([^`]+)`/) || [])[1] || 'outra rota'
      achadas.push(`${nome}: ${bate.join(', ')}`)
    }
  }
  if (!achadas.length) return ''

  return `VIZINHANÇA OCUPADA — ${relBarra} tem ligação direta com arquivo(s) que outra rota está mexendo agora:\n`
    + achadas.map((a) => `  · ${a}`).join('\n')
    + '\nNão bloqueia: é aviso, não posse. Se a sua mudança troca o formato que o outro lado espera '
    + '(nome de campo, formato de retorno), avise pelo recado do Routia antes de seguir.'
}

/** Acha `src/dependencias.mjs` do cockpit nesta máquina, a partir do `cc.mjs`
 *  que o `acharCC.mjs` já sabe localizar. `null` se não achar nenhum dos
 *  dois — falha aberta, o chamador trata como "sem aviso a dar". */
async function importDependencias() {
  try {
    const { acharCC } = await import('./acharCC.mjs')
    const cc = acharCC()
    if (!cc) return null
    return await import(pathToFileURL(join(dirname(cc), 'src', 'dependencias.mjs')).href)
  } catch { return null }
}

const rotas = rotasDisponiveis(texto)
const linhasOcupadas = linhasDeRota(texto).filter(l => l.includes('🔴'))
const ocupadas = linhasOcupadas.map(l => '    ' + l)

// Autorização explícita do dono da rota vale como passe: é o que transforma o
// bloqueio numa negociação entre agentes em vez de um beco sem saída. Carregado
// aqui e não no topo porque tudo neste hook falha aberto — se o módulo sumir ou
// quebrar, o guarda volta a ser exatamente o que era antes.
let pedidos = null
try {
  pedidos = await import('./rota-pedidos.mjs')
} catch { /* sem o módulo, comportamento antigo */ }

if (pedidos) {
  try {
    if (pedidos.autorizado(achado.raiz, { marca, relativo })) liberar()
  } catch { /* falha aberta: segue para o bloqueio normal */ }
}

let aviso = ''
if (pedidos) {
  try {
    const donos = linhasOcupadas
      .map((l) => (l.match(/\|\s*\S*\s*`([^`]+)`\s*\|/) || [])[1])
      .filter(Boolean)
    const p = pedidos.registrar(achado.raiz, { marca, relativo, rotasOcupadas: donos })
    aviso = p?.status === 'negado'
      ? `\nSeu pedido para este arquivo foi NEGADO${p.motivo ? `: ${p.motivo}` : ''}.\nEle voltou para pendente porque você tentou de novo. Fale com o Felipe antes de insistir.\n`
      : `\nPEDIDO REGISTRADO (${p?.id || '?'}), tentativa ${p?.tentativas || 1}.\n`
        + `O dono da rota é avisado no fim do turno dele e libera com:\n`
        + `    node ~/.claude/hooks/rota-pedidos.mjs autorizar ${p?.id || '<id>'}\n`
        + `Não fique esperando: siga com o que não depende deste arquivo.\n`
  } catch { /* falha aberta: bloqueia sem registrar */ }
}

bloquear(
`ROTA NÃO MARCADA — edição bloqueada em ${relativo}

Este projeto usa o Método Routia (docs/COORDENACAO-AGENTES.md). Antes de tocar
em código, marque sua rota em docs/ROTAS-ATIVAS.md — é o que impede duas sessões
de mexerem na mesma parte sem se ver.

Sua marca de sessão: ${marca}

Rotas do quadro: ${rotas.length ? rotas.join(', ') : '(nenhuma listada)'}
${ocupadas.length ? `\nJá ocupadas AGORA (não mexa nelas):\n${ocupadas.join('\n')}\n` : '\nNenhuma rota ocupada no momento.\n'}${aviso}
Se a rota é sua e você só não marcou: edite docs/ROTAS-ATIVAS.md e troque
🟢 livre por 🔴 ocupada, incluindo ${marca} na coluna "Quem / o quê". Exemplo:

| 🟩 \`jogo/npcs\` | 🔴 ocupada | ${marca} — "zoom de dois dedos" | hoje |

Se a rota tem outro dono, NÃO edite o quadro. O pedido acima já foi registrado
para ele responder.
`)
