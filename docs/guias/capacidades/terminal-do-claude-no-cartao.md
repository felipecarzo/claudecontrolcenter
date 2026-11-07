# Botão "terminal" do Claude Code dentro do painel (Projetos, Sessões e Claude Code do projeto)

itens: CC-1051
codigo: src/ui_cockpit2.html, src/web.mjs, src/cockpit2.mjs, src/remotecontrol.mjs, test-terminal-claude.mjs
atualizado: 2026-10-29

Guia de capacidades do botão que abre o Claude Code de verdade de um projeto dentro do painel. O CC-1051 acrescentou o
botão no detalhe do projeto da aba Projetos; a peça (camada, repasse, serviço) nasceu no CC-1041 (diário
`docs/diario/2026-10-08.md`, linha do `claude-ttyd`). Modelo: skill `guia-de-capacidades`. Escrito só com o que está no
código e no teste, lidos em 29/10.

## 1. Estado e para quem vale

Item CC-1051 no backlog: estado OK, prova "robô: test-terminal-claude.mjs passou". Vale na VPS, para os projetos que o
painel conhece. A camada e o botão existem em `src/ui_cockpit2.html`; o repasse existe em `src/web.mjs`. Se o serviço
`claude-ttyd` está de pé agora: não verificado (não rodei nada, e o serviço fica fora do repositório).

## 2. O que é, e o que não é

É um botão "terminal" que abre, numa camada por cima da área central do painel, uma tela de terminal (iframe) ligada ao
Claude Code do projeto. A tela vem do programa `ttyd` (terminal de linha de comando servido como página web), pelo
caminho `/painel/claude/` do próprio painel, atrás da mesma senha. Não é o chat das Sessões (esse é outra tela), não é
o "terminal da VPS em forma de chat" (CC-1061, botão "Terminal" do topo, `src/shellChat.mjs`) e não é o Coderoom: o diário
registra que o Coderoom não ganhou o botão porque as conversas dele rodam sem terminal (`claude -p`).

## 3. Vocabulário

- **ttyd**: programa que serve um terminal como página web. Roda como serviço de usuário `claude-ttyd`, na porta 5185, só
  em 127.0.0.1 (diário 08/10, não está no repositório).
- **Repasse** (proxy): o painel recebe `/painel/claude/...` e entrega ao ttyd; a página e a conexão ao vivo (WebSocket)
  passam pelas duas pontas.
- **tmux**: programa que mantém uma sessão de terminal viva em segundo plano. `cc-remote-<projeto>` é a sessão que o painel
  abre para o app do celular; `cc-term-<projeto>` é a que o terminal cria para projeto sem sessão (nome vindo do diário e
  do comentário em `src/ui_cockpit2.html:25493`; o script que decide isso, `~/.local/bin/claude-projeto`, não foi lido).
- **arg**: o parâmetro `?arg=` da URL: ou o nome da sessão tmux, ou o nome do projeto.

## 4. O ciclo de ponta a ponta

1. Ele clica em "terminal". O clique é capturado por um ouvinte único em qualquer elemento com `data-claude-term`
   (`src/ui_cockpit2.html:25516`).
2. `c2Terminal(arg, titulo)` (`:25495`) cria, na primeira vez, a camada `#c2-term` com cabeçalho, botão "abrir em aba
   própria", botão "fechar" e um iframe.
3. O iframe aponta para `/painel/claude/?arg=<arg escapado>` (`:25505`).
4. O servidor (`src/web.mjs:2017` para a página, `:5140` para o WebSocket) troca o id `claude` pela porta 5185 e repassa
   para 127.0.0.1. Id desconhecido responde 404 "painel desconhecido".
5. O ttyd chama o `claude-projeto` com o `arg`. Segundo o diário (não li o script): entra na sessão tmux que já existe, ou
   cria `cc-term-<projeto>`.
6. A camada se encaixa entre a barra da esquerda e a da direita; o foco vai ao iframe após 300 ms.
7. "fechar" só esconde a camada e põe o iframe em `about:blank`; o Claude continua no tmux (`:25503` e comentário `:25493`).

## 5. Onde cada coisa mora

| O quê | Onde |
|---|---|
| Botão no detalhe do projeto (aba Projetos), CC-1051 | `src/ui_cockpit2.html:26217` a `:26223`, com `data-claude-term` |
| Botão por sessão em "Claude Code · N sessões" | `src/ui_cockpit2.html:12979` |
| Botão do projeto sem sessão | `src/ui_cockpit2.html:12993` |
| Botão no cartão da sessão (Sessões) | `src/ui_cockpit2.html:23917` e `:24160` |
| Camada, ouvinte do clique, `c2Terminal` | `src/ui_cockpit2.html:25495` a `:25518` |
| Estilo da camada (`.c2-term*`) | `src/ui_cockpit2.html:4780` a `:4784` |
| Porta 5185 e repasse | `src/web.mjs:5146` a `:5149` (`PORTA_CLAUDE`, `portaRepasse`) |
| Nome do terminal de cada sessão (`s.tmux`) | `src/cockpit2.mjs:1135`, `:1141`, `:1284` |
| Nome da sessão tmux (`slug`, prefixo `cc-remote-`) | `src/remotecontrol.mjs:40` e `:42` |
| Serviço `claude-ttyd` e script `claude-projeto` | fora do repositório: não verificado |
| Teste | `test-terminal-claude.mjs` |

## 6. A interface, item por item

- **terminal** no detalhe do projeto (Projetos): aparece junto de "abrir sessão em" Claude Code, Coderoom e Antigravity.
  Passa o nome do projeto como `arg`. Só aparece quando `pjSessaoBtn(p)` devolve algo, isto é, quando o projeto tem raiz e
  framework conhecidos (`:26379` a `:26382`, `:26217`).
- **terminal** na linha de cada sessão aberta do projeto: passa o nome tmux calculado por `c2TmuxDe(rotulo)`
  (`cc-remote-` mais o rótulo, caracteres fora de `a-zA-Z0-9_-` viram `-`, máximo 50).
- **terminal** (projeto sem sessão, grupo "Claude Code"): passa o nome do projeto.
- **terminal** no cartão da sessão (Sessões, ícone ou link): só se a sessão tem `tmux` (sessão rodando num terminal desta
  VPS); passa esse nome.
- **abrir em aba própria**: link no cabeçalho da camada para a mesma URL, `target=_blank`. Escondido em tela de até 520 px.
- **fechar**: esconde a camada, não encerra o Claude.
- Em tela de até 520 px a camada ocupa a largura toda (`left:0;right:0`). Em tela larga ela começa onde a barra da esquerda
  termina e acaba onde a da direita começa (se aberta).

## 7. Regras e limites

- O repasse só alcança 127.0.0.1 e só a porta fixa 5185 para o id `claude` (mais as portas declaradas dos outros painéis).
- Pedido de WebSocket vindo de subdomínio ou outro site é recusado (`pedidoDeFora`, `src/web.mjs:5123`).
- Esconder ou fechar a camada não mata o Claude: ele segue vivo no tmux.
- O botão do projeto sem sessão abre pelo nome do projeto; se ele já tem sessão, o botão por sessão abre aquela específica.
  O que acontece se o nome do projeto bater com uma sessão existente: não verificado (depende do `claude-projeto`).
- Reabrir o mesmo `arg` não recarrega o iframe se a URL é a mesma e a camada ficou só escondida; depois do "fechar" o
  iframe está em `about:blank`, então reabre carregando de novo (`:25511`).

## 8. O que a combinação torna possível

Só o que o código sustenta:

- Botão por sessão mais `s.tmux`: a mesma sessão que o app do celular vê (`cc-remote-...`) abre no painel, então dá para
  acompanhar no computador uma sessão aberta com "conectar celular" (a ligação pelo nome `cc-remote-`, `src/remotecontrol.mjs:42`
  e `src/ui_cockpit2.html:25520`, é travada por teste).
- Repasse com WebSocket mais a senha do painel: o terminal é alcançado pelo celular com a mesma entrada do painel, sem
  expor a porta 5185 (só escuta 127.0.0.1, segundo o diário).
- Detalhe do projeto: da aba Projetos dá para abrir sessão no Claude Code, Coderoom, Antigravity ou o terminal de verdade,
  todos do mesmo cartão (`:26217` a `:26223`).

## 9. O que ainda não existe

- Botão "terminal" para conversas do Coderoom (diário 08/10: elas rodam sem terminal; ligado ao CC-1043).
- No código lido não há botão no cartão da lista de módulos de Projetos (`pjModulos`, `:26391`): só "sessão" e "ver detalhe".
  O botão do CC-1051 está no detalhe.
- Detecção de que o serviço `claude-ttyd` caiu: o repasse devolve 502 com o erro (`src/web.mjs:2024`), mas não encontrei
  aviso na camada. Como o iframe mostra isso: não verificado.
- Prova de ponta a ponta com o ttyd de verdade: o teste só olha o texto dos arquivos (ver seção 11).

## 10. Receitas curtas

- Abrir o Claude Code de um projeto sem sessão: aba Projetos, abrir o detalhe, botão "terminal" ao lado de "abrir sessão em".
- Ver a mesma sessão que o celular usa: botão "terminal" na linha da sessão em "Claude Code · N sessões".
- Abrir só o terminal, em tela cheia do navegador: "abrir em aba própria" no cabeçalho da camada (ou a URL
  `/painel/claude/?arg=<projeto ou cc-remote-...>` atrás da senha).
- Mudar a porta: `PORTA_CLAUDE` em `src/web.mjs:5147`; o serviço `claude-ttyd` precisa mudar junto (fora do repositório).

## 11. Como provar que continua funcionando

```
node test-terminal-claude.mjs
```
O teste (6 verificações) lê os arquivos como texto e confere: porta 5185 e `portaRepasse`; o repasse usado na página E no
WebSocket (duas ocorrências em `web.mjs`); `s.tmux` ligado em `cockpit2.mjs`; `c2Terminal` e a URL escapada; ao menos 3
ocorrências de `data-claude-term`; e o nome tmux igual entre tela e servidor. Ele não sobe servidor nem navegador.
Outros documentos: `docs/diario/2026-10-08.md`, `docs/guias/capacidades/INDICE.md`.
