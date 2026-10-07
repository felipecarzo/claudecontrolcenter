/**
 * CC-656, design 3/4: o mural de referências de cada projeto (print, site de inspiração, recado "quero assim"),
 * guardado DENTRO do projeto para o agente ler: docs/design/mural.jsonl, uma linha por item e só por acréscimo,
 * e as imagens em docs/design/mural/. Apagar é outra linha; imagem nunca é sobrescrita (nome novo, flag wx).
 * O tipo da imagem vem dos BYTES, nunca do que o navegador disse: o mime declarado só precisa concordar.
 */
import fs from 'node:fs'
import path from 'node:path'

export const LIMITE_IMAGEM = 12 * 1024 * 1024
const pasta = (raiz) => path.join(raiz, 'docs', 'design', 'mural')
const arquivo = (raiz) => path.join(raiz, 'docs', 'design', 'mural.jsonl')
// travessão e meia-risca viram vírgula (por código de caractere: a regra do projeto é não escrevê-los)
const TRACOS = new RegExp('\\s*[' + String.fromCharCode(0x2013, 0x2014) + ']\\s*', 'g')
const limpa = (v, n) => String(v ?? '').replace(TRACOS, ', ').replace(/\s+/g, ' ').trim().slice(0, n)

/** png, jpg ou webp pelos primeiros bytes; null para qualquer outra coisa (html, svg, gif, script). */
export function tipoPelosBytes(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}

export function lerMural(raiz) {
  let t = ''
  try { t = fs.readFileSync(arquivo(raiz), 'utf8') } catch { return [] }
  const vivos = new Map()
  for (const l of t.split('\n')) {
    let j = null; try { j = l.trim() ? JSON.parse(l) : null } catch { j = null }
    if (!j || !j.id) continue
    if (j.apagado) vivos.delete(j.id); else vivos.set(j.id, j)
  }
  return [...vivos.values()].reverse().slice(0, 200) // o mais novo primeiro
}

export function acrescentar(raiz, { texto, url, nome, mime, dados } = {}) {
  const item = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), em: new Date().toISOString(), de: 'felipe' }
  const t = limpa(texto, 500); if (t) item.texto = t
  if (url) {
    let u = null; try { u = new URL(String(url)) } catch { u = null }
    if (!u || !/^https?:$/.test(u.protocol) || String(url).length > 500) return { ok: false, erro: 'o link precisa começar com http ou https' }
    item.url = u.href
  }
  let imagem = null
  if (dados) {
    const b64 = String(dados).replace(/^data:[^,]*,/, '')
    if (b64.length > Math.ceil(LIMITE_IMAGEM * 4 / 3) + 4) return { ok: false, erro: 'imagem maior que 12 MB' } // antes de decodificar
    const buf = Buffer.from(b64, 'base64')
    if (!buf.length) return { ok: false, erro: 'imagem vazia' }
    if (buf.length > LIMITE_IMAGEM) return { ok: false, erro: 'imagem maior que 12 MB' }
    const tipo = tipoPelosBytes(buf)
    if (!tipo || tipo.mime !== String(mime || '')) return { ok: false, erro: 'só imagem png, jpg ou webp' }
    const base = String(nome || 'print').replace(/\.[^.]*$/, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'print'
    imagem = { buf, rel: 'docs/design/mural/' + item.id + '-' + base + '.' + tipo.ext }
    item.img = imagem.rel
  }
  if (!item.texto && !item.url && !item.img) return { ok: false, erro: 'mande um print, um link ou um recado' }
  if (imagem) {
    fs.mkdirSync(pasta(raiz), { recursive: true })
    fs.writeFileSync(path.join(raiz, imagem.rel), imagem.buf, { flag: 'wx' })
  }
  fs.mkdirSync(path.dirname(arquivo(raiz)), { recursive: true })
  fs.appendFileSync(arquivo(raiz), JSON.stringify(item) + '\n')
  return { ok: true, item }
}

export function apagar(raiz, id) {
  if (!lerMural(raiz).some((i) => i.id === id)) return { ok: false, erro: 'este item não está no mural' }
  // ponytail: a imagem fica no disco; o histórico do mural continua inteiro
  fs.appendFileSync(arquivo(raiz), JSON.stringify({ id, apagado: true, em: new Date().toISOString() }) + '\n')
  return { ok: true }
}

/** Caminho real da imagem do mural, ou null. Atalho para fora, `..` e caminho absoluto não passam. */
export function caminhoDaImagem(raiz, rel) {
  if (typeof rel !== 'string' || !rel.startsWith('docs/design/mural/') || !/\.(png|jpe?g|webp)$/i.test(rel) || rel.split('/').includes('..') || rel.includes('\\') || rel.includes('\0')) return null
  try {
    const base = fs.realpathSync(pasta(raiz)); const alvo = fs.realpathSync(path.join(raiz, rel))
    return alvo.startsWith(base + path.sep) && fs.statSync(alvo).isFile() ? alvo : null
  } catch { return null }
}

/** As referências mais novas, em linhas curtas, para o pacote do agente. */
export function paraOAgente(raiz, max = 8) {
  return lerMural(raiz).slice(0, max).map((i) => '  · ' + String(i.em).slice(0, 10) + ': ' + [i.texto, i.url, i.img && 'imagem em ' + i.img].filter(Boolean).join(' · '))
}
