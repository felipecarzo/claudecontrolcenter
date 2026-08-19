#!/usr/bin/env node
/**
 * Mexeu no visual e nao olhou? Nao entrega.
 *
 * ## O erro real, em 16/08
 *
 * Entreguei uma tela redesenhada tendo conferido so em 390px. Ele abriu no
 * monitor e viu linhas esticadas por 1860 pixels:
 *
 * > "olha esse design, ta horripilante, pelo amor de deus"
 *
 * A tela estava certa no celular e errada no monitor, e eu nao tinha olhado o
 * monitor. Na rodada seguinte o mesmo erro quase se repetiu com o tema claro,
 * porque o endereco de captura que eu tinha documentado estava errado.
 *
 * ## A regra
 *
 * Editou o visual e nao abriu NENHUMA imagem no turno? Devolve. Nao e sobre
 * gosto, e sobre olhar: a regra numero 1 dele e prova visual antes de dizer
 * feito, e ja houve 545 testes verdes com a tela quebrada no navegador.
 *
 * ## Por que so uma imagem basta para passar
 *
 * Exigir duas larguras seria mais correto e viraria hook chato: um ajuste de
 * uma linha de cor nao precisa de duas capturas. Uma imagem prova que houve
 * olhar; a largura certa e julgamento, e disso cuida o metodo escrito.
 *
 * Falha ABERTA, uma volta so.
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
if (dados?.stop_hook_active) sair()

const cfg = await import(urlDeModulo(AQUI, '../src/config.mjs')).catch(() => null)
if (cfg?.hookEnabled && !cfg.hookEnabled('visual-guard')) sair()

const arquivo = dados?.transcript_path || dados?.transcriptPath
if (!arquivo) sair()

let cauda = ''
try { cauda = readFileSync(arquivo, 'utf8').slice(-400_000) } catch { sair() }
const corte = cauda.lastIndexOf('"type":"user"')
const turno = corte >= 0 ? cauda.slice(corte) : cauda

/** Arquivo cujo conteudo vira pixel na tela dele. */
const VISUAL = /\.(html|css|jsx|tsx|vue|svelte)$/i

let mexeuNoVisual = null
let olhouImagem = false

for (const linha of turno.split('\n')) {
  if (!linha.includes('"tool_use"') && !linha.includes('"tool_result"')) continue
  let ev = null
  try { ev = JSON.parse(linha) } catch { continue }

  for (const b of ev?.message?.content || []) {
    if (b?.type !== 'tool_use') continue
    const alvo = String(b.input?.file_path || '')

    if (['Edit', 'Write', 'NotebookEdit'].includes(b.name) && VISUAL.test(alvo)) {
      mexeuNoVisual = alvo
    }
    // ler um PNG e o unico jeito de eu de fato VER: a ferramenta devolve imagem
    if (b.name === 'Read' && /\.(png|jpe?g|webp|gif)$/i.test(alvo)) olhouImagem = true
    // subagente que faz design tambem conta, quando ele proprio olhou
    if (b.name === 'Agent' && /print|screenshot|olh|design|tela/i.test(String(b.input?.prompt || ''))) {
      olhouImagem = true
    }
  }
}

if (!mexeuNoVisual || olhouImagem) sair()

console.error(
  'MUDOU O VISUAL E NAO OLHOU NENHUMA IMAGEM.\n\n'
  + `Ultimo arquivo de tela mexido: ${mexeuNoVisual}\n\n`
  + 'Em 16/08 eu entreguei uma tela conferida so em 390px. Ele abriu no monitor\n'
  + 'e a resposta foi "olha esse design, ta horripilante, pelo amor de deus".\n'
  + 'Estava certa no celular e errada no monitor, e eu nao tinha olhado o monitor.\n\n'
  + 'Tire o print e ABRA com a ferramenta Read, que mostra a imagem:\n\n'
  + '    SB=$HOME/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell\n'
  + '    "$SB" --headless --disable-gpu --no-sandbox --hide-scrollbars \\\n'
  + '      --window-size=390,1200 --screenshot=/tmp/claude-1001/shots/x.png \\\n'
  + '      --virtual-time-budget=6000 "http://127.0.0.1:5180/?static=1&tema=escuro"\n\n'
  + '  · `--window-size` = a largura em pixels, e e ela que muda tudo: 390 e o\n'
  + '    telefone dele, 1900 o monitor. Confira as duas quando mexer em layout.\n'
  + '  · `?static=1` desliga a atualizacao automatica, senao o navegador nunca\n'
  + '    considera a pagina carregada e a captura trava\n'
  + '  · os temas claros se chamam `papel` e `areia`. Nao existe `?tema=claro`.\n\n'
  + 'Teste verde nao substitui: ja houve 545 passando com a tela quebrada.\n\n'
  + 'Esta e a unica volta: a proxima passa.',
)
process.exit(2)
