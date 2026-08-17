/**
 * A camada de disco do framework. Fica separada de `framework.mjs` de propósito:
 * o motor é puro e testável, este arquivo é o que sabe onde as coisas moram.
 *
 * O estado vive DENTRO do projeto (`.framework/estado.json`), não em
 * `~/.claude`. Motivo medido em 14/08: hook e configuração que moram no home
 * não viajam com o repositório, e aí o PC e a VPS passam a ter opiniões
 * diferentes sobre a fase do mesmo projeto. É a frente "Sincronia entre
 * máquinas" (CC-47 a CC-53) acontecendo de novo, e dá para não repetir.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { estadoInicial } from './framework.mjs'

export const PASTA = '.framework'
export const ARQUIVO = 'estado.json'

/** Sobe a árvore procurando o projeto com framework ligado. null = desligado,
 *  que é o padrão: opt-in por repositório, igual ao Método Routia. */
export function acharRaiz(dir) {
  let atual = resolve(dir || process.cwd())
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(atual, PASTA, ARQUIVO))) return atual
    const pai = dirname(atual)
    if (pai === atual) return null
    atual = pai
  }
  return null
}

/**
 * CC-116 — o modo pode ser POR SESSÃO, não só por projeto.
 *
 * Pedido dele em 17/08:
 *
 * > "quero poder ter uma sessão de frontend e uma de backend no mesmo projeto
 * > (…) uma no restritivo e outra no sugestivo"
 *
 * O estado do projeto continua sendo um arquivo só. O que a sessão pode ter é
 * uma CAMADA por cima, em `.framework/sessoes/<id>.json`, que hoje sobrepõe
 * só `modo` e `tom` — os dois campos que fazem sentido divergir entre agentes.
 * MVP, critérios e verificação continuam do projeto, porque o "pronto" é um
 * só, não importa quantos agentes trabalhem.
 *
 * A sessão vem do ambiente por padrão, então TODOS os hooks ganham o modo por
 * sessão sem mudar uma linha: eles já chamam `ler(raiz)`.
 */
const idCurto = (s) => String(s || '').slice(0, 8).replace(/[^0-9a-f]/gi, '')

/**
 * CC-123: o modo declarado na ROTA, lido do quadro do Routia.
 *
 * Pedido dele: *"eu posso ta no mesmo projeto fazendo backend e frontend. eu
 * quero dialogar sobre o frontend mas o backend ja tem backlog entao eu posso
 * colocar como restritivo"*. A capa por sessão (CC-116) já resolvia, com um
 * custo: a sessão morre e renasce com outro número, então o modo se perdia a
 * cada reinício e ninguém via pelo quadro quem estava em qual modo.
 *
 * A rota não tem esse problema: ela já declara os arquivos dela (é o que separa
 * front de back sem inventar nome novo), mora no repositório e é visível.
 *
 * Escreve-se na própria linha da rota, junto do resto:
 *
 *     | `front` | 🔴 ocupada | ab5121a0 — telas 🎚 sugestivo 📁 src/ui.html#viewRemoto | hoje |
 *
 * ⚠️ **Só modo de COMPORTAMENTO vale aqui** (tom, ritmo, se pergunta). Modo que
 * tranca escrita continua sendo do projeto: duas travas discordando sobre quem
 * pode escrever num arquivo é o cenário ruim, e é justamente o que o Routia
 * existe para evitar.
 */
export function modoDaRota(raiz, sessao) {
  const marca = idCurto(sessao)
  if (!marca) return null
  let texto = null
  try { texto = readFileSync(join(raiz, 'docs', 'ROTAS-ATIVAS.md'), 'utf8') } catch { return null }
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.includes('🔴') || !linha.includes(marca)) continue
    const m = linha.match(/🎚\s*`?([a-zà-ú-]+)`?/i)
    if (m) return { modo: m[1].toLowerCase(), rota: (linha.match(/`([^`]+)`/) || [])[1] || null }
  }
  return null
}

export function ler(raiz, { sessao = process.env.CLAUDE_CODE_SESSION_ID } = {}) {
  let estado = null
  try {
    estado = JSON.parse(readFileSync(join(raiz, PASTA, ARQUIVO), 'utf8'))
  } catch {
    return null
  }

  const id = idCurto(sessao)
  if (!id) return estado

  /* Três camadas, e a ordem é do menos específico para o mais: projeto, depois
     ROTA (CC-123), depois a capa da sessão (CC-116). A capa vence porque é a
     escolha mais recente e mais deliberada; a rota vence o projeto porque é o
     que separa frontend de backend sem inventar nome novo, e sobrevive ao
     reinício da sessão, que era o furo da capa. */
  let saida = estado
  const daRota = modoDaRota(raiz, sessao)
  if (daRota?.modo) saida = { ...saida, modo: daRota.modo, _rota: daRota.rota }

  try {
    const capa = JSON.parse(readFileSync(join(raiz, PASTA, 'sessoes', `${id}.json`), 'utf8'))
    /* Só os campos de comportamento. Se a capa pudesse sobrepor `ligado` ou o
       MVP, uma sessão desligaria o framework das outras sem ninguém ver. */
    return {
      ...saida,
      ...(capa.modo ? { modo: capa.modo } : {}),
      ...(capa.tom ? { tom: capa.tom } : {}),
      _sessao: id,
    }
  } catch {
    return saida === estado ? estado : { ...saida, _sessao: id }
  }
}

/** Grava a capa de uma sessão: só modo e tom, nada além. */
export function gravarSessao(raiz, sessao, { modo = null, tom = null } = {}) {
  const id = idCurto(sessao)
  if (!id) return { ok: false, erro: 'sem identidade de sessão' }
  const dir = join(raiz, PASTA, 'sessoes')
  mkdirSync(dir, { recursive: true })
  const arquivo = join(dir, `${id}.json`)
  const atual = (() => { try { return JSON.parse(readFileSync(arquivo, 'utf8')) } catch { return {} } })()
  const capa = { ...atual, ...(modo ? { modo } : {}), ...(tom ? { tom } : {}) }
  const tmp = `${arquivo}.tmp`
  writeFileSync(tmp, JSON.stringify(capa, null, 2))
  renameSync(tmp, arquivo)
  return { ok: true, arquivo, capa }
}

/** Escrita atômica (tmp + rename), a mesma regra do `meta.json`: leitor
 *  concorrente nunca pode pegar arquivo pela metade. */
export function gravar(raiz, estado) {
  const pasta = join(raiz, PASTA)
  mkdirSync(pasta, { recursive: true })
  const alvo = join(pasta, ARQUIVO)

  /* Se o estado veio de `ler()` com capa de sessão, o `modo` e o `tom` dele
     são DA SESSÃO — regravá-los aqui promoveria a escolha de um agente a
     escolha do projeto, em silêncio. Restaura os dois do arquivo cru antes de
     escrever; mudança de sessão passa por `gravarSessao`, nunca por aqui. */
  let limpo = estado
  if (estado && estado._sessao) {
    limpo = { ...estado }
    delete limpo._sessao
    try {
      const cru = JSON.parse(readFileSync(alvo, 'utf8'))
      if ('modo' in cru) limpo.modo = cru.modo; else delete limpo.modo
      if ('tom' in cru) limpo.tom = cru.tom; else delete limpo.tom
    } catch { /* sem arquivo cru: primeiro grava, nada a restaurar */ }
  }

  const tmp = `${alvo}.tmp`
  writeFileSync(tmp, JSON.stringify(limpo, null, 1) + '\n', 'utf8')
  renameSync(tmp, alvo)
  return alvo
}

/** Liga o framework num projeto. Não sobrescreve estado existente: religar por
 *  engano não pode apagar o MVP e o histórico de escopo de ninguém. */
export function iniciar(raiz, metodo = 'mvp-basico') {
  const jaTem = ler(raiz)
  if (jaTem) return { ok: false, erro: 'este projeto já tem framework ligado', estado: jaTem }
  const estado = estadoInicial(metodo)
  gravar(raiz, estado)
  return { ok: true, estado }
}

/**
 * O que o botão do painel chama. Liga, e liga de novo o que estava desligado,
 * sem tocar no MVP nem no histórico.
 *
 * `ligado` ausente conta como ligado: é o formato que o `iniciar()` gravava
 * antes deste campo existir, e estado antigo não pode virar projeto destravado
 * de surpresa.
 */
export function ligar(raiz, metodo = 'mvp-basico') {
  const atual = ler(raiz)
  if (!atual) return { ...iniciar(raiz, metodo), criou: true }
  const estado = { ...atual, ligado: true }
  gravar(raiz, estado)
  return { ok: true, estado, criou: false }
}

/** Desliga preservando tudo. Apagar de vez é apagar a pasta `.framework`, e
 *  isso o painel não faz: destruir dado do projeto não pode ser um clique. */
export function desligar(raiz) {
  const atual = ler(raiz)
  if (!atual) return { ok: false, erro: 'este projeto não tem framework' }
  const estado = { ...atual, ligado: false }
  gravar(raiz, estado)
  return { ok: true, estado }
}

/** Retrato para a tela: existe? está ligado? em que fase? o que falta? */
export function situacao(raiz) {
  const estado = raiz ? ler(raiz) : null
  if (!estado) return { existe: false, ligado: false }
  return { existe: true, ligado: estado.ligado !== false, estado }
}
