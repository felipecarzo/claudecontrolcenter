---
name: Agent Cockpit
description: A folha de boletim de um torneio por correspondencia, onde N partidas simultaneas dizem de quem e a vez.
colors:
  bg: "#1c2320"
  surface: "#242c28"
  surface-2: "#2c352f"
  line: "#3a463e"
  line-soft: "#2f3a33"
  fg: "#e6e2d6"
  dim: "#a8b0a4"
  faint: "#939c90"
  vez: "#e8776b"
  tinta: "#7d8a7f"
  acento: "#9dc2a4"
  working: "#6f9fd8"
  waiting: "#d9a441"
  failed: "#d488b0"
  done: "#6aab7d"
  idle: "#99a296"
typography:
  display:
    fontFamily: "Archivo Narrow, Segoe UI Variable Display, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.09em"
    fontStretch: "75%"
  headline:
    fontFamily: "Archivo Narrow, Segoe UI Variable Display, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.02em"
  title:
    fontFamily: "Archivo Narrow, Segoe UI Variable Display, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.09em"
    fontStretch: "75%"
  body:
    fontFamily: "ui-sans-serif, Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo Narrow, Segoe UI Variable Display, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
    fontStretch: "75%"
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, SF Mono, Consolas, monospace"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
    fontVariant: "tabular-nums"
rounded:
  folha: "0"
  controle: "3px"
  cartao: "6px"
  bloco: "10px"
  selo: "999px"
  disco: "50%"
  deriva-1: "1px"
  deriva-2: "2px"
  deriva-4: "4px"
  deriva-5: "5px"
  deriva-7: "7px"
  deriva-8: "8px"
  deriva-9: "9px"
  deriva-12: "12px"
  deriva-14: "14px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "9px"
  lg: "12px"
  xl: "18px"
  secao: "26px"
components:
  turno-linha:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.folha}"
    padding: "7px 2px"
  turno-linha-hover:
    backgroundColor: "{colors.surface}"
  cartao-agente:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.cartao}"
    padding: "9px 11px 8px 13px"
  cartao-agente-hover:
    backgroundColor: "{colors.surface-2}"
  cartao-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.bloco}"
    padding: "10px 12px 9px"
    height: "106px"
  cartao-item-hover:
    backgroundColor: "{colors.line-soft}"
  botao:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.dim}"
    typography: "{typography.mono}"
    rounded: "{rounded.controle}"
    padding: "4px 10px"
    height: "30px"
  botao-hover:
    textColor: "{colors.fg}"
  botao-primario:
    textColor: "{colors.acento}"
  botao-perigo:
    textColor: "{colors.failed}"
  campo:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    typography: "{typography.mono}"
    rounded: "{rounded.controle}"
    padding: "5px 9px"
    width: "170px"
  selo-estado:
    textColor: "{colors.working}"
    typography: "{typography.label}"
    rounded: "{rounded.selo}"
    padding: "4px 7px"
  aba:
    backgroundColor: "transparent"
    textColor: "{colors.faint}"
    typography: "{typography.label}"
    rounded: "{rounded.folha}"
    padding: "8px 14px"
  aba-ativa:
    textColor: "{colors.fg}"
---

# Design System: Agent Cockpit

## Overview

**Creative North Star: "O Boletim do Torneio por Correspondencia"**

O mundo e a folha impressa de um torneio de xadrez jogado por carta. O fundo nao
e o cinza-azulado de painel generico: e a casa escura do tabuleiro, com verde de
oliva dentro, e a superficie de cada cartao e a casa clara. Essa unica escolha e
o que separa esta tela de qualquer outro dashboard da categoria, porque ela
troca a pergunta. Um painel comum responde "quanto"; este responde "onde eu
jogo agora".

A densidade e de boletim, nao de cartao de metrica. Nao existe numero grande
sozinho numa caixa: a informacao esta na ordem das linhas, e quem espera ha mais
tempo vem primeiro, exatamente como o relogio de xadrez trata a bandeira caida.
A regua dupla, feita de borda mais borda, separa a cabeca da tabela do corpo
dela, que e o que o papel faz e a tela quase nunca faz. Onde digito precisa
alinhar entre linhas vizinhas, a fonte e de largura fixa com `tabular-nums`;
onde e rotulo, a fonte e condensada, com o feitio de cabecalho de tabela
impressa.

A cor obedece a uma disciplina herdada do teletexto: cada cor significa uma
coisa so, na tela inteira, sempre. O vermelho de bandeirinha (`--vez`) nunca e
decoracao. Cor de estado nunca vira fundo, apenas texto, barra fina ou borda,
porque fundo tingido deixa o texto de dentro ilegivel e isso ja aconteceu duas
vezes neste projeto. O sistema recusa sombra como recurso de leitura e usa
superficie e regua no lugar, com uma excecao declarada: a gaveta lateral, que
precisa flutuar sobre a pagina.

**Key Characteristics:**
- Tabuleiro como chao: verde-oliva escuro, nao cinza neutro
- Densidade de boletim, zero cartao de metrica grande
- Uma cor, um significado, na tela inteira
- Plano por padrao, com separacao por superficie e por regua
- Condensada para rotulo, largura fixa para digito, humanista para prosa
- Estreito primeiro: 390px e o aparelho de referencia, o monitor herda

## Colors

Uma paleta de tinta sobre papel de torneio: o verde do tabuleiro sustenta tudo,
e as unicas cores saturadas sao semanticas. A paleta foi medida numericamente
pela formula da WCAG contra `--bg` **e** contra `--surface`, nos dois temas.
Todo token de texto passa de 4,5:1 e toda regua passa de 3:1, com o pior caso em
4,50. Medir contra o fundo da pagina quando o texto mora dentro de um cartao e
medir o par errado, e esse erro ja custou uma paleta inteira aqui.

Dois temas embarcam e os dois estao em uso real: `noite` (o padrao, aplicado em
`:root`) e `papel`. O tema `papel` redefine as mesmas variaveis e nada mais. O
frontmatter acima carrega o tema `noite`; os valores do `papel` estao no sidecar
`.impeccable/design.json`, sob `colorMeta`.

### Primary
- **Bandeirinha de Relogio** (`--vez`): o vermelho de bandeira caida. E TEXTO,
  nao so marca, e por isso foi clareado a partir do vermelho real de bandeira
  (que media 3,25 sobre o cartao) ate chegar a 4,84. Aparece na linha de vez, no
  rotulo "sua vez" e no nome do projeto que espera ha mais tempo.
- **Tinta de Anotacao** (`--acento`): o verde-claro com que se marca a folha
  impressa. E o que a interface usa para foco, aba ativa, selecao do navegador,
  cursor de texto e codigo real de item. Antes era o azul de "trabalhando", e por
  isso todo tema parecia azul.

### Secondary
- **Tinta do Boletim** (`--tinta`): a cor da regua. Nao e corpo de texto, entao
  o piso dela e 3:1. Desenha a regua dupla da linha de vez e o polegar da barra
  de rolagem, e e o que faz a tela parecer folha impressa em vez de janela.

### Tertiary
Os cinco estados. Sao semanticos, continuam distinguiveis entre si em qualquer
tema, e mudar o significado de um deles confundiria mais do que agradaria.
- **Azul de Turno** (`--working`): agente trabalhando agora.
- **Ambar de Espera** (`--waiting`): esperando voce, e a estrela de fixado.
- **Magenta de Vinho** (`--failed`): quebrou. Nasceu vermelho, exatamente o
  mesmo valor da bandeirinha, e foi movido para a familia magenta justamente por
  isso: enquanto os dois compartilhavam o hex, a Regra da Bandeirinha valia so
  como disciplina de uso, e a tela separava "a jogada e sua" de "quebrou" pelo
  lugar e pela palavra, nunca pela cor. Hoje a regra e cumprida pela propria
  paleta. Medido aqui: matiz 347,3 contra 27,5 da bandeirinha, cerca de 40 graus
  de separacao no circulo, com claridade parecida nos dois temas.
- **Verde de Pronto** (`--done`): concluido, barra de progresso, ponto cheio.
- **Cinza de Fila** (`--idle`): na fila. E o estado da maioria dos itens, e por
  isso foi a cor mais reescrita da paleta: no sol, na rua, era ela que sumia
  primeiro.

### Neutral
- **Chao de Casa Escura** (`--bg`): o fundo da pagina, a casa escura do
  tabuleiro.
- **Casa Clara** (`--surface`) e **Casa Clara Levantada** (`--surface-2`): o
  fundo de todo cartao, e o mesmo cartao sob o ponteiro.
- **Regua** (`--line`) e **Regua Fina** (`--line-soft`): divisao dentro do
  cartao e entre linhas.
- **Tinta Principal** (`--fg`): texto de leitura. Fica em torno de 9 a 11 de
  contraste, deliberadamente longe do 16,6 da versao anterior, que sangrava nas
  bordas e cansava a vista.
- **Tinta Secundaria** (`--dim`) e **Tinta Apagada** (`--faint`): apoio e
  metadado. Nenhuma das duas cai abaixo de 4,5.

### Named Rules

**A Regra da Bandeirinha.** `--vez` quer dizer uma coisa e so uma: a jogada e
sua. Se aparecer em algo que nao e isso, o sistema de cor perdeu o sentido. E
ela marca apenas a PRIMEIRA linha da lista, quem espera ha mais tempo. Marcar
todas transformaria a excecao em papel de parede. A regra tem dono unico de
verdade: nenhum outro token do arquivo carrega o vermelho dela.

**A Regra do Fundo Limpo.** Cor de estado e texto, barra de 3px, ou borda. Nunca
fundo. Fundo tingido de estado ja deixou o texto de dentro ilegivel duas vezes
neste projeto, uma no cartao de agente e outra na linha de federacao. Classe de
estado solta pinta o que nao devia: escope sempre (`.dot.s-working`, nunca
`.s-working`).

**A Regra do Par Medido.** Todo token de texto se mede contra `--bg` e contra
`--surface`, porque quase todo texto mora dentro de um cartao. Medir so contra o
fundo da pagina ja aprovou cores que reprovavam onde de fato apareciam. E nunca
se mede contra `--faint` virando fundo: `--fg` sobre `--faint` da 2,19:1.

## Typography

**Display / Label:** Archivo Narrow (com Segoe UI Variable Display, Segoe UI,
sans-serif). Grotesca condensada, auto-hospedada em `src/archivo-narrow.woff2` e
servida por `src/web.mjs` em `/archivo-narrow.woff2`, com `font-display: swap` e
`unicode-range` latino. Ela e hospedada de proposito: a face anterior so existia
no Windows, e em qualquer outra maquina o rotulo caia para uma sans comum e o
carater condensado sumia sem aviso. Face escolhida e o que separa mundo de tema,
e "a mais proxima que estiver instalada" e falha, nao alternativa.

**Body:** a pilha de sistema (`ui-sans-serif`, Segoe UI Variable Text). Vale no
texto corrido inteiro.

**Mono:** `ui-monospace` / Cascadia Mono / SF Mono / Consolas. Ficou so onde o
alinhamento de digito importa: numero, codigo de item, caminho de arquivo,
porta, idade.

**Character:** cabecalho de tabela impressa contra prosa de jornal. A condensada
carrega rotulo em caixa alta e espacamento aberto; a humanista carrega frase; a
de largura fixa carrega numero e codigo. Sao tres vozes com tres empregos, e
nunca se trocam de lugar.

### Hierarchy
- **Display** (700, 20px/1, `letter-spacing: .09em`, caixa alta): o nome do
  painel, no cabecalho fixo. Existe UM na pagina.
- **Headline** (700, 22px/1.15, `.02em`): o titulo dentro da gaveta lateral de
  detalhe do agente.
- **Title** (700, 13px/1, `.09em`, caixa alta): cabecalho de faixa e de coluna
  (`.f-head`, `.col-head`, grupo de aba).
- **Body** (400, 15px/1.6): a prosa. Bloco de texto longo limitado a 74ch.
- **Label** (700, 11px a 12px/1, `.07em` a `.18em`, caixa alta): aba, etiqueta de
  categoria, selo de estado, rotulo de secao, rotulo "sua vez". Aba de segundo
  nivel cai para 500/11px sem caixa alta, de proposito.
- **Mono** (600, 11px a 15px, `tabular-nums`): projeto, codigo de item, porta,
  idade, contagem.

### A escala real, contada no arquivo

Os papeis acima sao reais, mas a escala por tras deles nao e uma rampa
escolhida. Sao **223 declaracoes de `font-size` em 15 valores distintos**:
8,5 / 10 / 10,5 / 11 / 11,5 / 12 / 12,5 / 13 / 13,5 / 14 / 14,5 / 15 / 17 / 20 /
22 pixels.

Cinco deles carregam a tela quase inteira e sao o degrau que vale reusar:
**11px** (60 usos), **11,5px** (55), **12px** (47), **13px** (20) e **12,5px**
(10). Os outros dez somam poucas ocorrencias cada, e quatro aparecem uma unica
vez (8,5 / 13,5 / 14,5, mais 22px no titulo da gaveta). Meio pixel de diferenca
nao e hierarquia, e sobra: ninguem le 11px contra 11,5px como dois niveis.

Antes de inventar um tamanho novo, use um dos cinco. A lista completa esta
registrada aqui por honestidade com o build, nao como convite.

### Named Rules

**A Regra dos Dois Niveis.** Grupo e a decisao, aba e o detalhe. A diferenca sai
de tamanho, peso e espessura da regua, nunca de pilula ou de fundo: o grupo em
13px/700 com regua de 2px, a aba em 11px/500 com regua de 1px. Dezenove botoes
identicos deixam de ser navegacao.

**A Regra do Digito Que Nao Danca.** Todo numero que o stream reescreve a cada
2 segundos leva `font-variant-numeric: tabular-nums` e fonte de largura fixa.
Sem isso a contagem muda de largura a cada atualizacao e a linha inteira treme.
E a mesma razao pela qual boletim impresso alinha placar em coluna.

**A Regra da Palavra Inteira.** Nome de coisa nunca e cortado com reticencias.
Caminho comprido quebra no meio (`overflow-wrap: anywhere`), que e feio e
legivel; nome cortado e so ilegivel. Caixa alta e usada em rotulo curto e nunca
em frase, porque ela apaga a silhueta da palavra, que e a pista que o olho usa
para reconhecer sem soletrar.

## Layout

O painel e um container de consulta, nao uma pagina. `#painel` declara
`container-type: inline-size; container-name: painel`, e **todo breakpoint e
`@container`, nunca `@media`**. O motivo e medido: com a coluna de notas aberta,
ou com o painel encaixado numa lateral estreita do monitor, a janela continua
larga enquanto o painel encolhe. Uma media query nunca dispararia e a tabela
quebraria em vez de compactar.

Os cortes observados sao 1500, 1240, 1080, 900, 640, 620, 560 e 460 pixels de
container. O ramo estreito e o aparelho primario, nao um caso especial: 390px de
celular e a lateral do monitor tem a mesma largura efetiva.

O painel **nunca rola de lado**. Quem rola e o elemento largo, dentro de
`.rolagem`, que carrega `overscroll-behavior-x: contain` para o gesto de
arrastar no celular nao virar "voltar" no navegador.

Grades sao sempre `repeat(auto-fill, minmax(min(<piso>, 100%), 1fr))`, sem
breakpoint proprio: o navegador divide a largura pelo piso e resolve quantas
colunas cabem. O `min(..., 100%)` e obrigatorio, nao enfeite: com o piso puro,
qualquer container mais estreito faz a trilha estourar e a pagina rola de lado.
Os pisos em uso sao 270px (cartao de agente), 320px (cartao de item) e 360px
(lista de tarefas).

O ritmo de espacamento e denso e de granularidade fina, herdado do boletim: 4, 6,
9, 12, 18 e 26 pixels. O recuo do corpo e `4px 20px 60px`, e o cabecalho fixo
usa `14px 20px 0`.

### Named Rules

**A Regra do Container.** Nenhum breakpoint novo usa `@media`. Se a regra precisa
saber a largura, ela pergunta ao `#painel`, nao a janela.

**A Regra do Estreito Primeiro.** Toda direcao nova nasce pensada para 390px, e
o monitor largo herda dali. O caminho inverso ja produziu tela que so funciona
com a janela cheia.

**A Regra do Fio Ate a Borda.** Cabecalho de secao termina com um fio de 1px que
corre ate a borda direita (`.bl-fio`). Custa zero conteudo e e o que faz a tela
larga parecer terminada em vez de vazia. Sem ele, todo cabecalho morre no meio do
monitor com 1200px de nada depois.

## Elevation & Depth

O sistema e **plano**. Profundidade sai de superficie e de regua, nunca de
sombra: `--bg` para o chao, `--surface` para o cartao, `--surface-2` para o
cartao sob o ponteiro, e uma linha de 1px onde precisa separar. A folha do
boletim e plana, e cartao com sombra e o vocabulario de painel padrao que esta
direcao recusou por escrito.

O estado nao sobe o elemento, ele o marca na borda: uma barra de 3px na esquerda
(`.card::before`) ou uma borda inferior de 2px (`.ct`). Identifica sem competir
com o assunto, que e o que se quer ler.

Existe um token de sombra (`--sombra`, duas camadas suaves) e ele e a excecao
declarada, nao o padrao. A unica elevacao real do produto e a gaveta lateral, que
precisa flutuar sobre a pagina.

### Shadow Vocabulary
- **Gaveta** (`box-shadow: -24px 0 48px rgba(0,0,0,.5)`): so no painel lateral
  que desliza da direita. Sombra direcional forte, porque ele de fato esta acima
  da pagina.
- **Veu** (`background: rgba(0,0,0,.45)`): o escurecimento por tras da gaveta.
- **Sombra suave** (`--sombra`): disponivel para superficie que precise se
  separar sem desenhar mais uma linha. Usar com parcimonia.

### Named Rules

**A Regra da Folha Plana.** Superficie e regua separam; sombra so aparece quando
o elemento de fato flutua sobre a pagina (gaveta, dialogo). Cartao em repouso
nunca tem sombra.

## Shapes

A folha e quadrada e os cartoes curvam. A linha de vez, o polegar da barra de
rolagem e a regua nao tem raio nenhum, porque papel impresso nao tem canto
arredondado. O que curva e o que e objeto: o cartao de agente em 6px, o cartao de
item em 10px, o controle (botao, campo, etiqueta) em 3px, o selo de estado em
999px e a bolinha de estado em 50%.

**Essa e a intencao, e nao e o arquivo.** Contado no codigo: **133 declaracoes
de `border-radius` em doze valores de pixel distintos** (999, 4, 2, 8, 6, 3, 10,
7, 12, 9, 5, 1), mais `0`, `50%` e quatro formas compostas de canto por canto.
Os cinco degraus acima cobrem 62 dessas declaracoes; as outras 71 usam valores
que ninguem escolheu como sistema, incluindo pares de um pixel de diferenca
(4 contra 5, 6 contra 7, 8 contra 9) que nenhum olho separa.

A diferenca entre um raio de 4px e um de 5px nao existe para quem le a tela. Ela
existe para quem edita: cada valor novo vira mais um numero que o proximo
componente pode copiar por engano. Componente novo escolhe entre `0`, `3px`,
`6px`, `10px`, `999px` e `50%`. Nao acrescente um decimo terceiro valor.

O selo de estado e a unica pilula do sistema, e ela sobrevive porque a borda e o
fundo saem de `currentColor`: `border: 1px solid currentColor` mais
`background: color-mix(in srgb, currentColor 13%, transparent)`. Uma cor so
alimenta as tres propriedades, e por isso ele nunca sai da disciplina de cor.

Icones sao desenhados, nunca glifos: um mapa `ICONES` com o traco em grade de 24,
um ajudante `ico()` que emite SVG inline com `stroke-width: 1.6`,
`stroke: currentColor`, `fill: none` (exceto a estrela de favorito, que precisa
da forma cheia para se ler sem cor), `aria-hidden` e alinhamento
`vertical-align: -.18em`. Para pseudo-elemento que nao pode carregar um filho,
existe `--mask-estrela`, a mesma forma como mascara CSS.

As superficies que o navegador desenha sao tematizadas a partir da paleta:
`::selection` usa `--acento`, `accent-color` e `caret-color` idem, e a barra de
rolagem e fina, na cor da regua, com 3px de respiro em `--bg`. O padrao do
navegador nao pertence a design nenhum, e deixar o azul de sistema aqui denuncia
pagina montada em vez de construida.

### Named Rules

**A Regra da Grade de 24.** Todo icone novo entra em `ICONES` como traco em
`viewBox="0 0 24 24"`, com `stroke-width: 1.6` e `currentColor`. Sem excecao, e
sem biblioteca externa.

**A Regra da Folha Quadrada.** Raio zero e o padrao da estrutura (regua, linha,
barra de rolagem). Raio existe para objeto que se pega, nao para superficie que
se le.

**A Regra dos Seis Degraus.** Raio novo sai de `0`, `3px`, `6px`, `10px`,
`999px` ou `50%`. Se o componente parece pedir outro valor, ele esta pedindo
outro dos seis, nao um numero inedito.

## Components

### Linha de Vez (componente assinatura)

O primeiro viewport, produzido por `viewVez()`. E a leitura de relance que da
nome ao produto: quem esta esperando voce, ordenado por quem espera ha mais
tempo.

- **Moldura:** regua DUPLA, `border-top: 2px solid var(--tinta)` mais
  `border-bottom: 1px solid var(--tinta)`. No papel a separacao entre cabecalho e
  tabela nunca e um fio so. Feita com duas bordas do mesmo elemento porque duas
  bordas reais custariam um elemento a mais por linha.
- **Sem cartao, sem sombra, sem raio.** Largura maxima de 720px.
- **Cabeca:** rotulo "sua vez" em condensada 11px com `.18em` na cor da
  bandeirinha, a contagem em largura fixa 15px/700, e a direita, em tinta
  apagada, quantos rodam sem ele.
- **Linha:** um `<button>` em grade de quatro colunas
  (`14px minmax(0,auto) minmax(0,1fr) auto`): bandeira, projeto, assunto, idade.
  Separada da vizinha por `--line-soft`, e a primeira nao tem borda superior.
- **A bandeira so na primeira.** Marcar todas transformaria a excecao em papel
  de parede.
- **Hover** pinta o fundo com `--surface`; **foco** e contorno de 2px em
  `--acento` com deslocamento negativo, para nao vazar da linha.
- **Abaixo de 460px** a grade cai para tres colunas e o assunto desce para a
  linha de baixo, ocupando da coluna 2 ao fim. Tres colunas de texto em 390px
  espremem o nome do projeto ate ele deixar de ser reconhecivel, e o nome e o que
  ele procura.
- **Estado calmo:** quando nada espera, nao ha faixa nem numero zero. Vira uma
  linha corrida de quem esta rodando, com o rotulo em `--dim` no lugar do
  vermelho.

### Cartoes

**Cartao de agente** (`.card`): a unidade da tela de agentes.
- **Forma:** raio 6px, borda de 1px em `--line`, fundo `--surface`, recuo
  `9px 11px 8px 13px` (o recuo esquerdo maior abre espaco para a barra).
- **Estado:** barra de 3px colada na esquerda, via `::before`, arredondada so
  do lado de fora.
- **Fixado:** selo de estrela em `::after`, desenhado por `--mask-estrela` em
  `--waiting`, 11px, no canto superior direito.
- **Cabeca e pe proprios:** o cartao usa `<header>` e `<footer>` internos, e por
  isso as regras globais dessas tags sao escopadas em `#painel > header`.
- **Acoes** aparecem so no hover ou no foco interno. Tres botoes visiveis em
  cada cartao viram ruido.

**Cartao de item** (`.ct`): a unidade do backlog e do sprint.
- **Forma:** raio 10px, borda de 1px, e uma **borda inferior de 2px** que
  carrega a cor do estado. `overflow: hidden`, para o detalhe interno respeitar o
  canto.
- **Altura minima de 106px** no corpo, com o rodape preso na base por
  `margin-top: auto`. E isso que da uma unica linha de base a fileira inteira;
  sem isso a grade fica com a base serrilhada.
- **Hover** usa `--line-soft` como fundo, e so o corpo que de fato reage ganha
  `cursor: pointer`. Cartao morto com cursor de clique e promessa que a tela nao
  cumpre.

### Botoes
- **Forma:** raio 3px (controle), borda de 1px em `--line`, fundo `--surface`,
  recuo `4px 10px`, fonte de largura fixa 11px.
- **Repouso** em `--dim`; **hover** leva o texto para `--fg` e a borda para
  `--faint`. Nao ha mudanca de fundo no hover do botao comum.
- **Primario:** borda e texto em `--acento`, sem fundo cheio.
- **Perigo:** borda e texto em `--failed`; so no hover ele ganha fundo, via
  `color-mix` a 16% sobre a superficie.
- **Desabilitado:** opacidade .4 e `cursor: not-allowed`.
- **Alvo de toque:** no ramo estreito o botao ganha `min-height: 30px` (26px na
  variante mini), a pilula da gaveta usa 34px, e o atalho que ele aperta na rua
  vai a 44px. Ponteiro e dedo tem pisos diferentes, e o CSS reconhece isso.

### Campos
- **Estilo:** fundo `--surface`, borda de 1px em `--line`, raio 3px, recuo
  `5px 9px`, fonte de largura fixa 12px, largura minima de 170px que colapsa para
  `flex: 1 1 110px` no estreito.
- **Placeholder** em `--faint`.
- **Foco:** contorno global de 2px em `--acento` com 2px de deslocamento. Dentro
  de cartao e de linha o deslocamento e negativo, para o contorno nao vazar.
- **Marcacao:** `accent-color` e `--done` na caixa de to-do (o significado e
  "concluido") e `--acento` no restante.

### Navegacao
- **Duas fileiras.** Grupo em cima, 13px/700 em condensada com caixa alta e
  regua ativa de 2px. Aba embaixo, 11px/500 sem caixa alta e regua de 1px. O
  grupo e a decisao grande, a aba e o detalhe.
- **Estado:** repouso em `--faint`, hover em `--dim`, ativo em `--fg` com a
  borda inferior em `--acento`. Contagem ao lado em largura fixa, sempre em
  `--faint`.
- **Estreito:** a fileira de grupos some, as abas viram uma fita que rola de
  lado com a barra de rolagem escondida, e existe uma barra inferior de
  aplicativo.
- **A gaveta de ajustes** cobre a tela (`position: fixed; inset: 0`) com veu de
  `color-mix` a 78% e `backdrop-filter: blur(3px)`, porque enquanto esta aberta
  ela e o que ele esta fazendo, nao um painel de leitura.

### Estados vazios
Secao sem conteudo vira **uma linha discreta** (`.gr-zero`, 12px em `--faint`),
nunca um titulo mais uma caixa vazia. A tela vazia de aba inteira (`.empty`)
centraliza um texto em `--faint` com 60px de respiro e, quando cabe, um botao.

### Aviso (toast)
Substitui o `alert()` nativo, que era a unica janela do produto sem tema, sem tom
e sem cor. Mora no rodape, na zona do polegar no celular, nao bloqueia a tela,
some sozinho em 6 segundos e carrega cor de erro ou de aviso comum. Fica dentro
do `#painel`, porque e ele quem declara o `@container`.

### Named Rules

**A Regra do Redesenho.** O stream troca o painel inteiro a cada 2 segundos.
Nenhum elemento com estado proprio pode morar dentro de bloco redesenhado por
timer: `<textarea>` perde o cursor, `<select>` aberto perde o menu nativo do
sistema operacional (que nem aparece no DOM), e campo em edicao perde o indice.
Notas moram num `<aside>` irmao, o editor mora num `<dialog>` fora do `#main`, e
o redesenho da navegacao para enquanto o `<select>` tem foco.

**A Regra da Tag Escopada.** Regra global sobre tag semantica sempre escopada
pelo pai, mesmo quando so existe um elemento daquele tipo hoje. Ja colidiu tres
vezes: `<header>` e `<footer>` pintaram faixa cinza dentro do cartao de agente, e
`<h1>` cortou a ultima letra do titulo no leitor de documentos.

## Do's and Don'ts

### Do:
- **Do** usar `@container` para todo breakpoint novo, com `#painel` como
  referencia.
- **Do** medir todo token de texto contra `--bg` e contra `--surface`, nos dois
  temas, com piso de 4,5:1 para texto e 3:1 para regua.
- **Do** desenhar icone novo em `ICONES`, grade de 24, `stroke-width: 1.6`,
  `currentColor`.
- **Do** dar `tabular-nums` e fonte de largura fixa a todo numero que o stream
  reescreve.
- **Do** separar por superficie e por regua; deixar sombra so para o que de fato
  flutua.
- **Do** escopar classe de estado no elemento que de fato deve receber a cor
  (`.dot.s-working`, `.ct-selo.c-working`).
- **Do** usar `minmax(min(<piso>, 100%), 1fr)` em toda grade, com o `min()`
  presente.
- **Do** projetar para 390px primeiro e deixar o monitor herdar.
- **Do** escolher raio entre `0`, `3px`, `6px`, `10px`, `999px` e `50%`, e
  tamanho de fonte entre 11, 11,5, 12, 12,5 e 13 pixels. Sao os degraus que a
  tela ja usa em volume.

### Don't:
- **Don't** usar `@media` para largura de layout. A janela larga mente sobre o
  painel estreito.
- **Don't** pintar fundo com cor de estado. Estado e texto, barra de 3px ou
  borda.
- **Don't** usar `--vez` em nada que nao seja "a jogada e sua", e nao marcar mais
  de uma linha com a bandeira.
- **Don't** por sombra em cartao em repouso, nem raio na regua, na linha de vez
  ou na barra de rolagem.
- **Don't** usar glifo Unicode como icone. A grade de 24 ja existe, e o glifo
  muda de forma e de peso conforme a fonte de sistema do aparelho.
- **Don't** depender de face de fonte instalada no sistema para o carater da
  interface. Rotulo condensado usa a face hospedada com o projeto.
- **Don't** por `<textarea>`, `<select>` ou campo em edicao dentro de bloco
  redesenhado pelo stream.
- **Don't** escrever regra global sobre tag semantica sem escopar pelo pai.
- **Don't** cortar nome de coisa com reticencias. Quebre no meio.
- **Don't** acrescentar um raio ou um tamanho de fonte inedito. Doze raios e
  quinze tamanhos ja e mais do que a tela consegue significar.
- **Don't** deixar superficie do navegador (selecao, cursor, barra de rolagem)
  com o padrao do sistema.

<!-- ============================================================
     Divergencias conhecidas entre o contrato de direcao e o build.
     Registradas de proposito: o build e a verdade, e esconder a
     diferenca faria o proximo agente defender o plano contra o codigo.

     1. CROSS-TABLE. O contrato prometeu uma tabela cruzada, uma linha
        por projeto. O build entrega isso apenas na linha de vez
        (`.vez`, uma linha por agente que espera). O backlog e o sprint
        renderizam GRADES de cartoes de item por projeto (`.bl-grade`
        mais `.ct`), nao linhas de tabela. A revisao de acabamento
        classificou como "adaptacao, sem citacao": defensavel com 77
        itens, e nao justificada por nenhuma verdade de produto
        registrada. Nao foi canonizado como regra do sistema.

     2. ESCALA ESPALHADA (raio e tamanho de fonte). Com o DESIGN.md
        no lugar, o detector mecanico rodou pela primeira vez e
        devolveu 91 avisos: 62 de raio, 25 de tamanho de fonte e 4 de
        cor. Contado no arquivo: 133 declaracoes de `border-radius`
        em DOZE valores de pixel distintos (999, 4, 2, 8, 6, 3, 10,
        7, 12, 9, 5, 1), mais `0`, `50%` e quatro formas compostas; e
        223 declaracoes de `font-size` em QUINZE valores distintos,
        de 8,5 a 22 pixels.

        Isto e deriva herdada de antes desta reforma, nao escolha de
        ninguem: o mundo esta comprometido com superficie plana de
        boletim, e doze raios nao expressam doze intencoes. Nem 4px
        contra 5px, nem 11px contra 11,5px, sao lidos como dois
        niveis por ninguem.

        As secoes Shapes e Typography registram a lista inteira, e
        marcam os degraus que de fato carregam a tela (seis raios,
        cinco tamanhos). A convergencia e trabalho de backlog, e NAO
        foi feita nesta passagem, de proposito: sao 71 declaracoes de
        raio fora dos degraus, mais os tamanhos de fonte avulsos.

     3. GLIFOS RESIDUAIS. Sobram glifos Unicode em prosa e num mapa
        de estado (`SIMBOLO_TAREFA`: ✅ 🏗️ 🔒 ⏳), mais setas e
        cruzes de interface (▸ ▾ ✕ ✓ ● ○ ▲). Todos hoje sentam ao
        lado de uma palavra; nenhum funciona sozinho como icone. O
        ultimo que funcionava era o selo de fixado (`content: '★'`),
        e ele virou `--mask-estrela`, a mesma estrela da grade de 24
        como mascara CSS. A regra escrita acima ("Don't usar glifo
        Unicode como icone") esta cumprida no que importa; o que
        resta e cosmetico e de risco baixo.

     4. MEDIDOR SEMANA. O medidor de uso `SEMANA` corta na borda
        direita em 390px. E anterior a esta direcao, nao foi
        introduzido por ela, e continua aberto.

     RESOLVIDAS DEPOIS DA PRIMEIRA GRAVACAO deste arquivo, mantidas
     aqui so para quem voltar procurando por elas:

     - `--vez` e `--failed` compartilhavam o mesmo hex, e a Regra da
       Bandeirinha valia so por disciplina de uso. `--failed` saiu da
       familia vermelha para o magenta-vinho (`#d488b0` no noite,
       `#8e2f63` no papel), e hoje a regra e cumprida pela cor.
     - `--raio: 8px` era declarado com zero usos. Foi apagado do
       `:root`, e nada referencia `var(--raio)` no arquivo.
     ============================================================ -->
