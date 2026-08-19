#!/usr/bin/env node
/**
 * A regra número 1 dele, e a mais quebrada de todas.
 *
 * ## A medição, feita em 16/08
 *
 * Numa auditoria da própria conversa do dia: **279 travessões em 934 respostas
 * minhas.** A regra está no topo do arquivo de instruções globais dele, com
 * estas palavras:
 *
 * > "Regra absoluta, todos os projetos, sem exceção. Nada de — (travessão) nem
 * > – (meia-risca) em texto nenhum: interface, copy de site, documentação,
 * > comentário de código, mensagem de commit e as respostas no chat."
 *
 * E o motivo, que é o que a torna inegociável:
 *
 * > "O travessão é a marca registrada de texto escrito por máquina, e o Felipe
 * > reconhece na hora."
 *
 * Estava escrita havia meses. Nenhum mecanismo cobrava. É o exemplo mais caro
 * do princípio que este projeto inteiro prova: **instrução escrita não segura
 * comportamento, gate segura.**
 *
 * ## Cobre os dois lugares
 *
 * - `Stop`: a resposta que vai para a tela dele;
 * - `PreToolUse` em `Write`/`Edit`: o texto que entra em arquivo — a regra vale
 *   para documentação e comentário de código do mesmo jeito.
 *
 * ## O que NÃO é travessão
 *
 * O hífen comum (`-`) continua valendo em palavra composta, lista e comando.
 * A regra é só contra o traço longo. Bloco de código também passa: ali o
 * caractere pode ser dado, não prosa.
 *
 * Falha ABERTA, uma volta só.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* CC-167: `import()` no Windows precisa de URL, não de caminho. Com `D:\...`
   ele lança ERR_UNSUPPORTED_ESM_URL_SCHEME, e como quase toda chamada aqui
   está dentro de um `.catch`, o módulo some sem erro visível: foi assim que
   o interruptor de módulos deixou de valer em 31 hooks, sem ninguém notar. */
const urlDeModulo = (...p) => pathToFileURL(resolve(...p)).href

const AQUI = dirname(fileURLToPath(import.meta.url))
const sair = () => process.exit(0)

let dados = null
try { dados = JSON.parse(readFileSync(0, 'utf8')) } catch { sair() }

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('travessao-guard')) sair()

const TRACO = /[—–]/g

/** As trocas que ele mesmo escreveu na tabela do arquivo de instruções. */
const COMO_TROCAR = 'Como trocar, na ordem em que ele escreveu:\n'
  + '  · duas ideias numa frase  → duas frases, com ponto\n'
  + '  · aposto ou explicação    → vírgula, ou parênteses\n'
  + '  · antes de uma lista      → dois pontos\n'
  + '  · nome + subtítulo        → ponto, barra, ou nada\n\n'
  + 'Se a frase pede pausa forte, ela tem duas ideias dentro. Separe em duas:\n'
  + 'quase sempre fica mais clara, que é o motivo real da regra.\n\n'
  + 'O hífen comum (-) continua valendo em palavra composta e em lista.'

/**
 * Onde a regra vale, e onde nao vale.
 *
 * Correcao dele em 16/08, minutos depois de o hook nascer cobrando tudo:
 *
 * > "Travessao em backend e anotacao nao tem problema, o problema e em texto
 * > publico."
 *
 * Faz sentido, e muda o alvo. O motivo da regra e que o traco longo denuncia
 * texto de maquina para quem le de fora. Comentario de codigo e documentacao
 * interna nao tem "fora": ninguem alem de nos dois abre.
 *
 * PUBLICO e o que outra pessoa ve: interface, copy de site, pagina, README.
 * Interno e todo o resto.
 */
const PUBLICO = [
  /(^|\/)(apps|app|public|static|site|web|pages|components)\//i,
  /\.(html|jsx|tsx|vue|svelte)$/i,
  /(^|\/)README\.md$/i,
]
const ehPublico = (caminho) => PUBLICO.some((re) => re.test(String(caminho || '')))

/* ---- caminho 1: texto indo para um arquivo ---- */
if (dados?.tool_name === 'Write' || dados?.tool_name === 'Edit') {
  const alvo = String(dados?.tool_input?.file_path || '')
  // comentario de codigo e documentacao interna: livres, decisao dele em 16/08
  if (!ehPublico(alvo)) sair()

  const conteudo = String(dados?.tool_input?.content || dados?.tool_input?.new_string || '')
  const achados = conteudo.match(TRACO)
  if (!achados) sair()

  const linha = conteudo.split('\n').find((l) => TRACO.test(l)) || ''
  process.stderr.write(
    `${achados.length} TRAVESSÃO(ÕES) NO TEXTO QUE VAI PARA O ARQUIVO.\n\n`
    + `  ${linha.trim().slice(0, 110)}\n\n`
    + 'Este arquivo é PÚBLICO: alguém de fora vai ler. E o traço longo denuncia\n'
    + 'texto de máquina na hora, que é o motivo da regra.\n\n'
    + 'Comentário de código e documentação interna continuam livres (decisão dele\n'
    + 'em 16/08). Aqui não.\n\n'
    + COMO_TROCAR,
  )
  process.exit(2)
}

/* ---- caminho 2: a resposta que ele vai ler ---- */
if (dados?.stop_hook_active) sair()

const E = await import(urlDeModulo(AQUI, '../src/estilo.mjs')).catch(() => null)
if (!E) sair()
const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

const texto = E.ultimaResposta(arquivo)
if (!texto) sair()

// bloco de código sai: ali o caractere pode ser dado, não prosa
const prosa = texto.replace(/```[\s\S]*?```/g, ' ')
const achados = prosa.match(TRACO)
if (!achados) sair()

const exemplo = prosa.split('\n').find((l) => TRACO.test(l)) || ''

console.error(
  `${achados.length} TRAVESSÃO(ÕES) NA RESPOSTA.\n\n`
  + `  ${exemplo.trim().slice(0, 110)}\n\n`
  + 'É a regra número 1 do arquivo de instruções dele, e a mais quebrada:\n'
  + 'medido em 16/08, foram 279 travessões num dia só. Ela está escrita há meses\n'
  + 'e nada cobrava.\n\n'
  + '"O travessão é a marca registrada de texto escrito por máquina, e o Felipe\n'
  + 'reconhece na hora."\n\n'
  + COMO_TROCAR
  + '\n\nEsta é a única volta: a próxima passa.',
)
process.exit(2)
