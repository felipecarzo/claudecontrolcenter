# control-center — Claude Code Instructions

## Projeto
Painel dos agentes do Claude Code rodando em background. Uma linha por agente,
agrupada por projeto, com rota, modelo, tokens, idade e to-dos — no lugar da
navegação por abas (`←` `←`) do CLI.

Duas telas do mesmo dado: tabela no terminal e página web. Roda como daemon no
logon do Windows; o uso normal é clicar no atalho, não subir servidor à mão.

Raiz: `D:\Documentos\Ti\projetos\PESSOAL\proj_controlcenter`
Git: um repositório só, na raiz acima.

## Estrutura

```
cc.mjs           entrada única: CLI (terminal, web, daemon, set, install)
src/
  jobs.mjs       núcleo — lê ~/.claude/jobs, deriva campos, escreve meta.json
  transcript.mjs último pedido, lido do .jsonl da sessão
  platform.mjs   TUDO que depende do sistema operacional
  daemon.mjs     autostart, atalho, subir/derrubar — delega pro platform
  servers.mjs    portas em escuta, com as travas do encerrar
  config.mjs     interruptor global e por projeto
  install.mjs    bloco do protocolo no CLAUDE.md dos projetos
  tui.mjs        tabela do terminal
  web.mjs        servidor http + SSE + rotas de escrita
  ui.html        página, sem dependência
test.mjs         asserts + sintaxe do ui.html
AGENTS.md        protocolo que os agentes seguem pra alimentar o painel
docs/            ver docs/README.md
```

Sem dependência de runtime. Só Node >= 18 e o que vem nele.

## Comandos

Distribuído como pacote npm (`npm i -g github:felipecarzo/claudecontrolcenter`),
o comando é `cc`. No repositório, `node cc.mjs` faz o mesmo.

```bash
cc                    # tabela no terminal + web, imprime o link
cc --web-only         # só o servidor
cc json               # despeja o estado e sai
cc set '<json>'       # agente grava seu meta.json
cc daemon restart     # depois de mexer no código
npm test              # gate de qualidade — não existe outro
```

## Portabilidade

`process.platform` só pode aparecer em `src/platform.mjs`. Todo comando de
sistema (subir no login, listar portas, matar processo, abrir navegador, criar
atalho) passa por lá, com um caminho por SO.

**Windows é o único verificado em máquina real.** macOS (launchd, `lsof`,
`.command`) e Linux (systemd de usuário, `lsof`/`ss`, `.desktop`) foram escritos
com os comandos padrão de cada um, mas nunca rodaram.

Nenhum caminho de máquina pode ser fixado no código: a pasta de projetos é
descoberta pelos diretórios dos jobs, e dá pra forçar por `CC_PROJECTS_BASE`.

## Regra de ouro — não quebrar o Claude Code

`state.json` e `pins.json` são do CLI: **somente leitura, sempre**. A única
escrita permitida é `meta.json`, arquivo novo que o Claude Code não conhece
nem lê, com escrita atômica (tmp + rename).

Qualquer mudança que escreva em outro arquivo dentro de `~/.claude/jobs/` está
errada por definição.

## Armadilhas (custaram tempo, não redescobrir)

- **`fan[]` fica com resíduo** da última tool mesmo depois do job terminar. Só
  exibir enquanto o status é `working`.
- **Truncar string já colorida corta o código ANSI no meio** e vaza `[0m` na
  tela. Por isso `cell()` recebe texto puro e aplica a cor depois.
- **Screenshot headless trava** nessa página: o SSE mantém a conexão aberta e o
  Chrome nunca considera o load terminado.
- **O servidor não recarrega módulo.** Mexeu em `src/`, reinicie o processo —
  senão você valida código velho achando que é novo.
- **Modelo não é campo próprio**, sai de `respawnFlags` (`--model opus[1m]`).
- **`state.intent` não serve como "o pedido".** É o primeiro prompt, congelado:
  sessão longa que mudou de assunto mostra coisa velha. E em job respawnado ele
  já apareceu com prompt de **outra conversa**. O pedido de verdade sai do
  transcript (`linkScanPath`), que é nomeado pelo `sessionId` e não mistura.
  Ver `src/transcript.mjs`.
- **Transcript passa de 25 MB.** Ler o arquivo inteiro a cada 2s trava tudo. Lê-se
  a cauda (256 KB), com cache por tamanho+mtime; a cabeça tem cache eterno,
  porque o começo do arquivo nunca muda.
- **Nem toda mensagem `user` foi escrita por uma pessoa.** Injeção de skill vem
  com `isMeta: true` e o SKILL.md inteiro no corpo; interrupção vem com
  `interruptedMessageId`; saída de tool vem com `toolUseResult`. Prompt real
  carrega `promptSource`. Sem esse filtro, o painel mostra o texto da skill como
  se fosse o pedido — aconteceu.
- **Screenshot do painel:** `?static=1` desliga o SSE (senão o headless nunca
  termina de carregar), `?expand=1` abre todas as zonas, `?open=<id>` abre uma
  linha, `?tab=<id>` escolhe a aba. Sem eles não dá pra ver o layout numa captura.
- **O `meta.json` é escrito por agente e o formato varia.** Um agente gravou
  `{t: "..."}` no lugar de `{text: "..."}` e o painel exibiu "undefined" com a
  tarefa inteira ali do lado. Toda leitura de `meta` passa por `normalizeTodo` /
  `normalizeLink`: aceitar variação é mais barato que esperar acerto.
- **Matar processo pela aba de servidores tem três travas** (`killServer`): o PID
  precisa estar na lista atual, ser servidor de desenvolvimento, e não estar na
  lista de protegidos. A lista contém `lsass` e `svchost` — matar um derruba a
  sessão do Windows.
- **PowerShell não usa `\` como escape.** Montar comando com `JSON.stringify`
  gera `\"` e quebra o parse silenciosamente — o `.lnk` do Desktop virou `.url`
  de fallback sem erro visível. Use aspas simples, escapadas duplicando.
- **O atalho do Desktop não é uma URL.** É um `.lnk` que chama
  `abrir-control-center.vbs` → `cc.mjs open`, que sobe o painel se estiver fora
  do ar. Um `.url` simples só funciona se o processo já estiver vivo.
- **Varrer portas leva ~3s.** Só a rota `/api/servers` faz isso, com cache de
  15s, e a aba só consulta quando aberta. Nunca colocar isso no `/api/jobs` nem
  no stream.

## Convenções
- Commits: `type(scope): mensagem` — sem `Co-Authored-By`
- Gate de qualidade: `npm test` + conferência visual das duas telas
- Português nos textos de tela e nos docs

## Docs de referência
- `docs/README.md` — mapa da documentação
- `docs/produto/VISAO.md` — que problema resolve, e o que não é
- `docs/produto/MVP.md` — escopo do MVP e definição de pronto
- `docs/ROADMAP.md` — o que está aberto
- `AGENTS.md` — protocolo do `meta.json`
