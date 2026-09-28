<!-- GERADO por src/backlog.mjs a partir de docs/backlog.jsonl.
     NÃO EDITE ESTE ARQUIVO: a fonte é o .jsonl, e o que você escrever aqui
     some na próxima geração. Para mexer: `cc backlog`. -->

# ROADMAP — o que está aberto neste projeto

40 abertos, 676 fechados, 716 no total. Gerado em 2026-09-28.

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
