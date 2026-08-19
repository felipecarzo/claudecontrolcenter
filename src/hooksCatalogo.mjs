// Catálogo dos hooks que o Control Center conhece — o que já existe de
// verdade (Método Routia, cc check) e o que os próximos épicos do backlog de
// hooks vão criar. Dado estático, sem I/O: quem lê disco é `hooksRegistro.mjs`
// (settings.json) e `config.mjs` (o toggle).
//
// `registradoVia` existe porque nem todo hook tem script próprio registrado
// no settings.json: `cc-check` vive dentro de `cc.mjs` e é disparado por
// `todo-guard.mjs`, que faz `spawnSync` pra ele — procurar por "cc.mjs" no
// settings.json nunca acharia nada, e diria "não registrado" pra um hook que
// está rodando de verdade a cada Stop.

export const EVENTOS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest',
  'Notification', 'Stop', 'SessionStart', 'SessionEnd',
  'PreCompact', 'PostCompact', 'UserPromptSubmit',
]

/**
 * CC-69: o que cada hook FAZ quando dispara, declarado num lugar só.
 *
 * O Danger tem `fail`, `warn` e `message`, e a regra diz qual usa. Aqui a
 * escolha estava certa em todos, mas **espalhada pelo código de cada um**: não
 * dava para olhar num lugar e saber o que trava e o que só fala.
 *
 * - `trava`  — recusa a ferramenta (exit 2). O agente não passa.
 * - `avisa`  — fala e deixa seguir. Todo hook de `Stop` é assim, e é obrigatório:
 *              exit 2 no `Stop` devolve o texto ao modelo e cria laço.
 * - `injeta` — põe contexto no começo da sessão, sem barrar nada.
 * - `mede`   — só registra, nunca aparece.
 */
export const NIVEIS = {
  trava: 'recusa a ferramenta — o agente não passa',
  avisa: 'fala e deixa seguir',
  injeta: 'põe contexto no início da sessão',
  mede: 'só registra, não aparece',
}

/**
 * CC-115 — os módulos: o agrupamento que liga e desliga POR PROJETO.
 *
 * O interruptor por hook continua global (aba de hooks). O que o projeto pode
 * fazer é desligar um GRUPO inteiro para si: um projeto de estudo sem rotas,
 * um repositório de terceiro onde as regras de entrega não fazem sentido.
 * Nome e recorte são o vocabulário dele, não o meu: comunicação (como eu falo
 * com ele), entrega (o que cobra prova e backlog), código (o que protege o
 * repositório) e rotas (o trabalho em paralelo).
 */
export const MODULOS = {
  comunicacao: { label: 'comunicação', explica: 'como eu respondo: tamanho, jargão, separador de resumo, pergunta no lugar certo' },
  entrega: { label: 'entrega', explica: 'o que cobra prova, backlog anotado e verificação antes de dizer feito' },
  codigo: { label: 'código', explica: 'o que protege o repositório: commit só com pedido, edição que falha em voz alta, texto público limpo' },
  rotas: { label: 'rotas', explica: 'o trabalho em paralelo: cada agente na sua rota, recados entre eles' },
}

export const HOOKS = [
  {
    id: 'estilo-inicio',
    modulo: 'comunicacao',
    nivel: 'injeta',
    label: 'Padrão de resposta do Felipe',
    script: 'estilo-inicio.mjs',
    evento: 'SessionStart',
    descricao: 'Injeta o padrão de resposta no início de TODA sessão, em '
      + 'qualquer projeto, com o framework ligado ou desligado. Não é gate: '
      + 'hook bloqueia ferramenta, não prosa. O texto fica em '
      + '~/.claude/control-center-estilo.md e é editável.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'estilo-fim',
    modulo: 'comunicacao',
    nivel: 'mede',
    label: 'Padrão de resposta — mede sem reclamar',
    script: 'estilo-fim.mjs',
    evento: 'Stop',
    descricao: 'Mede tamanho e parágrafos de autodefesa da resposta que acabou '
      + 'de sair. Nunca bloqueia e nunca fala na tela: aviso a cada resposta '
      + 'seria a linha a mais que o padrão existe para cortar. Vira tendência '
      + 'no painel (cc estilo).',
    padrao: true,
    implementado: true,
  },
  {
    id: 'travessao-guard',
    modulo: 'codigo',
    nivel: 'trava',
    label: 'travessão na resposta ou no arquivo',
    script: 'travessao-guard.mjs',
    evento: 'Stop',
    tambemEm: ['PreToolUse:Write', 'PreToolUse:Edit'],
    descricao: 'A regra número 1 dele, escrita há meses e sem ninguém cobrando: '
      + '279 travessões medidos num dia só. Cobre a resposta no chat e o texto '
      + 'que vai para arquivo PÚBLICO (interface, página, README). Comentário de '
      + 'código e documentação interna são livres, decisão dele em 16/08.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'forma-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'A forma que ele nomeou tem que estar na entrega',
    script: 'forma-guard.mjs',
    evento: 'Stop',
    descricao: 'Ele nomeia a forma (tabela, card, lista, coluna) e a entrega '
      + 'tem que falar da mesma. Barra quando a entrega ignora a palavra dele, '
      + 'e barra mais forte quando fala de outra forma no lugar. A extração é '
      + 'automática, de um vocabulário fechado: não depende de eu listar nada, '
      + 'que era o ponto fraco da ideia original.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'referencia-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'Pediu igual ao que já existe: mostrar o par',
    script: 'referencia-guard.mjs',
    evento: 'Stop',
    descricao: 'Quando ele aponta uma referência que já existe ("igual ao que '
      + 'já temos", "nós já usamos"), a entrega não fecha sem o original e o '
      + 'novo lado a lado. A trava não julga se ficou igual, de propósito: quem '
      + 'compara é ele. Mandar arquivo é chamada de ferramenta, então está no '
      + 'transcrito ou não está; prosa não conta.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'desvio-guard',
    modulo: 'entrega',
    nivel: 'trava',
    label: 'Decisão contra o pedido, escondida no código',
    script: 'desvio-guard.mjs',
    evento: 'PreToolUse',
    descricao: 'Recusa a edição que justifica, dentro do arquivo, trocar o que '
      + 'ele pediu por outra coisa. O discriminador é um CRUZAMENTO medido: a '
      + 'frase de desvio na mesma sentença que um termo do pedido dele. Frase '
      + 'sozinha não barra, porque "em vez de" aparece 92 vezes em comentário '
      + 'legítimo. Nasceu da tabela que virou blocos no telefone em 17/08.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'tarefa-vaga-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'Tarefa escrita em telegrama',
    script: 'tarefa-vaga-guard.mjs',
    evento: 'Stop',
    descricao: 'CC-126, queixa dele em 17/08: "os cards nunca fazem sentido, o '
      + 'texto é algo vago como profissão escolhe quem entra". Tarefa sem artigo '
      + 'nem preposição perde sujeito e objeto. O discriminador saiu de medição: '
      + 'tamanho NÃO separa (mediana de 9 palavras, a vaga tem 4); ausência de '
      + 'palavra de ligação separa, e acusou exatamente a que ele citou.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'enfileirada-guard',
    modulo: 'comunicacao',
    nivel: 'avisa',
    label: 'Mensagem dele que sumiu da fila',
    script: 'enfileirada-guard.mjs',
    evento: 'Stop',
    descricao: 'CC-118: ele digita enquanto eu trabalho, e às vezes o texto sai '
      + 'da fila sem virar mensagem ("o texto simplesmente some"). O registro '
      + 'guarda o texto. A trava exige que eu CITE o que ele escreveu, porque a '
      + 'minha resposta é uma mensagem e sobrevive: citando, o pedido dele entra '
      + 'no histórico pela minha boca. Medidas 34 nesta sessão.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'fila-guard',
    modulo: 'comunicacao',
    nivel: 'avisa',
    label: 'Pausa diz o que ficou na fila',
    script: 'fila-guard.mjs',
    evento: 'Stop',
    descricao: 'CC-117, pedido dele em 17/08: "qdo eu te peço mil coisas e '
      + 'voce pausa no meio eu não sei quanto você implementou". Pausa de '
      + 'entrega (com separador) com tarefa aberta no cartão precisa dizer o '
      + 'que ficou: na fila, em curso ou esperando. Não casa item a item de '
      + 'propósito: foi o que gerou falso positivo três vezes no separador.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'resumo-guard',
    modulo: 'comunicacao',
    nivel: 'avisa',
    label: 'resposta longa sem o separador',
    script: 'resumo-guard.mjs',
    evento: 'Stop',
    descricao: 'Passou de 3 parágrafos sem a linha de separação antes do que ele '
      + 'decide, devolve. Nasceu porque implementei o separador e não usei na '
      + 'resposta seguinte, deixando a verificação só medindo.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'teto-guard',
    modulo: 'comunicacao',
    nivel: 'avisa',
    label: 'entregou demais sem ele ver',
    script: 'teto-guard.mjs',
    evento: 'Stop',
    descricao: 'Mais de 2 tarefas fechadas desde a última mensagem dele, o turno '
      + 'não encerra sem mostrar. Velocidade sem conferência é dívida: cada entrega '
      + 'que ele não acompanhou vira surpresa quando quebrar.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'medir-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'agiu na descrição dele sem medir',
    script: 'medir-guard.mjs',
    evento: 'Stop',
    descricao: 'Ele descreveu um sintoma e o agente mexeu sem medir nada antes? '
      + 'Devolve. A metáfora dele aponta o rumo, não a causa: "os nomes dançam" '
      + 'era regra de estilo duplicada, não alinhamento.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'descida-guard',
    modulo: 'comunicacao',
    nivel: 'avisa',
    label: 'reprovou e refez no mesmo nível',
    script: 'descida-guard.mjs',
    evento: 'Stop',
    descricao: 'Ele reprovou e o agente refez sem quebrar em partes menores? '
      + 'Devolve. Regra dele: negativa não significa tentar melhor, significa '
      + 'tentar menor. Em 16/08 o design foi reprovado 2x e refeito inteiro as '
      + 'duas, sem descer nenhum degrau de abstração.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'visual-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'mexeu no visual e não olhou',
    script: 'visual-guard.mjs',
    evento: 'Stop',
    descricao: 'Editou tela e não abriu nenhuma imagem no turno? Devolve. Nasceu '
      + 'de uma tela conferida só em 390px e entregue: no monitor ela estava '
      + 'horrível, e eu não tinha olhado o monitor.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'jargao-guard',
    modulo: 'comunicacao',
    nivel: 'avisa',
    label: 'nome interno na conversa',
    script: 'jargao-guard.mjs',
    evento: 'Stop',
    descricao: 'Mais de dois nomes internos (hook, arquivo, campo, número de tarefa) '
      + 'na prosa devolve. O problema não é o tamanho da resposta, é a memória que '
      + 'ela exige dele. Bloco de código não conta.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'pronto-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'tarefa fechada sem prova',
    script: 'pronto-guard.mjs',
    evento: 'Stop',
    descricao: 'To-do que passou a done neste turno sem `--prova` devolve uma vez. '
      + 'Prova é o que foi rodado e o que apareceu, não a intenção — sem ela, '
      + '"feito" é opinião do agente, que é o que ele mais teme.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'reporte-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'trabalhou e não reportou no painel',
    script: 'reporte-guard.mjs',
    evento: 'Stop',
    descricao: 'Mexeu em código ou no ROADMAP e o meta.json está sem subject, '
      + 'frente ou to-dos? Devolve. O `cc-check` cobra to-do ABERTO e deixava '
      + 'lista vazia passar como entrega limpa — ausência de registro e trabalho '
      + 'terminado tinham a mesma cara.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'anonimo-prompt',
    modulo: 'comunicacao',
    nivel: 'trava',
    label: 'dado pessoal colado no chat',
    script: 'anonimo-prompt.mjs',
    evento: 'UserPromptSubmit',
    descricao: 'Com o modo de anonimização ligado, recusa o envio de texto longo '
      + 'que traga CPF, nome ou e-mail. Fecha o buraco do CC-92 sem proxy: roda '
      + 'antes de o prompt sair, na máquina dele, sem TLS nem ponto único de falha.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'anonimo-guard',
    modulo: 'comunicacao',
    nivel: 'trava',
    label: 'arquivo com dado pessoal lido em claro',
    script: 'anonimo-guard.mjs',
    evento: 'PreToolUse',
    matcher: 'Read',
    descricao: 'F12 do framework. Com o modo de anonimização ligado, troca o caminho '
      + 'do arquivo pela cópia MASCARADA antes da leitura: a IA lê "<PESSOA_1> paga a '
      + '<EMPRESA_2>" e o nome real nunca entra no contexto. Ao contrário dos outros, '
      + 'falha FECHADA: se o mascaramento quebrar, a leitura é bloqueada, porque dado '
      + 'pessoal que vazou não tem desfazer. Pedido dele em 15/08: "eu subo muitos '
      + 'arquivos, isso tem que acontecer em qualquer arquivo que eu subir".',
    padrao: true,
    implementado: true,
  },
  {
    id: 'bancada-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'a tarefa não se auto-verificou',
    script: 'bancada-guard.mjs',
    evento: 'Stop',
    descricao: 'Editou código e a Bancada do nível declarado do projeto não rodou '
      + 'depois? Devolve uma vez. O `npm test` responde "quebrei alguma coisa?"; a '
      + 'Bancada responde "deixei alguma coisa insegura?" — e suíte verde convive '
      + 'com chave commitada e tabela sem proteção.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'commit-guard',
    modulo: 'codigo',
    nivel: 'trava',
    label: 'commit sem ele ter pedido',
    script: 'commit-guard.mjs',
    evento: 'PreToolUse',
    matcher: 'Bash',
    descricao: 'Regra dele escrita há meses: "nunca commitar sem que eu peça '
      + 'explicitamente". Em 16/08 foram 15 commits e um pedido. O hook lê a '
      + 'última mensagem dele e procura a autorização — add, status e diff '
      + 'continuam livres, porque preparar não é atravessar.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'branch-guard',
    modulo: 'codigo',
    nivel: 'trava',
    label: 'comando git que apaga trabalho alheio',
    script: 'branch-guard.mjs',
    evento: 'PreToolUse',
    matcher: 'Bash',
    descricao: 'Barra `git checkout`/`switch` com arquivo pendente, `reset --hard`, '
      + '`clean -f`, remoção de oficina com trabalho dentro e `branch -D` de branch '
      + 'em uso. O git guarda uma cópia por pasta: trocar de branch reescreve o '
      + 'disco debaixo de quem estiver editando ali.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'gate-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'código editado sem rodar o gate',
    script: 'gate-guard.mjs',
    evento: 'Stop',
    descricao: 'Se o turno editou código e o `npm test` não rodou DEPOIS da última '
      + 'edição, devolve uma vez. Rodar antes de mexer dá verde de um estado que '
      + 'não existe mais — foi assim que a regressão do 4f78264 ficou escondida.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'edicao-guard',
    modulo: 'codigo',
    nivel: 'trava',
    label: 'edição de arquivo por script de shell',
    script: 'edicao-guard.mjs',
    evento: 'PreToolUse',
    matcher: 'Bash',
    descricao: 'Barra `sed -i`, `perl -i` e `open(f, "w")` em arquivo do repositório. '
      + 'O Edit RECUSA quando a string não bate; o script não acha, não troca e sai '
      + 'com código 0 — só um dos dois consegue avisar. /tmp continua livre.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'roadmap-guard',
    modulo: 'codigo',
    nivel: 'avisa',
    label: 'concluído parado no ROADMAP',
    script: 'roadmap-guard.mjs',
    evento: 'Stop',
    descricao: 'Avisa quando há item já concluído ocupando o ROADMAP, que deveria '
      + 'ter virado linha no diário. Estava no settings.json e rodava CALADO desde '
      + 'que nasceu, por não constar aqui — hookEnabled() devolve false para id '
      + 'desconhecido, e o hook sai achando que está desligado.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'diario-guard',
    modulo: 'codigo',
    nivel: 'avisa',
    label: 'código mexido sem passar pelo diário',
    script: 'diario-guard.mjs',
    evento: 'Stop',
    descricao: 'Pedido do Felipe em 18/08, depois de perguntar se os consertos ficam '
      + 'anotados em algum lugar: avisa quando o turno editou arquivo fora de docs/ e '
      + 'o diário de hoje não foi tocado. Não distingue conserto de funcionalidade — a '
      + 'convenção do projeto já pede diário pros dois.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'sincronia-guard',
    modulo: 'codigo',
    nivel: 'avisa',
    label: 'a outra máquina não vê o que está aqui',
    script: 'sincronia-guard.mjs',
    evento: 'Stop',
    descricao: 'Regra dele ao desenhar a federação em 18/08: "sempre usando o git como '
      + 'segurança, e sempre mantendo o commit antes de migrar de dispositivos". Avisa '
      + 'quando há arquivo sem commit, commit sem push, ou commit no remoto que esta '
      + 'máquina não puxou. Nunca commita nem manda commitar, e não usa rede: lê o que '
      + 'o último fetch deixou em disco.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'fluxo-guard',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'parou com backlog aberto',
    script: 'fluxo-guard.mjs',
    evento: 'Stop',
    descricao: 'No modo restritivo, com item aberto no ROADMAP, parar precisa '
      + 'ser declarado: "Parada: <motivo>", AskUserQuestion, ou uma pergunta dele. '
      + 'Fora disso o hook devolve com os próximos itens da fila.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'guia-guard',
    modulo: 'comunicacao',
    nivel: 'avisa',
    label: 'guia longo numa mensagem só',
    script: 'guia-guard.mjs',
    evento: 'Stop',
    descricao: 'A partir de 3 passos de interface numa resposta, exige o formato '
      + 'de etapa: total anunciado, âncora absoluta, critério de sucesso e parada '
      + 'declarada. Âncora errada no passo 1 perde a mensagem inteira (CC-93).',
    padrao: true,
    implementado: true,
  },
  {
    id: 'pergunta-guard',
    modulo: 'comunicacao',
    nivel: 'avisa',
    label: 'pergunta decisiva vai na caixa, não em prosa',
    script: 'pergunta-guard.mjs',
    evento: 'Stop',
    descricao: 'Se a resposta TERMINA perguntando algo que muda o que será '
      + 'feito, devolve uma vez pedindo para refazer no AskUserQuestion. Não '
      + 'obriga a perguntar — só o formato. Uma volta por turno.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'recados',
    modulo: 'rotas',
    nivel: 'trava',
    label: 'Método Routia — agentes do mesmo projeto se falando',
    script: 'recados.mjs',
    evento: 'PreToolUse',
    descricao: 'Entrega recado de outro agente na PRÓXIMA ferramenta, não no '
      + 'fim do turno. Interrompe uma vez por recado e libera. Falha aberta: '
      + 'roda em toda chamada de todos os agentes.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'rota-guard',
    modulo: 'rotas',
    nivel: 'trava',
    label: 'Método Routia — trava edição sem rota',
    script: 'rota-guard.mjs',
    evento: 'PreToolUse',
    descricao: 'Bloqueia Edit/Write/MultiEdit/NotebookEdit em projeto com '
      + 'docs/ROTAS-ATIVAS.md quando a rota é de outra sessão.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'git-add-guard',
    modulo: 'codigo',
    nivel: 'trava',
    label: 'Método Routia — trava git add em massa',
    script: 'git-add-guard.mjs',
    evento: 'PreToolUse',
    descricao: 'Bloqueia "git add ."/"-A"/"-u" e "commit -a" em projeto com '
      + 'docs/ROTAS-ATIVAS.md — evita levar mudança de rota alheia junto.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'cc-check',
    modulo: 'entrega',
    nivel: 'avisa',
    label: 'to-do aberto trava a entrega',
    script: null,
    registradoVia: 'todo-guard.mjs',
    evento: 'Stop',
    descricao: 'Avisa (e faz o agente continuar) quando o status diz '
      + '"entregue" mas ainda tem to-do aberto no meta.json.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'routia-inicio',
    modulo: 'rotas',
    nivel: 'injeta',
    label: 'Método Routia — mostra o quadro ao abrir sessão',
    script: 'routia-inicio.mjs',
    evento: 'SessionStart',
    descricao: 'Injeta o resumo de docs/ROTAS-ATIVAS.md no início da sessão, '
      + 'sem depender do agente lembrar de ler.',
    padrao: true,
    implementado: true,
  },
  {
    id: 'routia-fim',
    modulo: 'rotas',
    nivel: 'avisa',
    label: 'Método Routia — lembra de liberar a rota',
    script: 'routia-fim.mjs',
    evento: 'Stop',
    descricao: 'Lembra (sem bloquear, sem editar sozinho) quando a sessão '
      + 'termina com uma rota 🔴 ainda marcada no seu nome — mas só fala se '
      + 'o Control Center confirmar outro agente de verdade ativo no '
      + 'projeto; sozinho, fica quieto.',
    padrao: true,
    implementado: true,
  },
]

export const hookDe = (id) => HOOKS.find((h) => h.id === id) || null
