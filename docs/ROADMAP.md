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

### CC-56: Reportar estado a partir de sessão interativa

`cockpit set` recusa com "sem job" numa sessão via Remote Control: ele exige um
job de background em `~/.claude/jobs/<id>`, e trabalho pelo celular não cria um.
Consequência medida em 14/08: da VPS não dá para reportar to-do, frente nem
bloqueio no painel, justamente no modo de uso que mais cresceu.

O CC-51 resolveu metade (o painel agora **enxerga** a sessão interativa, lendo o
transcrito). Falta o caminho de volta: a sessão poder **escrever** o próprio
estado.

### CC-63: Glossário, os documentos reduzidos ao que cabe numa tela ✅ 14/08

Pedido dele depois da poda, e a razão importa mais que o recurso:

> "eu preciso ter um acesso a todos esses documentos de forma resumida pra eu
> saber as coisas sem ter que ficar lendo um livro gigante, porque o problema é
> a minha velocidade de leitura [...] se eu quiser lembrar o que que é a bancada
> que eu mesmo criei há pouco tempo atrás, eu já não lembro, eu teria que
> pesquisar pra ler."

`src/glossario.mjs` lê `docs/**` e extrai resumo, estado e termos do
**frontmatter do próprio arquivo** — nunca de um segundo arquivo escrito à mão.
O documento grande continua sendo a fonte de verdade para a IA; a aba
`glossário` é a camada curta para ele, com busca que casa título, resumo, tags e
os termos ("não lembro o nome, lembro a palavra").

Formato escolhido por ele entre três opções mostradas na tela: resumo de uma
frase mais glossário de termos daquele documento.

Medido: 36 verbetes, 9 com resumo escrito à mão e 32 termos. Os outros 27 saem
de um chute da primeira frase e por isso **não aparecem na lista principal** —
vão para um `<details>` no fim, como pendência de escrita. Cartão com resumo
ruim é pior que cartão ausente.

Armadilha registrada: sem projeto informado a rota caía em `process.cwd()`, e o
serviço systemd roda com `WorkingDirectory` no home — devolvia zero verbete em
produção enquanto funcionava no teste local. O padrão agora sai do caminho do
próprio módulo.

### CC-64: As tarefas dele, separadas das da IA ✅ 14/08

> "onde ficam as minhas tarefas? a gente tem que criar uma forma de eu
> identificar o que são as tarefas em andamento por IA e as tarefas em andamento
> minhas". Ele chamou de "o meu trelo da vida".

Duas peças. O to-do ganhou `dono` (`ia` por padrão, `felipe` quando é coisa que
a IA não pode fazer), e nasceu `src/meu.mjs` com uma lista própria em
`~/.claude/control-center-meu.json`. A aba `meu` junta as duas fontes, de todos
os projetos, aberta primeiro e mais antiga no topo.

**Por que arquivo próprio, e não só o campo no `meta.json`:** a primeira versão
lia só os to-dos dos jobs, e voltou vazia no teste. Isso expôs dois furos —
job é efêmero (o CLI apaga, e a tarefa dele sumiria junto) e sessão interativa
não tem job (CC-56), então eu não conseguiria registrar nada enquanto trabalho
com ele pelo celular. Tarefa de humano dura mais que a sessão que a criou.

Já nasceu com as quatro pendências reais do dia: ligar o PC na federação,
registrar o hook no `settings.json` do PC, decidir sobre o Pixel Agents do
Telegram, e autorizar o sudo do `KillMode`.

### CC-60: O outro Pixel Agents, o do Telegram

Achado em 14/08 investigando o escritório: já existe um `pixel-agents` rodando
nesta VPS há mais de dois dias, na **porta 3100**, do usuário **`agente`**, que
é outro usuário do sistema. O `paineis.mjs` o chama de "o agente do Telegram, via
túnel SSH", e o túnel que o PC abria apontava justamente para ele.

Não mexi nele, de propósito: é de outro usuário e está de pé há dias.

**O Felipe pediu para olhar isso depois.** As perguntas abertas: que agentes ele
mostra (o `~/.claude` do usuário `agente`, não o nosso), quem o subiu, se ainda
serve para alguma coisa, e se vale aparecer no cockpit como um segundo painel
ou se é lixo de uma experiência anterior. Se for para aparecer, o proxy já
sabe servir por porta; o que falta decidir é se faz sentido dois escritórios na
mesma tela.

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
