# HANDOFF

**Sessão:** 2026-08-12 · agente Claude (Opus 5) · máquina ALIENWARE-LIPE ·
delegada por `/ceo`
**Último commit:** ver `git log -1` — cockpit (`49f936c`), docs da frente nova
(`3b45a56`) e CC-20/calendário empurrados nesta sessão
**Branch:** `master`

O que aconteceu: [diario/2026-08-12.md](diario/2026-08-12.md).

## Próxima task

**CC-17** — o "último pedido" no cartão nem sempre é o último. Segue aberta
desde 10/08, sem tocar. Começar por `src/ui.html`, função `cartao()`, variável
`nota`. Ver `docs/ROADMAP.md`.

Alternativa: **CC-21** — MCP do Google Calendar com escrita, agora que CC-20
(leitura) está pronto. Destrava o resto da frente de conteúdo social.

## Arquivos a ler antes

- `docs/ROADMAP.md` — estado de tudo que está aberto
- `CLAUDE.md` — seção Armadilhas, as de hoje estão no topo (`CONFIG_FILE` não
  isolado por porta, do teste do CC-20)
- `src/calendario.mjs` — parser de ICS novo, se for mexer no CC-21

## Regras que não podem quebrar

Sem mudança desde a sessão de 10/08 — ver `CLAUDE.md`, seção "Regra de ouro" e
"Armadilhas". Duas novas desta sessão: `calendarios[].url` nunca volta pro
navegador (mesma lógica da chave da VPS); testar rota que ESCREVE config não
pode restaurar arquivo inteiro de um backup — o daemon real pode ter escrito
algo legítimo no meio do teste.
