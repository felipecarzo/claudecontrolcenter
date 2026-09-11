---
tags: [arquitetura, produto]
tipo: desenho
nome: Plano de Unificação
atualizado: 2026-08-30
estado: ✅ APROVADO por ele em 11/09, na forma completa (a VPS decide as regras, o PC executa)
---

# Plano de Unificação: o PC vira coletor, a VPS vira o cérebro

Desenho pedido por ele em 30/08, depois de escolher a forma. Nome dado por ele
no mesmo dia: **Plano de Unificação**.

## ✅ APROVADO em 11/09, e na forma completa

Esperou 12 dias por uma pergunta que nunca foi feita direito. Ele escolheu
*"aprovado, pode construir"* entre quatro opções, e a escolhida é a que faz a
**VPS decidir as regras** (qual trava vale, qual modo, qual perfil em cada
projeto), com o PC executando o que ela mandou na última sincronia. A opção
menor, só mostrar os dados sem controlar, foi recusada.

Isto confirma por escolha o que a seção seguinte já tinha resolvido em 30/08: é
controle remoto de CONFIGURAÇÃO, não de cada ação em tempo real. A razão física
continua valendo e não mudou com a aprovação: uma trava que roda a 20
milissegundos de distância não segura a mão no instante em que o agente escreve
o arquivo.

## O escopo cresceu no mesmo dia, e ainda não foi decidido até onde

Palavras dele, na hora de nomear o plano:

> *"transformar a VPS numa central de tratamento dos dados de todos os
> projetos meus, e de não só mostrar as conclusões desses dados como
> controlá-los e os frameworks"*

Isto é mais que o desenho abaixo. O que está escrito daqui pra baixo faz a VPS
**mostrar** o que o PC manda (seção 2) e mantém o controle do framework e das
travas **no PC**, com o motivo físico na seção 1a: uma trava que roda 20
milissegundos longe não segura a mão no instante em que o agente escreve o
arquivo.

**A tensão, e ela JÁ FOI RESOLVIDA POR ELE em 30/08.** "Controlar os
frameworks" da VPS podia significar duas coisas bem diferentes, e cada uma muda
o desenho inteiro:

1. ✅ **ESCOLHIDA.** A VPS **decide a regra** (qual trava vale, qual modo, qual
   perfil) e o PC só **executa** o que ela mandou na última sincronia, quer
   dizer, controle remoto de configuração, não de cada ação em tempo real. Cabe
   no desenho de hoje, é só a seção 2 crescer.
2. ❌ **Descartada.** A VPS **participa de cada decisão em tempo real**, tipo
   aprovar ou barrar uma escrita específica no instante em que ela acontece.
   Contradiz a seção 1a de propósito, e exigiria redesenhar a trava inteira.

⚠️ **Este bloco ficou 11 dias perguntando o que ele já tinha respondido.** A
escolha está no diário de 30/08, com estas palavras: *"a VPS decide a regra, o
PC aplica na próxima sincronização, sem mexer na trava que roda no instante da
escrita"*. O documento nunca foi atualizado, então quem o abrisse (ele
inclusive) via uma pendência que não existia, e a frente inteira parecia parada
por falta de decisão dele. Corrigido em 10/09.

É o mesmo formato de defeito que a rotina do `/end-session` teve, e que este
projeto já registrou: **o texto aponta para o lugar errado, e some do radar
porque ninguém desobedece**. Ao investigar "ele não decidiu X", leia o diário
antes de cobrar a decisão.

**Decidido por ele em 30/08: é a opção 1.** A VPS decide a regra (qual trava
vale, qual modo, qual perfil), e o PC aplica isso na sincronização seguinte.
Não é aprovação em tempo real de cada escrita, a seção 1a continua valendo do
jeito que está. O que muda no desenho: a seção 2 ganha mais um item, "a VPS
também escreve configuração de framework, não só lê", e o coletor (seção 1)
precisa buscar essa configuração na sincronização, além de mandar o retrato.
Ainda não desenhado em detalhe, é o próximo passo se ele quiser seguir com o
Plano de Unificação.

## De onde isto veio

Palavras dele, na ordem em que apareceram.

Primeiro a dor:

> *"a gente atualiza ele todo dia, não chega num produto final (…) quero que
> isso pare de ser um produto que eu vou criar todo dia pra eu passar a criar
> nele uma vez por semana só, focar em trabalhar nos meus projetos, porque eu
> estou perdendo muito tempo nele."*

Depois a proposta, que é o desenho deste documento:

> *"não como criar um serviço, um programa que funciona como o cockpit (…) uma
> série de regras no windows que são instaladas a partir do que o windows
> precisa fazer pra fazer o framework funcionar aqui no meu pc e também nas
> informações que ele precisa enviar dos projetos pro cockpit (…) assim
> independente da versão do programa aqui, a vps vai receber os dados e ela
> processa lá."*

E a condição que ele pôs ao escolher:

> *"pode ser com tela mínima, mas é importante que as informações que o pc passe
> pra vps sejam as mais ricas possíveis pra gente ter controle dos projetos, das
> tarefas, das sprints, roadmaps, enfim, tudo né."*

**A razão de fundo, e é ela que decide todo o resto: quanto menos o PC decide,
menos a versão dele importa.**

## As medições que este desenho usa

Feitas em 30/08, no PC dele, antes de qualquer decisão.

| o que | número |
|---|---|
| módulos em `src/` | 94 (30.332 linhas) |
| o que o painel inteiro puxa | 75 (26.719 linhas) |
| **o que um coletor puxaria** | **16 (8.079 linhas)** |
| módulos que só fazem sentido na VPS | 59 |
| travas que rodam no instante da ação | 39 |
| dado bruto guardado no PC (transcritos) | 1.616 MB |
| o resumo que viaja hoje, a cada 30s | 6 KB |
| frentes de roadmap que existem nos projetos daqui | 581 |
| itens dentro dessas frentes | 621 |
| **do roadmap, o que viaja hoje** | **5 KB** (contagem e 6 títulos por projeto) |
| **o que custaria mandar o mapa inteiro** | **170 KB** |
| teto do pacote | 2.048 KB |

**A conclusão que muda o desenho:** mandar tudo cabe folgado, com margem de 12
vezes. O resumo curto de hoje nunca foi limitação técnica, foi uma escolha feita
quando quem lia estava na mesma máquina. O comentário do código diz isso com
todas as letras: *"quem quiser a lista inteira abre o projeto, onde o arquivo
está por completo"*. Da VPS ele não tem como abrir, e é exatamente a queixa
dele.

## 1. O que fica no PC, e por quê

Três coisas, e cada uma tem um motivo que não é preferência.

### 1a. As travas, porque elas seguram a mão no instante da ação

São 39, e elas rodam quando o agente vai escrever um arquivo, responder, ou
abrir a sessão. **Não existe versão remota disso**: um servidor a 20 milissegundos
de distância não barra uma edição que já aconteceu. Elas leem o
`.framework/estado.json` do projeto, que mora no repositório e viaja no git.

Consequência para o desenho: o coletor carrega os hooks e o motor do framework.
São a maior parte das 8 mil linhas dele.

### 1b. A leitura do que só existe aqui, porque o dado bruto não viaja

1.616 MB de transcritos contra 6 KB de resumo, uma razão de 270 mil para um. As
horas trabalhadas e o custo saem de ler esse volume. **Alguém no PC tem que ler
o grande e mandar o pequeno**, e isso é o teto físico da ideia de "a VPS
processa lá".

O mesmo vale para: quais processos servem quais portas, quais containers rodam,
quais projetos existem em disco, o que o Claude Code registrou em
`~/.claude/jobs`.

### 1c. Uma tela mínima, porque a VPS cai

Escolha dele. Uma página local, sem gráfico e sem conta, respondendo só:

- estou conectado? qual foi o último envio, e há quanto tempo?
- as travas estão ligadas nesta máquina?
- os últimos envios, um por linha, com o que foi dentro
- os botões de religar e de voltar para a versão anterior

**O que ela NÃO faz:** calcular horas, desenhar gráfico, mostrar quadro, cruzar
projetos. Isso é da VPS, e duplicar aqui seria voltar ao problema.

### O que SAI do PC

Os 59 módulos que só fazem sentido do outro lado: telas, gráficos, custo por
token, mercado, bancada de segurança, escritório, docker, estante de documentos,
calendário, síntese, entrevista, quadro. **É a maior parte do que quebra e do
que precisa ser atualizado.**

## 2. O que fica na VPS

Tudo o que é decisão, conta e tela. Uma versão só, num lugar só, que é onde o
desenvolvimento acontece.

- As telas todas, inclusive as dos projetos do PC.
- O cálculo de horas, custo e valor, em cima do que cada máquina resume.
- O quadro de tarefas, o roadmap, as sprints, cruzando todas as máquinas.
- O histórico, que hoje se perde quando o Claude Code limpa os jobs do PC.
- As decisões de produto: o que é frente, o que é prioridade, o que é regressão.

**A vantagem que ele nomeou:** atualizar isso deixa de exigir mexer no PC dele.

## 3. O formato do que viaja

### O que já viaja hoje

`maquina`, `jobs`, `servidores`, `uso`, `tempo`, `rotas`, `backlogs`, `meu`,
`agentes`, `limites`, `travas`, `framework`.

### O que passa a viajar, pela condição dele ("as mais ricas possíveis")

| campo | hoje | proposto |
|---|---|---|
| roadmap | contagem e 6 títulos | **o mapa inteiro**: frentes, itens, estado, citação, ordem |
| tarefas | só as do agente ativo | **todas**, com estado e a que frente pertencem |
| sprints | não viaja | **as seções e o que está aberto em cada uma** |
| histórico | não viaja | **o que sobra depois que o Claude Code limpa o job** |
| projetos | só os que têm agente | **todos os que a máquina enxerga**, com git em dia ou não |

Custo medido: 170 KB contra um teto de 2.048 KB.

### As três regras do formato, e cada uma vem de um erro já pago

1. **Campo ausente e campo vazio são coisas diferentes.** `null` quer dizer
   "esta máquina não sabe dizer", `[]` quer dizer "sabe, e não tem nenhum". Uma
   tela que confunde os dois afirma que as travas estão desligadas quando na
   verdade a leitura falhou.
2. **Cada campo é validado por si.** Uma falha na leitura das horas não pode
   impedir o envio do resto, senão a máquina inteira some do painel por causa de
   um campo.
3. **Cada campo tem o próprio ritmo.** As horas custam segundos e vão a cada 10
   minutos; o retrato das travas custa milissegundos e vai a cada envio.

## 4. Como as versões conversam

**Este é o furo que precisa ser fechado antes de qualquer código.** Hoje o que
viaja não tem número de versão. A validação campo a campo perdoa muito, mas a
VPS não tem como dizer *"este coletor está velho demais"*, e o coletor não tem
como saber que a outra ponta espera algo novo.

Sem isso, *"independente da versão do programa aqui"* é esperança, não garantia.

O acordo proposto:

- **O pacote leva um número de contrato**, que sobe só quando o SIGNIFICADO de
  um campo muda. Acrescentar campo não sobe: campo desconhecido é ignorado, que
  é o comportamento de hoje e é o certo.
- **A resposta da VPS diz qual contrato ela fala.** O coletor guarda isso e
  mostra na tela mínima: "esta máquina fala 3, a VPS fala 4, atualize".
- **A VPS aceita contrato antigo enquanto conseguir**, e diz na tela de qual
  máquina o dado está incompleto e por quê. Recusar calado seria a máquina
  sumindo do painel sem explicação.
- **O coletor nunca deixa de mandar por causa disso.** Dado velho com aviso é
  melhor que silêncio.

## 5. Instalar numa máquina nova

O que ele descreveu como *"uma série de regras no windows que são instaladas"*.
Os quatro primeiros passos já existem hoje, soltos; o desenho é juntá-los num
caminho só, com o quinto no fim.

1. **Perguntar duas coisas**: onde ficam os projetos (`cc pastas`) e para qual
   cockpit reportar, com a senha (`cc federar ligar`).
2. **Registrar as travas** no `settings.json` do Claude Code daquela máquina
   (`cc hooks install`).
3. **Instalar o serviço**, que sobe no logon e se religa sozinho
   (`cc daemon servico`). ⚠️ Medido em 26/08: criar a tarefa agendada no Windows
   exige terminal como administrador, mesmo para tarefa sem elevação nenhuma. O
   instalador precisa **dizer isso** quando acontecer.
4. **Publicar a primeira versão** na pasta instalada, separada da de obras
   (`cc versao publicar`).
5. **Conferir de ponta a ponta** e mostrar o resultado na tela: mandou, chegou,
   a VPS respondeu, e o contrato bate.

## O que este desenho NÃO resolve

- **A pasta velha.** Enquanto houver duas cópias do produto na mesma máquina, o
  problema do CC-444 continua, e ele é anterior a este desenho.
- **O trabalho de migração.** Separar 59 módulos não é mover arquivo: é achar
  cada lugar em que o painel local lê algo que passaria a vir de fora.
- **O que fazer quando a VPS está fora do ar por um dia.** A tela mínima diz que
  está fora, e não substitui o painel. É uma decisão dele se isso basta.

## A ordem sugerida, se ele aprovar

1. **O contrato versionado** (seção 4). É pequeno, e sem ele nenhuma das outras
   partes entrega a independência que ele quer.
2. **O pacote fica rico** (seção 3). Valor imediato e independente do resto: ele
   passa a ver roadmap, tarefas e sprints do PC pela VPS, hoje, sem esperar o
   coletor existir.
3. **A tela mínima** (seção 1c), que já é quase o que a bandeja mostra.
4. **A separação de verdade** (seções 1 e 2), que é o trabalho grande.
5. **O instalador** (seção 5), por último, quando houver o que instalar.

**O passo 2 é o que responde à queixa dele mais rápido**, e não depende de
nenhuma decisão de arquitetura.
