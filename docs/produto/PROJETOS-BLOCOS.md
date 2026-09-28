# A tela Projetos, item por item

Lista feita em 26/09/2026, lida do código (`c2RenderProjetos`, `c2Linha`,
`c2Inspetor` em `src/ui_cockpit2.html`) e conferida na tela com os dados do dia
(foto em `assets/feedback/260926/projetos-hoje-1536.png`). Mesmo método da
Início ([[INICIO-BLOCOS]]): cada item com o que faz hoje, o que foi medido, e
embaixo a decisão dele quando sair.

## 1. A lista de projetos

Todos os projetos desta máquina e da outra: primeiro os que têm alguém
esperando por ele, depois os com sessão viva, depois os que só existem no disco,
em ordem alfabética. Cada linha tem o nome, onde o projeto vive (VPS, PC, os
dois ou "sem sinal"), a frente em curso, as horas de hoje e um minigráfico dos
últimos 7 dias.

Medido: 38 linhas. "sem frente em curso" em quase todas. Entram coisas que não
são projeto: `lfeli.ALIENWARE-LIPE` é a pasta pessoal do Windows, onde roda o
simulador de cripto. E há um par suspeito de duplicado: `tradutor` (PC) e
`trandutor` (VPS).

**Decisão (26/09):** "limpar a lista". A pasta pessoal de qualquer máquina
(`C:\Users\fulano`, `/home/fulano`) sai da lista de Projetos; as decisões e
sessões dela continuam na Início. Nome quase igual (até 2 letras de diferença)
ganha a pastilha "parece duplicado de …". Nada é apagado do disco. Ficaram 37.

## 2. As pastilhas de cada linha

"N espera você" (vermelha), "N viva(s)", "N no ar" e o estado do framework
("framework: Execução" ou "sem framework").

Medido: "espera você" soma as decisões dos agentes com as pendências dele. O
ahtleta-corrida mostra 5, das quais 4 são tarefas dele, não agentes parados.

**Decisão (26/09):** separar em duas. "N decisões" (vermelha, agente parado) e
"N tarefas suas". O estado "Em espera" conta só as decisões. Conferido na tela:
ahtleta-corrida "1 decisão · 4 tarefas suas", carzo "3 tarefas suas".

## 3. O detalhe ao lado (inspetor)

Tocar numa linha abre o detalhe do lado, no computador, ou em tela cheia com
"← lista", no celular. No topo: nome, onde vive, frente em curso e horas de hoje.

**Decisão (26/09):** "painel maior" (a primeira pergunta falava em
"inspetor" e "detalhe", e ele respondeu "eu não entendi NADA"; refeita como "o
painel da direita"). O painel ocupa metade da tela, era 44%. Quando a lista
fica estreita, o estado, as barras e as pastilhas descem para baixo do nome.
Medido: 638px de painel em 1536, 510 em 1280, sem rolagem lateral.

## 4. Framework no detalhe

Fase, modo (seletor), MVP, entrevista, e o botão de ligar quando o projeto
nunca teve.

Medido: no ahtleta-corrida a pastilha da lista diz "sem framework", e o detalhe
mostra o seletor em "Desligado", o aviso "16 sem commit, 1 sem push" e "este
projeto nunca teve framework".

**Decisão (26/09):** mandar para a aba Framework. Na Visão geral fica uma
linha ("framework: nunca ligado", "framework: Execução · Continuativo") com
"abrir", que leva à aba. A parte completa (a caixinha do modo, o aviso de
commit) só aparece na aba Framework.

## 5. Decisões do projeto

Os mesmos cartões da Início, só deste projeto.

Medido: as pendências dele entram aqui E de novo na seção Pendências (item 8):
o mesmo cartão aparece duas vezes no detalhe.

**Decisão (26/09):** cada coisa no seu lugar. Decisões mostra só agentes
parados (com as repetidas juntas, como na Início); as tarefas dele ficam só na
seção que agora se chama Tarefas, igual à aba. Conferido no ahtleta-corrida:
"Decisões (1)" e "Tarefas (4)", 5 cartões, nenhum repetido (antes eram 9).

## 6. Sessões do projeto

Cada sessão das últimas 24 horas: tipo (remote control, claude code, fundo),
máquina, estado (trabalhando, espera você, entregou), modelo, ferramenta em uso,
há quanto tempo, tarefas feitas e o botão abrir.

**Decisão (26/09):** mostrar o que o agente disse, igual à Início. Cada sessão
trabalhando ou parada ganha a última frase do agente (o servidor passou a ler a
fala também das paradas, com o mesmo cache), e a sessão desta máquina ganha
"parar" (Esc no terminal, com confirmação).

## 7. Serviços do projeto

O que está no ar deste projeto: nome, porta, máquina, há quanto tempo e o link
para abrir.

**Decisão (26/09):** "ligar e desligar daqui".
- **Encerrar:** as mesmas travas da tela Servidores (só o que ela já deixa
  encerrar, e segundo toque para confirmar, que volta sozinho em 4 segundos).
  O próprio painel (5180 e 5181) não tem o botão: derrubaria a tela.
- **Subir:** o "subir" antigo roda o comando do projeto sem escolher porta, e
  nesta VPS cairia nas 3000 a 3021 dos sites de cliente. Decisão dele: "pelo
  endereço de teste". O botão chama `~/dev.sh <nome>` (rota `/api/dev-teste`),
  com os nomes lidos do próprio script, e recusa qualquer outro. Já no ar,
  vira o link. Provado de verdade com o carzo: subiu em 20 segundos, respondeu
  no endereço, e foi derrubado em seguida.
- Limite conhecido: servidor subido pelo painel morre quando o painel reinicia
  (mesmo grupo de processos do serviço). `~/dev.sh status` mostra o que ficou.

## 8. Pendências do projeto

As tarefas dele ligadas a este projeto, com o botão "feito".

**Decisão (26/09):** igual à Início. Tocar na tarefa mostra por quê, frente,
projeto e quando nasceu; o ✓ dá 6 segundos para desfazer. É a mesma função da
Início (`c2TarefasHtml`), para as duas telas nunca divergirem. Provado com o
fechamento interceptado: desfazer não mandou nada ao servidor.

## 9. "Mais"

Quatro atalhos no pé do detalhe: kanban, rotas, tempo, análise. Levam à tela
geral, não filtrada pelo projeto.

**Decisão (26/09):** "já abrir filtrado; onde não aceitar, o atalho sai".
Medido tela por tela: Tempo e Rotas não têm filtro por projeto (saíram). A
Análise guarda a escolha só na memória: "análise deste projeto" abre já nele.
O Kanban GRAVA a seleção dele (`/api/quadro-projetos`), então "kanban deste
projeto" filtra sem gravar e mostra "mostrando só X · voltar à sua seleção";
tocar num filtro do Kanban vira escolha dele e grava como sempre. Provado: a
seleção salva (VPS_coepiloto) voltou intacta, zero gravações.

## 10. O topo da tela

Título e subtítulo, a busca, e as contas velhas ("133 AGENTES", "79 PRECISAM
DE VOCÊ"), que contam diferente do sino e espremem a busca.

**Decisão (26/09):** tirar, de todas as telas. Quem precisa dele está no sino;
as máquinas, no cartão "Sistema online" do menu. Fecha também a pendência do
"contador velho nas outras telas", que vinha desde a Início.

## Extra: o desenho da imagem de referência (26/09)

Ele mandou uma segunda imagem do ChatGPT, desta vez da tela Projetos: *"gostei
MUITO dessa referência, camarada, podemos fazer a mesma coisa que fizemos com
a Início"*. A imagem veio só no chat, não há arquivo dela no projeto. Mesmo
método que terminou na Início: visual por cima do que existe, e as peças novas
como acréscimo, com dado real. Nenhuma seção do detalhe saiu.

Decisões dele sobre o que a imagem mostrava sem dado:
- **descrição de uma linha:** "do CLAUDE.md do projeto". Primeira frase da
  seção "## Projeto"; sem ela, do docs/produto/VISAO.md. 16 dos 37 têm.
  (`src/projetoResumo.mjs`, rota `/api/projetos/resumo`, com cache por data.)
- **barra de progresso:** "podemos ter duas barras, a de MVP e a de roadmap".
  MVP = critérios marcados no framework; Roadmap = itens feitos do ROADMAP.md.
  Projeto sem um deles fica sem aquela barra, nunca com barra zerada inventada.
- **etiquetas:** ele escreve, no detalhe ("+ etiqueta", Enter; × tira). Valem
  no telefone e no computador.
- **prazo:** espera a conversa de prazos com a IA (CC-581).

O que entrou: os quatro números (total, em andamento, em espera, parados; o
"Concluídos" da imagem virou "Parados", porque o painel não sabe quando um
projeto acabou), as abas de filtro com contagem e a ordem (espera você
primeiro, nome, mais recentes), a linha com quadrado colorido, descrição,
etiquetas, estado e as barras, e no detalhe o cabeçalho, as barras, três
números e as abas (Visão geral = tudo o que já existia, na mesma ordem).
Ficaram de fora da imagem: custo estimado, "últimas atualizações" e arquivos.
