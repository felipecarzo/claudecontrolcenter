/**
 * O que ele falou e nunca virou item do backlog.
 *
 * Ideia dele em 17/08, ao encerrar o dia: *"Será que eh interessante colocar
 * algo assim no end-session p ele procurar ideias não utilizadas e colocar no
 * backlog se já não tiver?"*
 *
 * O problema é medido e é dele: **mensagem longa que abre com "e se", "tive uma
 * ideia" ou "podemos" é VISÃO, não tarefa** (regra 4 do ciclo). Ele mesmo diz o
 * que quer que aconteça com ela: *"anote isso tudo antes de considerar e
 * organizar"*, *"salva um backlog sobre isso, e vamos voltar pra questão
 * anterior"*. Quando isso não acontece, a ideia se perde, e ele descobre dias
 * depois que a coisa que ele pediu nunca existiu.
 *
 * ## O que este módulo NÃO faz
 *
 * Não julga se a ideia é boa, não resume e não escreve no roadmap. Ele lista
 * candidatas e diz se cada uma parece já registrada. Decidir o que vira item é
 * dele; escrever é do agente, com as palavras dele. Um extrator que escrevesse
 * sozinho encheria o backlog de ruído, e backlog com ruído é backlog que ninguém
 * lê, que é o problema que ele estava justamente tentando resolver.
 */
import fs from 'node:fs'

/* Os marcadores saíram das mensagens reais dele, não de teoria. `min` existe
   porque a regra 4 tem número: acima de ~400 caracteres, abrindo com um destes,
   é visão. Frase curta com "podemos" é ordem, e ordem se executa. */
const ABERTURAS = [
  /\be se\b/i, /\btive uma ideia\b/i, /\bme deu uma ideia\b/i, /\bproponho\b/i,
  /\bpoder[íi]amos\b/i, /\bpodemos\b/i, /\bseria (?:legal|bom|interessante)\b/i,
  /\bfaz sentido\b/i, /\bacho que (?:dev|podia|seria)\b/i, /\bpensei (?:em|que)\b/i,
  /\bqueria (?:que|ter)\b/i, /\bum dia\b/i, /\bno futuro\b/i, /\bficaria legal\b/i,
  /\bsera que\b/i, /\bserá que\b/i,
]

/* Marcas do que NÃO é ideia nova, e cada uma custou um falso positivo em teste:
   feedback de hook, injeção de skill e a saída de comando. */
const RUIDO = [
  /^</, /^\/[a-z-]+/i, /stop hook feedback/i, /^\s*```/,
  // o resumo automático de sessão longa entra como mensagem de usuário e é
  // grande: sem este filtro ele aparecia como a "ideia" de menor cobertura
  /^this session is being continued/i,
  /^<cross-session-message/i,
]

const semAcento = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** As mensagens dele que têm cara de ideia guardada. */
export function candidatas(arquivo, { min = 260, limite = 64 * 1024 * 1024 } = {}) {
  let bruto = null
  try { bruto = fs.readFileSync(arquivo, 'utf8') } catch { return [] }
  if (bruto.length > limite) bruto = bruto.slice(-limite)

  const saida = []
  for (const linha of bruto.split('\n')) {
    if (!linha.includes('"user"')) continue
    let d = null
    try { d = JSON.parse(linha) } catch { continue }
    if (d?.type !== 'user' || d?.isMeta || d?.toolUseResult) continue
    const c = d?.message?.content
    const t = typeof c === 'string' ? c
      : Array.isArray(c) ? c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n') : ''
    if (!t || t.length < min) continue
    if (RUIDO.some((re) => re.test(t.trim()))) continue
    if (!ABERTURAS.some((re) => re.test(t))) continue
    saida.push({ texto: t.trim(), quando: d.timestamp || null, palavras: t.trim().split(/\s+/).length })
  }

  // mesma ideia repetida (ele reenvia quando acha que sumiu) conta uma vez
  const vistos = new Set()
  return saida.filter((x) => {
    const chave = semAcento(x.texto).slice(0, 120)
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

/* Palavras que aparecem em qualquer frase e não identificam assunto nenhum. */
const VAZIAS = new Set(('para pela pelo isso essa esse esses isto este esta aquele coisa coisas jeito '
  + 'forma modo agora depois antes ainda tambem talvez porque quando onde como quer quero queria pode '
  + 'podemos vamos fazer feito fica ficar sendo tudo todo toda todos todas outro outra mesmo muito '
  + 'pouco nada alguma algum sobre entre desde você voce vocês eles nossa nosso seus suas dele dela '
  + 'aqui ali lado tipo tipos exemplo preciso precisa gente cara conta caso vez vezes dias dia hoje '
  + 'ontem tempo hora sempre nunca cada qual quais quem mais menos bem melhor pior legal certo errado '
  + 'igual assim apenas somente entao então acho seria estar sera será ideia coisa').split(/\s+/))

const termos = (texto) => [...new Set(semAcento(texto).split(/[^a-z0-9]+/)
  .filter((p) => p.length >= 5 && !VAZIAS.has(p)))]

/**
 * A ideia parece já registrada no backlog?
 *
 * Compara por palavras de conteúdo. O corte de 0,55 saiu de MEDIÇÃO, não de
 * palpite: nas 20 mensagens desta sessão a cobertura foi de 35% a 82%, e com o
 * 0,34 da primeira versão TODAS passaram como registradas, o que tornava o
 * recurso decorativo. O roadmap deste projeto tem 500 linhas, então palavra
 * comum do domínio (painel, tela, agente) casa sempre.
 *
 * Na dúvida ele erra para "não registrada", porque mostrar de novo algo já
 * anotado custa um segundo de leitura, e deixar sumir o que ele pediu é o dano
 * que o recurso existe para evitar.
 */
export function jaNoBacklog(texto, roadmap, { corte = 0.55 } = {}) {
  const alvo = semAcento(roadmap)
  const ts = termos(texto)
  if (ts.length < 3) return { registrada: false, cobertura: 0, faltando: ts }
  const achados = ts.filter((t) => alvo.includes(t))
  const cobertura = achados.length / ts.length
  return {
    registrada: cobertura >= corte,
    cobertura: Math.round(cobertura * 100) / 100,
    faltando: ts.filter((t) => !alvo.includes(t)).slice(0, 8),
  }
}

/** O relatório inteiro: candidatas com o veredito de cada uma. */
export function levantar(arquivo, roadmap, opcoes = {}) {
  return candidatas(arquivo, opcoes).map((c) => ({ ...c, ...jaNoBacklog(c.texto, roadmap, opcoes) }))
}
