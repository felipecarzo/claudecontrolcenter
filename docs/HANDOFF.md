# HANDOFF

**Sessão:** 2026-08-06 · agente Claude (Opus 5) · máquina ALIENWARE-LIPE
**Último commit:** `c962cd3` — docs(session): encerramento 2026-08-05
**Branch:** `master` · **árvore suja de propósito** — ver pendências abaixo

**Estado:** o painel global foi reinstalado e está no ar com tudo do dia
(http://localhost:8099). O código correspondente **não está commitado**.
O que aconteceu: [diario/2026-08-06.md](diario/2026-08-06.md).

## Próxima task: CC-10 — commitar o trabalho de 2026-08-06

Nada foi commitado hoje. O código está testado, no ar e em uso, mas vive só na
árvore de trabalho desta máquina. É a primeira coisa a fazer.

| arquivo | o que é |
|---|---|
| `src/notes.mjs` | **novo** — notas da máquina, modo texto ou lista |
| `src/tempo.mjs` | **novo** — horas por projeto e custo de token |
| `test-ui.mjs` | **novo** — teste de ponta a ponta por CDP, fora do gate |
| `src/ui.html` | notas, três abas refeitas, `@container` |
| `src/web.mjs` | rotas `/api/notes` e `/api/tempo`; helper `comCorpo` |
| `src/jobs.mjs` | `pin` do painel convivendo com `pins.json` do CLI |
| `src/platform.mjs` | `chromePath()` — só o teste usa |
| `test.mjs` | asserts de notas, pin e tempo |
| `package.json` | script `test:ui` |
| `CLAUDE.md` | módulos novos e sete armadilhas |
| `.claude/` | não rastreado — **decidir se entra ou vai pro `.gitignore`** |

Sugestão de quebra, se quiser commits legíveis em vez de um só:
notas (`notes.mjs` + rota + coluna) · aba de to-dos · aba de agentes + pin ·
aba de tempo (`tempo.mjs` + rota + view) · testes e docs.

## Depois disso

**CC-11 — a aba de custo ficou atrás.** A aba de tempo agora calcula custo real
por token com quebra por tipo e recorte por período; a de custo ainda mostra
`state.tokens` acumulado desde sempre, sem preço. Decidir se ela vira a visão
financeira de verdade ou se some.

**CC-12 — taxa horária.** Você pediu pra ver o custo real de token antes de
decidir converter horas em dinheiro. Viu: $8,8k de API em 187h. A taxa
configurável (global e por projeto) é o passo que falta, e a decisão é sua.

## Armadilhas que vão te pegar de novo

- **`cc daemon restart` reinicia o pacote instalado, não este repositório.**
  Pra validar o repo: `node cc.mjs --web-only --port 8123`. Pra levar mudança
  pro painel de todo dia: `npm i -g D:\Documentos\Ti\projetos\PESSOAL\proj_controlcenter`
  e então `node cc.mjs daemon restart`.
- **`npm run test:ui <id-do-job>`** escreve num job real e no arquivo de notas,
  e restaura os dois no fim — do estado do **começo** da rodada. Não fique
  editando o painel enquanto ele corre.
- O resto está em `CLAUDE.md`, seção Armadilhas — sete entradas novas hoje.

## Arquivos a ler antes

- `CLAUDE.md` — armadilhas; as de hoje custaram tempo de verdade
- `docs/diario/2026-08-06.md` — o porquê de cada decisão do dia
- `src/tempo.mjs` — o único módulo novo com lógica não óbvia (cache por blocos)

## Regras que não podem quebrar

- `process.platform` só aparece em `src/platform.mjs`
- `~/.claude/jobs` é somente leitura, exceto `meta.json`
- `pins.json` e `state.json` são do Claude Code — nunca escrever
- Depois de editar `src/`, reinicie o servidor: ele não recarrega módulo

## Estado do ROADMAP

| Task | Estado |
|---|---|
| MVP · CC-03 design · CC-07 faixa de atividade | concluído |
| CC-10 commitar o dia 06/08 | **aberto — próxima** |
| CC-08 macOS e Linux | aberto — precisa de máquina |
| CC-09 repositório privado | aberto — decisão do Felipe |
| CC-11 aba de custo ficou atrás da de tempo | aberto |
| CC-12 taxa horária em R$ | aberto — decisão do Felipe |
| CC-04 aviso de silêncio nunca visto | aberto — precisa de agente travado |
| CC-05 tabela do terminal ainda agrupa por projeto | aberto |
