# Os padrões do painel novo, e onde eles ainda não chegaram

Pedido dele em 28/09: *"pegar tudo que fizemos e avaliar os padrões, o que
melhoramos e o que buscamos, e aplicar isso ao resto do painel, não só mudar
cada aba, mas mixar abas, deletar abas"* (CC-659).

A fonte são os 65 pedidos fechados de 21 a 28/09 (CC-590 a CC-654), cada um
com a fala dele no backlog, mais a varredura das 25 telas em 390 px
(`assets/feedback/260928/varredura/`).

## 1. Os padrões, tirados dos pedidos

Cada padrão cita os pedidos de onde saiu. Tela nova segue todos; tela velha
é refeita até segui-los.

1. **Uma tela por intenção.** Telas que mostram a mesma coisa viram uma, e a
   diferença vira filtro. Decisões, Sessões e Agentes viraram uma só
   (CC-594); Tarefas, Trabalho e Kanban eram três nomes para a mesma tela
   (CC-614).
2. **Ordem por quem precisa dele.** Primeiro o que pergunta, depois o que
   espera resposta, por último o que está andando (CC-612). A ordem é estável:
   o novo entra no fim, e nada pula de lugar sozinho (CC-605).
3. **Filtros em fileiras com rótulo.** A máquina fica em cima e nunca se desfaz
   ao trocar outro filtro; depois vem o estado, depois o projeto. Cada fileira
   aceita várias escolhas ao mesmo tempo, e tocar num filtro não mexe na
   rolagem (CC-604, CC-613, CC-626, CC-627, CC-652).
4. **O cartão fala curto e guarda o resto.** Em cima fica o resumo (o do agy),
   e o texto longo fica recolhido, por último ou numa janela. Ícone grande e
   legível; projeto e máquina com ícone (CC-597, CC-600 a CC-602, CC-643).
5. **Agir no próprio cartão.** Responder, permitir, continuar, encerrar,
   trocar o framework e abrir o teste de voo, sem sair da tela (CC-591,
   CC-606 a CC-611, CC-622 a CC-625, CC-635, CC-607).
6. **Todo toque tem resposta.** O cartão trava, mostra "processando" e depois
   "enviado", e desliza para o fim. Nada de janela do navegador: confirmação e
   texto são escritos no próprio cartão (CC-610, CC-622, CC-623, CC-629,
   CC-647, CC-648).
7. **A tela diz a verdade sozinha.** O que mudou em outro lugar (terminal,
   outra máquina, ajudante) aparece sem recarregar (CC-640, CC-645, CC-651).
8. **Rápido.** O toque responde em menos de ~300 ms: a tela muda na hora e a
   gravação corre por trás (CC-650).
9. **Dois jeitos de ver, sem tirar o que existe.** Grade e lista, módulos e
   lista com detalhe. O jeito antigo fica como opção (CC-631, CC-633).
10. **Números no topo, com ícones, como na Início** (CC-619).
11. **No celular, uma coisa por vez.** Colunas viram abas e coluna vazia
    encolhe (CC-617).
12. **O velho se apaga.** A idade é legível e o que está parado há muito fica
    esmaecido (CC-618). Aviso secundário cabe numa linha no fim (CC-616).
13. **Criar a partir de onde se está.** Projeto novo e sessão nova saem da
    tela Projetos, sem ir para outro lugar (CC-632).
14. **Visual:** claro e grafite em relevo; campos de texto saltados, não
    afundados (CC-639, CC-641, CC-642, CC-644).

## 2. As telas hoje

17 aparecem no menu, e 12 estão escondidas mas continuam no código. Só
Início, Projetos, Sessões e Servidores são do padrão novo. O Kanban foi
refeito à parte.

| Tela | Situação | Sobrepõe |
|---|---|---|
| Início, Sessões, Projetos, Servidores, Kanban | no padrão | |
| Ideias | nova, fora do padrão de cartão | bloco de ideias da Início |
| Design | nova, guardada como ideia | |
| Coderoom | velha, ~1050 linhas | conversa da sessão em Sessões |
| Rotas | velha | mapa da Análise |
| Análise | velha, texto de 29/08 | Rotas |
| Tempo, Custo, Gráficos | velhas, três telas do mesmo dado | entre si |
| Máquinas | velha | Servidores |
| Ajustes | velha, ~850 linhas | cartões de projeto repetem Projetos |
| Escritório | velha, só roda no PC | |
| Notas (atalho para Conhecimento) | velha | nota rápida da Início |
| **Escondidas:** Cockpit, Agora, Projetos antigo, Agentes, Meu painel | substituídas, ~3000 linhas mortas | Início, Sessões, Projetos |
| **Escondidas:** Agenda, Conhecimento, Hooks, Rotinas, Framework | sem lugar | Início, Ajustes |

## 3. O que ele decidiu em 28/09

| Decisão | Item |
|---|---|
| Apagar Cockpit, Agora, Projetos antigo, Agentes e Meu painel. O antigo segue em `/antigo` | CC-660 |
| Servidores e Máquinas viram uma tela Máquinas | CC-661 |
| Tempo, Custo e Gráficos viram uma tela Números | CC-662 |
| Rotas e Análise viram uma tela só | CC-663 |
| Coderoom fica separado de Sessões, refeito no padrão | CC-664 |
| Conhecimento mantém o conteúdo e ganha o design novo | CC-665 |
| Ajustes enxuga: framework vai para Projetos, Hooks e Rotinas entram nele | CC-667 |

Ideia dele na mesma resposta, registrada e não executada (CC-666): *"talvez
mudar de notas pra armário, daí tem a gaveta de notas, mas eu posso criar
outras gavetas pra organizar outros documentos… além do mais seria legal um
local onde eu possa ler sobre os projetos, a documentação deles"*.

Toda tela que fica é refeita segundo a seção 1, uma por vez, com prova em
390 e 1536.
