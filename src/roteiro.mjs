/**
 * CC-1081: o "roteiro de uso", o núcleo.
 *
 * Pedido dele em 02/11/2026: um programa que a IA opera, que ele também pode
 * operar, e que não depende de uma IA específica ("no estilo hook de entrevista").
 * Mesmo molde de `entrevista.mjs`: roteiro de perguntas, estado em disco, UMA
 * pergunta por vez, e cada resposta grava QUEM respondeu.
 *
 * O princípio, em uma linha: **o que dá para medir, o código mede; o que é
 * palpite de IA vira hipótese com autor e voto.**
 *
 * Este arquivo é PURO: sem rede e sem navegador. Só lê e grava o estado em
 * `<projeto>/docs/roteiro/`. O navegador mora em `roteiroNavegador.mjs`, o mapa
 * em `roteiroMapa.mjs` e o agente em `roteiroAgente.mjs`.
 *
 * ## Quem escreveu cada coisa (o campo `de`)
 *
 * - `ele`       o que ele digitou ou decidiu;
 * - `programa`  o que o código mediu (mapa, sessões);
 * - `ia:<modelo>`  palpite de IA. Vale como HIPÓTESE até ele confirmar, e o
 *   `pronto` de uma fase não aceita palpite: a regra é a mesma do `prosa` da
 *   entrevista, e o motivo também (resumo citando como fala dele o que a IA deduziu).
 *
 * ## O que as fases 3 a 5 recebem do programa
 *
 * Mapa e sessões ficam em arquivos próprios, e entram no `pronto` só como
 * AVISO (campo `avisos`), nunca como bloqueio: o rastreador evita botões como
 * "fechar" e "menu" de propósito, então "tela sem volta" pode ser falso alarme.
 * Medida informa, pessoa decide.
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, delimiter } from 'node:path'

/* ===================================================================== */
/* 1. Utilidades pequenas                                                 */
/* ===================================================================== */

const txt = (r) => String(r?.texto ?? '').trim()
const val = (r) => String(r?.valor ?? '').trim()

/** Sem acento, sem caixa, espaço único: para comparar rótulo e opção. */
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()

const arredonda = (n) => Math.round(n * 100) / 100

/** Os números de um texto, na ordem ("62% e 85,5" vira [62, 85.5]). Dígito colado em letra ("T1") é nome, não nota. */
const numeros = (t) => (String(t || '').match(/(?<![\p{L}\d])\d+(?:[.,]\d+)?/gu) || []).map((x) => Number(x.replace(',', '.')))

/** Citar a resposta dentro de outra pergunta só quando ela cabe numa palavra ou duas. */
const citar = (t, padrao) => {
  const s = String(t || '').trim()
  return s && s.length <= 40 && !/[.!?;\n]/.test(s) ? s : padrao
}

const DE_VALIDO = /^(ele|programa|ia:\S.*)$/

/** Como o comando aparece nas mensagens. Na VPS `cc` é o compilador C e o painel atende por `cockpit`: se houver um
 *  `cockpit` no caminho de busca, é ele; senão `cc`. `CC_ROTEIRO_CMD` troca à mão. */
const temCockpit = () => String(process.env.PATH || '').split(delimiter).some((d) => d && ['cockpit', 'cockpit.cmd', 'cockpit.exe'].some((n) => existsSync(join(d, n))))
export const CMD = process.env.CC_ROTEIRO_CMD || (temCockpit() ? 'cockpit roteiro' : 'cc roteiro')

/** Palpite: resposta ou tarefa de IA que ele ainda não confirmou. */
export const ehPalpite = (x) => /^ia:/.test(x?.de || '') && !x?.confirmadoEm

/** Vale para o `pronto`: existe e não é palpite. */
export const vale = (x) => Boolean(x) && !ehPalpite(x)

/* ===================================================================== */
/* 2. As nove fases                                                       */
/* ===================================================================== */

const SN = [
  { valor: 'sim', label: 'Sim', descricao: '' },
  { valor: 'nao', label: 'Não', descricao: '' },
]

/** Meta inicial de acerto e piso do SUS, ambos "sugestão para calibrar no projeto". */
export const META_ACERTO = 80
export const PISO_SUS = 68

/** Palavras de visual: só entram a partir da Fase 6 (regra que atravessa todas as fases). */
const ESTETICA = /\b(cor(?:es)?|fontes?|espa[cç]amentos?|est[eé]tic[ao]s?|tipografia|paleta|gradientes?)\b/i

/** Resposta de outra pergunta da MESMA tarefa. */
const irma = (r, base, t) => r[`${base}@${t.id}`]

const NAO_NA_TAREFA = (r, t) => ['f5-tentar', 'f5-notar', 'f5-ligar', 'f5-progresso'].some((b) => val(irma(r, b, t)) === 'nao')

const tarefasValidas = (estado) => (estado?.tarefas || []).filter(vale)

/** Cada fase: `perguntas` no molde da entrevista, e `extra` com o que só o código sabe medir. */
const DEFINICAO = [
  {
    id: 0,
    titulo: 'Enquadrar',
    perguntas: [
      {
        id: 'f0-quem', header: 'Quem usa',
        pergunta: 'Quem usa isto, em que aparelho e em que situação?',
        ajuda: 'Exemplo: no celular, na rua, com pressa. Sem esse contexto o resto vira chute.',
      },
      {
        id: 'f0-base', header: 'Base', fechada: true,
        pergunta: 'O que você acabou de descrever vem de gente de verdade (conversa, pedido, medição) ou é suposição?',
        ajuda: 'A IA não inventa personagem sem dado. Se for suposição, o programa pede quem pode confirmar.',
        opcoes: [
          { valor: 'dado', label: 'Vem de gente de verdade', descricao: 'Conversa, pedido ou medição.' },
          { valor: 'suposicao', label: 'É suposição', descricao: 'Ainda não falei com ninguém.' },
        ],
      },
      {
        id: 'f0-confirmar', header: 'Quem confirma',
        quando: (r) => val(r['f0-base']) === 'suposicao',
        pergunta: 'Quem, de verdade, poderia confirmar essa descrição? (nome ou função)',
        ajuda: 'Só existe porque você disse que é suposição. A personagem fica marcada como hipótese até alguém confirmar.',
      },
      {
        id: 'f0-progresso', header: 'Progresso',
        pergunta: (r) => `Quando ${citar(txt(r['f0-quem']), 'essa pessoa')} abre isto, que progresso ela quer fazer?`,
        ajuda: 'É o "trabalho a ser feito" (JTBD): o que ela quer ter feito ao fechar, não o que ela quer ver.',
      },
      {
        id: 'f0-negocio', header: 'Negócio',
        pergunta: 'Qual o objetivo do negócio com isto?',
        ajuda: 'Uma frase. Se não houver objetivo de negócio, escreva isso.',
      },
      {
        id: 'f0-metrica', header: 'Métrica',
        pergunta: 'Como vamos saber que funcionou? Escreva uma métrica com número.',
        ajuda: 'Exemplo: "8 de 10 pessoas concluem a tarefa principal em menos de 2 minutos".',
      },
      {
        id: 'f0-frase', header: 'Frase',
        pergunta: 'Escreva uma frase por personagem no formato: quando ___, quero ___, para ___.',
        ajuda: 'É o critério de pronto da fase: se não dá para escrever essa frase, falta enquadrar.',
      },
    ],
    extra(estado) {
      const falta = []
      const avisos = []
      const r = respostasDe(estado)
      if (vale(r['f0-frase']) && !/quando[\s\S]+quero[\s\S]+para/i.test(txt(r['f0-frase']))) {
        falta.push('Frase: precisa ter "quando", "quero" e "para" nessa ordem')
      }
      if (vale(r['f0-metrica']) && !/\d/.test(txt(r['f0-metrica']))) {
        falta.push('Métrica: sem número, não dá para saber se funcionou')
      }
      if (val(r['f0-base']) === 'suposicao') avisos.push('as personagens ainda são suposição, sem dado de gente de verdade')
      return { falta, avisos }
    },
  },
  {
    id: 1,
    titulo: 'Tarefas principais',
    perguntas: [
      {
        id: 'f1-lista', header: 'Tarefas',
        pergunta: 'Quais são as poucas tarefas, menos de 10 (de preferência menos de 5), sem as quais este produto falhou?',
        ajuda: `Cada uma com verbo, objeto e resultado que dá para ver. Exemplo: "pagar a fatura e ver o comprovante". Depois cadastre uma por uma: ${CMD} tarefa "<objetivo>" --sucesso "<texto que aparece na tela>".`,
      },
      {
        id: 'f1-ordem', header: 'Ordem',
        pergunta: (r, t, estado) => {
          const lista = (estado?.tarefas || []).map((x) => `${x.id} ${x.objetivo}`)
          return `Em que ordem essas tarefas acontecem na vida da pessoa, da esquerda para a direita?${lista.length ? ` (${lista.join('; ')})` : ''}`
        },
        ajuda: 'É a espinha dorsal do produto. Não é a ordem de importância, essa vem na próxima.',
      },
      {
        id: 'f1-ranking', header: 'Ranking',
        pergunta: 'Escreva o ranking final, da tarefa mais importante para a menos importante.',
        ajuda: 'Decisão sua: a IA propõe a lista, o ranking é humano. Palpite de IA não fecha esta fase.',
      },
    ],
    extra(estado) {
      const falta = []
      const avisos = []
      const todas = estado?.tarefas || []
      const validas = todas.filter(vale)
      if (!todas.length) falta.push(`nenhuma tarefa cadastrada (${CMD} tarefa "<objetivo>" --sucesso "<texto que aparece na tela>")`)
      for (const t of todas.filter(ehPalpite)) falta.push(`${t.id} é palpite de ${t.de}, confirme (${CMD} confirmar ${t.id})`)
      if (validas.length > 9) falta.push(`são ${validas.length} tarefas, e o limite é 9 (de preferência menos de 5)`)
      for (const t of validas) {
        if (!t.sucesso?.texto && !t.sucesso?.estado) falta.push(`${t.id} sem resultado observável (falta --sucesso com o texto que aparece na tela)`)
        if (t.objetivo.split(/\s+/).length < 3) avisos.push(`${t.id}: o objetivo tem menos de 3 palavras, diga verbo, objeto e resultado`)
      }
      return { falta, avisos }
    },
  },
  {
    id: 2,
    titulo: 'Modelo conceitual',
    perguntas: [
      {
        id: 'f2-objetos', header: 'Objetos',
        pergunta: 'Que objetos existem para a pessoa? (os substantivos: fatura, pedido, perfil)',
        ajuda: 'Pense nas coisas que ela nomeia, não nas tabelas do banco. Aqui não se fala de tela.',
      },
      {
        id: 'f2-relacoes', header: 'Relações',
        pergunta: (r) => `Como esses objetos se relacionam?${txt(r['f2-objetos']).length > 0 && txt(r['f2-objetos']).length <= 80 ? ` (${txt(r['f2-objetos'])})` : ''} Exemplo: um cliente tem vários pedidos.`,
        ajuda: 'Uma relação por linha.',
      },
      {
        id: 'f2-acoes', header: 'Ações',
        pergunta: 'Que ações a pessoa faz em cada objeto, por papel (visitante, logado, administrador)?',
        ajuda: 'Nenhum objeto pode ficar sem ação, e nenhuma ação sem objeto.',
      },
      {
        id: 'f2-atributos', header: 'Atributos',
        pergunta: 'Que atributos de cada objeto importam para ela?',
        ajuda: 'Só os que mudam uma decisão dela. O resto é detalhe de banco.',
      },
      {
        id: 'f2-nomes', header: 'Nomes',
        pergunta: 'Que NOME a pessoa usa para cada coisa? Escreva o glossário: o que o time chama = o que aparece na tela.',
        ajuda: 'O nome da tela é a palavra de quem usa, não a do time. Um nome por coisa, do começo ao fim.',
      },
      {
        id: 'f2-conferir', header: 'Conferir', fechada: true,
        pergunta: 'Confira: cada tarefa da Fase 1 pode ser escrita só com os objetos e ações que você listou?',
        ajuda: `Se a resposta for não, apague esta resposta (${CMD} desfazer f2-conferir), corrija o modelo e responda de novo.`,
        opcoes: SN,
      },
    ],
    extra(estado) {
      const falta = []
      const c = respostasDe(estado)['f2-conferir']
      if (vale(c) && val(c) !== 'sim') falta.push('Conferir: o modelo ainda não escreve todas as tarefas (corrija e responda de novo)')
      return { falta, avisos: [] }
    },
  },
  {
    id: 3,
    titulo: 'Arquitetura da informação',
    perguntas: [
      {
        id: 'f3-grupos', header: 'Grupos',
        pergunta: 'Como os objetos se agrupam em lugares?',
        ajuda: 'Lugar é seção ou tela. Ainda sem visual.',
      },
      {
        id: 'f3-hierarquia', header: 'Hierarquia',
        pergunta: 'Qual a hierarquia: o que fica no primeiro nível e o que fica dentro de quê?',
        ajuda: 'Escreva como árvore, uma linha por lugar, com recuo.',
      },
      {
        id: 'f3-rotulos', header: 'Rótulos',
        pergunta: 'Que rótulo leva a cada lugar? Use a palavra do glossário da Fase 2.',
        ajuda: 'Um rótulo por lugar. O mapa automático confere depois se o mesmo lugar ganhou dois nomes.',
      },
      {
        id: 'f3-papeis', header: 'Papéis',
        pergunta: 'O que muda por papel (visitante, logado, administrador)?',
        ajuda: 'Lugar que só um papel vê, e lugar que cada papel vê de um jeito.',
      },
      {
        id: 'f3-destino', header: 'Destino', porTarefa: true,
        pergunta: (r, t) => `Em que lugar da árvore termina a tarefa "${t.objetivo}"?`,
        ajuda: 'Toda tarefa principal precisa ter um lugar de destino.',
      },
      {
        id: 'f3-treetest', header: 'Tree test', fechada: true,
        pergunta: 'Já houve tree test (achar o lugar certo só pela árvore, sem ver tela)?',
        ajuda: 'Com gente vale como resultado. Feito só pela IA vale como hipótese, e o programa marca assim.',
        opcoes: [
          { valor: 'gente', label: 'Com gente', descricao: 'Pessoas de verdade acharam o lugar pela árvore.' },
          { valor: 'ia', label: 'Só pela IA', descricao: 'Vale como hipótese, não como resultado.' },
          { valor: 'nao', label: 'Ainda não', descricao: 'A fase fica aberta.' },
        ],
      },
      {
        id: 'f3-acerto', header: 'Acerto',
        quando: (r) => val(r['f3-treetest']) === 'gente',
        pergunta: `Qual foi a taxa de acerto de cada tarefa principal no tree test? (de 0 a 100%, a meta inicial é ${META_ACERTO}% em cada uma)`,
        ajuda: 'Escreva uma taxa por tarefa. O programa confere se a pior está acima da meta.',
      },
    ],
    extra(estado, ctx) {
      const falta = []
      const avisos = []
      const r = respostasDe(estado)
      if (val(r['f3-treetest']) === 'nao' && vale(r['f3-treetest'])) falta.push('Tree test: ainda não feito (com gente, ou pela IA marcado como hipótese)')
      if (val(r['f3-treetest']) === 'ia') avisos.push('tree test só pela IA: vale como hipótese, não como resultado')
      if (vale(r['f3-acerto'])) {
        const ns = numeros(txt(r['f3-acerto'])).filter((n) => n <= 100)
        if (!ns.length) falta.push('Acerto: escreva a taxa em número (de 0 a 100)')
        else if (Math.min(...ns) < META_ACERTO) falta.push(`Acerto: a pior taxa está em ${Math.min(...ns)}, de 0 a 100, e a meta é ${META_ACERTO}`)
      }
      if (ctx.mapa) {
        const ri = rotulosInconsistentes(ctx.mapa)
        const n = ri.mesmoDestino.length + ri.mesmoRotulo.length
        if (n) avisos.push(`o mapa achou ${n} rótulo(s) inconsistente(s) (${CMD} mapa mostra quais)`)
      }
      return { falta, avisos }
    },
  },
  {
    id: 4,
    titulo: 'Roteiro de uso',
    perguntas: [
      {
        id: 'f4-entrada', header: 'Entrada', porTarefa: true,
        pergunta: (r, t) => `De onde a pessoa entra para "${t.objetivo}"? (link, notificação, busca, página inicial)`,
        ajuda: 'Uma entrada principal por tarefa.',
      },
      {
        id: 'f4-sequencia', header: 'Sequência', porTarefa: true,
        pergunta: (r, t) => `Entrando por ${citar(txt(irma(r, 'f4-entrada', t)), 'esse ponto')}, qual a sequência de lugares até o fim de "${t.objetivo}"?`,
        ajuda: 'Formato breadboard, um passo por linha: Lugar: [ação] -> Lugar seguinte.',
      },
      {
        id: 'f4-primeiro', header: 'Primeiro nível', porTarefa: true,
        pergunta: (r, t) => `Em cada lugar de "${t.objetivo}", o que fica no primeiro nível e o que fica para depois?`,
        ajuda: 'Revelação progressiva: o primeiro nível mostra só o que serve à tarefa principal dali.',
      },
      {
        id: 'f4-desvios', header: 'Desvios', porTarefa: true,
        pergunta: (r, t) => `Quais os desvios em "${t.objetivo}" (erro, estado vazio, sem permissão, desistir no meio, voltar) e como a pessoa volta de cada um?`,
        ajuda: 'Todo desvio tem volta. Beco sem saída reprova a fase.',
      },
      {
        id: 'f4-sinaliza', header: 'Onde estou', porTarefa: true, fechada: true,
        pergunta: (r, t) => `Em "${t.objetivo}", cada lugar responde "onde estou, para onde posso ir, o que vou achar"?`,
        ajuda: 'Se algum lugar não responde, escreva não e corrija antes de seguir.',
        opcoes: SN,
      },
    ],
    extra(estado, ctx) {
      const falta = []
      const avisos = []
      for (const p of todas(estado).filter((x) => x.base === 'f4-sinaliza')) {
        const a = respostasDe(estado)[p.id]
        if (vale(a) && val(a) !== 'sim') falta.push(`${p.header}: algum lugar não diz onde a pessoa está (corrija e responda de novo)`)
      }
      if (ctx.mapa) {
        const sv = semVolta(ctx.mapa)
        if (sv.length) avisos.push(`o mapa achou ${sv.length} tela(s) sem caminho de volta à raiz: ${sv.slice(0, 5).join(', ')}${sv.length > 5 ? '…' : ''}`)
        const ne = naoExploradas(ctx.mapa).length
        if (ne) avisos.push(`${ne} de ${(ctx.mapa.telas || []).length} telas do mapa não foram exploradas até o fim: o resultado de "sem volta" é parcial`)
      }
      return { falta, avisos }
    },
  },
  {
    id: 5,
    titulo: 'Percurso cognitivo',
    perguntas: [
      {
        id: 'f5-tentar', header: 'Tenta certo', porTarefa: true, fechada: true,
        pergunta: (r, t) => `No caminho de "${t.objetivo}", a pessoa vai tentar fazer a coisa certa em cada passo?`,
        ajuda: 'Primeira das quatro perguntas do percurso cognitivo (cognitive walkthrough). Responda como hipótese, sem ver tela.',
        opcoes: SN,
      },
      {
        id: 'f5-notar', header: 'Nota a ação', porTarefa: true, fechada: true,
        pergunta: (r, t) => `Em "${t.objetivo}", ela vai notar que a ação certa está disponível?`,
        ajuda: 'Segunda pergunta. Um "não" aqui exige correção.',
        opcoes: SN,
      },
      {
        id: 'f5-ligar', header: 'Liga ao resultado', porTarefa: true, fechada: true,
        pergunta: (r, t) => `Em "${t.objetivo}", ela vai ligar essa ação ao resultado que quer?`,
        ajuda: 'Terceira pergunta: o rótulo da ação tem cheiro do que ela procura?',
        opcoes: SN,
      },
      {
        id: 'f5-progresso', header: 'Vê que avançou', porTarefa: true, fechada: true,
        pergunta: (r, t) => `Em "${t.objetivo}", depois de agir, ela vai ver que avançou?`,
        ajuda: 'Quarta pergunta. Um "não" aqui exige correção.',
        opcoes: SN,
      },
      {
        id: 'f5-falha', header: 'Onde falharia', porTarefa: true,
        pergunta: (r, t) => `Onde uma pessoa nova falharia em "${t.objetivo}", e por quê? (se em lugar nenhum, escreva isso e o motivo)`,
        ajuda: 'A pergunta que corrige o viés da IA, que tende a achar que tudo funciona.',
      },
      {
        id: 'f5-correcao', header: 'Correção', porTarefa: true,
        quando: (r, t) => NAO_NA_TAREFA(r, t),
        pergunta: (r, t) => `Qual a correção para "${t.objetivo}", na estrutura (fluxo, rótulo ou ordem), e quem decide?`,
        ajuda: 'Só aparece porque houve um não. Nada de cor ou fonte: isso só entra na Fase 6.',
      },
    ],
    extra(estado, ctx) {
      const avisos = []
      if (Array.isArray(ctx.sessoes)) {
        for (const t of tarefasValidas(estado)) {
          const dela = ctx.sessoes.filter((s) => s.tarefa === t.id)
          if (!dela.length) avisos.push(`${t.id}: nenhuma sessão de agente ainda (${CMD} agente ${t.id} --cerebro humano)`)
          else avisos.push(`${t.id}: ${dela.filter((s) => s.sucesso).length} de ${dela.length} sessões de agente chegaram ao fim`)
        }
      }
      return { falta: [], avisos }
    },
  },
  {
    id: 6,
    titulo: 'Tela',
    perguntas: [
      {
        id: 'f6-signifier', header: 'Sinais',
        pergunta: 'Onde, na tela, fica cada sinal que o roteiro exige (botão, rótulo, estado)?',
        ajuda: 'A partir daqui cor, fonte e espaçamento entram na conversa.',
      },
      {
        id: 'f6-peso', header: 'Peso visual',
        pergunta: 'O que tem mais peso visual é o passo principal do roteiro? Se não, o que está tirando o peso?',
        ajuda: 'O olho vai primeiro no que pesa mais.',
      },
      {
        id: 'f6-visual', header: 'Visual',
        pergunta: 'O visual reforça ou contradiz a história do roteiro?',
        ajuda: 'Um exemplo de cada, se houver.',
      },
      {
        id: 'f6-firstclick', header: 'Primeiro clique', fechada: true,
        pergunta: `Já fez o teste do primeiro clique nas telas-chave? (a pessoa clica onde acha que resolve a tarefa, meta de ${META_ACERTO}% de acerto por tarefa)`,
        ajuda: 'Abaixo da meta a fase fica aberta.',
        opcoes: [
          { valor: 'acima', label: 'Acima da meta', descricao: `${META_ACERTO}% ou mais em cada tarefa.` },
          { valor: 'abaixo', label: 'Abaixo da meta', descricao: 'Alguma tarefa ficou abaixo.' },
          { valor: 'nao', label: 'Ainda não feito', descricao: 'A fase fica aberta.' },
        ],
      },
      {
        id: 'f6-heuristicas', header: 'Heurísticas', fechada: true,
        pergunta: 'Fez a varredura das 10 heurísticas de usabilidade de Nielsen, sem problema grave aberto?',
        ajuda: 'Problema grave aberto reprova a fase.',
        opcoes: [
          { valor: 'sim', label: 'Sim', descricao: 'Varredura feita, sem problema grave aberto.' },
          { valor: 'aberto', label: 'Tem problema grave aberto', descricao: 'A fase fica aberta.' },
          { valor: 'nao', label: 'Ainda não feita', descricao: 'A fase fica aberta.' },
        ],
      },
      {
        id: 'f6-trunk', header: 'Teste do tronco', fechada: true,
        pergunta: 'Em qualquer página interna a pessoa consegue dizer em que site está, em que página, quais as seções principais e como busca?',
        ajuda: 'É o teste do tronco (trunk test). Vale para uma página interna escolhida ao acaso.',
        opcoes: SN,
      },
    ],
    extra(estado) {
      const falta = []
      const r = respostasDe(estado)
      if (vale(r['f6-firstclick']) && val(r['f6-firstclick']) !== 'acima') falta.push('Primeiro clique: ainda não está acima da meta')
      if (vale(r['f6-heuristicas']) && val(r['f6-heuristicas']) !== 'sim') falta.push('Heurísticas: varredura pendente ou com problema grave aberto')
      if (vale(r['f6-trunk']) && val(r['f6-trunk']) !== 'sim') falta.push('Teste do tronco: não passou')
      return { falta, avisos: [] }
    },
  },
  {
    id: 7,
    titulo: 'Validar com gente',
    perguntas: [
      {
        id: 'f7-pessoas', header: 'Pessoas',
        pergunta: 'Quantas pessoas reais fizeram o teste, e quem eram? (o plano pede cerca de 5)',
        ajuda: 'Pessoa de verdade, não agente. O agente do programa é hipótese, não substitui isto.',
      },
      {
        id: 'f7-sucesso', header: 'Sucesso',
        pergunta: `Qual a taxa de sucesso de cada tarefa principal? (de 0 a 100%, a meta é ${META_ACERTO}% em cada uma)`,
        ajuda: 'Uma taxa por tarefa.',
      },
      {
        id: 'f7-tempo', header: 'Tempo',
        pergunta: 'Em quanto tempo, em média, cada tarefa foi feita?',
        ajuda: 'Um tempo por tarefa, em segundos ou minutos.',
      },
      {
        id: 'f7-sus', header: 'SUS',
        pergunta: `Qual o SUS da rodada? (nota de 0 a 100, o piso é ${PISO_SUS}, a média de mercado)`,
        ajuda: 'SUS é o questionário de dez perguntas de usabilidade (System Usability Scale).',
      },
      {
        id: 'f7-travou', header: 'Travamentos',
        pergunta: 'Onde as pessoas travaram que o percurso cognitivo da Fase 5 não previu? (com print ou vídeo)',
        ajuda: 'Cada travamento novo é um item de backlog.',
      },
      {
        id: 'f7-backlog', header: 'Backlog', fechada: true,
        pergunta: 'Cada travamento novo virou item no backlog?',
        ajuda: 'Sem isso o aprendizado some.',
        opcoes: SN,
      },
    ],
    extra(estado) {
      const falta = []
      const avisos = []
      const r = respostasDe(estado)
      if (vale(r['f7-sucesso'])) {
        const ns = numeros(txt(r['f7-sucesso'])).filter((n) => n <= 100)
        if (!ns.length) falta.push('Sucesso: escreva a taxa em número (de 0 a 100)')
        else if (Math.min(...ns) < META_ACERTO) falta.push(`Sucesso: a pior taxa está em ${Math.min(...ns)}, de 0 a 100, e a meta é ${META_ACERTO}`)
      }
      if (vale(r['f7-sus'])) {
        const n = numeros(txt(r['f7-sus']))[0]
        if (n === undefined || n > 100) falta.push('SUS: escreva a nota em número, de 0 a 100')
        else if (n < PISO_SUS) falta.push(`SUS: está em ${n}, de 0 a 100, e o piso é ${PISO_SUS}`)
      }
      if (vale(r['f7-backlog']) && val(r['f7-backlog']) !== 'sim') falta.push('Backlog: ainda há travamento fora do backlog')
      if (vale(r['f7-pessoas'])) {
        const n = numeros(txt(r['f7-pessoas']))[0]
        if (n !== undefined && n < 5) avisos.push(`só ${n} de 5 pessoas fizeram o teste`)
      }
      return { falta, avisos }
    },
  },
  {
    id: 8,
    titulo: 'Acompanhar',
    perguntas: [
      {
        id: 'f8-medicao', header: 'Como medir',
        pergunta: 'Como as tarefas principais serão medidas de novo (taxa de sucesso ou tempo), e a cada quanto?',
        ajuda: 'Esta fase não termina: ela fica em dia enquanto houver data marcada.',
      },
      {
        id: 'f8-mudou', header: 'O que mudou',
        pergunta: 'O que as pessoas vêm fazer mudou desde a última medição? (na primeira vez, escreva que não há medição anterior)',
        ajuda: 'Mudança aqui reabre a Fase 1.',
      },
      {
        id: 'f8-proxima', header: 'Próxima medição',
        pergunta: 'Qual a data da próxima medição? (AAAA-MM-DD)',
        ajuda: 'Data que já passou deixa a fase aberta de novo.',
      },
    ],
    extra(estado, ctx) {
      const falta = []
      const a = respostasDe(estado)['f8-proxima']
      if (vale(a)) {
        const d = dataDe(txt(a))
        if (!d) falta.push('Próxima medição: escreva a data no formato AAAA-MM-DD')
        else if (d.getTime() < (ctx.agora || new Date()).getTime() - 86400000) falta.push(`Próxima medição: a data ${txt(a)} já passou, marque a seguinte`)
      }
      return { falta, avisos: [] }
    },
  },
]

/** Aceita AAAA-MM-DD e DD/MM/AAAA. */
function dataDe(t) {
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59)
  m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t)
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59) : null
}

/** Dá a cada fase o `pronto(estado, ctx)` que devolve `{ ok, falta, avisos }`. */
function montar(def) {
  return {
    id: def.id,
    titulo: def.titulo,
    perguntas: def.perguntas,
    pronto(estado, ctx = {}) {
      const falta = []
      const avisos = []
      if (def.perguntas.some((p) => p.porTarefa) && !tarefasValidas(estado).length) {
        falta.push('nenhuma tarefa confirmada (Fase 1): sem tarefa não há o que percorrer')
      }
      for (const p of todas(estado).filter((x) => x.fase === def.id && cabe(x, estado))) {
        const m = pendencia(estado, p)
        if (m) falta.push(m)
      }
      const e = def.extra ? def.extra(estado, ctx) : {}
      falta.push(...(e.falta || []))
      avisos.push(...(e.avisos || []))
      return { ok: falta.length === 0, falta, avisos }
    },
  }
}

export const FASES = DEFINICAO.map(montar)

/* ===================================================================== */
/* 3. Perguntas: expansão por tarefa, encadeamento e progresso            */
/* ===================================================================== */

export const respostasDe = (estado) => estado?.respostas || {}

/**
 * Todas as perguntas, já expandidas: as que são "por tarefa" viram uma por
 * tarefa confirmada (id `f4-entrada@T1`), agrupadas por tarefa para a pessoa
 * terminar o roteiro de uma antes de passar para a outra. Tarefa palpite de IA
 * ainda não gera pergunta: medir o roteiro de um palpite é medir a IA.
 */
export function todas(estado) {
  const ts = tarefasValidas(estado)
  const lista = []
  const inst = (f, p, t = null) => ({
    ...p,
    base: p.id,
    id: t ? `${p.id}@${t.id}` : p.id,
    fase: f.id,
    tarefa: t,
    header: t ? `${p.header} (${t.id})` : p.header,
  })
  for (const f of DEFINICAO) {
    const ps = f.perguntas
    for (let i = 0; i < ps.length;) {
      if (!ps[i].porTarefa) { lista.push(inst(f, ps[i])); i++; continue }
      let j = i
      while (j < ps.length && ps[j].porTarefa) j++
      for (const t of ts) for (const p of ps.slice(i, j)) lista.push(inst(f, p, t))
      i = j
    }
  }
  return lista
}

/** Uma pergunta cabe no roteiro de agora? Sem `quando`, sempre cabe. */
const cabe = (p, estado) => (typeof p.quando === 'function' ? Boolean(p.quando(respostasDe(estado), p.tarefa, estado)) : true)

/** Só as perguntas que a conversa até aqui tornou aplicáveis. A lista ENCOLHE e CRESCE. */
export const aplicaveis = (estado) => todas(estado).filter((p) => cabe(p, estado))

/** O texto final da pergunta, com a resposta anterior dentro. */
export const textoDaPergunta = (p, estado) => (typeof p.pergunta === 'function' ? p.pergunta(respostasDe(estado), p.tarefa, estado) : p.pergunta)

/** O que falta numa pergunta para ela valer no `pronto`, ou null. */
function pendencia(estado, p) {
  const r = respostasDe(estado)[p.id]
  if (!r) return `${p.header}: sem resposta`
  if (ehPalpite(r)) return `${p.header}: é palpite de ${r.de}, confirme (${CMD} confirmar ${p.id})`
  return null
}

/** Quantas já foram, de quantas o roteiro de agora tem. */
export function progresso(estado) {
  const lista = aplicaveis(estado)
  return { feitas: lista.filter((p) => respostasDe(estado)[p.id] !== undefined).length, total: lista.length }
}

/**
 * Onde o projeto está nas nove fases. A fase atual é a primeira que não está
 * pronta; a fase 8 nunca "termina", ela fica em dia (`emDia`).
 *
 * `ctx` leva o que o programa mediu: `{ mapa, sessoes, agora }`. Só gera AVISO.
 */
export function situacao(estado, ctx = {}) {
  const fases = FASES.map((f) => ({ id: f.id, titulo: f.titulo, ...f.pronto(estado, ctx) }))
  const atual = fases.find((f) => !f.ok)
  return {
    fase: (atual || fases[fases.length - 1]).id,
    titulo: (atual || fases[fases.length - 1]).titulo,
    prontas: fases.filter((f) => f.ok).length,
    total: FASES.length,
    emDia: !atual,
    fases,
    palpites: palpites(estado),
  }
}

/**
 * A próxima pergunta, ou `null` quando não há nenhuma pendente.
 *
 * Uma por vez, e SÓ da fase atual (ou de uma anterior que reabriu): disparar a
 * fase seguinte sobre palpite não confirmado é o erro que esta camada existe
 * para impedir. Quando a fase atual está sem pergunta mas ainda não está
 * pronta, devolve `null` e o `falta` da `situacao` diz o que fazer.
 */
export function proxima(estado) {
  const atual = situacao(estado).fase
  for (const p of aplicaveis(estado)) {
    if (p.fase > atual) break
    if (respostasDe(estado)[p.id] !== undefined) continue
    return {
      fase: p.fase,
      faseTitulo: FASES[p.fase].titulo,
      id: p.id,
      tarefa: p.tarefa ? p.tarefa.id : null,
      header: p.header,
      pergunta: textoDaPergunta(p, estado),
      ajuda: p.ajuda,
      opcoes: p.opcoes || null,
      ...progresso(estado),
    }
  }
  return null
}

/* ===================================================================== */
/* 4. Responder, confirmar, desfazer, tarefas                             */
/* ===================================================================== */

/**
 * Grava uma resposta e devolve o estado novo. Puro: quem chama grava em disco.
 *
 * A entrada pode ser o rótulo da opção, o valor dela ou texto livre (sem
 * acento e sem caixa). Pergunta `fechada` só aceita opção, porque o `pronto`
 * lê o valor e texto solto ficaria sem leitura nenhuma, calado.
 */
export function responder(estado, id, entrada, { de = 'ele', quando = null, por = null } = {}) {
  if (!DE_VALIDO.test(de)) return { ok: false, erro: `autor inválido: "${de}" (use ele, programa ou ia:<modelo>)` }
  const p = todas(estado).find((x) => x.id === id)
  if (!p) return { ok: false, erro: `pergunta desconhecida: ${id}` }
  if (!cabe(p, estado)) return { ok: false, erro: `a pergunta "${id}" não se aplica pelo que já foi respondido` }

  const cru = String(entrada ?? '').trim()
  if (!cru) return { ok: false, erro: 'resposta vazia' }

  const alvo = norm(cru)
  const casa = (p.opcoes || []).find((o) => norm(o.valor) === alvo || norm(o.label) === alvo)
  if (p.fechada && !casa) return { ok: false, erro: `responda com uma destas opções: ${p.opcoes.map((o) => o.valor).join(', ')}` }

  /* Regra que atravessa as fases: nada de cor, fonte ou espaçamento antes da
     Fase 6. Se a IA trouxer, a resposta é descartada (gaveta do roteiro, 4). */
  if (de.startsWith('ia:') && p.fase < 6 && ESTETICA.test(cru)) {
    return { ok: false, erro: `resposta descartada: a Fase ${p.fase} não discute cor, fonte, espaçamento nem estética (isso só entra na Fase 6)` }
  }

  const resposta = {
    valor: casa ? casa.valor : null,
    texto: casa ? casa.label : cru,
    de,
    quando: quando || new Date().toISOString(),
    ...(por && { por }),
  }
  const novo = { ...estado, respostas: { ...respostasDe(estado), [id]: resposta } }
  return { ok: true, estado: novo, resposta, proxima: proxima(novo) }
}

/**
 * Ele confirma um palpite de IA, resposta ou tarefa. O autor continua sendo a IA.
 * `por` registra COMO a confirmação chegou: `{ de: 'ele', via: 'terminal' }` (ele
 * digitou) ou `{ de: 'ele', via: 'ia', citacao }` (a IA rodou o comando por ele, com
 * as palavras dele). A conferência de quem pode confirmar é da linha de comando.
 */
export function confirmar(estado, id, { quando = null, por = null } = {}) {
  const em = quando || new Date().toISOString()
  const r = respostasDe(estado)[id]
  if (r) {
    if (!ehPalpite(r)) return { ok: false, erro: `"${id}" já vale, não é palpite` }
    return { ok: true, alvo: 'resposta', estado: { ...estado, respostas: { ...estado.respostas, [id]: { ...r, confirmadoEm: em, ...(por && { confirmadoPor: por }) } } } }
  }
  const t = (estado?.tarefas || []).find((x) => x.id === id)
  if (!t) return { ok: false, erro: `não achei resposta nem tarefa "${id}"` }
  if (!ehPalpite(t)) return { ok: false, erro: `"${id}" já vale, não é palpite` }
  return { ok: true, alvo: 'tarefa', estado: { ...estado, tarefas: estado.tarefas.map((x) => (x.id === id ? { ...x, confirmadoEm: em, ...(por && { confirmadoPor: por }) } : x)) } }
}

/** Apaga uma resposta e tudo que só existia por causa dela (como na entrevista). */
export function desfazer(estado, id) {
  if (respostasDe(estado)[id] === undefined) return { ok: false, erro: `"${id}" não foi respondida` }
  const respostas = { ...respostasDe(estado) }
  delete respostas[id]
  const orfas = []
  let novo = { ...estado, respostas }
  for (const p of todas(novo)) {
    if (respostas[p.id] === undefined || cabe(p, novo)) continue
    delete respostas[p.id]
    orfas.push(p.id)
    novo = { ...estado, respostas }
  }
  return { ok: true, estado: novo, orfas }
}

/**
 * Cria a tarefa e devolve o id (`T1`, `T2`...). Tarefa de IA é palpite até ele confirmar.
 * `sucesso.texto` é o texto que aparece na tela quando a tarefa deu certo;
 * `sucesso.estado` é a assinatura da tela-alvo. O CÓDIGO confere um dos dois,
 * a IA nunca declara o próprio sucesso.
 */
export function novaTarefa(estado, { objetivo, papel = null, sucesso = {}, de = 'ele', quando = null, por = null } = {}) {
  if (!DE_VALIDO.test(de)) return { ok: false, erro: `autor inválido: "${de}" (use ele, programa ou ia:<modelo>)` }
  const obj = String(objetivo || '').trim()
  if (obj.length < 3) return { ok: false, erro: 'tarefa sem objetivo' }
  const maior = Math.max(0, ...(estado?.tarefas || []).map((t) => Number(String(t.id).slice(1)) || 0))
  const tarefa = {
    id: `T${maior + 1}`,
    objetivo: obj,
    papel: papel ? String(papel).trim() : null,
    sucesso: {
      texto: String(sucesso?.texto || '').trim() || null,
      estado: String(sucesso?.estado || '').trim() || null,
    },
    de,
    quando: quando || new Date().toISOString(),
    ...(por && { por }),
  }
  return { ok: true, tarefa, estado: { ...estado, tarefas: [...(estado?.tarefas || []), tarefa] } }
}

/** O que ainda é palpite de IA, esperando ele confirmar. */
export function palpites(estado) {
  const resp = Object.entries(respostasDe(estado))
    .filter(([, r]) => ehPalpite(r))
    .map(([id, r]) => ({ id, tipo: 'resposta', texto: r.texto, de: r.de }))
  const tars = (estado?.tarefas || []).filter(ehPalpite).map((t) => ({ id: t.id, tipo: 'tarefa', texto: t.objetivo, de: t.de }))
  return [...tars, ...resp]
}

/** O roteiro respondido até aqui, em texto. Palpite sai marcado, sempre. */
export function resumo(estado) {
  const r = respostasDe(estado)
  const linhas = []
  for (const f of FASES) {
    const dela = todas(estado).filter((p) => p.fase === f.id && r[p.id] !== undefined)
    if (!dela.length) continue
    linhas.push(`Fase ${f.id}, ${f.titulo}:`)
    for (const p of dela) {
      const a = r[p.id]
      const texto = a.texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' · ')
      const marca = ehPalpite(a) ? ` (palpite de ${a.de}, confirme)` : a.de === 'programa' ? ' (medido pelo programa)' : ''
      linhas.push(`  ${p.header.padEnd(18)} ${texto}${marca}`)
    }
  }
  const ts = estado?.tarefas || []
  if (ts.length) {
    linhas.push(`Tarefas (${ts.length}):`)
    for (const t of ts) linhas.push(`  ${t.id} ${t.objetivo}${ehPalpite(t) ? ` (palpite de ${t.de}, confirme)` : ''}`)
  }
  return linhas.length ? linhas.join('\n') : 'o roteiro ainda não começou'
}

/* ===================================================================== */
/* 5. Disco: estado, mapa, sessões (escrita atômica)                      */
/* ===================================================================== */

const pasta = (raiz) => join(raiz, 'docs', 'roteiro')

export const vazio = () => ({ versao: 1, respostas: {}, tarefas: [] })

/** Escreve num temporário e renomeia: leitor nunca vê arquivo pela metade. */
export function escreverAtomico(arquivo, conteudo) {
  mkdirSync(join(arquivo, '..'), { recursive: true })
  const tmp = `${arquivo}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, conteudo)
  renameSync(tmp, arquivo)
}

/** Sem arquivo, estado vazio. Arquivo ilegível ERRA: voltar vazio e gravar por cima apagaria tudo. */
export function ler(raiz) {
  const arq = join(pasta(raiz), 'estado.json')
  if (!existsSync(arq)) return vazio()
  try {
    const e = JSON.parse(readFileSync(arq, 'utf8'))
    return { ...vazio(), ...e, respostas: e.respostas || {}, tarefas: e.tarefas || [] }
  } catch (err) {
    throw new Error(`o estado do roteiro está ilegível (${arq}): ${err.message}`)
  }
}

export function gravar(raiz, estado) {
  escreverAtomico(join(pasta(raiz), 'estado.json'), JSON.stringify(estado, null, 2) + '\n')
}

export function lerMapa(raiz) {
  try { return JSON.parse(readFileSync(join(pasta(raiz), 'mapa.json'), 'utf8')) } catch { return null }
}

export function gravarMapa(raiz, mapa) {
  escreverAtomico(join(pasta(raiz), 'mapa.json'), JSON.stringify(mapa, null, 2) + '\n')
}

/**
 * Sessão em disco: `sessoes/<id>.jsonl`, uma linha por registro.
 *
 *   {"tipo":"sessao", id, tarefa, cerebro, persona, otimo?, quando}   cabeçalho
 *   {"tipo":"passo", tela, escolha, rotulo, pensamento, tempo, ...}   um por passo
 *   {"tipo":"fim", sucesso, desistiu}                                 fecho
 *
 * A leitura é tolerante: linha sem `tipo` é classificada pelo que tem (cabeçalho
 * se traz cérebro, persona ou tarefa sem escolha; fecho se traz só `sucesso`;
 * senão é passo), e uma linha com a lista `passos` inteira vale como sessão pronta.
 */
export function gravarSessao(raiz, sessao) {
  const { passos = [], sucesso = false, desistiu = false, ...cab } = sessao
  const id = cab.id || `S${Date.now()}`
  const linhas = [
    { tipo: 'sessao', ...cab, id },
    ...passos.map((p) => ({ tipo: 'passo', ...p })),
    { tipo: 'fim', sucesso: Boolean(sucesso), desistiu: Boolean(desistiu) },
  ]
  escreverAtomico(join(pasta(raiz), 'sessoes', `${id}.jsonl`), linhas.map((l) => JSON.stringify(l)).join('\n') + '\n')
  return id
}

export function lerSessoes(raiz) {
  const dir = join(pasta(raiz), 'sessoes')
  if (!existsSync(dir)) return []
  const saida = []
  for (const nome of readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
    const s = { id: nome.replace(/\.jsonl$/, ''), tarefa: null, cerebro: null, persona: null, passos: [], sucesso: false, desistiu: false }
    for (const linha of readFileSync(join(dir, nome), 'utf8').split('\n')) {
      let o
      try { o = JSON.parse(linha) } catch { continue }
      if (!o || typeof o !== 'object') continue
      if (Array.isArray(o.passos)) { Object.assign(s, o); continue }
      const temPasso = o.tela !== undefined || o.escolha !== undefined
      if (o.tipo === 'sessao' || (!o.tipo && !temPasso && (o.cerebro || o.persona || o.tarefa))) {
        const { tipo, ...cab } = o
        Object.assign(s, cab)
      } else if (o.tipo === 'fim' || (!o.tipo && !temPasso && typeof o.sucesso === 'boolean')) {
        s.sucesso = Boolean(o.sucesso)
        s.desistiu = Boolean(o.desistiu)
        if (Number.isFinite(o.otimo)) s.otimo = o.otimo
      } else {
        const { tipo, ...passo } = o
        s.passos.push(passo)
      }
    }
    saida.push(s)
  }
  return saida
}

/* ===================================================================== */
/* 6. Análise do mapa (o mapa.json: telas e arestas)                      */
/* ===================================================================== */

const RAIZ = 'raiz'

/** Escolhas do cérebro que não são o número de um elemento. */
const ROLAR = new Set(['rolar', 'rolar acima'])
const ACOES_SEM_NUMERO = new Set(['voltar', 'desistir', ...ROLAR])

function adjacencia(mapa, inverso = false) {
  const ad = new Map()
  for (const a of mapa?.arestas || []) {
    const [de, para] = inverso ? [a.para, a.de] : [a.de, a.para]
    if (!ad.has(de)) ad.set(de, [])
    ad.get(de).push(a)
  }
  return ad
}

/** Menor caminho em CLIQUES (busca em largura): lista de arestas, `[]` se é a mesma tela, `null` se não há caminho. */
export function menorCaminho(mapa, de, para) {
  if (de === para) return []
  const ad = adjacencia(mapa)
  const veio = new Map([[de, null]])
  const fila = [de]
  while (fila.length) {
    const u = fila.shift()
    for (const a of ad.get(u) || []) {
      if (veio.has(a.para)) continue
      veio.set(a.para, a)
      if (a.para === para) {
        const caminho = []
        for (let c = para; c !== de; c = veio.get(c).de) caminho.unshift(veio.get(c))
        return caminho
      }
      fila.push(a.para)
    }
  }
  return null
}

/** Cliques mínimos da raiz até cada tela alcançável: `{ tela: cliques }`. */
export function profundidades(mapa, raiz = RAIZ) {
  const ad = adjacencia(mapa)
  const prof = { [raiz]: 0 }
  const fila = [raiz]
  while (fila.length) {
    const u = fila.shift()
    for (const a of ad.get(u) || []) {
      if (a.para in prof) continue
      prof[a.para] = prof[u] + 1
      fila.push(a.para)
    }
  }
  return prof
}

/** Ids das telas que o mapa não testou até o fim (`explorada: false`, o prazo cortou antes). */
export const naoExploradas = (mapa) => (mapa?.telas || []).filter((t) => t.explorada === false).map((t) => t.id)

/**
 * Telas alcançáveis da raiz de onde NÃO há caminho de volta a ela (beco sem saída).
 *
 * Só afirma "sem volta" quando as saídas da tela são conhecidas: tela não
 * explorada até o fim pode ter o botão de volta ainda não testado, e uma tela
 * que só chega à raiz passando por ela também não pode ser acusada. Por isso as
 * não exploradas entram como "talvez voltem" (nunca saem na lista, e sustentam
 * quem passa por elas). Medido no Nexus: 21 de 28 "sem volta" eram só 4 telas
 * exploradas e 24 cortadas pelo prazo.
 */
export function semVolta(mapa, raiz = RAIZ) {
  const ida = new Set(Object.keys(profundidades(mapa, raiz)))
  const inv = adjacencia(mapa, true)
  const volta = new Set([raiz, ...naoExploradas(mapa)])
  const fila = [...volta]
  while (fila.length) {
    const u = fila.shift()
    for (const a of inv.get(u) || []) {
      if (volta.has(a.de)) continue
      volta.add(a.de)
      fila.push(a.de)
    }
  }
  return [...ida].filter((t) => !volta.has(t))
}

/**
 * Rótulos que não se mantêm: `mesmoDestino` (um lugar com nomes diferentes) e
 * `mesmoRotulo` (um nome que leva a lugares diferentes).
 * ponytail: compara sem acento e sem caixa; sinônimo de verdade (Estoque e
 * Armazém) o código não percebe, só dá para a pessoa conferir. "Voltar" que
 * leva a telas diferentes aparece em `mesmoRotulo`: é aviso, não defeito.
 */
export function rotulosInconsistentes(mapa) {
  const porDestino = new Map()
  const porRotulo = new Map()
  for (const a of mapa?.arestas || []) {
    const chave = norm(a.rotulo)
    if (!chave || a.de === a.para) continue
    if (!porDestino.has(a.para)) porDestino.set(a.para, new Map())
    if (!porDestino.get(a.para).has(chave)) porDestino.get(a.para).set(chave, a.rotulo)
    if (!porRotulo.has(chave)) porRotulo.set(chave, { rotulo: a.rotulo, destinos: new Set() })
    porRotulo.get(chave).destinos.add(a.para)
  }
  return {
    mesmoDestino: [...porDestino].filter(([, m]) => m.size > 1).map(([para, m]) => ({ para, rotulos: [...m.values()] })),
    mesmoRotulo: [...porRotulo.values()].filter((x) => x.destinos.size > 1).map((x) => ({ rotulo: x.rotulo, destinos: [...x.destinos] })),
  }
}

/* ===================================================================== */
/* 7. Sessões: métricas, voto e a resposta do cérebro                     */
/* ===================================================================== */

/**
 * Métricas de uma sessão. `passos`: `[{ tela, escolha, rotulo, pensamento, tempo }]`;
 * `otimo`: cliques do caminho mínimo do mapa (ou null sem mapa).
 *
 * Desorientação de Smith: L = raiz((N/S - 1)² + (R/N - 1)²), com N = telas
 * diferentes visitadas, S = visitas no total (cada passo é uma visita) e
 * R = `otimo`, o mínimo de telas em que é preciso decidir. Zero é o caminho
 * perfeito; N=6, R=3, S=8 dá 0,56. Sem mapa (`otimo` null) fica null.
 * Passo de rolar a tela não muda de tela, então não conta como visita (aparece em `rolagens`).
 */
export function metricas(passos = [], otimo = null, { sucesso = null } = {}) {
  const visitas = passos.filter((p) => !ROLAR.has(p.escolha)).map((p) => p.tela).filter((t) => t !== undefined && t !== null)
  const S = visitas.length
  const N = new Set(visitas).size
  const R = Number.isFinite(otimo) && otimo > 0 ? otimo : null
  return {
    sucesso,
    passos: passos.length,
    otimo: Number.isFinite(otimo) ? otimo : null,
    voltas: passos.filter((p) => p.escolha === 'voltar').length,
    rolagens: passos.filter((p) => ROLAR.has(p.escolha)).length,
    revisitas: S - N,
    desorientacao: S && R ? arredonda(Math.sqrt((N / S - 1) ** 2 + (R / N - 1) ** 2)) : null,
  }
}

/**
 * Quem é o AUTOR de uma sessão, para o voto. Cérebro de IA: cérebro mais persona
 * (`ia:haiku|novato`). Cérebro humano: `humano:<nome>`, e a persona NÃO conta, porque
 * a mesma pessoa fingindo duas personas é uma opinião só e não pode se confirmar
 * sozinha. A sessão traz o nome em `quem` (ou o cérebro já vem como `humano:<nome>`);
 * humano sem nome vira `humano:?`, todos juntos, o que nunca confirma por conta própria.
 */
export function autorDaSessao(s) {
  const c = String(s?.cerebro || '?')
  if (c === 'humano' || c.startsWith('humano:')) {
    const nome = c.startsWith('humano:') ? c.slice('humano:'.length) : String(s?.quem || '')
    return `humano:${norm(nome) || '?'}`
  }
  return `${c}|${s?.persona || '-'}`
}

/**
 * O voto. Junta os pontos de atrito das sessões e só marca **confirmado** o que
 * aparece em 2 ou mais sessões de AUTORES diferentes (ver `autorDaSessao`). O mesmo
 * autor repetindo o tropeço é uma opinião só, não duas.
 *
 * Pontos de atrito por sessão (cada um conta uma vez por sessão):
 * - `desistiu`: desistiu na tela X;
 * - `voltou`: voltou na tela X;
 * - `lento`: gastou mais que o dobro do ótimo (precisa de `sessao.otimo`);
 * - `nao-concluiu`: gastou o orçamento sem chegar ao fim nem desistir;
 * - `sem-efeito`: clicou e a tela não mudou.
 *
 * A tela de um achado é identificada pela `assinatura` do passo (o conteúdo da tela,
 * que é o que vale quando o endereço não muda) e, na falta dela, por `tela`. Para
 * saber se o clique mudou algo, compara `assinatura` com `paraAssinatura`, e na falta
 * delas `tela` com `para`.
 *
 * Passo com `falha` ou `perdido` é clique que o PROGRAMA não fez (botão protegido,
 * tapado, fora da janela, ou resposta fora do formato): não prova nada sobre a
 * interface. Vai para `naoClicou`, listado à parte, e nunca entra como achado de UX,
 * confirmado ou não.
 *
 * Devolve `{ confirmados, naoConfirmados, naoClicou }`, cada achado
 * `{ chave, tipo, tarefa, tela, texto, sessoes: [ids], autores: [..], confirmado }`.
 * O 2º argumento `{ mapa }` só serve para o texto dizer o NOME da tela.
 */
export function achados(sessoes = [], { mapa: mapaTelas = null } = {}) {
  /* Com o mapa, o texto diz o NOME da tela ("Ler o quadro de missões" em "QUADRO"), não o id interno ("t9"). */
  const nomeDe = (...ids) => {
    const candidatos = ids.filter((x) => x !== undefined && x !== null)
    for (const id of candidatos) {
      const t = (mapaTelas?.telas || []).find((x) => x.id === id || x.assinatura === id)
      if (t) return t.nome || t.titulo || id
    }
    return candidatos[0] ?? '?'
  }
  const chaveDaTela = (p) => p?.assinatura ?? p?.tela ?? null
  const nomeDaTela = (p) => nomeDe(p?.assinatura, p?.tela)

  const normais = new Map()
  const naoClicou = new Map()
  for (const s of sessoes) {
    const autor = autorDaSessao(s)
    const passos = s.passos || []
    const nestaSessao = new Set()
    const marca = (alvo, tipo, tela, texto, extra = '') => {
      const chave = `${tipo}:${s.tarefa ?? ''}:${tela ?? ''}${extra ? `:${extra}` : ''}`
      if (nestaSessao.has(chave)) return
      nestaSessao.add(chave)
      if (!alvo.has(chave)) alvo.set(chave, { chave, tipo, tarefa: s.tarefa ?? null, tela: tela ?? null, texto, sessoes: [], autores: [] })
      const a = alvo.get(chave)
      a.sessoes.push(s.id)
      if (!a.autores.includes(autor)) a.autores.push(autor)
    }
    const ultimo = passos[passos.length - 1]
    if (s.desistiu) marca(normais, 'desistiu', chaveDaTela(ultimo), `desistiu na tela ${nomeDaTela(ultimo)}`)
    for (const p of passos) {
      if (p.falha || p.perdido) continue
      if (p.escolha === 'voltar') marca(normais, 'voltou', chaveDaTela(p), `voltou na tela ${nomeDaTela(p)}`)
    }
    if (Number.isFinite(s.otimo) && s.otimo > 0 && passos.length > 2 * s.otimo) marca(normais, 'lento', null, 'gastou mais que o dobro do caminho ótimo')
    /* Achados do piloto no Nexus (02/11): dois cérebros gastaram o orçamento sem concluir, e nada era contado; e
       vários cliques não mudaram a tela (a pesquisa mede 34% de ações sem efeito em agentes web). */
    if (!s.sucesso && !s.desistiu && passos.length) marca(normais, 'nao-concluiu', null, `não concluiu a tarefa em ${passos.length} passos`)
    for (const p of passos) {
      if (p.falha || p.perdido) {
        const motivo = typeof p.falha === 'string' && p.falha ? `: ${p.falha}` : ''
        const texto = p.rotulo != null
          ? `o programa não clicou em "${p.rotulo}" na tela ${nomeDaTela(p)}${motivo}`
          : `passo perdido na tela ${nomeDaTela(p)}${motivo}`
        marca(naoClicou, 'nao-clicou', chaveDaTela(p), texto, p.rotulo ?? 'perdido')
        continue
      }
      const mesmaTela = p.assinatura && p.paraAssinatura ? p.paraAssinatura === p.assinatura : Boolean(p.tela && p.para && p.para === p.tela)
      if (Number.isFinite(p.escolha) && mesmaTela) marca(normais, 'sem-efeito', chaveDaTela(p), `clicou em "${p.rotulo ?? '?'}" na tela ${nomeDaTela(p)} e nada mudou`, p.rotulo ?? '?')
    }
  }
  const porPeso = (x, y) => y.sessoes.length - x.sessoes.length
  const todos = [...normais.values()].map((a) => ({ ...a, confirmado: a.autores.length >= 2 }))
  return {
    confirmados: todos.filter((a) => a.confirmado).sort(porPeso),
    naoConfirmados: todos.filter((a) => !a.confirmado).sort(porPeso),
    naoClicou: [...naoClicou.values()].map((a) => ({ ...a, confirmado: false })).sort(porPeso),
  }
}

/**
 * A resposta do cérebro, que deve ser uma linha JSON:
 * `{"escolha": <n> | "voltar" | "rolar" | "rolar acima" | "desistir", "pensamento": "..."}`.
 * "rolar" desce a tela (para ver o que está abaixo da dobra), "rolar acima" sobe.
 *
 * Aceita JSON dentro de texto e de cerca de código (modelo pensa em voz alta
 * antes de responder: vale o ÚLTIMO objeto com `escolha`). `validos` é a lista
 * dos números que estão na tela; fora dela, a resposta é recusada.
 * Devolve `{ ok: true, escolha, pensamento }` ou `{ ok: false, erro }`.
 */
export function analisarResposta(texto, validos = null) {
  const bruto = String(texto ?? '')
  const candidatos = [...(bruto.match(/\{[^{}]*\}/g) || [])].reverse()
  const ini = bruto.indexOf('{')
  const fim = bruto.lastIndexOf('}')
  if (ini >= 0 && fim > ini) candidatos.push(bruto.slice(ini, fim + 1))
  let obj = null
  for (const c of candidatos) {
    try {
      const o = JSON.parse(c)
      if (o && typeof o === 'object' && 'escolha' in o) { obj = o; break }
    } catch { /* tenta o próximo */ }
  }
  if (!obj) return { ok: false, erro: 'a resposta não traz uma linha JSON com "escolha"' }

  let e = obj.escolha
  if (typeof e === 'string') {
    const s = norm(e)
    if (ACOES_SEM_NUMERO.has(s)) e = s
    else if (/^\d+$/.test(s)) e = Number(s)
  }
  const pensamento = String(obj.pensamento ?? '').trim().slice(0, 500)
  if (ACOES_SEM_NUMERO.has(e)) return { ok: true, escolha: e, pensamento }
  if (!Number.isInteger(e) || e < 0) return { ok: false, erro: '"escolha" deve ser o número de um elemento, "voltar", "rolar", "rolar acima" ou "desistir"' }
  if (Array.isArray(validos) && !validos.includes(e)) return { ok: false, erro: `o elemento ${e} não está na tela` }
  return { ok: true, escolha: e, pensamento }
}
