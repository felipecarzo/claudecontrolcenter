# As telas do Cockpit, uma por uma

Inventário completo do painel: cada aba, a pergunta que ela responde e cada
ferramenta dentro dela. Escrito a partir do código (`src/ui.html`), não da
memória.

Serve para decidir o que mostrar, o que juntar e o que esconder. É retrato do
que existe hoje, 16/08/2026.

---

## Como o painel está organizado

São **17 telas em 4 grupos**. O cabeçalho tem duas fileiras: em cima os grupos,
embaixo as abas do grupo escolhido. Em tela estreita as duas viram um seletor
único, com os grupos como títulos.

| Grupo | Pergunta do grupo | Telas |
|---|---|---|
| **agora** | o que está acontecendo | cockpit, agentes, sprint, meu, escritório |
| **custo** | quanto isso custou e vale | tempo, gráficos, preço |
| **controle** | o que está de pé e o que me trava | servidores, VPS, hooks, bancada, rotinas, remoto |
| **saber** | o que é isso mesmo | glossário, documentos, agenda |

O critério do agrupamento é a **pergunta**, nunca o tipo de dado.

Toda tela abre com uma faixa de duas linhas: a pergunta em negrito e o veredito
em uma frase. `47 processos` não é veredito, `tudo no ar` é.

---

## O que aparece em TODA tela

### Cabeçalho

| Ferramenta | O que faz |
|---|---|
| **contadores** | esperando, falharam, trabalhando, parados, prontos e tokens. Contador zerado some, menos "prontos" |
| **uso do plano** | quatro barras: 5h, semana, opus, sonnet. Cor por faixa (verde até 60%, amarelo até 85%, vermelho acima) e quanto falta para zerar. Vem do statusLine, então só anda quando o Claude Code responde algo; envelhecendo, mostra a idade da leitura |
| **filtrar…** | busca em tudo do agente: assunto, rota, projeto, categoria, modelo, id, último pedido e o texto dos to-dos |
| **todos os projetos** | filtra por projeto. Vale para todas as abas |
| **todas as máquinas** | filtra por máquina. Só aparece quando há duas ou mais reportando |
| **tema** | seis temas: noite, carvão, âmbar, floresta, papel, areia. Mais `auto`, que segue o sistema |
| **notas** | abre a coluna de notas à direita |
| **flutuar** | abre a janela que fica por cima de tudo (Picture-in-Picture). Só em Chrome e Edge |
| **⚙** | escolhe o que a janela flutuante mostra |
| **⋯** | em tela estreita, guarda tema, notas, flutuar e ⚙ atrás de um clique |

### Ao lado das abas

- **cpu / ram / gpu**: uso em porcentagem, temperatura quando a máquina expõe,
  e o detalhe no título (nome do processador, memória usada de total, watts da
  placa). Temperatura de CPU e memória no Windows só aparece com o
  LibreHardwareMonitor aberto.
- **player de mídia**: o que está tocando, ⏮ ⏸ ⏭, volume **daquele aplicativo**
  (não o do Windows), mudo, e troca de aplicativo quando há mais de uma mídia
  aberta.

### Rodapé

Uma linha explicando a tela aberta. Muda a cada aba.

### Coluna de notas (botão "notas")

Bloco de anotação da máquina, com largura arrastável. Cada bloco tem título e
dois modos: **texto livre** ou **lista de itens** com caixinha. Alternar o modo
não converte nada, só muda como aparece. Apagar bloco pede confirmação, e o
arquivo guarda uma cópia de segurança antes de cada gravação.

### Janela flutuante (botão "flutuar")

Sobrevive a minimizar o navegador e a trocar de aba. Mostra os blocos
escolhidos no ⚙:

| Bloco | O que mostra |
|---|---|
| uso do plano | as barras de 5h e semana |
| agentes | só os que trabalham ou esperam, com to-dos e tokens |
| cpu/ram/gpu | as três barras |
| servidores | os servidores de projeto no ar |
| docker | containers rodando |
| processos | os que mais consomem CPU e RAM |

Dois formatos: **quadrado**, que empilha os blocos e ganha abas próprias
(incluindo "geral", que mostra tudo junto), e **fita horizontal**, uma linha de
pastilhas para encostar num canto da tela.

### Gaveta do agente (clique em qualquer agente)

Abre pela direita, em qualquer tela: status, assunto, projeto/rota, modelo,
tokens, quando começou, quando deu sinal. Dentro dela:

- aviso de agente sem sinal, e a lista de bloqueios
- **último pedido**, lido do transcript (não é o primeiro prompt)
- **to-dos** com barra de progresso e caixinhas que marcam
- **resultado ou estado**, o que o agente escreveu
- **notas** livres sobre aquele agente
- **links** que o agente publicou
- **pedido inicial**, e o aviso quando ele é de outra conversa
- **contexto técnico**: agente, modelo, id do job, caminho da pasta, ferramenta
  rodando agora e o comando `claude --resume` para retomar

### Mapa do projeto (clique no nome de um projeto)

Abre pela direita, com o `docs/ROADMAP.md` daquele projeto virando mapa:

- **três níveis**: `agora` (frentes com agente trabalhando, derivado, ninguém
  escreve), `na fila` (o resto do aberto) e `prontas`
- **grupos e frentes** do roadmap, com feitos/itens e quantos agentes estão em
  cada frente
- **rotas** do Método Routia: verde livre, vermelho ocupada, azul "o dono
  sumiu". Clicar alterna entre livre e ocupada; o azul não se clica
- **o que mudou**: commits desde a sua última visita, ou dos últimos 7 dias
- projeto sem roadmap ganha um botão que cria o to-do "escrever o roadmap" no
  agente aberto, em vez de o painel escrever o arquivo por conta própria

---

## Grupo AGORA

### 1. cockpit

> **Onde eu mexo agora?**

A tela mais importante do painel. Projetos ordenados por urgência: o de cima é
onde olhar primeiro. A ordem e as frases são calculadas no servidor.

**O que cada cartão de projeto traz**

| Elemento | O que faz |
|---|---|
| nome do projeto | clique abre o mapa do projeto |
| motivo | a razão da urgência em frase: "travado: falta credencial", "sem sinal", "esperando você". Nunca aparece o peso numérico |
| **vi isso** | marca o projeto como visto agora. A partir daí a tela mostra o que mudou desde essa visita |
| agentes esperando | um por linha, com o motivo, o assunto, a frente e há quanto tempo estão parados. Clique abre a gaveta |
| agentes frios | os demais, em pastilhas. Passando de quatro, agrupam por rota |
| **mini-mapa de frentes** | uma pastilha por frente do roadmap. Cor por estado, tamanho por peso, ponto quando há agente ali, contador feitos/itens, e aspas quando a frente guarda as palavras dele. Clique abre a citação ao lado da pastilha |
| selo do framework | a fase atual, seletor de modo, e a frase do que falta para o portão abrir |
| **liberar escrita** | nos modos que travam código, autoriza a IA a escrever. Dá para liberar tudo ou só um arquivo pedido. Trocar de modo zera a autorização |
| rodapé | agentes por status, quantos têm to-do aberto e o total de tokens |

**Dois botões no topo**

- **digest da semana**: cruza git, histórico e diário dos últimos 7 dias em
  todos os projetos. Commits, tarefas fechadas e dias de diário por projeto.
- **framework nos projetos**: lista todos os projetos da máquina, com o
  framework ligado ou não, e liga/desliga sob clique. Existe porque projeto novo
  ainda não tem agente, e sem isso ele não apareceria em lugar nenhum.

### 2. agentes

> **Quem está trabalhando agora?**

Um cartão por agente, agrupados em faixas dobráveis por urgência: esperando,
falharam, trabalhando, parados, prontos.

**Barra "ordenar por"**: urgência (o padrão), assunto, projeto, tokens, to-dos.
Ordenar desliga as faixas de propósito, senão o agente caro fica escondido
dentro da faixa dele.

**No cartão**

| Elemento | O que faz |
|---|---|
| categoria | a etiqueta que o agente escreveu |
| selo | a máquina de origem (com duas ou mais), e se é sessão de terminal ou pilotada remotamente |
| **↻** | copia o comando `claude --resume` daquela sessão |
| **☆ / ★** | fixa o agente no topo |
| **⧉** | copia o caminho da pasta |
| assunto | o problema, escrito pelo agente |
| projeto › frente | clique no projeto abre o mapa. A frente é a seção do roadmap |
| nota | por ordem de prioridade: sem sinal há tanto tempo, bloqueio, ferramenta rodando agora, estado escrito pelo agente, ou "você pediu:" com o último pedido |
| bolinhas | as tarefas: cheias as concluídas. Passando de dez viram barra |
| rodapé | modelo, tokens e há quanto tempo deu sinal |

### 3. sprint

> **O que falta fechar?**

O sprint backlog: as tarefas dos agentes vivos. O backlog de produto é o
`docs/ROADMAP.md` de cada projeto, e o mapa lateral é quem mostra ele.

| Ferramenta | O que faz |
|---|---|
| caixinha | marca a tarefa como feita |
| texto da tarefa | clique edita. Apagar tudo remove a tarefa |
| **+** | abre uma tarefa nova naquele agente |
| **explicar** | pede ao opencode explicar o que cada tarefa aberta significa, com o arquivo envolvido. Leva até um minuto |
| linha verde "prova" | a evidência do que foi entregue, sob a tarefa fechada. É a definição de pronto |
| linha "pronto quando" | o critério, sob a tarefa ainda aberta |
| barra azul | a tarefa em andamento. É derivada: a primeira aberta de um agente que está trabalhando |
| aviso do topo | quem entregou sem marcar nada, com **marcar todas como feitas** ao lado. Sem isso a aba de preço não sabe quanto levou cada tarefa |
| concluídas | ficam dobradas por agente |
| abrir tarefa em outro agente | os agentes que ainda não têm nenhuma |

### 4. meu

> **O que depende de mim?**

A lista do que a IA não pode fazer: cortar um asset, logar numa conta, autorizar
sudo, decidir. Vem de duas fontes: o que ele anota aqui e o que um agente pediu.

Campo de texto, campo de projeto, **anotar**. Cada linha marca como feito ou
reabre; as anotadas por ele também apagam. Resolvidas ficam dobradas no fim.
Zero aqui é boa notícia, e o veredito diz isso.

### 5. escritório

> os agentes desenhados trabalhando

O Pixel Agents embutido, com os agentes como bonecos num escritório.

| Ferramenta | O que faz |
|---|---|
| cartão do painel | bolinha verde quando no ar, nome, porta e detalhe |
| **ligar / desligar** | sobe e derruba o processo do escritório |
| **PiP** | solta o escritório numa janelinha por cima de tudo |
| **abrir** | abre em aba própria |
| palco | o escritório rodando dentro do painel |
| **quem é quem** | a legenda ao lado: status, assunto, projeto e o que cada boneco está fazendo. Clique abre o texto inteiro |

O escritório é **local de cada máquina**: mostra os agentes de onde ele roda,
não os das outras. As demais abas somam as duas.

---

## Grupo CUSTO

### 6. tempo

> **Quanto tempo isso levou, e quanto vale?**

Tempo ativo por projeto, lido dos transcritos. Tempo ativo é a soma dos
intervalos entre mensagens descartando as paradas grandes. Agente rodando
sozinho conta como trabalho; tempo lendo código ou em reunião não conta.

**Controles**

| Controle | O que faz |
|---|---|
| **parada que encerra** | 2, 5, 10, 15, 30 ou 60 minutos. Muda o número de horas, e por isso é escolha de quem olha, não constante do código |
| **de / até** | recorta o período. "período inteiro" desfaz |
| **R$ por hora** | a taxa global. Zero esconde a coluna de valor |
| **assinatura/mês** | quanto ele paga por mês. Liga a coluna de custo real, que rateia a assinatura pelas horas de cada mês |
| **dólar** | a cotação. Digitar congela o valor e a busca automática para de mexer |
| **reler transcritos** | força a varredura de novo, ignorando o cache |

**Tabela por projeto**: horas, dias trabalhados, média por dia, tokens, custo de
API, custo por hora, custo real, valor e sobra. Total no fim.

**Clique no projeto abre**

- **R$ por hora aqui**: taxa só daquele projeto, que vence a global
- **por dia**: barras de todos os dias trabalhados
- **gasto por modelo**: entrada, saída, cache escrito, cache lido e custo. A
  releitura de cache costuma ser quase todo o volume e quase nada do preço
- **sessões**: as 40 mais recentes, com tempo ativo e tempo corrido

O custo em dólar é o preço de tabela da API, referência de esforço. Quem paga
assinatura não pagou aquilo.

### 7. gráficos

> os mesmos dados da aba tempo, cruzados como você quiser

| Ferramenta | O que faz |
|---|---|
| **+ gráfico** | abre o construtor: forma, medida, eixo, dividir por e nome. A prévia desenha enquanto você escolhe |
| **o que dá pra cruzar** | o índice: cada medida com a fonte de onde vem (relógio ou uso de token) e cada eixo com o que aceita |
| **✎** | edita um gráfico salvo |
| **✕** | remove |
| **voltar aos prontos** | traz de volta os gráficos que já vêm feitos |

Cruzamento impossível é **recusado com explicação**, em vez de desenhar zeros: o
relógio não sabe qual modelo rodou, e o uso de token não sabe quanto tempo
levou. Medida que depende de configuração (valor, sobra) também é recusada
dizendo o que falta definir na aba tempo.

Período e corte saem da aba tempo. Os gráficos criados ficam gravados na máquina.

### 8. preço

> **Quanto cobrar por isso?**

| Ferramenta | O que faz |
|---|---|
| **unidade** | sessão de trabalho ou tarefa concluída. Sessão tem mais amostras e tempo exato; tarefa é a unidade certa mas depende de o agente ter marcado |
| **faixas júnior / pleno / sênior** | o valor/hora de cada nível, raspado de duas fontes de mercado. Digitar congela e a busca para de mexer. Mostra a faixa min-max, quantas caíram ali e a média |
| **buscar de novo** | vai buscar os valores de mercado outra vez |
| resumo | quantas, média por problema, total de horas e o total a cobrar |
| tabela | o que foi resolvido, projeto, nível (✓ quando corrigido por ele), tempo medido, seu tempo, tempo cobrado e preço |
| **clique na linha** | abre os sinais que geraram aquele nível, com o peso de cada um |
| **júnior / pleno / sênior** | corrige o nível daquela linha |
| **seu tempo, em horas** | o palpite dele, que faz média com o medido. É essa média que vira preço |

O nível sai de sinais de esforço no transcript, não de entendimento do problema.
É palpite, e o palpite é dele para corrigir.

---

## Grupo CONTROLE

### 9. servidores

> **O que está no ar nesta máquina?**

**Cartão por servidor**: porta em destaque (é o que se lembra), tipo, ★
favorito, pid, título, resumo do comando, a explicação escrita por ele, caminho
do projeto e há quanto tempo está no ar.

| Ferramenta | O que faz |
|---|---|
| **pasta / código / terminal** | abre aquele caminho no explorador, no editor ou no terminal |
| **copiar caminho** | copia o caminho da pasta |
| **renomear** | dá um nome que ele reconheça, e o nome sobrevive ao próximo `npm run dev` |
| **explicar** | anota o que aquele servidor abre |
| **abrir** | abre o endereço no navegador |
| **encerrar** | mata o processo. Pede confirmação, e só vale para servidor de desenvolvimento: processo do sistema fica de fora |
| **por porta / por projeto / ★ favoritos** | três jeitos de listar |
| **+ subir servidor** | favoritos, os abertos recentemente e todas as pastas de projeto com script de servidor. O servidor sobe em janela própria e sobrevive ao painel |
| aviso de duplicados | quando o mesmo projeto tem dois servidores do mesmo tipo, oferece fechar os repetidos deixando o mais recente |

Mais abaixo na mesma tela:

- **outros processos com porta aberta**, dobrados
- **containers docker**, rodando e parados
- **processos que mais consomem**: CPU, RAM e VRAM, três listas curtas. É caro
  de ler (segundos), então só carrega sob clique

### 10. VPS

> **A VPS está saudável?**

Retrato do servidor por SSH, **só quando ele clica**. Nunca sozinho: usa a chave
privada dele num processo que fica sempre religado.

| Ferramenta | O que faz |
|---|---|
| **⚙ conexão** | host, usuário e caminho da chave privada. A chave em si nunca sai da máquina, só o caminho fica guardado |
| **atualizar** | entra por SSH e tira o retrato. Fica salvo até o próximo clique |
| veredito | a resposta em uma frase, colorida |
| alertas | cada problema com **o que fazer** ao lado |
| uptime, ram, disco | as barras do servidor |
| **nginx** | um cartão por site: proxy para onde, ou pasta estática. Quando a porta bate com um container, mostra o nome dele |
| **docker** | containers, imagem, portas e status |
| **PM2** | processos, memória, reinícios e há quanto tempo estão no ar |
| **?** | cada seção tem um botão que explica o que aquela ferramenta é |

PM2 não entra no cruzamento com nginx de propósito: ele não expõe a porta que
escuta, e inventar o vínculo seria mentira bonita.

### 11. hooks

> **O que está me travando?**

Liga e desliga os hooks do Claude Code sem abrir o `settings.json`.

Agrupados por **nível**, que é o que muda para ele, não pelo nome do evento:

| Nível | O que significa |
|---|---|
| **travam** | recusam a ação e me obrigam a mudar de caminho |
| **avisam** | falam e deixam seguir |
| **informam** | põem contexto no começo da conversa |
| **medem** | só registram, nunca aparecem |

Cada linha traz a caixinha de ligar, o nome, **quando dispara em frase**
("antes de cada ação minha", "quando você manda uma mensagem") e a descrição.

O selo **não faz nada** marca o caso perigoso: ligado aqui e ausente do
`settings.json`. Parece ativo na tela e não roda. O veredito do topo grita isso.

Hooks ainda não implementados ficam dobrados no fim.

### 12. bancada

> **Este projeto está seguro para quem o alcança?**

A verificação de segurança, escolhida por **uma pergunta**: quem alcança este
projeto. O `npm test` responde "quebrei alguma coisa"; a bancada responde
"deixei alguma coisa insegura".

| Ferramenta | O que faz |
|---|---|
| **botões de nível** | cada nível traz o título, a pergunta que responde e quantas camadas acrescenta. O nível é o botão; a lista de camadas é consequência dele |
| **rodar o nível X** | roda todas as camadas exigidas |
| **rodar só esta** | roda uma camada isolada |
| cartão da camada | nome, o que ela verifica, o estado em uma palavra e a dica do porquê |

Estados possíveis: **limpo**, **N p/ olhar** (achados leves), **N achados**
(graves), **nunca rodou**, **não olhou** (a camada não conseguiu rodar aqui),
**não se aplica** e **a fazer** (declarada e ainda sem execução, dívida do
projeto e não dele).

Três listas: exigidas pelo nível atual, as dos níveis acima, e as **fora da
escala** (as de IA), que entram por aplicabilidade e nunca por rigor.

A bancada só existe com o framework ligado no projeto, e a tela diz isso quando
não está.

### 13. rotinas

> os comandos `/algo` copiados dentro dos projetos

`/start-session` é um arquivo `.md`, e ele existe em dois lugares: na pasta
global e dentro do projeto. **A cópia do projeto vence a global**, então cópia
velha desliga a rotina boa em silêncio.

| Ferramenta | O que faz |
|---|---|
| etiqueta | **desatualizada**, **igual à global** ou **só deste projeto** |
| **comparar** | mostra linha a linha o que só a global tem e o que só a cópia tem |
| **usar a global** | sobrescreve a cópia. O que ela tiver de próprio some, e o aviso diz isso |
| **apagar a cópia** | a rotina global volta a valer ali, que é o normal |

O resumo do topo diz quantas rotinas velhas estão rodando hoje, e em quantos
projetos.

### 14. remoto

> **Onde eu quero abrir uma sessão?**

Duas coisas na mesma tela.

**Painel federado** (configuração de uma vez por máquina)

| Campo | O que faz |
|---|---|
| nome desta máquina | como ela aparece nos seletos e nos selos |
| token | o mesmo nas duas pontas. **mostrar** revela, **gerar** cria um novo |
| empurrar para | o endereço do painel que recebe. Quem manda é o desktop, quem recebe é a VPS |
| **salvar** / **enviar agora** | grava, e força um envio na hora |

**Sessões remotas**: um projeto por linha.

| Ferramenta | O que faz |
|---|---|
| **ligar** | sobe uma sessão do Claude Code com Remote Control naquela pasta, para acessar de `claude.ai/code` |
| **pegar link** | copia o link de conexão, quando já apareceu na tela. Só funciona onde tem tmux |
| **mais uma** | abre outro agente no mesmo projeto. As sessões extras aparecem indentadas sob o projeto |
| **desligar** | derruba a sessão |

Na VPS a sessão sobrevive ao painel. No PC uma janela de console abre e fica com
ela.

---

## Grupo SABER

### 15. glossário

> **O que é isso mesmo?**

A camada curta dos documentos do projeto, extraída dos próprios arquivos.
Existe pela frase dele: se quiser lembrar o que é a bancada que ele mesmo criou,
teria que reler um documento gigante.

| Ferramenta | O que faz |
|---|---|
| busca | procura em título, resumo, estado, tags, termos e definições |
| cartão do documento | título, estado, número de linhas, resumo e a lista de termos daquele documento |
| hits de termo | com a busca preenchida, os termos que casaram aparecem primeiro, com onde estão |
| pendência do fim | os documentos **sem resumo escrito**. Ficam fora da lista principal porque o cartão sairia de um chute da primeira frase. Escrever `resumo:` no cabeçalho do arquivo resolve |

### 16. documentos

> **O que eu guardei aqui?**

A estante: a fonte primária dele. Ideia, texto ditado, contrato que chegou pelo
chat. O que ele quer reler daqui a meses, de qualquer máquina.

Diferente das notas, que são de agora: nota grava a cada tecla, documento é peça
fechada e só grava quando ele clica em guardar.

| Ferramenta | O que faz |
|---|---|
| busca | filtra por título |
| **novo documento** | abre o editor: título e texto. Aceita markdown leve (`#` título, `**negrito**`, `-` lista, `>` citação e blocos de código) |
| cartão | título, quantas palavras, quando foi mexido e de onde veio |
| leitor | o documento renderizado, com **editar** e **apagar** (dois cliques) |
| rodapé do leitor | o nome do arquivo, quando mudou e a origem |

### 17. agenda

> **O que eu tenho hoje?**

A agenda do Google dentro do painel, pelo endereço secreto em iCal. É a metade
"o que aconteceu de verdade" que o git não registra: reunião, aula, evento.

| Ferramenta | O que faz |
|---|---|
| **7d / 14d / 30d** | a janela de dias |
| **↻ atualizar** | relê os calendários |
| **⚙ agendas** | adiciona um calendário por nome e endereço secreto iCal, e remove os que não quer mais |
| lista | por dia, com "hoje" e "amanhã" no lugar da data. Hora, título, local, marca de evento que se repete, destaque no que está rolando agora e cinza no que já passou |

O endereço secreto **nunca volta para a tela**: o servidor devolve só nome e
eventos. Uma captura do painel não pode vazar a agenda inteira.

---

## Endereços de captura

A página aceita parâmetros na URL, usados para tirar print sem clicar em nada:

| Parâmetro | O que faz |
|---|---|
| `?tab=<id>` | abre direto naquela aba |
| `?static=1` | desliga o stream, senão o navegador sem tela nunca termina de carregar |
| `?expand=1` | abre todas as faixas e dobras |
| `?open=<id>` | abre a gaveta daquele agente |
| `?tema=claro\|escuro` | força o tema |
| `?novo=1` / `?indice=1` | abrem o construtor de gráficos e o índice |
| `?subir=1` | abre o painel de subir servidor |
| `?notes=1` | abre a coluna de notas |
| `?pipcfg=1` | abre a configuração da janela flutuante |
| `?tarefa=<chave>` | abre uma linha da aba de preço |

---

## O que este inventário mostra sobre a organização

Cinco observações que caem do próprio levantamento, para quando for reorganizar
a apresentação do painel:

1. **Três telas respondem "o que falta fazer"** em níveis diferentes: cockpit
   (frentes do roadmap), sprint (to-dos dos agentes) e meu (o que só ele
   resolve). O funil existe e está certo, mas nada na tela diz que são três
   níveis do mesmo funil, a não ser o mapa lateral.
2. **Custo aparece em três telas com unidades diferentes**: tempo (horas e
   dólar de API), preço (reais por problema) e gráficos (as duas cruzadas).
   Nenhuma delas é a fatura, e as três dizem isso em texto miúdo.
3. **Cinco telas só existem por causa de uma máquina específica**: servidores,
   VPS, escritório, remoto e rotinas. Quem abre o cockpit no celular vê metade
   delas vazia ou inútil.
4. **Bancada e hooks são as duas telas de "o que me controla"**, e estão em
   grupos vizinhos sem se referenciarem. Bancada depende do framework, que se
   liga na tela cockpit, dois grupos de distância.
5. **Glossário e documentos são a mesma estante em dois estados**: um é o que a
   IA escreveu e resumiu, o outro é o que ele guardou. A distinção é real, mas
   não está escrita em lugar nenhum das duas telas.
