/**
 * CC-262: como saber, sozinho, que uma tarefa DELE já foi resolvida.
 *
 * Pedido dele em 21/08: *"na aba de trabalho, em o que só você resolve, você
 * poderia checar o que não precisa mais ser resolvido? E o melhor, a gente
 * consegue colocar 1 hook pra garantir que essas tarefas que só eu resolvo sejam
 * revisadas no início de toda a sessão pra ver se elas já foram resolvidas?"*.
 *
 * ## O que a revisão manual encontrou, e por que isso justifica automatizar
 *
 * Das 8 pendências dele, **duas já estavam feitas havia dias** e ninguém sabia:
 * ligar o PC na federação (o pacote chegou) e autorizar o `KillMode=process`
 * (já está no serviço). Uma terceira mudou de estado sem aviso: o Pixel Agents
 * do Telegram saiu do ar, então a decisão sobre ele mudou de assunto.
 *
 * Lista que não se revisa apodrece, e lista podre ensina a ser ignorada. É a
 * mesma lição do `⏸` e do prazo dos pedidos de rota, pela terceira vez.
 *
 * ## O contrato de uma prova
 *
 * A prova é DADO, no molde do `bancadaCatalogo.mjs` e do `hooksCatalogo.mjs`:
 * um texto curto, guardado junto da tarefa, dizendo o que observar no mundo.
 *
 *     porta:3100            algo escutando naquela porta
 *     arquivo:src/ui.html   o arquivo existe
 *     semarquivo:x.md       o arquivo NÃO existe mais
 *     escreve:tools         dá para escrever naquela pasta
 *     servico:agent-cockpit=KillMode=process   a diretiva está no unit
 *     federou:ALIENWARE-LIPE  aquela máquina já mandou pacote
 *
 * ## A regra que decide o desenho: prova só ACUSA, nunca fecha
 *
 * Nenhuma prova marca tarefa como resolvida sozinha. Ela levanta a mão e ele
 * decide, porque *só ele fecha tarefa dele* (CC-232), e porque uma prova pode
 * estar certa sobre o mundo e errada sobre a intenção: o Pixel Agents fora do ar
 * pode ser exatamente o que ele queria, ou pode ser o serviço caído.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { casaClaude } from './platform.mjs'

const quieto = (cmd, args) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return '' }
}

/**
 * Onde procurar um caminho relativo, e quando desistir de procurar.
 *
 * ## O falso positivo que isto conserta, achado em 21/08 na primeira rodada
 *
 * A prova `semarquivo:src/ui.html` respondeu **"não existe mais: sim"** com o
 * arquivo lá, de 491 KB. Motivo: o painel roda como serviço com
 * `WorkingDirectory=/home/claudedev`, então o caminho virava
 * `/home/claudedev/src/ui.html`, que de fato não existe.
 *
 * **A prova estava certa sobre o lugar errado**, e ia mandar ele fechar uma
 * tarefa que não estava feita. Numa lista que existe para ele confiar, esse é o
 * pior defeito possível.
 *
 * Duas travas, e a segunda é a que importa:
 *
 * 1. resolve contra a raiz do PROJETO da tarefa quando ela tem uma;
 * 2. **se a pasta que conteria o arquivo não existe, devolve `null`**, e não
 *    "sumiu". Não achar o alvo é não saber olhar, nunca uma resposta.
 */
function ondeOlhar(rel, { raiz, raizDoProjeto } = {}) {
  if (path.isAbsolute(rel)) return rel
  const bases = [raizDoProjeto, raiz].filter(Boolean)
  for (const b of bases) {
    const alvo = path.resolve(b, rel)
    /* A pasta pai existir é o que separa "o arquivo sumiu" de "olhei no lugar
       errado". Sem isto, qualquer caminho digitado torto vira "resolvido". */
    if (fs.existsSync(path.dirname(alvo))) return alvo
  }
  return null
}

/**
 * Cada tipo de prova: como se lê, e o que a resposta quer dizer.
 *
 * `checar` devolve `true` (parece resolvida), `false` (segue pendente) ou
 * `null` (não consegui olhar). **Os três são diferentes**, e transformar `null`
 * em `false` seria o defeito que este painel persegue o tempo todo.
 */
export const PROVAS = {
  porta: {
    explica: 'algo está escutando naquela porta',
    checar: (arg) => {
      const saida = quieto('ss', ['-lntH'])
      if (!saida) return null
      return new RegExp(`:${String(arg).replace(/\D/g, '')}\\s`).test(saida)
    },
  },
  semporta: {
    explica: 'NADA está escutando naquela porta',
    checar: (arg) => {
      const r = PROVAS.porta.checar(arg)
      return r === null ? null : !r
    },
  },
  arquivo: {
    explica: 'o arquivo existe',
    checar: (arg, ctx) => {
      const alvo = ondeOlhar(arg, ctx)
      return alvo === null ? null : fs.existsSync(alvo)
    },
  },
  semarquivo: {
    explica: 'o arquivo não existe mais',
    checar: (arg, ctx) => {
      const alvo = ondeOlhar(arg, ctx)
      return alvo === null ? null : !fs.existsSync(alvo)
    },
  },
  escreve: {
    explica: 'dá para escrever naquela pasta sem senha de administrador',
    checar: (arg, ctx) => {
      const alvo = ondeOlhar(arg, ctx)
      if (alvo === null || !fs.existsSync(alvo)) return null
      const teste = path.join(alvo, `.prova-${process.pid}`)
      try { fs.writeFileSync(teste, ''); fs.unlinkSync(teste); return true } catch { return false }
    },
  },
  servico: {
    explica: 'a diretiva está no serviço do sistema',
    checar: (arg) => {
      const [nome, ...resto] = String(arg).split('=')
      const procurado = resto.join('=')
      const unit = quieto('systemctl', ['cat', nome])
      if (!unit) return null
      return unit.split(/\r?\n/).some((l) => l.trim() === procurado.trim())
    },
  },
  federou: {
    explica: 'aquela máquina já mandou pacote para este painel',
    checar: (arg) => {
      const dir = path.join(casaClaude(), 'control-center-federacao')
      let nomes = []
      try { nomes = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')) } catch { return null }
      for (const n of nomes) {
        try {
          const p = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))
          if (String(p.maquina?.nome || '').toLowerCase() === String(arg).toLowerCase()) return true
        } catch { /* pacote quebrado não é resposta */ }
      }
      return false
    },
  },
}

/** `porta:3100` vira `{ tipo, arg }`. Prova desconhecida devolve `null` em vez
 *  de estourar: texto digitado à mão erra, e errar não pode calar a lista. */
export function lerProva(texto) {
  const t = String(texto || '').trim()
  if (!t) return null
  const i = t.indexOf(':')
  if (i < 1) return null
  const tipo = t.slice(0, i).toLowerCase()
  const arg = t.slice(i + 1).trim()
  return PROVAS[tipo] ? { tipo, arg } : null
}

/**
 * Revisa a lista dele e diz o que PARECE resolvido.
 *
 * Devolve por tarefa: `resolvida` (true/false/null) e a frase do que foi
 * observado. Nunca marca nada: quem fecha é ele.
 */
export function revisar(tarefas = [], { raiz = process.cwd(), raizDe = null } = {}) {
  const saida = []
  for (const t of tarefas) {
    if (t.feito) continue
    const p = lerProva(t.prova)
    if (!p) { saida.push({ ...t, resolvida: null, comoSoube: t.prova ? `não conheço a prova "${t.prova}"` : null }); continue }
    /* A raiz do PROJETO da tarefa vem primeiro: o painel roda como serviço numa
       pasta que não é projeto nenhum, e sem isto todo caminho relativo cairia
       no lugar errado. */
    const raizDoProjeto = typeof raizDe === 'function' ? raizDe(t.projeto) : null
    let r = null
    try { r = PROVAS[p.tipo].checar(p.arg, { raiz, raizDoProjeto }) } catch { r = null }
    saida.push({
      ...t,
      resolvida: r,
      comoSoube: r === null
        ? `não consegui checar (${p.tipo}: ${p.arg})`
        : `${PROVAS[p.tipo].explica}: ${r ? 'sim' : 'não'} (${p.arg})`,
    })
  }
  return saida
}
