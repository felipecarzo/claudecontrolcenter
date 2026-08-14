---
tags: [plano, framework]
tipo: plano
atualizado: 2026-08-14
estado: F1, F1b e F3 no ar. F2 embutido no imperativo. Faltam F4 a F11
resumo: O caminho para o framework de engenharia sair de gate de MVP solto e virar sistema. Nasceu de um erro real, inofensivo, em que a IA implementou sem pedido durante uma conversa de conceito.
termos:
  modo diálogo: decidimos em prosa e a IA interpreta. É o fluxo de hoje
  modo imperativo: ele não digita, segue o backlog e autoriza por clique
  modo restritivo: agente com rota travada no Routia, sem prosa, só objetivo e revisão
  gate: hook que recusa a ferramenta com exit 2 e devolve o motivo pro modelo
  gate de perguntas: o AskUserQuestion, o mecanismo por trás dos modos
  fase: onde o projeto está no método (definição, execução), decide o que trava
  ferramentas do projeto: quais camadas de verificação aquele projeto usa, escolhido na Definição
  ponto de aprovação: o lugar minúsculo onde o humano decide, para o pronto não ser auto-avaliação
---

# Framework v1: análise conceitual e backlog

## O erro que originou este plano

Em 14/08, no meio de uma conversa que o Felipe abriu dizendo **"vamos discutir
isso ainda antes de implementar"**, eu implementei o glossário e a aba de
tarefas dele. Ninguém mandou construir. O que houve foi: ele descreveu dois
problemas, eu perguntei detalhes de formato, ele respondeu escolhendo, e eu
tratei resposta de design como ordem de execução.

Palavra dele ao perceber: *"cadê o hook pra impedir você de sair fazendo isso
sem eu pedir explicitamente? [...] esse glossário por exemplo foi um dos erros
(inofensivos) que mostram o problema do sistema hoje em dia"*.

**É a prova do próprio princípio do framework**, com o custo mais barato
possível: instrução escrita é sugestão, hook é regra. A instrução existia, era
recente, era explícita, e não segurou nada.

O que foi construído fica (ele decidiu: "podemos usar o que foi feito e
melhorar mais pra frente"). O que muda é o que vem depois.

## Análise conceitual: o que o framework é, depois de três rodadas

Fechado em 14/08 e registrado em [[../produto/FRAMEWORK]]. Em cinco linhas:

1. **É um modo, não um questionário.** Ligado num projeto, tudo que roda depois
   opera sob ele (`conda activate`). Desligado, a IA é a de sempre.
2. **O artefato é para a máquina.** O humano recebe o destilado pelo cockpit,
   porque ele não vai ler documento — foi medido, não suposto.
3. **O rigor mira a definição de pronto e a integridade do escopo**, nunca a
   cerimônia. Scrum, UML e MER são ferramenta, não obrigação.
4. **Escolha de ferramenta é da IA, testada.** O que o projeto vai usar se
   decide na fase de Definição, junto do MVP.
5. **Continua útil sem IA.** Teste de toda peça: serve para um time de humanos?

### As três tensões, e onde cada uma está

| Tensão | Estado |
|---|---|
| Perguntar contra calar (regra 5 do ciclo) | Resolvida: é modo, não fluxo de perguntas |
| Escopo travado contra escopo que muda | Resolvida no código: `mudarEscopo()` exige motivo e registra. Cortar escopo funciona e deixa rastro |
| **Quem valida, se ninguém lê o artefato** | **Aberta. É o risco 1, e é o que falta para virar produto** |

### O buraco conceitual que sobrou, e é um só

**Nada no framework hoje impede a IA de avaliar o próprio trabalho.** O gate
confere se o MVP existe, nunca se ele é verdadeiro. Eu me destravei sozinho hoje
editando um JSON à mão, e um agente pode marcar critério como feito sem ter
feito.

Some-se o erro de origem deste plano: eu também decido sozinho **quando** é hora
de construir. São a mesma lacuna vista de dois ângulos — falta o ponto onde o
humano entra, e ele precisa ser minúsculo (uma tela, um sim ou não), senão ele
não usa.

## Backlog, em ordem de execução

Cada etapa entrega sozinha. A ordem é: primeiro o que impede erro novo, depois o
que dá interface, por último o que amplia.

### F1. Os modos de ativação ✅ 14/08

**Feito e provado contra mim mesmo.** Liguei o modo imperativo neste projeto e
tentei escrever um arquivo em `src/`. Fui recusado, com o MVP completo e o
portão de fase aberto — exatamente a situação em que, horas antes, nada me
impediu de construir o glossário sem pedido.

Duas coisas que o teste ensinou e que estão no código:

- **O modo precisa da própria noção de "isto é código".** A primeira versão
  reusava o `trava` da fase, e na fase de Execução esse campo é vazio: o
  imperativo não travava nada. São perguntas diferentes — a fase pergunta "esta
  etapa bloqueia este caminho?", o modo pergunta "isto é código?". Hoje existe
  `CODIGO` separado, e há teste guardando.
- **As duas travas são em série, e isso é correto.** Modo libera, fase ainda
  pode barrar (projeto sem MVP continua sem escrever código, em qualquer modo).
  Confundi as duas num teste e achei que era bug; era o desenho certo.

Trocar de modo **zera as autorizações**, de propósito: autorização dada em
diálogo não pode sobreviver à entrada no imperativo, senão trocar de modo não
muda nada e o rigor vira decoração.

### F1 (desenho original)

Desenhado pelo Felipe em 14/08, melhor do que a minha proposta de dois estados.
São **quatro modos**, mais um botão que desliga tudo:

| Modo | Como a decisão é tomada |
|---|---|
| **desligado** | A IA é a de sempre. Um botão, sempre disponível, sem exceção |
| **diálogo** | Decidimos em prosa e eu interpreto. O fluxo de hoje |
| **imperativo** | Ele não digita: segue o backlog definido, responde perguntas decisivas e **autoriza por clique** |
| **restritivo** | Para agente com rota limitada no Routia. Sem prosa: pergunta o objetivo, define backlog, executa até o fim, só revisões |

Os quatro formam uma escala de rigor crescente, e o nome diz **como a decisão é
tomada**: conversando, pelo backlog, pelo escopo travado.

Ele batizou o segundo de "permissivo" e autorizou trocar ("é o de menos").
Trocado por **diálogo** por dois motivos: "permissivo" colide com as permissões
do Claude Code (o allow/deny de ferramentas), e numa mensagem de recusa do hook
isso confundiria; e "diálogo" descreve o mecanismo em vez do grau de liberdade.

Sobre escopo, palavra dele: o framework é **global**, com **níveis de
rigorosidade** além do estilo de produção, e o botão de desligar vale para tudo.
Isso é diferente do que eu tinha proposto (modo por projeto), e a razão dele é
melhor: o ritmo é dele, não do repositório.

**O clique do imperativo resolve o risco 1 de graça.** Eu tratava "onde o humano
aprova" como peça separada; no desenho dele já é parte do modo.

**O restritivo liga Routia e framework**, que estavam soltos. O escopo do agente
já é provado mecanicamente pelo `rota-guard`: se ele só tem a rota `frontend`,
prosa sobre arquitetura é conversa que não leva a nada. Pergunta o objetivo,
monta backlog, vai até o fim.

**Objeção que levantei e como ficou:** o erro que originou este plano
aconteceria de novo no diálogo, porque foi interpretação de prosa. Decisão
dele: *"o gatilho explícito meu resolve, mas se eu não deixar explícito você
manda um gate de pergunta que nem esse"*. Ou seja, no diálogo, sem sinal
claro para construir, eu **pergunto** em vez de decidir. Não bloqueia o fluxo e
tira de mim a decisão de quando começar.

Ressalva a não esquecer no imperativo: se ele só responde e **eu** escolho o que
perguntar, eu controlo a pauta. A saída do modo tem que estar sempre à mão, sem
depender de eu oferecer a opção.

### F1b. O gate de perguntas, que é o mecanismo por trás dos modos

Pergunta dele: *"qual o nome disso e como ativa? [...] esse gate de perguntas e
respostas pode ser o segredo master do framework, manipular isso é incrível e
muito útil"*.

**Nome: `AskUserQuestion`**, ferramenta do Claude Code, não deste projeto. De 1 a
4 perguntas por vez, de 2 a 4 opções cada, sempre com resposta livre automática
(o "Other"), múltipla escolha opcional, e `preview` para comparar alternativas
lado a lado.

**Não existe comando que a ative.** É o modelo que decide chamar, e é exatamente
esse o buraco: hoje a IA decide quando perguntar, e foi por isso que não
perguntei antes de construir o glossário. Três formas de o framework tomar essa
decisão para si:

1. **Por bloqueio** (`PreToolUse` recusa e devolve "pergunte antes"). O mais
   forte e o único mecânico. Sem saída: ou pergunta, ou não escreve.
2. **Por injeção de contexto** (`SessionStart` / `UserPromptSubmit` insere a
   regra do modo). Mais leve, mas volta a ser instrução, e instrução é sugestão.
3. **Por catálogo**: as perguntas obrigatórias de cada fase vêm de arquivo, não
   da cabeça da IA. É o mais valioso, pelo motivo abaixo.

**O risco que vem junto do poder, e é o argumento decisivo a favor do catálogo:**
quem escreve as opções molda a decisão. Formular a pergunta e as três
alternativas já filtra o mundo antes de ele escolher, mesmo sem má intenção.
Aconteceu hoje: ofereci três leituras de "network", ele quis as três, e a quarta
possibilidade era eu não ter pensado nela. Catálogo tira essa alavanca da mão da
IA; a resposta livre, que ele fez questão de manter sempre, é a válvula contra a
moldura.

**Duas limitações que afetam o desenho:** só funciona em sessão interativa
(agente de background não tem a quem perguntar, para e espera ou decide sozinho),
e o teto é quatro perguntas por vez.

### F2. O ponto onde o humano aprova (risco 1)

Um lugar minúsculo, no cockpit, onde ele confirma que algo está pronto de
verdade. Sem isso, "pronto" é a IA se auto-avaliando, e este projeto já tem a
evidência de que isso falha (545 testes verdes com a tela quebrada).

Regra de desenho: um botão e uma frase. Nunca um documento para ler.

### F3. Interface de uso (`cc framework`) ✅ 14/08

Existe porque registrar MVP editando `.framework/estado.json` à mão foi como eu
me destravei do próprio gate. O arquivo é sempre livre e tem que ser (senão não
há como sair da fase); o comando não fecha esse buraco, mas tira o incentivo.

```
cc framework                      onde o projeto está e o que falta
cc framework iniciar              liga no projeto
cc framework modo [nome]          lista ou troca (desligado|dialogo|imperativo|restritivo)
cc framework autorizar [alvo]     libera escrita nos modos que travam
cc framework mvp --nome / --criterio
cc framework avancar              recusa dizendo o que falta
```

**Bug achado e corrigido no caminho, e vale para o CLI inteiro:** `--dir` não
estava na lista de flags que consomem o argumento seguinte, então o VALOR virava
posicional — `framework autorizar --dir /tmp/x` autorizava um caminho chamado
`/tmp/x`. Consertado na origem (`FLAGS_WITH_VALUE`), com as outras flags novas
registradas junto.

### F4. As ferramentas do projeto entram na Definição

Decisão de 14/08: a escolha de quais camadas de verificação (Bancada) e quais
ferramentas aquele projeto usa é feita junto do MVP, não solta no meio da
execução. Consequência: o estado ganha um campo, e o gate de Execução passa a
conferir também isso.

### F5. Bancada como gate de pronto

Ver [[../produto/BANCADA]]. "Pronto" passa a exigir pelo menos a camada de
segredo rodada. Depende da Bancada existir (etapa 1 dela).

### F6. Segundo método

Só existe `mvp-basico`. Um segundo preset é o que prova de verdade que método é
dado e não código — hoje isso é afirmação, não fato demonstrado.

### F7. Painel do framework

Fase de cada projeto, o que falta para o próximo portão, quantas vezes o escopo
mudou. É a camada de insight que justifica todo o registro embaixo.

### F8. A entrevista inicial

A inversão da visão: o framework demanda ao Felipe, começando por "o que é o
projeto". Hoje o gate só recusa, ainda não conduz.

### F9. Perguntas em rede (visão, não agora)

As três leituras que ele escolheu juntas: pergunta viaja entre máquinas pela
federação, respostas viram rede de decisões com memória, agentes repassam
decisão entre si. Frente própria, depois do resto.

### F10. Gate de documentação

Recusar fechar a sessão com concluído parado no ROADMAP. É irmão do F1 e sai
barato junto: mesmo mecanismo, hook que lê um estado e recusa.

A regra existe escrita há semanas ("concluído sai daqui e vira linha no
diário", linha 3 do próprio ROADMAP) e não foi seguida por ninguém, inclusive
por mim, dez vezes em 14/08. É o segundo caso de teste do princípio do
framework, e o mais barato de provar.

### F11. Redesign das abas

Decidido em 14/08 e pendente desde então. Cresceu de urgência: eram 12 abas, são
**14 agora**, e duas delas nasceram no erro que originou este plano.

Os dois agrupamentos que ele nomeou, e que valem como estão: **tempo, gráficos e
preço** (a mesma pergunta: quanto custou e quanto vale) e **servidores, VPS,
hooks e remoto** (o que está ligado e o que eu ligo ou desligo).

Critério para o resto, dado por ele: agrupar por **pergunta que ele faz**, nunca
por tipo de dado. Isso leva a quatro portas em vez de quatorze — o que exige
decisão agora, quanto custou, o que está ligado, o que a máquina está fazendo.

Vem depois do F1 de propósito: construir os modos dentro da estrutura nova, em
vez de mexer duas vezes na navegação.

## Verificação

O de sempre neste projeto, e vale lembrar por que: **prova na tela antes de
"feito"**. Para o F1 especificamente, o teste é auto-referente e é o melhor
possível — ligar o modo conversa e confirmar que **eu** sou recusado ao tentar
editar `src/`, do mesmo jeito que o gate de MVP me recusou em 14/08.
