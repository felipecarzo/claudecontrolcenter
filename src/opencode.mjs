// Delegação pro opencode: disparo em background + verificação automática.
// Reimplementação em código puro do que a skill `vibecoder-opencode` hoje faz
// dentro do julgamento do Claude (decide viabilidade, dispara, espera,
// verifica) — pra virar hook em background sem gastar Claude Code.
//
// Sem `jq`: `--format json` do opencode já sai um objeto por linha; filtrar
// é `JSON.parse` + `filter` em Node puro.
//
// Escopo desta peça (CC-29, Épico 3A do backlog): só a mecânica — disparo,
// heurística, verificação. NÃO decide quando chamar (isso é CC-30, trava na
// decisão D3) nem onde o resultado fica pra revisão humana (também CC-30).
// Nada aqui fecha to-do nem edita código de projeto sozinho.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { quiet, ehWindows } from './platform.mjs'

export const MODELO_PADRAO = 'opencode/north-mini-code-free'
const PASTA_LOG = path.join(os.tmpdir(), 'cc-opencode')

/**
 * Dispara `opencode run` e devolve na hora, sem esperar terminar. Falha de
 * rede (os modelos `*-free` não são locais, cada chamada depende de
 * internet) é tratada como falha aberta: quem chamou nunca trava, só recebe
 * `ok: false`.
 *
 * Feito pra ser chamado de DENTRO do processo do painel (`cc.mjs
 * --web-only`, sempre no ar) — nunca de um script avulso que termina na
 * hora. Isso não é só preferência de design: é o que faz a captura de saída
 * funcionar de verdade no Windows.
 *
 * **Achado testando contra binário e cenário reais, não só fake nos
 * testes**: `detached: true` no Windows quebra a herança do descritor de
 * arquivo cru usado pra capturar a saída — o processo chega a subir (o
 * `opencode` de verdade respondeu em segundos, testado via CLI direto), mas
 * o log fica sempre vazio, mesmo esperando bem mais que o tempo real da
 * tarefa. Isolado por eliminação (várias combinações testadas: com/sem
 * `unref`, via PowerShell e via Git Bash, com sandbox desligado): a causa
 * não é `detached` nem `unref` isolados — é o **processo Node que chamou
 * `spawn` sair antes do filho terminar**. Com `detached: true` isso quase
 * sempre acontece (é o padrão de uso: dispara e sai). Sem `detached`
 * (default `false`) e sem `unref`, o Node espera o filho sozinho — e a
 * captura funciona. Por isso aqui não se usa nem um nem outro: o processo
 * chamador (o painel) já não sai sozinho durante uso normal, então não
 * precisa de nenhum dos dois pra "sobreviver" — só looks like it needed
 * detached porque os primeiros testes eram scripts de uma linha que saíam
 * na hora, não o painel de verdade.
 *
 * No Windows, o binário global do `opencode` (como o do `cc`) é um `.cmd` do
 * npm — `spawn()` direto nunca sobe esses, sem erro visível. A saída ÓBVIA
 * (`shell: true`) é insegura aqui: o Node avisa que `args` junto de
 * `shell: true` concatena sem escapar — e `prompt` é texto arbitrário, isso
 * seria injeção de comando de verdade. Em vez disso, o mesmo padrão já usado
 * em `lancarComando` (`platform.mjs`): invoca `cmd.exe` DIRETO como
 * executável (sem `shell: true`), com `/c` e o resto como elementos
 * separados do array — Node escapa cada argumento sozinho ao montar a linha
 * de comando do Windows, o `prompt` nunca é interpretado pelo shell.
 *
 * Quem quer saber quando terminou olha o arquivo: cresce enquanto roda, para
 * de crescer quando o processo morre. Sem callback de conclusão de propósito
 * — resolver "sei que acabou" é problema da fila de revisão (CC-30), não
 * desta peça. Se o painel reiniciar no meio de uma tarefa em andamento, ela
 * morre junto — aceitável: reinício é ação explícita e rara, e perder uma
 * tarefa nesse caso é melhor que nunca capturar saída nenhuma.
 *
 * `binario` existe pra teste (aponta pra um comando qualquer no lugar de
 * `opencode`) — nunca precisa mudar em uso real.
 */
export function dispararTarefa(prompt, { cwd = process.cwd(), modelo = MODELO_PADRAO, binario = 'opencode' } = {}) {
  fs.mkdirSync(PASTA_LOG, { recursive: true })
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const logFile = path.join(PASTA_LOG, `${id}.jsonl`)

  const args = ['run', '--model', modelo, '--format', 'json', prompt]
  const [cmd, cmdArgs] = ehWindows ? ['cmd', ['/c', binario, ...args]] : [binario, args]

  try {
    const saida = fs.openSync(logFile, 'a')
    const filho = spawn(cmd, cmdArgs, {
      cwd, stdio: ['ignore', saida, saida], windowsHide: true,
    })
    filho.on('error', () => { /* falha aberta: binário ausente não pode derrubar quem chamou */ })
    fs.closeSync(saida)
    // No Windows, `pid` é do `cmd.exe` que embrulha o binário, não do
    // `opencode` em si — mas serve igual pra saber se "a coisa toda" ainda
    // roda: `cmd /c` só sai depois que o comando embrulhado terminar.
    return { id, logFile, pid: filho.pid, ok: true }
  } catch (e) {
    return { id, logFile, ok: false, erro: String(e.message || e) }
  }
}

/**
 * Lê o log e filtra só os eventos `tool_use` — sem `jq`, um `JSON.parse` por
 * linha. A skill `vibecoder-opencode` faz isso com `jq -c 'select(...)'`, mas
 * exigir `jq` instalado contraria o "zero dependência" do projeto.
 */
export function lerEventos(logFile) {
  let texto
  try { texto = fs.readFileSync(logFile, 'utf8') } catch { return [] }
  const eventos = []
  for (const linha of texto.split('\n')) {
    if (!linha.trim()) continue
    let obj
    try { obj = JSON.parse(linha) } catch { continue }
    if (obj?.type === 'tool_use') {
      eventos.push({ tool: obj.part?.tool, arquivo: obj.part?.state?.input?.filePath })
    }
  }
  return eventos
}

/**
 * Heurística de viabilidade, réplica simplificada da tabela da skill
 * `vibecoder-opencode` — primeira versão, corrigível depois de uso real:
 * boilerplate/<20 linhas → ALTA, 20-50 → MÉDIA, >50 ou refactor → BAIXA.
 */
export function viavel(descricaoTarefa, { arquivoExistente, linhasEsperadas } = {}) {
  const texto = String(descricaoTarefa || '').toLowerCase()
  if (/refactor|reescrev|redesenh|l[óo]gica condicional complex/.test(texto)) return 'BAIXA'

  let linhas = Number(linhasEsperadas)
  if (!Number.isFinite(linhas) && arquivoExistente) {
    try { linhas = fs.readFileSync(arquivoExistente, 'utf8').split('\n').length } catch { linhas = 0 }
  }
  if (!Number.isFinite(linhas)) linhas = 0

  if (linhas > 50) return 'BAIXA'
  if (linhas > 20) return 'MEDIA'
  return 'ALTA'
}

/**
 * Verificação pós-hoc: sintaxe válida do arquivo que a tarefa deveria ter
 * tocado. Só `.mjs`/`.js`/`.cjs` por enquanto — `node --check` nativo, sem
 * dependência nova. Extensão sem verificador conhecido passa como `ok`, sem
 * fingir que checou o que não sabe checar.
 */
export function verificar(arquivo) {
  if (!fs.existsSync(arquivo)) return { ok: false, motivo: 'arquivo não existe' }
  if (!/\.(m?js|cjs)$/i.test(arquivo)) return { ok: true, motivo: 'sem verificador pra esta extensão' }
  const r = quiet('node', ['--check', arquivo])
  return r.ok ? { ok: true, motivo: 'sintaxe válida' } : { ok: false, motivo: r.out }
}
