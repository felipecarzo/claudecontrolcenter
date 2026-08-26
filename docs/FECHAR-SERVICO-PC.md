# Fechar o serviço do PC de uma vez (para a sessão que roda no Windows)

## O objetivo, nas palavras dele (26/08)

> *"o nosso objetivo é criar um serviço/app que nos permita sempre ver que o PC
> está conectado à VPS e passando as infos em tempo real pra lá."*

Tudo abaixo serve a isso. O ícone na bandeja não é enfeite: é o **sempre ver**
que ele pede. Um olhar na barra de tarefas responde "o PC está ligado à VPS e
mandando dado agora?" sem abrir nada. O serviço supervisionado é o que garante o
"sempre": sem ele, a conexão cai e ninguém percebe, que é a dor de hoje.



> Escrito na VPS em 26/08, a pedido dele, depois de ele dizer: *"to cansado do PC
> desconectar com a VPS, e nada da gente está com um programa no system tray (…)
> por que será que não conseguimos fechar essa tarefa? (…) estamos empilhando
> problemas e bugs, isso não está funcionando"*.
>
> **Ele tem razão.** Esta tarefa nunca fecha porque o último passo é no Windows,
> e quem trabalha da VPS só alcança a metade de cá. Este arquivo é para uma
> sessão do Claude **rodando no PC** (aberta por ele, direto na pasta do cockpit
> no Windows, não pelo botão "abrir lá", que depende justamente do que está
> quebrado). Faça tudo num passo só, e prove no Windows antes de dizer feito.

## A causa raiz, medida (não é falta de código)

O ícone da barra de tarefas **já existe** (`src/bandeja.ps1`, o traço entre os
dois nós, desenho dele). O pacote que o PC manda **já traz** o estado do
framework. Mesmo assim o PC cai e a tela mente. Por quê:

**O PC tem DOIS arranques ao mesmo tempo**, e é isso que empilha os bugs:

1. o atalho antigo de logon (`.vbs` na pasta Startup, `instalarAutostart` /
   `caminhoAutostart`) — sobe o painel no logon e **não** reinicia se ele morre;
2. a tarefa agendada nova, supervisionada (`instalarServico` /
   `instalarServicoWindows`, via `schtasks`, com reinício em falha).

Rodando os dois, há **dois painéis, logo dois empurradores**. Foi a assinatura
que apareceu em 25/08: o campo do framework piscava entre valor e nulo a cada 15s
(dois empurradores de 30s defasados, um com código novo, outro velho). O conserto
daquele dia tratou o SINTOMA (o campo passou a herdar por 2 min). A doença é os
dois arranques.

Some-se a isso: o PC roda **código velho** ("atualize lá com git pull"), porque
nada puxa e reinicia sozinho. Então mesmo o conserto certo, feito aqui, não chega
lá até alguém atualizar à mão.

## O que "fechado" quer dizer

- **UM arranque só**, supervisionado: se o painel morre, volta sozinho em
  segundos. Sobrevive ao PC dormir e ao logoff.
- **UM empurrador só**: o campo do framework no pacote fica estável, sem piscar.
- **Atualiza sozinho**: ao subir, faz `git pull` e reinicia, para o PC nunca
  ficar preso em código velho.
- **O ícone na bandeja** aparece e mostra o traço (cheio/tracejado/partido/cinza).

## O passo único, no PC (Windows)

Tudo com a sessão rodando NO PC, na pasta do cockpit. Confira cada prova antes de
seguir para a próxima.

1. **Atualize o código:** `git pull` na pasta do cockpit do PC.

2. **Mate os dois arranques atuais, para começar limpo:**
   - `node cc.mjs daemon uninstall` (remove o atalho de logon antigo);
   - confira e remova à mão o que sobrar na pasta Startup: abra
     `shell:startup` e apague qualquer `.vbs` do cockpit (painel E bandeja) que
     tenha ficado;
   - `schtasks /query /tn <nome-da-tarefa>` e, se existir uma tarefa velha ou
     duplicada, remova (`removerServico` ou `schtasks /delete`).
   - **Prova:** nenhum `node` do painel vivo (`Get-Process node`), nada em
     Startup, nenhuma tarefa agendada do cockpit. Começo do zero.

3. **Instale UM arranque supervisionado só:** a tarefa agendada com reinício em
   falha (`instalarServico`/`instalarServicoWindows`), que sobe **o painel + a
   bandeja + um empurrador**. Se essa consolidação ainda não existe como um
   comando único, ela é o trabalho a fazer aqui (você pode editar
   `src/platform.mjs`/`src/daemon.mjs` no Windows e testar de verdade, coisa que
   a VPS não pode). O alvo: um `schtasks` que roda um script que (a) faz
   `git pull`, (b) sobe o painel, (c) sobe a bandeja, (d) garante um empurrador.

4. **Prove o empurrador único:** com o painel no ar, olhe o pacote que o PC manda
   por ~60s (na VPS: o arquivo `~/.claude/control-center-federacao/<id>.json`, ou
   a aba do painel). O campo do framework **não pode piscar**. Piscou = ainda há
   dois empurradores; volte ao passo 2.

5. **Prove a supervisão:** mate o processo do painel à mão (`Stop-Process`). Em
   segundos a tarefa agendada tem que subir outro. Confirme pelo PID novo.

6. **Prove que sobrevive a dormir/logoff:** faça logoff e login (ou suspenda e
   acorde). O painel e a bandeja voltam sozinhos, sem você abrir nada.

7. **Prove a bandeja:** o ícone aparece na barra, e o traço reflete o estado
   (sincronizando / atrasou / parou / painel fora do ar).

## O que NÃO fazer

- **Não adicione um TERCEIRO mecanismo.** O problema é ter dois; a saída é
  consolidar em um, não somar. Se criar algo novo, remova os dois velhos.
- **Não diga "feito" sem as provas 4, 5 e 6.** Elas são o que fecha; o resto é
  só instalar. Foi pular essa parte que empilhou os bugs até aqui.

## Contexto no backlog

Isto fecha a frente "o cockpit vira aplicativo de verdade" (CC-340) e o "PC vira
serviço" (CC-351). A leitura de várias pastas (CC-352) já está pronta do lado da
VPS. O git ao ligar ele decidiu **não** automatizar (fica no botão).
