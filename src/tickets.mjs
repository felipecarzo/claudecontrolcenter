/**
 * Todo item do backlog ganha um código estável.
 *
 * ## O problema, visto por ele na tela em 16/08
 *
 * A lista mostrava `#07`, `#12`, `#14`. Parecem código e não são: é a POSIÇÃO
 * do item no arquivo. Insira um item no meio do backlog e todos os números
 * abaixo mudam de dono.
 *
 * Ele: *"vamos resolver essa questao dos numeros na lista, pra ficar mais
 * atualizado, criar um sistema de ticket melhor"*.
 *
 * Um número que muda sozinho é pior que nenhum: ele decora "mexe no 12" hoje e
 * amanhã o 12 é outra coisa. E o pedido original era justamente poder apontar
 * para um item pelo nome curto.
 *
 * ## Como o código é escolhido
 *
 * **Escrito no arquivo, uma vez, e nunca mais recalculado.** Isso é o oposto da
 * regra de derivar que o resto do projeto segue, e a exceção é o ponto: um
 * identificador precisa sobreviver a mudança de ordem, de título e de estado.
 * Derivar daria exatamente o número instável que ele acabou de rejeitar.
 *
 * O prefixo sai do que o projeto já usa. Levantado nos roadmaps reais:
 * `proj_controlcenter` usa `CC` em 8 de 17 itens; os outros não usam nenhum. Sem
 * prefixo estabelecido, ele é derivado do nome da pasta, e nunca inventado à
 * mão para não haver dois padrões no mesmo lugar.
 *
 * O número continua de onde o projeto parou. Nunca reaproveita: item apagado
 * leva o código junto, porque reciclar faria uma conversa antiga apontar para
 * a coisa errada.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Onde o roadmap mora, se morar. */
const arquivoDe = (raiz) => {
  for (const p of [['docs', 'ROADMAP.md'], ['ROADMAP.md']]) {
    const alvo = path.join(raiz, ...p)
    try { if (fs.statSync(alvo).isFile()) return alvo } catch { /* segue */ }
  }
  return null
}

const CODIGO = /\b([A-Z]{1,3})-(\d+)\b/

/**
 * O prefixo do projeto: o que ele já usa, ou um derivado do nome.
 *
 * `proj_controlcenter` vira `CC` porque é o que já está escrito lá. Um projeto
 * novo vira as iniciais das partes do nome (`app_escritorio` = `AE`), e com uma
 * letra só quando não há partes.
 */
export function prefixoDe(raiz, texto = null) {
  const md = texto ?? (arquivoDe(raiz) ? fs.readFileSync(arquivoDe(raiz), 'utf8') : '')
  const usados = new Map()
  for (const l of md.split(/\r?\n/)) {
    if (!/^###\s/.test(l)) continue
    const m = CODIGO.exec(l)
    if (m) usados.set(m[1], (usados.get(m[1]) || 0) + 1)
  }
  // o mais frequente vence: um item solto com outro prefixo não muda o padrão
  if (usados.size) return [...usados].sort((a, b) => b[1] - a[1])[0][0]

  const nome = path.basename(raiz).replace(/^(proj|app|game|web)[_-]/i, '')
  const partes = nome.split(/[_\-\s]+/).filter(Boolean)
  const sigla = partes.length > 1
    ? partes.map((p) => p[0]).join('')
    : nome.replace(/[aeiou]/gi, '').slice(0, 2) || nome.slice(0, 2)
  return sigla.toUpperCase().slice(0, 3)
}

/** O maior número já usado com aquele prefixo. Nunca se reaproveita número. */
export function ultimoNumero(md, prefixo) {
  let maior = 0
  for (const m of md.matchAll(new RegExp(`\\b${prefixo}-(\\d+)\\b`, 'g'))) {
    maior = Math.max(maior, Number(m[1]))
  }
  return maior
}

/**
 * Dá código aos itens que não têm, e devolve o texto novo.
 *
 * Função pura: recebe texto, devolve texto. Quem grava é quem chamou, e é o que
 * permite o `--seco` mostrar o que mudaria sem tocar no arquivo.
 *
 * O código entra logo depois do `###`, antes de qualquer marcador de estado, que
 * é onde os oito que já existem estão. Assim a leitura do roadmap não muda em
 * nada: os marcadores continuam onde estavam.
 */
export function numerar(md, prefixo, { comecarEm = null } = {}) {
  let n = comecarEm ?? ultimoNumero(md, prefixo)
  const mudancas = []

  const linhas = md.split(/\r?\n/).map((linha) => {
    if (!/^###\s/.test(linha)) return linha
    if (CODIGO.test(linha)) return linha        // já tem código, fica como está

    const resto = linha.replace(/^###\s+/, '')
    // seção de agrupamento não é item de backlog e não recebe código
    if (/^(Frente|Vis[ãa]o|Decis|O que|Limites|Aberto|Fechado)\b/i.test(resto) && !/⏸|✅/.test(resto)) {
      // "Frente:" é o caso mais comum e É item de trabalho: recebe código
      if (!/^Frente\b/i.test(resto)) return linha
    }

    n += 1
    const codigo = `${prefixo}-${String(n).padStart(2, '0')}`
    mudancas.push({ codigo, titulo: resto.slice(0, 60) })
    return `### ${codigo} ${resto}`
  })

  return { texto: linhas.join('\n'), mudancas, ultimo: n }
}

/** Aplica num projeto. `seco` mostra sem gravar. */
export function aplicar(raiz, { seco = false } = {}) {
  const arquivo = arquivoDe(raiz)
  if (!arquivo) return { ok: false, erro: 'este projeto não tem ROADMAP.md' }

  let md = ''
  try { md = fs.readFileSync(arquivo, 'utf8') } catch (e) { return { ok: false, erro: String(e.message) } }

  const prefixo = prefixoDe(raiz, md)
  const r = numerar(md, prefixo)
  if (!r.mudancas.length) return { ok: true, prefixo, mudancas: [], gravou: false }

  if (!seco) {
    try {
      // cópia antes: o roadmap é escrito à mão e não tem outra fonte
      fs.copyFileSync(arquivo, `${arquivo}.bak`)
      const tmp = `${arquivo}.tmp`
      fs.writeFileSync(tmp, r.texto)
      fs.renameSync(tmp, arquivo)
    } catch (e) { return { ok: false, erro: String(e.message) } }
  }

  return { ok: true, arquivo, prefixo, mudancas: r.mudancas, gravou: !seco }
}
