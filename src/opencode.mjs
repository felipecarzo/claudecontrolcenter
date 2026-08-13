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

// north-mini-code-free (recomendado pela skill vibecoder-opencode) deu erro
// de servidor nas duas vezes testadas em 12/08 — confirmado via CLI direto,
// não é bug daqui. opencode/big-pickle respondeu de primeira, custo 0,
// testado ponta a ponta criando arquivo de verdade. Sujeito a mudar de novo
// se a lista de modelos gratuitos do opencode mudar — `opencode models`
// mostra a atual.
export const MODELO_PADRAO = 'opencode/big-pickle'
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
 * O texto final da resposta, não `tool_use`: é o que o modelo escreveu.
 * Schema confirmado com chamada real em 13/08:
 * `{"type":"text","part":{"type":"text","text":"..."}}`, podendo vir em
 * mais de um evento (streaming); concatena em ordem.
 */
export function lerResposta(logFile) {
  let texto
  try { texto = fs.readFileSync(logFile, 'utf8') } catch { return '' }
  let out = ''
  for (const linha of texto.split('\n')) {
    if (!linha.trim()) continue
    let obj
    try { obj = JSON.parse(linha) } catch { continue }
    if (obj?.type === 'text' && typeof obj.part?.text === 'string') out += obj.part.text
  }
  return out
}

/**
 * CC-36: pede pro opencode explicar os to-dos de um agente: título mais
 * claro, resumo, e (melhor esforço) qual arquivo a tarefa provavelmente
 * mexe. **Roda em pasta neutra** (nunca o cwd do projeto): todos os agentes
 * do opencode neste setup têm `permission:*`, nenhum é read-only, então
 * deixá-lo entrar no projeto de verdade seria dar permissão de escrita a uma
 * chamada que só deveria descrever texto. O preço é que "qual arquivo" vira
 * inferência do texto do to-do, não inspeção real: o prompt avisa isso.
 */
export function promptEnriquecimento(todos) {
  const lista = todos.map((t, i) => `${i + 1}. ${t}`).join('\n')
  return [
    // Achado testando de verdade em 13/08: sem este aviso, respostas
    // anteriores da mesma sessão do opencode vazam pro contexto, e o modelo
    // respondeu "tenho acesso real aos arquivos" (falso: cwd é pasta neutra,
    // confirmado com pwd de verdade) em vez de seguir o formato pedido.
    'Ignore qualquer contexto de sessão anterior. Esta é uma tarefa nova e',
    'isolada, sem relação com pedidos passados.',
    '',
    'Você não tem acesso a nenhum arquivo ou projeto real. Responda só com',
    'o que der pra inferir do texto abaixo. Cada linha é uma tarefa de um',
    'agente de programação. Para cada uma, produza título mais claro, resumo',
    'de uma frase, e um palpite de qual arquivo ou pasta ela provavelmente',
    'mexe. Sem indício nenhum, use null; nunca invente um caminho.',
    '',
    lista,
    '',
    'Responda SÓ com um JSON válido, sem markdown ao redor, no formato:',
    '{"1": {"titulo": "...", "resumo": "...", "arquivo": "..." ou null}, "2": {...}}',
  ].join('\n')
}

/**
 * Dispara, espera o log parar de crescer (processo terminou) e devolve o
 * mapa `texto do to-do -> {titulo, resumo, arquivos}` já no formato de
 * `explicacoes` do `meta.json`. Uma chamada por AGENTE, nunca por tarefa:
 * é o `todos` inteiro numa só ida ao opencode.
 *
 * `esperarMs`/`intervaloMs` existem pro teste não esperar o tempo real.
 *
 * **Achado testando de verdade em 13/08**: `opencode run` guarda sessão por
 * pasta e a retoma sozinho, mesmo sem `--continue`. Chamar duas vezes com o
 * mesmo `cwd` fez a segunda vir quase toda do cache da primeira (49280 de
 * 49469 tokens), e o modelo respondeu "sessão zerada, pode mandar a tarefa"
 * em vez de processar o pedido que já estava no mesmo prompt: tratou o aviso
 * de "ignore o contexto" como um turno de conversa, não como prefixo do
 * pedido de verdade. Por isso `cwd` default é uma pasta NOVA a cada
 * chamada, nunca `os.tmpdir()` reusado.
 */
export async function enriquecerTodos(todos, {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-enriquecer-')),
  esperarMs = 60_000, intervaloMs = 500, binario = 'opencode',
} = {}) {
  if (!todos.length) return {}
  const disparo = dispararTarefa(promptEnriquecimento(todos), { cwd, binario })
  if (!disparo.ok) return {}

  const inicio = Date.now()
  let ultimoTamanho = -1
  let estavel = 0
  while (Date.now() - inicio < esperarMs) {
    await new Promise((r) => setTimeout(r, intervaloMs))
    let tamanho = 0
    try { tamanho = fs.statSync(disparo.logFile).size } catch { /* ainda não existe */ }
    if (tamanho > 0 && tamanho === ultimoTamanho) {
      estavel++
      if (estavel >= 2) break // dois tiques sem crescer: processo morreu
    } else {
      estavel = 0
    }
    ultimoTamanho = tamanho
  }

  const resposta = lerResposta(disparo.logFile)
  let porIndice
  try {
    // modelo às vezes cerca com ```json apesar do pedido: tira antes de parsear
    porIndice = JSON.parse(resposta.replace(/^```json\s*|```\s*$/g, '').trim())
  } catch {
    return {} // resposta ilegível não é gravada: melhor sem explicação que com uma errada
  }

  const explicacoes = {}
  todos.forEach((texto, i) => {
    const e = porIndice[String(i + 1)]
    if (e && typeof e === 'object') {
      explicacoes[texto] = { titulo: e.titulo || null, resumo: e.resumo || null, arquivo: e.arquivo || null }
    }
  })
  return explicacoes
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
