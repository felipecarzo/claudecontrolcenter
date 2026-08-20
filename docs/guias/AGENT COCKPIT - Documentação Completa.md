# Agent Cockpit: Documentação Completa

Documento de registro, estudo e escopo, escrito em 13/08/2026 a pedido do
Felipe: "documentação do cockpit aqui na área de trabalho com tudo que
estamos fazendo, já fizemos e vamos fazer, conceito do projeto, citações
minhas que você tiver e tudo bem documentado em cada borda invisível do
projeto, pra registro, estudo e escopo detalhista".

Escrito a partir da leitura direta de `CLAUDE.md`, `docs/ROADMAP.md`,
`docs/produto/VISAO.md`, `docs/produto/MVP.md`, `docs/produto/COCKPIT.md`,
`docs/produto/CICLO.md`, `docs/produto/FRAMEWORK-ROTINAS.md`,
`docs/produto/ROTINAS-AVALIACAO.md`, `docs/produto/ROTINAS-HOJE.md`,
`docs/produto/INDICE-MEMORIAS.md`, `docs/produto/FRAMEWORK-HOOKS.md`,
`docs/PLANOS.md`, `docs/planos/*.md`, `docs/BACKLOG-CAPTURA.md`,
`docs/diario/2026-08-13.md`, `README.md`, `docs/README.md`, `AGENTS.md` e do
histórico de commits do repositório (`git log`), todos dentro de
`D:\Documentos\Ti\projetos\PESSOAL\proj_controlcenter`. Onde a fonte não
deixa algo claro, este documento diz isso explicitamente em vez de supor.

As citações do Felipe estão copiadas literalmente, entre aspas, com a fonte
indicada. O resto é síntese em prosa.

---

## 1. O que é o Agent Cockpit

O Agent Cockpit (nome de projeto no disco: `proj_controlcenter`, nome do
pacote: `agent-cockpit`, comando de terminal: `cc`) é o painel que mostra os
agentes do Claude Code do Felipe rodando em segundo plano, numa tela só, no
lugar de navegar aba por aba no terminal.

O problema que resolve, segundo `docs/produto/VISAO.md`: o Claude Code roda
vários agentes em background ao mesmo tempo, e a única forma nativa de olhar
para eles é a barra de abas do terminal, que navega uma aba por vez e mostra
um agente por vez. Não existe visão de conjunto. Na prática, com 5 a 10
agentes vivos, não dá para saber quem está trabalhando em quê sem entrar em
cada um, não dá para ver quantos estão parados ou travados, agentes em rotas
diferentes do mesmo projeto ficam indistinguíveis, e o custo em tokens só
aparece depois, nunca durante. Quem paga esse preço é o Felipe, que despacha
o trabalho e precisa saber onde intervir, não os agentes.

A ideia central: um painel que responde, de relance, "quem está fazendo o
quê, onde, e o que precisa de mim agora". Duas superfícies do mesmo dado, em
duas telas: uma tabela no terminal, para quando a resposta precisa ser de
dois segundos, e uma página web, para quando dá para ler com calma, filtrar,
abrir detalhe e clicar num link.

A informação vem de duas fontes com papéis distintos. O próprio Claude Code
escreve `~/.claude/jobs/<id>/state.json`: sabe que um agente existe, em que
diretório roda, com que modelo, há quanto tempo, quantos tokens gastou, se
está ativo. Esse arquivo nunca é escrito pelo Agent Cockpit, só lido. O
segundo arquivo, `meta.json`, é escrito pelo próprio agente de IA que está
trabalhando: o assunto em três a seis palavras, a categoria, os to-dos, o
que está travando, os links que interessam. Isso o `state.json` não tem. A
divisão entre os dois é, nas palavras do documento de visão, "a decisão
central do projeto": o painel não adivinha o que o agente está resolvendo,
ele pergunta, e o agente responde, seguindo o protocolo descrito em
`AGENTS.md`.

Roda como daemon local no Windows, subindo sozinho no logon da máquina; o
uso do dia a dia é clicar num atalho na área de trabalho, não subir servidor
manualmente.

### O que o projeto explicitamente não é

`VISAO.md` é direto nisso:

- Não é um gerenciador de agentes. Não cria, não mata, não pausa job. Quem
  faz isso é o próprio CLI do Claude Code; o painel observa e reporta.
- Não é um log. Transcrição completa, histórico de chamada de ferramenta e
  diff de código ficam no CLI. Aqui cabe só o que se lê de relance.
- Não é multiusuário nem remoto, hoje. Escuta em `127.0.0.1` (só a própria
  máquina). Ver de outra máquina é, nas palavras do documento, "problema de
  outro dia" (ver seção 3 deste documento, que já mudou isso para "visão
  registrada").
- Não substitui o ROADMAP dos projetos. Os to-dos que aparecem no painel são
  do agente, para a sessão dele, não viram backlog do projeto.

### Para quem

Um usuário: o Felipe. Isso é, no texto da própria visão, "permissão pra ser
denso e sem onboarding, e é também o motivo de não existir autenticação"
(hoje; ver seção 3 sobre a visão de expor isso pela internet, onde
autenticação de verdade deixa de ser opcional).

### O corte de MVP

`docs/produto/MVP.md` define o MVP como: "abrir o painel e saber o estado de
todos os agentes sem entrar em nenhum". Tudo que não serve a essa frase
ficou fora da primeira versão. O MVP fechou em 05/08/2026, com sete entregas,
todas marcadas prontas: ler `~/.claude/jobs` e derivar projeto, rota,
modelo, status, idade e tokens; tabela no terminal agrupada por projeto,
atualizando sozinha; painel web com filtro, busca, detalhe expansível e
atualização em tempo real (SSE, Server-Sent Events); o protocolo `meta.json`
onde o agente reporta assunto, categoria, to-dos, bloqueios e links; o
comando `cc.mjs set` com merge parcial, descobrindo o job sozinho pelo
ambiente; rodar sozinho no logon do Windows com atalho para abrir; e o
protocolo ligado em todos os projetos, com liga e desliga.

Ficaram de fora do MVP por decisão, não por esquecimento: design próprio da
interface (que veio depois), agrupar por rota além de projeto, histórico e
gráfico de tokens, notificação de agente travado, e acesso remoto. Boa parte
disso já foi construída depois (ver seção 4); o acesso remoto continua em
aberto (ver seção 3).

A definição de pronto do projeto, que vale até hoje: `npm test` passa
(incluindo a leitura dos jobs reais da máquina); a entrega foi verificada na
superfície onde o usuário vai ver (tabela renderizada de verdade, ou rota
HTTP chamada de verdade, nunca "ler o código conta como verificação"); nada
foi escrito dentro de `~/.claude/jobs/` além de `meta.json`; o Claude Code
continua funcionando, de preferência comprovado com um job vivo; se um
canto foi cortado de propósito, o limite está escrito em `docs/ROADMAP.md`
ou num comentário `ponytail:` no código; e se o comportamento que o agente
precisa seguir mudou, `AGENTS.md` foi atualizado junto.

---

## 2. Por que "Agent Cockpit" agora

Em 13/08/2026, no meio de uma sessão paralela cuidando da migração do
projeto para a VPS, o Felipe disse:

> "o control center (que vamos chamar agora de agent cockpit ou AC)"

(fonte: `docs/BACKLOG-CAPTURA.md`, item 1 de 13/08)

O alcance da mudança de nome não estava definido de saída. O nome toca pelo
menos seis lugares diferentes: o nome do repositório no GitHub
(`claudecontrolcenter`), o binário de terminal (`cc`), os arquivos de estado
em `~/.claude` (`control-center-*.json`), o bloco de protocolo dentro do
`CLAUDE.md` global e de todos os `CLAUDE.md` de projeto, e a skill
`cc-sync`.

A instrução registrada foi explícita: "não tocar em nada disso sem decisão
explícita, renomear o binário e os arquivos de estado quebra todos os
projetos que já reportam".

### O que já foi renomeado, e o que ficou de propósito para depois

No mesmo dia, uma primeira parte foi aplicada: só o nome de exibição, nunca
o que outros projetos dependem para funcionar. Da mensagem do commit
`chore(rename): Agent Cockpit como nome de exibicao (parte 1, so branding)`:

- `package.json`: o nome do pacote npm virou `agent-cockpit`; o binário
  continua se chamando `cc` e continua funcionando sem mudança para quem já
  o instalou.
- Título e cabeçalho na tela web e na tabela do terminal.
- Títulos do `README.md`, do `CLAUDE.md` do projeto e do `AGENTS.md`.

O que não foi tocado, e por quê: o binário `cc`, os arquivos
`control-center-*.json` que já têm dado real gravado, o bloco de protocolo
dentro do `CLAUDE.md` global e dentro dos `CLAUDE.md` de todos os outros
projetos do Felipe, o atalho da área de trabalho, a skill `cc-sync`, e o
nome do repositório no GitHub. A mensagem do commit registra explicitamente
o motivo: "escopo maior fica pra quando a decisão final estiver fechada",
citando que foi outra sessão, paralela, cuidando da migração para a VPS,
quem sinalizou o risco (ver `docs/BACKLOG-CAPTURA.md`).

Esse mesmo backlog de captura registrou um achado técnico que reforça o
motivo de manter o nome `cc` por enquanto, mas que também é o argumento mais
forte a favor de completar o rename no futuro: em qualquer Linux, `cc` é o
nome do compilador C do sistema (`/usr/bin/cc`, que aponta para o gcc).
Colocar o binário do painel na frente dele no `PATH` quebra a compilação de
qualquer pacote com módulo nativo, porque ferramentas como `node-gyp`
invocam `cc` esperando o compilador. No Windows esse problema não existe, e
por isso passou despercebido até a instalação na VPS em 13/08. Lá, o comando
ficou `cockpit`, e o `PATH` do npm global foi posto no fim da lista, não no
início, para não mascarar o binário do sistema. A consequência prática
registrada: "se o nome do binário virar `cockpit` de vez, o problema some
sozinho. Se continuar `cc`, todo Linux vai precisar dessa gambiarra."

---

## 3. A visão de longo prazo: o painel na VPS

Isto é visão registrada em 13/08, não uma tarefa em execução. O próprio
`docs/ROADMAP.md` marca a seção assim: "visão registrada em 13/08, não
implementar ainda", aplicando a Regra 4 do ciclo de trabalho do Felipe
descrita na seção 6 deste documento (visão longa se registra, não se
implementa).

### A primeira citação: acesso remoto por um subdomínio do site dele

Ditada por voz (o documento nota que foi "normalizado do áudio", sem corrigir
a grafia, só entender o sentido: "cloud" quer dizer Claude Code, "Carlos" é
Carzo, o site/domínio dele, "/rc" provavelmente quer dizer "CLI"):

> "quando a gente subir esse projeto na vps, e aí eu ter como controlar o
> claude, o estudo, tudo por um link meu no meu site carzo, por exemplo, eu
> crio um domínio lá no carzo chamado cockpit, eu acesso, boto o meu login e
> minha senha e consigo controlar pelo, ver pelo telefone o que que a gente
> está fazendo e tal, igual a gente tem aqui só que no telefone na rua,
> porque eu já estou instalando o claude lá na vps pra eu usar ele lá e
> controlar pela própria cli da anthropic"

(fonte: `docs/ROADMAP.md`, frente "Acesso remoto pela VPS")

Resumido: hoje o Agent Cockpit só roda local, na máquina Windows do Felipe.
A visão é subir este mesmo projeto numa VPS que já vai ter o Claude Code
instalado, expor por um subdomínio do site pessoal dele
(`cockpit.carzo...`), com login e senha, para abrir do telefone e
ver/controlar os agentes rodando de qualquer lugar. O mesmo painel de hoje,
só que acessível de fora de casa.

O documento é explícito sobre o que isso implica em termos de segurança:
"não é task ainda. Quando virar: login/senha é autenticação de verdade
(nunca mock, regra do protótipo simular produção), e o painel hoje não tem
nenhuma camada de auth: é a primeira coisa a decidir antes de expor pela
internet." Essa é uma regra global do Felipe (protótipo simula ambiente
real), aplicada explicitamente aqui antes mesmo de a tarefa começar.

### A segunda citação: o painel vira o ponto único de mexer na VPS

No mesmo dia, com uma instrução de sequenciamento explícita ("vamos primeiro
se preocupar em botar no ar"), o Felipe também registrou uma visão maior:

> "a partir de agora, todas as nossas interações com a VPS que não sejam de
> projeto, etcétera, de mexer na estrutura da VPS vai ser feito por esse
> projeto. Porque esse projeto agora é o lá na VPS também. Então,
> básicamente lá na VPS vai ser o que vai traduzir as minhas vontades e
> necessidades pra dentro da VPS de forma visual, ou seja, eu vou ver o que
> está acontecendo na VPS em tempo real, vou falar o que eu quero mudar. A
> gente tem que incluir também, no depois, alguns controles que fazem
> sentido com a VPS: tipo dentro da aba VPS, ter outras abas, prover tudo
> que está rolando lá em tempo real, por exemplo tem coisas que não são só
> agentes, tem processos, tem os sites que eu estou utilizando, coisas que
> podem estar desatualizadas em relação ao GitHub. Todas essas informações
> eu preciso ter depois, mas não agora."

(fonte: `docs/ROADMAP.md`, mesma frente)

Essa fala carrega duas peças novas, que o próprio ROADMAP separa:

Primeiro, o Agent Cockpit vira o ponto único de mexer na VPS, não só de
vê-la. Hoje a aba VPS existente no painel é só leitura, atualizada sob
clique (função `atualizarSnapshot()`, nunca em timer, pelo motivo de
segurança descrito na seção 8). A visão é o painel também agir lá: qualquer
mudança de estrutura da VPS que não seja o dia a dia normal de um projeto
específico passa a ser feita por aqui, não mais por comando manual direto na
VPS.

Segundo, a aba VPS ganha sub-abas com mais do que a lista de agentes: os
processos rodando de verdade no servidor, quais sites e domínios estão sendo
servidos, e se o código que está lá bate com o que está no GitHub (ou seja,
detectar deploy desatualizado). O próprio Felipe apontou o corte de
prioridade: isso é "depois", o que vem primeiro é subir o painel no ar.

### O que a sessão paralela de migração já descobriu, e o que falta de verdade

O `docs/BACKLOG-CAPTURA.md` traz uma apuração importante sobre um segundo
comentário do Felipe no mesmo dia, sobre colocar o "opencode" (uma
ferramenta de delegação de tarefas usada pelo projeto, ver seção 7) na VPS
"por causa do registro de uso":

> "o control center [...] usa o open code né, pra fazer a, a, o registro do
> estudo uso então a gente teria que colocar, o open code na vps também"

A apuração, feita lendo o código de verdade em vez de aceitar a premissa,
mostrou que ela não se confirma: quem registra o uso do plano é
`src/uso.mjs`, e a fonte dele são os `rate_limits` que o próprio Claude Code
entrega no JSON da `statusLine` a cada resposta, sem chamada de rede nem
leitura de credencial. `src/opencode.mjs` é outra coisa completamente
diferente: delegação de tarefas de enriquecimento de to-do, sem relação
nenhuma com o registro de uso do plano. E o próprio `FRAMEWORK-HOOKS.md` já
tinha decidido o oposto do que a ideia propunha: "opencode roda local nesta
máquina, nunca via SSH/VPS."

O que de fato falta, segundo essa apuração, para o Agent Cockpit funcionar
na VPS: instalar o `cc` lá (hoje não existe); configurar a `statusLine` no
`settings.json` do usuário de serviço da VPS (`claudedev`), removida
deliberadamente na migração porque apontava para o `cc.mjs` instalado via
npm no Windows, sem o que não há registro de uso nenhum; decidir se o painel
web roda na VPS, no Windows, ou nos dois ao mesmo tempo, e como os dois
estados se juntariam (dois arquivos `control-center-*.json` distintos, um
por máquina); e só depois disso, se ainda fizer sentido, reavaliar opencode
na VPS.

O subdomínio já está reservado: `cockpit.carzo.com.br` tem registro A criado
e já está configurado no nginx da VPS, apontando para `127.0.0.1:5180` sem
nada escutando ali ainda. É esperado que o endereço responda erro por
enquanto.

Esta é, portanto, visão registrada com evidência de apuração ao lado, ainda
sem nenhuma linha de código escrita para o painel rodar de fato na VPS.

---

## 4. O que já está construído

Esta seção percorre o `docs/ROADMAP.md`, os documentos de produto e o
histórico de commits, com foco no que está marcado como fechado ou já
aplicado em 13/08, além dos marcos anteriores relevantes.

### CC-32: a aba "projetos" vira cockpit (13/08)

A aba mais fraca do painel, que antes só mostrava tokens e rotas sem dizer o
que fazer com essa informação, virou "onde eu mexo agora": um cartão por
projeto, ordenado por urgência, com quem espera decisão do Felipe em
destaque e os demais agentes aparecendo como pastilhas frias, sem chamar
atenção.

A lógica vive em `src/cockpit.mjs`, código puro e testável, com duas funções
principais: `motivoDe()` decide por que um projeto está no topo, seguindo
uma ordem de prioridade que é a própria regra de negócio (bloqueio
explicitado pelo agente é o peso mais alto, porque é o único caso em que o
próprio agente escreveu o que está travando; depois falha ou estagnação;
depois espera; depois entrega em aberto; depois trabalho em andamento;
depois parado). Em caso de empate, desempata pelo que está naquele estado há
mais tempo, "o que apodrece primeiro sobe". A segunda função, `porProjeto()`,
agrupa por projeto.

Um princípio de design importante ficou registrado: "o peso nunca aparece na
tela". O que o Felipe vê é a frase ("travado: falta credencial da VPS"), não
um número. A justificativa: número sem explicação não é discutível, ele não
teria como discordar de um "87".

### CC-42: a aba "rotinas" (13/08)

O problema que resolve: uma rotina de terminal (um comando `/algo`) mora em
dois lugares possíveis, `~/.claude/commands/` (vale para todo projeto) e
`{projeto}/.claude/commands/` (vale só ali), e a cópia dentro do projeto
vence a global. Uma cópia velha desliga a rotina boa em silêncio, sem
nenhum aviso.

Medido ao ligar a aba: 22 rotinas desatualizadas em 5 projetos diferentes.
O pior caso encontrado foi o `end-session.md` do `app_maurice`: 224 linhas
contra 259 na global, e o arquivo se apresentando como pertencente ao
"projeto Juju" dentro de outro projeto inteiramente diferente. Nenhuma das
cinco cópias de `start-session.md` espalhadas mencionava o Método Routia (o
protocolo de coordenação entre agentes descrito na seção 7), que a versão
global menciona seis vezes.

`src/rotinas.mjs` (arquivo novo, 151 linhas) tem quatro funções: `estado()`,
`comparar()`, `sincronizar()` e `remover()`. A comparação é sempre por
conteúdo normalizado, nunca por data de modificação (copiar uma pasta
inteira renova a data sem mudar o conteúdo) e nunca por texto cru (os
arquivos são CRLF, e comparar sem normalizar acusaria diferença em tudo). O
resultado da comparação cai em quatro categorias, das quais só uma é
problema de verdade: `divergente` (grave, precisa de ação), `igual`
(redundante, mas inofensiva), `própria` (legítima, rotina de nome que só
existe naquele projeto) e a rotina que só existe na global, sem cópia, que
nem entra na lista.

Foi aplicado no mesmo dia: 21 cópias apagadas (16 desatualizadas mais 5
idênticas byte a byte), tudo commitado antes, portanto recuperável por
`git checkout` em cada projeto individualmente. Sobraram 16 rotinas: 12 de
nome próprio (`authorize`, `tickets`, `routia`, `end-session-quick`, que
nunca deram problema justamente por não terem homônimo na global) e 4
`set-role`, que têm customização real e viram decisão do Felipe sobre o que
fazer (ver seção 5, CC-44).

### CC-45: nenhuma rotina global escreve mais no vault (13/08)

Uma avaliação pedida pelo próprio Felipe descobriu que os dois maiores
passos do `/end-session` (passo 5.5, quadro de pendências humanas, e passo
5.6, diário centralizado) escreviam num vault do Obsidian que ele esvaziou
no mesmo dia, com o veredito "pode deletar tudo que for ia, ta tudo repetido
ou ultrapassado". Juntos, esses dois passos somavam 99 das 259 linhas da
rotina mais pesada do sistema, 38% do total.

A prova de que a instrução escrita sozinha não bastava veio ao vivo, na
mesma sessão: o vault foi limpo por volta das 03h50 de 13/08. Às 04h18 e
04h21, outra sessão de agente, seguindo `/end-session` normalmente, já tinha
recriado um arquivo de diário novo e um quadro kanban com 200 linhas ali
dentro. A instrução de parar de escrever estava, inclusive, documentada num
arquivo `LEIA-ME` dentro do próprio vault, e não sobreviveu nem meia hora.
Essa é a demonstração central de um princípio maior descrito em
`ROTINAS-HOJE.md`: instrução escrita é sugestão, hook (código que roda
automaticamente) é regra.

Ao investigar a fundo, descobriu-se que eram quatro rotinas globais
escrevendo no vault, não duas: `end-session.md` (259 para 176 linhas),
`novo-projeto.md` (472 para 316 linhas, cujo passo 7 criava tarefa, nota e
dois quadros kanban em pastas do vault que já não existem mais),
`deps.md` (108 para 106 linhas) e `daily-log.md` (108 para 89 linhas, que
agora escreve dentro de `docs/diario/` do próprio projeto em vez do vault
central). No total, 243 linhas a menos, e uma varredura confirmou que só
sobraram as linhas que agora proíbem a escrita no vault. O dado que essas
rotinas coletavam não se perdeu: "o que só o Felipe pode fazer" virou o
campo `blockers` do `meta.json`, que o cartão do agente no painel já exibe.
É troca de destino, não deleção de informação.

### CC-23: histórico rico por projeto (13/08)

Antes desta entrega, `historico.mjs` tinha cerca de 100 linhas e cobria só o
que a aba de tempo precisava: blocos de tempo trabalhado. Não cobria "o que
esse projeto produziu que vale virar registro ou conteúdo". Essa entrega
estruturou o histórico por marco (commit relevante, tarefa fechada, evento),
não só por bloco de tempo cru. É descrita no ROADMAP como o gargalo que
destravava três outras entregas ao mesmo tempo (CC-24, CC-33 e CC-41), por
isso foi a primeira da lista de execução do dia, segundo `docs/PLANOS.md`.

### CC-33: marca de visita e o delta "desde que você saiu" (13/08)

Resolve a pergunta "o que mudou desde a última vez que olhei este projeto"
sem precisar construir um log de eventos completo. A ideia aproveitou
carimbos que já existiam espalhados pelo sistema (quando um to-do foi
fechado, quando um agente foi criado, quando o histórico perdeu de vista um
agente, quando o roadmap foi editado pela última vez) e adicionou só uma
peça nova: uma marca de visita, gravada por um botão explícito ("vi isso"),
nunca automática. A justificativa para não automatizar: como o Felipe olha
o painel o dia inteiro, marcar visita sozinho ao abrir a aba destruiria o
próprio sinal que a funcionalidade tenta capturar.

### CC-34: mapa visual em pastilhas de frente (13/08)

Um mini mapa dentro do cartão de cada projeto no cockpit, mostrando as
frentes de trabalho do `ROADMAP.md` daquele projeto como pastilhas
coloridas conforme o estado (aberto, em progresso, feito, bloqueado), numa
grade simples em CSS puro, sem biblioteca externa. Também passou a permitir
abrir o mapa completo de qualquer projeto, com ou sem agente vivo no
momento, o que antes não era possível.

### CC-35: `git log --since` na abertura do projeto (13/08)

A resposta mais rica possível para "o que mudou desde que eu saí": lista de
arquivos de verdade alterados, não uma contagem. Antes disso, o único dado
parecido era `sinais.arquivos` do `tempo.mjs`, que é só uma contagem de
edições, sem dizer quais arquivos foram tocados. Sempre disparado sob
clique, nunca em temporizador automático.

### CC-24: digest semanal entre projetos (13/08)

Uma ferramenta que cruza o histórico de commits, o diário e o roadmap de
todos os projetos que têm `CLAUDE.md` (a mesma lista que a sincronização de
rotinas já varre) e produz um resumo por projeto, pensado como candidato a
virar post de conteúdo. Roda sob demanda, nunca em temporizador, pela mesma
lógica que já vale para a leitura de processos pesados e da VPS: é caro
demais para rodar sozinho a cada dois segundos.

### CC-06: agrupamento por rota (13/08, parcial)

Duas ideias soltas foram avaliadas juntas. A primeira, agrupar a lista de
agentes por rota de trabalho quando passam de 4 no mesmo cartão, foi feita.
A segunda, ordenar por consumo de token, já existia desde antes e não
precisou de trabalho novo. Uma terceira ideia relacionada, avisar quando um
agente fica sem sinal por N minutos, foi deliberadamente não construída,
porque o precedente de uma funcionalidade parecida (a "faixa de atividade",
CC-07) tinha sido construído antes e nunca usado, e removido da tela. O
ROADMAP registra explicitamente essa decisão de não construir por
enquanto.

No caminho deste item, apareceu um bug ainda sem dono: a função que decide
o estado de uma frente do roadmap (`estadoDe()`) usa correspondência de
texto solta demais, e classificou errado dois títulos reais só por conterem
certas palavras no meio da frase (uma frente chamada "Histórico rico" foi
lida como "feito" porque contém a palavra "Histórico"; outra sobre um
"agente travado" foi lida como "bloqueado" porque contém "travado"). Fica
registrado como pendência técnica encontrada, não corrigida ainda.

### CC-41: o painel enxerga os sinais do ciclo (13/08)

Dois padrões de comportamento medidos na análise do ciclo Felipe → IA →
Felipe (ver seção 6) passaram a entrar como motivo de destaque no cockpit,
com peso intermediário entre "esperando resposta" e "parado há muito
tempo": rajada (três ou mais mensagens em menos de seis minutos) e
repetição (sobreposição de palavras de quatro ou mais letras, em 60% ou mais,
com uma mensagem anterior). A lógica vive em `src/sinais.mjs`, alimentada
por uma nova função em `src/transcript.mjs`.

Um bug foi encontrado e corrigido pelo próprio teste antes de a entrega
subir: a lógica que colapsa "reenvio em menos de 5 minutos substitui a
mensagem anterior" (uma das sete regras do ciclo, ver seção 6) comparava só
o tempo entre mensagens, e por isso engolia rajadas de verdade, três
mensagens diferentes em dois ou três minutos viravam "uma reescrita só", o
que zerava o sinal de rajada. A correção: só colapsa quando a mensagem nova
tem sobreposição real de conteúdo com a anterior, não qualquer par de
mensagens só porque estão próximas no tempo.

Um terceiro sinal, silêncio (mais de dez minutos sem mensagem do Felipe), é
calculado mas deliberadamente não virou motivo de destaque na tela: seria
redundante com o sinal de "estagnado" já existente, mesmo limiar de tempo,
ângulo diferente (um mede "o agente travou", o outro mediria "o Felipe foi
embora"). Fica disponível no dado interno para quem quiser usar, sem
duplicar na interface.

### CC-40: índice das memórias comportamentais (13/08, levantamento; decisão pendente)

Um levantamento completo de todas as memórias do tipo `feedback`
(comportamento do Felipe registrado, não fato de projeto) espalhadas pelas
pastas de memória do Claude Code. Contagem real: 81 memórias em 22 pastas de
projeto diferentes, contra uma estimativa anterior no próprio roadmap de
"cerca de 30 em 15". A concentração real é maior do que se pensava: 25
memórias só no projeto `inovallbond`, 10 no `market-tracker`.

O levantamento classificou as 81 em três grupos: sete já duplicam alguma
regra que já está no `CLAUDE.md` global (não é erro, é sinal de que a regra
é forte o bastante para ter sido descoberta duas vezes, em projetos
diferentes, sem combinar); seis são candidatas genuínas a subir para o
global, com destaque para uma sobre porta de servidor de teste compartilhada
entre sessões, confirmada no mesmo dia por um bug real encontrado durante o
próprio CC-42 (ver seção 8, armadilha do `pkill`); duas estão mortas,
descrevendo uma estrutura de kanban do vault que a limpeza do mesmo dia
apagou; e as 68 restantes (84% do total) são de fato locais, corretamente
presas ao projeto onde vivem. A decisão de quais das seis candidatas sobem
para o global de fato fica com o Felipe.

### CC-36: enriquecimento de to-dos pelo opencode (13/08, com achado crítico)

Este item merece atenção especial, e a explicação técnica completa está na
seção 5, porque o processo de testar esta entrega revelou o bloqueio mais
sério achado em todo o dia. Resumo rápido do que a entrega pretendia
resolver: o pedido do Felipe foi "olho os to-dos e as tarefas não fazem
sentido, os nomes poderiam ser mais explicativos e as tarefas poderiam abrir
e ter um resumo da conversa que gerou ela, qual arquivo mexe". A ideia era
uma chamada por agente (não por tarefa) para uma ferramenta externa chamada
"opencode", guardando o resultado num novo campo `explicacoes` do
`meta.json`, mapeado por texto da tarefa (o mesmo padrão já usado para
`feitoEm`, porque o agente reescreve a lista `todos` inteira a cada
`cc set`, e um mapa por índice se perderia).

### Entregas anteriores relevantes (05/08 a 12/08)

Além do MVP fechado em 05/08 (sete itens, listados na seção 1), o projeto
recebeu uma sequência longa de entregas entre 05/08 e 12/08, visível no
histórico de commits. Em ordem aproximada: bloco de notas na interface com
backup automático (depois que um esvaziamento acidental em 09/08 apagou duas
listas do Felipe sem se conseguir provar quem gravou); tempo por projeto com
custo em token e depois em reais, com cotação de dólar buscada de uma API
externa e cache de 12 horas; aba de preço por tarefa resolvida, com
classificação de nível de esforço; aba "escritório" com o Pixel Agents
(ferramenta de terceiros que desenha cada sessão como um personagem andando
num escritório); seis temas visuais de cor; construtor de gráficos cruzando
os dados do painel; calendário do Google integrado por leitura de iCal
(CC-20); módulos de CPU, memória e GPU no topo da tela; barra de mídia
controlando o que está tocando no Windows e o volume por aplicativo; janela
flutuante (Picture-in-Picture) para acompanhar o painel por cima de outras
janelas; aba de servidores mostrando as portas abertas na máquina, com
apelido, favorito e botão de subir servidor novo; snapshot da VPS por SSH
(nginx, PM2, Docker) sob clique; e, em 12/08, o início do "framework de
hooks" (ver seção 5 e 7), com o Método Routia de coordenação entre agentes
adaptado ao painel (CC-27 e CC-28) e o primeiro mecanismo de disparo do
opencode em segundo plano (CC-29).

---

## 5. O que está em aberto agora

Lista dos itens que o `docs/ROADMAP.md` mantém como abertos em 13/08/2026,
na ordem de importância que os próprios documentos sugerem.

### O bloqueio crítico de 13/08: o `cwd` não isola o opencode de verdade

Este é o achado técnico mais sério do dia, e o próprio ROADMAP o marca com
destaque como "bloqueio crítico". Vale explicar com detalhe, porque afeta
mais de uma entrega.

Ao testar o CC-36 (enriquecimento de to-dos, descrito na seção 4) contra o
binário real do opencode, passando explicitamente um `cwd` (diretório de
trabalho do processo) apontando para uma pasta temporária nova a cada
chamada, uma das chamadas rodou de verdade os comandos `git status --short`
e `git log --oneline -3`, e leu o estado real do repositório
`proj_controlcenter`, não o da pasta isolada que tinha sido passada como
`cwd`.

Isso contradiz uma premissa de segurança que já estava escrita desde o
CC-29, em `src/opencode.mjs`: a de que o opencode "roda em pasta neutra,
nunca o cwd do projeto". O parâmetro `cwd` da função `spawn()` do Node.js
não está controlando de fato onde o opencode executa suas próprias
ferramentas internas (comandos de terminal, edição e escrita de arquivo);
o processo parece manter alguma noção própria de "qual é o projeto atual",
independente do processo que o chamou.

O achado foi confirmado por dois testes com resultado diferente no mesmo
dia: um `pwd` pedido manualmente, via um `cd` real antes de chamar
`opencode run`, respondeu corretamente, isolado na pasta temporária. A
mesma chamada, feita através da função `dispararTarefa` do painel (que
envolve invocar `cmd /c` no Windows), não isolou.

O que ainda não foi investigado, por falta de tempo na própria sessão que
encontrou o problema: se a causa é o `cmd /c` perdendo o `cwd` ao longo da
cadeia de processos filhos, se é o opencode tendo uma sessão ou projeto
persistido em `~/.config`, independente do processo que o chamou, ou outra
causa ainda não cogitada.

Isso afeta qualquer uso da função `dispararTarefa`, não só o CC-36: o CC-29
(o disparo em segundo plano já em produção) e o CC-30 (a fila de revisão do
opencode, ainda não construída) carregam a mesma suposição de isolamento,
hoje não comprovada.

O risco concreto: os agentes do opencode neste ambiente têm permissão
`permission:*`, nenhum deles é apenas leitura. Enquanto o isolamento não
for resolvido, qualquer chamada real pode, em tese, editar um arquivo de
verdade do projeto em vez de só descrever texto sobre ele.

A instrução deixada para antes de usar o CC-36, ou qualquer outra coisa que
dispare o opencode, em produção: isolar de verdade (testando sem `cmd /c`,
ou encontrando a flag ou configuração do opencode que fixa o projeto por
chamada) e provar com um teste que tenta editar um arquivo canário fora do
`cwd` esperado, e confirma que essa tentativa falha.

### CC-30: fila de revisão do opencode

Depende do CC-29 e de uma decisão ainda em aberto sobre qual evento e qual
critério "obrigam" a chamada ao opencode: um gatilho automático a cada
mensagem em linguagem natural (mais agressivo) ou um comando explícito tipo
`cc delegar "tarefa"` (menos hook obrigando, mais ferramenta que o próprio
agente escolhe usar). O resultado nunca fecharia um to-do sozinho, a
aprovação humana só marcaria `revisado: true` numa fila separada, fora de
`~/.claude/jobs`.

### CC-31: painel de metodologia

Um checklist estático (ágil, UML, MER) e uma aba só de leitura que mostra,
para o agente selecionado, o que parece estar faltando, com base em sinais
que já existem hoje (por exemplo, ausência de `frente` ou de `todos`).
Nunca bloqueia, só alerta. O conteúdo exato das perguntas do checklist é
decisão editorial do Felipe, não técnica, e ainda está em aberto.

### CC-14: porcentagem do plano no tray do Windows

O ícone do Claude Code na bandeja do sistema mostra um percentual de uso do
plano que não bate com o real. Não é bug deste projeto, mas agora dá para
conferir contra a fonte oficial: o painel mostra o número que vem
diretamente de `rate_limits` da `statusLine`, o mesmo valor de `/usage`. Se
o ícone da bandeja discordar do painel, o errado é o ícone.

### CC-08: macOS e Linux nunca rodaram

O código de suporte a esses sistemas existe em `src/platform.mjs` (launchd e
`lsof`/`ss` no lugar do PowerShell, `SIGTERM` no lugar de `taskkill`,
arquivos `.command`/`.desktop` no lugar de `.lnk`), mas nunca foi executado
de fato, porque a máquina de desenvolvimento é Windows. Quando houver um Mac
ou Linux disponível, a ordem de verificação recomendada é: `cc` só leitura
primeiro, depois `cc open`, depois `cc daemon install`, depois a aba de
servidores, e por fim encerrar um processo de teste.

### CC-04: verificar o aviso de silêncio com agente travado de verdade

Restou da remoção da "faixa de atividade" (CC-07) em 06/08. O que sobrou é
uma nota de texto na linha do agente, "sem sinal há X minutos", que nunca
apareceu numa captura de tela real porque não houve um agente travado de
verdade enquanto o desenho estava sendo feito. Fica para conferir na
primeira vez que acontecer.

### Frente de conteúdo social (CC-21 a CC-26)

Decidida com o Felipe em 11/08 para viver dentro deste mesmo repositório,
não como projeto separado. CC-20 (calendário, leitura) e CC-21 (escrita na
agenda via MCP do Google Calendar) são pré-requisito do resto; o restante
pode andar em paralelo depois que os sinais existirem. CC-22 é um formato
ainda em aberto para registrar manualmente um marco que não deixa rastro em
código (uma reunião, uma fala em evento presencial). CC-25 reviveria o vault
do Obsidian só como espelho de leitura, nunca como fonte de dado nem destino
de escrita, decisão de 11/08 que precisa ser reconciliada com o
esvaziamento do vault em 13/08. CC-26 seria uma skill de geração de
rascunho de post, fora deste repositório, dependente do CC-24 (digest
semanal) já existir.

### CC-39: consertar o `- projeto_template`

Parte já aplicada em 13/08: os quatro arquivos de agente do template
(`planner`, `reviewer`, `scrum-manager`, `tester`) tinham o nome de outro
projeto (`app_ayvu`), um caminho de disco fixo e uma stack de tecnologia
hardcoded, incluindo um exemplo de código quebrado que vazou de um
find-and-replace malfeito. O `docs/HANDOFF.md` do template carregava 133
linhas de estado real de outro projeto (datas, hash de commit, resultado de
benchmark), sobrescrito por um modelo vazio.

Um achado maior ficou sem tocar, porque é decisão de conteúdo, não
mecânica: a pasta `app/` do template tem 91 arquivos de um aplicativo
Flutter real (`com.ayvu.ayvu`, incluindo código Android/Kotlin), a pasta
`docs/legacy/` guarda sessões reais daquele projeto, e o `ROADMAP.md` do
template abre citando o nome do projeto original. Isso não parece mais
"template com resíduo", parece o projeto real sendo convertido em template,
pela metade. Fica para o Felipe decidir se isso é referência que ele quer
manter ou lixo a remover.

### CC-43: decisão D1: o painel escrever `settings.json`

Planejada em detalhe, não implementada. O plano de segurança, caso seja
aprovada, inclui: backup datado antes de qualquer escrita; validação depois
de escrever com reversão automática se algo quebrar; escrita cirúrgica,
nunca do arquivo inteiro; registrar um hook novo por vez, e conviver com ele
uma semana antes de abrir para os outros; e um botão de pânico visível na
mesma tela. A decisão de fazer ou não depende de uma pergunta de valor, não
técnica: "o que um hook registrado pelo painel faz que um comando
distribuído não faz?" Se o CC-42 (distribuição de comando, já no ar) já
resolver a dor, a D1 perde o motivo de existir.

### CC-44: as quatro rotinas `set-role` divergentes

A única customização real que sobrou depois da limpeza de rotinas do CC-42.
Cada projeto define papéis próprios; o caso mais distinto tem 38 linhas que
não existem em nenhum outro lugar. Pela convenção decidida em 13/08 (a
global vale para tudo, o projeto só acrescenta, nunca sobrescreve por
homônimo), isso deveria virar um comando de nome próprio por projeto, mas
isso muda como o Felipe invoca o comando no dia a dia, então é escolha dele,
não deleção automática.

### Decisão D1 e o gatilho do framework de rotinas

Fechado no dia: o framework de rotinas (a peça 5 da visão descrita na seção
7) liga no início de cada projeto, com o Felipe desenhando o framework ele
mesmo; o painel entra como quem liga, distribui e mostra, não como quem
inventa o método.

---

## 6. O ciclo Felipe → IA → Felipe

Em 13/08/2026, uma sessão analisou 235 mensagens reais digitadas pelo
Felipe, extraídas dos transcritos de cinco sessões recentes de trabalho
(`maurice` 72 mensagens, `pierre` 71, `carzo` 41, `inovallbond` 31,
`controlcenter` 20), numa janela entre 11/08 às 15h39 e 13/08 às 04h40. Mais
43 pastas de memória comportamental, 7 diários e cerca de 60 armadilhas
técnicas já registradas em vários projetos. A regra de ouro declarada no
próprio documento: "nenhuma regra entra aqui sem evidência medida. Se não
houve um caso real que a justifique, é palpite, e palpite vira a burocracia
que se desliga na terceira semana."

Números que enquadram tudo: 67% das mensagens seguidas trocam de projeto
(paralelismo é o normal, não a exceção); a janela de atenção por projeto tem
mediana entre 8 e 20 minutos; o tamanho das mensagens é bimodal, 17% até 25
caracteres e 18% acima de 500 (dois modos de operação distintos, não uma
escala contínua); 32% das mensagens trazem pergunta; e só 2 em 235 são
interrupção do agente (ele não interrompe a IA, ele interrompe a si mesmo).

As sete regras que saíram da análise, cada uma com a citação literal que a
sustenta:

**1. Na segunda repetição do mesmo pedido, parar de codar e desambiguar o
substantivo.** Descrito como "o achado de maior retorno de toda a análise".
Três sagas longas em três projetos diferentes (1h39, cerca de 2h, cerca de
5h) tiveram o mesmo esqueleto: pedido rico em descrição, entrega de outra
coisa, repetição, frustração, troca de modelo, e a quebra só veio quando uma
palavra foi desambiguada, nunca quando alguém tentou uma implementação
nova. O caso mais claro:

> "por algum motivo você não conseguiu compreender que eu falei que as
> nuvens são flutuantes ao cenário, e são parte do CHÃO, da camada CHÃO, e
> não CÉU"

seguido de

> "quando eu falo nuvem me refiro a esse objeto isolado do fundo do céu"

A implementação nunca foi o problema: "nuvem" significava coisas diferentes
nas duas cabeças. O custo que isso evita: três das quatro sagas longas
medidas teriam morrido numa única mensagem se alguém tivesse perguntado o
que a palavra queria dizer na segunda repetição.

**2. Nunca reclamar sem prova, e nunca confiar em relatório sem prova
visual.** 28 das 235 mensagens trazem print, URL ou pedem explicitamente
para olhar algo. Frases como:

> "olha como fica. as partes de dentro não sumiram. a solução é diferente
> da que você tá tomando"

e

> "Pode fazer, daí sobe um túnel. E aí nesse túnel eu confiro no telefone."

O custo que evita: relatar "feito" sem prova visual é descrito como "o
gatilho número 1 de retrabalho" em todo o histórico analisado. O documento
nota, de forma auto-referente, que essa é a regra mais repetida de todas
(gerou memória em três projetos diferentes) e mesmo assim não estava no
`CLAUDE.md` global antes desta análise, o que explica por que continuava se
repetindo.

**3. Quando ele nomeia o mecanismo, o mecanismo é o pedido.** 12 mensagens
acusatórias em três projetos, sempre com a mesma estrutura: ele pediu A,
recebeu A' que a IA achou melhor.

> "eu pedi p usar linhas e não usar bolinhas. Você simplesmente dobrou a
> aposta e colocou mais bolinhas ao invés de linhas"

> "Você não colocou levemente o amarelo, você botou tudo amarelo"

O custo: substituir a abordagem nomeada por ele por uma "melhor" é descrito
como o erro que ele mais reclama. A regra que evita isso: se a abordagem
pedida parecer errada, dizer isso antes de trocar, nunca entregar a troca
como fato consumado.

**4. Visão longa se registra, não se implementa.** Marcador objetivo:
mensagem acima de cerca de 400 caracteres que abre com "e se", "tive uma
ideia", "me deu uma ideia", "proponho" ou "poderíamos".

> "Poxa, tive uma ideia. A gente tem um site chamado barra..."

> "anote isso tudo antes de considerar e organizar"

> "salva um backlog sobre isso, e vamos voltar pra questão anterior"

O custo: implementar visão como se fosse tarefa já produziu uma página
inteira jogada fora num dos projetos analisados.

**5. Ordem curta é para executar e calar.** Distribuição bimodal medida:
17% das mensagens têm até 25 caracteres, 18% passam de 500, são dois modos,
não uma escala. Em pedidos como "sobe dev server", "commit" ou "manda ver",
perguntar "quer que eu confirme antes?" é ruído. A brevidade é descrita
como estratégia deliberada, não desleixo:

> "eu sou analista de sistemas e sei tranquilamente configurar um server,
> mas eu sei também que às vezes se eu falar de um jeito rápido e curto
> você entende. eu comecei a entender as suas limitações e a entender que
> às vezes explicar demais é perda de tempo"

**6. Reenvio em menos de 5 minutos substitui a mensagem anterior, não
soma.** Só 2 interrupções em 235 mensagens, e as duas com a mesma
assinatura: manda, corta em segundos, reenvia a versão completa minutos
depois, sempre maior e mais precisa. O documento também recomenda esperar
alguns segundos antes de disparar trabalho pesado a partir de um pedido
curto, porque ele frequentemente ainda está formulando a ideia.

**7. Medir antes de agir na hipótese dele.** As hipóteses de causa que ele
levanta são plausíveis e, às vezes, erradas; agir direto nelas sem medir já
piorou o produto duas vezes no mesmo dia, em casos registrados. Ele aceita
bem a correção quando ela vem acompanhada de evidência, e mal quando vem
como opinião.

### O diagnóstico incômodo

O documento resume assim: "em todas as armadilhas nascidas de reclamação
dele, o padrão é o mesmo: a IA estava tecnicamente correta e humanamente
errada." O texto do cartão estava certo, o campo existia mesmo, o contraste
era mensurável, a conta fechava aritmeticamente. O que falhava era o
significado para quem olha de relance, sem o contexto todo carregado na
cabeça.

E o diagnóstico maior: o problema hoje não é falta de regra, é excesso de
regra dispersa. Quatro seções obrigatórias no `CLAUDE.md` global, cerca de
30 memórias comportamentais espalhadas por 15 projetos (número que o CC-40
depois corrigiu para 81 em 22 projetos), cerca de 60 armadilhas técnicas,
sem índice, sem hierarquia, com pelo menos seis contradições convivendo sem
nenhum critério de desempate. As regras de maior retorno medido, como a
verificação visual obrigatória, estavam presas em memória de um projeto só,
e por isso o mesmo erro se repetia em projetos diferentes.

Como consequência direta desta análise, o CC-38 subiu as regras de maior
retorno para o `CLAUDE.md` global (é o mesmo arquivo lido no início desta
sessão, com as sete regras já incorporadas na seção "O ciclo de trabalho com
o Felipe").

---

## 7. Arquitetura e módulos

O projeto não tem dependência de runtime: só precisa de Node 18 ou mais
novo, e do que já vem com ele. Funciona totalmente offline, com uma exceção,
a cotação do dólar, que degrada de forma controlada para o último valor
conhecido quando a rede falha.

A entrada única do sistema é `cc.mjs`, que resolve tanto a interface de
linha de comando (terminal, servidor web, daemon, comando `set`, instalação
em outros projetos) quanto é o arquivo que o binário global `cc` na verdade
chama.

Dentro de `src/`, cada módulo tem uma responsabilidade isolada:

`jobs.mjs` é o núcleo: lê `~/.claude/jobs`, deriva os campos que aparecem na
tela e escreve `meta.json`. `transcript.mjs` extrai o último pedido feito
pelo Felipe, lido diretamente do arquivo `.jsonl` da sessão. `platform.mjs`
concentra tudo que depende do sistema operacional, por regra explícita do
projeto (ver seção "portabilidade" abaixo). `daemon.mjs` cuida de subir
sozinho no login, criar o atalho, e subir ou derrubar o processo, delegando
para `platform.mjs` o que depende de sistema. `servers.mjs` cuida das portas
em escuta na máquina: o que cada uma é, apelido, favorito, duplicados, subir
de novo e as travas de segurança para encerrar um processo. `docker.mjs` lê
os containers Docker locais (`docker ps`), tanto para o painel quanto para a
janela flutuante. `vps.mjs` monta um retrato da VPS por SSH (nginx, PM2,
Docker), só sob clique explícito, nunca automático. `rotinas.mjs` cuida dos
comandos `/algo` copiados dentro dos projetos: o que está desatualizado, e o
conserto sob clique. `config.mjs` é o interruptor global e por projeto.
`notes.mjs` é o bloco de notas da máquina, guardado em `~/.claude`.
`tempo.mjs` calcula horas por projeto e custo de token, lidos diretamente
dos transcritos de sessão. `cambio.mjs` busca a cotação do dólar, uma das
únicas duas chamadas de rede que o painel faz. `mercado.mjs` traz valor por
hora de desenvolvedor por senioridade, raspado de duas fontes externas.
`tarefas.mjs` calcula preço por problema resolvido, cruzando esforço, nível
e valor. `historico.mjs` guarda o que sobra depois que o próprio CLI do
Claude Code apaga o job (ver armadilha correspondente na seção 8).
`uso.mjs` traz o uso do plano (janela de 5 horas e semanal), colhido da
`statusLine`. `maquina.mjs` lê CPU e memória do próprio processo Node, e GPU
via `nvidia-smi`. `roadmap.mjs` transforma o `ROADMAP.md` de cada projeto em
mapa visual na tela. `midia.mjs` normaliza e cacheia o que está tocando e os
controles de mídia; `midia.ps1` é o script PowerShell que fala com as duas
APIs de mídia do Windows, rodando como processo vivo (ver seção 8).
`graficos.js` é o motor de gráficos: um índice do que pode cruzar com o quê,
servido para rodar no navegador, não é módulo do servidor.
`install.mjs` escreve o bloco de protocolo no `CLAUDE.md` de cada projeto.
`tui.mjs` desenha a tabela do terminal. `web.mjs` é o servidor HTTP, o
canal de atualização em tempo real (SSE) e as rotas de escrita. `ui.html` é
a página inteira, sem nenhuma dependência externa.

Na raiz, `test.mjs` contém os testes automatizados (afirmações de
comportamento e checagem de sintaxe do `ui.html`) e `test-ui.mjs` testa a
aba de to-dos dirigindo um Chrome de verdade via protocolo de depuração,
fora do gate normal porque exige o navegador instalado. `AGENTS.md` é o
protocolo que cada agente de IA segue para alimentar o painel.

### Portabilidade

Uma regra estrutural do projeto: `process.platform` só pode aparecer dentro
de `src/platform.mjs`. Todo comando que depende do sistema operacional
(subir no login, listar portas, matar processo, abrir navegador, criar
atalho) passa por esse único arquivo, com um caminho de código por sistema
operacional. Só o caminho do Windows foi verificado numa máquina real; os
caminhos de macOS (`launchd`, `lsof`, arquivos `.command`) e Linux (systemd
de usuário, `lsof`/`ss`, arquivos `.desktop`) foram escritos seguindo os
comandos padrão de cada sistema, mas nunca rodaram de fato (é o CC-08,
listado na seção 5).

Nenhum caminho de disco específico da máquina do Felipe pode ficar fixado
no código: a pasta de projetos é descoberta a partir dos diretórios onde os
jobs do Claude Code já rodaram, e pode ser forçada pela variável de
ambiente `CC_PROJECTS_BASE`.

### A regra de ouro: nunca quebrar o Claude Code

`state.json` e `pins.json`, os arquivos que o próprio CLI do Claude Code
escreve, são tratados como somente leitura, sempre, sem exceção. A única
escrita permitida em todo o sistema é `meta.json`, um arquivo novo que o
Claude Code não conhece nem lê, escrito de forma atômica (grava num arquivo
temporário e depois renomeia, para nunca deixar um arquivo pela metade se o
processo cair no meio). Qualquer mudança que escreva em outro arquivo dentro
de `~/.claude/jobs/` é considerada errada por definição, independente da
justificativa.

### O protocolo do meta.json, em resumo

Descrito em detalhe em `AGENTS.md`: o agente de IA que está trabalhando
escreve em três momentos, no máximo. Ao entender a tarefa (antes da primeira
edição de código): `subject` (assunto em três a seis palavras, o problema,
não o comando rodado), `frente` (o título da seção do `ROADMAP.md` onde este
trabalho se encaixa, o que liga o cartão do agente ao mapa do projeto) e
`todos` juntos. Assim que cada to-do fecha: um comando `cc done "texto da
tarefa"`, sem precisar reenviar a lista inteira. Ao entregar: `status`,
`links`, e a lista de to-dos fechada, `blockers: null` se nada travou. O
próprio protocolo é explícito: "entregar deixando to-do aberto é erro. Ou
você fecha o que terminou, ou explica em `blockers` o que ficou para trás."
E: "entregar sem `frente` também é erro", se o projeto tem um `ROADMAP.md`
com seções.

Quando o reporte está desligado (`cc off`), o comando `set` vira um no-op
silencioso: sai com código de sucesso, não escreve nada, não reclama nem
trava o agente que o chama.

### O Método Routia e o framework de hooks

Vale explicar dois conceitos que aparecem em vários pontos deste documento.
O Método Routia é um sistema de coordenação entre agentes de IA rodando em
paralelo no mesmo projeto: antes de mexer numa pasta controlada, o agente
confere um quadro (`docs/ROTAS-ATIVAS.md`) para ver se ela já tem dono; se
tiver, não mexe e abre um pedido em vez de atropelar quem já está
trabalhando ali. Já existia antes do Agent Cockpit, e foi adaptado para ser
controlado pelo painel em 12/08 (CC-27 e CC-28).

O framework de hooks, decidido em 12/08, é a mudança de o painel deixar de
só ler o estado dos agentes e passar a controlar comportamento de verdade do
Claude Code: hooks ligados e desligados pelo painel, o Método Routia
automatizado em vez de convenção só em texto, e tarefas de enriquecimento
delegadas para o "opencode" (uma ferramenta externa de execução de tarefas)
em segundo plano. Uma distinção central, registrada no próprio documento de
visão do framework: hooks são código que roda automaticamente disparado por
um evento (por exemplo, quando a sessão termina), diferente de instrução em
texto, que o agente pode simplesmente ignorar sem consequência nenhuma. A
frase que resume essa distinção, repetida em vários documentos do projeto:
"instrução escrita é sugestão, hook é regra."

---

## 8. As armadilhas e lições aprendidas

O `CLAUDE.md` do projeto mantém uma lista longa de bugs reais, cada um com a
causa raiz encontrada. Esta seção reúne as mais instrutivas, em português
simples.

**1. `detached: true` no Windows quebra a captura de saída de um processo
filho, sempre.** A causa real não é a flag em si: é o processo Node que
disparou o comando terminar antes do filho, o que é justamente o
comportamento esperado de `detached: true` (disparar e sair). Sem
`detached` e sem `unref`, o Node espera o filho sozinho, e a captura de
saída funciona sempre. A regra prática: se o disparo acontece de dentro do
próprio processo do painel, que já não sai sozinho, não precisa de
`detached` nem `unref` nenhum.

**2. `shell: true` com texto arbitrário do usuário como argumento é injeção
de comando real, não só má prática de estilo.** Encontrado no mesmo módulo
de disparo de tarefas, onde o texto do pedido é livre. A correção: nunca
usar `shell: true` com uma lista dinâmica de argumentos; em vez disso,
invocar `cmd.exe` diretamente como executável, sem `shell`, com `/c` e cada
argumento como elemento separado da lista, deixando o próprio Node escapar
cada um ao montar a linha de comando do Windows.

**3. O arquivo de configuração não é isolado por porta.** Subir uma
instância de teste do painel numa porta diferente da real protege o
processo, mas não protege o dado: o módulo de configuração aponta sempre
para o mesmo arquivo em `~/.claude`, então escrever nele pela porta de
teste escreve no arquivo que o painel real também lê. Já aconteceu de
verdade: um calendário de teste foi salvo na configuração real do Felipe.

**4. `pkill -f` não mata processos Node no Git Bash do Windows, e falha em
silêncio.** Achado durante o próprio CC-42: matar o processo antigo antes de
subir um novo parecia funcionar, mas a porta continuava sendo servida pelo
processo antigo, e o novo processo morria em silêncio porque a porta já
estava ocupada. Resultado: uma correção real de código foi testada cinco
vezes contra o binário velho, e o sintoma observado ("o módulo funciona
isolado, mas a rota HTTP recusa") apontava para o lugar errado. No fim,
havia cinco processos acumulados na mesma porta. A forma correta de matar
de verdade no Windows é pelo PowerShell, com `Get-CimInstance` filtrando
pela linha de comando. A regra prática que ficou: quando o módulo passa no
teste direto mas falha pela rota HTTP, o suspeito número um é processo
velho, não o código novo.

**5. O primeiro prompt de uma sessão não serve como "o pedido atual".** Uma
sessão longa que mudou de assunto continuaria mostrando o pedido antigo. Em
sessões que reiniciam, esse campo já apareceu com o prompt de outra conversa
inteiramente diferente. O pedido de verdade tem que vir do transcrito da
sessão, identificado pelo próprio identificador da sessão, que nunca se
mistura entre conversas diferentes.

**6. Nem toda mensagem do tipo "user" no transcrito foi de fato escrita por
uma pessoa.** Injeção automática de uma skill vem marcada de um jeito
específico, com o conteúdo inteiro do arquivo de instrução da skill dentro
do corpo; uma interrupção vem marcada de outro jeito; a saída de uma
ferramenta usada pelo agente vem marcada de um terceiro jeito. Sem filtrar
essas marcações, o painel já mostrou o texto de uma instrução de sistema
como se fosse um pedido real do Felipe.

**7. O formato do `meta.json` varia entre agentes, e isso precisa ser
tolerado, não corrigido na fonte.** Um agente gravou um campo com nome
abreviado errado, e o painel exibiu "undefined" ao lado da tarefa inteira.
A solução adotada foi normalizar toda leitura, aceitando as variações mais
comuns em vez de depender de todo agente acertar o formato exato.

**8. Matar um processo pela aba de servidores precisa de três travas ao
mesmo tempo.** O identificador do processo precisa estar na lista atual de
verdade, o processo precisa parecer um servidor de desenvolvimento, e não
pode estar numa lista de processos protegidos, que inclui processos do
próprio sistema operacional cuja morte derrubaria a sessão inteira do
Windows.

**9. PowerShell não usa barra invertida como caractere de escape.** Montar
um comando concatenando um JSON gerado por `JSON.stringify` quebra o parse
em silêncio; a correção foi usar aspas simples, escapadas duplicando-as, no
padrão que o PowerShell realmente espera.

**10. O pacote instalado globalmente é um link para o repositório, não uma
cópia.** Quando o painel é instalado a partir de uma pasta local, o Windows
cria um link simbólico para o repositório de verdade, não copia os
arquivos. Três consequências práticas: mexer no código dentro de `src/` e
reiniciar o daemon já serve o código novo, sem reinstalar nada; o painel do
dia a dia mostra o que está fisicamente na árvore de arquivos, incluindo
trabalho de outra sessão que ainda nem foi commitado; e código quebrado no
repositório quebra o comando `cc` de todos os agentes na hora, porque é
exatamente esse arquivo que eles chamam. A regra prática: rodar `npm test`
sempre antes de considerar uma sessão encerrada.

**11. O ponto de quebra de layout responsivo do painel usa `@container`,
não `@media`.** Com a coluna de notas aberta, a janela do navegador continua
larga mesmo com o painel principal encolhendo visualmente; uma consulta de
mídia tradicional nunca dispararia nesse caso, e a tabela quebraria o
layout em vez de se compactar. A área principal do painel declara um
contexto de contêiner próprio, e as regras de estilo olham para esse
contêiner, não para a largura da janela inteira.

**12. O índice de um to-do na lista não é a posição dele na tela.** Tarefas
concluídas ficam depois das abertas dentro de um elemento recolhível, então
"o último campo visível na página" pode ser uma tarefa que já existe há
tempo. Focar um campo novo assumindo que ele seria o último da lista fez a
digitação sobrescrever, e de fato apagar, uma tarefa real já concluída. A
correção: sempre buscar o campo certo pelo índice dele dentro do array de
dados, nunca pela posição visual.

**13. Durante a edição de um campo de texto, os dados na memória não podem
mudar por baixo do usuário.** O painel atualiza o snapshot de dados a cada
dois segundos; se o redesenho da tela for adiado por causa do foco num
campo, a tela mostra a lista antiga enquanto os índices reais já mudaram, e
a edição acaba indo parar em outra tarefa. A correção: o snapshot novo fica
retido em memória até o campo que está sendo editado perder o foco.

**14. A aba de tempo mede tempo ativo, não a janela corrida entre a
primeira e a última mensagem.** Num dos projetos, a janela do primeiro ao
último sinal dava 282 horas corridas, contra cerca de 90 horas de trabalho
real medido pela soma dos intervalos, descartando pausas maiores que um
corte configurável. O próprio corte muda o número final (77,7 horas com um
corte de 5 minutos, 91,5 horas com corte de 15 minutos, no mesmo projeto), e
por isso é escolha de quem está olhando, nunca uma constante fixa no
código.

**15. O custo em dólares mostrado no painel é referência, não fatura de
verdade.** Ele sai de uma tabela de preços de API pública; quem usa
assinatura mensal, como o Felipe, não pagou aquele valor específico. E o
volume de token engana por si só: a maior parte é releitura de cache, que
custa cerca de 10% do preço de entrada normal.

**16. A cópia de uma rotina dentro de um projeto vence a rotina global, e é
assim que uma regra boa fica desligada em silêncio.** Um comando de
terminal como `/start-session` corresponde a um arquivo, e ele pode existir
tanto na pasta global quanto dentro de um projeto específico; quando existe
nos dois lugares, o do projeto ganha. Medido no CC-42: 22 rotinas
desatualizadas em 5 projetos, com um caso extremo de 224 linhas contra 259
da versão global, e nenhuma das cinco cópias de `start-session.md`
mencionando o próprio Método Routia, presente seis vezes na versão global.
Comparar por data de modificação não funciona (copiar uma pasta inteira
renova a data sem mudar o conteúdo), e comparar o texto bruto também não
(os arquivos usam quebra de linha do Windows, o que por si só já contaria
como diferença em toda linha).

**17. A cotação do dólar é a única chamada de rede perigosa por engano do
painel inteiro, no sentido de poder corromper um número importante em
silêncio.** Ela é buscada numa API pública sem chave, cacheada por 12
horas, e se a rede falhar o painel devolve o último valor conhecido, com a
data visível na tela. Uma trava adicional: cotações fora de uma faixa de
plausibilidade (entre 0,5 e 100) são rejeitadas, porque se a API algum dia
inverter o par de moedas e mandar um valor invertido, um custo real de
dezenas de milhares de reais poderia virar um valor completamente errado
sem nenhum erro visível na tela.

**18. Um ponto final num padrão de busca de texto (regex) não casa com o
caractere de retorno de carro, e isso já zerou um leitor de arquivo
inteiro.** O leitor do `ROADMAP.md` devolvia zero resultados em metade dos
projetos porque os arquivos do Felipe usam quebra de linha do Windows
(CRLF), e o padrão de busca falhava exatamente no caractere que sobra no
fim de cada linha, sem erro nem aviso algum, só um mapa vazio na tela. A
correção obrigatória, registrada como regra para qualquer leitor de arquivo
novo: sempre dividir o texto usando uma expressão que aceita os dois
formatos de quebra de linha.

**19. O cartão do agente mostrava a folha sem mostrar a árvore.** Um
título de agente dizendo, por exemplo, apenas "travessia gamificada" não
dizia nada ao Felipe, mesmo sendo parte de uma seção real e nomeada do
roadmap daquele projeto. É por isso que o protocolo do `meta.json` tem o
campo `frente`: o vocabulário mostrado na tela passou a ser o vocabulário do
roadmap do Felipe, não um resumo qualquer inventado pelo agente.

**20. CPU e memória não precisam de consultas pesadas ao WMI do Windows; a
biblioteca padrão do Node já responde isso em milissegundos.** A primeira
versão desses módulos perguntava tudo via PowerShell e levava cerca de dez
segundos; usando as funções nativas do Node, a mesma resposta sai em cerca
de três milissegundos, e ainda funciona fora do Windows. Só a leitura de
GPU realmente precisa de um processo externo.

**21. Funções síncronas de leitura de processo travam o servidor
inteiro.** Uma leitura síncrona de cerca de um segundo congela o laço de
eventos do Node inteiro, e junto com ele trava a atualização em tempo real
que todos os agentes dependem para aparecer no painel. Qualquer coisa que
alimente a tela precisa passar por uma versão assíncrona da mesma leitura.

**22. Sensores de temperatura de CPU e memória simplesmente não existem no
Windows sem um programa externo instalado e aberto.** Medido diretamente
nesta máquina: as classes de sistema que deveriam expor essa informação
existem, mas devolvem zero instâncias. Quem publica esses valores é o
programa LibreHardwareMonitor, e só enquanto ele está aberto; a consulta a
ele é tentada só uma vez por processo, com atraso proposital, porque a
própria tentativa trava cerca de um segundo.

**23. O uso do plano do Claude Code vem da `statusLine`, nunca de uma
chamada de API.** O próprio Claude Code entrega os limites de uso no JSON
que manda para o comando configurado como barra de status, a cada resposta;
é o mesmo número oficial mostrado pelo comando `/usage`. Por isso o painel
nunca chama nenhuma API nem lê o arquivo de credenciais, mesmo sabendo que
o endpoint de API existe. A consequência prática: o valor só se atualiza
quando o Claude Code de fato responde algo; com o Claude Code parado, o
painel mostra a última leitura conhecida, com a idade dela.

**24. O estado interno do CLI marca um job como "concluído" ao final de
CADA turno de conversa, não só quando a sessão termina de verdade.** Isso já
enganou a tela duas vezes: colocaria um agente que está de fato trabalhando
na faixa visual de "pronto". O sinal correto para diferenciar os dois casos
é se o job continua atualizando seu carimbo de tempo: vivo com uma
ferramenta em execução está trabalhando de verdade; vivo sem nenhuma
ferramenta em execução acabou de responder e está esperando o próximo
comando do Felipe.

**25. Os agentes simplesmente não estavam marcando seus to-dos como
concluídos, e a causa não era falta de atenção, era o próprio texto do
protocolo.** Medido em 08/08: cinco agentes com o estado marcado como
concluído e zero de 34 tarefas marcadas como feitas. O passo de entrega do
protocolo pedia status, links e bloqueios, mas não pedia explicitamente a
lista de to-dos; quem seguia o texto à risca entregava com tudo em aberto.
Três correções, na ordem de importância que teve mais efeito: mudar o
próprio texto do protocolo (a causa raiz), criar um comando `cc done` que
fecha um to-do sem precisar reenviar a lista inteira (reduzindo o atrito que
fazia adiar), e um gatilho automático que avisa quando a entrega tem to-do
aberto (a consequência, não a causa).

**26. A VPS por SSH é a única chamada de rede genuinamente perigosa do
painel inteiro**, porque usa a chave privada do Felipe para entrar num
servidor de produção real. Por isso a atualização do retrato da VPS só
roda dentro de uma rota disparada por clique explícito do usuário, nunca
dentro de um temporizador automático. O documento é explícito: "achar isso
errado depois e só adicionar um timer quebraria a promessa central do
recurso."

**27. Ler a lista completa de processos do Windows é lento e imprevisível,
não constante.** Medido nesta máquina: a mesma chamada para listar cerca de
596 processos variou entre 19 e 29,3 segundos, sem padrão aparente entre
execuções. Um tempo limite de 30 segundos quase estourou numa execução real,
e foi corrigido para 45. A lição maior registrada: quando o tempo medido
fica perto do limite configurado, o limite está errado, não é "quase bom o
suficiente". Por essa razão, a leitura de processos nunca roda em
temporizador, só sob clique explícito, como a VPS.

**28. Um valor `null` intermitente parecia um bug de leitura de texto, mas
era um tempo limite estourando.** A primeira hipótese, mais óbvia, era que
a saída do PowerShell vinha suja de vez em quando. A causa real, mais
simples e mais chata de encontrar, era que a chamada estava estourando o
tempo limite ocasionalmente, e a função devolvia um resultado vazio em
silêncio nesse caso. Testar a hipótese errada primeiro não foi perda total
de tempo (a defesa contra saída suja continua válida), mas a correção
verdadeira só veio ao medir o tempo real da chamada isolada, não ao
adivinhar de onde vinha o problema.

---

## 9. Vocabulário e citações soltas

Frases e preferências do Felipe encontradas espalhadas pelos documentos do
projeto, reunidas aqui porque compõem o registro que ele pediu.

Sobre travessão, regra que vale em todo lugar, inclusive neste documento:
regra global dele, guardada fora deste repositório, diz que o travessão "é
a marca registrada de texto escrito por máquina, e o Felipe reconhece na
hora".

Sobre como prefere ser chamado e como prefere receber respostas: pede para
ser chamado de "camarada Felipe", respostas curtas e diretas, sem
preâmbulo, sem emoji a menos que ele peça.

Sobre por que fala curto de propósito, ditado numa das sessões analisadas
pelo ciclo:

> "eu sou analista de sistemas e sei tranquilamente configurar um server,
> mas eu sei também que às vezes se eu falar de um jeito rápido e curto
> você entende. eu comecei a entender as suas limitações e a entender que
> às vezes explicar demais é perda de tempo"

Sobre como especifica visualmente, por metáfora física em vez de parâmetro
técnico: "como um vídeo de oito bits contra um de doze bits", "gordo, quase
tátil", "um filtro no quadro, não um filtro na tela", "a foto não é o
limite do mundo", "a tinta se dilui na água".

O formato técnico que ele pediu literalmente, e que é o único aceito:

> "ao invés de falar 'border = 10' fale 'o valor numérico do parâmetro de
> borda está com o valor 10 (border = 10 de 0 a 100)'. vamos programar em
> agnostic"

Sobre reversibilidade antes de qualquer risco: "quero refazer o design do
site todo em uma nova branch pra gente não perder o atual", "vamos testar
isso primeiro em uma página backup", "podemos salvar esse como um marco",
"crie uma página teste".

Sobre o que ele nunca pergunta, e o que rejeita mesmo sendo tecnicamente
correto: "impossível eu fotografar 40-50 fotos de um cliente pra avaliar",
"colocar talco no rosto dos pacientes, nunca que isso seria viável". Ele
pergunta se o mundo permite, nunca como o código faz por dentro.

Sobre o reposicionamento do próprio produto Agent Cockpit, em 12/08:

> "os hooks não são o produto, o produto é o control center gerenciar isso
> tudo e se beneficiar dos hooks pra alimentar o cockpit dos nossos
> agentes. Eu me às vezes me pego gerenciando 4, 5 projetos como às vezes
> faço, sempre me perco [...] é mais fácil eu ter um lugar onde eu tenho
> acesso fácil a 'hooks' de contexto que me fazem voltar rapidamente no
> contexto que eu tava"

Sobre a visão do painel como dono das rotinas do Claude Code entre todos os
projetos:

> "quero criar um sistema que seja eficiente pra voce como ia se
> retroalimentar em todos os projetos e essa metodologia de registro total
> e retroalimentacao de rotinas vai alimentar o control center que vai
> traduzir tudo isso p mim de forma muito mais eficiente. Ele que vai ser o
> responsavel por criar no computador e gerenciar as rotinas que introduzem
> no claude o formato de framework controlado através de um cockpit e nao
> somente como linguagem natural avulsa"

Sobre esse mesmo framework não ser obrigatório:

> "o framework poderá ser ligado ou desligado, a idéia é ele ser uma
> ferramenta, não algo obrigatório"

Sobre avaliar se toda a estrutura de rotinas serve a ele ou à própria IA:

> "vamos tambem avaliar se a end-session, a start-session e toda a
> estrutura de scrum ta sendo util e o maximo otimizado pro seu uso. o
> ideal é ter apenas guias e documentos conceituais p mim, o resto todo é
> documentação pra voce, e a gente traduz isso no CC"

Sobre esvaziar o vault do Obsidian no mesmo dia em que percebeu que ele
tinha virado ruído:

> "pode deletar tudo que for ia, ta tudo repetido ou ultrapassado"

Sobre o rename do projeto:

> "o control center (que vamos chamar agora de agent cockpit ou AC)"

Sobre a visão de acesso remoto pela VPS:

> "quando a gente subir esse projeto na vps, e aí eu ter como controlar o
> claude, o estudo, tudo por um link meu no meu site carzo [...] igual a
> gente tem aqui só que no telefone na rua"

Sobre a instrução de anotar tudo que ele fala no meio de outra tarefa, sem
perder:

> "vai anotando como comentários meus pra gente ir colocando pro final da
> fila, e aí a gente pode criar um arquivinho pra ir anotando essas coisas
> pra não perder"

Sobre quando um assunto vira algo a proteger, não só a implementar:

> "a gente tem que criar um nome pra essa tecnologia porque eu acho que vai
> ser algo inventado nosso, e que aí eu vou ter que registrar isso tudo"

---

## 10. Próximos passos

A ordem que os próprios documentos do projeto recomendam, sem data e sem
compromisso de cronograma, é de dependência: uma coisa destrava a outra.

O `docs/PLANOS.md`, escrito em 13/08 justamente para as sessões de execução
não precisarem redescobrir onde mexer, já tinha o CC-23 (histórico rico)
como a primeira entrega, exatamente porque ele destrava CC-24, CC-33 e
CC-41. Essas quatro, junto com CC-34, CC-35, CC-06, CC-40, CC-36 e o CC-39
(consertar o template) já foram concluídas ou aplicadas no próprio dia
13/08, como descrito na seção 4 deste documento.

O que continua pendente de decisão do Felipe, não de trabalho técnico:
quais das seis memórias candidatas do CC-40 sobem para o `CLAUDE.md`
global; se a decisão D1 do CC-43 (o painel escrever `settings.json` do
Claude Code) vale a pena, dado que o CC-42 já resolveu parte da dor; o
destino das quatro rotinas `set-role` divergentes do CC-44; e o que fazer
com os 91 arquivos de aplicativo real dentro do template, achado pelo
CC-39.

O que continua pendente de trabalho técnico, na ordem de dependência
descrita no próprio `docs/produto/FRAMEWORK-ROTINAS.md`: primeiro, resolver
de verdade o bloqueio crítico de isolamento do opencode descrito na seção 5
deste documento, porque ele bloqueia qualquer uso confiável do CC-30 e
reforça o cuidado necessário antes de generalizar o CC-36. Depois, o CC-30
(fila de revisão do opencode) e o CC-31 (painel de metodologia), ambos
esperando decisão de conteúdo do Felipe. Depois, a frente de conteúdo
social (CC-21 a CC-26), que depende da reconciliação entre a decisão de
11/08 de reviver o vault do Obsidian como espelho de leitura e o
esvaziamento do mesmo vault em 13/08. E, por fim, a visão de acesso remoto
pela VPS descrita na seção 3, que segundo o próprio Felipe começa por
"botar o painel no ar" antes de qualquer coisa mais ambiciosa, com
autenticação de verdade como primeira peça técnica a decidir antes de expor
qualquer coisa para a internet.

O framework de rotinas (a peça 5 da visão descrita na seção 7) só começa
depois que o sistema de distribuição de comando (CC-42, já em produção)
provar que resolve a dor sozinho; o gatilho já está decidido, ele liga no
início de cada projeto novo, e quem desenha o framework é o próprio Felipe,
não o painel.

---

Fim do documento. Fontes lidas integralmente antes da escrita: `CLAUDE.md`,
`docs/ROADMAP.md`, `docs/produto/VISAO.md`, `docs/produto/MVP.md`,
`docs/produto/COCKPIT.md`, `docs/produto/CICLO.md`,
`docs/produto/FRAMEWORK-ROTINAS.md`, `docs/produto/ROTINAS-AVALIACAO.md`,
`docs/produto/ROTINAS-HOJE.md`, `docs/produto/INDICE-MEMORIAS.md`,
`docs/produto/FRAMEWORK-HOOKS.md`, `docs/PLANOS.md`, `docs/planos/CC-36.md`,
`docs/BACKLOG-CAPTURA.md`, `docs/diario/2026-08-13.md`, `README.md`,
`docs/README.md`, `AGENTS.md`, e o histórico de commits do repositório via
`git log`.
