---
tags: [produto, visao, design]
tipo: visao
atualizado: 2026-08-19
estado: direção escolhida em 19/08, não construída ainda
resumo: A direção de reforma visual e estrutural que ele escolheu, depois de rejeitar ajuste pontual e pedir "outro visual que melhorasse todo o approach". Registrado antes de construir, porque escolha de tela é dele.
termos:
  triagem: o bloco fixo no topo com o que precisa dele agora e o que está rodando, sem precisar abrir nada
  cartão de projeto: um projeto inteiro (agentes, custo, backlog, servidor, proteções) dentro de um bloco só, que abre e fecha
  gaveta do sistema: onde vai tudo que ele só ajusta de vez em quando, fora do caminho do dia a dia
---

# Redesenho da tela: a direção escolhida

## Como chegou aqui

Em 18/08 rodamos uma auditoria de heurísticas de UX (skill `impeccable`) sobre
`src/ui.html` e implementamos os 5 achados prioritários. Ele viu o resultado e
foi direto: *"eu queria que a IA sugerisse um outro visual que melhorasse todo
o approach do app, e até de redistribuição de funções e tal, não queria algo
tão pontual"*.

Duas perguntas, respondidas por ele em 19/08:

1. **Qual é o maior problema de uso hoje?** *"uma mistura de todos"* entre
   função demais espalhada em aba demais, o que importa não salta aos olhos
   rápido, e a tela não parecer um produto pensado pra ser usado com prazer.
2. **O que ele quer dizer com "redistribuição de funções"?** *"o que muda a
   cada segundo devia ficar separado do que é configuração"*.

Ele deu três exemplos concretos, todos conferidos contra o código real antes
de virar direção:

- **Remoto e servidores são usados juntos, hoje vivem em abas separadas.**
  Palavras dele: *"eu ligo um servidor, eu posso mudar o dele ali logo"*.
- **Falta uma visão de backlog cruzando TODOS os projetos numa aba só, em
  tabela**, com projeto e sprint colapsáveis, ativos abertos, inativos
  recolhidos embaixo. *"Muito importante e muito difícil de acessar do jeito
  que está agora."*
- **O que está aberto ou fechado tem que ficar salvo no servidor**, não preso
  ao aparelho. Hoje esse estado mora em `localStorage`: trocar de celular pro
  computador perde a escolha.

## As três direções apresentadas, e a que ele escolheu

Três estruturas diferentes foram propostas, cada uma respondendo o pedido de
um jeito:

1. **Painel de comando**: dois grupos só no topo, AGORA (tudo que muda
   sozinho) e SISTEMA (tudo que só se ajusta de vez em quando).
2. **Mapa por projeto**: a navegação principal vira a lista de projetos, e
   cada projeto abre tudo dele junto (agentes, custo, backlog, servidor,
   proteções); uma visão geral separada junta o backlog de todos.
3. **Um feed só, o resto vira gaveta**: no topo, um feed contínuo do que
   precisa dele e do que está rodando; quase tudo mais vira um menu que abre
   por cima, em vez de abas fixas.

**Escolha dele: mesclar a 2 e a 3.** Não pediu construção ainda, pediu
registro (*"daria pra mesclar? anote"*).

## A direção mesclada, em detalhe

### Camada 1: a triagem, sempre no topo, em duas linhas

Vem da direção 3. Antes de qualquer lista de projeto, dois blocos curtos:

- **Precisa de você agora**: agente travado, esperando decisão, erro. Vazio
  quando não há nada, e some (não fica "0 itens" ocupando espaço).
- **Rodando agora**: o que está em progresso neste minuto, sem clicar em
  nada.

É a resposta direta ao "o que importa não salta aos olhos rápido": ele bate o
olho na tela e sabe em dois segundos se precisa agir.

### Camada 2: os projetos, cada um um cartão inteiro

Vem da direção 2. Abaixo da triagem, um cartão por projeto, não uma tabela de
dados por tipo. Dentro do cartão, tudo daquele projeto: quantos agentes,
custo do dia, estado do servidor (a fusão de remoto + servidores, um bloco só
por projeto: ligar sessão e ver/mudar a porta que ela abriu, sem trocar de
tela), backlog daquele projeto, proteções relevantes.

**Projeto ativo abre por padrão; projeto sem atividade recente fica recolhido
embaixo de uma linha "N projetos sem atividade agora".** O estado de aberto e
fechado de cada cartão viaja com ele: grava no servidor, não no navegador.
Resolve o "salvo no servidor" que ele pediu, e é o mesmo mecanismo que
resolve o pedido paralelo de colapsar sprint dentro de projeto.

### Camada 3: a visão geral do backlog, cruzando todos os projetos

Também da direção 2, e é o pedido mais concreto que ele fez: uma tabela só,
todo projeto, todo backlog, sprint colapsável dentro de projeto colapsável.
Existe como uma aba própria (não escondida dentro de cada cartão), porque é
onde ele planeja através de projetos, não dentro de um só.

### Camada 4: a gaveta do sistema

Vem da direção 3. Proteções (config, não o resumo que já mora no cartão do
projeto), VPS, rotinas, bancada, documentos, notas: tudo que ele só mexe de
vez em quando sai da fileira de abas fixas e vira um menu que abre por cima,
o oposto de competir por espaço com a triagem e os cartões todo santo dia.

## O que isso NÃO muda

Nenhuma função é cortada: é reorganização, não redução. As duas telas
(celular e monitor encaixado numa lateral, que têm a mesma largura efetiva) e
os dois temas continuam a régua de qualquer decisão de layout. A atualização
ao vivo continua automática.

## O que falta decidir antes de construir

✅ **As três perguntas abaixo foram respondidas em 19/08**, e as respostas
estão em [[CRITERIOS-DE-TELA]], cada uma amarrada a um número medido ou a uma
frase dele. Ficam aqui como registro do que estava em aberto:

- Onde exatamente a gaveta do sistema abre (canto, lateral inteira, por
  cima) e como ela se comporta no celular versus no monitor.
- Se a fusão remoto+servidores dentro do cartão de projeto cabe sem virar um
  cartão gigante quando o projeto tem vários servidores ligados.
- Se "projeto sem atividade" é definido por tempo parado, por agente nenhum
  rodando, ou pelos dois.

**Antes de construir, leia [[CRITERIOS-DE-TELA]].** Ele traz as cinco réguas
que desempatam escolha de layout, e existe justamente para nenhuma decisão de
tela virar discussão de gosto: a evidência que resolve estava espalhada em
quatro documentos.
