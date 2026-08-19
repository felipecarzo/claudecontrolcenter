/**
 * CC-80 — a visão estrutural: onde mexer primeiro.
 *
 * Nasceu de um pedido de ESTUDO, não de tarefa: *"ter uma visão do projeto
 * mais estrutural, voltada pra uma forma que funciona melhor com o meu tipo
 * de raciocínio visual"*. O estudo (`docs/produto/ESTUDO-VISAO-ESTRUTURAL.md`)
 * mediu três formas e recomendou a B: as frentes do roadmap como território,
 * com o que falta e quem está lá agora — na língua dele, nunca em `src/**`.
 *
 * A pergunta que fechava o item, respondida por ele em 19/08: *"olharia"*.
 *
 * ## O que faltava para a opção B existir, e como nasceu
 *
 * O roadmap (`roadmap.mjs`) já sabe quantos itens cada frente tem, quantos
 * estão feitos, e o `trabalho.mjs` já sabe quem está com sessão aberta ali.
 * A peça que faltava era **quais arquivos aquela frente costuma tocar** — o
 * estudo já apontava o caminho: derivar do git, nunca escrever à mão, porque
 * mapa escrito à mão diverge do código em dias.
 *
 * A ponte é o próprio texto do commit: cada mensagem deste projeto já cita
 * os códigos `CC-nnn` que ela fechou (medido em 19/08: 261 ocorrências nos
 * últimos 400 commits). Casando os códigos da frente com os códigos citados
 * no commit, e o commit com os arquivos que ele mudou, o cruzamento sai
 * inteiro do que já está escrito — sem campo novo para alguém esquecer de
 * preencher.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { acharRoadmap } from './roadmap.mjs'

/** Todo `CC-nnn` citado no título de uma frente (`### CC-80 ⏸ …`). */
const codigosDoTitulo = (titulo) => [...String(titulo || '').matchAll(/\b([A-Z]{1,3}-\d+)\b/g)].map((m) => m[1])

/**
 * O histórico bruto: cada commit, os códigos que ele cita, e os arquivos que
 * mudou. Shell único (`git log --name-only`), nunca um comando por commit —
 * é a mesma economia que o resto do projeto já pratica para git.
 *
 * Medido em 19/08 neste projeto: **56ms para 400 commits**. Cabe numa rota
 * que a tela chama, sem relógio próprio.
 */
export function historicoDeCommits(cwd, { limite = 400 } = {}) {
  const arquivo = acharRoadmap(cwd)
  const raiz = arquivo ? path.dirname(path.dirname(arquivo)) : cwd
  if (!raiz) return []

  let saida = ''
  try {
    saida = execFileSync('git', [
      'log', `-n`, String(limite), '--pretty=format:__commit__%H', '--name-only',
    ], { cwd: raiz, encoding: 'utf8', timeout: 10_000, maxBuffer: 2e7, stdio: ['ignore', 'pipe', 'ignore'] })
    /* O CORPO da mensagem (onde os códigos moram) sai numa segunda chamada,
       de propósito: misturar `%B` com `--name-only` no mesmo `--pretty` faz o
       nome do arquivo colar na última linha da mensagem quando ela não
       termina em `\n`, e um `CC-80` dentro de uma linha de prosa vira
       indistinguível de um nome de arquivo. Duas leituras baratas (a de cima
       já mede 56ms) valem mais que um parser que adivinha onde um termina. */
  } catch { return [] }

  let corpos = ''
  try {
    corpos = execFileSync('git', [
      'log', '-n', String(limite), '--pretty=format:__commit__%H%n%B',
    ], { cwd: raiz, encoding: 'utf8', timeout: 10_000, maxBuffer: 2e7, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return [] }

  const codigosPorHash = new Map()
  for (const bloco of corpos.split('__commit__').slice(1)) {
    const nl = bloco.indexOf('\n')
    const hash = bloco.slice(0, nl)
    const codigos = [...new Set([...bloco.slice(nl).matchAll(/\b([A-Z]{1,3}-\d+)\b/g)].map((m) => m[1]))]
    if (codigos.length) codigosPorHash.set(hash, codigos)
  }

  const commits = []
  for (const bloco of saida.split('__commit__').slice(1)) {
    const nl = bloco.indexOf('\n')
    const hash = bloco.slice(0, nl)
    const codigos = codigosPorHash.get(hash)
    if (!codigos) continue // commit sem código citado não ajuda a atribuir território
    const arquivos = bloco.slice(nl + 1).split('\n').map((l) => l.trim()).filter(Boolean)
    commits.push({ hash, codigos, arquivos })
  }
  return commits
}

/**
 * O mapa: cada frente (grupo do roadmap) com os arquivos que ela mais tocou,
 * e quem tem sessão aberta ali agora.
 *
 * Puro — recebe o histórico já lido, nunca chama git sozinho. É o que torna
 * isto testável sem repositório de verdade.
 */
export function mapear({ grupos = [], commits = [], jobs = [] } = {}) {
  return grupos.map((g) => {
    const codigosDaFrente = new Set(g.frentes?.flatMap((f) => codigosDoTitulo(f.titulo)) || [])

    const contagem = new Map()
    for (const c of commits) {
      if (!c.codigos.some((cod) => codigosDaFrente.has(cod))) continue
      for (const arq of c.arquivos) contagem.set(arq, (contagem.get(arq) || 0) + 1)
    }
    const arquivos = [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([arquivo, toques]) => ({ arquivo, toques }))

    const aqui = jobs.filter((j) => j.frente && casa(j.frente, g.titulo))

    /* `g.itens`/`g.feitos` contam checklist DENTRO do corpo de cada item
       (linhas `- [ ]`), não os itens CC-nnn em si — a maioria das frentes
       deste roadmap usa ✅ no título em vez de checkbox, então esse contador
       fica perto de zero mesmo em frente fechada. "Abertos" aqui é a
       contagem que o CC-165 já provou certa: quantos CC-itens não têm
       `estado === 'feito'`. */
    const frentesItem = g.frentes || []
    const abertos = frentesItem.filter((f) => f.estado !== 'feito').length

    return {
      titulo: g.titulo,
      total: frentesItem.length,
      abertos,
      agentes: aqui.map((j) => ({ id: j.id, status: j.status, maquina: j.origem?.nome || null })),
      arquivos,
    }
  })
}

/** A frente com o nome dele bate com o texto do roadmap? Mesma folga do
 *  `casaFrente` de `trabalho.mjs`: "Bancada" tem que casar com "Frente:
 *  Bancada, auditoria e teste agnóstico". */
function casa(daSessao, doRoadmap) {
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const a = norm(daSessao)
  const b = norm(doRoadmap)
  if (!a || a.length < 3) return false
  return b.includes(a) || a.includes(b.slice(0, 24))
}
