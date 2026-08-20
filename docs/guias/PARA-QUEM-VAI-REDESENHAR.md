---
tags: [guia, produto, design]
tipo: guia
atualizado: 2026-08-19
estado: escrito para o próximo agente que for mexer na tela
resumo: O que cada dado do painel significa para o Felipe, por que ele está onde está, o que cada botão faz e o que não pode quebrar. Não é guia de design: é o mapa de importância que decide o que pode mudar de lugar e o que não pode sumir.
termos:
  ele: Felipe, o único usuário deste painel
  frente: a seção do ROADMAP.md de um projeto onde um trabalho entra
  a pista: a fila do topo, quem espera decisão dele
  fraseologia: o estado dito com verbo e destinatário, no lugar do código de máquina
---

# Para quem vai redesenhar o Agent Cockpit

Você provavelmente foi chamado para mexer no design, no UX ou na organização
da tela. Este documento não fala de design. Ele fala de **o que cada coisa da
tela significa para a única pessoa que usa este painel**, para que você mova o
que precisa mover sem apagar o que ele precisa.

**A pergunta que você deve conseguir responder antes de tirar qualquer coisa
da tela: que decisão ele deixa de tomar sem isso?** Se você não souber
responder, não tire.

## Onde está o resto

Este guia não repete o que já está escrito. A ordem de leitura:

| Documento | O que responde |
|---|---|
| [[../produto/COCKPIT]] | que problema o painel resolve, nas palavras dele |
| [[../produto/TELAS]] | o inventário das 17 telas, uma por uma, com cada ferramenta |
| [[../produto/CRITERIOS-DE-TELA]] | as cinco réguas que desempatam escolha de tela |
| [[../produto/TORRE]] | a direção visual atual, com dez regras e o teste de cada uma |
| [[../produto/CICLO]] | como ele trabalha, medido em 235 mensagens reais |
| `CLAUDE.md` na raiz | as armadilhas técnicas que já custaram tempo |

Se você só puder ler dois, leia `CRITERIOS-DE-TELA.md` e este.

---

# Parte 1: quem usa, e o que ele está fazendo quando olha

Um desenvolvedor solo que opera de 4 a 15 agentes de IA em paralelo, em vários
repositórios, em duas máquinas (um PC Windows e uma VPS Linux). Ele não escreve
o código: ele decide o que os agentes fazem, e desbloqueia os que pararam.

Nas palavras dele:

> "o meu contexto é gigante mas muito vago, o meu maior poder é o poder de
> decisão e abstração do projeto enviesado no mundo real. Não tem por que eu
> tentar entender as tarefas e cada linha de mensagem que o agente manda"

**A dor central, declarada por ele: "não saber o que priorizar agora".**

Três números medidos que mudam todo desenho:

- **A janela de atenção por projeto é de ~10 minutos**, e **67% das mensagens
  seguidas trocam de projeto**. Ele não volta para terminar de ler uma tela.
- **O aparelho principal é o telefone, 390px de largura.** As referências de
  design que chegam de fora são sempre de monitor largo, e por isso sempre
  falta a metade que importa.
- **Ele nunca pergunta como o código faz.** Em 235 mensagens, zero perguntas de
  sintaxe ou API. Ele pergunta se o mundo permite: viabilidade, risco, custo
  real de operar.

O que isso significa para você: **a tela é lida em pé, no celular, por trinta
segundos, e o que estiver abaixo da primeira dobra pode nunca ser visto.** Não
é impaciência. É que em dez minutos ele está em outro projeto.

---

# Parte 2: o que cada dado significa para ele

Esta é a parte central do guia. Para cada bloco: o que é, de onde vem, **por
que importa para ele**, e **o que ele deixa de conseguir fazer se sumir**.

## 2.1 A fila do topo: quem espera decisão dele

**O que é.** Uma linha por agente parado esperando resposta humana, ordenada
por quem espera há mais tempo. Cada linha diz o projeto, o assunto, há quanto
tempo espera, e uma frase com verbo: "precisa de uma decisão sua", ou
"travado: <o motivo que o agente escreveu>".

**De onde vem.** Do fluxo ao vivo (`/events`), campo `status: 'waiting'` de
cada agente, ordenado por `updatedAt`. A frase sai de `blockers` quando o
agente escreveu um, senão é a frase padrão.

**Por que importa.** É o produto inteiro em uma faixa. Um agente parado não
está só ocioso: ele está **bloqueando trabalho que já foi pago em tokens e em
tempo**, e ninguém além dele pode destravar. Cada minuto que uma linha fica ali
é um agente que poderia estar produzindo.

**O que quebra se sumir.** Ele volta a descobrir agente parado por acaso, ao
abrir uma aba do terminal. Foi exatamente o problema que criou este painel.

**Regras que essa faixa carrega, e que você não pode diluir:**

- **A bandeirinha vermelha tem dono único.** O vermelho significa "a jogada é
  sua" e nada mais na tela inteira, e marca só o PRIMEIRO da fila. Se você usar
  esse vermelho em enfeite, em outro estado, ou em todas as linhas, o sistema
  de cor inteiro perde o sentido, e a tela vira ruído colorido.
- **Vazio some, não vira "0 esperando".** Bloco vazio com número zero gasta
  altura sem informar, e no celular cada linha custa uma rolagem.
- **Mas vazio nunca pode ser mentira.** Se a leitura falhou, a tela tem que
  dizer que falhou. Uma tela que fica mais calma quando o dado some é o pior
  defeito possível aqui, porque ele confia no silêncio.

## 2.2 Os to-dos dos agentes (a aba "sprint")

**O que é.** A lista de tarefas que cada agente escreveu para si mesmo, com as
concluídas marcadas, e a "prova" de como cada uma foi testada.

**De onde vem.** Do arquivo `meta.json` que cada agente grava. O painel só lê
`state.json` e `pins.json` (que são do Claude Code); `meta.json` é o único
arquivo que ele escreve.

**Por que importa.** É como ele acompanha trabalho longo **sem ler mensagem de
agente**. Ele disse isso literalmente: precisa ver as coisas "sendo criadas em
tempo real", como "uma fábrica comigo orquestrando". Sem essa lista, um agente
que trabalha vinte minutos é uma bolinha girando sem nada para olhar, e ele sai
do painel e vai fazer outra coisa.

**O que quebra se sumir.** Ele perde o único meio de saber se um agente está
progredindo ou travado em círculo, e volta a esperar o texto final.

**Detalhe que parece bobo e não é:** o campo `prova` embaixo de cada tarefa
fechada é a **definição de pronto**. Sem ela, "feito" é opinião do agente. Já
houve 545 testes verdes com a tela quebrada no navegador.

## 2.3 As pendências dele (a aba "meu")

**O que é.** O que só ele pode resolver: comprar domínio, mandar credencial,
decidir preço, aprovar um desenho.

**De onde vem.** `/api/meu`, alimentado pelos agentes quando esbarram em algo
que exige uma pessoa.

**Por que importa.** É a única lista da tela onde o **trabalho é dele**. Tudo
mais é trabalho de máquina que ele supervisiona. Se isso se mistura com o
resto, ele perde a fronteira entre "o que eu acompanho" e "o que eu faço".

**O que quebra se sumir.** Um agente pede uma credencial, ninguém vê, e uma
frente inteira fica parada dias sem motivo aparente.

## 2.4 A frente e o projeto (o caminho `projeto › frente`)

**O que é.** Duas palavras acima de cada cartão de agente: em qual projeto ele
está, e em qual seção do roadmap daquele projeto o trabalho entra.

**De onde vem.** `project` sai do diretório do agente; `frente` é escrito pelo
agente e tem que casar com um título `###` do `docs/ROADMAP.md` daquele projeto.

**Por que importa, e este é o item mais mal compreendido do painel.** O agente
descreve o trabalho com as palavras DELE. "Pierre: travessia gamificada" é uma
frase correta que não diz nada ao Felipe. "Pierre" é uma seção do roadmap dele,
e é assim que ele guarda o projeto na cabeça. **O vocabulário da tela tem que
ser o do roadmap dele, não o do agente.**

**O que quebra se sumir.** Todo cartão vira texto solto e ele precisa abrir
cada um para lembrar do que se trata, o que custa mais que os dez minutos que
ele tem.

## 2.5 Tempo ativo por projeto

**O que é.** Quantas horas de trabalho real foram gastas em cada projeto,
lidas dos registros de conversa dos agentes.

**De onde vem.** Varredura dos arquivos de transcrito (centenas de MB), com
cache. **Só a aba de tempo paga esse custo**, nunca o fluxo ao vivo.

**Por que importa.** É com isso que ele cobra cliente. Não é curiosidade.

**A regra que não pode ser perdida:** a janela do primeiro ao último sinal
**não serve** para cobrar. Num projeto real dava 282 horas corridas contra ~90
horas de trabalho de verdade. O que vale é a soma dos intervalos descartando as
paradas maiores que um corte, **e o corte muda o número** (77,7h a 5 minutos
contra 91,5h a 15 minutos no mesmo projeto). Por isso o corte é um controle na
tela, escolhido por quem olha, e nunca uma constante escondida no código.

**O que quebra se sumir o controle do corte:** o número vira uma afirmação que
ele não pode discutir, e ele não vai confiar nele para faturar.

## 2.6 Custo em reais

**O que é.** Quanto os tokens custariam pela tabela de preço de API, convertido
pelo dólar do dia.

**Por que importa, e a ressalva que precisa estar na tela.** **Não é fatura.**
Ele paga assinatura, não tabela de API. O número serve para comparar projetos
entre si e para precificar trabalho, nunca para saber quanto saiu do bolso.

Duas coisas que enganam e precisam continuar visíveis:

- **Quase todo o volume de token é releitura de cache**, que custa 10% da
  entrada. Um total sem a quebra por tipo faz o projeto parecer dez vezes mais
  caro do que é.
- **A "sobra" usa a assinatura rateada, nunca o preço de API.** A primeira
  versão fez receita menos custo de API e mostrou "sobra de menos R$ 19.504"
  num projeto lucrativo.

## 2.7 Uso do plano (as barras 5H e SEMANA)

**O que é.** Quanto da cota de cinco horas e da cota semanal do Claude já foi
consumido.

**De onde vem.** Do próprio Claude Code, que entrega esses números junto de
cada resposta. **O painel não chama API nenhuma para isso.**

**Por que importa.** Decide se ele pode disparar mais agentes agora ou se
precisa esperar a janela virar. Com 15 agentes em paralelo, estourar a cota
para o dia inteiro é um erro caro e irreversível.

**Consequência que precisa continuar clara na tela:** o número **só anda quando
algum agente responde alguma coisa**. Parado, o painel mostra a última leitura,
e por isso ele mostra também a idade dela. Esconder a idade transformaria um
número velho em número atual.

**Não existe barra do Fable.** Conferido no programa: as janelas são cinco
horas, sete dias, sete dias Opus e sete dias Sonnet. O Fable consome da
semanal. Se você inventar uma barra de Fable, ela vai mentir.

## 2.8 Servidores no ar nesta máquina

**O que é.** Que processos estão escutando porta, qual projeto é dono de cada
um, e há quanto tempo estão de pé.

**Por que importa.** Ele sobe servidor de desenvolvimento o dia todo e esquece.
Servidor esquecido come RAM e, pior, **segura a porta**, e o próximo `npm run
dev` do mesmo projeto morre em silêncio com "porta ocupada". Isso já custou uma
tarde inteira de investigação no lugar errado.

**Botão irreversível:** o "encerrar" mata processo de verdade. Ele tem três
travas, e nenhuma pode ser afrouxada: o PID precisa estar na lista atual, ser
servidor de desenvolvimento, e não estar na lista de protegidos. **A lista de
protegidos contém processos do Windows cuja morte derruba a sessão do usuário.**

## 2.9 As proteções (hooks) e as rotinas dos projetos

**O que é.** Duas listas: os ganchos que interceptam o que os agentes fazem, e
os comandos de rotina (`/start-session`, `/end-session`) copiados dentro de cada
projeto.

**Por que importam.** Ele não lembra o nome de nenhum deles, e **isso é uma
exigência de design, não uma falha dele**. Palavras dele:

> "eu não lembro o que que é reporte guard. Você tem que entender que você lê um
> código e consegue referenciar o que ele é em segundos, o meu cérebro não
> consegue absorver tudo"

E o risco que ele mesmo nomeou:

> "eu acabo virando uma pessoa dependente, quando dá um problema eu nem sei qual
> o problema que está dando, e isso vai me quebrar"

**Regra dura para toda a tela, não só para esta:** o nome da peça nunca é a
informação principal. O que a peça FAZ COM ELE é. "se eu trabalhar e não anotar
no painel, o sistema me obriga a voltar e anotar" vale mais que o nome do
gancho. O nome pode aparecer depois, entre parênteses, uma vez.

**Por que a lista de rotinas existe:** a cópia dentro do projeto vence a
global, então uma rotina boa pode estar desligada em silêncio. Medido: 22
rotinas desatualizadas em 5 projetos, e uma delas se apresentava como sendo de
outro projeto.

## 2.10 A bancada

**O que é.** Camadas de verificação de segurança e qualidade rodadas contra um
projeto.

**Por que importa.** É o que ele mostra ao cliente, e o que o protege de
entregar coisa quebrada. Vale a mesma regra do item anterior: o resultado
precisa ser dito no efeito, não no nome da camada.

## 2.11 A federação (PC e VPS)

**O que é.** O painel roda nas duas máquinas. O PC empurra o estado dele para a
VPS a cada 30 segundos; a VPS nunca alcança o PC, porque o PC está atrás do
roteador de casa.

**Por que importa.** Ele trabalha na rua, pelo celular, olhando a VPS. Sem a
federação, ele veria só metade da frota e tomaria decisão com dado incompleto.

**Consequência de desenho:** o dado da outra máquina **tem idade**, e a idade
precisa aparecer. Um agente que sumiu do PC continua na VPS até o próximo
empurrão.

## 2.12 As notas

**O que é.** Blocos de texto livre que ele digita, guardados na máquina.

**Por que importa.** É o único conteúdo do painel inteiro **que não tem outra
fonte**. Todo o resto é derivado de arquivo de agente, de git, do sistema
operacional. Isso aqui é digitado à mão, e se perder, perdeu.

**Já se perdeu uma vez.** O arquivo amanheceu vazio e duas listas sumiram, sem
que se conseguisse provar quem gravou. Hoje toda gravação faz cópia da versão
anterior, e apagamento total gera uma cópia com data.

**Consequência técnica que amarra o layout:** as notas moram **fora** do bloco
que o painel redesenha a cada dois segundos. Se você mover um campo de texto
para dentro desse bloco, o cursor dele desaparece no meio da frase.

## 2.12b O funil: três telas respondem "o que falta fazer"

Isto não está escrito em lugar nenhum da tela, e é a coisa mais importante da
organização atual. **Três telas respondem a mesma pergunta em níveis
diferentes**, e elas formam um funil:

| Nível | Tela | Pergunta | Fonte |
|---|---|---|---|
| o mais largo | **product backlog** | o que existe para fazer neste projeto, sem dono nem data | o `ROADMAP.md` de cada projeto |
| o do meio | **sprint backlog** | o que está sendo feito AGORA, por qual agente | as tarefas que os agentes escreveram |
| o mais estreito | **o que depende de você** | o que só uma pessoa resolve | pedidos dos agentes e a lista dele |

Os três se ligam **por derivação, nunca por cópia**: a frente que o agente
escreve tem que ser o título de uma seção do roadmap daquele projeto, e é isso
que faz o cartão dizer `projeto › frente` em vez de texto solto.

**O que o inventário provou e o redesenho ainda não resolveu:** nada na tela
diz que são três níveis da mesma coisa. Elas parecem três listas paralelas.
**Tornar o funil visível é requisito**, e criar um quarto nível é o erro a
evitar.

## 2.12c Como as telas se ligam

Quem redesenhar precisa saber que estas ligações existem, senão elas somem sem
ninguém decidir que sumissem:

- **O seletor de projeto do cabeçalho não é só filtro.** Ele é também a entrada
  da tela de segurança: trocar o projeto ali refaz a leitura dela. Sem isso, a
  tela mostraria o resultado de um projeto com o nome de outro.
- **A mesma lista de pendências aparece em duas telas**, alimentada por duas
  rotas diferentes. Marcar num lugar precisa recarregar o outro, senão o item
  volta a aparecer aberto no tique seguinte.
- **O clique no nome do projeto abre o mapa**, que puxa três leituras caras de
  uma vez: o roadmap, as rotas e o estado do git.
- **A tela de agentes e a tela de trabalho leem a mesma coisa** por caminhos
  diferentes: uma direto do fluxo ao vivo, a outra de uma rota que faz contas
  no servidor. As duas precisam concordar.

## 2.13 Máquina, mídia e o resto do rodapé

CPU, RAM, GPU e o que está tocando. **Não são dados de decisão de trabalho**, e
por isso ficam fora da primeira dobra no celular. Existem porque a máquina é
dele e ele opera nela o dia todo.

**A regra é o inverso da dos outros blocos:** aqui, quanto menos aparecer no
caminho da decisão, melhor. Barra de porcentagem de máquina na tela principal é
o que faz um painel de operação virar um painel de observação.

---

# Parte 3: o que já quebrou, e não pode voltar a quebrar

Cada item abaixo custou tempo real. Estão em `CLAUDE.md` com detalhe; aqui está
o que afeta quem mexe na tela.

1. **O painel se redesenha inteiro a cada dois segundos.** Qualquer coisa com
   estado do sistema operacional dentro desse bloco morre: menu aberto, campo
   com foco, seletor de arquivo, popover. Já fechou o menu na cara dele no
   telefone: *"clico lá e aparece cockpit etc, antes de dar tempo de eu clicar
   ele some"*.
2. **O breakpoint é `@container`, nunca `@media`.** Com a coluna de notas
   aberta, a janela continua larga enquanto o painel encolhe. Uma media query
   nunca dispararia e a tabela quebraria em vez de compactar.
3. **Um container query não pode estilizar o próprio elemento que declara o
   container.** A regra é ignorada em silêncio. Isso derrubou a barra lateral
   por cima do conteúdo em 19/08.
4. **Captura de tela estreita mente por 28% nesta máquina**, por duas causas
   independentes: a escala de tela do Windows e o depurador conectando na aba
   errada. Use `tools/capturar-tela.mjs`, que valida a largura e recusa a
   imagem quando ela não bate.
5. **Regra global de tag colide com componente.** Já aconteceu três vezes, com
   `<header>`, `<footer>` e `<h1>`. Escope pelo pai.
6. **Cor de estado como fundo torna o texto ilegível.** Cor de estado é texto,
   borda ou fio, nunca preenchimento.
7. **Ordem de lista não pode mudar por contador de tempo.** Se a lista
   reordena a cada dois segundos, a linha foge do dedo no instante do toque.
8. **O servidor não recarrega módulo.** Mexeu em `src/`, reinicie o processo,
   senão você valida código velho achando que é novo.

## O que fica fora do bloco redesenhado, e por quê

Se você mover qualquer um destes para dentro do conteúdo principal, quebra na
hora, e o defeito é sempre o mesmo: o elemento morre no meio do uso.

| Peça | Por que está fora |
|---|---|
| a coluna de notas | textarea perde o cursor no meio da frase |
| o editor de documento | mesmo motivo, e é uma janela própria |
| a gaveta de ajustes | painel sobreposto morreria debaixo do dedo |
| o aviso do rodapé | e ele fica dentro do painel, não do conteúdo, senão nasce por cima da barra de baixo no celular |
| o player de mídia | o controle de volume perde o arrasto |
| a faixa de hardware | atualiza no ritmo próprio, não no do conteúdo |
| os popovers | popover aberto dentro do bloco fecha sozinho em até dois segundos |

E, pelo mesmo motivo, **estes estados moram em memória e não na tela**: o texto
do campo de busca do glossário e dos documentos, o rascunho da entrevista, o
formulário de projeto novo, a visão escolhida da tela de trabalho, e a rotina
aberta. Um campo que guarda o próprio valor só no elemento perde o que foi
digitado no primeiro redesenho.

## Duas guardas que já existem, e que você precisa manter

1. **O redesenho para enquanto há campo com foco.** Sem isso, digitar em
   qualquer campo do conteúdo é impossível.
2. **O snapshot de dados também espera.** Trocar o dado no meio da edição é
   pior que redesenhar: os índices mudam sob a edição, e o que ele digitou vai
   parar em outro item. Isso já apagou uma tarefa de verdade.

---

# Parte 3b: os botões que fazem coisa irreversível

Estes precisam continuar difíceis de apertar por acidente, e continuar dizendo
o que vão fazer ANTES de fazer. Se o seu redesenho os transformar em ícone
bonito sem rótulo, ele fica pior mesmo parecendo melhor.

| Onde | Botão | O que faz de verdade |
|---|---|---|
| servidores | **encerrar** | mata o processo. Dois cliques: o primeiro arma, o segundo executa. Três travas no servidor: precisa estar na lista atual, ser servidor de desenvolvimento, e não estar na lista de protegidos (que inclui processos cuja morte derruba a sessão do Windows) |
| servidores | **fechar N duplicados** | mata vários processos em série, um de cada vez de propósito: cada morte invalida a lista, e é ela que autoriza a próxima |
| servidores | **subir** | lança um comando que ele digita, numa janela própria. A pasta é validada contra a base de projetos, para o painel não virar executor de comando em qualquer lugar do disco |
| VPS | **atualizar** | abre SSH real na produção com a chave privada dele. **Nunca pode virar timer.** É a única chamada de rede perigosa do painel inteiro, e o recurso foi desenhado inteiro em volta disso |
| VPS | **salvar** (conexão) | grava host, usuário e caminho da chave privada. O caminho da chave nunca é devolvido na leitura |
| hooks | **cada interruptor** | muda o comportamento dos agentes em TODOS os projetos, não só no atual |
| hooks | **provar agora** | roda ~28 scripts em série, dezenas de segundos |
| tempo | **reler transcritos** | joga fora o cache e relê centenas de MB |
| tempo, preço | **campos de taxa, assinatura, dólar** | gravam configuração. Taxa zero não é "de graça", é "não configurada": gravar zero num projeto apaga a taxa dele e ele volta à global |
| gráficos | **✕ remover** e **voltar aos prontos** | gravam na hora, sem confirmação. "Voltar aos prontos" apaga todos os gráficos que ele montou |
| escritório | **desligar** | mata o processo do painel embutido, sem confirmar |
| sprint | **marcar todas como feitas** | fecha todas as tarefas de um agente de uma vez. Sem desfazer |
| sprint | **campo de tarefa deixado em branco** | apaga a tarefa. Não parece um botão, e é |
| cockpit | **vi isso** e **vi tudo, pode zerar** | apagam a marca de "o que mudou desde que você olhou". O que passou não volta |
| remoto | **desligar** | derruba a sessão, e a conexão do celular cai junto. **É o único desta lista que já avisa isso na confirmação** |
| remoto | **gerar** (token) | sobrescreve o token na tela sem confirmar. Salvar depois disso quebra a ligação com a outra máquina |
| qualquer lista de tarefas | **marcar um item** | escreve no arquivo do agente, que é de outro processo |

---

# Parte 3c: os defeitos que existem hoje, achados ao escrever este guia

Nenhum foi corrigido: a tarefa era escrever o guia. Estão aqui para o próximo
agente decidir com o Felipe o que entra primeiro. Vêm agrupados por família,
porque a maioria é o mesmo erro repetido, e consertar a família vale mais que
consertar um item.

## Família A: erro de leitura se disfarçando de "não tem nada"

**É a família mais grave, e a régua 5 do projeto já a proíbe por escrito.** Ele
confia no silêncio da tela: se a lista está vazia, ele conclui que não há nada
a fazer. Uma tela que fica quieta quando na verdade falhou mente para ele
exatamente no momento da decisão.

**Onze telas caem nisso. Só uma faz certo** (o cockpit, que distingue erro de
vazio).

| Onde | Como falha hoje |
|---|---|
| **o que depende de você** | **o pior de todos.** Falha vira lista vazia, e a tela anuncia em VERDE "Nada depende de você agora". O erro é apresentado como boa notícia |
| remoto | falha deixa a tela em "carregando…" para sempre |
| servidores | idem, "lendo as portas em escuta…" para sempre |
| VPS | idem |
| hooks | idem |
| escritório | falha vira "nenhum painel configurado" |
| recados entre agentes | falha vira "nenhuma sessão trocou recado ainda" |
| docker | falha e "docker não instalado" somem exatamente igual, sem texto |
| processos | falha volta ao botão "ler processos", igual a "nunca li" |
| prova dos hooks | o erro é guardado num campo que **nunca é desenhado**: a barra diz "0 provada(s), 0 com defeito" como se tudo tivesse corrido bem |
| fila perdida | mesma coisa: o erro é gravado e nunca mostrado |

**O conserto é um só, e vale para todas:** um terceiro estado explícito, além
de "carregando" e "vazio". A frase precisa dizer que a leitura falhou, e
oferecer tentar de novo.

## Família B: ação destrutiva sem confirmação

Hoje a confirmação é inconsistente: duas ações pedem, quatro não, e não há
critério visível separando as duas listas.

| Ação | Confirma? | O que faz |
|---|---|---|
| desligar sessão remota | **sim**, e a frase avisa que a conexão do celular cai junto | derruba a sessão |
| desligar proteção do framework | **sim**, listando o que se perde | muda o comportamento dos agentes |
| desligar painel do escritório | **não** | mata um processo |
| "marcar todas como feitas" | **não** | fecha todas as tarefas de um agente de uma vez, sem desfazer |
| remover uma pendência sua | **não** | apaga |
| apagar tarefa deixando o campo em branco | **não**, e nem é óbvio que apaga | apaga |
| "voltar aos prontos" nos gráficos | **não** | apaga todos os gráficos que ele montou |

**Critério que resolveria:** confirma o que apaga trabalho dele ou derruba
processo; não confirma o que é reversível com um segundo clique.

## Família C: código que não roda, e texto que descreve tela que não existe

| Onde | O defeito |
|---|---|
| aba "o que depende de você" | **o contador vermelho dela nunca acende.** A regra existe no código, mas o número que ela lê nunca é preenchido. É a mesma regra que eu escrevi hoje, e ela nunca chegou a rodar |
| gaveta de ajustes | o clique chama uma função **que não existe**. Efeito medido: a gaveta **abre** em 120ms, mas **fechar no ✕ leva 2,7 segundos**, porque só some no próximo desenho automático. Com a tela congelada para print, não abre de jeito nenhum. Conserto: uma linha |
| rodapé de quatro telas | `meu`, `glossário`, `documentos` e `bancada` não têm a frase de explicação que todas as outras têm |
| rodapé do cockpit | descreve uma tela que foi **removida em 17/08**: fala em "clique no nome do projeto para o mapa", coisa que não existe mais ali |
| formulário da agenda | os campos são lidos direto da tela, sem cópia em memória. É a forma exata de um defeito já pago duas vezes: **o texto digitado morre no redesenho**. O remédio já existe em duas outras telas e não foi aplicado aqui |

## Família D: a mesma tarefa com três códigos diferentes

Na tela de trabalho, a mesma tarefa aparece com identificador diferente
dependendo da visão: uma usa o código que o agente escreveu, outra usa a
posição na lista (`S1`, `S2`), a terceira monta um código composto.

Isso importa porque **o código é como ele fala da tarefa em voz alta**. Três
notações para a mesma coisa, na mesma aba, quebram a única função que o código
tem.

## Duas coisas do preço que não são bem defeito, mas enganam

- Depois de digitar um valor de hora à mão, o botão "buscar de novo" fica mudo
  para sempre, e continua clicável como se funcionasse.
- Digitar o valor de UM nível achata a faixa dos outros dois, e a tela passa a
  mostrar "de R$ 150,00 a R$ 150,00".

---

# Parte 4: o estado hoje

## O que existe e funciona

**As 17 telas**, todas com dado real, sem nada inventado. O inventário completo
está em [[../produto/TELAS]].

O painel novo (`src/ui_v2.html`, servido em `/v2`) **nasceu como cópia do
antigo com a aparência refeita**, exatamente para que nada se perdesse. Isso foi
verificado, não assumido: as 17 telas foram abertas nos dois painéis e
comparadas por texto visível e por contagem de elementos (desenhos, botões,
campos, links). **Zero diferença.**

## O que mudou na aparência, e por quê

| Mudança | Motivo |
|---|---|
| Chão quase preto, fontes Outfit e JetBrains Mono | direção escolhida por ele depois de ver propostas de outras IAs |
| Tema claro virou cinza neutro | era papel esverdeado, do mundo visual anterior |
| Barra lateral com 6 seções abertas no monitor | os 17 destinos ficam à vista; antes eram dois cliques |
| No celular, barra de baixo com 4 alvos mais "mais" | seis alvos não cabem em 390px |
| Cor de acento virou turquesa | o acento anterior era quase idêntico ao verde de "feito", e toda aba selecionada dizia "feito" sem querer |
| Total de tokens saiu do cabeçalho | número solto sem frase, que não mudava decisão nenhuma |
| Cada linha da fila ganhou frase e ação ao lado | antes dizia projeto, assunto e idade: três fatos, nenhuma instrução |

## O que falta

1. **A tela principal ainda não tem o formato de cartão por projeto** com os
   agentes dentro e o avanço por frente. É a próxima fatia, e é onde o desenho
   de referência mais se distingue do que existe.
2. **O sistema de ajuda "?"** existe como conceito (quatro campos: o que é,
   o que acorda, o que mata, exemplo) e ainda não tem os textos escritos. Foi
   decidido que cada tela nasce com os dela.
3. **A tela de painéis montados por ele.** Ideia dele, registrada com as
   palavras dele no `ROADMAP.md`: escolher módulos de qualquer seção, montar
   painéis próprios e trocar entre eles por atalho. **A peça que torna isso
   possível já existe em miniatura**, no registro de blocos da janela flutuante:
   cada bloco tem id, rótulo e duas formas de desenho, e a escolha é gravada no
   servidor. Bloco novo que você criar deve nascer registrado assim.

---

# Parte 5: como provar que você não quebrou nada

Nesta ordem, e nenhuma etapa é opcional:

1. **`npm test`.** É o gate único do projeto.
2. **Captura validada em 390px e no monitor, nos dois temas**, por
   `tools/capturar-tela.mjs`. Ele recusa a imagem quando a largura não bate.
3. **Contraste medido** por `tools/contraste.mjs`, contra o fundo E contra o
   cartão. Medir só contra o fundo já reprovou duas vezes: quase todo texto
   mora dentro de um cartão mais claro que a página.
4. **Teste de interação com o fluxo LIGADO**, sem congelar a página. A classe
   de defeito mais cara deste painel só existe com o redesenho de dois em dois
   segundos rodando; com ele desligado o teste passa sempre e não prova nada.
5. **O teste que só ele faz:** abrir no telefone e dizer se está bom de usar.

**Teste verde não é prova visual.** Já houve 545 testes passando com a tela
quebrada no navegador. Se você não conseguiu ver, diga que não conseguiu ver,
em vez de descrever a intenção como se fosse resultado.

---

# Parte 6: como falar com ele sobre o que você fez

Isto não é etiqueta, é o que faz a informação chegar.

- **A primeira frase é o que mudou para ele.** Sem contexto, sem recapitulação.
- **Nunca cite o nome de uma peça como se ele soubesse o que é.** Diga o que ela
  faz com ele.
- **Se ele repetir o mesmo pedido pela segunda vez, pare de codar.** Na
  evidência acumulada, a causa quase nunca é implementação errada: é a mesma
  palavra significando coisas diferentes nas duas cabeças. Pergunte o que a
  palavra quer dizer.
- **O mecanismo que ele nomeia é o pedido.** Se ele disse "linhas", "refazer",
  "levemente", isso é a especificação. Se você acha que está errado, diga antes,
  nunca entregue a troca como fato consumado.
- **Mensagem longa que abre com "e se" ou "tive uma ideia" é visão, não
  tarefa.** Registre com as palavras dele, e execute depois.
- **Ordem curta é para executar e calar.** Em "sobe dev server", "commit",
  perguntar se pode confirmar é ruído.
- **Prova visual antes de dizer "feito".** Entregar sem imagem ou URL é o
  gatilho número um de retrabalho.
