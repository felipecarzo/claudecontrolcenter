# HANDOFF

**Sessão:** 2026-08-12 · agente Claude (Opus 5) · máquina ALIENWARE-LIPE ·
delegada por `/ceo`, depois ROADMAP em ordem crescente, depois pedido novo
(framework de hooks)
**Último commit:** ver `git log -1` — sequência do dia: cockpit, CC-20, CC-05,
CC-15 (docs), CC-17, CC-18, CC-19, CC-27 (framework de hooks, Épico 1)
**Branch:** `master`

O que aconteceu: [diario/2026-08-12.md](diario/2026-08-12.md).

## Próxima task

Sem task herdada de sessão anterior — o dia esgotou o ROADMAP de 12/08 e
entregou o Épico 1 do framework de hooks. Duas frentes abertas, nenhuma
óbvia sem o Felipe escolher:

1. **CC-21** — MCP do Google Calendar com escrita (frente conteúdo social).
2. **CC-28 a CC-31** — framework de hooks, épicos 2-4. Cada um tem decisão
   pendente documentada em `docs/produto/FRAMEWORK-HOOKS.md` (D1-D4) — não
   dá pra implementar sem o Felipe escolher o caminho primeiro. CC-29
   (disparo opencode) é o único sem trava de decisão, poderia andar sozinho.

## Arquivos a ler antes

- `docs/ROADMAP.md` — estado de tudo que está aberto
- `docs/produto/FRAMEWORK-HOOKS.md` — visão do framework de hooks e as 5
  decisões pendentes (D1-D4)
- `CLAUDE.md` — seção Armadilhas, as de hoje estão no topo
- `src/hooksCatalogo.mjs` / `src/hooksRegistro.mjs` / `config.mjs`
  (`hookEnabled`/`setHookEnabled`) — o alicerce que os épicos 2-4 usam

## Regras que não podem quebrar

Ver `CLAUDE.md`, seção "Regra de ouro" e "Armadilhas". Novidades de hoje:

- `calendarios[].url` (agenda) nunca volta pro navegador — mesma lógica da
  chave da VPS.
- Testar rota que ESCREVE config não pode restaurar arquivo inteiro de um
  backup — o daemon real pode ter escrito algo legítimo no meio do teste.
  Remover cirurgicamente só o que o teste gravou.
- **Toggle de hook (`hookEnabled`/`setHookEnabled`) nunca escreve no
  `settings.json` do Claude Code** — só em `control-center.json`. Escrever
  `settings.json` programaticamente é a decisão D1, ainda em aberto.
- `CONFIG_FILE` não é isolado por porta: instância de teste em `--port 8123`
  ainda escreve no `control-center.json` real. Testar rota de escrita exige
  cuidado (ver armadilha detalhada no `CLAUDE.md`).
