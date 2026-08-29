---
tags: [produto, telas]
tipo: analise
atualizado: 2026-08-29
resumo: O que cada uma das 29 telas faz, o que elas repetem entre si, e quais estão vazias na prática. Medido abrindo uma a uma na máquina dele, não deduzido do código.
---

# As 29 telas: o que faz, o que repete, o que está morto

Pedido dele em 29/08: *"vamos revisar todas as telas que temos, pq to sentindo
que algumas ficaram bem inuteis. Vamos começar pelas principais. vamos definir o
que cada uma faz, ver as funções que sao redundantes entre essas abas, e revisar
depois o que seria uma versão melhor espalhada."*

## Como isto foi medido

Abrindo **as 29 telas uma a uma no painel dele**, em 390px, e contando o que
cada uma de fato mostra: caracteres de texto, cartões e botões. Não é leitura de
código: é o que está na tela agora, com os dados reais desta máquina.

Tamanho de código foi descartado como medida logo no começo. A tela Trabalho tem
708 bytes de HTML e mostra 3674 caracteres; a Rotinas tem 3226 bytes e mostra
663. Quase tudo é montado por JavaScript, então o arquivo não diz nada sobre o
que ele vê.

## O que cada tela mostra HOJE, do mais vazio para o mais cheio

| Tela | Texto | Cartões | O que aparece |
|---|---|---|---|
| Digest | 16 | 0 | só o título |
| Documentos | 69 | 2 | dois documentos |
| Notas | 80 | 6 | os blocos que ele escreveu |
| Coderoom | 109 | 1 | "nenhuma conversa aberta" |
| Máquina | 180 | 3 | CPU, RAM |
| Agenda | 225 | 1 | instrução de como configurar |
| Escritório | 472 | 3 | o painel embutido |
| Meu painel | 572 | 2 | o que ele montou |
| Rotinas | 663 | 4 | 2 desatualizadas |
| Agentes | 695 | 4 | 4 agentes |
| Ajustes | 986 | 5 | máquinas e método |
| Gráficos | 1514 | 10 | 8 gráficos |
| Hooks | 1587 | 40 | 39 ativos |
| Servidores | 1668 | 47 | 9 no ar |
| Docker | 2141 | 22 | 21 rodando |
| Tempo | 2150 | 6 | horas por projeto |
| Cockpit | 2526 | 12 | a abertura |
| Rotas | 2869 | 24 | quem segura o quê |
| Ligados | 3050 | 5 | 4 de 21 |
| Tendências | 3271 | 17 | séries |
| VPS | 3551 | 47 | nginx, PM2, Docker |
| Trabalho | 3674 | 34 | o quadro |
| Bancada | 5092 | 28 | segurança |
| Estrutura | 6082 | 18 | o mapa de um projeto |
| Projetos | 6704 | 22 | os 21 |
| Custo | 8592 | 71 | preço por tarefa |
| Agora | 11781 | 6 | as pendências |
| Glossário | 12146 | 23 | 22 documentos |
| Travas | 13415 | 15 | o log das regras |

## Achado 1: oito telas estão praticamente vazias

**Digest tem 16 caracteres e zero cartões.** É o caso extremo: a tela abre e não
diz nada. As outras sete têm menos de 600 caracteres, e três delas por motivo
legítimo (Notas e Meu painel são dele para preencher; Coderoom é conversa que ele
não abriu).

Os candidatos de verdade: **Digest**, **Agenda** (que mostra instrução de
configuração, não conteúdo) e **Máquina** (180 caracteres que cabem numa linha
de outra tela).

## Achado 2: quatro telas são "escolha um projeto e veja um aspecto"

**Estrutura, Travas, Tendências e Bancada** abrem exatamente com o mesmo gesto:
um seletor de projeto no topo, e o conteúdo embaixo. São quatro telas com a
mesma pergunta e recortes diferentes da resposta.

Ele já resolveu isto uma vez, na tela Projetos: o cartão do projeto abre e traz o
que é caro sob clique. A pergunta que fica é se estas quatro não são, na verdade,
quatro abas DENTRO do cartão de um projeto.

## Achado 3: sete telas mostram nome de projeto no topo

**Ligados, Trabalho, Estrutura, Agentes, Travas, Tendências e Bancada.** É a
mesma família do problema que ele apontou em 27/08 sobre a Central, e que rendeu
a separação em três telas: *"os projetos estão aparecendo em três lugares
diferentes, está muito ruim"*. Aqui são sete.

## Achado 4: a infraestrutura está em quatro telas

**Servidores** (portas), **Docker** (containers), **VPS** (nginx e PM2) e
**Máquina** (CPU e RAM). As quatro respondem "o que está rodando nesta
máquina", em camadas diferentes. Máquina, com 180 caracteres, é a mais frágil
das quatro.

## Achado 5: o conhecimento está em quatro telas

**Notas** (o que ele escreve), **Documentos** (a estante), **Glossário** (os
verbetes) e **Digest** (o resumo da semana). As duas primeiras são dele, as duas
últimas são derivadas. Glossário tem 12 mil caracteres e Digest tem 16.
