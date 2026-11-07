# Encerrar uma sessão: /encerrar e `cc sessao encerrar`

itens: CC-1075
codigo: src/encerrarSessao.mjs, src/sessoes.mjs, src/remotecontrol.mjs, cc.mjs, test-encerrar.mjs
atualizado: 2026-10-30

Plano de origem: `docs/CC-1075.md`. Modelo do guia: skill `guia-de-capacidades`.

## 1. Estado e para quem vale

Pronto na VPS (Linux), coberto por `test-encerrar.mjs` com tmux falso. O fechamento REAL de uma sessão do Claude Code
não foi provado: só o de um tmux descartável. Vale para qualquer sessão interativa que tenha registro em
`~/.claude/sessions/`.

## 2. O que é, e o que não é

É o jeito de ele dizer "acabei" a uma sessão: commita, dá push e a sessão some do painel como "encerrada". Não é o
`/stop` do Claude Code (que não dispara nenhum evento e deixa o processo vivo, por isso o painel mostrava a sessão como
parada). Não é deploy, não apaga branch, não faz force push.

## 3. Vocabulário

- **Carimbo**: o horário em que a sessão foi encerrada, em `encerradas.json`.
- **Registro**: `~/.claude/sessions/<pid>.json`, um por processo do Claude Code (campos usados: `pid`, `sessionId`,
  `startedAt`, `tmux`). Os arquivos `.key` ao lado nunca são lidos.
- **Abrigo**: `~/.local/share/agent-cockpit/` (respeita `CC_HOME`), onde o painel escreve, porque `~/.claude` é somente
  leitura no sandbox.

## 4. O ciclo de ponta a ponta

1. Ele digita `/encerrar`. A skill liga o commit contínuo da sessão, commita só o que a sessão mexeu, dá push sem force.
2. A skill roda `node cc.mjs sessao encerrar`.
3. O comando acha a própria sessão por `CLAUDE_CODE_SESSION_ID`, grava o carimbo, anota `encerradaEm` no vínculo do
   projeto (se for sessão do painel, `cc-remote-*`) e, se há tmux, agenda `tmux kill-pane` do PAINEL dela (o `%N` do registro) para 6 s depois. Painel e não sessão: `kill-session` fecharia todas as janelas do tmux, inclusive a de outra conversa que dividisse a sessão (corrigido em 30/10 depois de revisão).
4. `sessoesAbertas` passa a descartar o `sessionId` carimbado: o cartão vira "encerrada" mesmo com o processo vivo.

## 5. Onde cada coisa mora

- Carimbos: `~/.local/share/agent-cockpit/encerradas.json`, `{ "<sessionId>": <ms> }`, escrita atômica.
- Lógica: `src/encerrarSessao.mjs`. Leitura pelo painel: `src/sessoes.mjs` (`sessoesAbertas`).
- Skill: `~/.claude/skills/encerrar/SKILL.md`.

## 6. A interface

- `cc sessao encerrar`: marca e, havendo tmux, fecha em 6 s.
- `cc sessao encerrar --so-marcar`: só marca, não fecha nada.
- `/encerrar` (skill): o fluxo inteiro, com commit e push.

## 7. Regras e limites

- Só age na PRÓPRIA sessão: o id do painel tmux vem do registro dela. Nunca mata outra. Registro de tmux sem id de painel (`%N`): só marca, não fecha nada.
- Sem tmux (terminal comum), só marca e avisa que o processo continua: ele fecha o terminal.
- Retomada: sessão retomada (`--resume`) com `startedAt` depois do carimbo ignora o carimbo e volta a aparecer.
- Sem `CLAUDE_CODE_SESSION_ID` ou sem registro: erro claro, nada gravado.
- A autorização de commit e push da skill vale só quando ele digita `/encerrar`.

## 8. O que a combinação torna possível

Com o commit contínuo (`hooks/commit-auto.mjs`) e o registro do turno (`src/registroTurno.mjs`), uma frase só encerra o
trabalho inteiro de uma sessão sem deixar cartão fantasma no painel.

## 9. O que ainda não existe

- Detecção automática de `/stop`: não há evento. Só o `/encerrar` limpa.
- Fechar sessão que não está em tmux.
- Desfazer o carimbo por botão (só retomando a sessão).

## 10. Receitas

- Marcar sem fechar: `node cc.mjs sessao encerrar --so-marcar`.
- Ver os carimbos: ler `~/.local/share/agent-cockpit/encerradas.json`.

## 11. Como provar

`node test-encerrar.mjs`. Prova real: tmux descartável `cc-teste-encerrar` com registro falso, ver o tmux sumir em ~6 s.
