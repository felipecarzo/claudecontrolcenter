# HANDOFF

**Sessão:** 2026-08-12 · agente Claude (Opus 5) · máquina ALIENWARE-LIPE ·
delegada por `/ceo`, depois ROADMAP em ordem crescente, depois pedido novo
(framework de hooks)
**Último commit:** ver `git log -1` — sequência do dia: cockpit, CC-20, CC-05,
CC-15 (docs), CC-17, CC-18, CC-19, CC-27, CC-28, routia-resolver, CC-29
**Branch:** `master`

O que aconteceu: [diario/2026-08-12.md](diario/2026-08-12.md).

## Próxima task

Sem task herdada de sessão anterior — o dia esgotou o ROADMAP de 12/08,
depois os Épicos 1, 2 e 3A (CC-27, CC-28, CC-29) do framework de hooks.
Duas frentes abertas, nenhuma óbvia sem o Felipe escolher:

1. **CC-21** — MCP do Google Calendar com escrita (frente conteúdo social).
2. **CC-30 e CC-31** — framework de hooks, épicos 3B e 4. Cada um tem
   decisão pendente documentada em `docs/produto/FRAMEWORK-HOOKS.md`
   (D3, D4). CC-30 (fila de revisão do opencode) já tem a mecânica pronta
   (`src/opencode.mjs`, CC-29) — falta só decidir D3 (qual evento obriga a
   chamada) pra desbloquear.

Rollout do Método Routia pros outros ~14 projetos (incluindo cliente) é
manual, projeto a projeto, com `cc routia install [pasta]` — decisão do
Felipe de não fazer em lote.

## Arquivos a ler antes

- `docs/ROADMAP.md` — estado de tudo que está aberto
- `docs/produto/FRAMEWORK-HOOKS.md` — visão do framework de hooks e as
  decisões pendentes (D3, D4)
- `CLAUDE.md` — seção Armadilhas, as de hoje estão no topo — **duas novas
  sobre `spawn()` no Windows são essenciais antes de mexer em CC-30**
  (`detached` quebra captura de saída via `fd`; `shell:true` com args
  dinâmicos é injeção de comando)
- `src/opencode.mjs` — disparo/heurística/verificação pro CC-30 consumir
- `src/hooksCatalogo.mjs` / `src/hooksRegistro.mjs` / `config.mjs`
  (`hookEnabled`/`setHookEnabled`) / `src/routia.mjs` — o alicerce que os
  épicos usam

## Regras que não podem quebrar

Ver `CLAUDE.md`, seção "Regra de ouro" e "Armadilhas". Novidades de hoje:

- `calendarios[].url` (agenda) nunca volta pro navegador — mesma lógica da
  chave da VPS.
- Testar rota que ESCREVE config não pode restaurar arquivo inteiro de um
  backup — o daemon real pode ter escrito algo legítimo no meio do teste.
- **Toggle de hook (`hookEnabled`/`setHookEnabled`) nunca escreve no
  `settings.json` do Claude Code** — só em `control-center.json`. Registrar
  hook novo no `settings.json` é sempre manual, via skill `update-config`.
- `CONFIG_FILE` não é isolado por porta: instância de teste em `--port 8123`
  ainda escreve no `control-center.json` real.
- **Editar `~/.claude/hooks/*.mjs` é editar infraestrutura ativa agora
  mesmo**, pra toda sessão do Felipe em todo projeto. Testar com stdin
  sintético (PowerShell, não Git Bash) antes de considerar pronto.
- **`docs/ROTAS-ATIVAS.md` deste projeto está ativo.** `pastas-controladas:
  [src]`. Sessão que for mexer em `src/` precisa marcar a própria rota antes
  — ver o quadro (fica sempre livre entre sessões, por convenção desta).
- **`spawn(..., { detached: true })` no Windows nunca captura saída via `fd`
  bruto de forma confiável** — a causa é o processo Node sair antes do
  filho. Se o disparo é feito de dentro do painel (que não sai sozinho),
  não usar nem `detached` nem `unref`. Ver armadilha detalhada no
  `CLAUDE.md` antes de mexer em `src/opencode.mjs` ou em qualquer `spawn`
  novo no CC-30/31.
