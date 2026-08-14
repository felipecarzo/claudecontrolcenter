---
tags: [produto, visao]
tipo: visao
atualizado: 2026-08-05
estado: no ar, é o produto de hoje
resumo: Ver o estado de todos os agentes numa tela só, sem entrar em nenhum. Nasceu porque a única forma de olhar vários agentes no Claude Code é navegar aba por aba.
termos:
  job: um agente do Claude Code rodando em background, com pasta em ~/.claude/jobs
  meta.json: o único arquivo que o painel escreve. É por onde o agente reporta assunto, to-dos e bloqueio
  state.json: o arquivo do Claude Code. Somente leitura, sempre. Escrever nele quebraria o CLI
  statusReal: a diferença entre agente vivo trabalhando e agente que só terminou o turno
  respawn: quando o CLI recria o job, o que faz o primeiro prompt ficar velho e enganar a tela
---

# Visão — Control Center

## O problema

O Claude Code roda vários agentes em background ao mesmo tempo. A única forma de
olhar para eles é a barra de abas: `←` `←` navega uma aba por vez, e cada aba
mostra um agente só. Não existe visão de conjunto.

Na prática, com 5 a 10 agentes vivos:

- Não dá pra saber **quem está trabalhando em quê** sem entrar em cada um.
- Não dá pra ver **quantos estão parados**, travados ou esperando resposta.
- Agentes em rotas diferentes do mesmo projeto ficam indistinguíveis.
- O custo (tokens) só aparece depois, nunca durante.

Quem paga esse preço é o Felipe, que despacha o trabalho e precisa saber onde
intervir — não os agentes.

## A ideia

Um painel que responde, de relance: **quem está fazendo o quê, onde, e o que
precisa de mim agora.**

Duas superfícies do mesmo dado, porque os dois momentos existem:
- **terminal** — quando já se está no terminal e a resposta é de 2 segundos
- **web** — quando se quer ler com calma, filtrar, abrir detalhe, clicar link

## De onde vem a informação

Duas fontes, com papéis distintos:

**O Claude Code**, em `~/.claude/jobs/<id>/state.json`. Sabe que um agente
existe, em que diretório roda, com que modelo, há quanto tempo, quantos tokens
gastou, se está ativo. **Nunca é escrito por este projeto.**

**O próprio agente**, em `meta.json`. Sabe o que o `state.json` não tem: o
assunto em três palavras, a categoria, os to-dos, o que está travando, os links
que interessam. Escrever isso é trabalho do agente, guiado por `AGENTS.md`.

Essa divisão é a decisão central do projeto. O painel não adivinha o que o
agente está resolvendo — ele pergunta, e o agente responde.

## O que este projeto NÃO é

- **Não é um gerenciador de agentes.** Não cria, não mata, não pausa job. Quem
  faz isso é o CLI. O painel observa e reporta.
- **Não é um log.** Transcrição, histórico de tool call e diff ficam no CLI. Aqui
  cabe só o que se lê de relance.
- **Não é multiusuário nem remoto.** Escuta em `127.0.0.1`. Ver de outra máquina
  é problema de outro dia.
- **Não substitui o ROADMAP dos projetos.** Os to-dos daqui são do agente, para
  a sessão dele — não são backlog.

## Para quem

Um usuário: o Felipe. Isso é permissão pra ser denso e sem onboarding, e é
também o motivo de não existir autenticação.
