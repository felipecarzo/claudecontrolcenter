---
tags: [produto, escopo]
tipo: escopo
atualizado: 2026-09-11
estado: v1 fechada em 05/08. v2 aberta em 11/09, com os três cortes que ele escolheu.
resumo: O que "pronto" significa neste projeto. Duas camadas: pronto do PRODUTO (as três frases de corte da v2) e pronto de uma ENTREGA (as condições que toda tarefa cumpre). É a fonte que o gate do framework usa aqui.
termos:
  corte: a frase que decide se uma coisa entra na versão ou fica de fora
  definição de pronto: as condições que toda entrega cumpre, prova na tela incluída
  estado de produção: o código curto que o backlog em dado grava (B0, B1, EM, PR, DE, TR, OK, KO)
---

# MVP e definição de pronto

## v1: fechada em 05/08

O corte era: **abrir o painel e saber o estado de todos os agentes sem entrar
em nenhum.** As sete entregas ficaram prontas, e o histórico está em
[legacy/ROADMAP-em-prosa-ate-2026-09-11.md](../legacy/ROADMAP-em-prosa-ate-2026-09-11.md).

## v2: aberta em 11/09, e ela tem TRÊS cortes

**✅ Aprovada por ele em 11/09**, com uma palavra: *"aprovado"*.

### O que os três cortes marcam hoje, medido em 11/09 pela manhã

Ele mandou *"seguir o MVP até o fim"*, e isto é o resultado, medido no painel
vivo desta máquina. Cada linha é número, não impressão.

| | antes | agora |
|---|---|---|
| exigências do framework ativas nesta máquina | não havia lista | **44 de 45**, e a única que falta é a versão publicada, que é decisão dele |
| Claude Code, opencode e antigravity | 1 de 3 | **3 de 3** |
| quem avisa quando uma peça cai | ninguém | comando, hook de início (uma vez por dia) e bloco na tela Máquinas |
| itens do quadro com id inventado | **152 de 226 (67%)** | **0 de 523** |
| projetos com backlog em dado | 0 | **15**, com 1.509 itens e nenhum sem id |
| primeiro lugar do placar de travas | `sem nome`, 334 | `pergunta-guard`, 36. As 333 quebras foram para bloco próprio |
| itens de menu | 20 | **10** na versão nova, com o design intacto |
| projetos fora do quadro | 13, sem saída escrita | 13, **com o comando de entrada na própria tela** |

**O que continua aberto, e por quê:** as 10 telas escondidas ainda não viraram
gaveta dentro das que ficaram (CC-477), e o arquivo passou para a rota
`cockpit2` de outra sessão em 11/09. O corte 2 fecha quando isso acontecer, ou
quando o redesenho dela tornar o item sem sentido.

Ele escolheu os três na pergunta direta, e a ordem abaixo é a de dependência,
não de importância: o primeiro sustenta os outros dois.

### Corte 1: o framework governa a máquina

**Pronto quando qualquer IA, em qualquer projeto, é obrigada pelo framework a
registrar o que fez, e o painel reflete isso sozinho.**

Palavras dele, em 11/09: *"o meu computador é uma ferramenta de trabalho e eu
quero que o framework seja parte ativa do sistema (…) quero que o sistema
funcione mais focado no desenvolvimento com o framework do que ser um sistema
propriamente dito"*.

O que este corte recusa: framework que depende de alguém lembrar de instalar.
Medido em 11/09 neste PC: os dois hooks que SÃO o framework não estavam
registrados, 14 hooks do repositório não estavam instalados, e o encaixe do
opencode nunca foi posto no lugar. Nada disso dava erro.

Fecha quando:
- um manifesto declara o que o framework exige de uma máquina, e um
  verificador compara com a máquina real, sozinho, e diz o que falta;
- Claude Code, opencode e antigravity registram no mesmo lugar, cada um no
  limite da própria ferramenta, e o limite está escrito;
- máquina nova entra no padrão por um comando, não por memória.

### Corte 2: ele abre o painel e sabe o que fazer hoje

**Pronto quando a primeira tela responde o que fazer agora, sem caçar em vinte
janelas.**

Palavras dele, em 10/09: *"tem muitas janelas no atual, e na verdade tem muita
coisa que eu nao entendo como funciona"*.

Fecha quando:
- o menu cabe em uma tela, e toda tela tem dado vivo (medido em 10/09: 5 das
  32 estavam vazias sem dizer por quê);
- nenhuma tela exige que ele lembre o que ela faz para usá-la;
- o que está velho se declara velho, com a data do último sinal.

### Corte 3: o painel não mente nunca

**Pronto quando todo número na tela é rastreável até a origem, e nada aparece
inventado.**

Palavras dele, em 10/09: *"as informacoes jogadas acabam perdendo o sentido"*.
Medido em 11/09: **152 dos 226 itens do quadro (67%) não tinham identificador,
e o painel inventava um para desenhar**; o placar de travas tinha "sem nome"
em primeiro lugar, com 334 ocorrências, que eram um hook quebrado.

Fecha quando:
- nenhum item aparece com id inventado, em tela nenhuma;
- leitura que falhou nunca se parece com "está tudo bem";
- erro de sistema nunca se mistura com dado de trabalho no mesmo número.

## Definição de pronto de uma ENTREGA

Vale para toda tarefa, em qualquer frente. Uma entrega só está pronta quando
**todas** as linhas valem:

1. `npm test` passa, incluindo a leitura dos jobs reais da máquina.
2. Foi verificada na superfície onde ele vai ver: tela aberta de verdade, ou
   rota HTTP chamada de verdade. **Ler o código não conta, e teste verde não
   conta**: já houve 545 testes passando com a tela quebrada no navegador.
3. A prova está ESCRITA no item do backlog, no campo `prova`. O código recusa
   fechar sem ela, e isso não é lembrete, é trava (`src/backlog.mjs`).
4. Nada foi escrito dentro de `~/.claude/jobs/` além de `meta.json`.
5. O Claude Code continua funcionando, comprovado com job vivo.
6. Canto cortado de propósito está escrito, no item ou num comentário
   `ponytail:` no código.
7. Se mudou o que o agente precisa seguir, `AGENTS.md` mudou junto. Protocolo
   e código não podem divergir.
8. **A peça é alcançável.** A pergunta final é sempre a mesma: por onde ele
   chega nela? Peça construída e inalcançável é o defeito mais caro deste
   projeto, e não dá erro nenhum.

## Os estados de produção

O backlog é dado, não prosa, desde 11/09. Cada item carrega um código de
estado, e a máquina compara o código, nunca o rótulo. A lista está em
`src/backlog.mjs` e é a única fonte:

| código | rótulo | o que significa |
|---|---|---|
| `B0` | ideia | registrada com as palavras dele, ainda não avaliada |
| `B1` | definida | tem critério de pronto escrito, pode ser pega |
| `EM` | andando | alguém está fazendo agora |
| `PR` | prova | o código existe, falta a prova na tela |
| `DE` | decisão dele | parado esperando ele, e só ele resolve |
| `TR` | travado | parado por obstáculo técnico, com a causa escrita |
| `OK` | fechado | pronto, com prova registrada |
| `KO` | cancelado | não vai acontecer, com o motivo escrito |

Quatro transições são recusadas pelo código, não pedidas por escrito: fechar
sem prova, cancelar sem motivo, travar sem causa, e esperar decisão dele sem
dizer qual é a decisão.

## Como se sabe que o produto funcionou

Não por métrica: pelo comportamento.

- **v1**: ele abre o painel em vez de apertar `←` `←`.
- **v2**: ele abre o painel e age, em vez de perguntar o que a tela quer dizer.

Está falhando quando ele precisa perguntar a um agente o que está acontecendo
num projeto que o painel já deveria estar contando.
