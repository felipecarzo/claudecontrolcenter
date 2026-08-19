/**
 * CC-155 — as avenidas: quem está trabalhando onde, e onde dois vão se esbarrar.
 *
 * Ideia dele em 18/08, vendo o aviso de vizinhança funcionar pela primeira vez:
 * *"a gente consegue colocar visualmente, como se fosse um mapa com várias
 * linhas, com cores diferentes, quando se cruza mostra qual a gente está em
 * qual bifurcação se colidindo com outro agente, enfim, um visual bem fácil de
 * visualizar o que está acontecendo"*.
 *
 * ## Por que isto é um módulo, e não desenho direto na tela
 *
 * A regra do projeto: motor puro, tela burra. O que decide se duas rotas se
 * cruzam é uma conta sobre grafo, e conta que mora no HTML não tem teste. A
 * mesma razão pela qual a frase do framework mora no motor.
 *
 * ## As duas formas de duas rotas se esbarrarem, e elas são diferentes
 *
 * 1. **Colisão direta**: as duas reivindicaram o MESMO arquivo. É conflito
 *    certo, e o Routia deveria ter impedido.
 * 2. **Vizinhança**: os arquivos são diferentes, mas um importa o outro. Mexer
 *    num quebra o outro, e ninguém é avisado por nenhuma trava, porque cada um
 *    está no seu arquivo. É o caso que o CC-140 já detecta no momento da
 *    edição; aqui ele vira desenho, para ser visto ANTES de começar.
 *
 * A segunda é a que justifica a tela. A primeira o quadro já mostra em texto.
 *
 * ## Sobre profundidade
 *
 * A vizinhança é olhada a UM nível de import, não em profundidade. O grafo é
 * aproximado (lê só o topo do arquivo, e não resolve import dinâmico), e a
 * cada nível a chance de a ligação ser irrelevante cresce. Duas rotas ligadas
 * por uma corrente de cinco imports não estão "se cruzando" em nenhum sentido
 * que ajude quem olha.
 */

/** Rota que não tem dono não é avenida: é rua que ninguém está usando. */
const ocupada = (r) => Boolean(r?.quem) && (r.arquivos || []).length > 0

/* Uma forma só de escrever caminho, decidida na ENTRADA e não em cada
   comparação. O quadro de rotas é escrito à mão e recebe os dois estilos
   (`src\a.mjs` no Windows, `src/a.mjs` em todo o resto), enquanto o grafo
   sempre fala em `/`. Normalizar só dentro da comparação de import deixava a
   colisão direta e as chaves do mapa comparando texto cru, e um cruzamento
   real sumia por causa da barra. O teste pegou. */
const norm = (s) => String(s).replace(/\\/g, '/')

/**
 * O mapa: as avenidas ocupadas e os cruzamentos entre elas.
 *
 * `grafo` é o de `dependencias.mjs` e é OPCIONAL: sem ele, as colisões diretas
 * continuam aparecendo e a vizinhança some. Melhor um mapa a menos que uma
 * tela que não abre porque a varredura falhou.
 */
export function mapear(rotas = [], grafo = null) {
  /* Uma rota pode aparecer mais de uma vez no quadro (o arquivo é histórico,
     e linhas velhas ficam lá com o mesmo nome). Fica a que tem arquivo
     declarado, porque é a que representa trabalho de verdade. */
  const porNome = new Map()
  for (const r of rotas) {
    if (!ocupada(r)) continue
    const atual = porNome.get(r.rota)
    if (!atual || (r.arquivos || []).length > (atual.arquivos || []).length) porNome.set(r.rota, r)
  }

  const avenidas = [...porNome.values()].map((r) => ({
    rota: r.rota,
    quem: r.quem || null,
    veredito: r.veredito || null,
    /* `ativa` é diferente de `ocupada`: o quadro pode dizer que alguém tem a
       rota enquanto a sessão morreu faz tempo. A tela precisa saber a
       diferença, senão desenha trânsito onde não há ninguém. */
    viva: r.veredito === 'ativa',
    arquivos: [...new Set((r.arquivos || []).map(norm))].sort(),
  })).sort((a, b) => a.rota.localeCompare(b.rota))

  const cruzamentos = []
  for (let i = 0; i < avenidas.length; i++) {
    for (let j = i + 1; j < avenidas.length; j++) {
      const a = avenidas[i]
      const b = avenidas[j]

      const mesmos = a.arquivos.filter((f) => b.arquivos.includes(f))
      if (mesmos.length) {
        cruzamentos.push({ tipo: 'colisao', de: a.rota, para: b.rota, arquivos: mesmos })
        continue // colisão direta já é o pior caso: não precisa também dizer que são vizinhas
      }

      if (!grafo) continue
      const ligacoes = []
      for (const arqA of a.arquivos) {
        for (const arqB of b.arquivos) {
          if (usa(grafo, arqA, arqB)) ligacoes.push({ de: arqA, para: arqB })
          else if (usa(grafo, arqB, arqA)) ligacoes.push({ de: arqB, para: arqA })
        }
      }
      if (ligacoes.length) {
        cruzamentos.push({ tipo: 'vizinhanca', de: a.rota, para: b.rota, ligacoes })
      }
    }
  }

  return { avenidas, cruzamentos, at: Date.now() }
}

/** Um arquivo importa o outro? Olha um nível só, pelo motivo no cabeçalho.
 *  Os dois lados já chegam normalizados; o grafo é que pode ter barra do
 *  Windows nas chaves, dependendo de quem o montou. */
function usa(grafo, de, para) {
  const quaisUsa = grafo.usa?.get(de) || grafo.usa?.get(de.replace(/\//g, '\\'))
  if (!quaisUsa) return false
  for (const x of quaisUsa) if (norm(x) === para) return true
  return false
}

/**
 * Uma frase para quem não vai olhar o desenho.
 *
 * Existe porque a tela precisa dizer algo no topo antes do mapa, e porque o
 * mapa não cabe inteiro num celular: quem abre no telefone lê a frase e decide
 * se vale girar a tela.
 */
export function resumo({ avenidas = [], cruzamentos = [] } = {}) {
  if (!avenidas.length) return { frase: 'Nenhuma rota com arquivo reivindicado agora.', cor: 'bom' }

  const colisoes = cruzamentos.filter((c) => c.tipo === 'colisao')
  const vizinhas = cruzamentos.filter((c) => c.tipo === 'vizinhanca')
  const vivas = avenidas.filter((a) => a.viva).length

  if (colisoes.length) {
    return {
      frase: `${colisoes.length} rota(s) reivindicando o MESMO arquivo. Isso é conflito, não vizinhança.`,
      cor: 'ruim',
    }
  }
  if (vizinhas.length) {
    return {
      frase: `${avenidas.length} avenida(s), ${vivas} com sessão viva. `
        + `${vizinhas.length} par(es) se tocam por import: mexer de um lado pode quebrar o outro.`,
      cor: 'atencao',
    }
  }
  return {
    frase: `${avenidas.length} avenida(s), ${vivas} com sessão viva, nenhuma se cruzando.`,
    cor: 'bom',
  }
}
