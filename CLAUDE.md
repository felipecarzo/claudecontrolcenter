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
  notes.mjs      bloco de notas da máquina, em ~/.claude
  tempo.mjs      horas por projeto e custo de token, lidos dos transcritos
  cambio.mjs     cotação do dólar — a única chamada de rede do painel
  install.mjs    bloco do protocolo no CLAUDE.md dos projetos
  tui.mjs        tabela do terminal
  web.mjs        servidor http + SSE + rotas de escrita
  ui.html        página, sem dependência
test.mjs         asserts + sintaxe do ui.html
test-ui.mjs      a aba de to-dos dirigida por CDP (fora do gate, pede Chrome)
AGENTS.md        protocolo que os agentes seguem pra alimentar o painel
docs/            ver docs/README.md
```

Sem dependência de runtime. Só Node >= 18 e o que vem nele. Funciona offline,
menos a cotação do dólar — que degrada pro último valor conhecido.

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
npm run test:ui <job> # opcional: a aba de to-dos de ponta a ponta, com Chrome
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
- **`cc daemon restart` reinicia o pacote instalado, não este repositório.** O
  autostart aponta pro `cc.mjs` de `AppData/Roaming/npm/node_modules/…`, então
  mexer em `src/` e reiniciar continua servindo código velho — e você fica
  procurando bug no lugar errado. Para validar o repo, suba numa porta própria:
  `node cc.mjs --web-only --port 8123`. Só reinstalar o pacote global leva a
  mudança pro painel de todo dia.
- **Breakpoint do painel é `@container`, não `@media`.** Com a coluna de notas
  aberta a janela continua larga enquanto o painel encolhe; media query nunca
  dispararia e a tabela quebraria em vez de compactar. `#painel` declara
  `container-type: inline-size` e as regras olham pra ele.
- **Bloco de nota em modo lista não tem array de itens.** O `text` continua
  sendo a única fonte: uma linha por item, `[x] ` na frente quando feito, e
  `kind: 'check'` só muda como aparece. Alternar o modo não migra dado nenhum,
  e o arquivo segue legível fora do painel. Um array paralelo daria duas
  verdades pro mesmo conteúdo.
- **Índice de to-do não é posição na tela.** As concluídas ficam depois das
  abertas, dentro do `<details>`, então "o último campo do DOM" é uma tarefa que
  já existe. Focar o campo novo por `campos[campos.length-1]` fez a digitação
  sobrescrever uma tarefa pronta — e apagou uma de verdade. Sempre buscar por
  `[data-i="<índice no array>"]`.
- **Durante a edição, `DATA` não pode mudar.** O stream troca o snapshot a cada
  2s; com o redesenho adiado pelo foco, a tela mostra a lista antiga enquanto os
  índices já são outros, e a edição vai parar em outra tarefa. `aplicarDados()`
  segura o snapshot em `dadosPendentes` até o campo perder o foco.
- **Nada de textarea dentro do `#main`.** `render()` reescreve o painel inteiro
  a cada evento do stream, de 2 em 2 segundos — o cursor sumiria no meio da
  frase. As notas moram num `<aside>` irmão e só se redesenham ao criar ou
  apagar bloco; digitar altera o modelo em memória e agenda a gravação.
- **A aba de tempo mede tempo ativo, e o corte é do usuário.** A janela do
  primeiro ao último sinal não serve pra cobrar: no `inovallbond` dá 282h
  corridas contra ~90h de trabalho real. O que vale é a soma dos intervalos
  descartando as paradas maiores que um corte — e o corte muda o número
  (77,7h a 5min contra 91,5h a 15min no mesmo projeto), então é escolha de
  quem olha, nunca constante no código.
- **O cache do tempo guarda blocos, não totais.** Se `tempo.mjs` somasse as
  horas na varredura, mudar o corte na tela exigiria reler 800 MB. Por isso o
  cache guarda blocos contíguos de 2 minutos: qualquer corte a partir daí sai
  juntando blocos vizinhos, em memória. O preço é não conseguir cortes < 2min.
- **Ler 800 MB de transcrito leva ~3s, e só a aba de tempo pede.** `JSON.parse`
  roda apenas nas linhas que têm `"usage"` (~18% delas); nas outras o timestamp
  sai por regex. Reler tudo a cada abertura seria desperdício — o cache por
  tamanho+mtime relê só a sessão que cresceu.
- **O custo em dólar é referência, não fatura.** Sai da tabela de preços de API
  em `PRECOS`; quem usa assinatura não pagou aquilo. E o volume engana: quase
  todo o token é releitura de cache, que custa 10% da entrada — por isso a
  quebra por tipo aparece no detalhe do projeto.
- **Modelo vem ora com alias, ora com data.** `claude-haiku-4-5` e
  `claude-haiku-4-5-20251001` são o mesmo preço; sem `precoDe()` cortando o
  sufixo, o modelo cai calado na lista de ignorados e o custo sai menor.
- **Varrer portas leva ~3s.** Só a rota `/api/servers` faz isso, com cache de
  15s, e a aba só consulta quando aberta. Nunca colocar isso no `/api/jobs` nem
  no stream.
- **O câmbio é a única chamada de rede do painel inteiro.** Tudo o mais lê disco
  local. `cambio.mjs` busca a cotação na AwesomeAPI (sem chave), cacheia por 12h
  no config e, se a rede falhar, devolve o último valor — com a data na tela.
  Cotação fora da faixa 0,5–100 é rejeitada: se a API inverter o par e mandar
  0,18, o custo de R$ 34 mil viraria R$ 1,2 mil sem nenhum erro aparecer.
  Cotação digitada marca `manual: true` e a busca automática para de mexer.
- **Não existe coluna de margem, e a tentativa foi revertida.** Receita menos
  custo de API dava "sobra de −R$ 19.504" no inovallbond: o custo é preço de
  API e o Felipe paga assinatura. Só faz sentido com o custo real da
  assinatura rateado, que o painel não tem.
- **Taxa zero não é "de graça", é "não configurada".** `setTaxa(0, {projeto})`
  apaga a entrada em vez de gravar zero, e o projeto volta pra taxa global —
  senão não haveria como desfazer uma taxa específica. Pelo mesmo motivo a
  coluna de valor some quando ninguém tem taxa: uma tabela de R$ 0,00 em toda
  linha diz que o trabalho não vale nada. A taxa mora no `config.mjs`, nunca no
  cache de tempo: mudar preço não pode invalidar 800 MB de varredura.

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
