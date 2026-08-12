# Visão — Conteúdo social (módulo)

Módulo novo dentro do Control Center. Não é o painel de status de agente
descrito em [[VISAO]] — aquele observa job vivo, este observa **o que já foi
feito** pra virar conteúdo. Duas visões diferentes do mesmo conjunto de
projetos, no mesmo repositório porque compartilham a infra de leitura (roadmap,
histórico, diário) que o CC já tem.

## O problema

Felipe produz artefato real toda semana: commit que resolve algo difícil,
projeto que fecha, evento presencial, nota de prova, paper publicado. Nada
disso vira conteúdo público porque (a) ele não quer virar blogueiro/influencer,
(b) reconstruir o contexto de cada projeto pra escrever um post é trabalho que
ele evita, (c) não existe fila — cada post seria decisão ad-hoc.

## A ideia

Pipeline de captura → digest → curadoria em lote, não geração ad-hoc:

1. **Sinais automáticos**, lidos sem digitação: git log de todos os projetos,
   `docs/diario/*` e `ROADMAP.md` de cada um (já estruturados, o CC já lê pra
   outras abas), Google Calendar (eventos reais, escritos por Felipe ou por MCP
   com permissão de escrita).
2. **Sinal manual mínimo**: arquivo de "marco" pra evento que não deixa rastro
   em código (reunião, fala em evento, nota de prova) — uma linha, não formulário.
3. **Digest semanal**: ferramenta no CC que cruza os três sinais acima e produz
   um resumo do que aconteceu, por projeto, candidato a virar post.
4. **Skill de rascunho** (fora deste repo — é skill global do Claude Code, não
   módulo do CC) lê o digest e gera lote de rascunhos, tom travado uma vez
   (analítico, sem motivacional), sem reabrir cada projeto do zero.
5. **Fila de curadoria semanal**: Felipe aprova/descarta/edita em lote, não um
   post por vez.

## De onde vem cada dado

| Sinal | Fonte | Já existe no CC? |
|---|---|---|
| Commits/PRs | `git log` de cada projeto | Não — precisa varredura nova |
| Marcos de projeto | `docs/diario/*.md` | Sim, `historico.mjs` lê parecido |
| Tarefas fechadas | `ROADMAP.md` (item que sai) | Parcial — `roadmap.mjs`/`tarefas.mjs` |
| Eventos reais | Google Calendar | Não — sem módulo de calendário |
| Evento fora do código | arquivo de marco manual | Não existe ainda |

## O que este módulo NÃO é

- **Não é fonte de verdade.** Git e `docs/diario` continuam sendo a fonte; o
  digest é índice derivado, descartável e regenerável.
- **Não posta sozinho.** Curadoria semanal é humana, sempre — sem isso vira o
  "virar influencer" que é exatamente o que Felipe rejeitou.
- **Não é o Método Routia.** Routia coordena quem mexe em qual rota entre
  sessões paralelas; não guarda histórico nem gera conteúdo. Zero sobreposição.
- **Não duplica o vault Obsidian.** O digest e o histórico continuam sendo
  arquivo `.md` estruturado escrito pelo CC/skill; o Obsidian (`LM_vault/Neo`,
  hoje vazio) só abre essa pasta pra visualização e grafo — nunca escreve nela,
  nunca é a fonte que a skill lê.

## Decisão de escopo (2026-08-11, com o Felipe)

- Vive dentro do `proj_controlcenter` (não é projeto novo à parte) — reaproveita
  leitura de roadmap/diário/histórico que já existe.
- Obsidian revive só como leitor — mirror, não fonte.
- Skill de geração de rascunho fica fora deste repo (skill global do Claude
  Code), consome o digest que este módulo produz.
