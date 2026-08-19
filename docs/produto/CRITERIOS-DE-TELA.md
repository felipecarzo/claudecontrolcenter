---
tags: [produto, design, decisao]
tipo: criterio
atualizado: 2026-08-19
estado: combustível do redesenho (CC-156), derivado de documento que já existia
resumo: As regras que decidem cada escolha de tela do redesenho, cada uma amarrada a um número medido ou a uma frase dele. Existe porque a evidência estava espalhada em quatro documentos e nenhuma decisão de layout conseguia ser defendida sem reler os quatro.
termos:
  régua: a medida que decide um empate de design, quando duas opções parecem boas
  janela de atenção: quanto tempo ele fica num projeto antes de trocar. Medido em ~10 minutos
  dobra: o que cabe na tela sem rolar, no aparelho dele (390px de largura)
  custo de erro: o que se perde quando a tela erra. Nem todo erro custa igual
---

# Critérios de tela: o que decide cada escolha do redesenho

## Por que este documento existe

A direção do redesenho está fechada em [[REDESENHO-TELA]], e ele terminou com
três perguntas em aberto. As respostas não estavam faltando: estavam
**espalhadas** entre [[CICLO]] (como ele trabalha, com número), [[COCKPIT]] (o
que o produto é), [[TELAS]] (o que existe hoje) e as armadilhas do
`CLAUDE.md`.

O custo disso é concreto: toda decisão de layout virava discussão de gosto,
porque a evidência que a resolveria estava a quatro documentos de distância.
Aqui ela vira régua.

**Nada aqui é novo.** Cada critério aponta para onde já estava escrito.

---

## As cinco réguas, em ordem de força

Quando duas opções de tela parecem boas, é isto que desempata. Estão em ordem:
a de cima vence a de baixo.

### 1. Ele tem ~10 minutos, e não vai voltar

**Medido:** janela de atenção por projeto de 8 a 20 minutos, mediana ~10. E
**67% das mensagens seguidas trocam de projeto** ([[CICLO]]).

**O que decide:** qualquer coisa que precise de mais de um clique para
responder "preciso agir aqui?" chega tarde. Não porque ele é impaciente, mas
porque em dez minutos ele está em outro projeto e aquela tela deixou de
existir para ele.

**Consequência para o redesenho:** a triagem do topo (camada 1) não é enfeite
nem resumo. É a única parte da tela que tem garantia de ser lida.

### 2. A ordem é a informação

**De onde vem:** [[COCKPIT]], princípio já em vigor. *"O topo da lista é onde
mexer. Uma coluna, não grade — grade faz o olho varrer, e a pergunta é 'o
primeiro', não 'todos'."*

**O que decide:** sempre que houver uma escolha entre mostrar tudo em grade e
mostrar ordenado em coluna, é coluna. E a maior dor declarada por ele é
literalmente **"não saber o que priorizar agora"** — uma grade devolve essa
dor com mais dados dentro.

**Consequência:** os cartões de projeto (camada 2) vêm ordenados por urgência,
nunca em ordem alfabética nem em grade de duas colunas no celular.

### 3. Número sem frase não é discutível

**De onde vem:** [[COCKPIT]]. *"O peso nunca aparece na tela. O que aparece é a
frase ('travado: falta credencial da VPS'). Ele não teria como discordar de um
'87'."*

**O que decide:** todo indicador do redesenho precisa de uma frase ao lado,
não só um valor. Vale para tudo que vier a ser mostrado: custo, tempo parado,
quantidade de item aberto.

**A prova de que a régua é real:** este projeto já criou o campo `frente`
exatamente por isso. *"Pierre: travessia gamificada"* não dizia nada a ele,
embora "Pierre" fosse uma seção do roadmap dele.

### 4. O celular é a régua, não o monitor

**De onde vem:** as armadilhas do `CLAUDE.md`, e o histórico de queixa dele
sobre tela estreita. O breakpoint do painel é `@container`, não `@media`,
porque com a coluna de notas aberta a janela continua larga enquanto o painel
encolhe.

**O que decide:** o que não couber em 390px de largura não existe. Isso já
matou desenho no passado (grafo de bolinhas, tabela de oito colunas), e é a
razão pela qual o mapa das avenidas (CC-155) virou faixas horizontais
empilhadas em vez de grafo.

### 5. Erro de omissão custa mais que erro de excesso, exceto no topo

**De onde vem:** a família de defeitos já registrada aqui — `total: 0` do
CC-124, "nenhum projeto encontrado" do CC-158, a lista de framework mostrando
23 projetos quando 19 eram ruído (CC-164).

**O que decide, e é sutil:** esconder informação **abaixo** da triagem é
barato (ele clica se precisar). Esconder ou distorcer informação **na**
triagem é caro, porque ela é o que ele lê. E o pior erro dos dois é a tela
**afirmar** algo falso: lista vazia dizendo "não há nada" quando na verdade
não conseguiu perguntar.

**Consequência:** todo bloco recolhido diz quantos itens escondeu, e nenhum
estado de erro se disfarça de estado vazio.

---

## As três perguntas em aberto, respondidas pela evidência

O [[REDESENHO-TELA]] terminou com três coisas por decidir. Nenhuma precisa de
opinião nova.

### Onde a gaveta do sistema abre

**Resposta: por cima, ocupando a tela inteira no celular, e como painel
lateral no monitor.**

Vem da régua 4, e de uma armadilha específica já registrada: *elemento com
estado do sistema operacional (menu aberto, seletor de arquivo) não pode estar
dentro de bloco redesenhado por timer*. A gaveta é justamente onde moram os
seletores de configuração, e o painel se redesenha a cada 2 segundos. Abrir
por cima resolve os dois: sai do fluxo do redesenho e não disputa largura.

### Se remoto + servidores cabe dentro do cartão de projeto

**Resposta: cabe, com teto de 3 servidores visíveis e o resto atrás de uma
linha que diz quantos são.**

O medo era o cartão gigante. Medido neste PC em 19/08, e a primeira medição
que fiz estava errada: contei o **histórico** do `config.json` e vi 29
entradas num projeto só, o que teria condenado o desenho. O histórico guarda
toda porta que já subiu ali algum dia, não o que está de pé.

O número que importa é o de agora: **25 processos escutando porta, dos quais
3 são servidor de desenvolvimento**. O cartão mostra os de desenvolvimento, e
o caso temido não acontece hoje.

**A ressalva honesta:** os 3 apareceram sem projeto atribuído, então esta
medição não prova a distribuição POR projeto, só o teto total. Se um dia um
projeto passar de 3, a régua 5 já diz o que fazer: recolher dizendo quanto
recolheu, nunca cortar em silêncio.

### O que é "projeto sem atividade"

**Resposta: nenhum agente vivo E nada mudou desde a última visita dele.**

Não é tempo puro. O painel já tem a marca de visita ("vi isso") e o delta
"desde que você saiu" ([[COCKPIT]], CC-33). Usar só tempo parado esconderia um
projeto que mudou às 3 da manhã por outra máquina, que é exatamente o caso que
a federação passou a produzir.

---

## O que o inventário de telas já provou, e o redesenho tem que resolver

De [[TELAS]], que mapeou as 17 telas atuais. Quatro achados que viram
requisito:

1. **Três telas respondem "o que falta fazer"** em níveis diferentes (frentes,
   to-dos dos agentes, o que só ele resolve). O funil existe e está certo, mas
   nada na tela diz que são três níveis da mesma coisa. **O redesenho precisa
   tornar o funil visível**, não criar um quarto nível.
2. **Cinco telas só existem por causa de uma máquina** (servidores, VPS,
   escritório, remoto, rotinas). Quem abre no celular vê metade vazia. Já
   existe mecanismo para isso (`tem`, do CC-121, que esconde aba que abriria
   vazia); o redesenho estende, não reinventa.
3. **Custo aparece em três telas com unidades diferentes**, e nenhuma é a
   fatura. Se o custo entrar no cartão de projeto, entra com uma unidade só, e
   com a frase da régua 3.
4. **Bancada e proteções são "o que me controla"** e vivem longe do projeto a
   que se aplicam. No redesenho elas moram dentro do cartão do projeto, e a
   configuração fica na gaveta.

---

## O que este documento não decide

Cor, tipografia, espaçamento e animação. Esses são escolha dele, olhando, e
[[../guias/DESIGN]] já guarda o que foi decidido antes. Aqui só está o que
pode ser defendido com número ou com frase dele.

E não decide ordem de construção: isso é do `ROADMAP.md`, e a regra dele já
está escrita — protótipo inteiro para decidir, micro-tarefas para executar.
