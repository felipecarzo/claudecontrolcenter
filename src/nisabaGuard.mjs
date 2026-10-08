/**
 * CC-851 (Nisaba): o gancho que faz toda sessão seguir o Nisaba.
 *
 * Pedido dele em 02/10: "a gente tem que fazer o gancho pra segurar que as
 * sessões sigam o Nisaba. Isso aí é importantíssimo." E a regra de fundo, dele
 * também: "prefiro que seja trava ao invés de regra escrita, regra pode não ser
 * seguida".
 *
 * Regras (as duas primeiras aqui; a terceira mora no `cc backlog fechar`):
 *   1. código só se edita com tarefa ANDANDO no projeto, mexida hoje;
 *   2. o backlog e o diário não se editam à mão: só pelo `cc backlog`;
 *   3. tarefa com conferência automática só fecha pelo robô.
 *
 * Vale em projeto que tem `docs/backlog.jsonl` e o módulo Nisaba ligado (tela
 * Projetos). Falha ABERTA: erro aqui nunca trava trabalho.
 */
import fs from 'node:fs'
import path from 'node:path'

/** A raiz do projeto do arquivo: a pasta mais próxima, subindo, que tem docs/backlog.jsonl. */
export function raizDoProjeto(arquivo) {
  let d = path.dirname(path.resolve(arquivo))
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'docs', 'backlog.jsonl'))) return d
    const cima = path.dirname(d)
    if (cima === d) return null
    d = cima
  }
  return null
}

const LIVRE = /^(docs\/|\.claude\/|\.framework\/|\.coderoom\/|assets\/)|(^|\/)(AGENTS|CLAUDE|README|HANDOFF)\.md$|\.md$/i
const BACKLOG = /^docs\/(backlog|eventos)\.jsonl$/

/**
 * Pode editar `arquivo`? Devolve `{ bloquear, motivo }`.
 * `ligado(projeto)` diz se o módulo Nisaba vale no projeto (padrão: ligado).
 */
// o dia local, o mesmo do "mexido" do backlog (diaLocal): em UTC, das 21h à meia-noite de Brasília nada contava como hoje
export function avaliarEdicao(arquivo, { hoje = new Date().toLocaleDateString('sv'), ligado = () => true } = {}) {
  const raiz = raizDoProjeto(arquivo)
  if (!raiz) return { bloquear: false }
  const projeto = path.basename(raiz)
  if (!ligado(projeto)) return { bloquear: false }
  const rel = path.relative(raiz, path.resolve(arquivo)).split(path.sep).join('/')
  if (BACKLOG.test(rel)) {
    return { bloquear: true, motivo: `NISABA: ${rel} não se edita à mão. Use o comando, que aplica as regras: node ~/projetos/VPS_cockpit/cc.mjs backlog (novo, mover, especificar, debate, conferir), rodado dentro de ${raiz}.` }
  }
  if (LIVRE.test(rel)) return { bloquear: false }
  let andando = []
  try {
    andando = fs.readFileSync(path.join(raiz, 'docs', 'backlog.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)
      .flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
      .filter((x) => x.estado === 'EM' && x.mexido === hoje)
  } catch { return { bloquear: false } }
  if (andando.length) return { bloquear: false }
  return {
    bloquear: true,
    motivo: `NISABA: nenhuma tarefa ANDANDO hoje em ${projeto}, e código só se mexe com o pedido registrado. Antes de editar ${rel}, dentro de ${raiz}:\n`
      + `  tarefa nova:     node ~/projetos/VPS_cockpit/cc.mjs backlog novo "<o que vai fazer>" --estado EM --natureza PED|DEF --area <area> --tamanho P|M|G --pronto "<o que se observa pronto>" --conferir "auto:...|olho:...|dele:..."\n`
      + `  tarefa que existe: node ~/projetos/VPS_cockpit/cc.mjs backlog mover <ID> --para EM\n`
      + `(desligar o Nisaba neste projeto: tela Projetos do cockpit)`,
  }
}
