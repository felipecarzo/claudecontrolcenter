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

### CC-76: prévia de cada página antes de mexer

Pedido dele: *"me mande aí também uma prévia de cada página"*. O caminho já foi
provado hoje com a aba VPS — arquivo HTML com o CSS de verdade e os dados reais,
que ele abre no celular. **Não dá para tirar print daqui**: o Chrome desta VPS
exige um token que mora numa pasta de root, e o hook de segredo bloqueia a
leitura, corretamente.

São 15 abas. A prévia é por aba, e ele aprova antes de qualquer mudança.

### CC-77: cara de aplicativo no estreito

O guarda-chuva dos três acima, e o que ele pediu por último. **Só vale para a
largura estreita**; no monitor largo, a decisão dele é deixar como está.

O que "cara de aplicativo" quer dizer, tirado do que ele reclamou: alinhamento
(hoje os nomes dançam), navegação de um nível em vez de duas fileiras de abas,
e o dado aparente sem precisar rolar de lado.

**Depende do CC-76:** ele quer ver antes de eu mexer.

#### O que falta

Aplicar às outras telas, uma por vez, e só depois de a VPS provar valor no uso
de verdade. A regra 2 tem um teste objetivo esperando: cruzar o texto da tela
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

### CC-78: o quadro de rotas vira tela, e dá para mexer

Hoje `docs/ROTAS-ATIVAS.md` tem **336 linhas** e é lido abrindo o arquivo. A
ideia dele é ver, por projeto, em que rota cada um está — e **mudar o estado
clicando**: *"aquelas bolinhas verde, vermelho, azul (…) se eu clicar ela fica
vermelha, se eu clicar ela fica azul, se eu clicar fica verde de novo"*.

**Três perguntas em aberto, e nenhuma é detalhe:**

1. **O que é o azul?** O quadro hoje tem dois estados (🟢 livre, 🔴 ocupada) mais
   o ticket. Um terceiro precisa de significado antes de virar cor — "em
   revisão"? "minha, mas parada"? Cor sem significado vira enfeite.
2. **Quem vence quando os dois escrevem?** Se o painel edita o markdown enquanto
   um agente edita o mesmo arquivo, é a colisão que o Routia existe para evitar,
   acontecendo no próprio Routia. Ideia a testar: o painel escreve num arquivo
   ao lado e o markdown continua sendo gerado, nunca editado à mão pelos dois.
3. **O clique libera rota de outra sessão?** O CC-49 decidiu que silêncio não é
   liberação. Um botão que libera com um toque desfaz essa decisão sem querer.

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

### CC-67: `cc hooks install` — o gancho nasce com o projeto

**O mais urgente dos seis**, e a prova está no HANDOFF de hoje: dois hooks novos
estão esperando ele registrar à mão no `settings.json` do PC, com caminho `D:/`.
Enquanto isso o padrão de resposta vale só na VPS.

O husky resolveu exatamente isto: gancho de git não é versionado, então cada
máquina teria que instalar sozinha. Aqui é pior, porque o `settings.json` é
global e o caminho muda de máquina.

Já existe metade: `hooksRegistro.mjs` sabe **ler** e dizer se um hook está
registrado. Falta escrever, com o cuidado de sempre — merge, nunca substituir o
arquivo, que é o mesmo cuidado do `install.mjs` com o CLAUDE.md.

### CC-68: catálogo de métodos, não um só

`mvp-basico` e `entrega-cliente` são os dois presets que existem, e o segundo
mal foi usado. O pre-commit tem centenas porque **quem adota escolhe**, e a
escolha é de três linhas.

Ligado ao que já está registrado: "mais de um método é o que prova que o método
é dado e não código" ([[produto/FRAMEWORK]]), e a [[produto/BANCADA]] é o
embrião do catálogo pelo lado das ferramentas de verificação.

### CC-69: níveis declarados, em vez de cada hook decidir sozinho

O Danger tem `fail`, `warn` e `message`, e a regra diz qual usa. Aqui cada hook
resolve no próprio código: o `framework-guard` recusa com exit 2, o
`roadmap-guard` avisa, o `todo-guard` avisa. A escolha está certa em todos, mas
está espalhada — não dá para olhar num lugar e saber o que trava e o que fala.

Ganho real: o `hooksCatalogo.mjs` passaria a dizer o nível junto do resto, e o
painel poderia mostrar "3 travam, 4 avisam" sem ler código.

### CC-70: `cc framework check` — rodar o gate sem esperar o gatilho

`pre-commit run --all-files` existe porque gate que só roda no gatilho não
responde "como está o projeto agora?". Aqui é a mesma falta: para saber se um
projeto passaria, é preciso tentar editar um arquivo e ser recusado.

Serve para três coisas: conferir antes de começar, rodar em CI, e alimentar o
painel com o estado real de cada projeto em vez do estado registrado.

### CC-71: agir só no que mudou

`lint-staged` roda só nos arquivos alterados, e é o que torna o hook rápido o
bastante para ninguém desligar. Nosso equivalente ainda não tem uso claro — o
gate de fase não olha arquivo — mas passa a ter no dia em que a Bancada virar
gate: rodar a camada de segredo no repositório inteiro a cada entrega é o tipo
de lentidão que faz o Felipe desligar o recurso.

**Registrado como direção, não como tarefa:** sem a Bancada ligada, não há o que
otimizar, e otimizar antes seria inventar problema.

### CC-72: sincronizar as regras, em vez de copiar à mão

O CC-65 versionou os seis hooks globais e deixou dito em negrito que é **cópia,
não fonte**: mexer no repositório não muda o que roda. O `pre-commit autoupdate`
resolve isso do lado deles.

Aqui seria `cc hooks sync`: comparar o que está em `hooks/routia/` com o que está
em `~/.claude/hooks/`, mostrar a diferença e sincronizar sob clique. O
`rotinas.mjs` **já faz exatamente isso** para os comandos `/algo` copiados dentro
dos projetos, incluindo a normalização de CRLF que custou tempo lá — é código
para reusar, não para reescrever.

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

### CC-60 — o outro Pixel Agents: as perguntas factuais, respondidas

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

**Continua sendo decisão do Felipe:** mostrar como segundo escritório, ou
desligar. O proxy já sabe servir por porta; o que falta é ele dizer se dois
escritórios na mesma tela fazem sentido.

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
