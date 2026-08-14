---
tags: [plano, framework]
tipo: plano
atualizado: 2026-08-14
estado: análise conceitual fechada, aguardando ordem de implementar
resumo: O caminho para o framework de engenharia sair de gate de MVP solto e virar sistema. Nasceu de um erro real, inofensivo, em que a IA implementou sem pedido durante uma conversa de conceito.
termos:
  modo conversa: estado em que discutir é permitido e escrever código é recusado
  gate: hook que recusa a ferramenta com exit 2 e devolve o motivo pro modelo
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

### F1. O modo conversa (o gate que faltou hoje)

O que resolveria o erro deste documento. O estado ganha `modo`:

- **`conversa`**: escrever em código é recusado. Documento, backlog e o próprio
  estado continuam livres, porque é o que a conversa produz.
- **`execucao`**: como é hoje.

Mecânico, sem julgamento: o hook não tenta adivinhar se houve pedido, ele lê um
interruptor. Quem liga e desliga é o Felipe, por botão no painel ou por uma
frase que ele já usa naturalmente ("pode implementar", "vamos testar").

Ponto a decidir na hora: se a IA pode voltar para `execucao` sozinha ao receber
ordem explícita, ou se só o Felipe troca. A versão segura é só ele.

### F2. O ponto onde o humano aprova (risco 1)

Um lugar minúsculo, no cockpit, onde ele confirma que algo está pronto de
verdade. Sem isso, "pronto" é a IA se auto-avaliando, e este projeto já tem a
evidência de que isso falha (545 testes verdes com a tela quebrada).

Regra de desenho: um botão e uma frase. Nunca um documento para ler.

### F3. Interface de uso (`cc framework`)

Hoje o MVP se registra editando JSON à mão — foi como eu me destravei, e é a
prova de que está errado. Comandos: iniciar, status, mvp, avançar, modo, mudar
escopo.

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

## Fora deste plano, de propósito

- **Gate de documentação** (recusar fechar sessão com concluído parado no
  ROADMAP). É irmão do F1 e sai barato junto, mas é outro assunto: organização,
  não engenharia de software.
- **Redesign das abas.** Decidido em 14/08, pendente, e cresceu de urgência:
  são 14 abas agora, duas delas criadas no erro que abriu este plano.

## Verificação

O de sempre neste projeto, e vale lembrar por que: **prova na tela antes de
"feito"**. Para o F1 especificamente, o teste é auto-referente e é o melhor
possível — ligar o modo conversa e confirmar que **eu** sou recusado ao tentar
editar `src/`, do mesmo jeito que o gate de MVP me recusou em 14/08.
