---
tags: [produto, cockpit2, pesquisa]
tipo: pesquisa
para: o agente (documento de trabalho, não é leitura dele)
atualizado: 2026-09-11
---

# Cockpit 2: a pesquisa antes da tela

Documento de trabalho da rota `cockpit2` (sessão 0174a7a8). Ele pediu que fosse
escrito **para mim**, não para ele. A leitura dele é a seção 9 e a 10, e mesmo
assim resumidas na conversa. O resto é o raciocínio, guardado.

Regra de método que ele deu e que governa o arquivo: **dez partes, e entre
uma parte e outra reler a seção 0**, para a pesquisa não escorregar para longe
do que ele pediu. A seção 0 é a âncora. Quando uma parte parecer interessante
e não responder a nada da seção 0, ela sai.

---

## 0. O pedido dele, palavra por palavra (a âncora)

Mensagem de 11/09, ditada, reenviada igual depois de uma interrupção. Os
pedidos, numerados e já no backlog (CC-482 a CC-490):

1. *"faça uma pesquisa de todos os dados que temos controle e que recebemos no
   cockpit e escreva um documento com isso (pra voce mesmo, nao p mim)"*
2. *"avalie como os dados podem afetar a rotina de um humano desenvolvedor"*
3. *"o kanban ta otimo, as abas de tempo, etc, até estão boas, daria p melhorar
   mas estão boas"*
4. *"a aba servidores sumiu, e era muito pratica pq eu via os servidores
   abertos na vps e no desktop"*
5. *"essa separação entre vps e desktop, quando na verdade é como se o
   framework na verdade fosse o sistema e a vps e o desktop são apenas
   dispositivos que executam o framework. o framework é ou deveria ser o
   nucleo. entao eu queria que o framework centralizasse os projetos, ex:
   vps_inovallbond e pc_inovallbond são o mesmo projeto, inovallbond, então em
   projetos por exemplo nao é pra ter essa diferenciação, o projeto é um só, e
   quando ele ta ativo no pc fica escrito alienware ali ou outro nome do pc ali
   do lado do projeto, se for VPS fica escrito vps, e se for ambos beleza, fica
   escrito ambos"*
6. *"a tela de projetos, os projetos sao enormes e super mal feitos, eles
   precisam colapsar e abrir em uma aba lateral de repente quando forem
   selecionados, com as informacoes mais bem posicionadas. cada projeto pode
   ter N sessoes, pode ter coderoom na vps, pode ter agy na vps, pode ter
   claude code na vps, e pode ter tudo isso tambem no desktop, entende? Entao
   sao infinitas possibilidades"*
7. *"o painel dashboard central podia ser um combinado de coisas uteis pra mim
   e nao tem nada"*
8. *"esses recados como 'precisam de voce' perdem o apelo quando eu clico e o
   texto é vago, nao diz nada, só texto de ia perdido, e dai eu passo a ignorar
   e nunca clico. ou seja, tem muitas paginas assim que eu nunca olho, e isso é
   extremamente broxante"*
9. O método: *"avalie com o fable, pense com calma, verifique na internet
   muitas referencias de paineis de controle profissionais, que focam em
   desempenho, estude os padroes que apple desenvolve, e tambem o que outros
   frameworks usam de fundamento e tente iterar na pesquisa, nao deixe ela ser
   rasa, busque outras referencias, crie hipoteses, crie teses e antiteses e
   confronte-as, se coloque na posicao de um desenvolvedor em solucoes senior e
   faça muitos testes, vamos criar o painel perfeito. obs: anote tudo isso e
   abstraia o necessario mas nao perca nada, divida a pesquisa em umas 10
   partes, e no intervalo dessas partes olhe novamente a mensagem pra
   recentralizar o conceito da pesquisa"*

Decisões dele já tomadas antes desta mensagem, e que valem aqui:

- 10/09: *"o design do cockpit antigo pode ficar, na verdade pode duplicar
  tudo do antigo nesse quesito, ele ta muito bom, o problema dela é que as
  informações jogadas acabam perdendo o sentido"*. **O desenho não muda. O que
  muda é o dado e onde ele fica.**
- 11/09 (pergunta direta nesta sessão): cockpit 2 é o MESMO trabalho da tela
  nova, com nome novo; roda como rota `/cockpit2` no mesmo servidor, em paralelo
  ao painel de todo dia, até substituí-lo.
- 16/08 (método dele): para DECIDIR, o protótipo é inteiro; para EXECUTAR, é em
  micro-tarefas que cabem numa linha do painel com resultado conferível.

Onde cada pedido é respondido: 1 → seção 1 · 2 → seção 2 · 3 e 4 → seção 3 ·
5 → seção 4 · 6, 7 e 8 → seções 3, 8 e 9 · 9 → seções 5 a 8, e o formato do
arquivo inteiro.

---

## 1. Inventário: o que o cockpit controla e recebe

Medido em 11/09 no painel real do PC (porta 8099), rota por rota, com o
formato de verdade da resposta e não o que o código promete. Ver o script em
`~/.claude/jobs/0174a7a8/tmp/inventario.mjs` (morre com o job).

### 1.1 As fontes brutas (de onde tudo nasce)

Nada é digitado no painel, salvo três coisas (notas, documentos, as tarefas
dele). O resto é DERIVADO de sete lugares:

| fonte bruta | o que dá | quem lê | custo/frescor |
|---|---|---|---|
| `~/.claude/jobs/*/state.json` + `meta.json` | os agentes em background: estado, pedido, to-dos, frente, links, bloqueios | `jobs.mjs` | grátis, a cada 2s |
| `~/.claude/projects/**/*.jsonl` (transcritos) | sessões interativas, último pedido dele, tempo ativo, tokens, travas disparadas, fila perdida, sinais de rajada/repetição | `sessoes.mjs`, `transcript.mjs`, `tempo.mjs`, `travas.mjs`, `fila.mjs`, `coletores.mjs` | cauda barata (256 KB); varredura inteira cara (800 MB, ~3s a 17s), por isso cache por tamanho+mtime |
| statusLine do Claude Code | uso do plano (5h, semana) | `uso.mjs` | só anda quando o Claude responde |
| o disco dos projetos (`docs/ROADMAP.md`, `docs/backlog.jsonl`, `docs/ROTAS-ATIVAS.md`, `.framework/estado.json`, `docs/.recados.json`, `.claude/commands`, `package.json`, `.git`) | backlog e frentes, rotas e tickets, fase e MVP do framework, recados, rotinas, scripts de subir, estado do git | `roadmap.mjs`/`backlog.mjs`, `rotas.mjs`, `frameworkDisco.mjs`, `recados.mjs`, `rotinas.mjs`, `projetos.mjs`, `git.mjs`/`sincronia.mjs` | leitura de arquivo; git é spawn e fica sob clique |
| o sistema operacional (`netstat`/portas, `docker ps`, `os.cpus()`, `nvidia-smi`, `Get-Process`, SMTC/WASAPI) | portas em escuta e o processo dono, containers locais, CPU/RAM/GPU, top processos, mídia tocando | `servers.mjs`, `docker.mjs`, `maquina.mjs`, `processos.mjs`, `midia.mjs` | portas ~1,7s (cache 15s); docker 138ms; máquina 268ms; processos 19 a 29s (só sob clique) |
| a outra máquina (federação: o PC EMPURRA um pacote para a VPS a cada 30s) | jobs, uso, tempo, portas, rotas, backlogs, travas e framework da outra máquina | `federacao.mjs`, `travasDaMaquina.mjs` | **só chega na VPS**. O PC não recebe nada de volta: `pacotes: []` medido hoje |
| SSH na VPS (sob clique) | nginx, PM2, Docker de lá, RAM, disco | `vps.mjs`, `vpsSaude.mjs` | snapshot gravado. **O de hoje é de 16/08: 26 dias velho** |
| rede | câmbio (AwesomeAPI), valor/hora de mercado (raspagem), agenda (iCal) | `cambio.mjs`, `mercado.mjs`, `calendario.mjs` | 12h / 7 dias / 15 min de cache; agenda não configurada aqui |
| `~/.claude/control-center-*.json` (do painel) | notas, tarefas dele, histórico de jobs, armazém de medidas, config, visitas | `notes.mjs`, `meu.mjs`, `historico.mjs`, `armazem.mjs`, `config.mjs` | grátis |

### 1.2 O que cada rota devolve hoje (formato real, medido)

Só as que a tela usa. Tamanho e tempo são do PC em 11/09, com 18 agentes vivos.

| rota | tamanho / tempo | o que traz, de verdade |
|---|---|---|
| `/api/jobs` (e o SSE) | 57 KB / 67ms | `jobs[18]` com 40 campos cada (id, status, subject, frente, project, model, tokens, detail, lastPrompt, todos, blockers, links, updatedAt, idleMs, stale, sessionId…), `summary`, `cockpit` (projetos por urgência), `uso`, `maquinas[1]`, `tem: {vps, escritorio}` |
| `/api/trabalho` | **291 KB / 2,4s** | `grupos[15]` (projeto → cartões do backlog), `pendencias[36]` dele, `soltos[3]` (agente com frente que não existe no backlog), `veredito.frase` ("4 agentes esperando você, 31 c…"), `desdeQueOlhei.marcos[60]` |
| `/api/cockpit` | 4 KB / 24ms | os projetos ordenados por peso, com `esperando[]` e `motivo.frase` |
| `/api/projetos/painel` | 12 KB / 2,5s | `projetos[29]` com 25 campos (ligado, agentes, vivos, ociosos, esperando, backlog, frentes, soSeus, **tambemEm**, horasHoje, horasTotal, custoBrl, visto, maquinaDeFora, daqui) |
| `/api/servers` | 23 KB / 1,7s | `servers[34]` (inclui `services.exe` e outros protegidos do Windows), `duplicados[1]` (inovallbond com dois `next`), `recentes[12]` |
| `/api/docker` | 3 KB / 138ms | `containers[21]` locais |
| `/api/federacao` | 17 KB / 38ms | `maquinas[1]` (só esta), `empurrando.ok`, `pacotes: []` |
| `/api/framework/projetos` | 87 KB / 3,2s | `projetos[28]` com modo, fase, MVP, pendências, rotas, módulos, git |
| `/api/rotas` | 135 KB / 70ms | `projetos[4]` com `rotas[51]`, `tickets[27]`, `esperando 18`, `cruzamentos` |
| `/api/travas` | 139 KB / 455ms | `eventos[80]`, `placar[14]` (**"sem nome" 334 vezes**), `regras[42]` |
| `/api/meu` | 13 KB / 53ms | `tarefas[36]`, `abertas 31` |
| `/api/tempo` | 65 KB / 29ms | `projetos[24]` com dias, sessões, uso, custo, **porMaquina** |
| `/api/tarefas` | 146 KB / 188ms | 167 tarefas com preço, nível, tempo rateado |
| `/api/vps` | 7 KB / 31ms | snapshot de 16/08 + `saude.frase` |
| `/api/maquina` | 294 B / 268ms | cpu 26%, ram 83%, gpu |
| `/api/escritorio` | 6 KB / 35ms | 18 agentes com `ccRotas`, `ccArquivos` |
| `/api/sincronia` | 9 KB / 2,6s | 28 projetos: branch, aEnviar, aReceber, soltos |
| `/api/recados` | 3 KB / 15ms | os 5 tipos e os recados do projeto |
| `/api/conexao` | 34 KB / 7ms | 200 envios à VPS, 120 na última hora, 0 falhas |
| vazios ou mortos hoje | | `/api/roadmap` (vazio sem projeto), `/api/graficos` (null), `/api/armazem` (vazio), `/api/gate/conversas` ([]), `/api/calendario` (não configurado), `/api/glossario` ([]), `/api/quadro-projetos` ([]), `/api/agy-remote-control` (spawn falha) |

### 1.3 Os campos que a tela PRECISA e que não existem

Achados lendo o modelo, não a tela:

1. **Não existe "a última fala do agente".** O job carrega `lastPrompt` (o
   último pedido DELE), `intent` (o primeiro), `detail` (o status que o agente
   escreveu, geralmente "trabalhando") e `blockers`. A pergunta que o agente
   fez ao parar, a caixa de opções do AskUserQuestion, a frase final da
   resposta: **nada disso é lido**. `transcript.mjs` só tem `lastPrompt`,
   `firstPrompt`, `humanMessagesTail`. É a causa raiz do pedido 8: o cartão
   "precisa de você" mostra `a.subject` (3 a 6 palavras do assunto) e um rótulo
   fixo ("PRECISA DA SUA DECISÃO"), porque não tem o que mais mostrar.
2. **Não existe "o projeto" como entidade.** Existe a pasta de cada máquina.
   `nomeProjeto.mjs` já sabe comparar (`chaveDeProjeto` tira `VPS_`/`pc_`) e
   `projetos.mjs` já casa os pares (`tambemEm`), mas o par vira DOIS cartões
   com um aviso, não UM projeto com dois dispositivos.
3. **Não existe "os servidores da outra máquina" no PC.** O pacote leva portas
   do PC para a VPS. Na VPS a lista federada existe. No PC, `maquinas[1]`.
   O que ele lembra ("eu via os servidores abertos na vps e no desktop") era
   visto **na VPS**, ou pela aba VPS (snapshot por SSH, hoje de 26 dias).
4. **Não existe "tipo de sessão" unificado.** Claude Code em background
   (jobs), interativo (transcrito), Remote Control (`remotecontrol.mjs`),
   Coderoom (opencode, `gate*`), agy: cada um com módulo e formato próprio.
   `sessoes.mjs` já normaliza interativa no formato do job (`tipo:
   'interativa'`), e é o único ponto de fusão que existe.

---

*(reli a seção 0 aqui)*

## 2. A rotina de um desenvolvedor humano, e o que cada dado muda nela

Ele é um só, e trabalha de um jeito medido (CICLO.md, 235 mensagens): 4 a 5
projetos em paralelo, mensagens curtas para executar e longas para pensar,
confere no telefone na rua, não confia em relatório, pede prova visual. Os
agentes trabalham enquanto ele não está olhando. O painel é o lugar em que ele
**volta**, não onde ele fica.

Os momentos, e a pergunta de cada um:

| momento | a pergunta dele | o dado que responde | hoje responde? |
|---|---|---|---|
| abre o painel (manhã, ou voltando) | "alguém está me esperando? em quê?" | agentes `waiting` + **a pergunta que cada um fez** + pendências dele com prova | metade: sabe QUEM, não sabe O QUÊ (1.3.1) |
| no mesmo minuto | "tem alguém trabalhando pra mim agora?" | `working` + ferramenta em voo + frente | sim (faixa RODANDO) |
| escolhe onde mexer | "em que pé está cada projeto?" | item do backlog em curso, quem está nele, o que falta, onde está rodando (pc/vps/ambos) | sim no kanban; **não** o "onde" |
| vai subir um app ou abrir um link | "que porta é a do X? está no ar? aqui ou lá?" | servidores por projeto, com dispositivo | no PC só o PC; na VPS os dois; e a aba sumiu do menu (3.2) |
| dá uma ordem curta | "foi?" | prova (link, print, teste) no cartão | parcial: `links[]` existe, pouco usado |
| repete um pedido | "por que não entendeu?" | sinal de repetição (`sinais.repeticao`) | existe e é bem escondido |
| fim do dia / semana | "o que produzi? quanto custou? quanto vale?" | tempo, custo, tarefas, digest | sim (Tempo, Custo) |
| de vez em quando | "as regras ainda valem? os hooks estão instalados?" | travas, instalação, rotinas | sim, mas em telas separadas |

O que a tabela diz: **as duas primeiras linhas são o painel central.** É o
que ele chamou de "combinado de coisas úteis" (pedido 7). Tudo o mais é
tela de segundo nível, e ele mesmo disse que várias estão boas (pedido 3).

A regra que sai daqui, e é a mesma dos painéis de operação (seção 7): o
central é **operacional** (o que exige ação agora, dado ao vivo); o resto é
**analítico** (histórico, tendência, custo). Misturar os dois é o que faz a
tela central "não ter nada": ela tenta ser as duas coisas e fica vaga.

---

*(reli a seção 0 aqui)*

## 3. Diagnóstico das telas de hoje, medido

### 3.1 O que ele disse que funciona (manter, e não "melhorar" sem pedido)

- **Kanban** (`view-trabalho`, `trabalho.mjs`): a unidade é o item do backlog,
  o cartão anda sozinho pelo eixo do trabalho. *"ta otimo"*.
- **Tempo** (`view-tempo`, `tempo.mjs`): horas ativas por projeto, custo,
  corte escolhido por quem olha. *"boas"*.
- O desenho (cores, cartões, tipografia): *"ele ta muito bom"*.

### 3.2 A aba servidores não sumiu: mudou de nome e de andar

Medido no painel que ele abre na raiz (`/`, que serve `ui_novo.html`):

- `view-servidores` existe (linha 2826 do v2, 3431 do cockpit2) e funciona.
- No menu lateral **não há item "Servidores"**. O que há é **"Máquinas"**
  (`view-infra`), e dentro dele quatro botões: "esta máquina", **"portas"**,
  "containers", "a VPS por dentro".
- Ou seja: a coisa que ele chamava de *servidores* virou um sub-botão chamado
  *portas*, dentro de uma tela chamada *Máquinas*. Duas traduções de nome e um
  nível a mais. É a peça inalcançável do CLAUDE.md, no formato mais discreto:
  alcançável por um clique que ele não tem motivo para dar, porque o rótulo
  não é a palavra dele.
- E a metade "na VPS" da frase dele depende do snapshot SSH, de 26 dias atrás,
  ou de olhar o painel DA VPS. No painel do PC não existe lista federada de
  portas, porque o PC não recebe pacote.

### 3.3 "Precisam de você" é vago por construção

Lido em `renderAgora()` (cockpit2, linha 4334) e `porQueEspera()` (3889):

- o cartão mostra: rótulo fixo (AGENTE TRAVADO / ENTREGA EM ABERTO / PRECISA
  DA SUA DECISÃO), `projeto / frente`, **`a.subject`** (o assunto de 3 a 6
  palavras), "há Xmin", botão "Abrir agente";
- quando é decisão (o caso comum), a frase de apoio é `Último pedido:
  <lastPrompt>`, que é **o que ELE mesmo escreveu**, não a pergunta do agente;
- a pergunta do agente não está em campo nenhum (1.3.1).

Então ele clica, lê o próprio assunto de volta, e não sabe o que decidir. É o
que ele descreveu: *"o texto é vago, não diz nada"*. Não é texto de IA ruim, é
dado errado no lugar.

Regra dos painéis de operação (seção 7, SRE): **notificação sem ação possível
não deveria existir**. Aqui a ação existe (responder o agente), mas o cartão
não diz qual é. A correção é de dado, antes de ser de tela.

### 3.4 O projeto é gigante porque é plano

`/api/projetos/painel` traz 25 campos por projeto e a tela desenha os 25 no
cartão, mais gavetas (framework, agentes). Sem seleção, sem hierarquia entre
"o que decide" (está ligado? alguém espera? em que frente?) e "o que é
consulta" (horas totais, custo, visto pela última vez). É o pedido 6, e a
resposta de arquitetura é a seção 6 (lista + inspetor lateral).

### 3.5 As telas que ninguém olha, e por quê (medido em 10/09 pela outra sessão)

Dez itens de menu foram escondidos por CSS no protótipo, com motivo medido:
Meu painel (zero painéis criados), Agentes (vira gaveta de Projetos),
Escritório (painel externo), Custo e Gráficos (gaveta de Tempo), Agenda (não
configurada), Conhecimento (Documentos vazio), Framework (duplicado no cartão
do projeto), Hooks e Rotinas (gaveta de Ajustes). Ficaram dez: Cockpit, Agora,
Projetos, Trabalho, Rotas, Coderoom, Análise, Tempo, Máquinas, Ajustes.

Dado que corrobora: `/api/graficos` devolve `null`, `/api/armazem` vazio,
`/api/gate/conversas` vazio, `/api/glossario` vazio, calendário não
configurado. **Tela com fonte vazia é tela que ensina a não olhar**, e uma
vez ensinado ele para de olhar as cheias também (pedido 8, última frase).

### 3.6 Outros números que pesam no desenho

- `/api/trabalho` custa 2,4s e 291 KB a cada visita: o kanban que ele gosta
  está em cima da rota mais pesada. Cockpit 2 não pode piorar isso.
- 18 agentes vivos neste PC, 11 ociosos: a lista de agentes é longa e a maior
  parte é ruído quando a pergunta é "quem me espera".
- O placar de travas tem "sem nome" 334 vezes: dado que a tela mostra e não
  explica.
- 36 pendências dele, 31 abertas, algumas paradas há 11 dias: a lista dele
  apodrece, e lista podre ensina a ser ignorada (lição registrada no
  `tarefasProva.mjs`).

---

*(reli a seção 0 aqui)*

## 4. O modelo: o framework é o núcleo, as máquinas são dispositivos

A frase dele, reduzida a modelo:

```
Framework (o sistema: método + regras + backlog + agentes)
 └─ Projeto (um só: inovallbond)
     ├─ presença: onde ele está vivo agora  → alienware | vps | ambos | nenhum
     ├─ Frentes e itens do backlog (docs/backlog.jsonl ou ROADMAP.md)
     ├─ Sessões (N): tipo ∈ {claude code bg, claude code interativo,
     │   remote control, coderoom/opencode, agy} × dispositivo ∈ {alienware, vps}
     ├─ Serviços no ar: portas e containers, por dispositivo
     ├─ Pendências dele (só ele resolve), com prova
     ├─ Rotas e tickets (quem segura o quê)
     └─ Fase/MVP/modo do framework (estado.json)
Dispositivo (alienware, vps): CPU/RAM/GPU, contato, uso do plano, git da cópia
```

Uma palavra a desambiguar com ele, na regra 2 do ciclo: no código, "framework"
é o motor de método (`framework.mjs`: fases, MVP, modos). Na frase dele,
"framework" é **o sistema inteiro** que o cockpit mostra. Não é conflito, é
escopo: o modelo acima usa o sentido dele, e o motor de método é um dos filhos.

### 4.1 O que já existe, e o que falta, para o projeto ser um só

| peça | existe? | onde |
|---|---|---|
| comparar nomes de máquinas diferentes como o mesmo projeto | sim | `nomeProjeto.chaveDeProjeto` |
| achar o par local + remoto | sim | `projetos.mjs`, `tambemEm` (linhas 340-345) |
| uma entidade "projeto" com a lista de dispositivos | **não** | vira dois cartões |
| presença (alienware / vps / ambos) como campo | **não**, derivável de `maquinas` do job/sessão e de `semContato` | |
| sessões de todos os tipos numa lista só | metade | `sessoes.mjs` funde bg + interativa; coderoom e agy ficam fora |
| serviços (portas, containers) por projeto e por dispositivo | metade | `servers.mjs` casa porta → projeto; falta o lado da outra máquina no PC |

### 4.2 A restrição que muda tudo: só a VPS vê as duas máquinas

Topologia medida (`federacao.mjs`, e hoje `pacotes: []` no PC): o PC empurra
para a VPS; a VPS nunca alcança o PC. Então:

- **o painel completo, com "ambos", só existe na VPS** (`cockpit.carzo.com.br`);
- no PC, "ambos" só é possível se o PC **puxar** o retrato federado da VPS (uma
  rota da VPS já devolve `maquinas[]`; falta o PC consumi-la, com a mesma
  sessão do `cockpit-auth`).

Isso é decisão dele, e vai para a seção 8 como tese/antítese. O padrão que
ele mesmo escolheu em 30/08 (CC-440) aponta o rumo: *"o PC vira coletor e a
VPS vira o cérebro"*.

---

*(reli a seção 0 aqui)*

## 5. Referências de painéis profissionais (o que cada um ensina)

Lido em 11/09. Resumo do que serve aqui, não da ferramenta.

- **Grafana** (guia oficial de boas práticas): painéis em **hierarquia com
  drill-down**: um painel de visão geral leva ao painel do serviço, que leva
  ao do nó, passando a variável, "em três cliques sem reformular nada". Visual
  hierarchy; o olho varre em Z, o que importa fica no canto superior esquerdo;
  uma linha por serviço, na ordem do fluxo. E a "maturidade": quase todo mundo
  começa sem estratégia de painel e acumula telas que ninguém abre. ([Grafana
  best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/))
- **Railway**: um grafo de serviços por projeto, recurso por serviço, "clean,
  fast". **Vercel**: previews e histórico de deploy na frente, o resto atrás.
  Os dois são "um projeto → seus serviços", nunca "uma máquina → seus
  projetos". ([comparação](https://getautonoma.com/blog/railway-vs-vercel))
- **Linear**: opinado, rápido, teclado primeiro; "fast instead of flexible,
  opinionated instead of configurable". Tira o drag-and-drop livre em favor de
  fluxo estruturado. Velocidade é recurso, não detalhe. ([Linear Method](https://www.figma.com/blog/the-linear-method-opinionated-software/),
  [por que venceu](https://www.spyglassci.com/blog/why-linear-won-project-management))
- **Lens (Kubernetes)**: lista à esquerda por tipo de recurso, e ao clicar
  **o detalhe desliza pela direita em sobreposição**, com métricas, propriedades
  e eventos rolando dentro dele. É exatamente o pedido 6. ([Lens](https://www.howtogeek.com/devops/how-to-visualize-your-kubernetes-cluster-with-the-lens-dashboard/))
- **Tailscale (admin console)**: a aba "Machines" é UMA lista de dispositivos
  com status ao vivo, e "Services" é UMA lista de serviços do tailnet inteiro,
  com o dispositivo como coluna, nunca como aba. ([Tailscale services](https://tailscale.com/kb/1100/services))
- **Raycast / Warp / command palette**: uma superfície de teclado para ir a
  qualquer lugar; layout "lista + prévia à direita" para conteúdo rico.
  ([padrão](https://uxpatterns.dev/patterns/advanced/command-palette))

O que os seis têm em comum, e é a tese central da seção 8: **a unidade é o
objeto de trabalho (projeto, serviço, issue), a máquina é atributo**, e o
detalhe abre ao lado da lista sem trocar de tela.

---

*(reli a seção 0 aqui)*

## 6. Os padrões da Apple (HIG) que se aplicam

Lido no HIG e nas sessões de WWDC25/26 referenciadas em 11/09.

- **Clareza, deferência, profundidade.** A interface serve o conteúdo e não
  compete com ele; camadas e movimento dizem a hierarquia. ([princípios](https://uxcel.com/lessons/design-principles-of-apple-platforms-037))
- **Split view em três painéis**: sidebar (navegação de primeiro nível) →
  lista (os itens da coleção escolhida) → detalhe do item. Mail no iPadOS é o
  exemplo canônico. Em largura regular, usar split view; em largura compacta,
  vira navegação empilhada (a lista vira tela, o detalhe vira tela). ([Split
  views](https://developer.apple.com/design/human-interface-guidelines/split-views),
  [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars))
- **Inspetor**: "mostra os detalhes do que está selecionado". Controles
  pequenos e densos cabem nele (o HIG diz isso explicitamente para os tamanhos
  mini/small/medium). É o "aba lateral quando selecionado" do pedido 6, com
  nome de Apple. ([WWDC25 design system](https://developer.apple.com/videos/play/wwdc2025/356/))
- **Tab bar embaixo no telefone, sidebar no desktop**, e o sistema converte
  sozinho. O cockpit já tem os dois (barra de baixo em 390px, lateral em
  largo). Manter.
- **Sidebar é navegação entre áreas, não lista de tudo.** O HIG separa "áreas
  do app" (sidebar) de "coleções" (lista). O menu de 20 itens misturava os dois
  níveis; o corte para 10 foi na direção certa, e a seção 9 vai a 7.

---

*(reli a seção 0 aqui)*

## 7. Fundamentos de fora da Apple

- **Stephen Few, Information Dashboard Design**: painel é "a exibição visual
  da informação mais importante para alcançar um ou mais objetivos,
  consolidada numa única tela, para ser monitorada de relance". Uma tela, sem
  rolagem, olhado todo dia; o resto não é dashboard, é relatório. Agrupar em
  blocos com sentido, o mais importante em cima à esquerda, e "apontar rápido o
  que merece atenção e pode exigir ação". ([resenha](https://www.uxmatters.com/mt/archives/2007/04/book-review-information-dashboard-design.php),
  [o que não é dashboard](https://www.datarocks.co.nz/post/data-viz-bookshelf_information-dashboard-design-stephen-few))
- **NN/g, progressive disclosure**: o que é usado com frequência vai no
  primeiro nível; **no máximo dois níveis** ("além de 2, o usuário se perde");
  se precisa de três, simplifique o desenho. Decidir o corte por frequência de
  uso E observação, porque analytics não separa "quis" de "clicou por engano".
  E: operacional (ao vivo, decisão rápida) ≠ analítico (histórico, tendência).
  ([progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/))
- **Tufte**: data-ink, tirar o que não informa; sparklines "do tamanho de uma
  palavra" dentro da linha da tabela; small multiples com o MESMO eixo. Serve
  para a linha do projeto na lista: horas hoje como sparkline, não como número
  solto. ([data-ink](https://www.thedataschool.co.uk/calvin-gao/what-is-the-data-ink-ratio/))
- **Rob Ewaschuk, "My Philosophy on Alerting" (Google SRE)**: toda página
  (alerta) tem que ser **urgente, importante, acionável e real**; alertar em
  **sintoma** ("pedidos caindo"), não em causa ("CPU alta"); causa vai no
  painel, não no alerta. ([o texto](https://docs.google.com/document/d/199PqyG3UsyXlwieHaqbGiWVa8eMWi8zzAn0YfcApr8Q/mobilebasic))
- **Alert fatigue**: "se não há ação a tomar, o alerta não deveria existir";
  níveis (acordar alguém ≠ ler amanhã); enriquecer com contexto para que quem
  lê saiba o que fazer sem cavar log; dedup. ([PagerDuty](https://www.pagerduty.com/resources/digital-operations/learn/alert-fatigue/),
  [VictoriaMetrics](https://victoriametrics.com/blog/alerting-best-practices/))

A tradução para o cockpit é uma regra só, e ela vale para o cartão "precisa de
você", para a pendência dele e para qualquer contador vermelho:

> **Todo aviso diz o quê, de quem, o que ele faz a respeito, e em quanto
> tempo isso apodrece. Sem os quatro, não é aviso, é ruído.**

---

*(reli a seção 0 aqui)*

## 8. Teses e antíteses, confrontadas

Cada par com veredito. Onde o veredito é DELE, fica marcado.

**T1. "O painel central deve mostrar só o que exige ação."**
Antítese: um painel só de alertas fica vazio na maior parte do tempo, e
vazio parece quebrado (armadilha registrada: "bloco vazio precisa dizer por
quê"). *Veredito*: o central tem DUAS metades fixas, nunca vazias: **o que me
espera** (ação, pode ser "ninguém", dito com todas as letras e com a hora da
leitura) e **o que está rodando** (estado, com projeto, dispositivo, frente e
ferramenta). Mais uma terceira faixa curta de contexto (uso do plano, máquinas
com contato, serviços no ar). Nada de histórico ali.

**T2. "Projeto é um só; máquina é atributo."**
Antítese: `VPS_cockpit--front` é outra pasta, outra branch, outro roadmap
(registrado em `nomeProjeto.mjs`); fundir demais mistura backlogs. *Veredito*:
fundir pela chave que já existe (tira só `VPS_`/`pc_`, mantém sufixo), e
mostrar a presença ao lado: `inovallbond · alienware + vps`. Backlog, quando
diverge entre as cópias, vira aviso dentro do projeto ("as duas cópias do
roadmap diferem"), não dois projetos.

**T3. "Um projeto abre num inspetor lateral, a lista fica."**
Antítese: no telefone (390px) não há lado; e o `render()` de 2s recria nós.
*Veredito*: split view no largo (lista à esquerda, inspetor à direita, como
Lens e Mail), tela empilhada no estreito (a lista vira tela, o projeto vira
tela, com voltar). O inspetor é um container próprio, pintado com `pintar()`
e nunca recriado enquanto tem foco. Dentro dele, ordem fixa: **presença e
quem espera → sessões (todas, por tipo e dispositivo) → serviços no ar →
backlog em curso → pendências dele → o resto em gavetas**.

**T4. "Servidores volta como aba de primeiro nível."**
Antítese: a outra sessão juntou quatro telas em "Máquinas" porque "a pergunta
era uma só". *Veredito*: as duas coisas. O nome volta a ser **a palavra
dele** ("Servidores"), e a lista é UMA, federada, com o dispositivo como
coluna (padrão Tailscale): projeto, porta, dispositivo, desde quando, abrir,
encerrar. Containers entram na mesma lista com um tipo. CPU/RAM/GPU e "a VPS
por dentro" ficam no inspetor de cada dispositivo, não em abas.

**T5. "O PC precisa ver a VPS."**
Antítese: a topologia é torta, o PC não é servidor, e ele abre o painel da
VPS pelo telefone de qualquer jeito. *Veredito*: **decisão dele**. Duas
saídas: (a) cockpit 2 nasce na VPS como painel completo e o PC mostra "só
esta máquina" com aviso claro; (b) o PC puxa o retrato federado da VPS a cada
30s (uma rota, uma sessão do auth). A (b) é o que faz "ambos" existir no
desktop. Recomendação: (a) primeiro, (b) como item seguinte.

**T6. "Se a fonte está vazia, a tela não existe no menu."**
Antítese: tela escondida vira peça inalcançável quando a fonte encher.
*Veredito*: a tela existe pelo endereço e aparece no menu **quando tem dado**,
com a contagem ao lado (padrão que o próprio painel já usa em Conhecimento).
Menu de 7 fixos; o resto é condicional.

**T7. "Notificação vaga se conserta no texto."**
Antítese: o texto é vago porque o DADO não existe (1.3.1). *Veredito*: ler a
última fala do agente do transcrito (a cauda já é lida para `lastPrompt`), e
o cartão passa a mostrar: a pergunta (primeira frase ou as opções do
AskUserQuestion), o projeto, o dispositivo, há quanto tempo, e o botão de
responder. Sem pergunta legível, o cartão diz "parou sem perguntar nada" e
oferece abrir. É a regra da seção 7 aplicada.

**T8. "Menos telas é melhor."**
Antítese: ele pediu explicitamente manter kanban, tempo, e voltar servidores.
*Veredito*: **7 itens de menu**: Início (o central), Projetos, Trabalho
(kanban), Servidores, Rotas, Tempo (com custo e gráficos dentro), Ajustes (com
hooks, rotinas, framework, máquinas por dentro). Análise e Coderoom entram
como condicionais (T6) até terem dado. Cockpit e Agora, hoje separados, viram
um só (Início): as duas metades de T1.

**T9. "Refazer os dados é reescrever os módulos."**
Antítese: os módulos já derivam quase tudo; o que falta são três campos e uma
fusão (1.3). *Veredito*: cockpit 2 é **uma rota nova de leitura**
(`/api/cockpit2`), que junta o que já existe no formato do modelo da seção 4
(projeto único, presença, sessões por tipo, serviços por dispositivo, avisos
com os quatro campos). A tela lê só essa rota mais o SSE. Nenhum módulo antigo
muda de formato (vizinhança com `simples` e `front` fica intacta).

**T10. "O mesmo design."**
Antítese: mudar a estrutura (inspetor, lista) é mudar o design. *Veredito*:
tokens, cores, cartões, tipografia, barra de baixo: iguais. Layout de duas
colunas com inspetor: é o que o desenho já tem em `.com-lateral`. Ele aprova
o protótipo inteiro antes; se recusar, desce a elemento (método dele).

---

*(reli a seção 0 aqui)*

## 9. Arquitetura de informação proposta

### 9.1 Menu (7 fixos + condicionais)

| item | pergunta que responde | fonte | condicional? |
|---|---|---|---|
| **Início** | quem me espera, o que roda, o que está no ar | `/api/cockpit2` (novo) + SSE | não |
| **Projetos** | em que pé está cada projeto, e onde | idem, lista + inspetor | não |
| **Trabalho** | o kanban (como está) | `/api/trabalho` | não |
| **Servidores** | o que está no ar, aqui e lá | `/api/servers` + docker + federado | não |
| **Rotas** | quem segura o quê (como está) | `/api/rotas` | não |
| **Tempo** | horas, custo, tarefas, gráficos | `/api/tempo` + `/api/tarefas` | não |
| **Ajustes** | máquinas, hooks, rotinas, framework, federação | os de hoje | não |
| Análise, Coderoom, Conhecimento, Agenda | | | sim: só com dado |

### 9.2 Início (o painel central), uma tela, sem rolagem no largo

```
┌─ faixa: uso 5h 10% · semana 33% · alienware ● vps ● · 3 no ar ─────────────┐
│ O QUE ME ESPERA (2)                     │ O QUE ESTÁ RODANDO (2)            │
│ ▸ inovallbond · vps · há 12 min         │ ▸ cockpit · alienware · Edit      │
│   "Subo o deploy com ou sem a migração  │   cockpit 2: pesquisa e plano     │
│    do banco?"  [responder] [abrir]      │ ▸ fibraessencia · alienware · Bash│
│ ▸ SÓ VOCÊ: fibraessencia · alienware    │   trazer o painel do iBRICS       │
│   "decidir o deploy do Pierre" há 2d    │                                   │
│   [feito] [abrir]                       │                                   │
├─ SERVIÇOS NO AR: ibrics :2153 alienware · pierre :3003 vps · +5 ───────────┤
```

Cada cartão da esquerda cumpre os quatro campos da seção 7. Lista vazia diz
"ninguém espera você, lido às 06:40". As duas metades nunca somem.

### 9.3 Projetos: lista + inspetor

Lista (uma linha por projeto, ordenada por urgência, depois por última
atividade): nome · presença (`alienware`, `vps`, `ambos`) · quem espera ·
sessões vivas · frente em curso · horas hoje (sparkline de 7 dias).

Inspetor (abre ao selecionar, à direita no largo, tela cheia no estreito),
ordem fixa:

1. cabeçalho: nome, presença, botões (abrir sessão aqui / lá, sincronizar)
2. quem espera você (os cartões de T7, só deste projeto)
3. sessões: uma linha por sessão, com tipo (claude bg / interativo / remote /
   coderoom / agy), dispositivo, modelo, estado, há quanto tempo, ferramenta
4. serviços no ar deste projeto, por dispositivo
5. backlog: frente em curso e os próximos 3 itens (link para o kanban)
6. pendências dele
7. gavetas: framework (fase, MVP, modo), git/sincronia, tempo e custo,
   rotas, travas

### 9.4 Servidores: uma lista, federada

Colunas: projeto · serviço (next, vite, postgres…) · porta · **dispositivo** ·
desde · abrir · encerrar (com as três travas de hoje). Containers entram com
tipo "container". Duplicados em destaque. Filtro por dispositivo em cima, não
abas. Processos protegidos do Windows (`services.exe`, 1026) **não entram**:
hoje a lista traz 34 e a maioria é sistema.

### 9.5 O dado novo: `/api/cockpit2` (a rota de leitura do modelo)

Só junta; não grava. Formato:

```
{
  dispositivos: [{ id, nome, local, contato, uso, cpu, ram }],
  projetos: [{
    chave, nome, presenca: ['alienware','vps'],
    espera: [{ tipo: 'agente'|'pendencia', pergunta, de, dispositivo, desdeMs, acao, idSessao }],
    sessoes: [{ id, tipo, dispositivo, modelo, estado, ferramenta, desdeMs, frente }],
    servicos: [{ tipo, nome, porta, dispositivo, desdeMs, url, encerravel }],
    frenteEmCurso, proximos: [...3], pendencias: [...],
    horasHoje, ultimos7dias: [..7], custoBrl
  }],
  servicos: [ ...todos, com projeto e dispositivo ],
  lidoEm
}
```

Três campos novos de verdade, e onde nascem:

- `espera[].pergunta`: a última fala do agente, lida da cauda do transcrito
  (`transcript.mjs` ganha `ultimaFalaDoAgente(file)`; se a última entrada é
  um AskUserQuestion, as opções entram).
- `presenca`: derivada de onde há sessão viva ou sinal recente (`maquinas` do
  job/sessão; `semContato` zera).
- `sessoes[].tipo`: união de `jobs` (bg), `sessoes.mjs` (interativa),
  `remotecontrol.mjs` (remote), `gate.mjs`/`opencode.mjs` (coderoom), agy.

---

*(reli a seção 0 aqui)*

## 10. Plano de execução

Método dele: **protótipo inteiro para decidir; micro-tarefas para executar**.

### 10.1 Protótipo (uma entrega, para aprovação)

`/cockpit2` com as três telas que mudam de verdade (Início, Projetos com
inspetor, Servidores federado), com DADO REAL desta máquina pela rota nova, e
as outras quatro (Trabalho, Rotas, Tempo, Ajustes) como estão hoje. Prova:
capturas em 1280 e em 390 (validando a largura pela barra de baixo), mais o
link. Ele aprova, recusa, ou desce a elemento.

### 10.2 Micro-tarefas (cada uma cabe numa linha do painel, com prova)

1. `transcript.mjs`: `ultimaFalaDoAgente(file)` + teste com transcrito de
   mentira (pergunta simples, AskUserQuestion, sem fala).
2. `cockpit2.mjs` (motor puro, novo arquivo): junta jobs + sessões + servers +
   docker + meu + backlog no formato de 9.5; teste com fixtures.
3. rota `GET /api/cockpit2` em `web.mjs` (só acréscimo, pedir à `simples`/`front`).
4. Início: as duas metades + faixa, lendo a rota nova; teste de "vazio dito
   com todas as letras".
5. Projetos: lista de uma linha por projeto com presença.
6. Projetos: inspetor lateral (largo) e tela empilhada (estreito), com
   `pintar()`; teste de sobrevivência ao tique de 2s com foco dentro.
7. Servidores: lista federada com coluna dispositivo, sem processos de sistema.
8. Menu: 7 fixos + condicionais por dado (T6), com contagem.
9. Retirar o bloco de CSS que esconde 10 itens (não é mais necessário: o menu
   passa a ser decidido por dado, não por `display:none`).
10. Gate: `test-cockpit2.mjs` no `npm test` (sintaxe, rota, vazio, estreito).
11. (decisão dele, T5) o PC puxar o retrato federado da VPS.

### 10.2.1 Herdado da rota `simples` em 11/09 (recado de 56665382)

CC-477: as 10 telas que o bloco de CSS esconde deveriam virar GAVETA dentro
das que ficaram, e não só sumir do menu. No cockpit 2 isso se resolve pela
micro-tarefa 8 (menu por dado) e pelo inspetor do projeto (Agentes, Framework
e Custo viram seções dele). Quando a 8 fechar, o CC-477 fecha junto ou vira KO
com o motivo.

### 10.3 O que NÃO fazer

- Não mudar cores, tipografia, cartões, barra de baixo (T10, palavra dele).
- Não tocar `ui_novo.html`, `ui_v2.html`, `projetos.mjs`, `trabalho.mjs`
  (rotas `front` e `simples`). Cockpit 2 é arquivo próprio e rota própria.
- Não pôr nada caro no tique de 2s (`/api/trabalho` já custa 2,4s).
- Não esconder tela por CSS: ou entra no menu por dado, ou não entra.
- Não escrever texto para o cartão de aviso: o texto é a fala do agente.

### 10.4 Testes que provam (para o "faça muitos testes" dele)

- vazio ≠ falha: cada bloco do Início tem os dois estados distintos.
- inspetor sobrevive a 4 tiques com foco dentro (prova positiva e negativa).
- 390px: barra de baixo com quatro botões inteiros (régua do CLAUDE.md).
- rota nova responde em < 300ms com 18 agentes (medir, não supor).
- presença: projeto com sessão só na VPS mostra `vps`; nas duas, `ambos`;
  máquina sem contato não conta.
- aviso: agente parado com AskUserQuestion mostra as opções; sem pergunta,
  mostra "parou sem perguntar".

---

## Rodada 2, 11/09: a resposta dele ao protótipo (palavra por palavra)

> *"Eu gostei da simplificação, mas tem algumas janelas que eu gosto do antigo,
> por exemplo conhecimento, agenda, tempo, custo, gráficos, hooks, até mesmo
> outros como análises, agentes, e o escritório que eu gosto são importantes.
> Em resumo eu gostei da sua versão, mas eu queria não perder o que tem de bom
> no antigo, só quero que as informações redundantes sumam e as informações
> importantes sejam organizadas de formas corretas, mesmo coisas que eu possa
> ver pouco mas se forem bem organizadas podem ser úteis em algum momento, o
> problema é quando coisas não muito úteis no dia a dia viram ruído no meio de
> coisas importantes. Por exemplo uma tela inicial seria bom com algumas
> informações como quanto tempo a gente trabalhou na última semana, os limites
> do agy e do Claude possível, as minhas notas, tarefas, ideias e compromissos
> da agenda, um resumo do kanban, algumas notificações importantes, informações
> da vps e do meu notebook sobre processamento, Memória etc"*

O que isso corrige na seção 8: **T6 e T8 caem.** Ele não quer menu de 7; quer
o menu do antigo menos o redundante. A regra dele é outra e é melhor: **o
critério não é frequência de uso, é ruído no meio do importante.** Tela pouco
usada e bem organizada fica; informação repetida some.

E a seção 9.2 muda: o Início deixa de ser só "espera + rodando" e vira o
combinado que ele listou, em blocos curtos, cada um com a fonte que já existe:
semana trabalhada (`tempo`), limites (`uso`; o agy não tem medição, e o bloco
diz isso), notas (`notes`), tarefas (`meu`), ideias (`ideias`), agenda
(`calendario`, hoje não configurada aqui), resumo do kanban (`trabalho`),
avisos (os cartões de T7), notebook (`maquina`) e VPS (`vps` + `vpsSaude`).

## Respondido por ele em 11/09 (pergunta direta)

1. T5: **o desktop puxa a VPS**. Palavras dele: *"quero que o desktop veja a
   vps tbm, o framework precisa criar essa conexão, mesmo que de forma barata,
   mas que tenha segurança, consistência e qualidade"*. Caminho: mesmo token da
   federação, HTTPS para o endereço da VPS, uma leitura a cada 30s do retrato
   federado, validada campo a campo como `validarPacote`, cache, nunca no
   tique de 2s. Item no backlog (frente cockpit 2).
2. A palavra: *"o framework é o cockpit na real, quero que seja o nome do
   método e do cockpit futuramente"*. Não muda o menu agora. Muda o que a
   palavra significa nos textos: framework = o sistema inteiro.
3. Protótipo com dado real **deste desktop, agora**, numa porta própria.
