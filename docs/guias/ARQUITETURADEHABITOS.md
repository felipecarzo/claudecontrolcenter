---
tags: [produto, visao]
tipo: visao
atualizado: 2026-08-14
estado: documento fundador, projeto ainda não aberto
resumo: Um copiloto de trabalho para profissionais que não podem usar IA por causa de sigilo. Conduz o dia por tarefas em vez de deixar a pessoa começar do zero, e garante que dado de cliente nunca saia da máquina.
termos:
  local-first: o dado sigiloso é processado por um modelo que roda na própria máquina e nunca sai
  proxy de confidencialidade: a camada que decide o que pode sair, mascara o resto e remonta na volta
  condução: o sistema propõe o próximo passo em vez de esperar a pessoa decidir do zero
  escape: o campo livre presente em toda pergunta, para não aprisionar em opções fechadas
  modo: o quanto o sistema conduz (livre, guiado, focado)
  tom: como o sistema fala (curto ou explicativo). Eixo independente do modo
---

# Arquitetura de Hábitos

**Documento fundador.** Versão revisada em 14/08/2026, a partir do rascunho
original do Felipe, com as correções que a análise levantou.

---

## Em cinco linhas

Profissionais como advogados e médicos **não podem** usar IA com dado de
cliente: sigilo profissional e LGPD proíbem. Ao mesmo tempo, começam todo dia
diante de uma tela vazia, decidindo do zero o que fazer. Este produto resolve as
duas coisas: conduz o dia por tarefas e garante, por arquitetura, que o dado
sigiloso nunca saia da máquina. O diferencial não é a IA, é **poder usar IA sem
quebrar sigilo**.

## Para quem

O caso que originou o produto: **Carol, advogada.** Liga o computador todo dia,
começa do zero, não usa IA. Não por desinteresse: porque o material dela é
coberto por sigilo profissional.

Ela representa uma categoria grande e mal atendida — advogados, médicos,
contadores, psicólogos, peritos. Gente que produz documento sensível o dia
inteiro, tem obrigação legal sobre ele, e por isso está de fora da onda de
ferramentas de IA que assume que tudo pode ir para a nuvem.

## O problema, em duas partes

**1. A tela vazia toda manhã.** Sem um sistema que conduza, cada dia começa com
uma decisão custosa: o que fazer agora? Isso consome energia antes do trabalho
começar, e faz o urgente ganhar do importante todos os dias.

**2. A porta fechada.** As ferramentas que resolveriam parte disso exigem mandar
o conteúdo para servidores de terceiros. Para quem tem sigilo, isso não é uma
preferência a ponderar: é impedimento. O profissional fica sem opção, e a
alternativa que sobra é não usar nada.

A segunda parte é o que torna este produto possível. Resolver só a primeira seria
entrar num mercado lotado. Resolver as duas juntas é abrir uma porta que hoje
está trancada.

## Princípios de desenho

**O dado sigiloso não sai. Nunca.** Não é "mascaramos bem", é "não sai daqui".
A diferença aparece numa auditoria, e é a única resposta que serve para quem
responde perante a OAB ou o conselho profissional.

**A condução é um convite, não uma prisão.** O sistema propõe o próximo passo,
mas toda pergunta tem campo livre. Profissional experiente sabe o que quer, e
opção fechada demais vira obstáculo em vez de ajuda.

**Ganhar a tela é privilégio, não pressuposto.** Quem desconfia de tecnologia não
entrega o desktop no primeiro dia. O sistema começa discreto e cresce conforme a
confiança.

**Funciona mesmo se a IA falhar.** A condução por tarefas tem valor sozinha. Se o
modelo estiver fora do ar, a pessoa ainda sabe o que fazer hoje.

## Como funciona

### A condução

Ao entrar no modo de trabalho, o sistema apresenta o que fazer agora, em vez de
uma tela vazia. Ao terminar uma tarefa, oferece caminhos: *"Petição revisada.
Enviar para o cliente, ou começar o parecer do caso X?"*

Sempre com escape: um campo livre onde a pessoa escreve outra coisa, e o sistema
recalcula a rota.

### Modo e tom, dois eixos separados

O **modo** diz o quanto o sistema conduz:

| Modo | O que faz |
|---|---|
| **livre** | Só acompanha e registra. A pessoa trabalha como sempre |
| **guiado** | Sugere o próximo passo, aceita desvio a qualquer momento |
| **focado** | Segue o plano do dia, e sair dele exige confirmação explícita |

O **tom** diz como ele fala: **direto** (frases curtas, sem explicação) ou
**explicativo** (diz o porquê, ensina no caminho).

Os dois são independentes. Cada modo tem um tom recomendado, para escolher com
um clique, mas qualquer combinação é válida. Alguém pode querer o modo focado
com tom explicativo enquanto aprende, e depois trocar para direto.

### O proxy de confidencialidade

A camada central, e a mais delicada. Três anéis, do mais seguro para o menos:

**Anel 1, o dado nunca sai.** Conteúdo sigiloso (o documento, o laudo, os nomes)
é processado por um modelo que roda na própria máquina. Mais lento, exige
hardware melhor, e é a única configuração que suporta auditoria sem ressalva.

**Anel 2, sai mascarado.** Quando a tarefa exige um modelo de nuvem, o proxy
troca entidades sensíveis por marcadores (`[CLIENTE_1]`, `[CPF_2]`) antes de
enviar, e remonta na volta. Serve para tarefa estrutural: formatar, resumir
seção, corrigir texto.

**Anel 3, sai limpo.** Conteúdo comprovadamente público (jurisprudência, lei,
modelo de documento) segue direto.

**Quem decide o anel é o tipo de tarefa, e o padrão é o anel 1.** Descer de anel
é escolha explícita, registrada em log local.

## O limite que precisa estar escrito

**Mascarar tem um teto, e o teto é o sentido.**

Trocar nome por marcador funciona quando a IA só formata ou organiza. Quando ela
precisa **raciocinar sobre o conteúdo** ("esse contrato tem cláusula abusiva?",
"esse laudo é coerente com o exame?"), mascarar demais destrói exatamente aquilo
que deveria ser analisado.

Isso não é bug a corrigir, é limite físico. Por isso o anel 1 existe: análise de
mérito roda local, ou não roda. Prometer análise profunda com dado mascarado é
prometer o que a técnica não entrega, e nesse mercado promessa quebrada tem
consequência jurídica.

**Quando o filtro falha, o problema não é técnico.** Um nome que escapa é quebra
de sigilo, com consequência para o cliente do profissional. O produto precisa
de: log local do que foi mascarado em cada envio, modo de revisão antes do
primeiro envio de cada tipo novo de documento, e resposta pronta para "como você
garante isso?".

## Arquitetura

Uma recomendação e um alerta.

**Comece leve.** O rascunho original sugeria Python no núcleo mais Flutter ou
Electron na interface. Isso se paga apenas se a interface precisar mesmo assumir
a tela de forma nativa, o que é a última etapa, não a primeira. Um processo
local servindo uma página web local resolve as fases iniciais com uma fração do
peso, e não impede trocar depois.

O que a escolha precisa suportar, em ordem de exigência:

1. **Rodar modelo local** (Ollama e equivalentes), que é o anel 1
2. **Interceptar e reescrever tráfego** para as APIs de nuvem, que é o anel 2
3. **Ler e escrever arquivos locais** com permissão explícita por pasta
4. **Interface leve**, que a pessoa não sinta pesar a máquina
5. **Assumir a tela**, só quando o produto tiver ganhado esse direito

## MVP: prove a tese primeiro

A ordem importa mais que o conteúdo. **A primeira coisa a construir é a que pode
matar o produto se não funcionar.**

**Etapa 1: o anel 1 de ponta a ponta.** Um documento real da Carol, processado
por modelo local, sem nada sair da máquina. Se a qualidade local for
insuficiente para o trabalho dela, o produto inteiro muda de forma, e é melhor
saber disso na primeira semana.

**Etapa 2: o proxy do anel 2, com prova.** Mascarar, enviar, remontar, e mostrar
o log do que saiu. A prova não é "funciona": é ela **ver** a lista do que foi
mascarado e concordar.

**Etapa 3: a condução, sem assumir tela.** Uma janela lateral com as tarefas do
dia e o campo de escape. Sem hooks de sistema operacional, sem overlay. Aqui se
descobre se conduzir ajuda de verdade ou irrita.

**Etapa 4: modos e tons.** Só depois de existir condução real para modular.

**Etapa 5: o modo trabalho.** Assumir a tela, agora sim, para quem já quis.

## O que este produto não é

- **Não é um chat.** Chat exige que a pessoa saiba o que perguntar, e o problema
  começa antes disso.
- **Não é substituto do profissional.** A responsabilidade sobre o documento
  continua sendo dela, e o produto precisa reforçar isso, não obscurecer.
- **Não é uma ferramenta de produtividade genérica.** O ângulo é o sigilo. Sem
  ele, vira mais um gerenciador de tarefas num mercado saturado.

## Perguntas em aberto

- **Qual modelo local dá conta?** Precisa de teste com documento real do
  domínio. É a maior incerteza técnica do projeto.
- **Que máquina o público tem?** Modelo local exige hardware. Se a Carol usa um
  notebook comum, isso muda a arquitetura.
- **Como se vende para quem não usa IA?** A demonstração provavelmente precisa
  ser sobre o sigilo, não sobre a IA.
- **Vale um parecer jurídico antes de prometer conformidade?** Provavelmente
  sim, antes do primeiro cliente pagante.

---

*Nasceu do rascunho do Felipe de 14/08/2026, revisado com as correções da
análise. Três peças deste desenho (o filtro de confidencialidade, a separação
entre modo e tom, e a ponte com outras ferramentas) foram adotadas no framework
do Agent Cockpit no mesmo dia.*
