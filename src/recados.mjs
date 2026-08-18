/**
 * O motor puro dos recados entre sessões (CC-84/85/134).
 *
 * Fica separada de `hooks/routia/recados.mjs` pela mesma regra do
 * `framework.mjs`/`frameworkDisco.mjs`: motor puro aqui, o que sabe onde as
 * coisas moram e o que roda como hook/CLI lá.
 *
 * A separação não é estilo: o hook tem código de topo que lê `process.argv` e
 * chama `process.exit()` incondicionalmente. Importar aquele arquivo de dentro
 * do painel derrubava QUALQUER comando do `cc.mjs`, porque o `argv` de quem
 * importa não é `enviar`/`caixa`/`log`/`quem`, e o arquivo saía com código 1 no
 * meio do carregamento. Achado em 18/08, ao tentar ler o log pelo painel: o
 * sintoma foi `cc.mjs routia presenca` parar de responder o que sempre
 * respondeu, sem erro nenhum apontando pra causa.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** Tipos de recado, e o que cada um pede de quem recebe. Poucos de propósito:
 *  lista longa vira taxonomia que ninguém lembra na hora de mandar. */
export const TIPOS = {
  aviso: {
    rotulo: 'aviso',
    acao: 'Leia e siga o que estava fazendo. Nada a responder.',
  },
  vou_mexer: {
    rotulo: 'vou mexer num arquivo seu',
    acao: 'Se isso atrapalha o que você está fazendo, responda com `pare`; '
      + 'se não atrapalha, responda com `liberado` e siga.',
  },
  pare: {
    rotulo: 'PARE e me responda',
    acao: 'Pare o que está fazendo agora, responda, e só então continue.',
  },
  liberado: {
    rotulo: 'pode mexer, não me atrapalha',
    acao: 'Você está liberado para o que pediu. Siga.',
  },
  terminei: {
    rotulo: 'terminei, pode ir',
    acao: 'O arquivo está livre. Se você estava esperando por isto, siga.',
  },
}

const arquivoDe = (raiz) => join(raiz, 'docs', '.recados.json')

/** Sobe até achar a raiz do projeto (a que tem o quadro de rotas). */
export function acharRaiz(inicio) {
  let dir = resolve(inicio || process.cwd())
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'docs', 'ROTAS-ATIVAS.md'))) return dir
    const pai = dirname(dir)
    if (pai === dir) break
    dir = pai
  }
  return null
}

export function ler(raiz) {
  try { return JSON.parse(readFileSync(arquivoDe(raiz), 'utf8')) } catch { return { recados: [] } }
}

/** Escrita atômica, o padrão do projeto: nunca deixar o arquivo pela metade. */
export function gravar(raiz, dados) {
  const arq = arquivoDe(raiz)
  mkdirSync(dirname(arq), { recursive: true })
  const tmp = `${arq}.tmp`
  writeFileSync(tmp, JSON.stringify(dados, null, 1))
  renameSync(tmp, arq)
}

const curto = (id) => String(id || '').slice(0, 8)

export function enviar(raiz, { de, para, tipo, texto, arquivo = null }) {
  if (!TIPOS[tipo]) throw new Error(`tipo desconhecido: ${tipo}. Use ${Object.keys(TIPOS).join(', ')}`)
  const dados = ler(raiz)
  const recado = {
    /* O sufixo aleatório não é enfeite: dois recados da MESMA sessão no mesmo
       milissegundo geravam o id idêntico, e `marcarEntregue` então marcava os
       dois como entregues de uma vez só (casa por igualdade de id, e os dois
       tinham o mesmo). Achado em 18/08 pelo teste do gate falhando 2 a cada 3
       vezes, sempre na mesma asserção — sinal de corrida, não de lógica
       errada. Mesmo padrão já usado em `opencode.mjs` para o mesmo problema. */
    id: `${curto(de)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    de: curto(de),
    para: para === 'todos' ? 'todos' : curto(para),
    tipo,
    texto: String(texto || '').slice(0, 600),
    arquivo,
    em: Date.now(),
    entregue: [],
  }
  dados.recados = [...(dados.recados || []), recado].slice(-300)
  gravar(raiz, dados)
  return recado
}

/** O que ainda não foi entregue a esta sessão. Recado dela mesma não conta. */
export function pendentes(raiz, eu) {
  const meu = curto(eu)
  return (ler(raiz).recados || []).filter((r) => r.de !== meu
    && (r.para === meu || r.para === 'todos')
    && !(r.entregue || []).includes(meu))
}

export function marcarEntregue(raiz, eu, ids) {
  const meu = curto(eu)
  const dados = ler(raiz)
  for (const r of dados.recados || []) {
    if (ids.includes(r.id)) r.entregue = [...new Set([...(r.entregue || []), meu])]
  }
  gravar(raiz, dados)
}

/** CC-85: o log. Recente primeiro, porque a pergunta é sempre "o que houve
 *  agora?" e não "o que houve no começo". */
export const log = (raiz, n = 30) => [...(ler(raiz).recados || [])].reverse().slice(0, n)

export const textoDoRecado = (r) => {
  const quando = new Date(r.em).toISOString().slice(11, 16)
  return [
    `[${quando}] ${r.de} → ${r.para}: ${TIPOS[r.tipo]?.rotulo || r.tipo}`,
    r.arquivo ? `  arquivo: ${r.arquivo}` : '',
    `  ${r.texto}`,
    `  → ${TIPOS[r.tipo]?.acao || ''}`,
  ].filter(Boolean).join('\n')
}
