---
tags: [produto, visao]
tipo: visao
atualizado: 2026-08-13
estado: parcial, épicos 3B e 4 congelados no GELO
resumo: O painel deixa de só ler o estado e passa a distribuir e controlar os hooks dos projetos. O princípio, medido em campo, é que instrução escrita é sugestão e hook é regra.
termos:
  hook: script chamado num evento do Claude Code, que pode BLOQUEAR a ação
  gate: hook que recusa com exit 2 e devolve o motivo pro modelo ler
  PreToolUse: o evento que roda antes da ferramenta, onde o bloqueio acontece
---

# Visão — Framework de hooks

Decidido com o Felipe em 12/08. O Control Center para de só ler o estado dos
agentes e passa a **controlar comportamento de verdade** do Claude Code:
hooks ligados/desligados pelo painel, o Método Routia automatizado em vez de
convenção em texto, tarefas de to-do/registro delegadas pro `opencode` em
background, e um painel de metodologia (ágil/UML/MER) que avisa sem travar.

Plano completo do backlog (épicos, histórias, decisões pendentes):
`~/.claude/plans/parsed-beaming-bird.md` — fora do repositório, é plano de
sessão do Claude Code, não documento versionado. Este arquivo é o espelho que
sobrevive: a visão e o que já foi decidido ficam aqui, a execução vira item
numerado no `ROADMAP.md`.

## O que a pesquisa mudou da ideia original

1. **O Método Routia já existe e já roda**, globalmente, fora deste
   repositório — não é para construir do zero, é para adaptar. Vive em
   `~/.claude/hooks/rota-guard.mjs` e `git-add-guard.mjs`, registrados no
   `settings.json` do Felipe, ativos em todos os projetos dele agora. Só não
   protege o Control Center porque o escopo de pastas está fixo em
   `apps/`/`tools/` (o layout do inovallbond, onde nasceu) — o Control Center
   é projeto de app único, código em `src/`.
2. **`cc check` (trava entrega com to-do aberto) já está ligado e ativo** —
   `~/.claude/hooks/todo-guard.mjs` chama `cc.mjs check` como subprocesso no
   evento `Stop`. Não faltava conectar; faltava um interruptor **próprio** no
   painel — antes só desligava junto com tudo, pelo `cc off` global.
3. **O `opencode` que decompõe/delega tarefas hoje é síncrono e cognitivo** —
   vive dentro do julgamento do Claude (skill `vibecoder-opencode`: decide
   viabilidade, dispara, espera, verifica). Virar hook em background "sem
   gastar Claude Code" exige reimplementar isso em código puro.

## Decisões já fechadas

- Hooks disparados pelo Control Center rodam em **background**
  (fire-and-forget) — nunca travam o Claude Code esperando.
- `opencode` roda **local** nesta máquina, nunca via SSH/VPS.
- O painel de metodologia é **checklist que alerta**, nunca bloqueia.
- Nenhuma história escreve arquivo de outro projeto ou do Claude Code sem
  revisão humana no meio — mesmo princípio do CC-18 (mapa vazio cria to-do em
  vez de escrever sozinho).
- Entregável é o backlog inteiro primeiro; execução vem sprint a sprint.

## Épicos

1. **Alicerce — hooks ligáveis pelo painel.** Feito em 12/08 (CC-27, ver diário).
2. **Método Routia adaptado ao Control Center.** Feito em 12/08 (CC-28, ver diário).
3A. **Delegação opencode — disparo + verificação.** Aberto — CC-29.
3B. **Fila de revisão + hook que obriga a chamada.** Aberto — CC-30, depende
    de 3A e da decisão D3.
4. **Painel de metodologia (ágil/UML/MER, alerta sem bloquear).** Aberto —
   CC-31.

## Decisões pendentes (o Felipe decide quando o sprint chegar)

- ~~**D1** — registrar hook novo no `settings.json`~~ — resolvida em 12/08:
  manual, via skill `update-config`, feito para os dois hooks do Épico 2
  (`routia-inicio.mjs`, `routia-fim.mjs`). Mesma escolha vale pros hooks
  futuros dos Épicos 3B e 4.
- ~~**D2** — Control Center ganha `docs/ROTAS-ATIVAS.md`?~~ — resolvida em
  12/08: sim, `pastas-controladas: [src]`. Rollout nos outros projetos do
  Felipe (incluindo cliente) é manual, projeto a projeto, com
  `cc routia install <pasta>` — não em lote.
- ~~**D2b** — liberar rota ao terminar~~ — resolvida em 12/08: lembrete de
  texto (`systemMessage`, não bloqueia), `routia-fim.mjs`. Nunca escrita
  automática.
- **D3** — qual evento e qual critério "obrigam" a chamada ao opencode.
- **D4** — conteúdo editorial do checklist de metodologia.

## Rollout do Método Routia pra outros projetos (12/08)

Decisão do Felipe: quer o Método Routia como infraestrutura fixa em **todos**
os projetos, incluindo cliente — mas o rollout é manual, projeto a projeto,
não em lote nesta sessão. Mecanismo pronto:

- `cc routia install [pasta]` (`src/routia.mjs` + `cc.mjs`): cria
  `docs/ROTAS-ATIVAS.md` com `pastas-controladas` chutado pela estrutura real
  (`apps`/`tools` se existirem, senão `src`, senão o hardcode antigo). Nunca
  sobrescreve um quadro que já existe.
- `~/.claude/hooks/rota-guard.mjs` foi generalizado pra ler
  `pastas-controladas` do front-matter do quadro, com fallback pro hardcode
  `apps`/`tools` quando o campo não existe — o quadro do inovallbond continua
  funcionando sem mudança nenhuma.
- `/novo-projeto` (comando global) já tinha um passo pro Método Routia
  (cópia manual do modelo); atualizado pra usar `cc routia install` em vez
  de copiar o template vazio na mão.
- Dois hooks novos, registrados no `settings.json` global via `update-config`:
  `routia-inicio.mjs` (`SessionStart`, injeta o resumo do quadro no início da
  sessão) e `routia-fim.mjs` (`Stop`, lembra sem bloquear se a rota da sessão
  continua marcada 🔴 ao terminar).

O Felipe aplica `cc routia install` em cada projeto quando quiser, vendo o
resultado antes de commitar — não é ação em lote deste agente.

## `routia-fim` fica quieto quando está sozinho de verdade (12/08, mesma sessão)

Achado ao vivo: o `pierre_web` (inovallbond) recebeu o aviso do `routia-fim`
repetido a cada `Stop`, mesmo sendo o único agente trabalhando ali — rota
presa de uma rodada anterior, sem conflito real. Duas peças, as duas
consultam o Control Center antes de agir, nenhuma escreve o quadro sozinha
sem confirmação:

- **`~/.claude/commands/routia-resolver.md`** (skill nova, global): sob
  pedido explícito, roda `cc json`, filtra jobs `working`/`waiting` na mesma
  pasta de projeto (excluindo a própria sessão) — se sobrar algum, não mexe
  em nada e explica quem está ativo; se ninguém sobrar, libera as rotas
  🔴 pra 🟢 com nota do que foi feito no lugar do "quem".
- **`~/.claude/hooks/routia-fim.mjs`** ficou mais esperto: antes de emitir o
  `systemMessage`, faz a mesma pergunta ao Control Center. Confirmado
  sozinho → fica mudo, sem aviso repetido. Qualquer sinal de outro agente
  ativo, ou o Control Center indisponível → continua avisando (falha pro
  lado de falar, nunca pro lado de esconder conflito real). Não escreve o
  quadro — só decide se vale interromper com o aviso.

Testado: lógica de decisão validada contra caso de conflito real e caso
sozinho (dado sintético), e contra o dado real do pierre_web/inovallbond —
`cc json` mostra só `8d8cd8e5` ativo em `inovallbond`, e o hook
correspondentemente fica mudo.
