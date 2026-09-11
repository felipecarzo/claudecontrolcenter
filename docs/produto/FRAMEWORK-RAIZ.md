---
tags: [produto, framework, raiz]
tipo: decisao
atualizado: 2026-09-11
---

# A raiz do framework

Aberto por ele em 11/09, depois de ver o cockpit 2 no ar: *"Ta tudo errado
camarada (…) precisamos transformar o projeto em um FRAMEWORK. Vamos voltar
pra esse ponto crucial, o que vai definir o framework?"*

Este arquivo guarda o que foi decidido, na ordem em que ele decidiu, e o que
foi medido antes de cada decisão. O chat fica curto; o porquê fica aqui.

## O que o framework é para ele

Palavras dele: *"o framework é criado pra limitar a vasta imensidão de
possíveis gaps de comunicação entre um humano e uma IA no desenvolvimento"*.
Ele toca 6 projetos, perde o contexto entre um e outro, e texto longo piora a
retenção dele. O trabalho dele é decisão e captar erro no mundo real.

Daí as quatro perguntas de raiz, na ordem dele:

1. como funciona a criação de um projeto
2. como o framework age no projeto
3. como o projeto se auto-registra
4. como o framework identifica esses registros

E os três princípios:

- **tarefa não é linguagem natural.** A IA sintetiza em termos pré-definidos.
  Formato dele: `pedido: <tipo> - intenção: ~ <texto> - definição de pronto:
  <...>`. O `~` marca a parte que a IA interpreta; fora dele é código.
- **uma máquina lê os projetos ativos todo dia** e confere, por código, o
  que está pronto. Ativo/inativo vem da intenção do cliente.
- **o framework limita a forma como a IA fala:** pouco texto, explícito,
  decisão em pergunta, detalhe fora do chat.

## Medido antes de decidir (11/09)

**Registro dos projetos hoje.** 29 pastas em `D:\Documentos\projetos`. Com
git: 27. Com `CLAUDE.md`: 21. Com `docs/ROADMAP.md`: 16. Com
`docs/backlog.jsonl`: 15. Com `.framework/estado.json`: 12. Com
`docs/produto/MVP.md`: 3. Nenhum arquivo diz quem é o cliente nem se o
projeto está ativo. O registro está espalhado em cinco arquivos.

**O backlog em dado (deste projeto).** 543 itens com os campos `id, titulo,
estado, frente, peso, criado, mexido, prova, porque, decisao, citacao,
depende, origem`. Estados usados: OK 300, KO 210, B1 32, PR 1. Frentes: 50,
quase todas em prosa ("Frente nova, aberta em 10/09: o sistema de rotinas…"),
e a maior é "herdado sem estado", com 110. Títulos são frases: 146 começam
com "o", 90 com "a"; mediana de 59 caracteres, máximo 355. Com prova: 300.
Com peso: 42. Com citação dele: 3.

O que o item já tem do formato dele: id rastreável, estado em código, prova,
porquê, dependência, origem. O que falta: **tipo de pedido** (não existe),
**intenção** (enterrada no título em prosa), **definição de pronto** antes de
fechar (hoje só existe a prova, depois). A frente também precisa virar código.

## Decidido por ele (11/09, pergunta direta)

| pergunta | escolha dele |
|---|---|
| de onde nasce a lista de termos | **derivada dos 543 itens**: eu proponho, ele corta |
| por onde começa a raiz | **pelo registro do projeto**, antes do vocabulário |
| onde mora o registro | **no arquivo de estado que já existe** (`.framework/estado.json`, 12 projetos já têm), que ganha `cliente`, `ativo` e `site`; os outros 17 ganham o arquivo |
| quem decide ativo/inativo | **ele marca**, pela intenção do cliente; o painel só avisa (ativo sem sinal há dias, inativo com sessão). Nunca derivar do sinal |

## O que isso responde das quatro perguntas

- **3, auto-registro:** o projeto existe para o framework porque tem o
  arquivo de estado no repositório. Sem arquivo, não é projeto do framework.
- **4, identificação:** o leitor varre as pastas de projeto atrás desse
  arquivo. Nada de lista digitada à mão; é derivado, como o resto.
- **1, criação:** criar projeto é criar a pasta e o arquivo, com cliente e
  ativo preenchidos por ele. O botão de projeto novo do painel já cria a
  pasta; passa a criar o arquivo também. (a decidir: o que mais nasce junto)
- **2, como o framework age:** pelas travas (hooks) que já existem, mais as
  que faltam: recusar tarefa sem tipo, intenção e pronto; e exigir a FORMA da
  resposta. (a decidir: quais, e em que ordem)

## O vocabulário, derivado dos 543 itens (proposta para ele cortar)

Medido em 11/09 contando palavras nos títulos. Um título pode bater em mais
de um grupo, e é isso que revela os dois eixos.

**Eixo 1, a NATUREZA do item** (um por item, obrigatório):

| código | o que é | quantos hoje (por palavra no título) |
|---|---|---|
| `DEF` | defeito: existia e quebrou | 42 |
| `PED` | pedido: algo que não existe | o resto |
| `DEC` | decisão dele: só ele resolve | 58 |
| `MED` | medição: descobrir antes de agir | 37 |
| `DOC` | registro: texto, sem código | 133 (inclui muito PED de docs; ele corta) |

**Eixo 2, a ÁREA** (a frente vira código de uma palavra; a frase vira descrição):

| código | quantos títulos batem |
|---|---|
| `dado` | 147 |
| `tela` | 129 |
| `agente` (sessões, rotas, recados, coderoom, agy) | 75 |
| `maquinas` (VPS, desktop, federação, serviço, portas) | 56 |
| `trava` (hooks, gates, guardas) | 50 |
| `texto` (docs, roadmap, glossário, linguagem) | 133 |

211 títulos batem em duas áreas: por isso a área é escolhida por quem escreve,
não derivada por palavra.

**Os 116 sem tipo:** 110 são "herdado sem estado", cabeçalhos de prosa que a
migração trouxe como item ("As três queixas que o pedido contém"). Já estão
em KO. Proposta: marcar `NT` (não é tarefa) para o leitor pular, sem apagar.

**O item, no formato dele:**

```
id: CC-nnn
natureza: DEF | PED | DEC | MED | DOC
area: dado | tela | agente | maquinas | trava | texto
intencao: ~ <até 140 caracteres, a única parte livre>
pronto: <o que se observa quando está feito; obrigatório ao criar>
estado: B1 | PR | OK | KO | TR | NT
prova: <preenchido ao fechar, como hoje>
```

O que muda em relação a hoje: `natureza`, `area` e `pronto` passam a ser
obrigatórios na criação, e a trava recusa item sem eles. `titulo` deixa de
existir como campo livre: o que aparece na tela é `natureza + area + intencao`.

## As outras etiquetas: o que o dado diz (pergunta dele em 11/09)

Ele perguntou se natureza e área cobrem, ou se falta etiqueta (hora, prazo,
importância). Medido nos 543 antes de responder:

| medida | número | o que isso decide |
|---|---|---|
| itens fechados no mesmo dia em que nasceram | **524 de 543** | prazo não serve: nada dura o bastante para ter data |
| itens abertos hoje | 33, o mais velho com 21 dias | o que existe é "parado há", e isso é derivado de `mexido` |
| `peso` preenchido | **42 de 543 (8%)**, e só com 4 valores | campo que 92% ignora vira mentira na tela |
| `depende` preenchido | **0** | dependência entre itens nunca foi usada |
| `decisao` / `citacao` | 2 e 3 | idem |
| `prova` preenchida | 300 (55%) | |
| provas que citam comando ou teste | **27 de 300** | **a máquina hoje não consegue conferir quase nada** |
| provas que só o olho confere | 62 | |
| provas em prosa, sem dizer como conferir | 228 | |
| `origem` | 543 (100%) | derivado, nunca digitado: é assim que campo sobrevive |

**A conclusão que o dado impõe:** a etiqueta que falta não é prazo nem
importância. É **como conferir**. O pedido dele é que *"uma máquina leia a
documentação dos projetos ativos todo dia e verifique se as tarefas estão
prontas baseadas em códigos"*, e isso é impossível enquanto o `pronto` for
prosa. `conferir` é o campo que transforma o leitor diário de ideia em coisa
que roda.

### FECHADO por ele em 11/09: o item do framework

```
id:        CC-nnn
natureza:  DEF | PED | DEC | MED | DOC        obrigatório
area:      dado | tela | agente | maquinas | trava | texto   obrigatório
tamanho:   P | M | G                          obrigatório
intencao:  ~ <até 140 caracteres>             a única parte livre
pronto:    <o que se observa quando está feito>   obrigatório
conferir:  auto:<comando> | olho:<o que olhar> | dele:<o que ele confirma>   obrigatório
trava:     dele | CC-nnn | mundo:<o quê>      quando parado
risco:     local | compartilhado | cliente    quando sai da máquina
estado:    B1 | PR | OK | KO | TR | NT
prova:     <preenchido ao fechar>
```

Ele fechou as três perguntas: `conferir` obrigatória com os três modos, `trava`
e `risco` entram as duas, e `tamanho` volta como P/M/G obrigatório. Título
livre deixa de existir: a tela mostra `natureza + area + intencao`.

### O caminho até aqui (a proposta que virou a decisão acima)

**Obrigatórias na criação** (a trava recusa o item sem elas):

| etiqueta | valores | por quê |
|---|---|---|
| `natureza` | `DEF` `PED` `DEC` `MED` `DOC` | o que é |
| `area` | `dado` `tela` `agente` `maquinas` `trava` `texto` | onde é |
| `pronto` | texto observável | o que se vê quando está feito |
| `conferir` | `auto:<comando>` · `olho:<o que olhar>` · `dele:<o que ele confirma>` | **quem consegue dizer que está pronto.** Sem isto o leitor diário não existe |

**Obrigatórias quando o caso aparece:**

| etiqueta | valores | por quê |
|---|---|---|
| `trava` | `dele` · `CC-nnn` · `mundo:<o quê>` | item parado diz QUEM destrava. Hoje é prosa em `porque`, e o painel não consegue somar "3 esperando você, 2 esperando cliente" |
| `risco` | `local` · `compartilhado` · `cliente` | o que sai da máquina e o que chega no cliente exige decisão dele. Hoje é invisível, e é a diferença entre publicar e derrubar site de cliente |

**Recusadas, com o motivo medido:**

- **prazo/data**: 96,5% dos itens vivem menos de um dia. Data seria campo
  vazio em 9 de cada 10, e campo vazio na tela vira ruído. Prazo de verdade
  (data de cliente) é do PROJETO, não do item.
- **importância/peso livre**: já existe e já apodreceu (8%). Se voltar, volta
  como `tamanho: P M G`, obrigatório na criação, porque o agente sabe na hora
  de escrever. Fora isso, a ordem sai do que já é derivado: quem trava mais
  gente e quem está parado há mais tempo.
- **hora gasta**: já é derivada dos transcritos pela aba Tempo. Digitar seria
  uma segunda verdade.

## Aberto

- o vocabulário: os tipos de pedido derivados dos 543 itens (proposta a
  seguir, para ele cortar)
- a frente como código
- o formato da resposta da IA como trava, não só como texto
- o leitor diário: o que ele produz e onde ele escreve
- os robôs nos sites dos clientes (registrado, sem desenho ainda)
