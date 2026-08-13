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
telefone e ver/controlar os agentes rodando — o mesmo painel de hoje, só que
de fora de casa.

Não é task ainda. Quando virar: login/senha é autenticação de verdade (nunca
mock, regra do protótipo simular produção), e o painel hoje não tem nenhuma
camada de auth — é a primeira coisa a decidir antes de expor pela internet.

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

### CC-06 — Ideias sem dono

Duas feitas em 13/08, duas deliberadamente não: **agrupar por rota** — o
cartão do cockpit agrupa a lista de agentes frios por `route` quando passa de
4, e some com poucos (moldura sem ganho). **Ordenar por token** já existia
(`ORDENAR_POR` na aba agentes tinha `tokens` desde antes — nada a fazer).

**Não construído, de propósito:** avisar de agente sem sinal há N minutos. O
CC-04 continua aberto porque a nota `sem sinal há Xm` nunca foi vista com
agente travado de verdade — e o cockpit já dá peso 4 pra `stale`, que é o
sinal ativo possível sem inventar notificação nova antes do existente se
provar (precedente: CC-07, construído e nunca usado). E `sync` em massa nos
projetos com `CLAUDE.md`: o bloco global já cobre todos, repetir a instrução
em 14 arquivos contraria "um fato mora em um lugar só". A ferramenta
(`syncAll`) existe se o Felipe mudar de ideia.

**Achado no caminho, ainda sem dono:** `estadoDe()` (`roadmap.mjs`) casa por
regex solto no título, e isso deu falso positivo achado em 13/08 pelas
pastilhas do CC-34: "CC-23 — Histórico rico" virou "feito" porque o título
contém a palavra "Histórico", e "CC-04 — ...agente travado..." virou
"bloqueado" porque contém "travado". O regex deveria olhar só o marcador de
estado (emoji/palavra no INÍCIO do título), não a frase inteira.

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

### CC-23 — Histórico rico por projeto
`historico.mjs` tem 100 linhas hoje — cobre o que a aba de tempo precisa, não
cobre "o que esse projeto produziu que vale virar conteúdo". Precisa
estruturar por marco (commit relevante, tarefa fechada, evento), não só por
bloco de tempo. A aba de todos (`tarefas.mjs`) é a mais fraca do painel hoje
porque task fechada some — não vira registro, só desaparece da lista. Esse é
o gap que trava o digest do CC-24: sem arquivo do que foi feito, não tem o
que resumir.

### CC-24 — Digest semanal entre projetos
Ferramenta que cruza git log + `docs/diario` + `ROADMAP.md` de todos os
projetos com CLAUDE.md (mesma lista que o `sync` do CC-06 already varre) e
produz um resumo por projeto, candidato a virar post. Roda sob demanda
(botão/comando), não em timer — mesma lógica de "processos" e "VPS": caro
demais pra rodar sozinho a cada 2s.

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
documentada em produto/FRAMEWORK-HOOKS.md — nenhum decide sozinho qual
caminho tomar, o Felipe escolhe quando o sprint chegar.

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
contexto mais rápido?". CC-32 feito em 13/08; os demais em ordem.

### CC-33 — Marca de visita e o delta "desde que você saiu"
`control-center.json` ganha `visitas: {projeto: ms}`, carimbada por botão
explícito ("vi isso") — automático ao abrir a aba destruiria o sinal, já que
ele olha o painel o dia todo. O cartão do cockpit ganha "desde sua última
visita: 3 tarefas fechadas · 1 agente novo · roadmap editado", tudo de dado
que já existe (`feitoEm`, `createdAt`, `visto`, `mapa.atualizadoEm`).
Depende de duas linhas em `historico.mjs`: guardar `cwd` no `guardavel()` e
fazer merge (não sobrescrita) do `feitoEm` no `arquivar()` — hoje ele é
podado por `marcarConclusoes()` e a poda vaza pro histórico.

### CC-34 — Mapa visual: pastilhas de frente, todo projeto
Mini-mapa no cartão do cockpit: frentes do ROADMAP.md como pastilhas em
`display:grid` (sem biblioteca), cor pelo `estado` que `estadoDe()` já
classifica, fração feitos/itens, ponto quando tem agente na frente. E o mapa
completo passa a abrir de qualquer projeto, com ou sem agente vivo — hoje
exige `job.cwd`, que só existe em job vivo. `acharFrente()` (exportada, sem
consumidor nenhum hoje) vira a costura jobs × roadmap.

### CC-35 — `git log --since` na abertura do projeto
A resposta rica pra "o que mudou desde que saí", e a única fonte real de
"quais arquivos" — `sinais.arquivos` do `tempo.mjs` é contagem
(`edicoes.size`), não lista de caminhos. Sob clique, nunca em timer.

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

### CC-38 — O ciclo vira regra onde carrega: o CLAUDE.md global
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
