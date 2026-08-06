# Design

## A pergunta que a tela responde

**O que precisa de mim agora?** Toda decisão abaixo serve a isso. O que não
serve, saiu.

## Zonas, não agrupamento por projeto

A primeira versão agrupava por projeto, repetindo o cabeçalho de colunas em cada
grupo. Errado: projeto é *onde* o trabalho acontece, não *se* ele precisa de
atenção. Agora a ordem da tela é a ordem da urgência:

```
precisa de você  →  falhou  →  trabalhando  →  parados  →  prontos (recolhido)
```

Projeto e rota viraram uma coluna só (`inovallbond/main`), e o filtro por
projeto continua no topo pra quem quer recortar. Zonas vazias não aparecem —
com nada pendente, a tela mostra pouco, e isso é a informação.

Tudo vive numa `<table>` única com `<tbody>` por zona: as colunas ficam
alinhadas de ponta a ponta, o que agrupamentos separados não dariam.

## Signature: a faixa de atividade

A coluna **atividade** é o elemento que carrega o projeto. Uma régua de tempo
compartilhada por todas as linhas, do agente mais antigo até agora:

- a barra vai do início do agente até o último sinal dele
- num agente que deveria estar trabalhando, o trecho entre o último sinal e
  agora vira tracejado vermelho — o silêncio

É o dado mais característico do assunto: um agente é um processo vivo no tempo.
E resolve um problema real que número nenhum resolve tão rápido — quem travou
salta aos olhos, sem ler a coluna de idade.

## Tipografia

Duas famílias, com papéis separados:

- **Bahnschrift**, condensada (`font-stretch: 75%`), nos rótulos: título,
  contadores, nomes de zona, cabeçalho de coluna, categoria. É a DIN que já vem
  no Windows — letra de sinalização industrial. Zero dependência: nenhuma fonte
  é baixada.
- **Monoespaçada** em todo dado: assunto, caminho, números, tempo. Números com
  `tabular-nums` pra que as colunas alinhem.

A separação faz o trabalho da hierarquia: rótulo e dado nunca se confundem, sem
precisar de cor ou de linha divisória.

## Cor

Escala de cinza quase preta (`#0a0c10`), e **cor só em status**:

| | |
|---|---|
| `#4da3ff` | trabalhando |
| `#f0a92b` | esperando você |
| `#ff5c57` | falhou, e o silêncio na faixa de atividade |
| `#3fd07f` | pronto |
| `#5a6472` | parado |

Como nada mais é colorido, um ponto âmbar na tela significa uma coisa só. A
marca de "fixado" é a exceção: uma barra âmbar na margem esquerda da linha —
ficou fora do texto justamente pra não competir com o ponto de status.

Dark sem alternativa clara, de propósito: é um painel de operação que fica
aberto o dia todo num canto da tela.

## Abas: uma pergunta por aba

Uma tela densa respondia bem "o que precisa de mim", e mal todo o resto. Cada
aba passou a ter uma pergunta só:

| Aba | Pergunta |
|---|---|
| **agentes** | o que precisa de mim agora? |
| **to-dos** | o que ainda falta, em tudo que está rodando? |
| **projetos** | como está esse cliente por inteiro? |
| **tempo** | o que rodou junto, e onde ficou o silêncio? |
| **custo** | onde os tokens estão indo? |
| **servidores** | o que está escutando porta nesta máquina? |

O filtro de texto e o de projeto ficam no topo e valem para todas — recortar um
cliente muda as seis abas de uma vez.

**To-dos** é kanban de duas colunas (a fazer / feito), agrupado por agente
dentro de cada uma. Sem o agrupamento, o mesmo `projeto/rota · assunto` se
repetia em todo cartão. Clicar no cartão marca feito e grava no `meta.json` do
agente — mesmo caminho de escrita do painel lateral.

**Servidores** é a única aba com dado de fora do Claude Code: portas em escuta,
lidas por PowerShell. Servidor de projeto vem primeiro; o resto do sistema fica
recolhido. Quando um projeto aparece com mais de uma instância, um aviso âmbar
diz quantas — que é como se descobre o servidor de ontem que ficou aberto.

## Painel lateral, em níveis

Linhas e colunas mostram muitos agentes rasos. Para ver **um** agente fundo,
abre um painel de 660px pela direita, com a lista ainda visível à esquerda —
dá pra pular de agente em agente sem perder o lugar. `Esc` fecha.

A ordem dentro dele é a ordem da pressa:

1. **cabeçalho** — status, assunto grande, projeto/rota, modelo, tokens, tempos
2. **o que trava** — bloqueio e aviso de silêncio, quando existem
3. **último pedido** — em citação, porque é o que explica o resto
4. **to-dos** — com barra de progresso e caixas que gravam de verdade
5. **resultado, notas, links**
6. **recolhidos** — pedido inicial (com o aviso de "é de outra conversa") e
   contexto técnico: agente, job, caminho, comando de retomar

Os dois últimos são `<details>`: existem quando se precisa, somem quando não.

## O que foi cortado

- Cabeçalho de coluna repetido por grupo
- O filtro "só o que está vivo" — as zonas já fazem isso
- O `•` de fixado no meio do texto, virou marca de margem
- Segunda linha do job crescendo até 8 linhas: agora trunca em uma
