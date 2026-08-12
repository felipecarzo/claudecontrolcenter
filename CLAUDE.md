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
  servers.mjs    portas em escuta: o que cada uma é, apelido, favorito,
                 duplicados, subir de novo e as travas do encerrar
  docker.mjs     containers Docker desta máquina (docker ps), pro painel e o PiP
  vps.mjs        retrato da VPS por SSH — nginx, PM2, Docker — só sob clique
  config.mjs     interruptor global e por projeto
  notes.mjs      bloco de notas da máquina, em ~/.claude
  tempo.mjs      horas por projeto e custo de token, lidos dos transcritos
  cambio.mjs     cotação do dólar — uma das duas chamadas de rede do painel
  mercado.mjs    valor/hora de dev por senioridade, raspado de duas fontes
  tarefas.mjs    preço por problema resolvido: esforço, nível e valor
  historico.mjs  o que sobra depois que o CLI apaga o job
  uso.mjs        uso do plano (5h e semana), colhido do statusLine
  maquina.mjs    CPU e RAM do próprio Node, GPU do nvidia-smi
  roadmap.mjs    o ROADMAP.md do projeto virando mapa na tela
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

- **`CONFIG_FILE` não é isolado por porta.** Subir uma instância de teste com
  `node cc.mjs --web-only --port 8123` para não mexer no painel real (porta
  9099 do daemon) protege o processo, mas não protege o dado: `config.mjs`
  aponta sempre pro mesmo `~/.claude/control-center.json`, então escrever
  nele pela porta de teste escreve no arquivo que o daemon real também lê.
  Achado testando o CC-20 (calendário): um calendário de teste foi salvo no
  config de verdade do Felipe. Pra testar rota que ESCREVE config, ou aponta
  `CC_HOME`/variável equivalente pra um `.claude` isolado (não existe hoje —
  seria o conserto certo), ou remove cirurgicamente só a chave que o teste
  gravou depois, nunca restaura o arquivo inteiro de um backup — o daemon
  real pode ter escrito algo legítimo nesse meio-tempo, e restaurar por cima
  perde esse dado.
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
- **`.` no regex não casa `\r`, e isso zerou um parser inteiro.** O leitor de
  roadmap devolvia zero grupos em metade dos projetos: os arquivos são CRLF,
  e `(.+)\r` falha quando sobra um `\r` no fim da linha. Sem erro, sem aviso —
  só um mapa vazio. Dividir com `split(/\r?\n/)` é obrigatório aqui.
- **O cartão do agente mostrava a folha sem a árvore.** "Pierre: travessia
  gamificada" não dizia nada ao Felipe, embora "Pierre" seja uma seção do
  ROADMAP.md do inovallbond. Por isso existe `frente` no protocolo e o mapa
  lateral: o vocabulário da tela passou a ser o do roadmap dele, não o do
  agente. Ao mexer no cartão, manter o caminho projeto › frente visível.
- **CPU e RAM não precisam de WMI — o Node já dá.** A primeira versão dos
  módulos perguntava tudo ao WMI por PowerShell e levava 10s, com
  `Win32_PerfFormattedData_PerfOS_Processor` custando 3,2s sozinho. `os.cpus()`
  e `os.totalmem()` respondem o mesmo em 3ms, e ainda funcionam fora do
  Windows. Só a GPU precisa de processo externo (`nvidia-smi`, 590ms).
- **Uso de CPU é diferença entre duas amostras.** `os.cpus()` dá tempos
  acumulados desde o boot, não percentual. A primeira leitura devolve `null` de
  propósito — 0% diria que a máquina está parada. Por isso `estado()` tira uma
  amostra e espera 120ms na primeira vez, senão o módulo sumiria da tela ao abrir.
- **`quiet` é síncrono e trava o servidor.** Ele usa `execFileSync`: uma
  leitura de 1s congela o event loop inteiro, e com ele o stream dos agentes.
  Para qualquer coisa que alimente a tela existe `quietAsync`. Medido:
  `nvidia-smi` por `quietAsync` deixa um buraco de 32ms; a mesma consulta via
  WMI síncrona deixava 1,1s.
- **Temperatura de CPU e de RAM não existem no Windows sem programa externo.**
  Medido nesta máquina: `MSAcpi_ThermalZoneTemperature`, `root/Hardware
  NumericSensor` e `WMI_ThermalQuery` existem como classe e devolvem ZERO
  instâncias; os namespaces `root/Dell` e `root/Dell/DCIM` têm zero classes.
  Quem publica é o LibreHardwareMonitor, e só enquanto está aberto. A consulta
  a ele é tentada UMA vez por processo, adiada em 8s, porque trava ~1s — não
  adianta tentar de novo para quem não tem o programa.
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
- **O `state` do CLI vira `done` ao fim de CADA turno**, e isso já enganou a
  tela duas vezes. No `cc check`, faria o hook cobrar a cada resposta. Na aba
  de agentes, punha agente TRABALHANDO na faixa "prontos" — foi reclamação do
  Felipe, com razão. O discriminador é o SINAL: job encerrado para de atualizar
  `updatedAt`. Vivo com ferramenta rodando está trabalhando; vivo sem
  ferramenta acabou de responder e espera ele. Ver `statusReal()`.
- **O gatilho do `cc check` é o `status` que o AGENTE escreveu no meta.json**,
  não o `state` do CLI nem o `job.status` — por isso ele usa `metaStatus()`.
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
- **O caminho do servidor sai da linha de comando, e ela mente de três jeitos.**
  Medido em 2026-08-10, ao fazer a aba de servidores dizer o que cada processo
  é: (a) `node_modules\.bin\\..\next\dist\bin\next` tem barra DOBRADA, e o
  regex com `(?:\.bin[\\/])?` fazia backtrack e anunciava um servidor chamado
  ".bin" — por isso hoje se percorrem os segmentos pulando `.bin`, `..` e
  `dist`; (b) caminho do Windows com barra normal (`node D:/Documentos/...`)
  não casa `[A-Z]:\\`, e o padrão passava a casar no primeiro `/`, gravando um
  `cwd` sem a letra do drive — pasta que não existe, e ninguém avisa;
  (c) o trecho pode terminar num ARQUIVO (`.../app/dist/cli.js`), então "abrir
  a pasta do projeto" abria o `dist`. `soPasta()` tira o arquivo e as pastas de
  build. As três saem de `src/servers.mjs`.
- **Chave de servidor não pode ser o PID.** Apelido e favorito existem
  justamente para sobreviver ao `npm run dev` seguinte, e o PID muda nele.
  `chaveServidor()` usa caminho do projeto + porta mais baixa.
- **O rodapé do cartão de servidor não cabe seis botões.** Renomear, explicar,
  abrir e encerrar num `flex` sem `wrap` espremeram o "no ar há 43m" até virar
  quatro linhas verticais, e o `encerrar` saiu para fora do cartão. Ações de
  pasta e de edição moram em `.srv-onde`, acima do rodapé; o rodapé tem `wrap`
  e a idade tem `nowrap`.
- **Oferecer script de `package.json` num botão "subir" exige filtro.** Sem ele
  a lista mostrava `test` e `typecheck` do lado de `dev` — clicar rodaria a
  suíte achando que estava levantando o servidor. Só `dev|start|serve|preview|
  watch` entram, e pasta sem nenhum deles simplesmente não aparece.
- **`projetosLancaveis()` desce um nível quando a raiz não tem `package.json`.**
  Nos monorepos (`inovallbond/apps/app_pierre`) o servidor mora lá embaixo, e
  parar na raiz deixava justamente os projetos grandes de fora: eram 8 pastas
  na lista, viraram 22.
- **Taxa zero não é "de graça", é "não configurada".** `setTaxa(0, {projeto})`
  apaga a entrada em vez de gravar zero, e o projeto volta pra taxa global —
  senão não haveria como desfazer uma taxa específica. Pelo mesmo motivo a
  coluna de valor some quando ninguém tem taxa: uma tabela de R$ 0,00 em toda
  linha diz que o trabalho não vale nada. A taxa mora no `config.mjs`, nunca no
  cache de tempo: mudar preço não pode invalidar 800 MB de varredura.

- **Botão escondido esquecido = popover invisível fora da tela.** O `#pip-toggle`
  ficava visível, mas o `#pip-config-toggle` ao lado continuava `hidden` pra
  sempre — ninguém tirava o atributo dele. `getBoundingClientRect()` num
  elemento escondido devolve retângulo zerado, e posicionar o popover a
  partir dali manda ele pra fora da tela sem erro nenhum. Todo botão que só
  aparece com feature-detect (aqui, `documentPictureInPicture` no `window`)
  precisa dos DOIS `hidden = false`, não só o primeiro que se lembrou de tirar.
- **Popover com `top` fixo quebra quando o header muda de altura.** O player
  de mídia aparece e some, e o header é `position: sticky` com `z-index: 30`.
  Um popover com `top: 52px` e `z-index: 20` ficava ora certo, ora atrás do
  header (cortado), dependendo se o player estava tocando. Resolvido com dois
  ajustes: `z-index` acima do header, e posição calculada em JS a partir do
  `getBoundingClientRect()` do próprio botão, não um pixel chutado.
- **PiP com abas perdeu a visão "tudo junto", e isso era o ponto do recurso.**
  Ao dar abas por bloco (uso/agentes/máquina/...), cada aba virou exclusiva —
  e sumiu a leitura de relance que a janela flutuante tinha antes. Correção:
  aba "geral" (todos os blocos empilhados) sempre entra primeiro na lista e é
  o padrão de abertura, e só aparece quando há mais de um bloco ativo — com
  um só, ela seria idêntica à aba dele.
- **VPS por SSH é a única chamada de rede perigosa do painel.** Todas as
  outras (câmbio, `nvidia-smi`, `docker ps`) são inofensivas ou locais. Ler a
  VPS usa a chave privada do Felipe num processo que fica sempre religado no
  login — por isso `atualizarSnapshot()` só roda dentro de uma rota POST que
  o clique do botão aciona, nunca em `setInterval`. Achar isso errado depois
  e "só adicionar um timer" quebraria a promessa central do recurso.
- **O organograma da VPS liga nginx a Docker por NÚMERO DE PORTA, não por
  nome.** `proxy_pass http://127.0.0.1:3003` e o container que mapeia
  `127.0.0.1:3003->3000` batem pela porta 3003 — a de FORA do container, não
  a interna. PM2 fica de fora do cruzamento de propósito: `pm2 jlist` não
  expõe a porta que o processo escuta, então inventar o link seria mentira
  bonita. Melhor mostrar sem link do que linkar errado.
- **`quietAsync`/`execFile` não usa shell, e isso muda como testar.** Passar
  `chave` com barra invertida (`C:\Users\...`) direto num `node -e "..."` do
  Git Bash comeu as barras antes de chegar no Node — armadilha de quem está
  testando, não do código. `String.raw` num arquivo `.mjs` de verdade, sem
  passar pelo shell, é o jeito de confirmar se o bug é no seu código ou no
  jeito de invocar.

- **`Get-Process` de 596 processos varia entre 19s e 29,3s — mesma chamada,
  sem padrão.** Um timeout de 30s quase estourou numa execução real; corrigido
  pra 45s. A lição maior: quando o tempo medido está perto do limite dado
  (29,3s contra 30s), o limite está errado, não é "quase bom o suficiente".
  Por isso `processos.mjs` nunca roda em timer — nem 45s cabe num poll de
  fundo, só em ação sob clique (igual a VPS).
- **Um `null` intermitente parecia bug de parsing, era timeout.** A primeira
  leitura depois de reiniciar o painel às vezes vinha vazia; a hipótese óbvia
  era "saída do PowerShell veio suja". Era mais simples e mais chato: a
  chamada estava estourando o timeout de vez em quando, e `quietAsync`
  devolve `ok:false` em silêncio nesse caso. Testar a hipótese errada primeiro
  (parsing) não foi perda total — a defesa contra saída suja ficou, mas o
  fix de verdade era medir o tempo real da chamada isolada, não adivinhar.

- **Fita horizontal do PiP começou como texto corrido, e ficou ruim de
  verdade.** Primeira versão: `5h 20% · sem 87% · cpu 20%` — tudo na mesma
  cor, sem hierarquia, "·" como único separador. O Felipe reclamou olhando a
  janela de verdade. Virou pastilha (`.pip-chip`): fundo, borda colorida pela
  faixa (verde/amarelo/vermelho, reaproveitando os tokens de estado que já
  existem — `--done`/`--waiting`/`--failed`), agrupada por bloco com uma
  linha fina separando um bloco do outro. Pra revisar o design SEM abrir a
  janela de verdade (que exige gesto real do usuário, headless não serve):
  extrai o `<style>` do `ui.html`, cola numa página estática com os mesmos
  nomes de classe e um cartão de dado de exemplo, e tira print dessa página.

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
