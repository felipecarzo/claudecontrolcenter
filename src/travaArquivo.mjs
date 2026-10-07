/**
 * CC-847 (Nisaba): trava de arquivo durante a micro tarefa.
 *
 * Decisão dele em 01/10: só os arquivos declarados pela micro tarefa, e
 * "prefiro que seja trava ao invés de regra escrita, regra pode não ser
 * seguida". Medido no mesmo dia: uma edição minha no meio de uma tarefa do
 * maestro foi atribuída ao agente, a tarefa reprovou e a minha linha sumiu.
 *
 * A trava mora num arquivo da máquina (fora de ~/.claude, que é somente
 * leitura no sandbox), por caminho ABSOLUTO, com dono e prazo. Quem morde:
 *   - hooks/edicao-guard.mjs, antes de Edit/Write nas sessões do Claude;
 *   - hooks/opencode-prumo.mjs, antes de editar nos agentes do opencode.
 * O dono é `gate:<conversa>`: o agente daquela conversa passa
 * (CC_TRAVA_DONO no ambiente), qualquer outro é recusado.
 * Prazo vencido não trava: maestro morto não deixa o projeto preso.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const arqTravas = () => process.env.CC_TRAVAS_ARQ || path.join(os.homedir(), '.local', 'share', 'agent-cockpit', 'travas.json')
const real = (p) => { try { return fs.realpathSync(p) } catch { return path.resolve(p) } }

function lerTodas() {
  try { return JSON.parse(fs.readFileSync(arqTravas(), 'utf8')) } catch { return [] }
}
function gravarTodas(lista) {
  const arq = arqTravas()
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq + '.tmp', JSON.stringify(lista, null, 1)); fs.renameSync(arq + '.tmp', arq)
}

/** Trava os arquivos (caminhos relativos a `cwd`) para `dono` até `ate`. Limpa o que venceu. */
export function travar(cwd, arquivos, { dono, ate, motivo = '' }) {
  const agora = Date.now()
  const lista = lerTodas().filter((t) => t.ate > agora && t.dono !== dono)
  for (const a of arquivos) lista.push({ caminho: real(path.join(cwd, a)), dono, ate, motivo })
  gravarTodas(lista)
}

/** Solta tudo de `dono`. */
export function destravar(dono) {
  const agora = Date.now()
  gravarTodas(lerTodas().filter((t) => t.ate > agora && t.dono !== dono))
}

/** A trava que impede `quem` de editar `caminho`, ou null. */
export function travaDe(caminho, { quem = null, agora = Date.now() } = {}) {
  const alvo = real(caminho)
  return lerTodas().find((t) => t.caminho === alvo && t.ate > agora && t.dono !== quem) || null
}

export const mensagemDeTrava = (t) => `${t.caminho} está TRAVADO pelo maestro (${t.motivo || t.dono}) até ${new Date(t.ate).toTimeString().slice(0, 5)}. Uma micro tarefa está mexendo nele agora: espere ela fechar ou trabalhe em outro arquivo.`
