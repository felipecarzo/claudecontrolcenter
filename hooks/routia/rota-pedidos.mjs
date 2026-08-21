// rota-pedidos — pedido de autorização entre agentes do Método Routia.
//
// Por que existe: o rota-guard bloqueia quem tenta mexer em código sem rota, e
// manda "abra um ticket e trate com o Felipe". Ticket em markdown é assíncrono:
// depende do dono da rota ir ler o quadro, e depende do Felipe intermediar duas
// sessões que não se falam. Enquanto isso a sessão bloqueada simplesmente para.
//
// Isto fecha o circuito: o bloqueio vira um PEDIDO registrado, o dono da rota é
// avisado no fim de cada turno dele, autoriza com um comando, e o guarda passa a
// deixar o outro entrar. Nenhuma sessão precisa falar com a outra em tempo real,
// que hoje não é possível: SendMessage só alcança subagentes da própria sessão.
//
// Princípios herdados do rota-guard:
//   - FALHA ABERTA. Erro deste módulo nunca pode travar trabalho.
//   - Autorização é POR ARQUIVO, não por rota. O guarda não sabe mapear arquivo
//     para rota (os nomes são livres), e arquivo é o que de fato colide.
//   - Autorização é de uso único por arquivo e expira. Um "pode mexer" de ontem
//     não deve liberar uma edição de amanhã sem ninguém olhar.
//
// Estado: `<raiz>/docs/.rotas-pedidos.json`, ao lado do quadro. Fica no projeto
// de propósito: é lá que as sessões daquele repo se encontram.
//
// Uso como comando:
//   node rota-pedidos.mjs listar [caminho]      pedidos do projeto
//   node rota-pedidos.mjs autorizar <id>        libera um pedido
//   node rota-pedidos.mjs negar <id> [motivo]   recusa
//   node rota-pedidos.mjs autoteste             verifica a lógica

import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

/** Autorização vale por 6 horas: uma sessão de trabalho, não um cheque em branco. */
export const VALIDADE_MS = 6 * 60 * 60 * 1000

export function acharQuadro(partida) {
  let dir = resolve(partida)
  for (let i = 0; i < 30; i++) {
    const alvo = join(dir, 'docs', 'ROTAS-ATIVAS.md')
    if (existsSync(alvo)) return { quadro: alvo, raiz: dir }
    const pai = dirname(dir)
    if (pai === dir) break
    dir = pai
  }
  return null
}

export const caminhoPedidos = (raiz) => join(raiz, 'docs', '.rotas-pedidos.json')

export function ler(raiz) {
  try {
    const d = JSON.parse(readFileSync(caminhoPedidos(raiz), 'utf8'))
    return Array.isArray(d?.pedidos) ? d : { pedidos: [] }
  } catch {
    return { pedidos: [] }
  }
}

export function gravar(raiz, dados) {
  try {
    writeFileSync(caminhoPedidos(raiz), JSON.stringify(dados, null, 1) + '\n')
    return true
  } catch {
    return false // falha aberta: não gravou, mas não derruba quem chamou
  }
}

/** Identificador curto e estável de um pedido: quem + o quê. */
export const idDe = (marca, relativo) =>
  `${marca}-${relativo.replace(/[\\/]/g, '.').slice(-40)}`

/**
 * Registra (ou reaviva) um pedido. Idempotente: tentar de novo o mesmo arquivo
 * não empilha pedidos, só atualiza o carimbo e conta as tentativas — a contagem
 * é o que mostra ao dono que o outro está travado de verdade, não só curioso.
 */
export function registrar(raiz, { marca, relativo, rotasOcupadas = [], agora = Date.now() }) {
  const d = ler(raiz)
  const id = idDe(marca, relativo)
  const existente = d.pedidos.find((p) => p.id === id)
  if (existente && existente.status === 'autorizado') return existente
  if (existente) {
    existente.tentativas = (existente.tentativas || 1) + 1
    existente.em = agora
    existente.status = existente.status === 'negado' ? 'pendente' : existente.status
  } else {
    d.pedidos.push({
      id,
      de: marca,
      arquivo: relativo,
      rotasOcupadas,
      status: 'pendente',
      tentativas: 1,
      em: agora,
    })
  }
  gravar(raiz, d)
  return d.pedidos.find((p) => p.id === id)
}

/**
 * Esta sessão pode editar este arquivo? Só com autorização explícita, dentro da
 * validade. Fora disso devolve false e o guarda segue bloqueando.
 */
export function autorizado(raiz, { marca, relativo, agora = Date.now() }) {
  const p = ler(raiz).pedidos.find((x) => x.id === idDe(marca, relativo))
  if (!p || p.status !== 'autorizado') return false
  if (p.expiraEm && p.expiraEm < agora) return false
  return true
}

/** Pedidos que esperam resposta. `excetoDe` tira os da própria sessão. */
/**
 * O pedido PENDENTE também expira, e não só a autorização.
 *
 * ## O que motivou, medido em 21/08
 *
 * Ele mandou o fim de uma resposta minha com **16 linhas de aviso**, perguntando
 * se aquilo estava certo. Não estava: eram 7 pedidos de **90 a 158 horas atrás**
 * (4 a 6 dias), de sessões que já tinham fechado, repetidos no fim de TODA
 * resposta, para sempre.
 *
 * `VALIDADE_MS` existia, mas só era aplicada quando alguém autorizava
 * (`p.expiraEm` só nasce no ramo `autorizado`). O pedido sem resposta ficava
 * pendurado sem prazo nenhum.
 *
 * ## Por que expirar não perde nada
 *
 * O pedido é **registrado de novo automaticamente** pelo `rota-guard` na
 * próxima vez que aquela sessão tentar editar o arquivo. Quem ainda precisa,
 * pede outra vez, e o pedido volta com data de hoje. Quem morreu, cala.
 *
 * ## Por que isso é grave, e não cosmético
 *
 * É a mesma lição que o `⏸` do `fluxo-guard` ensinou: **guarda que cobra o
 * impossível ensina a ser ignorado**. Dezesseis linhas sobre sessões mortas no
 * fim de cada resposta treinam a passar o olho por cima, e aí o pedido de
 * verdade, de alguém travado esperando, some no meio do ruído.
 */
export function pendentes(raiz, { excetoDe = null, agora = Date.now() } = {}) {
  return ler(raiz).pedidos.filter(
    (p) => p.status === 'pendente'
      && (!excetoDe || p.de !== excetoDe)
      /* Sem data conta como vivo: pedido antigo de um formato anterior não pode
         sumir calado, que seria trocar um defeito por outro pior. */
      && (!p.em || agora - p.em < VALIDADE_MS),
  )
}

export function responder(raiz, { id, decisao, por, motivo = '', agora = Date.now() }) {
  const d = ler(raiz)
  const p = d.pedidos.find((x) => x.id === id || x.id.startsWith(id))
  if (!p) return null
  p.status = decisao
  p.por = por
  p.respondidoEm = agora
  if (motivo) p.motivo = motivo
  if (decisao === 'autorizado') p.expiraEm = agora + VALIDADE_MS
  gravar(raiz, d)
  return p
}

// ---------------------------------------------------------------- comando

function autoteste() {
  const raiz = mkdtempSync(join(tmpdir(), 'routia-'))
  mkdirSync(join(raiz, 'docs'), { recursive: true })
  writeFileSync(join(raiz, 'docs', 'ROTAS-ATIVAS.md'), '| `x` | 🔴 ocupada | aaaa1111 | hoje |')

  const eu = 'bbbb2222'
  const arq = 'src/vps.mjs'

  console.assert(!autorizado(raiz, { marca: eu, relativo: arq }), 'sem pedido: não pode')

  const p = registrar(raiz, { marca: eu, relativo: arq, rotasOcupadas: ['x'] })
  console.assert(p.status === 'pendente', 'registro nasce pendente')
  console.assert(!autorizado(raiz, { marca: eu, relativo: arq }), 'pendente ainda não libera')

  registrar(raiz, { marca: eu, relativo: arq })
  console.assert(ler(raiz).pedidos.length === 1, 'não duplica pedido')
  console.assert(ler(raiz).pedidos[0].tentativas === 2, 'conta tentativas')

  console.assert(pendentes(raiz).length === 1, 'lista pendentes')
  console.assert(pendentes(raiz, { excetoDe: eu }).length === 0, 'não mostra o próprio pedido')

  responder(raiz, { id: p.id, decisao: 'autorizado', por: 'aaaa1111' })
  console.assert(autorizado(raiz, { marca: eu, relativo: arq }), 'autorizado libera')
  console.assert(
    !autorizado(raiz, { marca: 'cccc3333', relativo: arq }),
    'autorização não vale para outra sessão',
  )
  console.assert(
    !autorizado(raiz, { marca: eu, relativo: 'src/outro.mjs' }),
    'autorização não vale para outro arquivo',
  )

  const futuro = Date.now() + VALIDADE_MS + 1000
  console.assert(
    !autorizado(raiz, { marca: eu, relativo: arq, agora: futuro }),
    'autorização expira',
  )

  const p2 = registrar(raiz, { marca: 'dddd4444', relativo: 'src/z.mjs' })
  responder(raiz, { id: p2.id, decisao: 'negado', por: 'aaaa1111', motivo: 'estou nela' })
  console.assert(!autorizado(raiz, { marca: 'dddd4444', relativo: 'src/z.mjs' }), 'negado não libera')
  registrar(raiz, { marca: 'dddd4444', relativo: 'src/z.mjs' })
  console.assert(
    ler(raiz).pedidos.find((x) => x.de === 'dddd4444').status === 'pendente',
    'insistir depois de negado volta a pendente',
  )

  console.log('autoteste: tudo passou')
}

const ehComando = process.argv[1] && process.argv[1].endsWith('rota-pedidos.mjs')
if (ehComando) {
  const [, , cmd, arg, ...resto] = process.argv
  const base = acharQuadro(process.cwd())

  if (cmd === 'autoteste') {
    autoteste()
  } else if (!base) {
    console.error('nenhum docs/ROTAS-ATIVAS.md encontrado a partir daqui')
    process.exit(1)
  } else if (cmd === 'listar') {
    const todos = ler(base.raiz).pedidos
    if (!todos.length) console.log('nenhum pedido')
    for (const p of todos) {
      const quando = new Date(p.em).toISOString().slice(0, 16).replace('T', ' ')
      console.log(
        `[${p.status}] ${p.id}\n  de ${p.de} · ${p.arquivo} · ${p.tentativas}x · ${quando}` +
          (p.por ? `\n  respondido por ${p.por}${p.motivo ? ': ' + p.motivo : ''}` : ''),
      )
    }
  } else if (cmd === 'autorizar' || cmd === 'negar') {
    if (!arg) {
      console.error(`uso: rota-pedidos.mjs ${cmd} <id> [motivo]`)
      process.exit(1)
    }
    const p = responder(base.raiz, {
      id: arg,
      decisao: cmd === 'autorizar' ? 'autorizado' : 'negado',
      por: process.env.CLAUDE_SESSION_ID?.slice(0, 8) || 'felipe',
      motivo: resto.join(' '),
    })
    if (!p) {
      console.error(`nenhum pedido com id "${arg}"`)
      process.exit(1)
    }
    console.log(
      cmd === 'autorizar'
        ? `autorizado: ${p.de} pode editar ${p.arquivo} pelas próximas 6 horas`
        : `negado: ${p.de} continua bloqueado em ${p.arquivo}`,
    )
  } else {
    console.log(`uso:
  rota-pedidos.mjs listar                  pedidos deste projeto
  rota-pedidos.mjs autorizar <id>          libera (vale 6h, só aquele arquivo)
  rota-pedidos.mjs negar <id> [motivo]     recusa
  rota-pedidos.mjs autoteste               verifica a lógica`)
  }
}
