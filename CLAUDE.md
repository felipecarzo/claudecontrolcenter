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
  cambio.mjs     cotação do dólar — uma das duas chamadas de rede do painel
  mercado.mjs    valor/hora de dev por senioridade, raspado de duas fontes
  tarefas.mjs    preço por problema resolvido: esforço, nível e valor
  historico.mjs  o que sobra depois que o CLI apaga o job
  uso.mjs        uso do plano (5h e semana), colhido do statusLine
  midia.mjs      o que está tocando e os controles; normaliza e cacheia
  midia.ps1      as duas APIs do Windows (SMTC + WASAPI), em processo vivo
  graficos.js    motor de gráficos: índice do que cruza com o quê, e o SVG
                 (servido em /graficos.js; não é módulo, roda no navegador)
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
cc done "tarefa"      # fecha um to-do sem reenviar a lista
cc check              # o hook Stop chama: avisa to-do aberto na entrega
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
  linha, `?tab=<id>` escolhe a aba, `?tema=claro|escuro` força o tema, e
  `?novo=1`/`?indice=1` abrem o construtor de gráficos e o índice de dados.
  Sem eles não dá pra ver o layout numa captura.
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
- **O pacote global é um LINK para este repositório, não uma cópia.** Medido em
  2026-08-08: `AppData/Roaming/npm/node_modules/claude-control-center` é um
  symlink para `D:\…\proj_controlcenter` — é o que `npm i -g <caminho-local>`
  faz. Três consequências que já enganaram:
  a) mexer em `src/` e rodar `cc daemon restart` **serve o código novo**, sem
     reinstalar (a versão antiga desta armadilha dizia o contrário, escrita na
     época em que se instalava de `github:…`, que aí sim é cópia);
  b) o painel de todo dia mostra o que está na ÁRVORE, inclusive trabalho de
     outra sessão ainda sem commit — separar o commit não separa o que roda;
  c) código quebrado no repo quebra o `cc` de todos os agentes na hora, porque
     é esse arquivo que eles chamam. Rode `npm test` antes de sair.
  Para validar isolado, suba numa porta própria: `node cc.mjs --web-only --port 8123`.
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
- **Nota tem backup porque já se perdeu uma vez.** Em 2026-08-09 o arquivo
  amanheceu com `{"notes": []}` e as duas listas do Felipe sumiram — sem que se
  conseguisse provar quem gravou. `writeNotes` agora copia a versão anterior
  para `.bak` antes de sobrescrever, e o apagamento TOTAL ganha uma cópia com
  data (`.apagado`), que a gravação seguinte não sobrescreve. Recuperar é
  copiar o `.bak` de volta. Não remover isso achando que é redundante: o dado
  é texto digitado à mão, não tem outra fonte.
- **Mídia são DUAS APIs do Windows, e cada uma faz metade.** `SMTC`
  (Windows.Media.Control) dá o que está tocando e o transporte — funciona com
  qualquer app do popup de mídia, do Spotify ao YouTube no Chrome. `WASAPI`
  (Audio Session API) dá o volume POR APLICATIVO, o mixer do Windows. SMTC não
  mexe em volume e WASAPI não troca de faixa: juntar as duas é trabalho do
  painel, e o casamento é por nome de processo normalizado. Quando não casa, a
  sessão fica sem controle de volume e o transporte continua.
- **`midia.ps1` roda como processo VIVO, e o motivo é medido.** O `Add-Type`
  compila o C# do WASAPI a cada execução: chamada avulsa leva ~18s, em processo
  persistente cai para ~0,5s. `platform.mjs` mantém o processo e conversa por
  stdin/stdout, uma linha por comando.
- **Mídia só funciona no Windows PowerShell 5.1, nunca no `pwsh` 7.** O 7 não
  tem projeção WinRT e a chamada de SMTC morre com "Operation is not supported
  on this platform". Trocar por `pwsh` quebra a barra inteira.
- **Vtable de interface COM erra em silêncio.** Um método a mais ou a menos em
  `IAudioSessionControl2` fez `GetProcessId` devolver 0 para tudo — seis
  processos "Idle", sem erro nenhum. Ela herda `IAudioSessionControl`, então
  `GetState` vem antes de `GetDisplayName`.
- **O PID do Chrome não é o processo maior.** O áudio fica num filho; escolher
  por consumo de memória pega o errado. O PID tem que vir da própria lista de
  sessões de áudio.
- **`[Console]::OutputEncoding` no ps1 não é enfeite.** Sem ele, título de
  música com acento chega como "m?dia" — o PowerShell 5.1 sai em code page do
  Windows, não em UTF-8.
- **O uso do plano vem do statusLine, não da API.** O Claude Code entrega
  `rate_limits.five_hour` / `.seven_day` no JSON que manda para o comando de
  statusLine, a cada resposta — é o número oficial, o mesmo do `/usage`. Por
  isso o painel **não** chama API nem lê `~/.claude/.credentials.json`, embora
  o endpoint exista (`/api/oauth/usage`, achado no bundle do CLI). Consequência
  a lembrar: o valor só anda quando o Claude Code responde algo; parado, o
  painel mostra a última leitura e a idade dela.
- **Não existe janela de uso do Fable.** Conferido no bundle: os tipos são
  `five_hour`, `seven_day`, `seven_day_opus` e `seven_day_sonnet` — zero
  ocorrências de qualquer `fable`. O próprio aviso do app explica por quê: o
  Fable consome da janela **semanal**, com teto de 50% dela, e mais rápido que
  o Opus. Dá para mostrar quanto de Fable foi gasto em token (a aba de tempo
  faz), mas não em "% do limite" — a conversão não é linear e seria invenção.
  As quatro janelas são capturadas; a conta do Felipe hoje só reporta duas.
- **`cc statusline --wrap "<comando>"` embrulha a statusline que já existe.**
  Só pode haver um comando de statusLine, então a captura executa a original e
  repassa a saída. Duas travas aprendidas na marra: timeout de 15s, porque a
  statusline do Felipe cai num `npx ccusage` quando o binário não está
  instalado e chega a travar; e uma linha mínima de fallback, porque barra
  vazia parece painel quebrado. Mexer nisso sem testar tira a barra da tela.
- **Tema é um bloco de variáveis, e `--acento` não é `--working`.** São seis
  (`noite`, `carvao`, `ambar`, `floresta`, `papel`, `areia`) e cada um só
  redefine as variáveis do `:root`. Duas regras ao criar mais: `dim` e `faint`
  precisam passar de 4,5:1 sobre o fundo — era daí que vinha o "difícil de
  ler", não do fundo escuro; e os cinco estados continuam distinguíveis entre
  si, porque são semânticos. O que muda de tema para tema é `--acento`, usado
  em foco, aba ativa e seleção; antes isso era o azul de "trabalhando", e por
  isso todo tema parecia azul. O gate confere que todo tema do CSS está na
  lista do seletor, e que nenhum hex é inválido — dois já entraram corrompidos
  (`#8manual` e um dígito devanagari no meio da cor), e o navegador ignora em
  silêncio.
- **Tag semântica dentro de componente colide com regra global de tag.** Os
  cartões de agente usam `<header>` e `<footer>` próprios, e as regras soltas
  `header { position:sticky; background:var(--bg); padding:14px 20px }` e
  `footer { padding:0 20px 28px }` pintaram uma faixa cinza dentro de cada
  cartão. Agora são `#painel > header` e `#painel > footer`. Vale para qualquer
  componente novo: ou escopa a regra global, ou não usa a tag.
- **Classe de estado solta pinta o que não devia.** `.s-working { background }`
  existia para a bolinha de status; quando o cartão passou a carregar
  `s-<status>` para colorir a borda, o fundo inteiro virou laranja com o texto
  ilegível dentro. Escopadas em `.dot.s-*`.
- **Os agentes não marcavam to-do, e a culpa era do protocolo.** Medido em
  2026-08-08: cinco jobs com `state: done` e **0 de 34** tarefas marcadas. O
  passo 3 do AGENTS.md pedia `status`, `links` e `blockers` na entrega — e não
  pedia `todos`. Quem seguia à risca entregava com tudo aberto. Três consertos,
  nessa ordem de importância: o texto (causa), `cc done "texto"` (o atrito de
  reenviar a lista inteira era o que fazia adiar) e o hook Stop (consequência).
- **O `state` do CLI vira `done` ao fim de CADA turno.** Usá-lo como gatilho do
  aviso faria o hook cobrar a cada resposta, inclusive no meio do trabalho. O
  gatilho certo é o `status` que o AGENTE escreveu no meta.json — `cc check`
  usa `metaStatus()` por isso, e não `job.status`.
- **`~/.claude/jobs` é efêmero.** O CLI apaga job antigo: em 2026-08-08 restavam
  9 de semanas de trabalho. `historico.mjs` copia o que foi lido para arquivo
  próprio a cada varredura, só quando muda. Sem ele, a aba de preço só enxerga
  a última semana — e continua valendo que nada é escrito dentro de `jobs/`.
- **Complexidade não é duração.** O peso da duração na classificação é o menor
  de todos, de propósito: tempo longo é tarefa GRANDE, e quem paga sênior paga
  por dificuldade — senão arrastar o trabalho viraria aumento. O que pesa mais
  é `reeditados`, voltar no mesmo arquivo, que é o sinal de que a primeira
  tentativa não resolveu. Há teste guardando isso (`longoESimples < medio`).
- **Os cortes de nível saíram dos percentis das 125 sessões reais**, não de
  terços iguais. A distribuição é bimodal (muita sessão curta de recado, muita
  longa de trabalho) e terços jogavam metade em sênior. Recalibrar exige olhar
  a distribuição de novo, não mexer no número até "parecer certo".
- **A aba de preço tem duas unidades porque as duas mentem diferente.** `todo`
  é a unidade certa mas depende de o agente marcar concluído — hoje são 0 de
  33 — e o job some quando o CLI limpa. `sessao` tem 125 amostras e tempo
  exato, mas uma sessão resolve mais de uma coisa, então a média por sessão é
  sempre maior que a média por problema. Nenhuma das duas é "a verdade".
- **`feitoEm` fica fora da lista de to-dos.** O agente reescreve `todos`
  inteiro a cada `cc set`, então carimbo dentro do item seria apagado na
  chamada seguinte. O mapa por texto sobrevive — e é o que vai acabar com o
  rateio por igual, mas só para o que for concluído daqui em diante.
- **`VERSAO_CACHE` em `tempo.mjs` existe para campo novo não nascer vazio.**
  Sessão antiga não vai ser reescrita para forçar releitura, então sem o número
  de versão um campo novo ficaria mudo para sempre justamente no histórico.
- **Raspar preço de mercado quebra, e a queda é em três camadas.** Duas fontes
  independentes, depois o último valor buscado, depois a tabela escrita no
  código. `faixasPlausiveis` recusa o que passa no regex mas não faz sentido —
  colunas invertidas dariam sênior mais barato que júnior, sem erro na tela.
- **Sobra usa a assinatura rateada, nunca o preço de API.** A primeira versão
  fez receita menos custo de API e deu "sobra de −R$ 19.504" no inovallbond —
  o Felipe paga assinatura, não tabela de API. O custo real é
  `assinaturaMes ÷ horas daquele mês`, aplicado mês a mês e não pelo período
  inteiro: mês parado deixa a hora cara, e isso é a verdade. Consequência a
  lembrar: filtrar meio mês infla o custo/hora daquele mês, porque o rateio só
  enxerga as horas dentro do recorte.
- **O motor de gráficos é um índice, não uma coleção de gráficos.** Cada medida
  declara sua FONTE (`tempo` ou `uso`) e cada dimensão em quais fontes existe.
  Horas não cruza com modelo porque o relógio não sabe qual modelo rodou, e
  token não sabe quanto tempo levou — o construtor recusa e explica, em vez de
  desenhar zeros. Medida que depende de configuração (`valor`, `sobra`) também
  é recusada com o que falta: sem isso, taxa zerada renderiza um gráfico vazio
  que parece "não trabalhei".
- **`graficos: null` e `graficos: []` são estados diferentes** no config. `null`
  é "nunca mexi" e mostra os prontos; `[]` é "apaguei todos" e fica vazio. Sem
  a distinção, apagar o último gráfico traria os oito prontos de volta.
- **O tema resolve `auto` no JavaScript, e o CSS só vê claro|escuro.** O bloco
  vai no `<head>`, antes do body: aplicado depois, a página pisca escura antes
  de clarear. `?tema=claro` existe para a captura, porque o headless não tem
  preferência de sistema nem localStorage.
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
