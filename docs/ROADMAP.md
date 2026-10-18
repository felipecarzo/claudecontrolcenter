<!-- GERADO por src/backlog.mjs a partir de docs/backlog.jsonl.
     NÃO EDITE ESTE ARQUIVO: a fonte é o .jsonl, e o que você escrever aqui
     some na próxima geração. Para mexer: `cc backlog`. -->

# ROADMAP — o que está aberto neste projeto

154 abertos, 894 fechados, 1048 no total. Gerado em 2026-10-18.

## ⚠️ Travados, com a causa medida

- **CC-564** responder pelo painel as perguntas das sessoes do PC: medir se um gancho na pergunta entrega a resposta, sem depender de tela — teste interativo recusado pelo classificador de permissao; precisa ele autorizar a sessao de teste no tmux
- **CC-978** Cartão da conversa do Coderoom mostra o checklist do próprio agente (o agy hoje não grava o texto das tarefas) — 11/10: nao ha onde ler. O agy (Antigravity) nao deixa o checklist dele em arquivo que o painel alcance: ~/.gemini/antigravity/conversations esta vazia, brain/<id>/.system_generated/tasks guarda a SAIDA de comandos (task-N.log), e nao ha task.md nas 537 conversas. O Coderoom so grava a fala dele e a do agente. Para mostrar o checklist seria preciso o agy expor as tarefas por uma ferramenta que o painel injete (como o opencode tem o mcp painel), ou engenharia reversa do formato interno. Decisao dele.

## travas

| id | estado | peso | o que é |
|---|---|---|---|
| CC-294 | definida | 3 | a amostra julgada: 30 devoluções lidas lado a lado |
| CC-917 | prova | - | trava: resposta que deixa ideia longa dele só no texto, sem item no backlog, é barrada uma vez |
| CC-960 | andando · 6 de 7 | - | trocar modelo e esforco sozinho pela complexidade da tarefa, com regras reais em todos os projetos |
| CC-1050 | prova | - | aviso de abertura das partes ocupadas poe 15 mil tokens em cada conversa, o maior gasto dos hooks |
| CC-1056 | prova | - | regras de escrita unificadas numa fonte so, com a regra nova defina antes de concluir, e os outros lugares apontando para ela |
| CC-1059 | definida | - | aviso 'projetos sairam do quadro' dispara para pasta renomeada (videolab virou medialab em 08/10) |

## projetos

| id | estado | peso | o que é |
|---|---|---|---|
| CC-317 | definida | 3 | criar projeto no PC e na VPS pelo mesmo caminho |
| CC-832 | definida | - | Padrão de projeto: micro tarefa como filha do item no backlog, projeto novo nasce no padrão, migrar todos os projetos |
| CC-874 | prova | - | instalar dependencias em ibrics, inovallbond, overwatch e frontend do profinance para a conferencia rodar |
| CC-896 | prova · 0 de 1 | - | zona de caminho do projeto: backlog como trilha animada com o feito, onde estamos e os marcos |
| CC-966 | prova | - | celular sem barra inferior: menu hamburguer no topo com barra lateral (ajustes de letra e tema dentro), topo enxuto como o Coderoom |
| CC-969 | ideia | - | aplicativo de Android do painel: so quando houver algo que o app instalado pelo Chrome nao faca (widget, atalho de voz) |
| CC-984 | prova | - | Medir no Conta de Casa quanto o opencode economizou contra o limite semanal e mensal do Claude, e provar que o app funciona |
| CC-985 | prova | - | Guia de cada projeto: diz se é teste ou não e, nos de teste, o que comparar no fim (tokens gastos, economia contra o Claude) |
| CC-1006 | definida | - | classificar os demais projetos no guia: producao, pessoal ou teste (linha Natureza no AGENTS.md) |
| CC-1014 | prova | - | atalho de teclado que abre um painel flutuante de nova ideia, em qualquer tela, como o da busca, usavel so com teclado |
| CC-1018 | prova | - | atalhos de teclado por pagina, com manual de atalhos de cada pagina (tecla ? abre) |
| CC-1019 | prova | - | atalhos do Caminho: setas andam nos sprints, Espaco abre, Ctrl+Shift+P troca projeto, Ctrl+Shift+Alt+Espaco busca tarefa |
| CC-1020 | prova | - | atalhos de Sessoes: visualizacao, filtros, trocar projeto e abas pelo teclado |
| CC-1022 | prova | - | botao de flutuar qualquer cartao ou caixa de texto, como janela pip, enquanto mexe no resto do painel |

## cockpit

| id | estado | peso | o que é |
|---|---|---|---|
| CC-496 | definida | - | so quero que as informacoes redundantes sumam e as importantes sejam organizadas de forma correta; coisa que eu veja pouco mas bem organizada pode ser util; o problema e coisa pouco util no dia a dia virar ruido no meio do importante cockpit 2 |
| CC-539 | prova | - | framework so reconhece projeto com pasta ja marcada; ideia dele: projeto nasce no framework, pastas no PC/VPS vem depois, sincronizadas |
| CC-557 | prova | - | cockpit novo: uma engenharia tipo SDD que deixa o agente decidir e fazer sozinho o que nao depende de mim |
| CC-558 | andando | - | cockpit novo: uma area de construcao de design para os projetos |
| CC-559 | prova | - | cockpit novo: notas continua importante, mas o app de notas precisa melhorar |
| CC-562 | prova | - | estudar o JEV (modelo barato de decisao sim/nao e nota) para rodar num modelo barato ou no Gemini pelo agy, nao aqui |
| CC-564 | travado | - | responder pelo painel as perguntas das sessoes do PC: medir se um gancho na pergunta entrega a resposta, sem depender de tela |
| CC-581 | definida | - | visao: area onde a IA pede prazo dos projetos, alinha expectativas, debate prazos e gera o foco do dia |
| CC-655 | prova · 1 de 1 | - | design 2/4: telas e prototipos por projeto, com versoes, e ele aprova qual vira codigo |
| CC-656 | prova | - | design 3/4: mural de referencias por projeto (prints, sites de inspiracao, feedback) para mostrar ao agente quero assim |
| CC-657 | prova | - | design 4/4: comparar versoes de uma tela lado a lado (antes e depois, 390 e 1536) e aprovar ou pedir ajuste dali |
| CC-658 | prova · 1 de 1 | - | design 1b: ajustar a identidade pelo painel (cores, fontes, regras), gravando no arquivo de design do projeto |
| CC-659 | andando | - | passada no painel inteiro: extrair os padroes das telas ja refeitas e aplicar ao resto, juntando e apagando telas |
| CC-732 | definida | - | Sessoes do PC ficam presas e nao atualizam no Cockpit da VPS |
| CC-734 | prova | - | Sessoes do PC que nem aparecem no Cockpit da VPS |
| CC-753 | definida | - | Instalavel unico do Cockpit para Windows: executa, vira servico automatico e pega os projetos da maquina, sem repositorio nem programar nela |
| CC-765 | prova | - | Widescreen de Sessoes: paineis como os do Coderoom, reordenaveis, com adicionar e recolocar; talvez duas sessoes lado a lado |
| CC-769 | definida | - | Botao no cartao leva ao desktop do projeto no PC via a controladora; popup em cada desktop volta ao Cockpit, que vira a central |
| CC-795 | prova | - | Coderoom: com o menu de tres pontos aberto, os controles vao para o meio do cabecalho e as fichas (estado, maquina, agentes) somem |
| CC-856 | prova | - | Dez rotas só do painel antigo sem tela no cockpit novo: ligar cada uma ou tirar do servidor |
| CC-865 | prova | - | o painel passa a se chamar Ogumia na tela e no guia, mantendo os nomes internos |
| CC-879 | prova | - | Sessoes: cada conversa do Coderoom vira UM card responsivo com suas tarefas e o resumo do agy, sem agrupar 21 sessoes paradas num card so |
| CC-883 | prova | - | tela própria Tarefas no menu, com pedido, pedidos, tarefas por projeto e gaveta; a aba da Início continua |
| CC-893 | prova | - | card de conversa do Coderoom na tela Sessoes ganha botao arquivar (com desfazer): hoje so tem renomear e abrir sessao |
| CC-895 | definida | - | endereco no testedevoo para app simples de Node (como o Conta de Casa): o dev.sh nao tem esse tipo e o roteador exige o prefixo |
| CC-906 | prova · 1 de 6 | - | Tinder like fixo no cockpit: decidir tudo por cartões, uma mão, sem digitar, em Sessões inteira ou num projeto só |
| CC-936 | andando | - | aba Tarefas mostra o que foi feito, o que está em prova e o que vem, cada item com a explicação na língua dele |
| CC-957 | prova | - | sessao parada ha dias aparece como parou ou espera voce: separar como esquecida (3+ dias) e alertar no sino as que ocupam memoria |
| CC-972 | prova | - | dado principal do painel leva de 2 a 8 s para sair do servidor; medir o que pesa e cortar |
| CC-982 | prova | - | sessao recem aberta tem campo de escrever obrigatorio, com audio e chamar skill; campo com skill e audio vira padrao em todo chat do cockpit |
| CC-983 | prova | - | resumo do agy por nivel: ate a minha ultima pergunta, cada nivel sobe mais uma mensagem minha; mensagens seguidas contam como uma |
| CC-986 | prova | - | area de ideias no Caminho: ditar ou escrever a ideia, a IA quebra em tarefas, pergunta o lugar na fila e grava no backlog |
| CC-987 | prova | - | cada aba do painel (Caminho, Sessoes e as outras) instalavel como app separado no celular |
| CC-988 | prova | - | barra lateral direita (responder sessoes) com largura ajustavel arrastando a borda, igual a esquerda |
| CC-990 | prova | - | o A+ e A- do tamanho da letra nao mudam o texto da barra lateral direita |
| CC-992 | prova | - | busca do topo vira lupa tambem no desktop, igual ao celular |
| CC-993 | prova | - | regra de design: nada fino e comprido na pagina, salvo separador ou banner especifico |
| CC-994 | prova | - | entrada do Decidir um por um deixa de ser faixa larga e fina |
| CC-995 | prova | - | redesenho do cartao do tinderlike (Decidir um por um) |
| CC-996 | prova | - | aprovar telas de design e fotos dos projetos pelo Decidir um por um (tinderlike) |
| CC-997 | prova | - | bloquear selecao de texto no painel, com botao no topo que libera copiar |
| CC-998 | prova | - | filtros do tinder rolam na horizontal com a roda do mouse no PC, com barra visivel |
| CC-999 | prova | - | Tinder nao apaga barras laterais nem o topo; so cobre a area de conteudo |
| CC-1000 | prova | - | letra do cartao do Tinder segue o A+ e A- |
| CC-1001 | prova | - | zoom alto quebra o layout: A+ precisa caber ou travar |
| CC-1002 | prova | - | A- e A+ dentro do Tinder, visiveis no celular |
| CC-1003 | prova | - | triagem das provas acumuladas: importancia real, verificar se ja foi feita, e fluxo no tempo certo |
| CC-1007 | prova | - | codigos de tarefa (CC-985) em destaque no painel do sprint, com busca e ordem por numero |
| CC-1008 | prova | - | responder o chat inteiro pelo painel, como o proprio Claude Code (viabilidade e custo) |
| CC-1009 | prova | - | busca abre com Ctrl+Espaco e ja com o cursor dentro |
| CC-1010 | prova | - | busca de tarefa no sprint com desenho quebrado (microfone por cima, botao cortado) |
| CC-1011 | prova | - | caixa de nova ideia no Caminho vira botao colapsado |
| CC-1012 | prova | - | gaveta de tarefas do Caminho vira painel encaixado: nao cobre a barra da direita, e a estrada se reorganiza com animacao |
| CC-1013 | prova | - | regras de design: barras laterais sao a parte mecanica sempre por cima; painel de detalhe encaixa e reduz a area; ideia/entrada colapsada |
| CC-1015 | prova | - | gaveta do Caminho ocupa a altura toda e os botoes do topo vao para o lado dela, na linha do titulo |
| CC-1016 | prova | - | gaveta do sprint abre duas vezes na animacao |
| CC-1017 | prova | - | nova ideia por atalho abre no projeto do que esta selecionado na tela (sessao, projeto, conversa) |
| CC-1021 | prova | - | digitar com o cursor num campo fora da vista rola a tela ate o campo |
| CC-1023 | prova | - | trocar 'o raciocinio' por 'como cheguei la' no estilo de toda sessao e no gancho do separador (suspeita do aviso reasoning extraction) |
| CC-1031 | definida | - | painel: primeira leitura depois de religar leva 34 a 39 s, e a montagem por tras gasta 1,3 a 2 s em terminais e conversas |
| CC-1032 | definida | - | Skill /framework que escolhe e troca sozinha o modo do framework ideal para a tarefa do momento |
| CC-1033 | prova | - | gerador de cartas de aprovacao a partir do endereco de um app: prints e texto de cada tela viram baralho do Tinder |
| CC-1034 | prova | - | regra de produto: tudo que criamos para os projetos vira ferramenta no painel, nao script solto |
| CC-1035 | prova | - | carta do Tinder com o texto atual preenchido para editar, em vez de escrever o texto novo na nota |
| CC-1037 | prova | - | skill tinderlike em modo textos: levanta os textos do app, revisao no painel e aplica as edicoes no codigo |
| CC-1038 | prova | - | aba Revisoes no painel: revisoes de textos e telas de todos os projetos, com andamento e botao de aplicar edicoes no codigo |
| CC-1039 | prova | - | cc baralho entra em app com login (formulario ou cookie) e fotografa as telas de dentro |
| CC-1040 | prova | - | conferir um item fecha o backlog mas deixa o ROADMAP velho e reprova a conferencia seguinte |
| CC-1041 | prova | - | terminal real do Claude Code numa aba do painel, atras da senha do painel |
| CC-1042 | prova | - | medir se comandos de barra e skills funcionam no claude -p (modo sem tela) do Coderoom |
| CC-1043 | prova | - | Coderoom com o Claude em paridade com o app: ferramentas, plano, comandos, fila, imagens |
| CC-1044 | prova | - | monitor de hooks no painel: disparos, tempo, barradas e o que cada hook devolveu, por projeto |
| CC-1045 | prova | - | hooks de parada fazem ele esperar 6,4 s por resposta (95 cortes do quadro-guard): achar e cortar o que pesa |
| CC-1046 | prova | - | aba Hooks em portugues claro: o que cada hook faz com ele, colunas explicadas, barrada em frase inteira |
| CC-1047 | andando | - | aba Hooks diz o que CADA hook faz, nao so o tipo |
| CC-1048 | prova | - | aba Hooks diz o que CADA hook faz, nao so o tipo |
| CC-1049 | prova | - | aba Hooks mostra quanto token cada hook poe na conversa (por disparo e total) e periodos de 1, 7, 15, 30 e 60 dias |
| CC-1051 | prova | - | botao terminal do Claude no cartao do projeto da aba Projetos, junto do teste de voo |
| CC-1052 | prova | - | painel a conversa das Sessoes vira o Claude Code em app: comandar a sessao com conversa formatada, perguntas em opcoes, barra e modelo |
| CC-1053 | prova | - | no celular a conversa da sessao abre em tela cheia como o app, minimiza para uma pilula fixa no topo, e a tela nao pula mais para o topo |
| CC-1054 | prova | - | janela Escolher projeto fica parada no alto ao filtrar, e todo atalho que abre busca ja abre com o cursor no campo |
| CC-1055 | prova | - | resposta de pergunta pelo painel chega na sessao mas o painel diz que a sessao nao confirmou |

## framework

| id | estado | peso | o que é |
|---|---|---|---|
| CC-500 | prova | - | URGENTE: transformar o projeto num FRAMEWORK. voltar pra raiz: como funciona a criacao de um projeto, como o framework age no projeto, como o projeto se auto-registra, como o framework identifica esses registros framework |
| CC-501 | definida | - | tarefa nao e linguagem natural: a IA limita a sintese dos raciocinios a termos pre-definidos, mesmo que a lista seja gigante. ex: 'pedido: construcao de sistema - intencao: ~ criar framework pra gerenciar agentes - definicao de pronto: ...'. o ~ marca o que a IA interpreta framework |
| CC-503 | definida | - | projetos ativos e inativos definidos pela intencao do cliente; robos pra vasculhar os sites dos clientes procurando problemas eventuais framework |
| CC-532 | prova | - | regra global: toda mudanca diz onde ficou e para quem vale (CLAUDE.md global, 11/09) |
| CC-533 | definida | - | regra global: trava que me barra nao vira conversa (CLAUDE.md global, 11/09) |
| CC-897 | prova · 3 de 5 | - | sprints no Nisaba: marcos do Caminho viram sprints definidos por código com os critérios do ágil |
| CC-913 | prova | - | o arquiteto traça a rota inteira a partir da definição de produto, não só o próximo passo |
| CC-925 | definida | - | protocolo das perguntas para ele: so pergunta de produto (MVP, PO, backlog); guarda que barra pergunta com foto errada ou repetida |
| CC-926 | prova | - | tudo que esta planejado na sprint (skill de projeto) ja esta aprovado: o agente executa sem perguntar |
| CC-927 | prova | - | sprint deixa explicito os artefatos de engenharia a criar (MER e afins) e isso chega ao agente |
| CC-940 | prova | - | regra geral: projeto inicial nao precisa de login e senha; login so entra quando o projeto ja guarda informacao |
| CC-958 | prova · 5 de 5 | - | fila mista: Caminho como prioridade, e ideia nova entra no lugar escolhido (agora, fim do dia, sprint, backlog, fora do MVP) |
| CC-959 | definida | - | retrospectiva do sprint: tokens gastos contra complexidade resolvida, por frente, para achar desperdicio, desfoco ou demora de revisao |

## sincronia

| id | estado | peso | o que é |
|---|---|---|---|
| CC-548 | definida | - | o Chrome da VPS nao alcanca porta local: a rota do container ate o host esta fechada e abrir exige regra de firewall com root |
| CC-1058 | definida | - | PC fica sincronizado em tempo real com a VPS por um servico, e avisa com alerta se estiver offline |
| CC-1060 | andando | - | sessao do PC controlada pelo Cockpit igual a da VPS: responder por texto e sincronismo imediato |
| CC-1061 | definida | - | npm test quebra no PC: 16 testes falham no Windows, e a corrente para no terceiro, sem rodar o resto |
| CC-1062 | definida | - | religar o painel do PC pode falhar com o painel ocupado e deixar painéis soltos em outras portas |

## coderoom

| id | estado | peso | o que é |
|---|---|---|---|
| CC-741 | definida | - | harness de design no Coderoom: regras de design no contexto do agente e conferencia do resultado apos cada resposta |
| CC-761 | definida | - | segunda simulacao no Coderoom: um sistema inspirado no Pierre, seguindo as regras de design, simulando o Felipe construir |
| CC-802 | definida | - | Simulação 3: o Coderoom cria um jogo ponta a ponta e roda no testedevoo; cada demora ou silêncio do modelo vira trava |
| CC-809 | definida | - | Coderoom: pedido de pasta que é a casa inteira (/home/x/*) mostra aviso de risco no cartão e sugere só o ~/dev.sh |
| CC-814 | definida | - | Coderoom: opencode como servidor vivo pela API (sessão também no terminal), permissão e pergunta ao vivo, compactação nativa |
| CC-820 | definida | - | Simulação 5: o Coderoom cria um jogo 3D de aventura do zero, em projeto novo, no testedevoo |
| CC-828 | definida | - | Coderoom: maestro que divide o pedido em micro tarefas, roda uma a uma no opencode e confere com robô, minimizando IA |
| CC-830 | definida | - | Coderoom: continuar no Coderoom uma tarefa que começou no Claude Code (mesma sessão, outro agente) |
| CC-866 | andando · 2 de 5 | - | agente arquiteto com Haiku: cria projetos pelo Coderoom e pelo framework, tem ideias, revisa e melhora o próprio processo em ciclos |
| CC-871 | definida | - | botao de resposta do arquiteto falhou com nao foi na pergunta CN-2 em 02/10 e nao reproduziu; o botao agora mostra o motivo |
| CC-892 | definida | - | ver os agentes do robo sem eles virarem conversas na lista do Coderoom: outro lugar para acompanhar cada agente |
| CC-921 | prova | - | apagar conversa do Coderoom logo depois do turno derrubava o painel inteiro: relogio escrevia em conversa que nao existia |
| CC-928 | prova | - | opencode e agy pelo painel falham onde o CLI e o Antigravity nao falham: achar a causa (inclusive trava via SSH) |
| CC-930 | prova | - | guarda no Coderoom vigiando os agentes de segundo em segundo (pode usar Haiku) |
| CC-938 | prova | - | Conta de Casa construido pelo Agy no lugar do opencode, com a sessao fazendo o papel dele e auditando cada pergunta |
| CC-939 | prova | - | print da revisao tem que passar pelo login: hoje sai sempre a tela de entrada porque o robo so abre o endereco |
| CC-978 | travado | - | Cartão da conversa do Coderoom mostra o checklist do próprio agente (o agy hoje não grava o texto das tarefas) |
| CC-979 | prova | - | Robô dá o pedido por falho quando o projeto não tem etapa de build nem página pronta para foto, com o trabalho feito |
| CC-980 | prova | - | Conversa de micro tarefa reprovada ou cancelada também vai para os arquivados: o projeto fica com uma conversa só, a do robô |
| CC-1024 | prova | - | Medir lado a lado o mesmo pedido pequeno no opencode do terminal e no robo do Coderoom, mesmo modelo: tempo, falhas e resultado |
| CC-1026 | prova | - | Opencode no Coderoom confere o proprio trabalho: liberar print e navegador, mantendo a trava do projeto |
| CC-1027 | definida | - | Modo terminal no Coderoom: pedido inteiro numa sessao so do opencode, robo confere so no fim |
| CC-1028 | prova | - | Robo do Coderoom fotografa app de servidor sem pasta de build: sobe o app e confere a tela, em vez de desistir |

## padrao

| id | estado | peso | o que é |
|---|---|---|---|
| CC-834 | andando · 10 de 11 | - | o fluxo de projeto vira código: cada tarefa é um objeto que guarda o debate dele e anda sozinho, sem IA onde dá |
| CC-848 | andando · 1 de 6 | - | Nisaba no cockpit inteiro: botão no Coderoom, tela do pedido, regras em toda sessão, conferência por projeto |
| CC-853 | prova | - | visualizações do backlog em dado: kanban melhor e roteiro animado com marcos, meio soft-gamified |
| CC-860 | prova | - | skill do Nisaba: a sessão do próprio projeto avalia e instala o sistema nele, aos poucos |
| CC-864 | prova | - | guia completo do Nisaba com analogias, do nascimento de um projeto ao pedido fechado, com um app de finanças pessoais como exemplo |

## maquinas

| id | estado | peso | o que é |
|---|---|---|---|
| CC-859 | prova | - | Instalar como app no celular a página do Deploy seguro e a do reinício emergencial da VPS, como apps de segurança dele |
| CC-931 | ideia | - | segurança: cabeçalhos no nginx do cockpit e dos sites (HSTS, nosniff, frame-ancestors), que hoje não são enviados |
| CC-932 | prova | - | segurança: alerta ativo quando o painel, a porta de entrada ou um site cair, sem depender de ele perceber |
| CC-934 | ideia | - | segurança: backup da VPS inteira fora dela e um roteiro de restauração testado de verdade |
| CC-944 | definida | - | leitura segura: Claude consulta o banco do Ahtleta no ar, so leitura e sem dado pessoal, liberado por 24h com o autenticador |

## fundacao

| id | estado | peso | o que é |
|---|---|---|---|
| CC-1057 | prova | - | fila do agente lista prova que espera o olho dele como trabalho que o agente faz sozinho |
