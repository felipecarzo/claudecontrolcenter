---
tags: [produto, processo, comunicacao]
tipo: produto
atualizado: 2026-08-16
resumo: O diagnóstico dele sobre por que a comunicação por chat quebra, e o que isso exige do cockpit. Fonte primária, com as palavras dele.
---

# A comunicação: por que o chat sozinho não sustenta o trabalho

Registrado em 16/08, ao fim de um dia de trabalho pesado, a pedido dele:
*"anota tudo isso que eu falei, quebra em tarefas, e vamos decidir o que
conserta primeiro antes de prosseguir"*.

**Isto é fonte primária.** As palavras dele estão inteiras, e a leitura vem
depois, separada. Ele já perdeu ideia por eu ter resumido cedo demais.

## O diagnóstico, nas palavras dele

> "o problema é que o chat é a nossa ferramenta principal de trabalho e muita
> coisa acontece nela, o que acaba tornando uma timeline que só anda pra frente,
> o retroativo nao existe pela quantidade de texto e as proprias mensagens ficam
> confusas onde comecam e terminam"

> "do jeito que ta voce mistura raciocinio com conclusao. Eu sempre leio o
> raciocinio, mas é tanta informação sem registro e sem um backlog de facil
> acompnhamento que sinceramente eu acabo sendo empurrado pro vibecoding pq a
> minha cabeça nao consegue processar e fica com fadiga só de imaginar que eu
> vou ter que te perguntar 40 passos de algo que voce talvez ja tenha resolvido"

> "O que eu preciso é que os backlogs, sejam sprints ou produtos ou qualquer
> coisa me deem uma nocao de preenchimento em ordem de tempo e importancia, e
> que fiquem visiveis em locais faceis pra eu ver voce mexendo e atualizando
> enquanto leio aqui. e aqui a gente cria mais uma linguagem de entrega e a
> revisao seja anotada, apontada e revisada nesse local, que seria o backlog."

> "No momento o cockpit desenvolveu a sua propria lista de tarefas e nao
> adicionou nada ao to-do (sprint), e nao se chamou de product backlog tambem,
> e tambem nao temos exatamente uma definição de pronto, e isso quebra
> praticamente todo o projeto."

E a sinalização que ele propôs, textual:

> "todas as mensagens que nao forem processos devem ficar entre alguma
> sinalização, como `------------------------------ // resumo // --------------------`"

## O que isso quer dizer, ponto a ponto

### 1. O chat é uma fita que só anda para a frente

Não é queixa de volume: é de **estrutura**. Uma conversa longa não tem índice,
não tem estado, e não responde "onde estamos" sem reler tudo. Trabalho de
verdade precisa de um lugar que **fique parado enquanto a conversa anda** — e
esse lugar deveria ser o painel.

### 2. Ele lê o raciocínio. O problema é a mistura, não o tamanho

Este ponto contradiz o protocolo que outra IA sugeriu a ele ("não me conte como
você chegou à conclusão"), e **a palavra dele vence**: *"Eu sempre leio o
raciocinio"*. Cortar o porquê seria resolver o problema errado.

O que ele pede é **separação visível**: um marcador que diga onde acaba o
raciocínio e começa a conclusão. Hoje os dois vêm no mesmo bloco de prosa, e ele
tem que separar de cabeça enquanto lê.

### 3. A fadiga é o sintoma que mais custa

*"eu acabo sendo empurrado pro vibecoding"* — ele desiste de acompanhar e passa
a aceitar o que vier. **Esse é o pior resultado possível para este projeto**, que
existe justamente para ele conseguir conferir. Um painel que não é usado empurra
o dono dele para o oposto do que o painel promete.

A causa que ele nomeia é precisa: *"fadiga só de imaginar que eu vou ter que te
perguntar 40 passos de algo que voce talvez ja tenha resolvido"*. Não é a
leitura que cansa — é a **incerteza sobre o que já foi feito**.

### 4. O backlog precisa de duas ordens ao mesmo tempo

*"em ordem de tempo e importancia"*. Hoje o ROADMAP tem uma só, e nem essa é
explícita: os itens estão na ordem em que nasceram.

### 5. Ele quer ver o backlog mexer enquanto lê

*"que fiquem visiveis em locais faceis pra eu ver voce mexendo e atualizando
enquanto leio aqui"*. O painel já atualiza a cada 2 segundos — o que falta é eu
**escrever nele**. O canal existe e está vazio.

### 6. Faltam três nomes, e a falta de nome é a falta da coisa

- **sprint** — existe como aba, e está vazia
- **product backlog** — não existe com esse nome em lugar nenhum
- **definição de pronto** — o framework tem `mvp.criterios` por projeto, mas
  não uma definição de pronto **por tarefa**

Ele fecha: *"isso quebra praticamente todo o projeto"*. E está certo pelo motivo
que ele não precisou dizer: sem definição de pronto, "feito" é opinião minha.

## A medição que confirma tudo, feita em 16/08

Depois de um dia fechando 10 itens, o `meta.json` desta sessão estava assim:

| campo | valor |
|---|---|
| `subject` | vazio |
| `frente` | vazio |
| `todos` | **0** |
| `status` | vazio |
| `blockers` | 0 (gravei, e foi para outro job) |

**Eu escrevi o protocolo do `AGENTS.md` e não o segui.** Escrevi o `cc-check`,
o hook que cobra to-do aberto na entrega, e ele passou calado o dia inteiro —
porque só dispara **quando existem to-dos**. Zero to-dos não é entrega limpa, é
ausência de registro, e o gate não distingue os dois.

É a mesma família de defeito que apareceu três vezes hoje em outros lugares:
**a ferramenta afirmando mais do que sabe.**

## O que NÃO fazer com isto

**Não virar mais um documento que ninguém lê.** Este arquivo é fonte primária e
o registro do diagnóstico; o que muda o dia a dia são as tarefas derivadas dele,
no ROADMAP, e os gates que as sustentam.

E **não implementar o protocolo da outra IA como veio**. Ele contém uma regra
que contraria o que o Felipe disse na mesma mensagem — cortar o raciocínio.
Bullets e separação, sim; amputação, não.

---

# A regra de vocabulário, registrada em 2026-08-29

> Veio de uma sessão do **carzo**, e foi ele quem pediu para trazer para cá:
> *"consegue inserir isso no cockpit lá no handoff pra ele inserir lá como
> regra global do framework também? isso é muito importante, todas essas regras
> globais mesmo"*.
>
> **Candidata ao `CLAUDE.md` global.** Ele decide quando e como entra.

## O que aconteceu

Eu tinha escrito um catálogo de características de sistema com o vocabulário
parafraseado em português "humano": as classes viraram "grupos", os atributos
viraram "características", e os campos viraram uma coluna chamada **"o que
obriga"**. Ele leu, travou num item, e perdeu tempo.

## As palavras dele

> *"eu percebi que tem uns textos muito nada a ver. Por exemplo, item A3, funil
> de interesse. Tem o texto 'o que obriga: estágio, próximo passo, motivo de
> perda'. Eu não consegui entender o que significa (…) o funil de interesse é
> um motivo de perda? Por quê? Onde você tirou essa característica, será que
> não tinha uma forma melhor de falar isso?"*

> *"Como assim 'o que obriga'? Não é 'obriga' que é a palavra correta. Se é um
> sistema (…) é característica da CLASSE. É mais fácil falar isso: é uma
> classe. Falar usando termos mais próximos da programação, de repente que eu
> entendo."*

> *"O A é o 'quem'. Quem é uma classe. A classe pode ser uma pessoa, e aí ele
> vai ter ATRIBUTOS, que é o histórico por pessoa, o funil de interesse (…)
> fica muito mais fácil explicar assim."*

> *"você está tentando se aproximar do que seria uma coisa feita para o ser
> humano ler rápido, mas na verdade isso me fez entrar em loop tentando
> entender o que você quis dizer, e eu perdi o maior tempão. Não faz sentido."*

## A regra

**Em modelagem, o vocabulário de programação é MAIS claro, não menos.** A
paráfrase parece mais simples e é mais lenta de ler, porque ele traduz de
volta.

| ❌ | ✅ |
|---|---|
| grupo "QUEM: as pessoas e a relação com elas" | classe `Pessoa` |
| "característica A3, funil de interesse" | atributo `funil` |
| coluna "o que obriga" | **atributos**, ou **campos** |
| "histórico por pessoa" | relação um-para-muitos com `Evento` |

## ⚠️ Por que isto NÃO contradiz a regra zero

A regra zero deste arquivo manda nunca citar o nome da peça: `reporte-guard`,
`frente`, `subject`, `CC-98`. O motivo dela é **memória**: são nomes que só
existem dentro de um projeto, e ele não tem por que decorá-los.

Classe, atributo, relação e tabela são o oposto: **vocabulário universal que
ele já tem**. Traduzi-los é que custa tempo dele.

**A linha que separa os dois casos, e é ela que vale como regra:**

> **O nome existe fora deste projeto? Use. Foi inventado aqui? Traduza.**

## A segunda regra, que veio junto

**Todo item de uma lista se explica sozinho**, em três coisas:

1. **o que é**, no vocabulário que ele já tem;
2. **de onde veio**: a procedência. Ele perguntou *"onde você tirou essa
   característica?"* e eu não tinha resposta escrita, porque listei de cabeça e
   apresentei como catálogo. **Item sem procedência é palpite com cara de
   pesquisa.**
3. **para que serve**, numa frase que um dono de negócio entenderia.

Se não couber nas três, o item está mal recortado, e o problema não é o texto.

## O texto pronto para o global

```markdown
## Modelagem: use o vocabulário de programação

Ao explicar estrutura de sistema, use **classe, atributo, relação, tabela,
chave**. Não parafraseie em português: a paráfrase parece mais simples e é mais
lenta de ler, porque ele traduz de volta.

❌ "característica A3, funil de interesse, o que obriga: estágio, próximo passo"
✅ "classe `Pessoa`, atributo `funil`: estágio, próximo passo, motivo de perda"

⚠️ **Não contradiz a regra zero.** A regra zero proíbe nome de peça DESTE
projeto (`reporte-guard`, `frente`, `CC-98`), que ele não tem por que decorar.
Classe e atributo são vocabulário universal que ele já tem.

**A linha:** o nome existe fora do projeto? Use. Foi inventado aqui? Traduza.

**Todo item de lista se explica sozinho**, em três: o que é, de onde veio, para
que serve. Se não couber, o item está mal recortado, e o problema não é o texto.
```

## Onde nasceu

A aplicação inteira, com o antes e o depois, está no carzo:
`docs/COMO-EXPLICAR-MODELAGEM.md` e `apps/web_carzov2/src/lib/modelo.ts`. Lá a
regra virou trava: uma prova recusa atributo sem procedência, e outra recusa
atributo que se explique usando o próprio nome. As duas pegaram casos meus na
primeira rodada.
