// todo-guard — não deixa o agente encerrar dizendo "entregue" com to-do aberto.
//
// Por que existe: em 2026-08-08, cinco jobs entregues tinham 0 de 34 tarefas
// marcadas como feitas. A causa era o protocolo, que pedia `todos` ao começar e
// não pedia ao entregar — mas texto corrigido é lembrete, e lembrete compete
// com outras duzentas linhas de instrução. A aba de preço mede tempo por tarefa
// concluída: lista em aberto num agente entregue é métrica perdida.
//
// Como funciona: no Stop, chama `cc check`, que só reclama quando o agente
// ESCREVEU no próprio status que entregou. O `state` do CLI vira "done" ao fim
// de cada turno, então usá-lo cobraria a cada resposta.
//
// Princípios (os mesmos do rota-guard):
//   - FALHA ABERTA. Qualquer erro do hook, do node ou do pacote libera.
//   - Não roda fora de job: sessão interativa comum não tem meta.json.
//   - Nunca insiste: se o Claude Code já reentrou por causa deste hook
//     (stop_hook_active), libera — senão vira laço.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { acharCC } from './acharCC.mjs'

const liberar = () => process.exit(0)

let entrada = null
try { entrada = JSON.parse(readFileSync(0, 'utf8')) } catch { entrada = null }
// Segunda passada por causa deste mesmo hook: já avisou, não avisa de novo.
if (entrada?.stop_hook_active) liberar()
if (!process.env.CLAUDE_JOB_DIR) liberar()

/* Era um caminho fixo do npm global do Windows: em Linux o arquivo não existe,
   então esta trava liberava sempre, calada, em toda máquina que não fosse o PC
   dele. Ver `acharCC.mjs`, que guarda a busca e a história. */
const CC = acharCC()
if (!CC) liberar()

let r
try {
  r = spawnSync(process.execPath, [CC, 'check'], { encoding: 'utf8', timeout: 5000 })
} catch {
  liberar()
}
if (!r || r.status !== 2 || !r.stderr) liberar()

// exit 2 no Stop devolve o stderr ao modelo e o faz continuar em vez de parar.
process.stderr.write(r.stderr)
process.exit(2)
