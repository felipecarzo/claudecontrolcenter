# HANDOFF

**Sessão:** 2026-08-05 · agente Claude (Opus 5) · máquina ALIENWARE-LIPE
**Último commit:** `076f3ca` — docs: portabilidade, instalacao por npm e o que nao foi testado
**Branch:** `master`, sincronizada com `origin` · árvore limpa, nada pendente

**Estado:** v0.2.0 publicada em
[github.com/felipecarzo/claudecontrolcenter](https://github.com/felipecarzo/claudecontrolcenter)
(privado), instalável com `npm i -g github:felipecarzo/claudecontrolcenter`.
Comando global `cc`. Painel rodando no login desta máquina.
O que aconteceu: [diario/2026-08-05.md](diario/2026-08-05.md).

## Próxima task: CC-08 — rodar em macOS ou Linux

Nunca foram executados. Conferir nesta ordem, que vai do mais seguro ao que
mexe no sistema:

1. `cc` — só leitura, tem que funcionar de primeira
2. `cc open` — usa `open`/`xdg-open`
3. `cc daemon install` — escreve launchd (`~/Library/LaunchAgents`) ou systemd
   de usuário (`~/.config/systemd/user`)
4. aba **servidores** — depende de `lsof` (ou `ss` no Linux)
5. encerrar um processo de teste — usa `SIGTERM`, não `taskkill`

Se algo falhar, o conserto é dentro de `src/platform.mjs`; nada fora dele
precisa mudar.

## Arquivos a ler antes

- `src/platform.mjs` — todo o código por sistema operacional
- `docs/ROADMAP.md` — CC-08 e CC-09, os dois abertos
- `CLAUDE.md` — armadilhas que já custaram tempo

## Regras que não podem quebrar

- `process.platform` só aparece em `src/platform.mjs`
- `~/.claude/jobs` é somente leitura, exceto `meta.json`
- Depois de editar `src/`, rode `cc daemon restart` — o servidor não recarrega
  módulo e você acaba validando código velho

## Estado do ROADMAP

| Task | Estado |
|---|---|
| MVP (núcleo, terminal, web, meta.json, daemon, skills) | concluído |
| CC-03 design (zonas, mission control, abas, painel lateral) | concluído |
| CC-08 macOS e Linux | aberto — precisa de máquina |
| CC-09 repositório privado | aberto — decisão do Felipe |
| CC-04 faixa de silêncio nunca vista | aberto — precisa de agente travado |
| CC-05 tabela do terminal ainda agrupa por projeto | aberto |
| CC-07 abas tempo/custo sem uso real | aberto |
