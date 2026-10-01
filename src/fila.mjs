/**
 * As mensagens dele que saíram da fila e nunca viraram mensagem (CC-118).
 *
 * ## A queixa, e o que ela é de verdade
 *
 * > "as vezes eu digito aqui e o texto fica em itálico. daí ao sair da janela e
 * > voltar, o texto simplesmente some"
 *
 * O itálico é a fila: ele digita enquanto eu trabalho, o texto espera a minha
 * vez terminar. O registro da sessão anota cada passo dessa fila:
 *
 * - `enqueue`  ele digitou, o texto entrou na fila
 * - `dequeue`  a fila entregou, e virou mensagem de verdade
 * - `remove`   saiu da fila SEM virar mensagem
 *
 * **O texto do `remove` não se perdeu: ele está no registro.** Medido em 17/08
 * nesta sessão: 38 textos dele nesse estado, incluindo pedidos longos ditados por
 * voz. Ele não tinha como saber, e eu nunca tinha olhado.
 *
 * ## Por que casar por CONTEÚDO, e não por id
 *
 * As operações não trazem identificador de item, só o texto. Então o casamento é
 * pelo conteúdo exato: se um texto teve `remove` e nunca teve `dequeue`, aquilo
 * ele escreveu e eu nunca recebi. Repetir a mesma frase duas vezes ("pode
 * seguir") junta as duas num caso só, o que é aceitável: o que importa é o texto,
 * não quantas vezes ele apareceu.
 */
import fs from 'node:fs'

/* 64 MB, e o número saiu de medição: o registro desta sessão tem 43,5 MB, e com
   o corte de 12 MB da primeira versão as mensagens perdidas do começo do dia
   ficavam de fora, aparecendo 2 no lugar de 38.
   ⚠️ Ler tanto assim custa tempo, então isto NUNCA pode entrar no stream de 2
   segundos: é ação sob clique, como a varredura de portas e a leitura da VPS. */
const LIMITE_PADRAO = 64 * 1024 * 1024

/** As operações de fila do registro, em ordem. */
export function operacoes(arquivo, limite = LIMITE_PADRAO) {
  let bruto = null
  try { bruto = fs.readFileSync(arquivo, 'utf8') } catch { return [] }
  if (bruto.length > limite) bruto = bruto.slice(-limite)
  const saida = []
  for (const linha of bruto.split('\n')) {
    // filtro barato antes do parse: são 410 linhas de fila em 20 mil
    /* CC-776, medido em 01/10: mensagem que ele manda enquanto eu trabalho tem
       `remove` sem `dequeue`, mas CHEGA, como anexo `queued_command` no meio do
       turno. Sem contar isso como entrega, a trava cobrava citar o que eu já
       tinha recebido e atendido. */
    const anexo = linha.includes('"queued_command"')
    if (!anexo && !linha.includes('"queue-operation"')) continue
    try {
      const d = JSON.parse(linha)
      if (d?.type === 'queue-operation' && d.content) saida.push(d)
      else if (anexo && d?.attachment?.type === 'queued_command') {
        const pr = d.attachment.prompt
        const content = typeof pr === 'string' ? pr : Array.isArray(pr) ? pr.map((x) => x?.text || '').join('') : ''
        if (content) saida.push({ type: 'queue-operation', operation: 'dequeue', content, timestamp: d.timestamp, entregueNoMeio: true })
      }
    } catch { /* linha cortada no fim do arquivo */ }
  }
  return saida
}

/* Ruído que NÃO é dele: aviso de tarefa concluída e feedback de hook entram na
   fila como texto, e ele não escreveu nenhum dos dois. Mostrar isso como
   "mensagem perdida" faria a lista mentir. */
const NAO_E_DELE = (t) => !t || t.startsWith('<') || /^\/(start|end)-session/.test(t)

/**
 * O que ele escreveu e eu nunca recebi.
 *
 * Devolve o texto inteiro, com a hora, mais recente primeiro. Sem truncar: é
 * ditado por voz na rua, e o valor está justamente no que ele falou por completo.
 */
export function perdidas(arquivo, { limite = LIMITE_PADRAO } = {}) {
  const hist = new Map()
  for (const o of operacoes(arquivo, limite)) {
    const texto = String(o.content).trim()
    if (NAO_E_DELE(texto)) continue
    const atual = hist.get(texto) || { texto, ops: [], quando: null }
    atual.ops.push(o.operation)
    if (o.operation === 'enqueue') atual.quando = o.timestamp || atual.quando
    hist.set(texto, atual)
  }
  return [...hist.values()]
    .filter((x) => x.ops.includes('remove') && !x.ops.includes('dequeue'))
    .sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')))
    .map(({ texto, quando }) => ({ texto, quando, palavras: texto.split(/\s+/).length }))
}

/**
 * TODAS as sessões desta máquina, não só a mais recente.
 *
 * Defeito achado por ele em 17/08, na primeira versão: *"lá no 'o que eu digitei
 * que sumiu' só tá aparecendo uma, não eram 74?"*. A rota escolhia a sessão de
 * sinal mais novo, e naquele instante era a do `app_escritorio`, que tem
 * exatamente UMA mensagem perdida. As 35 desta sessão estavam ali do lado,
 * invisíveis.
 *
 * A lição: quando a pergunta dele é "o que eu digitei", escolher uma sessão por
 * conta própria é adivinhar. Varre tudo e carimba de onde veio.
 *
 * São 16 transcritos e 63 MB nesta máquina, medidos: meio segundo por arquivo
 * grande. Sob clique é barato; no stream de 2 segundos seria fatal.
 */
export function perdidasDeTodas(pastaProjetos, { limite = LIMITE_PADRAO } = {}) {
  const saida = []
  let pastas = []
  try { pastas = fs.readdirSync(pastaProjetos, { withFileTypes: true }) } catch { return saida }
  for (const pasta of pastas) {
    if (!pasta.isDirectory()) continue
    const dir = `${pastaProjetos}/${pasta.name}`
    /* O nome da pasta é o caminho do projeto com as barras trocadas por hífen.
       Fica o último pedaço, que é o nome do projeto: é o que ele reconhece. */
    const projeto = pasta.name.replace(/^-+/, '').split('-').pop() || pasta.name
    let arquivos = []
    try { arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')) } catch { continue }
    for (const arquivo of arquivos) {
      const caminho = `${dir}/${arquivo}`
      for (const p of perdidas(caminho, { limite })) {
        saida.push({ ...p, projeto, sessao: arquivo.replace(/\.jsonl$/, '').slice(0, 8) })
      }
    }
  }
  /* Mesmo texto em duas sessões conta uma vez: ele reenvia o mesmo pedido quando
     acha que sumiu, e ver a frase repetida faria a lista parecer maior do que o
     problema é. */
  const vistos = new Set()
  return saida
    .sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')))
    .filter((p) => {
      const chave = p.texto.slice(0, 200)
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
}

/**
 * Tudo o que EU respondi depois de um instante.
 *
 * Existe por causa de um falso positivo da própria trava, em 17/08: ela cobrava
 * citar uma mensagem que eu já tinha citado e atendido dois turnos antes, porque
 * olhava só a resposta do turno atual. Cobrar de novo o que já foi feito é o
 * caminho mais curto para trava desligada, e o `resumo-guard` já pagou isso.
 */
export function respostasDesde(arquivo, desde, limite = LIMITE_PADRAO) {
  const corte = typeof desde === 'number' ? desde : Date.parse(desde || '') || 0
  let bruto = null
  try { bruto = fs.readFileSync(arquivo, 'utf8') } catch { return '' }
  if (bruto.length > limite) bruto = bruto.slice(-limite)
  const partes = []
  for (const linha of bruto.split('\n')) {
    if (!linha.includes('"assistant"')) continue
    let d = null
    try { d = JSON.parse(linha) } catch { continue }
    if (d?.type !== 'assistant') continue
    if (corte && (Date.parse(d.timestamp || '') || 0) < corte) continue
    const c = d?.message?.content
    if (Array.isArray(c)) {
      for (const parte of c) if (parte?.type === 'text' && parte.text) partes.push(parte.text)
    } else if (typeof c === 'string') partes.push(c)
  }
  return partes.join('\n')
}

/** Só as do turno em curso: é o que uma trava de fim de turno precisa saber. */
export function perdidasDesde(arquivo, desde, opcoes = {}) {
  const corte = typeof desde === 'number' ? desde : Date.parse(desde || '') || 0
  return perdidas(arquivo, opcoes).filter((p) => (Date.parse(p.quando || '') || 0) >= corte)
}

/* CC-776: ele dita por voz e digita no telefone ("m,as coloca no acklog e
   segue"). Eu cito corrigindo ("coloca no backlog e segue"), e a comparação de
   palavra exata nunca casava: a trava cobrava a mesma frase a cada turno por 2
   horas. Palavra de 4 letras ou mais casa com uma letra de diferença, ou quando
   uma contém a outra ("acklog" dentro de "backlog"). */
function distancia1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, dif = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue }
    if ((dif += 1) > 1) return false
    if (a.length > b.length) i += 1; else if (b.length > a.length) j += 1; else { i += 1; j += 1 }
  }
  return dif + (a.length - i) + (b.length - j) <= 1
}
export const palavraCasa = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a) || distancia1(a, b)))
/** Citada = um trecho de até 5 palavras seguidas do texto dele aparece em sequência na minha resposta. */
export function citou(dele, minha) {
  if (!dele.length) return true
  const k = Math.min(5, dele.length)
  for (let i = 0; i + k <= dele.length; i += 1) {
    for (let j = 0; j + k <= minha.length; j += 1) {
      let ok = true
      for (let t = 0; t < k && ok; t += 1) ok = palavraCasa(dele[i + t], minha[j + t])
      if (ok) return true
    }
  }
  return false
}
