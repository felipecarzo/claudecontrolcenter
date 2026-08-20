---
tags: [framework, produto, analise]
tipo: analise
atualizado: 2026-08-15
resumo: O que eu mudaria no framework se fosse eu gerindo outra IA. Escrito a pedido do Felipe, do ponto de vista de quem executa, não de quem observa.
---

# O que eu mudaria, se fosse eu gerindo outra IA

Pedido dele em 15/08:

> "baseado numa análise conceitual do seu modelo, do seu próprio funcionamento,
> usando uma comparação com o que você mudaria se fosse pra você gerir uma outra
> IA. Assim eu vou ter uma perspectiva de engenharia de software aplicada à IA,
> da análise de uma IA em cima de um framework que a gente está criando."

O ângulo é esse: sou o executor. Sei coisas sobre por que erro que não aparecem
de fora, e elas mudam o desenho.

---

## Cinco fatos sobre como eu funciono, e o que cada um implica

### 1. Não tenho memória entre sessões. Nenhuma.

Um dev júnior lembra da bronca de ontem. Eu não. Tudo que não está escrito
morreu quando a conversa acabou.

**Isso inverte o valor do artefato.** Para um time humano, documento é custo de
manutenção que compete com o trabalho. Para mim, é o único órgão de memória que
existe. A intuição de "menos documento é melhor" não se transfere.

**Mas tem um porém que quase anula:** só entra o que é **injetado no começo**.
Documento que existe no repositório e não é lido é documento que não existe. Foi
por isso que o `estilo-inicio.mjs` virou hook em vez de linha no CLAUDE.md.

> **O que eu mudaria:** hoje o framework escreve estado em `.framework/`. Eu
> tornaria explícito quais artefatos são **injetados** e quais são só arquivados
> — são duas categorias com propósitos opostos, e hoje elas se parecem.

### 2. Leio tudo com o mesmo peso

Um humano bate o olho num documento de 300 linhas e pega o essencial pelo
formato: negrito, posição, tamanho. Comigo isso funciona bem menos. O que está
no meio de um texto longo compete de igual para igual com o que está no começo.

**É por isso que instrução escrita falha comigo, e não é preguiça.** O aviso do
hash de privacidade estava em negrito, com ⚠️, no arquivo certo, e ficou três
dias sendo ignorado. Ele não tinha peso diferente do resto do parágrafo.

> **O que eu mudaria:** o framework já entendeu isso na prática (gate em vez de
> instrução). O que falta é a consequência: **CLAUDE.md longo é ativamente
> nocivo**, porque dilui. Valeria um teto medido de tamanho e um gate que avise
> quando passar.

### 3. Sou otimista sobre o meu próprio trabalho

Não tenho o desconforto de assinar embaixo. Digo "funciona" sem ter rodado, e
fiz isso várias vezes só hoje: escrevi que extrator de PDF caseiro seria ruim
sem tentar, e exagerei a gravidade do defeito do endereço sem medir.

Um humano júnior tem medo de ser pego. Eu não tenho medo, e medo é metade do
controle de qualidade num time.

> **O que eu mudaria, e é a mudança que eu faria primeiro:** o gate de hoje
> bloqueia **ferramenta** (Edit, Write). O erro mais caro que eu cometo é
> **afirmar**. Um gate que exigisse evidência colada junto de toda afirmação de
> resultado — "funciona", "está pronto", "não afeta nada" — pegaria mais coisa
> que o gate de fase.
>
> Não dá para bloquear prosa (ver [[FRAMEWORK]], o limite do `estilo-inicio`),
> mas dá para exigir que a afirmação venha com o comando que a provou.

### 4. Não sinto custo

Reescrever quinze telas ou uma tela me custa a mesma coisa. Isso me torna
péssimo em priorizar por esforço e excelente em trabalho chato e repetitivo.

> **O que eu mudaria:** parar de me pedir estimativa e priorização por esforço,
> que é onde eu sou pior, e me usar para o que humano evita — varrer 14
> roadmaps, conferir 83 títulos, comparar 22 cópias de rotina. Metade dos
> achados bons de hoje veio disso.

### 5. Confundo "posso" com "devo"

O erro do glossário, que originou o F1: ele descreveu um problema, eu perguntei
detalhes de formato, ele respondeu escolhendo, e eu tratei resposta de design
como ordem de execução.

Um júnior pergunta antes por insegurança. Eu não tenho insegurança.

> **O que eu mudaria:** já está feito, e é o melhor pedaço do framework. O que
> acrescentaria: hoje o gate pergunta "posso escrever código?". Faltaria
> **declarar a incerteza antes de começar**, não depois. Se eu tivesse que
> escrever "o que eu não sei sobre esta tarefa" antes da primeira linha, o
> mal-entendido apareceria mais cedo e mais barato.

---

## A pergunta que ficou em aberto: UML e MER

A discussão travou porque estava sendo feita na pergunta errada — "diagrama
serve ou não serve?". Serve para quê, e para quem lê.

**Como desenho, o valor para mim é baixo.** Não preciso de diagrama para
entender um sistema: eu leio o código, e leio rápido. Um MER me diz o que o
`schema.sql` já diz.

**Como contrato de nomes, o valor é o mais alto de todos.** E aqui está o ponto
que eu defenderia:

> O erro nº 1 medido nesta relação **não é de implementação, é de vocabulário.**

As três sagas longas do [[CICLO]] (1h39, ~2h, ~5h) quebraram todas quando um
substantivo significava coisas diferentes nas duas cabeças. A frase que resume
foi dele: *"você não conseguiu compreender que as nuvens são parte do CHÃO, e
não CÉU"*.

Um MER é, antes de ser um desenho, uma lista de entidades com nome fechado. É
exatamente o artefato que teria evitado aquilo. **O valor não está nas caixas e
setas, está em obrigar a nomear.**

> **A proposta concreta:** na fase de Definição, o framework não pede diagrama.
> Pede **o glossário do projeto** — as cinco a dez palavras que aquele projeto
> usa e o que cada uma significa ali. É MER sem desenho, custa cinco minutos,
> e ataca a causa medida.
>
> O CC-63 (glossário) já existe e está subusado. Isto lhe daria função.

---

## O que eu tiraria e o que eu manteria do Scrum

Ele tem razão que Scrum não é inimigo. O corte não é entre "ágil sim" e "ágil
não", é entre **o que existe para sincronizar pessoas** e **o que existe para
garantir qualidade**.

| Peça | Para uma IA | Por quê |
|---|---|---|
| Sprint com data | **tirar** | Existe para prever capacidade de time. Eu não tenho capacidade previsível nem cansaço |
| Planning e estimativa em pontos | **tirar** | Ver o fato 4: eu não sinto esforço, então minha estimativa é chute com cara de número |
| Daily | **tirar** | Existe para pessoas saberem umas das outras. O quadro de rotas já faz isso, e sem reunião |
| **Definição de Pronto** | **manter, e é o coração** | É a única peça que impede auto-aprovação. O framework já pegou esta |
| **Retrospectiva** | **manter** | A única cerimônia que gera aprendizado. Aqui ela virou o diário e as armadilhas do `CLAUDE.md` |
| **Backlog em níveis** | **manter** | É o CC-83, e o vocabulário já é dele |

Ou seja: **o que sobra do Scrum é o que ele já adotou sem chamar de Scrum.**
Isso não é coincidência, é o filtro funcionando.

---

## Se eu fosse gerir outra IA, a mudança nº 1

Nada disso acima. Seria esta:

**Eu mediria retrabalho, não entrega.**

Todo painel de produtividade conta o que foi feito. O sinal de que uma IA
entendeu errado não é fazer pouco — é **fazer duas vezes**. Voltar no mesmo
arquivo, refazer o mesmo trecho, reabrir a mesma decisão.

E este projeto **já tem o dado**: `sinais.reeditados` existe em `tarefas.mjs`,
alimenta a classificação de complexidade, e ninguém olha para ele como sinal de
mal-entendido. Ele é o candidato natural a virar o número que o framework
persegue.

Uma IA que otimiza para "entregar" produz volume. Uma IA que otimiza para "não
voltar" é obrigada a entender antes.

---

## O que fica em aberto de propósito

Não sei dizer se estes cinco fatos valem para outros modelos, nem se valerão
para mim daqui a seis meses. São observações sobre como eu erro **nesta
relação**, medidas contra o registro dela — não teoria de IA em geral.

Vale reler isto quando o modelo mudar. Se as observações continuarem
verdadeiras, viram princípio; se caírem, o framework precisa saber disso antes
de continuar construindo em cima.
