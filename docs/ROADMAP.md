---
tags: [processo]
tipo: roadmap
atualizado: 2026-08-14
estado: 13 frentes vivas depois da poda de 14/08
resumo: Só o que está aberto neste projeto. Concluído sai daqui e vira linha no diário, congelado vai pro GELO. Em 14/08 tinha 45 frentes e foi podado para 13.
termos:
  frente: um bloco de trabalho com nome próprio, que o painel mostra como pastilha no cartão
  CC-nn: um item numerado. O número não indica ordem nem prioridade, só a ordem em que nasceu
---

# ROADMAP

Só o que está **aberto**. Concluído sai daqui e vira linha no diário.

> **Vai executar alguma destas tasks?** Os planos estão em [[PLANOS]], um
> arquivo por task em `docs/planos/`. Eles dizem onde mexer, o que reusar e
> quais das armadilhas do `CLAUDE.md` se aplicam. Escritos em 13/08 por uma
> sessão Opus, justamente para as sessões de execução não precisarem redescobrir
> isso.

## Aberto

## ▶ A ORDEM DE EXECUÇÃO, definida em 15/08

Ele pediu: *"pegar tudo o que a gente discutiu, melhorar o backlog e começar a
trabalhar o mais rápido possível"*. São **25 frentes abertas** — a lista abaixo
é a ordem, e o critério é um só: **o que destrava mais coisa, primeiro.**

| # | Item | Por que agora | Depende de |
|---|---|---|---|
| 1 | **CC-84** agentes se falando | Ele põe dois agentes no mesmo projeto **amanhã, 16/08** | nada |
| 2 | **CC-86** mapa de dependência | 30 linhas, 127ms, e melhora o CC-84 de "seu arquivo" para "o que quebra junto" | nada |
| 3 | **CC-67** `cc hooks install` | Está travando ele AGORA: dois hooks esperando registro à mão no PC | nada |
| 4 | **CC-81** resto | Clique ancorado, o defeito que ele viu com os próprios olhos | nada |
| 5 | **CC-85** log das conversas | Nasce do CC-84; sem ele não há o que registrar | CC-84 |
| 6 | **CC-78** rotas na tela | Precisa da decisão dele: o que é o azul? | decisão |
| 7 | **CC-83** três backlogs | A coluna do meio vem das rotas | CC-78 |
| 8 | **CC-76/77** prévias e cara de aplicativo | Ele quer ver antes; e o painel precisa reiniciar para mostrar o que já mudou | restart |

**✅ A fila foi executada inteira em 15/08, menos o item 8**, que depende de ele
reiniciar o painel e olhar. Junto saíram CC-69, CC-70 e CC-72, que estavam fora
da fila e eram baratos.

**O que sobrou, e por que cada um está parado:**

| Item | Espera o quê |
|---|---|
| CC-76 / CC-77 | ele reiniciar o painel e dizer quais abas doem mais |
| CC-68 catálogo de métodos | decisão de produto: qual é o terceiro método, e para quê |
| CC-71 agir só no que mudou | a Bancada virar gate — sem ela não há o que otimizar |
| CC-79 rotas × Pixel Agents | o CC-60: há dois Pixel Agents nesta VPS e um é de outro usuário |
| CC-80 visão estrutural, CC-82 leitor | ele pediu para **estudar**, não para fazer |
| CC-08 macOS | um Mac |
| CC-60 o outro Pixel Agents | decisão dele: mostrar no cockpit ou desligar |


**Fora da fila, e por quê:** CC-08 (precisa de um Mac), CC-60 e CC-79 (decisão
dele sobre o segundo Pixel Agents), CC-68 a CC-72 (valem, e nenhum é urgente),
CC-80 e CC-82 (ele pediu para estudar, não para fazer).

**Uma decisão de método, tirada da conversa de hoje:** ele quis achar uma forma
de organizar tudo para facilitar o acesso, e desistiu por bom motivo —
**organização feita à mão é mais um lugar que envelhece.** A saída que ficou:
não organizar, **derivar**. Foi o que fez o peso das pastilhas (CC-81), a sprint
(CC-83), a presença (CC-49) e agora o mapa de dependência (CC-86). Vale como
regra para o que vier: se dá para calcular, não peça para alguém manter.

### CC-86 ✅ 15/08 — o mapa de dependência, extraído e nunca escrito

Nasceu da discussão de UML/MER: ele apontou, com razão, que o glossário com
relações não cobre **dependência de código** — "se o outro agente vai mexer numa
classe que a minha tarefa usa". Isso está no diagrama de classes.

**Concordo com o valor, discordo do meio.** Diagrama mantido à mão diverge do
código em dias, e aí fica pior que não existir: responde errado com cara de
certo. Mas o dado é extraível, e sai sempre atualizado.

**Medido em 15/08, neste projeto:** 52 arquivos, 90 ligações, **127 ms**, lendo
só 4 KB do topo de cada um — `import` mora no topo, ler o resto é desperdício.
A esse custo não precisa nem de cache.

E a medição já entregou um número que ninguém sabia: **`platform.mjs` tem 15
dependentes, o maior do projeto.** É o arquivo mais perigoso de tocar, e isso
não estava escrito em lugar nenhum.

**O que isto muda no CC-84:** em vez de "vou mexer no seu arquivo", o aviso
passa a ser *"vou mexer num arquivo que 15 outros usam, dois deles abertos por
você"*. É a pergunta que ele quer respondida: **o que quebra se eu mexer aqui?**

⚠️ **O que a extração NÃO pega:** herança e hierarquia de classes. Nos projetos
JavaScript dele quase não há classes, mas se algum for orientado a objetos de
verdade, aí o diagrama tem valor que a extração não tem. Fica registrado, não
resolvido.

#### ✅ Feito: `src/dependencias.mjs` + `cc deps`

Números do projeto inteiro: **73 arquivos, 115 ligações, 23 ms.** O topo:
`platform.mjs` com 16 dependentes, `config.mjs` com 12, `jobs.mjs` com 10.

**O transitivo é o que responde a pergunta de verdade.** Mexer em `platform.mjs`
alcança 32 arquivos, quase metade do projeto — olhando um nível só, seriam 16.

```
cc deps                 os mais perigosos de tocar
cc deps src/x.mjs       quem quebra, direto e por tabela
```

**Ligado ao CC-84:** `recados.mjs enviar … --arquivo x` calcula o impacto e manda
junto. O outro agente recebe *"vou mexer num arquivo que 16 outros usam"* em vez
de *"vou mexer no seu arquivo"*, e julga sem abrir nada. O cálculo roda no envio,
que é raro — **nunca no hook**, que roda em toda chamada de ferramenta.

Dois defeitos que o gate pegou, os dois reais:

- **`import './x'` sem `from`** (efeito colateral, usado para CSS e polyfill) não
  casava no regex. O teste do ciclo denunciou: dois arquivos que se importavam
  assim apareciam como se ninguém usasse ninguém.
- **Ciclo de import existe**, e sem conjunto de visitados a busca em largura não
  termina.


> **Poda de 14/08.** Este arquivo tinha 45 frentes e 993 linhas, quase metade
> delas descrevendo coisa já concluída. Ficaram 13 frentes vivas. O concluído
> foi para [[diario/2026-08-14]], o congelado e o descartado para [[GELO]]
> (nada apagado), e as lições viraram armadilha no `CLAUDE.md`, que é onde
> lição serve para alguma coisa. A regra que isto restaura já existia escrita
> na linha 3 deste arquivo e não estava sendo seguida.

### Frente: a tela fala a língua dele, aprovada em 15/08

Pedido dele, ditado por voz: *"tem uma tela chamada VPS que tem um monte de
processo jogado, e eu tenho que ter muito conhecimento técnico pra olhar aquilo
ali e entender o que significa"*. E o motivo, que é maior que a estética: **ele
volta em três meses e não lembra o que é cada coisa.**

**A ideia dele era "?" em todo lugar. Discordei de um ponto e ele topou:** se
tudo tem interrogação, nada tem destaque, e entender uma tela passa a exigir
quarenta cliques. A explicação não é enfeite pendurado no dado, é **o dado
escrito direito**:

```
hoje:   processos: 47                    ⓘ
seria:  47 programas rodando, nenhum é seu
```

O "?" fica, mas só onde a tradução não cabe — hoje, uma por seção.

#### As três regras

1. **Toda tela responde uma pergunta dele, escrita no topo.** Se não dá para
   escrever a pergunta, a tela não deveria existir. "VPS" não é pergunta; "A VPS
   está saudável?" é.
2. **O texto usa as palavras dele, não as da máquina.** Nome de ferramenta
   (`nginx`, `pm2`) só diz algo a quem já sabe o que ela faz. O nome técnico
   fica ao lado, pequeno: quem conhece reconhece, quem não conhece não precisa.
3. **Todo estado tem veredito, não só valor.** `47 processos` não é veredito;
   `tudo no ar` é. E todo alerta diz **o que fazer** — alerta sem saída é o
   ruído que originou tudo isto.

**Quarta regra**, acrescentada por ele: **celular primeiro**, que é onde ele usa.
O breakpoint é `@container`, nunca `@media` (armadilha já registrada).

**Quinta regra, e é a que dá critério às outras: informação em árvore.** Palavras
dele: *"juntar várias informações num local só, e essa informação poder
destrinchar (…) todas elas simples com mais opções"*. Cada nível responde
sozinho; o de baixo só aparece se você pedir.

A aba VPS é o exemplo: **veredito → alerta → dado cru**. E é daqui que sai o
critério do "?": **se o nível de cima já responde, a interrogação é ruído.** Foi
por isso que ele ficou um por seção, e não um por dado.

Vale além da tela, e as três aplicações já existem: o guia em etapas que ele
pediu na sessão de senhas, o gate de MVP que para no primeiro critério que não
fecha, e o cabeçalho do CC-74, onde quatro controles entraram atrás de um `⋯`.

#### ✅ Primeira fatia: a aba VPS, 15/08

Feita inteira no padrão, e escolhida por ser a pior e a que ele citou. Se a
regra não funcionasse ali, se jogaria fora uma tela em vez de quinze.

O veredito mora em `src/vpsSaude.mjs`, **fora da página**: os limiares (disco em
85%, memória em 90%, 5 reinícios) são regra de negócio e o `npm test` prova cada
um. Calcular em JS de navegador daria duas verdades para "a VPS está bem?".

**A tela nova achou um problema real no primeiro uso**, e é a melhor defesa da
mudança: o `inovallbond` está no PM2 com **6 reinícios**. Na tela antiga isso era
um número no canto de um cartão; agora é uma linha que diz *"aparece como no ar,
mas está caindo e voltando. O log dele diz por quê"*. Ninguém tinha notado.

#### Segunda rodada, 15/08: os prints dele em tela estreita

Ele mandou três prints usando o painel **encaixado na lateral do monitor**, que
é como ele usa no PC, e é a mesma largura do celular. Palavras dele: *"você vê
nitidamente como o design está ruim, não dá pra ver nada, os nomes, as coisas
estão desalinhadas"* e *"tem que ter mais cara de aplicativo"*.

**A ordem que ele deu:** primeiro terminar o que já está em andamento (as três
regras acima, telas traduzidas), **depois** o modo aplicativo. E o alvo é o
estreito: *"no computador pode ficar do jeito que está"*.

##### ✅ O aviso espalhado por 300px — consertado em 15/08

`display:grid` transforma **cada pedaço de texto solto em um item da grade**. O
aviso "X está parado — clique em **ligar** acima" tinha texto, `<b>`, texto:
virou três itens empilhados, distribuídos numa caixa de 420px de altura. Estava
assim desde sempre e só apareceu quando ele estreitou a janela.

Armadilha a não repetir: **texto com elemento no meio, dentro de `display:grid`,
precisa de UM elemento que o envolva.** Hoje é o único caso no arquivo, e foi
conferido por varredura.

### CC-73 ✅ 15/08 — o painel vazava de lado

A barra de rolagem horizontal aparece no rodapé do print, e a tabela da aba
tempo sai cortada. `#painel` tem `overflow-y` e não tem `overflow-x`, então
conteúdo largo empurra a página inteira.

A causa concreta na aba tempo: `.t-linha` usa colunas de largura fixa que somam
mais que a janela estreita (`1fr 74px 52px 62px 66px 78px 62px 80px 86px`).

**Feito.** Três peças: `#painel` ganhou `overflow-x: hidden`, nasceu `.rolagem`
para conteúdo largo rolar dentro de si mesmo, e a faixa de módulos (cpu, ram,
player) desce para uma linha própria abaixo de 640px — ela era `flex: none`, não
encolhia, e empurrava a página inteira.

A regra que fica: **o painel nunca rola de lado. Quem rola é o elemento largo,
dentro dele mesmo.**

O gate guarda a regra, não o pixel: sem navegador aqui (o Chrome desta VPS exige
token que o hook de segredo não deixa ler, corretamente), o teste confere que as
três peças continuam no arquivo. Sem isso, a barra volta e só apareceria num
print meses depois — foi assim que ela viveu até hoje.

**O teste achou um defeito de brinde:** a grade do escritório usava
`@media (max-width: 900px)`. Com a coluna de notas aberta, a janela continua
larga enquanto o painel encolhe, então ela nunca disparava. Virou `@container`,
e o gate agora recusa qualquer media query de largura neste arquivo.

### CC-74 ✅ 15/08 (parcial) — o cabeçalho comia metade da tela

Em janela estreita, antes de qualquer conteúdo: título, cinco contadores (quatro
deles zero), a linha de tokens, duas barras de uso, cinco controles, um botão
solto e duas fileiras de abas. Sobra menos da metade da altura para o que
importa.

**Feito, duas das três:**

- **Contador zerado não ocupa espaço.** No print eram seis, quatro deles zero.
  Zero ali não é informação, é a ausência dela. `prontos` fica mesmo em zero,
  porque "0 prontos" é resposta legítima a "o que terminou?" e sem ele a linha
  sumiria num dia parado.
- **Quatro dos seis controles entraram atrás de um `⋯`**, só em tela estreita.
  Filtro e projeto ficam, que são de uso constante. É o princípio da árvore
  (CC-75) aplicado ao cabeçalho. O estado não é guardado de propósito: reabrir
  a página com o cabeçalho expandido devolveria o problema.

**Falta a terceira**, e ela é maior: as duas fileiras de abas viram navegação de
aplicativo. Entra no CC-77, depois das prévias.

### CC-75 ✅ 15/08 — informação em árvore virou a quinta regra

Palavras dele, no meio desta conversa:

> "juntar várias informações num local só, e essa informação poder destrinchar,
> e fazer várias árvores, e todas elas simples com mais opções. Mesmo que tiver
> que ser complexo, que seja complexo dividido em pequenas etapas"

É a generalização do que a aba VPS virou: **veredito → alerta → dado cru**, cada
nível simples, o de baixo só se você pedir. Vira a quinta regra da frente, e é
a que dá o critério para quando o "?" é necessário: se o nível de cima já
responde, o "?" é ruído.

Vale para tudo, não só para tela: é o mesmo formato do guia em etapas que ele
pediu na sessão de senhas, e o mesmo do gate de MVP, que para no primeiro
critério que não fecha em vez de despejar a lista.

### CC-76 ✅ 16/08 — as 15 abas auditadas, e as prévias resolvidas

Pedido dele: *"me mande aí também uma prévia de cada página"*. O caminho já foi
provado hoje com a aba VPS — arquivo HTML com o CSS de verdade e os dados reais,
que ele abre no celular. **Não dá para tirar print daqui**: o Chrome desta VPS
exige um token que mora numa pasta de root, e o hook de segredo bloqueia a
leitura, corretamente.

São 15 abas, e aqui está o problema: **remontar cada uma à mão daria
aproximação, não a tela.** As views são JavaScript que roda no navegador; o que
eu monto por fora é a mesma folha de estilo com dados de exemplo. Serviu para a
VPS e para o cabeçalho, que são simples. Para as 15, o custo é alto e a fidelidade
cai.

**Resolvido de dois jeitos em 16/08:** o `cc previa` (CC-94) padronizou a prévia
em arquivo, e descobriu-se que **dá para reiniciar o painel sem root** — o que
faz do painel de produção a prévia de verdade, a qualquer momento.

**O que dá para adiantar sem navegador, e foi feito:** a auditoria das 15 contra
a regra 1, que é a que decide todo o resto. Cada aba tem que responder uma
pergunta escrita no topo. Hoje só a VPS responde.

| Aba | A pergunta que ela deveria responder | Estado |
|---|---|---|
| VPS | A VPS está saudável? | ✅ feito em 15/08 |
| meu | O que depende de mim? | já é isso, falta escrever a pergunta |
| glossário | O que é isso mesmo? | já é isso, falta escrever a pergunta |
| cockpit | Onde eu mexo agora? | ordena por urgência; falta o veredito no topo |
| agentes | Quem está trabalhando agora? | lista sem veredito |
| to-dos | O que falta fechar? | lista sem veredito |
| tempo | Quanto tempo isso levou, e quanto vale? | tabela larga, 9 colunas |
| gráficos | Como esses números se cruzam? | construtor, sem pergunta |
| preço | Quanto cobrar por isso? | lista sem veredito |
| agenda | O que eu tenho hoje? | lista sem veredito |
| hooks | O que está me travando? | lista técnica, nome de arquivo |
| rotinas | Alguma rotina está velha? | tem veredito parcial, é a mais perto |
| servidores | O que está no ar nesta máquina? | lista sem veredito |
| escritório | O que os agentes estão fazendo? | mostra movimento, não conclusão |
| remoto | Onde eu quero abrir uma sessão? | lista sem veredito |

**Onze das quinze não respondem nada.** A ordem sugerida para atacar é a dor
dele, não a lista: `tempo` (a que vaza e ele mais olha), `hooks` (a mais
técnica), `agentes` e `cockpit` (as que abre primeiro).

Três (`meu`, `glossário`, `cockpit`) já fazem a coisa certa e só precisam da
frase no topo — são as mais baratas e provavelmente as primeiras.

### CC-77 ✅ 16/08 — cara de aplicativo no estreito

O guarda-chuva dos três acima, e o que ele pediu por último. **Só vale para a
largura estreita**; no monitor largo, a decisão dele é deixar como está.

O que "cara de aplicativo" quer dizer, tirado do que ele reclamou: alinhamento
(hoje os nomes dançam), navegação de um nível em vez de duas fileiras de abas,
e o dado aparente sem precisar rolar de lado.

**Depende do CC-76:** ele quer ver antes de eu mexer.

#### Feito em 16/08

**A navegação virou um nível.** No estreito as duas fileiras somem e entra um
`<select>` nativo com as 15 abas agrupadas: abre o seletor do próprio telefone,
alcança qualquer tela num toque e não rola de lado. No largo continua como
estava, que foi a decisão dele. As duas versões existem no HTML e só trocam por
`@container` — sem listener de resize e sem uma segunda conta de "qual aba está
no palco", a armadilha que já custou um iframe recarregando.

**O alinhamento tinha uma causa, e não era gosto.** `.grupo` estava definida
duas vezes no CSS: botão do menu na linha 234, cartão de agente na 560. A
segunda vencia por ordem, então os botões do menu herdavam caixa, borda e a
barrinha cinza do `::before`. Escopadas em `.tab-grupos >` e `.lista >`.

**Quatro telas vazavam de lado em 390px, com o CC-73 já dado por fechado.**
`preco`, `rotinas`, `projetos` e `glossario` estouravam por grade de coluna fixa
e `nowrap` em pastilha. Agora `node test-estreito.mjs` mede as 15 telas com o
navegador e nomeia o elemento culpado: **15 de 15 cabem**.

#### O que falta

A regra 2 tem um teste objetivo esperando: cruzar o texto da tela
com o glossário do CC-63 e contar quantos termos técnicos sobraram. Isso vira
número, e número ele acompanha.

### Frente: o projeto visto por rotas, para estudar

Ideias dele em 15/08, ditadas por voz, **para estudo — nada decidido**. O eixo,
nas palavras dele: *"ter uma visão do projeto mais estrutural, voltada pra uma
forma que funciona melhor com o meu tipo de raciocínio visual"*.

Metade do dado já existe e é a razão de isto ser barato: `presenca.mjs` (CC-49)
lê o quadro e classifica cada rota em ativa / órfã / desconhecida, e
`rotasDeTodos()` (CC-48) junta as rotas das duas máquinas por projeto. Hoje isso
só sai por comando de terminal.

### CC-81 ✅ 15/08 (primeira fatia) — o mapa guarda as suas palavras

Olhando o mapa do cockpit no celular, ele disse três coisas. As três estão
atendidas em parte, e a terceira é a mais valiosa:

> "teria que dar pra clicar nelas, e ver o que que é cada uma"

Toda pastilha virou botão. O clique mostra o que o item é, sem abrir tela nova —
é o nível de baixo da árvore (CC-75), não navegação.

> "uma forma mais fácil de identificar a importância de cada uma, porque está
> tudo empilhado como se fosse só pequenas tarefas, e não é bem isso"

Agora há peso de 1 a 3, e ele é **derivado, nunca digitado**: frente inteira
pesa mais que item solto, item com quatro ou mais filhos pesa mais, item que
traz as palavras dele pesa mais, e o que já está feito pesa menos porque não
pede mais decisão. Nos 32 itens de hoje: 21 leves, 7 médios, 4 pesados.

> "cada uma delas pode conter o trecho da conversa onde eu te pedi, pra eu
> lembrar exatamente o que eu quis dizer (…) ali eu posso identificar se você
> entendeu o que eu falei de fato"

**Esta é a ideia forte, e faz duas coisas numa.** Ele relembra o que quis dizer,
e confere se a minha tradução bate com o pedido — que é a forma mais barata de
pegar um mal-entendido antes de virar código. É o mesmo problema que a regra 2
do ciclo já descrevia ("na segunda repetição, desambigue a palavra"), só que
resolvido antes da repetição.

**A convenção já existia sem nome:** 7 dos 32 itens já traziam citação, ora como
bloco `>`, ora em itálico entre aspas. `citacaoDe()` lê as duas formas, então
nada precisou ser reescrito. Pastilha com citação ganha um `”`; pastilha sem
citação diz, ao ser clicada, que **foi escrita por mim** — que é a informação
honesta ali.

#### O que falta

- **Escrever a citação nos 25 itens que não têm.** Não dá para inventar: ou a
  frase dele existe na conversa, ou o item nasceu de mim mesmo, e dizer isso é
  melhor que forjar.
- **Deixar ele corrigir a citação pela tela.** Ele pediu: *"óbvio que você pode
  consertar a pontuação, palavras, botar o significado real"*. Hoje só se edita
  o markdown.
- **O clique tem que abrir POR CIMA, ancorado na pastilha.** Feedback dele
  vendo a prévia: *"se eu clicar no primeiro eu tenho que descer pra ver, o
  ideal seria clicar no primeiro e já ver automaticamente"*. Na prévia o texto
  saía embaixo; no código é aviso do navegador, que aparece por cima mas é feio.
  Os dois estão errados pelo mesmo motivo: a resposta tem que nascer ao lado da
  pergunta.
- **Agrupar as pastilhas por nível de backlog** — CC-83.
- O layout do mapa continua ruim em tela estreita — isso é CC-77.

### CC-83 ✅ 15/08 — três backlogs em níveis, no mapa

Ideia dele em 15/08, e ela resolve uma confusão que ele mesmo tinha acabado de
apontar (*"parece meio com o TO-DO também né?"*):

> "na metodologia ágil, no Scrum, a gente tem o conceito de backlog em várias
> partes diferentes: tem o backlog do produto, o backlog do sprint, o backlog
> do dia (…) fica muito fácil pra eu entender, já que eu estudei muito
> engenharia de software"

**A tela de frentes e a aba de to-dos não são duas telas concorrendo: são dois
níveis do mesmo funil**, e faltava o nome que os separasse.

| Nível | O que é aqui | Tempo de vida | Quem escreve |
|---|---|---|---|
| Produto | as frentes do `ROADMAP.md` | semanas | ele |
| Sprint | **não existe hoje** | dias | — |
| Dia | os to-dos do `meta.json` | horas | o agente |

#### O nível do meio tem que ser DERIVADO, nunca digitado

É a decisão central deste item. Uma terceira lista que alguém precise manter vai
envelhecer como todo artefato que depende de disciplina — e ele não vai
alimentá-la, o que é fato medido (ele não lê nem escreve documento longo; é a
razão de o cockpit existir).

A sprint pode sair sozinha do que já se sabe: **frente com rota ocupada ou com
agente trabalhando nela agora**. O painel já cruza isso — é a bolinha que
aparece na pastilha do CC-81. Preenche sozinha, e é exatamente a coluna do meio
do Trello que a medição mostrou vazia.

**Medido em 15/08, nos 14 projetos:** os roadmaps só têm dois estados, 48
abertas e 12 feitas. **Zero "em andamento".** Ninguém nunca escreveu isso num
roadmap, e por isso a coluna do meio não pode vir do texto.

#### O que isto NÃO é

Adotar Scrum. A decisão do framework é dele e continua valendo:
*"Scrum, UML e MER são ferramenta, não obrigação"* ([[produto/FRAMEWORK]]). Aqui
se pega **três palavras que ele já entende**, não a cerimônia — sem sprint com
data, sem planning, sem estimativa.

#### ✅ Feito, no mapa lateral

Três blocos no topo: **agora**, **na fila**, **prontas**. O do meio sai de quem
tem agente trabalhando na frente — o painel já sabia disso desde o campo
`frente` do protocolo, e ninguém tinha juntado.

A tela diz, embaixo do rótulo, **de onde cada número vem**. "Sai sozinho,
ninguém escreve" não é enfeite: é o que impede alguém, daqui a três meses,
tentar manter a lista à mão e frustrar-se quando ela não obedecer.

#### Ligações

- **CC-78** (rotas na tela) ✅ é a outra metade, e fechou junto.
- **CC-81** ✅ fez a pastilha e o peso.
- O campo `frente` do protocolo já ligava to-do a frente desde 14/08 — era a
  ponte, e estava lá o tempo todo.

### CC-84 ✅ 15/08 — dois agentes no mesmo projeto, se falando

**Ele vai colocar dois agentes no mesmo projeto amanhã (16/08).** Isto deixou de
ser ideia e virou prazo. Palavras dele:

> "os agentes também precisam se comunicar (…) se dois agentes trabalham em
> rotas diferentes e um precisa mexer num arquivo que está na rota do outro, ele
> pode abrir um ticket, e um vai parar o Claude no meio do que ele está fazendo
> e avisar: o que você está fazendo vai ser afetado se a gente mexer em tal
> coisa. Se sim, para; ele vai terminar o que faz e você volta depois"

É o mesmo problema que ele já tinha nomeado na sessão de senhas: *"esse
recadinho que a gente ta fazendo é ineficiente"* — o `ROTAS-ATIVAS.md` com 336
linhas de conversa entre sessões em markdown.

#### O que já existe, e onde para

`rota-pedidos.mjs` (13/08) resolveu **um** caso: o agente barrado pede a rota, o
dono autoriza por comando. `routia-fim.mjs` avisa o dono. Onde para:

1. **O aviso só chega no `Stop`**, ou seja, no fim do turno do outro. Se ele
   estiver no meio de uma tarefa longa, o pedido espera.
2. **Só cobre pedido de rota.** Não existe "isto que você vai fazer afeta o que
   eu estou fazendo".
3. **Não há registro navegável** do que foi combinado entre agentes.

#### O detalhe técnico que muda o desenho, e melhora

Ele descreveu "parar o Claude no meio". Isso não existe: não há como interromper
um agente que está pensando. **Mas existe algo quase tão bom e mais simples:**
todo agente passa por `PreToolUse` a cada ferramenta que usa, e isso acontece
várias vezes por minuto.

**O ponto de interrupção mais cedo possível é o próximo tool call, não o fim do
turno.** Um hook de `PreToolUse` que consulte a caixa de mensagens entrega o
aviso em segundos, no meio do trabalho, sem precisar de nada que o Claude Code
não ofereça. É o mesmo mecanismo do `rota-guard`, com outro conteúdo.

Cuidado a respeitar: esse hook roda em **toda** chamada de ferramenta. Tem que
ser leitura de um JSON pequeno, e falhar aberto — hook lento ou quebrado aqui
trava os dois agentes de uma vez.

#### ✅ Feito: `hooks/routia/recados.mjs`

Cinco tipos, poucos de propósito (lista longa vira taxonomia que ninguém lembra
na hora de mandar): `aviso`, `vou_mexer`, `pare`, `liberado`, `terminei`. Cada um
carrega **o que o outro deve fazer**, não só o texto.

```
node recados.mjs enviar <para|todos> <tipo> "texto" [--arquivo x]
node recados.mjs caixa      o que chegou pra mim
node recados.mjs log        tudo que foi dito, recente primeiro   ← CC-85
node recados.mjs quem       sessões que já trocaram recado aqui
```

**A decisão de desenho que vale registrar: todo recado interrompe uma vez.** Um
hook `PreToolUse` só tem uma forma de fazer o agente LER algo — recusar a chamada
e devolver o texto. Com exit 0 ele nunca fica sabendo. Então o recado custa uma
interrupção, **uma só**: fica marcado como entregue e a ferramenta seguinte
passa. Recado que não interrompe é recado que ninguém lê, que foi exatamente o
problema do markdown.

Gate: `hooks/routia/testar-recados.sh`, 10 checagens. A que mais importa é a
última — **arquivo corrompido não trava nenhum dos dois agentes**. Este hook roda
em TODA chamada de ferramenta de TODOS os agentes; se ele quebrar fechado, para
o projeto inteiro.

Instalado nesta VPS. No PC entra junto com o CC-67.

#### O que ficou de fora, e é a parte que ele mais quer

**Detecção automática do conflito por dependência.** Hoje o agente decide sozinho
quando mandar recado; ninguém o avisa que o arquivo que ele vai tocar é usado
pela tarefa do outro. Isso é o CC-86, e com ele o aviso deixa de ser "vou mexer
no seu arquivo" e vira *"vou mexer num arquivo que 15 outros usam, dois deles
abertos por você"*.

### CC-85 ✅ 15/08 (primeira fatia) — o log das conversas

Pedido junto do CC-84:

> "sempre que tiver uma intervenção, ter tipo um log do que aconteceu, por
> projeto, por hora, poder ver em ordem crescente, decrescente, separar por
> projeto, separar por agentes"

**É o daily do [[produto/ANALISE-DA-IA]], e é o que eu tinha cortado errado.** A
correção dele: daily não é sobre humanos, é sobre coordenação entre executores.
Muda o formato — não é reunião de manhã, é registro do que foi combinado, na
hora em que foi.

`recados.mjs log` já mostra tudo que foi dito, recente primeiro.

**Falta a tela, com os quatro filtros que ele pediu literalmente:** *"por
projeto, por hora, poder ver em ordem crescente, decrescente, separar por
projeto, separar por agentes"*. Hoje o comando só ordena por recente. O CC-78
fechou a parte das rotas; o log ainda não tem lugar no painel.

Vale como métrica, não só como histórico: **duas sessões negociando muito no
mesmo projeto é sinal de que as rotas estão mal divididas.** Esse número não
existe hoje e seria o primeiro sinal objetivo de que o Routia precisa de ajuste
naquele projeto.

### ✅ CC-90 15/08 — o gate de pergunta em prosa

Ele me pegou **duas vezes no mesmo dia** fazendo pergunta decisiva em prosa, em
vez de usar o `AskUserQuestion`:

> "por que você me fez essa pergunta no chat, em vez daquele formato de
> perguntinha na tela? Aquilo é a regra, o framework tem que usar aquilo."

**Na primeira vez eu consertei errado**, e o erro é o mais interessante deste
item: escrevi uma **instrução** no injetor do `SessionStart` — horas depois de
ter escrito, na [[produto/ANALISE-DA-IA]], que instrução não me segura e que o
que segura é gate. Diagnóstico certo, remédio errado, recaída em vinte mensagens.

**E eu tinha declarado impossível o que resolvia.** Estava escrito que hook não
barra prosa. O `Stop` recebe o turno inteiro e pode devolver — o que a armadilha
antiga dizia é que isso vira laço, e vira **quando não há o que fazer diferente
na segunda passada**. Aqui há: refazer a pergunta na ferramenta certa.

**O que ele NÃO faz**, que foi a dúvida dele antes de autorizar: não obriga a
perguntar. Não olha se existe pergunta, olha se ela **saiu em prosa**. Executar
e reportar não dispara nada.

Três travas para não virar hook chato: uma volta só por turno; só os dois
últimos parágrafos (pergunta no meio é retórica); e silêncio se a caixa já foi
usada no turno. Gate próprio com 10 checagens, metade delas provando o que
**passa**.

**Um defeito de brinde, que custou uma rodada inteira:** hook fora do
`hooksCatalogo.mjs` sai calado, porque `hookEnabled` de id desconhecido devolve
`false`. A detecção estava certa desde o começo; o hook é que se achava
desligado. Virou armadilha no `CLAUDE.md`.

### CC-91 ✅ 16/08 — o cartão do framework, as quatro partes

Todos apontados por ele em 15/08, usando o framework de verdade pela primeira
vez. **O primeiro é o mais grave, e eu vi acontecer.**

**1. Trocar o modo não confirma nada.** Palavras dele: *"quando eu mudasse
tivesse uma confirmação de que foi mudado de fato, porque às vezes eu mudo e dá
medo de não ter mudado"*.

Não é impressão: **aconteceu duas vezes hoje.** Ele disse que tinha desligado o
framework, e o `.framework/estado.json` continuava `restritivo`. Eu só descobri
porque fui ler o arquivo. Sem confirmação, a tela afirma uma coisa que pode não
ter acontecido — e é o pior tipo de mentira de interface, porque parece sucesso.

**2. O botão "autorizar" está colado no seletor de modo.** *"dá vontade de
apertar em executar do lado porque é um botão muito imediato (…) não era pra ter
esse botão autorizado do lado, colado numa coisa que você troca"*.

Ele apertou por engano hoje, e a consequência não é pequena: `autorizar` libera
escrever código, que é justamente o que o modo acabou de travar. **Ação
destrutiva grudada em ação de configuração.**

**3. O botão não diz o que autoriza.** Hoje grava `**`, que é tudo, para sempre,
até trocar de modo. A tela não conta isso.

**4. Framework e ligar/desligar moram em lugares diferentes.** *"onde a gente
ativa o projeto, a gente pode mudar o modo (…) é uma coisa inteiramente ligada.
Quando você começa um projeto e bota o controle nele, seria legal poder mudar
por lá também"*.

São a mesma decisão vista de dois lugares: ligar o framework num projeto e
escolher como ele te trata. Estar em telas diferentes obriga a lembrar que as
duas existem.

#### Como consertar, decidido por ele em 15/08

**A confirmação é dupla, e as duas metades fazem coisas diferentes:** um aviso
de "salvo" logo após o clique (resposta imediata, para a mão saber que registrou)
**e** a releitura do arquivo mostrando o que ele de fato diz, com a hora. A
segunda é a que não mente — a primeira sozinha foi o que falhou hoje, porque
confirma o envio, não a gravação.

Se as duas discordarem, a tela mostra o conflito em vermelho: *"pedi restritivo,
o arquivo diz diálogo"*. É o único jeito de o medo dele ter fim.

**O autorizar ganha três mudanças, também combinadas:**

1. **Sai de perto do seletor de modo.** Linha própria, e só aparece quando o
   modo trava alguma coisa. Ação que libera escrita não pode ficar colada em
   ação de configuração — ele apertou por engano exatamente por isso.
2. **Pergunta antes**, dizendo o que vai acontecer.
3. **Passa a ser por arquivo, não `**`.** Eu peço, ele libera o que pedi. É o
   desenho original do modo, e o `**` de hoje é o atalho que esvazia o gate.
4. **Explicação junto do botão, ou num "?" ao lado** — pedido dele no mesmo
   momento. O botão hoje não diz o que autoriza, por quanto tempo, nem que a
   autorização morre ao trocar de modo.

⚠️ **A parte 3 muda o fluxo dos dois lados:** hoje eu tento escrever e sou
barrado. Com autorização por arquivo, eu preciso **pedir antes** — e isso já
existe pronto no `rota-pedidos.mjs`, que faz exatamente isso para rotas. É
código para reusar.

#### ✅ Feito: 1, 2 e 4

**A confirmação é dupla e funciona como ele pediu.** Depois de trocar o modo, o
painel faz uma segunda chamada e compara o que foi PEDIDO com o que o servidor
diz que está gravado. Se bater: *"✓ salvo: o arquivo diz Restritivo, às 21:03"*.
Se não bater: *"✗ pedi restritivo, o arquivo diz dialogo — tente de novo"*, em
vermelho.

**O autorizar saiu de perto do seletor**, para um bloco próprio que só aparece
quando o modo trava. Ganhou um `?` explicando o que a autorização faz, por
quanto tempo vale, e que trocar de modo a zera. E a confirmação do clique passou
a **dizer o que vai acontecer** em vez de perguntar "tem certeza?".

O gate guarda as três peças, inclusive a posição: se alguém puser o botão de
autorizar colado no seletor de novo, o teste acusa.

#### ✅ Parte 3, 16/08: o agente pede antes de escrever

**A inversão é o ponto.** Antes eu tentava, batia no gate, e a saída mais fácil
para ele era autorizar tudo com `**` — o atalho que esvaziava o modo. Agora o
guard **registra o pedido** ao recusar, e o cartão mostra uma linha por arquivo
pedido, com botão próprio.

O mecanismo é o mesmo do `rota-pedidos.mjs` (13/08), que já fazia isto para
rotas: bloqueio vira pedido registrado, e o dono libera.

Quatro cuidados no motor, cada um com teste:

- **pedir o mesmo arquivo duas vezes não duplica** a linha, só atualiza o motivo
- **autorizar tira o pedido da fila** — pedido resolvido que continua pedindo é
  fila que só cresce
- **a fila guarda 20**, porque pedido velho sem resposta é ruído que esconde o
  que acabou de chegar
- **registrar o pedido nunca impede a recusa**: fica dentro de `try`, porque a
  recusa é a parte que protege

E a confirmação do clique diz **qual**: "liberar só este arquivo" é uma frase
diferente de "liberar todos", e a diferença entre as duas é o modo funcionar ou
virar decoração.

### CC-87 ✅ 16/08 — as 11 telas respondem uma pergunta cada

Decisão dele em 15/08: **as onze**, com prévia em arquivo a cada uma, da mais
fácil para a mais difícil. E, sobre o método: *"registra o conserto no backlog
como próximas tarefas e segue"*.

**A reprodução já está registrada** (`cc framework reproducao`):

> **como aparece:** as 11 telas não respondem pergunta nenhuma — mostram o dado
> cru e ele traduz sozinho. Em tela estreita: nomes desalinhados, nada aparente,
> sem cara de aplicativo.
>
> **esperado:** cada tela abre com a pergunta dela no topo e um veredito em uma
> frase, nas palavras dele.

Ordem: (1) `meu`, `glossário`, `cockpit`; (2) `agentes`, `to-dos`, `remoto`,
`servidores`, `agenda`, `preço`; (3) `tempo`, `hooks`.

Cada uma fecha com prévia em arquivo — é a fase de Prova do método, e a regra 1
do ciclo dele.

#### ✅ As três primeiras, 15/08

`cabecaDaTela()` nasceu aqui: um componente só, com a pergunta e o veredito, no
mesmo desenho que a aba VPS inaugurou.

| Aba | A pergunta | O veredito |
|---|---|---|
| `meu` | O que depende de mim? | "Nada. Você resolveu 4." / "3 coisas só você pode resolver." |
| `glossário` | O que é isso mesmo? | "9 documentos prontos, 3 ainda sem resumo." |
| `cockpit` | Onde eu mexo agora? | "1 agente parado esperando você. Comece pelo de cima." |

**O veredito do `cockpit` é o que mais muda o uso:** aquela aba já ordenava por
urgência desde sempre, e **nunca dizia isso em voz alta**. Quem abria via uma
lista e tinha que descobrir sozinho que a de cima era a mais urgente.

O gate guarda a regra, não o texto: se alguém acrescentar tela sem pergunta,
ninguém notaria — foi assim que 11 das 15 ficaram mudas até hoje.

#### ✅ O grupo do meio, 16/08

| Aba | A pergunta | O que o veredito responde |
|---|---|---|
| `agentes` | Quem está trabalhando agora? | separa **quem espera você** de quem roda sozinho |
| `sprint` | O que falta fechar? | conta as abertas, que é o número que diz se o dia acabou |
| `servidores` | O que está no ar nesta máquina? | só os SEUS servidores; as portas do sistema ficam à parte |
| `agenda` | O que eu tenho hoje? | hoje primeiro — o dado estava organizado por "próximos N dias" |
| `preço` | Quanto cobrar por isso? | o número que vai numa proposta, não a soma de tudo |
| `remoto` | Onde eu quero abrir uma sessão? | o que já está de pé, para não abrir duas sem querer |

Duas decisões que se repetiram e viram padrão: **o veredito conta o que é dele,
não o que a máquina tem** (servidores ignora porta de sistema), e **ele responde
a pergunta do momento, não a do dado** (agenda mostra hoje, mesmo guardando 30
dias).

Conferido no painel de produção depois do restart: as nove perguntas estão no
ar.

#### ✅ As duas difíceis, 16/08

Nessas a pergunta no topo não bastava: o corpo também mudou.

**`hooks` — "O que está me travando?"** Passou a agrupar por **nível** (travam /
avisam / informam / medem) em vez de por evento. `PreToolUse` e `Stop` são nomes
do Claude Code; o que ele precisa saber é o que barra e o que só fala. O nível
veio do CC-69, que declarou isso num lugar só justamente para servir aqui.

O evento virou frase: *"antes de cada ação minha"*, não `PreToolUse`.

**E o veredito grita o caso perigoso:** hook ligado e NÃO registrado no
`settings.json`. Ele parece ativo na tela e não faz nada — a pior combinação
possível, e estava escondida numa etiqueta cinza no canto.

**`tempo` — "Quanto tempo isso levou, e quanto vale?"** A pergunta tem duas
metades porque a aba tem dois usos. O veredito responde as duas numa frase e diz
qual projeto consumiu mais, que é o que ele procura primeiro.

**E o corpo encolhe em tela estreita:** das 9 colunas de largura fixa, ficam
projeto, horas e dinheiro. As outras somem — o detalhe continua a um clique, no
painel do projeto, que é o nível de baixo da árvore (CC-75). Era a tabela que
mais vazava de lado, e a que ele mais olha.

#### As onze, conferidas no ar

| | |
|---|---|
| cockpit | Onde eu mexo agora? |
| agentes | Quem está trabalhando agora? |
| sprint | O que falta fechar? |
| meu | O que depende de mim? |
| glossário | O que é isso mesmo? |
| tempo | Quanto tempo isso levou, e quanto vale? |
| preço | Quanto cobrar por isso? |
| agenda | O que eu tenho hoje? |
| servidores | O que está no ar nesta máquina? |
| VPS | A VPS está saudável? |
| hooks | O que está me travando? |
| remoto | Onde eu quero abrir uma sessão? |

São doze com a VPS, que inaugurou o padrão.

**Falta a consideração dele, página a página** — pedida em 16/08, depois de ver
as telas prontas. É a fase de Prova do método `conserto`, e nenhuma tela está
fechada até ele olhar.

### ✅ CC-88 15/08 — a aba `to-dos` virou `sprint`, e as cores inverteram

Decisão dele: *"vamos chamar os to-dos de sprint backlog? fica melhor usar
aquela ideia dos nomes do Scrum pras coisas"*. É o CC-83 chegando na tela, e
fecha o vocabulário: **product backlog** é o roadmap, **sprint backlog** são os
to-dos do agente.

**As cores estão invertidas de propósito, e a razão é dele:** verde é o que
FALTA, cinza é o que passou. O costume é o contrário, e o costume está errado
aqui — verde chama o olho, e o olho deve ir para o que resta.

**A tarefa em andamento ganhou barra azul**, e ela é derivada: é a primeira
tarefa aberta de um agente cujo status é `working`. Ninguém marca "estou nesta".

⚠️ O `id` da aba continua `todos`: trocar mandaria quem tem a aba lembrada no
`localStorage` para outro lugar sem motivo.

### CC-89 ✅ 15/08 — etiqueta da tarefa no chat

Pedido dele no mesmo momento: *"adicionando as tarefas também pra gente colocar
aqui no chat, sempre uma etiqueta durante o chat em alguns momentos, pra eu
saber qual tarefa a gente está fazendo"*.

**Já em uso a partir de 15/08**, no formato `[tarefa: ...]` no começo da
resposta. Não precisa de código — precisa de hábito, e por isso entra no
`control-center-estilo.md`, que é injetado a cada sessão.

Vale medir depois, junto do `estilo-fim`: em quantas respostas a etiqueta
aparece quando havia tarefa em curso.

### ✅ CC-94 16/08 — a prévia virou parte do cockpit

*"eu precisei dar zoom, fico dando zoom"*, dito na rua, sobre a lista do que
falta. **Todas as prévias de 15 e 16/08 tinham o mesmo defeito:** usavam o CSS
do painel, que é desenhado para tela larga, com fonte de 11 a 15 pixels.

Ele lê no telefone, quase sempre andando. Arquivo que exige zoom é arquivo que
ele não lê — e aí a prévia não serve para nada, que é o pior desfecho possível
para a fase de Prova do método `conserto`.

Pedido dele, e é o que fecha o item: *"botar isso como parte do sistema do
cockpit e fixo, como uma prática mesmo, uma boa prática"*.

**Virou `src/previa.mjs` + `cc previa`**, em vez de continuar como script solto
em `/tmp` reescrito a cada vez — que era a causa: cada prévia recomeçava do zero
e o acerto de tamanho se perdia junto com o `/tmp`.

```
cc previa docs/ALGO.md              vira HTML no tamanho do telefone
cc previa docs/ALGO.md --layout     usa o CSS REAL do painel
cc previa X.md --saida /caminho.html
```

**Os dois modos, e escolher errado estraga dos dois jeitos:**

- `leitura` (padrão): 19px, CSS próprio. Para texto que ele vai LER.
- `layout`: o CSS de verdade do painel. Para conferir como a tela fica — e
  **aqui fonte grande seria mentira**, porque o tamanho é justamente o que se
  quer provar.

O markdown é traduzido pelo mínimo que ele escreve (título, lista, citação,
código, negrito), sem biblioteca — trazer uma quebraria a regra de zero
dependência por um ganho que ninguém pediu. E escapa HTML: um `<script>` dentro
de um documento não pode virar script na página.

Regra também no `control-center-estilo.md`, que é injetado a cada sessão.

### CC-92: o proxy da anonimização — pedido em 15/08 e NÃO registrado

**Escapou.** Ele disse, palavra por palavra: *"segue com o hook e já pode
implementar ele, não precisa do proxy por enquanto, **mas anota ele**"*. O hook
foi feito (F12); a anotação não. Achado em 16/08, revendo o chat a pedido dele.

O que ele queria: *"eu prefiro que isso seja um proxy, um hook, alguma coisa que
seja sempre que eu mandar arquivos de texto, doc, pdf, enfim, tudo com esse modo
ligado"*.

**A diferença entre o hook e o proxy**, que é o motivo de ele ter pedido os dois:

- O **hook** (feito) intercepta quando **eu leio** um arquivo do disco. Cobre o
  caso de "o Felipe salvou o contrato numa pasta e mandou eu abrir".
- O **proxy** interceptaria o que **sai desta máquina** para a API. Cobre o que
  o hook não vê: arquivo colado direto no chat, imagem, texto digitado.

⚠️ **Não é pequeno, e vale dizer antes de alguém começar:** exigiria pôr algo no
caminho entre o Claude Code e a API da Anthropic — TLS, certificado, e um ponto
único de falha que derruba o trabalho inteiro se quebrar. O hook resolve 80% com
1% do risco. Registrado como direção, não como tarefa.

### CC-93 ✅ 16/08 — guia longo virou etapa, com gate

Pedido dele na sessão de senhas, em 15/08, e que está só no `HANDOFF.md` — ou
seja, **some quando o HANDOFF for sobrescrito**. Trazido para cá em 16/08.

> "se eu não acho o primeiro item da sua mensagem eu automaticamente perco todo
> o resto do texto; o ideal seria a gente usar o framework e transformar essas
> guias em etapas, assim se eu não achar algo já trava desde o início"

O caso real: um passo a passo do Bitwarden com âncora relativa ("logo abaixo de
X"). Ele não achou o X, e as outras seis linhas viraram perda total. **O custo
de uma âncora errada não é a âncora, é a mensagem inteira.**

O formato que funcionou de primeira: uma etapa por mensagem, âncora absoluta,
critério de sucesso explícito ("achou?"), parada declarada se não achar, e o
total anunciado no começo ("etapa 1 de 3").

É a mesma família do gate de MVP: parar no primeiro critério que não fecha, em
vez de despejar tudo e deixar a verificação por conta dele. Candidato a virar
regra no `control-center-estilo.md`, junto do padrão de resposta.

**Feito em 16/08, nas duas pontas:**

- **A regra**, em `src/estilo.mjs` (`PADRAO_EMBUTIDO`), que desce para
  `~/.claude/control-center-estilo.md` e é injetada no início da sessão.
- **O gate**, `hooks/guia-guard.mjs`: a partir de 3 passos de interface numa
  resposta só, devolve pedindo o formato de etapa. Só instrução dirigida a ele
  conta — relato do que o agente fez passa limpo, e bloco de código conta como
  um passo. 5 casos de teste.

O gate é a parte que funciona. Instrução escrita já falhou três vezes em dois
dias (o próprio CC-90 nasceu disso), e regra sem porteiro é intenção.

### CC-82: um leitor de documentos dentro do cockpit

Ideia dele em 15/08, logo depois do CC-81, e é a mesma ideia em escala maior:
**guardar a fonte primária.** Palavras dele:

> "adiciona um leitor de dentro do cockpit, algo bem leve, só pra gente poder
> ver texto formatado. Assim a gente pode anexar documentos dentro do cockpit
> (…) guardar documentos mesmo, ideias minhas, textos meus, pra ela analisar
> depois. É sempre bom ter a fonte primária guardada."

**A distinção que ele mesmo fez, e que decide o desenho:** *"notas é mais em
tempo real, são coisas que eu vou anotar. E esse mecanismo é pra guardar
documentos"*. São duas coisas diferentes e não devem virar a mesma aba — o bloco
de notas grava a cada tecla e cabe numa linha; documento é peça fechada que ele
escreveu ou ditou e quer reler meses depois.

Precedente que já aconteceu: ele mandou o documento da [[produto/BANCADA]] e o da
[[produto/ARQUITETURA-DE-HABITOS]] pelo chat. Os dois viraram arquivo em
`docs/produto/` **de um projeto específico**, e é lá que estão presos. Ele não
os alcança de outro lugar, que é exatamente a falta que este item nomeia.

#### O que já existe e serve de fundação

- **Markdown formatado sem biblioteca**: o painel não tem dependência de runtime,
  e um leitor "bem leve" cabe nisso — títulos, negrito, lista, citação e código
  cobrem tudo que ele escreve. Nada de renderizador completo.
- **A federação (CC-47)**: documento guardado fora do projeto viaja entre as
  máquinas pelo canal que já existe, e é o que faz o "ver de qualquer lugar".
- **`notes.mjs`** tem o cuidado que este vai precisar: cópia `.bak` antes de
  sobrescrever, porque texto digitado à mão não tem outra fonte. As notas já se
  perderam uma vez, em 09/08.

#### Três perguntas em aberto

1. **Onde mora?** Fora do projeto, para ele ver de qualquer lugar — mas então
   fica fora do git, sem histórico. Guardar dentro do projeto dá versionamento e
   perde o "de qualquer lugar". Talvez os dois: mora fora, e um comando publica
   no projeto quando o documento vira decisão.
2. **Documento anexado passa pelo mascarador (F12)?** Ele disse "para ela
   analisar depois", então a IA vai ler. Se for contrato da Carol, o F12 se
   aplica; se for ideia dele, mascarar seria só atrapalhar. Provável resposta:
   o mascarador continua no hook de leitura, e o leitor não se mete.
3. **"Adiciona uma nota lá pra mim" precisa de comando?** Ele citou isso como
   caso de uso. Seria `cc doc add`, irmão do `cc set` — e aí funciona pelo
   celular, que é o ponto.

### CC-78 ✅ 15/08 — o quadro de rotas virou tela, e dá para mexer

Hoje `docs/ROTAS-ATIVAS.md` tem **336 linhas** e é lido abrindo o arquivo. A
ideia dele é ver, por projeto, em que rota cada um está — e **mudar o estado
clicando**: *"aquelas bolinhas verde, vermelho, azul (…) se eu clicar ela fica
vermelha, se eu clicar ela fica azul, se eu clicar fica verde de novo"*.

**As três perguntas em aberto, respondidas:**

**1. O que é o azul?** Não precisou ser inventado — **já existia**, como veredito
do CC-49: 🔵 é ocupada por alguém que sumiu há mais de uma hora. Verde é livre,
vermelho é ocupada com dono vivo.

**E o azul não se clica.** Ele pediu bolinhas que ciclam; o clique alterna entre
livre e ocupada, que são as duas escolhas de verdade. O azul é descoberta, não
escolha — um terceiro estado clicável seria cor sem significado.

**2. Quem vence quando os dois escrevem?** A edição é **cirúrgica**: só a célula
de status daquela linha muda, com releitura imediata antes de gravar. Se outra
sessão escreveu em outra linha nesse meio-tempo, o texto dela sobrevive — **há
teste provando isso**, com uma segunda rota e um parágrafo que não podem ser
tocados.

⚠️ **Não é lock, e a corrida continua existindo**, reduzida de minutos para
milissegundos. Lock de verdade exigiria arquivo à parte, e aí o markdown
deixaria de ser a fonte.

**3. O clique libera rota de outra sessão?** Libera, **com confirmação escrita**
dizendo que isso apaga a marca de quem estiver nela. E a decisão do CC-49
continua de pé onde importa: o sistema nunca libera sozinho por silêncio, só
mostra o azul e deixa a escolha com quem lê.

### CC-79: ligar as rotas ao Pixel Agents

Ideia dele: o escritório com os bonequinhos e o quadro de rotas conversarem.
*"isso poderia ter uma conexão entre esses dois"*.

O que dá para imaginar sem inventar: o boneco de cada agente mostrando em que
rota ele está, e a rota mostrando qual boneco a ocupa. Os dois lados já sabem o
id da sessão, que é a chave que os liga.

⚠️ **Depende do CC-60**, que continua aberto: há dois Pixel Agents nesta VPS, um
nosso e um do usuário `agente`, e ainda não foi decidido o que fazer com o
segundo. Ligar rotas a um escritório indefinido é construir sobre areia.

### CC-80: a visão estrutural do projeto

O guarda-chuva dos dois acima, e o mais vago de propósito: ele pediu para
**estudar**, não para fazer. O que está dito é o critério, não a solução — tem
que caber no raciocínio visual dele, que é o mesmo motivo pelo qual o cockpit
existe.

Vale desenhar contra o que já se sabe dele: ele lê mal texto longo, decide bem
com mapa, e o vocabulário da tela tem que ser o do ROADMAP dele (foi o achado
que criou o campo `frente`). Uma tela de rotas que fale em `src/**` em vez de
"Pierre" repete o erro que o `frente` corrigiu.

### Frente: o que pre-commit, husky e Danger já resolveram, e nós não

Registrada em 15/08 a pedido dele, depois de comparar o framework com os oito
frameworks de agente e perceber que **os parentes de verdade não são LangChain
e cia: são as ferramentas de gate do mundo humano**. Elas atacam o mesmo
problema de fundo há uma década — instrução escrita não segura ninguém, então a
regra vira código que intercepta.

O que cada uma acertou, e onde estamos:

| Elas | Nós hoje |
|---|---|
| `pre-commit`: catálogo de centenas de checagens, adotadas em 3 linhas | um método só, `mvp-basico` |
| `husky`: o gancho nasce com o `npm install` | registrar hook à mão no `settings.json` de cada máquina |
| `lint-staged`: roda só no que mudou | sem noção de "o que mudou" |
| `Danger`: níveis declarados (fail / warn / message) | cada hook decide no próprio código |
| `pre-commit run --all-files`: rodar tudo sob demanda | o gate só existe no gatilho |
| `pre-commit autoupdate`: atualizar as regras | cópia manual, ver CC-65 |

Observação que vale guardar: o `git-add-guard` é um pre-commit caseiro que já
existia aqui sem se chamar assim.

### CC-67 ✅ 15/08 — `cc hooks install`, o gancho nasce com o projeto

**O mais urgente dos seis**, e a prova está no HANDOFF de hoje: dois hooks novos
estão esperando ele registrar à mão no `settings.json` do PC, com caminho `D:/`.
Enquanto isso o padrão de resposta vale só na VPS.

O husky resolveu exatamente isto: gancho de git não é versionado, então cada
máquina teria que instalar sozinha. Aqui é pior, porque o `settings.json` é
global e o caminho muda de máquina.

**Feito.** `hooksRegistro.mjs` já sabia ler; ganhou `instalar()`.

```
cc hooks install --dry-run    mostra o que faria, sem tocar em nada
cc hooks install              registra o que falta
```

Quatro cuidados, e o primeiro é o que mais podia dar errado:

1. **Merge, nunca substituição.** O `settings.json` dele tem ~200 linhas e é
   compartilhado: o pixel-agents registra em 11 eventos. Trocar a lista de um
   evento apagaria hooks de terceiro sem aviso. **Há teste guardando isso**, com
   um hook de outro sistema no mesmo evento.
2. **Cópia antes de gravar** (`.bak`), pela mesma razão de `notes.mjs`: arquivo
   editado à mão, sem outra fonte.
3. **O JSON é validado antes de sobrescrever.** Settings quebrado não desliga um
   hook, desliga *todos*.
4. **Barra normal mesmo no Windows.** Barra invertida em JSON exige escape
   duplo, e isso já quebrou o atalho do Desktop em silêncio.

O caminho é derivado do próprio arquivo, então sai certo em cada máquina —
`D:/...` no PC, `/home/...` aqui. E rodar duas vezes não duplica.

O hook de recados (CC-84) entrou no catálogo junto, então já vai instalado.

### CC-68 ✅ 15/08 — catálogo de métodos: quatro, nenhum com código próprio

`mvp-basico` e `entrega-cliente` são os dois presets que existem, e o segundo
mal foi usado. O pre-commit tem centenas porque **quem adota escolhe**, e a
escolha é de três linhas.

Ligado ao que já está registrado: "mais de um método é o que prova que o método
é dado e não código" ([[produto/FRAMEWORK]]), e a [[produto/BANCADA]] é o
embrião do catálogo pelo lado das ferramentas de verificação.

#### ✅ Feito: `conserto` e `estudo`, escolhidos por ele

**A observação que decidiu quais:** os dois métodos que existiam supõem que há
algo NOVO para entregar. O dia 15/08 inteiro não foi isso — regex quebrado,
hash velho, layout vazando, gate morto. **Nenhum tinha MVP a definir.**

**`conserto`: Reprodução → Conserto → Prova.** A ordem é o remédio. Reproduzir
antes trava o código de propósito, e é o vício mais caro de hoje: escrevi que o
extrator de PDF seria ruim sem tentar, e exagerei a gravidade do defeito do
endereço sem medir — nos dois casos eu tinha pulado a reprodução. Provar depois
é a regra 1 do ciclo dele virando trava, e exige **teste que guarde**: verde não
é prova, já houve 545 passando com a tela quebrada.

**`estudo`: Pergunta → Decisão, com código travado nas DUAS fases.** A entrega é
a decisão, não o programa. Nasceu de um padrão dele — em 15/08 pediu três itens
"para estudar", e o risco é sempre o mesmo: eu começo a construir enquanto ele
ainda está pensando. Foi o erro do glossário, que originou o F1; aqui vira fase
em vez de instrução.

Dois predicados que valem citar: **estudo com uma opção só é recusado** ("não é
estudo, é uma escolha já feita"), e **opção sem medida também**.

**O que isto prova, e era o ponto:** os dois entraram como **dado puro**. Nenhuma
linha no motor, nenhum `if` por método. O gate confere que todo predicado
declarado existe — se algum método precisasse de código próprio, quebraria ali.

### CC-69 ✅ 15/08 — níveis declarados, num lugar só

O Danger tem `fail`, `warn` e `message`, e a regra diz qual usa. Aqui cada hook
resolve no próprio código: o `framework-guard` recusa com exit 2, o
`roadmap-guard` avisa, o `todo-guard` avisa. A escolha está certa em todos, mas
está espalhada — não dá para olhar num lugar e saber o que trava e o que fala.

**Feito.** Quatro níveis: `trava` (recusa a ferramenta), `avisa` (fala e deixa
seguir), `injeta` (põe contexto no início) e `mede` (só registra). Hoje: 3
travam, 2 avisam, 2 injetam, 1 mede.

**O gate ganhou uma regra que era só comentário:** hook de `Stop` nunca pode
travar. Exit 2 ali devolve o texto ao modelo e o manda continuar, criando laço.
Isso estava escrito em comentário em dois arquivos; agora o teste recusa.

### CC-70 ✅ 15/08 — `cc framework check`, o gate sem esperar o gatilho

`pre-commit run --all-files` existe porque gate que só roda no gatilho não
responde "como está o projeto agora?". Aqui é a mesma falta: para saber se um
projeto passaria, é preciso tentar editar um arquivo e ser recusado.

Serve para três coisas: conferir antes de começar, rodar em CI, e alimentar o
painel com o estado real de cada projeto em vez do estado registrado.

**Feito.** Sem argumento, varre todos os projetos; com `--dir`, um só.

```
cc framework check              todos os projetos
cc framework check --dir X      um projeto
cc framework check --json       para script
```

**Sai com código de erro quando algum projeto barraria**, e é isso que o torna
útil em CI — sem esse detalhe seria só um relatório bonito. Conferido nos dois
casos: `teste_pierre_agenda` (sem MVP) sai 1 e lista o que falta;
`proj_controlcenter` sai 0.

### CC-71: agir só no que mudou

`lint-staged` roda só nos arquivos alterados, e é o que torna o hook rápido o
bastante para ninguém desligar. Nosso equivalente ainda não tem uso claro — o
gate de fase não olha arquivo — mas passa a ter no dia em que a Bancada virar
gate: rodar a camada de segredo no repositório inteiro a cada entrega é o tipo
de lentidão que faz o Felipe desligar o recurso.

**Registrado como direção, não como tarefa:** sem a Bancada ligada, não há o que
otimizar, e otimizar antes seria inventar problema.

### CC-72 ✅ 15/08 — `cc hooks sync`, contra a cópia que envelhece

O CC-65 versionou os seis hooks globais e deixou dito em negrito que é **cópia,
não fonte**: mexer no repositório não muda o que roda. O `pre-commit autoupdate`
resolve isso do lado deles.

**Feito:** `cc hooks sync [--dry-run]` compara o repositório com
`~/.claude/hooks` e copia o que divergiu. CRLF não conta como diferença — foi o
que enganou a comparação de rotinas no CC-42, e há teste guardando.

**Um estado que eu não tinha previsto, e o comparador aprendeu:** três hooks
(`estilo-inicio`, `estilo-fim`, `recados`) estão registrados apontando **direto
para o arquivo do repositório**. Não há cópia a manter — o que roda já é o
versionado, que é o ideal. Na primeira versão o comando mandava copiá-los para
`~/.claude/hooks`, criando exatamente a segunda cópia que ele existe para
evitar.

Isso vira recomendação: **hook novo registra o caminho do repositório**, e aí
nunca há o que sincronizar.

### CC-66 ✅ 15/08 — o padrão de resposta virou hook instalável

Saiu de um estudo que ele mandou fazer sobre uma explicação minha do CC-48 que
ficou confusa: *"algumas coisas começam como se já existisse um contexto
recente e fosse uma resposta, mas a pergunta nunca existiu, e quem você tá
respondendo não tá lendo"*.

Três vícios, achados no meu próprio texto: **respondo pergunta que ele não
fez**, **reexplico o que ele mesmo me contou**, e **justifico escolha antes de
perguntarem**. O mesmo texto no padrão: 35 linhas viraram 9.

**`estilo-inicio` (SessionStart)** injeta o padrão em toda sessão, em qualquer
projeto, com o framework ligado ou desligado — decisão dele, e a razão é certa:
o jeito de conversar não é regra de engenharia de um projeto. O texto mora em
`~/.claude/control-center-estilo.md` e é editável por ele.

⚠️ **Isto não é gate, e a diferença importa.** Hook bloqueia ferramenta; prosa
sai do modelo direto para a tela. É a instrução mais forte que existe aqui, e
ainda assim uma instrução.

Por isso ele pediu a medição junto: **`estilo-fim` (Stop)** conta tamanho e
parágrafos de autodefesa, e `cc estilo` mostra a tendência contra as respostas
anteriores. Nunca bloqueia (exit 2 no Stop viraria laço de reescrever resposta)
e nunca fala na tela (aviso a cada resposta seria a linha a mais que o padrão
existe para cortar). Falso positivo é esperado: é tendência, não nota.

### CC-65 ✅ 15/08 — os hooks globais não existiam em repositório nenhum

Achado tentando entregar o CC-48: **não dá para mandar por PR o que não é
versionado.** `rota-guard.mjs`, `rota-pedidos.mjs`, `routia-inicio.mjs`,
`routia-fim.mjs`, `git-add-guard.mjs` e `todo-guard.mjs` só existiam em
`~/.claude/hooks/`, em duas máquinas.

O risco é maior que o incômodo: o `hooksCatalogo.mjs` **liga e desliga cinco
deles pela tela deste painel**, ou seja, o cockpit controlava código que não
estava em lugar nenhum. Perder uma máquina levava o Método Routia junto.

Agora estão em `hooks/routia/`, varridos por segredo antes de entrar (o
repositório é público): nada. Os matches de `token` eram nome de variável de
parser e a lista de padrões dos próprios detectores.

⚠️ **É cópia, não fonte.** O que roda continua sendo `~/.claude/hooks/`, e nada
sincroniza sozinho. O combinado está no `hooks/routia/LEIA.md`: editar no
repositório e copiar no mesmo passo. Um `cc hooks sync` resolveria, e não existe.

Irmão do CC-61 (o `cockpit-auth.mjs`, que também não está em repositório e é a
porta de entrada do painel inteiro).

### CC-08 — só macOS continua sem prova

Era "macOS e Linux nunca rodaram". **Linux saiu da lista em 13 e 14/08**: o
painel roda em produção nesta VPS Ubuntu, como serviço systemd, e o que foi
exercitado de verdade cobre quase todo o `platform.mjs` — portas por `ss`,
processos, matar processo, spawn de painel embutido, proxy HTTP e WebSocket,
hooks, e o serviço voltando sozinho depois de derrubado. O que ainda não foi
testado em Linux: `cc daemon install` (aqui o serviço foi criado à mão) e o
atalho `.desktop`.

**macOS segue sem nenhuma máquina real.** launchd, `lsof`, `.command` e o
`SIGTERM` no lugar do `taskkill` existem escritos e nunca executaram. Quando
houver um Mac à mão: `cc` (só leitura, tem que funcionar de primeira) →
`cc open` → `cc daemon install` → aba de servidores → encerrar um processo de
teste.

### CC-46 ✅ 15/08 — `estadoDe()` casava estado no meio do título

Achado em 13/08 implementando as pastilhas do CC-34: "CC-23 — Histórico rico"
virou "feito" porque o título contém a palavra "Histórico", e "CC-04 —
...agente travado..." virou "bloqueado" porque contém "travado". Nos dois casos
a palavra descrevia **o que a tarefa é**, não em que pé ela está.

**Consertado:** emoji vale em qualquer posição (ninguém escreve ✅ sem querer
dizer feito), palavra só vale na ETIQUETA do título — o pedaço antes do primeiro
travessão ou dois-pontos, depois de tirar o identificador (`CC-46`, `F16.`).

Provado varrendo os **83 títulos dos roadmaps reais dos 14 projetos**: uma única
mudança de estado, e para melhor. O inovallbond tem `🟡 Bloqueado — depende do
Felipe`, que saía vermelho no painel enquanto o arquivo mostrava amarelo. Quando
emoji e palavra se contradizem o emoji ganha, porque escolher 🟡 e não 🔴 é
deliberado, e "depende de alguém" é esperar, não estar impedido.

### Frente: Sincronia entre máquinas, aprovada pelo Felipe em 14/08

O pedido dele, ditado por voz na VPS pelo celular: parar de usar o Git como
canal entre a sessão do PC e a sessão da VPS. Motivo dele, que é o certo: "a
gente faz muitos testes internos", então commit e push viram ruído e latência
justamente no arquivo mais disputado. Git fica como registro de entrega, não
como barramento de estado vivo.

O que mudou na dinâmica, nas palavras dele: antes precisava estar no PC físico,
com teclado e mouse; agora ele abre pelo telefone, conclui tarefa de qualquer
lugar e usa túnel próprio para acessar o que está rodando.

**Medido nesta VPS em 14/08, antes de propor qualquer coisa:**

- O Routia funciona aqui. O `rota-guard` bloqueou de verdade com caminho real
  desta máquina, listando as rotas ocupadas; o `SessionStart` injetou o quadro
  no começo da sessão; a fila de pedidos responde.
- A sessão da VPS roda em sandbox com rede e processos isolados. Ela vê 6
  processos, nenhum da VPS, e não alcança a porta 5180. O que ela enxerga de
  verdade é o disco: `~/projetos` e `~/.claude` são reais.
- Por isso `cockpit status` responde "painel fora do ar" de dentro do sandbox,
  e essa resposta não vale nada: ele testa uma porta que o sandbox bloqueia.
  Não usar esse veredito como diagnóstico.
- O `cockpit set` recusa com "sem job": esta sessão é interativa via Remote
  Control, e o painel só enxerga job de background.
- Só 2 dos 14 projetos clonados na VPS têm quadro de rotas.

**Os dois problemas são diferentes e não podem virar uma solução só.** Duas
sessões na mesma máquina já estão resolvidas pelo disco compartilhado, que é o
Routia de hoje. Entre PC e VPS não há disco comum, e a topologia é torta de um
lado só: o PC alcança `cockpit.carzo.com.br`, a VPS nunca alcança o PC atrás do
NAT. Então a VPS é obrigatoriamente o servidor, e o PC é cliente que empurra e
puxa. Qualquer desenho que ignore isso não sai do papel.

### CC-48 ✅ 15/08 — as rotas viajam no pacote da federação

Hoje marcar rota no PC só chega na VPS depois de commit, push e pull. O quadro
em markdown continua sendo a verdade legível e versionada; o que muda é o canal
de propagação, que passa a ser o painel.

**Feito reusando a federação que já existia, em vez de um canal novo.** O quadro
ocupado entra no pacote (`enxugarRotas`) e `rotasDeTodos()` junta os dois lados
por projeto. Vai só o essencial de cada rota: o quadro do inovallbond passa de
60 KB, quase todo histórico de rota fechada, e o limite do pacote é 2 MB para a
federação inteira.

Duas decisões que ficam no código: **rota ocupada em qualquer máquina conta como
ocupada** (bloquear demais custa uma mensagem, colisão custa trabalho perdido), e
a mesma rota reportada dos dois lados vira uma só, com o sinal mais novo.

⚠️ **Falta a última perna, e ela depende do PC:** o `rota-guard` ainda lê só o
arquivo local. Ele passou a ser versionado em `hooks/routia/` (ver abaixo), que
era o que impedia entregar essa mudança por PR.

### CC-49 ✅ 15/08 — presença deduzida, contra rota esquecida ocupada

A segunda metade da escolha do Felipe. Prova viva do problema, encontrada hoje:
a rota `backlog` está marcada como ocupada por `5805d6bb`, sessão que encerrou o
dia e commitou o fechamento mais de uma hora antes. O quadro mente, e o próximo
agente respeita a mentira.

**Feito**: `src/presenca.mjs` mais `cc routia presenca`. Três vereditos, e o do
meio é o que faltava: `ativa`, `orfa` (marcada por quem sumiu há mais de uma
hora) e `desconhecida`.

**A distinção entre órfã e desconhecida é o cuidado central.** Sessão cujo
transcrito não existe nesta máquina é quase sempre da OUTRA máquina, e chamá-la
de órfã seria afirmar o que daqui não dá para saber. Rodando neste projeto agora,
o `5805d6bb` cai certo nessa caixa: ele rodou no PC.

Nunca libera sozinho, de propósito: um agente pode passar vinte minutos pensando
sem escrever nada, e liberar por silêncio é a colisão que o método existe para
evitar. O limite continua valendo — presença detecta colisão em curso, não
previne a próxima.

Dois detalhes que só apareceram rodando: o corte de uma hora é folgado porque
sessão longa fica muito tempo numa tarefa só; e o exemplo dentro de comentário
HTML do próprio quadro casava todos os critérios, então o painel acusava uma
`feature/checkout` ocupada que nunca existiu.

### CC-56 ✅ 15/08 — sessão interativa reporta o próprio estado

`cockpit set` recusa com "sem job" numa sessão via Remote Control: ele exige um
job de background em `~/.claude/jobs/<id>`, e trabalho pelo celular não cria um.
Consequência medida em 14/08: da VPS não dá para reportar to-do, frente nem
bloqueio no painel, justamente no modo de uso que mais cresceu.

O CC-51 resolveu metade (o painel **enxerga** a sessão). **Agora ela escreve.**

A identidade vem do ambiente, não de adivinhação: `CLAUDE_CODE_SESSION_ID`
existe em sessão interativa e é o nome do arquivo de transcrito (conferido nesta
VPS). A alternativa seria deduzir pelo transcrito mais recente do projeto, que
erra sempre que duas sessões trabalham juntas — o caso comum aqui.

O estado mora em `<casa>/control-center-sessoes/<id>.json`, **fora de
`jobs/`**: sessão interativa não tem pasta lá, e criar uma seria escrever dentro
da casa do Claude Code, que a regra de ouro proíbe. Há teste guardando isso.

`cc set` e `cc done` funcionam iguais nos dois tipos, e o painel lê o estado
pelo mesmo `buildJob` de sempre — sem caso especial espalhado.

### CC-60 ⚠️ REVIRADO em 15/08 — o da porta 3100 é o DEFINITIVO

Achado em 14/08 investigando o escritório: já existe um `pixel-agents` rodando
nesta VPS há mais de dois dias, na **porta 3100**, do usuário **`agente`**, que
é outro usuário do sistema. O `paineis.mjs` o chama de "o agente do Telegram, via
túnel SSH", e o túnel que o PC abria apontava justamente para ele.

Não mexi nele, de propósito: é de outro usuário e está de pé há dias.

**Olhado em 15/08.** O que dá para afirmar:

- É o **mesmo programa e a mesma versão** que o nosso: os dois servem o bundle
  `index-vW13Q-7p.js`. Não é experiência antiga, é uma segunda instância.
- Roda desde **12/08** (`node .../pixel-agents --host 127.0.0.1 --port 3100`),
  usuário `agente`, 1min40 de CPU acumulada. O nosso é a 3101, do `claudedev`.
- **Que agentes ele mostra continua desconhecido**, e por um motivo de
  permissão: ele lê o `~/.claude` do usuário `agente`, e `/home/agente/` recusa
  leitura. Sem sudo não há como responder daqui.

Achado no caminho, e vale para qualquer investigação de rede local: **o sandbox
bloqueia até 127.0.0.1**. A porta 3100 respondia `000` de dentro e `200` de
fora — quem não souber disso conclui que o serviço está morto.

**A resposta dele muda tudo o que estava escrito acima:**

> "esse novo pixel agent é o definitivo, e a ideia é a gente colocar o pc e a
> vps nele ao mesmo tempo. Eu quero que o cockpit seja um serviço no pc e que,
> quando o pc tá ligado, roda esse serviço e eu vejo tudo centralizado no mesmo
> lugar — inclusive quero que o cockpit mostre as coisas que no pc mostra, como
> o limite do Claude por 5h e semanal. Precisamos pensar em como."

Ou seja: **não é lixo de experiência anterior, é para onde isso vai.** O nosso,
na 3101, é que é o provisório.

Três coisas nascem daqui, e duas já têm metade pronta:

**a) O cockpit vira serviço no PC também.** Hoje ele é serviço só na VPS
(`agent-cockpit`, systemd). No PC roda por atalho. `daemon.mjs` já sabe instalar
autostart em Windows — o que falta é ligá-lo à federação, que existe desde o
CC-47 e nunca foi acionada de lá.

**b) O limite de 5h e semanal centralizado — já resolvido, e ninguém ligou.**
`usoDaConta()` (web.mjs) pega a leitura mais recente **de qualquer máquina** e
marca a origem. A razão está registrada: a statusLine **não roda em sessão
Remote Control**, então a VPS nunca coleta esse número; o do PC é tão válido
quanto. Falta só o PC empurrar o pacote.

**c) Os dois Pixel Agents viram um.** Se o da 3100 é o definitivo, o da 3101 é
que sai — não o contrário. Antes de mexer: ele roda como usuário `agente`, e a
pasta dele recusa leitura para o `claudedev`. Migrar exige root, e é decisão de
como os dois usuários convivem.

### CC-52 ✅ 15/08 — o buraco do Routia, medido

**A pergunta certa não era "quantos projetos têm quadro".** O Routia protege
contra duas sessões mexendo na mesma parte ao mesmo tempo; num projeto de sessão
única, não ter quadro não custa nada. "12 de 14 sem Routia" assusta e não informa.

O que informa: **em quantos projetos duas sessões de fato se sobrepuseram no
tempo, sem quadro para se enxergarem.** É sempre um número menor, e acionável.

`cc routia cobertura` responde isso, e a resposta é da MÁQUINA em que roda —
por isso é comando, não linha no painel. Nesta VPS: 3 projetos com sessão, 1 com
quadro, **0 sobreposições**, ou seja, o buraco daqui é teórico. O número que vale
sai do PC, onde os jobs de background rodam em paralelo. Rollout continua manual,
como o Felipe decidiu.

### CC-53 ✅ 15/08 — o gate `npm test` passou a rodar em qualquer máquina

Medido em 14/08: `npm test` morre em `test.mjs:168` com "nenhum job leu o
transcript". O teste exige `readJobs()` devolvendo job real com transcript, e
esta máquina tem um job só. Não é regressão, é o gate dependendo do estado da
máquina de quem roda.

Consequência prática: quem trabalhava pela VPS não tinha gate nenhum.

**Feito, e não era um bloco só: eram cinco**, cada um assumindo algo da máquina
de quem roda. Transcript e base de projetos exigiam job de background; o binário
falso do opencode era `.cmd` com comandos do Windows; o caminho de autostart
exigia a pasta `Startup`; e `projectsBase()` tinha que devolver string, quando
`null` é resposta legítima de máquina sem job.

O padrão do conserto é o mesmo nos cinco: **testar a substância contra dado
sintético**, que roda em qualquer lugar, e manter a checagem contra a máquina de
verdade quando ela tiver o que oferecer — pulando com aviso na tela, nunca em
silêncio.

Dois achados que só apareceram porque o gate voltou a rodar:

1. **Uma regressão minha estava escondida atrás da falha.** `normalizeTodo`
   ganhou o campo `dono` em 14/08 (`4f78264`) e o teste não foi atualizado
   junto. Ninguém viu porque o gate morria antes. Teste que não roda não é teste
   que passa, é teste que some.
2. **O gate escrevia nas notas de verdade do Felipe** para conferir a cópia de
   segurança, restaurando no `finally`. Interrompido no meio, deixava a lista
   vazia — o sintoma exato do apagamento de 09/08, cuja causa nunca foi provada.
   Nasceu daí o `CC_HOME`/`casaClaude()`, que também fecha a armadilha do
   `CONFIG_FILE` que o CLAUDE.md dizia não ter conserto.

### Visão registrada em 14/08: o cockpit vira um framework de engenharia de software

**Visão inteira, com as palavras dele: [[produto/FRAMEWORK]].** Registrada em
14/08 e detalhada na mesma conversa.

**Primeira fatia construída em 14/08**, a pedido dele ("vamos testar"): o gate de
MVP nas quatro peças (método como dado, motor puro, estado no projeto, hook
aplicando). 26 checks passando, ciclo completo rodado de verdade. **Não está
instalado em lugar nenhum**, e ligar exige dois passos deliberados. O que falta
decidir antes de virar produto está no fim do documento, e o item mais sério é o
risco 1: hoje o ciclo roda sem nenhum ponto onde o humano aprova.

O suficiente para decidir se algo do backlog conflita com ela:

- Framework no sentido de Rails ou Django, mas o domínio é o processo de
  engenharia de software. Agnóstico de linguagem.
- **Modo, não questionário.** O modelo mental é o `conda activate`: ligado no
  projeto, tudo que vem depois opera sob ele, e o projeto fica imperativo (segue
  o backlog, executa o MVP, e obriga a criar MVP se não houver). Desligado, a IA
  é a de hoje, o que é desejado.
- **O artefato é para a máquina, não para leitura.** Palavra dele: "eu nunca leio
  a quantidade de documentos". O insight chega destilado pelo cockpit, e é isso
  que separa a ideia do spec-driven do mercado.
- **Scrum, UML e MER são meio, não obrigação.** O rigor mira a definição de
  pronto e a integridade do escopo: chegamos no MVP julgado viável, o prazo e o
  produto final mudaram sem ninguém declarar?
- **O cockpit de hoje continua**, palavra dele: "ele está bom na linha que está".
  É acréscimo, não troca.
- Critério de desenho que vale para toda peça: continua útil para um time de
  humanos sem IA nenhuma?

Terceira camada do produto: o cockpit é a tela, os hooks são o sensor e o gate,
e o framework é o método que os dois servem.

**Backlog de execução fechado em 14/08: [[planos/FRAMEWORK-V1]].** Nove etapas,
em ordem, com a análise conceitual final. Aguardando ordem de implementar.

A primeira etapa (F1, o "modo conversa") nasceu de um erro real do mesmo dia:
no meio de uma conversa que ele abriu com "vamos discutir isso ainda antes de
implementar", eu implementei o glossário e a aba de tarefas. Ninguém mandou
construir; eu tratei resposta de design como ordem de execução. Palavra dele:
"cadê o hook pra impedir você de sair fazendo isso sem eu pedir explicitamente?
esse glossário foi um dos erros (inofensivos) que mostram o problema do sistema
hoje". É a prova do princípio do framework pelo custo mais barato possível: a
instrução existia, era recente, era explícita, e não segurou nada.

**Terceira rodada de decisão, mesmo dia, a partir de um documento externo que
o Felipe trouxe (ata completa em [[../DISCUSSAO-FRAMEWORK-BANCADA]]):**

- **Qual ferramenta usar (UML, Mermaid, qual scanner) é escolha da IA,
  testada, nunca aprovação prévia dele.** "Quem pode testar e me dizer o que
  funciona é você" — e a escolha de quais ferramentas um projeto vai usar
  entra na fase de Definição do framework, junto do MVP, não solta no meio da
  execução.
- **Pergunta com opções fica reservada pra decisão de rumo**, nunca escolha
  de ferramenta ou tática. As perguntas que valeram hoje (quando o sistema
  pergunta, catálogo vs IA, o que é "network", Bancada como gate) eram desse
  tipo.
- **Visão nova, registrada e não implementada: perguntas em rede.** As
  perguntas do framework viajam entre PC e VPS pela federação, viram nó de uma
  rede de decisões com memória entre si, e servem para agentes repassarem
  decisão entre eles. Maior que uma função do gate — vira frente própria
  quando chegar a vez, depois de Framework e Bancada.
- **Visão nova, registrada e não implementada: ponte com outras ferramentas.**
  O framework hoje só existe onde o Claude Code roda, porque o que o segura são
  hooks do Claude Code. Roo Code, Antigravity e IDE local ficam de fora, e o
  Felipe usa mais de uma.

  O que existe já aponta o caminho: o estado mora em `.framework/estado.json`
  **dentro do projeto**, não em `~/.claude`, e o motor (`src/framework.mjs`) é
  puro — sem disco, sem rede, sem IA. Ou seja, a decisão de "pode ou não pode"
  já é portável; o que não é portável é o gatilho. Uma ponte seria dar a cada
  ferramenta o seu próprio gatilho lendo o mesmo arquivo.

  Sem trabalho previsto agora, e a razão de registrar em vez de fazer é a de
  sempre aqui: com uma ferramenta só, ainda não dá pra saber se o modelo de
  fases aguenta duas. **Vira frente quando ele começar a trabalhar de verdade
  em outra ferramenta**, e não antes.

### Decisões dele em 15/08, à noite, sobre as duas frentes grandes

**Bancada:** *"precisa ter todas as camadas, mas poder rodar elas
individualmente"*. Isso muda o desenho: não é escolher quatro para começar, é
**o catálogo inteiro declarado, com execução por camada**. Cada uma sabe se
instalar, rodar e sair — e nada obriga a rodar tudo.

Consequência boa: uma camada que ninguém usa custa uma entrada no catálogo, não
tempo de execução. E o gate do framework passa a poder exigir **uma** camada
específica por método, em vez de "a Bancada inteira".

**Telas:** *"todas, mas vai me perguntando — vamos aplicar o framework de fato
nesse trabalho"*. As onze, uma por vez, e **usando o método `conserto` ou o
`estudo` de verdade**, não só como assunto. É o primeiro uso do framework num
trabalho real com ele acompanhando, que era justamente o que faltava.

### ✅ Bancada, primeira fatia 16/08 — o catálogo inteiro, rodando uma a uma

Decisão dele em 15/08: *"a bancada precisa ter todas as camadas, mas poder rodar
elas individualmente"*.

**19 camadas declaradas, 4 rodando hoje.** As 15 restantes aparecem no catálogo
com o que pegariam e a ferramenta prevista — e **recusam com honestidade** se
alguém tentar rodar, em vez de fingir sucesso.

```
cc bancada                      o catálogo, agrupado
cc bancada rodar segredo        roda uma camada
cc bancada rodar <declarada>    diz o que falta, e não finge
```

**Declarar sem implementar tem valor próprio**, e é o motivo de estar assim: o
catálogo vira **o mapa do que existe para verificar**, não a lista do que eu
consegui escrever num dia. Ele decide o que ligar olhando o todo.

Conferido rodando: `segredo` varre este projeto e não achou nada;
`segredo-historico` recusa dizendo que o Gitleaks é a ferramenta prevista.

**O gate guarda a distinção que mais podia machucar:** `implementada` tem que
bater com a existência real da função. Prometer execução que não existe é o pior
defeito possível numa ferramenta de verificação — ela diria "está limpo" sem ter
olhado. Achou também um grupo duplicado (`dado` e `dados`), que faria a tela
mostrar duas seções para a mesma coisa.

#### ✅ Mais três camadas, 16/08 — e nenhuma precisou de ferramenta externa

Nenhuma das ferramentas previstas está instalada nesta VPS (Gitleaks, Trivy,
Semgrep, Nuclei). Três camadas saíram assim mesmo, com o que já existe:

**`segredo-historico`, com `git log -G` no lugar do Gitleaks.** O git sozinho
acha o commit que INTRODUZIU um padrão, que é o essencial. Existe separada da
camada de código por um motivo que vale repetir: **apagar o arquivo não apaga o
commit** — um segredo removido ontem continua clonável hoje, e este repositório
é público. Rodou aqui: nada encontrado.

**`service-role`, a chave que ignora todas as regras do Supabase.** Procura onde
ela nunca pode estar: pasta que vira navegador. `.env` fica de fora de propósito
— lá a chave é legítima, e acusá-la seria o alarme falso que faz desligar a
camada. Rodou no inovallbond e achou uma menção real em `openapi.json`,
classificada como média (menção, não exposição).

**`tls`, com o `node:tls` no lugar do testssl.sh.** Faz o que mais dói na
prática: dizer quanto falta para o certificado vencer. Renovação automática
falha em silêncio e o site cai no sábado.

**Os domínios saem do retrato da VPS que já existia** — o `serverName` do nginx.
E aí veio o defeito que o teste pegou: o nginx põe vários domínios na mesma
linha (`ahtleta.com.br www.ahtleta.com.br`), e passar a linha inteira como
endereço deu dois falsos positivos de "domínio fora do ar". Com o split, os 17
domínios respondem e o mais próximo vence em 69 dias.

#### O que falta

Implementar as 12 restantes — todas dependem de ferramenta externa instalada. E
a decisão que já estava registrada: **a Bancada vira gate do framework**, com o
"pronto" da fase de Verificação exigindo camada rodada, não só critério marcado.

### Frente: Bancada — auditoria e teste agnóstico, ver [[produto/BANCADA]]

Registrada em 14/08, a partir do mesmo documento externo. **Não implementada.**
O cockpit instala o instrumento de teste no projeto, dispara, mostra o
resultado, desinstala — o projeto não ganha CI próprio.

O suficiente para decidir se algo do backlog conflita:

- **Vira gate do [[produto/FRAMEWORK]]**: "pronto" provavelmente vai exigir
  pelo menos a camada de segredo rodada, não só os critérios do MVP marcados.
- Catálogo de 17 camadas, quatro marcadas como ponto de partida (CVE Lite,
  Gitleaks, Sandyaa, Playwright), o resto desligado até virar objeto novo no
  catálogo — sem código de runner extra.
- O diferencial é código nosso, não ferramenta de prateleira: sonda de RLS do
  Supabase, caça a `service_role` vazado no bundle, sonda de zona restrita sem
  sessão. Nenhuma ferramenta pronta faz essas três.
- **O painel não tem job assíncrono hoje**, e a Bancada precisa de um
  (progresso, cancelamento, resultado que sobrevive ao clique). Reusa o único
  precedente do repo, `dispararTarefa()` do `opencode.mjs`.
- **Mesmo risco do systemd achado hoje com o Pixel Agents** (CC-62): reiniciar
  o painel mata processo filho em corrida longa. Registrado, não bloqueia.
- Aba própria, "bancada", ao lado de tempo/preço/servidores.

### Frente: Cockpit de retomada de contexto — ver [[produto/COCKPIT]]

Reposicionamento do produto pelo Felipe em 12/08: **os hooks não são o
produto, são sensor** — o produto é o painel virar o lugar onde ele volta ao
contexto rápido, gerenciando 4-5 projetos em paralelo. Isso muda o critério
de sucesso de qualquer sinal: não é "impõe boa prática", é "me faz voltar ao
contexto mais rápido?". CC-32, CC-33, CC-34 e CC-35 feitos em 13/08; CC-36 e
CC-37 seguem abertos.

### Frente: Ciclo Felipe → IA → Felipe — ver [[produto/CICLO]]

Análise de 13/08 sobre 235 mensagens reais dele em 5 projetos, mais 43 pastas
de memória. Dez padrões com evidência medida. O diagnóstico: o problema não é
falta de regra, é **excesso de regra dispersa** — 4 seções OBRIGATÓRIO no
global, ~30 memórias comportamentais em 15 projetos, ~60 armadilhas, com 6
contradições convivendo sem desempate. E as regras de maior retorno estão
presas em memória de um projeto só.

Critério de ordem, o mesmo do [[produto/COCKPIT]]: **isso me faz voltar ao
contexto mais rápido, ou economiza uma volta do ciclo?**

## Limites aceitos hoje

Escritos aqui porque são escolha, não descuido:

- **Toggle de hook nunca escreve no `settings.json` do Claude Code** (CC-27,
  Épico 1 do framework de hooks, 12/08). `cc hooks on|off <id>` só grava em
  `control-center.json` — o hook em si (script em `~/.claude/hooks/` ou
  dentro de `cc.mjs`) continua registrado ou não no `settings.json`
  independente disso, e cada hook checa o toggle sozinho antes de agir
  (mesmo contrato de `isEnabled()`). Por isso a aba "hooks" mostra um badge
  "registrado"/"não registrado" separado do liga/desliga: ligar aqui um hook
  que não está no `settings.json` não faz nada, e o badge existe pra isso não
  ser silencioso. Escrever `settings.json` programaticamente é a decisão D1
  do backlog (`produto/FRAMEWORK-HOOKS.md`), ainda em aberto.
- **Projeto sem `docs/ROADMAP.md` não ganha escrita direta do painel** (CC-18,
  decidido 12/08). O painel nunca escreve `docs/ROADMAP.md` sozinho na pasta
  de outro projeto — seria o Control Center mudando disco de um repositório
  de fora sem revisão nenhuma. Em vez disso, o mapa vazio ganhou um botão
  que cria um to-do (`gravarTodos()`, o mesmo caminho que os checkboxes da
  aba to-dos já usam) no job aberto: "criar `docs/ROADMAP.md` deste projeto,
  seguindo a estrutura do projeto-template". Um agente de verdade lê esse
  to-do depois e decide como escrever, com a revisão normal de qualquer
  código gerado — o painel só aponta o problema, não resolve sozinho.
- Polling de 2s nas duas telas. Com dezenas de jobs, reler 8 arquivos é mais
  barato que a complexidade de `fs.watch`. Revisar se passar de ~100 jobs.
- A aba de tempo só recalcula cortes a partir de 2 minutos. O cache guarda
  blocos contíguos desse grão; cortes menores exigiriam guardar cada marca de
  tempo (dezenas de milhares por projeto) pra ganhar uma precisão que ninguém
  usa pra cobrar.
- O tempo ativo conta agente rodando sozinho como trabalho, e não conta tempo
  lendo código ou em reunião. É a medida que o transcript permite; melhorar
  exigiria o Felipe marcar ponto, que é pior que o erro.
- A taxa em R$ é uma só por projeto, sem histórico. Reajuste no meio do projeto
  recalcula tudo pela taxa nova. Guardar taxa com data de vigência resolveria,
  e é complexidade que só se paga quando um reajuste acontecer de verdade.
- O repositório é público com os nomes de cliente e as horas de cada um no
  diário de 06/08. Decisão do Felipe em 08/08, com o conteúdo na mão.
- O custo em real usa a cotação de hoje, inclusive para trabalho de semanas
  atrás. Converter cada dia pela cotação daquele dia exigiria série histórica
  de câmbio, para mudar um número que é referência de esforço, não fatura.
- A barra de mídia consulta a cada 4s, fora do stream de 2s dos agentes. Cada
  leitura custa ~0,5s no Windows, e pendurar isso no tique dos agentes atrasaria
  o que o painel tem de mais importante.
- O painel passou a ATUAR na máquina (pausar mídia, mexer em volume de app),
  além de encerrar servidor. Continua não mexendo em agente: criar, matar ou
  pausar job segue fora de escopo.
- A sobra usa a assinatura rateada pelas horas do mês, não o preço de API.
  Filtrar meio mês infla o custo/hora daquele mês: o rateio só enxerga as horas
  dentro do recorte. Guardar o total de horas do mês fora do filtro resolveria,
  ao preço de o número mudar conforme o que está na tela.
- A assinatura é um valor só, sem histórico. Mudança de plano recalcula meses
  antigos pelo valor novo. Mesma decisão da taxa horária: data de vigência só
  se paga quando houver uma mudança real.
- O rateio do tempo entre tarefas da mesma sessão continua por igual, mesmo com
  o `feitoEm` carimbado. Usar os carimbos para dividir por intervalo só vale
  quando houver sessões inteiras marcadas item a item — hoje há uma. Revisar
  quando o hook tiver uma semana de uso.
- O histórico guarda o job, não o transcript. Se o Claude Code apagar o `.jsonl`
  da sessão, as horas daquele job somem mesmo com o job arquivado. Copiar
  transcript seria dobrar 800 MB para ganhar pouco.
- O nível de senioridade é palpite a partir de esforço, não de entendimento do
  problema: uma tarefa difícil resolvida em duas linhas parece fácil. Por isso
  a sugestão é corrigível e a correção vence para sempre. Melhorar de verdade
  exigiria classificar o conteúdo do trabalho, não seus sinais.
- O valor/hora vem de duas páginas de blog raspadas. É referência de freelance
  no Brasil, não pesquisa salarial: pode envelhecer sem aviso, e a tela mostra
  a fonte e a idade justamente por isso.
- Por sessão, a média inclui sessões de recado ("rode o server por favor") ao
  lado de sessões de trabalho longo. Filtrar as curtas mudaria a média para
  cima; deixar é mais honesto, já que recado também consome tempo.
- Os gráficos não têm filtro próprio. Período e corte de ociosidade vêm da aba
  de tempo, e valem para todos os cartões de uma vez. Filtro por cartão seria
  outro estado por gráfico, para uma pergunta que ainda não apareceu.
- Categoria é texto livre, sem lista fechada — vocabulário novo nasce sem
  precisar mexer no código.
- `todos` substitui a lista inteira em vez de fazer merge item a item. Evita
  duplicata; o preço é o agente precisar mandar a lista completa.
- **Mídia e sensores são só Windows.** `midia.ps1` usa SMTC e WASAPI; a GPU usa
  `nvidia-smi`. No macOS o caminho seria `MediaRemote`/AppleScript; no Linux,
  MPRIS via D-Bus. Não é tradução — são três implementações. Fora do Windows a
  barra do player e os módulos simplesmente não aparecem.
- Temperatura de CPU e de memória dependem do LibreHardwareMonitor ABERTO. Sem
  ele o Windows não expõe esses sensores, e o campo some da tela em vez de
  mostrar zero. O código já lê de lá quando existe.
- Ler os sensores deixa um buraco de ~300ms no event loop, por causa do spawn
  de processo no Windows. Era de 2,7s antes do `quietAsync`. Aceitável a cada
  5s; se incomodar, o caminho é amostrar em background e servir só o cache.
- O mapa lê só `##` (grupos) e `###` (frentes) do ROADMAP.md, e conta item de
  lista. Parágrafo solto é explicação, não tarefa — por isso não entra na conta.
- **O painel passou a SUBIR servidor**, e com isso executa comando na máquina.
  A trava é a pasta: só dentro da base de projetos, ou de um caminho que
  contenha uma pasta de `CC_PROJECT_DIRS`. Não há lista fechada de comandos —
  o campo é editável de propósito, porque projeto real sobe de jeito que
  nenhuma lista adivinha. Continua valendo que agente não se cria nem se mata
  pelo painel.
- Servidor duplicado é o MESMO tipo no MESMO projeto, e fica o mais recente.
  `next` e `vite` lado a lado não contam: monorepo sobe os dois de propósito.
  Quem vai morrer aparece na tela antes do clique de confirmação.
- Apelido e explicação de servidor são editados por `prompt()` do navegador,
  não por campo na página. Não é preguiça: `render()` reescreve o `#main` a
  cada evento do stream, e um campo de texto ali perderia o cursor no meio da
  digitação — a mesma razão pela qual as notas moram fora do `#main`.
- "Recentes" nasce da varredura, não de histórico próprio: a primeira vez que
  um servidor com pasta é visto, o par pasta+comando vai pro config. O carimbo
  só se renova a cada hora, senão seriam quatro escritas por minuto.
- A lista de "por pasta" só oferece scripts que sobem algo (`dev`, `start`,
  `serve`, `preview`, `watch`). Projeto que sobe com outro nome de script não
  aparece — o comando é editável antes de subir, e é por ali que se resolve.
- **Processos que mais consomem (CPU/RAM/VRAM) não roda em timer, nunca.**
  Medido nesta máquina: `Get-Process` de 596 processos leva entre 19s e 29,3s
  — variando de chamada pra chamada, um timeout de 30s quase estourou de
  verdade. Só carrega sob clique ("ler processos" / "atualizar"), igual a
  VPS. O bloco no PiP usa a última leitura guardada; abrir a janelinha com
  "processos" ativo dispara uma leitura, mas só essa vez.
- **VRAM por processo não é "uso de GPU" — é só memória.** `nvidia-smi` não
  expõe percentual de utilização por processo em placa de consumo, só quanto
  de vídeo cada um está segurando. Rotulado como VRAM na tela de propósito,
  pra não prometer o que a placa não entrega.
- A aba VPS também nunca atualiza sozinha — mesma decisão dos processos, e
  pelo mesmo motivo maior: usa a chave privada do Felipe pra entrar num
  servidor de produção. Host, usuário e caminho da chave ficam no
  `control-center.json` desta máquina, não no código — o repositório é
  público, e são dados específicos de quem está rodando.
- O organograma da VPS liga nginx a Docker por NÚMERO DE PORTA (a de FORA do
  container, do `proxy_pass`), não por nome. PM2 fica fora do cruzamento:
  `pm2 jlist` não expõe a porta que o processo escuta, e inventar o link
  seria mentira bonita — melhor mostrar sem link do que linkar errado.
- O vínculo agente↔roadmap é pelo TÍTULO da seção, não por ID. Dos 43 roadmaps,
  só 6 têm IDs; numerar todos seria trabalho grande para pouco ganho, e ID
  envelhece quando a lista muda.

---

Última atualização: **2026-08-12** — cockpit de 10/08 commitado (estava
pendente), e CC-20 (calendário) fechado. Ver [[../diario/2026-08-12]].

Aberto: CC-21 (escrita na agenda, próximo da frente de conteúdo social), mais
CC-04, CC-08 e CC-14 (do Felipe — conferir no tray, não é bug deste projeto).
