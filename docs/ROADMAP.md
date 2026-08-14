# ROADMAP

Só o que está **aberto**. Concluído sai daqui e vira linha no diário.

> **Vai executar alguma destas tasks?** Os planos estão em [[PLANOS]], um
> arquivo por task em `docs/planos/`. Eles dizem onde mexer, o que reusar e
> quais das armadilhas do `CLAUDE.md` se aplicam. Escritos em 13/08 por uma
> sessão Opus, justamente para as sessões de execução não precisarem redescobrir
> isso.

## Aberto

### Frente: Acesso remoto pela VPS — visão registrada em 13/08, não implementar ainda

Regra 4 do ciclo (visão longa se registra, não se implementa). Palavras do
Felipe, ditadas:

> "quando a gente subir esse projeto na vps, e aí eu ter como controlar o
> claude, o estudo, tudo por um link meu no meu site carzo, por exemplo, eu
> crio um domínio lá no carzo chamado cockpit, eu acesso, boto o meu login e
> minha senha e consigo controlar pelo, ver pelo telefone o que que a gente
> está fazendo e tal, igual a gente tem aqui só que no telefone na rua, porque
> eu já estou instalando o claude lá na vps pra eu usar ele lá e controlar
> pela própria cli da anthropic"

Normalizado do áudio (ele pediu pra nunca corrigir a grafia, só entender):
"cloud" → Claude Code; "Carlos" → Carzo, o site/domínio dele; "/rc" →
provavelmente "CLI", a própria linha de comando do Claude Code.

O pedido, resumido: hoje o Agent Cockpit só roda local. A visão é subir este
projeto numa VPS que já vai ter o Claude Code instalado, expor por um
subdomínio do site dele (`cockpit.carzo...`), com login e senha, pra abrir do
telefone e ver/controlar os agentes rodando. O mesmo painel de hoje, só que
de fora de casa.

Não é task ainda. Quando virar: login/senha é autenticação de verdade (nunca
mock, regra do protótipo simular produção), e o painel hoje não tem nenhuma
camada de auth: é a primeira coisa a decidir antes de expor pela internet.

**Comentário adicional do Felipe, 13/08, também registrado sem implementar
ainda** ("vamos primeiro se preocupar em botar no ar" foi a instrução dele):

> "a partir de agora, todas as nossas interações com a VPS que não sejam de
> projeto, etcétera, de mexer na estrutura da VPS vai ser feito por esse
> projeto. Porque esse projeto agora é o lá na VPS também. Então, básicamente
> lá na VPS vai ser o que vai traduzir as minhas vontades e necessidades pra
> dentro da VPS de forma visual, ou seja, eu vou ver o que está acontecendo na
> VPS em tempo real, vou falar o que eu quero mudar. A gente tem que incluir
> também, no depois, alguns controles que fazem sentido com a VPS: tipo dentro
> da aba VPS, ter outras abas, prover tudo que está rolando lá em tempo real,
> por exemplo tem coisas que não são só agentes, tem processos, tem os sites
> que eu estou utilizando, coisas que podem estar desatualizadas em relação ao
> GitHub. Todas essas informações eu preciso ter depois, mas não agora."

Duas peças novas nesse comentário:

1. **O Agent Cockpit vira o ponto único de mexer na VPS**, não só de vê-la.
   Hoje a aba VPS é só leitura (`atualizarSnapshot`, sob clique). A visão é o
   painel também **agir** lá: qualquer mudança de estrutura da VPS (fora do
   dia a dia de projeto) passa a ser feita por aqui, não por comando manual
   direto na VPS.
2. **A aba VPS ganha sub-abas com mais do que agente**: processos rodando de
   verdade na VPS, quais sites/domínios estão servidos, e se o código lá bate
   com o que está no GitHub (deploy desatualizado). Ele mesmo apontou o corte:
   isso é "depois", a prioridade agora é **subir o painel no ar** primeiro.

### CC-14 — O tray do Claude Code mostra porcentagem errada
Botão direito no ícone do Claude Code na bandeja → "Plano Max uso" mostra um
percentual que **não bate** com o real. Não é bug deste projeto. Agora dá para
conferir: o painel mostra o número oficial no topo, vindo do `rate_limits` do
statusLine — se o tray discordar dele, o errado é o tray.

### CC-08 — macOS e Linux nunca rodaram
O código existe em `src/platform.mjs` — launchd e systemd de usuário, `lsof`/`ss`
no lugar do PowerShell, `SIGTERM` no lugar do `taskkill`, `.command`/`.desktop`
no lugar do `.lnk`. Nada disso foi executado: a máquina de desenvolvimento é
Windows. O README diz isso na cara.

Quando houver um Mac ou Linux à mão, conferir nesta ordem: `cc` (só leitura,
tem que funcionar de primeira) → `cc open` → `cc daemon install` → aba de
servidores → encerrar um processo de teste.

### CC-04 — Verificar o aviso de silêncio com agente travado de verdade
A faixa de atividade saiu da tela em 06/08 (era o CC-07: construída e nunca
usada). O que sobrou do silêncio é a nota `sem sinal há Xm` na linha do agente,
que também nunca apareceu numa captura — não houve agente travado enquanto o
design era feito. Conferir na primeira vez que acontecer.

### CC-46 — `estadoDe()` casa por regex solto no título, dá falso positivo

Achado em 13/08 implementando as pastilhas do CC-34: "CC-23 — Histórico rico"
virou "feito" porque o título contém a palavra "Histórico", e "CC-04 —
...agente travado..." virou "bloqueado" porque contém "travado". O regex em
`roadmap.mjs` deveria olhar só o marcador de estado (emoji/palavra no INÍCIO
do título), não a frase inteira.

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

### CC-47: O cockpit da VPS vira o servidor de estado

Escolha do Felipe entre as três que apresentei, junto com o CC-49. A infra já
existe: HTTP, autenticação por senha na 5181, domínio público, systemd que
volta sozinho. Falta o cliente: o `cc set` do PC passa a espelhar para a VPS
além de escrever local.

Requisitos que saem do que foi medido:

- Escrita local primeiro, espelho depois. Se a VPS cair, o PC continua
  funcionando sozinho, degradando em silêncio (o mesmo padrão do câmbio).
- Token no PC, guardado no `control-center.json`, nunca no repositório: ele é
  público.
- O espelho nunca pode entrar em `setInterval` cego. Vale a mesma regra da aba
  VPS: rede sai de ação, não de timer de fundo.

### CC-48: Rotas deixam de depender de commit para o outro lado enxergar

Hoje marcar rota no PC só chega na VPS depois de commit, push e pull. O quadro
em markdown continua sendo a verdade legível e versionada; o que muda é o canal
de propagação, que passa a ser o painel.

O `rota-guard` consulta o endpoint com cache local e cai para o arquivo quando
a rede falha. A degradação precisa ser decidida de propósito e escrita no
código: rede fora não pode nem bloquear tudo nem liberar tudo.

### CC-49: Presença deduzida, para acabar com rota esquecida ocupada

A segunda metade da escolha do Felipe. Prova viva do problema, encontrada hoje:
a rota `backlog` está marcada como ocupada por `5805d6bb`, sessão que encerrou o
dia e commitou o fechamento mais de uma hora antes. O quadro mente, e o próximo
agente respeita a mentira.

O painel já sabe quais jobs estão vivos. Falta cruzar isso com o quadro e marcar
a rota como provavelmente órfã, com o tempo desde o último sinal.

Limite conhecido, que não pode ser esquecido no desenho: presença detecta
colisão em curso, não previne a próxima. Ela complementa a marcação à mão, não
substitui.

### CC-50: Os testes do Routia não valem na VPS ✅ 14/08 (feito, com ressalva)

Os dois scripts falham aqui por motivos que não são o hook. O
`testar-rota-guard.sh` tem `REPO="D:/Documentos/Ti/projetos/CLIENTS/inovallbond"`
fixo no código, caminho do Windows que não existe nesta máquina, então o hook
libera corretamente por não haver quadro e o teste conta isso como falha. O
`testar-rota-pedidos.sh` escreve em `~/.claude/jobs/<id>/tmp`, read-only no
sandbox, e falha 12 vezes por isso.

Consequência real: o Routia funciona na VPS e ninguém saberia se parasse.

**Feito em 14/08, medido:** 19 checks passando aqui, 7 do `rota-guard` e 12 do
`rota-pedidos`, onde antes não passava nenhum. O `testar-rota-guard.sh` agora
monta o projeto de exemplo numa pasta temporária em vez de apontar para o
caminho fixo do PC. O `testar-rota-pedidos.sh` tenta a pasta do job e cai para
uma temporária quando não consegue escrever, avisando qual escolheu. A conversão
`pwd -W`, que é o que de fato resolve o problema do Git Bash citado no topo do
script, ficou intacta.

**Ressalva que vira trabalho, e é o retrato da frente inteira:** esses arquivos
moram em `~/.claude/hooks`, que é local de cada máquina e não está em
repositório nenhum. O conserto existe só na VPS. O PC segue com a versão que
falha, e nenhum `git pull` vai levar isso para lá. Não foi validado no Windows,
onde só o caminho de fallback é novo.

**Sujeira encontrada no caminho, já limpa:** rodar o `rota-guard` à mão para
diagnóstico gravou um pedido de sessão falsa em `docs/.rotas-pedidos.json` do
repositório de verdade. O arquivo foi removido. Testar hook contra o próprio
projeto tem efeito colateral no projeto: usar pasta descartável.

### CC-51: O painel não enxerga sessão interativa, só job de background

`cockpit set` recusa com "sem job" numa sessão via Remote Control. Como o
trabalho pelo celular passou a ser interativo e não mais delegado a job, o
painel fica cego exatamente no modo de uso novo. Decidir se sessão interativa
vira cidadã de primeira classe no painel ou se o reporte continua só para job.

### CC-52: O Routia só existe em 2 dos 14 projetos clonados na VPS

`proj_controlcenter` e `inovallbond`. Rollout continua manual por decisão do
Felipe, mas vale saber o tamanho real do buraco antes de confiar no método como
proteção geral.

### CC-53: O gate `npm test` não roda na VPS, e falha por ambiente

Medido em 14/08: `npm test` morre em `test.mjs:168` com "nenhum job leu o
transcript". O teste exige `readJobs()` devolvendo job real com transcript, e
esta máquina tem um job só. Não é regressão, é o gate dependendo do estado da
máquina de quem roda.

Consequência prática, que é o que importa: quem trabalha pela VPS não tem gate
nenhum hoje. Ou o teste passa a pular esse bloco quando não há job (dizendo que
pulou, nunca em silêncio), ou o projeto ganha um conjunto mínimo que roda em
qualquer máquina.

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

### Frente: Conteúdo social — módulo novo, ver [[produto/CONTEUDO-SOCIAL]]

Decidido com o Felipe em 11/08: vive neste repo, não em projeto à parte.
Ordem de dependência importa — CC-20 (feito em 12/08) e CC-21 são pré-requisito
de tudo depois, o resto pode andar em paralelo uma vez que os sinais existem.

### CC-21 — MCP do Google Calendar com escrita
Hoje a leitura de agenda já existe (CC-20, aba "agenda", lê por iCal). Falta
escrever: com MCP configurado no Claude Code local, dá pra criar evento por
voz/texto direto ("call com a Carol quinta 14h") sem abrir o Google Calendar.
O iCal é só leitura — não dá pra escrever por ele, então isto é integração
nova, não extensão do `calendario.mjs`.

### CC-22 — Arquivo de marco manual
Evento que não deixa rastro em código (reunião, fala em evento presencial,
nota de prova) precisa de um sinal manual mínimo — uma linha por marco, não
formulário longo. Formato ainda em aberto: provavelmente mais uma entrada em
`docs/diario/{data}.md` de cada projeto, lida pelo digest do CC-24, em vez de
arquivo novo — evita duplicar onde mora a verdade.

### CC-25 — Vault Obsidian como espelho de leitura
`LM_vault/Neo` existe mas está vazio (só `.obsidian/`, zero arquivo). Decisão
11/08: reviver só como leitor — CC/skill escrevem `.md` estruturado numa
pasta (digest do CC-24, histórico do CC-23), o vault só aponta pra essa pasta
pra visualização/grafo. Nunca fonte de dado, nunca destino de escrita de
skill. Sem isso a decisão vira "reviver o vault" solto, sem dizer quem
escreve o quê.

### CC-26 — Skill de geração de rascunho (fora deste repo)
Consome o digest do CC-24. Não é módulo do Control Center — é skill global do
Claude Code (`~/.claude/skills/`), porque roda como parte do fluxo de
trabalho do Felipe, não como aba do painel. Nenhum dos dois repos do GitHub
analisados em 11/08 (`blacktwist/social-media-skills`,
`charlie947/social-media-skills`) serve pronto: os dois assumem "uma
invocação = um post" com fonte colada à mão, nenhum lê calendário/git/memória
como gatilho, nenhum gera lote. Só `content-repurposer-sms` do primeiro repo
serve como referência de estrutura (matriz de derivados por plataforma).
Depende do CC-24 existir antes de fazer sentido escrever.

### Frente: Framework de hooks — ver [[produto/FRAMEWORK-HOOKS]]

Decidido com o Felipe em 12/08: o painel passa a controlar comportamento de
verdade do Claude Code, não só ler estado. Épico 1 (CC-27), Épico 2 (CC-28)
e Épico 3A (CC-29) feitos em 12/08. Os itens abaixo têm decisão pendente
documentada em produto/FRAMEWORK-HOOKS.md; nenhum decide sozinho qual
caminho tomar, o Felipe escolhe quando o sprint chegar.

### 🔴 Bloqueio crítico, achado em 13/08: `cwd` não isola o opencode de verdade

Testando o CC-36 (enriquecimento de to-dos) contra o binário real do
opencode, com `cwd` explicitamente apontando pra uma pasta temporária nova a
cada chamada: uma das chamadas rodou `git status --short && git log
--oneline -3` de verdade e leu o estado **real** deste repositório
(`proj_controlcenter`), não o da pasta isolada passada como `cwd`.

Isso contradiz a premissa de segurança já escrita no CC-29
(`src/opencode.mjs`): "roda em pasta neutra, nunca o cwd do projeto". O `cwd`
do `spawn()` do Node não está controlando onde o opencode de fato executa
suas próprias ferramentas (bash, edit, write) — ele parece manter alguma
noção própria de "o projeto atual", independente do processo que o disparou.
Confirmado por dois testes com resultado diferente no mesmo dia: um `pwd`
pedido manualmente (via `cd` real antes de chamar `opencode run`) respondeu
certo, isolado; a mesma chamada passando por `dispararTarefa` (que envolve
`cmd /c` no Windows) não isolou.

**Não investigado ainda, por falta de tempo na sessão que achou isso**: se é
`cmd /c` perdendo o `cwd` na cadeia de processos, se é o opencode tendo
sessão/projeto persistido em `~/.config` independente do processo, ou outra
causa. **Afeta qualquer uso de `dispararTarefa`**, não só o CC-36: o CC-29
(disparo em background) e o CC-30 (fila de revisão, ainda não feito)
carregam a mesma suposição de isolamento, hoje não comprovada.

Os agentes do opencode neste setup têm `permission:*` — nenhum é
read-only. Enquanto isso não for resolvido, qualquer chamada real pode, em
tese, editar arquivo de verdade do projeto em vez de só descrever texto.

**Antes de usar CC-36 (ou qualquer outra coisa que dispare opencode) em
produção**: isolar de verdade (testar sem `cmd /c`, ou achar a flag/config
do opencode que fixa o projeto por chamada) e provar com um teste que tenta
editar um arquivo canário fora do `cwd` esperado e confirma que falha.

**Decisão do Felipe em 13/08**: fica em aberto por enquanto, não é bloqueio
pra seguir com o resto do backlog. A investigação da causa raiz vai acontecer
pela própria VPS (onde o opencode também vai rodar), não nesta sessão local.

### CC-30 — Fila de revisão do opencode + hook que obriga a chamada
Depende do CC-29 e de decidir qual evento e qual critério "obrigam" a
chamada ao opencode (ex.: `UserPromptSubmit` por linguagem natural, mais
agressivo; ou um comando explícito tipo `cc delegar "tarefa"`, menos "hook
obrigando" e mais "ferramenta que o agente usa"). Resultado nunca fecha
to-do sozinho — fila de revisão em `~/.claude/control-center-opencode.json`
(fora de `~/.claude/jobs`, que é contrato exclusivo de `meta.json`), aprovar
só marca `revisado: true`, no máximo sugere fechar o to-do ligado.

### CC-31 — Painel de metodologia (ágil/UML/MER, alerta sem bloquear)
Checklist como dado estático (`src/metodologia.mjs`) e aba só-leitura que
mostra, pro job selecionado, o que **parece** faltando — heurística sobre
sinais que já existem em `buildJob()` (sem `frente`, sem `todos`...). Nunca
bloqueia, sempre alerta. Conteúdo exato das perguntas é editorial, não
técnico — falta o Felipe definir quão rigoroso.

### Frente: Cockpit de retomada de contexto — ver [[produto/COCKPIT]]

Reposicionamento do produto pelo Felipe em 12/08: **os hooks não são o
produto, são sensor** — o produto é o painel virar o lugar onde ele volta ao
contexto rápido, gerenciando 4-5 projetos em paralelo. Isso muda o critério
de sucesso de qualquer sinal: não é "impõe boa prática", é "me faz voltar ao
contexto mais rápido?". CC-32, CC-33, CC-34 e CC-35 feitos em 13/08; CC-36 e
CC-37 seguem abertos.

### CC-36 — Enriquecimento de to-dos pelo opencode
Pedido do Felipe: "olho os to-dos e as tarefas não fazem sentido, os nomes
poderiam ser mais explicativos e as tarefas poderiam abrir e ter um resumo da
conversa que gerou ela, qual arquivo mexe". Uma chamada por agente (não por
tarefa) via `src/opencode.mjs` (CC-29), guardando em
`meta.json → explicacoes: {texto da tarefa: {titulo, resumo, arquivos}}` —
mapa por texto, padrão do `feitoEm`, porque o agente reescreve `todos`
inteiro a cada `cc set`. **Nunca reescrever `t.text`**: `feitoEm`, `niveis`,
`estimativas` e `explicacoes` são todos chaveados por ele. O opencode roda
em pasta neutra, nunca no `cwd` do projeto — verificado que todos os agentes
dele têm `permission:*` neste setup, nenhum é read-only.

### CC-37 — Enriquecimento automático (stretch, provavelmente não fazer)
Disparar a cada to-do novo é sedutor por custar R$ 0, mas toda escrita em
`meta.json` vira evento no stream e dispara `arquivar()` — com 5 projetos é
rajada, e modelo grátis fora do ar vira lixo silencioso. Só depois do CC-36
provar qualidade.

### Frente: Ciclo Felipe → IA → Felipe — ver [[produto/CICLO]]

Análise de 13/08 sobre 235 mensagens reais dele em 5 projetos, mais 43 pastas
de memória. Dez padrões com evidência medida. O diagnóstico: o problema não é
falta de regra, é **excesso de regra dispersa** — 4 seções OBRIGATÓRIO no
global, ~30 memórias comportamentais em 15 projetos, ~60 armadilhas, com 6
contradições convivendo sem desempate. E as regras de maior retorno estão
presas em memória de um projeto só.

Critério de ordem, o mesmo do [[produto/COCKPIT]]: **isso me faz voltar ao
contexto mais rápido, ou economiza uma volta do ciclo?**

### CC-38 — O ciclo vira regra onde carrega: o CLAUDE.md global ✅ 13/08
Aplicado no `CLAUDE.md` global (commit `8998699`) — as sete regras do ciclo
estão lá, com o desempate de contradições. Descrição original abaixo, como
registro do que motivou.

As quatro regras de maior retorno medido estão presas em memória de projeto,
e por isso o mesmo erro se repete: verificação visual obrigatória (o mais
repetido, 3 projetos diferentes), repetir a mecânica antes de codar (4 rodadas
evitadas por 1 frase), backlog de tudo que ele fala, medir antes de agir na
hipótese dele. Sobem pro global junto com os três protocolos novos que a
análise revelou: **desambiguar substantivo na segunda repetição** (mataria 3
das 4 sagas longas em uma mensagem), **o mecanismo nomeado é o pedido** (12
mensagens acusatórias em 3 projetos), e **visão longa se registra, não se
implementa**. Mais o desempate das contradições que a evidência resolve.

### CC-39 — Consertar o `- projeto_template`, que hoje nasce violando o global

**Parte aplicada em 13/08.** O diagnóstico original (escrito antes de olhar o
código de verdade) estava parcialmente errado: `Co-Authored-By` já aparecia só
documentando a proibição, nunca mandando usar, e a estrutura de pastas
(`guias/produto/legacy/diario`) já era a nova. O `CLAUDE.md` também já estava
limpo. O que era real e foi corrigido: os **4 arquivos de agente**
(`.claude/agents/{planner,reviewer,scrum-manager,tester}.md`) tinham o nome
"app_ayvu", o caminho `D:\...\app_ayvu` fixo e a stack (Rust+Flutter) do ayvu
hardcoded — inclusive um import de exemplo quebrado
(`from 'cargo test (Rust) + flutter test (Dart)'`, um find-replace que vazou
pro código). E `docs/HANDOFF.md` carregava **133 linhas de estado real** do
ayvu — datas, hash de commit, resultado de benchmark (94.2% pass rate) —
sobrescrito por um modelo vazio.

**Achado maior, não tocado — decisão do Felipe:** a pasta `app/` tem **91
arquivos** de um app Flutter real (`com.ayvu.ayvu`, Android/Kotlin incluído),
`docs/legacy/` guarda sessões reais do ayvu (`session-TRANS-01-FL.md` etc,
combinando com o HANDOFF que citava essa mesma task) e `docs/ROADMAP.md` abre
com "`# app_ayvu — ROADMAP`". Isso não é mais "template com resíduo" — parece
o projeto ayvu real, sendo convertido em template, com a conversão pela
metade. Apagar código de app alheio é decisão de conteúdo, não mecânica: fica
para o Felipe dizer se `app/` é referência que ele quer manter (ex.: esqueleto
Flutter pronto) ou lixo a remover.

### CC-40 — Índice das memórias comportamentais ✅ 13/08 (levantamento; decisão pendente)

Contagem real: **81** memórias `type: feedback` em **22** diretórios (o
roadmap estimava ~30 em 15 — a realidade é maior e mais concentrada: 25 só no
`inovallbond`). Índice completo em [[produto/INDICE-MEMORIAS]].

Achados: **7** já duplicam regra que já está no global (sinal de que a regra
é forte, não erro apagar); **6** são candidatas genuínas a subir, com
destaque pra `servidor-teste-porta-compartilhada` do inovallbond —
confirmada no MESMO DIA pela armadilha do `pkill` no CC-42 deste projeto,
duas descobertas independentes do mesmo problema; **2** estão mortas,
descrevendo a estrutura de kanban do vault que a limpeza de 13/08 apagou; as
outras **68** (84%) são de fato locais, corretamente presas ao projeto.

**Decisão do Felipe**: quais das 6 candidatas sobem pro `CLAUDE.md` global,
no formato do CC-38.

### CC-41 — O painel enxerga os sinais do ciclo ✅ 13/08

Rajada (3+ mensagens em 6min) e repetição (sobreposição de palavras 4+ letras
≥ 60% com uma mensagem anterior) entram como motivo novo no cockpit, peso
entre `waiting` e `stale`. `src/sinais.mjs` é lógica pura testável, alimentada
por `src/transcript.mjs` (nova `humanMessagesTail`, cache por tamanho+mtime
igual ao `lastPrompt`), calculada dentro de `buildJob()` — mesmo lugar que já
lê o transcript pro último pedido.

**Bug achado pelo próprio teste, corrigido antes de subir**: o colapso de
"reenvio em <5min substitui" (regra 6 do ciclo) comparava só o tempo, e
engolia rajada de verdade — três mensagens **diferentes** em 2-3 minutos
viravam "uma reescrita", zerando o sinal. Corrigido: só colapsa quando a
mensagem nova tem sobreposição de conteúdo com a anterior (é a mesma ideia
reescrita), não qualquer par próximo no tempo.

Silêncio (>10min sem mensagem) é calculado e devolvido em `job.sinais`, mas
**não virou motivo novo no cockpit** — seria redundante com `stale` (mesmo
limiar, ângulo diferente: um é "o agente travou", outro é "o Felipe foi
embora"). Fica disponível pra quem quiser usar sem duplicar sinal na tela.

**Decisão pendente do Felipe** (só uma; as outras a evidência resolve): o
pipeline formal Planner → Tester → Revisor é regra absoluta no global, mas os
diários do próprio Control Center dizem "sem Tester nem Revisor formais" e
nunca foi cobrado. Ou a regra vira condicional (quando vale, quando não), ou
o pipeline passa a valer de verdade aqui também.

### Frente: O painel dono das rotinas — ver [[produto/FRAMEWORK-ROTINAS]]

Visão do Felipe em 13/08, registrada com as palavras dele, ainda sem decisão de
escopo. Cinco peças: retroalimentação entre projetos, registro total, o painel
traduzir, o painel criar e gerenciar as rotinas na máquina, e formato de
framework por cockpit no lugar de linguagem natural avulsa.

A análise contra a evidência do repo está no documento. O resumo: as peças
"traduzir" e "gerenciar rotina" atacam três dos cinco buracos medidos em
[[produto/ROTINAS-HOJE]]; a peça "registro total" tem um contra-exemplo do
mesmo dia (o vault de 518 arquivos gerados por rotina, esvaziado em 13/08 com
o veredito "tá tudo repetido ou ultrapassado").

**CC-42 feito em 13/08**: a aba "rotinas" mostra as cópias de comando dentro
dos projetos, quanto cada uma divergiu da global, e conserta sob clique (usar a
global, ou apagar a cópia), sempre com a comparação disponível antes de
escrever. Achado ao ligar: **22 rotinas desatualizadas em 5 projetos**, sendo o
`end-session.md` o pior caso (224 linhas contra 259). Nada foi sincronizado
ainda — a decisão do que consertar é do Felipe, cópia por cópia.

Quatro decisões fechadas em 13/08, detalhadas no documento: o framework é
**ferramenta com liga/desliga**, não obrigação (reusa `cc hooks on|off` e
`isEnabled()`, sem mecanismo novo); começa pelo **nível baixo** com a D1 só
planejada; o **fluxo do framework vem depois** do sistema de distribuição
existir; e a peça "registro total" **não entra como está**.

### CC-43 — Decisão D1: o painel escrever `settings.json` (planejada, não feita)

O plano de segurança está escrito em [[produto/FRAMEWORK-ROTINAS]]: backup
datado antes de escrever, validação com reversão automática, escrita cirúrgica
nunca do arquivo inteiro, um hook só por uma semana, botão de pânico. Fazer ou
não depende de uma pergunta de valor, não técnica: **o que um hook registrado
pelo painel faz que um comando distribuído não faz?** Se o CC-42 no ar já
resolver a dor, a D1 perde o motivo.

### CC-44 — A regra: global vale para tudo, projeto só acrescenta

Decisão do Felipe em 13/08, confirmada por medição das 22 divergentes: o
conteúdo "próprio" das cópias é (a) a mesma coisa dita de um jeito mais velho,
(b) erro ativo — o `end-session.md` do `app_maurice` se diz do "projeto Juju" e
manda ler a memória de outro projeto — e (c) um punhado que, se é mesmo
específico, cabe em comando de nome próprio.

Não dá pra mesclar: quem resolve a precedência é o Claude Code, e ele substitui
por nome de arquivo. Então a regra é convenção, com duas formas de acrescentar
sem sobrescrever: **nome próprio** (`/rotina-do-projeto` em vez de uma segunda
versão de `/end-session`, como já fazem `authorize`, `tickets` e `routia`, que
nunca deram problema) ou **a global lendo o projeto** (o esqueleto global manda
"se existir `docs/rotina-extra.md`, siga também"). Falta o Felipe mandar aplicar
— o CC-42 já mostra onde a convenção está quebrada e desfaz sob clique.

**Gatilho do framework, resolvido**: o Felipe liga **no início do projeto**, e
vai desenhar o framework ele mesmo. O painel entra como quem liga, distribui e
mostra — não como quem inventa o método.

**Aplicado em 13/08**: 21 cópias apagadas (16 velhas + 5 idênticas), tudo
versionado antes. Sobraram as 12 de nome próprio e as 4 `set-role`, que têm
customização real e viram decisão dele. Detalhe e o que se perdeu em
[[produto/FRAMEWORK-ROTINAS]].

### CC-45 — Nenhuma rotina global escreve mais no vault ✅ 13/08

Avaliação de 13/08 (ver [[produto/ROTINAS-AVALIACAO]]): os passos **5.5**
(Kanban do vault, 51 linhas) e **5.6** (daily do vault, 48 linhas) são os dois
maiores da rotina e somam **38% das 259 linhas** — escrevendo justamente no
vault que o Felipe esvaziou no mesmo dia.

E continuam rodando: o vault foi limpo às ~03:50, e às 04:18/04:21 outra sessão
já tinha recriado `daily/2026-08-13.md` e um kanban de 200 linhas. A decisão de
parar estava **documentada** num LEIA-ME dentro do próprio vault, e não durou
meia hora — demonstração do buraco nº 2 de [[produto/ROTINAS-HOJE]]:
**instrução escrita é sugestão, hook é regra.**

O dado não se perde: "o que só o Felipe pode fazer" vira `blockers` no
`meta.json`, que o cartão do agente já mostra. É troca de destino, não deleção.

**Aplicado**, e eram **quatro** rotinas escrevendo lá, não duas:
`end-session` (259 → 176 linhas), `novo-projeto` (472 → 316, o PASSO 7 criava
task, nota e dois kanbans em pastas que já não existem), `deps` (108 → 106) e
`daily-log` (108 → 89, agora escreve em `docs/diario/` do próprio projeto).
**−243 linhas**, varredura confirma que só sobraram as linhas que *proíbem* a
escrita, e o destino novo foi testado de ponta a ponta (`cc set` com `blockers`
aparece no `/api/jobs`). A entrada `/novo-projeto TK-{ID}` foi aposentada junto:
lia uma pasta apagada.

**Falta ainda**, da mesma avaliação, e são os itens 2 e 3 que o Felipe quis
discutir depois: o PASSO 6 (relatório de 31 linhas que ele lê uma vez) virar
`cc set` de fechamento, e a divisão diário × memória × HANDOFF ganhar uma regra
de uma frase. Mais a poda da estrutura de scrum no `- projeto_template` para o
que sobrevive ao uso (`ROADMAP.md`, `HANDOFF.md`, `diario/`) — o `VIASMAP.md`
do vault tinha as oito vias livres e zero cruzamentos desde que nasceu. Casa
com o CC-39.

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
