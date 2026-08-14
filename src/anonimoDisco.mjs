/**
 * F12: a camada de disco da anonimização.
 *
 * O motor (`anonimizar.mjs`) é puro e veio pronto do Pierre. Este arquivo é o
 * que decide **onde** a cópia mascarada vive e **onde o mapa fica guardado**.
 *
 * ## O mapa é o segredo agora, e essa inversão é o ponto
 *
 * Depois de mascarar, o texto é inofensivo: `<PESSOA_1> paga a <EMPRESA_2>`.
 * Quem desfaz tudo é o mapa. Então ele vive **fora do projeto** e fora de
 * qualquer pasta que a IA leia: `~/.claude/control-center-anon/`, com permissão
 * de dono. Guardar o mapa junto da cópia mascarada seria trancar a porta e
 * pendurar a chave na maçaneta.
 *
 * ## Por que a cópia mascarada vai para o temporário do sistema
 *
 * Ela não é artefato do projeto: é derivada, descartável e não pode acabar num
 * commit por acidente. `os.tmpdir()` some sozinho, e é o mesmo lugar que a
 * Bancada usa para log de corrida.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { anonimizar, reidentificar, vazou } from './anonimizar.mjs'

export const DIR_MAPAS = path.join(os.homedir(), '.claude', 'control-center-anon')
export const DIR_COPIAS = path.join(os.tmpdir(), 'cc-anon')

/** Extensões que valem a pena mascarar: texto que costuma carregar dado
 *  pessoal. Binário e imagem ficam de fora porque o mascarador é de texto —
 *  fingir que cobre PDF escaneado seria a pior mentira possível aqui. */
export const EXTENSOES = new Set([
  '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm',
  '.doc', '.docx', '.rtf', '.odt', '.pdf',
  '.log', '.eml', '.vtt', '.srt',
])

/** As que o mascarador NÃO lê de verdade: são compactadas ou binárias, e o
 *  texto sai como lixo. Reportadas como "não dá para mascarar", nunca como
 *  "mascarado" — dizer que protegeu sem ter protegido é o erro mais caro. */
export const OPACAS = new Set(['.pdf', '.docx', '.doc', '.odt', '.rtf'])

export const deveMascarar = (arquivo) => EXTENSOES.has(path.extname(String(arquivo)).toLowerCase())
export const ehOpaco = (arquivo) => OPACAS.has(path.extname(String(arquivo)).toLowerCase())

const idDe = (arquivo, texto) => crypto
  .createHash('sha256').update(`${arquivo}:${texto.length}`).digest('hex').slice(0, 12)

/**
 * Mascara um arquivo e devolve o caminho da cópia limpa.
 *
 * Nunca toca no original. Se algo der errado, devolve `ok:false` e quem chamou
 * decide — no hook, decidir é BLOQUEAR a leitura, porque falhar aberto aqui
 * significa o dado passar em claro.
 */
export function mascararArquivo(arquivo) {
  let texto = ''
  try {
    texto = fs.readFileSync(arquivo, 'utf8')
  } catch (e) {
    return { ok: false, erro: `não deu para ler: ${String(e?.message || e)}` }
  }

  if (ehOpaco(arquivo) && texto.includes('\u0000')) {
    return { ok: false, opaco: true, erro: 'formato binário: o mascarador de texto não enxerga o conteúdo' }
  }

  const r = anonimizar(texto)
  const escapou = vazou(r.texto, r.mapa)
  if (escapou.length) {
    // A rede de segurança do Pierre acusou. Não existe "mascarar quase tudo".
    return { ok: false, erro: `a conferência achou ${escapou.length} valor(es) que escaparam` }
  }

  const id = idDe(arquivo, texto)
  fs.mkdirSync(DIR_COPIAS, { recursive: true })
  fs.mkdirSync(DIR_MAPAS, { recursive: true, mode: 0o700 })

  const copia = path.join(DIR_COPIAS, `${id}-${path.basename(arquivo)}`)
  fs.writeFileSync(copia, r.texto, 'utf8')

  const mapaArq = path.join(DIR_MAPAS, `${id}.json`)
  fs.writeFileSync(mapaArq, JSON.stringify({
    origem: arquivo, mapa: r.mapa, em: new Date().toISOString(),
    achados: r.achados.map((a) => ({ tipo: a.tipo, confianca: a.confianca })),
  }, null, 1), { mode: 0o600 })

  return {
    ok: true,
    copia,
    id,
    mapa: mapaArq,
    quantos: Object.keys(r.mapa).length,
    tipos: [...new Set(r.achados.map((a) => a.tipo))],
    // confiança baixa é o que a tela de revisão do Pierre existe para mostrar:
    // âncora de nome acerta muito e não é prova
    duvidosos: r.achados.filter((a) => a.confianca < 0.6).length,
  }
}

/** Devolve os nomes reais num texto que veio com etiquetas. É o caminho de
 *  volta: roda aqui, na máquina dele, com um mapa que nunca saiu. */
export function remontar(texto, id) {
  try {
    const { mapa } = JSON.parse(fs.readFileSync(path.join(DIR_MAPAS, `${id}.json`), 'utf8'))
    return { ok: true, texto: reidentificar(texto, mapa) }
  } catch (e) {
    return { ok: false, erro: `não achei o mapa ${id}: ${String(e?.message || e)}` }
  }
}

/** O histórico do que foi mascarado. Sem isto não há como responder "o que
 *  exatamente saiu daqui?", que é a pergunta que um advogado precisa responder. */
export function registro(limite = 50) {
  let arquivos = []
  try {
    arquivos = fs.readdirSync(DIR_MAPAS).filter((f) => f.endsWith('.json'))
  } catch { return [] }

  return arquivos.map((f) => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DIR_MAPAS, f), 'utf8'))
      return {
        id: f.replace(/\.json$/, ''),
        origem: d.origem,
        em: d.em,
        quantos: Object.keys(d.mapa || {}).length,
        tipos: [...new Set((d.achados || []).map((a) => a.tipo))],
      }
    } catch { return null }
  }).filter(Boolean).sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, limite)
}
