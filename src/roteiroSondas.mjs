/**
 * CC-1083: as SONDAS do "roteiro de uso". Testes que clicam de verdade numa tela e dizem se ela TEM ou NÃO TEM uma
 * prática que os painéis do mercado da categoria costumam ter.
 *
 * Caso real que motivou: "no painel da nossa loja, clicar em editar não abre janela (pop-up); nos outros painéis abre,
 * é prática de mercado, e o teste não pegou". O mapa diz onde as telas ficam; o agente diz se a pessoa acha o caminho.
 * Nenhum dos dois diz "aqui falta uma edição que deixe a lista à vista". A sonda diz.
 *
 * Cada sonda roda numa tela do mapa e devolve `{ status, evidencia, foto? }`, com `status`:
 * - `tem`: viu a prática funcionando (a evidência diz o que apareceu);
 * - `nao-tem`: a tela tem o que a sonda precisa (uma lista, por exemplo) e a prática não está lá;
 * - `nao-da`: a sonda não tinha onde testar (tela sem lista) ou não conseguiu clicar. NUNCA vira "não tem".
 * `SONDAS[].palavras` servem para casar a sonda com os padrões de uma pesquisa de mercado, pelo nome e pela descrição.
 *
 * Regras de segurança: só clica no que a lista `PROTEGIDOS` deixa (o `clicarAlvo` do navegador recusa o resto); abre a
 * edição e FECHA com Escape ou o X (nunca "Cancelar"); marca e desmarca caixa de seleção sem executar a ação da barra;
 * não salva nem envia formulário.
 *
 * Roda no processo filho, como o mapa (`node --experimental-websocket src/roteiroSondas.mjs --plano <json>`); o pai
 * chama `executarSondas(plano)`. A saída é `<raiz>/docs/roteiro/sondas.json`, gravada em `sondas.novo.json` durante
 * o trabalho e trocada no fim (se o processo morrer, o `sondas.json` anterior fica intacto).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { abrirNavegador, rodarFilho } from './roteiroNavegador.mjs'
import { alcancar as alcancarNoMapa } from './roteiroMapa.mjs'
import { escreverAtomico, lerMapa } from './roteiro.mjs'

const ESTE = fileURLToPath(import.meta.url)

/* ======================= o que roda DENTRO da página ======================= */

/** Instala os ajudantes em `window.__rot`: ver, rotular, achar a lista principal, janelas e painéis. */
function instalar() {
  const limpa = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
  const visivel = (e) => {
    if (!e) return false
    if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
    const r = e.getBoundingClientRect()
    return r.width > 4 && r.height > 4
  }
  const rotulo = (e) => limpa(e.getAttribute('aria-label') || e.getAttribute('title') || e.innerText || e.value || '').slice(0, 60)
  /** A lista principal: a maior tabela, ou lista de pelo menos 3 itens fora de menus. Devolve `{ el, tipo, itens }`. */
  const lista = () => {
    const cand = []
    for (const t of document.querySelectorAll('table, [role=table], [role=grid]')) {
      const linhas = [...t.querySelectorAll('tbody tr')]
      const itens = linhas.length ? linhas : [...t.querySelectorAll('[role=row]')].slice(1)
      if (visivel(t) && itens.length >= 2) cand.push({ el: t, tipo: 'tabela', itens })
    }
    for (const l of document.querySelectorAll('ul, ol, [role=list], [role=listbox]')) {
      const itens = [...l.children].filter(visivel)
      if (visivel(l) && itens.length >= 3 && !l.closest('nav, header, aside, [role=tablist], [role=navigation], [role=menu]')) cand.push({ el: l, tipo: 'lista', itens })
    }
    cand.sort((a, b) => b.el.getBoundingClientRect().height - a.el.getBoundingClientRect().height)
    return cand[0] || null
  }
  const dialogos = () => [...document.querySelectorAll('[role=dialog], [aria-modal=true], dialog[open]')].filter(visivel)
  /** Painel fixo ou absoluto que ocupa 30% ou mais da largura e da altura da janela, e que não é a página em volta da lista. */
  const painel = (daLista) => {
    for (const e of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(e).position
      if (pos !== 'fixed' && pos !== 'absolute') continue
      const r = e.getBoundingClientRect()
      if (r.width >= innerWidth * 0.3 && r.height >= innerHeight * 0.3 && visivel(e) && !(daLista && e.contains(daLista))) return e
    }
    return null
  }
  const clicaveis = () => [...document.querySelectorAll('button, a, [role=button], [role=tab], input[type=submit]')].filter(visivel).map(rotulo).filter(Boolean)
  window.__rot = { limpa, visivel, rotulo, lista, dialogos, painel, clicaveis }
  return true
}

/** O que a sonda marcou para clicar (o `clicarAlvo` do navegador confere a proteção pelo rótulo). */
function manter() {
  return window.__roteiroAlvo ? { rotulo: window.__rotAlvoRotulo || '', descricao: '' } : null
}

function editarAchar() {
  const R = window.__rot
  const L = R.lista()
  if (!L) return { semLista: true }
  const casa = (e) => /\beditar\b|\bedit\b|edição|lápis|pencil/i.test([e.getAttribute('aria-label'), e.getAttribute('title'), e.innerText].join(' '))
  let alvo = null
  let como = ''
  for (const linha of L.itens) {
    alvo = [...linha.querySelectorAll('button, a, [role=button], [tabindex]')].find((e) => R.visivel(e) && casa(e))
    if (alvo) { como = `o botão "${R.rotulo(alvo)}"`; window.__rotAlvoRotulo = R.rotulo(alvo); break }
  }
  if (!alvo) {
    // sem botão de editar: a própria linha, se ela é clicável. Clica numa CÉLULA sem controles (no meio da linha pode haver "Excluir").
    const linha = L.itens[0]
    const clicavel = linha && (linha.onclick || getComputedStyle(linha).cursor === 'pointer' || linha.getAttribute('role') === 'link' || linha.querySelector('a[href]') || linha.hasAttribute('tabindex'))
    const celula = clicavel && [...linha.children].find((c) => R.visivel(c) && !c.querySelector('button, input, select, a'))
    if (celula) { alvo = celula; como = 'a própria linha (a célula de texto)'; window.__rotAlvoRotulo = R.limpa(celula.innerText).slice(0, 60) } else return { semEditar: true }
  }
  const linhaDoAlvo = L.itens.find((i) => i.contains(alvo)) || alvo
  const campos = (el) => [...el.querySelectorAll('input, select, textarea')].filter(R.visivel).length
  window.__roteiroAlvo = alvo
  window.__rotAntes = { url: location.href, lista: L.el, linha: linhaDoAlvo, campos: campos(linhaDoAlvo), dialogos: R.dialogos().length, painel: !!R.painel(L.el) }
  return { como }
}

/** Depois do clique em editar: a lista continua à vista? E a edição veio como painel lateral, janela, na linha ou página própria? */
function editarOlhar() {
  const R = window.__rot
  const A = window.__rotAntes
  const mesmaUrl = location.href === A.url
  const lista = document.contains(A.lista) && R.visivel(A.lista) ? A.lista : null
  const dlg = R.dialogos()
  const pn = R.painel(A.lista)
  const abriu = dlg.length > A.dialogos ? dlg[0] : (pn && !A.painel ? pn : null)
  const resp = { mesmaUrl, listaNoDom: !!lista, forma: null, visivel: lista ? 1 : 0, titulo: '' }
  if (!mesmaUrl || !lista) return { ...resp, forma: 'pagina propria' }
  if (abriu) {
    const r = abriu.getBoundingClientRect()
    const l = lista.getBoundingClientRect()
    const dx = Math.max(0, Math.min(r.right, l.right) - Math.max(r.left, l.left))
    const dy = Math.max(0, Math.min(r.bottom, l.bottom) - Math.max(r.top, l.top))
    const encosta = r.left < 8 || innerWidth - r.right < 8 // colado numa lateral da janela
    const lateral = encosta && r.height >= innerHeight * 0.8 && r.width < innerWidth * 0.7
    return { ...resp, forma: lateral ? 'painel lateral' : 'janela', visivel: 1 - (dx * dy) / Math.max(1, l.width * l.height), titulo: R.limpa((abriu.querySelector('h1, h2, h3, [role=heading]') || abriu).innerText).slice(0, 60) }
  }
  const campos = [...A.linha.querySelectorAll('input, select, textarea')].filter(R.visivel).length
  if (document.contains(A.linha) && campos > A.campos) return { ...resp, forma: 'na linha' }
  return resp
}

function janelaAberta() {
  const R = window.__rot
  const A = window.__rotAntes
  return R.dialogos().length > A.dialogos || (!!R.painel(A.lista) && !A.painel)
}

/** O X da janela aberta ("Fechar", "×"...). Nunca "Cancelar": é ação protegida. */
function fecharAchar() {
  const R = window.__rot
  const dlg = R.dialogos()[0] || R.painel(window.__rotAntes?.lista)
  const x = dlg && [...dlg.querySelectorAll('button, a, [role=button]')].find((e) => R.visivel(e) && /^(fechar|close|×|✕|x)$/i.test(R.rotulo(e)))
  if (!x) return null
  window.__roteiroAlvo = x
  window.__rotAlvoRotulo = R.rotulo(x)
  return { rotulo: R.rotulo(x) }
}

function loteAchar() {
  const R = window.__rot
  const L = R.lista()
  if (!L) return { semLista: true }
  const caixa = L.itens.map((l) => l.querySelector('input[type=checkbox], [role=checkbox]')).find((c) => c && R.visivel(c))
  if (!caixa) return { semCaixa: true }
  window.__roteiroAlvo = caixa
  window.__rotAlvoRotulo = ''
  window.__rotLote = { rotulos: R.clicaveis(), selecionadoAntes: /selecionad|selected/i.test(document.body.innerText) }
  return {}
}

function loteOlhar() {
  const R = window.__rot
  const A = window.__rotLote
  return {
    novos: [...new Set(R.clicaveis().filter((r) => !A.rotulos.includes(r)))].slice(0, 4),
    texto: !A.selecionadoAntes && /selecionad|selected/i.test(document.body.innerText),
  }
}

function buscaOlhar() {
  const R = window.__rot
  const L = R.lista()
  if (!L) return { semLista: true }
  const campos = [...document.querySelectorAll('input, [role=searchbox]')].filter((i) => R.visivel(i) && (i.type === 'search' || i.getAttribute('role') === 'searchbox' || /busc|pesquis|search|procur/i.test([i.placeholder, i.getAttribute('aria-label'), i.name, i.id, i.labels?.[0]?.innerText].join(' '))))
  if (!campos.length) return { tem: false }
  const topo = L.el.getBoundingClientRect().top + scrollY
  const c = campos.find((x) => x.getBoundingClientRect().top + scrollY <= topo + 4)
  const alvo = c || campos[0]
  return { tem: true, acima: !!c, nome: R.limpa(alvo.placeholder || alvo.getAttribute('aria-label') || alvo.name || 'campo de busca').slice(0, 40) }
}

function abasOlhar() {
  const R = window.__rot
  const L = R.lista()
  if (!L) return { semLista: true }
  const topo = L.el.getBoundingClientRect().top
  // abas ou chips logo ACIMA da lista, fora do menu do aplicativo (nav, header, aside)
  const fora = (e) => !e.closest('nav, header, aside, [role=navigation], [role=banner]')
  const acima = (e) => { const b = e.getBoundingClientRect().bottom; return b <= topo + 4 && topo - b < 220 }
  const marcadas = [...document.querySelectorAll('[role=tab], [aria-selected], [aria-pressed]')].filter((e) => R.visivel(e) && fora(e) && acima(e))
  if (marcadas.length >= 2) return { tem: true, rotulos: marcadas.map(R.rotulo).slice(0, 5) }
  // chips sem ARIA: 3 ou mais botões irmãos, na mesma linha, um deles com classe de "ativo"
  for (const pai of document.querySelectorAll('div, ul, section')) {
    const bs = [...pai.children].filter((c) => R.visivel(c) && c.matches('button, a, [role=button], li, span') && fora(c) && acima(c))
    if (bs.length >= 3 && bs.some((c) => /active|ativo|selected|current|on\b/i.test(c.className)) && Math.abs(bs[0].getBoundingClientRect().top - bs[1].getBoundingClientRect().top) < 8) return { tem: true, rotulos: bs.map(R.rotulo).slice(0, 5) }
  }
  return { tem: false }
}

function ordenarAchar() {
  const R = window.__rot
  const L = R.lista()
  if (!L) return { semLista: true }
  if (L.tipo !== 'tabela') return { semTabela: true }
  for (const th of [...L.el.querySelectorAll('th, [role=columnheader]')].filter(R.visivel)) {
    const alvo = th.querySelector('button, a, [role=button]') || (th.hasAttribute('aria-sort') || th.onclick || getComputedStyle(th).cursor === 'pointer' ? th : null)
    if (alvo) { window.__roteiroAlvo = alvo; window.__rotAlvoRotulo = R.rotulo(alvo); window.__rotOrd = { lista: L.el }; return { coluna: R.limpa(th.innerText).slice(0, 30) } }
  }
  return { semCabecalho: true }
}

function ordenarOlhar() {
  const R = window.__rot
  const L = window.__rotOrd.lista
  return { ordem: [...L.querySelectorAll('tbody tr')].map((l) => R.limpa(l.innerText)).join('|'), sort: [...L.querySelectorAll('[aria-sort]')].map((e) => e.getAttribute('aria-sort')).join(',') }
}

function paginacaoOlhar() {
  const R = window.__rot
  const L = R.lista()
  if (!L) return { semLista: true }
  const topoLista = L.el.getBoundingClientRect().top
  const cand = [...document.querySelectorAll('button, a, [role=button], li')].filter((e) => R.visivel(e) && e.getBoundingClientRect().top >= topoLista - 4)
  const mais = cand.find((e) => /^(pr[óo]xim[ao]|next|anterior|previous|›|»)$/i.test(R.rotulo(e)) || /carregar mais|ver mais|mostrar mais|load more|show more|pr[óo]xima p[áa]gina|next page/i.test(R.rotulo(e)))
  if (mais) return { tem: true, nome: R.rotulo(mais) }
  const numeros = cand.filter((e) => /^\d{1,3}$/.test(R.rotulo(e)))
  if (numeros.length >= 2) return { tem: true, nome: 'páginas ' + numeros.slice(0, 3).map(R.rotulo).join(', ') }
  const caixa = document.querySelector('[class*=pagin], [aria-label*=pagin i]')
  return caixa && R.visivel(caixa) ? { tem: true, nome: 'área de paginação' } : { tem: false }
}

function vazioOlhar() {
  const R = window.__rot
  const L = R.lista()
  if (L) return { cheia: true }
  const re = /\bnenhum(a)?\b|\bvazi[ao]\b|ainda n[ãa]o|sem .{1,30}(cadastrad|ainda)|no .{1,30} (found|yet)|\bempty\b/i
  const texto = [...document.querySelectorAll('body *')].find((e) => R.visivel(e) && !e.closest('nav, header, button, a, [role=tab]') && e.children.length < 3 && R.limpa(e.innerText).length <= 120 && re.test(R.limpa(e.innerText)))
  if (!texto) return { semVazio: true }
  let pai = texto.parentElement
  for (let i = 0; i < 3 && pai; i++, pai = pai.parentElement) {
    const acao = [...pai.querySelectorAll('button, a[href], [role=button]')].find((e) => R.visivel(e) && !e.closest('nav, header, [role=tablist]') && R.rotulo(e))
    if (acao) return { texto: R.limpa(texto.innerText).slice(0, 60), acao: R.rotulo(acao) }
  }
  return { texto: R.limpa(texto.innerText).slice(0, 60), acao: null }
}

/* ================================== as sondas ================================== */

const NAO_DA = (evidencia) => ({ status: 'nao-da', evidencia })
const SEM_LISTA = NAO_DA('a tela não tem lista nem tabela para testar')

/** Cada sonda: `{ id, nome, palavras, rodar(nav, tela, ctx) => { status, evidencia, foto? } }`. */
export const SONDAS = [
  {
    id: 'editar-sem-perder-a-lista',
    nome: 'Editar sem perder a lista de vista (painel lateral, janela que não cobre tudo, ou na linha)',
    palavras: ['editar', 'edição', 'modal', 'pop-up', 'popup', 'janela', 'painel lateral', 'drawer', 'dialog', 'diálogo', 'editar sem sair da lista', 'lista visível', 'edição na linha'],
    async rodar(nav, tela, ctx) {
      await nav.avaliar(instalar)
      const a = await nav.avaliar(editarAchar)
      if (a?.semLista) return SEM_LISTA
      if (a?.semEditar) return NAO_DA('a lista não mostra "Editar", lápis nem linha clicável (pode estar atrás de um menu "...")')
      const c = await nav.clicarAlvo(manter)
      if (!c.ok) return NAO_DA(c.motivo === 'nao-tocar' ? 'o controle de edição tem nome de ação protegida e o programa não clica' : 'não consegui clicar em editar: ' + c.motivo)
      const o = await nav.avaliar(editarOlhar)
      const foto = await ctx.foto('editar')
      const quando = `clicar em ${a.como}`
      let r
      if (o.forma === 'painel lateral') r = { status: 'tem', evidencia: `${quando} abriu um painel lateral${o.titulo ? ` "${o.titulo}"` : ''}; a lista continua à vista` }
      else if (o.forma === 'na linha') r = { status: 'tem', evidencia: `${quando} abriu a edição na própria linha; a lista continua à vista` }
      else if (o.forma === 'janela' && o.visivel >= 0.15) r = { status: 'tem', evidencia: `${quando} abriu uma janela${o.titulo ? ` "${o.titulo}"` : ''} que não cobre a lista inteira (${Math.round(o.visivel * 100)}% dela à vista)` }
      else if (o.forma === 'janela') r = { status: 'nao-tem', evidencia: `${quando} abriu uma janela que cobre a lista inteira (só ${Math.round(o.visivel * 100)}% à vista)` }
      else if (o.forma === 'pagina propria') r = { status: 'nao-tem', evidencia: `${quando} levou para uma página própria${o.mesmaUrl ? ' (a lista sumiu da tela)' : ' (o endereço mudou)'}` }
      else r = { status: 'nao-tem', evidencia: `${quando} não abriu janela, painel nem edição na linha` }
      // fecha do jeito de quem usa: Escape, ou o X. Nunca "Cancelar" (protegido).
      if (o.forma === 'painel lateral' || o.forma === 'janela') {
        await nav.tecla('Escape')
        if (await nav.avaliar(janelaAberta)) await nav.clicarAlvo(fecharAchar)
      }
      return { ...r, foto }
    },
  },
  {
    id: 'acoes-em-lote',
    nome: 'Caixas de seleção nas linhas e barra de ações em lote',
    palavras: ['lote', 'seleção múltipla', 'selecionar vários', 'caixa de seleção', 'checkbox', 'ações em massa', 'bulk', 'barra de ações'],
    async rodar(nav) {
      await nav.avaliar(instalar)
      const a = await nav.avaliar(loteAchar)
      if (a?.semLista) return SEM_LISTA
      if (a?.semCaixa) return { status: 'nao-tem', evidencia: 'as linhas da lista não têm caixa de seleção' }
      const c = await nav.clicarAlvo(manter)
      if (!c.ok) return NAO_DA('não consegui marcar a caixa: ' + c.motivo)
      const o = await nav.avaliar(loteOlhar)
      await nav.clicarAlvo(manter) // desmarca: nada é executado
      return o.novos.length || o.texto
        ? { status: 'tem', evidencia: `ao marcar uma linha apareceu ${o.novos.length ? o.novos.map((n) => `"${n}"`).join(', ') : 'o contador de selecionados'} (marcada e desmarcada, sem executar ação)` }
        : { status: 'nao-tem', evidencia: 'marcar uma linha não fez aparecer barra nem botão de ação em lote' }
    },
  },
  {
    id: 'busca-na-lista',
    nome: 'Campo de busca acima da lista',
    palavras: ['busca', 'buscar', 'pesquisa', 'pesquisar', 'search', 'procurar', 'campo de busca'],
    async rodar(nav) {
      await nav.avaliar(instalar)
      const o = await nav.avaliar(buscaOlhar)
      if (o?.semLista) return SEM_LISTA
      if (!o?.tem) return { status: 'nao-tem', evidencia: 'não há campo de busca na tela' }
      return o.acima ? { status: 'tem', evidencia: `campo "${o.nome}" acima da lista` } : { status: 'nao-tem', evidencia: `há o campo "${o.nome}", mas abaixo do início da lista` }
    },
  },
  {
    id: 'filtros-como-abas',
    nome: 'Filtros como abas ou chips acima da lista (Todos, Ativos...)',
    palavras: ['filtro', 'filtros', 'abas', 'tabs', 'chips', 'segmentos', 'todos', 'ativos', 'status'],
    async rodar(nav) {
      await nav.avaliar(instalar)
      const o = await nav.avaliar(abasOlhar)
      if (o?.semLista) return SEM_LISTA
      return o?.tem ? { status: 'tem', evidencia: `abas ou chips acima da lista: ${o.rotulos.join(', ')}` } : { status: 'nao-tem', evidencia: 'não há abas nem chips de filtro acima da lista' }
    },
  },
  {
    id: 'ordenar-colunas',
    nome: 'Cabeçalho de coluna clicável que muda a ordem',
    palavras: ['ordenar', 'ordenação', 'classificar', 'sort', 'coluna', 'cabeçalho clicável'],
    async rodar(nav) {
      await nav.avaliar(instalar)
      const a = await nav.avaliar(ordenarAchar)
      if (a?.semLista) return SEM_LISTA
      if (a?.semTabela) return NAO_DA('a lista não é uma tabela com cabeçalho de coluna')
      if (a?.semCabecalho) return { status: 'nao-tem', evidencia: 'nenhum cabeçalho de coluna é clicável' }
      const antes = await nav.avaliar(ordenarOlhar)
      for (let i = 0; i < 2; i++) { // um clique pode só confirmar a ordem que já estava; o segundo inverte
        const c = await nav.clicarAlvo(manter)
        if (!c.ok) return NAO_DA('não consegui clicar no cabeçalho: ' + c.motivo)
        const depois = await nav.avaliar(ordenarOlhar)
        if (depois.ordem !== antes.ordem || (depois.sort && depois.sort !== antes.sort)) return { status: 'tem', evidencia: `clicar no cabeçalho "${a.coluna}" mudou a ordem das linhas` }
      }
      return { status: 'nao-tem', evidencia: `clicar duas vezes no cabeçalho "${a.coluna}" não mudou a ordem` }
    },
  },
  {
    id: 'paginacao',
    nome: 'Paginação ou "carregar mais" no fim da lista',
    palavras: ['paginação', 'paginar', 'página', 'carregar mais', 'ver mais', 'próxima', 'rolagem infinita', 'pagination', 'load more'],
    async rodar(nav) {
      await nav.avaliar(instalar)
      const o = await nav.avaliar(paginacaoOlhar)
      if (o?.semLista) return SEM_LISTA
      return o?.tem ? { status: 'tem', evidencia: `há ${o.nome} junto da lista` } : { status: 'nao-tem', evidencia: 'não há paginação nem "carregar mais" na lista' }
    },
  },
  {
    id: 'estado-vazio-com-acao',
    nome: 'Lista vazia mostra um texto e o botão da primeira ação',
    palavras: ['estado vazio', 'vazio', 'nenhum', 'primeira ação', 'empty state', 'comece', 'cadastrar primeiro'],
    async rodar(nav) {
      await nav.avaliar(instalar)
      const o = await nav.avaliar(vazioOlhar)
      if (o?.cheia) return NAO_DA('a lista não está vazia (a sonda só avalia lista vazia)')
      if (o?.semVazio) return NAO_DA('a tela não tem lista nem texto de vazio')
      return o.acao ? { status: 'tem', evidencia: `"${o.texto}" com o botão "${o.acao}"` } : { status: 'nao-tem', evidencia: `"${o.texto}", sem botão de primeira ação` }
    },
  },
]

/* =================================== o runner =================================== */

/**
 * Roda as sondas em cada tela do mapa, neste processo (precisa de `node --experimental-websocket`). `plano`:
 * `{ raiz, url?, mapa?, sondas? (objetos com `id`) ou soSondas? (ids), soTelas? (ids ou nomes), saida?, fotos?,
 *   prazoMs = 300000, acesso?, permitir?, qualquerUrl?, naoTocar?, naoTocarSo?, idioma?, largura?, altura? }`.
 * Sem `mapa`, lê o do disco (`mapa.json`). Devolve `{ url, quando, parcial, resultados, avisos }`, com
 * `resultados: [{ tela, nome, id, status, evidencia, foto }]` (uma linha por tela e sonda), e grava `sondas.json`.
 */
export async function sondar(plano) {
  const mapa = plano.mapa || lerMapa(plano.raiz)
  if (!mapa?.telas?.length) throw new Error('sem mapa das telas: rode o mapa antes (as sondas rodam tela por tela)')
  const url = plano.url || mapa.url
  const saida = plano.saida || path.join(plano.raiz, 'docs', 'roteiro')
  const dirFotos = plano.fotos || path.join(saida, 'fotos')
  const ids = plano.soSondas || plano.sondas?.map((s) => s.id)
  const sondas = ids ? SONDAS.filter((s) => ids.includes(s.id)) : SONDAS
  const telas = plano.soTelas ? mapa.telas.filter((t) => plano.soTelas.includes(t.id) || plano.soTelas.includes(t.nome)) : mapa.telas
  const limite = Date.now() + (plano.prazoMs || 300000)
  const resultados = []
  const avisos = []
  const saidaJson = { url, quando: new Date().toISOString(), parcial: true, resultados, avisos }
  const gravar = (fim = false) => {
    const novo = path.join(saida, 'sondas.novo.json')
    escreverAtomico(novo, JSON.stringify({ ...saidaJson, parcial: !fim, ...(!fim && { avisos: [...avisos, 'sondas parciais: o processo foi interrompido antes de terminar'] }) }, null, 2) + '\n')
    if (fim) fs.renameSync(novo, path.join(saida, 'sondas.json'))
  }

  const nav = await abrirNavegador({
    largura: plano.largura || 390, altura: plano.altura || 844, qualquerUrl: Boolean(plano.qualquerUrl), permitir: plano.permitir || [], acesso: plano.acesso || null,
    ...(plano.idioma && { idioma: plano.idioma }), ...(plano.naoTocar && { naoTocar: plano.naoTocar }), ...(plano.naoTocarSo && { naoTocarSo: plano.naoTocarSo }),
  })
  try {
    for (const tela of telas) {
      if (Date.now() > limite) { avisos.push(`o prazo acabou: faltaram as telas a partir de "${tela.nome}"`); break }
      const semRodar = (s, evidencia) => resultados.push({ tela: tela.id, nome: tela.nome, id: s.id, status: 'nao-da', evidencia, foto: null })
      let sig = await alcancarNoMapa(nav, url, tela).catch((e) => { avisos.push(`${tela.nome}: ${e.message}`); return null })
      if (!sig || (tela.assinatura && sig !== tela.assinatura)) {
        for (const s of sondas) semRodar(s, sig ? 'a tela voltou diferente do mapa ao refazer o caminho' : 'não consegui refazer o caminho até esta tela')
        gravar()
        continue
      }
      for (const s of sondas) {
        let r
        try {
          const foto = async (nome) => {
            const arq = path.join(dirFotos, `sonda-${tela.id}-${nome}.jpg`)
            await nav.foto(arq)
            return path.relative(saida, arq).split(path.sep).join('/')
          }
          r = await s.rodar(nav, tela, { foto })
        } catch (e) {
          r = NAO_DA('a sonda deu erro: ' + String(e?.message || e).slice(0, 120))
        }
        resultados.push({ tela: tela.id, nome: tela.nome, id: s.id, status: r.status, evidencia: r.evidencia, foto: r.foto || null })
        // a sonda pode ter mexido na tela (marcou caixa, ordenou, abriu janela): volta ao ponto de partida antes da próxima
        const agora = (await nav.observar({ soVisivel: false }).catch(() => null))?.assinatura
        if (agora && agora !== sig) {
          sig = await alcancarNoMapa(nav, url, tela).catch(() => null)
          if (!sig) { avisos.push(`${tela.nome}: depois da sonda "${s.id}" não consegui voltar à tela; as sondas seguintes dela ficaram sem rodar`); break }
        }
      }
      gravar()
    }
    gravar(true)
    return saidaJson
  } finally {
    await nav.fechar()
  }
}

/**
 * Chama o filho com prazo e devolve `{ resultados, caminho, url, quando, avisos }` (o `sondas.json` lido do disco).
 * `plano` é o da `sondar`, com `raiz` (ou `saida`) obrigatória; `mapa` (objeto) e `sondas` (objetos) não vão pela linha de
 * comando: o filho lê o mapa do disco e recebe só os ids das sondas. O pai espera o prazo mais 30 s; passou, SIGTERM ao
 * filho e só 15 s depois SIGKILL.
 */
export async function executarSondas(plano) {
  const saida = plano?.saida || (plano?.raiz && path.join(plano.raiz, 'docs', 'roteiro'))
  if (!saida) throw new Error('executarSondas precisa de `raiz` (a pasta do projeto) ou `saida`')
  const { mapa, sondas, ...limpo } = plano
  void mapa
  if (sondas) limpo.soSondas = sondas.map((s) => s.id)
  const prazo = (plano.prazoMs || 300000) + 30000
  const r = await rodarFilho({ script: ESTE, plano: limpo, prazoMs: prazo })
  const parcial = `o que já foi feito ficou em ${path.join(saida, 'sondas.novo.json')}`
  if (r.passou) throw new Error(`as sondas passaram do prazo (${Math.round(prazo / 1000)} s) e o filho foi parado; ${parcial}`)
  if (r.codigo !== 0) throw new Error('as sondas falharam: ' + (r.erro || 'código ' + r.codigo) + `; ${parcial}`)
  const caminho = path.join(saida, 'sondas.json')
  return { ...JSON.parse(fs.readFileSync(caminho, 'utf8')), caminho }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === '--plano') {
  sondar(JSON.parse(process.argv[3])).then(() => process.exit(0)).catch((e) => { console.error(String(e?.message || e)); process.exit(1) })
}
