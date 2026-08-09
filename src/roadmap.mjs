// O mapa do projeto, lido do ROADMAP.md que já existe.
//
// Por que existe: o cartão do agente dizia "Pierre: travessia gamificada na
// leitura das clausulas" e o Felipe não reconhecia o que era — embora "Pierre"
// seja uma seção do roadmap do próprio inovallbond. O painel mostrava a folha
// sem a árvore. Aqui se lê a árvore.
//
// Uma fonte só, de propósito: o arquivo que ele e os agentes já editam. Nada
// de banco paralelo que envelhece sozinho.
//
// O parser é deliberadamente tolerante — são 43 roadmaps, escritos ao longo de
// meses, sem formato combinado. Vale o que o Markdown já diz: `##` agrupa,
// `###` é a frente de trabalho, item de lista é tarefa.

import fs from 'node:fs'
import path from 'node:path'

const CAMINHOS = [['docs', 'ROADMAP.md'], ['ROADMAP.md'], ['docs', 'roadmap.md'], ['ROADMAP.MD']]

/** Sobe do diretório de trabalho até achar um roadmap. `null` se não houver. */
export function acharRoadmap(cwd) {
  let dir = cwd
  for (let i = 0; i < 8 && dir; i++) {
    for (const partes of CAMINHOS) {
      const alvo = path.join(dir, ...partes)
      try { if (fs.statSync(alvo).isFile()) return alvo } catch { /* segue */ }
    }
    const pai = path.dirname(dir)
    if (pai === dir) break
    dir = pai
  }
  return null
}

// Emoji e palavra viram o mesmo estado: os roadmaps usam ora um, ora outro.
const ESTADOS = [
  { chave: 'bloqueado', teste: /🔴|⛔|bloquead|travad|impedid/i },
  { chave: 'esperando', teste: /🟡|⏳|aguardand|depende d[eao]\s+(?!mim)/i },
  { chave: 'feito', teste: /✅|✔|conclu[íi]d|entregue|hist[óo]rico|feito/i },
  { chave: 'aberto', teste: /🟢|aberto|agora|pr[óo]xim|fazer/i },
]

const estadoDe = (titulo) => ESTADOS.find((e) => e.teste.test(titulo))?.chave || 'aberto'

/** `## 🔴 Bloqueado — só o Felipe destrava` → `Bloqueado — só o Felipe destrava` */
const limpar = (s) => s
  .replace(/^#+\s*/, '')
  .replace(/`[^`]*`/g, '')             // tags tipo `#pierre`
  .replace(/[🔴🟡🟢🔥✅✔⛔⏳📌]/gu, '')
  .replace(/\s+/g, ' ')
  .trim()

/**
 * Devolve os grupos (`##`) com suas frentes (`###`) e a contagem de itens.
 * Sem o texto inteiro: o painel mostra o mapa, não o documento — quem quer ler
 * tudo abre o arquivo.
 */
export function lerRoadmap(cwd) {
  const arquivo = acharRoadmap(cwd)
  if (!arquivo) return null
  let texto
  try { texto = fs.readFileSync(arquivo, 'utf8') } catch { return null }

  const grupos = []
  let grupo = null
  let frente = null

  // `\r?\n` e não `\n`: com CRLF sobra um `\r` no fim da linha, e `.` no regex
  // NÃO casa `\r`. Resultado: `(.+)$` falhava em todo cabeçalho e o roadmap
  // inteiro saía com zero grupos, sem erro nenhum. Metade dos arquivos é CRLF.
  for (const linha of texto.split(/\r?\n/)) {
    const h2 = /^##\s+(?!#)(.+)$/.exec(linha)
    const h3 = /^###\s+(?!#)(.+)$/.exec(linha)
    const item = /^\s*[-*]\s+(?!\[)(.+)$/.exec(linha)
    const marcado = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/.exec(linha)

    if (h2) {
      grupo = { titulo: limpar(h2[1]), estado: estadoDe(h2[1]), frentes: [], itens: 0, feitos: 0 }
      grupos.push(grupo)
      frente = null
      continue
    }
    if (h3) {
      if (!grupo) {
        grupo = { titulo: '', estado: 'aberto', frentes: [], itens: 0, feitos: 0 }
        grupos.push(grupo)
      }
      frente = { titulo: limpar(h3[1]), estado: estadoDe(h3[1]), itens: 0, feitos: 0 }
      grupo.frentes.push(frente)
      continue
    }
    // Só conta item de lista; parágrafo solto é explicação, não tarefa.
    if (marcado || item) {
      const feito = marcado ? marcado[1].toLowerCase() === 'x' : false
      const onde = frente || grupo
      if (!onde) continue
      onde.itens++
      if (feito) onde.feitos++
      if (frente && grupo) { grupo.itens++; if (feito) grupo.feitos++ }
    }
  }

  return {
    arquivo,
    linhas: texto.split('\n').length,
    atualizadoEm: (() => { try { return fs.statSync(arquivo).mtimeMs } catch { return null } })(),
    grupos: grupos.filter((g) => g.titulo || g.frentes.length),
  }
}

/**
 * Casa o que o agente declarou como `frente` com uma frente do roadmap.
 * Sem acento e sem caixa, e aceita que um contenha o outro: o agente escreve
 * "Pierre" e o roadmap diz "Pierre — anonimização local e o caminho da redação".
 */
export function acharFrente(mapa, declarada) {
  if (!mapa || !declarada) return null
  const norma = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const alvo = norma(declarada)
  if (!alvo) return null
  for (const g of mapa.grupos) {
    for (const f of g.frentes) {
      const t = norma(f.titulo)
      if (t === alvo || t.startsWith(alvo) || alvo.startsWith(t.split(' ')[0])) {
        return { grupo: g.titulo, ...f }
      }
    }
  }
  return null
}

export const _internals = { limpar, estadoDe }
