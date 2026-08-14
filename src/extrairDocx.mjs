/**
 * Extrair texto de `.docx` sem dependência nenhuma.
 *
 * O Felipe perguntou o que eu deveria ter perguntado sozinho: *"mas se o PDF
 * não lê, no Pierre ele também não lê contrato em PDF?"*. Não: o Pierre lê PDF
 * e DOCX (`extrair.ts`, com `pdfjs-dist` e `mammoth`). Eu tinha portado só o
 * detector e deixado o extrator para trás, o que fazia o mascarador bloquear
 * justamente o formato em que contrato costuma chegar.
 *
 * ## Por que código próprio em vez de trazer o `mammoth`
 *
 * As duas bibliotecas somam 36 MB (34 só o `pdfjs-dist`), e este projeto tem
 * regra de zero dependência de runtime. Para `.docx` isso não custa nada: o
 * formato é um ZIP com XML dentro, e o Node já traz o descompactador. São umas
 * 50 linhas contra 2 MB de biblioteca.
 *
 * Para PDF a conta é outra, e a resposta honesta é não: PDF tem fonte embutida,
 * codificação própria e texto em ordem de desenho, não de leitura. Escrever
 * isso à mão daria um extrator ruim disfarçado de solução.
 *
 * ## O que este extrator NÃO faz, de propósito
 *
 * Não junta palavra partida por hífen no fim da linha, não normaliza espaço
 * duplo, não conserta nada. É a mesma decisão registrada no `extrair.ts` do
 * Pierre, e o motivo vale repetir: quem lê este texto depois é um regex com
 * validação de dígito. "CPF nº 529.982.247-25" costurado errado perde o dígito
 * verificador, e o detector deixa de reconhecer. **Texto fiel vale mais que
 * texto bonito.**
 */
import fs from 'node:fs'
import zlib from 'node:zlib'

const ASSINATURA_ARQUIVO = 0x04034b50 // PK\x03\x04, começo de cada entrada do ZIP

/**
 * Acha uma entrada dentro do ZIP e devolve o conteúdo já descompactado.
 *
 * Varre os cabeçalhos locais em vez de ler o índice central. É mais simples e
 * suficiente aqui: só se procura um caminho conhecido e fixo, e não se lista o
 * pacote inteiro.
 */
function entradaDoZip(buffer, alvo) {
  for (let i = 0; i < buffer.length - 30; i++) {
    if (buffer.readUInt32LE(i) !== ASSINATURA_ARQUIVO) continue

    const metodo = buffer.readUInt16LE(i + 8)
    const comprimido = buffer.readUInt32LE(i + 18)
    const tamNome = buffer.readUInt16LE(i + 26)
    const tamExtra = buffer.readUInt16LE(i + 28)
    const nome = buffer.subarray(i + 30, i + 30 + tamNome).toString('utf8')
    if (nome !== alvo) continue

    const inicio = i + 30 + tamNome + tamExtra
    const dados = buffer.subarray(inicio, inicio + comprimido)
    try {
      // 8 = deflate, que é o que o Word usa. 0 = guardado sem compressão.
      return metodo === 8 ? zlib.inflateRawSync(dados) : dados
    } catch {
      return null
    }
  }
  return null
}

/** Entidades XML que aparecem em texto de contrato. Sem isto, `&amp;` chega
 *  literal no detector e uma razão social com "&" sai errada no relatório. */
const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }

/**
 * O XML do Word vira texto legível.
 *
 * Parágrafo (`w:p`) vira quebra de linha, e quebra explícita (`w:br`) também:
 * sem isso o documento inteiro sai numa linha só, e a janela de contexto que o
 * detector usa para CEP e RG (60 caracteres para cada lado) passa a olhar o
 * texto errado.
 */
export function textoDoXml(xml) {
  return String(xml)
    .replace(/<w:p[\s>]/g, '\n<w:p ')
    .replace(/<w:br\s*\/?>/g, '\n')
    .replace(/<w:tab\s*\/?>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTIDADES[m])
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** O texto de um `.docx`. Devolve `null` quando o arquivo não é o que diz ser,
 *  para quem chamou decidir — no hook, decidir é bloquear. */
export function extrairDocx(arquivo) {
  let buffer
  try {
    buffer = fs.readFileSync(arquivo)
  } catch {
    return null
  }
  // Todo .docx começa com a assinatura de ZIP. Arquivo renomeado morre aqui.
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== ASSINATURA_ARQUIVO) return null

  const doc = entradaDoZip(buffer, 'word/document.xml')
  if (!doc) return null

  const texto = textoDoXml(doc.toString('utf8'))
  return texto || null
}
