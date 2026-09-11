<!-- GERADO por src/backlog.mjs a partir de docs/backlog.jsonl.
     NÃO EDITE ESTE ARQUIVO: a fonte é o .jsonl, e o que você escrever aqui
     some na próxima geração. Para mexer: `cc backlog`. -->

# ROADMAP — o que está aberto neste projeto

49 abertos, 513 fechados, 562 no total. Gerado em 2026-09-11.

## tarefas

| id | estado | peso | o que é |
|---|---|---|---|
| CC-234 | definida | 2 | o painel propoe fechar tarefa dele quando acha prova, e ele confirma |

## medição

| id | estado | peso | o que é |
|---|---|---|---|
| CC-286 | definida | 2 | exportar as medidas em JSON e CSV pela mesma rota |
| CC-287 | definida | 3 | a tela do armazém de medidas |
| CC-288 | definida | 2 | somar as medidas por semana, mês e ano |
| CC-289 | definida | 2 | o calendário que anda para trás e para frente |
| CC-290 | definida | 2 | curva de tendência, no formato que ele nomeou |
| CC-291 | definida | 1 | qualquer gráfico abre em tela cheia |

## travas

| id | estado | peso | o que é |
|---|---|---|---|
| CC-292 | definida | 2 | a taxa de cada trava por 100 respostas, no armazém |
| CC-293 | definida | 2 | separar trava de forma de trava de julgamento |
| CC-294 | definida | 3 | a amostra julgada: 30 devoluções lidas lado a lado |
| CC-295 | definida | 1 | desligar as cinco travas maiores por uma semana, e medir |
| CC-296 | definida | 2 | achar a trava que barra uma em cada cinco respostas |
| CC-299 | definida | 3 | três travas erram, e eu bati nas três no mesmo turno |

## projetos

| id | estado | peso | o que é |
|---|---|---|---|
| CC-313 | definida | 2 | a primeira anotação dele, que virou decisão |
| CC-317 | definida | 3 | criar projeto no PC e na VPS pelo mesmo caminho |

## sincronia

| id | estado | peso | o que é |
|---|---|---|---|
| CC-340 | prova | 1 | a faixa na tela que mostra a sincronia do PC (o programa já está pronto) |

## federação

| id | estado | peso | o que é |
|---|---|---|---|
| CC-440 | definida | 5 | Plano de Unificacao: o PC coleta, a VPS trata e decide as regras |

## painel simples

| id | estado | peso | o que é |
|---|---|---|---|
| CC-467 | definida | 2 | apagar ui.html e ui_v2.html, com as 30 verificações do gate migradas antes |

## fundacao

| id | estado | peso | o que é |
|---|---|---|---|
| CC-481 | definida | 1 | os 13 projetos ganharam docs/backlog.jsonl e ninguem commitou ainda |
| CC-493 | definida | 2 | a frente deduzida dos arquivos mexidos aparece no cartao, marcada como palpite |
| CC-494 | definida | 2 | a mesma sessao aparece duas vezes no painel, com id de job e id de sessao diferentes |

## cockpit 2

| id | estado | peso | o que é |
|---|---|---|---|
| CC-491 | definida | - | quero que o desktop veja a vps tbm, o framework precisa criar essa conexao, mesmo que de forma barata, mas que tenha seguranca, consistencia e qualidade (decisao dele em 11/09: o desktop PUXA o retrato federado da VPS; mesmo token, HTTPS, validado campo a campo, cache de 30s, fora do tique de 2s) cockpit 2 |
| CC-496 | definida | - | so quero que as informacoes redundantes sumam e as importantes sejam organizadas de forma correta; coisa que eu veja pouco mas bem organizada pode ser util; o problema e coisa pouco util no dia a dia virar ruido no meio do importante cockpit 2 |
| CC-506 | definida | - | print 1: no inspetor do projeto, onde ta o framework? (fase, MVP, modo nao aparecem) cockpit 2 |
| CC-507 | definida | - | print 2: o cartao 'quem espera voce' e nome horrivel e frase de efeito. quem e esse quem? e um card de TAREFA: do projeto tal, da tarefa tal, o que falta de mim. hoje nao da essas informacoes de forma inteligente cockpit 2 |
| CC-508 | definida | - | print 2: agente que ENTREGOU (6 de 6 tarefas, commit a99fded) aparece como 'parou sem perguntar', e ao abrir cai numa tela que nao diz nada cockpit 2 |
| CC-509 | definida | - | print 2: em Agentes, clicar em 'o que ele entregou' (a99fded) vai pra tela de erro {error: not found} cockpit 2 |
| CC-527 | definida | - | o aviso mostra, nesta ordem: projeto, item, o que falta dele. ex: inovallbond / CC-340 / decidir se a migracao entra (decisao dele 11/09) cockpit 2 |

## framework

| id | estado | peso | o que é |
|---|---|---|---|
| CC-500 | definida | - | URGENTE: transformar o projeto num FRAMEWORK. voltar pra raiz: como funciona a criacao de um projeto, como o framework age no projeto, como o projeto se auto-registra, como o framework identifica esses registros framework |
| CC-501 | definida | - | tarefa nao e linguagem natural: a IA limita a sintese dos raciocinios a termos pre-definidos, mesmo que a lista seja gigante. ex: 'pedido: construcao de sistema - intencao: ~ criar framework pra gerenciar agentes - definicao de pronto: ...'. o ~ marca o que a IA interpreta framework |
| CC-502 | definida | - | codigo interno que identifica tarefas em codigo, pra uma maquina ler rapido a documentacao de todos os projetos ATIVOS todo dia e verificar se as tarefas estao prontas baseada nos codigos framework |
| CC-503 | definida | - | projetos ativos e inativos definidos pela intencao do cliente; robos pra vasculhar os sites dos clientes procurando problemas eventuais framework |
| CC-504 | definida | - | o framework precisa limitar a forma como a IA fala: pouco texto na tela, todo texto explicativo ao ponto e extremamente explicito, e perguntas pra tomada de decisao, sempre perguntas. formato: 'Achei o erro. O erro era X.' e a explicacao complexa colapsada ou salva no framework pra ler depois. nada de 'achei o erro, e nao era o que eu pensava' framework |
| CC-505 | definida | - | o framework existe pra limitar os gaps de comunicacao entre humano e IA no desenvolvimento: ele olha 6 projetos, perde o contexto, e texto longo piora a retencao dele. o trabalho dele e decisao e captar erro no mundo real, nao ler explicacao framework |
| CC-510 | definida | - | o item do framework tem natureza, area, tamanho, intencao (~140), pronto e conferir obrigatorios; trava e risco quando o caso aparece; titulo livre deixa de existir (fechado por ele em 11/09) framework |
| CC-511 | definida | - | conferir: auto <comando> / olho <o que olhar> / dele <o que ele confirma>. e o campo que faz o leitor diario existir: hoje so 27 de 300 provas citam comando framework |
| CC-512 | definida | - | trava: dele / CC-nnn / mundo <o que>. hoje e prosa no porque, e o painel nao consegue somar quem espera o que framework |
| CC-513 | definida | - | risco: local / compartilhado / cliente. hoje e invisivel, e e a diferenca entre publicar e derrubar site de cliente framework |
| CC-514 | definida | - | tamanho P M G obrigatorio na criacao; o peso antigo apodreceu em 8 por cento e sai framework |
| CC-515 | definida | - | RECUSADO com motivo medido: prazo e data no item (524 de 543 fecham no mesmo dia), importancia livre (ja apodreceu), hora gasta digitada (ja e derivada dos transcritos) framework |
| CC-516 | definida | - | os 110 itens 'herdado sem estado' sao cabecalhos de prosa da migracao, nao tarefas: marcar NT para o leitor pular, sem apagar framework |
| CC-520 | definida | - | falso positivo da trava da fala: citar o proprio padrao entre aspas conta como narracao (barrou a resposta que explicava a trava) framework |
| CC-521 | definida | - | a frente vira codigo curto de uma palavra (kanban, rotas, federacao) mais descricao; o item carrega so o codigo (decisao dele 11/09) framework |
| CC-522 | definida | - | o leitor diario roda de manha, escreve um arquivo por projeto e tem tela no cockpit: o que fechou sozinho, o que espera ele, o que travou (decisao dele 11/09) framework |
| CC-523 | definida | - | item sem natureza, area, tamanho, pronto ou conferir NAO NASCE: o comando recusa e diz o que falta (decisao dele 11/09) framework |
| CC-524 | definida | - | so os 33 itens abertos vao pro formato novo, preenchidos um a um com ele cortando; os 510 fechados ficam como estao, sao historico (decisao dele 11/09) framework |
| CC-525 | definida | - | projeto novo nasce com: registro (cliente, ativo, site), backlog vazio e CLAUDE.md. pasta de documento nasce quando tiver documento (decisao dele 11/09) framework |
| CC-526 | definida | - | projeto ativo parado ha 7 dias aparece na tela do leitor diario, com quantos dias; ele decide se marca inativo (decisao dele 11/09) framework |
| CC-528 | definida | - | agente sem item declarado: o aviso diz 'sem item declarado' com todas as letras, e uma peca passa a cobrar isso do agente antes da entrega (decisao dele 11/09) framework |
