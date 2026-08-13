# Índice das memórias comportamentais (CC-40)

Levantamento de 13/08: **81 memórias `type: feedback`** (comportamento do
Felipe, não fato de projeto), em **22 diretórios de projeto** —
`~/.claude/projects/*/memory/*.md`. O roadmap estimava "~30 em 15 projetos";
a contagem real é maior e mais concentrada: 25 só no `inovallbond`, 10 no
`market-tracker`.

Este documento responde uma pergunta em menos de dez segundos por linha:
**esta regra vale em todo projeto, ou só naquele?** Não copia o texto da
memória original — um fato mora em um lugar só, o link aponta pro arquivo.

---

## Já está no global — achado, não precisa subir de novo

Sete memórias reinventam regra que **já existe** no `CLAUDE.md` global
(algumas de antes do CC-38, outras coincidem por acaso). Ficaram presas no
projeto porque ninguém checou o global antes de escrever:

| Memória | Projeto | Duplica |
|---|---|---|
| `feedback_nunca_usar_travessao` | inovallbond | regra absoluta de travessão |
| `commit_sem_co_authored` | renanMarchon | regra absoluta de Co-Authored-By |
| `feedback-mostrar-imagem-antes-de-reportar` | inovallbond | ciclo regra 1 (prova visual) |
| `feedback-backlog-de-tudo` | inovallbond | ciclo regra 4 (visão se registra) |
| `feedback-felipe-fala-curto-de-proposito` | inovallbond | ciclo regra 5 (ordem curta) |
| `medir-antes-de-agir-na-hipotese` | renanMarchon | ciclo regra 7 (medir antes de agir), praticamente palavra por palavra |
| `feedback_explain_before_action` | market-tracker | OBRIGATÓRIO de explicar comando antes do tool call |

Não é erro apagar — é sinal de que a regra é forte o bastante pra ter sido
descoberta duas vezes, em projetos diferentes, sem combinar. Deixar como
estão (viram ruído se apagadas, e apagar memória não é ação deste índice).

---

## Candidatas a subir pro global — proposta, não execução

Seis memórias são universais, de alto retorno, e **não** estão no global
hoje. Proposta pro Felipe decidir, no formato do CC-38:

### 1. Nunca mascarar o exit code de comando crítico
> "Nunca rodar comando crítico (install, build, download) com `| tail`/`|
> grep` — mascara o exit code real"
— `inovallbond/feedback-pipe-mascara-exit-code`. Engenharia pura, vale em
qualquer terminal, qualquer projeto.

### 2. Servidor de teste em background pode não ter subido de verdade
> "Servidor de teste subido em background pode nem ter subido — outra sessão
> ocupa a porta e atende seus curls com código velho"
— `inovallbond/servidor-teste-porta-compartilhada`. **Confirmado no mesmo
dia**: foi exatamente essa armadilha que custou cinco rodadas testando
`rotinas.mjs` contra binário velho no CC-42 deste projeto (`pkill -f` não
mata Node no Git Bash, porta continua servida pelo processo antigo). Duas
descobertas independentes do mesmo problema — candidata forte.

### 3. Nunca criar túnel sem pedir
> "Nunca subir túnel Cloudflare por conta própria — entregar endereço
> localhost; túnel só quando o Felipe pedir explicitamente"
— `inovallbond/feedback-nao-criar-tunel-sem-pedir`. Caso específico do
princípio maior "ações que afetam sistema compartilhado pedem confirmação",
que já é regra do sistema — mas como regra explícita de projeto, vale ter no
global pra não reaparecer.

### 4. QA lê o artefato final salvo, nunca staging/cache
> "Aprovação de QA deve sempre ler o artefato de saída final salvo, nunca um
> script/sheet de staging intermediário que pode estar lendo cache velho"
— `inovallbond/feedback-verificar-saida-final-nao-cache`. Generaliza bem
além do inovallbond.

### 5. Simplicidade vence complexidade
> "Feedback crítico — nunca mais construir sistemas complexos sem validar que
> o simples não funciona primeiro"
— `market-tracker/Simplicidade vence complexidade`. Já é o espírito do modo
"ponytail" ativo nesta sessão; como preferência **explícita** dele (não só
convenção do harness), vale registrar separado.

### 6. Nunca mandar comando sem dizer onde rodar
> "Nunca mandar comando de terminal sem dizer onde rodar — Felipe não tem
> como adivinhar se é na pasta do projeto ou global"
— `secondbrain-vault/feedback_command_context`. Vizinho do OBRIGATÓRIO de
explicar comando, mas cobre um ângulo que a regra atual não escreve
explicitamente: o **onde**, não só o quê/porquê.

**Não incluída de propósito**: `Não chutar menus/UI` (vault) — é caso
específico de "medir antes de agir na hipótese" (ciclo regra 7), que já
cobre o princípio geral. Duplicaria a regra 7 com exemplo mais estreito.

---

## Mortas — achado pela limpeza do vault de hoje

Duas memórias descrevem uma estrutura que **não existe mais**:

- `feedback_kanban_philosophy` e `feedback_kanban_structure`
  (`secondbrain-vault`) descrevem múltiplos boards (`Kanban — Tarefas`,
  `Dashboard — Projetos`, etc). A limpeza de 13/08 apagou 340 arquivos do
  vault, e hoje só sobra `Kanban — Dependências.md` (o que o CC-45 mantém
  vivo). As duas memórias falam de um vault que não existe mais.

Não apaguei — apagar memória é decisão do Felipe, e "morta" aqui significa
"o arquivo que ela descreve sumiu", verificável, não julgamento de conteúdo.

---

## O resto: 68 memórias, corretamente presas ao projeto

A maioria (84%) é de fato local — config de stack (`knex-type-gotchas`,
`beam_size=1` do STT, `uvicorn --reload`), bug de framework específico
(Turbopack engolindo espaço em JSX, `backdrop-blur` travando), ou estilo de
delegação por projeto (Eddie Morra mode no market-tracker, autonomia total no
QuestGuide, governança por frente no ghoscode). Não precisam de índice além
deste: ficam onde estão.

**As 25 do inovallbond são o maior bloco**, e cobrem terreno genuinamente
variado — direito (documento jurídico é modelo genérico, orientação da Carol
é literal), produção de jogo (curadoria de sprite em folha de contato, prédio
isométrico via IA não funciona), coordenação multi-agente (rotas+tickets,
design system antes de paralelizar), e infra (worktree fresh checkout,
falas.json sobrepõe bundle). Zero redundância entre elas — o volume é real,
não repetição.

---

## O que fazer com isto

1. **Felipe decide** quais das 6 candidatas sobem pro global, no formato do
   CC-38 (aplicado direto no `CLAUDE.md`, com o "por quê").
2. As 2 mortas ficam como estão — próxima sessão no vault que topar com elas
   decide se apaga, com o vault na tela pra confirmar.
3. Este índice **não se atualiza sozinho**. Se `type: feedback` crescer muito
   mais, vale revisitar — não há automação aqui de propósito, é leitura
   humana decidindo o que é universal.
