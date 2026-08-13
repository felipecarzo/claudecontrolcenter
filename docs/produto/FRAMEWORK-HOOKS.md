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

1. **Alicerce — hooks ligáveis pelo painel.** Feito em 12/08 (ver diário).
2. **Método Routia adaptado ao Control Center.** Aberto — CC-28.
3A. **Delegação opencode — disparo + verificação.** Aberto — CC-29.
3B. **Fila de revisão + hook que obriga a chamada.** Aberto — CC-30, depende
    de 3A e da decisão D3.
4. **Painel de metodologia (ágil/UML/MER, alerta sem bloquear).** Aberto —
   CC-31.

## Decisões pendentes (o Felipe decide quando o sprint chegar)

- **D1** — registrar hook novo no `settings.json`: escrita programática pelo
  Control Center (primeira vez que tocaria arquivo do Claude Code além de
  `meta.json`) vs. passo manual assistido pela skill `update-config`.
- **D2** — Control Center ganha `docs/ROTAS-ATIVAS.md`? Com qual
  `pastas-controladas`?
- **D2b** — liberar rota ao terminar: lembrete de texto (recomendado) vs.
  escrita automática.
- **D3** — qual evento e qual critério "obrigam" a chamada ao opencode.
- **D4** — conteúdo editorial do checklist de metodologia.
