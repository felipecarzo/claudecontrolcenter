/**
 * CC-94 — a prévia que eu mando para ele, como parte do sistema.
 *
 * ## Por que isto virou módulo, e não continua sendo script solto
 *
 * Em 15 e 16/08 eu gerei sete prévias, cada uma com um script novo em `/tmp`
 * escrito na hora. Duas consequências, e ele apontou as duas:
 *
 * 1. **Todas saíram com fonte de tela larga** (11 a 15px), porque copiei o CSS
 *    do painel. Ele lê no telefone, quase sempre andando: *"eu precisei dar
 *    zoom, fico dando zoom"*. Arquivo que exige zoom é arquivo que ele não lê,
 *    e aí a prévia não serve para nada.
 * 2. **O script morre com o `/tmp`.** A próxima prévia recomeça do zero, e o
 *    acerto de tamanho se perde de novo.
 *
 * Pedido dele: *"botar isso como parte do sistema do cockpit e fixo, como uma
 * prática mesmo, uma boa prática"*.
 *
 * ## Os dois modos, e a diferença importa
 *
 * - **`leitura`** (padrão): tamanho de telefone, CSS próprio. Para texto que ele
 *   vai LER — lista, backlog, comparação, relatório.
 * - **`layout`**: o CSS de verdade do painel, com os tamanhos reais. Para ele
 *   conferir como a tela vai ficar. **Aqui fonte grande seria mentira**, porque
 *   o que se quer provar é justamente o tamanho.
 *
 * Escolher errado estraga a prévia dos dois jeitos: `layout` para ler exige
 * zoom; `leitura` para conferir tela mostra algo que não existe.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))

export const esc = (x) => String(x ?? '')
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/**
 * O CSS de leitura, medido contra o problema real.
 *
 * 19px de corpo não é gosto: é o menor tamanho que ele leu sem dar zoom, num
 * telefone, na rua. `text-size-adjust` travado porque o iOS remexe no tamanho
 * sozinho quando a tela gira, e aí o cuidado todo se perde.
 */
export const CSS_LEITURA = `
:root{color-scheme:dark light}
*{box-sizing:border-box}
body{margin:0;padding:20px 16px 40px;background:#14120f;color:#ece6da;
  font:19px/1.45 -apple-system,system-ui,sans-serif;-webkit-text-size-adjust:100%}
h1{font-size:26px;line-height:1.2;margin:0 0 6px}
h2{font-size:15px;letter-spacing:.12em;text-transform:uppercase;margin:30px 0 10px;color:#a09a8c}
h3{font-size:19px;margin:22px 0 6px}
p{margin:0 0 12px}
.sub{color:#a09a8c;font-size:16px;margin:0 0 26px}
.i{padding:14px 16px;margin-bottom:10px;background:#1e1a16;border-radius:12px;border-left:5px solid #3a352d}
.i b{display:block;font-size:19px;line-height:1.3;margin-bottom:3px}
.i span{color:#a09a8c;font-size:16px;line-height:1.4;display:block}
code{background:#241f1a;padding:2px 6px;border-radius:5px;font-size:16px}
pre{background:#1e1a16;padding:14px;border-radius:10px;overflow-x:auto;font-size:15px}
blockquote{margin:0 0 14px;padding-left:14px;border-left:3px solid #6b6459;color:#c9c2b4;font-style:italic}
table{width:100%;border-collapse:collapse;font-size:16px}
td,th{padding:8px 6px;border-bottom:1px solid #2c2721;text-align:left}
/* qualquer coisa larga rola dentro de si, nunca empurra a página */
.rolagem{overflow-x:auto}
`

/** O CSS do painel de verdade, para prévia de layout. */
export function cssDoPainel() {
  try {
    const html = fs.readFileSync(path.join(AQUI, 'ui.html'), 'utf8')
    return (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || ''
  } catch { return '' }
}

const MOLDURA_LAYOUT = `
body{margin:0;padding:14px;background:var(--bg)}
#painel{container-type:inline-size;container-name:painel}
`

/**
 * Monta a página.
 *
 * `corpo` é HTML pronto — quem chama já sabe o que quer mostrar. O módulo cuida
 * do que sempre erra: viewport, tamanho, tema e o aviso de qual modo é.
 */
export function pagina({ titulo, subtitulo = '', corpo, modo = 'leitura' }) {
  const css = modo === 'layout' ? cssDoPainel() + MOLDURA_LAYOUT : CSS_LEITURA
  const dentro = modo === 'layout' ? `<div id="painel">${corpo}</div>` : corpo
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title><style>${css}</style></head>
<body>
${modo === 'leitura' ? `<h1>${esc(titulo)}</h1>${subtitulo ? `<p class="sub">${esc(subtitulo)}</p>` : ''}` : ''}
${dentro}
</body></html>`
}

/** Lista de cartões, o formato que mais se repetiu: grupos com título e cor. */
export const grupos = (lista) => lista.map((g) => `
  <h2${g.cor ? ` style="color:${g.cor}"` : ''}>${esc(g.titulo)}${g.itens ? ` · ${g.itens.length}` : ''}</h2>
  ${(g.itens || []).map((i) => `<div class="i"${g.cor ? ` style="border-left-color:${g.cor}"` : ''}>
    <b>${esc(i.titulo)}</b>${i.texto ? `<span>${esc(i.texto)}</span>` : ''}</div>`).join('')}`).join('')

/**
 * Markdown reduzido ao que ele escreve: título, lista, citação, código, negrito.
 *
 * Não é renderizador de markdown — é o suficiente para mostrar um documento do
 * `docs/` no telefone. Trazer uma biblioteca aqui quebraria a regra de zero
 * dependência do projeto por um ganho que ninguém pediu.
 */
export function deMarkdown(md) {
  const linhas = String(md).split(/\r?\n/)
  const fora = []
  let emLista = false
  let emCodigo = false

  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[\[([^\]]+)\]\]/g, '<b>$1</b>')

  for (const l of linhas) {
    if (/^```/.test(l)) {
      fora.push(emCodigo ? '</pre>' : '<pre>')
      emCodigo = !emCodigo
      continue
    }
    if (emCodigo) { fora.push(esc(l)); continue }

    const item = /^\s*[-*]\s+(.+)$/.exec(l)
    if (item) {
      if (!emLista) { fora.push('<ul>'); emLista = true }
      fora.push(`<li>${inline(item[1])}</li>`)
      continue
    }
    if (emLista) { fora.push('</ul>'); emLista = false }

    const h = /^(#{1,3})\s+(.+)$/.exec(l)
    if (h) { fora.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue }
    const cit = /^>\s?(.*)$/.exec(l)
    if (cit) { fora.push(`<blockquote>${inline(cit[1])}</blockquote>`); continue }
    if (l.trim()) fora.push(`<p>${inline(l)}</p>`)
  }
  if (emLista) fora.push('</ul>')
  if (emCodigo) fora.push('</pre>')
  return fora.join('\n')
}

/** Grava e devolve o caminho. O nome vira o título quando não vier outro. */
export function gravar(destino, opcoes) {
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.writeFileSync(destino, pagina(opcoes))
  return destino
}
