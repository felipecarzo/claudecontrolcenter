# A tela Início, bloco por bloco

Lista feita em 25/09/2026 a pedido dele, lida do código (`c2RenderInicio`, em
`src/ui_cockpit2.html`), para discutir um por um: *"podemos discutir um por um
dessa lista que você fez? salva ela por favor"*.

Cada item tem o que ele faz hoje e, embaixo, a decisão dele quando ela sair.
Decisão ainda não tomada fica como "em aberto".

## 1. Atualiza sozinha a cada 5 segundos

Mostra no topo a hora da última leitura. Se uma leitura falha, escreve "falha
na última leitura" em vez de mostrar dado velho como atual.

**Decisão (25/09):** manter como está.

## 2. Faixa das máquinas

VPS e PC, com bolinha cheia para quem está em contato e vazia para quem está
sem sinal; quantos serviços estão no ar e quantos projetos deram sinal.

**Decisão (26/09):** conserto da cor feito, a pedido dele pelo print ("ambas
estão apagadas sendo que ambos o pc e vps tão online"): verde em contato,
vermelho com "sem sinal há …" quando some. O resto fica como está, incluindo
"projetos com sinal" e o tempo em milissegundos.

## 3. Decisões

Só os agentes parados esperando ele. Pergunta com opções vira botões e ele
responde dali (provado em 23/09 e 25/09). Agente parado sem pergunta mostra a
última fala e o botão de abrir a sessão.

**Decisão (26/09):** as duas propostas, mais duas dele. Palavras dele: *"opção
1, porém tem que ter opção de fechar um pedido e de auto-deletar decisões que
estão travadas, tipo a que tá lá agora"* (um PAROU do `PC_tradutor`, com erro
da API, parado há 2h41).

1. a pergunta aparece na hora, sem esperar o minuto de silêncio;
2. o cartão PAROU ganha um campo de mensagem livre para a sessão;
3. todo cartão tem "fechar", que some até a sessão se mexer de novo;
4. cartão parado sem pergunta, sem movimento há mais de 2 horas, sai sozinho.
   Pergunta com opções NÃO sai sozinha: foi a decisão de 23/09 (pergunta
   pendente não envelhece), e vale até ele dizer o contrário.

## 4. Sessões

Quem está trabalhando neste minuto: projeto, assunto, o que faz agora
("pensando" ou a ferramenta), há quanto tempo, tarefas fechadas, botão abrir.

**Decisão (26/09):** as duas propostas, feitas e provadas. A linha mostra o
que o AGENTE disse por último (antes mostrava o pedido dele, cortado); e cada
sessão desta máquina ganhou "parar", que manda Esc no terminal dela, com
confirmação antes. Provado: a sessão de teste rodando `sleep 90` escreveu
"Interrupted" e ficou aberta.

## Extra: o sino (26/09)

Pedido dele com print: o FC no canto superior direito, com um sino de
notificações "estilo rede social". O sino conta as mesmas decisões do bloco
Decisões e abre a lista delas; cada item leva ao cartão.

## 5. Gaveta

Pendências dele paradas há mais de 7 dias, fechada, só com a contagem. Em
"triar", marca e fecha em lote com "já resolvi" ou "não vale mais", sem apagar.

**Decisão (26/09):** a tela fica; o problema era de origem. Medido: 41 das 72
pendências abertas nasceram sem projeto e caíam num "geral" de 39.
- **A, daqui para frente:** `cc meu add` sem `--projeto` usa o projeto da pasta
  onde o agente está (só dentro de `projetos/`). Provado numa lista isolada.
- **B, uma vez:** 38 das 41 ganharam projeto pelo texto, com o documento que
  aponta quando o texto não bastava (script em que cada linha diz o porquê).
  Nenhuma foi fechada. Ficaram sem projeto 3 sem evidência: o comando de
  `liberar-publicacao.md`, o "RJ chumbado no motor" e o ignore de ambiente no PC.
- Achado: "decidir qual pasta do fibraessencia fica" parece resolvida desde
  07/09 (ficou a sem prefixo). É dele fechar.

## 6. Tarefas

As pendências dele de menos de 7 dias, até 5, com atalho para o resto na tela
Trabalho.

**Decisão (26/09):** "1 + clicar na tarefa abre mais infos dela". Feito:
"mais N" abre as outras no próprio bloco (antes levava ao quadro da tela
Trabalho); tocar no texto mostra por quê, frente, projeto, máquina, quando
nasceu e o código; o ✓ vira "feita · desfazer" por 6 segundos antes de fechar
de verdade. Provado no navegador em 390 sem fechar nada: desfazer antes dos 6
segundos não mandou nenhum pedido ao servidor.

## 7. Notas

As notas dele, cinco linhas por nota, avisando quando cortou.

**Decisão (26/09):** as duas. O resumo mostra as 2 notas mexidas por último
(cada nota passou a guardar a hora em que o texto ou o título mudou; só a
altura do bloco não conta), e o bloco ganhou "anotar rápido": uma linha, Enter
ou "+", e a nota nasce no topo. O servidor só acrescenta, sem reenviar a lista,
para não atropelar uma edição aberta na tela Notas. Provado numa lista isolada
e no navegador em 390 com o pedido interceptado, sem criar nota de verdade.
Antes, também em 26/09: o resumo esconde linha com cara de senha.

## 8. Ideias

As 3 mais recentes guardadas para virar item, com a contagem das outras.

**Decisão (26/09):** dar vida. Medido antes: as 8 filas de ideias existiam e
estavam vazias desde sempre, porque só o encerramento formal de sessão as
preenchia. Agora o painel varre as conversas (7 dias na primeira passada, 24
horas de hora em hora) atrás das mensagens dele com cara de ideia que não estão
no backlog do projeto, e guarda na fila (`src/ideiasVarredura.mjs`). Cada ideia
tem "virar item" (marca aprovada; a próxima sessão do projeto registra com as
palavras dele, passo 2.5 do `/start-session`) e "descartar" (não volta).
No caminho, o mesmo defeito do carimbo de origem apareceu pela terceira vez,
agora na pasta do projeto: consertado e com teste. Primeira passada achou 4.
A detecção é pelo começo da frase ("podemos", "e se"), e às vezes pega
pergunta: é para isso que existe o "descartar".

## 9. Agenda

O que ele tem hoje, lido da agenda do Google, quando configurada.

**Decisão (26/09):** deixar como está. Nunca foi configurada nesta VPS (falta o
endereço secreto iCal do Google Agenda); o bloco segue com o atalho de
configurar para quando ele quiser.

## 10. Kanban

Resumo do quadro por projeto: andando, pausadas, na fila, feitas, e o que está
em curso.

**Decisão (26/09):** "números certos + o que anda". A frase de cima usa os
números da própria Início (decisões, tarefas, gaveta, trabalhando agora); o
"73 coisas travadas em você" saiu. Medido no caminho: o quadro não tem cartão
"andando" nenhum (323 na fila, 23 travadas, 9 você decide), então "andando"
vem das sessões trabalhando agora, com a frente delas, e de cada projeto
aparecem os cartões que dependem dele e os travados. Fila e feitas saíram.

## 11. Semana

Horas ativas nos últimos 7 dias, barra por dia, e os 3 projetos que mais
tomaram tempo.

**Decisão (26/09):** "gosto do jeito que tá agora, mostrando quando eu
trabalhei na semana, mas também gostei do que você propôs (…) vamos fazer
ambos". As barras ficaram; entraram as duas contas lado a lado, horas de
relógio (a união dos trechos) e horas de agente (a soma das sessões), com o dia
virando à meia-noite de Brasília e o aviso "só VPS". Medido na primeira leitura:
20,5h de relógio contra 33,7h de agente, e o dia antigo cortava às 21h de
Brasília. Cálculo em `semanaDosBlocos()`, com teste montado à mão.

## 12. Limites

Uso do plano do Claude (janela de 5 horas e semana) e quando zera. O agy
aparece sem número porque não informa o uso.

**Decisão (26/09):** "as duas: ritmo + aviso no sino". Cada janela ganhou uma
linha de ritmo: "no ritmo atual, termina em 48%" ou "chega a 100% às 16:20"
(na semana, o dia). Nos primeiros 10% da janela a linha não aparece, porque a
conta seria chute. E o sino avisa, em vermelho e acima das decisões, quando
qualquer janela passa de 80%; tocar no aviso leva ao bloco Limites. Provado em
390 com o uso real (22% e 25%) e com a semana forçada a 85% só na página.
No caminho: sessão aberta pelo painel e ainda sem conversa aparecia na Decisões
como "parou sem pergunta legível" (o burocracIA). Saiu, com teste.

## 13. VPS e Serviços

Retrato da VPS por dentro (com avisos) e até 12 serviços no ar, com porta e
máquina, e atalho para a tela Servidores.

**Decisão (26/09):** "as duas: retrato sozinho + só projetos".
- O retrato da VPS estava de 13/08 (só renovava no clique). Agora o painel
  renova sozinho de hora em hora, ~5 segundos por leitura. Só quando o painel
  roda NA VPS lendo a própria máquina; no PC a leitura usa a chave SSH dele e
  continua só no clique. O retrato novo mostrou o disco em 127 de 193 GB (era
  68 em 13/08).
- Serviços mostra só o que é projeto (4 hoje) e diz quantos programas ficaram
  de fora (52, quase todos do Windows do PC), que continuam em "ver todos".
- No caminho: "Tudo no ar" saía em VERMELHO desde sempre. A tela esperava a
  cor "ok" e o servidor manda "bom".

## Extra: o mosaico (26/09)

Print dele no desktop, com Decisões comprida e um buraco do tamanho da tela ao
lado de Sessões: *"precisamos pensar em uma forma da tela ficar sempre modular,
ela ir se reconstruindo e encaixando os módulos de acordo com o tamanho deles"*.
Escolha dele entre quatro: colunas tipo Pinterest.

A primeira tentativa, colunas nativas do navegador, deixava a terceira coluna
vazia, porque elas enchem em sequência. O que ficou é o encaixe clássico de
mosaico: grade de linhas de 8px, cada bloco ocupa as linhas da própria altura,
e o bloco seguinte sobe para o buraco que sobrou. Medido em 1660px: três
colunas, antes eram duas com a direita vazia. Em 390px continua uma lista só.

## Extra: consultas repetidas num cartão só (26/09)

No mesmo print, a maior parte de Decisões era o simulador de cripto do PC: ele
consulta o Claude a cada jogada, e cada consulta virava um cartão PAROU
("json COMPRAR confiança 55"). Escolha dele entre três: "juntar num cartão só".

Três ou mais cartões parados sem pergunta, do mesmo projeto e da mesma máquina,
viram um cartão REPETIDAS com a contagem, "ver as N" (a lista fica aberta
entre um redesenho e outro) e "fechar todas". Pergunta com opções nunca entra
no grupo. Sessões junta do mesmo jeito. O número do bloco, o sino e o Kanban
passaram a contar o que a tela mostra: com 53 consultas, eram 61 decisões para
9 cartões; agora é 8 para 8. Provado no navegador com o fechar interceptado,
sem fechar nada de verdade.

## Extra: expandir, tela Decisões e filtro (26/09)

Pedido dele: *"podemos colocar um expandir nos blocos? (…) ao invés de ele
virar uma coluna gigante ele virar duas colunas e ocupar mais espaço na
horizontal"*, mais uma tela só das decisões e a pergunta *"um filtro de
decisões por projetos (será que valeria a pena? não quero poluir)"*.

- Todo bloco da Início tem o botão de expandir no canto do título. Expandido,
  ocupa duas colunas e o conteúdo se divide em duas. Medido em 1660px:
  Decisões foi de 456 para 928px de largura e de 819 para 496px de altura.
  O navegador lembra quais ficaram expandidos. No celular o botão some,
  porque só existe uma coluna.
- Tela Decisões no menu, logo abaixo da Início, com os mesmos cartões em grade
  larga. O bloco da Início ganhou o atalho "tela".
- O filtro por projeto mora só nessa tela, e só aparece com decisões de mais
  de um projeto: a Início não ganhou nada.
- A tela esconde as contas velhas do topo, que diziam 148 com 6 cartões.

## Extra: todas as sessões conectadas (27/09, madrugada)

Print dele do app do Claude com 8 sessões conectadas: *"olha o tanto de
projeto aberto, pq só aparecem alguns?"*. Medido: as 8 estavam no painel, mas
o bloco Sessões só mostrava quem trabalhava naquele minuto (1), a Decisões só
quem estava "espera você" (2), e 5 estavam "ociosas", que nenhum bloco mostrava.
Pior: parada que envelhecia de "espera você" para "ociosa" saía da Decisões sem
ir para "Fechadas e antigas". O burocracIA pedia "write 'pode codar' to unblock
coding" e não aparecia em lugar nenhum.

Decisão dele: "as duas coisas".
- O bloco Sessões mostra TODAS as conectadas, com o estado de cada uma
  (trabalhando, espera você, ociosa), trabalhando no topo. O "parar" só aparece
  em quem trabalha. A contagem separa a pasta pessoal: das 129 "conectadas",
  112 eram consultas do simulador de cripto, num cartão só, no fim da lista.
- Ociosa com fala do agente é parada também: entra na Decisões e, passadas 2
  horas, vai para "Fechadas e antigas" com "reabrir". Medido depois: 4 foram
  para Decisões e 4 para Fechadas e antigas (burocracIA entre elas). Teste em
  `test-cockpit2.mjs`.

## Extra: sessão por programa e sessão fechada (27/09)

Dois achados com print dele, os dois nascidos da regra "ociosa com fala é
decisão":
- **Sessão por programa.** Duas "PAROU · sumauma" eram testes da skill das
  gavetas, disparados às 13:50 pela sessão do webscrapper com `claude -p` na
  pasta do sumauma. A conversa gravada marca isso (`entrypoint: sdk-cli`), e
  agora sessão por programa não é decisão e só conta como conectada enquanto
  trabalha.
- **Sessão fechada.** A lista de sessões sai das conversas gravadas nas
  últimas 24h, que não dizem se o programa ainda está aberto: a teste-decisao,
  já fechada, seguia "conectada" e "parada". O Claude Code registra cada
  processo aberto em `~/.claude/sessions/<pid>.json`; sessão desta máquina fora
  desse registro vira "encerrada", fora das conectadas e das Decisões. Medido
  depois: as conectadas da VPS são exatamente as 8 do app dele.
- **Não era defeito:** o dengonator "sumiu" das Decisões porque voltou a
  trabalhar (respondeu a mensagem dele); estava em Sessões como trabalhando.
