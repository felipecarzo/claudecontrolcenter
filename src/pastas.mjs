/**
 * CC-318: a visão de pastas dos projetos.
 *
 * Pedido dele em 22/08: *"podemos criar uma janela pro cockpit ter uma espécie
 * de visão de pastas dos projetos?"*
 *
 * ## Não é um navegador de arquivos
 *
 * Um navegador genérico ele já tem no editor. O que este módulo acrescenta é a
 * leitura que só faz sentido aqui: **a estrutura padrão que ele definiu**, e se
 * o projeto a segue.
 *
 * As regras estão escritas nas instruções dele, e são estas:
 *
 * - `apps/` o que vai para o ar · `tools/` ferramenta interna · `assets/` mídia
 * - `docs/` com `produto/`, `guias/`, `diario/`, `ROADMAP.md`, `HANDOFF.md`
 * - **um `.git` na raiz de cada projeto**, que é o problema número 1 dele: há
 *   um caso real de 34.213 arquivos engolidos por um repositório de cima
 * - **não criar pasta vazia por simetria**: ausência não é defeito
 *
 * A última regra é a que impede este módulo de virar cobrador. Pasta que falta
 * é dita como ausente, nunca como erro: `apps/` só existe quando há algo que
 * vai para o ar.
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * O que não entra na árvore.
 *
 * `node_modules` sozinho tem dezenas de milhares de entradas e não diz nada
 * sobre o projeto. `.git` é o banco de dados do versionamento, não o trabalho.
 */
export const IGNORADAS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage',
  '.cache', '.turbo', 'venv', '.venv', '__pycache__', '.pytest_cache',
  'vendor', 'target', '.gradle', 'Pods', 'DerivedData',
])

/** As pastas ocultas que INTERESSAM, porque são configuração dele. */
const OCULTAS_QUE_VALEM = new Set(['.claude', '.github', '.vscode'])

const PADRAO = [
  { nome: 'apps', o_que: 'o que vai para o ar' },
  { nome: 'tools', o_que: 'ferramenta interna, nunca sobe' },
  { nome: 'assets', o_que: 'mídia crua' },
  { nome: 'docs', o_que: 'o que alguém lê' },
]

const DOCS_ESPERADOS = [
  { nome: 'produto', o_que: 'o que isso é e por quê' },
  { nome: 'guias', o_que: 'como funciona por dentro' },
  { nome: 'diario', o_que: 'o que aconteceu, append-only' },
  { nome: 'ROADMAP.md', o_que: 'o que fazer agora' },
  { nome: 'HANDOFF.md', o_que: 'o estado da última sessão' },
]

const existe = (p) => { try { return fs.existsSync(p) } catch { return false } }

/**
 * A árvore de um projeto, até `fundo` níveis.
 *
 * Medido em 22/08: 2ms no proj_controlcenter e 67ms no inovallbond, com quatro
 * níveis. Barato o suficiente para uma chamada só, sem carregar por pedaço.
 *
 * Pasta ignorada aparece na lista **marcada como pulada**, em vez de sumir:
 * ver `node_modules` ali e saber que ele existe é diferente de achar que o
 * projeto não tem dependência nenhuma.
 */
export function arvore(raiz, { fundo = 3 } = {}) {
  const conta = { pastas: 0, arquivos: 0, puladas: 0 }

  const anda = (dir, nivel) => {
    if (nivel > fundo) return null
    let itens = []
    try { itens = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }

    const saida = []
    for (const it of itens) {
      /* Arquivo oculto APARECE. Escondê-lo faria a árvore afirmar que o projeto
         não tem `.env`, `.gitignore` ou `.nvmrc`, e a ausência de uma coisa é
         uma afirmação diferente de não mostrá-la.
         Pasta oculta continua fora, com as exceções conhecidas: `.git` sozinho
         tem milhares de entradas e nada ali é trabalho dele. */
      if (it.name.startsWith('.') && it.isDirectory() && !OCULTAS_QUE_VALEM.has(it.name)) continue
      if (it.isDirectory()) {
        if (IGNORADAS.has(it.name)) {
          conta.puladas += 1
          saida.push({ nome: it.name, tipo: 'pulada' })
          continue
        }
        conta.pastas += 1
        const filhos = anda(path.join(dir, it.name), nivel + 1)
        saida.push({
          nome: it.name,
          tipo: 'pasta',
          /* `null` quer dizer "não desci até aqui", e é diferente de `[]`, que
             é "desci e está vazia". A tela precisa da distinção para não
             afirmar que uma pasta é vazia quando só não foi lida. */
          filhos,
          fundoDemais: filhos === null,
        })
      } else {
        conta.arquivos += 1
        let tamanho = null
        try { tamanho = fs.statSync(path.join(dir, it.name)).size } catch { /* sumiu no meio */ }
        /* `protegido` viaja até a tela para o arquivo aparecer marcado, sem
           botão de abrir. Ele vê que o `.env` existe, e vê que o painel não
           mostra o conteúdo: as duas informações, em vez de nenhuma. */
        saida.push({ nome: it.name, tipo: 'arquivo', tamanho, protegido: ehSegredo(it.name) })
      }
    }
    /* Pasta antes de arquivo, e cada grupo em ordem: é como ele lê no editor,
       e ordem alfabética pura misturaria os dois. */
    return saida.sort((a, b) => {
      const peso = (x) => (x.tipo === 'arquivo' ? 1 : 0)
      return (peso(a) - peso(b)) || a.nome.localeCompare(b.nome)
    })
  }

  return { itens: anda(raiz, 0) || [], ...conta }
}

/**
 * O projeto segue a estrutura que ele definiu?
 *
 * **Ausência não é defeito**, e a regra é dele: *"não criar pasta vazia por
 * simetria"*. Por isso cada linha diz o que a pasta seria, e não que ela
 * deveria estar lá.
 *
 * A única coisa cobrada é o `.git` na raiz, porque a ausência dele tem
 * consequência real: a pasta cai no repositório de cima, e existe um caso de
 * 34.213 arquivos engolidos assim.
 */
export function conferirPadrao(raiz) {
  const tem = (n) => existe(path.join(raiz, n))
  const pastas = PADRAO.map((p) => ({ ...p, existe: tem(p.nome) }))
  const docs = existe(path.join(raiz, 'docs'))
    ? DOCS_ESPERADOS.map((d) => ({ ...d, existe: existe(path.join(raiz, 'docs', d.nome)) }))
    : []

  const temGit = tem('.git')
  return {
    pastas,
    docs,
    temGit,
    temClaudeMd: tem('CLAUDE.md'),
    /* O único aviso de verdade. Escrito como consequência, não como regra
       quebrada: ele decide o que fazer sabendo o que acontece. */
    avisoGit: temGit ? null
      : 'sem `.git` próprio, esta pasta entra no repositório de cima, e tudo o que estiver lá dentro vai junto',
  }
}

/** A árvore e a conferência, numa leitura só. */
export function retrato(raiz, opcoes = {}) {
  return { raiz, ...arvore(raiz, opcoes), padrao: conferirPadrao(raiz) }
}

/* ── CC-319: ler um arquivo, e o que NUNCA pode ser lido ─────────────────────
 *
 * Pedido dele: *"não consigo abrir os arquivos nas pastas"*.
 *
 * Servir conteúdo de arquivo é a coisa mais perigosa que este painel faz, e por
 * isso a recusa vem antes da leitura. São três travas independentes, e cada uma
 * sozinha já seria motivo para não abrir.
 */

/**
 * Arquivo que guarda segredo. **A regra é dele, escrita: "nunca imprima o
 * conteúdo deles".**
 *
 * Existem `.env` de verdade nos projetos desta máquina, com senha de banco
 * dentro. Um painel que abre arquivo e não conhece esta lista publica a senha
 * na tela do celular dele, num navegador que pode estar em qualquer lugar.
 *
 * `.example` e `.sample` passam de propósito: existem para ser lidos, e é neles
 * que está a documentação de quais variáveis o projeto usa.
 */
export function ehSegredo(nome) {
  const n = String(nome || '').toLowerCase()
  if (/\.(example|sample|template|dist)$/.test(n)) return false
  if (/^\.?env(\.|$)/.test(n) || n.endsWith('.env')) return true
  if (/\.(pem|key|p12|pfx|jks|keystore|ppk)$/.test(n)) return true
  if (/^id_(rsa|dsa|ecdsa|ed25519)/.test(n)) return true
  if (/^\.(npmrc|netrc|pgpass|htpasswd|git-credentials)$/.test(n)) return true
  if (/(^|[._-])(secret|senha|password|credential)s?([._-]|$)/.test(n)) return true
  return false
}

const TETO = 512 * 1024

/**
 * O conteúdo de um arquivo, se ele puder ser lido.
 *
 * A ordem das recusas importa: primeiro a pasta, depois o nome, depois o
 * tamanho, depois o conteúdo. Cada uma responde POR QUE recusou, porque
 * "não deu" é o mesmo que mentir sobre o motivo.
 */
export function ler(raizProjeto, relativo) {
  const raiz = path.resolve(raizProjeto)
  const alvo = path.resolve(raiz, String(relativo || '').replace(/^[/\\]+/, ''))

  /* Trava 1, a que importa: o caminho resolvido tem que ficar DENTRO do
     projeto. Sem ela, `../../.ssh/id_rsa` sai da pasta e o painel entrega a
     chave privada dele. `path.resolve` já normaliza o `..`, então comparar o
     resultado é o que fecha o buraco, nunca procurar `..` no texto. */
  if (alvo !== raiz && !alvo.startsWith(raiz + path.sep)) {
    return { ok: false, motivo: 'fora', texto: 'esse caminho sai da pasta do projeto' }
  }

  const nome = path.basename(alvo)
  if (ehSegredo(nome)) {
    return {
      ok: false,
      motivo: 'segredo',
      texto: 'este arquivo guarda senha ou chave, e o painel não mostra o conteúdo dele. Abra no editor da máquina.',
    }
  }

  let st
  try { st = fs.statSync(alvo) } catch { return { ok: false, motivo: 'sumiu', texto: 'esse arquivo não existe mais' } }
  if (st.isDirectory()) return { ok: false, motivo: 'pasta', texto: 'isso é uma pasta' }
  if (st.size > TETO) {
    return {
      ok: false, motivo: 'grande', tamanho: st.size,
      texto: `este arquivo tem ${Math.round(st.size / 1024)} kB, e o painel abre até ${TETO / 1024} kB`,
    }
  }

  let buf
  try { buf = fs.readFileSync(alvo) } catch (e) { return { ok: false, motivo: 'erro', texto: String(e.message || e) } }

  /* Binário detectado por byte zero nos primeiros 8 kB: é o teste que o `git`
     usa, e é barato. Sem ele, uma imagem viraria uma tela de lixo que parece
     defeito do painel. */
  const amostra = buf.subarray(0, 8192)
  if (amostra.includes(0)) {
    return { ok: false, motivo: 'binario', tamanho: st.size, texto: 'este arquivo não é texto' }
  }

  return {
    ok: true,
    texto: buf.toString('utf8'),
    tamanho: st.size,
    linhas: buf.toString('utf8').split('\n').length,
    mexidoEm: st.mtime.toISOString(),
  }
}
