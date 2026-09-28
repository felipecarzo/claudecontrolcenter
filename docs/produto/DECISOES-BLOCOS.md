# A tela Decisões, item por item

Lista feita em 26/09/2026, lida do código (`c2RenderDecisoes` em
`src/ui_cockpit2.html`) e conferida na tela (foto em
`assets/feedback/260926/decisoes-hoje-1536.png`). Mesmo método da Início
([[INICIO-BLOCOS]]) e de Projetos ([[PROJETOS-BLOCOS]]).

A tela nasceu hoje mesmo, a pedido dele: *"podemos ter uma tela só pras
decisões também, pra vermos elas melhor"*.

## 1. A grade de cartões

Os agentes parados esperando ele, os mesmos cartões da Início, em grade: três
colunas no computador, uma no celular. No dia: 3 cartões (1 pergunta com
opções, 2 paradas com campo de mensagem).

**Decisão:** em aberto

## 2. O filtro por projeto

Uma pastilha por projeto, com a contagem, e "todos". Só aparece quando há
decisões de mais de um projeto.

**Decisão:** em aberto

## 3. O cartão

Pergunta com opções: as opções viram botões e ele responde dali (só sessão
desta máquina). Parada sem pergunta: a última fala e o campo de mensagem.
Consultas repetidas do mesmo lugar: um cartão só, com "ver as N" e "fechar
todas". Todo cartão tem × para fechar.

**Decisão:** em aberto

## 4. O que saiu sozinho

Cartão fechado por ele e parado sem pergunta há mais de 2 horas saem da lista.
A Início conta isso ("N saíram sozinhas · N fechadas por você"); esta tela não
mostra nem a contagem, nem um jeito de ver ou reabrir.

**Decisão:** em aberto

## 5. O topo

Título, subtítulo e o filtro. Não tem os números nem as abas que a Início e
Projetos ganharam hoje.

**Decisão:** em aberto

## As decisões dele (26/09)

- **Itens 1 a 3:** "perguntas primeiro". A grade, o filtro e o cartão ficam
  como estão; a ordem passa a ser as perguntas com opções antes das paradas
  sem pergunta, porque são as que ele responde com um toque.
- **Item 4:** "mostrar numa aba". Aba "Fechadas e antigas", com a contagem, e
  cada cartão com o motivo ("fechada por você" ou "parada há mais de 2 horas,
  saiu sozinha") e "reabrir". Reabrir tira das fechadas e marca o cartão como
  mantido, para a regra das 2 horas não esconder de novo (`reabrir` e
  `lerMantidas` em `src/decisao.mjs`, com teste; rota `/api/decisao/reabrir`;
  o servidor passou a mandar a lista `ocultas`, não só a contagem).
- **Item 5:** "sim, com números". Três no topo: perguntas, paradas, fechadas e
  antigas; e as duas abas.

Provado no navegador em 1536 e 390: a ordem saiu PERGUNTA, PAROU, PAROU. No dia
não havia nenhuma fechada ou antiga, então a aba foi provada com dois cartões
de exemplo injetados só na página, e o reabrir interceptado.

## 27/09: histórico, sessão aberta, mosaico, filtro e envio único

- **Histórico (CC-582).** Pedido dele: "um histórico de decisões por projeto".
  Toda decisão que aparece é gravada (`src/decisaoHistorico.mjs`, no abrigo) e,
  quando some, fecha com o motivo: respondida pelo painel, fechada por você,
  sessão desligada, ou seguiu na sessão. Aba "Histórico" nesta tela, com filtro
  por projeto, e a mesma lista na aba Decisões do painel de cada projeto. Começou
  a gravar em 27/09.
- **Sessão aberta nunca some (CC-583).** "Um projeto ativo sempre aparece": a
  regra das 2 horas só vale para quem não se sabe se está aberto.
- **Mosaico (CC-584).** A grade de cartões usa o encaixe da Início.
- **Filtro (CC-587).** Todo projeto com sessão aberta aparece, com zero quando
  não tem decisão; escolhido, diz o que a sessão está fazendo.
- **Envio único (CC-586).** O cartão respondido some na hora, nas duas telas e
  no sino, e um segundo toque não manda de novo.
