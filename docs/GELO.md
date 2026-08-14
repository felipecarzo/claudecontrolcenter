---
tags: [processo]
tipo: arquivo
atualizado: 2026-08-14
estado: reversível, nada aqui foi apagado
resumo: Onde as frentes congeladas e as descartadas ficam depois da poda de 14/08. Existe para o backlog caber numa tela sem jogar fora o que já foi pensado.
termos:
  congelado: depende de decisão que nunca veio ou de bloqueio aberto. Volta quando destravar
  morto: confirmado como não vale mais, mas fica aqui inteiro mesmo assim
---

# Gelo

Frentes e itens tirados do [[ROADMAP]] para ele voltar a caber numa tela.
**Nada aqui foi apagado**: é tudo recuperável, basta mover de volta.

Critério de 14/08, decidido com o Felipe: sai do ROADMAP o que depende de uma
decisão dele que nunca veio, o que está travado por bloqueio não resolvido, e o
que ele confirmou que não vale mais.

> Ele disse na hora da poda, e é o motivo de este arquivo existir em vez de uma
> lista de exclusão: *"o meu cérebro de humano já não lembra de nenhuma dessas
> tarefas que a gente fez a 2 dias atrás pq eu não consigo armazenar tudo que nem
> você"*. Backlog que ele não consegue carregar na cabeça não é mapa, é peso.

---

## Congelado: volta quando a decisão vier

Depende de decisão dele, de OAuth nunca feito, ou de bloqueio técnico aberto.

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


---

## Morto: confirmado por ele em 14/08

Ele aprovou o descarte destes quatro, com a ressalva honesta de que não lembrava
dos detalhes. Ficam aqui inteiros exatamente por isso.

### CC-14 — O tray do Claude Code mostra porcentagem errada
Botão direito no ícone do Claude Code na bandeja → "Plano Max uso" mostra um
percentual que **não bate** com o real. Não é bug deste projeto. Agora dá para
conferir: o painel mostra o número oficial no topo, vindo do `rate_limits` do
statusLine — se o tray discordar dele, o errado é o tray.

### CC-04 — Verificar o aviso de silêncio com agente travado de verdade
A faixa de atividade saiu da tela em 06/08 (era o CC-07: construída e nunca
usada). O que sobrou do silêncio é a nota `sem sinal há Xm` na linha do agente,
que também nunca apareceu numa captura — não houve agente travado enquanto o
design era feito. Conferir na primeira vez que acontecer.

### CC-22 — Arquivo de marco manual
Evento que não deixa rastro em código (reunião, fala em evento presencial,
nota de prova) precisa de um sinal manual mínimo — uma linha por marco, não
formulário longo. Formato ainda em aberto: provavelmente mais uma entrada em
`docs/diario/{data}.md` de cada projeto, lida pelo digest do CC-24, em vez de
arquivo novo — evita duplicar onde mora a verdade.

### CC-37 — Enriquecimento automático (stretch, provavelmente não fazer)
Disparar a cada to-do novo é sedutor por custar R$ 0, mas toda escrita em
`meta.json` vira evento no stream e dispara `arquivar()` — com 5 projetos é
rajada, e modelo grátis fora do ar vira lixo silencioso. Só depois do CC-36
provar qualidade.
