/**
 * CC-655 e CC-657, design 2/4 e 4/4: as telas desenhadas antes do código (docs/design/telas/<tela>/v<N>.*),
 * e o antes e depois do site (as duas últimas rodadas de fotos do Coderoom). Aprovar é votar no baralho
 * "design" das cartas: o mesmo Tinder, o mesmo arquivo de votos que o agente já sabe ler. O baralho é
 * escrito pelo painel, nunca pelo agente. Nada aqui roda por temporizador: é sempre um pedido da tela.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as C from './cartas.mjs'
import { gravarNoProjeto } from './design.mjs'

export const DECK = 'design'
export const OPCOES = ['Aprovo', 'Pedir ajuste']
const TELA = /^[a-z0-9-]{1,40}$/
const VERSAO = /^v(\d{1,3})\.(html|png|jpg|webp)$/i
const IMG_REL = 'docs/cartas/img/design'
const pastaTelas = (raiz) => path.join(raiz, 'docs', 'design', 'telas')
const idTela = (tela, n) => 'tela-' + tela + '-v' + n
const existe = (raiz, rel) => fs.existsSync(path.join(raiz, rel))
const mtime = (f) => { try { return fs.statSync(f).mtimeMs } catch { return 0 } }
const nomesDeTela = (raiz) => { try { return fs.readdirSync(pastaTelas(raiz)).filter((n) => TELA.test(n)).sort() } catch { return [] } }

export function votosDoDeck(raiz) { const m = new Map(); for (const v of C.votos(raiz, DECK)) m.set(v.carta, v); return m }

function versoesDe(raiz, tela) {
  let arqs = []; try { arqs = fs.readdirSync(path.join(pastaTelas(raiz), tela)) } catch { return [] }
  const porN = new Map()
  for (const a of arqs) {
    const m = VERSAO.exec(a); if (!m) continue
    const n = Number(m[1]); const ext = m[2].toLowerCase(); const tipo = ext === 'html' ? 'html' : 'imagem'
    if (!porN.has(n) || tipo === 'html') porN.set(n, { n, ext, tipo, arq: 'docs/design/telas/' + tela + '/' + a })
  }
  return [...porN.values()].sort((a, b) => a.n - b.n)
}
function fotosDe(raiz, tela, v) {
  if (v.tipo === 'imagem') { const rel = IMG_REL + '/' + tela + '-v' + v.n + '.' + v.ext; return { celular: existe(raiz, rel) ? rel : null, computador: null } }
  const cel = IMG_REL + '/' + tela + '-v' + v.n + '-celular.jpg'; const comp = IMG_REL + '/' + tela + '-v' + v.n + '-computador.jpg'
  const velha = existe(raiz, cel) && mtime(path.join(raiz, v.arq)) > mtime(path.join(raiz, cel))
  return { celular: existe(raiz, cel) ? cel : null, computador: existe(raiz, comp) ? comp : null, ...(velha ? { velha: true } : {}) }
}

export function telas(raiz) {
  const votos = votosDoDeck(raiz)
  return nomesDeTela(raiz).map((tela) => {
    const versoes = versoesDe(raiz, tela).map((v) => ({ n: v.n, arq: v.arq, tipo: v.tipo, ext: v.ext, fotos: fotosDe(raiz, tela, v), voto: votos.get(idTela(tela, v.n)) || null }))
    const aprov = versoes.filter((v) => v.voto && (v.voto.escolhas || []).includes('Aprovo')).pop()
    return { tela, versoes, aprovada: aprov ? aprov.n : null }
  }).filter((t) => t.versoes.length)
}

function copiarImagens(raiz) {
  for (const t of nomesDeTela(raiz)) for (const v of versoesDe(raiz, t)) {
    if (v.tipo !== 'imagem') continue
    const rel = IMG_REL + '/' + t + '-v' + v.n + '.' + v.ext; const src = path.join(raiz, v.arq)
    if (!existe(raiz, rel) || mtime(src) > mtime(path.join(raiz, rel))) gravarNoProjeto(raiz, rel, fs.readFileSync(src))
  }
}

/** O baralho: a última versão de cada tela que já tem foto, mais o antes e depois mais recente. */
export function montarDeck(lista, comparacao) {
  const cartas = []
  for (const t of lista) {
    const v = t.versoes[t.versoes.length - 1]
    if (!v.fotos.celular) continue
    cartas.push({ id: idTela(t.tela, v.n), titulo: 'Tela ' + t.tela + ', versão ' + v.n, pergunta: 'Esta versão pode virar código?', olhe: 'A foto é a do celular. Na tela Design, aba Telas, estão a do computador e as versões anteriores.', img: v.fotos.celular, opcoes: OPCOES })
  }
  if (comparacao && comparacao.carta && comparacao.img) cartas.push({ id: comparacao.carta, titulo: comparacao.titulo, pergunta: 'A tela ficou como você queria?', olhe: 'A foto é a de depois, no celular. Na tela Design, aba Antes e depois, estão as duas lado a lado.', img: comparacao.img, opcoes: OPCOES })
  return cartas.length ? { titulo: 'Design: telas para aprovar', cartas } : null
}

/** Copia as versões em imagem, monta o baralho e grava só se mudou. Devolve { lista, gravou, erro? }. */
export function sincronizar(raiz, { comparacao = null } = {}) {
  copiarImagens(raiz)
  const lista = telas(raiz)
  const atual = C.lerDeck(raiz, DECK)?.deck || null
  // o antes e depois que já estava no baralho fica até chegar outro
  const velha = (atual?.cartas || []).find((c) => c.id.startsWith('antes-depois-'))
  const comp = comparacao || (velha ? { carta: velha.id, titulo: velha.titulo, img: velha.img } : null)
  const deck = montarDeck(lista, comp)
  if (!deck) return { lista, gravou: false }
  const erros = C.validarDeck(deck)
  if (erros.length) return { lista, gravou: false, erro: erros[0] }
  const texto = JSON.stringify(deck, null, 2) + '\n'
  let antes = null; try { antes = fs.readFileSync(path.join(raiz, 'docs', 'cartas', DECK + '.json'), 'utf8') } catch { antes = null }
  if (antes === texto) return { lista, gravou: false }
  gravarNoProjeto(raiz, 'docs/cartas/' + DECK + '.json', texto)
  return { lista, gravou: true }
}

/**
 * CC-655: fotografa uma tela desenhada (um arquivo HTML dentro de `pasta`) no celular (390) e no computador
 * (1440), sem explorar nada. Devolve { ok, fotos, erro } e nunca lança. Chama o filho `--captura` do
 * gateFotos.mjs, que sempre foi lido do disco a cada foto, sem mexer naquele arquivo (é de outra rota).
 */
export function fotografarArquivo({ pasta, arquivo, saida }) {
  const gateFotos = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gateFotos.mjs')
  fs.mkdirSync(saida, { recursive: true })
  /* O capturador sempre abre primeiro a página inicial da pasta (index.html), e a pasta de uma tela só tem
     v1.html, v2.html: sem index o servidor dele quebrava (medido em 07/10). A versão vai para uma pasta
     temporária como página inicial, junto com os arquivos da mesma pasta (estilo, imagem). */
  const palco = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-design-palco-'))
  for (const f of fs.readdirSync(pasta)) { const de = path.join(pasta, f); if (fs.statSync(de).isFile()) fs.copyFileSync(de, path.join(palco, f)) }
  fs.copyFileSync(path.join(pasta, arquivo), path.join(palco, 'index.html'))
  const plano = { explorar: false, acesso: null, entrar: [], telas: [{ nome: 'tela', caminho: '/', passos: [] }], prazoMs: 90000 }
  return new Promise((ok) => {
    execFile(process.execPath, ['--experimental-websocket', gateFotos, '--captura', palco, saida, JSON.stringify(plano)], { timeout: 120000, maxBuffer: 8 * 1024 * 1024 }, (e, _out, err) => {
      fs.rmSync(palco, { recursive: true, force: true })
      const fotos = fs.readdirSync(saida).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(saida, f))
      if (!fotos.length) return ok({ ok: false, erro: 'a foto falhou: ' + (String(err || e?.message || '').split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 200) || 'sem resposta do navegador') })
      ok({ ok: true, fotos })
    })
  })
}

let fila = Promise.resolve()
/** Fotografa a versão HTML de uma tela, uma por vez (o navegador é um só). `foto` entra por parâmetro para o teste. */
export function fotografarVersao(raiz, tela, n, { foto = null } = {}) {
  const tarefa = fila.then(async () => {
    if (!TELA.test(String(tela)) || !Number.isInteger(n)) return { ok: false, erro: 'tela ou versão inválida' }
    const pasta = path.join(pastaTelas(raiz), tela); const arquivo = 'v' + n + '.html'
    if (!fs.existsSync(path.join(pasta, arquivo))) return { ok: false, erro: 'esta versão não é uma página' }
    const tirar = foto || fotografarArquivo
    const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-design-'))
    try {
      const r = await tirar({ pasta, arquivo, saida })
      if (!r.ok) return r
      for (const tam of ['celular', 'computador']) {
        const f = r.fotos.find((x) => x.endsWith('-' + tam + '.jpg')); if (!f) continue
        gravarNoProjeto(raiz, IMG_REL + '/' + tela + '-v' + n + '-' + tam + '.jpg', fs.readFileSync(f))
      }
      return { ok: true, ...sincronizar(raiz) }
    } finally { fs.rmSync(saida, { recursive: true, force: true }) }
  })
  fila = tarefa.catch(() => {})
  return tarefa
}

const chaveFoto = (f) => path.basename(String(f)).replace(/\.jpe?g$/i, '').replace(/^\d+-/, '')
/** O antes e depois: as duas últimas rodadas de fotos do Coderoom deste projeto. `gate` entra por parâmetro para o teste. */
export async function comparacao(raiz, { gate = null } = {}) {
  const G = gate || await import('./gate.mjs')
  const alvo = path.resolve(raiz)
  for (const c of G.listar().filter((x) => x.cwd && path.resolve(x.cwd) === alvo)) {
    const rod = ((G.lerConversa(c.id, { bytes: 1024 * 1024 }) || {}).mensagens || []).filter((m) => m.fotos && m.fotos.length).slice(-2)
    if (rod.length < 2) continue
    const [a, d] = rod
    const chaves = [...new Set([...a.fotos, ...d.fotos].map(chaveFoto))]
    const pares = chaves.map((k) => {
      const m = /^(.*)-(celular|computador)$/.exec(k) || [k, k, 'celular']
      return { tela: m[1], tam: m[2], antes: a.fotos.find((f) => chaveFoto(f) === k) || null, depois: d.fotos.find((f) => chaveFoto(f) === k) || null }
    })
    return { conversa: c.id, titulo: 'Antes e depois: ' + pares.filter((p) => p.tam === 'celular').length + ' telas', agente: c.agentePadrao || 'agy',
      antes: { seq: a.seq, em: a.em || null }, depois: { seq: d.seq, em: d.em || null }, pares,
      carta: 'antes-depois-' + String(c.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 8) + '-' + d.seq }
  }
  return null
}

/** Põe o antes e depois no baralho: copia a foto de depois (celular) para dentro de docs/cartas e sincroniza. */
export function comparacaoNoDeck(raiz, comp) {
  if (!comp) return sincronizar(raiz)
  const f = (comp.pares.find((p) => p.tam === 'celular' && p.depois) || comp.pares.find((p) => p.depois) || {}).depois
  if (!f) return sincronizar(raiz)
  const rel = IMG_REL + '/' + comp.carta + '.jpg'
  try { if (!existe(raiz, rel)) gravarNoProjeto(raiz, rel, fs.readFileSync(f)) } catch { return sincronizar(raiz) }
  return sincronizar(raiz, { comparacao: { carta: comp.carta, titulo: comp.titulo, img: rel } })
}

/** O que o agente precisa saber das telas, em linhas curtas para o pacote do Coderoom. */
export function paraOAgente(raiz) {
  const L = []
  for (const t of telas(raiz)) {
    const ult = t.versoes[t.versoes.length - 1]
    const ap = t.versoes.find((v) => v.n === t.aprovada)
    if (ap) L.push('  tela ' + t.tela + ': a versão aprovada é a ' + ap.n + ' (' + ap.arq + '). É ela que vira código.')
    if (ult.voto && (ult.voto.escolhas || []).includes('Pedir ajuste')) L.push('  tela ' + t.tela + ', versão ' + ult.n + ': ele pediu ajuste: ' + String(ult.voto.nota || 'sem nota').slice(0, 200))
    else if (!ult.voto && ult.n !== t.aprovada) L.push('  tela ' + t.tela + ', versão ' + ult.n + ': esperando a aprovação dele.')
  }
  return L
}
