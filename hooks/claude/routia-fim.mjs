// routia-fim — lembra de liberar a rota quando a sessão termina.
//
// Por que existe: o rota-guard cobra a ENTRADA (bloqueia edição sem rota
// marcada), mas nada cobra a SAÍDA — uma sessão pode terminar deixando 🔴
// marcado com o próprio id, e a rota fica "presa" pra próxima sessão real.
//
// Decisão de produto (CC-28, 2026-08-12): LEMBRA, não resolve sozinho. Editar
// docs/ROTAS-ATIVAS.md automaticamente aqui repetiria o problema que o CC-18
// já rejeitou no painel — escrever arquivo compartilhado sem revisão. Isso é
// só um aviso (`systemMessage`, não bloqueia o Stop) pro Felipe ou pro próprio
// agente decidir liberar a rota à mão.
//
// Atualizado 2026-08-12: o aviso ficava repetindo a cada Stop mesmo quando
// não havia conflito real — sessão sozinha no projeto, rota presa de uma
// rodada anterior. Antes de falar, pergunta pro Control Center (`cc json`)
// se existe OUTRO job com status working/waiting na mesma pasta de projeto.
// Só sozinho fica mudo; havendo qualquer sinal de outro agente ativo (ou o
// Control Center não responder), continua avisando — falha pro lado de
// falar, nunca pro lado de esconder um conflito de verdade. Continua sem
// escrever no quadro: quem libera é a skill routia-resolver, sob pedido, ou
// o Felipe à mão — isto só decide se vale a pena interromper com o aviso.
//
// Princípios (os mesmos do rota-guard):
//   - FALHA ABERTA e silenciosa.
//   - Nunca insiste: se este mesmo hook já reentrou (stop_hook_active), sai.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { acharCC } from './acharCC.mjs'

function sair() { process.exit(0) }

function lerEntrada() {
  try { return JSON.parse(readFileSync(0, 'utf8')) } catch { return null }
}

function acharQuadro(partida) {
  let dir = partida
  for (let i = 0; i < 30; i++) {
    const alvo = join(dir, 'docs', 'ROTAS-ATIVAS.md')
    try { readFileSync(alvo, 'utf8'); return alvo } catch { /* sobe */ }
    const pai = dirname(dir)
    if (pai === dir) break
    dir = pai
  }
  return null
}

function linhasDeRota(texto) {
  return texto
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.includes('`'))
}

const entrada = lerEntrada()
if (!entrada) sair()
if (entrada.stop_hook_active) sair() // já avisou nesta rodada, não insiste

const sessao = String(entrada.session_id || '')
if (!sessao) sair()
const marca = sessao.slice(0, 8)

const cwd = entrada.cwd || process.cwd()
const quadro = acharQuadro(cwd)
if (!quadro) sair()

let texto
try { texto = readFileSync(quadro, 'utf8') } catch { sair() }

const minhas = linhasDeRota(texto).filter((l) => l.includes('🔴') && l.includes(marca))

/**
 * Pedidos de outras sessões esperando resposta. Este é o único momento em que o
 * dono da rota é alcançado: não existe canal direto entre sessões do Claude Code
 * (SendMessage só fala com subagentes da própria sessão), então o fim do turno
 * dele é onde a mensagem cabe.
 *
 * Avisa mesmo quando a sessão está sozinha e mesmo sem rota marcada: um pedido
 * pendente é informação nova sobre alguém travado, não um lembrete repetido.
 */
/**
 * CC-243: o texto encolheu, e o detalhe foi para o painel.
 *
 * Ele mandou o fim de uma resposta com dezesseis linhas disto e disse: *"não faz
 * sentido eu ficar vendo esse furdunço de mensagem no chat, separando o que eu
 * tenho que ler dessas coisas que só servem de burocracia pro próprio agente"*.
 *
 * Antes, cada pedido gastava TRÊS linhas na conversa: uma dizendo o que era, e
 * duas com comandos de terminal para copiar e colar. Isso é o oposto do que ele
 * pediu, porque decidir no terminal é justamente a burocracia.
 *
 * Agora o chat leva UMA linha por pedido, e a decisão mora na tela Estrutura do
 * painel (`GET /api/rotas` traz os pendentes, `POST /api/rotas/pedido` responde
 * com um clique).
 *
 * **Continua falando**, e isso é deliberado: pedido pendente é alguém TRAVADO
 * esperando resposta, o oposto de burocracia repetida. O que saiu foi o
 * mecanismo, não o aviso.
 */
let textoPedidos = ''
try {
  const p = await import('./rota-pedidos.mjs')
  const raiz = dirname(dirname(quadro))
  const abertos = p.pendentes(raiz, { excetoDe: marca })
  if (abertos.length) {
    textoPedidos =
      `${abertos.length} agente(s) travado(s) esperando sua autorização: `
      + abertos.map((x) => `${x.de} em ${x.arquivo}`).join(', ')
      + `. Responda na tela Estrutura do cockpit.`
  }
} catch { /* falha aberta: sem módulo, comportamento antigo */ }

if (!minhas.length) {
  if (textoPedidos) {
    process.stdout.write(JSON.stringify({ systemMessage: textoPedidos }))
    process.exit(0)
  }
  sair()
}

/**
 * true = existe outro agente ativo de verdade no mesmo projeto (avisa);
 * false = confirmado sozinho (fica quieto);
 * null = não deu pra confirmar (`cc` fora do ar/não instalado) — trata como
 * "avisa", porque não saber não é a mesma coisa que saber que está sozinho.
 */
function outroAgenteAtivo(raizProjeto, meuId) {
  /* Era um caminho fixo do npm global do Windows, e fora dali nunca existia:
     a resposta caía sempre em `null`, ou seja, "não deu para confirmar", e o
     aviso saía toda vez, inclusive em sessão sozinha. Ver `acharCC.mjs`. */
  const CC = acharCC()
  if (!CC) return null
  let r
  try {
    r = spawnSync(process.execPath, [CC, 'json'], { encoding: 'utf8', timeout: 5000 })
  } catch {
    return null
  }
  if (!r || r.status !== 0 || !r.stdout) return null
  let dados
  try { dados = JSON.parse(r.stdout) } catch { return null }
  const jobs = Array.isArray(dados?.jobs) ? dados.jobs : null
  if (!jobs) return null

  const dentroDoProjeto = (j) => typeof j.cwd === 'string' && j.cwd.startsWith(raizProjeto)
  const ativoDeVerdade = (j) => j.status === 'working' || j.status === 'waiting'
  return jobs.some((j) => j.id !== meuId && dentroDoProjeto(j) && ativoDeVerdade(j))
}

const raizProjeto = dirname(dirname(quadro)) // .../docs/ROTAS-ATIVAS.md -> raiz do projeto

// Sozinho e sem ninguém pedindo nada: nada a dizer. Havendo pedido, fala mesmo
// sozinho — alguém travado esperando resposta é sempre notícia.
if (outroAgenteAtivo(raizProjeto, marca) === false && !textoPedidos) sair()

/**
 * CC-243: o lembrete de rota marcada SAIU do chat.
 *
 * Palavras dele: *"se está falando que a rota está marcada, aí é algo que só faz
 * diferença entre os próprios agentes em si"*. Está certo, e havia duplicidade:
 * **o painel já mostra as rotas** na tela Estrutura, com quem segura cada uma,
 * há quanto tempo está calada e quais arquivos reivindica (`GET /api/rotas`).
 * A mesma informação aparecia duas vezes, e uma delas na conversa dele.
 *
 * ⚠️ **Não foi apagado, foi movido.** Rota esquecida marcada é o problema que o
 * Método Routia existe para evitar: calar sem colocar em lugar nenhum trocaria
 * um incômodo por um defeito. O `stderr` continua levando o lembrete até MIM,
 * que sou quem precisa agir, sem gastar linha na tela dele.
 *
 * A regra que fica: **o chat leva o que exige decisão dele; o painel leva o
 * estado.** Aviso que só um agente resolve não ocupa a conversa.
 */
const lembreteRota = `Método Routia: sua rota ainda está marcada 🔴 ocupada em ${quadro}\n`
  + minhas.map((l) => `  ${l}`).join('\n')
  + `\nSe terminou, edite o arquivo e troque por 🟢 livre.`

if (textoPedidos) {
  /* Pedido pendente é alguém travado esperando ELE. Isso continua na conversa. */
  process.stdout.write(JSON.stringify({ systemMessage: textoPedidos }))
} else {
  process.stderr.write(`${lembreteRota}\n`)
}
process.exit(0)
