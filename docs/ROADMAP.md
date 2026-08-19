---
tags: [processo]
tipo: roadmap
atualizado: 2026-08-17
estado: 15 abertos (CC-133 a CC-138 nasceram em 17/08 da varredura de ideias, mais CC-124, CC-129 e as 7 frentes grandes); 2 parados por decisão dele ou por ambiente
resumo: Só o que está aberto neste projeto. Concluído sai daqui e vira linha no diário. Em 16/08 saíram 37 itens fechados e o arquivo caiu de 2033 para ~547 linhas.
termos:
  frente: um bloco de trabalho com nome próprio, que o painel mostra como pastilha no cartão
  CC-nn: um item numerado. O número não indica ordem nem prioridade, só a ordem em que nasceu
---

# ROADMAP — o product backlog deste projeto

Só o que está **aberto**. Concluído sai daqui e vira linha no diário.

## Os três níveis, e o que cada um responde

Nomeados em 16/08 a pedido dele: *"nao se chamou de product backlog tambem, e
tambem nao temos exatamente uma definição de pronto, e isso quebra praticamente
todo o projeto"*. O vocabulário é o do Scrum, que ele já domina.

| nível | onde vive | responde |
|---|---|---|
| **product backlog** | este arquivo | o que existe para fazer, sem dono de tempo |
| **sprint backlog** | aba `sprint` do painel | o que está sendo feito AGORA, por qual agente |
| **definição de pronto** | campo `prova` de cada to-do | como se sabe que acabou, e o que apareceu |

**A definição de pronto é por tarefa, não por projeto.** O `mvp.criterios` do
framework continua valendo para o projeto inteiro; o que faltava era o nível de
baixo. Sem ele, "feito" era opinião do agente — e o `pronto-guard` devolve
quando um to-do fecha sem prova.

Os três se ligam por derivação, nunca por cópia: o `frente` que o agente escreve
no painel é o título de uma seção **deste** arquivo, e é isso que faz o cartão
dele dizer `projeto › frente` em vez de texto solto.

> **Vai executar alguma destas tasks?** Os planos estão em [[PLANOS]], um
> arquivo por task em `docs/planos/`. Eles dizem onde mexer, o que reusar e
> quais das armadilhas do `CLAUDE.md` se aplicam. Escritos em 13/08 por uma
> sessão Opus, justamente para as sessões de execução não precisarem redescobrir
> isso.

## Aberto

## ▶ Frente nova, aberta em 18/08 (PC): a VPS vira o servidor, o resto vira dado que chega nela

Ideia dele, dessa vez trazida pela sessão do PC: *"a minha ideia (aliás, sua
ideia) é transformar o cockpit na VPS como servidor (pra ficar fulltime
online) e o PC e outros dispositivos que eu instalar ficarem como dados
adicionais. Ex: meus backlogs etc vão ficar alinhados com o projeto que eu tô
mexendo, os mds desses projetos, porém se eu desligar o PC fica salvo lá no
projeto o último backlog baseado na última update do git, de forma que se eu
ligar o Claude na VPS e ativar o projeto na VPS pelo cockpit eu atualizo os
backlogs de novo (...) assim eu vou estar sempre bem atualizado e sincronizado
sempre usando o git como segurança, e sempre mantendo o commit antes de migrar
de dispositivos. A ideia é que os hooks também funcionem aqui no PC, o
framework, etc, e que dê pra ver os dados do Claude Code como o limite de
tokens de 5h e semanal. Outra coisa que eu quero é mixar os dados de uso, e
tudo das abas de tempo uso etc e mesclar com o da VPS, não sei a melhor forma
de fazer isso mas não faz sentido manter eles separados, precisamos armazenar
esses dados pra eles serem somados."*

Registrado como visão, não como tarefa — é desenho de sistema, e a forma é
dele decidir quando chegar a vez. Antes de propor qualquer coisa nova, o que
já existe e resolve parte disso:

- **A federação já é assimétrica do jeito certo.** `src/federacao.mjs` (CC-47
  a CC-58) já assume a VPS como servidor e o PC como quem empurra — a
  topologia é torta por NAT, não por escolha, e está documentada lá. O pacote
  já soma horas e tokens entre máquinas com a quebra por origem (tem teste
  cobrindo).
- **O PC nunca chegou a se conectar.** Existe ticket aberto desde 14/08 em
  `docs/ROTAS-ATIVAS.md` (rota `sincronia`) com o passo a passo: nome da
  máquina, token, endereço de destino, botão enviar. Ninguém executou esse
  passo ainda — é a peça que falta pra tudo que já foi construído passar a
  aparecer de verdade.
- **Hooks e framework têm o mesmo furo, outro ticket já escrito** (rota
  `framework`, 14/08): o hook do MVP está no repositório e chega no PC pelo
  `git pull`, mas não liga sozinho — falta registrar no `settings.json` do PC
  (não é versionado) com o caminho certo do Windows, e o
  `.framework/estado.json` de cada projeto **já viaja no commit**, então essa
  parte já é git-nativa.
- **O limite de 5h e semanal já é lido no PC** (`src/uso.mjs`), sem chamada de
  rede: vem do `rate_limits` que o próprio Claude Code manda pro statusLine, o
  mesmo número do `/usage`. Mas é a MESMA conta nas duas máquinas — então
  misturar aqui não é somar, é mostrar a leitura mais recente de QUALQUER
  máquina, porque o limite é da conta, não do computador. Somar dobraria o
  número.

O que ainda não existe, e é onde a decisão de forma fica em aberto:

### CC-159 ✅ 18/08 (PC) — ligar o PC na federação de verdade

Nome da máquina (`ALIENWARE-LIPE`) e o token da VPS (lido de lá por SSH,
read-only) gravados no config do PC via `setMaquina`/`setFederacao`, sem
precisar do painel no ar — as duas são funções puras sobre o arquivo de
config. `enviarPara: https://cockpit.carzo.com.br`.

**No meio do caminho, dois achados que não estavam no ticket original:**

1. **`cockpit-auth` bloqueava o próprio mecanismo que o painel já esperava
   ter.** `curl` contra `/api/federacao` com o `x-cc-token` certo voltava
   `401 nao autenticado` — a porta de entrada com senha (5181) barra tudo que
   não tem cookie de sessão de navegador, mesmo o endpoint que já tinha
   autenticação própria por token. O comentário do `web.mjs` já dizia a
   intenção ("quem fala aqui é outro painel, não um navegador"); só o
   `cockpit-auth` nunca tinha sido ajustado pra cumprir. Decisão dele:
   **isentar só `/api/federacao`, só POST**, do gate de senha — o token
   próprio continua obrigatório, então nada abre pra quem não tem ele.
   Aplicado em `~/cockpit-auth.mjs` na VPS (backup datado antes de mexer),
   serviço reiniciado matando o processo (roda como `claudedev`, sem sudo,
   `Restart=always` sobe sozinho com o código novo). Conferido nos três
   sentidos: federação com token → 200; federação sem token → 401 (do
   painel, não do gate); resto do painel sem cookie → continua pedindo senha.
2. **`snapshot()` quebrava com `TypeError` toda vez que o PC tentava
   empurrar**, silenciosamente — o `.catch(() => {})` do timer engolia. Causa:
   `config.json` deste PC tinha duas entradas velhas em `paineis`
   (`{id:"local"}`, `{id:"vps"}`, sem `cmd`) que não são mais deste esquema há
   tempos; `resolverBinario` fazia `path.join(homedir, ..., undefined)` e
   lançava. Consertado na função (`src/paineis.mjs`): `cmd` que não é string
   devolve `null` em vez de derrubar quem só queria saber se o painel existe
   — vale para qualquer entrada malformada futura, não só esta. As duas
   entradas velhas foram removidas do config local.

**Provado de ponta a ponta**, não só por curl solto: `node cc.mjs --web-only`
local, `POST /api/federacao/enviar` (a mesma rota que o timer de 30s chama
sozinho) devolveu `{"ok":true,"status":200}`, e o pacote real
(`945e1d0c.json`, `ALIENWARE-LIPE`, com o job desta sessão dentro) apareceu em
`~/.claude/control-center-federacao/` na VPS. Pacotes de teste limpos depois.

### CC-160 ✅ 18/08 (PC) — hooks e framework ligados no PC

`cc hooks sync` + `cc hooks install` (comandos que já existiam, CC-67/CC-72,
nunca tinham sido rodados aqui): 31 hooks copiados de `hooks/` pro
`~/.claude/hooks` do PC, 29 registrados no `settings.json`
(`settings.json.bak` guardado antes de escrever). Antes só 5 dos 34 hooks do
catálogo estavam instalados — `rota-guard`, `git-add-guard`, `cc-check`,
`routia-inicio`, `routia-fim`. Faltavam TODOS os que travam escrita, gate do
framework, diário e o resto do Método Routia.

O `.framework/estado.json` deste projeto já dizia `ligado: true, fase:
execucao` — o gate nunca tinha o que fazer aqui porque o hook que o aplica
(`gate-guard`, sucessor do antigo `framework-guard` da ata de 14/08) nunca
tinha sido registrado no PC. Agora está. **Só vale a partir do próximo
`/hooks` ou reinício da sessão** — o próprio `cc hooks install` avisa disso, e
é o Claude Code que recarrega hook registrado no meio de uma sessão, não o
cockpit.

### CC-164 ✅ 18/08 (PC) — o framework saiu do lugar errado, e o ruído sumiu

*"por favor mude os framework de lugar, já falei isso algumas vezes e tá me
incomodando muito, pra mim ele não faz sentido aparecendo onde tá e não faz
sentido aparecer um monte de projeto desativado, tudo com framework desativado
porque nem no remoto tá ligado"*.

**Registrado como falha de processo, não só de tela: é a terceira vez.** O
código já confessava o problema — o comentário em `ui.html` diz que o botão
"módulos por projeto" foi parar no topo da tela de trabalho porque *"a vista
antiga do cockpit tinha o botão e morreu órfã no redesenho"*. Foi remendo pra
não perder o acesso, e nunca virou decisão de lugar.

**Onde ele quer, e são dois lugares (palavras dele):**

1. *"na aba de projetos, dentro de cada projeto > ATIVO <"* — o framework
   deixa de ser uma lista global de todos os projetos da máquina e passa a
   aparecer dentro do projeto, e só de projeto ativo.
2. *"em remoto nós vamos ver todas as sessões abertas separadas pelo local
   onde estão abertas. Os da VPS, os do desktop etc."*

**Qual projeto conta como "ativo":** *"os projetos ligados em uma sessão de
Claude Code, agy ou opencode ficam destacados, e esses ganham a opção de ligar
o framework ou não."* Projeto sem sessão nenhuma não aparece — é a causa do
"monte de projeto desativado" que ele viu no print.

**A tela de framework separada, se existir, é outra coisa:** *"na tela de
frameworks se tivermos uma, que seria interessante um cockpit só pra controlar
os frameworks mais rápido, nesse só apareceriam os frameworks"* — ou seja, uma
tela dedicada onde SÓ há framework, nunca a lista de tudo.

**Mesmo projeto em duas máquinas:** *"isso raramente vai acontecer e se
acontecer um dia vai ser pra dividir stacks, então a gente diferencia pela
stack (frontend, backend, jogo etc) e declara onde tá hospedado (VPS, Desktop
etc)"*. Fecha o CC-162 desta frente por decisão: não é merge, é rótulo.

#### ✅ Feito em 18/08

**Três mudanças, e a que mais valeu não escreveu tela nova.**

1. **A lista deixou de mostrar o disco e passou a mostrar o trabalho.** Corte:
   sessão viva ou framework ligado. Medido na rota de verdade depois do
   conserto: **23 projetos no disco, 4 à mostra, 19 atrás de um botão que diz
   quantos são.** Quem tem framework ligado continua à vista mesmo parado,
   senão desligar um projeto o faria sumir sem jeito de religar.
2. **O framework foi para dentro do projeto ativo**, na aba que ele já usa.
   `seloFramework()` **já existia e estava órfã**: definida, nunca chamada,
   desde que a vista antiga do cockpit morreu no redesenho. Não era tela
   faltando, era tela desligada. Ela voltou por cima do alternador de
   planilha/quadradinhos, e não dentro de um deles: a primeira tentativa
   entrou só no ramo dos quadradinhos e **não apareceu na tela dele**, que usa
   planilha. Só o print pegou isso.
3. **A aba remoto agrupa por máquina**, com as sessões das outras máquinas
   listadas mas sem botão de ligar: a VPS não alcança este PC atrás do NAT, e
   botão que promete o que não cumpre é pior que ausência. Ver CC-166.

**CC-162 e CC-163 já estavam prontos, e ninguém sabia.** `usoDaConta()` já
escolhia a leitura mais recente entre as máquinas sem somar (que é a regra
certa: o limite é da conta), e `mesclarTempo()` já somava horas e tokens com
quebra por origem. Os dois nunca tinham rodado de verdade porque **o PC nunca
tinha se federado** — o CC-159 os ligou sem escrever uma linha. Conferido na
VPS: `ALIENWARE-LIPE` aparece como máquina remota online, 15 jobs, pacote de
13 segundos atrás, com o uso do plano do PC dentro.

### CC-165 🚧 metade feita, 18/08 (PC) — o serviço que mantém tudo no ar e varre os projetos sozinho

**Feito: a tela responde "está mesmo sendo enviado?".** Era pergunta dele, sem
resposta na tela: *"como garantimos que tá tudo sendo vigiado e enviado pro
cockpit na VPS?"*.

O timer de 30s engole o erro de propósito (`.catch(() => {})`), senão uma
queda de rede derrubaria o painel. Mas engolir **sem registrar** é o mesmo
defeito do `total: 0` do CC-124: silêncio com cara de sucesso. Agora o
resultado do último envio fica guardado e aparece no bloco do painel federado,
com o erro por extenso quando falha.

Duas linhas, porque são duas perguntas que podem discordar:

- **o último envio funcionou?** (quando, para onde, quantos agentes, se as
  horas foram junto);
- **este painel volta sozinho quando a máquina reinicia?** Um pode estar certo
  com o outro errado, e aí o dado para de fluir amanhã sem nada avisar hoje.

Medido no painel de verdade: `✓ último envio 0m atrás para
cockpit.carzo.com.br, com 15 agentes e as horas` e `✓ este painel sobe sozinho
quando a máquina liga`.

**Falta o resto do pedido dele:** *"fazendo uma varredura nos projetos onlines
e nos seus backlogs"*. O pacote leva agentes, uso e horas, nunca o conteúdo do
backlog de cada projeto. Depende do CC-161 (git como transporte) para não
criar duas fontes de verdade sobre o mesmo `ROADMAP.md`.

**O pedido inteiro dele, para o que ainda falta ser medido contra ele:** *"por
isso eu sugeri serviço, porque ele ficaria on o tempo todo e o cockpit
reconheceria o serviço e manteria atualizado tudo fulltime fazendo uma
varredura nos projetos onlines e nos seus backlogs"*.

### CC-166 ✅ 19/08 (PC) — abrir sessão no desktop a partir do cockpit, do celular

**A carona de volta.** A VPS nunca alcança o PC atrás do NAT, então quem
pergunta é sempre o PC: no mesmo ciclo de 30s em que ele já empurra o pacote,
a RESPOSTA traz o que ficou guardado no nome dele. Nenhuma porta nova, nenhum
serviço novo, nenhum buraco de firewall.

**A trava é a que ele escolheu**, entre três desenhos apresentados: o pedido
carrega um **nome de projeto**, nunca um comando e nunca um caminho. Quem
executa resolve o nome com `cwdDoProjeto`, que só conhece os projetos daquela
máquina, e recusa o resto. Com comando livre, quem escrevesse na fila do
servidor rodaria qualquer coisa no PC dele; com nome de projeto, o pior caso é
abrir uma sessão numa pasta que já era dele.

Quatro decisões que o teste guarda:

- **pedido é de uso único e some ao ser lido.** Fila que não esvazia reabriria
  a mesma sessão a cada 30 segundos, para sempre. O preço é perder o pedido se
  a rede cair entre ler e executar, e esse é o lado certo de errar: pedido
  perdido custa um clique, pedido repetido custa uma sessão fantasma por ciclo.
- **vence em 10 minutos.** Pedido velho é pedido que ninguém foi buscar porque
  a máquina estava desligada, e abrir a sessão horas depois é surpresa, não
  serviço.
- **o mesmo projeto pedido duas vezes não duplica.** Dedo duplo no botão não
  são duas sessões.
- **teto de 3 por ciclo**, e o atendimento nunca lança: isto roda dentro do
  timer, e uma exceção mataria o empurrão seguinte junto.

**Provado com servidor HTTP de verdade**, não só unidade: pedido entra pela
rota, o pacote do PC é aceito, o pedido volta na resposta com a origem, o
ciclo seguinte vem limpo, o pedido de outra máquina não vem junto, e
`../../etc/passwd` é recusado. Mais 7 casos de unidade no gate, em casa
isolada por `CC_HOME`.

**Falta a prova em produção**, e ela depende de commit: a VPS é quem guarda a
fila, e o código dela ainda é o de 19/08. Enquanto não subir, o botão "abrir
lá" existe no PC mas a VPS não sabe responder.

**O pedido original, com a ressalva dele mesmo:** *"os do desktop só vão
aparecer quando o desktop estiver online, daí um botão vai abrir um terminal
rodando `cd endereço do projeto && claude --dangerously-skip-permissions &&
remote-control` (escrevi só pra você ter ideia do que eu quero, nem sei se
isso funciona, daí eu já abro a sessão no app, que é onde eu mais uso)"*.

A linha que ele escreveu não funcionaria como está, e ele já suspeitava: `&&`
encadeia em sequência, então `claude` teria que terminar antes de
`remote-control` começar. O certo é uma invocação só, que é o que
`remotecontrol.mjs` já fazia desde o CC-129. Metade do pedido já existia.

### CC-161 ✅ 19/08 — backlog e docs no estado mais novo entre PC e VPS, via git

**Feito: a trava que avisa que as máquinas divergiram.** `sincronia-guard`,
evento `Stop`, nível avisa. Conta três coisas que o painel federado não mostra
(ele mostra agentes, nunca a árvore): arquivo sem commit, commit sem push, e
commit no remoto que esta máquina não puxou.

Três decisões, com o motivo:

- **Avisa, nunca trava e nunca commita.** A regra dele vence qualquer
  automação: *"nunca commitar sem que eu peça explicitamente"*. E travar no
  `Stop` criaria laço, porque commitar é justamente coisa do fim do turno.
- **Zero rede.** Lê o que o último `fetch` deixou em disco. Hook que fala com
  a internet no fim de todo turno trava a sessão quando a rede cai.
- **`null` e zero são coisas diferentes.** `git()` devolve `null` quando o
  comando falha, e `Number(null)` é **zero**: sem a checagem explícita, "não
  existe upstream" viraria "zero commits de diferença", afirmação bem mais
  forte do que o que se sabe. Bug real, achado no debug antes de fechar.

**Nove casos de teste contra repositório git DE VERDADE**, no gate. O teste é
`.mjs` e não `.sh` como os outros, e isso é achado: montar o JSON de entrada
dentro do shell transforma `\U` e `\5` do caminho do Windows em escape
inválido, o hook cai no `catch` e sai calado, e o teste registra um falso
"passou" enquanto o hook nunca rodou. Aconteceu na primeira tentativa.

#### ✅ Fechado em 19/08: a tela também mostra, e a decisão foi avisar

**A pergunta era: ativar SEMPRE puxa do git, ou só avisa?** Ficou avisar.
`git pull` automático por cima de mudança não commitada é ação irreversível
disparada por um clique que pedia outra coisa, e este projeto já aprendeu a
não fazer isso sozinho.

Cada projeto ativo mostra o estado do próprio repositório: quantos arquivos
sem commit, quantos commits sem push, quantos há para puxar. **Atrás do remoto
é o único em vermelho** — os outros dois são trabalho daqui que ainda não
saiu, estado normal de quem está no meio de uma tarefa; atrás quer dizer que
existe coisa pronta lá que aqui não chegou, e editar por cima é como nasce
conflito. Repositório em dia não ganha selo nenhum, porque uma fileira de "ok"
treina o olho a pular a linha inteira.

**O custo decidiu onde o dado entra**, e foi medido antes: 23 projetos custam
1905ms (83ms cada). Longe demais para uma rota que a tela chama. Então a lista
de módulos só calcula para os que estão à mostra (uns 4), e a rota de um
projeto só, sob clique, calcula sempre.

**Dois defeitos achados provando, e o segundo era o que importava:**

1. o selo só aparecia com framework ligado, e git não tem nada a ver com
   framework: projeto sem framework também fica para trás. Subiu para antes
   dos retornos antecipados;
2. **`cwdDoProjeto` devolve a pasta onde o AGENTE roda, não a raiz do
   repositório.** No `ibrics` isso é `apps/web_ibrics`, com o `.git` três
   níveis acima, então o painel dizia "sem git" para projeto versionado — o
   aviso sumia justamente onde havia o que avisar. `estadoGit` agora sobe a
   árvore, e aceita `.git` como ARQUIVO, que é o formato de worktree (este
   repositório usa um).

O motor mora em `src/git.mjs`, e o `sincronia-guard` passou a usar o mesmo:
hook e painel discordando sobre o estado do MESMO repositório seria pior que
não ter nem um nem outro.

### CC-167 ✅ 19/08 — 31 hooks nunca leram a configuração no Windows, e o interruptor de módulos não valia nada

**Achado por acidente**, ao fazer o `sincronia-guard` importar `src/git.mjs`:
o import morreu com `ERR_UNSUPPORTED_ESM_URL_SCHEME`. A causa vale para todos:
`import('D:\\...')` não funciona, porque o `D:` é lido como esquema de URL. É
preciso `pathToFileURL`.

**Por que ninguém notou:** quase toda chamada estava dentro de
`.catch(() => null)`, escrita para tolerar módulo ausente. O módulo não estava
ausente, estava inalcançável — e o `catch` transformou isso em silêncio. O
efeito prático: `const cfg = await import(...)` sempre `null`, então
`if (cfg?.hookEnabled && ...)` nunca chegava a perguntar nada.

**Consequência medida: desligar um grupo de proteções pelo painel não
desligava nada nesta máquina.** O interruptor por projeto do CC-115 existia na
tela, gravava no config, e os hooks nunca liam. Na VPS funcionava, porque
`/home/...` é caminho POSIX e o import aceita — o defeito era exclusivo do
Windows, que é onde ele trabalha.

68 ocorrências em 31 arquivos, corrigidas com script (o `edicao-guard` permite
para muitos arquivos, desde que escreva em pasta separada e confira antes de
mover, e foi o que se fez: sintaxe validada nos 31 antes de qualquer cópia).

**Provado nos dois sentidos**, que é o que faz o teste valer: com o grupo
`codigo` ligado o hook fala; com ele desligado o hook cala. Contra a versão
antiga, o mesmo import falha com `ERR_UNSUPPORTED_ESM_URL_SCHEME` e o config
nunca carrega.

**De quebra, um falso positivo no gate**, e ele estava certo em existir: a
trava que acusa "hook consulta o catálogo e não está nele" passou a acusar
três hooks por causa da palavra `hookEnabled` dentro do COMENTÁRIO que o
script inseriu. Ela procura o termo no texto do arquivo, não uma chamada de
verdade. O comentário foi reescrito sem o termo; a trava fica como está,
porque a versão exata custaria fazer parse de JavaScript para ganhar pouco.

### CC-162 ✅ 19/08 — o limite de 5h/semanal com mais de uma máquina reportando

**Já estava pronto, e ninguém sabia.** `usoDaConta()` (`src/web.mjs`) escolhe
a leitura mais recente entre a local e as que chegam nos pacotes, e **nunca
soma**: o limite é da CONTA, não da máquina, então somar dobraria o número.

Nasceu marcado como visão porque o PC nunca tinha se federado, então o caminho
nunca tinha sido exercitado. O CC-159 o ligou sem escrever uma linha.
Conferido em produção: o uso do PC (23% das 5h) viajou dentro do pacote e
aparece na VPS.

### CC-163 ✅ 19/08 — tempo e uso das duas máquinas somados, com a quebra por origem

**Também já estava pronto.** Ao contrário do CC-162, aqui somar é o certo:
horas e tokens são aditivos entre máquinas. `mesclarTempo()` já fazia a conta
com a quebra por origem, e marca o total como `federado` para a tela poder
dizer que veio de mais de um lugar — misturar cortes diferentes sem avisar
seria mentira silenciosa.

Mesma história do CC-162: pronto desde o CC-47, nunca exercitado até o PC
entrar na federação. Há teste no gate desde então (`horas e tokens somam entre
as máquinas, com a quebra por origem`).

**Sobra uma escolha de tela, e é dele:** se a aba de tempo mostra o total
combinado por padrão com a quebra por máquina como detalhe, ou o contrário.
Hoje mostra o combinado com o aviso de federado, que é o comportamento que
já existia. Registrado como pendência de decisão, não de código.

## ▶ Frente nova, aberta em 18/08: os agentes que não são Claude, alcançáveis do celular

Pedido dele: *"bota um atalho pro agy e pro opencode, cria uma aba agentes pra eu
acessar eles"*, e antes disso *"tem como instalar o opencode na VPS pra acessar
pelo Control center igual a gente faz com o Claude? e tem como instalar também o
agy?"*.

**No ar desde 18/08:** `cockpit.carzo.com.br/opencode` (conversa e terminal) e
`cockpit.carzo.com.br/agy` (terminal do Antigravity), os dois atrás da senha que
já existia, com atalho na aba de agentes. O que sobrou está aqui, e a maior
parte depende dele, não de código.

### CC-144 e CC-145 ✅ 18/08 — os dois voltam sozinhos, e sem depender do sudo dele

Estavam escritos aqui como dependência humana, com um comando de administrador
para ele rodar. **A dependência não existia.**

`loginctl enable-linger claudedev` funciona sem privilégio nenhum nesta VPS, e é
o que faz os serviços DE USUÁRIO sobreviverem ao logout e subirem no boot. Com
ele ligado, os dois viram serviço em `~/.config/systemd/user/` sem tocar em
`/etc`, sem senha e sem esperar por ele.

**Vale para qualquer serviço nosso daqui em diante**, e desfaz a suposição que
estava neste projeto desde a migração: nem tudo que sobe no boot precisa de root.
O que continua precisando é `/etc/systemd/system`, nginx, Docker e portas baixas.

Provado matando os dois processos: voltaram sozinhos com PID novo, e as duas
telas seguiram respondendo pelo endereço público.

### CC-146 ✅ 18/08 — o login do Google no agy 🔒 só ele

**Ele entrou**, e disse isso em 18/08. Conferido do lado de cá: `agy -p` responde
sem pedir conta, versão 1.1.14. Era o que travava o item seguinte.

### CC-147 ✅ 18/08 — o Claude delega tarefa ao agy pela linha de comando

Mesmo cano do opencode, que já existia desde 13/08. O que muda de um agente para
o outro é só três coisas, e é só isso que o código separa: o nome do binário, os
argumentos, e como se lê a saída.

Os dois formatos foram **medidos contra os binários reais**, não lidos em
documentação: o opencode entrega pedaços de texto soltos, e o agy fecha com a
resposta inteira num evento final. Somar os dois duplicaria o texto, então o
evento final vence e os pedaços servem para mostrar a resposta crescendo
enquanto a tarefa ainda roda.

O agy ainda entrega **o gasto de token**, que o opencode não entrega. Para o
opencode a resposta é `null`, nunca zero: zero diria que a chamada foi de graça,
que é outra coisa.

Provado de ponta a ponta com os dois agentes de verdade: o agy respondeu em 11s
gastando 14.765 tokens, o opencode respondeu como antes. Duas armadilhas
apareceram no caminho:

- **o caminho do binário é resolvido, não só o nome.** O painel roda como
  serviço, serviço não herda o PATH do shell, e o agy mora numa pasta que não
  está nele. É o mesmo defeito que o botão do escritório teve em 16/08;
- **"parou de crescer" não serve para saber que a tarefa acabou.** O agy escreve
  o cabeçalho na hora e a resposta segundos depois, então duas leituras seguidas
  dão o mesmo tamanho enquanto ele ainda pensa. A primeira versão do teste caiu
  nisso e deu falha onde não havia. O sinal certo é o processo ter morrido.

### CC-148 ✅ 18/08 — o título do terminal diz de quem é e de qual projeto

Queixa dele em 18/08: *"mistura os projetos do agy e os projetos do opencode no
mesmo terminal. Não teria problema se os títulos falassem. Tipo agy--nome do
projeto, o nome do projeto"*.

Metade já tinha sido resolvida pela separação de telas: o agy saiu de dentro do
opencode e ganhou `/agy`. Esta é a outra metade: o nome do projeto no título.

`agy-projeto` (`~/.local/bin/`, fora do repositório, na mesma prateleira de
`~/dev.sh` e `~/cockpit-auth.mjs`) recebe o projeto pela URL (`?arg=<projeto>`,
que o `--url-arg` do `ttyd` já sabia repassar), confere que o nome é uma pasta
de verdade dentro de `~/projetos`, entra nela e escreve o título da aba antes de
passar a vez para o `agy` de verdade. Nome que não é uma pasta, ou que tenta
sair de `~/projetos` (`../../etc`), cai no comportamento de sempre: abre sem
projeto, e o título fica só `agy`.

Provado no serviço de produção (porta 5183, atrás da senha do painel), com
navegador de verdade medindo o título da aba: com projeto ele mostra "agy ·
proj_controlcenter", sem projeto mostra "agy", e nome inventado ou tentativa de
fuga de pasta não aparecem no título.

**Falta a ponta que liga isso a um clique**: hoje o botão da aba de agentes é
genérico, sem projeto, então continua abrindo sem título de projeto. É
justamente o que o CC-149 (o próximo item, já registrado) resolve, com o
seletor de projeto e agente.

### CC-149 ✅ 18/08 — abrir escolhendo projeto E agente, como ele já abre o Remote Control

Ideia dele em 18/08: *"fazer eu abrir sessão do projeto e do agente (agy ou
opencode) igual eu abro o rc do Claude, e quando abrir o /opencode ou /agy já
abrir c os projetos abertos"*.

**A apuração anterior estava errada, e a correção mudou a implementação
inteira.** O registro dizia que a tela do opencode aceita `?directory=` no
endereço. Testado direto contra o servidor de verdade em 18/08: não aceita.
Esse parâmetro existe só no esquema de link do app de DESKTOP
(`opencode://open-project?directory=…`), lido de uma string, nunca da barra de
endereço do navegador.

O caminho de verdade, achado lendo o bundle JavaScript da própria SPA do
opencode: a pasta vai NA URL, como segmento, em base64url. A primeira tentativa
de provar isso foi abrir `/opencode/session/<id>` direto, e parecia funcionar
pelo texto da página. **Só o print de tela revelou o engano**: aquilo era a API
crua devolvendo um JSON, porque a rota da SPA colide com uma rota do próprio
servidor. Texto sozinho não bastava; a imagem sim.

Na aba de agentes, clicar em "opencode" ou "agy" agora abre a mesma lista de
projetos do Remote Control (a mesma fonte, para não duplicar o dia em que ela
ficar desatualizada), e cada um leva direto para a pasta escolhida:
`/opencode/<pasta em base64url>` ou `/agy/?arg=<nome do projeto>` (que já
existia, do CC-148).

Provado em três camadas: a codificação sozinha (teste no gate, contra o valor
que o servidor de produção confirmou abrir de verdade), o clique no painel de
teste (a lista aparece, e o clique monta a URL certa), e a página de verdade
pelo endereço público, logada pela senha real, mostrando a interface do
opencode sem cair no erro de pasta inválida.

**Apurado junto, e fecha uma dúvida dele:** o opencode tem app de celular
(alpha) e app de computador com SSH; o agy tem editor de computador com Remote
SSH, e **não tem app de celular**. Nenhum dos dois é necessário: as duas telas
web já entregam o que ele quer.

### CC-150 ✅ 18/08 — decidido: modelo gratuito e Remote Control não convivem 🚫

Pergunta dele: *"teria como colocar pra uma sessão do Claude rodar com um modelo
desses gratuitos e ainda usar o remote control?"*

**Não, e não é questão de configuração.** Desde a versão 2.1.196 o Claude Code
desliga o Remote Control sempre que `ANTHROPIC_BASE_URL` aponta para um servidor
que não é da Anthropic, e também enquanto existir credencial de gateway. O
próprio projeto do roteador documenta a limitação. Fica registrado para não ser
reaberto por engano: a escolha é uma ou outra, por sessão.

## ▶ Frente nova, aberta em 16/08: o backlog visível — ver [[produto/COMUNICACAO]]

Diagnóstico dele ao fim do dia, e **a frente mais importante em aberto**, porque
todas as outras dependem dela para serem acompanhadas. O documento tem as
palavras dele inteiras; aqui ficam só as tarefas.

O que ele nomeou: o chat é uma fita que só anda para a frente, sem retroativo;
raciocínio e conclusão vêm misturados; e falta um lugar parado onde o trabalho
apareça enquanto a conversa anda. O efeito medido é o pior possível — *"eu acabo
sendo empurrado pro vibecoding"*, ou seja, ele desiste de conferir, que é o
oposto do que este projeto existe para fazer.

**A medição que fecha o caso:** depois de um dia fechando 10 itens, o
`meta.json` desta sessão tinha `subject` vazio, `frente` vazia e **0 to-dos**.
Escrevi o protocolo e não o segui; escrevi o `cc-check` e ele passou calado,
porque só cobra **quando existem** to-dos.

### CC-95 ✅ 16/08 — o agente reporta o trabalho no painel, e isso é cobrado

O buraco de raiz. `cc-check` só dispara com to-do já registrado — zero to-dos
passa como se fosse entrega limpa. **Ausência de registro e trabalho terminado
não podem ter a mesma cara.**

- gate no `Stop`: editou código ou fechou item de ROADMAP e o `meta.json` está
  sem `subject`/`frente`/`todos`? devolve
- e no começo: ao entender a tarefa, `subject`, `frente` e a lista de to-dos
- o `frente` sai do ROADMAP, que é o vocabulário dele

**Sem isto, todo o resto desta frente é enfeite** — o painel só mostra o que o
agente escreve nele.

### CC-96 ✅ 16/08 — raciocínio e conclusão separados por marcador

Ele **lê o raciocínio** e não quer que eu corte — isso contraria o protocolo que
outra IA sugeriu, e a palavra dele vence. O que falta é fronteira visível.

- marcador entre as duas partes, no formato que ele propôs
  (`---- // resumo // ----`)
- vale para resposta longa; conversa curta não precisa de moldura
- entra no `control-center-estilo.md`, e o `estilo-fim` passa a medir

### CC-97 ✅ 16/08 — product backlog, sprint e definição de pronto

*"nao se chamou de product backlog tambem, e tambem nao temos exatamente uma
definição de pronto, e isso quebra praticamente todo o projeto"*.

- **product backlog**: o que existe e não tem dono de tempo (hoje é o ROADMAP,
  sem se chamar assim)
- **sprint**: o recorte de agora. A aba existe e está vazia
- **definição de pronto por tarefa**: hoje só há `mvp.criterios` por projeto.
  Sem isso, "feito" é opinião minha — e é o que ele mais teme

### CC-98 ✅ 16/08 — o backlog ordenado por tempo E por importância

*"me deem uma nocao de preenchimento em ordem de tempo e importancia"*. Hoje o
ROADMAP tem uma ordem só, e implícita: a ordem em que os itens nasceram.

Derivar as duas, nunca digitar: tempo sai do `tempo.mjs` e do git; importância
sai de quantos itens dependem daquele mais o que ele mesmo marcou.

### CC-99 ✅ 16/08 — a revisão mora no backlog, não no chat

*"a revisao seja anotada, apontada e revisada nesse local, que seria o
backlog"*. Hoje eu aponto defeito no chat e ele some na fita. Cada item precisa
carregar o que foi revisado, o que foi apontado e o que foi respondido.

### CC-100 ✅ 16/08 — o painel mexendo enquanto ele lê

*"que fiquem visiveis em locais faceis pra eu ver voce mexendo e atualizando
enquanto leio aqui"*. O canal já existe — o painel atualiza a cada 2 segundos.
O que falta é o CC-95 alimentá-lo, e a tela mostrar a mudança de forma que se
perceba (o que acabou de mudar, e quando).

**Depende do CC-95.** Sem dado entrando, não há o que ver mexer.

## ▶ Frente: o rebrand do painel, aprovado em 16/08

Decisão dele depois de rejeitar duas telas: *"o painel precisa de um rebrand
total de design. Eu quero um painel mais clean e menos tecnologico, com cores e
letras mais suaves"*.

**As duas referências, e o que cada uma acerta.** O painel do Pierre acerta na
paleta, que é papel quente em vez de branco clínico, e erra nas linhas finas
demais. O Lev4 acerta na separação: usa sombra suave e superfície um pouco mais
clara em vez de fio de um pixel, e é isso que ele chamou de *"linhas mais
gordinhas"*.

**A estética de hoje foi escolha minha e é o problema.** O painel é um terminal:
fundo quase preto, tudo em fonte de código, títulos em caixa alta com letras
espaçadas. Escolhi por afinidade, não porque servia a ele, que lê no celular, na
rua, cansado.

**O custo é baixo, medido:** o estilo tem 779 usos de variável e só 14 cores
fixas fora dos blocos de tema. Trocar a paleta é mexer num bloco, não nas telas.

**Como fazer, pelo método dele:** protótipo inteiro numa tela só para aprovar a
direção. Se reprovar, descer para os elementos um a um e testar se a decisão
replica.

### CC-108 ✅ 17/08 — as duas paletas escritas, com o porquê de cada cor

Um claro e um escuro. Decisão dele em 16/08: os outros quatro temas saem, porque
conferir seis variações de cada tela multiplica o trabalho por seis e na prática
quatro ficam meio acertadas, que é o estado de hoje.

### CC-109 ✅ 17/08 — a paleta aplicada e conferida nas 17 telas

Conferidas por print nos dois temas. O gate de vazamento lateral roda junto.

### CC-110 ✅ 17/08 — aposentados os quatro temas que sobravam

O seletor passa a mostrar dois, e o gate confere que não sobrou tema órfão no
estilo.

### CC-113 ✅ 17/08 — sprint vira etapa nomeada de um item do backlog

Ideia dele em 17/08, guardada por dois dias, com exemplo dele:
`produto10 - criação da área de login` e `produto10_sprint01 - criação das
classes e estrutura da página`. Não é o sprint do Scrum: é **fatia nomeada de
um item do produto**.

Resolve de graça os dois defeitos do CC-112: o código da tarefa herda o do item
pai (estável por construção) e o elo tarefa-item passa a existir no próprio
nome. Palavras inteiras em [[produto/VISAO-FELIPE-17-08]].

### CC-114 ✅ 17/08 — a planilha do Routia na tela, completa

O modelo que ele já usava nos produtos e funcionava: cada tarefa definida
**pelos arquivos, funções e classes que toca**, com dependência e desbloqueio
escritos na própria linha, em formato tabela com nomes e cores.

Metade já existe: a rota reivindica arquivo desde 16/08. O que falta: função e
classe além de arquivo, o depende/desbloqueia por tarefa, e **a visualização em
tabela colorida**, que é como ele lê rápido. Palavras inteiras em
[[produto/VISAO-FELIPE-17-08]].

**Feito em 17/08:** a tela de rotas virou tabela (rota, quem, arquivos
reivindicados, cor no fio e na palavra), que empilha na gaveta estreita. E a
dependência saiu do texto que já se escreve: "depende do CC-60" vira "espera
CC-60" no cartão, e o inverso, "destrava", é calculado cruzando projetos.

**Segunda fatia (17/08), que fecha o item:** a reivindicação de rota aceita
`arquivo#parte` (função, classe, ativo): quem também declarou o arquivo edita,
quem não declarou continua barrado, e sem `#` a posse é inteira como sempre.
Dez casos no teste do guarda. E a dependência por tarefa de sprint sai do
próprio texto ("depende da s03"): o quadradinho ganha o selo "espera s03" em
âmbar, que vira "s03 feita" em verde quando a esperada fecha. Provado com
print das duas.

### CC-128 ✅ 17/08 — perfis com nome de profissão, e o modo mandando nas travas

Duas coisas dele na mesma conversa. A primeira, a renomeação:

> *"o restritivo tá mais pra continuativo, o diálogo seria mais um 'modo livre'
> (…) ficou faltando o modo estudo que você ia implementar, o modo debug"*

`diálogo` virou **Livre**, `restritivo` virou **Continuativo**, `contínuo` virou
**Autônomo** (o nome diz o que muda: ele não está olhando). Os ids em disco
continuam os antigos, e os apelidos novos funcionam na linha de comando:
renomear não pode mudar o comportamento de um projeto pelas costas.

Seis modos novos, cada um declarando o que exige e o que desliga: **Estudo**
(escrita em código recusada, só documentação), **Depuração** (medir antes de
mexer, sem teto de entregas), **Desenho** (print obrigatório, forma cobrada,
teto de uma entrega), **Revisão** (aponta sem consertar), **Pareado** (mostra
cada passo e espera), **Entrega** (fecha com prova e prepara commit).

A segunda, e é a que dá mecanismo:

> *"gostei de todos, mas poderiam ser sub-modos (…) o modo sugestivo e o desenho
> juntos pra transformar a ferramenta em um designer (…) seria o profissional que
> eu contrataria praquela tarefa, a ideia eh facilitar o meu reconhecimento
> rápido"*

Nasceram os **perfis**, e a primeira lista foi reprovada por ele na hora:
*"que nomes são esses??? pô que viagem, só profissão nada a ver kkkkkkkk (…) os
seus exemplos foram rasos e não teriam tanta utilidade"*. Empreiteiro e Escrivão
eram nome sem mecanismo.

A lista que ficou saiu dos exemplos dele, e cada papel TRAVA uma etapa:

- **Designer** (desenho + sugestivo): print nas duas larguras, a forma que ele
  nomeou cobrada na entrega, e ele olha cada passo.
- **Modelagem de sistema**: *"hooks que travem os prompts em desenhar o sistema
  todo antes de programar"*. Código recusado fora da fase de Definição; a
  entrega é o desenho escrito.
- **Scrum Master**: *"hooks que travem o sistema até definir todo o produto e
  projeto e depois confirmar que tá de uma forma ideal baseado em um padrão que
  agente definir"*. Código recusado enquanto o MVP não tiver nome e critérios.
- **Depurador**, com as três variações que ele aprovou como sub-categorias
  (*"é algo mais dentro de um debug, pode ser sub-categoria do depurador"*):
  **Perito** (mede antes de consertar), **Pesquisador** (escreve, não toca em
  código), **Revisor** (aponta, não conserta).

A trava de etapa vale só para código: documentação e backlog ficam livres,
porque é justamente ali que a saída de Modelagem e Scrum Master mora.

Cada um soma os modos com uma regra clara,
**exigência vence desligamento**: se um modo pede uma trava e o outro a desliga,
ela fica ligada. Na dúvida entre proteger e soltar, protege.

E a regra dele que fecha o buraco: **se tem função bloqueando, entra como
framework**. As 32 travas viviam soltas, ligadas por padrão e indiferentes ao
modo. Agora o modo do projeto manda: trava exigida vale mesmo desligada no
interruptor global, trava desligada pelo modo cala, e sem framework tudo cai na
regra antiga. É por isso que escolher "Designer" liga o print obrigatório sem ele
caçar interruptor nenhum.

Provado: 6 asserções em casa isolada (perfil vence global, modo desliga o teto,
framework desligado volta ao padrão), 3 grupos no gate do framework, e a escolha
feita pelo telefone com a tela confirmando pelo arquivo.

### CC-127 ✅ 17/08 — a trava que impede eu trocar o que ele pede

Nasceu do pior erro dos três dias, e ele nomeou: *"EU PEDI EM TABELA VOCE
INVENTOU OUTRA COISA QUE NÃO É TABELA (…) NEM EU FALANDO EXPLICITAMENTE PRA
FAZER IDENTICO AO QUE JA TEMOS VOCE VAI LA E MUDA!!! POR QUEEEEEEEE??????"*

**O que aconteceu:** ele pediu tabela. Fiz tabela no monitor e, no telefone,
converti cada linha em bloco empilhado, escrevendo o motivo num comentário de
CSS: *"rolar sete colunas de lado num aparelho de 390px seria pior que não ter
tabela"*. Ele usa telefone. Entreguei zero tabela, e mandei o print dos blocos
chamando de planilha.

**Por que nenhuma das 29 travas pegou:** todas olham COMO eu escrevo e entrego
(traço longo, jargão, separador, prova, fila). Nenhuma comparava o que ele pediu
com o que saiu. Buraco de categoria, não de quantidade.

**O discriminador é um cruzamento, e foi medido antes:** "em vez de" aparece 92
vezes neste repositório e "de propósito" 72, quase sempre em comentário legítimo.
Barrar a frase sozinha inviabilizaria a documentação. O que barra é a frase de
desvio **na mesma sentença que um termo do pedido dele**: "seria pior que não ter
tabela" cita `tabela`, palavra do pedido, então a decisão é dele.

Nove casos de teste, com o comentário real como primeiro caso. Ela me barrou de
verdade durante a construção, e achou um falso positivo próprio no mesmo
minuto ("mais" entrou como termo de pedido), corrigido na hora.

**As três que ele escolheu estão de pé (17/08):**

1. **Decisão contra o pedido escondida no código** (trava de edição): a frase de
   desvio na mesma sentença que um termo do pedido dele. 9 casos.
2. **Pediu igual ao que já existe: mostrar o par** (fim do turno): quando ele
   aponta uma referência ("nós já usamos"), a entrega não fecha sem o original e
   o novo lado a lado. A trava NÃO julga se ficou igual, de propósito: quem
   compara é ele. Mandar arquivo é chamada de ferramenta, então está no
   transcrito ou não está; prosa não conta. 8 casos.
3. **A forma que ele nomeou tem que estar na entrega** (fim do turno): vocabulário
   fechado de forma (tabela, card, lista, coluna, gráfico). Barra quando a
   entrega ignora a palavra dele, e barra mais forte quando fala de outra forma
   no lugar. 9 casos.

A terceira mudou de desenho no caminho, e vale registrar por quê: a ideia dele
era eu declarar as palavras do pedido antes de implementar. Isso depende da minha
honestidade no momento exato em que estou errando, que é o que já falhou. A
extração automática de um vocabulário fechado não depende de mim.

### CC-125 ✅ 17/08 — a visão de tarefas em planilha, como nos seus roadmaps

Pedido dele em 17/08: *"vamos criar a visão de tarefas estilo tabela/planilha
de roadmap. você sabe exatamente qual o estilo que eu quis dizer? nós já usamos
em diversos projetos"*.

**Não foi chutado, foi medido.** Varredura nos ROADMAP.md dos 17 projetos: o
formato mais completo que ele usa é o do `proj_carzo`,
`| ID | Task | Prioridade | Complexidade | Status | Depende de | Desbloqueia |`,
com símbolos ✅ 🏗️ 🔒 ⏳ e IDs por frente (INF-01, CORE-03).

Implementado na vista de sprint, com alternador planilha/quadradinhos guardado.
Duas colunas dele ficaram de fora porque não há dado real: Prioridade e
Complexidade, que hoje só existem para tarefa concluída. No lugar entraram as
duas que o cockpit sabe e o arquivo não: **quem** está com a tarefa, e se tem
**prova**.

O ID sai do próprio texto quando o agente já escreve assim (`ESC-132 tela de
cadastro`), e nesse caso o código é retirado do texto: mostrar os dois lado a
lado gastava a largura que a tarefa precisa.

Quatro defeitos vieram do print, nenhum de dedução: largura fixa medida na
primeira linha da tabela (as classes faltavam nos títulos, e nada pegou), ID
cortado com 8ch, títulos DESBLOQUEIA e PROVA escritos um sobre o outro, e o
pior, as larguras em `ch` sobrevivendo no telefone, onde a palavra "profissao"
quebrava em quatro linhas.

**Fica aberto, e é a queixa maior dele:** o TEXTO das tarefas é vago.
*"'profissão escolhe quem entra' não tem o contexto do que é na verdade, tipo
'a profissão do agente define se ele entra na tarefa'"*. É o CC-126.

### CC-126 ✅ 17/08 — o texto da tarefa diz a coisa inteira

Palavras dele em 17/08: *"os cards nunca fazem sentido. o texto é algo vago como
'profissão escolhe quem entra', não tem o contexto de que é na verdade, tipo 'a
profissão do agente define se ele entra na tarefa'"*.

O problema não é a tela, é o que os agentes escrevem: título de commit em vez de
frase. Sujeito e objeto somem, e sem eles a linha só é legível para quem
escreveu.

**A hipótese óbvia era tamanho, e a medição a matou.** Nas 29 tarefas reais
desta máquina a mediana é de 9 palavras e só UMA tem menos de cinco: "cada
entrega diz se precisa do seu olho" tem oito e é clara, "profissão escolhe quem
entra" tem quatro e é vaga. Contar palavras não separa as duas.

**O que separa é a palavra de ligação** (artigo, preposição, possessivo). É ela
que carrega sujeito e lugar, e é o que o telegrama corta: a frase que ele
reclamou tem ZERO, a versão que ele quer tem quatro. Medido nas 29: exatamente
uma tarefa com zero, e é a que ele citou. Zero falso positivo depois de incluir
"neste/nesta" na lista.

**Feito:** trava no fim do turno que devolve a tarefa telegráfica com a frase
dele ao lado, nove casos de teste com textos reais, e o protocolo dos agentes
reescrito, porque o exemplo dele ensinava telegrama (`icone proprio` virou `o
portal ganha icone proprio na paleta do editor`).

### CC-117 ✅ 17/08 — pedido em lote nunca se perde, e a pausa diz o estado

Pedido dele em 17/08, urgente: *"qdo eu te peço mil coisas e voce pausa no
meio eu não sei quanto você implementou e eu perco as ideias, precisamos que
essas coisas fiquem mais bem escritas e definidas num lugar de fácil acesso
urgente, isso vai mudar completamente a nossa dinâmica de trabalho"*. Íntegra
e regras em [[produto/VISAO-FELIPE-17-08]], seção 4b.

O que já existe e serve de base: o cartão com tarefas e prova, o sprint
backlog na tela, o separador de resumo. O que falta: o REGISTRO IMEDIATO de
cada pedido antes de executar (hoje depende de eu lembrar), e a pausa que
enumera cada um com estado. Primeira fatia feita em 17/08: a regra entrou no
padrão de resposta injetado em toda sessão, e esta conversa já roda assim.
**Segunda fatia (17/08), que fecha o item:** virou trava mecânica. Pausa de
entrega com tarefa aberta no cartão que não diz o que ficou (na fila, em
curso, esperando) é devolvida uma vez, com a lista do que está aberto. De
propósito, a trava NÃO casa item a item: casar texto livre com texto livre
foi o que gerou três falsos positivos no guarda do separador. Seis casos de
teste, casa isolada.

### CC-115 ✅ 17/08 — os módulos do cockpit, ligáveis por projeto

*"o routia tá cada vez mais imerso no cockpit (…) o framework, o routia etc
podiam ser plugins"*. Liga e desliga por projeto, aparece como módulo na tela,
e o cockpit é a casa. Palavras inteiras em [[produto/VISAO-FELIPE-17-08]].

**Primeira fatia (17/08):** a tela de módulos voltou a existir e ganhou as
rotas. O botão dela tinha morrido órfão quando os cards assumiram a aba; agora
mora na tela principal ("módulos por projeto"), com o framework ligável por
projeto como antes e, ao lado, quantas rotas cada projeto tem e quantas estão
em uso. Rotas não se desligam por clique: o arquivo guarda o histórico. De
quebra, a lista de projetos desta máquina saiu de 0 para 17: a descoberta caía
quando não havia job de background, que é o caso da VPS, e agora cai nas
pastas convencionais da home. **Segunda fatia (17/08), que fecha o item:** as proteções viraram quatro
grupos com nome dele (comunicação, entrega, código, rotas), e cada projeto
pode desligar um grupo só para si, na mesma tela, com confirmação que diz o
que se perde. O interruptor global da aba de hooks continua mandando; o do
projeto só cala, nunca liga o que o global desligou. Provado de ponta a
ponta: grupo desligado no game_sumauma calou a proteção lá e ela seguiu
travando aqui, na mesma hora, e religar deixou o arquivo de configuração
limpo. Teste no gate com casa isolada.

### CC-116 ✅ 17/08 — cada sessão pode ter o seu modo

*"quero poder ter uma sessão de frontend e uma de backend no mesmo projeto (…)
uma no restritivo e outra no sugestivo"*. Hoje o estado do framework é um
arquivo por projeto, então duas sessões dividem o mesmo modo.

Já está pronto para isso: a oficina por agente, a rota com arquivo, os recados.

**Como ficou (17/08):** o projeto continua com um estado só; a sessão pode ter
uma capa por cima, que muda apenas modo e tom (`.framework/sessoes/<id>.json`,
fora do git). Todos os hooks leem a capa sem mudar uma linha, porque a leitura
resolve a sessão pelo ambiente. Regravar o estado do projeto nunca promove o
modo de uma sessão (o gravador restaura do arquivo cru). Trocar:
`cc framework modo <nome>` muda só a sessão; `--projeto` muda todos.
Prova: 3 grupos de teste (capa vence, sem capa herda, capa não vaza).
Falta o estado deixar de ser um por pasta. Palavras inteiras em
[[produto/VISAO-FELIPE-17-08]].

### CC-112 ✅ 17/08 — a tarefa de sprint tem código estável e projeto

Achado por ele em 17/08, olhando a tela no celular:

> "o que são essas tarefas S, de Sprint? elas não dizem nada c nada e tão fora
> de qualquer projeto"

**É o mesmo defeito dos números de posição no backlog, agora do outro lado.**
`S1`, `S2` são a posição na lista, contada na hora de desenhar. Muda quando uma
tarefa fecha, quando outro agente registra, ou quando a ordem muda. Ele decora
"o S4" e amanhã o S4 é outra coisa.

E elas aparecem **fora de projeto**: o agrupamento usa o assunto que o agente
escreveu ("tamanho de letra e as tres recomendacoes"), não o projeto. Duas
tarefas de outro projeto apareceram no meio das minhas sem nada dizendo isso.

**O que precisa existir:**

- código estável por tarefa, que sobreviva ao fechamento e à reordenação
- o projeto visível no agrupamento, não só o assunto do agente
- e o elo com o item de backlog, quando o agente declarou a frente

O terceiro é o que fecha o ciclo: hoje a tarefa de sprint e o item de produto
vivem em listas que não se conhecem, e é justamente a ligação que faz o painel
responder "em que item do backlog estamos".

### CC-111 ✅ 17/08 — cada entrega diz se precisa do seu olho

Pedido dele em 16/08, ao decidir parar de revisar o técnico: *"só o que eu vejo
e uso, porém é bom eu ter acesso à revisão se precisar, de repente um framework
que diferencie isso"*.

Hoje toda entrega chega igual, e ele revisa tudo com a mesma profundidade. O que
é visual precisa do olho dele; o que tem seis casos de teste verdes, não.

A separação vai no próprio to-do, e o painel mostra as duas listas com o técnico
alcançável, nunca escondido.

## ▶ Frente nova, aberta em 17/08: o que saiu da sessão de análise das telas

Sete itens nascidos de uma sessão que **não escreveu código nenhum**, de
propósito: ela estava sem rota marcada. Saíram do inventário das 17 telas
([[produto/TELAS]]), da proposta de reorganização que ele trouxe de outra IA, e
do que se mediu ao conferir cada afirmação.

### CC-118 ✅ 17/08 — a mensagem que some da fila é recuperável

Queixa dele em 17/08: *"as vezes eu digito aqui e o texto fica em itálico. daí
ao sair da janela e voltar, o texto simplesmente some"*.

Medido no registro da própria conversa. **São dois casos com o mesmo sintoma na
tela**, e é isso que faz parecer aleatório:

| No registro | O que houve | Recupera? |
|---|---|---|
| `enqueue` e depois `remove` | chegou, foi entregue no meio do meu turno, nunca virou mensagem | sim, o texto fica guardado |
| nada | saiu da janela antes de completar o envio | não |

Duas peças, e a primeira é a que evita o dano:

- trava que me obriga a **citar** a mensagem recebida no meio do turno. Minha
  resposta é gravada como mensagem e sobrevive, então o pedido dele fica no
  histórico pela minha boca
- um jeito de devolver o texto do primeiro caso sem eu escrever script na hora

Boa parte das mensagens longas dele é ditada por voz, na rua. Perder uma custa
caro, e hoje ele não tem como saber qual dos dois casos aconteceu.

**Feito em 17/08.** O texto do primeiro caso está no registro como operação de
fila com `remove` e sem `dequeue`, e ninguém tinha olhado: **37 mensagens dele**
nesta máquina, incluindo pedidos longos ditados por voz. Recuperáveis na aba
"meu" (botão "o que eu digitei e sumiu") e por `cc fila`, com data, projeto e o
texto inteiro. Mais a trava que me obriga a CITAR a mensagem perdida antes de
encerrar: a minha resposta é uma mensagem e sobrevive, então citando o pedido
dele entra no histórico pela minha boca. Sete casos de teste.

**Defeito que ele pegou na primeira versão**, e vale guardar: *"só tá aparecendo
uma, não eram 74?"*. A rota escolhia a sessão de sinal mais novo, que naquele
instante era a do `app_escritorio`, com exatamente UMA mensagem perdida. As 36
do controlcenter estavam ali do lado, invisíveis. **Quando a pergunta dele é "o
que EU digitei", escolher uma sessão por conta própria é adivinhar**: agora
varre as 16 sessões da máquina (63 MB, 850ms sob clique) e carimba o projeto em
cada linha.

### CC-131 ✅ 17/08 — a tela mostrou verdade parcial com cara de completa, duas vezes

Dois casos no mesmo dia, um de cada sessão, e nenhum apareceu no código:

1. **A lista de mensagens perdidas mostrou 1 de 37.** A rota escolhia uma sessão
   sozinha (a de sinal mais novo) e não dizia que estava escolhendo. Ele viu uma
   e perguntou: *"só tá aparecendo uma, não eram 74?"*.
2. **A outra sessão deixou o estado de teste ligado**, e a tela que ele avaliou
   tinha o botão pedido ESCONDIDO, porque com a sessão de pé aparecem outros
   botões. Ele leu como "o recurso não está lá".

A lição comum: a tela não mentiu, mostrou um recorte, e recorte com cara de
total é indistinguível de erro para quem olha. As duas regras que ficam:

- quando a pergunta é "o que EU tenho", escolher um recorte por conta própria é
  adivinhar. Varra tudo e carimbe a origem.
- **o print de entrega tem que ser tirado no estado que ELE vai encontrar**, não
  no estado em que o teste parou (formulação da outra sessão, e é mais estreita e
  mais útil que a minha, que era só "derrube o estado no fim do teste").

E a terceira: nas duas vezes, só o print pegou.

### CC-132 ✅ 17/08 — sete travas ganharam teste

De 12 provadas para 19, de 33. As três de hoje mais o `commit-guard` (12 casos,
com as palavras dele de autorização: "comit", "commita", "sobe isso") e o
`travessao-guard` (10 casos, incluindo a fronteira entre público e interno que
ele definiu em 16/08). Faltam 14, e a lista aparece na aba de hooks.

### CC-130 ✅ 17/08 — prosa no quadro de rotas não rouba mais a posse de um arquivo

Achado ao vivo, com duas sessões trabalhando: a outra escreveu
`📁 src/remotecontrol.mjs src/web.mjs · precisa de src/ui.html, que é da rota
cockpit`, e o leitor colheu `src/ui.html` do meio da FRASE. Resultado: o guarda
barrou a dona do arquivo, dizendo que ele era do vizinho que estava justamente
pedindo emprestado.

O coletor agora para no primeiro token sem cara de caminho, em vez de filtrar a
linha inteira. Explicar o que a rota faz depois dos arquivos voltou a ser uso
normal do quadro, que é documento para humano antes de ser entrada de parser.
Dois casos novos, 12 no total.

Junto, a pedido da outra sessão: a mensagem do gate de número repetido passou a
dizer o arquivo e o próximo número livre. O princípio vale para todo gate daqui:
acusar sem dar a saída é a burocracia que se desliga na terceira semana.

### CC-119 ✅ 17/08 — o funil: a tarefa de sprint aponta para o item do roadmap

Achado do inventário, e a única ideia da proposta de fora que se sustentou: o
que falta fazer está partido em três telas que não se referenciam. Produto (as
frentes do roadmap), sprint (os to-dos dos agentes) e o que só ele resolve.

**A ressalva que a proposta não viu:** a lista dele **não é por projeto**. É o
"trelo da vida", e serve para olhar tudo de uma vez. Um funil que force a
escolha de um projeto quebra justamente esse uso, então a visão humana precisa
poder ficar sem projeto nenhum selecionado.

**Feito em 17/08, e o dado já existia.** O caminho produto → sprint já estava
montado (cada item do roadmap lista as tarefas dos agentes que casaram pela
`frente`); faltava o inverso, que é o que ele olha primeiro. A planilha de
sprint trocou a coluna "Quem" por **"Item do roadmap"**: cada tarefa mostra o
item a que pertence, com projeto e agente por baixo. Tarefa sem item aparece
como "sem item no roadmap", que é informação e não buraco.

A ressalva acima foi respeitada: nada força escolher projeto, a planilha mostra
todos juntos.

### CC-120 ✅ 17/08: quem subiu esta porta

O painel já sabe a pasta de cada agente e a pasta de cada porta em escuta, e
nunca cruza as duas. Cruzar responde "quem subiu essa 5173", que hoje ninguém
responde: a aba de servidores mostra o processo, a de agentes mostra quem
trabalha, e o elo entre eles fica na cabeça dele.

Veio da proposta de fora, e é a parte dela que ninguém tinha pensado aqui.

**Como ficou (17/08):** o cartão de cada porta mostra os agentes daquele
projeto, clicáveis, e o rótulo diz **"agente na mesma pasta"**, não "quem
subiu". Ninguém registra quem deu o comando; o que se sabe é que a pasta é a
mesma, e prometer autoria seria a tela afirmando mais do que mediu.

**O casamento é por projeto, e a primeira versão fazia por caminho.** Ela saiu
no print e estava errada de um jeito que o código não denunciava: a sessão
avulsa aberta na pasta pessoal casava com todos os servidores, porque todo
projeto mora dentro dela, e um agente aparecia em cada cartão da tela. Caminho
virou o caso de sobra, para servidor sem projeto identificado, e só no sentido
de o agente estar numa subpasta do servidor. Terceiro defeito do dia achado por
print e invisível no código, junto com a pasta pessoal duplicada na aba remoto.

### CC-121 ✅ 17/08 — aba que abriria vazia não aparece

Cinco das 17 telas só fazem sentido numa máquina específica (servidores, VPS,
escritório, remoto, rotinas). Quem abre o painel no celular vê metade delas
vazia, e vazio ocupa o mesmo espaço de menu que cheio.

O painel já faz isso em três lugares: o seletor de máquina só aparece com duas
ou mais, o bloco de Docker some sem Docker, a coluna de valor some sem taxa.
Falta valer para **aba**.

**Feito em 17/08, com as duas sessões.** O snapshot passou a dizer o que ESTA
máquina tem (`tem`), e a navegação esconde a aba que o servidor AFIRMA não ter
dado. Grupo que fica sem aba nenhuma some junto, e tocar num grupo cai na
primeira aba visível dele.

Três regras de segurança, e todas existem para o mesmo risco, que é pior que a
aba vazia: **esconder uma tela que funciona**.

- só esconde o que o servidor afirma não existir. Campo ausente, servidor velho
  ou resposta ainda não chegada mostram tudo.
- a aba ABERTA nunca some, senão a navegação sumiria debaixo dele.
- sinal honesto ou nada: `remoto` ficou de fora porque não há como saber se a
  tela tem uso, e um sinal inventado esconderia tela boa.

O custo entrou no tique de 2 segundos, então foi medido: **0,52 ms**, leitura de
config e existência de arquivo. A primeira versão do campo, que eu escrevi, teria
chamado a varredura de portas dentro do tique e derrubado o stream inteiro; a
outra sessão pegou antes de aplicar. E o meu critério de VPS (`cfg.vps?.host`)
esconderia a aba justamente nesta máquina, onde ela funciona em modo local.

### CC-122 ✅ 17/08 — o que mudou desde que eu olhei, numa resposta só

A pergunta de quem volta depois de horas fora, e nenhuma tela responde ela
inteira. Hoje está partida em três: o "vi isso" por projeto, o digest da semana
e o "o que mudou" dentro do mapa.

Vale mais que remexer agrupamento de abas, que é onde a proposta de fora gastou
o esforço dela.

**Feito em 17/08.** Uma marca de "vi tudo" (separada das visitas por projeto,
na mesma gaveta e com chave reservada) e uma lista única no topo da tela que
abre: hora, projeto e o que aconteceu, do mais novo para o mais velho. Dobrada
quando passa de doze, porque quem está no meio do trabalho não precisa dela
toda hora. Sem marca registrada, mostra só o botão: alegar "desde sempre" seria
inventar um delta.

**E o item destravou um defeito que estava calado desde sempre:** o carimbo de
tarefa concluída é gravado pelo agente como TEXTO ISO, e o resto do histórico
usa número. Comparar texto com número usando `>` é sempre falso, sem erro
nenhum, então **toda tarefa fechada sumia do "o que mudou"**. Media 1 marco
onde havia 46. Agora há uma função que normaliza os dois formatos, e é o
segundo defeito desta família hoje (o outro foi a data no nome de pacote).

### CC-123 ✅ 17/08 — o modo vale por rota, não só por sessão

Refina o [[CC-116]], que entregou a capa por sessão em 17/08.

Exemplo dele, e é o caso real: *"eu posso ta no mesmo projeto fazendo backend e
frontend. eu quero dialogar sobre o frontend mas o backend ja tem backlog entao
eu posso colocar como restritivo"*.

A capa por sessão resolve isso, com um custo: **a sessão morre e renasce com
outro número**, então o modo se perde a cada reinício, e ninguém vê pelo quadro
quem está em qual modo. A rota não: ela já declara os arquivos dela (é o que
separa front de back sem inventar nome novo), mora no repositório e é visível.

Regra que fica: modo de comportamento (tom, ritmo, se pergunta) pode valer por
rota. Modo que **tranca escrita** continua valendo para o projeto, porque duas
travas discordando sobre quem pode escrever num arquivo é o cenário ruim.

E um efeito de graça: sessão sem rota nenhuma cairia em diálogo. Foi o buraco
vivido em 17/08, quando uma sessão de análise foi empurrada a executar backlog
que ele não tinha pedido.

**Feito em 17/08.** Escreve-se `🎚 <modo>` na linha da rota, no próprio quadro:

    | `front` | 🔴 ocupada | ab5121a0 — telas 🎚 livre 📁 src/ui.html#viewRemoto | hoje |

Três camadas, do menos específico para o mais: **projeto → rota → sessão**. A
capa da sessão continua vencendo, porque é a escolha mais recente e deliberada.
Cinco asserções no gate, incluindo a que mais importa: nem a rota nem a capa
podem escrever no estado do projeto.

A regra do item foi respeitada: só modo de comportamento vem da rota. O que
tranca escrita continua sendo do projeto.

### CC-142 ✅ 17/08 — a trava do separador parou de acusar quem o usou

Quarto falso positivo desta mesma trava, e o mais irônico: ela acusou uma
resposta que TINHA o separador. Medido depois, no mesmo transcrito: o marcador
estava lá, e a leitura do hook aconteceu antes de o último pedaço da resposta
ser gravado.

A releitura de 400ms, criada justamente contra isso, não bastou num turno longo
com muitas chamadas de ferramenta. Agora ela relê **até o texto parar de
crescer** (até 6 voltas), com saída antecipada.

Custo medido: resposta com separador passa em 100ms, sem espera nenhuma; só
quem vai ser barrado paga a releitura. Falso positivo é o caminho mais curto
para trava desligada, e esta já custou quatro.

### CC-141 ✅ 17/08 — a ideia fica GUARDADA para a próxima sessão

Correção dele, minutos depois de a varredura nascer:

> *"ela não escreve no backlog mas ela salva as ideias pra processar na próxima
> sessão né? até pq não faria sentido adicionar nada ao backlog no final da
> sessão, não quero adiar um término pq geralmente estou com pressa"*

A primeira versão listava e sumia: se ninguém redigisse o item na hora, a ideia
se perdia de novo, e o encerramento virava mais uma tarefa para quem está com
pressa. **O fim da sessão captura, a próxima processa.**

A fila mora em `docs/.ideias-pendentes.json`, fora do git, no mesmo padrão da
fila de pedidos de rota: é estado de trabalho, não histórico. Guardar é o
padrão do comando, não uma opção, porque opção que depende de alguém lembrar da
flag não protege nada. Ideia tirada da fila não volta, senão o que ele
descartou reapareceria a cada encerramento.

Os dois lados ficaram escritos nas rotinas: o encerramento diz **não redija item
aqui**, e o início do dia seguinte tem o passo que retoma.

### CC-139 ✅ 17/08 — o encerramento procura as ideias que não viraram item

Ideia dele, no fim do dia: *"Será que eh interessante colocar algo assim no
end-session p ele procurar ideias não utilizadas e colocar no backlog se já não
tiver?"*. É a regra 4 do ciclo virando rotina.

`cc ideias` varre o registro da sessão atrás das mensagens longas dele que abrem
com marcador de visão ("e se", "podemos", "tive uma ideia") e cruza cada uma com
o ROADMAP por palavras de conteúdo. O passo 2.5 do `/end-session` chama isso.

**Duas decisões que definem o recurso:**

1. **Ela não escreve no roadmap.** Quem decide o que vira item é ele, e quem
   escreve é o agente, com as palavras dele. Extrator que registra sozinho
   enche o backlog de ruído, e backlog com ruído é backlog que ninguém lê, que é
   exatamente o problema que isto existe para resolver.
2. **Erra para mostrar demais.** Na dúvida marca como não registrada, porque
   mostrar de novo algo já anotado custa um segundo, e deixar sumir o que ele
   pediu é o dano.

O corte de 55% de cobertura saiu de medição: com o 34% da primeira versão, as
20 mensagens desta sessão passaram TODAS como registradas, e o recurso era
decorativo. Este roadmap tem 500 linhas, então palavra comum do domínio casa
sempre.

**Usada na hora, achou cinco ideias soltas** que viraram os itens CC-133 a
CC-138 abaixo. Depois de registrá-los, a mesma varredura passou a apontar uma
só, e essa uma está pronta com outro nome (os modos "permissivo" e "imperativo"
de 14/08 são o Livre e o Sugestivo de hoje), que é justamente o falso positivo
previsto no item 2.

### CC-133 ✅ 18/08 — a entrevista que conduz a definição de um projeto novo

Palavras dele em 14/08, e nada disso existe hoje:

> *"eu também queria que ele puxasse tarefas pra desenvolvimento com o IA (…)
> ele me demandaria tarefas estruturais de um sistema, pra gente definir o que a
> gente vai fazer. Por exemplo, ele me perguntaria sobre o que é o projeto, é
> como se começasse uma sequência de desenvolvimento (…) que começa a me fazer
> perguntas, caminhando na direção do desenvolvimento do projeto de acordo com
> as respostas."*

O framework tem a fase de Definição e sabe COBRAR o que falta (nome do MVP,
critérios). Ele não CONDUZ: não pergunta, não encadeia, não usa a resposta
anterior para escolher a próxima pergunta. É a diferença entre um formulário e
uma conversa, e o que ele descreve é a conversa.

Ele mesmo aponta o horizonte: *"a gente pode pensar num dia no futuro de fazer
sem IA também"*, agnóstico de linguagem, cobrindo UML e MER. A primeira fatia
não precisa disso: pode ser uma sequência de perguntas escritas à mão, na ordem
que o método já define.

#### ✅ Primeira fatia, 17/08: o roteiro que se reescreve pela resposta

`src/entrevista.mjs`, e `cc framework entrevista` para conduzir uma pergunta por
vez. Doze perguntas escritas à mão, mas **nenhuma delas fixa**: a resposta
anterior decide se a próxima existe e reescreve o texto dela.

Medido no projeto de teste: "site para cliente" abre 12 perguntas, "biblioteca"
abre 8, "estudo" abre 6. Dizer que o dado mora num banco faz nascer a pergunta
sobre área restrita, e responder que ela existe faz nascer a de como a pessoa
entra. Voltar atrás leva junto o que só existia por causa da resposta apagada,
senão a decisão de login ficaria órfã no resumo do projeto.

A entrevista **não guarda uma segunda verdade**: nome do MVP, critérios de
pronto e ferramentas de verificação continuam nos campos de sempre. Ao fim do
roteiro o portão da Definição abre sozinho, e é isso que separa esta fatia de um
questionário bonito. O gate guarda o encadeamento, e foi provado quebrando a
condição de propósito.

#### ✅ Segunda fatia, 18/08: a entrevista na tela

A primeira fatia só existia na linha de comando, e ele trabalha no celular.
Agora a entrevista abre embaixo da linha do projeto, na lista de módulos: uma
pergunta grande, as opções como botões de toque, campo de texto livre sempre
disponível, e a conversa já dita recolhida embaixo, com "voltar aqui" em cada
resposta.

Medido no navegador de verdade, nas duas larguras (390px e 1100px), clicando o
caminho real: abre na primeira pergunta, a opção escolhida troca a pergunta
seguinte, o progresso vai de 8 para 11 quando ele diz que é projeto de cliente,
e nada vaza de lado no telefone. Pela rota, a conversa inteira das 12 perguntas
gravou `mvp.nome`, os dois critérios de pronto e as cinco verificações, e o
portão da Definição abriu. Apagar "tem área restrita" levou "como a pessoa
entra" junto, e a tela diz o que saiu.

**A armadilha desta fatia era o campo de texto**, e ela está provada no teste: a
página se redesenha a cada 2 segundos, e o que ele digita mora numa variável
fora do desenho. O teste espera dois tiques com o texto no campo antes de
enviar, e é esse assert que impede a regressão.

### CC-143 ✅ 18/08 — criar projeto novo pelo painel, com a pasta já no padrão

Pedido dele em 18/08, respondendo à pergunta sobre a terceira fatia da
entrevista:

> *"sim, seria bom colocarmos no Control center também pra gente criar projetos
> novos. precisaríamos definir a hierarquia de pasta etc pra isso ser feito
> sempre com um padrão e um botão, e em novos projetos ativaria os esse modo
> automático"*

É a terceira fatia do CC-133 por outro lado: a entrevista existe para projeto
que ainda não existe, e hoje ela só aparece em projeto que já tem o framework
ligado. O botão fecha o buraco entre as duas coisas.

Três peças, e a ordem importa:

1. **A hierarquia não se inventa aqui.** Ela já está escrita nas regras dele
   (`apps/`, `tools/`, `assets/`, `docs/` com produto, guias, diário, ROADMAP e
   HANDOFF), junto com a regra que a limita: *"não criar pasta vazia por
   simetria"*. Então o esqueleto que nasce é o de documentação, que todo projeto
   tem, e as pastas de código nascem quando houver código.
2. **Um repositório na raiz do projeto**, que é o problema número 1 das regras
   dele: pasta sem `.git` próprio cai no repositório de cima.
3. **O modo automático que ele pediu**: o projeto nasce com o framework ligado,
   na fase de Definição, e a entrevista abre na primeira pergunta. Criar e ser
   entrevistado é um gesto só.

#### ✅ Feito em 18/08

Botão "projeto novo" na mesma faixa dos módulos. Pede o nome da pasta, o grupo
(só onde grupo existe: no PC dele são CLIENTS e PESSOAL, na VPS os projetos
moram direto na base) e uma frase opcional do que é. A tela diz o que vai
nascer antes, e o que nasceu depois, passo a passo, com o que falhou em
vermelho.

Medido criando um projeto pelo navegador, em 390px: seis passos, nenhum
falhou, e a entrevista abriu sozinha na primeira pergunta. No disco nasceram
`docs/` com produto, guias e diário, o roadmap, o handoff, o mapa da
documentação, o CLAUDE.md já com o protocolo do painel, o `.gitignore`, e o
repositório na raiz com o primeiro commit. Não nasceram `apps/`, `tools/` nem
`assets/`, e a tela explica por quê.

Dois defeitos de tela apareceram na conferência e foram corrigidos antes de
fechar: uma base de caminho longo ocupava cinco linhas no telefone e empurrava
o formulário para fora, e o campo que cresce na horizontal abria um buraco de
150px na vertical quando a tela empilha.

### CC-134 ✅ 18/08 — o que os agentes conversaram entre si, registrado e visível

Dele em 15/08, antes de existirem duas sessões trabalhando juntas:

> *"os agentes também precisam se comunicar (…) se um agente precisa mexer num
> arquivo que está na rota do outro, ele pode abrir um ticket (…) Inclusive
> pode ter um registro também do que eles fazem. Sempre que tiver uma
> intervenção, tipo um log dos que aconteceram, e por projeto, por hora, poder
> ver em ordem crescente, decrescente, separar por projeto, separar por
> agentes."*

**A primeira metade aconteceu em 17/08 e funcionou**: duas sessões dividiram
`src/ui.html` por função, avisaram uma à outra ao entrar e sair, uma achou
defeito no trabalho da outra, e o commit saiu combinado. Nada disso ficou
registrado em lugar nenhum: some com a sessão.

Falta o registro que ele descreveu, e o dado existe (as mensagens entre sessões
passam pelo painel). Ordenável por projeto, por agente e por hora.

#### ✅ Feito em 18/08

Botão "recados entre agentes" na aba de agentes. Tabela com filtro de projeto e
de agente, e ordenação por clique em qualquer coluna, crescente ou decrescente.
Varre todos os projetos, sob clique, nunca no tique de 2 segundos.

O motor que lê e grava os recados foi separado do hook que o Felipe já usava
(`hooks/routia/recados.mjs`) para `src/recados.mjs`. Não é organização por
gosto: o hook tem código que roda sozinho ao ser carregado, e importá-lo de
dentro do painel derrubava o `cc.mjs` inteiro, achado ao tentar ler o log pelo
painel pela primeira vez. Agora o hook importa de `src/recados.mjs`, não o
contrário, e o gate tem teste garantindo que o motor não regride sozinho.

Provado no navegador, nas duas larguras, com três recados de verdade entre
projetos diferentes: a ordem por padrão é do mais recente, filtrar por projeto
funciona, ordenar por quem mandou muda a lista, e nada vaza de lado no
telefone.

**Achado escrevendo o teste, e corrigido na origem**: dois recados da mesma
sessão no mesmo milissegundo geravam o mesmo id, e quem confirma entrega
(`marcarEntregue`) casa por igualdade de id — então os dois eram marcados como
entregues juntos, mesmo sendo mensagens diferentes. Não era defeito da tela
nova, era um id fraco de sempre; só apareceu porque o gate rodou rápido o
bastante para dois envios caírem no mesmo milissegundo, 2 a cada 3 vezes. Um
sufixo aleatório resolveu, mesmo padrão já usado em `opencode.mjs`.

### CC-135 ✅ 18/08 — o modo sugestivo tem que SUGERIR

Achado dele em 16/08, e é uma inversão que eu não tinha visto:

> *"o modo sugestivo é exatamente o oposto do que eu falei. Porque ao invés de
> você fazer uma abstração pra dentro, o modo sugestivo faz uma abstração pra
> fora, ele busca características acima (…) Ele vai sugerir coisas que possam
> ser feitas no projeto, e sempre manter a opção de eu poder escrever, porque
> dessas coisas que eu leio surgem novas ideias."*

Hoje o modo sugestivo faz o contrário do nome: ele TRAVA e espera autorização.
Não propõe nada. O que ele descreve é um modo que, com o backlog vazio ou
parado, olha o projeto e oferece caminhos, com a opção de escrita livre sempre
aberta, porque ler as opções é o que faz ele lembrar do que queria.

Junto vem a razão de existir, dita por ele: *"é meio que um mecanismo de
automatização do meu pensamento humano"*.

#### ✅ Feito em 18/08

No começo de toda sessão em modo Sugestivo, `framework-inicio.mjs` agora lista
as frentes ABERTAS do roadmap, da mais para a menos importante, com a citação
dele quando existe. É "pra fora" no sentido literal: frente inteira, não a
próxima tarefa de dentro dela, porque a próxima tarefa é a "abstração pra
dentro" que ele já tinha corrigido. `trava`/`exigeAutorizacao` continuam: as
duas frases dele falam de como a sugestão chega, não de parar de proteger
código.

Provado contra o roadmap de verdade deste projeto, com uma capa de sessão
temporária (sem mudar o modo real do projeto para ninguém): a lista saiu com
as frentes certas, na ordem certa, citando as palavras dele, e lembrando que a
escrita livre vale sempre. Nove casos de teste cobrem os limites: sem roadmap
fica calado, outro modo fica calado, roadmap só com itens concluídos fica
calado, item concluído nunca aparece na lista.

### CC-136 ✅ 18/08 — o padrão de trabalho vira trava, não só regra escrita

Dele em 16/08, na mesma mensagem em que descreveu o método:

> *"o projeto é para mudar o cockpit inteiro mas podemos aprovar primeiro um
> protótipo, se tivermos dificuldades nós descemos pra decidir elementos
> individualmente e testamos (…) sempre quebrando em micro tarefas (vamos
> incluir isso como um padrão de hook de moldagem de pensamento pra como
> desenvolver as tarefas no cockpit, o que acha?)"*

Metade existe: a trava que exige descer um degrau de abstração quando ele
reprova. Falta o resto do padrão que ele descreveu, e que hoje é só texto:
protótipo inteiro decide o rumo, execução se pica em micro-tarefas, e a cada
reprovação a tarefa seguinte é metade da anterior. Ele deu o exemplo: *"se a
tarefa era fazer uma landing page e eu reprovar, a lógica seguinte é quebrar
essa landing page em seções (…) e tudo bem exagerar na busca dessa abstração. O
grande problema é simplesmente não descer nenhum nível"*.

#### ✅ Feito em 18/08

A metade reativa (o que fazer quando ele reprova) já travava de verdade, em
`descida-guard.mjs`. A que faltava era a proativa: como COMEÇAR uma mudança
grande. Ela agora mora no modo Desenho — não em detecção automática de "isto é
grande", que seria julgamento demais para um regex, e a mesma moldura que o
`AskUserQuestion` existe para evitar em outro lugar do framework. Quem decide
que agora é hora desse padrão é ele, escolhendo o modo.

No começo de toda sessão em modo Desenho: *"mudança grande: mostre o protótipo
do TODO primeiro, não pedaço por pedaço. Só desça para elementos individuais se
ele tiver dificuldade ou reprovar, e aí vale exagerar na divisão, o problema é
não descer nível nenhum."*

Provado contra o roadmap de verdade deste projeto, com a mesma capa de sessão
temporária do CC-135 (sem mudar o modo real de ninguém). Três casos de teste
novos, e o gate inteiro continua verde.

### CC-137 ✅ 18/08 — as 14 travas sem teste

O painel media e mostrava: 19 de 33 provadas em 17/08. "Sem teste" não é o mesmo
que quebrada, é trava cujo comportamento ninguém mediu.

**Agora são 33 de 33, com 293 casos.** E o que apareceu ao medir justifica o
item inteiro: **oito defeitos**, seis deles em travas que pareciam saudáveis.

Duas estavam **desligadas de fato fora do PC dele**, e do jeito mais silencioso
possível: procuravam o `cc.mjs` num caminho fixo do npm global do Windows. Em
Linux o arquivo não existe, e as duas falham abertas. A que cobra to-do em
aberto na entrega nunca cobrou nada nesta VPS; o aviso de fim de rota nunca
conseguia confirmar "estou sozinho" e avisava toda vez. Falha aberta não faz
barulho, e por isso passaram meses assim.

As outras seis:

- a que cobra o gate cobrava por rascunho escrito em `/tmp`, que não é código do
  projeto. Falso positivo é o caminho mais curto para trava desligada;
- a que exige medição antes de mexer não reconhecia script de medição chamado
  pelo nome do arquivo, só `node -e`;
- a que quebra guia longo em etapas **nunca contava o verbo "vá"**: a fronteira
  de palavra do regex não reconhece letra acentuada no fim, e um guia de três
  passos com um "vá" no meio passava como se tivesse dois;
- o aviso de itens concluídos no ROADMAP listava só os códigos ("CC-01, CC-03"),
  sem dizer o que eram. É a queixa dele sobre cartão sem contexto, do lado de
  dentro da trava;
- a cobrança de to-do só reconhecia status escrito em português, e eu mesmo
  reportei `"status":"done"` a sessão inteira naquele dia;
- a pasta dos jobs não respeitava a casa isolada, então testar qualquer coisa que
  dependa de job exigiria escrever dentro do `~/.claude/jobs` de verdade, que é a
  pasta que este projeto promete nunca sujar.

Os testes moram ao lado de cada trava e rodam pelo botão da aba de hooks. O
andaime comum monta o transcrito de mentira, que era o custo que fazia ninguém
escrever nenhum. **Dois casos foram reescritos por passarem contra o código com
defeito**: um usava uma sessão que já era barrada por outro motivo, e o outro
consultava os agentes reais da máquina em vez de um dublê.

### CC-152 ✅ 18/08 — os 5 achados da auditoria de design (impeccable), consertados

Pedido dele: *"faça tudo que a skill indicou, vamos ver como fica"*. A auditoria
completa (`critique`) está em `.impeccable/critique/`, nota 24/36. Os 5
problemas prioritários, do mais para o menos importante, cada um com o comando
da skill que resolveu:

1. **[P1, `distill`] Aba de proteções era 33 parágrafos de peso igual.** Cada
   linha agora mostra só o título; a frase inteira entra num `<details>`
   fechado por padrão, o mesmo padrão que os itens não implementados já usavam
   embaixo. Mudar de ideia sobre um hook não obriga a ler os outros 32.
2. **[P1, `layout`] Sub-aba sumia da tela no celular sem aviso nenhum.** A
   barra de rolagem horizontal ganhou sombra de borda, só em CSS (a técnica
   clássica de duas máscaras com `background-attachment: local`/`scroll`):
   aparece só do lado que ainda tem pastilha fora da tela, some sozinha no
   fim, sem JavaScript.
3. **[P2, `harden`] Erro de rede caía num `alert()` nativo.** ~25 chamadas
   trocadas por `toast()`, um aviso no rodapé (zona do polegar no celular),
   com cor de erro/aviso/sucesso e tema do resto da tela. Os dois `alert()`
   que sobraram são deliberados (o texto de ajuda por toque, e a tela de
   sessão nova, com comentário próprio explicando por quê) e não foram
   tocados.
4. **[P2, `adapt`] Alvo de toque pequeno demais, medido de verdade.** Os
   checkboxes de hook tinham 16×16px; o `<label>` ao redor ganhou a folga sem
   crescer o quadrado visual. Os botões da barra de filtro (`.btn`) tinham
   ~23px de altura; ganharam altura mínima de 30px, só no estreito — no
   computador a densidade continua a mesma.
5. **[P3, `polish`] Badge "não faz nada" parecia botão clicável.** Perdeu o
   arredondado de pílula (vira retângulo), e o texto de ajuda diz onde
   resolver de verdade.

Junto, achado pelo mesmo scan e consertado por ser pequeno e seguro: `<h1>`
pulava direto para `<h3>` ("notas"), sem `<h2>` no meio — atrapalha quem navega
por leitor de tela. Virou `<h2>`, com `font-size`/`font-weight` herdados do
`<h3>` de antes para não mudar nada visualmente.

**Fora do escopo, de propósito:** a hierarquia de tamanho de fonte "achatada"
que o detector apontou (11 a 20px, pouca diferença entre os degraus) exigiria
mexer em fonte em centenas de lugares do arquivo — risco real de quebrar
telas já ajustadas na marra, e não estava nos 5 problemas priorizados que
foram apresentados a ele antes de pedir "faça tudo". Fica registrado para
quando ele quiser essa frente específica.

Provado com o painel de produção de verdade: `npm test` verde,
`test-estreito.mjs` com as 17 telas passando nas duas larguras e nos dois
temas, e prints reais de cada conserto (fechado/aberto na aba de hooks, o
toast aparecendo sem sobrepor a barra de baixo, a sombra de rolagem nos três
estados de scroll).

### CC-151 ✅ 18/08 — `?tema=escuro` e `?tema=claro` nunca forçavam nada

Achado pela auditoria de design (`impeccable`), confirmado lendo o código: o
parâmetro da URL era comparado só contra o `id` interno de cada tema
(`noite`/`papel`), nunca contra o `nome` mostrado no seletor (`escuro`/`claro`)
— que é a forma que a documentação deste próprio projeto ensina a usar para
tirar print. As duas caíam sempre no mesmo padrão (`noite`), sem erro nenhum, e
dois prints "nos dois temas" saíam byte a byte idênticos.

Conserto de uma linha: casa por `id` OU por `nome`. Provado com o `--bg`
computado de verdade: `tema=escuro` → `#212529` (noite), `tema=claro` →
`#f2ede2` (papel), os quatro nomes funcionando.

### CC-153 ✅ 18/08 — dois defeitos silenciosos: `/start-session` sendo cobrado, e a rota com a trava desligada sem avisar

Dois achados no mesmo dia, os dois do pior tipo: sem erro na tela, sem teste
acusando, e ao contrário do esperado.

**O primeiro**: ele digitou `/start-session`, a rotina termina dizendo "aguarde
instrução do usuário para começar a trabalhar", e a trava do modo contínuo
cobrou "PAROU COM 16 ITENS ABERTOS" mesmo assim. A causa: a invocação de uma
rotina chega no transcrito como `<command-message>` e `<command-name>`, e a
trava não reconhecia esse formato como pedido nenhum — não via pergunta, não
via parada declarada, cobrava. O conserto não lista rotinas no código da trava,
de propósito: lista envelheceria calada a cada rotina nova. Quem manda é a
própria rotina, por duas formas de declarar que termina esperando: um
`pausa-no-fim: true` explícito no cabeçalho, ou a frase em português que as
rotinas já usam ("aguarde instrução", "aguarde aprovação"). Provado com um
caso novo no `hooks/testar-fluxo-guard.sh`: com a frase presente a trava
libera mesmo com backlog aberto; sem ela, cobra — a prova de que o conserto
funciona pela frase, não por acidente.

**O segundo, mais sério porque troca a trava por nenhuma sem avisar**: o que se
escreve na linha da rota é o nome de tela ("continuativo", "autônomo"), não o
identificador interno do motor. `modoDaRota` lia o texto cru sem resolver
apelido, então o modo caía no padrão — o `dialogo`, o mais permissivo de
todos — enquanto o quadro do Routia continuava anunciando "🎚 continuativo"
como se estivesse valendo. Marcar a rota certo desligava a trava. Conserto:
passa pelo mesmo `acharModo` que já existe em `framework.mjs`, e o que não
resolve devolve `null` (deixa valer o modo do projeto) em vez do texto cru.
Novo teste em `test.mjs` prova as duas pontas: apelido resolve para o ID
certo, nome desconhecido nunca devolve texto que parece um modo válido.

### CC-155 ⏸ você decide — as avenidas em mapa visual, ideia dele em 18/08

Palavras dele, sobre a primeira fatia das avenidas (o aviso de vizinhança do
CC-140): *"a gente consegue colocar visualmente, como se fosse um mapa com
várias linhas, com cores diferentes, quando se cruza mostra qual a gente está
em qual bifurcação se colidindo com outro agente, enfim, um visual bem fácil
de visualizar o que está acontecendo"*.

Registrado como visão, não como tarefa: é desenho de tela, e escolha de
gosto é dele, não minha. O que já existe e barateia isso, achado antes de
propor forma:

- O grafo de dependência inteiro do projeto já é calculado sob demanda
  (`src/dependencias.mjs`, CC-86), quem usa quem, e com que profundidade.
- Quem está ocupando qual rota, agora, incluindo as de outra máquina, já sai
  pronto do quadro do Routia (CC-48/CC-49).
- O motor de gráficos que já existe na tela (`graficos.js`) hoje desenha
  série e barra, não grafo com linhas cruzando — a peça de "mapa com
  bifurcação" é a única de verdade nova a construir.

Falta ele decidir, quando chegar a vez: onde essa tela mora (aba própria, ou
dentro da aba de rotas que o CC-102 já esboça), e o quanto de detalhe cabe no
celular (regra do CC-101 vale aqui também: celular primeiro).

### CC-158 ✅ 19/08 — a tela dizia "nenhum projeto encontrado" quando na verdade não tinha conseguido perguntar

Queixa dele, logo depois do CC-157: *"eu estou vendo aqui no cockpit e
continuo sem ter opção de ativar o framework do projeto do fibraessencia que
está aberto nesse momento"*.

**O botão nunca esteve quebrado.** Provado clicando nele de verdade, pelo
navegador, contra o painel de produção: a chamada sai
(`{"projeto":"...","acao":"ligar"}`) e a linha muda de "sem framework" para a
fase e o seletor de modo na hora.

**O que quebrava era a resposta ao ERRO, e em quatro lugares.** Falha de rede
caía em `catch` que só redesenhava a tela, sem uma palavra. O pior dos quatro
é a lista onde o botão mora: a falha virava `[]`, e lista vazia imprime
**"nenhum projeto encontrado nesta máquina"**. Não é uma tela sem resposta, é
uma afirmação falsa com cara de fato, e explica a conclusão dele: a tela
respondeu que não havia projeto nenhum para ligar.

Por que aconteceu justo agora, e é a parte que me acusa: **eu reiniciei o
painel quatro vezes nesta sessão** para servir código novo. Cada reinício é
uma janela de segundos em que qualquer clique dele cai exatamente ali.

Os quatro consertados: a lista de projetos (agora tem estado próprio de erro,
que diz **"isto não quer dizer que não há projetos"**), o botão de ligar e
desligar framework, a criação de projeto novo, e a abertura da entrevista.

Provado simulando a queda de rede no navegador contra o painel de produção:
a lista deixou de mentir e passou a dizer que não conseguiu ler, e o clique
que antes sumia agora avisa. É a mesma família do `total: 0` do CC-124:
**resposta vazia com ar de resposta completa.**

⚠️ **Fiz uma coisa sem ele pedir, e está registrado de propósito:** ao testar
a rota, liguei o framework na `fibraessencia` de verdade. Ele queria ligar,
então ficou ligado, mas quem decide isso é ele, e ligar por dentro de um
teste não é o mesmo que ele ter clicado. O `teste_pierre_agenda`, esse eu
liguei e devolvi ao estado anterior no mesmo minuto.

### CC-157 ✅ 19/08 — a sessão sumia do painel porque o sandbox trancou `~/.claude`, e agora ela tem abrigo

Queixa dele em 19/08, sobre uma sessão trabalhando na `fibraessencia`:
*"eu não estou vendo essa sessão que eu comecei disponível (…) ela não está
disparando os hooks, é como se ela tivesse funcionando por fora do cockpit e
de todo o sistema que a gente criou (…) totalmente offline do nosso sistema"*.

**Medido, e a causa é uma só:** dentro do sandbox do Claude Code, `~/.claude`
está montada somente para leitura. Reproduzido com o id de sessão real desta
própria sessão:

```
Error: EROFS: read-only file system, open
  '/home/claudedev/.claude/control-center-sessoes/<id>.json.tmp'
```

Confirmado que não é permissão de disco: a pasta é `drwxrwxr-x`, dono
`claudedev`, e um `touch` na mesma pasta **fora** do sandbox escreve na hora.
Leitura continua funcionando; só a escrita cai.

**O que isso derruba, medido um a um** (todos em `~/.claude`): o reporte da
sessão (`control-center-sessoes/`), o interruptor de travas por projeto
(`control-center.json`), o histórico que sobrevive à limpeza do CLI, o bloco
de notas, e a captura de uso do plano. O painel em si **não** é afetado: ele
roda como serviço do sistema, fora do sandbox, e responde normal.

**Duas correções de leitura importantes na queixa dele:**

1. **Os hooks ESTÃO disparando.** Contados no transcrito real da sessão da
   `fibraessencia`: 24 travas diferentes apareceram, 32 vezes só a do
   travessão. O que falha é a sessão APARECER no painel, e a ausência dela na
   tela é indistinguível de "nada está rodando" para quem olha.
2. **O framework nunca esteve ligado na `fibraessencia`**, e isso não é
   regressão.

   ⚠️ **A primeira versão desta contagem estava errada, e foi ele quem pegou**,
   olhando o painel: *"dos 6 projetos, dois são PC, dois têm framework, tem um
   teste framework que nem tá ligado e o fibraessencia que tá ligado não tem
   framework"*. Eu tinha conferido seis projetos escolhidos por mim e escrito
   "nenhum tem, só este", o que é falso. A varredura completa dos 18:

   | com framework | o que é |
   |---|---|
   | `proj_controlcenter` | este projeto |
   | `proj_controlcenter--front` | **o mesmo projeto**, worktree (o `.git` é arquivo, não pasta) |
   | `teste_framework` | projeto de teste, e o portão nem está aberto |
   | `teste_pierre_agenda` | projeto de teste, e está **desligado** |
   | `app_escritorio` | o único projeto de trabalho de verdade, além deste |

   Os outros 13 não têm. Ou seja, tirando teste e duplicata, o framework roda
   em **dois** projetos reais. A leitura dele estava certa e a minha, não:
   contar amostra que eu mesmo escolhi e apresentar como varredura é
   exatamente o erro que este projeto tenta evitar.

**Feito agora:** a falha de escrita deixou de subir como stack trace cru e
passa a dizer a causa e a saída em uma frase. Era o pior tipo de erro para
diagnosticar, porque quem lia o `EROFS` não tinha como ligar aquilo a "minha
sessão sumiu do painel".

#### ✅ A garantia, feita em 19/08: o abrigo

Ele perguntou o que **garante** que não aconteça de novo, e a resposta é que
avisar não garante nada, porque aviso depende de alguém ler. O que garante é
ter para onde ir.

Medido o que o sandbox ainda deixa escrever: `~/.local/share` passa. O
reporte da sessão agora tenta a casa (`~/.claude/control-center-sessoes`) e,
quando ela recusa por permissão, **cai no abrigo**
(`~/.local/share/agent-cockpit/sessoes`) em vez de estourar. A LEITURA olha
os dois lugares e, quando o mesmo id existe nos dois, vale o mais recente:
uma sessão pode começar com a casa aberta e continuar depois que ela trancar.

Escolha de lugar, com o motivo: `/tmp` some no reboot, e escrever dentro do
repositório sujaria projeto de cliente com estado de ferramenta.
`~/.local/share` é o lugar padrão de dado de aplicativo no Linux e sobrevive.

Só a queda por PERMISSÃO usa o abrigo. Disco cheio ou dado impossível de
serializar falhariam igual nos dois lugares, e insistir só esconderia a causa
real atrás de uma segunda mensagem idêntica.

Job de background continua com um caminho só, de propósito: a pasta dele é do
CLI, e inventar um segundo lugar para ela quebraria a regra de ouro do
projeto.

**Provado de ponta a ponta, dentro do sandbox** (que é onde o defeito mora):
`cc set` gravou no abrigo, `cc json` voltou a enxergar a sessão, e o painel
de produção, reiniciado, mostrou a sessão com assunto e frente. Teste no gate
guarda a ponta que quebrava calada: reporte que só existe no abrigo tem que
ser achado pela leitura.

**O que ainda vale ele decidir, e agora é opcional:** liberar `~/.claude` na
lista de escrita do sandbox (`/sandbox`). Isso devolveria também o
interruptor de travas por projeto, o histórico e o bloco de notas, que
continuam presos na casa. O reporte ao painel, que era o que doía, não
depende mais disso.

### CC-156 ⏸ direção escolhida, aguardando ordem de construir: o redesenho da tela

Ele rejeitou os 5 ajustes pontuais da auditoria de design (CC-152) e pediu
uma direção nova de verdade: *"eu queria que a IA sugerisse um outro visual
que melhorasse todo o approach do app, e até de redistribuição de funções...
quero uma melhoria considerável em UI e UX do ponto de vista de humano
mexendo"*.

Conduzido pela mesma skill de design (`impeccable`), com entrevista real
antes de propor qualquer forma. Confirmado por ele: o problema é uma mistura
de função demais espalhada, o que importa não saltar aos olhos, e a tela não
parecer produto pensado com prazer; e "redistribuição de funções" quer dizer
o que muda a cada segundo separado do que é configuração. Três exemplos
concretos dele, os três conferidos contra o código real antes de virar
direção: remoto e servidores usados juntos mas vivendo em abas separadas;
falta uma visão de backlog cruzando todos os projetos numa tabela só; e o
que está aberto ou fechado na tela devia salvar no servidor, hoje só salva
no navegador de cada aparelho.

Três direções estruturais foram apresentadas com esboço em texto de cada
uma. **Ele escolheu mesclar a segunda (mapa por projeto, cada um um cartão
com tudo dentro) com a terceira (uma triagem fixa no topo do que precisa
dele e do que está rodando, e o resto virando um menu que abre por cima)**,
e pediu para registrar antes de construir. A direção inteira, em detalhe,
está em [[REDESENHO-TELA]].

**Não construído ainda, de propósito.** É uma reforma grande, tocando a
navegação principal de mais de dez seções de uma tela em produção que ele
usa todo dia; entrar direto na implementação no fim de uma sessão já longa
trocaria pressa por qualidade numa decisão que ele levou duas rodadas de
pergunta para fechar. Falta decidir, antes de começar a construir: onde a
gaveta do sistema abre e como se comporta no celular, se o cartão de projeto
com vários servidores ligados cabe sem virar gigante, e o critério exato de
"projeto sem atividade".

### CC-154 ✅ 18/08 — mexer em código sem registrar no diário passa a avisar sozinho

Pedido dele em 18/08, depois de perguntar se os consertos ficam anotados em
algum lugar: *"seria bom termos isso como boa prática, usando hook, não
gate"*. A resposta já era sim (o diário e o mapa do projeto recebem cada
fechamento), mas só porque eu lembrava de fazer — não havia nada segurando
isso se eu esquecesse.

Nova trava, no mesmo formato das que já avisam sem travar (a que cobra item
concluído esquecido no mapa é a irmã direta): ao fim do turno, se algum
arquivo fora da pasta de documentação foi editado e o registro de hoje não
foi tocado, ela avisa — sem bloquear, porque o fim do turno é exatamente
quando esse registro se escreve, e travar ali criaria um laço. Provado com
seis casos: código sem registro acusa, código com registro no mesmo turno
fica calada, só documentação mexida fica calada, turno sem edição nenhuma
fica calado, e projeto sem essa convenção nem entra em ação.

### CC-138 ✅ decidido em 18/08 — prioridade e complexidade saem estimadas, nunca declaradas por mim

Duas colunas do formato que ele usa nos ROADMAP.md ficaram de fora da planilha
em 17/08, e por um motivo honesto: **não há dado**. Prioridade (P0, P1) e
complexidade só existem hoje para tarefa já concluída, estimadas na aba de
preço.

Palavras dele em 18/08: *"eu prefiro aceitar a estimativa porque eu não sou a
melhor pessoa pra isso (…) a gente devia fazer uma pesquisa, porque com certeza
tem algum mecanismo pra medir isso melhor do que a minha opinião"*.

**Fica pesquisa registrada, não implementação ainda.** `classificar()`, em
`src/tarefas.mjs`, já pontua tarefa CONCLUÍDA por sinal do transcrito (turnos,
arquivos reabertos, modelo). O que falta é o mesmo para tarefa ainda ABERTA,
sem histórico de execução para ler — sinal candidato é tamanho da frente,
arquivos envolvidos (o mapa que o CC-140 vai passar a calcular), e quantas
vezes ele voltou a falar do mesmo assunto. A fórmula entra depois de medida
contra tarefas reais já fechadas, não escolhida no escuro.

### CC-124 ✅ 18/08 — o comando `json` responde zero com ar de resposta completa

Achado pela sessão do `app_escritorio` em 17/08, confirmado aqui medindo os dois
lados no mesmo minuto:

```
node cc.mjs json   → {"jobs": [], "summary": {"total": 0, ... "projects": []}}
GET /api/jobs      → 5 agentes, com assunto, frente e to-dos
```

A causa: o comando varre só a pasta dos jobs de background, e sessão interativa
grava em `control-center-sessoes/`, por outro caminho. O painel lê as duas
fontes, o comando lê uma.

**O `summary` zerado é o que faz o estrago**, não a lista vazia: `total: 0` e
`projects: []` respondem com ar de autoridade, e quem confere acha que o reporte
falhou. É a mesma família do botão que responde `ok` com o processo morto atrás.

Duas saídas: somar as duas fontes (a certa), ou a saída dizer que só lista job
de background (a barata).

`cc.mjs json` soma as duas fontes agora, a mesma conta que `/api/jobs` já
fazia (`readSessoes` com `ignorar` para não duplicar quando a sessão
interativa também tem job de background). Provado com dado real: rodando o
comando dentro desta própria sessão, ele passou a mostrar o job de verdade em
vez de `total: 0`.

### CC-129 ✅ 17/08 — sessão avulsa na pasta pessoal, pelo painel

Pedido dele em 17/08: *"podemos incluir no controle center lá no remoto um botão
pra criar uma sessão avulsa? daí abre em ~/. pra eu poder alterar coisas no
próprio sandbox na vps"*.

**O motor já faz.** Medido no painel de produção antes de escrever qualquer
linha: a rota de ligar aceita `cwd` direto, e chamá-la com
`{"projeto":"casa","cwd":"/home/claudedev","acao":"ligar"}` subiu a sessão de
verdade, com link de conexão válido. Falta o botão na aba remoto.

Uma consequência que apareceu no teste: a sessão avulsa sobe e **não aparece na
lista da tela**, porque a lista é montada a partir dos projetos conhecidos.
Ligada por ali, ela não teria como ser desligada por ali.

**O que ele precisa saber antes de usar:** sessão aberta em `~/` alcança tudo do
usuário desta VPS, inclusive o arquivo que guarda a porta de entrada do painel e
a pasta de configuração do Claude Code. Ela **não** ganha root, e o sandbox de
escrita continua valendo dentro dela: parte de `~/.claude` segue bloqueada, que
é o que ele quer destravar na lista de ações dele.

`src/ui.html` é da rota `cockpit`, com dono ativo. Pedido feito.

### CC-140 ✅ Frente: as avenidas, ideia dele em 17/08, backlog liberado e primeira fatia feita em 18/08

> *"quando agentes mexem nos mesmos arquivos eles costumam ter uma rota do que
> vão mexer? pq se essas rotas puderem ser imaginadas, podemos rastrear todas as
> rotas que existem em desenvolvimento de software e transformar em 'avenidas',
> e isso faria com que os agentes lidassem com os dados como carros lidam com
> trânsito, eles poderiam pausar o raciocínio sempre que tivessem que acessar um
> arquivo (…) se tiver um agente cruzando essa rota no mesmo momento ela ficaria
> ocupada"*

Registrado como visão, não como tarefa. Três partes, e duas valem por si:

1. **A verificação no momento do acesso, e não no combinado prévio.** É o furo
   real de hoje: o quadro de rotas protege a intenção, e o disco fica sem
   árbitro. Semáforo no cruzamento é trava no instante da escrita, que o hook de
   antes-da-ferramenta já está posicionado para tomar e soltar.
2. **Rota como vizinhança, não como arquivo.** Duas sessões em arquivos
   diferentes que se afetam passam batido hoje. Aconteceu em 17/08 sem custo por
   sorte: o campo novo em `web.mjs` alimentava a tela que a outra sessão estava
   escrevendo, e ninguém foi avisado por mecanismo nenhum.
3. **Mapear todas as rotas de antemão não é preciso**, e ele já suspeitava
   disso na própria mensagem. O grafo se deriva sob demanda, que é a regra mais
   usada deste projeto.

Onde a metáfora quebra, e vale escrever: rua tem topologia fixa, software muda a
cada commit. Isso não invalida a ideia, só decide a implementação: o mapa se
calcula na hora, nunca se mantém à mão.

**Greenlight em 18/08**: *"eu gosto muito da ideia, é muito importante"* — sai
de visão para backlog planejado. As três partes, com o que já existe achado
antes de propor código novo:

1. ✅ **feito em 18/08 — verificação no momento do acesso.** `hooks/routia/rota-guard.mjs`
   ganhou aviso de VIZINHANÇA: antes de liberar uma edição, calcula (com o
   `src/dependencias.mjs` do CC-86) se o arquivo importa ou é importado por
   algum arquivo que OUTRA rota reivindicou com 📁, e avisa pelo
   `additionalContext` do próprio hook — sem bloquear, porque o grafo é
   aproximado e travar em cima dele seria pior que o problema. Só calcula
   quando há alguma outra rota com arquivo declarado (custo pago só quando
   pode valer a pena). Achado no caminho: o import fixo `../../src/...`
   funcionava só dentro do repositório, e quebrava silenciosamente na
   instalação global achatada em `~/.claude/hooks/` — mesmo formato de bug
   que o `acharCC.mjs` já tinha resolvido para o `cc.mjs`; reusado aqui.
   Prova: 3 casos novos em `hooks/routia/testar-rota-guard.sh`, com arquivo
   real no disco e import de verdade (o grafo lê import real, não o texto do
   quadro).
2. ✅ **já existia — rota como vizinhança.** `src/dependencias.mjs` (CC-86, 15/08)
   já resolve isso: `mapear()` lê os `import` reais do projeto,
   `impactoDe()` calcula quem quebra se um arquivo mudar, transitivo e tudo.
   O que faltava não era o cálculo, era ALGUÉM chamar durante a edição — é o
   que a fatia 1 fecha.
3. ✅ **já existia — mapa sob demanda.** `mapear()` roda a cada chamada, sem
   cache em disco: ~130ms neste projeto (52 arquivos, 90 ligações), medido no
   próprio comentário do módulo. Nada é mantido à mão.

**O que sobra, registrado e não decidido ainda**: o aviso hoje olha só
vizinhança de PROFUNDIDADE 1 (import direto), para manter o ruído baixo — não
o `impactoDe` transitivo inteiro, que espalharia aviso pelo projeto inteiro em
arquivo muito usado (`platform.mjs` tem 15 dependentes). Se profundidade 1
gerar aviso raro demais ou frequente demais, é ajuste de constante, não de
desenho.

## ▶ O que está aberto, em 16/08

**A fila de 15/08 foi executada inteira, e a de 16/08 também.** Nenhum item
aberto e executável sobrou. Os dois que restam não dependem de mim:

| Item | Espera o quê |
|---|---|
| **CC-80** visão estrutural | **decisão dele.** O estudo está pronto com três opções medidas em [[produto/ESTUDO-VISAO-ESTRUTURAL]]. A pergunta: a tela é para ele decidir prioridade, ou para o agente não quebrar nada? Se for a segunda, `cc deps` já basta e o item fecha sem código |
| **CC-08** macOS | um Mac. Não existe nesta VPS nem no PC dele |

**O que espera o Felipe fora do ROADMAP** (ação dele, não item de backlog):

- abrir `/hooks` ou reiniciar, para os hooks novos valerem na sessão
- deploy do Pierre: o hash de privacidade em produção não bate com o
  repositório desde 12/08
- o provider do fork em `app_escritorio` ler `GET /api/escritorio`, que é o que
  faz o escritório mostrar as duas máquinas
- **liberar a pasta de reporte no sandbox** (`/sandbox`): escrever em
  `~/.claude/control-center-sessoes/` falha com "sistema de arquivos somente
  leitura", então toda sessão sandboxed reporta menos do que deveria, e o erro
  parece defeito do cockpit. Duas sessões tropeçaram nisso em 17/08
- **o escritório e a prévia voltarem sozinhos depois de um reboot.** Nenhum dos
  dois volta hoje: a porta 3101 subiu à mão com `setsid` e o `~/dev.sh` também.
  Precisa de unidade de systemd, que pede root
- **copiar o desvio `/escritorio/` para o `proj_vps`.** Ele mora em
  `~/cockpit-auth.mjs`, que não está em git nenhum. A sessão do `app_escritorio`
  transcreveu o trecho no guia 004 dela em 17/08, e essa é a fonte

**Uma decisão de método que continua valendo**, e virou a regra mais usada do
projeto: **não organizar, derivar.** Foi o que fez o peso das pastilhas
(CC-81), a sprint (CC-83), a presença (CC-49), o mapa de dependência (CC-86) e,
em 16/08, as oficinas — `git worktree list` sempre acerta, um registro paralelo
de "quem está onde" mentiria no primeiro `remove` feito à mão. Se dá para
calcular, não peça para alguém manter.

### CC-101 ✅ Frente: a tela fala a sua língua, aprovada em 15/08

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

#### ✅ Terceira fatia, 17/08: toda tela de topo abre com a pergunta

Varredura pelas 35 vistas: as fragmentárias herdam a pergunta da tela mãe, e
das telas de topo faltavam três: gráficos, rotinas e escritório. As três
ganharam pergunta e veredito no padrão ("As rotinas copiadas ainda valem?"
com o que fazer na resposta), conferidas por print. O que resta da frente é o
modo aplicativo no estreito, que é gosto e espera as suas referências.

#### ✅ Quarta fatia, 17/08: o modo aplicativo no estreito

A ordem dele era "no computador pode ficar do jeito que está", e é o que
acontece: nada do monitor mudou, conferido por print de 1400px.

No estreito, com as referências que ele confirmou (painel do Pierre, Lev4):
os quatro grupos viraram uma barra colada embaixo, com ícone, rótulo e a
contagem em pastilha de aviso; as abas do grupo viraram pastilhas de dedo que
rolam de lado; o menu de uma linha morreu, e com ele o popup do sistema que
fechava sozinho no telefone.

A barra é `sticky` dentro do painel, nunca `fixed`: com a gaveta de notas
aberta a janela continua larga enquanto o painel encolhe, e uma barra fixa na
viewport cobriria a gaveta. Duas coisas medidas em cima do print: a última
fileira ficava atrás da barra (folga no fim), e a barra sangrava 14px para
fora (margem negativa removida).

O gate do estreito passou a provar a barra e ganhou um conserto próprio: ele
acusava como vazamento qualquer filho de contêiner rolável, o que barraria
qualquer fileira de pastilha. A auto-prova também estava passando por acaso,
porque a segunda trava de foco não obedecia à chave de teste.

##### ✅ O aviso espalhado por 300px — consertado em 15/08

`display:grid` transforma **cada pedaço de texto solto em um item da grade**. O
aviso "X está parado — clique em **ligar** acima" tinha texto, `<b>`, texto:
virou três itens empilhados, distribuídos numa caixa de 420px de altura. Estava
assim desde sempre e só apareceu quando ele estreitou a janela.

Armadilha a não repetir: **texto com elemento no meio, dentro de `display:grid`,
precisa de UM elemento que o envolva.** Hoje é o único caso no arquivo, e foi
conferido por varredura.

### CC-102 Frente: o projeto visto por rotas, para estudar

Ideias dele em 15/08, ditadas por voz, **para estudo — nada decidido**. O eixo,
nas palavras dele: *"ter uma visão do projeto mais estrutural, voltada pra uma
forma que funciona melhor com o meu tipo de raciocínio visual"*.

Metade do dado já existe e é a razão de isto ser barato: `presenca.mjs` (CC-49)
lê o quadro e classifica cada rota em ativa / órfã / desconhecida, e
`rotasDeTodos()` (CC-48) junta as rotas das duas máquinas por projeto.

**✅ Feito em 17/08: as rotas das outras máquinas na tela.** Até aqui elas só
saíam por comando de terminal, e ele trabalha do telefone: recurso que só
existe no terminal não existe para ele. Agora a tabela de rotas de cada projeto
mostra também as ocupadas do outro aparelho, com a máquina escrita, levemente
apagadas e SEM botão: liberar rota de outro aparelho à distância é o contrário
do que o Routia protege.

De quebra, um defeito de isolamento: a federação resolvia a pasta pela home
direto, ignorando a casa isolada dos testes. A instância de teste lia a pasta
real, e um pacote de laboratório teria acabado no painel dele. Corrigido, com
teste no gate.

### CC-80 ⏸ você decide — o estudo está pronto, falta escolher a forma

O estudo que ele pediu está em [[produto/ESTUDO-VISAO-ESTRUTURAL]], com as três
opções medidas e uma recomendação.

**O achado que mais importa:** o problema não é falta de dado. Seis módulos já
respondem partes da pergunta (85 arquivos e 121 ligações no `dependencias`, 7
frentes no `roadmap`, rotas, oficinas, tempo, agentes) — o que falta é uma tela
que junte. E a opção que eu teria feito por instinto (o grafo de arquivos) é a
que **repete o erro que o campo `frente` corrigiu**: falaria `src/platform.mjs`
onde ele pensa "Bancada".

**A pergunta que decide, e é dele:** a tela é para ele olhar e decidir
prioridade, ou para eu olhar e não quebrar nada? Se for a segunda, o `cc deps`
já basta e este item fecha sem código novo.

O guarda-chuva dos dois acima, e o mais vago de propósito: ele pediu para
**estudar**, não para fazer. O que está dito é o critério, não a solução — tem
que caber no raciocínio visual dele, que é o mesmo motivo pelo qual o cockpit
existe.

Vale desenhar contra o que já se sabe dele: ele lê mal texto longo, decide bem
com mapa, e o vocabulário da tela tem que ser o do ROADMAP dele (foi o achado
que criou o campo `frente`). Uma tela de rotas que fale em `src/**` em vez de
"Pierre" repete o erro que o `frente` corrigiu.

### CC-103 Frente: o que pre-commit, husky e Danger já resolveram, e nós não

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

**✅ Feito em 17/08: rodar tudo sob demanda**, a linha do
`pre-commit run --all-files`. Até aqui o gate só existia no gatilho: para saber
se uma trava ainda pega o que promete era preciso provocá-la de propósito, uma
por uma. Agora `cc hooks testar` roda os testes de todas as travas, e a aba de
hooks tem o mesmo botão, que é o que vale para o telefone.

A resposta separa três estados de propósito: provada, com defeito, e **sem
teste escrito**, que não é a mesma coisa que quebrada. Hoje: 12 provadas, 16
sem teste, de 28. Chamar "sem medida" de "tudo certo" é justamente o erro que
este projeto tenta evitar.

E achou defeito na primeira execução: o teste do `git-add-guard` usava um
caminho `D:/...` e a variável `$TEMP`, que só existem no Windows, então os dois
casos caíam na pasta do próprio repositório. O caso "projeto sem quadro"
falhava, e os de bloqueio passavam por motivo diferente do que diziam testar.
Corrigido com pastas de verdade criadas no próprio teste.

### CC-08 ⏸ ambiente — só macOS continua sem prova (não existe Mac aqui)

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

### CC-104 Frente: Sincronia entre máquinas, aprovada pelo Felipe em 14/08

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

#### Visão registrada em 14/08: o cockpit vira um framework de engenharia de software

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

**Backlog de execução fechado em 14/08: [[planos/FRAMEWORK-V1]].** Dezessete
etapas, em ordem, com a análise conceitual final.

**Ordem de implementar dada por ele em 18/08**: *"o plano grande de nove
etapas [...] também quero botar pra frente o quanto antes"*. Ao reabrir o
documento para começar, a maior parte já estava construída — a marca de
"faltam F4 a F11" tinha ficado velha sem ninguém atualizar. Feito em 18/08:
corrigidas as marcas de F4, F6 e F2 (resolvido de graça pelo desenho do F1),
e implementado o F15 que faltava de verdade (`cc framework ticket`, achado
sobre outro projeto vira ticket commitado NELE). **Sobra só o F12** (filtro de
confidencialidade local — trocar dado sensível por token em vez de só
bloquear a leitura), que é o de maior escopo e ainda não tem desenho técnico
escrito, ao contrário dos outros dezesseis.

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

#### Decisões dele em 15/08, à noite, sobre as duas frentes grandes

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

### CC-105 Frente: Bancada — auditoria e teste agnóstico, ver [[produto/BANCADA]]

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

### CC-106 Frente: Cockpit de retomada de contexto — ver [[produto/COCKPIT]]

Reposicionamento do produto pelo Felipe em 12/08: **os hooks não são o
produto, são sensor** — o produto é o painel virar o lugar onde ele volta ao
contexto rápido, gerenciando 4-5 projetos em paralelo. Isso muda o critério
de sucesso de qualquer sinal: não é "impõe boa prática", é "me faz voltar ao
contexto mais rápido?". CC-32, CC-33, CC-34 e CC-35 feitos em 13/08; CC-36 e
CC-37 seguem abertos.

### CC-107 Frente: Ciclo Felipe → IA → Felipe — ver [[produto/CICLO]]

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


## O que já foi fechado

Concluído sai daqui e vira linha no diário — regra da linha 3 deste arquivo.
Em 16/08 saíram 37 itens, com o texto integral preservado:

- [2026-08-15](diario/2026-08-15.md) — CC-86, CC-73, CC-74, CC-75, CC-81, CC-83, CC-84, CC-85, CC-90, CC-88, CC-89, CC-94, CC-78, CC-67, CC-68, CC-69, CC-70, CC-72, CC-66, CC-65, CC-46, CC-48, CC-49, CC-56, CC-52, CC-53, Bancada
- [2026-08-16](diario/2026-08-16.md) — CC-76, CC-77, CC-91, CC-87, CC-92, CC-93, CC-82, CC-79, CC-71, CC-60
- [2026-08-17](diario/2026-08-17.md) — CC-109, CC-111, CC-113 a CC-123, CC-125 a CC-132, CC-139
- [2026-08-18](diario/2026-08-18.md) — CC-124, CC-133 a CC-137, CC-143 a CC-154 (texto ainda aqui, poda pendente)
- [2026-08-19](diario/2026-08-19.md) — CC-138 (decidido), CC-140, CC-101, CC-157, CC-158 (texto ainda aqui, poda pendente)
