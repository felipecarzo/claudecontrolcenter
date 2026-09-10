---
tags: [produto, visao, framework]
tipo: desenho
atualizado: 2026-09-10
estado: DESENHO PARA DISCUSSÃO. Nada implementado. Quatro decisões esperam ele
resumo: Projeto com prazo vira regime ativo, com disciplina diária e cálculo de atraso. Projeto paralelo fica passivo. O regime desce até a conversa. Hooks passam a dar alcance em vez de barrar.
---

# Rotinas: projeto ativo contra projeto passivo

Pedido dele em 10/09, fechado com *"anote"*. Este documento é o **projeto do
sistema**, que é o passo seguinte que ele pediu: *"precisamos projetar todo ele
e eles cada etapa, prever os possíveis problemas e discutir todos"*.

⚠️ **Nada aqui está implementado, e nada deve ser antes da conversa.** O prazo,
nas palavras dele, *"precisa ser coordenado entre eu e você"*.

O pedido cru, com as palavras dele, está no `docs/ROADMAP.md`, na frente aberta
em 10/09. Aqui é o desenho.

---

## O que já existe, e que este desenho NÃO refaz

Antes de propor peça nova, o que está de pé (medido em 10/09):

| Peça existente | O que já faz | O que falta para o pedido |
|---|---|---|
| **Modos do framework** (12) | governam o comportamento da sessão: `continuativo`, `restritivo`, `dialogo`, `estudo`, `depuracao`… | não têm nada a ver com PRAZO. Um modo diz como eu ajo, não quando a coisa entrega |
| **Fases do método** | `definicao` → `execucao`, com travas por fase e critérios de MVP | fase é ordem lógica, não calendário. Um projeto pode ficar em `execucao` para sempre |
| **39 hooks no catálogo** | disparam em `Stop` (27), `PreToolUse` (8), `SessionStart` (3), `UserPromptSubmit` (1) | **todos barram ou avisam**. Nenhum me DÁ alcance |
| **A aba de tempo** | horas por projeto, custo por token, tudo derivado dos transcritos | mede tempo GASTO. Nunca mediu prazo PROMETIDO |
| **`FRAMEWORK-ROTINAS.md` (13/08)** | o painel dono das rotinas: distribuir, ligar, desligar | não fala de prazo, nem de regime, nem de conversa |

**A conclusão que isso força:** o regime ativo/passivo é eixo NOVO, e ele não
substitui modo nem fase. São três eixos convivendo, e essa é a primeira coisa a
não errar.

---

## O desenho, em cinco etapas

Cada etapa entrega sozinha e é útil sem a seguinte. Ordem escolhida por
dependência real, não por importância.

### Etapa 1 — O regime existe e é visível

**O que entrega:** um projeto passa a ter `regime: 'ativo' | 'passivo'`, e o
ativo carrega `entrega` (data) e `combinadoEm` (quando os dois combinaram).

**Onde mora:** no `estado.json` do framework daquele projeto, ao lado de `modo`,
`fase` e `perfil`. Não em arquivo novo: o retrato do framework já viaja entre as
máquinas, então o regime viaja de graça.

⚠️ **A armadilha herdada, e ela já mordeu quatro vezes:** `gravar()` ignora o
modo quando o objeto lido tem campo com prefixo `_`. Quem grava escolha DELE lê
com `{ sessao: null }`. O regime vai pisar exatamente nesse caminho.

**Prova de que funcionou:** o cartão do projeto mostra o regime e a data, e o
projeto de outra máquina mostra também.

---

### Etapa 2 — A anotação diária, e o critério de silêncio

**O que entrega:** todo dia, o projeto ativo ganha uma linha de estado escrita
sozinha, e essa linha diz uma de três coisas: **em dia**, **apertado**, ou
**atrasado**.

**A parte difícil não é escrever, é calar.** Anotação diária que sai igual todo
dia vira paisagem em três dias, e ele para de ler. É o defeito nº 1 deste
projeto, em roupa nova.

Regra proposta, para discussão: **a anotação diária é sempre gravada, e só
aparece na tela quando MUDA de faixa** (de "em dia" para "apertado", por
exemplo) ou quando o atraso previsto cresce além de um limite. O histórico fica
inteiro para quem abrir; a tela só fala quando há novidade.

**O que a anotação mede**, e cada uma tem um defeito próprio:

| Sinal | O que prova | O que NÃO prova |
|---|---|---|
| commits no período | que houve trabalho | que o trabalho era o do prazo |
| itens fechados no roadmap | progresso declarado | que estão mesmo prontos |
| gate verde | que nada quebrou | que algo avançou |
| tarefas dele em aberto | onde está travado | de quem é a culpa do atraso |

⚠️ **Nenhum é suficiente sozinho, e ele precisa escolher o que conta.** É a
decisão nº 2 abaixo.

---

### Etapa 3 — O cálculo de atraso, e a honestidade da régua

**O que entrega:** dado o prazo e o que falta, uma previsão de entrega e o
atraso esperado.

⚠️ **O buraco que precisa aparecer antes de o número existir:** este ecossistema
nunca registrou estimativa. Existe tempo GASTO (a aba de tempo, sólida, 800 MB
de transcrito varridos) e itens fechados. **Não existe um único registro de
"prometi para tal dia, entreguei em tal dia".**

Consequência direta: a primeira régua é fraca, e **ela precisa se anunciar como
fraca**. Um número que finge precisão é pior que nenhum número, porque ele
decide coisas.

Proposta de gradação, para discussão:

1. **Régua zero (dia 1):** ritmo médio de itens fechados por dia neste projeto,
   contra itens que faltam. Na tela, com a idade da amostra ao lado: *"pela
   média das últimas 2 semanas"*.
2. **Régua um (depois de 3 entregas):** compara prometido contra realizado, que
   é o dado que passa a existir a partir da Etapa 1.
3. **Nunca:** número sem dizer de onde veio.

**A conta precisa contar o tempo DELE também**, e aqui está o segundo buraco: a
agenda dele não existe em lugar nenhum do sistema. Um prazo calculado sem saber
que ele passa três dias na rua é conta no vácuo. Decisão nº 3 abaixo.

---

### Etapa 4 — Quem roda quando não há ninguém

**O que entrega:** a verificação diária acontece mesmo sem sessão aberta.

Ele já desenhou o caminho: *"um agente específico na VPS que verifique a sessão
ativa ou o git no caso de nenhuma sessão ativa, pode ser um terminal rodando um
agente do opencode (já que é gratuito)"*.

**Três camadas, da mais barata para a mais cara:**

1. **Sem agente nenhum.** Boa parte da verificação é conta, não conversa: contar
   commits, ler o roadmap, comparar datas. Isso é código, roda em milissegundos
   e não precisa de modelo nenhum. **Fazer o máximo aqui.**
2. **Sessão viva, se houver.** Quando existe agente trabalhando naquele projeto,
   o hook aproveita e pede a anotação a ele, que já tem o contexto na cabeça.
3. **Agente próprio, só para o que sobrar.** O opencode entra apenas para a
   parte que exige julgamento (resumir o dia em uma frase, dizer o que está
   travando).

⚠️ **Dois riscos medidos, e os dois já aconteceram nesta VPS hoje:**

- **O opencode morreu por falta de memória duas vezes em 02/09** (`oom-kill`
  registrado). Apoiar disciplina de prazo num serviço grátis e instável exige
  queda para a camada 1 quando ele falhar. **Silêncio dele não pode virar "está
  tudo em dia"** — tem que virar "não consegui medir hoje", que é diferente.
- **Processo de fundo que não morre.** A armadilha já escrita: servidor subido
  por tarefa de background fica vivo por horas e o relógio corre. Este agente
  precisa nascer com teto de tempo e prova de que morreu.

---

### Etapa 5 — O hook como ferramenta, e o limite da autonomia

**A inversão que ele pediu**, com as palavras dele: *"gatilhos de Hook que
possam assegurar traves de segurança pra você mesmo usufruir, **como ferramentas
e não como travas de fato**"*.

Os 39 hooks de hoje fazem o contrário: 27 disparam no `Stop` para me cobrar, 8
no `PreToolUse` para me barrar. **Nenhum me dá alcance.**

**O que muda de lugar:** hoje o risco é eu ser barrado à toa. Com hook-ferramenta,
o risco passa a ser **eu agir demais**. A pergunta que precisa de resposta antes
de qualquer linha de código: *o que exatamente eu posso fazer sozinho?*

Proposta de eixo, para discussão — três anéis, do interno para o externo:

| Anel | Exemplo | Quem autoriza |
|---|---|---|
| **Livre** | anotar estado, medir, avisar, abrir ticket, escrever no diário | ninguém, é registro |
| **Combinado uma vez** | commitar o que já passou no gate, puxar código, abrir sessão na outra máquina | ele autoriza o TIPO, uma vez, e vale até revogar |
| **Sempre dele** | publicar, apagar, mexer em produção, mudar prazo, declarar tarefa concluída | ele, toda vez |

⚠️ **A linha mais importante é a última do anel 3:** declarar uma tarefa
concluída é dele. Se eu puder marcar concluído sozinho, o cálculo de atraso vira
autoelogio e o sistema inteiro perde sentido.

---

## O regime desce até a CONVERSA

É a peça mais nova do pedido, e a menos óbvia: *"todos os chats nesse projeto
seriam ativos ou passivos também"*.

**O que isso resolve:** hoje, dentro de um projeto com prazo, uma conversa de
exploração e uma conversa de entrega são indistinguíveis. As duas gastam tempo
do mesmo prazo, e nenhuma diz a qual delas pertence.

**O que isso complica**, e é preciso dizer antes de construir: o framework já
tem modo POR SESSÃO, e ele já mordeu quatro vezes com sessão herdando modo de
rota alheia. Somar regime por conversa sem unificar as duas contas repete o
defeito com nome novo.

**Regra proposta:** o regime da conversa **herda** o do projeto e pode ser
rebaixado, nunca promovido. Conversa dentro de projeto ativo nasce ativa; posso
marcá-la passiva ("estou explorando"), e isso a tira da conta do prazo. O
contrário não: conversa passiva não vira ativa sozinha, porque isso deixaria
qualquer conversa contaminar o prazo de um projeto que ele deixou de boas.

---

## Os oito problemas previstos

Ele pediu para prever e discutir todos. Estes são os que dá para nomear hoje.
Os cinco primeiros já estão explicados acima, nas etapas.

1. **Prazo estimado por quem nunca cumpriu prazo** (Etapa 3)
2. **"Prova de estar no prazo" precisa de definição dele** (Etapa 2)
3. **Rotina diária vira paisagem** (Etapa 2, critério de silêncio)
4. **Regime por conversa colide com modo por sessão** (seção acima)
5. **A agenda dele não existe no sistema** (Etapa 3)
6. **O agente de fundo sem supervisão** (Etapa 4)
7. **O opencode grátis é instável** (Etapa 4)
8. **Hook-ferramenta inverte o ônus do risco** (Etapa 5)

**Um nono, que só apareceu ao escrever este documento:** projeto ativo com
prazo cria pressão sobre MIM para declarar progresso. É o mesmo incentivo que
fez agentes deste projeto entregarem com to-do aberto e dizerem que estava
pronto. **A trava contra isso é a última linha da Etapa 5** (declarar concluído
é dele), e ela precisa entrar junto com a Etapa 1, não depois.

---

## O que ELE decide antes de qualquer código

1. **Qual projeto entra como ativo primeiro, e com que prazo.** Palavras dele: o
   prazo é coordenado entre os dois.
2. **O que conta como prova de que uma tarefa está no prazo.** A tabela da
   Etapa 2 lista quatro candidatos, e cada um mede coisa diferente.
3. **Se a agenda dele entra no sistema**, e como: integração de calendário de
   verdade, ou ele declara à mão as janelas em que não trabalha.
4. **Onde termina a minha autonomia.** A tabela de três anéis da Etapa 5 é
   proposta, não decisão.

---

## Ordem sugerida, e por quê

Etapa 1 primeiro porque tudo depende do regime existir. Etapa 5 (a trava de
"concluído é dele") **junto com a 1**, pelo problema nº 9. Depois a 2, que é
onde ele começa a ver valor. A 3 só depois de haver alguma história para medir,
e a 4 por último, porque é a única que precisa de processo novo rodando sozinho.

Fazer a 4 primeiro seria construir o motor antes do carro, e é o formato de
defeito que este projeto mais repete: peça que funciona, e ninguém chega nela.
