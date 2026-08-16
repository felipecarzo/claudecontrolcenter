/**
 * F16: tirar o texto de um PDF usando só o que vem no Node.
 *
 * ## Por que isto existe, em vez de `pdfjs-dist`
 *
 * O mascarador (F12) bloqueia o que não consegue ler, e essa é a escolha certa:
 * dizer que protegeu sem ter protegido é o pior erro possível aqui. Só que PDF é
 * o formato em que contrato chega, então "bloqueado" significava, na prática,
 * que o recurso não servia para o uso real.
 *
 * As três saídas eram trazer `pdfjs-dist` (34 MB, e o fim da regra de zero
 * dependência de runtime deste projeto), escrever isto, ou deixar bloqueado.
 * A medição decidiu: nos 3 PDFs reais de contrato que temos, este arquivo
 * extrai **o mesmo conjunto de dados pessoais** que o `.txt` equivalente.
 *
 * ## O que ele NÃO faz, e é importante saber
 *
 * Não desenha nada, não sabe posição de coluna, não lê PDF escaneado (imagem
 * não tem texto), não abre PDF cifrado, e não entende `/ObjStm` (objeto dentro
 * de objeto comprimido, comum em PDF 1.5+ do Word). Nesses casos ele devolve
 * texto curto ou vazio, e quem chama trata como "não consegui ler" — que faz o
 * hook bloquear, exatamente como antes.
 *
 * ## As três coisas que custaram tempo, e não redescobrir
 *
 * 1. **`N 0 obj` aparece por acaso DENTRO dos dados binários da fonte.** Indexar
 *    os objetos por número num Map fazia um match espúrio sobrescrever o objeto
 *    real, e metade do contrato sumia sem erro nenhum: 1201 de 2386 caracteres,
 *    cortando no meio de uma frase. Por isso `regioesDeStream()` roda primeiro,
 *    e todo candidato dentro de uma dessas faixas é descartado.
 *
 * 2. **O texto do PDF não são letras, são números de glifo.** Fonte `Type0` com
 *    `Identity-H` (o que o Chrome gera) escreve `<0026>` onde há um "C". O mapa
 *    de volta é o `/ToUnicode`, que é texto comprimido dentro do próprio PDF.
 *    Sem ele, a extração sai como lixo — e sai em silêncio.
 *
 * 3. **O Chrome emite um `Td` por caractere.** A regra ingênua "`Td` quebra
 *    linha" devolvia o contrato inteiro em coluna, uma letra por linha. O que
 *    quebra linha é a coordenada **Y** mudar, então é preciso rastreá-la.
 */
import fs from 'node:fs'
import zlib from 'node:zlib'

/** Faixas `stream ... endstream` do arquivo. Tudo que casa "N 0 obj" dentro de
 *  uma delas é coincidência em dado binário, não um objeto de verdade. */
function regioesDeStream(bruto) {
  const faixas = []
  let i = 0
  while ((i = bruto.indexOf('stream', i)) >= 0) {
    // "endstream" também contém "stream": só interessa o início de verdade
    if (bruto.slice(i - 3, i) === 'end') { i += 6; continue }
    const fim = bruto.indexOf('endstream', i)
    if (fim < 0) break
    faixas.push([i, fim])
    i = fim + 9
  }
  return faixas
}

const dentroDe = (faixas, pos) => faixas.some(([a, b]) => pos > a && pos < b)

function lerObjetos(buf, bruto) {
  const faixas = regioesDeStream(bruto)
  const objetos = new Map()
  for (const m of bruto.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
    if (dentroDe(faixas, m.index)) continue
    const inicio = m.index + m[0].length
    const fim = bruto.indexOf('endobj', inicio)
    if (fim > 0 && !objetos.has(Number(m[1]))) objetos.set(Number(m[1]), { inicio, fim })
  }
  return objetos
}

/** Conteúdo de um objeto, já descomprimido quando for Flate. */
function streamDe(buf, bruto, objetos, num) {
  const o = objetos.get(num)
  if (!o) return null
  const cabecalho = bruto.slice(o.inicio, o.fim)
  const i = cabecalho.indexOf('stream')
  if (i < 0) return null
  let ini = o.inicio + i + 6
  if (bruto[ini] === '\r') ini++
  if (bruto[ini] === '\n') ini++
  const dados = buf.subarray(ini, bruto.indexOf('endstream', ini))
  if (/FlateDecode/.test(cabecalho.slice(0, i))) {
    try { return zlib.inflateSync(dados) } catch { return null }
  }
  return dados
}

/** Junta todos os `/ToUnicode` do documento num mapa só: glifo -> texto.
 *  Fontes diferentes podem usar o mesmo número para glifos diferentes, mas na
 *  prática os geradores numeram por documento — e misturar é melhor que perder,
 *  porque `vazou()` do mascarador confere o resultado de qualquer jeito. */
function mapaDeGlifos(buf, bruto, objetos) {
  const mapa = new Map()
  for (const [, o] of objetos) {
    const ref = bruto.slice(o.inicio, Math.min(o.fim, o.inicio + 1200)).match(/\/ToUnicode\s+(\d+)\s+0\s+R/)
    if (!ref) continue
    const s = streamDe(buf, bruto, objetos, Number(ref[1]))
    if (!s) continue
    const txt = s.toString('latin1')

    for (const bloco of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const p of bloco[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        mapa.set(parseInt(p[1], 16), Buffer.from(p[2], 'hex').swap16().toString('utf16le'))
      }
    }
    for (const bloco of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const p of bloco[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        const de = parseInt(p[1], 16), ate = parseInt(p[2], 16), alvo = parseInt(p[3], 16)
        // faixa aberta demais é lixo de parse, não um mapa: 65k glifos não existem
        if (ate - de > 0xffff) continue
        for (let i = 0; de + i <= ate; i++) mapa.set(de + i, String.fromCodePoint(alvo + i))
      }
    }
  }
  return mapa
}

const N = '-?\\d*\\.?\\d+'
const OPERADORES = new RegExp(
  `(${N})\\s+(${N})\\s+(${N})\\s+(${N})\\s+(${N})\\s+(${N})\\s+Tm` +  // 1-6, posição absoluta
  `|(${N})\\s+(${N})\\s+T[dD]` +                                      // 7-8, deslocamento
  `|\\[((?:[^\\]\\\\]|\\\\.)*)\\]\\s*TJ` +                            // 9, texto com kerning
  `|<([0-9A-Fa-f\\s]+)>\\s*Tj` +                                      // 10, texto simples
  `|\\bT\\*|\\bBT\\b`,
  'g',
)

/**
 * O PDF quebra linha por LAYOUT, não por parágrafo: `(11) 98123-\n4567` é um
 * telefone só, partido pela largura da página. Sem juntar, o detector não o
 * encontra — foi exatamente o valor que escapou na primeira medição.
 *
 * **Esta é a regra do Pierre, e chegar nela custou uma medição.** A minha
 * primeira versão juntava muito mais: qualquer linha que não terminasse em
 * pontuação colava com a seguinte. Funcionava, e era exagero — medido nos 3
 * contratos, a regra estreita (dígito dos dois lados, hífen preservado) acha
 * **exatamente os mesmos valores**, sem o risco de colar duas linhas que eram
 * separadas de verdade.
 *
 * O `limpar()` do `extrair.ts` de lá já fazia assim desde 10/08, pelo mesmo
 * motivo, e eu não tinha olhado antes de escrever. Vale como método: quando o
 * outro lado já resolveu o problema, a versão dele provavelmente é mais estreita
 * — e estreita é melhor aqui, porque cada junção a mais é uma chance de mudar
 * texto que ninguém pediu para mudar.
 */
const juntarQuebraDeLayout = (t) => t.replace(/(\d-?)\n(\d)/g, '$1$2')

/** Extrai o texto. Devolve string vazia quando não consegue — nunca lança, e
 *  nunca devolve "quase o texto" sem avisar: quem chama trata vazio como
 *  bloqueio. */
export function extrairPdf(arquivo, { juntar = true } = {}) {
  let buf
  try { buf = fs.readFileSync(arquivo) } catch { return '' }
  const bruto = buf.toString('latin1')
  if (!bruto.startsWith('%PDF')) return ''
  // PDF cifrado: o texto sai como lixo, e lixo passaria pelo mascarador sem
  // ninguém perceber. Melhor recusar.
  if (/\/Encrypt\b/.test(bruto)) return ''

  const objetos = lerObjetos(buf, bruto)
  if (!objetos.size) return ''
  const glifos = mapaDeGlifos(buf, bruto, objetos)

  const daHex = (hex) => {
    let t = ''
    for (let i = 0; i + 4 <= hex.length; i += 4) t += glifos.get(parseInt(hex.slice(i, i + 4), 16)) ?? ''
    return t
  }

  let saida = ''
  for (const [num] of objetos) {
    const s = streamDe(buf, bruto, objetos, num)
    if (!s) continue
    const txt = s.toString('latin1')
    if (!/\bTJ\b|\bTj\b/.test(txt)) continue

    let y = null
    let linha = ''
    const fecharLinha = () => { if (linha.trim()) saida += `${linha.trimEnd()}\n`; linha = '' }

    for (const m of txt.matchAll(OPERADORES)) {
      if (m[6] !== undefined) {
        const novoY = Number(m[6])
        if (y !== null && Math.abs(novoY - y) > 0.5) fecharLinha()
        y = novoY
      } else if (m[8] !== undefined) {
        const dy = Number(m[8])
        if (Math.abs(dy) > 0.5) { fecharLinha(); y = (y ?? 0) + dy }
      } else if (m[9] !== undefined) {
        for (const p of m[9].matchAll(/<([0-9A-Fa-f\s]+)>/g)) linha += daHex(p[1].replace(/\s/g, ''))
      } else if (m[10] !== undefined) {
        linha += daHex(m[10].replace(/\s/g, ''))
      } else {
        fecharLinha()
      }
    }
    fecharLinha()
  }

  const limpo = saida.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  return (juntar ? juntarQuebraDeLayout(limpo) : limpo).trim()
}

export const _internos = { regioesDeStream, juntarQuebraDeLayout }
