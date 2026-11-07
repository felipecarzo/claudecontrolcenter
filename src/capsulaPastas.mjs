/* CC-1080, a lacuna do site publicado: guardar as pastas que moram FORA da pasta do projeto.
 *
 * Duas origens, o mesmo motor:
 *  - publicado/: o `root` e cada `alias` dos blocos nginx ligados ao projeto (por exemplo /var/www/ahtleta);
 *  - montagens/: as pastas que os contêineres montam direto do disco (bind mount, por exemplo em /opt/...).
 *
 * SÓ LÊ as pastas de origem. Nunca grava em /var/www, /opt nem /etc, nunca roda docker. Cada pasta vira um
 * `<destino>/<caminho codificado>.tar.gz` dentro do stage da cápsula, com tamanho e sha256.
 * Promessas, todas conferidas em test-capsula.mjs:
 *  1. Montagem de sistema (docker.sock, /etc/localtime, /proc, /sys, /dev...) e /etc/letsencrypt nunca são guardadas.
 *  2. Chave privada (.key, .pem, privkey, id_rsa, /private/) não entra no tar: fica de fora de propósito e o nome vai para o
 *     manifesto. O segredo (.env) também não entra no tar, mas NÃO é perdido: `coletar` devolve a lista deles (`segredos`) e
 *     quem monta a cápsula (capsula.mjs) os cifra no segredos.tar.gpg. Isto aqui não cifra nada nem guarda conteúdo.
 *  3. Pasta ampla demais (/var/www, /opt, a casa, ou um pai do projeto) não é guardada: guardaria os sites dos outros.
 *  4. O que o usuário não consegue ler vira "não coletado, precisa de root", e a coleta segue.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

export const PRECISA_ROOT = 'não coletado, precisa de root'
export const ehSegredo = (nome) => nome === '.env' || (nome.startsWith('.env.') && nome !== '.env.example')

/** O que é do sistema e nunca é guardado, mesmo que um contêiner monte. */
export const SISTEMA_RE = /^\/(proc|sys|dev|run)(\/|$)|^\/var\/run(\/|$)|^\/etc\/(localtime|timezone)$|^\/etc\/letsencrypt(\/|$)|\.sock$/
/** Chave privada ou certificado: nunca entra no tar. */
export const CHAVE_PRIVADA = /\/etc\/letsencrypt|privkey|\.key$|\.pem$|\.p12$|\.pfx$|\.jks$|\.ppk$|(^|\/)id_(rsa|dsa|ecdsa|ed25519)$|\/private(\/|$)/i
const AMPLAS = new Set(['/', '/var', '/var/www', '/var/lib', '/var/log', '/opt', '/srv', '/home', '/root', '/usr', '/etc', '/mnt', '/media', '/tmp', '/boot', '/lib', '/bin', '/sbin'])

const dentro = (pai, filho) => filho === pai || filho.startsWith(pai.endsWith('/') ? pai : pai + '/')
const campo = (s) => String(s).replace(/[\t\r\n]+/g, ' ')

/** Anda na pasta sem seguir atalhos. Devolve as entradas (pastas, arquivos, atalhos), o que não dá para guardar (sockets) e o
 *  que este usuário não consegue LER (dono root, por exemplo): isso fica de fora e vai para o manifesto como "precisa de root". */
export function varrer(raiz) {
  const itens = []
  const pulados = []
  const ilegiveis = []
  const ir = (dir, pre, entradas) => {
    for (const e of entradas) {
      const rel = pre ? `${pre}/${e.name}` : e.name
      const abs = path.join(dir, e.name)
      let st
      try { st = fs.lstatSync(abs) } catch { ilegiveis.push(rel); continue }
      if (st.isDirectory()) {
        let sub
        try { sub = fs.readdirSync(abs, { withFileTypes: true }); fs.accessSync(abs, fs.constants.R_OK | fs.constants.X_OK) } catch { ilegiveis.push(rel); continue }
        itens.push({ rel, tipo: 'd', modo: st.mode & 0o7777, tam: 0 })
        ir(abs, rel, sub)
      } else if (st.isSymbolicLink()) itens.push({ rel, tipo: 'l', modo: 0, tam: 0, alvo: fs.readlinkSync(abs) })
      else if (st.isFile()) {
        try { fs.accessSync(abs, fs.constants.R_OK) } catch { ilegiveis.push(rel); continue }
        itens.push({ rel, tipo: 'f', modo: st.mode & 0o7777, tam: st.size })
      } else pulados.push(rel)
    }
  }
  ir(raiz, '', fs.readdirSync(raiz, { withFileTypes: true }))
  itens.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  return { itens, pulados, ilegiveis }
}

export function sha256Arquivo(p) {
  const h = crypto.createHash('sha256')
  const fd = fs.openSync(p, 'r')
  const buf = Buffer.allocUnsafe(1 << 20)
  try {
    for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0;) h.update(buf.subarray(0, n))
  } finally { fs.closeSync(fd) }
  return h.digest('hex')
}

/**
 * Mede uma pasta (ou arquivo) de fora do projeto, sem gravar nada. `raizes` = a pasta do projeto (e o caminho real dela): pasta
 * que CONTÉM o projeto é ampla demais. `mapear` troca o caminho antes de tocar o disco (os testes usam; no painel é a identidade).
 * situacao: ok | sistema | excluida | ampla | nao-existe | precisa-root | nao-guardavel.
 */
export function avaliar(caminho, { raizes = [], mapear = (p) => p, home = os.homedir() } = {}) {
  const base = { caminho, real: null, tipo: null, existe: false, legivel: false, situacao: 'ok', texto: null, bytes: 0, entradas: 0, ilegiveis: [], excluidos: [], segredos: [] }
  const fora = (situacao, texto, extra = {}) => ({ ...base, ...extra, situacao, texto })
  const norm = path.posix.normalize(String(caminho).replace(/\/+$/, '') || '/')
  if (SISTEMA_RE.test(norm)) return fora('sistema', 'montagem de sistema, nunca guardada')
  if (CHAVE_PRIVADA.test(norm)) return fora('excluida', 'certificado ou chave privada: não incluído de propósito')
  if (AMPLAS.has(norm) || norm.split('/').filter(Boolean).length < 2 || norm === home || norm === path.dirname(home) || raizes.some((r) => r && dentro(norm, r))) {
    return fora('ampla', 'pasta ampla demais (contém outros sites ou o próprio projeto): não coletada')
  }
  const alvo = mapear(norm)
  let real, st
  try { real = fs.realpathSync(alvo); st = fs.statSync(real) } catch (e) {
    return e.code === 'ENOENT' || e.code === 'ENOTDIR' ? fora('nao-existe', 'a pasta não existe nesta máquina') : fora('precisa-root', PRECISA_ROOT, { existe: true })
  }
  const b = { real, existe: true }
  if (st.isFile()) {
    try { fs.accessSync(real, fs.constants.R_OK) } catch { return fora('precisa-root', PRECISA_ROOT, b) }
    if (CHAVE_PRIVADA.test(real)) return fora('excluida', 'arquivo de chave privada: não incluído de propósito', b)
    // arquivo .env solto: não vai em tar, vai cifrado junto dos segredos do projeto
    if (ehSegredo(path.posix.basename(norm)) || ehSegredo(path.basename(real))) return { ...base, ...b, tipo: 'f', legivel: true, situacao: 'segredo', texto: 'arquivo de segredo: vai cifrado com a senha', bytes: st.size, entradas: 1 }
    return { ...base, ...b, tipo: 'f', legivel: true, bytes: st.size, entradas: 1 }
  }
  if (!st.isDirectory()) return fora('nao-guardavel', 'não é pasta nem arquivo comum (socket, pipe ou dispositivo)', b)
  let v
  try { fs.accessSync(real, fs.constants.R_OK | fs.constants.X_OK); v = varrer(real) } catch { return fora('precisa-root', PRECISA_ROOT, b) }
  // chave privada: fica de fora do tar e do resto (guarda só o nível de cima de cada pasta excluída).
  // .env: também fica fora do tar, mas vai para `segredos` (cifrado pela cápsula, com o caminho original)
  const excluidos = [], segredos = []
  for (const it of v.itens) {
    if (excluidos.some((x) => it.rel === x || it.rel.startsWith(x + '/'))) continue
    if (CHAVE_PRIVADA.test('/' + it.rel)) excluidos.push(it.rel)
    else if (it.tipo === 'f' && ehSegredo(path.posix.basename(it.rel))) segredos.push(it.rel)
  }
  const fica = v.itens.filter((it) => !excluidos.some((x) => it.rel === x || it.rel.startsWith(x + '/')) && !segredos.includes(it.rel))
  return { ...base, ...b, tipo: 'd', legivel: true, bytes: fica.reduce((t, i) => t + i.tam, 0), entradas: fica.length, ilegiveis: v.ilegiveis, excluidos, segredos }
}

/** Os caminhos completos dos segredos (.env) que uma lista de pastas avaliadas guardaria: só o caminho, nunca o conteúdo. */
export const segredosDe = (lista) => {
  const r = new Set()
  for (const p of lista) {
    if (p.av.situacao === 'segredo') r.add(p.caminho)
    else if (p.av.situacao === 'ok') for (const rel of p.av.segredos || []) r.add(`${p.caminho.replace(/\/+$/, '')}/${rel}`)
  }
  return [...r].sort()
}

/** Resumo sem nada pesado, para o manifesto e para a tela. */
export const resumirAv = (p) => ({
  caminho: p.caminho, certeza: p.certeza, origens: p.origens || [], situacao: p.av.situacao, texto: p.av.texto, existe: p.av.existe, legivel: p.av.legivel,
  tipo_origem: p.av.tipo, bytes: p.av.bytes, entradas: p.av.entradas, ilegiveis_total: p.av.ilegiveis.length, excluidos_total: p.av.excluidos.length,
  segredos_total: segredosDe([p]).length, segredos: segredosDe([p]).slice(0, 20),
})

/** Quanto pesa o que seria guardado: pasta dentro de outra da mesma lista não conta de novo (a coleta também a pula). */
export const bytesDe = (lista) => {
  const ok = lista.filter((p) => p.av.situacao === 'ok')
  return ok.filter((p) => !ok.some((o) => o !== p && o.caminho !== p.caminho && dentro(o.caminho, p.caminho))).reduce((t, p) => t + p.av.bytes, 0)
}

const nomeParte = (caminho, usados) => {
  const b = caminho.replace(/^\/+/, '').replace(/\/+/g, '__').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) || 'raiz'
  let n = b, i = 1
  while (usados.has(n)) n = `${b}-${++i}`
  usados.add(n)
  return n
}

function empacotar(av, arquivo, stage, n) {
  let args
  let lista = null
  if (av.tipo === 'd') {
    lista = path.join(stage, `.excluir-${n}.txt`)
    fs.writeFileSync(lista, [...av.ilegiveis, ...av.excluidos, ...av.segredos].map((r) => `./${r}`).join('\n') + '\n')
    args = ['-c', '--use-compress-program=gzip -1', '-p', '-f', arquivo, '-C', av.real, '--anchored', '--no-wildcards', `--exclude-from=${lista}`, '--', '.']
  } else args = ['-c', '--use-compress-program=gzip -1', '-p', '-f', arquivo, '-C', path.dirname(av.real), '--', path.basename(av.real)]
  const t = spawnSync('tar', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (lista) fs.rmSync(lista, { force: true })
  // código 1 do tar = "arquivo mudou durante a leitura": segue e avisa
  if (t.error || (t.status !== 0 && t.status !== 1)) return { ok: false, erro: String((t.error && t.error.message) || t.stderr || '').trim().split('\n').slice(-2).join(' | ').slice(0, 200) }
  return { ok: true, aviso: t.status === 1 ? 'o tar avisou que arquivos mudaram enquanto eram lidos' : null }
}

/**
 * Grava no `stage` uma parte por pasta. `lista` = [{ caminho, certeza, origens, av }] (av vem de avaliar). `tipo` = 'publicado' ou
 * 'montagem', e é o nome do campo da primeira coluna do plano. Devolve as partes, as somas, as entradas do manifesto, o que
 * "precisa de root" e as linhas do `pastas.tsv` (tipo, certeza, d|f, parte, bytes, caminho original).
 */
export function coletar(lista, stage, dir, { tipo }) {
  const arquivos = [], somas = {}, entradas = [], naoColetado = [], plano = [], segredos = []
  const usados = new Set()
  const feitas = []
  let n = 0
  for (const p of [...lista].sort((a, b) => a.caminho.length - b.caminho.length || (a.caminho < b.caminho ? -1 : 1))) {
    const av = p.av
    const base = { caminho: p.caminho, certeza: p.certeza, origens: p.origens || [], tipo_origem: av.tipo }
    if (av.situacao === 'sistema' || av.situacao === 'excluida') { entradas.push({ ...base, estado: 'excluida', motivo: av.texto }); continue }
    if (av.situacao === 'segredo') {
      // arquivo .env solto (por exemplo montado num contêiner): não vai em tar, vai cifrado. Dentro de pasta já coletada, ela mesma o leva.
      const dono = feitas.find((f) => dentro(f, p.caminho))
      if (dono) { entradas.push({ ...base, estado: 'coberta', motivo: `já está dentro de ${dono}` }); continue }
      entradas.push({ ...base, estado: 'segredo-cifrado', motivo: 'arquivo de segredo: vai cifrado em segredos.tar.gpg', bytes_origem: av.bytes })
      segredos.push({ caminho: p.caminho, real: av.real, tipo, origem: (p.origens || [])[0] || tipo })
      continue
    }
    if (av.situacao !== 'ok') {
      entradas.push({ ...base, estado: 'nao-coletada', motivo: av.texto })
      if (av.situacao === 'precisa-root') naoColetado.push({ caminho: p.caminho, motivo: PRECISA_ROOT })
      continue
    }
    const dono = feitas.find((f) => dentro(f, p.caminho))
    if (dono) { entradas.push({ ...base, estado: 'coberta', motivo: `já está dentro de ${dono}` }); continue }
    fs.mkdirSync(path.join(stage, dir), { recursive: true })
    const parte = `${dir}/${nomeParte(p.caminho, usados)}.tar.gz`
    const r = empacotar(av, path.join(stage, parte), stage, ++n)
    if (!r.ok) {
      fs.rmSync(path.join(stage, parte), { force: true })
      entradas.push({ ...base, estado: 'nao-coletada', motivo: `o tar falhou: ${r.erro}` })
      continue
    }
    const sha = sha256Arquivo(path.join(stage, parte))
    arquivos.push(parte); somas[parte] = sha; feitas.push(p.caminho)
    entradas.push({
      ...base, estado: 'coletada', parte, bytes_origem: av.bytes, bytes_parte: fs.statSync(path.join(stage, parte)).size, sha256: sha, entradas: av.entradas,
      ilegiveis_total: av.ilegiveis.length, excluidos_total: av.excluidos.length, excluidos: av.excluidos.slice(0, 20), aviso: r.aviso,
      segredos_total: av.segredos.length, segredos: av.segredos.slice(0, 20),
    })
    for (const rel of av.segredos) segredos.push({ caminho: `${p.caminho.replace(/\/+$/, '')}/${rel}`, real: path.join(av.real, rel), tipo, origem: (p.origens || [])[0] || tipo })
    plano.push([tipo, p.certeza, av.tipo, parte, av.bytes, campo(p.caminho)])
    if (av.ilegiveis.length) naoColetado.push({ caminho: `${p.caminho} (${av.ilegiveis.length} item(ns) ilegíveis, ex.: ${av.ilegiveis.slice(0, 3).join(', ')})`, motivo: PRECISA_ROOT })
  }
  return { arquivos, somas, entradas, naoColetado, plano, segredos }
}
