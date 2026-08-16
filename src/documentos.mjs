/**
 * CC-82 — a estante de documentos do cockpit.
 *
 * ## O que ele pediu, e a distinção que decide o desenho
 *
 * > "adiciona um leitor de dentro do cockpit, algo bem leve, só pra gente poder
 * > ver texto formatado. Assim a gente pode anexar documentos dentro do cockpit
 * > (…) guardar documentos mesmo, ideias minhas, textos meus, pra ela analisar
 * > depois. É sempre bom ter a fonte primária guardada."
 *
 * E, no mesmo fôlego, o que separa isto do bloco de notas:
 *
 * > "notas é mais em tempo real, são coisas que eu vou anotar. E esse mecanismo
 * > é pra guardar documentos"
 *
 * São duas coisas e não podem virar a mesma aba. **Nota grava a cada tecla e
 * cabe numa linha; documento é peça fechada, escrita ou ditada, para reler meses
 * depois.** Daí as três diferenças de implementação: um arquivo por documento
 * (não um JSON só), `.md` legível fora do painel, e nada de gravação automática
 * enquanto digita.
 *
 * ## Onde mora, e por que fora do projeto
 *
 * Em `~/.claude/control-center-docs/`, não dentro do repositório. O motivo é o
 * que ele nomeou: **ver de qualquer lugar.** Documento preso em `docs/produto/`
 * de um projeto é exatamente a falta que o item registra — o texto da Bancada e
 * o da Arquitetura de Hábitos ficaram presos assim.
 *
 * O preço é ficar fora do git, sem histórico. Por isso `publicar()` existe:
 * quando o documento vira decisão, ele desce para o `docs/` de um projeto e aí
 * ganha versionamento. Mora fora, publica quando amadurece.
 *
 * ## O que este módulo NÃO faz
 *
 * **Não mascara nada.** A pergunta estava aberta no roadmap e a resposta é o
 * desenho que já existe: o mascarador (F12) vive no hook de leitura de arquivo,
 * que é onde o dado sai para a API. Repetir a lógica aqui daria duas verdades
 * para a mesma regra, e a segunda envelheceria calada.
 *
 * **Não renderiza markdown completo.** "Bem leve" foi a palavra dele, e
 * `previa.mjs` já converte o subconjunto que ele escreve. Trazer biblioteca
 * quebraria a regra de zero dependência por um ganho que ninguém pediu.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

export const PASTA = () => path.join(casaClaude(), 'control-center-docs')

const LIMITES = { titulo: 200, texto: 400_000, fonte: 300, docs: 500 }

const corta = (v, n) => String(v ?? '').slice(0, n)

/**
 * Nome de arquivo a partir do título.
 *
 * Acento e pontuação saem porque o arquivo é para ser aberto fora do painel, em
 * qualquer sistema — e `~/.claude` já viaja entre a VPS e o PC dele. O `id`
 * ganha sufixo numérico em vez de timestamp: dois documentos com o mesmo título
 * é raro, e `contrato-carol-2.md` diz mais que `contrato-carol-1n4k2p.md`.
 */
export function idDe(titulo, existentes = []) {
  const base = String(titulo || 'documento')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60) || 'documento'
  if (!existentes.includes(base)) return base
  for (let i = 2; i < 999; i += 1) if (!existentes.includes(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now().toString(36)}`
}

/**
 * Frontmatter mínimo, e escrito à mão de propósito.
 *
 * Só três campos, todos em uma linha cada: um parser de YAML de verdade seria
 * dependência, e o arquivo precisa continuar legível para ele abrir no celular
 * com qualquer editor.
 */
function separar(bruto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(bruto)
  if (!m) return { meta: {}, texto: bruto }
  const meta = {}
  for (const linha of m[1].split(/\r?\n/)) {
    const par = /^([a-z]+):\s*(.*)$/.exec(linha.trim())
    if (par) meta[par[1]] = par[2]
  }
  return { meta, texto: m[2] }
}

const juntar = (meta, texto) => `---\n${
  Object.entries(meta).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${String(v).replace(/\n/g, ' ')}`).join('\n')
}\n---\n${texto}`

/** Título do corpo quando o frontmatter não tem: o primeiro `# `. */
const tituloDoCorpo = (texto) => (/^#\s+(.+)$/m.exec(texto || '') || [])[1]?.trim() || null

export function listar() {
  let nomes = []
  try { nomes = fs.readdirSync(PASTA()) } catch { return [] }
  return nomes
    .filter((n) => n.endsWith('.md'))
    .map((n) => {
      const arquivo = path.join(PASTA(), n)
      let st = null
      let cabeca = ''
      try {
        st = fs.statSync(arquivo)
        const fd = fs.openSync(arquivo, 'r')
        const buf = Buffer.alloc(Math.min(4096, st.size))
        fs.readSync(fd, buf, 0, buf.length, 0)
        fs.closeSync(fd)
        cabeca = buf.toString('utf8')
      } catch { return null }
      const { meta, texto } = separar(cabeca)
      return {
        id: n.replace(/\.md$/, ''),
        titulo: meta.titulo || tituloDoCorpo(texto) || n.replace(/\.md$/, ''),
        fonte: meta.fonte || null,
        criadoEm: meta.criado || null,
        mexidoEm: st.mtimeMs,
        bytes: st.size,
        // "1200 palavras" diz mais que "8 KB" para quem vai decidir se lê agora
        palavras: Math.round(st.size / 6),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mexidoEm - a.mexidoEm)
}

export function ler(id) {
  const arquivo = path.join(PASTA(), `${path.basename(String(id))}.md`)
  let bruto = ''
  let st = null
  try {
    bruto = fs.readFileSync(arquivo, 'utf8')
    st = fs.statSync(arquivo)
  } catch { return null }
  const { meta, texto } = separar(bruto)
  return {
    id: path.basename(arquivo, '.md'),
    titulo: meta.titulo || tituloDoCorpo(texto) || id,
    fonte: meta.fonte || null,
    criadoEm: meta.criado || null,
    mexidoEm: st.mtimeMs,
    texto,
  }
}

/**
 * Grava, com a cópia de segurança do `notes.mjs`.
 *
 * O cuidado vem de 09/08, quando as notas dele amanheceram vazias sem que se
 * conseguisse provar quem gravou. **Texto digitado à mão não tem outra fonte:**
 * se este arquivo se perder, ninguém regenera. A cópia `.bak` custa um write a
 * mais e já pagou por si uma vez.
 */
export function gravar({ id = null, titulo, texto, fonte = null, quando = Date.now() }) {
  if (!String(texto ?? '').trim() && !String(titulo ?? '').trim()) {
    return { ok: false, erro: 'documento vazio' }
  }
  const pasta = PASTA()
  fs.mkdirSync(pasta, { recursive: true })

  const jaTem = listar()
  if (!id && jaTem.length >= LIMITES.docs) return { ok: false, erro: `limite de ${LIMITES.docs} documentos` }

  const alvo = id
    ? path.basename(String(id))
    : idDe(titulo || tituloDoCorpo(texto), jaTem.map((d) => d.id))
  const arquivo = path.join(pasta, `${alvo}.md`)

  const antes = ler(alvo)
  const meta = {
    titulo: corta(titulo || antes?.titulo || tituloDoCorpo(texto) || alvo, LIMITES.titulo),
    criado: antes?.criadoEm || new Date(quando).toISOString(),
    fonte: corta(fonte ?? antes?.fonte ?? '', LIMITES.fonte) || null,
  }

  try {
    if (antes) fs.copyFileSync(arquivo, `${arquivo}.bak`)
    const tmp = `${arquivo}.tmp`
    fs.writeFileSync(tmp, juntar(meta, corta(texto, LIMITES.texto)))
    fs.renameSync(tmp, arquivo) // atômico: o painel lê a pasta a qualquer momento
  } catch (e) {
    return { ok: false, erro: String(e.message || e) }
  }
  return { ok: true, id: alvo, novo: !antes }
}

/**
 * Apagar deixa rastro.
 *
 * O arquivo vira `.apagado`, que a gravação seguinte não sobrescreve — mesma
 * regra das notas. Documento é a fonte primária dele; apagar de vez por um
 * clique errado no celular seria perda sem volta.
 */
export function apagar(id) {
  const arquivo = path.join(PASTA(), `${path.basename(String(id))}.md`)
  if (!fs.existsSync(arquivo)) return { ok: false, erro: 'documento não existe' }
  try {
    fs.renameSync(arquivo, `${arquivo}.apagado-${new Date().toISOString().slice(0, 10)}`)
  } catch (e) { return { ok: false, erro: String(e.message || e) } }
  return { ok: true }
}

/**
 * Acrescenta ao fim, sem abrir o painel.
 *
 * É o `cc doc add` do celular: ele dita uma linha e ela cai no documento certo.
 * Acrescentar em vez de substituir porque o caso de uso que ele descreveu é
 * "adiciona uma nota lá pra mim" — nunca "troca o documento inteiro".
 */
export function acrescentar(id, linha, { quando = Date.now() } = {}) {
  const doc = ler(id)
  if (!doc) return { ok: false, erro: 'documento não existe' }
  const texto = `${doc.texto.replace(/\s*$/, '')}\n\n${String(linha).trim()}\n`
  return gravar({ id: doc.id, titulo: doc.titulo, texto, fonte: doc.fonte, quando })
}

/**
 * Publica no `docs/` de um projeto: é aqui que o documento ganha git.
 *
 * A pergunta "dentro ou fora do projeto?" estava aberta, e a resposta é os dois,
 * em momentos diferentes. Mora fora enquanto é rascunho, para ele alcançar de
 * qualquer lugar; desce para o repositório quando vira decisão, e aí passa a ter
 * histórico. Copiar, nunca mover — perder o acesso de qualquer lugar seria
 * trocar um problema pelo outro.
 */
export function publicar(id, raizProjeto, { subpasta = 'produto' } = {}) {
  const doc = ler(id)
  if (!doc) return { ok: false, erro: 'documento não existe' }
  const destino = path.join(raizProjeto, 'docs', subpasta)
  try {
    fs.mkdirSync(destino, { recursive: true })
    const arquivo = path.join(destino, `${doc.id}.md`)
    fs.writeFileSync(arquivo, `# ${doc.titulo}\n\n${doc.texto.replace(/^#\s+.+\n+/, '')}`)
    return { ok: true, arquivo }
  } catch (e) { return { ok: false, erro: String(e.message || e) } }
}

export const _internals = { separar, juntar, tituloDoCorpo }
