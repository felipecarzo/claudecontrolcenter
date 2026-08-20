---
tags: [produto, design]
tipo: direcao
atualizado: 2026-08-19
resumo: O nome e as regras do estilo do painel. Nasceu quando o Felipe levou o cockpit a outras IAs, gostou do que voltou, e disse que não sabia nomear aquilo. Este arquivo nomeia.
termos:
  Torre: o nome do estilo. Torre de controle, e também a peça de xadrez que herda o boletim anterior
  pista: a fila do topo, o que espera decisão dele
  tira: um item da pista
  fraseologia: a frase com verbo que substitui o código de estado
---

# Torre

## Por que este arquivo existe

Em 19/08 o Felipe levou o painel para outras IAs. Voltou com um protótipo do
Gemini e uma direção do ChatGPT, e disse:

> "achei que o gemini quase chegou lá, e a referência do gpt ficou perfeita,
> esse tipo de design que eu tava querendo, **e você não tava encontrando**,
> não sei definir o nome disso mas acho que podemos nomear isso"

Duas coisas nessa frase. A segunda é o pedido: dar nome. A primeira é o
diagnóstico, e ele está certo. As rodadas anteriores de redesenho chegaram
perto por disciplina (contraste medido, uma cor por significado, prova no
estreito) e erraram o **gênero**: entregaram um documento bem impresso quando
o que ele queria era uma sala de operação.

## O nome

**Torre.** De torre de controle. E também a peça de xadrez, o que preserva a
herança do boletim de torneio em vez de renegá-la, porque metade das regras
daquele redesenho sobrevive inteira aqui.

Vocabulário derivado, para as conversas:

| termo | o que é |
|---|---|
| **a pista** | a fila do topo: o que está para pousar nele |
| **as tiras** | cada item da pista |
| **a fraseologia** | a frase com verbo que substitui "status: waiting" |

"Faz no estilo Torre" passa a significar tudo o que está escrito abaixo.

## De onde o estilo vem

O que as duas propostas têm em comum não é fundo escuro nem monoespaçada.
Isso é a superfície. O que ele reconheceu é uma linhagem de **salas de
operação**, com quatro ancestrais, cada um doando uma peça estrutural.

**A sala de controle de missão da NASA** doou o princípio organizador: dezenas
de sistemas autônomos rodando ao mesmo tempo, e o humano como gargalo
deliberado de decisão. O console do diretor de voo não mostra telemetria
bruta, mostra "pode prosseguir?". É a frase dele no COCKPIT.md: *"o meu maior
poder é o poder de decisão"*.

**A torre de controle aéreo**, e em particular a fita de tiras de papel. Antes
das telas, o controlador organizava o tráfego com uma tira por aeronave,
ordenadas fisicamente por urgência na régua da mesa. Reordenar a tira ERA a
decisão. É estruturalmente idêntico à linha de vez que o painel já tem. A
torre também doou a **fraseologia padronizada**: frases curtas, humanas,
inambíguas. "Autorizado a pousar", nunca um código.

**O terminal Bloomberg e os TUIs** (htop, k9s, lazygit) doaram a densidade sem
estímulo: muito dado por tela, hierarquia por tipografia e não por cor, fundo
escuro porque a tela fica aberta o dia inteiro, uma cor de marca só.

**O padrão ISA-101 de painel industrial** é o ancestral menos óbvio e o mais
importante. Depois de acidentes atribuídos a painéis "árvore de Natal", a
indústria de processo escreveu a regra: fundo neutro, elemento em estado
normal é acromático, cor existe só para anomalia, e **uma cor tem um
significado só na planta inteira**. É o único estilo de painel com literatura
de segurança por trás. A distinção brutal entre "a IA está trabalhando" e "a
IA está esperando VOCÊ" é isso: normal é silencioso, anômalo grita, e a
anomalia deste produto é precisar de humano.

O que não está na linhagem: o painel de BI e de SaaS, com cartões de métrica
grandes e gráficos coloridos. É o gênero que as duas propostas rejeitam por
escrito, e que o boletim já rejeitava.

## Os cinco traços, nenhum deles cor

1. **Gestão por exceção.** A tela é silenciosa quando tudo vai bem, e o
   silêncio é a informação.
2. **A unidade é o item de trabalho, não o trabalhador.** Agente é recurso
   alocado a um item, como aeronave é alocada a um plano de voo. A hierarquia
   passa a ser projeto, frente, item, agentes.
3. **Fila explícita no topo, ordenada por espera**, com a ação ao lado da
   informação.
4. **Fraseologia, não status.** Todo estado visível a ele é uma frase com
   verbo dirigida a ele.
5. **Duas vozes tipográficas com empregos fixos.** Largura fixa para o que
   alinha e é dado; humanista para o que se decide e é frase.

## As dez regras, em ordem de força

Quando duas colidem, a de cima vence. As cinco réguas de
[[CRITERIOS-DE-TELA]] continuam valendo; a Torre as herda e acrescenta as
suas. Cada regra vem com o teste que um revisor aplica olhando a tela.

**T1. A pista é a única parte com leitura garantida.** A zona "precisa de
você" fica no topo, sempre, e responde em zero cliques.
*Teste:* cubra tudo abaixo da primeira dobra de 390px. Se não dá para saber se
algo espera por ele, reprovado.

**T2. Silêncio é informação, e nunca é mentira.** Pista vazia some, não vira
"0 itens". Mas ausência só pode significar "nada espera" se o erro de coleta
tiver outra cara: falha nunca se veste de vazio, e bloco recolhido diz quantos
itens escondeu.
*Teste:* derrube uma fonte de dado e olhe a tela. Se ela ficou mais calma em
vez de acusar, reprovado.

**T3. Uma cor, um significado, um dono.** Herda a Regra da Bandeirinha, que já
resolvia isso melhor que os dois mockups. O vermelho da vez significa "a
jogada é sua" e nada mais na tela inteira, e marca só o primeiro da fila.
Estado normal é acromático. Cor de estado é texto, fio de 3px ou borda, nunca
fundo.
*Teste:* liste todo uso de cada cor saturada. Cor com dois significados
reprova; tela em estado normal com mais de um ponto de cor por bloco reprova.

**T4. Todo elemento responde "e daí?", mas só acima da dobra.** Número visível
sem clique carrega frase e direção ("182k tokens, 3 agentes consomem 71%").
Abaixo do clique, a densidade bruta de boletim é legítima: quem clicou pediu o
dado. É assim que "e daí?" e densidade convivem: **profundidade compra
densidade, superfície paga com frase**.
*Teste:* para cada número no primeiro viewport, pergunte "que decisão isso
muda?". Sem resposta em uma frase, o número desce um nível.

**T5. Estado dirigido a ele tem verbo e destinatário.** "Precisa de uma decisão
sua", "travado: falta credencial da VPS". A palavra VOCÊ é reservada à pista,
com a mesma disciplina de dono único da bandeirinha: se "você" aparece em
tudo, não convoca mais nada.
*Teste:* leia cada selo de estado em voz alta. Se soa a registro de máquina
onde ele decide, reprovado.

**T6. A voz tipográfica denuncia a natureza do dado.** Largura fixa com
tabular-nums para o que alinha ou é reescrito pelo stream (número, caminho,
porta, idade); humanista para frase e decisão; condensada para rótulo. O
desempate contra legibilidade: **se o texto tem verbo, não é mono.**
*Teste:* frase inteira em monoespaçada reprova; número de stream sem
tabular-nums reprova.

**T7. A ordem é a informação, e a ordem não dança.** Herda a régua da coluna
ordenada por urgência. O acréscimo é imposto pelo stream: a reordenação só
acontece quando um ESTADO muda, nunca porque um contador de segundos cresceu.
Lista que reordena a cada dois segundos faz a linha fugir do dedo no celular.
*Teste:* assista 30 segundos de stream sem nada mudar de estado. Linha que
trocou de posição reprova.

**T8. Ação adjacente, uma primária.** O item que espera carrega a própria
ação, no cartão. Uma só primária por tira; o resto na gaveta.
*Teste:* dois botões com o mesmo peso visual dentro de uma tira reprova.

**T9. Instrumentação só na sala de máquinas.** Barra de CPU, telemetria,
mostrador: só nas telas de infra. Na superfície principal, máquina aparece
como frase apenas quando vira exceção ("VPS fora do ar desde 14h").
*Teste:* qualquer barra ou percentual de máquina no primeiro viewport do
cockpit reprova.

**T10. Estreito primeiro, container sempre.** 390px é a régua; o breakpoint é
`@container` no `#painel`, nunca `@media`. O que não couber em 390px não
existe.
*Teste:* a captura em 390px vem antes da captura no monitor, sempre.

## O que a Torre proíbe

Gradiente e vidro fosco. Sombra em repouso (sombra só no que de fato flutua).
Cartão de métrica com número grande solto. Fundo tingido de cor de estado.
Grade onde a pergunta é "qual o primeiro" e não "quais todos". Mais de uma cor
de acento decorativa. Animação que o stream redispara a cada dois segundos.
Ícone por glifo Unicode. Reticências em nome de coisa. Percentual de máquina
na tela principal. Estado em código de máquina virado para ele. Selo colorido
em estado normal. E o "0 itens" ocupando o lugar do silêncio.

## O que a Torre exige

Uma zona de triagem fixa que responde "preciso agir?" em zero cliques. Frase
ao lado de todo número de superfície. Dono único para o vermelho e para a
palavra "você". Frase de erro distinta de estado vazio em toda fonte de dado.
Contagem de itens escondidos em todo bloco recolhido. tabular-nums em todo
número de stream. Estabilidade de ordem entre tiques. E a prova em 390px antes
da prova no monitor.

## O que o boletim já tinha, e continua valendo

A leitura honesta: **o boletim já cumpre metade da Torre, e às vezes melhor
que os mockups.**

- **A Regra da Bandeirinha** é a versão rigorosa do "uma cor de acento": tem
  dono, tem teste, e já sobreviveu a um conflito real (a cor de "quebrou" saiu
  da família do vermelho e virou magenta-vinho justamente para a regra valer
  por paleta, e não por disciplina de quem escreve). Nenhum dos dois mockups
  tem essa maturidade.
- **A linha de vez JÁ É a pista.** Uma tira por agente que espera, ordenada
  por quem espera há mais tempo, bandeira só no primeiro, calma quando vazia.
  O que falta nela é o que as propostas trazem: a ação ao lado e a frase
  humana. É evolução, não substituição.
- **A recusa do cartão de métrica** é literalmente a regra "e daí?", escrita
  antes de ela chegar de fora.
- **Toda a camada de engenharia**, que é física de painel e não estética:
  nada com estado de sistema operacional dentro de bloco redesenhado por
  timer; `@container` e não `@media`; contraste medido contra fundo E cartão;
  tabular-nums; regra sobre tag semântica sempre escopada pelo pai.

O que o boletim não tinha, e a Torre traz: a unidade item de trabalho, a
fraseologia, a navegação por intenção, e a palavra VOCÊ.

## A navegação: os grupos são a gaveta, não uma disputa

Os mockups propõem uma barra lateral agrupada por intenção. O
[[REDESENHO-TELA]] já definiu com ele quatro camadas: triagem no topo, cartão
por projeto, backlog cruzado, gaveta do sistema.

A reconciliação, para não reabrir decisão já tomada: os grupos ENGENHARIA,
INFRA e RECURSOS **são o conteúdo da gaveta do sistema**, a camada 4. O grupo
COCKPIT são as camadas 1 a 3. A barra lateral é como isso se veste no monitor
largo; no celular ela não existe, e valem a barra de aplicativo de baixo e a
gaveta, que já estão construídas.

## O que os mockups erram

**Os dois são desenhos de monitor largo, e o aparelho principal dele é o
telefone.** O que o estilo vira em 390px não está em nenhum dos dois, e é a
decisão mais cara:

- A barra lateral não existe no estreito. Vira a fita de abas que rola de lado
  mais a barra de baixo, ou a gaveta. Aqui mora uma armadilha já paga: um
  seletor nativo dentro de bloco redesenhado pelo stream matou o menu no
  telefone dele. A navegação estreita precisa herdar a solução que existe, não
  redescobrir o defeito.
- **A área AGORA fixa disputa a dobra.** Três tiras com dois botões cada
  empurram todo o resto para fora da primeira tela. Daí a ação primária única
  (T8) e o colapso de verdade quando vazia (T2). Topo silencioso é fácil em
  1440px e caro em 390px: cada linha do topo custa uma linha de conteúdo.
- **"2 PRECISAM DE VOCÊ" sobrevive inteiro**, e é possivelmente o único pedaço
  do topo que cabe: um número com frase, no cabeçalho, rolando junto. É a
  versão mínima da pista quando a pista não cabe.
- **Monoespaçada é larga.** Caminho de arquivo em mono a 390px quebra cedo. A
  regra de quebrar no meio da palavra em vez de reticências já resolve, mas
  precisa ser testada em mono, não em humanista.

**E a tradução de 17 telas para 6 grupos é onde função some sem ninguém
decidir que ela sumisse.** O protótipo demonstra a parte fotogênica; a
migração real é o painel inteiro. Por isso cada tela migrada declara para qual
grupo vai, e função que morrer é decisão dele, nunca omissão.

## O que o stream de 2 segundos proíbe

Além do já sabido (nada com estado de sistema operacional ou de edição dentro
de bloco redesenhado):

- **"Animação mínima" deixa de ser gosto e vira física.** Transição em
  elemento trocado por inteiro redispara a cada dois segundos: um fade na tira
  vira pisca-pisca. Animação só em elemento que sobrevive ao redesenho.
- **Reordenar por urgência a cada tique é tiro no dedo**, literalmente: a
  linha muda de lugar sob o polegar no instante do toque. Daí a T7.
- **Botão com foco morre no redesenho.** A pista tem ações ao lado; ou a tira
  preserva o foco, ou o redesenho pausa enquanto há foco dentro, como já
  acontece com o seletor de abas.
- **Contador que conta ao vivo é proibido.** Todo tempo exibido deriva do
  carimbo no snapshot e é reescrito pelo tique. Um timer próprio criaria duas
  verdades de relógio.
- **Popover e balão de ajuda moram fora do bloco redesenhado**, irmãos do
  `#main`, como as notas. Popover aberto dentro do bloco fecha sozinho em até
  dois segundos, e ninguém entende por quê.

## Referências

- [[CRITERIOS-DE-TELA]] — as cinco réguas que a Torre herda
- [[REDESENHO-TELA]] — as quatro camadas de navegação, decididas com ele
- [[COCKPIT]] — que problema o painel resolve
- `DESIGN.md` na raiz — o mundo visual construído. Será reescrito ao fim da
  migração, a partir do que existir, não da intenção
