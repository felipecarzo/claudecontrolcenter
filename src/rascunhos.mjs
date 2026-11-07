/**
 * CC-1064: rascunho, a conversa que ainda não é projeto.
 *
 * Pasta de rascunho: `<base dos projetos>/_rascunhos/<slug>/`, com `IDEIA.md` e
 * `.claude/CLAUDE.md`. O `_` na frente tira a pasta de toda varredura de projeto
 * (`SKIP` em `install.mjs`), e por isso NUNCA há `CLAUDE.md` nem `.git` na raiz
 * dela: é esse o critério de "é projeto" (`isProject`).
 *
 * A sessão é a mesma do resto do painel (`ligar` de remotecontrol, com o rótulo
 * `rascunho-<slug>`), então aparece no app do celular. O estado da ideia mora no
 * `IDEIA.md`, mantido pela própria sessão, e é ele que viaja quando o rascunho
 * vira projeto. Descartar nunca apaga: a pasta vai para `_rascunhos/.lixeira/`.
 *
 * As dependências (ligar, desligar, criar projeto) entram por parâmetro com
 * padrão, para o teste não abrir tmux nem criar projeto de verdade.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ehWindows } from './platform.mjs'
import { projectsBase } from './install.mjs'
import { criar as criarNovo, validarNome } from './novoProjeto.mjs'
import {
  ligar as ligarRC, desligar as desligarRC, lerVinculos, conversaDoVinculo, pastaTranscritos,
} from './remotecontrol.mjs'

export const ROTULO = (slug) => `rascunho-${slug}`

/** O slug vira nome de pasta e vem da tela: nada de barra, ponto ou `..`. */
const SLUG_OK = /^[a-z0-9][a-z0-9-]{0,60}$/

/** `VPS_` nesta máquina, `PC_` no computador dele. A tela só sugere; a regra mora aqui. */
export const prefixo = () => (ehWindows ? 'PC_' : 'VPS_')

export function baseRascunhos() {
  if (process.env.CC_RASCUNHOS) return process.env.CC_RASCUNHOS
  return path.join(projectsBase() || path.join(os.homedir(), 'projetos'), '_rascunhos')
}

/** Está dentro da base de rascunhos? Compara com o separador no fim, para que
 *  `<base>-irmao` não passe por filho de `<base>`. */
export function ehRascunho(dir) {
  if (!dir) return false
  const base = path.resolve(baseRascunhos())
  return path.resolve(String(dir)).startsWith(base + path.sep)
}

const dois = (n) => String(n).padStart(2, '0')
/** AAAAMMDD-HHMM na hora local. */
function carimbo(d = new Date()) {
  return `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}`
}

export function slugDe(titulo) {
  const s = String(titulo || '')
    .toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/, '')
  return s || `rascunho-${carimbo()}`
}

/** Pasta do rascunho, ou null se o slug não é um slug (nunca monta caminho com texto cru). */
const pastaDe = (slug) => (SLUG_OK.test(String(slug)) ? path.join(baseRascunhos(), String(slug)) : null)

function lerIdeia(pasta) {
  let texto = ''
  try { texto = fs.readFileSync(path.join(pasta, 'IDEIA.md'), 'utf8') } catch { /* ainda sem IDEIA.md */ }
  const linhas = texto.split(/\r?\n/)
  const iTit = linhas.findIndex((l) => /^#\s+\S/.test(l))
  const titulo = iTit >= 0 ? linhas[iTit].replace(/^#\s+/, '').trim() : ''
  const par = []
  for (const l of linhas.slice(iTit + 1)) {
    if (/^#/.test(l)) break
    if (!l.trim()) { if (par.length) break; continue }
    par.push(l.trim())
  }
  return { titulo, resumo: par.join(' ').slice(0, 240) }
}

const MODELO_IDEIA = (titulo) => `# ${titulo}

(ainda vazio: a conversa preenche)

## O que foi decidido

## O que falta decidir

## Perguntas em aberto
`

const CLAUDE_MD = `# Rascunho, não projeto

Esta conversa é um rascunho de ideia. Ainda não é projeto, e talvez nunca vire.

- Converse, pesquise, compare. Não crie estrutura de projeto, não rode git init, não crie app.
- Mantenha o IDEIA.md desta pasta sempre atualizado: a ideia em um parágrafo logo abaixo do título,
  o que foi decidido, o que falta decidir e as perguntas em aberto. Atualize ao fim de cada resposta
  em que algo mudou. É ele que vira a semente do projeto se a ideia for adiante.
- Arquivo de apoio (rascunho de texto, tabela, esboço) pode ficar nesta pasta.
- Para virar projeto ou descartar, o Felipe usa os botões do painel (tela Sessões, bloco Rascunhos).
`

/** Os rascunhos que estão no disco, o mais mexido primeiro. `vivos` é o mapa de
 *  `estado()` (rótulo para sessão): quem decide "no ar" é o terminal, não o disco. */
export function listar({ vivos = {} } = {}) {
  const base = baseRascunhos()
  let nomes = []
  try { nomes = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')) } catch { /* sem rascunho nenhum ainda */ }
  const vinculos = lerVinculos()
  const out = []
  for (const d of nomes) {
    if (!SLUG_OK.test(d.name)) continue
    const pasta = path.join(base, d.name)
    const { titulo, resumo } = lerIdeia(pasta)
    let st = null
    try { st = fs.statSync(pasta) } catch { continue }
    let mexidoEm = st.mtimeMs
    try { mexidoEm = fs.statSync(path.join(pasta, 'IDEIA.md')).mtimeMs } catch { /* sem IDEIA.md: vale a pasta */ }
    const rotulo = ROTULO(d.name)
    let conversa = null
    try { conversa = conversaDoVinculo({ ...vinculos[rotulo], cwd: pasta })?.id || null } catch { /* sem conversa */ }
    out.push({
      slug: d.name, titulo: titulo || d.name, resumo,
      criadoEm: st.birthtimeMs || st.ctimeMs, mexidoEm,
      rotulo, viva: Boolean(vivos && vivos[rotulo]), conversa,
    })
  }
  return out.sort((a, b) => b.mexidoEm - a.mexidoEm)
}

export async function criar({ titulo } = {}, { ligar = ligarRC } = {}) {
  const base = baseRascunhos()
  const original = slugDe(titulo)
  let slug = original
  for (let n = 2; fs.existsSync(path.join(base, slug)); n++) slug = `${original}-${n}`
  const pasta = path.join(base, slug)
  const nome = String(titulo || '').replace(/\s+/g, ' ').trim().slice(0, 120) || slug
  fs.mkdirSync(path.join(pasta, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(pasta, 'IDEIA.md'), MODELO_IDEIA(nome))
  fs.writeFileSync(path.join(pasta, '.claude', 'CLAUDE.md'), CLAUDE_MD)
  /* Se a sessão não sobe, a pasta FICA: a conversa pode ser aberta de novo (reabrir). */
  const r = await ligar(ROTULO(slug), pasta, { remoto: true })
  if (!r || !r.ok) return { ok: false, erro: r?.erro || 'a sessão não abriu', slug }
  return { ...r, ok: true, slug }
}

/** Manda a pasta para a lixeira dos rascunhos. Nunca apaga. */
function paraLixeira(slug, pasta, selo) {
  const lixeira = path.join(baseRascunhos(), '.lixeira')
  fs.mkdirSync(lixeira, { recursive: true })
  let destino = path.join(lixeira, `${slug}-${selo}`)
  for (let n = 2; fs.existsSync(destino); n++) destino = path.join(lixeira, `${slug}-${selo}-${n}`)
  fs.renameSync(pasta, destino)
  return destino
}

export async function descartar(slug, { desligar = desligarRC } = {}) {
  const pasta = pastaDe(slug)
  if (!pasta) return { ok: false, erro: `nome de rascunho inválido: ${String(slug).slice(0, 60)}` }
  if (!fs.existsSync(pasta)) return { ok: false, erro: `não achei o rascunho ${slug}` }
  await desligar(ROTULO(slug))
  const lixeira = paraLixeira(slug, pasta, carimbo())
  return { ok: true, slug, lixeira }
}

export async function promover(slug, { nome } = {}, {
  ligar = ligarRC, desligar = desligarRC, criarProjeto = criarNovo, base = projectsBase(),
} = {}) {
  const pasta = pastaDe(slug)
  if (!pasta) return { ok: false, erro: `nome de rascunho inválido: ${String(slug).slice(0, 60)}` }
  if (!fs.existsSync(pasta)) return { ok: false, erro: `não achei o rascunho ${slug}` }
  const invalido = validarNome(nome)
  if (invalido) return { ok: false, erro: invalido }

  const passos = []
  const marcar = (o_que, ok = true, detalhe = null) => passos.push({ o_que, ok, detalhe })
  const selo = carimbo()
  const { titulo } = lerIdeia(pasta)

  /* 1. a conversa, ANTES de desligar: o vínculo é a pista, e a pasta do rascunho é
        única, então a mais recente dela é a certa quando o vínculo veio sem conversa. */
  let conversa = null
  try { conversa = conversaDoVinculo({ ...lerVinculos()[ROTULO(slug)], cwd: pasta }) } catch { /* sem conversa */ }
  marcar(conversa ? 'a conversa do rascunho foi achada' : 'o rascunho não tem conversa gravada', true)

  // 2
  try { await desligar(ROTULO(slug)); marcar('a sessão do rascunho foi encerrada') }
  catch (e) { marcar('a sessão do rascunho foi encerrada', false, String(e?.message || e)) }

  // 3. o mesmo caminho do botão de projeto novo; falhou, o rascunho continua intacto
  let r
  try { r = await criarProjeto(base, { nome, descricao: titulo }) }
  catch (e) { r = { ok: false, erro: String(e?.message || e) } }
  if (!r || !r.ok) return { ok: false, erro: r?.erro || 'não consegui criar o projeto', passos }
  const raiz = r.raiz
  marcar(`o projeto ${nome} foi criado`)

  // 4. a ideia viaja: IDEIA.md em docs/produto, o resto em docs/produto/rascunho
  try {
    const produto = path.join(raiz, 'docs', 'produto')
    fs.mkdirSync(produto, { recursive: true })
    if (fs.existsSync(path.join(pasta, 'IDEIA.md'))) fs.copyFileSync(path.join(pasta, 'IDEIA.md'), path.join(produto, 'IDEIA.md'))
    const outros = fs.readdirSync(pasta).filter((n) => n !== 'IDEIA.md' && n !== '.claude')
    for (const n of outros) fs.cpSync(path.join(pasta, n), path.join(produto, 'rascunho', n), { recursive: true })
    marcar('o IDEIA.md foi para docs/produto', true, outros.length ? `mais ${outros.length} arquivo(s) em docs/produto/rascunho` : null)
  } catch (e) { marcar('o IDEIA.md foi para docs/produto', false, String(e?.message || e)) }

  // 5. copia (não move) a conversa para a pasta de transcritos do projeto
  let copiou = false
  if (conversa) {
    try {
      const destino = pastaTranscritos(raiz)
      fs.mkdirSync(destino, { recursive: true })
      fs.copyFileSync(path.join(pastaTranscritos(pasta), `${conversa.id}.jsonl`), path.join(destino, `${conversa.id}.jsonl`))
      copiou = true
      marcar('o histórico da conversa foi copiado para o projeto')
    } catch (e) { marcar('o histórico da conversa foi copiado para o projeto', false, String(e?.message || e)) }
  }

  /* 6. reabre já no projeto. NÃO MEDIDO: se `--resume` aceita conversa copiada para
        outra pasta; se não aceitar, o caminho do `pedido` vira o único. */
  let sessao = null
  try {
    sessao = await ligar(nome, raiz, copiou
      ? { remoto: true, retomar: conversa.id }
      : { remoto: true, pedido: 'Leia docs/produto/IDEIA.md: é a ideia que deu origem a este projeto.' })
    marcar(copiou ? 'a sessão reabriu no projeto, retomando a conversa' : 'a sessão abriu no projeto, com o pedido de ler o IDEIA.md', Boolean(sessao?.ok), sessao?.ok ? null : sessao?.erro)
  } catch (e) { marcar('a sessão abriu no projeto', false, String(e?.message || e)) }

  // 7. o rascunho vai para a lixeira, nunca é apagado
  try { paraLixeira(slug, pasta, selo); marcar('a pasta do rascunho foi para a lixeira') }
  catch (e) { marcar('a pasta do rascunho foi para a lixeira', false, String(e?.message || e)) }

  return { ok: true, raiz, nome, passos, sessao }
}
