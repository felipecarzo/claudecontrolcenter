# Tela Tarefas (o quadro), revisão de 27/09/2026

Mesmo método da Início, Projetos, Decisões e Agentes: fotografar, numerar o que
se vê, decidir item por item com ele, implementar e provar com foto.

Fotos de partida: `assets/feedback/260927/tarefas-1536.png`,
`tarefas-390.png` e `tarefas-390-parte1.png`.

O código é `renderViewTrabalho()` em `src/ui_cockpit2.html`, herdado do painel
antigo: não passou pelo redesenho que a Início e a Sessões tiveram.

## O que se vê hoje

1. **Três nomes para uma tela.** No menu, "Tarefas" e "Kanban" levam ao mesmo
   lugar, e o título da tela é "Trabalho" (há ainda um terceiro item "Trabalho"
   na barra, com ícone de calendário).
2. **29 botões de projeto no topo, com nomes crus de pasta.**
   - Duplicados: `VPS_ahtleta-corrida` (57) e `ahtleta-corrida` (2);
     `VPS_fibraessencia` (3) e `fibraessencia` (29).
   - Nomes velhos ou que não são projeto: `jogo_sumauma`, `trandutor`,
     `lfeli.ALIENWARE-LIPE`, `sem projeto`.
   - No celular ocupam 695 dos 844 px da primeira tela: não se vê nenhuma
     tarefa sem rolar.
3. **Avisos no topo que ninguém usa:** "1 projeto lido que não entrou no
   quadro" (o VPS_escritorio) e "12 projetos sem roadmap e sem nada no quadro".
4. **Colunas.** Cinco colunas (na fila, andando, pausada, você decide,
   travada), duas vazias. O quadro tem 1934 px numa área de 1392: a coluna
   TRAVADA fica cortada no computador. No celular, 2054 px numa tela de 358.
5. **Cartão.** "aberta há 1 mês(es)" em todo cartão da fila; título que não diz
   o que é ("O que foi medido antes", com a citação dele embaixo); 38 cartões
   na fila, todos com mais de um mês.
6. **Design fora do novo.** Sem os números no topo, sem ícones, sem as abas que
   filtram, sem a cara da Início e da Sessões.
7. **Sem ligação com as sessões.** A coluna "andando" mostra 0 com três sessões
   trabalhando agora: o quadro não sabe qual sessão está em qual tarefa.

## Decisões dele

Todas em 27/09.

| Item | Decisão | Backlog |
|---|---|---|
| 1. Nome | **Kanban.** Um item só no menu, e o título da tela também. | CC-614 |
| 2. Projetos | **Juntar e recolher.** Nome limpo, grafias do mesmo projeto somadas, um botão "projeto: todos" que abre a lista. | CC-615 |
| 3. Avisos | **Recolher numa linha** no fim da tela, que abre a lista. | CC-616 |
| 4. Colunas | **Abas no celular, cabe no PC.** Coluna vazia encolhe no computador; no celular, uma coluna por vez. | CC-617 |
| 5. Fila velha | **Idade legível e cor.** "há 5 semanas", e o parado há mais de um mês fica apagado. Nenhum sai. | CC-618 |
| 6. Design | **Igual à Início.** Números no topo, ícones, projeto e máquina com ícone. Só o visual. | CC-619 |
| 7. Sessões | **Mostrar as sessões no quadro.** Sessão trabalhando vira cartão na coluna "andando". | CC-620 |

**A proposta do ChatGPT (27/09).** Ela transformava a tela num painel com abas
(Projetos, Tarefas, Kanban, Mensagens, Arquivos), com barras de progresso,
datas e funções de agente que não existem no dado. Decisão dele: *"só o kanban
mas com um design mais moderno como o dela"*. Fica o visual (filtro recolhido
"+12", números com ícone no topo, cartões com ícone e pastilhas); não entram as
abas, o "Trabalho recente" ao lado, nem os blocos que já moram na Início. O
contador de agentes e máquinas no topo de todas as telas: **não**.
