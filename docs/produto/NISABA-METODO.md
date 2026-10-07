# Nisaba: o método, termo por termo

Rascunho 2, de 04/10/2026, com as decisões dele na seção 5. Item CC-898, filho do CC-897.

Pedido dele, com as palavras dele:

> "no inicio do projeto precisamos definir uma definição de produto, eu entao me
> torno uma especie de product developes/owner, e a gente vai determinar o
> product backlog baseado na definição de pronto, precisamos definir tipo um
> mapa do app, da ferramenta, do site, do produto indepente do que for.
> Inclusive suas caracteristicas. precisamos cientificar todo esse processo,
> analisar os termos, criar um manual p essa metodologia e transportar isso pra
> codigo!!!"

E sobre o sprint:

> "a definição de semana de cada sprint é algo humano, e feito pra dar
> satisfação pro investidor, de prazo... isso não é eficiente, a melhor
> definição do que é um sprint é mais líquida, primeiro defini-se um limite de
> tokens na semana (...), depois definimos o limite de dias (...), e baseado
> nisso com uma previsao de complexidade de tarefas a gente determina o sprint."

Este manual faz três coisas: diz de onde vem cada termo, diz o que ele passa a
significar no Nisaba e diz como o código mede isso. Termo sem medida em código
fica marcado como **aberto**.

---

## 1. O ciclo inteiro, numa linha

**Produto** (o que é e para quem) → **mapa do produto** (as partes dele) →
**backlog** (os itens, cada um com o seu pronto) → **sprint** (o pedaço do
backlog que cabe no orçamento) → **incremento** (o que ficou pronto e provado) →
**revisão** (o que a medida ensinou) → volta ao backlog.

---

## 2. Os termos

Cada termo traz a origem, o sentido no Nisaba e onde vive no código.

### 2.1 Dono do produto (product owner)

- **Origem:** Scrum Guide (Schwaber e Sutherland, versão 2020). É a pessoa que
  responde pelo valor do produto e decide a ordem do backlog.
- **No Nisaba:** é o Felipe. Só ele decide a meta do produto, a ordem do que
  importa e o que conta como pronto para o cliente. O agente propõe e mede, mas
  não decide nada disso.
- **No código:** item com natureza DEC e o estado "esperando você" (DE). Já
  existe.

### 2.2 Meta do produto (product goal)

- **Origem:** Scrum Guide 2020. É o estado futuro do produto, aquilo para que o
  backlog inteiro aponta.
- **No Nisaba:** é a **definição de produto**: o que é, para quem, que problema
  resolve hoje e como se sabe que deu certo. É a primeira coisa de qualquer
  projeto.
- **No código:** a entrevista do framework já pergunta natureza, entrega, quem e
  o problema de hoje (`src/entrevista.mjs`). **Aberto:** a resposta ainda não
  vira um bloco "produto" que o resto lê.

### 2.3 Mapa do produto (story map)

- **Origem:** Jeff Patton, *User Story Mapping* (2014). O produto se desenha como
  atividades de quem usa, de ponta a ponta, e cada atividade se abre em tarefas.
  O corte horizontal do mapa é uma entrega que funciona sozinha.
- **No Nisaba:** o mapa vale para qualquer produto. Num app ou site, as partes
  são telas e fluxos. Numa ferramenta, são comandos e o que eles produzem. Num
  estudo, são as perguntas. Cada parte tem as suas **características**: o que
  precisa ser verdade nela (rápida, funciona sem rede, só quem tem login entra).
- **Regra geral (dele, 07/10, CC-940):** projeto inicial não tem login nem senha.
  Login entra só quando o projeto já guarda informação de alguém. Antes disso é
  atrito sem nada a proteger. Vale para o arquiteto e para quem planeja.
- **No código:** **aberto.** Hoje o mais próximo é o catálogo de frentes
  (`docs/frentes.json`), que agrupa o trabalho mas não descreve o produto.
  Proposta: o mapa vira um arquivo do projeto, e cada item do backlog aponta para
  a parte do mapa que ele muda. Assim, frente passa a ser parte do mapa.

### 2.4 Backlog do produto (product backlog)

- **Origem:** Scrum Guide. É a lista ordenada de tudo que pode entrar no produto.
- **No Nisaba:** é `docs/backlog.jsonl`. Cada item tem natureza (defeito,
  pedido, decisão, medição, registro), área, tamanho, intenção, pronto e como
  conferir. Item não nasce sem isso.
- **No código:** existe e é travado (`src/backlog.mjs`).

### 2.5 Definição de pronto (definition of done)

- **Origem:** Scrum Guide. É o padrão de qualidade que todo incremento precisa
  cumprir. É **um só para o produto**. O critério de cada item é outra coisa: no
  ágil ele se chama critério de aceite.
- **No Nisaba, os dois existem e não podem se confundir:**
  - **pronto do produto:** vale para todo item. Neste projeto: a suíte passa e
    há prova na tela, no celular e no PC.
  - **pronto do item** (o critério de aceite): o campo `pronto` de cada item,
    mais o `conferir` (robô, olho ou dele).
- **No código:** o pronto do item existe. **Aberto:** o pronto do produto está
  escrito em texto (CLAUDE.md) e não é um campo que o fechamento confere.

### 2.6 Sprint

- **Origem:** Scrum Guide. É um evento de tempo fixo, de um mês ou menos, com uma
  meta, onde o trabalho vira incremento.
- **No Nisaba, por decisão dele: o sprint é líquido.** O tempo fixo existe para
  dar satisfação de prazo a quem investe, e não mede a capacidade de um time de
  agentes. O sprint passa a ser limitado por **orçamento**, não por calendário:
  1. **orçamento de tokens:** a parte do limite semanal do plano que o sprint
     pode gastar, calculada pelo que se tem usado;
  2. **orçamento de dias:** os dias e as horas que ele vai de fato trabalhar,
     porque não são 7 dias e nem todo dia tem as mesmas horas;
  3. **previsão de complexidade:** quanto cada item deve custar, pelo tamanho e
     pelo histórico.
  O sprint é o maior grupo de itens, na ordem do backlog, que cabe nos dois
  orçamentos. Ele termina quando o orçamento acaba, quando os itens acabam, ou
  quando os dias acabam, o que vier primeiro.
- **No código:** **aberto** (CC-901).

### 2.7 Meta do sprint (sprint goal)

- **Origem:** Scrum Guide. É o porquê do sprint, numa frase.
- **No Nisaba:** a parte do mapa do produto que o sprint move. Sugerida pelo
  código (a parte com mais peso no sprint), confirmada por ele.

### 2.8 Incremento

- **Origem:** Scrum Guide. É cada passo que cumpre o pronto do produto.
- **No Nisaba:** item fechado com prova (estado OK). O Caminho desenha isso.

### 2.9 Velocidade e capacidade

- **Origem:** prática do XP e do Scrum. Velocidade é quanto o time entrega por
  sprint; capacidade é quanto ele pode entregar no próximo.
- **No Nisaba:** a medida é **custo por item**, em tokens, separado por tamanho
  e natureza. É ela que transforma "P, M, G" em previsão.
- **No código:** a medida começou em 04/10 (CC-900, `src/custoItem.mjs`). A
  regressão por dia não serviu: com 24 dias de projeto, um item M saía mais
  barato que um P, porque fechamento em lote e modelo barato misturam tudo.
  Agora, toda vez que uma sessão move um item para "andando" e depois para
  prova ou feito, o diário guarda o contador de tokens dela, e a diferença é o
  custo do item. A previsão por tamanho sai dessas medidas quando houver
  amostra.

### 2.10 Revisão e retrospectiva

- **Origem:** Scrum Guide. A revisão olha o produto; a retrospectiva olha o modo
  de trabalhar.
- **No Nisaba:** a revisão compara o previsto com o gasto (tokens por item) e
  corrige a previsão do sprint seguinte. A retrospectiva já existe em forma de
  medida: a taxa de cada trava e as armadilhas registradas.

### 2.11 Fila mista: a ordem do trabalho

- **Origem:** Scrum Guide. O dono do produto ordena o backlog.
- **No Nisaba (decisão dele em 07/10, CC-958):** o Caminho é a prioridade. A ordem é: o que
  está andando termina; agora; fim do dia; o sprint atual na ordem do Caminho; fim do sprint;
  os próximos sprints; fim do backlog. Fora do MVP fica guardado e não entra na fila até ele
  promover. Ideia nova: ele escolhe o lugar, a sessão sugere. O que espera ele segue a mesma
  ordem, na lista dele.
- **No código:** o campo `lugar` do item (`{ onde, em }`), `ordemDaFila` e `filaDoAgente` em
  `src/backlog.mjs`, e o comando `node cc.mjs backlog lugar`.

---

## 3. O que foi medido em 04/10 (só a VPS)

Medido a partir dos transcritos desta máquina. O PC não entra nesta conta.

| Semana | Dias com trabalho | Horas de agente (soma dos projetos) | Tokens de saída |
|---|---|---|---|
| 24/08 | 4 | 34 | 5,4 milhões |
| 31/08 | 5 | 18 | 3,3 milhões |
| 07/09 | 4 | 11 | 2,1 milhões |
| 21/09 | 7 | 75 | 18,2 milhões |
| 28/09 | 7 | 130 | 36,3 milhões |

Uso do plano lido agora: **86% da semana**, 13% da janela de 5 horas.

Três achados que mudam o desenho:

1. **Hora de agente não é hora dele.** Num dia houve 40,9 horas somando os
   projetos, porque vários agentes rodam ao mesmo tempo. O orçamento de dias
   precisa contar as duas coisas separadas: as horas dele (atenção para decidir
   e conferir) e as horas de máquina.
2. **O limite que manda é o do plano, e ele é da conta inteira.** O PC e a VPS
   gastam do mesmo limite semanal, mas cada máquina só enxerga os próprios
   transcritos. A unidade certa do orçamento é **porcentagem do limite
   semanal**, e a conta de tokens por máquina serve só para calibrar quanto cada
   item custa.
3. **Quase todo token é releitura de cache.** Contar o total engana. A
   previsão por item tem de usar a saída e a escrita, ou a porcentagem do
   plano, nunca o total cru.

---

## 4. O que vira código, na ordem

| Ordem | Peça | Item |
|---|---|---|
| 1 | medir o custo de um item por tamanho e natureza | CC-900 |
| 2 | medir a capacidade: limite semanal e horas dele por dia | CC-899 |
| 3 | definição de produto e mapa do produto no começo do projeto | CC-902 |
| 4 | sprint líquido: escolher os itens que cabem no orçamento | CC-901 |
| 5 | o Caminho mostra sprints passados, o atual e os previstos | CC-897 |

---

## 5. As decisões dele, em 04/10

Ele respondeu às quatro perguntas do rascunho 1:

> "a. Não sei dizer agora / B. Dias da semana normais / C. É Sprint por
> projeto. Cada roadmap pertence a um projeto diferente uai / D. O modo
> entrevista, ou podemos criar modo criação de produto"

| Pergunta | Decisão | O que isso vira |
|---|---|---|
| Quanto do limite semanal um sprint gasta | **em aberto** | Até ele decidir, o código não corta pelo limite: ele mede o gasto de cada sprint e mostra a média, para a decisão sair de um número e não de um chute |
| De onde vêm os dias | **os 7 dias da semana** (confirmado por ele na mesma data) | O sprint conta a semana de calendário inteira. O limite real continua sendo o orçamento de tokens; os dias só dão o teto de tempo |
| Sprint por projeto ou um só | **por projeto** | Cada projeto tem os seus sprints, como cada um tem o seu roadmap. O limite do plano continua sendo da conta, então a soma dos sprints abertos é mostrada junto, para ninguém planejar mais do que cabe |
| Quem escreve o mapa do produto | **um modo novo, "criação de produto"** (escolhido por ele na mesma data) | Começa pela entrevista que já existe, sem mudá-la, e continua até a definição de produto, o mapa e as características de cada parte |
