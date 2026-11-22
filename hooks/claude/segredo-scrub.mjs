// segredo-scrub — redige segredos gravados no transcript.
//
// Por que existe: o transcript de cada sessão fica em texto puro em
// ~/.claude/projects/<slug>/<session-id>.jsonl. Nada expira. Um token colado
// numa sessão de fevereiro continua legível no disco em agosto, e volta pro
// contexto inteiro a cada --resume. O segredo-guard corta a entrada; este aqui
// limpa o que mesmo assim entrou.
//
// O que ele NÃO faz: não desfaz envio. O que já foi pro modelo já saiu da
// máquina. Isto reduz exposição em disco e em replay — a correção de um segredo
// realmente exposto continua sendo rotacionar.
//
// Modos:
//   (sem argumento)             modo hook: lê JSON no stdin. Em SessionEnd
//                               redige o transcript que fechou; em SessionStart
//                               redige os anteriores do mesmo projeto (rede de
//                               segurança pra sessão que morreu sem SessionEnd)
//   --varrer <dir>              relatório, não escreve nada
//   --varrer <dir> --aplicar    redige de verdade (sem backup: backup guardaria
//                               justamente o que se quer apagar)
//   --autoteste                 verifica os padrões contra casos conhecidos
//
// Princípios:
//   - FALHA ABERTA e silenciosa como hook: erro aqui nunca atrapalha a sessão.
//   - Linha que deixa de ser JSON válido depois da troca é revertida. Transcript
//     corrompido custaria mais que o segredo.
//   - Idempotente: rodar duas vezes não empilha marcações.

import { readFileSync, writeFileSync, renameSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'

// Cada padrão é ancorado em classes que EXCLUEM aspas e barra invertida, pra
// substituição nunca atravessar a fronteira de uma string JSON.
const PADROES = [
  ['chave Anthropic',   /sk-ant-[A-Za-z0-9_-]{20,}/g,                                          '[REDIGIDO:anthropic]'],
  ['chave OpenAI',      /\bsk-(?!ant-)[A-Za-z0-9]{32,}/g,                                       '[REDIGIDO:openai]'],
  ['token GitHub',      /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g,       '[REDIGIDO:github]'],
  ['chave Google',      /\bAIza[A-Za-z0-9_-]{30,}/g,                                            '[REDIGIDO:google]'],
  ['token Slack',       /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,                                      '[REDIGIDO:slack]'],
  ['chave AWS',         /\bAKIA[0-9A-Z]{16}\b/g,                                                '[REDIGIDO:aws]'],
  ['JWT / Supabase',    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,     '[REDIGIDO:jwt]'],
  ['chave privada',     /-----BEGIN [A-Z ]*PRIVATE KEY-----[^"]{0,8000}?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDIGIDO:chave-privada]'],
  // Credencial embutida em URL: preserva o esquema e o host, mata só user:senha.
  // O lookahead impede que a própria marcação (`://[REDIGIDO:credencial]@`)
  // volte a casar: ela tem a forma user:senha e faria toda auditoria posterior
  // reportar falso positivo em cima do que já foi limpo.
  ['credencial em URL', /:\/\/(?!\[REDIGIDO)[^\s"'\\/:@]{1,64}:[^\s"'\\/@]{1,120}@/g,           '://[REDIGIDO:credencial]@'],
  // Último caso é o mais frouxo de propósito: senha humana não tem formato.
  // O lookahead descarta (a) marcação de rodada anterior, pra ser idempotente,
  // e (b) referência a variável — `process.env.X` e `${SENHA}` são o NOME do
  // segredo, não o valor, e redigir isso só estragaria código legítimo.
  ['segredo nomeado',   /((?:senha|password|passwd|pwd|secret|api[_-]?key|token|access[_-]?key)["']?\s*[:=]\s*["']?)(?!\[REDIGIDO|\$|\{|<|%|process\.env|import\.meta|os\.environ|Deno\.env|config\.|settings\.|null\b|undefined\b|true\b|false\b)([^\s"'\\,;}\]]{6,})/gi, '$1[REDIGIDO]'],
]

/** Troca os segredos de uma linha. Devolve a linha e o que casou. */
function redigirLinha(linha) {
  let saida = linha
  const achados = []
  for (const [nome, re, troca] of PADROES) {
    re.lastIndex = 0
    saida = saida.replace(re, (...grupos) => {
      const casado = grupos[0]
      achados.push([nome, casado])
      // $1 preservado à mão porque o callback ignora a sintaxe de grupo.
      return troca.includes('$1') ? troca.replace('$1', grupos[1] ?? '') : troca
    })
  }
  return { saida, achados }
}

// Arquivos onde a credencial é o FUNCIONAMENTO, não um vazamento. Redigir o
// token de auth do Claude Code derrubaria o login — e um script de segurança que
// desloga o usuário vira script que o usuário desativa.
const INTOCAVEIS = /(^|[\\/])(\.credentials\.json|\.claude\.json|\.env(\..+)?)$/i

/** Redige um .jsonl inteiro. Só escreve se `aplicar`. */
function redigirArquivo(caminho, aplicar) {
  if (INTOCAVEIS.test(caminho)) return null

  let bruto
  try { bruto = readFileSync(caminho, 'utf8') } catch { return null }

  const linhas = bruto.split('\n')
  const achados = []
  let mudou = false

  for (let i = 0; i < linhas.length; i++) {
    const original = linhas[i]
    if (!original.trim()) continue
    const r = redigirLinha(original)
    if (r.saida === original) continue

    // Uma linha do transcript é um objeto JSON. Se a troca quebrou a estrutura,
    // o padrão passou por cima de aspas — descarta e mantém o original.
    try { JSON.parse(r.saida) } catch { continue }

    linhas[i] = r.saida
    mudou = true
    for (const [nome, casado] of r.achados) achados.push({ linha: i + 1, nome, casado })
  }

  if (mudou && aplicar) {
    const temporario = caminho + '.scrub-tmp'
    writeFileSync(temporario, linhas.join('\n'), 'utf8')
    renameSync(temporario, caminho)   // troca atômica, sem deixar cópia com o segredo
  }
  return achados
}

// Índice do que já foi verificado: caminho -> "tamanho:mtime". Só guarda
// metadado, nunca conteúdo — um cache de segredo seria o oposto do objetivo.
const INDICE = join(process.env.USERPROFILE || process.env.HOME || '.', '.claude', 'hooks', '.segredo-visto.json')

function lerIndice() {
  try { return JSON.parse(readFileSync(INDICE, 'utf8')) } catch { return {} }
}

function gravarIndice(dados) {
  // Escrita atômica: duas sessões abrindo juntas não deixam índice pela metade.
  // Se uma sobrescrever a outra, o custo é uma revarredura — não uma falha.
  try {
    const temporario = INDICE + '.tmp'
    writeFileSync(temporario, JSON.stringify(dados), 'utf8')
    renameSync(temporario, INDICE)
  } catch { /* índice é otimização, não pode derrubar o hook */ }
}

/** Mostra o suficiente pra reconhecer falso positivo, sem imprimir o segredo. */
function mascarar(texto) {
  const s = String(texto).replace(/\s+/g, ' ')
  return s.slice(0, 3) + '*'.repeat(Math.min(12, Math.max(0, s.length - 3))) + ` (${s.length} chars)`
}

function listarTranscripts(dir) {
  const achados = []
  // Aceita arquivo solto além de pasta: aplicar em alvo conhecido é mais seguro
  // que varrer tudo quando já se sabe onde está o segredo.
  try { if (statSync(dir).isFile()) return [dir] } catch { return achados }
  let entradas
  try { entradas = readdirSync(dir) } catch { return achados }
  for (const nome of entradas) {
    const caminho = join(dir, nome)
    let info
    try { info = statSync(caminho) } catch { continue }
    if (info.isDirectory()) achados.push(...listarTranscripts(caminho))
    else if (nome.endsWith('.jsonl')) achados.push(caminho)
  }
  return achados
}

// ---------------------------------------------------------------- autoteste
function autoteste() {
  const casos = [
    ['sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA', true],
    ['ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', true],
    ['postgres://admin:Contab0!2024@10.0.0.1:5432/db', true],
    ['senha: Contab0!2024', true],
    ['"password":"hunter2xyz"', true],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N', true],
    ['const token = process.env.API_TOKEN', false],   // referência, não valor
    ['password: ${SENHA}', false],                    // interpolação, não valor
    ['sk-ant', false],
  ]
  let falhas = 0
  let verificacoes = 0
  const checar = (ok, msg) => { verificacoes++; if (!ok) { falhas++; console.log(`FALHOU: ${msg}`) } }

  for (const [entrada, deveCasar] of casos) {
    const casou = redigirLinha(entrada).achados.length > 0
    checar(casou === deveCasar, `${JSON.stringify(entrada)} — esperado ${deveCasar}, veio ${casou}`)
  }
  // Idempotência: segunda passada não pode mexer em nada, e a marcação deixada
  // pela primeira não pode voltar a casar nenhum padrão.
  for (const base of ['senha: Contab0!2024', 'postgres://admin:Contab0!2024@10.0.0.1:5432/db']) {
    const uma = redigirLinha(base).saida
    const r2 = redigirLinha(uma)
    checar(uma === r2.saida, `idempotência: ${uma} -> ${r2.saida}`)
    checar(r2.achados.length === 0, `marcação ainda casa padrão — ${uma}`)
  }

  // Integridade JSON: linha real do transcript continua parseável.
  const json = JSON.stringify({ type: 'user', message: { content: 'a senha é Contab0!2024 ok' } })
  let jsonOk = true
  try { JSON.parse(redigirLinha(json).saida) } catch { jsonOk = false }
  checar(jsonOk, 'troca quebrou o JSON')

  // Trava de intocáveis: redigir estes derrubaria login ou configuração.
  const travados = [
    'C:/Users/x/.claude/.credentials.json',
    'C:/Users/x/.claude.json',
    'D:/proj/.env',
    'D:/proj/.env.local',
  ]
  const livres = [
    'C:/Users/x/.claude/projects/algum/sessao.jsonl',
    'C:/Users/x/.claude/history.jsonl',
  ]
  for (const t of travados) checar(INTOCAVEIS.test(t), `deveria ser intocável — ${t}`)
  for (const t of livres) checar(!INTOCAVEIS.test(t), `travou arquivo que deve ser limpo — ${t}`)

  console.log(falhas === 0 ? `autoteste OK (${verificacoes} verificações)` : `${falhas} falha(s) em ${verificacoes} verificações`)
  process.exit(falhas === 0 ? 0 : 1)
}

// ------------------------------------------------------------------- modos
const argv = process.argv.slice(2)

if (argv.includes('--autoteste')) autoteste()

if (argv.includes('--varrer')) {
  const dir = argv[argv.indexOf('--varrer') + 1]
  const aplicar = argv.includes('--aplicar')
  if (!dir) { console.log('uso: node segredo-scrub.mjs --varrer <dir> [--aplicar]'); process.exit(1) }

  const arquivos = listarTranscripts(dir)
  let totalArquivos = 0
  let totalAchados = 0
  const porTipo = {}

  for (const arquivo of arquivos) {
    const achados = redigirArquivo(arquivo, aplicar)
    if (!achados || achados.length === 0) continue
    totalArquivos++
    totalAchados += achados.length
    console.log(`\n${arquivo}`)
    for (const a of achados.slice(0, 8)) {
      console.log(`  linha ${a.linha}  ${a.nome}  ${mascarar(a.casado)}`)
      porTipo[a.nome] = (porTipo[a.nome] || 0) + 1
    }
    if (achados.length > 8) console.log(`  ... e mais ${achados.length - 8}`)
    for (const a of achados.slice(8)) porTipo[a.nome] = (porTipo[a.nome] || 0) + 1
  }

  console.log(`\n${aplicar ? 'APLICADO' : 'SIMULAÇÃO (nada foi escrito)'}`)
  console.log(`${arquivos.length} transcripts varridos · ${totalArquivos} com segredo · ${totalAchados} ocorrências`)
  for (const [nome, n] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${nome}`)
  process.exit(0)
}

// Modo hook: silencioso, falha aberta, nunca atrapalha a sessão.
//
// SessionEnd  -> redige o transcript que acabou de fechar.
// SessionStart-> redige os transcripts ANTERIORES deste mesmo projeto. Existe
//                porque SessionEnd não dispara quando a janela é fechada no X,
//                o terminal morre ou a máquina reinicia — e é justo aí que o
//                segredo ficaria no disco pra sempre. A varredura na abertura
//                recolhe esses órfãos. Nunca toca no transcript da sessão atual:
//                ele está aberto pra escrita, e reescrever por baixo corromperia.
try {
  const entrada = JSON.parse(readFileSync(0, 'utf8'))
  const atual = entrada?.transcript_path
  if (atual) {
    if (entrada.hook_event_name === 'SessionStart') {
      // Varrer o projeto inteiro custava 3s de espera na abertura num diretório
      // de 160 MB — atrito diário por um evento raro. O índice guarda
      // tamanho:mtime de cada arquivo já verificado, então em regime só entra
      // no regex quem mudou. Perder o índice não quebra nada: só custa uma
      // varredura completa a mais.
      const visto = lerIndice()
      let mudouIndice = false
      for (const arquivo of listarTranscripts(dirname(atual))) {
        if (arquivo === atual) continue
        let marca
        try { const i = statSync(arquivo); marca = `${i.size}:${Math.round(i.mtimeMs)}` } catch { continue }
        if (visto[arquivo] === marca) continue
        redigirArquivo(arquivo, true)
        try { const i = statSync(arquivo); visto[arquivo] = `${i.size}:${Math.round(i.mtimeMs)}` } catch { continue }
        mudouIndice = true
      }
      if (mudouIndice) gravarIndice(visto)
    } else {
      redigirArquivo(atual, true)
    }
  }

  // ~/.claude/history.jsonl guarda os prompts DIGITADOS, fora de qualquer
  // projeto — é onde a chave colada na barra de input fica, mesmo que o
  // transcript daquela sessão já tenha sido limpo. Um arquivo só, barato.
  const casa = process.env.USERPROFILE || process.env.HOME
  if (casa) redigirArquivo(join(casa, '.claude', 'history.jsonl'), true)
} catch { /* falha aberta */ }
process.exit(0)
