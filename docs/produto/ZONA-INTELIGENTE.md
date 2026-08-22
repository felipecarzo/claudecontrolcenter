# Zona inteligente: medir para achar tendência

> Pedido dele em 22/08, com as palavras dele:
>
> *"conseguimos criar uma zona inteligente? pra gente conseguir medir coisas
> legais e ter mais dados pra medir e achar tendências. dados são tudo camarada!
> a gente pode armazenar mais dados e disponibilizá-los em outros formatos e
> cruzar c dados de projetos, dados globais etc. seja criativo e itere nessa
> ideia umas 10 vezes"*

Este documento é a iteração pedida. Cada rodada abaixo **critica ou derruba a
anterior**, e o que sobra no fim é a proposta. Não é uma lista de dez ideias
soltas.

---

## O chão medido, antes de qualquer ideia

Levantado em 22/08, para a iteração não virar fantasia:

| onde | quanto |
|---|---|
| conversa guardada em disco | 173 MB, 50 sessões |
| medidas de duração de ferramenta | 9.938 |
| recusas de permissão dele | 147 |
| interrupções dele no meio da resposta | 47 |
| ferramentas que devolveram erro | 319 |
| travadas de hook | 490 |
| commits nos 17 projetos (30 dias) | 1.005 |
| linhas mexidas no maior deles | 903.454 |

**Dessa lista inteira, o cockpit hoje lê duas coisas: tempo e token.** Todo o
resto já está escrito, de graça, e nunca virou número.

---

## Iteração 1: uma aba "Métricas" com gráficos de tudo

A ideia óbvia. Vigésima quinta tela no menu, cheia de gráfico.

**Morre porque o gargalo não é apresentação.** O painel já tem motor de
gráficos que cruza duas fontes e monta o desenho sozinho, e já tem a aba de
tempo. Uma tela nova mostraria os mesmos dois números com cor diferente. Falta
matéria-prima, não vitrine.

## Iteração 2: então guarda tudo num banco de dados

Se falta dado, guarda mais: um banco, um arquivo, consulta livre depois.

**Morre por dois motivos.** O projeto não tem dependência de runtime, e o banco
que vem dentro do Node só existe da versão 22 em diante, enquanto a VPS roda a
20. E o erro é de ordem: banco responde *onde* guardar, e ninguém decidiu *o
quê*.

**Sobra uma coisa, e é importante:** hoje o dado morre. O Claude Code apaga
trabalho antigo sozinho, e o transcrito é relido do zero a cada vez. Sem série
gravada não existe tendência, só fotografia.

## Iteração 3: minerar o que já está escrito e ninguém lê

Os 173 MB carregam campo que o painel ignora: quem interrompeu, qual permissão
foi negada, qual ferramenta falhou, quanto cada uma demorou, qual hook travou.

**Primeira ideia que sobrevive**, e é a mais barata de todas: o dado já existe,
não precisa instrumentar nada, e nenhuma dessas oito medidas custa uma linha de
código novo para ser produzida. Só para ser lida.

## Iteração 4: número solto não é tendência

"319 ferramentas falharam" não significa nada. Não sei se é muito, se está
piorando, nem se aconteceu tudo num dia só.

**Tendência precisa de três coisas, e nenhuma é o número:** série no tempo, uma
base de comparação, e um limiar que dispara sozinho.

**O que muda:** toda medida nasce como **série diária**, e sempre aparece com o
valor de hoje contra a média das quatro semanas anteriores. O painel fala
quando sai da faixa, em vez de esperar ele reparar.

## Iteração 5: cruzar esforço com resultado

O cockpit mede **esforço**: hora de foco, token, dólar. O git mede
**resultado**: 1.005 commits, 903 mil linhas. Nenhum dos dois, sozinho,
responde nada que interesse.

Juntos nascem números que só existem no cruzamento: token gasto por linha que
**sobreviveu**, hora de foco por item de roadmap fechado, quanto custou um
commit.

**Fica**, e é a parte que ele chamou de legal. Precisa de uma chave comum entre
as duas fontes, e ela existe de graça: **projeto mais dia**.

## Iteração 6: meia-vida, a medida que só o git dá

Linha entregue não é linha que ficou. O git sabe dizer quanto tempo um trecho
sobrevive antes de alguém reescrever por cima. Código que morre em 48 horas é
retrabalho com outro nome, e hoje ninguém conta isso.

**Fica: meia-vida do código, por projeto.** É a medida mais honesta de "acertei
de primeira" que existe aqui, e é impossível de fraudar sem parar de trabalhar.

## Iteração 7: o perigo, e ele é sério

Métrica que vira meta deixa de medir. "Commits por dia" ensina a picar commit.
"Linhas escritas" ensina a escrever mais linha. Isso não é teoria: é o modo
normal de morrer de qualquer painel de produtividade.

**O que muda: duas gavetas separadas, e nenhuma é meta.**

- **descritivas**: aparecem na tela, ele olha e decide o que fazer
- **de alarme**: ficam caladas, e só falam quando saem da faixa

E uma regra que vale mais que as duas: **nada aqui avalia pessoa nem agente.**
O painel existe para ele decidir onde mexer, não para cobrar de ninguém. No
minuto em que virar boletim, ele para de olhar.

## Iteração 8: parar de contar, começar a prever

A pergunta boa não é "quantas vezes ele me interrompeu". É **o que acontece
pouco antes de uma sessão dar errado**.

Os candidatos já estão medidos, e são quatro: interrupção dele, o mesmo arquivo
reeditado três vezes seguidas, recusa de permissão em sequência, comando
falhando repetido.

**Fica um sinal precoce.** "Esta sessão está com a cara das que deram errado"
vale mais que qualquer contagem no fim do dia, porque ainda dá tempo de mudar.

## Iteração 9: dados globais, e quais realmente servem

Ele falou em dados globais. O câmbio já entra no painel, o valor da hora de dev
no mercado também. O resto do mundo lá fora, feriado e clima, é enfeite: não
muda decisão nenhuma dele.

**O que muda: a base de comparação mais útil não é o mundo, é a casa dele.**
São 17 projetos com atividade, amostra suficiente para um projeto virar régua
do outro. "O inovallbond gasta três vezes mais token por commit que o ibrics"
leva a uma pergunta de verdade. "Hoje é quinta" não leva a lugar nenhum.

## Iteração 10: não é uma aba, é um armazém

Aqui a iteração 1 é corrigida de vez. O erro dela não era o assunto, era o
formato: ela nasceu tela.

**Isto é uma camada que grava.** Uma linha por dia, por projeto, por medida, em
arquivo texto que se lê sem o painel. A tela vem depois, e o formato dele
também: o mesmo endereço entrega JSON para o gráfico e CSV para a planilha, e
qualquer outra ferramenta lê sem pedir licença.

**Fica assim: o armazém primeiro, com UMA medida provada de ponta a ponta.** As
outras vinte entram depois sem tocar em nada, porque a forma já está resolvida.

---

## O que sobrou das dez

1. **um armazém** que grava série diária por projeto, em texto, fora do painel
2. **oito medidas novas** de graça, tiradas do que já está escrito no disco
3. **cruzamento com o git**, pela chave projeto mais dia
4. **meia-vida do código**, a medida honesta de retrabalho
5. **comparação entre os projetos dele**, em vez de comparação com o mundo
6. **alarme em vez de vitrine**: fala quando sai da faixa
7. **sinal precoce** de sessão que vai dar errado
8. **JSON e CSV** pela mesma rota, para fora do cockpit

## O que ficou de fora, de propósito

- **banco de dados**: arquivo texto resolve, e sem dependência nova
- **dado global do mundo**: clima e feriado não mudam decisão dele
- **métrica que avalia agente**: vira boletim, e boletim ninguém olha
- **tela nova**: a última coisa a fazer, não a primeira

## A ordem de execução

| passo | o que entrega | por que primeiro |
|---|---|---|
| 1 | o armazém com uma medida só | a forma tem que estar provada antes de escalar |
| 2 | as oito medidas do transcrito | dado de graça, já está no disco |
| 3 | o cruzamento com o git | precisa das duas séries existindo |
| 4 | a faixa e o alarme | precisa de quatro semanas de série para ter base |
| 5 | JSON e CSV para fora | trivial depois que o armazém existe |
| 6 | a tela | consequência, nunca a causa |
