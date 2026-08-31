# HANDOFF

**Sessão:** 2026-08-31 · Claude (Opus 5, `670e1313`) · **VPS**, rota `front`
**Último commit:** `96c39d1`, já no servidor e empurrado
**Branch:** `backlog/cc-46-48-49-52-53-56-65` · **versão `0.3.0`, publicada e no ar**

O que aconteceu: [diario/2026-08-30.md](diario/2026-08-30.md), seção "À noite,
no PC", e [diario/2026-08-31.md](diario/2026-08-31.md), as duas seções (a do PC
de manhã e a da VPS à tarde). Ponteiro, não relatório.

## ⚠️ A armadilha que mordeu hoje, e vai morder de novo

**Push não é entrega.** O interruptor de sincronia foi commitado e empurrado
ontem à noite, e quinze horas depois ele não existia na máquina dele: a cópia
instalada (`%LOCALAPPDATA%\AgentCockpit`) é publicada por um passo separado, e o
encerramento de ontem parou no push.

E publicar sozinho também não basta: **o processo no ar não recarrega arquivo**.
Depois de publicar, ele continuava respondendo sem o campo novo. Só a rota de
encerrar, com o supervisor religando, pôs o código novo em serviço.

A prova de que um recurso está entregue é **pedir o campo novo ao processo que
está no ar**, nunca o commit.

## ⚠️ Antes de encostar em código

**1. `git fetch` faz parte do Passo 0.** Já aconteceu duas vezes neste projeto
uma sessão trabalhar o dia inteiro numa cópia atrasada. O histórico local prova
que a pasta é consistente, nunca que ela é a mais nova.

**2. Existe uma cópia INSTALADA, separada desta.** Em
`%LOCALAPPDATA%\AgentCockpit`. É ela que roda e que serve o painel dele; esta
pasta é a oficina. Publicar é `cc versao publicar`. A Tarefa Agendada do login
já aponta pra ela (conferido nesta sessão, não só "aceitei").

**3. `docs/ALINHAMENTO-2026-08-30.md`** é o canal entre as máquinas, porque o
recado do Routia mora num arquivo que o git ignora e nunca atravessa.

## O que a sessão da VPS entregou depois desta (31/08, à tarde)

Pergunta dele, olhando o vaivém do dia: *"o pc fez algumas coisas e aqui você
fez outras (…) tem ideia melhor?"*.

- **O recado entre máquinas passa a atravessar (CC-434).** Ele pediu para
  avisar a sessão do PC e eu disse que não dava; ele corrigiu: *"como não?! a
  gente se comunica via hooks"*. Ele tinha razão sobre o mecanismo, eu sobre o
  alcance: o recado do Routia mora em arquivo que o git ignora e nunca sai da
  máquina. A fila da federação (a mesma que já leva o pedido de trocar de modo)
  passou a carregar texto, destinatário e tipo. Provado com recado real: a
  máquina de casa consumiu em menos de 8 segundos.
- **O botão de puxar e enviar passa a alcançar a outra máquina (CC-447).** A
  peça já existia desde o CC-269, com as travas certas (não commita, recusa com
  arquivo solto, roda o gate antes de enviar), e só funcionava na máquina onde
  alguém clicava. Agora o cartão de projeto remoto tem **buscar e enviar lá**.
  Não resolve quando as duas máquinas divergiram de verdade: nesse caso ele
  segue precisando de gente, de propósito.
- **Consertado um teste que veio do PC e falhava na VPS** (`test-pastas.mjs`):
  ele media o disco da máquina junto com o código, porque a descoberta de
  pastas cai em `os.homedir()`, que não respeita o isolamento de teste.
- **Um trabalho guardado de 20/08 voltou por cima de 13 arquivos** no meio de um
  merge. Antes de descartar, medi: das 692 linhas de conteúdo real, 682 já
  estavam no histórico, e as 10 restantes eram versões velhas do que hoje existe
  melhor. Restaurado o ponto fechado sem perder nada.

Portão em 406, verde.

## O que a sessão do PC entregou (30/08, à noite)

- **A síntese pelo opencode passou a rodar no Windows** (era o item 🔴 mais
  urgente do dia): trocado o jeito de chamar o programa externo, e o teste que
  antes só avisava "provavelmente não funciona aqui" agora prova de verdade.
- **A supervisão do Windows no login aponta pro lugar certo.** Rodou o comando
  que pede a permissão sozinho, ele confirmou a janela, e o resultado foi
  medido (não só o "aceitei"): sem painel duplicado sobrando.
- **Nomeado o Plano de Unificação**, em `docs/produto/COLETOR.md`: a VPS virar
  central de dado E de controle dos projetos. Uma ambiguidade real (controlar
  REGRA versus controlar cada AÇÃO em tempo real) foi resolvida por ele: a VPS
  decide a regra, o PC aplica na sincronização seguinte. O desenho inteiro
  ainda espera aprovação.
- **Pausar a sincronia pelo ícone da bandeja**, sem apagar token nem endereço
  (o comando antigo de desligar apagava os dois). `cc federar pausar`/`retomar`
  no terminal, dois itens de menu na bandeja.
- **Achado fora da lista: o login da VPS estava crashando o próprio servidor**
  com certas senhas (decodificação duplicada). Corrigido, com backup, e provado
  que texto malformado não derruba mais o processo. Fica registrado aqui porque
  o arquivo (`cockpit-auth.mjs`, na VPS) não é deste repositório.
- Três itens de tabela que já estavam prontos, só faltava marcar: pastas de
  projeto pelo terminal/bandeja/instalador, as travas saindo da pasta velha,
  três cópias virando uma.

Portão: verde, com o caso do Windows rodando de verdade em vez de pular.

## ⛔ O que espera ELE, e só ele resolve

1. **Ler e aprovar o desenho inteiro do coletor** (`docs/produto/COLETOR.md`).
   Uma peça dele (o tipo de controle remoto) já foi decidida nesta sessão; o
   resto do desenho continua esperando.
2. **As onze pastas de projeto do PC não têm o prefixo `PC_`**, que a regra
   dele de 23/08 pede. Renomear com sessão aberta quebra caminho, é decisão e
   mão dele.
3. **Os caminhos 2 e 3 do CC-433**: editar o MVP de um projeto do PC pela VPS
   exigiria afrouxar a lista fechada de ações da fila, decisão de risco.

## O que ficou para outra rota, com ticket no quadro

- **A faixa na tela dizendo, por máquina, se as travas valem lá** (metade do
  item da bandeja que falta): mexe em `src/ui_v2.html`, da rota `front`, cuja
  sessão está viva no PC dele agora. Não toquei.
- **O controle remoto do framework não deixa testemunha, e ninguém testa o lado
  que aplica.** Medido em 31/08: o PC já tem os três ramos que executam o pedido
  (a pendência antiga do mapa dizia o contrário e estava velha). Falta gravar em
  disco o pedido que CHEGA, como já se grava o que sai, e chamar por teste a
  função que executa. Os dois moram em `src/web.mjs`, da rota `front`. Detalhe
  no mapa, no item do controle pelo cockpit online.

## Pendências de commit

**Nenhuma.** O trabalho da VPS de 31/08 (recado entre máquinas, botão de
sincronizar remoto, conserto de `test-pastas.mjs`) já está commitado e
empurrado, em dois commits (`5c34078`, `96c39d1`), mais este encerramento.

O que o PC entregou em 30/08 (síntese no Windows, toggle da bandeja, teste do
CC-412) também já estava commitado antes desta sessão. O conserto do
`cockpit-auth.mjs` **não entra em commit nenhum**: vive só na VPS, fora deste
repositório.

## O que aprendi hoje e não pode se perder

1. **Ter rota marcada não dá acesso ao arquivo inteiro do vizinho.** Empréstimo
   de arquivo de outra rota precisa ser registrado por escrito, com o recorte
   exato do que muda, mesmo quando a autorização já foi dada por ele.
2. **Comando de terminal que apaga configuração pra "desligar" é armadilha se a
   mesma ação também existir num clique de bandeja.** Um clique errado não pode
   ter o mesmo custo que digitar um comando de propósito.
3. **`URLSearchParams.get()` já decodifica.** Decodificar de novo por cima
   quebra com texto que tem `%` sozinho, e sem `try/catch` em volta isso
   derruba o processo inteiro, não só aquele pedido.
4. **502 com senha certa não é sempre "senha errada".** Vale olhar o log do
   serviço antes de supor.

## Arquivos a ler

- `docs/produto/COLETOR.md` — o desenho que espera aprovação dele, com a peça
  do controle remoto já decidida
- `docs/ALINHAMENTO-2026-08-30.md` — o que a VPS fez em 30/08, escrito por ela
- `src/federacao.mjs` — `ACOES_DE_PEDIDO` agora tem `recado` e as três de
  `sincronia-*`; `pedirSessao` valida texto, destinatário e tipo
- `src/web.mjs` — o ramo que executa cada ação, dentro de `atenderPedidos`
- `src/ui_novo.html` — o botão **buscar e enviar lá**, no bloco do framework
  remoto do cartão de projeto
