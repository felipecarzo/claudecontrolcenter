/**
 * CC-522: o leitor diário roda de manhã sozinho e grava um arquivo por projeto.
 *
 * O pedido (decisão dele em 11/09): "o leitor diário roda de manhã, escreve um
 * arquivo por projeto e tem tela no cockpit: o que fechou sozinho, o que espera
 * ele, o que travou". Uma sessão anterior trocou isso por leitura sob demanda
 * sem combinar, e o item ficou aberto. O cálculo continua o de
 * `leitorDoDia` (backlog.mjs); aqui só entram o horário e os arquivos.
 *
 * Onde: <casa>/leitor/<AAAA-MM-DD>/<projeto>.md (fora dos repositórios, para
 * não sujar o git de nenhum projeto). Quando: a partir das 7h de Brasília, uma
 * vez por dia; o painel confere de meia em meia hora, então religar o painel
 * de manhã não perde o dia.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const HORA = 7
const casa = () => process.env.CC_HOME || path.join(os.homedir(), '.local', 'share', 'agent-cockpit')
export const PASTA = () => path.join(casa(), 'leitor')
const diaBrasilia = (agora) => new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 10)
const horaBrasilia = (agora) => (agora.getUTCHours() + 21) % 24

/** O texto de um projeto, legível fora do painel. */
export function markdownDe(nome, l, dia) {
  const lista = (xs, vazio) => (xs.length ? xs.map((x) => `- ${x.id}: ${x.titulo}`).join('\n') : `- ${vazio}`)
  return `# ${nome}: leitor de ${dia}\n\n`
    + `Fechados desde ontem: ${l.fechados}.\n\n`
    + `## O que fechou sozinho (com prova automática ou na tela)\n${lista(l.sozinho, 'nada')}\n\n`
    + `## O que espera você\n${lista(l.dele, 'nada')}\n\n`
    + `## O que travou\n${lista(l.travados, 'nada')}\n`
}

/** A última leitura gravada: o dia e quantos arquivos. */
export function ultima() {
  let dias = []; try { dias = fs.readdirSync(PASTA()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() } catch { return null }
  const dia = dias.at(-1); if (!dia) return null
  const p = path.join(PASTA(), dia)
  const arquivos = fs.readdirSync(p).filter((f) => f.endsWith('.md'))
  const em = Math.max(...arquivos.map((f) => fs.statSync(path.join(p, f)).mtimeMs), 0)
  return { dia, arquivos: arquivos.length, em, pasta: p }
}

/**
 * Roda se já passou das 7h de Brasília e o dia ainda não foi gravado.
 * `projetos` é [{ nome, leitor }] já calculado. Devolve o que gravou, ou null.
 */
export function talvezGravar(projetos, agora = new Date()) {
  const dia = diaBrasilia(agora)
  if (horaBrasilia(agora) < HORA) return null
  const pasta = path.join(PASTA(), dia)
  if (fs.existsSync(pasta)) return null
  fs.mkdirSync(pasta, { recursive: true })
  for (const p of projetos) fs.writeFileSync(path.join(pasta, `${p.nome.replace(/[^\w.-]/g, '_')}.md`), markdownDe(p.nome, p.leitor, dia))
  return { dia, arquivos: projetos.length, pasta }
}
