/**
 * CC-347 — mudar o estado de uma frente escrevendo no `docs/ROADMAP.md`.
 *
 * Nasceu do kambam: ele escolheu que arrastar um cartão entre colunas **escreve
 * no backlog do projeto**, e não numa posição guardada só no painel. A razão é
 * dele e está certa: o estado já mora no arquivo, e duas verdades para a mesma
 * pergunta é o defeito que este projeto passa o tempo consertando.
 *
 * ## Fica separado de `roadmap.mjs` de propósito
 *
 * O leitor é usado no caminho de 2 em 2 segundos e por meia dúzia de telas.
 * Escrita é outra responsabilidade e outro risco: este é o arquivo mais
 * disputado de qualquer projeto daqui, editado à mão o tempo todo, e é a fonte
 * de verdade do trabalho. Um leitor que também escreve convida a chamada
 * errada.
 *
 * ## O estado é um emoji no título, e só
 *
 * `estadoDe()` decide por emoji antes de olhar palavra, e o emoji ganha quando
 * os dois se contradizem. Então mudar de estado é trocar UM caractere no começo
 * do título, sem mexer no texto que ele escreveu. É também por isso que "na
 * fila" não tem emoji próprio: é a ausência dos outros três.
 *
 * ## O que este módulo recusa, e por quê
 *
 * Recusa quando o alvo não bate em exatamente UMA linha. Backlog tem título
 * parecido às pencas, e trocar o estado do item errado é pior que não trocar:
 * ele não veria, e o quadro passaria a discordar do arquivo sem ninguém saber.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Os quatro estados que o arquivo sabe escrever, e o marcador de cada um.
 *  `aberto` é a AUSÊNCIA de marcador, não um marcador próprio. */
export const MARCA_DE = {
  aberto: '',
  esperando: '⏸',
  bloqueado: '🔴',
  feito: '✅',
}

/* Todos os marcadores de estado que o leitor reconhece. Tirar só o que este
   módulo escreve deixaria resíduo: um título com `🟡` continuaria "esperando"
   depois de arrastado para a fila, e a tela discordaria do arquivo. */
const MARCADORES = /[🔴⛔⏸🟡⏳✅✔🟢]/gu

const CAMINHOS = [['docs', 'ROADMAP.md'], ['ROADMAP.md'], ['docs', 'roadmap.md'], ['ROADMAP.MD']]

export function acharArquivo(raiz) {
  for (const partes of CAMINHOS) {
    const p = path.join(raiz, ...partes)
    try { if (fs.statSync(p).isFile()) return p } catch { /* segue */ }
  }
  return null
}

/**
 * Qual linha `###` é aquele cartão.
 *
 * O identificador (`CC-338`) é a âncora boa: é único no arquivo e sobrevive a
 * ele reescrever o título. Sem identificador, cai no título limpo, e aí a
 * comparação ignora marcador e espaço — mas continua exigindo casar UMA vez só.
 */
export function acharLinha(linhas, { id = null, titulo = null } = {}) {
  const cabecalhos = []
  linhas.forEach((linha, i) => { if (/^###\s+/.test(linha)) cabecalhos.push(i) })

  if (id) {
    /* Preso ao começo do título, depois do `###`: o mesmo código aparece no
       corpo de outros itens ("depende do CC-338"), e casar lá trocaria o estado
       de um item que só CITA o alvo. */
    const alvo = new RegExp('^###\\s*[^A-Za-z0-9]*' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
    const achados = cabecalhos.filter((i) => alvo.test(linhas[i]))
    if (achados.length === 1) return achados[0]
    if (achados.length > 1) return { erro: `o código ${id} aparece em ${achados.length} títulos` }
  }

  if (titulo) {
    const normal = (s) => String(s).replace(MARCADORES, '').replace(/^###\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const alvo = normal(titulo)
    const achados = cabecalhos.filter((i) => normal(linhas[i]) === alvo)
    if (achados.length === 1) return achados[0]
    if (achados.length > 1) return { erro: `esse título aparece em ${achados.length} lugares` }
  }

  return { erro: 'não achei esse item no backlog' }
}

/** Troca o marcador da linha, preservando o texto dele. */
export function linhaComEstado(linha, estado) {
  const marca = MARCA_DE[estado]
  const cru = String(linha)
  const semCabecalho = cru.replace(/^###\s*/, '')
  /* Tira os marcadores antigos e o espaço que sobra na frente. Só do COMEÇO:
     um ✅ no meio da frase é texto dele, não estado. */
  const limpo = semCabecalho.replace(/^(?:\s*[🔴⛔⏸🟡⏳✅✔🟢]\s*)+/u, '').trimStart()
  return '### ' + (marca ? marca + ' ' : '') + limpo
}

/**
 * Escreve. Cópia antes, e escrita atômica.
 *
 * A cópia existe pela mesma razão do bloco de notas: é arquivo que ele edita à
 * mão e que não tem outra fonte. Aqui há o git por baixo, mas o backlog costuma
 * ficar sem commit por horas, e "está no git" não vale para o que ainda não foi
 * commitado.
 */
export function trocarEstado(raiz, { id = null, titulo = null, para }) {
  if (!(para in MARCA_DE)) return { ok: false, erro: `estado desconhecido: ${para}` }
  const arquivo = acharArquivo(raiz)
  if (!arquivo) return { ok: false, erro: 'este projeto não tem ROADMAP.md' }

  let texto = null
  try { texto = fs.readFileSync(arquivo, 'utf8') } catch (e) { return { ok: false, erro: String(e.message || e) } }

  /* CRLF é a regra nos arquivos que vêm do PC, e `.` não casa `\r`: dividir com
     `split(/\r?\n/)` é obrigatório aqui, e a junção devolve a quebra original
     para não sujar o arquivo inteiro num diff de uma linha. */
  const crlf = texto.includes('\r\n')
  const linhas = texto.split(/\r?\n/)

  const achado = acharLinha(linhas, { id, titulo })
  if (typeof achado !== 'number') return { ok: false, erro: achado.erro }

  const antes = linhas[achado]
  const depois = linhaComEstado(antes, para)
  if (antes.trim() === depois.trim()) return { ok: true, mudou: false, linha: achado, texto: antes }

  linhas[achado] = depois
  const saida = linhas.join(crlf ? '\r\n' : '\n')

  try {
    try { fs.copyFileSync(arquivo, `${arquivo}.bak`) } catch { /* sem cópia, mas segue */ }
    const tmp = `${arquivo}.tmp`
    fs.writeFileSync(tmp, saida, 'utf8')
    fs.renameSync(tmp, arquivo)
  } catch (e) {
    return { ok: false, erro: String(e.message || e) }
  }
  return { ok: true, mudou: true, linha: achado, de: antes.trim(), para: depois.trim(), arquivo }
}
