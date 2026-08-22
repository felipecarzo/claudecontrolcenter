---
tags: [produto, linguagem]
tipo: referencia
atualizado: 2026-08-21
estado: alimenta os "?" do painel
resumo: O que cada palavra técnica do painel quer dizer, e como a coisa funciona por dentro. É a fonte dos "?" que aparecem na tela. Cada seção "##" vira uma explicação clicável.
---

# As palavras da tela

Este arquivo existe por um pedido dele, em 20/08:

> "eu queria que todas as funções e termos técnicos tivessem '?', e quando
> clicasse tivesse uma explicação bem detalhada do que é o que"

E foi reescrito no mesmo dia, depois da primeira versão:

> "voce colocou os '?' bem ruinzinhos (…) voce falou como se eu fosse um
> imbecil. Eu quero explicacoes mais tecnicas (…) pode ser bem explicito, a
> ideia é eu aprender e reaprender sempre"

## Como escrever aqui

**Cada `##` vira um "?" clicável no painel.** O título da seção é a palavra que
a tela usa; o corpo é o que ele lê ao tocar.

**Explicação de tela usa o id da tela, sem acento** (`## tela: maquina`, não
`## tela: máquina`). A ligação é por derivação: o painel troca `view-maquina`
por `tela: maquina` e procura. Uma lista de apelidos seria mais uma peça para
manter, e o nome bonito ("Máquina") a folha já pega do próprio menu.

O que a primeira versão errou, e não pode voltar:

- **Explicar o óbvio.** "A conversa fez uma pergunta e parou" não ensina nada.
- **Fugir do jargão.** Ele QUER o termo técnico, com a tradução colada.
- **Parar na definição.** A explicação boa descreve o bloco inteiro da tela:
  o que aparece ali, de onde cada pedaço vem, quem produziu, e onde ver mais.

O modelo é o exemplo que ele escreveu:

> "aqui ficam os agentes trabalhando, ativos, inativos ou desligados. Em cada
> painel mostra um agente, um resumo da tarefa e o prompt, que é a sua mensagem.
> O resumo da tarefa é feito pelo agente no momento que ele processa o prompt e
> isso depende de qual modelo está processando a tarefa. No quadrado ao lado do
> nome do projeto está a localização do projeto (…) do lado extremo direito
> temos o estado do agente, verde é ativo, amarelo é inativo (idle) e vermelho é
> desligado, e também o tempo de atividade."

Regras que continuam valendo: número vem com a escala, comando de terminal vem
quebrado parte por parte, e nome de arquivo só entre parênteses no fim.

## tela: cockpit

A tela de abertura. Responde uma pergunta só: **o que exige você agora**.

Ela é montada de quatro blocos, e cada um vem de uma fonte diferente:

- **Agora**: os agentes que pararam esperando resposta, mais as pendências que
  só você resolve. Ordenado por tempo de espera.
- **Projetos**: um cartão por projeto com sessão viva, com os agentes dentro,
  a frente mais citada e o avanço somando as tarefas de todos.
- **Atividade recente**: fatos com hora, tarefa fechada e agente nascendo. Sem
  fato, a caixa diz que não houve, em vez de inventar.
- **Ambiente e consumo**: as duas janelas do plano, os tokens somados e o
  estado da máquina.

O que ela **não** mostra é tão decidido quanto o que mostra: máquina sem
contato não entra na faixa de urgência, porque nada ali é atendível enquanto
ela não voltar.

## tela: gate

Uma conversa só, onde você fala com o Claude Code, o opencode e o agy, e troca
de um para o outro no meio dela.

A diferença para abrir cada um por fora é onde a conversa mora: **aqui ela é do
painel, não do agente**. Quando você troca, o novo recebe o que já foi dito, as
suas regras e o estado do projeto, e continua de onde o outro parou. Cada um
entra com a assinatura dele: a sua no Claude, a conta Google no agy, os modelos
gratuitos no opencode.

Uma conversa por projeto, o mesmo recorte das rotas. Ela fica gravada no
servidor, então o que você escreveu aparece igual no telefone e no computador, e
o que você começou a digitar sem enviar não se perde ao sair da tela.

Enquanto um agente trabalha, a faixa acima do campo mostra **a ferramenta que
ele está usando agora**, e não uma bolinha girando: resposta aqui leva minutos,
e é isso que distingue trabalho em curso de coisa travada.

O agente pode editar arquivo e rodar comando, e as suas proteções continuam
valendo: se ele tentar algo que uma trava barra, ela barra igual, e a conversa
mostra o que aconteceu.

## tela: agora

A versão longa da faixa de urgência do cockpit. Mesma lista, sem corte.

A ordem é por tempo de espera, quem espera há mais tempo primeiro, e a razão é
econômica: agente parado queima trabalho pago a cada minuto, enquanto pendência
sua espera parada sem custo.

Cada cartão traz o motivo da espera, deduzido do fim da conversa, e o botão que
abre aquele agente.

## tela: meus

Uma tela montada por você: os blocos que interessam, tirados de qualquer outra
tela, na ordem que você quiser.

Cada painel guarda a lista de blocos escolhidos. As teclas de 1 a 9 trocam entre
os painéis salvos, e só funcionam quando esta tela está aberta e o cursor não
está num campo de texto: 1 a 9 são números que se digita, e roubá-los sempre
transformaria escrever uma nota em trocar de painel.

## tela: trabalho

O funil de cada projeto, em três colunas: **o que só você resolve**, a **sprint**
dos agentes e o **product backlog**.

A ordem das colunas é a do mais restrito para o mais largo, e não é enfeite: a
primeira é a única que não anda sem você. No telefone as três viram cartas que
deslizam de lado, e a primeira é a que abre.

O backlog sai do `ROADMAP.md` de cada projeto, lido do disco. A sprint sai dos
agentes vivos. As pendências saem de três lugares: a sua lista escrita à mão, o
que os agentes marcaram como seu, e o que o roadmap declara como decisão sua.

## tela: estrutura

O mapa de um projeto: as frentes do roadmap, as rotas ocupadas e o que mudou
nos últimos dias.

Serve para responder "onde este projeto está" sem abrir arquivo. As frentes vêm
dos títulos do `ROADMAP.md`; as rotas, do quadro de rotas ativas; o que mudou,
dos commits.

## tela: agentes

Todas as sessões, agrupadas por estado: esperando você, com falha, trabalhando,
sem contato, paradas e entregues.

Cada linha abre a tela daquele agente, que traz as tarefas com a hora de
fechamento, o que ele entregou, o último pedido que ele recebeu, o modelo, os
tokens e o comando para retomar a conversa de onde parou.

A caixa de filtro procura em projeto, assunto, frente, rota, modelo e no seu
último pedido de uma vez.

## tela: escritorio

Os agentes desenhados como bonecos trabalhando numa sala, com o nome do projeto
no chão. É outra ferramenta aparecendo embutida no cockpit.

Existe uma armadilha central aqui: `localhost` dentro de uma página é a máquina
de quem olha, não a que serve. Por isso o cockpit serve esse painel por um
caminho relativo próprio, com um intermediário que só alcança portas
declaradas, e repassa também a conexão viva que mantém os bonecos andando.

## tela: remoto

As máquinas ligadas ao cockpit, e o caminho para **abrir uma sessão à
distância**: escolher a máquina, o projeto e o agente, do celular.

O pedido de sessão viaja como um arquivo que a outra máquina lê e executa. Cada
máquina aparece com a idade do último pacote, o que ela trouxe e se está sem
contato.

## tela: framework

A configuração de cada projeto: o modo de trabalho, o perfil ativo e os módulos
ligados.

O **modo** decide o quanto eu paro para perguntar (contínuo, restritivo,
diálogo). O **perfil** carrega uma trava de etapa: o perfil de design, por
exemplo, exige print nas duas larguras antes de eu dizer que terminei.

A tela confere o que foi gravado depois de gravar, e mostra a divergência quando
o que voltou não é o que foi pedido.

## tela: hooks

Os gatilhos automáticos: programas curtos que rodam sozinhos antes ou depois de
eu agir, e que podem me barrar.

Cada um tem um interruptor por aqui. A lista diz o que cada um cobra e quando
dispara. É o que transforma regra escrita em obrigação, e a diferença importa:
regra em texto eu posso não seguir, e já não segui.

## tela: rotinas

Os comandos de barra (`/start-session`, `/end-session`) que existem em cópia
dentro de cada projeto, e se essas cópias ainda batem com a versão global.

**A cópia local vence a global**, e é assim que uma rotina boa fica desligada em
silêncio. Uma medição achou 22 rotinas desatualizadas em 5 projetos, com uma
delas se apresentando como sendo de outro projeto.

Comparar por data não serve, porque copiar pasta renova a data. Comparar texto
cru acusa diferença de fim de linha entre Windows e Linux. Por isso a tela
normaliza antes de comparar, e oferece o conserto sob clique.

## tela: bancada

As camadas de verificação de segurança de um projeto: o que está exposto, o que
tem chave no lugar errado, o que responde sem autenticação.

Cada camada é um teste que pode ser ligado por projeto. Uma corrida é uma
execução da bancada, com registro próprio e cancelamento.

## tela: servidores

As portas em escuta nesta máquina e o que cada uma é, deduzido da linha de
comando do processo.

A varredura leva cerca de 3 segundos, então ela só roda quando a tela está
aberta, com cache curto. Nunca no fluxo automático.

Matar um processo daqui tem três travas: o processo precisa estar na lista
atual, precisa parecer servidor de desenvolvimento, e não pode estar na lista de
protegidos. Essa lista inclui processos do sistema, e matar um deles derrubaria
a sessão inteira do Windows.

## tela: docker

Os containers rodando nesta máquina, com imagem, portas e estado.

Um container é um programa empacotado com tudo de que precisa (biblioteca,
configuração, sistema de arquivos próprio), rodando isolado do resto da máquina.
Na VPS, os sites de cliente rodam assim, e é por isso que mexer no repositório
em `~/projetos` não altera o site publicado.

A porta aparece em dois números, separados por seta: a de **fora**, que a
máquina expõe, e a de **dentro**, que o programa escuta. Só a de fora serve para
alcançar o container, e é ela que aparece na configuração do servidor web.

Os containers parados ficam recolhidos, porque o que interessa quase sempre é o
que está de pé.

## tela: vps

O retrato da VPS por dentro: o servidor web, os processos gerenciados e os
containers, com quem conversa com quem.

Esta é **a única chamada de rede perigosa do painel**, porque usa a chave
privada dele por SSH. Por isso ela só roda quando você clica no botão, nunca em
temporizador. Achar isso exagerado depois e "só adicionar um timer" quebraria a
promessa central do recurso.

O organograma liga o servidor web aos containers **pela porta**, não pelo nome.
Os processos gerenciados ficam de fora do cruzamento de propósito: a ferramenta
deles não expõe a porta em que escutam, e inventar o vínculo seria mentira
bonita.

## tela: maquina

CPU, memória, disco e GPU deste computador, mais os processos que mais
consomem.

O uso de CPU é a **diferença entre duas amostras**, e não um valor absoluto: o
sistema entrega tempo acumulado desde que ligou. Por isso a primeira leitura
devolve vazio em vez de zero, que diria que a máquina está parada.

Temperatura de CPU e de RAM não existem no Windows sem programa externo. Foi
medido: as classes existem e devolvem zero instâncias.

## tela: tempo

Quantas horas foram trabalhadas em cada projeto, lidas dos arquivos de conversa.

O número depende de uma escolha sua, o **corte**: o silêncio máximo que ainda
conta como trabalho. No mesmo projeto, 77,7 horas com corte de 5 minutos contra
91,5 com corte de 15.

A quebra por máquina aparece quando mais de uma reportou horas naquele projeto,
e a máquina conhecida que não reportou nada aparece marcada, em vez de sumir e
fazer o total parecer completo.

## janela: pastas

A visão de pastas de um projeto, aberta pelo botão **pastas** no cartão dele.

**Não é um navegador de arquivos**, que você já tem no editor. O que ela
acrescenta é a leitura que só faz sentido aqui: **a estrutura que você definiu**,
e se o projeto a segue.

Em cima, as pastas do seu padrão. Acesa quando existe, apagada quando não. E a
frase que impede isso de virar cobrança: **pasta que falta não é defeito**,
porque a sua regra é não criar pasta vazia por simetria. A pasta de aplicativos
só existe quando há algo que vai para o ar.

A única coisa dita como problema é a falta de controle de versão próprio na
raiz, e ela é dita como consequência: sem ele, a pasta entra no repositório de
cima, e tudo o que estiver lá dentro vai junto. Existe um caso real de 34.213
arquivos engolidos assim.

Embaixo, a árvore. Pastas antes de arquivos, com o tamanho de cada um. Pasta
pesada de dependência aparece **marcada como fora da conta** em vez de sumir:
ver que ela existe é diferente de achar que o projeto não tem dependência
nenhuma. E pasta funda demais diz que não foi lida, em vez de parecer vazia.

Custa 60 milissegundos, porque o que é pesado fica de fora.

**Tocar num arquivo abre o conteúdo ali mesmo**, ao lado da árvore no computador
e no lugar dela no telefone.

Quatro coisas ele recusa abrir, e cada uma diz o motivo em vez de um "não deu"
genérico:

- **arquivo que guarda senha ou chave** (`.env`, `.pem`, chave privada). Ele
  aparece na árvore, marcado e sem botão: você vê que existe e vê que o painel
  não mostra. Os exemplos (`.env.example`) abrem, porque existem para ser lidos
- **caminho que sai da pasta do projeto**. Sem essa trava, um caminho com `..`
  entregaria qualquer arquivo da máquina pela rede
- **arquivo que não é texto**, detectado pelo conteúdo, não pela extensão
- **arquivo acima de 512 kB**, dizendo o tamanho que tem

## tela: projetos

Cada projeto com o que é dele, num cartão só.

**O problema que ela resolve, medido:** um projeto está espalhado por 14 telas.
Para saber como o inovallbond está, era preciso abrir Cockpit (agentes),
Trabalho (backlog), Estrutura (roadmap), Remoto (sessões), Framework (fase),
mais Rotinas, Bancada, Tempo, Custo, Travas, Tendências e Digest. O servidor já
sabia responder por projeto em 21 lugares: o dado existia inteiro e nunca tinha
sido reunido.

O cartão fechado mostra o que é barato de ler: quantos agentes, quantos itens no
backlog, quantos só você resolve, e as horas de hoje. **Tocar em "ver tudo" abre
o que é caro** e busca só daquele projeto: o estado do git, a fase do framework,
as rotinas que envelheceram e as frentes abertas do roadmap.

A divisão não é estética. Ler o git de um projeto custa cerca de 83
milissegundos, e são 20 projetos: colocar isso no cartão fechado custaria 1,6
segundo a cada abertura de tela, num painel que se atualiza sozinho de 2 em 2
segundos.

**Projeto de outra máquina aparece separado, e sem botão de abrir.** A federação
traz agentes do seu PC, e a pasta deles não existe aqui: um botão que falha
depois do clique é pior que botão nenhum.

O filtro começa em "só os que têm algo agora". Trocando para todos, aparecem os
20, incluindo os que estão quietos.

## tela: travas

As regras do projeto que barraram uma entrega, e se elas ajudaram.

Uma resposta em cada quatro é devolvida por alguma regra, e ela precisa ser
refeita antes de chegar até você. Esta tela mostra cada devolução em ordem, com
a hora, qual regra foi, em que projeto, e o recado inteiro quando você abre.

**O botão "ajudou" existe porque falta metade da conta.** Dá para medir quanto
as regras custam (uma em cada quatro respostas, alguns minutos a mais por
devolução), e não existe nada medindo se elas melhoraram o resultado: erro
evitado não deixa rastro. Marcando cada uma, o número nasce de quem sente o
resultado, sem precisar desligar nenhuma regra para comparar.

A proporção só aparece depois de três marcas na mesma regra. Uma marca só viraria
"100% ajudou", e um número desses engana mais do que informa.

O log lê apenas o fim de cada conversa, que é o que mantém a tela barata. O botão
de buscar o histórico inteiro varre tudo uma vez e completa o que faltava.

## tela: tendencias

O que mudou em relação às semanas anteriores, e o que anda junto com o quê.

O painel guarda uma linha por dia, por projeto e por medida. Sem essa história
gravada não existe tendência, só fotografia: o programa que apaga trabalho
antigo faz isso sozinho, e a conversa é relida do zero a cada vez.

Cada medida aparece com **o número do dia contra a média das quatro semanas
anteriores**, porque número solto não diz nada. "319 falhas" não informa se é
muito nem se está piorando. O que sai da faixa ganha destaque; o que não tem
história suficiente diz que não tem, em vez de fingir um veredito.

**O cruzamento só usa dias em que as duas medidas foram vistas juntas.** Sem
isso a conta mistura períodos e mente com confiança: um projeto chegou a
aparecer com 51 entregas e trabalho nenhum, porque o histórico de entregas
cobre meses e o de conversa cobre dias.

Recolher é a única ação que escreve, e fica atrás do botão porque varre 173 MB
de conversa e leva alguns segundos. Abrir a tela apenas lê.

Nada aqui avalia pessoa nem agente. Métrica que vira meta deixa de medir:
"entregas por dia" ensinaria a picar entrega.

## tela: custo

Quanto cobrar por problema resolvido, a partir do que já foi feito.

Duas unidades, e as duas mentem de jeitos diferentes: **por tarefa** é a unidade
certa, mas depende de o agente ter marcado concluído; **por sessão** tem muito
mais amostras e tempo exato, mas uma sessão resolve mais de uma coisa, então a
média por sessão é sempre maior que a média por problema.

O nível (júnior, pleno, sênior) sai de uma classificação em que o peso maior é
**voltar no mesmo arquivo**, não a duração. Tempo longo é tarefa grande; quem
paga sênior paga por dificuldade, senão arrastar o trabalho viraria aumento.

## tela: graficos

Um construtor: você escolhe a **medida** (horas, tokens, custo) e o **eixo**
(projeto, dia, mês, dia da semana, modelo), e ele desenha.

Nem toda combinação existe, e isso é dado e não defeito: as horas vêm do
relógio, que não sabe qual modelo rodou; os tokens vêm do uso, que não sabe
quanto tempo levou. O construtor recusa o cruzamento impossível e explica, em
vez de desenhar zeros.

Medida que depende de configuração (valor, sobra) também é recusada dizendo o
que falta. Sem isso, taxa não configurada renderizaria um gráfico vazio que
parece "não trabalhei".

## tela: digest

O que mudou em cada projeto nos últimos dias: commits, tarefas fechadas e
marcos.

Serve para a pergunta "o que andou enquanto eu não olhava", sem abrir sete
repositórios um a um.

Os commits vêm do histórico do git de cada projeto, e as tarefas fechadas vêm do
carimbo de hora que o agente grava ao concluir. Projeto sem sinal nenhum no
período aparece dizendo isso, em vez de sumir da lista: projeto ausente e
projeto parado são coisas diferentes, e a tela precisa saber dizer qual é qual.

O recorte de dias é seu, e mudar o número refaz a leitura.

## tela: notas

Um bloco de notas por máquina, com blocos que podem virar lista de conferência.

O texto é a única fonte: uma linha por item, com marca na frente quando feito.
Alternar entre texto e lista não migra dado nenhum, e o arquivo continua legível
fora do painel. Um array separado daria duas verdades para o mesmo conteúdo.

As notas têm cópia de segurança porque já se perderam uma vez: o arquivo
amanheceu vazio e as duas listas sumiram, sem que se conseguisse provar quem
gravou.

## tela: documentos

A sua estante: um arquivo por documento, guardado fora do projeto para você
alcançar de qualquer máquina.

Serve para ideia sua, texto ditado, contrato que chegou pelo chat. Diferente das
notas, que são de agora, isto é o que você quer reler daqui a meses. Um
documento pode ser publicado dentro do projeto quando vira decisão.

## tela: agenda

Os compromissos de hoje, lidos da sua agenda do Google.

Existe porque o painel responde "o que exige você agora", e reunião marcada é
exatamente isso: um compromisso às 15h muda o que faz sentido começar às 14h.
Sem ela, a tela mediria só o trabalho da máquina e ignoraria o dia real.

A leitura é somente de leitura: o painel nunca cria, move ou apaga compromisso.
E ela é feita sob clique, não em temporizador, porque é chamada de rede para
fora e as outras leituras do painel são todas de disco local.

## tela: glossario

O dicionário do projeto, montado varrendo os documentos em `docs/`. Cada
documento declara os termos que usa, e esta tela junta todos.

É onde procurar quando a palavra apareceu num texto e não na tela. Os "?"
espalhados pelo painel saem da mesma fonte.

## agente

Um **agente** é uma sessão do Claude Code aberta: uma conversa com id próprio,
rodando numa pasta de projeto, numa máquina. Cada aba do terminal é um agente,
e a sessão que você abre pelo celular também.

O painel enxerga dois tipos, e eles vêm de lugares diferentes:

- **Sessão interativa**: você conversando. O estado dela é gravado num arquivo
  próprio quando o agente chama o comando de reporte.
- **Job de background**: tarefa que o Claude Code roda sozinho, sem conversa. O
  próprio programa mantém a pasta desses, em `~/.claude/jobs`.

O que a linha do agente mostra, da esquerda para a direita: o **projeto** e a
**máquina** (a etiqueta escura), o **assunto** escrito pelo próprio agente, a
**frente** do roadmap e o **estado**, mais o tempo desde o último sinal. À
direita ainda aparece a contagem de tarefas fechadas sobre o total, quando o
agente registrou alguma.

O número de agentes no topo conta só quem **ainda dá sinal**. Os congelados numa
máquina que parou aparecem em separado, no `+N sem contato`.

## sem contato

Cada máquina empurra para a VPS um pacote com tudo o que ela sabe, de tempo em
tempo. Quando o último pacote de uma máquina passa de **5 minutos**, ela é
marcada como **sem contato**.

O ponto central: **o pacote dela continua no disco**, com o estado congelado do
instante em que ela parou de falar. Sem essa marca, uma sessão que estava
`working` quando o PC desligou continuaria aparecendo como "trabalhando" para
sempre. Foi exatamente o defeito que você pegou em 20/08.

Por isso, para uma máquina sem contato, a tela:

- pinta o ponto de **cinza**, que é a única cor que não afirma nada;
- troca a frase por "sem contato com X há Y";
- junta as sessões dela numa faixa própria, em vez de espalhá-las por
  "trabalhando" e "esperando";
- **não** coloca nada disso na faixa de urgência, porque o painel não sabe
  distinguir "você desligou" de "caiu", e nada ali é atendível enquanto ela não
  voltar.

O que a máquina reportou antes continua valendo por até **12 horas**. Passou
disso, o dado é descartado: campo ausente a tela sabe dizer, campo velho não.

## esperando você

A faixa de agentes que **fizeram uma pergunta e pararam**. É a fila que decide
o seu dia: cada minuto ali é trabalho pago parado esperando uma resposta sua.

Como o painel sabe que é isto, e não outra coisa: o Claude Code marca a sessão
como encerrada ao fim de **cada turno**, então "encerrado" não distingue nada. O
discriminador é o **sinal**. Sessão que continua atualizando o arquivo de estado
está viva; viva com ferramenta rodando está **trabalhando**; viva sem ferramenta
acabou de responder e **espera você**.

O que cada cartão mostra:

- **projeto** e a **máquina** onde a sessão roda, lado a lado no título;
- o **assunto**, escrito pelo próprio agente quando ele entendeu a tarefa. Se
  ele não escreveu, o painel cai no seu último pedido e avisa isso com um "↑ o
  que você pediu, o agente não resumiu";
- **por que** ele está esperando, deduzido do fim da conversa;
- **há quanto tempo**, contado do último sinal.

A ordem é por tempo de espera, quem espera há mais tempo primeiro.

## trabalhando

Sessão viva com **ferramenta em execução neste instante**: lendo arquivo,
rodando comando, editando código. É o único estado em que o agente está de fato
gastando token agora.

Vem de um campo do estado da sessão que lista as ferramentas em voo. Esse campo
tem uma armadilha conhecida: ele guarda resíduo da última ferramenta mesmo
depois de a sessão terminar, então o painel só olha para ele enquanto o estado
real é "trabalhando".

Ponto verde. Em máquina sem contato ele vira cinza, porque aquilo é o último
estado conhecido e não o de agora.

## parado

Também chamado de **idle** (ocioso, em inglês). A sessão está viva, respondeu, e
está em silêncio sem nenhuma ferramenta rodando.

**Não é erro nem falha.** É o estado normal de uma conversa que terminou de
responder e não recebeu pedido novo. Ponto amarelo.

A frase mostra há quanto tempo ele está assim. Para agente de outra máquina, a
conta sai do último sinal que viajou no pacote, e não do relógio local: o tempo
ocioso é calculado por quem lê os arquivos, e esse número não atravessa a
federação.

## quebrou

A sessão terminou com erro e **não vai continuar sozinha**. Ponto vermelho.

O cartão traz o detalhe que o agente registrou. Quando ele não registrou nada, a
tela diz isso com todas as letras em vez de inventar um motivo.

Diferente de "parado": parado é silêncio esperado, quebrado é fim de linha.

## máquina

O aparelho onde a sessão roda. Hoje são dois:

- **VPS**: o servidor Contabo que fica ligado 24 horas, serve o cockpit e
  hospeda os sites de cliente. Sessão aberta ali sobrevive a você fechar o
  celular.
- **ALIENWARE-LIPE**: o seu PC. Desligou, as sessões dele congelam.

A etiqueta escura ao lado de cada projeto e de cada sessão diz qual é. Ela
aparece **sempre**, mesmo quando só existe uma máquina reportando: a pergunta
"onde isso está rodando" vale igual quando a resposta é óbvia.

O mesmo projeto pode ter sessão nas duas ao mesmo tempo, e é isso que a etiqueta
por sessão resolve. Quando é o caso, o cartão do projeto diz "em 2 máquinas".

## federação

O combinado que faz cada máquina mandar para a VPS o que sabe: agentes, horas,
uso do plano, servidores no ar, rotas, backlogs. É o que permite ver tudo num
lugar só, do celular, com o PC do outro lado da cidade.

Como funciona por dentro: a máquina de origem monta um **pacote** (um JSON com
tudo) e envia por HTTP para a VPS, que grava um arquivo por máquina. A tela lê
todos os arquivos, junta com o que é local, e **carimba a origem** em cada item.
É esse carimbo que vira a etiqueta na tela.

Três proteções que existem por medição:

- **prazo no dado herdado**: se um pacote novo não trouxer as horas, a VPS
  mantém as do pacote anterior, mas só por 12 horas;
- **teto no arquivo**: 4 MB, e o que foi herdado cai primeiro;
- **chave por máquina mais id**: duas máquinas podem ter sessão com o mesmo id
  curto, e sem isso uma sobrescreveria a outra.

## frente

A **seção do ROADMAP.md do projeto** onde aquele trabalho entra. Não é o assunto
da conversa: é o lugar dela no mapa do projeto.

Existe porque "Pierre: travessia gamificada" não dizia nada quando aparecia
sozinho, embora "Pierre" seja um título dentro do roadmap do inovallbond. Com a
frente, o cartão passa a falar o seu vocabulário: projeto › frente › tarefa.

Quem escreve é o agente, no reporte. O sistema cobra: mexer em código sem
declarar a frente devolve o turno pedindo para anotar.

## to-do

A lista do que aquela sessão se comprometeu a fechar. Quem escreve é o **próprio
agente**, e ele reescreve a lista inteira a cada anotação.

Consequências disso, que explicam coisas que você vê na tela:

- o carimbo de "concluído em" é guardado **fora** da lista, num mapa por texto,
  senão a anotação seguinte apagaria a hora;
- fechar um item não exige reenviar a lista toda, existe comando próprio para
  isso, porque o atrito de reenviar era o que fazia os agentes adiarem;
- entregar com item aberto é cobrado no encerramento.

A contagem que aparece na linha do agente (`2/6`) é fechados sobre total.

## sprint

O que os agentes estão fazendo **agora** naquele projeto, somando as listas de
tarefas de todas as sessões vivas dele.

Difere do **product backlog** em quem escreve e em quando: a sprint sai dos
agentes em execução neste instante; o backlog sai do arquivo do projeto e
sobrevive a qualquer sessão.

## product backlog

O que está escrito para fazer e **ainda não começou**. Sai do `ROADMAP.md` de
cada projeto, lido direto do disco.

O leitor procura os títulos e o estado de cada item. Uma armadilha real dele:
arquivos gravados no Windows terminam a linha com dois caracteres, e a primeira
versão do leitor devolvia zero itens em metade dos projetos por causa disso, sem
erro nenhum, só um mapa vazio.

## token

A unidade que o modelo lê e escreve. Grosso modo, **um token é um pedaço de
palavra**: "cockpit" pode ser um ou dois, um texto em português fica perto de
uma palavra e meia por token.

É a unidade de cobrança da API e a unidade dos limites do plano. Existem quatro
tipos, com preços diferentes, e a diferença entre eles é o que explica o custo
da tela:

- **entrada**: o que você mandou;
- **saída**: o que o modelo escreveu, o mais caro de todos;
- **cache escrito**: texto guardado para ser relido depois;
- **cache lido**: texto relido, que custa **10% da entrada**.

Quase todo o volume de uma sessão longa é cache lido, e por isso o número total
de tokens engana se você não olhar a quebra por tipo.

## cache lido

Texto que o modelo **releu** de uma conversa anterior em vez de processar de
novo. Numa conversa longa, todo turno relê tudo o que veio antes, e é daí que
vem a maior parte do volume.

Custa **10% do preço da entrada**. Por isso uma sessão pode mostrar bilhões de
tokens e um custo modesto: sem a quebra por tipo, o número parece um erro.

## janela de 5h

O limite de uso que zera a cada cinco horas. O número **não vem de API
nenhuma**: o Claude Code entrega o percentual junto com os dados que manda para
a barra de status, a cada resposta, e o painel captura dali. É o mesmo número
que o comando de uso mostra.

Consequência a lembrar: ele só anda quando o Claude Code responde alguma coisa.
Com tudo parado, a tela mostra a última leitura e a idade dela.

## janela semanal

O limite da semana, colhido do mesmo lugar que a janela de 5 horas. O Fable
consome dela e tem teto de **metade** da janela.

Não existe janela separada para o Fable, e por isso o painel não mostra "% do
limite" para ele: dá para mostrar quanto de Fable foi gasto em token, mas
converter isso em percentual do limite seria invenção.

## custo de API

Quanto aquele trabalho custaria **pagando por token** na tabela de preços da
Anthropic. É referência, não fatura: você paga assinatura.

O cálculo multiplica cada tipo de token pelo preço do modelo que rodou. Um
detalhe que já deu erro: o modelo às vezes vem com o apelido curto e às vezes
com a data no fim, e sem cortar o sufixo ele cai na lista de ignorados, fazendo
o custo sair **menor** sem erro aparente.

## sobra

Receita menos custo, com o custo sendo a **assinatura rateada por hora**, nunca
o preço de API.

Por que assim: a primeira versão fez receita menos custo de API e deu "sobra de
menos R$ 19 mil" num projeto, o que não descreve nada da sua vida real. O custo
verdadeiro é o valor da assinatura dividido pelas horas trabalhadas **naquele
mês**, aplicado mês a mês.

Consequência: mês parado deixa a hora cara, e isso é a verdade. E filtrar meio
mês infla o custo por hora daquele mês, porque o rateio só enxerga as horas
dentro do recorte.

Só aparece com a taxa por hora e o valor da assinatura configurados. Taxa zero
não é "de graça", é "não configurada".

## corte

O **silêncio máximo que ainda conta como trabalho**. Parou mais tempo que o
corte, o relógio para e recomeça no próximo sinal.

Existe porque a janela do primeiro ao último sinal não serve para cobrar: num
projeto ela deu 282 horas corridas contra cerca de 90 de trabalho real. O que
vale é a soma dos intervalos, descartando as paradas maiores que o corte.

**O número muda o resultado**: no mesmo projeto, 77,7 horas com corte de 5
minutos contra 91,5 com corte de 15. Por isso o corte é uma escolha sua na tela,
e não uma constante escondida no código.

Limite técnico: o cache guarda blocos de 2 minutos, então cortes menores que
isso não são possíveis sem reler tudo.

## tempo ativo

A soma dos pedaços em que houve trabalho de verdade, descartando as paradas
maiores que o corte. É o número que serve para cobrar.

Sai da leitura dos arquivos de conversa, que somam centenas de megabytes. Para
não travar o painel, a varredura só interpreta as linhas que têm consumo de
token e tira a hora das outras por padrão de texto; o resultado fica em cache
por tamanho e data do arquivo.

## rota

Uma faixa de trabalho **reservada para uma sessão**, para que duas não mexam no
mesmo arquivo ao mesmo tempo. É o combinado que permite ter várias conversas
abertas no mesmo projeto sem uma desfazer a outra.

Cada rota tem dono, arquivos reivindicados e um modo de trabalho declarado. Um
guarda automático recusa a edição quando o arquivo pertence a outra rota, e
sugere abrir um bilhete em vez de editar.

## hook

Um programa curto que o Claude Code executa **sozinho**, antes ou depois de eu
fazer alguma coisa, e que pode me **barrar**. Em português seria "gancho": um
ponto onde você pendura uma regra.

É o que transforma uma regra escrita em obrigação. A diferença importa: regra em
texto eu posso não seguir, e isso já aconteceu; hook devolve o turno e me obriga
a refazer.

Alguns que rodam neste projeto: um recusa travessão em texto que vai para
arquivo, um cobra o reporte no painel quando mexo em código, um exige prova ao
marcar tarefa como feita, e um recusa que eu pare com tarefa aberta sem dizer o
que ficou.

## gate

A bateria de verificações que roda antes de o código entrar (`npm test`). É a
**única barreira automática** do projeto: o que ela recusa não entra.

Roda em segundos e sem rede, de propósito. Guarda desde regras de código até
regras de tela, como "toda grade de colunas tem que colapsar no telefone" e
"todo quadro que mostra projeto diz em qual máquina ele está".

## servidor de desenvolvimento

O programa que serve um site **enquanto ele está sendo feito**, na sua máquina,
com recarga automática a cada alteração. Não é o site publicado.

A aba de servidores lista as portas em escuta e tenta dizer o que cada uma é,
lendo a linha de comando do processo. Matar um processo por ali tem três travas,
e a lista de protegidos inclui processos do sistema: matar um deles derrubaria a
sessão inteira do Windows.

## container

Um programa empacotado com tudo de que precisa (biblioteca, configuração,
sistema de arquivos próprio), rodando isolado do resto da máquina. É o que o
Docker faz.

Na VPS, os sites de cliente rodam assim. O organograma liga o servidor web ao
container pela **porta**, a de fora e não a de dentro, porque é ela que aparece
nos dois lados.

## painel embutido

Outra ferramenta aparecendo **dentro** do cockpit, servida por baixo do mesmo
endereço.

Existe uma armadilha central aqui: `localhost` dentro de uma página é a máquina
de **quem olha**, não a que serve. Apontar um painel embutido para
`http://localhost:3101` funciona por acaso no PC e nunca funciona pelo celular.
Por isso o cockpit serve esses painéis por um caminho relativo próprio, com um
intermediário que só alcança portas declaradas.
