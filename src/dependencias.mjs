/**
 * CC-86 — "o que quebra se eu mexer aqui?", respondido pelo código de agora.
 *
 * ## De onde veio
 *
 * Da discussão sobre UML e MER. Ele apontou, com razão, que um glossário com
 * relações não cobre **dependência de código**: *"essa dependência é proveniente
 * de relações de classe, funções e parâmetros, e isso existe no diagrama de
 * classes"*.
 *
 * **Concordo com o valor e discordo do meio.** Diagrama mantido à mão diverge do
 * código em dias, e aí fica pior que não existir — passa a responder errado com
 * cara de certo, que é o mesmo defeito do hash de privacidade que ficou três
 * dias mentindo. O dado é extraível, e extraído nunca envelhece.
 *
 * É o princípio que ele mesmo firmou no CC-83: **derivado, nunca digitado.**
 *
 * ## Por que ler só o topo do arquivo
 *
 * `import` mora nas primeiras linhas. Ler o arquivo inteiro para pegar as
 * primeiras 20 é desperdício, e aqui isso importa porque a varredura roda sob
 * demanda: medido neste projeto, **52 arquivos e 90 ligações em 127 ms**, lendo
 * 191 KB em vez de vários megabytes. Mesmo princípio do `transcript.mjs`, que lê
 * só a cauda porque o arquivo passa de 25 MB.
 *
 * ## O que ele NÃO pega, e é honesto dizer
 *
 * Herança e hierarquia de classes. Import diz que o arquivo A usa o B, não que a
 * classe X estende a Y. Nos projetos JavaScript do Felipe quase não há classes,
 * mas num projeto orientado a objetos de verdade o diagrama tem valor que isto
 * não tem.
 */
import fs from 'node:fs'
import path from 'node:path'

/** 8 KB: cobre o cabeçalho de comentário longo (este arquivo tem 30 linhas de
 *  comentário antes do primeiro import) sem virar leitura completa. */
const CABECA = 8 * 1024

const EXTENSOES = ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.cjs']
const PULAR = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vercel'])

/** No Windows, `path.relative` devolve `\`. O quadro de rotas e o resto do
 *  projeto falam em `/` — sem isso o grafo combina consigo mesmo mas nunca
 *  com o que um humano ou outro módulo escreveu. */
const rel = (de, para) => path.relative(de, para).replace(/\\/g, '/')

/**
 * Todas as formas de um arquivo usar outro, e só as relativas.
 *
 * Import de pacote (`node:fs`, `react`) fica de fora: a pergunta é sobre o
 * código do projeto, e ninguém "mexe" no react sem querer.
 *
 * O `import './x'` sem `from` — efeito colateral, usado para CSS e polyfill —
 * estava faltando na primeira versão, e o teste do ciclo pegou: `ciclo-a`
 * importava `ciclo-b` assim, e o mapa dizia que ninguém usava ninguém.
 */
const RE_IMPORT = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g

function arquivosDe(raiz, dir = raiz, achados = []) {
  let entradas = []
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }) } catch { return achados }
  for (const e of entradas) {
    if (e.name.startsWith('.') && e.name !== '.') continue
    const cheio = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!PULAR.has(e.name)) arquivosDe(raiz, cheio, achados)
    } else if (EXTENSOES.includes(path.extname(e.name))) {
      achados.push(cheio)
    }
  }
  return achados
}

/** Resolve `./x` para o arquivo que existe: com extensão, sem, ou `index`. */
function resolver(deQual, alvo) {
  const base = path.resolve(path.dirname(deQual), alvo)
  const tentativas = [base, ...EXTENSOES.map((e) => base + e), ...EXTENSOES.map((e) => path.join(base, `index${e}`))]
  return tentativas.find((t) => { try { return fs.statSync(t).isFile() } catch { return false } }) || null
}

/**
 * O grafo: quem usa quem, e quem é usado por quem.
 *
 * As duas direções saem da mesma varredura porque a pergunta interessante é a
 * de trás ("quem depende de mim"), e ela é cara de calcular sob demanda.
 */
export function mapear(raiz) {
  const inicio = Date.now()
  const usa = new Map()
  const usadoPor = new Map()
  let ligacoes = 0
  let lidos = 0

  for (const arq of arquivosDe(raiz)) {
    let cabeca = ''
    try {
      const fd = fs.openSync(arq, 'r')
      const buf = Buffer.alloc(CABECA)
      const n = fs.readSync(fd, buf, 0, CABECA, 0)
      fs.closeSync(fd)
      lidos += n
      cabeca = buf.toString('utf8', 0, n)
    } catch { continue }

    const r = rel(raiz, arq)
    if (!usa.has(r)) usa.set(r, new Set())

    for (const m of cabeca.matchAll(RE_IMPORT)) {
      const destino = resolver(arq, m[1])
      if (!destino) continue // import quebrado ou pacote: não é problema nosso
      const alvo = rel(raiz, destino)
      usa.get(r).add(alvo)
      if (!usadoPor.has(alvo)) usadoPor.set(alvo, new Set())
      usadoPor.get(alvo).add(r)
      ligacoes++
    }
  }

  return { raiz, usa, usadoPor, arquivos: usa.size, ligacoes, kb: Math.round(lidos / 1024), ms: Date.now() - inicio }
}

/**
 * Quem quebra se este arquivo mudar — direto e por tabela.
 *
 * O transitivo é o que responde a pergunta de verdade: se A usa B e B usa C,
 * mexer em C afeta A, e ninguém percebe olhando só um nível. A busca é em
 * largura com conjunto de visitados, porque **ciclo de import existe** e sem
 * isso o laço não termina.
 */
export function impactoDe(grafo, arquivo, { profundidade = 4 } = {}) {
  const alvo = rel(grafo.raiz, path.resolve(grafo.raiz, arquivo))
  const diretos = [...(grafo.usadoPor.get(alvo) || [])].sort()

  const vistos = new Set([alvo])
  let camada = diretos
  const todos = []
  for (let d = 0; d < profundidade && camada.length; d++) {
    const proxima = []
    for (const a of camada) {
      if (vistos.has(a)) continue
      vistos.add(a)
      todos.push(a)
      proxima.push(...(grafo.usadoPor.get(a) || []))
    }
    camada = proxima
  }

  return { arquivo: alvo, diretos, todos: todos.sort(), existe: grafo.usa.has(alvo) }
}

/** Os arquivos mais perigosos de tocar: os que mais gente usa.
 *
 *  Este número não estava escrito em lugar nenhum, e é a primeira coisa útil que
 *  a varredura entregou: `platform.mjs` tem 15 dependentes neste projeto. */
export const maisUsados = (grafo, n = 5) => [...grafo.usadoPor]
  .map(([arq, quem]) => ({ arquivo: arq, dependentes: quem.size }))
  .sort((a, b) => b.dependentes - a.dependentes)
  .slice(0, n)

/** Uma frase para o recado do CC-84. É o que muda "vou mexer no seu arquivo"
 *  para algo que o outro agente consegue julgar sem abrir nada. */
export function aviso(grafo, arquivo) {
  const i = impactoDe(grafo, arquivo)
  if (!i.existe) return `${i.arquivo} (arquivo novo ou fora do projeto)`
  if (!i.diretos.length) return `${i.arquivo} — ninguém mais usa este arquivo`
  const extra = i.todos.length > i.diretos.length ? `, ${i.todos.length} contando os indiretos` : ''
  return `${i.arquivo} — ${i.diretos.length} arquivo(s) usam ele${extra}: ${i.diretos.slice(0, 6).join(', ')}${
    i.diretos.length > 6 ? '…' : ''}`
}
