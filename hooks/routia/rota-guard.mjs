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

/** Sobe a árvore procurando o quadro. null = projeto sem Routia. */
function acharQuadro(partida) {
  let dir = partida
  for (let i = 0; i < 30; i++) {
    const alvo = join(dir, 'docs', 'ROTAS-ATIVAS.md')
    try { readFileSync(alvo, 'utf8'); return { quadro: alvo, raiz: dir } } catch { /* sobe */ }
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

// Uma rota vale se está ocupada E carrega o id desta sessão.
const marcada = linhasDeRota(texto).some(l => l.includes('🔴') && l.includes(marca))
if (marcada) liberar()

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
