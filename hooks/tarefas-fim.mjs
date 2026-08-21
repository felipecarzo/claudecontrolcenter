#!/usr/bin/env node
/**
 * CC-232, metade de baixo: nada que dependa dele termina fora da lista dele.
 *
 * ## O defeito exato que isto conserta, medido em 21/08
 *
 * A sessão de 20/08 encerrou com cinco bloqueios gravados no próprio cartão —
 * conferir os apontamentos, decidir sobre a tela antiga, avaliar os nomes dos
 * papéis, consertar o dono de uma pasta na VPS. Tudo correto, tudo registrado.
 * E **nenhum deles chegou na lista de tarefas dele**: a lista mostrava outras
 * quatro coisas, de uma semana antes.
 *
 * Ele abriu o painel e perguntou se estavam lá, "pq deveriam estar, né?".
 *
 * O bloqueio no cartão morre com a sessão (o CLI apaga job antigo: em 08/08
 * restavam 9 de semanas de trabalho). A lista dele sobrevive. Escrever só no
 * cartão é escrever na areia.
 *
 * ## Por que este devolve, em vez de só avisar
 *
 * A armadilha registrada no `CLAUDE.md` diz que `exit 2` no `Stop` cria laço
 * quando não há nada diferente a fazer na segunda passada. **Aqui há**: o
 * agente roda `cc meu add "..."` e a volta seguinte passa. É o mesmo desenho do
 * `pergunta-guard`, e `stop_hook_active` garante que a volta é uma só.
 *
 * ## O que ele NÃO cobra
 *
 * Bloqueio que já está na lista (comparado por texto, sem acento e sem caixa,
 * a mesma regra do `cc done`), e sessão sem bloqueio nenhum. Cobrar quem já
 * registrou é o jeito mais rápido de o aviso virar ruído que se ignora.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href
const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let entrada = ''
try { entrada = readFileSync(0, 'utf8') } catch { sair() }

let dados = null
try { dados = JSON.parse(entrada) } catch { sair() }

/* A volta única: se já devolvi uma vez nesta parada, o agente já teve a chance
   de registrar. Insistir seria o laço que a armadilha descreve. */
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('tarefas-fim')) sair()

const M = await import(urlDeModulo(AQUI, '../src/meu.mjs')).catch(sair)
/* `sessoes.mjs`, não `jobs.mjs`: o primeiro rascunho chamou `readJobs()` e
   passou calado no caso real, porque a pasta de agentes de background está
   vazia nesta VPS e a sessão de ontem era interativa. É o CC-124 de volta. */
const S = await import(urlDeModulo(AQUI, '../src/sessoes.mjs')).catch(sair)

/* A conta mora em `src/tarefasProtocolo.mjs`, e não aqui, para o gate poder
   medi-la: o primeiro rascunho deste hook passou calado no caso real e só o
   teste manual pegou. */
const P = await import(urlDeModulo(AQUI, '../src/tarefasProtocolo.mjs')).catch(sair)

let jobs = []
try { jobs = S.todosOsJobs() } catch { sair() }

/* Sem saber qual sessão é a minha, não dá para cobrar: cobrar pelo bloqueio de
   OUTRO agente seria mandar eu registrar o que não é meu. */
const pendentes = P.pendenciasDe(jobs, dados?.session_id || null)
if (!pendentes.length) sair()

let tarefas = []
try {
  tarefas = M.tudo(jobs)
} catch {
  try { tarefas = M.ler().tarefas.map((t) => ({ ...t, fonte: 'lista' })) } catch { sair() }
}

const faltando = P.faltandoNaLista(pendentes, tarefas)
if (!faltando.length) sair()

const linhas = [
  `${faltando.length} COISA(S) QUE DEPENDEM DELE NÃO ESTÃO NA LISTA DELE.`,
  '',
  'Você registrou isto como bloqueio da sua sessão. O bloqueio morre quando o',
  'CLI apaga o job; a lista dele sobrevive. Em 20/08 quatro pendências foram',
  'escritas assim e ele não as viu no painel no dia seguinte.',
  '',
  'Registre cada uma antes de encerrar:',
  '',
]
for (const f of faltando) {
  const curto = f.length > 150 ? `${f.slice(0, 147)}...` : f
  linhas.push(`    cc meu add "${curto.replace(/"/g, "'")}" --porque "<por que depende dele>"`)
}
linhas.push(
  '',
  'Se alguma NÃO depende dele (é trabalho seu, ou já se resolveu), tire-a dos',
  'bloqueios da sessão em vez de registrar. Bloqueio que não é dele mente na',
  'tela igual.',
  '',
  'Esta é a única volta: a próxima passa.',
)

process.stderr.write(`${linhas.join('\n')}\n`)
process.exit(2)
