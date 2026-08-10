# HANDOFF

**Sessão:** 2026-08-10 · agente Claude (Sonnet 5) · máquina ALIENWARE-LIPE
**Último commit antes desta sessão:** `ef5e5ee` — docs(session): encerramento 2026-08-09
**Branch:** `master` · pendente de commit ao final desta sessão (ver abaixo)

O que aconteceu: [diario/2026-08-10.md](diario/2026-08-10.md).

## Pendências de commit

Ainda não commitado nesta sessão — aguardando aprovação do Felipe:
`CLAUDE.md`, `README.md`, `docs/ROADMAP.md`, `docs/diario/2026-08-10.md`,
`docs/HANDOFF.md`, `src/config.mjs`, `src/platform.mjs`, `src/servers.mjs`,
`src/ui.html`, `src/web.mjs`, `test.mjs`. (`src/ui.html` acumula tanto a aba
de servidores quanto a janela flutuante — duas entregas, um arquivo.)

## Próxima task: CC-17 — o "último pedido" no cartão não é o último

Segue igual ao HANDOFF anterior — não foi tocada nesta sessão, o Felipe pediu
outra coisa (aba de servidores) em vez disso.

A linha mistura duas fontes: `lastPrompt`, lido do transcript, e `meta.status`,
escrito pelo agente. A precedência escolhe uma e não diz qual. Decidir entre
rotular a origem ou mostrar só o que o agente declarou — e, se for a segunda,
lembrar que `subject` já é do agente, então a linha viraria redundante.

Começar por `src/ui.html`, função `cartao()`, a variável `nota`.

## O que mudou hoje e você precisa saber

**A aba de servidores parou de mostrar "node" solto.** Cada cartão agora diz o
que o processo é de fato (`next rodando em inovallbond/apps`), aceita apelido
e nota escritos à mão, agrupa por projeto, marca favorito, fecha duplicados do
mesmo tipo com confirmação, abre a pasta em quatro formatos e sobe servidor
novo — por pasta, favorito ou recente.

**Três bugs reais na detecção de projeto, achados só por testar contra o
disco de verdade** (não só `npm test`): barra dobrada depois de `.bin`
inventava um servidor chamado ".bin"; caminho do Windows com barra normal
perdia a letra do drive; o trecho extraído podia terminar num arquivo em vez
de pasta. Os três em `src/servers.mjs`, corrigidos com teste — ver
`CLAUDE.md`.

**Config ganhou uma seção nova:** `servidores` em `~/.claude/control-center.json`,
por `chaveServidor()` (caminho+porta, não PID). Escrita por `setServidor()` em
`src/config.mjs`.

**`cc daemon restart` já foi rodado** com o código novo, então o painel real
(porta 8099) já reflete tudo isto. Se testar de novo, não precisa reiniciar
por causa desta sessão — só se mexer em `src/` de novo.

**Janela flutuante nova** — botão "flutuar" no topo, `documentPictureInPicture`.
Resumo de uso do plano, agentes em andamento e tokens, atualiza junto com o
stream de 2s. Testado de verdade (clique + confirmação visual do Felipe) no
painel real. Só `src/ui.html`, sem rota nova no backend — tudo já vinha em
`/api/jobs`.

## Armadilhas que vão te pegar de novo

- **O caminho do servidor sai da linha de comando, e ela mente de três
  jeitos** — barra dobrada, drive perdido, arquivo em vez de pasta. Ver
  `CLAUDE.md`, é a mais recente e mais cara de hoje.
- **Chave de servidor não pode ser o PID** — muda a cada `npm run dev`.
- **Rodapé do cartão não cabe seis botões** — por isso renomear/explicar/pasta
  foram para `.srv-onde`, acima do rodapé.
- O resto (das sessões anteriores) segue em `CLAUDE.md`, seção Armadilhas.

## Arquivos a ler antes

- `CLAUDE.md` — seção Armadilhas, as de hoje estão no topo da lista de servidor
- `src/servers.mjs` — o mais novo, e o mais arriscado (executa comando na
  máquina via `subirServidor`)
- `src/ui.html` → função `cartao()`, variável `nota` — ponto de partida do
  CC-17

## Regras que não podem quebrar

- `process.platform` só aparece em `src/platform.mjs`
- `~/.claude/jobs` é somente leitura, exceto `meta.json`
- `pins.json` e `state.json` são do Claude Code — nunca escrever
- Depois de editar `src/`, reinicie o servidor: ele não recarrega módulo
- O pacote global é um LINK para este repositório: código quebrado aqui quebra
  o `cc` de todos os agentes na hora. Rode `npm test` antes de sair.
- **Novo desta sessão:** `subirServidor()` executa comando arbitrário na
  máquina. A única trava é a pasta (`pastaValida()`) — dentro da base de
  projetos ou de uma pasta listada em `CC_PROJECT_DIRS`. Não adicionar
  lista fechada de comandos permitidos: foi decisão consciente, o campo é
  editável de propósito.

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
