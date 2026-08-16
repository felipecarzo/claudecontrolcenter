/**
 * O padrão de resposta do Felipe, e a medição de quanto eu o sigo.
 *
 * ## De onde saiu
 *
 * De um estudo que ele mandou fazer em 15/08, sobre uma explicação minha do
 * CC-48 que ficou confusa. As palavras dele: *"algumas coisas começam como se
 * já existisse um contexto recente e fosse uma resposta, mas a pergunta nunca
 * existiu, e quem você tá respondendo não tá lendo"*.
 *
 * Os três vícios, achados no meu próprio texto:
 *
 * 1. **Respondo pergunta que ele não fez.** "Não inventei canal novo", "não fiz
 *    de propósito, por dois motivos" — ninguém me acusou. Escrevo prevendo
 *    objeção, e ele paga em linhas para ler uma discussão que não é dele.
 * 2. **Reexplico o que ele mesmo me contou.** O primeiro parágrafo do CC-48
 *    descrevia o problema das rotas, que foi ele quem levantou.
 * 3. **Justifico tamanho e escolha antes de perguntarem.** Os 60 KB do quadro,
 *    o limite de 2 MB do pacote.
 *
 * O mesmo texto reescrito no padrão: 35 linhas viraram 9, sem perda que ele
 * tenha sentido falta.
 *
 * ## O limite, e ele é honesto
 *
 * **Nenhum hook consegue barrar prosa.** Hook bloqueia ferramenta; texto sai do
 * modelo direto para a tela. Então isto é injeção de contexto, não gate — a
 * instrução mais forte que existe aqui, e ainda assim uma instrução. É a
 * diferença entre este arquivo e o `framework-guard`, e vale dizer em voz alta
 * para ninguém confundir os dois níveis de garantia.
 *
 * Foi por isso que ele pediu a medição junto: se não dá para impedir, que ao
 * menos apareça quando eu voltar ao vício.
 */
import fs from 'node:fs'
import path from 'node:path'
import { casaClaude } from './platform.mjs'

export const ARQUIVO_PADRAO = () => path.join(casaClaude(), 'control-center-estilo.md')
export const ARQUIVO_MEDIDAS = () => path.join(casaClaude(), 'control-center-estilo.json')

/** O texto embutido. Vira arquivo na primeira leitura, e a partir daí quem
 *  manda é o arquivo — o padrão é dele, não meu, e ele precisa poder mexer. */
export const PADRAO_EMBUTIDO = `# Como responder ao Felipe

Escrito por ele em 15/08/2026, a partir de uma explicação minha que ficou ruim.

1. **A primeira frase é o que mudou para ele.** Sem contexto, sem recapitulação,
   sem "o problema era esse".
2. **Depois, só o que ele decide ou faz.**
3. **Não justificar o que ele não questionou.** Se uma escolha merece defesa, ela
   é uma linha, não um parágrafo.
4. **O porquê fica guardado** no código e no diário. Ele puxa quando quiser.
5. **Palavra de resgate: "abre".** Ele digita, eu abro o detalhe daquele ponto.
   Enquanto não digitar, fico curto.

O item 5 é o que permite cortar sem deixá-lo sem informação.

## Como explicar uma coisa técnica: quatro campos, sempre nesta ordem

Criado por ele no mesmo dia, e pelo motivo dele: *"as suas explicações nunca
seguem padrões"*. O padrão acima diz QUANTO falar; este diz COMO explicar.

1. **O que é** — em português comum, uma ou duas linhas.
2. **Onde fica** — o caminho exato, na máquina dele.
3. **O que fazer** — o conteúdo ou o comando, com cada parte explicada, e a
   regra que não pode ser quebrada, se houver.
4. **Como saber que deu certo** — o teste, e o que aparece quando funcionou.
   **É o campo que sempre faltou.**

As duas regras que já existiam continuam valendo: comando de terminal se quebra
parte por parte, e valor vem com a escala ("borda em 10, de 0 a 100").

## O vício a evitar, com exemplo real

Parágrafo que começa se defendendo de pergunta que ninguém fez:

> ~~"Não inventei canal novo."~~
> ~~"Não fiz essa última parte de propósito, por dois motivos."~~

E reexplicar para ele o que foi ele quem contou. Se ele levantou o problema, não
descreva o problema de volta: vá direto ao que mudou.

## Guia de mais de dois passos vira etapa, uma por mensagem

Pedido dele em 15/08, depois de um passo a passo do Bitwarden que se perdeu
inteiro porque a primeira âncora era relativa ("logo abaixo de X") e ele não
achou o X:

> "se eu não acho o primeiro item da sua mensagem eu automaticamente perco todo
> o resto do texto"

**O custo de uma âncora errada não é a âncora, é a mensagem inteira.** A partir
de três passos que ELE executa numa interface, mande só o primeiro, com:

1. o total anunciado, "etapa 1 de 3";
2. âncora **absoluta** — o nome exato do botão ou do menu, nunca "logo abaixo
   de" nem "no canto". Não sabe o nome exato? Diga que não sabe;
3. o critério de sucesso: o que aparece na tela quando deu certo;
4. a parada declarada: "se não achar, me diga e paramos aqui".

Relato do que EU fiz não conta como passo: ele não executa nada e a ordem não
importa. É a mesma família do gate de MVP — parar no primeiro critério que não
fecha, em vez de despejar tudo e deixar a conferência por conta dele.
`

export function lerPadrao() {
  const arquivo = ARQUIVO_PADRAO()
  try { return fs.readFileSync(arquivo, 'utf8') } catch { /* ainda não existe */ }
  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    fs.writeFileSync(arquivo, PADRAO_EMBUTIDO)
  } catch { /* disco somente leitura: o embutido serve igual */ }
  return PADRAO_EMBUTIDO
}

/**
 * Aberturas de parágrafo que denunciam autodefesa.
 *
 * Todas saíram de texto meu de verdade, não de imaginação. A lista é curta de
 * propósito: cada padrão a mais é uma chance de falso positivo, e o número aqui
 * serve como **tendência**, nunca como nota. "Não é" e "Não foi" ficam de fora
 * justamente por serem comuns em frase legítima.
 */
export const ABERTURAS_DE_DEFESA = [
  /^n[ãa]o inventei\b/i,
  /^n[ãa]o fiz\b/i,
  /^n[ãa]o \w+ (?:isso|isto|essa|esta|aquilo)\s+(?:de prop[óo]sito|por(?:que)?)\b/i,
  /^vale (?:dizer|lembrar|notar|registrar)\b/i,
  /^cabe (?:notar|dizer|lembrar)\b/i,
  /^s[óo] para (?:deixar claro|constar)\b/i,
  /^longe de mim\b/i,
  /^antes de (?:mais nada|qualquer coisa|come[çc]ar)\b/i,
  /^[ée] importante (?:notar|dizer|lembrar)\b/i,
  /^repare que\b/i,
  /^como (?:eu )?(?:j[áa] )?(?:disse|expliquei|mencionei)\b/i,
]

/** Mede uma resposta. Puro: recebe texto, devolve números. */
export function medir(texto) {
  const limpo = String(texto || '').trim()
  if (!limpo) return { linhas: 0, palavras: 0, paragrafos: 0, autodefesa: 0, trechos: [] }

  // bloco de código não conta como prosa: ele é o trabalho, não o floreio
  const semCodigo = limpo.replace(/```[\s\S]*?```/g, '')
  const paragrafos = semCodigo.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  const trechos = []
  for (const p of paragrafos) {
    // tira marca de lista e negrito antes de olhar a abertura
    const abertura = p.replace(/^[-*>\d.)\s]+/, '').replace(/\*\*/g, '')
    if (ABERTURAS_DE_DEFESA.some((re) => re.test(abertura))) trechos.push(abertura.slice(0, 70))
  }

  return {
    linhas: limpo.split('\n').length,
    palavras: semCodigo.split(/\s+/).filter(Boolean).length,
    paragrafos: paragrafos.length,
    autodefesa: trechos.length,
    trechos,
  }
}

/**
 * A última coisa que eu escrevi para ele, tirada do transcrito.
 *
 * Lê só a cauda do arquivo (256 KB), pela mesma razão do `transcript.mjs`:
 * transcrito passa de 25 MB, e este código roda no fim de **todo** turno. Ler
 * inteiro aqui travaria a conversa a cada resposta.
 *
 * Pega apenas blocos de texto: `tool_use` é trabalho, não prosa, e contá-lo
 * inflaria o tamanho de qualquer resposta que mexeu em arquivo.
 */
export function ultimaResposta(arquivo, limite = 256 * 1024) {
  let fd
  try {
    const { size } = fs.statSync(arquivo)
    fd = fs.openSync(arquivo, 'r')
    const tamanho = Math.min(size, limite)
    const buf = Buffer.alloc(tamanho)
    fs.readSync(fd, buf, 0, tamanho, size - tamanho)
    const linhas = buf.toString('utf8').split('\n')
    // a primeira linha pode ter sido cortada ao meio pelo corte de bytes
    if (size > tamanho) linhas.shift()

    for (let i = linhas.length - 1; i >= 0; i--) {
      if (!linhas[i].trim()) continue
      let entrada
      try { entrada = JSON.parse(linhas[i]) } catch { continue }
      if (entrada?.type !== 'assistant') continue
      const c = entrada.message?.content
      const texto = typeof c === 'string'
        ? c
        : Array.isArray(c) ? c.filter((p) => p?.type === 'text').map((p) => p.text).join('\n\n') : ''
      if (String(texto).trim()) return String(texto)
    }
    return null
  } catch { return null } finally {
    if (fd !== undefined) { try { fs.closeSync(fd) } catch { /* já fechou */ } }
  }
}

/** Guarda a medida. Mantém as últimas 200: é tendência, não contabilidade. */
export function registrar(medida, quando = Date.now()) {
  const arquivo = ARQUIVO_MEDIDAS()
  let dados = { respostas: [] }
  try { dados = JSON.parse(fs.readFileSync(arquivo, 'utf8')) } catch { /* primeira vez */ }
  if (!Array.isArray(dados.respostas)) dados.respostas = []

  dados.respostas.push({ em: quando, ...medida, trechos: undefined })
  dados.respostas = dados.respostas.slice(-200)

  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    const tmp = `${arquivo}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(dados, null, 1))
    fs.renameSync(tmp, arquivo)
  } catch { /* não medir é melhor que quebrar o fim do turno */ }
  return dados.respostas.length
}

/**
 * O retrato para a tela: média de agora contra a média de antes.
 *
 * Comparar os últimos 20 com os 20 anteriores responde a única pergunta que
 * importa aqui — estou melhorando ou voltando ao vício? Um número absoluto não
 * diz nada, porque resposta longa às vezes é o certo.
 */
export function retrato(janela = 20) {
  let respostas = []
  try { respostas = JSON.parse(fs.readFileSync(ARQUIVO_MEDIDAS(), 'utf8')).respostas || [] } catch { return null }
  if (!respostas.length) return null

  const media = (lista, campo) => (lista.length
    ? lista.reduce((s, r) => s + (Number(r[campo]) || 0), 0) / lista.length
    : 0)

  const recentes = respostas.slice(-janela)
  const anteriores = respostas.slice(-janela * 2, -janela)

  return {
    total: respostas.length,
    janela: recentes.length,
    linhas: Math.round(media(recentes, 'linhas')),
    palavras: Math.round(media(recentes, 'palavras')),
    autodefesa: recentes.filter((r) => r.autodefesa > 0).length,
    // `null` quando ainda não há passado suficiente: mostrar 0% de melhora
    // quando não se mediu nada antes seria inventar tendência
    tendenciaPalavras: anteriores.length
      ? Math.round(((media(recentes, 'palavras') - media(anteriores, 'palavras')) / media(anteriores, 'palavras')) * 100)
      : null,
  }
}
