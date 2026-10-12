/**
 * CC-1047, ele em 11/10 ao ver a aba Hooks: "eu queria que avisasse o que o hook faz". A frase por tipo ("confere a
 * resposta e devolve com um aviso") era a mesma para 28 hooks e não dizia nada. Aqui, um por um: O QUE ele confere,
 * em português de quem não programa, e o que acontece quando dispara. Resumido do catálogo de travas
 * (src/hooksCatalogo.mjs), que guarda o histórico técnico de cada um.
 */
export const EXPLICA = {
  // ===== ao fim de cada resposta do Claude (rodam juntos) =====
  'quadro-guard': 'Confere se TODO projeto do disco aparece no mapa do painel. Se algum sumiu, avisa o Claude, para nenhum projeto ficar esquecido sem você perceber.',
  'travessao-guard': 'Procura travessão (o traço longo) na resposta e no texto que vai para tela ou site. Achou, o Claude troca por vírgula, ponto ou dois pontos.',
  'forma-guard': 'Quando você pede uma forma (tabela, card, lista, coluna), confere se a entrega fala dela. Se o Claude entregou outra forma, ele volta e explica ou corrige.',
  'referencia-guard': 'Quando você pede "igual ao que já existe", obriga o Claude a mostrar o original e o novo lado a lado, para você comparar.',
  'tarefa-vaga-guard': 'Confere se as tarefas que o Claude escreve são frases inteiras. Tarefa em telegrama ("profissão escolhe quem entra") volta para ser reescrita.',
  'enfileirada-guard': 'Se você digitou enquanto o Claude trabalhava e a mensagem sumiu da fila, obriga o Claude a citá-la, para o seu pedido não se perder.',
  'fila-guard': 'Quando o Claude pausa no meio de vários pedidos, obriga a dizer o que ficou: feito, em curso ou na fila.',
  'resumo-guard': 'Resposta longa precisa da linha "// resumo //" antes do que você decide. Sem ela, o Claude refaz.',
  'copiar-guard': 'Comando para você colar no terminal tem que vir sozinho no bloco, sem a explicação dentro (ela quebraria o comando ao colar).',
  'teto-guard': 'Se o Claude fechou mais de 2 tarefas desde a sua última mensagem, ele para e mostra o que fez antes de continuar.',
  'medir-guard': 'Se você descreveu um problema e o Claude mexeu sem medir antes, ele volta para medir. A sua descrição aponta o rumo, não a causa.',
  'descida-guard': 'Se você reprovou algo e o Claude refez tudo igual, ele volta para quebrar em partes menores, em vez de tentar de novo do mesmo jeito.',
  'visual-guard': 'Se o Claude mexeu numa tela e não olhou nenhuma imagem dela, ele volta para olhar antes de dizer que terminou.',
  'onde-guard': 'Se o Claude anuncia algo que passou a valer, obriga a dizer ONDE ficou (só nesta conversa, no projeto, ou em toda sessão), para você saber se vale nas outras.',
  'fala-guard': 'Se o Claude conta o caminho da investigação ("não era o que eu pensava", "erro meu"), ele refaz dizendo só o fato e a causa.',
  'jargao-guard': 'Se a resposta tem nome interno (de arquivo, de trava, número de tarefa) sem explicar, o Claude troca pelo que a coisa faz com você.',
  'ideia-guard': 'Se você mandou uma ideia longa ("e se", "tive uma ideia") e ela não virou item no backlog, o Claude volta para registrar, senão ela some.',
  'pronto-guard': 'Tarefa marcada como feita sem dizer como foi testada volta. "Feito" sem prova é só opinião do Claude.',
  'reporte-guard': 'Se o Claude trabalhou e não anotou no painel o assunto e as tarefas, ele volta para anotar, para o cartão da sessão não ficar vazio.',
  'bancada-guard': 'Se o Claude mexeu em código e não rodou a verificação de segurança do projeto, ele volta para rodar.',
  'gate-guard': 'Se o Claude mexeu em código e não rodou os testes depois da última mudança, ele volta para rodar.',
  'roadmap-guard': 'Avisa quando uma tarefa já concluída continua parada no roadmap, em vez de ter ido para o diário.',
  'diario-guard': 'Avisa quando o Claude mexeu em código e não escreveu nada no diário do dia.',
  'sincronia-guard': 'Avisa quando há mudança sem commit ou sem enviar, porque aí a outra máquina (o PC ou a VPS) não vê o que foi feito aqui.',
  'fluxo-guard': 'No modo mais exigente, o Claude não pode parar com tarefa aberta sem dizer por que parou.',
  'guia-guard': 'Instrução de vários passos de tela para você seguir tem que vir no formato de etapas, com o que você deve ver em cada uma.',
  'pergunta-guard': 'Se a resposta termina com uma pergunta que muda o que será feito, o Claude refaz como caixa de opções, em vez de texto solto.',
  'routia-fim': 'No fim da sessão, lembra de liberar a parte do projeto que esta sessão estava segurando, mas só se houver outra sessão trabalhando ali.',
  'tarefas-fim': 'Se a sessão termina com algo que depende de você e que não está na sua lista de tarefas, o Claude volta para registrar lá.',
  'estilo-fim': 'Só mede o tamanho das respostas, para o painel mostrar a tendência. Não aparece nem impede nada.',
  'todo-guard': 'Lembra o Claude quando ele entrega com tarefa da lista dele ainda aberta.',
  'run-scrum-manager': 'Roda a rotina de organizar o backlog do projeto ao fim do turno (vem do modelo de projeto antigo).',

  // ===== antes de o Claude usar uma ferramenta =====
  'edicao-guard': 'Antes de o Claude mexer num arquivo: recusa se não houver tarefa sua andando hoje no projeto, e recusa editar arquivo por comando cego, que troca sem avisar se errar.',
  'desvio-guard': 'Recusa a edição em que o Claude escreve no próprio código que trocou o que você pediu por outra coisa.',
  'commit-guard': 'Recusa commit quando você não pediu um. Preparar (ver o que mudou) continua livre.',
  'branch-guard': 'Recusa comando do git que apagaria trabalho de outra sessão (trocar de branch com arquivo pendente, apagar mudanças).',
  'modelo-guard': 'Recusa chamar um ajudante num modelo diferente do que a tarefa pede, para não gastar a mais nem fazer com modelo fraco.',
  'recados': 'Entrega ao Claude os recados de outras sessões do mesmo projeto, na hora, antes da próxima ação.',
  'rota-guard': 'Recusa editar uma parte do projeto que outra sessão está usando agora, para as duas não pisarem uma na outra.',
  'git-add-guard': 'Recusa "adicionar tudo" no git, que levaria junto o trabalho de outra sessão.',
  'framework-guard': 'Recusa escrever código quando a fase do projeto ainda pede outra coisa antes (definir o objetivo, rodar a verificação).',
  'quebra-guard': 'Antes de renomear ou apagar muitas pastas, exige ver primeiro o que depende delas.',
  'segredo-guard': 'Impede o Claude de ler ou escrever arquivo que guarda senha e chave.',
  'permissao-painel': 'Nas conversas do Coderoom, pede a sua aprovação no painel antes de cada comando ou edição.',

  'anonimo-guard': 'Com a anonimização ligada, quando o Claude vai ler um arquivo com dado pessoal, troca nomes, CPFs e e-mails antes de ele ver.',

  // ===== quando você manda uma mensagem =====
  'modelo-lembrete': 'Quando a sessão está num modelo diferente do que a tarefa pede, o Claude pergunta a você numa caixa se troca de modelo. Uma vez por tarefa.',
  'anonimo-prompt': 'Com a anonimização ligada, recusa enviar texto longo com CPF, nome ou e-mail.',

  // ===== quando a conversa abre =====
  'estilo-inicio': 'Põe no começo de toda conversa o seu jeito de receber resposta (curta, com resumo, sem jargão).',
  'tarefas-inicio': 'Mostra ao Claude, ao abrir, as suas tarefas pendentes, para ele citar as que tocam o trabalho do dia.',
  'routia-inicio': 'Mostra ao Claude, ao abrir, quais partes do projeto outras sessões estão usando.',
  'maquina-inicio': 'Uma vez por dia, confere se as travas que o painel exige estão ligadas nesta máquina, e avisa se faltar alguma.',
  'framework-inicio': 'Ao abrir, diz ao Claude em que fase o projeto está, com que tom falar e qual a próxima pergunta a fazer para você.',
  'inject-claude-md': 'Põe as regras do projeto no começo da conversa (vem de um plugin).',
  'session-start-profiler': 'Só mede quanto a abertura da conversa demora (vem de um plugin).',
  'check-version': 'Confere se um plugin instalado está na versão nova (vem do plugin).',
  'claude-hook': 'Avisa o escritório de bonecos (Pixel Agents) do que o Claude está fazendo, para a tela dele andar.',
  'mode...': 'Do plugin de estilo de resposta (o modo curto): liga esse jeito de falar no começo da conversa.',
  '?': 'O Claude Code gravou este hook sem dizer qual comando era, então não dá para saber qual é.',
}
