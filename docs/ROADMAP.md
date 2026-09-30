<!-- GERADO por src/backlog.mjs a partir de docs/backlog.jsonl.
     NÃO EDITE ESTE ARQUIVO: a fonte é o .jsonl, e o que você escrever aqui
     some na próxima geração. Para mexer: `cc backlog`. -->

# ROADMAP — o que está aberto neste projeto

90 abertos, 691 fechados, 781 no total. Gerado em 2026-09-30.

## tarefas

| id | estado | peso | o que é |
|---|---|---|---|
| CC-234 | definida | 2 | o painel propoe fechar tarefa dele quando acha prova, e ele confirma |

## medição

| id | estado | peso | o que é |
|---|---|---|---|
| CC-291 | definida | 1 | qualquer gráfico abre em tela cheia |

## travas

| id | estado | peso | o que é |
|---|---|---|---|
| CC-292 | definida | 2 | a taxa de cada trava por 100 respostas, no armazém |
| CC-293 | definida | 2 | separar trava de forma de trava de julgamento |
| CC-294 | definida | 3 | a amostra julgada: 30 devoluções lidas lado a lado |
| CC-296 | definida | 2 | achar a trava que barra uma em cada cinco respostas |
| CC-299 | definida | 3 | três travas erram, e eu bati nas três no mesmo turno |

## projetos

| id | estado | peso | o que é |
|---|---|---|---|
| CC-317 | definida | 3 | criar projeto no PC e na VPS pelo mesmo caminho |

## painel simples

| id | estado | peso | o que é |
|---|---|---|---|
| CC-467 | definida | 2 | apagar ui.html e ui_v2.html, com as 30 verificações do gate migradas antes |

## fundacao

| id | estado | peso | o que é |
|---|---|---|---|
| CC-493 | definida | 2 | a frente deduzida dos arquivos mexidos aparece no cartao, marcada como palpite |

## cockpit 2

| id | estado | peso | o que é |
|---|---|---|---|
| CC-496 | definida | - | so quero que as informacoes redundantes sumam e as importantes sejam organizadas de forma correta; coisa que eu veja pouco mas bem organizada pode ser util; o problema e coisa pouco util no dia a dia virar ruido no meio do importante cockpit 2 |
| CC-508 | definida | - | print 2: agente que ENTREGOU (6 de 6 tarefas, commit a99fded) aparece como 'parou sem perguntar', e ao abrir cai numa tela que nao diz nada cockpit 2 |
| CC-527 | definida | - | o aviso mostra, nesta ordem: projeto, item, o que falta dele. ex: inovallbond / CC-340 / decidir se a migracao entra (decisao dele 11/09) cockpit 2 |

## framework

| id | estado | peso | o que é |
|---|---|---|---|
| CC-500 | definida | - | URGENTE: transformar o projeto num FRAMEWORK. voltar pra raiz: como funciona a criacao de um projeto, como o framework age no projeto, como o projeto se auto-registra, como o framework identifica esses registros framework |
| CC-501 | definida | - | tarefa nao e linguagem natural: a IA limita a sintese dos raciocinios a termos pre-definidos, mesmo que a lista seja gigante. ex: 'pedido: construcao de sistema - intencao: ~ criar framework pra gerenciar agentes - definicao de pronto: ...'. o ~ marca o que a IA interpreta framework |
| CC-503 | definida | - | projetos ativos e inativos definidos pela intencao do cliente; robos pra vasculhar os sites dos clientes procurando problemas eventuais framework |
| CC-521 | definida | - | a frente vira codigo curto de uma palavra (kanban, rotas, federacao) mais descricao; o item carrega so o codigo (decisao dele 11/09) framework |
| CC-522 | definida | - | o leitor diario roda de manha, escreve um arquivo por projeto e tem tela no cockpit: o que fechou sozinho, o que espera ele, o que travou (decisao dele 11/09) framework |
| CC-525 | definida | - | projeto novo nasce com: registro (cliente, ativo, site), backlog vazio e CLAUDE.md. pasta de documento nasce quando tiver documento (decisao dele 11/09) framework |
| CC-526 | definida | - | projeto ativo parado ha 7 dias aparece na tela do leitor diario, com quantos dias; ele decide se marca inativo (decisao dele 11/09) framework |
| CC-528 | definida | - | agente sem item declarado: o aviso diz 'sem item declarado' com todas as letras, e uma peca passa a cobrar isso do agente antes da entrega (decisao dele 11/09) framework |
| CC-532 | definida | - | regra global: toda mudanca diz onde ficou e para quem vale (CLAUDE.md global, 11/09) |
| CC-533 | definida | - | regra global: trava que me barra nao vira conversa (CLAUDE.md global, 11/09) |

## cockpit2

| id | estado | peso | o que é |
|---|---|---|---|
| CC-539 | definida | - | framework so reconhece projeto com pasta ja marcada; ideia dele: projeto nasce no framework, pastas no PC/VPS vem depois, sincronizadas |
| CC-541 | definida | - | github automatico: declarar projeto ja cria o repo via gh repo create e grava no registro |
| CC-542 | definida | - | provisionar pasta local: novoProjeto.mjs clona o repo do registro em vez de git init quando ele existe, e marca provisionado |
| CC-543 | definida | - | tela: criarProjeto vira declarar + criar aqui por maquina; c2ProjetosTodos le do registro de verdade em vez do remendo de hoje |
| CC-544 | definida | - | migracao: os 29 projetos achados hoje por findProjects viram entradas do registro, casados PC/VPS por nomeProjeto.chaveDeProjeto |
| CC-685 | definida | - | gravar tarefas interpretadas a partir de pedidos soltos |
| CC-686 | definida | - | aba Projetos, cartao do projeto, aba Sessoes: voltou a ter botao encerrar sessao (sumiu, so tem parar e abrir) |
| CC-687 | definida | - | aba Projetos, cartao do projeto: iniciar sessao no Coderoom e no Agy por ali, nao so sessao do Claude Code |
| CC-688 | definida | - | aba Projetos: faixa de filtros e botoes fixa no topo ao rolar (janela superior), projetos rolam embaixo |
| CC-689 | definida | - | aba Projetos: filtros cortados no fim conforme a largura (Ordem: espera voce primeiro); reajustar em qualquer largura |
| CC-690 | definida | - | projeto online (tem sessao ativa) ou offline (nenhuma): marca visivel e filtro, pra achar o que abrir ou fechar |
| CC-691 | definida | - | sessao viva na VPS que o cockpit nao mostra: boxboutique estava no tmux e o cockpit dizia nenhuma sessao |
| CC-692 | definida | - | ordem dos projetos escolhivel: por atividade, alfabetica etc, visivel e nao escondida num botao que gira |
| CC-693 | definida | - | navegacao suave: clicar nao trava a tela, nada aparece do nada, toda troca tem animacao |
| CC-694 | definida | - | responder pergunta pelo painel falha: mandei as teclas, a sessao nao confirmou (pergunta do Coderoom pensando, projeto cockpit, VPS) |
| CC-695 | definida | - | trocar lista/modulos (e qualquer clique que nao muda de pagina) nao pode jogar a rolagem pro topo |
| CC-696 | definida | - | filtros animados: ao trocar Online/Offline os cartoes que saem somem, os que ficam deslizam, os novos aparecem (objeto fisico) |
| CC-702 | definida | - | trava de arquivos aceitar reserva por trecho: duas sessoes no mesmo arquivo em trechos diferentes nao se bloqueiam |
| CC-703 | definida | - | perguntas desta sessao (29/09, cockpit VPS) nao apareceram na tela Sessoes, so no chat |
| CC-704 | definida | - | aba Projetos: lista e painel do projeto com rolagem separada, cada lado rola sozinho |
| CC-705 | definida | - | tela Sessoes com as regras de design: barra de filtros presa no topo, cartoes animados ao filtrar, rolagem parada, zonas com rolagem propria |
| CC-706 | definida | - | responder pedido de permissao pelo painel nao resolve: aparece, clico e nada (ja tinha sido consertado) |
| CC-707 | definida | - | filtro de maquina em Sessoes com varias escolhas somadas (ex: VPS e Coderoom), igual aos outros filtros |
| CC-708 | definida | - | Sessoes: VPS_cockpit e VPS_coderoom aparecem ambas como cockpit e se embolam nos filtros |
| CC-709 | definida | - | Armario remodelado: 3 zonas (lista, leitura, contexto), abas Projetos/Notas/Arquivos, sumario do doc, busca unica |
| CC-711 | definida | - | Coderoom: etiqueta de agente na lista mostra o agente com que a conversa nasceu, nao o que esta respondendo |
| CC-712 | definida | - | Coderoom remodelado: conversas por projeto, agentes no topo, contexto colapsavel, @ arquivo e / comando, salvar no projeto |
| CC-713 | definida | - | Coderoom: as duas barras laterais (conversas e contexto) colapsaveis por botao |
| CC-717 | definida | - | Coderoom: chat so com mensagem, anexo e audio; texto, modos, sino, tema, avatar e escolha de agente/modelo na barra direita |
| CC-720 | definida | - | Coderoom: faixa de cima some sempre, controles dentro do painel do chat, etiquetas na barra direita; FC sai do cockpit todo |
| CC-721 | definida | - | Coderoom: tabela em markdown na resposta do agente aparece crua (/ Pais / Capital /) em vez de tabela |
| CC-722 | definida | - | revisao geral do cockpit: responsividade no celular (todas as telas em 390) e seguranca |
| CC-724 | definida | - | investigar a fundo por que algumas perguntas e pedidos de permissao nao aparecem no cockpit |
| CC-725 | definida | - | pergunta respondida pelo painel fica presa em processando: enviando a resposta (VPS_coderoom, 30/09) |
| CC-726 | definida | - | cartao de permissao com o terceiro botao: sempre permitir, como no terminal e no app |
| CC-729 | definida | - | cockpit demora a mostrar que o agente parou (ate 65 s) e a resposta parece demorar a chegar |
| CC-730 | definida | - | Coderoom quebrado: controles vazando sobre a barra direita com o chat estreito, e 404 ao abrir conversa apagada |
| CC-731 | definida | - | npm test chama o agy de verdade (test-gate-memoria, nome da conversa): 3 pedidos de rede por rodada e cota gasta |
| CC-732 | definida | - | Sessoes do PC ficam presas e nao atualizam no Cockpit da VPS |
| CC-733 | definida | - | Sessoes do PC que fecharam continuam aparecendo no Cockpit da VPS |
| CC-734 | definida | - | Sessoes do PC que nem aparecem no Cockpit da VPS |
| CC-735 | definida | - | Decisoes, alertas e permissoes das sessoes do PC aparecem e sao respondidas pelo Cockpit da VPS |
| CC-736 | definida | - | Celular: zona de filtros de Sessoes abre sozinha em aparelho novo e cobre 80% da tela, escondendo o cartao |
| CC-737 | definida | - | Separar sessoes paradas em: espera resposta dele, espera teste dele, nao espera nada; filtro para testar todas de uma vez |
| CC-738 | definida | - | Cartao de sessao: chip da maquina (VPS, PC) sempre no mesmo lugar, logo apos o estado; hoje muda de linha conforme os outros chips |
| CC-740 | definida | - | Cartao de sessao de outra maquina: botao abrir no app (claude.ai/code/session_X) para responder sessoes do PC abertas por Remote Control |

## sincronia

| id | estado | peso | o que é |
|---|---|---|---|
| CC-548 | definida | - | o Chrome da VPS nao alcanca porta local: a rota do container ate o host esta fechada e abrir exige regra de firewall com root |

## cockpit novo

| id | estado | peso | o que é |
|---|---|---|---|
| CC-557 | prova | - | cockpit novo: uma engenharia tipo SDD que deixa o agente decidir e fazer sozinho o que nao depende de mim |
| CC-558 | definida | - | cockpit novo: uma area de construcao de design para os projetos |
| CC-559 | definida | - | cockpit novo: notas continua importante, mas o app de notas precisa melhorar |
| CC-562 | definida | - | estudar o JEV (modelo barato de decisao sim/nao e nota) para rodar num modelo barato ou no Gemini pelo agy, nao aqui |
| CC-564 | definida | - | responder pelo painel as perguntas das sessoes do PC: medir se um gancho na pergunta entrega a resposta, sem depender de tela |
| CC-581 | definida | - | visao: area onde a IA pede prazo dos projetos, alinha expectativas, debate prazos e gera o foco do dia |
| CC-655 | ideia | - | design 2/4: telas e prototipos por projeto, com versoes, e ele aprova qual vira codigo |
| CC-656 | ideia | - | design 3/4: mural de referencias por projeto (prints, sites de inspiracao, feedback) para mostrar ao agente quero assim |
| CC-657 | ideia | - | design 4/4: comparar versoes de uma tela lado a lado (antes e depois, 390 e 1536) e aprovar ou pedir ajuste dali |
| CC-658 | ideia | - | design 1b: ajustar a identidade pelo painel (cores, fontes, regras), gravando no arquivo de design do projeto |
| CC-659 | andando | - | passada no painel inteiro: extrair os padroes das telas ja refeitas e aplicar ao resto, juntando e apagando telas |

## coderoom

| id | estado | peso | o que é |
|---|---|---|---|
| CC-710 | definida | - | cada modelo e cada nivel de esforco do Coderoom diz pra que e melhor e quanto custa, com base em benchmarks |
| CC-739 | definida | - | opencode no Coderoom pede pelo painel quando quer mexer em pasta fora do projeto, em vez de recusar sozinho |
| CC-741 | definida | - | harness de design no Coderoom: regras de design no contexto do agente e conferencia do resultado apos cada resposta |
| CC-742 | definida | - | Coderoom manda um resumo das regras de design dele junto de cada mensagem |
| CC-743 | definida | - | depois de resposta que mexe em tela, o Coderoom roda o build e anexa fotos em celular e computador |
| CC-744 | definida | - | revisor visual no Coderoom: um agente olha as fotos da resposta e aponta defeito |
| CC-745 | definida | - | regras de comportamento no Coderoom: sempre portugues, nao prometer conferencia que nao fez, e o painel cobra |
| CC-746 | definida | - | Coderoom orienta o agente a quebrar sempre o trabalho em microtarefas |
| CC-747 | definida | - | resposta longa do agente no Coderoom mostra um resumo curto e a mensagem inteira fica recolhida |
