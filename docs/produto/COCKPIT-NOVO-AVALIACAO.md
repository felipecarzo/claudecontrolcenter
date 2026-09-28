# Cockpit novo: avaliação crítica das telas de hoje

Pedido dele em 23/09/2026, com o Opus 5.5: avaliar todas as telas do cockpit
contra a ideia do cockpit novo. Os dez desejos viraram CC-550 a CC-559 no
backlog, frente "cockpit novo".

**Como foi medido.** As 34 telas do cockpit 2 (`/cockpit2`) fotografadas em
390x844, a largura do telefone dele, no Chrome que roda na própria VPS, com
6 segundos de espera cada. Em cada uma: erro de script, texto na tela, largura
da página e se abriu a tela pedida. Fotos em
`assets/feedback/260923/` (as que sustentam cada achado).

**O quadro geral, em números:**

- 34 telas, **zero erro de script**. O que quebra não é código que explode, é
  tela que abre no lugar errado ou peça que não existe
- **Framework abre em branco**: nenhuma tela ativa, título "Cockpit", zero texto
- 4 endereços (`estrutura`, `travas`, `tendencias`, `bancada`) caem na Início,
  embora o conteúdo deles more na Análise
- Máquinas, VPS, Docker e Máquina ainda diziam "lendo…" depois de 6 segundos
- O mesmo cabeçalho de contagens (agentes, "72 precisam de você", modos) come
  cerca de 200 dos 844 pixels em TODA tela, antes do conteúdo

## Os dez desejos, um por um

| # | Desejo | Existe hoje? | Veredito |
|---|---|---|---|
| 1 | Tela com resumo de tudo | Início (já absorveu Agora e Cockpit) | base boa, falta o item 7 |
| 2 | Trello das tarefas dos agentes | Trabalho, e um segundo "Trello" dentro de Agentes | existe, afogado |
| 3 | Ligar sessões e controlar o framework | espalhado: Projetos, Framework, Ajustes | quebrado no telefone |
| 4 | Coderoom | Coderoom | manter; texto vaza pela direita em 390 |
| 5 | Ligar e desligar o que come memória | Servidores (3 telas) | falta a peça principal: memória |
| 6 | Escritório | Escritório | manter; só roda no PC |
| 7 | Responder decisões pelo painel | não existe | maior oportunidade |
| 8 | Engenharia tipo SDD para o agente fazer sozinho | modos do framework | a semente existe, falta o combustível |
| 9 | Área de construção de design | não existe | começar do zero |
| 10 | Notas melhores | Conhecimento > notas | funciona, mas é caixa de texto crua |

### 1. Resumo (Início)

Boa decisão já tomada: Agora e Cockpit redirecionam para ela, uma tela de
resumo só. O defeito que importa aparece no primeiro bloco, "Decisões": o
painel percebe que a sessão do ahtleta parou esperando ele, e escreve
**"sem pergunta legível: abra e veja onde parou"**. Sabe que existe pergunta,
não sabe qual, e não deixa responder. É o desejo 7 visto de dentro.

### 2. Trello (Trabalho)

- **404 cartões** no quadro e **"72 precisam de você"**: número que ninguém
  consegue atender, então ninguém olha
- Os filtros por projeto ocupam a primeira tela inteira; nenhuma coluna do
  quadro aparece sem rolar
- Projeto duplicado com dois nomes: `VPS_fibraessencia` (3) e
  `fibraessencia` (21), `VPS_inovallbond` (46) e `inovallbond` (9). É a
  armadilha "mesmo projeto escrito de dois jeitos vira duas séries", de volta
- A tela Agentes tem um modo "Trello" próprio. Dois Trellos para uma coisa só

### 3. Sessões e framework

- **Framework abre em branco** (medido: nenhuma tela ativa, zero caractere)
- **Projetos quebra no telefone**: o nome do projeto some em duas das quatro
  primeiras linhas, sobram só as etiquetas, e o texto vira uma palavra por
  linha ("sem / frente / em / curso")
- Ligar sessão existe e funciona (o painel sobe `claude --remote-control`
  dentro do tmux), mas mora no cartão do projeto, que é a tela quebrada

### 4. Coderoom

Ele disse que está ótimo, e a tela é a mais rica (18 mil caracteres, zero
erro). Único defeito medido: em 390, frases e endereços saem cortados pela
direita ("sobre o modo automa…"). Manter como está e só conter o texto.

### 5. O que come memória

- Três telas para o mesmo assunto: Servidores novo, Servidores antigo
  (redireciona) e a aba "portas" dentro de Máquinas
- `/api/servers` devolve 37 itens com 20 campos cada, e **nenhum é memória**
- A lista de processos com memória (`src/processos.mjs`) é só Windows. Na VPS
  a rota responde `{"indisponivel":true}`
- Na tabela, a coluna da porta sai cortada em 390, e não há botão de desligar
  na primeira tela

Ou seja: o desejo é "o que come memória", e hoje o painel não sabe quanto
ninguém come.

### 6. Escritório

Ele disse que está perfeito, e é no PC. Nesta VPS o escritório não roda desde
16/08 (último registro do log). No bloco "quem é quem", uma sessão aparece com
o identificador cru no lugar do nome.

### 7. Responder decisões pelo painel

**Não existe rota para isso.** O Coderoom conversa, mas só nas conversas que
ele mesmo abriu; as sessões do Remote Control ficam de fora.

**Por que é viável, medido no código:** as sessões que o painel abre vivem no
tmux, e `src/remotecontrol.mjs` já faz as duas metades do mecanismo:
`tmux capture-pane` para LER a tela da sessão (hoje usado para achar a
pergunta de confiança) e `tmux send-keys` para RESPONDER (hoje aperta Enter
nela). Ler o menu de uma pergunta do agente e mandar a opção escolhida é o
mesmo gesto, com outro texto.

Outra fila de decisões sem lugar para responder: a tela Rotas tem **17 pedidos
"esperando resposta"**, o mais velho de 30/08.

### 8. Engenharia para o agente decidir sozinho

A semente está feita: o modo **contínuo** ("vai até o fim do backlog sem parar
para mostrar") e, em cada item do backlog, os campos `pronto`, `conferir`
(`auto`, `olho` ou `dele`) e `trava` (`dele`). Um item com `conferir: auto` e
sem `trava: dele` é, por definição, algo que o agente pode fazer e provar
sozinho.

O que falta é combustível: **dos 67 itens abertos, 45 não dizem como conferir**,
e só 9 estão marcados como conferíveis por máquina. Sem isso nenhum agente sabe
o que pode fazer sem ele.

Ponto a esclarecer com ele: o termo "JEV" não aparece em lugar nenhum do
projeto e não é sigla que eu reconheça com segurança. Perguntar antes de
desenhar.

### 9. Design

Nenhuma tela, nenhuma rota. Existe ferramenta ao redor (as skills de design
instaladas e as Artifacts), nada dentro do cockpit.

### 10. Notas

Funciona: blocos de texto ou lista. Limites medidos:

- "salvos nesta máquina": as notas do PC e as da VPS são coisas diferentes
- caixa de texto crua, sem busca
- **uma nota guarda uma senha de aplicativo do Google em texto aberto**, visível
  para quem abre o painel. Recomendado: tirar dali e trocar a senha

## O que sobra, e o que deveria sair do menu

- **Meu painel**: 0 de 16 blocos escolhidos, e a instrução fala em "teclas 1 a
  9", que o telefone não tem
- **Análise**: texto de leitura escrito em 29/08, quase um mês velho
- **Agenda**: não configurada
- Glossário, Documentos, Digest: dentro de Conhecimento, pouco ou nada de dado

## A proposta de desenho: oito lugares, um por desejo

| Menu | Responde | Nasce de |
|---|---|---|
| Início | o que precisa de mim, o que roda | Início de hoje |
| Decisões | perguntas dos agentes, com botão de resposta | novo (item 7) |
| Trabalho | um Trello só | Trabalho, sem o Trello de Agentes |
| Sessões | ligar, desligar, modo do framework | Projetos + Framework + Ajustes |
| Coderoom | conversa | como está |
| Máquina | o que roda e quanto come, com desligar | Servidores + Máquinas + Docker |
| Escritório | os agentes desenhados | como está |
| Design | criar e guardar design por projeto | novo (item 9) |

Notas volta ao alcance de um toque (hoje está dentro de Conhecimento). Tudo o
mais vai para "Mais" ou sai.
