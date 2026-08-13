# HANDOFF

**Sessão:** 2026-08-12 · agente Claude (Opus 5) · máquina ALIENWARE-LIPE ·
delegada por `/ceo`, depois ROADMAP em ordem crescente, depois pedido novo
(framework de hooks)
**Último commit:** ver `git log -1` — sequência do dia: cockpit, CC-20, CC-05,
CC-15 (docs), CC-17, CC-18, CC-19, CC-27, CC-28 (framework de hooks)
**Branch:** `master`

O que aconteceu: [diario/2026-08-12.md](diario/2026-08-12.md).

## Próxima task

Sem task herdada de sessão anterior — o dia esgotou o ROADMAP de 12/08,
depois o Épico 1 (CC-27) e o Épico 2 (CC-28, Método Routia) do framework de
hooks. Duas frentes abertas, nenhuma óbvia sem o Felipe escolher:

1. **CC-21** — MCP do Google Calendar com escrita (frente conteúdo social).
2. **CC-29 a CC-31** — framework de hooks, épicos 3A/3B/4. Cada um tem
   decisão pendente documentada em `docs/produto/FRAMEWORK-HOOKS.md`
   (D3, D4 — D1 e D2 já resolvidas). **CC-29** (disparo opencode) é o único
   sem trava, poderia andar sozinho.

Rollout do Método Routia pros outros ~14 projetos (incluindo cliente) é
manual, projeto a projeto, com `cc routia install [pasta]` — decisão do
Felipe de não fazer em lote. Fica pro Felipe rodar quando quiser, vendo o
resultado antes de commitar em cada repositório.

## Arquivos a ler antes

- `docs/ROADMAP.md` — estado de tudo que está aberto
- `docs/produto/FRAMEWORK-HOOKS.md` — visão do framework de hooks e as
  decisões pendentes (D3, D4)
- `CLAUDE.md` — seção Armadilhas, as de hoje estão no topo
- `src/hooksCatalogo.mjs` / `src/hooksRegistro.mjs` / `config.mjs`
  (`hookEnabled`/`setHookEnabled`) / `src/routia.mjs` — o alicerce que os
  épicos seguintes usam
- `~/.claude/hooks/rota-guard.mjs`, `routia-inicio.mjs`, `routia-fim.mjs` —
  fora do repositório, infraestrutura pessoal do Felipe, ativa globalmente

## Regras que não podem quebrar

Ver `CLAUDE.md`, seção "Regra de ouro" e "Armadilhas". Novidades de hoje:

- `calendarios[].url` (agenda) nunca volta pro navegador — mesma lógica da
  chave da VPS.
- Testar rota que ESCREVE config não pode restaurar arquivo inteiro de um
  backup — o daemon real pode ter escrito algo legítimo no meio do teste.
  Remover cirurgicamente só o que o teste gravou.
- **Toggle de hook (`hookEnabled`/`setHookEnabled`) nunca escreve no
  `settings.json` do Claude Code** — só em `control-center.json`. Registrar
  hook novo no `settings.json` é sempre manual, via skill `update-config`
  (decisão D1, resolvida).
- `CONFIG_FILE` não é isolado por porta: instância de teste em `--port 8123`
  ainda escreve no `control-center.json` real. Testar rota de escrita exige
  cuidado (ver armadilha detalhada no `CLAUDE.md`).
- **Editar `~/.claude/hooks/*.mjs` é editar infraestrutura ativa agora
  mesmo**, pra toda sessão do Felipe em todo projeto. Testar com stdin
  sintético (PowerShell, não Git Bash — mistura de separador de caminho
  engana o parser) antes de considerar pronto, e conferir sem regressão
  contra pelo menos um quadro real (inovallbond) só por leitura.
- **`docs/ROTAS-ATIVAS.md` deste projeto está ativo.** `pastas-controladas:
  [src]`. Sessão que for mexer em `src/` precisa marcar a própria rota antes
  — ver o quadro.
