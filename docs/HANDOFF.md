# HANDOFF

**Sessão:** 2026-08-09 · agente Claude (Opus 5) · máquina ALIENWARE-LIPE
**Último commit:** `d3133f3` — feat(mapa): o ROADMAP.md do projeto vira mapa no painel
**Branch:** `master` · **árvore limpa**, tudo empurrado

O que aconteceu: [diario/2026-08-09.md](diario/2026-08-09.md).

## Próxima task: CC-17 — o "último pedido" no cartão não é o último

Foi a única reclamação do Felipe que ficou sem resposta hoje. Ele olha o cartão
e não reconhece o texto como o que pediu por último.

A linha mistura duas fontes: `lastPrompt`, lido do transcript, e `meta.status`,
escrito pelo agente. A precedência escolhe uma e não diz qual. Decidir entre
rotular a origem ou mostrar só o que o agente declarou — e, se for a segunda,
lembrar que `subject` já é do agente, então a linha viraria redundante.

Começar por `src/ui.html`, função `cartao()`, a variável `nota`.

## O que mudou hoje e você precisa saber

**O painel virou legível para quem não escreveu o código** — foi o tema do dia.
Uso do plano fixo no topo, seis temas, cartões em todas as abas de lista,
módulos de CPU/RAM/GPU e barra de mídia.

**"Prontos" era mentira e foi corrigido.** O `state` do CLI vira `done` ao fim
de cada TURNO. Agora `statusReal()` usa o sinal para separar vivo de terminado.
Se mexer em status, ler a armadilha no `CLAUDE.md` antes.

**O protocolo ganhou `frente`** — a seção do `ROADMAP.md` onde o agente está.
Já vale para todos os projetos pelo bloco global. Os cartões antigos ainda
mostram a rota; os novos mostram `projeto › frente`.

**Notas têm backup agora.** As do Felipe sumiram hoje e não se provou a causa.
`writeNotes` guarda `.bak` a cada gravação e uma cópia com data quando tudo
some. Se ele reclamar de nota perdida, o `.bak` é o primeiro lugar a olhar.

## Armadilhas que vão te pegar de novo

- **`quiet()` é síncrono e congela o servidor.** Para qualquer coisa que
  alimente a tela, use `quietAsync`. Custou 2,7s de event loop travado.
- **`.` no regex não casa `\r`.** Metade dos arquivos é CRLF; um parser inteiro
  saiu vazio por causa disso, sem erro nenhum.
- **Mídia só funciona no PowerShell 5.1**, nunca no `pwsh` 7.
- **CSS duplicado ganha por último.** A barra de volume tinha duas declarações
  e a correção certa estava sendo anulada em silêncio.
- O resto está em `CLAUDE.md`, seção Armadilhas — cresceu bastante hoje.

## Arquivos a ler antes

- `CLAUDE.md` — armadilhas; as de hoje custaram horas
- `src/roadmap.mjs` — o mais novo, e o que muda como o painel é lido
- `src/jobs.mjs` → `statusReal()` — por que "pronto" não é `state === done`

## Regras que não podem quebrar

- `process.platform` só aparece em `src/platform.mjs`
- `~/.claude/jobs` é somente leitura, exceto `meta.json`
- `pins.json` e `state.json` são do Claude Code — nunca escrever
- Depois de editar `src/`, reinicie o servidor: ele não recarrega módulo
- O pacote global é um LINK para este repositório: código quebrado aqui quebra
  o `cc` de todos os agentes na hora. Rode `npm test` antes de sair.

## Estado do ROADMAP

| Task | Estado |
|---|---|
| CC-17 último pedido ambíguo no cartão | **aberto — próxima** |
| CC-18 projeto sem ROADMAP.md fica sem mapa | aberto |
| CC-19 conferir se os agentes declaram `frente` | aberto — reavaliar em dias |
| CC-14 tray com porcentagem errada | aberto — do Felipe |
| CC-15 statusline.log com 284 MB | aberto — do Felipe |
| CC-08 macOS e Linux | aberto — precisa de máquina |
| CC-04 aviso de silêncio nunca visto | aberto — precisa de agente travado |
| CC-05 tabela do terminal ainda agrupa por projeto | aberto |
