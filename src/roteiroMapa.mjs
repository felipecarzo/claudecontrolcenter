/**
 * CC-1081: o mapa automático do "roteiro de uso" (sem IA).
 *
 * Anda pelo site clicando em tudo que dá para clicar, em LARGURA (primeiro todas as telas a 1 clique,
 * depois as de 2, e assim por diante), e anota quais telas existem e como se vai de uma a outra.
 *
 * O ponto que muda tudo: tela de página única (o Nexus, por exemplo) não tem endereço próprio. Não dá
 * para "voltar" nem para abrir a tela direto. Então cada tela nova é alcançada REPETINDO O CAMINHO
 * desde a raiz: recarrega a página e refaz os cliques, um por um. É mais lento e é o único jeito honesto.
 *
 * Roda no processo filho (`node --experimental-websocket src/roteiroMapa.mjs --plano <json>`, o Node 20
 * não tem WebSocket). O pai chama `executarMapa(plano)`, que cuida do prazo e mata o filho se passar.
 *
 * Nunca clica no que apaga, sai, zera ou paga: quem barra é o navegador, com a lista `PROTEGIDOS`.
 * O que foi visto e não tocado fica em `naoTocados`, para o relatório mostrar que o programa viu.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { abrirNavegador, normalizar, rodarFilho } from './roteiroNavegador.mjs'
import { escreverAtomico } from './roteiro.mjs'

const ESTE = fileURLToPath(import.meta.url)
const chaveDe = (e) => e.papel + '|' + normalizar(e.rotulo)

/** Acha, numa observação, o botão que o caminho guardou: mesmo papel e nome, e qual dos de mesmo nome. */
const achar = (obs, alvo) => obs.elementos.filter((e) => chaveDe(e) === alvo.chave)[alvo.oc]

/**
 * Refaz o caminho do mapa até `tela` e devolve a assinatura de onde chegou (ou null se algum clique não deu).
 * Recarrega a página e clica passo a passo. Com `tela.passos` (o mapa novo) acha cada botão por papel, nome e posição
 * entre os iguais, como o próprio mapa fez. Sem eles (mapa antigo, só com `tela.caminho`) tenta os botões de mesmo
 * nome, um a um, até um deixar clicar: no Nexus o menu em gaveta tem "Apps" FORA da janela, antes da aba "Apps", e
 * pegar só o primeiro fazia toda tela parecer inalcançável. Clique recusado não muda a página, então tentar o
 * próximo é seguro.
 */
export async function alcancar(nav, url, tela) {
  await nav.ir(url)
  let obs = await nav.observar({ soVisivel: false })
  for (const [i, rotulo] of (tela.caminho || []).entries()) {
    const passo = tela.passos?.[i]
    const candidatos = passo ? [achar(obs, passo)].filter(Boolean) : obs.elementos.filter((e) => e.rotulo === rotulo)
    let clicou = false
    for (const el of candidatos) {
      if (el.bloqueado) continue
      if ((await nav.clicar(el.n)).ok) { clicou = true; break }
    }
    if (!clicou) return null
    obs = await nav.observar({ soVisivel: false })
  }
  return obs.assinatura
}

/**
 * Os cabeçalhos da MOLDURA: os que aparecem na maioria das telas (mais da metade), como o do painel fixo.
 * Tem de ser "maioria" e não "todas": no Nexus duas telas (um aviso de scanner e uma tela de saída) não têm
 * o cabeçalho fixo, e com "todas" ele deixava de ser moldura e dava nome a todas as outras.
 */
export function moldura(telas) {
  if (telas.length < 2) return new Set()
  const conta = new Map()
  for (const t of telas) for (const h of new Set(t.cabecalhos.map(normalizar))) conta.set(h, (conta.get(h) || 0) + 1)
  return new Set([...conta].filter(([, n]) => n * 2 > telas.length).map(([h]) => h))
}

/**
 * Dá a cada tela um `nome` que se lê. Medido no Nexus: quase todas saíram "APPS", porque o primeiro cabeçalho
 * é o do painel fixo, que aparece em TODAS as telas. Cabeçalho de moldura não nomeia. O nome é o primeiro
 * cabeçalho que não é moldura; sem ele, o último botão do caminho; a raiz é "Início". Nome repetido ganha o
 * caminho entre parênteses.
 */
export function nomear(telas) {
  const fixa = moldura(telas)
  for (const t of telas) t.nome = t.id === 'raiz' ? 'Início' : (t.cabecalhos.find((h) => !fixa.has(normalizar(h))) || t.caminho.at(-1) || t.id)
  const conta = new Map()
  for (const t of telas) conta.set(t.nome, (conta.get(t.nome) || 0) + 1)
  for (const t of telas) if (conta.get(t.nome) > 1 && t.caminho.length) t.nome = `${t.nome} (${t.caminho.join(' > ')})`
  return telas
}

/**
 * Faz o mapa a partir de `url`. Devolve o objeto do mapa; com `saida` (uma pasta, em geral
 * `<projeto>/docs/roteiro`) grava também `mapa.json` e as fotos (em `fotos`, por padrão `<saida>/fotos`).
 * No mapa a foto de cada tela fica como caminho relativo à `saida` (`fotos/t3.jpg`).
 * `maxIguais`: botões com o mesmo nome na mesma tela (linhas de uma lista) viram só os primeiros.
 * `idioma` (padrão pt-BR), `naoTocar` (texto de regex que SOMA à lista `PROTEGIDOS`), `naoTocarSo` (troca a
 * lista), `permitir` (hosts a mais que podem abrir), `acesso` (caminho do JSON de login; entra logado) e `qualquerUrl`
 * (abrir endereço fora de `enderecoPermitido`) vão para o navegador.
 *
 * O progresso vai para `mapa.novo.json`, e só no FIM ele troca o `mapa.json` (rename). Se o processo morrer no
 * meio, o `mapa.json` bom continua lá, e o parcial fica em `mapa.novo.json` com `parcial: true` e um aviso.
 *
 * `inferir` (padrão ligado) é o atalho de velocidade. Medido no Nexus: cada tela tem uns 50 botões, quase todos
 * da MOLDURA (menu, atalhos), e cada clique que sai da tela custa recarregar e refazer o caminho. Um botão
 * (mesmo papel, nome e posição entre os iguais) que levou ao MESMO destino a partir de 2 telas diferentes, sem
 * nunca levar a outro e sem nunca ficar parado em tela que não seja o destino, não é clicado de novo: a
 * aresta entra com `inferida: true`. Aposta que é navegação fixa. `inferir: false` clica em tudo.
 */
export async function mapear({ url, maxTelas = 40, maxProfundidade = 4, prazoMs = 180000, saida = null, fotos = null, maxIguais = 2, largura = 390, altura = 844, idioma = 'pt-BR', naoTocar = undefined, naoTocarSo = undefined, qualquerUrl = false, permitir = [], acesso = null, inferir = true }) {
  if (!url) throw new Error('mapear precisa de uma url')
  const limite = Date.now() + prazoMs
  const semTempo = () => Date.now() > limite
  const nav = await abrirNavegador({ largura, altura, idioma, qualquerUrl, permitir, acesso, ...(naoTocar && { naoTocar }), ...(naoTocarSo && { naoTocarSo }) })
  const raizUrl = new URL(url)
  const externo = (u) => { try { const x = new URL(u); return x.protocol !== raizUrl.protocol || x.host !== raizUrl.host } catch { return true } }

  const telas = []
  const porAssinatura = new Map()
  const arestas = []
  const arestasVistas = new Set()
  const avisos = []
  const naoTocados = new Set()
  const comportamento = new Map() // 'papel|nome#qual' -> o que esse botão fez, tela a tela (para o atalho)
  let inferidas = 0
  const mapa = { url, quando: new Date().toISOString(), telas, arestas, naoTocados: [], avisos }
  /* Gravado a cada tela nova em `mapa.novo.json`: se o pai matar o filho no prazo, sobra o que já foi achado, marcado
     como parcial. Só `gravar(true)`, no fim, troca o `mapa.json`. */
  const gravar = (fim = false) => {
    nomear(telas)
    if (!saida) return
    mapa.naoTocados = [...naoTocados]
    const novo = path.join(saida, 'mapa.novo.json')
    const corpo = fim ? { ...mapa, parcial: false } : { ...mapa, parcial: true, avisos: [...avisos, 'mapa parcial: o mapeamento foi interrompido antes de terminar (o mapa.json anterior, se houver, não foi tocado)'] }
    escreverAtomico(novo, JSON.stringify(corpo, null, 2) + '\n')
    if (fim) fs.renameSync(novo, path.join(saida, 'mapa.json'))
  }

  /** Recarrega e refaz os cliques desde a raiz. Devolve a observação da tela de chegada, ou null. */
  const chegar = async (caminho) => {
    await nav.ir(url)
    let obs = await nav.observar({ soVisivel: false })
    for (const passo of caminho) {
      const el = achar(obs, passo)
      if (!el) return null
      if (!(await nav.clicar(el.n)).ok) return null
      obs = await nav.observar({ soVisivel: false })
    }
    return obs
  }

  const nova = async (obs, id, profundidade, caminho) => {
    const t = {
      id, assinatura: obs.assinatura, titulo: obs.cabecalhos[0] || obs.titulo, nome: null, cabecalhos: obs.cabecalhos,
      rotulos: [...new Set(obs.elementos.map((e) => e.rotulo))].slice(0, 80),
      foto: null, profundidade, caminho: caminho.map((p) => p.rotulo), explorada: false,
      // o jeito de REFAZER o clique: papel, nome e qual dos de mesmo nome (a gaveta e a aba podem ter o mesmo rótulo)
      passos: caminho.map(({ chave, oc, papel, rotulo }) => ({ chave, oc, papel, rotulo })),
    }
    if (saida) {
      const arq = path.join(fotos || path.join(saida, 'fotos'), `${id}.jpg`)
      await nav.foto(arq)
      t.foto = path.relative(saida, arq).split(path.sep).join('/')
    }
    telas.push(t); porAssinatura.set(t.assinatura, t)
    return t
  }

  const novoComportamento = () => ({ destino: null, origens: new Set(), paradas: new Set(), conflito: false })
  const liga = (de, para, rotulo, inferida) => {
    const chave = `${de}>${para}>${rotulo}`
    if (arestasVistas.has(chave)) return
    arestasVistas.add(chave)
    arestas.push({ de, para, rotulo, ...(inferida && { inferida: true }) })
  }

  try {
    await nav.ir(url)
    const obsRaiz = await nav.observar({ soVisivel: false })
    const raiz = await nova(obsRaiz, 'raiz', 0, [])
    const caminhos = new Map([[raiz.id, []]]) // como chegar a cada tela, com o que precisa para refazer o clique
    const fila = [raiz]
    let limiteAvisado = false

    while (fila.length) {
      const tela = fila.shift()
      if (tela.profundidade >= maxProfundidade) { avisos.push(`a tela ${tela.id} (${tela.titulo}) está na profundidade máxima (${maxProfundidade}) e não foi aberta`); continue }
      if (semTempo()) { avisos.push(`o prazo de ${Math.round(prazoMs / 1000)} s acabou: restaram ${fila.length + 1} telas sem abrir`); break }
      let atual = tela.id === 'raiz' ? obsRaiz : await chegar(caminhos.get(tela.id))
      if (!atual) { avisos.push(`não consegui refazer o caminho até ${tela.id} (${tela.titulo})`); continue }
      if (atual.assinatura !== tela.assinatura) { avisos.push(`a tela ${tela.id} (${tela.titulo}) voltou diferente ao refazer o caminho: o app muda sozinho`); continue }

      // o que dá para clicar nela, com o "qual dos de mesmo nome" medido AGORA
      const cont = new Map()
      const alvos = []
      for (const e of atual.elementos) {
        if (e.bloqueado) { naoTocados.add(e.rotulo); continue }
        if (e.papel.startsWith('input:') || e.papel === 'select') continue // campo não leva a outra tela
        const chave = chaveDe(e)
        const oc = cont.get(chave) || 0
        cont.set(chave, oc + 1)
        if (oc < maxIguais) alvos.push({ chave, oc, papel: e.papel, rotulo: e.rotulo })
      }
      tela.explorada = true

      for (const alvo of alvos) {
        if (semTempo()) { avisos.push(`o prazo acabou no meio da tela ${tela.id}`); tela.explorada = false; break }
        if (atual.assinatura !== tela.assinatura) {
          // o clique anterior levou para outra tela: volta pela raiz, não pelo "voltar"
          atual = tela.id === 'raiz' ? (await nav.ir(url), await nav.observar({ soVisivel: false })) : await chegar(caminhos.get(tela.id))
          if (!atual || atual.assinatura !== tela.assinatura) { avisos.push(`não consegui voltar para ${tela.id} (${tela.titulo})`); tela.explorada = false; break }
        }
        const el = achar(atual, alvo)
        if (!el) continue
        const bicho = alvo.chave + '#' + alvo.oc
        const visto = comportamento.get(bicho)
        if (inferir && visto && !visto.conflito && visto.origens.size >= 2 && !visto.origens.has(tela.id) && [...visto.paradas].every((u) => u === visto.destino)) {
          if (visto.destino !== tela.id) { inferidas++; liga(tela.id, visto.destino, alvo.rotulo, true) }
          continue
        }
        const r = await nav.clicar(el.n)
        if (!r.ok) { if (r.motivo === 'nao-tocar') naoTocados.add(el.rotulo); continue }
        atual = await nav.observar({ soVisivel: false })
        if (atual.assinatura === tela.assinatura) { // não levou a lugar nenhum (botão que só muda um número)
          const c = comportamento.get(bicho) || novoComportamento()
          c.paradas.add(tela.id); comportamento.set(bicho, c)
          continue
        }
        if (externo(atual.url)) { avisos.push(`"${alvo.rotulo}" em ${tela.id} sai do site (${atual.url.slice(0, 60)}) e não foi seguido`); continue }
        let destino = porAssinatura.get(atual.assinatura)
        if (!destino) {
          if (telas.length >= maxTelas) {
            if (!limiteAvisado) { limiteAvisado = true; avisos.push(`o limite de ${maxTelas} telas foi atingido: há telas novas que não entraram no mapa`) }
            continue
          }
          const caminho = [...caminhos.get(tela.id), alvo]
          destino = await nova(atual, 't' + telas.length, tela.profundidade + 1, caminho)
          caminhos.set(destino.id, caminho)
          fila.push(destino)
        }
        const c = comportamento.get(bicho) || novoComportamento()
        if (c.destino === null) c.destino = destino.id; else if (c.destino !== destino.id) c.conflito = true
        c.origens.add(tela.id); comportamento.set(bicho, c)
        liga(tela.id, destino.id, alvo.rotulo, false)
        gravar()
      }
    }
    for (const t of fila) t.explorada = false
    if (inferidas) avisos.push(`${inferidas} cliques não foram refeitos: botão da moldura que levou ao mesmo lugar a partir de 2 telas (arestas com inferida: true)`)
    gravar(true)
    return mapa
  } finally {
    await nav.fechar()
  }
}

/**
 * Chama o filho com prazo e devolve o caminho do `mapa.json`. `plano`: `{ url, saida, fotos, maxTelas,
 * maxProfundidade, prazoMs, idioma, naoTocar, naoTocarSo, qualquerUrl, inferir }`, com `saida` obrigatória (a pasta
 * onde fica o `mapa.json`; `raiz` e o que mais vier é ignorado). O pai espera o prazo do mapa mais 30 s; passou
 * disso, manda SIGTERM ao filho (que fecha o Chrome) e só 15 s depois SIGKILL. Se o pai morrer, o filho recebe SIGTERM.
 * Morto no meio, o `mapa.json` anterior fica intacto e o que já foi achado fica em `mapa.novo.json`.
 */
export async function executarMapa(plano) {
  if (!plano?.saida) throw new Error('executarMapa precisa de `saida`, a pasta do mapa.json')
  const prazo = (plano.prazoMs || 180000) + 30000
  const r = await rodarFilho({ script: ESTE, plano, prazoMs: prazo })
  const parcial = `o que já foi achado ficou em ${path.join(plano.saida, 'mapa.novo.json')}`
  if (r.passou) throw new Error(`o mapa passou do prazo (${Math.round(prazo / 1000)} s) e o filho foi parado; ${parcial}`)
  if (r.codigo !== 0) throw new Error('o mapa falhou: ' + (r.erro || 'código ' + r.codigo) + `; ${parcial}`)
  return path.join(plano.saida, 'mapa.json')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === '--plano') {
  mapear(JSON.parse(process.argv[3])).then(() => process.exit(0)).catch((e) => { console.error(String(e?.message || e)); process.exit(1) })
}
