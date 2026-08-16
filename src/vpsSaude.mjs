/**
 * A VPS está saudável? — a pergunta que a aba responde.
 *
 * ## Por que isto existe
 *
 * A aba VPS mostrava o que a máquina TEM: três colunas chamadas `nginx`,
 * `docker` e `pm2`, com cartões crus. Palavras do Felipe em 15/08: *"tem uma
 * tela chamada VPS que tem um monte de processo jogado, e eu tenho que ter
 * muito conhecimento técnico pra olhar aquilo ali e entender o que significa"*.
 *
 * Ninguém abre aquela tela perguntando "quais processos existem". A pergunta é
 * "está tudo no ar?" e "alguma coisa vai quebrar?". Este módulo responde essas
 * duas, e a tela passa a mostrar a resposta antes do dado.
 *
 * ## Veredito, não valor
 *
 * `47 processos` não é veredito. `tudo no ar` é. A regra que ficou: todo estado
 * tem cor e frase do que fazer — e a frase é escrita para quem não sabe o que é
 * um container.
 *
 * ## Puro de propósito
 *
 * Recebe o retrato e devolve texto. Sem disco, sem SSH, sem relógio próprio:
 * é o que deixa o `npm test` provar cada limiar sem precisar de uma VPS.
 */

/** Onde cada medida deixa de ser conforto e vira aviso.
 *
 *  Os números não são chute: disco cheio é o que derruba banco e nginx antes de
 *  qualquer outra coisa, e por isso avisa mais cedo (85%) que a memória (90%),
 *  que o Linux enche de cache de propósito e volta a liberar sozinho. */
export const LIMITES = {
  discoAviso: 85,
  discoGrave: 95,
  ramAviso: 90,
  ramGrave: 97,
  /** Reinícios que denunciam programa caindo em laço, e não um deploy. */
  reiniciosAviso: 5,
  /** A partir daqui o retrato é velho demais para valer como "agora". */
  leituraVelhaMs: 60 * 60 * 1000,
}

const pct = (usado, total) => (total > 0 ? Math.round((100 * usado) / total) : null)

/** Container ou processo parado. O texto de status varia por ferramenta, então
 *  o teste é pelo que significa "de pé", nunca por igualdade exata. */
const dePe = (texto) => /^(up|online|running)\b/i.test(String(texto || '').trim())

/**
 * Os problemas, do mais grave para o menos, já escritos para ele ler.
 *
 * Cada um traz `oQueFazer`: alerta sem saída é o mesmo que ruído, e foi
 * justamente a queixa que originou este módulo.
 */
export function alertas(s, agora = Date.now()) {
  const fora = []
  if (!s) return fora

  const disco = pct(s.disco?.usadoGB, s.disco?.totalGB)
  if (disco != null && disco >= LIMITES.discoAviso) {
    fora.push({
      nivel: disco >= LIMITES.discoGrave ? 'grave' : 'aviso',
      texto: `O disco está ${disco}% cheio (${s.disco.usadoGB} de ${s.disco.totalGB} GB).`,
      oQueFazer: 'Disco cheio derruba site e banco de dados. Vale apagar log antigo e imagem de Docker que ninguém usa.',
    })
  }

  const ram = pct(s.ram?.usadoMB, s.ram?.totalMB)
  if (ram != null && ram >= LIMITES.ramAviso) {
    fora.push({
      nivel: ram >= LIMITES.ramGrave ? 'grave' : 'aviso',
      texto: `A memória está em ${ram}% (${s.ram.usadoMB} de ${s.ram.totalMB} MB).`,
      oQueFazer: 'Sem memória, o sistema começa a matar programas sozinho, e escolhe o maior — costuma ser o banco.',
    })
  }

  const paradosDocker = (s.docker || []).filter((c) => !dePe(c.status))
  if (paradosDocker.length) {
    fora.push({
      nivel: 'grave',
      texto: `${paradosDocker.length} programa(s) em caixa parado(s): ${paradosDocker.map((c) => c.nome).join(', ')}.`,
      oQueFazer: 'Se algum deles servia um site, esse site está fora do ar agora.',
    })
  }

  const paradosPm2 = (s.pm2 || []).filter((p) => !dePe(p.status))
  if (paradosPm2.length) {
    fora.push({
      nivel: 'grave',
      texto: `${paradosPm2.length} programa(s) solto(s) parado(s): ${paradosPm2.map((p) => p.nome).join(', ')}.`,
      oQueFazer: 'Mesmo caso: quem dependia dele não responde.',
    })
  }

  /* Reinício em excesso é o aviso mais valioso desta tela, porque o programa
     aparece como "no ar" enquanto morre e volta em laço. */
  const reiniciando = (s.pm2 || []).filter((p) => (p.restarts || 0) >= LIMITES.reiniciosAviso)
  if (reiniciando.length) {
    fora.push({
      nivel: 'aviso',
      texto: `${reiniciando.length} programa(s) reiniciando sozinho(s): ${
        reiniciando.map((p) => `${p.nome} (${p.restarts}x)`).join(', ')}.`,
      oQueFazer: 'Aparece como "no ar", mas está caindo e voltando. O log dele diz por quê.',
    })
  }

  if (s.em && agora - s.em > LIMITES.leituraVelhaMs) {
    fora.push({
      nivel: 'aviso',
      texto: 'Esta leitura é antiga.',
      oQueFazer: 'Clique em atualizar: o que está na tela pode não valer mais.',
    })
  }

  const ordem = { grave: 0, aviso: 1 }
  return fora.sort((a, b) => ordem[a.nivel] - ordem[b.nivel])
}

/**
 * A resposta à pergunta do topo, em uma frase.
 *
 * Três estados e nada mais: quatro seriam uma escala, e escala pede
 * interpretação — que é exatamente o trabalho que esta tela devia tirar dele.
 */
export function veredito(s, agora = Date.now()) {
  if (!s) return { cor: 'neutro', frase: 'Ainda não li a VPS.', alertas: [] }

  const lista = alertas(s, agora)
  const graves = lista.filter((a) => a.nivel === 'grave').length

  const noAr = (s.docker || []).filter((c) => dePe(c.status)).length
    + (s.pm2 || []).filter((p) => dePe(p.status)).length
  const sites = (s.nginx || []).length

  if (graves) {
    return {
      cor: 'ruim',
      frase: graves === 1 ? 'Uma coisa está fora do ar.' : `${graves} coisas estão fora do ar.`,
      alertas: lista,
    }
  }
  if (lista.length) {
    return {
      cor: 'atencao',
      frase: 'Está tudo no ar, mas há o que olhar.',
      alertas: lista,
    }
  }
  return {
    cor: 'bom',
    frase: `Tudo no ar: ${sites} endereço(s) atendendo e ${noAr} programa(s) rodando.`,
    alertas: [],
  }
}

/**
 * Os títulos das seções, traduzidos.
 *
 * `nginx`, `docker` e `pm2` são nomes de ferramenta, e nome de ferramenta só
 * diz alguma coisa para quem já sabe o que ela faz. O nome técnico continua na
 * tela, entre parênteses: quem sabe reconhece, quem não sabe não precisa.
 */
export const SECOES = {
  nginx: {
    titulo: 'Endereços que respondem na internet',
    tecnico: 'nginx',
    ajuda: 'Quando alguém digita um endereço do Felipe no navegador, é este programa que atende e decide para qual site mandar.',
    vazio: 'Nenhum endereço configurado.',
  },
  docker: {
    titulo: 'Programas em caixa',
    tecnico: 'Docker',
    ajuda: 'Cada um roda isolado dos outros, com tudo de que precisa dentro. Se um quebra, não leva os vizinhos junto.',
    vazio: 'Nenhum programa em caixa.',
  },
  pm2: {
    titulo: 'Programas soltos',
    tecnico: 'PM2',
    ajuda: 'Rodam direto na máquina, sem caixa. Este vigia mantém cada um de pé e o levanta de novo quando cai.',
    vazio: 'Nenhum programa solto.',
  },
}
