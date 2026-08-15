---
tags: [produto, visao]
tipo: visao
atualizado: 2026-08-14
estado: registrada, não implementar
---

# O framework de engenharia de software

Visão do Felipe, ditada em 14/08 pela VPS, no celular, em duas rodadas: a
primeira definiu o que é, a segunda corrigiu o rumo e resolveu quase todas as
tensões abertas. **Registrada, não planejada e não implementada** (regra 4 do
ciclo). Este arquivo existe para que a sessão de visão comece do que ele disse,
não do que alguém lembrou que ele disse.

## O que é, na frase dele

> "o framework eh como se fosse um framework qualquer de programação voltado pra
> desenvolvimento de software e engenharia de software com ia (e sem ia
> futuramente)"

Framework no sentido de Rails ou Django: uma estrutura que diz como se constrói.
Só que o domínio não é web, é **o processo de engenharia de software**.

## O modelo mental é o conda, não um questionário

Correção que ele fez na segunda rodada, e que muda o desenho inteiro:

> "Ele não funciona como uma estrutura definitiva de perguntas, mas é como por
> exemplo o Conda, de Python, sabe? [...] Um que guie o que você está fazendo com
> o IA até um final do projeto e que isso seja imperativo"

O que a analogia carrega, e é o essencial: `conda activate` **muda o contexto de
tudo que roda depois**, sem você repetir nada a cada comando. O framework é
ligado no projeto e, dali em diante, a sessão inteira opera sob ele.

**Ativável e desligável, de propósito.** Desligado, a IA continua sendo o que
é hoje, e isso é desejado, não tolerado:

> "Não uma IA generativa que eu possa discutir o que eu quiser o tempo todo, mas
> na verdade isso é bom que ela seja exatamente como é. Mas de forma que se
> ativar ou desativar, o projeto passa a ser imperativo"

Ligado, ele manda:

> "Ele é que demanda seguir o backlog e executar a estrutura determinada pro MVP.
> E se não tiver MVP, ele vai obrigar a gente a criar."

## Para quem o artefato serve, que é o ponto mais original

Segunda correção, e a mais valiosa. A estrutura **não existe para o humano ler**:

> "uma estrutura que visa beneficiar apenas os agentes de IA e não humano, e que
> a partir dos dados que esses dados vão gerar, é que eu vou gerar ferramentas
> que me dão os insights que eu como humano posso entender. É muito melhor do que
> a gente tentar construir uma forma que a IA trabalhe registrando [documentação
> modelar] porque é inviável, **eu nunca leio a quantidade de documentos**."

Consequências diretas de desenho:

- Artefato de processo é **entrada de máquina**, não entregável de leitura. Não
  precisa ser bonito nem narrativo; precisa ser consumível e verificável.
- O que chega ao Felipe é **destilado**: o cockpit é a camada de insight, e é ela
  que justifica todo o registro embaixo.
- Isto separa a ideia de todo o spec-driven do mercado, que produz especificação
  para o humano aprovar. A pesquisa de 13/08 mostrou que nenhum deles bloqueia, e
  o repo do próprio `spec-kit` tem relato de agente codando antes do `/specify`.

## Scrum, UML e MER: meio, não obrigação

Terceira correção. Ele recuou do "à risca" como formalismo:

> "não vamos ser restritos ao Scrum, MER, UML etcétera. Apesar de eu achar
> interessante."

Mas o rigor continua, e agora com o motivo explícito, que é outra coisa:

> "eu queria que fosse bem rígido com o Scrum nesse sentido de que essas regras de
> engenharia de software elas são muito boas pra determinar a **definição de
> pronto**, pra determinar se a gente já chegou no MVP que a gente julgou viável
> no início e não mudou os prazos, não mudou o produto final, esse tipo de
> pergunta filosófica, que tem que entrar como um questionamento filosófico e
> científico da definição de pronto."

Ou seja: **o alvo é a definição de pronto e a integridade do escopo**, não a
cerimônia. Scrum entra como fonte de regras testadas para responder três
perguntas, que são o coração do framework:

1. Isto está pronto, pelo critério combinado antes de começar?
2. Chegamos no MVP que julgamos viável no início?
3. O prazo e o produto final continuam os mesmos que definimos, ou mudaram sem
   ninguém declarar que mudaram?

UML e MER seguem interessantes e provavelmente úteis como estrutura que o agente
consome, mas não são requisito da visão.

## Os atributos que sobraram

- **Agnóstico de linguagem**, para qualquer projeto ou software.
- **Imperativo quando ligado**, conversacional quando desligado.
- **A inversão**: ligado, o framework demanda ao Felipe, começando por "o que é o
  projeto" e encadeando conforme as respostas. Não é questionário fixo, é
  consequência de estado.
- **O cockpit de hoje continua**, palavra dele: "ele está bom na linha que está".
  Acréscimo, não troca.
- **Sem IA um dia**: "A gente pode pensar num dia no futuro de fazer sem IA
  também". Teste de desenho para toda peça: continua útil para um time de humanos
  sem IA nenhuma?

## Tensões

Três das quatro que estavam abertas foram resolvidas por ele na segunda rodada:

- **Perguntar contra calar** (brigava com a regra 5 do ciclo). Resolvida: não é
  fluxo de perguntas, é modo. Ligado, ele demanda; desligado, silêncio e execução
  como hoje.
- **Scrum à risca contra agnóstico.** Resolvida: o rigor é sobre definição de
  pronto e escopo, não sobre cerimônia.
- **Diagrama antes de código.** Dissolvida: o artefato é para a máquina, então a
  pergunta deixa de ser "como manter documentação viva" e passa a ser "que modelo
  o agente consegue consumir e verificar".

### Risco 1: quem valida o artefato, se ninguém o lê

O maior. Se o registro é para a IA e o humano só vê o destilado, **a definição de
pronto vira auto-avaliação do agente**. Este projeto já tem a evidência de que
isso falha: 545 testes verdes com a tela quebrada no navegador, e a regra 1 do
ciclo nasceu exatamente daí.

O framework precisa de um ponto onde o humano decide, e esse ponto precisa ser
minúsculo: uma tela, um sim ou não, nunca um documento. Onde exatamente ele fica
é trabalho da sessão de visão.

### Risco 2: escopo travado contra escopo que muda de verdade

O framework trava prazo e produto final combinados no início. Mas mudar de ideia
no meio é o comportamento real e legítimo dele, medido: a regra 4 do ciclo existe
porque visão nova aparece o tempo todo, e o reposicionamento de 13/08 mudou o
backlog inteiro num dia.

Trava dura tem dois desfechos previsíveis: ou ele desliga o framework, ou burla.
O desenho precisa de um caminho legítimo de mudança de escopo, que registre a
decisão em vez de bloqueá-la. A pergunta científica que ele quer ("mudou o
produto final?") só tem valor se a mudança for **declarável**, não proibida.

## O que já existe e é fundação disto

- **Método Routia**: coordenação de trabalho paralelo com gate real, rodando.
- **Framework de hooks** ([[FRAMEWORK-HOOKS]]): gate dentro do loop do agente,
  mais o CC-31 (metodologia, UML e MER, já planejado).
- **Cockpit** ([[COCKPIT]]): a tela e as métricas, que na visão nova é a camada
  de insight que justifica o registro.
- **Ciclo** ([[CICLO]]): as sete regras medidas do jeito dele trabalhar, que são
  o que impede isto de virar burocracia genérica.

**O cockpit é a tela. Os hooks são o sensor e o gate. O framework é o método que
os dois servem.**

## Primeira fatia, construída em 14/08 a pedido dele ("vamos testar")

O gate de MVP, ponta a ponta, nas quatro peças da arquitetura proposta. **Não
está instalado em lugar nenhum**: é prova de conceito rodando sob teste, e ligar
exige dois passos deliberados (ver abaixo).

| Peça | Onde | O que é |
|---|---|---|
| Método como dado | `src/framework.mjs`, `METODOS` | Preset `mvp-basico`: duas fases, cada uma com o que exige e o que trava |
| Motor | `src/framework.mjs` | Puro: recebe método mais estado, devolve o que pode e o que falta. Sem disco, sem rede, sem IA |
| Estado | `.framework/estado.json` no projeto | Fase atual, MVP e histórico de escopo. Dentro do repositório, para viajar com ele |
| Aplicação | `hooks/framework-guard.mjs` | `PreToolUse`: recusa com `exit 2` e o stderr volta para o modelo |

Medido, não estimado: 13 grupos de asserção no motor (`node test-framework.mjs`)
e 13 checks de ponta a ponta no gate (`bash hooks/testar-framework-guard.sh`),
todos passando na VPS.

**O ciclo completo, rodado de verdade:** projeto novo bloqueia código dizendo o
que falta; MVP definido abre o portão; em execução, o pronto é a contagem de
critérios marcados; cortar um critério faz o projeto virar pronto **e registra a
mudança com motivo no histórico**.

Esse último passo é a resposta ao risco 2, e vale ver o que aconteceu: cortar
escopo funcionou, e ficou rastro. A pergunta filosófica que ele quer ("mudou o
produto final?") virou dado que o cockpit pode mostrar, em vez de bloqueio que
ele desligaria.

### Decisões tomadas na implementação

- **Portão mecânico.** O gate confere se o MVP existe, nunca se ele é bom. Está
  escrito na recusa, para o agente não tentar argumentar.
- **Dúvida libera.** Método desconhecido, JSON quebrado, estado corrompido,
  stdin vazio: tudo passa. Framework que trava por bug próprio é desligado no
  mesmo dia, e com razão. Há teste para cada um desses casos.
- **`docs/`, `assets/`, a raiz e o próprio `.framework/` nunca travam.** Travar
  documentação quebraria o `/end-session`, lição que o `rota-guard` já pagou.
- **O hook mora no repositório**, não em `~/.claude/hooks`. Medido no mesmo dia:
  hook no home não viaja, e o conserto dos testes do Routia (CC-50) ficou preso
  na VPS por isso.
- **Escrita atômica** (tmp mais rename) no estado, a mesma regra do `meta.json`.
- **Religar não sobrescreve.** `iniciar()` recusa se já houver estado, senão um
  religar por engano apagaria o MVP e o histórico de escopo.

### Como ligar, quando for a hora

Dois passos deliberados, e nenhum deles automático:

1. Registrar `hooks/framework-guard.mjs` como `PreToolUse` no `settings.json`.
   É manual por decisão antiga: o painel nunca escreve no `settings.json`.
2. No projeto que vai usar, criar o estado com `iniciar(raiz)`. Sem
   `.framework/estado.json`, o hook passa direto em qualquer repositório.

Desligar num projeto é apagar a pasta `.framework`.

## Terceira rodada, 14/08: ferramenta é escolha testada, não aprovação prévia

Discutida a partir de um documento externo (síntese de outra sessão sobre este
mesmo framework, mais um plano de "Bancada" — auditoria e teste, ver
[[BANCADA]]) que reintroduzia UML/MER como algo o "agente força". A correção
dele foi mais funda do que essa frase, e virou princípio geral de todo o
framework, não só desse ponto:

> "isso tudo é ferramenta [...] quem pode testar e me dizer o que funciona e o
> que não funciona é unicamente você como IA [...] a melhor forma de saber
> quais ferramentas a gente vai usar pra garantir a integridade e segurança
> das etapas é você. A única coisa que é essencial pra mim é que as suas
> decisões sejam revisadas e testadas e que gerem ruídos, esses ruídos não
> precisam estar na linguagem natural, pode ser o mais rápido leve e fácil
> possível pra você, pq a ideia do cockpit é pegar esse ruído e traduzir pra
> mim, e criar uma forma do meu cérebro controlar você como uma máquina de
> produção, ao invés de ficarmos discutindo prosa. [...] o foco é no mouse e
> poucas teclas resolver problemas complexos de forma rápida, e só parar o
> trabalho pra discutir coisas que só juntos poderíamos resolver, e que o
> framework JÁ teria isso definido desde o início do projeto na definição de
> pronto."

Discussão completa em [[../DISCUSSAO-FRAMEWORK-BANCADA]]. Três decisões que
saem direto disto:

1. **UML, Mermaid, qual scanner de segurança, qual linter — é escolha da IA,
   testada, nunca aprovação prévia dele nem regra fixa.** Nenhuma ferramenta
   é obrigatória por padrão; nenhuma é descartada de antemão. Uso quando o
   teste mostrar que ajuda o projeto em questão.
2. **A escolha de QUAIS ferramentas um projeto vai usar entra na fase de
   Definição, junto do MVP** — não é decisão solta que aparece no meio da
   execução. Consequência de código: `estadoInicial()` provavelmente ganha um
   campo (`ferramentas` ou dentro de `mvp`) decidido no mesmo momento que
   nome e critérios.
3. **Pergunta com opções (o mecanismo que este chat já usa) fica reservada
   pra decisão de rumo** — arquitetura, escopo, filosofia do produto — nunca
   pra escolha de ferramenta ou tática. E as respostas dele a essas perguntas
   de rumo viraram uma visão maior, registrada abaixo.

### Visão registrada, não implementada: perguntas em rede

Ele pediu para o framework ter um "sistema de perguntas [...] que obriga a IA
a me perguntar coisas ou aceitar sugestões extras ou selecionar coisas como
tecnologias, stacks ou recursos", e quando perguntei o que ele queria dizer
com "se encaixa no conceito de network", escolheu as três leituras que
ofereci, juntas, não uma:

- As perguntas viajam entre as máquinas pela federação do cockpit (CC-47):
  uma pergunta que surge no PC pode ser respondida do celular, e vice-versa.
- Rede de decisões com memória: cada resposta vira um nó que perguntas
  futuras podem consultar, não pergunta solta e esquecida.
- Vários agentes na mesma rede de trabalho, repassando ou delegando uma
  pergunta entre si — o Método Routia já coordena agentes; isto seria a
  mesma ideia aplicada a decisão, não a arquivo.

Isto é arquitetura própria, maior que uma função dentro do gate de MVP.
**Decisão dele: registrar como visão, terminar o resto primeiro** (Framework
e Bancada). Vira frente própria no ROADMAP quando chegar a vez.

## O que falta decidir antes de virar produto

- **Onde o humano decide** (risco 1). Hoje o ciclo inteiro roda sem nenhum ponto
  de aprovação. Precisa de um, e minúsculo: uma tela, sim ou não.
- **A interface de uso.** Hoje o MVP se registra editando JSON à mão. Falta o
  `cc framework` (iniciar, status, mvp, avançar, mudar escopo).
- **O painel.** Fase de cada projeto, o que falta para o próximo portão, e
  quantas vezes o escopo mudou. É a camada de insight que justifica o registro.
- **Mais de um método.** Só existe `mvp-basico`. O segundo preset é o que prova
  de verdade que o método é dado e não código.
- **A entrevista inicial** ("o que é o projeto"), que é a inversão da visão.
  Hoje o gate só recusa; ele ainda não conduz. Agora com escopo maior: a
  entrevista também é onde as ferramentas do projeto (Bancada incluída) se
  decidem, junto do MVP.
- **Bancada como gate** ([[BANCADA]], decidido 14/08): o "pronto" da fase de
  Execução provavelmente passa a exigir pelo menos a camada de segredo
  rodada, não só os critérios do MVP marcados. Desenho de como isso entra no
  motor (`framework.mjs`) ainda não foi feito.

## Por que não é LangChain (nem LangGraph, nem Google ADK)

Escrito em 15/08, quando o Felipe trouxe uma tabela com oito frameworks de
agente (LangChain, LangGraph, LlamaIndex, Microsoft Agent Framework, Google
ADK, Deep Agents, OpenAI Agents SDK, PydanticAI) e perguntou se o nosso é a
mesma coisa. É a pergunta que qualquer pessoa técnica vai fazer, então a
resposta mora aqui.

**Os oito servem para CONSTRUIR agentes. Este serve para GOVERNAR um agente que
já existe.** Usa-se LangChain para escrever um programa que chama modelo, define
ferramentas e orquestra passos. Este framework não constrói agente, não chama
modelo e não orquestra nada: ele intercepta o Claude Code e recusa uma edição
quando o MVP não está definido.

A diferença técnica que resume: **eles rodam DENTRO do seu programa, este roda
FORA do agente.** Eles são biblioteca que se importa; este é hook, do lado de
fora, interceptando o que o agente tenta fazer. Daí vêm duas propriedades que
nenhum dos oito tem:

- vale para qualquer projeto sem reescrever uma linha dele;
- continua valendo com o framework desligado, porque o gancho é o hook, não o
  código do projeto.

### Duas palavras da tabela deles enganam

**"Memória"**, nos oito, é o que o modelo lembra dentro da conversa. A daqui é
outra coisa: arquivo em disco que **sobrevive à conversa** e é escrito para o
Felipe e para a próxima sessão. O `HANDOFF.md` é a memória deste framework, e um
LLM não é o público principal dele. Ver [[COCKPIT]], que existe justamente
porque ele não lê documento longo.

**"Multiagente"**, nos oito, é orquestrar agentes que o próprio framework criou.
O Método Routia coordena sessões que nascem por fora, inclusive em máquinas
diferentes, e resolve outro problema: impedir que duas mexam no mesmo arquivo.

### O que este NÃO tem, de propósito

Orquestração, RAG, chamada de modelo, tipagem de saída. Nada disso está no
caminho: não é o problema que ele resolve, e adotar qualquer um dos oito para
ganhar isso não traria o gate, que é a peça inteira.

### Onde eles se encontrariam

Se um dia houver um agente próprio construído com um desses, este framework
poderia governá-lo também — o motor (`framework.mjs`) é puro e o estado mora no
projeto, não no Claude Code. O que prende hoje é só o gatilho, que é hook do
Claude Code. É exatamente o F14 do plano.
