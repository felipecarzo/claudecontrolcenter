---
tags: [plano, sincronia, agente, codex]
tipo: plano
atualizado: 2026-11-23
estado: plano escrito, esperando o ok dele para executar
resumo: Sessões do Codex aparecendo no cockpit e recebendo resposta digitada nele, pelo PC, e da VPS pela federação.
---

# Codex dentro do cockpit: ver as sessões e responder por ele

## O pedido, nas palavras dele

> "eu tô com uma conta do Codex e eu queria colocar ela para ser utilizada dentro do cockpit também. Assim como eu
> uso aqui com o Remote Control, acessando pelo aplicativo do Claude, tem como fazer isso pelo Codex também?"

Pronto, pelo backlog: sessão do Codex aparece no cockpit e aceita resposta digitada nele.

## Onde o Codex guarda as sessões (medido em 23/11, 17h50, codex-cli 0.171.0, só leitura)

A credencial (`~/.codex/auth.json`) não foi aberta. O diagnóstico do próprio Codex diz que o login é de conta ChatGPT,
guardado em arquivo.

- **Uma sessão é um arquivo**: `~/.codex/sessions/AAAA/MM/DD/rollout-<data>T<hora>-<id>.jsonl`, uma linha JSON por
  evento, com `timestamp`, `ordinal`, `type` e `payload`. Mesmo desenho do transcrito do Claude Code.
- **A primeira linha (`session_meta`) dá a ficha**: `id`, `cwd` (a pasta), `originator` (`codex-tui`, `codex_exec`),
  `source` (`vscode`, `exec`, `cli`), `cli_version`, `timestamp`. Não tem nome de projeto: sai da pasta, como no Claude.
- **As falas**: linhas `response_item` do tipo `message`, com `role` `user`, `assistant` ou `developer` (este último
  é instrução do sistema, 28 mil caracteres numa sessão, e precisa ficar de fora como o `isMeta` do Claude).
- **O estado da vez**: `event_msg` com `task_started` e `task_complete` (este traz `last_agent_message`, a última
  resposta pronta), `token_count` (com `rate_limits`, o uso do plano do Codex) e `item_completed`.
- **Nome**: `~/.codex/session_index.jsonl`, uma linha por sessão com nome (`id`, `thread_name`, `updated_at`). Sessão
  de `exec` não entra nele.
- **Trava de escrita**: `~/.codex/thread-writer-locks/<id>.lock` existe enquanto alguém escreve na sessão.
- O resto da pasta são bancos SQLite (`state_5`, `thread_history_1`, `queue_1`, `logs_2`) que o cockpit não precisa.

**Comparado com o Claude Code**: `src/sessoes.mjs` lê `~/.claude/projects/*/<id>.jsonl` pela idade do arquivo e pela
cabeça (`cwd`), e `src/transcript.mjs` lê a cauda para o último pedido. Para o Codex o mesmo leitor serve trocando a
pasta, o campo da pasta (`payload.cwd` na primeira linha) e o filtro de quem fala. O "aberta agora" do Claude vem de
`~/.claude/sessions/<pid>.json`; no Codex o equivalente é o arquivo de trava ou a pergunta ao daemon (abaixo).

**Armadilha medida**: o id do Codex começa pela hora (`01a20a26-...` às 17h43, `01a20a30-...` às 17h54). Os 8
primeiros caracteres só mudam a cada 65 segundos. O cockpit usa esses 8 como apelido da sessão (`curto` em
`src/sessoes.mjs`, `startsWith` em `entregarMensagemRemota`), então duas sessões do Codex abertas no mesmo minuto
virariam uma só e a resposta podia ir para a errada. Para o Codex a chave tem que ser o id inteiro.

## O que `remote-control` e `app-server` fazem

- **`codex app-server`** é o motor que roda as sessões. Nesta máquina ele já está ligado como daemon (`codex app-server
  daemon version`: `running`, modo efêmero, versão 0.171.0) e escuta em `~/.codex/app-server-control/
  app-server-control.sock`. A extensão do VS Code fala com ele.
- **`codex remote-control start`** é o mesmo daemon com o controle remoto ligado, e `pair` imprime um código curto de
  pareamento. O daemon avisa o estado num evento: hoje veio `disabled`. É essa a peça que o aplicativo do Codex no
  celular usa, pelo servidor da OpenAI até o daemon do PC (o evento traz `serverName`, `installationId` e
  `environmentId`). O lado do celular **não conferi**.
- **O protocolo** (gerado com `codex app-server generate-ts`, 701 tipos) é JSON-RPC. O que importa para o cockpit:
  - listar e ler: `thread/list` (filtra por origem, pasta, arquivada), `thread/read`, `thread/turns/list`,
    `thread/loaded/list`;
  - mandar texto: `turn/start` (nova vez) e `turn/steer` (enfia texto numa vez que está rodando), `turn/interrupt`
    (parar), `thread/resume`;
  - ao vivo: avisos `thread/status/changed` (`idle`, `active`, `notLoaded`, `systemError`), `turn/started`,
    `turn/completed`, `item/agentMessage/delta` (a resposta letra a letra), `thread/queue/changed`,
    `account/rateLimits/updated`;
  - aprovar: o daemon PEDE ao cliente `item/commandExecution/requestApproval`, `item/fileChange/requestApproval` e
    `item/permissions/requestApproval`, e a resposta é `accept`, `acceptForSession`, `decline` ou `cancel`. É o
    equivalente às permissões do Claude que o cockpit já mostra.
- **O cockpit alcança o daemon?** Sim, medido. O socket fala WebSocket (respondeu `101 Switching Protocols`), e
  `codex app-server proxy` repassa os bytes pela entrada e saída padrão. Com um script de 30 linhas sem dependência
  (enquadramento WebSocket à mão), `initialize` respondeu em 92 ms e `thread/list` em 103 ms, listando as duas sessões
  com origem, pasta e estado. JSON cru sem WebSocket fica sem resposta (tentado, 20 s). O Node do Windows não abre esse
  socket direto, por isso o proxy.

## O teste curto na conta dele (23/11, 17h54, 2 pedidos ao modelo)

Numa pasta vazia do scratchpad, sandbox só leitura:

1. `codex exec --skip-git-repo-check -s read-only -C <pasta vazia> --json "responda apenas OK-CODEX"` respondeu
   `OK-CODEX` em 1,2 s. Sessão `01a20a30-7342-72d3-8f8e-f27db7f7a12b`. Custo: 21.503 tokens de entrada (15.232 de
   cache) e 8 de saída. Pediu login? Não. Abriu janela? Não.
2. `codex queue --thread 01a20a30-... --message "responda apenas SEGUNDA-OK" --resume` saiu em 1 s com "Queued
   message ... for thread ...". O daemon retomou a sessão sozinho: no arquivo dela, a fala chegou às 20:54:52 UTC e a
   resposta `SEGUNDA-OK` às 20:54:53. **A mensagem enfileirada chegou e foi respondida**, sem terminal aberto.

**Não conferi**: o `queue` numa sessão que ele está usando na hora (aberta no VS Code ou no terminal). O que se espera
é a mensagem entrar na fila e rodar quando a vez atual terminar (`thread/queue/changed` existe para isso), mas não
medi, e é o caso dele de verdade.

## Três desenhos

**A. Só ver.** Um leitor `src/codex.mjs` lê `~/.codex/sessions` como `readSessoes` lê o Claude e junta em
`todosOsJobs()` com marca `ferramenta: 'codex'`. A federação já leva sessões para a VPS, então lá aparece igual.
- Entrega: as sessões do Codex no cockpit do PC e da VPS, com pasta, projeto, último pedido, última resposta, idade e
  uso do plano do Codex.
- Não entrega: responder, aprovar, nem saber ao certo se ela está aberta (só pela idade e pela trava).
- Custo: tamanho P. Risco baixo, só leitura de disco.

**B. Ver e responder pelo `codex queue` (recomendado).** A + um ramo em `entregarMensagemRemota`: se a conversa é do
Codex, o PC roda `codex queue --thread <id inteiro> --message <texto> --resume` pelo padrão de `lancarComando`
(`cmd.exe /c`, cada argumento separado, nunca `shell: true`, porque o texto é livre).
- Entrega: responder do cockpit do PC e da VPS. Medido hoje: chega e responde em ~3 s.
- Não entrega: aprovar comando pedido pelo Codex, nem ver a resposta aparecer letra a letra (aparece quando o arquivo
  cresce, no tique de 2 s).
- Custo: tamanho M. Depende de comando marcado como experimental pela OpenAI.

**C. Falar com o daemon por socket.** Um processo vivo no painel do PC abre `codex app-server proxy`, fala o
protocolo e fica ouvindo.
- Entrega: tudo de B, mais estado ao vivo, parar a vez, e os pedidos de aprovação do Codex no mesmo lugar das
  permissões do Claude.
- Não entrega: nada a menos. Mas aprovar só funciona para sessão que roda NO daemon; sessão de terminal com motor
  próprio não pede aprovação por ele (não conferi quantas das dele são assim).
- Custo: tamanho G. Protocolo experimental com 110 chamadas que muda entre versões (gerar os tipos a cada versão), um
  cliente WebSocket escrito à mão, e mais um processo vivo para supervisionar.

**A VPS nos três.** A credencial fica só no PC: nada de copiar `auth.json`. A VPS vê as sessões pelo resumo que o PC
já empurra a cada 30 s, e a resposta digitada lá desce pela fila de pedidos que o CC-1120 consertou
(`pedidosParaVoce`); quem roda o `codex queue` (ou fala com o daemon) é o PC. Igual ao Claude hoje.

**Recomendação: B, em duas entregas.** Primeiro A (ver), que já tira a dúvida de quais sessões ele usa; depois o ramo
de resposta. C fica para quando aprovar pelo cockpit pesar, e B não joga nada fora, porque o leitor de A continua
servindo.

## Decisão dele, 23/11/2026

Perguntado se queria só ver, ver e responder, ou também aprovar, respondeu: *"quero ver, responder e aprovar pelo
proprio codex com RC, e pelo cockpit tambem, e se der por terminal e sei la por quais outras opções"*.

Então o alvo é o desenho C inteiro, e o Codex continua usável pelos outros caminhos dele (controle remoto do próprio
Codex, terminal). Ordem das entregas, uma sessão cada:

1. **Ver** as sessões do Codex no cockpit do PC e da VPS (desenho A), chave pelo id inteiro.
2. **Responder** pelo `codex queue --resume`, do PC e da VPS pela fila de pedidos (desenho B).
3. **Aprovar e acompanhar ao vivo** pelo servidor local do Codex (desenho C).
4. **Abrir sessão do Codex pelo cockpit num terminal do painel**, como já existe para o Claude.
5. **Controle remoto do próprio Codex** (`codex remote-control start` e `pair`): isto muda o que o Codex deixa o celular
   dele fazer no PC. Só liga com a ordem dele na hora, e o código de pareamento é dele, nunca meu.

## CORREÇÃO (23/11, 21h): a causa de "não aparece no celular" era a lista do aplicativo, não a minha sessão

Depois de 4 sessões de teste, ele fechou e abriu de novo o aplicativo do ChatGPT no celular e **apareceu tudo**, até
a sessão do Codex da VPS. Ou seja, a lista do celular não se atualiza sozinha: precisa fechar e reabrir o aplicativo.
As três explicações abaixo (origem `exec`, projeto desconhecido, campo `thread_source`) eram hipóteses minhas e
**não se confirmaram como causa**; não decidem nada no botão "+ Codex". O que continua medido e vale: a lista do
servidor sem filtro mostra só as fontes interativas, e abrir pelo protocolo dá origem `vscode`. Não conferi quais das
sessões de teste ele viu (as `exec` entre elas). Regra para o futuro: ao testar o celular, fechar e reabrir o
aplicativo ANTES de mexer em qualquer coisa.

## (hipóteses de 23/11, 20h40, não confirmadas) por que a sessão aberta por `codex exec` não aparece no celular

- `codex exec` cria sessão com origem `exec` (originador `codex_exec`). A lista de sessões do servidor, quando o
  cliente não pede filtro, devolve só as fontes **interativas** (descrição do próprio protocolo). Sem filtro, só a
  sessão `vscode` do viralgame01 voltou; as duas `exec` de teste ficaram de fora. O celular provavelmente pede sem
  filtro, então não via nada.
- Abrir pelo protocolo do servidor (`thread/start` e `turn/start`, com `cwd`, sandbox só leitura, aprovação sob
  pedido) dá à sessão a origem `vscode` e ela entra na lista sem filtro. Depois de aberta, a lista mostrou o
  originador dela como `codex_chatgpt_android_remote`, ou seja, o servidor registrou o cliente do ChatGPT no Android
  nessa sessão. Isso é um sinal forte, não prova de que ele a vê na tela.
- Consequência para o botão "+ Codex" (entrega 4): abrir pelo protocolo do servidor, nunca por `codex exec`. O cliente
  de teste está em `scratchpad/scripts/ws-nova.mjs` (30 linhas, sem dependência).

## A pergunta que ele já respondeu (arquivo do plano)

**Responder já basta, ou aprovar pelo cockpit é o que importa?**

- **De onde veio**: medido hoje, o Codex aceita mensagem de fora por dois caminhos. O comando `codex queue` funciona
  agora (testado: chegou e respondeu em 3 s). A conversa direta com o motor do Codex também funciona (testado: lista
  as sessões em 0,1 s), e só ela deixa aprovar os comandos que o Codex pede antes de rodar.
- **Opção 1, responder (B)**: ele digita no cockpit, do PC ou da VPS, e a sessão do Codex responde. Quando o Codex
  pedir licença para rodar um comando, ele aprova no VS Code ou no terminal do PC. Peso: médio, cerca de uma sessão de
  trabalho, pouco risco.
- **Opção 2, responder e aprovar (C)**: tudo da opção 1 e as licenças do Codex aparecem no cockpit, ao lado das do
  Claude. Peso: grande, várias sessões, e mais frágil, porque a OpenAI marca essa parte como experimental e ela muda
  entre versões. Começar pela 1 não atrasa a 2.

## Entrega 4: abrir sessão do Codex em projeto (23/11, medido na VPS e no PC)

O botão "Codex" (telas Projetos e Remoto) abre o `codex` de terminal na pasta do projeto: num tmux `cc-codex-<projeto>`
na VPS, num terminal do WezTerm no PC. Código em `src/codexAbrir.mjs`; a rota é a mesma `POST /api/remote-control`, com
`ferramenta: 'codex'`. A resposta digitada no cockpit vai para esse terminal (`responderCodex` tenta o terminal antes
do `codex queue`). Medido na VPS, numa pasta de teste que já foi apagada:

- **Sandbox**: `read-only` e `workspace-write` funcionam dentro da caixa da VPS (provado com `codex sandbox`: lê, grava
  só na pasta do projeto, recusa gravar fora). O botão usa `workspace-write` com aprovação `on-request`. `danger-full-access`
  e `--dangerously-bypass-approvals-and-sandbox` não foram necessários e não são usados.
- **Confiança na pasta**: sem nada, o Codex pergunta "Trust and continue". `-c 'projects."<pasta>".trust_level=...'` (com
  ponto) NÃO pula a pergunta; `-c 'projects={"<pasta>"={trust_level="trusted"}}'` (tabela inteira) pula, e não escreve
  no `config.toml`. Se a pergunta aparecer mesmo assim, o painel escolhe pelo texto da tela, com o cursor conferido.
- **Aviso de versão nova** abre uma tela em que o Enter padrão roda `npm install -g`: `-c check_for_update_on_startup=false`
  evita, e se ela aparecer a sessão fecha sem apertar nada.
- **No PC** o Codex abriu uma tela "Hooks need review" (confiar nos ganchos dele), que o painel não responde: a sessão
  fica aberta e o botão avisa que a pergunta se responde no terminal.
- **O id da sessão** é a trava nova em `~/.codex/thread-writer-locks/`, criada ao abrir, antes de qualquer mensagem, e
  é o mesmo id do arquivo da sessão (conferido). É por ele que a resposta acha o terminal.
- **Ponta a ponta na VPS**: abrir em tmux com os argumentos do botão, digitar `responda apenas VPS-OK` com `send-keys -l`
  e Enter (pausa de 300 ms entre os dois), e o arquivo da sessão trouxe a resposta `VPS-OK`. Um pedido ao modelo.
- **Por que a VPS dizia `escreve: false`**: o painel roda como serviço, o PATH dele não tem `~/.npm-global/bin`, e o
  `codex` não era achado. `binarioCodex()` agora procura nos lugares do npm do usuário.

Não feito: aprovar pelo cockpit (entrega 3); botão de encerrar a sessão do Codex (a rota `acao: 'desligar'` com
`ferramenta: 'codex'` existe, sem botão); abrir sessão numa máquina pelo cockpit da outra.
