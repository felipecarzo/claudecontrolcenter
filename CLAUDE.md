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
cc.mjs           entrada única: CLI (terminal, web, daemon, set)
src/
  jobs.mjs       núcleo — lê ~/.claude/jobs, deriva campos, escreve meta.json
  tui.mjs        tabela do terminal
  web.mjs        servidor http + SSE + POST /api/meta
  ui.html        página, sem dependência, tema claro/escuro automático
test.mjs         asserts da derivação + sintaxe do ui.html
AGENTS.md        protocolo que os agentes seguem pra alimentar o painel
docs/            ver docs/README.md
```

Sem dependência de runtime. Só Node >= 18 e o que vem nele.

## Comandos

```bash
node cc.mjs                # tabela no terminal + web, imprime o link
node cc.mjs --web-only     # só o servidor
node cc.mjs json           # despeja o estado e sai
node cc.mjs set '<json>'   # agente grava seu meta.json
npm test                   # gate de qualidade — não existe outro
```

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
