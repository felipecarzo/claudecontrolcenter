# HANDOFF

**Estado:** v0.2.0 publicada em
[github.com/felipecarzo/claudecontrolcenter](https://github.com/felipecarzo/claudecontrolcenter)
(privado), instalável com `npm i -g github:felipecarzo/claudecontrolcenter`.
Comando global `cc`. Ver [diario/2026-08-05.md](diario/2026-08-05.md).

**Próximo passo:** CC-08 — macOS e Linux estão implementados mas nunca rodaram.
Ver [ROADMAP.md](ROADMAP.md).

**Antes de mexer no código:** `npm test`, e `cc daemon restart` depois de editar
`src/` — o servidor não recarrega módulo e você valida código velho. Se estiver
trabalhando no repositório em vez do pacote global, use `node cc.mjs`.

**Regra que não pode quebrar:** `process.platform` só em `src/platform.mjs`;
`~/.claude/jobs` é somente leitura, exceto `meta.json`.
