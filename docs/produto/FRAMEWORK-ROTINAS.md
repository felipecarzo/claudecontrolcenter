# O Control Center como dono das rotinas

Visão do Felipe em 2026-08-13, registrada com as palavras dele antes de
qualquer implementação (regra 4 do [[CICLO]]: visão longa se registra, não se
implementa).

> "quero criar um sistema que seja eficiente pra voce como ia se retroalimentar
> em todos os projetos e essa metodologia de registro total e retroalimentacao
> de rotinas vai alimentar o control center que vai traduzir tudo isso p mim de
> forma muito mais eficiente. Ele que vai ser o responsavel por criar no
> computador e gerenciar as rotinas que introduzem no claude o formato de
> framework controlado através de um cockpit e nao somente como linguagem
> natural avulsa"

Cinco peças distintas dentro da frase, e elas não têm o mesmo risco nem a mesma
maturidade:

1. **Retroalimentação entre projetos** — o que uma sessão aprende chega às
   outras
2. **Registro total** — tudo que acontece vira sinal gravado
3. **O painel traduz** — o registro vira leitura útil pra ele
4. **O painel cria e gerencia as rotinas na máquina** — hooks e comandos
   deixam de ser texto copiado à mão
5. **Framework controlado por cockpit**, no lugar de linguagem natural avulsa

---

## Decisões tomadas em 13/08

Fechadas na conversa, não são mais pergunta:

| # | Decisão | Consequência |
|---|---|---|
| D-A | **O framework é ferramenta com liga/desliga, não obrigação** | Modo curto é o framework desligado. Reusa `cc hooks on\|off` + `isEnabled()` + toggle por projeto do `config.mjs`, sem mecanismo novo |
| D-B | **Começar pelo nível baixo** (distribuir comando/skill), com a D1 **planejada mas não implementada** | Vira CC-42 (faz agora) e CC-43 (plano escrito, decisão do Felipe depois) |
| D-C | **O fluxo do framework vem depois do sistema de distribuição existir** | Sem sistema, "fluxo" seria desenho no vazio. Peça 5 não começa antes do CC-42 |
| D-D | **A peça "registro total" não entra como está** | Contra-exemplo do mesmo dia: o vault. Só entra o que a derivação não alcança (CC-22) |

| D-E | **A global vale para tudo; o projeto só acrescenta, nunca sobrescreve** | Proposta do Felipe em 13/08, confirmada por medição (abaixo). Vira convenção, não código: o Claude Code substitui por nome de arquivo e não faz merge |
| D-F | **O framework liga no início do projeto** | Resposta à pergunta que travava a peça 5. O Felipe vai desenhar o framework; o painel entra depois, como quem liga e distribui |

### A medição que confirma a D-E

A dúvida era se as cópias tinham conteúdo genuinamente do projeto ou só versão
velha. Medido linha a linha nas 22 divergentes, o "conteúdo próprio" é de três
tipos, e nenhum justifica a cópia:

1. **A mesma coisa dita de um jeito mais velho.** O `proj_carzo/start-session.md`
   gasta cinco linhas em *"Registre mentalmente: Branch atual, Hash do último
   commit, Arquivos modificados"*; a global diz o mesmo em uma. Fora o nome do
   projeto, não há nada ali que seja do Carzo.
2. **Erro ativo.** O `app_maurice/end-session.md` abre com *"Você é o Scrum
   Master do projeto Juju"* e manda ler
   `~/.claude/projects/D--…-app-juju/memory/MEMORY.md` — a memória de **outro
   projeto**. Isso não é customização, é bug rodando há meses.
3. **O pouco que é mesmo específico** (o passo dos `docs/guias/` do fluxo
   multi-agente, no maurice) não precisa de arquivo homônimo: cabe num comando
   de nome próprio, ou num arquivo de dados que a rotina global leia.

### Como a D-E funciona na prática

Não dá para o painel "mesclar" global com projeto: quem resolve a precedência é
o Claude Code, e ele **substitui por nome de arquivo**. Então a regra é de
convenção, e tem duas formas de acrescentar sem sobrescrever:

- **Nome próprio.** Precisa de algo só do projeto? Vira `/rotina-do-projeto`,
  não uma segunda versão de `/end-session`. Comandos de nomes diferentes
  convivem sem conflito — é o que já acontece hoje com `authorize`, `tickets`,
  `routia` e `end-session-quick`, que não têm homônimo global e por isso nunca
  deram problema.
- **A global lê o projeto.** A rotina global vira o esqueleto e manda "se
  existir `docs/rotina-extra.md` neste projeto, siga também". Aí o projeto
  contribui **dado**, não instrução duplicada — que é o "um fato mora em um
  lugar só" aplicado a rotina.

O papel do painel nisso é o CC-42, que já está no ar: mostrar onde a convenção
foi quebrada e desfazer sob clique.

### Aplicado em 13/08

**21 cópias apagadas** (16 desatualizadas + 5 byte a byte idênticas à global),
com tudo versionado antes — recuperável por `git checkout` em cada projeto. As
rotinas apagadas existem todas na global, conferido nome a nome: nenhum comando
ficou órfão.

Sobrou o que a convenção permite: **12 rotinas de nome próprio** (`authorize`,
`tickets`, `routia`, `end-session-quick`), que nunca deram problema justamente
por não terem homônimo global.

Ao medir para apagar, apareceu um agravante que a contagem de linhas escondia:
**os caminhos absolutos dentro das cópias estavam quebrados ou errados.** A
`Clinica Bela Vida` tinha `D:documentos\tiprojetos…` (as barras invertidas
viradas tab pela substituição de placeholder), o `app_maurice` apontava para
`app_juju` em quatro rotinas, e um passo do `end-session` mandava ler
`D:\secondbrain\vault\kanban\Kanban — Projetos.md`, arquivo apagado na limpeza
do vault no mesmo dia. Não havia o que preservar ali.

### Duas decisões que sobraram para o Felipe

1. **`set-role` foi preservado nos 4 projetos, e continua divergente de
   propósito.** É o único caso de customização real: cada projeto define papéis
   próprios, e o do `proj_ghoscode` tem 38 linhas que não existem em lugar
   nenhum (`tech-writer`, `LIVE_STATUS.md`, divisão de terminais). Pela D-E
   deveria virar nome próprio (`/set-role-ghoscode`) — mas isso muda como ele
   invoca o comando, então é escolha dele, não deleção.
2. **Um passo genuinamente útil morreu junto**, e vale decidir se sobe para a
   global: o **PASSO 6 de verificação dos docs de coordenação**
   (`claudio-implementations.md`, `antigravity-implementations.md`,
   `multi-integration.md`), presente em três projetos e ausente da global.

---

## O que a evidência do próprio repositório já diz

### As peças 3 e 4 atacam buracos medidos

`produto/ROTINAS-HOJE.md` listou cinco buracos do estado atual. A visão acerta
três deles em cheio:

| Buraco medido | Peça da visão que resolve |
|---|---|
| "Quase tudo é pedido, não regra" — 9 passos do encerramento que o agente pode pular sem consequência | 4 e 5 |
| "Nada é medido" — as rotinas produzem texto pra humano ler, sem número nem carimbo | 2 e 3 |
| "Duplicação" — rotina global e rotina copiada dentro do projeto, sem nada garantindo que estejam iguais | 4 |

### A duplicação, medida em 13/08

Comparação do `start-session.md` global com as cinco cópias espalhadas pela
máquina:

| Onde | Linhas | Menciona Routia | Diz que o projeto é |
|---|---|---|---|
| Global (`~/.claude/commands/`) | 96 | 6 vezes | genérica, sem nome |
| `app_questguide` | 67 | **0** | QuestGuide |
| `proj_carzo` | 67 | **0** | Carzo |
| `app_maurice` | 67 | **0** | **"Juju"** |
| `Clinica Bela Vida` | 67 | **0** | "Cl" |
| `- projeto_template` | 67 | **0** | (vazio) |

Três defeitos numa medição só:

1. **As cinco cópias são idênticas entre si e velhas.** A global evoluiu 29
   linhas; elas ficaram congeladas. O Passo 1.5 inteiro (Método Routia) não
   existe em nenhuma. Abrir sessão pelo comando do projeto **não roda o
   Routia**, embora o projeto tenha `docs/ROTAS-ATIVAS.md`.
2. **O `app_maurice` se apresenta como "projeto Juju".** Pasta copiada, texto
   veio junto, placeholder nunca trocado.
3. **A `Clinica Bela Vida` virou "no projeto Cl"** — o acento cortou a
   substituição no meio.

Não é descuido pontual: é o custo de a mesma rotina existir em seis lugares
editáveis à mão. Reforça o CC-39, que já tinha achado o template nascendo
violando o global.

### A peça 2 tem um contra-exemplo do mesmo dia

**O vault esvaziado em 13/08 era registro total.** 518 arquivos gerados por
rotina em cinco meses, e o veredito dele olhando o resultado foi *"pode deletar
tudo que for ia, ta tudo repetido ou ultrapassado"*. 340 arquivos apagados,
18.905 linhas.

Não foi indisciplina: o `/end-session` escrevia em quatro lugares dentro do
vault a cada sessão, exatamente como mandado. O registro total funcionou como
especificado, e o produto foi lixo.

Conclusão que a evidência sustenta: **registro total sem critério de descarte e
sem hierarquia produz volume que ninguém lê.** Segundo dado na mesma direção: o
CC-40 mediu ~30 memórias comportamentais em 15 projetos, sem índice, com o
perfil cognitivo completo morando em projeto que ele não abre pra trabalhar.

### A peça 5 é ferramenta, não obrigação (decisão D-A)

Havia uma tensão aparente: o [[CICLO]] mediu distribuição bimodal, **17% das
mensagens dele têm até 25 caracteres** (*"sobe dev server"*, *"commit"*), e a
fala dele é *"às vezes se eu falar de um jeito rápido e curto você entende,
explicar demais é perda de tempo"*. Framework que exige preencher campo
cobraria pedágio no modo que ele mais usa.

Ele resolveu em 13/08: *"o framework poderá ser ligado ou desligado, a idéia é
ele ser uma ferramenta, não algo obrigatório"*.

Modo curto é o framework desligado; ligar é ato deliberado. O padrão já existe
e não precisa ser inventado: `cc hooks on|off <id>` grava em
`control-center.json` e cada hook consulta `isEnabled()` antes de agir.

**O risco muda de lugar, não desaparece.** Ferramenta opcional que ninguém liga
vira código morto, e há precedente: o CC-07 (faixa de atividade) foi construído
e nunca usado, saiu da tela em 06/08.

---

## A inversão que a evidência sugere

A visão está escrita na direção "registrar mais → depois traduzir". O
repositório já provou o contrário funcionando: **o painel lê o que já existe e
deriva o resto.**

Hoje, sem nenhuma rotina escrevendo nada de novo, o painel já lê: transcript de
cada sessão, `git log`, `docs/ROADMAP.md`, `docs/diario/`, `meta.json` dos
agentes, `rate_limits` do statusLine.

Já abertos e que são exatamente "derivar em vez de escrever": **CC-23**
(histórico rico), **CC-24** (digest semanal), **CC-33** (delta desde a visita),
**CC-35** (`git log --since`). O **CC-22** já reconheceu o único caso legítimo
de escrita nova: evento que não deixa rastro em código.

---

## CC-42 — Distribuição de rotina (nível baixo, fazer agora)

### O que é uma rotina, em concreto

Um arquivo `.md`. `/start-session` é o `start-session.md`, e o que está escrito
dentro é o que o agente faz. Moram em dois lugares, e **o do projeto vence o
global**:

- `~/.claude/commands/` e `~/.claude/skills/` — vale em todo projeto
- `{projeto}/.claude/commands/` — vale só ali, e sobrepõe

É essa precedência que torna o achado grave: a cópia velha do projeto **desliga**
a global boa, em silêncio.

### O que reusar (não escrever de novo)

`src/install.mjs` já resolveu o problema irmão (escrever bloco no `CLAUDE.md` de
todo projeto) e entrega pronto:

- `findProjects(base)` — acha projeto em `base/<projeto>` e `base/<GRUPO>/<projeto>`,
  pulando `.`/`_`/`-`, `archived` e `node_modules` (é o `SKIP`)
- `projectsBase()` — variável de ambiente → config → detecção pelos `cwd` dos jobs
- o padrão de escrita idempotente e o formato de retorno `{project, dir, action}`
- `syncAll({dryRun})` — varrer e reportar **sem escrever**

Caminho do home: `os.homedir()`, como em `jobs.mjs`, `config.mjs` e `notes.mjs`
(`path.join(os.homedir(), '.claude', ...)`). Não inventar constante nova.

### O que falta construir (`src/rotinas.mjs`)

Só a parte que o `install.mjs` não cobre:

1. **Ler as rotinas globais** de `~/.claude/commands/*.md` (e `skills/`)
2. **Para cada projeto**, olhar `{projeto}/.claude/commands/` e classificar cada
   arquivo: `igual`, `divergente`, `só no projeto`, `só na global`
3. **Ações sob clique**, nunca em timer: *sincronizar* (global sobrescreve a
   cópia) ou *remover a cópia* (deixa a global valer)
4. **Aba/seção no painel** mostrando o estado, no vocabulário dele: qual projeto
   está com rotina velha, e há quanto tempo

### Travas de projeto (herdadas, não negociáveis)

- **Nunca escreve dentro de `~/.claude/jobs/`** — só `meta.json`, contrato
  exclusivo. Rotina não tem nada a ver com job.
- **Nunca em timer.** Varrer disco de 22 projetos é caro, igual a processos e
  VPS: só sob clique.
- **Comparar por conteúdo, não por data.** `mtime` muda com cópia de pasta e
  mentiria.
- **Ler linha a linha com `split(/\r?\n/)`.** Os arquivos são CRLF e `.` no
  regex não casa `\r` — já zerou um parser inteiro aqui (o do roadmap).
- **Ação destrutiva mostra o que vai fazer antes**, como o encerrar servidor:
  remover cópia de projeto apaga arquivo em repositório alheio.

### Por que este nível é seguro

Se a distribuição sair errada, o comando faz besteira **quando o Felipe o
chama** — ele vê na hora, e apagar o arquivo desfaz. Nada roda sozinho.

---

## CC-43 — A decisão D1: o painel escrever `settings.json` (planejar, não fazer)

### O que muda do nível baixo para o alto

Hook é o que roda **sem ninguém chamar**, disparado por evento. Para existir,
precisa estar registrado no `settings.json` do Claude Code. Dois riscos que o
nível baixo não tem:

- **JSON malformado desliga TODAS as configurações daquele arquivo, em
  silêncio.** Sem erro na tela. Os quatro hooks que hoje obrigam de verdade
  (`rota-guard`, `git-add-guard`, `cc check`, `routia`) parariam de valer sem
  aviso nenhum.
- **Hook errado roda a cada evento, em todo projeto**, sem ele pedir.

O limite aceito hoje (CC-27) diz que o toggle **nunca** escreve no
`settings.json`: `cc hooks on|off <id>` só grava em `control-center.json`, e cada
hook checa `isEnabled()` sozinho. Por isso a aba "hooks" tem um badge
"registrado"/"não registrado" **separado** do liga/desliga — ligar aqui um hook
não registrado não faz nada, e o badge existe pra isso não ser silencioso.

### O plano, se a D1 for aprovada

Ordem pensada para que nenhum passo possa deixar a máquina pior que antes:

1. **Backup com data antes de qualquer escrita.** Mesmo padrão de `writeNotes`
   (`.bak` na gravação, cópia datada no apagamento total). O `settings.json` é
   configuração digitada à mão: não tem outra fonte.
2. **Validar depois de escrever, e reverter sozinho se quebrou.** Reler o
   arquivo, `JSON.parse`, conferir que os hooks que existiam antes continuam
   lá. Falhou, restaura o `.bak` na hora e reporta.
3. **Escrita cirúrgica, nunca reescrita do arquivo inteiro.** Mexer só na chave
   do hook em questão, preservando tudo o mais byte a byte. Vale a armadilha já
   registrada do `CONFIG_FILE`: restaurar arquivo inteiro de backup perde o que
   outro processo escreveu no meio-tempo.
4. **Registrar um hook só, o menos perigoso, e viver com ele uma semana** antes
   de abrir para os outros.
5. **Botão de pânico**: "devolver o `settings.json` ao estado anterior", visível
   na mesma aba.

### O que decide entre fazer e não fazer

A pergunta não é técnica, é de valor: **o que um hook registrado pelo painel faz
que um comando distribuído não faz?** A resposta honesta é uma só: obrigar em
vez de pedir. Se, com o CC-42 no ar, os comandos distribuídos já resolverem a
dor, a D1 perde o motivo e fica como está — o que também é uma decisão, e
melhor que construir por completude.

---

## Ordem que a evidência sugere

Sem data, sem compromisso — dependência, não cronograma.

1. **CC-42, distribuição de comando/skill.** Resolve a duplicação medida, não
   depende de decisão nenhuma em aberto, e é pré-requisito de qualquer coisa que
   queira mudar rotina em massa. Casa com o CC-39.
2. **O painel derivar** (peça 3): CC-23 → CC-24. É onde está o valor que ele
   pediu ("traduzir tudo isso pra mim"), e não escreve nada novo.
3. **Registro só do que a derivação não alcança** (peça 2, podada): CC-22.
4. **CC-43, decidir a D1.**
5. **O fluxo do framework** (peça 5), só depois do CC-42 existir (decisão D-C).
   Nasce com toggle desde o primeiro dia, reusando `isEnabled()`. O gatilho já
   tem nome (D-F): **liga no início do projeto**, que é quando decisão de
   estrutura ainda é barata e o custo de errar é maior. **O desenho do
   framework é do Felipe** — o painel entra como quem liga, distribui e mostra,
   não como quem inventa o método.

A peça 1 (retroalimentação entre projetos) não está na lista porque é
consequência, não etapa: quando 1 e 2 existirem, o que uma sessão aprende chega
às outras pelo mesmo canal que distribui rotina.

---

## O critério de corte, herdado

O mesmo do [[COCKPIT]], porque continua valendo: **isso me faz voltar ao
contexto mais rápido, ou economiza uma volta do ciclo?**

Aplicado aqui, ele mata a versão ingênua da peça 2 na hora: registro que ninguém
lê não faz voltar ao contexto mais rápido. Faz mais devagar, porque agora tem
mais coisa pra procurar dentro.
