/**
 * O que cada sigla quer dizer, e em que pasta ela mora.
 *
 * ## O pedido, em 17/08
 *
 * > "sobre os nomes (esc, cc etc), podemos criar um glossário desses nomes ou
 * > uma opção de ? do lado dos nomes explicando que é o projeto tal na pasta
 * > tal, pq as vezes eu me perco nesses nomes também"
 *
 * As siglas nasceram no mesmo dia, ao dar código estável aos itens do backlog.
 * Resolveram o problema de apontar para uma tarefa e criaram outro: `NV-08` não
 * diz a ninguém que aquilo é o inovallbond.
 *
 * ## Derivado, como o resto
 *
 * Nada aqui é digitado. A sigla sai do roadmap de cada projeto (a mais usada
 * vence) e a pasta sai do disco. Uma lista escrita à mão ficaria errada no dia
 * em que um projeto novo aparecesse, que é exatamente quando ele mais precisa
 * da explicação.
 *
 * ## Por que fica no servidor e não na tela
 *
 * A tela mostra a mesma sigla em quatro lugares. Se cada um resolvesse o nome
 * por conta, seriam quatro contas para a mesma pergunta, e um dia elas
 * discordariam.
 */
import fs from 'node:fs'
import path from 'node:path'

/** A sigla que um roadmap usa, e quantas vezes. */
function siglaDoArquivo(arquivo) {
  let md = ''
  try { md = fs.readFileSync(arquivo, 'utf8') } catch { return null }
  const conta = new Map()
  for (const l of md.split(/\r?\n/)) {
    if (!/^###\s/.test(l)) continue
    const m = /\b([A-Z]{2,3})-\d+\b/.exec(l)
    if (m) conta.set(m[1], (conta.get(m[1]) || 0) + 1)
  }
  if (!conta.size) return null
  const [sigla, vezes] = [...conta].sort((a, b) => b[1] - a[1])[0]
  return { sigla, vezes }
}

/**
 * Todas as siglas conhecidas desta máquina.
 *
 * `jobs` entra porque nem toda sigla vem de roadmap: um agente pode usar um
 * código próprio nos to-dos dele, e foi o caso do `ESC` do escritório, que
 * apareceu na tela sem estar em roadmap nenhum.
 */
export function todas(projetos = [], jobs = []) {
  const mapa = new Map()

  for (const raiz of projetos) {
    const achado = siglaDoArquivo(path.join(raiz, 'docs', 'ROADMAP.md'))
    if (!achado) continue
    /* Árvore de trabalho do git é o MESMO projeto: `proj_controlcenter--front`
       tem o roadmap inteiro copiado e apareceria como um segundo dono da mesma
       sigla, com o dobro dos itens. */
    if (/--/.test(path.basename(raiz))) continue
    const anterior = mapa.get(achado.sigla)
    if (!anterior || achado.vezes > anterior.itens) {
      mapa.set(achado.sigla, {
        sigla: achado.sigla,
        projeto: path.basename(raiz),
        pasta: raiz,
        itens: achado.vezes,
        de: 'roadmap',
      })
    }
  }

  /* As que só existem no que um agente escreveu. Sem roadmap não há contagem,
     e dizer o projeto já é o que ele precisa. */
  for (const j of jobs) {
    for (const t of j.todos || []) {
      const m = /\b([A-Z]{2,3})-\d+\b/.exec(String(t.text || ''))
      if (!m || mapa.has(m[1])) continue
      mapa.set(m[1], {
        sigla: m[1],
        projeto: j.project || 'desconhecido',
        pasta: j.cwd || null,
        itens: null,
        de: 'agente',
      })
    }
  }

  return [...mapa.values()].sort((a, b) => a.sigla.localeCompare(b.sigla))
}

/**
 * A frase que aparece ao tocar no ponto de interrogação.
 *
 * Curta de propósito: é uma dica, não um verbete. Quem quiser mais abre a tela
 * de glossário, que existe para isso.
 */
export function explicar(sigla, lista) {
  const s = lista.find((x) => x.sigla === String(sigla).toUpperCase())
  if (!s) return null
  const onde = s.pasta ? s.pasta.replace(process.env.HOME || '~', '~') : null
  return {
    sigla: s.sigla,
    frase: `${s.sigla} é o projeto ${s.projeto}`,
    pasta: onde,
    itens: s.itens,
    origem: s.de === 'agente'
      ? 'esta sigla não está no backlog do projeto, veio do que um agente escreveu'
      : null,
  }
}
