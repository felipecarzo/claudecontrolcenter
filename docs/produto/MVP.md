# MVP e definição de pronto

## O corte

MVP é: **abrir o painel e saber o estado de todos os agentes sem entrar em
nenhum.** Tudo que não serve a essa frase fica de fora da v1.

## Escopo do MVP

| # | Entrega | Estado |
|---|---|---|
| 1 | Ler `~/.claude/jobs` e derivar projeto, rota, modelo, status, idade, tokens | pronto |
| 2 | Tabela no terminal, agrupada por projeto, atualizando sozinha | pronto |
| 3 | Painel web com filtro, busca, detalhe expansível e SSE | pronto |
| 4 | `meta.json` — agente reporta assunto, categoria, to-dos, bloqueios, links | pronto |
| 5 | `cc.mjs set` com merge parcial, descobrindo o job pelo ambiente | pronto |
| 6 | Rodar sozinho no logon do Windows, com atalho pra abrir | pronto |
| 7 | Ligar o protocolo em todos os projetos, com liga/desliga | pronto |

MVP fechado em 2026-08-05. O que sobrou é design, que sempre foi "depois".

Fora do MVP, por decisão e não por esquecimento: design próprio (vem depois de
tudo funcionar), agrupar por rota além de projeto, histórico/gráfico de tokens,
notificação de agente travado, acesso remoto.

## Definição de pronto

Uma entrega só está pronta quando **todas** as linhas valem:

1. `npm test` passa — incluindo a leitura dos jobs reais da máquina.
2. Foi verificada na superfície onde o usuário vai ver: tabela renderizada de
   verdade, ou rota HTTP chamada de verdade. Ler o código não conta.
3. Nada foi escrito dentro de `~/.claude/jobs/` além de `meta.json`.
4. O Claude Code continua funcionando — de preferência comprovado com um job
   vivo, não por raciocínio.
5. Se cortou um canto de propósito, o limite está escrito em `docs/ROADMAP.md`
   ou num comentário `ponytail:` no código.
6. Se mudou comportamento que o agente precisa seguir, `AGENTS.md` foi
   atualizado junto — protocolo e código não podem divergir.

## Como se sabe que o produto funcionou

Não por métrica: pelo comportamento. Está funcionando quando o Felipe abre o
painel em vez de apertar `←` `←` — e quando um agente travado é notado pelo
painel antes de ser notado por ele.

Está falhando se as colunas de `meta.json` viverem vazias: significa que os
agentes não estão reportando, e aí a tabela não sabe mais do que a barra de
abas já sabia.
