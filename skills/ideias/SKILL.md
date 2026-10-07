---
name: ideias
description: "Transforma ideias soltas do Felipe (ditadas, coladas, ou uma fala com várias coisas) em itens do backlog do projeto, como emenda, e pergunta a ele o lugar de cada uma na fila (agora, fim do dia, fim do sprint, fim do backlog, fora do MVP), com uma sugestão marcada. Use quando ele despejar várias ideias, disser 'anota isso', 'tive uma ideia', 'e se', 'proponho', ou colar uma lista."
---

# Ideias: da fala para o Caminho

Ideia que você só escreve na conversa **não chega ao Caminho**. A fila antiga
(`docs/.ideias-pendentes.json`) guarda para a próxima sessão e não escreve no backlog.
Esta skill fecha esse buraco: cada ideia vira um item do backlog **agora**, marcado como
**emenda** (ideia nova no meio do projeto), no trecho do Caminho onde o projeto está.

O comando do painel é `node ~/projetos/VPS_cockpit/cc.mjs` (chamado de `cc` abaixo).

## Regra que manda

**Registrar não é executar.** Uma ideia longa que abre com "e se", "tive uma ideia",
"proponho", "poderíamos" é visão, não tarefa. Registre com as palavras dele e **pare**.
Só implemente se ele disser para fazer aquele item.

## Passo 1. Separar

1. Leia a fala inteira. Muita coisa vem **ditada por voz** com erro fonético ("nivem" por
   nuvem). Normalize para entender, mas **nunca corrija a grafia dele na citação**.
2. Uma ideia por item. Se uma frase tem duas ideias, são dois itens.
3. Se algo é pergunta ("isso já existe?") ou conversa, não é item: responda e siga.

## Passo 2. Conferir se já existe

Antes de registrar, procure no backlog por palavras-chave da ideia:

    cc backlog fila
    grep -i "<palavra-chave>" docs/backlog.jsonl

Se já existe, **não duplique**: diga o número do item que cobre. Se cobre em parte, registre só
a parte que falta e cite o item.

## Passo 3. Registrar cada ideia

Para cada ideia nova, **na pasta do projeto**:

    cc backlog emenda "a ideia em uma frase de até 140 caracteres" \
      --citacao "as palavras dele, exatas" \
      --natureza PED --area tela --tamanho M \
      --pronto "o que se observa quando estiver feito" \
      --conferir "dele: o que ele confirma olhando"

- `--natureza`: DEF (existia e quebrou), PED (não existe e precisa existir), DEC (só ele
  decide), MED (descobrir antes de agir), DOC (texto).
- `--area`: dado, tela, agente, maquinas, trava ou texto. `--tamanho`: P, M ou G.
- `--conferir` é `auto:` só se existir um comando da lista fechada que prove; gosto e tela
  são `dele:`.
- Ideia que **melhora uma função que já existe**: ache o item dessa função (passo 2) e passe
  `--melhora <ID>`. A ideia entra no trecho (a frente) dessa função.
- Se ele **já disse o lugar** na fala ("pro fim do dia", "depois do MVP"), passe
  `--lugar agora|dia|sprint|backlog|fora` e pule o passo 4.

Sem `--lugar`, a ideia nasce como ideia, **fora da fila**, e o comando imprime a sugestão de
lugar e as quatro opções da pergunta.

## Passo 4. Perguntar o lugar

Nada entra na fila sem o toque dele. Uma pergunta por ideia no **AskUserQuestion** (até 4
perguntas por chamada; com mais ideias, mais chamadas), cabeçalho curto ("Lugar"):

- as opções são as que o comando imprimiu, na mesma ordem, a primeira com "(Recomendado)";
- a ferramenta mostra no máximo 4 opções: o quinto lugar vai escrito no texto da pergunta,
  para ele responder no campo livre;
- o que cada lugar quer dizer:
  - **agora**: urgente, fura a fila, logo depois do que está andando;
  - **fim do dia**: ainda hoje, antes do resto do sprint atual;
  - **fim do sprint**: neste sprint, depois do que já estava nele;
  - **fim do backlog**: depois de tudo o que já existe;
  - **fora do MVP**: guardada, não entra na fila até ele promover.

Grave a escolha: `cc backlog lugar <ID> <agora|dia|sprint|backlog|fora>`.

## Passo 5. Dizer onde ficou

Termine com **uma linha por ideia**: número, o que é, o lugar na fila e o trecho do Caminho.
Diga que elas aparecem na tela **Caminho** e que ele pode mudar o lugar depois tocando no
botão do lugar, no próprio item.

## O que esta skill não faz

- Não implementa a ideia.
- Não escolhe o lugar por ele: sugere e pergunta.
- Não mexe no que está em andamento.
- Não apaga a ideia da fila antiga: o fim da sessão cuida dela.
